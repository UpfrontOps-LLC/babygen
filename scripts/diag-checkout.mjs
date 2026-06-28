// Reproduce the checkout flow on the LIVE site and capture EXACTLY what happens.
import { chromium } from "@playwright/test";
const URL = "https://seeourbaby.com";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const net = [];
p.on("response", async (r) => { if (r.url().includes("/api/")) net.push(`${r.request().method()} ${r.status()} ${r.url()}`); });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await p.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
const fileInputs = p.locator('input[type="file"]');
console.log("file inputs found:", await fileInputs.count());
await fileInputs.nth(0).setInputFiles("/opt/babygen/e2e/fixtures/dad.png");
await fileInputs.nth(1).setInputFiles("/opt/babygen/e2e/fixtures/mom.png");
await p.waitForTimeout(1500);
console.log("tier selector visible:", await p.locator('[role="radiogroup"]').isVisible().catch(() => false));
const consent = p.locator('input[aria-label="consent"]');
console.log("consent checkbox present:", await consent.count());
await consent.check().catch((e) => console.log("consent check ERR:", e.message));

const cta = p.locator("button", { hasText: /Reveal our baby|Upload both|Tick the box|checkout/i }).last();
console.log("CTA text BEFORE:", (await cta.textContent().catch(() => "?"))?.trim());
console.log("CTA disabled BEFORE:", await cta.isDisabled().catch(() => "?"));

const t0 = Date.now();
await cta.click().catch((e) => console.log("CLICK ERR:", e.message));
await p.waitForTimeout(12000);
console.log(`--- ${((Date.now() - t0) / 1000).toFixed(1)}s after click ---`);
console.log("CTA text AFTER:", (await cta.textContent().catch(() => "?"))?.trim());
console.log("URL AFTER:", p.url());
console.log("NETWORK /api:", net);
console.log("ERRORS:", errs);
const vis = await p.locator("p.text-red-500, [class*=red]").allTextContents().catch(() => []);
console.log("visible error text:", vis.filter((t) => t.trim()).slice(0, 5));
await b.close();
console.log("DONE");
