"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import type { MemoMsg } from "./lib";

const NOTICE_KEY = "tek-signal-notice-dismissed";

interface SignalStore {
  /** counterparty address of the open thread, or null for fresh compose */
  selectedThread: string | null;
  /** recipient prefill (bus `signal:compose` / ambient quick-compose) */
  composeRecipient: string;
  /** composer draft text */
  draft: string;
  unreadCount: number;
  unreadByThread: Record<string, number>;
  /** signatures we've already accounted for (no re-toast / re-count) */
  seenSignatures: Set<string>;
  /** first inbox load seeds seenSignatures silently */
  primed: boolean;
  sending: boolean;
  noticeDismissed: boolean;

  selectThread: (addr: string | null) => void;
  setComposeRecipient: (v: string) => void;
  setDraft: (v: string) => void;
  setSending: (v: boolean) => void;
  dismissNotice: () => void;
  /** hydrate noticeDismissed from sessionStorage (call from an effect) */
  hydrateNotice: () => void;
  /**
   * Fold a fetched inbox into the seen-set. Returns the messages that are
   * genuinely new incoming (for toasting); bumps unread counters for them.
   */
  absorbInbox: (msgs: MemoMsg[]) => MemoMsg[];
  reset: () => void;
}

export const useSignalStore = create<SignalStore>((set, get) => ({
  selectedThread: null,
  composeRecipient: "",
  draft: "",
  unreadCount: 0,
  unreadByThread: {},
  seenSignatures: new Set<string>(),
  primed: false,
  sending: false,
  noticeDismissed: false,

  selectThread: (addr) =>
    set((s) => {
      if (addr === null) return { selectedThread: null };
      const cleared = s.unreadByThread[addr] ?? 0;
      if (cleared === 0) return { selectedThread: addr };
      const unreadByThread = { ...s.unreadByThread };
      delete unreadByThread[addr];
      return {
        selectedThread: addr,
        unreadByThread,
        unreadCount: Math.max(0, s.unreadCount - cleared),
      };
    }),

  setComposeRecipient: (v) => set({ composeRecipient: v }),
  setDraft: (v) => set({ draft: v }),
  setSending: (v) => set({ sending: v }),

  dismissNotice: () => {
    try {
      window.sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    set({ noticeDismissed: true });
  },

  hydrateNotice: () => {
    try {
      if (window.sessionStorage.getItem(NOTICE_KEY) === "1") {
        set({ noticeDismissed: true });
      }
    } catch {
      /* storage unavailable */
    }
  },

  absorbInbox: (msgs) => {
    const s = get();
    const fresh = s.primed
      ? msgs.filter(
          (m) => m.direction === "in" && !s.seenSignatures.has(m.signature)
        )
      : [];
    const seenSignatures = new Set(s.seenSignatures);
    for (const m of msgs) seenSignatures.add(m.signature);

    let unreadCount = s.unreadCount;
    const unreadByThread = { ...s.unreadByThread };
    for (const m of fresh) {
      // messages for the currently-open thread are read on arrival
      if (m.counterparty === s.selectedThread) continue;
      unreadByThread[m.counterparty] = (unreadByThread[m.counterparty] ?? 0) + 1;
      unreadCount++;
    }

    set({ seenSignatures, unreadCount, unreadByThread, primed: true });
    return fresh;
  },

  reset: () =>
    set({
      selectedThread: null,
      composeRecipient: "",
      draft: "",
      unreadCount: 0,
      unreadByThread: {},
      seenSignatures: new Set<string>(),
      primed: false,
      sending: false,
    }),
}));

registerWalletReset(() => useSignalStore.getState().reset());
