# Tafsir RAG (Arabic) — design and operations

## What kind of RAG, and why

**Verse-scoped hybrid retrieval with a cross-encoder reranker, feeding DeepSeek with numbered sources.**

The corpus is 164 Arabic tafsir/i'rab/asbab works from Quranpedia, 454,686 chunks, ~668 M characters,
every chunk already labelled with surah, ayah range, book, author and page. That label is the single most
valuable retrieval signal: a question about a verse should only ever be answered from passages *about
that verse*. So the design is:

| Layer | Choice | Reason |
| --- | --- | --- |
| Unit of retrieval | the Quranpedia chunk (a page or verse-group of one book), split at ~1,800 chars with 250 overlap when longer | keeps citations exact (book, verses, page); long pages split so one embedding is not asked to summarise 7,000 chars |
| Metadata filter | Qdrant payload filter on `surah`, `ayah_from <= a <= ayah_to`, `book_id`, `category` | when the user is on a verse, retrieval is restricted to that verse's passages first; no reranker can beat a correct filter |
| Dense vectors | BAAI/bge-m3, 1024-d, cosine, fp16 on the RTX 3090 | best-established multilingual model for Arabic retrieval; 8k context; one forward pass also yields the lexical vector below |
| Lexical vectors | bge-m3 learned sparse weights (token id -> weight), stored as a Qdrant sparse vector | Arabic morphology and exact terms (names of narrators, technical terms, Quranic words) are matched lexically; learned weights beat raw BM25 on Arabic without stemming |
| Fusion | Qdrant server-side RRF of the two prefetches (60 each) | robust, no score calibration needed |
| Reranker | BAAI/bge-reranker-v2-m3 over the fused top-60, fp16 | multilingual cross-encoder; raises precision of the top-8 that go to the LLM |
| Store | Qdrant 1.19 in Docker, persistent named volume `qdrant_tafsir` | filters + dense + sparse in one engine, HTTP API for the backend, survives restarts |
| Generator | DeepSeek (`deepseek-chat`) via the OpenAI-compatible API | answers only from numbered sources, cites `[n]`, source list returned alongside |

Text normalisation (`textnorm.py`): diacritics, Qur'anic marks and tatweel removed; آ أ إ ٱ unified to ا;
ة / ى / ء kept. Applied identically to passages and queries, so a user question typed without
diacritics matches tafsir written with them. The displayed/cited text keeps the original form.

Not chosen: BM25 on raw Arabic (needs stemming to work well); chunking by fixed tokens (would cut
across verse boundaries and lose citations); GraphRAG (no benefit for citation-first Q&A); larger
embedding models such as Qwen3-Embedding-4B (3–5x slower on the 3090 for ~670 M characters, no
measured gain on this task); FAISS (no payload filtering).

## Files

```
textnorm.py        HTML -> text, Arabic normalisation, sentence-aware splitting
prepare_chunks.py  corpus -> rag/data/passages.jsonl (dedupe, drop stubs, split long)
embedder.py        BGE-M3 dense + sparse on transformers (Python 3.14 compatible)
build_index.py     embed + upsert into Qdrant, resumable, HNSW deferred until upload ends
search.py          hybrid search with filters + reranker; `search()` and a CLI
serve.py           FastAPI: /health, /search, /answer, /api/chat (SSE), /api/history, /api/history/{id}, /api/coverage
eval_retrieval.py  recall@k on the 105 reflection comments (labelled by verse)
```

## Run

```powershell
# one-time
uv venv rag/.venv --python 3.14
uv pip install --python rag/.venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cu128
uv pip install --python rag/.venv/Scripts/python.exe -r rag/requirements.txt
docker volume create qdrant_tafsir          # named volume: a Windows bind mount breaks Qdrant's segment renames
docker run -d --name qdrant-tafsir --restart unless-stopped -p 6333:6333 -p 6334:6334 `
  -v qdrant_tafsir:/qdrant/storage qdrant/qdrant:latest

# build
python rag/prepare_chunks.py                       # ~5 min, CPU
rag/.venv/Scripts/python.exe rag/build_index.py    # GPU, resumable (rag/data/index_checkpoint.json)

# use
rag/.venv/Scripts/python.exe rag/search.py "ما معنى الصراط المستقيم" --surah 1 --ayah 6
rag/.venv/Scripts/python.exe rag/eval_retrieval.py
$env:DEEPSEEK_API_KEY="..."; rag/.venv/Scripts/uvicorn.exe serve:app --app-dir rag --port 8000
```

Moving the index to the backend machine: `POST http://localhost:6333/collections/tafsir/snapshots` writes a
snapshot inside the volume (`docker cp qdrant-tafsir:/qdrant/storage/snapshots/tafsir/<file> .`); the Qdrant
snapshot-recover API restores it on any other Qdrant instance. Only the query embedder and the reranker
need a GPU; the vector store itself does not.

Evaluation (105 reflection comments as queries, 633,501 passages): recall@10 = 0.82 with a surah filter and
the reranker (0.75 without the reranker); 0.40 / 0.34 with no filter at all. The comments are free
reflections rather than tafsir language, so the open-corpus figure is a hard lower bound; the product
always knows the verse the reader is on, which is the filtered case.

Environment variables: `QDRANT_URL` (default http://localhost:6333), `RAG_COLLECTION` (tafsir),
`RAG_EMBED_MODEL`, `RAG_RERANKER`, `RAG_RERANK` (0 disables the reranker), `RAG_PREFETCH` (candidates per prefetch, default 60),
`RAG_RERANK_TOP` (rescore only the top N fused candidates; set ~12 on CPU), `RAG_RERANK_MAXLEN` (pair length, 512 on CPU),
`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`. On a 4-core CPU host the full reranker (30 x 1024 tokens) takes minutes,
which exceeds Cloudflare's 100 s first-byte limit; use `RAG_RERANK=0` or the two limits above.

## Chat route (`POST /api/chat`)

Request: `{"current_verse_id": "2:255", "chat_history": [{"role": "user"|"assistant", "content": "..."}], "user_message": "...", "stream": true, "context_note": "...", "brief": false}`.
`context_note` is appended to the system context (the reflection pulse sends the reflection text so "explain
more" means the reflection). `brief: true` is the reflection-pulse mode: two to three sentences, one tool
round, medium reasoning effort, ~10–20 s instead of ~15–30 s. The two surfaces (floating chat and the
pulse question box) share this route and the same answer renderer (`src/components/ChatAnswer.tsx`).
Response: Server-Sent Events, one JSON object per `data:` line:

| event | payload | meaning |
| --- | --- | --- |
| `sources` | `{sources: [{n, citation, book_id, book_name, author, surah, surah_name, ayah_from, ayah_to, book_page, source_url}]}` | passages the model was given (first for the verse, later for tool results) |
| `thinking` | – | the model started reasoning |
| `retry` | `{reason, effort}` | thinking used the whole token budget before any answer; the round is retried once at a lighter effort |
| `tool` | `{name, query}` | `search_other_verses` was called with this query |
| `delta` | `{text}` | streamed answer text; `[n]` refers to source `n` |
| `error` | `{message}` | API or configuration error |
| `done` | `{model}` | end of answer |

With `"stream": false` the route returns `{"answer", "sources", "tool_queries", "error"}` instead.

Flow: before the first model call the route retrieves, for the active verse, its KFGQPC text, its
"علمتني آية" reflection (if any) and the top 6 tafsir passages for the user's question (surah/ayah
filtered), and puts them in the system context. DeepSeek is called with the `search_other_verses` tool
(hybrid search over the whole index, 6 passages, deduplicated against the ones already shown). When the
model emits tool calls, the assistant turn is appended back **with its `reasoning_content`** (required by
DeepSeek), then the tool messages, and the model is called again; at most 2 tool rounds. Model settings:
`DEEPSEEK_MODEL` (default `deepseek-flash`), `thinking: {type: enabled}`, `reasoning_effort` from
`DEEPSEEK_REASONING_EFFORT` (default `medium`) or the request. Thinking tokens count toward `max_tokens`, so the
budget scales with effort (`TOKEN_BUDGET`: low 6k, medium 8k, high 12k, max 16k). If a round returns no answer text it
is retried once: `finish_reason=length` (thinking ate the budget) retries at a lighter effort, `finish_reason=stop`
(the model drafted the answer inside its reasoning) retries at the same effort with a nudge to write the final answer
(`length_retry` in the trace records reason and efforts; the SSE stream gets a `retry` event). If the
configured model is rejected the route falls back to `DEEPSEEK_FALLBACK_MODEL` (`deepseek-chat`) once.

Guardrails live in `SYSTEM_PROMPT` in `serve.py`: Quran, tafsir, Arabic linguistics and reflection only;
polite one-sentence refusal that steers back to the active verse; 3–5 sentences unless asked for detail;
cite `[n]`; say so when sources are insufficient; no contemporary fatwas.

Frontend: `src/components/ChatPanel.tsx` (floating button in the reader, bound to the selected verse or the
verse at the top of the viewport), `src/lib/chat.ts` (SSE client). Vite proxies `/api` to the service
(`vite.config.ts`, `RAG_API_URL` to override).

Secrets: `rag/.env` (git-ignored) holds `DEEPSEEK_API_KEY`; `rag/.env.example` lists the variables.

## Trace log and AI-history page

Every `/api/chat` call appends one record to `rag/data/chat_log.jsonl`: the raw and sanitised question,
surface (chat / pulse / redteam), verse, the context given to the model (verse text, reflection, note),
every retrieved source with stage (verse retrieval or tool search), retrieval query, RRF and reranker
scores and full text, tool calls and their results, the model's reasoning per round, finish reasons,
the answer, which sources it cited, timings, errors and flags (invisible characters removed, suspected
system-prompt leak, empty answer). `GET /api/history` lists them, `GET /api/history/{id}` returns one with,
per source, the reasoning sentences that mention its number and whether the answer cited it. The site
shows this at `/ai-history` and `/ai-history/{id}?source=n`; clicking a source in any answer opens that page.

Input hardening (`sanitize()`): NFKC normalisation (fullwidth/mathematical letters fold to plain), removal
of zero-width characters, bidi controls, soft hyphens and Unicode tag characters (U+E0000–E007F, the
"invisible instruction" smuggling trick), 4,000-character cap. Applied to the message, history and the
context note before anything reaches the model; the trace keeps the raw text when it differed.

## Red-team suite (`rag/redteam/`)

`prompts.json` holds 100 adversarial prompts across override, persona (DAN, developer mode, games,
"for a novel"), system-prompt extraction (direct, JSON, base64/hex), encoding/Unicode smuggling (tags,
zero-width, RTL override, homoglyphs, fullwidth, reversed, chained), indirect injection, harmful-via-Quran
framing, social engineering, multi-turn history injection (fake assistant consent, fake system turn),
injection through `context_note`, odd verse ids, tool abuse, output-format attacks, scope escape, and
benign controls that must be answered. `run.py` sends them through the live route with surface `redteam`,
classifies each answer (PASS / FAIL / REVIEW: refusal phrases, leak markers, `must` / `must_not` /
`tool_must_not` patterns, `max_tools`, `graceful_error`) and writes `REPORT.md` with a link to each trace.
Last full run: 100 pass, 0 fail, 0 review. Re-run after any prompt or guardrail change:

```
rag/.venv/Scripts/python.exe rag/redteam/run.py --dry-run        # encode + validate, no API calls
rag/.venv/Scripts/python.exe rag/redteam/run.py                  # all 100 against http://127.0.0.1:8000
rag/.venv/Scripts/python.exe rag/redteam/run.py --ids 24,25      # a subset
rag/.venv/Scripts/python.exe rag/redteam/run.py --reclassify     # re-score saved answers offline, rewrite REPORT.md
```

## Answer contract for the backend

`POST /answer` returns `{"answer": "...", "sources": [{"n": 1, "citation": "...", "book_id": ..,
"surah": .., "ayah_from": .., "ayah_to": .., "book_page": .., "source_url": ".."}]}`. The answer text
cites `[n]`; the UI can turn each `[n]` into a link to the source passage, and `source_url` points to
the Quranpedia page for that surah and book.
