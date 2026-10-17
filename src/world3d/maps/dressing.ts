// What each island terrace carries besides the kit (docs/WORLD_3D_SPEC.md §2.2): the drill yard's fence, targets and
// dummies, the sparring ring, the archery range's rows of targets and its hut, the plaza's stall, loom, fountain and
// cloth swags. Each dressing gets the builder's context and adds to its Parts (merged stone and wood), its scene and
// its life.
import * as THREE from 'three';
import { Parts, box, cyl, lathe } from '../../arena3d/RoomKit';
import type { Life, Wind } from '../life/kit';
import { banner } from '../life/cloth';
import { pond } from '../life/pond';
import { footBox } from '../kit/units';
import type { AreaDef } from '../../world/Areas';
import type { Disposable } from '../kit/units';
import { growTrees, crownCanvas } from '../kit/trees';
import { canvasTex } from '../../arena3d/RoomKit';

export interface DressCtx {
  P: Parts; scene: THREE.Scene; front: THREE.Scene; M: Record<string, THREE.Material>;
  A: AreaDef; ax: number;
  F: { x0: number; x1: number; zB: number; zF: number }; zWall: number; zFront: number; xW0: number; xW1: number; cx: number;
  /** The ground above the wall (its height, where it begins behind the top floor). */
  zTopBack: number; topY: number;
  R: () => number; life: Life[]; air: Wind; soft: boolean; crimson: boolean;
  std(o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
  /** Things that move with the wind each frame (t, wind strength), what to free. */
  sway: ((t: number, wind: number) => void)[]; disposables: Disposable[];
}
export type Dressing = (c: DressCtx) => void;

/** A post-and-rail fence along a line (x0..x1 at z), posts every 1.4. */
function fence(P: Parts, x0: number, x1: number, y: number, z: number, h = 1.0): void {
  const n = Math.max(1, Math.round((x1 - x0) / 1.4));
  for (let i = 0; i <= n; i++) P.add('wood', box(0.12, h, 0.12, x0 + ((x1 - x0) * i) / n, y, z, 0.5));
  P.add('wood', box(x1 - x0, 0.07, 0.07, (x0 + x1) / 2, y + h - 0.12, z, 0.5), box(x1 - x0, 0.06, 0.06, (x0 + x1) / 2, y + h * 0.5, z, 0.5));
}

/** A straw target on a tripod: a painted disc of rings facing the camera. */
function target(P: Parts, scene: THREE.Scene, std: DressCtx['std'], x: number, y: number, z: number, r = 0.42): void {
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; const g = box(0.06, 1.3, 0.06, 0, 0, 0, 0.5); g.rotateX(Math.cos(a) * 0.25); g.rotateZ(Math.sin(a) * 0.25); g.translate(x + Math.sin(a) * 0.18, y, z + Math.cos(a) * 0.12); P.add('wood', g); }
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  for (const [rad, col] of [[62, '#e8d8a8'], [50, '#1a1a1a'], [38, '#3a6ad0'], [26, '#d03030'], [13, '#f0c030']] as [number, string][]) { g.fillStyle = col; g.beginPath(); g.arc(64, 64, rad, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = std({ map: tex, roughness: 0.85 }); const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 24), m);
  disc.rotation.x = Math.PI / 2; disc.position.set(x, y + 1.05, z + 0.06); disc.castShadow = true; scene.add(disc);
  for (let k = 0; k < 3; k++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), std({ color: 0x5a3a20 })); a.rotation.x = Math.PI / 2 + 0.15; a.position.set(x + (k - 1) * 0.12, y + 1.05 + (k % 2) * 0.1, z + 0.28); scene.add(a); }
}

/** A drill dummy: a post with a crossbar, a straw body, a helmet. */
function dummy(P: Parts, x: number, y: number, z: number): void {
  P.add('wood', box(0.14, 1.6, 0.14, x, y, z, 0.5), box(1.0, 0.1, 0.1, x, y + 1.15, z, 0.5));
  P.add('terracotta', lathe([[0.02, 0], [0.2, 0.02], [0.25, 0.3], [0.22, 0.6], [0.1, 0.68]], x, y + 0.6, z, 12));
  P.add('dark', lathe([[0.001, 0], [0.16, 0.02], [0.18, 0.12], [0.1, 0.22], [0.001, 0.25]], x, y + 1.4, z, 12));
}

/** M08 · the Training Grounds: a fence with straw targets along the back, two dummies, a weapon rack, the plank platform. */
export const trainingYard: Dressing = (c) => {
  const { P, scene, std, zWall, xW0, xW1, R } = c;
  fence(P, xW0 - 2, xW1 + 2, 0, zWall + 0.6, 1.0);
  for (let x = c.F.x0 + 1.5; x < c.F.x1; x += 3.6) target(P, scene, std, x + (R() - 0.5) * 0.4, 0, zWall + 1.1);
  dummy(P, c.F.x0 + 3.2, 0, zWall + 1.9); dummy(P, c.F.x1 - 3.4, 0, zWall + 1.9);
  // the rack: a frame with wooden swords leaning in it
  P.add('wood', box(1.6, 0.12, 0.12, c.cx + 5.2, 1.2, zWall + 0.9, 0.5), box(0.12, 1.3, 0.12, c.cx + 4.45, 0, zWall + 0.9, 0.5), box(0.12, 1.3, 0.12, c.cx + 5.95, 0, zWall + 0.9, 0.5));
  for (let k = 0; k < 5; k++) { const g = box(0.06, 1.1, 0.03, 0, 0, 0, 0.5); g.rotateZ(0.12); g.translate(c.cx + 4.6 + k * 0.3, 0.02, zWall + 0.95); P.add('wood', g); }
  for (const p of c.A.props.filter((q) => q.id === 'platform')) { // the drill platform: planks on joists, a step up
    const b = footBox(p.foot, c.ax), h = (p.h || 90) / 100;
    P.add('wood', box(b.w, h, b.d, b.cx, 0, b.cz, 0.6, 0.02));
    for (let x = b.x0 + 0.1; x < b.x1; x += 0.32) P.add('dark', box(0.02, 0.012, b.d - 0.1, x, h, b.cz, 1)); // the plank seams
    P.add('wood', box(1.2, h / 2, 0.5, b.cx, 0, b.z1 + 0.25, 0.6, 0.02));
  }
};

/** M09 · the Sparring Yard: a roped ring on posts in the yard's back half, dummies, barrels, a covered rack. */
export const sparringYard: Dressing = (c) => {
  const { P, zWall, cx } = c;
  const rx0 = cx - 4.6, rx1 = cx + 4.6, rz0 = zWall + 0.5, rz1 = zWall + 2.6;
  for (const [x, z] of [[rx0, rz0], [rx1, rz0], [rx0, rz1], [rx1, rz1]]) P.add('wood', box(0.16, 1.2, 0.16, x, 0, z, 0.5));
  for (const y of [0.5, 0.95]) { P.add('terracotta', box(rx1 - rx0, 0.05, 0.05, cx, y, rz0, 0.3), box(rx1 - rx0, 0.05, 0.05, cx, y, rz1, 0.3), box(0.05, 0.05, rz1 - rz0, rx0, y, (rz0 + rz1) / 2, 0.3), box(0.05, 0.05, rz1 - rz0, rx1, y, (rz0 + rz1) / 2, 0.3)); }
  dummy(P, cx - 2.4, 0, zWall + 1.5); dummy(P, cx + 2.4, 0, zWall + 1.5);
  for (const [x, z] of [[c.F.x0 + 1.2, zWall + 0.8], [c.F.x0 + 1.9, zWall + 0.6], [c.F.x1 - 1.4, zWall + 0.7]]) P.add('wood', lathe([[0.3, 0], [0.36, 0.1], [0.38, 0.5], [0.36, 0.9], [0.3, 1.0]], x, 0, z, 14));
  P.add('wood', box(3.2, 0.1, 1.2, c.F.x1 - 4.2, 2.2, zWall + 0.9, 0.6), box(0.12, 2.2, 0.12, c.F.x1 - 5.7, 0, zWall + 0.4, 0.5), box(0.12, 2.2, 0.12, c.F.x1 - 2.7, 0, zWall + 0.4, 0.5), box(0.12, 2.2, 0.12, c.F.x1 - 5.7, 0, zWall + 1.4, 0.5), box(0.12, 2.2, 0.12, c.F.x1 - 2.7, 0, zWall + 1.4, 0.5)); // the covered rack
};

/** M10 · the Archery Range: targets at three distances along the back, a shooting line, a hut with bows at the west. */
export const archeryRange: Dressing = (c) => {
  const { P, scene, std, zWall, R } = c;
  for (let x = c.F.x0 + 1.2; x < c.F.x1 - 0.5; x += 2.2) target(P, scene, std, x + (R() - 0.5) * 0.3, 0, zWall + 0.6 + (R() < 0.5 ? 0 : 1.1), 0.4 + R() * 0.1);
  P.add('moulding', box(c.F.x1 - c.F.x0, 0.03, 0.12, c.cx, 0.0, c.F.zB + 1.4, 1)); // the shooting line
  // the hut: posts, a plank roof, bows on a rail
  const hx = c.F.x0 + 1.4, hz = zWall + 2.2;
  for (const [dx, dz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]]) P.add('wood', box(0.14, 2.0, 0.14, hx + dx, 0, hz + dz, 0.5));
  P.add('wood', box(2.6, 0.12, 1.8, hx, 2.0, hz, 0.6)); P.add('roof', box(2.8, 0.1, 2.0, hx, 2.12, hz, 1));
  P.add('wood', box(2.2, 0.06, 0.06, hx, 1.3, hz - 0.6, 0.5));
  for (let k = 0; k < 4; k++) { const g = new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI); g.rotateZ(-Math.PI / 2); g.translate(hx - 0.8 + k * 0.5, 0.95, hz - 0.62); P.add('wood', g); }
};

/** M11 · Sunstone Plaza: Mira's stall and Bren's loom under canopies, a fountain in the middle-back, red swags over the gate. */
export const sunstonePlaza: Dressing = (c) => {
  const { P, scene, std, zWall, cx, life, air, soft, M } = c;
  const npc = (id: string) => (c.A.npcs ?? []).find((n) => n.id === id);
  const mira = npc('mira'), bren = npc('bren');
  const mx = mira ? (mira.x + c.ax) / 100 : cx - 3, bx = bren ? (bren.x + c.ax) / 100 : cx + 3;
  // Mira's stall: a counter, posts, a striped awning, baskets
  { const x = mx, z = zWall + 1.2; P.add('wood', box(2.6, 0.9, 0.7, x, 0, z, 0.6, 0.02), box(0.12, 2.3, 0.12, x - 1.25, 0, z - 0.3, 0.5), box(0.12, 2.3, 0.12, x + 1.25, 0, z - 0.3, 0.5), box(0.12, 2.0, 0.12, x - 1.25, 0, z + 0.4, 0.5), box(0.12, 2.0, 0.12, x + 1.25, 0, z + 0.4, 0.5));
    const g = box(2.9, 0.06, 1.3, 0, 0, 0, 1); g.rotateX(0.18); g.translate(x, 2.15, z + 0.05); P.add('terracotta', g);
    for (let k = 0; k < 3; k++) P.add('wood', lathe([[0.1, 0], [0.22, 0.05], [0.24, 0.25], [0.2, 0.3]], x - 0.8 + k * 0.8, 0.9, z, 10));
    for (let k = 0; k < 5; k++) P.add('gold', lathe([[0.001, 0], [0.06, 0.02], [0.07, 0.08], [0.03, 0.12], [0.001, 0.13]], x - 0.7 + k * 0.35, 1.2, z - 0.05, 8)); // bottles
  }
  // Bren's loom: a frame with a banner on it, a canopy, banners drying on a line
  { const x = bx, z = zWall + 1.2; P.add('wood', box(0.12, 2.0, 0.12, x - 0.8, 0, z, 0.5), box(0.12, 2.0, 0.12, x + 0.8, 0, z, 0.5), box(1.8, 0.1, 0.1, x, 1.9, z, 0.5), box(1.8, 0.1, 0.1, x, 0.3, z, 0.5), box(0.12, 2.4, 0.12, x - 1.3, 0, z - 0.6, 0.5), box(0.12, 2.4, 0.12, x + 1.3, 0, z - 0.6, 0.5));
    const g = box(3.0, 0.06, 1.6, 0, 0, 0, 1); g.rotateX(0.16); g.translate(x, 2.3, z - 0.2); P.add('wood', g);
    life.push(banner(scene, { x, y: 1.85, z: z + 0.02, yaw: 0, w: 1.2, h: 1.4 }, { wind: air, seed: 61 }));
    for (const [i, dx] of [-2.6, -1.9, 2.0, 2.7].entries()) life.push(banner(scene, { x: x + dx, y: 1.9, z: z - 0.7, yaw: 0, w: 0.5, h: 1.3 }, { wind: air, seed: 62 + i }));
    P.add('wood', box(5.6, 0.04, 0.04, x, 1.9, z - 0.7, 0.3));
  }
  // the fountain: a round basin with a sun statue, the water a mirrored pond
  { const fx = cx, fz = zWall + 2.4; P.add('balustrade', lathe([[1.4, 0], [1.55, 0.05], [1.55, 0.42], [1.4, 0.46], [1.3, 0.46], [1.3, 0.1]], fx, 0, fz, 28));
    P.add('balustrade', lathe([[0.3, 0], [0.4, 0.05], [0.22, 0.5], [0.3, 0.9], [0.6, 0.95], [0.62, 1.02], [0.1, 1.05], [0.1, 1.2], [0.001, 1.3]], fx, 0.1, fz, 16));
    P.add('gold', lathe([[0.001, 0], [0.16, 0.02], [0.2, 0.1], [0.1, 0.2], [0.001, 0.24]], fx, 1.3, fz, 12));
    life.push(pond(scene, { x: fx, z: fz, w: 2.5, d: 2.5, y: 0.1 }, { wind: air, stone: M.balustrade, mirror: !soft, sunDir: new THREE.Vector3(0.55, 0.42, 0.72), sunColor: new THREE.Color(0xffc27a), skyLow: new THREE.Color(0xffb862), skyMid: new THREE.Color(0xcc7488), koi: 0, pads: 0, rim: false }));
    void std;
  }
  // red swags over the back wall's middle (two long cloths hung between posts)
  for (const [i, x] of [cx - 3.2, cx + 3.2].entries()) life.push(banner(scene, { x, y: 2.3, z: zWall + 0.25, yaw: 0, w: 2.0, h: 0.9 }, { wind: air, seed: 71 + i }));
};

// ------------------------------------------------------------------ the orchard (M12–M13)

/** Orange trees: round dark crowns with fruit, on the ground given (the terrace or the floor above). */
function orangeTrees(c: DressCtx, spots: { x: number; z: number; h: number; lean: number }[], ground: number): void {
  const crownTex = canvasTex(crownCanvas(['#3f7a2e', '#5a9a3a', '#2e5e22'], 21)); c.disposables.push(crownTex);
  const trees = growTrees(c.scene, spots, ground, { crownTex, crownColor: 0xfff0e0, crownEmissive: 0x0a2a08, crownEmissiveIntensity: 0.3, clumpScale: 0.95 }, c.R, c.soft);
  c.disposables.push(trees); c.P.add('bark', ...trees.bark);
  c.sway.push((t, w) => trees.update(t, w));
  // the fruit: small orange spheres at the clumps
  const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), c.std({ color: 0xff9a2a, roughness: 0.5, emissive: 0x662200, emissiveIntensity: 0.25 }), Math.max(1, trees.clumps.length * 2));
  const m4 = new THREE.Matrix4(); let i = 0;
  for (const cl of trees.clumps) for (let k = 0; k < 2; k++) { m4.makeTranslation(cl.p.x + (c.R() - 0.5) * 0.5, cl.p.y + (c.R() - 0.5) * 0.4 - 0.15, cl.p.z + (c.R() - 0.5) * 0.5); fruit.setMatrixAt(i++, m4); }
  fruit.count = i; fruit.castShadow = true; c.scene.add(fruit); c.disposables.push(fruit.geometry);
}

/** M12 · Orchard Path: orange trees along the back and on the heights above, a picking ladder, baskets of oranges. */
export const orchardPath: Dressing = (c) => {
  const { P, R, zWall, xW0, xW1 } = c;
  const low: { x: number; z: number; h: number; lean: number }[] = [], up: { x: number; z: number; h: number; lean: number }[] = [];
  for (let x = xW0 + 1; x < xW1; x += 3.1) low.push({ x: x + (R() - 0.5) * 0.8, z: zWall + 1.1 + R() * 0.5, h: 1.9 + R() * 0.4, lean: (R() - 0.5) * 0.4 });
  for (let x = xW0; x < xW1; x += 3.4) up.push({ x: x + (R() - 0.5) * 0.8, z: c.zTopBack - 1.2 - R() * 1.6, h: 2.0 + R() * 0.5, lean: (R() - 0.5) * 0.4 });
  orangeTrees(c, low, 0); orangeTrees(c, up, c.topY);
  // a ladder against a tree, baskets
  { const t = low[2] ?? low[0]; const g = box(0.5, 2.2, 0.06, 0, 0, 0, 0.5); g.rotateX(-0.35); g.translate(t.x + 0.6, 0, t.z + 0.9); P.add('wood', g); for (let k = 0; k < 6; k++) { const r = box(0.44, 0.05, 0.05, 0, 0, 0, 0.5); r.rotateX(-0.35); r.translate(t.x + 0.6, 0.3 * (k + 1), t.z + 0.9 - 0.36 * 0.3 * (k + 1) / 1.05); P.add('wood', r); } }
  for (const [dx, dz] of [[2.2, 1.4], [2.9, 1.1], [-5.4, 1.5]]) { P.add('wood', lathe([[0.12, 0], [0.3, 0.04], [0.32, 0.3], [0.28, 0.34]], c.cx + dx, 0, zWall + dz, 12)); for (let k = 0; k < 5; k++) P.add('terracotta', lathe([[0.001, 0], [0.07, 0.02], [0.08, 0.08], [0.04, 0.13], [0.001, 0.14]], c.cx + dx + (R() - 0.5) * 0.3, 0.3, zWall + dz + (R() - 0.5) * 0.3, 8)); }
};

/** M13 · Harvest Square: crates and barrels, a wine press, garlands of leaves and lanterns between poles, vines on the wall. */
export const harvestSquare: Dressing = (c) => {
  const { P, R, zWall, cx, life, air } = c;
  for (let i = 0; i < 7; i++) { const x = c.F.x0 + 1 + R() * 14, z = zWall + 0.5 + R() * 1.4; if (R() < 0.5) P.add('wood', box(0.7, 0.6, 0.7, x, 0, z, 0.6, 0.02)); else P.add('wood', lathe([[0.26, 0], [0.32, 0.1], [0.34, 0.45], [0.32, 0.8], [0.26, 0.9]], x, 0, z, 14)); }
  // the press: a vat with a screw frame
  P.add('wood', lathe([[0.5, 0], [0.7, 0.05], [0.72, 0.7], [0.68, 0.76]], cx + 4.5, 0, zWall + 1.0, 18), box(0.14, 2.2, 0.14, cx + 3.9, 0, zWall + 1.0, 0.5), box(0.14, 2.2, 0.14, cx + 5.1, 0, zWall + 1.0, 0.5), box(1.5, 0.14, 0.14, cx + 4.5, 2.1, zWall + 1.0, 0.5));
  P.add('dark', cyl(0.05, 0.05, 1.3, cx + 4.5, 0.9, zWall + 1.0, 8), box(0.9, 0.1, 0.9, cx + 4.5, 0.8, zWall + 1.0, 1));
  // garlands: ropes of leaves with lanterns between poles across the square's back
  const poles = [c.F.x0 + 1.5, c.F.x0 + 6, c.F.x0 + 10.5, c.F.x1 - 1.5];
  for (const x of poles) P.add('wood', box(0.12, 2.6, 0.12, x, 0, zWall + 2.2, 0.5));
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i], b = poles[i + 1], pts = [0, 0.25, 0.5, 0.75, 1].map((k) => new THREE.Vector3(a + (b - a) * k, 2.55 - Math.sin(Math.PI * k) * 0.35, zWall + 2.2));
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 6); P.add('wood', g);
    for (const k of [0.3, 0.7]) { const p = new THREE.CatmullRomCurve3(pts).getPointAt(k); life.push(banner(c.scene, { x: p.x, y: p.y - 0.05, z: p.z, yaw: 0, w: 0.3, h: 0.5 }, { wind: air, seed: 80 + i * 2 + Math.round(k * 10) })); }
  }
};

// ------------------------------------------------------------------ the ruins (M14–M18)

/** Rubble: a scatter of broken stone pieces. */
function rubble(c: DressCtx, x: number, z: number, n: number, spread: number): void {
  for (let i = 0; i < n; i++) { const s = 0.15 + c.R() * 0.35; const g = box(s, s * 0.6, s * 0.8, 0, 0, 0, 1.1, 0.03); g.rotateY(c.R() * 3); g.translate(x + (c.R() - 0.5) * spread, 0, z + (c.R() - 0.5) * spread * 0.5); c.P.add('wall', g); }
}
/** A broken arch: two piers, one carrying a fragment of the arch. */
function brokenArch(c: DressCtx, x: number, z: number, w: number, h: number, whole = false): void {
  c.P.add('wall', box(0.6, h, 0.7, x - w / 2, 0, z, 1.3, 0.02), box(0.6, h * (whole ? 1 : 0.7), 0.7, x + w / 2, 0, z, 1.3, 0.02));
  const g = new THREE.TorusGeometry(w / 2, 0.3, 8, 20, whole ? Math.PI : Math.PI * 0.55); g.translate(x, h, z); c.P.add('wall', g);
  if (!whole) rubble(c, x + w / 2, z + 0.6, 5, 1.2);
}

/** M14 · Crimson Ruins: broken arches along the back, a toppled statue, cracked slabs, rubble; the Curse's glow east. */
export const crimsonRuins: Dressing = (c) => {
  const { zWall, cx } = c;
  for (const [dx, w, h, whole] of [[-6.2, 2.6, 2.4, false], [-2.6, 2.2, 2.2, true], [1.4, 2.8, 2.6, false], [5.4, 2.4, 2.3, false]] as [number, number, number, boolean][]) brokenArch(c, cx + dx, zWall + 1.4, w, h, whole);
  rubble(c, cx - 4.4, zWall + 2.4, 8, 2.4); rubble(c, cx + 3.6, zWall + 2.3, 6, 2.0);
  { const g = box(0.5, 2.0, 0.5, 0, 0, 0, 1.1, 0.03); g.rotateZ(Math.PI / 2 - 0.2); g.translate(cx + 7.6, 0.25, zWall + 2.2); c.P.add('moulding', g); c.P.add('moulding', box(0.9, 0.5, 0.9, cx + 6.6, 0, zWall + 2.2, 1.1, 0.03)); } // the toppled statue on its plinth
};

/** M15 · Broken Colonnade: a colonnade along the back, half its columns down — drums across the floor's back, two leaning on each other. */
export const brokenColonnade: Dressing = (c) => {
  const { P, R, zWall } = c;
  for (let x = c.F.x0 + 1; x < c.F.x1; x += 2.1) {
    const up = R() < 0.55, h = up ? 3.2 : 0.6 + R() * 1.2;
    P.add('moulding', lathe([[0, 0], [0.36, 0], [0.36, 0.08], [0.3, 0.14], [0, 0.14]], x, 0, zWall + 0.8, 14)); P.add('wall', cyl(0.28, 0.25, h, x, 0.14, zWall + 0.8, 16, 1.2));
    if (up) P.add('moulding', box(0.8, 0.22, 0.8, x, 3.34, zWall + 0.8, 1, 0.03));
    else { const g = cyl(0.26, 0.26, 1.6, 0, 0, 0, 14, 1.2); g.rotateZ(Math.PI / 2 - 0.15); g.translate(x + 1.0, 0.26, zWall + 2.0 + R() * 0.6); P.add('wall', g); }
  }
  P.add('moulding', box(c.F.x1 - c.F.x0 + 1, 0.3, 0.9, c.cx, 3.56, zWall + 0.8, 1.3, 0.03)); // the entablature over the standing ones (broken where none stand: left as is)
  { const g1 = cyl(0.26, 0.24, 3.0, 0, 0, 0, 14, 1.2); g1.rotateZ(0.28); g1.translate(c.cx - 0.9, 0, zWall + 2.6); const g2 = cyl(0.26, 0.24, 2.8, 0, 0, 0, 14, 1.2); g2.rotateZ(-0.32); g2.translate(c.cx + 0.9, 0, zWall + 2.6); P.add('wall', g1, g2); } // two leaning on each other
  rubble(c, c.cx - 5, zWall + 2.6, 7, 2.6); rubble(c, c.cx + 5.5, zWall + 2.4, 6, 2.2);
};

/** M16 · Sunken Shrine: a dais with a cracked altar under a ruined dome, great crimson drapes hung from it, braziers. */
export const sunkenShrine: Dressing = (c) => {
  const { P, zWall, cx, life, air, scene } = c;
  P.add('balustrade', box(9, 0.5, 3.4, cx, 0, zWall + 1.9, 1.3, 0.03), box(7.6, 0.4, 2.6, cx, 0.5, zWall + 1.9, 1.3, 0.03));
  P.add('moulding', box(2.2, 1.0, 1.0, cx, 0.9, zWall + 1.6, 1.2, 0.03)); // the altar
  for (const [dx, dz] of [[-2.8, -0.6], [2.8, -0.6], [-2.8, 1.4], [2.8, 1.4]]) P.add('wall', cyl(0.3, 0.27, 4.2, cx + dx, 0.9, zWall + 1.9 + dz, 16, 1.3));
  { const g = new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 1.3, 0, Math.PI / 2.4); g.translate(cx, 5.0, zWall + 2.3); P.add('roof', g); } // half a dome
  for (const [i, dx] of [-3.4, -1.2, 1.3, 3.5].entries()) life.push(banner(scene, { x: cx + dx, y: 5.4, z: zWall + 2.4 + (i % 2) * 0.6, yaw: 0, w: 1.4, h: 4.6, emblem: false }, { wind: air, seed: 90 + i }));
  for (const dx of [-4.2, 4.2]) { P.add('bronze', lathe([[0.06, 0], [0.26, 0.02], [0.1, 0.1], [0.1, 0.9], [0.4, 1.0], [0.46, 1.1], [0.4, 1.14], [0.14, 1.0]], cx + dx, 0.5, zWall + 0.9, 14)); const L = new THREE.PointLight(0xff5a30, 2.2, 6, 2); L.position.set(cx + dx, 1.9, zWall + 0.9); scene.add(L); }
};

/** M17 · Siege Approach: rotting engines along the back — a catapult, a broken ram, barricades of stakes, torn banners. */
export const siegeApproach: Dressing = (c) => {
  const { P, R, zWall, cx, life, air, scene } = c;
  // the catapult: a frame on wheels, an arm, a bucket
  { const x = cx - 5, z = zWall + 1.6; P.add('wood', box(2.4, 0.3, 1.4, x, 0.2, z, 0.6), box(0.2, 1.6, 0.2, x - 0.6, 0.5, z - 0.5, 0.5), box(0.2, 1.6, 0.2, x - 0.6, 0.5, z + 0.5, 0.5), box(0.2, 0.2, 1.2, x - 0.6, 2.0, z, 0.5));
    const arm = box(0.16, 3.0, 0.16, 0, 0, 0, 0.5); arm.rotateZ(-1.1); arm.translate(x - 0.6, 1.0, z); P.add('wood', arm);
    for (const [dx, dz] of [[-1.0, -0.8], [1.0, -0.8], [-1.0, 0.8], [1.0, 0.8]]) { const w = new THREE.CylinderGeometry(0.4, 0.4, 0.14, 12); w.rotateX(Math.PI / 2); w.translate(x + dx, 0.4, z + dz); P.add('wood', w); } }
  // the ram: a log on a frame, half collapsed
  { const x = cx + 1.5, z = zWall + 1.8; const log = cyl(0.3, 0.3, 3.6, 0, 0, 0, 12, 1); log.rotateZ(Math.PI / 2 + 0.12); log.translate(x, 0.8, z); P.add('wood', log); P.add('wood', box(0.16, 1.4, 0.16, x - 1.4, 0, z - 0.4, 0.5), box(0.16, 1.4, 0.16, x - 1.4, 0, z + 0.4, 0.5), box(0.16, 0.9, 0.16, x + 1.4, 0, z + 0.4, 0.5)); P.add('dark', cyl(0.34, 0.2, 0.5, x + 1.9, 0.6, z, 10)); }
  // barricades of sharpened stakes
  for (const bx of [cx - 8.5, cx + 6.5]) for (let k = 0; k < 7; k++) { const g = cyl(0.07, 0.02, 1.4, 0, 0, 0, 6, 0.5); g.rotateX(-0.7 + (R() - 0.5) * 0.2); g.rotateY((R() - 0.5) * 0.4); g.translate(bx + k * 0.42, 0, zWall + 0.9 + (R() - 0.5) * 0.3); P.add('wood', g); }
  for (const [i, dx] of [-7, -2.5, 4, 8].entries()) { P.add('dark', cyl(0.05, 0.04, 2.8, cx + dx, 0, zWall + 0.5, 6)); life.push(banner(scene, { x: cx + dx + 0.02, y: 2.7, z: zWall + 0.5, yaw: 0, w: 0.5, h: 1.5 }, { wind: air, seed: 95 + i })); }
  rubble(c, cx - 2, zWall + 2.6, 6, 3);
};

/** M18 · Warden's Hold: the ruined gate across the back — two square towers and a great arch with its portcullis half up, chains, torches in iron cages. */
export const wardensHold: Dressing = (c) => {
  const { P, zWall, cx, scene } = c;
  const gz = zWall + 0.6;
  for (const dx of [-5.2, 5.2]) { P.add('wall', box(3.2, 7.5, 3.2, cx + dx, 0, gz - 1.4, 1.3)); for (let k = 0; k < 5; k++) P.add('wall', box(0.5, 0.6, 0.5, cx + dx - 1.2 + k * 0.6, 7.5, gz - 2.9, 1)); }
  P.add('wall', box(7.6, 1.6, 2.4, cx, 5.2, gz - 1.4, 1.3)); // over the arch
  { const g = new THREE.TorusGeometry(3.6, 0.5, 10, 24, Math.PI); g.translate(cx, 2.2, gz - 0.4); P.add('wall', g); }
  for (const dx of [-3.4, 3.4]) P.add('wall', box(0.9, 2.3, 2.2, cx + dx, 0, gz - 1.4, 1.3));
  // the portcullis half raised: bars hanging from the arch
  for (let k = -3; k <= 3; k++) P.add('dark', box(0.08, 2.6, 0.08, cx + k * 0.5, 3.2, gz - 0.9, 0.5));
  P.add('dark', box(3.4, 0.08, 0.08, cx, 3.6, gz - 0.9), box(3.4, 0.08, 0.08, cx, 4.8, gz - 0.9));
  // chains from the towers, torches in cages
  for (const dx of [-5.2, 5.2]) { const pts = [new THREE.Vector3(cx + dx, 6.8, gz + 0.3), new THREE.Vector3(cx + dx * 0.55, 4.6, gz + 1.2), new THREE.Vector3(cx + dx * 0.3, 3.4, gz + 0.9)]; P.add('dark', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.05, 6)); }
  for (const dx of [-3.8, 3.8]) { P.add('dark', cyl(0.05, 0.05, 0.6, cx + dx, 2.4, gz + 0.6, 6), cyl(0.18, 0.14, 0.3, cx + dx, 3.0, gz + 0.6, 8)); const L = new THREE.PointLight(0xff7a30, 2.4, 7, 2); L.position.set(cx + dx, 3.3, gz + 0.8); scene.add(L); }
};
