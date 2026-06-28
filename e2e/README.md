# babygen E2E tests

Committed Playwright suite. Phased so it runs **green today** (pre-Stripe) and
expands to the real payment path the moment a sandbox key is wired in.

## Run

```bash
npm run test:e2e          # all specs (reuses a server on :3000 locally, builds fresh in CI)
npm run test:e2e:ui       # interactive
npm run test:e2e:report   # open the last HTML report
```

First time on a new machine / CI: `npx playwright install chromium`.

## What runs without any keys (Phase 1)

- `landing.spec.ts` — render, **0 console/JS errors**, A/B variant cookie, example proof strip, CTA gating, trust badges.
- `funnel.spec.ts` — upload → tier selector (Deluxe default) → bump shows only on Basic → consent gates CTA → **live total is correct per tier+bump** → unconfigured checkout surfaces an inline error (no crash).
- `preview.spec.ts` — `/success?preview=1` reveal grid + OTO ladder + toggle.
- `legal.spec.ts` — privacy/terms render with required language; footer links.
- `api-guards.spec.ts` (Phase-1 block) — **safety invariant: `/api/generate` never emits `images` without a verified payment**; routes fail closed when unconfigured.

## What needs the real Stripe sandbox (`@payment`, Phase 3)

Tagged `@payment` specs are **skipped unless `E2E_STRIPE=1`**. They require:

- a Stripe **sandbox (test mode)** secret key in `.env.local` (`STRIPE_SECRET_KEY=sk_test_…`)
- for webhook delivery: the Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) and the resulting `STRIPE_WEBHOOK_SECRET=whsec_…`

```bash
E2E_STRIPE=1 npm run test:e2e
```

These cover: 400 validation (missing/oversized/undersized photos), the **402
unpaid-rejection** gate, Checkout session creation, the browser-driven pay with
test card `4242 4242 4242 4242`, webhook `checkout.session.completed` delivery,
and end-to-end through generation.

## Decisions still pending before Phase 3 (see DEPLOY_STRIPE.md)

- **Connect model**: standalone sandbox account under the UpfrontOps org, vs. a
  true Connect connected account (`stripeAccount` / `on_behalf_of` / application fee).
- Persistent store to replace the in-memory `src/lib/store.ts` Map (webhooks and
  serverless instances don't share process memory).
