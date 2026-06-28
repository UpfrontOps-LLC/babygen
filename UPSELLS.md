# BabyGen — Upsell Flows & A/B Test Matrix (the money layer)

**North metric: Revenue Per Visitor (RPV = conversion × AOV).** Not conversion alone.
Strike at **peak emotion = the instant after the reveal**, card on file → one-click upsells convert highest.

## Add-on products (each = a paid re-generation; COGS ~$0.13 image / ~$0.30 video → fat margin)
| Add-on | Price | COGS | Notes |
|---|---|---|---|
| Giggle video (5s) | $7–9 | ~$0.30 | seedance-1-lite (proven) |
| Age progression (5/10/18) | $9–12 | ~$0.40 | "watch them grow" |
| Boy/girl (other gender) | $5 | ~$0.13 | |
| Twins / sibling | $5 | ~$0.26 | |
| HD + printable pack | $5–9 | ~$0 | upscale of owned image |
| Personality report (text) | $5 | ~$0 | LLM text only |
| Name suggestions (text) | $3 | ~$0 | LLM text only |
| Physical print / canvas (POD) | $19–39 | varies | fulfillment; later |

## Flows to build + A/B test
1. **Order bump (pre-pay):** checkbox on checkout — "+ giggling video $7." Lifts AOV at payment, ~0 friction.
2. **Good-better-best paywall:** Basic $17.99 (3 imgs) / Deluxe $29 (+video) / Ultimate $49 (+video+ages+HD). Anchor high; mid = target.
3. **Post-purchase 1-click OTO ladder** (Stripe saved card, off-session): OTO1 ages $9 → declined → downsell $5; OTO2 twins/family $5; OTO3 HD $5. One-click = peak take-rate.
4. **Bundle vs à la carte:** "Everything $29" vs pick-individual.
5. **Share-for-discount (viral):** "share your baby → $3 off the video" — AOV + free reach (AITA angle).
6. **Subscription (test, likely weak):** "unlimited babies $19/mo" — novelty=one-time intent; small test only.

## A/B test matrix (measure RPV)
- Front-end model: flat $17.99 + upsells **vs** good-better-best tiers
- Front price: $9.99 / $14.99 / $17.99 / $19.99
- Order bump: on / off
- OTO-1 offer: video vs age-progression vs HD (compare take-rates)
- OTO ladder length: 1-step vs 3-step (annoyance vs AOV)
- Bundle $29 vs à la carte
- Urgency/anchor copy: countdown + crossed-out price vs none

## ✅ Buildable NOW ($0, no Stripe key) — loop can do these
- Upsell/OTO screen UIs, good-better-best tier selector, order-bump checkbox UI, share-for-discount UI.
- **A/B harness:** assign a variant per visitor (cookie/localStorage), render it, log `{variant, step, action, ts}` to `/api/track` (append to a JSON file for now). Lets us wire real revenue attribution the moment Stripe is in.

## 🔒 Stripe-gated (wire when STRIPE_SECRET_KEY present)
- Real charges: order-bump line item, tier prices, **post-purchase one-click OTO** via saved payment method / off-session PaymentIntent.
- True RPV (needs real payments). Until then the A/B harness logs intent/clicks as a proxy.

## Recommendation (highest RPV, ship first)
Good-better-best paywall + order bump + a 2-step one-click OTO ladder (ages → HD), A/B'd against flat-$17.99+upsells. Optimize RPV, not conversion.
