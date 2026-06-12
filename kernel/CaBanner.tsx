"use client";

import { useState } from "react";
import { explorerAddr } from "@/lib/solana";

const CA = "5j2FX52WzQNtiLDwGLbsm9UZP51d8tNk7Z2yWvWBPtek";

export function CaBanner() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-[var(--tek-gap)] flex shrink-0 items-center justify-center gap-2 rounded-[var(--tek-radius)] border border-line bg-cell px-3 py-1 font-mono text-[10px]">
      <span className="uppercase tracking-widest text-dim">CA</span>
      <a
        href={explorerAddr(CA)}
        target="_blank"
        rel="noreferrer"
        className="truncate text-fg hover:text-up hover:underline"
        title="View on explorer"
      >
        {CA}
      </a>
      <button
        onClick={() => {
          navigator.clipboard.writeText(CA);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="shrink-0 text-dim hover:text-fg"
        title="Copy contract address"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </div>
  );
}
