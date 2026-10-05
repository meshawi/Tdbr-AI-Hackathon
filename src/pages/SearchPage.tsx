import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getChapters, getSearchIndex } from '../lib/api';
import { chapterPath, num } from '../lib/format';
import { matchChapters, normalizeArabic, parseVerseRef } from '../lib/text';

const MAX_RESULTS = 200;

/** Client-side search over the KFGQPC imlaei text (diacritic-insensitive). */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { settings, t } = useSettings();
  const lang = settings.lang;
  const { data, loading, error } = useAsync(() => Promise.all([getChapters(), getSearchIndex()]), []);

  useEffect(() => { document.title = `${t('search')}: ${q} - ${t('appTitle')}`; }, [q, t]);

  const results = useMemo(() => {
    if (!data || !q) return null;
    const [chapters, index] = data;
    const ref = parseVerseRef(chapters, q);
    const chapterHits = matchChapters(chapters, q);
    const nq = normalizeArabic(q);
    const verseHits: { s: number; a: number; text: string }[] = [];
    if (nq.length >= 2) {
      for (const [s, a, text] of index) {
        if (normalizeArabic(text).includes(nq)) {
          verseHits.push({ s, a, text });
          if (verseHits.length >= MAX_RESULTS) break;
        }
      }
    }
    return { ref, chapterHits, verseHits, chapters, nq };
  }, [data, q]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <main className="page search">
      <h1 className="page-title">{t('search')}: «{q}»</h1>
      <p className="muted">{t('searchHint')}</p>

      {results?.ref && (
        <Link className="result result--ref" to={chapterPath(results.ref.chapter, results.ref.verse)}>
          <strong dir="rtl">{results.ref.chapter.nameAr}</strong> {results.ref.chapter.nameEn}
          {results.ref.verse ? ` · ${t('ayah')} ${num(results.ref.verse, lang)}` : ''}
        </Link>
      )}

      {!!results?.chapterHits.length && (
        <section>
          <h2>{t('surahs')}</h2>
          <div className="chips">
            {results.chapterHits.map((c) => (
              <Link key={c.id} className="chip" to={`/${c.slug}`}>{num(c.id, lang)}. {lang === 'ar' ? c.nameAr : c.nameEn}</Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>{t('results')} {results ? `(${num(results.verseHits.length, lang)}${results.verseHits.length >= MAX_RESULTS ? '+' : ''})` : ''}</h2>
        {results && !results.verseHits.length && !results.chapterHits.length && !results.ref && <p className="muted">{t('noResults')}</p>}
        {results?.verseHits.map(({ s, a, text }) => {
          const c = results.chapters[s - 1];
          return (
            <Link key={`${s}:${a}`} className="result" to={chapterPath(c, a)}>
              <span className="result__key">{lang === 'ar' ? c.nameAr : c.nameEn} {num(s, lang)}:{num(a, lang)}</span>
              <span className="result__text" dir="rtl" lang="ar"><Highlight text={text} needle={results.nq} /></span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  // Match on normalised text, but display the original: map through word boundaries.
  const words = text.split(' ');
  const nWords = words.map(normalizeArabic);
  const needleWords = needle.split(' ');
  const marks = new Set<number>();
  for (let i = 0; i < nWords.length; i++) {
    if (needleWords.length === 1) {
      if (nWords[i].includes(needle)) marks.add(i);
    } else {
      let ok = true;
      for (let k = 0; k < needleWords.length; k++) {
        const w = nWords[i + k];
        if (w === undefined) { ok = false; break; }
        const nw = needleWords[k];
        const match = k === 0 ? w.endsWith(nw) : k === needleWords.length - 1 ? w.startsWith(nw) : w === nw;
        if (!match) { ok = false; break; }
      }
      if (ok) for (let k = 0; k < needleWords.length; k++) marks.add(i + k);
    }
  }
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>{marks.has(i) ? <mark>{w}</mark> : w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </>
  );
}
