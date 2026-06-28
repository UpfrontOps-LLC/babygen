import { NextResponse } from "next/server";
import { recent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON snapshot of recent events — used by the e2e to assert ordering
// (generate_start before payment_succeeded) and handy for quick debugging.
// The live human-facing view is the SSE feed at /api/events/stream (/monitor).
export async function GET() {
  return NextResponse.json({ events: recent(200) });
}
