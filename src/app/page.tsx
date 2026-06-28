"use client";

import { useState } from "react";

type Tier = { id: string; price: number; label: string; blurb: string; badge?: string };
const TIERS: Tier[] = [
  { id: "basic", price: 1799, label: "Basic", blurb: "3 HD baby photos" },
  { id: "deluxe", price: 2900, label: "Deluxe", blurb: "3 HD photos + a giggle video 🎥", badge: "Most popular" },
  { id: "ultimate", price: 4900, label: "Ultimate", blurb: "+ ages 5 / 10 / 18 + printable HD" },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export default function Home() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [tier, setTier] = useState<string>("deluxe");
  const [bump, setBump] = useState(false);

  const selected = TIERS.find((t) => t.id === tier) ?? TIERS[1];
  const showBump = tier === "basic"; // Deluxe/Ultimate already include video — don't sell it twice
  const total = selected.price + (showBump && bump ? 700 : 0);

  async function checkout() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("parentA", a);
      fd.append("parentB", b);
      fd.append("tier", tier);
      fd.append("bump", bump ? "1" : "");
      const res = await fetch("/api/checkout", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "checkout unavailable");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setBusy(false);
    }
  }

  const ready = a && b;

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white text-gray-900 flex flex-col items-center px-4 py-10">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center max-w-2xl leading-tight">
        What will <span className="text-rose-500">your baby</span> look like?
      </h1>
      <p className="mt-3 text-lg text-gray-600 text-center max-w-xl">
        Upload a photo of each parent — see your future baby in HD. 👶
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
        <Upload label="Parent 1" file={a} onPick={setA} />
        <Upload label="Parent 2" file={b} onPick={setB} />
      </div>

      {/* good-better-best tier selector (anchored on Deluxe) */}
      {ready && (
        <div className="mt-8 w-full max-w-md grid grid-cols-3 gap-2" role="radiogroup" aria-label="package">
          {TIERS.map((t) => {
            const active = t.id === tier;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={active}
                data-tier={t.id}
                onClick={() => setTier(t.id)}
                className={`relative rounded-2xl border-2 p-3 text-left transition ${active ? "border-rose-500 bg-rose-50 shadow-md" : "border-rose-100 bg-white hover:border-rose-300"}`}
              >
                {t.badge && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {t.badge}
                  </span>
                )}
                <div className="font-bold text-sm">{t.label}</div>
                <div className="text-rose-500 font-extrabold">{fmt(t.price)}</div>
                <div className="text-[11px] text-gray-500 mt-1 leading-tight">{t.blurb}</div>
              </button>
            );
          })}
        </div>
      )}

      {ready && showBump && (
        <label data-bump className="mt-5 flex items-center gap-2 w-full max-w-md text-sm cursor-pointer bg-white border border-rose-200 rounded-xl px-4 py-3 shadow-sm">
          <input type="checkbox" checked={bump} onChange={(e) => setBump(e.target.checked)} aria-label="bump" />
          <span className="flex-1">🎥 Add a giggling <strong>video</strong> of your baby</span>
          <span className="text-rose-500 font-bold">+$7</span>
        </label>
      )}

      {ready && (
        <label className="mt-6 flex items-start gap-2 max-w-md text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" aria-label="consent" />
          <span>
            I have the right to use these photos and consent to AI processing of them. I understand results are{" "}
            <strong>AI-generated for fun — not a real prediction</strong>, and my photos are <strong>not stored</strong> after generation.
          </span>
        </label>
      )}

      {error && <p className="mt-4 text-red-500 text-center max-w-md">{error}</p>}

      <button
        disabled={!ready || !agreed || busy}
        onClick={checkout}
        className="mt-6 px-8 py-4 rounded-full bg-rose-500 text-white text-lg font-bold shadow-lg disabled:opacity-40 hover:bg-rose-600 transition"
      >
        {busy ? "Taking you to checkout…" : !ready ? "Upload both parents to start" : !agreed ? "Tick the box to continue" : `Reveal our baby — ${fmt(total)} →`}
      </button>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 max-w-md text-center">
        <span>🔒 Secure checkout · Stripe</span>
        <span>🗑️ Photos deleted after generation</span>
        <span>⚡ HD results in ~30s</span>
      </div>
      <p className="mt-2 text-xs text-gray-400 text-center max-w-xs">
        AI-generated entertainment, results vary. All sales final.
      </p>
    </main>
  );
}

function Upload({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  return (
    <label className="aspect-square rounded-2xl border-2 border-dashed border-rose-200 bg-white flex items-center justify-center cursor-pointer overflow-hidden hover:border-rose-400 transition">
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={URL.createObjectURL(file)} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className="text-rose-400 text-sm font-medium">+ {label}</span>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}
