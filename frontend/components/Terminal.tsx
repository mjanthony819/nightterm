"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNews, getQuotes, getUniverse, NewsItem, Quote, Range, RANGES, UniverseItem } from "@/lib/api";
import { ist, pc, px, tone } from "@/lib/fmt";
import ChartPanel from "./ChartPanel";
import CommandBar from "./CommandBar";
import DetailPanel from "./DetailPanel";
import Help from "./Help";
import NewsPanel from "./NewsPanel";
import Panel from "./Panel";
import Watchlist, { SortKey } from "./Watchlist";

const SORTS: SortKey[] = ["list", "pct_desc", "pct_asc", "sym"];
const FALLBACK = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "ITC", "LT", "BHARTIARTL", "KOTAKBANK"];
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem("nt." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem("nt." + k, JSON.stringify(v)); } catch {} },
};
const norm = (s: string) => s.trim().toUpperCase().replace(/\.NS$/, "");

export default function Terminal() {
  const [universe, setUniverse] = useState<UniverseItem[]>([]);
  const [indices, setIndices] = useState<UniverseItem[]>([]);
  const [watch, setWatch] = useState<string[]>(FALLBACK);
  const [customWatch, setCustomWatch] = useState(false);
  const [selected, setSelected] = useState("RELIANCE");
  const [range, setRange] = useState<Range>("6M");
  const [focus, setFocus] = useState(1);
  const [sort, setSort] = useState<SortKey>("list");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [qLoading, setQLoading] = useState(true);
  const [qErr, setQErr] = useState<string | null>(null);
  const [asof, setAsof] = useState<number | null>(null);
  const [waking, setWaking] = useState(false);
  const [help, setHelp] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [clock, setClock] = useState<ReturnType<typeof ist> | null>(null);
  const [scope, setScope] = useState<"market" | "symbol">("market");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [nLoading, setNLoading] = useState(true);
  const [nErr, setNErr] = useState<string | null>(null);
  const [newsIdx, setNewsIdx] = useState(0);
  const cmd = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  // boot: universe + saved state
  useEffect(() => {
    const w = store.get<string[] | null>("watch", null);
    const sel = store.get<string | null>("sel", null);
    const rg = store.get<Range | null>("range", null);
    if (sel) setSelected(sel);
    if (rg && RANGES.includes(rg)) setRange(rg);
    getUniverse().then((u) => {
      setUniverse(u.nifty50); setIndices(u.indices);
      if (!w) setWatch(u.nifty50.map((x) => x.symbol));
    }).catch(() => { if (!w) setWatch(FALLBACK); });
    if (w) { setWatch(w); setCustomWatch(true); }
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) store.set("sel", selected); }, [selected]);
  useEffect(() => { if (loaded.current) store.set("range", range); }, [range]);
  useEffect(() => { if (loaded.current && customWatch) store.set("watch", watch); }, [watch, customWatch]);
  useEffect(() => { setClock(ist()); const i = setInterval(() => setClock(ist()), 1000); return () => clearInterval(i); }, []);

  // quotes polling
  const allSyms = useMemo(() => Array.from(new Set([...indices.map((i) => i.symbol), ...watch, selected])), [indices, watch, selected]);
  const symsKey = allSyms.join(",");
  useEffect(() => {
    if (!indices.length && !watch.length) return;
    let ctl: AbortController | null = null;
    let first = true;
    const load = () => {
      ctl?.abort(); ctl = new AbortController();
      const slow = setTimeout(() => setWaking(true), 2500);
      getQuotes(allSyms, ctl.signal).then((r) => {
        setQuotes((prev) => { const n = { ...prev }; r.quotes.forEach((q) => (n[q.symbol] = q)); return n; });
        setAsof(r.asof); setQErr(null); setWaking(false);
      }).catch((e) => { if (e?.name !== "AbortError") setQErr(e.message === "Failed to fetch" ? "Cannot reach the API." : e.message); })
        .finally(() => { clearTimeout(slow); first = false; setQLoading(false); });
    };
    load();
    const i = setInterval(() => { if (!document.hidden) load(); }, 60000);
    const vis = () => { if (!document.hidden && !first) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { ctl?.abort(); clearInterval(i); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symsKey, tick]);

  // news
  const [newsTick, setNewsTick] = useState(0);
  useEffect(() => { const i = setInterval(() => { if (!document.hidden) setNewsTick((t) => t + 1); }, 300000); return () => clearInterval(i); }, []);
  const newsKey = scope === "symbol" ? selected : "market";
  useEffect(() => {
    const ctl = new AbortController();
    setNLoading(true); setNErr(null);
    getNews(scope === "symbol" ? selected : undefined, ctl.signal)
      .then((r) => { setNews(r.items); setNewsIdx(0); })
      .catch((e) => { if (e?.name !== "AbortError") { setNErr(e.message === "Failed to fetch" ? "Cannot reach the API." : e.message); setNews([]); } })
      .finally(() => { if (!ctl.signal.aborted) setNLoading(false); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsKey, newsTick, tick]);

  const rows = useMemo(() => {
    const r = [...watch];
    if (sort === "sym") r.sort();
    else if (sort !== "list") r.sort((a, b) => ((quotes[b]?.change_pct ?? -99) - (quotes[a]?.change_pct ?? -99)) * (sort === "pct_desc" ? 1 : -1));
    return r;
  }, [watch, sort, quotes]);

  const movers = useMemo(() => {
    const q = watch.map((s) => quotes[s]).filter((x): x is Quote => !!x && x.change_pct != null).sort((a, b) => (b.change_pct as number) - (a.change_pct as number));
    return { up: q.slice(0, 5), down: q.slice(-5).reverse().filter((x) => (x.change_pct as number) < 0) };
  }, [watch, quotes]);

  const select = useCallback((s: string) => { setSelected(norm(s)); }, []);
  const editWatch = (next: string[]) => { setWatch(next); setCustomWatch(true); };

  const run = (raw: string): string | void => {
    const t = raw.trim();
    const [c, ...rest] = t.split(/\s+/);
    const arg = norm(rest.join(" "));
    const lc = c.toLowerCase();
    setMsg(null);
    if (lc === "help" || t === "?") { setHelp(true); return; }
    if (lc === "reset") { setCustomWatch(false); try { localStorage.removeItem("nt.watch"); } catch {} setWatch(universe.length ? universe.map((u) => u.symbol) : FALLBACK); setMsg("watchlist reset"); return; }
    if ((lc === "add" || lc === "rm") && arg) {
      if (!/^[A-Z0-9&.\-^]{1,24}$/.test(arg)) { setMsg("!bad symbol"); return "bad"; }
      if (lc === "rm") { editWatch(watch.filter((x) => x !== arg)); setMsg(`removed ${arg}`); return; }
      if (watch.includes(arg)) { setMsg(`${arg} already listed`); select(arg); return; }
      getQuotes([arg]).then((r) => {
        if (!r.quotes.length) { setMsg(`!${arg} not found`); return; }
        editWatch([...watch, arg]); select(arg); setMsg(`added ${arg}`);
      }).catch(() => setMsg("!cannot reach the API"));
      return;
    }
    const s = norm(t);
    if (!/^[A-Z0-9&.\-^]{1,24}$/.test(s)) { setMsg("!not a symbol"); return "bad"; }
    select(s); setFocus(2); setMsg(`loading ${s}`);
    setTimeout(() => setMsg(null), 2500);
  };

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (e.key === "Escape") { if (help) setHelp(false); else (document.activeElement as HTMLElement | null)?.blur(); return; }
      if (typing) return;
      const k = e.key;
      const move = (d: number) => {
        if (focus === 3) setNewsIdx((n) => Math.max(0, Math.min(news.length - 1, n + d)));
        else { const i = rows.indexOf(selected); const n = rows[Math.max(0, Math.min(rows.length - 1, (i < 0 ? (d > 0 ? -1 : rows.length) : i) + d))]; if (n) select(n); }
      };
      if (k === "/" || k === ":") { e.preventDefault(); cmd.current?.focus(); }
      else if (k === "?") { e.preventDefault(); setHelp((v) => !v); }
      else if (["1", "2", "3", "4"].includes(k)) setFocus(+k);
      else if (k === "j" || k === "ArrowDown") { e.preventDefault(); move(1); }
      else if (k === "k" || k === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (k === "Enter" && focus === 3 && t === document.body && news[newsIdx]) window.open(news[newsIdx].link, "_blank", "noopener,noreferrer");
      else if (k === "[" || k === ",") setRange((r) => RANGES[Math.max(0, RANGES.indexOf(r) - 1)]);
      else if (k === "]" || k === ".") setRange((r) => RANGES[Math.min(RANGES.length - 1, RANGES.indexOf(r) + 1)]);
      else if (k === "a" && !watch.includes(selected)) { editWatch([...watch, selected]); setMsg(`added ${selected}`); }
      else if (k === "x" && watch.includes(selected)) { editWatch(watch.filter((x) => x !== selected)); setMsg(`removed ${selected}`); }
      else if (k === "s") setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length]);
      else if (k === "r") { setTick((n) => n + 1); setMsg("refreshing"); setTimeout(() => setMsg(null), 1500); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [help, focus, rows, selected, news, newsIdx, watch]);

  const sq = quotes[selected];
  const show = (n: number) => (focus === n ? "flex" : "hidden") + " lg:flex";
  const tabs = ["watch", "chart", "news", "detail"];

  return (
    <main className="min-h-screen lg:h-screen flex flex-col px-2 sm:px-3 py-2 gap-2 mx-auto max-w-[1760px] lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <h1 className="flex items-baseline gap-3 leading-none">
          <span className="font-pixel text-[11px] text-ink">NIGHTTERM</span>
          <span className="font-doto text-blue text-lg font-bold">NSE<span className="blink">_</span></span>
        </h1>
        <div className="flex gap-x-4 gap-y-0.5 flex-wrap text-[11px]" aria-label="Indices">
          {indices.map((i) => { const q = quotes[i.symbol]; return (
            <button type="button" key={i.symbol} onClick={() => i.symbol !== "^INDIAVIX" && select(i.symbol)} className="flex gap-2 items-baseline hover:text-white">
              <span className="text-dim">{i.name}</span><span className="text-ink">{q ? px(q.price) : "-"}</span>
              <span className={q ? tone(q.change_pct) : ""}>{q ? pc(q.change_pct) : ""}</span>
            </button>); })}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <span className="border border-amber/50 text-amber px-2 py-0.5 text-[10px]">DELAYED ~15 MIN · UNOFFICIAL DATA</span>
          <span className="text-dim min-w-[110px] text-right">{clock ? `${clock.day} ${clock.text} IST` : ""}</span>
          <span className={clock?.open ? "text-up" : "text-faint"} title="Mon-Fri 09:15-15:30 IST. Ignores exchange holidays.">{clock ? `● ${clock.open ? "OPEN" : "CLOSED"}` : ""}</span>
        </div>
      </header>

      <CommandBar ref={cmd} universe={universe} onRun={run} message={msg} />

      {(waking || qErr) && (
        <div className="box px-3 py-2 text-[12px] border-amber/40 text-amber">
          {qErr ? <><span className="font-pixel text-[8px] mr-3 text-down">ERROR</span><span className="text-down">{qErr}</span></>
            : <><span className="font-pixel text-[8px] mr-3">WAKING SERVER</span>The free-tier backend sleeps when idle. First request takes up to a minute.</>}
        </div>
      )}

      <nav className="lg:hidden grid grid-cols-4 gap-1" aria-label="Panels">
        {tabs.map((t, i) => (
          <button type="button" key={t} onClick={() => setFocus(i + 1)} aria-pressed={focus === i + 1}
            className={`min-h-[44px] border text-[11px] uppercase ${focus === i + 1 ? "border-blue text-ink bg-[#0f2036]" : "border-line-soft text-dim"}`}>
            <span className="font-pixel text-[8px] mr-1.5">{i + 1}</span>{t}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 grid gap-2 lg:grid-cols-[minmax(300px,24%)_minmax(0,1fr)_minmax(300px,26%)] lg:grid-rows-[minmax(0,1fr)_minmax(0,236px)]">
        <Panel n={1} title="watchlist" focus={focus === 1} onFocus={() => setFocus(1)} className={`${show(1)} lg:row-span-2 min-h-[60vh] lg:min-h-0`}
          right={<span className="text-[10px] text-faint">{rows.length} sym</span>}>
          <Watchlist rows={rows} quotes={quotes} selected={selected} onSelect={(s) => { select(s); }} sort={sort}
            onSort={() => setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length])} loading={qLoading} />
        </Panel>
        <Panel n={2} title="chart" focus={focus === 2} onFocus={() => setFocus(2)} className={`${show(2)} min-h-[70vh] lg:min-h-0`}
          right={<span className="text-[10px] text-faint truncate">{sq?.name}</span>}>
          <ChartPanel symbol={selected} range={range} onRange={setRange} quote={sq} tick={tick} onWake={setWaking} />
        </Panel>
        <Panel n={3} title="news" focus={focus === 3} onFocus={() => setFocus(3)} className={`${show(3)} lg:row-span-2 min-h-[60vh] lg:min-h-0`}>
          <NewsPanel items={news} loading={nLoading} err={nErr} scope={scope} symbol={selected} onScope={setScope} active={focus === 3 ? newsIdx : -1} />
        </Panel>
        <Panel n={4} title="detail" focus={focus === 4} onFocus={() => setFocus(4)} className={`${show(4)} min-h-[50vh] lg:min-h-0`}
          right={<span className="text-[10px] text-faint">{asof ? `synced ${new Date(asof * 1000).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false })}` : ""}</span>}>
          <DetailPanel q={sq} movers={movers} onSelect={(s) => { select(s); setFocus(2); }} />
        </Panel>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-faint pb-1">
        <span className="hidden lg:contents">
          <span><span className="key">/</span> search</span><span><span className="key">1</span>-<span className="key">4</span> panels</span>
          <span><span className="key">j</span><span className="key">k</span> move</span><span><span className="key">[</span><span className="key">]</span> range</span>
          <span><span className="key">a</span><span className="key">x</span> add/remove</span><span><span className="key">s</span> sort</span><span><span className="key">r</span> refresh</span>
        </span>
        <button type="button" onClick={() => setHelp(true)} className="min-h-[32px] hover:text-white"><span className="key">?</span> keys</button>
        <span className="ml-auto">Educational tool, not investment advice. Data: Yahoo Finance (unofficial), news: Google News.
          {" "}<a className="hover:text-blue" href="https://github.com/mjanthony819/nightterm">source ↗</a></span>
      </footer>
      {help && <Help onClose={() => setHelp(false)} />}
    </main>
  );
}
