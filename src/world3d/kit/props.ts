// Props the world's places share (Kit B / C / D…): posts, lantern cords and warm lights, halos, mossy boulders, logs and
// stumps, glowcaps, the Elder Tree's roots, chimney smoke, falling water, still-water strips, ferns. Each takes the
// builder's context (a dressing's `DressCtx` is one) and adds to its Parts, its scene and its life.
import * as THREE from 'three';
import type { Parts } from '../../arena3d/RoomKit';
import { box, cyl, lathe, taperTube, canvasTex, glowCanvas } from '../../arena3d/RoomKit';
import type { Life, Wind } from '../life/kit';
import { Puffs, tex as lifeTex, smokeCanvas, canvas as mkCanvas } from '../life/kit';
import { paperLanterns } from '../life/lanterns';
import { pond } from '../life/pond';
import type { Disposable } from './units';

/** What a prop needs of the place that builds it. */
export interface PropCtx {
  P: Parts; scene: THREE.Scene; M: Record<string, THREE.Material>;
  R: () => number; life: Life[]; air: Wind; soft: boolean;
  std(o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
  sway: ((t: number, wind: number) => void)[]; disposables: Disposable[];
  warm: THREE.PointLight[]; sunDir: THREE.Vector3;
}

/** A dark post (wood). */
export const post = (c: PropCtx, x: number, y: number, z: number, h: number, w = 0.14) => c.P.add('wood', box(w, h, w, x, y, z, 0.5));

/** A cord slung between two points (a shallow catenary), paper lanterns hanging from it at `at` (fractions along it);
 *  the lanterns are the kit's (they swing); the first `lit` of them carry a real warm light. */
export function lanternCord(c: PropCtx, a: THREE.Vector3, b: THREE.Vector3, at: number[], o: { sag?: number; lit?: number; color?: number; glow?: number; seed?: number } = {}): THREE.Vector3[] {
  const sag = o.sag ?? 0.35, curve = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map((k) => new THREE.Vector3().lerpVectors(a, b, k).add(new THREE.Vector3(0, -Math.sin(Math.PI * k) * sag, 0))));
  c.P.add('dark', new THREE.TubeGeometry(curve, 14, 0.018, 5));
  const pts = at.map((k) => curve.getPointAt(k));
  c.life.push(paperLanterns(c.scene, pts.map((p) => ({ x: p.x, y: p.y - 0.02, z: p.z })), { wind: c.air, seed: o.seed ?? 41, drop: 0.14, color: o.color ?? 0xf2d8a8, glow: o.glow ?? 0xffb060 }));
  for (const p of pts.slice(0, o.lit ?? 0)) warmLight(c, p.x, p.y - 0.4, p.z, 2.2, 8);
  return pts;
}

/** A warm point light the kit flickers (the lanterns and windows are the dusk's main light: a few per map). */
export function warmLight(c: PropCtx, x: number, y: number, z: number, intensity = 2.0, distance = 8, color = 0xffa050): THREE.PointLight {
  const L = new THREE.PointLight(color, intensity, distance, 2); L.position.set(x, y, z); c.scene.add(L); c.warm.push(L); return L;
}

/** A glow sprite (a lamp's halo, a window's spill). */
export function halo(c: PropCtx, x: number, y: number, z: number, s: number, color: number, opacity = 0.6): THREE.Sprite {
  const t = canvasTex(glowCanvas()); c.disposables.push(t);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.position.set(x, y, z); sp.scale.set(s, s, 1); c.scene.add(sp); c.disposables.push(sp.material); return sp;
}

/** A mossy boulder: a flattened, slightly turned stone with a mossy top. */
export function boulder(c: PropCtx, x: number, z: number, w: number, d: number, h: number): void {
  const g = new THREE.DodecahedronGeometry(1, 1); g.scale(w / 2, h, d / 2); g.rotateY(c.R() * 3); g.translate(x, 0, z); c.P.add('wall', g);
  const m = new THREE.DodecahedronGeometry(1, 1); m.scale(w / 2.4, h * 0.18, d / 2.4); m.rotateY(c.R() * 3); m.translate(x, h * 0.86, z); c.P.add(c.M.moss ? 'moss' : 'balustrade', m);
}

/** A fallen log lying along x (its ends sawn), walkable at its height. */
export function log(c: PropCtx, x0: number, x1: number, z: number, h: number): void {
  const r = h / 2, g = cyl(r, r, x1 - x0, 0, 0, 0, 14, 1); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, r, z); c.P.add('bark', g);
  const m = new THREE.CylinderGeometry(r * 0.7, r * 0.7, (x1 - x0) * 0.6, 10, 1, true); m.rotateZ(Math.PI / 2); m.scale(1, 1.08, 0.6); m.translate((x0 + x1) / 2, r + r * 0.4, z); c.P.add(c.M.moss ? 'moss' : 'balustrade', m);
}

/** A tree stump: a flared trunk cut flat, its rings pale. */
export function stump(c: PropCtx, x: number, z: number, w: number, h: number): void {
  c.P.add('bark', lathe([[w * 0.3, 0], [w * 0.5, 0], [w * 0.42, h * 0.25], [w * 0.4, h], [w * 0.36, h]], x, 0, z, 14));
  c.P.add('moulding', cyl(w * 0.36, w * 0.36, 0.03, x, h - 0.01, z, 14));
}

/** Glowcaps: clusters of mushrooms with lit blue-violet caps, a soft halo over each cluster. */
export function glowcaps(c: PropCtx, spots: { x: number; z: number; y?: number }[], glow = 0x7a9aff): void {
  const cap = c.std({ color: 0x8aa0ff, emissive: glow, emissiveIntensity: 1.3, roughness: 0.6 }), stem = c.std({ color: 0xd8d0e8, roughness: 0.9 });
  const capG = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stemG = new THREE.CylinderGeometry(0.3, 0.4, 1, 8);
  const n = spots.length * 5, caps = new THREE.InstancedMesh(capG, cap, n), stems = new THREE.InstancedMesh(stemG, stem, n), m4 = new THREE.Matrix4(); let i = 0;
  for (const s of spots) {
    for (let k = 0; k < 5; k++) { const r = 0.06 + c.R() * 0.09, h = 0.1 + c.R() * 0.16, px = s.x + (c.R() - 0.5) * 0.7, pz = s.z + (c.R() - 0.5) * 0.5, y = s.y ?? 0;
      m4.compose(new THREE.Vector3(px, y + h / 2, pz), new THREE.Quaternion(), new THREE.Vector3(r * 0.5, h, r * 0.5)); stems.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(px, y + h, pz), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.6, r)); caps.setMatrixAt(i, m4); i++; }
    halo(c, s.x, (s.y ?? 0) + 0.25, s.z, 1.1, glow, 0.35);
  }
  caps.count = i; stems.count = i; c.scene.add(caps, stems); c.disposables.push(capG, stemG);
}

/** The Elder Tree's roots: great tapered tubes that come out of the ground, arch over it and go back in. */
export function roots(c: PropCtx, list: { x: number; z: number; len: number; dir: number; r: number; lift: number }[]): void {
  for (const r of list) {
    const pts = [new THREE.Vector3(r.x, -0.3, r.z), new THREE.Vector3(r.x + r.len * 0.3 * r.dir, r.lift, r.z + 0.2), new THREE.Vector3(r.x + r.len * 0.7 * r.dir, r.lift * 0.8, r.z + 0.5), new THREE.Vector3(r.x + r.len * r.dir, -0.3, r.z + 0.8)];
    c.P.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), r.r, r.r * 0.55, 10, 8, 0.6));
  }
}

/** A thread of smoke from a chimney (the kit's puffs), stepped by the dressing's sway hook. */
export function chimneySmoke(c: PropCtx, at: { x: number; y: number; z: number }[]): void {
  const smoke = new Puffs(c.soft ? 40 : 90, lifeTex(smokeCanvas(4)), false); c.scene.add(smoke.pts); c.disposables.push(smoke);
  let acc = 0;
  c.sway.push((t, w) => {
    acc += 1 / 60 * 6;
    while (acc >= 1) { acc -= 1; const p = at[(c.R() * at.length) | 0]; smoke.emit(p.x + (c.R() - 0.5) * 0.1, p.y, p.z + (c.R() - 0.5) * 0.1, (c.R() - 0.5) * 0.05 + c.air.x * 0.2, 0.22 + c.R() * 0.1, (c.R() - 0.5) * 0.05, 0x9a8aa0, 0.1 + c.R() * 0.06, 4500 + c.R() * 2000, { a: 0.14, grow: 0.12, drag: 0.6 }); }
    smoke.push((c.air.x * 0.1 + Math.max(0, w - 1) * 0.3) / 60, 0, 0); smoke.step(1000 / 60, 0.05, t);
  });
}

/** Falling water: a tall sheet of streaked white, scrolling down, with mist at its foot. */
export function waterfall(c: PropCtx, x: number, yTop: number, yFoot: number, z: number, w: number): void {
  const cv = mkCanvas(128, 512, (g) => { g.clearRect(0, 0, 128, 512); // ropes of water with dark gaps between them, a few bright threads
    for (let i = 0; i < 26; i++) { const px = (i / 26) * 128 + Math.random() * 5, wdt = 2 + Math.random() * 6, a = 0.25 + Math.random() * 0.45; const gr = g.createLinearGradient(px - wdt / 2, 0, px + wdt / 2, 0); gr.addColorStop(0, 'rgba(230,236,255,0)'); gr.addColorStop(0.5, `rgba(240,244,255,${a})`); gr.addColorStop(1, 'rgba(230,236,255,0)'); g.fillStyle = gr; g.fillRect(px - wdt / 2, 0, wdt, 512); }
    for (let i = 0; i < 40; i++) { const px = Math.random() * 128, y0 = Math.random() * 512, len = 30 + Math.random() * 120; g.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; g.lineWidth = 1 + Math.random() * 1.5; g.beginPath(); g.moveTo(px, y0); g.lineTo(px + (Math.random() - 0.5) * 3, y0 + len); g.stroke(); } });
  const t = lifeTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 1.4, (yTop - yFoot) / 4.5); c.disposables.push(t);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, color: 0xe4ecff, fog: true }); c.disposables.push(m);
  const g = new THREE.PlaneGeometry(w, yTop - yFoot); g.translate(x, (yTop + yFoot) / 2, z); c.disposables.push(g);
  const mesh = new THREE.Mesh(g, m); c.scene.add(mesh);
  const mist = new Puffs(c.soft ? 30 : 70, lifeTex(smokeCanvas(6)), false); c.scene.add(mist.pts); c.disposables.push(mist);
  let acc = 0;
  c.sway.push((tt) => {
    t.offset.y = (t.offset.y + 1.1 / 60) % 1; acc += 1 / 60 * 10;
    while (acc >= 1) { acc -= 1; mist.emit(x + (c.R() - 0.5) * w, yFoot + 0.1, z + 0.2 + c.R() * 0.8, (c.R() - 0.5) * 0.4, 0.3 + c.R() * 0.4, 0.2 + c.R() * 0.3, 0xe8e8ff, 0.5 + c.R() * 0.5, 2600 + c.R() * 1600, { a: 0.16, grow: 0.5, drag: 0.5 }); }
    mist.step(1000 / 60, 0.1, tt);
  });
}

/** Still-water strip (the brook, the river): the kit's pond without its rim, no mirror (a long surface). */
export function water(c: PropCtx, x: number, z: number, w: number, d: number, y: number, pads: number, mirror = false): void {
  c.life.push(pond(c.scene, { x, z, w, d, y }, { wind: c.air, stone: c.M.balustrade, mirror, sunDir: c.sunDir, sunColor: new THREE.Color(0xa8bcff), skyLow: new THREE.Color(0xe8a898), skyMid: new THREE.Color(0x9a5a84), koi: 0, pads, rim: false, seed: 17 }));
}

/** Ferns: a few upright painted fronds at the roots' feet (one instanced draw). */
export function ferns(c: PropCtx, spots: { x: number; z: number }[]): void {
  const cv = mkCanvas(128, 128, (g) => { g.clearRect(0, 0, 128, 128); for (let f = 0; f < 7; f++) { const a = -Math.PI / 2 + (f - 3) * 0.32; g.strokeStyle = f % 2 ? '#3f6a3a' : '#527f48'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 126); g.quadraticCurveTo(64 + Math.cos(a) * 40, 126 + Math.sin(a) * 70, 64 + Math.cos(a) * 60, 126 + Math.sin(a) * 110); g.stroke(); for (let k = 1; k < 9; k++) { const px = 64 + Math.cos(a) * 60 * (k / 9), py = 126 + Math.sin(a) * 110 * (k / 9); g.lineWidth = 2; g.beginPath(); g.moveTo(px - 7, py + 3); g.lineTo(px + 7, py + 3); g.stroke(); } } });
  const t = lifeTex(cv); c.disposables.push(t);
  const g = new THREE.PlaneGeometry(1, 1), m = c.std({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, color: 0xc8d8c0 });
  const mesh = new THREE.InstancedMesh(g, m, spots.length * 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let i = 0;
  for (const s of spots) for (let k = 0; k < 2; k++) { const sc = 0.5 + c.R() * 0.4; q.setFromEuler(new THREE.Euler(0, (c.R() - 0.5) * 1.2 + k * 1.2, 0)); m4.compose(new THREE.Vector3(s.x + (c.R() - 0.5) * 0.3, sc / 2, s.z + (c.R() - 0.5) * 0.3), q, new THREE.Vector3(sc, sc, 1)); mesh.setMatrixAt(i++, m4); }
  mesh.count = i; c.scene.add(mesh); c.disposables.push(g);
}

