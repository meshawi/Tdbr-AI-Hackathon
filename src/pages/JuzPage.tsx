import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { QuranReader } from '../components/QuranReader';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getJuzIndex, getRanges } from '../lib/api';
import { num } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function JuzPage() {
  const { n } = useParams();
  const juz = Number(n);
  const { settings, t } = useSettings();
  const valid = Number.isInteger(juz) && juz >= 1 && juz <= 30;
  const { data, loading, error } = useAsync(async () => {
    if (!valid) return undefined;
    const idx = await getJuzIndex();
    return getRanges(idx[String(juz)]);
  }, [juz]);

  useEffect(() => { document.title = `${t('juz')} ${num(juz, settings.lang)} - ${t('appTitle')}`; }, [juz, settings.lang, t]);

  if (!valid) return <NotFoundPage />;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <main className="page">
      <h1 className="page-title">{t('juz')} {num(juz, settings.lang)}</h1>
      <QuranReader segments={data} />
      <nav className="chapter-nav">
        {juz > 1 ? <Link className="btn" to={`/juz/${juz - 1}`}>{t('prevJuz')}</Link> : <span />}
        <Link className="btn btn--ghost" to="/">{t('home')}</Link>
        {juz < 30 ? <Link className="btn" to={`/juz/${juz + 1}`}>{t('nextJuz')}</Link> : <span />}
      </nav>
    </main>
  );
}
