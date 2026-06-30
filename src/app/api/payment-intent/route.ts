import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { putParents } from "@/lib/store";
import { emit } from "@/lib/events";
import { recordedSeconds, tierKey } from "@/lib/gen-timing";

export const runtime = "nodejs";

const key = process.env.STRIPE_SECRET_KEY;
const TIERS: Record<string, { price: number; name: string }> = {
  basic: { price: 2499, name: "Your Future Baby, Starter (3 HD photos + video)" },
  deluxe: { price: 3900, name: "Your Future Baby, Deluxe (photos + giggle & dance video + boy/girl)" },
  ultimate: { price: 5900, name: "Your Future Baby, Ultimate (photos + video + ages + twin + HD)" },
};

async function toDataUri(f: File): Promise<string> {
  const buf = Buffer.from(await f.arrayBuffer());
  const mime = f.type && f.type.startsWith("image/") ? f.type : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Takes the two parent photos, stores them against a token, and creates a Stripe
// PaymentIntent for the embedded Payment Element. NOTHING is generated here;
// generation is kicked off speculatively at the CVV moment (/api/generate-start)
// and released after payment (/api/generate).
export async function POST(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "stripe not configured (set STRIPE_SECRET_KEY)" }, { status: 500 });

  const form = await req.formData();
  const a = form.get("parentA");
  const b = form.get("parentB");
  if (!(a instanceof File) || !(b instanceof File)) {
    return NextResponse.json({ error: "upload two photos" }, { status: 400 });
  }
  for (const f of [a, b]) {
    if (f.size < 1_000) return NextResponse.json({ error: `that photo didn't upload right (only ${f.size} bytes), try a different one` }, { status: 400 });
    if (f.size > 25_000_000) return NextResponse.json({ error: "photo too large (max 25MB)" }, { status: 400 });
  }

  const tier = String(form.get("tier") || "basic");
  const plan = TIERS[tier] ?? TIERS.basic;
  // The old "+$7 add video" order bump is retired — video is included in every plan.
  const bump = "";
  const price = plan.price;
  const name = plan.name;

  const token = crypto.randomUUID();
  await putParents(token, [await toDataUri(a), await toDataUri(b)], { tier, bump });

  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  // A customer + setup_future_usage saves the card so the post-purchase one-click
  // upsell can charge it again without re-entering details (/api/upsell).
  const customer = await stripe.customers.create({ metadata: { token } });
  const intent = await stripe.paymentIntents.create({
    amount: price,
    currency: "usd",
    description: name,
    customer: customer.id,
    setup_future_usage: "on_session",
    metadata: { token, tier, bump },
    automatic_payment_methods: { enabled: true }, // card + Apple Pay / Google Pay / Link
  });

  await emit("payment_intent_created", { token, meta: { tier, bump, amount: price } });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    token,
    amount: price,
    // real-length pacing for the wait screen (rule #2: no guessed timing)
    waitSeconds: await recordedSeconds(tier, bump),
    tierKey: tierKey(tier, bump),
  });
}
