// Single source of truth for "how long does a tier's generation take."
//
// RULE (owner): test/cached mode must wait the EXACT real generation time,
// pulled deterministically from real Replicate logs — never a guessed number.
//
// SEED values are real measured medians/p90 of Replicate `metrics.predict_time`
// for SUCCEEDED predictions (failed/insufficient-credit runs log 0.0s and are
// excluded), pulled from GET /v1/predictions on 2026-06-28:
//   google/nano-banana-pro (image): median 28.2s, p90 62.1s (n=91)
//   bytedance/seedance-1-lite (video): median 39.2s (n=4)
// Composed against the real pipeline: 3 images in PARALLEL -> slowest governs
// (p90 for the image stage wall time); video runs SEQUENTIALLY after images; 3
// age images run in PARALLEL after the video on Ultimate.
//
// The single owner-authorized real run records its literal wall-clock into KV
// `META` (key `gen-timing`), replacing the old .data/gen-timing.json file.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const SEED = {
  image: 28.2, // single nano-banana-pro median predict_time (s)
  imageWall: 62.1, // wall time for the 3-parallel image stage (p90 of the 3)
  video: 39.2, // single seedance-1-lite median predict_time (s)
};

const TIMING_KEY = "gen-timing";

async function bindings(env?: CloudflareEnv): Promise<CloudflareEnv> {
  return env ?? (await getCloudflareContext({ async: true })).env;
}

export function wantsVideo(tier: string, bump: string): boolean {
  return tier === "deluxe" || tier === "ultimate" || bump === "1";
}
export function wantsAges(tier: string): boolean {
  return tier === "ultimate";
}

// Deterministic composition from the SEED medians + the real pipeline shape.
export function tierWallSeconds(tier: string, bump = ""): number {
  let s = SEED.imageWall; // 3 baby photos (every tier), parallel
  if (wantsVideo(tier, bump)) s += SEED.video; // giggle video, sequential
  if (wantsAges(tier)) s += SEED.imageWall; // 3 age photos, parallel
  return Math.round(s * 10) / 10;
}

// Prefer a literally-measured wall-clock from the single owner-authorized real
// run (recorded to KV META `gen-timing` as { [tierKey]: seconds }); else fall
// back to the deterministic SEED composition. Either way: no guessing.
export async function recordedSeconds(tier: string, bump = "", env?: CloudflareEnv): Promise<number> {
  const key = tierKey(tier, bump);
  try {
    const b = await bindings(env);
    const data = ((await b.META.get(TIMING_KEY, "json")) as Record<string, number> | null) ?? {};
    if (typeof data[key] === "number" && data[key] > 0) return data[key];
  } catch {
    // no recorded run yet / binding unavailable -> seed composition
  }
  return tierWallSeconds(tier, bump);
}

// A stable key per distinct deliverable shape (basic / basic+bump / deluxe / ultimate).
export function tierKey(tier: string, bump = ""): string {
  if (wantsAges(tier)) return "ultimate";
  if (wantsVideo(tier, bump)) return tier === "deluxe" ? "deluxe" : "basic+bump";
  return "basic";
}

// Record the literally-measured wall-clock of the single real run so future
// cached waits use real numbers (rule #2). Merges into KV META `gen-timing`.
export async function recordTiming(key: string, seconds: number, env?: CloudflareEnv): Promise<void> {
  try {
    const b = await bindings(env);
    const data = ((await b.META.get(TIMING_KEY, "json")) as Record<string, number> | null) ?? {};
    data[key] = Math.round(seconds * 10) / 10;
    await b.META.put(TIMING_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[gen-timing] recordTiming failed:", e);
  }
}

// Real-length wait for a post-purchase add-on bundle, same deterministic seeds.
export function addonWaitSeconds(addons: string[]): number {
  let s = 0;
  if (addons.includes("video")) s += SEED.video; // 1 seedance video
  if (addons.includes("ages")) s += SEED.imageWall; // 3 parallel images
  if (addons.includes("gender")) s += SEED.imageWall; // boy + girl images
  if (addons.includes("twins")) s += SEED.image; // 1 image
  if (addons.includes("hd")) s += SEED.imageWall; // re-render at 2K
  return Math.round(s * 10) / 10;
}
