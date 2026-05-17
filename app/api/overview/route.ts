import { NextRequest, NextResponse } from "next/server";
import { runOverviewAgent, OverviewRequest, OverviewCard } from "@/lib/overviewAgent";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { level, documentTitle, cards } = body as Record<string, unknown>;

  if (level !== "document" && level !== "bundle") {
    return NextResponse.json(
      { error: "level must be 'document' or 'bundle'" },
      { status: 400 }
    );
  }

  if (typeof documentTitle !== "string" || !documentTitle.trim()) {
    return NextResponse.json({ error: "documentTitle is required" }, { status: 400 });
  }

  if (!Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: "cards must be a non-empty array" }, { status: 400 });
  }

  const request: OverviewRequest = {
    level,
    documentTitle: documentTitle.trim(),
    cards: cards as OverviewCard[],
  };

  try {
    const result = await runOverviewAgent(request);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[overview-agent] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
