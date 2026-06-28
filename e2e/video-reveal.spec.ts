import { test, expect } from "@playwright/test";

// Deluxe/Ultimate sell a giggle video; the reveal must actually show it.
// Verified via preview mode with a real sample clip (gen itself needs Replicate credit).
test("success reveal shows the giggle video when one is present", async ({ page }) => {
  await page.goto("/success?preview=1");
  await expect(page.locator("video")).toBeVisible();
  // the 3 baby images still render alongside it
  await expect(page.locator('img[alt="your baby"]')).toHaveCount(3);
});
