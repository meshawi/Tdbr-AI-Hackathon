"""Turn data/tafsir/quranpedia/surah/*/book-*.json into retrieval passages.

Output: rag/data/passages.jsonl  (one JSON object per line)
  id          stable 16-hex id (sha1 of book|surah|chunk index|part)
  book_id, book_name, author, category, service
  surah, surah_name, ayah_from, ayah_to, verse_keys, book_page
  chunk_index (position in the surah/book file), part, parts (after splitting long chunks)
  text        readable text (diacritics kept)
  text_norm   normalised text that is embedded and matched
  source_url  the Quranpedia page for the surah/book

Rules (from the corpus profile):
  - exact duplicate texts (same book edition listed twice, repeated page) are kept once
  - fragments shorter than MIN_CHARS after cleaning (numbered stubs, bare surah titles) are dropped
  - passages longer than MAX_CHARS are split at sentence boundaries with overlap, metadata copied
Usage: python rag/prepare_chunks.py [--surahs 1,2,3]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from textnorm import html_to_text, normalize, split_long  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "tafsir", "quranpedia", "surah")
OUT = os.path.join(ROOT, "rag", "data", "passages.jsonl")
MIN_CHARS = 40
MAX_CHARS = 1800
OVERLAP = 250


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--surahs", default="", help="comma list; default = every surah folder present")
    args = ap.parse_args()
    surahs = [int(x) for x in args.surahs.split(",") if x] or sorted(int(d) for d in os.listdir(SRC))

    stats = Counter()
    seen: set[str] = set()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf8") as out:
        for s in surahs:
            folder = os.path.join(SRC, str(s))
            index = json.load(open(os.path.join(folder, "index.json"), encoding="utf8"))
            for b in index["books"]:
                if not b.get("file"):
                    continue
                d = json.load(open(os.path.join(folder, b["file"]), encoding="utf8"))
                book = d["book"]
                for ci, c in enumerate(d["chunks"]):
                    stats["chunks"] += 1
                    text = html_to_text(c["html"])
                    if len(text) < MIN_CHARS:
                        stats["dropped_short"] += 1
                        continue
                    key = hashlib.sha1(re.sub(r"\s+", "", normalize(text)).encode()).hexdigest()
                    if key in seen:
                        stats["dropped_duplicate"] += 1
                        continue
                    seen.add(key)
                    pieces = split_long(text, MAX_CHARS, OVERLAP)
                    if len(pieces) > 1:
                        stats["split_chunks"] += 1
                    for pi, piece in enumerate(pieces):
                        pid = hashlib.sha1(f"{book['id']}|{s}|{ci}|{pi}".encode()).hexdigest()[:16]
                        rec = {
                            "id": pid,
                            "book_id": book["id"],
                            "book_name": book["name"],
                            "author": book.get("author"),
                            "category": book.get("category"),
                            "service": book.get("service"),
                            "surah": s,
                            "surah_name": d["surahName"],
                            "ayah_from": c["ayahFrom"],
                            "ayah_to": c["ayahTo"],
                            "verse_keys": c["verseKeys"],
                            "book_page": c.get("bookPage"),
                            "chunk_index": ci,
                            "part": pi + 1,
                            "parts": len(pieces),
                            "text": piece,
                            "text_norm": normalize(piece),
                            "source_url": d["sourceUrls"].get("site"),
                        }
                        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                        stats["passages"] += 1
                        stats["chars"] += len(piece)
            print(f"surah {s}: passages so far {stats['passages']}", flush=True)
    json.dump(dict(stats), open(os.path.join(ROOT, "rag", "data", "prepare_stats.json"), "w"), indent=1)
    print(json.dumps(dict(stats), indent=1))


if __name__ == "__main__":
    main()
