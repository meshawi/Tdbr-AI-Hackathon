import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCoverage } from '../hooks/useCoverage';
import { useQuestions } from '../hooks/useQuestions';
import { useSettings } from '../hooks/useSettings';
import { num } from '../lib/format';
import { streamChat, type ChatTurn } from '../lib/chat';
import type { Reflection } from '../lib/types';
import { AssistantTurn } from './ChatAnswer';
import { CloseIcon, SparkIcon } from './Icons';

/** Inline reflection(s) under a verse (expanded from the badge). */
export function ReflectionBox({ reflections }: { reflections: Reflection[] }) {
  const { settings, t } = useSettings();
  const lang = settings.lang;
  return (
    <div className="reflection" dir="rtl" lang="ar">
      <div className="reflection__head">
        <span className="reflection__title"><SparkIcon /> {t('reflections')}</span>
        <span className="muted reflection__src">{t('reflectionSource')}</span>
      </div>
      {reflections.map((r) => (
        <div key={r.id} className="reflection__item">
          <p className="reflection__quote quran-text">﴿{r.quote}﴾ <span className="reflection__ref">[{r.surahName}: {num(r.ayahFrom, lang)}{r.ayahTo !== r.ayahFrom ? `-${num(r.ayahTo, lang)}` : ''}]</span></p>
          <p className="reflection__comment"><strong>{t('reflectionLabel')}:</strong> {r.comment}</p>
          {r.extraRefs?.length ? (
            <p className="reflection__extra muted">
              {t('alsoCites')}: {r.extraRefs.map((x, i) => (
                <span key={i}><Link to={`/${x.surah}?startingVerse=${x.ayahFrom}`}>﴿{x.quote}﴾ [{x.surahName}: {num(x.ayahFrom, lang)}]</Link>{i < r.extraRefs!.length - 1 ? '، ' : ''}</span>
              ))}
            </p>
          ) : null}
          <span className="reflection__num muted">{t('reflectionNumber')} {num(r.id, lang)}</span>
        </div>
      ))}
    </div>
  );
}

interface PulseProps {
  verseKey: string;
  reflections: Reflection[];
  onDismiss: () => void;
}

/** Floating pulse panel shown while a verse from the book is inside the viewport. */
export function ReflectionPulse({ verseKey, reflections, onDismiss }: PulseProps) {
  const { settings, t } = useSettings();
  const lang = settings.lang;
  const r = reflections[0];
  return (
    <aside className="reflection-pulse" dir="rtl" lang="ar" role="status" aria-live="polite" key={verseKey}>
      <div className="reflection-pulse__glow" aria-hidden />
      <div className="reflection-pulse__body">
        <div className="reflection-pulse__head">
          <span className="reflection-pulse__title"><SparkIcon /> {t('reflections')}</span>
          <span className="muted">{r.surahName} {num(r.ayahFrom, lang)}{r.ayahTo !== r.ayahFrom ? `-${num(r.ayahTo, lang)}` : ''}</span>
          <button className="icon-btn" onClick={onDismiss} aria-label={t('dismiss')}><CloseIcon /></button>
        </div>
        <p className="reflection-pulse__quote quran-text">﴿{r.quote}﴾</p>
        {reflections.map((x) => (
          <p key={x.id} className="reflection-pulse__comment">{x.comment}</p>
        ))}
        <span className="reflection-pulse__src muted">{t('reflectionSource')}</span>
        <QuestionBox verseKey={verseKey} reflection={r} />
      </div>
    </aside>
  );
}

/**
 * Ask about the reflection: same backend route as the chat panel (verse context + tafsir retrieval +
 * DeepSeek with the cross-Quran tool), with a note that the question concerns the displayed reflection.
 * The thread is kept per verse for the session; questions and answers are also logged locally.
 */
function QuestionBox({ verseKey, reflection }: { verseKey: string; reflection: Reflection }) {
  const { settings, t } = useSettings();
  const { ask, setAnswer } = useQuestions(verseKey);
  const supported = useCoverage().isCovered(verseKey);
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [turns]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy || supported === false) return;
    setText('');
    setBusy(true);
    setStatus(null);
    const logged = ask({ verseKey, reflectionId: reflection.id, question: q });
    const history = turns.filter((x) => !x.error).map((x) => ({ role: x.role, content: x.content }));
    setTurns((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '', sources: [], pending: true }]);
    const update = (patch: (a: ChatTurn) => ChatTurn) => setTurns((prev) => {
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = '';
    try {
      await streamChat({
        current_verse_id: verseKey,
        chat_history: history,
        user_message: q,
        context_note: `${t('reflectionFocusNote')} نص الفائدة: «${reflection.comment}»`,
        brief: true,
        surface: 'pulse',
        reasoning_effort: settings.reasoningEffort || undefined,
      }, (ev) => {
        if (ev.type === 'sources') update((a) => ({ ...a, sources: [...(a.sources ?? []), ...ev.sources] }));
        else if (ev.type === 'thinking') setStatus(settings.showThinking ? null : t('chatThinking'));
        else if (ev.type === 'retry') setStatus(t('chatRetrying'));
        else if (ev.type === 'reasoning') update((a) => ({ ...a, reasoning: (a.reasoning ?? '') + ev.text }));
        else if (ev.type === 'tool') setStatus(`${t('chatSearching')} «${ev.query}»`);
        else if (ev.type === 'delta') { setStatus(null); update((a) => (a.reasoningDone ? a : { ...a, reasoningDone: true })); answer += ev.text; update((a) => ({ ...a, content: a.content + ev.text })); }
        else if (ev.type === 'error') update((a) => ({ ...a, error: ev.message, pending: false, logId: ev.log_id ?? a.logId }));
        else if (ev.type === 'done') update((a) => ({ ...a, pending: false, reasoningDone: true, logId: ev.log_id }));
      }, ctrl.signal);
    } catch (err) {
      if (!ctrl.signal.aborted) update((a) => ({ ...a, error: String(err), pending: false }));
    } finally {
      setBusy(false);
      setStatus(null);
      update((a) => ({ ...a, pending: false }));
      if (answer) setAnswer(logged.id, answer);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void send(text); };
  const prompts: { key: 'promptExplain' | 'promptReason' | 'promptMeaning' | 'promptApply' }[] = [{ key: 'promptExplain' }, { key: 'promptReason' }, { key: 'promptMeaning' }, { key: 'promptApply' }];

  return (
    <div className="question" dir={settings.lang === 'ar' ? 'rtl' : 'ltr'}>
      {turns.length > 0 && (
        <div className="question__thread">
          {turns.map((turn, i) => (
            turn.role === 'user'
              ? <div key={i} className="chat-msg chat-msg--user"><div className="chat-msg__bubble">{turn.content}</div></div>
              : <AssistantTurn key={i} turn={turn} onRetry={i === turns.length - 1 ? () => { const q = turns[i - 1]?.content; setTurns((p) => p.slice(0, -2)); if (q) void send(q); } : undefined} />
          ))}
          {status && <div className="chat-status muted">{status}</div>}
          <div ref={endRef} />
        </div>
      )}
      {turns.length === 0 && (
        <div className="question__prompts">
          {prompts.map((p) => (
            <button key={p.key} type="button" className="question__prompt" onClick={() => void send(t(p.key))} disabled={busy}>{t(p.key)}</button>
          ))}
        </div>
      )}
      {supported === false && <p className="chat-panel__unsupported">{t('chatUnsupported')}</p>}
      <form className="question__form" onSubmit={submit}>
        <textarea
          className="question__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          placeholder={t('askPlaceholder')}
          rows={2}
          disabled={busy || supported === false}
          aria-label={t('askPlaceholder')}
        />
        <button type="submit" className="btn btn--small" disabled={busy || !text.trim() || supported === false}>{t('ask')}</button>
      </form>
    </div>
  );
}
