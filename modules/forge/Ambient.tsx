"use client";

import { useEffect, useState } from "react";
import { useKernelStore } from "@/kernel/store";
import { cn } from "@/lib/cn";
import { useForgeStore } from "./store";
import { gradeLetter, scoreTone, type Severity } from "./scoring";

const EXAMPLE_REPO = "anza-xyz/agave";

function scoreClass(score: number): string {
  const t = scoreTone(score);
  return t === "up" ? "text-up" : t === "warn" ? "text-[var(--m-accent)]" : "text-down";
}

const SEV_TEXT: Record<Severity, string> = {
  critical: "text-down",
  high: "text-warn",
  medium: "text-[var(--m-accent)]",
  low: "text-dim",
  info: "text-dim",
};

export default function ForgeAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const report = useForgeStore((s) => s.currentReport);
  const history = useForgeStore((s) => s.history);
  const auditing = useForgeStore((s) => s.auditing);
  const setPendingRepo = useForgeStore((s) => s.setPendingRepo);
  const [input, setInput] = useState("");

  useEffect(() => {
    useForgeStore.getState().hydrate();
  }, []);

  function startAudit(repo: string) {
    if (!repo.trim()) return;
    setPendingRepo(repo.trim());
    setInput("");
    focus("forge");
  }

  const last = report ?? null;
  const lastHist = history[0];
  const score = last?.overall ?? lastHist?.score;
  const repoName = last?.repo ?? lastHist?.repo;
  const topFinding = last?.findings[0];

  return (
    <div className="blueprint flex h-full flex-col p-3">
      {repoName != null && score != null ? (
        <button onClick={() => focus("forge")} className="min-h-0 flex-1 text-left">
          <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-dim">
            {auditing ? <span className="tek-pulse text-[var(--m-accent)]">AUDITING…</span> : "LAST AUDIT"}
          </div>
          <div className="m-display mt-0.5 truncate text-[11px] font-bold text-fg">{repoName}</div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("m-display tnum text-3xl font-bold leading-none", scoreClass(score))}>
              {score}
            </span>
            <span className={cn("m-display text-sm font-bold", scoreClass(score))}>
              {last?.letter ?? gradeLetter(score)}
            </span>
          </div>

          {topFinding && (
            <div className={cn("mt-1.5 truncate font-mono text-[9px] uppercase", SEV_TEXT[topFinding.severity])}>
              ▸ {topFinding.title}
            </div>
          )}

          {/* mini grade bars */}
          {last && (
            <div className="mt-2 space-y-1">
              {(
                [
                  ["ACT", last.grades.activity],
                  ["COM", last.grades.community],
                  ["HYG", last.grades.hygiene],
                  ["MAT", last.grades.maturity],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-7 shrink-0 font-mono text-[7px] tracking-[0.2em] text-dim">
                    {label}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-sm bg-cell">
                    <div
                      className="h-full bg-[var(--m-accent)]"
                      style={{ width: `${v}%`, opacity: 0.45 + (v / 100) * 0.55 }}
                    />
                  </div>
                  <span className="tnum w-5 shrink-0 text-right font-mono text-[8px] text-fg/70">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}
        </button>
      ) : (
        <button
          onClick={() => focus("forge")}
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center"
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            PASTE A REPO URL TO AUDIT
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              startAudit(EXAMPLE_REPO);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                startAudit(EXAMPLE_REPO);
              }
            }}
            className="rounded border border-[var(--m-accent)]/40 bg-[var(--m-glow)] px-2 py-0.5 font-mono text-[9px] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black"
          >
            {EXAMPLE_REPO}
          </span>
        </button>
      )}

      {/* quick intake */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") startAudit(input);
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder="owner/repo ↵"
        spellCheck={false}
        className="mt-2 w-full shrink-0 rounded border border-line bg-cell px-2 py-1 font-mono text-[10px] text-fg placeholder:text-dim focus:border-[var(--m-accent)] focus:outline-none"
      />
    </div>
  );
}
