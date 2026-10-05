import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { getChapters } from '../lib/api';
import { chapterPath, num } from '../lib/format';
import { matchChapters } from '../lib/text';
import { BookmarkIcon } from '../components/Icons';

export function HomePage() {
  const { settings, t } = useSettings();
  const { bookmarks, lastRead } = useUserData();
  const { data: chapters, loading, error } = useAsync(() => getChapters(), []);
  const [tab, setTab] = useState<'surah' | 'juz'>('surah');
  const [filter, setFilter] = useState('');
  const [desc, setDesc] = useState(false);
  const lang = settings.lang;

  const list = useMemo(() => {
    if (!chapters) return [];
    const base = filter.trim() ? matchChapters(chapters, filter) : chapters;
    return desc ? [...base].reverse() : base;
  }, [chapters, filter, desc]);

  if (loading) return <Loading />;
  if (error || !chapters) return <ErrorBox error={error} />;

  const bookmarkList = [...bookmarks].map((k) => {
    const [s, v] = k.split(':').map(Number);
    return { chapter: chapters[s - 1], verse: v };
  }).filter((b) => b.chapter);

  return (
    <main className="home">
      <section className="hero">
        <h1 className="hero__title" dir="rtl">ٱلۡقُرۡءَانُ ٱلۡكَرِيمُ</h1>
        <p className="hero__sub">{t('appSubtitle')}</p>
        <input
          className="hero__search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
        />
        {filter.trim() && (
          <Link className="hero__full-search" to={`/search?q=${encodeURIComponent(filter.trim())}`}>{t('search')}: «{filter.trim()}» →</Link>
        )}
      </section>

      {(lastRead || bookmarkList.length > 0) && (
        <section className="quick">
          {lastRead && chapters[lastRead.chapter - 1] && (
            <Link className="quick__card" to={chapterPath(chapters[lastRead.chapter - 1], lastRead.verse)}>
              <span className="muted">{t('lastRead')}</span>
              <strong dir="rtl">{chapters[lastRead.chapter - 1].nameAr} · {t('ayah')} {num(lastRead.verse, lang)}</strong>
            </Link>
          )}
          {bookmarkList.length > 0 && (
            <div className="quick__card quick__card--list">
              <span className="muted"><BookmarkIcon filled /> {t('bookmarks')}</span>
              <div className="quick__chips">
                {bookmarkList.map(({ chapter, verse }) => (
                  <Link key={`${chapter.id}:${verse}`} className="chip" to={chapterPath(chapter, verse)} dir="rtl">
                    {chapter.nameAr} {num(verse, lang)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="tabs">
        <div className="seg">
          <button className={tab === 'surah' ? 'is-active' : ''} onClick={() => setTab('surah')}>{t('surahs')}</button>
          <button className={tab === 'juz' ? 'is-active' : ''} onClick={() => setTab('juz')}>{t('juzs')}</button>
        </div>
        {tab === 'surah' && (
          <button className="btn btn--ghost" onClick={() => setDesc((d) => !d)}>{desc ? t('sortDesc') : t('sortAsc')}</button>
        )}
      </div>

      {tab === 'surah' ? (
        <div className="surah-grid">
          {list.map((c) => (
            <Link key={c.id} to={`/${c.slug}`} className="surah-card">
              <span className="surah-card__num"><span>{num(c.id, lang)}</span></span>
              <span className="surah-card__names">
                <span className="surah-card__en">{lang === 'ar' ? c.nameAr : c.nameEn}</span>
                <span className="surah-card__meaning muted">{lang === 'ar' ? c.nameEn : c.meaningEn}</span>
              </span>
              <span className="surah-card__side">
                <span className="surah-card__ar quran-text" dir="rtl">{c.nameAr}</span>
                <span className="muted">{num(c.versesCount, lang)} {t('verses')}</span>
              </span>
            </Link>
          ))}
          {!list.length && <p className="muted">{t('noResults')}</p>}
        </div>
      ) : (
        <div className="juz-grid">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => {
            const inJuz = chapters.filter((c) => c.juz[0] <= j && c.juz[1] >= j);
            return (
              <div key={j} className="juz-card">
                <Link to={`/juz/${j}`} className="juz-card__title">{t('juz')} {num(j, lang)}</Link>
                <div className="juz-card__chapters">
                  {inJuz.map((c) => (
                    <Link key={c.id} to={`/${c.slug}`} className="juz-card__row">
                      <span>{num(c.id, lang)}. {lang === 'ar' ? c.nameAr : c.nameEn}</span>
                      <span className="quran-text" dir="rtl">{c.nameAr}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="site-footer">
        <p>{t('sourceNote')}</p>
        <p><a href="https://qurancomplex.gov.sa/quran-dev/" target="_blank" rel="noreferrer">qurancomplex.gov.sa/quran-dev</a></p>
      </footer>
    </main>
  );
}
