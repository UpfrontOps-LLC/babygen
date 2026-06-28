import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import { uploadBothParents } from "./helpers";

// The money path, end-to-end, through the EMBEDDED Stripe Payment Element with
// the live test card — proving the owner's core mechanic: focusing the CVV field
// starts generation EARLY (overlapping payment), and the reveal shows the baby.
//
// Gated by E2E_STRIPE=1 because it needs a configured Stripe test key. Cached
// generation (default) serves real outputs after the REAL per-tier wait, so this
// costs zero Replicate spend but does take the real ~minute. Hence the long timeout.
const RUN = process.env.E2E_STRIPE === "1";

// Stripe splits each field into its own iframe. Fill the test card across them.
async function fillCard(page: Page) {
  // Stripe may inject an extra Link-button iframe per field; the input frame is first.
  const frame = (testid: string): FrameLocator => page.locator(`[data-testid="${testid}"] iframe`).first().contentFrame();
  await frame("card-number").locator('input[name="cardnumber"]').fill("4242424242424242");
  await frame("card-expiry").locator('input[name="exp-date"]').fill("12 / 34");
  // Focusing the CVV is the trigger; fill it (focus happens implicitly on fill,
  // but click first to make the human "moved to CVV" beat explicit).
  const cvc = frame("card-cvc").locator('input[name="cvc"]');
  await cvc.click();
  await cvc.fill("123");
}

test.describe("embedded payment + CVV-triggered early-gen", () => {
  test.skip(!RUN, "needs E2E_STRIPE=1 (configured Stripe test key)");
  test.setTimeout(180_000); // the cached wait equals the REAL per-tier duration

  test("Basic: CVV focus starts gen before payment; reveal shows the baby", async ({ page }) => {
    await page.goto("/");
    await uploadBothParents(page);
    // Basic = shortest real wait
    await page.locator('[data-tier="basic"]').click();
    await page.locator('input[aria-label="consent"]').check();
    await page.locator("button", { hasText: /Reveal our baby/i }).click();

    // embedded form mounts in-page, no redirect
    await expect(page.locator("#pay")).toBeVisible();
    await fillCard(page);

    await page.locator("button", { hasText: /Pay .* & reveal/i }).click();

    // lands on our success page (not an off-site redirect)
    await page.waitForURL(/\/success\?.*payment_intent=/, { timeout: 60_000 });

    // event ordering proves the overlap: generate_start fired BEFORE payment_succeeded
    const { events } = await (await page.request.get("/api/events")).json();
    const ev = (name: string) => events.find((e: { event: string }) => e.event === name);
    expect(ev("card_focus"), "card_focus should have fired").toBeTruthy();
    expect(ev("generate_start"), "generate_start should have fired").toBeTruthy();
    expect(ev("payment_succeeded"), "payment_succeeded should have fired").toBeTruthy();
    expect(ev("generate_start").ts, "generation must start BEFORE payment confirms (the overlap)").toBeLessThan(ev("payment_succeeded").ts);

    // the reveal eventually shows the baby (cached output after the real wait)
    await expect(page.locator('img[alt="your baby"]').first()).toBeVisible({ timeout: 150_000 });
  });
});
