"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { useKernelStore } from "@/kernel/store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING LAUNCHPAD
    </div>
  ),
});

export const launchpad: ModuleDefinition = {
  id: "launchpad",
  slot: 1,
  title: "Launchpad",
  tagline: "pump.fun token foundry",
  glyph: "[^]",
  accent: "#ff8a00",
  Ambient,
  Focused,
  hotkeys: [{ key: "↵", label: "advance step" }],
  commands: [
    {
      id: "launch",
      label: "Launch a token",
      hint: "pump.fun",
      run: () => useKernelStore.getState().focus("launchpad"),
    },
  ],
};
