// Kit E — what Ironhold's terraces carry (docs/WORLD_3D_SPEC.md §2.6, M35–M38): the parade ground before the keep with
// Grit's forge, the Crag Path's ledge road under the cliff, the Forge Road's rails, mill and chimneys, the Ember Quarry's
// cut terraces with lava in its channels and the Crag King's cave. The terrace builder (look 'ironhold') gives the hot
// sunset light, the red stone, the pines and the ash; these add the places' own models and their warm lights.
import * as THREE from 'three';
import { box, cyl, lathe, canvasTex } from '../../arena3d/RoomKit';
import { wallRun } from '../kit/terrain';
import { ux, uy, footBox } from '../kit/units';
import { post, warmLight, halo, boulder, chimneySmoke, water, waterfall } from '../kit/props';
import { growTrees, crownCanvas } from '../kit/trees';
import { Puffs, tex as lifeTex, dotCanvas } from '../life/kit';
import { banner } from '../life/cloth';
import type { DressCtx, Dressing } from './dressing';

// ------------------------------------------------------------------ the kit's pieces

/** A crenellated red wall with a walk behind its merlons. */
function battlement(c: DressCtx, x0: number, x1: number, y: number, h: number, z: number): void {
  wallRun(c.P, x0, x1, y, h, z, { thick: 1.2, pilasterEvery: 5, cornice: false });
  for (let x = x0 + 0.3; x < x1; x += 0.9) c.P.add('wall', box(0.5, 0.5, 0.5, x, y + h, z - 0.3, 1.3, 0.02));
}

/** A square tower with merlons, arrow slits and a banner. */
function keepTower(c: DressCtx, x: number, z: number, w: number, h: number, bannerSeed: number): void {
  c.P.add('wall', box(w, h, w, x, 0, z, 1.3)); for (let k = 0; k < 4; k++) c.P.add('wall', box(0.5, 0.5, 0.5, x - w / 2 + 0.25 + (k * (w - 0.5)) / 3, h, z + w / 2 - 0.25, 1.3, 0.02));
  for (const dy of [h * 0.4, h * 0.7]) c.P.add('dark', box(0.12, 0.5, 0.06, x, dy, z + w / 2 + 0.01, 1));
  c.P.add('dark', cyl(0.04, 0.04, 2.0, x, h, z, 6)); c.life.push(banner(c.scene, { x: x + 0.02, y: h + 1.9, z, yaw: 0, w: 0.5, h: 1.5 }, { wind: c.air, seed: bannerSeed }));
}

/** A brazier on a tripod with a flame and its light. */
function brazier(c: DressCtx, x: number, y: number, z: number, lit = true): void {
  c.P.add('iron', lathe([[0.06, 0], [0.2, 0.02], [0.08, 0.1], [0.08, 0.7], [0.3, 0.78], [0.4, 0.9], [0.42, 0.98], [0.36, 1.0], [0.3, 0.88], [0.1, 0.8]], x, y, z, 14)); c.P.add('dark', cyl(0.3, 0.3, 0.05, x, y + 0.92, z, 12));
  if (lit) { halo(c, x, y + 1.15, z, 1.2, 0xff8a30, 0.7); warmLight(c, x, y + 1.3, z + 0.2, 2.0, 7, 0xff7a30); }
}

/** A mine cart on wheels, heaped with ore (or tipped over). */
function cart(c: DressCtx, x: number, z: number, w: number, d: number, h: number, tipped = false): void {
  const g: THREE.BufferGeometry[] = [box(w, h * 0.7, d, 0, h * 0.25, 0, 0.6, 0.02)], iron: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const wh = new THREE.CylinderGeometry(h * 0.22, h * 0.22, 0.08, 12); wh.rotateX(Math.PI / 2); wh.translate(sx * w * 0.3, h * 0.22, sz * (d / 2 + 0.05)); iron.push(wh); }
  iron.push(box(w + 0.04, 0.05, 0.05, 0, h * 0.6, d / 2 + 0.01, 1), box(w + 0.04, 0.05, 0.05, 0, h * 0.6, -d / 2 - 0.01, 1));
  const ore = lathe([[0.001, 0], [w * 0.4, 0.02], [w * 0.3, h * 0.3], [0.001, h * 0.36]], 0, h * 0.9, 0, 10);
  for (const q of [...g, ...iron, ore]) { if (tipped) { q.rotateZ(1.3); q.translate(x, 0.2, z); } else q.translate(x, 0, z); }
  c.P.add('wood', ...g); c.P.add('iron', ...iron); c.P.add('ore', ore);
}

/** Rails on sleepers along x. */
function rails(c: DressCtx, x0: number, x1: number, y: number, z: number): void {
  for (let x = x0; x < x1; x += 0.5) c.P.add('wood', box(0.2, 0.06, 1.1, x, y, z, 0.6));
  for (const dz of [-0.4, 0.4]) c.P.add('iron', box(x1 - x0, 0.05, 0.06, (x0 + x1) / 2, y + 0.06, z + dz, 1));
}

/** A red crag face: layered strata blocks with overhangs, the ground behind it rising. */
function crag(c: DressCtx, x0: number, x1: number, z: number, h: number, layers = 6): void {
  for (let k = 0; k < layers; k++) { const y = (k * h) / layers, lh = h / layers + 0.1, jut = (c.R() - 0.5) * 0.8; c.P.add('wall', box(x1 - x0 + 2, lh, 2.4 + jut, (x0 + x1) / 2 + (c.R() - 0.5) * 0.4, y, z - 1.2 - jut / 2, 1.6, 0.05)); }
  for (let x = x0; x < x1; x += 2.3 + c.R()) { const s = 0.4 + c.R() * 0.5; c.P.add('wall', box(s * 1.4, s, s, x, 0, z + 0.2 + c.R() * 0.4, 1.3, 0.04)); } // fallen rock at the foot
}

/** A furnace: a stone block with a glowing mouth, a chimney, sparks. */
function furnace(c: DressCtx, x: number, z: number, w = 1.6, h = 1.8): void {
  c.P.add('wall', box(w, h, 1.2, x, 0, z, 1.3, 0.04)); c.P.add('wall', box(0.5, 1.6, 0.5, x + w * 0.25, h, z - 0.3, 1.3, 0.02));
  c.M.glow ??= c.std({ color: 0xff6a20, emissive: 0xff5010, emissiveIntensity: 1.6, roughness: 0.9 });
  { const g = new THREE.CircleGeometry(0.32, 12, Math.PI, Math.PI); g.translate(x, h * 0.4, z + 0.61); c.P.add('glow', g); } c.P.add('glow', box(0.64, 0.08, 0.02, x, h * 0.36, z + 0.61, 1));
  halo(c, x, h * 0.45, z + 0.8, 1.6, 0xff7a30, 0.6); warmLight(c, x, h * 0.5, z + 1.0, 2.6, 8, 0xff6a20);
  chimneySmoke(c, [{ x: x + w * 0.25, y: h + 1.6, z: z - 0.3 }]);
  const sparks = new Puffs(c.soft ? 40 : 90, lifeTex(dotCanvas(0.4)), true); c.scene.add(sparks.pts); c.disposables.push(sparks); let acc = 0;
  c.sway.push((t) => { acc += 1 / 60 * 9; while (acc >= 1) { acc -= 1; sparks.emit(x + (c.R() - 0.5) * 0.4, h * 0.45, z + 0.7, (c.R() - 0.5) * 0.6, 0.8 + c.R() * 1.2, 0.2 + c.R() * 0.5, 0xffb050, 0.02 + c.R() * 0.02, 600 + c.R() * 700, { a: 0.9, grav: 1.2, drag: 0.6 }); } sparks.step(1000 / 60, 0.3, t); });
}

/** Lava in a channel: an emissive crust-and-glow surface, its light, embers rising over it. */
function lava(c: DressCtx, x: number, z: number, w: number, d: number): void {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
  g.fillStyle = '#2a100a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,${130 + Math.random() * 90},40,${0.7 + Math.random() * 0.3})`; g.lineWidth = 4 + Math.random() * 12; g.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; g.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - 0.5) * 90; py += (Math.random() - 0.5) * 90; g.lineTo(px, py); } g.stroke(); }
  const t = canvasTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 1.5, d / 1.5); c.disposables.push(t);
  const m = c.std({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 2.4, color: 0x402018, roughness: 0.8 });
  const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); p.translate(x, -0.12, z); const mesh = new THREE.Mesh(p, m); c.scene.add(mesh); c.disposables.push(p);
  c.P.add('wall', box(w + 0.4, 0.14, 0.25, x, -0.14, z - d / 2 - 0.1, 1.3), box(w + 0.4, 0.14, 0.25, x, -0.14, z + d / 2 + 0.1, 1.3)); // the channel's lips
  warmLight(c, x, 0.4, z, 2.2, 7, 0xff5a20); halo(c, x, 0.2, z, Math.min(4, w), 0xff6a20, 0.35);
  const embers = new Puffs(c.soft ? 30 : 70, lifeTex(dotCanvas(0.5)), true); c.scene.add(embers.pts); c.disposables.push(embers); let acc = 0;
  c.sway.push((tt) => { t.offset.x = (tt * 0.004) % 1; acc += 1 / 60 * 5; while (acc >= 1) { acc -= 1; embers.emit(x + (c.R() - 0.5) * w, -0.05, z + (c.R() - 0.5) * d, (c.R() - 0.5) * 0.2, 0.3 + c.R() * 0.5, (c.R() - 0.5) * 0.2, 0xff8a30, 0.02 + c.R() * 0.02, 1500 + c.R() * 1500, { a: 0.9, grav: -0.1, drag: 0.7 }); } embers.step(1000 / 60, 0.4, tt); });
}

function pines(c: DressCtx, spots: { x: number; z: number; h: number; lean: number }[], ground: number): void {
  const crownTex = canvasTex(crownCanvas(['#2e4a30', '#3a5a38', '#24402a'], 44)); c.disposables.push(crownTex);
  const trees = growTrees(c.scene, spots, ground, { crownTex, crownColor: 0xd8e0d0, crownEmissive: 0x0a1a0a, crownEmissiveIntensity: 0.3, clumpScale: 0.8 }, c.R, c.soft); c.disposables.push(trees); c.P.add('bark', ...trees.bark); c.sway.push((t, w) => trees.update(t, w));
}

// ------------------------------------------------------------------ M35 · Ironhold

/** The parade ground before the keep: its gate and battlements across the back with two square towers, crimson banners
 *  and braziers, Grit's forge at the back-right under a timber roof, the anvil, the quench trough, racks, the crates, a
 *  drill dummy, the Waystone by the gatehouse at the west. */
export const ironholdKeep: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  c.M.iron ??= c.std({ color: 0x4a4a52, metalness: 0.8, roughness: 0.5 }); c.M.ore ??= c.std({ color: 0x6a4a3a, roughness: 1 });
  // the keep: the wall, the gate between two towers, a timber gate shut, braziers, banners along the wall
  battlement(c, xW0 - 4, xW1 + 4, 0, 3.6, zWall - 0.2);
  keepTower(c, cx - 3.2, zWall - 1.6, 2.6, 6.2, 170); keepTower(c, cx + 3.2, zWall - 1.6, 2.6, 6.2, 171);
  { const g = new THREE.TorusGeometry(1.6, 0.4, 8, 20, Math.PI); g.translate(cx, 2.4, zWall - 0.1); P.add('wall', g); } P.add('wall', box(3.6, 1.6, 1.2, cx, 3.6, zWall - 0.8, 1.3));
  P.add('wood', box(3.0, 2.4, 0.2, cx, 0, zWall - 0.5, 0.6)); for (let k = 0; k < 3; k++) P.add('iron', box(3.1, 0.08, 0.06, cx, 0.4 + k * 0.9, zWall - 0.38, 1)); for (const dx of [-0.9, 0.9]) P.add('iron', cyl(0.06, 0.06, 0.04, cx + dx, 1.3, zWall - 0.36, 8));
  for (const dx of [-5.6, 5.6]) brazier(c, cx + dx, 0, zWall + 0.6);
  for (const [i, dx] of [-9, 8].entries()) { P.add('dark', cyl(0.04, 0.04, 2.0, cx + dx, 3.6, zWall - 0.8, 6)); c.life.push(banner(c.scene, { x: cx + dx + 0.02, y: 5.5, z: zWall - 0.8, yaw: 0, w: 0.5, h: 1.5 }, { wind: c.air, seed: 172 + i })); }
  // Grit's forge: a timber roof on posts, the furnace, the anvil (prop), the quench trough, racks of blades, bellows
  { const g = (c.A.npcs ?? []).find((n) => n.id === 'grit'); const fx = g ? ux(g.x + c.ax) + 1.2 : cx + 4, fz = zWall + 1.4;
    for (const [dx, dz] of [[-1.8, -0.9], [1.8, -0.9], [-1.8, 1.0], [1.8, 1.0]]) post(c, fx + dx, 0, fz + dz, 2.6, 0.16);
    { const r = box(4.4, 0.12, 2.8, 0, 0, 0, 1); r.rotateX(0.18); r.translate(fx, 2.65, fz + 0.1); P.add('roof', r); } P.add('wood', box(4.0, 0.14, 0.14, fx, 2.5, fz - 0.9, 0.5), box(4.0, 0.14, 0.14, fx, 2.5, fz + 1.0, 0.5));
    furnace(c, fx - 0.9, fz - 0.3);
    for (const p of c.A.props.filter((q) => q.id === 'anvil-block')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 64); P.add('wood', box(b.w, h * 0.75, b.d, b.cx, 0, b.cz, 0.6, 0.02)); P.add('iron', box(b.w * 0.6, h * 0.25, b.d * 0.4, b.cx, h * 0.75, b.cz, 1, 0.02), box(b.w * 0.3, h * 0.12, b.d * 0.3, b.cx - b.w * 0.4, h * 0.85, b.cz, 1, 0.01)); }
    P.add('wood', box(1.2, 0.5, 0.5, fx + 1.2, 0, fz + 0.6, 0.6, 0.02)); water(c, fx + 1.2, fz + 0.6, 1.0, 0.36, 0.42, 0); // the trough
    P.add('wood', box(1.6, 0.08, 0.08, fx + 1.4, 1.6, fz - 0.9, 0.5), box(0.1, 1.7, 0.1, fx + 0.7, 0, fz - 0.9, 0.5), box(0.1, 1.7, 0.1, fx + 2.1, 0, fz - 0.9, 0.5)); for (let k = 0; k < 5; k++) { const bl = box(0.05, 0.9, 0.02, 0, 0, 0, 1); bl.rotateZ(0.1); bl.translate(fx + 0.85 + k * 0.28, 0.6, fz - 0.88); P.add('iron', bl); } }
  // the crates, a drill dummy and a rack, the Waystone by the gatehouse arch at the west
  for (const p of c.A.props.filter((q) => q.id === 'crates')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 70); P.add('wood', box(b.w * 0.55, h, b.d, b.x0 + b.w * 0.275, 0, b.cz, 0.6, 0.02), box(b.w * 0.4, h * 0.7, b.d * 0.8, b.x1 - b.w * 0.2, 0, b.cz, 0.6, 0.02)); for (let k = 0; k < 3; k++) P.add('iron', box(b.w * 0.55 + 0.02, 0.03, 0.03, b.x0 + b.w * 0.275, h * (0.3 + k * 0.3), b.z1, 1)); }
  P.add('wood', box(0.14, 1.6, 0.14, cx - 7.5, 0, zWall + 1.2, 0.5), box(1.0, 0.1, 0.1, cx - 7.5, 1.15, zWall + 1.2, 0.5)); P.add('ore', lathe([[0.02, 0], [0.2, 0.02], [0.25, 0.3], [0.22, 0.6], [0.1, 0.68]], cx - 7.5, 0.6, zWall + 1.2, 12)); P.add('iron', lathe([[0.001, 0], [0.16, 0.02], [0.18, 0.12], [0.1, 0.22], [0.001, 0.25]], cx - 7.5, 1.4, zWall + 1.2, 12));
  { const ws = (c.A.npcs ?? []).find((n) => n.id.startsWith('waystone')); const x = ws ? ux(ws.x + c.ax) : c.F.x0 + 4; for (const dx of [-1.1, 1.1]) P.add('wall', box(0.6, 2.8, 0.6, x + dx, 0, zWall + 0.6, 1.3, 0.02)); { const g = new THREE.TorusGeometry(1.1, 0.25, 8, 16, Math.PI); g.translate(x, 2.8, zWall + 0.6); P.add('wall', g); } }
  void R;
};

// ------------------------------------------------------------------ M36 · Crag Path

/** A ledge road cut into the red crag: the cliff rising behind with a watchtower perched above at the west, the gorge
 *  dropping in front with a natural rock arch in the middle distance, the boulder and the ore cart on the road, rockfall,
 *  a guard rail along the front, pines on the crag. */
export const cragPath: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  c.M.iron ??= c.std({ color: 0x4a4a52, metalness: 0.8, roughness: 0.5 }); c.M.ore ??= c.std({ color: 0x6a4a3a, roughness: 1 });
  crag(c, xW0 - 4, xW1 + 4, zWall + 0.2, 9, 7);
  P.add('wall', box(1.8, 3.2, 1.8, c.F.x0 + 1.5, 9, zWall - 2.5, 1.3)); for (let k = 0; k < 4; k++) P.add('wall', box(0.4, 0.4, 0.4, c.F.x0 + 0.8 + k * 0.45, 12.2, zWall - 1.7, 1.3, 0.02)); // the watchtower above
  for (let fx = xW0; fx < xW1; fx += 1.4) P.add('wood', box(0.12, 0.9, 0.12, fx, 0, c.zFront + 0.1, 0.5)); P.add('wood', box(xW1 - xW0, 0.08, 0.08, cx, 0.82, c.zFront + 0.1, 0.5), box(xW1 - xW0, 0.06, 0.06, cx, 0.45, c.zFront + 0.1, 0.5));
  { const g = new THREE.TorusGeometry(4.5, 1.1, 10, 24, Math.PI); g.translate(cx + 2, -9, c.zFront + 14); P.add('wall', g); } // the rock arch across the gorge
  for (const p of c.A.props.filter((q) => q.id === 'boulder')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 60)); }
  for (const p of c.A.props.filter((q) => q.id === 'cart')) { const b = footBox(p.foot, c.ax); cart(c, b.cx, b.cz, b.w, b.d, uy(p.h || 66)); }
  for (let i = 0; i < 9; i++) { const s = 0.2 + R() * 0.35; const g = box(s * 1.3, s, s * 0.9, 0, 0, 0, 1.2, 0.03); g.rotateY(R() * 3); g.translate(c.F.x0 + R() * (c.F.x1 - c.F.x0), 0, zWall + 0.5 + R() * 0.6); P.add('wall', g); }
  pines(c, [{ x: cx - 5, z: zWall - 1.0, h: 2.2, lean: 0.3 }, { x: cx + 6, z: zWall - 1.2, h: 2.4, lean: -0.3 }, { x: xW1 - 1, z: zWall - 1.4, h: 2.0, lean: -0.2 }], 4.5);
};

// ------------------------------------------------------------------ M37 · Forge Road

/** The road through the mine works: rails along the back line with ore carts, timber trestles and a crane, the mill with
 *  its water-wheel at the west, the smelter's chimneys smoking, the bell tower, the ore pile and the ingot stack. */
export const forgeRoad: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  c.M.iron ??= c.std({ color: 0x4a4a52, metalness: 0.8, roughness: 0.5 }); c.M.ore ??= c.std({ color: 0x6a4a3a, roughness: 1 });
  crag(c, xW0 - 4, xW1 + 4, zWall - 2.0, 7, 6);
  rails(c, xW0, xW1, 0, zWall + 0.8); cart(c, cx - 6, zWall + 0.8, 1.3, 0.9, 0.7); cart(c, cx - 4.6, zWall + 0.8, 1.3, 0.9, 0.7);
  for (const dx of [-2, 2.5]) { for (const dz of [-0.6, 0.6]) post(c, cx + dx, 0, zWall - 0.6 + dz, 3.0, 0.16); P.add('wood', box(0.2, 0.2, 1.6, cx + dx, 3.0, zWall - 0.6, 0.6)); } P.add('wood', box(4.9, 0.2, 0.2, cx + 0.25, 3.0, zWall - 1.2, 0.6), box(4.9, 0.2, 0.2, cx + 0.25, 3.0, zWall, 0.6)); // the trestle
  { const crx = cx + 5.5; post(c, crx, 0, zWall - 0.4, 3.6, 0.22); const arm = box(3.2, 0.16, 0.16, 0, 0, 0, 0.6); arm.rotateZ(0.35); arm.translate(crx + 1.2, 3.2, zWall - 0.4); P.add('wood', arm); P.add('dark', cyl(0.012, 0.012, 1.6, crx + 2.6, 2.2, zWall - 0.4, 4)); P.add('iron', lathe([[0.001, 0], [0.18, 0.02], [0.2, 0.3], [0.1, 0.4]], crx + 2.6, 1.8, zWall - 0.4, 8)); } // the crane
  // the mill at the west: the wheel turning in a flume fed from the crag
  { const mx = c.F.x0 + 1.8, mz = zWall + 0.2; P.add('wall', box(2.4, 2.6, 2.0, mx, 0, mz - 1.2, 1.3)); { const r = box(2.8, 0.1, 2.4, 0, 0, 0, 1); r.rotateX(0.3); r.translate(mx, 2.7, mz - 1.1); P.add('roof', r); }
    const wheel = new THREE.Group(); wheel.position.set(mx + 1.4, 1.0, mz - 0.4); c.scene.add(wheel); const wm = c.M.wood;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 24), wm); rim.rotation.y = Math.PI / 2; wheel.add(rim); for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), wm); sp.rotation.x = (k / 8) * Math.PI; wheel.add(sp); const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), wm); const a = (k / 8) * Math.PI * 2; pad.position.set(0, Math.cos(a) * 1.0, Math.sin(a) * 1.0); pad.rotation.x = -a; wheel.add(pad); }
    c.sway.push((t) => { wheel.rotation.x = t * 0.9; }); waterfall(c, mx + 1.4, 3.2, 1.9, mz - 0.6, 0.5); water(c, mx + 1.4, mz + 0.2, 1.2, 1.2, 0.02, 0); }
  // the smelter: two furnaces with chimneys, the bell tower
  furnace(c, cx + 8.2, zWall + 0.5, 1.8, 2.0); furnace(c, cx + 10.4, zWall + 0.5, 1.4, 1.6);
  { const bx = cx - 9; for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) post(c, bx + dx, 0, zWall - 0.2 + dz, 3.2, 0.12); P.add('roof', box(1.4, 0.1, 1.4, bx, 3.2, zWall - 0.2, 1)); P.add('bronze', lathe([[0.001, 0], [0.2, 0.02], [0.26, 0.2], [0.22, 0.5], [0.06, 0.6], [0.001, 0.64]], bx, 2.3, zWall - 0.2, 14)); }
  for (const p of c.A.props.filter((q) => q.id === 'ore-cart')) { const b = footBox(p.foot, c.ax); cart(c, b.cx, b.cz, b.w, b.d, uy(p.h || 56)); }
  for (const p of c.A.props.filter((q) => q.id === 'ingots')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 36); for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) P.add('iron', box(b.w / 4 - 0.04, h / 3, b.d * 0.8, b.x0 + (b.w / 4) * (k + 0.5 + r * 0.5), (h / 3) * r, b.cz, 1, 0.02)); }
  void R;
};

// ------------------------------------------------------------------ M38 · Ember Quarry

/** The quarry floor: cut-rock terraces rising behind in steps, cranes and scaffolds, lava seeping through channels in the
 *  floor's back half, the ore pile and the tipped cart, the Crag King's cave mouth at the east with the war horn's pedestal
 *  glinting inside and bones at the mouth. */
export const emberQuarry: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  c.M.iron ??= c.std({ color: 0x4a4a52, metalness: 0.8, roughness: 0.5 }); c.M.ore ??= c.std({ color: 0x6a4a3a, roughness: 1 });
  for (let k = 0; k < 4; k++) P.add('wall', box(xW1 - xW0 + 10, 1.6, 2.2, cx, k * 1.6, zWall - 0.4 - k * 1.9, 1.6, 0.04)); // the terraces
  for (let x = xW0; x < xW1; x += 1.1) for (let k = 0; k < 4; k++) if (R() < 0.5) P.add('dark', box(0.04, 0.5 + R() * 0.6, 0.02, x + R() * 0.5, k * 1.6 + 0.3, zWall + 0.72 - k * 1.9, 1)); // tool marks
  lava(c, cx - 3, zWall + 1.0, 7, 0.9); lava(c, cx + 6, zWall + 1.2, 4, 0.8);
  for (const sx of [cx - 7, cx + 2.5]) { post(c, sx, 1.6, zWall - 1.0, 3.6, 0.2); const arm = box(3.0, 0.16, 0.16, 0, 0, 0, 0.6); arm.rotateZ(0.3); arm.translate(sx + 1.1, 4.9, zWall - 1.0); P.add('wood', arm); P.add('dark', cyl(0.012, 0.012, 2.0, sx + 2.4, 2.6, zWall - 1.0, 4)); } // cranes on the first terrace
  for (const p of c.A.props.filter((q) => q.id === 'ore-boulders')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 83); for (const [dx, k] of [[-0.3, 0.9], [0.25, 1], [0, 0.7]] as [number, number][]) { const g = new THREE.DodecahedronGeometry(1, 1); g.scale(b.w * 0.28, h * k * 0.5, b.d * 0.5); g.rotateY(R() * 3); g.translate(b.cx + dx * b.w, h * k * 0.5, b.cz); P.add('ore', g); } }
  for (const p of c.A.props.filter((q) => q.id === 'tipped-cart')) { const b = footBox(p.foot, c.ax); cart(c, b.cx, b.cz, b.w * 0.8, b.d, uy(p.h || 62), true); }
  // the Crag King's cave at the east: a dark mouth in the terrace wall, bones at its foot, the war horn's pedestal glinting inside
  { const mx = c.F.x1 - 1.2, mz = zWall - 0.3; const g = new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.2, 1.1, 1); g.translate(mx, 0, mz); const m = c.std({ color: 0x100806, roughness: 1 }); const mouth = new THREE.Mesh(g, m); c.scene.add(mouth); c.disposables.push(g);
    P.add('gold', lathe([[0.001, 0], [0.3, 0.02], [0.2, 0.5], [0.25, 0.6], [0.001, 0.62]], mx + 0.4, 0, mz + 0.6, 10)); halo(c, mx + 0.4, 0.8, mz + 0.7, 1.4, 0xffd080, 0.45); warmLight(c, mx + 0.4, 0.9, mz + 1.0, 1.2, 5, 0xffd080);
    for (let k = 0; k < 6; k++) { const bn = cyl(0.03, 0.04, 0.3 + R() * 0.3, 0, 0, 0, 6); bn.rotateZ(Math.PI / 2 + (R() - 0.5)); bn.rotateY(R() * 3); bn.translate(mx - 1.2 + R() * 2.4, 0.03, mz + 1.6 + R() * 1.2); P.add('moulding', bn); } }
  halo(c, cx, 3, zWall - 3, 14, 0xff5020, 0.12); // the quarry's glow on the air behind
};
