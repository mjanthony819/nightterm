export default function Spark({ data, up, w = 64, h = 18 }: { data: number[]; up: boolean; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" className="block ml-auto">
      <polyline points={pts} fill="none" stroke={up ? "#4fd1a0" : "#ff6b7a"} strokeWidth="1.2" />
    </svg>
  );
}
