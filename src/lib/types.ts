export interface Chapter {
  id: number;
  slug: string;
  nameAr: string;
  nameArFull: string;
  nameEn: string;
  meaningEn: string;
  revelation: 'makki' | 'madani';
  versesCount: number;
  pages: [number, number];
  juz: [number, number];
  bismillahPre: boolean;
}

export interface Verse {
  /** verse number within the surah */
  n: number;
  /** Madinah Mushaf page (1..604) */
  p: number;
  /** juz (1..30) */
  j: number;
  /** [line_start, line_end] on the Mushaf page */
  l: [number, number];
  /** words in KFGQPC Uthmani Unicode */
  w: string[];
  /** end-of-ayah marker with Arabic-Indic number, e.g. "۝١٤" */
  m: string;
  /** imlaei (simple spelling) text, for search */
  e: string;
  /** verse begins with the rub-el-hizb ornament ۞ */
  r?: boolean;
  /** imlaei spelling per word (only when word counts align) */
  ew?: string[];
}

export interface ChapterData extends Chapter {
  verses: Verse[];
}

export interface TafsirData {
  id: number;
  source: string;
  tafsir: Record<string, string>;
}

export interface Range {
  s: number;
  from: number;
  to: number;
}

export type SearchRow = [number, number, string];

export interface Segment {
  chapter: Chapter;
  verses: Verse[];
}

/** One entry from the book "علمتني آية" (public/data/reflections.json). */
export interface Reflection {
  id: number;
  surah: number;
  surahName: string;
  surahNameEn: string;
  slug: string;
  ayahFrom: number;
  ayahTo: number;
  verseKey: string;
  verseKeys: string[];
  quote: string;
  text: string | null;
  comment: string;
  extraRefs?: { surah: number; surahName: string; ayahFrom: number; ayahTo: number; verseKey: string; quote: string }[];
  printedRef: string;
  note?: string;
  page: number;
}

export interface ReflectionsFile {
  source: { title: string; titleEn: string; author: string; authorEn: string; date: string };
  count: number;
  reflections: Reflection[];
}

export type Lang = 'ar' | 'en';
export type Theme = 'light' | 'dark' | 'sepia';
export type ViewMode = 'verse' | 'reading';
