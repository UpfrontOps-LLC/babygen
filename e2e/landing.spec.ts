import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./helpers";

const HEADLINES: Record<string, string> = {
  A: "What will your baby look like?",
  B: "See your future baby in seconds.",
};

test.describe("landing page", () => {
  test("renders cleanly with no JS/console errors", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("assigns an A/B variant cookie and renders the matching headline", async ({ page, context }) => {
    await page.goto("/");
    // The variant is assigned in a client effect — wait for the cookie to settle
    // before asserting, so we don't race the initial render's default.
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === "bg_ab")?.value)
      .toMatch(/^[AB]$/);
    const ab = (await context.cookies()).find((c) => c.name === "bg_ab")!.value;

    const h1 = page.locator("h1[data-variant]");
    await expect(h1).toHaveAttribute("data-variant", ab); // auto-retries until DOM reflects the variant
    await expect(h1).toHaveText(HEADLINES[ab]);
  });

  test("shows three AI example results as conversion proof", async ({ page }) => {
    await page.goto("/");
    const examples = page.locator("[data-examples] img");
    await expect(examples).toHaveCount(3);
    // each example image actually loads (non-zero natural width)
    for (let i = 0; i < 3; i++) {
      const w = await examples.nth(i).evaluate((img: HTMLImageElement) => img.naturalWidth);
      expect(w).toBeGreaterThan(0);
    }
  });

  test("CTA is disabled until photos + consent, and trust badges are present", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("button", { name: /Upload both parents to start/i });
    await expect(cta).toBeDisabled();
    await expect(page.getByText(/Secure checkout/i)).toBeVisible();
    await expect(page.getByText(/Photos deleted after generation/i)).toBeVisible();
  });
});
