// Shared hit resolution for every skill and every legal target (enemies and players use the same path).
// Pure geometry + legality: no rendering, no damage application. World = courtyard map pixels.
import COMBAT from '../data/training-combat.json';
import WORLD from '../data/legacy-courtyard.json';
import { Dir, footAllowedStatic, hasLineOfSight } from '../world/collision';
import { SkillDef } from './SkillRegistry';

export interface Vec { x: number; y: number }

export interface HitTarget {
  id: string;
  kind: 'player' | 'enemy';
  x: number; y: number;
  radius: number;
  alive: boolean;
  invulnerable?: boolean;
  /** PvE immunity to stun/knockback (e.g. the stationary training dummy). */
  controlImmune?: boolean;
}

export const FACING: Record<Dir, Vec> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const ACTOR_R = WORLD.player.footRadius;
const STEP = 2; // px, swept sampling against scenery

/** Feet point after moving `dist` along `dir` from `o`, stopping at the first blocked sample (walls / obstacles / map edge). */
export function sweepStatic(o: Vec, dir: Vec, dist: number, radius = ACTOR_R): Vec {
  let x = o.x, y = o.y;
  const n = Math.ceil(Math.abs(dist) / STEP), s = Math.sign(dist) * Math.min(STEP, Math.abs(dist));
  for (let i = 0; i < n; i++) {
    const step = i === n - 1 ? dist - s * (n - 1) : s;
    const nx = x + dir.x * step, ny = y + dir.y * step;
    if (!footAllowedStatic(nx, ny, radius)) break;
    x = nx; y = ny;
  }
  return { x, y };
}

/** Distance from point p to segment a-b. */
function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Legal target filter shared by all skills (self, dead, invulnerable, wrong kind excluded). */
export function legal(s: SkillDef, attackerId: string, t: HitTarget): boolean {
  if (t.id === attackerId || !t.alive || t.invulnerable) return false;
  return t.kind === 'player' ? s.canHitPlayers : s.canHitEnemies;
}

/** Dash path end for a cast: swept along facing from the cast origin, stopped by scenery. */
export function dashEnd(s: SkillDef, origin: Vec, dir: Dir, progress: number): Vec {
  const g = s.geometry;
  return sweepStatic(origin, FACING[dir], (g.travelDistance ?? s.range) * Math.max(0, Math.min(1, progress)));
}

/**
 * Melee/area shapes (everything except projectiles), evaluated in the active phase.
 * progress = active-phase fraction (dash covers its swept segment up to that point).
 * Returns hit targets sorted deterministically by stable id.
 */
export function shapeHits(s: SkillDef, attackerId: string, origin: Vec, dir: Dir, progress: number, place: Vec | null, targets: HitTarget[]): HitTarget[] {
  const g = s.geometry, f = FACING[dir];
  const out: HitTarget[] = [];
  for (const t of targets) {
    if (!legal(s, attackerId, t)) continue;
    const vx = t.x - origin.x, vy = t.y - origin.y, d = Math.hypot(vx, vy);
    let hit = false;
    switch (g.kind) {
      case 'basicSector': { // existing Stage 5 rule, unchanged: feet-to-feet range + facing dot
        const A = COMBAT.attack;
        hit = d > 0 && d <= A.range && (vx * f.x + vy * f.y) / d >= A.minimumFacingDot;
        break;
      }
      case 'sweptCapsule': {
        const end = dashEnd(s, origin, dir, progress);
        hit = distToSeg(t, origin, end) <= (g.radius ?? 0) + t.radius && hasLineOfSight(origin.x, origin.y, t.x, t.y);
        break;
      }
      case 'sector': {
        const half = ((g.angleDegrees ?? 90) / 2) * (Math.PI / 180);
        const within = d <= s.range + t.radius;
        const ang = d === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, (vx * f.x + vy * f.y) / d)));
        const angTol = d > 0 ? Math.asin(Math.min(1, t.radius / d)) : Math.PI; // target radius widens the cone edge
        hit = within && ang <= half + angTol && hasLineOfSight(origin.x, origin.y, t.x, t.y);
        break;
      }
      case 'circle': // centered on the caster's feet
        hit = d <= s.range + t.radius && hasLineOfSight(origin.x, origin.y, t.x, t.y);
        break;
      case 'forwardRectangle': {
        const along = vx * f.x + vy * f.y, lateral = Math.abs(vx * -f.y + vy * f.x);
        const len = g.length ?? s.range, w = (g.width ?? 0) / 2;
        hit = along >= -t.radius && along <= len + t.radius && lateral <= w + t.radius && hasLineOfSight(origin.x, origin.y, t.x, t.y);
        break;
      }
      case 'groundCircle':
        if (place) hit = Math.hypot(t.x - place.x, t.y - place.y) <= (g.radius ?? 0) + t.radius && hasLineOfSight(place.x, place.y, t.x, t.y);
        break;
      default:
        break;
    }
    if (hit) out.push(t);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Binding Rune placement: the currently selected legal target if within range + LOS, else casterFeet + facing*160.
 * Returns null when the point is blocked (cast rejected).
 */
export function runePlacement(s: SkillDef, origin: Vec, dir: Dir, selected: Vec | null): Vec | null {
  if (selected && Math.hypot(selected.x - origin.x, selected.y - origin.y) <= s.range && hasLineOfSight(origin.x, origin.y, selected.x, selected.y)) {
    return { x: selected.x, y: selected.y };
  }
  const f = FACING[dir], p = { x: origin.x + f.x * 160, y: origin.y + f.y * 160 };
  return placementLegal(s, origin, p) ? p : null;
}

export function placementLegal(s: SkillDef, origin: Vec, p: Vec): boolean {
  return Math.hypot(p.x - origin.x, p.y - origin.y) <= s.range + 1 && footAllowedStatic(p.x, p.y, 1) && hasLineOfSight(origin.x, origin.y, p.x, p.y);
}

// ---------------------------------------------------------------- projectiles

export interface Projectile {
  castId: string;
  skill: SkillDef;
  attackerId: string;
  x: number; y: number;
  dir: Dir;
  travelled: number;
  ageMs: number;
  done: boolean;
}

export function spawnProjectile(castId: string, s: SkillDef, attackerId: string, origin: Vec, dir: Dir): Projectile {
  const f = FACING[dir];
  return { castId, skill: s, attackerId, x: origin.x + f.x * 18, y: origin.y + f.y * 18, dir, travelled: 0, ageMs: 0, done: false };
}

/**
 * Advance a projectile by ms with a swept segment: the FIRST collision wins (wall vs target, nearest first;
 * ties by stable id). Returns the hit target (projectile then terminates) or null.
 */
export function stepProjectile(p: Projectile, ms: number, targets: HitTarget[]): HitTarget | null {
  if (p.done) return null;
  const g = p.skill.geometry, f = FACING[p.dir], r = g.radius ?? 0;
  const maxD = g.maxDistance ?? p.skill.range, ttl = g.ttlMs ?? Infinity;
  const remainingT = Math.max(0, ttl - p.ageMs);
  const stepMs = Math.min(ms, remainingT);
  let len = Math.min(((g.speed ?? 0) * stepMs) / 1000, maxD - p.travelled);
  p.ageMs += ms;
  // Wall: first blocked sample along the segment.
  let wallAt = Infinity;
  for (let s = STEP; s <= len + 1e-6; s += STEP) {
    if (!footAllowedStatic(p.x + f.x * s, p.y + f.y * s, r)) { wallAt = s; break; }
  }
  if (!footAllowedStatic(p.x, p.y, r)) wallAt = 0;
  // Targets: earliest entry along the segment (circle of target radius + projectile radius).
  let best: HitTarget | null = null, bestAt = Infinity;
  for (const t of targets) {
    if (!legal(p.skill, p.attackerId, t)) continue;
    const R = t.radius + r;
    const ox = p.x - t.x, oy = p.y - t.y;
    const b = ox * f.x + oy * f.y, c = ox * ox + oy * oy - R * R;
    let at: number;
    if (c <= 0) at = 0; // already overlapping
    else { const disc = b * b - c; if (disc < 0) continue; at = -b - Math.sqrt(disc); if (at < 0) continue; }
    if (at <= len && (at < bestAt || (at === bestAt && best && t.id < best.id))) { best = t; bestAt = at; }
  }
  if (best && bestAt <= wallAt) {
    p.x += f.x * bestAt; p.y += f.y * bestAt; p.travelled += bestAt; p.done = true;
    return best;
  }
  if (wallAt <= len) { p.x += f.x * wallAt; p.y += f.y * wallAt; p.travelled += wallAt; p.done = true; return null; }
  p.x += f.x * len; p.y += f.y * len; p.travelled += len;
  if (p.travelled >= maxD - 1e-6 || p.ageMs >= ttl) p.done = true;
  return null;
}

/** Knockback direction: away from the cast origin (facing when overlapping). */
export function knockbackDir(origin: Vec, t: Vec, dir: Dir): Vec {
  const dx = t.x - origin.x, dy = t.y - origin.y, d = Math.hypot(dx, dy);
  return d > 0.001 ? { x: dx / d, y: dy / d } : FACING[dir];
}
