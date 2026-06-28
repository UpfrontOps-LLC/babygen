import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { putParents } from "@/lib/store";

export const runtime = "nodejs";

const key = process.env.STRIPE_SECRET_KEY;
const PRICE = parseInt(process.env.PRICE_CENTS || "1799", 10);

async function toDataUri(f: File): Promise<string> {
  const buf = Buffer.from(await f.arrayBuffer());
  const mime = f.type && f.type.startsWith("image/") ? f.type : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Takes the two parent photos, stores them against a token, and creates a Stripe
// Checkout session. NOTHING is generated yet — generation happens post-payment.
export async function POST(req: NextRequest) {
  if (!key) {
    return NextResponse.json({ error: "stripe not configured (set STRIPE_SECRET_KEY)" }, { status: 500 });
  }
  const form = await req.formData();
  const a = form.get("parentA");
  const b = form.get("parentB");
  if (!(a instanceof File) || !(b instanceof File)) {
    return NextResponse.json({ error: "upload two photos" }, { status: 400 });
  }
  for (const f of [a, b]) {
    if (f.size < 1_000) return NextResponse.json({ error: `that photo didn't upload right (only ${f.size} bytes) — try a different one` }, { status: 400 });
    if (f.size > 25_000_000) return NextResponse.json({ error: "photo too large (max 25MB)" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  putParents(token, [await toDataUri(a), await toDataUri(b)]);

  const stripe = new Stripe(key);
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: PRICE, product_data: { name: "Your AI Baby — 3 HD reveals" } },
      },
    ],
    success_url: `${base}/success?token=${token}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: base,
    metadata: { token },
  });

  return NextResponse.json({ url: session.url });
}
