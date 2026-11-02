// Drives the built lab in headless Chromium (software WebGL): smoke check, tests, benchmark, screenshots, recordings.
// Usage: [V4_ART=placeholder|b] [V4_ONLY=B7,B8] node tools/v4/run_lab.mjs <smoke|tests|tests-full|bench|shots|record|reel> [outDir] [part]
//   V4_ART picks the art the lab opens with (default: candidate B's real art; the Phase 1 tests need the placeholder)
//   shots parts: looks, crowd, debug, sizes, swap (comma-separated) or all (default); record parts: idle | run | jump | attack | all
// Expects the lab served at http://localhost:4199/ (python3 -m http.server 4199 --directory dist-v4lab).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const cmd = process.argv[2] ?? 'smoke';
const out = process.argv[3] ?? 'v4out';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const ART = process.env.V4_ART ?? 'b';
await page.goto(`http://localhost:4199/index.html?art=${ART}`);
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
const lab = (fn, arg) => page.evaluate(fn, arg);

/** Size the stage so the 1920×1080 canvas shows at exactly 1280×720 (the 720p reference), pinned at the page's (0, 0)
 *  so canvas pixels land on whole screen pixels. Phaser fits the canvas to the stage's border box, so the border goes. */
async function stage720() {
  await page.addStyleTag({ content: '.layout{grid-template-columns:1282px 1fr!important} .stage{position:fixed!important;left:0!important;top:0!important;z-index:50!important;border:0!important;border-radius:0!important;width:1280px!important;height:720px!important;aspect-ratio:auto!important}' });
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const b = document.querySelector('#stage canvas').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
  if (r.join() !== '0,0,1280,720') throw new Error(`canvas shows at ${r.join(', ')}, not 0, 0, 1280, 720`);
}
/** Where the player stands in a stage screenshot (px): root x, ground y, and B on screen. */
const where = () => page.evaluate(() => {
  const s = window.__v4lab.scene, cam = s.cameras.main, p = s.player, k = 1280 / 1920;
  return { x: (cam.x + (p.x - cam.worldView.x) * cam.zoom) * k, ground: (cam.y + (p.y - cam.worldView.y) * cam.zoom) * k, b: s.bCanvas * k };
});

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
    const only = process.env.V4_ONLY ? process.env.V4_ONLY.split(',') : undefined; // e.g. V4_ONLY=B7,B8
    const res = await lab(([full, only]) => window.__v4lab.runTests(full, only), [cmd === 'tests-full', only]);
    writeFileSync(`${out}/${cmd}.json`, JSON.stringify(res, null, 2));
    for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.name}\n     ${r.detail}`);
  }
  if (cmd === 'bench') {
    const res = await lab(() => window.__v4lab.bench(4));
    writeFileSync(`${out}/bench.json`, JSON.stringify(res, null, 2));
    console.log(JSON.stringify(res, null, 1));
  }
  if (cmd === 'shots' || cmd === 'record' || cmd === 'reel') {
    await stage720();
    await lab(() => { const L = window.__v4lab; L.freeze(); });
    const set = (fn, arg) => lab(fn, arg);
    const step = (n, ms = 1000 / 60) => lab(([n, ms]) => window.__v4lab.step(n, ms), [n, ms]);
    // a clip of the page, not an element screenshot: exactly the canvas, and no waiting for 'stable' while the GPU
    // drains a heavy crowd
    const shot = (path) => page.screenshot({ path: path.includes('/') ? path : `${out}/${path}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 }, timeout: 180000 });
    const outfit = (eq, gear = 'starter') => set(([eq, gear]) => {
      const s = window.__v4lab.scene; s.setGear(gear);
      for (const slot of ['hair', 'head', 'eyeacc', 'faceacc', 'earring', 'top', 'bottom', 'overall', 'gloves', 'shoes', 'back', 'weapon']) s.equip(slot, eq[slot] ?? null);
    }, [eq, gear]);
    const reset = (anim) => set((a) => { const s = window.__v4lab.scene; s.forced = a; s.autoSwapMs = 0; const p = s.player; p.mode = 'idle'; p.t = 0; p.loopT = 0; p.skillT = 0; p.z = 0; p.vz = 0; p.x = 700; p.y = 760; p.facing = 1; p.ch.chain.reset(); }, anim);
    if (cmd === 'shots') {
      const GOLD = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };
      const looks = ART === 'b' ? {
        basic: [{}, 'starter'], gold: [GOLD, 'starter'], job: [{}, 'job'],
        mixA: [{ top: 'b_gold_top', gloves: 'b_gold_gloves' }, 'starter'],
        mixB: [{ bottom: 'b_gold_bottom', shoes: 'b_gold_shoes', back: 'b_gold_cape' }, 'starter'],
      } : {
        starter: [{}, 'starter'], job: [{}, 'job'],
        mixA: [{ hair: 'hair_long', head: 'bandana_a', top: 'plate_top_b', bottom: 'trousers_a', gloves: 'gauntlets_b', shoes: 'shoes_a', back: 'scarf_a', eyeacc: 'glasses_a' }, 'starter'],
        mixB: [{ hair: 'hair_short', head: 'helmet_b', top: 'tunic_a', bottom: 'plate_legs_b', gloves: 'wraps_a', shoes: 'boots_b', back: 'cape_b', weapon: 'sword_b', faceacc: 'mask_b', earring: 'cuff_b' }, 'starter'],
        wings: [{ hair: 'hair_long', head: 'tall_hat_x', back: 'wings_x', top: 'heavy_plate_x' }, 'starter'],
        robe: [{ overall: 'robe_x', head: 'great_helm_x', back: 'cape_b', gloves: 'gauntlets_b' }, 'starter'],
      };
      const part = process.argv[4] ?? 'all', want = (p) => part === 'all' || part.split(',').includes(p);
      let pos = {}; try { pos = JSON.parse(readFileSync(`${out}/shots.json`, 'utf8')); } catch { /* first run */ }
      const save = () => writeFileSync(`${out}/shots.json`, JSON.stringify(pos, null, 1));
      const view = (o) => set((o) => { const s = window.__v4lab.scene; Object.assign(s, o); s.applyView(); }, o);
      // every look in every animation, direct renderer (the recommended gameplay renderer), preview on
      await view({ renderMode: 'direct', previewOn: true, zoomPreset: 'grinding', sizeKey: '1.12' });
      if (want('looks')) for (const [name, [eq, gear]] of Object.entries(looks)) {
        await outfit(eq, gear);
        for (const [anim, frames] of [['idle', 30], ['run', 14], ['jump', 22], ['attack', 17]]) {
          await reset(anim); await step(frames); await shot(`shot_${name}_${anim}`); pos[`shot_${name}_${anim}`] = await where(); save();
        }
      }
      // the same 50-character crowd, two frames apart, in both renderers (preview off, as in the benchmark)
      if (want('crowd')) {
        await outfit({}, 'starter');
        await set(() => { const s = window.__v4lab.scene; s.previewOn = false; s.setStress(49); s.forced = null; s.renderMode = 'direct'; s.applyView(); }); await step(40); await shot('shot_crowd_direct');
        await view({ renderMode: 'composite-outline' }); await step(2); await shot('shot_crowd_composite');
        await set(() => { const s = window.__v4lab.scene; s.setStress(0); s.previewOn = true; s.renderMode = 'direct'; s.applyView(); });
      }
      // the rig under the art: bones, then every slot in its own colour (mixed look, attack)
      if (want('debug')) {
        await outfit(looks.mixB[0], 'starter');
        await view({ renderMode: 'direct', previewOn: true }); await set(() => { window.__v4lab.scene.debug.bones = true; });
        await reset('attack'); await step(17); await shot('shot_debug_bones'); pos.shot_debug_bones = await where();
        await set(() => { const s = window.__v4lab.scene; s.debug.bones = false; s.debug.slots = true; }); await step(1); await shot('shot_debug_slots'); pos.shot_debug_slots = await where();
        await set(() => { window.__v4lab.scene.debug.slots = false; }); save();
      }
      // identity size: the three size options at the three zoom presets (look with small details: glasses, bandana)
      if (want('sizes')) {
        await outfit(ART === 'b' ? GOLD : looks.mixA[0], 'starter');
        for (const size of ['1', '1.12', '1.25']) for (const z of ['social', 'grinding', 'boss']) {
          await view({ sizeKey: size, zoomPreset: z }); await reset('idle'); await step(10);
          await shot(`shot_size_${size}_${z}`); pos[`shot_size_${size}_${z}`] = await where();
        }
        await view({ sizeKey: '1.12', zoomPreset: 'grinding' }); save();
      }
      // per-slot swaps, one slot at a time, from the basic clothing to the full Golden Warrior set (idle)
      if (want('swap') && ART === 'b') {
        await outfit({}, 'starter'); await view({ renderMode: 'direct', previewOn: true, zoomPreset: 'grinding', sizeKey: '1.12' });
        await reset('idle'); await step(20);
        const seq = [['basic', null, null], ['top', 'top', 'b_gold_top'], ['bottom', 'bottom', 'b_gold_bottom'], ['shoes', 'shoes', 'b_gold_shoes'], ['gloves', 'gloves', 'b_gold_gloves'], ['back', 'back', 'b_gold_cape']];
        for (const [name, slot, id] of seq) {
          if (slot) await set(([slot, id]) => window.__v4lab.scene.equip(slot, id), [slot, id]);
          await step(1); await shot(`shot_swap_${name}`); pos[`shot_swap_${name}`] = await where();
        }
        save();
      }
    }
    if (cmd === 'reel' && (ART === 'b' || ART === 'base01')) {
      // one continuous clip per look: idle, run, a jump, two attacks (the game's own clock, 60 Hz steps, 30 fps frames)
      const GOLDR = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };
      const B01 = { top: 'top01_tunic', bottom: 'bottom01_pants', shoes: 'shoes01_boots', weapon: 'weapon01_sword' };
      const LOOKS = ART === 'base01' ? [['tunic', B01], ['armor', { ...B01, top: 'top02_armor' }], ['unarmed', { ...B01, weapon: null }],
        // the weapon motion kits (dagger_1h, staff_2h): the same moves, the kit picked by the held weapon
        ['dagger', { ...B01, top: 'item01_vest', weapon: 'item10_dagger' }], ['staff', { ...B01, top: 'item02_robe', weapon: 'item09_staff' }]] : [['basic', {}], ['gold', GOLDR]];
      await set(() => { const s = window.__v4lab.scene; s.zoomPreset = 'grinding'; s.sizeKey = '1.12'; s.renderMode = 'direct'; s.previewOn = true; s.applyView(); });
      for (const [name, eq] of LOOKS.filter(([n]) => !process.env.V4_LOOKS || process.env.V4_LOOKS.split(',').includes(n))) {
        await outfit(eq, 'starter'); await reset('idle');
        const dir = `${out}/reel_${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
        let f = 0, at = null;
        // each frame's animation, game state and attack clock (states.json: where the state changes really are)
        const states = [];
        const frame = async () => {
          await step(2); if (!at) at = await where();
          states.push(await lab(() => { const p = window.__v4lab.scene.player; return { anim: p.last ? p.last.anim.name : '', mode: p.mode, skillT: Math.round(p.skillT) }; }));
          await shot(`${dir}/f${String(f++).padStart(4, '0')}.png`);
        };
        const play = async (anim, seconds) => {
          await set((a) => { const s = window.__v4lab.scene; s.forced = a; }, anim);
          for (let i = 0; i < Math.round(seconds * 30); i++) await frame();
        };
        /** Let go of every input, play on until the player is back in idle, then `seconds` more. */
        const settle = async (seconds) => {
          await set(() => { window.__v4lab.scene.forced = null; });
          for (let i = 0; i < 120 && (await lab(() => window.__v4lab.scene.player.mode)) !== 'idle'; i++) await frame();
          for (let i = 0; i < Math.round(seconds * 30); i++) await frame();
        };
        if (ART === 'base01') { // the transitions the art director asked for: idle → run → slash → slash → jump → land → idle
          // attack held just past the end of the first slash: the second follows it, then the input is released
          await play('idle', 1.0); await play('run', 1.2); await play('attack', 0.7); await settle(0.3);
          await play('jump', 0.07); await settle(0.7);
          writeFileSync(`${dir}/states.json`, JSON.stringify(states));
        } else {
          await play('idle', 1.6); await play('run', 1.4); await play(null, 0.2); await play('jump', 1.0); await play(null, 0.3);
          await play('attack', 0.65); await play(null, 0.25); await play('attack', 0.65); await play(null, 0.6);
        }
        execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${out}/reel_${name}.mp4`);
        const gx = Math.round(at.x - 120), px = Math.ceil(1300 * (1280 / 1920));
        execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%04d.png -filter_complex "[0:v]split[a][b];[a]crop=240:440:${gx}:150,pad=244:440:0:0:color=0x0c1017[g];[b]crop=${1280 - px}:440:${px}:150[p];[g][p]hstack=inputs=2,fps=15,split[s1][s2];[s1]palettegen=max_colors=160[pal];[s2][pal]paletteuse=dither=bayer:bayer_scale=4" ${out}/reel_${name}.gif`);
      }
    }
    if (cmd === 'record') {
      const clip = process.argv[4] ?? 'all';
      await set(() => { const s = window.__v4lab.scene; s.zoomPreset = 'grinding'; s.sizeKey = '1.12'; s.renderMode = 'direct'; s.previewOn = true; s.applyView(); });
      for (const anim of ['idle', 'run', 'jump', 'attack']) {
        if (clip !== 'all' && clip !== anim) continue;
        await outfit({}, 'starter'); await reset(anim);
        await set(() => { window.__v4lab.scene.autoSwapMs = 400; });
        const dir = `${out}/rec_${anim}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
        let at = null;
        for (let f = 0; f < 120; f++) { await step(1, 1000 / 30); if (!at) at = await where(); await shot(`${dir}/f${String(f).padStart(3, '0')}.png`); }
        // MP4: the whole 1280×720 canvas, unscaled
        execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%03d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${out}/swap_${anim}.mp4`);
        // GIF for documents, unscaled: a 220 px strip around the character at gameplay size, then the wardrobe preview panel
        const gx = Math.round(at.x - 110), px = Math.ceil(1300 * (1280 / 1920));
        execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${dir}/f%03d.png -filter_complex "[0:v]split[a][b];[a]crop=220:460:${gx}:140,pad=224:460:0:0:color=0x0c1017[g];[b]crop=${1280 - px}:460:${px}:140[p];[g][p]hstack=inputs=2,fps=15,split[s1][s2];[s1]palettegen=max_colors=128[pal];[s2][pal]paletteuse=dither=bayer:bayer_scale=4" ${out}/swap_${anim}.gif`);
      }
    }
  }
} finally {
  writeFileSync(`${out}/${cmd}-console.log`, logs.join('\n'));
  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.slice(0, 20).join('\n'));
  await browser.close();
}
