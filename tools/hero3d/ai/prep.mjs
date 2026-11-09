// The AI shape → a clean game mesh: the largest piece only, standing on y = 0 at the origin, HEIGHT tall,
// simplified to TRIS triangles and unwrapped (xatlas) for the bake.
import { NodeIO, Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Api } from 'xatlasjs/dist/node/api.mjs';
import createXAtlasModule from 'xatlasjs/dist/node/xatlas.js';
const [src, out, TRIS = '40000', HEIGHT = '1.8'] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
let P = prim.getAttribute('POSITION').getArray(), I = prim.getIndices().getArray();
let n = P.length / 3;
// weld exact duplicates
{
  const key = new Map(), remap = new Uint32Array(n); const np = [];
  for (let i = 0; i < n; i++) { const k = `${P[3*i]},${P[3*i+1]},${P[3*i+2]}`; let j = key.get(k); if (j === undefined) { j = np.length / 3; key.set(k, j); np.push(P[3*i], P[3*i+1], P[3*i+2]); } remap[i] = j; }
  P = new Float32Array(np); I = I.map((v) => remap[v]); n = P.length / 3;
}
// the base plate the shape AI adds under the feet (a thin wide sheet a little above the soles): its faces outside the
// boots' own footprint (taken from the boots just below and above it) are removed; the rest is inside the boots
if (process.env.PLATE) {
  const [pa, pb] = process.env.PLATE.split(',').map(Number);
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n; i++) { y0 = Math.min(y0, P[3*i+1]); y1 = Math.max(y1, P[3*i+1]); }
  const Hh = y1 - y0, lo = y0 + Hh * pa, hi = y0 + Hh * pb, C = 0.012, occ = new Set();
  const cell = (x, z) => `${Math.floor(x / C)},${Math.floor(z / C)}`;
  for (let i = 0; i < n; i++) { const y = P[3*i+1]; if ((y < lo && y >= y0) || (y > hi && y < hi + Hh * 0.025)) { const cx = Math.floor(P[3*i] / C), cz = Math.floor(P[3*i+2] / C); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) occ.add(`${cx + dx},${cz + dz}`); } }
  const bad = (v) => { const y = P[3*v+1]; return y >= lo && y <= hi && !occ.has(cell(P[3*v], P[3*v+2])); };
  // (and inside the footprint too: the plate's own flat faces — level, all three corners in its band — the boots'
  // walls there stand upright and stay)
  const inBand = (v) => P[3*v+1] >= lo - Hh * 0.002 && P[3*v+1] <= hi + Hh * 0.002;
  const flat = (a, b, c) => { const ux = P[3*b] - P[3*a], uy = P[3*b+1] - P[3*a+1], uz = P[3*b+2] - P[3*a+2], vx = P[3*c] - P[3*a], vy = P[3*c+1] - P[3*a+1], vz = P[3*c+2] - P[3*a+2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; return Math.abs(ny) > 0.75 * Math.hypot(nx, ny, nz); };
  const keep = []; let cut = 0, cutFlat = 0;
  for (let t = 0; t < I.length; t += 3) {
    if (bad(I[t]) || bad(I[t+1]) || bad(I[t+2])) { cut++; continue; }
    if (inBand(I[t]) && inBand(I[t+1]) && inBand(I[t+2]) && flat(I[t], I[t+1], I[t+2])) { cutFlat++; continue; }
    keep.push(I[t], I[t+1], I[t+2]);
  }
  console.log('plate: level faces cut inside the footprint', cutFlat);
  I = new Uint32Array(keep); console.log('plate: faces cut', cut, 'footprint cells', occ.size);
}
// largest connected component
{
  const par = new Int32Array(n).map((_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = f(I[t]); par[f(I[t+1])] = a; par[f(I[t+2])] = a; }
  const cnt = new Map(); for (let i = 0; i < n; i++) { const r = f(i); cnt.set(r, (cnt.get(r) || 0) + 1); }
  const big = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const keep = []; for (let t = 0; t < I.length; t += 3) if (f(I[t]) === big) keep.push(I[t], I[t+1], I[t+2]);
  I = new Uint32Array(keep);
}
// normalize: feet on y = 0, HEIGHT tall, x centred, z centred on the hips
{
  let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; const used = new Uint8Array(n); for (const v of I) used[v] = 1;
  for (let i = 0; i < n; i++) if (used[i]) { y0 = Math.min(y0, P[3*i+1]); y1 = Math.max(y1, P[3*i+1]); x0 = Math.min(x0, P[3*i]); x1 = Math.max(x1, P[3*i]); }
  const s = +HEIGHT / (y1 - y0); let zs = 0, zn = 0;
  for (let i = 0; i < n; i++) if (used[i]) { const h = (P[3*i+1] - y0) / (y1 - y0); if (h > 0.45 && h < 0.55) { zs += P[3*i+2]; zn++; } }
  const cx = (x0 + x1) / 2, cz = zs / zn;
  for (let i = 0; i < n; i++) { P[3*i] = (P[3*i] - cx) * s; P[3*i+1] = (P[3*i+1] - y0) * s; P[3*i+2] = (P[3*i+2] - cz) * s; }
  console.log('scale', s.toFixed(4), 'x', ((x1 - x0) * s).toFixed(3));
}
// simplify
await MeshoptSimplifier.ready;
const [si, err] = MeshoptSimplifier.simplify(I, P, 3, Math.floor(+TRIS * 3), 0.01, []);
console.log('simplified', I.length / 3, '→', si.length / 3, 'tris, error', err.toFixed(5));
// compact
const map = new Int32Array(n).fill(-1); const cp = []; const ci = new Uint32Array(si.length);
for (let k = 0; k < si.length; k++) { const v = si[k]; if (map[v] < 0) { map[v] = cp.length / 3; cp.push(P[3*v], P[3*v+1], P[3*v+2]); } ci[k] = map[v]; }
const CP = new Float32Array(cp); console.log('verts', CP.length / 3);
// unwrap
const XA = Api(createXAtlasModule);
const xa = await new Promise((res) => { const a = new XA(() => res(a), (p, d) => (p === 'xatlas.wasm' ? new URL('./node_modules/xatlasjs/dist/node/xatlas.wasm', import.meta.url).pathname : d + p), () => {}); });
xa.createAtlas();
xa.addMesh(new Uint16Array(ci), CP, null, null, 'm', false, false, 1);
const atlas = xa.generateAtlas({ maxIterations: 2, maxCost: 2 }, { resolution: 2048, padding: 4, bilinear: true, rotateCharts: true }, true);
const m = atlas.meshes[0];
console.log('atlas', atlas.width, atlas.height, atlas.atlasCount, 'verts', m.vertex.vertices.length / 3, 'idx', m.index.length / 3);
const UV = m.vertex.coords1; // pixel coords? normalise to 0..1
let umax = 0, vmax = 0; for (let i = 0; i < UV.length; i += 2) { umax = Math.max(umax, UV[i]); vmax = Math.max(vmax, UV[i+1]); }
console.log('uv range', umax.toFixed(3), vmax.toFixed(3));
if (umax > 1.5) for (let i = 0; i < UV.length; i += 2) { UV[i] /= atlas.width; UV[i+1] /= atlas.height; }
// write
const od = new Document(); const buf = od.createBuffer();
const pr = od.createPrimitive()
  .setAttribute('POSITION', od.createAccessor().setType('VEC3').setArray(new Float32Array(m.vertex.vertices)).setBuffer(buf))
  .setAttribute('TEXCOORD_0', od.createAccessor().setType('VEC2').setArray(new Float32Array(UV)).setBuffer(buf))
  .setIndices(od.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.index)).setBuffer(buf));
const mesh = od.createMesh('Beginner').addPrimitive(pr);
od.createScene().addChild(od.createNode('Beginner').setMesh(mesh));
await io.write(out, od);
console.log('wrote', out);
xa.destroyAtlas?.();
