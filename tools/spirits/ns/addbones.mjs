// The new Samurai's supplementary bones (GPT, 10 Nov: "split costume shell into left / rear / right panel, give each
// supplementary control bones; ponytail chain: restrained motion; sash tails: secondary motion, but controlled"):
//   node addbones.mjs IN.glb PONY_RIG.json OUT.glb
// - the ponytail: a chain of five bones on the head (hair_01 in the tie … hair_05 low on the back); each lock's
//   vertices weighted along it by where they lie along the ponytail's spine;
// - the skirt below the waist: the shell round the legs cut into its left, rear and right panels (its vertices along
//   the cuts doubled, so the panels part), the two front panels and the sash's two tails apart too; each a chain of two
//   bones on the pelvis, its vertices weighted down it (the waist stays on the body's own weights);
// - the bones rest turned as their parents (the game drives them: SpiritBody's secondary motion).
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import sharp from 'sharp';
import fs from 'fs';
const [inF, ponyF, outF, ponyIdxF] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(inF); const root = doc.getRoot();
const node = root.listNodes().find((n) => n.getMesh() && n.getSkin()); const skin = node.getSkin(); const prim = node.getMesh().listPrimitives()[0];
const joints = skin.listJoints(); const names = joints.map((j) => j.getName());
const PONY = JSON.parse(fs.readFileSync(ponyF, 'utf8'));
const A = (s) => prim.getAttribute(s);
let P = Array.from(A('POSITION').getArray()), UV = Array.from(A('TEXCOORD_0').getArray());
let NRM = A('NORMAL') ? Array.from(A('NORMAL').getArray()) : null;
let JJ = Array.from(A('JOINTS_0').getArray()), WW = Array.from(A('WEIGHTS_0').getArray());
const wScale = A('WEIGHTS_0').getArray() instanceof Float32Array ? 1 : A('WEIGHTS_0').getArray() instanceof Uint8Array ? 255 : 65535;
let I = Array.from(prim.getIndices().getArray());
const nV0 = P.length / 3;
console.log('in: verts', nV0, 'tris', I.length / 3, 'joints', names.length);

// ---------------- the texture (the sash's tails are told by their crimson)
const texImg = prim.getMaterial().getBaseColorTexture().getImage();
const { data: TX, info } = await sharp(Buffer.from(texImg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const colAt = (u, v) => { const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height))); const k = 3 * (y * info.width + x); return [TX[k], TX[k + 1], TX[k + 2]]; };

// ---------------- the skirt's faces sorted (panels.py's rule)
const LEG = { l: [[0.10, 0.90, -0.055], [0.135, 0.435, -0.07]], r: [[-0.10, 0.90, -0.055], [-0.135, 0.435, -0.07]] };
const legD = (c, s) => { const [a, b] = LEG[s]; const t = Math.min(1.3, Math.max(0, (a[1] - c[1]) / (a[1] - b[1]))); const ax = a.map((v, k) => v + t * (b[k] - v)); return Math.hypot(c[0] - ax[0], c[2] - ax[2]); };
const pantsR = (y) => { const X = [0.30, 0.40, 0.46, 0.55, 0.70, 0.90], Y = [0.075, 0.105, 0.118, 0.112, 0.100, 0.100]; if (y <= X[0]) return Y[0]; for (let k = 1; k < X.length; k++) if (y <= X[k]) return Y[k - 1] + (Y[k] - Y[k - 1]) * (y - X[k - 1]) / (X[k] - X[k - 1]); return Y[Y.length - 1]; };
const G = { base: 0, panel_l: 1, panel_r: 2, panel_b: 3, front_l: 4, front_r: 5, sash_l: 6, sash_r: 7, tasset_l: 8, tasset_r: 9, tasset_b: 10 };
const nF = I.length / 3, fg = new Int8Array(nF);
const pv = (i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
let nSash = 0;
for (let f = 0; f < nF; f++) {
  const a = pv(I[3 * f]), b = pv(I[3 * f + 1]), c3 = pv(I[3 * f + 2]); const c = [0, 1, 2].map((k) => (a[k] + b[k] + c3[k]) / 3);
  if (c[1] >= 0.84 && c[1] < 0.985 && Math.abs(c[0]) < 0.30 && c[2] < 0.05) {
    // the hip plates over the waist (GPT, 10 Nov: armour on moving clothing, not stuck to the pelvis): what stands out
    // of the waist's own surface between the belt and the long panels' tops
    const rN = Math.hypot(c[0] / 0.175, (c[2] + 0.035) / 0.13);
    if (rN > 1.10) fg[f] = Math.abs(c[0]) <= 0.08 ? G.tasset_b : c[0] > 0 ? G.tasset_l : G.tasset_r;
    continue;
  }
  if (c[1] >= 0.84 || c[1] <= 0.30) continue;
  const dl = legD(c, 'l'), dr = legD(c, 'r');
  if (Math.min(dl, dr) < pantsR(c[1]) + 0.012) continue;      // the legs (the hakama, the greaves)
  if (c[2] > 0.075) {
    const u = (UV[2 * I[3 * f]] + UV[2 * I[3 * f + 1]] + UV[2 * I[3 * f + 2]]) / 3, v = (UV[2 * I[3 * f] + 1] + UV[2 * I[3 * f + 1] + 1] + UV[2 * I[3 * f + 2] + 1]) / 3;
    const [r, g, bl] = colAt(u, v); const crim = g < 0.55 * r && bl < 0.95 * r && r > 60 && c[2] > 0.095;
    if (crim) { fg[f] = c[0] >= 0 ? G.sash_l : G.sash_r; nSash++; } else fg[f] = c[0] >= 0 ? G.front_l : G.front_r;
    continue;
  }
  const ang = Math.atan2(c[0], -(c[2] + 0.05)) * 180 / Math.PI;
  fg[f] = Math.abs(ang) <= 32 ? G.panel_b : ang > 0 ? G.panel_l : G.panel_r;
}
{ const cnt = {}; for (const g of fg) cnt[g] = (cnt[g] || 0) + 1; console.log('skirt faces by piece', JSON.stringify(Object.fromEntries(Object.entries(G).map(([k, v]) => [k, cnt[v] || 0])))); }

// ---------------- the cuts: below the waist a vertex shared by two pieces is doubled, each piece its own
const CUT_Y = 0.80;
const owner = new Int8Array(nV0).fill(-1), dup = new Map();
const copyV = (i) => { const j = P.length / 3; P.push(P[3 * i], P[3 * i + 1], P[3 * i + 2]); UV.push(UV[2 * i], UV[2 * i + 1]); if (NRM) NRM.push(NRM[3 * i], NRM[3 * i + 1], NRM[3 * i + 2]); for (let q = 0; q < 4; q++) { JJ.push(JJ[4 * i + q]); WW.push(WW[4 * i + q]); } return j; };
for (let f = 0; f < nF; f++) for (let k = 0; k < 3; k++) {
  const i = I[3 * f + k]; if (i >= nV0) continue;
  const g = fg[f] >= G.tasset_l ? (P[3 * i + 1] < 0.96 ? fg[f] : 0) : P[3 * i + 1] < CUT_Y ? fg[f] : 0;
  if (owner[i] < 0) { owner[i] = g; continue; }
  if (owner[i] === g) continue;
  const key = i * 8 + g; let j = dup.get(key); if (j === undefined) { j = copyV(i); dup.set(key, j); }
  I[3 * f + k] = j;
}
console.log('vertices doubled along the cuts', dup.size);
const nV = P.length / 3;
const vg = new Int8Array(nV).fill(-1);
for (let f = 0; f < nF; f++) for (let k = 0; k < 3; k++) { const i = I[3 * f + k]; if (fg[f] > 0 && (vg[i] < 0 || vg[i] === 0)) vg[i] = fg[f]; else if (vg[i] < 0) vg[i] = 0; }

// ---------------- the new bones
const world = joints.map((j) => new THREE.Matrix4().fromArray(j.getWorldMatrix()));
const wpos = (nm) => new THREE.Vector3().setFromMatrixPosition(world[names.indexOf(nm)]);
const newJ = [];  // { name, parent, pos }
const S = PONY.spine.map((p) => new THREE.Vector3(...p));
// arc length along the spine
const sl = [0]; for (let k = 1; k < S.length; k++) sl.push(sl[k - 1] + S[k].distanceTo(S[k - 1])); const L = sl[sl.length - 1];
const atT = (t) => { const d = t * L; let k = 1; while (k < sl.length - 1 && sl[k] < d) k++; const u = (d - sl[k - 1]) / Math.max(1e-9, sl[k] - sl[k - 1]); return S[k - 1].clone().lerp(S[k], u); };
const HT = [0.035, 0.16, 0.36, 0.58, 0.80];
HT.forEach((t, k) => newJ.push({ name: `hair_0${k + 1}`, parent: k ? `hair_0${k}` : 'Head', pos: atT(t) }));
const CH = {
  panel_l: ['skirt_l', [0.155, 0.86, -0.05], [0.205, 0.66, -0.05]], panel_r: ['skirt_r', [-0.155, 0.86, -0.05], [-0.205, 0.66, -0.05]],
  panel_b: ['skirt_b', [0, 0.86, -0.125], [0, 0.66, -0.165]],
  front_l: ['skirt_fl', [0.07, 0.86, 0.075], [0.09, 0.66, 0.105]], front_r: ['skirt_fr', [-0.07, 0.86, 0.075], [-0.09, 0.66, 0.105]],
  sash_l: ['sash_l', [0.055, 0.88, 0.13], [0.09, 0.62, 0.14]], sash_r: ['sash_r', [-0.06, 0.88, 0.13], [-0.09, 0.70, 0.14]],
};
const TS = { tasset_l: ['tasset_l', [0.17, 0.975, -0.04]], tasset_r: ['tasset_r', [-0.17, 0.975, -0.04]], tasset_b: ['tasset_b', [0, 0.975, -0.13]] };
for (const [, [nm, a, b]] of Object.entries(CH)) { newJ.push({ name: `${nm}_01`, parent: 'pelvis', pos: new THREE.Vector3(...a) }); newJ.push({ name: `${nm}_02`, parent: `${nm}_01`, pos: new THREE.Vector3(...b) }); }
for (const [, [nm, a]] of Object.entries(TS)) newJ.push({ name: nm, parent: 'pelvis', pos: new THREE.Vector3(...a) });
const allNames = [...names];
const allWorld = [...world];
const nodes = [...joints];
for (const nj of newJ) {
  const pi = allNames.indexOf(nj.parent); const pw = allWorld[pi];
  const pr = new THREE.Quaternion(); pw.decompose(new THREE.Vector3(), pr, new THREE.Vector3());
  const w = new THREE.Matrix4().compose(nj.pos, pr, new THREE.Vector3(1, 1, 1));   // turned as its parent
  const local = pw.clone().invert().multiply(w); const t = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); local.decompose(t, q, sc);
  const n = doc.createNode(nj.name).setTranslation(t.toArray()).setRotation(q.toArray()).setScale([1, 1, 1]);
  nodes[pi].addChild(n); nodes.push(n); allNames.push(nj.name); allWorld.push(w);
}
for (const n of nodes.slice(joints.length)) skin.addJoint(n);
const ibm = new Float32Array(allWorld.length * 16); allWorld.forEach((w, i) => ibm.set(w.clone().invert().elements, 16 * i));
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(root.listBuffers()[0]));
const J = (nm) => allNames.indexOf(nm);

// ---------------- the weights
const setW = (i, list) => { // list: [[jointIndex, w], …] (normalised, top four)
  const m = new Map(); for (const [j, w] of list) if (w > 1e-4) m.set(j, (m.get(j) || 0) + w);
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const s = top.reduce((a, e) => a + e[1], 0) || 1;
  for (let q = 0; q < 4; q++) { const w = top[q] ? top[q][1] / s : 0; JJ[4 * i + q] = top[q] ? top[q][0] : 0; WW[4 * i + q] = wScale === 1 ? w : Math.round(w * wScale); }
};
const orig = (i) => { const o = []; for (let q = 0; q < 4; q++) o.push([JJ[4 * i + q], WW[4 * i + q] / wScale]); return o; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the ponytail: its own vertices (by position) along the chain
// (the ponytail's vertices: their indices in the repacked body, found by nearest position — ponyidx.py; rigfit keeps the order)
const ponyIdx = new Set(JSON.parse(fs.readFileSync(ponyIdxF, 'utf8')));
let nPony = 0;
const v3 = new THREE.Vector3();
for (let i = 0; i < nV; i++) {
  if (!ponyIdx.has(i)) continue;
  nPony++;
  v3.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
  // the nearest point along the spine
  let best = Infinity, bt = 0; for (let k = 1; k < S.length; k++) { const a = S[k - 1], b = S[k]; const ab = b.clone().sub(a); const u = Math.min(1, Math.max(0, v3.clone().sub(a).dot(ab) / ab.lengthSq())); const d = a.clone().addScaledVector(ab, u).distanceToSquared(v3); if (d < best) { best = d; bt = (sl[k - 1] + u * (sl[k] - sl[k - 1])) / L; } }
  const list = [];
  if (bt <= HT[0]) { const u = smooth(0, HT[0], bt); list.push([J('Head'), 1 - u], [J('hair_01'), u]); }
  else { let k = 0; while (k < HT.length - 1 && bt > HT[k + 1]) k++; if (k === HT.length - 1) list.push([J('hair_05'), 1]); else { const u = (bt - HT[k]) / (HT[k + 1] - HT[k]); list.push([J(`hair_0${k + 1}`), 1 - u], [J(`hair_0${k + 2}`), u]); } }
  setW(i, list);
}
console.log('ponytail vertices on the hair chain', nPony);
// the skirt's pieces: the waist on the body's own weights, down the piece its two bones
const gname = Object.fromEntries(Object.entries(G).map(([k, v]) => [v, k]));
let nSk = 0;
for (let i = 0; i < nV; i++) {
  const g = vg[i]; if (g <= 0) continue;
  if (g >= G.tasset_l) {   // (a plate: from the belt, where it is the body's own, down to its edge on its bone)
    const [nm] = TS[gname[g]]; const y = P[3 * i + 1]; const w = 1 - smooth(0.875, 0.975, y);
    setW(i, [...orig(i).map(([j, ww]) => [j, ww * (1 - w)]), [J(nm), w]]); nSk++; continue;
  }
  const [nm, a, b] = CH[gname[g]]; const y = P[3 * i + 1];
  const keepOrig = smooth(0.80, 0.85, y);                    // (at the waist: the body's own)
  const uu = 1 - smooth(b[1] - 0.02, a[1], y);
  const list = orig(i).map(([j, w]) => [j, w * keepOrig]);
  list.push([J(`${nm}_01`), (1 - keepOrig) * (1 - uu)], [J(`${nm}_02`), (1 - keepOrig) * uu]);
  setW(i, list); nSk++;
}
console.log('skirt vertices on their chains', nSk, 'sash faces', nSash);

// ---------------- write
const buf = root.listBuffers()[0];
const JT = A('JOINTS_0').getArray().constructor; const WT = A('WEIGHTS_0').getArray().constructor;
prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf));
prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(UV)).setBuffer(buf));
if (NRM) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(NRM)).setBuffer(buf));
prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new (allNames.length > 255 && JT === Uint8Array ? Uint16Array : JT)(JJ)).setBuffer(buf));
prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new WT(WW)).setBuffer(buf));
prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf));
await io.write(outF, doc);
fs.writeFileSync(outF.replace(/\.glb$/, '.bones.json'), JSON.stringify({ hair: HT.map((t, k) => `hair_0${k + 1}`), chains: Object.fromEntries(Object.entries(CH).map(([k, [nm]]) => [k, [`${nm}_01`, `${nm}_02`]])), plates: Object.keys(TS) }));
console.log('wrote', outF, 'verts', nV, 'joints', allNames.length);
