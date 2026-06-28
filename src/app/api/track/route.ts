import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Append-only event log for the A/B harness. Once Stripe + traffic exist, join
// these events with payments to compute revenue-per-visitor by variant.
const LOG = path.join(process.cwd(), ".data", "events.ndjson");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = String(body?.event || "").slice(0, 40);
    if (!event) return NextResponse.json({ ok: false, error: "no event" }, { status: 400 });
    const rec = {
      ts: Date.now(),
      event,
      variant: String(body?.variant || "").slice(0, 8),
      tier: String(body?.tier || "").slice(0, 16),
      meta: typeof body?.meta === "object" ? body.meta : undefined,
    };
    await fs.mkdir(path.dirname(LOG), { recursive: true });
    await fs.appendFile(LOG, JSON.stringify(rec) + "\n");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
