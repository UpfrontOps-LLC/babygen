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
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Optional override for environments that ship a prebuilt Chromium at a fixed
    // path (e.g. PLAYWRIGHT_BROWSERS_PATH sandboxes). No-op in normal CI.
    ...(process.env.PW_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    // The app now runs on Cloudflare Workers and needs the OpenNext binding
    // context (KV, the Workflow), so it can't be exercised under a plain
    // `next start`. Build the Worker and serve it locally via wrangler dev — the
    // same runtime as production. (Skipped locally if a server is already up,
    // e.g. an existing `wrangler dev` on E2E_BASE_URL.)
    command: `opennextjs-cloudflare build && npx wrangler dev --port ${PORT} --local --ip 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
