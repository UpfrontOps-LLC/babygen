import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { markPaid, claimEvent } from "@/lib/store";

export const runtime = "nodejs";
// Stripe signature verification needs the EXACT raw bytes, never parse the body.
export const dynamic = "force-dynamic";

const SKEY = process.env.STRIPE_SECRET_KEY;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook (standalone babygen account, no Connect).
 *
 * Authoritative confirmation that a Checkout payment cleared. On
 * `checkout.session.completed` it marks the token paid in the store, which the
 * /api/generate gate trusts. Idempotent (Stripe retries) and fail-closed on a
 * bad/absent signature.
 */
export async function POST(req: NextRequest) {
  if (!SKEY || !WHSEC) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(SKEY, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    // Workers crypto is async — constructEventAsync, not constructEvent.
    event = await stripe.webhooks.constructEventAsync(raw, sig, WHSEC);
  } catch (e) {
    // Bad signature → reject. Do NOT trust the payload.
    return NextResponse.json({ error: `signature verification failed: ${e instanceof Error ? e.message : "?"}` }, { status: 400 });
  }

  // Dedupe redeliveries before doing any fulfillment work.
  if (!(await claimEvent(event.id))) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // The embedded Payment Element pays via PaymentIntent; this is the durable
  // confirmation that survives the customer closing the tab post-payment.
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const token = pi.metadata?.token;
    if (token) {
      await markPaid(token, { tier: pi.metadata?.tier, bump: pi.metadata?.bump });
      console.error(`[webhook] PAID (pi) token=${token.slice(0, 8)} tier=${pi.metadata?.tier} bump=${pi.metadata?.bump || "-"}`);
    }
  }

  // Legacy hosted-Checkout path (kept harmless for any in-flight sessions).
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const token = session.metadata?.token;
    if (session.payment_status === "paid" && token) {
      await markPaid(token, { tier: session.metadata?.tier, bump: session.metadata?.bump });
      console.error(`[webhook] PAID token=${token.slice(0, 8)} tier=${session.metadata?.tier} bump=${session.metadata?.bump || "-"}`);
    }
  }

  // 2xx tells Stripe the event was received; anything else triggers retries.
  return NextResponse.json({ received: true });
}
