import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, setVideo, setAges } from "@/lib/store";
import { ensureAddonsInstance, awaitAddons, CACHE } from "@/lib/generate";
import { emit } from "@/lib/events";

export const runtime = "nodejs";

const SKEY = process.env.STRIPE_SECRET_KEY;

// Server-side price list — NEVER trust client amounts.
const ADDON_PRICES: Record<string, number> = {
  video: 700,
  ages: 900,
  gender: 500,
  twins: 500,
  hd: 500,
};

// POST { token, payment_intent, addons:[] } — one-click upsell. Reuses the card
// saved on the original PaymentIntent (off_session, no re-entry), then generates
// and returns the add-on deliverables.
export async function POST(req: NextRequest) {
  if (!SKEY) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  try {
    const { token, payment_intent, addons } = await req.json();
    if (!token || !payment_intent || !Array.isArray(addons) || addons.length === 0) {
      return NextResponse.json({ error: "missing params" }, { status: 400 });
    }
    const valid = addons.filter((a: string) => a in ADDON_PRICES);
    if (valid.length === 0) return NextResponse.json({ error: "no valid add-ons" }, { status: 400 });
    if (!(await getEntry(token))) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });

    const stripe = new Stripe(SKEY, { httpClient: Stripe.createFetchHttpClient() });

    // GATE: the original purchase must have succeeded and own this token.
    const orig = await stripe.paymentIntents.retrieve(String(payment_intent));
    if (orig.status !== "succeeded" || orig.metadata?.token !== token) {
      return NextResponse.json({ error: "original payment not verified" }, { status: 402 });
    }
    const customer = typeof orig.customer === "string" ? orig.customer : orig.customer?.id;
    const paymentMethod = typeof orig.payment_method === "string" ? orig.payment_method : orig.payment_method?.id;
    if (!customer || !paymentMethod) {
      return NextResponse.json({ error: "card not on file, can't one-click", needsCard: true }, { status: 409 });
    }

    const amount = valid.reduce((sum: number, a: string) => sum + ADDON_PRICES[a], 0);

    // Charge the saved card with no re-entry.
    let pi2: Stripe.PaymentIntent;
    try {
      pi2 = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        customer,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        description: `See Our Baby add-ons: ${valid.join(", ")}`,
        metadata: { token, kind: "upsell", addons: valid.join(",") },
      });
    } catch (e) {
      // Card needs authentication (rare for off_session) or was declined.
      const msg = e instanceof Stripe.errors.StripeError ? e.message : "card declined";
      await emit("upsell_failed", { token, meta: { addons: valid, error: msg } });
      return NextResponse.json({ error: msg, needsCard: true }, { status: 402 });
    }

    if (pi2.status !== "succeeded") {
      return NextResponse.json({ error: "payment didn't complete", status: pi2.status }, { status: 402 });
    }
    await emit("upsell_paid", { token, meta: { addons: valid, amount } });

    // FAST preview path (staging): skip the durable Workflow's ~50s cold start and
    // return the cached add-on media immediately. Production still uses the Workflow.
    if (process.env.FAST_GEN === "1" && process.env.REAL_GEN !== "1") {
      const media: { video?: string; ages?: string[]; extras?: string[] } = {};
      const extras: string[] = [];
      if (valid.includes("video")) { media.video = CACHE.video; await setVideo(token, CACHE.video); }
      if (valid.includes("ages")) { media.ages = CACHE.ages; await setAges(token, CACHE.ages); }
      if (valid.includes("gender")) extras.push(CACHE.images[0], CACHE.images[1]);
      if (valid.includes("twins")) extras.push(CACHE.images[2]);
      if (valid.includes("hd")) extras.push(...CACHE.images);
      if (extras.length) media.extras = extras;
      await emit("upsell_generate_done", { token, meta: { addons: valid, cached: true, fast: true } });
      return NextResponse.json({ ok: true, addons: valid, amount, media });
    }

    // Deliver the add-ons via a durable Workflow instance (cached = real-length
    // wait; real only if REAL_GEN=1), then await its KV result.
    await ensureAddonsInstance(token, valid);
    const media = await awaitAddons(token);
    return NextResponse.json({ ok: true, addons: valid, amount, media });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 500 });
  }
}
