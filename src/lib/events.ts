// Event feed for the live monitor (/monitor) and the e2e ordering assertions.
// Was an in-memory ring + SSE subscriber set on the VPS; on stateless Workers
// there are no long-lived subscribers, so we keep a capped recent-events list in
// KV `META` (key `events`) and the monitor polls it.
//
// `emit` is async (a KV write) and should be awaited so the write flushes before
// the Worker response returns — Workers may cancel un-awaited I/O post-response.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AppEvent = {
  ts: number;
  event: string;
  token?: string;
  meta?: Record<string, unknown>;
};

const EVENTS_KEY = "events";
const MAX_BUFFER = 500;

async function bindings(env?: CloudflareEnv): Promise<CloudflareEnv> {
  return env ?? (await getCloudflareContext({ async: true })).env;
}

export async function emit(
  event: string,
  opts: { token?: string; meta?: Record<string, unknown> } = {},
  env?: CloudflareEnv
): Promise<AppEvent> {
  const e: AppEvent = { ts: Date.now(), event, token: opts.token, meta: opts.meta };
  try {
    const b = await bindings(env);
    const buffer = ((await b.META.get(EVENTS_KEY, "json")) as AppEvent[] | null) ?? [];
    buffer.push(e);
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    await b.META.put(EVENTS_KEY, JSON.stringify(buffer));
  } catch (err) {
    // The monitor is non-critical: never let an emit failure break a request.
    console.error("[events] emit failed:", err);
  }
  return e;
}

// Recent events, oldest→newest, for the monitor + e2e ordering checks.
export async function recent(limit = 100, env?: CloudflareEnv): Promise<AppEvent[]> {
  try {
    const b = await bindings(env);
    const buffer = ((await b.META.get(EVENTS_KEY, "json")) as AppEvent[] | null) ?? [];
    return buffer.slice(-limit);
  } catch {
    return [];
  }
}
