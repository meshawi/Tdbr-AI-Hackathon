import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { num } from '../lib/format';
import type { Chapter, Segment } from '../lib/types';
import { ChapterHeader } from './ChapterHeader';
import { ReadingView } from './ReadingView';
import { VerseItem } from './VerseItem';
import type { WordSelection } from './VerseText';
import { ArrowUpIcon } from './Icons';

interface Props {
  segments: Segment[];
  /** verse key to scroll to and mark active on mount, e.g. "2:14" */
  initialVerseKey?: string | null;
  /** render the big surah header for segments that start at verse 1 */
  showHeaders?: boolean;
}

interface Position { chapter: Chapter; verse: number; page: number; juz: number }

/** Shared reader used by surah, juz and page routes. Handles both view modes, selection and the context bar. */
export function QuranReader({ segments, initialVerseKey = null, showHeaders = true }: Props) {
  const { settings, t } = useSettings();
  const { setLastRead } = useUserData();
  const [activeKey, setActiveKey] = useState<string | null>(initialVerseKey);
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [showTop, setShowTop] = useState(false);
  const lang = settings.lang;

  const chaptersById = useMemo(() => new Map(segments.map((s) => [s.chapter.id, s.chapter])), [segments]);

  // Scroll to the requested verse once the DOM is ready (both view modes render the same ids).
  useEffect(() => {
    setActiveKey(initialVerseKey);
    if (!initialVerseKey) { window.scrollTo({ top: 0 }); return; }
    const id = `verse-${initialVerseKey.replace(':', '-')}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [initialVerseKey, segments, settings.view]);

  // Track the verse nearest the top of the viewport for the sticky context bar + last-read memory.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const nodes = document.querySelectorAll<HTMLElement>('[data-verse-key]');
      const top = 120;
      let found: HTMLElement | null = null;
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.bottom > top) { found = el; break; }
      }
      if (found) {
        const chapter = chaptersById.get(Number(found.dataset.chapter));
        const [, v] = (found.dataset.verseKey ?? '').split(':');
        if (chapter) {
          const pos = { chapter, verse: Number(v), page: Number(found.dataset.page), juz: Number(found.dataset.juz) };
          setPosition((p) => (p && p.chapter.id === pos.chapter.id && p.verse === pos.verse ? p : pos));
          setLastRead(chapter.id, Number(v));
        }
      }
      setShowTop(window.scrollY > 600);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [chaptersById, segments, settings.view, setLastRead]);

  // Close the word popover when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!selectedWord) return;
    const close = () => setSelectedWord(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [selectedWord]);

  const activate = useCallback((key: string) => setActiveKey((k) => (k === key ? null : key)), []);

  return (
    <div className="reader">
      <div className="context-bar" aria-live="polite">
        {position ? (
          <>
            <Link to={`/${position.chapter.slug}`} className="context-bar__surah" dir="rtl">{position.chapter.nameAr}</Link>
            <span className="context-bar__sep" />
            <Link to={`/juz/${position.juz}`}>{t('juz')} {num(position.juz, lang)}</Link>
            <span className="context-bar__sep" />
            <Link to={`/page/${position.page}`}>{t('page')} {num(position.page, lang)}</Link>
            <span className="context-bar__sep" />
            <span>{t('ayah')} {num(position.verse, lang)}</span>
          </>
        ) : <span className="muted">…</span>}
      </div>

      {settings.view === 'reading' ? (
        <ReadingView segments={segments} activeKey={activeKey} onActivate={activate} selectedWord={selectedWord} onSelectWord={setSelectedWord} />
      ) : (
        segments.map((seg) => (
          <section key={seg.chapter.id} className="segment">
            {showHeaders && (seg.verses[0]?.n === 1
              ? <ChapterHeader chapter={seg.chapter} />
              : <ChapterHeader chapter={seg.chapter} compact />)}
            <div className="verses">
              {seg.verses.map((v) => (
                <VerseItem
                  key={v.n}
                  chapter={seg.chapter}
                  verse={v}
                  active={activeKey === `${seg.chapter.id}:${v.n}`}
                  onActivate={() => activate(`${seg.chapter.id}:${v.n}`)}
                  selectedWord={selectedWord}
                  onSelectWord={setSelectedWord}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <button className={`to-top ${showTop ? 'is-visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="top">
        <ArrowUpIcon />
      </button>
    </div>
  );
}
