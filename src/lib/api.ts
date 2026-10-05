import type { Chapter, ChapterData, Range, ReflectionsFile, SearchRow, TafsirData } from './types';

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(relPath: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}${relPath}`;
  if (!cache.has(url)) {
    const p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${relPath} (${res.status})`);
      return res.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url) as Promise<T>;
}

export const getChapters = () => fetchJson<Chapter[]>('data/chapters.json');
export const getChapter = (id: number) => fetchJson<ChapterData>(`data/surah/${id}.json`);
export const getTafsir = (id: number) => fetchJson<TafsirData>(`data/tafsir/${id}.json`);
export const getPagesIndex = () => fetchJson<Record<string, Range[]>>('data/pages.json');
export const getJuzIndex = () => fetchJson<Record<string, Range[]>>('data/juzs.json');
export const getSearchIndex = () => fetchJson<SearchRow[]>('data/search-index.json');
export const getReflections = () => fetchJson<ReflectionsFile>('data/reflections.json');

/** Load every verse of the given ranges, grouped by chapter, preserving Mushaf order. */
export async function getRanges(ranges: Range[]) {
  const [chapters, ...datas] = await Promise.all([getChapters(), ...ranges.map((r) => getChapter(r.s))]);
  return ranges.map((r, i) => ({
    chapter: chapters[r.s - 1],
    verses: datas[i].verses.filter((v) => v.n >= r.from && v.n <= r.to),
  }));
}
