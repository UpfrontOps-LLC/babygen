// Session + fulfillment state, backed by Cloudflare KV (was an in-memory
// globalThis Map on the VPS). `SESSIONS` holds the per-token entry; `META` holds
// the webhook event-dedup set. `paid` is the durable, webhook-set source of
// truth that a payment cleared; the /api/generate gate trusts it.
//
// Bindings are resolved via OpenNext's getCloudflareContext() on the request
// path. Code that runs OUTSIDE a request (the GenerateBaby Workflow, where that
// context isn't set up) passes its own `env` as the trailing arg.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Entry = {
  parents: string[];
  images?: string[];
  video?: string;
  ages?: string[];
  createdAt: number;
  paid?: boolean;
  tier?: string;
  bump?: string;
  generating?: boolean;
  error?: string;
};

// 24h: long enough for a reveal + same-day upsell, short enough to honor the
// "photos aren't kept" promise (parents are also cleared explicitly post-gen).
const SESSION_TTL = 86_400;
// Stripe retries deliveries for up to ~3 days; dedupe over that window.
const EVENT_TTL = 259_200;

async function bindings(env?: CloudflareEnv): Promise<CloudflareEnv> {
  return env ?? (await getCloudflareContext({ async: true })).env;
}

async function read(token: string, env?: CloudflareEnv): Promise<Entry | null> {
  const b = await bindings(env);
  return (await b.SESSIONS.get(token, "json")) as Entry | null;
}

async function write(token: string, entry: Entry, env?: CloudflareEnv): Promise<void> {
  const b = await bindings(env);
  await b.SESSIONS.put(token, JSON.stringify(entry), { expirationTtl: SESSION_TTL });
}

export async function putParents(
  token: string,
  parents: string[],
  meta?: { tier?: string; bump?: string },
  env?: CloudflareEnv
): Promise<void> {
  await write(token, { parents, createdAt: Date.now(), tier: meta?.tier, bump: meta?.bump }, env);
}

export async function getEntry(token: string, env?: CloudflareEnv): Promise<Entry | null> {
  return read(token, env);
}

// Mark a token paid from a signature-verified webhook. Source of truth for the
// pay-gate; survives the user closing the tab before generation runs.
export async function markPaid(
  token: string,
  meta?: { tier?: string; bump?: string },
  env?: CloudflareEnv
): Promise<void> {
  const e = (await read(token, env)) ?? { parents: [], createdAt: Date.now() };
  e.paid = true;
  if (meta?.tier) e.tier = meta.tier;
  if (meta?.bump) e.bump = meta.bump;
  await write(token, e, env);
}

export async function isPaid(token: string, env?: CloudflareEnv): Promise<boolean> {
  return (await read(token, env))?.paid === true;
}

// Idempotency guard for webhook delivery: returns true the FIRST time an event
// id is seen, false on every redelivery. Stripe retries, so handlers must dedupe.
export async function claimEvent(id: string, env?: CloudflareEnv): Promise<boolean> {
  const b = await bindings(env);
  const key = `evt:${id}`;
  if (await b.META.get(key)) return false;
  await b.META.put(key, "1", { expirationTtl: EVENT_TTL });
  return true;
}

export async function setImages(token: string, images: string[], env?: CloudflareEnv): Promise<void> {
  const e = await read(token, env);
  if (e) { e.images = images; await write(token, e, env); }
}
export async function setVideo(token: string, video: string, env?: CloudflareEnv): Promise<void> {
  const e = await read(token, env);
  if (e) { e.video = video; await write(token, e, env); }
}
export async function setAges(token: string, ages: string[], env?: CloudflareEnv): Promise<void> {
  const e = await read(token, env);
  if (e) { e.ages = ages; await write(token, e, env); }
}

// Record a terminal generation failure so the request-side poller (awaitResult)
// fails fast instead of waiting out the full deadline.
export async function markError(token: string, message: string, env?: CloudflareEnv): Promise<void> {
  const e = (await read(token, env)) ?? { parents: [], createdAt: Date.now() };
  e.error = message;
  await write(token, e, env);
}

// Delete the source parent (biometric) photos once we're done with them. The
// generated baby images are kept so the reveal survives a refresh. Honors the
// "photos deleted after generation" promise made at upload + in the Privacy Policy.
export async function clearParents(token: string, env?: CloudflareEnv): Promise<void> {
  const e = await read(token, env);
  if (e) { e.parents = []; await write(token, e, env); }
}
