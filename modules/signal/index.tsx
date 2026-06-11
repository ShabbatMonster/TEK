"use client";

import dynamic from "next/dynamic";
import type { ModuleDefinition } from "@/kernel/types";
import { bus } from "@/kernel/bus";
import { useKernelStore } from "@/kernel/store";
import { useSignalStore } from "./store";
import { refreshInbox } from "./queries";
import Ambient from "./Ambient";

const Focused = dynamic(() => import("./Focused"), {
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
      LOADING SIGNAL
    </div>
  ),
});

/* cross-module: anything can request "message this wallet" */
bus.on("signal:compose", ({ recipient }) => {
  const st = useSignalStore.getState();
  st.setComposeRecipient(recipient);
  st.selectThread(null);
  useKernelStore.getState().focus("signal");
});

export const signal: ModuleDefinition = {
  id: "signal",
  slot: 9,
  title: "Signal",
  tagline: "wallet-to-wallet memos",
  glyph: "[>]",
  accent: "#2dd4bf",
  Ambient,
  Focused,
  hotkeys: [
    { key: "R", label: "reply" },
    { key: "↵", label: "send" },
  ],
  commands: [
    {
      id: "compose",
      label: "Compose signal message",
      hint: "on-chain memo",
      run: () => {
        useSignalStore.getState().selectThread(null);
        useKernelStore.getState().focus("signal");
      },
    },
    {
      id: "refresh",
      label: "Refresh inbox",
      run: () => {
        refreshInbox();
        useKernelStore.getState().focus("signal");
      },
    },
  ],
};
