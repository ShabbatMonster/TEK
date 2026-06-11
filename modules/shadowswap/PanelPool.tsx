"use client";

import { useState } from "react";
import { AmountInput } from "@/components/tek/AmountInput";
import { ScrambleText } from "@/components/tek/ScrambleText";
import { cn } from "@/lib/cn";
import { useShadowStore } from "./store";

/**
 * SHIELDED POOL — UI preview only. The Privacy Cash client integration is
 * roadmapped (docs/10-module-plans.md §3 step 4, pinned reviewed commit +
 * WASM prover). No fake transactions: every action is hard-disabled until
 * the protocol integration clears audit review.
 */
export function PanelPool() {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"shield" | "unshield">("shield");
  const vaultUnlocked = useShadowStore((s) => s.vaultUnlocked);
  const vaultNotes = useShadowStore((s) => s.vaultNotes);
  const setActivePanel = useShadowStore((s) => s.setActivePanel);

  return (
    <div className="relative h-full">
      {/* audit-status badge → public TEK review */}
      <div className="absolute inset-x-0 top-0 z-10 flex justify-center">
        <a
          href="/audit/privacy-cash"
          target="_blank"
          rel="noreferrer"
          className="border border-up/50 bg-void/90 px-4 py-1.5 text-center font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-up hover:bg-up/10"
          title="Open the TEK integrator security review"
        >
          tek review · B+ integrate with conditions · read report ↗
        </a>
      </div>

      <div className="space-y-4 pt-10 opacity-80" aria-disabled>
        <div className="border border-line bg-cell2/40 p-4">
          <div className="flex items-center justify-between">
            <ScrambleText
              text="SHIELDED POOL"
              className="m-display text-sm font-bold tracking-[0.3em] text-[var(--m-accent)]"
            />
            <div className="flex gap-1">
              {(["shield", "unshield"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em]",
                    mode === m
                      ? "border-[var(--m-accent)] text-[var(--m-accent)]"
                      : "border-line text-dim hover:text-fg"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border border-line bg-void/60 p-3">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
              {mode === "shield" ? "deposit amount · sol" : "withdraw amount · sol"}
            </div>
            <AmountInput value={amount} onChange={setAmount} placeholder="▓▓▓.▓▓" />
          </div>

          {mode === "unshield" && (
            <div className="mt-2 border border-line bg-void/60 p-3">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
                recipient — any address, unlinked via relayer
              </div>
              <input
                disabled
                placeholder="▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓"
                className="w-full cursor-not-allowed bg-transparent font-mono text-[11px] text-fg outline-none placeholder:text-dim"
              />
            </div>
          )}

          <button
            disabled
            title="Privacy Cash integration ships after audit review — no fake transactions"
            className="mt-3 w-full cursor-not-allowed border border-line py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-dim"
          >
            {mode === "shield" ? "⊘ shield — locked" : "⊘ unshield — locked"}
          </button>

          <p className="mt-2 font-mono text-[9px] leading-relaxed text-dim">
            Shield deposits SOL into a zk pool and writes an encrypted note to
            your local vault; unshield withdraws via relayer to any address with
            no on-chain link. Proof generation will run in a local WASM worker.
            Integration target: Privacy Cash client at a pinned, reviewed commit.
          </p>
        </div>

        {/* notes — read from the local vault */}
        <div className="border border-line bg-cell2/30 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
              shielded notes · local vault
            </span>
            <button
              onClick={() => setActivePanel("vault")}
              className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--m-accent)] hover:underline"
            >
              {vaultUnlocked ? "manage vault →" : "unlock vault →"}
            </button>
          </div>
          {!vaultUnlocked ? (
            <div className="mt-2 space-y-1 font-mono text-[10px] text-dim">
              <div>▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
              <div>▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
              <div className="text-[9px]">vault locked — notes encrypted at rest</div>
            </div>
          ) : vaultNotes.length === 0 ? (
            <div className="mt-2 font-mono text-[10px] text-dim">
              vault empty — notes will appear here after your first shield
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {vaultNotes.map((n) => (
                <div key={n.id} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-[var(--m-accent)]">◈</span>
                  <span className="truncate text-fg/80">{n.text}</span>
                  <span className="tnum ml-auto shrink-0 text-[9px] text-dim">
                    {new Date(n.at).toISOString().slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
