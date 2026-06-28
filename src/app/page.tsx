"use client";

import { useEffect, useState } from "react";

type Tier = { id: string; price: number; label: string; features: string[]; badge?: string };
const TIERS: Tier[] = [
  { id: "basic", price: 1799, label: "Basic", features: ["3 HD baby photos", "Delivered in ~30s"] },
  { id: "deluxe", price: 2900, label: "Deluxe", features: ["3 HD baby photos", "🎥 Giggle video", "Delivered in ~30s"], badge: "Most popular" },
  { id: "ultimate", price: 4900, label: "Ultimate", features: ["3 HD baby photos", "🎥 Giggle video", "📈 Ages 5 / 10 / 18", "🖼️ Printable HD pack"] },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

const HEADLINES: Record<string, string> = {
  A: "What will your baby look like?",
  B: "See your future baby in seconds.",
};

function track(event: string, data: Record<string, unknown> = {}) {
  try {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }) });
  } catch {}
}

// Compress a photo in the browser BEFORE upload. A 7MB phone photo becomes
// ~150KB, so checkout uploads instantly instead of hanging on the raw file.
async function shrinkImage(file: File, max = 1280, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
if (typeof window !== "undefined") {
  (window as unknown as { __shrinkImage?: typeof shrinkImage }).__shrinkImage = shrinkImage;
}

export default function Home() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [tier, setTier] = useState<string>("deluxe");
  const [bump, setBump] = useState(false);
  const [variant, setVariant] = useState("A");

  useEffect(() => {
    let v = document.cookie.match(/bg_ab=([AB])/)?.[1];
    if (!v) {
      v = Math.random() < 0.5 ? "A" : "B";
      document.cookie = `bg_ab=${v};path=/;max-age=2592000`;
    }
    setVariant(v);
    track("view", { variant: v });
  }, []);

  const selected = TIERS.find((t) => t.id === tier) ?? TIERS[1];
  const showBump = tier === "basic";
  const total = selected.price + (showBump && bump ? 700 : 0);

  async function checkout() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    track("checkout_click", { variant, tier, meta: { bump: showBump && bump } });
    try {
      const fd = new FormData();
      fd.append("parentA", a);
      fd.append("parentB", b);
      fd.append("tier", tier);
      fd.append("bump", bump ? "1" : "");
      const res = await fetch("/api/checkout", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error("checkout");
    } catch {
      setError("Checkout is temporarily unavailable. Please try again in a moment.");
      setBusy(false);
    }
  }

  const ready = a && b;

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-100 via-rose-50 to-white text-gray-900">
      {/* brand bar */}
      <header className="flex items-center justify-center py-4">
        <span className="text-base font-extrabold tracking-tight">👶 See Our Baby</span>
      </header>

      <div className="flex flex-col items-center px-4 pb-16">
        {/* hero */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 ring-1 ring-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm">
          ✨ Two photos. One AI baby. ~30 seconds.
        </span>
        <h1 data-variant={variant} className="mt-4 text-[2.1rem] sm:text-6xl font-extrabold text-center max-w-2xl leading-[1.05] tracking-tight" style={{ textWrap: "balance" }}>
          {HEADLINES[variant]}
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-600 text-center max-w-xl" style={{ textWrap: "balance" }}>
          Upload a photo of each parent and meet your future baby in HD.
        </p>

        {/* proof gallery */}
        <div className="mt-7 w-full max-w-md">
          <div data-examples className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3].map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={`/examples/baby${i}.webp`} alt="example AI baby" width={512} height={512} loading="eager" decoding="async" className="rounded-2xl aspect-square object-cover shadow-md ring-1 ring-black/5" />
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">Real example results</p>
        </div>

        {/* how it works */}
        <div className="mt-9 grid grid-cols-3 gap-3 w-full max-w-md text-center">
          {[
            { i: "📸", t: "Upload 2 photos", s: "One of each parent" },
            { i: "✨", t: "AI blends you", s: "Eyes, nose, smile" },
            { i: "👶", t: "Meet your baby", s: "HD in ~30s" },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3">
              <div className="text-2xl">{s.i}</div>
              <div className="mt-1 text-[13px] font-bold leading-tight">{s.t}</div>
              <div className="text-[11px] text-gray-500 leading-tight">{s.s}</div>
            </div>
          ))}
        </div>

        {/* upload — the action */}
        <div className="mt-9 w-full max-w-md">
          <p className="text-center text-sm font-bold text-gray-700 mb-3">Start here, add both parents 👇</p>
          <div className="grid grid-cols-2 gap-4">
            <Upload label="Parent 1" file={a} onPick={setA} />
            <Upload label="Parent 2" file={b} onPick={setB} />
          </div>
        </div>

        {/* tiers */}
        {ready && (
          <div className="mt-8 w-full max-w-md grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="package">
            {TIERS.map((t) => {
              const active = t.id === tier;
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={active}
                  data-tier={t.id}
                  onClick={() => { if (t.id !== tier) { setTier(t.id); track("tier_select", { variant, tier: t.id, meta: { from: tier } }); } }}
                  className={`relative rounded-3xl border-2 p-3 pt-4 text-left transition ${active ? "border-rose-500 bg-white shadow-lg scale-[1.02]" : "border-transparent bg-white/70 hover:bg-white shadow-sm"}`}
                >
                  {t.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow">
                      {t.badge}
                    </span>
                  )}
                  <div className="font-extrabold text-sm">{t.label}</div>
                  <div className="text-rose-600 font-extrabold text-lg leading-none mt-0.5">{fmt(t.price)}</div>
                  <ul className="mt-2 space-y-1">
                    {t.features.map((f) => (
                      <li key={f} className="text-[11px] text-gray-600 leading-tight flex gap-1"><span className="text-rose-400">✓</span>{f}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        )}

        {ready && showBump && (
          <label data-bump className="mt-4 flex items-center gap-2 w-full max-w-md text-sm cursor-pointer bg-white border border-rose-200 rounded-2xl px-4 py-3 shadow-sm">
            <input type="checkbox" checked={bump} onChange={(e) => { setBump(e.target.checked); track("bump_toggle", { variant, tier, meta: { on: e.target.checked } }); }} aria-label="bump" />
            <span className="flex-1">🎥 Add a giggling <strong>video</strong> of your baby</span>
            <span className="text-rose-600 font-bold">+$7</span>
          </label>
        )}

        {ready && (
          <label className="mt-5 flex items-start gap-2 max-w-md text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" aria-label="consent" />
            <span>
              I have the right to use these photos and consent to AI processing of them. I understand results are{" "}
              <strong>AI-generated for fun, not a real prediction</strong>, and my photos are <strong>not stored</strong> after generation.
            </span>
          </label>
        )}

        {error && <p className="mt-4 text-red-500 text-center max-w-md text-sm">{error}</p>}

        <button
          disabled={!ready || !agreed || busy}
          onClick={checkout}
          className="mt-6 w-full max-w-md px-8 py-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-lg font-extrabold shadow-xl shadow-rose-500/25 disabled:opacity-40 disabled:shadow-none hover:brightness-105 active:scale-[0.99] transition"
        >
          {busy ? "Taking you to checkout…" : !ready ? "Upload both parents to start" : !agreed ? "Tick the box to continue" : `Reveal our baby for ${fmt(total)} →`}
        </button>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 max-w-md text-center">
          <span>🔒 Secure checkout · Stripe</span>
          <span>🗑️ Photos deleted after generation</span>
          <span>⚡ HD results in ~30s</span>
        </div>
        <p className="mt-2 text-xs text-gray-400 text-center max-w-xs">
          For entertainment, results vary. All sales final.
        </p>
      </div>
    </main>
  );
}

function Upload({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  return (
    <label className="group aspect-square rounded-3xl border-2 border-dashed border-rose-300 bg-white/80 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-rose-500 hover:bg-white transition shadow-sm">
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={URL.createObjectURL(file)} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <span className="text-3xl group-hover:scale-110 transition">📷</span>
          <span className="mt-1 text-rose-500 text-sm font-bold">+ {label}</span>
        </>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) shrinkImage(f).then(onPick); }} />
    </label>
  );
}
