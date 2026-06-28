// Screenshot the LIVE public site (over the internet, like a real user) — proof.
import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";

await fs.mkdir("/opt/babygen/.proof", { recursive: true });
const url = process.argv[2] || "https://seeourbaby.com";
const b = await chromium.launch();
for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const resp = await p.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await p.screenshot({ path: `/opt/babygen/.proof/live-${name}.png`, fullPage: true });
  console.log(`${name}: status=${resp?.status()} title="${await p.title()}" jsErrors=${errs.length}`);
  await p.close();
}
await b.close();
console.log("DONE");
