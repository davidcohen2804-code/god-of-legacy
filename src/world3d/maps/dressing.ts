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

export interface DressCtx {
  P: Parts; scene: THREE.Scene; front: THREE.Scene; M: Record<string, THREE.Material>;
  A: AreaDef; ax: number;
  F: { x0: number; x1: number; zB: number; zF: number }; zWall: number; zFront: number; xW0: number; xW1: number; cx: number;
  R: () => number; life: Life[]; air: Wind; soft: boolean;
  std(o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
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
