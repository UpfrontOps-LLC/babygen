// Shared generation pipeline, used by BOTH the speculative early-gen
// (/api/generate-start, fired at the CVV moment) and the post-payment release
// (/api/generate). Two gates, both honoring the owner's hard rules:
//
//   1. REAL Replicate generation runs ONLY when REAL_GEN === "1" — the explicit
//      owner go-signal, set for a single deliberate run. Never automatic.
//   2. Otherwise (default everywhere) we serve cached real outputs but AFTER
//      sleeping the EXACT real duration (recordedSeconds) so the felt wait — and
//      thus the CVV->early-gen overlap — is identical to production. No fake timing.
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getEntry, setImages, setVideo, setAges, clearParents, claimGenerate } from "@/lib/store";
import { emit } from "@/lib/events";
import { recordedSeconds, wantsVideo, wantsAges, tierKey, addonWaitSeconds } from "@/lib/gen-timing";

const TOKEN = process.env.REPLICATE_API_TOKEN;
const REAL_GEN = process.env.REAL_GEN === "1";
const IMAGE_MODEL = "google/nano-banana-pro";
const VIDEO_MODEL = "bytedance/seedance-1-lite";

const CACHE = {
  images: ["/cache/baby1.webp", "/cache/baby2.webp", "/cache/baby3.webp"],
  video: "/cache/giggle.mp4",
  ages: ["/cache/age1.webp", "/cache/age2.webp", "/cache/age3.webp"],
};

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

export type GenResult = { images: string[]; video?: string; ages?: string[]; cached?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    await sleep(2000);
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`image ${pred.status}: ${JSON.stringify(pred.error)}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

async function generateVideo(image: string): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${VIDEO_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { image, prompt: "The baby smiles warmly and gives a happy giggle, blinks, tiny natural head movement, looking at the camera. Cute and natural.", duration: 5, resolution: "720p", aspect_ratio: "1:1", camera_fixed: true } }),
  });
  let pred = await res.json();
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 60) {
    await sleep(2000);
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

// Record the literally-measured wall-clock of the single real run so future
// cached waits use real numbers (rule #2). Merges into .data/gen-timing.json.
function recordTiming(key: string, seconds: number) {
  try {
    const dir = join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "gen-timing.json");
    let data: Record<string, number> = {};
    try { data = JSON.parse(readFileSync(path, "utf8")); } catch {}
    data[key] = Math.round(seconds * 10) / 10;
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[generate] recordTiming failed:", e);
  }
}

// The actual pipeline. Assumes the caller already holds the generation claim.
async function runPipeline(token: string): Promise<GenResult> {
  const entry = getEntry(token);
  if (!entry) throw new Error("session expired");
  const tier = entry.tier || "basic";
  const bump = entry.bump || "";
  const wantsV = wantsVideo(tier, bump);
  const wantsA = wantsAges(tier);

  emit("generate_start", { token, meta: { tier, bump, real: REAL_GEN } });
  const t0 = Date.now();

  // ---- CACHED GATE (default): real-length wait, zero Replicate spend ----
  if (!REAL_GEN) {
    const waitMs = recordedSeconds(tier, bump) * 1000;
    await sleep(waitMs);
    const images = CACHE.images;
    const video = wantsV ? CACHE.video : undefined;
    const ages = wantsA ? CACHE.ages : undefined;
    setImages(token, images);
    if (video) setVideo(token, video);
    if (ages) setAges(token, ages);
    clearParents(token);
    emit("generate_done", { token, meta: { tier, cached: true, secs: +((Date.now() - t0) / 1000).toFixed(1) } });
    return { images, video, ages, cached: true };
  }

  // ---- REAL GATE (REAL_GEN=1, owner-authorized single run) ----
  console.error("[generate] REAL START", new Date().toISOString(), token.slice(0, 8), `tier=${tier} bump=${bump}`);
  const settled = await Promise.allSettled(VARIANTS.map((v) => generateImage(blendPrompt(v), entry.parents)));
  const urls = settled.filter(fulfilled).map((r) => r.value);
  if (urls.length === 0) throw new Error("generation failed, refresh to retry, you won't be charged again");
  const images: string[] = [];
  for (const url of urls) images.push(await toDataUri(url));
  setImages(token, images);

  let video: string | undefined;
  if (wantsV) {
    try { video = await generateVideo(images[0]); setVideo(token, video); } catch (e) { console.error("[generate] video failed:", e); }
  }
  let ages: string[] | undefined;
  if (wantsA) {
    try {
      const s2 = await Promise.allSettled(AGE_VARIANTS.map((v) => generateImage(blendPrompt(v), entry.parents)));
      const au = s2.filter(fulfilled).map((r) => r.value);
      if (au.length) { ages = []; for (const u of au) ages.push(await toDataUri(u)); setAges(token, ages); }
    } catch (e) { console.error("[generate] ages failed:", e); }
  }

  clearParents(token);
  const secs = +((Date.now() - t0) / 1000).toFixed(1);
  recordTiming(tierKey(tier, bump), secs); // future cached waits use this real number
  console.error(`[generate] DONE ${secs}s img=${images.length} video=${!!video} ages=${ages?.length || 0}`);
  emit("generate_done", { token, meta: { tier, real: true, secs } });
  return { images, video, ages };
}

const AGE_PROMPTS = AGE_VARIANTS;
const GENDER_PROMPTS = [
  "an adorable baby boy about 12 months old, clearly a boy, bright eyes, soft smile",
  "an adorable baby girl about 12 months old, clearly a girl, bright eyes, wispy hair",
];
const TWIN_PROMPT = "adorable twin babies about 12 months old sitting together, two babies, matching features, giggling";

export type AddonMedia = { video?: string; ages?: string[]; extras?: string[] };

// Post-purchase add-ons (/api/upsell). Cached gate (default) waits the real
// add-on duration then serves cached outputs — zero Replicate spend, honest UX.
// Real gate (REAL_GEN=1) is best-effort: the source parent photos are deleted
// right after the first generation (privacy promise), so image-based add-ons
// can only run if parents are still present; video derives from the kept baby image.
export async function generateAddons(token: string, addons: string[]): Promise<AddonMedia> {
  const entry = getEntry(token);
  if (!entry) throw new Error("session expired");
  emit("upsell_generate_start", { token, meta: { addons, real: REAL_GEN } });
  const t0 = Date.now();
  const out: AddonMedia = {};

  if (!REAL_GEN) {
    await sleep(addonWaitSeconds(addons) * 1000);
    if (addons.includes("video")) { out.video = CACHE.video; setVideo(token, out.video); }
    if (addons.includes("ages")) { out.ages = CACHE.ages; setAges(token, out.ages); }
    const extras: string[] = [];
    if (addons.includes("gender")) extras.push(CACHE.images[0], CACHE.images[1]);
    if (addons.includes("twins")) extras.push(CACHE.images[2]);
    if (addons.includes("hd")) extras.push(...CACHE.images);
    if (extras.length) out.extras = extras;
    emit("upsell_generate_done", { token, meta: { addons, cached: true, secs: +((Date.now() - t0) / 1000).toFixed(1) } });
    return out;
  }

  // REAL gate (owner-authorized). Best-effort given privacy deletion of parents.
  const parents = entry.parents;
  const haveParents = parents && parents.length > 0;
  if (addons.includes("video") && entry.images?.[0]) {
    try { out.video = await generateVideo(entry.images[0]); setVideo(token, out.video); } catch (e) { console.error("[upsell] video failed:", e); }
  }
  if (haveParents) {
    const extras: string[] = [];
    if (addons.includes("ages")) {
      const s = await Promise.allSettled(AGE_PROMPTS.map((v) => generateImage(blendPrompt(v), parents)));
      const au = s.filter(fulfilled).map((r) => r.value); if (au.length) { out.ages = []; for (const u of au) out.ages.push(await toDataUri(u)); setAges(token, out.ages); }
    }
    if (addons.includes("gender")) {
      const s = await Promise.allSettled(GENDER_PROMPTS.map((v) => generateImage(blendPrompt(v), parents)));
      for (const r of s) if (r.status === "fulfilled") extras.push(await toDataUri(r.value));
    }
    if (addons.includes("twins")) {
      try { extras.push(await toDataUri(await generateImage(blendPrompt(TWIN_PROMPT), parents))); } catch (e) { console.error("[upsell] twins failed:", e); }
    }
    if (extras.length) out.extras = extras;
  } else if (addons.some((a) => ["ages", "gender", "twins", "hd"].includes(a))) {
    console.error("[upsell] image add-ons need parent photos, which were deleted post-generation — skipped in real mode");
  }
  emit("upsell_generate_done", { token, meta: { addons, real: true, secs: +((Date.now() - t0) / 1000).toFixed(1) } });
  return out;
}

// Speculative early-gen: fired at the CVV moment. Claims the token then runs the
// pipeline in the BACKGROUND so the route responds instantly and the overlap
// clock starts now. Idempotent — repeat fires are no-ops.
export function kickOffGenerate(token: string): { started: boolean } {
  if (!claimGenerate(token)) return { started: false };
  runPipeline(token).catch((e) => {
    emit("generate_error", { token, meta: { error: e instanceof Error ? e.message : String(e) } });
    console.error("[generate] kickOff pipeline failed:", e);
  });
  return { started: true };
}

// Post-payment release: return media if early-gen already finished; otherwise
// start it (if not already running) and wait for it. Guarantees the customer
// gets their baby whether or not the early-gen overlap fired.
export async function releaseGenerate(token: string): Promise<GenResult> {
  const existing = getEntry(token);
  if (existing?.images) return { images: existing.images, video: existing.video, ages: existing.ages };

  // start it if nobody has (claim succeeds), then await this run directly
  if (claimGenerate(token)) {
    return runPipeline(token);
  }

  // someone else (early-gen) is mid-flight — wait for images to land
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await sleep(500);
    const e = getEntry(token);
    if (e?.images) return { images: e.images, video: e.video, ages: e.ages };
  }
  throw new Error("generation timed out, refresh to retry, you won't be charged again");
}
