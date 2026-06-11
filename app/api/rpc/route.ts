import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Solana RPC proxy. Keeps any API key server-side and dodges browser-origin
 * blocks on the public endpoints (mainnet-beta returns 403 for heavy methods
 * like getSignaturesForAddress / getTokenAccountsByOwner from browser IPs).
 *
 * Override the upstream with RPC_URL (server-only, may contain a key) or
 * NEXT_PUBLIC_RPC_URL. Defaults to a public endpoint that allows these methods.
 */
const UPSTREAM =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://solana-rpc.publicnode.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: `RPC proxy error: ${e instanceof Error ? e.message : String(e)}` }, id: null },
      { status: 502 }
    );
  }
}
