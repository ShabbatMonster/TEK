"use client";

import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection } from "@/lib/solana";

/** Rent-exempt reserve of a standard SPL token account, in SOL. */
export const RENT_PER_ACCOUNT_SOL = 0.00203928;

/** Max burn+close pairs packed per transaction. */
export const MAX_ACCOUNTS_PER_TX = 12;

/** uiAmount below this (but > 0) is classified as dust. */
export const DUST_THRESHOLD = 0.001;

export type AccountClass = "empty" | "dust" | "holding" | "frozen";

export interface BurnableAccount {
  /** token account pubkey (base58) */
  pubkey: string;
  /** mint pubkey (base58) */
  mint: string;
  uiAmount: number;
  decimals: number;
  /** raw amount as string — BigInt-safe, never floated */
  rawAmount: string;
  frozen: boolean;
  cls: AccountClass;
}

export function classify(uiAmount: number, frozen: boolean): AccountClass {
  if (frozen) return "frozen";
  if (uiAmount === 0) return "empty";
  if (uiAmount < DUST_THRESHOLD) return "dust";
  return "holding";
}

const CLASS_ORDER: Record<AccountClass, number> = {
  empty: 0,
  dust: 1,
  holding: 2,
  frozen: 3,
};

/** Scan owner's SPL token accounts and classify each one. */
export async function scanTokenAccounts(
  owner: PublicKey
): Promise<BurnableAccount[]> {
  const conn = getConnection();
  const res = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const rows: BurnableAccount[] = [];
  for (const { pubkey, account } of res.value) {
    const info = account.data.parsed?.info;
    if (!info?.mint || !info?.tokenAmount) continue;
    const uiAmount: number = info.tokenAmount.uiAmount ?? 0;
    const frozen = info.state === "frozen";
    rows.push({
      pubkey: pubkey.toBase58(),
      mint: String(info.mint),
      uiAmount,
      decimals: Number(info.tokenAmount.decimals ?? 0),
      rawAmount: String(info.tokenAmount.amount ?? "0"),
      frozen,
      cls: classify(uiAmount, frozen),
    });
  }

  rows.sort((a, b) => {
    const d = CLASS_ORDER[a.cls] - CLASS_ORDER[b.cls];
    if (d !== 0) return d;
    return a.mint.localeCompare(b.mint);
  });
  return rows;
}

/* ---------------- Jupiter symbol enrichment ---------------- */

export interface TokenMeta {
  id: string; // mint
  name?: string;
  symbol?: string;
  icon?: string;
  decimals?: number;
}

/** Look up symbols/icons for mints via Jupiter lite-api, batched ≤20 per call. */
export async function fetchTokenMetas(
  mints: string[]
): Promise<Record<string, TokenMeta>> {
  const out: Record<string, TokenMeta> = {};
  for (const group of chunk(mints, 20)) {
    try {
      const res = await fetch(
        `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(group.join(","))}`
      );
      if (!res.ok) continue;
      const list = (await res.json()) as TokenMeta[];
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        if (t && typeof t.id === "string") out[t.id] = t;
      }
    } catch {
      /* enrichment is best-effort; fall back to short mint */
    }
  }
  return out;
}

/* ---------------- lifetime counter (localStorage) ---------------- */

export const LIFETIME_KEY = "tek:incinerator:lifetime";

export interface Lifetime {
  /** total SOL reclaimed */
  sol: number;
  /** total accounts closed */
  accounts: number;
}

export function readLifetime(): Lifetime {
  if (typeof window === "undefined") return { sol: 0, accounts: 0 };
  try {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    if (!raw) return { sol: 0, accounts: 0 };
    const parsed = JSON.parse(raw) as Partial<Lifetime>;
    return {
      sol: typeof parsed.sol === "number" && isFinite(parsed.sol) ? parsed.sol : 0,
      accounts:
        typeof parsed.accounts === "number" && isFinite(parsed.accounts)
          ? parsed.accounts
          : 0,
    };
  } catch {
    return { sol: 0, accounts: 0 };
  }
}

export function writeLifetime(l: Lifetime): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIFETIME_KEY, JSON.stringify(l));
  } catch {
    /* storage full / blocked — non-fatal */
  }
}

/* ---------------- misc ---------------- */

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
