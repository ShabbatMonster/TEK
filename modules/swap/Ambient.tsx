"use client";

import { useQuery } from "@tanstack/react-query";
import { DeltaNumber } from "@/components/tek/DeltaNumber";
import { StatBlock } from "@/components/tek/StatBlock";
import { TokenIcon } from "@/components/tek/TokenIcon";
import { useKernelStore } from "@/kernel/store";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSwapStore } from "./store";
import { getQuote, searchTokens } from "./lib";
import { uiToRaw, rawToUi } from "@/lib/format";

const TAPE = ["SOL", "JUP", "BONK", "WIF", "JTO", "PYTH"];

export default function SwapAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const s = useSwapStore();

  const { data: tape } = useQuery({
    queryKey: ["swap", "tape"],
    queryFn: () => searchTokens(TAPE.join(",")),
    refetchInterval: 30_000,
  });

  const { data: quote } = useQuery({
    queryKey: ["swap", "ambient-rate", s.input.id, s.output.id],
    queryFn: () =>
      getQuote({
        inputMint: s.input.id,
        outputMint: s.output.id,
        amountRaw: uiToRaw("1", s.input.decimals),
        slippageBps: 50,
      }),
    refetchInterval: 20_000,
    retry: 1,
  });

  const rate = quote ? rawToUi(quote.outAmount, s.output.decimals) : null;

  return (
    <button
      onClick={() => focus("swap")}
      className="flex h-full w-full flex-col p-3 text-left"
    >
      {/* live pair rate */}
      <div className="flex items-center gap-2">
        <TokenIcon mint={s.input.id} src={s.input.icon} symbol={s.input.symbol} size={16} />
        <span className="font-mono text-[11px] font-bold text-fg">{s.input.symbol}</span>
        <span className="text-[10px] text-dim">→</span>
        <TokenIcon mint={s.output.id} src={s.output.icon} symbol={s.output.symbol} size={16} />
        <span className="font-mono text-[11px] font-bold text-fg">{s.output.symbol}</span>
      </div>
      <div className="mt-1.5">
        <DeltaNumber
          value={rate}
          format={(n) => fmtNum(n, 4)}
          className="m-display text-2xl font-bold text-[var(--m-accent)]"
        />
        <span className="ml-2 font-mono text-[9px] uppercase text-dim">
          per {s.input.symbol}
        </span>
      </div>

      {/* price tape */}
      <div className="mt-auto space-y-1 border-t border-line pt-2">
        {(tape ?? []).slice(0, 5).map((t) => (
          <div key={t.id} className="flex items-center gap-2 font-mono text-[10px]">
            <span className="w-10 truncate font-bold text-fg/80">{t.symbol}</span>
            <span className="tnum text-dim">{fmtUsd(t.usdPrice)}</span>
            <span
              className={cn(
                "tnum ml-auto",
                (t.stats24h?.priceChange ?? 0) >= 0 ? "text-up" : "text-down"
              )}
            >
              {fmtPct(t.stats24h?.priceChange)}
            </span>
          </div>
        ))}
        {!tape && <div className="font-mono text-[10px] text-dim tek-pulse">loading tape…</div>}
      </div>
    </button>
  );
}
