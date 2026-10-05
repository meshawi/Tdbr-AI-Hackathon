import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { useToast } from '../hooks/useToast';
import { chapterPath, num, verseKey, verseText } from '../lib/format';
import type { Chapter, Reflection, Verse } from '../lib/types';
import { BookIcon, BookmarkIcon, CopyIcon, HighlightIcon, LinkIcon, SparkIcon } from './Icons';
import { ReflectionBox } from './ReflectionBox';
import { TafsirBox } from './TafsirBox';
import { VerseText, type WordSelection } from './VerseText';

interface Props {
  chapter: Chapter;
  verse: Verse;
  active: boolean;
  /** verse is inside the viewport and has a reflection (drives the glow) */
  glow: boolean;
  reflections?: Reflection[];
  onActivate: () => void;
  selectedWord: WordSelection | null;
  onSelectWord: (sel: WordSelection | null) => void;
}

/** quran.com-style verse row: actions column + Uthmani text (+ optional tafsir / reflection). */
export function VerseItem({ chapter, verse, active, glow, reflections, onActivate, selectedWord, onSelectWord }: Props) {
  const { settings, t } = useSettings();
  const { bookmarks, verseHighlights, toggleBookmark, toggleVerseHighlight } = useUserData();
  const toast = useToast();
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const hasReflection = !!reflections?.length && settings.showReflections;
  const key = verseKey(chapter.id, verse.n);
  const lang = settings.lang;
  const isBookmarked = bookmarks.has(key);
  const isHighlighted = verseHighlights.has(key);
  const showTafsir = settings.showTafsir || tafsirOpen;

  const copy = async () => {
    const text = `${verseText(verse)}\n[${chapter.nameEn} ${chapter.id}:${verse.n}]`;
    try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { /* ignore */ }
  };
  const share = async () => {
    const url = `${location.origin}${chapterPath(chapter, verse.n)}`;
    try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { /* ignore */ }
  };

  const cls = ['verse', active ? 'is-active' : '', isHighlighted ? 'is-highlighted' : '', hasReflection ? 'has-reflection' : '', hasReflection && glow ? 'is-glow' : ''].filter(Boolean).join(' ');

  return (
    <article id={`verse-${chapter.id}-${verse.n}`} className={cls} data-verse-key={key} data-page={verse.p} data-juz={verse.j} data-chapter={chapter.id} onClick={onActivate}>
      <div className="verse__actions" onClick={(e) => e.stopPropagation()}>
        <a className="verse__key" href={chapterPath(chapter, verse.n)} onClick={(e) => { e.preventDefault(); onActivate(); }} title={t('selectVerse')}>
          {num(chapter.id, lang)}:{num(verse.n, lang)}
        </a>
        <button className={`icon-btn ${showTafsir ? 'is-active' : ''}`} onClick={() => setTafsirOpen((o) => !o)} aria-label={t('tafsir')} title={t('tafsir')}><BookIcon /></button>
        <button className="icon-btn" onClick={copy} aria-label={t('copy')} title={t('copy')}><CopyIcon /></button>
        <button className="icon-btn" onClick={share} aria-label={t('share')} title={t('share')}><LinkIcon /></button>
        <button className={`icon-btn ${isBookmarked ? 'is-active' : ''}`} onClick={() => toggleBookmark(key)} aria-label={t('bookmark')} title={t('bookmark')} aria-pressed={isBookmarked}><BookmarkIcon filled={isBookmarked} /></button>
        <button className={`icon-btn ${isHighlighted ? 'is-active' : ''}`} onClick={() => toggleVerseHighlight(key)} aria-label={t('highlight')} title={t('highlight')} aria-pressed={isHighlighted}><HighlightIcon filled={isHighlighted} /></button>
        {hasReflection && (
          <button className={`icon-btn icon-btn--spark ${reflectionOpen ? 'is-active' : ''}`} onClick={() => setReflectionOpen((o) => !o)} aria-label={t('reflectionBadge')} title={t('reflectionBadge')} aria-pressed={reflectionOpen}><SparkIcon /></button>
        )}
      </div>
      <div className="verse__body">
        <VerseText chapter={chapter} verse={verse} selectedWord={selectedWord} onSelectWord={onSelectWord} />
        {hasReflection && reflectionOpen && <ReflectionBox reflections={reflections!} />}
        {showTafsir && <TafsirBox chapterId={chapter.id} verse={verse.n} />}
      </div>
    </article>
  );
}
