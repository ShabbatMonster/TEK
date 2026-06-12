"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConnection, explorerTx } from "@/lib/solana";
import { fmtSol, shortAddr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useKernelStore } from "./store";

function SlotClock() {
  const { data } = useQuery({
    queryKey: ["kernel", "slot"],
    queryFn: () => getConnection().getSlot(),
    refetchInterval: 12_000,
  });
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-dim">
      <span className={cn("h-1.5 w-1.5 rounded-full", data ? "bg-up" : "bg-warn tek-pulse")} />
      <span className="tnum">{data ? `SLOT ${data.toLocaleString()}` : "CONNECTING"}</span>
    </div>
  );
}

function TxMonitor() {
  const txs = useKernelStore((s) => s.txs);
  const [open, setOpen] = useState(false);
  const pending = txs.filter((t) => t.status === "pending").length;
  if (txs.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-line px-2 py-0.5 font-mono text-[10px] text-dim hover:text-fg"
      >
        {pending > 0 ? (
          <span className="tek-pulse text-warn">⧗ {pending} TX</span>
        ) : (
          <span>TX LOG</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 rounded-lg border border-line bg-cell2 p-1 shadow-2xl">
          {txs.slice(0, 8).map((t, i) => (
            <a
              key={i}
              href={t.signature ? explorerTx(t.signature) : undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded px-2 py-1.5 font-mono text-[10px] hover:bg-cell"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  t.status === "pending" && "bg-warn tek-pulse",
                  t.status === "confirmed" && "bg-up",
                  t.status === "failed" && "bg-down"
                )}
              />
              <span className="truncate text-fg">{t.label}</span>
              <span className="ml-auto shrink-0 uppercase text-dim">{t.module}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletPill() {
  const { publicKey, wallets, select, connect, disconnect, connecting, wallet } = useWallet();
  const [open, setOpen] = useState(false);

  const { data: balance } = useQuery({
    queryKey: ["wallet", "sol", publicKey?.toBase58()],
    queryFn: () => getConnection().getBalance(publicKey!),
    enabled: !!publicKey,
    refetchInterval: 30_000,
  });

  if (publicKey) {
    return (
      <button
        onClick={() => disconnect()}
        className="group flex items-center gap-2 rounded border border-line bg-cell2 px-2.5 py-0.5 font-mono text-[10px] hover:border-down"
        title="Disconnect"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-up" />
        <span className="tnum text-fg">{balance != null ? `${fmtSol(balance, 3)} ◎` : "…"}</span>
        <span className="text-dim group-hover:hidden">{shortAddr(publicKey.toBase58())}</span>
        <span className="hidden text-down group-hover:inline">DISCONNECT</span>
      </button>
    );
  }

  const installed = wallets.filter((w) => w.readyState === "Installed");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-line bg-cell2 px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg hover:border-fg"
      >
        {connecting ? "CONNECTING…" : "CONNECT WALLET"}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-52 rounded-lg border border-line bg-cell2 p-1 shadow-2xl">
          {installed.length === 0 && (
            <div className="px-2 py-2 font-mono text-[10px] text-dim">
              No wallet detected. Install Phantom, Solflare or Backpack.
            </div>
          )}
          {installed.map((w) => (
            <button
              key={w.adapter.name}
              onClick={async () => {
                setOpen(false);
                select(w.adapter.name);
                try {
                  await connect();
                } catch {
                  /* user rejected or adapter needs re-select; selection persists */
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[11px] text-fg hover:bg-cell"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.adapter.icon} alt="" className="h-4 w-4 rounded" />
              {w.adapter.name}
              {wallet?.adapter.name === w.adapter.name && (
                <span className="ml-auto text-[9px] text-dim">selected</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusBar() {
  const setPaletteOpen = useKernelStore((s) => s.setPaletteOpen);
  const setCheatOpen = useKernelStore((s) => s.setCheatOpen);
  const setManifestoOpen = useKernelStore((s) => s.setManifestoOpen);
  return (
    <header className="flex h-[var(--tek-statusbar-h)] shrink-0 items-center gap-3 rounded-[var(--tek-radius)] border border-line bg-cell px-3">
      <button
        onClick={() => setPaletteOpen(true)}
        className="font-mono text-[12px] font-bold tracking-[0.4em] text-fg hover:text-up"
        title="Command palette (⌘K)"
      >
        TEK
      </button>
      <span className="font-mono text-[9px] uppercase tracking-widest text-dim">
        the everything kernel
      </span>
      <SlotClock />
      <div className="ml-auto flex items-center gap-2">
        <TxMonitor />
        <button
          onClick={() => setManifestoOpen(true)}
          className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-dim hover:text-fg"
          title="What is TEK?"
        >
          READ.ME
        </button>
        <button
          onClick={() => setCheatOpen(true)}
          className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-dim hover:text-fg"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
        <WalletPill />
      </div>
    </header>
  );
}
