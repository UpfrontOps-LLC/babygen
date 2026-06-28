# BabyGen — End-to-End Launch Plan & Ad-Spend Blockers

**The money chain — every link can block; the loop hardens each:**
`ad approved → click → upload → payment clears → generation → no chargeback/ban → profit → reinvest`

If ANY link breaks, revenue = $0. The biggest break-point is the FIRST link: getting the ad approved at all.

## ⛔ #1 RISK — ad rejection / ad-account block (no approval = the $50 is wasted)
Meta & TikTok aggressively police this category. Pre-empt:
- **Meta "Personal Attributes":** never imply we know the viewer's family/reproductive status. Copy must be playful-hypothetical — "Curious what a baby would look like? 👶" NOT "see YOUR baby" asserted about their life. → maintain a compliant ad-copy variants doc.
- **Entertainment disclaimer (anti "deceptive/unrealistic outcomes"):** prominent "For fun — an AI's imagination, not a real prediction."
- **No before/after framing** in creative (restricted).
- **AI/synthetic-media labeling** on creative + site.
- **Landing-page review:** MUST have visible Privacy Policy + Terms + clear product + support contact. A `*.trycloudflare.com` URL reads as non-permanent → low trust/auto-flag → **a stable domain/host is on the AD critical path** (free named CF tunnel subdomain if no $ for domain yet).
- **New-account scrutiny:** start low + warm up; keep BOTH Meta and TikTok ready so one rejection ≠ dead business.

## ⛔ Legal — biometric/face data (BIPA et al.)
Face processing without consent = statutory damages (IL BIPA $1–5k/violation, class actions; TX/WA too). Mitigate:
- Explicit **biometric/photo consent** at upload.
- **Do not retain** face/biometric data; **delete uploads after generation**; state retention/deletion in the Privacy Policy.
- Bonus: this smooths ad + payment review too.

## Payment — Stripe DISPUTE-RATE risk (NOT a restricted-business issue)
Verified against Stripe's Prohibited & Restricted Businesses list
(stripe.com/restricted-businesses, checked 2026-06-28): an AI novelty / face-image
generator is **NOT prohibited and NOT in any restricted category**. There is no
category flag for this product. (Earlier drafts of this doc overstated this as
"AI/face products get flagged" — that was wrong; corrected here.)

The real risk is **dispute/chargeback rate**, not business type. Cold-traffic
impulse digital buys draw "I don't recognize this charge" / buyer's-remorse
disputes; Stripe + card-network programs (Visa VAMP, Mastercard ECP) act on
accounts that exceed dispute thresholds (~0.65–0.9%) with reserves/holds/closure.
Mitigate:
- **Recognizable statement descriptor** (e.g. `SEEOURBABY`) so buyers recognize the charge.
- Clear product description, **refund policy** (`/refunds`), support email, business identity on-site.
- **Auto-refund borderline disputes**; submit evidence on the rest; keep dispute rate <1%.
- (Legal, separate from Stripe) biometric photos → BIPA consent + deletion (already implemented).

## ✅ Buildable NOW — $0, no Stripe key (the loop's TOP track)
These directly unblock revenue by getting the ad approved:
1. Privacy Policy page (covers photo handling + deletion + biometric consent)
2. Terms of Service page
3. Biometric/photo **consent checkbox** + "we delete your photos after generation" copy
4. "For fun, not a real prediction" + "AI-generated" disclaimers, prominently
5. Support/contact + business identity (Stripe + ad trust)
6. Compliant **ad-copy variants doc** (Meta personal-attributes-safe, no before/after, with disclaimer)
7. Footer links to all the above (reviewers look for them)

## Gated (do later)
- Stable domain/host for ad approval — free named CF tunnel now; `seeourbaby.com` from first revenue.
- Stripe key → granular early-gen + upsells + live paid test.
- $50 → the actual ad test — run ONLY after the above, so it isn't burned on a rejected ad.

## Sequence to first dollar
1. (loop, $0) compliance scaffolding above → ad-approvable site.
2. Free Stripe key → funnel live end-to-end + granular gen.
3. Stable URL (named tunnel) → ad-eligible.
4. $50 → small Meta/TikTok test with compliant copy → measure CAC vs $17.99.
5. Profitable → scale spend + buy domain + wire upsells/video for AOV.
