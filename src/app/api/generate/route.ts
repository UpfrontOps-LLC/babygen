import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, isPaid, markPaid, setImages, setVideo, setAges, clearParents } from "@/lib/store";
import { ensureMainInstance, awaitResult, CACHE } from "@/lib/generate";
import { wantsVideo, wantsAges } from "@/lib/gen-timing";
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

    const entry = await getEntry(token);
    if (!entry) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });

    // FAST preview path (staging): the durable Workflow has ~50s cold-start
    // scheduling latency, which is pointless when we're serving cached outputs.
    // Skip it and return the cached deliverables immediately. Production (REAL_GEN
    // and/or no FAST_GEN) still goes through the durable Workflow below.
    if (process.env.FAST_GEN === "1" && process.env.REAL_GEN !== "1") {
      const tier = entry.tier || "basic";
      const bump = entry.bump || "";
      const wantsV = entry.wantVideo ?? wantsVideo(tier, bump);
      const wantsA = entry.wantAges ?? wantsAges(tier);
      if (!entry.images) {
        await setImages(token, CACHE.images);
        if (wantsV) await setVideo(token, CACHE.video);
        if (wantsA) await setAges(token, CACHE.ages);
        await clearParents(token);
      }
      const fast = { images: CACHE.images, video: wantsV ? CACHE.video : undefined, ages: wantsA ? CACHE.ages : undefined, cached: true };
      await emit("reveal", { token, meta: { cached: true, fast: true, hasVideo: wantsV, hasAges: wantsA } });
      return NextResponse.json(fast);
    }

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
