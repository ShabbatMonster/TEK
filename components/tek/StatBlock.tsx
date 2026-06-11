"use client";

import { cn } from "@/lib/cn";

export function StatBlock({
  label,
  value,
  sub,
  tone,
  big,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "up" | "down" | "accent" | "dim";
  big?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
        {label}
      </div>
      <div
        className={cn(
          "tnum truncate font-mono font-bold",
          big ? "m-display text-xl" : "text-[13px]",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "accent" && "text-[var(--m-accent)]",
          tone === "dim" && "text-dim",
          !tone && "text-fg"
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate font-mono text-[9px] text-dim">{sub}</div>}
    </div>
  );
}
