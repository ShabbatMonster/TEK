"use client";

import { MODULES } from "@/modules/registry";
import { useKernelStore } from "./store";

const GLOBAL_KEYS: [string, string][] = [
  ["1–9", "focus module / toggle back"],
  ["Esc", "return to grid"],
  ["⌘K", "command palette"],
  ["G", "back to grid"],
  ["?", "this overlay"],
];

export function CheatSheet() {
  const open = useKernelStore((s) => s.cheatOpen);
  const setOpen = useKernelStore((s) => s.setCheatOpen);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-xl border border-line bg-cell p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-dim">
          TEK · keyboard map
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          {GLOBAL_KEYS.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 font-mono text-[11px]">
              <kbd className="min-w-[44px] rounded border border-line bg-cell2 px-1.5 py-0.5 text-center text-[10px] text-fg">
                {k}
              </kbd>
              <span className="text-dim">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {MODULES.filter((m) => m.hotkeys?.length).map((m) => (
            <div key={m.id} data-module={m.id} className="rounded border border-line p-2">
              <div className="m-accent mb-1 font-mono text-[9px] uppercase tracking-widest">
                {m.title}
              </div>
              {m.hotkeys!.map((h) => (
                <div key={h.key} className="flex gap-2 font-mono text-[10px]">
                  <span className="text-fg">{h.key}</span>
                  <span className="text-dim">{h.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
