// The Beginner's head made anew (David 25 Oct: the head "looks broken in the game, not professional"): the drawn head
// came out of one full-body drawing with too few pixels for a face (the eyes smeared, the hair a lump with grey streaks
// of the drawing's ground in it). It is replaced by the head of the Quaternius base body whose skeleton the Beginner
// wears (CC0: a modelled face, its eyes and brows) and a base hair piece (CC0), laid on the Beginner's neck at its size,
// coloured to the Beginner's skin and hair. Their textures go in a band added under the atlas.
// node head.mjs BODY.glb BASE.gltf HAIR.gltf OUT.glb   (run where @gltf-transform, meshoptimizer and sharp resolve)
// env: HEAD_K (the head's size against the base body's, default: by the necks), HAIR_LIFT (m, default 0), SKIN_TEX,
//      PONY=1 (the drawing laid hair down the back — the woman's: it is pressed into the back and painted the shirt),
//      HAIR_DROP_X (m: the hair's pieces out to the sides go — Hair_Buns' buns), PONYTAIL=1 (a ponytail made on the head:
//      the woman's, as she is drawn — tied high at the back, falling down her back in clumps, a red tie)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import path from 'path';
import * as THREE from '/home/claude/god-of-legacy/node_modules/three/build/three.module.js';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [bodyPath, basePath, hairPath, outPath] = process.argv.slice(2);

const doc = await io.read(bodyPath); await doc.transform(dequantize());
const base = await io.read(basePath), hair = await io.read(hairPath);

/** A skinned document's joints (names) and their places at bind. */
function rig(d) {
  const skin = d.getRoot().listSkins()[0], names = skin.listJoints().map((n) => n.getName()), ibm = skin.getInverseBindMatrices().getArray();
  const at = (nm) => { const i = names.indexOf(nm); return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(ibm.slice(16 * i, 16 * i + 16)).invert()); };
  return { names, at };
}
const RB = rig(doc), RQ = rig(base);
const bPrim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const bP = bPrim.getAttribute('POSITION'), bUV = bPrim.getAttribute('TEXCOORD_0'), bJ = bPrim.getAttribute('JOINTS_0'), bW = bPrim.getAttribute('WEIGHTS_0'), bI = bPrim.getIndices().getArray(), nB = bP.getCount();
const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0], p3 = [0, 0, 0], uv2 = [0, 0];
const weightOn = (names, J, W, i, re) => { J.getElement(i, j4); W.getElement(i, w4); let s = 0; for (let k = 0; k < 4; k++) if (re.test(names[j4[k]] ?? '')) s += w4[k]; return s; };

// the drawn head out (its hair with it): the triangles hanging on the head
const onHead = new Float32Array(nB); for (let i = 0; i < nB; i++) onHead[i] = weightOn(RB.names, bJ, bW, i, /^Head$/);
const keep = [], gone = [];
for (let t = 0; t < bI.length; t += 3) (onHead[bI[t]] > 0.5 && onHead[bI[t + 1]] > 0.5 && onHead[bI[t + 2]] > 0.5 ? gone : keep).push(bI[t], bI[t + 1], bI[t + 2]);
console.log('drawn head triangles dropped', gone.length / 3, 'of', bI.length / 3);

// the neck's width where the head is cut (the base head is laid on at the Beginner's neck size)
const neckWidth = (P, n, w, y0, y1) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { if (w && w(i) < 0) continue; P.getElement(i, p3); if (p3[1] < y0 || p3[1] > y1 || Math.abs(p3[2] - zc) > 0.12) continue; lo = Math.min(lo, p3[0]); hi = Math.max(hi, p3[0]); } return hi - lo; };
const hB = RB.at('Head'), nkB = RB.at('neck_01'), hQ = RQ.at('Head'), nkQ = RQ.at('neck_01');
let zc = nkB.z; const wB = neckWidth(bP, nB, (i) => (onHead[i] > 0.5 ? -1 : 1), nkB.y + 0.25 * (hB.y - nkB.y), nkB.y + 0.6 * (hB.y - nkB.y));
const qMeshes = base.getRoot().listMeshes(), qBody = qMeshes.map((m) => m.listPrimitives()[0]).reduce((a, b) => (b.getAttribute('POSITION').getCount() > a.getAttribute('POSITION').getCount() ? b : a));
zc = nkQ.z; const wQ = neckWidth(qBody.getAttribute('POSITION'), qBody.getAttribute('POSITION').getCount(), null, nkQ.y + 0.25 * (hQ.y - nkQ.y), nkQ.y + 0.6 * (hQ.y - nkQ.y));
const k = +(process.env.HEAD_K ?? 0) || wB / wQ;
console.log('neck width: Beginner', wB.toFixed(3), 'base', wQ.toFixed(3), '→ head size', k.toFixed(3), '(neck→head: Beginner', hB.distanceTo(nkB).toFixed(3), 'base', hQ.distanceTo(nkQ).toFixed(3) + ')');
const M = new THREE.Matrix4().makeTranslation(hB.x, hB.y, hB.z).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-hQ.x, -hQ.y, -hQ.z));
const NM = new THREE.Matrix3().getNormalMatrix(M);

// the texture: the atlas, a band added under it for the base head's skin, the hair and the eyes
const tex = bPrim.getMaterial().getBaseColorTexture();
const bImg = sharp(Buffer.from(tex.getImage())); const bMeta = await bImg.metadata(); const TW = bMeta.width, TH = bMeta.height;
const bRaw = await bImg.ensureAlpha().raw().toBuffer();
const BAND = TW / 2, NH = TH + BAND; // (the band: the skin TW/2 square, the hair 3/8, the eyes 1/8)
const SK = { x: 0, y: TH, s: BAND }, HR = { x: BAND, y: TH, s: (BAND * 3) / 4 }, EY = { x: BAND + (BAND * 3) / 4, y: TH, s: BAND / 4 };
const imgOf = async (d, mat) => { const t = mat.getBaseColorTexture(); if (t?.getImage()) return sharp(Buffer.from(t.getImage())); const uri = t?.getURI(); return sharp(path.join(path.dirname(basePath), uri)); };
// (SKIN_TEX: another of the base body's skin textures — its light one for a light-skinned Beginner)
const sample = (raw, W, H, u, v) => { const x = Math.min(W - 1, Math.max(0, Math.round(u * W - 0.5))), y = Math.min(H - 1, Math.max(0, Math.round(v * H - 0.5))), q = 4 * (y * W + x); return [raw[q], raw[q + 1], raw[q + 2]]; };
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const median = (arr) => [0, 1, 2].map((c) => arr.map((x) => x[c]).sort((a, b) => a - b)[arr.length >> 1]);
// the Beginner's own colours: the skin of its bare forearms (not the bracers' leather), its hair (the dark of the drawn head)
const neckCols = [], headCols = [];
for (let i = 0; i < nB; i++) {
  bUV.getElement(i, uv2); const c = sample(bRaw, TW, TH, uv2[0], uv2[1]);
  if (onHead[i] > 0.5) headCols.push(c); else if (weightOn(RB.names, bJ, bW, i, /^lowerarm_[lr]$/) > 0.7 && c[0] > c[2] + 30 && lum(c) > 140) neckCols.push(c);
}
neckCols.sort((a, b) => lum(a) - lum(b)); headCols.sort((a, b) => lum(a) - lum(b));
const skinB = median(neckCols.slice(Math.floor(neckCols.length * 0.35))), hairB = median(headCols.slice(Math.floor(headCols.length * 0.15), Math.floor(headCols.length * 0.45)));
console.log('Beginner skin', skinB, 'hair', hairB);

// the rest of the drawn head: above the neck's foot only the shirt's collar stays (the neck is the base head's now), and
// no drawn hair is left at the nape or down the back (a ponytail hangs on the neck and the spine, not the head)
const PONY = process.env.PONY === '1', ponyT = [], collarCols = [];
let paintTri = null; const clB0 = RB.at('clavicle_r'), skinT = [], skinKeys = new Set();
{
  const nk = RB.at('neck_01'), cl = RB.at('clavicle_r'), neckFoot = nk.y + 0.1 * (hB.y - nk.y), a = [0, 0, 0];
  const all = keep.splice(0); let cut = 0; const paint = [], collarT = new Set();
  for (let t = 0; t < all.length; t += 3) {
    let cy = 0, cz = 0, col = [0, 0, 0];
    for (let kk = 0; kk < 3; kk++) { bP.getElement(all[t + kk], a); cy += a[1] / 3; cz += a[2] / 3; bUV.getElement(all[t + kk], uv2); const c = sample(bRaw, TW, TH, uv2[0], uv2[1]); col = col.map((v, i) => v + c[i] / 3); }
    let cx = 0; for (let kk = 0; kk < 3; kk++) { bP.getElement(all[t + kk], a); cx += a[0] / 3; }
    const L = lum(col), sat = (Math.max(...col) - Math.min(...col)) / Math.max(1, Math.max(...col)), r = Math.hypot(cx - nk.x, cz - nk.z);
    const collar = L > 175 && sat < 0.3, hairy = L < 125 && col[0] >= col[2];
    if (collar && r < 0.1) collarCols.push(col);
    if (collar) collarT.add(`${all[t]},${all[t + 1]},${all[t + 2]}`);
    // above the neck's foot: the collar only; the drawn hair round the neck goes (the drawn neck itself stays: the base
    // head's neck goes into it); a ponytail down the back (PONY): above the neck's foot it goes, below it is pressed
    // into the back (below: no hole is left where it lay)
    const back = cy > cl.y - 0.02 && cz < nk.z - 0.035 && hairy || cy > cl.y && cz < nk.z - 0.06;
    const flown = PONY && cz < nk.z - 0.14 && cy > cl.y - 0.15; // (the drawing's ponytail flew out behind: its strands lower down)
    // (the hair lying on the neck just above its foot is the neck's surface there — painted skin below, not cut)
    const hairOut = cy > neckFoot && hairy && r > (cy < neckFoot + 0.035 ? 0.09 : 0.07);
    if (hairOut || cy > hB.y - 0.01 && !collar || PONY && back && cy > neckFoot || flown) { gone.push(all[t], all[t + 1], all[t + 2]); cut++; continue; } // (or above the jaw)
    if (PONY && back) { ponyT.push(all[t], all[t + 1], all[t + 2]); keep.push(all[t], all[t + 1], all[t + 2]); continue; }
    // the drawn neck painted skin (its shadow and the hair the drawing laid over it); the hair left on the shoulders' back
    // painted the vest's leather
    if (!collar && cy > neckFoot - 0.035 && r < 0.09) { paint.push([t, all, skinB]); skinT.push(all[t], all[t + 1], all[t + 2]); skinKeys.add(`${all[t]},${all[t + 1]},${all[t + 2]}`); }
    else if (PONY && hairy && cy > cl.y - 0.06 && cz < nk.z - 0.02) paint.push([t, all, null]); // (where her hair lay on the vest)
    keep.push(all[t], all[t + 1], all[t + 2]);
  }
  // what is left of it in loose bits above the shoulders goes too (the welded pieces of fewer than 150 triangles)
  {
    const key = (i) => { bP.getElement(i, a); return `${Math.round(a[0] * 2e4)},${Math.round(a[1] * 2e4)},${Math.round(a[2] * 2e4)}`; };
    const id = new Map(), wid = new Int32Array(nB); for (let i = 0; i < nB; i++) { const kk = key(i); if (!id.has(kk)) id.set(kk, id.size); wid[i] = id.get(kk); }
    const par = new Int32Array(id.size).map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let t = 0; t < keep.length; t += 3) { const u = find(wid[keep[t]]); par[find(wid[keep[t + 1]])] = u; par[find(wid[keep[t + 2]])] = u; }
    const size = new Map(), high = new Map(), white = new Map();
    for (let t = 0; t < keep.length; t += 3) { const c = find(wid[keep[t]]); size.set(c, (size.get(c) || 0) + 1); if (collarT.has(`${keep[t]},${keep[t + 1]},${keep[t + 2]}`)) white.set(c, (white.get(c) || 0) + 1); bP.getElement(keep[t], a); high.set(c, Math.max(high.get(c) ?? -9, a[1])); }
    const all2 = keep.splice(0); let bits = 0;
    // (a piece of the shirt's collar stays: the man's stands round the back of his neck)
    for (let t = 0; t < all2.length; t += 3) { const c = find(wid[all2[t]]); if (size.get(c) < 400 && high.get(c) > cl.y - 0.06 && (white.get(c) || 0) < 0.6 * size.get(c)) { gone.push(all2[t], all2[t + 1], all2[t + 2]); bits++; } else keep.push(all2[t], all2[t + 1], all2[t + 2]); }
    cut += bits;
  }
  console.log('more of the drawn head and its hair cut', cut, '(neck foot', neckFoot.toFixed(3) + ')');
  // the paint: each triangle's own texels (a pixel round them too)
  const vest = (() => { const cs = []; for (let i = 0; i < nB; i++) { if (weightOn(RB.names, bJ, bW, i, /^spine_03$/) < 0.7) continue; bUV.getElement(i, uv2); const c = sample(bRaw, TW, TH, uv2[0], uv2[1]); if (lum(c) < 140 && c[0] > c[2]) cs.push(c); } return cs.length ? median(cs) : [70, 45, 32]; })();
  const tri = [[0, 0], [0, 0], [0, 0]];
  paintTri = (arr, t, c) => {
    for (let kk = 0; kk < 3; kk++) { bUV.getElement(arr[t + kk], uv2); tri[kk] = [uv2[0] * TW, uv2[1] * TH]; }
    const [A, Bq, C] = tri, x0 = Math.floor(Math.min(A[0], Bq[0], C[0])) - 1, x1 = Math.ceil(Math.max(A[0], Bq[0], C[0])) + 1, y0 = Math.floor(Math.min(A[1], Bq[1], C[1])) - 1, y1 = Math.ceil(Math.max(A[1], Bq[1], C[1])) + 1;
    const den = (Bq[1] - C[1]) * (A[0] - C[0]) + (C[0] - Bq[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) return;
    const e = 1.5 / Math.max(1, Math.sqrt(Math.abs(den))); // (a pixel's margin in barycentric terms)
    for (let y = Math.max(0, y0); y <= Math.min(TH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(TW - 1, x1); x++) {
      const X = x + 0.5, Y = y + 0.5, l1 = ((Bq[1] - C[1]) * (X - C[0]) + (C[0] - Bq[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -e || l2 < -e || l3 < -e) continue;
      const q = 4 * (y * TW + x); for (let ch = 0; ch < 3; ch++) bRaw[q + ch] = c[ch];
    }
  };
  for (const [t, arr, col] of paint) paintTri(arr, t, col ?? vest);
  paintTri.vest = vest;
  console.log('painted', paint.length, 'triangles (skin round the neck, leather where hair lay on the back)');
}

const band = Buffer.alloc(TW * BAND * 4); for (let i = 0; i < TW * BAND; i++) band[4 * i + 3] = 255;
/** Paint a base texture into a block of the band, its colours moved to `want` (by the mean of `ref`'s texels). */
const put = async (img, blk, gain, sat = 1, flat = 0, prim = null) => {
  const sized = img.resize(blk.s, blk.s, { fit: 'fill' }).ensureAlpha();
  const raw = await sized.clone().raw().toBuffer(), S = blk.s, n = S * S;
  // flat: its broad tones evened out (a face painted lighter in the middle than round the jaw), the details kept — the
  // broad tones taken from the texels of its own pieces only (`prim`'s triangles), not the empty ground between them
  let soft = null; const mean = [0, 0, 0];
  if (flat) {
    const mask = new Uint8Array(n).fill(prim ? 0 : 255);
    if (prim) {
      const UV = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices().getArray(), q = [[0, 0], [0, 0], [0, 0]];
      for (let t = 0; t < I.length; t += 3) {
        for (let kk = 0; kk < 3; kk++) { UV.getElement(I[t + kk], uv2); q[kk] = [uv2[0] * S, uv2[1] * S]; }
        const [A, B, C] = q, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
        const e = 1 / Math.max(1, Math.sqrt(Math.abs(den)));
        for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1); y <= Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1); x <= Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1); x++) {
          const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
          if (l1 >= -e && l2 >= -e && 1 - l1 - l2 >= -e) mask[y * S + x] = 255;
        }
      }
    }
    const m4 = Buffer.alloc(n * 4), w4 = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) m4[4 * i + c] = Math.round((raw[4 * i + c] * mask[i]) / 255); m4[4 * i + 3] = 255; w4[4 * i] = w4[4 * i + 1] = w4[4 * i + 2] = mask[i]; w4[4 * i + 3] = 255; }
    const bl = await sharp(m4, { raw: { width: S, height: S, channels: 4 } }).blur(S / 40).raw().toBuffer(), bw = await sharp(w4, { raw: { width: S, height: S, channels: 4 } }).blur(S / 40).raw().toBuffer();
    soft = new Float32Array(n * 4); let cnt = 0;
    for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) soft[4 * i + c] = bw[4 * i] > 24 ? (bl[4 * i + c] * 255) / bw[4 * i] : raw[4 * i + c]; if (mask[i]) { cnt++; for (let c = 0; c < 3; c++) mean[c] += soft[4 * i + c]; } }
    for (let c = 0; c < 3; c++) mean[c] /= Math.max(1, cnt);
  }
  for (let y = 0; y < blk.s; y++) for (let x = 0; x < blk.s; x++) {
    const s = 4 * (y * blk.s + x), d = 4 * ((blk.y - TH + y) * TW + blk.x + x);
    const c3 = [0, 1, 2].map((c) => (raw[s + c] - (soft ? (soft[s + c] - mean[c]) * flat : 0)) * gain[c]), g = lum(c3); // (sat: the colour pushed away from its grey)
    for (let c = 0; c < 3; c++) band[d + c] = Math.max(0, Math.min(255, Math.round(g + (c3[c] - g) * sat)));
  }
};
const meanAt = async (img, prim, keepV) => {
  const meta = await img.metadata(), raw = await img.clone().ensureAlpha().raw().toBuffer(), UV = prim.getAttribute('TEXCOORD_0'), cols = [];
  for (let i = 0; i < UV.getCount(); i++) { if (keepV && !keepV(i)) continue; UV.getElement(i, uv2); cols.push(sample(raw, meta.width, meta.height, uv2[0], uv2[1])); }
  cols.sort((a, b) => lum(a) - lum(b)); return median(cols.slice(Math.floor(cols.length * 0.6)));
};

const out = { P: [], N: [], UV: [], J: [], W: [], I: [] };
const bIndex = new Map(RB.names.map((n, i) => [n, i])), headIdx = bIndex.get('Head');
/** Lay a primitive's chosen triangles into the body: placed by M, its joints by name, its uvs into a block. */
const lay = (R, prim, pick, blk, solid) => {
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices().getArray(), n = P.getCount();
  const map = new Int32Array(n).fill(-1), v = new THREE.Vector3(), nv = new THREE.Vector3(), n3 = [0, 0, 0];
  let tris = 0;
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]]; if (!tri.every((i) => pick(i))) continue;
    tris++;
    for (const i of tri) {
      if (map[i] < 0) {
        map[i] = nB + out.P.length / 3;
        P.getElement(i, p3); v.fromArray(p3).applyMatrix4(M); out.P.push(v.x, v.y, v.z);
        if (N) { N.getElement(i, n3); nv.fromArray(n3).applyMatrix3(NM).normalize(); } else nv.set(0, 1, 0); out.N.push(nv.x, nv.y, nv.z);
        if (UV) UV.getElement(i, uv2); else uv2[0] = uv2[1] = 0.5;
        const u = uv2[0] - Math.floor(uv2[0]), w = uv2[1] - Math.floor(uv2[1]); // (the eyes' uvs run past 1: tiled)
        out.UV.push((blk.x + 0.5 + u * (blk.s - 1)) / TW, (blk.y + 0.5 + w * (blk.s - 1)) / NH);
        const js = [headIdx, 0, 0, 0], ws = [1, 0, 0, 0];
        if (!solid && J && W) {
          J.getElement(i, j4); W.getElement(i, w4); const jw = new Map();
          for (let kk = 0; kk < 4; kk++) { if (w4[kk] <= 0) continue; const bi = bIndex.get(R.names[j4[kk]]); if (bi === undefined) continue; jw.set(bi, (jw.get(bi) || 0) + w4[kk]); }
          const ent = [...jw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = ent.reduce((a, e) => a + e[1], 0) || 1;
          ent.forEach(([bi, ww], kk) => { js[kk] = bi; ws[kk] = ww / sum; });
        }
        out.J.push(...js); out.W.push(...ws);
      }
      out.I.push(map[i]);
    }
  }
  return tris;
};

// the base head: the body's head (and a little of its neck, to sit inside the Beginner's), its eyes and brows
const qMat = qBody.getMaterial(), qImg = process.env.SKIN_TEX ? sharp(path.join(path.dirname(basePath), process.env.SKIN_TEX)) : await imgOf(base, qMat);
const qJ = qBody.getAttribute('JOINTS_0'), qW = qBody.getAttribute('WEIGHTS_0');
const qP = qBody.getAttribute('POSITION');
// the head and its neck down to the neck's root (it goes into the drawn neck)
const qHead = (i) => { if (weightOn(RQ.names, qJ, qW, i, /^Head$/) > 0.3) return true; if (weightOn(RQ.names, qJ, qW, i, /^neck_01$/) < 0.5) return false; qP.getElement(i, p3); return p3[1] > nkQ.y - 0.01; };
const skinQ = await meanAt(qImg, qBody, qHead);
await put(qImg, SK, skinB.map((c, i) => c / Math.max(1, skinQ[i])), 1.12, 0.75, qBody);
console.log('base skin', skinQ, 'head triangles', lay(RQ, qBody, qHead, SK, false));
// the base neck made as thick as the drawn one at each height, a little inside it (it goes into it, no gap round it)
{
  const nHead = out.P.length / 3, nk = RB.at('neck_01'), a = [0, 0, 0], step = 0.006, yTop = hB.y + 0.01;
  const rad = (x, z) => Math.hypot(x - nk.x, z - nk.z);
  const band = (y) => Math.floor(y / step);
  const rB = new Map(), rQ = new Map();
  const ponyV = new Set(ponyT);
  const seen = new Set(); for (const i of keep) { if (seen.has(i) || ponyV.has(i)) continue; seen.add(i); if (weightOn(RB.names, bJ, bW, i, /^(neck_01|Head)$/) < 0.5) continue; bP.getElement(i, a); if (a[1] > yTop || rad(a[0], a[2]) > 0.13) continue; const b = band(a[1]); if (!rB.has(b)) rB.set(b, []); rB.get(b).push(rad(a[0], a[2])); }
  for (let i = 0; i < nHead; i++) { const y = out.P[3 * i + 1]; if (y > yTop) continue; const b = band(y); if (!rQ.has(b)) rQ.set(b, []); rQ.get(b).push(rad(out.P[3 * i], out.P[3 * i + 2])); }
  const med = (l) => l.sort((p, q) => p - q)[Math.floor(l.length * 0.5)];
  const ratio = new Map(); for (const [b, l] of rQ) { const lb = rB.get(b); if (lb && lb.length > 6 && l.length > 3) ratio.set(b, Math.min(1.5, Math.max(0.8, (0.96 * med(lb)) / med(l)))); }
  let moved = 0;
  for (let i = 0; i < nHead; i++) {
    const y = out.P[3 * i + 1]; if (y > yTop) continue;
    const r0 = ratio.get(band(y)); if (r0 === undefined) continue;
    const t = Math.max(0, Math.min(1, (y - (hB.y - 0.03)) / 0.04)), kk = r0 + (1 - r0) * t * t * (3 - 2 * t); // (up to the jaw as it is)
    out.P[3 * i] = nk.x + (out.P[3 * i] - nk.x) * kk; out.P[3 * i + 2] = nk.z + (out.P[3 * i + 2] - nk.z) * kk; moved++;
  }
  console.log('neck fitted into the drawn neck:', [...ratio.entries()].sort((p, q) => p[0] - q[0]).map(([b, r]) => `${(b * step).toFixed(3)}:${r.toFixed(2)}`).join(' '), 'moved', moved);
  // the drawn neck (painted skin) where the base neck covers it: laid just inside it (its ragged pieces stuck out of it)
  {
    const nkp = RB.at('neck_01'), bins = 32, th = (x, z) => Math.floor(((Math.atan2(x - nkp.x, z - nkp.z) + Math.PI) / (2 * Math.PI)) * bins) % bins;
    const lowY = new Float32Array(bins).fill(9), rmin = new Map(), key2 = (b, y) => b * 10000 + Math.floor(y / 0.006);
    for (let i = 0; i < nHead; i++) {
      const x = out.P[3 * i], y = out.P[3 * i + 1], z = out.P[3 * i + 2], r = Math.hypot(x - nkp.x, z - nkp.z); if (r > 0.11 || y > hB.y + 0.02) continue;
      const b = th(x, z); lowY[b] = Math.min(lowY[b], y); const kk = key2(b, y); rmin.set(kk, Math.min(rmin.get(kk) ?? 9, r));
    }
    const wkey = (i) => { bP.getElement(i, a); return `${Math.round(a[0] * 2e4)},${Math.round(a[1] * 2e4)},${Math.round(a[2] * 2e4)}`; };
    const skinW = new Set(skinT.map(wkey)), other = new Set(); for (let t = 0; t < keep.length; t += 3) { const k3 = `${keep[t]},${keep[t + 1]},${keep[t + 2]}`; if (!skinKeys.has(k3)) for (let kk = 0; kk < 3; kk++) other.add(wkey(keep[t + kk])); }
    let laid = 0; const done = new Set();
    for (const i of new Set(keep)) {
      const w = wkey(i); if (!skinW.has(w) || other.has(w)) continue;
      bP.getElement(i, a); const r = Math.hypot(a[0] - nkp.x, a[2] - nkp.z), b = th(a[0], a[2]); if (a[1] < lowY[b] + 0.004) continue;
      const rm = rmin.get(key2(b, a[1])); if (rm === undefined || r < rm - 0.003) continue;
      const f = (rm - 0.003) / Math.max(1e-6, r); a[0] = nkp.x + (a[0] - nkp.x) * f; a[2] = nkp.z + (a[2] - nkp.z) * f; bP.setElement(i, a); if (!done.has(w)) { done.add(w); laid++; }
    }
    console.log('drawn neck laid inside the base neck:', laid, 'points');
  }
  // the ponytail pressed into the back (PONY): the back seen from behind as a depth map (the nearest-to-the-viewer z in
  // each 6 mm cell) of everything round it — the shirt and the vest below and beside it, the base neck above — a thin
  // plate spline through it across where the hair lay, the hair's points laid on it 2 mm out; painted the shirt (the
  // vest's leather low on the back) and carried by the upper spine
  if (ponyT.length) {
    const hv = [...new Set(ponyT)], hs = new Set(hv);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const i of hv) { bP.getElement(i, a); x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); }
    // (the body only: the drawing's ponytail flew out behind the head, 30 cm — its lighter strands are not the back)
    const m = 0.04, cell = 0.006, cells = new Map(), zMin = nk.z - 0.14, rows = new Map(), row = (y) => Math.floor(y / 0.01);
    const add = (x, y, z) => {
      if (x < x0 - m || x > x1 + m || y < y0 - m || y > y1 + m || z < zMin) return;
      const r0 = rows.get(row(y)); if (!r0) rows.set(row(y), [x, x]); else { r0[0] = Math.min(r0[0], x); r0[1] = Math.max(r0[1], x); }
      if (z > nk.z - 0.005) return; const kk = `${Math.floor(x / cell)},${Math.floor(y / cell)}`; const c = cells.get(kk); if (!c || z < c[2]) cells.set(kk, [x, y, z]);
    };
    const seen2 = new Set(); for (const i of keep) { if (hs.has(i) || seen2.has(i)) continue; seen2.add(i); bP.getElement(i, a); add(a[0], a[1], a[2]); }
    for (let i = 0; i < nHead; i++) if (out.P[3 * i + 1] < hB.y - 0.02) add(out.P[3 * i], out.P[3 * i + 1], out.P[3 * i + 2]);
    // inside the body's outline seen from behind (each 1 cm row's width, the rows round it)
    const inside = (x, y) => { for (const d of [0, -1, 1]) { const r0 = rows.get(row(y) + d); if (r0 && x > r0[0] - 0.004 && x < r0[1] + 0.004) return true; } return false; };
    let pts = [...cells.values()]; const stride = Math.max(1, Math.ceil(pts.length / 420)); pts = pts.filter((_, i) => i % stride === 0);
    const n = pts.length, N = n + 3, A = Array.from({ length: N }, () => new Float64Array(N + 1)), phi = (r2) => (r2 > 1e-12 ? 0.5 * r2 * Math.log(r2) : 0);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] = phi((pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2) + (i === j ? 1e-7 : 0); A[i][n] = 1; A[i][n + 1] = pts[i][0]; A[i][n + 2] = pts[i][1]; A[n][i] = 1; A[n + 1][i] = pts[i][0]; A[n + 2][i] = pts[i][1]; A[i][N] = pts[i][2]; }
    for (let c = 0; c < N; c++) { let piv = c; for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; const d = A[c][c] || 1e-12; for (let r = 0; r < N; r++) { if (r === c) continue; const f = A[r][c] / d; if (f) for (let k2 = c; k2 <= N; k2++) A[r][k2] -= f * A[c][k2]; } }
    const wv = A.map((row, i) => row[N] / (row[i] || 1e-12));
    const zAt = (x, y) => { let z = wv[n] + wv[n + 1] * x + wv[n + 2] * y; for (let i = 0; i < n; i++) z += wv[i] * phi((x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2); return z; };
    const sp3 = bIndex.get('spine_03'), nk1 = bIndex.get('neck_01'), JA = bJ.getArray(), WA = bW.getArray(), wsc = WA instanceof Float32Array ? 1 : WA instanceof Uint8Array ? 255 : 65535;
    // the strands far out behind the back or outside its outline go; the rest is pressed onto it
    const ok = new Map(); for (const i of hv) { bP.getElement(i, a); const z = zAt(a[0], a[1]); ok.set(i, inside(a[0], a[1]) && a[2] > z - 0.07 && a[2] < z + 0.12); }
    const kept = keep.splice(0), drop = new Set(); for (let t = 0; t < ponyT.length; t += 3) if (![0, 1, 2].every((kk) => ok.get(ponyT[t + kk]))) drop.add(`${ponyT[t]},${ponyT[t + 1]},${ponyT[t + 2]}`);
    for (let t = 0; t < kept.length; t += 3) (drop.has(`${kept[t]},${kept[t + 1]},${kept[t + 2]}`) ? gone : keep).push(kept[t], kept[t + 1], kept[t + 2]);
    const pt2 = ponyT.splice(0); for (let t = 0; t < pt2.length; t += 3) if (!drop.has(`${pt2[t]},${pt2[t + 1]},${pt2[t + 2]}`)) ponyT.push(pt2[t], pt2[t + 1], pt2[t + 2]);
    let dz = 0;
    for (const i of hv) {
      if (!ok.get(i)) continue;
      bP.getElement(i, a); const z = zAt(a[0], a[1]) - 0.002; dz = Math.max(dz, Math.abs(z - a[2])); a[2] = z; bP.setElement(i, a);
      const up = Math.max(0, Math.min(0.4, (a[1] - clB0.y) / 0.08)), q0 = wsc === 1 ? 1 - up : Math.round((1 - up) * wsc);
      JA[4 * i] = sp3; JA[4 * i + 1] = nk1; JA[4 * i + 2] = 0; JA[4 * i + 3] = 0; WA[4 * i] = q0; WA[4 * i + 1] = wsc - q0; WA[4 * i + 2] = 0; WA[4 * i + 3] = 0;
    }
    const shirt = collarCols.length ? median(collarCols) : [225, 215, 200], line = clB0.y - 0.025;
    for (let t = 0; t < ponyT.length; t += 3) { let cy = 0; for (let kk = 0; kk < 3; kk++) { bP.getElement(ponyT[t + kk], a); cy += a[1] / 3; } paintTri(ponyT, t, cy > line ? shirt : paintTri.vest); }
    console.log('ponytail pressed into the back:', ponyT.length / 3, 'triangles (', drop.size, 'out behind it gone), through', n, 'points, moved up to', (dz * 100).toFixed(1), 'cm; shirt', shirt.map(Math.round));
  }
}
/** The ponytail (PONYTAIL=1): tied high at the back of the head (where the pulled-back hair gathers), springing out a
 *  little and falling down the back in clumps of strands that spread and come together at their tips; the strands drawn
 *  from the hair texture's long locks (a block of the band: x 3/4..1 of it, under the eyes), a red tie round it. It hangs
 *  on the head at the top and on the upper spine down the back (no cloth sim: it follows the back as it bends). */
async function ponytail(hair0, hairImg, gain) {
  const TB = { x: BAND + (BAND * 3) / 4, y: TH + BAND / 4, w: BAND / 4, h: (BAND * 3) / 4 - 32 }, TR = { x: TB.x + 8, y: TH + BAND - 24 };
  // the locks: the lower band of the hair texture (long vertical locks), squeezed into the block
  const meta = await hairImg.metadata();
  const raw = await hairImg.clone().extract({ left: Math.round(meta.width * 0.1), top: Math.round(meta.height * 0.62), width: Math.round(meta.width * 0.8), height: Math.round(meta.height * 0.36) }).resize(TB.w, TB.h, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  for (let y = 0; y < TB.h; y++) for (let x = 0; x < TB.w; x++) { const s0 = 4 * (y * TB.w + x), d = 4 * ((TB.y - TH + y) * TW + TB.x + x); for (let c = 0; c < 3; c++) band[d + c] = Math.max(0, Math.min(255, Math.round(raw[s0 + c] * gain[c]))); }
  // the tie's red: the sash's
  const reds = []; for (let i = 0; i < TW * TH; i += 7) { const q = 4 * i, r = bRaw[q], g = bRaw[q + 1], b = bRaw[q + 2]; if (r > 110 && r > 1.9 * g && r > 1.9 * b) reds.push([r, g, b]); }
  const red = reds.length ? median(reds) : [150, 30, 28];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = 4 * ((TR.y - TH + y) * TW + TR.x + x); for (let c = 0; c < 3; c++) band[d + c] = red[c]; }
  const uvAt = (u, v) => [(TB.x + 0.5 + u * (TB.w - 1)) / TW, (TB.y + 0.5 + v * (TB.h - 1)) / NH];
  // where it is tied: the back of the hair, 60 % of the way from the head's joint to the hair's top
  const V = (i) => new THREE.Vector3(out.P[3 * i], out.P[3 * i + 1], out.P[3 * i + 2]);
  let top = -9, cx = 0, nh = 0; for (let i = hair0; i < out.P.length / 3; i++) { const p = V(i); top = Math.max(top, p.y); cx += p.x; nh++; } cx /= nh;
  const back = (y, from, to, dy = 0.012) => { let z = 9; for (let i = from; i < to; i++) { const p = V(i); if (Math.abs(p.x - cx) < 0.03 && Math.abs(p.y - y) < dy) z = Math.min(z, p.z); } return z; };
  const bodyBack = (y) => { let z = back(y, 0, out.P.length / 3, 0.012); const a3 = [0, 0, 0]; for (const i of new Set(keep)) { bP.getElement(i, a3); if (Math.abs(a3[0] - cx) < 0.035 && Math.abs(a3[1] - y) < 0.012) z = Math.min(z, a3[2]); } return z; };
  const yT = hB.y + 0.6 * (top - hB.y), A = new THREE.Vector3(cx, yT, back(yT, hair0, out.P.length / 3) + 0.006);
  const cl = RB.at('clavicle_r'), sp = [A, A.clone().add(new THREE.Vector3(0, -0.012, -0.065))];
  for (const [y, gap] of [[hB.y - 0.07, 0.055], [cl.y - 0.07, 0.03], [cl.y - 0.19, 0.022]]) sp.push(new THREE.Vector3(cx, y, bodyBack(y) - gap));
  const curve = new THREE.CatmullRomCurve3(sp, false, 'centripetal'), len = curve.getLength();
  const headJ = headIdx, neckJ = bIndex.get('neck_01'), spineJ = bIndex.get('spine_03');
  const sstep = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const frame = (s) => { const T = curve.getTangentAt(Math.min(1, Math.max(0, s))).normalize(), out0 = new THREE.Vector3(0, 0, -1); const N = out0.sub(T.clone().multiplyScalar(out0.dot(T))).normalize(); return { P: curve.getPointAt(Math.min(1, Math.max(0, s))), T, N, B: new THREE.Vector3().crossVectors(T, N).normalize() }; };
  const pushV = (p, n, uv, s) => {
    out.P.push(p.x, p.y, p.z); out.N.push(n.x, n.y, n.z); out.UV.push(uv[0], uv[1]);
    const wh = 1 - sstep((s - 0.1) / 0.35), rest = 1 - wh; out.J.push(headJ, spineJ, neckJ, 0); out.W.push(wh, rest * 0.7, rest * 0.3, 0);
    return nB + out.P.length / 3 - 1;
  };
  // the clumps: across the back (b), a little out (n), each its own width, length and turn
  const K = [[-0.04, 0.004, 0.019, 0.9, 0.2], [-0.02, -0.008, 0.021, 1, -0.15], [0, 0.009, 0.022, 0.97, 0.1], [0.02, -0.006, 0.021, 1, 0.25], [0.04, 0.005, 0.018, 0.86, -0.2], [-0.008, 0.016, 0.016, 0.8, 0.3], [0.012, 0.018, 0.015, 0.76, -0.3]];
  const L = 22, Mr = 8; let tris = 0;
  K.forEach(([ob, on, rc, lf, tw], c) => {
    const u0 = (c * 0.103) % 0.7, rings = [];
    for (let l = 0; l <= L; l++) {
      const s = (l / L) * lf, f = frame(s);
      const spread = (s < 0.06 ? 0.12 : 0.12 + 0.88 * sstep((s - 0.06) / 0.28)) * (1 - 0.45 * sstep((s - 0.55) / 0.45));
      const ang = tw * s * 2, ox = (ob * Math.cos(ang) - on * Math.sin(ang)) * spread, oy = (ob * Math.sin(ang) + on * Math.cos(ang)) * spread;
      const rad = rc * (s < 0.05 ? 0.5 : 0.5 + 0.5 * sstep((s - 0.05) / 0.18)) * Math.pow(Math.max(0, 1 - s / lf), 0.65) * (len / 0.42);
      const C = f.P.clone().addScaledVector(f.B, ox * (len / 0.42)).addScaledVector(f.N, oy * (len / 0.42));
      const ring = [];
      for (let j = 0; j <= Mr; j++) {
        const phi = (j / Mr) * Math.PI * 2, rb = rad * 1.25, rn = rad * 0.8;
        const p = C.clone().addScaledVector(f.B, Math.cos(phi) * rb).addScaledVector(f.N, Math.sin(phi) * rn);
        const n = f.B.clone().multiplyScalar(Math.cos(phi) / rb).addScaledVector(f.N, Math.sin(phi) / rn).normalize();
        ring.push(pushV(p, n, uvAt(u0 + (j / Mr) * 0.28, 0.02 + (s / lf) * 0.96), s));
      }
      rings.push(ring);
    }
    for (let l = 0; l < L; l++) for (let j = 0; j < Mr; j++) { const a0 = rings[l][j], a1 = rings[l][j + 1], b0 = rings[l + 1][j], b1 = rings[l + 1][j + 1]; out.I.push(a0, b0, a1, a1, b0, b1); tris += 2; }
  });
  // the tie: a ring round the tail where it is gathered
  {
    const f = frame(0.035), R = 0.017 * (len / 0.42), r = 0.0075 * (len / 0.42), uv = [(TR.x + 8) / TW, (TR.y + 8) / NH], ring = [];
    for (let a = 0; a <= 16; a++) { const row = []; const th = (a / 16) * Math.PI * 2, d = f.B.clone().multiplyScalar(Math.cos(th)).addScaledVector(f.N, Math.sin(th)); for (let b = 0; b <= 6; b++) { const ph = (b / 6) * Math.PI * 2, n = d.clone().multiplyScalar(Math.cos(ph)).addScaledVector(f.T, Math.sin(ph)); row.push(pushV(f.P.clone().addScaledVector(d, R).addScaledVector(n, r), n, uv, 0)); } ring.push(row); }
    for (let a = 0; a < 16; a++) for (let b = 0; b < 6; b++) { const a0 = ring[a][b], a1 = ring[a][b + 1], b0 = ring[a + 1][b], b1 = ring[a + 1][b + 1]; out.I.push(a0, a1, b0, a1, b1, b0); tris += 2; }
  }
  console.log('ponytail: tied at', A.toArray().map((v) => v.toFixed(3)).join(','), 'length', len.toFixed(3), 'triangles', tris, 'tie red', red);
}
const hairPrim = hair.getRoot().listMeshes()[0].listPrimitives()[0], hairImg = await imgOf(hair, hairPrim.getMaterial());
const hairQ = await meanAt(hairImg, hairPrim, null);
await put(hairImg, HR, hairB.map((c, i) => c / Math.max(1, hairQ[i])));
for (const m of qMeshes) {
  const pr = m.listPrimitives()[0]; if (pr === qBody) continue;
  const mt = pr.getMaterial(), eyes = /Eye/.test(mt?.getName() ?? '');
  if (eyes) await put(await imgOf(base, mt), EY, [1, 1, 1]);
  console.log(m.getName(), eyes ? 'eyes' : 'brows', 'triangles', lay(RQ, pr, () => true, eyes ? EY : HR, false));
}
// the hair: placed as it sits on the base head (its node's own place), all on the head
const hNode = hair.getRoot().listNodes().find((n) => n.getMesh());
const HM = new THREE.Matrix4().fromArray(hNode.getWorldMatrix()), lift = +(process.env.HAIR_LIFT ?? 0);
{
  const P = hairPrim.getAttribute('POSITION'), N = hairPrim.getAttribute('NORMAL'), a = [0, 0, 0], v = new THREE.Vector3(), HN = new THREE.Matrix3().getNormalMatrix(HM);
  const P2 = new Float32Array(P.getCount() * 3), N2 = new Float32Array(P.getCount() * 3);
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, a); v.fromArray(a).applyMatrix4(HM); v.y += lift; v.toArray(P2, 3 * i); if (N) { N.getElement(i, a); v.fromArray(a).applyMatrix3(HN).normalize(); v.toArray(N2, 3 * i); } }
  P.setArray(P2); if (N) N.setArray(N2);
  // both faces of the hair's sheets (it is drawn from both sides)
  const I = hairPrim.getIndices().getArray(), both = new Uint32Array(I.length * 2); both.set(I); for (let t = 0; t < I.length; t += 3) { both[I.length + t] = I[t]; both[I.length + t + 1] = I[t + 2]; both[I.length + t + 2] = I[t + 1]; }
  hairPrim.getIndices().setArray(both);
  // (HAIR_DROP_X: the hair's pieces whose middle is further out to a side than this go — the buns of Hair_Buns)
  const dropX = +(process.env.HAIR_DROP_X ?? 0); let pick = () => true;
  if (dropX) {
    const n = P.getCount(), par = new Int32Array(n).map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const key = new Map(), wid = new Int32Array(n); for (let i = 0; i < n; i++) { P.getElement(i, a); const kk = a.map((q) => Math.round(q * 2e4)).join(','); if (!key.has(kk)) key.set(kk, i); wid[i] = key.get(kk); }
    for (let t = 0; t < I.length; t += 3) { const u = find(wid[I[t]]); par[find(wid[I[t + 1]])] = u; par[find(wid[I[t + 2]])] = u; }
    const lo = new Map(), hi = new Map(); for (let i = 0; i < n; i++) { const c = find(wid[i]); P.getElement(i, a); lo.set(c, Math.min(lo.get(c) ?? 9, a[0])); hi.set(c, Math.max(hi.get(c) ?? -9, a[0])); }
    let cx = 0; for (let i = 0; i < n; i++) { P.getElement(i, a); cx += a[0] / n; }
    const off = new Set([...lo.keys()].filter((c) => Math.abs((lo.get(c) + hi.get(c)) / 2 - cx) > dropX)); pick = (i) => !off.has(find(wid[i]));
    console.log('hair pieces dropped (out to the sides):', off.size);
  }
  const hair0 = out.P.length / 3;
  console.log('hair triangles', lay(RQ, hairPrim, pick, HR, true));
  if (process.env.PONYTAIL === '1') await ponytail(hair0, await imgOf(hair, hairPrim.getMaterial()), hairB.map((c, i) => c / Math.max(1, hairQ[i]))); // (a fresh image: put() resized the other)
}

// the drawn collar and neck round the new neck smoothed (Taubin: no shrinking): the drawing's mesh is ragged there and the
// cuts left jagged edges — the edges smoothed along themselves, the rest over its neighbours
{
  const nkp = RB.at('neck_01'), clp = RB.at('clavicle_r'), a = [0, 0, 0];
  const key = (i) => { bP.getElement(i, a); return `${Math.round(a[0] * 2e4)},${Math.round(a[1] * 2e4)},${Math.round(a[2] * 2e4)}`; };
  const id = new Map(), wid = new Int32Array(nB).fill(-1); for (const i of new Set(keep)) { const kk = key(i); if (!id.has(kk)) id.set(kk, id.size); wid[i] = id.get(kk); }
  const nW = id.size, pos = new Float64Array(nW * 3); for (const i of new Set(keep)) { bP.getElement(i, a); pos.set(a, 3 * wid[i]); }
  const edges = new Map(); const ek = (u, v) => (u < v ? u * nW + v : v * nW + u);
  for (let t = 0; t < keep.length; t += 3) for (let kk = 0; kk < 3; kk++) { const u = wid[keep[t + kk]], v = wid[keep[t + (kk + 1) % 3]]; if (u === v) continue; const e = ek(u, v); edges.set(e, (edges.get(e) || 0) + 1); }
  const nb = Array.from({ length: nW }, () => []), bnb = Array.from({ length: nW }, () => []);
  for (const [e, c] of edges) { const u = Math.floor(e / nW), v = e % nW; nb[u].push(v); nb[v].push(u); if (c === 1) { bnb[u].push(v); bnb[v].push(u); } }
  const inR = new Uint8Array(nW); let nr = 0;
  for (let w = 0; w < nW; w++) { const x = pos[3 * w], y = pos[3 * w + 1], z = pos[3 * w + 2]; if (y > clp.y - 0.03 && y < hB.y + 0.01 && Math.hypot(x - nkp.x, z - nkp.z) < 0.12) { inR[w] = 1; nr++; } }
  const step = (lam) => { const nxt = pos.slice(); for (let w = 0; w < nW; w++) { if (!inR[w]) continue; const L = bnb[w].length >= 2 ? bnb[w] : nb[w]; if (!L.length) continue; for (let c = 0; c < 3; c++) { let m = 0; for (const v of L) m += pos[3 * v + c]; m /= L.length; nxt[3 * w + c] = pos[3 * w + c] + lam * (m - pos[3 * w + c]); } } pos.set(nxt); };
  for (let it = 0; it < +(process.env.SMOOTH ?? 8); it++) { step(0.5); step(-0.53); }
  for (const i of new Set(keep)) { if (!inR[wid[i]]) continue; bP.setElement(i, [pos[3 * wid[i]], pos[3 * wid[i] + 1], pos[3 * wid[i] + 2]]); }
  console.log('collar and neck smoothed:', nr, 'points');
}
// the body's own normals (it had none: it was drawn flat): smooth, across its uv seams (the same place, one normal)
const bN = new Float32Array(nB * 3);
{
  const key = (i) => { bP.getElement(i, p3); return `${Math.round(p3[0] * 2e4)},${Math.round(p3[1] * 2e4)},${Math.round(p3[2] * 2e4)}`; };
  const id = new Map(), wid = new Int32Array(nB); for (let i = 0; i < nB; i++) { const kk = key(i); if (!id.has(kk)) id.set(kk, id.size); wid[i] = id.get(kk); }
  const acc = new Float32Array(id.size * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < keep.length; t += 3) {
    bP.getElement(keep[t], p3); a.fromArray(p3); bP.getElement(keep[t + 1], p3); b.fromArray(p3); bP.getElement(keep[t + 2], p3); c.fromArray(p3);
    const n = b.sub(a).cross(c.sub(a)); // (area-weighted)
    for (let kk = 0; kk < 3; kk++) { const w = wid[keep[t + kk]]; acc[3 * w] += n.x; acc[3 * w + 1] += n.y; acc[3 * w + 2] += n.z; }
  }
  for (let i = 0; i < nB; i++) { const w = wid[i]; a.set(acc[3 * w], acc[3 * w + 1], acc[3 * w + 2]).normalize(); if (!isFinite(a.x)) a.set(0, 1, 0); a.toArray(bN, 3 * i); }
}

// the primitive: its own vertices (their uvs into the atlas's top) + the new head, the drawn head's triangles out
const cat = (A, add, T) => { const old = A.getArray(); const n = new T(old.length + add.length); n.set(old); n.set(add, old.length); A.setArray(n); };
{ const uv = bUV.getArray(), n = new Float32Array(uv.length); for (let i = 0; i < uv.length; i += 2) { n[i] = uv[i]; n[i + 1] = (uv[i + 1] * TH) / NH; } bUV.setArray(n); }
cat(bP, out.P, Float32Array); cat(bUV, out.UV, Float32Array);
const nAcc = doc.createAccessor().setType('VEC3').setArray(new Float32Array([...bN, ...out.N])).setBuffer(doc.getRoot().listBuffers()[0]);
bPrim.setAttribute('NORMAL', nAcc);
const JT = bJ.getArray().constructor; cat(bJ, out.J, JT);
const WT = bW.getArray().constructor; cat(bW, WT === Float32Array ? out.W : out.W.map((w) => Math.round(w * (WT === Uint8Array ? 255 : 65535))), WT);
bPrim.getIndices().setArray(new Uint32Array([...keep, ...out.I]));
const full = Buffer.concat([bRaw, band]);
tex.setImage(await sharp(full, { raw: { width: TW, height: NH, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outPath, doc);
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB', 'verts', nB + out.P.length / 3);
