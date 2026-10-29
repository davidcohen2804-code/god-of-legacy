// God of Legacy Studio — the map's depth model in the game's own terms: every Studio object becomes a WorldGeometry prop
// (footprint, height, a top to stand on, one-way, a ramp), the floor its walkable polygon — the same collisions, standing
// and depth sorting the game plays by (src/world/WorldGeometry.ts, src/combat/Combat.ts). Plus the shapes the preview
// draws and the editor picks: in this view a point at height z on the floor's (x, y) is seen at (x, y − z).
import { Pt, WorldObject, setWorldGeometry } from '../../world/WorldGeometry';
import type { MovementSettings, StudioMap, StudioObject } from '../model/profile';

/** A one-way platform's drawn thickness (px). */
export const SLAB = 14;
export const objKey = (o: StudioObject): string => `st-${o.id}`;

/** The object's footprint on the floor. */
export function footprint(o: StudioObject): Pt[] {
  if (o.kind === 'prop' && o.poly) return o.poly;
  return [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.d], [o.x, o.y + o.d]];
}
/** Its top's height over the floor point (x, y) (a ramp: along its slope); null: nothing to stand on (a prop's pillar). */
export function topAtPoint(o: StudioObject, x: number, y: number): number | null {
  if (o.kind === 'ramp') {
    const t = o.axis === 'x' ? (o.w > 0 ? (x - o.x) / o.w : 0) : (o.d > 0 ? (y - o.y) / o.d : 0);
    return o.z0 + (o.z1 - o.z0) * Math.min(1, Math.max(0, t));
  }
  if (o.kind === 'prop') return o.top ?? null;
  return o.z;
}
/** How high it stands (what walking below its top bumps into). */
export function heightOf(o: StudioObject): number {
  if (o.kind === 'ramp') return Math.max(o.z0, o.z1);
  if (o.kind === 'prop') return Math.max(o.h ?? 0, o.top ?? 0);
  return o.z;
}
/** The drawn bottom of each footprint corner (a one-way platform floats: its slab only). */
export function baseAt(o: StudioObject, top: number): number { return o.kind === 'oneway' ? Math.max(0, top - SLAB) : 0; }
export const frontY = (o: StudioObject): number => Math.max(...footprint(o).map((p) => p[1]));
export const backY = (o: StudioObject): number => Math.min(...footprint(o).map((p) => p[1]));

/** The game's prop for a Studio object. `solid` off: nothing bumps into it (it is still stood on from above). */
export function toWorldObject(o: StudioObject, solid: boolean): WorldObject {
  const foot = footprint(o), h = heightOf(o), fy = Math.max(...foot.map((p) => p[1])), top = topAtPoint(o, foot[0][0], foot[0][1]);
  const occ = o.kind === 'prop' && o.occ ? o.occ : silhouette(o);
  const w: WorldObject = { id: objKey(o), footprint: foot, height: h, cover: o.kind === 'oneway' ? 'none' : h > 40 ? 'hard' : 'low', occluder: occ, frontY: fy };
  if (o.kind === 'ramp') { w.topZ = h; w.ramp = { axis: o.axis, z0: o.z0, z1: o.z1 }; }
  else if (o.kind === 'prop') { if (o.top !== null && o.top !== undefined) w.topZ = o.top; if (o.soft) w.soft = true; }
  else w.topZ = top ?? h;
  if (o.kind === 'oneway' || !solid) w.soft = true;
  return w;
}

/** Puts the map into the game's world model (the floor and its props) — what the movement and the depth sorting read. */
export function compileMap(map: StudioMap, mv: MovementSettings): void {
  const pad = 6000;
  const walk: Pt[] = mv.collideWalls ? map.floor : [[-pad, -pad], [map.w + pad, -pad], [map.w + pad, map.h + pad], [-pad, map.h + pad]];
  setWorldGeometry(walk, map.objects.filter((o) => !o.hidden).map((o) => toWorldObject(o, mv.collideProps)));
}

// ------------------------------------------------------------------ shapes in the view (x, y − z)

/** Each footprint corner with its top height (a ramp's corners differ). */
export function corners(o: StudioObject): { x: number; y: number; top: number; base: number }[] {
  return footprint(o).map(([x, y]) => { const t = topAtPoint(o, x, y) ?? heightOf(o); return { x, y, top: t, base: baseAt(o, t) }; });
}
/** The top face as seen. */
export function topFace(o: StudioObject): Pt[] { return corners(o).map((c) => [c.x, c.y - c.top]); }
/** Everything it covers in the view (top and sides): its occluder, its pick area. */
export function silhouette(o: StudioObject): Pt[] {
  const c = corners(o);
  const all: Pt[] = [...c.map((p) => [p.x, p.y - p.top] as Pt), ...c.map((p) => [p.x, p.y - p.base] as Pt)];
  return hull(all);
}
/** Convex hull (monotone chain). */
export function hull(ps: Pt[]): Pt[] {
  const p = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
export function inPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
export function centroid(poly: readonly Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}
/** The floor's band in depth (its back and front edges). */
export function floorBand(map: StudioMap): { back: number; front: number } {
  const ys = map.floor.map((p) => p[1]);
  return { back: Math.min(...ys), front: Math.max(...ys) };
}
/** Objects whose footprint reaches outside the floor (nobody can stand there). */
export function outsideFloor(map: StudioMap): StudioObject[] {
  return map.objects.filter((o) => !o.hidden && footprint(o).some(([x, y]) => !inPoly(x, y, map.floor) && !onEdge(x, y, map.floor)));
}
function onEdge(x: number, y: number, poly: readonly Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 1.5) return true;
  }
  return false;
}
