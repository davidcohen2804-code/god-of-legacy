// Drives the built lab in headless Chromium (software WebGL): smoke check, tests, benchmark, screenshots, recordings.
// Usage: node tools/v4/run_lab.mjs <smoke|tests|tests-full|bench|shots|record> [outDir]
// Expects the lab served at http://localhost:4199/ (python3 -m http.server 4199 --directory dist-v4lab).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const cmd = process.argv[2] ?? 'smoke';
const out = process.argv[3] ?? 'v4out';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:4199/index.html');
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
const lab = (fn, arg) => page.evaluate(fn, arg);

/** Size the stage so the 1920×1080 canvas shows at exactly 1280×720 (the 720p reference). */
async function stage720() {
  await page.addStyleTag({ content: '.layout{grid-template-columns:1282px 1fr!important} .stage{width:1282px!important;height:722px!important;aspect-ratio:auto!important}' });
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.waitForTimeout(400);
}

try {
  if (cmd === 'smoke') {
    await page.waitForTimeout(1500);
    const hud = await lab(() => window.__v4lab.scene.hud());
    const info = await lab(() => ({ atlas: window.__v4lab.scene.assets.atlasInfo, maxTex: window.__v4lab.game.renderer.getMaxTextureSize(), gl: window.__v4lab.game.renderer.gl.getParameter(window.__v4lab.game.renderer.gl.VERSION) }));
    await page.screenshot({ path: `${out}/smoke.png` });
    writeFileSync(`${out}/smoke.json`, JSON.stringify({ hud, info }, null, 2));
    console.log(JSON.stringify({ hud, info }, null, 1));
  }
  if (cmd === 'tests' || cmd === 'tests-full') {
    const res = await lab((full) => window.__v4lab.runTests(full), cmd === 'tests-full');
    writeFileSync(`${out}/${cmd}.json`, JSON.stringify(res, null, 2));
    for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.name}\n     ${r.detail}`);
  }
  if (cmd === 'bench') {
    const res = await lab(() => window.__v4lab.bench(4));
    writeFileSync(`${out}/bench.json`, JSON.stringify(res, null, 2));
    console.log(JSON.stringify(res, null, 1));
  }
  if (cmd === 'shots' || cmd === 'record') {
    await stage720();
    await lab(() => { const L = window.__v4lab; L.freeze(); });
    const set = (fn, arg) => lab(fn, arg);
    const step = (n, ms = 1000 / 60) => lab(([n, ms]) => window.__v4lab.step(n, ms), [n, ms]);
    const shot = (name) => page.locator('#stage').screenshot({ path: `${out}/${name}.png` });
    const outfit = (eq, gear = 'starter') => set(([eq, gear]) => {
      const s = window.__v4lab.scene; s.setGear(gear);
      for (const slot of ['hair', 'head', 'eyeacc', 'faceacc', 'earring', 'top', 'bottom', 'overall', 'gloves', 'shoes', 'back', 'weapon']) s.equip(slot, eq[slot] ?? null);
    }, [eq, gear]);
    const reset = (anim) => set((a) => { const s = window.__v4lab.scene; s.forced = a; s.autoSwapMs = 0; const p = s.player; p.mode = 'idle'; p.t = 0; p.loopT = 0; p.skillT = 0; p.z = 0; p.vz = 0; p.x = 700; p.y = 760; p.facing = 1; p.ch.chain.reset(); }, anim);
    if (cmd === 'shots') {
      const looks = {
        starter: [{}, 'starter'], job: [{}, 'job'],
        mixA: [{ hair: 'hair_long', head: 'bandana_a', top: 'plate_top_b', bottom: 'trousers_a', gloves: 'gauntlets_b', shoes: 'shoes_a', back: 'scarf_a', eyeacc: 'glasses_a' }, 'starter'],
        mixB: [{ hair: 'hair_short', head: 'helmet_b', top: 'tunic_a', bottom: 'plate_legs_b', gloves: 'wraps_a', shoes: 'boots_b', back: 'cape_b', weapon: 'sword_b', faceacc: 'mask_b', earring: 'cuff_b' }, 'starter'],
        wings: [{ hair: 'hair_long', head: 'tall_hat_x', back: 'wings_x', top: 'heavy_plate_x' }, 'starter'],
        robe: [{ overall: 'robe_x', head: 'great_helm_x', back: 'cape_b', gloves: 'gauntlets_b' }, 'starter'],
      };
      for (const [name, [eq, gear]] of Object.entries(looks)) {
        await outfit(eq, gear);
        for (const [anim, frames] of [['idle', 30], ['run', 14], ['jump', 22], ['attack', 17]]) {
          await reset(anim); await step(frames); await shot(`shot_${name}_${anim}`);
        }
      }
      await outfit({}, 'starter');
      await set(() => { const s = window.__v4lab.scene; s.setStress(49); s.forced = null; s.applyView(); }); await step(90); await shot('shot_crowd_composite');
      await set(() => { const s = window.__v4lab.scene; s.renderMode = 'direct'; s.applyView(); }); await step(30); await shot('shot_crowd_direct');
      await set(() => { const s = window.__v4lab.scene; s.setStress(0); s.renderMode = 'composite-outline'; s.debug.bones = true; s.applyView(); }); await reset('attack'); await step(17); await shot('shot_debug_bones');
      await set(() => { const s = window.__v4lab.scene; s.debug.bones = false; s.debug.slots = true; }); await step(1); await shot('shot_debug_slots');
      await set(() => { const s = window.__v4lab.scene; s.debug.slots = false; });
      for (const z of ['social', 'boss']) { await set((z) => { const s = window.__v4lab.scene; s.zoomPreset = z; s.applyView(); }, z); await reset('idle'); await step(10); await shot(`shot_zoom_${z}`); }
    }
    if (cmd === 'record') {
      const clip = process.argv[4] ?? 'all';
      await set(() => { const s = window.__v4lab.scene; s.zoomPreset = 'grinding'; s.renderMode = 'composite-outline'; s.applyView(); });
      for (const anim of ['idle', 'run', 'jump', 'attack']) {
        if (clip !== 'all' && clip !== anim) continue;
        await outfit({}, 'starter'); await reset(anim);
        await set(() => { window.__v4lab.scene.autoSwapMs = 400; });
        const dir = `${out}/rec_${anim}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
        for (let f = 0; f < 150; f++) { await step(1, 1000 / 30); await page.locator('#stage').screenshot({ path: `${dir}/f${String(f).padStart(3, '0')}.png` }); }
        execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%03d.png -vf "scale=1280:-2" -c:v libx264 -pix_fmt yuv420p -crf 20 ${out}/swap_${anim}.mp4`);
      }
    }
  }
} finally {
  writeFileSync(`${out}/${cmd}-console.log`, logs.join('\n'));
  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.slice(0, 20).join('\n'));
  await browser.close();
}
