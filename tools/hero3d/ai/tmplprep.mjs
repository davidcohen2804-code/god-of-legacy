// The Beginner (packed: meshopt + quantized, its bind in the inverse bind matrices) → a plain template for rigfit:
// float positions in the world's metres, each joint's inverse bind = its world inverse.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
const [src, out] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src); const root = doc.getRoot();
const node = root.listNodes().find((n) => n.getMesh() && n.getSkin()); const skin = node.getSkin(); const joints = skin.listJoints();
const ibm = skin.getInverseBindMatrices().getArray();
const W = joints.map((j) => new THREE.Matrix4().fromArray(j.getWorldMatrix()));
const B = W[0].clone().multiply(new THREE.Matrix4().fromArray(ibm.slice(0, 16)));
const B2 = W[10].clone().multiply(new THREE.Matrix4().fromArray(ibm.slice(160, 176)));
console.log('bind B', B.elements.map((x) => +x.toFixed(4)).join(','), '\ncheck', B2.elements.map((x) => +x.toFixed(4)).join(','));
const Nm = new THREE.Matrix3().getNormalMatrix(B);
const buf = root.listBuffers()[0];
for (const p of node.getMesh().listPrimitives()) {
  const P = p.getAttribute('POSITION'), n = P.getCount(), a = [0, 0, 0], v = new THREE.Vector3(), out3 = new Float32Array(n * 3);
  let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { P.getElement(i, a); v.set(a[0], a[1], a[2]).applyMatrix4(B); out3.set([v.x, v.y, v.z], i * 3); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  console.log('raw sample', JSON.stringify(a), 'world y', y0.toFixed(3), y1.toFixed(3));
  p.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(out3).setBuffer(buf));
  const N = p.getAttribute('NORMAL'); if (N) { const o = new Float32Array(N.getCount() * 3); for (let i = 0; i < N.getCount(); i++) { N.getElement(i, a); v.set(a[0], a[1], a[2]).applyMatrix3(Nm).normalize(); o.set([v.x, v.y, v.z], i * 3); } p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(o).setBuffer(buf)); }
  for (const s of p.listSemantics()) if (!['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0'].includes(s)) p.setAttribute(s, null);
  p.setMaterial(null);
}
const arr = new Float32Array(joints.length * 16); W.forEach((w, i) => arr.set(w.clone().invert().elements, i * 16));
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(arr).setBuffer(buf));
for (const t of root.listTextures()) t.dispose(); for (const m of root.listMaterials()) m.dispose();
for (const e of root.listExtensionsUsed()) e.dispose();
await new NodeIO().write(out, doc); console.log('wrote', out);
