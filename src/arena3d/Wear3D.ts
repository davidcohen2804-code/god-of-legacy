// What a 3D hero wears over the Beginner (items3d.ts): a hat on the head, a cloak on the back, the outfit dyed and
// patterned, an aura round the feet. The Beginner is one painted piece (its clothes are its texels), so a shirt, the
// trousers and the boots change by the outfit's regions (tools/hero3d/items/regions.mjs): each region's colour, its
// painted shading kept, and a pattern laid on the body; a hat and a cloak are made here, sized to this body (its head
// with its hair, its shoulders and back) — the hat on the head's bone, the cloak a cloth hanging from the shoulders that
// swings as the body moves (pinned to the collarbones and the upper spine, kept off the body and the legs).
import * as THREE from 'three';
import type { Dye3D, Item3D } from './items3d';

/** What Wear3D needs of the hero. */
export interface WearHost {
  readonly scene: THREE.Scene; readonly root: THREE.Group; readonly body: THREE.SkinnedMesh; readonly bones: Map<string, THREE.Bone>; readonly female: boolean;
  addShadow(m: THREE.Mesh, both?: boolean): void; dropShadow(m: THREE.Mesh): void;
}

const DIR = 'assets/hero3d/';
/** The outfit's regions (regions.mjs): the map's file, the atlas's share of the texture's height (the head's band
 *  below), each region's mean brightness (sRGB, 0..1; 1 shirt, 2 vest, 3 sash, 4 trousers, 5 boots, 6 bracers). */
const REGIONS = {
  m: { file: 'beginner_m_reg.png', atlasV: 0.666667, mean: [0, 0.781, 0.229, 0.2719, 0.2022, 0.2204, 0.2397] },
  f: { file: 'beginner_f_reg.png', atlasV: 0.666667, mean: [0, 0.7744, 0.2293, 0.2607, 0.203, 0.2263, 0.2308] },
};
const REGION_ID = { shirt: 1, vest: 2, sash: 3, pants: 4, boots: 5, bracer: 6 } as const;
const PATTERN_ID = { stripes: 1, checks: 2, stars: 3, scales: 4, dots: 5, waves: 6 } as const;

const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
/** A little grain over a flat colour (felt, cloth, steel): the canvas brightened and darkened in small soft specks. */
const grain = (g: CanvasRenderingContext2D, w: number, h: number, k: number, n = 900, seed = 1): void => {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${k * rnd()})` : `rgba(0,0,0,${k * rnd()})`; const r = 1 + rnd() * 3; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, r * (1 + rnd() * 3), r, rnd() * 3, 0, 7); g.fill(); }
};
const star = (g: CanvasRenderingContext2D, x: number, y: number, r: number, pts = 5, inner = 0.45): void => {
  g.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = (i * Math.PI) / pts - Math.PI / 2, rr = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
};

/** A surface from a function of (u, v) ∈ [0,1]², nu × nv quads; `wrapU`: closed round u (its seam's normals shared). */
function surface(nu: number, nv: number, f: (u: number, v: number, o: THREE.Vector3) => void, wrapU = false): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], o = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { f(i / nu, j / nv, o); pos.push(o.x, o.y, o.z); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  if (wrapU) { const n = g.attributes.normal as THREE.BufferAttribute, t = new THREE.Vector3(), s = new THREE.Vector3(); for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; t.fromBufferAttribute(n, a).add(s.fromBufferAttribute(n, b)).normalize(); n.setXYZ(a, t.x, t.y, t.z); n.setXYZ(b, t.x, t.y, t.z); } }
  return g;
}

/** The head as the hats see it (bind space): the rim's middle (the forehead's height, between the hair's front and
 *  back), its half-widths across (rx) and front to back (rz), the crown's height over it (ht). */
interface HeadFit { c: THREE.Vector3; rx: number; rz: number; ht: number; chin: number }

// =============================================================================================== the hats
type HatBuild = (H: HeadFit, own: { dispose(): void }[]) => THREE.Group;
const std = (own: { dispose(): void }[], o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(o); own.push(m); if (o.map) own.push(o.map); return m; };
const mesh = (own: { dispose(): void }[], g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => { own.push(g); const x = new THREE.Mesh(g, m); x.castShadow = true; x.frustumCulled = false; x.userData.worn = true; return x; };

const HATS: Record<string, HatBuild> = {
  /** The warrior's helm: a steel dome over the head and down the back of it and the ears (the face open), a nose guard,
   *  a gold band round it, a crimson crest from the brow to the nape. */
  w_helm: (H, own) => {
    const g = new THREE.Group(), rx = H.rx * 1.1 + 0.004, rz = H.rz * 1.09 + 0.004, ht = H.ht * 1.13;
    const steelTex = tex(256, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c4cad3'); gr.addColorStop(0.6, '#8d949e'); gr.addColorStop(1, '#5d636c'); c.fillStyle = gr; c.fillRect(0, 0, w, h); grain(c, w, h, 0.12, 1400, 3); c.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 18; i++) { c.beginPath(); const x = (i * 53) % w; c.moveTo(x, 0); c.lineTo(x + 30, h); c.lineWidth = 0.6; c.stroke(); } });
    const steel = std(own, { map: steelTex, metalness: 0.55, roughness: 0.38, color: 0xffffff });
    const gold = std(own, { color: 0xc99a3e, metalness: 0.7, roughness: 0.34 });
    const crestTex = tex(64, 256, (c, w, h) => { c.fillStyle = '#9b1414'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(${150 + (i * 37) % 90},${10 + (i * 13) % 30},${10 + (i * 7) % 20},.8)`; c.lineWidth = 1 + (i % 3); const x = (i * 17) % w; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 6, h / 2, x - 4, h); c.stroke(); } });
    const crest = std(own, { map: crestTex, roughness: 0.85, side: THREE.DoubleSide });
    // the dome and its skirt: down to the brow at the front, to the nape at the back and over the ears at the sides
    const drop = (u: number) => { const a = Math.abs(((u * 2 + 1) % 2) - 1); return ht * 0.62 * THREE.MathUtils.smoothstep(a, 0.22, 0.42); }; // (u 0: the front)
    g.add(mesh(own, surface(48, 20, (u, v, o) => {
      const th = u * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th);
      if (v < 0.75) { const a = (v / 0.75) * (Math.PI / 2); o.set(rx * Math.sin(a) * sx, ht * Math.cos(a), rz * Math.sin(a) * cz); }
      else { const t = (v - 0.75) / 0.25, fl = 1 + 0.06 * t; o.set(rx * fl * sx, -drop(u) * t, rz * fl * cz); }
    }, true), steel));
    // the band round its foot, the nose guard
    g.add(mesh(own, surface(48, 3, (u, v, o) => { const th = u * Math.PI * 2, k = 1.035; o.set(rx * k * Math.sin(th), ht * (0.05 + 0.13 * v), rz * k * Math.cos(th)); }, true), gold));
    g.add(mesh(own, surface(4, 6, (u, v, o) => { const w = (0.13 - 0.05 * v) * rx; o.set((u - 0.5) * w, ht * 0.08 - v * ht * 0.62, rz * 1.04 - 0.02 * rz * Math.abs(u - 0.5) + v * v * rz * 0.05); }), gold));
    // the crest: a fan of horsehair over the top, from the brow back to the nape
    g.add(mesh(own, surface(2, 24, (u, v, o) => { // (v 0: over the brow, 1: the nape; the fin stands out of the dome)
      const a = 0.95 - v * 2.45, ny = Math.cos(a), nz = Math.sin(a), up = ht * 0.4 * Math.sin(Math.min(1, v * 1.25) * Math.PI * 0.92) * u + 0.004;
      o.set((u - 0.5) * rx * 0.06, ht * ny + ny * up, rz * nz + nz * up);
    }), crest));
    return g;
  },
  /** The samurai's kasa: a wide shallow cone of woven straw over the head (its band sits on the crown), a red cord
   *  under the chin. */
  s_kasa: (H, own) => {
    const g = new THREE.Group(), R = Math.max(H.rx, H.rz) * 2.15, apex = H.ht * 1.38, edge = H.ht * 0.3;
    const straw = tex(512, 256, (c, w, h) => {
      c.fillStyle = '#cfa75a'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 4) { c.fillStyle = `rgba(${(x * 13) % 2 ? 90 : 255},${(x * 7) % 3 ? 60 : 220},20,${0.08 + ((x * 31) % 7) / 60})`; c.fillRect(x, 0, 2, h); }
      for (let y = 10; y < h; y += 22) { c.fillStyle = 'rgba(70,40,10,.28)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(255,240,190,.18)'; c.fillRect(0, y + 3, w, 2); }
      const gr = c.createLinearGradient(0, h * 0.85, 0, h); gr.addColorStop(0, 'rgba(60,30,8,0)'); gr.addColorStop(1, 'rgba(60,30,8,.55)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      grain(c, w, h, 0.1, 900, 5);
    });
    const m = std(own, { map: straw, roughness: 0.92, side: THREE.DoubleSide });
    g.add(mesh(own, surface(64, 10, (u, v, o) => { const th = u * Math.PI * 2, r = R * Math.max(0.004, v); o.set(r * Math.sin(th), apex - (apex - edge) * Math.pow(v, 0.95) - 0.06 * H.ht * Math.sin(v * Math.PI), r * Math.cos(th)); }, true), m));
    // the inner band (on the crown) and the cord
    const band = std(own, { color: 0x3a2412, roughness: 0.9, side: THREE.DoubleSide });
    g.add(mesh(own, surface(32, 2, (u, v, o) => { const th = u * Math.PI * 2; o.set(H.rx * 0.9 * Math.sin(th), H.ht * (0.55 + 0.35 * v), H.rz * 0.9 * Math.cos(th)); }, true), band));
    const cord = std(own, { color: 0xb3202c, roughness: 0.7 });
    // (close down the cheeks and just under the jaw: `chin` is the head's lowest front point, a little under the jaw)
    const side = (k: number) => [new THREE.Vector3(k * H.rx * 0.95, H.ht * 0.55, 0), new THREE.Vector3(k * H.rx * 0.93, -H.ht * 0.3, H.rz * 0.12), new THREE.Vector3(k * H.rx * 0.74, H.chin * 0.7, H.rz * 0.36), new THREE.Vector3(k * H.rx * 0.36, H.chin * 0.92, H.rz * 0.6)];
    const path = new THREE.CatmullRomCurve3([...side(1), new THREE.Vector3(0, H.chin * 0.95, H.rz * 0.66), ...side(-1).reverse()]);
    g.add(mesh(own, new THREE.TubeGeometry(path, 48, 0.0035, 5, false), cord));
    return g;
  },
  /** The archer's feathered cap: green felt, its crown drawn back to a point, a narrow brim turned up behind and to a
   *  beak in front, a long red feather swept back from its side. */
  a_cap: (H, own) => {
    const g = new THREE.Group(), rx = H.rx * 1.13 + 0.004, rz = H.rz * 1.12 + 0.004, ht = H.ht; // (roomy: the hair's top stays inside)
    const felt = tex(256, 256, (c, w, h) => { c.fillStyle = '#2f5d2b'; c.fillRect(0, 0, w, h); grain(c, w, h, 0.16, 2200, 7); const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const m = std(own, { map: felt, roughness: 0.95, side: THREE.DoubleSide });
    const tip = new THREE.Vector3(0, ht * 1.25, -rz * 1.7);
    g.add(mesh(own, surface(48, 16, (u, v, o) => {
      const th = u * Math.PI * 2, rim = new THREE.Vector3(rx * Math.sin(th), 0, rz * Math.cos(th));
      const dome = new THREE.Vector3(rx * 0.86 * Math.sin(th), ht * 1.14, rz * 0.86 * Math.cos(th) - rz * 0.15);
      const a = new THREE.Vector3().lerpVectors(rim, dome, Math.sin(v * Math.PI / 2)), t = Math.pow(v, 2.4);
      o.copy(a).lerp(tip, t * (0.5 + 0.5 * (1 - Math.cos(th)) / 2) * 0.9);
    }, true), m));
    const brimM = std(own, { color: 0x274d24, roughness: 0.95, side: THREE.DoubleSide });
    g.add(mesh(own, surface(48, 3, (u, v, o) => {
      const th = u * Math.PI * 2, f = Math.max(0, Math.cos(th)), b = Math.max(0, -Math.cos(th)), w = 1 + (0.16 + 0.42 * Math.pow(f, 6)) * v;
      o.set(rx * w * Math.sin(th), -0.02 * ht * v + b * b * v * ht * 0.42 - Math.pow(f, 6) * v * ht * 0.12, rz * w * Math.cos(th));
    }, true), brimM));
    const featherTex = tex(64, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let y = 8; y < h - 4; y += 2) { const t = y / h, half = (w / 2 - 3) * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6; const gr = c.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0); gr.addColorStop(0, 'rgba(150,20,24,0.0)'); gr.addColorStop(0.15, '#a3161b'); gr.addColorStop(0.5, '#e0352b'); gr.addColorStop(0.85, '#a3161b'); gr.addColorStop(1, 'rgba(150,20,24,0)'); c.fillStyle = gr; c.fillRect(w / 2 - half, y, half * 2, 1.4); }
      c.fillStyle = '#f4ead2'; c.fillRect(w / 2 - 1, 0, 2, h);
      for (let y = 20; y < h; y += 26) { c.clearRect(0, y, 6 + (y % 3) * 2, 3); c.clearRect(w - 8, y + 9, 8, 3); }
    });
    const fm = std(own, { map: featherTex, alphaTest: 0.4, roughness: 0.8, side: THREE.DoubleSide });
    const L = ht * 2.4, W = ht * 0.3;
    g.add(mesh(own, surface(2, 16, (u, v, o) => { const a = v * 1.15; o.set(rx * 1.02 + 0.01 * v, ht * 0.25 + Math.sin(a) * L * 0.55, -Math.sin(a * 0.9) * L * 0.62 + (u - 0.5) * W * Math.cos(a * 0.6) + rz * 0.15); }), fm));
    return g;
  },
  /** The mage's hat: a wide brim, its edge waving and drooping, a tall cone bent back and down at its tip — midnight
   *  blue strewn with gold stars, a gold band and a star at the front. */
  m_hat: (H, own) => {
    const g = new THREE.Group(), rx = H.rx * 1.06 + 0.004, rz = H.rz * 1.06 + 0.004, R = Math.max(rx, rz) * 2.35, ht = H.ht, T = ht * 3.3;
    const cloth = tex(512, 512, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2a86'); gr.addColorStop(1, '#141a52'); c.fillStyle = gr; c.fillRect(0, 0, w, h); grain(c, w, h, 0.08, 1500, 11);
      let s = 7; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 5; c.fillStyle = rnd() < 0.7 ? '#f3d27a' : '#dfe6ff'; star(c, x, y, r); c.fillStyle = 'rgba(255,230,160,.25)'; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill(); }
    });
    const m = std(own, { map: cloth, roughness: 0.82, side: THREE.DoubleSide });
    // the brim
    g.add(mesh(own, surface(64, 6, (u, v, o) => { const th = u * Math.PI * 2, r0x = rx * 1.01, r0z = rz * 1.01, k = v, rr = (a: number, b: number) => a + (b - a) * k; o.set(rr(r0x, R) * Math.sin(th), -ht * 0.12 * k * k + ht * 0.05 * Math.sin(th * 5) * k * k, rr(r0z, R * 0.94) * Math.cos(th)); }, true), m));
    // the cone, its tip bent back and down
    const C = (t: number) => { const b = THREE.MathUtils.smoothstep(t, 0.45, 1); return new THREE.Vector3(0, T * t - T * 0.22 * b * b, -T * 0.38 * b * b); };
    g.add(mesh(own, surface(48, 28, (u, v, o) => { const th = u * Math.PI * 2, r = Math.pow(1 - v, 1.1) * (1 + 0.05 * Math.sin(v * Math.PI)), c0 = C(v); o.set(c0.x + rx * r * Math.sin(th), c0.y, c0.z + rz * r * Math.cos(th)); }, true), m));
    const gold = std(own, { color: 0xd9b44a, metalness: 0.65, roughness: 0.32, emissive: 0x3a2a00 });
    g.add(mesh(own, surface(48, 2, (u, v, o) => { const th = u * Math.PI * 2, t = 0.03 + 0.1 * v, r = Math.pow(1 - t, 1.1) * 1.025, c0 = C(t); o.set(rx * r * Math.sin(th), c0.y, rz * r * Math.cos(th)); }, true), gold));
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 + Math.PI / 2, r = (i % 2 ? 0.42 : 1) * ht * 0.16; if (i) st.lineTo(Math.cos(a) * r, Math.sin(a) * r); else st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(st, { depth: ht * 0.03, bevelEnabled: false }); const sm = mesh(own, sg, gold); sm.position.set(0, T * 0.085, rz * 0.94); g.add(sm);
    return g;
  },
  /** The gambler's top hat: black silk, a little waisted, its brim curled up at the sides, a crimson band with the ace
   *  of spades tucked in it — worn at a slant. */
  g_tophat: (H, own) => {
    const g = new THREE.Group(), rx = H.rx * 1.04 + 0.004, rz = H.rz * 1.04 + 0.004, Hc = H.ht * 1.85;
    const silk = std(own, { color: 0x17171c, roughness: 0.34, metalness: 0.1, side: THREE.DoubleSide });
    g.add(mesh(own, surface(48, 8, (u, v, o) => { const th = u * Math.PI * 2, k = 1 + 0.07 * v - 0.05 * Math.sin(v * Math.PI); o.set(rx * k * Math.sin(th), Hc * v, rz * k * Math.cos(th)); }, true), silk));
    g.add(mesh(own, surface(48, 2, (u, v, o) => { const th = u * Math.PI * 2, k = 1.07 * (1 - v); o.set(rx * k * Math.sin(th), Hc, rz * k * Math.cos(th)); }, true), silk));
    g.add(mesh(own, surface(64, 4, (u, v, o) => { const th = u * Math.PI * 2, k = 1.0 + 0.62 * v, s = Math.sin(th); o.set(rx * k * s, -0.01 + H.ht * 0.22 * s * s * v * v - H.ht * 0.04 * Math.cos(th) ** 2 * v, rz * (1 + 0.5 * v) * Math.cos(th)); }, true), silk));
    const band = std(own, { color: 0x5a2a8a, roughness: 0.6, side: THREE.DoubleSide });
    g.add(mesh(own, surface(48, 2, (u, v, o) => { const th = u * Math.PI * 2, t = 0.02 + 0.2 * v, k = 1.012 + 0.07 * t - 0.05 * Math.sin(t * Math.PI); o.set(rx * k * Math.sin(th), Hc * t, rz * k * Math.cos(th)); }, true), band));
    const card = tex(128, 180, (c, w, h) => {
      c.fillStyle = '#fbf7ee'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 10); c.fill(); c.strokeStyle = '#b89a52'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#111'; c.font = 'bold 30px Georgia'; c.fillText('A', 10, 34);
      c.beginPath(); const x = w / 2, y = h / 2 + 4, r = 30; c.moveTo(x, y - r); c.bezierCurveTo(x + r * 1.3, y - r * 0.1, x + r * 0.9, y + r * 0.9, x, y + r * 0.35); c.bezierCurveTo(x - r * 0.9, y + r * 0.9, x - r * 1.3, y - r * 0.1, x, y - r); c.fill(); c.fillRect(x - 3, y + r * 0.2, 6, r * 0.8); c.beginPath(); c.moveTo(x - 14, y + r); c.lineTo(x + 14, y + r); c.lineTo(x, y + r * 0.55); c.fill();
    });
    const cm = mesh(own, new THREE.PlaneGeometry(H.ht * 0.42, H.ht * 0.6), std(own, { map: card, roughness: 0.6, side: THREE.DoubleSide }));
    cm.position.set(rx * 0.55, Hc * 0.24, rz * 0.94); cm.rotation.set(-0.1, 0.55, -0.22); g.add(cm);
    g.rotation.set(-0.05, 0, -0.13); // (at a slant)
    return g;
  },
};

// =============================================================================================== the cloaks
interface CloakLook { outer: (c: CanvasRenderingContext2D, w: number, h: number) => void; lining: number; length: number; flare: number; dagged?: boolean }
const trim = (c: CanvasRenderingContext2D, w: number, h: number, col: string, k = 10): void => { c.fillStyle = col; c.fillRect(0, 0, k, h); c.fillRect(w - k, 0, k, h); c.fillRect(0, h - k * 1.4, w, k * 1.4); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(k, 0, 2, h); c.fillRect(w - k - 2, 0, 2, h); };
const drape = (c: CanvasRenderingContext2D, w: number, h: number): void => { for (let x = 0; x < w; x += 2) { const s = Math.sin((x / w) * Math.PI * 7) * 0.5 + 0.5; c.fillStyle = `rgba(0,0,0,${0.16 * s})`; c.fillRect(x, 0, 2, h); } const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); };
const CLOAKS: Record<string, CloakLook> = {
  w_cape: { lining: 0x2a0b0b, length: 0.8, flare: 0.3, outer: (c, w, h) => {
    c.fillStyle = '#8e1a1a'; c.fillRect(0, 0, w, h); grain(c, w, h, 0.08, 1500, 13); drape(c, w, h); trim(c, w, h, '#d6a648', 9);
    c.save(); c.translate(w / 2, h * 0.22); c.fillStyle = '#d6a648'; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.lineWidth = 5; c.strokeStyle = '#d6a648'; c.stroke(); c.fillRect(-3, -26, 6, 52); c.fillRect(-14, 10, 28, 5); c.beginPath(); c.moveTo(0, -34); c.lineTo(5, -26); c.lineTo(-5, -26); c.fill(); c.restore();
  } },
  s_mantle: { lining: 0x8e1c24, length: 0.62, flare: 0.22, outer: (c, w, h) => {
    c.fillStyle = '#18171b'; c.fillRect(0, 0, w, h); grain(c, w, h, 0.07, 1200, 17); drape(c, w, h); trim(c, w, h, '#d9dde8', 4);
    c.save(); c.translate(w / 2, h * 0.2); c.fillStyle = '#e9ecf4'; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill(); c.fillStyle = '#18171b';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; c.beginPath(); c.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 9, 12, a + Math.PI / 2, 0, 7); c.fill(); } c.fillStyle = '#e9ecf4'; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); c.restore();
  } },
  a_leafcloak: { lining: 0x4a3a26, length: 0.82, flare: 0.34, dagged: true, outer: (c, w, h) => {
    c.fillStyle = '#2e5a2c'; c.fillRect(0, 0, w, h); let s = 5; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 160; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(20,50,18,.55)' : 'rgba(110,160,80,.35)'; c.save(); c.translate(rnd() * w, rnd() * h); c.rotate(rnd() * 6.3); c.beginPath(); c.ellipse(0, 0, 4 + rnd() * 6, 9 + rnd() * 10, 0, 0, 7); c.fill(); c.restore(); }
    drape(c, w, h);
    // the dagged hem: leaf-shaped tongues (cut out of the cloth)
    const n = 9, top = h * 0.9; c.clearRect(0, top, w, h - top); c.fillStyle = '#2e5a2c';
    for (let i = 0; i < n; i++) { const x0 = (i / n) * w, x1 = ((i + 1) / n) * w, xm = (x0 + x1) / 2; c.beginPath(); c.moveTo(x0, top - 2); c.quadraticCurveTo(x0, h * 0.97, xm, h - 2); c.quadraticCurveTo(x1, h * 0.97, x1, top - 2); c.fill(); }
  } },
  m_cloak: { lining: 0x2c2160, length: 0.95, flare: 0.4, outer: (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#172057'); gr.addColorStop(1, '#2c1a5e'); c.fillStyle = gr; c.fillRect(0, 0, w, h); grain(c, w, h, 0.06, 1200, 19); drape(c, w, h);
    let s = 3; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 120; i++) { const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 3.5; c.fillStyle = rnd() < 0.3 ? '#f3d27a' : '#e2e8ff'; star(c, x, y, r * 1.6, 4, 0.3); }
    trim(c, w, h, '#d9b44a', 7);
  } },
  g_cape: { lining: 0x6e1f78, length: 0.72, flare: 0.3, outer: (c, w, h) => {
    c.fillStyle = '#121216'; c.fillRect(0, 0, w, h); grain(c, w, h, 0.05, 1200, 23); drape(c, w, h);
    const suits = ['♠', '♥', '♦', '♣']; c.font = '22px Georgia'; c.fillStyle = 'rgba(120,120,135,.22)';
    for (let y = 30, r = 0; y < h; y += 46, r++) for (let x = (r % 2) * 26 + 14; x < w; x += 52) c.fillText(suits[(r + Math.floor(x / 52)) % 4], x, y);
    trim(c, w, h, '#d9b44a', 6);
  } },
};

/** The shade a hat throws on the face and the hair under it (the room has no shadow maps: without it the lower face under
 *  a wide brim reads bright and bare from the fight's high camera): how far down from the rim it is whole (`full`) and
 *  where it has faded (`d`), in rim-to-chin lengths, and how dark (`s`). */
const HAT_SHADE: Record<string, { full: number; d: number; s: number }> = {
  w_helm: { full: 0.3, d: 0.6, s: 0.3 }, s_kasa: { full: 1, d: 1.35, s: 0.6 }, a_cap: { full: 0.35, d: 0.7, s: 0.3 }, m_hat: { full: 0.95, d: 1.3, s: 0.55 }, g_tophat: { full: 0.45, d: 0.9, s: 0.38 },
};

// =============================================================================================== the auras
interface AuraLook { col: number; col2: number; rise: number; spin: number; n: number; size: number; fall?: boolean; sprite: (c: CanvasRenderingContext2D, w: number) => void; ring: (c: CanvasRenderingContext2D, w: number) => void }
const glowDot = (c: CanvasRenderingContext2D, w: number, inner: string, outer: string): void => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); };
const ringOf = (c: CanvasRenderingContext2D, w: number, col: string, marks: (c: CanvasRenderingContext2D, r: number) => void): void => {
  const m = w / 2; c.translate(m, m);
  const g = c.createRadialGradient(0, 0, m * 0.55, 0, 0, m); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.78, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, m, 0, 7); c.fill();
  c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, m * 0.8, 0, 7); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, m * 0.64, 0, 7); c.stroke();
  marks(c, m * 0.72); c.setTransform(1, 0, 0, 1, 0, 0);
};
const AURAS: Record<string, AuraLook> = {
  w_aura: { col: 0xff6a2a, col2: 0xffc060, rise: 0.9, spin: 0.4, n: 46, size: 0.06, sprite: (c, w) => glowDot(c, w, 'rgba(255,240,200,1)', 'rgba(255,110,30,.75)'),
    ring: (c, w) => ringOf(c, w, 'rgba(255,120,40,.9)', (g, r) => { for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * Math.PI * 2); g.fillStyle = 'rgba(255,170,70,.9)'; g.beginPath(); g.moveTo(-6, -r); g.quadraticCurveTo(0, -r - 26, 6, -r); g.fill(); g.restore(); } }) },
  s_aura: { col: 0xffa6c9, col2: 0xffffff, rise: -0.35, spin: 0.9, n: 38, size: 0.07, fall: true, sprite: (c, w) => { c.translate(w / 2, w / 2); c.fillStyle = '#ffc2d8'; for (let i = 0; i < 5; i++) { c.rotate((Math.PI * 2) / 5); c.beginPath(); c.ellipse(0, -w * 0.2, w * 0.13, w * 0.22, 0, 0, 7); c.fill(); } c.fillStyle = '#ff7aa8'; c.beginPath(); c.arc(0, 0, w * 0.07, 0, 7); c.fill(); },
    ring: (c, w) => ringOf(c, w, 'rgba(255,170,205,.8)', (g, r) => { for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * Math.PI * 2); g.fillStyle = 'rgba(255,200,220,.9)'; g.beginPath(); g.ellipse(0, -r, 6, 11, 0, 0, 7); g.fill(); g.restore(); } }) },
  a_aura: { col: 0x7fe07a, col2: 0xd8ffb0, rise: 0.55, spin: 1.6, n: 40, size: 0.065, sprite: (c, w) => { c.translate(w / 2, w / 2); c.rotate(0.6); c.fillStyle = '#8fe06a'; c.beginPath(); c.ellipse(0, 0, w * 0.17, w * 0.38, 0, 0, 7); c.fill(); c.strokeStyle = '#3f8a2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -w * 0.36); c.lineTo(0, w * 0.4); c.stroke(); },
    ring: (c, w) => ringOf(c, w, 'rgba(120,230,110,.85)', (g, r) => { for (let i = 0; i < 10; i++) { g.save(); g.rotate((i / 10) * Math.PI * 2); g.fillStyle = 'rgba(160,240,120,.85)'; g.beginPath(); g.ellipse(0, -r, 5, 12, 0.5, 0, 7); g.fill(); g.restore(); } }) },
  m_aura: { col: 0x9a7bff, col2: 0x7fd8ff, rise: 0.7, spin: 0.8, n: 52, size: 0.055, sprite: (c, w) => { glowDot(c, w, 'rgba(255,255,255,1)', 'rgba(160,120,255,.7)'); c.fillStyle = 'rgba(255,255,255,.9)'; star(c, w / 2, w / 2, w * 0.45, 4, 0.18); },
    ring: (c, w) => ringOf(c, w, 'rgba(150,120,255,.9)', (g, r) => { g.font = 'bold 22px Georgia'; g.fillStyle = 'rgba(190,170,255,.95)'; const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * Math.PI * 2); g.fillText(runes[i], -7, -r + 8); g.restore(); } g.strokeStyle = 'rgba(190,170,255,.7)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 - Math.PI / 2; g.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); } g.stroke(); }) },
  g_aura: { col: 0xffd36a, col2: 0xfff2b8, rise: 0.75, spin: 1.1, n: 40, size: 0.06, sprite: (c, w) => { const m = w / 2; const g = c.createRadialGradient(m - w * 0.1, m - w * 0.1, 0, m, m, w * 0.36); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#e8b23a'); g.addColorStop(1, '#a8741a'); c.fillStyle = g; c.beginPath(); c.arc(m, m, w * 0.34, 0, 7); c.fill(); c.strokeStyle = '#fff0b0'; c.lineWidth = 2; c.beginPath(); c.arc(m, m, w * 0.24, 0, 7); c.stroke(); },
    ring: (c, w) => ringOf(c, w, 'rgba(255,200,90,.9)', (g, r) => { g.font = 'bold 24px Georgia'; g.fillStyle = 'rgba(255,220,130,.95)'; const s = ['♠', '♥', '♦', '♣']; for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * Math.PI * 2); g.fillText(s[i % 4], -8, -r + 9); g.restore(); } }) },
};

// =============================================================================================== Wear3D
export class Wear3D {
  private own: { dispose(): void }[] = [];
  private hat: { id: string; g: THREE.Group; own: { dispose(): void }[] } | null = null;
  private cloak: Cloak | null = null;
  private aura: Aura | null = null;
  private dyes: Partial<Record<'top' | 'bottom' | 'shoes', Item3D>> = {};
  private shader: { uniforms: Record<string, THREE.IUniform> } | null = null;
  private uni = {
    uReg: { value: null as THREE.Texture | null }, uAtlasV: { value: 0.666667 }, uDyeOn: { value: 0 },
    uCol: { value: Array.from({ length: 7 }, () => new THREE.Color()) }, uAmt: { value: new Array(7).fill(0) }, uRef: { value: new Array(7).fill(0.5) },
    uPat: { value: Array.from({ length: 7 }, () => new THREE.Vector4()) }, uPatCol: { value: Array.from({ length: 7 }, () => new THREE.Color()) },
    uHat: { value: new THREE.Vector4() }, uHatR: { value: new THREE.Vector4() },
  };
  private fit: HeadFit;

  constructor(private h: WearHost) {
    this.fit = Wear3D.headFit(h.body);
    const R = REGIONS[h.female ? 'f' : 'm'];
    this.uni.uAtlasV.value = R.atlasV;
    R.mean.forEach((m, i) => { this.uni.uRef.value[i] = Math.max(0.02, Math.pow(m || 0.5, 2.2)); });
    this.dress(h.body.material as THREE.MeshStandardMaterial);
  }

  /** The body's material dyed by region (its shader patched: the region map, each region's colour and pattern). */
  dress(mat: THREE.MeshStandardMaterial): void {
    const u = this.uni;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vBindPos;\nvarying vec3 vHeadPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;\n#ifdef USE_SKINNING\nvHeadPos = (bindMatrix * vec4(position, 1.0)).xyz;\n#else\nvHeadPos = position;\n#endif');
      sh.fragmentShader = `varying vec3 vBindPos; varying vec3 vHeadPos;
uniform sampler2D uReg; uniform float uAtlasV; uniform float uDyeOn; uniform vec4 uHat; uniform vec4 uHatR;
uniform vec3 uCol[7]; uniform float uAmt[7]; uniform float uRef[7]; uniform vec4 uPat[7]; uniform vec3 uPatCol[7];
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float pattern(int type, float sc, vec3 p) {
  float f = 26.0 * sc; vec2 q = vec2((p.x + p.z) * f, p.y * f);
  if (type == 1) { return smoothstep(0.36, 0.46, abs(fract(q.x) - 0.5)); }
  if (type == 2) { float a = smoothstep(0.38, 0.46, abs(fract(q.x * 0.5) - 0.5)), b = smoothstep(0.38, 0.46, abs(fract(q.y * 0.5) - 0.5)); return max(a, b) * 0.85 + a * b * 0.15; }
  if (type == 3) { vec3 q3 = p * f * 1.4, c = floor(q3); vec3 o = 0.25 + 0.5 * vec3(hash3(c), hash3(c + 3.1), hash3(c + 7.7)); float d = length(fract(q3) - o); return step(0.62, hash3(c + 11.3)) * smoothstep(0.09, 0.0, d); } // (small sparks: a few cells in three)
  if (type == 4) { vec2 r = vec2(q.x * 1.6 + 0.5 * mod(floor(q.y * 1.6), 2.0), q.y * 1.6); float d = length(fract(r) - vec2(0.5, 0.15)); return smoothstep(0.08, 0.0, abs(d - 0.48)); }
  if (type == 5) { vec2 r = vec2(q.x + 0.5 * mod(floor(q.y), 2.0), q.y); return smoothstep(0.24, 0.18, length(fract(r) - 0.5)); }
  if (type == 6) { vec2 r = vec2(q.x * 1.3 + 0.5 * mod(floor(q.y * 1.3), 2.0), q.y * 1.3); float d = length(fract(r) - vec2(0.5, 0.0)); float w = abs(fract(d * 3.0) - 0.5); return smoothstep(0.12, 0.04, w) * step(d, 0.62); }
  return 0.0;
}
` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
if (uDyeOn > 0.5 && vMapUv.y < uAtlasV) {
  int rid = int(floor(texture2D(uReg, vec2(vMapUv.x, vMapUv.y / uAtlasV)).r * 255.0 / 32.0 + 0.5));
  if (rid > 0 && rid < 7 && uAmt[rid] > 0.0) {
    float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), k = clamp(l / uRef[rid], 0.0, 2.6);
    vec3 c = uCol[rid] * k;
    vec4 pt = uPat[rid];
    if (pt.x > 0.5) { float m = pattern(int(pt.x + 0.5), pt.y, vBindPos) * pt.z; c = mix(c, uPatCol[rid] * max(k, 0.55), m); }
    diffuseColor.rgb = mix(diffuseColor.rgb, c, uAmt[rid]);
  }
}
if (uHat.w > 0.5) { // (a hat's shade: under its rim, on the head and the neck, fading down)
  vec3 d = vHeadPos - uHat.xyz; float below = -d.y, rad = length(d.xz);
  float under = 1.0 - smoothstep(uHatR.x * 0.75, uHatR.x, rad), fade = smoothstep(-0.006, 0.012, below) * (1.0 - smoothstep(uHatR.w, uHatR.y, below));
  diffuseColor.rgb *= 1.0 - uHatR.z * under * fade;
}`);
      this.shader = sh;
    };
    mat.customProgramCacheKey = () => 'hero-dye';
    mat.needsUpdate = true;
  }

  /** A piece's own meshes (not their shadows). */
  private static meshesOf(g: THREE.Object3D): THREE.Mesh[] { const out: THREE.Mesh[] = []; g.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.shadow) out.push(o as THREE.Mesh); }); return out; }

  /** The head as the hats fit it (bind space): its vertices on the Head bone, its hair with it (not the ponytail). */
  private static headFit(body: THREE.SkinnedMesh): HeadFit {
    const sk = body.skeleton, hi = sk.bones.findIndex((b) => b.name === 'Head'), geo = body.geometry;
    const P = geo.attributes.position, UV = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    const v = new THREE.Vector3(), pts: THREE.Vector3[] = [], eyes: number[] = [];
    const comp = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number, c: number) => (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i));
    for (let i = 0; i < P.count; i++) {
      let w = 0; for (let c = 0; c < 4; c++) if (comp(SI, i, c) === hi) w += comp(SW, i, c);
      if (w < 0.5) continue;
      const uu = UV.getX(i), vv = UV.getY(i);
      if (uu > 0.875 && vv > 0.75) continue; // (the ponytail's locks and its tie)
      v.fromBufferAttribute(P, i).applyMatrix4(body.bindMatrix);
      if (uu > 0.875 && vv > 0.6667) eyes.push(v.y); else pts.push(v.clone());
    }
    const hb = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[hi].clone().invert());
    let top = -Infinity; for (const p of pts) top = Math.max(top, p.y);
    const eye = eyes.length ? eyes.reduce((a, b) => a + b, 0) / eyes.length : hb.y + 0.45 * (top - hb.y);
    const yr = eye + 0.42 * (top - eye), band = 0.012 * (top - hb.y) / 0.13;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, chin = Infinity;
    for (const p of pts) { if (Math.abs(p.y - yr) < Math.max(0.004, band)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } }
    const c = new THREE.Vector3((x0 + x1) / 2, yr, (z0 + z1) / 2);
    for (const p of pts) if (p.z > c.z + 0.3 * (z1 - z0) / 2 && Math.abs(p.x - c.x) < 0.25 * (x1 - x0)) chin = Math.min(chin, p.y);
    return { c, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2, ht: top - yr, chin: (isFinite(chin) ? chin : eye - (top - eye) * 0.9) - yr };
  }

  // ------------------------------------------------------------------ wearing
  wear(it: Item3D | null, slot: Item3D['slot']): void {
    if (slot === 'hat') this.setHat(it?.id ?? null);
    else if (slot === 'cloak') this.setCloak(it?.id ?? null);
    else if (slot === 'aura') this.setAura(it?.id ?? null);
    else if (slot === 'top' || slot === 'bottom' || slot === 'shoes') { if (it) this.dyes[slot] = it; else delete this.dyes[slot]; void this.applyDyes(); }
  }

  private setHat(id: string | null): void {
    if (this.hat?.id === id) return;
    if (this.hat) { for (const m of Wear3D.meshesOf(this.hat.g)) this.h.dropShadow(m); this.hat.g.removeFromParent(); for (const o of this.hat.own) o.dispose(); this.hat = null; } // (gathered first: a shadow is the mesh's sibling — taken out while walking the tree, it shifts the walk)
    this.uni.uHat.value.w = 0;
    const build = id ? HATS[id] : undefined, head = this.h.bones.get('Head'); if (!build || !head || !id) return;
    const sh = HAT_SHADE[id], F = this.fit;
    const L = Math.max(0.02, -F.chin); // (the rim to the chin)
    if (sh) { this.uni.uHat.value.set(F.c.x, F.c.y, F.c.z, 1); this.uni.uHatR.value.set(Math.max(F.rx, F.rz) * 1.75, sh.d * L, sh.s, sh.full * L); } // (as far out as the nose's tip and the ponytail)
    const own: { dispose(): void }[] = [], g = build(this.fit, own);
    // in the head bone: the hat made in the body's space at bind (its rim's middle as origin), carried by the bone
    const sk = this.h.body.skeleton, hi = sk.bones.indexOf(head), wrap = new THREE.Group();
    wrap.matrixAutoUpdate = false; wrap.matrix.copy(sk.boneInverses[hi]).multiply(new THREE.Matrix4().makeTranslation(this.fit.c.x, this.fit.c.y, this.fit.c.z));
    wrap.add(g); head.add(wrap); wrap.updateMatrixWorld(true);
    for (const m of Wear3D.meshesOf(g)) this.h.addShadow(m, true);
    this.hat = { id, g: wrap, own };
    this.tint(this.tintNow);
  }

  private setCloak(id: string | null): void {
    if (this.cloak?.id === id) return;
    if (this.cloak) { for (const m of this.cloak.meshes) this.h.dropShadow(m); this.cloak.dispose(); this.cloak = null; }
    const look = id ? CLOAKS[id] : undefined; if (!look || !id) return;
    this.cloak = new Cloak(this.h, id, look);
    this.h.addShadow(this.cloak.meshes[0], true);
    this.tint(this.tintNow);
  }

  private setAura(id: string | null): void {
    if (this.aura?.id === id) return;
    this.aura?.dispose(); this.aura = null;
    const look = id ? AURAS[id] : undefined; if (!look || !id) return;
    this.aura = new Aura(this.h, id, look);
  }

  /** The dyes worn (top, bottom, shoes) laid into the shader's uniforms (the region map loaded the first time, then
   *  shared by every body of that sex: a twin made this frame is dyed this frame). */
  private static regs = new Map<string, Promise<THREE.Texture | null>>();
  private static regNow = new Map<string, THREE.Texture>();
  private async applyDyes(): Promise<void> {
    const want: Partial<Record<keyof typeof REGION_ID, Dye3D>> = {};
    for (const it of Object.values(this.dyes)) Object.assign(want, it?.dye ?? {});
    const u = this.uni;
    u.uAmt.value.fill(0);
    for (const [reg, d] of Object.entries(want) as [keyof typeof REGION_ID, Dye3D][]) {
      const i = REGION_ID[reg]; u.uCol.value[i].set(d.color); u.uAmt.value[i] = 1;
      u.uPat.value[i].set(d.pattern ? PATTERN_ID[d.pattern] : 0, d.scale ?? 1, d.amount ?? 0.5, 0); u.uPatCol.value[i].set(d.with ?? '#ffffff');
    }
    const on = Object.keys(want).length > 0, file = REGIONS[this.h.female ? 'f' : 'm'].file;
    if (on && !u.uReg.value) {
      const now = Wear3D.regNow.get(file);
      if (now) u.uReg.value = now;
      else {
        let p = Wear3D.regs.get(file);
        if (!p) { p = Wear3D.loadRegions(file).then((t) => { if (t) Wear3D.regNow.set(file, t); else Wear3D.regs.delete(file); return t; }); Wear3D.regs.set(file, p); }
        const t = await p; if (!t) return; u.uReg.value = t;
      }
    }
    u.uDyeOn.value = Object.values(this.dyes).some((it) => it?.dye && Object.keys(it.dye).length) && u.uReg.value ? 1 : 0; // (as worn now: taken off while it loaded, it stays off)
  }
  /** The region map as a one-channel texture (nearest: a region is a region). */
  private static async loadRegions(file: string): Promise<THREE.Texture | null> {
    try {
      const bm = await createImageBitmap(await (await fetch(DIR + file)).blob());
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bm, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, r = new Uint8Array(c.width * c.height); for (let i = 0; i < r.length; i++) r[i] = d[4 * i];
      const t = new THREE.DataTexture(r, c.width, c.height, THREE.RedFormat, THREE.UnsignedByteType);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
      return t;
    } catch { return null; }
  }

  /** What it hangs on the body's bones (the hat): out of a copy of the body (Hero3D.clone puts its own on). */
  onBones(): THREE.Object3D[] { return this.hat ? [this.hat.g] : []; }
  /** The hat's top (world y; 0: none). */
  hatTop(): number { if (!this.hat) return 0; this.hat.g.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(this.hat.g).max.y; }
  /** Their shadows laid again (the body's shadow made after they were put on). */
  reshadow(): void {
    if (this.hat) for (const m of Wear3D.meshesOf(this.hat.g)) this.h.addShadow(m, true);
    if (this.cloak) this.h.addShadow(this.cloak.meshes[0], true);
  }

  // ------------------------------------------------------------------ each frame
  update(ms: number): void { this.cloak?.step(ms); this.aura?.step(ms); }
  /** Held still (a picture): the cloak let fall where it hangs. */
  settle(): void { this.cloak?.settle(); this.aura?.step(16); }
  /** The aura out of a picture of the body (the effects that copy it). */
  showAura(on: boolean): void { if (this.aura) this.aura.g.visible = on; }
  private tintNow: number | null = null;
  tint(t: number | null): void {
    this.tintNow = t;
    const set = (m: THREE.Material) => { const s = m as THREE.MeshStandardMaterial; if (!s.isMeshStandardMaterial) return; s.userData.em0 ??= s.emissive.getHex(); if (t === null) s.emissive.setHex(s.userData.em0 as number); else s.emissive.setHex(t).multiplyScalar(0.32); };
    if (this.hat) for (const m of Wear3D.meshesOf(this.hat.g)) set(m.material as THREE.Material);
    for (const m of this.cloak?.meshes ?? []) set(m.material as THREE.Material);
  }
  dispose(): void { this.setHat(null); this.setCloak(null); this.setAura(null); for (const o of this.own) o.dispose(); this.own = []; }
}

// =============================================================================================== the cloth
/** A cloak: a cloth of particles hanging from the shoulders (pinned to the collarbones and the upper spine, through
 *  their skinning), falling under its weight, its threads kept at length, kept off the body (the back, the hips, the
 *  legs, the upper arms: capsules on the bones). Simulated in the world at 60 steps a second. */
class Cloak {
  readonly meshes: THREE.Mesh[] = [];
  private own: { dispose(): void }[] = [];
  private W = 9; private Hn = 14;
  private p: Float32Array; private q: Float32Array; private rest: Float32Array; private pinB: { b: number[]; w: number[]; at: THREE.Vector3 }[] = [];
  private links: [number, number, number][] = [];
  private caps: { a: number; b: number; r: number; back?: boolean }[] = [];
  private geo: THREE.BufferGeometry;
  private boneM: THREE.Matrix4[]; private acc = 0; private fresh = true; private wind = 0; private tw = 0;
  private prevM = new THREE.Matrix4(); private hasPrev = false; private static D = new THREE.Matrix4();
  private static v = new THREE.Vector3(); private static v2 = new THREE.Vector3(); private static m = new THREE.Matrix4(); private static f = new THREE.Vector3(); private static ax = new THREE.Vector3();

  constructor(private h: WearHost, readonly id: string, look: CloakLook) {
    const body = h.body, sk = body.skeleton, idx = (n: string) => sk.bones.findIndex((b) => b.name === n);
    const at = (n: string) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[idx(n)].clone().invert());
    const W = this.W, H = this.Hn, n = W * H;
    const sl = at('upperarm_l'), sr = at('upperarm_r'), nk = at('neck_01'), foot = at('foot_l');
    // the shoulders' line behind the body: each pin just off the back (the body's back-most point there)
    const P = body.geometry.attributes.position, vb = new THREE.Vector3(), pts: THREE.Vector3[] = [];
    for (let i = 0; i < P.count; i += 2) { vb.fromBufferAttribute(P, i).applyMatrix4(body.bindMatrix); if (vb.y > nk.y - 0.16 && vb.y < nk.y + 0.02) pts.push(vb.clone()); }
    const yTop = nk.y - 0.035, len = (yTop - foot.y) * look.length, cx0 = (sl.x + sr.x) / 2;
    const pin: THREE.Vector3[] = [];
    for (let j = 0; j < W; j++) {
      const s = j / (W - 1), x = cx0 + (THREE.MathUtils.lerp(sl.x, sr.x, s) - cx0) * 1.18, y = yTop - 0.045 * Math.pow(2 * Math.abs(s - 0.5), 2);
      let z = Infinity; for (const p of pts) if (Math.abs(p.x - x) < 0.03 && Math.abs(p.y - y) < 0.035) z = Math.min(z, p.z);
      if (!isFinite(z)) z = nk.z - 0.08;
      pin.push(new THREE.Vector3(x, y, z - 0.014));
      const cw = Math.abs(s - 0.5) * 2, side = s < 0.5 ? 'clavicle_l' : 'clavicle_r';
      this.pinB.push({ b: [idx('spine_03'), idx(side)], w: [1 - cw * 0.85, cw * 0.85], at: pin[j] });
    }
    // the cloth at rest (bind space): straight down from the pins, a little wider toward the hem
    this.rest = new Float32Array(n * 3);
    const cx = (sl.x + sr.x) / 2;
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const t = i / (H - 1), k = 3 * (i * W + j), pj = pin[j];
      this.rest[k] = cx + (pj.x - cx) * (1 + look.flare * t); this.rest[k + 1] = pj.y - len * t; this.rest[k + 2] = pj.z - 0.03 * t;
    }
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3);
    // the threads: along and across, the diagonals, every second along (its stiffness)
    const L = (a: number, b: number) => this.links.push([a, b, Math.hypot(this.rest[3 * a] - this.rest[3 * b], this.rest[3 * a + 1] - this.rest[3 * b + 1], this.rest[3 * a + 2] - this.rest[3 * b + 2])]);
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) { const a = i * W + j; if (j < W - 1) L(a, a + 1); if (i < H - 1) L(a, a + W); if (i < H - 1 && j < W - 1) { L(a, a + W + 1); L(a + 1, a + W); } if (i < H - 2) L(a, a + 2 * W); if (j < W - 2) L(a, a + 2); }
    // the body's capsules (bind radii: how far its surface is from the bone between the two joints)
    const segR = (a: string, b: string, pick: (p: THREE.Vector3) => boolean, pct: number) => {
      const A = at(a), B = at(b), ab = B.clone().sub(A), l2 = ab.lengthSq(), ds: number[] = [];
      for (let i = 0; i < P.count; i += 3) { vb.fromBufferAttribute(P, i).applyMatrix4(body.bindMatrix); const t = vb.clone().sub(A).dot(ab) / l2; if (t < 0.1 || t > 0.9 || !pick(vb)) continue; const d = vb.distanceTo(A.clone().addScaledVector(ab, t)); if (d < 0.25) ds.push(d); }
      ds.sort((x, y) => x - y); return ds.length ? ds[Math.floor(ds.length * pct)] : 0.08;
    };
    const cap = (a: string, b: string, r: number) => this.caps.push({ a: idx(a), b: idx(b), r });
    cap('pelvis', 'neck_01', segR('pelvis', 'neck_01', (p) => p.z < nk.z && Math.abs(p.x - cx) < 0.12, 0.93) + 0.016);
    for (const s of ['l', 'r']) {
      cap(`thigh_${s}`, `calf_${s}`, segR(`thigh_${s}`, `calf_${s}`, () => true, 0.75) + 0.006);
      cap(`calf_${s}`, `foot_${s}`, segR(`calf_${s}`, `foot_${s}`, () => true, 0.75) + 0.006);
      cap(`upperarm_${s}`, `lowerarm_${s}`, segR(`upperarm_${s}`, `lowerarm_${s}`, () => true, 0.7) + 0.005);
    }
    this.caps = this.caps.filter((c) => c.a >= 0 && c.b >= 0);
    this.boneM = sk.bones.map(() => new THREE.Matrix4());
    // the mesh: the cloth's outer face and its lining (the same cloth, the other side)
    this.geo = new THREE.BufferGeometry();
    const uv: number[] = [], ix: number[] = [];
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) uv.push(j / (W - 1), i / (H - 1));
    for (let i = 0; i < H - 1; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; ix.push(a, c, b, b, c, d); } // (its front face away from the body)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage)); this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); this.geo.setIndex(ix);
    this.own.push(this.geo);
    const t = tex(256, 512, look.outer); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false; this.own.push(t); // (its top row the cloth's top)
    const outer = new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, side: THREE.FrontSide, alphaTest: look.dagged ? 0.5 : 0 });
    const lining = new THREE.MeshStandardMaterial({ color: look.lining, roughness: 0.9, side: THREE.BackSide, alphaMap: look.dagged ? t : null, alphaTest: look.dagged ? 0.5 : 0 });
    this.own.push(outer, lining);
    for (const m of [outer, lining]) { const x = new THREE.Mesh(this.geo, m); x.frustumCulled = false; x.castShadow = true; h.scene.add(x); this.meshes.push(x); }
  }

  /** A bone's skinning matrix now (its world matrix after its bind's inverse). */
  private skinM(i: number): THREE.Matrix4 { const sk = this.h.body.skeleton; return this.boneM[i].multiplyMatrices(sk.bones[i].matrixWorld, sk.boneInverses[i]); }
  private pinAt(j: number, out: THREE.Vector3): THREE.Vector3 {
    const b = this.pinB[j]; out.set(0, 0, 0);
    for (let k = 0; k < b.b.length; k++) { if (b.b[k] < 0 || !b.w[k]) continue; Cloak.v2.copy(b.at).applyMatrix4(this.skinM(b.b[k])); out.addScaledVector(Cloak.v2, b.w[k]); }
    return out;
  }
  /** The world's scale of the body (its skinning's): the cloth's lengths and the capsules' radii with it. */
  private scaleNow(): number { const i = this.pinB[0].b[0]; const m = this.skinM(i).elements; return Math.hypot(m[0], m[1], m[2]); }

  /** Laid out at rest where the body is now (on first use, after a jump across the room). */
  private place(): void {
    const sk = this.h.body.skeleton, M = this.skinM(sk.bones.findIndex((b) => b.name === 'spine_03'));
    for (let i = 0; i < this.W * this.Hn; i++) { Cloak.v.fromArray(this.rest, 3 * i).applyMatrix4(M); Cloak.v.toArray(this.p, 3 * i); Cloak.v.toArray(this.q, 3 * i); }
    this.fresh = false; this.hasPrev = false;
  }

  step(ms: number): void {
    this.h.root.updateMatrixWorld(true);
    const pin0 = this.pinAt(0, new THREE.Vector3());
    if (this.fresh || pin0.distanceTo(Cloak.v.fromArray(this.p, 0)) > 0.6) this.place();
    this.acc = Math.min(this.acc + ms, 70);
    let n = 0; while (this.acc >= 16.67 && n < 4) { this.sim(1 / 60); this.acc -= 16.67; n++; }
    this.normals();
  }
  settle(): void { this.h.root.updateMatrixWorld(true); this.place(); for (let i = 0; i < 90; i++) this.sim(1 / 60, 0.9); this.normals(); }

  private sim(dt: number, damp = 0.985): void {
    const W = this.W, N = W * this.Hn, p = this.p, q = this.q, s = this.scaleNow(), g = -11.2 * s * dt * dt;
    // the pins: where the shoulders carry them (how fast they go: the wind of the run)
    const mid = 3 * (W >> 1), ox = p[mid], oy = p[mid + 1], oz = p[mid + 2];
    for (let j = 0; j < W; j++) { this.pinAt(j, Cloak.v); Cloak.v.toArray(p, 3 * j); Cloak.v.toArray(q, 3 * j); }
    const dx = p[mid] - ox, dy = p[mid + 1] - oy, dz = p[mid + 2] - oz;
    const sp = Math.min(1, Math.hypot(dx, dz) / dt / (2.2 * s)); this.wind += (sp - this.wind) * 0.08; this.tw += dt;
    // faster than a run (a dash, a leap, a turn on the spot, a double's darting): the cloth carried along with the back
    // (moved and turned as the upper spine moved and turned this step), not left streaming behind like a flag
    const M = this.skinM(this.pinB[0].b[0]), e = M.elements, f = this.prevM.elements;
    const turn = this.hasPrev ? Math.acos(Math.min(1, (e[8] * f[8] + e[10] * f[10]) / (Math.hypot(e[8], e[10]) * Math.hypot(f[8], f[10]) || 1))) / dt : 0; // (how fast the back turns round: rad/s)
    const carry = Math.min(0.9, Math.max(0, (Math.hypot(dx, dy, dz) / dt - 9 * s) / (10 * s), (turn - 5) / 6)); // (a run's sway and bob stay under both)
    if (carry > 0 && this.hasPrev) {
      const D = Cloak.D.copy(this.prevM).invert().premultiply(M), v = Cloak.v, v2 = Cloak.v2;
      for (let i = W; i < N; i++) {
        v.fromArray(p, 3 * i); v2.copy(v).applyMatrix4(D); v.lerp(v2, carry).toArray(p, 3 * i);
        v.fromArray(q, 3 * i); v2.copy(v).applyMatrix4(D); v.lerp(v2, carry).toArray(q, 3 * i);
      }
    }
    this.prevM.copy(M); this.hasPrev = true;
    // the rest: their momentum and their weight; in the wind a ripple runs down the cloth (up and down, stronger toward the hem)
    for (let i = W; i < N; i++) {
      const k = 3 * i, row = Math.floor(i / W), col = i % W, fl = this.wind * 0.0016 * s * (row / this.Hn) * Math.sin(this.tw * 11 - row * 0.9 + col * 0.55);
      for (let c = 0; c < 3; c++) { const x = p[k + c], v = (x - q[k + c]) * damp; q[k + c] = x; p[k + c] = x + v + (c === 1 ? g + fl : 0); }
    }
    const sk = this.h.body.skeleton, A = new THREE.Vector3(), B = new THREE.Vector3(), X = new THREE.Vector3(), C = new THREE.Vector3();
    const capsW = this.caps.map((c) => ({ a: A.clone().setFromMatrixPosition(sk.bones[c.a].matrixWorld), b: B.clone().setFromMatrixPosition(sk.bones[c.b].matrixWorld), r: c.r * s }));
    // the back's plane: through the spine (the pelvis to the neck, on down past the hips), facing the way the chest faces —
    // the cloth stays behind it (never caught round the body in front after a fall or a roll)
    const t0 = capsW[0], fwd = Cloak.f.set(0, 0, 1).transformDirection(this.skinM(this.pinB[0].b[0])), axis = Cloak.ax.subVectors(t0.b, t0.a).normalize(), off = t0.r * 0.85;
    fwd.addScaledVector(axis, -fwd.dot(axis)).normalize();
    for (let it = 0; it < 6; it++) {
      for (const [a, b, l0] of this.links) {
        const ka = 3 * a, kb = 3 * b, dx = p[kb] - p[ka], dy = p[kb + 1] - p[ka + 1], dz = p[kb + 2] - p[ka + 2], d = Math.hypot(dx, dy, dz) || 1e-6, L = l0 * s;
        if (d <= L && l0 > 0 && (b - a === 2 || b - a === 2 * W)) continue; // (bending springs only resist stretching: the cloth folds)
        const f = (d - L) / d, wa = a < W ? 0 : 1, wb = b < W ? 0 : 1, sw = wa + wb; if (!sw) continue;
        p[ka] += dx * f * (wa / sw); p[ka + 1] += dy * f * (wa / sw); p[ka + 2] += dz * f * (wa / sw);
        p[kb] -= dx * f * (wb / sw); p[kb + 1] -= dy * f * (wb / sw); p[kb + 2] -= dz * f * (wb / sw);
      }
      // off the body
      for (let i = W; i < N; i++) {
        X.fromArray(p, 3 * i);
        for (const c of capsW) {
          const ab = C.subVectors(c.b, c.a), t = THREE.MathUtils.clamp(Cloak.v.subVectors(X, c.a).dot(ab) / Math.max(1e-9, ab.lengthSq()), 0, 1);
          const near = Cloak.v2.copy(c.a).addScaledVector(ab, t), d = X.distanceTo(near);
          if (d < c.r && d > 1e-6) X.sub(near).multiplyScalar(c.r / d).add(near);
        }
        const along = Cloak.v.subVectors(X, t0.a).dot(axis), d = Cloak.v.subVectors(X, t0.a).addScaledVector(axis, -along).dot(fwd);
        if (d > -off) X.addScaledVector(fwd, -(d + off));
        if (X.y < 0.006) X.y = 0.006;
        X.toArray(p, 3 * i);
      }
    }
  }
  private normals(): void {
    const W = this.W, H = this.Hn, p = this.p, n = this.geo.attributes.normal as THREE.BufferAttribute, a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const k = i * W + j, l = i * W + Math.max(0, j - 1), r = i * W + Math.min(W - 1, j + 1), u = Math.max(0, i - 1) * W + j, d = Math.min(H - 1, i + 1) * W + j;
      a.set(p[3 * r] - p[3 * l], p[3 * r + 1] - p[3 * l + 1], p[3 * r + 2] - p[3 * l + 2]); b.set(p[3 * d] - p[3 * u], p[3 * d + 1] - p[3 * u + 1], p[3 * d + 2] - p[3 * u + 2]);
      b.cross(a).normalize(); n.setXYZ(k, b.x, b.y, b.z);
    }
    n.needsUpdate = true; (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; this.geo.computeBoundingSphere();
  }
  dispose(): void { for (const m of this.meshes) m.removeFromParent(); for (const o of this.own) o.dispose(); }
}

// =============================================================================================== the aura
class Aura {
  readonly g = new THREE.Group();
  private own: { dispose(): void }[] = [];
  private pts: THREE.Points; private life: Float32Array; private seed: Float32Array; private ring: THREE.Mesh; private col: THREE.Sprite; private t = 0;
  constructor(private h: WearHost, readonly id: string, private look: AuraLook) {
    const ringT = tex(256, 256, look.ring), sprT = tex(64, 64, look.sprite), n = look.n;
    this.own.push(ringT, sprT);
    const rm = new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, opacity: 0.85 });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), rm); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.012; this.ring.renderOrder = 1;
    const colT = tex(64, 128, (c, w, hh) => { // (soft on every side: brightest low in the middle)
      const img = c.createImageData(w, hh); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const u = (x + 0.5) / w * 2 - 1, v = 1 - (y + 0.5) / hh, a = Math.pow(Math.max(0, 1 - u * u), 1.6) * Math.pow(1 - v, 1.4) * (0.35 + 0.65 * Math.min(1, v * 8)); const q = 4 * (y * w + x); img.data[q] = img.data[q + 1] = img.data[q + 2] = 255; img.data[q + 3] = Math.round(255 * a); } c.putImageData(img, 0, 0); });
    const cm = new THREE.SpriteMaterial({ map: colT, color: look.col, transparent: true, depthWrite: false, opacity: 0.4 });
    const sp = new THREE.Sprite(cm); sp.center.set(0.5, 0); sp.scale.set(0.95, 1.5, 1); sp.renderOrder = 2; this.col = sp;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    const pm = new THREE.PointsMaterial({ map: sprT, size: look.size, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true });
    this.pts = new THREE.Points(geo, pm); this.pts.frustumCulled = false; this.pts.renderOrder = 3;
    this.own.push(rm, cm, pm, geo, this.ring.geometry, colT);
    this.life = new Float32Array(n).map((_, i) => i / n); this.seed = new Float32Array(n * 3).map(() => Math.random());
    this.g.add(this.ring, this.col, this.pts); h.root.add(this.g);
  }
  step(ms: number): void {
    const L = this.look, dt = ms / 1000, n = L.n, P = this.pts.geometry.attributes.position as THREE.BufferAttribute, Cc = this.pts.geometry.attributes.color as THREE.BufferAttribute;
    this.t += dt; this.ring.rotation.z += dt * L.spin * 0.6; (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.15 * Math.sin(this.t * 3.1);
    this.col.material.opacity = 0.3 + 0.1 * Math.sin(this.t * 2.3);
    const c1 = new THREE.Color(L.col), c2 = new THREE.Color(L.col2), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.life[i] += dt / (1.8 + this.seed[3 * i] * 1.4); if (this.life[i] >= 1) { this.life[i] -= 1; this.seed[3 * i + 1] = Math.random(); this.seed[3 * i + 2] = Math.random(); }
      const t = this.life[i], a = this.seed[3 * i + 1] * Math.PI * 2 + this.t * L.spin * (0.6 + this.seed[3 * i]), r = 0.18 + 0.3 * this.seed[3 * i + 2] + (L.fall ? 0.1 * Math.sin(t * 6 + i) : 0);
      const y = L.rise >= 0 ? t * 1.55 * (0.7 + 0.5 * this.seed[3 * i]) : 1.7 - t * 1.6;
      P.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
      const fade = Math.sin(Math.min(1, t) * Math.PI); c.copy(c1).lerp(c2, this.seed[3 * i + 2]); Cc.setXYZW(i, c.r, c.g, c.b, fade * 0.95);
    }
    P.needsUpdate = true; Cc.needsUpdate = true;
  }
  dispose(): void { this.g.removeFromParent(); for (const o of this.own) o.dispose(); }
}
