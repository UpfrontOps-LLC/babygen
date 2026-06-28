// In-memory event bus + ring buffer for the live monitor (/monitor).
// Every meaningful server/client signal (card_focus, generate_start,
// generate_done, payment_succeeded, reveal, ...) is emitted here so the owner
// can watch the funnel — especially the CVV-focus -> early-gen overlap — in
// real time from a browser tab. Survives module reloads via globalThis.
export type AppEvent = {
  ts: number;
  event: string;
  token?: string;
  meta?: Record<string, unknown>;
};

type Bus = {
  buffer: AppEvent[];
  subscribers: Set<(e: AppEvent) => void>;
};

const g = globalThis as unknown as { __babyBus?: Bus };
const bus: Bus = g.__babyBus ?? (g.__babyBus = { buffer: [], subscribers: new Set() });

const MAX_BUFFER = 500;

export function emit(event: string, opts: { token?: string; meta?: Record<string, unknown> } = {}): AppEvent {
  const e: AppEvent = { ts: Date.now(), event, token: opts.token, meta: opts.meta };
  bus.buffer.push(e);
  if (bus.buffer.length > MAX_BUFFER) bus.buffer.shift();
  for (const fn of bus.subscribers) {
    try { fn(e); } catch { /* a dead subscriber must not break emit */ }
  }
  return e;
}

// Recent events for replay when a monitor tab connects.
export function recent(limit = 100): AppEvent[] {
  return bus.buffer.slice(-limit);
}

export function subscribe(fn: (e: AppEvent) => void): () => void {
  bus.subscribers.add(fn);
  return () => bus.subscribers.delete(fn);
}
