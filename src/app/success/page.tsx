"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const QUESTIONS = [
  { q: "Boy or girl?", opts: ["👦 Boy", "👧 Girl"] },
  { q: "Whose nose wins?", opts: ["Mom's", "Dad's"] },
  { q: "Curly or straight hair?", opts: ["Curly", "Straight"] },
  { q: "Dimples?", opts: ["Yes!", "Nope"] },
  { q: "Who'll they look more like?", opts: ["Mom", "Dad"] },
];
const FACTS = [
  "👁️ Eye color comes from 16+ genes.",
  "🦴 Babies are born with about 300 bones.",
  "👂 They can already recognize a parent's voice.",
  "🧬 Half from each of you, blending now.",
  "😴 Newborns sleep up to 17 hours a day.",
];
const UPSELLS = [
  { id: "video", label: "🎥 Bring your baby to life (5s video)", price: 7 },
  { id: "ages", label: "📈 See them at 5, 10 & 18", price: 9 },
  { id: "gender", label: "👦👧 Make the boy / girl version", price: 5 },
  { id: "twins", label: "👶👶 Add a twin / sibling", price: 5 },
  { id: "hd", label: "🖼️ HD + printable pack", price: 5 },
];

const PREVIEW_IMAGES = ["/examples/baby1.webp", "/examples/baby2.webp", "/examples/baby3.webp"];
const PREVIEW_VIDEO = "/examples/sample-baby.mp4";

function track(event: string, data: Record<string, unknown> = {}) {
  try {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }) });
  } catch {}
}

function Flow() {
  const sp = useSearchParams();
  const [images, setImages] = useState<string[] | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [ages, setAges] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const started = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (images) track("oto_view");
  }, [images]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (sp.get("preview") === "1") { setImages(PREVIEW_IMAGES); setVideo(PREVIEW_VIDEO); setAges(PREVIEW_IMAGES); return; }
    const token = sp.get("token");
    // Stripe appends payment_intent on wallet redirect; the card path passes it explicitly.
    const paymentIntent = sp.get("payment_intent");
    if (!token || !paymentIntent) { setErr("missing payment info"); return; }
    fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, payment_intent: paymentIntent }) })
      .then((r) => r.json())
      .then((d) => { if (d.images) { setImages(d.images); if (d.video) setVideo(d.video); if (d.ages) setAges(d.ages); } else setErr(d.error || "something went wrong"); })
      .catch(() => setErr("something went wrong"));
  }, [sp]);

  if (err)
    return (
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5 text-center">
        <p className="text-lg font-bold text-gray-900">Hmm, that didn&apos;t work</p>
        <p className="mt-2 text-gray-600">{err}</p>
        <p className="mt-4 text-sm text-gray-500">Refresh to retry, you won&apos;t be charged again.</p>
      </div>
    );

  // ----- reveal -----
  if (images) {
    const guess = answers[0]?.toLowerCase().includes("girl") ? "girl" : answers[0] ? "boy" : null;
    return (
      <div className="w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900">Meet your baby 🎉</h1>
        {guess && <p className="mt-2 text-rose-600 font-semibold">You guessed a {guess}, here&apos;s the truth 👀</p>}

        {video && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={video} autoPlay muted playsInline controls className="mt-6 w-full max-w-xs sm:max-w-sm rounded-3xl shadow-xl ring-1 ring-black/5" />
        )}

        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="your baby" className="rounded-2xl sm:rounded-3xl shadow-lg ring-1 ring-black/5 aspect-square object-cover w-full" />
          ))}
        </div>

        {ages && ages.length > 0 && (
          <div className="mt-8 w-full">
            <p className="text-center font-bold text-base text-gray-800 mb-3">Through the years ✨</p>
            <div className="grid grid-cols-3 gap-3">
              {ages.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="your baby older" className="rounded-2xl shadow-md ring-1 ring-black/5 aspect-square object-cover w-full" />
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5" data-oto>
          <p className="text-center font-extrabold text-lg text-gray-900 mb-1">Make it even better 🍼</p>
          <p className="text-center text-xs text-gray-500 mb-4">More add-ons coming soon.</p>
          <div className="space-y-2.5">
            {UPSELLS.map((u) => {
              const on = !!picked[u.id];
              return (
                <button
                  key={u.id}
                  data-oto-id={u.id}
                  onClick={() => { setPicked((p) => ({ ...p, [u.id]: !p[u.id] })); track("oto_click", { meta: { id: u.id, price: u.price } }); }}
                  className={`w-full flex justify-between items-center rounded-2xl px-4 py-3.5 text-left border-2 transition ${on ? "bg-rose-50 border-rose-500 shadow-md" : "bg-gray-50 border-transparent hover:border-rose-200 hover:bg-white"}`}
                >
                  <span className="text-sm font-semibold text-gray-900">{on ? "✓ " : ""}{u.label}</span>
                  <span className="text-rose-600 font-extrabold whitespace-nowrap">+${u.price}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ----- the wait (post-payment) -----
  // Pace against the REAL per-tier duration passed from checkout (?w=seconds),
  // derived deterministically from Replicate logs — never a guessed number. If
  // early-gen already finished during payment, the reveal fires before this fills.
  const waitSeconds = Number(sp.get("w")) || 100;
  const progress = Math.min(95, Math.round((elapsed / waitSeconds) * 100));
  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl ring-1 ring-black/5 flex flex-col items-center">
      <h1 className="text-2xl font-extrabold text-center text-gray-900">Your baby is on the way 🎉</h1>

      <div className="mt-6 relative flex items-center justify-center h-24 w-24">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 animate-ping opacity-30" />
        <span className="relative flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-4xl shadow-lg">👶</span>
      </div>

      <div className="mt-6 w-full">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-rose-400 to-pink-600 transition-all duration-700 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-gray-800">Painting your baby… {progress}%</p>
        <p className="text-center text-xs text-gray-500">This usually takes a minute or two. Don&apos;t close this page.</p>
      </div>

      <div className="mt-6 w-full min-h-[120px] flex flex-col items-center justify-center text-center">
        {step < QUESTIONS.length ? (
          <>
            <p className="font-bold text-lg text-gray-900">{QUESTIONS[step].q}</p>
            <div className="mt-3 flex gap-3 justify-center flex-wrap">
              {QUESTIONS[step].opts.map((o) => (
                <button key={o} onClick={() => { setAnswers((p) => [...p, o]); setStep((s) => s + 1); }} className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold shadow hover:bg-gray-800 active:scale-95 transition">
                  {o}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-bold text-rose-600 text-lg">Adding the finishing touches ✨</p>
            <p className="mt-3 text-gray-600 text-sm">{FACTS[Math.floor(elapsed / 4) % FACTS.length]}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Success() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-100 via-rose-50 to-white flex flex-col items-center px-4 py-12">
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <Flow />
      </Suspense>
    </main>
  );
}
