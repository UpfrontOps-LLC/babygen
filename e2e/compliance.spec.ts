import { test, expect } from "@playwright/test";

/**
 * Ad-network (Meta/TikTok) + payment-processor compliance surface.
 * These pages must exist and be reachable from every page's footer before ads
 * can run. No site header — compliance pages are content + footer only.
 */
test.describe("refund policy page", () => {
  test("/refunds renders a real refund policy with the required disclosures", async ({ page }) => {
    await page.goto("/refunds");
    await expect(page.getByRole("heading", { name: /refund/i }).first()).toBeVisible();
    // digital / AI entertainment good
    await expect(page.getByText(/digital|AI-generated/i).first()).toBeVisible();
    // a concrete remedy path (failed generation -> re-run or refund) — reviewers reject pure "no refunds"
    await expect(page.getByText(/re-?run|refund|didn.?t generate|failed/i).first()).toBeVisible();
    // a way to actually request it (page body + footer both expose it)
    await expect(page.getByRole("link", { name: /support@/i }).first()).toBeVisible();
    // dated policy
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });

  test("compliance pages have no site header (content + footer only)", async ({ page }) => {
    await page.goto("/refunds");
    await expect(page.locator("header")).toHaveCount(0);
  });
});

test.describe("footer links to every compliance page", () => {
  for (const path of ["/", "/success?preview=1", "/privacy", "/terms", "/refunds"]) {
    test(`footer exposes Privacy + Terms + Refund from ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("link", { name: /privacy/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /terms/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /refund/i })).toBeVisible();
    });
  }

  test("footer shows the operating business identity (processor + ad-review requirement)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/UpfrontOps LLC/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /support@/i })).toBeVisible();
  });
});
