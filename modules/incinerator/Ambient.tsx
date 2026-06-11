"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { StatBlock } from "@/components/tek/StatBlock";
import { useKernelStore } from "@/kernel/store";
import { useIncineratorStore } from "./store";
import { RENT_PER_ACCOUNT_SOL, type BurnableAccount } from "./lib";

export default function IncineratorAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const { publicKey } = useWallet();
  const owner58 = publicKey?.toBase58() ?? null;

  const lifetime = useIncineratorStore((s) => s.lifetime);
  const hydrated = useIncineratorStore((s) => s.lifetimeHydrated);
  const hydrateLifetime = useIncineratorStore((s) => s.hydrateLifetime);
  useEffect(() => {
    hydrateLifetime();
  }, [hydrateLifetime]);

  /* read cached scan only — never poll from ambient */
  const { data } = useQuery<BurnableAccount[]>({
    queryKey: ["incinerator", "scan", owner58],
    queryFn: () => Promise.resolve([] as BurnableAccount[]), // never runs: enabled false
    enabled: false,
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const empty = data.filter((r) => r.cls === "empty").length;
    const dust = data.filter((r) => r.cls === "dust").length;
    return {
      empty,
      dust,
      total: data.length,
      reclaimable: (empty + dust) * RENT_PER_ACCOUNT_SOL,
    };
  }, [data]);

  return (
    <button
      onClick={() => focus("incinerator")}
      className="relative flex h-full w-full flex-col p-3 text-left"
    >
      {/* charred hazard strip */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, rgba(255,59,31,0.5) 0 6px, transparent 6px 12px)",
        }}
      />

      <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-dim">
        reclaimable
      </div>
      {!publicKey ? (
        <div className="m-display mt-1 text-xl font-bold uppercase leading-tight tracking-[0.08em] text-dim">
          CONNECT
          <br />
          TO SCAN
        </div>
      ) : stats ? (
        <div className="m-display tnum mt-1 text-[26px] font-bold leading-none text-[var(--m-accent)]">
          {stats.reclaimable.toFixed(3)}
          <span className="ml-1 text-[11px] text-fg/60">SOL</span>
        </div>
      ) : (
        <div className="m-display mt-1 text-[26px] font-bold leading-none text-dim">
          —<span className="ml-2 text-[10px] font-normal tracking-[0.2em]">awaiting scan</span>
        </div>
      )}

      {/* counts */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatBlock label="empty" value={stats ? stats.empty : "—"} tone="up" />
        <StatBlock label="dust" value={stats ? stats.dust : "—"} />
        <StatBlock label="accts" value={stats ? stats.total : "—"} tone="dim" />
      </div>

      {/* lifetime + action */}
      <div className="mt-auto border-t border-line pt-2">
        <div className="flex items-center justify-between font-mono text-[9px]">
          <span className="uppercase tracking-[0.18em] text-dim">lifetime</span>
          <span className="tnum text-fg/80">
            {hydrated
              ? `${lifetime.sol.toFixed(4)} ◎ · ${lifetime.accounts} closed`
              : "—"}
          </span>
        </div>
        <div
          className="mt-2 border-2 border-[var(--m-accent)] py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--m-accent)]"
          style={{ borderRadius: 3 }}
        >
          {!publicKey ? "CONNECT TO SCAN" : stats ? "OPEN" : "SCAN"}
        </div>
      </div>
    </button>
  );
}
