// Kit D — what Sakura's terraces carry (docs/WORLD_3D_SPEC.md §2.6, M31–M34): the shrine's court with its hall, bell
// tower, tea stall, bridge and torii; the Blossom Steps climbing behind their terrace; the Fox Shrine Path's tunnel of
// torii and its fox statues; the Bamboo Grove with the Tengu's pine. The terrace builder (look 'sakura') gives the
// golden-pink light, the grey stone, the cherry crowns and the petals; these add the places' own models.
import * as THREE from 'three';
import { box, cyl, lathe, taperTube } from '../../arena3d/RoomKit';
import { balustrade } from '../kit/terrain';
import { ux, uz, uy, footBox } from '../kit/units';
import { post, warmLight, halo, boulder, log, water, waterfall } from '../kit/props';
import { growTrees, crownCanvas } from '../kit/trees';
import { canvasTex } from '../../arena3d/RoomKit';
import { banner } from '../life/cloth';
import { pond } from '../life/pond';
import { incense } from '../life/smoke';
import { templeFront, type DressCtx, type Dressing } from './dressing';

// ------------------------------------------------------------------ the kit's pieces

/** A torii: two lacquered pillars, the upper lintel curving up at its ends, the lower tie beam, black caps. */
function torii(c: DressCtx, x: number, z: number, w = 2.2, h = 2.8, yaw = 0): void {
  c.M.lacquer ??= c.std({ color: 0xb8302a, roughness: 0.35, metalness: 0.05 });
  const g: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) g.push(cyl(0.11, 0.1, h, s * w / 2, 0, 0, 12, 0.6));
  const lintel = box(w + 0.9, 0.18, 0.22, 0, h - 0.05, 0, 0.6, 0.02); g.push(lintel);
  g.push(box(w + 0.3, 0.12, 0.16, 0, h - 0.5, 0, 0.6)); g.push(box(0.12, 0.3, 0.14, 0, h - 0.4, 0, 0.6)); // the tie and the tablet
  const dark = [box(w + 1.0, 0.07, 0.26, 0, h + 0.13, 0, 1)]; for (const s of [-1, 1]) { const cap = box(0.5, 0.06, 0.28, s * (w / 2 + 0.3), h + 0.2, 0, 1); dark.push(cap); }
  for (const q of [...g, ...dark]) { q.rotateY(yaw); q.translate(x, 0, z); }
  c.P.add('lacquer', ...g); c.P.add('dark', ...dark);
}

/** A stone lantern (tōrō): plinth, shaft, the light box with its windows, a roof and a jewel; lit: a glow. */
function stoneLantern(c: DressCtx, x: number, y: number, z: number, s = 1, lit = true): void {
  c.P.add('balustrade', lathe([[0.22, 0], [0.26, 0.04], [0.2, 0.08], [0.1, 0.1], [0.09, 0.7], [0.14, 0.74], [0.2, 0.78], [0.001, 0.78]].map(([r, h]) => [r * s, h * s] as [number, number]), x, y, z, 10));
  c.P.add('balustrade', box(0.32 * s, 0.32 * s, 0.32 * s, x, y + 0.78 * s, z, 1, 0.02), lathe([[0.3, 0], [0.34, 0.04], [0.18, 0.2], [0.08, 0.26], [0.001, 0.32]].map(([r, h]) => [r * s, h * s] as [number, number]), x, y + 1.1 * s, z, 8));
  c.P.add('dark', box(0.2 * s, 0.2 * s, 0.34 * s, x, y + 0.84 * s, z, 1), box(0.34 * s, 0.2 * s, 0.2 * s, x, y + 0.84 * s, z, 1));
  if (lit) halo(c, x, y + 0.94 * s, z + 0.16 * s, 0.9 * s, 0xffb060, 0.5);
}

/** A fox statue on a plinth with a red bib (a stone fox: body, head, two ears, a curled tail). */
function foxStatue(c: DressCtx, x: number, z: number, s = 1, plinth = 0.5, yaw = 0): void {
  c.P.add('balustrade', box(0.7 * s, plinth, 0.5 * s, x, 0, z, 1.1, 0.02));
  const g: THREE.BufferGeometry[] = [];
  g.push(lathe([[0.001, 0], [0.16, 0.02], [0.2, 0.3], [0.14, 0.7], [0.001, 0.76]].map(([r, h]) => [r * s, h * s] as [number, number]), 0, 0, 0, 10)); // the seated body
  g.push(lathe([[0.001, 0], [0.12, 0.05], [0.13, 0.2], [0.05, 0.3], [0.001, 0.32]].map(([r, h]) => [r * s, h * s] as [number, number]), 0, 0.72 * s, 0.03 * s, 10)); // the head
  for (const e of [-1, 1]) { const ear = new THREE.ConeGeometry(0.045 * s, 0.14 * s, 6); ear.translate(e * 0.07 * s, 1.03 * s, 0.02 * s); g.push(ear); }
  const tail = taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0.1 * s, 0.05 * s, -0.1 * s), new THREE.Vector3(0.22 * s, 0.25 * s, -0.16 * s), new THREE.Vector3(0.14 * s, 0.5 * s, -0.12 * s)]), 0.07 * s, 0.03 * s, 8, 6, 0.5); g.push(tail);
  for (const q of g) { q.rotateY(yaw); q.translate(x, plinth, z); } c.P.add('moulding', ...g);
  const bib = box(0.22 * s, 0.14 * s, 0.03 * s, 0, 0, 0, 1); bib.rotateY(yaw); bib.translate(x + Math.sin(yaw) * 0.13 * s, plinth + 0.6 * s, z + Math.cos(yaw) * 0.13 * s); c.P.add('lacquer', bib);
}

/** Paper streamers (shide) under a rope: short white zigzag cloths. */
function shide(c: DressCtx, x0: number, x1: number, y: number, z: number, n: number): void {
  c.P.add('terracotta', cyl(0.025, 0.025, x1 - x0, 0, 0, 0, 6).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z));
  for (let i = 0; i < n; i++) c.life.push(banner(c.scene, { x: x0 + ((x1 - x0) * (i + 0.5)) / n, y: y - 0.02, z: z + 0.02, yaw: 0, w: 0.12, h: 0.36, emblem: false }, { wind: c.air, seed: 140 + i }));
}

/** Bamboo: tall culms with pale nodes and a spray of leaves at the top, swaying (instanced). */
function bamboo(c: DressCtx, spots: { x: number; z: number; h: number }[]): void {
  const culm = c.std({ color: 0x8ab06a, roughness: 0.6 }), node = c.std({ color: 0xd8e0b0, roughness: 0.8 });
  const cg = new THREE.CylinderGeometry(0.035, 0.045, 1, 7, 1), ng = new THREE.TorusGeometry(0.045, 0.012, 5, 8);
  const culms = new THREE.InstancedMesh(cg, culm, spots.length), nodes = new THREE.InstancedMesh(ng, node, spots.length * 7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let ni = 0;
  const leafTex = canvasTex(crownCanvas(['#5a8a3a', '#7aa84a', '#3a6a2a'], 41)); c.disposables.push(leafTex);
  const lg = new THREE.PlaneGeometry(1, 1), lm = c.std({ map: leafTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, color: 0xd8f0c0 });
  const sprays = new THREE.InstancedMesh(lg, lm, spots.length * 2); let si = 0;
  spots.forEach((s, i) => {
    const lean = (c.R() - 0.5) * 0.12; q.setFromEuler(new THREE.Euler(lean, 0, (c.R() - 0.5) * 0.12));
    m4.compose(new THREE.Vector3(s.x, s.h / 2, s.z), q, new THREE.Vector3(1, s.h, 1)); culms.setMatrixAt(i, m4);
    for (let k = 1; k <= 7; k++) { const y = (s.h * k) / 8; const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + lean, 0, 0)); m4.compose(new THREE.Vector3(s.x + Math.sin(lean) * -y * 0, y, s.z), qq, new THREE.Vector3(1, 1, 1)); nodes.setMatrixAt(ni++, m4); }
    for (let k = 0; k < 2; k++) { const sc = 1.2 + c.R() * 0.6; q.setFromEuler(new THREE.Euler(0, c.R() * 3, 0)); m4.compose(new THREE.Vector3(s.x + (c.R() - 0.5) * 0.4, s.h - 0.3 - k * 0.7, s.z + (c.R() - 0.5) * 0.3), q, new THREE.Vector3(sc, sc * 0.8, 1)); sprays.setMatrixAt(si++, m4); }
  });
  nodes.count = ni; sprays.count = si; culms.castShadow = true; sprays.castShadow = true; c.scene.add(culms, nodes, sprays); c.disposables.push(cg, ng, lg);
  c.sway.push((t, w) => { const dx = Math.sin(t * 0.9) * 0.04 * w; culms.position.x = dx * 0.5; sprays.position.x = dx; }); // (the grove leans as one — a small shift, the culms' feet all but still)
}

// ------------------------------------------------------------------ M31 · Sakura Temple

/** The shrine's court: the shrine hall across the back-left with the bell tower beside it, Jiro's tea stall back-right,
 *  the Waystone at the west in a ring of stone lanterns, a torii at the west entry, the vermilion bridge over a stream at
 *  the east end (the notch), the barrels and the rock, incense at the shrine's stair, a koi pond by it. */
export const sakuraTemple: Dressing = (c) => {
  const { P, scene, zWall, cx, life, air, R } = c;
  const npc = (id: string) => (c.A.npcs ?? []).find((n) => n.id === id);
  const ay = npc('ayame'), hx = ay ? ux(ay.x + c.ax) - 1.0 : cx - 2.5;
  templeFront(c, hx, 8.6, 0.9, zWall - 0.1, { bays: 5, doorBays: [2], roofRise: 2.2 });
  // the bell tower beside the hall: four posts, a tiled roof, the bronze bell hanging (its clapper comes with the quest)
  { const bx = hx + 6.6, bz = zWall - 1.2; for (const [dx, dz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) P.add('lacquer', cyl(0.09, 0.08, 3.0, bx + dx, 0, bz + dz, 10, 0.6));
    P.add('wood', box(1.8, 0.14, 1.6, bx, 3.0, bz, 0.6)); { const g = box(2.6, 0.1, 2.3, 0, 0, 0, 1); g.rotateX(0.22); g.translate(bx, 3.35, bz + 0.1); P.add('roof', g); P.add('gold', box(2.6, 0.06, 0.1, bx, 3.75, bz - 0.9, 1)); }
    P.add('bronze', lathe([[0.001, 0], [0.3, 0.02], [0.38, 0.3], [0.34, 0.8], [0.22, 1.0], [0.08, 1.05], [0.001, 1.1]], bx, 1.9, bz, 18)); P.add('dark', cyl(0.02, 0.02, 0.4, bx, 2.9, bz, 6));
    P.add('wood', box(0.9, 0.1, 0.1, bx - 1.4, 1.6, bz + 0.9, 0.5), box(0.1, 1.6, 0.1, bx - 1.9, 0, bz + 0.9, 0.5)); } // the striker's frame
  // Jiro's tea stall: a counter under a cloth roof, kettles on a brazier, cups, a bench
  { const j = npc('jiro'); const x = j ? ux(j.x + c.ax) + 0.4 : cx + 3.5, z = zWall + 0.8;
    P.add('wood', box(2.4, 0.85, 0.7, x, 0, z, 0.6, 0.02)); for (const [dx, dz] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.5], [1.2, 0.5]]) post(c, x + dx, 0, z + dz, 2.2 - (dz > 0 ? 0.2 : 0), 0.1);
    life.push(banner(scene, { x, y: 2.25, z: z - 0.45, yaw: 0, w: 2.7, h: 0.5, emblem: false }, { wind: air, seed: 150 })); { const g = box(2.7, 0.05, 1.3, 0, 0, 0, 1); g.rotateX(0.16); g.translate(x, 2.15, z + 0.05); P.add('terracotta', g); }
    P.add('bronze', lathe([[0.001, 0], [0.12, 0.02], [0.16, 0.14], [0.1, 0.22], [0.03, 0.26]], x - 0.6, 0.85, z, 10), lathe([[0.001, 0], [0.12, 0.02], [0.16, 0.14], [0.1, 0.22], [0.03, 0.26]], x - 0.2, 0.85, z - 0.1, 10)); for (let k = 0; k < 4; k++) P.add('moulding', cyl(0.04, 0.035, 0.05, x + 0.3 + k * 0.17, 0.85, z + 0.1, 8));
    P.add('wood', box(1.4, 0.06, 0.3, x + 2.2, 0.4, z + 0.3, 0.5), box(0.08, 0.4, 0.3, x + 1.6, 0, z + 0.3, 0.5), box(0.08, 0.4, 0.3, x + 2.8, 0, z + 0.3, 0.5)); } // the bench
  // the Waystone at the west in a ring of stone lanterns, the torii at the entry
  { const ws = (c.A.npcs ?? []).find((n) => n.id.startsWith('waystone')); const x = ws ? ux(ws.x + c.ax) : c.F.x0 + 5, z = ws ? uz(ws.y) : c.F.zB;
    for (let k = 0; k < 5; k++) { const a = Math.PI * 0.15 + (k / 4) * Math.PI * 0.7; stoneLantern(c, x + Math.cos(a) * 1.7, 0, z - 0.3 - Math.sin(a) * 1.1, 0.8); } }
  torii(c, c.F.x0 + 1.2, (zWall + c.zFront) / 2, 2.6, 3.2, Math.PI / 2);
  // the stream at the east end under the vermilion bridge (the notch: the court narrows there)
  { const sx = ux(1340 + c.ax) + 1.4, zB = uz(450); water(c, sx, (zB + c.zFront) / 2 + 0.4, 1.6, c.zFront - zB + 2.4, -0.4, 2);
    P.add('lacquer', box(2.2, 0.1, c.zFront - zB + 0.2, sx, 0.02, (zB + c.zFront) / 2, 0.6)); for (const dz of [zB + 0.2, c.zFront - 0.2]) { P.add('lacquer', box(2.4, 0.07, 0.07, sx, 0.8, dz, 0.5)); for (const dx of [-1.0, -0.33, 0.33, 1.0]) P.add('lacquer', cyl(0.04, 0.04, 0.8, sx + dx, 0.02, dz, 8)); P.add('gold', ...[-1.0, 1.0].map((dx) => lathe([[0.001, 0], [0.06, 0.02], [0.05, 0.08], [0.001, 0.1]], sx + dx, 0.82, dz, 8))); } }
  // the barrels and the rock as they stand
  for (const p of c.A.props.filter((q) => q.id === 'barrels')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 104); for (const [k, dx] of [-0.3, 0.3].entries()) P.add('wood', lathe([[0.26, 0], [0.32, 0.1], [0.36, h * 0.5], [0.32, h - 0.1], [0.26, h]], b.cx + dx * b.w, 0, b.cz + (k ? -0.1 : 0.1), 14)); }
  for (const p of c.A.props.filter((q) => q.id === 'rock')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 34)); }
  // incense at the shrine's stair, a koi pond beside it, stone lanterns along the court's back
  life.push(incense(scene, [{ x: hx - 1.2, y: 0, z: zWall + 1.0 }, { x: hx + 1.2, y: 0, z: zWall + 1.0 }], { wind: air, seed: 53, soft: c.soft }));
  life.push(pond(scene, { x: hx - 5.4, z: zWall + 1.1, w: 2.0, d: 1.3, y: 0 }, { wind: air, stone: c.M.balustrade, mirror: !c.soft, sunDir: c.sunDir, sunColor: new THREE.Color(0xffc89a), skyLow: new THREE.Color(0xffd8a8), skyMid: new THREE.Color(0xe8a0b8), koi: 3, pads: 2, seed: 23 }));
  for (const x of [hx - 5.6, hx + 4.8, hx + 9.6]) stoneLantern(c, x, 0, zWall + 0.5, 1.0);
  void R; void balustrade;
};

// ------------------------------------------------------------------ M32 · Blossom Steps

/** A terrace of mossy flagstones along the mountainside: three flights of steps climbing behind between cherry trees to a
 *  lantern, stone lanterns along the back, a rope fence in front over a waterfall and the stream below, the log and the
 *  boulder. */
export const blossomSteps: Dressing = (c) => {
  const { P, zWall, cx, R } = c;
  // the flights: each a run of steps rising toward the back (scenery), landings with a lantern
  let y = 0, z = zWall - 0.2, x = cx - 1;
  for (let f = 0; f < 3; f++) { for (let k = 0; k < 9; k++) { P.add('paving', box(2.8, 0.2, 0.5, x, y, z, 1.1, 0.02)); y += 0.2; z -= 0.42; } P.add('paving', box(3.6, 0.2, 1.4, x, y, z - 0.4, 1.1, 0.02)); stoneLantern(c, x + 2.1, y + 0.2, z - 0.4, 0.9); x += 1.6; z -= 1.0; }
  for (const lx of [c.F.x0 + 1.5, c.F.x0 + 5.5, cx + 4.5, c.F.x1 - 1.5]) stoneLantern(c, lx, 0, zWall + 0.5, 1.0);
  // the hillside behind the steps: a mossy bank and cherry trees in blossom climbing with them
  { const g = new THREE.BoxGeometry(c.xW1 - c.xW0 + 14, 6, 12, 14, 1, 4); const pos = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + (R() - 0.5) * 1.2 - (pos.getZ(i) > 0 ? 3.2 : 0)); g.computeVertexNormals(); g.translate(cx, -3.0, zWall - 7); P.add(c.M.moss ? 'moss' : 'wall', g); }
  { const crownTex = canvasTex(crownCanvas(['#ffc6d8', '#f59ab9', '#fff0f4'], 32)); c.disposables.push(crownTex);
    const spots = [{ x: cx - 6, z: zWall - 1.8, h: 2.4, lean: 0.3 }, { x: cx + 3.6, z: zWall - 2.2, h: 2.6, lean: -0.2 }, { x: cx - 2.4, z: zWall - 5.5, h: 2.8, lean: 0.2 }, { x: cx + 6.5, z: zWall - 6, h: 3.0, lean: -0.3 }, { x: c.F.x0 - 1, z: zWall - 3.5, h: 2.6, lean: 0.3 }, { x: c.F.x1 + 1, z: zWall - 3, h: 2.5, lean: -0.3 }];
    const trees = growTrees(c.scene, spots, 1.6, { crownTex, crownColor: 0xffffff, crownEmissive: 0x4a1a2a, crownEmissiveIntensity: 0.5 }, R, c.soft); c.disposables.push(trees); P.add('bark', ...trees.bark); c.sway.push((t, w) => trees.update(t, w)); }
  // the rope fence along the front and the hillside falling to a stream, a small fall at the left
  for (let fx = c.xW0; fx < c.xW1; fx += 1.5) P.add('wood', box(0.1, 0.8, 0.1, fx, 0, c.zFront + 0.1, 0.5));
  P.add('terracotta', cyl(0.025, 0.025, c.xW1 - c.xW0, 0, 0, 0, 6).rotateZ(Math.PI / 2).translate(cx, 0.72, c.zFront + 0.1));
  water(c, cx, c.zFront + 3.4, c.xW1 - c.xW0 + 10, 3.0, -2.6, 0); waterfall(c, c.F.x0 + 2.5, -0.1, -2.6, c.zFront + 1.4, 1.1);
  for (const p of c.A.props.filter((q) => q.id === 'log')) { const b = footBox(p.foot, c.ax); log(c, b.x0, b.x1, b.cz, uy(p.h || 50)); }
  for (const p of c.A.props.filter((q) => q.id === 'boulder')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 63)); }
  void R;
};

// ------------------------------------------------------------------ M33 · Fox Shrine Path

/** The path under a tunnel of twelve torii along the back half of the floor, stone foxes with red bibs and lanterns
 *  between them (dark until Fox Fire is done), the great fox on its plinth, the offering chest, a shrine gate at the east. */
export const foxShrinePath: Dressing = (c) => {
  const { P, zWall, R } = c;
  // the foxes' lanterns: dark until Fox Fire is done, then lit one by one along the path (their halos and three warm lights)
  const halos: THREE.Sprite[] = [], lights: THREE.PointLight[] = [];
  for (let i = 0; i < 12; i++) { const x = c.F.x0 + 0.8 + i * ((c.F.x1 - c.F.x0 - 1.6) / 11); torii(c, x, zWall + 0.9, 2.0, 2.7, Math.PI / 2); if (i % 2 === 1) foxStatue(c, x - 0.1, zWall + 0.2, 0.55, 0.35, 0); if (i % 2 === 0) { stoneLantern(c, x, 0, zWall + 0.25, 0.7, false); halos.push(halo(c, x, 0.66, zWall + 0.36, 0.7, 0xffb060, 0)); if (i % 4 === 0) { const L = new THREE.PointLight(0xffa050, 0, 6, 2); L.position.set(x, 0.9, zWall + 0.6); c.scene.add(L); lights.push(L); } } }
  let litAt = NaN, first = true;
  c.sway.push((t) => { const want = !!c.state.done?.includes('fox_fire'); // (the first frame takes the state as is; a quest done while standing here lights them one by one over three seconds)
    if (first) { first = false; litAt = want ? -99 : NaN; } else if (want && Number.isNaN(litAt)) litAt = t; else if (!want) litAt = NaN;
    const litT = Number.isNaN(litAt) ? 0 : t - litAt;
    halos.forEach((h, i) => { const on = litT * 4 > i ? 1 : 0; (h.material as THREE.SpriteMaterial).opacity = on * 0.5 * (1 + Math.sin(t * 3 + i) * 0.08); });
    lights.forEach((L, i) => { L.intensity = litT * 4 > i * 2 ? 1.6 : 0; }); });
  shide(c, c.F.x0 + 0.8, c.F.x1 - 0.8, 2.75, zWall - 0.15, 24);
  for (const p of c.A.props.filter((q) => q.id === 'fox-statue')) { const b = footBox(p.foot, c.ax); foxStatue(c, b.cx, b.cz, 1.5, uy(p.h || 74), 0.3); }
  for (const p of c.A.props.filter((q) => q.id === 'offering-chest')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 56); P.add('wood', box(b.w, h, b.d, b.cx, 0, b.cz, 0.6, 0.02)); for (let k = 0; k < 3; k++) P.add('moulding', lathe([[0.001, 0], [0.1, 0.02], [0.12, 0.08], [0.08, 0.1]], b.x0 + 0.3 + k * 0.4, h, b.cz, 10)); P.add('terracotta', lathe([[0.001, 0], [0.08, 0.02], [0.1, 0.2], [0.05, 0.26], [0.03, 0.3]], b.x1 - 0.3, h, b.cz, 10)); }
  { const gx = c.F.x1 - 0.6; torii(c, gx, (zWall + c.zFront) / 2, 3.0, 3.4, Math.PI / 2); } // the shrine gate at the east
  void R;
};

// ------------------------------------------------------------------ M34 · Bamboo Grove

/** A grove clearing on a ridge: bamboo dense behind, a bamboo fence and gate at the west, the log stack and the rock, a
 *  stream in a stone channel with a plank bridge at the front, the Ronin's training posts, the Tengu's great pine on a
 *  crag at the east. */
export const bambooGrove: Dressing = (c) => {
  const { P, scene, zWall, cx, R } = c;
  const spots: { x: number; z: number; h: number }[] = [];
  for (let x = c.xW0 - 2; x < c.xW1 + 2; x += 0.55) for (const dz of [0.4, 1.3, 2.4, 3.6]) if (R() < 0.8) spots.push({ x: x + (R() - 0.5) * 0.4, z: zWall + dz + (R() - 0.5) * 0.4, h: 5.5 + R() * 2.5 });
  bamboo(c, c.soft ? spots.filter((_, i) => i % 2 === 0) : spots);
  // the fence and gate at the west: bamboo rails
  for (let fx = c.F.x0 - 2; fx < c.F.x0 + 1.5; fx += 0.4) P.add('terracotta', cyl(0.03, 0.03, 1.1, fx, 0, c.F.zB + 0.2, 6)); P.add('wood', box(3.6, 0.06, 0.06, c.F.x0 - 0.2, 0.9, c.F.zB + 0.2, 0.5), box(3.6, 0.06, 0.06, c.F.x0 - 0.2, 0.4, c.F.zB + 0.2, 0.5));
  for (const p of c.A.props.filter((q) => q.id === 'logs')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 58); log(c, b.x0, b.x1, b.cz + 0.15, h * 0.55); log(c, b.x0 + 0.2, b.x1 - 0.2, b.cz - 0.15, h * 0.55); log(c, b.x0 + 0.3, b.x1 - 0.3, b.cz, h); }
  for (const p of c.A.props.filter((q) => q.id === 'rock')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 42)); }
  // the stream in its channel along the front, the plank bridge
  P.add('balustrade', box(c.xW1 - c.xW0 + 8, 0.25, 0.2, cx, -0.25, c.zFront + 0.1, 1.1), box(c.xW1 - c.xW0 + 8, 0.25, 0.2, cx, -0.25, c.zFront + 1.3, 1.1)); water(c, cx, c.zFront + 0.7, c.xW1 - c.xW0 + 8, 1.0, -0.18, 3);
  P.add('wood', box(1.6, 0.08, 1.5, cx + 2, -0.02, c.zFront + 0.7, 0.6));
  // the Ronin's training posts: bamboo dummies with straw
  for (const dx of [-5, -2.5, 1.5]) { P.add('terracotta', cyl(0.06, 0.06, 1.5, cx + dx, 0, zWall + 0.3, 8)); P.add('paper', lathe([[0.02, 0], [0.16, 0.04], [0.2, 0.3], [0.16, 0.5], [0.05, 0.56]], cx + dx, 0.7, zWall + 0.3, 10)); }
  // the Tengu's roost: a crag at the east with a great pine leaning out, a rope torii at its foot
  { const px = c.F.x1 - 1.6, pz = zWall + 0.4; P.add('wall', lathe([[1.6, 0], [1.8, 0.3], [1.3, 1.2], [1.0, 2.0], [0.001, 2.1]], px, 0, pz - 0.6, 10, 1.3));
    const pineTex = canvasTex(crownCanvas(['#2e4a30', '#3a5a38', '#24402a'], 43)); c.disposables.push(pineTex);
    const pine = growTrees(scene, [{ x: px, z: pz - 0.6, h: 3.6, lean: -0.35 }], 2.0, { crownTex: pineTex, crownColor: 0xd8e0d0, crownEmissive: 0x0a1a0a, crownEmissiveIntensity: 0.3, clumpScale: 0.8 }, R, c.soft); c.disposables.push(pine); P.add('bark', ...pine.bark); c.sway.push((t, w) => pine.update(t, w));
    for (const s of [-1, 1]) P.add('wood', cyl(0.06, 0.06, 1.8, px + s * 0.9, 0, pz + 1.2, 8)); P.add('terracotta', cyl(0.03, 0.03, 1.9, 0, 0, 0, 6).rotateZ(Math.PI / 2).translate(px, 1.75, pz + 1.2)); for (let k = 0; k < 4; k++) c.life.push(banner(scene, { x: px - 0.6 + k * 0.4, y: 1.72, z: pz + 1.22, yaw: 0, w: 0.1, h: 0.3, emblem: false }, { wind: c.air, seed: 160 + k }));
    warmLight(c, px, 2.8, pz + 0.4, 0.8, 5, 0xffd0a0); }
  c.M.paper ??= c.std({ color: 0xc8b890, roughness: 0.9 });
  void taperTube;
};
