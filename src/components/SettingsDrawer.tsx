import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { CloseIcon } from './Icons';
import type { Theme, ViewMode, Lang } from '../lib/types';

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update, t } = useSettings();
  const { clearHighlights, verseHighlights, wordHighlights } = useUserData();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const themes: Theme[] = ['light', 'dark', 'sepia'];
  const views: ViewMode[] = ['verse', 'reading'];
  const langs: Lang[] = ['ar', 'en'];

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`drawer ${open ? 'is-open' : ''}`} aria-label={t('settings')} aria-hidden={!open}>
        <div className="drawer__head">
          <h2>{t('settings')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}><CloseIcon /></button>
        </div>

        <section className="drawer__section">
          <h3>{t('language')}</h3>
          <div className="seg">
            {langs.map((l) => (
              <button key={l} className={settings.lang === l ? 'is-active' : ''} onClick={() => update({ lang: l })}>
                {l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer__section">
          <h3>{t('theme')}</h3>
          <div className="seg">
            {themes.map((th) => (
              <button key={th} className={settings.theme === th ? 'is-active' : ''} onClick={() => update({ theme: th })}>{t(th)}</button>
            ))}
          </div>
        </section>

        <section className="drawer__section">
          <h3>{t('viewMode')}</h3>
          <div className="seg">
            {views.map((v) => (
              <button key={v} className={settings.view === v ? 'is-active' : ''} onClick={() => update({ view: v })}>
                {v === 'verse' ? t('verseByVerse') : t('readingMode')}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer__section">
          <h3>{t('fontSize')}</h3>
          <div className="range-row">
            <button className="icon-btn" onClick={() => update({ fontScale: Math.max(1, settings.fontScale - 1) })} aria-label="-">−</button>
            <input type="range" min={1} max={7} step={1} value={settings.fontScale} onChange={(e) => update({ fontScale: +e.target.value })} aria-label={t('fontSize')} />
            <button className="icon-btn" onClick={() => update({ fontScale: Math.min(7, settings.fontScale + 1) })} aria-label="+">+</button>
          </div>
          <p className="quran-text quran-text--preview" dir="rtl">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>
        </section>

        <section className="drawer__section">
          <label className="switch">
            <input type="checkbox" checked={settings.showTafsir} onChange={(e) => update({ showTafsir: e.target.checked })} />
            <span>{t('showTafsir')}</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={settings.wordTooltips} onChange={(e) => update({ wordTooltips: e.target.checked })} />
            <span>{t('wordTooltips')}</span>
          </label>
        </section>

        <section className="drawer__section">
          <h3>{t('highlights')}</h3>
          <button className="btn btn--ghost" onClick={clearHighlights} disabled={!verseHighlights.size && !wordHighlights.size}>
            {t('clearHighlights')} ({verseHighlights.size + wordHighlights.size})
          </button>
        </section>

        <p className="drawer__note">{t('sourceNote')}</p>
      </aside>
    </>
  );
}
