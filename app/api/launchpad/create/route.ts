import { NextResponse, type NextRequest } from "next/server";
import { Buffer } from "buffer";

export const runtime = "nodejs";

/**
 * Proxy for PumpPortal trade-local create. PumpPortal returns the
 * serialized (unsigned) transaction as raw bytes; we re-encode it as
 * base64 JSON { tx } so the client can VersionedTransaction.deserialize it.
 * On error PumpPortal returns plain text — passed through as JSON error.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    const upstream = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `pumpportal ${upstream.status}: ${text.slice(0, 300) || upstream.statusText}` },
        { status: 502 }
      );
    }

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "pumpportal returned empty transaction" }, { status: 502 });
    }

    return NextResponse.json({ tx: Buffer.from(bytes).toString("base64") });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create proxy failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
