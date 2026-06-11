"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { useRadarStore } from "./store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING RADAR
    </div>
  ),
});

/* cross-module: any module can push a token onto the scope */
bus.on("token:inspect", ({ mint }) => {
  const st = useRadarStore.getState();
  st.setTab("trending");
  st.select(mint);
  useKernelStore.getState().focus("radar");
});

export const radar: ModuleDefinition = {
  id: "radar",
  slot: 5,
  title: "Radar",
  tagline: "token intelligence sweep",
  glyph: "[o]",
  accent: "#39ff88",
  Ambient,
  Focused,
  hotkeys: [
    { key: "T/N", label: "tabs" },
    { key: "↑↓", label: "select row" },
  ],
  commands: [
    {
      id: "scan",
      label: "Scan trending tokens",
      hint: "dexscreener",
      run: () => {
        useRadarStore.getState().setTab("trending");
        useKernelStore.getState().focus("radar");
      },
    },
    {
      id: "events",
      label: "Open radar events feed",
      hint: "spike log",
      run: () => useKernelStore.getState().focus("radar"),
    },
  ],
};
