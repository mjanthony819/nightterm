"use client";
import { useEffect, useRef, useState } from "react";
import { Bar, getHistory, History, Quote, Range, RANGES } from "@/lib/api";
import { chg, pc, px, tone } from "@/lib/fmt";

type Legend = { t: number; o: number; h: number; l: number; c: number; v?: number } | null;

export default function ChartPanel({ symbol, range, onRange, quote, tick, onWake }: {
  symbol: string; range: Range; onRange: (r: Range) => void; quote?: Quote; tick: number; onWake: (slow: boolean) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ chart: any; candle: any; volume: any } | null>(null);
  const [ready, setReady] = useState(false);
  const [hist, setHist] = useState<History | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legend, setLegend] = useState<Legend>(null);

  // create the chart once
  useEffect(() => {
    let dead = false;
    let cleanup = () => {};
    (async () => {
      const lc = await import("lightweight-charts");
      if (dead || !el.current) return;
      const chart = lc.createChart(el.current, {
        autoSize: true,
        layout: { background: { type: lc.ColorType.Solid, color: "#070c16" }, textColor: "#8494a9", fontFamily: "Space Mono, monospace", fontSize: 11 },
        grid: { vertLines: { color: "#0e1726" }, horzLines: { color: "#0e1726" } },
        rightPriceScale: { borderColor: "#1a2839", scaleMargins: { top: 0.06, bottom: 0.24 } },
        timeScale: { borderColor: "#1a2839", rightOffset: 4, timeVisible: false, secondsVisible: false },
        crosshair: { mode: 0, vertLine: { color: "#3aa4ff55", labelBackgroundColor: "#1663b8" }, horzLine: { color: "#3aa4ff55", labelBackgroundColor: "#1663b8" } },
        handleScale: { axisPressedMouseMove: true }, handleScroll: { vertTouchDrag: false },
      });
      const candle = chart.addCandlestickSeries({
        upColor: "#4fd1a0", downColor: "#ff6b7a", borderUpColor: "#4fd1a0", borderDownColor: "#ff6b7a",
        wickUpColor: "#4fd1a0", wickDownColor: "#ff6b7a", priceLineColor: "#3aa4ff",
      });
      const volume = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      chart.subscribeCrosshairMove((p: any) => {
        const d = p.time ? (p.seriesData.get(candle) as any) : null;
        const v = p.time ? (p.seriesData.get(volume) as any) : null;
        setLegend(d ? { t: p.time, o: d.open, h: d.high, l: d.low, c: d.close, v: v?.value } : null);
      });
      ref.current = { chart, candle, volume };
      // the panel can be display:none on mobile when the chart is built; refit once it has a real width
      let lastW = 0;
      const ro = new ResizeObserver(() => {
        const w = el.current?.clientWidth || 0;
        if (w > 0 && Math.abs(w - lastW) > 40) { chart.timeScale().fitContent(); }
        lastW = w;
      });
      ro.observe(el.current);
      setReady(true);
      cleanup = () => { ro.disconnect(); chart.remove(); ref.current = null; };
    })();
    return () => { dead = true; cleanup(); };
  }, []);

  // fetch bars
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true); setErr(null);
    const slow = setTimeout(() => onWake(true), 2500);
    getHistory(symbol, range, ctl.signal)
      .then((h) => { setHist(h); onWake(false); })
      .catch((e) => { if (e?.name !== "AbortError") { setErr(e.message === "Failed to fetch" ? "Cannot reach the API." : e.message); setHist(null); } })
      .finally(() => { clearTimeout(slow); if (!ctl.signal.aborted) setLoading(false); });
    return () => { ctl.abort(); clearTimeout(slow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range, tick]);

  // push bars into the chart
  useEffect(() => {
    if (!ready || !ref.current) return;
    const { chart, candle, volume } = ref.current;
    const bars: Bar[] = hist && hist.symbol === symbol.replace(/\.NS$/, "") ? hist.bars : [];
    candle.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
    volume.setData(bars.map((b) => ({ time: b.t, value: b.v, color: b.c >= b.o ? "#4fd1a033" : "#ff6b7a33" })));
    chart.applyOptions({ timeScale: { timeVisible: !!hist?.intraday } });
    chart.timeScale().fitContent();
  }, [hist, ready, symbol]);

  const l = legend;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b border-line shrink-0">
        <span className="text-ink font-bold">{symbol}</span>
        {quote && <>
          <span className="text-ink">{px(quote.price)}</span>
          <span className={tone(quote.change)}>{chg(quote.change)} {pc(quote.change_pct)}</span>
        </>}
        <div className="ml-auto flex gap-1" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button type="button" key={r} onClick={() => onRange(r)} aria-pressed={r === range}
              className={`min-h-[36px] sm:min-h-[24px] px-2 border text-[10px] ${r === range ? "border-blue text-ink bg-[#0f2036]" : "border-transparent text-dim hover:text-ink"}`}>{r}</button>
          ))}
        </div>
      </div>
      <div className="px-3 h-[22px] shrink-0 text-[10px] text-dim flex gap-3 items-center overflow-hidden whitespace-nowrap">
        {l ? <>
          <span>O <b className="text-ink font-normal">{px(l.o)}</b></span><span>H <b className="text-ink font-normal">{px(l.h)}</b></span>
          <span>L <b className="text-ink font-normal">{px(l.l)}</b></span><span>C <b className="text-ink font-normal">{px(l.c)}</b></span>
          {l.v != null && <span>V <b className="text-ink font-normal">{l.v.toLocaleString("en-IN")}</b></span>}
        </> : <span className="text-faint">{hist ? `${hist.bars.length} bars · ${hist.interval}${hist.stale ? " · stale (upstream down)" : ""}` : ""}</span>}
      </div>
      <div className="relative flex-1 min-h-[260px]">
        <div ref={el} className="absolute inset-0" />
        {(loading || err) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            {err ? <p className="bg-panel border border-line-soft px-4 py-3 text-down max-w-[80%] text-center">{err}</p>
              : !hist && <p className="text-faint">loading chart<span className="blink">_</span></p>}
          </div>
        )}
      </div>
    </div>
  );
}
