/** Client for the backend chat route (POST /api/chat, Server-Sent Events). */

export interface ChatSource {
  n: number;
  citation: string;
  book_id: number;
  book_name: string;
  author: string | null;
  surah: number;
  surah_name: string;
  ayah_from: number;
  ayah_to: number;
  book_page: number | null;
  source_url: string | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  toolQueries?: string[];
  error?: string;
  pending?: boolean;
  /** trace id from the backend log; enables the "why this source" page */
  logId?: string;
  /** live model reasoning, shown while it thinks and collapsed once the answer starts */
  reasoning?: string;
  reasoningDone?: boolean;
}

export type ChatEvent =
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'thinking' }
  | { type: 'reasoning'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; query: string }
  | { type: 'retry'; reason: string; effort: string }
  | { type: 'error'; message: string; log_id?: string }
  | { type: 'done'; model?: string; log_id?: string };

import { API_BASE } from './apiBase';

export async function streamChat(
  body: { current_verse_id: string | null; chat_history: { role: 'user' | 'assistant'; content: string }[]; user_message: string; context_note?: string; brief?: boolean; surface?: 'chat' | 'pulse'; reasoning_effort?: string },
  onEvent: (ev: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'text/event-stream' },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
    onEvent({ type: 'error', message: detail });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try { onEvent(JSON.parse(line.slice(6)) as ChatEvent); } catch { /* ignore malformed frame */ }
      }
    }
  }
}
