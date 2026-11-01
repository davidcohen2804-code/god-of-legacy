// One continuous clip per look at 720p (idle, run, jump, two attacks), gameplay crop + wardrobe preview, as run_lab's reel.
// Usage: node reel4.mjs <outDir> <looks gold,coat_tabard_nocape>
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const { chromium } = createRequire('/home/claude/v4lab/package.json')('playwright');
const [out, looksArg] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:4199/index.html?art=b');
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
await page.addStyleTag({ content: '.layout{grid-template-columns:1282px 1fr!important} .stage{position:fixed!important;left:0!important;top:0!important;z-index:50!important;border:0!important;border-radius:0!important;width:1280px!important;height:720px!important;aspect-ratio:auto!important}' });
await page.setViewportSize({ width: 1700, height: 1100 }); await page.waitForTimeout(1500);
const set = (fn, arg) => page.evaluate(fn, arg);
await set(() => window.__v4lab.freeze());
const step = (n) => set((n) => window.__v4lab.step(n, 1000 / 60), n);
const shot = (path) => page.screenshot({ path, clip: { x: 0, y: 0, width: 1280, height: 720 }, timeout: 180000 });
const where = () => page.evaluate(() => { const s = window.__v4lab.scene, cam = s.cameras.main, p = s.player, k = 1280 / 1920; return { x: (cam.x + (p.x - cam.worldView.x) * cam.zoom) * k }; });
const G = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };
const LOOKS = { gold: G, coat_tabard_nocape: { ...G, top: 'b_test_coat', back: null } };
await set(() => { const s = window.__v4lab.scene; s.zoomPreset = 'grinding'; s.sizeKey = '1.12'; s.renderMode = 'direct'; s.previewOn = true; s.applyView(); });
for (const look of looksArg.split(',')) {
  await set((eq) => { const s = window.__v4lab.scene; s.setGear('starter'); for (const slot of ['hair', 'head', 'eyeacc', 'faceacc', 'earring', 'top', 'bottom', 'overall', 'gloves', 'shoes', 'back', 'weapon']) s.equip(slot, eq[slot] ?? null); }, LOOKS[look]);
  await set(() => { const s = window.__v4lab.scene; s.forced = 'idle'; s.autoSwapMs = 0; const p = s.player; p.mode = 'idle'; p.t = 0; p.loopT = 0; p.skillT = 0; p.z = 0; p.vz = 0; p.x = 700; p.y = 760; p.facing = 1; p.ch.chain.reset(); s.preview.chain.reset(); });
  const dir = `${out}/reel_${look}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let f = 0, at = null;
  const play = async (anim, seconds) => {
    await set((a) => { window.__v4lab.scene.forced = a; }, anim);
    for (let i = 0; i < Math.round(seconds * 30); i++) { await step(2); if (!at) at = await where(); await shot(`${dir}/f${String(f++).padStart(4, '0')}.png`); }
  };
  await play('idle', 1.2); await play('run', 1.4); await play(null, 0.3); await play('jump', 1.0); await play(null, 0.3);
  await play('attack', 0.65); await play(null, 0.25); await play('attack', 0.65); await play(null, 0.5);
  const gx = Math.round(at.x - 120), px = Math.ceil(1300 * (1280 / 1920));
  execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${out}/reel_${look}.mp4`);
  execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%04d.png -filter_complex "[0:v]split[a][b];[a]crop=240:440:${gx}:150,pad=244:440:0:0:color=0x0c1017[g];[b]crop=${1280 - px}:440:${px}:150[p];[g][p]hstack=inputs=2,fps=15,split[s1][s2];[s1]palettegen=max_colors=160[pal];[s2][pal]paletteuse=dither=bayer:bayer_scale=4" ${out}/reel_${look}.gif`);
  console.log('reel', look, f, 'frames');
}
await browser.close();
