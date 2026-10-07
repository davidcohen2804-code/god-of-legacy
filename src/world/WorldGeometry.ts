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
  /** Physical obstacle height (px): an actor/projectile above it passes over. */
  height: number;
  /** Standable top surface (same polygon as the footprint, at z = topZ). */
  topZ?: number;
  cover: 'hard' | 'low' | 'none';
  /** Screen-space silhouette of the baked prop (used to draw the foreground occluder). */
  occluder: Pt[];
  /** Depth of the occluder layer = footprint front edge y. */
  frontY: number;
}

/** The PvP arena (Legacy Courtyard map) props. */
const COURTYARD_OBJECTS: WorldObject[] = [
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
/** The PvP arena: the closed Legacy Courtyard floor and its two props. */
export const useArenaGeometry = (): void => setWorldGeometry(WORLD.walkablePolygon as Pt[], COURTYARD_OBJECTS);

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

/** Inside the courtyard walls (foot circle radius r). Walls are full height: nothing passes them. */
export function insideArena(x: number, y: number, r: number): boolean {
  return pointInPoly(x, y, POLY) && polyDist(x, y, POLY) <= -r;
}

/** Foot circle at height z is legal: inside the arena and not inside any prop it cannot clear. */
export function footAllowed(x: number, y: number, z: number, r: number): boolean {
  if (!insideArena(x, y, r)) return false;
  for (const o of WORLD_OBJECTS) if (z < o.height - 1 && polyDist(x, y, o.footprint) < r) return false;
  return true;
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
    if (h >= o.height || (mode === 'hard' && o.cover !== 'hard')) continue;
    const t = segPolyEntry(ax, ay, bx, by, o.footprint);
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

/** Sorting depth for an actor: feet y, but above a prop occluder once it is standing on / above that prop. */
export function actorDepth(x: number, y: number, z: number): number {
  let d = y;
  for (const o of WORLD_OBJECTS) {
    // Drawn over a prop only when actually on / above its top (feet over the footprint); an airborne actor
    // behind the prop stays behind it.
    if (z >= o.height - 4 && y <= o.frontY + 2 && polyDist(x, y, o.footprint) < 14) d = Math.max(d, o.frontY + 1 + y * 0.001);
  }
  return d;
}

/** Point where a ground target is legal for placement (inside the arena, not inside a hard prop footprint). */
export function placementOk(x: number, y: number): boolean {
  if (!insideArena(x, y, 2)) return false;
  return !WORLD_OBJECTS.some((o) => o.cover === 'hard' && pointInPoly(x, y, o.footprint) && o.topZ === undefined);
}
