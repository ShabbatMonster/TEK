"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/cn";
import { useOracleStore, type OracleMessage } from "./store";

const PROMPT_DECK = [
  "Explain how Solana priority fees work",
  "What is a bonding curve launch?",
  "How do I evaluate a new SPL token for rug risk?",
  "Explain Drift perp funding rates",
  "What does closing a token account do?",
  "Explain Jupiter routing",
];

/** split assistant text into [first sentence, rest] for the serif voice */
function splitFirstSentence(text: string): [string, string] {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  if (!m) return [text, ""];
  return [m[0], text.slice(m[0].length)];
}

function OfflinePanel() {
  const [copied, setCopied] = useState(false);
  const snippet = "ANTHROPIC_API_KEY=sk-ant-...";
  return (
    <div className="rounded-xl border border-[var(--m-accent)]/30 bg-[var(--m-glow)] p-5">
      <div className="m-display text-base italic text-[var(--m-accent)]">
        The Oracle is silent.
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
        ORACLE OFFLINE — set ANTHROPIC_API_KEY in .env
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded border border-line bg-cell px-2 py-1.5 font-mono text-[10px] text-fg/80">
          {snippet}
        </code>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(snippet).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded border border-line px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-dim transition-colors hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="mt-2 font-mono text-[10px] leading-relaxed text-dim">
        1. add the line above to <span className="text-fg/70">.env</span> at the repo root
        <br />
        2. restart the dev server — the eye will open
      </div>
    </div>
  );
}

function MessageLine({ msg, streamingTail }: { msg: OracleMessage; streamingTail: boolean }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-cell2/60 px-3 py-2 text-right font-mono text-[11.5px] leading-relaxed text-fg/90">
          <span className="mr-1.5 select-none text-[var(--m-accent2)]">&gt;</span>
          {msg.content}
        </div>
      </div>
    );
  }

  const [first, rest] = splitFirstSentence(msg.content);
  return (
    <div className="max-w-[92%] whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg/90">
      <span className="m-display text-[15px] italic leading-snug text-[var(--m-accent)]">
        {first}
      </span>
      {rest}
      {streamingTail && (
        <span className="ml-0.5 inline-block text-[var(--m-accent)] tek-pulse">▌</span>
      )}
      {msg.content === "" && !streamingTail && (
        <span className="font-mono text-[10px] text-dim">…</span>
      )}
    </div>
  );
}

export default function OracleFocused() {
  const { publicKey } = useWallet();
  const messages = useOracleStore((s) => s.messages);
  const streaming = useOracleStore((s) => s.streaming);
  const offline = useOracleStore((s) => s.offline);
  const pendingPrompt = useOracleStore((s) => s.pendingPrompt);
  const clear = useOracleStore((s) => s.clear);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const walletRef = useRef<string | undefined>(undefined);
  walletRef.current = publicKey?.toBase58();

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    const st = useOracleStore.getState();
    if (!text || st.streaming) return;

    const history = [
      ...st.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];
    st.push({ role: "user", content: text });
    st.push({ role: "assistant", content: "" });
    st.setStreaming(true);

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: walletRef.current ? { wallet: walletRef.current } : undefined,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as { offline?: boolean; error?: string };
        if (data.offline) {
          useOracleStore.getState().setOffline(true);
          useOracleStore
            .getState()
            .replaceLast("⟂ The Oracle is offline. Set ANTHROPIC_API_KEY in .env and restart.");
        } else {
          useOracleStore
            .getState()
            .replaceLast(`⚠ oracle error — ${data.error ?? `status ${res.status}`}`);
        }
        return;
      }

      if (!res.ok || !res.body) {
        useOracleStore.getState().replaceLast(`⚠ oracle error — status ${res.status}`);
        return;
      }

      useOracleStore.getState().setOffline(false);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          useOracleStore.getState().appendToLast(decoder.decode(value, { stream: true }));
        }
        const tail = decoder.decode();
        if (tail) useOracleStore.getState().appendToLast(tail);
      } finally {
        reader.releaseLock();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stream interrupted";
      useOracleStore.getState().appendToLast(`\n\n⚠ ${msg}`);
    } finally {
      useOracleStore.getState().setStreaming(false);
    }
  }, []);

  /* consume prompts queued by the bus / palette / ambient ask-bar */
  useEffect(() => {
    if (!pendingPrompt) return;
    useOracleStore.getState().setPendingPrompt(null);
    if (useOracleStore.getState().streaming) {
      setInput(pendingPrompt); // mid-stream: park it in the composer instead
    } else {
      void send(pendingPrompt);
    }
  }, [pendingPrompt, send]);

  /* keep thread pinned to the newest token */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!streaming) textareaRef.current?.focus();
  }, [streaming]);

  function submit() {
    if (streaming) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text);
  }

  const lastIdx = messages.length - 1;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="aurora" />

      {/* thread */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {offline && <OfflinePanel />}

          {messages.length === 0 && !offline && (
            <div className="flex flex-col items-center gap-3 pt-14 text-center">
              <div className="m-display text-xl italic text-[var(--m-accent)]">
                Ask, and the chain answers.
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-dim">
                solana protocol analyst · no tools · v1
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageLine
              key={i}
              msg={m}
              streamingTail={streaming && i === lastIdx && m.role === "assistant"}
            />
          ))}
        </div>
      </div>

      {/* deck + composer */}
      <div className="relative z-10 border-t border-line bg-cell/60 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PROMPT_DECK.map((p) => (
              <button
                key={p}
                disabled={streaming}
                onClick={() => void send(p)}
                className={cn(
                  "rounded-full border border-line px-2.5 py-1 font-mono text-[9px] text-dim transition-colors",
                  streaming
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
                )}
              >
                {p}
              </button>
            ))}
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="ml-auto rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-dim transition-colors hover:border-down hover:text-down"
              >
                clear
              </button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={streaming}
              rows={2}
              placeholder={streaming ? "the oracle is speaking…" : "ask the oracle…  (⏎ send · ⇧⏎ newline)"}
              className={cn(
                "w-full resize-none rounded-xl border border-line bg-cell2/50 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-fg outline-none transition-colors placeholder:text-dim/70",
                "focus:border-[var(--m-accent)]/60",
                streaming && "cursor-not-allowed opacity-60"
              )}
            />
            <button
              onClick={submit}
              disabled={streaming || !input.trim()}
              className={cn(
                "shrink-0 rounded-xl border px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-all",
                !streaming && input.trim()
                  ? "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black"
                  : "cursor-not-allowed border-line text-dim"
              )}
              title="Send (⌘↵)"
            >
              {streaming ? "…" : "ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
