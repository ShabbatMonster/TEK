"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenIcon } from "@/components/tek/TokenIcon";
import { fmtUsd } from "@/lib/format";
import { searchTokens, SOL_TOKEN, USDC_TOKEN, type JupToken } from "./lib";

const DEFAULTS = ["SOL", "USDC", "JUP", "BONK", "WIF", "JTO", "PYTH", "RAY"];

export function TokenCombobox({
  value,
  onSelect,
}: {
  value: JupToken;
  onSelect: (t: JupToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ["swap", "tokensearch", q || "defaults"],
    queryFn: async () => {
      if (q.trim()) return searchTokens(q.trim());
      const r = await searchTokens(DEFAULTS.join(","));
      return r.length ? r : [SOL_TOKEN, USDC_TOKEN];
    },
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-line bg-cell2 px-2.5 py-1.5 hover:border-[var(--m-accent)]"
      >
        <TokenIcon mint={value.id} src={value.icon} symbol={value.symbol} size={18} />
        <span className="font-mono text-[13px] font-bold text-fg">{value.symbol}</span>
        <span className="text-[9px] text-dim">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-40 w-72 overflow-hidden rounded-lg border border-line bg-cell2 shadow-2xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search token or paste mint…"
            className="w-full border-b border-line bg-transparent px-3 py-2 font-mono text-[12px] text-fg outline-none placeholder:text-dim"
          />
          <div className="max-h-64 overflow-y-auto p-1">
            {isFetching && (
              <div className="px-2 py-2 font-mono text-[10px] text-dim tek-pulse">searching…</div>
            )}
            {(results ?? []).slice(0, 25).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-cell"
              >
                <TokenIcon mint={t.id} src={t.icon} symbol={t.symbol} size={20} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-fg">{t.symbol}</span>
                    {t.isVerified && <span className="text-[9px] text-up">✓</span>}
                  </div>
                  <div className="truncate font-mono text-[9px] text-dim">{t.name}</div>
                </div>
                <span className="tnum ml-auto font-mono text-[10px] text-dim">
                  {t.usdPrice ? fmtUsd(t.usdPrice) : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
