import { test, expect } from "@playwright/test";

test.describe("legal + trust pages (ad-network + Stripe review require these)", () => {
  test("privacy policy renders with biometric/deletion language", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByText(/photo|biometric|delet/i).first()).toBeVisible();
  });

  test("terms render with entertainment-only + all-sales-final language", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.getByText(/entertainment|sales final|AI-generated/i).first()).toBeVisible();
  });

  test("footer links to privacy + terms from the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /privacy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms/i })).toBeVisible();
  });
});
