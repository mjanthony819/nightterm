"use client";
import { useEffect, useRef } from "react";
import type { NewsItem } from "@/lib/api";
import { ago } from "@/lib/fmt";

export default function NewsPanel({ items, loading, err, scope, symbol, onScope, active }: {
  items: NewsItem[]; loading: boolean; err: string | null; scope: "market" | "symbol"; symbol: string;
  onScope: (s: "market" | "symbol") => void; active: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>('[data-on="true"]')?.scrollIntoView({ block: "nearest" }); }, [active]);
  const tab = (id: "market" | "symbol", label: string) => (
    <button type="button" onClick={() => onScope(id)}
      className={`px-2 min-h-[28px] border text-[10px] uppercase ${scope === id ? "border-blue text-ink" : "border-transparent text-dim hover:text-ink"}`}>{label}</button>
  );
  return (
    <>
      <div className="flex gap-1 px-2 py-1 border-b border-line shrink-0">{tab("market", "market")}{tab("symbol", symbol)}</div>
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto">
        {err && <p className="p-3 text-down">{err}</p>}
        {!err && loading && !items.length && <p className="p-3 text-faint">loading headlines<span className="blink">_</span></p>}
        {items.map((n, i) => (
          <a key={n.link} href={n.link} target="_blank" rel="noopener noreferrer" data-on={i === active}
            className={`block px-3 py-2 border-b border-[#0d1624] hover:bg-[#0b182a] ${i === active ? "bg-[#0f2036] shadow-[inset_2px_0_#3aa4ff]" : ""}`}>
            <span className="block text-ink leading-snug">{n.title}</span>
            <span className="block text-[10px] text-faint mt-0.5">{n.source}{n.source && n.ts ? " · " : ""}{ago(n.ts)}{n.ts ? " ago" : ""}</span>
          </a>
        ))}
        {!err && !loading && !items.length && <p className="p-3 text-faint">No headlines found.</p>}
      </div>
      <p className="px-3 py-1 text-[10px] text-faint border-t border-line shrink-0">Google News RSS. Headlines link to the publisher.</p>
    </>
  );
}
