"""Arabic text cleaning and normalisation shared by the indexer and the query side.

Two forms are kept for every passage:
  - `text`      : readable text for display and for the LLM (diacritics kept, ﴿﴾ kept, footnotes marked)
  - `text_norm` : what gets embedded and lexically matched; the same function is applied to queries,
                  so a query without diacritics matches tafsir text written with them.
"""
from __future__ import annotations

import html
import re

_TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")  # harakat, quranic marks, tatweel
_ALEF = re.compile(r"[آأإٱ]")  # آ أ إ ٱ -> ا
_ZW = re.compile(r"[​‌‍﻿­]")
_WS = re.compile(r"[ \t\r ]+")
_NL = re.compile(r"\n{3,}")

_TAG_BR = re.compile(r"<br\s*/?>", re.I)
_TAG_BLOCK_END = re.compile(r"</(p|div|li|h\d|tr)>", re.I)
_TAG_CELL_END = re.compile(r"</t[dh]>", re.I)
_TAG_FOOT = re.compile(r'<div class="(?:hamesh|foot-notes|margin)[^"]*">', re.I)
_TAG_ANY = re.compile(r"<[^>]+>")
_PAGE_MARK = re.compile(r"—\s*\d+\s*—")


def html_to_text(raw: str) -> str:
    """Rendered tafsir HTML -> readable plain text. Footnote/margin blocks are prefixed with a marker."""
    s = raw.replace("\r", "")
    s = _TAG_FOOT.sub("\n— هامش —\n", s)
    s = _TAG_BR.sub("\n", s)
    s = _TAG_CELL_END.sub(" | ", s)
    s = _TAG_BLOCK_END.sub("\n", s)
    s = _TAG_ANY.sub("", s)
    s = html.unescape(s)
    s = _ZW.sub("", s)
    s = _PAGE_MARK.sub("", s)
    s = _WS.sub(" ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = _NL.sub("\n\n", s)
    return s.strip()


def normalize(text: str) -> str:
    """Retrieval form: no diacritics/tatweel, hamza-alef variants unified, whitespace collapsed.
    Letters otherwise untouched (ة, ى, ء kept) so meaning-bearing spelling survives."""
    s = _TASHKEEL.sub("", text)
    s = _ALEF.sub("ا", s)
    s = _ZW.sub("", s)
    s = _WS.sub(" ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


_SENT_END = re.compile(r"(?<=[\.\!\?؟۔:؛\n])\s+")


def split_long(text: str, max_chars: int = 1800, overlap: int = 250, min_tail: int = 400) -> list[str]:
    """Split a long passage at sentence boundaries into windows <= max_chars with overlap.
    Short texts are returned as a single piece."""
    if len(text) <= max_chars:
        return [text]
    sentences = _SENT_END.split(text)
    pieces: list[str] = []
    cur = ""
    for sent in sentences:
        if not sent:
            continue
        if len(sent) > max_chars:  # pathological sentence: hard-wrap it
            if cur:
                pieces.append(cur.strip()); cur = ""
            for i in range(0, len(sent), max_chars - overlap):
                pieces.append(sent[i : i + max_chars].strip())
            continue
        if len(cur) + len(sent) + 1 > max_chars and cur:
            pieces.append(cur.strip())
            cur = cur[-overlap:] + " " + sent if overlap else sent
        else:
            cur = (cur + " " + sent) if cur else sent
    if cur.strip():
        if pieces and len(cur.strip()) < min_tail:
            pieces[-1] = (pieces[-1] + " " + cur.strip()).strip()
        else:
            pieces.append(cur.strip())
    return [p for p in pieces if p]
