// Independent integrity check of the generated data against the canonical Hafs structure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSE_COUNTS } from './chapter-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
const chapters = JSON.parse(fs.readFileSync(path.join(OUT, 'chapters.json'), 'utf8'));
let total = 0, words = 0, errors = 0;
const err = (m) => { errors++; console.error('FAIL', m); };
if (chapters.length !== 114) err('chapters != 114');
for (const c of chapters) {
  const d = JSON.parse(fs.readFileSync(path.join(OUT, 'surah', `${c.id}.json`), 'utf8'));
  if (d.verses.length !== VERSE_COUNTS[c.id - 1]) err(`surah ${c.id} verse count`);
  d.verses.forEach((v, i) => {
    if (v.n !== i + 1) err(`surah ${c.id} numbering`);
    if (!v.w.length) err(`surah ${c.id}:${v.n} has no words`);
    if (v.w.some((w) => /\s|۝|۞/.test(w))) err(`surah ${c.id}:${v.n} bad word token`);
    words += v.w.length;
  });
  total += d.verses.length;
  const t = JSON.parse(fs.readFileSync(path.join(OUT, 'tafsir', `${c.id}.json`), 'utf8'));
  if (Object.keys(t.tafsir).length !== d.verses.length) err(`surah ${c.id} tafsir count`);
}
if (total !== 6236) err(`total verses ${total}`);
const pages = JSON.parse(fs.readFileSync(path.join(OUT, 'pages.json'), 'utf8'));
if (Object.keys(pages).length !== 604) err('pages != 604');
console.log(errors ? `${errors} error(s)` : `VERIFIED: 114 surahs, ${total} verses, ${words} words, 604 pages`);
process.exit(errors ? 1 : 0);
