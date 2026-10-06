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
serve.py           FastAPI: /search, /answer (DeepSeek with citations), /health
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
`RAG_EMBED_MODEL`, `RAG_RERANKER`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`.

## Answer contract for the backend

`POST /answer` returns `{"answer": "...", "sources": [{"n": 1, "citation": "...", "book_id": ..,
"surah": .., "ayah_from": .., "ayah_to": .., "book_page": .., "source_url": ".."}]}`. The answer text
cites `[n]`; the UI can turn each `[n]` into a link to the source passage, and `source_url` points to
the Quranpedia page for that surah and book.
