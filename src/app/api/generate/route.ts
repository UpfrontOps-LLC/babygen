import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntry, setImages, setVideo, setAges, clearParents, isPaid } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

const TOKEN = process.env.REPLICATE_API_TOKEN;
const SKEY = process.env.STRIPE_SECRET_KEY;
const IMAGE_MODEL = "google/nano-banana-pro";
const VIDEO_MODEL = "bytedance/seedance-1-lite";

const VARIANTS = [
  "an adorable baby girl about 12 months old, big bright eyes, wispy hair, giggling",
  "an adorable baby boy about 12 months old, chubby cheeks, soft smile",
  "an adorable toddler about 2 years old, playful grin, full head of hair",
];
const AGE_VARIANTS = [
  "a happy, healthy child about 5 years old",
  "a smiling child about 10 years old",
  "a confident young adult about 18 years old",
];

function blendPrompt(variant: string) {
  return `A photorealistic professional portrait of ONE ${variant}, facing camera. The face is a natural genetic blend of the two adults in the reference images - mixing their eye shape and color, nose, lips, skin tone and hair. Clean soft light-grey background, gentle lighting, sharp focus, warm happy expression, full color photograph, square 1:1, head and shoulders in frame. No text, no watermark, no extra people.`;
}

async function generateImage(prompt: string, refs: string[]): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${IMAGE_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt, image_input: refs, aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
  });
  let pred = await res.json();
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 45) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`image ${pred.status}: ${JSON.stringify(pred.error)}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

// Deluxe/Ultimate/bump deliverable: a 5s giggle video from the first baby image.
async function generateVideo(image: string): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${VIDEO_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { image, prompt: "The baby smiles warmly and gives a happy giggle, blinks, tiny natural head movement, looking at the camera. Cute and natural.", duration: 5, resolution: "720p", aspect_ratio: "1:1", camera_fixed: true } }),
  });
  let pred = await res.json();
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 60) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`video ${pred.status}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

async function toDataUri(url: string, mime = "image/png"): Promise<string> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const fulfilled = (r: PromiseSettledResult<string>): r is PromiseFulfilledResult<string> => r.status === "fulfilled";

// POST { token, session_id } — verifies payment, THEN generates the tier's deliverables.
export async function POST(req: NextRequest) {
  if (!TOKEN || !SKEY) return NextResponse.json({ error: "server not configured" }, { status: 500 });
  try {
    const { token, session_id } = await req.json();
    if (!token || !session_id) return NextResponse.json({ error: "missing params" }, { status: 400 });

    // GATE: only generate if payment cleared. Prefer the durable webhook flag;
    // else a live session lookup (which also gives us the tier metadata).
    let meta: Stripe.Metadata | null = null;
    if (!isPaid(token)) {
      const stripe = new Stripe(SKEY);
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid" || session.metadata?.token !== token) {
        return NextResponse.json({ error: "payment not verified" }, { status: 402 });
      }
      meta = session.metadata;
    }

    const entry = getEntry(token);
    if (!entry) return NextResponse.json({ error: "session expired, contact support" }, { status: 404 });
    if (entry.images) return NextResponse.json({ images: entry.images, video: entry.video, ages: entry.ages }); // idempotent

    const tier = entry.tier || meta?.tier || "basic";
    const bump = entry.bump || meta?.bump || "";
    const wantsVideo = tier === "deluxe" || tier === "ultimate" || bump === "1";
    const wantsAges = tier === "ultimate";

    const t0 = Date.now();
    console.error("[generate] PAID START", new Date().toISOString(), token.slice(0, 8), `tier=${tier} bump=${bump}`);

    // 1) The 3 baby photos (every tier).
    const settled = await Promise.allSettled(VARIANTS.map((v) => generateImage(blendPrompt(v), entry.parents)));
    const urls = settled.filter(fulfilled).map((r) => r.value);
    if (urls.length === 0) return NextResponse.json({ error: "generation failed, refresh to retry, you won't be charged again" }, { status: 502 });
    const images: string[] = [];
    for (const url of urls) images.push(await toDataUri(url));
    setImages(token, images);

    // 2) Giggle video (Deluxe/Ultimate/bump). 3) Age progression (Ultimate).
    // Add-ons are best-effort: a failure here never blocks the core photos.
    let video: string | undefined;
    if (wantsVideo) {
      try { video = await generateVideo(images[0]); setVideo(token, video); } catch (e) { console.error("[generate] video failed:", e); }
    }
    let ages: string[] | undefined;
    if (wantsAges) {
      try {
        const s2 = await Promise.allSettled(AGE_VARIANTS.map((v) => generateImage(blendPrompt(v), entry.parents)));
        const au = s2.filter(fulfilled).map((r) => r.value);
        if (au.length) { ages = []; for (const u of au) ages.push(await toDataUri(u)); setAges(token, ages); }
      } catch (e) { console.error("[generate] ages failed:", e); }
    }

    clearParents(token); // delete the source parent photos; keeps the deletion promise
    console.error(`[generate] DONE ${((Date.now() - t0) / 1000).toFixed(1)}s img=${images.length} video=${!!video} ages=${ages?.length || 0}`);
    return NextResponse.json({ images, video, ages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown error" }, { status: 500 });
  }
}
