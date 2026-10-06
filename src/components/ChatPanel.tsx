import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCoverage } from '../hooks/useCoverage';
import { useSettings } from '../hooks/useSettings';
import { streamChat, type ChatTurn } from '../lib/chat';
import { AssistantTurn } from './ChatAnswer';
import { ChatIcon, CloseIcon, SendIcon, SparkIcon } from './Icons';

interface Props {
  /** the verse the reader is on, e.g. "2:255" (selected verse, else the one at the top of the viewport) */
  verseKey: string | null;
  verseLabel: string | null;
}

/** Floating study-assistant chat bound to the active verse. Answers come from the backend RAG + DeepSeek. */
export function ChatPanel({ verseKey, verseLabel }: Props) {
  const { t, settings } = useSettings();
  const { isCovered } = useCoverage();
  const supported = isCovered(verseKey); // null = unknown yet
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Follow the stream only while the reader is already near the bottom; never yank a scrolled-up view.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || turns.length <= 2) el.scrollTo({ top: el.scrollHeight });
  }, [turns, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (e?: FormEvent, override?: string) => {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || busy || supported === false) return;
    setInput('');
    setBusy(true);
    setStatus(null);
    const history = turns.filter((x) => !x.error).map((x) => ({ role: x.role, content: x.content }));
    const assistant: ChatTurn = { role: 'assistant', content: '', sources: [], toolQueries: [], pending: true };
    setTurns((prev) => [...prev, { role: 'user', content: text }, assistant]);
    const update = (patch: (a: ChatTurn) => ChatTurn) => setTurns((prev) => {
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat({ current_verse_id: verseKey, chat_history: history, user_message: text, surface: 'chat', reasoning_effort: settings.reasoningEffort || undefined }, (ev) => {
        if (ev.type === 'sources') update((a) => ({ ...a, sources: [...(a.sources ?? []), ...ev.sources] }));
        else if (ev.type === 'thinking') setStatus(settings.showThinking ? null : t('chatThinking'));
        else if (ev.type === 'retry') setStatus(t('chatRetrying'));
        else if (ev.type === 'reasoning') update((a) => ({ ...a, reasoning: (a.reasoning ?? '') + ev.text }));
        else if (ev.type === 'tool') { setStatus(`${t('chatSearching')} «${ev.query}»`); update((a) => ({ ...a, toolQueries: [...(a.toolQueries ?? []), ev.query] })); }
        else if (ev.type === 'delta') { setStatus(null); update((a) => (a.reasoningDone ? a : { ...a, reasoningDone: true })); update((a) => ({ ...a, content: a.content + ev.text })); }
        else if (ev.type === 'error') update((a) => ({ ...a, error: ev.message, pending: false, logId: ev.log_id ?? a.logId }));
        else if (ev.type === 'done') update((a) => ({ ...a, pending: false, reasoningDone: true, logId: ev.log_id }));
      }, ctrl.signal);
    } catch (err) {
      if (!ctrl.signal.aborted) update((a) => ({ ...a, error: String(err), pending: false }));
    } finally {
      setBusy(false);
      setStatus(null);
      update((a) => ({ ...a, pending: false }));
    }
  };

  return (
    <>
      <button className={`chat-fab ${open ? 'is-open' : ''} ${supported === false ? 'is-unsupported' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={t('chatTitle')} title={supported === false ? t('chatUnsupported') : t('chatTitle')}>
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <section className="chat-panel" dir="rtl" aria-label={t('chatTitle')}>
          <header className="chat-panel__head">
            <span className="chat-panel__title"><SparkIcon /> {t('chatTitle')}</span>
            <span className="chat-panel__verse muted">{verseLabel ?? t('chatNoVerse')}</span>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('close')}><CloseIcon /></button>
          </header>

          <div className="chat-panel__list" ref={listRef}>
            {turns.length === 0 && <p className="chat-panel__hint muted">{t('chatHint')}</p>}
            {turns.map((turn, i) => (
              turn.role === 'user'
                ? <div key={i} className="chat-msg chat-msg--user"><div className="chat-msg__bubble">{turn.content}</div></div>
                : <AssistantTurn key={i} turn={turn} onRetry={i === turns.length - 1 ? () => { const q = turns[i - 1]?.content; setTurns((p) => p.slice(0, -2)); if (q) void send(undefined, q); } : undefined} />
            ))}
            {status && <div className="chat-status muted">{status}</div>}
          </div>

          {supported === false && <p className="chat-panel__unsupported">{t('chatUnsupported')}</p>}
          <form className="chat-panel__form" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={supported === false ? t('chatUnsupported') : verseKey ? t('chatPlaceholder') : t('chatNoVerse')}
              aria-label={t('chatPlaceholder')}
              disabled={busy || supported === false}
              autoFocus
            />
            <button type="submit" className="chat-panel__send" disabled={busy || !input.trim() || supported === false} aria-label={t('chatSend')}><SendIcon /></button>
          </form>
          <p className="chat-panel__about muted">{t('chatAbout')}</p>
        </section>
      )}
    </>
  );
}
