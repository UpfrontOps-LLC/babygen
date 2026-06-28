// Generate 25 DIVERSE face portraits (men/women, young/old, many ethnicities)
// for social-proof / testimonial avatars / example faces. Optimized WebP.
import { promises as fs } from "node:fs";
import sharp from "sharp";

const env = await fs.readFile("/opt/babygen/.env.local", "utf8");
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error("no token"); process.exit(1); }

const SUBJECTS = [
  "a young Black man about 28 years old",
  "a young white woman about 26 years old",
  "an East Asian man about 32 years old",
  "a South Asian Indian woman about 30 years old",
  "a Latina Hispanic woman about 27 years old",
  "a Middle Eastern man about 35 years old",
  "an elderly Black grandmother about 70 years old, silver hair",
  "an elderly white grandfather about 72 years old, glasses",
  "an elderly East Asian grandmother about 68 years old",
  "an elderly Indian grandfather about 75 years old, white beard",
  "a middle-aged white man about 45 years old",
  "a middle-aged Black woman about 42 years old",
  "a young East Asian woman about 24 years old",
  "a young Indian man about 29 years old",
  "a Latino Hispanic man about 38 years old",
  "a Middle Eastern woman about 31 years old",
  "an elderly Latina Hispanic grandmother about 69 years old",
  "an elderly white grandmother about 71 years old",
  "a middle-aged South Asian Indian man about 48 years old",
  "a young white man about 25 years old",
  "a Black woman about 33 years old",
  "an elderly East Asian grandfather about 74 years old",
  "a mixed-race young woman about 27 years old with curly hair",
  "a middle-aged Latina Hispanic woman about 46 years old",
  "a young Middle Eastern man about 26 years old",
];

function prompt(s) {
  return `A photorealistic professional headshot portrait of ${s}, friendly natural warm smile, looking at the camera, soft even studio lighting, clean neutral light-grey background, full color photograph, square 1:1 framing, head and shoulders. Natural skin texture, sharp focus. No text, no watermark.`;
}

async function gen(p) {
  const res = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt: p, aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
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

await fs.mkdir("/opt/babygen/public/people", { recursive: true });
const CONC = 4;
const results = [];
for (let i = 0; i < SUBJECTS.length; i += CONC) {
  const batch = SUBJECTS.slice(i, i + CONC).map(async (s, j) => {
    const idx = i + j;
    try {
      const png = await gen(prompt(s));
      const webp = await sharp(png).resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
      const name = `person${String(idx + 1).padStart(2, "0")}.webp`;
      await fs.writeFile(`/opt/babygen/public/people/${name}`, webp);
      console.log(name, webp.length, "bytes —", s);
      return `/opt/babygen/public/people/${name}`;
    } catch (e) { console.error(`person${idx + 1} FAILED:`, e.message); return null; }
  });
  results.push(...(await Promise.all(batch)));
}

// 5x5 contact sheet for review
const files = results.filter(Boolean);
const tile = 256, cols = 5, rows = Math.ceil(files.length / cols);
const composites = await Promise.all(files.map(async (f, i) => ({
  input: await sharp(f).resize(tile, tile).toBuffer(),
  left: (i % cols) * tile, top: Math.floor(i / cols) * tile,
})));
await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#ffffff" } })
  .composite(composites).webp({ quality: 82 }).toFile("/opt/babygen/public/people/contact-sheet.webp");
console.log("DONE", files.length, "images + contact-sheet.webp");
