// The neck and the chest made of the base body's own skin (David 25 Oct: "it looks like plastic, like margarine" — the
// neck was a flare of one colour, its join to the head a ragged band): head.mjs laid the base head (and its neck down to
// its root) on the Beginner; here the base body's next part — its neck's root, collarbones, chest and upper back, the
// same mesh — goes on below it, so the skin runs on from the face with no seam: one surface, its uvs in the band's skin
// block (the texture the face has), the base body's own weights (as it was made to bend).
//  1. the part: the base body's triangles under the head's (the torso above the waist, not the arms), joined to the
//     head's at every point they share (its rim, up the neck's sides behind the jaw too);
//  2. laid on the Beginner by its bones (each bone's bind moved from the base body's skeleton to the Beginner's), its rim
//     where head.mjs laid and thickened the head's neck (eased into it over the neck's root); below the neck onto the
//     Beginner's own surface, 4 mm under it — under the deepest of its layers along the part's own normal (a lapel lies
//     on the shirt, the shirt on the chest); behind the collar standing round the neck's foot it keeps its own shape;
//     folds eased away;
//  3. the old body's neck goes (what is inside the new one, the drawn neck's skin round it above the rim — its ragged
//     ring) and the skin of the opening (grown from it through faces of the Beginner's own skin tone over the new part);
//     the clothes stay (the collar, the lapels); loose bits near the neck go; the rims near the neck lose their teeth
//     (shards: a face with two edges on a rim), are eased along themselves and laid on the new part (1.5 mm over it)
//     with its weights there (they move together), the cloth round them following; the skin texels left on the cloth's
//     edges painted the cloth; small holes closed;
//  4. the new part trimmed to what can show (the neck, where the old faces went, a margin under the cloth);
//  5. the normals of the neck and the chest made again as one surface with the head's skin;
//  6. its texels: the base texture's non-skin (the base woman's underwear, the nipples) painted its skin round it; the
//     chest smoothed and coloured as the neck; round the sides and the back below the neck's root, the shirt (a linen
//     collar band: the old body's neck there was the drawn hair) — the shirt's in the regions' map, which now covers the
//     whole atlas (REG_OUT: Wear3D's dyes take the band's shirt too).
// node bust.mjs IN.glb OUT.glb BASE.gltf HEAD_K REGIONS.png   (IN: head.mjs's output; REGIONS: regions.mjs's map; env
// REG_OUT: where the regions' map over the whole atlas goes; run where @gltf-transform, meshoptimizer and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from '/home/claude/god-of-legacy/node_modules/three/build/three.module.js';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inPath, outPath, basePath, headK, regPath] = process.argv.slice(2);
const doc = await io.read(inPath); await doc.transform(dequantize());
const base = await io.read(basePath);

function rig(d) {
  const skin = d.getRoot().listSkins()[0], names = skin.listJoints().map((n) => n.getName()), ibm = skin.getInverseBindMatrices().getArray();
  const IB = (nm) => { const i = names.indexOf(nm); return new THREE.Matrix4().fromArray(ibm.slice(16 * i, 16 * i + 16)); };
  const at = (nm) => new THREE.Vector3().setFromMatrixPosition(IB(nm).clone().invert());
  return { names, IB, at };
}
const RB = rig(doc), RQ = rig(base);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
let I = Array.from(prim.getIndices().getArray());
const n0 = P.getCount();
const tex = prim.getMaterial().getBaseColorTexture(), timg = sharp(Buffer.from(tex.getImage())), tmeta = await timg.metadata();
const TW = tmeta.width, NH = tmeta.height, TH = TW, BAND = TW / 2, bandV = TH / NH;
const raw = await timg.ensureAlpha().raw().toBuffer();
const reg = regPath ? await sharp(regPath).greyscale().raw().toBuffer({ resolveWithObject: true }) : null;
const regionAt = (x, y) => (reg ? Math.round(reg.data[Math.min(reg.info.height - 1, Math.floor((y * reg.info.height) / TH)) * reg.info.width + Math.min(reg.info.width - 1, Math.floor((x * reg.info.width) / TW))] / 32) : 0);
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const isSkinLoose = (x, y) => { const q = 4 * (y * TW + x), cr = raw[q], cg = raw[q + 1], cb = raw[q + 2]; return !regionAt(x, y) && cr > 140 && cr - cb > 0.3 * cr && cr > cg + 15 && lum(cr, cg, cb) > 105 && !(cr > 1.8 * cg); };

const p3 = [0, 0, 0], uv2 = [0, 0], j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
const skinRef = (() => {
  const cs = []; for (let i = 0; i < n0; i++) { J.getElement(i, j4); W.getElement(i, w4); let s = 0; for (let c = 0; c < 4; c++) if (/^lowerarm_[lr]$/.test(RB.names[j4[c]] ?? '')) s += w4[c]; if (s < 0.7) continue; UV.getElement(i, uv2); if (uv2[1] >= bandV) continue; const x = Math.min(TW - 1, Math.floor(uv2[0] * TW)), y = Math.min(TH - 1, Math.floor(uv2[1] * NH)), q = 4 * (y * TW + x); const c3 = [raw[q], raw[q + 1], raw[q + 2]]; if (c3[0] > c3[2] + 30 && lum(...c3) > 140) cs.push(c3); }
  cs.sort((a, b) => lum(...a) - lum(...b)); const top = cs.slice(Math.floor(cs.length * 0.35)); return [0, 1, 2].map((c) => top.map((x) => x[c]).sort((a, b) => a - b)[top.length >> 1]);
})();
const refL = lum(...skinRef), refS = skinRef[0] + skinRef[1] + skinRef[2], refN = skinRef.map((v) => v / refS);
const isSkinTexel = (x, y) => { if (!isSkinLoose(x, y)) return false; const q = 4 * (y * TW + x), c = [raw[q], raw[q + 1], raw[q + 2]], s = c[0] + c[1] + c[2], l = lum(...c) / refL; return Math.hypot(c[0] / s - refN[0], c[1] / s - refN[1], c[2] / s - refN[2]) < +(process.env.SKIN_C ?? 0.04) && l > 0.5 && l < 1.3; };
console.log('the Beginner\'s skin', skinRef);
const V3 = (i) => { P.getElement(i, p3); return new THREE.Vector3(p3[0], p3[1], p3[2]); };
const isNew = new Uint8Array(n0), isSk = new Uint8Array(n0);
for (let i = 0; i < n0; i++) { UV.getElement(i, uv2); isNew[i] = uv2[1] >= bandV - 1e-4 ? 1 : 0; isSk[i] = isNew[i] && uv2[0] < BAND / TW ? 1 : 0; }
const nk = RB.at('neck_01'), hd = RB.at('Head'), cl = RB.at('clavicle_r'), s3 = RB.at('spine_03');
const polar = (x, z) => [Math.hypot(x - nk.x, z - nk.z), Math.atan2(x - nk.x, z - nk.z)]; // (r, θ in −π..π)
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- the base body
const qBody = base.getRoot().listMeshes().map((m) => m.listPrimitives()[0]).reduce((a, b) => (b.getAttribute('POSITION').getCount() > a.getAttribute('POSITION').getCount() ? b : a));
const QP = qBody.getAttribute('POSITION'), QUV = qBody.getAttribute('TEXCOORD_0'), QJ = qBody.getAttribute('JOINTS_0'), QW = qBody.getAttribute('WEIGHTS_0');
const QI = Array.from(qBody.getIndices().getArray()), nq = QP.getCount(), nTq = QI.length / 3;
const hQ = RQ.at('Head'), nkQ = RQ.at('neck_01'), s2Q = RQ.at('spine_02');
const k = +headK;
const M = new THREE.Matrix4().makeTranslation(hd.x, hd.y, hd.z).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-hQ.x, -hQ.y, -hQ.z));
const wOn = (i, re) => { QJ.getElement(i, j4); QW.getElement(i, w4); let s = 0; for (let c = 0; c < 4; c++) if (re.test(RQ.names[j4[c]] ?? '')) s += w4[c]; return s; };
const qY = (i) => { QP.getElement(i, p3); return p3[1]; };
const qHead = (i) => { if (wOn(i, /^Head$/) > 0.3) return true; if (wOn(i, /^neck_01$/) < 0.5) return false; return qY(i) > nkQ.y - 0.01; }; // (head.mjs's)
const isHeadV = new Uint8Array(nq); for (let i = 0; i < nq; i++) isHeadV[i] = qHead(i) ? 1 : 0;
const HT = new Uint8Array(nTq); for (let t = 0; t < nTq; t++) HT[t] = isHeadV[QI[3 * t]] && isHeadV[QI[3 * t + 1]] && isHeadV[QI[3 * t + 2]] ? 1 : 0;
// welded (one point per place: the uv seams' copies together)
const qw = new Int32Array(nq); let nW = 0; { const id = new Map(); for (let i = 0; i < nq; i++) { QP.getElement(i, p3); const kk = p3.map((v) => Math.round(v * 1e5)).join(','); if (!id.has(kk)) id.set(kk, id.size); qw[i] = id.get(kk); } nW = id.size; }
// the head's rim at its neck: its edges that one head triangle has (below the jaw)
const ringW = new Set();
{
  const cnt = new Map(), ek = (a, b) => (a < b ? a * nW + b : b * nW + a);
  for (let t = 0; t < nTq; t++) if (HT[t]) for (let c = 0; c < 3; c++) { const a = qw[QI[3 * t + c]], b = qw[QI[3 * t + (c + 1) % 3]]; const e = ek(a, b); cnt.set(e, (cnt.get(e) || 0) + 1); }
  const yW = new Float32Array(nW); for (let i = 0; i < nq; i++) yW[qw[i]] = qY(i);
  for (const [e, c] of cnt) { if (c !== 1) continue; const a = Math.floor(e / nW), b = e % nW; if (yW[a] < hQ.y + 0.02 || yW[b] < hQ.y + 0.02) { ringW.add(a); ringW.add(b); } }
}
// the part: the torso's triangles below the head's (not the arms), joined to the rim
const armW = (i) => wOn(i, /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/);
const cand = new Uint8Array(nTq);
for (let t = 0; t < nTq; t++) { if (HT[t]) continue; let ok = true; for (let c = 0; c < 3; c++) { const i = QI[3 * t + c], y = qY(i); if (y < s2Q.y - 0.02 || y > hQ.y || armW(i) > +(process.env.ARMW ?? 0.75)) ok = false; } cand[t] = ok ? 1 : 0; }
const bustT = [];
{
  const par = new Int32Array(nW).map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < nTq; t++) if (cand[t]) { const a = find(qw[QI[3 * t]]); par[find(qw[QI[3 * t + 1]])] = a; par[find(qw[QI[3 * t + 2]])] = a; }
  const roots = new Set([...ringW].map(find));
  for (let t = 0; t < nTq; t++) if (cand[t] && roots.has(find(qw[QI[3 * t]]))) bustT.push(t);
}
{ // (the rim: every point the head's triangles and the part's share — up the neck's sides behind the jaw too)
  const inH = new Set(); for (let t = 0; t < nTq; t++) if (HT[t]) for (let c = 0; c < 3; c++) inH.add(qw[QI[3 * t + c]]);
  ringW.clear(); for (const t of bustT) for (let c = 0; c < 3; c++) { const w = qw[QI[3 * t + c]]; if (inH.has(w)) ringW.add(w); }
}
console.log('base: head triangles', HT.reduce((a, b) => a + b, 0), 'rim points', ringW.size, 'the part', bustT.length, 'triangles');
{ // (check: the head's open edges below its eyes are all the part's — no slit between them)
  const cnt = new Map(), ek = (a, b) => (a < b ? a * nW + b : b * nW + a), yW = new Float32Array(nW); for (let i = 0; i < nq; i++) yW[qw[i]] = qY(i);
  for (let t = 0; t < nTq; t++) if (HT[t]) for (let c = 0; c < 3; c++) { const e = ek(qw[QI[3 * t + c]], qw[QI[3 * t + (c + 1) % 3]]); cnt.set(e, (cnt.get(e) || 0) + 1); }
  const bustE = new Set(); for (const t of bustT) for (let c = 0; c < 3; c++) bustE.add(ek(qw[QI[3 * t + c]], qw[QI[3 * t + (c + 1) % 3]]));
  let open = 0; for (const [e, c] of cnt) { if (c !== 1) continue; const a = Math.floor(e / nW), b = e % nW; if ((yW[a] < hQ.y + 0.02 || yW[b] < hQ.y + 0.02) && !bustE.has(e)) open++; }
  if (open) console.log('WARNING: the head\'s open edges not joined to the part:', open);
}

// ---- laid by the bones: each base bone's bind moved to the Beginner's
const bIdx = new Map(RB.names.map((n, i) => [n, i]));
const TQ = RQ.names.map((nm) => (bIdx.has(nm) ? RB.IB(nm).clone().invert().multiply(RQ.IB(nm)) : null));
const lbs = (i) => { QP.getElement(i, p3); QJ.getElement(i, j4); QW.getElement(i, w4); const acc = new THREE.Vector3(), t = new THREE.Vector3(); let s = 0; for (let c = 0; c < 4; c++) { if (!(w4[c] > 0) || !TQ[j4[c]]) continue; t.fromArray(p3).applyMatrix4(TQ[j4[c]]); acc.addScaledVector(t, w4[c]); s += w4[c]; } return acc.multiplyScalar(1 / (s || 1)); };
const baseW = (i) => { QJ.getElement(i, j4); QW.getElement(i, w4); const m = new Map(); for (let c = 0; c < 4; c++) { if (!(w4[c] > 0)) continue; const b = bIdx.get(RQ.names[j4[c]]); if (b === undefined) continue; m.set(b, (m.get(b) || 0) + w4[c]); } return m; };
// the part's points (welded), a base vertex for each
const bustV = new Set(); for (const t of bustT) for (let c = 0; c < 3; c++) bustV.add(QI[3 * t + c]);
const repOf = new Map(); for (const i of bustV) if (!repOf.has(qw[i])) repOf.set(qw[i], i);
const L = new Map(); for (const [w, i] of repOf) L.set(w, lbs(i));

// ---- the rim's points where head.mjs laid them (the head's vertex with the same base uv)
const grid = new Map(), gk = (u, v) => `${Math.floor(u * 512)},${Math.floor(v * 512)}`;
for (let i = 0; i < n0; i++) { if (!isSk[i]) continue; UV.getElement(i, uv2); const bu = (uv2[0] * TW - 0.5) / (BAND - 1), bv = (uv2[1] * NH - TH - 0.5) / (BAND - 1), kk = gk(bu, bv); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push([i, bu, bv]); }
const posR = new Map(); let rimMiss = 0, rimFar = 0;
for (const w of ringW) {
  // (every copy of this point in a head triangle: the first one found)
  let got = null;
  for (let i = 0; i < nq && !got; i++) {
    if (qw[i] !== w || !isHeadV[i]) continue;
    QUV.getElement(i, uv2); const u = uv2[0] - Math.floor(uv2[0]), v = uv2[1] - Math.floor(uv2[1]);
    QP.getElement(i, p3); const mp = new THREE.Vector3().fromArray(p3).applyMatrix4(M);
    let best = null, bs = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [oi, bu, bv] of grid.get(`${Math.floor(u * 512) + dx},${Math.floor(v * 512) + dy}`) ?? []) {
      const du = Math.hypot(bu - u, bv - v); if (du > 2.5e-3) continue; const s = du / 1e-3 + V3(oi).distanceTo(mp) / 0.01; if (s < bs) { bs = s; best = oi; }
    }
    if (best !== null) { got = V3(best); if (got.distanceTo(mp) > 0.05) rimFar++; }
  }
  if (got) posR.set(w, got); else rimMiss++;
}
console.log('rim points found on the head', posR.size, 'missed', rimMiss, 'far from M', rimFar);

// ---- the rim round the neck: its height and its move (head.mjs's place − the bones' place), by the side
const NBR = 64, rimR = new Float32Array(NBR), rimY = new Float32Array(NBR), rimYL = new Float32Array(NBR), rimD = Array.from({ length: NBR }, () => new THREE.Vector3());
{
  // (the rim's points by their side, each side between its two nearest: a line round the neck)
  const pts = []; for (const [w, pr] of posR) { const l = L.get(w); if (l) pts.push({ th: polar(l.x, l.z)[1], r: polar(pr.x, pr.z)[0], y: pr.y, yl: l.y, d: pr.clone().sub(l) }); }
  pts.sort((a, b) => a.th - b.th);
  for (let b = 0; b < NBR; b++) {
    const th = -Math.PI + ((b + 0.5) / NBR) * 2 * Math.PI;
    let j = pts.findIndex((q) => q.th > th); if (j < 0) j = 0; const A = pts[(j - 1 + pts.length) % pts.length], B = pts[j];
    let span = B.th - A.th; if (span <= 0) span += 2 * Math.PI; let x = th - A.th; if (x < 0) x += 2 * Math.PI; const t = Math.min(1, x / span);
    rimR[b] = A.r + (B.r - A.r) * t; rimY[b] = A.y + (B.y - A.y) * t; rimYL[b] = A.yl + (B.yl - A.yl) * t; rimD[b].copy(A.d).lerp(B.d, t);
  }
}
const rimAt = (th) => { const f = ((th + Math.PI) / (2 * Math.PI)) * NBR - 0.5, b0 = ((Math.floor(f) % NBR) + NBR) % NBR, b1 = (b0 + 1) % NBR, t = f - Math.floor(f); return { r: rimR[b0] * (1 - t) + rimR[b1] * t, y: rimY[b0] * (1 - t) + rimY[b1] * t, yl: rimYL[b0] * (1 - t) + rimYL[b1] * t, d: rimD[b0].clone().multiplyScalar(1 - t).addScaledVector(rimD[b1], t) }; };
console.log('rim height', Math.min(...rimY).toFixed(3), '…', Math.max(...rimY).toFixed(3), 'move', Math.max(...rimD.map((d) => d.length())).toFixed(3));

// ---- the free shape: by the bones, eased onto the head's rim over the neck's root
const LD = +(process.env.EASE ?? 0.07);
const F = new Map(), drop = new Map();
for (const [w, l] of L) {
  if (posR.has(w)) { F.set(w, posR.get(w).clone()); drop.set(w, 0); continue; }
  const th = polar(l.x, l.z)[1], r = rimAt(th), h = Math.max(0, r.yl - l.y); drop.set(w, h);
  F.set(w, l.clone().addScaledVector(r.d, 1 - sstep(0, LD, h)));
}

// ---- the old body: its faces, their skin, their places
const aiT = []; for (let t = 0; t < I.length; t += 3) if (!isNew[I[t]] && !isNew[I[t + 1]] && !isNew[I[t + 2]]) aiT.push(t);
const fSkin = new Map(), fLoose = new Map(); // face start → skin fraction of its texels (the Beginner's skin; skin-like)
{
  const tri = [[0, 0], [0, 0], [0, 0]];
  for (const t of aiT) {
    let mn = Infinity; for (let c = 0; c < 3; c++) { P.getElement(I[t + c], p3); mn = Math.min(mn, p3[1]); } if (mn < s3.y - 0.25) continue;
    for (let c = 0; c < 3; c++) { UV.getElement(I[t + c], uv2); tri[c] = [uv2[0] * TW, uv2[1] * NH]; }
    const [A, B, C] = tri, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) { fSkin.set(t, 0); continue; }
    let n = 0, s = 0, sl = 0;
    for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))); y <= Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1]))); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))); x <= Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0]))); x++) {
      const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
      if (l1 < 0 || l2 < 0 || 1 - l1 - l2 < 0) continue; n++; if (isSkinTexel(x, y)) s++; if (isSkinLoose(x, y)) sl++;
    }
    if (!n) { UV.getElement(I[t], uv2); const x = Math.min(TW - 1, Math.floor(uv2[0] * TW)), y = Math.min(TH - 1, Math.floor(uv2[1] * NH)); n = 1; s = isSkinTexel(x, y) ? 1 : 0; sl = isSkinLoose(x, y) ? 1 : 0; }
    fSkin.set(t, s / n); fLoose.set(t, sl / n);
  }
}
// the neck's radius by height and side: the head's skin above the rim, the free shape below it (the smallest there)
const DY = 0.006, y0 = s3.y - 0.1, NY = Math.ceil((hd.y + 0.1 - y0) / DY), NBN = 32, rN = new Float32Array(NY * NBN).fill(Infinity);
const putR = (x, y, z) => { if (y < y0 || y >= hd.y + 0.1) return; const [r, th] = polar(x, z); const kk = Math.floor((y - y0) / DY) * NBN + (Math.floor(((th + Math.PI) / (2 * Math.PI)) * NBN) % NBN); if (r < rN[kk]) rN[kk] = r; };
for (let i = 0; i < n0; i++) if (isSk[i]) { P.getElement(i, p3); if (p3[1] < hd.y + 0.02) putR(p3[0], p3[1], p3[2]); }
const rNAt = (y, th) => { const yi = Math.floor((y - y0) / DY), ti = Math.floor(((th + Math.PI) / (2 * Math.PI)) * NBN) % NBN; let best = Infinity; for (const dy of [0, -1, 1]) for (const dt of [0, -1, 1]) { const yy = yi + dy; if (yy < 0 || yy >= NY) continue; const v = rN[yy * NBN + ((ti + dt + NBN) % NBN)]; if (v < best) best = v; } return best; };
// the old body's neck: what is inside the new neck (the drawn neck head.mjs laid in it, hair, shards), and the drawn
// neck's skin round it above the rim (its ragged ring) — the clothes there (the collar standing round the neck's foot,
// the lapels) stay
const skinish = (t) => fSkin.has(t) && (fLoose.get(t) > 0.5 || fSkin.get(t) > 0.3);
const isInside = (c) => { const [r, th] = polar(c.x, c.z), rm = rimAt(th); if (c.y < rm.y - 0.04) return false; if (c.y > hd.y - 0.01) return r < 0.2; if (c.y < rm.y) return r < rm.r - 0.002; const rn = rNAt(c.y, th); return r < (isFinite(rn) ? rn : rm.r) - 0.002; };
const isAboveSkin = (t, c) => { const [r, th] = polar(c.x, c.z); return c.y > rimAt(th).y - 0.005 && r < 0.16 && skinish(t); };
const cen = (t) => V3(I[t]).add(V3(I[t + 1])).add(V3(I[t + 2])).multiplyScalar(1 / 3);
const oldNeck = new Set(); for (const t of aiT) { if (!fSkin.has(t)) continue; const c = cen(t); if (isInside(c) || isAboveSkin(t, c)) oldNeck.add(t); }
// the collar standing round the neck's foot: not laid on (the new part would stand out with it)
const collarT = new Set();
{
  const CR = +(process.env.COLLAR_R ?? 0.07);
  for (const t of aiT) {
    if (!fSkin.has(t) || oldNeck.has(t)) continue;
    const c = cen(t), [r, th] = polar(c.x, c.z), rm = rimAt(th); if (r > rm.r + CR || c.y < rm.y - 0.03) continue;
    const n = V3(I[t + 1]).sub(V3(I[t])).cross(V3(I[t + 2]).sub(V3(I[t]))).normalize();
    if (Math.abs(n.y) > 0.55) continue; // (lying on the shoulders)
    if (c.z > nk.z + 0.03 && Math.abs(n.z) > 0.5 && c.y < rm.y - 0.01) continue; // (a lapel on the chest)
    collarT.add(t);
  }
  console.log('the old neck:', oldNeck.size, 'faces; the collar round its foot (kept, not laid on):', collarT.size);
}
// the old body's points welded, their normals
const key = (i) => { P.getElement(i, p3); return `${Math.round(p3[0] * 2e4)},${Math.round(p3[1] * 2e4)},${Math.round(p3[2] * 2e4)}`; };
const weld = () => { const id = new Map(), wid = new Int32Array(P.getCount()); for (let i = 0; i < P.getCount(); i++) { const kk = key(i); if (!id.has(kk)) id.set(kk, id.size); wid[i] = id.get(kk); } return { wid, nW: id.size }; };
const W0 = weld();
const vN = new Float32Array(W0.nW * 3);
for (const t of aiT) {
  const a = V3(I[t]), b = V3(I[t + 1]), c = V3(I[t + 2]), n = b.clone().sub(a).cross(c.clone().sub(a));
  for (let q = 0; q < 3; q++) { const w = W0.wid[I[t + q]]; vN[3 * w] += n.x; vN[3 * w + 1] += n.y; vN[3 * w + 2] += n.z; }
}
for (let w = 0; w < W0.nW; w++) { const l = Math.hypot(vN[3 * w], vN[3 * w + 1], vN[3 * w + 2]) || 1; vN[3 * w] /= l; vN[3 * w + 1] /= l; vN[3 * w + 2] /= l; }
// the faces it is laid on: the old body's, not its neck — a grid of them
const CELL = 0.03, tgrid = new Map();
const targets = aiT.filter((t) => fSkin.has(t) && !oldNeck.has(t));
for (const t of targets) { const a = V3(I[t]), b = V3(I[t + 1]), c = V3(I[t + 2]), mn = a.clone().min(b).min(c), mx = a.clone().max(b).max(c); for (let x = Math.floor(mn.x / CELL); x <= Math.floor(mx.x / CELL); x++) for (let y = Math.floor(mn.y / CELL); y <= Math.floor(mx.y / CELL); y++) for (let z = Math.floor(mn.z / CELL); z <= Math.floor(mx.z / CELL); z++) { const kk = `${x},${y},${z}`; if (!tgrid.has(kk)) tgrid.set(kk, []); tgrid.get(kk).push(t); } }
const triC = new THREE.Triangle(), cp = new THREE.Vector3(), bary = new THREE.Vector3();
const closest = (p, grid2, get) => {
  let best = null, bd = Infinity; const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
  for (let rad = 0; rad <= 4; rad++) {
    for (let x = cx - rad; x <= cx + rad; x++) for (let y = cy - rad; y <= cy + rad; y++) for (let z = cz - rad; z <= cz + rad; z++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== rad) continue;
      for (const t of grid2.get(`${x},${y},${z}`) ?? []) { const [a, b, c] = get(t); triC.set(a, b, c); triC.closestPointToPoint(p, cp); const d = cp.distanceToSquared(p); if (d < bd) { bd = d; triC.getBarycoord(cp, bary); best = { t, p: cp.clone(), b: bary.clone(), d: Math.sqrt(d) }; } }
    }
    if (best && best.d < rad * CELL) break;
  }
  return best;
};
const aiTri = (t) => [V3(I[t]), V3(I[t + 1]), V3(I[t + 2])];

// ---- onto the Beginner: wrapped below the neck's root — a little under its surface (its cloth covers it; where its skin
// goes, the new part shows just under the cloth's edge, which is then laid on it)
const UNDER = +(process.env.UNDER ?? 0.004), WRAP = +(process.env.WRAP ?? 0.03);
const Pb = new Map(), Ub = new Map(), Wb = new Map();
// (the free shape's own normals: which way is out from it)
const fN = new Map(); for (const t of bustT) { const ws = [0, 1, 2].map((c) => qw[QI[3 * t + c]]), ps = ws.map((w) => F.get(w)), n = ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])); for (const w of ws) { if (!fN.has(w)) fN.set(w, new THREE.Vector3()); fN.get(w).add(n); } } for (const v of fN.values()) v.normalize();
// (the old surface's layers through a point along a line: a lapel lies on the shirt, the shirt on the chest — the new
// part goes under the deepest of them, not between them)
const ray = new THREE.Ray(), hitP = new THREE.Vector3();
const layers = (o, d, t0, t1) => {
  const seen = new Set(), out = [];
  for (let s2 = t0; s2 <= t1 + 1e-9; s2 += CELL / 3) {
    const p = o.clone().addScaledVector(d, s2), kk = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`;
    for (const t of tgrid.get(kk) ?? []) { if (seen.has(t)) continue; seen.add(t); const [a, b, c] = aiTri(t); ray.set(o.clone().addScaledVector(d, t0), d); if (!ray.intersectTriangle(a, b, c, false, hitP)) continue; const tt = t0 + hitP.distanceTo(ray.origin); if (tt <= t1) out.push({ t, tt, p: hitP.clone() }); }
  }
  return out;
};
let deep = 0;
for (const [w, f] of F) {
  const i = repOf.get(w), bwm = baseW(i);
  if (posR.has(w)) { Pb.set(w, f.clone()); Ub.set(w, 0); Wb.set(w, bwm); continue; }
  const u = sstep(0, WRAP, drop.get(w)); if (u <= 0) { Pb.set(w, f.clone()); Ub.set(w, 0); Wb.set(w, bwm); continue; }
  let hit = null; const n0v = fN.get(w);
  if (n0v && n0v.lengthSq() > 0.5) {
    const ls = layers(f, n0v, -0.03, 0.04); if (ls.length) { ls.sort((a, b) => a.tt - b.tt); const L0 = ls[0]; triC.set(...aiTri(L0.t)); triC.getBarycoord(L0.p, bary); hit = { t: L0.t, p: L0.p, b: bary.clone(), d: Math.abs(L0.tt) }; if (ls.length > 1) deep++; }
  }
  if (!hit) hit = closest(f, tgrid, aiTri);
  if (!hit) { Pb.set(w, f.clone()); Ub.set(w, 0); Wb.set(w, bwm); continue; }
  const t = hit.t, nT = new THREE.Vector3();
  for (let q = 0; q < 3; q++) { const ww = W0.wid[I[t + q]], bq = [hit.b.x, hit.b.y, hit.b.z][q]; nT.x += vN[3 * ww] * bq; nT.y += vN[3 * ww + 1] * bq; nT.z += vN[3 * ww + 2] * bq; }
  nT.normalize(); if (n0v && nT.dot(n0v) < 0) nT.negate(); // (the old surface's faces are not all wound alike: out is the new part's out)
  // (the collar stands off the body round the neck's foot: behind it the new part keeps its own shape — it is not drawn
  // out to it — and only what stands out in front of it goes under it)
  if (collarT.has(t) && f.clone().sub(hit.p).dot(nT) < -UNDER) { Pb.set(w, f.clone()); Ub.set(w, 0); Wb.set(w, bwm); continue; }
  const T = hit.p.clone().addScaledVector(nT, -UNDER);
  Pb.set(w, f.clone().lerp(T, u)); Ub.set(w, u);
  Wb.set(w, bwm); // (its weights the base body's own, as it was made to bend — mixed with the old body's it folded where they met; the old body's rims laid on it take them)
}
console.log('laid under the deepest of two or more layers:', deep, 'points');
// the part's edges (welded); the easing between the free shape and the wrapped one smoothed
const bnb = new Map(); for (const t of bustT) for (let c = 0; c < 3; c++) { const a = qw[QI[3 * t + c]], b = qw[QI[3 * t + (c + 1) % 3]]; if (!bnb.has(a)) bnb.set(a, new Set()); if (!bnb.has(b)) bnb.set(b, new Set()); bnb.get(a).add(b); bnb.get(b).add(a); }
for (let it = 0; it < +(process.env.SMOOTH ?? 4); it++) {
  const nx = new Map();
  for (const [w, s] of bnb) { if (posR.has(w)) continue; const u = Ub.get(w); if (!(u > 0 && u < 1)) continue; const m = new THREE.Vector3(); for (const b of s) m.add(Pb.get(b)); m.multiplyScalar(1 / s.size); nx.set(w, Pb.get(w).clone().lerp(m, 0.5)); }
  for (const [w, v] of nx) Pb.set(w, v);
}
// (folds: a triangle turned over against its own turn by the bones — its points and their neighbours eased toward their
// neighbours until none is)
{
  const triN = (ps) => ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).normalize();
  let folds = 0, passes = 0;
  for (; passes < 12; passes++) {
    const bad = new Set();
    for (const t of bustT) { const ws = [0, 1, 2].map((c) => qw[QI[3 * t + c]]); if (ws.some((w) => drop.get(w) > 0.1)) continue; const a = triN(ws.map((w) => Pb.get(w))), b = triN(ws.map((w) => L.get(w))); if (a.dot(b) < 0.25) for (const w of ws) if (!posR.has(w)) bad.add(w); }
    if (passes === 0) folds = bad.size; if (!bad.size) break;
    const zone = new Set(bad); for (const w of bad) for (const v of bnb.get(w) ?? []) if (!posR.has(v)) zone.add(v);
    for (let it = 0; it < 3; it++) { const nx = new Map(); for (const w of zone) { const m = new THREE.Vector3(); const s = bnb.get(w); for (const v of s) m.add(Pb.get(v)); m.multiplyScalar(1 / s.size); nx.set(w, Pb.get(w).clone().lerp(m, 0.6)); } for (const [w, v] of nx) Pb.set(w, v); }
  }
  console.log('folds in the new part (by the neck):', folds, 'points, eased in', passes, 'passes');
}
{ let u0 = 0, u1 = 0, um = 0, dd = 0; for (const [w, u] of Ub) { if (u <= 0) u0++; else if (u >= 1) { u1++; dd += Pb.get(w).distanceTo(F.get(w)); } else um++; } console.log('the part: free', u0, 'eased', um, 'wrapped', u1, 'moved onto the body by', (dd / Math.max(1, u1)).toFixed(3)); }
const gridOf = (list, tri) => { const g = new Map(); list.forEach((t, ti) => { const ps = tri(ti), mn = ps[0].clone().min(ps[1]).min(ps[2]), mx = ps[0].clone().max(ps[1]).max(ps[2]); for (let x = Math.floor(mn.x / CELL); x <= Math.floor(mx.x / CELL); x++) for (let y = Math.floor(mn.y / CELL); y <= Math.floor(mx.y / CELL); y++) for (let z = Math.floor(mn.z / CELL); z <= Math.floor(mx.z / CELL); z++) { const kk = `${x},${y},${z}`; if (!g.has(kk)) g.set(kk, []); g.get(kk).push(ti); } }); return g; };
let bustTri = (ti) => { const t = bustT[ti]; return [0, 1, 2].map((c) => Pb.get(qw[QI[3 * t + c]])); };
let bgrid = gridOf(bustT, bustTri);

// ---- the old body's faces that go: its neck; the skin in its opening
const gone = new Set(oldNeck); let skinGone = 0;
const SKIN_D = +(process.env.SKIN_D ?? 0.02);
{
  // (the skin grown from the old neck through faces of skin over the new part — skin-like smudges on the cloth, not
  // joined to it, stay)
  const byW = new Map(); for (const t of aiT) for (let q = 0; q < 3; q++) { const w = W0.wid[I[t + q]]; if (!byW.has(w)) byW.set(w, []); byW.get(w).push(t); }
  const isSkinF = (t) => fSkin.has(t) && fSkin.get(t) > 0.5, under = new Map(), near = (t) => { if (!under.has(t)) { const c = cen(t); const hit = c.y > s3.y - 0.15 ? closest(c, bgrid, bustTri) : null; under.set(t, !!hit && hit.d < SKIN_D); } return under.get(t); };
  const flood = new Set(), queue = []; for (const t of oldNeck) for (let q = 0; q < 3; q++) for (const t2 of byW.get(W0.wid[I[t + q]]) ?? []) if (!gone.has(t2) && !flood.has(t2) && isSkinF(t2) && near(t2)) { flood.add(t2); queue.push(t2); }
  while (queue.length) { const t = queue.pop(); for (let q = 0; q < 3; q++) for (const t2 of byW.get(W0.wid[I[t + q]]) ?? []) if (!gone.has(t2) && !flood.has(t2) && isSkinF(t2) && near(t2)) { flood.add(t2); queue.push(t2); } }
  for (const t of flood) { gone.add(t); skinGone++; }
}
// ---- the new part trimmed to what can show: the neck, where the old faces went (and a margin under the cloth round
// it); not its triangles torn across a gap (wrapped onto two surfaces, an arm and the side)
let bustK = [];
{
  const NEED = +(process.env.NEED ?? 0.08), gc = new Map(); for (const t of gone) { const c = cen(t), kk = `${Math.floor(c.x / CELL)},${Math.floor(c.y / CELL)},${Math.floor(c.z / CELL)}`; if (!gc.has(kk)) gc.set(kk, []); gc.get(kk).push(c); }
  const nearGone = (p) => { const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL); for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) for (let z = cz - 2; z <= cz + 2; z++) for (const c of gc.get(`${x},${y},${z}`) ?? []) if (c.distanceToSquared(p) < NEED * NEED) return true; return false; };
  let torn = 0;
  for (const t of bustT) {
    const ws = [0, 1, 2].map((c) => qw[QI[3 * t + c]]), ps = ws.map((w) => Pb.get(w)), ls = ws.map((w) => L.get(w));
    let st = 0; for (let c = 0; c < 3; c++) st = Math.max(st, ps[c].distanceTo(ps[(c + 1) % 3]) / Math.max(1e-6, ls[c].distanceTo(ls[(c + 1) % 3])));
    const c = ps[0].clone().add(ps[1]).add(ps[2]).multiplyScalar(1 / 3), ng = nearGone(c);
    if (st > +(process.env.TORN ?? 2.2) && ws.every((w) => drop.get(w) > 0.06) && !ng) { torn++; continue; } // (where nothing went, a torn one only shows)
    if (ws.some((w) => drop.get(w) < 0.09) || ng) bustK.push(t);
  }
  console.log('the new part trimmed:', bustK.length, 'of', bustT.length, 'triangles kept (torn across gaps', torn + ')');
}
bustTri = (ti) => { const t = bustK[ti]; return [0, 1, 2].map((c) => Pb.get(qw[QI[3 * t + c]])); };
bgrid = gridOf(bustK, bustTri);

// (the texels of a face of the old body)
const faceTexels = (t, fn, m = 1) => {
  const tri = [0, 1, 2].map((c) => { UV.getElement(I[t + c], uv2); return [uv2[0] * TW, uv2[1] * NH]; });
  const [A, B, C] = tri, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) return;
  const e = m / Math.max(1, Math.sqrt(Math.abs(den)));
  for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1); y <= Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1); x <= Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1); x++) {
    const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
    if (l1 < -e || l2 < -e || 1 - l1 - l2 < -e) continue; fn(x, y);
  }
};
const RW = reg ? reg.info.width : 0, RH0 = reg ? reg.info.height : 0, RH = Math.round((RW * NH) / TW);
const regOut = reg ? new Uint8Array(RW * RH) : null; if (regOut) regOut.set(reg.data.subarray(0, RW * Math.min(RH0, Math.round((RW * TH) / TW))));
const regSet = (x, y, v) => { if (regOut) regOut[Math.min(RH - 1, Math.floor((y * RH) / NH)) * RW + Math.min(RW - 1, Math.floor((x * RW) / TW))] = v; };
{ const keep = []; for (let t = 0; t < I.length; t += 3) if (!gone.has(t)) keep.push(I[t], I[t + 1], I[t + 2]); I = keep; }
console.log('old body gone: its neck', oldNeck.size, 'faces, the skin in its opening', skinGone);
// loose pieces near the neck go
let bits = 0;
{
  const { wid, nW: nw } = W0, par = new Int32Array(nw).map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; const u = find(wid[I[t]]); par[find(wid[I[t + 1]])] = u; par[find(wid[I[t + 2]])] = u; }
  const size = new Map(), high = new Map(), close = new Map();
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; const c = find(wid[I[t]]); size.set(c, (size.get(c) || 0) + 1); P.getElement(I[t], p3); high.set(c, Math.max(high.get(c) ?? -9, p3[1])); close.set(c, Math.min(close.get(c) ?? 9, polar(p3[0], p3[2])[0])); }
  const keep = []; for (let t = 0; t < I.length; t += 3) { if (!isNew[I[t]]) { const c = find(wid[I[t]]); if (size.get(c) < 300 && high.get(c) > cl.y - 0.08 && close.get(c) < 0.22) { bits++; continue; } } keep.push(I[t], I[t + 1], I[t + 2]); }
  I = keep;
}
// the rims' teeth near the neck: a face of the old body with two of its edges on a rim (a shard sticking out of the
// cloth's edge) goes, a few times over
let teeth = 0;
for (let pass = 0; pass < +(process.env.TEETH ?? 3); pass++) {
  const { wid } = W0, cnt = new Map(), ek = (u, v) => (u < v ? u * W0.nW + v : v * W0.nW + u);
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let q = 0; q < 3; q++) { const e = ek(wid[I[t + q]], wid[I[t + (q + 1) % 3]]); cnt.set(e, (cnt.get(e) || 0) + 1); } }
  const keep = []; let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    if (!isNew[I[t]]) { let b = 0; for (let q = 0; q < 3; q++) if (cnt.get(ek(wid[I[t + q]], wid[I[t + (q + 1) % 3]])) === 1) b++; if (b >= 2) { const c = cen(t); if (c.y > s3.y - 0.06 && polar(c.x, c.z)[0] < 0.2) { n++; continue; } } }
    keep.push(I[t], I[t + 1], I[t + 2]);
  }
  I = keep; teeth += n; if (!n) break;
}
console.log('teeth off the rims near the neck:', teeth, 'faces');
// ---- the old body's rims near the neck (its opening, the cut round its neck) eased along themselves (Taubin; points
// where a rim pinches stay), then laid on the new part (just over it) — the cloth round them eased after them
let eased = 0, laid = 0; const edgeW = new Set();
{
  const { wid } = W0, members = new Map(); for (let i = 0; i < n0; i++) { if (isNew[i]) continue; const w = wid[i]; if (!members.has(w)) members.set(w, []); members.get(w).push(i); }
  const nearNeck = (w) => { const v = V3(members.get(w)[0]); return v.y > s3.y - 0.05 && polar(v.x, v.z)[0] < 0.2; };
  const cnt = new Map(), ek = (u, v) => (u < v ? u * W0.nW + v : v * W0.nW + u), adj = new Map();
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let q = 0; q < 3; q++) { const u = wid[I[t + q]], v = wid[I[t + (q + 1) % 3]]; if (u === v) continue; const e = ek(u, v); cnt.set(e, (cnt.get(e) || 0) + 1); if (!adj.has(u)) adj.set(u, new Set()); if (!adj.has(v)) adj.set(v, new Set()); adj.get(u).add(v); adj.get(v).add(u); } }
  const rnb = new Map(); for (const [e, c] of cnt) { if (c !== 1) continue; const u = Math.floor(e / W0.nW), v = e % W0.nW; if (!nearNeck(u) || !nearNeck(v)) continue; if (!rnb.has(u)) rnb.set(u, []); if (!rnb.has(v)) rnb.set(v, []); rnb.get(u).push(v); rnb.get(v).push(u); }
  const pos = new Map(); for (const w of rnb.keys()) pos.set(w, V3(members.get(w)[0]));
  const free = [...rnb.keys()].filter((w) => rnb.get(w).length === 2);
  const step = (lam) => { const nx = new Map(); for (const w of free) { const [a, b] = rnb.get(w); nx.set(w, pos.get(w).clone().lerp(pos.get(a).clone().add(pos.get(b)).multiplyScalar(0.5), lam)); } for (const [w, v] of nx) pos.set(w, v); };
  for (let it = 0; it < +(process.env.EDGE_IT ?? 8); it++) { step(0.5); step(-0.53); }
  // laid on the new part: the nearest point of its surface, 1.5 mm out
  const SNAP = +(process.env.SNAP ?? 0.015), snapW = new Map(), moveW = new Map(), tn = new THREE.Triangle(), nrm = new THREE.Vector3();
  for (const w of rnb.keys()) {
    const v = pos.get(w), hit = closest(v, bgrid, bustTri);
    if (hit && hit.d < SNAP) { const [a, b, c] = bustTri(hit.t); tn.set(a, b, c); tn.getNormal(nrm); const to = hit.p.clone().addScaledVector(nrm, 0.0015); moveW.set(w, to.sub(V3(members.get(w)[0]))); laid++;
      // (and it moves with it: the new part's weights there)
      const t3 = bustK[hit.t], bw = [hit.b.x, hit.b.y, hit.b.z], m = new Map(); for (let c3 = 0; c3 < 3; c3++) for (const [bj, bv] of Wb.get(qw[QI[3 * t3 + c3]])) m.set(bj, (m.get(bj) || 0) + bv * Math.max(0, bw[c3])); snapW.set(w, m); }
    else if (rnb.get(w).length === 2) moveW.set(w, v.clone().sub(V3(members.get(w)[0])));
  }
  // (the cloth round the rim follows: two rings of it, half and a fifth of its rim points' move)
  let front = new Set(moveW.keys()); const seen = new Set(front);
  for (const k of [0.5, 0.2]) {
    const nxt = new Map();
    for (const w of front) for (const v of adj.get(w) ?? []) { if (seen.has(v)) continue; const m = moveW.get(w); if (!m) continue; if (!nxt.has(v)) nxt.set(v, [new THREE.Vector3(), 0]); const e = nxt.get(v); e[0].add(m); e[1]++; }
    for (const [v, [m, c]] of nxt) { moveW.set(v, m.multiplyScalar(k / c)); seen.add(v); }
    front = new Set(nxt.keys());
  }
  for (const [w, m] of moveW) { const v = V3(members.get(w)[0]).add(m); for (const i of members.get(w)) P.setElement(i, [v.x, v.y, v.z]); if (rnb.has(w)) eased++; }
  // (the weights: a rim point laid on the new part takes its weights there; the cloth round it, half and a fifth of them)
  {
    const setW = (i, m) => { const ent = [...m.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4), sm = ent.reduce((a, e) => a + e[1], 0) || 1; const js = [0, 0, 0, 0], ws = [0, 0, 0, 0]; ent.forEach(([bj, x], q) => { js[q] = bj; ws[q] = x / sm; }); J.setElement(i, js); W.setElement(i, ws); };
    const own = (i) => { J.getElement(i, j4); W.getElement(i, w4); const m = new Map(); for (let c = 0; c < 4; c++) if (w4[c] > 0) m.set(j4[c], (m.get(j4[c]) || 0) + w4[c]); return m; };
    const mix = (a, b, k) => { const m = new Map(); for (const [j, v] of a) m.set(j, (m.get(j) || 0) + v * (1 - k)); for (const [j, v] of b) m.set(j, (m.get(j) || 0) + v * k); return m; };
    let front2 = new Set(snapW.keys()); const seenW = new Set(front2), got = new Map(snapW);
    for (const w of snapW.keys()) for (const i of members.get(w)) setW(i, snapW.get(w));
    for (const k of [0.5, 0.2]) {
      const nxt = new Map();
      for (const w of front2) for (const v of adj.get(w) ?? []) { if (seenW.has(v)) continue; if (!nxt.has(v)) nxt.set(v, []); nxt.get(v).push(got.get(w)); }
      for (const [v, ms] of nxt) { const avg = new Map(); for (const m of ms) for (const [j, x] of m) avg.set(j, (avg.get(j) || 0) + x / ms.length); got.set(v, avg); seenW.add(v); for (const i of members.get(v)) setW(i, mix(own(i), avg, k)); }
      front2 = new Set(nxt.keys());
    }
  }
  for (const w of rnb.keys()) edgeW.add(w);
  console.log('the rims near the neck:', rnb.size, 'points,', rnb.size - free.length, 'pinched;', laid, 'laid on the new part');
}

// ---- the cloth's texels of skin near the rims painted the cloth (each face's neighbours' cloth colour)
let painted = 0;
{
  const { wid } = W0, near = new Set();
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let q = 0; q < 3; q++) if (edgeW.has(wid[I[t + q]])) near.add(t); }
  const byW = new Map(); for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let q = 0; q < 3; q++) { const w = wid[I[t + q]]; if (!byW.has(w)) byW.set(w, []); byW.get(w).push(t); } }
  const ring2 = new Set(near); for (const t of near) for (let q = 0; q < 3; q++) for (const t2 of byW.get(wid[I[t + q]]) ?? []) ring2.add(t2);
  const nbs = (t) => { const s = new Set(); for (let q = 0; q < 3; q++) for (const t2 of byW.get(wid[I[t + q]]) ?? []) s.add(t2); return s; };
  for (const t of ring2) {
    const skinTx = []; faceTexels(t, (x, y) => { if (isSkinTexel(x, y)) skinTx.push([x, y]); }, 1.5); if (!skinTx.length) continue;
    const m = [0, 0, 0]; let c = 0; for (const t2 of nbs(t)) faceTexels(t2, (x, y) => { if (isSkinTexel(x, y)) return; const q = 4 * (y * TW + x); m[0] += raw[q]; m[1] += raw[q + 1]; m[2] += raw[q + 2]; c++; }, 1.5);
    if (!c) continue; for (const [x, y] of skinTx) { const q = 4 * (y * TW + x); raw[q] = m[0] / c; raw[q + 1] = m[1] / c; raw[q + 2] = m[2] / c; painted++; }
  }
}
console.log('skin texels on the cloth\'s edge painted the cloth', painted);

// ---- the new part into the primitive
const addP = [], addN = [], addUV = [], addJ = [], addW = [], newIdx = new Map();
for (const t of bustK) for (let c = 0; c < 3; c++) {
  const i = QI[3 * t + c]; if (newIdx.has(i)) continue;
  const w = qw[i], p = Pb.get(w); newIdx.set(i, n0 + addP.length / 3);
  addP.push(p.x, p.y, p.z); addN.push(0, 1, 0);
  QUV.getElement(i, uv2); const u = uv2[0] - Math.floor(uv2[0]), v = uv2[1] - Math.floor(uv2[1]);
  addUV.push((0.5 + u * (BAND - 1)) / TW, (TH + 0.5 + v * (BAND - 1)) / NH);
  const ent = [...Wb.get(w).entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4), s = ent.reduce((a, e) => a + e[1], 0) || 1;
  const js = [0, 0, 0, 0], ws = [0, 0, 0, 0]; ent.forEach(([b, x], q) => { js[q] = b; ws[q] = x / s; }); addJ.push(...js); addW.push(...ws);
}
const bustI = []; for (const t of bustK) bustI.push(newIdx.get(QI[3 * t]), newIdx.get(QI[3 * t + 1]), newIdx.get(QI[3 * t + 2]));

// ---- small holes in the old body closed (not the opening, not the cuffs)
let holes = 0;
{
  const { wid } = W0, rep = new Map(); for (let i = 0; i < n0; i++) if (!rep.has(wid[i])) rep.set(wid[i], i);
  const edges = new Map(), ek = (u, v) => `${u},${v}`;
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let q = 0; q < 3; q++) { const u = wid[I[t + q]], v = wid[I[t + (q + 1) % 3]]; if (u === v) continue; edges.set(ek(u, v), [I[t + q], I[t + (q + 1) % 3]]); } }
  const next = new Map(); for (const [kk] of edges) { const [u, v] = kk.split(',').map(Number); if (!edges.has(ek(v, u))) next.set(u, v); }
  const seen = new Set();
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const loop = []; let u = s, guard = 0; while (!seen.has(u) && next.has(u) && guard++ < 20000) { seen.add(u); loop.push(u); u = next.get(u); }
    if (u !== s || loop.length < 3) continue;
    const pts = loop.map((w) => V3(rep.get(w)));
    if (pts.every((p) => p.y < s3.y - 0.1)) continue; // (the upper body only)
    let wind = 0; for (let q = 0; q < pts.length; q++) { const a = polar(pts[q].x, pts[q].z)[1], b = polar(pts[(q + 1) % pts.length].x, pts[(q + 1) % pts.length].z)[1]; let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; wind += d; }
    let len = 0; for (let q = 0; q < pts.length; q++) len += pts[q].distanceTo(pts[(q + 1) % pts.length]);
    if (Math.abs(wind) > Math.PI || len > 0.45) continue;
    const c = pts.reduce((m, q) => m.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    let best = rep.get(loop[0]), bd = Infinity; for (const w of loop) { const d = V3(rep.get(w)).distanceTo(c); if (d < bd) { bd = d; best = rep.get(w); } }
    const ci = n0 + addP.length / 3;
    addP.push(c.x, c.y, c.z); addN.push(0, 1, 0); UV.getElement(best, uv2); addUV.push(uv2[0], uv2[1]); J.getElement(best, j4); W.getElement(best, w4); addJ.push(...j4); addW.push(...w4);
    for (let q = 0; q < loop.length; q++) { const [a, b] = edges.get(ek(loop[q], loop[(q + 1) % loop.length])); I.push(b, a, ci); }
    holes++;
  }
}
I.push(...bustI);
{
  const cat = (A, add, scale) => { const old = A.getArray(), T = old.constructor, nn = new T(old.length + add.length); nn.set(old); nn.set(T === Float32Array ? add : add.map((v) => Math.round(v * scale)), old.length); A.setArray(nn); };
  const wScale = W.getArray() instanceof Uint8Array ? 255 : W.getArray() instanceof Uint16Array ? 65535 : 1;
  cat(P, addP, 1); cat(N, addN, 1); cat(UV, addUV, 1); cat(J, addJ, 1); cat(W, addW, wScale);
}
const n = P.getCount(), isNew2 = new Uint8Array(n); isNew2.set(isNew); const bustN = newIdx.size;
for (let i = n0; i < n0 + bustN; i++) isNew2[i] = 2; // (the new part)

// ---- normals: the old body's again; the neck and the new part as one surface with the head's skin
{
  const { wid, nW: nw } = weld(), acc = new Float32Array(nw * 3), accS = new Float32Array(nw * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), q = [0, 0, 0];
  const skinV = (i) => isNew2[i] === 2 || (i < n0 && isSk[i]);
  for (let t = 0; t < I.length; t += 3) {
    const v0 = I[t], v1 = I[t + 1], v2 = I[t + 2];
    P.getElement(v0, q); a.fromArray(q); P.getElement(v1, q); b.fromArray(q); P.getElement(v2, q); c.fromArray(q);
    const nn = b.sub(a).cross(c.sub(a));
    if (!isNew2[v0] && !isNew2[v1] && !isNew2[v2]) for (const v of [v0, v1, v2]) { const w = wid[v]; acc[3 * w] += nn.x; acc[3 * w + 1] += nn.y; acc[3 * w + 2] += nn.z; }
    if (skinV(v0) && skinV(v1) && skinV(v2)) for (const v of [v0, v1, v2]) { const w = wid[v]; accS[3 * w] += nn.x; accS[3 * w + 1] += nn.y; accS[3 * w + 2] += nn.z; }
  }
  for (let i = 0; i < n; i++) {
    const w = wid[i];
    if (!isNew2[i]) { a.set(acc[3 * w], acc[3 * w + 1], acc[3 * w + 2]); if (a.lengthSq() > 1e-20) { a.normalize(); N.setElement(i, [a.x, a.y, a.z]); } continue; }
    if (!skinV(i)) continue;
    a.set(accS[3 * w], accS[3 * w + 1], accS[3 * w + 2]); if (a.lengthSq() < 1e-20) continue; a.normalize();
    if (isNew2[i] === 2) { N.setElement(i, [a.x, a.y, a.z]); continue; }
    P.getElement(i, q); const [, th] = polar(q[0], q[2]), ry = rimAt(th).y, s = 1 - sstep(ry + 0.01, ry + 0.05, q[1]); if (s <= 0) continue;
    N.getElement(i, q); b.fromArray(q).lerp(a, s).normalize(); N.setElement(i, [b.x, b.y, b.z]);
  }
}
prim.getIndices().setArray(new Uint32Array(I));

// ---- the new part's texels (its blocks of the band's skin): the base texture's non-skin (the base woman's underwear)
// painted its skin round it; round the sides and the back below the neck's root, the shirt (a clean linen, its seam a
// little shaded at the neck) — the shirt's in the regions' map
let inpaint = 0, clothT = 0;
{
  const S = BAND, mask = new Uint8Array(S * S), cloth = new Float32Array(S * S).fill(-1), dropT = new Float32Array(S * S).fill(-1);
  const D0 = +(process.env.COLLAR ?? 0.012), FZ = +(process.env.FRONT_ZT ?? 0.02);
  for (let t = 0; t < bustI.length; t += 3) {
    const vs = [0, 1, 2].map((c) => bustI[t + c]), q2 = vs.map((v) => { UV.getElement(v, uv2); return [uv2[0] * TW, uv2[1] * NH - TH]; }), P3 = vs.map((v) => V3(v));
    const [A, B, C] = q2, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    const e = 2 / Math.max(1, Math.sqrt(Math.abs(den)));
    for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 2); y <= Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 2); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 2); x <= Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 2); x++) {
      const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -e || l2 < -e || l3 < -e) continue;
      mask[y * S + x] = 1;
      const pp = P3[0].clone().multiplyScalar(Math.max(0, l1)).addScaledVector(P3[1], Math.max(0, l2)).addScaledVector(P3[2], Math.max(0, l3)).multiplyScalar(1 / Math.max(1e-6, Math.max(0, l1) + Math.max(0, l2) + Math.max(0, l3)));
      const th = polar(pp.x, pp.z)[1], dr = rimAt(th).y - pp.y, cv = sstep(D0 - 0.004, D0 + 0.004, dr) * (1 - sstep(nk.z + FZ - 0.012, nk.z + FZ + 0.012, pp.z));
      cloth[y * S + x] = Math.max(cloth[y * S + x], cv); if (pp.z > nk.z) dropT[y * S + x] = Math.max(dropT[y * S + x], dr);
    }
  }
  const at = (x, y) => 4 * ((TH + y) * TW + x);
  const bad = new Uint8Array(S * S); let nb = 0;
  // (and on the chest, the base body's own marks: its nipples, redder than its skin)
  const grs = []; for (let i = 0; i < S * S; i += 7) if (mask[i]) { const q = at(i % S, Math.floor(i / S)); grs.push(raw[q + 1] / Math.max(1, raw[q])); } grs.sort((a, b) => a - b); const gr0 = grs[grs.length >> 1] ?? 0.78;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { if (!mask[y * S + x]) continue; const q = at(x, y), r = raw[q], g = raw[q + 1], bl = raw[q + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl); if (mx - mn < 0.12 * mx || r < g || (dropT[y * S + x] > 0.04 && g / Math.max(1, r) < gr0 - 0.06)) { bad[y * S + x] = 1; nb++; } }
  for (let pass = 0; pass < 200 && nb; pass++) {
    const fill = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!bad[y * S + x]) continue; const m = [0, 0, 0]; let c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= S || yy >= S || bad[yy * S + xx] || !mask[yy * S + xx]) continue; const q = at(xx, yy); m[0] += raw[q]; m[1] += raw[q + 1]; m[2] += raw[q + 2]; c++; }
      if (c >= 2) fill.push([x, y, m.map((v) => v / c)]);
    }
    if (!fill.length) break;
    for (const [x, y, m] of fill) { const q = at(x, y); raw[q] = m[0]; raw[q + 1] = m[1]; raw[q + 2] = m[2]; bad[y * S + x] = 0; nb--; inpaint++; }
  }
  // the chest below the collarbones smoothed (the base body's fine marks there: its muscles' lines, what is left of its
  // nipples) — where the opening shows it
  {
    const blk = Buffer.alloc(S * S * 3); for (let i = 0; i < S * S; i++) { const q = at(i % S, Math.floor(i / S)); blk[3 * i] = raw[q]; blk[3 * i + 1] = raw[q + 1]; blk[3 * i + 2] = raw[q + 2]; }
    const bl = await sharp(blk, { raw: { width: S, height: S, channels: 3 } }).blur(S / 110).raw().toBuffer();
    for (let i = 0; i < S * S; i++) { if (!mask[i] || dropT[i] < 0) continue; const k = sstep(0.035, 0.07, dropT[i]); if (k <= 0) continue; const q = at(i % S, Math.floor(i / S)); for (let c = 0; c < 3; c++) raw[q + c] = Math.round(raw[q + c] * (1 - k) + bl[3 * i + c] * k); }
    // (its colour the neck's: the base chest was painted warmer, pinker in places — its light kept)
    const nc = [0, 0, 0]; let nn = 0; for (let i = 0; i < S * S; i++) { if (!mask[i] || dropT[i] < 0 || dropT[i] > 0.02) continue; const q = at(i % S, Math.floor(i / S)); for (let c = 0; c < 3; c++) nc[c] += raw[q + c]; nn++; }
    if (nn) { for (let c = 0; c < 3; c++) nc[c] /= nn; const nl = lum(...nc);
      for (let i = 0; i < S * S; i++) { if (!mask[i] || dropT[i] < 0) continue; const k = sstep(0.02, 0.05, dropT[i]); if (k <= 0) continue; const q = at(i % S, Math.floor(i / S)), l = lum(raw[q], raw[q + 1], raw[q + 2]) / nl; for (let c = 0; c < 3; c++) raw[q + c] = Math.round(raw[q + c] * (1 - k) + Math.min(255, nc[c] * l) * k); } }
  }
  // the shirt: linen, the skin texture's broad light kept a little (folds), its seam at the neck shaded
  const Lb = new Float32Array(S * S); { const L1 = Buffer.alloc(S * S); for (let i = 0; i < S * S; i++) { const q = at(i % S, Math.floor(i / S)); L1[i] = Math.round(lum(raw[q], raw[q + 1], raw[q + 2])); } const bl = await sharp(L1, { raw: { width: S, height: S, channels: 1 } }).blur(S / 120).extractChannel(0).raw().toBuffer(); for (let i = 0; i < S * S; i++) Lb[i] = bl[i]; }
  let lm = 0, lc = 0; for (let i = 0; i < S * S; i++) if (cloth[i] > 0.5) { lm += Lb[i]; lc++; } lm = lc ? lm / lc : 1;
  const LINEN = [238, 230, 214];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, cv = cloth[i]; if (!mask[i] || cv <= 0) continue;
    const k = Math.max(0.72, Math.min(1.04, 0.9 * Math.pow(Lb[i] / lm, 0.5))) * (1 - 0.28 * (1 - Math.abs(2 * cv - 1)) * (cv < 0.98 ? 1 : 0));
    const q = at(x, y); for (let c = 0; c < 3; c++) raw[q + c] = Math.round(raw[q + c] * (1 - cv) + Math.min(255, LINEN[c] * k) * cv);
    if (cv > 0.5) { regSet(x, TH + y, 32); clothT++; }
  }
}
console.log('the base texture\'s non-skin under the new part painted its skin', inpaint, 'texels; its shirt round the sides and back', clothT, 'texels');
tex.setImage(await sharp(raw, { raw: { width: TW, height: NH, channels: 4 } }).webp({ quality: 92 }).toBuffer()).setMimeType('image/webp');
console.log(inPath, `— the new part: ${bustN} points, ${bustI.length / 3} triangles; holes closed ${holes}; loose bits ${bits}`);
await doc.transform(prune({ propertyTypes: ['accessor'] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outPath, doc);
if (regOut && process.env.REG_OUT) { await sharp(Buffer.from(regOut), { raw: { width: RW, height: RH, channels: 1 } }).png().toFile(process.env.REG_OUT); console.log('regions\' map', process.env.REG_OUT, RW + '×' + RH); }
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
