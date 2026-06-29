import { NextResponse } from "next/server";
import { recent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON snapshot of recent events from KV — used by the e2e to assert ordering
// (generate_start before payment_succeeded) and polled by the live monitor
// (/monitor) every ~2s (the SSE stream is gone — no long-lived sockets on Workers).
export async function GET() {
  return NextResponse.json({ events: await recent(200) });
}
