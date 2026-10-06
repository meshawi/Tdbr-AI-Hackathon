# Verification summary

Script: `node scripts/quranpedia/verify-tafsir.mjs --surahs <list> [--quick]` → `verification-report.json`

## Run 2 — the 47 surahs with "علمتني آية" verses, plus Al-Fatihah (2026-10-06, `--quick`)

| Check | Scope | Result |
| --- | --- | --- |
| Structure | 6,943 surah/book files, 454,686 chunks | 0 problems |
| Language | 6,943 files | 0 problems |
| Live per-ayah API | 11,027 sampled ayahs (middle and last ayah of every surah and book, until the endpoint's daily cap stopped live checks at surah 11; later samples that were already cached were still compared) | 21 flagged, all false positives (see below) |

The 21 flags are all on ayahs whose content is two very short chunks (for example the vocabulary book
409: a one-line gloss plus the next surah's title). The API lists the two chunks in the opposite order
to the embed renderer; the text is identical, only the order differs, which the 40-character segment
check reads as a mismatch across the chunk boundary. The three other books flagged (2391, 37, 108)
show the same two-chunk swap.

Live checks for the last 10 surahs in the run order (At-Tawbah, Taha, Al-An'am, As-Saffat, Al-A'raf,
Ash-Shu'ara and the re-run of 2, 3, 4, 5) hit the per-ayah endpoint's daily cap; those already have
cached samples from run 1 (surahs 2–5) or should be re-sampled on another day with
`--quick` (the cache makes everything else instant). The site-page and export containment checks were
not run in `--quick` mode for the new surahs; they passed for surahs 1–5 in run 1.

## Run 1 — surahs 1–5 (2026-10-06, full mode)

| Check | Scope | Result |
| --- | --- | --- |
| Structure | 780 surah/book files, 144,884 chunks | 0 problems |
| Language | 780 files | 0 problems |
| Site-page containment | 144,643 chunks shown on the full-surah website pages | all found in the data |
| Export containment | 123,288 chunks of the full-book exports | 7 chunks at 81–89 % segment coverage, all others ≥ 90 % |
| Live per-ayah API | 2,472 sampled ayahs | 4 ayahs at 83–90 % mutual coverage, all others ≥ 95 % |

Those 11 items were examined individually: footnote markers and numbers, hadith punctuation, poetry
hemistich separators and footnote placement; no differing span longer than 25 characters.

## Corpus

Books: 302 listed on the website for the fetched surahs, 164 Arabic books included, 138 skipped (all
translations into other languages; see `skipped-books.json`). Surahs: 47 with reflection verses plus
Al-Fatihah fetched; 67 deferred (`skipped-surahs.json`). Content source: embed windows for 154 books,
site page merged with export for the 10 `book` / `nasekh` works.
