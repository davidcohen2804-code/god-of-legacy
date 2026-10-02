// One skill engine for every caster and every target (PvE and PvP).
// Owns cast runs (phases), projectiles, per-cast per-target hit deduplication, cooldowns of the local caster,
// cosmetic VFX and combo-ready events. Damage/control are applied by the scene's CombatAdapter callbacks.
import Phaser from 'phaser';
import { Dir } from '../world/collision';
import { HitTarget, Projectile, Vec, burstHits, shapeHits, spawnProjectile, stepPiercing, stepProjectile } from './HitResolver';
import { SkillDef } from './SkillRegistry';
import { SkillVfx } from './SkillVfx';

export type Phase = 'cast' | 'active' | 'recovery' | 'done';

export interface CastRun {
  castId: string;
  skill: SkillDef;
  attackerId: string;
  /** true = cast by this client's own player (cooldown/lock/movement owner). */
  own: boolean;
  origin: Vec;
  dir: Dir;
  place: Vec | null;
  elapsed: number;
  phase: Phase;
  hits: Set<string>; // dedup key part: targetId (per cast)
  projectileSpawned: boolean;
}

export interface SkillEventBase { castId: string; skillId: string; attackerId: string; t: number }
export interface HitConfirmedEvent extends SkillEventBase {
  targetId: string; targetKind: 'player' | 'enemy'; damageApplied: number; hitIndex: number;
  stunAppliedMs: number; knockbackApplied: number; comboTags: string[];
}

export interface SkillWorld {
  now(): number;
  /** Targets this client may test a run against (authority decides inside onHit). */
  targets(run: CastRun): HitTarget[];
  /** A legal, deduplicated hit. The scene applies damage/control if it is the authority for that target. */
  onHit(run: CastRun, target: HitTarget): void;
  /** Caster position for follow-VFX (own player or remote sprite). */
  casterPos(attackerId: string): Vec | null;
  /** Phase transitions (pose / flash / interrupt hooks). */
  onPhase?(run: CastRun, phase: Phase): void;
}

export const EVENTS = {
  castStarted: 'SkillCastStarted', activeStarted: 'SkillActiveStarted', recoveryStarted: 'SkillRecoveryStarted',
  finished: 'SkillFinished', cancelled: 'SkillCancelled', hitConfirmed: 'HitConfirmed',
} as const;

const BODY_UP = 40; // visual body-centre lift for melee strips (render only)

export class SkillSystem {
  readonly events = new Phaser.Events.EventEmitter();
  readonly vfx: SkillVfx;
  private runs: CastRun[] = [];
  private projectiles: { p: Projectile; img: Phaser.GameObjects.Image; run: CastRun }[] = [];
  /** Local caster cooldown end per skill id (authority clock). */
  readonly cooldownEnd = new Map<string, number>();
  private confirmed = new Set<string>(); // castId:targetId — HitConfirmed emitted once
  private hitIndex = new Map<string, number>();

  constructor(private scene: Phaser.Scene, private world: SkillWorld) {
    this.vfx = new SkillVfx(scene);
  }

  /** The own player's current action (lock) run, if any. */
  get ownRun(): CastRun | undefined { return this.runs.find((r) => r.own && r.phase !== 'done'); }

  /** Actor action lock (one action at a time). */
  locked(): boolean { return !!this.ownRun; }

  cooldownRemaining(skillId: string): number { return Math.max(0, (this.cooldownEnd.get(skillId) ?? 0) - this.world.now()); }

  /** Start an accepted cast (validation is the caller's job). Cooldown starts on the accepted cast. */
  start(run: Omit<CastRun, 'elapsed' | 'phase' | 'hits' | 'projectileSpawned'>, startElapsed = 0): CastRun {
    const r: CastRun = { ...run, elapsed: startElapsed, phase: 'cast', hits: new Set(), projectileSpawned: false };
    if (r.own) this.cooldownEnd.set(r.skill.id, this.world.now() + r.skill.cooldownMs);
    this.runs.push(r);
    this.emit(EVENTS.castStarted, r);
    this.world.onPhase?.(r, 'cast');
    this.playVfx(r);
    return r;
  }

  /** Interrupt (death / scene exit / hard control): pending cast/active is cancelled, no refund. */
  cancelOwn(ownerId: string, reason: 'death' | 'sceneExit' | 'control'): void {
    for (const r of this.runs) {
      if (!r.own || r.phase === 'done') continue;
      if (reason === 'control' && r.phase === 'recovery') continue; // only pending cast/active melee
      r.phase = 'done';
      this.emit(EVENTS.cancelled, r);
    }
    if (reason !== 'control') this.dropProjectiles((p) => p.attackerId === ownerId); // owner projectiles die with the owner
  }

  /** Remote attacker left / died: its pending casts and projectiles stop. */
  cancelAttacker(attackerId: string): void {
    for (const r of this.runs) if (r.attackerId === attackerId && r.phase !== 'done') { r.phase = 'done'; this.emit(EVENTS.cancelled, r); }
    this.dropProjectiles((p) => p.attackerId === attackerId);
  }

  /** Adapter events for actions outside the run timeline (the existing Warrior basic). */
  emitEvent(name: string, castId: string, skillId: string, attackerId: string): void {
    this.events.emit(name, { castId, skillId, attackerId, t: this.world.now() } as SkillEventBase);
  }

  /** Called by the scene's CombatAdapter when it (as authority) confirmed and applied a hit. */
  confirmHit(castId: string, skill: SkillDef, attackerId: string, targetId: string, targetKind: 'player' | 'enemy', damage: number, stunMs: number, knockback: number): void {
    const key = `${castId}:${targetId}`;
    if (this.confirmed.has(key)) return; // replays / duplicates never count twice
    this.confirmed.add(key);
    const idx = (this.hitIndex.get(castId) ?? 0) + 1;
    this.hitIndex.set(castId, idx);
    const ev: HitConfirmedEvent = {
      castId, skillId: skill.id, attackerId, t: this.world.now(), targetId, targetKind, damageApplied: damage,
      hitIndex: idx, stunAppliedMs: stunMs, knockbackApplied: knockback, comboTags: skill.comboTags,
    };
    this.events.emit(EVENTS.hitConfirmed, ev);
  }

  update(ms: number): void {
    for (const r of this.runs) this.advance(r, ms);
    this.runs = this.runs.filter((r) => r.phase !== 'done');
    this.stepProjectiles(ms);
    this.vfx.update(ms);
  }

  destroy(): void {
    for (const r of this.runs) if (r.phase !== 'done') { r.phase = 'done'; this.emit(EVENTS.cancelled, r); }
    this.runs = [];
    this.dropProjectiles(() => true);
    this.vfx.destroy();
    this.events.removeAllListeners();
    this.confirmed.clear();
    this.hitIndex.clear();
    this.cooldownEnd.clear();
  }

  /** For QA. */
  get projectileCount(): number { return this.projectiles.length; }
  get runCount(): number { return this.runs.length; }

  // ------------------------------------------------------------------ internals

  private advance(r: CastRun, ms: number): void {
    if (r.phase === 'done') return;
    const s = r.skill;
    r.elapsed += ms;
    const detached = !!s.detachedActive;
    const activeEnd = detached ? s.castMs : s.castMs + s.activeMs;
    const lockEnd = detached ? s.actionLockMs : s.castMs + s.activeMs + s.recoveryMs;

    if (r.phase === 'cast' && r.elapsed >= s.castMs) {
      r.phase = detached ? 'recovery' : 'active';
      this.emit(EVENTS.activeStarted, r);
      this.world.onPhase?.(r, 'active');
      if (detached && !r.projectileSpawned) { r.projectileSpawned = true; this.spawn(r); }
      if (detached) { this.emit(EVENTS.recoveryStarted, r); this.world.onPhase?.(r, 'recovery'); }
    }
    if (r.phase === 'active') {
      if (s.geometry.kind !== 'projectile') this.resolveShape(r, Math.min(1, (r.elapsed - s.castMs) / Math.max(1, s.activeMs)));
      if (r.elapsed >= activeEnd) {
        if (s.geometry.kind !== 'projectile') this.resolveShape(r, 1); // swept to the end: low FPS cannot skip
        r.phase = 'recovery';
        this.emit(EVENTS.recoveryStarted, r);
        this.world.onPhase?.(r, 'recovery');
      }
    }
    if (r.phase === 'recovery' && r.elapsed >= lockEnd) {
      r.phase = 'done';
      this.emit(EVENTS.finished, r);
      this.world.onPhase?.(r, 'done');
    }
  }

  private resolveShape(r: CastRun, progress: number): void {
    const hits = shapeHits(r.skill, r.attackerId, r.origin, r.dir, progress, r.place, this.world.targets(r));
    for (const t of hits) {
      if (r.hits.has(t.id)) continue; // (castId, targetId) dedup: maxHits=1 per target per cast
      if (r.hits.size >= (r.skill.geometry.maxTargets ?? Infinity)) break;
      r.hits.add(t.id);
      this.world.onHit(r, t);
    }
  }

  private spawn(r: CastRun): void {
    const p = spawnProjectile(r.castId, r.skill, r.attackerId, r.origin, r.dir);
    const img = this.vfx.projectile(r.skill.vfx ?? r.skill.id, r.dir);
    this.projectiles.push({ p, img, run: r });
    this.placeProjectile(p, img);
  }

  private stepProjectiles(ms: number): void {
    for (const e of this.projectiles) {
      // Projectile lifetime is independent of the caster's action lock (the run may already be finished).
      const g = e.p.skill.geometry, targets = this.world.targets(e.run);
      if (g.pierce) {
        for (const t of stepPiercing(e.p, ms, targets, e.run.hits)) { e.run.hits.add(t.id); this.world.onHit(e.run, t); }
      } else {
        const hit = stepProjectile(e.p, ms, targets);
        if (hit && !e.run.hits.has(hit.id)) { e.run.hits.add(hit.id); this.world.onHit(e.run, hit); }
      }
      if (e.p.done && g.explodeRadius) { // burst at the impact point (each target still once per cast)
        for (const t of burstHits(e.p.skill, e.p.attackerId, e.p, g.explodeRadius, targets)) {
          if (e.run.hits.has(t.id)) continue;
          e.run.hits.add(t.id); this.world.onHit(e.run, t);
        }
        this.vfx.playCast(e.p.skill.vfx ?? e.p.skill.id, { x: e.p.x, y: e.p.y }, e.p.dir, 0);
      }
      this.placeProjectile(e.p, e.img);
    }
    this.dropProjectiles((p) => p.done);
  }

  private placeProjectile(p: Projectile, img: Phaser.GameObjects.Image): void {
    img.setPosition(p.x, p.y - 36).setDepth(p.y); // muzzle art offset is render-only
    img.setFrame(SkillVfx.loopFrame(p.skill.vfx ?? p.skill.id, p.ageMs));
  }

  private dropProjectiles(pred: (p: Projectile) => boolean): void {
    this.projectiles = this.projectiles.filter((e) => { if (pred(e.p)) { e.img.destroy(); return false; } return true; });
  }

  private playVfx(r: CastRun): void {
    const s = r.skill, id = s.vfx;
    if (!id || s.geometry.kind === 'projectile') return;
    const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[r.dir];
    const o = r.origin;
    let at: Vec | (() => Vec);
    switch (id) {
      case 'dash_slash': at = () => { const c = this.world.casterPos(r.attackerId) ?? o; return { x: c.x, y: c.y - BODY_UP }; }; break;
      case 'rising_slash': at = { x: o.x + f[0] * 46, y: o.y + f[1] * 46 - BODY_UP }; break;
      case 'arcane_wave': at = { x: o.x + f[0] * ((s.geometry.length ?? s.range) / 2), y: o.y + f[1] * ((s.geometry.length ?? s.range) / 2) - 24 }; break;
      case 'binding_rune': at = r.place ?? o; break;
      default: // V1 ground_breaker / astral_burst and extension circles: caster's feet; other extension shapes by geometry
        if (s.geometry.kind === 'sweptCapsule') at = () => { const c = this.world.casterPos(r.attackerId) ?? o; return { x: c.x, y: c.y - BODY_UP }; };
        else if (s.geometry.kind === 'sector' || s.geometry.kind === 'forwardRectangle') {
          const d = (s.geometry.length ?? s.range) / 2;
          at = { x: o.x + f[0] * d, y: o.y + f[1] * d - BODY_UP };
        } else if (s.geometry.kind === 'groundCircle') at = r.place ?? o;
        else at = o;
    }
    this.vfx.playCast(id, at, r.dir, s.castMs, r.elapsed);
  }

  private emit(name: string, r: CastRun): void {
    this.events.emit(name, { castId: r.castId, skillId: r.skill.id, attackerId: r.attackerId, t: this.world.now() } as SkillEventBase);
  }
}
