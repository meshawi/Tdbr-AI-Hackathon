import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useAsync } from '../hooks/useAsync';
import { getChapters } from '../lib/api';
import { parseVerseRef } from '../lib/text';
import { chapterPath } from '../lib/format';
import { BRAND_NAME, MAIN_SITE } from '../lib/brand';
import { MoonIcon, SearchIcon, SettingsIcon, SunIcon } from './Icons';

export function Navbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings, update, t } = useSettings();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data: chapters } = useAsync(() => getChapters(), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    const ref = chapters && parseVerseRef(chapters, query);
    if (ref) {
      navigate(chapterPath(ref.chapter, ref.verse));
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
    setQ('');
  };

  const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="brand" aria-label={t('home')}>
          <img className="brand__logo" src="/apple-touch-icon.png" alt="" width={40} height={40} />
          <span className="brand__text">
            <span className="brand__title">{BRAND_NAME}</span>
            <span className="brand__sub">{t('appTitle')}</span>
          </span>
        </Link>

        <nav className="navbar__links" aria-label="main">
          <Link to="/">{t('surahs')}</Link>
          <Link to="/juz">{t('juzs')}</Link>
          <Link to="/page">{t('pages')}</Link>
          <Link to="/ai-history">{t('aiHistory')}</Link>
        </nav>

        <form className="navbar__search" onSubmit={submit} role="search">
          <SearchIcon className="navbar__search-icon" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
          />
        </form>

        <div className="navbar__actions">
          <button className="icon-btn" onClick={() => update({ theme: nextTheme })} aria-label={t('theme')} title={t('theme')}>
            {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="icon-btn" onClick={onOpenSettings} aria-label={t('settings')} title={t('settings')}>
            <SettingsIcon />
          </button>
          <a className="navbar__cta" href={MAIN_SITE}>{t('mainSite')}</a>
        </div>
      </div>
    </header>
  );
}
