"use client";

export function Sparkline({
  data,
  width = 64,
  height = 18,
  stroke,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (!data || data.length < 2) {
    return <span className="font-mono text-[9px] text-dim">·····</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={pts}
        fill="none"
        stroke={stroke ?? (up ? "var(--color-up)" : "var(--color-down)")}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
