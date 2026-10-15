"use client";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { UniverseItem } from "@/lib/api";

type Opt = { value: string; label: string; detail?: string };

/** Command line with a custom suggestion list (HTML only, no native datalist). */
const CommandBar = forwardRef<HTMLInputElement, {
  universe: UniverseItem[]; onRun: (cmd: string) => string | void; message: string | null;
}>(function CommandBar({ universe, onRun, message }, ref) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = text.trim().toUpperCase();
  const sym = term.replace(/^(ADD|RM)\s+/, "");
  const opts: Opt[] = term && !/^(HELP|RESET)$/.test(term) ? universe
    .filter((u) => `${u.symbol} ${u.name}`.toUpperCase().includes(sym) && sym.length > 0)
    .sort((a, b) => Number(!a.symbol.startsWith(sym)) - Number(!b.symbol.startsWith(sym)))
    .slice(0, 8)
    .map((u) => ({ value: (/^(ADD|RM)\s/.test(term) ? term.split(/\s+/)[0].toLowerCase() + " " : "") + u.symbol, label: u.symbol, detail: u.name })) : [];

  useEffect(() => {
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, []);

  const run = (v: string) => { const err = onRun(v); setOpen(false); setActive(-1); if (!err) { setText(""); input.current?.blur(); } };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); setOpen(true);
      setActive((n) => Math.max(-1, Math.min(opts.length - 1, n + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = open && opts[active];
      if (pick) run(pick.value); else if (text.trim()) run(text.trim());
    } else if (e.key === "Escape") { setOpen(false); setActive(-1); input.current?.blur(); }
  };
  return (
    <div ref={root} className="relative" style={{ zIndex: open ? 40 : undefined }}>
      <div className="flex items-center gap-2 border border-line-soft bg-[#05080f] px-3 focus-within:border-blue">
        <span className="font-pixel text-[9px] text-blue shrink-0" aria-hidden="true">NIGHT&gt;</span>
        <input ref={input} value={text} aria-label="Command line: type a symbol, or add / rm SYMBOL" role="combobox" aria-expanded={open && opts.length > 0}
          aria-controls={`${id}-l`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} aria-autocomplete="list"
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"
          placeholder="symbol or company  ( / )" onKeyDown={keys}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setText(e.target.value); setActive(-1); setOpen(true); }}
          className="!border-0 flex-1 min-w-0 min-h-[44px] sm:min-h-[32px] bg-transparent text-[16px] sm:text-[12px] text-ink" />
        <span className={`text-[11px] truncate max-w-[40%] text-right ${message?.startsWith("!") ? "text-down" : "text-dim"}`}>{message?.replace(/^!/, "")}</span>
      </div>
      {open && opts.length > 0 && (
        <div id={`${id}-l`} role="listbox" className="absolute left-0 right-0 top-full mt-1 bg-panel border border-blue shadow-[0_12px_30px_#000b] max-h-[320px] overflow-y-auto">
          {opts.map((o, i) => (
            <button type="button" key={o.value} id={`${id}-${i}`} role="option" aria-selected={i === active} tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()} onClick={() => run(o.value)}
              className={`flex w-full items-baseline justify-between gap-3 px-3 min-h-[44px] sm:min-h-[30px] text-left border-b border-line ${i === active ? "bg-[#10243e] text-white" : "text-ink hover:bg-[#10243e]"}`}>
              <span>{o.value}</span>
              <span className="text-[10px] text-dim truncate">{o.detail}</span>
            </button>
          ))}
          <p className="px-3 py-1 text-[10px] text-faint">Not listed? Type any NSE symbol and press Enter.</p>
        </div>
      )}
    </div>
  );
});
export default CommandBar;
