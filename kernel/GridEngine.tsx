"use client";

import { Component, type ReactNode, Suspense } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { MODULES } from "@/modules/registry";
import type { ModuleDefinition } from "./types";
import { useKernelStore } from "./store";

/* ---------------- error boundary: a module crash is one dead cell ---------------- */

class ModuleErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="font-mono text-xs tracking-[0.3em] text-down">SEGFAULT</div>
          <div className="max-w-[90%] truncate font-mono text-[10px] text-dim">
            {this.state.error.message}
          </div>
          <button
            className="mt-1 rounded border border-line px-3 py-1 font-mono text-[10px] text-dim hover:border-[var(--m-accent)] hover:text-fg"
            onClick={() => this.setState({ error: null })}
          >
            RESTART MODULE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------- module cell ---------------- */

function ModuleCell({ def }: { def: ModuleDefinition }) {
  const focused = useKernelStore((s) => s.focused);
  const hovered = useKernelStore((s) => s.hovered);
  const focus = useKernelStore((s) => s.focus);
  const setHovered = useKernelStore((s) => s.setHovered);

  const isFocused = focused === def.id;
  const someFocused = focused !== null;
  const isHovered = hovered === def.id;

  const { Ambient, Focused } = def;

  return (
    <motion.section
      layout
      data-module={def.id}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(def.id)}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--tek-radius)] border bg-cell",
        someFocused && !isFocused && "hidden",
        isHovered && !someFocused ? "z-10 border-[var(--m-accent)]" : "border-line",
        !someFocused && hovered && !isHovered && "opacity-[0.92]"
      )}
      style={{
        boxShadow: isHovered || isFocused ? `0 0 36px var(--m-glow), inset 0 0 0 1px var(--m-glow)` : undefined,
      }}
    >
      {/* chrome strip */}
      <header
        className="flex h-[var(--tek-chrome-h)] shrink-0 cursor-pointer select-none items-center gap-2 border-b border-line bg-cell2/60 px-2"
        onClick={() => focus(isFocused ? null : def.id)}
        title={isFocused ? "Esc to return to grid" : "Click to focus"}
      >
        <span className="m-accent font-mono text-[11px]">{def.glyph}</span>
        <span className="m-display text-[11px] font-bold uppercase tracking-[0.18em]">
          {def.title}
        </span>
        <span className="hidden truncate font-mono text-[9px] uppercase tracking-wider text-dim md:inline">
          {def.tagline}
        </span>
        <span className="ml-auto font-mono text-[9px] text-dim">
          {isFocused ? "ESC" : String(def.slot)}
        </span>
      </header>

      {/* body */}
      <div className="relative min-h-0 flex-1">
        <ModuleErrorBoundary name={def.id}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.3em] text-dim tek-pulse">
                LOADING {def.title}
              </div>
            }
          >
            {isFocused ? <Focused /> : <Ambient />}
          </Suspense>
        </ModuleErrorBoundary>
      </div>
    </motion.section>
  );
}

/* ---------------- focus dock (left rail in focus mode) ---------------- */

function FocusDock() {
  const focused = useKernelStore((s) => s.focused);
  const focus = useKernelStore((s) => s.focus);
  if (!focused) return null;
  return (
    <nav className="flex w-[56px] shrink-0 flex-col items-center gap-[6px]">
      <button
        onClick={() => focus(null)}
        className="flex h-10 w-full items-center justify-center rounded-[var(--tek-radius)] border border-line bg-cell font-mono text-[10px] text-dim transition-colors hover:border-fg hover:text-fg"
        title="Back to grid (Esc)"
      >
        ▦
      </button>
      {MODULES.map((m) => (
        <button
          key={m.id}
          data-module={m.id}
          onClick={() => focus(m.id)}
          title={`${m.title} (${m.slot})`}
          className={cn(
            "flex h-10 w-full flex-col items-center justify-center rounded-[var(--tek-radius)] border bg-cell transition-all",
            m.id === focused
              ? "border-[var(--m-accent)] text-[var(--m-accent)]"
              : "border-line text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          )}
        >
          <span className="font-mono text-[13px] leading-none">{m.glyph}</span>
          <span className="mt-0.5 font-mono text-[7px] leading-none">{m.slot}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------------- engine ---------------- */

export function GridEngine() {
  const focused = useKernelStore((s) => s.focused);
  return (
    <div className="mt-[var(--tek-gap)] flex min-h-0 flex-1 gap-[var(--tek-gap)]">
      <FocusDock />
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-[var(--tek-gap)]",
          focused ? "grid-cols-1 grid-rows-1" : "grid-cols-3 grid-rows-3"
        )}
      >
        {MODULES.map((def) => (
          <ModuleCell key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
}
