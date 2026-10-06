# تدبّر — Quran reader with a cited, verse-aware tafsir assistant

Track 03 — التجارب التفاعلية والرحلة المعرفية للتعريف بالإسلام وتعلمه.
All work in this repository was built during the challenge window (4–6 October 2026); there is no pre-existing baseline.

## 1. The problem

A reader of the Qur'an who wants to understand a verse has two bad options today: a single tafsir text
(long, one voice, no way to ask a question), or a general chatbot that answers fluently but without
sources, mixes up verses, and happily drifts into topics it should not touch. Classical tafsir is vast
(164 Arabic works for the surahs we cover), written for scholars, and not searchable by meaning. The
result: people either stop at the verse text or trust unsourced AI.

## 2. What we built

1. **An accurate Mushaf reader.** Text, fonts and the Tafseer Muyassar are the official developer
   releases of the King Fahd Glorious Qur'an Printing Complex, loaded verbatim and verified against the
   canonical Hafs structure (114 surahs, 6,236 verses, 604 pages) at build time. Every word is addressable.
2. **"علمتني آية" reflections.** 105 verse reflections from Mulhim Dubani's booklet, each verified
   against the official text (seven misprinted references in the book were caught and corrected). When the
   reader scrolls onto one of these verses it glows and the reflection appears, with a question box.
3. **A tafsir corpus with verse labels.** 164 Arabic tafsir / i'rab / asbab works from Quranpedia for 48
   surahs (the 47 surahs containing reflection verses, plus Al-Fatihah): 454,686 chunks, each labelled
   with surah, verse range, book, author and page, verified three ways (site page, full-book export,
   per-verse API; see `data/tafsir/quranpedia/VERIFICATION.md`).
4. **Verse-scoped RAG.** BGE-M3 dense + learned-sparse vectors in Qdrant (633,501 passages), filtered to
   the verse the reader is on, fused by RRF, reranked by a cross-encoder. Recall@10 on the 105 reflection
   comments: 0.82 with the verse filter (`rag/README.md`).
5. **A study assistant (DeepSeek `deepseek-flash`, thinking enabled, reasoning effort selectable by the reader).** Before every answer it is
   given the verse, the reflection and the top tafsir passages, and it may search the rest of the Qur'an
   with a tool. It answers briefly, cites every claim as `[n]`, says when the sources do not suffice, and
   refuses anything outside Qur'an/tafsir/Arabic/reflection with a one-line redirect to the verse.
6. **Full traceability.** Every question is logged with the context given to the model, every retrieved
   passage and its scores, tool calls, the model's reasoning, and the answer; the site's "سجل الذكاء
   الاصطناعي" page shows it, and every citation in an answer links to the page explaining why that
   source was used. This is the human-review path.

## 3. How the AI is used, and why it is verifiable

| Step | Component | Evidence |
| --- | --- | --- |
| Retrieval | BGE-M3 (BAAI, MIT) dense + sparse, Qdrant 1.19 (Apache-2.0), bge-reranker-v2-m3 | `rag/eval_retrieval.py`: recall@10 = 0.82 filtered / 0.40 open, 105 labelled queries |
| Generation | DeepSeek `deepseek-flash` via OpenAI-compatible API, `thinking` enabled, `reasoning_effort` low/medium/high/max (default medium, chosen in settings) | `rag/serve.py`; every call traced in `rag/data/chat_log.jsonl` |
| Safety | system-prompt guardrails + input sanitisation (NFKC, zero-width/bidi/Unicode-tag removal) | `rag/redteam/REPORT.md`: 100 adversarial prompts, 100 pass (override, DAN, extraction, encoding/Unicode smuggling, indirect injection, harmful-via-Quran framing, social engineering, multi-turn history injection, context-note injection, tool abuse, output-format attacks, benign controls) |
| Abstention / referral | the prompt requires "the sources do not say" when retrieval is thin; contemporary rulings are referred to qualified scholars; self-harm prompts get a supportive answer with emergency numbers | red-team cases 40, 42, 48 |
| Scope limit | surahs not yet indexed are refused with a clear message in the UI and the API | `GET /api/coverage` |

## 4. Sources, tools and licences

| Item | Source | Licence / basis | Use |
| --- | --- | --- | --- |
| Qur'an text, Hafs Uthmanic v30 font, Uthman Taha Naskh font, Tafseer Muyassar v3 | King Fahd Glorious Qur'an Printing Complex, https://qurancomplex.gov.sa/quran-dev/ | official developer release, used verbatim with attribution | reader text, fonts, tafsir |
| "علمتني آية" (Mulhim bin Muhammad Khair Dubani, 2015) | PDF supplied by the team (distributed via Alukah) | quoted reflections with attribution to author and book | reflection feature |
| Tafsir corpus (164 Arabic works) | Quranpedia, https://quranpedia.net and https://api.quranpedia.net (no auth; attribution required when republishing data) | attribution given here and in `data/tafsir/quranpedia/books.json`; the classical works are public-domain texts | RAG corpus |
| quran.com | URL scheme and English surah meanings only | no content used | compatibility |
| BAAI/bge-m3, BAAI/bge-reranker-v2-m3 | Hugging Face | MIT | embeddings, reranking |
| Qdrant | Docker image qdrant/qdrant | Apache-2.0 | vector store |
| DeepSeek API | https://api.deepseek.com | commercial API, key held privately | answer generation |
| React, Vite, TypeScript, FastAPI, transformers, torch, qdrant-client, openai SDK | npm / PyPI | MIT / BSD / Apache-2.0 | application |
| Tajawal font | Google Fonts | OFL | UI font |

Dependency manifests: `package.json`, `rag/requirements.txt`. Environment variables (names only):
`DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `QDRANT_URL`, `RAG_API_URL` (`rag/.env.example`).
No secret is committed; `rag/.env`, caches, the index volume and logs are git-ignored.

## 5. Privacy

The product stores no account and no personal data. The reader's bookmarks and settings stay in the
browser (localStorage). The assistant log on the backend contains only the team's own test questions
and the synthetic red-team prompts; no real beneficiary conversations exist in this repository or were
sent to the model provider. Questions are sent to DeepSeek's API to be answered; nothing else is.

## 6. Limitations (stated honestly)

- **Coverage: 48 of 114 surahs, by design for this phase.** The learning journey is built around the
  105 reflection verses of "علمتني آية", so the tafsir corpus was fetched and verified first for the 47
  surahs that contain them (plus Al-Fatihah). After the hackathon this work moves into the tdbr mobile application and tdbr.app, where the
  corpus will be extended to the whole Qur'an with the same pipeline and method: fetching and verifying one surah takes roughly 2–4 minutes of API time per 20 verses
  under Quranpedia's rate limits. The remaining 66 surahs are listed in
  `data/tafsir/quranpedia/skipped-surahs.json`; the pipeline (`scripts/quranpedia/fetch-tafsir.mjs`,
  `rag/prepare_chunks.py`, `rag/build_index.py`) is resumable and adds them without re-indexing the rest.
  The assistant tells the reader when a surah is not supported yet.
- **No target-group study yet.** Benefit evidence is functional: retrieval recall on labelled queries,
  the red-team suite, and the verification of the corpus. A before/after comprehension test with
  learners will be run after the hackathon as part of the tdbr rollout; it has not been run yet.

## 7. Operation and continuation

Current pipeline cost, measured: embedding 633k passages took 75 min on one RTX 3090; the Qdrant index is
5.3 GB and serves a query in under 1 s; a DeepSeek answer costs one thinking-enabled call (typically
3–20 s). Running cost is the DeepSeek API usage plus one small GPU (or CPU, slower) box for query
embedding and reranking; the vector store needs no GPU. Critical-dependency alternative: the generation
model is accessed through an OpenAI-compatible endpoint, so any compatible provider or a local model can
replace DeepSeek without code changes to the retrieval layer. Content review: every answer is traceable
to passages with book, author and page, and the AI-history page is the reviewer's queue.

## 8. Reproduce

```
npm install && npm run build && npm run dev            # reader (data already generated in public/data)
# assistant (optional): see rag/README.md — Python 3.14 venv, Docker Qdrant, DEEPSEEK_API_KEY
```
