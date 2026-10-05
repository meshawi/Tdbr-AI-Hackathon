import { useCallback, useEffect, useState } from 'react';

/** A question the reader asked about a verse / reflection. Stored locally for now; AI answering comes later. */
export interface VerseQuestion {
  id: string;
  verseKey: string;
  reflectionId: number;
  question: string;
  askedAt: string; // ISO date
  answer?: string;
}

const KEY = 'quran.questions.v1';

function load(): VerseQuestion[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function useQuestions(verseKey?: string) {
  const [all, setAll] = useState<VerseQuestion[]>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }, [all]);

  const ask = useCallback((q: Omit<VerseQuestion, 'id' | 'askedAt'>) => {
    const entry: VerseQuestion = { ...q, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, askedAt: new Date().toISOString() };
    console.log('[علمتني آية] question asked', entry);
    setAll((list) => [...list, entry]);
    return entry;
  }, []);

  const remove = useCallback((id: string) => setAll((list) => list.filter((q) => q.id !== id)), []);

  return { questions: verseKey ? all.filter((q) => q.verseKey === verseKey) : all, ask, remove };
}
