"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export interface FeedLine {
  text: string;
  tone?: "default" | "accent" | "up" | "down" | "dim" | "warn";
  ts?: number;
}

/** Autoscrolling monospace log stream. */
export function TerminalFeed({
  lines,
  className,
  showTime = false,
}: {
  lines: FeedLine[];
  className?: string;
  showTime?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={cn("overflow-y-auto font-mono text-[10px] leading-[1.7]", className)}
    >
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2 whitespace-pre-wrap break-all px-1">
          {showTime && l.ts && (
            <span className="shrink-0 text-dim">
              {new Date(l.ts).toLocaleTimeString("en-US", { hour12: false })}
            </span>
          )}
          <span
            className={cn(
              l.tone === "accent" && "text-[var(--m-accent)]",
              l.tone === "up" && "text-up",
              l.tone === "down" && "text-down",
              l.tone === "warn" && "text-warn",
              l.tone === "dim" && "text-dim",
              (!l.tone || l.tone === "default") && "text-fg/85"
            )}
          >
            {l.text}
          </span>
        </div>
      ))}
    </div>
  );
}
