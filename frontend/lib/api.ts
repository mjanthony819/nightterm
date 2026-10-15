export const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export type Quote = {
  symbol: string; yahoo: string; name: string; price: number; prev_close: number | null;
  change: number | null; change_pct: number | null; day_high: number | null; day_low: number | null;
  wk52_high: number | null; wk52_low: number | null; volume: number | null; time: number | null;
  currency: string | null; spark: number[]; stale?: boolean;
};
export type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type History = { symbol: string; range: string; interval: string; intraday: boolean; bars: Bar[]; name: string | null; stale?: boolean };
export type NewsItem = { title: string; link: string; source: string; ts: number | null };
export type UniverseItem = { symbol: string; name: string };
export const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"] as const;
export type Range = (typeof RANGES)[number];

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(API + path, { signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `Server error ${r.status}`);
  return j;
}

const enc = encodeURIComponent;
export const getUniverse = () => get<{ nifty50: UniverseItem[]; indices: UniverseItem[] }>("/universe");
export const getQuotes = (syms: string[], signal?: AbortSignal) =>
  get<{ quotes: Quote[]; missing: string[]; asof: number }>(`/quotes?symbols=${enc(syms.join(","))}`, signal);
export const getHistory = (sym: string, range: Range, signal?: AbortSignal) =>
  get<History>(`/history?symbol=${enc(sym)}&range=${range}`, signal);
export const getNews = (sym?: string, signal?: AbortSignal) =>
  get<{ label: string; items: NewsItem[] }>(`/news${sym ? `?symbol=${enc(sym)}` : ""}`, signal);
