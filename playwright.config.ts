import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for babygen.
 *
 * Phase 1 (this config) exercises the funnel UI + safety invariants with NO
 * Stripe key — the same unconfigured state the app ships in until a key lands.
 * The payment-path specs (Checkout with the live test card + webhook delivery)
 * are tagged @payment and skipped unless E2E_STRIPE=1, so the suite stays green
 * pre-key and turns on the moment the sandbox key is wired in.
 *
 * Local: reuses an already-running dev/prod server on PORT (default 3000).
 * CI: builds and starts a fresh production server so results are hermetic.
 */
const PORT = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
