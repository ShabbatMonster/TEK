"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { useKernelStore } from "@/kernel/store";
import { useShadowStore } from "./store";
import Ambient from "./Ambient";
import "./shadow.css";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      DECRYPTING SHADOWSWAP
    </div>
  ),
});

export const shadowswap: ModuleDefinition = {
  id: "shadowswap",
  slot: 3,
  title: "ShadowSwap",
  tagline: "counter-surveillance toolkit",
  glyph: "[#]",
  accent: "#7b5cff",
  Ambient,
  Focused,
  hotkeys: [{ key: "1-3", label: "switch panel" }],
  commands: [
    {
      id: "burner",
      label: "Generate burner address",
      hint: "ephemeral keypair, never stored",
      run: () => {
        useShadowStore.getState().issueCommand("generate-burner");
        useKernelStore.getState().focus("shadowswap");
      },
    },
  ],
};
