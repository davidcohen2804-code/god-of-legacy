// The PvP arena's sound director: the stage's music and ambience, the announcer and the round's stingers (VS, ROUND n,
// FIGHT!, K.O., PERFECT, TIME, the result), every cast and every hit by its class (yours, the other player's, the
// sparring knight's), the fight's calls (BREAK!, PUNISH!, COUNTER!, RAGE!, SLAM!!), jumps, landings and falls, the round
// clock's last seconds, the stage's own events (thunder with the lightning, the dragon's roar).
// The weight of a blow (SkillFx's rule for the hit-stop and the shake): the main hit — a heavy blow, one that sends the
// foe flying or down, the last blow of a burst — lands with a heavy layered boom under the class's own impact; the small
// blows of a burst are soft ticks, so the main one stands out. Every sound with a place is panned to where it is on the
// screen and quieter far from the camera. PVP 3D: the fight sounds in the temple courtyard (its reverb), a deep whoosh
// goes down as the room darkens (a signature, an ultimate, the K.O.); the music ducks under an ultimate (both arenas).
import Phaser from 'phaser';
import type { FinalSkill, HitEvent } from '../skills/SkillTypes';
import type { CastRun } from '../skills/SkillRuntime';
import type { Match, MatchPhase } from '../pvp/Match';
import { Heard, Sound, setPanner, SfxName, VoiceLine } from './Sound';

/** A fighter as the sound sees it: where (world x, y), how high above what it stands on, knocked about (launched / down). */
export interface HeardFighter { id: string; x: number; /** depth on the floor */ y: number; h: number; hurt: boolean }

/** PVP 3D as the sound needs it (Arena3D): where its camera sees a world point (screen px, and px per world px there —
 *  smaller farther away), the fight it frames, and how dark the room wants to be (0 none .. 1). */
export interface RoomView { project(x: number, y: number, z: number): { sx: number; sy: number; k: number }; focus: { x: number; y: number; z: number }; dimWant: number }

/** The room's share (reverb send) of each kind of sound: the fight's blows ring in the courtyard, the small ticks less. */
const WET = { hit: 0.42, tick: 0.25, boom: 0.45, swing: 0.3, body: 0.38, call: 0.32, dark: 0.25 } as const;
/** Off the screen: how much quieter per screen-half beyond the edge (and never below). */
const OFF = { k: 0.45, min: 0.35 };

const BUFFS: Record<string, SfxName> = {
  war_cry: 'war_cry', iron_oath: 'war_cry', legacy_banner: 'war_cry', radiant_blade: 'war_cry', sanctuary: 'war_cry', shield_charge: 'war_shield',
  sheathe: 'sam_sheathe', iai_strike: 'sam_draw', kagemusha: 'sam_draw', rising_sun: 'sam_draw', god_of_blades: 'sam_draw', dragon_ascension: 'sam_draw',
  rain_of_arrows: 'arc_volley', sky_rain: 'arc_volley', arrow_storm: 'arc_volley', piercing_arrow: 'arc_volley', spirit_hawk: 'arc_hawk', eagle_arrow: 'arc_hawk',
  retreat_kick: 'whiff', bow_haste: 'whiff', tree_of_life: 'mag_cast', hunters_roar: 'rage',
  lightning_chain: 'mag_bolt', storm_field: 'mag_bolt', frost_nova: 'mag_ice', glacial_spikes: 'mag_ice', origami_flock: 'mag_page', paper_curse: 'mag_page', page_bind: 'mag_page',
  coin_flip: 'gam_coins', roulette_wheel: 'gam_roulette', dice_bomb: 'gam_dice', triple_down: 'gam_dice', jackpot: 'gam_chips', all_in: 'gam_chips',
};
const CALLS: [RegExp, SfxName, number][] = [
  [/^BREAK/, 'break', 1], [/^PUNISH/, 'punish', 1], [/^COUNTER/, 'punish', 0.85], [/^BACK ATTACK/, 'hit_heavy', 0.5], [/^RAGE/, 'rage', 1], [/^SLAM/, 'slam', 1], [/^GRAB/, 'hit_heavy', 0.6], [/^AMBUSH/, 'sam_draw', 1],
  [/^ARMOR BREAK/, 'block', 1], [/^BLOCK/, 'block', 1], [/^(JOKER|WILD CARD)/, 'gam_coins', 1], [/^BUST/, 'gam_dice', 1], [/^KAGEMUSHA/, 'sam_draw', 0.8],
];

export class ArenaSound {
  private air = new Map<string, { up: boolean; peak: number; hurt: boolean }>();
  private tickAt = -1;
  /** PVP 3D's room (null: the painted arena). */
  private view: RoomView | null = null;
  /** The darkness last heard (a deeper darkening: the whoosh again). */
  private dimHeard = 0;

  constructor(private scene: Phaser.Scene, private stage: string | undefined, private fighters: () => HeardFighter[], private clock: () => number | null) {
    Sound.attach(scene.game);
    setPanner((x, y, z) => this.where(x, y ?? 0, z ?? 0));
    Sound.ambience(stage ?? null);
    Sound.music(scene, stage ?? null, 1400);
  }

  /** PVP 3D: the room's camera places the sounds, the fight rings in the courtyard. */
  use3D(view: RoomView): void { this.view = view; this.dimHeard = 0; Sound.room(true); }

  /** Where a world point is heard: its side of the screen, and quieter the farther it is from the camera — farther back
   *  on the floor (PVP 3D: by the depth the camera sees it at, against the fight it frames) and off the screen. */
  private where(x: number, y: number, z: number): Heard {
    const off = (pan: number) => (Math.abs(pan) <= 1 ? 1 : Math.max(OFF.min, 1 - OFF.k * (Math.abs(pan) - 1)));
    const v = this.view;
    if (v) {
      const P = v.project(x, y, z), F = v.project(v.focus.x, v.focus.y, 0), pan = (P.sx / Math.max(1, this.scene.scale.width)) * 2 - 1;
      const near = P.k / Math.max(1e-6, F.k); // (1 at the fight, <1 farther back, >1 nearer the camera)
      return { pan, gain: Phaser.Math.Clamp(0.45 + 0.55 * near, 0.55, 1.08) * off(pan) };
    }
    const cam = this.scene.cameras.main, hw = Math.max(1, cam.width / cam.zoom / 2), hh = Math.max(1, cam.height / cam.zoom / 2);
    const pan = (x - cam.midPoint.x) / hw, back = Phaser.Math.Clamp((cam.midPoint.y - y) / hh, 0, 1); // (up the screen = farther back on the floor)
    return { pan, gain: (1 - 0.2 * back) * off(pan) };
  }

  /** The round's moments. */
  phase(m: Match, prev: MatchPhase): void {
    switch (m.phase) {
      case 'vs': if ((prev === 'idle' && !Sound.vsHeardOnce()) || prev === 'over') Sound.sfx('vs_slam'); break;
      case 'intro': Sound.sfx('round_swoosh'); this.say(m.finalRound ? 'final_round' : (`round_${Math.min(3, m.round)}` as VoiceLine), 260); break;
      case 'fight': Sound.sfx('fight_hit'); this.say('fight', 0); break;
      case 'ko':
        if (m.why === 'ko' || m.why === 'double') { Sound.sfx('ko_boom'); Sound.duck(2600, 0.25); this.say(m.why === 'double' ? 'double_ko' : 'ko', 220); }
        else this.say(m.why === 'time' ? 'time' : 'draw', 0);
        if (m.perfect) { this.later(1500, () => { this.say('perfect', 0); Sound.sfx('perfect_shine'); }); }
        break;
      case 'over': {
        const won = m.champ !== null && m.champ === this.myId();
        this.say(m.champ === null ? 'draw' : won ? 'you_win' : 'you_lose', 500);
        if (won) this.later(1300, () => { if (!Sound.jingle(this.scene, 'victory')) Sound.sfx('perfect_shine', { vol: 0.8 }); });
        break;
      }
    }
  }

  /** Who "you" are (set by the scene). */
  myId: () => string = () => '';

  /** A cast reaching its strike: the class's swing, shot, spell or throw (or a buff's own flourish). An ultimate's wind-up
   *  ducks the music under it until it is over. */
  cast(run: CastRun, phase: string): void {
    const s = run.skill, T = run.timings;
    if (phase === 'startup' && s.slot === 7) Sound.duck(T.startup + T.active + Math.min(T.recovery, 900) + 300, 0.3);
    if (phase !== 'active') return;
    const heavy = run.hits.some((h) => h.heavy) || s.slot === 7;
    const x = { x: run.origin.x, y: run.origin.y, z: run.origin.z, wet: WET.swing };
    const own = BUFFS[s.id];
    if (own) { Sound.sfx(own, { ...x, vol: own === 'war_cry' || own === 'rage' ? 0.9 : 1 }); return; }
    const proj = run.hits.some((h) => h.shape.kind === 'projectile');
    const rate = s.slot === 0 ? 1.06 : heavy ? 0.9 : 1;
    switch (s.cls) {
      case 'warrior': Sound.sfx(s.slot === 0 ? 'whiff' : 'war_swing', { ...x, rate }); break;
      case 'samurai': Sound.sfx('sam_swish', { ...x, rate }); break;
      case 'archer': Sound.sfx(proj ? 'arc_shot' : 'whiff', { ...x, rate }); break;
      case 'book_mage': Sound.sfx(run.hits.some((h) => h.el === 'storm') ? 'mag_bolt' : run.hits.some((h) => h.el === 'frost') ? 'mag_ice' : 'mag_cast', { ...x, rate, vol: 0.85 }); break;
      case 'gambler': Sound.sfx(proj || run.hits.some((h) => h.stick) ? 'gam_throw' : heavy ? 'whiff_heavy' : 'whiff', { ...x, rate }); break;
      default: Sound.sfx(heavy ? 'whiff_heavy' : 'whiff', x);
    }
  }

  /** A hit landing (or held off): the class's impact; the main hit with the boom under it, a burst's small blows soft. */
  hit(s: FinalSkill, hit: HitEvent, at: { x: number; y?: number; z?: number }, damage: number, reaction: string, crit: boolean): void {
    const w = { x: at.x, y: at.y, z: at.z };
    if (reaction === 'armor' || damage <= 0) { Sound.sfx('block', { ...w, vol: 0.85, wet: WET.hit }); return; }
    const tier = s.slot === 7 ? 3 : hit.heavy || s.slot === 6 ? 2 : s.slot === 0 ? 0 : 1;
    // the main hit (as SkillFx weighs it): heavy, one that sends the foe flying or down, the last blow of a burst
    const flies = !!(hit.reaction.launch || hit.reaction.knockdown || hit.reaction.slam) || reaction === 'launch' || reaction === 'knockdown' || reaction === 'slam';
    const many = (s.chain ? 1 : s.hits.length) > 3, main = !!hit.heavy || flies || (many && hit === s.hits[s.hits.length - 1]);
    const tick = many && !main; // (a burst's small blow: a soft tick, so the main one stands out)
    const o = { ...w, vol: tick ? 0.42 : [0.75, 0.9, 1, 1][tier], rate: tick ? 1.1 : 1, wet: tick ? WET.tick : WET.hit, at: tick ? 30 : 38 };
    const proj = hit.shape.kind === 'projectile';
    switch (s.cls) {
      case 'warrior': Sound.sfx(tier === 0 || tick ? 'hit_light' : 'war_hit', o); break;
      case 'samurai': Sound.sfx('sam_cut', o); break;
      case 'archer': Sound.sfx(proj ? 'arc_hit' : 'hit_light', o); break;
      case 'book_mage': Sound.sfx(hit.el === 'frost' ? 'mag_ice' : 'mag_hit', o); if (!tick && (hit.el === 'storm' || hit.el === 'both')) Sound.sfx('mag_bolt', { ...o, vol: 0.45 * o.vol, at: 120 }); break;
      case 'gambler': Sound.sfx(hit.fuse ? (tier >= 2 ? 'hit_heavy' : 'hit_light') : 'gam_hit', o); break;
      default: Sound.sfx('hit_light', o);
    }
    if (main) { // the boom: deeper and bigger with the blow's weight (a regular attack's main hit: a small one)
      Sound.sfx('boom', { ...w, vol: [0.5, 0.78, 0.92, 1][tier], rate: [1.08, 1, 0.94, 0.86][tier], wet: WET.boom, at: 70 });
      if (tier >= 2) Sound.sfx('hit_heavy', { ...w, vol: 0.45, at: 60, wet: WET.hit }); // (the crack of it)
    }
    if (tier === 3 && !tick) Sound.sfx('hit_ult', { ...w, vol: 0.7, at: 120, wet: WET.boom });
    if (crit) Sound.sfx('crit', { ...w, vol: 0.8 });
  }

  /** The fight's calls over the fighters (BREAK!, PUNISH!, RAGE!, SLAM!! ...). */
  callout(text: string, at: { x: number; y?: number; z?: number }): void {
    for (const [re, name, vol] of CALLS) if (re.test(text)) { Sound.sfx(name, { x: at.x, y: at.y, z: at.z, vol, wet: WET.call }); return; }
  }

  /** The stage's own events. */
  stageEvent(kind: 'bolt' | 'roar' | 'flare'): void {
    if (kind === 'bolt') this.later(250 + Math.random() * 900, () => Sound.oneShot(`thunder_${1 + Math.floor(Math.random() * 3)}`, { rate: 0.9 + Math.random() * 0.2 }));
    else if (kind === 'roar') Sound.oneShot('dragon_roar');
    else Sound.oneShot('ice_flare');
  }

  /** Every frame: jumps, landings and falls; the round clock's last five seconds; PVP 3D: the room darkening. */
  update(): void {
    for (const f of this.fighters()) {
      const a = this.air.get(f.id) ?? { up: false, peak: 0, hurt: false }, p = { x: f.x, y: f.y, z: 0, wet: WET.body };
      if (!a.up && f.h > 6) { a.up = true; a.peak = f.h; a.hurt = f.hurt; if (!f.hurt) Sound.sfx('jump', p); }
      else if (a.up) {
        a.peak = Math.max(a.peak, f.h); a.hurt ||= f.hurt;
        if (f.h <= 1.5) { a.up = false; Sound.sfx(a.hurt && a.peak > 30 ? 'fall' : 'land', { ...p, vol: Math.min(1, 0.5 + a.peak / 160) }); }
      }
      this.air.set(f.id, a);
    }
    const v = this.view;
    if (v) { // the room goes dark (a signature, the K.O., an ultimate — darker each): a deep whoosh down with it
      const d = v.dimWant;
      if (d > this.dimHeard + 0.12) Sound.sfx('dim_whoosh', { vol: 0.5 + 0.6 * d, rate: d >= 0.7 ? 0.88 : d >= 0.45 ? 0.94 : 1, wet: WET.dark, at: 300 });
      this.dimHeard = d;
    }
    const left = this.clock();
    if (left !== null && left > 0 && left <= 5000) {
      const sec = Math.ceil(left / 1000);
      if (sec !== this.tickAt) { this.tickAt = sec; Sound.sfx('tick', { rate: sec <= 3 ? 1.12 : 1 }); }
    } else this.tickAt = -1;
  }

  destroy(): void { Sound.leaveArena(); }

  private say(line: VoiceLine, delay: number): void { Sound.voice(line, delay); }
  private later(ms: number, fn: () => void): void { window.setTimeout(fn, ms); }
}
