"use client";

import { useEffect, useMemo } from "react";
import { DeltaNumber } from "@/components/tek/DeltaNumber";
import { toast } from "@/kernel/toast";
import { cn } from "@/lib/cn";
import { fmtUsd } from "@/lib/format";
import {
  MARKET_META,
  PERP_MARKETS,
  bookStats,
  estLiqPrice,
  fmtFixed,
  type L2Book,
  type Level,
  type PerpMarket,
} from "./lib";
import { useL2Book, useRecordBook } from "./queries";
import { usePerpsStore } from "./store";

/* same pattern as kernel/HotkeyManager.tsx */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

const ASK_BAR = "rgba(255, 77, 94, 0.12)";
const BID_BAR = "rgba(47, 217, 123, 0.12)";

/* ---------------------------------- header ---------------------------------- */

function MarketHeader({
  market,
  book,
  degraded,
}: {
  market: PerpMarket;
  book: L2Book | null;
  degraded: boolean;
}) {
  const setMarket = usePerpsStore((s) => s.setMarket);
  const stats = book ? bookStats(book) : null;
  const meta = MARKET_META[market];

  return (
    <header className="shrink-0 border-b border-line">
      <div className="flex items-stretch justify-between">
        <div className="flex">
          {PERP_MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={cn(
                "border-r border-line px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em]",
                m === market
                  ? "bg-[var(--m-glow)] text-[var(--m-accent)]"
                  : "text-dim hover:text-fg"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {degraded && (
          <div className="flex items-center border-l border-down/40 bg-down/10 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-down tek-pulse">
            feed degraded — last good book
          </div>
        )}
      </div>

      <div className="grid grid-cols-[auto_auto_auto_auto_1fr] items-end gap-x-6 border-t border-line px-3 py-2">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim">oracle</div>
          <DeltaNumber
            value={book?.oraclePrice}
            format={(n) => fmtFixed(n, meta.priceDp)}
            className="m-display text-2xl font-bold leading-none text-[var(--m-accent)]"
          />
        </div>
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim">mark</div>
          <DeltaNumber
            value={book?.markPrice}
            format={(n) => fmtFixed(n, meta.priceDp)}
            className="font-mono text-sm font-bold text-fg"
          />
        </div>
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim">mid</div>
          <DeltaNumber
            value={stats?.mid}
            format={(n) => fmtFixed(n, meta.priceDp)}
            className="font-mono text-sm font-bold text-fg"
          />
        </div>
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim">spread</div>
          <div className="font-mono text-sm font-bold text-fg">
            <span className="tnum">{fmtFixed(stats?.spread, meta.priceDp)}</span>
            <span className="tnum ml-1.5 text-[10px] text-dim">
              {stats?.spreadBps != null ? `${stats.spreadBps.toFixed(1)}bps` : "—"}
            </span>
          </div>
        </div>
        <div className="justify-self-end font-mono text-[8px] uppercase tracking-[0.2em] text-dim">
          dlob.drift.trade · l2 · {book ? `upd ${new Date(book.ts).toLocaleTimeString("en-US", { hour12: false })}` : "connecting"}
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------- ladder ---------------------------------- */

function LadderRow({
  level,
  cum,
  maxCum,
  side,
  priceDp,
  sizeDp,
  onPick,
}: {
  level: Level;
  cum: number;
  maxCum: number;
  side: "ask" | "bid";
  priceDp: number;
  sizeDp: number;
  onPick: (price: number) => void;
}) {
  const pct = maxCum > 0 ? Math.min(100, (cum / maxCum) * 100) : 0;
  return (
    <button
      onClick={() => onPick(level.price)}
      title="set limit price"
      className="grid h-[19px] w-full shrink-0 grid-cols-3 items-center px-2 text-left hover:bg-fg/5"
      style={{
        background: `linear-gradient(to left, ${side === "ask" ? ASK_BAR : BID_BAR} ${pct}%, transparent ${pct}%)`,
      }}
    >
      <span className={cn("tnum font-mono text-[10px] font-bold", side === "ask" ? "text-down" : "text-up")}>
        {fmtFixed(level.price, priceDp)}
      </span>
      <DeltaNumber
        value={level.size}
        format={(n) => fmtFixed(n, sizeDp)}
        className="justify-self-end font-mono text-[10px] text-fg/85"
      />
      <span className="tnum justify-self-end font-mono text-[10px] text-dim">
        {fmtFixed(cum, sizeDp)}
      </span>
    </button>
  );
}

function Ladder({
  market,
  book,
  degraded,
}: {
  market: PerpMarket;
  book: L2Book | null;
  degraded: boolean;
}) {
  const setLimitPrice = usePerpsStore((s) => s.setLimitPrice);
  const setOrderType = usePerpsStore((s) => s.setOrderType);
  const meta = MARKET_META[market];

  const { askRows, bidRows, maxCum, stats } = useMemo(() => {
    if (!book) return { askRows: [], bidRows: [], maxCum: 0, stats: null };
    let c = 0;
    const bidRows = book.bids.map((l) => ({ level: l, cum: (c += l.size) }));
    const bidMax = c;
    c = 0;
    // asks ascending → cum from spread outward, then reverse for display (best ask at bottom)
    const asksCum = book.asks.map((l) => ({ level: l, cum: (c += l.size) }));
    const askRows = [...asksCum].reverse();
    return { askRows, bidRows, maxCum: Math.max(bidMax, c), stats: bookStats(book) };
  }, [book]);

  function onPick(price: number) {
    setOrderType("limit");
    setLimitPrice(price.toFixed(meta.priceDp));
  }

  if (!book) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-dim tek-pulse">
        connecting to dlob
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
        degraded && "opacity-40 saturate-50"
      )}
    >
      {/* column headers */}
      <div className="grid shrink-0 grid-cols-3 border-b border-line px-2 py-1 font-mono text-[8px] uppercase tracking-[0.18em] text-dim">
        <span>price usd</span>
        <span className="justify-self-end">size {meta.base.toLowerCase()}</span>
        <span className="justify-self-end">cum</span>
      </div>

      {/* asks — best ask bottom-aligned against the spread row */}
      <div className="flex min-h-0 flex-col justify-end overflow-hidden">
        {askRows.map((r) => (
          <LadderRow
            key={`a-${r.level.price}`}
            level={r.level}
            cum={r.cum}
            maxCum={maxCum}
            side="ask"
            priceDp={meta.priceDp}
            sizeDp={meta.sizeDp}
            onPick={onPick}
          />
        ))}
      </div>

      {/* spread row */}
      <div className="grid shrink-0 grid-cols-3 items-center border-y border-line bg-cell2/70 px-2 py-1 font-mono text-[9px]">
        <span className="uppercase tracking-[0.18em] text-dim">
          spread{" "}
          <span className="tnum text-[var(--m-accent)]">
            {fmtFixed(stats?.spread, meta.priceDp)}
          </span>
        </span>
        <span className="tnum justify-self-end text-dim">
          {stats?.spreadBps != null ? `${stats.spreadBps.toFixed(1)}bps` : "—"}
        </span>
        <span className="tnum justify-self-end font-bold text-[var(--m-accent)]">
          {fmtFixed(stats?.mid, meta.priceDp)}
        </span>
      </div>

      {/* bids — best bid top-aligned against the spread row */}
      <div className="flex min-h-0 flex-col justify-start overflow-hidden">
        {bidRows.map((r) => (
          <LadderRow
            key={`b-${r.level.price}`}
            level={r.level}
            cum={r.cum}
            maxCum={maxCum}
            side="bid"
            priceDp={meta.priceDp}
            sizeDp={meta.sizeDp}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- ticket ---------------------------------- */

function Ticket({ market, book }: { market: PerpMarket; book: L2Book | null }) {
  const s = usePerpsStore();
  const meta = MARKET_META[market];
  const stats = book ? bookStats(book) : null;

  const size = parseFloat(s.sizeInput);
  const validSize = isFinite(size) && size > 0 ? size : null;
  const limit = parseFloat(s.limitPrice);
  const validLimit = isFinite(limit) && limit > 0 ? limit : null;

  // taker fill: long lifts the ask, short hits the bid
  const takerFill = s.side === "long" ? stats?.bestAsk : stats?.bestBid;
  const entry = s.orderType === "limit" ? validLimit : takerFill ?? stats?.mid ?? null;
  const notional = entry != null && validSize != null ? validSize * entry : null;
  const margin = notional != null ? notional / s.leverage : null;
  const liq = entry != null && validSize != null ? estLiqPrice(entry, s.leverage, s.side) : null;

  const canOpen = validSize != null && entry != null && margin != null && margin <= s.paperBalance;

  function submit() {
    if (validSize == null || entry == null) return;
    const res = s.openPosition({
      market,
      side: s.side,
      size: validSize,
      entryPrice: entry,
      leverage: s.leverage,
    });
    if (res.ok) {
      toast({
        kind: "success",
        title: `${s.side.toUpperCase()} ${validSize} ${meta.base} (paper)`,
        body: `entry ${fmtFixed(entry, meta.priceDp)} · ${s.leverage}x`,
      });
      s.setSizeInput("");
    } else {
      toast({ kind: "error", title: "Order rejected", body: res.reason ?? "could not open" });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3 font-mono">
      {/* side toggle */}
      <div className="grid grid-cols-2 border border-line">
        <button
          onClick={() => s.setSide("long")}
          className={cn(
            "py-2 text-[10px] font-bold uppercase tracking-[0.2em]",
            s.side === "long" ? "bg-up/15 text-up" : "text-dim hover:text-fg"
          )}
        >
          long [b]
        </button>
        <button
          onClick={() => s.setSide("short")}
          className={cn(
            "border-l border-line py-2 text-[10px] font-bold uppercase tracking-[0.2em]",
            s.side === "short" ? "bg-down/15 text-down" : "text-dim hover:text-fg"
          )}
        >
          short [s]
        </button>
      </div>

      {/* order type */}
      <div className="mt-2 grid grid-cols-2 border border-line">
        <button
          onClick={() => s.setOrderType("market")}
          className={cn(
            "py-1.5 text-[9px] font-bold uppercase tracking-[0.2em]",
            s.orderType === "market"
              ? "bg-[var(--m-glow)] text-[var(--m-accent)]"
              : "text-dim hover:text-fg"
          )}
        >
          market [m]
        </button>
        <button
          onClick={() => s.setOrderType("limit")}
          className={cn(
            "border-l border-line py-1.5 text-[9px] font-bold uppercase tracking-[0.2em]",
            s.orderType === "limit"
              ? "bg-[var(--m-glow)] text-[var(--m-accent)]"
              : "text-dim hover:text-fg"
          )}
        >
          limit [l]
        </button>
      </div>

      {/* limit price */}
      {s.orderType === "limit" && (
        <label className="mt-2 block">
          <span className="text-[8px] uppercase tracking-[0.2em] text-dim">
            limit price · click a ladder row
          </span>
          <input
            value={s.limitPrice}
            onChange={(e) => s.setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder={stats?.mid != null ? fmtFixed(stats.mid, meta.priceDp) : "0.00"}
            className="tnum mt-1 w-full border border-line bg-transparent px-2 py-1.5 text-right text-[12px] font-bold text-fg outline-none focus:border-[var(--m-accent)]"
          />
        </label>
      )}

      {/* size */}
      <label className="mt-2 block">
        <span className="text-[8px] uppercase tracking-[0.2em] text-dim">
          size · {meta.base.toLowerCase()}
        </span>
        <input
          value={s.sizeInput}
          onChange={(e) => s.setSizeInput(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          className="tnum mt-1 w-full border border-line bg-transparent px-2 py-1.5 text-right text-[12px] font-bold text-fg outline-none focus:border-[var(--m-accent)]"
        />
      </label>

      {/* leverage */}
      <div className="mt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[8px] uppercase tracking-[0.2em] text-dim">leverage</span>
          <span className="tnum text-[12px] font-bold text-[var(--m-accent)]">{s.leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={s.leverage}
          onChange={(e) => s.setLeverage(Number(e.target.value))}
          className="mt-1 h-1 w-full cursor-ew-resize appearance-none bg-line accent-[var(--m-accent)]"
        />
        <div className="flex justify-between text-[8px] text-dim">
          <span>1x</span>
          <span>5x</span>
          <span>10x</span>
          <span>15x</span>
          <span>20x</span>
        </div>
      </div>

      {/* previews */}
      <div className="mt-3 space-y-1 border-t border-line pt-2 text-[10px]">
        <div className="flex justify-between">
          <span className="text-dim">est. entry</span>
          <span className="tnum font-bold text-fg">
            {entry != null ? fmtFixed(entry, meta.priceDp) : "—"}
            {s.orderType === "market" && entry != null && (
              <span className="ml-1 text-[8px] text-dim">mid</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">notional</span>
          <span className="tnum font-bold text-fg">{fmtUsd(notional)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">req. margin</span>
          <span className="tnum font-bold text-[var(--m-accent)]">{fmtUsd(margin)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">
            est. liq price <span className="text-[8px]">(approx)</span>
          </span>
          <span className={cn("tnum font-bold", liq != null ? "text-down" : "text-fg")}>
            {liq != null ? fmtFixed(liq, meta.priceDp) : "—"}
          </span>
        </div>
      </div>

      {/* submit (paper) */}
      <div className="mt-auto pt-3">
        <div className="mb-1.5 flex justify-between font-mono text-[9px]">
          <span className="text-dim">paper margin</span>
          <span className="tnum font-bold text-fg">{fmtUsd(s.paperBalance)}</span>
        </div>
        <button
          onClick={submit}
          disabled={!canOpen}
          className={cn(
            "w-full py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
            !canOpen
              ? "cursor-not-allowed border border-line text-dim"
              : s.side === "long"
                ? "bg-up/20 text-up hover:bg-up/30"
                : "bg-down/20 text-down hover:bg-down/30"
          )}
        >
          {validSize == null
            ? "enter size"
            : margin != null && margin > s.paperBalance
              ? "insufficient margin"
              : `${s.side} ${meta.base} · paper`}
        </button>
        <div className="mt-1.5 text-center text-[8px] uppercase tracking-[0.18em] text-dim">
          simulated · live dlob price ·{" "}
          <a
            href="https://app.drift.trade"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--m-accent)]"
          >
            trade real at drift ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- positions blotter ---------------------------------- */

function markOf(market: PerpMarket, book: L2Book | null, lastGood?: L2Book): number | null {
  const b = book ?? lastGood ?? null;
  return b ? bookStats(b).mid : null;
}

function Positions({ activeBook }: { activeBook: L2Book | null }) {
  const positions = usePerpsStore((s) => s.positions);
  const closePosition = usePerpsStore((s) => s.closePosition);
  const balance = usePerpsStore((s) => s.paperBalance);
  const realized = usePerpsStore((s) => s.paperRealized);
  const resetPaper = usePerpsStore((s) => s.resetPaper);
  const books = usePerpsStore((s) => s.lastGoodBook);
  const activeMarket = usePerpsStore((s) => s.market);

  function liveMark(m: PerpMarket): number | null {
    return markOf(m, m === activeMarket ? activeBook : null, books[m]);
  }

  let lockedCollateral = 0;
  let uPnlTotal = 0;
  const rows = positions.map((p) => {
    const mark = liveMark(p.market);
    const dir = p.side === "long" ? 1 : -1;
    const uPnl = mark != null ? (mark - p.entryPrice) * p.size * dir : null;
    lockedCollateral += p.collateral;
    if (uPnl != null) uPnlTotal += uPnl;
    return { p, mark, uPnl };
  });
  const equity = balance + lockedCollateral + uPnlTotal;

  return (
    <div className="flex h-full min-h-0 flex-col font-mono">
      {/* account header */}
      <div className="grid shrink-0 grid-cols-4 border-b border-line bg-cell2/50 px-2 py-1.5 text-[9px]">
        <div>
          <div className="text-[7px] uppercase tracking-[0.15em] text-dim">equity</div>
          <DeltaNumber value={equity} format={fmtUsd} className="font-bold text-fg" />
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.15em] text-dim">free</div>
          <span className="tnum font-bold text-fg">{fmtUsd(balance)}</span>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.15em] text-dim">u.pnl</div>
          <DeltaNumber
            value={uPnlTotal}
            format={(n) => `${n >= 0 ? "+" : ""}${fmtUsd(n)}`}
            className={cn("font-bold", uPnlTotal >= 0 ? "text-up" : "text-down")}
          />
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.15em] text-dim">realized</div>
          <span className={cn("tnum font-bold", realized >= 0 ? "text-up" : "text-down")}>
            {realized >= 0 ? "+" : ""}
            {fmtUsd(realized)}
          </span>
        </div>
      </div>

      {/* positions */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.25em] text-dim">
            no open positions
          </div>
        ) : (
          rows.map(({ p, mark, uPnl }) => {
            const meta = MARKET_META[p.market];
            const pnlPct =
              uPnl != null && p.collateral > 0 ? (uPnl / p.collateral) * 100 : null;
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-line/60 px-2 py-1.5 text-[9px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-bold uppercase",
                        p.side === "long" ? "text-up" : "text-down"
                      )}
                    >
                      {p.side === "long" ? "▲" : "▼"} {meta.base}
                    </span>
                    <span className="text-dim">{p.leverage}x</span>
                    <span className="tnum text-fg/80">
                      {fmtFixed(p.size, meta.sizeDp)} @ {fmtFixed(p.entryPrice, meta.priceDp)}
                    </span>
                  </div>
                  <div className="tnum mt-0.5 flex gap-2 text-[8px] text-dim">
                    <span>mark {mark != null ? fmtFixed(mark, meta.priceDp) : "—"}</span>
                    <span className="text-down/70">liq {fmtFixed(p.liqPrice, meta.priceDp)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <DeltaNumber
                      value={uPnl}
                      format={(n) => `${n >= 0 ? "+" : ""}${fmtUsd(n)}`}
                      className={cn(
                        "block font-bold",
                        (uPnl ?? 0) >= 0 ? "text-up" : "text-down"
                      )}
                    />
                    {pnlPct != null && (
                      <span
                        className={cn(
                          "tnum text-[8px]",
                          pnlPct >= 0 ? "text-up/70" : "text-down/70"
                        )}
                      >
                        {pnlPct >= 0 ? "+" : ""}
                        {pnlPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const mk = liveMark(p.market);
                      if (mk != null) closePosition(p.id, mk);
                    }}
                    className="border border-line px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
                  >
                    close
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={resetPaper}
        className="shrink-0 border-t border-line py-1 text-center text-[8px] uppercase tracking-[0.2em] text-dim hover:text-down"
        title="Reset paper account to $10,000"
      >
        reset paper account
      </button>
    </div>
  );
}

/* ---------------------------------- bottom strip ---------------------------------- */

function StripCell({ market, active }: { market: PerpMarket; active: boolean }) {
  const q = useL2Book(market, 10_000);
  useRecordBook(market, q.data);
  const lastGood = usePerpsStore((s) => s.lastGoodBook[market]);
  const setMarket = usePerpsStore((s) => s.setMarket);
  const meta = MARKET_META[market];
  const book = q.data ?? lastGood ?? null;
  const stats = book ? bookStats(book) : null;

  return (
    <button
      onClick={() => setMarket(market)}
      className={cn(
        "flex items-baseline gap-3 border-r border-line px-3 py-1.5 text-left font-mono last:border-r-0 hover:bg-fg/5",
        active && "bg-[var(--m-glow)]"
      )}
    >
      <span
        className={cn(
          "text-[9px] font-bold uppercase tracking-[0.15em]",
          active ? "text-[var(--m-accent)]" : "text-dim"
        )}
      >
        {meta.base}
      </span>
      <DeltaNumber
        value={stats?.mid}
        format={(n) => fmtFixed(n, meta.priceDp)}
        className="text-[11px] font-bold text-fg"
      />
      <span className="tnum text-[9px] text-dim">
        {stats?.spreadBps != null ? `${stats.spreadBps.toFixed(1)}bps` : "—"}
      </span>
      <span className="tnum ml-auto text-[9px]">
        <span className="text-up">{fmtFixed(stats?.bestBid, meta.priceDp)}</span>
        <span className="mx-1 text-dim">/</span>
        <span className="text-down">{fmtFixed(stats?.bestAsk, meta.priceDp)}</span>
      </span>
    </button>
  );
}

/* ---------------------------------- root ---------------------------------- */

export default function PerpsFocused() {
  const market = usePerpsStore((s) => s.market);
  const lastGood = usePerpsStore((s) => s.lastGoodBook[market]);

  const hydratePaper = usePerpsStore((s) => s.hydratePaper);
  useEffect(() => hydratePaper(), [hydratePaper]);

  const q = useL2Book(market, 2_000);
  useRecordBook(market, q.data);

  const book = q.data ?? lastGood ?? null;
  const degraded = q.errorUpdatedAt > q.dataUpdatedAt;

  /* module-scope hotkeys: B/S side, M/L order type */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const st = usePerpsStore.getState();
      switch (e.key.toLowerCase()) {
        case "b":
          st.setSide("long");
          break;
        case "s":
          st.setSide("short");
          break;
        case "m":
          st.setOrderType("market");
          break;
        case "l":
          st.setOrderType("limit");
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--m-accent2)]/40">
      <MarketHeader market={market} book={book} degraded={degraded} />

      {q.error != null && !book && (
        <div className="border-b border-down/40 bg-down/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-down">
          {(q.error as Error).message}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-h-0 border-r border-line">
          <Ladder market={market} book={book} degraded={degraded} />
        </div>
        <div className="grid min-h-0 grid-rows-[auto_minmax(120px,40%)] border-l border-line">
          <div className="min-h-0 overflow-y-auto">
            <Ticket market={market} book={book} />
          </div>
          <div className="min-h-0 border-t border-line">
            <Positions activeBook={book} />
          </div>
        </div>
      </div>

      <footer className="grid shrink-0 grid-cols-3 border-t border-line">
        {PERP_MARKETS.map((m) => (
          <StripCell key={m} market={m} active={m === market} />
        ))}
      </footer>
    </div>
  );
}
