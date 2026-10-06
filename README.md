# Quran Reader (React)

A backend-free Quran reading website modelled on quran.com, built with React 19, Vite and TypeScript.
All Quranic content is the **official developer release of the King Fahd Glorious Qur'an Printing Complex (KFGQPC)**: https://qurancomplex.gov.sa/quran-dev/

## Data sources (all KFGQPC, verbatim)

| Asset | File | Used for |
| --- | --- | --- |
| Hafs Uthmanic Unicode v30 (Sept 2026) | `data/kfgqpc/kfgqpc_hafs_v30.json` | Verse text, page, juz, line numbers, imlaei text |
| Hafs Smart v8 | `data/kfgqpc/hafs_smart_v8.json` | Display form of surah names |
| Tafseer Muyassar v3 | `data/kfgqpc/tafseerMouaser_v03.txt` | Per-verse tafsir |
| KFGQPC HAFS Uthmanic Script font v30 | `public/fonts/KFGQPC-HafsUthmanic-v30.ttf` | Rendering the verses and ayah markers |
| Uthman Taha Naskh | `public/fonts/KFGQPC-UthmanTahaNaskh.ttf` | Tafsir text |

The text is never edited by hand. `scripts/build-data.mjs` only tokenises each verse into words,
separates the end-of-ayah marker (`۝` + Arabic-Indic number) and the rub-el-hizb ornament (`۞`),
and writes static JSON to `public/data/`. `scripts/verify-data.mjs` cross-checks the output against the
canonical Hafs structure (114 surahs, 6236 verses, 604 pages, 30 juz, per-surah verse counts).

Metadata not shipped by KFGQPC lives in `scripts/chapter-meta.mjs`: quran.com URL slugs, English surah
meanings and the Makki/Madani classification printed in the Madinah Mushaf headers.

## Run

```bash
npm install
npm run build:data   # regenerates public/data from data/kfgqpc (already committed)
npm run dev          # http://localhost:5173
npm run build        # verifies + type-checks + bundles to dist/
npm run verify:data  # integrity check of public/data
```

## URLs (quran.com compatible)

- `/al-baqarah?startingVerse=14`, `/ar/al-baqarah?startingVerse=14`, `/2/14`, `/2:14`
- `/juz/1` … `/juz/30`, `/page/1` … `/page/604`
- `/search?q=الرحمن الرحيم`
- `?view=reading` or `?view=verse` switches the view mode from a link.

## Features

- Verse-by-verse view (quran.com style) and Mushaf reading view grouped by real Madinah Mushaf pages.
- Every word is an addressable element (`surah:verse:word`). Hover highlights it, click opens a popover with
  word position, imlaei spelling, copy, and a persistent word highlight.
- Per-verse actions: tafsir (Tafseer Muyassar), copy text, copy link, bookmark, highlight.
- Sticky context bar (surah, juz, page, current ayah) and "continue reading" memory.
- Settings: Arabic/English UI, light/dark/sepia themes, 7 font sizes, tafsir always-on, word popovers on/off.
- Client-side search over the imlaei text, diacritic-insensitive, with chapter-name and `2:14` reference matching.
- Everything persists in `localStorage`; no backend required.

## "علمتني آية" reflections

`data/reflections/allamatni-aya.json` holds the 105 verse reflections from the booklet *علمتني آية*
(Mulhim bin Muhammad Khair Dubani, 2015, `aya.pdf`), transcribed from the PDF. Each entry carries the
verse reference, the quoted fragment, the author's comment, the page in the PDF, and `printedRef`
(the reference exactly as printed, kept when it differed from the verified one; see `note`).

`scripts/build-reflections.mjs` resolves surah names to numbers, checks that every quoted fragment
really occurs in the KFGQPC text of the referenced verse(s), and writes `public/data/reflections.json`
(with the full Uthmani text of each verse attached). The build fails if any fragment does not match.

In the app, verses that appear in the book get a gold marker and a spark badge. When you scroll onto one
of them it glows and a pulsing panel shows the reflection. The badge expands the reflection inline.
Toggle in settings: "Show A Verse Taught Me reflections".

## Tafsir corpus from Quranpedia (`data/tafsir/quranpedia`)

Source: https://quranpedia.net/surah-tafsir/{surah} (free, no authentication; API docs at https://api.quranpedia.net).
Only Arabic-language books are kept. Translations into other languages and books written in other languages
are listed in `skipped-books.json` with the reason.

```bash
node scripts/quranpedia/fetch-tafsir.mjs --surahs 1-5     # scrape + store (cached under .cache/quranpedia)
node scripts/quranpedia/verify-tafsir.mjs --surahs 1-5    # 3-way verification, writes verification-report.json
```

How the content is fetched (and why): three sources were compared chunk by chunk.

- The full-surah website page (`/surah/1/{surah}/book/{id}`) silently omits some chunks (e.g. 3 of 9 for
  book 309 on Al-Fatihah).
- The full-book export (`books-contents/book-{id}.json`) omits chunks that have no page number, and 44 of
  the listed books have no export at all.
- The embed fragment (`api.quranpedia.net/embed?surah=S&ayah=A-B&type=T&book=ID&fragment=1&lock=1`) is the
  same renderer as the site's ayah modal and the per-ayah JSON endpoint, returns every chunk for every ayah,
  and accepts windows of up to 20 ayahs. This is the primary source (`contentSource: "embed"`). When a
  window's first ayah has no content the fragment has no headers; that ayah is then taken from
  `/v1/ayah/{s}/{a}/book/{id}` and the window moves on.
- Books whose service type has no embed section (`book`, `nasekh`: 10 works such as Al-Qurtubi) are built
  from the site page merged with the export (`contentSource: "site+export"`) and get twice as many API
  spot checks.

Chunks from different sources split the same text at different places, so the verifier compares text
coverage (40-character segments, whitespace and punctuation insensitive), not chunk identity.

Layout:

```
books.json                  every book the site lists for the fetched surahs: metadata, included/skipped, reason
skipped-books.json          the excluded books (language, type, reason)
surah/{s}/index.json        books available for that surah with chunk and character counts
surah/{s}/book-{id}.json    one book for one surah: contentSource, chunks[] with ayahFrom/ayahTo, ayahs, verseKeys, bookPage, html
verification-report.json    result of verify-tafsir.mjs
```

Each chunk is stored in full as the HTML the site renders (plain text: htmlToText() in scripts/quranpedia/lib.mjs). The verifier checks: verse ranges
inside the surah and ascending; every chunk non-empty and Arabic; chunk count, verse ranges and text equal
to the full-book export where one exists; and, for the first, middle and last ayah of every surah/book, the
chunks equal what the live per-ayah API returns.

## Project layout

```
data/kfgqpc/        raw KFGQPC source files (+ their read.me notes)
data/reflections/   curated "علمتني آية" reflections (source of truth)
scripts/            build-data.mjs, build-reflections.mjs, verify-data.mjs, chapter-meta.mjs
public/data/        generated JSON (chapters, surah/N, tafsir/N, pages, juzs, search-index, reflections)
public/fonts/       KFGQPC fonts
src/lib/            types, fetch layer, formatting, i18n, Arabic normalisation, URL resolution
src/hooks/          settings, user data (bookmarks/highlights), async loader, toast
src/components/     Navbar, SettingsDrawer, ChapterHeader, QuranReader, VerseItem, VerseText (words + popover), ReadingView, TafsirBox
src/pages/          Home, Chapter, Juz, Page, Search, NotFound
```
