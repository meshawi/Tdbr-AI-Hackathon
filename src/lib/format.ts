import type { Chapter, Lang, Verse } from './types';

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[+d]);
}

export function num(n: number | string, lang: Lang): string {
  return lang === 'ar' ? toArabicDigits(n) : String(n);
}

export function verseKey(chapterId: number, verse: number): string {
  return `${chapterId}:${verse}`;
}

export function wordKey(chapterId: number, verse: number, wordIndex: number): string {
  return `${chapterId}:${verse}:${wordIndex + 1}`;
}

/** Full Uthmani text of a verse including the ayah marker, for copying. */
export function verseText(v: Verse, withMarker = true): string {
  const body = (v.r ? '۞ ' : '') + v.w.join(' ');
  return withMarker ? `${body} ${v.m}` : body;
}

export function chapterTitle(c: Chapter, lang: Lang): string {
  return lang === 'ar' ? c.nameAr : c.nameEn;
}

export function chapterPath(c: Chapter, verse?: number): string {
  return verse ? `/${c.slug}?startingVerse=${verse}` : `/${c.slug}`;
}

export const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
