import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Persisted per-reader state: bookmarks, highlighted verses, highlighted words, last read position. */
interface UserData {
  bookmarks: string[];        // verse keys "2:14"
  verseHighlights: string[];  // verse keys
  wordHighlights: string[];   // word keys "2:14:3"
  lastRead?: { chapter: number; verse: number };
}

const KEY = 'quran.userdata.v1';
const EMPTY: UserData = { bookmarks: [], verseHighlights: [], wordHighlights: [] };

function load(): UserData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

interface Ctx {
  bookmarks: Set<string>;
  verseHighlights: Set<string>;
  wordHighlights: Set<string>;
  lastRead?: { chapter: number; verse: number };
  toggleBookmark: (key: string) => void;
  toggleVerseHighlight: (key: string) => void;
  toggleWordHighlight: (key: string) => void;
  clearHighlights: () => void;
  setLastRead: (chapter: number, verse: number) => void;
}

const UserDataContext = createContext<Ctx | null>(null);

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UserData>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);

  const toggleBookmark = useCallback((key: string) => setData((d) => ({ ...d, bookmarks: toggle(d.bookmarks, key) })), []);
  const toggleVerseHighlight = useCallback((key: string) => setData((d) => ({ ...d, verseHighlights: toggle(d.verseHighlights, key) })), []);
  const toggleWordHighlight = useCallback((key: string) => setData((d) => ({ ...d, wordHighlights: toggle(d.wordHighlights, key) })), []);
  const clearHighlights = useCallback(() => setData((d) => ({ ...d, verseHighlights: [], wordHighlights: [] })), []);
  const setLastRead = useCallback((chapter: number, verse: number) => setData((d) =>
    d.lastRead?.chapter === chapter && d.lastRead.verse === verse ? d : { ...d, lastRead: { chapter, verse } }), []);

  const value = useMemo<Ctx>(() => ({
    bookmarks: new Set(data.bookmarks),
    verseHighlights: new Set(data.verseHighlights),
    wordHighlights: new Set(data.wordHighlights),
    lastRead: data.lastRead,
    toggleBookmark, toggleVerseHighlight, toggleWordHighlight, clearHighlights, setLastRead,
  }), [data, toggleBookmark, toggleVerseHighlight, toggleWordHighlight, clearHighlights, setLastRead]);

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): Ctx {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used inside UserDataProvider');
  return ctx;
}
