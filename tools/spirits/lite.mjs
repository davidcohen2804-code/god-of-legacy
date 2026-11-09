// LEGACY OF SPIRITS — the Spectral Samurai's lighter body for gameplay (GPT, 9 Nov, step 4P: "a lighter gameplay
// Samurai … keep the full-quality model for character selection and close-up previews"). The same body, skeleton,
// skin weights and texture: only its triangles simplified (meshoptimizer: edge collapses onto the body's own vertices,
// the UV seams kept closed — LockBorder), the unused vertices dropped, the buffers written plain (still quantized).
//   node tools/spirits/lite.mjs public/assets/hero3d/spirit_samurai.glb public/assets/hero3d/spirit_samurai_lite.glb 15000 0.02 5000
// The last number: his floor shadow's own lighter triangles (GPT: "simplify shadow geometry independently") — written
// beside it as <out>.shadow.bin, 16-bit indices into the gameplay body's own vertices (Hero3D.load({ shadow })).
import fs from 'fs';
import { MeshoptDecoder as D, MeshoptSimplifier as S } from 'meshoptimizer';

const [src, out, TRIS = '15000', ERR = '0.02', SHADOW_TRIS = ''] = process.argv.slice(2);
const f = fs.readFileSync(src);
const jl = f.readUInt32LE(12), j = JSON.parse(f.slice(20, 20 + jl).toString());
const bin = f.slice(20 + jl + 8);
await D.ready; await S.ready;

/** A buffer view's bytes, decompressed when it is meshopt-compressed. */
const raw = (i) => {
  const v = j.bufferViews[i], e = v.extensions?.EXT_meshopt_compression;
  if (!e) return { bytes: new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength), stride: v.byteStride };
  const o = new Uint8Array(e.count * e.byteStride);
  D.decodeGltfBuffer(o, e.count, e.byteStride, new Uint8Array(bin.buffer, bin.byteOffset + (e.byteOffset || 0), e.byteLength), e.mode, e.filter);
  return { bytes: o, stride: v.byteStride ?? e.byteStride };
};

const prim = j.meshes[0].primitives[0];
if (j.meshes.length !== 1 || j.meshes[0].primitives.length !== 1) throw new Error('one mesh, one primitive expected');
const ia = j.accessors[prim.indices], ib = raw(ia.bufferView).bytes;
const I = ia.componentType === 5125 ? new Uint32Array(ib.buffer, ib.byteOffset, ia.count) : Uint32Array.from(new Uint16Array(ib.buffer, ib.byteOffset, ia.count));
const pa = j.accessors[prim.attributes.POSITION], pv = raw(pa.bufferView);
if (pa.componentType !== 5122 || pv.stride !== 8) throw new Error('quantized int16 positions (stride 8) expected');
const Q = new Int16Array(pv.bytes.buffer, pv.bytes.byteOffset, pa.count * 4), n = pa.count;
const P = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) P[i * 3 + k] = Q[i * 4 + k] / 32767;

const [si, err] = S.simplify(I, P, 3, Math.floor(+TRIS) * 3, +ERR, ['LockBorder']);
// the vertices still used, in their first use's order
const remap = new Int32Array(n).fill(-1); let m = 0;
const NI = new Uint16Array(si.length); for (let i = 0; i < si.length; i++) { const v = si[i]; if (remap[v] < 0) remap[v] = m++; NI[i] = remap[v]; }
if (m > 65535) throw new Error('too many vertices for 16-bit indices');
console.log(`${I.length / 3} → ${si.length / 3} triangles, ${n} → ${m} vertices, error ${(err * S.getScale(P, 3)).toFixed(4)} (of the body's ±1 box)`);

// the new binary: the image and the inverse bind matrices as they are, each vertex stream compacted, the new indices
const chunks = []; let off = 0;
const push = (bytes) => { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; } const at = off; chunks.push(bytes); off += bytes.length; return at; };
const views = [], viewOf = new Map();
const used = new Set([prim.indices, ...Object.values(prim.attributes)].map((a) => j.accessors[a].bufferView));
j.bufferViews.forEach((v, i) => {
  if (used.has(i)) return; // (the mesh's own views are written below, compacted)
  const r = raw(i), at = push(r.bytes);
  viewOf.set(i, views.length); views.push({ buffer: 0, byteOffset: at, byteLength: r.bytes.length, ...(r.stride && v.target === 34962 ? { byteStride: r.stride } : {}), ...(v.target ? { target: v.target } : {}) });
});
const acc = j.accessors.map((a) => ({ ...a }));
for (const [name, ai] of Object.entries(prim.attributes)) {
  const a = j.accessors[ai], r = raw(a.bufferView), st = r.stride, o = new Uint8Array(m * st);
  for (let v = 0; v < n; v++) if (remap[v] >= 0) o.set(r.bytes.subarray(v * st, v * st + st), remap[v] * st);
  const at = push(o), vi = views.length; views.push({ buffer: 0, byteOffset: at, byteLength: o.length, byteStride: st, target: 34962 });
  const na = acc[ai]; na.bufferView = vi; na.byteOffset = 0; na.count = m;
  if (name === 'POSITION') { const q = new Int16Array(o.buffer, o.byteOffset, m * 4), mn = [32767, 32767, 32767], mx = [-32768, -32768, -32768];
    for (let v = 0; v < m; v++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[v * 4 + k]); mx[k] = Math.max(mx[k], q[v * 4 + k]); }
    na.min = mn.map((x) => Math.max(-1, x / 32767)); na.max = mx.map((x) => Math.min(1, x / 32767)); }
}
{ const at = push(new Uint8Array(NI.buffer)), vi = views.length; views.push({ buffer: 0, byteOffset: at, byteLength: NI.byteLength, target: 34963 });
  const na = acc[prim.indices]; na.bufferView = vi; na.byteOffset = 0; na.count = NI.length; na.componentType = 5123; delete na.min; delete na.max; }
for (const [ai, a] of acc.entries()) if (!Object.values(prim.attributes).includes(ai) && ai !== prim.indices && viewOf.has(a.bufferView)) a.bufferView = viewOf.get(a.bufferView);
for (const im of j.images ?? []) if (im.bufferView !== undefined) im.bufferView = viewOf.get(im.bufferView);

const J = { ...j, bufferViews: views, accessors: acc, buffers: [{ byteLength: off }] };
J.extensionsUsed = (j.extensionsUsed ?? []).filter((e) => e !== 'EXT_meshopt_compression');
J.extensionsRequired = (j.extensionsRequired ?? []).filter((e) => e !== 'EXT_meshopt_compression');
if (!J.extensionsRequired.length) delete J.extensionsRequired;
J.asset = { ...j.asset, extras: { ...(j.asset?.extras ?? {}), lite: `simplified to ${si.length / 3} triangles from ${I.length / 3} (tools/spirits/lite.mjs)` } };

const json = Buffer.from(JSON.stringify(J)), jpad = (4 - (json.length % 4)) % 4, binAll = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))), bpad = (4 - (binAll.length % 4)) % 4;
const total = 12 + 8 + json.length + jpad + 8 + binAll.length + bpad, o = Buffer.alloc(total);
o.writeUInt32LE(0x46546c67, 0); o.writeUInt32LE(2, 4); o.writeUInt32LE(total, 8);
o.writeUInt32LE(json.length + jpad, 12); o.writeUInt32LE(0x4e4f534a, 16); json.copy(o, 20); o.fill(0x20, 20 + json.length, 20 + json.length + jpad);
const b0 = 20 + json.length + jpad; o.writeUInt32LE(binAll.length + bpad, b0); o.writeUInt32LE(0x004e4942, b0 + 4); binAll.copy(o, b0 + 8);
fs.writeFileSync(out, o);
console.log('wrote', out, (total / 1024).toFixed(0), 'KB');

if (SHADOW_TRIS) { // his shadow: a flat dark silhouette on the floor — no seams, no shading, so the body's vertices are
  // clustered on a grid (each cell's first vertex stands for the cell, its skin weights with it), the cell grown until
  // the triangles left are at most SHADOW_TRIS; indices into the gameplay body's own vertices
  const CP = new Float32Array(m * 3); for (let v = 0; v < n; v++) if (remap[v] >= 0) for (let k = 0; k < 3; k++) CP[remap[v] * 3 + k] = P[v * 3 + k];
  const cluster = (cell) => {
    const rep = new Map(), map = new Uint32Array(m), out = [], seen = new Set();
    for (let v = 0; v < m; v++) { const key = `${Math.floor(CP[v * 3] / cell)},${Math.floor(CP[v * 3 + 1] / cell)},${Math.floor(CP[v * 3 + 2] / cell)}`; const r = rep.get(key); if (r === undefined) { rep.set(key, v); map[v] = v; } else map[v] = r; }
    for (let i = 0; i < NI.length; i += 3) {
      const a = map[NI[i]], b = map[NI[i + 1]], c = map[NI[i + 2]]; if (a === b || b === c || a === c) continue;
      const k = [a, b, c].sort((x, y) => x - y).join(','); if (seen.has(k)) continue; seen.add(k); out.push(a, b, c);
    }
    return out;
  };
  let cell = 0.004, SI = cluster(cell);
  while (SI.length / 3 > +SHADOW_TRIS && cell < 0.2) { cell *= 1.15; SI = cluster(cell); }
  const SA = Uint16Array.from(SI), so = out.replace(/\.glb$/, '') + '.shadow.bin';
  fs.writeFileSync(so, Buffer.from(SA.buffer));
  console.log(`shadow: ${NI.length / 3} → ${SA.length / 3} triangles (grid ${(cell * 100).toFixed(2)}% of the body's ±1 box); wrote ${so} ${(SA.byteLength / 1024).toFixed(0)} KB`);
}
