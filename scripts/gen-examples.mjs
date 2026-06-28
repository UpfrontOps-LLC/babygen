// Generate 3 example baby images (real tool output) for the landing proof strip.
// Output is optimized WebP (~15-25KB) — the landing references /examples/babyN.webp.
import { promises as fs } from "node:fs";
import sharp from "sharp";
const env = await fs.readFile("/opt/babygen/.env.local", "utf8");
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error("no token"); process.exit(1); }
const uri = async (p) => `data:image/png;base64,${(await fs.readFile(p)).toString("base64")}`;
const dad = await uri("/opt/babygen/test-out/dad.png");
const mom = await uri("/opt/babygen/test-out/mom.png");

async function gen(prompt) {
  const res = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt, image_input: [dad, mom], aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
  });
  let pred = await res.json(); let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 45) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json(); n++;
  }
  if (pred.status !== "succeeded") throw new Error(pred.status);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
const P = [
  "A photorealistic studio portrait of ONE adorable smiling baby girl about 12 months old, big bright eyes, wispy hair, blended features of the two adults in the reference images, clean light-grey background, full color, 1:1, no text.",
  "A photorealistic studio portrait of ONE adorable smiling baby boy about 12 months old, chubby cheeks, blended features of the two adults in the reference images, clean light-grey background, full color, 1:1, no text.",
  "A photorealistic studio portrait of ONE cute toddler about 2 years old, playful grin, blended features of the two adults in the reference images, clean light-grey background, full color, 1:1, no text.",
];
await fs.mkdir("/opt/babygen/public/examples", { recursive: true });
for (let i = 0; i < P.length; i++) {
  const b = await gen(P[i]);
  const webp = await sharp(b).resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  await fs.writeFile(`/opt/babygen/public/examples/baby${i + 1}.webp`, webp);
  console.log(`baby${i + 1}.webp`, webp.length, "bytes");
}
console.log("DONE");
