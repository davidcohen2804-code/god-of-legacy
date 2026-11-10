// The new Samurai's proportions re-set in his rest pose (GPT, 10 Nov, experiment P1 — after the technical report: the
// head from the bust was ~1.45× the drawing's, so everything below it was compressed). A new model file beside the old
// one; the skeleton (its bones, their turns and weights), the texture and the motions are his own:
//   node reprop.mjs IN.glb OUT.glb '{"head":0.8,"legs":0.09,"shoulders":0.04,"waist":0.06,"hakama":0.08}'
// - the legs: thigh and calf longer along their own axes, from the soles up (the feet stay on the floor, everything
//   above the hips rises with them);
// - the head scaled about its joint (its face, mask, bangs, tie and crown with it); the ponytail moved with the tie and
//   shrunk only a little (GPT: "don't automatically shrink the entire ponytail by the same factor"); the neck between;
// - the shoulders: the arms (and the pauldrons on them) moved out, the chest unchanged (a wider upper silhouette, not a
//   thicker body);
// - the waist slimmed round the spine, the hakama narrowed round each leg's axis (smooth bands, the arms left alone);
// - each vertex carried by its own weighted bones (linear blend skinning from the old rest to the new), its normal
//   with it; the bones' rest positions moved, their turns unchanged, the inverse binds made again (written in plain
//   floats: pack it afterwards — `pack.mjs`).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

const [inF, outF, optsJ = '{}'] = process.argv.slice(2);
const O = { head: 1, legs: 0, shoulders: 0, waist: 0, hakama: 0, pony: 0.35, ...JSON.parse(optsJ) };
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inF); const root = doc.getRoot();
await doc.transform(dequantize());
const node = root.listNodes().find((n) => n.getMesh() && n.getSkin()); const skin = node.getSkin(); const prim = node.getMesh().listPrimitives()[0];
const joints = skin.listJoints(); const names = joints.map((j) => j.getName()); const J = (nm) => joints[names.indexOf(nm)];

// ---- the rest pose as stored: every node's world matrix, every joint's position
const W = new Map();
const local = (n) => new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale()));
const walk = (n, parent) => { const m = parent.clone().multiply(local(n)); W.set(n, m); for (const c of n.listChildren()) walk(c, m); };
for (const sc of root.listScenes()) for (const n of sc.listChildren()) walk(n, new THREE.Matrix4());
const parentOf = new Map(); for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
const pos = (nm) => new THREE.Vector3().setFromMatrixPosition(W.get(J(nm)));
const ibmA = skin.getInverseBindMatrices().getArray();
const IB = joints.map((_, i) => new THREE.Matrix4().fromArray(ibmA.slice(i * 16, i * 16 + 16)));
const bind = W.get(joints[0]).clone().multiply(IB[0]); // (the attributes' space → the world, at rest)

// ---- his vertices and normals in the world, at rest
const PA = prim.getAttribute('POSITION'), NA = prim.getAttribute('NORMAL'), JA = prim.getAttribute('JOINTS_0'), WA = prim.getAttribute('WEIGHTS_0');
const n = PA.getCount(); const t3 = [0, 0, 0], t4 = [0, 0, 0, 0];
const nb = new THREE.Matrix3().getNormalMatrix(bind);
const P = [], N = [], JW = [];
for (let i = 0; i < n; i++) {
  PA.getElement(i, t3); P.push(new THREE.Vector3(...t3).applyMatrix4(bind));
  NA.getElement(i, t3); N.push(new THREE.Vector3(...t3).applyMatrix3(nb).normalize());
  JA.getElement(i, t4); const jj = [...t4]; WA.getElement(i, t4); const ww = [...t4]; const s = ww.reduce((a, b) => a + b, 0) || 1;
  JW.push(jj.map((j, k) => [j, ww[k] / s]).filter(([, w]) => w > 0));
}
let y0 = Infinity, y1 = -Infinity; for (const p of P) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } const H = y1 - y0;
const main = JW.map((l) => l.reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
const isArm = (j) => /^(clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/.test(names[j]);
const legSide = (j) => (/_l$/.test(names[j]) && /^(thigh|calf|foot|ball)/.test(names[j]) ? 'l' : /_r$/.test(names[j]) && /^(thigh|calf|foot|ball)/.test(names[j]) ? 'r' : null);
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- 1. the shape fields first, in the old rest: the waist round the spine, the hakama round each leg's axis
const spineZ = pos('spine_01').z;
const legAxis = (s) => [pos(`thigh_${s}`), pos(`foot_${s}`)];
for (let i = 0; i < n; i++) {
  const p = P[i], h = (p.y - y0) / H, armW = JW[i].reduce((a, [j, w]) => a + (isArm(j) ? w : 0), 0);
  if (armW > 0.5) continue; // (the arms and hands: never pinched with the waist)
  let sx = 1;
  // the waist: a band round its narrowest (~0.64 of his height), easing out toward the chest and the hips
  if (O.waist && Math.abs(p.x) < 0.25) { const k = sm(0.52, 0.61, h) * (1 - sm(0.67, 0.75, h)); sx = 1 - O.waist * k; }
  if (sx !== 1) { p.x *= sx; p.z = spineZ + (p.z - spineZ) * sx; N[i].set(N[i].x / sx, N[i].y, N[i].z / sx).normalize(); }
  // the hakama: each leg's own vertices, round its axis (hip → ankle), above the boots and below the hips
  if (O.hakama) {
    const legW = { l: 0, r: 0 }; for (const [j, w] of JW[i]) { const s = legSide(j); if (s && !/^foot|^ball/.test(names[j])) legW[s] += w; }
    for (const s of ['l', 'r']) {
      if (legW[s] < 0.01) continue;
      const [a, b] = legAxis(s), u = (p.y - a.y) / (b.y - a.y), ax = a.clone().lerp(b, Math.max(0, Math.min(1, u)));
      const k = legW[s] * sm(0.17, 0.23, h) * (1 - sm(0.46, 0.53, h)), sc = 1 - O.hakama * k;
      if (sc === 1) continue;
      p.x = ax.x + (p.x - ax.x) * sc; p.z = ax.z + (p.z - ax.z) * sc; N[i].set(N[i].x / sc, N[i].y, N[i].z / sc).normalize();
    }
  }
}

// ---- 2. each bone's move from the old rest to the new (a matrix per bone, in the world)
const L = O.legs, D = new Map(), M4 = () => new THREE.Matrix4();
const hipY = (pos('thigh_l').y + pos('thigh_r').y) / 2, ankY = (pos('foot_l').y + pos('foot_r').y) / 2;
const dY = (hipY - ankY) * L; // (the hips rise by what the legs grew: the soles stay on the floor)
const up = M4().makeTranslation(0, dY, 0);
const shoulderX = O.shoulders * (0.29 * H) / 2; // (the pauldrons' span, each side half of it)
const about = (c, s) => M4().makeTranslation(c.x, c.y, c.z).multiply(M4().makeScale(s, s, s)).multiply(M4().makeTranslation(-c.x, -c.y, -c.z));
const stretch = (from, to, k) => { const u = to.clone().sub(from).normalize(); const A = new THREE.Matrix3().set(1 + k * u.x * u.x, k * u.x * u.y, k * u.x * u.z, k * u.y * u.x, 1 + k * u.y * u.y, k * u.y * u.z, k * u.z * u.x, k * u.z * u.y, 1 + k * u.z * u.z); return M4().setFromMatrix3(A); };
const legEnds = {};
for (const s of ['l', 'r']) {
  const hip = pos(`thigh_${s}`), knee = pos(`calf_${s}`), ank = pos(`foot_${s}`);
  const hip2 = hip.clone().add(new THREE.Vector3(0, dY, 0)), knee2 = hip2.clone().add(knee.clone().sub(hip).multiplyScalar(1 + L)), ank2 = knee2.clone().add(ank.clone().sub(knee).multiplyScalar(1 + L));
  D.set(`thigh_${s}`, M4().makeTranslation(hip2.x, hip2.y, hip2.z).multiply(stretch(hip, knee, L)).multiply(M4().makeTranslation(-hip.x, -hip.y, -hip.z)));
  D.set(`calf_${s}`, M4().makeTranslation(knee2.x, knee2.y, knee2.z).multiply(stretch(knee, ank, L)).multiply(M4().makeTranslation(-knee.x, -knee.y, -knee.z)));
  const foot = M4().makeTranslation(ank2.x - ank.x, ank2.y - ank.y, ank2.z - ank.z);
  for (const b of [`foot_${s}`, `ball_${s}`, `ball_leaf_${s}`]) D.set(b, foot);
  legEnds[s] = { hip2, knee2, ank2 };
}
const head = pos('Head'), sH = O.head, sP = 1 - O.pony * (1 - sH), tie = pos('hair_01');
const tie2 = tie.clone().sub(head).multiplyScalar(sH).add(head); // (the tie where the smaller head puts it)
for (const nm of names) {
  if (D.has(nm) || nm === 'root') continue;
  const side = /_l$/.test(nm) ? 1 : /_r$/.test(nm) ? -1 : 0;
  if (nm === 'Head') D.set(nm, up.clone().multiply(about(head, sH)));
  else if (/^hair_/.test(nm)) D.set(nm, up.clone().multiply(M4().makeTranslation(tie2.x - tie.x, tie2.y - tie.y, tie2.z - tie.z)).multiply(about(tie, sP)));
  else if (/^clavicle/.test(nm)) D.set(nm, up.clone().multiply(M4().makeTranslation(side * shoulderX * 0.5, 0, 0)));
  else if (/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/.test(nm)) D.set(nm, up.clone().multiply(M4().makeTranslation(side * shoulderX, 0, 0)));
  else D.set(nm, up); // (the pelvis, the spine, the neck, the skirt's panels, the sash's tails, the hip plates)
}
D.set('root', M4());

// ---- 3. the vertices carried (linear blend of their bones' moves), the normals with them
const Dj = joints.map((j, i) => D.get(names[i]));
const Nj = Dj.map((m) => new THREE.Matrix3().getNormalMatrix(m));
const P2 = new Float32Array(n * 3), N2 = new Float32Array(n * 3), v = new THREE.Vector3(), nn = new THREE.Vector3();
for (let i = 0; i < n; i++) {
  const acc = new THREE.Vector3(), an = new THREE.Vector3();
  for (const [j, w] of JW[i]) { acc.addScaledVector(v.copy(P[i]).applyMatrix4(Dj[j]), w); an.addScaledVector(nn.copy(N[i]).applyMatrix3(Nj[j]), w); }
  an.normalize(); P2.set([acc.x, acc.y, acc.z], i * 3); N2.set([an.x, an.y, an.z], i * 3);
}

// ---- 4. the bones' new rest: each joint where its own move puts it, turned as before; the inverse binds again
const W2 = new Map();
const newWorld = (j) => { const m = W.get(j).clone(); const p = new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(D.get(j.getName())); m.setPosition(p); return m; };
for (const j of joints) W2.set(j, newWorld(j));
const worldOf = (nd) => W2.get(nd) ?? W.get(nd);
for (const j of joints) {
  const par = parentOf.get(j); const loc = (par ? worldOf(par).clone().invert() : M4()).multiply(W2.get(j));
  const tt = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); loc.decompose(tt, q, s);
  j.setTranslation(tt.toArray()).setRotation(q.toArray()).setScale(s.toArray());
}
const ibm2 = new Float32Array(joints.length * 16); joints.forEach((j, i) => ibm2.set(W2.get(j).clone().invert().toArray(), i * 16));
skin.getInverseBindMatrices().setArray(ibm2);
PA.setArray(P2).setNormalized(false); NA.setArray(N2).setNormalized(false); // (the world's own positions now: the binds above are exact for them)
node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);

// ---- 5. the check: at rest every vertex skinned by its bones lands where it was written; the new landmarks
let err = 0; for (let i = 0; i < n; i += 37) { const acc = new THREE.Vector3(); for (const [j, w] of JW[i]) acc.addScaledVector(v.set(P2[i * 3], P2[i * 3 + 1], P2[i * 3 + 2]).applyMatrix4(ibm2Mat(i, j)), w); err = Math.max(err, acc.distanceTo(v.set(P2[i * 3], P2[i * 3 + 1], P2[i * 3 + 2]))); }
function ibm2Mat(_, j) { return W2.get(joints[j]).clone().multiply(new THREE.Matrix4().fromArray(ibm2.slice(j * 16, j * 16 + 16))); }
let ny0 = Infinity, ny1 = -Infinity; for (let i = 0; i < n; i++) { ny0 = Math.min(ny0, P2[i * 3 + 1]); ny1 = Math.max(ny1, P2[i * 3 + 1]); }
const H2 = ny1 - ny0, f = (m) => +((new THREE.Vector3().setFromMatrixPosition(m).y - ny0) / H2).toFixed(4);
console.log(JSON.stringify({ opts: O, restErr: +err.toExponential(2), height: { was: +H.toFixed(4), now: +H2.toFixed(4) }, soles: +ny0.toFixed(4), dY: +dY.toFixed(4), shoulderX: +shoulderX.toFixed(4), ponytail: +sP.toFixed(3),
  joints01: { pelvis: f(W2.get(J('pelvis'))), knee: f(W2.get(J('calf_l'))), ankle: f(W2.get(J('foot_l'))), shoulder: f(W2.get(J('upperarm_l'))), neck: f(W2.get(J('neck_01'))), head: f(W2.get(J('Head'))), tie: f(W2.get(J('hair_01'))) } }));
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression' || e.extensionName === 'KHR_mesh_quantization') e.dispose(); // (written plain: pack it afterwards)
await io.write(outF, doc);
