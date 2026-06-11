/**
 * Pure scoring: fetched GitHub data → ForgeReport.
 * No I/O — fully deterministic given inputs + `now`.
 */

import type {
  GhCommitItem,
  GhContributors,
  GhLanguages,
  GhRepo,
  RepoSignals,
} from "./lib";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface Grades {
  activity: number;
  community: number;
  hygiene: number;
  maturity: number;
}

export interface LanguageSlice {
  name: string;
  pct: number;
}

export interface ReportStats {
  stars: number;
  forks: number;
  openIssues: number;
  contributors: number;
  contributorsApprox: boolean;
  topContributor: string | null;
  createdAt: number;
  pushedAt: number;
  sizeKb: number;
  defaultBranch: string;
  recentCommits: number;
}

export interface ForgeReport {
  repo: string;
  description: string | null;
  grades: Grades;
  overall: number;
  letter: string;
  findings: Finding[];
  languages: LanguageSlice[];
  stats: ReportStats;
  signals: RepoSignals;
  solana: boolean;
  summary?: string;
  summaryOffline?: boolean;
  ts: number;
}

const clamp = (n: number, lo = 0, hi = 100): number => Math.min(hi, Math.max(lo, n));

/** log-scaled 0-100 where `cap` ≈ 100 */
function logScale(v: number, cap: number): number {
  return clamp((Math.log10(v + 1) / Math.log10(cap + 1)) * 100);
}

export function gradeLetter(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  if (score >= 40) return "D-";
  return "F";
}

export type ScoreTone = "up" | "warn" | "down";

/** red < 40 ≤ yellow < 70 ≤ green */
export function scoreTone(score: number): ScoreTone {
  if (score >= 70) return "up";
  if (score >= 40) return "warn";
  return "down";
}

export interface ComputeInput {
  repo: GhRepo;
  languages: GhLanguages;
  contributors: GhContributors;
  commits: GhCommitItem[];
  signals: RepoSignals;
  now?: number;
}

function commitDate(c: GhCommitItem): number {
  const d = c.commit.author?.date ?? c.commit.committer?.date;
  return d ? Date.parse(d) : NaN;
}

export function computeReport(input: ComputeInput): ForgeReport {
  const { repo, languages, contributors, commits, signals } = input;
  const now = input.now ?? Date.now();

  const pushedAt = Date.parse(repo.pushed_at);
  const createdAt = Date.parse(repo.created_at);
  const daysSincePush = Math.max(0, (now - pushedAt) / 86_400_000);
  const ageDays = Math.max(0, (now - createdAt) / 86_400_000);

  /* ---------- ACTIVITY: push recency + commit cadence over last 30 ---------- */
  const recency = clamp(100 * (1 - Math.max(0, daysSincePush - 3) / 180));
  const dates = commits.map(commitDate).filter((t) => Number.isFinite(t)).sort((a, b) => b - a);
  let cadence = 0;
  if (dates.length >= 2) {
    const spanDays = Math.max(1, (dates[0] - dates[dates.length - 1]) / 86_400_000);
    const perWeek = ((dates.length - 1) / spanDays) * 7;
    cadence = clamp(perWeek * 20); // 5+ commits/week = 100
  } else {
    cadence = dates.length * 10;
  }
  const activity = Math.round(0.6 * recency + 0.4 * cadence);

  /* ---------- COMMUNITY: log-scaled stars / forks / contributors ---------- */
  const community = Math.round(
    0.5 * logScale(repo.stargazers_count, 50_000) +
      0.25 * logScale(repo.forks_count, 10_000) +
      0.25 * logScale(contributors.count, 500)
  );

  /* ---------- HYGIENE: license + readme + tests + CI + lockfile ---------- */
  const hasLicense = repo.license != null || signals.hasLicenseFile;
  let hygiene =
    (hasLicense ? 25 : 0) +
    (signals.hasReadme ? 20 : 0) +
    (signals.hasTests ? 25 : 0) +
    (signals.hasCI ? 20 : 0) +
    (signals.hasLockfile ? 10 : 0);
  if (signals.hasEnvFile) hygiene -= 20;
  hygiene = Math.round(clamp(hygiene));

  /* ---------- MATURITY: age + not archived + not fork + size sanity ---------- */
  let maturity = 0.5 * clamp((ageDays / 730) * 100) + 50; // 2y → full age credit
  if (repo.archived) maturity -= 50;
  if (repo.fork) maturity -= 25;
  if (repo.size < 100) maturity -= 15; // <100KB: skeleton repo
  if (repo.size > 5_000_000) maturity -= 10; // >5GB: something is off
  maturity = Math.round(clamp(maturity));

  const grades: Grades = { activity, community, hygiene, maturity };
  const overall = Math.round(
    0.3 * activity + 0.2 * community + 0.3 * hygiene + 0.2 * maturity
  );

  /* ---------- findings ---------- */
  const findings: Finding[] = [];
  const add = (severity: Severity, title: string, detail: string) =>
    findings.push({ severity, title, detail });

  if (signals.hasEnvFile) {
    add(
      "critical",
      ".env file committed at repo root",
      "Secrets may be exposed in git history. Assume any key in it is compromised."
    );
  }
  if (repo.archived) {
    add(
      "critical",
      "repository is archived",
      "Read-only and unmaintained — no fixes will ship, including security patches."
    );
  }
  if (contributors.count <= 1) {
    add(
      "high",
      "single contributor — bus factor 1",
      "One person controls the entire codebase. No internal review, total key-person risk."
    );
  }
  if (!hasLicense) {
    add(
      "high",
      "no license",
      "All rights reserved by default — using or forking this code has unclear legal standing."
    );
  }
  if (repo.fork && daysSincePush > 30) {
    add(
      "high",
      "fork with no divergent activity",
      "Forked from another project with no recent commits of its own — possibly a shell clone."
    );
  } else if (repo.fork) {
    add("info", "repository is a fork", "Compare against the upstream before trusting changes.");
  }
  if (daysSincePush > 180) {
    add(
      "high",
      "no commits in 180+ days",
      `Last push ${Math.floor(daysSincePush)} days ago — effectively dormant.`
    );
  }
  if (!signals.hasTests) {
    add(
      signals.isSolanaProgram ? "high" : "medium",
      "no tests detected",
      signals.isSolanaProgram
        ? "No test dir or test config at root. For an on-chain program this is a serious gap."
        : "No test dir or jest/vitest config at root. Correctness is unverified."
    );
  }
  if (!signals.hasCI) {
    add(
      "medium",
      "no CI workflows",
      "No .github directory — nothing is automatically built or checked on push."
    );
  }
  if (!signals.hasLockfile) {
    add("low", "no lockfile", "Dependency versions are unpinned; builds are not reproducible.");
  }
  if (signals.hasReadme && signals.readmeBytes > 0 && signals.readmeBytes < 500) {
    add("low", "sparse README", `README is only ${signals.readmeBytes} bytes — minimal documentation.`);
  } else if (!signals.hasReadme) {
    add("medium", "no README", "No top-level documentation at all.");
  }
  if (signals.isSolanaProgram) {
    add(
      "info",
      "Solana program repo",
      "On-chain verification of the deployed program hash against this source is recommended."
    );
  }

  findings.sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  /* ---------- language split ---------- */
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  const langSlices: LanguageSlice[] =
    totalBytes > 0
      ? Object.entries(languages)
          .sort((a, b) => b[1] - a[1])
          .map(([name, bytes]) => ({ name, pct: (bytes / totalBytes) * 100 }))
      : [];

  const topContributor =
    contributors.top[0]?.login ?? contributors.top[0]?.name ?? null;

  return {
    repo: repo.full_name,
    description: repo.description,
    grades,
    overall,
    letter: gradeLetter(overall),
    findings,
    languages: langSlices,
    stats: {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      contributors: contributors.count,
      contributorsApprox: contributors.approx,
      topContributor,
      createdAt,
      pushedAt,
      sizeKb: repo.size,
      defaultBranch: repo.default_branch,
      recentCommits: commits.length,
    },
    signals,
    solana: signals.isSolanaProgram,
    ts: now,
  };
}
