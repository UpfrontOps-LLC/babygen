import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, isPaid, markPaid } from "@/lib/store";
import { releaseGenerate } from "@/lib/generate";
import { emit } from "@/lib/events";

export const runtime = "nodejs";
export const maxDuration = 300;

const SKEY = process.env.STRIPE_SECRET_KEY;

// POST { token, payment_intent } — verifies the PaymentIntent succeeded, THEN
// releases the tier's deliverables (already generated speculatively at the CVV
// moment, so this is usually instant; otherwise it generates and waits).
export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN || !SKEY) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  try {
    const { token, payment_intent } = await req.json();
    if (!token || !payment_intent) return NextResponse.json({ error: "missing params" }, { status: 400 });

    // GATE: only release if payment cleared. Prefer the durable webhook flag;
    // else a live PaymentIntent lookup (which also confirms the token matches).
    if (!isPaid(token)) {
      const stripe = new Stripe(SKEY);
      const pi = await stripe.paymentIntents.retrieve(String(payment_intent));
      if (pi.status !== "succeeded" || pi.metadata?.token !== token) {
        return NextResponse.json({ error: "payment not verified" }, { status: 402 });
      }
      markPaid(token, { tier: pi.metadata?.tier, bump: pi.metadata?.bump });
    }

    if (!getEntry(token)) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });

    const result = await releaseGenerate(token);
    emit("reveal", { token, meta: { cached: result.cached, hasVideo: !!result.video, hasAges: !!result.ages } });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 500 });
  }
}
