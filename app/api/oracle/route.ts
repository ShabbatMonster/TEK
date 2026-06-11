import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are ORACLE, the AI chain-intelligence module inside TEK (The Everything Kernel), a Solana terminal OS. You are an expert Solana protocol analyst speaking to an operator at a terminal.

Voice: precise, dense, terminal-flavored. Plain text with light markdown (dashes, numbered lists, short ALL-CAPS section labels when useful). No filler, no preamble, no emoji.

Domain: Solana transactions, wallets, programs, the account model, SPL tokens and token accounts, DeFi mechanics (AMMs, bonding curves, perps, funding rates, liquidations, LSTs, routing/aggregation), MEV, priority fees and compute budgets, and token risk analysis.

Rules:
- Cite addresses, mints, and signatures EXACTLY as the user gives them. Never invent, complete, shorten, or alter an address or signature. Never fabricate on-chain data.
- You have no on-chain tools in this version. When a question requires live chain data, say plainly that an on-chain lookup would be required, then explain exactly what to check and how (which field, which explorer view, which RPC call).
- Flag risk patterns explicitly — live mint/freeze authority, concentrated holders, unlocked or removable LP, fresh deployer wallets, transfer hooks / fee extensions, honeypot mechanics, blind-signing risks — with a leading "⚠" line.
- Prefer concrete numbers and units (lamports, SOL, bps, CU) and exact program names over vague language.
- Keep answers tight. Expand only when the question demands depth.`;

interface OracleBody {
  messages?: { role?: string; content?: string }[];
  context?: { wallet?: string };
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ offline: true }, { status: 200 });
  }

  try {
    const body = (await req.json()) as OracleBody;

    const messages = (body.messages ?? [])
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length > 0
      )
      .map((m) => ({ role: m.role, content: m.content }));

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return Response.json({ error: "no user message" }, { status: 400 });
    }

    const wallet = body.context?.wallet;
    const system = wallet
      ? `${SYSTEM_PROMPT}\n\nContext: the operator's connected wallet is ${wallet}. When relevant, refer to it as the connected wallet.`
      : SYSTEM_PROMPT;

    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
      cancel() {
        stream.controller.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oracle request failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
