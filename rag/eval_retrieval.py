"""Retrieval sanity check using the 105 "علمتني آية" reflections as labelled queries.

For each reflection the query is the author's comment (which never quotes the verse verbatim) and the
relevant verse is known. We report how often a passage of the right verse (same surah, ayah inside the
passage range) appears in the top-k, with and without a surah filter, with and without the reranker.
Usage: rag/.venv/Scripts/python.exe rag/eval_retrieval.py [--k 10] [--limit 105]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from search import search  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hit(hits: list[dict], surah: int, a_from: int, a_to: int) -> bool:
    return any(h["surah"] == surah and h["ayah_from"] <= a_to and h["ayah_to"] >= a_from for h in hits)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--limit", type=int, default=105)
    args = ap.parse_args()
    refl = json.load(open(os.path.join(ROOT, "public", "data", "reflections.json"), encoding="utf8"))["reflections"][: args.limit]
    indexed = {int(d) for d in os.listdir(os.path.join(ROOT, "data", "tafsir", "quranpedia", "surah"))}
    refl = [r for r in refl if r["surah"] in indexed]
    modes = {"open": {}, "open+rerank": {"rerank": True}, "surah": {}, "surah+rerank": {"rerank": True}}
    score = {m: 0 for m in modes}
    for r in refl:
        q = r["comment"]
        for m, kw in modes.items():
            filt = {"surah": r["surah"]} if m.startswith("surah") else {}
            hits = search(q, top_k=args.k, rerank=kw.get("rerank", False), **filt)
            if hit(hits, r["surah"], r["ayahFrom"], r["ayahTo"]):
                score[m] += 1
    n = len(refl)
    print(f"queries: {n} (reflections in indexed surahs), k={args.k}")
    for m in modes:
        print(f"  recall@{args.k} {m:14s}: {score[m]}/{n} = {score[m] / n:.2f}")


if __name__ == "__main__":
    main()
