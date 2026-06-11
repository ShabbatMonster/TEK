"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useKernelStore } from "@/kernel/store";
import { isValidPubkey } from "@/lib/solana";
import { shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSignalStore } from "./store";
import { useInbox } from "./queries";

const PIXEL = { fontFamily: "var(--font-silkscreen)" } as const;

export default function SignalAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const { publicKey } = useWallet();
  const unread = useSignalStore((s) => s.unreadCount);
  const reduced = useReducedMotion();
  const [to, setTo] = useState("");
  const { data } = useInbox(); // cached reads only when not focused

  function quickCompose() {
    const addr = to.trim();
    if (!isValidPubkey(addr)) return;
    const st = useSignalStore.getState();
    st.setComposeRecipient(addr);
    st.selectThread(null);
    setTo("");
    focus("signal");
  }

  if (!publicKey) {
    return (
      <button
        onClick={() => focus("signal")}
        className="halftone flex h-full w-full flex-col items-center justify-center gap-2"
      >
        <span style={PIXEL} className="text-base text-[var(--m-accent)]">
          [&gt;]
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim tek-pulse">
          connect for inbox
        </span>
      </button>
    );
  }

  const recent = (data ?? []).slice(0, 3);

  return (
    <div
      onClick={() => focus("signal")}
      className="halftone h-full w-full cursor-pointer"
    >
      {/* pager-buzz: wiggle keyed on unread count */}
      <motion.div
        key={unread}
        animate={reduced || unread === 0 ? { x: 0 } : { x: [0, -2, 2, -1, 1, 0] }}
        transition={{ duration: 0.12 }}
        className="flex h-full flex-col p-3"
      >
        {/* unread headline */}
        <div className="flex items-baseline gap-2">
          {unread > 0 ? (
            <>
              <span style={PIXEL} className="text-3xl font-bold leading-none text-[var(--m-accent2)]">
                {unread}
              </span>
              <span style={PIXEL} className="text-[8px] uppercase text-[var(--m-accent2)]">
                unread
              </span>
            </>
          ) : (
            <>
              <span style={PIXEL} className="text-xl leading-none text-[var(--m-accent)]">
                [&gt;]
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
                inbox clear
              </span>
            </>
          )}
        </div>

        {/* last 3 memo previews */}
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-hidden">
          {recent.length === 0 ? (
            <div className="font-mono text-[10px] text-dim">no memos yet</div>
          ) : (
            recent.map((m) => (
              <div key={m.signature} className="flex items-baseline gap-1.5 font-mono text-[10px]">
                <span
                  className={cn(
                    "shrink-0",
                    m.direction === "in" ? "text-[var(--m-accent)]" : "text-dim"
                  )}
                >
                  {m.direction === "in" ? "◂" : "▸"}
                </span>
                <span className="shrink-0 font-bold text-fg/80">
                  {shortAddr(m.counterparty)}
                </span>
                <span className="min-w-0 truncate text-dim">{m.text.slice(0, 40)}</span>
                <span style={PIXEL} className="ml-auto shrink-0 text-[7px] text-dim">
                  {m.blockTime ? timeAgo(m.blockTime) : ""}
                </span>
              </div>
            ))
          )}
        </div>

        {/* quick compose */}
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") quickCompose();
          }}
          placeholder="page a wallet ↵"
          spellCheck={false}
          className={cn(
            "mt-auto w-full rounded border bg-cell2/50 px-2 py-1 font-mono text-[10px] text-fg outline-none placeholder:text-dim",
            to.trim() && !isValidPubkey(to.trim())
              ? "border-down"
              : "border-line focus:border-[var(--m-accent)]"
          )}
        />
      </motion.div>
    </div>
  );
}
