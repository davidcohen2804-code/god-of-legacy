// Kit A — the island's terraces in 3D (docs/WORLD_3D_SPEC.md §2.1–2.3): a paved terrace over the valley at golden hour, a
// balustrade along its front with urns where the data puts them, a band of paving behind the walk line and the upper
// terrace's wall beyond it (with a great stair and a gilt gate, or a rose arch with a fountain, by the map), corner
// towers, red banners, autumn ivy over every parapet, planters, maples above, the stone blocks you jump on, an NPC's
// bench and brazier; the far mountains and mist; birds, butterflies, falling leaves. Each map is this builder with its
// own spec, built from the area's own data (the floor, the props, the NPCs).
import * as THREE from 'three';
import type { Room } from '../../arena3d/Room';
import { Parts, box, cyl, lathe, canvasTex, glowCanvas, shadowCanvas } from '../../arena3d/RoomKit';
import { AREAS, HEIGHTS, TOWERS } from '../../world/Areas';
import { SUN_GATE } from '../../world/SunGate';
import { footBox, rng, ux, uz, uy, type Disposable } from '../kit/units';
import { skyAndLight } from '../kit/sky';
import { Tiles, flagstoneCanvas, ashlarCanvas, terracottaCanvas, slateCanvas } from '../kit/materials';
import { terraceSlab, balustrade, wallRun, stair, tower, block, urn, ivyRun, farMountains, sunRune, contactShade, ivyCanvas } from '../kit/terrain';
import { pond } from '../life/pond';
import type { Dressing } from './dressing';
import { growTrees, leafFall, crownCanvas, mapleLeafCanvas } from '../kit/trees';
import { type Life, type Wind, stillAir, tex as lifeTex, dotCanvas, Puffs, smokeCanvas } from '../life/kit';
import { birds } from '../life/birds';
import { butterflies, fireflies } from '../life/butterflies';
import { banner } from '../life/cloth';
import { clouds } from '../life/clouds';

export interface TerraceSpec {
  /** The upper terrace's wall: its height and how far behind the walk line it stands (units). */
  wallH?: number; wallBack?: number;
  /** The great stair up through the wall (at the walk polygon's notch) with a gilt gate at its top. */
  stair?: boolean;
  /** A rose arch in the wall's middle with a fountain basin in its niche (a mirrored pond). */
  arch?: boolean;
  /** Corner towers at the wall's ends; the sun rune in the paving; a bench and a brazier beside this NPC. */
  towers?: boolean; rune?: boolean; bench?: string;
  /** Props by id prefix: raised garden beds (walkable, 0.9 high). */
  beds?: string[];
  /** The floors above this terrace (world-heights.json) climbed by the stacked blocks (world-towers.json): real upper
   *  terraces behind the wall, one over the other. */
  levels?: boolean;
  /** The Sun Gate across the terrace's east end (its doors open when the sun has been crossed). */
  sunGate?: boolean;
  /** What else the terrace carries (dressing.ts). */
  dress?: Dressing;
  /** The Curse's cast over the east of the island: a crimson sky and fog, the stone darker, red creeper for ivy. */
  crimson?: boolean;
  /** Openings in the front balustrade (x ranges, units): a stair down. */
  frontGaps?: [number, number][];
  /** Kit B — the Twilight Gardens: the sun just set, a rose-violet sky and a cool moon, the stone grey-violet, wisteria
   *  for ivy, paper lanterns on cords for banners (the warm light), fireflies for butterflies, violet petals falling. */
  dusk?: boolean;
  /** No wall behind the terrace (nor the ground above it, its balustrade, planters and ivy): the dressing builds the
   *  back — a cliff and falls, a forest bank, the Elder Tree. */
  bare?: boolean;
  /** No balustrade along the front (a brook runs there instead). */
  noBalustrade?: boolean;
  seed?: number;
}

/** What the scene tells a place each frame besides where the hero is. */
export interface PlaceState { x: number; z: number; sunGateOpen?: boolean; /** the Thief's Den: the stage the run is at, the lanterns lit in this room */ denStage?: number; denLit?: number[] }

/** A terrace's builder, bound to where the hero is (`focus`, units: the shadows follow him). */
export const islandTerrace = (areaId: string, spec: TerraceSpec) => (focus: PlaceState) => (scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, F: { x0: number; x1: number; zB: number; zF: number }, soft: boolean): Room => {
  const A = AREAS[areaId];
  // the floors above (lowest first) and the stacked blocks that climb to them
  const levels = spec.levels ? HEIGHTS.filter((h) => !h.cloud && h.x < A.x + 1672 && h.x + h.w > A.x).sort((a, b) => a.H - b.H) : [];
  const WALL_H = levels.length ? levels[levels.length - 1].H / 100 : spec.wallH ?? 2.0;
  const R = rng(spec.seed ?? 20261018);
  const disposables: Disposable[] = [];
  let shadowDirty = true;
  const tiles = new Tiles(renderer, spec.dusk ? 'twilight' : 'island', () => { shadowDirty = true; }); disposables.push(tiles);
  const cx = (F.x0 + F.x1) / 2, zMid = (F.zB + F.zF) / 2;
  const zWall = levels.length ? uz(levels[0].front) + 0.02 : F.zB - (spec.wallBack ?? 4.2), zFront = F.zF + 0.42;          // the back wall's face (a deep band of paving behind the walk line: the wall stays low in the frame, the sky over it); the terrace's lip
  const xW0 = F.x0 - 9, xW1 = F.x1 + 9;                     // the terrace runs on past both ends of the map
  const ax = A.x;

  // ------------------------------------------------------------------ light, sky, air (golden hour: the sun low from the front-right)
  const dusk = !!spec.dusk, bare = !!spec.bare;
  const sky = skyAndLight(scene, front, renderer, dusk ? { // the sun just set: a rose-violet sky, the moon's cool light from the front-left, the lanterns' warmth the rest
    cx, cz: zMid, soft, sunFrom: new THREE.Vector3(-0.45, 0.72, 0.55), sunColor: 0xa8bcff, sunIntensity: 1.25, hemiSky: 0x9a84b8, hemiGround: 0x3a2e40, hemiIntensity: 1.0,
    top: 0x3e2c58, mid: 0x9a5a84, low: 0xe8a898, background: 0x6e4e74, fog: { color: 0x6a4c6e, near: 34, far: 100 }, exposure: 1.0,
  } : {
    cx, cz: zMid, soft, sunFrom: new THREE.Vector3(0.55, 0.42, 0.72), sunColor: spec.crimson ? 0xff9a6a : 0xffc27a, sunIntensity: spec.crimson ? 2.5 : 2.9, hemiSky: spec.crimson ? 0xd8a0a0 : 0xffe2c8, hemiGround: spec.crimson ? 0x4a2a30 : 0x6a4a3a, hemiIntensity: 0.72,
    ...(spec.crimson ? { top: 0x3a2040, mid: 0xa8405a, low: 0xe8784a, background: 0xb86a64, fog: { color: 0xc26a5a, near: 34, far: 110 } } : { top: 0x46467e, mid: 0xcc7488, low: 0xffb862, background: 0xe0a888, fog: { color: 0xe6b494, near: 60, far: 150 } }), exposure: 1.0,
  });
  const sunDir = dusk ? new THREE.Vector3(-0.45, 0.72, 0.55) : new THREE.Vector3(0.55, 0.42, 0.72);
  disposables.push(...sky.disposables);

  // ------------------------------------------------------------------ materials
  const std = (o: THREE.MeshStandardMaterialParameters) => tiles.use(new THREE.MeshStandardMaterial(o));
  const paving = dusk ? tiles.pair('stone_violet', () => flagstoneCanvas([168, 150, 178], 4), 1, 1.8) : tiles.pair('sandstone_paving', () => flagstoneCanvas(), 1, 1.8);
  const ashlar = dusk ? tiles.pair('stone_violet_wall', () => ashlarCanvas([150, 132, 162], 6), 1, 2.0) : tiles.pair('sandstone_wall', () => ashlarCanvas(), 1, 2.0);
  const moss = dusk ? tiles.pair('moss', () => flagstoneCanvas([70, 104, 58], 12), 1, 1.4) : null;
  const M: Record<string, THREE.Material> = {
    paving: std({ map: paving.map, normalMap: paving.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, color: dusk ? 0xd8ccdc : 0xf8e0c8 }),
    wall: std({ map: ashlar.map, normalMap: ashlar.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.94, color: dusk ? 0xa898b0 : spec.crimson ? 0xa88478 : 0xcfae86 }),
    balustrade: std({ map: ashlar.map, normalMap: ashlar.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, color: dusk ? 0xcabed0 : 0xf6ead4 }),
    moulding: std({ map: ashlar.map, roughness: 0.9, color: dusk ? 0xd2c8d8 : 0xfaf0dc }),
    dark: std({ color: 0x2a2420, roughness: 0.9 }),
    roof: std({ map: canvasTex(slateCanvas()), roughness: 0.6, metalness: 0.1, color: dusk ? 0x6a7490 : 0x9aa4c0 }),
    gold: std({ color: 0xe0ab4c, metalness: 1, roughness: 0.3 }),
    terracotta: std({ map: canvasTex(terracottaCanvas()), roughness: 0.85, color: dusk ? 0xa88898 : 0xe8b090 }),
    wood: std({ color: dusk ? 0x3a2a26 : 0x4a3426, roughness: 0.7 }),
    bronze: std({ color: 0x7a5a30, metalness: 0.85, roughness: 0.4 }),
    bark: std({ map: canvasTex(ashlarCanvas(dusk ? [58, 46, 44] : [92, 66, 48], 3)), roughness: 0.95, color: dusk ? 0xb4a4ac : 0xb09078 }),
    ...(moss ? { moss: std({ map: moss.map, normalMap: moss.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, color: 0xa8c89a }) } : {}),
  };
  const P = new Parts(), PF = new Parts();
  const air: Wind = stillAir(); air.x = 0.28; air.z = 0.04;
  const life: Life[] = [];
  let gateDoors: { doors: THREE.Group[]; open: number; yaw: number } | null = null;

  // ------------------------------------------------------------------ the ground: the terrace's paving, the upper terrace, the valley floor
  const groundTex = paving.map, groundN = paving.normalMap;
  const mkGround = (w: number, d: number, x: number, y: number, z: number, rep: number) => {
    const t = groundTex.clone(); t.needsUpdate = true; t.repeat.set(w / rep, d / rep); const n = groundN.clone(); n.needsUpdate = true; n.repeat.set(w / rep, d / rep); disposables.push(t, n);
    const m = std({ map: t, normalMap: n, normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.92, color: 0xf8e0c8 });
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); disposables.push(g);
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };
  mkGround(xW1 - xW0 + 8, zFront - zWall + 0.6, (xW0 + xW1) / 2, 0, (zWall + zFront) / 2, 2.2);            // the terrace
  const zTopBack = levels.length ? uz(levels[levels.length - 1].back) : zWall; // (where the ground above begins: behind the top floor)
  if (!bare) mkGround(xW1 - xW0 + 30, 14, (xW0 + xW1) / 2, WALL_H, zTopBack - 7 - 0.4, 2.2);             // the ground above the wall (the Temple's, the mountain's)
  { // the valley: a dark floor far below, in the haze
    const m = std({ color: dusk ? 0x2a2438 : 0x4a4458, roughness: 1 }); const g = new THREE.PlaneGeometry(400, 400); g.rotateX(-Math.PI / 2); g.translate(cx, -16, zMid); disposables.push(g); scene.add(new THREE.Mesh(g, m));
  }
  terraceSlab(P, xW0 - 4, xW1 + 4, zWall - 0.4, zFront, 0, 3.0);
  // the balustrade along the lip (in front of whoever stands at the edge), its urns on pedestals where the data puts them
  if (!spec.noBalustrade) balustrade(P, xW0 - 4, xW1 + 4, 0, zFront + 0.12, { post: 1.6, h: 0.82, gaps: spec.frontGaps });
  if (!spec.noBalustrade) for (const p of A.props.filter((q) => q.id.startsWith('urn'))) { const b = footBox(p.foot, ax); P.add('balustrade', box(0.56, 0.62, 0.56, b.cx, 0, zFront + 0.12, 1, 0.02)); urn(P, b.cx, 0.62, zFront + 0.12, 0.7); }

  // ------------------------------------------------------------------ the wall behind, the great stair, the terrace above, the towers
  const notch = A.walk.filter((p) => p[1] < 300); // the stair's foot: the walk polygon reaching back into the wall
  const nx0 = notch.length ? ux(Math.min(...notch.map((p) => p[0])) + ax) : cx - 1.6, nx1 = notch.length ? ux(Math.max(...notch.map((p) => p[0])) + ax) : cx + 1.6, nz = notch.length ? uz(Math.min(...notch.map((p) => p[1]))) : F.zB;
  const sx = (nx0 + nx1) / 2, sw = nx1 - nx0 + 0.3;
  const gap = spec.stair || spec.arch; // (the wall opens for the stair or the arch)
  if (levels.length) { // the floors above: each a wall face rising from the floor below to its lip, its paving, its blocks; the stacked blocks climb them
    let yLow = 0;
    const climb = TOWERS.filter((t) => t.x0 >= A.x - 50 && t.x1 <= A.x + 1672 + 50);
    for (const h of levels) {
      const yTop = uy(h.H), zF2 = uz(h.front), zB2 = uz(h.back), hx0 = ux(h.x), hx1 = ux(h.x + h.w);
      wallRun(P, Math.min(hx0, xW0 - 4), Math.max(hx1, xW1 + 4), yLow, yTop - yLow, zF2 + 0.02, { thick: 0.7, cornice: false, pilasterEvery: 4.2 });
      P.add('moulding', box(Math.max(hx1, xW1 + 4) - Math.min(hx0, xW0 - 4), 0.16, 0.3, (xW0 + xW1) / 2, yTop - 0.16, zF2 + 0.1, 1, 0.03)); // the lip
      mkGround(hx1 - hx0 + 18, zF2 - zB2 + 0.4, (hx0 + hx1) / 2, yTop, (zF2 + zB2) / 2 - 0.1, 2.2);
      for (const b of h.blocks ?? []) block(P, ux(b.x0), ux(b.x1), uz(b.front - b.depth), uz(b.front), yTop, uy(b.h));
      for (const t of climb.filter((c) => Math.abs(c.base - yLow * 100) < 2)) { // the stacked blocks on the floor below, against this wall
        block(P, ux(t.x0), ux(t.x1), uz(t.front - t.depth) - 0.12, uz(t.front), yLow, uy(t.h));
        for (const ry of [0.3, 0.6]) if (uy(t.h) > ry + 0.2) P.add('dark', box(ux(t.x1 - t.x0) + 0.04, 0.05, 0.05, ux((t.x0 + t.x1) / 2), yLow + uy(t.h) * ry, uz(t.front) + 0.02)); // iron bands
      }
      yLow = yTop;
    }
  } else if (bare) { /* the dressing builds the back */ } else if (gap) { wallRun(P, xW0 - 4, nx0 - 0.45, 0, WALL_H, zWall); wallRun(P, nx1 + 0.45, xW1 + 4, 0, WALL_H, zWall); } else wallRun(P, xW0 - 4, xW1 + 4, 0, WALL_H, zWall);
  if (spec.sunGate) { // the Sun Gate across the terrace's east end: a stone frame on the gate's own line, the gilt doors (swung open once the sun is crossed)
    const [bx, by] = SUN_GATE.back, [fx, fy] = SUN_GATE.front;
    const gx0 = ux(bx), gz0 = uz(by), gx1 = ux(fx), gz1 = uz(fy), len = Math.hypot(gx1 - gx0, gz1 - gz0), yaw = Math.atan2(-(gz1 - gz0), gx1 - gx0);
    const mid = { x: (gx0 + gx1) / 2, z: (gz0 + gz1) / 2 }, dw = 1.5; // (each door's width)
    const along = (k: number) => ({ x: gx0 + (gx1 - gx0) * k, z: gz0 + (gz1 - gz0) * k });
    for (const k of [0.2, 0.8]) { const p = along(k); P.add('wall', box(0.9, 3.4, 0.9, p.x, 0, p.z, 1.3, 0.03)); P.add('moulding', box(1.1, 0.2, 1.1, p.x, 3.4, p.z, 1, 0.03)); P.add('gold', lathe([[0, 0], [0.16, 0], [0.2, 0.08], [0.14, 0.22], [0.05, 0.4], [0, 0.48]], p.x, 3.6, p.z, 12)); }
    for (const [a, b] of [[0, 0.2], [0.8, 1]] as [number, number][]) { const p = along(a), q = along(b); const g = box(Math.hypot(q.x - p.x, q.z - p.z), 2.4, 0.5, 0, 0, 0, 1.3, 0.02); g.rotateY(yaw); g.translate((p.x + q.x) / 2, 0, (p.z + q.z) / 2); P.add('wall', g); }
    { const g = box(len * 0.6 + 0.4, 0.5, 0.7, 0, 0, 0, 1.3, 0.03); g.rotateY(yaw); g.translate(mid.x, 3.0, mid.z); P.add('moulding', g); } // the lintel over the doors
    const doorMat = std({ color: 0xe8b85a, metalness: 0.9, roughness: 0.32, emissive: 0x6a4010, emissiveIntensity: 0.25 });
    const doors: THREE.Group[] = [];
    for (const side of [-1, 1]) { // each door a gilt panel hinged at the frame, swinging inward
      const hinge = along(0.5 + side * (dw / len)); const g = new THREE.Group(); g.position.set(hinge.x, 0, hinge.z); g.rotation.y = yaw; scene.add(g);
      const panel = new THREE.Mesh(box(dw, 3.0, 0.12, -side * dw / 2, 0, 0, 1, 0.02), doorMat); panel.castShadow = true; g.add(panel); disposables.push(panel.geometry);
      const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), M.gold); sun.rotation.x = Math.PI / 2; sun.position.set(-side * dw / 2, 1.7, 0.1); g.add(sun); disposables.push(sun.geometry);
      doors.push(g);
    }
    gateDoors = { doors, open: 0, yaw };
  }
  if (spec.stair) {
    const steps = 12, rise = WALL_H / steps, tread = (nz - zWall) / steps;
    const st = stair(P, sx, nz, 0, sw, steps, rise, tread);
    for (const side of [-1, 1]) { // the stair's cheeks and the lacquered rails on them, a gilt lantern post at the foot
      const xr = sx + side * (sw / 2 + 0.2);
      P.add('wall', box(0.4, WALL_H + 0.5, nz - st.zTop + 0.9, xr, 0, (nz + st.zTop) / 2 - 0.45, 1.3, 0.02));
      P.add('moulding', box(0.5, 0.12, nz - st.zTop + 1.0, xr, WALL_H + 0.5, (nz + st.zTop) / 2 - 0.45, 1, 0.02));
      P.add('gold', lathe([[0, 0], [0.09, 0], [0.11, 0.05], [0.09, 0.12], [0.04, 0.2], [0.02, 0.28], [0, 0.3]], xr, WALL_H + 0.62, nz - 0.1, 12));
    }
    // the landing and the gilt gate (closed: the Temple's own ground is not this map's)
    P.add('balustrade', box(sw + 1.2, 0.2, 1.6, sx, WALL_H - 0.2, st.zTop - 0.8, 1.1, 0.02));
    for (let i = 0; i <= 8; i++) P.add('gold', cyl(0.035, 0.035, 2.2, sx - sw / 2 + (sw * i) / 8, WALL_H, st.zTop - 1.5, 8));
    P.add('gold', box(sw + 0.1, 0.08, 0.08, sx, WALL_H + 2.15, st.zTop - 1.5), box(sw + 0.1, 0.06, 0.06, sx, WALL_H + 1.1, st.zTop - 1.5));
    P.add('wall', box(0.6, 2.8, 0.6, sx - sw / 2 - 0.35, WALL_H, st.zTop - 1.5, 1.3, 0.02), box(0.6, 2.8, 0.6, sx + sw / 2 + 0.35, WALL_H, st.zTop - 1.5, 1.3, 0.02));
  }
  if (spec.arch) { // a rose arch in the wall's opening, a niche behind it with a fountain basin
    const aw = sw + 0.9, ah = WALL_H + 0.9;
    for (const side of [-1, 1]) P.add('wall', box(0.55, ah, 0.9, sx + side * (aw / 2 + 0.27), 0, zWall - 0.45, 1.3, 0.02));
    { const g = new THREE.TorusGeometry(aw / 2 + 0.27, 0.28, 10, 28, Math.PI); g.translate(sx, ah, zWall - 0.45); P.add('moulding', g); }
    P.add('wall', box(aw + 1.3, 0.5, 1.0, sx, ah + aw / 2 + 0.27 - 0.1, zWall - 0.45, 1.3, 0.02));
    P.add('wall', box(aw + 0.4, WALL_H + 0.4, 0.5, sx, 0, zWall - 1.45, 1.3)); // the niche's back
    P.add('moulding', box(aw + 0.6, 0.3, 0.3, sx, WALL_H + 0.1, zWall - 1.35, 1, 0.02));
  }
  // the upper terrace's own balustrade along the wall's top, open over the stair
  if (!bare) balustrade(P, xW0 - 4, xW1 + 4, WALL_H, zTopBack - 0.25, { post: 1.6, gaps: gap ? [[nx0 - 0.9, nx1 + 0.9]] : [] });
  const towersX = spec.towers ? [F.x0 + 0.6, F.x1 - 0.6] : [];
  for (const x of towersX) tower(P, x, zTopBack - 1.7, levels.length ? WALL_H : 0, 1.9, 6.2);

  // planters along the wall's foot: terracotta troughs with red flowers (the flowers as crown clumps)
  const planterX: number[] = [];
  for (let x = xW0 - 2; x < xW1 + 2; x += 3.4) if (!levels.length && !bare && (x < nx0 - 2 || x > nx1 + 2)) { P.add('terracotta', box(1.6, 0.42, 0.5, x, 0, zWall + 0.42, 1, 0.03)); planterX.push(x); }
  // ------------------------------------------------------------------ the blocks you jump on, Aldric's bench and brazier
  for (const p of A.props.filter((q) => q.id.startsWith('block'))) { const b = footBox(p.foot, ax); block(P, b.x0, b.x1, b.z0, b.z1, 0, uy(p.h)); }
  if (!levels.length) for (const t of TOWERS.filter((t) => t.x0 >= A.x - 50 && t.x1 <= A.x + 1672 + 50 && t.base === 0)) block(P, ux(t.x0), ux(t.x1), uz(t.front - t.depth) - 0.12, uz(t.front), 0, uy(t.h)); // (perches: stacked blocks with nothing above)
  const bedSpots: { x: number; z: number; w: number; d: number }[] = [];
  for (const p of A.props.filter((q) => (spec.beds ?? []).some((id) => q.id.startsWith(id)))) { // a raised garden bed: a stone kerb, earth, flowers on top (walkable at its stand height)
    const b = footBox(p.foot, ax), h = uy(p.h || 90);
    P.add('balustrade', box(b.w, h, b.d, b.cx, 0, b.cz, 1.1, 0.03)); P.add('dark', box(b.w - 0.24, 0.04, b.d - 0.24, b.cx, h - 0.02, b.cz, 1));
    bedSpots.push({ x: b.cx, z: b.cz, w: b.w, d: b.d });
  }
  const benchNpc = spec.bench ? (A.npcs ?? []).find((n) => n.id === spec.bench) : undefined;
  const axp = benchNpc ? ux(benchNpc.x + ax) : cx, azp = benchNpc ? uz(benchNpc.y) : zMid;
  const brazier = { x: axp + 1.7, z: F.zB - 0.45 };
  if (benchNpc) P.add('balustrade', box(1.6, 0.42, 0.5, axp - 1.9, 0, F.zB - 0.5, 1.1, 0.02), box(0.22, 0.6, 0.5, axp - 2.6, 0, F.zB - 0.5, 1, 0.02), box(0.22, 0.6, 0.5, axp - 1.2, 0, F.zB - 0.5, 1, 0.02)); // the bench
  if (benchNpc) P.add('bronze', lathe([[0.06, 0], [0.16, 0.02], [0.08, 0.1], [0.08, 0.62], [0.3, 0.7], [0.4, 0.82], [0.42, 0.9], [0.36, 0.92], [0.3, 0.8], [0.1, 0.72]], brazier.x, 0, brazier.z, 16));
  if (benchNpc) { for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; P.add('bronze', cyl(0.025, 0.035, 0.5, brazier.x + Math.cos(a) * 0.22, 0.42, brazier.z + Math.sin(a) * 0.22, 8)); } P.add('dark', cyl(0.3, 0.3, 0.06, brazier.x, 0.86, brazier.z, 12)); }

  const sway: ((t: number, wind: number) => void)[] = [];
  const warm: THREE.PointLight[] = [];
  spec.dress?.({ P, scene, front, M, A, ax, F, zWall, zFront, zTopBack, topY: WALL_H, xW0, xW1, cx, R, life, air, soft, std, sway, disposables, crimson: !!spec.crimson, dusk, warm, sunDir });

  // ------------------------------------------------------------------ build the stone, the AO at the feet, the sun rune
  P.build(M, scene); PF.build(M, front, false);
  const aoTex = canvasTex(shadowCanvas()); disposables.push(aoTex);
  const ao: { x: number; y: number; z: number; sx: number; sz: number }[] = [];
  for (const p of A.props.filter((q) => q.id.startsWith('block'))) { const b = footBox(p.foot, ax); ao.push({ x: b.cx, y: 0, z: b.cz, sx: b.w + 0.7, sz: b.d + 0.6 }); }
  for (const x of towersX) ao.push({ x, y: levels.length ? WALL_H : 0, z: zTopBack - 1.7, sx: 5.4, sz: 5.4 });
  if (benchNpc) ao.push({ x: brazier.x, y: 0, z: brazier.z, sx: 1.1, sz: 1.1 }); if (spec.stair) ao.push({ x: sx, y: 0, z: nz + 0.3, sx: sw + 1.2, sz: 0.9 });
  if (!bare) for (let x = xW0 - 2; x < xW1 + 2; x += 1.6) ao.push({ x, y: 0, z: zWall + 0.22, sx: 1.9, sz: 0.8 });
  disposables.push(contactShade(scene, aoTex, ao));
  if (spec.rune) disposables.push(sunRune(scene, cx, 0, zMid, 1.7));

  // ------------------------------------------------------------------ the trees (maples on the terrace above and at the terrace's far ends), the ivy
  const crownTex = canvasTex(crownCanvas(dusk ? ['#4e6e4a', '#5f805a', '#3a5a3c'] : ['#d8552a', '#f0923a', '#8c2a1e'], 5)); disposables.push(crownTex);
  const treeSpots = bare ? [] : [
    { x: nx0 - 4.2, z: zTopBack - 3.2, h: 2.8, lean: 0.3 }, { x: nx1 + 7.5, z: zTopBack - 3.6, h: 3.1, lean: -0.3 }, { x: xW1 - 5.5, z: zTopBack - 3.0, h: 2.6, lean: -0.2 },
    ...(levels.length ? [] : [{ x: xW0 + 5.5, z: zWall - 0.9, h: 2.4, lean: 0.4 }, { x: xW1 - 0.5, z: zWall - 0.9, h: 2.5, lean: -0.4 }]),
  ];
  const upper = (t: { z: number }) => (t.z < zTopBack - 1.2 ? WALL_H : 0);
  const crownLook = dusk ? { crownTex, crownColor: 0xb8c4d8, crownEmissive: 0x0c1428, crownEmissiveIntensity: 0.35 } : { crownTex, crownColor: 0xffd0b0, crownEmissive: 0x4a1a0a, crownEmissiveIntensity: 0.45 };
  const treesUp = growTrees(scene, treeSpots.filter((t) => upper(t) > 0), WALL_H, crownLook, R, soft);
  const treesLow = growTrees(scene, treeSpots.filter((t) => upper(t) === 0), 0, crownLook, R, soft);
  disposables.push(treesUp, treesLow);
  { const PB = new Parts(); PB.add('bark', ...treesUp.bark, ...treesLow.bark); PB.build(M, scene); }
  const ivyTex = canvasTex(ivyCanvas(dusk ? ['#8a6ab8', '#a98ad8', '#c4a8ee', '#6a4a98', '#5a7a4a', '#b89ae0'] : spec.crimson ? ['#8a1a14', '#b8241c', '#6a1010', '#c8402a', '#4a0a0a'] : ['#b8341c', '#d9552a', '#e9893c', '#5a7a2a', '#7a9a3a', '#8a2a1a'], 7)); disposables.push(ivyTex); // (at dusk: wisteria pouring over the parapets)
  const ivySpots: { x: number; y: number; z: number; drop: number; s: number }[] = [];
  if (!spec.noBalustrade) for (let x = xW0 - 3; x < xW1 + 3; x += 1.1) if (R() < 0.75) ivySpots.push({ x: x + (R() - 0.5) * 0.6, y: 0.84, z: zFront + 0.36, drop: 0.7 + R() * 0.9, s: 1.0 + R() * 0.6 });
  const faceH = levels.length ? levels[0].H / 100 : WALL_H;
  if (!bare) for (let x = xW0 - 3; x < xW1 + 3; x += 1.5) if (R() < 0.7 && (levels.length || x < nx0 - 1.4 || x > nx1 + 1.4)) ivySpots.push({ x: x + (R() - 0.5) * 0.6, y: faceH - 0.36, z: zWall + 0.14, drop: 1.0 + R() * 1.3, s: 1.0 + R() * 0.7 });
  if (!bare) for (let x = xW0 - 3; x < xW1 + 3; x += 1.9) if (R() < 0.5 && (x < nx0 - 1.4 || x > nx1 + 1.4)) ivySpots.push({ x: x + (R() - 0.5) * 0.6, y: WALL_H + 0.84, z: zTopBack - 0.1, drop: 0.6 + R() * 0.6, s: 0.9 + R() * 0.4 });
  const ivy = ivyRun(scene, ivyTex, ivySpots, R), ivyBack = ivy; disposables.push(ivy);
  const flowerTex = canvasTex(crownCanvas(dusk ? ['#8a6ad0', '#b49af0', '#5a7a4a'] : ['#e23a4a', '#f27a8a', '#5a7a2a'], 9)); disposables.push(flowerTex);
  const flowerSpots: { x: number; y: number; z: number; drop: number; s: number }[] = [];
  for (const px of planterX) for (let k = -1; k <= 1; k++) flowerSpots.push({ x: px + k * 0.45 + (R() - 0.5) * 0.2, y: 0.42 + 0.55, z: zWall + 0.42 + (R() - 0.5) * 0.2, drop: 0.55, s: 0.6 + R() * 0.25 });
  for (const b of bedSpots) for (let i = 0; i < Math.round(b.w * b.d * 6); i++) flowerSpots.push({ x: b.x + (R() - 0.5) * (b.w - 0.4), y: 0.9 + 0.5, z: b.z + (R() - 0.5) * (b.d - 0.3), drop: 0.5, s: 0.55 + R() * 0.25 });
  const flowers = ivyRun(scene, flowerTex, flowerSpots, R); disposables.push(flowers);

  // ------------------------------------------------------------------ the far world: mountains in the haze, mist below the lip and in the valley behind
  disposables.push(farMountains(scene, cx, zWall - 4, R, { ranges: 3, color: dusk ? 0x2e2244 : spec.crimson ? 0x4a2a38 : 0x5a3e52, span: 190 }));
  const glowTex = canvasTex(glowCanvas()); disposables.push(glowTex);
  const mistTex = lifeTex(smokeCanvas(5)); disposables.push(mistTex);
  const mists: { s: THREE.Sprite; x0: number; ph: number }[] = [];
  for (let i = 0; i < (soft ? 10 : 22); i++) {
    const m = new THREE.SpriteMaterial({ map: mistTex, color: dusk ? 0xb8a0c8 : 0xf6d8c8, transparent: true, opacity: 0.16 + R() * 0.12, depthWrite: false, fog: false }); disposables.push(m);
    const s = new THREE.Sprite(m), w = 5 + R() * 7, frontSide = R() < 0.55;
    s.scale.set(w, w * 0.45, 1); s.position.set(xW0 - 6 + R() * (xW1 - xW0 + 12), frontSide ? -1.6 - R() * 2.2 : WALL_H - 0.5 - R() * 3, frontSide ? zFront + 1.5 + R() * 3 : zWall - 10 - R() * 8);
    scene.add(s); mists.push({ s, x0: s.position.x, ph: R() * 10 });
  }

  // ------------------------------------------------------------------ the brazier's fire and the warm light
  if (benchNpc) { const L = new THREE.PointLight(0xff9a40, 2.6, 7, 2); L.position.set(brazier.x, 1.3, brazier.z); scene.add(L); warm.push(L); }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.position.set(brazier.x, 1.12, brazier.z); flame.scale.set(0.9, 1.3, 1); flame.visible = !!benchNpc; scene.add(flame); disposables.push(flame.material);
  const smoke = new Puffs(soft ? 40 : 90, lifeTex(smokeCanvas(2)), false); scene.add(smoke.pts); disposables.push(smoke);
  const embers = new Puffs(soft ? 30 : 70, lifeTex(dotCanvas(0.5)), true); scene.add(embers.pts); disposables.push(embers);

  // ------------------------------------------------------------------ the leaves falling from the maples, lying thick under them
  const leafTex = canvasTex(mapleLeafCanvas()); disposables.push(leafTex);
  const groundY = (x: number, z: number): number => { if (z > zFront + 0.05) return -16; if (bare) return 0; if (!levels.length) return z < zWall - 0.05 ? WALL_H : 0; let y = 0; for (const h of levels) if (z < uz(h.front) + 0.02) y = h.H / 100; return y; };
  const leaves = leafFall(scene, {
    from: [...treesUp.clumps, ...treesLow.clumps], groundY, falling: soft ? 90 : 260, lying: soft ? 500 : 1500,
    bounds: { x0: F.x0 - 4, x1: F.x1 + 4, z0: zWall + 0.1, z1: zFront - 0.1 }, under: treeSpots.filter((t) => upper(t) === 0).map((t) => ({ x: t.x, z: t.z + 0.8 })),
    ...(dusk ? { tex: leafTex, size: [0.08, 0.08] as [number, number], hue: [0.72, 0.79] as [number, number], sat: [0.45, 0.65] as [number, number], light: [0.6, 0.76] as [number, number], emissive: 0x1a0c30 }
      : { tex: leafTex, size: [0.11, 0.11] as [number, number], hue: [0.0, 0.09] as [number, number], sat: [0.65, 0.9] as [number, number], light: [0.42, 0.6] as [number, number], emissive: 0x301008 }),
  }, R);
  disposables.push(leaves);

  // ------------------------------------------------------------------ the life
  {
    const perches: THREE.Vector3[] = [];
    for (const x of towersX) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; perches.push(new THREE.Vector3(x + Math.cos(a) * 2.15, 6.6 + 0.95 + 0.5, zWall - 1.5 + Math.sin(a) * 2.15)); }
    for (let x = F.x0 + 1.6; x < F.x1; x += 4.8) perches.push(new THREE.Vector3(x, 0.9 + 0.17, zFront + 0.12));
    life.push(birds(scene, { cx, cz: zWall - 6, rx: 16, rz: 9, y: 9.5, perches }, { n: soft ? 6 : 10, wind: air, seed: 77, color: dusk ? 0x1a1420 : undefined })); // (bats, at dusk)
    if (dusk) life.push(fireflies(scene, [{ x: cx - 6, y: 1.0, z: zFront - 0.6, r: 2.6 }, { x: cx + 5, y: 1.1, z: zMid, r: 2.6 }, { x: cx, y: 1.4, z: zWall + 1.0, r: 3 }, { x: xW0 + 4, y: 1.2, z: zMid, r: 2.2 }, { x: xW1 - 4, y: 1.2, z: zMid, r: 2.2 }], { n: soft ? 28 : 70, wind: air, seed: 9, color: 0xd8ff8a }));
    else life.push(butterflies(scene, [{ x: cx - 5, y: 1.2, z: zFront - 0.2, r: 1.4 }, { x: cx + 4, y: 1.2, z: zFront - 0.3, r: 1.4 }, { x: axp - 2, y: 1.0, z: F.zB + 0.4, r: 1.2 }], { n: soft ? 4 : 8, wind: air, seed: 5 }));
    if (spec.stair) for (const [i, x] of [nx0 - 0.95, nx1 + 0.95].entries()) life.push(banner(scene, { x, y: 0, z: nz + 0.35, yaw: i === 0 ? 0 : Math.PI, w: 0.56, h: 2.2, pole: true }, { wind: air, seed: 11 + i }));
    if (spec.arch) life.push(pond(scene, { x: sx, z: zWall - 0.95, w: sw + 0.3, d: 0.9, y: 0 }, { wind: air, stone: M.balustrade, mirror: !soft, sunDir, sunColor: new THREE.Color(0xffc27a), skyLow: new THREE.Color(0xffb862), skyMid: new THREE.Color(0xcc7488), koi: 3, pads: 3 }));
    if (!dusk && !bare) for (const [i, x] of [xW0 + 6.4, cx - 5.6, cx + 5.6, xW1 - 6.4].entries()) if (!gap || Math.abs(x - sx) > 3) life.push(banner(scene, { x, y: faceH - 0.42, z: zWall + 0.14, yaw: 0, w: 0.56, h: Math.min(1.8, faceH - 0.5) }, { wind: air, seed: 21 + i }));
    if (!dusk) for (const x of towersX) life.push(banner(scene, { x, y: 6.6 + 0.95, z: zWall - 1.5 + 2.0, yaw: 0, w: 0.5, h: 1.6, pole: true }, { wind: air, seed: 31 }));
    life.push(clouds(scene, { cx, z: zWall - 40, y: 18, spread: 90 }, { n: soft ? 4 : 9, seed: 3, tint: dusk ? 0x8a6a98 : undefined }));
  }

  // ------------------------------------------------------------------ the frame's work
  let boost = 0, boostDir = 1, acc = 0;
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000);
    boost = Math.max(0, boost - dt * 0.75); air.gust = boost; air.dir = boostDir;
    const gust = 1 + Math.sin(t * 0.37) * 0.35 + Math.sin(t * 1.3) * 0.12, windK = gust * (1 + boost * 2.4);
    treesUp.update(t, windK); treesLow.update(t, windK); ivy.update(t, windK); ivyBack.update(t, windK); flowers.update(t, windK * 0.5); for (const f of sway) f(t, windK);
    leaves.update(dt, t, boost, boostDir, { x: air.x, z: air.z });
    for (const m of mists) m.s.position.x = m.x0 + Math.sin(t * 0.05 + m.ph) * 3 + ((t * 0.12) % 6);
    // the brazier: a flame that breathes, embers up, a thread of smoke
    const fm = flame.material as THREE.SpriteMaterial; fm.opacity = 0.7 + Math.sin(t * 9 + Math.sin(t * 3.1)) * 0.1; flame.scale.set(0.85 + Math.sin(t * 7) * 0.08, 1.25 + Math.sin(t * 11) * 0.1, 1);
    if (benchNpc && warm[0]) warm[0].intensity = 2.6 * (1 + Math.sin(t * 8.3) * 0.08 + Math.sin(t * 2.7) * 0.05);
    acc += benchNpc ? dt * 14 : 0;
    while (acc >= 1) {
      acc -= 1;
      if (R() < 0.45) embers.emit(brazier.x + (R() - 0.5) * 0.3, 1.0, brazier.z + (R() - 0.5) * 0.3, (R() - 0.5) * 0.3 + air.x * 0.3, 0.6 + R() * 0.8, (R() - 0.5) * 0.3, 0xffb050, 0.02 + R() * 0.02, 900 + R() * 900, { a: 0.9, grav: 0.3, drag: 0.5 });
      else smoke.emit(brazier.x + (R() - 0.5) * 0.2, 1.25, brazier.z + (R() - 0.5) * 0.2, (R() - 0.5) * 0.05, 0.25 + R() * 0.1, (R() - 0.5) * 0.05, 0x8a8078, 0.08 + R() * 0.05, 4000 + R() * 2000, { a: 0.12, grow: 0.11, drag: 0.6 });
    }
    smoke.push((air.x * 0.15 + boost * boostDir * 1.2) * dt, 0, 0); smoke.step(ms, 0.06, t); embers.step(ms, 0.4, t);
    if (gateDoors) { const want = focus.sunGateOpen ? 1 : 0; gateDoors.open += (want - gateDoors.open) * Math.min(1, dt * 1.2); gateDoors.doors.forEach((g, i) => { g.rotation.y = gateDoors!.yaw + (i === 0 ? 1 : -1) * gateDoors!.open * 1.9; }); }
    for (const l of life) l.update(ms, t, dim);
    sky.update(t, dim, focus.x, focus.z);
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  };

  return {
    sun: sky.sun, hemi: sky.hemi, warm, groundY,
    blow: (x, y, z, Rr, s) => leaves.blow(x, y, z, Rr, s),
    gust: (st, dir) => { boost = Math.max(boost, st); boostDir = dir < 0 ? -1 : 1; leaves.shake(st); },
    update,
    shadowsDirty: () => { shadowDirty = true; },
    dispose: () => { for (const l of life) l.dispose(); for (const d of disposables) d.dispose(); scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); },
  };
};
