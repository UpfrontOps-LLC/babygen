"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Pure time-fillers while generation runs — they do NOT change the result.
// Framed as guesses so nobody expects the photos to match what they tapped.
const QUESTIONS = [
  { q: "Care to guess… boy or girl?", opts: ["👦 Boy", "👧 Girl"] },
  { q: "Whose nose do you think wins?", opts: ["Mom's", "Dad's"] },
  { q: "Curly or straight hair, you reckon?", opts: ["Curly", "Straight"] },
  { q: "Think they'll have dimples?", opts: ["Yes!", "Nope"] },
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

// --- saving the goods: works for both data: URIs (real gen) and /cache paths ---
async function asBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  return res.blob();
}
function extFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("mp4")) return "mp4";
  return "jpg";
}
async function downloadOne(src: string, filename: string) {
  try {
    const blob = await asBlob(src);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch {
    // mobile fallback: open it so the user can long-press → Save
    window.open(src, "_blank");
  }
}
async function downloadMany(items: { src: string; name: string }[]) {
  for (const it of items) {
    await downloadOne(it.src, it.name);
    await new Promise((r) => setTimeout(r, 350)); // let each save settle on mobile
  }
}
// Native share sheet (Instagram/TikTok/Messages) on mobile. Returns false if unsupported.
async function shareImages(srcs: string[]): Promise<boolean> {
  try {
    const files = await Promise.all(
      srcs.map(async (s, i) => {
        const blob = await asBlob(s);
        return new File([blob], `our-baby-${i + 1}.${extFor(blob)}`, { type: blob.type || "image/jpeg" });
      })
    );
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    if (nav.canShare && nav.canShare({ files }) && nav.share) {
      await nav.share({ files, title: "Our future baby 👶", text: "We made our future baby with See Our Baby 👶✨" });
      return true;
    }
  } catch {
    /* user cancelled or unsupported → caller falls back to download */
  }
  return false;
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
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [upsellErr, setUpsellErr] = useState<string | null>(null);
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

  // One-click upsell: charge the card already on file (no re-entry), then merge
  // the new deliverables straight into the reveal.
  async function buyAddons() {
    const ids = Object.keys(picked).filter((k) => picked[k] && !bought.has(k));
    if (ids.length === 0 || buying) return;
    const token = sp.get("token");
    const paymentIntent = sp.get("payment_intent");
    if (!token || !paymentIntent) { setUpsellErr("We couldn't find your order. Refresh and try again."); return; }
    setBuying(true); setUpsellErr(null);
    track("upsell_buy", { token, meta: { addons: ids } });
    try {
      const r = await fetch("/api/upsell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, payment_intent: paymentIntent, addons: ids }) });
      const d = await r.json();
      if (d.ok) {
        if (d.media?.video) setVideo(d.media.video);
        if (d.media?.ages) setAges(d.media.ages);
        if (d.media?.extras?.length) setExtras((e) => [...e, ...d.media.extras]);
        setBought((b) => new Set([...b, ...d.addons]));
        setPicked({});
        track("upsell_success", { token, meta: { addons: d.addons, amount: d.amount } });
      } else {
        setUpsellErr(d.error || "That didn't go through. Please try again.");
      }
    } catch {
      setUpsellErr("That didn't go through. Please try again.");
    } finally {
      setBuying(false);
    }
  }

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
        <p className="mt-1 text-sm text-gray-500">Yours to keep — save them or share with family 💕</p>

        {/* primary actions: the whole point after paying — get your photos */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <button
            onClick={() => {
              track("download_all");
              const list = [
                ...images.map((s, i) => ({ src: s, name: `our-baby-${i + 1}.png` })),
                ...(ages || []).map((s, i) => ({ src: s, name: `our-baby-age-${i + 1}.png` })),
              ];
              downloadMany(list);
            }}
            className="flex-1 px-6 py-3.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black shadow-lg shadow-rose-500/30 hover:brightness-105 active:scale-95 transition"
          >
            📥 Save all photos
          </button>
          <button
            onClick={async () => {
              track("share_click");
              const ok = await shareImages(images);
              if (!ok) downloadMany(images.map((s, i) => ({ src: s, name: `our-baby-${i + 1}.png` })));
            }}
            className="flex-1 px-6 py-3.5 rounded-full bg-white text-gray-900 font-black shadow-lg ring-1 ring-black/10 hover:bg-gray-50 active:scale-95 transition"
          >
            📲 Share
          </button>
        </div>

        {video && (
          <div className="mt-6 flex flex-col items-center w-full">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={video} autoPlay muted playsInline controls className="w-full max-w-xs sm:max-w-sm rounded-3xl shadow-xl ring-1 ring-black/5" />
            <button onClick={() => { track("download_video"); downloadOne(video, "our-baby-video.mp4"); }} className="mt-3 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold shadow hover:bg-gray-800 active:scale-95 transition">
              📥 Save video
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
          {images.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="your baby" className="rounded-2xl sm:rounded-3xl shadow-lg ring-1 ring-black/5 aspect-square object-cover w-full" />
              <button
                onClick={() => { track("download_one", { meta: { i } }); downloadOne(src, `our-baby-${i + 1}.png`); }}
                aria-label="save this photo"
                className="absolute bottom-1.5 right-1.5 h-9 w-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur text-base shadow-md ring-1 ring-black/10 active:scale-90 transition"
              >
                ⬇️
              </button>
            </div>
          ))}
        </div>

        {ages && ages.length > 0 && (
          <div className="mt-8 w-full">
            <p className="text-center font-bold text-base text-gray-800 mb-3">Through the years ✨</p>
            <div className="grid grid-cols-3 gap-3">
              {ages.map((src, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="your baby older" className="rounded-2xl shadow-md ring-1 ring-black/5 aspect-square object-cover w-full" />
                  <button
                    onClick={() => { track("download_age", { meta: { i } }); downloadOne(src, `our-baby-age-${i + 1}.png`); }}
                    aria-label="save this photo"
                    className="absolute bottom-1.5 right-1.5 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur text-sm shadow-md ring-1 ring-black/10 active:scale-90 transition"
                  >
                    ⬇️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div className="mt-8 w-full">
            <p className="text-center font-bold text-base text-gray-800 mb-3">Your add-ons ✨</p>
            <div className="grid grid-cols-3 gap-3">
              {extras.map((src, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="your baby add-on" className="rounded-2xl shadow-md ring-1 ring-black/5 aspect-square object-cover w-full" />
                  <button
                    onClick={() => { track("download_extra", { meta: { i } }); downloadOne(src, `our-baby-extra-${i + 1}.png`); }}
                    aria-label="save this photo"
                    className="absolute bottom-1.5 right-1.5 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur text-sm shadow-md ring-1 ring-black/10 active:scale-90 transition"
                  >
                    ⬇️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const open = UPSELLS.filter((u) => !bought.has(u.id));
          const selected = open.filter((u) => picked[u.id]);
          const total = selected.reduce((s, u) => s + u.price, 0);
          if (open.length === 0)
            return (
              <div className="mt-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 text-center" data-oto>
                <p className="font-extrabold text-lg text-gray-900">You&apos;ve got it all 🎉</p>
                <p className="mt-1 text-sm text-gray-500">Every add-on is unlocked. Enjoy your little one 💕</p>
              </div>
            );
          return (
            <div className="mt-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5" data-oto>
              <p className="text-center font-extrabold text-lg text-gray-900 mb-1">Make it even better 🍼</p>
              <p className="text-center text-xs text-gray-500 mb-4">One tap, charged to the card you just used.</p>
              <div className="space-y-2.5">
                {bought.size > 0 && UPSELLS.filter((u) => bought.has(u.id)).map((u) => (
                  <div key={u.id} className="w-full flex justify-between items-center rounded-2xl px-4 py-3 border-2 border-green-200 bg-green-50">
                    <span className="text-sm font-semibold text-green-800">✓ {u.label}</span>
                    <span className="text-green-700 font-bold text-sm whitespace-nowrap">Added</span>
                  </div>
                ))}
                {open.map((u) => {
                  const on = !!picked[u.id];
                  return (
                    <button
                      key={u.id}
                      data-oto-id={u.id}
                      disabled={buying}
                      onClick={() => { setPicked((p) => ({ ...p, [u.id]: !p[u.id] })); track("oto_click", { meta: { id: u.id, price: u.price } }); }}
                      className={`w-full flex justify-between items-center rounded-2xl px-4 py-3.5 text-left border-2 transition disabled:opacity-60 ${on ? "bg-rose-50 border-rose-500 shadow-md" : "bg-gray-50 border-transparent hover:border-rose-200 hover:bg-white"}`}
                    >
                      <span className="text-sm font-semibold text-gray-900">{on ? "✓ " : ""}{u.label}</span>
                      <span className="text-rose-600 font-extrabold whitespace-nowrap">+${u.price}</span>
                    </button>
                  );
                })}
              </div>

              {upsellErr && <p className="mt-3 text-center text-sm font-semibold text-red-500">{upsellErr}</p>}

              <button
                data-oto-buy
                onClick={buyAddons}
                disabled={selected.length === 0 || buying}
                className="mt-4 w-full px-6 py-3.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black shadow-lg shadow-rose-500/30 disabled:opacity-40 disabled:shadow-none hover:brightness-105 active:scale-[0.99] transition"
              >
                {buying ? "Adding to your order…" : selected.length === 0 ? "Pick an add-on above" : `Add ${selected.length > 1 ? selected.length + " add-ons" : "this"} for $${total} →`}
              </button>
              {buying && <p className="mt-2 text-center text-xs text-gray-500">Charging your saved card and creating them now…</p>}
              {!buying && <p className="mt-2 text-center text-xs text-gray-400">🔒 No need to re-enter your card</p>}
            </div>
          );
        })()}
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

      {step < QUESTIONS.length && (
        <div className="mt-6 w-full rounded-2xl bg-rose-50 ring-1 ring-rose-100 px-4 py-2.5 text-center">
          <p className="text-xs font-bold text-rose-600">🎲 Just a fun guessing game while you wait</p>
          <p className="text-[11px] text-gray-500 leading-snug">Your answers don&apos;t change your photos. The AI already blended both of you.</p>
        </div>
      )}

      <div className="mt-4 w-full min-h-[120px] flex flex-col items-center justify-center text-center">
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
            <p className="mt-3 text-[11px] text-gray-400">No wrong answers! We&apos;ll show you the real result in a moment 👀</p>
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
