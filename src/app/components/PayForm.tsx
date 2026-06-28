"use client";

import { useRef, useState } from "react";
import {
  Elements,
  ExpressCheckoutElement,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe-client";

export type PaymentSession = { clientSecret: string; token: string; amount: number; waitSeconds: number };

function track(event: string, data: Record<string, unknown> = {}) {
  try {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }) });
  } catch {}
}

// Speculative early-gen: fire the moment the customer commits to paying (CVV
// focus for cards, wallet-button tap for Apple/Google Pay). Idempotent on the
// server; we also guard once on the client so we only POST once.
function useEarlyGen(token: string) {
  const fired = useRef(false);
  return () => {
    if (fired.current) return;
    fired.current = true;
    track("card_focus", { token }); // shows in /monitor as the CVV moment
    try {
      fetch("/api/generate-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    } catch {}
  };
}

const fieldClass = "rounded-xl border-2 border-gray-200 bg-white px-3 py-3 focus-within:border-rose-500 transition";
const elementOpts = { style: { base: { fontSize: "16px", color: "#111827", "::placeholder": { color: "#9ca3af" } } } };

function CardForm({ session, onError }: { session: PaymentSession; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const earlyGen = useEarlyGen(session.token);

  async function payWithCard() {
    if (!stripe || !elements || busy) return;
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;
    setBusy(true);
    onError("");
    const { error, paymentIntent } = await stripe.confirmCardPayment(session.clientSecret, {
      payment_method: { card: cardNumber },
    });
    if (error) {
      onError(error.message || "Payment failed, please try again.");
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      track("payment_succeeded", { token: session.token, meta: { method: "card" } });
      window.location.href = `/success?token=${session.token}&payment_intent=${paymentIntent.id}&w=${session.waitSeconds}`;
    } else {
      onError("Payment didn't complete, please try again.");
      setBusy(false);
    }
  }

  async function onWalletConfirm(_e: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: session.clientSecret,
      confirmParams: { return_url: `${window.location.origin}/success?token=${session.token}&w=${session.waitSeconds}` },
      redirect: "if_required",
    });
    if (error) {
      onError(error.message || "Payment failed, please try again.");
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      track("payment_succeeded", { token: session.token, meta: { method: "wallet" } });
      window.location.href = `/success?token=${session.token}&payment_intent=${paymentIntent.id}&w=${session.waitSeconds}`;
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      {/* Wallets — Apple Pay / Google Pay / Link. Renders only where available. */}
      <ExpressCheckoutElement onClick={earlyGen} onConfirm={onWalletConfirm} options={{ buttonHeight: 48 }} />

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />or pay with card<span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className={fieldClass} data-testid="card-number"><CardNumberElement options={elementOpts} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className={fieldClass} data-testid="card-expiry"><CardExpiryElement options={elementOpts} /></div>
        {/* CVV focus = the customer is committing -> start generating early */}
        <div className={fieldClass} data-testid="card-cvc"><CardCvcElement options={elementOpts} onFocus={earlyGen} /></div>
      </div>

      <button
        onClick={payWithCard}
        disabled={!stripe || busy}
        className="mt-1 w-full px-8 py-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-lg font-black shadow-xl shadow-rose-500/30 disabled:opacity-50 hover:brightness-105 active:scale-[0.99] transition"
      >
        {busy ? "Processing…" : `Pay ${(session.amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, "")} & reveal →`}
      </button>
      <p className="text-center text-xs text-gray-500">🔒 Secure payment via Stripe · 🗑️ Photos deleted after generation</p>
    </div>
  );
}

// Outer wrapper: loads Stripe + Elements bound to the PaymentIntent clientSecret.
export default function PayForm({ session }: { session: PaymentSession }) {
  const [error, setError] = useState("");
  return (
    <Elements
      stripe={getStripe()}
      options={{ clientSecret: session.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#e11d48", borderRadius: "12px" } } }}
    >
      <CardForm session={session} onError={setError} />
      {error && <p className="mt-3 text-center text-sm font-semibold text-red-500 max-w-md">{error}</p>}
    </Elements>
  );
}
