// The PvP arena's sound director: the stage's music and ambience, the announcer and the round's stingers (VS, ROUND n,
// FIGHT!, K.O., PERFECT, TIME, the result), every cast and every hit by its class (yours, the other player's, the
// sparring knight's — panned to where it happens), the fight's calls (BREAK!, PUNISH!, COUNTER!, RAGE!, SLAM!!), jumps, landings
// and falls, the round clock's last seconds, the stage's own events (thunder with the lightning, the dragon's roar).
import Phaser from 'phaser';
import type { FinalSkill, HitEvent } from '../skills/SkillTypes';
import type { CastRun } from '../skills/SkillRuntime';
import type { Match, MatchPhase } from '../pvp/Match';
import { Sound, setPanner, SfxName, VoiceLine } from './Sound';

/** A fighter as the sound sees it: where (world x), how high above what it stands on, knocked about (launched / down). */
export interface HeardFighter { id: string; x: number; h: number; hurt: boolean }

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

  constructor(private scene: Phaser.Scene, private stage: string | undefined, private fighters: () => HeardFighter[], private clock: () => number | null) {
    Sound.attach(scene.game);
    const cam = scene.cameras.main;
    setPanner((x) => (x - cam.midPoint.x) / Math.max(1, cam.width / cam.zoom / 2));
    Sound.ambience(stage ?? null);
    Sound.music(scene, stage ?? null, 1400);
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

  /** A cast reaching its strike: the class's swing, shot, spell or throw (or a buff's own flourish). */
  cast(run: CastRun, phase: string): void {
    if (phase !== 'active') return;
    const s = run.skill, x = run.origin.x, heavy = run.hits.some((h) => h.heavy) || s.slot === 7;
    const own = BUFFS[s.id];
    if (own) { Sound.sfx(own, { x, vol: own === 'war_cry' || own === 'rage' ? 0.9 : 1 }); return; }
    const proj = run.hits.some((h) => h.shape.kind === 'projectile');
    const rate = s.slot === 0 ? 1.06 : heavy ? 0.9 : 1;
    switch (s.cls) {
      case 'warrior': Sound.sfx(s.slot === 0 ? 'whiff' : 'war_swing', { x, rate }); break;
      case 'samurai': Sound.sfx('sam_swish', { x, rate }); break;
      case 'archer': Sound.sfx(proj ? 'arc_shot' : 'whiff', { x, rate }); break;
      case 'book_mage': Sound.sfx(run.hits.some((h) => h.el === 'storm') ? 'mag_bolt' : run.hits.some((h) => h.el === 'frost') ? 'mag_ice' : 'mag_cast', { x, rate, vol: 0.85 }); break;
      case 'gambler': Sound.sfx(proj || run.hits.some((h) => h.stick) ? 'gam_throw' : heavy ? 'whiff_heavy' : 'whiff', { x, rate }); break;
      default: Sound.sfx(heavy ? 'whiff_heavy' : 'whiff', { x });
    }
  }

  /** A hit landing (or held off): the class's impact with the weight of the blow under it. */
  hit(s: FinalSkill, hit: HitEvent, at: { x: number }, damage: number, reaction: string, crit: boolean): void {
    const x = at.x;
    if (reaction === 'armor' || damage <= 0) { Sound.sfx('block', { x, vol: 0.85 }); return; }
    const tier = s.slot === 7 ? 3 : hit.heavy || s.slot === 6 ? 2 : s.slot === 0 ? 0 : 1;
    const many = s.hits.length > 4 && !hit.heavy, v = (many ? 0.6 : 1) * [0.75, 0.9, 1, 1][tier];
    const proj = hit.shape.kind === 'projectile';
    switch (s.cls) {
      case 'warrior': Sound.sfx(tier === 0 ? 'hit_light' : 'war_hit', { x, vol: v }); break;
      case 'samurai': Sound.sfx('sam_cut', { x, vol: v }); break;
      case 'archer': Sound.sfx(proj ? 'arc_hit' : 'hit_light', { x, vol: v }); break;
      case 'book_mage': Sound.sfx(hit.el === 'frost' ? 'mag_ice' : 'mag_hit', { x, vol: v }); if (hit.el === 'storm' || hit.el === 'both') Sound.sfx('mag_bolt', { x, vol: 0.45 * v, at: 120 }); break;
      case 'gambler': Sound.sfx(hit.fuse ? (tier >= 2 ? 'hit_heavy' : 'hit_light') : 'gam_hit', { x, vol: v }); break;
      default: Sound.sfx('hit_light', { x, vol: v });
    }
    if (tier === 2) Sound.sfx('hit_heavy', { x, vol: 0.6, at: 60 });
    if (tier === 3) Sound.sfx('hit_ult', { x, vol: 0.7, at: 120 });
    if (reaction === 'knockdown' || reaction === 'slam') Sound.sfx('hit_heavy', { x, vol: 0.5, at: 60 });
    if (crit) Sound.sfx('crit', { x, vol: 0.8 });
  }

  /** The fight's calls over the fighters (BREAK!, PUNISH!, RAGE!, SLAM!! ...). */
  callout(text: string, at: { x: number }): void {
    for (const [re, name, vol] of CALLS) if (re.test(text)) { Sound.sfx(name, { x: at.x, vol }); return; }
  }

  /** The stage's own events. */
  stageEvent(kind: 'bolt' | 'roar' | 'flare'): void {
    if (kind === 'bolt') this.later(250 + Math.random() * 900, () => Sound.oneShot(`thunder_${1 + Math.floor(Math.random() * 3)}`, { rate: 0.9 + Math.random() * 0.2 }));
    else if (kind === 'roar') Sound.oneShot('dragon_roar');
    else Sound.oneShot('ice_flare');
  }

  /** Every frame: jumps, landings and falls; the round clock's last five seconds. */
  update(): void {
    for (const f of this.fighters()) {
      const a = this.air.get(f.id) ?? { up: false, peak: 0, hurt: false };
      if (!a.up && f.h > 6) { a.up = true; a.peak = f.h; a.hurt = f.hurt; if (!f.hurt) Sound.sfx('jump', { x: f.x }); }
      else if (a.up) {
        a.peak = Math.max(a.peak, f.h); a.hurt ||= f.hurt;
        if (f.h <= 1.5) { a.up = false; Sound.sfx(a.hurt && a.peak > 30 ? 'fall' : 'land', { x: f.x, vol: Math.min(1, 0.5 + a.peak / 160) }); }
      }
      this.air.set(f.id, a);
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
