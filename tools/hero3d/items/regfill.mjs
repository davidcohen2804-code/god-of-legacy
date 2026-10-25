// The shirt's holes in the regions' map filled (David 25 Oct: the shirt read stained; a dyed shirt kept brown patches):
// regions.mjs took the shirt by its colour, and the drawing's brown smudges on it — the dirt of a worn shirt — read as
// no region, so the clean linen (clean.mjs) and the items' dyes stopped at them. Each patch of no region inside the
// body's own faces is made the shirt when the shirt is most of its rim and it lies on the shirt's part of the body (the
// torso, the upper arms — not the forearms, the hands, the neck or the head, where skin borders the sleeves).
// node regfill.mjs BODY.glb REGIONS.png OUT.png   (REGIONS: the map over the whole texture, bust.mjs's; run where
// @gltf-transform and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [inPath, regPath, outPath] = process.argv.slice(2);
const doc = await io.read(inPath); await doc.transform(dequantize());
const skin = doc.getRoot().listSkins()[0], names = skin.listJoints().map((n) => n.getName());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], UV = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices().getArray();
const reg = await sharp(regPath).greyscale().raw().toBuffer({ resolveWithObject: true }), MW = reg.info.width, MH = reg.info.height;
const meta = await sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())).metadata(), TW = meta.width, NH = meta.height, TH = TW;
const RT = Math.round((MH * TH) / NH); // (the map's rows over the atlas's top: the body's own faces)
const data = Buffer.from(reg.data), R = (i) => Math.round(data[i] / 32);
// the body's faces in the map: covered, and whether their part of the body is skin's (forearms, hands, neck, head)
const SKINP = /^(lowerarm|hand|thumb|index|middle|ring|pinky|neck|Head)/;
const cover = new Uint8Array(MW * RT), skinPart = new Uint8Array(MW * RT), uv = [0, 0], j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
for (let t = 0; t < I.length; t += 3) {
  const P2 = []; let top = true, sk = 0;
  for (let c = 0; c < 3; c++) { UV.getElement(I[t + c], uv); if (uv[1] >= TH / NH - 1e-4) top = false; P2.push([uv[0] * MW, (uv[1] * NH * RT) / TH]); J.getElement(I[t + c], j4); W.getElement(I[t + c], w4); for (let k = 0; k < 4; k++) if (SKINP.test(names[j4[k]] ?? '')) sk += w4[k] / 3; }
  if (!top) continue;
  const [A, B, C] = P2, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-12) continue;
  for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))); y <= Math.min(RT - 1, Math.ceil(Math.max(A[1], B[1], C[1]))); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))); x <= Math.min(MW - 1, Math.ceil(Math.max(A[0], B[0], C[0]))); x++) {
    const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
    if (l1 < -0.02 || l2 < -0.02 || 1 - l1 - l2 < -0.02) continue;
    const i = y * MW + x; cover[i] = 1; if (sk > 0.5) skinPart[i] = 1;
  }
}
// the patches of no region on the body's faces, and their rims
const lab = new Int32Array(MW * RT).fill(-1); let filled = 0, patches = 0, px = 0;
for (let s = 0; s < MW * RT; s++) {
  if (lab[s] >= 0 || !cover[s] || R(s)) continue;
  const comp = [], q = [s]; lab[s] = s; const rim = new Map();
  while (q.length) {
    const i = q.pop(); comp.push(i); const x = i % MW, y = (i - x) / MW;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= RT) continue; const k = yy * MW + xx;
      if (!cover[k]) continue; const r = R(k);
      if (r) { rim.set(r, (rim.get(r) || 0) + 1); continue; }
      if (lab[k] < 0) { lab[k] = s; q.push(k); }
    }
  }
  patches++;
  const rimN = [...rim.values()].reduce((a, b) => a + b, 0), shirt = rim.get(1) || 0, onSkin = comp.reduce((a, i) => a + skinPart[i], 0) / comp.length;
  if (rimN && shirt / rimN >= +(process.env.RIM ?? 0.6) && onSkin < 0.3 && comp.length <= +(process.env.MAXA ?? 4000)) { for (const i of comp) data[i] = 32; filled++; px += comp.length; }
}
// the shirt across the atlas's pieces (the patches above see only within one piece of it): a face of no region on the
// shirt's part of the body, light or a smudge's brown (not the vest's, the trousers' or the boots' dark, not the sash's
// red), whose neighbours on the body (two rings round it) are mostly the shirt, made the shirt — a few times over
let faces3 = 0;
{
  const P = prim.getAttribute('POSITION'), p = [0, 0, 0], id = new Map(), wid = new Int32Array(P.getCount());
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); const k = p.map((v) => Math.round(v * 2e4)).join(','); if (!id.has(k)) id.set(k, id.size); wid[i] = id.get(k); }
  const timg = sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())), raw = await timg.removeAlpha().raw().toBuffer();
  const F = []; // [t, pixels, skin part, mean colour]
  for (let t = 0; t < I.length; t += 3) {
    const P2 = []; let top = true, sk = 0;
    for (let c = 0; c < 3; c++) { UV.getElement(I[t + c], uv); if (uv[1] >= TH / NH - 1e-4) top = false; P2.push([uv[0] * MW, (uv[1] * NH * RT) / TH]); J.getElement(I[t + c], j4); W.getElement(I[t + c], w4); for (let k = 0; k < 4; k++) if (SKINP.test(names[j4[k]] ?? '')) sk += w4[k] / 3; }
    if (!top) continue;
    const [A, B, C] = P2, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-12) continue;
    const px2 = [], col = [0, 0, 0];
    for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))); y <= Math.min(RT - 1, Math.ceil(Math.max(A[1], B[1], C[1]))); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))); x <= Math.min(MW - 1, Math.ceil(Math.max(A[0], B[0], C[0]))); x++) {
      const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
      if (l1 < -0.02 || l2 < -0.02 || 1 - l1 - l2 < -0.02) continue;
      px2.push(y * MW + x); const tx = Math.min(TW - 1, Math.floor(((x + 0.5) * TW) / MW)), ty = Math.min(TH - 1, Math.floor(((y + 0.5) * TH) / RT)), q = 3 * (ty * TW + tx); col[0] += raw[q]; col[1] += raw[q + 1]; col[2] += raw[q + 2];
    }
    if (!px2.length) continue;
    F.push({ t, px: px2, skin: sk > 0.5, col: col.map((v) => v / px2.length / 255), lab: 0 });
  }
  const label = (f) => { const c = new Int32Array(8); for (const i of f.px) c[R(i)]++; let b = 0; for (let k = 1; k < 7; k++) if (c[k] > c[b]) b = k; return c[b] * 2 >= f.px.length ? b : 0; };
  for (const f of F) f.lab = label(f);
  const byW = new Map(); F.forEach((f, fi) => { for (let c = 0; c < 3; c++) { const w = wid[I[f.t + c]]; if (!byW.has(w)) byW.set(w, []); byW.get(w).push(fi); } });
  const ring = (fi) => { const s = new Set([fi]); for (let r = 0; r < 2; r++) for (const g of [...s]) for (let c = 0; c < 3; c++) for (const h of byW.get(wid[I[F[g].t + c]]) ?? []) s.add(h); s.delete(fi); return s; };
  for (let pass = 0; pass < +(process.env.PASSES ?? 4); pass++) {
    const turn = [];
    F.forEach((f, fi) => {
      if (f.lab || f.skin) return; const [r, g, b] = f.col, L = 0.299 * r + 0.587 * g + 0.114 * b; if (L < 0.33 || r > 1.6 * g) return;
      let shirt = 0, all = 0; for (const h of ring(fi)) { all += F[h].px.length; if (F[h].lab === 1) shirt += F[h].px.length; }
      if (all && shirt / all >= +(process.env.NEAR ?? 0.5)) turn.push(fi);
    });
    if (!turn.length) break;
    for (const fi of turn) { F[fi].lab = 1; for (const i of F[fi].px) data[i] = 32; faces3++; }
  }
}
// the texels round the faces' edges (the bleed the bake laid past them, which a far look's smaller texture mixes in): the
// region most of the faces' texels round them are
let bled = 0;
{
  const src = Buffer.from(data);
  for (let y = 0; y < RT; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x; if (cover[i]) continue; const c = new Int32Array(8); let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= RT) continue; const k = yy * MW + xx; if (!cover[k]) continue; c[Math.round(src[k] / 32)]++; n++; }
    if (!n) continue; let best = 0; for (let k = 1; k < 7; k++) if (c[k] > c[best]) best = k;
    if (best && c[best] * 2 > n && Math.round(src[i] / 32) !== best) { data[i] = best * 32; bled++; }
  }
}
await sharp(data, { raw: { width: MW, height: MH, channels: 1 } }).png({ compressionLevel: 9 }).toFile(outPath);
console.log(inPath, `— patches of no region on the body ${patches}; made the shirt ${filled} (${px} px of the map); faces made the shirt by their neighbours ${faces3}; texels round the faces given their region ${bled}`);
