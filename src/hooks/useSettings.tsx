import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Theme, ViewMode } from '../lib/types';
import { t as translate, type StringKey } from '../lib/i18n';

export interface Settings {
  lang: Lang;
  theme: Theme;
  /** 1..7, mapped to a font size in CSS */
  fontScale: number;
  view: ViewMode;
  showTafsir: boolean;
  wordTooltips: boolean;
  /** glow + pulse panel for verses that have a reflection in "علمتني آية" */
  showReflections: boolean;
}

const DEFAULTS: Settings = {
  lang: 'ar',
  theme: 'light',
  fontScale: 3,
  view: 'verse',
  showTafsir: false,
  wordTooltips: true,
  showReflections: true,
};

const KEY = 'quran.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: (key: StringKey) => string;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    const root = document.documentElement;
    root.lang = settings.lang;
    root.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
    root.dataset.theme = settings.theme;
    root.style.setProperty('--quran-scale', String(settings.fontScale));
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const t = useCallback((key: StringKey) => translate(key, settings.lang), [settings.lang]);
  const value = useMemo(() => ({ settings, update, t }), [settings, update, t]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
