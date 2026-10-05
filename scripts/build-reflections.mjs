// Builds public/data/reflections.json from the curated source data/reflections/allamatni-aya.json
// (105 reflections from the book "علمتني آية" by Mulhim Dubani, 2015).
// Every entry is resolved to a surah number and verified: each quoted fragment must occur in the
// KFGQPC imlaei text of the referenced verse(s). The build fails loudly on any mismatch so the
// feature can never point at the wrong ayah.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data', 'reflections', 'allamatni-aya.json');
const OUT = path.join(ROOT, 'public', 'data', 'reflections.json');

const source = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const chapters = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'chapters.json'), 'utf8'));
const surahCache = new Map();
const loadSurah = (n) => {
  if (!surahCache.has(n)) surahCache.set(n, JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'surah', `${n}.json`), 'utf8')));
  return surahCache.get(n);
};

const normalize = (s) => s
  .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
  .replace(/[آأإٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/[^؀-ۿ\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const surahByName = new Map(chapters.map((c) => [normalize(c.nameAr), c]));
const resolveSurah = (name) => {
  const c = surahByName.get(normalize(name));
  if (!c) throw new Error(`Unknown surah name: ${name}`);
  return c;
};

const parseRange = (ref) => {
  const m = String(ref).match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) throw new Error(`Bad ref: ${ref}`);
  return [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])];
};

const errors = [];
const verifyQuote = (chapter, from, to, quote, label) => {
  const data = loadSurah(chapter.id);
  const verses = data.verses.filter((v) => v.n >= from && v.n <= to);
  if (verses.length !== to - from + 1) { errors.push(`${label}: verse range ${from}-${to} out of bounds for ${chapter.nameAr}`); return null; }
  // KFGQPC imlaei text joins the vocative "يا" to the next word and spells ta marbuta
  // where the Mushaf uses an open ta (رحمت), so compare with spaces removed and final ت ≈ ه.
  const loose = (s) => normalize(s).replace(/ت(?=\s|$)/g, 'ه').replace(/\s+/g, '');
  const joined = loose(verses.map((v) => v.e).join(' '));
  const parts = quote.split(/\s*(?:\*|\.{2,}|…)\s*/).map(loose).filter(Boolean);
  for (const p of parts) {
    if (!joined.includes(p)) errors.push(`${label}: fragment not found in ${chapter.nameAr} ${from}-${to}: "${p}"\n    verse: ${joined}`);
  }
  return verses;
};

const out = [];
for (const r of source.reflections) {
  const chapter = resolveSurah(r.surahName);
  const [from, to] = parseRange(r.ref);
  const label = `#${r.id}`;
  const verses = verifyQuote(chapter, from, to, r.quote, label);
  const extra = (r.extraRefs ?? []).map((x) => {
    const c = resolveSurah(x.surahName);
    const [f, t] = parseRange(x.ref);
    verifyQuote(c, f, t, x.quote, `${label} extra`);
    return { surah: c.id, surahName: c.nameAr, ayahFrom: f, ayahTo: t, verseKey: `${c.id}:${f}`, quote: x.quote };
  });
  const verseKeys = [];
  for (let a = from; a <= to; a++) verseKeys.push(`${chapter.id}:${a}`);
  out.push({
    id: r.id,
    surah: chapter.id,
    surahName: chapter.nameAr,
    surahNameEn: chapter.nameEn,
    slug: chapter.slug,
    ayahFrom: from,
    ayahTo: to,
    verseKey: verseKeys[0],
    verseKeys,
    quote: r.quote,
    text: verses ? verses.map((v) => v.w.join(' ')).join(' ۝ ') : null,
    comment: r.comment,
    ...(extra.length ? { extraRefs: extra } : {}),
    printedRef: r.printedRef,
    ...(r.note ? { note: r.note } : {}),
    page: r.page,
  });
}

if (errors.length) {
  console.error(`${errors.length} verification error(s):\n` + errors.join('\n'));
  process.exit(1);
}
if (out.length !== 105) { console.error(`expected 105 reflections, got ${out.length}`); process.exit(1); }

fs.writeFileSync(OUT, JSON.stringify({ source: source.source, count: out.length, reflections: out }));
const uniqueVerses = new Set(out.flatMap((r) => r.verseKeys)).size;
console.log(`OK: ${out.length} reflections verified against KFGQPC text (${uniqueVerses} distinct verses) -> ${OUT}`);
