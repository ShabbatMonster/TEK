"use client";

import { create } from "zustand";
import type { ModuleId } from "./types";

export interface TrackedTx {
  signature?: string;
  module: ModuleId;
  label: string;
  status: "pending" | "confirmed" | "failed";
  at: number;
}

interface KernelStore {
  focused: ModuleId | null;
  hovered: ModuleId | null;
  paletteOpen: boolean;
  cheatOpen: boolean;
  manifestoOpen: boolean;
  txs: TrackedTx[];
  focus: (id: ModuleId | null) => void;
  setHovered: (id: ModuleId | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setCheatOpen: (open: boolean) => void;
  setManifestoOpen: (open: boolean) => void;
  trackTx: (tx: TrackedTx) => void;
  updateTx: (signature: string, status: TrackedTx["status"]) => void;
}

export const useKernelStore = create<KernelStore>((set) => ({
  focused: null,
  hovered: null,
  paletteOpen: false,
  cheatOpen: false,
  // The article overlay greets every fresh page open; TekKernel is client-only
  // (ssr:false) so this never causes a hydration mismatch.
  manifestoOpen: true,
  txs: [],
  focus: (id) => set({ focused: id, paletteOpen: false }),
  setHovered: (id) => set({ hovered: id }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setCheatOpen: (open) => set({ cheatOpen: open }),
  setManifestoOpen: (open) => set({ manifestoOpen: open }),
  trackTx: (tx) => set((s) => ({ txs: [tx, ...s.txs].slice(0, 30) })),
  updateTx: (signature, status) =>
    set((s) => ({
      txs: s.txs.map((t) => (t.signature === signature ? { ...t, status } : t)),
    })),
}));

/* ---------- wallet-change reset registry ---------- */

const resetFns = new Set<() => void>();

/** Modules register their store reset; kernel fires all on wallet change. */
export function registerWalletReset(fn: () => void): void {
  resetFns.add(fn);
}

export function fireWalletResets(): void {
  resetFns.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("[tek] wallet reset failed", e);
    }
  });
}
