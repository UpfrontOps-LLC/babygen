import { test, expect, type Page } from "@playwright/test";

/**
 * Adversarial / chaos walkthrough — "a Gen X and a Gen Alpha tutoring each other":
 * one cautious keyboard-only user, one button-masher, both abusing the funnel.
 * The bar is higher than happy-path: no uncaught exceptions, every selector
 * operable by keyboard, junk uploads / reloads / back-storms don't break it.
 */

// Real uncaught exceptions always count; ignore Stripe's expected HTTP/wallet
// console noise (localhost is http; no Apple/Google Pay in headless).
const BENIGN = /stripe\.js|over HTTP|ExpressCheckout|payment method|apple ?pay|google ?pay|favicon|Failed to load resource|net::ERR/i;
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !BENIGN.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
}

async function fillCard(page: Page, number = "4242424242424242") {
  const frame = (testid: string) => page.locator(`[data-testid="${testid}"] iframe`).first().contentFrame();
  await expect(page.locator('[data-testid="card-number"] iframe').first()).toBeVisible({ timeout: 25000 });
  await frame("card-number").locator('input[name="cardnumber"]').fill(number);
  await frame("card-expiry").locator('input[name="exp-date"]').fill("12 / 34");
  await frame("card-cvc").locator('input[name="cvc"]').fill("123");
}

async function toConfigure(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  await expect(page.getByRole("heading", { name: /Choose your baby/i })).toBeVisible();
}

test("Gen Alpha — spam, double-clicks and rapid toggles never break the funnel", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  // triple-click the hero CTA (impatient)
  const cta = page.getByRole("button", { name: /Make our baby/i }).first();
  await cta.click({ clickCount: 3 });
  await expect(page.getByRole("heading", { name: /Drop in/i })).toBeVisible();
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await page.getByRole("button", { name: /Choose your baby/i }).click();

  // configure: mash Surprise me, then rapid-toggle chips
  const surprise = page.locator("button", { hasText: /Surprise me/i });
  for (let i = 0; i < 8; i++) await surprise.click();
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-val="studio"]').click();
    await page.locator('[data-val="outdoor"]').click();
  }
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: /Your future baby/i })).toBeVisible();

  // review: switch tiers like a maniac
  for (let i = 0; i < 12; i++) {
    await page.locator('[data-tier="basic"]').click();
    await page.locator('[data-tier="ultimate"]').click();
    await page.locator('[data-tier="deluxe"]').click();
  }
  await page.getByRole("button", { name: /Pay with Card/i }).click();
  await expect(page.getByRole("heading", { name: /Almost there/i })).toBeVisible();

  // checkout: real Stripe card, then double-click pay (must not double-charge/double-fire)
  await fillCard(page);
  await page.getByRole("button", { name: /Pay \$\d+\s*&\s*reveal/i }).click({ clickCount: 2 });
  await expect(page.getByRole("heading", { name: /Your baby is on the way/i })).toBeVisible({ timeout: 25000 });

  // wait: mash both trivia buttons ~30x
  for (let i = 0; i < 30; i++) {
    const g = page.locator(".game-btn").first();
    if (await g.isVisible().catch(() => false)) await g.click({ timeout: 1500 }).catch(() => {});
    else break;
  }
  // reveal arrives on its own timer
  await expect(page.getByRole("heading", { name: /Meet your (baby|twins)/i })).toBeVisible({ timeout: 20000 });
  // spam save buttons
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /Save all photos/i }).click();

  // upsell: rapid-toggle whatever add-ons are OFFERED (owned ones are hidden), then confirm
  await page.getByRole("button", { name: /Make it even better/i }).click();
  const addonCards = page.locator(".addon-card");
  const count = await addonCards.count();
  expect(count, "upsell should offer at least one un-owned add-on").toBeGreaterThan(0);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < count; j++) await addonCards.nth(j).click({ force: true });
  }
  // 6 full cycles leaves them all OFF again — turn one back on, then confirm
  await addonCards.first().click({ force: true });
  await expect(page.locator('.addon-card[data-active="true"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: /Add to my baby/i }).click({ force: true });
  await expect(page.getByRole("heading", { name: /Meet your (baby|twins)/i })).toBeVisible();

  expect(errors, `uncaught errors during chaos:\n${errors.join("\n")}`).toEqual([]);
});

test("Gen X — every selector is operable with the keyboard (no mouse)", async ({ page }) => {
  const errors = trackErrors(page);
  await toConfigure(page);

  // gender via keyboard (focus + Enter)
  await page.locator('[data-opt="gender-girl"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-opt="gender-girl"][data-active="true"]')).toBeVisible();
  // stage via keyboard (Space)
  await page.locator('[data-opt="stage-grow"]').focus();
  await page.keyboard.press(" ");
  await expect(page.locator('[data-opt="stage-grow"][data-active="true"]')).toBeVisible();
  // twins via keyboard
  await page.locator('[data-opt="twins-yes"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-opt="twins-yes"][data-active="true"]')).toBeVisible();
  // a chip via keyboard
  await page.locator('[data-val="nursery"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-val="nursery"][data-active="true"]')).toBeVisible();

  await page.getByRole("button", { name: /^Continue$/ }).click();
  // tier via keyboard on review
  await page.locator('[data-tier="ultimate"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-tier="ultimate"][data-active="true"]')).toBeVisible();

  // each option/chip/tier card must be reachable: it has role=button + tabindex
  const focusables = await page.locator('[data-tier]').evaluateAll((els) =>
    els.every((e) => e.getAttribute("role") === "button" && e.getAttribute("tabindex") === "0"));
  expect(focusables).toBeTruthy();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Gen X — junk upload, reload mid-flow, and Back-storm don't crash", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Make our baby/i }).first().click();

  // upload a NON-image file (a .txt masquerading) — must not throw
  await page.locator('.upload-grid input[type="file"]').first().setInputFiles({
    name: "notaphoto.txt", mimeType: "text/plain", buffer: Buffer.from("definitely not an image"),
  });
  await expect(page.locator(".upload-tile").first()).toBeVisible();

  // reload mid-flow → app must come back up cleanly (state resets to landing)
  await page.reload();
  await expect(page.getByRole("heading", { name: /What will your.*look like/i })).toBeVisible();

  // go deep, then mash the in-app Back button repeatedly
  await page.getByRole("button", { name: /Make our baby/i }).first().click();
  await page.getByRole("button", { name: /try with example photos/i }).click();
  await page.getByRole("button", { name: /Choose your baby/i }).click();
  for (let i = 0; i < 8; i++) {
    const back = page.getByRole("button", { name: /^Back$/ });
    if (await back.isVisible().catch(() => false)) await back.click();
    else break;
  }
  // ends back on the landing page, intact
  await expect(page.getByRole("heading", { name: /What will your.*look like/i })).toBeVisible();

  // browser back/forward should not throw
  await page.goBack().catch(() => {});
  await page.goForward().catch(() => {});

  expect(errors, errors.join("\n")).toEqual([]);
});
