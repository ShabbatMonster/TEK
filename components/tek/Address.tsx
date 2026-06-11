"use client";

import { useState } from "react";
import { shortAddr } from "@/lib/format";
import { explorerAddr } from "@/lib/solana";
import { cn } from "@/lib/cn";

export function Address({
  addr,
  chars = 4,
  className,
}: {
  addr: string;
  chars?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono", className)}>
      <a
        href={explorerAddr(addr)}
        target="_blank"
        rel="noreferrer"
        className="hover:text-[var(--m-accent)] hover:underline"
        title={addr}
      >
        {shortAddr(addr, chars)}
      </a>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(addr);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-dim hover:text-fg"
        title="Copy address"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </span>
  );
}
