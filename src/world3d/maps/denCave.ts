// Kit C — the Thief's Den's five rooms in 3D (docs/WORLD_3D_SPEC.md §2.5, M26–M30): interiors inside the Elder Tree. A
// root-walled cave per room — a vault of woven roots over a floor of packed earth, the entry sealed behind, the stage
// gate at the east end (a wall of roots that parts when the stage clears) — lit by glowcaps (blue-violet) and the
// thieves' lanterns (warm); each room its own fixtures: the cellar's stores, the four root lanterns on their pedestals,
// the five lantern ledges, the Magpie's nest with its chests and cauldron, the hoard's mounds of coins.
import * as THREE from 'three';
import type { Room } from '../../arena3d/Room';
import { Parts, box, cyl, lathe, canvasTex, glowCanvas, shadowCanvas, taperTube } from '../../arena3d/RoomKit';
import { AREAS } from '../../world/Areas';
import { footBox, rng, ux, uz, uy, type Disposable } from '../kit/units';
import { skyAndLight } from '../kit/sky';
import { Tiles, earthCanvas, rootCanvas, coinCanvas, ashlarCanvas } from '../kit/materials';
import { contactShade } from '../kit/terrain';
import { type PropCtx, glowcaps, halo, warmLight, post, chimneySmoke } from '../kit/props';
import { type Life, type Wind, stillAir, tex as lifeTex, dotCanvas, Puffs } from '../life/kit';
import { paperLanterns } from '../life/lanterns';
import { fireflies } from '../life/butterflies';
import type { PlaceState } from './islandTerrace';
/** The triangles of a strip turned the other way round (the vault's inside must face in). */
const flipWinding = (g: THREE.BufferGeometry) => { const ix = g.index; if (ix) { for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); } ix.needsUpdate = true; } return g; };

export interface DenSpec { stage: 1 | 2 | 3 | 4 | 5; seed?: number }

/** A room's builder, bound to where the hero is and to the den's state (`focus.denStage`, `focus.denLit`). */
export const denCave = (areaId: string, spec: DenSpec) => (focus: PlaceState) => (scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, F: { x0: number; x1: number; zB: number; zF: number }, soft: boolean): Room => {
  const A = AREAS[areaId], ax = A.x;
  const R = rng(spec.seed ?? 20261060 + spec.stage);
  const disposables: Disposable[] = [];
  let shadowDirty = true;
  const tiles = new Tiles(renderer, 'den', () => { shadowDirty = true; }); disposables.push(tiles);
  const cx = (F.x0 + F.x1) / 2, zMid = (F.zB + F.zF) / 2;
  const zWall = F.zB - 1.5, zFront = F.zF + 3.6, xW0 = F.x0 - 1.0, xW1 = F.x1 + 1.0, H = 4.9;

  // ------------------------------------------------------------------ light: no sun — a faint top light for shape, the mushrooms and lanterns the rest
  const sky = skyAndLight(scene, front, renderer, {
    cx, cz: zMid, soft, sunFrom: new THREE.Vector3(0.15, 1, 0.4), sunColor: 0x7a6ab0, sunIntensity: 0.55, hemiSky: 0x3a3060, hemiGround: 0x16101a, hemiIntensity: 0.9,
    top: 0x120a16, mid: 0x1a1020, low: 0x221426, background: 0x120a14, fog: { color: 0x1a1020, near: 9, far: 34 }, exposure: 1.0, envIntensity: 0.12, shadowReach: 9,
  });
  disposables.push(...sky.disposables);

  // ------------------------------------------------------------------ materials
  const std = (o: THREE.MeshStandardMaterialParameters) => tiles.use(new THREE.MeshStandardMaterial(o));
  const earth = tiles.pair('earth_packed', () => earthCanvas(), 1, 1.8), root = tiles.pair('root_bark', () => rootCanvas(), 1, 2.4), coin = tiles.pair('coin_heap', () => coinCanvas(), 1, 1.6);
  const M: Record<string, THREE.Material> = {
    earth: std({ map: earth.map, normalMap: earth.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, color: 0xb8a898 }),
    root: std({ map: root.map, normalMap: root.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, color: 0xa08a90 }),
    bark: std({ map: root.map, normalMap: root.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, color: 0x9a8088 }),
    stone: std({ map: canvasTex(ashlarCanvas([120, 104, 118], 3)), roughness: 0.95, color: 0x9a8ea4 }),
    wood: std({ color: 0x4a3426, roughness: 0.75 }),
    dark: std({ color: 0x1a1414, roughness: 0.9 }),
    gold: std({ color: 0xe0ab4c, metalness: 1, roughness: 0.3 }),
    coins: std({ map: coin.map, normalMap: coin.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), metalness: 0.9, roughness: 0.35, color: 0xffe0a0, emissive: 0x4a3008, emissiveIntensity: 0.3 }),
    iron: std({ color: 0x4a4a52, metalness: 0.8, roughness: 0.5 }),
    cloth: std({ color: 0x5a2a7a, roughness: 0.9 }),
    paper: std({ color: 0xa08870, roughness: 0.8 }),
  };
  const P = new Parts();
  const air: Wind = stillAir(); air.x = 0.05; air.z = 0.02;
  const life: Life[] = [];
  const warm: THREE.PointLight[] = [];
  const sway: ((t: number, wind: number) => void)[] = [];
  const ctx: PropCtx = { P, scene, M, R, life, air, soft, std, sway, disposables, warm, sunDir: new THREE.Vector3(0.15, 1, 0.4) };

  // ------------------------------------------------------------------ the cave: the earth floor, the vault of roots, the walls at both ends
  { const t = earth.map.clone(); t.needsUpdate = true; t.repeat.set((xW1 - xW0 + 8) / 2.2, (zFront - zWall + 2) / 2.2); const n = earth.normalMap.clone(); n.needsUpdate = true; n.repeat.copy(t.repeat); disposables.push(t, n);
    const g = new THREE.PlaneGeometry(xW1 - xW0 + 8, zFront - zWall + 2); g.rotateX(-Math.PI / 2); g.translate(cx, 0, (zWall + zFront) / 2); disposables.push(g);
    const floor = new THREE.Mesh(g, std({ map: t, normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, color: 0xb8a898 })); floor.receiveShadow = true; scene.add(floor); }
  { // the vault: a strip from the back wall's foot up over the room and down to a lip above the camera, bumpy, its inside facing in
    const arc = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.2, zWall + 0.2), new THREE.Vector3(0, 1.8, zWall - 0.6), new THREE.Vector3(0, H, zMid - 1.5), new THREE.Vector3(0, H - 0.4, zMid + 2.5), new THREE.Vector3(0, 3.0, zFront + 0.6)]);
    const NX = 30, NA = 16, pos: number[] = [], uv: number[] = [], idx: number[] = [], pts = arc.getSpacedPoints(NA);
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NA; j++) { const x = xW0 - 1.5 + ((xW1 - xW0 + 3) * i) / NX, p = pts[j]; const bump = (R() - 0.5) * 0.45 * (j > 0 && j < NA ? 1 : 0); pos.push(x, p.y + bump * 0.6, p.z + bump); uv.push(x / 1.6, (j / NA) * 7); }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // the faces must look into the room (toward the axis): check one and flip the winding if not
    const v = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); const fn = new THREE.Vector3().subVectors(v(idx[1]), v(idx[0])).cross(new THREE.Vector3().subVectors(v(idx[2]), v(idx[0])));
    if (fn.dot(new THREE.Vector3(cx, 1.5, zMid).sub(v(idx[0]))) < 0) flipWinding(g); g.computeVertexNormals();
    const vault = new THREE.Mesh(g, M.root); vault.receiveShadow = true; scene.add(vault); disposables.push(g); }
  // roots woven over the vault: tubes meandering along the back wall, a few across the ceiling, knots
  for (let i = 0; i < (soft ? 9 : 16); i++) {
    const x0 = xW0 - 1 + R() * (xW1 - xW0 + 2), up = R() < 0.6, pts: THREE.Vector3[] = [];
    if (up) for (let k = 0; k < 5; k++) pts.push(new THREE.Vector3(x0 + (R() - 0.5) * 2.2 + k * 0.3, k * (H / 4.6) + R() * 0.2, zWall + 0.25 - (k / 4) * 0.5 + (R() - 0.5) * 0.2));
    else for (let k = 0; k < 5; k++) pts.push(new THREE.Vector3(x0 + k * 1.2 + (R() - 0.5) * 0.5, H - 0.1 - (k === 0 || k === 4 ? 0.4 : 0) + (R() - 0.5) * 0.15, zMid - 1.5 + (R() - 0.5) * 1.6));
    P.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), 0.12 + R() * 0.16, 0.06 + R() * 0.08, 10, 7, 0.6));
  }
  for (let i = 0; i < 6; i++) { const x = xW0 + R() * (xW1 - xW0), y = 0.4 + R() * 3.2; P.add('bark', lathe([[0.001, 0], [0.3, 0.05], [0.42, 0.2], [0.34, 0.4], [0.001, 0.48]], x, y, zWall + 0.1, 10)); }
  // the walls at the room's ends: the way back sealed (the entry wall / the room before's gate), the stage gate east
  const endWall = (x: number, open: boolean) => { // a wall of woven roots across the cave: two halves that part when the gate opens
    const halves: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
      const PH = new Parts();
      PH.add('root', box(0.8, H + 0.4, (zFront - zWall) / 2 + 0.6, 0, -0.2, zWall + (side < 0 ? (zFront - zWall) / 4 : (3 * (zFront - zWall)) / 4), 1.6, 0.03));
      for (let k = 0; k < 6; k++) { const z0 = zWall + (side < 0 ? 0 : (zFront - zWall) / 2) + R() * ((zFront - zWall) / 2), pts = [0, 1, 2, 3].map((q) => new THREE.Vector3((R() - 0.5) * 0.5, q * (H / 3) + (R() - 0.5) * 0.3, z0 + (R() - 0.5) * 0.8)); PH.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), 0.1 + R() * 0.14, 0.06, 8, 7, 0.6)); }
      PH.build(M, g); halves.push(g);
    }
    return { halves, open: open ? 1 : 0, x };
  };
  const west = endWall(xW0 - 0.3, false);
  const gate = spec.stage < 5 ? endWall(xW1 + 0.3, false) : null;
  if (spec.stage === 1) { // the Elder Tree's door behind: its light fading through the roots
    halo(ctx, xW0 - 0.1, 1.4, zMid, 4.5, 0xffb060, 0.25);
  }
  if (spec.stage === 5) { // the way out: a root door at the east with the Hollow's dusk light behind it
    const dz = zMid; P.add('bark', box(0.5, 3.0, 0.5, xW1 + 0.3, 0, dz - 1.4, 1, 0.02), box(0.5, 3.0, 0.5, xW1 + 0.3, 0, dz + 1.4, 1, 0.02)); { const g = new THREE.TorusGeometry(1.6, 0.3, 8, 20, Math.PI); g.rotateY(Math.PI / 2); g.translate(xW1 + 0.3, 3.0, dz); P.add('bark', g); }
    const m = std({ color: 0xe8a898, emissive: 0xc08090, emissiveIntensity: 0.9, fog: false }); const d = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.2), m); d.rotation.y = -Math.PI / 2; d.position.set(xW1 + 0.6, 1.6, dz); scene.add(d); disposables.push(d.geometry);
    halo(ctx, xW1 + 0.2, 1.6, dz, 5, 0xe8a0a0, 0.3);
  }

  // ------------------------------------------------------------------ the den's light: glowcaps and lanterns on hooks
  const glowSpots: { x: number; z: number }[] = []; for (let x = F.x0 + 1.5; x < F.x1 - 1; x += 3.6) glowSpots.push({ x: x + (R() - 0.5) * 1.5, z: zWall + 0.35 + R() * 0.4 });
  glowcaps(ctx, glowSpots); for (const [i, s] of glowSpots.entries()) if (i % 3 === 1) warmLight(ctx, s.x, 0.5, s.z + 0.4, 1.4, 6, 0x6a7aff); // (one blue light per three clusters: the lanterns' lights come on top, and the stage keeps its own eight)
  for (const lx of [F.x0 + 3.5, F.x1 - 3.5]) { P.add('iron', cyl(0.03, 0.03, 0.5, lx, 2.3, zWall + 0.1, 6)); { const g = new THREE.TorusGeometry(0.14, 0.02, 6, 10, Math.PI); g.rotateZ(Math.PI); g.translate(lx + 0.14, 2.8, zWall + 0.35); P.add('iron', g); } life.push(paperLanterns(scene, [{ x: lx + 0.28, y: 2.8, z: zWall + 0.4 }], { wind: air, seed: 30 + Math.round(lx), drop: 0.1, color: 0xf0c890, glow: 0xffa050 })); warmLight(ctx, lx + 0.28, 2.3, zWall + 0.8, 2.0, 8); }
  // sigil spirals on the walls (the thieves' marks), dim violet
  { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.strokeStyle = 'rgba(190,140,255,0.9)'; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < Math.PI * 7; a += 0.1) { const r = 4 + a * 2.6; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    const t = canvasTex(c); disposables.push(t); const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }); disposables.push(m);
    for (const sx of [cx - 5.5, cx + 4.5]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), m); s.position.set(sx, 2.2, zWall + 0.26); scene.add(s); disposables.push(s.geometry); } }

  // ------------------------------------------------------------------ the rooms' own fixtures
  const lit: { set(i: number, on: boolean): void; n: number } = { set: () => undefined, n: 0 };
  const propOf = (id: string) => A.props.find((p) => p.id === id);
  const fb = (id: string) => { const p = propOf(id); return p ? { b: footBox(p.foot, ax), h: uy(p.h || 90) } : null; };
  if (spec.stage === 1) { // the Root Cellar: a mushroom cluster, a great root knot across the middle-back, the thieves' crates and shelves
    const mu = fb('mushroom'); if (mu) { P.add('paper', lathe([[0.001, 0], [0.5, 0.02], [0.4, 0.5], [0.3, mu.h]], mu.b.cx, 0, mu.b.cz, 12)); glowcaps(ctx, [{ x: mu.b.cx, z: mu.b.cz, y: mu.h }, { x: mu.b.x0 + 0.5, z: mu.b.z1 - 0.3 }, { x: mu.b.x1 - 0.5, z: mu.b.z0 + 0.4 }], 0x8a90ff); P.add('bark', box(mu.b.w, mu.h * 0.5, mu.b.d, mu.b.cx, 0, mu.b.cz, 1.2, 0.08)); }
    const rk = fb('root-knot'); if (rk) { const pts = [new THREE.Vector3(rk.b.x0 - 0.6, -0.3, rk.b.cz + 0.2), new THREE.Vector3(rk.b.x0 + rk.b.w * 0.3, rk.h, rk.b.cz - 0.1), new THREE.Vector3(rk.b.x1 - rk.b.w * 0.3, rk.h * 0.9, rk.b.cz + 0.1), new THREE.Vector3(rk.b.x1 + 0.6, -0.3, rk.b.cz - 0.2)]; P.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), rk.h * 0.55, rk.h * 0.5, 12, 9, 0.6)); P.add('bark', box(rk.b.w, rk.h, rk.b.d * 0.6, rk.b.cx, 0, rk.b.cz, 1.2, 0.1)); }
    const cr = fb('crates'); if (cr) { const { b, h } = cr; P.add('wood', box(b.w * 0.5, h, b.d, b.x0 + b.w * 0.25, 0, b.cz, 0.6, 0.02), box(b.w * 0.45, h * 0.65, b.d * 0.9, b.x1 - b.w * 0.225, 0, b.cz, 0.6, 0.02), box(b.w * 0.3, h * 0.35, b.d * 0.6, b.x1 - b.w * 0.25, h * 0.65, b.cz, 0.6, 0.02)); for (let k = 0; k < 3; k++) P.add('dark', box(b.w * 0.5 + 0.02, 0.03, 0.03, b.x0 + b.w * 0.25, h * (0.3 + k * 0.3), b.z1, 1)); P.add('cloth', box(b.w * 0.3, 0.08, b.d * 0.6, b.x1 - b.w * 0.25, h, b.cz, 1)); }
    for (let k = 0; k < 3; k++) { const x = F.x0 + 7 + k * 1.3; P.add('wood', box(1.2, 0.06, 0.4, x, 1.1 + (k % 2) * 0.6, zWall + 0.3, 0.6)); for (let j = 0; j < 3; j++) P.add(j === 1 ? 'gold' : 'paper', lathe([[0.001, 0], [0.09, 0.02], [0.1, 0.16], [0.05, 0.2], [0.001, 0.22]], x - 0.4 + j * 0.4, 1.16 + (k % 2) * 0.6, zWall + 0.3, 8)); } // shelves with jars
  }
  if (spec.stage === 2) { // the Hanging Roots: curtains of roots from the vault, the four pedestals with a root lantern each
    for (let i = 0; i < (soft ? 18 : 34); i++) { const x = xW0 + R() * (xW1 - xW0), z = zWall + 0.6 + R() * (F.zF - zWall - 0.8), top = H - 0.3, len = 1.2 + R() * 2.0; P.add('bark', taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(x, top, z), new THREE.Vector3(x + (R() - 0.5) * 0.4, top - len * 0.5, z + (R() - 0.5) * 0.3), new THREE.Vector3(x + (R() - 0.5) * 0.6, top - len, z + (R() - 0.5) * 0.4)]), 0.05 + R() * 0.06, 0.015, 6, 6, 0.6)); }
    const tips: { glow: THREE.Sprite; mat: THREE.MeshStandardMaterial; x: number; y: number; z: number }[] = [];
    const lights = [0, 1, 2].map(() => { const L = new THREE.PointLight(0xffa050, 0, 7, 2); scene.add(L); return L; });
    A.props.filter((p) => p.id.startsWith('pedestal')).sort((a, b) => a.id.localeCompare(b.id)).forEach((p) => {
      const b = footBox(p.foot, ax), h = uy(p.h || 152);
      P.add('stone', lathe([[b.w * 0.5, 0], [b.w * 0.55, 0.08], [b.w * 0.4, 0.3], [b.w * 0.36, h - 0.25], [b.w * 0.5, h - 0.08], [b.w * 0.5, h], [0.001, h]], b.cx, 0, b.cz, 14, 1.1)); // the stump of stone
      P.add('bark', lathe([[0.001, 0], [0.34, 0.03], [0.3, 0.14], [0.001, 0.16]], b.cx, h, b.cz, 12)); // the bowl of root
      const curl = taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(b.cx + 0.28, h, b.cz), new THREE.Vector3(b.cx + 0.36, h + 0.6, b.cz - 0.05), new THREE.Vector3(b.cx + 0.1, h + 0.95, b.cz), new THREE.Vector3(b.cx - 0.12, h + 0.7, b.cz + 0.05)]), 0.07, 0.03, 8, 6, 0.6);
      const mat = std({ map: root.map, roughness: 0.9, color: 0x9a8088, emissive: 0xff9a40, emissiveIntensity: 0 }); const m = new THREE.Mesh(curl, mat); m.castShadow = true; scene.add(m); disposables.push(curl);
      const glow = halo(ctx, b.cx - 0.1, h + 0.72, b.cz + 0.1, 1.6, 0xffb060, 0); tips.push({ glow, mat, x: b.cx - 0.1, y: h + 0.72, z: b.cz + 0.1 });
    });
    lit.n = tips.length; lit.set = (i, on) => { const t = tips[i]; if (!t) return; t.mat.emissiveIntensity = on ? 1.6 : 0; (t.glow.material as THREE.SpriteMaterial).opacity = on ? 0.6 : 0; };
    sway.push(() => { // the warm lights go to the lit ones (three at most)
      let k = 0; for (const [i, t] of tips.entries()) { if (!(focus.denLit ?? []).includes(i) || k >= lights.length) continue; const L = lights[k++]; L.position.set(t.x, t.y, t.z + 0.3); L.intensity = 2.4; } for (; k < lights.length; k++) lights[k].intensity = 0; });
  }
  if (spec.stage === 3) { // the Lantern Ledges: five stone shelves at different heights with 1..5 lanterns each, pools between
    const groups: { paper: THREE.MeshStandardMaterial; glows: THREE.Sprite[]; x: number; y: number; z: number }[] = [];
    const lights = [0, 1, 2].map(() => { const L = new THREE.PointLight(0xffa050, 0, 7, 2); scene.add(L); return L; });
    A.props.filter((p) => p.id.startsWith('ledge')).sort((a, b) => a.id.localeCompare(b.id)).forEach((p, i) => {
      const b = footBox(p.foot, ax), h = uy(p.h || 108), dh = [0, 0.5, 0.25, 0.7, 0.4][i]; // (the shelf stands higher behind the walkable ledge)
      P.add('stone', box(b.w, h, b.d, b.cx, 0, b.cz, 1.1, 0.04)); P.add('stone', box(b.w + 0.3, 0.3, 0.7, b.cx, h + dh, b.z0 - 0.3, 1.1, 0.03), box(b.w + 0.3, dh + 0.3, 0.3, b.cx, h, b.z0 - 0.5, 1.1)); // the ledge, the shelf behind it
      const paper = std({ color: 0xa08870, emissive: 0xff9a40, emissiveIntensity: 0, roughness: 0.8 }); const glows: THREE.Sprite[] = [];
      for (let k = 0; k <= i; k++) { const lx = b.cx - (i * 0.42) / 2 + k * 0.42, ly = h + dh + 0.3, lz = b.z0 - 0.3; const body = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.1, 0], [0.16, 0.08], [0.17, 0.24], [0.15, 0.36], [0.09, 0.42], [0.001, 0.42]].map(([r, q]) => new THREE.Vector2(r, q)), 14), paper); body.position.set(lx, ly, lz); body.castShadow = true; scene.add(body); disposables.push(body.geometry); P.add('dark', cyl(0.1, 0.1, 0.03, lx, ly + 0.42, lz, 10)); glows.push(halo(ctx, lx, ly + 0.22, lz + 0.1, 1.1, 0xffb060, 0)); }
      groups.push({ paper, glows, x: b.cx, y: h + dh + 0.5, z: b.z0 });
    });
    lit.n = groups.length; lit.set = (i, on) => { const g = groups[i]; if (!g) return; g.paper.emissiveIntensity = on ? 1.4 : 0; for (const s of g.glows) (s.material as THREE.SpriteMaterial).opacity = on ? 0.5 : 0; };
    sway.push(() => { let k = 0; for (const [i, g] of groups.entries()) { if (!(focus.denLit ?? []).includes(i) || k >= lights.length) continue; const L = lights[k++]; L.position.set(g.x, g.y, g.z + 0.6); L.intensity = 2.4; } for (; k < lights.length; k++) lights[k].intensity = 0; });
    for (const x of [F.x0 + 2.2, cx + 1.0, F.x1 - 3.2]) { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); g.scale(1.1 + R() * 0.6, 1, 0.5 + R() * 0.3); g.translate(x, 0.015, F.zF - 0.5 + R() * 0.4); const m = std({ color: 0x2a2440, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 }); scene.add(new THREE.Mesh(g, m)); disposables.push(g); } // the still pools
  }
  if (spec.stage === 4) { // the Magpie's Nest: a great nest of twigs and silks on a root platform at the back, the chests, the cauldron, trinkets on strings, Pouncer's perch
    const nx = cx + 1, nz = zWall + 1.2, nr = 2.6;
    P.add('bark', lathe([[nr + 0.6, 0], [nr + 0.4, 0.5], [nr * 0.8, 0.9], [0.001, 0.9]], nx, 0, nz, 18, 1.2)); // the platform
    for (let i = 0; i < (soft ? 70 : 150); i++) { const a = R() * Math.PI * 2, r = nr * (0.75 + R() * 0.35), g = cyl(0.025, 0.02, 0.6 + R() * 0.9, 0, 0, 0, 5, 1); g.rotateZ(Math.PI / 2 + (R() - 0.5) * 0.6); g.rotateY(a + Math.PI / 2 + (R() - 0.5) * 0.5); g.translate(nx + Math.cos(a) * r, 0.9 + R() * 0.7, nz + Math.sin(a) * r * 0.7); P.add('wood', g); } // the twigs
    for (let i = 0; i < 8; i++) { const a = R() * Math.PI * 2; const g = box(0.5 + R() * 0.5, 0.06, 0.35, 0, 0, 0, 1); g.rotateY(a); g.translate(nx + Math.cos(a) * nr * 0.8, 1.0 + R() * 0.5, nz + Math.sin(a) * nr * 0.55); P.add('cloth', g); } // the silks
    const ch = fb('chests'); if (ch) { const { b, h } = ch; for (const [k, dx] of [-0.3, 0.3].entries()) { P.add('wood', box(b.w * 0.42, h * 0.7, b.d * 0.8, b.cx + dx * b.w, 0, b.cz, 0.6, 0.02)); const lid = box(b.w * 0.42, 0.1, b.d * 0.8, 0, 0, 0, 0.6); lid.rotateX(-0.9 + k * 0.3); lid.translate(b.cx + dx * b.w, h * 0.7, b.z0 + 0.05); P.add('wood', lid); P.add('coins', box(b.w * 0.36, h * 0.3, b.d * 0.6, b.cx + dx * b.w, h * 0.7 - 0.05, b.cz, 1.2, 0.06)); P.add('iron', box(b.w * 0.44, 0.04, 0.04, b.cx + dx * b.w, h * 0.35, b.z1 + 0.01, 1)); } }
    const ca = fb('cauldron'); if (ca) { const { b, h } = ca; P.add('iron', lathe([[0.001, 0], [0.2, 0], [0.42, 0.1], [0.5, 0.5], [0.46, h - 0.1], [0.5, h - 0.05], [0.5, h], [0.42, h], [0.4, h - 0.1]], b.cx, 0.15, b.cz, 18)); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; P.add('iron', cyl(0.03, 0.04, 0.2, b.cx + Math.cos(a) * 0.3, 0, b.cz + Math.sin(a) * 0.3, 6)); } P.add('dark', cyl(0.4, 0.4, 0.03, b.cx, h + 0.1, b.cz, 16)); halo(ctx, b.cx, 0.2, b.cz + 0.2, 1.4, 0xff7a30, 0.5); warmLight(ctx, b.cx, 0.4, b.cz + 0.4, 2.0, 6, 0xff8a40); chimneySmoke(ctx, [{ x: b.cx, y: h + 0.2, z: b.cz }]); }
    for (let i = 0; i < 9; i++) { const x = nx - 3.5 + i * 0.9 + (R() - 0.5) * 0.4, top = H - 0.4, len = 0.8 + R() * 1.4; P.add('dark', cyl(0.008, 0.008, len, x, top - len, nz - 0.4 + (R() - 0.5) * 0.8, 4)); P.add(R() < 0.5 ? 'gold' : 'iron', R() < 0.5 ? lathe([[0.001, 0], [0.06, 0.02], [0.07, 0.08], [0.03, 0.12], [0.001, 0.13]], x, top - len - 0.13, nz - 0.4, 8) : box(0.08, 0.12, 0.02, x, top - len - 0.12, nz - 0.4, 1)); halo(ctx, x, top - len - 0.05, nz - 0.3, 0.35, 0xfff0c0, 0.5); } // trinkets on strings
    P.add('bark', taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(nx - 4, H - 1.2, zWall + 0.3), new THREE.Vector3(nx - 1, 3.0, nz - 0.4), new THREE.Vector3(nx + 2.5, 3.1, nz - 0.6), new THREE.Vector3(nx + 5, H - 1.0, zWall + 0.2)]), 0.28, 0.2, 12, 8, 0.6)); // Pouncer's perch
  }
  if (spec.stage === 5) { // the Treasure Hoard: mounds of coins sloping up to the back, open chests spilling, barrels, gems, the golden light of the heap
    for (const [dx, w, h] of [[-5.5, 4.2, 1.1], [-1.5, 5.0, 1.5], [3.2, 4.4, 1.2], [7.0, 3.4, 0.9]] as [number, number, number][]) { const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); const pos = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) { const k = 1 + (R() - 0.5) * 0.12; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); } g.computeVertexNormals(); g.scale(w / 2, h, 1.6); g.translate(cx + dx, 0, zWall + 1.4); P.add('coins', g); }
    const ch = fb('chest'); if (ch) { const { b, h } = ch; P.add('wood', box(b.w * 0.5, h * 0.65, b.d * 0.8, b.cx, 0, b.cz, 0.6, 0.02)); const lid = box(b.w * 0.5, 0.1, b.d * 0.8, 0, 0, 0, 0.6); lid.rotateX(-1.0); lid.translate(b.cx, h * 0.65, b.z0 + 0.05); P.add('wood', lid); P.add('coins', box(b.w * 0.44, h * 0.35, b.d * 0.6, b.cx, h * 0.65 - 0.05, b.cz, 1.2, 0.06)); P.add('iron', box(b.w * 0.52, 0.04, 0.04, b.cx, h * 0.3, b.z1 + 0.01, 1)); P.add('coins', lathe([[0.001, 0], [0.9, 0.02], [0.5, 0.2], [0.001, 0.26]], b.cx + b.w * 0.5, 0, b.cz + 0.2, 14)); }
    const ba = fb('barrels'); if (ba) { const { b, h } = ba; for (const [k, dx] of [-0.3, 0.3].entries()) P.add('wood', lathe([[0.3, 0], [0.36, 0.1], [0.4, h * 0.5], [0.36, h - 0.1], [0.3, h]], b.cx + dx * b.w, 0, b.cz + (k ? -0.1 : 0.1), 14)); P.add('iron', box(0.04, h * 0.9, 0.04, b.cx, 0, b.z1 - 0.2, 1)); }
    for (let i = 0; i < 7; i++) { const x = F.x0 + 1 + R() * (F.x1 - F.x0 - 2), z = zWall + 0.6 + R() * 1.8; const g = new THREE.OctahedronGeometry(0.1 + R() * 0.1); g.translate(x, 0.15 + R() * 0.9, z); const m = std({ color: [0x60d0ff, 0xff60a0, 0x80ff90][i % 3], emissive: [0x2060a0, 0x802040, 0x208040][i % 3], emissiveIntensity: 0.9, roughness: 0.2 }); scene.add(new THREE.Mesh(g, m)); disposables.push(g); }
    warmLight(ctx, cx - 1.5, 1.6, zWall + 2.2, 2.4, 9, 0xffc060); warmLight(ctx, cx + 3.5, 1.2, zWall + 2.0, 1.8, 8, 0xffc060);
  }
  P.build(M, scene);

  // ------------------------------------------------------------------ AO under the fixtures, dust motes in the lantern light, sparks of the mushrooms
  const aoTex = canvasTex(shadowCanvas()); disposables.push(aoTex);
  disposables.push(contactShade(scene, aoTex, A.props.filter((p) => !p.id.startsWith('entry')).map((p) => { const b = footBox(p.foot, ax); return { x: b.cx, y: 0, z: b.cz, sx: b.w + 0.6, sz: b.d + 0.5 }; })));
  const motes = new Puffs(soft ? 60 : 140, lifeTex(dotCanvas(0.3)), true); scene.add(motes.pts); disposables.push(motes);
  life.push(fireflies(scene, glowSpots.map((s) => ({ x: s.x, y: 0.8, z: s.z + 0.6, r: 1.6 })), { n: soft ? 10 : 24, wind: air, seed: 8, color: 0x9ab0ff }));
  const glowTex = canvasTex(glowCanvas()); disposables.push(glowTex); void glowTex; void post;

  // ------------------------------------------------------------------ the frame's work
  let acc = 0, boost = 0, boostDir = 1;
  const groundY = (_x: number, _z: number): number => 0;
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000);
    boost = Math.max(0, boost - dt * 0.75); air.gust = boost; air.dir = boostDir;
    for (const f of sway) f(t, 1 + boost);
    acc += dt * 10; while (acc >= 1) { acc -= 1; motes.emit(F.x0 + R() * (F.x1 - F.x0), 0.3 + R() * 2.6, zWall + 0.5 + R() * (F.zF - zWall), (R() - 0.5) * 0.05, 0.02 + R() * 0.04, (R() - 0.5) * 0.05, 0xd8c8a0, 0.012 + R() * 0.012, 5000 + R() * 4000, { a: 0.45, drag: 0.9 }); }
    motes.step(ms, 0.02, t);
    // the lit lanterns, the gates parting when their stage is done
    const litNow = focus.denLit ?? []; for (let i = 0; i < lit.n; i++) lit.set(i, litNow.includes(i));
    for (const w of [west, gate]) { if (!w) continue; const want = w === gate ? ((focus.denStage ?? 0) > spec.stage ? 1 : 0) : 0; w.open += (want - w.open) * Math.min(1, dt * 1.1); const k = w.open * w.open * (3 - 2 * w.open); w.halves[0].position.z = -k * 2.4; w.halves[1].position.z = k * 2.4; }
    for (const l of life) l.update(ms, t, dim);
    sky.update(t, dim, focus.x, focus.z);
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  };
  return {
    sun: sky.sun, hemi: sky.hemi, warm, groundY,
    blow: () => undefined,
    gust: (st, dir) => { boost = Math.max(boost, st); boostDir = dir < 0 ? -1 : 1; },
    update,
    shadowsDirty: () => { shadowDirty = true; },
    dispose: () => { for (const l of life) l.dispose(); for (const d of disposables) d.dispose(); scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); },
  };
};
