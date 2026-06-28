# BabyGen — Build Queue

## 🔑 GATE: everything below needs babygen's OWN Stripe key (free to create)
1. Create a Stripe account → Developers → API keys.
2. Paste `sk_test_…` into `/opt/babygen/.env.local` as `STRIPE_SECRET_KEY=` (also set `NEXT_PUBLIC_BASE_URL` to the live URL).
3. Restart: `fuser -k 3000/tcp; cd /opt/babygen && PORT=3000 npm run start &`
Then execute the queue ↓

## 1. ⭐ GRANULAR EARLY-GENERATION (user-requested) — hide the ~30s wait
Start generation at the "CVV entered" moment so the wait overlaps the payment, with minimal abandon-COGS.
- Switch hosted Checkout (redirect) → **Stripe Payment Element** on our page.
  - `npm i @stripe/stripe-js @stripe/react-stripe-js`
  - New `POST /api/payment-intent`: stores the two parent photos under a token (like checkout does today) + creates a PaymentIntent (amount=PRICE, `metadata.token`) → returns `client_secret` + token.
- Client mounts `<PaymentElement/>`; listen:
  ```js
  paymentElement.on("change", (e) => { if (e.complete && !started.current) { started.current = true; fetch("/api/generate-start", {method:"POST", body: JSON.stringify({token})}); } });
  ```
  `e.complete === true` = card # + expiry + **CVC** all valid → the granular "typing CVV done" signal.
- New `POST /api/generate-start {token}`: begins generation from stored parents, stores images under token. Idempotent. (Speculative — fired pre-confirm.)
- On Pay click → `stripe.confirmPayment(...)` → on success go to `/success?token=…&payment_intent=…`.
- `/success`: show the entertaining wait if images aren't ready yet; **release images ONLY after verifying the PaymentIntent status === "succeeded"** (server pay-gate stays — early gen sits ready, never delivered unpaid).
- Accept ~5–10% abandon-COGS (filled full card then bailed) as the cost of a near-zero felt wait.

## 2. Wire the upsell ladder (currently stubbed on /success)
video (+$7) / age-progression (+$9) / boy-girl (+$5) / twins (+$5) / HD (+$5). Each = its own PaymentIntent → post-pay re-generation (image via nano-banana-pro; video via seedance-1-lite — both proven).

## 3. Prod-grade store
Replace in-memory `src/lib/store.ts` Map with KV / Supabase (survives restarts + serverless; required before scaling traffic).

## 4. Stable URL
Current `*.trycloudflare.com` is ephemeral (dies on restart). Stand up a **named Cloudflare Tunnel** on the CF account/VPS for a persistent URL before the ad test.

## 5. Ad creative
Generate 3–4 baby-giggle demo clips (seedance-1-lite) for the Meta/TikTok cold-ad creative (video-led).

## 6. Domain
Buy `seeourbaby.com` from first revenue → point DNS at the tunnel.

## 7. The $50 cold-ad test
The real CAC/break-even verdict. Start small, scale only if it breaks even (your bootstrapped model).

---
## ✅ Done (verified)
- Core engine proven: `nano-banana-pro` (2 faces → baby image), `seedance-1-lite` (baby image → giggle video). Artifacts delivered.
- **Pay-first funnel** (zero pre-pay COGS): upload → $0 teaser card → pay → **post-pay** generate (~30s, entertaining wait: progress + staggered questions + facts) → reveal + upsell stubs.
- Server pay-gate: generation refuses to run, and images refuse to release, without a Stripe-verified payment.
- Live on a free Cloudflare quick-tunnel; builds clean.
- Measured live generation: ~30s (29.9s gen + 0.7s teaser/download).
