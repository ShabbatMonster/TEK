"use client";

import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import type { FeedLine } from "@/components/tek/TerminalFeed";
import { toast } from "@/kernel/toast";
import {
  analyzeRoot,
  fetchCommits,
  fetchContributors,
  fetchLanguages,
  fetchRepo,
  fetchRootContents,
  parseRepoInput,
  repoKey,
} from "./lib";
import { computeReport, scoreTone, type ForgeReport } from "./scoring";

export interface AuditHistoryItem {
  repo: string;
  score: number;
  ts: number;
}

const LS_KEY = "tek:forge:reports";
const HISTORY_MAX = 8;

/** pipeline stage chips — index = stage value when that stage COMPLETES */
export const AUDIT_STAGES = ["META", "LANG", "CONTRIB", "COMMITS", "TREE", "SCORE", "AI"] as const;

interface ForgeStore {
  /** repo string handed off from ambient / palette; consumed by Focused */
  pendingRepo: string | null;
  currentReport: ForgeReport | null;
  pipeline: FeedLine[];
  /** number of completed AUDIT_STAGES */
  stage: number;
  auditing: boolean;
  history: AuditHistoryItem[];
  hydrated: boolean;
  setPendingRepo: (repo: string | null) => void;
  hydrate: () => void;
  reset: () => void;
}

export const useForgeStore = create<ForgeStore>((set, get) => ({
  pendingRepo: null,
  currentReport: null,
  pipeline: [],
  stage: 0,
  auditing: false,
  history: [],
  hydrated: false,
  setPendingRepo: (repo) => set({ pendingRepo: repo }),
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    let history: AuditHistoryItem[] = [];
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed.filter(
            (x): x is AuditHistoryItem =>
              x != null &&
              typeof x === "object" &&
              typeof (x as AuditHistoryItem).repo === "string" &&
              typeof (x as AuditHistoryItem).score === "number" &&
              typeof (x as AuditHistoryItem).ts === "number"
          );
        }
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    set({ history: history.slice(0, HISTORY_MAX), hydrated: true });
  },
  reset: () => set({ pipeline: [], stage: 0, auditing: false }),
}));

function pushLine(text: string, tone?: FeedLine["tone"]): void {
  useForgeStore.setState((s) => ({
    pipeline: [...s.pipeline, { text, tone, ts: Date.now() }],
  }));
}

function addHistory(item: AuditHistoryItem): void {
  useForgeStore.setState((s) => {
    const history = [item, ...s.history.filter((h) => h.repo !== item.repo)].slice(0, HISTORY_MAX);
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(history));
    } catch {
      /* storage full / unavailable — keep in-memory only */
    }
    return { history };
  });
}

/**
 * Run a full audit: 5 sequential GitHub fetches (cached forever per repo via
 * react-query), pure scoring, then the AI summary. Streams stage lines into
 * the pipeline feed as each step resolves.
 */
export async function runAudit(qc: QueryClient, raw: string): Promise<void> {
  const st = useForgeStore.getState();
  if (st.auditing) return;

  const ref = parseRepoInput(raw);
  if (!ref) {
    toast({
      kind: "error",
      title: "FORGE",
      body: "could not parse repo — paste a GitHub URL or owner/repo",
    });
    return;
  }
  const key = repoKey(ref).toLowerCase();
  const set = useForgeStore.setState;

  set({ auditing: true, pipeline: [], stage: 0 });

  const cached = <T,>(part: string, fn: () => Promise<T>): Promise<T> =>
    qc.fetchQuery({
      queryKey: ["forge", part, key],
      queryFn: fn,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 0,
    });

  try {
    pushLine(`INIT audit ${key}`, "dim");

    const repo = await cached("repo", () => fetchRepo(ref));
    pushLine("FETCH repo meta ✓", "accent");
    set({ stage: 1 });

    const languages = await cached("languages", () => fetchLanguages(ref));
    pushLine(`ANALYZE languages ✓ (${Object.keys(languages).length} detected)`, "accent");
    set({ stage: 2 });

    const contributors = await cached("contributors", () => fetchContributors(ref));
    pushLine(
      `SCAN contributors ✓ (${contributors.approx ? "~" : ""}${contributors.count})`,
      "accent"
    );
    set({ stage: 3 });

    const commits = await cached("commits", () => fetchCommits(ref));
    pushLine(`TRACE commit history ✓ (${commits.length} recent)`, "accent");
    set({ stage: 4 });

    const contents = await cached("contents", () => fetchRootContents(ref));
    const signals = analyzeRoot(contents);
    pushLine("INSPECT root tree ✓", "accent");
    set({ stage: 5 });

    const report = computeReport({ repo, languages, contributors, commits, signals });
    const tone = scoreTone(report.overall);
    pushLine(
      `SCORE composite ${report.overall} (${report.letter}) ✓`,
      tone === "up" ? "up" : tone === "warn" ? "warn" : "down"
    );
    set({ stage: 6, currentReport: report });
    addHistory({ repo: report.repo, score: report.overall, ts: Date.now() });

    pushLine("AI SUMMARY …", "dim");
    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: report.repo,
          stats: {
            ...report.stats,
            grades: report.grades,
            overall: report.overall,
            letter: report.letter,
            solanaProgram: report.solana,
            languages: report.languages.slice(0, 5),
          },
          findings: report.findings,
        }),
      });
      const json = (await res.json()) as { summary?: string; offline?: boolean; error?: string };
      if (json.offline) {
        patchReport({ summaryOffline: true });
        pushLine("AI OFFLINE — set ANTHROPIC_API_KEY", "warn");
      } else if (json.summary) {
        patchReport({ summary: json.summary });
        pushLine("AI SUMMARY ✓", "accent");
      } else {
        throw new Error(json.error ?? `summary failed (${res.status})`);
      }
    } catch (e) {
      patchReport({ summaryOffline: true });
      pushLine(`AI SUMMARY ✗ ${e instanceof Error ? e.message : "failed"}`, "warn");
    }
    set({ stage: 7 });

    pushLine(
      `AUDIT COMPLETE — ${key} graded ${report.letter}`,
      tone === "up" ? "up" : tone === "warn" ? "warn" : "down"
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "audit failed";
    pushLine(`ERROR ${msg}`, "down");
    toast({ kind: "error", title: "FORGE AUDIT FAILED", body: msg });
  } finally {
    set({ auditing: false });
  }
}

function patchReport(patch: Partial<ForgeReport>): void {
  useForgeStore.setState((s) =>
    s.currentReport ? { currentReport: { ...s.currentReport, ...patch } } : {}
  );
}

/* not wallet-scoped — no registerWalletReset */
