// R15 renders: every BASE-01 item of the catalog worn alone, in the master's reference pose and the review motion
// poses, as maps of which piece shows at each pixel (the lab's own runtime, src/v4/lab/fixturesB01.ts). Compare them
// with the approved maps: python3 r15.py compare <out> (approve a changed item with python3 r15.py approve <out> <ids>).
// Usage: node r15.mjs <out dir>     (the lab served at http://localhost:4199/, built with node ../build_lab.mjs)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2];
if (!out) throw new Error('usage: node r15.mjs <out dir>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4199/index.html?art=base01');
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__v4lab.freeze());
const ids = await page.evaluate(() => [...window.__v4lab.scene.assets.catalog.items.values()].filter((i) => i.wslot !== 'body' && i.parts.length).map((i) => i.id));
let slots = null;
for (const id of ids) {
  const r = await page.evaluate((id) => window.__v4lab.idMaps(id), id);
  slots = r.slots;
  mkdirSync(`${out}/${id}`, { recursive: true });
  for (const p of r.poses) writeFileSync(`${out}/${id}/${p.name}.png`, Buffer.from(p.png.split(',')[1], 'base64'));
  console.log('rendered', id);
}
writeFileSync(`${out}/slots.json`, JSON.stringify({ slots, items: ids }, null, 1));
await browser.close();
console.log('items', ids.length);
