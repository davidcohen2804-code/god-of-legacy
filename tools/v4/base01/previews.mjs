// The importer package's preview renders: every catalog item worn alone on BASE-01, drawn by the game's own runtime
// (the character studio), at 600 px and at gameplay size (150 px). Clothes and armour in the master's stance; a weapon
// in its kit's guard. Writes <out>/<id>_600.png and <out>/<id>_150.png.
// Usage: node tools/v4/base01/previews.mjs <out dir>   (expects the studio built and served at http://localhost:4201/)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] ?? 'previews';
mkdirSync(out, { recursive: true });
const pack = JSON.parse(readFileSync(new URL('../../../src/v4/base01/assets/base01.json', import.meta.url)));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4201/index.html');
await page.waitForFunction(() => window.__studio && window.__studio.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__studio.freeze());
// the studio's canvas is 1600 x 900: the large view stands at (480, 790), the gameplay view at (1260, 640)
const BOX = { 600: [100, 130, 900, 810], 150: [1135, 450, 1435, 660] };
for (const it of pack.items) {
  const slot = it.slot === 'hat' ? 'head' : it.slot;
  const png = await page.evaluate(({ slot, id, weapon }) => new Promise((res) => {
    const st = window.__studio, s = st.scene;
    s.bigB = 600;
    s.worn = { [slot]: id }; s.applyLook();
    s.setAnim(weapon ? 'idle' : 'rest'); s.t = 0; s.playing = false; s.render();
    st.game.renderer.snapshot((img) => res(img.src));
    st.step(1, 0);
  }), { slot, id: it.id, weapon: it.slot === 'weapon' });
  const buf = Buffer.from(png.split(',')[1], 'base64');
  writeFileSync(`${out}/${it.id}_full.png`, buf);
  console.log('rendered', it.id);
}
await browser.close();
// the crops are made by package.py (Pillow), from the full canvas renders
writeFileSync(`${out}/boxes.json`, JSON.stringify(BOX));
console.log('items', pack.items.length);
