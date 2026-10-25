// The neck cleaned (David 25 Oct: "why does she look awful?"): head.mjs laid the base head's neck into the Beginner's
// drawn neck, and what was left of the drawn one — its cut edges, its collar's torn bits, loose shards — stood round the
// new neck as a ragged ring, with holes into the body at the shoulders where the drawn hair was cut away.
//  1. a smooth skin flare is made round the neck (a surface of revolution about the neck's axis): from inside the new
//     neck, down and out into the shoulders, where it tucks under the shirt — the neck's foot;
//  2. everything of the old body above that flare and round the new neck goes (the ragged ring, the shards, the old
//     neck), and loose pieces left near the neck;
//  3. the holes in the old body are closed (each hole a fan from its middle, coloured from its nearest edge) — not the
//     shirt's opening round the neck;
//  4. the old body's normals are made again.
// node neck.mjs IN.glb OUT.glb [RB]   (RB: the flare's foot radius, body units; run where @gltf-transform, meshoptimizer
// and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from '/home/claude/god-of-legacy/node_modules/three/build/three.module.js';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inPath, outPath, rbArg] = process.argv.slice(2);
const doc = await io.read(inPath); await doc.transform(dequantize());
const skin = doc.getRoot().listSkins()[0], names = skin.listJoints().map((n) => n.getName()), ibm = skin.getInverseBindMatrices().getArray();
const at = (nm) => { const i = names.indexOf(nm); return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(ibm.slice(16 * i, 16 * i + 16)).invert()); };
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0'), N = prim.getAttribute('NORMAL'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
let I = Array.from(prim.getIndices().getArray());
const n0 = P.getCount();
const meta = await sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())).metadata();
const bandV = (meta.height - meta.width / 2) / meta.height; // (head.mjs: the base head's textures in a band under the atlas)
const nk = at('neck_01'), hd = at('Head'), cl = at('clavicle_r'), ni = names.indexOf('neck_01'), si = names.indexOf('spine_03');
const p = [0, 0, 0], uv = [0, 0], j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
const isNew = new Uint8Array(n0); for (let i = 0; i < n0; i++) { UV.getElement(i, uv); isNew[i] = uv[1] >= bandV - 1e-4 ? 1 : 0; }
const polar = (x, z) => { const dx = x - nk.x, dz = z - nk.z; return [Math.hypot(dx, dz), (((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1]; };
const neckW = (i) => { J.getElement(i, j4); W.getElement(i, w4); let s = 0; for (let k = 0; k < 4; k++) if (j4[k] === ni) s += w4[k]; return s; };

// the new neck: its bottom per side (its points on the neck's bone) and its radius by height and side (the smallest of
// the new head's points there: its skin, not its hair)
const NB = 24, bottom = new Array(NB).fill(Infinity);
for (let i = 0; i < n0; i++) { if (!isNew[i] || neckW(i) < 0.3) continue; P.getElement(i, p); const [r, th] = polar(p[0], p[2]); if (r > 0.1) continue; const b = Math.floor(th * NB) % NB; if (p[1] < bottom[b]) bottom[b] = p[1]; }
const DY = 0.006, y0 = cl.y - 0.08, NY = Math.ceil((hd.y + 0.06 - y0) / DY), rNew = new Float32Array(NY * NB).fill(Infinity);
for (let i = 0; i < n0; i++) {
  if (!isNew[i]) continue; P.getElement(i, p); if (p[1] < y0 || p[1] >= hd.y + 0.06) continue;
  const [r, th] = polar(p[0], p[2]); if (r > 0.16) continue;
  const k = Math.floor((p[1] - y0) / DY) * NB + (Math.floor(th * NB) % NB); if (r < rNew[k]) rNew[k] = r;
}
const rAt = (y, th) => { const yi = Math.floor((y - y0) / DY), ti = Math.floor(th * NB) % NB; let best = Infinity; for (const dy of [0, -1, 1]) for (const dt of [0, -1, 1]) { const yy = yi + dy; if (yy < 0 || yy >= NY) continue; const v = rNew[yy * NB + ((ti + dt + NB) % NB)]; if (v < best) best = v; } return best; };

// 1. the flare: its top inside the new neck (just above where the new neck ends, or a little above the shoulders where
// it goes on down), its foot at RB round the neck, where the old body's surface is at that radius, a little under it
const RB = +(rbArg ?? 0.14), NS = 48, RINGS = 7;
// the flare's top: one height all round, where the new neck is a whole ring of skin on every side (scanned down from
// the neck's middle until a side has a gap), a little above
let yTop = -Infinity;
for (let b = 0; b < NB; b++) {
  let y = nk.y + 0.04; while (y > cl.y - 0.06) { const r = rNew[Math.floor((y - y0) / DY) * NB + b]; if (!(r < 0.1)) break; y -= DY; }
  yTop = Math.max(yTop, y + DY);
}
yTop = Math.max(yTop + 0.012, cl.y + 0.045);
const ring = [];
for (let s = 0; s < NS; s++) {
  const th = (s + 0.5) / NS, yT = yTop;
  let rT = rAt(yT, th); if (!isFinite(rT)) rT = 0.065; rT -= 0.001; // (flush with the new neck, which ends just below)
  // the old body's top at the flare's foot (its highest point at RB ± 0.015 on this side, below the neck's foot)
  let yS = -Infinity; for (let i = 0; i < n0; i++) { if (isNew[i]) continue; P.getElement(i, p); if (p[1] > cl.y + 0.06 || p[1] < cl.y - 0.12) continue; const [r, t2] = polar(p[0], p[2]); if (Math.abs(r - RB) > 0.015) continue; let d = Math.abs(t2 - th); d = Math.min(d, 1 - d); if (d > 1.2 / NS) continue; if (p[1] > yS) yS = p[1]; }
  if (!isFinite(yS)) yS = cl.y;
  ring.push({ th, yT, rT, yB: Math.min(yS - 0.012, yT - 0.02), rB: RB });
}
// a smooth foot round the neck (the sides' heights eased with their neighbours)
for (let it = 0; it < 3; it++) { const yb = ring.map((q) => q.yB); ring.forEach((q, s) => { q.yB = (yb[(s + NS - 1) % NS] + 2 * yb[s] + yb[(s + 1) % NS]) / 4; }); }
const prof = (q, t) => { const a = (t * Math.PI) / 2; return [q.rT + (q.rB - q.rT) * (1 - Math.cos(a)), q.yT - (q.yT - q.yB) * Math.sin(a)]; }; // (down the neck first, then out along the shoulders)
// its skin: one texel of the new neck's own skin, the one nearest the middle tone of its texels just above the flare's
// top (one colour all over: no streaks; the light shades it)
const skinUV = new Array(NS);
{
  const img = sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())), m = await img.metadata(), raw = await img.ensureAlpha().raw().toBuffer();
  const col = (i) => { UV.getElement(i, uv); const x = Math.min(m.width - 1, Math.max(0, Math.floor(uv[0] * m.width))), y = Math.min(m.height - 1, Math.max(0, Math.floor(uv[1] * m.height))), q = 4 * (y * m.width + x); return [raw[q], raw[q + 1], raw[q + 2]]; };
  const cand = []; for (let i = 0; i < n0; i++) { if (!isNew[i]) continue; P.getElement(i, p); if (p[1] < yTop || p[1] > yTop + 0.05) continue; const [r, th] = polar(p[0], p[2]); if (r > rAt(p[1], th) + 0.004) continue; cand.push(i); }
  const cs = cand.map(col), lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], byL = cs.slice().sort((a, b) => lum(a) - lum(b)), med = byL[Math.floor(byL.length * 0.7)]; // (its lit tone: the light shades it again)
  let best = cand[0], bd = Infinity; cand.forEach((i, k) => { const d = Math.hypot(cs[k][0] - med[0], cs[k][1] - med[1], cs[k][2] - med[2]); if (d < bd) { bd = d; best = i; } });
  UV.getElement(best, uv); const u0 = [uv[0], uv[1]]; for (let s = 0; s < NS; s++) skinUV[s] = u0;
  console.log('flare skin', med.join(','), 'from', cand.length, 'neck points');
}
const addP = [], addN = [], addUV = [], addJ = [], addW = [], flareStart = n0;
for (let k = 0; k <= RINGS; k++) for (let s = 0; s < NS; s++) {
  const q = ring[s], t = k / RINGS, [r, y] = k === RINGS ? [q.rB + 0.035, q.yB - 0.02] : prof(q, t); // (the last ring tucked under the shirt)
  const a = q.th * 2 * Math.PI - Math.PI;
  addP.push(nk.x + Math.sin(a) * r, y, nk.z + Math.cos(a) * r); addN.push(Math.sin(a), 0, Math.cos(a)); addUV.push(...skinUV[s]);
  const tw = Math.min(1, t * 1.2); addJ.push(ni, si, 0, 0); addW.push(1 - tw, tw, 0, 0);
}
const fv = (k, s) => flareStart + k * NS + ((s + NS) % NS);
const flareTris = [];
for (let k = 0; k < RINGS; k++) for (let s = 0; s < NS; s++) { const a = fv(k, s), b = fv(k, s + 1), c = fv(k + 1, s), d = fv(k + 1, s + 1); flareTris.push(a, c, b, b, c, d); }
{ // the winding: the first face's normal against the outward way
  const v = (i) => new THREE.Vector3(addP[3 * (i - n0)], addP[3 * (i - n0) + 1], addP[3 * (i - n0) + 2]);
  const A = v(flareTris[0]), B = v(flareTris[1]), C = v(flareTris[2]), nrm = B.clone().sub(A).cross(C.clone().sub(A)), out = A.clone().sub(new THREE.Vector3(nk.x, A.y, nk.z));
  if (nrm.dot(out) < 0) for (let t = 0; t < flareTris.length; t += 3) { const x = flareTris[t + 1]; flareTris[t + 1] = flareTris[t + 2]; flareTris[t + 2] = x; }
}

// 2. the old body above the flare (and round the new neck above its top) goes
const ringAt = (th) => ring[Math.floor(th * NS) % NS];
/** Is this point of the old body above the flare (or round the new neck above its top)? */
const isAbove = (x, y, z) => {
  if (y < cl.y - 0.12) return false;
  const [r, th] = polar(x, z), q = ringAt(th);
  if (y >= q.yT) { const rn = rAt(y, th); return r < (isFinite(rn) ? rn : q.rT) + 0.06; }
  if (r >= q.rB + 0.004) return false;
  if (r <= q.rT) return true;
  const t = (2 / Math.PI) * Math.acos(THREE.MathUtils.clamp(1 - (r - q.rT) / (q.rB - q.rT), -1, 1)), ys = q.yT - (q.yT - q.yB) * Math.sin((t * Math.PI) / 2);
  return y > ys - 0.02; // (and what lies just under it: nothing of the old body shows through it)
};
const above = new Uint8Array(n0); for (let i = 0; i < n0; i++) { if (isNew[i]) continue; P.getElement(i, p); above[i] = isAbove(p[0], p[1], p[2]) ? 1 : 0; }
// a face goes when two of its corners or its middle are above (one poking through the flare goes too)
let cut = 0;
{
  const keep = [], q3 = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2]; if (isNew[a]) { keep.push(a, b, c); continue; }
    let mx = 0, my = 0, mz = 0; for (const v of [a, b, c]) { P.getElement(v, q3); mx += q3[0] / 3; my += q3[1] / 3; mz += q3[2] / 3; }
    if (above[a] + above[b] + above[c] >= 2 || isAbove(mx, my, mz)) { cut++; continue; }
    keep.push(a, b, c);
  }
  I = keep;
}

// the new neck's own part below the flare's top goes (the flare is the neck there: no two skins on one another)
let neckCut = 0;
{
  const keep = [], q3 = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (isNew[a] && isNew[b] && isNew[c]) { let low = true; for (const v of [a, b, c]) { P.getElement(v, q3); if (q3[1] > yTop - 0.004 || polar(q3[0], q3[2])[0] > 0.1) low = false; } if (low) { neckCut++; continue; } }
    keep.push(a, b, c);
  }
  I = keep;
}

// welded points of the old body (the same place: one point) — for its pieces, its holes and its normals
const key = (i) => { P.getElement(i, p); return `${Math.round(p[0] * 2e4)},${Math.round(p[1] * 2e4)},${Math.round(p[2] * 2e4)}`; };
const weld = () => { const id = new Map(), wid = new Int32Array(P.getCount()); for (let i = 0; i < P.getCount(); i++) { const kk = key(i); if (!id.has(kk)) id.set(kk, id.size); wid[i] = id.get(kk); } return { wid, nW: id.size }; };
// loose pieces near the neck go
let bits = 0;
{
  const { wid, nW } = weld(), par = new Int32Array(nW).map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; const u = find(wid[I[t]]); par[find(wid[I[t + 1]])] = u; par[find(wid[I[t + 2]])] = u; }
  const size = new Map(), high = new Map(), close = new Map();
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; const c = find(wid[I[t]]); size.set(c, (size.get(c) || 0) + 1); P.getElement(I[t], p); high.set(c, Math.max(high.get(c) ?? -9, p[1])); close.set(c, Math.min(close.get(c) ?? 9, polar(p[0], p[2])[0])); }
  const keep = []; for (let t = 0; t < I.length; t += 3) { if (!isNew[I[t]]) { const c = find(wid[I[t]]); if (size.get(c) < 300 && high.get(c) > cl.y - 0.06 && close.get(c) < 0.2) { bits++; continue; } } keep.push(I[t], I[t + 1], I[t + 2]); }
  I = keep;
}

// the shirt's edge round the flare: laid on the flare, its line eased round the neck (no teeth)
let snapped = 0;
{
  const { wid, nW } = weld(), members = new Map(); for (let i = 0; i < P.getCount(); i++) { if (isNew[i]) continue; const w = wid[i]; if (!members.has(w)) members.set(w, []); members.get(w).push(i); }
  const edges = new Set(); const ek = (u, v) => `${u},${v}`;
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let k = 0; k < 3; k++) { const u = wid[I[t + k]], v = wid[I[t + (k + 1) % 3]]; if (u !== v) edges.add(ek(u, v)); } }
  const next = new Map(); for (const k of edges) { const [u, v] = k.split(',').map(Number); if (!edges.has(ek(v, u))) next.set(u, v); }
  const seen = new Set();
  for (const s0 of next.keys()) {
    if (seen.has(s0)) continue;
    const loop = []; let u = s0, guard = 0; while (!seen.has(u) && next.has(u) && guard++ < 5000) { seen.add(u); loop.push(u); u = next.get(u); }
    if (u !== s0 || loop.length < 8) continue;
    const pol = loop.map((w) => { P.getElement(members.get(w)[0], p); return polar(p[0], p[2]); });
    let wind = 0; for (let k = 0; k < pol.length; k++) { let d = pol[(k + 1) % pol.length][1] - pol[k][1]; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; wind += d; }
    if (Math.abs(wind) < 0.5) continue; // (only the opening round the neck)
    let rs = pol.map((x) => x[0]);
    for (let it = 0; it < 6; it++) rs = rs.map((_, k) => (rs[(k + rs.length - 1) % rs.length] + 2 * rs[k] + rs[(k + 1) % rs.length]) / 4);
    loop.forEach((w, k) => {
      const th = pol[k][1], q = ringAt(th), r = THREE.MathUtils.clamp(rs[k], q.rT + 0.004, q.rB), t = (2 / Math.PI) * Math.acos(THREE.MathUtils.clamp(1 - (r - q.rT) / (q.rB - q.rT), -1, 1));
      const y = q.yT - (q.yT - q.yB) * Math.sin((t * Math.PI) / 2), a = th * 2 * Math.PI - Math.PI;
      for (const i of members.get(w)) P.setElement(i, [nk.x + Math.sin(a) * r, y + 0.001, nk.z + Math.cos(a) * r]);
      snapped++;
    });
  }
}

// 3. the holes closed (not the opening round the neck; not the cuffs or the trousers' ends)
let holes = 0, opening = 0;
{
  const { wid, nW } = weld(), rep = new Int32Array(nW).fill(-1); for (let i = 0; i < P.getCount(); i++) if (rep[wid[i]] < 0) rep[wid[i]] = i;
  const edges = new Map(); const ek = (u, v) => `${u},${v}`;
  for (let t = 0; t < I.length; t += 3) { if (isNew[I[t]]) continue; for (let k = 0; k < 3; k++) { const u = wid[I[t + k]], v = wid[I[t + (k + 1) % 3]]; if (u === v) continue; edges.set(ek(u, v), [I[t + k], I[t + (k + 1) % 3]]); } }
  const next = new Map(); for (const [k] of edges) { const [u, v] = k.split(',').map(Number); if (!edges.has(ek(v, u))) next.set(u, v); }
  const seen = new Set();
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const loop = []; let u = s, guard = 0; while (!seen.has(u) && next.has(u) && guard++ < 5000) { seen.add(u); loop.push(u); u = next.get(u); }
    if (u !== s || loop.length < 3) continue;
    const pts = loop.map((w) => { P.getElement(rep[w], p); return [...p]; });
    let wind = 0; for (let k = 0; k < pts.length; k++) { const a = Math.atan2(pts[k][0] - nk.x, pts[k][2] - nk.z), b = Math.atan2(pts[(k + 1) % pts.length][0] - nk.x, pts[(k + 1) % pts.length][2] - nk.z); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; wind += d; }
    let len = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; len += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
    if (Math.abs(wind) > Math.PI || len > 0.6) { opening++; continue; }
    const c = pts.reduce((m, q) => [m[0] + q[0] / pts.length, m[1] + q[1] / pts.length, m[2] + q[2] / pts.length], [0, 0, 0]);
    let best = rep[loop[0]], bd = Infinity; for (const w of loop) { P.getElement(rep[w], p); const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); if (d < bd) { bd = d; best = rep[w]; } }
    const ci = n0 + addP.length / 3;
    addP.push(...c); addN.push(0, 1, 0); UV.getElement(best, uv); addUV.push(...uv); J.getElement(best, j4); W.getElement(best, w4); addJ.push(...j4); addW.push(...w4);
    for (let k = 0; k < loop.length; k++) { const [a, b] = edges.get(ek(loop[k], loop[(k + 1) % loop.length])); I.push(b, a, ci); }
    holes++;
  }
}
I.push(...flareTris);
{
  const cat = (A, add) => { const old = A.getArray(), T = old.constructor, nn = new T(old.length + add.length); nn.set(old); nn.set(T === Float32Array ? add : add.map((v) => Math.round(v)), old.length); A.setArray(nn); };
  cat(P, addP); cat(N, addN); cat(UV, addUV); cat(J, addJ); cat(W, addW);
}
const n = P.getCount(); const isNew2 = new Uint8Array(n); isNew2.set(isNew);

// 4. normals again for the old body and the flare (area-weighted over welded points), the new head's kept
{
  const { wid, nW } = weld(), acc = new Float32Array(nW * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), q = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    if (isNew2[I[t]] || isNew2[I[t + 1]] || isNew2[I[t + 2]]) continue;
    P.getElement(I[t], q); a.fromArray(q); P.getElement(I[t + 1], q); b.fromArray(q); P.getElement(I[t + 2], q); c.fromArray(q);
    const nn = b.sub(a).cross(c.sub(a)); for (let k = 0; k < 3; k++) { const w = wid[I[t + k]]; acc[3 * w] += nn.x; acc[3 * w + 1] += nn.y; acc[3 * w + 2] += nn.z; }
  }
  for (let i = 0; i < n; i++) { if (isNew2[i]) continue; const w = wid[i]; a.set(acc[3 * w], acc[3 * w + 1], acc[3 * w + 2]); if (a.lengthSq() < 1e-20) continue; a.normalize(); N.setElement(i, [a.x, a.y, a.z]); }
}
prim.getIndices().setArray(new Uint32Array(I));
console.log(inPath, `— the flare round the neck: ${NS} × ${RINGS + 1} points, foot ${RB}; old body above it cut ${cut} faces, the new neck below its top ${neckCut}; loose bits ${bits} faces; the shirt's edge laid on it ${snapped} points; holes closed ${holes} (openings left ${opening})`);
await doc.transform(prune({ propertyTypes: ['accessor'] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outPath, doc);
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
