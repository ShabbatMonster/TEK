"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "./toast";
import { cn } from "@/lib/cn";

const KIND_STYLE: Record<string, string> = {
  info: "border-line",
  success: "border-up/50",
  error: "border-down/50",
  warn: "border-warn/50",
};

const KIND_DOT: Record<string, string> = {
  info: "bg-dim",
  success: "bg-up",
  error: "bg-down",
  warn: "bg-warn",
};

export function ToastOS() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[99] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "pointer-events-auto rounded-lg border bg-cell2/95 p-3 shadow-xl backdrop-blur",
              KIND_STYLE[t.kind]
            )}
            onClick={() => dismiss(t.id)}
          >
            <div className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[t.kind])} />
              <span className="font-mono text-[11px] font-bold text-fg">{t.title}</span>
            </div>
            {t.body && (
              <div className="mt-1 break-all font-mono text-[10px] text-dim">{t.body}</div>
            )}
            {t.href && (
              <a
                href={t.href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-1 inline-block font-mono text-[10px] text-up hover:underline"
              >
                view on solscan ↗
              </a>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
