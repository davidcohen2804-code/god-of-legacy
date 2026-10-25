// The outfit's regions on the Beginner's atlas (the 3D items: a shirt, trousers, boots dyed and patterned — the body is
// one painted piece, so its clothes change by their texels): each texel of the drawn body read by the bone it hangs on
// and its own colour — the shirt (white cloth on the chest, the arms, the shirt-tail), the vest (dark leather on the
// chest), the sash (red), the trousers (the legs' dark cloth, the hips' under the sash), the boots (the feet, the shins'
// leather), the bracers (the forearms' leather). Written as a map at half the atlas's size (the band of the head under
// the atlas left out: nothing there is clothes) and each region's mean brightness (a dye keeps the painting's shading:
// colour × brightness / mean).
// node regions.mjs BODY.glb OUT.png OUT.json   (run where @gltf-transform, meshoptimizer and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [inp, outPng, outJson] = process.argv.slice(2);
const doc = await io.read(inp); await doc.transform(dequantize());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], skin = doc.getRoot().listSkins()[0];
const names = skin.listJoints().map((n) => n.getName()), ibm = skin.getInverseBindMatrices().getArray();
const at = (nm) => { const i = names.indexOf(nm); const m = ibm.slice(16 * i, 16 * i + 16); // (the bone's place at bind: the inverse's inverse, its translation)
  const [a, b, c, , d, e, f, , g, h, k, , x, y, z] = m; const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  const inv = [(e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det, (f * g - d * k) / det, (a * k - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  return [-(inv[0] * x + inv[3] * y + inv[6] * z), -(inv[1] * x + inv[4] * y + inv[7] * z), -(inv[2] * x + inv[5] * y + inv[8] * z)]; };
const P = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices().getArray();
const tex = prim.getMaterial().getBaseColorTexture(), img = sharp(Buffer.from(tex.getImage())), meta = await img.metadata(), TW = meta.width, NH = meta.height;
const raw = await img.ensureAlpha().raw().toBuffer();
// the atlas proper: above the head's band (its height: the band is half the width tall — tools/hero3d/ai/head.mjs)
const TH = NH - TW / 2;
const group = (n) => (/^(thigh|calf)_/.test(n) ? 'leg' : /^(foot|ball)_/.test(n) ? 'foot' : /^upperarm/.test(n) ? 'arm' : /^lowerarm/.test(n) ? 'fore' : /^(hand|thumb|index|middle|ring|pinky)/.test(n) ? 'hand' : /^(Head|neck)/.test(n) ? 'head' : /^pelvis/.test(n) ? 'hips' : 'torso');
const knee = Math.min(at('calf_l')[1], at('calf_r')[1]);
const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0], p3 = [0, 0, 0], uv = [0, 0];
const REG = { none: 0, shirt: 1, vest: 2, sash: 3, pants: 4, boots: 5, bracer: 6 };
const S = 2, MW = TW / S, MH = TH / S, mask = new Uint8Array(MW * MH).fill(255), sum = new Float64Array(8), cnt = new Float64Array(8); // (255: no texel of the body there)
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const classify = (grp, y, r, g, b) => {
  const L = lum(r, g, b), mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / Math.max(1, mx);
  // (the skin before the white: the shirt is a warm white, the skin warmer still — the gap from red to blue tells them)
  const skinish = r > 140 && r - b > 0.3 * r && r > g + 15 && L > 105 && !(r > 1.55 * g), white = !skinish && L > 135 && sat < 0.38, red = r > 85 && r > 1.55 * g && r > 1.45 * b, leather = r > b + 28 && L > 55;
  switch (grp) {
    case 'torso': return skinish ? REG.none : white ? REG.shirt : red ? REG.sash : L < 120 ? REG.vest : REG.none;
    case 'hips': return white ? REG.shirt : red ? REG.sash : sat < 0.42 && L < 95 ? REG.pants : REG.none;
    case 'arm': return skinish ? REG.none : white ? REG.shirt : REG.none;
    case 'fore': return skinish ? REG.none : white ? REG.shirt : leather || L < 90 ? REG.bracer : REG.none;
    case 'leg': return y < knee + 0.03 ? REG.boots : red && sat > 0.5 ? REG.sash : white ? REG.shirt : REG.pants; // (below the knee: the boots, their red-brown leather too)
    case 'foot': return REG.boots;
    default: return REG.none;
  }
};
const tri = [[0, 0], [0, 0], [0, 0]];
for (let t = 0; t < I.length; t += 3) {
  // the triangle's bone group (the weights of its corners summed) and its height
  const gw = new Map(); let cy = 0;
  for (let k = 0; k < 3; k++) { const i = I[t + k]; J.getElement(i, j4); W.getElement(i, w4); P.getElement(i, p3); cy += p3[1] / 3; for (let q = 0; q < 4; q++) if (w4[q] > 0) { const g = group(names[j4[q]] ?? ''); gw.set(g, (gw.get(g) || 0) + w4[q]); } UV.getElement(i, uv); tri[k] = [uv[0] * TW, uv[1] * NH]; }
  const grp = [...gw.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'head';
  if (grp === 'head' || grp === 'hand') continue;
  const [A, B, C] = tri; if (Math.max(A[1], B[1], C[1]) > TH) continue; // (in the head's band)
  const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
  const e = 1.2 / Math.max(1, Math.sqrt(Math.abs(den)));
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]) - 1)), x1 = Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0]) + 1));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]) - 1)), y1 = Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1]) + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
    if (l1 < -e || l2 < -e || 1 - l1 - l2 < -e) continue;
    const q = 4 * (y * TW + x), r = raw[q], g = raw[q + 1], b = raw[q + 2], reg = classify(grp, cy, r, g, b);
    if (x % S === 0 && y % S === 0) mask[(y / S) * MW + x / S] = reg;
    if (reg) { sum[reg] += lum(r, g, b) / 255; cnt[reg]++; }
  }
}
// the specks smoothed away (a highlight on the vest read as the shirt, a red fleck as the sash): each texel the region
// most of its neighbours are, twice (5 × 5 at half size)
for (let pass = 0; pass < 2; pass++) {
  const src = mask.slice(), c = new Int32Array(8);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x; if (src[i] === 255) continue;
    c.fill(0); for (let dy = -2; dy <= 2; dy++) { const yy = y + dy; if (yy < 0 || yy >= MH) continue; for (let dx = -2; dx <= 2; dx++) { const xx = x + dx; if (xx < 0 || xx >= MW) continue; const v = src[yy * MW + xx]; if (v !== 255) c[v]++; } }
    let best = src[i]; for (let k = 0; k < 8; k++) if (c[k] > c[best]) best = k; mask[i] = best;
  }
}
for (let i = 0; i < mask.length; i++) mask[i] = mask[i] === 255 ? 0 : mask[i] * 32;
await sharp(Buffer.from(mask), { raw: { width: MW, height: MH, channels: 1 } }).png({ compressionLevel: 9 }).toFile(outPng);
const mean = [...sum].map((s, i) => (cnt[i] ? +(s / cnt[i]).toFixed(4) : 0));
const out = { atlasV: +(TH / NH).toFixed(6), mean, texels: [...cnt].map((c) => Math.round(c)) };
fs.writeFileSync(outJson, JSON.stringify(out));
console.log(outPng, MW, 'x', MH, JSON.stringify(out), 'knee', knee.toFixed(3));
