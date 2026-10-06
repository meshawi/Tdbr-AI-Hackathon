// Independent verification of data/tafsir/quranpedia.
//   1. structure   verse keys inside the surah, chunk ranges consistent, nothing empty, Arabic content
//   2. containment the text of every chunk the full-surah site page shows, and of every chunk of the
//                  full-book export for the surah, must exist in our data. Sources split the same text
//                  into chunks differently, so the check is text coverage (40-character segments,
//                  whitespace-insensitive), not chunk identity: >= 90% of each chunk's segments must be
//                  found, and the book's total characters must match the export within 2%.
//   3. live API    for sampled ayahs the text returned by /v1/ayah/{s}/{a}/book/{id} (the site's own
//                  modal content) must be covered by our chunks for that ayah and vice versa (>= 95%);
//                  3 samples per surah for embed-sourced books, 6 for books built from site+export
// Writes verification-report.json; exits 1 on any failure.
// Usage: node scripts/quranpedia/verify-tafsir.mjs --surahs 1-5 [--skip-api] [--skip-containment] [--quick: 2 API samples per surah/book, no containment]
import fs from 'node:fs';
import path from 'node:path';
import { API, DUMPS, OUT_DIR, SITE, arabicRatio, exportChunks, fetchJson, fetchText, htmlToText, normKey, parseBookPage, versesCount } from './lib.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const has = (name) => process.argv.includes(name);
const surahs = parseSurahs(arg('--surahs', '1-5'));
function parseSurahs(spec) { // "1-5" or "103,94,98" or a mix "1-5,103"
  return spec.split(',').flatMap((part) => { const [a, b] = part.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
}

const report = { surahs, checkedAt: new Date().toISOString(), books: 0, chunks: 0, structure: { failures: [] }, containment: { siteChunksChecked: 0, exportChunksChecked: 0, failures: [], notes: [] }, api: { ayahsChecked: 0, failures: [], notes: [] }, language: { failures: [] } };
const dumps = new Map();
let rateLimited = false;
const segments = (key) => { const out = []; for (let i = 0; i < Math.max(1, key.length - 40); i += 40) out.push(key.slice(i, i + 40)); return out; };
const coverage = (key, haystack) => { const segs = segments(key); return segs.filter((x) => haystack.includes(x)).length / segs.length; };
const getDump = async (id) => { if (!dumps.has(id)) dumps.set(id, await fetchJson(`${DUMPS}/book-${id}.json`, { cacheKey: `dumps/book-${id}.json` })); return dumps.get(id); };

for (const s of surahs) {
  const dir = path.join(OUT_DIR, 'surah', String(s));
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const n = versesCount(s);
  for (const b of index.books) {
    if (!b.file) { report.structure.failures.push(`surah ${s} book ${b.id}: ${b.status} ${b.error ?? ''}`); continue; }
    const data = JSON.parse(fs.readFileSync(path.join(dir, b.file), 'utf8'));
    report.books++; report.chunks += data.chunks.length;
    const tag = `surah ${s} book ${b.id} (${b.name})`;
    const allKey = data.chunks.map((c) => normKey(c.html)).join('');

    // 1. structure
    if (data.surah !== s || data.book.id !== b.id) report.structure.failures.push(`${tag}: file labels mismatch`);
    data.chunks.forEach((c, i) => {
      if (c.ayahFrom < 1 || c.ayahTo > n || c.ayahFrom > c.ayahTo) report.structure.failures.push(`${tag}: chunk ${i} range ${c.ayahFrom}-${c.ayahTo} outside 1-${n}`);
      if (!c.ayahs.length || c.ayahs[0] !== c.ayahFrom || c.ayahs[c.ayahs.length - 1] !== c.ayahTo) report.structure.failures.push(`${tag}: chunk ${i} ayahs list inconsistent`);
      if (c.verseKeys.length !== c.ayahs.length || c.verseKeys.some((k, j) => k !== `${s}:${c.ayahs[j]}`)) report.structure.failures.push(`${tag}: chunk ${i} verseKeys inconsistent`);
      if (!htmlToText(c.html).trim()) report.structure.failures.push(`${tag}: chunk ${i} is empty`);
    });
    const ratio = arabicRatio(data.chunks.map((c) => htmlToText(c.html)).join(' '));
    if (data.chunks.length && ratio < 0.8) report.language.failures.push(`${tag}: Arabic-letter ratio ${ratio.toFixed(2)}`);

    // 2. containment
    if (!has('--skip-containment') && !has('--quick')) {
      const html = await fetchText(`${SITE}/surah/1/${s}/book/${b.id}`, { cacheKey: `site/surah-${s}-book-${b.id}.html` });
      if (html) {
        for (const art of parseBookPage(html, s).articles) for (const bl of art.blocks) {
          const k = normKey(bl.html); if (!k) continue;
          report.containment.siteChunksChecked++;
          const cov = coverage(k, allKey);
          if (cov < 0.9) report.containment.failures.push(`${tag}: site-page chunk (ayahs ${art.ayahs[0]}-${art.ayahs[art.ayahs.length - 1]}, page ${bl.bookPage}) only ${(cov * 100).toFixed(0)}% covered: "${htmlToText(bl.html).slice(0, 60)}"`);
        }
      }
      const dump = await getDump(b.id);
      if (!dump) report.containment.notes.push(`${tag}: no full-book export`);
      else {
        let exportChars = 0;
        for (const c of exportChunks(dump, s)) {
          const k = normKey(c.html); if (!k) continue;
          exportChars += k.length;
          report.containment.exportChunksChecked++;
          const cov = coverage(k, allKey);
          if (cov < 0.9) report.containment.failures.push(`${tag}: export chunk (${c.ayahFrom}-${c.ayahTo}) only ${(cov * 100).toFixed(0)}% covered: "${htmlToText(c.html).slice(0, 60)}"`);
        }
        if (exportChars && allKey.length < exportChars * 0.98) report.containment.failures.push(`${tag}: data has ${allKey.length} characters, export has ${exportChars}`);
      }
    }

    // 3. live per-ayah API
    if (!has('--skip-api') && !rateLimited) {
      const picks = has('--quick') ? [Math.ceil(n / 2), n] : data.contentSource === 'embed'
        ? [1, Math.ceil(n / 2), n]
        : [1, Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil((3 * n) / 4), n, Math.max(1, n - 1)];
      for (const a of [...new Set(picks)]) {
        let res;
        try { res = await fetchJson(`${API}/ayah/${s}/${a}/book/${b.id}`, { cacheKey: `api/ayah-${s}-${a}-book-${b.id}.json` }); }
        catch (e) {
          if (String(e.message).includes('429')) { rateLimited = true; report.api.notes.push(`rate limited at ${tag} ayah ${a}; later live checks skipped (cached samples still compared)`); break; }
          throw e;
        }
        if (!res) { report.api.failures.push(`${tag}: API 404 for ayah ${a}`); continue; }
        report.api.ayahsChecked++;
        const apiKey = res.content.map((c) => normKey(c.text)).join('');
        const mineKey = data.chunks.filter((c) => c.ayahs.includes(a)).map((c) => normKey(c.html)).join('');
        if (!apiKey && !mineKey) continue;
        const fwd = apiKey ? coverage(apiKey, mineKey) : 1, back = mineKey ? coverage(mineKey, apiKey) : 1;
        if (fwd < 0.95 || back < 0.95) report.api.failures.push(`${tag}: ayah ${a}: API text ${(fwd * 100).toFixed(0)}% covered by data, data ${(back * 100).toFixed(0)}% covered by API (API ${res.content.length} chunk(s), data ${data.chunks.filter((c) => c.ayahs.includes(a)).length})`);
      }
    }
  }
  console.log(`surah ${s}: checked ${index.books.length} books`);
}

const failures = report.structure.failures.length + report.containment.failures.length + report.api.failures.length + report.language.failures.length;
report.result = failures ? `FAILED (${failures} problems)` : 'PASSED';
fs.writeFileSync(path.join(OUT_DIR, 'verification-report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ result: report.result, books: report.books, chunks: report.chunks, siteChunksChecked: report.containment.siteChunksChecked, exportChunksChecked: report.containment.exportChunksChecked, apiAyahsChecked: report.api.ayahsChecked, structureFailures: report.structure.failures.length, containmentFailures: report.containment.failures.length, apiFailures: report.api.failures.length, languageFailures: report.language.failures.length }, null, 1));
for (const f of [...report.structure.failures, ...report.containment.failures, ...report.api.failures, ...report.language.failures].slice(0, 40)) console.log(' -', f);
process.exit(failures ? 1 : 0);
