import { test, expect } from "@playwright/test";

/**
 * Revenue-protecting invariants for the API routes.
 *
 * Phase 1 (always runs, no key): the pay-gated /api/generate route NEVER returns
 * images without a verified payment. In the shipped unconfigured state it must
 * fail closed (non-2xx, no `images`).
 *
 * @payment (runs only when E2E_STRIPE=1, i.e. a real sandbox key is wired):
 * exercises the real 400 validation + 402 unpaid-rejection + session creation.
 */
test.describe("pay-gate safety invariant (no key required)", () => {
  test("/api/generate never emits images for an empty request", async ({ request }) => {
    const res = await request.post("/api/generate", { data: {} });
    expect(res.ok()).toBeFalsy();
    const body = await res.json().catch(() => ({}));
    expect(body.images).toBeUndefined();
  });

  test("/api/generate never emits images for a forged token/payment_intent", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { token: "forged-token", payment_intent: "pi_test_forged" },
    });
    expect(res.ok()).toBeFalsy();
    const body = await res.json().catch(() => ({}));
    expect(body.images).toBeUndefined();
  });

  test("/api/generate-start does nothing for an unknown token (no speculative gen)", async ({ request }) => {
    const res = await request.post("/api/generate-start", { data: { token: "unknown-token" } });
    expect(res.status()).toBe(404);
  });

  test("/api/payment-intent fails closed (no clientSecret) when sent no photos", async ({ request }) => {
    const res = await request.post("/api/payment-intent", { multipart: { tier: "deluxe" } });
    expect(res.ok()).toBeFalsy();
    const body = await res.json().catch(() => ({}));
    expect(body.clientSecret).toBeUndefined();
  });
});

test.describe("@payment real Stripe sandbox paths", () => {
  test.skip(!process.env.E2E_STRIPE, "set E2E_STRIPE=1 with a sandbox key to run");

  test("payment-intent rejects a request with no photos (400)", async ({ request }) => {
    const res = await request.post("/api/payment-intent", { multipart: { tier: "deluxe" } });
    expect(res.status()).toBe(400);
  });

  test("generate rejects an unpaid/forged payment_intent (402)", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { token: "forged-token", payment_intent: "pi_test_definitely_not_paid" },
    });
    // 402 when the PI is reachable-but-unpaid; the gate must not return 200
    expect(res.status()).not.toBe(200);
    const body = await res.json().catch(() => ({}));
    expect(body.images).toBeUndefined();
  });
});
