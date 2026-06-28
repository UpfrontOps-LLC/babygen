"use client";

import { useEffect, useState } from "react";
import PayForm, { type PaymentSession } from "./components/PayForm";

type Tier = { id: string; price: number; label: string; features: string[]; badge?: string };
const TIERS: Tier[] = [
  { id: "basic", price: 1799, label: "Basic", features: ["3 HD baby photos"] },
  { id: "deluxe", price: 2900, label: "Deluxe", features: ["3 HD photos", "🎥 Giggle video"], badge: "Most popular" },
  { id: "ultimate", price: 4900, label: "Ultimate", features: ["3 HD photos", "🎥 Video", "📈 Ages 5/10/18", "🖼️ Printable HD"] },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

const HEADLINES: Record<string, string> = {
  A: "What will your baby look like?",
  B: "See your future baby.",
};

const FAQ = [
  { q: "Is this really my baby?", a: "It's an AI's playful blend of both your faces, just for fun, not a real prediction." },
  { q: "Do you keep my photos?", a: "No. Your uploads are deleted right after your images are made." },
  { q: "How long does it take?", a: "Usually a minute or two. You watch it come together, then your baby is revealed." },
  { q: "What do I get?", a: "3 HD baby photos. Deluxe adds a giggle video, Ultimate adds ages 5/10/18 + a printable pack." },
];

function track(event: string, data: Record<string, unknown> = {}) {
  try {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }) });
  } catch {}
}

// Compress a photo in the browser BEFORE upload (7MB -> ~150KB) so checkout is instant.
async function shrinkImage(file: File, max = 1280, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
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
  const [faq, setFaq] = useState<number | null>(null);
  const [pay, setPay] = useState<PaymentSession | null>(null);

  useEffect(() => {
    let v = document.cookie.match(/bg_ab=([AB])/)?.[1];
    if (!v) { v = Math.random() < 0.5 ? "A" : "B"; document.cookie = `bg_ab=${v};path=/;max-age=2592000`; }
    setVariant(v);
    track("view", { variant: v });
  }, []);

  const selected = TIERS.find((t) => t.id === tier) ?? TIERS[1];
  const showBump = tier === "basic";
  const total = selected.price + (showBump && bump ? 700 : 0);

  async function checkout() {
    if (!a || !b) return;
    setBusy(true); setError(null);
    track("checkout_click", { variant, tier, meta: { bump: showBump && bump } });
    try {
      const fd = new FormData();
      fd.append("parentA", a); fd.append("parentB", b);
      fd.append("tier", tier); fd.append("bump", showBump && bump ? "1" : "");
      const res = await fetch("/api/payment-intent", { method: "POST", body: fd });
      const data = await res.json();
      if (data.clientSecret) {
        // Embed the payment form right here — no redirect. Generation begins the
        // moment they focus CVV (or tap a wallet), overlapping the wait.
        setPay({ clientSecret: data.clientSecret, token: data.token, amount: data.amount, waitSeconds: data.waitSeconds });
        setBusy(false);
        setTimeout(() => document.getElementById("pay")?.scrollIntoView({ behavior: "smooth" }), 50);
        return;
      }
      throw new Error(data.error || "checkout");
    } catch {
      setError("Checkout is temporarily unavailable. Please try again in a moment.");
      setBusy(false);
    }
  }

  const ready = a && b;
  const scrollToUpload = () => document.getElementById("make")?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-200 via-rose-100 to-amber-50 text-gray-900 overflow-x-hidden">
      <header className="flex items-center justify-center py-4">
        <span className="text-base font-extrabold tracking-tight">👶 See Our Baby</span>
      </header>

      {/* HERO */}
      <section className="flex flex-col items-center px-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 ring-1 ring-rose-200 px-3 py-1 text-xs font-bold text-rose-600 shadow-sm">
          🔥 The AI baby trend, for real couples
        </span>
        <h1 data-variant={variant} className="mt-4 text-[2.6rem] leading-[1.02] sm:text-7xl font-black tracking-tight max-w-3xl" style={{ textWrap: "balance" }}>
          {HEADLINES[variant]}{" "}
          <span className="bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">👶</span>
        </h1>
        <p className="mt-4 text-lg sm:text-2xl text-gray-700 font-medium max-w-xl" style={{ textWrap: "balance" }}>
          Drop in a photo of each parent. Meet your future baby in HD, plus a giggle video.
        </p>

        {/* the magic: 2 photos -> baby */}
        <div className="mt-7 flex items-center justify-center gap-2 sm:gap-3">
          {/* eslint-disable @next/next/no-img-element */}
          <img src="/people/person02.webp" alt="parent" className="h-20 w-20 sm:h-28 sm:w-28 rounded-2xl object-cover shadow-lg ring-2 ring-white -rotate-6" />
          <span className="text-2xl sm:text-3xl font-black text-rose-400">+</span>
          <img src="/people/person01.webp" alt="parent" className="h-20 w-20 sm:h-28 sm:w-28 rounded-2xl object-cover shadow-lg ring-2 ring-white rotate-6" />
          <span className="text-2xl sm:text-3xl font-black text-rose-400">=</span>
          <img src="/examples/baby1.webp" alt="AI baby result" className="h-24 w-24 sm:h-32 sm:w-32 rounded-2xl object-cover shadow-xl ring-4 ring-rose-400" />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <p className="mt-2 text-xs text-gray-500">Example result, just for fun</p>

        <button onClick={scrollToUpload} className="mt-7 px-8 py-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-lg font-black shadow-xl shadow-rose-500/30 hover:brightness-105 active:scale-95 transition">
          Make our baby 👶 →
        </button>
        <p className="mt-3 text-xs text-gray-500">🔒 Private · 🗑️ Photos deleted after · ⚡ Ready in a minute or two</p>
      </section>

      {/* PROOF GALLERY */}
      <section className="mt-12 px-4">
        <p className="text-center text-sm font-bold text-gray-700 mb-3">More AI babies people made ✨</p>
        <div data-examples className="mx-auto grid grid-cols-3 gap-2.5 max-w-md">
          {[1, 2, 3].map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`/examples/baby${i}.webp`} alt="example AI baby" width={512} height={512} loading="eager" decoding="async" className="rounded-2xl aspect-square object-cover shadow-md ring-1 ring-black/5" />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">Real example results</p>
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-12 px-4">
        <div className="mx-auto grid grid-cols-3 gap-3 max-w-md text-center">
          {[
            { i: "📸", t: "Upload 2 photos", s: "One of each parent" },
            { i: "✨", t: "AI blends you", s: "Eyes, nose, smile" },
            { i: "👶", t: "Meet your baby", s: "HD + video" },
          ].map((s) => (
            <div key={s.t} className="rounded-3xl bg-white/80 ring-1 ring-black/5 p-3 shadow-sm">
              <div className="text-3xl">{s.i}</div>
              <div className="mt-1 text-[13px] font-black leading-tight">{s.t}</div>
              <div className="text-[11px] text-gray-500 leading-tight">{s.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MAKE (the action) */}
      <section id="make" className="mt-12 px-4 flex flex-col items-center">
        <h2 className="text-2xl sm:text-3xl font-black text-center">Make your baby 👇</h2>
        <p className="text-sm text-gray-600 mb-4 mt-1">Add a clear, front-facing photo of each parent.</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <Upload label="Parent 1" file={a} onPick={setA} />
          <Upload label="Parent 2" file={b} onPick={setB} />
        </div>

        {ready && (
          <div className="mt-7 w-full max-w-md grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="package">
            {TIERS.map((t) => {
              const active = t.id === tier;
              return (
                <button key={t.id} role="radio" aria-checked={active} data-tier={t.id}
                  onClick={() => { if (t.id !== tier) { setTier(t.id); track("tier_select", { variant, tier: t.id, meta: { from: tier } }); } }}
                  className={`relative rounded-3xl border-2 p-3 pt-4 text-left transition ${active ? "border-rose-500 bg-white shadow-xl scale-[1.03]" : "border-transparent bg-white/70 hover:bg-white shadow-sm"}`}>
                  {t.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow">{t.badge}</span>
                  )}
                  <div className="font-black text-sm">{t.label}</div>
                  <div className="text-rose-600 font-black text-lg leading-none mt-0.5">{fmt(t.price)}</div>
                  <ul className="mt-2 space-y-1">
                    {t.features.map((f) => (<li key={f} className="text-[11px] text-gray-600 leading-tight flex gap-1"><span className="text-rose-400">✓</span>{f}</li>))}
                  </ul>
                </button>
              );
            })}
          </div>
        )}

        {ready && showBump && (
          <label data-bump className="mt-4 flex items-center gap-2 w-full max-w-md text-sm cursor-pointer bg-white border-2 border-rose-200 rounded-2xl px-4 py-3 shadow-sm">
            <input type="checkbox" checked={bump} onChange={(e) => { setBump(e.target.checked); track("bump_toggle", { variant, tier, meta: { on: e.target.checked } }); }} aria-label="bump" />
            <span className="flex-1">🎥 Add a giggling <strong>video</strong> of your baby</span>
            <span className="text-rose-600 font-black">+$7</span>
          </label>
        )}

        {ready && (
          <label className="mt-5 flex items-start gap-2 max-w-md text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" aria-label="consent" />
            <span>I have the right to use these photos and consent to AI processing. Results are <strong>AI-generated for fun, not a real prediction</strong>, and my photos are <strong>not stored</strong> after generation.</span>
          </label>
        )}

        {error && <p className="mt-4 text-red-500 text-center max-w-md text-sm font-semibold">{error}</p>}

        {pay ? (
          <div id="pay" className="mt-6 w-full max-w-md flex flex-col items-center rounded-3xl bg-white/90 ring-1 ring-black/5 p-5 shadow-xl">
            <p className="mb-3 text-center text-sm font-bold text-gray-800">Almost there — pay to reveal your baby 👶</p>
            <PayForm session={pay} />
          </div>
        ) : (
          <>
            <button disabled={!ready || !agreed || busy} onClick={checkout}
              className="mt-6 w-full max-w-md px-8 py-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-lg font-black shadow-xl shadow-rose-500/30 disabled:opacity-40 disabled:shadow-none hover:brightness-105 active:scale-[0.99] transition">
              {busy ? "Setting up secure checkout…" : !ready ? "Upload both parents to start" : !agreed ? "Tick the box to continue" : `Reveal our baby for ${fmt(total)} →`}
            </button>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600 max-w-md text-center font-medium">
              <span>🔒 Secure checkout · Stripe</span>
              <span>🗑️ Photos deleted after generation</span>
            </div>
          </>
        )}
      </section>

      {/* FAQ */}
      <section className="mt-14 px-4">
        <h2 className="text-center text-2xl font-black mb-4">Good to know</h2>
        <div className="mx-auto max-w-md space-y-2">
          {FAQ.map((f, i) => (
            <button key={f.q} onClick={() => setFaq(faq === i ? null : i)} className="w-full text-left rounded-2xl bg-white/80 ring-1 ring-black/5 px-4 py-3 shadow-sm">
              <div className="flex justify-between items-center font-bold text-sm"><span>{f.q}</span><span className="text-rose-400">{faq === i ? "−" : "+"}</span></div>
              {faq === i && <p className="mt-2 text-sm text-gray-600">{f.a}</p>}
            </button>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF placeholder — real reactions go here once provided; never faked */}

      <p className="mt-12 px-4 pb-16 text-center text-xs text-gray-400 max-w-xs mx-auto">
        For entertainment, results vary. All sales final.
      </p>
    </main>
  );
}

function Upload({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  return (
    <label className="group aspect-square rounded-3xl border-[3px] border-dashed border-rose-300 bg-white/80 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-rose-500 hover:bg-white transition shadow-sm">
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={URL.createObjectURL(file)} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <span className="text-4xl group-hover:scale-110 transition">📷</span>
          <span className="mt-1 text-rose-500 text-sm font-black">+ {label}</span>
        </>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) shrinkImage(f).then(onPick); }} />
    </label>
  );
}
