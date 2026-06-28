// Holds the uploaded PARENT photos against a token until payment clears, then the
// generated baby images. Nothing is generated until Stripe confirms payment.
// DEV/TEST: in-memory. PROD (Cloudflare): swap for KV — see DEPLOY_STRIPE.md.
// `paid` is the durable, webhook-set source of truth that a payment cleared;
// the /api/generate gate trusts it (falling back to a live session lookup).
type Entry = { parents: string[]; images?: string[]; createdAt: number; paid?: boolean; tier?: string; bump?: string };
const g = globalThis as unknown as { __babyStore?: Map<string, Entry>; __babyEvents?: Set<string> };
const store = g.__babyStore ?? (g.__babyStore = new Map<string, Entry>());
// Stripe event IDs we've already fulfilled — makes webhook delivery idempotent.
const seen = g.__babyEvents ?? (g.__babyEvents = new Set<string>());

export function putParents(token: string, parents: string[]) {
  store.set(token, { parents, createdAt: Date.now() });
}
export function getEntry(token: string): Entry | null {
  return store.get(token) ?? null;
}

// Mark a token paid from a signature-verified webhook. Source of truth for the
// pay-gate; survives the user closing the tab before generation runs.
export function markPaid(token: string, meta?: { tier?: string; bump?: string }) {
  const e = store.get(token);
  if (e) { e.paid = true; if (meta?.tier) e.tier = meta.tier; if (meta?.bump) e.bump = meta.bump; }
  else store.set(token, { parents: [], createdAt: Date.now(), paid: true, tier: meta?.tier, bump: meta?.bump });
}
export function isPaid(token: string): boolean {
  return store.get(token)?.paid === true;
}

// Idempotency guard for webhook delivery: returns true the FIRST time an event
// id is seen, false on every redelivery. Stripe retries, so handlers must dedupe.
export function claimEvent(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}
export function setImages(token: string, images: string[]) {
  const e = store.get(token);
  if (e) e.images = images;
}
// Delete the source parent (biometric) photos once we're done with them. The
// generated baby images are kept so the reveal survives a refresh. Honors the
// "photos deleted after generation" promise made at upload + in the Privacy Policy.
export function clearParents(token: string) {
  const e = store.get(token);
  if (e) e.parents = [];
}
