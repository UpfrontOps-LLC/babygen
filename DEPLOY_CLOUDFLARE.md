# Deploying seeourbaby.com on Cloudflare Workers

The app runs entirely on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
— no VPS. State lives in Workers KV (`SESSIONS`, `META`); durable generation runs
in the `GenerateBaby` Cloudflare Workflow. Static assets (`public/`) ship with the
Worker. This doc is the **one-time cutover**; routine deploys are just
`npm run deploy` (or the `/deploy-sob` skill).

## Architecture

| Concern | On Cloudflare |
| --- | --- |
| Next.js app (SSR, API routes, assets) | OpenNext Worker (`wrangler deploy`) |
| Session / fulfillment state | KV `SESSIONS` (token → entry, 24h TTL) |
| Webhook dedup, gen-timing, events feed | KV `META` |
| Durable generation (3 imgs → video? → ages?) | Workflow `GenerateBaby` (binding `GENERATE_BABY`) |
| Add-on (upsell) generation | same Workflow, instance id `${token}:addons` |

The Workflow class is exported from `worker.ts` (which also re-exports OpenNext's
handler) and bound in `wrangler.jsonc`.

## One-time setup

### 0. Auth
```sh
wrangler login            # or: export CLOUDFLARE_API_TOKEN=...
wrangler whoami           # confirm the babygen/seeourbaby account
```
Account id (from the prior tunnel setup): `2aa9abd7d55ab765ff79dc3000696073`.

### 1. Create the KV namespaces, paste the ids
```sh
wrangler kv namespace create SESSIONS
wrangler kv namespace create META
```
Copy each returned `id` into `wrangler.jsonc`, replacing `REPLACE_WITH_REAL_ID_SESSIONS`
and `REPLACE_WITH_REAL_ID_META`. (A deploy will fail fast while the placeholders remain.)

### 2. Set secrets
```sh
wrangler secret put REPLICATE_API_TOKEN
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET      # see step 4 — create it in Stripe first
```
> `STRIPE_WEBHOOK_SECRET` does not exist anywhere yet — it's created when you add
> the webhook endpoint in Stripe (step 4).

### 3. Set plain vars
Add to `wrangler.jsonc` (a top-level `"vars": { … }`) or as secrets:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_BASE_URL` = `https://seeourbaby.com`
- `PRICE_CENTS` (if used)
- Leave `REAL_GEN` **unset** (default cached mode: sleeps the exact recorded
  duration, serves `/cache/*`, zero Replicate spend). Only set `REAL_GEN=1` for the
  single owner-authorized real run.

### 4. Register the Stripe webhook
In the Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://seeourbaby.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded` (and `checkout.session.completed` if any legacy
  hosted-checkout sessions remain).
- Copy the signing secret → that's the `STRIPE_WEBHOOK_SECRET` from step 2.

### 5. Deploy to workers.dev and smoke-test FIRST
```sh
npm run deploy            # opennextjs-cloudflare build && wrangler deploy
```
On the returned `*.workers.dev` URL, verify (no Replicate spend — keep `REAL_GEN` unset):
- `GET /` → 200, title "See Our Baby".
- `GET /cache/baby1.webp` → 200 (assets shipped).
- `GET /api/events` → 200 JSON (KV reachable).
- `POST /api/payment-intent` with two photos → returns `clientSecret` + `waitSeconds`
  (Stripe **test** key).
- Pay with a Stripe test card → `/success` reveals a cached baby after the exact
  recorded wait; the webhook shows a verified signature in `wrangler tail`.

### 6. Add the custom domains
Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Domains & Routes →
Add custom domain: `seeourbaby.com` and `www.seeourbaby.com` (the zone is already on
this account). Confirm `https://seeourbaby.com/` → 200 through the Worker.

### 7. Cut over and decommission the VPS
Once the custom domain serves 200 from the Worker:
1. Stop the VPS `cloudflared` tunnel and the Next server (`:3000`).
2. Re-`curl https://seeourbaby.com/` → still 200 (proves zero VPS dependency).
Keep the VPS as a hot fallback until the Worker domain is confirmed, then retire it.

## Routine deploys after cutover
```sh
npm run deploy
```
or run the **`/deploy-sob`** skill (preflights secrets/ids, builds, deploys, smoke-tests).

## Local development
```sh
npm run preview           # opennextjs-cloudflare build && wrangler dev  (real workerd + Miniflare KV/Workflow)
npm run dev               # next dev (bindings via the OpenNext dev shim in next.config.ts)
npm run test:e2e          # Playwright (desktop + mobile) against a local wrangler dev
```
Put local secrets in `.dev.vars` (gitignored) — see `.dev.vars.example`.

## Notes / gotchas
- **Workflow idempotency**: the instance id is the token; production Workflows reject
  duplicate ids, so repeated `generate-start`/`generate` fires never double-spend.
  (Miniflare doesn't enforce this locally, so local cached dev may re-run harmlessly.)
- **No R2 / no incremental cache**: the app has no ISR; marketing pages are static
  assets and API routes are `force-dynamic`.
- **Stripe on Workers** uses `Stripe.createFetchHttpClient()` and
  `constructEventAsync` (Workers crypto is async).
