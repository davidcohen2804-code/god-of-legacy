// Shared courtyard collision helpers (world = Stage 4 map pixels).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';

type Pt = readonly number[];
const POLY = WORLD.walkablePolygon as Pt[];

function insidePolygon(x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const a = POLY[i], b = POLY[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

function distToSegment(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Phaser.Math.Clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Whole foot circle (radius r) inside the walkable polygon and outside every obstacle rectangle. */
export function footAllowedStatic(x: number, y: number, r: number): boolean {
  if (!insidePolygon(x, y)) return false;
  for (let i = 0; i < POLY.length; i++) if (distToSegment(x, y, POLY[i], POLY[(i + 1) % POLY.length]) < r) return false;
  return !WORLD.obstacles.some((o) =>
    Math.hypot(x - Phaser.Math.Clamp(x, o.x, o.x + o.width), y - Phaser.Math.Clamp(y, o.y, o.y + o.height)) <= r);
}

/** Liang–Barsky: does segment a→b cross the rectangle? */
function segmentHitsRect(ax: number, ay: number, bx: number, by: number, o: { x: number; y: number; width: number; height: number }): boolean {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy], q = [ax - o.x, o.x + o.width - ax, ay - o.y, o.y + o.height - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

/** Clear line between two feet points: inside the courtyard and through no obstacle rectangle. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!insidePolygon(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return !WORLD.obstacles.some((o) => segmentHitsRect(ax, ay, bx, by, o));
}

export type Dir = 'down' | 'left' | 'right' | 'up';

/** Dominant screen axis; an exact diagonal faces horizontally. */
export function facingFrom(dx: number, dy: number, fallback: Dir): Dir {
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
