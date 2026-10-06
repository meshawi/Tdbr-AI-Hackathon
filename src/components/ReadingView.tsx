import { Fragment, useMemo, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { BISMILLAH, num, verseKey } from '../lib/format';
import type { Chapter, Reflection, Segment, Verse } from '../lib/types';
import { ReflectionBox } from './ReflectionBox';
import { TafsirBox } from './TafsirBox';
import { VerseActions } from './VerseActions';
import { VerseText, type WordSelection } from './VerseText';

interface Props {
  segments: Segment[];
  activeKey: string | null;
  glowKeys: Set<string>;
  /** verses whose reflection panel was closed: faint static tint instead of the glow */
  fadedKeys: Set<string>;
  reflectionsByVerse: Map<string, Reflection[]>;
  onActivate: (key: string) => void;
  selectedWord: WordSelection | null;
  onSelectWord: (sel: WordSelection | null) => void;
}

interface PageBlock {
  page: number;
  items: { chapter: Chapter; verse: Verse }[];
}

/**
 * Mushaf-style continuous text grouped by the Madinah Mushaf page each verse starts on
 * (page numbers are from the KFGQPC data). Verses stay individually addressable.
 */
export function ReadingView({ segments, activeKey, glowKeys, fadedKeys, reflectionsByVerse, onActivate, selectedWord, onSelectWord }: Props) {
  const { settings, t } = useSettings();
  const { verseHighlights } = useUserData();
  const lang = settings.lang;

  const pages = useMemo<PageBlock[]>(() => {
    const out: PageBlock[] = [];
    for (const seg of segments) {
      for (const verse of seg.verses) {
        const last = out[out.length - 1];
        if (!last || last.page !== verse.p) out.push({ page: verse.p, items: [] });
        out[out.length - 1].items.push({ chapter: seg.chapter, verse });
      }
    }
    return out;
  }, [segments]);

  return (
    <div className="mushaf">
      {pages.map((block) => (
        <section key={block.page} className="mushaf-page" id={`page-${block.page}`}>
          <div className="mushaf-page__text quran-text" dir="rtl" lang="ar">
            {block.items.map(({ chapter, verse }) => {
              const key = verseKey(chapter.id, verse.n);
              const reflections = settings.showReflections ? reflectionsByVerse.get(key) : undefined;
              const hasRef = !!reflections?.length;
              const cls = ['verse-inline', activeKey === key ? 'is-active' : '', verseHighlights.has(key) ? 'is-highlighted' : '', hasRef ? 'has-reflection' : '', hasRef && glowKeys.has(key) ? 'is-glow' : '', hasRef && fadedKeys.has(key) ? 'is-faded' : ''].filter(Boolean).join(' ');
              return (
                <Fragment key={key}>
                  {verse.n === 1 && (
                    <span className="mushaf-surah-head" data-chapter={chapter.id}>
                      <span className="mushaf-surah-head__name">سُورَةُ {chapter.nameAr}</span>
                      {chapter.bismillahPre && <span className="mushaf-bismillah">{BISMILLAH}</span>}
                    </span>
                  )}
                  <span
                    id={`verse-${chapter.id}-${verse.n}`}
                    className={cls}
                    data-verse-key={key}
                    data-page={verse.p}
                    data-juz={verse.j}
                    data-chapter={chapter.id}
                    onClick={() => onActivate(key)}
                  >
                    <VerseText chapter={chapter} verse={verse} selectedWord={selectedWord} onSelectWord={onSelectWord} inline />
                  </span>
                  {activeKey === key && <SelectedVersePanel chapter={chapter} verse={verse} reflections={reflections} />}
                </Fragment>
              );
            })}
          </div>
          <footer className="mushaf-page__footer">
            <span>{t('juz')} {num(block.items[0].verse.j, lang)}</span>
            <span className="mushaf-page__num">{num(block.page, lang)}</span>
            <span>{t('page')} {num(block.page, lang)}</span>
          </footer>
        </section>
      ))}
    </div>
  );
}

/** The verse-by-verse actions for the selected verse, shown right under it inside the Mushaf text. */
function SelectedVersePanel({ chapter, verse, reflections }: { chapter: Chapter; verse: Verse; reflections?: Reflection[] }) {
  const { settings } = useSettings();
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const lang = settings.lang;
  const hasReflection = !!reflections?.length;
  const showTafsir = settings.showTafsir || tafsirOpen;

  return (
    <div className="mushaf-verse-panel" onClick={(e) => e.stopPropagation()}>
      <div className="mushaf-verse-panel__bar">
        <span className="mushaf-verse-panel__key">{chapter.nameAr} {num(chapter.id, lang)}:{num(verse.n, lang)}</span>
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
      {hasReflection && reflectionOpen && <ReflectionBox reflections={reflections!} />}
      {showTafsir && <TafsirBox chapterId={chapter.id} verse={verse.n} />}
    </div>
  );
}
