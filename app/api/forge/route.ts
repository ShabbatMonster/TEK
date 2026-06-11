import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM = `You are a senior security auditor writing a terse executive summary of a GitHub repository's health for a crypto user deciding whether to trust the project. You receive a JSON payload of computed stats, grades, and findings from a static metadata audit (repo metadata, contributors, commit history, root file listing — NO source code was read).

Write 4-8 sentences of plain prose. No markdown, no headings, no bullet lists. Cite the specific numbers and findings that matter most for a trust decision. Lead with the strongest signal (good or bad). Be honest about what static analysis cannot see: hidden malicious logic, unaudited code paths, and whether any deployed on-chain program actually matches this source. No hype, no filler.`;

interface ForgeAiBody {
  repo?: string;
  stats?: unknown;
  findings?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ offline: true });

    const body = (await req.json()) as ForgeAiBody;
    if (!body || typeof body.repo !== "string" || !body.repo) {
      return NextResponse.json({ error: "missing repo" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            repo: body.repo,
            stats: body.stats ?? null,
            findings: body.findings ?? null,
          }),
        },
      ],
    });

    const summary = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (!summary) {
      return NextResponse.json({ error: "model returned no text" }, { status: 502 });
    }
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forge summary failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
