// Generate baby giggle clips for the video-led ad creative (Meta/TikTok).
import { promises as fs } from "node:fs";
const env = await fs.readFile("/opt/babygen/.env.local", "utf8");
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error("no token"); process.exit(1); }

async function clip(srcPath) {
  const image = `data:image/png;base64,${(await fs.readFile(srcPath)).toString("base64")}`;
  const res = await fetch("https://api.replicate.com/v1/models/bytedance/seedance-1-lite/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { image, prompt: "The baby smiles warmly and gives a soft happy giggle, blinks, tiny natural head movement, looking at camera. Cute and natural.", duration: 5, resolution: "720p", aspect_ratio: "1:1", camera_fixed: true } }),
  });
  let pred = await res.json(); let n = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && n < 90) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json(); n++;
  }
  if (pred.status !== "succeeded") throw new Error(pred.status + " " + JSON.stringify(pred.error));
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
await fs.mkdir("/opt/babygen/ad-creative", { recursive: true });
for (const [src, out] of [["/opt/babygen/public/examples/baby1.png", "clip1.mp4"], ["/opt/babygen/public/examples/baby2.png", "clip2.mp4"]]) {
  console.log("generating", out, "...");
  const b = await clip(src);
  await fs.writeFile(`/opt/babygen/ad-creative/${out}`, b);
  console.log(out, b.length, "bytes");
}
console.log("DONE");
