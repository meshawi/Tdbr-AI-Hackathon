import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { chapterPath, num, verseKey } from '../lib/format';
import type { Chapter, Reflection, Verse } from '../lib/types';
import { ReflectionBox } from './ReflectionBox';
import { TafsirBox } from './TafsirBox';
import { VerseActions } from './VerseActions';
import { VerseText, type WordSelection } from './VerseText';

interface Props {
  chapter: Chapter;
  verse: Verse;
  active: boolean;
  /** verse is inside the viewport and has a reflection (drives the glow) */
  glow: boolean;
  /** the reflection panel for this verse was closed; keep a faint, static tint until it re-enters the viewport */
  faded: boolean;
  reflections?: Reflection[];
  onActivate: () => void;
  selectedWord: WordSelection | null;
  onSelectWord: (sel: WordSelection | null) => void;
}

/** quran.com-style verse row: actions column + Uthmani text (+ optional tafsir / reflection). */
export function VerseItem({ chapter, verse, active, glow, faded, reflections, onActivate, selectedWord, onSelectWord }: Props) {
  const { settings, t } = useSettings();
  const { verseHighlights } = useUserData();
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const hasReflection = !!reflections?.length && settings.showReflections;
  const key = verseKey(chapter.id, verse.n);
  const lang = settings.lang;
  const isHighlighted = verseHighlights.has(key);
  const showTafsir = settings.showTafsir || tafsirOpen;

  const cls = ['verse', active ? 'is-active' : '', isHighlighted ? 'is-highlighted' : '', hasReflection ? 'has-reflection' : '', hasReflection && glow ? 'is-glow' : '', hasReflection && faded ? 'is-faded' : ''].filter(Boolean).join(' ');

  return (
    <article id={`verse-${chapter.id}-${verse.n}`} className={cls} data-verse-key={key} data-page={verse.p} data-juz={verse.j} data-chapter={chapter.id} onClick={onActivate}>
      <div className="verse__actions" onClick={(e) => e.stopPropagation()}>
        <a className="verse__key" href={chapterPath(chapter, verse.n)} onClick={(e) => { e.preventDefault(); onActivate(); }} title={t('selectVerse')}>
          {num(chapter.id, lang)}:{num(verse.n, lang)}
        </a>
        <VerseActions
          chapter={chapter}
          verse={verse}
          tafsirOpen={showTafsir}
          onToggleTafsir={() => setTafsirOpen((o) => !o)}
          hasReflection={hasReflection}
          reflectionOpen={reflectionOpen}
          onToggleReflection={() => setReflectionOpen((o) => !o)}
        />
      </div>
      <div className="verse__body">
        <VerseText chapter={chapter} verse={verse} selectedWord={selectedWord} onSelectWord={onSelectWord} />
        {hasReflection && reflectionOpen && <ReflectionBox reflections={reflections!} />}
        {showTafsir && <TafsirBox chapterId={chapter.id} verse={verse.n} />}
      </div>
    </article>
  );
}
