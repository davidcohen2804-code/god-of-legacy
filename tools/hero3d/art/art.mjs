// Renders the 3D Beginner's splash art (the VS screen, the HUD's portraits) through art.html under the Vite dev server:
//   npx vite --port 5180 --strictPort --host 127.0.0.1   (from the repo root), then
//   OUT=<dir> JOBS='[{"name":"m_sword","female":false,"weapon":"sword","clip":"Sword_Idle","t":0.3}]' node tools/hero3d/art/art.mjs
// Writes <name>.png per job and meta.json (each picture's head: x, y, r in px — the portrait's square).
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL ?? 'http://127.0.0.1:5180/tools/hero3d/art/art.html', OUT = process.env.OUT ?? '.';
const JOBS = JSON.parse(process.env.JOBS ?? '[]');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(URL, { timeout: 300000 });
await p.waitForFunction(() => window.ready, null, { timeout: 300000 });
const meta = fs.existsSync(`${OUT}/meta.json`) ? JSON.parse(fs.readFileSync(`${OUT}/meta.json`, 'utf8')) : {};
for (const j of JOBS) {
  const r = await p.evaluate((j) => window.shot(j), j);
  fs.writeFileSync(`${OUT}/${j.name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  meta[j.name] = r.head; console.log(j.name, JSON.stringify(r.head));
}
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
