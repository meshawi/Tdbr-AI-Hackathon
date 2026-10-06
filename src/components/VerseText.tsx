import { useSettings } from '../hooks/useSettings';
import { useUserData } from '../hooks/useUserData';
import { useToast } from '../hooks/useToast';
import { num, wordKey } from '../lib/format';
import type { Chapter, Verse } from '../lib/types';
import { CopyIcon, HighlightIcon } from './Icons';

export interface WordSelection {
  key: string;
  chapterId: number;
  verse: number;
  index: number;
}

interface Props {
  chapter: Chapter;
  verse: Verse;
  selectedWord: WordSelection | null;
  onSelectWord: (sel: WordSelection | null) => void;
  /** inline (reading / mushaf) rendering vs. block rendering */
  inline?: boolean;
}

/**
 * Renders one ayah word-by-word. Every word is its own <span class="word"> so it can be
 * hovered, clicked, highlighted and addressed as chapter:verse:word. The end-of-ayah
 * marker (۝ + number) is a separate span rendered with the KFGQPC font ligature.
 */
export function VerseText({ chapter, verse, selectedWord, onSelectWord, inline = false }: Props) {
  const { settings } = useSettings();
  const { wordHighlights } = useUserData();

  const onWordClick = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!settings.wordTooltips) return;
    const key = wordKey(chapter.id, verse.n, i);
    onSelectWord(selectedWord?.key === key ? null : { key, chapterId: chapter.id, verse: verse.n, index: i });
  };

  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={`quran-text verse-text ${inline ? 'verse-text--inline' : ''}`} dir="rtl" lang="ar">
      {verse.r && <span className="rub" title="ربع حزب">۞</span>}
      {verse.w.map((w, i) => {
        const key = wordKey(chapter.id, verse.n, i);
        const selected = selectedWord?.key === key;
        const cls = ['word', wordHighlights.has(key) ? 'is-highlighted' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
        return (
          <span key={i} className="word-wrap">
            <span
              className={cls}
              data-word={key}
              role={settings.wordTooltips ? 'button' : undefined}
              tabIndex={settings.wordTooltips ? 0 : undefined}
              onClick={(e) => onWordClick(i, e)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWordClick(i, e as unknown as React.MouseEvent); } }}
            >
              {w}
            </span>
            {selected && <WordPopover chapter={chapter} verse={verse} index={i} wordKeyStr={key} onClose={() => onSelectWord(null)} />}
            {' '}
          </span>
        );
      })}
      <span className="ayah-marker" data-verse-end={`${chapter.id}:${verse.n}`}>{verse.m}</span>
      {inline && ' '}
    </Tag>
  );
}

function WordPopover({ chapter, verse, index, wordKeyStr, onClose }: { chapter: Chapter; verse: Verse; index: number; wordKeyStr: string; onClose: () => void }) {
  const { settings, t } = useSettings();
  const { wordHighlights, toggleWordHighlight } = useUserData();
  const toast = useToast();
  const lang = settings.lang;
  const word = verse.w[index];
  const simple = verse.ew?.[index];
  const highlighted = wordHighlights.has(wordKeyStr);

  const copy = async () => {
    try { await navigator.clipboard.writeText(word); toast(t('copied')); } catch { /* ignore */ }
    onClose();
  };

  return (
    <span className="word-popover" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()} role="dialog">
      <span className="word-popover__word quran-text" dir="rtl">{word}</span>
      <span className="word-popover__meta">
        {chapter.nameAr} {num(chapter.id, lang)}:{num(verse.n, lang)} · {t('word')} {num(index + 1, lang)} / {num(verse.w.length, lang)}
      </span>
      {simple && (
        <span className="word-popover__row"><span className="muted">{t('simpleSpelling')}:</span> <span dir="rtl">{simple}</span></span>
      )}
      <span className="word-popover__actions">
        <button className="btn btn--small" onClick={copy}><CopyIcon /> {t('copyWord')}</button>
        <button className={`btn btn--small ${highlighted ? 'is-active' : ''}`} onClick={() => { toggleWordHighlight(wordKeyStr); }}>
          <HighlightIcon filled={highlighted} /> {highlighted ? t('unhighlightWord') : t('highlightWord')}
        </button>
      </span>
    </span>
  );
}
