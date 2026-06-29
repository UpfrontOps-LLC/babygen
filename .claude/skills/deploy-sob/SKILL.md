---
name: deploy-sob
description: Deploy seeourbaby.com (the babygen Next.js app) to Cloudflare Workers via OpenNext + Wrangler. Use when the user wants to ship/deploy/release seeourbaby or babygen, run "deploy-sob", or push the latest changes live to Cloudflare. Builds, deploys, and smoke-tests in one go.
---

# Deploy seeourbaby.com to Cloudflare Workers

One command to ship the site. No VPS, no manual steps. The app runs entirely on
Cloudflare Workers (OpenNext) with KV (`SESSIONS`, `META`) and the `GenerateBaby`
Workflow. This skill builds, deploys, and verifies.

## Preconditions (first deploy only — see DEPLOY_CLOUDFLARE.md)

These are one-time. If a deploy fails the preflight, point the user at
`DEPLOY_CLOUDFLARE.md`.

- `wrangler whoami` succeeds (run `wrangler login`, or `CLOUDFLARE_API_TOKEN` is set).
- KV namespaces exist and their ids are pasted into `wrangler.jsonc`
  (the placeholders `REPLACE_WITH_REAL_ID_*` must be gone).
- Secrets are set: `wrangler secret list` shows `REPLICATE_API_TOKEN`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Plain vars are in `wrangler.jsonc` `vars` (or set as secrets):
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL=https://seeourbaby.com`,
  `PRICE_CENTS`. `REAL_GEN` stays UNSET (cached mode) unless the owner is doing
  the single authorized real run.

## Steps

1. **Preflight.** From the repo root:
   - `wrangler whoami` — confirm authenticated.
   - Grep `wrangler.jsonc` for `REPLACE_WITH_REAL_ID` — if found, STOP and tell the
     user to create KV namespaces and paste ids (DEPLOY_CLOUDFLARE.md).
   - `wrangler secret list` — confirm the three secrets above are present. If any
     are missing, STOP and report which.

2. **Build + deploy.** `npm run deploy`
   (= `opennextjs-cloudflare build && wrangler deploy`). Capture the deployed
   Version ID and the `*.workers.dev` / custom-domain URL from the output.

3. **Smoke test** the deployed URL (default `https://seeourbaby.com`, override with
   `$DEPLOY_URL`):
   - `curl -s -o /dev/null -w "%{http_code}" "$URL/"` → expect `200`.
   - `curl -s "$URL/" | grep -q "See Our Baby"` → title/copy present.
   - `curl -s -o /dev/null -w "%{http_code}" "$URL/api/events"` → `200` (KV reachable).
   - Confirm a static asset: `curl -s -o /dev/null -w "%{http_code}" "$URL/cache/baby1.webp"` → `200`.
   - Do NOT trigger real generation (would spend Replicate). The cached path is the default.

4. **Report**: deployed Version ID, the live URL, and the smoke-test results. If any
   check fails, surface the failing curl output verbatim and stop.

## Notes
- `REAL_GEN` must stay unset for normal deploys — default cached mode sleeps the
  exact recorded duration and serves `/cache/*` (zero Replicate spend).
- DNS cutover (pointing `seeourbaby.com` at the Worker) and stopping the old VPS
  tunnel are one-time steps in `DEPLOY_CLOUDFLARE.md`, not part of routine deploys.
