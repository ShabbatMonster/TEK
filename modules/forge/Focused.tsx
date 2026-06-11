"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StatBlock } from "@/components/tek/StatBlock";
import { TerminalFeed } from "@/components/tek/TerminalFeed";
import { fmtNum, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AUDIT_STAGES, runAudit, useForgeStore } from "./store";
import {
  scoreTone,
  type Finding,
  type ForgeReport,
  type Severity,
} from "./scoring";

/* ---------- tone helpers ---------- */

function scoreClass(score: number): string {
  const t = scoreTone(score);
  return t === "up" ? "text-up" : t === "warn" ? "text-[var(--m-accent)]" : "text-down";
}

const SEVERITY_STYLE: Record<Severity, { text: string; border: string; label: string }> = {
  critical: { text: "text-down", border: "border-down/40", label: "CRIT" },
  high: { text: "text-warn", border: "border-warn/40", label: "HIGH" },
  medium: { text: "text-[var(--m-accent)]", border: "border-[var(--m-accent)]/30", label: "MED" },
  low: { text: "text-dim", border: "border-line", label: "LOW" },
  info: { text: "text-dim", border: "border-line", label: "INFO" },
};

function ageLabel(createdAt: number): string {
  const days = Math.max(0, (Date.now() - createdAt) / 86_400_000);
  return days >= 365 ? `${(days / 365).toFixed(1)}y` : `${Math.floor(days)}d`;
}

/* ---------- sub-components ---------- */

function StageChips({ stage, auditing }: { stage: number; auditing: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {AUDIT_STAGES.map((label, i) =>
        stage > i ? (
          <motion.span
            key={label}
            initial={{ scale: 1.35, color: "#ffffff" }}
            animate={{ scale: 1, color: "#ffd60a" }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="rounded border border-[var(--m-accent)]/40 bg-[var(--m-glow)] px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]"
          >
            {label}
          </motion.span>
        ) : (
          <span
            key={label}
            className={cn(
              "rounded border border-line px-1.5 py-0.5 font-mono text-[8px] tracking-[0.15em] text-dim",
              auditing && stage === i && "tek-pulse border-fg/30 text-fg"
            )}
          >
            {label}
          </span>
        )
      )}
    </div>
  );
}

function GradeBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm border border-line bg-cell">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="h-full bg-[var(--m-accent)]"
          style={{ opacity: 0.45 + (value / 100) * 0.55 }}
        />
      </div>
      <span className={cn("tnum w-8 shrink-0 text-right font-mono text-[11px] font-bold", scoreClass(value))}>
        {value}
      </span>
    </div>
  );
}

function LanguageBar({ report }: { report: ForgeReport }) {
  const langs = report.languages.slice(0, 6);
  if (langs.length === 0) {
    return <div className="font-mono text-[9px] text-dim">NO LANGUAGE DATA</div>;
  }
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-sm border border-line">
        {langs.map((l, i) => (
          <div
            key={l.name}
            title={`${l.name} ${l.pct.toFixed(1)}%`}
            className="h-full bg-[var(--m-accent)]"
            style={{ width: `${l.pct}%`, opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {langs.map((l) => (
          <span key={l.name} className="font-mono text-[9px] text-dim">
            {l.name} <span className="tnum text-fg/70">{l.pct.toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const style = SEVERITY_STYLE[finding.severity];
  return (
    <div className={cn("rounded border bg-cell/60 px-2.5 py-1.5", style.border)}>
      <div className="flex items-baseline gap-2">
        <span className={cn("shrink-0 font-mono text-[8px] font-bold tracking-[0.2em]", style.text)}>
          [{style.label}]
        </span>
        <span className={cn("font-mono text-[11px] font-bold uppercase", style.text)}>
          {finding.title}
        </span>
      </div>
      <div className="mt-0.5 pl-1 font-mono text-[10px] leading-snug text-dim">
        {finding.detail}
      </div>
    </div>
  );
}

function Report({ report }: { report: ForgeReport }) {
  return (
    <div className="space-y-5">
      {/* header + score stamp */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            AUDIT REPORT
          </div>
          <div className="m-display truncate text-lg font-bold text-fg">{report.repo}</div>
          {report.description && (
            <div className="mt-0.5 line-clamp-2 font-mono text-[10px] text-dim">
              {report.description}
            </div>
          )}
          {report.solana && (
            <div className="mt-1 inline-block rounded border border-[var(--m-accent)]/40 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.2em] text-[var(--m-accent)]">
              SOLANA PROGRAM REPO
            </div>
          )}
        </div>
        <motion.div
          key={`${report.repo}:${report.ts}`}
          initial={{ scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 16 }}
          className="shrink-0 text-right"
        >
          <div className={cn("m-display tnum text-5xl font-bold leading-none", scoreClass(report.overall))}>
            {report.overall}
          </div>
          <div className={cn("m-display mt-0.5 text-base font-bold tracking-[0.2em]", scoreClass(report.overall))}>
            {report.letter}
          </div>
        </motion.div>
      </div>

      {/* grade bars */}
      <div className="space-y-1.5">
        <GradeBar label="ACTIVITY" value={report.grades.activity} />
        <GradeBar label="COMMUNITY" value={report.grades.community} />
        <GradeBar label="HYGIENE" value={report.grades.hygiene} />
        <GradeBar label="MATURITY" value={report.grades.maturity} />
      </div>

      {/* language split */}
      <div>
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
          LANGUAGE SPLIT
        </div>
        <LanguageBar report={report} />
      </div>

      {/* key stats */}
      <div className="grid grid-cols-5 gap-2 border-y border-line py-2.5">
        <StatBlock label="STARS" value={fmtNum(report.stats.stars, 0)} tone="accent" />
        <StatBlock label="FORKS" value={fmtNum(report.stats.forks, 0)} />
        <StatBlock
          label="CONTRIB"
          value={`${report.stats.contributorsApprox ? "~" : ""}${fmtNum(report.stats.contributors, 0)}`}
          sub={report.stats.topContributor ? `top ${report.stats.topContributor}` : undefined}
        />
        <StatBlock label="AGE" value={ageLabel(report.stats.createdAt)} />
        <StatBlock label="LAST PUSH" value={timeAgo(report.stats.pushedAt)} />
      </div>

      {/* findings */}
      <div>
        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
          FINDINGS ({report.findings.length})
        </div>
        {report.findings.length === 0 ? (
          <div className="font-mono text-[10px] text-up">NO FINDINGS — CLEAN SWEEP</div>
        ) : (
          <div className="space-y-1.5">
            {report.findings.map((f, i) => (
              <FindingRow key={`${f.title}-${i}`} finding={f} />
            ))}
          </div>
        )}
      </div>

      {/* AI summary */}
      <div className="rounded-lg border border-line bg-cell/70 p-3">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--m-accent)]">
          AI EXECUTIVE SUMMARY
        </div>
        {report.summary ? (
          <p className="font-mono text-[11px] italic leading-relaxed text-fg/90">
            {report.summary}
          </p>
        ) : report.summaryOffline ? (
          <div className="font-mono text-[10px] tracking-[0.15em] text-warn">
            AI OFFLINE — set ANTHROPIC_API_KEY
          </div>
        ) : (
          <div className="font-mono text-[10px] text-dim tek-pulse">GENERATING…</div>
        )}
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function ForgeFocused() {
  const qc = useQueryClient();
  const report = useForgeStore((s) => s.currentReport);
  const pipeline = useForgeStore((s) => s.pipeline);
  const stage = useForgeStore((s) => s.stage);
  const auditing = useForgeStore((s) => s.auditing);
  const history = useForgeStore((s) => s.history);
  const [input, setInput] = useState("");

  useEffect(() => {
    useForgeStore.getState().hydrate();
    const pending = useForgeStore.getState().pendingRepo;
    if (pending) {
      useForgeStore.setState({ pendingRepo: null });
      setInput(pending);
      void runAudit(qc, pending);
    }
  }, [qc]);

  function start(repo: string) {
    if (!repo.trim() || auditing) return;
    void runAudit(qc, repo);
  }

  return (
    <div className="flex h-full min-h-0 gap-3 p-4">
      {/* ---------- left: intake + pipeline ---------- */}
      <div className="flex w-[300px] shrink-0 flex-col gap-3 min-h-0">
        {/* repo intake */}
        <div className="rounded-xl border border-line bg-cell2/50 p-3">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
            REPO INTAKE
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(input);
            }}
            className="flex gap-1.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="owner/repo or URL"
              spellCheck={false}
              autoFocus
              className="min-w-0 flex-1 rounded border border-line bg-cell px-2 py-1.5 font-mono text-[11px] text-fg placeholder:text-dim focus:border-[var(--m-accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={auditing || !input.trim()}
              className={cn(
                "shrink-0 rounded border px-2.5 font-mono text-[10px] font-bold tracking-[0.15em] transition-colors",
                auditing || !input.trim()
                  ? "cursor-not-allowed border-line text-dim"
                  : "border-[var(--m-accent)] bg-[var(--m-glow)] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black"
              )}
            >
              {auditing ? "…" : "AUDIT"}
            </button>
          </form>

          {/* recent audits */}
          {history.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.25em] text-dim">
                RECENT AUDITS
              </div>
              <div className="space-y-0.5">
                {history.slice(0, 5).map((h) => (
                  <button
                    key={h.repo}
                    onClick={() => {
                      setInput(h.repo);
                      start(h.repo);
                    }}
                    disabled={auditing}
                    className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-cell"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-fg/85">
                      {h.repo}
                    </span>
                    <span className={cn("tnum shrink-0 font-mono text-[10px] font-bold", scoreClass(h.score))}>
                      {h.score}
                    </span>
                    <span className="tnum shrink-0 font-mono text-[8px] text-dim">
                      {timeAgo(h.ts)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* pipeline */}
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-cell2/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-dim">
              AUDIT PIPELINE
            </span>
            {auditing && (
              <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--m-accent)] tek-pulse">
                RUNNING
              </span>
            )}
          </div>
          <StageChips stage={stage} auditing={auditing} />
          <TerminalFeed
            lines={
              pipeline.length > 0
                ? pipeline
                : [{ text: "idle — awaiting repo", tone: "dim" as const }]
            }
            className="mt-2 min-h-0 flex-1"
          />
        </div>
      </div>

      {/* ---------- right: report ---------- */}
      <div className="blueprint min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-cell2/40 p-5">
        {report ? (
          <Report report={report} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="m-display text-sm font-bold uppercase tracking-[0.3em] text-dim">
              {auditing ? "FORGING REPORT" : "NO REPORT"}
            </div>
            <div className={cn("font-mono text-[9px] uppercase tracking-[0.25em] text-dim", auditing && "tek-pulse")}>
              {auditing ? "running static passes…" : "paste a github repo to audit"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
