import { test, expect } from "@playwright/test";
import { collectPageErrors, uploadBothParents } from "./helpers";

test.describe("pre-checkout funnel", () => {
  test("upload reveals the good-better-best tier selector, defaulting to Deluxe", async ({ page }) => {
    await page.goto("/");
    await uploadBothParents(page);

    const tiers = page.locator("[data-tier]");
    await expect(tiers).toHaveCount(3);
    // Deluxe is the anchored default
    await expect(page.locator('[data-tier="deluxe"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Most popular")).toBeVisible();
  });

  test("the order bump shows only on Basic (Deluxe/Ultimate include video)", async ({ page }) => {
    await page.goto("/");
    await uploadBothParents(page);

    // default Deluxe: no bump
    await expect(page.locator("[data-bump]")).toHaveCount(0);

    await page.locator('[data-tier="basic"]').click();
    await expect(page.locator("[data-bump]")).toBeVisible();

    await page.locator('[data-tier="ultimate"]').click();
    await expect(page.locator("[data-bump]")).toHaveCount(0);
  });

  test("consent gates the CTA and the CTA shows the correct live total per tier+bump", async ({ page }) => {
    await page.goto("/");
    await uploadBothParents(page);

    const consent = page.locator('input[aria-label="consent"]');
    const cta = page.locator("button", { hasText: /Reveal our baby|Tick the box/i });

    // Deluxe default, consent unchecked → CTA prompts for the box and is disabled
    await expect(cta).toHaveText(/Tick the box to continue/i);
    await expect(cta).toBeDisabled();

    await consent.check();
    await expect(cta).toHaveText(/Reveal our baby for \$29/);
    await expect(cta).toBeEnabled();

    // Basic + bump → 17.99 + 7.00 = 24.99
    await page.locator('[data-tier="basic"]').click();
    await page.locator('[data-bump] input[type="checkbox"]').check();
    await expect(cta).toHaveText(/Reveal our baby for \$24\.99/);

    // Ultimate → 49
    await page.locator('[data-tier="ultimate"]').click();
    await expect(cta).toHaveText(/Reveal our baby for \$49/);
  });

  test("submitting checkout while Stripe is unconfigured surfaces an error, not a crash", async ({ page }) => {
    // With no STRIPE_SECRET_KEY the /api/checkout route returns 500; the UI must
    // show the error inline and stay usable (no white screen, no navigation).
    const errors = collectPageErrors(page);
    await page.goto("/");
    await uploadBothParents(page);
    await page.locator('input[aria-label="consent"]').check();

    const cta = page.locator("button", { hasText: /Reveal our baby/i });
    await cta.click();

    // we stay on the funnel page and an error message renders
    await expect(page).toHaveURL(/\/$|localhost/);
    await expect(page.getByText(/stripe not configured|checkout unavailable|error/i)).toBeVisible();
    // no uncaught exceptions from the failed fetch
    expect(errors.filter((e) => e.startsWith("pageerror")), errors.join("\n")).toEqual([]);
  });
});
