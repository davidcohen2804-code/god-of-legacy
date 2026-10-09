// Combat foundation shared by every actor (local player, remote player mirror, enemy, dummy):
// real ground x/y + height z kinematics with support surfaces, the combat state machine
// (free / hitstun / launched / knockdown / getup / hardCC / dead), victim-side combo context (combo scaling,
// juggle budget, one re-launch), and the hard-CC diminishing-returns policy kept separate from ordinary hit-stun.
import COMBO from '../data/combo-policy.json';
import { WORLD_OBJECTS, edgeClearance, footAllowed, pointInPoly, supportAt } from '../world/WorldGeometry';
import { FinalSkill, HitEvent, Reaction } from '../skills/SkillTypes';

// ------------------------------------------------------------------ kinematics

/** Movement / jump tuning (06 spec; jump strength calibrated so the 78px pedestal top is reachable). */
export const PHYS = {
  walk: 188, run: 270, /** on foot (a real walk: the legs keep pace with the floor; double-tap = run) */ stroll: 122, accel: 1500, decel: 1900, turnMult: 1.15, airAccel: 0.55, takeoffKeep: 0.92,
  jumpVz: 445, gravity: 1100, landMs: 90, takeoffMs: 70, footR: 10, mantle: 16,
};

export interface Kin { x: number; y: number; z: number; vx: number; vy: number; vz: number; supportZ: number; supportId: string | null; grounded: boolean;
  /** What it left by a jump or by walking off its edge: no stepping (or being caught) back onto that until it lands. */
  from?: string | null;
  /** Left it by walking off its edge (not by a jump). */
  stepped?: boolean }

export function newKin(x: number, y: number): Kin { return { x, y, z: 0, vx: 0, vy: 0, vz: 0, supportZ: 0, supportId: null, grounded: true }; }

export interface StepResult { landed: boolean; impactVz: number; blockedX: boolean; blockedY: boolean; leftSupport: boolean }

/**
 * Advance kinematics by ms. Horizontal motion is swept in small steps against walls and props (a prop blocks only
 * while the feet are below its height). Vertical: gravity, landing on the highest support under the feet.
 */
/** Point inside the footprint or within one foot radius of it. */
function pointInPolyNear(x: number, y: number, poly: Parameters<typeof pointInPoly>[2]): boolean {
  if (pointInPoly(x, y, poly)) return true;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return x >= Math.min(...xs) - PHYS.footR && x <= Math.max(...xs) + PHYS.footR && y >= Math.min(...ys) - PHYS.footR && y <= Math.max(...ys) + PHYS.footR;
}

/** Gravity multiplier of a juggled body at juggle 0 (long, readable hang time for air follow-ups). */
const LAUNCH_G = 0.55; // floaty launches: long hang time so the attacker can follow up
/** Combo-protection thresholds (fractions of max HP) and their effects. */
export const GAUGE = { stand: 0.3, air: 0.4, airRamp: 0.15, down: 0.15, resetMs: 3000, holdVz: 300, holdCeil: 120, gravityRamp: 1.6, wakeInvulnMs: 600 };

/** The PvP arena's duel rules (DFO / Tekken / Lost Ark-style pacing): a round of 4–6 exchanges, combos that end on
 *  their own, and a way out for the one being hit.
 *  - dmgMul: damage of a hit in the arena (× the skill's hit damage; arena HP is 1000); ladder: each later hit of a combo hits softer
 *    (index = the hit's number in the combo), never under ladderFloor (an ultimate: never under ultFloor).
 *  - budget: one combo takes at most this share of max HP — or lasts maxHits hits / maxComboMs — then the target drops
 *    out of it: a short fall, untouchable until it is up again; floorMs: how long a fallen fighter lies there. In maxHits a
 *    cast's first hit counts whole, its later hits (a multi-hit skill's ticks) tickWeight each, a hit without damage not at
 *    all. A finisher that ends the combo (an ultimate's knockdown) drops the target out of it the same way.
 *  - stunDecay: hit-stun of the combo's later skills shrinks ([up to hit n, × scale]); a cast keeps the scale of its first
 *    hit to its last (a multi-hit skill never lets go halfway).
 *  - launchCap: the highest a launch (or a re-launch) throws a body, px above the floor (in reach of the follow-ups).
 *  - wakeInvulnMs: every getup is guarded this long; techMinMs: down at least this long before a key stands you up.
 *  - BREAK: from the combo's breakMinHits-th hit, the jump key frees you (hop back breakHop px, untouchable
 *    breakInvulnMs), then breakCdMs to wait.
 *  - cdMul: skill cooldowns in the arena (more spacing and fewer skill strings). */
export const ARENA = {
  dmgMul: 4, ladder: [1, 1, 0.9, 0.8, 0.72, 0.65, 0.58, 0.52, 0.47, 0.43, 0.4], ladderFloor: 0.35, ultFloor: 0.6,
  budget: 0.3, maxHits: 15, tickWeight: 0.25, maxComboMs: 2600, floorMs: 300, launchCap: 200,
  stunDecay: [[5, 1], [8, 0.85], [11, 0.7], [Infinity, 0.55]] as [number, number][],
  wakeInvulnMs: 700, techMinMs: 120,
  breakMinHits: 3, breakCdMs: 15000, breakInvulnMs: 600, breakHop: 110,
  cdMul: 1.5,
} as const;
const arenaScale = (hit: number, ult: boolean): number => {
  const s = hit <= ARENA.ladder.length ? ARENA.ladder[hit - 1] : ARENA.ladderFloor;
  return ult ? Math.max(ARENA.ultFloor, s) : s;
};
const arenaStun = (hit: number): number => (ARENA.stunDecay.find(([n]) => hit <= n) ?? [0, 0.55])[1];

/** `slide`: walking into a slanted edge (or round a body) turns the step along it instead of stopping dead — only for
 *  free walking; knock-backs still stop at walls (wall crash). */
export function stepKin(k: Kin, ms: number, gravityScale = 1, blocked?: (x: number, y: number, z: number) => boolean, slide = false): StepResult {
  const dt = Math.min(0.05, ms / 1000), r: StepResult = { landed: false, impactVz: 0, blockedX: false, blockedY: false, leftSupport: false };
  // Ledge mantle: airborne against a standable top's lip, within reach of it → the rise is made to carry the feet just
  // past the lip (a smooth lift, no snap) while the step waits there, speed kept — then it goes on over the top. Never
  // through hard cover, never back onto the one it just left.
  let lip = false;
  const ok = (x: number, y: number) => {
    lip = false;
    if (footAllowed(x, y, k.z, PHYS.footR, k) && !(blocked && blocked(x, y, k.z))) return true;
    if (k.grounded) return false;
    for (const o of WORLD_OBJECTS) {
      if (o.topZ === undefined || o.id === k.from || k.z < o.topZ - PHYS.mantle || k.z >= o.topZ) continue;
      if (footAllowed(x, y, o.topZ, PHYS.footR) && !(blocked && blocked(x, y, o.topZ)) && pointInPolyNear(x, y, o.footprint)) {
        k.vz = Math.max(k.vz, Math.sqrt(2 * PHYS.gravity * gravityScale * (o.topZ + 0.5 - k.z)));
        lip = true; return false;
      }
    }
    return false;
  };
  // A blocked step turned 32° / 55° / 70° to the side with more room, shortened to its share along that way (cos).
  const along = (ax: number, ay: number): boolean => {
    const len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len;
    for (const c of [0.85, 0.57, 0.34]) {
      const s = Math.sqrt(1 - c * c), l = len * c;
      const a: [number, number] = [k.x + (ux * c - uy * s) * l, k.y + (uy * c + ux * s) * l];
      const b: [number, number] = [k.x + (ux * c + uy * s) * l, k.y + (uy * c - ux * s) * l];
      const [p, q] = edgeClearance(a[0], a[1]) >= edgeClearance(b[0], b[1]) ? [a, b] : [b, a];
      if (ok(p[0], p[1])) { k.x = p[0]; k.y = p[1]; return true; }
      if (ok(q[0], q[1])) { k.x = q[0]; k.y = q[1]; return true; }
    }
    return false;
  };
  const dx = k.vx * dt, dy = k.vy * dt, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let i = 0; i < n; i++) {
    if (dx !== 0 && !r.blockedX) { const nx = k.x + dx / n; if (ok(nx, k.y)) k.x = nx; else if (!lip && !(slide && Math.abs(dy) < Math.abs(dx) * 0.5 && along(dx / n, 0))) { r.blockedX = true; k.vx = 0; } }
    if (dy !== 0 && !r.blockedY) { const ny = k.y + dy / n; if (ok(k.x, ny)) k.y = ny; else if (!lip && !(slide && Math.abs(dx) < Math.abs(dy) * 0.5 && along(0, dy / n))) { r.blockedY = true; k.vy = 0; } }
  }
  if (k.grounded) {
    const s = supportAt(k.x, k.y, k.z);
    if (s.z < k.z - 0.5) { k.grounded = false; k.vz = 0; r.leftSupport = true; k.from = k.supportId; k.stepped = true; } // walked off the edge
    else {
      k.z = s.z; k.supportZ = s.z; k.supportId = s.id;
      // on a ledge solid back to the wall (its ground reaches further back than its top face as drawn): the feet keep to
      // the top face (never past its back edge, floating over the wall behind it)
      const o = s.id ? WORLD_OBJECTS.find((w) => w.id === s.id) : undefined;
      if (o?.stand && o.base && Math.min(...o.base.map((p) => p[1])) < o.stand[0] - 2 && k.y < o.stand[0]) { k.y = o.stand[0]; if (k.vy < 0) k.vy = 0; }
    }
  }
  if (!k.grounded) {
    const g = PHYS.gravity * gravityScale;   // exact under constant gravity: the same jump at any frame rate
    k.z += (k.vz - 0.5 * g * dt) * dt;
    k.vz -= g * dt;
    const s = supportAt(k.x, k.y, Math.max(k.z, k.z - k.vz * dt));
    k.supportZ = s.z; k.supportId = s.id;
    if (k.z <= s.z && k.vz <= 0) { r.landed = true; r.impactVz = -k.vz; k.z = s.z; k.vz = 0; k.grounded = true; k.from = null; k.stepped = false; }
  }
  return r;
}

/** Stone blocks (WorldObject.stand; the footprint is the block's base, the floor behind it is open and the block hides
 *  whoever stands there). Standing on one, the feet settle onto its top face as drawn (unless walking: moveY ≠ 0).
 *  `own`: moving on its own (not knocked about) — over a block in the air, at or above its top, the block catches you:
 *  the drift is held so that you come down on its top face (it is shallow: a jump toward it would carry you past it);
 *  never one you just left. And a step off its back edge drops you down behind it. Below a block's top (stepped off its
 *  edge, or come down beside it), the feet are eased clear of it before they reach the floor, never left half inside it. */
/** How far (world px of depth) in front of / behind a block a jump still lands on it. */
const LAND_FORGIVE = 46;
export function settleOnBlocks(k: Kin, ms: number, moveY: number, own = false): void {
  if (k.grounded) {
    const o = k.supportId ? WORLD_OBJECTS.find((w) => w.id === k.supportId) : undefined;
    if (!o?.stand || moveY !== 0) return;
    const step = ms * 0.45, want = Math.min(Math.max(k.y, o.stand[0]), o.stand[1]);   // 450 px/s: a short, smooth settle
    if (want !== k.y) k.y += Math.min(Math.max(want - k.y, -step), step);
    return;
  }
  for (const o of WORLD_OBJECTS) {
    if (!o.stand || o.topZ === undefined) continue;
    if (o.soft && k.z < o.topZ - 1) continue;   // a cloud: nothing to bump into below its top
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of o.footprint) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    // Stepped off its back edge: you drop down behind it. The step back stops at once (walking on back at full speed
    // would hold you at the same height on screen all the way down, floating, and land you far behind it), and the feet
    // clear its back edge late in the drop, where the fall hides that little step back.
    const behind = own && !!k.stepped && o.id === k.from && k.y < y0;
    if (behind && k.vy < 0) k.vy *= Math.exp(-ms / 20);
    if (k.z < (behind ? o.topZ * 0.6 : o.topZ - (o.id === k.from ? 0.5 : PHYS.mantle))) {   // below its top: out of it (300 px/s)
      const cx = Math.min(Math.max(k.x, x0), x1), cy = Math.min(Math.max(k.y, y0), y1), d = Math.hypot(k.x - cx, k.y - cy);
      if (d > 0 && d < PHYS.footR) {
        const f = Math.min(ms * 0.3, PHYS.footR - d + 0.5) / d, nx = k.x + (k.x - cx) * f, ny = k.y + (k.y - cy) * f;
        if (footAllowed(nx, ny, k.z, PHYS.footR, k)) { k.x = nx; k.y = ny; }
      }
      continue;
    }
    // Forgiving landing (a jump a little in front of a block, or a little behind it): at or above its top and over its
    // width, the feet are drawn onto its top face, so a jump at a block never just misses it by a few px of depth.
    if (own && o.id !== k.from && k.vz <= 120 && k.x > x0 + 6 && k.x < x1 - 6 && k.z >= o.topZ - 12 && !pointInPoly(k.x, k.y, o.footprint)) {
      const gap = k.y >= y1 ? k.y - y1 : y0 - k.y;
      if (gap >= 0 && gap < LAND_FORGIVE && footAllowed(k.x, k.y >= y1 ? y1 - 2 : y0 + 2, Math.max(k.z, o.topZ), PHYS.footR, k)) {
        const to = k.y >= y1 ? y1 - 2 : y0 + 2, step = Math.max(2, ms * 0.6);
        k.y += Math.max(-step, Math.min(step, to - k.y)); k.vy *= 0.5;
      }
    }
    if (!own || o.id === k.from || !pointInPoly(k.x, k.y, o.footprint)) continue;
    if (x1 - x0 > 700) continue;   // a whole floor above (a map over the terrace): wide enough, nothing to hold
    // Over it: t = the time until the feet are back down at its top. A drift that would carry them past its top face (a
    // little in from its edges) eases off evenly to come to rest there as they land: never faster than 2·room / t.
    const g = PHYS.gravity, t = Math.max(ms / 1000, (k.vz + Math.sqrt(Math.max(0, k.vz * k.vz + 2 * g * (k.z - o.topZ)))) / g);
    const hold = (p: number, v: number, lo: number, hi: number) =>
      v > 0 ? Math.min(v, Math.max(0, (2 * (hi - p)) / t)) : v < 0 ? Math.max(v, Math.min(0, (2 * (lo - p)) / t)) : v;
    const m = Math.min(18, (x1 - x0) / 4);
    k.vx = hold(k.x, k.vx, x0 + m, x1 - m); k.vy = hold(k.y, k.vy, y0 + 5, y1 - 5);
    return;
  }
}

/** Start a jump from the current support (no invulnerability; horizontal momentum kept at 92%). */
export function jump(k: Kin, vz = PHYS.jumpVz): void {
  k.grounded = false; k.vz = vz; k.vx *= PHYS.takeoffKeep; k.vy *= PHYS.takeoffKeep; k.from = k.supportId; k.stepped = false;
}

/** Ground / air locomotion toward a target velocity (acceleration-limited, sharper when turning). */
export function steer(k: Kin, tx: number, ty: number, ms: number, scale = 1): void {
  const dt = Math.min(0.05, ms / 1000);
  const want = Math.hypot(tx, ty), cur = Math.hypot(k.vx, k.vy);
  const turning = want > 0 && cur > 0 && (tx * k.vx + ty * k.vy) / (want * cur) < 0.3;
  const a = (want > 0 ? PHYS.accel * (turning ? PHYS.turnMult : 1) : PHYS.decel) * (k.grounded ? 1 : PHYS.airAccel) * scale;
  const ddx = tx - k.vx, ddy = ty - k.vy, dl = Math.hypot(ddx, ddy), step = a * dt;
  if (dl <= step) { k.vx = tx; k.vy = ty; } else { k.vx += (ddx / dl) * step; k.vy += (ddy / dl) * step; }
}

// ------------------------------------------------------------------ hard CC (shared DR policy)

const HCC = COMBO.hardCC;
/** Book Mage reactions: chill (slow) length, freeze length, Levity Field hover height. */
export const MAGE = { chillMs: 3000, chillSlow: 0.3, freezeMs: 800, levityZ: 90, curseStillMs: 600 };

/** Root / freeze / stun policy: max single, DR multipliers in a window, post-CC immunity. Damage always applies. */
export class HardCC {
  private tier = 0;
  private lastAccepted = -Infinity;
  end = -Infinity;
  kind: 'root' | 'freeze' | 'stun' | null = null;
  immuneUntil = -Infinity;

  active(now: number): boolean { return now < this.end; }
  /** Returns the applied duration (0 = rejected by immunity / DR). */
  apply(kind: 'root' | 'freeze' | 'stun', ms: number, now: number, pvp: boolean, long = false): number {
    if (long) { // binding skills (vines, mines): the whole hold, once; DR / immunity still guard against chains in PvP
      if (pvp && (now < this.end || now < this.immuneUntil)) return 0;
      const d = pvp ? Math.floor(ms * HCC.multipliers[Math.min(this.tier, HCC.multipliers.length - 1)]) : ms;
      if (d <= 0) return 0;
      if (pvp) { this.tier++; this.lastAccepted = now; this.immuneUntil = now + d + HCC.postImmunityMs; }
      this.end = Math.max(this.end, now + d); this.kind = kind; return d;
    }
    if (!pvp) { const d = Math.min(ms, 600); this.end = Math.max(this.end, now + d); this.kind = kind; return d; }
    if (now < this.end || now < this.immuneUntil) return 0;
    if (now - this.lastAccepted > HCC.drWindowMs) this.tier = 0;
    const d = Math.floor(Math.min(ms, HCC.maxSingleMs) * HCC.multipliers[Math.min(this.tier, HCC.multipliers.length - 1)]);
    if (d <= 0) return 0;
    this.tier++; this.lastAccepted = now; this.end = now + d; this.kind = kind;
    this.immuneUntil = this.end + HCC.postImmunityMs;
    return d;
  }
  grantImmunity(now: number, ms: number): void { this.immuneUntil = Math.max(this.immuneUntil, now + ms); }
  reset(): void { this.tier = 0; this.lastAccepted = -Infinity; this.end = -Infinity; this.immuneUntil = -Infinity; this.kind = null; }
  debug(): { tier: number; end: number; immuneUntil: number } { return { tier: this.tier, end: this.end, immuneUntil: this.immuneUntil }; }
}

// ------------------------------------------------------------------ combo context (victim side, per attacker)

export interface ComboCtx { id: number; attacker: string; startedAt: number; lastAt: number; hits: number; juggle: number; relaunches: number; ended: boolean; /** damage taken in it */ dmg: number;
  /** the arena's hit cap count (ARENA.maxHits: ticks weigh less); the combo hit index of each cast's first hit */ load: number; firstOf: Record<string, number> }

export class ComboBook {
  private ctx = new Map<string, ComboCtx>();
  private seq = 0;
  get(attacker: string, now: number): ComboCtx {
    let c = this.ctx.get(attacker);
    if (!c || c.ended || now - c.lastAt > COMBO.comboTimeoutMs) {
      c = { id: ++this.seq, attacker, startedAt: now, lastAt: now, hits: 0, juggle: 0, relaunches: 0, ended: false, dmg: 0, load: 0, firstOf: {} };
      this.ctx.set(attacker, c);
    }
    return c;
  }
  /** Any live combo on this victim (for air tech eligibility / gravity scaling). */
  live(now: number): ComboCtx | null {
    let best: ComboCtx | null = null;
    for (const c of this.ctx.values()) if (!c.ended && now - c.lastAt <= COMBO.comboTimeoutMs && (!best || c.juggle > best.juggle)) best = c;
    return best;
  }
  endAll(): void { for (const c of this.ctx.values()) c.ended = true; }
  /** Keep every live combo going (the arena: no combo runs out while its victim is still helpless). */
  hold(now: number): void { for (const c of this.ctx.values()) if (!c.ended && now - c.lastAt <= COMBO.comboTimeoutMs) c.lastAt = now; }
  end(attacker: string): void { const c = this.ctx.get(attacker); if (c) c.ended = true; }
  clear(): void { this.ctx.clear(); }
}

export const damageScale = (hitIndex: number, ultimate: boolean): number => {
  const t = COMBO.damageScaleByHit;
  const s = hitIndex <= t.length ? t[hitIndex - 1] : COMBO.damageScaleFloor;
  return ultimate ? Math.max(0.7, s) : s;
};
export const stunScale = (hitIndex: number): number => {
  const t = COMBO.hitStunScaleByHit;
  return hitIndex <= t.length ? t[hitIndex - 1] : t[t.length - 1];
};

// ------------------------------------------------------------------ combat state

export type ActState = 'free' | 'hitstun' | 'launched' | 'knockdown' | 'getup' | 'hardCC' | 'dead';

export interface HitOutcome {
  damage: number;
  hitIndex: number;
  comboId: number;
  reaction: 'hit' | 'launch' | 'knockdown' | 'cc' | 'armor' | 'slam' | 'float';
  stunMs: number;
  ccMs: number;
  juggle: number;
  endsCombo: boolean;
  /** Displacement applied (for remote replication / visuals). */
  pushX: number; pushY: number; launchVz: number;
  /** Book Mage magic reaction this hit caused (chill / freeze / shatter / conduct). */
  rx?: 'chill' | 'freeze' | 'shatter' | 'conduct' | 'curse' | 'levity';
  /** How long that reaction holds (freeze / curse / levity), ms. */
  rxMs?: number;
}

/** Combat state + reactions of one actor. The owner is the authority for its own body (victim-side model). */
export class CombatBody {
  state: ActState = 'free';
  stateEnd = 0;
  kdPhase: 'fall' | 'impact' | 'down' | 'up' = 'fall';
  slowPct = 0;
  slowUntil = 0;
  /** Book Mage: chilled (a frost hit freezes it), folded into a paper crane, floating in a Levity Field. */
  chillUntil = -1;
  curseUntil = -1;
  /** when the current paper crane began (it stands still for its first MAGE.curseStillMs) */
  curseFrom = -1;
  levityUntil = -1;
  readonly hard = new HardCC();
  readonly combos = new ComboBook();
  /** Push motion (px/ms) applied over a short window. */
  push: { vx: number; vy: number; left: number } | null = null;
  armorUntil = -1;
  airTechCdUntil = 0;
  lastHitAt = -Infinity;
  /** One ground bounce pending (slams): the body pops back up on impact for an OTG follow-up. */
  bounce = false;
  /** Max HP of this body (damage gauges are fractions of it). */
  maxHp = 100;
  /**
   * DFO-style combo protection: damage taken while standing / airborne / downed, as fractions of max HP.
   * Below its threshold a state is fully free; past it the engine pushes the body out of the combo
   * (standing → forced knockdown, air → rising gravity and no holds/launches, down → quick invulnerable getup).
   * All three reset ~3s after the last hit.
   */
  gauge = { stand: 0, air: 0, down: 0 };
  invulnUntil = -1;
  pinUntil = -1;
  /** Passives (Endure / Warrior Mastery / Power Stance): CC & slow duration cut, chance to ignore knockback. */
  ccResist = 0;
  kbResist = 0;
  /** Last time a passive visibly worked (stance held / CC shortened): the scene plays its effect. */
  stanceAt = -Infinity;
  endureAt = -Infinity;
  /** The PvP arena's duel rules (ARENA) apply to this body. */
  arena = false;
  /** Arena: this combo has had its share — dropping out of it, untouchable until up again. */
  released = false;
  /** Arena: guarded (wake-up / BREAK): no damage, no reaction; drawn see-through, blinking. */
  ghostUntil = -1;
  /** Arena: when BREAK is ready again; when the body came to rest on the floor. */
  breakReadyAt = 0;
  downAt = -Infinity;
  airOver(): number { return Math.max(0, (this.gauge.air - GAUGE.air) / GAUGE.airRamp); }

  constructor(readonly kin: Kin, readonly pvp: boolean) {}

  canAct(now: number): boolean { return this.state === 'free' && !this.hard.active(now) && now >= this.curseUntil; }
  /** A paper crane still walks (slowly); a body floating in a Levity Field cannot move. */
  canMove(now: number): boolean { return this.state === 'free' && !this.hard.active(now) && now >= this.levityUntil; }
  moveScale(now: number): number { return (now < this.slowUntil ? 1 - this.slowPct : 1) * (now < this.curseUntil ? (now < this.curseFrom + MAGE.curseStillMs ? 0 : 0.5) : 1); }
  chilled(now: number): boolean { return now < this.chillUntil; }
  frozen(now: number): boolean { return this.hard.active(now) && this.hard.kind === 'freeze'; }
  reset(): void { this.pinUntil = -1; this.gauge = { stand: 0, air: 0, down: 0 }; this.invulnUntil = -1; this.bounce = false; this.state = 'free'; this.stateEnd = 0; this.hard.reset(); this.combos.clear(); this.push = null; this.slowUntil = 0; this.armorUntil = -1; this.chillUntil = -1; this.curseUntil = -1; this.curseFrom = -1; this.levityUntil = -1;
    this.released = false; this.ghostUntil = -1; this.breakReadyAt = 0; this.downAt = -Infinity; }
  /** Guarded right now (the arena: rising from the floor, the wake-up after it, BREAK). */
  ghost(now: number): boolean { return now < this.ghostUntil || (this.arena && this.state === 'getup'); }

  /**
   * Apply a confirmed, legal hit from `attacker` (this body's owner is the authority).
   * Order: damage (scaled by combo index) → reaction (soft hit-stun / launch within juggle budget / knockdown / hard CC
   * via DR) → push / pull. Hard-CC immunity never cancels ordinary combo hit reactions.
   */
  receive(attacker: string, skill: FinalSkill, hit: HitEvent, from: { x: number; y: number }, now: number, cast?: string): HitOutcome {
    if (this.arena && (now < this.invulnUntil || this.ghost(now) || this.released)) // guarded: the hit does nothing (and is no part of a combo)
      return { damage: 0, hitIndex: 0, comboId: 0, reaction: 'armor', stunMs: 0, ccMs: 0, juggle: 0, endsCombo: false, pushX: 0, pushY: 0, launchVz: 0 };
    const c = this.combos.get(attacker, now);
    c.hits++; c.lastAt = now;
    // `cast` = the cast this hit belongs to: its first hit counts whole in the arena's hit cap, its later ones (ticks) a
    // quarter, a hit without damage not at all; its hit-stun decays only as far as its first hit's.
    const first = cast ? (c.firstOf[cast] ??= c.hits) : c.hits;
    c.load += hit.damage > 0 ? (first === c.hits ? 1 : ARENA.tickWeight) : 0;
    const stunIdx = this.arena ? first : c.hits;
    const ult = skill.slot === 7;
    // Book Mage SHATTER: a heavy hit on a frozen body breaks the ice for extra damage.
    const frozen = this.frozen(now), shatter = frozen && !!hit.heavy && hit.damage > 0;
    if (shatter) hit = { ...hit, damage: hit.damage * (hit.shatterMul ?? 1.5) };
    let damage: number, release = false;
    if (this.arena) { // the arena: softer hits, each later one softer still, at most one combo's budget
      damage = hit.damage > 0 ? Math.max(1, Math.round(hit.damage * ARENA.dmgMul * arenaScale(c.hits, ult))) : 0;
      const cap = ARENA.budget * this.maxHp;
      damage = Math.max(0, Math.min(damage, Math.ceil(cap - c.dmg)));
      c.dmg += damage;
      release = c.dmg >= cap - 0.5 || c.load >= ARENA.maxHits || now - c.startedAt >= ARENA.maxComboMs;
    } else {
      const base = Math.floor(hit.damage * (this.pvp ? skill.pvpMultiplier : skill.pveMultiplier));
      damage = hit.damage > 0 ? Math.max(1, Math.round(base * damageScale(c.hits, ult))) : 0;
    }
    let R: Reaction = hit.reaction;
    const k = this.kin;
    const out: HitOutcome = { damage, hitIndex: c.hits, comboId: c.id, reaction: 'hit', stunMs: 0, ccMs: 0, juggle: c.juggle, endsCombo: !!skill.endsCombo, pushX: 0, pushY: 0, launchVz: 0 };
    if (now < this.invulnUntil || now < this.ghostUntil || this.released) { out.damage = 0; out.reaction = 'armor'; return out; }
    if (hit.el || shatter) { // Book Mage magic reactions: chill → freeze → shatter, storm conducts through the chilled
      const chilled = this.chilled(now), storm = hit.el === 'storm' || hit.el === 'both', frost = hit.el === 'frost' || hit.el === 'both';
      if (shatter) { this.hard.end = now; this.hard.kind = null; out.rx = 'shatter'; R = { ...R, knockdown: undefined, launch: Math.max(R.launch ?? 0, 60), juggleCost: R.juggleCost ?? 10 }; }
      if (storm && (chilled || (hit.conductor && frozen))) { out.rx = out.rx ?? 'conduct'; R = { ...R, stun: (R.stun ?? 150) + (hit.conductor ? 500 : 250) }; }
      if (frost && !shatter) {
        if (chilled && !frozen) { const d = this.hard.apply('freeze', MAGE.freezeMs, now, this.pvp, true); /* (a freeze holds its whole length: time to shatter it) */ if (d > 0) { out.rx = 'freeze'; out.ccMs = d; out.rxMs = d; this.chillUntil = -1; } }
        else if (!frozen) { this.chillUntil = now + MAGE.chillMs; this.slowPct = Math.max(now < this.slowUntil ? this.slowPct : 0, MAGE.chillSlow); this.slowUntil = Math.max(this.slowUntil, now + MAGE.chillMs); out.rx = out.rx ?? 'chill'; }
      }
    }
    if (now < this.curseUntil && hit.heavy && damage > 0) this.curseUntil = now; // a heavy blow unfolds the paper crane
    if (R.curse) { const ms = R.curse * (1 - this.ccResist); if (now >= this.curseUntil) this.curseFrom = now; this.curseUntil = Math.max(this.curseUntil, now + ms); out.rx = out.rx ?? 'curse'; out.rxMs = ms; }
    if (R.levity) {
      this.levityUntil = Math.max(this.levityUntil, now + R.levity); this.push = null; out.rx = out.rx ?? 'levity'; out.rxMs = R.levity;
      if (this.arena) { const ms = this.hard.apply('stun', R.levity, now, this.pvp, true); if (ms > 0) out.ccMs = Math.max(out.ccMs, ms); } // the arena: floating, it cannot act either (BREAK still frees it)
    }
    this.lastHitAt = now;
    const R0: Reaction = hit.reaction;
    const downNow = this.state === 'knockdown' && this.kdPhase !== 'fall' && this.kin.grounded;
    const airNow = !this.kin.grounded || this.state === 'launched';
    const frac = damage / Math.max(1, this.maxHp);
    if (!R0.grab) { if (downNow) this.gauge.down += frac; else if (airNow) this.gauge.air += frac; else this.gauge.stand += frac; }
    const armored = now < this.armorUntil;
    // Push / pull direction.
    let dx = k.x - from.x, dy = k.y - from.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    if (!armored) {
      const pushPx = (R.push ?? 0) * (this.pvp ? 1.4 : 2) - (R.pull ?? 0);
      if (pushPx > 0 && this.kbResist > 0 && Math.random() < this.kbResist) this.stanceAt = now; // stance: not pushed back
      else if (pushPx !== 0) { out.pushX = dx * pushPx; out.pushY = dy * pushPx; this.push = { vx: out.pushX / 110, vy: out.pushY / 110, left: 110 }; }
    }
    const cr = 1 - this.ccResist;
    if (R.slow) { this.slowPct = R.slow.pct; this.slowUntil = Math.max(this.slowUntil, now + R.slow.ms * cr); }
    if (this.ccResist > 0 && (R.hardCC || R.slow)) this.endureAt = now;
    if (R.hardCC) { out.ccMs = this.hard.apply(R.hardCC.kind, Math.round(R.hardCC.ms * cr), now, this.pvp, !!R.hardCC.long); if (out.ccMs > 0) out.reaction = 'cc'; }
    if (armored) { out.reaction = 'armor'; return out; }
    const juggleCost = R.juggleCost ?? 0;
    const air = !k.grounded || this.state === 'launched';
    if (R.slam && air) {
      out.reaction = 'slam'; k.vz = -620; this.enterKnockdown(now, 'light', -620); out.launchVz = k.vz; this.bounce = this.airOver() < 1;
    } else if (R.knockdown) {
      out.reaction = 'knockdown';
      this.enterKnockdown(now, R.knockdown, air ? -260 : 160);
      out.launchVz = k.vz;
      if (skill.endsCombo) {
        if (this.arena) { this.released = true; this.combos.endAll(); this.hard.reset(); this.pinUntil = -1; this.bounce = false; } // the arena: the finisher ends it — untouchable until up again (no new combo off the fall)
        else this.combos.end(attacker);
      }
    } else if (R.launch) {
      const relaunch = air;
      const over = R.grab ? 0 : this.airOver();
      const budgetOk = over < 1 && (!relaunch || c.relaunches < COMBO.maxRelaunchesPerCombo + 2);
      if (budgetOk) {
        let h = (relaunch ? R.launch * 0.8 : R.launch) * 1.3 * (1 - 0.6 * over);
        if (this.arena) h = Math.max(30, Math.min(h, ARENA.launchCap - (k.z - k.supportZ))); // never out of the follow-ups' reach
        k.grounded = false; k.vz = Math.sqrt(2 * PHYS.gravity * LAUNCH_G * h); out.launchVz = k.vz;
        if (relaunch) c.relaunches++;
        c.juggle += relaunch ? COMBO.juggleCosts.relaunch : juggleCost;
        this.state = 'launched'; out.reaction = 'launch';
      } else {
        out.reaction = 'hit'; this.hitstun(now, R.stun ?? 150, stunIdx, out);
        if (air) k.vz = Math.min(k.vz, -120); // budget spent: forced toward the fall
      }
    } else if (air && this.state === 'launched') {
      // Air extender: keep the target afloat while budget remains, otherwise it falls.
      c.juggle += juggleCost;
      const over = this.airOver();
      if (over < 1) { // hold: lift while low, only stall the fall when already high (keeps targets inside melee reach)
        const lift = GAUGE.holdVz * (R.float ? 1 : 0.8) * (1 - over) * Math.max(0, Math.min(1, (GAUGE.holdCeil - k.z) / GAUGE.holdCeil));
        k.vz = Math.max(k.vz, k.z > GAUGE.holdCeil ? -60 : lift); out.reaction = 'float'; out.launchVz = k.vz;
      }
      else k.vz = Math.min(k.vz, -160);
    } else if (R.stun && out.reaction !== 'cc') {
      this.hitstun(now, R.stun, stunIdx, out);
    }
    if (R.pin) { this.pinUntil = now + R.pin; this.push = null; k.vx = 0; k.vy = 0; k.vz = Math.max(0, Math.min(k.vz, 0)); if (this.state === 'free') { this.state = 'hitstun'; this.stateEnd = now + R.pin; } }
    if (!airNow && !downNow && this.gauge.stand >= GAUGE.stand && this.state !== 'knockdown' && out.reaction === 'hit') { // standing limit → forced fall
      this.enterKnockdown(now, 'light', 200); out.reaction = 'knockdown'; out.launchVz = k.vz;
    }
    if (downNow && this.gauge.down >= GAUGE.down) { // ground limit → quick invulnerable getup
      this.state = 'getup'; this.kdPhase = 'up'; this.stateEnd = now + 160; this.invulnUntil = now + 160 + GAUGE.wakeInvulnMs;
    }
    if (release && this.state !== 'getup') { this.release(now); out.reaction = 'knockdown'; out.endsCombo = true; out.launchVz = k.vz; }
    out.juggle = c.juggle;
    return out;
  }

  /** Arena: the combo has had its share (damage / hits / time) — out of it: a short fall, untouchable until up again
   *  (and guarded a moment after that). */
  private release(now: number): void {
    this.released = true;
    this.combos.endAll(); this.hard.reset(); this.pinUntil = -1; this.bounce = false;
    const k = this.kin;
    if (k.grounded) this.enterKnockdown(now, 'light', 200);
    else { this.state = 'knockdown'; this.kdPhase = 'fall'; k.vz = Math.min(k.vz, -260); this.stateEnd = now + 380; }
  }

  /** Arena BREAK possible now: being comboed (from its breakMinHits-th hit), off cooldown, not already out of it. On the
   *  floor the quick getup is the way up instead. */
  canBreak(now: number): boolean {
    if (!this.arena || now < this.breakReadyAt || this.released || this.state === 'dead' || this.state === 'getup') return false;
    if (this.state === 'knockdown' && this.kdPhase !== 'fall') return false;
    if (this.state === 'free' && !this.hard.active(now)) return false;
    const c = this.combos.live(now);
    return !!c && c.hits >= ARENA.breakMinHits;
  }

  /** Arena BREAK: free at once, untouchable a moment, the combo over (the scene moves the body and plays the burst). */
  doBreak(now: number): void {
    this.breakReadyAt = now + ARENA.breakCdMs;
    this.combos.endAll(); this.hard.reset(); this.hard.grantImmunity(now, ARENA.breakInvulnMs + 300);
    this.state = 'free'; this.stateEnd = 0; this.kdPhase = 'fall'; this.pinUntil = -1; this.push = null; this.bounce = false; this.released = false;
    this.ghostUntil = now + ARENA.breakInvulnMs; this.gauge = { stand: 0, air: 0, down: 0 };
  }

  /** Arena: down on the floor a moment, a key pressed — up at once (a short, guarded rise). */
  quickGetup(now: number): boolean {
    if (!this.arena || this.state !== 'knockdown' || this.kdPhase !== 'down' || !this.kin.grounded || now - this.downAt < ARENA.techMinMs) return false;
    this.state = 'getup'; this.kdPhase = 'up'; this.stateEnd = now + 160;
    return true;
  }

  private hitstun(now: number, ms: number, idx: number, out: HitOutcome): void {
    const s = Math.max(COMBO.hitStunFloorMs, Math.round(ms * (this.arena ? arenaStun(idx) : stunScale(idx))));
    out.stunMs = s;
    if (this.state === 'launched' || this.state === 'knockdown') return;
    this.state = 'hitstun'; this.stateEnd = Math.max(this.stateEnd, now + s);
  }

  enterKnockdown(now: number, kind: 'light' | 'heavy', vz: number): void {
    this.state = 'knockdown'; this.kdPhase = this.kin.grounded ? 'impact' : 'fall';
    if (this.kin.grounded) { this.kin.grounded = false; this.kin.vz = Math.max(160, vz); }
    else this.kin.vz = Math.min(this.kin.vz, vz);
    this.stateEnd = now + (kind === 'heavy' ? 520 : 400);
  }

  /** Air tech: Jump + direction while juggled late in a combo (moves 45px, starts falling, brief hard-CC immunity). */
  tryAirTech(now: number, dirX: number, dirY: number): boolean {
    if (this.state !== 'launched' || now < this.airTechCdUntil) return false;
    const c = this.combos.live(now);
    const T = COMBO.airTech;
    if (!c || !(now - c.startedAt > T.comboDurationThresholdMs || c.juggle >= T.juggleThreshold)) return false;
    const l = Math.hypot(dirX, dirY) || 1;
    this.push = { vx: (dirX / l) * T.lateralPx / 140, vy: (dirY / l) * T.lateralPx / 140, left: 140 };
    this.kin.vz = Math.min(this.kin.vz, -60);
    this.state = 'free'; this.hard.grantImmunity(now, T.hardCcImmunityMs); this.airTechCdUntil = now + T.cooldownMs;
    this.combos.endAll();
    return true;
  }

  /** Per-frame state progression (after kinematics). `landed` = this frame's landing event. */
  update(now: number, ms: number, landed: boolean, impactVz: number): 'land' | 'kdImpact' | 'getupDone' | null {
    const k = this.kin;
    if (this.push) {
      const t = Math.min(ms, this.push.left); this.push.left -= t;
      k.vx = this.push.vx * 1000; k.vy = this.push.vy * 1000;
      if (this.push.left <= 0) { this.push = null; k.vx = 0; k.vy = 0; }
    }
    let ev: 'land' | 'kdImpact' | 'getupDone' | null = null;
    if (now - this.lastHitAt > GAUGE.resetMs && this.state === 'free') this.gauge = { stand: 0, air: 0, down: 0 };
    if (this.arena && this.state !== 'free') this.combos.hold(now); // a long fall is still the same combo (its budget too)
    switch (this.state) {
      case 'hitstun': if (now >= this.stateEnd) this.state = 'free'; break;
      case 'launched':
        if (landed) { // landing from a juggle: short knockdown + getup
          this.state = 'knockdown'; this.kdPhase = 'impact'; this.stateEnd = now + (this.arena ? ARENA.floorMs : 180 + 250); ev = 'kdImpact';
        }
        break;
      case 'knockdown':
        if (this.kdPhase === 'fall' && landed && this.bounce) { // ground bounce: back into the air, still juggleable
          this.bounce = false; k.grounded = false; k.vz = 330; this.state = 'launched'; ev = 'kdImpact'; break;
        }
        if (this.kdPhase === 'fall' && landed) { this.kdPhase = 'impact'; ev = 'kdImpact'; this.stateEnd = Math.max(this.stateEnd, now + (this.arena ? ARENA.floorMs : 430)); }
        else if (this.kdPhase === 'impact' && k.grounded) { this.kdPhase = 'down'; this.downAt = now; }
        if (k.grounded && now >= this.stateEnd) { this.state = 'getup'; this.kdPhase = 'up'; this.stateEnd = now + 260; }
        break;
      case 'getup':
        if (now >= this.stateEnd) {
          this.state = 'free'; this.hard.grantImmunity(now, 220); this.combos.endAll(); this.gauge = { stand: 0, air: 0, down: 0 }; ev = 'getupDone';
          if (this.arena) { this.released = false; this.ghostUntil = Math.max(this.ghostUntil, now + ARENA.wakeInvulnMs); } // the arena: every wake-up is guarded
        }
        break;
      default: break;
    }
    if (this.state === 'free' && landed && impactVz > 0) ev = ev ?? 'land';
    return ev;
  }

  /** Gravity multiplier while juggled (mildly heavier as the juggle score rises). */
  gravityScale(now: number): number {
    if (now < this.pinUntil) { this.kin.vz = 0; return 0; }
    if (now < this.levityUntil) { // Levity Field: gravity turned over — up to a hover and held there, unable to move
      const k = this.kin, top = k.supportZ + MAGE.levityZ;
      k.grounded = false; k.vx = 0; k.vy = 0; k.vz = Math.max(-80, Math.min(170, (top - k.z) * 4));
      return 0;
    }
    if (this.state !== 'launched') return 1;
    const c = this.combos.live(now);
    void c;
    return LAUNCH_G + GAUGE.gravityRamp * Math.min(1.5, this.airOver()); // free below the air limit, then heavier and heavier
  }
}
