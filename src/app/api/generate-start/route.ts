import { NextRequest, NextResponse } from "next/server";
import { getEntry } from "@/lib/store";
import { ensureMainInstance } from "@/lib/generate";
import { emit } from "@/lib/events";

export const runtime = "nodejs";

// Fired the moment the customer focuses the CVV field (or taps a wallet button).
// Starts the durable GenerateBaby Workflow SPECULATIVELY so the wait overlaps the
// payment instead of following it. No pay-gate — this is speculative; the actual
// reveal is still gated by /api/generate after payment verifies. Idempotent: the
// Workflow instance id is the token, so repeat fires are no-ops.
export async function POST(req: NextRequest) {
  let token = "";
  try { ({ token } = await req.json()); } catch {}
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  if (!(await getEntry(token))) return NextResponse.json({ error: "unknown token" }, { status: 404 });

  await emit("card_focus", { token }); // the CVV moment — visible in /monitor
  const { started } = await ensureMainInstance(token);
  return NextResponse.json({ ok: true, started });
}
