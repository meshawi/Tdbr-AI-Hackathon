"""Throughput benchmark for the indexing loop: GPU batch size x max tokens, plus Qdrant upsert cost.
Uses a fixed sample of passages so configurations are comparable.
Usage: rag/.venv/Scripts/python.exe rag/bench_embed.py [--n 1536] [--offset 400000]
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import torch  # noqa: E402
from qdrant_client import QdrantClient, models  # noqa: E402

from embedder import get_embedder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSAGES = os.path.join(ROOT, "rag", "data", "passages.jsonl")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1536)
    ap.add_argument("--offset", type=int, default=400000)
    args = ap.parse_args()
    texts = []
    with open(PASSAGES, encoding="utf8") as f:
        for p in itertools.islice(f, args.offset, args.offset + args.n):
            texts.append(json.loads(p)["text_norm"])
    e = get_embedder()
    tok_lens = [len(x) for x in e.tokenizer(texts[:512], truncation=False)["input_ids"]]
    tok_lens.sort()
    print(f"sample: {len(texts)} passages; tokens p50={tok_lens[len(tok_lens)//2]} p90={tok_lens[int(len(tok_lens)*.9)]} max={tok_lens[-1]}; >512 tokens: {sum(t > 512 for t in tok_lens)/len(tok_lens):.0%}, >1024: {sum(t > 1024 for t in tok_lens)/len(tok_lens):.0%}")
    e.encode(texts[:64], batch_size=16)  # warm-up
    results = []
    for max_len, bs in [(1024, 16), (1024, 24), (1024, 32), (1024, 48), (1024, 64), (768, 32), (768, 64), (512, 32), (512, 64), (512, 128)]:
        torch.cuda.synchronize(); torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        try:
            e.encode(texts, batch_size=bs, max_length=max_len)
            torch.cuda.synchronize()
            dt = time.time() - t0
            mem = torch.cuda.max_memory_allocated() / 1e9
            results.append((max_len, bs, len(texts) / dt, mem))
            print(f"max_len={max_len:4d} batch={bs:3d}: {len(texts)/dt:6.1f} passages/s  peak {mem:.1f} GB", flush=True)
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            print(f"max_len={max_len:4d} batch={bs:3d}: OOM", flush=True)
    # upsert cost for 256 points with 1024-d dense + sparse
    client = QdrantClient(url=os.environ.get("QDRANT_URL", "http://localhost:6333"), timeout=120)
    emb = e.encode(texts[:256], batch_size=32)
    pts = [models.PointStruct(id=10**15 + i, vector={"dense": d.tolist(), "lexical": models.SparseVector(indices=list(s.keys()), values=list(s.values()))}, payload={"bench": True}) for i, (d, s) in enumerate(zip(emb.dense, emb.sparse))]
    t0 = time.time(); client.upsert("tafsir", points=pts, wait=True); dt_wait = time.time() - t0
    t0 = time.time(); client.upsert("tafsir", points=pts, wait=False); dt_nowait = time.time() - t0
    client.delete("tafsir", points_selector=models.PointIdsList(points=[p.id for p in pts]), wait=True)
    print(f"qdrant upsert of 256 points: wait=True {dt_wait*1000:.0f} ms, wait=False {dt_nowait*1000:.0f} ms")
    best = max(results, key=lambda r: r[2])
    print(f"best: max_len={best[0]} batch={best[1]} -> {best[2]:.1f} passages/s")


if __name__ == "__main__":
    main()
