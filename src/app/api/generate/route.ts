import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, setImages } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOKEN = process.env.REPLICATE_API_TOKEN;
const SKEY = process.env.STRIPE_SECRET_KEY;
const MODEL = "google/nano-banana-pro";

const VARIANTS = [
  "an adorable baby girl about 12 months old, big bright eyes, wispy hair, giggling",
  "an adorable baby boy about 12 months old, chubby cheeks, soft smile",
  "an adorable toddler about 2 years old, playful grin, full head of hair",
];

function babyPrompt(variant: string) {
  return `A photorealistic professional studio portrait of ONE ${variant}, facing camera. The child's facial features are a natural genetic blend of the two adults in the reference images - mixing their eye shape and color, nose, lips, skin tone and hair. Clean soft light-grey background, gentle lighting, sharp focus, warm happy expression, full color photograph, square 1:1, head and shoulders in frame. No text, no watermark, no extra people.`;
}

async function generateOne(prompt: string, refs: string[]): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt, image_input: refs, aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
  });
  let pred = await res.json();
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 45) {
    await new Promise((r) => setTimeout(r, 2000));
    const r2 = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await r2.json();
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`generation ${pred.status}: ${JSON.stringify(pred.error)}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

// POST { token, session_id } — verifies payment, THEN generates from the stored parents.
export async function POST(req: NextRequest) {
  if (!TOKEN || !SKEY) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  try {
    const { token, session_id } = await req.json();
    if (!token || !session_id) return NextResponse.json({ error: "missing params" }, { status: 400 });

    // GATE: only generate if this session actually paid for this token.
    const stripe = new Stripe(SKEY);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid" || session.metadata?.token !== token) {
      return NextResponse.json({ error: "payment not verified" }, { status: 402 });
    }

    const entry = getEntry(token);
    if (!entry) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });
    if (entry.images) return NextResponse.json({ images: entry.images }); // idempotent on refresh

    const t0 = Date.now();
    console.error("[generate] PAID START", new Date().toISOString(), token.slice(0, 8));
    const settled = await Promise.allSettled(VARIANTS.map((v) => generateOne(babyPrompt(v), entry.parents)));
    const urls = settled.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value);
    if (urls.length === 0) return NextResponse.json({ error: "generation failed — refresh to retry, you won't be charged again" }, { status: 502 });

    // Download to data URIs so the result survives the ephemeral Replicate URLs.
    const images: string[] = [];
    for (const url of urls) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      images.push(`data:image/png;base64,${buf.toString("base64")}`);
    }
    setImages(token, images);
    console.error(`[generate] DONE ${((Date.now() - t0) / 1000).toFixed(1)}s (${images.length}/${VARIANTS.length})`);
    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 500 });
  }
}
