// Durable generation pipeline. Replaces the VPS "fire-and-forget background
// promise" model: a Workflow instance survives the customer dropping the tab, so
// a paid generation always completes and a /success reload picks it up from KV.
//
// Idempotency: the instance id is the token (main) or `${token}:addons` (upsell),
// so repeated /api/generate-start + /api/generate fires never double-spend.
//
// Owner's hard rules, honored identically here:
//   - REAL Replicate runs ONLY when env.REAL_GEN === "1".
//   - Otherwise sleep the EXACT recorded duration, then serve cached outputs.
//
// NOTE: a Workflow runs OUTSIDE OpenNext's request context, so getCloudflareContext()
// is unavailable — every KV/config access goes through `this.env`, passed down.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { getEntry, setImages, setVideo, setAges, clearParents, markError } from "@/lib/store";
import { emit } from "@/lib/events";
import {
  recordedSeconds,
  recordTiming,
  wantsVideo,
  wantsAges,
  tierKey,
  addonWaitSeconds,
} from "@/lib/gen-timing";
import {
  CACHE,
  VARIANTS,
  AGE_VARIANTS,
  GENDER_PROMPTS,
  TWIN_PROMPT,
  blendPrompt,
  generateImage,
  generateVideo,
  toDataUri,
  setAddonMedia,
} from "@/lib/generate";

export type GenerateBabyParams = {
  token: string;
  kind: "main" | "addons";
  addons?: string[];
};

const STEP_RETRY = { retries: { limit: 2, delay: 5000 }, timeout: "5 minutes" } as const;

const isFulfilled = (r: PromiseSettledResult<string>): r is PromiseFulfilledResult<string> =>
  r.status === "fulfilled";

export class GenerateBaby extends WorkflowEntrypoint<CloudflareEnv, GenerateBabyParams> {
  async run(event: WorkflowEvent<GenerateBabyParams>, step: WorkflowStep): Promise<void> {
    if (event.payload.kind === "addons") {
      await this.runAddons(event.payload, step);
      return;
    }
    await this.runMain(event.payload, step);
  }

  private async runMain(params: GenerateBabyParams, step: WorkflowStep): Promise<void> {
    const env = this.env;
    const { token } = params;
    const real = env.REAL_GEN === "1";
    const apiToken = env.REPLICATE_API_TOKEN || "";

    const entry = await getEntry(token, env);
    if (!entry) {
      await markError(token, "session expired", env);
      throw new Error("session expired");
    }
    const tier = entry.tier || "basic";
    const bump = entry.bump || "";
    const wantsV = wantsVideo(tier, bump);
    const wantsA = wantsAges(tier);

    await emit("generate_start", { token, meta: { tier, bump, real } }, env);

    // ---- CACHED GATE (default): real-length wait, zero Replicate spend ----
    if (!real) {
      const secs = await recordedSeconds(tier, bump, env);
      await step.sleep("cached-wait", Math.round(secs * 1000));
      await setImages(token, CACHE.images, env);
      if (wantsV) await setVideo(token, CACHE.video, env);
      if (wantsA) await setAges(token, CACHE.ages, env);
      await clearParents(token, env);
      await emit("generate_done", { token, meta: { tier, cached: true, secs } }, env);
      return;
    }

    // ---- REAL GATE (REAL_GEN=1, owner-authorized). Each call its own step. ----
    const t0 = await step.do("t0", async () => Date.now());
    const refs = entry.parents;

    const settled = await Promise.allSettled(
      VARIANTS.map((v, i) =>
        step.do(`image-${i}`, STEP_RETRY, async () => toDataUri(await generateImage(blendPrompt(v), refs, apiToken)))
      )
    );
    const images = settled.filter(isFulfilled).map((r) => r.value);
    if (images.length === 0) {
      await markError(token, "generation failed, refresh to retry, you won't be charged again", env);
      throw new Error("all image generations failed");
    }
    await setImages(token, images, env);

    if (wantsV) {
      try {
        const video = await step.do("video", STEP_RETRY, () => generateVideo(images[0], apiToken));
        await setVideo(token, video, env);
      } catch (e) {
        console.error("[workflow] video failed:", e);
      }
    }

    if (wantsA) {
      const s2 = await Promise.allSettled(
        AGE_VARIANTS.map((v, i) =>
          step.do(`age-${i}`, STEP_RETRY, async () => toDataUri(await generateImage(blendPrompt(v), refs, apiToken)))
        )
      );
      const ages = s2.filter(isFulfilled).map((r) => r.value);
      if (ages.length) await setAges(token, ages, env);
    }

    await clearParents(token, env);
    const secs = +((Date.now() - t0) / 1000).toFixed(1);
    await recordTiming(tierKey(tier, bump), secs, env); // future cached waits use this real number
    await emit("generate_done", { token, meta: { tier, real: true, secs } }, env);
  }

  private async runAddons(params: GenerateBabyParams, step: WorkflowStep): Promise<void> {
    const env = this.env;
    const { token, addons = [] } = params;
    const real = env.REAL_GEN === "1";
    const apiToken = env.REPLICATE_API_TOKEN || "";

    await emit("upsell_generate_start", { token, meta: { addons, real } }, env);
    const out: { video?: string; ages?: string[]; extras?: string[] } = {};

    // ---- CACHED GATE: real add-on-length wait, then cached outputs ----
    if (!real) {
      await step.sleep("addon-wait", Math.round(addonWaitSeconds(addons) * 1000));
      if (addons.includes("video")) { out.video = CACHE.video; await setVideo(token, CACHE.video, env); }
      if (addons.includes("ages")) { out.ages = CACHE.ages; await setAges(token, CACHE.ages, env); }
      const extras: string[] = [];
      if (addons.includes("gender")) extras.push(CACHE.images[0], CACHE.images[1]);
      if (addons.includes("twins")) extras.push(CACHE.images[2]);
      if (addons.includes("hd")) extras.push(...CACHE.images);
      if (extras.length) out.extras = extras;
      await setAddonMedia(token, { ...out, done: true }, env);
      await emit("upsell_generate_done", { token, meta: { addons, cached: true } }, env);
      return;
    }

    // ---- REAL GATE: best-effort (parents are deleted post-main-gen) ----
    const entry = await getEntry(token, env);
    const parents = entry?.parents ?? [];
    const haveParents = parents.length > 0;

    if (addons.includes("video") && entry?.images?.[0]) {
      try {
        out.video = await step.do("addon-video", STEP_RETRY, () => generateVideo(entry.images![0], apiToken));
        await setVideo(token, out.video, env);
      } catch (e) {
        console.error("[workflow] addon video failed:", e);
      }
    }

    if (haveParents) {
      const extras: string[] = [];
      if (addons.includes("ages")) {
        const r = await Promise.allSettled(
          AGE_VARIANTS.map((v, i) =>
            step.do(`addon-age-${i}`, STEP_RETRY, async () => toDataUri(await generateImage(blendPrompt(v), parents, apiToken)))
          )
        );
        const au = r.filter(isFulfilled).map((x) => x.value);
        if (au.length) { out.ages = au; await setAges(token, au, env); }
      }
      if (addons.includes("gender")) {
        const r = await Promise.allSettled(
          GENDER_PROMPTS.map((v, i) =>
            step.do(`addon-gender-${i}`, STEP_RETRY, async () => toDataUri(await generateImage(blendPrompt(v), parents, apiToken)))
          )
        );
        for (const x of r) if (x.status === "fulfilled") extras.push(x.value);
      }
      if (addons.includes("twins")) {
        try {
          extras.push(await step.do("addon-twins", STEP_RETRY, async () => toDataUri(await generateImage(blendPrompt(TWIN_PROMPT), parents, apiToken))));
        } catch (e) {
          console.error("[workflow] addon twins failed:", e);
        }
      }
      if (extras.length) out.extras = extras;
    } else if (addons.some((a) => ["ages", "gender", "twins", "hd"].includes(a))) {
      console.error("[workflow] image add-ons need parent photos (deleted post-gen) — skipped in real mode");
    }

    await setAddonMedia(token, { ...out, done: true }, env);
    await emit("upsell_generate_done", { token, meta: { addons, real: true } }, env);
  }
}
