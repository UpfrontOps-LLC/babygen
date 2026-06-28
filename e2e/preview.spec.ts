import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./helpers";

test.describe("post-pay reveal (preview/QA mode)", () => {
  test("/success?preview=1 renders the reveal grid and the OTO upsell ladder", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/success?preview=1");

    // three baby images in the reveal grid
    const imgs = page.locator('img[alt="your baby"]');
    await expect(imgs).toHaveCount(3);

    // OTO upsell ladder present with all five add-ons
    const otos = page.locator("[data-oto-id]");
    await expect(otos).toHaveCount(5);
    for (const id of ["video", "ages", "gender", "twins", "hd"]) {
      await expect(page.locator(`[data-oto-id="${id}"]`)).toBeVisible();
    }
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("OTO add-ons toggle on click", async ({ page }) => {
    await page.goto("/success?preview=1");
    const video = page.locator('[data-oto-id="video"]');
    await expect(video).not.toContainText("✓");
    await video.click();
    await expect(video).toContainText("✓");
    await video.click();
    await expect(video).not.toContainText("✓");
  });
});
