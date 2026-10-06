import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getChapters } from '../lib/api';
import { num } from '../lib/format';

/** /juz: the 30 juz with the surahs each one spans. */
export function JuzIndexPage() {
  const { settings, t } = useSettings();
  const lang = settings.lang;
  const { data: chapters, loading, error } = useAsync(() => getChapters(), []);
  useEffect(() => { document.title = `${t('juzIndex')} - ${t('appTitle')}`; }, [t]);
  if (loading) return <Loading />;
  if (error || !chapters) return <ErrorBox error={error} />;
  return (
    <main className="page">
      <h1 className="page-title">{t('juzIndex')}</h1>
      <div className="juz-grid">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => {
          const inJuz = chapters.filter((c) => c.juz[0] <= j && c.juz[1] >= j);
          return (
            <div key={j} className="juz-card">
              <Link to={`/juz/${j}`} className="juz-card__title">{t('juz')} {num(j, lang)}</Link>
              <div className="juz-card__chapters">
                {inJuz.map((c) => (
                  <Link key={c.id} to={`/${c.slug}`} className="juz-card__row">
                    <span>{num(c.id, lang)}. {c.nameAr}</span>
                    <span className="quran-text" dir="rtl">{c.nameAr}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
