// Fit the template's 65-bone skeleton into the AI mesh (landmark joints), carry the template's skin weights over
// (template body posed to the fitted skeleton → closest surface point), write the skinned GLB.
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import fs from 'fs';
import { loadTemplate } from './tmpl.mjs';
const [tmplFile, aiFile, lmFile, outFile] = process.argv.slice(2);
const LM = JSON.parse(fs.readFileSync(lmFile, 'utf8'));
const T = await loadTemplate(tmplFile);
const N = T.names.length, idx = (n) => T.names.indexOf(n);
const tPos = T.world.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
const tRot = T.world.map((m) => { const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; });
// targets: the landmark joints (left side given; right mirrored)
const target = new Map();
for (const [k, v] of Object.entries(LM.joints)) { target.set(k, new THREE.Vector3(...v)); if (k.endsWith('_l')) target.set(k.slice(0, -2) + '_r', new THREE.Vector3(-v[0], v[1], v[2])); }
// each bone's aim child
const AIM = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head' };
for (const s of ['l', 'r']) Object.assign(AIM, { [`clavicle_${s}`]: `upperarm_${s}`, [`upperarm_${s}`]: `lowerarm_${s}`, [`lowerarm_${s}`]: `hand_${s}`, [`thigh_${s}`]: `calf_${s}`, [`calf_${s}`]: `foot_${s}`, [`foot_${s}`]: `ball_${s}`, [`ball_${s}`]: `ball_leaf_${s}` });
const order = []; { const seen = new Set(); const visit = (i) => { if (seen.has(i)) return; if (T.parent[i] >= 0) visit(T.parent[i]); seen.add(i); order.push(i); }; for (let i = 0; i < N; i++) visit(i); }
const nPos = new Array(N), delta = new Array(N);
for (const i of order) {
  const n = T.names[i], p = T.parent[i];
  if (target.has(n)) nPos[i] = target.get(n).clone();
  else if (p < 0) nPos[i] = tPos[i].clone();
  else { const s = LM.scale?.[n] ?? 1; nPos[i] = tPos[i].clone().sub(tPos[p]).applyQuaternion(delta[p]).multiplyScalar(s).add(nPos[p]); }
  // this bone's rotation change: aim at its child's target if it has one, else follow the parent
  const c = AIM[n];
  if (c && target.has(c)) {
    const a = tPos[idx(c)].clone().sub(tPos[i]).normalize(), b = target.get(c).clone().sub(nPos[i]).normalize();
    delta[i] = new THREE.Quaternion().setFromUnitVectors(a, b);
  } else delta[i] = p >= 0 ? delta[p].clone() : new THREE.Quaternion();
}
const nRot = tRot.map((q, i) => delta[i].clone().multiply(q));
const nWorld = nPos.map((p, i) => new THREE.Matrix4().compose(p, nRot[i], new THREE.Vector3(1, 1, 1)));
// the template body posed onto the fitted skeleton (linear blend skinning)
const IBM = Array.from({ length: N }, (_, i) => new THREE.Matrix4().fromArray(T.ibm.slice(i * 16, i * 16 + 16)));
const skinM = nWorld.map((w, i) => w.clone().multiply(IBM[i]));
const tv = T.verts.map((p, k) => { const v = new THREE.Vector3(...p).applyMatrix4(T.meshWorld), o = new THREE.Vector3(); const { j, w } = T.jw[k]; for (let q = 0; q < 4; q++) if (w[q] > 0) o.add(v.clone().applyMatrix4(skinM[j[q]]).multiplyScalar(w[q])); return o; });
// AI mesh
const io = new NodeIO(); const aiDoc = await io.read(aiFile);
const aiPrim = aiDoc.getRoot().listMeshes()[0].listPrimitives()[0];
const AP = aiPrim.getAttribute('POSITION').getArray(); const nv = AP.length / 3;
// merge the fingers into the hand (the AI hands are one piece)
const merge = (n) => { if (/^(index|middle|pinky|ring|thumb)_/.test(n)) return 'hand_' + n.slice(-1); if (/ball_leaf/.test(n)) return 'ball_' + n.slice(-1); return n; };
const mergeIdx = T.names.map((n) => idx(merge(n)));
// body parts on the AI mesh by distance ALONG its surface (not through the air): an arm is reached only through its
// shoulder, so a sash or a coat tail hanging by the hand never takes the arm's weights (and a leg's never the hand's).
const GROUPS = {
  armL: ['clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'], armR: ['clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'],
  legL: ['thigh_l', 'calf_l', 'foot_l', 'ball_l'], legR: ['thigh_r', 'calf_r', 'foot_r', 'ball_r'],
  core: ['pelvis', 'spine_01', 'spine_02', 'spine_03'], head: ['neck_01', 'Head'],
};
const CORE = [...GROUPS.core, ...GROUPS.head];
const ALLOW = { // (only one limb's bones never reach another part: the trunk's and the head's bones are allowed everywhere)
  armL: [...GROUPS.armL, ...CORE], armR: [...GROUPS.armR, ...CORE],
  legL: [...GROUPS.legL, ...CORE], legR: [...GROUPS.legR, ...CORE],
  core: [...CORE, 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'thigh_l', 'thigh_r'],
  head: [...CORE, 'clavicle_l', 'clavicle_r'],
};
const gid = {}; Object.keys(GROUPS).forEach((g, i) => (gid[g] = i));
const allowSet = Object.keys(GROUPS).map((g) => new Set(ALLOW[g].map((n) => idx(n))));
// weld by position for the surface graph
const wkey = new Map(), wof = new Int32Array(nv); let nw = 0; const wp = [];
for (let i = 0; i < nv; i++) { const k = `${Math.round(AP[3*i]*1e4)},${Math.round(AP[3*i+1]*1e4)},${Math.round(AP[3*i+2]*1e4)}`; let w = wkey.get(k); if (w === undefined) { w = nw++; wkey.set(k, w); wp.push(AP[3*i], AP[3*i+1], AP[3*i+2]); } wof[i] = w; }
const AI_I = aiPrim.getIndices().getArray(); const adj = Array.from({ length: nw }, () => new Map());
for (let t = 0; t < AI_I.length; t += 3) for (let e = 0; e < 3; e++) { const a = wof[AI_I[t + e]], b = wof[AI_I[t + (e + 1) % 3]]; if (a === b) continue; const d = Math.hypot(wp[3*a]-wp[3*b], wp[3*a+1]-wp[3*b+1], wp[3*a+2]-wp[3*b+2]); adj[a].set(b, d); adj[b].set(a, d); }
// seeds: surface points nearest to points along each group's bones
const segs = []; for (const [g, bs] of Object.entries(GROUPS)) for (const b of bs) { const i = idx(b), c = AIM[b] ? idx(AIM[b]) : -1; const A = nPos[i], B = c >= 0 ? nPos[c] : nPos[i].clone().add(new THREE.Vector3(0, b === 'Head' ? 0.12 : 0.05, 0)); segs.push({ g: gid[g], A, B }); }
const dist = new Float64Array(nw).fill(Infinity), grp = new Int8Array(nw).fill(-1);
const heap = []; const push = (d, v, g) => { heap.push([d, v, g]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
const q3 = new THREE.Vector3();
for (const sg of segs) for (let k = 1; k <= 3; k++) {
  const P0 = sg.A.clone().lerp(sg.B, k / 4); let best = -1, bd = Infinity;
  for (let w = 0; w < nw; w++) { const d = (wp[3*w]-P0.x)**2 + (wp[3*w+1]-P0.y)**2 + (wp[3*w+2]-P0.z)**2; if (d < bd) { bd = d; best = w; } }
  if (best >= 0) push(0, best, sg.g);
}
while (heap.length) { const [d, v, g] = pop(); if (d >= dist[v]) continue; dist[v] = d; grp[v] = g; for (const [u, l] of adj[v]) if (d + l < dist[u]) push(d + l, u, g); }
const vgroup = new Int8Array(nv); for (let i = 0; i < nv; i++) vgroup[i] = grp[wof[i]] < 0 ? gid.core : grp[wof[i]];
{ const cnt = {}; for (const g of vgroup) cnt[g] = (cnt[g] || 0) + 1; console.log('surface parts', Object.keys(GROUPS).map((g) => `${g} ${cnt[gid[g]] || 0}`).join(', ')); }
// closest template triangle for each AI vertex (grid over triangle boxes)
const tris = T.tris; const nt = tris.length / 3; const G = 0.04; const grid = new Map();
const key = (x, y, z) => `${x},${y},${z}`;
for (let t = 0; t < nt; t++) { const a = tv[tris[3*t]], b = tv[tris[3*t+1]], c = tv[tris[3*t+2]]; const lo = [Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z)].map((v) => Math.floor(v / G)), hi = [Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z)].map((v) => Math.floor(v / G)); for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(t); } }
const tri = new THREE.Triangle(), cp = new THREE.Vector3(), bc = new THREE.Vector3(), pv = new THREE.Vector3();
const J = new Uint16Array(nv * 4), W = new Float32Array(nv * 4); let far = 0, maxd = 0;
for (let i = 0; i < nv; i++) {
  pv.set(AP[3*i], AP[3*i+1], AP[3*i+2]);
  const gx = Math.floor(pv.x / G), gy = Math.floor(pv.y / G), gz = Math.floor(pv.z / G);
  let best = Infinity, bt = -1;
  for (let r = 1; r <= 8 && bt < 0 || r <= 1; r++) {
    for (let x = gx - r; x <= gx + r; x++) for (let y = gy - r; y <= gy + r; y++) for (let z = gz - r; z <= gz + r; z++) { const l = grid.get(key(x, y, z)); if (!l) continue; for (const t of l) { tri.set(tv[tris[3*t]], tv[tris[3*t+1]], tv[tris[3*t+2]]); tri.closestPointToPoint(pv, cp); const d = cp.distanceToSquared(pv); if (d < best) { best = d; bt = t; } } }
    if (bt >= 0 && Math.sqrt(best) < r * G) break;
  }
  maxd = Math.max(maxd, Math.sqrt(best)); if (Math.sqrt(best) > 0.12) far++;
  tri.set(tv[tris[3*bt]], tv[tris[3*bt+1]], tv[tris[3*bt+2]]); tri.closestPointToPoint(pv, cp); tri.getBarycoord(cp, bc);
  const acc = new Map(); const bw = [bc.x, bc.y, bc.z];
  for (let k = 0; k < 3; k++) { const { j, w } = T.jw[tris[3*bt+k]]; for (let q = 0; q < 4; q++) if (w[q] > 0) { const m = mergeIdx[j[q]]; acc.set(m, (acc.get(m) || 0) + w[q] * bw[k]); } }
  const ok = allowSet[vgroup[i]]; for (const k of [...acc.keys()]) if (!ok.has(k)) acc.delete(k);
  if (!acc.size) { // nothing allowed left: the nearest bone of its own part, whole
    let bb = -1, bd = Infinity; for (const sg of segs) { if (sg.g !== vgroup[i]) continue; const l = new THREE.Line3(sg.A, sg.B).closestPointToPoint(pv, true, q3).distanceTo(pv); if (l < bd) { bd = l; bb = sg; } }
    const nm = bb ? Object.values(GROUPS)[bb.g] : GROUPS.core; acc.set(idx(nm[0]), 1);
  }
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const s = top.reduce((a, e) => a + e[1], 0);
  top.forEach(([jj, ww], q) => { J[4*i+q] = jj; W[4*i+q] = Math.min(1, Math.max(0, ww / s)); });
  { let t = 0; for (let q = 0; q < 4; q++) t += W[4*i+q]; const e = 1 - t; W[4*i] = Math.min(1, W[4*i] + e); }
}
console.log('weights: max distance to the template', maxd.toFixed(3), 'far (>12 cm)', far, 'of', nv);
// write: the template's armature with the fitted rest pose + the AI mesh skinned to it
const doc = T.doc; const root = doc.getRoot();
const jointNodes = root.listSkins()[0].listJoints();
for (let i = 0; i < N; i++) {
  const p = T.parent[i]; const parentWorld = p >= 0 ? nWorld[p] : (() => { const pn = jointNodes[i].getParentNode(); return pn ? new THREE.Matrix4().fromArray(pn.getWorldMatrix()) : new THREE.Matrix4(); })();
  const l = parentWorld.clone().invert().multiply(nWorld[i]); const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); l.decompose(t, q, s);
  jointNodes[i].setTranslation(t.toArray()).setRotation(q.toArray()).setScale([1, 1, 1]);
}
// drop the template's meshes, keep its armature
for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.dispose(); }
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMaterials()) m.dispose(); for (const t of root.listTextures()) t.dispose();
const buf = root.listBuffers()[0];
const skin = doc.createSkin('Beginner'); for (const j of jointNodes) skin.addJoint(j);
const ibmArr = new Float32Array(N * 16); nWorld.forEach((w, i) => ibmArr.set(w.clone().invert().elements, i * 16));
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibmArr).setBuffer(buf)).setSkeleton(jointNodes[0]);
// copy the AI primitive across (position, uv, indices) + joints/weights + its texture
const aiTexImg = aiDoc.getRoot().listTextures()[0];
const tex = doc.createTexture('BeginnerColor').setImage(aiTexImg.getImage()).setMimeType(aiTexImg.getMimeType());
const mat = doc.createMaterial('Beginner').setBaseColorTexture(tex).setRoughnessFactor(0.85).setMetallicFactor(0);
const prim = doc.createPrimitive().setMaterial(mat)
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(AP)).setBuffer(buf))
  .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(aiPrim.getAttribute('TEXCOORD_0').getArray())).setBuffer(buf))
  .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(J).setBuffer(buf))
  .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(W).setBuffer(buf))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(aiPrim.getIndices().getArray())).setBuffer(buf));
const mesh = doc.createMesh('Beginner').addPrimitive(prim);
const scene = root.listScenes()[0]; scene.addChild(doc.createNode('Beginner').setMesh(mesh).setSkin(skin));
await new NodeIO().write(outFile, doc);
fs.writeFileSync(outFile.replace(/\.glb$/, '.joints.json'), JSON.stringify(Object.fromEntries(T.names.map((n, i) => [n, nPos[i].toArray().map((x) => +x.toFixed(4))]))));
console.log('wrote', outFile);
