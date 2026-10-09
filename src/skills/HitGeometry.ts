// Shared, elevation-aware hit geometry for every skill and every legal target. Pure functions (no rendering, no damage).
// Telegraph drawing uses the same shape data (SkillFx) so the warning always matches the authoritative hitbox.
import { clearLine, coverHit } from '../world/WorldGeometry';
import { CoverMode, FinalSkill, HitEvent, HitShape } from './SkillTypes';

export interface V2 { x: number; y: number }
export interface V3 { x: number; y: number; z: number }

export interface HitTarget {
  id: string;
  kind: 'player' | 'enemy';
  x: number; y: number; z: number;
  radius: number;
  /** Body height (px) for vertical overlap tests. */
  height: number;
  alive: boolean;
  invulnerable?: boolean;
  /** Stationary training target: no displacement / launch. */
  controlImmune?: boolean;
}

export const BODY_H = 74;

export function legal(skill: FinalSkill, attackerId: string, t: HitTarget): boolean {
  return t.id !== attackerId && t.alive && !t.invulnerable;
}

/** Vertical overlap between the attack band [z0, z1] and the target body [tz, tz + height]. */
function vOverlap(z0: number, z1: number, t: HitTarget): boolean { return t.z <= z1 && t.z + t.height >= z0; }

function distToSeg(p: V2, a: V2, b: V2): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function unit(x: number, y: number, fx = 1, fy = 0): V2 { const l = Math.hypot(x, y); return l > 1e-6 ? { x: x / l, y: y / l } : { x: fx, y: fy }; }

/** Centre of a self/aim-biased circle. */
export function circleCentre(shape: Extract<HitShape, { kind: 'circle' }>, origin: V2, aim: V2, place: V2 | null): V2 {
  if (shape.at === 'place' && place) return place;
  if (shape.at === 'aimBias') return { x: origin.x + aim.x * (shape.bias ?? 0), y: origin.y + aim.y * (shape.bias ?? 0) };
  return origin;
}

/**
 * Does one hit event's shape contain the target? origin = caster feet (with z), aim = unit vector,
 * place = ground point (placed shapes), path = dash segment (capsule).
 */
export function shapeContains(hit: HitEvent, origin: V3, aim: V2, place: V2 | null, path: [V2, V2] | null, t: HitTarget): boolean {
  const s = hit.shape, reach = hit.reachUp ?? 80;
  const vx = t.x - origin.x, vy = t.y - origin.y, d = Math.hypot(vx, vy);
  const band = (lo: number, hi: number) => vOverlap(lo, hi, t);
  const los = () => clearLine(origin.x, origin.y, t.x, t.y, Math.max(origin.z, t.z) + 30);
  switch (s.kind) {
    case 'sector': {
      if (d > s.range + t.radius) return false;
      const half = (s.angle / 2) * (Math.PI / 180);
      const ang = d === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, (vx * aim.x + vy * aim.y) / d)));
      const tol = d > 0 ? Math.asin(Math.min(1, t.radius / d)) : Math.PI;
      return ang <= half + tol && band(origin.z - 16, origin.z + reach) && los();
    }
    case 'circle': {
      const c = circleCentre(s, origin, aim, place);
      const z0 = s.floor ? 0 : origin.z;
      return Math.hypot(t.x - c.x, t.y - c.y) <= s.radius + t.radius && band(z0 - 24, z0 + reach) && clearLine(c.x, c.y, t.x, t.y, Math.max(origin.z, t.z) + 30);
    }
    case 'line': {
      const along = vx * aim.x + vy * aim.y, lateral = Math.abs(-vx * aim.y + vy * aim.x);
      return along >= -t.radius && along <= s.length + t.radius && lateral <= s.width / 2 + t.radius && band(origin.z - 16, origin.z + reach) && los();
    }
    case 'capsule': {
      const [a, b] = path ?? [origin, origin];
      return distToSeg(t, a, b) <= s.radius + t.radius && band(origin.z - 16, origin.z + reach) && clearLine(a.x, a.y, t.x, t.y, origin.z + 30);
    }
    case 'placed': {
      if (!place) return false;
      return Math.hypot(t.x - place.x, t.y - place.y) <= s.radius + t.radius && band(-10, reach) && clearLine(place.x, place.y, t.x, t.y, 30);
    }
    default: return false;
  }
}

/** Lightning chain: first legal target inside the aim corridor (extra vertical tolerance), then the nearest other within `jump`. */
export function chainTargets(s: Extract<HitShape, { kind: 'chain' }>, origin: V3, aim: V2, targets: HitTarget[], reach: number): HitTarget[] {
  let first: HitTarget | null = null, best = Infinity;
  for (const t of targets) {
    const vx = t.x - origin.x, vy = t.y - origin.y;
    const along = vx * aim.x + vy * aim.y, lateral = Math.abs(-vx * aim.y + vy * aim.x);
    if (along < 0 || along > s.corridor || lateral > s.width / 2 + t.radius) continue;
    if (!vOverlap(origin.z - 40, origin.z + reach, t)) continue;
    if (!clearLine(origin.x, origin.y, t.x, t.y, Math.max(origin.z, t.z) + 30)) continue;
    if (along < best) { best = along; first = t; }
  }
  if (!first) return [];
  if (s.jump <= 0) return [first];
  let second: HitTarget | null = null, bd = Infinity;
  for (const t of targets) {
    if (t === first) continue;
    const dd = Math.hypot(t.x - first.x, t.y - first.y);
    if (dd <= s.jump && dd < bd && clearLine(first.x, first.y, t.x, t.y, 30)) { bd = dd; second = t; }
  }
  return second ? [second] : [first];
}

// ------------------------------------------------------------------ projectiles

export interface Projectile {
  castId: string;
  hitIndex: number;
  skill: FinalSkill;
  attackerId: string;
  x: number; y: number; z: number;
  dx: number; dy: number;
  speed: number; range: number; radius: number;
  travelled: number;
  ageMs: number;
  pierce: boolean;
  explodeRadius: number;
  cover: CoverMode;
  /** Homing shots (Origami Flock): turn rate (rad/s), which foe of the list this one hunts, its own id (each one hits). */
  homing?: number;
  pick?: number;
  pid?: number;
  /** Book Mage gates: last time it passed through one (no bouncing between them). */
  portedAt?: number;
  done: boolean;
  /** Height lost per px travelled (shots fired from the air descend toward chest height of grounded targets). */
  dropPerPx: number;
  /** Shot up into the air (Spirit Bow): 1 = at 45°, 2 = straight up. It flies over the floor along a side and only strikes as it comes down. */
  loft?: number;
  /** Where/why it ended. */
  end?: { x: number; y: number; reason: 'target' | 'cover' | 'range' };
}

const AIR_SHOT_DROP_PX = 240;

let pidSeq = 0;
export function spawnProjectile(castId: string, hitIndex: number, skill: FinalSkill, s: Extract<HitShape, { kind: 'projectile' }>, attackerId: string, origin: V3, dir: V2, pick = 0): Projectile {
  return {
    ...(s.homing ? { homing: (s.homing * Math.PI) / 180, pick, pid: ++pidSeq } : {}),
    castId, hitIndex, skill, attackerId, x: origin.x + dir.x * 16, y: origin.y + dir.y * 16, z: origin.z + 34, dx: dir.x, dy: dir.y,
    speed: s.speed, range: s.range, radius: s.radius, travelled: 0, ageMs: 0, pierce: !!s.pierce, explodeRadius: s.explodeRadius ?? 0,
    cover: skill.cover, done: false,
    // Fired from the air: angle down so the shot reaches grounded chest height (34) after AIR_SHOT_DROP_PX.
    dropPerPx: origin.z > 4 ? origin.z / AIR_SHOT_DROP_PX : 0,
  };
}

/**
 * Advance a projectile with a swept segment. Cover (props it cannot clear at its height, walls) and targets are
 * ordered along the segment: the first contact wins (piercing arrows continue through actors, never through cover).
 * Returns the targets hit this step.
 */
export function stepProjectile(p: Projectile, ms: number, targets: HitTarget[], already: Set<string>): HitTarget[] {
  if (p.done) return [];
  p.ageMs += ms;
  if (p.homing) steerHoming(p, ms, targets.filter((t) => !already.has(t.id) && legal(p.skill, p.attackerId, t)));
  const len = Math.min((p.speed * ms) / 1000, p.range - p.travelled);
  const bx = p.x + p.dx * len, by = p.y + p.dy * len;
  const ct = p.cover === 'IGNORES_COVER' ? null : coverHit(p.x, p.y, bx, by, p.z);
  const coverAt = ct === null ? Infinity : ct * len;
  const hits: { t: HitTarget; at: number }[] = [];
  for (const t of targets) {
    if (already.has(t.id) || !legal(p.skill, p.attackerId, t)) continue;
    if (!(p.z >= t.z - 6 && p.z <= t.z + t.height + 6)) continue; // jump over / under a projectile
    if (p.loft && p.travelled + len < p.range * 0.6) continue; // shot up: still high in the air
    const R = t.radius + p.radius, ox = p.x - t.x, oy = p.y - t.y;
    const b = ox * p.dx + oy * p.dy, c = ox * ox + oy * oy - R * R;
    let at: number;
    if (c <= 0) at = 0; else { const disc = b * b - c; if (disc < 0) continue; at = -b - Math.sqrt(disc); if (at < 0) continue; }
    if (at <= len && at <= coverAt) hits.push({ t, at });
  }
  hits.sort((a, b) => a.at - b.at || (a.t.id < b.t.id ? -1 : 1));
  if (!p.pierce && hits.length) {
    const h = hits[0];
    p.x += p.dx * h.at; p.y += p.dy * h.at; p.travelled += h.at; p.done = true; p.end = { x: p.x, y: p.y, reason: 'target' };
    return [h.t];
  }
  if (coverAt <= len) {
    const back = Math.max(0, coverAt - 6); // stop on the near face (bursts happen in front of the cover)
    p.x += p.dx * back; p.y += p.dy * back; p.travelled += back; p.done = true; p.end = { x: p.x, y: p.y, reason: 'cover' };
    return hits.map((h) => h.t);
  }
  p.x = bx; p.y = by; p.travelled += len;
  if (p.dropPerPx > 0) p.z = Math.max(34, p.z - p.dropPerPx * len);
  if (p.travelled >= p.range - 1e-6) { p.done = true; p.end = { x: p.x, y: p.y, reason: 'range' }; }
  return hits.map((h) => h.t);
}

/** Homing shot: hunts its foe (the pick-th nearest; fewer foes: they share), turning toward it at its turn rate. */
function steerHoming(p: Projectile, ms: number, foes: HitTarget[]): void {
  if (!foes.length || p.ageMs < 90) return; // a short straight flight out of the book first
  const sorted = foes.map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) })).filter((e) => e.d < 620).sort((a, b) => a.d - b.d);
  if (!sorted.length) return;
  const t = sorted[(p.pick ?? 0) % sorted.length].t;
  const want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.dy, p.dx);
  let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const turn = Math.max(-1, Math.min(1, d / Math.max(1e-6, (p.homing! * ms) / 1000))) * (p.homing! * ms) / 1000;
  const a = cur + turn; p.dx = Math.cos(a); p.dy = Math.sin(a);
  const tz = t.z + t.height * 0.5; p.z += Math.max(-1, Math.min(1, (tz - p.z) / 20)) * (p.speed * ms) / 1000 * 0.3; // and rises / drops toward it
}

/** Explosion around a point (Explosive Arrow): legal targets in radius with a clear line from the burst. */
export function burstTargets(skill: FinalSkill, attackerId: string, at: V3, radius: number, targets: HitTarget[]): HitTarget[] {
  return targets.filter((t) => legal(skill, attackerId, t) && Math.hypot(t.x - at.x, t.y - at.y) <= radius + t.radius
    && vOverlap(at.z - 40, at.z + 80, t) && clearLine(at.x, at.y, t.x, t.y, Math.max(at.z, 10) + 4));
}

/** Clamp a ground target to the skill's placement range from the caster. */
export function clampPlace(origin: V2, want: V2, range: number): V2 {
  const dx = want.x - origin.x, dy = want.y - origin.y, d = Math.hypot(dx, dy);
  return d <= range ? want : { x: origin.x + (dx / d) * range, y: origin.y + (dy / d) * range };
}

/** Projectile directions for a fan (count/spread). */
export function fanDirs(aim: V2, count = 1, spreadDeg = 0): V2[] {
  if (count <= 1) return [aim];
  const out: V2[] = [], left = aim.x < 0, half = ((count - 1) / 2) * spreadDeg, lim = Math.max(0, 45 - half);
  // the whole fan stays within 45° of the side (no shot near straight up / down): a corner aim tilts the fan, not past it
  const rel = Math.max(-lim, Math.min(lim, (Math.atan2(aim.y, Math.abs(aim.x)) * 180) / Math.PI));
  const base = left ? Math.PI - (rel * Math.PI) / 180 : (rel * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const a = base + ((i - (count - 1) / 2) * spreadDeg * Math.PI) / 180;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return out;
}

export function coverOf(skill: FinalSkill): CoverMode { return skill.cover; }

/** Game rule: no attack goes straight up or down — every aim is level or diagonal (at most 45 degrees off the
 *  horizontal), on the side the attacker faces (`side` -1 / 1 decides a purely vertical input). */
export function clampAim(a: V2, side = 1): V2 {
  const sx = Math.abs(a.x) > 1e-3 ? Math.sign(a.x) : side < 0 ? -1 : 1, lim = Math.SQRT1_2;
  const y = Math.max(-lim, Math.min(lim, a.y)), x = sx * Math.max(Math.abs(a.x), Math.sqrt(Math.max(0, 1 - y * y)));
  const L = Math.hypot(x, y) || 1;
  return { x: x / L, y: y / L };
}
