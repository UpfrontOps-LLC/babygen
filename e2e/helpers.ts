import { Page, expect } from "@playwright/test";
import path from "node:path";

export const FIXTURE_DAD = path.join(__dirname, "fixtures", "dad.png");
export const FIXTURE_MOM = path.join(__dirname, "fixtures", "mom.png");

/**
 * Collects JS exceptions and console.error output for a page so a spec can
 * assert the page is clean. Favicon 404s and similar benign noise are filtered.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/favicon/i.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Upload both parent photos, revealing the tier selector. */
export async function uploadBothParents(page: Page) {
  const inputs = page.locator('input[type="file"]');
  await expect(inputs).toHaveCount(2);
  await inputs.nth(0).setInputFiles(FIXTURE_DAD);
  await inputs.nth(1).setInputFiles(FIXTURE_MOM);
  // tier selector only renders once both files are picked
  await expect(page.locator('[role="radiogroup"]')).toBeVisible();
}
