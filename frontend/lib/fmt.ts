export const px = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "-" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const chg = (v: number | null | undefined) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${px(v)}`);
export const pc = (v: number | null | undefined) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
export const vol = (v: number | null | undefined) => {
  if (v == null) return "-";
  if (v >= 1e7) return (v / 1e7).toFixed(2) + " Cr";
  if (v >= 1e5) return (v / 1e5).toFixed(2) + " L";
  return v.toLocaleString("en-IN");
};
export const tone = (v: number | null | undefined) => (v == null || v === 0 ? "text-dim" : v > 0 ? "text-up" : "text-down");
export const ago = (ts: number | null) => {
  if (!ts) return "";
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};
/** Wall clock in IST, and a rough open/closed flag (Mon-Fri 09:15-15:30, ignores exchange holidays). */
export function ist(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(now).reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const mins = +p.hour * 60 + +p.minute;
  const weekday = !["Sat", "Sun"].includes(p.weekday);
  return { text: `${p.hour}:${p.minute}:${p.second}`, day: p.weekday, open: weekday && mins >= 555 && mins < 930 };
}
export const clock = (ts: number | null) =>
  ts ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour12: false, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts * 1000)) + " IST" : "-";
