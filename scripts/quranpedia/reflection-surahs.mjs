// Lists the surahs that contain at least one "علمتني آية" reflection verse (public/data/reflections.json),
// ordered from the shortest surah to the longest, and writes data/tafsir/quranpedia/skipped-surahs.json
// for the surahs that have none (to be fetched after the hackathon).
// Usage: node scripts/quranpedia/reflection-surahs.mjs            -> prints "103,94,98,..." for --surahs
import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, ROOT } from './lib.mjs';

const reflections = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'reflections.json'), 'utf8'));
const chapters = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'chapters.json'), 'utf8'));

const withReflection = new Map(); // surah -> reflection ids
for (const r of reflections.reflections) {
  const add = (s) => withReflection.set(s, [...(withReflection.get(s) ?? []), r.id]);
  add(r.surah);
  for (const e of r.extraRefs ?? []) add(e.surah);
}
const ordered = [...withReflection.keys()].sort((a, b) => chapters[a - 1].versesCount - chapters[b - 1].versesCount || a - b);
const skipped = chapters.filter((c) => !withReflection.has(c.id)).map((c) => ({
  surah: c.id, nameAr: c.nameAr, nameEn: c.nameEn, versesCount: c.versesCount,
  reason: 'no verse from the book "علمتني آية" in this surah; deferred until after the hackathon',
  ...(c.id === 1 ? { note: 'already fetched and verified as the pilot surah' } : {}),
}));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'skipped-surahs.json'), JSON.stringify({
  rule: 'Only surahs containing at least one reflection verse from "علمتني آية" are fetched now (smallest first).',
  fetchedSurahsInOrder: ordered.map((s) => ({ surah: s, nameAr: chapters[s - 1].nameAr, versesCount: chapters[s - 1].versesCount, reflectionIds: withReflection.get(s) })),
  skippedCount: skipped.length,
  skipped,
}, null, 1));
console.error(`${ordered.length} surahs with reflections, ${skipped.length} skipped -> skipped-surahs.json`);
console.log(ordered.join(','));
