"use client";

import { useEffect } from "react";
import { Address } from "@/components/tek/Address";
import { useKernelStore } from "@/kernel/store";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  economicsValid,
  identityValid,
  imageValid,
  useLaunchpadStore,
} from "./store";

export default function LaunchpadAmbient() {
  const focus = useKernelStore((k) => k.focus);
  const s = useLaunchpadStore();

  useEffect(() => {
    s.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks: { label: string; ok: boolean }[] = [
    { label: "identity", ok: identityValid(s.fields) },
    { label: "image", ok: imageValid(s.imageFile) },
    { label: "economics", ok: economicsValid(s.devBuySol) && s.devBuySol.trim() !== "" },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => focus("launchpad")}
      onKeyDown={(e) => e.key === "Enter" && focus("launchpad")}
      className="flex h-full w-full cursor-pointer flex-col p-3 text-left"
    >
      {/* armed / at-rest LAUNCH button */}
      <div
        className={cn(
          "hazard flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors",
          s.launching
            ? "border-[var(--m-accent)] tek-pulse"
            : ready
              ? "border-[var(--m-accent)] shadow-[0_0_18px_var(--m-glow)]"
              : "border-line"
        )}
      >
        <span
          className={cn(
            "m-display text-xl font-bold uppercase tracking-[0.3em]",
            ready || s.launching ? "text-[var(--m-accent)]" : "text-dim"
          )}
        >
          {s.launching ? "LAUNCHING" : "LAUNCH"}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
          {s.launching ? "in flight" : ready ? "armed · ready" : "sequence incomplete"}
        </span>
      </div>

      {/* wizard completion checklist */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {checks.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em]",
              c.ok ? "border-up/40 text-up" : "border-line text-dim"
            )}
          >
            {c.ok ? "■" : "□"} {c.label}
          </div>
        ))}
      </div>

      {/* my launches */}
      <div className="mt-2.5 flex min-h-0 flex-1 flex-col border-t border-line pt-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-dim">
          <span>my launches</span>
          <span className="tnum">{s.myLaunches.length}</span>
        </div>
        {s.myLaunches.length === 0 ? (
          <div className="font-mono text-[10px] text-dim/60">
            no tokens forged yet — hit LAUNCH.
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {s.myLaunches.slice(0, 6).map((l) => (
              <div
                key={l.mint}
                className="flex items-center gap-2 font-mono text-[10px]"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="w-14 truncate font-bold text-[var(--m-accent)]">
                  ${l.symbol}
                </span>
                <Address addr={l.mint} chars={4} className="text-dim" />
                <a
                  href={`https://pump.fun/coin/${l.mint}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-dim hover:text-[var(--m-accent)]"
                  title="open on pump.fun"
                >
                  pump↗
                </a>
                <span className="tnum ml-auto text-dim/60">{timeAgo(l.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.3em] text-dim/50">
        pump.fun token foundry
      </div>
    </div>
  );
}
