"""Embed rag/data/passages.jsonl with BGE-M3 and upsert into Qdrant (collection "tafsir").

Hybrid index: named dense vector "dense" (1024, cosine, HNSW) + sparse vector "lexical" (BGE-M3 learned
lexical weights). Payload carries every citation field. Payload indexes on surah / ayah range / book
make verse-scoped retrieval a cheap filter instead of a post-filter.

Resumable: progress is checkpointed every batch in rag/data/index_checkpoint.json (line offset);
rerunning continues where it stopped. HNSW building is deferred until the upload finishes (m=0 during
bulk upload, then m=16), which is the recommended Qdrant bulk pattern.

Usage: rag/.venv/Scripts/python.exe rag/build_index.py [--batch 256] [--recreate]
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(__file__))
from qdrant_client import QdrantClient, models  # noqa: E402

from embedder import get_embedder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSAGES = os.path.join(ROOT, "rag", "data", "passages.jsonl")
CHECKPOINT = os.path.join(ROOT, "rag", "data", "index_checkpoint.json")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.environ.get("RAG_COLLECTION", "tafsir")
DIM = 1024


def ensure_collection(client: QdrantClient, recreate: bool) -> None:
    if recreate and client.collection_exists(COLLECTION):
        client.delete_collection(COLLECTION)
    if client.collection_exists(COLLECTION):
        return
    client.create_collection(
        COLLECTION,
        vectors_config={"dense": models.VectorParams(size=DIM, distance=models.Distance.COSINE, on_disk=False)},
        sparse_vectors_config={"lexical": models.SparseVectorParams(index=models.SparseIndexParams(on_disk=False))},
        hnsw_config=models.HnswConfigDiff(m=0),  # build the graph after bulk upload
        optimizers_config=models.OptimizersConfigDiff(indexing_threshold=0, memmap_threshold=None),
    )
    for field, schema in [
        ("surah", models.PayloadSchemaType.INTEGER),
        ("ayah_from", models.PayloadSchemaType.INTEGER),
        ("ayah_to", models.PayloadSchemaType.INTEGER),
        ("book_id", models.PayloadSchemaType.INTEGER),
        ("category", models.PayloadSchemaType.KEYWORD),
        ("service", models.PayloadSchemaType.KEYWORD),
    ]:
        client.create_payload_index(COLLECTION, field, schema)


def finalize(client: QdrantClient) -> None:
    client.update_collection(
        COLLECTION,
        hnsw_config=models.HnswConfigDiff(m=16, ef_construct=128),
        optimizers_config=models.OptimizersConfigDiff(indexing_threshold=20000),
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=1024, help="passages per embedding+upsert batch (sorted by length inside)")
    ap.add_argument("--gpu-batch", type=int, default=32, help="sequences per forward pass")
    ap.add_argument("--recreate", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="stop after N passages (smoke test)")
    args = ap.parse_args()

    client = QdrantClient(url=QDRANT_URL, timeout=120)
    ensure_collection(client, args.recreate)
    start_line = 0
    if not args.recreate and os.path.exists(CHECKPOINT):
        start_line = json.load(open(CHECKPOINT))["next_line"]
        print(f"resuming from line {start_line}")

    embedder = get_embedder()
    t0 = time.time()
    done = 0
    batch: list[dict] = []

    # Upserts run on a background thread so the GPU never waits for Qdrant. The checkpoint is written
    # by that thread only after Qdrant acknowledged the batch, so a crash can never skip passages.
    q: queue.Queue = queue.Queue(maxsize=3)
    errors: list[BaseException] = []

    def uploader() -> None:
        nonlocal done
        while True:
            item = q.get()
            if item is None:
                return
            points, next_line, count = item
            try:
                client.upsert(COLLECTION, points=points, wait=True)
            except BaseException as e:  # noqa: BLE001
                errors.append(e)
                return
            done += count
            json.dump({"next_line": next_line, "updated": time.time()}, open(CHECKPOINT, "w"))
            rate = done / max(1e-6, time.time() - t0)
            print(f"indexed {done} passages this run ({rate:.1f}/s), at line {next_line}", flush=True)

    worker = threading.Thread(target=uploader, daemon=True)
    worker.start()

    def flush(next_line: int) -> None:
        if not batch:
            return
        if errors:
            raise RuntimeError(f"upload failed: {errors[0]}")
        emb = embedder.encode([p["text_norm"] for p in batch], batch_size=args.gpu_batch)
        points = []
        for p, dense, sparse in zip(batch, emb.dense, emb.sparse):
            payload = {k: v for k, v in p.items() if k != "text_norm"}
            points.append(models.PointStruct(
                id=int(p["id"], 16),
                vector={"dense": dense.tolist(), "lexical": models.SparseVector(indices=list(sparse.keys()), values=list(sparse.values()))},
                payload=payload,
            ))
        q.put((points, next_line, len(batch)))
        batch.clear()

    with open(PASSAGES, encoding="utf8") as f:
        for lineno, line in enumerate(f):
            if lineno < start_line:
                continue
            batch.append(json.loads(line))
            if len(batch) >= args.batch:
                flush(lineno + 1)
                if args.limit and done >= args.limit:
                    break
        flush(lineno + 1)
    q.put(None)
    worker.join()
    if errors:
        raise RuntimeError(f"upload failed: {errors[0]}")

    if not args.limit:
        finalize(client)
        print("HNSW build enabled; Qdrant will optimise in the background")
    info = client.get_collection(COLLECTION)
    print(f"collection '{COLLECTION}': {info.points_count} points, status {info.status}")


if __name__ == "__main__":
    main()
