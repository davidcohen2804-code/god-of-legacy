// Smooth normals across the UV seams (the split vertices share their position's normal), for a body that has none.
import { NodeIO } from '@gltf-transform/core';
const [src, out] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(src);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  const P = p.getAttribute('POSITION').getArray(), I = p.getIndices().getArray(), n = P.length / 3;
  const key = new Map(), g = new Int32Array(n); for (let i = 0; i < n; i++) { const k = `${P[3*i].toFixed(5)},${P[3*i+1].toFixed(5)},${P[3*i+2].toFixed(5)}`; let j = key.get(k); if (j === undefined) { j = key.size; key.set(k, j); } g[i] = j; }
  const acc = new Float64Array(key.size * 3);
  for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t+1], c = I[t+2];
    const ux = P[3*b] - P[3*a], uy = P[3*b+1] - P[3*a+1], uz = P[3*b+2] - P[3*a+2], vx = P[3*c] - P[3*a], vy = P[3*c+1] - P[3*a+1], vz = P[3*c+2] - P[3*a+2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { acc[3*g[v]] += nx; acc[3*g[v]+1] += ny; acc[3*g[v]+2] += nz; } }
  const N = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const j = g[i]; const x = acc[3*j], y = acc[3*j+1], z = acc[3*j+2], l = Math.hypot(x, y, z) || 1; N[3*i] = x / l; N[3*i+1] = y / l; N[3*i+2] = z / l; }
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(doc.getRoot().listBuffers()[0]));
  console.log('normals', n, 'positions', key.size);
}
await io.write(out, doc);
