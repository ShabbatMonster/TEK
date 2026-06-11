"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Address } from "@/components/tek/Address";
import { explorerTx, isValidPubkey } from "@/lib/solana";
import { shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSignalStore } from "./store";
import { useInbox, refreshInbox } from "./queries";
import { groupThreads, sendMemoMessage, utf8Bytes, MAX_MEMO_BYTES, type MemoMsg } from "./lib";

const PIXEL = { fontFamily: "var(--font-silkscreen)" } as const;

function MessageRow({ m }: { m: MemoMsg }) {
  const incoming = m.direction === "in";
  return (
    <div className="group flex items-baseline gap-2 font-mono text-[11px] leading-relaxed">
      <span style={PIXEL} className="w-10 shrink-0 text-[8px] text-dim">
        {m.blockTime ? timeAgo(m.blockTime) : "—"}
      </span>
      <span
        className={cn(
          "shrink-0 select-none",
          incoming ? "text-[var(--m-accent)]" : "text-dim"
        )}
      >
        {incoming ? "◂" : "▸"}
      </span>
      <span className="min-w-0 flex-1 break-words text-fg">
        {m.text}
        {m.isTek && (
          <span
            style={PIXEL}
            className="ml-2 align-middle text-[7px] uppercase text-[var(--m-accent)]"
          >
            TEK
          </span>
        )}
      </span>
      <a
        href={explorerTx(m.signature)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-[9px] text-dim opacity-0 transition-opacity hover:text-[var(--m-accent)] hover:underline group-hover:opacity-100"
        title="View transaction"
      >
        {shortAddr(m.signature)}
      </a>
    </div>
  );
}

export default function SignalFocused() {
  const wallet = useWallet();
  const s = useSignalStore();
  const inbox = useInbox();
  const scrollRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const threads = useMemo(() => groupThreads(inbox.data ?? []), [inbox.data]);
  const activeThread = threads.find((t) => t.counterparty === s.selectedThread) ?? null;

  const recipientStr = s.selectedThread ?? s.composeRecipient.trim();
  const recipientValid = isValidPubkey(recipientStr);
  const recipientInvalid = !s.selectedThread && s.composeRecipient.trim().length > 0 && !recipientValid;

  const bytes = utf8Bytes(s.draft);
  const overBytes = bytes > MAX_MEMO_BYTES;
  const canSend =
    !!wallet.publicKey && recipientValid && s.draft.trim().length > 0 && !overBytes && !s.sending;

  // once-per-session privacy notice
  useEffect(() => {
    useSignalStore.getState().hydrateNotice();
  }, []);

  // pin thread scroll to latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.selectedThread, activeThread?.messages.length]);

  // R = reply (focus composer) when not already typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        draftRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSend() {
    if (!canSend || !wallet.publicKey) return;
    const to = recipientStr;
    s.setSending(true);
    try {
      await sendMemoMessage(wallet, new PublicKey(to), s.draft);
      s.setDraft("");
      if (!s.selectedThread) {
        s.selectThread(to);
        s.setComposeRecipient("");
      }
      refreshInbox();
    } catch {
      /* sendTx already toasts failures */
    } finally {
      useSignalStore.getState().setSending(false);
    }
  }

  return (
    <div className="halftone flex h-full flex-col">
      {/* honest, dismissable privacy notice */}
      {!s.noticeDismissed && (
        <div className="flex items-center gap-3 border-b border-[var(--m-accent2)]/40 bg-[var(--m-accent2)]/5 px-4 py-2">
          <span style={PIXEL} className="text-[8px] uppercase text-[var(--m-accent2)]">
            notice
          </span>
          <span className="font-mono text-[10px] text-fg">
            On-chain memos are PUBLIC and permanent. Anyone can read them.
          </span>
          <button
            onClick={s.dismissNotice}
            className="ml-auto font-mono text-[10px] text-dim hover:text-fg"
            title="Dismiss for this session"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ---------- LEFT: thread rail ---------- */}
        <div className="flex w-60 shrink-0 flex-col border-r border-line">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span style={PIXEL} className="text-[9px] uppercase tracking-widest text-[var(--m-accent)]">
              threads
            </span>
            <button
              onClick={() => refreshInbox()}
              title="Refresh inbox"
              className={cn(
                "ml-auto font-mono text-[12px] text-dim hover:text-[var(--m-accent)]",
                inbox.isFetching && "tek-pulse text-[var(--m-accent)]"
              )}
            >
              ↻
            </button>
          </div>

          <button
            onClick={() => {
              s.selectThread(null);
              s.setComposeRecipient("");
            }}
            className={cn(
              "mx-3 mt-3 rounded border py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
              s.selectedThread === null
                ? "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)]"
                : "border-line text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
            )}
          >
            + new message
          </button>

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {!wallet.publicKey ? (
              <div className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-dim tek-pulse">
                connect for inbox
              </div>
            ) : inbox.isLoading ? (
              <div className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-dim tek-pulse">
                scanning chain…
              </div>
            ) : threads.length === 0 ? (
              <div className="px-3 py-4 font-mono text-[10px] text-dim">
                no memos in the last 40 txs
              </div>
            ) : (
              threads.map((t) => {
                const unread = s.unreadByThread[t.counterparty] ?? 0;
                const selected = s.selectedThread === t.counterparty;
                return (
                  <div
                    key={t.counterparty}
                    role="button"
                    tabIndex={0}
                    onClick={() => s.selectThread(t.counterparty)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") s.selectThread(t.counterparty);
                    }}
                    className={cn(
                      "cursor-pointer border-l-2 px-3 py-2 transition-colors",
                      selected
                        ? "border-[var(--m-accent)] bg-[var(--m-glow)]"
                        : "border-transparent hover:bg-cell2/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {unread > 0 && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--m-accent2)]" />
                      )}
                      <Address addr={t.counterparty} className="text-[11px] font-bold" />
                      {t.last.isTek && (
                        <span
                          style={PIXEL}
                          className="text-[7px] uppercase text-[var(--m-accent)]"
                        >
                          TEK
                        </span>
                      )}
                      <span style={PIXEL} className="ml-auto text-[8px] text-dim">
                        {t.last.blockTime ? timeAgo(t.last.blockTime) : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-dim">
                      {t.last.direction === "in" ? "◂ " : "▸ "}
                      {t.last.text.slice(0, 36)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ---------- RIGHT: thread view + composer ---------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* thread header */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            {activeThread ? (
              <>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
                  channel
                </span>
                <Address addr={activeThread.counterparty} chars={6} className="text-[11px] font-bold text-[var(--m-accent)]" />
                <span className="ml-auto font-mono text-[9px] text-dim">
                  {activeThread.messages.length} msg{activeThread.messages.length === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
                new message — enter a recipient below
              </span>
            )}
          </div>

          {/* terminal lines */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
            {activeThread ? (
              activeThread.messages.map((m) => <MessageRow key={m.signature} m={m} />)
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <div style={PIXEL} className="text-lg text-[var(--m-accent)]">
                  [&gt;]
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                  select a thread or page a wallet
                </div>
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-line p-3">
            {!s.selectedThread && (
              <input
                value={s.composeRecipient}
                onChange={(e) => s.setComposeRecipient(e.target.value)}
                placeholder="recipient wallet address"
                spellCheck={false}
                className={cn(
                  "mb-2 w-full rounded border bg-cell2/50 px-2.5 py-1.5 font-mono text-[11px] text-fg outline-none placeholder:text-dim",
                  recipientInvalid
                    ? "border-down"
                    : "border-line focus:border-[var(--m-accent)]"
                )}
              />
            )}
            {recipientInvalid && (
              <div className="mb-2 font-mono text-[9px] text-down">invalid pubkey</div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={draftRef}
                value={s.draft}
                onChange={(e) => s.setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={2}
                placeholder={wallet.publicKey ? "type a memo… (enter to send)" : "connect wallet to send"}
                spellCheck={false}
                className={cn(
                  "min-w-0 flex-1 resize-none rounded border bg-cell2/50 px-2.5 py-1.5 font-mono text-[11px] text-fg outline-none placeholder:text-dim",
                  overBytes ? "border-down" : "border-line focus:border-[var(--m-accent)]"
                )}
              />
              <button
                disabled={!canSend}
                onClick={() => void handleSend()}
                className={cn(
                  "shrink-0 rounded border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-colors",
                  canSend
                    ? "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black"
                    : "cursor-not-allowed border-line text-dim"
                )}
              >
                {s.sending ? "…" : !wallet.publicKey ? "connect" : "send"}
              </button>
            </div>

            <div className="mt-1.5 flex items-center font-mono text-[9px] text-dim">
              <span>costs 1 lamport + network fee · public + permanent</span>
              <span
                style={PIXEL}
                className={cn("ml-auto text-[8px]", overBytes ? "text-down" : "text-dim")}
              >
                {bytes}/{MAX_MEMO_BYTES}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
