"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { getTokensByMints } from "./lib";
import { useSwapStore } from "./store";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING SWAP
    </div>
  ),
});

/* cross-module: anything can request a swap pair */
bus.on("token:swap", async ({ inputMint, outputMint }) => {
  try {
    const mints = [outputMint, ...(inputMint ? [inputMint] : [])];
    const tokens = await getTokensByMints(mints);
    const st = useSwapStore.getState();
    const out = tokens.find((t) => t.id === outputMint);
    if (out) st.setOutput(out);
    if (inputMint) {
      const inp = tokens.find((t) => t.id === inputMint);
      if (inp) st.setInput(inp);
    }
  } finally {
    useKernelStore.getState().focus("swap");
  }
});

export const swap: ModuleDefinition = {
  id: "swap",
  slot: 2,
  title: "Swap",
  tagline: "jupiter aggregated routing",
  glyph: "⇄",
  accent: "#00d1ff",
  Ambient,
  Focused,
  hotkeys: [{ key: "F", label: "flip pair" }],
  commands: [
    {
      id: "open",
      label: "Swap tokens",
      hint: "jupiter",
      run: () => useKernelStore.getState().focus("swap"),
    },
    {
      id: "flip",
      label: "Flip swap pair",
      run: () => {
        useSwapStore.getState().flip();
        useKernelStore.getState().focus("swap");
      },
    },
  ],
};
