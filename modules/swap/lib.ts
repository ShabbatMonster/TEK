"use client";

/** Jupiter lite-api client. Public, no key, CORS-enabled. */

const TOKENS_API = "https://lite-api.jup.ag/tokens/v2";
const SWAP_API = "https://lite-api.jup.ag/swap/v1";

export interface JupToken {
  id: string; // mint
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  usdPrice?: number;
  mcap?: number;
  liquidity?: number;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
  isVerified?: boolean;
}

export const SOL_TOKEN: JupToken = {
  id: "So11111111111111111111111111111111111111112",
  name: "Solana",
  symbol: "SOL",
  icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  decimals: 9,
  isVerified: true,
};

export const USDC_TOKEN: JupToken = {
  id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  name: "USD Coin",
  symbol: "USDC",
  icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  decimals: 6,
  isVerified: true,
};

export async function searchTokens(query: string): Promise<JupToken[]> {
  const res = await fetch(`${TOKENS_API}/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`token search failed: ${res.status}`);
  return res.json();
}

export async function getTokensByMints(mints: string[]): Promise<JupToken[]> {
  if (mints.length === 0) return [];
  const res = await fetch(`${TOKENS_API}/search?query=${mints.join(",")}`);
  if (!res.ok) throw new Error(`token lookup failed: ${res.status}`);
  return res.json();
}

export interface JupQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: {
    swapInfo: { label?: string; ammKey: string; inputMint: string; outputMint: string };
    percent: number;
  }[];
}

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amountRaw: string;
  slippageBps: number;
}): Promise<JupQuote> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountRaw,
    slippageBps: String(params.slippageBps),
    swapMode: "ExactIn",
  });
  const res = await fetch(`${SWAP_API}/quote?${q}`);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `quote failed: ${res.status}`);
  return json;
}

export async function buildSwapTx(
  quote: JupQuote,
  userPublicKey: string
): Promise<string> {
  const res = await fetch(`${SWAP_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: "auto",
      wrapAndUnwrapSol: true,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `swap build failed: ${res.status}`);
  return json.swapTransaction as string; // base64
}
