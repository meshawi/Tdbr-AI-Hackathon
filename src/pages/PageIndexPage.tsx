import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getChapters } from '../lib/api';
import { num } from '../lib/format';

/** /page: jump to any of the 604 Mushaf pages, or pick a surah's first page. */
export function PageIndexPage() {
  const { settings, t } = useSettings();
  const lang = settings.lang;
  const navigate = useNavigate();
  const [n, setN] = useState('');
  const { data: chapters, loading, error } = useAsync(() => getChapters(), []);
  useEffect(() => { document.title = `${t('pageIndex')} - ${t('appTitle')}`; }, [t]);
  const go = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(n.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (p >= 1 && p <= 604) navigate(`/page/${p}`);
  };
  if (loading) return <Loading />;
  if (error || !chapters) return <ErrorBox error={error} />;
  return (
    <main className="page">
      <h1 className="page-title">{t('pageIndex')}</h1>
      <form className="index-jump" onSubmit={go}>
        <label className="muted" htmlFor="page-n">{t('pickPage')}</label>
        <input id="page-n" type="number" min={1} max={604} value={n} onChange={(e) => setN(e.target.value)} />
        <button className="btn" type="submit">{t('go')}</button>
      </form>
      <h2 className="page-title" style={{ fontSize: '1.05rem' }}>{t('surahPages')}</h2>
      <div className="page-grid">
        {chapters.map((c) => (
          <Link key={c.id} to={`/page/${c.pages[0]}`} className="page-card">
            <span>{num(c.id, lang)}. {c.nameAr}</span>
            <span className="muted">{num(c.pages[0], lang)}{c.pages[1] !== c.pages[0] ? `–${num(c.pages[1], lang)}` : ''}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
