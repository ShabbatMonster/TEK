"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import type { L2Book, PerpMarket } from "./lib";

export type PerpSide = "long" | "short";
export type PerpOrderType = "market" | "limit";

export interface PaperPosition {
  id: string;
  market: PerpMarket;
  side: PerpSide;
  /** base units */
  size: number;
  entryPrice: number;
  leverage: number;
  /** USD locked as margin */
  collateral: number;
  /** approx liquidation price */
  liqPrice: number;
  ts: number;
}

const PAPER_KEY = "tek:perps:paper";
const START_BALANCE = 10_000;

interface PaperState {
  balance: number;
  realized: number;
  positions: PaperPosition[];
}

function readPaper(): PaperState {
  if (typeof window === "undefined") return { balance: START_BALANCE, realized: 0, positions: [] };
  try {
    const raw = localStorage.getItem(PAPER_KEY);
    if (!raw) return { balance: START_BALANCE, realized: 0, positions: [] };
    const p = JSON.parse(raw) as PaperState;
    return {
      balance: typeof p.balance === "number" ? p.balance : START_BALANCE,
      realized: typeof p.realized === "number" ? p.realized : 0,
      positions: Array.isArray(p.positions) ? p.positions : [],
    };
  } catch {
    return { balance: START_BALANCE, realized: 0, positions: [] };
  }
}

function writePaper(p: PaperState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PAPER_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode — paper state stays in memory only */
  }
}

function liqOf(side: PerpSide, entry: number, leverage: number): number {
  // simplified cross-margin approximation (matches the ticket preview)
  return side === "long"
    ? entry * (1 - (1 / leverage) * 0.9)
    : entry * (1 + (1 / leverage) * 0.9);
}

interface PerpsStore {
  market: PerpMarket;
  side: PerpSide;
  orderType: PerpOrderType;
  /** size in base units, raw input string */
  sizeInput: string;
  /** 1–20x */
  leverage: number;
  /** raw input string, USD */
  limitPrice: string;
  /** last observed mid per market (tick direction source) */
  lastMid: Partial<Record<PerpMarket, number>>;
  /** last tick direction per market: 1 up, -1 down, 0 unknown */
  tickDir: Partial<Record<PerpMarket, 1 | -1 | 0>>;
  /** last successfully normalized book per market — shown greyed when feed degrades */
  lastGoodBook: Partial<Record<PerpMarket, L2Book>>;
  /* ---- paper trading account ---- */
  paperBalance: number;
  paperRealized: number;
  positions: PaperPosition[];
  paperHydrated: boolean;
  hydratePaper: () => void;
  openPosition: (p: {
    market: PerpMarket;
    side: PerpSide;
    size: number;
    entryPrice: number;
    leverage: number;
  }) => { ok: boolean; reason?: string };
  closePosition: (id: string, exitPrice: number) => void;
  resetPaper: () => void;
  setMarket: (m: PerpMarket) => void;
  setSide: (s: PerpSide) => void;
  setOrderType: (t: PerpOrderType) => void;
  setSizeInput: (v: string) => void;
  setLeverage: (x: number) => void;
  setLimitPrice: (v: string) => void;
  /** record a good book: stores it + updates lastMid/tickDir */
  recordBook: (m: PerpMarket, book: L2Book) => void;
  reset: () => void;
}

export const usePerpsStore = create<PerpsStore>((set, get) => ({
  market: "SOL-PERP",
  side: "long",
  orderType: "market",
  sizeInput: "",
  leverage: 5,
  limitPrice: "",
  lastMid: {},
  tickDir: {},
  lastGoodBook: {},
  paperBalance: START_BALANCE,
  paperRealized: 0,
  positions: [],
  paperHydrated: false,
  hydratePaper: () =>
    set((s) => {
      if (s.paperHydrated) return {};
      const p = readPaper();
      return { ...p, paperBalance: p.balance, paperRealized: p.realized, positions: p.positions, paperHydrated: true };
    }),
  openPosition: ({ market, side, size, entryPrice, leverage }) => {
    const s = get();
    if (!(size > 0) || !(entryPrice > 0)) return { ok: false, reason: "invalid size/price" };
    const notional = size * entryPrice;
    const collateral = notional / leverage;
    if (collateral > s.paperBalance) return { ok: false, reason: "insufficient paper margin" };
    const pos: PaperPosition = {
      id: `${market}-${side}-${size}-${entryPrice.toFixed(4)}-${s.positions.length}`,
      market,
      side,
      size,
      entryPrice,
      leverage,
      collateral,
      liqPrice: liqOf(side, entryPrice, leverage),
      ts: Date.now(),
    };
    const next: PaperState = {
      balance: s.paperBalance - collateral,
      realized: s.paperRealized,
      positions: [pos, ...s.positions],
    };
    writePaper(next);
    set({ paperBalance: next.balance, positions: next.positions });
    return { ok: true };
  },
  closePosition: (id, exitPrice) => {
    const s = get();
    const pos = s.positions.find((p) => p.id === id);
    if (!pos) return;
    const dir = pos.side === "long" ? 1 : -1;
    const pnl = (exitPrice - pos.entryPrice) * pos.size * dir;
    const next: PaperState = {
      balance: s.paperBalance + pos.collateral + pnl,
      realized: s.paperRealized + pnl,
      positions: s.positions.filter((p) => p.id !== id),
    };
    writePaper(next);
    set({ paperBalance: next.balance, paperRealized: next.realized, positions: next.positions });
  },
  resetPaper: () => {
    const next: PaperState = { balance: START_BALANCE, realized: 0, positions: [] };
    writePaper(next);
    set({ paperBalance: START_BALANCE, paperRealized: 0, positions: [] });
  },
  setMarket: (m) => set({ market: m }),
  setSide: (s) => set({ side: s }),
  setOrderType: (t) => set({ orderType: t }),
  setSizeInput: (v) => set({ sizeInput: v }),
  setLeverage: (x) => set({ leverage: Math.min(20, Math.max(1, Math.round(x))) }),
  setLimitPrice: (v) => set({ limitPrice: v }),
  recordBook: (m, book) =>
    set((s) => {
      const bb = book.bids[0]?.price;
      const ba = book.asks[0]?.price;
      const mid = bb != null && ba != null ? (bb + ba) / 2 : bb ?? ba;
      if (mid == null) return { lastGoodBook: { ...s.lastGoodBook, [m]: book } };
      const prev = s.lastMid[m];
      const dir: 1 | -1 | 0 =
        prev == null || mid === prev ? s.tickDir[m] ?? 0 : mid > prev ? 1 : -1;
      return {
        lastGoodBook: { ...s.lastGoodBook, [m]: book },
        lastMid: { ...s.lastMid, [m]: mid },
        tickDir: { ...s.tickDir, [m]: dir },
      };
    }),
  reset: () =>
    set({ side: "long", orderType: "market", sizeInput: "", leverage: 5, limitPrice: "" }),
}));

registerWalletReset(() => usePerpsStore.getState().reset());
