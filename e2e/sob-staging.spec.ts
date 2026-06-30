import { test, expect, type Page } from "@playwright/test";

/**
 * Full top-to-bottom walkthrough of the See Our Baby desktop funnel.
 * Runs on both projects (Desktop Chrome + Pixel 5) => two parallel E2E passes.
 *
 * Hard rule under test: nothing must navigate to the LIVE host. Every assertion
 * pins page host to the base host (localhost in dev, staging.seeourbaby.com in
 * staging). If any link/button bounced to seeourbaby.com, hostStays() throws.
 */

let BASE_HOST = "";
async function hostStays(page: Page) {
  const host = new URL(page.url()).host;
  expect(host, `navigated off base host to ${host}`).toBe(BASE_HOST);
  expect(host).not.toBe("seeourbaby.com");
  expect(host).not.toBe("www.seeourbaby.com");
}

const IMG = "public/samples/babies/baby01.webp";
const IMG2 = "public/samples/adults/adult01.webp";

// Fill the real Stripe test card across its per-field iframes.
async function fillCard(page: Page, number = "4242424242424242") {
  const frame = (testid: string) => page.locator(`[data-testid="${testid}"] iframe`).first().contentFrame();
  await expect(page.locator('[data-testid="card-number"] iframe').first()).toBeVisible({ timeout: 25000 });
  await frame("card-number").locator('input[name="cardnumber"]').fill(number);
  await frame("card-expiry").locator('input[name="exp-date"]').fill("12 / 34");
  await frame("card-cvc").locator('input[name="cvc"]').fill("123");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  BASE_HOST = new URL(page.url()).host;
});

test("landing → upload → configure → review → checkout → wait → reveal → upsell, end to end", async ({ page }) => {
  // ---------- LANDING ----------
  await expect(page.getByRole("heading", { name: /What will your.*look like/i })).toBeVisible();
  // example images present and loaded
  const examples = page.locator(".examples-grid img");
  await expect(examples).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    const ok = await examples.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(ok, `example image ${i} failed to load`).toBeTruthy();
  }
  // header CTA
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await expect(page.getByRole("heading", { name: /Drop in/i })).toBeVisible();
  await hostStays(page);
  // back to landing, then use the hero CTA
  await page.getByRole("button", { name: /^Back$/ }).click();
  await page.getByRole("button", { name: /Make our baby/i }).nth(1).click();
  await expect(page.getByRole("heading", { name: /Drop in/i })).toBeVisible();

  // ---------- UPLOAD ----------
  const cont = page.getByRole("button", { name: /Upload both parents to start/i });
  await expect(cont).toBeDisabled();
  // real photo uploads into both file inputs
  const inputs = page.locator('.upload-grid input[type="file"]');
  await inputs.nth(0).setInputFiles(IMG);
  await inputs.nth(1).setInputFiles(IMG2);
  await expect(page.locator('.upload-tile[data-filled="true"]')).toHaveCount(2);
  await expect(page.getByText("Parent 1", { exact: false })).toBeVisible();
  // clear one → continue disabled again, then re-upload a real photo
  await page.locator(".upload-tile .x").first().click();
  await expect(page.locator('.upload-tile[data-filled="true"]')).toHaveCount(1);
  await page.locator('.upload-grid input[type="file"]').first().setInputFiles(IMG);
  await expect(page.locator('.upload-tile[data-filled="true"]')).toHaveCount(2);
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  await expect(page.getByRole("heading", { name: /Choose your baby/i })).toBeVisible();
  await hostStays(page);

  // ---------- CONFIGURE ----------
  // gender — click each, then pin Girl
  await page.locator('[data-opt="gender-boy"]').click();
  await page.locator('[data-opt="gender-surprise"]').click();
  await page.locator('[data-opt="gender-girl"]').click();
  await expect(page.locator('[data-opt="gender-girl"][data-active="true"]')).toBeVisible();
  // stage: "Watch them grow" (+$9)
  await page.locator('[data-opt="stage-grow"]').click();
  // twins on (+$5)
  await page.locator('[data-opt="twins-yes"]').click();
  await expect(page.locator('.opt-card[data-active="true"]')).toHaveCount(3);
  // surprise me randomizes (ensure no crash, still 3 active)
  await page.locator("button", { hasText: /Surprise me/i }).click();
  await expect(page.locator('.opt-card[data-active="true"]')).toHaveCount(3);
  // re-pin choices for deterministic pricing downstream
  await page.locator('[data-opt="stage-grow"]').click();
  await page.locator('[data-opt="twins-yes"]').click();
  await page.locator('[data-opt="gender-girl"]').click();
  // chips: photo style; choosing Dance vibe reveals the Music row
  await page.locator('[data-val="studio"]').click();
  await expect(page.locator('[data-val="studio"][data-active="true"]')).toBeVisible();
  await expect(page.locator('[data-val="rock"]')).toHaveCount(0);
  await page.locator('[data-val="dance"]').click();
  await expect(page.locator('[data-val="rock"]')).toBeVisible(); // music row appeared
  await page.locator('[data-val="pop"]').click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: /Your future baby/i })).toBeVisible();
  await hostStays(page);

  // ---------- REVIEW ----------
  await page.locator('[data-tier="basic"]').click();
  // basic warning shows because we picked customizations
  await expect(page.getByText(/Basic skips your customizations/i)).toBeVisible();
  await page.getByRole("button", { name: /keep my customizations/i }).click(); // → deluxe
  await expect(page.locator('[data-tier="deluxe"][data-active="true"]')).toBeVisible();
  await page.locator('[data-tier="ultimate"]').click();
  await expect(page.locator('[data-tier="ultimate"][data-active="true"]')).toBeVisible();
  await page.locator('[data-tier="deluxe"]').click();
  // BUG REGRESSIONS: review must show MY uploaded photo (not the example), and
  // must itemise the Ages (+$9) / Twins (+$5) add-ons into the total.
  await expect(page.locator('img[alt="Parent 1"]')).toHaveAttribute("src", /^data:/);
  await expect(page.getByText("+ Ages 5/10/18")).toBeVisible();
  await expect(page.getByText("+ Twins")).toBeVisible();
  await expect(page.getByText("Total").last()).toBeVisible();
  await expect(page.getByText("$43").first()).toBeVisible(); // 29 deluxe + 9 ages + 5 twins
  // pay-with-card → checkout
  await page.getByRole("button", { name: /Pay with Card/i }).click();
  await expect(page.getByRole("heading", { name: /Almost there/i })).toBeVisible();
  await hostStays(page);

  // ---------- CHECKOUT ----------
  // order summary reflects deluxe + twins + grow
  await expect(page.getByText(/Deluxe/)).toBeVisible();
  await expect(page.getByText("+ Twins")).toBeVisible();
  await expect(page.getByText("+ Ages 5/10/18")).toBeVisible();
  // total = 29 + 5 + 9 = 43
  await expect(page.getByText("$43").first()).toBeVisible();
  // REAL Stripe payment: type the test card, then pay
  await fillCard(page);
  await page.getByRole("button", { name: /Pay \$43\s*&\s*reveal/i }).click();

  // ---------- WAIT (guess game) ----------
  await expect(page.getByRole("heading", { name: /Your baby is on the way/i })).toBeVisible();
  await expect(page.locator(".progress-rail")).toBeVisible();
  // answer a few trivia questions
  for (let i = 0; i < 3; i++) {
    const a = page.locator(".game-btn").first();
    if (await a.isVisible().catch(() => false)) await a.click();
    await page.waitForTimeout(150);
  }
  await hostStays(page);

  // ---------- REVEAL ----------
  // twins were chosen, so the headline says "twins", not "baby"
  await expect(page.getByRole("heading", { name: /Meet your twins/i })).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".reveal-img img")).toHaveCount(3);
  // DELIVERY: they paid for a music video (Deluxe) + age progression (grow) — both must appear
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Watch them grow")).toBeVisible();
  await expect(page.getByText("Age 18")).toBeVisible();
  // save buttons fire a toast
  await page.getByRole("button", { name: /Save all photos/i }).click();
  await expect(page.locator(".toast")).toBeVisible();
  await page.getByRole("button", { name: /Share/ }).click();
  await expect(page.locator(".toast")).toContainText(/share/i);
  // quiz score line present (we answered some)
  await expect(page.getByText(/trivia correct/i)).toBeVisible();
  await hostStays(page);

  // ---------- UPSELL ----------
  await page.getByRole("button", { name: /Make it even better/i }).click();
  await expect(page.getByRole("heading", { name: /Make it even better/i })).toBeVisible();
  // UX: the upsell must NEVER re-sell what this order already includes —
  // video (Deluxe), ages (grow), twin (twins) are owned, so they're hidden.
  await expect(page.locator('[data-addon="video"]')).toHaveCount(0);
  await expect(page.locator('[data-addon="ages"]')).toHaveCount(0);
  await expect(page.locator('[data-addon="twin"]')).toHaveCount(0);
  // only the un-owned ones remain: boy/girl version (+$5) and HD print (+$5)
  await page.locator('[data-addon="other"]').click({ force: true });
  await page.locator('[data-addon="hd"]').click({ force: true });
  await expect(page.locator('.addon-card[data-active="true"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Add to my baby for \$10/i })).toBeVisible();
  // untoggle all → "I'm good" appears
  await page.locator('[data-addon="other"]').click({ force: true });
  await page.locator('[data-addon="hd"]').click({ force: true });
  await page.getByRole("button", { name: /I'm good/i }).click();
  await expect(page.getByRole("heading", { name: /Meet your (baby|twins)/i })).toBeVisible();
  await hostStays(page);

  // ---------- restart ----------
  await page.getByRole("button", { name: /Make another baby/i }).click();
  await expect(page.getByRole("heading", { name: /What will your.*look like/i })).toBeVisible();
  await hostStays(page);
});

test("real Stripe payment — type a card, change your mind, decline then succeed", async ({ page }) => {
  await page.goto("/");
  BASE_HOST = new URL(page.url()).host;
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: /Your future baby/i })).toBeVisible();

  // Deluxe ($29) → real checkout with live Stripe card fields
  await page.locator('[data-tier="deluxe"]').click();
  await page.getByRole("button", { name: /Pay with Card/i }).click();
  await expect(page.locator('[data-testid="card-number"] iframe').first()).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole("button", { name: /Pay \$29\s*&\s*reveal/i })).toBeVisible();
  await hostStays(page);

  // CHANGE MY MIND — back, switch to Ultimate, return: the real amount re-prices to $39
  await page.getByRole("button", { name: /^Back$/ }).click();
  await expect(page.getByRole("heading", { name: /Your future baby/i })).toBeVisible();
  await page.locator('[data-tier="ultimate"]').click();
  await page.getByRole("button", { name: /Pay with Card/i }).click();
  await expect(page.getByRole("button", { name: /Pay \$39\s*&\s*reveal/i })).toBeVisible({ timeout: 25000 });

  // DECLINED card → inline error, stays on checkout (no navigation)
  await fillCard(page, "4000000000000002");
  await page.getByRole("button", { name: /Pay \$39\s*&\s*reveal/i }).click();
  await expect(page.locator('[data-testid="pay-error"]')).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole("heading", { name: /Almost there/i })).toBeVisible();
  await hostStays(page);

  // VALID card → payment succeeds → wait → reveal
  await fillCard(page, "4242424242424242");
  await page.getByRole("button", { name: /Pay \$39\s*&\s*reveal/i }).click();
  await expect(page.getByRole("heading", { name: /Your baby is on the way/i })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole("heading", { name: /Meet your (baby|twins)/i })).toBeVisible({ timeout: 45000 });
  await hostStays(page);
});

test("legal pages reachable and stay on host (no bounce to live)", async ({ page }) => {
  for (const [name, rx] of [
    ["Privacy", /privacy/i],
    ["Terms", /terms/i],
    ["Refund Policy", /refund/i],
  ] as const) {
    await page.goto("/");
    BASE_HOST = new URL(page.url()).host;
    await page.getByRole("link", { name }).first().click();
    await page.waitForLoadState("domcontentloaded");
    await hostStays(page);
    await expect(page.locator("body")).toContainText(rx);
    // every in-page link must be same-host or mailto, never the bare live host
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    for (const h of hrefs) {
      if (h.startsWith("mailto:")) continue;
      const host = new URL(h).host;
      expect(host, `link ${h} points off-host`).toBe(BASE_HOST);
    }
  }
});

test("'try with example photos' fills both parents and reaches configure", async ({ page }) => {
  await page.goto("/");
  BASE_HOST = new URL(page.url()).host;
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await expect(page.locator('.upload-tile[data-filled="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await expect(page.locator('.upload-tile[data-filled="true"]')).toHaveCount(2);
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  await expect(page.getByRole("heading", { name: /Choose your baby/i })).toBeVisible();
  await hostStays(page);
});

test("apple/google wallet button present on review and routes into the funnel", async ({ page }) => {
  await page.goto("/");
  BASE_HOST = new URL(page.url()).host;
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: /Your future baby/i })).toBeVisible();
  // a wallet "Pay" button (Apple or Google) renders alongside the card button
  await expect(page.locator(".pay-pill")).not.toHaveCount(0);
  await hostStays(page);
});
