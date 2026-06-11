"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import type { FeedLine } from "@/components/tek/TerminalFeed";

export type WizardStep = "identity" | "image" | "economics" | "review";

export const STEP_ORDER: WizardStep[] = ["identity", "image", "economics", "review"];

export interface LaunchFields {
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
}

export interface LaunchRecord {
  mint: string;
  name: string;
  symbol: string;
  signature: string;
  ts: number;
}

const EMPTY_FIELDS: LaunchFields = {
  name: "",
  symbol: "",
  description: "",
  twitter: "",
  telegram: "",
  website: "",
};

const LS_KEY = "tek:launchpad:launches";

function loadLaunches(): LaunchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LaunchRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLaunches(list: LaunchRecord[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

/* ---------- validation (shared by Ambient checklist + Focused gates) ---------- */

export function identityValid(f: LaunchFields): boolean {
  const name = f.name.trim();
  const sym = f.symbol.trim();
  return name.length > 0 && name.length <= 32 && sym.length > 0 && sym.length <= 10 && !/\s/.test(sym);
}

export function imageValid(file: File | null): boolean {
  return file != null;
}

export function economicsValid(devBuySol: string): boolean {
  if (devBuySol.trim() === "") return true; // empty = 0 dev buy
  const n = parseFloat(devBuySol);
  return isFinite(n) && n >= 0 && n <= 85;
}

interface LaunchpadStore {
  step: WizardStep;
  fields: LaunchFields;
  imageFile: File | null;
  /** object URL for preview rendering */
  imageUrl: string | null;
  devBuySol: string;
  launching: boolean;
  lines: FeedLine[];
  myLaunches: LaunchRecord[];
  hydrated: boolean;
  lastLaunch: LaunchRecord | null;
  setStep: (s: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setField: (k: keyof LaunchFields, v: string) => void;
  setImage: (f: File | null) => void;
  setDevBuySol: (v: string) => void;
  setLaunching: (b: boolean) => void;
  pushLine: (text: string, tone?: FeedLine["tone"]) => void;
  clearConsole: () => void;
  addLaunch: (r: LaunchRecord) => void;
  /** load persisted launches after mount (avoids SSR hydration mismatch) */
  hydrate: () => void;
  resetWizard: () => void;
  /** wallet-change reset: never leave a stale launching state */
  reset: () => void;
}

export const useLaunchpadStore = create<LaunchpadStore>((set, get) => ({
  step: "identity",
  fields: EMPTY_FIELDS,
  imageFile: null,
  imageUrl: null,
  devBuySol: "",
  launching: false,
  lines: [],
  myLaunches: [],
  hydrated: false,
  lastLaunch: null,

  setStep: (s) => set({ step: s }),
  nextStep: () =>
    set((s) => {
      const i = STEP_ORDER.indexOf(s.step);
      return { step: STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)] };
    }),
  prevStep: () =>
    set((s) => {
      const i = STEP_ORDER.indexOf(s.step);
      return { step: STEP_ORDER[Math.max(i - 1, 0)] };
    }),

  setField: (k, v) => set((s) => ({ fields: { ...s.fields, [k]: v } })),

  setImage: (f) => {
    const prev = get().imageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ imageFile: f, imageUrl: f ? URL.createObjectURL(f) : null });
  },

  setDevBuySol: (v) => set({ devBuySol: v }),
  setLaunching: (b) => set({ launching: b }),

  pushLine: (text, tone) =>
    set((s) => ({ lines: [...s.lines, { text, tone, ts: Date.now() }].slice(-200) })),
  clearConsole: () => set({ lines: [] }),

  addLaunch: (r) =>
    set((s) => {
      const myLaunches = [r, ...s.myLaunches].slice(0, 50);
      saveLaunches(myLaunches);
      return { myLaunches, lastLaunch: r };
    }),

  hydrate: () => {
    if (get().hydrated) return;
    set({ myLaunches: loadLaunches(), hydrated: true });
  },

  resetWizard: () => {
    const prev = get().imageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      step: "identity",
      fields: EMPTY_FIELDS,
      imageFile: null,
      imageUrl: null,
      devBuySol: "",
      lastLaunch: null,
      lines: [],
    });
  },

  reset: () => set({ launching: false }),
}));

registerWalletReset(() => useLaunchpadStore.getState().reset());
