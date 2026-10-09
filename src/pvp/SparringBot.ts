// PvP sparring partner (NPC): a warrior that fights like a player whenever you are alone in an arena room.
// Local only (never sent over the network). Its body follows the PvP combat rules (CombatBody with pvp = true, combo
// protection gauges, launches, knockdowns, getups) and its HP never runs out: a hit that would bring it to zero refills
// it. Its moves are real warrior casts started on the scene's SkillRuntime as a non-own attacker, so they hit the local
// player through the normal PvP victim path (reactions, damage, death and respawn of the player).
import Phaser from 'phaser';
import { PVP } from '../config/layout';
import { ARENA, CombatBody, HitOutcome, Kin, PHYS, newKin, steer, stepKin } from '../combat/Combat';
const ARENA_TECH_MS = ARENA.techMinMs;
import { FinalSkill, HitEvent } from '../skills/SkillTypes';
import { arenaTimeScale, finalSkill, kitFor } from '../skills/FinalKit';
import { HitTarget, V2, V3, unit } from '../skills/HitGeometry';
import { Mode } from '../game/PoseState';
import { sideAim } from '../game/Body';
import { Dir } from '../world/collision';
import { footAllowed } from '../world/WorldGeometry';
import { RemotePlayer } from './RemotePlayer';

export const BOT_ID = 'npc-sparring';
export const BOT_NAME = 'Sparring Knight';
/** Sparring partner name per class. */
export const BOT_NAMES: Record<string, string> = { warrior: 'Sparring Knight', book_mage: 'Sparring Mage', archer: 'Sparring Archer', samurai: 'Sparring Samurai', gambler: 'Sparring Gambler' };
/** Scripted demo combos (COMBO button): the bot performs them on the player, chaining each move on its active end. */
const COMBOS: Record<string, string[]> = {
  warrior: ['dash_slash', 'warrior_basic:0', 'warrior_basic:1', 'rising_slash', 'whirlwind', 'leap_crash', 'ground_breaker'],
  samurai: ['shadow_step', 'quick_slash:0', 'quick_slash:1', 'spin_cut', 'quick_slash:2', 'iai_strike'],
  book_mage: ['frost_nova', 'glacial_spikes', 'astral_burst', 'arcane_wave', 'lightning_chain', 'arcane_bolt'],
  archer: ['vine_trap', 'multi_shot', 'explosive_arrow', 'piercing_arrow', 'quick_shot'],
  gambler: ['charged_deal', 'cut_the_deck:0', 'cut_the_deck:1', 'staff_vault', 'rotor_staff', 'fuse_slam'],
};
const RANGED = new Set(['book_mage', 'archer']);
/** How far a skill reaches from the caster (px), from its first damaging hit shape. */
function reachOf(s: FinalSkill): number {
  const h = (s.chain ? s.chain.stages[0] : s.hits).find((x) => x.damage > 0) ?? s.hits[0];
  const sh = h?.shape; if (!sh) return 80;
  const extra = s.dash?.distance ?? 0;
  switch (sh.kind) {
    case 'sector': return sh.range + extra;
    case 'line': return sh.length + extra;
    case 'projectile': return sh.range;
    case 'chain': return 300;
    case 'capsule': return extra + sh.radius;
    case 'circle': return sh.at === 'place' ? (s.placeRange ?? 260) : (sh.radius + (sh.bias ?? 0) + extra);
    case 'placed': return s.placeRange ?? 260;
  }
}

export interface BotApi {
  /** Start a real cast of `skill` for the bot (non-own run on the shared runtime). */
  cast(skill: FinalSkill, stage: number, origin: V3, aim: V2, place: V2 | null, lock: string | null): void;
  /** Cancel the bot's pending runs (it was interrupted by a hit). */
  cancel(): void;
}

export interface BotWorld {
  now: number;
  /** guard: the player is guarded right now (the arena's wake-up / BREAK): the knight waits it out instead of swinging.
   *  stuck: the player is caught (hit-stun / launched / down / hard CC): the moment to go on with a combo. */
  player: { x: number; y: number; z: number; alive: boolean; guard?: boolean; stuck?: boolean };
}

/** Sparring difficulty. */
export type BotLevel = 'easy' | 'middle' | 'hard';
/** How each difficulty plays:
 *  think: reaction time (ms) between decisions · answer: how fast it acts again once free · after: pause after a move
 *  chain: chance to go on with its basic chain · skill: chance to use a ready skill over the basic attack
 *  follow: chance to cancel a landed skill into the next one (a real combo) · cd: its cooldowns (× the skill's)
 *  backOff: chance to step back and give you room after its string · ult: it closes combos with its ultimate
 *  opening: its big moves held back at the start · rush: it closes in at a run */
const LEVEL: Record<BotLevel, { think: [number, number]; answer: [number, number]; after: [number, number]; chain: number; skill: number; follow: number; cd: number; backOff: number; ult: boolean; opening: boolean; rush: boolean }> = {
  easy: { think: [480, 760], answer: [420, 800], after: [1000, 1700], chain: 0.4, skill: 0.22, follow: 0, cd: 2.5, backOff: 0.85, ult: false, opening: true, rush: false },
  middle: { think: [240, 420], answer: [120, 420], after: [600, 1100], chain: 0.6, skill: 0.45, follow: 0.4, cd: 2, backOff: 0.5, ult: false, opening: true, rush: false },
  hard: { think: [50, 110], answer: [20, 80], after: [60, 180], chain: 1, skill: 0.9, follow: 1, cd: 1.5, backOff: 0, ult: true, opening: false, rush: true },
};

const R = PHYS.footR;
/** The bot uses its skills less often than a player could (cooldown × this). */
const CD_MUL = 2;
/** First use of the big moves only after a while (a sparring partner, not an ambush). */
const OPENING_CD: Record<string, number> = { titans_verdict: 30000, blade_storm: 18000, whirlwind: 6000, ground_breaker: 5000, leap_crash: 2500 };
/** Its own look (cape + aura) so it never reads as the player. */
const BOT_LOOK = 'back:war_cape_shadow_smoke,aura:war_aura_shadow_flame,gear:w1t2p2s1'; // + the starter gear (red shirt, black pants and boots)
/** A Master in his trial: his job's sword (the rest of his job set comes as it is drawn). */
const TRIAL_LOOK = 'gear:w2t0p0s0h1a1b1';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Open middle of the arena's stage (fallback direction when wedged against a prop): set by the scene for its stage. */
const ARENA_CENTRE = { x: 835, y: 640 };
export function setBotCentre(x: number, y: number): void { ARENA_CENTRE.x = x; ARENA_CENTRE.y = y; }
/** A Master's trial (the open world): his own name, a boss's HP, he can be beaten, and the floor's middle to fall back to. */
export interface BotTrial { name: string; hp: number; centre: { x: number; y: number } }

interface BotCast { s: FinalSkill; stage: number; t: number; T: { startup: number; active: number; recovery: number }; origin: V3; aim: V2; dist: number; followRolled?: boolean }

export class SparringBot {
  readonly kin: Kin;
  readonly body: CombatBody;
  readonly view: RemotePlayer;
  hp: number = PVP.maxHp;
  /** Set by the last receive() when the HP bar was refilled (the scene shows the heal). */
  refilled = 0;
  private dir: Dir = 'left';
  private aim: V2 = { x: -1, y: 0 };
  private cast: BotCast | null = null;
  private cdEnd = new Map<string, number>();
  private nextAct = 0;
  private thinkT = 0;
  private chainStage = -1;
  private chainEnd = -Infinity;
  private strafe = 0;
  private strafeT = 0;
  private wasFree = true;
  private avoidSide = 1;
  private avoidT = 0;
  private lastNow = 0;

  /** STOP: it stands still and never attacks (it still reacts to hits). */
  paused = false;
  /** Difficulty (EASY / MIDDLE / HARD). */
  level: BotLevel = 'middle';
  private get L() { return LEVEL[this.level]; }
  /** Skills it has chained in its current combo on you (hit-confirm follow-ups). */
  private comboN = 0;
  /** COMBO: the scripted chain in progress (ids with ':stage'). */
  private combo: string[] = [];
  private readonly kit: FinalSkill[];

  /** A trial Master's HP reached zero (beaten) / knocked out in a battle round. */
  defeated = false;
  /** Battle mode: its HP runs out (a K.O.) instead of refilling. */
  duel = false;
  /** Battle mode, between the fights (VS, ROUND n, K.O., the result): it stands and waits. */
  hold = false;
  /** Battle mode: after a string of its own it steps back to give you room (until this time). */
  private backOffUntil = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, private api: BotApi, now: number, readonly cls = 'warrior', readonly trial: BotTrial | null = null) {
    this.kin = newKin(x, y);
    this.body = new CombatBody(this.kin, true);
    this.body.maxHp = trial?.hp ?? PVP.maxHp; this.hp = this.body.maxHp;
    this.kit = kitFor(cls);
    this.view = new RemotePlayer(scene, { playerId: BOT_ID, characterId: BOT_ID, classId: cls, name: trial ? trial.name : `${BOT_NAMES[cls] ?? BOT_NAME} · NPC`, hero: !trial && !!(scene as unknown as { character?: { hero?: boolean } }).character?.hero }, x, y);
    if (trial) { this.view.maxHp = trial.hp; this.view.setHp(trial.hp); }
    this.view.interpDelay = 0; // simulated locally: show the body exactly where it is
    this.nextAct = now + 1400; // a breath before the first attack
    for (const [id, ms] of Object.entries(OPENING_CD)) this.cdEnd.set(id, now + ms);
    this.lastNow = now;
    this.pushState();
  }

  /** Set the difficulty (its opening hold-back follows it). */
  setLevel(lv: BotLevel, now: number): void {
    this.level = lv;
    for (const id of Object.keys(OPENING_CD)) this.cdEnd.delete(id);
    if (this.L.opening) for (const [id, ms] of Object.entries(OPENING_CD)) this.cdEnd.set(id, now + ms);
  }

  get x(): number { return this.kin.x; }
  get y(): number { return this.kin.y; }
  get z(): number { return this.kin.z; }

  target(now: number): HitTarget {
    return { id: BOT_ID, kind: 'player', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: R + 4, height: 74, alive: !this.defeated, invulnerable: now < this.body.invulnUntil || this.body.ghost(now) };
  }

  /** A confirmed hit from the local player (this client is the authority for the bot). HP never reaches zero. */
  receive(attacker: string, skill: FinalSkill, hit: HitEvent, from: { x: number; y: number }, now: number, cast?: string): HitOutcome {
    const out = this.body.receive(attacker, skill, hit, from, now, cast);
    this.refilled = 0;
    const msg = { t: 'hp' as const, from: BOT_ID, hp: 0, by: attacker, rx: out.reaction };
    if (out.damage > 0 && !(this.body.arena && PVP.hpLocked)) { // (testing: the arena's HP stays)
      this.hp -= out.damage;
      if (this.hp <= 0 && (this.trial || this.duel)) { this.hp = 0; this.defeated = true; } // a Master's trial: beaten / a battle round: K.O.
      else if (this.hp <= 0) { // never dies: the bar refills (the hit itself still lands and flashes)
        this.view.setHp(1, { ...msg, hp: 1 });
        this.refilled = PVP.maxHp;
        this.hp = PVP.maxHp;
      }
    }
    if (out.reaction !== 'armor' && this.cast && this.body.state !== 'free') this.interrupt();
    this.view.setHp(this.hp, { ...msg, hp: this.hp });
    return out;
  }

  update(ms: number, w: BotWorld): void {
    const now = w.now, k = this.kin, b = this.body;
    this.lastNow = now;
    const free = b.canAct(now);
    if (!free && this.cast) this.interrupt();
    if (free && !this.wasFree) this.nextAct = Math.min(this.nextAct, now + rnd(...this.L.answer)); // recovered: answer quickly
    this.wasFree = free;
    if (!w.player.stuck) this.comboN = 0;

    if (this.cast) {
      this.stepCast(ms, w);
      if (this.combo.length && this.cast && this.cast.t >= this.cast.T.startup + this.cast.T.active + 30 && w.player.alive) this.nextCombo(w, true);
      else if (this.cast && !this.combo.length && !this.paused && !this.hold) this.followUp(w);
    }
    else if (free && this.combo.length && !this.hold) this.approachCombo(ms, w);
    else if (free && !this.paused && !this.hold) this.thinkAndMove(ms, w);
    else if (free) { k.vx *= 0.8; k.vy *= 0.8; const dx = w.player.x - k.x; if (Math.abs(dx) > 4 && !this.defeated) this.dir = dx > 0 ? 'right' : 'left'; }
    else if (b.state === 'hitstun' && k.grounded && !b.push) { k.vx *= 0.8; k.vy *= 0.8; }

    if ((this.duel || this.level === 'hard') && b.state === 'knockdown' && b.kdPhase === 'down' && now - b.downAt > (this.level === 'hard' ? ARENA_TECH_MS : 260)) b.quickGetup(now); // a duel: it gets up quickly, like a player would
    const r = stepKin(k, ms, b.gravityScale(now));
    b.update(now, ms, r.landed, r.impactVz);
    this.pushState();
    this.view.update(ms);
  }

  destroy(): void { this.view.destroy(); }

  /** Battle mode, a new round: whole again at (x, y) facing `dir`, nothing in hand, its big moves held back again. */
  resetAt(x: number, y: number, now: number, dir: Dir): void {
    const k = this.kin;
    k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true; k.supportZ = 0;
    this.body.reset();
    this.hp = this.body.maxHp; this.defeated = false; this.refilled = 0;
    this.cast = null; this.combo = []; this.chainStage = -1; this.chainEnd = -Infinity; this.wasFree = true;
    this.cdEnd.clear();
    if (this.L.opening) for (const [id, ms] of Object.entries(OPENING_CD)) this.cdEnd.set(id, now + ms);
    this.nextAct = now + 700; this.thinkT = 0;
    this.dir = dir; this.aim = { x: dir === 'right' ? 1 : -1, y: 0 };
    this.view.revive(x, y, this.hp);
    this.pushState();
  }

  /** Extra damage outside a hit (the player's Final Attack): a battle round / a trial can end on it; the training knight
   *  never falls to it. */
  extra(n: number): void {
    if (this.defeated || n <= 0 || (this.body.arena && PVP.hpLocked)) return;
    this.hp -= n;
    if (this.hp <= 0 && (this.trial || this.duel)) { this.hp = 0; this.defeated = true; }
    else this.hp = Math.max(1, this.hp);
    this.view.setHp(this.hp);
  }

  /** BREAK (the arena): out of your combo — hops back away from you, untouchable a moment. */
  breakOut(now: number, from: { x: number; y: number }): void {
    this.body.doBreak(now);
    this.interrupt();
    const k = this.kin, d = unit(k.x - from.x, k.y - from.y, this.dir === 'left' ? 1 : -1, 0);
    this.body.push = { vx: (d.x * 110) / 180, vy: (d.y * 44) / 180, left: 180 };
    if (!k.grounded) k.vz = Math.min(k.vz, -140);
    this.nextAct = now + rnd(350, 650);
  }

  /** Knocked out: down for the count (its view plays the fall), nothing more until the next round. */
  knockOut(): void {
    this.interrupt();
    this.hold = true;
    this.view.die();
  }

  // ------------------------------------------------------------------ brain

  private thinkAndMove(ms: number, w: BotWorld): void {
    const k = this.kin, p = w.player, now = w.now;
    const dx = p.x - k.x, dy = p.y - k.y, dist = Math.hypot(dx, dy), ady = Math.abs(dy);
    if (Math.abs(dx) > 4) this.dir = dx > 0 ? 'right' : 'left';
    this.aim = unit(dx, dy, this.dir === 'right' ? 1 : -1, 0);

    this.thinkT -= ms;
    const room = this.duel && (now < this.backOffUntil || !!p.guard); // a duel: it gives you room after its string, and never swings into your guarded wake-up
    if (p.alive && !room && now >= this.nextAct && this.thinkT <= 0) {
      this.thinkT = this.level === 'middle' && !this.duel ? rnd(110, 210) : rnd(...this.L.think); // reaction time
      if (this.decide(w, dx, dy, dist, ady)) return;
    }
    this.move(ms, w, dx, dy, dist, room);
  }

  /** Pick a move; true when a cast started. */
  private decide(w: BotWorld, dx: number, dy: number, dist: number, ady: number): boolean {
    if (this.cls !== 'warrior' || this.level === 'hard') return this.decideGeneric(w, dist, ady);
    const now = w.now, p = w.player;
    const ready = (id: string) => (this.cdEnd.get(id) ?? 0) <= now;
    // keep the basic chain going while it lands in range
    if (this.chainStage >= 0 && this.chainStage < 3 && now - this.chainEnd < 520 && dist < 115 && ady < 46) {
      if (Math.random() < this.L.chain) return this.start('warrior_basic', this.chainStage + 1, w);
      this.chainStage = -1;
      this.nextAct = now + rnd(500, 900);
      return false;
    }
    this.chainStage = -1;
    // juggle / anti-air: the player is in the air close by (only sometimes — it leaves openings)
    if (p.z > 24 && dist < 125 && ady < 50) {
      if (ready('rising_slash') && Math.random() < 0.35) return this.start('rising_slash', 0, w);
      if (ready('whirlwind') && Math.random() < 0.25) return this.start('whirlwind', 0, w);
    }
    if (dist < 108 && ady < 44) {
      const r = Math.random();
      if (r < 0.05 && ready('titans_verdict')) return this.start('titans_verdict', 0, w);
      if (r < 0.12 && ready('blade_storm')) return this.start('blade_storm', 0, w);
      if (r < 0.24 && ready('ground_breaker')) return this.start('ground_breaker', 0, w);
      if (r < 0.38 && ready('rising_slash')) return this.start('rising_slash', 0, w);
      if (r < 0.46 && ready('whirlwind')) return this.start('whirlwind', 0, w);
      if (r < 0.9) return this.start('warrior_basic', 0, w);
      this.nextAct = now + rnd(250, 500); // hold back a moment
      return false;
    }
    if (dist > 140 && dist < 235 && ady < 30 && ready('dash_slash') && Math.random() < 0.45) return this.start('dash_slash', 0, w);
    if (dist > 150 && dist < 235 && ready('leap_crash') && Math.random() < 0.22) return this.start('leap_crash', 0, w);
    if (dist > 200 && dist < 470 && ady < 40 && ready('wave_slash') && Math.random() < 0.3) return this.start('wave_slash', 0, w);
    return false;
  }

  /** Any class: keep its basic chain going, otherwise pick a ready skill whose reach covers the player. */
  private decideGeneric(w: BotWorld, dist: number, ady: number): boolean {
    const now = w.now, basic = this.kit[0];
    const ready = (s: FinalSkill) => (this.cdEnd.get(s.id) ?? 0) <= now;
    const n = basic?.chain?.stages.length ?? 1;
    if (basic?.chain && this.chainStage >= 0 && this.chainStage < n - 1 && now - this.chainEnd < 520 && dist < reachOf(basic) && ady < 46) {
      if (Math.random() < this.L.chain) return this.start(basic.id, this.chainStage + 1, w);
    }
    this.chainStage = -1;
    const options = this.kit.filter((s) => !s.wip && s.slot > 0 && (s.slot !== 7 || (this.L.ult && !!w.player.stuck)) && ready(s) && s.hits.some((h) => h.damage > 0) && reachOf(s) >= dist && (ady < 50 || s.targeting === 'mouseGround'));
    if (options.length && Math.random() < this.L.skill) return this.start(this.pick(options, w).id, 0, w);
    if (basic && dist <= reachOf(basic) && ady < 46) return this.start(basic.id, 0, w);
    return false;
  }

  /** Close in to sword range on the player's lane, with a little lateral drift; steers around props (whiskers). */
  private move(ms: number, w: BotWorld, dx: number, dy: number, dist: number, room = false): void {
    const k = this.kin, p = w.player;
    this.strafeT -= ms;
    if (this.strafeT <= 0) { this.strafeT = rnd(700, 1600); this.strafe = Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : 0; }
    this.avoidT -= ms;
    if (k.grounded && !footAllowed(k.x, k.y, k.z, R)) { // knocked into a prop's edge: ease back out toward the open courtyard
      const cc = this.trial?.centre ?? ARENA_CENTRE, c = unit(cc.x - k.x, cc.y - k.y);
      k.x += c.x * 2; k.y += c.y * 2;
    }
    let tx = 0, ty = 0;
    if (p.alive) {
      const want = room ? 210 : RANGED.has(this.cls) ? 230 : 78, side = dx >= 0 ? -1 : 1; // stand on our side of the player (casters keep their distance; giving room: further off)
      const gx = p.x + side * want - k.x, gy = p.y + this.strafe * 26 - k.y;
      const gd = Math.hypot(gx, gy);
      if (gd > 10) {
        let d = unit(gx, gy);
        const probe = 30, free = (v: V2) => footAllowed(k.x + v.x * probe, k.y + v.y * probe, k.z, R);
        if (!free(d)) {
          if (this.avoidT <= 0) this.avoidSide = Math.random() < 0.5 ? 1 : -1;
          search: for (const deg of [35, 70, 105, 140]) {
            for (const sg of [this.avoidSide, -this.avoidSide]) {
              const a = (sg * deg * Math.PI) / 180, v = { x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) };
              if (free(v)) { d = v; this.avoidSide = sg; this.avoidT = 900; break search; }
            }
          }
        }
        const sp = dist > 320 || (this.L.rush && dist > 110) ? PHYS.run : PHYS.stroll * (dist < 140 ? 0.75 : 1);
        tx = d.x * sp; ty = d.y * sp;
      }
    }
    steer(k, tx * this.body.moveScale(w.now), ty * this.body.moveScale(w.now), ms);
  }

  // ------------------------------------------------------------------ casting

  private start(id: string, stage: number, w: BotWorld): boolean {
    const s = finalSkill(id);
    if (!s || !this.kin.grounded && !s.air) return false;
    const k = this.kin, p = w.player;
    const u = unit(p.x - k.x, p.y - k.y, this.dir === 'right' ? 1 : -1, 0), aim = sideAim(u.x, u.y, this.dir === 'left' ? -1 : 1); // (side / corner)
    this.aim = aim; this.dir = aim.x >= 0 ? 'right' : 'left';
    const T0 = s.chain?.timings?.[stage] ?? { startup: s.startup, active: s.active, recovery: s.recovery }, ts = this.body.arena ? arenaTimeScale(s) : null;
    const T = ts ? { startup: Math.round(T0.startup * ts.startup), active: Math.round(T0.active * ts.active), recovery: Math.round(T0.recovery * ts.recovery) } : T0; // (the arena's warrior: his base pace, as the runtime plays it)
    let dist = s.dash?.distance ?? 0;
    if (s.dash && s.targeting === 'mouseTarget') dist = Math.min(dist, Math.max(0, Math.hypot(p.x - k.x, p.y - k.y) - 34));
    this.cast = { s, stage, t: 0, T, origin: { x: k.x, y: k.y, z: k.z }, aim, dist };
    if (s.cooldown > 0) this.cdEnd.set(s.id, w.now + s.cooldown * (this.level === 'middle' ? CD_MUL : this.L.cd));
    if (s.chain) this.chainStage = stage;
    k.vx *= 0.3; k.vy *= 0.3;
    const place = s.targeting === 'mouseGround' ? { x: p.x, y: p.y } : null, lock = s.targeting === 'mouseTarget' ? 'self' : null;
    this.api.cast(s, stage, this.cast.origin, aim, place, lock);
    return true;
  }

  private stepCast(ms: number, w: BotWorld): void {
    const c = this.cast!, k = this.kin, s = c.s, T = c.T;
    c.t += ms;
    const activeStart = T.startup, activeEnd = T.startup + T.active;
    if (s.dash && c.t >= activeStart && c.t <= activeEnd + ms) {
      const p = Math.min(1, (c.t - activeStart) / Math.max(1, T.active)), ease = 1 - (1 - p) * (1 - p);
      const want = { x: c.origin.x + c.aim.x * c.dist * ease, y: c.origin.y + c.aim.y * c.dist * ease };
      const steps = Math.ceil(Math.hypot(want.x - k.x, want.y - k.y) / 2);
      for (let i = 0; i < steps; i++) {
        const nx = k.x + (want.x - k.x) / (steps - i), ny = k.y + (want.y - k.y) / (steps - i);
        if (!footAllowed(nx, ny, k.z, R)) break;
        k.x = nx; k.y = ny;
      }
      k.vx = 0; k.vy = 0;
      if (s.dash.lift) {
        k.grounded = false;
        k.z = c.origin.z + s.dash.lift * (s.dash.hang ? (p < 0.1 ? Math.sin((Math.PI / 2) * (p / 0.1)) : p > 0.86 ? Math.cos((Math.PI / 2) * ((p - 0.86) / 0.14)) : 1) : Math.sin(Math.PI * Math.min(1, p * 1.06)));
        k.vz = p < 0.5 ? 40 : -40;
      }
    } else if (s.id === 'whirlwind' && c.t >= activeStart && c.t < activeEnd) {
      const p = w.player, d = unit(p.x - k.x, p.y - k.y);
      steer(k, d.x * PHYS.stroll * 0.8, d.y * PHYS.stroll * 0.8, ms);
    } else if (k.grounded) { k.vx *= 0.7; k.vy *= 0.7; }
    if (c.t >= activeEnd + T.recovery) {
      this.cast = null;
      if (s.chain) { this.chainEnd = w.now; this.nextAct = w.now + (c.stage >= 3 ? rnd(...this.L.after) : rnd(40, 120)); }
      else this.nextAct = w.now + rnd(...this.L.after);
      if (this.duel && (!s.chain || c.stage >= 3) && Math.random() < this.L.backOff) this.backOffUntil = w.now + rnd(600, 1200); // a duel: room for you after its string
    }
  }

  /** A real combo (MIDDLE sometimes, HARD always): its skill landed and you are caught — cancel into the next skill its
   *  cancel list allows, the one that fits where you are (in the air: what holds or re-launches you; on your feet: a
   *  launcher), and on HARD close it with the ultimate. */
  private followUp(w: BotWorld): void {
    const c = this.cast!, p = w.player, s = c.s;
    if (!p.alive || !p.stuck || this.L.follow <= 0) return;
    const hitsAt = (s.chain ? s.chain.stages[c.stage] : s.hits).filter((h) => h.damage > 0).map((h) => h.at);
    const last = c.T.startup + (hitsAt.length ? Math.max(...hitsAt) * (c.T.active / Math.max(1, s.chain?.timings?.[c.stage]?.active ?? s.active)) : c.T.active);
    if (c.t < last + 40 || c.t < c.T.startup + 60) return;
    if (c.followRolled) return;
    c.followRolled = true;
    if (Math.random() >= this.L.follow) return;
    const now = w.now, k = this.kin, dist = Math.hypot(p.x - k.x, p.y - k.y);
    const ready = (x: FinalSkill) => (this.cdEnd.get(x.id) ?? 0) <= now;
    const list = s.cancelOnHit.length ? s.cancelOnHit : this.kit.map((x) => x.id);
    const opts = list.map((id) => this.kit.find((x) => x.id === id)).filter((x): x is FinalSkill => !!x && x.id !== s.id && !x.wip && ready(x)
      && (k.grounded ? x.ground : x.air) && x.hits.some((h) => h.damage > 0) && reachOf(x) >= dist - 10 && (x.slot !== 7 || (this.L.ult && this.comboN >= 3)));
    const basic = this.kit[0];
    // the basic chain goes on when nothing else fits (it holds you there)
    if (!opts.length) {
      if (s.id === basic?.id && basic.chain && c.stage < basic.chain.stages.length - 1 && dist < reachOf(basic)) { this.api.cancel(); this.cast = null; this.start(basic.id, c.stage + 1, w); this.comboN++; }
      return;
    }
    const next = this.pick(opts, w);
    this.api.cancel(); this.cast = null;
    if (this.start(next.id, 0, w)) this.comboN++;
  }

  /** The best skill for the moment (HARD: by where you are; otherwise at random). */
  private pick(opts: FinalSkill[], w: BotWorld): FinalSkill {
    if (this.level !== 'hard') return opts[Math.floor(Math.random() * opts.length)];
    const p = w.player, air = p.z > 24;
    const score = (x: FinalSkill): number => {
      const r = new Set(x.roles), up = Math.max(...x.hits.map((h) => h.reachUp ?? 80));
      let v = Math.random() * 0.5;
      if (air) { if (up < p.z) return -1; if (r.has('airExtender') || r.has('extender')) v += 3; if (r.has('launcher')) v += 2; if (r.has('finisher') || r.has('signature')) v += this.comboN >= 4 ? 4 : 1; }
      else if (p.stuck) { if (r.has('launcher')) v += 4; if (r.has('extender') || r.has('confirm')) v += 2; }
      else { if (r.has('gapClose') || r.has('opener') || r.has('chase')) v += 3; if (r.has('launcher')) v += 2; }
      if (x.slot === 7) v += this.comboN >= 5 ? 6 : -2;
      return v;
    };
    let best = opts[0], bv = -Infinity;
    for (const x of opts) { const v = score(x); if (v > bv) { bv = v; best = x; } }
    return best;
  }

  /** COMBO button: run its class's scripted combo on the player (cooldowns ignored). */
  startCombo(): boolean {
    const list = COMBOS[this.cls]; if (!list) return false;
    this.combo = [...list];
    return true;
  }
  get comboRunning(): boolean { return this.combo.length > 0; }

  /** Walk into the first move's reach, then open the combo. */
  private approachCombo(ms: number, w: BotWorld): void {
    const k = this.kin, p = w.player, dx = p.x - k.x, dy = p.y - k.y, dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 4) this.dir = dx > 0 ? 'right' : 'left';
    const [id] = this.combo[0].split(':'), s = finalSkill(id);
    if (!s || !p.alive) { this.combo = []; return; }
    const reach = Math.min(reachOf(s) * 0.85, s.dash ? 220 : RANGED.has(this.cls) ? 260 : 90);
    if (dist <= reach && Math.abs(dy) < 40) { this.nextCombo(w, false); return; }
    const want = unit(dx, dy), sp = PHYS.run;
    steer(k, want.x * sp, want.y * sp, ms);
  }

  private nextCombo(w: BotWorld, chained: boolean): void {
    const step = this.combo.shift(); if (!step) return;
    const [id, st] = step.split(':'), s = finalSkill(id);
    if (!s) return;
    if (chained && this.cast) { this.api.cancel(); this.cast = null; } // cancel the recovery into the next move (like a player)
    this.cdEnd.delete(id);
    if (!this.start(id, Number(st ?? 0), w)) this.combo = [];
    if (!this.combo.length) this.nextAct = w.now + 1500; // breathe after the demo
  }

  private interrupt(): void {
    this.combo = [];
    if (!this.cast) return;
    this.cast = null;
    this.chainStage = -1;
    this.api.cancel();
  }

  // ------------------------------------------------------------------ presentation

  private mode(): Mode {
    const b = this.body, k = this.kin;
    if (this.defeated) return 'dead';
    if (b.state === 'hitstun') return 'hurt';
    if (b.state === 'launched') return 'launched';
    if (b.state === 'knockdown') return k.grounded ? 'down' : 'launched';
    if (b.state === 'getup') return 'getup';
    if (this.cast) return 'skill';
    if (!k.grounded) return 'air';
    const sp = Math.hypot(k.vx, k.vy);
    return sp > PHYS.walk + 20 ? 'run' : sp > 12 ? 'walk' : 'idle';
  }

  /** Feed the shared remote-player view exactly like a network snapshot would. */
  private pushState(): void {
    const k = this.kin, m = this.mode();
    this.view.applyState({
      t: 'state', from: BOT_ID, x: k.x, y: k.y, z: k.z, sz: k.supportZ, dir: this.dir, anim: m, mode: m,
      sp: Math.hypot(k.vx, k.vy), vz: k.vz, ax: Math.round(this.aim.x * 100), ay: Math.round(this.aim.y * 100), hp: this.hp, alive: !this.defeated, ...(this.body.ghost(this.lastNow) ? { iv: 1 } : {}), cos: this.cls === 'warrior' ? (this.trial ? TRIAL_LOOK : BOT_LOOK) : '',
    });
  }
}
