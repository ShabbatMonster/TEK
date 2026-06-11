"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { TokenIcon } from "@/components/tek/TokenIcon";
import { Address } from "@/components/tek/Address";
import { TerminalFeed } from "@/components/tek/TerminalFeed";
import { useKernelStore } from "@/kernel/store";
import { sendTx } from "@/lib/solana";
import { shortAddr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useIncineratorStore } from "./store";
import { IgniteButton } from "./IgniteButton";
import {
  MAX_ACCOUNTS_PER_TX,
  RENT_PER_ACCOUNT_SOL,
  chunk,
  fetchTokenMetas,
  scanTokenAccounts,
  type AccountClass,
  type BurnableAccount,
  type TokenMeta,
} from "./lib";

const CLS_CHIP: Record<AccountClass, { label: string; cls: string }> = {
  empty: { label: "EMPTY", cls: "border-up/50 text-up" },
  dust: { label: "DUST", cls: "border-warn/50 text-warn" },
  holding: { label: "HOLDING", cls: "border-line text-fg/70" },
  frozen: { label: "FROZEN", cls: "border-[#3b5bdb]/50 text-[#74a0ff]" },
};

const FROZEN_HINT =
  "Frozen by the mint's freeze authority — this account cannot be burned or closed until it is thawed. The Incinerator will never select it.";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  );
}

/* chunky rectangular gang switch */
function GangSwitch({
  label,
  count,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  count: number;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || count === 0}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 border-2 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
        count === 0 || disabled
          ? "cursor-not-allowed border-line text-dim/60"
          : on
            ? "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)]"
            : "border-line bg-cell2/60 text-fg/80 hover:border-[var(--m-accent2)]"
      )}
      style={{ borderRadius: 3 }}
    >
      <span
        className={cn(
          "inline-block h-3 w-5 border",
          on && count > 0 && !disabled
            ? "border-[var(--m-accent)] bg-[var(--m-accent)]"
            : "border-dim/60 bg-transparent"
        )}
      />
      {label}
      <span className="tnum text-dim">{count}</span>
    </button>
  );
}

export default function IncineratorFocused() {
  const wallet = useWallet();
  const owner58 = wallet.publicKey?.toBase58() ?? null;
  const queryClient = useQueryClient();
  const st = useIncineratorStore();

  /* ---------------- scan ---------------- */
  const scanQ = useQuery<BurnableAccount[]>({
    queryKey: ["incinerator", "scan", owner58],
    queryFn: () => scanTokenAccounts(wallet.publicKey!),
    enabled: !!wallet.publicKey,
    staleTime: 120_000,
  });
  const rows = useMemo(() => scanQ.data ?? [], [scanQ.data]);

  /* ---------------- symbol enrichment ---------------- */
  const mints = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mint))).sort(),
    [rows]
  );
  const metaQ = useQuery<Record<string, TokenMeta>>({
    queryKey: ["incinerator", "symbols", mints.join(",")],
    queryFn: () => fetchTokenMetas(mints),
    enabled: mints.length > 0,
    staleTime: 600_000,
  });
  const metas = metaQ.data ?? {};

  /* ---------------- derived sets ---------------- */
  const empties = useMemo(() => rows.filter((r) => r.cls === "empty"), [rows]);
  const dusts = useMemo(() => rows.filter((r) => r.cls === "dust"), [rows]);
  const holdings = useMemo(() => rows.filter((r) => r.cls === "holding"), [rows]);
  const frozen = useMemo(() => rows.filter((r) => r.cls === "frozen"), [rows]);

  const selectedRows = useMemo(
    () => rows.filter((r) => st.selected.has(r.pubkey) && !r.frozen),
    [rows, st.selected]
  );
  const burnsInCart = useMemo(
    () => selectedRows.filter((r) => BigInt(r.rawAmount) > 0n).length,
    [selectedRows]
  );
  const allEmptyOn =
    empties.length > 0 && empties.every((r) => st.selected.has(r.pubkey));
  const allDustOn =
    dusts.length > 0 && dusts.every((r) => st.selected.has(r.pubkey));
  const estReclaim = selectedRows.length * RENT_PER_ACCOUNT_SOL;
  const batchCount = Math.ceil(selectedRows.length / MAX_ACCOUNTS_PER_TX);

  /* ---------------- holding safety rail ---------------- */
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  /* ---------------- bus pre-selection (token:burn) ---------------- */
  useEffect(() => {
    if (!st.pendingBurnMint || rows.length === 0) return;
    // auto-arm only empty/dust; holdings keep the type-to-confirm rail
    const matches = rows.filter((r) => r.mint === st.pendingBurnMint && !r.frozen);
    const safe = matches.filter((r) => r.cls === "empty" || r.cls === "dust");
    const held = matches.length - safe.length;
    if (safe.length > 0) {
      st.setMany(safe.map((r) => r.pubkey), true);
      st.pushFeed({
        text: `BUS → token:burn → ${safe.length} ACCOUNT(S) OF ${shortAddr(st.pendingBurnMint)} ARMED`,
        tone: "warn",
        ts: Date.now(),
      });
    }
    if (held > 0) {
      st.pushFeed({
        text: `BUS → token:burn → ${held} HOLDING ACCOUNT(S) SKIPPED — confirm manually to arm`,
        tone: "dim",
        ts: Date.now(),
      });
    }
    st.setPendingBurnMint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.pendingBurnMint, rows]);

  /* ---------------- selection ---------------- */
  const requestToggle = useCallback(
    (r: BurnableAccount) => {
      if (r.frozen) return;
      const sel = useIncineratorStore.getState();
      if (sel.burning) return;
      if (sel.selected.has(r.pubkey)) {
        sel.toggle(r.pubkey);
        return;
      }
      if (r.cls === "holding") {
        // safety rail: typing the first 4 chars of the mint is required
        setConfirmFor(r.pubkey);
        setConfirmText("");
        return;
      }
      sel.toggle(r.pubkey);
    },
    []
  );

  /* ---------------- module hotkeys: X toggle hovered, E all empty ---------------- */
  const hoverRef = useRef<string | null>(null);
  const rowsRef = useRef<BurnableAccount[]>(rows);
  rowsRef.current = rows;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (useKernelStore.getState().focused !== "incinerator") return;
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "e") {
        e.preventDefault();
        const all = rowsRef.current.filter((r) => r.cls === "empty");
        if (all.length === 0) return;
        const sel = useIncineratorStore.getState();
        const everyOn = all.every((r) => sel.selected.has(r.pubkey));
        sel.setMany(all.map((r) => r.pubkey), !everyOn);
      } else if (k === "x") {
        e.preventDefault();
        const pk = hoverRef.current;
        if (!pk) return;
        const row = rowsRef.current.find((r) => r.pubkey === pk);
        if (row) requestToggle(row);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestToggle]);

  /* ---------------- execute ---------------- */
  async function execute() {
    const owner = wallet.publicKey;
    if (!owner || st.burning) return;
    const targets = (scanQ.data ?? []).filter(
      (r) => useIncineratorStore.getState().selected.has(r.pubkey) && !r.frozen
    );
    if (targets.length === 0) return;

    const batches = chunk(targets, MAX_ACCOUNTS_PER_TX);
    st.setBurning(true);
    st.pushFeed({
      text: `IGNITION — ${targets.length} ACCOUNTS QUEUED → ${batches.length} BATCH(ES) OF ≤${MAX_ACCOUNTS_PER_TX}`,
      tone: "accent",
      ts: Date.now(),
    });

    let closed = 0;
    let burned = 0;
    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const tx = new Transaction();
        for (const r of batch) {
          const raw = BigInt(r.rawAmount);
          const acct = new PublicKey(r.pubkey);
          if (raw > 0n) {
            tx.add(
              createBurnCheckedInstruction(
                acct,
                new PublicKey(r.mint),
                owner,
                raw,
                r.decimals
              )
            );
          }
          tx.add(createCloseAccountInstruction(acct, owner, owner));
        }
        st.pushFeed({
          text: `BATCH ${i + 1}/${batches.length} → ${batch.length} accounts → awaiting signature…`,
          tone: "dim",
          ts: Date.now(),
        });
        try {
          const sig = await sendTx({
            tx,
            wallet,
            module: "incinerator",
            label: `Incinerate batch ${i + 1}/${batches.length}`,
          });
          closed += batch.length;
          burned += batch.filter((r) => BigInt(r.rawAmount) > 0n).length;
          st.setMany(batch.map((r) => r.pubkey), false);
          st.pushFeed({
            text: `BATCH ${i + 1}/${batches.length} → ${batch.length} accounts → confirmed ✓ ${sig.slice(0, 8)}…`,
            tone: "up",
            ts: Date.now(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          st.pushFeed({
            text: `BATCH ${i + 1}/${batches.length} → FAILED ✗ ${msg.slice(0, 90)} — accounts stay in cart`,
            tone: "down",
            ts: Date.now(),
          });
        }
      }

      if (closed > 0) {
        const sol = closed * RENT_PER_ACCOUNT_SOL;
        st.addLifetime(closed, sol);
        st.pushFeed({
          text: `RECLAIMED ≈ ${sol.toFixed(5)} SOL · ${closed} ACCOUNTS CLOSED · ${burned} BURNS`,
          tone: "accent",
          ts: Date.now(),
        });
      }
      st.pushFeed({ text: "FURNACE COOLDOWN — RESCANNING WALLET", tone: "dim", ts: Date.now() });
      await queryClient.invalidateQueries({ queryKey: ["incinerator", "scan"] });
    } finally {
      st.setBurning(false);
    }
  }

  /* ---------------- render ---------------- */
  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {/* header */}
      <div className="mb-3 flex items-end justify-between border-b-2 border-line pb-2">
        <div>
          <div className="m-display text-lg font-bold uppercase tracking-[0.2em] text-[var(--m-accent)]">
            Demolition Control
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            close empty accounts · burn dust · reclaim rent
          </div>
        </div>
        <div className="flex items-center gap-3">
          {scanQ.dataUpdatedAt > 0 && (
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
              scanned{" "}
              {new Date(scanQ.dataUpdatedAt).toLocaleTimeString("en-US", { hour12: false })}
            </span>
          )}
          <button
            type="button"
            disabled={!wallet.publicKey || scanQ.isFetching || st.burning}
            onClick={() => scanQ.refetch()}
            className={cn(
              "border-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
              !wallet.publicKey || scanQ.isFetching || st.burning
                ? "cursor-not-allowed border-line text-dim"
                : "border-[var(--m-accent)] text-[var(--m-accent)] hover:bg-[var(--m-glow)]"
            )}
            style={{ borderRadius: 3 }}
          >
            {scanQ.isFetching ? "SCANNING…" : "RESCAN"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* left: scan results */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* gang switches */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <GangSwitch
              label="ALL EMPTY"
              count={empties.length}
              on={allEmptyOn}
              disabled={st.burning}
              onToggle={() => st.setMany(empties.map((r) => r.pubkey), !allEmptyOn)}
            />
            <GangSwitch
              label="ALL DUST"
              count={dusts.length}
              on={allDustOn}
              disabled={st.burning}
              onToggle={() => st.setMany(dusts.map((r) => r.pubkey), !allDustOn)}
            />
            <button
              type="button"
              disabled={selectedRows.length === 0 || st.burning}
              onClick={() => st.clearSelection()}
              className={cn(
                "ml-auto border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em]",
                selectedRows.length === 0 || st.burning
                  ? "cursor-not-allowed border-line text-dim/60"
                  : "border-line text-dim hover:border-[var(--m-accent2)] hover:text-fg"
              )}
              style={{ borderRadius: 3 }}
            >
              CLEAR
            </button>
          </div>

          {/* list */}
          <div className="min-h-0 flex-1 overflow-y-auto border-2 border-line bg-cell2/30">
            {!wallet.publicKey ? (
              <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
                connect wallet to scan
              </div>
            ) : scanQ.isLoading ? (
              <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-dim tek-pulse">
                scanning token accounts…
              </div>
            ) : scanQ.error ? (
              <div className="flex h-full items-center justify-center p-4 text-center font-mono text-[10px] text-down">
                SCAN FAILED — {(scanQ.error as Error).message.slice(0, 120)}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
                no token accounts — wallet is clean
              </div>
            ) : (
              rows.map((r) => {
                const meta = metas[r.mint];
                const isSel = st.selected.has(r.pubkey);
                const selectable = !r.frozen && !st.burning;
                const reclaim = r.cls === "empty" || r.cls === "dust";
                const chip = CLS_CHIP[r.cls];
                return (
                  <div key={r.pubkey}>
                    <div
                      onMouseEnter={() => (hoverRef.current = r.pubkey)}
                      onMouseLeave={() => {
                        if (hoverRef.current === r.pubkey) hoverRef.current = null;
                      }}
                      onClick={() => selectable && requestToggle(r)}
                      title={r.frozen ? FROZEN_HINT : undefined}
                      className={cn(
                        "flex items-center gap-3 border-b border-line px-3 py-2",
                        r.frozen
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer hover:bg-cell2/80",
                        isSel && "bg-[var(--m-glow)]"
                      )}
                    >
                      {/* chunky selector */}
                      <span
                        className={cn(
                          "inline-block h-4 w-4 shrink-0 border-2",
                          r.frozen
                            ? "border-dim/40"
                            : isSel
                              ? "border-[var(--m-accent)] bg-[var(--m-accent)]"
                              : "border-dim/70"
                        )}
                      />
                      <TokenIcon
                        mint={r.mint}
                        src={meta?.icon}
                        symbol={meta?.symbol}
                        size={20}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px] font-bold text-fg">
                          {meta?.symbol ?? shortAddr(r.mint)}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Address addr={r.mint} className="text-[9px] text-dim" />
                        </div>
                      </div>
                      <div className="tnum shrink-0 text-right font-mono text-[11px] text-fg/85">
                        {r.uiAmount === 0
                          ? "0"
                          : r.uiAmount.toLocaleString("en-US", {
                              maximumFractionDigits: 6,
                            })}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 border px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]",
                          chip.cls
                        )}
                        style={{ borderRadius: 2 }}
                        title={r.frozen ? FROZEN_HINT : undefined}
                      >
                        {chip.label}
                      </span>
                      <span className="tnum w-[72px] shrink-0 text-right font-mono text-[9px] text-up">
                        {reclaim || isSel ? `+${RENT_PER_ACCOUNT_SOL.toFixed(5)}` : ""}
                      </span>
                    </div>

                    {/* holding safety rail */}
                    {confirmFor === r.pubkey && (
                      <div
                        className="flex items-center gap-2 border-b border-[var(--m-accent2)] bg-[#160a07] px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-warn">
                          LIVE BALANCE — TYPE{" "}
                          <span className="text-[var(--m-accent)]">
                            {r.mint.slice(0, 4)}
                          </span>{" "}
                          TO ARM
                        </span>
                        <input
                          autoFocus
                          value={confirmText}
                          maxLength={4}
                          onChange={(e) => {
                            const v = e.target.value;
                            setConfirmText(v);
                            if (v === r.mint.slice(0, 4)) {
                              st.setMany([r.pubkey], true);
                              setConfirmFor(null);
                              setConfirmText("");
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setConfirmFor(null);
                              setConfirmText("");
                            }
                          }}
                          className="w-20 border-2 border-[var(--m-accent2)] bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--m-accent)] outline-none focus:border-[var(--m-accent)]"
                          style={{ borderRadius: 3 }}
                          placeholder={r.mint.slice(0, 4)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmFor(null);
                            setConfirmText("");
                          }}
                          className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-dim hover:text-fg"
                        >
                          ABORT
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* tallies */}
          <div className="mt-2 flex gap-4 font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
            <span>
              <span className="text-up">{empties.length}</span> empty
            </span>
            <span>
              <span className="text-warn">{dusts.length}</span> dust
            </span>
            <span>
              <span className="text-fg/70">{holdings.length}</span> holding
            </span>
            <span>
              <span className="text-[#74a0ff]">{frozen.length}</span> frozen
            </span>
            <span className="ml-auto">
              hotkeys: <span className="text-fg/70">X</span> toggle row ·{" "}
              <span className="text-fg/70">E</span> all empty
            </span>
          </div>
        </div>

        {/* right: burn cart + console */}
        <div className="flex w-[300px] shrink-0 flex-col gap-3">
          <div className="border-2 border-line bg-cell2/40 p-3">
            <div className="flex items-center justify-between">
              <span className="m-display text-[11px] font-bold uppercase tracking-[0.25em] text-fg">
                Burn Cart
              </span>
              <span className="tnum font-mono text-[10px] text-dim">
                {selectedRows.length} acct · {burnsInCart} burn
              </span>
            </div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
              est. rent reclaim
            </div>
            <div className="m-display tnum text-3xl font-bold leading-none text-[var(--m-accent)]">
              {estReclaim.toFixed(5)}
              <span className="ml-1 text-sm text-fg/60">SOL</span>
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
              <span>{batchCount || 0} tx batch(es)</span>
              <span>≤{MAX_ACCOUNTS_PER_TX} accts / tx</span>
            </div>
            <div
              className="mt-3 border border-[var(--m-accent2)] px-2 py-1.5 text-center font-mono text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--m-accent)]"
              style={{
                borderRadius: 2,
                backgroundImage:
                  "repeating-linear-gradient(-45deg, rgba(255,59,31,0.08) 0 8px, transparent 8px 16px)",
              }}
            >
              THIS ACTION IS IRREVERSIBLE
            </div>
          </div>

          {/* console */}
          <div className="flex min-h-0 flex-1 flex-col border-2 border-line bg-[#0a0a0c]">
            <div className="flex items-center justify-between border-b border-line px-2 py-1">
              <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-dim">
                furnace console
              </span>
              {st.feed.length > 0 && !st.burning && (
                <button
                  type="button"
                  onClick={() => st.clearFeed()}
                  className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim hover:text-fg"
                >
                  clear
                </button>
              )}
            </div>
            <TerminalFeed
              lines={
                st.feed.length > 0
                  ? st.feed
                  : [{ text: "standby — furnace cold", tone: "dim" as const }]
              }
              showTime
              className="min-h-0 flex-1 p-1.5"
            />
          </div>

          <IgniteButton
            disabled={selectedRows.length === 0 || !wallet.publicKey}
            busy={st.burning}
            label={`IGNITE ${selectedRows.length > 0 ? `· ${selectedRows.length}` : ""}`}
            onIgnite={execute}
          />
        </div>
      </div>
    </div>
  );
}
