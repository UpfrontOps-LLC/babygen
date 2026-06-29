"use client";

import { useEffect, useRef, useState } from "react";

type AppEvent = { ts: number; event: string; token?: string; meta?: Record<string, unknown> };

// Color per event so the funnel reads at a glance. The CVV->early-gen overlap
// (card_focus -> generate_start) is what the owner is watching for.
const COLOR: Record<string, string> = {
  card_focus: "#f59e0b", // CVV moment — amber, the trigger
  generate_start: "#22d3ee", // early-gen kicked off — cyan
  generate_done: "#34d399", // media ready — green
  generate_error: "#f87171",
  payment_intent_created: "#a78bfa",
  payment_succeeded: "#34d399",
  reveal: "#f472b6",
};

function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export default function Monitor() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // No long-lived sockets on Workers — poll the KV-backed snapshot every ~2s.
  // The snapshot is the full recent buffer, so we replace rather than append.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/events", { cache: "no-store" });
        const { events: snap } = (await r.json()) as { events: AppEvent[] };
        if (alive) { setEvents(snap.slice(-500)); setConnected(true); }
      } catch {
        if (alive) setConnected(false);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <main style={{ background: "#0a0a0f", color: "#e5e7eb", minHeight: "100vh", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🍼 babygen live monitor</h1>
        <span style={{ fontSize: 12, color: connected ? "#34d399" : "#f87171" }}>● {connected ? "live" : "reconnecting…"}</span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{events.length} events</span>
        <button onClick={() => setEvents([])} style={{ marginLeft: "auto", fontSize: 12, background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>clear</button>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0 }}>
        Watching the funnel in real time. The key beat:{" "}
        <span style={{ color: COLOR.card_focus }}>card_focus</span> (you tap CVV) →{" "}
        <span style={{ color: COLOR.generate_start }}>generate_start</span> (we begin early) →{" "}
        <span style={{ color: COLOR.generate_done }}>generate_done</span> — all before{" "}
        <span style={{ color: COLOR.payment_succeeded }}>payment_succeeded</span>.
      </p>
      <div style={{ borderTop: "1px solid #1f2937", paddingTop: 8 }}>
        {events.length === 0 && <p style={{ color: "#4b5563", fontSize: 13 }}>Waiting for events… run the funnel in another tab.</p>}
        {events.map((e, i) => {
          const c = COLOR[e.event] || "#9ca3af";
          return (
            <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: "22px", borderLeft: `3px solid ${c}`, paddingLeft: 10, marginBottom: 2 }}>
              <span style={{ color: "#6b7280", minWidth: 110 }}>{fmt(e.ts)}</span>
              <span style={{ color: c, fontWeight: 700, minWidth: 180 }}>{e.event}</span>
              <span style={{ color: "#6b7280", minWidth: 80 }}>{e.token ? e.token.slice(0, 8) : ""}</span>
              <span style={{ color: "#9ca3af" }}>{e.meta ? JSON.stringify(e.meta) : ""}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </main>
  );
}
