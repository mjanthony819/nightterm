"use client";
const KEYS: [string, string][] = [
  ["/", "jump to the command line (symbol search)"],
  ["1 2 3 4", "focus panel: watchlist, chart, news, detail"],
  ["j / k  or  ↓ / ↑", "move through the watchlist (or news when panel 3 is focused)"],
  ["Enter", "open the highlighted headline when panel 3 is focused"],
  ["[  ]  or  ,  .", "previous / next chart range"],
  ["a / x", "add / remove the selected symbol from the watchlist"],
  ["s", "cycle watchlist sort"],
  ["r", "refresh quotes, chart and news"],
  ["?", "toggle this help"],
  ["Esc", "leave the command line, close help"],
];
export default function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#05080fcc] flex items-center justify-center p-4" onPointerDown={onClose} role="dialog" aria-label="Keyboard help">
      <div className="box max-w-[560px] w-full p-5 max-h-[90vh] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
        <p className="font-pixel text-[10px] text-ink mb-4">KEYBOARD</p>
        <dl className="space-y-2">
          {KEYS.map(([k, d]) => (
            <div key={k} className="grid grid-cols-[150px_1fr] gap-3 items-baseline"><dt className="text-blue">{k}</dt><dd>{d}</dd></div>
          ))}
        </dl>
        <p className="cap mt-5 mb-2">commands</p>
        <p><span className="text-blue">TCS</span> load a symbol. Any NSE ticker works, e.g. <span className="text-blue">IRCTC</span> or <span className="text-blue">m&amp;m</span>.</p>
        <p className="mt-1"><span className="text-blue">add SYM</span> / <span className="text-blue">rm SYM</span> edit the watchlist. <span className="text-blue">reset</span> restores NIFTY 50.</p>
        <p className="mt-4 text-faint text-[11px]">Quotes are delayed about 15 minutes. Data is unofficial (Yahoo Finance). Not investment advice. Watchlist is saved in this browser only.</p>
        <button type="button" onClick={onClose} className="mt-4 border border-line-soft px-4 min-h-[44px] sm:min-h-[30px] text-[11px] uppercase hover:border-blue hover:text-white">close</button>
      </div>
    </div>
  );
}
