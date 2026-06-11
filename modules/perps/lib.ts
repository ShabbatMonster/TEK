"use client";

/**
 * Drift DLOB server client — public, CORS-enabled, read-only.
 * Prices are integer strings at PRICE_PRECISION (1e6); sizes at BASE_PRECISION (1e9).
 *
 * Observed live response shape (flat object, no wrapper):
 * {
 *   bids: [{ price: "928400", size: "77114500000", sources: {...} }, ...],
 *   asks: [...],
 *   marketName, marketType, marketIndex, ts, slot,
 *   markPrice: "1005980", bestBidPrice, bestAskPrice, spreadPct, spreadQuote,
 *   oracle: 64838646,                       // number, PRICE_PRECISION
 *   oracleData: { price: "64838646", ... }  // string, PRICE_PRECISION
 * }
 * normalizeL2 also tolerates an { l2: {...} } wrapper and string/number variants.
 */

/** primary + fallback DLOB hosts — same API; primary occasionally 503s */
const DLOB_HOSTS = ["https://dlob.drift.trade", "https://master.dlob.drift.trade"];

export const PRICE_PRECISION = 1e6;
export const BASE_PRECISION = 1e9;

export type PerpMarket = "SOL-PERP" | "BTC-PERP" | "ETH-PERP";

export const PERP_MARKETS: PerpMarket[] = ["SOL-PERP", "BTC-PERP", "ETH-PERP"];

export interface MarketMeta {
  /** base asset symbol */
  base: string;
  /** decimal places for price display */
  priceDp: number;
  /** decimal places for size display */
  sizeDp: number;
}

export const MARKET_META: Record<PerpMarket, MarketMeta> = {
  "SOL-PERP": { base: "SOL", priceDp: 3, sizeDp: 1 },
  "BTC-PERP": { base: "BTC", priceDp: 1, sizeDp: 4 },
  "ETH-PERP": { base: "ETH", priceDp: 2, sizeDp: 3 },
};

export interface Level {
  price: number; // USD
  size: number; // base units
}

export interface L2Book {
  /** sorted best-first (descending price) */
  bids: Level[];
  /** sorted best-first (ascending price) */
  asks: Level[];
  oraclePrice: number | null;
  markPrice: number | null;
  /** client receive time, ms */
  ts: number;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return null;
}

function parseLevels(raw: unknown, label: string): Level[] {
  if (!Array.isArray(raw)) throw new Error(`DLOB: "${label}" is not an array`);
  const out: Level[] = [];
  for (const lvl of raw) {
    if (lvl == null || typeof lvl !== "object") continue;
    const o = lvl as Record<string, unknown>;
    const price = toNum(o.price);
    const size = toNum(o.size);
    if (price == null || size == null || price <= 0 || size <= 0) continue;
    out.push({ price: price / PRICE_PRECISION, size: size / BASE_PRECISION });
  }
  return out;
}

/** Normalize any known DLOB /l2 response variant into an L2Book, or throw a readable error. */
export function normalizeL2(json: unknown): L2Book {
  if (json == null || typeof json !== "object") {
    throw new Error("DLOB: response is not an object");
  }
  let root = json as Record<string, unknown>;
  // tolerate { l2: {...} } wrapper
  if (!("bids" in root) && root.l2 != null && typeof root.l2 === "object") {
    root = root.l2 as Record<string, unknown>;
  }
  if (!("bids" in root) || !("asks" in root)) {
    throw new Error("DLOB: response missing bids/asks");
  }

  const bids = parseLevels(root.bids, "bids").sort((a, b) => b.price - a.price);
  const asks = parseLevels(root.asks, "asks").sort((a, b) => a.price - b.price);
  if (bids.length === 0 && asks.length === 0) throw new Error("DLOB: empty book");

  // oracle may be root.oracle (number|string) or root.oracleData.price (string)
  let oracleRaw = toNum(root.oracle);
  if (oracleRaw == null && root.oracleData != null && typeof root.oracleData === "object") {
    oracleRaw = toNum((root.oracleData as Record<string, unknown>).price);
  }
  const oraclePrice = oracleRaw != null && oracleRaw > 0 ? oracleRaw / PRICE_PRECISION : null;

  const markRaw = toNum(root.markPrice);
  const markPrice = markRaw != null && markRaw > 0 ? markRaw / PRICE_PRECISION : null;

  return { bids, asks, oraclePrice, markPrice, ts: Date.now() };
}

export async function fetchL2(market: PerpMarket, depth = 16): Promise<L2Book> {
  const q = new URLSearchParams({
    marketName: market,
    depth: String(depth),
    includeOracle: "true",
  });
  let lastErr: Error | null = null;
  for (const host of DLOB_HOSTS) {
    try {
      const res = await fetch(`${host}/l2?${q}`);
      if (!res.ok) throw new Error(`DLOB l2 ${market}: HTTP ${res.status}`);
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new Error(`DLOB l2 ${market}: invalid JSON`);
      }
      return normalizeL2(json);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`DLOB l2 ${market}: all hosts failed`);
}

/* ---------- derived helpers ---------- */

export interface BookStats {
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
  spreadBps: number | null;
}

export function bookStats(book: L2Book): BookStats {
  const bestBid = book.bids[0]?.price ?? null;
  const bestAsk = book.asks[0]?.price ?? null;
  const mid =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadBps = spread != null && mid != null && mid > 0 ? (spread / mid) * 10_000 : null;
  return { bestBid, bestAsk, mid, spread, spreadBps };
}

/**
 * Simplified cross-margin liquidation approximation (NOT SDK math — labeled "approx" in UI):
 * long:  entry * (1 - 1/leverage * 0.9)
 * short: entry * (1 + 1/leverage * 0.9)
 */
export function estLiqPrice(entry: number, leverage: number, side: "long" | "short"): number {
  const k = (1 / leverage) * 0.9;
  return side === "long" ? entry * (1 - k) : entry * (1 + k);
}

/** fixed-decimal tabular price/size formatting */
export function fmtFixed(n: number | null | undefined, dp: number): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}
