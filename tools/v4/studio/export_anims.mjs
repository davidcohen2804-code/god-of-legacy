// Export the lab's four animations as evaluated poses (every bone's world transform per frame, the corrective swaps and
// the draw-order id), for offline renders and comparisons. Expects the lab served at :4199.
// Usage: node export_anims.mjs <out.json> [fps=30]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('/home/claude/v4lab/package.json')('playwright');
const [out, fpsArg] = process.argv.slice(2);
const fps = Number(fpsArg ?? 30);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:4199/index.html?art=b');
await page.waitForFunction(() => window.__v4lab && window.__v4lab.ready, null, { timeout: 60000 });
const data = await page.evaluate((fps) => {
  const lab = window.__v4lab; lab.freeze();
  const s = lab.scene, pv = s.preview, pose = pv.pose, rig = pose.rig;
  const res = { B: rig.B, bones: rig.bones.map((b) => ({ name: b.name, parent: b.parent, x: b.x, y: b.y, r: b.r, len: b.len })), restWorldRot: Array.from(pose.restWorldRot), anims: {} };
  for (const name of ['idle', 'run', 'jump', 'attack']) {
    const a = s.assets.anims[name], n = Math.round(a.dur * fps), frames = [];
    pv.chain.reset();
    for (let i = 0; i <= n; i++) {
      const t = Math.min(a.dur, i / fps);
      pv.evaluate(a, t);
      frames.push({ t, world: Array.from(pv.state.world).map((v) => Math.round(v * 1e5) / 1e5), swaps: { ...pv.state.swaps }, order: pv.state.orderId });
    }
    res.anims[name] = { dur: a.dur, loop: a.loop, frames };
  }
  return res;
}, fps);
writeFileSync(out, JSON.stringify(data));
console.log('bones', data.bones.length, Object.fromEntries(Object.entries(data.anims).map(([k, v]) => [k, v.frames.length])));
await browser.close();
