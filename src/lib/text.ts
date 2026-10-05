import type { Chapter } from './types';

/** Normalise Arabic for forgiving search: strip tashkeel/tatweel, unify alef/yaa/taa-marbuta forms. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Fold a Latin surah name to a slug: "Al-Fātiḥah" -> "al-fatihah". */
export function foldLatin(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'ʻʼ`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolve a URL segment (number, quran.com slug, or KFGQPC English name) to a chapter. */
export function resolveChapter(chapters: Chapter[], param: string | undefined): Chapter | undefined {
  if (!param) return undefined;
  const p = decodeURIComponent(param).trim();
  const n = Number(p);
  if (Number.isInteger(n) && n >= 1 && n <= 114) return chapters[n - 1];
  const f = foldLatin(p);
  return chapters.find((c) => c.slug === f || foldLatin(c.nameEn) === f || foldLatin(c.nameEn).replace(/-/g, '') === f.replace(/-/g, ''))
    ?? chapters.find((c) => normalizeArabic(c.nameAr) === normalizeArabic(p));
}

/** Parse "2:14", "2 14", "البقرة 14", "al-baqarah 14" into a verse reference. */
export function parseVerseRef(chapters: Chapter[], q: string): { chapter: Chapter; verse?: number } | undefined {
  const m = q.trim().match(/^(.+?)[\s:：]+(\d+)$/) ?? q.trim().match(/^(\d+)$/);
  if (!m) return undefined;
  const chapter = resolveChapter(chapters, m[1]);
  if (!chapter) return undefined;
  const verse = m[2] ? Number(m[2]) : undefined;
  if (verse !== undefined && (verse < 1 || verse > chapter.versesCount)) return undefined;
  return { chapter, verse };
}

export function matchChapters(chapters: Chapter[], q: string): Chapter[] {
  const nq = normalizeArabic(q);
  const fq = foldLatin(q);
  if (!nq && !fq) return [];
  return chapters.filter((c) =>
    (nq && normalizeArabic(c.nameAr).includes(nq)) ||
    (fq && (c.slug.includes(fq) || foldLatin(c.nameEn).includes(fq) || foldLatin(c.meaningEn).includes(fq))),
  );
}
