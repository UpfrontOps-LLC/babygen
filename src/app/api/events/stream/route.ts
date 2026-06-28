import { recent, subscribe, type AppEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events feed for the live monitor (/monitor). Replays the recent
// buffer on connect, then streams every new event as it's emitted. A heartbeat
// comment keeps the connection alive through proxies (Cloudflare tunnel).
export async function GET() {
  const encoder = new TextEncoder();
  let unsub = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: AppEvent) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch {}
      };
      // replay recent history so a freshly-opened tab has context
      for (const e of recent(100)) send(e);
      controller.enqueue(encoder.encode(`: connected\n\n`));
      unsub = subscribe(send);
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch {}
      }, 15000);
    },
    cancel() {
      unsub();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
