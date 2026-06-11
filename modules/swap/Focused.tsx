"use client";

import { useMemo } from "react";
import { Buffer } from "buffer";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { AmountInput } from "@/components/tek/AmountInput";
import { DeltaNumber } from "@/components/tek/DeltaNumber";
import { getConnection, sendTx, SOL_MINT } from "@/lib/solana";
import { fmtNum, fmtUsd, rawToUi, uiToRaw } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSwapStore } from "./store";
import { TokenCombobox } from "./TokenCombobox";
import { buildSwapTx, getQuote } from "./lib";

function useTokenBalance(mint: string) {
  const { publicKey } = useWallet();
  return useQuery({
    queryKey: ["wallet", "balance", publicKey?.toBase58(), mint],
    queryFn: async () => {
      const conn = getConnection();
      if (mint === SOL_MINT) {
        const lamports = await conn.getBalance(publicKey!);
        return Math.max(0, lamports / 1e9 - 0.01); // keep fee dust
      }
      const res = await conn.getParsedTokenAccountsByOwner(publicKey!, {
        mint: new (await import("@solana/web3.js")).PublicKey(mint),
      });
      return res.value.reduce(
        (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
        0
      );
    },
    enabled: !!publicKey,
    refetchInterval: 30_000,
  });
}

const SLIPPAGES = [10, 50, 100, 300];

export default function SwapFocused() {
  const wallet = useWallet();
  const s = useSwapStore();
  const { data: inBalance } = useTokenBalance(s.input.id);

  const amountRaw = useMemo(
    () => (s.amount && parseFloat(s.amount) > 0 ? uiToRaw(s.amount, s.input.decimals) : "0"),
    [s.amount, s.input.decimals]
  );

  const quoteQ = useQuery({
    queryKey: ["swap", "quote", s.input.id, s.output.id, amountRaw, s.slippageBps],
    queryFn: () =>
      getQuote({
        inputMint: s.input.id,
        outputMint: s.output.id,
        amountRaw,
        slippageBps: s.slippageBps,
      }),
    enabled: amountRaw !== "0" && s.input.id !== s.output.id,
    refetchInterval: 12_000,
    retry: 1,
  });

  const quote = quoteQ.data;
  const outUi = quote ? rawToUi(quote.outAmount, s.output.decimals) : null;
  const rate = quote && parseFloat(s.amount) > 0 ? outUi! / parseFloat(s.amount) : null;
  const impact = quote ? parseFloat(quote.priceImpactPct) * 100 : null;

  async function executeSwap() {
    if (!quote || !wallet.publicKey) return;
    s.setSwapping(true);
    try {
      const b64 = await buildSwapTx(quote, wallet.publicKey.toBase58());
      const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
      await sendTx({
        tx,
        wallet,
        module: "swap",
        label: `Swap ${s.amount} ${s.input.symbol} → ${s.output.symbol}`,
      });
      s.setAmount("");
    } catch {
      /* toast already emitted by sendTx; build errors surface below */
    } finally {
      s.setSwapping(false);
    }
  }

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md">
        {/* input */}
        <div className="rounded-xl border border-line bg-cell2/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">you pay</span>
            {inBalance != null && (
              <span className="tnum font-mono text-[10px] text-dim">
                bal {fmtNum(inBalance, 4)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <TokenCombobox value={s.input} onSelect={s.setInput} />
            <AmountInput value={s.amount} onChange={s.setAmount} balance={inBalance} autoFocus />
          </div>
          {s.input.usdPrice && parseFloat(s.amount) > 0 && (
            <div className="mt-1 text-right font-mono text-[10px] text-dim">
              ≈ {fmtUsd(parseFloat(s.amount) * s.input.usdPrice)}
            </div>
          )}
        </div>

        {/* flip */}
        <div className="relative z-10 -my-2.5 flex justify-center">
          <button
            onClick={s.flip}
            className="rounded-lg border border-line bg-cell px-3 py-1 font-mono text-[12px] text-[var(--m-accent)] transition-transform hover:rotate-180 hover:border-[var(--m-accent)]"
            title="Flip pair (F)"
          >
            ⇅
          </button>
        </div>

        {/* output */}
        <div className="rounded-xl border border-line bg-cell2/50 p-4">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
            you receive
          </div>
          <div className="flex items-center gap-3">
            <TokenCombobox value={s.output} onSelect={s.setOutput} />
            <div className="tnum w-full text-right font-mono text-lg font-bold text-fg">
              {quoteQ.isFetching && !quote ? (
                <span className="text-dim tek-pulse">…</span>
              ) : outUi != null ? (
                <DeltaNumber value={outUi} format={(n) => fmtNum(n, 6)} />
              ) : (
                <span className="text-dim">0.00</span>
              )}
            </div>
          </div>
        </div>

        {/* details */}
        <div className="mt-3 space-y-1.5 rounded-xl border border-line p-3 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-dim">rate</span>
            <span className="tnum text-fg">
              {rate ? `1 ${s.input.symbol} ≈ ${fmtNum(rate, 6)} ${s.output.symbol}` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">price impact</span>
            <span className={cn("tnum", impact != null && impact > 3 ? "text-down" : impact != null && impact > 1 ? "text-warn" : "text-fg")}>
              {impact != null ? `${impact.toFixed(3)}%` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">min received</span>
            <span className="tnum text-fg">
              {quote ? `${fmtNum(rawToUi(quote.otherAmountThreshold, s.output.decimals), 6)} ${s.output.symbol}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dim">slippage</span>
            <div className="flex gap-1">
              {SLIPPAGES.map((bps) => (
                <button
                  key={bps}
                  onClick={() => s.setSlippageBps(bps)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[9px]",
                    s.slippageBps === bps
                      ? "border-[var(--m-accent)] text-[var(--m-accent)]"
                      : "border-line text-dim hover:text-fg"
                  )}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          </div>
          {/* route */}
          {quote && quote.routePlan.length > 0 && (
            <div className="flex items-center justify-between border-t border-line pt-1.5">
              <span className="text-dim">route</span>
              <div className="flex max-w-[70%] flex-wrap justify-end gap-1">
                {quote.routePlan.map((r, i) => (
                  <span key={i} className="rounded bg-cell2 px-1.5 py-0.5 text-[9px] text-[var(--m-accent)]">
                    {r.swapInfo.label ?? "AMM"}
                    {r.percent < 100 ? ` ${r.percent}%` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {quoteQ.error && (
          <div className="mt-2 rounded border border-down/40 bg-down/5 p-2 font-mono text-[10px] text-down">
            {(quoteQ.error as Error).message}
          </div>
        )}

        {/* execute */}
        <button
          disabled={!quote || !wallet.publicKey || s.swapping || (impact ?? 0) > 15}
          onClick={executeSwap}
          className={cn(
            "mt-3 w-full rounded-xl border py-3 font-mono text-[13px] font-bold uppercase tracking-[0.25em] transition-all",
            quote && wallet.publicKey && !s.swapping
              ? "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black"
              : "cursor-not-allowed border-line text-dim"
          )}
        >
          {s.swapping
            ? "SWAPPING…"
            : !wallet.publicKey
              ? "CONNECT WALLET"
              : (impact ?? 0) > 15
                ? "IMPACT TOO HIGH"
                : "EXECUTE SWAP"}
        </button>
      </div>
    </div>
  );
}
