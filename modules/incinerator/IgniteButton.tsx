"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const HOLD_MS = 3000;

/**
 * Hold-to-burn igniter. Pointer must stay down for 3 full seconds —
 * a flame gradient fills the button via rAF; releasing early cancels.
 */
export function IgniteButton({
  disabled,
  busy,
  label,
  onIgnite,
}: {
  disabled: boolean;
  busy: boolean;
  label: string;
  onIgnite: () => void;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const firedRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const stop = useCallback((resetFill: boolean) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHolding(false);
    const el = fillRef.current;
    if (el && resetFill) {
      el.style.transition = "width 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.width = "0%";
    }
  }, []);

  useEffect(() => () => stop(false), [stop]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || busy || holding) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    firedRef.current = false;
    startRef.current = performance.now();
    setHolding(true);
    const el = fillRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.width = "0%";
    }
    const tick = () => {
      const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
      if (fillRef.current) fillRef.current.style.width = `${(p * 100).toFixed(2)}%`;
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          stop(false);
          // leave the bar full while execution kicks off
          if (fillRef.current) fillRef.current.style.width = "100%";
          onIgnite();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (!holding || firedRef.current) return;
    stop(true);
  }

  // clear the full bar once execution finishes
  useEffect(() => {
    if (!busy && !holding && fillRef.current && firedRef.current) {
      firedRef.current = false;
      fillRef.current.style.transition = "width 280ms ease-out";
      fillRef.current.style.width = "0%";
    }
  }, [busy, holding]);

  const inert = disabled || busy;

  return (
    <div className="select-none">
      <button
        type="button"
        disabled={inert}
        onPointerDown={onPointerDown}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative h-14 w-full touch-none overflow-hidden border-2 transition-colors",
          inert
            ? "cursor-not-allowed border-line bg-cell2/40"
            : holding
              ? "border-[var(--m-accent)] bg-[#160a07]"
              : "border-[var(--m-accent)] bg-[#120a08] hover:bg-[#1c0d08]"
        )}
        style={{ borderRadius: 4 }}
        title={
          disabled
            ? "Cart empty or wallet not connected"
            : "Hold for 3 seconds to ignite"
        }
      >
        {/* flame fill */}
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0"
          style={{
            width: "0%",
            background:
              "linear-gradient(90deg, #7a1f10 0%, #ff3b1f 60%, #ffb224 100%)",
            boxShadow: holding ? "0 0 24px rgba(255,59,31,0.55)" : undefined,
          }}
        />
        {/* hazard ticks */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, rgba(255,59,31,0.35) 0 6px, transparent 6px 14px)",
          }}
        />
        <span
          className={cn(
            "m-display relative z-10 text-[15px] font-bold uppercase tracking-[0.3em]",
            inert ? "text-dim" : holding ? "text-fg" : "text-[var(--m-accent)]"
          )}
        >
          {busy ? "INCINERATING…" : holding ? "HOLD…" : label}
        </span>
      </button>
      <div className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.3em] text-dim">
        {inert ? "igniter locked" : "hold 3s to ignite · release aborts"}
      </div>
    </div>
  );
}
