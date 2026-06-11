"use client";

/** DexScreener public API client. CORS-enabled, no key. */

const API = "https://api.dexscreener.com";

/* ---------- response types (only what we use) ---------- */

export interface DexLink {
  label?: string;
  type?: string;
  url: string;
}

/** Shape shared by token-boosts and token-profiles entries. */
export interface DexTokenMeta {
  tokenAddress: string;
  chainId: string;
  icon?: string;
  description?: string;
  url?: string;
  links?: DexLink[];
  /** boosts only */
  totalAmount?: number;
}

export interface DexPair {
  chainId: string;
  dexId?: string;
  url?: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

/* ---------- fetchers ---------- */

function dedupeSolana(items: DexTokenMeta[]): DexTokenMeta[] {
  const seen = new Set<string>();
  const out: DexTokenMeta[] = [];
  for (const it of items) {
    if (it.chainId !== "solana") continue;
    if (seen.has(it.tokenAddress)) continue;
    seen.add(it.tokenAddress);
    out.push(it);
  }
  return out;
}

/** Trending/boosted tokens, solana only, deduped, in rank order. */
export async function fetchBoosts(): Promise<DexTokenMeta[]> {
  const res = await fetch(`${API}/token-boosts/top/v1`);
  if (!res.ok) throw new Error(`boosts fetch failed: ${res.status}`);
  return dedupeSolana((await res.json()) as DexTokenMeta[]);
}

/** Latest token profiles (new listings intel), solana only. */
export async function fetchProfiles(): Promise<DexTokenMeta[]> {
  const res = await fetch(`${API}/token-profiles/latest/v1`);
  if (!res.ok) throw new Error(`profiles fetch failed: ${res.status}`);
  return dedupeSolana((await res.json()) as DexTokenMeta[]);
}

/** Pair/market data for up to N token addresses (API caps 30 per call; we chunk). */
export async function fetchPairs(addrs: string[]): Promise<DexPair[]> {
  if (addrs.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < addrs.length; i += 30) chunks.push(addrs.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch(`${API}/tokens/v1/solana/${chunk.join(",")}`);
      if (!res.ok) throw new Error(`pairs fetch failed: ${res.status}`);
      return (await res.json()) as DexPair[];
    })
  );
  return results.flat();
}

/* ---------- helpers ---------- */

/** Highest-liquidity pair per base token address. */
export function pickBestPairs(pairs: DexPair[]): Record<string, DexPair> {
  const best: Record<string, DexPair> = {};
  for (const p of pairs) {
    if (p.chainId !== "solana") continue;
    const addr = p.baseToken.address;
    const cur = best[addr];
    if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best[addr] = p;
  }
  return best;
}

/** Client-side rug/risk heuristics for a pair. */
export function riskFlags(p: DexPair): string[] {
  const flags: string[] = [];
  const liq = p.liquidity?.usd ?? 0;
  if (liq < 10_000) flags.push("THIN LIQ");
  if (p.pairCreatedAt && Date.now() - p.pairCreatedAt < 86_400_000) flags.push("FRESH PAIR");
  if (liq > 0 && (p.volume?.h24 ?? 0) / liq > 10) flags.push("CHURN");
  if (Math.abs(p.priceChange?.m5 ?? 0) > 20) flags.push("VOLATILE SPIKE");
  return flags;
}
