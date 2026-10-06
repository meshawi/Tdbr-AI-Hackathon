import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
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
      <div className="jump-row" dir="rtl">
        <h1 className="page-title" style={{ margin: 0 }}>{t('page')} {num(page, settings.lang)}</h1>
        <form className="jump" onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem('p') as HTMLInputElement).value); if (v >= 1 && v <= 604) navigate(`/page/${v}`); }}>
          <span className="muted">{t('pickPage')}</span>
          <input name="p" type="number" min={1} max={604} defaultValue={page} style={{ width: 90 }} />
          <button className="btn btn--small" type="submit">{t('go')}</button>
        </form>
        <Link className="muted" to="/page">{t('pageIndex')}</Link>
      </div>
      <QuranReader segments={data} />
      <nav className="chapter-nav">
        {page > 1 ? <Link className="btn" to={`/page/${page - 1}`}>{t('prevPage')}</Link> : <span />}
        <Link className="btn btn--ghost" to="/">{t('home')}</Link>
        {page < 604 ? <Link className="btn" to={`/page/${page + 1}`}>{t('nextPage')}</Link> : <span />}
      </nav>
    </main>
  );
}
