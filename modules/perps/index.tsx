"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { useKernelStore } from "@/kernel/store";
import { PERP_MARKETS, type PerpMarket } from "./lib";
import { usePerpsStore } from "./store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING PERPS
    </div>
  ),
});

function openMarket(m: PerpMarket) {
  usePerpsStore.getState().setMarket(m);
  useKernelStore.getState().focus("perps");
}

export const perps: ModuleDefinition = {
  id: "perps",
  slot: 8,
  title: "Perps",
  tagline: "drift perpetuals · dlob feed",
  glyph: "[%]",
  accent: "#ffb224",
  Ambient,
  Focused,
  hotkeys: [
    { key: "B/S", label: "long/short" },
    { key: "M/L", label: "market/limit" },
  ],
  commands: PERP_MARKETS.map((m) => ({
    id: `open-${m.toLowerCase()}`,
    label: `Open ${m} book`,
    hint: "dlob",
    run: () => openMarket(m),
  })),
};
