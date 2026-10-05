// Converts the official KFGQPC (King Fahd Glorious Qur'an Printing Complex) Hafs data
// in data/kfgqpc/ into static JSON consumed by the React app (public/data/).
// Source: https://qurancomplex.gov.sa/quran-dev/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUGS, MEANINGS, MADANI, VERSE_COUNTS } from './chapter-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data', 'kfgqpc');
const OUT = path.join(ROOT, 'public', 'data');

const AYAH_MARK = '۝'; // ۝ END OF AYAH
const RUB_MARK = '۞';  // ۞ RUB EL HIZB

const v30 = JSON.parse(fs.readFileSync(path.join(SRC, 'kfgqpc_hafs_v30.json'), 'utf8'));
const smart = JSON.parse(fs.readFileSync(path.join(SRC, 'hafs_smart_v8.json'), 'utf8'));
const tafsirLines = fs.readFileSync(path.join(SRC, 'tafseerMouaser_v03.txt'), 'utf8').split(/\r?\n/).filter(Boolean);

const fail = (msg) => { console.error('DATA ERROR: ' + msg); process.exit(1); };
if (v30.length !== 6236) fail(`expected 6236 verses, got ${v30.length}`);

// Display names (without i'rab endings) come from the Hafs Smart file, same publisher.
const displayNameAr = new Map();
for (const r of smart) if (!displayNameAr.has(r.sura_no)) displayNameAr.set(r.sura_no, r.sura_name_ar.trim());

// Tafseer Muyassar (tab separated). Normalise the KFGQPC private-use quote glyphs to
// standard Unicode ornate parentheses so any Arabic font can render them.
const tafsir = new Map();
const header = tafsirLines[0].replace(/^﻿/, '').split('\t');
const ti = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
for (const line of tafsirLines.slice(1)) {
  const c = line.split('\t');
  const s = +c[ti.sura_no], a = +c[ti.aya_no];
  let t = c[ti.aya_tafseer] ?? '';
  t = t.replace(/^\[\d+\]\s*/, '')
       .replace(/<span class='aya'>\s*ﵡ\s*/g, '<span class="aya">﴿')
       .replace(/\s*ﵠ\s*<\/span>/g, '﴾</span>')
       .replace(/ﵡ/g, '﴿').replace(/ﵠ/g, '﴾');
  tafsir.set(`${s}:${a}`, t.trim());
}
if (tafsir.size !== 6236) fail(`tafsir rows ${tafsir.size}`);

const chapters = [];
const bySurah = new Map();
for (const r of v30) {
  if (!bySurah.has(r.sura_no)) bySurah.set(r.sura_no, []);
  bySurah.get(r.sura_no).push(r);
}
if (bySurah.size !== 114) fail('expected 114 surahs');

const pagesIndex = {}; // page -> [{s, from, to}]
const juzIndex = {};   // juz  -> [{s, from, to}]
const searchIndex = [];
let rubCount = 0;

const pushRange = (idx, key, s, a) => {
  const list = (idx[key] ||= []);
  const last = list[list.length - 1];
  if (last && last.s === s && last.to === a - 1) last.to = a; else list.push({ s, from: a, to: a });
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'surah'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'tafsir'), { recursive: true });

for (const [s, rows] of [...bySurah].sort((a, b) => a[0] - b[0])) {
  rows.sort((a, b) => a.aya_no - b.aya_no);
  if (rows.length !== VERSE_COUNTS[s - 1]) fail(`surah ${s}: ${rows.length} verses, expected ${VERSE_COUNTS[s - 1]}`);
  const verses = [];
  const tafsirOut = {};
  rows.forEach((r, i) => {
    if (r.aya_no !== i + 1) fail(`surah ${s}: verse numbering gap at ${r.aya_no}`);
    const tokens = r.aya_text_unicode.trim().split(/\s+/);
    const marker = tokens.pop();
    if (!new RegExp(`^${AYAH_MARK}[\\u0660-\\u0669]+$`).test(marker)) fail(`bad ayah marker at ${s}:${r.aya_no}`);
    let rub = false;
    if (tokens[0] === RUB_MARK) { rub = true; tokens.shift(); rubCount++; }
    const emlaeyWords = r.aya_text_emlaey.trim().split(/\s+/);
    const verse = {
      n: r.aya_no,
      p: r.page,
      j: r.jozz,
      l: [r.line_start, r.line_end],
      w: tokens,
      m: marker,
      e: r.aya_text_emlaey.trim(),
    };
    if (rub) verse.r = true;
    if (emlaeyWords.length === tokens.length) verse.ew = emlaeyWords;
    verses.push(verse);
    tafsirOut[r.aya_no] = tafsir.get(`${s}:${r.aya_no}`);
    pushRange(pagesIndex, r.page, s, r.aya_no);
    pushRange(juzIndex, r.jozz, s, r.aya_no);
    searchIndex.push([s, r.aya_no, r.aya_text_emlaey.trim()]);
  });
  const nameEn = rows[0].sura_name_en.trim();
  const chapter = {
    id: s,
    slug: SLUGS[s - 1],
    nameAr: displayNameAr.get(s),
    nameArFull: rows[0].sura_name_ar.trim(),
    nameEn,
    meaningEn: MEANINGS[s - 1],
    revelation: MADANI.has(s) ? 'madani' : 'makki',
    versesCount: rows.length,
    pages: [rows[0].page, rows[rows.length - 1].page],
    juz: [rows[0].jozz, rows[rows.length - 1].jozz],
    bismillahPre: s !== 1 && s !== 9,
  };
  chapters.push(chapter);
  fs.writeFileSync(path.join(OUT, 'surah', `${s}.json`), JSON.stringify({ ...chapter, verses }));
  fs.writeFileSync(path.join(OUT, 'tafsir', `${s}.json`), JSON.stringify({ id: s, source: 'KFGQPC Tafseer Muyassar v3', tafsir: tafsirOut }));
}

if (Object.keys(pagesIndex).length !== 604) fail('expected 604 pages');
if (Object.keys(juzIndex).length !== 30) fail('expected 30 juz');

fs.writeFileSync(path.join(OUT, 'chapters.json'), JSON.stringify(chapters));
fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pagesIndex));
fs.writeFileSync(path.join(OUT, 'juzs.json'), JSON.stringify(juzIndex));
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(searchIndex));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  source: "King Fahd Glorious Qur'an Printing Complex (KFGQPC): Hafs Uthmanic Unicode v30 (Sept 2026), Hafs Smart v8, Tafseer Muyassar v3",
  sourceUrl: 'https://qurancomplex.gov.sa/quran-dev/',
  verses: 6236, chapters: 114, pages: 604, juz: 30, rubElHizbMarkers: rubCount,
  builtAt: new Date().toISOString(),
}));
console.log(`OK: 114 surahs, 6236 verses, 604 pages, 30 juz, ${rubCount} rub-el-hizb markers -> ${OUT}`);
