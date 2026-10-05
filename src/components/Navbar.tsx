import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useAsync } from '../hooks/useAsync';
import { getChapters } from '../lib/api';
import { parseVerseRef } from '../lib/text';
import { chapterPath } from '../lib/format';
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

  const nextTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'sepia' : 'light';

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="brand" aria-label={t('home')}>
          <span className="brand__mark" aria-hidden>۞</span>
          <span className="brand__text">
            <span className="brand__title">{t('appTitle')}</span>
            <span className="brand__sub">{t('appSubtitle')}</span>
          </span>
        </Link>

        <nav className="navbar__links" aria-label="main">
          <Link to="/">{t('surahs')}</Link>
          <Link to="/juz/1">{t('juzs')}</Link>
          <Link to="/page/1">{t('page')}</Link>
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
          <button className="icon-btn" onClick={() => update({ lang: settings.lang === 'ar' ? 'en' : 'ar' })} aria-label={t('language')} title={t('language')}>
            <span className="icon-btn__text">{settings.lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
          <button className="icon-btn" onClick={() => update({ theme: nextTheme })} aria-label={t('theme')} title={t('theme')}>
            {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="icon-btn" onClick={onOpenSettings} aria-label={t('settings')} title={t('settings')}>
            <SettingsIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
