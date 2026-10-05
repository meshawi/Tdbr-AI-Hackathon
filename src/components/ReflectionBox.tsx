import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuestions } from '../hooks/useQuestions';
import { useSettings } from '../hooks/useSettings';
import { num } from '../lib/format';
import type { Reflection } from '../lib/types';
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
        <QuestionBox verseKey={verseKey} reflectionId={r.id} />
      </div>
    </aside>
  );
}

/** Lets the reader ask about the reflection. For now the question is logged and listed here; AI answers come later. */
function QuestionBox({ verseKey, reflectionId }: { verseKey: string; reflectionId: number }) {
  const { settings, t } = useSettings();
  const { questions, ask, remove } = useQuestions(verseKey);
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    ask({ verseKey, reflectionId, question: q });
    setText('');
  };

  return (
    <div className="question" dir={settings.lang === 'ar' ? 'rtl' : 'ltr'}>
      <form className="question__form" onSubmit={submit}>
        <textarea
          className="question__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          placeholder={t('askPlaceholder')}
          rows={2}
          aria-label={t('askPlaceholder')}
        />
        <button type="submit" className="btn btn--small" disabled={!text.trim()}>{t('ask')}</button>
      </form>
      {questions.length > 0 && (
        <ul className="question__list">
          {questions.map((q) => (
            <li key={q.id} className="question__item">
              <span className="question__text">{q.question}</span>
              <span className="question__meta muted">{t('questionPending')}</span>
              <button className="icon-btn question__remove" onClick={() => remove(q.id)} aria-label={t('dismiss')}><CloseIcon width={14} height={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
