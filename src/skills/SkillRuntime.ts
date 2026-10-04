// One skill runtime for every caster and every target (PvE + PvP): cast runs with startup → active → recovery,
// timed multi-hit events, projectiles (cover-aware, elevation-aware), traps, counter windows, cooldowns of the local
// caster and per-cast/per-hit/per-target de-duplication. Damage/reactions are applied by the scene (authority rules).
import Phaser from 'phaser';
import { FinalSkill, HitEvent } from './SkillTypes';
import { HitTarget, Projectile, V2, V3, burstTargets, chainTargets, fanDirs, shapeContains, spawnProjectile, stepProjectile } from './HitGeometry';

export type Phase = 'startup' | 'active' | 'recovery' | 'done';

export interface CastRequest {
  castId: string;
  skill: FinalSkill;
  stage: number;
  attackerId: string;
  own: boolean;
  origin: V3;
  aim: V2;
  place: V2 | null;
  /** Locked-on target for 'mouseTarget' skills (id), if any. */
  lock?: string | null;
}

export interface CastRun extends CastRequest {
  elapsed: number;
  phase: Phase;
  fired: Set<number>;
  /** Dash-through: already turned to face the crossed target. */
  turned?: boolean;
  slid?: boolean;
  hitKeys: Set<string>;
  /** First confirmed hit (authority or predicted) — opens the hit-confirm cancel window. */
  confirmedAt: number;
  pathStart: V2;
  counterTriggered: boolean;
  /** Extra recovery (whiffed counter). */
  extraRecovery: number;
  timings: { startup: number; active: number; recovery: number };
  hits: HitEvent[];
  chainFirst?: string | null;
}

export interface Trap { run: CastRun; hit: HitEvent; x: number; y: number; until: number; radius: number }

export interface RuntimeWorld {
  now(): number;
  targets(run: CastRun): HitTarget[];
  onHit(run: CastRun, hit: HitEvent, hitIndex: number, target: HitTarget, at: V3): void;
  casterPos(attackerId: string): V3 | null;
  onPhase?(run: CastRun, phase: Phase): void;
  /** Reach multiplier for the caster's melee sword shapes (Radiant Blade). */
  reachMul?(req: CastRequest): number;
}

export const RT_EVENTS = {
  cast: 'cast', active: 'active', hit: 'hitFired', projectile: 'projectile', projectileEnd: 'projectileEnd',
  trap: 'trap', trapTrigger: 'trapTrigger', end: 'end', cancelled: 'cancelled', counter: 'counter', chain: 'chain',
} as const;

export class SkillRuntime {
  readonly events = new Phaser.Events.EventEmitter();
  runs: CastRun[] = [];
  projectiles: { p: Projectile; run: CastRun; hit: HitEvent }[] = [];
  traps: Trap[] = [];
  readonly cooldownEnd = new Map<string, number>();
  private charges = new Map<string, { used: number; last: number }>();

  constructor(private world: RuntimeWorld) {}

  get ownRun(): CastRun | undefined { return this.runs.find((r) => r.own && r.phase !== 'done'); }
  locked(): boolean { return !!this.ownRun; }
  cooldownRemaining(id: string): number { return Math.max(0, (this.cooldownEnd.get(id) ?? 0) - this.world.now()); }
  get projectileCount(): number { return this.projectiles.length; }
  get runCount(): number { return this.runs.length; }

  start(req: CastRequest, startElapsed = 0): CastRun {
    const s = req.skill;
    const timings = s.chain?.timings?.[req.stage] ?? { startup: s.startup, active: s.active, recovery: s.recovery };
    let hits = s.chain ? s.chain.stages[req.stage] : s.hits;
    const rm = this.world.reachMul?.(req) ?? 1;
    if (rm !== 1) hits = hits.map((h) => h.shape.kind === 'sector' ? { ...h, shape: { ...h.shape, range: h.shape.range * rm } }
      : h.shape.kind === 'line' ? { ...h, shape: { ...h.shape, length: h.shape.length * rm } } : h);
    const run: CastRun = {
      ...req, elapsed: startElapsed, phase: 'startup', fired: new Set(), hitKeys: new Set(), confirmedAt: -1,
      pathStart: { x: req.origin.x, y: req.origin.y }, counterTriggered: false, extraRecovery: 0, timings, hits,
    };
    if (req.own && s.cooldown > 0) {
      // Charged skills: N quick uses in a row (window 4s between uses), then the full cooldown.
      const now = this.world.now(), ch = this.charges.get(s.id);
      const used = s.charges && ch && now - ch.last < 4000 ? ch.used + 1 : 1;
      this.charges.set(s.id, { used, last: now });
      if (!s.charges || used >= s.charges) { this.cooldownEnd.set(s.id, now + s.cooldown); this.charges.delete(s.id); }
      else this.cooldownEnd.set(s.id, now + 350); // tiny gap between charges
    }
    this.runs.push(run);
    this.events.emit(RT_EVENTS.cast, run);
    this.world.onPhase?.(run, 'startup');
    return run;
  }

  /** Total action length of a run (incl. whiff penalty). */
  static lockOf(run: CastRun): number { return run.timings.startup + run.timings.active + run.timings.recovery + run.extraRecovery; }

  /** Interrupt the own caster (death / scene exit / hard reaction): pending startup/active cancelled, no refund. */
  cancelOwn(reason: 'death' | 'sceneExit' | 'hit' | 'cancel'): void {
    for (const r of this.runs) {
      if (!r.own || r.phase === 'done') continue;
      if (reason === 'cancel' && r.phase === 'recovery') { r.phase = 'done'; continue; }
      r.phase = 'done';
      this.events.emit(RT_EVENTS.cancelled, r);
    }
    if (reason === 'death' || reason === 'sceneExit') {
      this.projectiles = this.projectiles.filter((e) => !e.run.own);
      this.traps = this.traps.filter((t) => !t.run.own);
    }
  }

  /** Cancel the own run for a hit-confirm cancel (keeps its projectiles/zones alive). */
  cancelForFollowUp(run: CastRun): void { if (run.phase !== 'done') { run.phase = 'done'; this.events.emit(RT_EVENTS.end, run); } }

  cancelAttacker(id: string): void {
    for (const r of this.runs) if (r.attackerId === id && r.phase !== 'done') { r.phase = 'done'; this.events.emit(RT_EVENTS.cancelled, r); }
    this.projectiles = this.projectiles.filter((e) => e.p.attackerId !== id);
    this.traps = this.traps.filter((t) => t.run.attackerId !== id);
  }

  /** Counter stance currently open for this caster? */
  counterOpen(attackerId: string): CastRun | null {
    for (const r of this.runs) {
      const c = r.skill.counter;
      if (!c || r.attackerId !== attackerId || r.phase === 'done' || r.counterTriggered) continue;
      const t0 = r.timings.startup;
      if (r.elapsed >= t0 && r.elapsed < t0 + c.window) return r;
    }
    return null;
  }

  /** Counter triggered: the reappearing slash fires now, aimed at the attacker. */
  triggerCounter(run: CastRun, aim: V2, newOrigin: V3): void {
    run.counterTriggered = true;
    run.aim = aim; run.origin = newOrigin; run.pathStart = { x: newOrigin.x, y: newOrigin.y };
    run.elapsed = run.timings.startup; // re-enter active from the trigger moment
    run.phase = 'active';
    this.events.emit(RT_EVENTS.counter, run);
    this.fireHit(run, 0);
  }

  update(ms: number): void {
    for (const r of this.runs) this.advance(r, ms);
    this.runs = this.runs.filter((r) => r.phase !== 'done');
    this.stepProjectiles(ms);
    this.stepTraps();
  }

  destroy(): void {
    for (const r of this.runs) if (r.phase !== 'done') { r.phase = 'done'; this.events.emit(RT_EVENTS.cancelled, r); }
    this.runs = []; this.projectiles = []; this.traps = [];
    this.events.removeAllListeners();
    this.cooldownEnd.clear(); this.charges.clear();
  }

  // ------------------------------------------------------------------ internals

  private advance(r: CastRun, ms: number): void {
    if (r.phase === 'done') return;
    r.elapsed += ms;
    const T = r.timings, activeStart = T.startup, activeEnd = T.startup + T.active;
    if (r.phase === 'startup' && r.elapsed >= activeStart) {
      r.phase = 'active';
      this.events.emit(RT_EVENTS.active, r);
      this.world.onPhase?.(r, 'active');
    }
    if (r.phase === 'active' && !r.skill.counter) {
      r.hits.forEach((h, i) => {
        if (r.elapsed < activeStart + h.at) return;
        if (!r.fired.has(i)) this.fireHit(r, i);
        else if (h.shape.kind === 'capsule') this.sweepCapsule(r, i); // dash hitbox sweeps the whole travelled path
      });
    }
    if (r.phase === 'active' && r.elapsed >= activeEnd) {
      if (r.skill.counter && !r.counterTriggered) r.extraRecovery = 200; // whiffed counter: punishable
      r.phase = 'recovery';
      this.world.onPhase?.(r, 'recovery');
    }
    if (r.phase === 'recovery' && r.elapsed >= SkillRuntime.lockOf(r)) {
      r.phase = 'done';
      this.events.emit(RT_EVENTS.end, r);
      this.world.onPhase?.(r, 'done');
    }
  }

  private fireHit(r: CastRun, i: number): void {
    r.fired.add(i);
    const h = r.hits[i], s = h.shape;
    const cur = this.world.casterPos(r.attackerId) ?? r.origin;
    const origin: V3 = r.skill.dash || r.skill.counter ? cur : { x: r.origin.x, y: r.origin.y, z: cur.z };
    this.events.emit(RT_EVENTS.hit, r, i, origin);
    if (s.kind === 'projectile') {
      const aim = this.liveAim(r, origin);
      for (const d of fanDirs(aim, s.count, s.spread)) {
        const p = spawnProjectile(r.castId, i, r.skill, s, r.attackerId, origin, d);
        this.projectiles.push({ p, run: r, hit: h });
        this.events.emit(RT_EVENTS.projectile, p, r);
      }
      return;
    }
    if (r.skill.trap) {
      const t: Trap = { run: r, hit: h, x: r.place?.x ?? origin.x, y: r.place?.y ?? origin.y, until: this.world.now() + r.skill.trap.lifeMs, radius: r.skill.trap.radius };
      this.traps.push(t);
      this.events.emit(RT_EVENTS.trap, t);
      return;
    }
    const targets = this.world.targets(r);
    if (s.kind === 'chain') {
      const alive = targets.filter((t) => t.alive && t.id !== r.attackerId);
      let hit: HitTarget | null = null;
      if (s.jump <= 0) { hit = chainTargets(s, origin, r.aim, alive, h.reachUp ?? 140)[0] ?? null; r.chainFirst = hit?.id ?? null; }
      else {
        const first = alive.find((t) => t.id === r.chainFirst);
        if (first) {
          let bd = Infinity;
          for (const t of alive) { if (t === first) continue; const dd = Math.hypot(t.x - first.x, t.y - first.y); if (dd <= s.jump && dd < bd) { bd = dd; hit = t; } }
          hit = hit ?? first; // single target: the arc strikes it again
        }
      }
      this.events.emit(RT_EVENTS.chain, r, i, origin, hit);
      if (hit) this.deliver(r, h, i, hit, { x: hit.x, y: hit.y, z: hit.z + 40 });
      return;
    }
    const path: [V2, V2] = [r.pathStart, { x: cur.x, y: cur.y }];
    for (const t of targets) {
      if (!t.alive || t.id === r.attackerId) continue;
      if (shapeContains(h, origin, r.aim, r.place, path, t)) this.deliver(r, h, i, t, { x: t.x, y: t.y, z: t.z + 40 });
    }
  }

  /** Capsule (dash) hits keep testing the path travelled so far for the rest of the active window. */
  private sweepCapsule(r: CastRun, i: number): void {
    const h = r.hits[i], cur = this.world.casterPos(r.attackerId) ?? r.origin;
    const path: [V2, V2] = [r.pathStart, { x: cur.x, y: cur.y }];
    for (const t of this.world.targets(r)) {
      if (!t.alive || t.id === r.attackerId) continue;
      if (shapeContains(h, cur, r.aim, r.place, path, t)) this.deliver(r, h, i, t, { x: t.x, y: t.y, z: t.z + 40 });
    }
  }

  /** Aim used when a projectile fires (casters may keep tracking the cursor during startup). */
  private liveAim(r: CastRun, _o: V3): V2 { return r.aim; }

  private deliver(r: CastRun, h: HitEvent, i: number, t: HitTarget, at: V3): void {
    // Multi-arrow fan: one damage event per target per cast; other skills: once per hit event per target.
    const key = h.shape.kind === 'projectile' && (h.shape.count ?? 1) > 1 ? `${r.castId}|fan|${t.id}` : `${r.castId}|${i}|${t.id}`;
    if (r.hitKeys.has(key)) return;
    r.hitKeys.add(key);
    this.world.onHit(r, h, i, t, at);
  }

  private stepProjectiles(ms: number): void {
    for (const e of this.projectiles) {
      const targets = this.world.targets(e.run);
      const already = new Set([...e.run.hitKeys].filter((k) => k.includes(`|${e.p.hitIndex}|`) || k.includes('|fan|')).map((k) => k.split('|')[2]));
      const hits = stepProjectile(e.p, ms, targets, already);
      for (const t of hits) this.deliver(e.run, e.hit, e.p.hitIndex, t, { x: e.p.x, y: e.p.y, z: e.p.z });
      if (e.p.done) {
        if (e.p.explodeRadius > 0) { // burst at target / cover / max range
          for (const t of burstTargets(e.p.skill, e.p.attackerId, e.p, e.p.explodeRadius, targets)) this.deliver(e.run, e.hit, e.p.hitIndex, t, { x: e.p.x, y: e.p.y, z: e.p.z });
        }
        this.events.emit(RT_EVENTS.projectileEnd, e.p, e.run);
      }
    }
    this.projectiles = this.projectiles.filter((e) => !e.p.done);
  }

  private stepTraps(): void {
    const now = this.world.now();
    this.traps = this.traps.filter((t) => {
      if (now >= t.until) { this.events.emit(RT_EVENTS.trapTrigger, t, false); return false; }
      const victims = this.world.targets(t.run).filter((v) => v.alive && v.id !== t.run.attackerId && v.z < 20 && Math.hypot(v.x - t.x, v.y - t.y) <= t.radius + v.radius);
      if (!victims.length) return true;
      this.events.emit(RT_EVENTS.trapTrigger, t, true);
      for (const v of victims) this.deliver(t.run, t.hit, 0, v, { x: v.x, y: v.y, z: v.z + 10 });
      return false;
    });
  }
}
