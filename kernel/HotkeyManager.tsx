"use client";

import { useEffect } from "react";
import { MODULES } from "@/modules/registry";
import { useKernelStore } from "./store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function HotkeyManager() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useKernelStore.getState();

      // ⌘K / Ctrl+K — palette, works everywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
        return;
      }

      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "Escape") {
        if (s.paletteOpen) return s.setPaletteOpen(false);
        if (s.cheatOpen) return s.setCheatOpen(false);
        if (s.focused) return s.focus(null);
        return;
      }

      if (s.paletteOpen) return;

      if (e.key === "?") {
        e.preventDefault();
        s.setCheatOpen(!s.cheatOpen);
        return;
      }

      // 1-9 focus modules (plain or with ⌘/Ctrl)
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && !e.altKey && !e.shiftKey) {
        const mod = MODULES.find((m) => m.slot === n);
        if (mod) {
          e.preventDefault();
          s.focus(s.focused === mod.id ? null : mod.id);
        }
        return;
      }

      // G — back to grid
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        s.focus(null);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
