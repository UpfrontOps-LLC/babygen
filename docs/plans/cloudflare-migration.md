# PLAN — Migrate seeourbaby.com OFF the VPS onto Cloudflare (Workers + Wrangler), deploy, and ship a `/deploy-sob` skill

## Context
seeourbaby.com (the babygen Next.js 16 app) went fully down today because **both** the Next server and the Cloudflare tunnel on this VPS died with no supervisor. I restored it (origin `:3000` + named tunnel `babygen`), so it's live *right now* — but it still depends entirely on this one VPS. The owner's hard requirement: **the site must run on Cloudflare and not depend on this VPS at all.** Then deploy it, and wrap the deploy in a reusable `/deploy-sob` skill.

The app is currently a stateful, long-running Node server: in-memory session store + event bus (`globalThis`), `.data/*` file writes, 100–160s Replicate generation runs, and an SSE monitor. None of that survives on stateless Workers as-is, so the migration is mostly about moving state to Cloudflare primitives.

**Verified facts (not assumed):**
- `@opennextjs/cloudflare` officially supports Next.js 16.x (our version 16.2.9). Requires `nodejs_compat` flag + compat date ≥ 2024-09-23. Edge runtime not supported — we use `nodejs` everywhere already (good).
- Workers have **no hard wall-clock limit while the client stays connected** (CPU capped at 5 min; awaiting Replicate is I/O, not CPU). But post-response background work only gets 30s (`waitUntil`) — which breaks the current "fire-and-forget early-gen" pattern.
- No `middleware.ts`/proxy file exists, so the one known Next-16 OpenNext issue (route config in Proxy files) does not apply.
- `sharp` is a dependency but **unused in `src/`** → remove it (native binary, won't bundle for Workers).

**Owner decisions (this session):**
- Durable generation engine = **Cloudflare Workflows** (a paid generation always completes even if the customer drops; reveal picks it up on reload).
- The `/monitor` tool is not important → downgrade to trivial KV polling so it doesn't block the build; no Durable Object.

**Hard rule preserved:** real Replicate gen runs ONLY when explicitly enabled (`REAL_GEN=1`); default is cached mode that sleeps the EXACT recorded duration. The Workflow honors both gates identically.

## Target architecture on Cloudflare
- **OpenNext Worker** = the whole Next.js app (SSR + API routes + static assets). Deployed via `wrangler deploy`.
- **KV namespace `SESSIONS`** = token → entry `{tier, bump, paid, status, images?, video?, ages?, createdAt}` (replaces `globalThis.__babyStore`), with TTL. Parent photos held only transiently for the Workflow input.
- **KV namespace `META`** = webhook-event dedup (TTL) + `gen-timing` (replaces `.data/gen-timing.json`) + recent events for `/monitor` (replaces `.data/events.ndjson` + the in-memory ring).
- **Cloudflare Workflow `GenerateBaby`** = durable pipeline: 3 images → optional video → optional ages, each a retryable step. Cached gate sleeps `recordedSeconds(tier,bump)` via a Workflow `sleep`; real gate calls Replicate. Writes results into `SESSIONS[token]` as steps complete.
- **Static assets** = `public/cache/*` (~187KB), `public/examples/*`, `public/people|samples/*` ship with the Worker (OpenNext serves `public/`). No R2 needed.
- **Secrets (Worker secrets via `wrangler secret put`):** `REPLICATE_API_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (NOTE: currently absent from `.env.local` — must be created in Stripe and set), and plain vars `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL` (→ `https://seeourbaby.com`), `PRICE_CENTS`.
- **DNS cutover:** repoint `seeourbaby.com` + `www` from the tunnel CNAME to the Worker (Workers custom domain on the existing CF zone), then stop the VPS tunnel + Next server. Account: `2aa9abd7d55ab765ff79dc3000696073`.

## Work plan

### 1. Scaffold OpenNext + Wrangler (no behavior change yet)
- Add `@opennextjs/cloudflare` + `wrangler` (dev), create `wrangler.jsonc` (`nodejs_compat`, compat date, KV bindings, Workflow binding, assets) and `open-next.config.ts`.
- Remove unused `sharp` from `package.json`.
- Add scripts: `preview` (`opennextjs-cloudflare build && wrangler dev`), `deploy` (`opennextjs-cloudflare build && wrangler deploy`).
- Verify a clean `opennextjs-cloudflare build` succeeds against Next 16 before touching state.

### 2. Replace VPS-only state with Cloudflare bindings
Bindings are reached in route handlers via OpenNext's `getCloudflareContext()`.
- **`src/lib/store.ts`** → KV-backed async API (`putParents`, `getEntry`, `markPaid`, `setImages/Video/Ages`, `clearParents`, `claimEvent` dedup, `claimGenerate`). Same function names/shape; callers switch to `await`.
- **`src/lib/gen-timing.ts`** → `recordedSeconds`/`recordTiming` read/write KV `META` instead of `readFileSync`/`writeFileSync`.
- **`src/lib/events.ts`** → `emit` appends a capped recent-events list to KV `META`; drop the `globalThis` ring + subscriber set.
- **`src/app/api/track/route.ts`** → append events to KV instead of `.data/events.ndjson`.

### 3. Move generation into the Workflow
- New `src/workflows/generate-baby.ts` (Cloudflare Workflow): steps wrap the existing logic in `src/lib/generate.ts` (`runPipeline`, `generateAddons`) — cached `sleep` vs real Replicate, gated by `REAL_GEN`. Each Replicate call is its own retryable step. Results written to `SESSIONS[token]` per step.
- **`/api/generate-start`** → create/ensure a Workflow instance for the token (idempotent via `claimGenerate` in KV), return immediately. Replaces the un-awaited background promise.
- **`/api/generate`** → verify PaymentIntent succeeded + token match, ensure the Workflow is running, then poll `SESSIONS[token]` for results (client connection stays open; no hard limit). On success-page reload it re-polls and picks up completed results — durability win.
- **`/api/upsell`** → charge saved card off-session, then run add-ons as Workflow steps (same pattern).

### 4. Stripe + webhook on Workers
- Configure the Stripe SDK with the Workers fetch HTTP client (`Stripe.createFetchHttpClient()` + `httpClient`), and use **`constructEventAsync`** in `src/app/api/webhooks/stripe/route.ts` (Workers crypto is async). Set up the `STRIPE_WEBHOOK_SECRET` and register the live webhook endpoint at `https://seeourbaby.com/api/webhooks/stripe`.

### 5. Monitor downgrade (minimal)
- `src/app/api/events/stream/route.ts` (SSE) → delete or stub. `/api/events` returns the KV recent-events snapshot. `src/app/monitor/page.tsx` polls `/api/events` every ~2s. Low effort; non-critical.

### 6. Deploy + verify on workers.dev, THEN cut over
- `npm run deploy` → app live on the `*.workers.dev` URL. Smoke-test there first (home 200, payment-intent creates a PI with Stripe **test** key, cached generate returns a baby after the exact recorded wait, webhook signature verifies). **No Replicate spend** — `REAL_GEN` stays unset.
- Add `seeourbaby.com` + `www` as Workers Custom Domains on the CF zone; confirm `200` through the domain.
- **Cut over:** stop the VPS `cloudflared` tunnel + Next server. Confirm the site stays up purely on Workers. VPS is now decommissioned from the critical path.

### 7. `/deploy-sob` skill (via `/skills`)
- Create a project skill `deploy-sob` that: (a) sanity-checks required secrets/vars are set in Cloudflare, (b) runs `opennextjs-cloudflare build`, (c) `wrangler deploy`, (d) post-deploy smoke test (curl `https://seeourbaby.com/` expects 200 + title, hits `/api/payment-intent` for a PI), (e) reports the deployed version. One command to ship future changes — no VPS, no manual steps.

## Key files
- New: `wrangler.jsonc`, `open-next.config.ts`, `src/workflows/generate-baby.ts`, the `deploy-sob` skill dir.
- Changed: `src/lib/store.ts`, `src/lib/gen-timing.ts`, `src/lib/events.ts`, `src/lib/generate.ts`, `src/app/api/{generate,generate-start,upsell,track,events,webhooks/stripe}/route.ts`, `src/app/api/payment-intent/route.ts`, `src/app/monitor/page.tsx`, `package.json`, `next.config.ts` (if OpenNext needs tweaks).
- Deleted: `src/app/api/events/stream/route.ts` (SSE), `sharp` dep, `.data/` reliance.

## Verification
- `opennextjs-cloudflare build` clean on Next 16.
- workers.dev smoke test green (home, payment-intent w/ Stripe test key, cached generate = exact recorded duration, webhook verifies) — zero Replicate spend.
- `seeourbaby.com` returns 200 through the Workers custom domain.
- After cutover: stop VPS tunnel + server, re-curl `seeourbaby.com` → still 200 (proves zero VPS dependency).
- `/deploy-sob` runs end-to-end and the smoke test passes.

## Risks / notes
- Next 16 + OpenNext is new; if `opennextjs-cloudflare build` hits the Proxy-architecture issue despite no middleware, fallback is pinning a known-good OpenNext version or a minor Next patch — decided at build time, not assumed.
- `STRIPE_WEBHOOK_SECRET` is not currently set anywhere; fulfillment via webhook needs it created in Stripe + set as a Worker secret.
- DNS cutover is the only brief-blip moment; doing it after workers.dev is verified keeps risk minimal, and the VPS can stay running as a hot fallback until the Worker domain is confirmed, then be stopped.
