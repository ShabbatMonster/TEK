"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Number that flashes green/red when it changes — the Bloomberg tick. */
export function DeltaNumber({
  value,
  format,
  className,
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  className?: string;
}) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value == null) return;
    if (prev.current != null && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  if (value == null) return <span className={cn("text-dim", className)}>—</span>;

  return (
    <span
      key={flash ? `${value}-${flash}` : undefined}
      className={cn(
        "tnum",
        flash === "up" && "flash-up",
        flash === "down" && "flash-down",
        className
      )}
    >
      {format ? format(value) : value.toLocaleString()}
    </span>
  );
}
