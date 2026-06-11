"use client";

/**
 * GitHub public REST client (api.github.com, CORS-enabled).
 * Unauthenticated = 60 req/h — each audit costs ~5 requests, so callers
 * cache aggressively (react-query staleTime Infinity per repo).
 */

const GH = "https://api.github.com";

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Parse "owner/repo", a github.com URL, or a git remote into a RepoRef. */
export function parseRepoInput(raw: string): RepoRef | null {
  const s = raw.trim();
  if (!s) return null;
  const url = s.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (url) return { owner: url[1], repo: url[2] };
  const short = s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (short && !s.includes(" ")) return { owner: short[1], repo: short[2] };
  return null;
}

export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

/* ---------- typed responses (only the fields we use) ---------- */

export interface GhRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  pushed_at: string;
  license: { spdx_id: string | null; name: string } | null;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  /** repo size in KB */
  size: number;
}

export type GhLanguages = Record<string, number>;

export interface GhContributor {
  login?: string;
  name?: string;
  type?: string;
  contributions: number;
}

export interface GhContributors {
  top: GhContributor[];
  count: number;
  /** true when count was estimated from the Link pagination header */
  approx: boolean;
}

export interface GhCommitItem {
  sha: string;
  commit: {
    message: string;
    author: { date?: string } | null;
    committer: { date?: string } | null;
  };
}

export interface GhContentEntry {
  name: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
}

/* ---------- fetch core ---------- */

async function ghRaw(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${GH}${path}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    throw new Error("network error reaching api.github.com");
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining === "0" && reset) {
      const at = new Date(Number(reset) * 1000).toLocaleTimeString("en-US", { hour12: false });
      throw new Error(`GitHub rate limit hit (60 req/h unauthenticated) — resets at ${at}`);
    }
    throw new Error("GitHub refused the request (403) — likely rate limited, try again later");
  }
  if (res.status === 404) {
    throw new Error("repository not found — private repo or typo?");
  }
  if (!res.ok && res.status !== 409) {
    throw new Error(`GitHub error ${res.status}: ${res.statusText || "request failed"}`);
  }
  return res;
}

async function gh<T>(path: string, emptyOn?: number[]): Promise<T> {
  const res = await ghRaw(path);
  if (res.status === 204 || (emptyOn ?? [409]).includes(res.status)) {
    return [] as unknown as T;
  }
  return (await res.json()) as T;
}

/* ---------- fetchers (~5 requests per audit) ---------- */

export function fetchRepo(ref: RepoRef): Promise<GhRepo> {
  return gh<GhRepo>(`/repos/${ref.owner}/${ref.repo}`);
}

export function fetchLanguages(ref: RepoRef): Promise<GhLanguages> {
  return gh<GhLanguages>(`/repos/${ref.owner}/${ref.repo}/languages`);
}

export async function fetchContributors(ref: RepoRef): Promise<GhContributors> {
  const res = await ghRaw(`/repos/${ref.owner}/${ref.repo}/contributors?per_page=10&anon=true`);
  if (res.status === 204 || res.status === 409) return { top: [], count: 0, approx: false };
  const top = (await res.json()) as GhContributor[];
  const link = res.headers.get("link");
  const last = link?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (last) return { top, count: Number(last[1]) * 10, approx: true };
  return { top, count: top.length, approx: false };
}

export function fetchCommits(ref: RepoRef): Promise<GhCommitItem[]> {
  // 409 = empty repository → treated as []
  return gh<GhCommitItem[]>(`/repos/${ref.owner}/${ref.repo}/commits?per_page=30`);
}

export function fetchRootContents(ref: RepoRef): Promise<GhContentEntry[]> {
  return gh<GhContentEntry[]>(`/repos/${ref.owner}/${ref.repo}/contents`);
}

/* ---------- root-tree signal extraction ---------- */

export interface RepoSignals {
  hasReadme: boolean;
  readmeBytes: number;
  hasLicenseFile: boolean;
  hasTests: boolean;
  hasCI: boolean;
  hasLockfile: boolean;
  hasEnvFile: boolean;
  isSolanaProgram: boolean;
}

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "cargo.lock",
  "poetry.lock",
  "uv.lock",
  "go.sum",
  "composer.lock",
  "gemfile.lock",
]);

const TEST_DIRS = new Set(["test", "tests", "__tests__", "spec"]);
const ENV_OK = new Set([".env.example", ".env.template", ".env.sample", ".env.local.example"]);

export function analyzeRoot(entries: GhContentEntry[]): RepoSignals {
  const s: RepoSignals = {
    hasReadme: false,
    readmeBytes: 0,
    hasLicenseFile: false,
    hasTests: false,
    hasCI: false,
    hasLockfile: false,
    hasEnvFile: false,
    isSolanaProgram: false,
  };
  let hasAnchor = false;
  let hasCargo = false;
  let hasProgramsDir = false;

  for (const e of entries) {
    const n = e.name.toLowerCase();
    if (e.type === "file") {
      if (n.startsWith("readme")) {
        s.hasReadme = true;
        s.readmeBytes = Math.max(s.readmeBytes, e.size);
      }
      if (n === "license" || n.startsWith("license.") || n === "copying" || n === "licence") {
        s.hasLicenseFile = true;
      }
      if (LOCKFILES.has(n)) s.hasLockfile = true;
      if (n.startsWith("jest.config") || n.startsWith("vitest.config")) s.hasTests = true;
      if (/^\.env(\..+)?$/.test(n) && !ENV_OK.has(n)) s.hasEnvFile = true;
      if (n === "anchor.toml") hasAnchor = true;
      if (n === "cargo.toml") hasCargo = true;
      if (n === ".gitlab-ci.yml") s.hasCI = true;
    } else if (e.type === "dir") {
      if (TEST_DIRS.has(n)) s.hasTests = true;
      if (n === ".github") s.hasCI = true;
      if (n === ".circleci") s.hasCI = true;
      if (n === "programs") hasProgramsDir = true;
    }
  }

  s.isSolanaProgram = hasAnchor || (hasCargo && hasProgramsDir);
  return s;
}
