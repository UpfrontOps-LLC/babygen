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
// Composed against the real pipeline in api/generate (3 images in PARALLEL via
// Promise.allSettled -> the slowest of 3 governs, so we use p90 for the image
// stage wall time; video runs SEQUENTIALLY after images; 3 age images run in
// PARALLEL after the video on Ultimate).
import { readFileSync } from "fs";
import { join } from "path";

export const SEED = {
  image: 28.2, // single nano-banana-pro median predict_time (s)
  imageWall: 62.1, // wall time for the 3-parallel image stage (p90 of the 3)
  video: 39.2, // single seedance-1-lite median predict_time (s)
};

const TIMING_PATH = join(process.cwd(), ".data", "gen-timing.json");

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
// run (recorded to .data/gen-timing.json as { [tierKey]: seconds }); else fall
// back to the deterministic SEED composition. Either way: no guessing.
export function recordedSeconds(tier: string, bump = ""): number {
  const key = tierKey(tier, bump);
  try {
    const data = JSON.parse(readFileSync(TIMING_PATH, "utf8")) as Record<string, number>;
    if (typeof data[key] === "number" && data[key] > 0) return data[key];
  } catch {
    // no recorded run yet -> seed composition
  }
  return tierWallSeconds(tier, bump);
}

// A stable key per distinct deliverable shape (basic / basic+bump / deluxe / ultimate).
export function tierKey(tier: string, bump = ""): string {
  if (wantsAges(tier)) return "ultimate";
  if (wantsVideo(tier, bump)) return tier === "deluxe" ? "deluxe" : "basic+bump";
  return "basic";
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
