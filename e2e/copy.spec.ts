import { test, expect } from "@playwright/test";
import { uploadBothParents } from "./helpers";

// 2026 conversion hygiene: em dashes read as AI-written, and "AI-generated"
// stamped everywhere reads as a demo. The landing must have zero em dashes and
// disclose AI at most once.
test.describe("landing copy hygiene", () => {
  test("no em dashes anywhere in the visible funnel", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("body").innerText()).not.toContain("—");
    // also the post-upload state (tiers, consent, priced CTA)
    await uploadBothParents(page);
    await page.locator('input[aria-label="consent"]').check();
    expect(await page.locator("body").innerText()).not.toContain("—");
  });

  test("discloses AI at most once on the landing", async ({ page }) => {
    await page.goto("/");
    await uploadBothParents(page);
    const body = await page.locator("body").innerText();
    expect((body.match(/AI-generated/gi) || []).length).toBeLessThanOrEqual(1);
  });
});
