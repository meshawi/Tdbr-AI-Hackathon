import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { QuranReader } from '../components/QuranReader';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getPagesIndex, getRanges } from '../lib/api';
import { num } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

/** One Madinah Mushaf page (1..604) as indexed by the KFGQPC data. */
export function PagePage() {
  const { n } = useParams();
  const page = Number(n);
  const { settings, t } = useSettings();
  const valid = Number.isInteger(page) && page >= 1 && page <= 604;
  const { data, loading, error } = useAsync(async () => {
    if (!valid) return undefined;
    const idx = await getPagesIndex();
    return getRanges(idx[String(page)]);
  }, [page]);

  useEffect(() => { document.title = `${t('page')} ${num(page, settings.lang)} - ${t('appTitle')}`; }, [page, settings.lang, t]);

  if (!valid) return <NotFoundPage />;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <main className="page">
      <h1 className="page-title">{t('page')} {num(page, settings.lang)}</h1>
      <QuranReader segments={data} />
      <nav className="chapter-nav">
        {page > 1 ? <Link className="btn" to={`/page/${page - 1}`}>{t('prevPage')}</Link> : <span />}
        <Link className="btn btn--ghost" to="/">{t('home')}</Link>
        {page < 604 ? <Link className="btn" to={`/page/${page + 1}`}>{t('nextPage')}</Link> : <span />}
      </nav>
    </main>
  );
}
