"use client";

import { DeltaNumber } from "@/components/tek/DeltaNumber";
import { useKernelStore } from "@/kernel/store";
import { cn } from "@/lib/cn";
import {
  MARKET_META,
  PERP_MARKETS,
  bookStats,
  fmtFixed,
  type L2Book,
  type PerpMarket,
} from "./lib";
import { useL2Book, useRecordBook } from "./queries";
import { usePerpsStore } from "./store";

const AMBIENT_INTERVAL = 10_000;

function useAmbientBook(market: PerpMarket): L2Book | null {
  const q = useL2Book(market, AMBIENT_INTERVAL);
  useRecordBook(market, q.data);
  const lastGood = usePerpsStore((s) => s.lastGoodBook[market]);
  return q.data ?? lastGood ?? null;
}

function MarkRow({ market, book, big }: { market: PerpMarket; book: L2Book | null; big: boolean }) {
  const meta = MARKET_META[market];
  const stats = book ? bookStats(book) : null;
  const price = book?.oraclePrice ?? stats?.mid ?? null;

  return (
    <div className="flex items-baseline gap-2 font-mono">
      <span className={cn("font-bold uppercase", big ? "w-9 text-[11px] text-fg" : "w-9 text-[10px] text-fg/80")}>
        {meta.base}
      </span>
      <DeltaNumber
        value={price}
        format={(n) => fmtFixed(n, meta.priceDp)}
        className={cn(
          "font-bold",
          big ? "m-display text-2xl text-[var(--m-accent)]" : "text-[12px] text-fg"
        )}
      />
      <span className="tnum ml-auto text-[9px] text-dim">
        {stats?.spreadBps != null ? `${stats.spreadBps.toFixed(1)}bps` : book ? "—" : "···"}
      </span>
    </div>
  );
}

function MicroBook({ market, book }: { market: PerpMarket; book: L2Book | null }) {
  const meta = MARKET_META[market];
  if (!book) {
    return <div className="font-mono text-[9px] text-dim tek-pulse">awaiting dlob feed…</div>;
  }
  const bids = book.bids.slice(0, 3);
  const asks = book.asks.slice(0, 3);
  const max = Math.max(...bids.map((l) => l.size), ...asks.map((l) => l.size), 1e-9);

  return (
    <div className="grid grid-cols-2 gap-x-2">
      <div className="space-y-px">
        {bids.map((l) => (
          <div
            key={`b-${l.price}`}
            className="flex justify-between px-1 font-mono text-[9px]"
            style={{
              background: `linear-gradient(to left, rgba(47,217,123,0.16) ${(l.size / max) * 100}%, transparent ${(l.size / max) * 100}%)`,
            }}
          >
            <span className="tnum text-up">{fmtFixed(l.price, meta.priceDp)}</span>
            <span className="tnum text-dim">{fmtFixed(l.size, meta.sizeDp)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-px">
        {asks.map((l) => (
          <div
            key={`a-${l.price}`}
            className="flex justify-between px-1 font-mono text-[9px]"
            style={{
              background: `linear-gradient(to right, rgba(255,77,94,0.16) ${(l.size / max) * 100}%, transparent ${(l.size / max) * 100}%)`,
            }}
          >
            <span className="tnum text-dim">{fmtFixed(l.size, meta.sizeDp)}</span>
            <span className="tnum text-down">{fmtFixed(l.price, meta.priceDp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerpsAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const market = usePerpsStore((s) => s.market);
  const solDir = usePerpsStore((s) => s.tickDir["SOL-PERP"] ?? 0);

  const solBook = useAmbientBook("SOL-PERP");
  const btcBook = useAmbientBook("BTC-PERP");
  const ethBook = useAmbientBook("ETH-PERP");
  const books: Record<PerpMarket, L2Book | null> = {
    "SOL-PERP": solBook,
    "BTC-PERP": btcBook,
    "ETH-PERP": ethBook,
  };

  return (
    <button
      onClick={() => focus("perps")}
      className="flex h-full w-full flex-col p-3 text-left"
      style={{
        borderLeft: `2px solid ${
          solDir > 0 ? "var(--color-up)" : solDir < 0 ? "var(--color-down)" : "var(--color-line)"
        }`,
      }}
    >
      <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-dim">mark price grid</div>

      <div className="mt-1 space-y-1">
        {PERP_MARKETS.map((m) => (
          <MarkRow key={m} market={m} book={books[m]} big={m === "SOL-PERP"} />
        ))}
      </div>

      <div className="mt-auto border-t border-line pt-1.5">
        <div className="mb-1 flex justify-between font-mono text-[8px] uppercase tracking-[0.2em] text-dim">
          <span>{market} · top 3</span>
          <span>bid / ask</span>
        </div>
        <MicroBook market={market} book={books[market]} />
      </div>
    </button>
  );
}
