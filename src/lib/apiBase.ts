/** Base URL of the assistant/retrieval API. Empty = same origin (dev proxy or production reverse proxy). */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
