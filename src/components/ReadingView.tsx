import { Fragment, useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { BISMILLAH, num, verseKey } from '../lib/format';
import type { Chapter, Segment, Verse } from '../lib/types';
import { VerseText, type WordSelection } from './VerseText';

interface Props {
  segments: Segment[];
  activeKey: string | null;
  glowKeys: Set<string>;
  reflectionKeys: Set<string>;
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
export function ReadingView({ segments, activeKey, glowKeys, reflectionKeys, onActivate, selectedWord, onSelectWord }: Props) {
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
              const hasRef = reflectionKeys.has(key);
              const cls = ['verse-inline', activeKey === key ? 'is-active' : '', verseHighlights.has(key) ? 'is-highlighted' : '', hasRef ? 'has-reflection' : '', hasRef && glowKeys.has(key) ? 'is-glow' : ''].filter(Boolean).join(' ');
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
