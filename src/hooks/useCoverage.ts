import { useAsync } from './useAsync';
import { API_BASE } from '../lib/apiBase';

let cached: Promise<Set<number>> | null = null;

/** Surahs the AI assistant can answer about (their tafsir corpus is indexed). Fetched once per session. */
export function useCoverage(): { covered: Set<number> | null; isCovered: (verseKey: string | null) => boolean | null } {
  const { data } = useAsync(() => {
    cached ??= fetch(`${API_BASE}/api/coverage`).then((r) => (r.ok ? r.json() : { surahs: [] })).then((d: { surahs: number[] }) => new Set(d.surahs)).catch(() => new Set<number>());
    return cached;
  }, []);
  const covered = data ?? null;
  return {
    covered,
    isCovered: (verseKey) => {
      if (!covered || !verseKey) return null; // unknown yet
      return covered.has(Number(verseKey.split(':')[0]));
    },
  };
}
