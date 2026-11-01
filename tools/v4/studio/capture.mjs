// Capture frames from the character studio (served at http://localhost:4201/): every listed moment of an animation, as
// the studio draws it (the whole 1600 × 900 canvas: the large view and the gameplay-size view), into PNG files.
// Usage: node capture.mjs <out dir> <anim>:<frame>[,<frame>…] … [--overlay joints|layers|drawing] [--worn top=,bottom=,…]
//   <frame> at 30 frames per second; "all" = every frame of the animation.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire('/home/claude/v4lab/package.json')('playwright');
const args = process.argv.slice(2);
const out = args[0];
mkdirSync(out, { recursive: true });
const overlays = args.filter((a, i) => args[i - 1] === '--overlay');
const wornArg = args.find((a, i) => args[i - 1] === '--worn');
const shots = args.slice(1).filter((a, i, all) => a.includes(':') && all[i - 1] !== '--worn' && all[i - 1] !== '--overlay');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4201/index.html');
await page.waitForFunction(() => window.__studio && window.__studio.ready, null, { timeout: 60000 });
await page.evaluate(({ overlays, wornArg }) => {
  const st = window.__studio, s = st.scene;
  st.freeze();
  for (const o of overlays) s.overlays[o] = true;
  if (wornArg) {
    for (const kv of wornArg.split(',')) { const [k, v] = kv.split('='); if (v) s.worn[k] = v; else delete s.worn[k]; }
    s.applyLook();
  }
}, { overlays, wornArg });
for (const shot of shots) {
  const [anim, list] = shot.split(':');
  const n = await page.evaluate((anim) => { const s = window.__studio.scene; s.setAnim(anim); return s.frameCount(); }, anim);
  const frames = list === 'all' ? Array.from({ length: n + 1 }, (_, i) => i) : list.split(',').map(Number);
  for (const f of frames) {
    const url = await page.evaluate(({ anim, f }) => new Promise((res) => {
      const st = window.__studio, s = st.scene;
      s.setAnim(anim); s.t = Math.min(s.anim.dur, f / 30); s.playing = false;
      st.game.renderer.snapshot((img) => res(img.src));
      st.step(1, 0);
    }), { anim, f });
    writeFileSync(`${out}/${anim}_${String(f).padStart(2, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(anim, frames.length, 'frames');
}
await browser.close();
