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

## Project layout

```
data/kfgqpc/        raw KFGQPC source files (+ their read.me notes)
scripts/            build-data.mjs, verify-data.mjs, chapter-meta.mjs
public/data/        generated JSON (chapters, surah/N, tafsir/N, pages, juzs, search-index)
public/fonts/       KFGQPC fonts
src/lib/            types, fetch layer, formatting, i18n, Arabic normalisation, URL resolution
src/hooks/          settings, user data (bookmarks/highlights), async loader, toast
src/components/     Navbar, SettingsDrawer, ChapterHeader, QuranReader, VerseItem, VerseText (words + popover), ReadingView, TafsirBox
src/pages/          Home, Chapter, Juz, Page, Search, NotFound
```
