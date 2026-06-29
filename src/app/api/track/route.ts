import { NextRequest, NextResponse } from "next/server";
import { emit } from "@/lib/events";

export const runtime = "nodejs";

// Client-side funnel events. On the VPS these were appended to .data/events.ndjson;
// on Workers they go to the KV-backed events feed via emit() (same feed /monitor
// and the e2e read through /api/events). The variant/tier dims ride along in meta.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = String(body?.event || "").slice(0, 40);
    if (!event) return NextResponse.json({ ok: false, error: "no event" }, { status: 400 });
    const meta = typeof body?.meta === "object" ? body.meta : undefined;
    const variant = String(body?.variant || "").slice(0, 8);
    const tier = String(body?.tier || "").slice(0, 16);
    await emit(event, { token: String(body?.token || "") || undefined, meta: { ...meta, variant, tier } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
