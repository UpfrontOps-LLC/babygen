// Prove image->video: turn the generated baby.png into a short giggle clip.
import { promises as fs } from 'node:fs';

const env = await fs.readFile('/opt/babygen/.env.local', 'utf8');
const TOKEN = (env.match(/^REPLICATE_API_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error('NO TOKEN'); process.exit(1); }

const png = await fs.readFile('/opt/babygen/test-out/baby.png');
console.log('baby.png', png.length, 'bytes');
const image = `data:image/png;base64,${png.toString('base64')}`;

const input = {
  image,
  prompt: 'The baby smiles warmly and gives a soft happy giggle, blinks gently, tiny natural head movement, looking at the camera. Keep it cute and natural.',
  duration: 5,
  resolution: '720p',
  aspect_ratio: '1:1',
  camera_fixed: true,
};

console.log('calling bytedance/seedance-1-lite ...');
const res = await fetch('https://api.replicate.com/v1/models/bytedance/seedance-1-lite/predictions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
  body: JSON.stringify({ input }),
});
let pred = await res.json();
console.log('id', pred.id, 'status', pred.status, pred.error ? JSON.stringify(pred.error) : '');
let n = 0;
while (!['succeeded', 'failed', 'canceled'].includes(pred.status) && n < 90) {
  await new Promise(r => setTimeout(r, 2000));
  const r2 = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  pred = await r2.json(); n++;
}
if (pred.status !== 'succeeded') { console.error('FAIL', pred.status, JSON.stringify(pred.error)); process.exit(1); }
const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
await fs.writeFile('/opt/babygen/test-out/baby.mp4', buf);
console.log('SUCCESS -> test-out/baby.mp4', buf.length, 'bytes');
