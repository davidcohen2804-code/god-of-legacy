// One skill runtime for every caster and every target (PvE + PvP): cast runs with startup → active → recovery,
// timed multi-hit events, projectiles (cover-aware, elevation-aware), traps, counter windows, cooldowns of the local
// caster and per-cast/per-hit/per-target de-duplication. Damage/reactions are applied by the scene (authority rules).
import Phaser from 'phaser';
import { FinalSkill, HitEvent } from './SkillTypes';
import { HitTarget, Projectile, V2, V3, burstTargets, clampAim, chainTargets, fanDirs, shapeContains, spawnProjectile, stepProjectile } from './HitGeometry';

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
  /** Cancelled into from a confirmed hit (a combo follow-up): the arena's combo pace applies. */
  followUp?: boolean;
  /** Locked-on target for 'mouseTarget' skills (id), if any. */
  lock?: string | null;
  /** Remote caster's buffs at cast time (War Cry / Radiant Blade): damage and reach multipliers. */
  dmgMul?: number;
  reach?: number;
  /** Remote caster's arrow range (Eagle Eyes) and attack speed (Bow Haste / Ranger Mastery) at cast time. */
  range?: number;
  speed?: number;
  /** Book Mage caster flags at cast time: 1 Elemental Ascension, 2 Conductor, 4 Shatter Mastery. */
  mf?: number;
  /** Primed by the caster's stance (Sheathe): no startup, a hold-to-charge skill `chargeUp` levels higher. An own cast is
   *  judged by the runtime; a remote one carries it from its caster's screen (the caster decides). */
  primed?: { chargeUp: number };
  /** The samurai's blossom draw (SamuraiPetals): the petals his Sheathe gathered, carried by his next Iai Strike (his screen
   *  counts them; a remote cast carries the count, `pb`). DFO's numbers: from 6 the line 40% wider, one more cut per 4. */
  petals?: number;
  /** More shots from the cast's first projectile hit, set at the cast by the class's own logic (the Book Mage's folded pages:
   *  Origami Flock's extra cranes); the same on both screens. */
  extraShots?: number;
}

export interface CastRun extends CastRequest {
  elapsed: number;
  phase: Phase;
  fired: Set<number>;
  /** Dash-through: already turned to face the crossed target. */
  turned?: boolean;
  slid?: boolean;
  jbInit?: boolean;
  jbApex?: number;
  /** Judgment Blade: the blade has left the hand (release sent to the other players). */
  jbOut?: boolean;
  /** Judgment Blade: chained by a press of V, flies right away. */
  jbQuick?: boolean;
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
  /** Chain hits: the foe the last arc struck (the next one leaps on from it). */
  chainLast?: string;
  /** The arena: it landed only as a poke from afar (no hit-confirm cancel off it). */
  poked?: boolean;
  /** The arena's reach rules for this cast (charged levels are picked later and get them too). */
  tune?: { reach?: number; antiAir?: boolean; depth?: number };
  /** Hold-to-charge skills: the startup's scale (attack speed) and the level picked when the startup ended (0..). */
  chargeScale?: number;
  chargeLevel?: number;
  /** Primed by Sheathe: the charge levels it adds. */
  chargeUp?: number;
  /** Own hold-to-charge run: the release was sent / taken. */
  chargeDone?: boolean;
  /** A lingering zone's hit (its origin is the zone's centre, not the caster). */
  zone?: boolean;
  /** A hold that follows its foe (`linger.at: 'target'`): how many turns this cast's hold strikes (set at the cast by the
   *  class's own logic — the Gambler's gathered cards; the same on both screens); default the linger's `count`. */
  holdCount?: number;
}

export interface Trap { run: CastRun; hit: HitEvent; x: number; y: number; until: number; radius: number; fuseAt?: number }

export interface RuntimeWorld {
  now(): number;
  targets(run: CastRun): HitTarget[];
  onHit(run: CastRun, hit: HitEvent, hitIndex: number, target: HitTarget, at: V3): void;
  casterPos(attackerId: string): V3 | null;
  /** Another player's dash: where the dash itself has carried them by now (their drawn body trails the real one by the
   *  network delay and the interpolation): the hit tests run along this. */
  dashPos?(run: CastRun): V3 | null;
  onPhase?(run: CastRun, phase: Phase): void;
  /** Reach multiplier for the caster's melee sword shapes (Radiant Blade). */
  reachMul?(req: CastRequest): number;
  /** Own casts: cooldown multiplier (the arena: longer). */
  cooldownMul?(req: CastRequest): number;
  /** Projectile range multiplier (archer Eagle Eyes). */
  rangeMul?(req: CastRequest): number;
  /** Attack speed: startup and recovery are divided by it (archer Bow Haste / Ranger Mastery). */
  speedMul?(req: CastRequest): number;
  /** Phase scales of a cast's timeline (the PvP arena's warrior at its base pace); null = unchanged. */
  timeScale?(req: CastRequest): { startup: number; active: number; recovery: number; at: number; reach?: number; antiAir?: boolean; depth?: number } | null;
  /** Every projectile after its step (Book Mage gates and Levity Field). */
  projectileHook?(p: Projectile, run: CastRun): void;
}

/** The arena: every hit reaches the launched foe (up to `reach` above the caster's feet; floor waves stay on the floor) and
 *  a shot rises to a foe in the air in front of it. */
function arenaReach(hits: HitEvent[], ts: { reach?: number; antiAir?: boolean; depth?: number } | null | undefined): HitEvent[] {
  if (!ts || (!ts.reach && !ts.antiAir && ts.depth === undefined)) return hits;
  return hits.map((h) => h.shape.kind === 'projectile' ? (ts.antiAir ? { ...h, shape: { ...h.shape, antiAir: true } } : h)
    : { ...h, ...(ts.reach && !(h.shape.kind === 'circle' && h.shape.floor) ? { reachUp: Math.max(h.reachUp ?? 80, ts.reach) } : {}), ...(ts.depth !== undefined && h.shape.kind !== 'capsule' ? { depth: Math.max(ts.depth, h.depth ?? 0) } : {}) }); // (a hit wider across the lane keeps its own depth)
}

/** Thunder Rain's charged floor (the Archer's continuity, DFO's numbers): each strike point stays charged 2.5 s; a shot of
 *  hers crossing one (within 90 px, 54 deep, under 120 up) is spent on it and comes out as lightning — +20% damage, and on
 *  its hit a bolt chains to the nearest other foe within 220 px for half of it (the scene). One point, one arrow. */
export const STORM = { ms: 2500, r: 90, depth: 54, z: 120, mul: 1.2, chainR: 220, chainShare: 0.5, chainStun: 240, shots: new Set(['quick_shot', 'multi_shot', 'piercing_arrow', 'backstep_shot']) };

export const RT_EVENTS = {
  cast: 'cast', active: 'active', hit: 'hitFired', projectile: 'projectile', projectileEnd: 'projectileEnd',
  trap: 'trap', trapTrigger: 'trapTrigger', trapArm: 'trapArm', end: 'end', cancelled: 'cancelled', counter: 'counter', chain: 'chain',
  /** (p, run, point): a shot crossed a charged point and turned to lightning — for its look */ storm: 'storm',
} as const;

export class SkillRuntime {
  readonly events = new Phaser.Events.EventEmitter();
  runs: CastRun[] = [];
  projectiles: { p: Projectile; run: CastRun; hit: HitEvent }[] = [];
  traps: Trap[] = [];
  /** Thunder Rain's charged strike points (STORM), by caster. */
  charged: { x: number; y: number; until: number; by: string }[] = [];
  readonly cooldownEnd = new Map<string, number>();
  private charges = new Map<string, { used: number; last: number }>();
  /** Own priming stances (Sheathe) per caster: until when, which skills it primes, how many charge levels. */
  private primedBy = new Map<string, { until: number; ids: string[]; chargeUp: number }>();

  constructor(private world: RuntimeWorld) {}

  /** Would an own cast of `skillId` by `attackerId` start primed now (Sheathe)? Its extra charge levels, else null. */
  primedFor(attackerId: string, skillId: string): number | null {
    const p = this.primedBy.get(attackerId);
    return p && this.world.now() <= p.until && p.ids.includes(skillId) ? p.chargeUp : null;
  }

  /** End a charge sequence early: the skill goes on its full cooldown now. */
  closeCharges(s: { id: string; cooldown: number }): void { if (!this.charges.has(s.id)) return; this.charges.delete(s.id); this.cooldownEnd.set(s.id, Math.max(this.cooldownEnd.get(s.id) ?? 0, this.world.now() + s.cooldown)); }
  get ownRun(): CastRun | undefined { return this.runs.find((r) => r.own && r.phase !== 'done'); }
  locked(): boolean { return !!this.ownRun; }
  cooldownRemaining(id: string): number { return Math.max(0, (this.cooldownEnd.get(id) ?? 0) - this.world.now()); }
  /** Every skill ready again (a new battle round). */
  resetCooldowns(): void { this.cooldownEnd.clear(); this.charges.clear(); }
  /** A skill not ready before `until` (the arena's pre-cooldown at a round's start). */
  holdCooldown(id: string, until: number): void { this.cooldownEnd.set(id, Math.max(this.cooldownEnd.get(id) ?? 0, until)); }
  get projectileCount(): number { return this.projectiles.length; }
  get runCount(): number { return this.runs.length; }

  start(req: CastRequest, startElapsed = 0): CastRun {
    req = { ...req, aim: clampAim(req.aim) }; // no straight up / down attacks, for every caster
    const s = req.skill;
    const timings = { ...(s.chain?.timings?.[req.stage] ?? { startup: s.startup, active: s.active, recovery: s.recovery }) };
    let hits = s.chain ? s.chain.stages[req.stage] : s.hits;
    const ts = this.world.timeScale?.(req);
    if (ts) {
      timings.startup = Math.round(timings.startup * ts.startup); timings.active = Math.round(timings.active * ts.active); timings.recovery = Math.round(timings.recovery * ts.recovery);
      hits = arenaReach(hits.map((h) => ({ ...h, at: Math.round(h.at * ts.at) })), ts);
    }
    const sp = this.world.speedMul?.(req) ?? 1;
    if (sp !== 1) { timings.startup = Math.round(timings.startup / sp); timings.recovery = Math.round(timings.recovery / sp); }
    if (sp >= 2) { timings.active = Math.max(40, Math.round(timings.active / sp)); hits = hits.map((h) => ({ ...h, at: Math.round(h.at / sp) })); } // a big haste (Radiant Blade): the strike itself is faster too
    const rm = this.world.reachMul?.(req) ?? 1;
    if (rm !== 1) hits = hits.map((h) => h.shape.kind === 'sector' ? { ...h, shape: { ...h.shape, range: h.shape.range * rm } }
      : h.shape.kind === 'line' ? { ...h, shape: { ...h.shape, length: h.shape.length * rm } } : h);
    const pm = this.world.rangeMul?.(req) ?? 1;
    if (pm !== 1) hits = hits.map((h) => h.shape.kind === 'projectile' ? { ...h, shape: { ...h.shape, range: h.shape.range * pm } } : h);
    // A priming stance (Sheathe): the caster's next cast, if it is one the stance primes and within its window, leaves at
    // once (no startup; a charged skill levels higher); any other cast spends the stance. (A remote cast says so itself.)
    let primed = req.primed ?? null;
    if (req.own && this.primedBy.has(req.attackerId)) { const up = this.primedFor(req.attackerId, s.id); this.primedBy.delete(req.attackerId); if (up !== null) primed = { chargeUp: up }; }
    const chargeScale = timings.startup / Math.max(1, s.startup);
    if (primed) timings.startup = 0;
    const run: CastRun = {
      ...req, elapsed: req.own || s.charge || s.counter ? startElapsed : Math.min(startElapsed, Math.max(0, timings.startup - 16)), phase: 'startup', fired: new Set(), hitKeys: new Set(), confirmedAt: -1, // (a remote cast starts late by the network delay: its wind-up is caught up, never its strike)
      pathStart: { x: req.origin.x, y: req.origin.y }, counterTriggered: false, extraRecovery: 0, timings, hits,
      ...(s.charge ? { chargeScale } : {}), ...(ts ? { tune: ts } : {}), ...(primed ? { primed, chargeUp: primed.chargeUp } : {}),
    };
    if (req.own && s.primes) this.primedBy.set(req.attackerId, { until: this.world.now() + timings.startup + timings.active + s.primes.windowMs, ids: s.primes.ids, chargeUp: s.primes.chargeUp ?? 0 });
    if (req.own && s.cooldown > 0) {
      // Charged skills: N quick uses in a row (window 7s between uses), then the full cooldown.
      const now = this.world.now(), ch = this.charges.get(s.id), cd = s.cooldown * (this.world.cooldownMul?.(req) ?? 1);
      const used = s.charges && ch && now - ch.last < 7000 ? ch.used + 1 : 1;
      this.charges.set(s.id, { used, last: now });
      if (!s.charges || used >= s.charges) { this.cooldownEnd.set(s.id, now + cd); this.charges.delete(s.id); }
      else this.cooldownEnd.set(s.id, now + (s.chargeGap ?? 350)); // tiny gap between charges
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
    if (reason !== 'cancel') this.primedBy.clear(); // (struck out of it: the stance primes nothing)
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
    run.aim = clampAim(aim, aim.x < 0 ? -1 : 1); run.origin = newOrigin; run.pathStart = { x: newOrigin.x, y: newOrigin.y };
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
    this.cooldownEnd.clear(); this.charges.clear(); this.charged = [];
  }

  // ------------------------------------------------------------------ internals

  /** The samurai's blossom draw (DFO's numbers): the petals his Sheathe gathered ride on his Iai — from 6 its line is 40%
   *  wider; one more cut per 4 petals (at most 4), each a stroke along the same line 70 ms after the one before (6 damage,
   *  a 260 ms hold that keeps a lifted foe up); the active phase stretches to fit them. The same on both screens: the count
   *  rides on the cast. */
  private blossomDraw(r: CastRun): void {
    const n = r.petals ?? 0, wide = n >= 6, last = r.hits[r.hits.length - 1];
    const widen = (h: HitEvent): HitEvent => (!wide ? h : h.shape.kind === 'line' ? { ...h, shape: { ...h.shape, width: Math.round(h.shape.width * 1.4) } }
      : h.shape.kind === 'projectile' ? { ...h, shape: { ...h.shape, radius: Math.round(h.shape.radius * 1.4) } } : h); // (its draws: crescents, 40% wider too)
    r.hits = r.hits.map(widen);
    const extra = Math.min(4, Math.floor(n / 4)), base = widen(last);
    for (let k = 1; k <= extra; k++) {
      r.hits.push({ ...base, at: last.at + 70 * k, damage: 6, heavy: false, reaction: { stun: 260, float: true, juggleCost: 3 } });
    }
    if (extra) r.timings.active = Math.max(r.timings.active, last.at + 70 * extra + 20);
  }

  private advance(r: CastRun, ms: number): void {
    if (r.phase === 'done') return;
    r.elapsed += ms;
    const T = r.timings, activeStart = T.startup, activeEnd = T.startup + T.active;
    if (r.phase === 'startup' && r.elapsed >= activeStart) {
      if (r.skill.charge) { // hold-to-charge: the level the startup reached picks the hits
        const held = T.startup / (r.chargeScale ?? 1), L = r.skill.charge.levels;
        let lv = 0; L.forEach((l, i) => { if (held >= l.at - 1) lv = i; });
        lv = Math.min(L.length - 1, lv + (r.chargeUp ?? 0)); // (primed by Sheathe: levels higher)
        r.chargeLevel = lv; r.hits = arenaReach(L[lv].hits, r.tune);
        // (the level's hits all land inside its active — a hit timed past it never fired: Iai Strike's draws, 70 ms apart;
        //  the recovery gives the time back, so the lock stays what it was — DFO 23 Oct)
        const end = Math.max(0, ...r.hits.map((h) => h.at)) + 20;
        if (end > T.active) { const more = end - T.active; T.active = end; T.recovery = Math.max(120, T.recovery - more); }
      }
      if ((r.petals ?? 0) > 0 && r.hits.length) this.blossomDraw(r); // (the samurai's Iai drawn with the petals in the scabbard)
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
    const origin: V3 = r.skill.dash || r.skill.counter || r.skill.follow ? cur : { x: r.origin.x, y: r.origin.y, z: cur.z };
    this.events.emit(RT_EVENTS.hit, r, i, origin);
    if (r.skill.id === 'rain_of_arrows' && s.kind === 'circle' && s.floor) { // a strike point of Thunder Rain: the floor stays charged
      const bias = s.bias ?? 0, now = this.world.now();
      this.charged = this.charged.filter((c) => c.until > now);
      this.charged.push({ x: r.origin.x + r.aim.x * bias, y: r.origin.y + r.aim.y * bias, until: now + STORM.ms, by: r.attackerId });
    }
    if (s.kind === 'projectile') {
      const aim = this.liveAim(r, origin);
      const rows = s.rows ?? 1, gap = s.rowGap ?? 40;
      let pick = 0;
      const n0 = s.count ?? 1, n = n0 + (i === 0 ? r.extraShots ?? 0 : 0), spread = n > n0 && n0 > 1 && s.spread ? (s.spread * (n0 - 1)) / (n - 1) : s.spread; // (extra shots fill the same fan)
      for (const d of fanDirs(aim, n, spread)) for (let k = 0; k < rows; k++) {
        const off = (k - (rows - 1) / 2) * gap, o2 = rows > 1 ? { x: origin.x - d.y * off, y: origin.y + d.x * off * 0.75, z: origin.z } : origin; // rows side by side across the floor
        const p = spawnProjectile(r.castId, i, r.skill, s, r.attackerId, o2, d, pick++);
        if (s.antiAir) { // a foe up in the air in front of the shot: it rises to his body as it flies
          let best: { along: number; z: number } | null = null;
          for (const t of this.world.targets(r)) {
            if (!t.alive || t.id === r.attackerId || t.z < 24) continue;
            const ox = t.x - p.x, oy = t.y - p.y, along = ox * d.x + oy * d.y, side = Math.abs(-ox * d.y + oy * d.x);
            if (along < 20 || along > s.range || side > t.radius + 46) continue;
            if (!best || along < best.along) best = { along, z: t.z + t.height * 0.45 };
          }
          if (best && best.z > p.z) { p.dropPerPx = -(best.z - p.z) / Math.max(40, best.along * 0.8); p.zTop = best.z + 8; }
        }
        if (r.skill.id === 'piercing_arrow' && d.y < -0.3) { // Spirit Bow aimed up: from where she stands, up into the air and back down onto the floor beside her (never into the depth of the map)
          const loft = Math.abs(d.x) > 0.2 ? 1 : 2, sd = d.x < 0 ? -1 : 1;
          p.loft = loft; p.dx = sd; p.dy = 0; p.x = o2.x + sd * 16; p.y = o2.y;
          p.range = loft === 1 ? 380 : 120; p.speed = loft === 1 ? 560 : 240;
        }
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
      if (s.jump <= 0) { hit = chainTargets(h.depth !== undefined ? { ...s, width: Math.min(s.width, 2 * h.depth) } : s, origin, r.aim, alive, h.reachUp ?? 140)[0] ?? null; r.chainFirst = hit?.id ?? null; } // (the arena: only a foe near its line)
      else {
        const first = alive.find((t) => t.id === (r.chainLast ?? r.chainFirst)) ?? alive.find((t) => t.id === r.chainFirst);
        if (first) { // leaps on from the last foe it struck, to one it has not struck yet if there is one in reach
          const struck = (id: string) => [...r.hitKeys].some((k) => k.endsWith(`|${id}`));
          let bd = Infinity;
          for (const fresh of [true, false]) {
            for (const t of alive) { if (t === first || struck(t.id) !== !fresh) continue; const dd = Math.hypot(t.x - first.x, t.y - first.y); if (dd <= s.jump && dd < bd) { bd = dd; hit = t; } }
            if (hit) break;
          }
          hit = hit ?? first; // single target: the arc strikes it again
          r.chainLast = hit.id;
        }
      }
      this.events.emit(RT_EVENTS.chain, r, i, origin, hit);
      if (hit) this.deliver(r, h, i, hit, { x: hit.x, y: hit.y, z: hit.z + 40 });
      return;
    }
    const from = this.dashFrom(r) ?? origin, path: [V2, V2] = [r.pathStart, { x: from.x, y: from.y }];
    for (const t of targets) {
      if (!t.alive || t.id === r.attackerId) continue;
      if (shapeContains(h, from, r.aim, r.place, path, t)) this.deliver(r, h, i, t, { x: t.x, y: t.y, z: t.z + 40 });
    }
  }

  /** Hit tests of another player's dash follow the dash itself, not the body drawn behind it (null: not such a run). */
  private dashFrom(r: CastRun): V3 | null { return !r.own && r.skill.dash ? this.world.dashPos?.(r) ?? null : null; }

  /** Capsule (dash) hits keep testing the path travelled so far for the rest of the active window. */
  private sweepCapsule(r: CastRun, i: number): void {
    const h = r.hits[i], cur = this.dashFrom(r) ?? this.world.casterPos(r.attackerId) ?? r.origin;
    const path: [V2, V2] = [r.pathStart, { x: cur.x, y: cur.y }];
    for (const t of this.world.targets(r)) {
      if (!t.alive || t.id === r.attackerId) continue;
      if (shapeContains(h, cur, r.aim, r.place, path, t)) this.deliver(r, h, i, t, { x: t.x, y: t.y, z: t.z + 40 });
    }
  }

  /** Aim used when a projectile fires (casters may keep tracking the cursor during startup). */
  private liveAim(r: CastRun, _o: V3): V2 { return r.aim; }

  private deliver(r: CastRun, h: HitEvent, i: number, t: HitTarget, at: V3, pid?: number): void {
    // Multi-arrow fan: one damage event per target per cast; homing shots: each one; other skills: once per hit event per target.
    const key = pid ? `${r.castId}|p${pid}|${t.id}` : h.shape.kind === 'projectile' && (h.shape.count ?? 1) > 1 ? `${r.castId}|fan|${t.id}` : `${r.castId}|${i}|${t.id}`;
    if (r.hitKeys.has(key)) return;
    r.hitKeys.add(key);
    this.world.onHit(r, h, i, t, at);
  }

  private stepProjectiles(ms: number): void {
    for (const e of this.projectiles) {
      const targets = this.world.targets(e.run);
      const pid = e.p.pid, tag = pid ? `|p${pid}|` : null;
      const already = new Set([...e.run.hitKeys].filter((k) => (tag ? k.includes(tag) : k.includes(`|${e.p.hitIndex}|`) || k.includes('|fan|'))).map((k) => k.split('|')[2]));
      const hits = stepProjectile(e.p, ms, targets, already);
      if (!e.p.storm && this.charged.length && STORM.shots.has(e.p.skill.id) && e.p.z < STORM.z) { // over a charged point of her own: lightning
        const now = this.world.now(), k = this.charged.findIndex((c) => c.by === e.p.attackerId && c.until > now && Math.abs(c.x - e.p.x) < STORM.r && Math.abs(c.y - e.p.y) < STORM.depth);
        if (k >= 0) { const c = this.charged.splice(k, 1)[0]; e.p.storm = true; this.events.emit(RT_EVENTS.storm, e.p, e.run, c); }
      }
      const hit = e.p.storm ? { ...e.hit, damage: e.hit.damage * STORM.mul, storm: true } : e.hit;
      for (const t of hits) this.deliver(e.run, hit, e.p.hitIndex, t, { x: e.p.x, y: e.p.y, z: e.p.z }, pid);
      if (!e.p.done) this.world.projectileHook?.(e.p, e.run);
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
      const fuse = t.run.skill.trap?.fuseMs;
      if (fuse && t.fuseAt !== undefined) { // armed: explode on everyone inside when the fuse runs out
        if (now < t.fuseAt) return true;
        const boom = t.run.hits[1] ?? t.hit, R = (boom.shape as { radius?: number }).radius ?? t.radius;
        this.events.emit(RT_EVENTS.trapTrigger, t, true);
        for (const v of this.world.targets(t.run).filter((v) => v.alive && v.id !== t.run.attackerId && Math.hypot(v.x - t.x, v.y - t.y) <= R + v.radius)) this.deliver(t.run, boom, 1, v, { x: v.x, y: v.y, z: v.z + 10 });
        return false;
      }
      if (now >= t.until) {
        if (fuse) { t.fuseAt = now + 600; this.events.emit(RT_EVENTS.trapArm, t); return true; } // a mine goes off on its own in the end (a short warning first)
        this.events.emit(RT_EVENTS.trapTrigger, t, false); return false;
      }
      const victims = this.world.targets(t.run).filter((v) => v.alive && v.id !== t.run.attackerId && v.z < 20 && Math.hypot(v.x - t.x, v.y - t.y) <= t.radius + v.radius);
      if (!victims.length) return true;
      if (fuse) { t.fuseAt = now + fuse; this.events.emit(RT_EVENTS.trapArm, t); for (const v of victims) this.deliver(t.run, t.hit, 0, v, { x: v.x, y: v.y, z: v.z + 10 }); return true; }
      this.events.emit(RT_EVENTS.trapTrigger, t, true);
      for (const v of victims) this.deliver(t.run, t.hit, 0, v, { x: v.x, y: v.y, z: v.z + 10 });
      return false;
    });
  }
}
