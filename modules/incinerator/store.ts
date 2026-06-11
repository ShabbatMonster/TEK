"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import type { FeedLine } from "@/components/tek/TerminalFeed";
import { readLifetime, writeLifetime, type Lifetime } from "./lib";

interface IncineratorStore {
  /** selected token-account pubkeys (base58) */
  selected: Set<string>;
  burning: boolean;
  feed: FeedLine[];
  /** mint queued by the `token:burn` bus event — consumed once scan data exists */
  pendingBurnMint: string | null;
  /** lifetime totals; hydrated from localStorage on the client */
  lifetime: Lifetime;
  lifetimeHydrated: boolean;

  toggle: (pubkey: string) => void;
  setMany: (pubkeys: string[], on: boolean) => void;
  clearSelection: () => void;
  setBurning: (b: boolean) => void;
  pushFeed: (line: FeedLine) => void;
  clearFeed: () => void;
  setPendingBurnMint: (mint: string | null) => void;
  hydrateLifetime: () => void;
  addLifetime: (accounts: number, sol: number) => void;
  reset: () => void;
}

export const useIncineratorStore = create<IncineratorStore>((set, get) => ({
  selected: new Set<string>(),
  burning: false,
  feed: [],
  pendingBurnMint: null,
  lifetime: { sol: 0, accounts: 0 },
  lifetimeHydrated: false,

  toggle: (pubkey) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return { selected: next };
    }),

  setMany: (pubkeys, on) =>
    set((s) => {
      const next = new Set(s.selected);
      for (const pk of pubkeys) {
        if (on) next.add(pk);
        else next.delete(pk);
      }
      return { selected: next };
    }),

  clearSelection: () => set({ selected: new Set<string>() }),
  setBurning: (b) => set({ burning: b }),
  pushFeed: (line) => set((s) => ({ feed: [...s.feed, line].slice(-200) })),
  clearFeed: () => set({ feed: [] }),
  setPendingBurnMint: (mint) => set({ pendingBurnMint: mint }),

  hydrateLifetime: () => {
    if (get().lifetimeHydrated) return;
    set({ lifetime: readLifetime(), lifetimeHydrated: true });
  },

  addLifetime: (accounts, sol) => {
    const cur = get().lifetimeHydrated ? get().lifetime : readLifetime();
    const next: Lifetime = {
      sol: cur.sol + sol,
      accounts: cur.accounts + accounts,
    };
    writeLifetime(next);
    set({ lifetime: next, lifetimeHydrated: true });
  },

  reset: () =>
    set({
      selected: new Set<string>(),
      burning: false,
      feed: [],
      pendingBurnMint: null,
    }),
}));

registerWalletReset(() => useIncineratorStore.getState().reset());
