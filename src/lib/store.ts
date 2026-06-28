// Holds the uploaded PARENT photos against a token until payment clears, then the
// generated baby images. Nothing is generated until Stripe confirms payment.
// DEV/TEST: in-memory. PROD: swap for KV / D1 / Supabase.
type Entry = { parents: string[]; images?: string[]; createdAt: number };
const g = globalThis as unknown as { __babyStore?: Map<string, Entry> };
const store = g.__babyStore ?? (g.__babyStore = new Map<string, Entry>());

export function putParents(token: string, parents: string[]) {
  store.set(token, { parents, createdAt: Date.now() });
}
export function getEntry(token: string): Entry | null {
  return store.get(token) ?? null;
}
export function setImages(token: string, images: string[]) {
  const e = store.get(token);
  if (e) e.images = images;
}
