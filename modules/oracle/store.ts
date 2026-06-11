"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";

export interface OracleMessage {
  role: "user" | "assistant";
  content: string;
}

interface OracleStore {
  /** single session v1 */
  messages: OracleMessage[];
  streaming: boolean;
  /** server reported no ANTHROPIC_API_KEY */
  offline: boolean;
  /** set by bus/palette/ambient ask-bar, consumed by Focused on mount */
  pendingPrompt: string | null;
  push: (m: OracleMessage) => void;
  /** append a streamed chunk to the last assistant message */
  appendToLast: (chunk: string) => void;
  /** replace the last message's content (error surfacing) */
  replaceLast: (content: string) => void;
  setStreaming: (s: boolean) => void;
  setOffline: (o: boolean) => void;
  setPendingPrompt: (p: string | null) => void;
  clear: () => void;
}

export const useOracleStore = create<OracleStore>((set) => ({
  messages: [],
  streaming: false,
  offline: false,
  pendingPrompt: null,
  push: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendToLast: (chunk) =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (!last || last.role !== "assistant") return s;
      return {
        messages: [
          ...s.messages.slice(0, -1),
          { ...last, content: last.content + chunk },
        ],
      };
    }),
  replaceLast: (content) =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (!last) return s;
      return { messages: [...s.messages.slice(0, -1), { ...last, content }] };
    }),
  setStreaming: (streaming) => set({ streaming }),
  setOffline: (offline) => set({ offline }),
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  clear: () => set({ messages: [], streaming: false, pendingPrompt: null }),
}));

/* chat is not wallet-scoped — only drop any prompt queued for the old wallet */
registerWalletReset(() => useOracleStore.getState().setPendingPrompt(null));
