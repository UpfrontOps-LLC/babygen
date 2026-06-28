# babygen — Stripe + deploy runbook

**Model:** babygen is a **standalone Stripe account** under the UpfrontOps org
(babygen is merchant of record — **no Connect**). Checkout is a direct charge;
the webhook is the authoritative payment confirmation.

## Environment variables

| Var | Where | Notes |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | `.env.local` / Cloudflare secret | `sk_test_…` in sandbox, `sk_live_…` in prod |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` / Cloudflare secret | `whsec_…` from the webhook endpoint (or `stripe listen`) |
| `NEXT_PUBLIC_BASE_URL` | `.env.local` / Cloudflare | public origin; used for `success_url` + OG/metadata |
| `REPLICATE_API_TOKEN` | `.env.local` / Cloudflare secret | image/video generation |

The app **fails closed** when these are absent (checkout → 500, generate → 500,
webhook → 500), which is what the Phase-1 safety specs assert.

## One-time Stripe setup (sandbox)

Do this via the **Stripe MCP** (authorize it with `/mcp` → "claude.ai Stripe")
or the dashboard:

1. In the UpfrontOps Stripe org, create/confirm the standalone **babygen** account; switch to a **Sandbox** (test mode).
2. Copy the **test secret key** → `STRIPE_SECRET_KEY=sk_test_…` in `.env.local`.
3. Create a **webhook endpoint**:
   - URL: `https://<cloudflare-domain>/api/webhooks/stripe`
   - Events: **`checkout.session.completed`** (add `checkout.session.async_payment_succeeded` if you enable delayed methods)
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET=whsec_…`
4. **Local** webhook testing without a public URL:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # prints the whsec_… to use as STRIPE_WEBHOOK_SECRET for the local server
   ```

## Run the payment E2E (Phase 3)

The `@payment` specs (400 validation, 402 unpaid-rejection, session creation,
card `4242 4242 4242 4242` pay-through-generation) and the webhook specs run
once the secrets are present and **shared with the test process**:

```bash
# server started with STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in its env, then:
E2E_STRIPE=1 STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET npm run test:e2e
```

The webhook specs are **fully offline** (locally-signed events, no Stripe API) —
they only need `STRIPE_WEBHOOK_SECRET` shared between server and test.

## Cloudflare deploy — the one real porting task

`src/lib/store.ts` is an in-memory `Map`. That works on the current single
long-running Node server, but **Cloudflare Workers isolates do not share process
memory**, so the webhook (one isolate) and `/api/generate` (another) would not
see each other's writes. Before/at deploy, swap the Map for **Workers KV**:

- Bind a KV namespace (e.g. `BABY_KV`).
- `putParents`/`getEntry`/`setImages`/`clearParents` → `KV.put/get` JSON by token.
  Parent + baby images are base64 data URIs; a handful fits KV's 25 MB value
  limit, but prefer **R2** for image blobs if you add more variants.
- `markPaid`/`isPaid` → a `paid:<token>` key.
- `claimEvent(id)` → `KV.put('evt:'+id, '1', { expirationTtl: 86400 })` guarded by
  a read; gives idempotency with automatic cleanup.

Deploy Next 16 to Cloudflare via `@opennextjs/cloudflare` (Workers) — the API
routes already declare `runtime = "nodejs"`; confirm OpenNext's nodejs-compat.

## Go-live checklist

- [ ] `sk_test_` → `sk_live_`; recreate the webhook endpoint in **live** mode → new `whsec_`
- [ ] `NEXT_PUBLIC_BASE_URL` → production domain
- [ ] Store on KV (above) — verify webhook→generate across isolates
- [ ] Stripe: business profile, statement descriptor, refund/dispute email, Apple/Google Pay domains
- [ ] Confirm `checkout.session.completed` is the only event the endpoint subscribes to (least privilege)
