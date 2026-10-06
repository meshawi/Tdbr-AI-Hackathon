import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { useToast } from '../hooks/useToast';
import { chapterPath, verseKey, verseText } from '../lib/format';
import type { Chapter, Verse } from '../lib/types';
import { BookIcon, BookmarkIcon, CopyIcon, HighlightIcon, LinkIcon, SparkIcon } from './Icons';

interface Props {
  chapter: Chapter;
  verse: Verse;
  tafsirOpen: boolean;
  onToggleTafsir: () => void;
  hasReflection: boolean;
  reflectionOpen: boolean;
  onToggleReflection: () => void;
}

/** Per-verse buttons (tafsir, copy, link, bookmark, highlight, reflection) shared by both view modes. */
export function VerseActions({ chapter, verse, tafsirOpen, onToggleTafsir, hasReflection, reflectionOpen, onToggleReflection }: Props) {
  const { t } = useSettings();
  const { bookmarks, verseHighlights, toggleBookmark, toggleVerseHighlight } = useUserData();
  const toast = useToast();
  const key = verseKey(chapter.id, verse.n);
  const isBookmarked = bookmarks.has(key);
  const isHighlighted = verseHighlights.has(key);

  const copy = async () => {
    const text = `${verseText(verse)}\n[${chapter.nameAr} ${chapter.id}:${verse.n}]`;
    try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { /* ignore */ }
  };
  const share = async () => {
    const url = `${location.origin}${chapterPath(chapter, verse.n)}`;
    try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { /* ignore */ }
  };

  return (
    <>
      <button className={`icon-btn ${tafsirOpen ? 'is-active' : ''}`} onClick={onToggleTafsir} aria-label={t('tafsir')} title={t('tafsir')}><BookIcon /></button>
      <button className="icon-btn" onClick={copy} aria-label={t('copy')} title={t('copy')}><CopyIcon /></button>
      <button className="icon-btn" onClick={share} aria-label={t('share')} title={t('share')}><LinkIcon /></button>
      <button className={`icon-btn ${isBookmarked ? 'is-active' : ''}`} onClick={() => toggleBookmark(key)} aria-label={t('bookmark')} title={t('bookmark')} aria-pressed={isBookmarked}><BookmarkIcon filled={isBookmarked} /></button>
      <button className={`icon-btn ${isHighlighted ? 'is-active' : ''}`} onClick={() => toggleVerseHighlight(key)} aria-label={t('highlight')} title={t('highlight')} aria-pressed={isHighlighted}><HighlightIcon filled={isHighlighted} /></button>
      {hasReflection && (
        <button className={`icon-btn icon-btn--spark ${reflectionOpen ? 'is-active' : ''}`} onClick={onToggleReflection} aria-label={t('reflectionBadge')} title={t('reflectionBadge')} aria-pressed={reflectionOpen}><SparkIcon /></button>
      )}
    </>
  );
}
