import { test, expect } from "@playwright/test";
import Stripe from "stripe";

/**
 * Webhook signature + idempotency. Fully offline — no Stripe account needed,
 * only a shared STRIPE_WEBHOOK_SECRET between the running server and this test.
 * Runs whenever that secret is present (local proof + CI); skips otherwise.
 */
const secret = process.env.STRIPE_WEBHOOK_SECRET;

function signedEvent(eventId: string, overrides: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_" + eventId,
        object: "checkout.session",
        payment_status: "paid",
        metadata: { token: "tok_" + eventId, tier: "deluxe", bump: "" },
        ...overrides,
      },
    },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: secret! });
  return { payload, header };
}

test.describe("stripe webhook", () => {
  test.skip(!secret, "set STRIPE_WEBHOOK_SECRET (shared with the server) to run");

  test("accepts a correctly-signed checkout.session.completed", async ({ request }) => {
    const { payload, header } = signedEvent("evt_ok_1");
    const res = await request.post("/api/webhooks/stripe", {
      headers: { "stripe-signature": header, "content-type": "application/json" },
      data: payload,
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).received).toBe(true);
  });

  test("rejects a tampered/invalid signature with 400 (fails closed)", async ({ request }) => {
    const { payload } = signedEvent("evt_bad_1");
    const res = await request.post("/api/webhooks/stripe", {
      headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
      data: payload,
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a missing signature with 400", async ({ request }) => {
    const { payload } = signedEvent("evt_nosig_1");
    const res = await request.post("/api/webhooks/stripe", {
      headers: { "content-type": "application/json" },
      data: payload,
    });
    expect(res.status()).toBe(400);
  });

  test("is idempotent on redelivery of the same event id", async ({ request }) => {
    const { payload, header } = signedEvent("evt_dedupe_1");
    const opts = { headers: { "stripe-signature": header, "content-type": "application/json" }, data: payload };
    const first = await request.post("/api/webhooks/stripe", opts);
    const second = await request.post("/api/webhooks/stripe", opts);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect((await second.json()).deduped).toBe(true);
  });
});
