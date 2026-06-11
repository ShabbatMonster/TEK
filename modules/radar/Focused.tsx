"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { Address } from "@/components/tek/Address";
import { DeltaNumber } from "@/components/tek/DeltaNumber";
import { StatBlock } from "@/components/tek/StatBlock";
import { TerminalFeed } from "@/components/tek/TerminalFeed";
import { TokenIcon } from "@/components/tek/TokenIcon";
import { fmtPct, fmtUsd, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { riskFlags, type DexPair, type DexTokenMeta } from "./lib";
import { useRadarBoosts, useRadarPairs, useRadarProfiles } from "./queries";
import { useRadarStore, type RadarTab } from "./store";

/* ---------- small cells ---------- */

function Pct({ v, className }: { v: number | null | undefined; className?: string }) {
  if (v == null || !isFinite(v)) return <span className="tnum text-dim">—</span>;
  return (
    <span className={cn("tnum", v >= 0 ? "text-up" : "text-down", className)}>
      {fmtPct(v)}
    </span>
  );
}

const TABS: { id: RadarTab; label: string; key: string }[] = [
  { id: "trending", label: "TRENDING", key: "T" },
  { id: "listings", label: "NEW LISTINGS", key: "N" },
];

export default function RadarFocused() {
  const focused = useKernelStore((s) => s.focused === "radar");
  const tab = useRadarStore((s) => s.tab);
  const setTab = useRadarStore((s) => s.setTab);
  const selected = useRadarStore((s) => s.selected);
  const select = useRadarStore((s) => s.select);
  const cursor = useRadarStore((s) => s.cursor);
  const setCursor = useRadarStore((s) => s.setCursor);
  const events = useRadarStore((s) => s.events);

  const boostsQ = useRadarBoosts();
  const profilesQ = useRadarProfiles();

  const boostAddrs = useMemo(
    () => (boostsQ.data ?? []).map((b) => b.tokenAddress).slice(0, 30),
    [boostsQ.data]
  );
  const addrs = useMemo(() => {
    if (selected && !boostAddrs.includes(selected)) return [...boostAddrs, selected];
    return boostAddrs;
  }, [boostAddrs, selected]);

  const pairsQ = useRadarPairs(addrs, focused);

  const bestByAddr = useMemo(() => {
    const best: Record<string, DexPair> = {};
    for (const p of pairsQ.data ?? []) {
      if (p.chainId !== "solana") continue;
      const a = p.baseToken.address;
      if (!best[a] || (p.liquidity?.usd ?? 0) > (best[a].liquidity?.usd ?? 0)) best[a] = p;
    }
    return best;
  }, [pairsQ.data]);

  const rows = useMemo(
    () =>
      boostAddrs
        .map((a) => bestByAddr[a])
        .filter((p): p is DexPair => p != null),
    [boostAddrs, bestByAddr]
  );

  const metaByAddr = useMemo(() => {
    const m: Record<string, DexTokenMeta> = {};
    for (const t of [...(profilesQ.data ?? []), ...(boostsQ.data ?? [])])
      m[t.tokenAddress] = t;
    return m;
  }, [boostsQ.data, profilesQ.data]);

  const selectedPair = selected ? bestByAddr[selected] : undefined;

  /* T/N tab switch, ↑↓ row select */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      const st = useRadarStore.getState();
      const k = e.key.toLowerCase();
      if (k === "t") st.setTab("trending");
      else if (k === "n") st.setTab("listings");
      else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && st.tab === "trending") {
        if (rows.length === 0) return;
        e.preventDefault();
        const next = Math.min(
          rows.length - 1,
          Math.max(0, st.cursor + (e.key === "ArrowDown" ? 1 : -1))
        );
        st.setCursor(next);
        st.select(rows[next].baseToken.address);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* tabs */}
        <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "m-display rounded px-2.5 py-0.5 text-[13px] uppercase tracking-[0.2em] transition-colors",
                tab === t.id
                  ? "bg-[var(--m-glow)] text-[var(--m-accent)]"
                  : "text-dim hover:text-fg"
              )}
            >
              {t.label}
              <span className="ml-1.5 text-[9px] opacity-50">[{t.key}]</span>
            </button>
          ))}
          <div className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
            {tab === "trending"
              ? `${rows.length} contacts · dexscreener`
              : `${(profilesQ.data ?? []).length} profiles · dexscreener`}
            {(pairsQ.isFetching || boostsQ.isFetching) && (
              <span className="ml-2 text-[var(--m-accent)] tek-pulse">▮</span>
            )}
          </div>
        </div>

        {/* content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "trending" ? (
            <TrendingTable
              rows={rows}
              meta={metaByAddr}
              selected={selected}
              loading={boostsQ.isLoading || pairsQ.isLoading}
              error={(boostsQ.error ?? pairsQ.error) as Error | null}
              onPick={(addr, i) => {
                setCursor(i);
                select(addr === selected ? null : addr);
              }}
            />
          ) : (
            <ListingsList
              profiles={profilesQ.data ?? []}
              loading={profilesQ.isLoading}
              error={profilesQ.error as Error | null}
              selected={selected}
              onPick={(addr) => select(addr === selected ? null : addr)}
            />
          )}
        </div>

        {/* EVENTS feed */}
        <div className="shrink-0 border-t border-line">
          <div className="flex items-center gap-2 px-3 pt-1.5">
            <span className="m-display text-[12px] uppercase tracking-[0.25em] text-[var(--m-accent)]">
              Events
            </span>
            <span className="font-mono text-[9px] uppercase text-dim">
              spike detection · Δ5m &gt; 15% or m5 vol &gt; 30% of h1
            </span>
          </div>
          <TerminalFeed
            lines={
              events.length
                ? events
                : [{ text: "▸ sweep active — no spike events yet", tone: "dim" as const }]
            }
            showTime
            className="h-20 px-2 pb-1.5"
          />
        </div>
      </div>

      {/* INSPECTOR drawer */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected}
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="scanlines relative w-[340px] shrink-0 overflow-y-auto border-l border-line bg-cell"
          >
            <Inspector
              addr={selected}
              pair={selectedPair}
              meta={metaByAddr[selected]}
              onClose={() => select(null)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- TRENDING table ---------- */

function TrendingTable({
  rows,
  meta,
  selected,
  loading,
  error,
  onPick,
}: {
  rows: DexPair[];
  meta: Record<string, DexTokenMeta>;
  selected: string | null;
  loading: boolean;
  error: Error | null;
  onPick: (addr: string, i: number) => void;
}) {
  if (error)
    return (
      <div className="p-4 font-mono text-[10px] text-down">
        SIGNAL LOST — {error.message}
      </div>
    );
  if (loading)
    return (
      <div className="p-4 font-mono text-[10px] uppercase tracking-[0.25em] text-dim tek-pulse">
        sweeping for contacts…
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="p-4 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
        no solana contacts on scope
      </div>
    );

  return (
    <table className="w-full border-collapse font-mono text-[10px]">
      <thead className="sticky top-0 z-10 bg-cell">
        <tr className="text-left text-[8px] uppercase tracking-[0.18em] text-dim">
          <th className="py-1.5 pl-3 pr-2 font-normal">token</th>
          <th className="px-2 py-1.5 text-right font-normal">price</th>
          <th className="px-2 py-1.5 text-right font-normal">Δ5m</th>
          <th className="px-2 py-1.5 text-right font-normal">Δ1h</th>
          <th className="px-2 py-1.5 text-right font-normal">Δ24h</th>
          <th className="px-2 py-1.5 text-right font-normal">vol 24h</th>
          <th className="px-2 py-1.5 text-right font-normal">liq</th>
          <th className="px-2 py-1.5 text-right font-normal">mc/fdv</th>
          <th className="py-1.5 pl-2 pr-3 text-right font-normal">age</th>
        </tr>
        <tr>
          <th colSpan={9} className="h-px bg-line p-0" />
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => {
          const addr = p.baseToken.address;
          const active = addr === selected;
          return (
            <tr
              key={addr}
              onClick={() => onPick(addr, i)}
              className={cn(
                "cursor-pointer border-b border-line/50 transition-colors",
                active
                  ? "bg-[var(--m-glow)]"
                  : "odd:bg-cell2/30 hover:bg-cell2/70"
              )}
            >
              <td className="py-1 pl-3 pr-2">
                <div className="flex items-center gap-1.5">
                  <TokenIcon
                    mint={addr}
                    src={p.info?.imageUrl ?? meta[addr]?.icon}
                    symbol={p.baseToken.symbol}
                    size={14}
                  />
                  <span className={cn("font-bold", active ? "text-[var(--m-accent)]" : "text-fg")}>
                    {p.baseToken.symbol}
                  </span>
                </div>
              </td>
              <td className="px-2 py-1 text-right">
                <DeltaNumber
                  value={p.priceUsd ? parseFloat(p.priceUsd) : null}
                  format={fmtUsd}
                  className="text-fg/90"
                />
              </td>
              <td className="px-2 py-1 text-right"><Pct v={p.priceChange?.m5} /></td>
              <td className="px-2 py-1 text-right"><Pct v={p.priceChange?.h1} /></td>
              <td className="px-2 py-1 text-right"><Pct v={p.priceChange?.h24} /></td>
              <td className="tnum px-2 py-1 text-right text-fg/80">{fmtUsd(p.volume?.h24)}</td>
              <td className="tnum px-2 py-1 text-right text-fg/80">{fmtUsd(p.liquidity?.usd)}</td>
              <td className="tnum px-2 py-1 text-right text-fg/80">
                {fmtUsd(p.marketCap ?? p.fdv)}
              </td>
              <td className="tnum py-1 pl-2 pr-3 text-right text-dim">
                {p.pairCreatedAt ? timeAgo(p.pairCreatedAt) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------- NEW LISTINGS ---------- */

function ListingsList({
  profiles,
  loading,
  error,
  selected,
  onPick,
}: {
  profiles: DexTokenMeta[];
  loading: boolean;
  error: Error | null;
  selected: string | null;
  onPick: (addr: string) => void;
}) {
  if (error)
    return (
      <div className="p-4 font-mono text-[10px] text-down">
        SIGNAL LOST — {error.message}
      </div>
    );
  if (loading)
    return (
      <div className="p-4 font-mono text-[10px] uppercase tracking-[0.25em] text-dim tek-pulse">
        decoding profiles…
      </div>
    );
  if (profiles.length === 0)
    return (
      <div className="p-4 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
        no fresh solana profiles
      </div>
    );

  return (
    <div className="divide-y divide-line/50">
      {profiles.map((t) => (
        <div
          key={t.tokenAddress}
          onClick={() => onPick(t.tokenAddress)}
          className={cn(
            "cursor-pointer px-3 py-2 transition-colors",
            t.tokenAddress === selected ? "bg-[var(--m-glow)]" : "hover:bg-cell2/70"
          )}
        >
          <div className="flex items-center gap-2">
            <TokenIcon mint={t.tokenAddress} src={t.icon} size={16} />
            <Address addr={t.tokenAddress} chars={5} className="text-[10px] text-fg" />
            {t.url && (
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto font-mono text-[9px] uppercase text-dim hover:text-[var(--m-accent)]"
              >
                dexscreener ↗
              </a>
            )}
          </div>
          {t.description && (
            <p className="mt-1 line-clamp-2 pl-6 font-mono text-[9.5px] leading-snug text-dim">
              {t.description}
            </p>
          )}
          {t.links && t.links.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5 pl-6">
              {t.links.slice(0, 4).map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded bg-cell2 px-1.5 py-0.5 font-mono text-[8px] uppercase text-fg/60 hover:text-[var(--m-accent)]"
                >
                  {l.label ?? l.type ?? "link"}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- INSPECTOR ---------- */

function Inspector({
  addr,
  pair,
  meta,
  onClose,
}: {
  addr: string;
  pair?: DexPair;
  meta?: DexTokenMeta;
  onClose: () => void;
}) {
  const symbol = pair?.baseToken.symbol ?? addr.slice(0, 4);
  const flags = pair ? riskFlags(pair) : [];

  return (
    <div className="flex min-h-full flex-col p-3">
      {/* header */}
      <div className="flex items-center gap-2">
        <TokenIcon mint={addr} src={pair?.info?.imageUrl ?? meta?.icon} symbol={symbol} size={22} />
        <div className="min-w-0">
          <div className="m-display truncate text-lg leading-none text-[var(--m-accent)]">
            {symbol}
          </div>
          <div className="truncate font-mono text-[9px] text-dim">
            {pair?.baseToken.name ?? "unknown contact"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded border border-line px-1.5 font-mono text-[11px] text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          title="Close inspector"
        >
          ×
        </button>
      </div>

      <div className="mt-1.5">
        <Address addr={addr} chars={6} className="text-[10px] text-fg/80" />
      </div>

      {!pair ? (
        <div className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-dim tek-pulse">
          acquiring target…
        </div>
      ) : (
        <>
          {/* price */}
          <div className="mt-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
              price usd · {pair.dexId ?? "dex"}
            </div>
            <DeltaNumber
              value={pair.priceUsd ? parseFloat(pair.priceUsd) : null}
              format={fmtUsd}
              className="m-display text-3xl text-[var(--m-accent)]"
            />
          </div>

          {/* timeframe deltas */}
          <div className="mt-3 grid grid-cols-4 gap-1 rounded border border-line p-2">
            {([
              ["5M", pair.priceChange?.m5],
              ["1H", pair.priceChange?.h1],
              ["6H", pair.priceChange?.h6],
              ["24H", pair.priceChange?.h24],
            ] as const).map(([label, v]) => (
              <div key={label} className="text-center">
                <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-dim">
                  Δ{label}
                </div>
                <Pct v={v} className="font-mono text-[11px] font-bold" />
              </div>
            ))}
          </div>

          {/* stat blocks */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <StatBlock label="vol 24h" value={fmtUsd(pair.volume?.h24)} sub={`1h ${fmtUsd(pair.volume?.h1)} · 5m ${fmtUsd(pair.volume?.m5)}`} />
            <StatBlock label="liquidity" value={fmtUsd(pair.liquidity?.usd)} />
            <StatBlock label="fdv" value={fmtUsd(pair.fdv)} sub={pair.marketCap != null ? `mcap ${fmtUsd(pair.marketCap)}` : undefined} />
            <StatBlock
              label="pair age"
              value={pair.pairCreatedAt ? timeAgo(pair.pairCreatedAt) : "—"}
              sub={
                pair.pairCreatedAt
                  ? new Date(pair.pairCreatedAt).toLocaleDateString("en-US")
                  : undefined
              }
            />
          </div>

          {/* risk heuristics */}
          <div className="mt-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
              risk heuristics
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {flags.length === 0 ? (
                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase text-dim">
                  no flags · still dyor
                </span>
              ) : (
                flags.map((f) => (
                  <span
                    key={f}
                    className="rounded border border-warn/50 bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-warn"
                  >
                    ⚠ {f}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* description from boost/profile meta */}
          {meta?.description && (
            <p className="mt-3 line-clamp-4 font-mono text-[9.5px] leading-snug text-dim">
              {meta.description}
            </p>
          )}

          {/* links */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pair.url && (
              <a
                href={pair.url}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-line px-2 py-1 font-mono text-[9px] uppercase text-fg/70 hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
              >
                dexscreener ↗
              </a>
            )}
            {(meta?.links ?? []).slice(0, 3).map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-line px-2 py-1 font-mono text-[9px] uppercase text-fg/70 hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
              >
                {l.label ?? l.type ?? "link"} ↗
              </a>
            ))}
          </div>
        </>
      )}

      {/* actions */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <button
          onClick={() => bus.emit("token:swap", { outputMint: addr, symbol })}
          className="rounded border border-[var(--m-accent)] bg-[var(--m-glow)] py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--m-accent)] transition-colors hover:bg-[var(--m-accent)] hover:text-black"
        >
          Swap
        </button>
        <button
          onClick={() =>
            bus.emit("oracle:ask", {
              prompt: `Analyze Solana token ${symbol} (${addr}). Risk profile?`,
            })
          }
          className="rounded border border-line py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg/80 transition-colors hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
        >
          Ask Oracle
        </button>
      </div>
    </div>
  );
}
