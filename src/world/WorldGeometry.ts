// World model with elevation: walkable polygon + typed props (footprint / height / top surface / cover / occluder) of
// the area you are in (the PvP arena: the Legacy Courtyard; the open world: the current area, set by setWorldGeometry).
// Coordinates: ground plane (gx, gy) in world pixels; an actor at height z renders at screen y = gy - z.
// Calibrated against the baked map: the pedestal's lid (screen y 407..455) sits 78px above its ground footprint
// (front edge y 535), the planter's rim 60px (+ flowers) above its footprint (front edge y 721).
import WORLD from '../data/legacy-courtyard.json';

export type Pt = [number, number];
export interface WorldObject {
  id: string;
  /** Ground-plane footprint (blocks ground locomotion below `height`). */
  footprint: Pt[];
  /** A one-way platform (a cloud): you only land on it from above — it never stops you from the side or below. */
  soft?: boolean;
  /** Physical obstacle height (px): an actor/projectile above it passes over. */
  height: number;
  /** Standable top surface (same polygon as the footprint, at z = topZ). */
  topZ?: number;
  cover: 'hard' | 'low' | 'none';
  /** Screen-space silhouette of the baked prop (used to draw the foreground occluder). */
  occluder: Pt[];
  /** Depth of the occluder layer = footprint front edge y. */
  frontY: number;
  /** Open world blocks: the ground band (y from..to) under the top face as the picture draws it — someone standing on
   *  the block settles into it. The footprint is the block's base: the floor behind it is open (someone there is hidden
   *  by the block up to its top edge, as in depth). */
  stand?: [number, number];
  /** Under the prop only: what projectiles and sight lines meet (a stone block's footprint is this too). */
  base?: Pt[];
}

/** The PvP arena (Legacy Courtyard map) props. */
export const COURTYARD_OBJECTS: WorldObject[] = [
  {
    id: 'stone-pedestal',
    footprint: [[419, 487], [545, 487], [547, 535], [419, 535]],
    height: 78, topZ: 78, cover: 'hard', frontY: 536,
    occluder: [[440, 407], [537, 407], [541, 432], [546, 478], [547, 517], [535, 536], [419, 536], [418, 443], [428, 420]],
  },
  {
    id: 'flower-planter',
    footprint: [[1288, 660], [1444, 660], [1444, 726], [1292, 726]],
    height: 62, topZ: 62, cover: 'hard', frontY: 723,
    occluder: [[1300, 602], [1334, 582], [1376, 584], [1418, 609], [1435, 643], [1438, 690], [1435, 723], [1313, 723], [1297, 694], [1291, 655], [1293, 615]],
  },
  {
    // the guardian statue at the back right: tall stone cover to hide behind (nobody jumps over it or stands on it)
    id: 'guardian-statue',
    footprint: [[1182, 368], [1288, 368], [1288, 412], [1182, 412]],
    height: 290, cover: 'hard', frontY: 413,
    occluder: [[1233, 126], [1226, 132], [1220, 147], [1210, 148], [1209, 152], [1202, 154], [1192, 184], [1197, 192], [1196, 205], [1202, 217], [1191, 265], [1195, 273], [1196, 294], [1201, 304], [1190, 309], [1189, 329], [1179, 339], [1182, 345], [1178, 354], [1182, 353], [1182, 363], [1187, 365], [1179, 377], [1181, 383], [1172, 397], [1178, 395], [1174, 404], [1183, 412], [1288, 412], [1292, 402], [1298, 405], [1294, 399], [1297, 394], [1289, 385], [1290, 382], [1296, 386], [1296, 378], [1289, 371], [1293, 370], [1291, 363], [1285, 366], [1289, 340], [1281, 327], [1282, 315], [1277, 308], [1273, 309], [1268, 304], [1278, 291], [1268, 247], [1274, 238], [1269, 208], [1272, 173], [1263, 154], [1249, 148], [1241, 130]],
  },
];
/** Props of the area you are in. Replaced in place (setWorldGeometry) — importers keep this same array. */
export const WORLD_OBJECTS: WorldObject[] = [...COURTYARD_OBJECTS];

/** Walkable floor of the area you are in (world px). Replaced in place on an area change. */
const POLY: Pt[] = (WORLD.walkablePolygon as Pt[]).map((p) => [p[0], p[1]] as Pt);

/** The open world: the floor and props of the area the player is in (world coordinates). */
export function setWorldGeometry(walk: readonly Pt[], objects: readonly WorldObject[]): void {
  POLY.length = 0; for (const p of walk) POLY.push([p[0], p[1]]);
  WORLD_OBJECTS.length = 0; WORLD_OBJECTS.push(...objects);
}
export const walkPolygon = (): readonly Pt[] => POLY;
/** The PvP arena is the courtyard painting shown `scale` times bigger in the world — more room to move, the camera
 *  further back — grown about the fight's centre (cx, cy), so the middle of the floor keeps its coordinates. Its floor,
 *  props (their heights too: they are painted bigger) and spawn points follow; the fighters, their skills and every
 *  combat number stay as they are. */
export const ARENA_VIEW = { scale: 1.25, cx: 850, cy: 640 } as const;
/** A point of the courtyard painting (its pixels) in the arena's world. */
export const arenaPt = (x: number, y: number): Pt => [ARENA_VIEW.cx + (x - ARENA_VIEW.cx) * ARENA_VIEW.scale, ARENA_VIEW.cy + (y - ARENA_VIEW.cy) * ARENA_VIEW.scale];
/** The painting's rectangle in the arena's world. */
export const arenaRect = (): { x: number; y: number; w: number; h: number; s: number } => {
  const [x, y] = arenaPt(0, 0), s = ARENA_VIEW.scale;
  return { x, y, w: WORLD.coordinateSpace.width * s, h: WORLD.coordinateSpace.height * s, s };
};
const arenaPoly = (p: Pt[]): Pt[] => p.map(([x, y]) => arenaPt(x, y));
const arenaObject = (o: WorldObject): WorldObject => ({
  ...o, footprint: arenaPoly(o.footprint), occluder: arenaPoly(o.occluder), frontY: arenaPt(0, o.frontY)[1],
  height: o.height * ARENA_VIEW.scale, topZ: o.topZ === undefined ? undefined : o.topZ * ARENA_VIEW.scale,
  ...(o.base ? { base: arenaPoly(o.base) } : {}),
});
/** A PvP stage's layout, in its painting's pixels (1672x941, as the courtyard's): the walkable floor, its props, the
 *  spawn points, the round's marks (y, left x, right x) and its open middle. */
export interface StageGeo { floor: Pt[]; props: WorldObject[]; spawns: Pt[]; start: { y: number; left: number; right: number }; centre: Pt }
/** The PvP arena: a stage's closed floor and its props, at the arena's size. */
export const useArenaGeometry = (g: StageGeo): void => setWorldGeometry(arenaPoly(g.floor), g.props.map(arenaObject));

export function pointInPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

function distToSeg(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

function polyDist(x: number, y: number, poly: readonly Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSeg(x, y, poly[i], poly[(i + 1) % poly.length]));
  return pointInPoly(x, y, poly) ? -d : d;
}

/** How far (x, y) is from the floor's edge: positive inside, negative outside. */
export const edgeClearance = (x: number, y: number): number => -polyDist(x, y, POLY);

/** Inside the courtyard walls (foot circle radius r). Walls are full height: nothing passes them. */
export function insideArena(x: number, y: number, r: number): boolean {
  return pointInPoly(x, y, POLY) && polyDist(x, y, POLY) <= -r;
}

/** Temporary solid obstacles from skills (Tree of Life trunk): an ellipse on the floor, blocking at every height
 *  (nobody can stand or land on it) — walk around it or stand behind it. */
export const SKILL_BLOCKERS = new Map<string, { x: number; y: number; rx: number; ry: number }>();
const inBlocker = (b: { x: number; y: number; rx: number; ry: number }, x: number, y: number, r: number) =>
  ((x - b.x) / (b.rx + r)) ** 2 + ((y - b.y) / (b.ry + r * 0.6)) ** 2 < 1;

/** Foot circle at height z is legal: inside the arena and not inside any prop it cannot clear. `from`: where the feet
 *  are now — a step out of a prop they already overlap (just stepped off its top) is free, only deeper into it is not. */
export function footAllowed(x: number, y: number, z: number, r: number, from?: { x: number; y: number }): boolean {
  if (!insideArena(x, y, r)) return false;
  for (const o of WORLD_OBJECTS) {
    if (o.soft || z >= o.height - 1) continue;
    const d = polyDist(x, y, o.footprint);
    if (d >= r) continue;
    const d0 = from ? polyDist(from.x, from.y, o.footprint) : Infinity;
    if (!(d0 < r && d >= d0 - 1e-6)) return false;
  }
  for (const b of SKILL_BLOCKERS.values()) if (inBlocker(b, x, y, r)) return false;
  return true;
}

/** An actor caught where a blocker just appeared steps out to its nearest free edge. */
export function pushOutOfBlockers(p: { x: number; y: number }, r: number): void {
  for (const b of SKILL_BLOCKERS.values()) {
    if (!inBlocker(b, p.x, p.y, r)) continue;
    const a = Math.atan2((p.y - b.y) / (b.ry + r * 0.6), (p.x - b.x) / (b.rx + r)) || 0;
    p.x = b.x + Math.cos(a) * (b.rx + r + 1); p.y = b.y + Math.sin(a) * (b.ry + r * 0.6 + 1);
  }
}

/** Highest standable surface under (x, y) that an actor at height z can stand on (0 = ground). */
export function supportAt(x: number, y: number, z: number): { z: number; id: string | null } {
  let best = { z: 0, id: null as string | null };
  for (const o of WORLD_OBJECTS) {
    if (o.topZ === undefined || z < o.topZ - 8) continue;
    if (pointInPoly(x, y, o.footprint) && o.topZ > best.z) best = { z: o.topZ, id: o.id };
  }
  return best;
}

/** Segment a→b on the ground at height h crosses a prop the height cannot clear? Returns the first contact fraction. */
/** UI preview sandboxes (Skill Book / Inventory / Shop) live far outside the map: no props, no walls there. */
export const SANDBOX_X = -10000;

export function coverHit(ax: number, ay: number, bx: number, by: number, h: number, mode: 'hard' | 'any' = 'any'): number | null {
  if (ax < SANDBOX_X && bx < SANDBOX_X) return null;
  let best: number | null = null;
  for (const o of WORLD_OBJECTS) {
    if (o.soft || h >= o.height || (mode === 'hard' && o.cover !== 'hard')) continue;
    const t = segPolyEntry(ax, ay, bx, by, o.base ?? o.footprint);
    if (t !== null && (best === null || t < best)) best = t;
  }
  // Walls (arena boundary) always block.
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (best !== null && t >= best) break;
    if (!pointInPoly(ax + (bx - ax) * t, ay + (by - ay) * t, POLY)) { best = t; break; }
  }
  return best;
}

function segPolyEntry(ax: number, ay: number, bx: number, by: number, poly: readonly Pt[]): number | null {
  if (pointInPoly(ax, ay, poly)) return 0;
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const t = segSeg(ax, ay, bx, by, p[0], p[1], q[0], q[1]);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

function segSeg(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number | null {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Line of sight between two points at height h (default: chest height above the ground). */
export function clearLine(ax: number, ay: number, bx: number, by: number, h = 30): boolean {
  return coverHit(ax, ay, bx, by, h) === null;
}

/** Sorting depth for an actor: feet y, but above a prop occluder once it is standing on / above that prop, or standing
 *  beside it (level with its footprint, clear of it to the left or right — the side face it shows is behind him then;
 *  only someone behind its back edge is hidden by it). */
export function actorDepth(x: number, y: number, z: number): number {
  let d = y;
  // Drawn over a prop only when actually on / above its top (feet over the footprint); an airborne actor behind the
  // prop stays behind it. Up on a whole floor (a map above) with blocks of its own: that floor's band (its front edge),
  // ordered by y inside it — behind its block hidden by the block, on the block drawn on its top.
  const on = WORLD_OBJECTS.filter((o) => z >= o.height - 4 && y <= o.frontY + 2 && polyDist(x, y, o.footprint) < 14);
  if (on.length) {
    const base = on.reduce((a, o) => (o.frontY > a.frontY ? o : a));
    d = Math.max(d, base.frontY + 1 + y * 0.001);
    for (const o of on) if (o !== base) d = Math.max(d, base.frontY + 1 + (o.frontY + 1) * 0.001 + 0.0002);
  }
  for (const o of WORLD_OBJECTS) {
    if (on.includes(o)) continue;
    if (y >= o.frontY) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
    for (const p of o.footprint) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; }
    if (y >= y0 - 2 && (x < x0 || x > x1) && Math.min(Math.abs(x - x0), Math.abs(x - x1)) < 70) d = Math.max(d, o.frontY + 0.5 + y * 0.001);
  }
  return d;
}

/** Point where a ground target is legal for placement (inside the arena, not inside a hard prop footprint). */
export function placementOk(x: number, y: number): boolean {
  if (!insideArena(x, y, 2)) return false;
  return !WORLD_OBJECTS.some((o) => o.cover === 'hard' && pointInPoly(x, y, o.footprint) && o.topZ === undefined);
}
