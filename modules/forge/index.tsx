"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { useKernelStore } from "@/kernel/store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING FORGE
    </div>
  ),
});

export const forge: ModuleDefinition = {
  id: "forge",
  slot: 7,
  title: "Forge",
  tagline: "repo auditor",
  glyph: "[=]",
  accent: "#ffd60a",
  Ambient,
  Focused,
  hotkeys: [{ key: "↵", label: "run audit" }],
  commands: [
    {
      id: "audit",
      label: "Audit a GitHub repo",
      hint: "forge",
      run: () => useKernelStore.getState().focus("forge"),
    },
  ],
};
