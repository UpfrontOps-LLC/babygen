# 10DLC / A2P SMS Registration — seeourbaby.com (babygen)

Carrier: **Twilio** + **The Campaign Registry (TCR)**.
Brand legal entity: **UpfrontOps LLC**. Website: **https://seeourbaby.com**.

This doc has three parts:
1. **Registration answers** (Brand + Campaign fill-in for TCR/Twilio).
2. **Copy-ready website blocks** (opt-in CTA, Privacy clauses, Messaging Terms).
3. **What carriers check** (the standard, with sources).

> Items marked **[USER FILL]** require info only the operator has (EIN, address, support contact). Everything else is ready to submit.

---

## PART 1 — REGISTRATION ANSWERS

### 1A. Brand registration (TCR Brand)

| Field | Value |
|---|---|
| Legal company name | **UpfrontOps LLC** |
| Business type / legal form | Limited Liability Company (LLC) — *Private Profit* |
| Country of registration | United States |
| EIN / Tax ID (US) | **[USER FILL]** (9-digit EIN — must match IRS records exactly) |
| DBA / brand name | SeeOurBaby (or UpfrontOps LLC, if no registered DBA — **[USER FILL] confirm**) |
| Business address (street, city, state, ZIP) | **[USER FILL]** (must match EIN registration) |
| Website | https://seeourbaby.com |
| Vertical / industry | Technology / Consumer Software (closest TCR vertical; alt: "PROFESSIONAL"). **Pick "Technology"** at registration. |
| Support email | **[USER FILL]** (e.g., support@seeourbaby.com) |
| Support phone | **[USER FILL]** |
| Brand contact first/last name | **[USER FILL]** |
| Stock exchange / ticker | N/A (private) |

> EIN + legal name + address must match IRS/Secretary-of-State records **exactly** or the brand fails verification (and Standard/vetted throughput is denied). This is the #1 brand-level rejection cause.

### 1B. Campaign registration (TCR Campaign)

**Recommended use case: `Mixed`** — combine **Marketing** + **Account Notification** (and **Delivery Notification**).
Rationale: babygen sends (a) transactional order/generation/result-ready notifications **and** (b) promotional offers. A single-use-case Marketing or Customer Care campaign would not cover both; TCR's `Mixed` use case is defined as "any messaging campaign containing 2 to 5 standard use cases." Select sub-use-cases: **Marketing**, **Account Notification**, **Delivery Notification**.
(If volume is initially tiny and you want lower cost/throughput, `Low Volume Mixed` carries the same sub-use-case rules but caps at ~49 numbers / 2,000 msgs per day.)

| Field | Value |
|---|---|
| Use case | **Mixed** |
| Sub-use cases | Marketing, Account Notification, Delivery Notification |
| Campaign description | `SeeOurBaby (UpfrontOps LLC) sends customers transactional updates about their AI baby photo/video orders — order confirmation, when their generated images/videos are ready to view, and account notices — plus occasional promotional offers and discounts. All recipients are existing customers who provided their mobile number and consented at checkout on seeourbaby.com.` |
| Message flow / How do end users consent? (Call-to-Action description) | `Consent is collected on seeourbaby.com at the point of purchase/checkout. The customer enters their mobile number and checks an unchecked opt-in box that reads: "I agree to receive recurring automated text messages (order updates, results, and offers) from SeeOurBaby at the number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to cancel, HELP for help." The box is not pre-checked. The disclosure links to the Terms (https://seeourbaby.com/terms) and Privacy Policy (https://seeourbaby.com/privacy). Opt-in data is never shared with or sold to third parties.` |
| Privacy Policy URL | `https://seeourbaby.com/privacy` **(required field — must be live before submit)** |
| Terms & Conditions URL | `https://seeourbaby.com/terms` **(required field — must be live before submit)** |
| Embedded link in messages? | **Yes** (links to seeourbaby.com to view results / claim offers). Use your own brand domain — **no public URL shorteners** (bit.ly etc. are auto-rejected). |
| Embedded phone number in messages? | No (recommend No unless you add a support line). |
| Age-gated content? | No |
| Direct lending / loan arrangement? | No |
| Subscriber opt-in? | **Yes** |
| Subscriber opt-out? | **Yes** |
| Subscriber help? | **Yes** |
| Opt-in keywords | (optional, for keyword opt-in) `START`, `SUBSCRIBE` |
| Opt-in confirmation message | `SeeOurBaby: You're subscribed to order updates & offers. Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel.` |
| Opt-out keywords | `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` |
| Opt-out (STOP) reply | `SeeOurBaby: You're unsubscribed and will get no further messages. Reply START to resubscribe.` |
| Help keywords | `HELP`, `INFO` |
| Help (HELP) reply | `SeeOurBaby help: support@seeourbaby.com. Msg & data rates may apply. Msg frequency varies. Reply STOP to cancel.` |

> STOP/HELP keywords and replies are handled automatically by Twilio's **Advanced Opt-Out** by default; keep the defaults unless you need custom copy.

### 1C. Sample messages (2–3, compliant, include opt-out)

Provide all three — they must reflect each sub-use-case.

1. **(Account/Delivery — results ready)**
   `SeeOurBaby: Your AI baby photos are ready! View them here: https://seeourbaby.com/r/AB12CD Reply HELP for help, STOP to unsubscribe.`

2. **(Account — order confirmation)**
   `SeeOurBaby: Thanks for your order! We're generating your baby photos & video now and will text you when they're ready. Reply STOP to opt out, HELP for help.`

3. **(Marketing — promo)**
   `SeeOurBaby: Flash sale 🎉 Get 30% off your next AI baby video this weekend: https://seeourbaby.com/offer Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help.`

> Every sample includes brand name + opt-out. At least one marketing sample carries "Msg & data rates may apply" + "Msg frequency varies." Sample messages must match the actual content you send or the campaign is rejected.

---

## PART 2 — COPY-READY WEBSITE BLOCKS

> A **visible opt-in mechanism is required** (not just policy text). Carriers/TCR want either (a) a web form with an **un-pre-checked** consent checkbox at the point you collect the phone number, or (b) a documented keyword/verbal flow. For a pay-first DTC checkout, use the checkbox.

### 2A. Checkout opt-in CTA (place next to the phone-number field; checkbox UNCHECKED by default)

```
☐ I agree to receive recurring automated marketing and order-update text
  messages (e.g., order confirmations, "your results are ready," and special
  offers) from SeeOurBaby at the mobile number provided. Consent is not a
  condition of purchase. Msg & data rates may apply. Msg frequency varies.
  Reply STOP to cancel, HELP for help. See our Terms (link) and Privacy Policy (link).
```

- Checkbox MUST be empty/unchecked by default and user-selectable.
- "Terms" → https://seeourbaby.com/terms ; "Privacy Policy" → https://seeourbaby.com/privacy
- Keep this exact disclosure text in screenshots you may need to submit to carriers.

### 2B. Privacy Policy — SMS section (add verbatim to https://seeourbaby.com/privacy)

```
SMS / Text Messaging

When you provide your mobile phone number and opt in at checkout, SeeOurBaby
(operated by UpfrontOps LLC) uses it to send you recurring automated text
messages about your orders (order confirmations, generation/results-ready
notifications, and account notices) and, where you have consented, promotional
offers.

No mobile information will be shared with, sold, rented, or otherwise disclosed
to third parties or affiliates for their marketing or promotional purposes at
any time. We do not sell or share your SMS opt-in consent or phone number with
any third party for marketing. Phone numbers may be shared only with our
messaging service providers (e.g., Twilio) strictly to deliver the messages you
have requested, and as required by law.

Message frequency varies. Message and data rates may apply. You can opt out at
any time by replying STOP to any message; reply HELP for help or contact us at
[USER FILL: support@seeourbaby.com]. Carriers are not liable for delayed or
undelivered messages.
```

> The bolded-in-substance line carriers look for is: **"No mobile information will be shared with… third parties… for marketing… at any time"** and **"we do not sell or share … SMS opt-in … for marketing."** Both are present above. Keep them on a publicly reachable URL (no login wall).

### 2C. Messaging Terms (add to https://seeourbaby.com/terms, or a /sms-terms page linked from it)

```
SMS Terms of Service

1. Program. By opting in, you agree to receive recurring automated marketing
   and transactional text messages (order updates, results-ready alerts, and
   offers) from SeeOurBaby (UpfrontOps LLC).

2. Cost. Message and data rates may apply.

3. Frequency. Message frequency varies.

4. Opt-out. Reply STOP to any message to unsubscribe at any time. After you send
   STOP, we will send one confirmation message and then stop.

5. Help. Reply HELP for help, or email [USER FILL: support@seeourbaby.com].

6. Carriers. Supported carriers include AT&T, T-Mobile, Verizon, and others.
   Carriers are not liable for delayed or undelivered messages.

7. Privacy. See our Privacy Policy at https://seeourbaby.com/privacy. We do not
   sell or share your mobile information with third parties for marketing.

8. Eligibility. You must be the account holder or have authority to consent for
   the mobile number provided, and be 18+.
```

---

## PART 3 — WHAT CARRIERS / TCR CHECK (sourced requirements summary)

Tag: **[OFFICIAL]** = carrier/registry/CTIA/Twilio primary doc · **[PRACTITIONER]** = aggregator/help guide.

**Consent & CTA**
- Express written consent required whenever/wherever you collect a mobile number; consent applies only to the purpose obtained and **cannot be sold/transferred**. [OFFICIAL] CTIA Messaging Principles & Best Practices.
- CTA must show: program/brand name, message-frequency disclosure (e.g., "Msg frequency varies"), **"Message and data rates may apply"** (mandatory for web opt-in), "Reply STOP to cancel," and links to **Terms** and **Privacy Policy**. [OFFICIAL] Twilio A2P approval guidance.
- Web opt-in must be a **standalone, not-pre-selected, user-selectable checkbox** at the point of phone collection. [OFFICIAL] Twilio.

**Privacy Policy**
- Must "confirm that the mobile information of the end user opting in to the message program will never be shared or sold to third parties." Carriers specifically look for a clause like "No mobile data will be shared with third parties/affiliates for marketing/promotional purposes at any time." Must be public, easy to locate, up to date. [OFFICIAL] Twilio.
- A publicly accessible privacy policy is a prerequisite for accessing carrier networks; describe collection, use, protection, and the no-sale-of-mobile-info statement. [OFFICIAL] CTIA → carrier requirement.

**Terms**
- Terms must be linked/provided: nature of messages, frequency, possible carrier charges, STOP/HELP instructions, supported-carriers disclaimer. [OFFICIAL] CTIA + Twilio.

**Required campaign fields (TCR schema)**
- Use case (incl. **Mixed** = "any messaging campaign containing 2 to 5 standard use cases"; **Low Volume Mixed** same with low throughput cap). [OFFICIAL] TCR use-case list (Twilio mirror).
- Campaign description; **2+ sample messages** matching actual content; consent/message-flow description; opt-in keywords + confirmation; opt-out keywords + reply; help keywords + reply; embedded-link (yes/no); embedded-phone (yes/no). [OFFICIAL] Twilio quickstart + TCR CSP User Manual.
- **As of June 30, 2026:** `PrivacyPolicyUrl` and `TermsAndConditionsUrl` are **required fields** on new campaign submissions via Twilio's Messaging REST API (`POST /v1/Services/{MessagingServiceSid}/Compliance/Usa2p`); both must be valid, publicly accessible URLs. Missing → rejected. [OFFICIAL] Twilio changelog.

**Brand fields**
- Legal entity name, business type, EIN/Tax ID, address, vertical, website, contact — EIN + legal name + address must match IRS records for verification. [OFFICIAL] Twilio quickstart / TCR.

**Common rejection causes**
- Message flow / consent description is where most rejections happen; reviews ~10–15 days. Public URL shorteners in sample messages are rejected. [OFFICIAL] Twilio + [PRACTITIONER].

---

## Sources

**Official**
- Twilio — Improving Your Chances of A2P 10DLC Registration Approval: https://www.twilio.com/en-us/blog/insights/best-practices/improving-your-chances-of-a2p10dlc-registration-approval
- Twilio — A2P 10DLC registration application quickstart: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart
- Twilio — Programmable Messaging and A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Twilio changelog — Privacy Policy & Terms URLs required (June 30, 2026): https://www.twilio.com/en-us/changelog/a2p-10dlc-campaign-registration-will-require-privacy-policy-and-
- Twilio changelog — Compliance Fields for US A2P 10DLC: https://www.twilio.com/en-us/changelog/-u-s--a2p-10dlc--campaign-registration---privacy-policy---terms-
- Twilio — A2P 10DLC Campaign Approval Requirements (Help Center): https://help.twilio.com/articles/11847054539547-A2P-10DLC-Campaign-Approval-Requirements
- Twilio — List of campaign use case types: https://help.twilio.com/articles/1260801844470-List-of-campaign-use-case-types-for-A2P-10DLC-registration
- CTIA — Messaging Principles and Best Practices (PDF): https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf
- CTIA — Messaging channel: https://www.ctia.org/messaging-channel
- The Campaign Registry — CSP User Manual (PDF): https://www.campaignregistry.com/Assets/TCR-CSP-User-Manual_Doc_V6.pdf

**Practitioner (cross-check only)**
- net2phone Canada — 10DLC Campaign Types with Descriptions: https://academy.net2phone.ca/sms-messages/10dlc-campaign-types-with-descriptions-and-examples
- HighLevel — A2P 10DLC Campaign Use Cases: https://help.gohighlevel.com/support/solutions/articles/155000000235-a2p-10dlc-campaign-use-cases
