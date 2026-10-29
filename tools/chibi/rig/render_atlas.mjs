// Every frame of a rig's moves drawn at 2x, each cut to its own box, with its feet anchor and its sword line:
//   node render_atlas.mjs RIG.json MOVES.mjs OUTDIR [scale2x] [only-actions,comma]
// writes OUTDIR/<action>-<i>.png and OUTDIR/frames.json [{name, w, h, ax, ay, blade:[hx,hy,tx,ty]|null}]
// (ax, ay: the feet point in the frame px — the ground under the hips; blade relative to it).
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const { chromium } = await import(process.env.PW ?? 'playwright');
const [rigPath, movesPath, out, sc = '0.5', only = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
const mv = await import(pathToFileURL(path.resolve(movesPath)).href);
const want = only ? new Set(only.split(',')) : null;
const frames = Object.entries(mv.ACTIONS).filter(([a]) => !want || want.has(a)).flatMap(([a, list]) => list.map((pose, i) => ({ name: `${a}-${i}`, pose })));
const here = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(pathToFileURL(path.join(here, 'blank.html')).href);
const res = await p.evaluate(async ({ rig, frames, rigJs, base, S, plant, sword }) => {
  const R = await import(rigJs);
  const r = await R.loadRig(rig, base);
  const W = 2400, H = 2400, X = 1200, G = 1700; // (the canvas; the anchor's place on it)
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const lowest = (pose) => { let m = -1e9; for (const [bone, pts] of Object.entries(plant)) for (const pt of pts) m = Math.max(m, R.pointOf(r, pose, bone, pt)[1]); return m; };
  // (the standing height: the root's place over the ground in the first idle frame — the airborne frames keep it)
  const st = frames.find((f) => f.name === 'idle-0')?.pose ?? frames[0].pose;
  const standY = -lowest({ ...st, _y: 0 });
  const out = [];
  for (const f of frames) {
    const pose = { ...f.pose };
    pose._y = (pose._air ? standY : -lowest({ ...pose, _y: 0 })) + (pose._air ? (pose._yAdd ?? 0) : 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    R.drawRig(ctx, r, pose, { x: X, y: G, scale: S });
    const d = ctx.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 1) { const row = y * W * 4; for (let x = 0; x < W; x += 1) if (d[row + x * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const pad = 4; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, Math.max(y1, G) + pad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const cc = document.createElement('canvas'); cc.width = w; cc.height = h; cc.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
    let blade = null;
    if (!pose._hide_sword) { const g = R.pointOf(r, pose, 'sword', sword.grip), t = R.pointOf(r, pose, 'sword', sword.tip); blade = [g[0] * S, g[1] * S, t[0] * S, t[1] * S]; }
    const feet = Object.entries(plant).map(([bone, pts]) => pts.map((pt) => R.pointOf(r, pose, bone, pt)[0] * S));
    out.push({ name: f.name, url: cc.toDataURL('image/png'), w, h, ax: X - x0, ay: G - y0, blade, feet });
  }
  return out;
}, { rig, frames, rigJs: pathToFileURL(path.join(here, 'rig.js')).href, base: pathToFileURL(path.dirname(path.resolve(rigPath))).href + '/', S: Number(sc), plant: mv.opts.plant, sword: mv.SWORD });
const meta = [];
for (const f of res) { fs.writeFileSync(path.join(out, `${f.name}.png`), Buffer.from(f.url.split(',')[1], 'base64')); const { url, ...m } = f; meta.push(m); }
fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(meta));
console.log(res.length, 'frames ->', out, 'errors:', errs.join(' | ') || 'none');
await b.close();
