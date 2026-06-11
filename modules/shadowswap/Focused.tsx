"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { useShadowStore, type ShadowPanel } from "./store";
import { PanelBurners } from "./PanelBurners";
import { PanelPool } from "./PanelPool";
import { PanelVault } from "./PanelVault";

const TABS: { id: ShadowPanel; label: string; key: string }[] = [
  { id: "burners", label: "BURNERS", key: "1" },
  { id: "pool", label: "SHIELDED POOL", key: "2" },
  { id: "vault", label: "LOCAL VAULT", key: "3" },
];

export default function ShadowFocused() {
  const activePanel = useShadowStore((s) => s.activePanel);
  const setActivePanel = useShadowStore((s) => s.setActivePanel);

  /* 1–4 switch panels when not typing */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      const tab = TABS.find((t) => t.key === e.key);
      if (tab) setActivePanel(tab.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActivePanel]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* faint static field over the whole module */}
      <div className="shadow-static absolute inset-0 z-0" aria-hidden />
      <div className="shadow-band z-0" aria-hidden />

      {/* tab rail */}
      <div className="relative z-10 flex shrink-0 items-center gap-1 border-b border-line px-4 pt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActivePanel(t.id)}
            className={cn(
              "border-b-2 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.2em] transition-colors",
              activePanel === t.id
                ? "border-[var(--m-accent)] text-[var(--m-accent)]"
                : "border-transparent text-dim hover:text-fg"
            )}
          >
            <span className="mr-1.5 text-[8px] opacity-60">{t.key}</span>
            {t.label}
          </button>
        ))}
        <span className="ml-auto pb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
          all analysis local · zero telemetry
        </span>
      </div>

      {/* panel body */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-5">
        {activePanel === "burners" && <PanelBurners />}
        {activePanel === "pool" && <PanelPool />}
        {activePanel === "vault" && <PanelVault />}
      </div>
    </div>
  );
}
