"use client";

import { useState } from "react";

export default function Home() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("parentA", a);
      fd.append("parentB", b);
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

      {/* $0 teaser card — builds desire without generating anything */}
      {ready && (
        <div className="mt-8 w-full max-w-md rounded-3xl bg-gradient-to-br from-rose-200 to-pink-300 p-8 flex flex-col items-center text-center shadow-lg">
          <div className="text-6xl blur-sm select-none">👶</div>
          <p className="mt-3 font-bold text-white text-lg drop-shadow">🔒 Your future baby is ready</p>
          <p className="text-white/90 text-sm">3 HD reveals · in ~30 seconds</p>
        </div>
      )}

      {error && <p className="mt-4 text-red-500 text-center max-w-md">{error}</p>}

      <button
        disabled={!ready || busy}
        onClick={checkout}
        className="mt-8 px-8 py-4 rounded-full bg-rose-500 text-white text-lg font-bold shadow-lg disabled:opacity-40 hover:bg-rose-600 transition"
      >
        {busy ? "Taking you to checkout…" : ready ? "Reveal our baby — $17.99 →" : "Upload both parents to start"}
      </button>
      <p className="mt-3 text-xs text-gray-400 text-center max-w-xs">
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
