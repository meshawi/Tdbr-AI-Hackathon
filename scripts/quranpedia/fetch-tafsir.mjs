// Builds data/tafsir/quranpedia: every Arabic book listed on https://quranpedia.net/surah-tafsir/{surah},
// with its complete content for the requested surahs, grouped by verse.
//
// Sources (all public, no auth):
//   embed   https://api.quranpedia.net/embed?surah=S&ayah=A-B&type=T&book=ID&fragment=1&lock=1  (20-ayah windows)
//           This is the renderer behind the site's ayah modal and the /v1/ayah/{s}/{a}/book/{id} endpoint: it
//           returns every chunk for every ayah. Used for books whose service is tafsir / e3rab / asbab.
//   site    https://quranpedia.net/surah/1/S/book/ID — the full-surah page. Verified to omit chunks for some
//           books, so it is only a fallback (merged with the export) for the few books the embed cannot render.
//   export  https://api.quranpedia.net/books-contents/book-ID.json — full-book dump; verified to omit chunks
//           that have no page number, so again only used in the fallback merge.
//
// Output:
//   books.json, skipped-books.json, surah/{s}/index.json, surah/{s}/book-{id}.json
// Usage: node scripts/quranpedia/fetch-tafsir.mjs --surahs 1-5
import fs from 'node:fs';
import path from 'node:path';
import { API, DUMPS, OUT_DIR, ROOT, SITE, arabicRatio, exportChunks, fetchJson, fetchText, htmlToText, normKey, parseBookPage, parseEmbedFragment, versesCount } from './lib.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const surahs = parseSurahs(arg('--surahs', '1-5'));
function parseSurahs(spec) { // "1-5" or "103,94,98" or a mix "1-5,103"
  return spec.split(',').flatMap((part) => { const [a, b] = part.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
}
const chapters = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'chapters.json'), 'utf8'));
const EMBED_TYPES = new Set(['tafsir', 'e3rab', 'asbab']);
const WINDOW = 20;

fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- 1. book lists per surah, straight from the website pages ----------
const listed = new Map();
for (const s of surahs) {
  const html = await fetchText(`${SITE}/surah-tafsir/${s}`, { cacheKey: `site/surah-tafsir-${s}.html` });
  const re = new RegExp(`<a\\b([^>]*href="${SITE}/surah/1/${s}/book/(\\d+)"[^>]*)>([\\s\\S]*?)</a>`, 'g');
  let m, count = 0;
  while ((m = re.exec(html))) {
    const id = Number(m[2]);
    const label = htmlToText(m[3]).replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim();
    if (!listed.has(id)) listed.set(id, { id, siteLabel: label, surahs: [] });
    listed.get(id).surahs.push(s);
    count++;
  }
  console.log(`surah ${s}: ${count} books listed on the website`);
}

// ---------- 2. metadata + language decision ----------
const books = [];
for (const entry of [...listed.values()].sort((a, b) => a.id - b.id)) {
  const meta = await fetchJson(`${API}/book/${entry.id}`, { cacheKey: `api/book-${entry.id}.json` });
  const lang = meta?.language?.code ?? null;
  const type = meta?.type ?? null;
  const service = meta?.relative_ayah_service ?? type;
  let include = false, reason = '', languageSource = 'api';
  if (lang === 'ar') include = true;
  else if (lang) reason = `language is ${meta.language.name} (${lang})`;
  else if (type === 'translations') reason = 'translation (no language in API)';
  else { include = true; languageSource = 'inferred'; }
  books.push({
    id: entry.id,
    name: meta?.name?.trim() ?? entry.siteLabel,
    shortName: meta?.short_name?.trim() || null,
    author: meta?.author?.ar_name?.trim() ?? null,
    authorFullName: meta?.author?.full_name?.trim() ?? null,
    type, service,
    category: meta?.category?.name ?? null,
    language: lang, languageName: meta?.language?.name ?? null, languageSource,
    parts: meta?.parts ?? null,
    publisher: meta?.nasher?.trim() || null,
    hasFullBookExport: !!meta?.contents_url,
    contentSource: EMBED_TYPES.has(service) ? 'embed' : 'site+export',
    siteLabel: entry.siteLabel,
    listedForSurahs: entry.surahs,
    included: include,
    skipReason: include ? null : reason,
    note: include && languageSource === 'inferred' ? 'API has no language field; title and content are Arabic (checked by Arabic-letter ratio)' : null,
    sourceUrls: { api: `${API}/book/${entry.id}`, site: entry.surahs.map((s) => `${SITE}/surah/1/${s}/book/${entry.id}`) },
  });
}

// ---------- helpers ----------
function finalize(chunkMap, s) {
  // chunkMap: key -> { html, bookPage, ayahs:Set } in first-seen order
  const chunks = [...chunkMap.values()].map((c) => {
    const ayahs = [...c.ayahs].sort((a, b) => a - b);
    return { ayahFrom: ayahs[0], ayahTo: ayahs[ayahs.length - 1], ayahs, verseKeys: ayahs.map((a) => `${s}:${a}`), bookPage: c.bookPage, html: c.html };
  });
  chunks.sort((a, b) => a.ayahFrom - b.ayahFrom || (a.bookPage ?? 0) - (b.bookPage ?? 0));
  return chunks;
}

async function viaEmbed(s, book) {
  const n = versesCount(s);
  const map = new Map();
  const addBlock = (ayah, html, bookPage) => {
    const key = `${normKey(html)}|${bookPage ?? ''}`;
    if (!normKey(html)) return;
    if (!map.has(key)) map.set(key, { html, bookPage, ayahs: new Set() });
    map.get(key).ayahs.add(ayah);
  };
  let requests = 0, apiFallbacks = 0;
  // The per-ayah JSON endpoint is the authority for ayahs the window view cannot show.
  const viaApi = async (ayah) => {
    const res = await fetchJson(`${API}/ayah/${s}/${ayah}/book/${book.id}`, { cacheKey: `api/ayah-${s}-${ayah}-book-${book.id}.json` });
    requests++; apiFallbacks++;
    for (const c of res?.content ?? []) addBlock(ayah, c.text.split(String.fromCharCode(13)).join(''), c.page ?? null);
    return res?.content?.length ?? 0;
  };
  let a = 1;
  while (a <= n) {
    const b = Math.min(a + WINDOW - 1, n);
    const reqA = b === a && a > 1 ? a - 1 : a; // never request a 1-ayah window (it has no headers); the overlap is harmless
    const url = `${API.replace('/v1', '')}/embed?surah=${s}&ayah=${reqA}-${b}&type=${book.service}&book=${book.id}&fragment=1&lock=1&fonts=0`;
    const html = await fetchText(url, { cacheKey: `embed/surah-${s}-book-${book.id}-${reqA}-${b}.html` });
    requests++;
    if (!html) throw new Error(`embed 404: ${url}`);
    const expected = Array.from({ length: b - reqA + 1 }, (_, i) => reqA + i);
    const r = parseEmbedFragment(html, s, expected);
    if (r.noHeaders) {
      // The window view has no headers only when its first ayah has no content in this book
      // (verified against the JSON endpoint), so that ayah is skipped and the window restarts after it.
      if (reqA < a) {
        // overlap case: the empty ayah is reqA (already handled); fetch the real last ayah on its own
        const one = await fetchText(`${API.replace('/v1', '')}/embed?surah=${s}&ayah=${a}&type=${book.service}&book=${book.id}&fragment=1&lock=1&fonts=0`, { cacheKey: `embed/surah-${s}-book-${book.id}-${a}-${a}.html` });
        requests++;
        if (one) for (const [ayah, blocks] of parseEmbedFragment(one, s, [a]).perAyah) for (const bl of blocks) addBlock(ayah, bl.html, bl.bookPage);
        a = b + 1;
      } else a++;
      continue;
    }
    for (const [ayah, blocks] of r.perAyah) if (ayah >= a) for (const bl of blocks) addBlock(ayah, bl.html, bl.bookPage);
    for (const ayah of r.missing) if (ayah >= a) await viaApi(ayah);
    a = b + 1;
  }
  return { chunks: finalize(map, s), requests, apiFallbacks };
}

async function viaSiteAndExport(s, book) {
  const map = new Map();
  const add = (c, origin) => {
    const key = normKey(c.html);
    if (!key) return;
    if (!map.has(key)) map.set(key, { html: c.html, bookPage: c.bookPage, ayahs: new Set(), origin });
    const e = map.get(key);
    for (let a = c.ayahFrom; a <= c.ayahTo; a++) e.ayahs.add(a);
    if (e.bookPage == null && c.bookPage != null) e.bookPage = c.bookPage;
  };
  const html = await fetchText(`${SITE}/surah/1/${s}/book/${book.id}`, { cacheKey: `site/surah-${s}-book-${book.id}.html` });
  let siteCount = 0, exportCount = 0;
  if (html) for (const art of parseBookPage(html, s).articles) for (const bl of art.blocks) { add({ ayahFrom: Math.min(...art.ayahs), ayahTo: Math.max(...art.ayahs), bookPage: bl.bookPage, html: bl.html }, 'site'); siteCount++; }
  if (book.hasFullBookExport) {
    const dump = await fetchJson(`${DUMPS}/book-${book.id}.json`, { cacheKey: `dumps/book-${book.id}.json` });
    if (dump) for (const c of exportChunks(dump, s)) { add(c, 'export'); exportCount++; }
  }
  return { chunks: finalize(map, s), siteChunks: siteCount, exportChunks: exportCount, merged: map.size };
}

// ---------- 3. content ----------
const summary = [];
let embedRequests = 0;
for (const s of surahs) {
  const dir = path.join(OUT_DIR, 'surah', String(s));
  fs.mkdirSync(dir, { recursive: true });
  const chapter = chapters[s - 1];
  const index = { surah: s, surahName: chapter.nameAr, surahNameEn: chapter.nameEn, versesCount: versesCount(s), source: `${SITE}/surah-tafsir/${s}`, fetchedAt: new Date().toISOString(), books: [] };
  for (const book of books) {
    if (!book.included || !book.listedForSurahs.includes(s)) continue;
    let chunks, detail = {};
    try {
      if (book.contentSource === 'embed') { const r = await viaEmbed(s, book); chunks = r.chunks; embedRequests += r.requests; detail = { embedRequests: r.requests, perAyahApiFallbacks: r.apiFallbacks }; }
      else { const r = await viaSiteAndExport(s, book); chunks = r.chunks; detail = { siteChunks: r.siteChunks, exportChunks: r.exportChunks, mergedChunks: r.merged }; }
    } catch (e) {
      console.error(`  !! surah ${s} book ${book.id}: ${e.message}`);
      index.books.push({ id: book.id, name: book.name, author: book.author, status: 'error', error: e.message });
      continue;
    }
    const plain = chunks.map((c) => htmlToText(c.html));
    const allText = plain.join('\n');
    const ratio = arabicRatio(allText);
    if (book.languageSource === 'inferred' && chunks.length && ratio < 0.8) {
      console.warn(`  !! book ${book.id} inferred Arabic but ratio ${ratio.toFixed(2)}; skipping`);
      book.included = false; book.skipReason = `content is not Arabic (Arabic-letter ratio ${ratio.toFixed(2)})`; continue;
    }
    const covered = new Set(chunks.flatMap((c) => c.ayahs));
    const uncovered = Array.from({ length: versesCount(s) }, (_, i) => i + 1).filter((a) => !covered.has(a));
    const file = {
      surah: s, surahName: chapter.nameAr,
      book: { id: book.id, name: book.name, shortName: book.shortName, author: book.author, type: book.type, service: book.service, category: book.category, language: book.language ?? 'ar', languageSource: book.languageSource, parts: book.parts },
      contentSource: book.contentSource,
      sourceUrls: book.contentSource === 'embed'
        ? { embed: `${API.replace('/v1', '')}/embed?surah=${s}&ayah={from}-{to}&type=${book.service}&book=${book.id}&fragment=1&lock=1`, site: `${SITE}/surah/1/${s}/book/${book.id}` }
        : { site: `${SITE}/surah/1/${s}/book/${book.id}`, export: book.hasFullBookExport ? `${DUMPS}/book-${book.id}.json` : null },
      fetchedAt: new Date().toISOString(),
      stats: { chunks: chunks.length, characters: allText.length, arabicLetterRatio: Number(ratio.toFixed(3)), coveredAyahs: covered.size, uncoveredAyahs: uncovered, ...detail },
      chunks,
    };
    fs.writeFileSync(path.join(dir, `book-${book.id}.json`), JSON.stringify(file));
    index.books.push({ id: book.id, name: book.name, author: book.author, type: book.type, service: book.service, category: book.category, contentSource: book.contentSource, file: `book-${book.id}.json`, chunks: chunks.length, characters: allText.length, coveredAyahs: covered.size, uncoveredAyahs: uncovered.length });
    console.log(`  surah ${s} book ${book.id} ${book.name} [${book.contentSource}]: ${chunks.length} chunks, ${allText.length} chars, uncovered ${uncovered.length}`);
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
  summary.push({ surah: s, books: index.books.length, chunks: index.books.reduce((n, b) => n + (b.chunks ?? 0), 0), characters: index.books.reduce((n, b) => n + (b.characters ?? 0), 0) });
}

fs.writeFileSync(path.join(OUT_DIR, 'books.json'), JSON.stringify({ source: `${SITE}/surah-tafsir/{surah}`, api: `${API}/book/{id}`, surahs, fetchedAt: new Date().toISOString(), total: books.length, included: books.filter((b) => b.included).length, skipped: books.filter((b) => !b.included).length, books }, null, 1));
fs.writeFileSync(path.join(OUT_DIR, 'skipped-books.json'), JSON.stringify({ reasonForSkipping: 'Only Arabic-language books are kept; translations into other languages and books written in other languages are excluded.', count: books.filter((b) => !b.included).length, books: books.filter((b) => !b.included).map((b) => ({ id: b.id, name: b.name, author: b.author, language: b.languageName, languageCode: b.language, type: b.type, reason: b.skipReason, listedForSurahs: b.listedForSurahs })) }, null, 1));
console.table(summary);
console.log(`books: ${books.length} listed, ${books.filter((b) => b.included).length} included, ${books.filter((b) => !b.included).length} skipped; embed requests: ${embedRequests}`);
