"""Retrieval + answer API for the backend.

  uvicorn serve:app --app-dir rag --host 0.0.0.0 --port 8000

POST /search  {"query": "...", "surah": 2, "ayah": 255, "top_k": 8}
      -> {"hits": [{citation, text, book_id, book_name, author, surah, ayah_from, ayah_to, book_page, source_url, score}]}
POST /answer  {"question": "...", "surah": 2, "ayah": 255, "top_k": 8}
      -> {"answer": "...", "sources": [...]}      (DeepSeek, cites sources as [n]; DEEPSEEK_API_KEY required)
GET  /health
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from search import search  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEEPSEEK_BASE = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

app = FastAPI(title="Tafsir RAG", version="0.1")


class SearchReq(BaseModel):
    query: str
    surah: int | None = None
    ayah: int | None = None
    ayah_to: int | None = None
    book_ids: list[int] | None = None
    top_k: int = 8
    rerank: bool = True


class AnswerReq(SearchReq):
    question: str | None = None


def verse_text(surah: int, ayah: int, ayah_to: int | None = None) -> str:
    """KFGQPC Uthmani text of the verse(s) from the app's data, for grounding the answer."""
    try:
        d = json.load(open(os.path.join(ROOT, "public", "data", "surah", f"{surah}.json"), encoding="utf8"))
    except OSError:
        return ""
    hi = ayah_to or ayah
    return " ".join(" ".join(v["w"]) + f" ({v['n']})" for v in d["verses"] if ayah <= v["n"] <= hi)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/search")
def do_search(req: SearchReq):
    hits = search(req.query, top_k=req.top_k, surah=req.surah, ayah=req.ayah, ayah_to=req.ayah_to, book_ids=req.book_ids, rerank=req.rerank)
    return {"hits": hits}


SYSTEM_PROMPT = (
    "أنت مساعد متخصص في تفسير القرآن الكريم. أجب بالعربية الفصحى اعتمادًا حصريًا على المصادر المرفقة، "
    "ولا تضف معلومات من خارجها. انسب كل معلومة إلى مصدرها برقمه بين قوسين معقوفين مثل [1] أو [2]، "
    "واذكر اسم الكتاب ومؤلفه عند أول استشهاد. إذا اختلفت أقوال المفسرين فاعرض الأقوال مع نسبتها. "
    "إذا لم تكفِ المصادر للإجابة فقل ذلك صراحة ولا تخمّن."
)


@app.post("/answer")
def do_answer(req: AnswerReq):
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        raise HTTPException(500, "DEEPSEEK_API_KEY is not set")
    from openai import OpenAI

    question = req.question or req.query
    hits = search(question, top_k=req.top_k, surah=req.surah, ayah=req.ayah, ayah_to=req.ayah_to, book_ids=req.book_ids, rerank=req.rerank)
    if not hits:
        return {"answer": "لم أجد في المصادر المتاحة ما يجيب عن هذا السؤال.", "sources": []}
    context = "\n\n".join(f"[{i}] {h['citation']}\n{h['text']}" for i, h in enumerate(hits, 1))
    verse = verse_text(req.surah, req.ayah, req.ayah_to) if req.surah and req.ayah else ""
    user = (f"الآية: {verse}\n\n" if verse else "") + f"السؤال: {question}\n\nالمصادر:\n{context}"
    client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE)
    resp = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}],
        temperature=0.2,
        max_tokens=1200,
    )
    answer = resp.choices[0].message.content
    sources = [{"n": i, **{k: h[k] for k in ("citation", "book_id", "book_name", "author", "surah", "surah_name", "ayah_from", "ayah_to", "book_page", "source_url")}} for i, h in enumerate(hits, 1)]
    return {"answer": answer, "sources": sources, "model": DEEPSEEK_MODEL}
