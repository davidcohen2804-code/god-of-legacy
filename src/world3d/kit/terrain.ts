// The island's stonework and scenery as pieces for a map's Parts (merged per material): the terrace slab with its front
// wall, balustrades, walls with pilasters and a cornice, stairs, round towers, the blocks you jump on, urns; and the
// things that stand on their own: ivy over the parapets, the far mountains and falls in the haze, mist, the sun rune.
import * as THREE from 'three';
import { Parts, box, cyl, lathe, worldUV } from '../../arena3d/RoomKit';
import type { Disposable } from './units';

/** The terrace: its top slab (the walkable paving is the place's ground plane; this is the slab's body and its front wall
 *  dropping to the valley), a moulding under the lip and buttresses down the face. */
export function terraceSlab(P: Parts, x0: number, x1: number, zB: number, zF: number, y: number, drop: number, mat = 'wall'): void {
  const w = x1 - x0, d = zF - zB;
  P.add(mat, box(w, drop, d, (x0 + x1) / 2, y - drop, (zB + zF) / 2, 1.3));
  P.add('moulding', box(w + 0.1, 0.14, 0.18, (x0 + x1) / 2, y - 0.14, zF + 0.04, 1, 0.03));
  P.add('moulding', box(w + 0.1, 0.1, 0.12, (x0 + x1) / 2, y - 0.9, zF + 0.02, 1, 0.02));
  for (let x = x0 + 2; x < x1 - 1; x += 4) P.add(mat, box(0.5, drop - 0.3, 0.35, x, y - drop, zF + 0.12, 1.3, 0.02));
}

/** A balustrade along the front edge: posts with caps, a rail and a plinth, turned balusters between. `gaps` leave
 *  openings (x ranges) for stairs. */
export function balustrade(P: Parts, x0: number, x1: number, y: number, z: number, o: { h?: number; post?: number; gaps?: [number, number][]; mat?: string } = {}): void {
  const h = o.h ?? 1.0, every = o.post ?? 1.6, mat = o.mat ?? 'balustrade', gaps = o.gaps ?? [];
  const inGap = (x: number) => gaps.some(([a, b]) => x > a && x < b);
  const n = Math.max(1, Math.round((x1 - x0) / every));
  const posts: number[] = []; for (let i = 0; i <= n; i++) posts.push(x0 + ((x1 - x0) * i) / n);
  for (const x of posts) { P.add(mat, box(0.22, h, 0.22, x, y, z, 1, 0.02), box(0.3, 0.08, 0.3, x, y + h, z, 1, 0.02)); P.add('gold', lathe([[0, 0], [0.06, 0], [0.08, 0.04], [0.05, 0.1], [0.02, 0.15], [0, 0.17]], x, y + h + 0.08, z, 10)); }
  for (let i = 0; i < n; i++) {
    const a = posts[i], b = posts[i + 1], m = (a + b) / 2; if (inGap(m)) continue;
    P.add(mat, box(b - a - 0.22, 0.09, 0.2, m, y + h - 0.12, z, 1, 0.02), box(b - a - 0.22, 0.1, 0.22, m, y, z, 1, 0.02));
    const k = Math.max(1, Math.round((b - a) / 0.3));
    for (let j = 1; j < k; j++) P.add(mat, lathe([[0.03, 0], [0.055, 0.04], [0.04, 0.15], [0.065, 0.3], [0.05, 0.45], [0.035, 0.6], [0.05, 0.68], [0.03, 0.78]], a + ((b - a) * j) / k, y + 0.1, z, 8));
  }
}

/** A wall behind the floor: ashlar with pilasters every few units, a cornice along its top, a plinth at its foot. */
export function wallRun(P: Parts, x0: number, x1: number, y: number, h: number, z: number, o: { thick?: number; pilasterEvery?: number; mat?: string; cornice?: boolean } = {}): void {
  const t = o.thick ?? 0.8, mat = o.mat ?? 'wall', w = x1 - x0, cx = (x0 + x1) / 2;
  P.add(mat, box(w, h, t, cx, y, z - t / 2, 1.3));
  P.add('moulding', box(w + 0.1, 0.22, 0.14, cx, y, z + 0.04, 1, 0.02));
  if (o.cornice !== false) P.add('moulding', box(w + 0.2, 0.18, t + 0.25, cx, y + h - 0.18, z - t / 2 + 0.06, 1, 0.03), box(w + 0.1, 0.1, t + 0.1, cx, y + h - 0.34, z - t / 2 + 0.03, 1, 0.02));
  const every = o.pilasterEvery ?? 3.2;
  for (let x = x0 + every / 2; x < x1; x += every) P.add(mat, box(0.5, h - 0.34, 0.22, x, y, z + 0.08, 1.3, 0.02), box(0.62, 0.12, 0.3, x, y + h - 0.46, z + 0.1, 1, 0.02));
}

/** A stair rising away from the camera (toward -z) from its foot at (cx, zFoot, y). */
export function stair(P: Parts, cx: number, zFoot: number, y: number, width: number, steps: number, rise: number, tread: number, mat = 'balustrade'): { top: number; zTop: number } {
  const zTop = zFoot - steps * tread;
  for (let k = 1; k <= steps; k++) P.add(mat, box(width, k * rise, (steps - k + 1) * tread, cx, y, zTop + ((steps - k + 1) * tread) / 2, 1.1, 0.02));
  // (each step a box from the top end forward: the k-th stands k·rise high and reaches (steps−k+1)·tread toward the foot — the tallest the shortest)
  return { top: y + steps * rise, zTop };
}

/** A round tower with a conical roof, slits, a cap. */
export function tower(P: Parts, x: number, z: number, y: number, r: number, h: number, mat = 'wall'): void {
  P.add(mat, cyl(r * 1.08, r, 0.6, x, y, z, 24, 1.3), cyl(r, r, h, x, y + 0.6, z, 24, 1.3), cyl(r * 1.12, r * 1.12, 0.35, x, y + h + 0.6, z, 24, 1.3));
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; P.add(mat, box(0.26, 0.5, 0.26, x + Math.cos(a) * r * 1.08, y + h + 0.95, z + Math.sin(a) * r * 1.08, 1)); } // crenels
  for (let k = 0; k < 3; k++) { const a = Math.PI * 0.35 + k * 0.5; P.add('dark', box(0.12, 0.7, 0.12, x + Math.cos(a) * (r + 0.01), y + h * 0.55, z + Math.sin(a) * (r + 0.01), 1)); } // slits
  const roof = new THREE.ConeGeometry(r * 1.05, r * 1.6, 24, 1); roof.translate(x, y + h + 0.95 + (r * 1.6) / 2, z); worldUV(roof, 1.25); P.add('roof', roof);
  P.add('gold', cyl(0.05, 0.02, 0.9, x, y + h + 0.95 + r * 1.6 - 0.1, z, 8));
}

/** A stone block you jump on: a bevelled box, its top worn (a lighter stone), a seam of moss at its foot. */
export function block(P: Parts, x0: number, x1: number, z0: number, z1: number, y: number, h: number, mat = 'balustrade'): void {
  P.add(mat, box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, 1.1, 0.04));
  P.add('paving', box(x1 - x0 - 0.06, 0.03, z1 - z0 - 0.06, (x0 + x1) / 2, y + h - 0.01, (z0 + z1) / 2, 1.1, 0.01));
}

/** An urn on a plinth, with a lip and a foot. */
export function urn(P: Parts, x: number, y: number, z: number, s = 1, mat = 'terracotta'): void {
  P.add('balustrade', box(0.6 * s, 0.14 * s, 0.6 * s, x, y, z, 1, 0.02));
  P.add(mat, lathe([[0.12, 0], [0.2, 0.02], [0.16, 0.12], [0.3, 0.32], [0.36, 0.55], [0.3, 0.74], [0.24, 0.82], [0.3, 0.86], [0.3, 0.92], [0.22, 0.92], [0.2, 0.8], [0.18, 0.78]].map(([r, h]) => [r * s, h * s + 0.14 * s] as [number, number]), x, y, z, 18));
}

/** Ivy: leaf clumps hung along a line (over a parapet, down a wall), swaying a little; one instanced draw. */
export function ivyRun(scene: THREE.Scene, tex: THREE.Texture, spots: { x: number; y: number; z: number; drop: number; s: number }[], R: () => number, color = 0xffffff): Disposable & { update(t: number, wind: number): void } {
  const n = spots.length, g = new THREE.PlaneGeometry(1, 1), mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color });
  const uTime = { value: 0 }, uWind = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'attribute vec2 uvOff;\nuniform float uTime;\nuniform float uWind;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * 0.5 + uvOff;\n#endif')
      .replace('#include <project_vertex>', 'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nmvPosition = instanceMatrix * mvPosition;\n#endif\n'
        + 'float hang = clamp(0.5 - uv.y, 0.0, 1.0); mvPosition.x += sin(uTime * 1.3 + mvPosition.x * 1.7 + mvPosition.z) * 0.03 * hang * uWind;\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;');
  };
  const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, n)), uvOff = new Float32Array(n * 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const s = spots[i]; e.set((R() - 0.5) * 0.4, (R() - 0.5) * 0.6, (R() - 0.5) * 0.3); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, s.y - s.drop / 2, s.z), q, new THREE.Vector3(s.s, s.drop, 1)); mesh.setMatrixAt(i, m4);
    const v = (R() * 4) | 0; uvOff[i * 2] = (v % 2) * 0.5; uvOff[i * 2 + 1] = (v >> 1) * 0.5;
  }
  g.setAttribute('uvOff', new THREE.InstancedBufferAttribute(uvOff, 2));
  mesh.castShadow = false; mesh.computeBoundingSphere(); scene.add(mesh);
  return { update: (t, wind) => { uTime.value = t; uWind.value = wind; }, dispose: () => { scene.remove(mesh); g.dispose(); mat.dispose(); } };
}

/** The far mountains in the haze: ranges of cones, nearer ones darker and bluer, with snow on the high ones; a far
 *  castle on a peak; falls as pale strips down the nearest range. */
export function farMountains(scene: THREE.Scene, cx: number, z: number, R: () => number, o: { ranges?: number; color?: number; span?: number; yBase?: number; hScale?: number } = {}): Disposable {
  const ranges = o.ranges ?? 3, span = o.span ?? 140, yBase = o.yBase ?? -4, hs = o.hScale ?? 1, out: Disposable[] = []; // (`yBase`: where the peaks' feet are; `hScale`: lower ranges, seen from a height)
  for (let r = 0; r < ranges; r++) {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color ?? 0x7a5a6a).lerp(new THREE.Color(0xd8b8c8), r / ranges), roughness: 1, fog: true }); out.push(mat);
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9 + r * 3; i++) {
      const h = (12 + R() * 14 + r * 7) * hs, rad = 11 + R() * 13 + r * 5, g = new THREE.ConeGeometry(rad, h, 7, 1);
      g.translate(cx - span / 2 + (span * i) / (8 + r * 3) + (R() - 0.5) * 8, h / 2 + yBase, z - 20 - r * 26 - R() * 10);
      geos.push(g);
    }
    for (const g of geos) { const m = new THREE.Mesh(g, mat); m.rotation.y = R() * 3; scene.add(m); out.push(g); }
  }
  return { dispose: () => { for (const d of out) d.dispose(); } };
}

/** The sun rune set into the paving: a gilt disc and rays, a decal lying on the floor. */
export function sunRune(scene: THREE.Scene, x: number, y: number, z: number, r: number): Disposable {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.translate(128, 128); g.strokeStyle = 'rgba(214,170,80,0.9)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(214,170,80,0.85)'; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, L = i % 2 ? 70 : 84; g.beginPath(); g.moveTo(Math.cos(a - 0.08) * 40, Math.sin(a - 0.08) * 40); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.08) * 40, Math.sin(a + 0.08) * 40); g.fill(); }
  g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(120,70,30,0.7)'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const geo = new THREE.PlaneGeometry(r * 2, r * 2); const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.006, z); m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
  return { dispose: () => { scene.remove(m); geo.dispose(); mat.dispose(); tex.dispose(); } };
}

/** Contact shade decals where things meet the ground (an AO blot under each spot). */
export function contactShade(scene: THREE.Scene, tex: THREE.Texture, spots: { x: number; y: number; z: number; sx: number; sz: number }[]): Disposable {
  const geos: THREE.BufferGeometry[] = [];
  for (const s of spots) { const g = new THREE.PlaneGeometry(s.sx, s.sz); g.rotateX(-Math.PI / 2); g.translate(s.x, s.y + 0.004, s.z); geos.push(g); }
  const merged = mergeGeos(geos); for (const g of geos) g.dispose();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const m = new THREE.Mesh(merged, mat); m.renderOrder = 1; scene.add(m);
  return { dispose: () => { scene.remove(m); merged.dispose(); mat.dispose(); } };
}

function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []; let base = 0;
  for (const g of geos) {
    const p = g.attributes.position, u = g.attributes.uv, ix = g.index!;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx); out.computeVertexNormals();
  return out;
}

/** An ivy clump atlas (2 × 2): heart-shaped leaves in autumn reds and greens hanging in a loose mass. */
export function ivyCanvas(colors: string[], seed = 2): HTMLCanvasElement {
  let s = seed >>> 0; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  const leaf = (x: number, y: number, r: number, rot: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(-r, r * 0.2, -r * 1.1, -r * 0.6, 0, -r * 0.35); g.bezierCurveTo(r * 1.1, -r * 0.6, r, r * 0.2, 0, r); g.fill();
    g.strokeStyle = 'rgba(40,20,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, r); g.lineTo(0, -r * 0.3); g.stroke(); g.restore();
  };
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 256, oy = (cell >> 1) * 256;
    for (let i = 0; i < 70; i++) { const x = ox + 40 + R() * 176, y = oy + 20 + Math.pow(R(), 0.8) * 220, r = 9 + R() * 11; leaf(x, y, r, (R() - 0.5) * 1.2, colors[(R() * colors.length) | 0]); }
  }
  return c;
}
