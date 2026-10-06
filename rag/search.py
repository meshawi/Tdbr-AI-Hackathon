"""Hybrid retrieval over the tafsir index: dense + lexical (RRF) with verse/book filters and a
cross-encoder reranker. Returns passages with ready-made citation strings.

    from rag.search import search
    hits = search("ما معنى الصراط المستقيم", surah=1, ayah=6, top_k=8)

CLI:  rag/.venv/Scripts/python.exe rag/search.py "سؤال" [--surah 2] [--ayah 255] [--books 136,3] [--no-rerank]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from functools import lru_cache

sys.path.insert(0, os.path.dirname(__file__))
import torch  # noqa: E402
from qdrant_client import QdrantClient, models  # noqa: E402
from transformers import AutoModelForSequenceClassification, AutoTokenizer  # noqa: E402

from embedder import get_embedder  # noqa: E402
from textnorm import normalize  # noqa: E402

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.environ.get("RAG_COLLECTION", "tafsir")
RERANKER_ID = os.environ.get("RAG_RERANKER", "BAAI/bge-reranker-v2-m3")
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def ar_num(n: int) -> str:
    return "".join(ARABIC_DIGITS[int(d)] for d in str(n))


@lru_cache(maxsize=1)
def _client() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL, timeout=60)


class Reranker:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tok = AutoTokenizer.from_pretrained(RERANKER_ID)
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.model = AutoModelForSequenceClassification.from_pretrained(RERANKER_ID, torch_dtype=dtype).to(self.device).eval()

    @torch.inference_mode()
    def score(self, query: str, docs: list[str], batch_size: int = 16) -> list[float]:
        out: list[float] = []
        for i in range(0, len(docs), batch_size):
            enc = self.tok([query] * len(docs[i : i + batch_size]), docs[i : i + batch_size], padding=True, truncation=True, max_length=1024, return_tensors="pt").to(self.device)
            out.extend(self.model(**enc).logits.view(-1).float().cpu().tolist())
        return out


_reranker: Reranker | None = None


def get_reranker() -> Reranker:
    global _reranker
    if _reranker is None:
        _reranker = Reranker()
    return _reranker


def build_filter(surah: int | None, ayah: int | None, ayah_to: int | None, book_ids: list[int] | None, categories: list[str] | None) -> models.Filter | None:
    must: list[models.Condition] = []
    if surah:
        must.append(models.FieldCondition(key="surah", match=models.MatchValue(value=surah)))
    if ayah:
        hi = ayah_to or ayah
        # passage range [ayah_from, ayah_to] must overlap the requested range [ayah, hi]
        must.append(models.FieldCondition(key="ayah_from", range=models.Range(lte=hi)))
        must.append(models.FieldCondition(key="ayah_to", range=models.Range(gte=ayah)))
    if book_ids:
        must.append(models.FieldCondition(key="book_id", match=models.MatchAny(any=book_ids)))
    if categories:
        must.append(models.FieldCondition(key="category", match=models.MatchAny(any=categories)))
    return models.Filter(must=must) if must else None


def citation(p: dict) -> str:
    verses = f"الآية {ar_num(p['ayah_from'])}" if p["ayah_from"] == p["ayah_to"] else f"الآيات {ar_num(p['ayah_from'])}-{ar_num(p['ayah_to'])}"
    page = f"، ص {p['book_page']}" if p.get("book_page") else ""
    author = f" ({p['author']})" if p.get("author") else ""
    return f"{p['book_name']}{author} — سورة {p['surah_name']}، {verses}{page}"


def search(
    query: str,
    top_k: int = 10,
    surah: int | None = None,
    ayah: int | None = None,
    ayah_to: int | None = None,
    book_ids: list[int] | None = None,
    categories: list[str] | None = None,
    rerank: bool = True,
    prefetch: int = 60,
) -> list[dict]:
    q = normalize(query)
    emb = get_embedder().encode([q], batch_size=1, max_length=256)
    dense = emb.dense[0].tolist()
    sparse = models.SparseVector(indices=list(emb.sparse[0].keys()), values=list(emb.sparse[0].values()))
    flt = build_filter(surah, ayah, ayah_to, book_ids, categories)
    res = _client().query_points(
        COLLECTION,
        prefetch=[
            models.Prefetch(query=dense, using="dense", limit=prefetch, filter=flt),
            models.Prefetch(query=sparse, using="lexical", limit=prefetch, filter=flt),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        limit=prefetch,
        with_payload=True,
    )
    hits = [{"score": pt.score, **pt.payload} for pt in res.points]
    if rerank and hits:
        scores = get_reranker().score(q, [normalize(h["text"]) for h in hits])
        for h, s in zip(hits, scores):
            h["rerank_score"] = s
        hits.sort(key=lambda h: h["rerank_score"], reverse=True)
    hits = hits[:top_k]
    for h in hits:
        h["citation"] = citation(h)
    return hits


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--surah", type=int)
    ap.add_argument("--ayah", type=int)
    ap.add_argument("--ayah-to", type=int)
    ap.add_argument("--books", default="")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--no-rerank", action="store_true")
    a = ap.parse_args()
    hits = search(a.query, top_k=a.top, surah=a.surah, ayah=a.ayah, ayah_to=a.ayah_to, book_ids=[int(x) for x in a.books.split(",") if x] or None, rerank=not a.no_rerank)
    for i, h in enumerate(hits, 1):
        print(f"\n[{i}] {h['citation']}  (rrf={h['score']:.4f}" + (f", rerank={h['rerank_score']:.2f})" if "rerank_score" in h else ")"))
        print(h["text"][:400].replace("\n", " "))
    print(json.dumps({"hits": len(hits)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
