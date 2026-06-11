"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { useIncineratorStore } from "./store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      HEATING FURNACE
    </div>
  ),
});

/* cross-module: any module can request a mint be burned */
bus.on("token:burn", ({ mint }) => {
  useIncineratorStore.getState().setPendingBurnMint(mint);
  useKernelStore.getState().focus("incinerator");
});

export const incinerator: ModuleDefinition = {
  id: "incinerator",
  slot: 4,
  title: "Incinerator",
  tagline: "burn dust · reclaim rent",
  glyph: "[~]",
  accent: "#ff3b1f",
  Ambient,
  Focused,
  hotkeys: [
    { key: "X", label: "toggle row" },
    { key: "E", label: "select all empty" },
  ],
  commands: [
    {
      id: "scan",
      label: "Scan wallet for dust",
      hint: "incinerator",
      run: () => useKernelStore.getState().focus("incinerator"),
    },
    {
      id: "incinerate",
      label: "Incinerate selected",
      hint: "hold-to-burn",
      run: () => useKernelStore.getState().focus("incinerator"),
    },
  ],
};
