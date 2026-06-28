// Smoke test: text->two parent faces, then fuse -> baby. Proves the full nano-banana-pro pipeline.
import { promises as fs } from 'node:fs';

const env = await fs.readFile('/opt/babygen/.env.local', 'utf8');
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error('NO REPLICATE TOKEN'); process.exit(1); }

async function gen(prompt, refs = []) {
  const input = { prompt, aspect_ratio: '1:1', output_format: 'png', resolution: '2K', safety_filter_level: 'block_only_high' };
  if (refs.length) input.image_input = refs;
  const res = await fetch('https://api.replicate.com/v1/models/google/nano-banana-pro/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input }),
  });
  let pred = await res.json();
  let n = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(pred.status) && n < 45) {
    await new Promise(r => setTimeout(r, 2000));
    const r2 = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await r2.json(); n++;
  }
  if (pred.status !== 'succeeded') throw new Error(`${pred.status}: ${JSON.stringify(pred.error)}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
const uri = b => `data:image/png;base64,${b.toString('base64')}`;
await fs.mkdir('/opt/babygen/test-out', { recursive: true });

console.log('1/3 generating parent A (dad)...');
const dad = await gen('Photorealistic head-and-shoulders studio portrait of a smiling 32-year-old man with short dark hair and brown eyes, plain light-grey background, soft lighting, full color.');
await fs.writeFile('/opt/babygen/test-out/dad.png', dad);
console.log('   dad.png', dad.length, 'bytes');

console.log('2/3 generating parent B (mom)...');
const mom = await gen('Photorealistic head-and-shoulders studio portrait of a smiling 30-year-old woman with wavy light-brown hair and green eyes, plain light-grey background, soft lighting, full color.');
await fs.writeFile('/opt/babygen/test-out/mom.png', mom);
console.log('   mom.png', mom.length, 'bytes');

console.log('3/3 fusing -> baby...');
const baby = await gen(
  `A photorealistic professional studio portrait of ONE adorable smiling baby about 12 months old, facing camera. The baby's features are a natural genetic blend of the two adults in the reference images - mixing their eye shape and color, nose, lips, skin tone and hair. Clean light-grey background, soft lighting, chubby cheeks, warm happy expression, sharp focus, full color, 1:1, no text, no watermark.`,
  [uri(dad), uri(mom)],
);
await fs.writeFile('/opt/babygen/test-out/baby.png', baby);
console.log('SUCCESS -> test-out/baby.png', baby.length, 'bytes  (dad + mom + baby all written)');
