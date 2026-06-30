"use client";

/**
 * See Our Baby — Desktop funnel.
 *
 * A faithful React port of the claude.ai/design prototype
 * "See Our Baby · Desktop prototype" (templates/sob-desktop/SobDesktop.dc.html).
 * Same 8-screen state machine — landing → upload → configure → review → checkout
 * → wait (+ guess game) → reveal → upsell — adapted for ≥1024px. Visual styles
 * live in ./sob-desktop.css (scoped under `.sob`). The wait→reveal is a simulated
 * preview exactly as in the design prototype.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import CheckoutForm, { type PaymentSession } from "./components/CheckoutForm";
import "./sob-desktop.css";

const MOM = "/samples/adults/adult01.webp";
const DAD = "/samples/adults/adult02.webp";
const BABY = (n: number) => `/samples/babies/baby${String(n).padStart(2, "0")}.webp`;

const TIER_PRICES: Record<string, number> = { basic: 19, deluxe: 29, ultimate: 39 };

type Q = { text: string; answer: "true" | "false"; a: { e: string; t: string }; b: { e: string; t: string } };
const TF = { a: { e: "✅", t: "True" }, b: { e: "❌", t: "False" } } as const;
const QUESTIONS: Q[] = [
  { text: "Newborns have around 270 bones · more than the 206 in adult bodies.", answer: "true", ...TF },
  { text: "Babies are born with fully formed kneecaps.", answer: "false", ...TF },
  { text: "Newborns cry without tears for the first few weeks.", answer: "true", ...TF },
  { text: "A baby's heart beats faster than an adult's.", answer: "true", ...TF },
  { text: "All babies are born with blue eyes.", answer: "false", ...TF },
  { text: "A newborn's stomach is about the size of a cherry.", answer: "true", ...TF },
  { text: "Babies can taste flavors from their mother's diet while in the womb.", answer: "true", ...TF },
  { text: "Newborns can see in full color right from birth.", answer: "false", ...TF },
  { text: "Babies typically double their birth weight by 5 months old.", answer: "true", ...TF },
  { text: "Newborns recognize their mother's voice at birth.", answer: "true", ...TF },
  { text: "Babies sleep about 22 hours a day during their first month.", answer: "false", ...TF },
  { text: "A baby is born with about 10,000 taste buds · double an adult's.", answer: "true", ...TF },
  { text: "Babies don't develop kneecaps until they're 3 to 5 years old.", answer: "true", ...TF },
  { text: "A newborn can swim like a fish · they're instinctive swimmers.", answer: "false", ...TF },
  { text: "Babies hiccup in the womb starting around 9 weeks.", answer: "true", ...TF },
  { text: "Newborns don't sweat at all for their first month.", answer: "true", ...TF },
  { text: "Babies dream for the first time around 6 months of age.", answer: "false", ...TF },
  { text: "Newborns prefer looking at faces over patterns.", answer: "true", ...TF },
  { text: "A baby's brain is half the size of an adult brain at birth.", answer: "false", ...TF },
  { text: "Babies have soft spots (fontanelles) for around 18-24 months.", answer: "true", ...TF },
  { text: "Smiling starts at 3 months · not before.", answer: "false", ...TF },
  { text: "Baby teeth begin forming before birth, while still in the womb.", answer: "true", ...TF },
  { text: "Newborns can recognize their own name by 1 month.", answer: "false", ...TF },
  { text: "A newborn breathes about twice as fast as an adult.", answer: "true", ...TF },
];
const TOTAL_QUESTIONS = QUESTIONS.length;

const FACTS = [
  "Babies have ~300 bones, adults have 206.",
  "Half your baby's DNA is yours, half is your partner's.",
  "Newborns sleep about 17 hours a day.",
  "It takes 16+ genes to decide your baby's eye color.",
  "A baby recognizes a parent's voice from inside the womb.",
];

function track(event: string, data: Record<string, unknown> = {}) {
  try {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }) });
  } catch {}
}

type Step = "landing" | "upload" | "configure" | "review" | "checkout" | "wait" | "reveal" | "upsell";
type AddOns = { video: boolean; ages: boolean; other: boolean; twin: boolean; hd: boolean };
const ADDON_PRICES: Record<keyof AddOns, number> = { video: 7, ages: 9, other: 5, twin: 5, hd: 5 };

const ArrowRight = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const Squiggle = ({ children }: { children: React.ReactNode }) => (
  <span style={{ position: "relative", display: "inline-block" }}>{children}<span className="squiggle" /></span>
);
// Make a non-button element (option card / chip / tier) operable by keyboard:
// focusable + Enter/Space activate it, like a real button. Without this the
// whole configure/review/upsell selection is mouse-only.
function clickable(fn: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); fn(); }
    },
  };
}
const upper: CSSProperties = { fontWeight: 700, fontSize: 13, marginBottom: 10, color: "rgba(0,0,0,0.7)", textTransform: "uppercase", letterSpacing: "0.04em" };
const sublabel: CSSProperties = { fontWeight: 700, fontSize: 11, color: "rgba(0,0,0,0.55)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" };

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [p1, setP1] = useState<string | null>(null);
  const [p2, setP2] = useState<string | null>(null);
  const [gender, setGender] = useState("surprise");
  const [stage, setStage] = useState("baby");
  const [twins, setTwins] = useState(false);
  const [tier, setTier] = useState("deluxe");
  const [photoStyle, setPhotoStyle] = useState("surprise");
  const [videoVibe, setVideoVibe] = useState("surprise");
  const [videoScene, setVideoScene] = useState("surprise");
  const [videoOutfit, setVideoOutfit] = useState("surprise");
  const [videoMusic, setVideoMusic] = useState("surprise");
  const [waitProgress, setWaitProgress] = useState(0);
  const [waitQuestion, setWaitQuestion] = useState(0);
  const [guessAnswers, setGuessAnswers] = useState<string[]>([]);
  const [waitPhase, setWaitPhase] = useState<"game" | "finishing">("game");
  const [factIndex, setFactIndex] = useState(0);
  const [addOns, setAddOns] = useState<AddOns>({ video: false, ages: false, other: false, twin: false, hd: false });
  const [toast, setToast] = useState("");
  const [payMethod, setPayMethod] = useState<"apple" | "google" | "card">("card");
  const [pay, setPay] = useState<PaymentSession | null>(null);
  const [payError, setPayError] = useState("");
  const [creatingPI, setCreatingPI] = useState(false);

  const waitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const factTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    track("view", { surface: "desktop" });
    const ua = navigator.userAgent;
    const isChrome = /Chrome|CriOS|Edg/.test(ua);
    const isApplePlatform = /Mac|iPhone|iPad/.test(ua);
    if (isApplePlatform && !isChrome) setPayMethod("apple");
    else if (isChrome) setPayMethod("google");
    else setPayMethod("card");
  }, []);

  useEffect(() => () => {
    [waitTimer, factTimer].forEach((t) => t.current && clearInterval(t.current));
    [waitEnd, toastT].forEach((t) => t.current && clearTimeout(t.current));
  }, []);

  function go(next: Step) {
    setStep(next);
    track("step", { step: next });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 30);
  }
  function goBack() {
    const back: Record<string, Step> = { upload: "landing", configure: "upload", review: "configure", checkout: "review", wait: "checkout", reveal: "landing", upsell: "reveal" };
    const prev = back[step];
    if (prev) go(prev);
  }

  function uploadPhoto(set: React.Dispatch<React.SetStateAction<string | null>>, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => set(String(ev.target?.result || ""));
    r.readAsDataURL(f);
    // Reset the input so re-selecting the SAME file after a clear still fires change.
    e.target.value = "";
  }
  function useExamples() { setP1(MOM); setP2(DAD); }
  function surpriseMe() {
    setGender(["boy", "girl", "surprise"][Math.floor(Math.random() * 3)]);
    setStage(["baby", "toddler", "grow"][Math.floor(Math.random() * 3)]);
    setTwins(Math.random() < 0.25);
  }

  async function urlToFile(url: string, name: string): Promise<File> {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }
  // Create a real Stripe PaymentIntent for the photos + chosen package. The price
  // is computed server-side; the client only sends the selection.
  async function createPaymentIntent() {
    if (!p1 || !p2) { setPayError("Please add both parent photos first."); return; }
    setCreatingPI(true); setPayError("");
    try {
      const [fa, fb] = await Promise.all([urlToFile(p1, "parentA.jpg"), urlToFile(p2, "parentB.jpg")]);
      const fd = new FormData();
      fd.append("parentA", fa); fd.append("parentB", fb);
      fd.append("tier", tier);
      fd.append("twins", twins ? "1" : "");
      fd.append("grow", stage === "grow" ? "1" : "");
      const res = await fetch("/api/payment-intent", { method: "POST", body: fd });
      const data = await res.json();
      if (data.clientSecret) setPay({ clientSecret: data.clientSecret, token: data.token, amount: data.amount, waitSeconds: data.waitSeconds });
      else throw new Error(data.error || "checkout");
    } catch {
      setPayError("Checkout is temporarily unavailable. Please try again.");
    } finally {
      setCreatingPI(false);
    }
  }
  // Always rebuild the intent on entry so price reflects the latest selection
  // (the "change my mind, go back and forth" path).
  function goToCheckout() { setPay(null); setPayError(""); go("checkout"); createPaymentIntent(); }
  function onPaid() { go("wait"); startWait(); }
  function startWait() {
    setWaitProgress(0); setWaitQuestion(0); setWaitPhase("game"); setGuessAnswers([]); setFactIndex(0);
    [waitTimer, factTimer].forEach((t) => t.current && clearInterval(t.current));
    if (waitEnd.current) clearTimeout(waitEnd.current);
    let p = 0;
    waitTimer.current = setInterval(() => {
      if (p < 95) { p += 5 + Math.random() * 4; if (p > 95) p = 95; setWaitProgress(p); }
    }, 600);
    waitEnd.current = setTimeout(() => {
      if (waitTimer.current) clearInterval(waitTimer.current);
      setWaitProgress(100);
      setTimeout(() => go("reveal"), 700);
    }, 14000);
  }
  function answerGame(answer: "a" | "b") {
    setGuessAnswers((g) => [...g, answer]);
    setWaitQuestion((cur) => {
      const next = cur + 1;
      if (next >= TOTAL_QUESTIONS) {
        setWaitPhase("finishing");
        if (factTimer.current) clearInterval(factTimer.current);
        factTimer.current = setInterval(() => setFactIndex((i) => (i + 1) % FACTS.length), 3000);
      }
      return next;
    });
  }
  function toggleAddOn(key: keyof AddOns) { setAddOns((s) => ({ ...s, [key]: !s[key] })); }
  function addOnsTotal() { return (Object.keys(addOns) as (keyof AddOns)[]).reduce((t, k) => t + (addOns[k] ? ADDON_PRICES[k] : 0), 0); }
  function confirmAddOns() { showToast("Added! Charging your card…"); setTimeout(() => go("reveal"), 900); }
  function showToast(msg: string) { setToast(msg); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2200); }
  function restart() {
    [waitTimer, factTimer].forEach((t) => t.current && clearInterval(t.current));
    [waitEnd, toastT].forEach((t) => t.current && clearTimeout(t.current));
    setStep("landing"); setP1(null); setP2(null); setGender("surprise"); setStage("baby"); setTwins(false);
    setTier("deluxe"); setPhotoStyle("surprise"); setVideoVibe("surprise"); setVideoScene("surprise"); setVideoOutfit("surprise"); setVideoMusic("surprise");
    setWaitProgress(0); setWaitQuestion(0); setGuessAnswers([]); setWaitPhase("game"); setFactIndex(0);
    setAddOns({ video: false, ages: false, other: false, twin: false, hd: false }); setToast("");
    setPay(null); setPayError(""); setCreatingPI(false);
  }

  // Derived
  const canContinue = !!(p1 && p2);
  const customizationLabels = [
    ({ studio: "Studio", outdoor: "Outdoor", nursery: "Nursery", puppy: "Puppy", surprise: "" } as Record<string, string>)[photoStyle],
    ({ giggle: "Giggle", breakdance: "Breakdance", country: "Country", rnb: "R&B", dance: "Dance", surprise: "" } as Record<string, string>)[videoVibe],
    ({ kitchen: "Kitchen", bedroom: "Bedroom", beach: "Beach", park: "Park", surprise: "" } as Record<string, string>)[videoScene],
    ({ casual: "Casual", formal: "Formal", pjs: "Pajamas", costume: "Costume", surprise: "" } as Record<string, string>)[videoOutfit],
    ({ rock: "Rock", pop: "Pop", hiphop: "Hip-hop", classical: "Classical", surprise: "" } as Record<string, string>)[videoMusic],
  ].filter(Boolean);
  const baseTier = TIER_PRICES[tier];
  const twinsAdd = twins ? 5 : 0;
  const growAdd = stage === "grow" ? 9 : 0;
  const totalNum = baseTier + twinsAdd + growAdd;
  const totalPrice = Number.isInteger(totalNum) ? String(totalNum) : totalNum.toFixed(2);
  const tierLabel = tier === "basic" ? "Basic · 3 HD photos" : tier === "deluxe" ? "Deluxe · 3 HD + video" : "Ultimate · full pack";
  const tierPrice = String(TIER_PRICES[tier]);
  const genderPill = gender === "boy" ? "👦 Boy" : gender === "girl" ? "👧 Girl" : "🎁 Surprise";
  const stagePill = stage === "baby" ? "👶 Baby" : stage === "toddler" ? "🧒 Toddler" : "📈 Ages 5/10/18";
  const twinsPill = twins ? "👶👶 Twins" : "👶 Just one";
  const babyEmoji = twins ? "👶👶" : "👶";
  const q = QUESTIONS[Math.min(waitQuestion, TOTAL_QUESTIONS - 1)];
  const isGamePhase = waitPhase === "game" && waitQuestion < TOTAL_QUESTIONS;
  const guessedBoy = guessAnswers[0] === "a";
  const guessedGirl = guessAnswers[0] === "b";
  const revealLine = guessedBoy ? "You guessed a boy · here's the truth 👀" : guessedGirl ? "You guessed a girl · see for yourself 👀" : "Yours to keep · save and share 💕";
  const quizCorrect = guessAnswers.filter((a, i) => QUESTIONS[i] && (a === "a" ? "true" : "false") === QUESTIONS[i].answer).length;
  const hasAddOns = Object.values(addOns).some(Boolean);
  const stepLabels: Record<string, string> = { upload: "Step 1 of 3 · Photos", configure: "Step 2 of 3 · Choose", review: "Step 3 of 3 · Review", checkout: "Checkout", wait: "Painting your baby…", reveal: "Reveal", upsell: "Bonus offer" };
  const pct = Math.round(waitProgress) + "%";

  // Once they've paid, navigating backward causes "am I charged again?" panic.
  const postPaid = step === "wait" || step === "reveal" || step === "upsell";
  // What this order already includes — so the upsell never re-sells it.
  const ownsVideo = tier !== "basic";
  const ownsAges = stage === "grow" || tier === "ultimate";
  const ownsHd = tier === "ultimate";
  const hasTwins = twins;
  // Upsell catalogue, filtered to only what they DON'T already have.
  const ADDON_CATALOG = [
    { key: "video" as const, emoji: "🎥", title: "Music video", sub: "Pick the vibe · giggle, dance, country…", price: "+$7", owned: ownsVideo },
    { key: "ages" as const, emoji: "📈", title: "Ages 5, 10, 18", sub: "Watch them grow up", price: "+$9", owned: ownsAges },
    { key: "other" as const, emoji: "👦👧", title: "Boy/girl version", sub: "See the other gender", price: "+$5", owned: gender === "surprise" },
    { key: "twin" as const, emoji: "👶👶", title: "Twin / sibling", sub: "Add another baby", price: "+$5", owned: hasTwins },
    { key: "hd" as const, emoji: "🖼️", title: "HD + printable", sub: "Frame-quality print for the nursery", price: "+$5", owned: ownsHd },
  ];
  const offers = ADDON_CATALOG.filter((a) => !a.owned);

  return (
    <div className="sob">
      {step === "landing" && (
        <div className="scrn" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 36px 80px" }}>
          {/* Header */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 56px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>👶</span>
              <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>See Our Baby</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.55)", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--accent-green)" }}>●</span>2,341 babies generated today</span>
              <button onClick={() => go("upload")} className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>Make our baby 👶</button>
            </div>
          </header>

          {/* Hero */}
          <div className="landing-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center" }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: "0 2px 6px rgba(0,0,0,0.05)", marginBottom: 22 }}><span style={{ fontSize: 14 }}>🔥</span>The AI baby trend, for real couples</span>
              <h1 className="display-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 64, lineHeight: "68px", letterSpacing: "-0.025em" }}>What will your <Squiggle>baby</Squiggle> look like? 👶</h1>
              <p style={{ margin: "22px 0 28px", fontWeight: 500, fontSize: 19, lineHeight: "28px", color: "var(--text-body)", maxWidth: 520 }}>Drop in a photo of each parent. Meet your future baby in HD, plus a music video · your call on the vibe.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
                <span className="trust-pill"><span style={{ color: "var(--accent-green)", fontSize: 16 }}>✓</span>Nothing to install</span>
                <span className="trust-pill"><span style={{ color: "var(--accent-green)", fontSize: 16 }}>✓</span>No app to download</span>
                <span className="trust-pill"><span style={{ color: "var(--accent-green)", fontSize: 16 }}>✓</span>No subscription</span>
              </div>
              <button onClick={() => go("upload")} className="btn-primary" style={{ fontSize: 19, padding: "18px 30px" }}>Make our baby<span style={{ fontSize: 22 }}>👶</span><ArrowRight size={18} /></button>
              <div style={{ marginTop: 16, display: "flex", gap: 18, fontSize: 13, color: "rgba(0,0,0,0.55)", fontWeight: 500 }}>
                <span>🔒 Private</span><span>🗑️ Photos deleted after</span><span>⚡ Ready in ~2 min</span>
              </div>
            </div>
            <div className="landing-formula" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* eslint-disable @next/next/no-img-element */}
                <img className="formula-parent" src={MOM} alt="" style={{ width: 116, height: 116, borderRadius: 26, objectFit: "cover", outline: "4px solid white", transform: "rotate(-6deg)", boxShadow: "0 12px 28px rgba(0,0,0,0.12)" }} />
                <span style={{ fontSize: 32, color: "var(--vetic-pink)", fontWeight: 800 }}>+</span>
                <img className="formula-parent" src={DAD} alt="" style={{ width: 116, height: 116, borderRadius: 26, objectFit: "cover", outline: "4px solid white", transform: "rotate(6deg)", boxShadow: "0 12px 28px rgba(0,0,0,0.12)" }} />
                <span style={{ fontSize: 32, color: "var(--vetic-pink)", fontWeight: 800 }}>=</span>
                <div style={{ position: "relative" }}>
                  <img className="formula-baby" src={BABY(1)} alt="" style={{ width: 156, height: 156, borderRadius: 32, objectFit: "cover", outline: "6px solid var(--vetic-pink)", boxShadow: "0 20px 50px rgba(242,164,230,0.5)" }} />
                  <span style={{ position: "absolute", top: -10, right: -10, background: "var(--vetic-ink)", color: "white", padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✨ AI</span>
                </div>
              </div>
              <p style={{ margin: 0, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)" }}>Example result · just for fun</p>
            </div>
          </div>

          {/* Examples */}
          <div style={{ marginTop: 72, display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 className="display-h2" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40, lineHeight: "44px", letterSpacing: "-0.02em" }}>More AI babies people made ✨</h2>
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.5)", fontWeight: 500 }}>Real example results</span>
          </div>
          <div className="examples-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <img key={n} src={BABY(n)} alt="" style={{ width: "100%", aspectRatio: "1/1", borderRadius: 18, objectFit: "cover" }} />
            ))}
          </div>

          {/* How it works */}
          <h2 className="display-h2" style={{ margin: "72px 0 24px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40, lineHeight: "44px", letterSpacing: "-0.02em", textAlign: "center" }}>How it works</h2>
          <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            {[
              { bg: "var(--accent-yellow)", i: "📸", t: "Upload 2 photos", s: "A clear front-facing photo of each parent." },
              { bg: "var(--vetic-pink)", i: "✨", t: "Choose your baby", s: "Boy, girl, twins, see them at 5 yrs / 10 yrs / 18 yrs." },
              { bg: "var(--accent-cyan)", i: "👶", t: "Meet your baby", s: "HD photos + music video, in ~2 minutes." },
            ].map((c) => (
              <div key={c.t} style={{ background: "white", padding: 28, borderRadius: 22, textAlign: "center" }}>
                <span style={{ display: "inline-flex", width: 56, height: 56, borderRadius: 18, background: c.bg, alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 14 }}>{c.i}</span>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{c.t}</div>
                <div style={{ fontSize: 14, color: "var(--text-body)", lineHeight: "20px" }}>{c.s}</div>
              </div>
            ))}
          </div>

          {/* Footer CTA */}
          <div style={{ marginTop: 72, background: "var(--vetic-ink)", color: "white", padding: "56px 48px", borderRadius: 36, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 36, flexWrap: "wrap" }}>
            <div>
              <h2 className="display-h2" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, lineHeight: "42px", letterSpacing: "-0.02em", maxWidth: 540 }}>Why guess when you can <Squiggle>see</Squiggle>?</h2>
              <p style={{ margin: "12px 0 0", fontSize: 16, opacity: 0.7, maxWidth: 460 }}>One time. No subscription. Backed by a 7-day refund.</p>
            </div>
            <button onClick={() => go("upload")} className="btn-primary" style={{ background: "white", color: "var(--vetic-ink)", fontSize: 17, padding: "16px 28px" }}>Make our baby<span style={{ fontSize: 20 }}>👶</span></button>
          </div>

          <div style={{ marginTop: 48, textAlign: "center", fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 500, lineHeight: "18px" }}>
            For entertainment · results vary · all sales final<br />
            Privacy · Terms · Refunds · support@seeourbaby.com · © 2026 See Our Baby
          </div>
        </div>
      )}

      {step !== "landing" && (
        <div style={{ minHeight: "100vh", padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
          {/* Mini top bar */}
          <div style={{ width: "100%", maxWidth: 680, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 18px" }}>
            {postPaid ? (
              <span style={{ width: 72 }} aria-hidden="true" />
            ) : (
              <button onClick={goBack} style={{ background: "white", border: "none", padding: "8px 14px 8px 10px", borderRadius: 999, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--vetic-ink)", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Back
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>👶</span><span style={{ fontWeight: 800, fontSize: 14 }}>See Our Baby</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.55)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{stepLabels[step]}</span>
          </div>

          <div className="funnel-card scrn" style={{ width: "100%", maxWidth: 680 }}>
            {/* UPLOAD */}
            {step === "upload" && (
              <div>
                <h2 className="display-h2" style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 38, lineHeight: "42px", letterSpacing: "-0.02em" }}>Drop in <Squiggle>mom &amp; dad</Squiggle> 👇</h2>
                <p style={{ margin: "0 0 14px", fontWeight: 500, fontSize: 16, lineHeight: "22px", color: "var(--text-body)" }}>A clear, front-facing photo of each parent works best.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 26px" }}>
                  {[["✓", "No subscription"], ["🔒", "Secure payment"], ["✓", "No app"]].map(([ic, tx]) => (
                    <span key={tx} style={{ background: "white", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: "0 2px 6px rgba(0,0,0,0.04)", display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: ic === "✓" ? "var(--accent-green)" : undefined }}>{ic}</span>{tx}</span>
                  ))}
                </div>
                <div className="upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {([{ label: "Parent 1", val: p1, set: setP1 }, { label: "Parent 2", val: p2, set: setP2 }]).map(({ label, val, set }) => (
                    <label key={label} className="upload-tile" data-filled={!!val}>
                      <input type="file" accept="image/*" onChange={(e) => uploadPhoto(set, e)} style={{ position: "absolute", opacity: 0, inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                      {val ? (
                        <>
                          <img src={val} alt={label} />
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); set(null); }} type="button" className="x">×</button>
                          <span className="tag"><span style={{ color: "var(--accent-green)" }}>✓</span> {label}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 36 }}>📷</span>
                          <span>+ {label}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-body)", marginTop: -2 }}>Click or drop a photo</span>
                        </>
                      )}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 18, background: "var(--surface-page)", borderRadius: 16, padding: "16px 18px", display: "flex", gap: 14 }}>
                  <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>🗑️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Your photos are private</div>
                    <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--text-body)" }}>Re-encoded, stripped of all data, and <strong>deleted right after generating</strong>. Never used to train AI.</div>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "var(--surface-page)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 22 }}>✅</span><div style={{ fontSize: 13 }}><strong>Front-facing</strong> · <span style={{ color: "var(--text-body)" }}>bright, clear face</span></div></div>
                  <div style={{ background: "var(--surface-page)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 22, opacity: 0.55 }}>⛔</span><div style={{ fontSize: 13 }}><strong>Skip</strong> · <span style={{ color: "var(--text-body)" }}>sunglasses, hats, blur</span></div></div>
                </div>
                <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={useExamples} className="btn-secondary" style={{ fontSize: 13, padding: "12px 18px" }}>or try with example photos</button>
                  <div className="sticky-cta">
                    <button onClick={() => go("configure")} className="btn-primary" disabled={!canContinue}>
                      {!canContinue ? "Upload both parents to start" : <>Choose your baby ✨<ArrowRight /></>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONFIGURE */}
            {step === "configure" && (
              <div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
                  <div>
                    <h2 className="display-h2" style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 38, lineHeight: "42px", letterSpacing: "-0.02em" }}>Choose your <Squiggle>baby</Squiggle> ✨</h2>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: "var(--text-body)" }}>Free to play. Tap Surprise me if you can&apos;t decide.</p>
                  </div>
                  <button onClick={surpriseMe} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--vetic-pink)", color: "var(--vetic-ink)", border: "none", padding: "11px 18px", borderRadius: 999, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14 }}><span style={{ fontSize: 17 }}>🎲</span>Surprise me</button>
                </div>

                <div style={upper}>Boy or girl?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {([["boy", "👦", "Boy", "var(--accent-blue)"], ["girl", "👧", "Girl", "var(--vetic-pink)"], ["surprise", "🎁", "Surprise me", "var(--accent-yellow)"]] as const).map(([g, e, t, bg]) => (
                    <div key={g} className="opt-card" data-opt={`gender-${g}`} data-active={gender === g} {...clickable(() => setGender(g))} style={{ flexDirection: "column", padding: "16px 12px" }}>
                      <div className="opt-emoji" style={{ background: bg }}>{e}</div><span style={{ fontWeight: 700, fontSize: 14 }}>{t}</span>
                    </div>
                  ))}
                </div>

                <div style={upper}>Baby or toddler?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {([["baby", "👶", "Baby", "Newborn cute", undefined], ["toddler", "🧒", "Toddler", "~2-3 years", "var(--accent-cyan)"], ["grow", "📈", "Watch them grow", "Ages 5, 10, 18", "var(--accent-purple)"]] as const).map(([s, e, t, sub, bg]) => (
                    <div key={s} className="opt-card" data-opt={`stage-${s}`} data-active={stage === s} {...clickable(() => setStage(s))} style={{ flexDirection: "column", padding: "16px 12px" }}>
                      <div className="opt-emoji" style={bg ? { background: bg } : undefined}>{e}</div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t}{s === "grow" && <span style={{ background: "var(--accent-yellow)", padding: "1px 7px", borderRadius: 999, fontSize: 11, marginLeft: 2 }}>+$9</span>}</span>
                      <span style={{ fontSize: 12, color: "var(--text-body)" }}>{sub}</span>
                    </div>
                  ))}
                </div>

                <div style={upper}>One baby or twins?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
                  <div className="opt-card" data-opt="twins-one" data-active={!twins} {...clickable(() => setTwins(false))} style={{ flexDirection: "column", padding: "16px 12px" }}>
                    <div className="opt-emoji">👶</div><span style={{ fontWeight: 700, fontSize: 14 }}>Just one</span>
                  </div>
                  <div className="opt-card" data-opt="twins-yes" data-active={twins} {...clickable(() => setTwins(true))} style={{ flexDirection: "column", padding: "16px 12px" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", height: 54 }}>
                      <div className="opt-emoji" style={{ background: "var(--accent-green)", width: 42, height: 42, fontSize: 22 }}>👶</div>
                      <div className="opt-emoji" style={{ background: "var(--accent-green)", width: 42, height: 42, fontSize: 22 }}>👶</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Twins <span style={{ background: "var(--accent-yellow)", padding: "1px 7px", borderRadius: 999, fontSize: 11 }}>+$5</span></span>
                  </div>
                </div>

                {/* Make it yours */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 10px", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(0,0,0,0.7)" }}>Make it yours</div>
                  <span style={{ fontSize: 11, background: "var(--vetic-pink)", color: "var(--vetic-ink)", padding: "4px 10px", borderRadius: 999, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Included with Deluxe+</span>
                </div>
                <div className="customize-block">
                  <ChipRow label="🎨 Photo style" value={photoStyle} set={setPhotoStyle} opts={[["studio", "📸", "Studio"], ["outdoor", "🌳", "Outdoor"], ["nursery", "🛏️", "Nursery"], ["puppy", "🐶", "With puppy"], ["surprise", "🎲", "Surprise me"]]} mb={14} />
                  <ChipRow label="🎥 Video vibe" value={videoVibe} set={setVideoVibe} opts={[["giggle", "😄", "Giggle"], ["breakdance", "🕺", "Breakdance"], ["country", "🤠", "Country"], ["rnb", "🎤", "R&B"], ["dance", "💃", "Dance"], ["surprise", "🎲", "Surprise me"]]} mb={18} />
                  <ChipRow label="🎬 Scene" value={videoScene} set={setVideoScene} opts={[["kitchen", "🏠", "Kitchen"], ["bedroom", "🛏️", "Bedroom"], ["beach", "🏖️", "Beach"], ["park", "🌳", "Park"], ["surprise", "🎲", "Surprise me"]]} mb={14} />
                  <ChipRow label="👕 Outfit" value={videoOutfit} set={setVideoOutfit} opts={[["casual", "👕", "Casual"], ["formal", "👔", "Formal"], ["pjs", "🛌", "Pajamas"], ["costume", "🎃", "Costume"], ["surprise", "🎲", "Surprise me"]]} mb={14} />
                  {videoVibe === "dance" && (
                    <ChipRow label="🎵 Music" value={videoMusic} set={setVideoMusic} opts={[["rock", "🎸", "Rock"], ["pop", "🎤", "Pop"], ["hiphop", "🎧", "Hip-hop"], ["classical", "🎻", "Classical"], ["surprise", "🎲", "Surprise me"]]} mb={18} />
                  )}
                </div>
                <div className="config-cta-fixed"><button onClick={() => go("review")} className="btn-primary" style={{ padding: "14px 28px" }}>Continue<ArrowRight /></button></div>
              </div>
            )}

            {/* REVIEW + PRICE */}
            {step === "review" && (
              <div>
                <h2 className="display-h2" style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 38, lineHeight: "42px", letterSpacing: "-0.02em" }}>Your <Squiggle>future baby</Squiggle></h2>
                <p style={{ margin: "0 0 24px", fontWeight: 500, fontSize: 15, color: "var(--text-body)" }}>Last look before we get started.</p>
                <div style={{ background: "var(--surface-page)", borderRadius: 22, padding: 22, marginBottom: 26 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, justifyContent: "center" }}>
                    <img src={p1 ?? MOM} alt="Parent 1" style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover" }} />
                    <span style={{ fontSize: 22, color: "var(--vetic-pink)", fontWeight: 800 }}>+</span>
                    <img src={p2 ?? DAD} alt="Parent 2" style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover" }} />
                    <span style={{ fontSize: 22, color: "var(--vetic-pink)", fontWeight: 800 }}>=</span>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--vetic-pink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{babyEmoji}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {[genderPill, stagePill, twinsPill].map((p) => (<span key={p} style={{ background: "white", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>{p}</span>))}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(0,0,0,0.7)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Choose your package</div>
                  <span style={{ fontSize: 10, background: "rgba(128, 253, 140, 0.42)", padding: "3px 10px", borderRadius: 999, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.78)", whiteSpace: "nowrap" }}>No subscription</span>
                </div>
                <div className="tier-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 12, marginBottom: 22 }}>
                  {([
                    ["basic", "Basic", "$29", "$19", <>3 HD baby photos</>, undefined] as const,
                    ["deluxe", "Deluxe", "$39", "$29", <>3 custom HD baby photos<br /><span style={{ whiteSpace: "nowrap" }}>🎥 1 music video</span></>, "Most popular"] as const,
                    ["ultimate", "Ultimate", "$49", "$39", <>All Deluxe<br /><span style={{ whiteSpace: "nowrap" }}>📈 Ages 5/10/18</span><br /><span style={{ whiteSpace: "nowrap" }}>🖼️ Printable HD</span></>, undefined] as const,
                  ]).map(([id, name, was, now, desc, badge]) => (
                    <div key={id} className="tier-card" data-tier={id} data-active={tier === id} {...clickable(() => setTier(id))}>
                      {badge && <span className="tier-badge">{badge}</span>}
                      <span className="tier-radio" style={{ marginBottom: 10 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{name}</span>
                        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "rgba(0,0,0,0.42)", textDecoration: "line-through" }}>{was}</span>
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>{now}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-body)", marginTop: 6, lineHeight: "18px" }}>{desc}</div>
                    </div>
                  ))}
                </div>

                {tier === "basic" && customizationLabels.length > 0 && (
                  <div style={{ background: "rgba(255, 230, 110, 0.55)", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, lineHeight: "19px", marginBottom: 10 }}><strong>Basic skips your customizations.</strong> You picked: {customizationLabels.join(" · ")}.</div>
                    <button onClick={() => setTier("deluxe")} style={{ background: "var(--vetic-ink)", color: "white", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Yes, keep my customizations →</button>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(128, 253, 140, 0.20)", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                  <span style={{ fontSize: 26, flexShrink: 0 }}>💯</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Love your baby or your money back</div>
                    <div style={{ fontSize: 12, color: "var(--text-body)" }}>7-day refund · No questions asked</div>
                  </div>
                </div>

                {/* Itemised total so twins / ages add-ons are visibly calculated, not just baked into the button */}
                <div style={{ background: "var(--surface-page)", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: (twins || stage === "grow") ? 6 : 0 }}>
                    <span style={{ fontWeight: 600 }}>{tier.charAt(0).toUpperCase() + tier.slice(1)} package</span>
                    <span style={{ fontWeight: 600 }}>${tierPrice}</span>
                  </div>
                  {twins && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", marginBottom: 4 }}><span>+ Twins</span><span>+$5</span></div>}
                  {stage === "grow" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", marginBottom: 4 }}><span>+ Ages 5/10/18</span><span>+$9</span></div>}
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}><span>Total</span><span>${totalPrice}</span></div>
                </div>

                <div style={{ fontSize: 12, textAlign: "center", color: "rgba(0,0,0,0.55)", marginBottom: 20, fontWeight: 500 }}>One time · No subscription · We never store your card to rebill you</div>

                <div className="sticky-cta">
                  {payMethod === "apple" && (
                    <>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={goToCheckout} className="pay-pill apple-pay" style={{ flex: 1 }} aria-label="Pay with Apple Pay">
                          <svg width="17" height="21" viewBox="0 0 384 512" fill="#fff"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                          <span className="pay-text">Pay</span>
                        </button>
                        <button onClick={goToCheckout} className="pay-pill pink-pay" style={{ flex: 1 }} aria-label="Pay with card">
                          <svg width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                          <span className="pay-text">Pay with Card</span>
                        </button>
                      </div>
                      <div className="pay-confirm">Total ${totalPrice} · Confirm with Touch ID or tap Card</div>
                    </>
                  )}
                  {payMethod === "google" && (
                    <>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={goToCheckout} className="pay-pill gpay" style={{ flex: 1 }} aria-label="Pay with Google Pay">
                          <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
                          <span className="pay-text">Pay</span>
                        </button>
                        <button onClick={goToCheckout} className="pay-pill pink-pay" style={{ flex: 1 }} aria-label="Pay with card">
                          <svg width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                          <span className="pay-text">Pay with Card</span>
                        </button>
                      </div>
                      <div className="pay-confirm">Total ${totalPrice} · Confirm with screen lock or tap Card</div>
                    </>
                  )}
                  {payMethod === "card" && (
                    <button onClick={goToCheckout} className="pay-pill pink-pay" style={{ width: "100%" }} aria-label="Pay with card">
                      <svg width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                      <span className="pay-text">Pay with Card · ${totalPrice}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CHECKOUT */}
            {step === "checkout" && (
              <div>
                <h2 className="display-h2" style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, lineHeight: "38px", letterSpacing: "-0.02em" }}>Almost <Squiggle>there</Squiggle> 💳</h2>
                <p style={{ margin: "0 0 22px", fontWeight: 500, fontSize: 14, color: "var(--text-body)" }}>Pay to reveal the baby you just designed.</p>
                <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 28, alignItems: "start" }}>
                  <div style={{ background: "var(--surface-page)", borderRadius: 18, padding: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(0,0,0,0.55)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Order</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 600 }}>{tierLabel}</span><span style={{ fontWeight: 600 }}>${tierPrice}</span></div>
                    {twins && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", marginBottom: 4 }}><span>+ Twins</span><span>+$5</span></div>}
                    {stage === "grow" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", marginBottom: 4 }}><span>+ Ages 5/10/18</span><span>+$9</span></div>}
                    <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}><span>Total</span><span>${totalPrice}</span></div>
                    <div style={{ marginTop: 18, padding: 12, background: "rgba(128, 253, 140, 0.20)", borderRadius: 12, display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 20 }}>💯</span><div style={{ fontSize: 12, lineHeight: "16px" }}><strong>7-day refund</strong> if you don&apos;t love it</div></div>
                  </div>
                  <div>
                    {pay ? (
                      <CheckoutForm session={pay} onPaid={onPaid} />
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 16px" }}>
                        {payError ? (
                          <>
                            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>{payError}</p>
                            <button onClick={createPaymentIntent} className="btn-secondary">Try again</button>
                          </>
                        ) : (
                          <p style={{ color: "var(--text-body)", fontWeight: 600 }}>{creatingPI ? "Setting up secure checkout…" : "Preparing your order…"}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* WAIT */}
            {step === "wait" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 72, lineHeight: 1, animation: "sob-bounce-y 1.4s ease-in-out infinite", marginBottom: 16 }}>👶</div>
                <h2 className="display-h2" style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, lineHeight: "36px", letterSpacing: "-0.02em" }}>Your baby is on the way 🎉</h2>
                <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--text-body)", fontWeight: 500 }}>Don&apos;t close this page · ~2 min</p>
                <div style={{ maxWidth: 480, margin: "0 auto 32px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.6)", marginBottom: 8 }}><span>Painting your baby…</span><span>{pct}</span></div>
                  <div className="progress-rail"><div className="progress-fill" style={{ width: pct }} /></div>
                </div>
                {isGamePhase ? (
                  <div style={{ background: "var(--surface-page)", borderRadius: 22, padding: 22, maxWidth: 480, margin: "0 auto", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(0,0,0,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}><span style={{ fontSize: 14 }}>🎲</span><span>Just a fun guess while you wait · Q{Math.min(waitQuestion + 1, TOTAL_QUESTIONS)}/{TOTAL_QUESTIONS}</span></div>
                    <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 16, lineHeight: "26px", textAlign: "center" }}>{q.text}</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="game-btn" onClick={() => answerGame("a")}><span style={{ fontSize: 32 }}>{q.a.e}</span><span style={{ fontWeight: 700, fontSize: 15 }}>{q.a.t}</span></button>
                      <button className="game-btn" onClick={() => answerGame("b")}><span style={{ fontSize: 32 }}>{q.b.e}</span><span style={{ fontWeight: 700, fontSize: 15 }}>{q.b.t}</span></button>
                    </div>
                    <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 11, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>No wrong answers · we&apos;ll show you the real result.</p>
                  </div>
                ) : (
                  <div style={{ background: "var(--surface-page)", borderRadius: 22, padding: 22, maxWidth: 480, margin: "0 auto", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(0,0,0,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}><span style={{ fontSize: 14 }}>✨</span><span>Adding the finishing touches</span></div>
                    <div style={{ fontWeight: 600, fontSize: 17, lineHeight: "24px", minHeight: 80, textAlign: "center" }}>{FACTS[factIndex]}</div>
                  </div>
                )}
              </div>
            )}

            {/* REVEAL */}
            {step === "reveal" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <h2 className="display-h2" style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 44, lineHeight: "50px", letterSpacing: "-0.025em" }}>Meet your <Squiggle>{twins ? "twins" : "baby"}</Squiggle> 🎉</h2>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: "var(--text-body)" }}>{revealLine}</p>
                </div>
                <div className="reveal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
                  <div className="reveal-img" style={{ gridRow: "span 2", gridColumn: "span 2" }}>
                    <img src={BABY(4)} alt="" />
                    <button onClick={() => showToast("Photo saved")} type="button" className="save-overlay">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Save
                    </button>
                  </div>
                  <div className="reveal-img" style={{ animationDelay: "0.2s" }}><img src={BABY(5)} alt="" /><button onClick={() => showToast("Photo saved")} type="button" className="save-overlay">⬇️</button></div>
                  <div className="reveal-img" style={{ animationDelay: "0.4s" }}><img src={BABY(2)} alt="" /><button onClick={() => showToast("Photo saved")} type="button" className="save-overlay">⬇️</button></div>
                </div>
                <p style={{ margin: "0 0 18px", textAlign: "center", fontSize: 14, color: "var(--text-body)", fontWeight: 500 }}>{twins ? "Your two little ones, as imagined by the AI 💕" : "Three takes from the AI · save your favorite 💕"}</p>

                {/* Music video — delivered because they bought Deluxe/Ultimate */}
                {ownsVideo && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>🎥</span>Your music video</div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src="/cache/giggle.mp4" autoPlay muted loop playsInline controls style={{ width: "100%", borderRadius: 20, display: "block", background: "#000", aspectRatio: "1/1", objectFit: "cover", outline: "4px solid var(--vetic-pink)", outlineOffset: -2 }} />
                  </div>
                )}

                {/* Age progression — delivered because they bought "Watch them grow" / Ultimate */}
                {ownsAges && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>📈</span>Watch them grow</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {([["Age 5", "/cache/age1.webp"], ["Age 10", "/cache/age2.webp"], ["Age 18", "/cache/age3.webp"]] as const).map(([label, src]) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <img src={src} alt={label} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 16, outline: "3px solid var(--vetic-pink)", outlineOffset: -2 }} />
                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--text-body)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                  <button onClick={() => showToast("Saved all photos")} className="btn-primary"><span style={{ fontSize: 18 }}>📥</span>Save all photos</button>
                  <button onClick={() => showToast("Opening share sheet…")} className="btn-secondary"><span style={{ fontSize: 16 }}>📲</span>Share</button>
                  {ownsVideo && <button onClick={() => showToast("Video saved")} className="btn-secondary"><span style={{ fontSize: 16 }}>🎥</span>Save video</button>}
                </div>
                {guessAnswers.length > 0 && <div style={{ textAlign: "center", margin: "0 0 12px", fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>🎲 {quizCorrect} / {guessAnswers.length} trivia correct</div>}
                {offers.length > 0 && <button onClick={() => go("upsell")} style={{ background: "rgba(242,164,230,0.20)", color: "var(--vetic-ink)", border: "none", padding: "14px 20px", borderRadius: 14, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>✨ Make it even better · one tap, no card needed →</button>}
                <button onClick={restart} style={{ background: "transparent", border: "none", color: "rgba(0,0,0,0.5)", fontWeight: 500, fontSize: 13, marginTop: 10, padding: 8, width: "100%", textAlign: "center" }}>Make another baby</button>
              </div>
            )}

            {/* UPSELL */}
            {step === "upsell" && (
              <div>
                <h2 className="display-h2" style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, lineHeight: "40px", letterSpacing: "-0.02em" }}>Make it even <Squiggle>better</Squiggle> 🍼</h2>
                <p style={{ margin: "0 0 22px", fontWeight: 500, fontSize: 14, color: "var(--text-body)" }}>One tap, charged to the card you just used.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
                  {offers.map(({ key, emoji, title, sub, price }, i) => (
                    <div key={key} className="addon-card" data-addon={key} data-active={addOns[key]} {...clickable(() => toggleAddOn(key))} style={i === offers.length - 1 && offers.length % 2 === 1 ? { gridColumn: "span 2" } : undefined}>
                      <span className="addon-emoji">{emoji}</span>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div><div style={{ fontSize: 12, color: "var(--text-body)" }}>{sub}</div></div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{price}</span>
                      <span className="addon-check">{addOns[key] && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 500 }}>🔒 No need to re-enter your card</div>
                  {hasAddOns ? (
                    <div>
                      <button onClick={confirmAddOns} className="btn-primary">Add to my baby for ${addOnsTotal()}<ArrowRight /></button>
                    </div>
                  ) : (
                    <button onClick={() => go("reveal")} className="btn-secondary">I&apos;m good · back to my baby</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ChipRow({ label, value, set, opts, mb }: { label: string; value: string; set: (v: string) => void; opts: string[][]; mb: number }) {
  return (
    <>
      <div style={sublabel}>{label}</div>
      <div className="chip-row" style={{ marginBottom: mb }}>
        {opts.map(([v, e, t]) => (
          <span key={v} className="chip" data-val={v} data-active={value === v} {...clickable(() => set(v))}><span className="chip-emoji">{e}</span>{t}</span>
        ))}
      </div>
    </>
  );
}
