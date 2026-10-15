"use client";
import type { Quote } from "@/lib/api";
import { chg, clock, pc, px, tone, vol } from "@/lib/fmt";

function RangeBar({ lo, hi, v, label }: { lo: number | null; hi: number | null; v: number; label: string }) {
  if (lo == null || hi == null || hi <= lo) return <div className="text-faint">{label} -</div>;
  const p = Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px] text-faint"><span>{px(lo)}</span><span className="cap !text-[7px]">{label}</span><span>{px(hi)}</span></div>
      <div className="relative h-[6px] bg-[#0d1624] mt-1"><i className="absolute top-[-2px] w-[2px] h-[10px] bg-blue" style={{ left: `calc(${p}% - 1px)` }} /></div>
    </div>
  );
}

export default function DetailPanel({ q, movers, onSelect }: {
  q: Quote | undefined; movers: { up: Quote[]; down: Quote[] }; onSelect: (s: string) => void;
}) {
  const list = (title: string, xs: Quote[]) => (
    <div className="min-w-0">
      <p className="cap mb-1">{title}</p>
      {xs.map((m) => (
        <button type="button" key={m.symbol} onClick={() => onSelect(m.symbol)} className="flex justify-between w-full min-h-[28px] items-center hover:text-white">
          <span className="text-ink">{m.symbol}</span><span className={tone(m.change_pct)}>{pc(m.change_pct)}</span>
        </button>
      ))}
      {!xs.length && <p className="text-faint">-</p>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] gap-x-5 gap-y-4 p-3 overflow-y-auto min-h-0">
      <div className="min-w-0">
        {q ? (
          <>
            <p className="text-ink truncate">{q.name}</p>
            <p className="mt-1"><span className="font-doto text-2xl font-bold text-ink">{px(q.price)}</span>{" "}
              <span className={tone(q.change)}>{chg(q.change)} ({pc(q.change_pct)})</span></p>
            <div className="mt-3 space-y-3">
              <RangeBar lo={q.day_low} hi={q.day_high} v={q.price} label="day range" />
              <RangeBar lo={q.wk52_low} hi={q.wk52_high} v={q.price} label="52w range" />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
              <dt className="text-faint">prev close</dt><dd className="text-right text-ink">{px(q.prev_close)}</dd>
              <dt className="text-faint">volume</dt><dd className="text-right text-ink">{vol(q.volume)}</dd>
              <dt className="text-faint">last tick</dt><dd className="text-right text-ink">{clock(q.time)}</dd>
            </dl>
          </>
        ) : <p className="text-faint">No quote yet.</p>}
      </div>
      {list("top gainers", movers.up)}
      {list("top losers", movers.down)}
    </div>
  );
}
