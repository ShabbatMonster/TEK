"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** mint -> deterministic hue for the fallback identicon */
function hueOf(mint: string): number {
  let h = 0;
  for (let i = 0; i < mint.length; i++) h = (h * 31 + mint.charCodeAt(i)) % 360;
  return h;
}

export function TokenIcon({
  mint,
  src,
  symbol,
  size = 18,
  className,
}: {
  mint: string;
  src?: string | null;
  symbol?: string;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={symbol ?? mint.slice(0, 4)}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className={cn("shrink-0 rounded-full bg-cell2 object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = hueOf(mint);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-mono font-bold uppercase",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 60% 28%), hsl(${(hue + 60) % 360} 60% 18%))`,
        color: `hsl(${hue} 80% 70%)`,
      }}
    >
      {(symbol ?? mint).slice(0, 1)}
    </div>
  );
}
