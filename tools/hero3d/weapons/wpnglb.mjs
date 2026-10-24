// inflate.py's arrays → a GLB weapon (welded, simplified, its drawing as the colour map)
import { NodeIO, Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
const [pre, out, tris = '3000', name = 'Weapon', discArg = '', lineArg = ''] = process.argv.slice(2);
// an optional thin line (a bowstring): x1,y1,x2,y2 (m, the weapon's frame), radius, colour
const line = lineArg ? lineArg.split(',').map(Number) : null;
// an optional disc across the weapon (a katana's guard, seen edge-on in the drawing): y (m from the grip), radius, thickness, colour
const disc = discArg ? discArg.split(',').map(Number) : null;
const J = JSON.parse(fs.readFileSync(pre + '.json', 'utf8')); const B = fs.readFileSync(pre + '.bin');
const P = new Float32Array(B.buffer, B.byteOffset, J.nv * 3).slice(); const UV = new Float32Array(B.buffer, B.byteOffset + J.nv * 12, J.nv * 2).slice();
let F = new Uint32Array(B.buffer.slice(B.byteOffset + J.nv * 20, B.byteOffset + J.nv * 20 + J.nf * 12));
// weld the rim (front and back meet where z = 0)
const key = new Map(), remap = new Uint32Array(J.nv);
for (let i = 0; i < J.nv; i++) { const k = `${Math.round(P[3*i]*1e5)},${Math.round(P[3*i+1]*1e5)},${Math.round(P[3*i+2]*1e5)}`; const j = key.get(k); remap[i] = j === undefined ? (key.set(k, i), i) : j; }
F = F.map((v) => remap[v]);
await MeshoptSimplifier.ready;
const [si] = MeshoptSimplifier.simplify(F, P, 3, Math.floor(+tris * 3), 0.002, []);
const map = new Int32Array(J.nv).fill(-1), np = [], nu = [], ni = new Uint32Array(si.length);
for (let k = 0; k < si.length; k++) { const v = si[k]; if (map[v] < 0) { map[v] = np.length / 3; np.push(P[3*v], P[3*v+1], P[3*v+2]); nu.push(UV[2*v], UV[2*v+1]); } ni[k] = map[v]; }
const d = new Document(); const buf = d.createBuffer();
const tex = d.createTexture(name + 'Color').setImage(fs.readFileSync(pre + '_tex.png')).setMimeType('image/png');
const mat = d.createMaterial(name).setBaseColorTexture(tex).setRoughnessFactor(0.6).setMetallicFactor(0).setDoubleSided(true);
const prim = d.createPrimitive().setMaterial(mat)
  .setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(np)).setBuffer(buf))
  .setAttribute('TEXCOORD_0', d.createAccessor().setType('VEC2').setArray(new Float32Array(nu)).setBuffer(buf))
  .setIndices(d.createAccessor().setType('SCALAR').setArray(ni).setBuffer(buf));
const mesh = d.createMesh(name).addPrimitive(prim);
if (disc) {
  const [dy, r, t, col] = disc, seg = 28, pos = [], idx = [];
  for (const s of [-1, 1]) { pos.push(0, dy + s * t / 2, 0); for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; pos.push(Math.cos(a) * r, dy + s * t / 2, Math.sin(a) * r); } }
  const c0 = 0, c1 = seg + 1;
  for (let i = 0; i < seg; i++) { const a = 1 + i, b = 1 + (i + 1) % seg; idx.push(c0, a, b); idx.push(c1, c1 + b, c1 + a); idx.push(a, c1 + a, c1 + b, a, c1 + b, b); }
  const dm = d.createMaterial(name + 'Disc').setBaseColorFactor([((col >> 16) & 255) / 255, ((col >> 8) & 255) / 255, (col & 255) / 255, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.45).setDoubleSided(true);
  mesh.addPrimitive(d.createPrimitive().setMaterial(dm).setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)).setIndices(d.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf)));
}
if (line) {
  const [x1, y1, x2, y2, r, col] = line, seg = 6, pos = [], idx = [];
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  for (const [px, py] of [[x1, y1], [x2, y2]]) for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(px + nx * c, py + ny * c, z); }
  for (let i = 0; i < seg; i++) { const a = i, b = (i + 1) % seg; idx.push(a, b, seg + a, b, seg + b, seg + a); }
  const lm = d.createMaterial(name + 'String').setBaseColorFactor([((col >> 16) & 255) / 255, ((col >> 8) & 255) / 255, (col & 255) / 255, 1]).setMetallicFactor(0).setRoughnessFactor(0.7).setDoubleSided(true);
  mesh.addPrimitive(d.createPrimitive().setMaterial(lm).setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)).setIndices(d.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf)));
}
d.createScene().addChild(d.createNode(name).setMesh(mesh));
await new NodeIO().write(out, d);
console.log(out, 'tris', si.length / 3, 'verts', np.length / 3);
