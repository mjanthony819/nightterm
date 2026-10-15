"use client";
export default function Panel({ n, title, focus, onFocus, right, className = "", children }: {
  n: number; title: string; focus: boolean; onFocus: () => void; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`box flex flex-col ${className}`} data-focus={focus} onPointerDown={onFocus} aria-label={title}>
      <header className="flex items-center gap-2 px-3 h-8 shrink-0 border-b border-line">
        <span className={`font-pixel text-[8px] px-1.5 py-1 border ${focus ? "border-blue text-blue" : "border-line-soft text-faint"}`}>{n}</span>
        <span className="cap !text-dim">{title}</span>
        <div className="ml-auto flex items-center gap-2 min-w-0">{right}</div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}
