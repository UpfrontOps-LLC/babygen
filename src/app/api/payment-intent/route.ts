import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { putParents } from "@/lib/store";
import { emit } from "@/lib/events";
import { recordedSeconds, tierKey } from "@/lib/gen-timing";

export const runtime = "nodejs";

const key = process.env.STRIPE_SECRET_KEY;
// Prices match the desktop design ($19 / $29 / $39) with server-authoritative
// add-ons for twins (+$5) and age-progression (+$9). The amount is computed here,
// never trusted from the client.
const TIERS: Record<string, { price: number; name: string }> = {
  basic: { price: 1900, name: "Your AI Baby, Basic (3 HD photos)" },
  deluxe: { price: 2900, name: "Your AI Baby, Deluxe (3 HD photos + music video)" },
  ultimate: { price: 3900, name: "Your AI Baby, Ultimate (photos + ages 5/10/18 + HD)" },
};
const TWINS_CENTS = 500;
const GROW_CENTS = 900;

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
  const twins = form.get("twins") === "1";
  const grow = form.get("grow") === "1";
  const addVideo = tier === "basic" && form.get("bump") === "1"; // legacy order bump on Basic
  const bump = addVideo ? "1" : "";
  const price = plan.price + (addVideo ? 700 : 0) + (twins ? TWINS_CENTS : 0) + (grow ? GROW_CENTS : 0);
  const extras = [addVideo && "giggle video", twins && "twins", grow && "ages 5/10/18"].filter(Boolean).join(", ");
  const name = extras ? `${plan.name} + ${extras}` : plan.name;

  const gender = String(form.get("gender") || "surprise");
  // Deliverable intent — what the funnel actually sold, so the workflow honors
  // à-la-carte add-ons (grow → ages) rather than tier-only defaults.
  const wantVideo = tier !== "basic" || addVideo;
  const wantAges = grow || tier === "ultimate";
  const token = crypto.randomUUID();
  await putParents(token, [await toDataUri(a), await toDataUri(b)], { tier, bump, wantVideo, wantAges, twins, gender });

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
    metadata: { token, tier, bump, twins: twins ? "1" : "", grow: grow ? "1" : "", gender },
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
