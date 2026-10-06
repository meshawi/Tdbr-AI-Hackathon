import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../components/Loading';
import { renderWithCitations } from '../components/ChatAnswer';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { num } from '../lib/format';
import type { ChatSource } from '../lib/chat';
import { API_BASE } from '../lib/apiBase';

interface Summary {
  id: string; ts: string; surface: string; verse_id: string | null; brief: boolean; user_message: string; model: string | null;
  error: string | null; total_ms: number; tool_queries: string[]; source_count: number; answer_preview: string; cited: number[];
  flags: { invisible_chars_removed: number; truncated: boolean; leak_suspected: boolean; empty_answer: boolean };
}
interface TraceSource extends ChatSource {
  stage: 'verse' | 'tool'; query: string; rrf_score: number; rerank_score: number; text: string; reasoning_mentions: string[]; cited_in_answer: boolean;
}
interface Trace extends Summary {
  context: { verse_text: string; reflections: { id: number; comment: string }[]; note: string | null; retrieval_query: string; filter: { surah: number; ayah: number } | null };
  rounds: { round: number; retry?: boolean; finish_reason: string | null; tool_calls: number; reasoning_chars: number; content_chars: number }[];
  length_retry?: { reason: string; finish_reason: string | null; from_effort: string; to_effort: string } | null;
  reasoning_effort?: string; max_tokens?: number;
  reasoning: string; answer: string; sources: TraceSource[]; retrieval_ms: number; model_ms: number; history_len: number; user_message_raw: string | null; system_prompt_chars: number;
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
};

/** /ai-history: every assistant interaction; /ai-history/:id: the full trace of one, ?source=n focuses a source. */
export function AIHistoryPage() {
  const { id } = useParams();
  return id ? <TraceView id={id} /> : <HistoryList />;
}

function HistoryList() {
  const { t } = useSettings();
  const [surface, setSurface] = useState<string>('');
  const { data, loading, error } = useAsync(() => fetchJson<{ total: number; items: Summary[] }>(`${API_BASE}/api/history?limit=200${surface ? `&surface=${surface}` : ''}`), [surface]);
  useEffect(() => { document.title = `${t('aiHistory')} - ${t('appTitle')}`; }, [t]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  return (
    <main className="page history">
      <h1 className="page-title">{t('aiHistory')}</h1>
      <p className="muted">{t('aiHistoryIntro')}</p>
      <div className="seg" style={{ marginBottom: 12 }}>
        {[['', 'الكل'], ['chat', 'المحادثة'], ['pulse', 'علمتني آية'], ['redteam', 'اختبار الحماية']].map(([v, label]) => (
          <button key={v} className={surface === v ? 'is-active' : ''} onClick={() => setSurface(v)}>{label}</button>
        ))}
      </div>
      {!data.items.length && <p className="muted">{t('traceEmpty')}</p>}
      <div className="history__list">
        {data.items.map((it) => (
          <Link key={it.id} to={`/ai-history/${it.id}`} className={`history__row ${it.error || it.flags?.leak_suspected || it.flags?.empty_answer ? 'is-flagged' : ''}`}>
            <div className="history__meta muted">
              <span>{it.ts.replace('T', ' ')}</span>
              <span className="chip">{it.surface}</span>
              {it.verse_id && <span className="chip">{it.verse_id}</span>}
              {it.brief && <span className="chip">brief</span>}
              <span>{num(Math.round(it.total_ms / 100) / 10, 'ar')} ث</span>
              <span>{num(it.source_count, 'ar')} مصدر</span>
              {it.tool_queries?.length ? <span>{num(it.tool_queries.length, 'ar')} أداة</span> : null}
              {it.flags?.invisible_chars_removed ? <span className="chip chip--warn">أحرف مخفية: {num(it.flags.invisible_chars_removed, 'ar')}</span> : null}
              {it.flags?.leak_suspected && <span className="chip chip--danger">تسريب محتمل</span>}
              {it.flags?.empty_answer && <span className="chip chip--danger">إجابة فارغة</span>}
              {it.error && <span className="chip chip--danger">خطأ</span>}
            </div>
            <div className="history__q">{it.user_message}</div>
            <div className="history__a muted">{it.answer_preview || it.error}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function TraceView({ id }: { id: string }) {
  const { t } = useSettings();
  const [params] = useSearchParams();
  const focus = Number(params.get('source')) || null;
  const [showReasoning, setShowReasoning] = useState(false);
  const { data, loading, error } = useAsync(() => fetchJson<Trace>(`${API_BASE}/api/history/${id}`), [id]);
  const sources = useMemo(() => data?.sources ?? [], [data]);
  useEffect(() => {
    if (focus && data) document.getElementById(`source-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus, data]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const go = (s: ChatSource) => document.getElementById(`source-${s.n}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return (
    <main className="page trace" dir="rtl">
      <p><Link to="/ai-history">← {t('aiHistory')}</Link></p>
      <h1 className="page-title">{t('traceQuestion')}</h1>
      <div className="trace__box">{data.user_message}</div>
      {data.user_message_raw && <p className="muted">النص الأصلي قبل التنظيف ({num(data.flags.invisible_chars_removed, 'ar')} حرفًا مخفيًا أُزيل): <code>{data.user_message_raw}</code></p>}

      <h2>{t('traceAnswer')}</h2>
      <div className="trace__box trace__answer">
        {data.answer ? renderWithCitations(data.answer, sources, go) : <span className="muted">{data.error ?? t('chatEmpty')}</span>}
      </div>

      <h2>{t('traceRetrieval')} ({num(sources.length, 'ar')})</h2>
      <p className="muted">{t('traceWhyText')}</p>
      <div className="trace__sources">
        {sources.map((s) => (
          <div key={s.n} id={`source-${s.n}`} className={`trace__source ${focus === s.n ? 'is-focus' : ''} ${s.cited_in_answer ? 'is-cited' : ''}`}>
            <div className="trace__source-head">
              <strong>[{num(s.n, 'ar')}]</strong> {s.citation}
              <span className={`chip ${s.cited_in_answer ? 'chip--ok' : ''}`}>{s.cited_in_answer ? t('traceCited') : t('traceNotCited')}</span>
              <span className="chip">{s.stage === 'verse' ? t('traceStageVerse') : t('traceStageTool')}</span>
              <Link className="chip" to={`/${s.surah}?startingVerse=${s.ayah_from}`}>{t('traceOpenVerse')}</Link>
            </div>
            <div className="trace__source-meta muted">
              استعلام الاسترجاع: «{s.query}» · RRF {s.rrf_score} · reranker {s.rerank_score}{s.book_page ? ` · ص ${num(s.book_page, 'ar')}` : ''}
            </div>
            {s.reasoning_mentions?.length ? (
              <div className="trace__mentions">
                <strong>{t('traceWhy')}</strong>
                <ul>{s.reasoning_mentions.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            ) : null}
            <details>
              <summary>نص المقطع</summary>
              <div className="trace__text">{s.text}</div>
            </details>
          </div>
        ))}
      </div>

      <h2>{t('traceContext')}</h2>
      <div className="trace__box">
        {data.context.filter && <p><strong>الآية:</strong> {data.context.verse_text}</p>}
        {data.context.reflections.map((r) => <p key={r.id}><strong>فائدة «علمتني آية» #{num(r.id, 'ar')}:</strong> {r.comment}</p>)}
        {data.context.note && <p><strong>ملاحظة السياق:</strong> {data.context.note}</p>}
        <p className="muted">استعلام استرجاع الآية: «{data.context.retrieval_query}» · حجم تعليمات النظام: {num(data.system_prompt_chars, 'ar')} حرف · رسائل سابقة: {num(data.history_len, 'ar')}</p>
      </div>

      <h2>{t('traceTools')} ({num(data.tool_queries.length, 'ar')})</h2>
      <div className="trace__box">
        {data.tool_queries.length ? <ol>{data.tool_queries.map((q, i) => <li key={i}>search_other_verses(«{q}»)</li>)}</ol> : <span className="muted">لم تُستدعَ أدوات.</span>}
        <table className="trace__table"><thead><tr><th>الجولة</th><th>سبب الانتهاء</th><th>استدعاءات</th><th>أحرف التفكير</th><th>أحرف الإجابة</th></tr></thead>
          <tbody>{data.rounds.map((r, i) => <tr key={i}><td>{num(r.round, 'ar')}{r.retry ? ' (إعادة)' : ''}</td><td>{r.finish_reason ?? '-'}</td><td>{num(r.tool_calls, 'ar')}</td><td>{num(r.reasoning_chars, 'ar')}</td><td>{num(r.content_chars, 'ar')}</td></tr>)}</tbody></table>
      </div>

      <h2>{t('traceReasoning')}</h2>
      <div className="trace__box">
        <button className="btn btn--ghost" onClick={() => setShowReasoning((v) => !v)}>{showReasoning ? 'إخفاء' : 'عرض'} ({num(data.reasoning.length, 'ar')} حرف)</button>
        {showReasoning && <pre className="trace__reasoning">{data.reasoning || '—'}</pre>}
      </div>

      <h2>{t('traceMeta')}</h2>
      <div className="trace__box muted">
        <span>{data.ts.replace('T', ' ')}</span> · <span>{data.surface}</span> · <span>{data.model}</span> · <span>{data.brief ? 'brief' : 'full'}</span>{data.reasoning_effort && <span> · تفكير {data.reasoning_effort}</span>}{data.length_retry && <span className="chip chip--warn">أُعيدت المحاولة ({data.length_retry.reason}: {data.length_retry.from_effort} → {data.length_retry.to_effort})</span>} · <span>استرجاع {num(data.retrieval_ms, 'ar')} ms</span> · <span>النموذج {num(data.model_ms, 'ar')} ms</span> · <span>المجموع {num(data.total_ms, 'ar')} ms</span>
        {data.flags.leak_suspected && <span className="chip chip--danger">تسريب محتمل لتعليمات النظام</span>}
        {data.error && <div className="error">{data.error}</div>}
      </div>
    </main>
  );
}
