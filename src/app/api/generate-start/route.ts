import { NextRequest, NextResponse } from "next/server";
import { getEntry } from "@/lib/store";
import { kickOffGenerate } from "@/lib/generate";
import { emit } from "@/lib/events";

export const runtime = "nodejs";
export const maxDuration = 300;

// Fired the moment the customer focuses the CVV field (or taps a wallet button).
// Kicks off generation SPECULATIVELY, in the background, so the wait overlaps the
// payment instead of following it. No pay-gate — this is speculative; the actual
// reveal is still gated by /api/generate after payment verifies. Idempotent.
export async function POST(req: NextRequest) {
  let token = "";
  try { ({ token } = await req.json()); } catch {}
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  if (!getEntry(token)) return NextResponse.json({ error: "unknown token" }, { status: 404 });

  emit("card_focus", { token }); // the CVV moment — visible in /monitor
  const { started } = kickOffGenerate(token);
  return NextResponse.json({ ok: true, started });
}
