import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { QuranReader } from '../components/QuranReader';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getChapter, getChapters } from '../lib/api';
import { num } from '../lib/format';
import { parseVerseRef, resolveChapter } from '../lib/text';
import { NotFoundPage } from './NotFoundPage';

/**
 * Handles quran.com-compatible URLs:
 *   /al-baqarah?startingVerse=14   /2?startingVerse=14   /2/14   /2:14
 *   /ar/al-baqarah?startingVerse=14  (locale prefix is accepted and ignored)
 */
export function ChapterPage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const { settings, update, t } = useSettings();
  const lang = settings.lang;

  const segs = [params.a, params.b, params.c].filter((x): x is string => !!x);
  // quran.com links may carry a locale prefix; the site is Arabic-only, so it is just dropped
  if (segs[0] === 'ar' || segs[0] === 'en') segs.shift();

  const viewParam = search.get('view');
  useEffect(() => {
    if ((viewParam === 'reading' || viewParam === 'verse') && viewParam !== settings.view) update({ view: viewParam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam]);

  const { data: chapters, loading: l1, error: e1 } = useAsync(() => getChapters(), []);

  const resolved = useMemo(() => {
    if (!chapters) return null;
    const first = segs[0] ?? '';
    if (first.includes(':')) return parseVerseRef(chapters, first) ?? null;
    const chapter = resolveChapter(chapters, first);
    if (!chapter) return null;
    const fromPath = segs[1] ? Number(segs[1]) : NaN;
    const fromQuery = Number(search.get('startingVerse'));
    const verse = Number.isInteger(fromPath) && fromPath >= 1 ? fromPath : fromQuery >= 1 ? fromQuery : undefined;
    return { chapter, verse: verse && verse <= chapter.versesCount ? verse : undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, segs.join('/'), search.get('startingVerse')]);

  const chapterId = resolved?.chapter.id;
  const { data, loading: l2, error: e2 } = useAsync(() => (chapterId ? getChapter(chapterId) : undefined), [chapterId]);

  useEffect(() => {
    if (resolved) document.title = `${resolved.chapter.nameAr} - ${t('appTitle')}`;
  }, [resolved, t]);

  if (l1 || (chapterId && l2)) return <Loading />;
  if (e1 || e2) return <ErrorBox error={e1 ?? e2} />;
  if (!chapters || !resolved) return <NotFoundPage />;
  if (!data) return <Loading />;

  const { chapter } = resolved;
  const prev = chapter.id > 1 ? chapters[chapter.id - 2] : null;
  const next = chapter.id < 114 ? chapters[chapter.id] : null;
  const initialKey = resolved.verse ? `${chapter.id}:${resolved.verse}` : null;

  return (
    <main className="page">
      <div className="jump-row" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <label className="jump">
          <span className="muted">{t('goToVerse')}</span>
          <select value={resolved.verse ?? ''} onChange={(e) => setSearch(e.target.value ? { startingVerse: e.target.value } : {})}>
            <option value="">—</option>
            {data.verses.map((v) => <option key={v.n} value={v.n}>{num(v.n, lang)}</option>)}
          </select>
        </label>
        <span className="muted">{t('page')} {num(chapter.pages[0], lang)}–{num(chapter.pages[1], lang)} · {t('juz')} {num(chapter.juz[0], lang)}{chapter.juz[1] !== chapter.juz[0] ? `–${num(chapter.juz[1], lang)}` : ''}</span>
      </div>

      <QuranReader segments={[{ chapter: data, verses: data.verses }]} initialVerseKey={initialKey} />

      <nav className="chapter-nav" aria-label="chapter navigation">
        {prev ? <Link className="btn" to={`/${prev.slug}`}>{t('prevSurah')}: {lang === 'ar' ? prev.nameAr : prev.nameEn}</Link> : <span />}
        <button className="btn btn--ghost" onClick={() => { setSearch({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('beginningOfSurah')}</button>
        {next ? <Link className="btn" to={`/${next.slug}`}>{t('nextSurah')}: {lang === 'ar' ? next.nameAr : next.nameEn}</Link> : <span />}
      </nav>
    </main>
  );
}
