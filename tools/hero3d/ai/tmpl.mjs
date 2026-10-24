// The Quaternius base body (template): joint rest positions, bind data, body vertices with weights.
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
export async function loadTemplate(file) {
  const io = new NodeIO(); const doc = await io.read(file); const root = doc.getRoot();
  const skin = root.listSkins()[0]; const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices().getArray();
  const names = joints.map((j) => j.getName());
  const local = joints.map((j) => ({ t: j.getTranslation(), r: j.getRotation(), s: j.getScale() }));
  const parent = joints.map((j) => { const p = j.getParentNode(); return p ? names.indexOf(p.getName()) : -1; });
  // world rest matrices from the hierarchy (including any non-joint ancestors)
  const world = joints.map((j) => new THREE.Matrix4().fromArray(j.getWorldMatrix()));
  const bodyNode = root.listNodes().filter((n) => n.getMesh() && n.getSkin()).sort((a, b) => b.getMesh().listPrimitives().reduce((s, p) => s + p.getAttribute('POSITION').getCount(), 0) - a.getMesh().listPrimitives().reduce((s, p) => s + p.getAttribute('POSITION').getCount(), 0))[0]; // the body: the biggest skinned mesh
  const prims = bodyNode.getMesh().listPrimitives();
  const verts = []; const jw = [];
  for (const p of prims) {
    const P = p.getAttribute('POSITION'), J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), I = p.getIndices();
    const base = verts.length;
    const a = [0, 0, 0], j = [0, 0, 0, 0], w = [0, 0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, a); J.getElement(i, j); W.getElement(i, w); verts.push([...a]); jw.push({ j: [...j], w: [...w] }); }
    p.__base = base;
  }
  const tris = []; for (const p of prims) { const I = p.getIndices(); for (let t = 0; t < I.getCount(); t++) tris.push(p.__base + I.getScalar(t)); }
  const meshWorld = new THREE.Matrix4().fromArray(bodyNode.getWorldMatrix());
  return { doc, names, local, parent, world, ibm, verts, jw, tris, meshWorld, bodyName: bodyNode.getMesh().getName() };
}
if (process.argv[2] === 'print') {
  const T = await loadTemplate(process.argv[3]);
  const v = new THREE.Vector3(); let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of T.verts) { v.set(...p).applyMatrix4(T.meshWorld); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  console.log('body', T.bodyName, 'verts', T.verts.length, 'bbox x', x0.toFixed(3), x1.toFixed(3), 'y', y0.toFixed(3), y1.toFixed(3), 'z', z0.toFixed(3), z1.toFixed(3));
  console.log('meshWorld', T.meshWorld.elements.map((x) => +x.toFixed(3)).join(','));
  const want = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'middle_01_l', 'middle_04_leaf_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l', 'upperarm_r', 'hand_r'];
  for (const n of want) { const i = T.names.indexOf(n); const p = new THREE.Vector3().setFromMatrixPosition(T.world[i]); const q = new THREE.Quaternion(); T.world[i].decompose(new THREE.Vector3(), q, new THREE.Vector3()); console.log(n.padEnd(18), p.toArray().map((x) => x.toFixed(3)).join(' '), ' parent', T.names[T.parent[i]] ?? '-', ' localT', T.local[i].t.map((x) => x.toFixed(3)).join(' ')); }
  // check: world × ibm ≈ identity?
  const i = T.names.indexOf('hand_l'); const m = new THREE.Matrix4().fromArray(T.ibm.slice(i * 16, i * 16 + 16)); const c = T.world[i].clone().multiply(m); console.log('world*ibm(hand_l) diag', [c.elements[0], c.elements[5], c.elements[10], c.elements[12], c.elements[13], c.elements[14]].map((x) => x.toFixed(3)).join(' '));
}
