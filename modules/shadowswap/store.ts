"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import type { VaultNote } from "./vault";

export type ShadowPanel = "burners" | "pool" | "vault";
export type ShadowCommand = "generate-burner";

interface ShadowStore {
  activePanel: ShadowPanel;
  /** palette commands drop a flag here; Focused panels consume it */
  pendingCommand: ShadowCommand | null;
  /** session burner pubkeys (base58). Secret keys are NEVER stored. */
  burners: string[];
  /* ---- local vault session (key material lives only in memory) ---- */
  vaultUnlocked: boolean;
  vaultKey: CryptoKey | null;
  /** base64 PBKDF2 salt paired with vaultKey, needed for re-encryption */
  vaultSalt: string | null;
  vaultNotes: VaultNote[];

  setActivePanel: (p: ShadowPanel) => void;
  issueCommand: (c: ShadowCommand) => void;
  clearCommand: () => void;
  addBurner: (pubkey: string) => void;
  setVaultSession: (key: CryptoKey, salt: string, notes: VaultNote[]) => void;
  setVaultNotes: (notes: VaultNote[]) => void;
  lockVault: () => void;
  reset: () => void;
}

const initial = {
  activePanel: "burners" as ShadowPanel,
  pendingCommand: null,
  burners: [] as string[],
  vaultUnlocked: false,
  vaultKey: null,
  vaultSalt: null,
  vaultNotes: [] as VaultNote[],
};

export const useShadowStore = create<ShadowStore>((set) => ({
  ...initial,
  setActivePanel: (p) => set({ activePanel: p }),
  issueCommand: (c) => set({ pendingCommand: c, activePanel: "burners" }),
  clearCommand: () => set({ pendingCommand: null }),
  addBurner: (pubkey) => set((s) => ({ burners: [pubkey, ...s.burners] })),
  setVaultSession: (key, salt, notes) =>
    set({ vaultUnlocked: true, vaultKey: key, vaultSalt: salt, vaultNotes: notes }),
  setVaultNotes: (notes) => set({ vaultNotes: notes }),
  lockVault: () =>
    set({ vaultUnlocked: false, vaultKey: null, vaultSalt: null, vaultNotes: [] }),
  reset: () => set({ ...initial }),
}));

/* wallet change: burners are identity-scoped → wipe; vault locks. */
registerWalletReset(() => useShadowStore.getState().reset());
