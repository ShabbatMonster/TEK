"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import { SOL_TOKEN, USDC_TOKEN, type JupToken } from "./lib";

interface SwapStore {
  input: JupToken;
  output: JupToken;
  amount: string; // ui units, string
  slippageBps: number;
  swapping: boolean;
  setInput: (t: JupToken) => void;
  setOutput: (t: JupToken) => void;
  setAmount: (a: string) => void;
  setSlippageBps: (bps: number) => void;
  setSwapping: (s: boolean) => void;
  flip: () => void;
  reset: () => void;
}

export const useSwapStore = create<SwapStore>((set) => ({
  input: SOL_TOKEN,
  output: USDC_TOKEN,
  amount: "",
  slippageBps: 50,
  swapping: false,
  setInput: (t) => set({ input: t }),
  setOutput: (t) => set({ output: t }),
  setAmount: (a) => set({ amount: a }),
  setSlippageBps: (bps) => set({ slippageBps: bps }),
  setSwapping: (s) => set({ swapping: s }),
  flip: () => set((s) => ({ input: s.output, output: s.input })),
  reset: () => set({ amount: "", swapping: false }),
}));

registerWalletReset(() => useSwapStore.getState().reset());
