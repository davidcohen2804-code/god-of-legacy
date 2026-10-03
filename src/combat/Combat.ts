// Combat foundation shared by every actor (local player, remote player mirror, enemy, dummy):
// real ground x/y + height z kinematics with support surfaces, the combat state machine
// (free / hitstun / launched / knockdown / getup / hardCC / dead), victim-side combo context (combo scaling,
// juggle budget, one re-launch), and the hard-CC diminishing-returns policy kept separate from ordinary hit-stun.
import COMBO from '../data/combo-policy.json';
import { WORLD_OBJECTS, footAllowed, pointInPoly, supportAt } from '../world/WorldGeometry';
import { FinalSkill, HitEvent, Reaction } from '../skills/SkillTypes';

// ------------------------------------------------------------------ kinematics

/** Movement / jump tuning (06 spec; jump strength calibrated so the 78px pedestal top is reachable). */
export const PHYS = {
  walk: 188, run: 270, accel: 1500, decel: 1900, turnMult: 1.15, airAccel: 0.55, takeoffKeep: 0.92,
  jumpVz: 445, gravity: 1100, landMs: 90, takeoffMs: 70, footR: 10, mantle: 16,
};

export interface Kin { x: number; y: number; z: number; vx: number; vy: number; vz: number; supportZ: number; supportId: string | null; grounded: boolean }

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

export function stepKin(k: Kin, ms: number, gravityScale = 1, blocked?: (x: number, y: number, z: number) => boolean): StepResult {
  const dt = Math.min(0.05, ms / 1000), r: StepResult = { landed: false, impactVz: 0, blockedX: false, blockedY: false, leftSupport: false };
  const ok = (x: number, y: number) => {
    if (footAllowed(x, y, k.z, PHYS.footR) && !(blocked && blocked(x, y, k.z))) return true;
    // Ledge mantle: airborne within reach of a standable top's lip → step up onto it (never through hard cover).
    if (k.grounded) return false;
    for (const o of WORLD_OBJECTS) {
      if (o.topZ === undefined || k.z < o.topZ - PHYS.mantle || k.z >= o.topZ) continue;
      if (footAllowed(x, y, o.topZ, PHYS.footR) && !(blocked && blocked(x, y, o.topZ)) && pointInPolyNear(x, y, o.footprint)) { k.z = o.topZ; if (k.vz < 0) k.vz = 0; return true; }
    }
    return false;
  };
  const dx = k.vx * dt, dy = k.vy * dt, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let i = 0; i < n; i++) {
    if (dx !== 0 && !r.blockedX) { const nx = k.x + dx / n; if (ok(nx, k.y)) k.x = nx; else { r.blockedX = true; k.vx = 0; } }
    if (dy !== 0 && !r.blockedY) { const ny = k.y + dy / n; if (ok(k.x, ny)) k.y = ny; else { r.blockedY = true; k.vy = 0; } }
  }
  if (k.grounded) {
    const s = supportAt(k.x, k.y, k.z);
    if (s.z < k.z - 0.5) { k.grounded = false; k.vz = 0; r.leftSupport = true; } // walked off the edge
    else { k.z = s.z; k.supportZ = s.z; k.supportId = s.id; }
  }
  if (!k.grounded) {
    k.vz -= PHYS.gravity * gravityScale * dt;
    k.z += k.vz * dt;
    const s = supportAt(k.x, k.y, Math.max(k.z, k.z - k.vz * dt));
    k.supportZ = s.z; k.supportId = s.id;
    if (k.z <= s.z && k.vz <= 0) { r.landed = true; r.impactVz = -k.vz; k.z = s.z; k.vz = 0; k.grounded = true; }
  }
  return r;
}

/** Start a jump from the current support (no invulnerability; horizontal momentum kept at 92%). */
export function jump(k: Kin, vz = PHYS.jumpVz): void {
  k.grounded = false; k.vz = vz; k.vx *= PHYS.takeoffKeep; k.vy *= PHYS.takeoffKeep;
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

/** Root / freeze / stun policy: max single, DR multipliers in a window, post-CC immunity. Damage always applies. */
export class HardCC {
  private tier = 0;
  private lastAccepted = -Infinity;
  end = -Infinity;
  kind: 'root' | 'freeze' | 'stun' | null = null;
  immuneUntil = -Infinity;

  active(now: number): boolean { return now < this.end; }
  /** Returns the applied duration (0 = rejected by immunity / DR). */
  apply(kind: 'root' | 'freeze' | 'stun', ms: number, now: number, pvp: boolean): number {
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

export interface ComboCtx { id: number; attacker: string; startedAt: number; lastAt: number; hits: number; juggle: number; relaunches: number; ended: boolean }

export class ComboBook {
  private ctx = new Map<string, ComboCtx>();
  private seq = 0;
  get(attacker: string, now: number): ComboCtx {
    let c = this.ctx.get(attacker);
    if (!c || c.ended || now - c.lastAt > COMBO.comboTimeoutMs) {
      c = { id: ++this.seq, attacker, startedAt: now, lastAt: now, hits: 0, juggle: 0, relaunches: 0, ended: false };
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
}

/** Combat state + reactions of one actor. The owner is the authority for its own body (victim-side model). */
export class CombatBody {
  state: ActState = 'free';
  stateEnd = 0;
  kdPhase: 'fall' | 'impact' | 'down' | 'up' = 'fall';
  slowPct = 0;
  slowUntil = 0;
  readonly hard = new HardCC();
  readonly combos = new ComboBook();
  /** Push motion (px/ms) applied over a short window. */
  push: { vx: number; vy: number; left: number } | null = null;
  armorUntil = -1;
  airTechCdUntil = 0;
  lastHitAt = -Infinity;

  constructor(readonly kin: Kin, readonly pvp: boolean) {}

  canAct(now: number): boolean { return this.state === 'free' && !this.hard.active(now); }
  canMove(now: number): boolean { return this.canAct(now); }
  moveScale(now: number): number { return now < this.slowUntil ? 1 - this.slowPct : 1; }
  reset(): void { this.state = 'free'; this.stateEnd = 0; this.hard.reset(); this.combos.clear(); this.push = null; this.slowUntil = 0; this.armorUntil = -1; }

  /**
   * Apply a confirmed, legal hit from `attacker` (this body's owner is the authority).
   * Order: damage (scaled by combo index) → reaction (soft hit-stun / launch within juggle budget / knockdown / hard CC
   * via DR) → push / pull. Hard-CC immunity never cancels ordinary combo hit reactions.
   */
  receive(attacker: string, skill: FinalSkill, hit: HitEvent, from: { x: number; y: number }, now: number): HitOutcome {
    const c = this.combos.get(attacker, now);
    c.hits++; c.lastAt = now;
    const ult = skill.slot === 7;
    const base = Math.floor(hit.damage * (this.pvp ? skill.pvpMultiplier : skill.pveMultiplier));
    const damage = hit.damage > 0 ? Math.max(1, Math.round(base * damageScale(c.hits, ult))) : 0;
    const R: Reaction = hit.reaction;
    const k = this.kin;
    const out: HitOutcome = { damage, hitIndex: c.hits, comboId: c.id, reaction: 'hit', stunMs: 0, ccMs: 0, juggle: c.juggle, endsCombo: !!skill.endsCombo, pushX: 0, pushY: 0, launchVz: 0 };
    this.lastHitAt = now;
    const armored = now < this.armorUntil;
    // Push / pull direction.
    let dx = k.x - from.x, dy = k.y - from.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    if (!armored) {
      const pushPx = (R.push ?? 0) * (this.pvp ? 0.7 : 1) - (R.pull ?? 0);
      if (pushPx !== 0) { out.pushX = dx * pushPx; out.pushY = dy * pushPx; this.push = { vx: out.pushX / 110, vy: out.pushY / 110, left: 110 }; }
    }
    if (R.slow) { this.slowPct = R.slow.pct; this.slowUntil = Math.max(this.slowUntil, now + R.slow.ms); }
    if (R.hardCC) { out.ccMs = this.hard.apply(R.hardCC.kind, R.hardCC.ms, now, this.pvp); if (out.ccMs > 0) out.reaction = 'cc'; }
    if (armored) { out.reaction = 'armor'; return out; }
    const juggleCost = R.juggleCost ?? 0;
    const air = !k.grounded || this.state === 'launched';
    if (R.knockdown) {
      out.reaction = 'knockdown';
      this.enterKnockdown(now, R.knockdown, air ? -260 : 160);
      out.launchVz = k.vz;
      if (skill.endsCombo) this.combos.end(attacker);
    } else if (R.slam && air) {
      out.reaction = 'slam'; k.vz = -620; this.enterKnockdown(now, 'light', -620); out.launchVz = k.vz;
    } else if (R.launch) {
      const relaunch = air;
      const budgetOk = c.juggle < COMBO.juggleBudgetMax && (!relaunch || c.relaunches < COMBO.maxRelaunchesPerCombo);
      if (budgetOk) {
        const h = relaunch ? R.launch * 0.75 : R.launch;
        k.grounded = false; k.vz = Math.sqrt(2 * PHYS.gravity * h); out.launchVz = k.vz;
        if (relaunch) c.relaunches++;
        c.juggle += relaunch ? COMBO.juggleCosts.relaunch : juggleCost;
        this.state = 'launched'; out.reaction = 'launch';
      } else {
        out.reaction = 'hit'; this.hitstun(now, R.stun ?? 150, c.hits, out);
        if (air) k.vz = Math.min(k.vz, -120); // budget spent: forced toward the fall
      }
    } else if (air && this.state === 'launched') {
      // Air extender: keep the target afloat while budget remains, otherwise it falls.
      c.juggle += juggleCost;
      if (R.float && c.juggle < COMBO.juggleBudgetMax) { k.vz = Math.max(k.vz, 150); out.reaction = 'float'; out.launchVz = k.vz; }
      else k.vz = Math.min(k.vz, -80);
    } else if (R.stun && out.reaction !== 'cc') {
      this.hitstun(now, R.stun, c.hits, out);
    }
    out.juggle = c.juggle;
    return out;
  }

  private hitstun(now: number, ms: number, idx: number, out: HitOutcome): void {
    const s = Math.max(COMBO.hitStunFloorMs, Math.round(ms * stunScale(idx)));
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
    switch (this.state) {
      case 'hitstun': if (now >= this.stateEnd) this.state = 'free'; break;
      case 'launched':
        if (landed) { // landing from a juggle: short knockdown + getup
          this.state = 'knockdown'; this.kdPhase = 'impact'; this.stateEnd = now + 180 + 250; ev = 'kdImpact';
        }
        break;
      case 'knockdown':
        if (this.kdPhase === 'fall' && landed) { this.kdPhase = 'impact'; ev = 'kdImpact'; this.stateEnd = Math.max(this.stateEnd, now + 430); }
        else if (this.kdPhase === 'impact' && k.grounded) { this.kdPhase = 'down'; }
        if (k.grounded && now >= this.stateEnd) { this.state = 'getup'; this.kdPhase = 'up'; this.stateEnd = now + 260; }
        break;
      case 'getup':
        if (now >= this.stateEnd) { this.state = 'free'; this.hard.grantImmunity(now, 220); this.combos.endAll(); ev = 'getupDone'; }
        break;
      default: break;
    }
    if (this.state === 'free' && landed && impactVz > 0) ev = ev ?? 'land';
    return ev;
  }

  /** Gravity multiplier while juggled (mildly heavier as the juggle score rises). */
  gravityScale(now: number): number {
    if (this.state !== 'launched') return 1;
    const c = this.combos.live(now);
    return 1 + 0.35 * Math.min(1, (c?.juggle ?? 0) / 100);
  }
}
