import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, isPaid, markPaid } from "@/lib/store";
import { ensureMainInstance, awaitResult } from "@/lib/generate";
import { emit } from "@/lib/events";

export const runtime = "nodejs";

const SKEY = process.env.STRIPE_SECRET_KEY;

// POST { token, payment_intent } — verifies the PaymentIntent succeeded, ensures
// the durable GenerateBaby Workflow is running (it usually already is, started
// speculatively at the CVV moment), then waits for its results. On a /success
// reload this returns instantly from KV — the durability win over the old
// background-promise model that died when the tab closed.
export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN || !SKEY) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  try {
    const { token, payment_intent } = await req.json();
    if (!token || !payment_intent) return NextResponse.json({ error: "missing params" }, { status: 400 });

    // GATE: only release if payment cleared. Prefer the durable webhook flag;
    // else a live PaymentIntent lookup (which also confirms the token matches).
    if (!(await isPaid(token))) {
      const stripe = new Stripe(SKEY, { httpClient: Stripe.createFetchHttpClient() });
      const pi = await stripe.paymentIntents.retrieve(String(payment_intent));
      if (pi.status !== "succeeded" || pi.metadata?.token !== token) {
        return NextResponse.json({ error: "payment not verified" }, { status: 402 });
      }
      await markPaid(token, { tier: pi.metadata?.tier, bump: pi.metadata?.bump });
    }

    if (!(await getEntry(token))) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });

    // Ensure the Workflow exists (covers the wallet-redirect path where the CVV
    // speculative start never fired), then await its KV results.
    await ensureMainInstance(token);
    const result = await awaitResult(token);
    await emit("reveal", { token, meta: { cached: result.cached, hasVideo: !!result.video, hasAges: !!result.ages } });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 500 });
  }
}
