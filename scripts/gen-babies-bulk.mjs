// Bulk-generate sample babies via the real seeourbaby system (nano-banana-pro
// blend of two parent photos). REAL Replicate spend — run only on explicit
// owner authorization. Parents = public/people minus the omitted set.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const ROOT = "/opt/babygen";
const TOKEN = readFileSync(join(ROOT, ".env.local"), "utf8").match(/^REPLICATE_API_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!TOKEN) { console.error("no REPLICATE_API_TOKEN"); process.exit(1); }

const IMAGE_MODEL = "google/nano-banana-pro";
const PEOPLE = join(ROOT, "public/people");
const OUT = join(ROOT, "public/samples/babies");
mkdirSync(OUT, { recursive: true });

const parents = readFileSync("/root/.claude/jobs/3165cf4f/tmp/parents.txt", "utf8").trim().split("\n").filter(Boolean);
// 12 couples (indices into the 18-parent pool), mixed for variety.
const PAIRS = [
  [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11],
  [12, 13], [14, 15], [16, 17], [0, 9], [3, 14], [7, 12],
];
const VARIANTS = [
  "an adorable baby girl about 12 months old, big bright eyes, wispy hair, giggling",
  "an adorable baby boy about 12 months old, chubby cheeks, soft smile",
  "an adorable toddler about 2 years old, playful grin, full head of hair",
  "an adorable baby about 8 months old, curious wide eyes, tiny smile",
];

function dataUri(file) {
  const buf = readFileSync(join(PEOPLE, file));
  return `data:image/webp;base64,${buf.toString("base64")}`;
}
function blendPrompt(variant) {
  return `A photorealistic professional portrait of ONE ${variant}, facing camera. The face is a natural genetic blend of the two adults in the reference images - mixing their eye shape and color, nose, lips, skin tone and hair. Clean soft light-grey background, gentle lighting, sharp focus, warm happy expression, full color photograph, square 1:1, head and shoulders in frame. No text, no watermark, no extra people.`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(idx) {
  const [ai, bi] = PAIRS[idx];
  const refs = [dataUri(parents[ai]), dataUri(parents[bi])];
  const prompt = blendPrompt(VARIANTS[idx % VARIANTS.length]);
  const res = await fetch(`https://api.replicate.com/v1/models/${IMAGE_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt, image_input: refs, aspect_ratio: "1:1", output_format: "png", resolution: "1K", safety_filter_level: "block_only_high" } }),
  });
  let pred = await res.json();
  let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 45) {
    await sleep(2000);
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    n++;
  }
  if (pred.status !== "succeeded") throw new Error(`${pred.status}: ${JSON.stringify(pred.error)}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const png = Buffer.from(await (await fetch(url)).arrayBuffer());
  const name = `baby${String(idx + 1).padStart(2, "0")}.webp`;
  await sharp(png).resize(512, 512, { fit: "cover" }).webp({ quality: 88 }).toFile(join(OUT, name));
  return { name, parents: [parents[ai], parents[bi]], predict: pred.metrics?.predict_time };
}

// Limited concurrency so we don't hammer the API.
const LIMIT = 3;
const results = [];
let next = 0, done = 0;
async function worker() {
  while (next < PAIRS.length) {
    const i = next++;
    try {
      const r = await genOne(i);
      results.push(r);
      console.log(`[${++done}/${PAIRS.length}] OK ${r.name} <- ${r.parents.join(" + ")} (${r.predict?.toFixed?.(1)}s)`);
    } catch (e) {
      console.error(`[${++done}/${PAIRS.length}] FAIL baby${String(i + 1).padStart(2, "0")}: ${e.message}`);
      if (/insufficient credit/i.test(e.message)) { console.error(">>> REPLICATE OUT OF CREDIT — stopping"); process.exit(2); }
    }
  }
}
await Promise.all(Array.from({ length: LIMIT }, worker));
console.log(`\nDONE: ${results.length}/${PAIRS.length} babies generated -> ${OUT}`);
writeFileSync("/root/.claude/jobs/3165cf4f/tmp/babies-result.json", JSON.stringify(results, null, 2));
