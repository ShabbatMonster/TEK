import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy for pump.fun IPFS pinning. pump.fun does not send CORS headers,
 * so the browser cannot POST to it directly. We forward the multipart
 * FormData (file, name, symbol, description, twitter, telegram, website,
 * showName) verbatim and return the JSON ({ metadataUri, metadata }).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData();
    if (!(form.get("file") instanceof Blob)) {
      return NextResponse.json({ error: "missing image file" }, { status: 400 });
    }

    const upstream = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `pump.fun ipfs ${upstream.status}: ${text.slice(0, 300) || upstream.statusText}` },
        { status: 502 }
      );
    }

    const json: unknown = await upstream.json();
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ipfs proxy failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
