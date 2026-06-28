"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const QUESTIONS = [
  { q: "While we paint your baby — boy or girl? 👶", opts: ["👦 Boy", "👧 Girl"] },
  { q: "Whose nose wins? 👃", opts: ["Mom's", "Dad's"] },
  { q: "Hair — curly or straight? 🌀", opts: ["Curly", "Straight"] },
  { q: "Dimples? ✨", opts: ["Yes!", "Nope"] },
  { q: "Who'll they look more like? 👀", opts: ["Mom", "Dad"] },
];
const FACTS = [
  "👁️ Eye color comes from 16+ genes…",
  "🦴 Babies are born with ~300 bones…",
  "👂 They can already know a parent's voice…",
  "🧬 Half from each of you — blending now…",
  "😴 Newborns sleep up to 17 hrs a day…",
];
const UPSELLS = [
  { id: "video", label: "🎥 Bring your baby to life (5s video)", price: 7 },
  { id: "ages", label: "📈 See them at 5, 10 & 18", price: 9 },
  { id: "gender", label: "👦👧 Make the boy / girl version", price: 5 },
  { id: "twins", label: "👶👶 Add a twin / sibling", price: 5 },
  { id: "hd", label: "🖼️ HD + printable pack", price: 5 },
];

function Flow() {
  const sp = useSearchParams();
  const [images, setImages] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = sp.get("token");
    const sessionId = sp.get("session_id");
    if (!token || !sessionId) { setErr("missing payment info"); return; }
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, session_id: sessionId }),
    })
      .then((r) => r.json())
      .then((d) => (d.images ? setImages(d.images) : setErr(d.error || "something went wrong")))
      .catch(() => setErr("something went wrong"));
  }, [sp]);

  if (err)
    return (
      <p className="text-red-500 text-center max-w-sm">
        {err}
        <br />
        <span className="text-gray-500 text-sm">Refresh to retry — you won&apos;t be charged again.</span>
      </p>
    );

  // ----- reveal -----
  if (images) {
    const guess = answers[0]?.toLowerCase().includes("girl") ? "girl" : answers[0] ? "boy" : null;
    return (
      <div className="w-full max-w-2xl flex flex-col items-center">
        {guess && <p className="text-rose-600 mb-3">You guessed a {guess} — here&apos;s the truth 👀</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="your baby" className="rounded-2xl shadow-lg aspect-square object-cover" />
          ))}
        </div>
        <div className="mt-10 w-full max-w-md">
          <p className="text-center font-bold text-lg mb-3">Want more? 🍼</p>
          <div className="space-y-2">
            {UPSELLS.map((u) => (
              <button key={u.id} onClick={() => alert("Add-on checkout wired next")} className="w-full flex justify-between items-center bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition text-left">
                <span className="text-sm font-medium">{u.label}</span>
                <span className="text-rose-500 font-bold">+${u.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----- the wait (post-payment, committed user) -----
  const progress = Math.min(96, Math.round(elapsed / 0.45));
  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <div className="flex items-center gap-3 h-24 text-5xl">
        <span className="animate-pulse">👩</span>
        <span className="animate-bounce">💕</span>
        <span className="animate-pulse">👨</span>
      </div>
      <div className="mt-2 w-full">
        <div className="h-3 bg-rose-100 rounded-full overflow-hidden">
          <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-center text-sm text-gray-500">Painting your baby… {progress}% · {elapsed}s</p>
      </div>
      <div className="mt-6 w-full min-h-[120px] flex flex-col items-center justify-center text-center">
        {step < QUESTIONS.length ? (
          <>
            <p className="font-semibold text-lg">{QUESTIONS[step].q}</p>
            <div className="mt-3 flex gap-3 justify-center flex-wrap">
              {QUESTIONS[step].opts.map((o) => (
                <button key={o} onClick={() => { setAnswers((p) => [...p, o]); setStep((s) => s + 1); }} className="px-6 py-3 rounded-full bg-white shadow font-bold hover:bg-rose-50 transition">
                  {o}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold text-rose-600 text-lg">Adding the finishing touches… ✨</p>
            <p className="mt-3 text-gray-500 text-sm">{FACTS[Math.floor(elapsed / 4) % FACTS.length]}</p>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400">Hang tight — your baby is being created. Don&apos;t close this page!</p>
    </div>
  );
}

export default function Success() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6">Your baby is on the way 🎉</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Flow />
      </Suspense>
    </main>
  );
}
