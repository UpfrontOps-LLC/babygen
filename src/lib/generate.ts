// Shared generation building blocks + helpers to drive the durable GenerateBaby
// Workflow. The orchestration (with per-Replicate-call retryable steps) lives in
// src/workflows/generate-baby.ts; this module holds the pure Replicate calls and
// the request-side helpers the API routes use to start a Workflow and await it.
//
// Owner's hard rules (honored identically by the Workflow):
//   1. REAL Replicate generation runs ONLY when REAL_GEN === "1".
//   2. Otherwise (default) serve cached real outputs AFTER sleeping the EXACT
//      real duration (recordedSeconds) — no fake timing, zero Replicate spend.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEntry } from "@/lib/store";

const IMAGE_MODEL = "google/nano-banana-pro";
const VIDEO_MODEL = "bytedance/seedance-1-lite";

export const CACHE = {
  images: ["/cache/baby1.webp", "/cache/baby2.webp", "/cache/baby3.webp"],
  video: "/cache/giggle.mp4",
  ages: ["/cache/age1.webp", "/cache/age2.webp", "/cache/age3.webp"],
};

export const VARIANTS = [
  "an adorable baby girl about 12 months old, big bright eyes, wispy hair, giggling",
  "an adorable baby boy about 12 months old, chubby cheeks, soft smile",
  "an adorable toddler about 2 years old, playful grin, full head of hair",
];
export const AGE_VARIANTS = [
  "a happy, healthy child about 5 years old",
  "a smiling child about 10 years old",
  "a confident young adult about 18 years old",
];
export const GENDER_PROMPTS = [
  "an adorable baby boy about 12 months old, clearly a boy, bright eyes, soft smile",
  "an adorable baby girl about 12 months old, clearly a girl, bright eyes, wispy hair",
];
export const TWIN_PROMPT =
  "adorable twin babies about 12 months old sitting together, two babies, matching features, giggling";

export type GenResult = { images: string[]; video?: string; ages?: string[]; cached?: boolean };
export type AddonMedia = { video?: string; ages?: string[]; extras?: string[] };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimal shape of a Replicate prediction (the only fields we read). Typed so
// the pipeline compiles under both the Next (lib.dom) and Worker (workers-types,
// where fetch().json() is `unknown`) tsconfigs.
type Prediction = { id: string; status: string; output?: unknown; error?: unknown };
const firstOutput = (p: Prediction): string =>
  (Array.isArray(p.output) ? p.output[0] : p.output) as string;

export function blendPrompt(variant: string) {
  return `A photorealistic professional portrait of ONE ${variant}, facing camera. The face is a natural genetic blend of the two adults in the reference images - mixing their eye shape and color, nose, lips, skin tone and hair. Clean soft light-grey background, gentle lighting, sharp focus, warm happy expression, full color photograph, square 1:1, head and shoulders in frame. No text, no watermark, no extra people.`;
}

// ---- Pure Replicate calls (apiToken passed in; the Workflow reads it off env) ----

export async function generateImage(prompt: string, refs: string[], apiToken: string): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${IMAGE_MODEL}/predictions`, {     
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt, image_input: refs, aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
  });
  let pred = (await res.json()) as Prediction;
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 45) {
    await sleep(2000);
    pred = (await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${apiToken}` } })).json()) as Prediction;
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`image ${pred.status}: ${JSON.stringify(pred.error)}`);
  return firstOutput(pred);
}

export async function generateVideo(image: string, apiToken: string): Promise<string> {
  const res = await fetch(`https://api.replicate.com/v1/models/${VIDEO_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { image, prompt: "The baby smiles warmly and gives a happy giggle, blinks, tiny natural head movement, looking at the camera. Cute and natural.", duration: 5, resolution: "720p", aspect_ratio: "1:1", camera_fixed: true } }),
  });
  let pred = (await res.json()) as Prediction;
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 60) {
    await sleep(2000);
    pred = (await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${apiToken}` } })).json()) as Prediction;
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`video ${pred.status}`);
  return firstOutput(pred);
}

export async function toDataUri(url: string, mime = "image/png"): Promise<string> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ---- Request-side helpers: start a Workflow instance + await its KV results ----

const ADDON_KEY = (token: string) => `${token}:addons`;

async function bindings(env?: CloudflareEnv): Promise<CloudflareEnv> {
  return env ?? (await getCloudflareContext({ async: true })).env;
}

async function ensureInstance(
  wf: CloudflareEnv["GENERATE_BABY"],
  id: string,
  params: Record<string, unknown>
): Promise<{ started: boolean }> {
  // Idempotency: the instance id IS the token (main) / `${token}:addons`. If one
  // already exists this is a no-op. In production Workflows enforce id uniqueness
  // (create() throws `instance.already-exists`); we also pre-check via get() so
  // repeat fires never double-spend. (Miniflare doesn't enforce uniqueness, so
  // local cached dev may re-run harmlessly.)
  try {
    await wf.get(id);
    return { started: false };
  } catch {
    // unknown id -> fall through to create
  }
  try {
    await wf.create({ id, params });
    return { started: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already exists|already-exists|instance\.already/i.test(msg)) return { started: false };
    throw e;
  }
}

// Speculative early-gen + post-payment release both call this. Idempotent: the
// instance id IS the token, so repeat fires never double-spend.
export async function ensureMainInstance(token: string, env?: CloudflareEnv): Promise<{ started: boolean }> {
  const b = await bindings(env);
  return ensureInstance(b.GENERATE_BABY, token, { token, kind: "main" });
}

export async function ensureAddonsInstance(
  token: string,
  addons: string[],
  env?: CloudflareEnv
): Promise<{ started: boolean }> {
  const b = await bindings(env);
  return ensureInstance(b.GENERATE_BABY, ADDON_KEY(token), { token, kind: "addons", addons });
}

// Poll SESSIONS until the Workflow lands the images (or records a terminal
// error). The client connection stays open; Workers has no wall-clock limit
// while connected. On a /success reload this returns instantly from KV.
export async function awaitResult(token: string, env?: CloudflareEnv): Promise<GenResult> {
  const b = await bindings(env);
  const deadline = Date.now() + 295_000;
  for (;;) {
    const e = await getEntry(token, b);
    if (e?.images) return { images: e.images, video: e.video, ages: e.ages, cached: !e.images[0]?.startsWith("data:") };
    if (e?.error) throw new Error(e.error);
    if (Date.now() >= deadline) throw new Error("generation timed out, refresh to retry, you won't be charged again");
    await sleep(800);
  }
}

// The Workflow writes the add-on result here with `done: true` once finished
// (even when real-mode produced nothing, so the poller resolves rather than
// hanging). `error` short-circuits to a fast failure.
type StoredAddons = AddonMedia & { done?: boolean; error?: string };

export async function getAddonMedia(token: string, env?: CloudflareEnv): Promise<StoredAddons | null> {
  const b = await bindings(env);
  return (await b.SESSIONS.get(ADDON_KEY(token), "json")) as StoredAddons | null;
}

export async function setAddonMedia(token: string, media: StoredAddons, env?: CloudflareEnv): Promise<void> {
  const b = await bindings(env);
  await b.SESSIONS.put(ADDON_KEY(token), JSON.stringify(media), { expirationTtl: 86_400 });
}

export async function awaitAddons(token: string, env?: CloudflareEnv): Promise<AddonMedia> {
  const deadline = Date.now() + 295_000;
  for (;;) {
    const m = await getAddonMedia(token, env);
    if (m?.error) throw new Error(m.error);
    if (m?.done) return { video: m.video, ages: m.ages, extras: m.extras };
    if (Date.now() >= deadline) throw new Error("add-on generation timed out, refresh to retry");
    await sleep(800);
  }
}
