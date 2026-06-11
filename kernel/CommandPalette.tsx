"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODULES } from "@/modules/registry";
import { useKernelStore } from "./store";

interface Entry {
  id: string;
  label: string;
  hint?: string;
  moduleId?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useKernelStore((s) => s.paletteOpen);
  const setOpen = useKernelStore((s) => s.setPaletteOpen);
  const focus = useKernelStore((s) => s.focus);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const jump: Entry[] = MODULES.map((m) => ({
      id: `jump:${m.id}`,
      label: `${m.title}`,
      hint: `focus module ${m.slot}`,
      moduleId: m.id,
      run: () => focus(m.id),
    }));
    const cmds: Entry[] = MODULES.flatMap(
      (m) =>
        m.commands?.map((c) => ({
          id: `${m.id}:${c.id}`,
          label: c.label,
          hint: c.hint ?? m.title,
          moduleId: m.id,
          run: c.run,
        })) ?? []
    );
    return [...cmds, ...jump];
  }, [focus]);

  const filtered = useMemo(() => {
    if (!q.trim()) return entries;
    const needle = q.toLowerCase();
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(needle) ||
        e.hint?.toLowerCase().includes(needle)
    );
  }, [entries, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-line bg-cell shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && filtered[sel]) {
              setOpen(false);
              filtered[sel].run();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Type a command — swap, burn, launch, audit, ask…"
          className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-[13px] text-fg outline-none placeholder:text-dim"
        />
        <div className="max-h-[40vh] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="px-3 py-4 font-mono text-[11px] text-dim">no matches</div>
          )}
          {filtered.map((e, i) => (
            <button
              key={e.id}
              data-module={e.moduleId}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                setOpen(false);
                e.run();
              }}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left font-mono text-[12px] ${
                i === sel ? "bg-cell2 text-fg" : "text-dim"
              }`}
            >
              <span className="m-accent text-[10px]">▸</span>
              <span>{e.label}</span>
              {e.hint && <span className="ml-auto text-[10px] text-dim">{e.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
