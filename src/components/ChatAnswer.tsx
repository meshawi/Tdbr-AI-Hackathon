import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { num } from '../lib/format';
import type { ChatSource, ChatTurn } from '../lib/chat';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const CITE_RE = /(\[[\d٠-٩]+(?:\s*,\s*[\d٠-٩]+)*\])/;
const toAscii = (x: string) => x.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/** Inline pass: "[3]" / "[٣]" markers become citation chips, **bold** becomes <strong>, single newlines become <br>. */
function renderInline(text: string, byN: Map<number, ChatSource>, go: (s: ChatSource) => void, keyBase: string): ReactNode[] {
  return text.split(CITE_RE).flatMap((part, i) => {
    const m = part.match(/^\[([\d٠-٩,\s]+)\]$/);
    if (m) {
      return toAscii(m[1]).split(',').map((x) => Number(x.trim())).filter(Boolean).map((n, k) => {
        const s = byN.get(n);
        return (
          <button key={`${keyBase}-${i}-${k}`} className="cite" onClick={() => s && go(s)} title={s?.citation ?? ''} disabled={!s}>
            {num(n, 'ar')}
          </button>
        );
      });
    }
    // **bold** and line breaks inside a paragraph
    return part.split(/(\*\*[^*\n]+\*\*)/).flatMap((seg, j) => {
      const b = seg.match(/^\*\*([^*\n]+)\*\*$/);
      if (b) return [<strong key={`${keyBase}-${i}-${j}`}>{b[1]}</strong>];
      return seg.split('\n').flatMap((line, li) => (li ? [<br key={`${keyBase}-${i}-${j}-${li}`} />, line] : [line]));
    });
  });
}

const LIST_RE = /^\s*(?:[-*•]|[\d٠-٩]+[.)])\s+/;

/** Renders an answer: paragraphs, light markdown (lists, bold, headings) and clickable "[n]" citation chips.
 *  Shared by the chat panel, the reflection pulse and the AI-history trace page. */
export function renderWithCitations(text: string, sources: ChatSource[], go: (s: ChatSource) => void, hideChips = false): ReactNode {
  const byN = new Map(sources.map((s) => [s.n, s]));
  const body = hideChips ? text.replace(/\s*\[[\d٠-٩]+(?:\s*,\s*[\d٠-٩]+)*\]/g, '') : text;
  return body.split(/\n{2,}/).map((para, pi) => {
    const lines = para.split('\n').filter((l) => l.trim());
    if (!lines.length) return null;
    const listLines = lines.filter((l) => LIST_RE.test(l));
    if (listLines.length && listLines.length >= lines.length - 1) {
      const lead = LIST_RE.test(lines[0]) ? null : lines[0];
      const items = lead === null ? lines : lines.slice(1);
      const ordered = /^\s*[\d٠-٩]+[.)]/.test(items[0]);
      const List = ordered ? 'ol' : 'ul';
      return (
        <div key={pi}>
          {lead !== null && <p>{renderInline(lead, byN, go, `${pi}-lead`)}</p>}
          <List className="answer-list">{items.map((l, li) => <li key={li}>{renderInline(l.replace(LIST_RE, ''), byN, go, `${pi}-${li}`)}</li>)}</List>
        </div>
      );
    }
    const h = para.match(/^\s*#{1,6}\s+(.+)$/);
    if (h) return <p key={pi}><strong>{renderInline(h[1], byN, go, `${pi}-h`)}</strong></p>;
    return <p key={pi}>{renderInline(para, byN, go, `${pi}`)}</p>;
  });
}

/** Where a source click goes: the trace page for this answer (why this source was used), or the verse if no trace id yet. */
export function useOpenSource(logId: string | undefined) {
  const navigate = useNavigate();
  return (s: ChatSource) => {
    if (logId) window.open(`/ai-history/${logId}?source=${s.n}`, '_blank', 'noopener');
    else navigate(`/${s.surah}?startingVerse=${s.ayah_from}`);
  };
}

/** One assistant turn: streamed text with citation chips, typing dots, error, and a collapsed source list. */
export function AssistantTurn({ turn, onRetry }: { turn: ChatTurn; onRetry?: () => void }) {
  const { t, settings } = useSettings();
  const open = useOpenSource(turn.logId);
  const [showSources, setShowSources] = useState(false);
  const empty = !turn.pending && !turn.error && !turn.content.trim();
  const live = !!turn.reasoning && !turn.reasoningDone; // thinking in progress: expanded
  const [showReasoning, setShowReasoning] = useState(false);
  const reasoningRef = useRef<HTMLPreElement>(null);
  useEffect(() => { if (live && reasoningRef.current) reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight; }, [turn.reasoning, live]);
  return (
    <div className="chat-msg chat-msg--assistant">
      {settings.showThinking && !!turn.reasoning && (
        <div className={`thinking ${live ? 'is-live' : ''}`}>
          <button className="thinking__toggle" onClick={() => setShowReasoning((v) => !v)} aria-expanded={live || showReasoning}>
            <span className="thinking__dot" aria-hidden />
            {live ? t('chatThinking') : `${t('traceReasoning')} (${num(turn.reasoning.length, 'ar')})`}
          </button>
          {(live || showReasoning) && <pre className="thinking__text" ref={reasoningRef} dir="auto">{turn.reasoning}</pre>}
        </div>
      )}
      <div className="chat-msg__bubble">
        {renderWithCitations(turn.content, turn.sources ?? [], open, settings.hideCitations)}
        {turn.pending && !turn.content && <span className="chat-msg__dots" aria-hidden><i /><i /><i /></span>}
        {empty && (
          <div className="chat-msg__error">
            {t('chatEmpty')} {onRetry && <button className="btn btn--small" onClick={onRetry}>{t('chatRetry')}</button>}
          </div>
        )}
        {turn.error && (
          <div className="chat-msg__error">
            {t('chatError')}: {turn.error} {onRetry && <button className="btn btn--small" onClick={onRetry}>{t('chatRetry')}</button>}
          </div>
        )}
      </div>
      {!!turn.sources?.length && !turn.pending && (
        <div className="chat-sources">
          <button className="chat-sources__toggle" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}>
            {showSources ? '▾' : '◂'} {t('chatSources')} ({num(turn.sources.length, 'ar')})
          </button>
          {showSources && (
            <ol className="chat-sources__list">
              {turn.sources.map((s) => (
                <li key={s.n}>
                  <button className="chat-source" onClick={() => open(s)} title={turn.logId ? t('chatSourceWhy') : s.citation}>
                    [{num(s.n, 'ar')}] {s.book_name}{s.author ? ` (${s.author})` : ''} · {s.surah_name} {num(s.ayah_from, 'ar')}{s.ayah_to !== s.ayah_from ? `-${num(s.ayah_to, 'ar')}` : ''}{s.book_page ? ` · ص ${num(s.book_page, 'ar')}` : ''}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
