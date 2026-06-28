// 25 adults + 25 babies, ULTRA diverse — not just skin tone but PHOTO REALISM:
// some perfect, some casual phone selfies, some bad lighting, some off-center,
// some cropped/poorly framed, some full body, some face-only. Mimics what real
// users actually upload. Optimized WebP + contact sheets.
import { promises as fs } from "node:fs";
import sharp from "sharp";

const env = await fs.readFile("/opt/babygen/.env.local", "utf8");
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error("no token"); process.exit(1); }

const STYLES = [
  "a crisp professional studio headshot, perfect lighting, centered",
  "a casual mirror selfie taken on a phone, slightly soft focus",
  "a slightly blurry candid snapshot with motion blur",
  "an off-center photo with the head near the edge of frame, poorly framed",
  "a photo with harsh overhead lighting and shadows under the eyes",
  "a dim, underexposed indoor photo, a bit grainy",
  "an overexposed photo near a bright window, slightly washed out",
  "a full-body photo taken from a distance, the face small in frame",
  "a tight close-up of just the face, slightly cropped at the top of the head",
  "a photo at a slight downward angle, taken from above",
  "a photo with a cluttered messy background behind the person",
  "a sharp well-lit outdoor portrait in natural daylight",
];

const ADULTS = [
  "a young Black man", "a young white woman", "an East Asian man", "a South Asian Indian woman",
  "a Latina Hispanic woman", "a Middle Eastern man", "an elderly Black woman", "an elderly white man",
  "an elderly East Asian woman", "an elderly Indian man", "a middle-aged white man", "a middle-aged Black woman",
  "a young East Asian woman", "a young Indian man", "a Latino Hispanic man", "a Middle Eastern woman",
  "an elderly Latina woman", "an elderly white woman", "a middle-aged South Asian man", "a young white man",
  "a Black woman in her 30s", "an elderly East Asian man", "a mixed-race young woman", "a middle-aged Latina woman",
  "a young Middle Eastern man",
];
const BABIES = [
  "a Black newborn baby", "a white baby girl about 6 months old", "an East Asian baby boy about 1 year old",
  "a South Asian Indian baby girl about 9 months old", "a Latino baby about 1 year old", "a Middle Eastern baby boy",
  "a mixed-race toddler about 2 years old", "a Black baby girl with curly hair", "a white newborn",
  "an East Asian toddler about 18 months old", "an Indian baby boy about 1 year old", "a Latina baby girl about 8 months",
  "a Black toddler about 2 years old", "a white baby boy about 4 months old", "an East Asian newborn",
  "a South Asian toddler about 2 years old", "a Middle Eastern baby girl about 1 year old", "a mixed-race baby about 7 months",
  "a Black baby boy about 10 months old", "a white toddler about 18 months old", "a Latino newborn",
  "an East Asian baby girl about 6 months old", "an Indian newborn", "a mixed-race baby boy about 1 year old",
  "a Latina toddler about 2 years old",
];

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

async function batch(subjects, dir, label) {
  await fs.mkdir(dir, { recursive: true });
  const files = [];
  const CONC = 4;
  for (let i = 0; i < subjects.length; i += CONC) {
    const out = await Promise.all(subjects.slice(i, i + CONC).map(async (s, j) => {
      const idx = i + j;
      const style = STYLES[idx % STYLES.length];
      const prompt = `A realistic everyday photograph of ${s}, ${style}. Authentic amateur photo look, natural imperfections, real skin texture. No text, no watermark.`;
      try {
        const png = await gen(prompt);
        const webp = await sharp(png).resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
        const name = `${dir}/${label}${String(idx + 1).padStart(2, "0")}.webp`;
        await fs.writeFile(name, webp);
        console.log(`${label}${idx + 1}: ${style.slice(0, 30)} | ${s}`);
        return name;
      } catch (e) { console.error(`${label}${idx + 1} FAIL: ${e.message}`); return null; }
    }));
    files.push(...out);
  }
  const ok = files.filter(Boolean);
  const tile = 200, cols = 5, rows = Math.ceil(ok.length / cols);
  const comp = await Promise.all(ok.map(async (f, i) => ({ input: await sharp(f).resize(tile, tile).toBuffer(), left: (i % cols) * tile, top: Math.floor(i / cols) * tile })));
  await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#fff" } }).composite(comp).webp({ quality: 82 }).toFile(`${dir}/contact-sheet.webp`);
  return ok.length;
}

const a = await batch(ADULTS, "/opt/babygen/public/samples/adults", "adult");
const bb = await batch(BABIES, "/opt/babygen/public/samples/babies", "baby");
console.log(`DONE adults=${a} babies=${bb}`);
