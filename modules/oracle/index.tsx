"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { useOracleStore } from "./store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      WAKING THE ORACLE
    </div>
  ),
});

/* cross-module: any module can send the Oracle a prompt */
bus.on("oracle:ask", ({ prompt }) => {
  useOracleStore.getState().setPendingPrompt(prompt);
  useKernelStore.getState().focus("oracle");
});

export const oracle: ModuleDefinition = {
  id: "oracle",
  slot: 6,
  title: "Oracle",
  tagline: "ai chain intelligence",
  glyph: "[@]",
  accent: "#a78bfa",
  Ambient,
  Focused,
  hotkeys: [{ key: "⌘↵", label: "send" }],
  commands: [
    {
      id: "ask",
      label: "Ask the Oracle",
      hint: "ai chat",
      run: () => useKernelStore.getState().focus("oracle"),
    },
    {
      id: "clear",
      label: "Clear Oracle session",
      run: () => useOracleStore.getState().clear(),
    },
  ],
};
