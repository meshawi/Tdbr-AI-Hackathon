import { useMemo } from 'react';
import { useAsync } from './useAsync';
import { getReflections } from '../lib/api';
import type { Reflection, ReflectionsFile } from '../lib/types';

export interface ReflectionIndex {
  /** every verse key covered by a reflection (ranges expand to each verse) -> reflections */
  byVerse: Map<string, Reflection[]>;
  /** only the first verse of each reflection, used to trigger the pulse once per entry */
  byStart: Map<string, Reflection[]>;
  source?: ReflectionsFile['source'];
}

const EMPTY: ReflectionIndex = { byVerse: new Map(), byStart: new Map() };

/** Loads the "علمتني آية" reflections once and indexes them by verse key. */
export function useReflections(enabled = true): ReflectionIndex {
  const { data } = useAsync(() => (enabled ? getReflections() : undefined), [enabled]);
  return useMemo(() => {
    if (!data) return EMPTY;
    const byVerse = new Map<string, Reflection[]>();
    const byStart = new Map<string, Reflection[]>();
    for (const r of data.reflections) {
      for (const k of r.verseKeys) byVerse.set(k, [...(byVerse.get(k) ?? []), r]);
      byStart.set(r.verseKey, [...(byStart.get(r.verseKey) ?? []), r]);
    }
    return { byVerse, byStart, source: data.source };
  }, [data]);
}
