"use client";

import { useEffect, useState } from "react";
import { ScrambleText } from "@/components/tek/ScrambleText";
import { StatBlock } from "@/components/tek/StatBlock";
import { useKernelStore } from "@/kernel/store";
import { useShadowStore } from "./store";

export default function ShadowAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const burners = useShadowStore((s) => s.burners);
  const vaultUnlocked = useShadowStore((s) => s.vaultUnlocked);
  const vaultNotes = useShadowStore((s) => s.vaultNotes);

  /* loop the tagline scramble — skipped under prefers-reduced-motion */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={() => focus("shadowswap")}
      className="relative flex h-full w-full flex-col overflow-hidden p-3 text-left"
    >
      {/* faint animated static field */}
      <div className="shadow-static absolute inset-0" aria-hidden />

      {/* hero */}
      <div className="relative">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
          burner identities
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="m-display tnum text-3xl font-bold text-[var(--m-accent)]">
            {burners.length}
          </span>
          <span className="font-mono text-[9px] text-dim">this session</span>
        </div>
      </div>

      <ScrambleText
        key={tick}
        text="COUNTER-SURVEILLANCE TOOLKIT"
        className="m-display relative mt-1 text-[10px] tracking-[0.18em] text-[var(--m-accent)]/70"
      />

      {/* stat row */}
      <div className="relative mt-auto grid grid-cols-3 gap-2 border-t border-line pt-2">
        <StatBlock
          label="vault"
          value={vaultUnlocked ? `${vaultNotes.length} notes` : "LOCKED"}
          tone={vaultUnlocked ? "accent" : "dim"}
        />
        <StatBlock label="shielded pool" value="PENDING" tone="dim" />
        <StatBlock
          label="burners"
          value={<span className="tnum">{burners.length}</span>}
          tone={burners.length > 0 ? undefined : "dim"}
        />
      </div>
    </button>
  );
}
