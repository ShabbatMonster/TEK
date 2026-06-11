"use client";

import { create } from "zustand";
import { registerWalletReset } from "@/kernel/store";
import { toast } from "@/kernel/toast";
import { fmtPct } from "@/lib/format";
import type { FeedLine } from "@/components/tek/TerminalFeed";
import { pickBestPairs, type DexPair } from "./lib";

export type RadarTab = "trending" | "listings";

/** One observation of a pair, kept in a per-token ring buffer. */
export interface PairSnap {
  t: number;
  price: number;
  d5: number;
  volM5: number;
  volH1: number;
}

const SNAP_MAX = 20;
const EVENTS_MAX = 100;
const SPIKE_COOLDOWN_MS = 10 * 60_000; // max one alert per token per 10min
const SPIKE_D5_PCT = 15; // |Δ5m| threshold
const SPIKE_VOL_RATIO = 0.3; // m5 vol > 30% of h1 vol

interface RadarStore {
  selected: string | null;
  tab: RadarTab;
  cursor: number;
  /** ring buffers of pair snapshots, keyed by token address */
  snaps: Record<string, PairSnap[]>;
  /** spike event log for the EVENTS feed */
  events: FeedLine[];
  /** dedupe map: token address -> last spike alert ts */
  spikeAt: Record<string, number>;
  /** last react-query dataUpdatedAt ingested (dedupes Ambient+Focused both feeding) */
  lastIngest: number;
  select: (addr: string | null) => void;
  setTab: (t: RadarTab) => void;
  setCursor: (i: number) => void;
  ingestPairs: (pairs: DexPair[], updatedAt: number) => void;
  reset: () => void;
}

export const useRadarStore = create<RadarStore>((set, get) => ({
  selected: null,
  tab: "trending",
  cursor: 0,
  snaps: {},
  events: [],
  spikeAt: {},
  lastIngest: 0,
  select: (addr) => set({ selected: addr }),
  setTab: (t) => set({ tab: t }),
  setCursor: (i) => set({ cursor: i }),

  /** SPIKE DETECTION — compare fresh pair data against ring-buffer history. */
  ingestPairs: (pairs, updatedAt) => {
    const s = get();
    if (updatedAt <= s.lastIngest) return; // already ingested this refetch
    const best = pickBestPairs(pairs);
    const snaps = { ...s.snaps };
    const spikeAt = { ...s.spikeAt };
    const newEvents: FeedLine[] = [];
    const now = Date.now();

    for (const p of Object.values(best)) {
      const addr = p.baseToken.address;
      const d5 = p.priceChange?.m5 ?? 0;
      const volM5 = p.volume?.m5 ?? 0;
      const volH1 = p.volume?.h1 ?? 0;
      const prev = snaps[addr] ?? [];
      snaps[addr] = [
        ...prev,
        { t: now, price: parseFloat(p.priceUsd ?? "0"), d5, volM5, volH1 },
      ].slice(-SNAP_MAX);

      if (prev.length === 0) continue; // need a baseline snapshot before alerting

      const pctSpike = Math.abs(d5) > SPIKE_D5_PCT;
      const volSpike = volH1 > 0 && volM5 > volH1 * SPIKE_VOL_RATIO;
      if (!pctSpike && !volSpike) continue;
      if (now - (spikeAt[addr] ?? 0) < SPIKE_COOLDOWN_MS) continue;
      spikeAt[addr] = now;

      const arrow = d5 >= 0 ? "▲" : "▼";
      const text = `${arrow} ${p.baseToken.symbol} ${fmtPct(d5)} 5m${volSpike ? " · vol spike" : ""}`;
      newEvents.push({
        text,
        tone: pctSpike ? (d5 >= 0 ? "up" : "down") : "warn",
        ts: now,
      });
      toast({ kind: "warn", title: "RADAR SPIKE", body: text });
    }

    set({
      snaps,
      spikeAt,
      lastIngest: updatedAt,
      events: newEvents.length
        ? [...s.events, ...newEvents].slice(-EVENTS_MAX)
        : s.events,
    });
  },

  reset: () => set({ selected: null, cursor: 0 }),
}));

registerWalletReset(() => useRadarStore.getState().reset());
