"use client";
import { useEffect, useRef } from "react";
import type { Quote } from "@/lib/api";
import { chg, pc, px, tone } from "@/lib/fmt";
import Spark from "./Spark";

export type SortKey = "list" | "pct_desc" | "pct_asc" | "sym";
export const SORT_LABEL: Record<SortKey, string> = { list: "%CHG", pct_desc: "%CHG ↓", pct_asc: "%CHG ↑", sym: "%CHG A-Z" };

export default function Watchlist({ rows, quotes, selected, onSelect, sort, onSort, loading }: {
  rows: string[]; quotes: Record<string, Quote>; selected: string; onSelect: (s: string) => void;
  sort: SortKey; onSort: () => void; loading: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-sel="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <>
      <div className="row !min-h-[26px] border-b border-line-soft cap shrink-0">
        <span>symbol</span><span>last</span>
        <button type="button" onClick={onSort} className="text-blue hover:text-white text-right cap" title="sort (s)">{SORT_LABEL[sort]}</button>
        <span>day</span>
      </div>
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto" role="listbox" aria-label="Watchlist">
        {rows.map((s) => {
          const q = quotes[s];
          return (
            <button type="button" key={s} role="option" aria-selected={s === selected} data-sel={s === selected} className="row" onClick={() => onSelect(s)}>
              <span className="text-ink truncate">{s}</span>
              <span className="text-ink">{q ? px(q.price) : loading ? "..." : "-"}</span>
              <span className={q ? tone(q.change_pct) : "text-faint"}>{q ? pc(q.change_pct) : ""}</span>
              {q ? <Spark data={q.spark} up={(q.change ?? 0) >= 0} /> : <span />}
            </button>
          );
        })}
        {!rows.length && <p className="p-3 text-faint">Watchlist is empty. Press <span className="key">/</span> and type a symbol.</p>}
      </div>
    </>
  );
}
