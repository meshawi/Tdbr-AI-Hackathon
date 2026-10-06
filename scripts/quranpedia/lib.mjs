// Shared helpers for the Quranpedia tafsir pipeline (fetching, caching, HTML parsing, verse maths).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSE_COUNTS } from '../chapter-meta.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = path.join(ROOT, 'data', 'tafsir', 'quranpedia');
export const CACHE_DIR = path.join(ROOT, '.cache', 'quranpedia');
export const SITE = 'https://quranpedia.net';
export const API = 'https://api.quranpedia.net/v1';
export const DUMPS = 'https://api.quranpedia.net/books-contents';
const UA = 'Mozilla/5.0 (compatible; QuranReaderHackathon/1.0; tafsir research)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Simple per-host throttle: website ~1 req/s, API ≤ 100 req/min (limit is 120). */
const lastHit = new Map();
const MIN_GAP = { 'quranpedia.net': 1100, 'api.quranpedia.net': 550 }; // API limit is 120/min
async function throttle(url) {
  const host = new URL(url).host;
  const gap = MIN_GAP[host] ?? 500;
  const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** GET with retries; caches the body on disk under CACHE_DIR when cacheKey is given. */
export async function fetchText(url, { cacheKey, retries = 6 } = {}) {
  const cachePath = cacheKey ? path.join(CACHE_DIR, cacheKey) : null;
  if (cachePath && fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttle(url);
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, signal: AbortSignal.timeout(90000) });
      if (res.status === 429) { lastErr = new Error('429 rate limited'); if (attempt >= 2) throw lastErr; console.warn(`  429 on ${url}; waiting ${60 * (attempt + 1)}s`); await sleep(60000 * (attempt + 1)); continue; }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const body = await res.text(); // the timeout above also bounds the body read
      if (cachePath) { fs.mkdirSync(path.dirname(cachePath), { recursive: true }); fs.writeFileSync(cachePath, body); }
      return body;
    } catch (e) {
      lastErr = e;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts) {
  const body = await fetchText(url, opts);
  return body == null ? null : JSON.parse(body);
}

// ---------- verse maths (Hafs, 6236 verses) ----------
export const OFFSETS = [0];
for (const n of VERSE_COUNTS) OFFSETS.push(OFFSETS[OFFSETS.length - 1] + n);
/** global ayah id (1..6236) -> [surah, ayah] */
export function globalToVerse(g) {
  for (let s = 0; s < 114; s++) if (g <= OFFSETS[s + 1]) return [s + 1, g - OFFSETS[s]];
  return null;
}
export const versesCount = (s) => VERSE_COUNTS[s - 1];

// ---------- text helpers ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
export function htmlToText(html) {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ''),
  ).replace(/​|﻿/g, '').replace(/[ \t\r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Normalised form used for equality checks between sources (website / API / dump). */
export function normForCompare(html) {
  return htmlToText(html).replace(/[﴿﴾]/g, '').replace(/—\s*\d+\s*—/g, '').replace(/\s+/g, ' ').trim();
}
export function arabicRatio(text) {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters.length) return 0;
  const ar = letters.replace(/[^؀-ۿݐ-ݿ]/g, '');
  return ar.length / letters.length;
}
export const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arabicToLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));

/** Returns the inner HTML of the element whose opening tag ends at `openEnd` (balanced on <div>). */
export function balancedInner(html, openEnd) {
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return html.slice(openEnd, m.index); } else depth++;
  }
  return html.slice(openEnd);
}

/** Whitespace-free comparison key: same text regardless of spacing, brackets, page markers, braces. */
export function normKey(html) {
  return htmlToText(html).replace(/[﴿﴾{}\[\]«»"'“”‘’.…:،؛!؟*_-]/g, '').replace(/—\s*\d+\s*—/g, '').replace(/[\s ]+/g, '');
}

/** The export stores `<span class="book-ayah">X</span>`; the site renders it as `<span class="book-ayah">﴿X﴾</span>`. */
export function restoreBrackets(html) {
  return html.replace(/(<span class="book-ayah[^"]*">)\s*(?!﴿)([\s\S]*?)\s*(<\/span>)/g, (m, a, x, b) => (x.trim() ? `${a}﴿${x.trim()}﴾${b}` : m));
}

/** Chunks of one surah from a full-book export (books-contents/book-{id}.json). */
export function exportChunks(dump, surah) {
  return dump.contents
    .filter((c) => (c.related_ayahs ?? '').split(':')[0] === String(surah))
    .map((c) => {
      const [, rng] = c.related_ayahs.split(':');
      const [a, b] = rng.split('-').map(Number);
      return { ayahFrom: a, ayahTo: b ?? a, bookPage: null, html: restoreBrackets(c.text.replace(/\r/g, '')) };
    });
}

// ---------- embed fragment parser (api.quranpedia.net/embed?...&fragment=1) ----------
/**
 * Parses a 20-ayah embed window into { ayah -> [{html, bookPage}] }. Every chunk the site's ayah modal
 * shows for an ayah is present (this is the same renderer as the per-ayah JSON endpoint).
 */
export function parseEmbedFragment(html, surah, expectedAyahs) {
  const secStart = html.indexOf('data-embed-section');
  if (secStart < 0) throw new Error('embed fragment without data-embed-section');
  const body = html.slice(secStart);
  const headRe = /<h3 class="text-sm font-medium[^"]*">\s*([^<]+?)\s*<\/h3>/g;
  const heads = [];
  let m;
  while ((m = headRe.exec(body))) heads.push({ label: m[1], index: m.index, end: m.index + m[0].length });
  const result = new Map();
  // A multi-ayah window whose FIRST ayah has no content in this book comes back as a single "no content"
  // view without headers; the caller then handles that ayah through the per-ayah endpoint and moves on.
  if (!heads.length && expectedAyahs.length > 1) return { perAyah: result, noHeaders: true, missing: expectedAyahs };
  const sections = heads.length ? heads.map((h, i) => ({ label: h.label, html: body.slice(h.end, heads[i + 1]?.index ?? body.length) })) : [{ label: null, html: body }];
  for (const sec of sections) {
    let ayah;
    if (sec.label) {
      const d = sec.label.match(/الآية\s+([٠-٩0-9]+)/);
      if (!d) throw new Error(`cannot read ayah number from "${sec.label}"`);
      ayah = Number(arabicToLatinDigits(d[1]));
      if (!sec.label.includes(`الآية`)) throw new Error(`unexpected header ${sec.label}`);
    } else {
      if (expectedAyahs.length !== 1) throw new Error(`embed window for ${expectedAyahs.length} ayahs has no headers`);
      ayah = expectedAyahs[0];
    }
    const blocks = [];
    const blockRe = /<div class="book [^"]*">/g;
    let bm;
    while ((bm = blockRe.exec(sec.html))) {
      const inner = balancedInner(sec.html, bm.index + bm[0].length);
      const prose = inner.match(/<div class="prose[^"]*">/);
      if (!prose) continue;
      const content = balancedInner(inner, prose.index + prose[0].length);
      const after = inner.slice(prose.index + prose[0].length + content.length);
      const page = after.match(/tracking-wider">\s*—\s*(\d+)\s*—/);
      blocks.push({ html: content.trim(), bookPage: page ? Number(page[1]) : null });
      blockRe.lastIndex = bm.index + bm[0].length + inner.length;
    }
    result.set(ayah, blocks);
  }
  const missing = expectedAyahs.filter((a) => !result.has(a));
  for (const a of result.keys()) if (!expectedAyahs.includes(a)) throw new Error(`embed window returned unexpected ayah ${surah}:${a}`);
  return { perAyah: result, noHeaders: false, missing };
}

// ---------- website page parser ----------
/**
 * Parses a /surah/1/{surah}/book/{book} page into verse-grouped chunks.
 * Each <article class="verse-block"> holds the ayah links of the group and one or more content blocks.
 */
export function parseBookPage(html, surah) {
  const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1]?.trim() ?? '';
  const articles = [];
  const artRe = /<article class="verse-block"/g;
  let m;
  const starts = [];
  while ((m = artRe.exec(html))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const art = html.slice(starts[i], html.indexOf('</article>', starts[i]) + 10);
    const ayahs = [];
    const linkRe = /<a class="ayah[^"]*"\s+ayah="(\d+)"\s+surah="(\d+)"/g;
    let lm;
    while ((lm = linkRe.exec(art))) {
      if (Number(lm[2]) !== surah) throw new Error(`verse link for surah ${lm[2]} inside page of surah ${surah}`);
      ayahs.push(Number(lm[1]));
    }
    const label = (art.match(/font-ibm">\s*([^<]+?)\s*<\/div>/) ?? [])[1]?.trim() ?? '';
    const blocks = [];
    const blockRe = /<div class="content-block[^"]*">/g;
    let bm;
    while ((bm = blockRe.exec(art))) {
      const blockInner = balancedInner(art, bm.index + bm[0].length);
      const proseOpen = blockInner.match(/<div class="prose[^>]*?:style="[^"]*">/);
      if (!proseOpen) throw new Error(`content block without prose div (surah ${surah}, article ${i})`);
      const inner = balancedInner(blockInner, proseOpen.index + proseOpen[0].length);
      const page = blockInner.slice(proseOpen.index + proseOpen[0].length + inner.length).match(/tracking-wider">\s*—\s*(\d+)\s*—/);
      blocks.push({ html: inner.trim(), bookPage: page ? Number(page[1]) : null });
    }
    articles.push({ index: i, label, ayahs, blocks });
  }
  return { title, articles };
}
