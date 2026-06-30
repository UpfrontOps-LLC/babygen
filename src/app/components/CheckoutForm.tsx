"use client";

import { useState } from "react";
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

const elementOpts = { style: { base: { fontSize: "16px", color: "#131313", fontFamily: "Urbanist, sans-serif", "::placeholder": { color: "#9ca3af" } } } };
const field: React.CSSProperties = { borderRadius: 12, border: "1.5px solid rgba(0,0,0,0.1)", background: "white", padding: "13px 14px" };

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, "");
}

function Inner({ session, onPaid }: { session: PaymentSession; onPaid: (paymentIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function payWithCard() {
    if (!stripe || !elements || busy) return;
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;
    setBusy(true);
    setErr("");
    const { error, paymentIntent } = await stripe.confirmCardPayment(session.clientSecret, {
      payment_method: { card: cardNumber },
    });
    if (error) {
      setErr(error.message || "Payment failed, please check your card and try again.");
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onPaid(paymentIntent.id);
    } else {
      setErr("Payment didn't complete, please try again.");
      setBusy(false);
    }
  }

  async function onWalletConfirm(_e: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: session.clientSecret,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (error) { setErr(error.message || "Payment failed, please try again."); return; }
    if (paymentIntent?.status === "succeeded") onPaid(paymentIntent.id);
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <ExpressCheckoutElement onConfirm={onWalletConfirm} options={{ buttonHeight: 48 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} />
        <span style={{ fontSize: 12, color: "var(--text-body)", fontWeight: 500 }}>or pay with card</span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} />
      </div>

      <div data-testid="card-number" style={{ ...field, marginBottom: 10 }}><CardNumberElement options={elementOpts} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div data-testid="card-expiry" style={field}><CardExpiryElement options={elementOpts} /></div>
        <div data-testid="card-cvc" style={field}><CardCvcElement options={elementOpts} /></div>
      </div>

      <button onClick={payWithCard} disabled={!stripe || busy} className="btn-primary" style={{ width: "100%", fontSize: 17 }}>
        {busy ? "Processing…" : (
          <>
            {`Pay ${fmt(session.amount)} & reveal `}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </>
        )}
      </button>
      {err && <p data-testid="pay-error" style={{ marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{err}</p>}
      <div style={{ marginTop: 14, display: "flex", gap: 14, justifyContent: "center", fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 500 }}>
        <span>🔒 Stripe</span><span>🗑️ Photos deleted</span><span>💯 7-day refund</span>
      </div>
    </div>
  );
}

export default function CheckoutForm({ session, onPaid }: { session: PaymentSession; onPaid: (paymentIntentId: string) => void }) {
  return (
    <Elements
      stripe={getStripe()}
      options={{ clientSecret: session.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#131313", borderRadius: "12px", fontFamily: "Urbanist, sans-serif" } } }}
    >
      <Inner session={session} onPaid={onPaid} />
    </Elements>
  );
}
