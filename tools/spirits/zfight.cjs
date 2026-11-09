// The maps' coplanar surfaces (Legacy of Spirits, GPT step 4P: "test adjacent maps for similar overlapping surfaces").
// Two faces from different pieces lying in the same plane, facing the same way, over the same spot fight for the same
// pixels: which one shows flips with the camera, the picture's size and its multisampling (the courtyard floor's
// brown/violet flip was its paving and the terrace slab's top). For each map: its place built in the lab
// (?spiritlab&area=…), every visible mesh's triangles in world space (instances included) grouped by plane, and where
// two pieces share a plane, the area they cover together (on a 4 cm grid in that plane).
//   node tools/spirits/zfight.cjs PORT OUT.json [area,area,…]   (a static build served on PORT; all maps by default)
const { chromium } = require('playwright');
const fs = require('fs');
const [port = '4219', out = 'zfight.json', only = ''] = process.argv.slice(2);
const ALL = 'courtyard,terraces_1,terraces_2,training,training_2,training_3,plaza,orchard_1,orchard_2,ruins,ruins_2,ruins_3,gate_1,gate_2,temple,sky,dusk_1,dusk_village,dusk_2,dusk_bridge,dusk_wood,dusk_3,den_1,den_2,den_3,den_4,den_5,sakura_village,sakura_1,sakura_2,sakura_3,ironhold_village,ironhold_1,ironhold_2,ironhold_3';
const AREAS = (only || ALL).split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
  const res = {};
  for (const area of AREAS) {
    await p.goto(`http://127.0.0.1:${port}/?spiritlab&area=${area}&noglow${process.env.ZQ ?? "&spirits"}`);
    try { await p.waitForFunction(() => window.__lab && window.__lab.scene3, null, { timeout: 600000, polling: 500 }); } catch { console.log(area, 'did not open'); continue; }
    const r = await p.evaluate(() => {
      const L = window.__lab, out = [];
      const V = (x, y, z) => ({ x, y, z });
      const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z), cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
      const planes = new Map(); // key → [{ owner, tri: [a, b, c] }]
      const owners = [];
      const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
      const mul = (m, x, y, z) => { const e = m.elements, w = e[3] * x + e[7] * y + e[11] * z + e[15]; return V((e[0] * x + e[4] * y + e[8] * z + e[12]) / w, (e[1] * x + e[5] * y + e[9] * z + e[13]) / w, (e[2] * x + e[6] * y + e[10] * z + e[14]) / w); };
      for (const sc of [L.scene3, L.front3]) {
        sc.updateMatrixWorld(true);
        sc.traverse((o) => {
          if (!o.isMesh || !shown(o) || !o.geometry?.attributes?.position) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
          const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
          const inst = o.isInstancedMesh ? o.count : 1;
          if (n * inst > 3e6) return;
          for (const gr of groups) {
            const m = mats[gr.materialIndex ?? 0]; if (!m || !m.visible || m.colorWrite === false) continue;
            if (m.transparent && m.depthWrite === false) continue; // (a glow or a decal drawn over: no fight for the depth)
            const ownerBase = { mesh: o.name || o.type, mat: m.name || m.type, color: m.color ? '#' + m.color.getHexString() : null, map: !!m.map, side: m.side, scene: sc === L.scene3 ? 'back' : 'front', po: m.polygonOffset ? [m.polygonOffsetFactor, m.polygonOffsetUnits] : null, ro: o.renderOrder };
            for (let k = 0; k < inst; k++) {
              const M = o.matrixWorld.clone(); if (o.isInstancedMesh) { const im = o.matrixWorld.clone(); o.getMatrixAt(k, im); M.multiply(im); }
              const id = owners.length; owners.push({ ...ownerBase, inst: o.isInstancedMesh ? k : undefined });
              for (let t = gr.start; t < Math.min(n, gr.start + gr.count); t += 3) {
                const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
                const a = mul(M, P.getX(ia), P.getY(ia), P.getZ(ia)), b2 = mul(M, P.getX(ib), P.getY(ib), P.getZ(ib)), c = mul(M, P.getX(ic), P.getY(ic), P.getZ(ic));
                const nn = cross(sub(b2, a), sub(c, a)), len = Math.hypot(nn.x, nn.y, nn.z); if (len < 2e-4) continue; // (area under 1 cm²)
                const N = V(nn.x / len, nn.y / len, nn.z / len), d = dot(N, a);
                const key = [Math.round(N.x * 200), Math.round(N.y * 200), Math.round(N.z * 200), Math.round(d / 0.003)].join(',');
                let arr = planes.get(key); if (!arr) planes.set(key, (arr = [])); arr.push({ id, tri: [a, b2, c], N, d });
              }
            }
          }
        });
      }
      // a plane's pieces: rasterise each piece's triangles on a 4 cm grid in the plane; cells two pieces cover
      const CELL = 0.04;
      for (const [key, arr] of planes) {
        const ids = new Set(arr.map((e) => e.id)); if (ids.size < 2) continue;
        // (neighbouring keys within 3 mm are folded in when found: a key's own triangles only — good enough for a report)
        const N = arr[0].N; const ax = Math.abs(N.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
        let u = cross(N, ax); const ul = Math.hypot(u.x, u.y, u.z); u = V(u.x / ul, u.y / ul, u.z / ul); const v = cross(N, u);
        const cells = new Map(); // cell → Set of owner ids
        for (const e of arr) {
          const q = e.tri.map((p) => [dot(p, u) / CELL, dot(p, v) / CELL]);
          const x0 = Math.floor(Math.min(q[0][0], q[1][0], q[2][0])), x1 = Math.ceil(Math.max(q[0][0], q[1][0], q[2][0]));
          const y0 = Math.floor(Math.min(q[0][1], q[1][1], q[2][1])), y1 = Math.ceil(Math.max(q[0][1], q[1][1], q[2][1]));
          if ((x1 - x0) * (y1 - y0) > 4e5) continue;
          const s = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
          for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
            const c = [x + 0.5, y + 0.5], d1 = s(c, q[0], q[1]), d2 = s(c, q[1], q[2]), d3 = s(c, q[2], q[0]);
            const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0; if (neg && pos) continue;
            const k = x + ',' + y; let set = cells.get(k); if (!set) cells.set(k, (set = new Set())); set.add(e.id);
          }
        }
        const pairs = new Map(); // pair → { n: cells, box: the cells' extent in the plane }
        for (const [ck, set] of cells) if (set.size > 1) {
          const [cx, cy] = ck.split(',').map(Number), ids2 = [...set].sort((a, b) => a - b);
          for (let i = 0; i < ids2.length; i++) for (let j = i + 1; j < ids2.length; j++) {
            const A = owners[ids2[i]], B = owners[ids2[j]]; if (A.mesh === B.mesh && A.mat === B.mat && A.inst === B.inst) continue;
            const pk = ids2[i] + '|' + ids2[j]; let e = pairs.get(pk); if (!e) pairs.set(pk, (e = { n: 0, u0: cx, u1: cx, v0: cy, v1: cy }));
            e.n++; e.u0 = Math.min(e.u0, cx); e.u1 = Math.max(e.u1, cx); e.v0 = Math.min(e.v0, cy); e.v1 = Math.max(e.v1, cy);
          }
        }
        const at = (cu, cv) => { const d0 = arr[0].d, uu = (cu + 0.5) * CELL, vv = (cv + 0.5) * CELL; return [N.x * d0 + u.x * uu + v.x * vv, N.y * d0 + u.y * uu + v.y * vv, N.z * d0 + u.z * uu + v.z * vv]; };
        for (const [pk, e] of pairs) {
          const area = e.n * CELL * CELL; if (area < 0.01) continue; const [i, j] = pk.split('|').map(Number);
          const p0 = at(e.u0, e.v0), p1 = at(e.u1, e.v1), lo = p0.map((x, k) => +Math.min(x, p1[k]).toFixed(2)), hi = p0.map((x, k) => +Math.max(x, p1[k]).toFixed(2));
          out.push({ area: +area.toFixed(3), plane: { n: [N.x, N.y, N.z].map((x) => +x.toFixed(2)), d: +arr[0].d.toFixed(3) }, from: lo, to: hi, a: owners[i], b: owners[j] });
        }
      }
      out.sort((a, b) => b.area - a.area);
      return { owners: owners.length, planes: planes.size, fights: out.slice(0, 60) };
    });
    res[area] = r;
    console.log(area, 'pieces', r.owners, 'fights', r.fights.length, r.fights.slice(0, 3).map((f) => `${f.area}m² ${f.a.mesh}/${f.a.color} × ${f.b.mesh}/${f.b.color} n${f.plane.n} d${f.plane.d}`).join(' · '));
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
  }
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
