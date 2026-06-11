"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useKernelStore } from "@/kernel/store";
import { useOracleStore } from "./store";

/** first line of the last non-empty assistant message */
function useLastInsight(): string | null {
  const messages = useOracleStore((s) => s.messages);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.content.trim()) {
      return m.content.trim().split("\n")[0];
    }
  }
  return null;
}

function Eye({ streaming, reduced }: { streaming: boolean; reduced: boolean }) {
  return (
    <div className="relative h-20 w-20">
      {/* iridescent ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, var(--m-accent), var(--m-accent2), var(--m-accent))",
          filter: "blur(0.5px)",
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={
          reduced
            ? undefined
            : { duration: streaming ? 4 : 22, repeat: Infinity, ease: "linear" }
        }
      />
      {/* mask ring down to a thin band */}
      <div className="absolute inset-[2px] rounded-full bg-cell" />

      {/* breathing iris */}
      <motion.div
        className="absolute inset-[7px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 36% 32%, rgba(94, 234, 212, 0.65), rgba(167, 139, 250, 0.5) 42%, rgba(20, 16, 38, 0.95) 78%)",
          boxShadow:
            "0 0 24px var(--m-glow), inset 0 0 18px rgba(167, 139, 250, 0.35)",
        }}
        animate={
          reduced
            ? undefined
            : streaming
              ? { scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9] }
              : { scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          reduced
            ? undefined
            : {
                duration: streaming ? 1.1 : 4.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      {/* pupil */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, #f5f3ff 0%, var(--m-accent) 55%, transparent 75%)",
        }}
        animate={
          reduced ? undefined : streaming ? { scale: [1, 1.5, 1] } : { scale: [1, 1.15, 1] }
        }
        transition={
          reduced
            ? undefined
            : {
                duration: streaming ? 0.9 : 4.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />
    </div>
  );
}

export default function OracleAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const streaming = useOracleStore((s) => s.streaming);
  const insight = useLastInsight();
  const reduced = useReducedMotion() ?? false;
  const [ask, setAsk] = useState("");

  function submitAsk() {
    const text = ask.trim();
    if (!text) return;
    setAsk("");
    useOracleStore.getState().setPendingPrompt(text);
    focus("oracle");
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="aurora" />

      {/* the eye + last insight — click anywhere here to enter the sanctum */}
      <button
        onClick={() => focus("oracle")}
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
      >
        <Eye streaming={streaming} reduced={reduced} />
        <div className="w-full">
          {streaming ? (
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--m-accent)] tek-pulse">
              divining…
            </div>
          ) : insight ? (
            <div className="m-display mx-auto line-clamp-2 max-w-[90%] text-[12px] italic leading-snug text-fg/80">
              {insight}
            </div>
          ) : (
            <div className="m-display text-[12px] italic text-dim">
              ask, and the chain answers
            </div>
          )}
        </div>
      </button>

      {/* ask bar */}
      <div className="relative z-10 border-t border-line/80 px-3 py-2">
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitAsk();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="ask the oracle…"
          className="w-full bg-transparent font-mono text-[10.5px] text-fg outline-none placeholder:text-dim/60"
        />
      </div>
    </div>
  );
}
