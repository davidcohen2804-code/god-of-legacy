// The Beginner's hands with fingers (David 25 Oct: "the sword's grip in the hand is faulty"): the drawn hands are one
// open piece (the fingers folded into the hand: a weapon passed through the open palm); they are replaced by the hands of
// the Quaternius base body (CC0) whose skeleton the Beginner wears — fingers on their own bones, so a fist closes round
// the hilt in every move that grips. Each hand is laid into the Beginner's own hand (its wrist, its knuckles' line, its
// size), the drawn hand's triangles dropped; the glove and the bare fingertips coloured from the drawn hand.
// node hands.mjs BODY.glb BASE.gltf OUT.glb   (run where @gltf-transform, meshoptimizer and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from '/home/claude/god-of-legacy/node_modules/three/build/three.module.js';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [bodyPath, basePath, outPath] = process.argv.slice(2);

const doc = await io.read(bodyPath); await doc.transform(dequantize());
const base = await io.read(basePath);

/** A skinned primitive's data: positions, joints (names), weights, its skin's bind matrices by bone name. */
function skinned(d, pick) {
  const root = d.getRoot(), skin = root.listSkins()[0];
  const names = skin.listJoints().map((n) => n.getName());
  const ibm = skin.getInverseBindMatrices().getArray();
  const bind = new Map(names.map((nm, i) => [nm, new THREE.Matrix4().fromArray(ibm.slice(16 * i, 16 * i + 16)).invert()]));
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  const prim = pick(prims);
  return { names, bind, prim };
}
const B = skinned(doc, (ps) => ps[0]);
const Q = skinned(base, (ps) => ps.reduce((a, b) => (b.getAttribute('POSITION').getCount() > a.getAttribute('POSITION').getCount() ? b : a)));
const at = (S, nm) => new THREE.Vector3().setFromMatrixPosition(S.bind.get(nm));

/** A hand's frame in its body at bind: the wrist, along the middle finger's root, across the knuckles (index → pinky). */
function frame(S, s) {
  const o = at(S, `hand_${s}`), a = at(S, `middle_01_${s}`).sub(o), b = at(S, `index_01_${s}`).sub(at(S, `pinky_01_${s}`));
  const e1 = a.clone().normalize(), e2 = b.clone().addScaledVector(e1, -b.dot(e1)).normalize(), e3 = new THREE.Vector3().crossVectors(e1, e2);
  return { o, len: a.length(), R: new THREE.Matrix4().makeBasis(e1, e2, e3) };
}

const out = { P: [], UV: [], J: [], W: [], I: [] };
const bP = B.prim.getAttribute('POSITION'), bUV = B.prim.getAttribute('TEXCOORD_0'), bJ = B.prim.getAttribute('JOINTS_0'), bW = B.prim.getAttribute('WEIGHTS_0');
const bI = B.prim.getIndices().getArray(), nB = bP.getCount();
const tmp = [0, 0, 0, 0], tmpw = [0, 0, 0, 0];
/** How much of a vertex hangs on each hand (the hand bone and its fingers). */
const HAND = /^(?:hand|thumb|index|middle|ring|pinky)(?:_\d+)?(?:_leaf)?_(l|r)$/;
const handOf = (names, J, W, i) => { J.getElement(i, tmp); W.getElement(i, tmpw); const r = { l: 0, r: 0 }; for (let k = 0; k < 4; k++) { const m = HAND.exec(names[tmp[k]] ?? ''); if (m) r[m[1]] += tmpw[k]; } return r; };

// the drawn hands: their triangles go, their colours are sampled (the glove, the bare skin)
const isHand = new Uint8Array(nB);
for (let i = 0; i < nB; i++) { const h = handOf(B.names, bJ, bW, i); isHand[i] = h.l > 0.5 ? 1 : h.r > 0.5 ? 2 : 0; }
const keep = [], dropped = [];
for (let t = 0; t < bI.length; t += 3) { const a = bI[t], b = bI[t + 1], c = bI[t + 2]; if (isHand[a] && isHand[b] && isHand[c]) dropped.push(a, b, c); else keep.push(a, b, c); }
console.log('drawn hand triangles dropped', dropped.length / 3, 'of', bI.length / 3);

// the texture: decoded, the drawn hands' colours sampled, two patches painted in an empty corner of the atlas
const mat = B.prim.getMaterial(), texI = mat.getBaseColorTexture();
const img = sharp(Buffer.from(texI.getImage())); const meta = await img.metadata();
const raw = await img.ensureAlpha().raw().toBuffer(); const TW = meta.width, TH = meta.height;
const px = (u, v) => { const x = Math.min(TW - 1, Math.max(0, Math.round(u * TW))), y = Math.min(TH - 1, Math.max(0, Math.round(v * TH))); const k = 4 * (y * TW + x); return [raw[k], raw[k + 1], raw[k + 2]]; };
const samples = []; const uvt = [0, 0];
for (let t = 0; t < dropped.length; t++) { bUV.getElement(dropped[t], uvt); samples.push(px(uvt[0], uvt[1])); }
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
samples.sort((a, b) => lum(a) - lum(b));
const med = (arr) => [0, 1, 2].map((k) => arr.map((c) => c[k]).sort((a, b) => a - b)[arr.length >> 1]);
const glove = med(samples.slice(Math.floor(samples.length * 0.1), Math.floor(samples.length * 0.5)));
const skin = med(samples.slice(Math.floor(samples.length * 0.8)));
console.log('glove', glove, 'skin', skin);
// the drawn hands' own patches of the atlas are free now: painted in the glove's colour, with a block of bare skin
const mask = new Uint8Array(TW * TH); const t3 = [[0, 0], [0, 0], [0, 0]];
for (let t = 0; t < dropped.length; t += 3) {
  for (let k = 0; k < 3; k++) { bUV.getElement(dropped[t + k], uvt); t3[k] = [uvt[0] * TW, uvt[1] * TH]; }
  const [A, Bq, C] = t3, x0 = Math.floor(Math.min(A[0], Bq[0], C[0])), x1 = Math.ceil(Math.max(A[0], Bq[0], C[0])), y0 = Math.floor(Math.min(A[1], Bq[1], C[1])), y1 = Math.ceil(Math.max(A[1], Bq[1], C[1]));
  const den = (Bq[1] - C[1]) * (A[0] - C[0]) + (C[0] - Bq[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const X = x + 0.5, Y = y + 0.5, l1 = ((Bq[1] - C[1]) * (X - C[0]) + (C[0] - Bq[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l3 = 1 - l1 - l2;
    if (l1 >= -0.02 && l2 >= -0.02 && l3 >= -0.02 && x >= 0 && y >= 0 && x < TW && y < TH) mask[y * TW + x] = 1;
  }
}
// two blocks wholly inside the freed patches (the colours sit far from any other chart, even in the smaller mip levels)
const blocks = [];
for (let BS = 12; BS >= 4 && blocks.length < 2; BS -= 2) for (let y = 0; y + BS < TH && blocks.length < 2; y += 2) for (let x = 0; x + BS < TW && blocks.length < 2; x += 2) {
  let ok = true; for (let yy = y; yy < y + BS && ok; yy++) for (let xx = x; xx < x + BS; xx++) if (!mask[yy * TW + xx]) { ok = false; break; }
  if (ok && !blocks.some(([bx, by]) => Math.abs(bx - x) < 2 * BS && Math.abs(by - y) < 2 * BS)) blocks.push([x, y, BS]);
}
if (blocks.length < 2) throw new Error('no room in the freed patches');
let freed = 0; for (let i = 0; i < TW * TH; i++) if (mask[i]) { raw[4 * i] = glove[0]; raw[4 * i + 1] = glove[1]; raw[4 * i + 2] = glove[2]; freed++; }
const [sx, sy, SB] = blocks[1]; for (let y = sy; y < sy + SB; y++) for (let x = sx; x < sx + SB; x++) { const k = 4 * (y * TW + x); raw[k] = skin[0]; raw[k + 1] = skin[1]; raw[k + 2] = skin[2]; }
const uvGlove = [(blocks[0][0] + blocks[0][2] / 2) / TW, (blocks[0][1] + blocks[0][2] / 2) / TH], uvSkin = [(sx + SB / 2) / TW, (sy + SB / 2) / TH];
console.log('freed texels', freed, 'blocks', JSON.stringify(blocks));

// the base body's hands, laid into the Beginner's
const qP = Q.prim.getAttribute('POSITION'), qJ = Q.prim.getAttribute('JOINTS_0'), qW = Q.prim.getAttribute('WEIGHTS_0'), qI = Q.prim.getIndices().getArray(), nQ = qP.getCount();
const bIndex = new Map(B.names.map((n, i) => [n, i]));
const v = new THREE.Vector3(), p3 = [0, 0, 0];
for (const s of ['l', 'r']) {
  const fb = frame(B, s), fq = frame(Q, s), k = fb.len / fq.len;
  const M = new THREE.Matrix4().makeTranslation(fb.o.x, fb.o.y, fb.o.z).multiply(fb.R).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(fq.R.clone().transpose()).multiply(new THREE.Matrix4().makeTranslation(-fq.o.x, -fq.o.y, -fq.o.z));
  // how well the fingers' joints meet (the base hand's joints carried over vs the Beginner's own)
  let err = 0, cnt = 0; for (const f of ['thumb_02', 'index_02', 'middle_02', 'ring_02', 'pinky_02', 'index_03', 'pinky_03']) { const a = at(Q, `${f}_${s}`).applyMatrix4(M), b = at(B, `${f}_${s}`); err += a.distanceTo(b); cnt++; }
  console.log(s, 'scale', k.toFixed(3), 'finger joints off by', (err / cnt).toFixed(4), 'm (hand length', fb.len.toFixed(3) + ')');
  const map = new Int32Array(nQ).fill(-1), sel = new Uint8Array(nQ);
  for (let i = 0; i < nQ; i++) { const h = handOf(Q.names, qJ, qW, i); sel[i] = h[s] > 0.5 ? 1 : 0; }
  for (let t = 0; t < qI.length; t += 3) {
    const tri = [qI[t], qI[t + 1], qI[t + 2]]; if (!tri.every((i) => sel[i])) continue;
    for (const i of tri) {
      if (map[i] < 0) {
        map[i] = nB + out.P.length / 3;
        qP.getElement(i, p3); v.set(p3[0], p3[1], p3[2]).applyMatrix4(M); out.P.push(v.x, v.y, v.z);
        qJ.getElement(i, tmp); qW.getElement(i, tmpw);
        const jw = new Map();
        for (let kk = 0; kk < 4; kk++) { if (tmpw[kk] <= 0) continue; let nm = Q.names[tmp[kk]]; if (!/^(hand|thumb|index|middle|ring|pinky)/.test(nm)) nm = `hand_${s}`; const bi = bIndex.get(nm); if (bi === undefined) continue; jw.set(bi, (jw.get(bi) || 0) + tmpw[kk]); }
        const ent = [...jw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const sum = ent.reduce((a, e) => a + e[1], 0) || 1;
        const js = [0, 0, 0, 0], ws = [0, 0, 0, 0]; ent.forEach(([bi, w], kk) => { js[kk] = bi; ws[kk] = w / sum; });
        out.J.push(...js); out.W.push(...ws);
        // the fingerless glove: the hand and the fingers' first joints in leather, the rest bare
        const top = B.names[js[0]]; const bare = /^(thumb|index|middle|ring|pinky)_0[23]/.test(top);
        out.UV.push(...(bare ? uvSkin : uvGlove));
      }
      out.I.push(map[i]);
    }
  }
}
console.log('base hands added: verts', out.P.length / 3, 'tris', out.I.length / 3);

// the body's primitive: its own vertices + the new hands, the drawn hands' triangles out
const cat = (A, add, size, T) => { const old = A.getArray(); const n = new T(old.length + add.length); n.set(old); n.set(add, old.length); A.setArray(n); };
cat(bP, out.P, 3, Float32Array); cat(bUV, out.UV, 2, Float32Array);
const JT = bJ.getArray().constructor; cat(bJ, out.J, 4, JT);
const wOld = bW.getArray(); const WT = wOld.constructor; const wAdd = WT === Float32Array ? out.W : out.W.map((w) => Math.round(w * (WT === Uint8Array ? 255 : 65535)));
cat(bW, wAdd, 4, WT);
B.prim.getIndices().setArray(new Uint32Array([...keep, ...out.I]));
texI.setImage(await sharp(raw, { raw: { width: TW, height: TH, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 86 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outPath, doc);
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
