// Capture the wardrobe preview (B = 370 px) and the bones at chosen moments, per look, in one forced animation.
// Usage: node probe4.mjs <outDir> <looks a,b> <anim idle|run|jump|attack> <times 0.1,0.2> [override.json] [bones]
//   override.json: an AnimDef replacing <anim> (bones / dur / loop), e.g. a held extreme pose
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const { chromium } = createRequire('/home/claude/v4lab/package.json')('playwright');
const [out, looksArg, anim, timesArg, ovPath, bonesFlag] = process.argv.slice(2);
const looks = looksArg.split(','), times = timesArg.split(',').map(Number);
const ov = ovPath && ovPath !== 'none' ? JSON.parse(readFileSync(ovPath, 'utf8')) : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 2000, height: 1200 }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:4199/index.html');
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
await page.addStyleTag({ content: '.stage{position:fixed!important;left:0!important;top:0!important;z-index:50!important;border:0!important;border-radius:0!important;width:1920px!important;height:1080px!important;aspect-ratio:auto!important}' });
await page.waitForTimeout(600);
await page.setViewportSize({ width: 2010, height: 1210 }); await page.waitForTimeout(400); await page.setViewportSize({ width: 2000, height: 1200 });
await page.waitForTimeout(800);
await page.waitForFunction(() => Math.round(document.querySelector('#stage canvas').getBoundingClientRect().width) === 1920, null, { timeout: 20000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => window.__v4lab.freeze());
if (ov) await ev(([d, name]) => { const s = window.__v4lab.scene, b = s.assets.anims[name]; s.assets.anims[name] = { ...b, ...d, bones: d.bones }; }, [ov, anim]);
const G = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };
const LOOKS = {
  basic: {}, gold: G,
  helm: { ...G, head: 'b_gold_helm' },
  nocape: { ...G, back: null },
  tabard_basic_top: { bottom: 'b_gold_bottom', shoes: 'b_gold_shoes' },           // the Golden trousers with the basic top
  tabard_basic_boots: { bottom: 'b_gold_bottom' },                                  // ... and the basic boots (cuffs, trousers below the knee)
  gold_top_basic_legs: { top: 'b_gold_top', gloves: 'b_gold_gloves', back: 'b_gold_cape' },
  coat_tabard: { ...G, top: 'b_test_coat' },                                        // a top with coat tails (test stand-in) over the tabard
  coat_basic: { top: 'b_test_coat' },
  coat_tabard_nocape: { ...G, top: 'b_test_coat', back: null },
  ember: { top: 'b_ember_top', bottom: 'b_ember_bottom', shoes: 'b_ember_shoes', gloves: 'b_ember_gloves' },
  ember_gold_legs: { top: 'b_ember_top', bottom: 'b_gold_bottom', shoes: 'b_gold_shoes', gloves: 'b_ember_gloves' },
  ember_top_basic: { top: 'b_ember_top' },
  gold_top_ember_legs: { top: 'b_gold_top', bottom: 'b_ember_bottom', shoes: 'b_ember_shoes', gloves: 'b_gold_gloves', back: 'b_gold_cape' },
  ember_helm: { top: 'b_ember_top', bottom: 'b_ember_bottom', shoes: 'b_ember_shoes', gloves: 'b_ember_gloves', head: 'b_gold_helm' },
};
const meta = [];
for (const look of looks) {
  const eq = LOOKS[look];
  await ev(([eq, bones]) => {
    const s = window.__v4lab.scene; s.setGear('starter');
    for (const slot of ['top', 'bottom', 'gloves', 'shoes', 'back', 'weapon', 'head']) s.equip(slot, eq[slot] ?? null);
    s.debug.bones = bones; s.previewOn = true; s.renderMode = 'direct'; s.applyView();
  }, [eq, bonesFlag === 'bones']);
  await ev(() => window.__v4lab.step(3, 1000 / 60));
  await ev((fa) => { const s = window.__v4lab.scene; s.forced = fa; s.autoSwapMs = 0; const p = s.player; p.mode = 'idle'; p.t = 0; p.loopT = 0; p.skillT = 0; p.z = 0; p.vz = 0; p.x = 700; p.y = 760; p.facing = 1; p.ch.chain.reset(); s.preview.chain.reset(); }, anim);
  await ev(() => window.__v4lab.step(1, 1000 / 60));
  let at = 0;
  for (const [k, t] of times.entries()) {
    const m = Math.round(t * 60);
    if (m > at) { await ev(([n]) => window.__v4lab.step(n, 1000 / 60), [m - at]); at = m; }
    const name = `${look}_${anim}_${k}`;
    await page.screenshot({ path: `${out}/${name}.png`, clip: { x: 1300, y: 140, width: 620, height: 820 }, timeout: 180000 });
    const st = await ev(() => { const s = window.__v4lab.scene, p = s.player, pv = s.preview; return { t: p.last.t, mode: p.mode, world: Array.from(pv.state.world), order: pv.state.orderId }; });
    meta.push({ name, look, anim, t: st.t, frame: m, order: st.order, world: st.world });
  }
}
writeFileSync(`${out}/meta_${anim}.json`, JSON.stringify(meta));
if (logs.length) console.log(logs.join('\n'));
console.log(`captured ${meta.length}`);
await browser.close();
