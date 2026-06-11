"use client";

import { useEffect, useRef, useState } from "react";
import { Keypair } from "@solana/web3.js";
import { Address } from "@/components/tek/Address";
import { ScrambleText } from "@/components/tek/ScrambleText";
import { toast } from "@/kernel/toast";
import { cn } from "@/lib/cn";
import { useShadowStore } from "./store";

type RevealState = "hidden" | "shown" | "spent";

export function PanelBurners() {
  const burners = useShadowStore((s) => s.burners);
  const pendingCommand = useShadowStore((s) => s.pendingCommand);
  const clearCommand = useShadowStore((s) => s.clearCommand);

  /** lives in component memory only — gone on unmount/refresh, never stored */
  const [kp, setKp] = useState<Keypair | null>(null);
  const [reveal, setReveal] = useState<RevealState>("hidden");

  const generate = useRef(() => {
    const fresh = Keypair.generate();
    setKp(fresh);
    setReveal("hidden");
    useShadowStore.getState().addBurner(fresh.publicKey.toBase58());
    toast({ kind: "info", title: "Burner generated", body: "secret key exists only in this tab" });
  }).current;

  /* palette command: "Generate burner address" — read live state so a
     StrictMode double-effect cannot mint two keypairs */
  useEffect(() => {
    if (useShadowStore.getState().pendingCommand !== "generate-burner") return;
    clearCommand();
    generate();
  }, [pendingCommand, clearCommand, generate]);

  function downloadKey() {
    if (!kp) return;
    const payload = {
      label: "TEK SHADOWSWAP BURNER — KEEP OFFLINE",
      publicKey: kp.publicKey.toBase58(),
      secretKey: Array.from(kp.secretKey),
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `burner-${kp.publicKey.toBase58().slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="border border-line bg-cell2/40 p-4">
        <ScrambleText
          text="BURNER ADDRESSES"
          className="m-display text-sm font-bold tracking-[0.3em] text-[var(--m-accent)]"
        />
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-fg/60">
          Fresh keypairs generated locally with Keypair.generate(). Use as
          unlinked receive addresses; sweep funds onward, then discard.
        </p>
        <button
          onClick={generate}
          className="mt-3 border border-[var(--m-accent)] bg-[var(--m-glow)] px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--m-accent)] transition-colors hover:bg-[var(--m-accent)] hover:text-black"
        >
          generate burner
        </button>
      </div>

      {/* brutal warning */}
      <div className="border border-down/50 bg-down/5 p-3">
        <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-down">
          ⚠ TEK NEVER STORES THIS KEY. ANYWHERE.
        </div>
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-fg/60">
          The secret key exists only in this browser tab&apos;s memory. Close the
          tab, refresh, or generate again — it is gone forever, and any funds on
          it are gone with it. Download it or write it down BEFORE sending
          anything. No recovery. No support ticket. Nothing.
        </p>
      </div>

      {/* current burner */}
      {kp && (
        <div className="border border-[var(--m-accent)]/40 bg-cell2/40 p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            receive address
          </div>
          <div className="mt-1 break-all font-mono text-[11px] font-bold text-fg">
            {kp.publicKey.toBase58()}
          </div>
          <div className="mt-1">
            <Address addr={kp.publicKey.toBase58()} chars={8} className="text-[10px] text-dim" />
          </div>

          <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            secret key — one-time reveal
          </div>
          {reveal === "hidden" && (
            <button
              onClick={() => setReveal("shown")}
              className="mt-1.5 border border-warn/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-warn hover:bg-warn/10"
            >
              reveal once
            </button>
          )}
          {reveal === "shown" && (
            <div className="mt-1.5">
              <div className="max-h-24 overflow-y-auto break-all border border-warn/40 bg-void p-2 font-mono text-[9px] leading-relaxed text-warn/90">
                {JSON.stringify(Array.from(kp.secretKey))}
              </div>
              <button
                onClick={() => setReveal("spent")}
                className="mt-1.5 border border-line px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-dim hover:text-fg"
              >
                conceal — i have saved it
              </button>
            </div>
          )}
          {reveal === "spent" && (
            <div className="mt-1.5 font-mono text-[10px] text-dim">
              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ — reveal spent. download remains available until
              you leave or regenerate.
            </div>
          )}

          <button
            onClick={downloadKey}
            className="mt-3 border border-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-fg/80 hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          >
            ↓ download keypair .json
          </button>
        </div>
      )}

      {/* session list */}
      <div className="border border-line bg-cell2/30 p-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
          session burners · {burners.length}
        </div>
        {burners.length === 0 ? (
          <div className="mt-2 font-mono text-[10px] text-dim">none generated this session</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {burners.map((b, i) => (
              <div
                key={b}
                className={cn(
                  "flex items-center gap-2 font-mono text-[10px]",
                  i === 0 ? "text-fg" : "text-fg/60"
                )}
              >
                <span className="tnum w-6 text-dim">{String(burners.length - i).padStart(2, "0")}</span>
                <Address addr={b} chars={10} />
                {i === 0 && kp && b === kp.publicKey.toBase58() && (
                  <span className="ml-auto text-[8px] uppercase tracking-[0.2em] text-[var(--m-accent)]">
                    active
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 border-t border-line pt-2 font-mono text-[9px] text-dim">
          pubkeys only — secrets were never written to storage
        </p>
      </div>
    </div>
  );
}
