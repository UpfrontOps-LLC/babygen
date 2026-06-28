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

  test("submitting reveals the EMBEDDED Stripe payment form on our page (no redirect), or errors inline, never hangs", async ({ page }) => {
    // Configured (STRIPE_SECRET_KEY present) -> the embedded Payment Element
    // mounts in-page (#pay + a Stripe card iframe), NO redirect off-site.
    // Unconfigured -> inline error. Either way: no hang, no crash, stay on our origin.
    const errors = collectPageErrors(page);
    await page.goto("/");
    await uploadBothParents(page);
    await page.locator('input[aria-label="consent"]').check();
    await page.locator("button", { hasText: /Reveal our baby/i }).click();

    await Promise.race([
      page.locator("#pay").waitFor({ state: "visible", timeout: 20000 }),
      page.getByText(/unavailable|try again/i).waitFor({ timeout: 20000 }),
    ]);
    // we never leave our own origin (embedded, not hosted checkout)
    expect(page.url()).not.toMatch(/checkout\.stripe\.com/);
    expect(errors.filter((e) => e.startsWith("pageerror")), errors.join("\n")).toEqual([]);
  });
});
