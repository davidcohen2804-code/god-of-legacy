// The PvP arena's sound director: the stage's music and ambience, the announcer and the round's stingers (VS, ROUND n,
// FIGHT!, K.O., PERFECT, TIME, the result), every cast and every hit by its class (yours, the other player's, the
// sparring knight's), the fight's calls (BREAK!, PUNISH!, COUNTER!, RAGE!, SLAM!!), jumps, landings and falls, the round
// clock's last seconds, the stage's own events (thunder with the lightning, the dragon's roar).
// The weight of a blow (SkillFx's rule for the hit-stop and the shake): the main hit — a heavy blow, one that sends the
// foe flying or down, the last blow of a burst — lands with a heavy layered boom under the class's own impact; the small
// blows of a burst are soft ticks, so the main one stands out. Every sound with a place is panned to where it is on the
// screen and quieter far from the camera. PVP 3D: the fight sounds in the temple courtyard (its reverb), a deep whoosh
// goes down as the room darkens (a signature, an ultimate, the K.O.); every piece of a skill in the room has a short sound
// of its own under the blow (a crack splits the stone and drops wood chunks a beat later, a pillar of light roars up, a
// bolt crackles, a dome whumps, a wave rushes past, crystals grow and shatter — the repeating ones held back); the
// fighters' feet on the planks (steps when running, a scuff when driven back, a thump on landing). The music ducks under
// an ultimate (both arenas).
// Every damaging blow lands with the blow itself under it, by its weight and its class (IMP, tools/audio/hits.py — the
// crack, the body, a saturated crunch, the class's material, the tail: light for a basic or small blow, medium for a
// skill's, heavy for the main hit). Every skill of every class sounds like itself (SIG): its own swing / shot / spell, timed so it peaks on the strike, a
// wind-up for the big ones, its own main hit under the boom — in its class's palette, the warrior's and the archer's in
// the families of their skills' looks (steel, stone, iron, holy, crimson · wind, thorn, storm, spirit).
import Phaser from 'phaser';
import type { FinalSkill, HitEvent } from '../skills/SkillTypes';
import type { CastRun } from '../skills/SkillRuntime';
import type { Match, MatchPhase } from '../pvp/Match';
import type { FxPiece } from '../arena3d/Fx3D';
import { hitIndex } from '../skills/FinalKit';
import { Heard, PlayOpts, Sound, setPanner, SfxName, VoiceLine } from './Sound';

/** A fighter as the sound sees it: where (world x, y), how high above what it stands on, knocked about (launched / down),
 *  driven back by a blow (sliding on its feet). */
export interface HeardFighter { id: string; x: number; /** depth on the floor */ y: number; h: number; hurt: boolean; slide?: boolean }

/** PVP 3D as the sound needs it (Arena3D): where its camera sees a world point (screen px, and px per world px there —
 *  smaller farther away), the fight it frames, and how dark the room wants to be (0 none .. 1). */
export interface RoomView { project(x: number, y: number, z: number): { sx: number; sy: number; k: number }; focus: { x: number; y: number; z: number }; dimWant: number;
  /** The skills' 3D pieces: each one announced as it appears (what, where, how big 0..2, and its options when given). */
  fx?: { onPiece?: (kind: FxPiece, at: { x: number; y: number; z: number }, size: number, o?: PieceLook) => void };
  /** The room's life (Maps): the birds startled off the roofs into the air (where the flock rises, world px). */
  onLife?: (what: 'birds', at: { x: number; y: number; z: number }) => void }
/** What a piece is made of, when the 3D layer says (its crystals: rock spikes — the Warrior's stone —, or green: thorns). */
export interface PieceLook { stone?: boolean; color?: number }

/** The room's share (reverb send) of each kind of sound: the fight's blows ring in the courtyard, the small ticks less. */
const WET = { hit: 0.42, tick: 0.25, boom: 0.45, swing: 0.3, body: 0.38, call: 0.32, dark: 0.25, piece: 0.4 } as const;

/** PVP 3D: each piece's sound (its volume, how soon it may come again — a rain's streaks, a whirl's slashes held back —
 *  and what follows it a beat later). */
const PIECE: Record<FxPiece, { sfx: SfxName; vol: number; gap: number; then?: [SfxName, number, number] }> = { // (crystals: ice; stone spikes and green thorns their own — crystalSfx)
  crack: { sfx: 'crack', vol: 0.9, gap: 90, then: ['chunks', 170, 0.8] }, pillar: { sfx: 'pillar', vol: 0.9, gap: 250 }, bolt: { sfx: 'bolt', vol: 0.85, gap: 70 },
  dome: { sfx: 'dome', vol: 0.9, gap: 200 }, wave: { sfx: 'wave', vol: 0.85, gap: 200 }, crystals: { sfx: 'crystals', vol: 0.85, gap: 200 },
  streak: { sfx: 'streak', vol: 0.6, gap: 120 }, slash: { sfx: 'slash', vol: 0.65, gap: 90 }, rain: { sfx: 'rain', vol: 0.8, gap: 600 },
};
/** The crystals by what they are made of: rock spikes crumble (the Warrior's stone), green ones are thorny roots (the
 *  Archer's), the rest ice (the Book Mage's) or arcane shards. */
function crystalSfx(o?: PieceLook): SfxName {
  if (o?.stone) return 'spikes';
  const c = o?.color;
  return c !== undefined && ((c >> 8) & 255) > ((c >> 16) & 255) * 1.15 && ((c >> 8) & 255) > (c & 255) * 1.15 ? 'thorns' : 'crystals';
}
/** The feet on the planks: running from (px / s), a step every (px) running / sprinting; a scuff at most every (ms). */
const FEET = { run: 330, step: 80, sprint: 64, scuffGap: 260 };
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
/** Each skill's own sounds (tools/audio/signatures.py): `wind` as the cast starts (a big one's wind-up; `windLead` ms into
 *  it is the strike), `cast` its swing / shot / spell (a basic chain: one per stage; `lead` ms into it lands on the strike
 *  — started early, or partway in when the startup is short; none: at the strike), `hit` its first main hit (under the
 *  boom), `end` its last main hit, `blow` its other blows (a burst's small ones stay the class's soft ticks), `zero` a blow
 *  that does no damage but means something (a curse, a bind, a stun); `every`: every main hit gets `hit` (the last one
 *  `end`), not only the first (blows of one kind: a hammer three times); `zone` a blow of what it leaves on the floor
 *  (its lingering hits: the charged floor catching someone), `zoneEnd` the last of them (a hold's last turn); `zoneVol`:
 *  the lingering hits lighter (a hold's quick turns: light blows at this volume, so its last turn stands out). */
interface Sig { wind?: SfxName; windLead?: number; cast?: SfxName | readonly SfxName[]; lead?: number | readonly number[]; hit?: SfxName; end?: SfxName; blow?: SfxName; blowVol?: number; zero?: SfxName; every?: boolean; zone?: SfxName; zoneEnd?: SfxName; zoneVol?: number }
const SIG: Record<string, Sig> = {
  // warrior: a greatsword's weight, holy gold light, the storm, the titan
  warrior_basic: { cast: ['wr_iron_1', 'wr_iron_2', 'wr_iron_3', 'wr_iron_4'], lead: [153, 150, 135, 275], blow: 'wr_iron_hit', hit: 'wr_iron_fin' },
  rising_slash: { cast: 'wr_rise_c', lead: 252, hit: 'wr_rise_h' },
  ground_breaker: { cast: 'wr_quake_c', lead: 315, hit: 'wr_quake_h' },
  lance_thrust: { cast: 'wr_rush_c', hit: 'wr_rush_h' },
  blade_storm: { wind: 'wr_storm_w', windLead: 320, cast: 'wr_storm_c', hit: 'wr_storm_h', blow: 'wr_storm_h', blowVol: 0.55 }, // (the storm's light swords keep striking)
  titans_verdict: { wind: 'wr_titan_w', windLead: 770, hit: 'wr_titan_h', end: 'wr_titan_end' },
  dash_slash: { cast: 'wr_dash_c', lead: 100, blow: 'wr_dash_h', hit: 'wr_dash_h' }, // STEEL: a blur, one razor line bursting in sparks
  whirlwind: { cast: 'wr_whirl_c', hit: 'wr_whirl_h' }, // STEEL: a disc of steel at his waist, a turn per blow
  wave_slash: { cast: 'wr_wave_c', lead: 250, hit: 'wr_wave_h', blow: 'wr_wave_h' }, // STEEL: a crescent of air running along the planks
  sky_breaker: { cast: 'wr_sky_c', lead: 30, hit: 'wr_sky_h', end: 'wr_sky_end' }, // STEEL cuts up (the two in the air: a burst's soft ticks), the dive, the landing in STONE
  leap_crash: { cast: 'wr_leap_c', lead: 120, hit: 'wr_leap_h', end: 'wr_leap_end' }, // STONE: the crater
  earthsplitter: { wind: 'wr_split_w', cast: 'wr_split_c', hit: 'wr_split_h' }, // STONE: the ground trembling under the hold, the fissure, the spikes
  iron_grip: { cast: 'wr_grip_c', lead: 80, blow: 'wr_grip_b', hit: 'wr_grip_h' }, // IRON: the gauntlet closing, the heave
  judgment_hook: { cast: 'wr_hook_c', lead: 60, blow: 'wr_hook_h', hit: 'wr_hook_h' }, // IRON: a real chain, the hook biting, reeled in
  shield_charge: { cast: 'wr_charge_c', lead: 40 }, // IRON: the barrier of iron light at his shoulder
  judgment_blade: { cast: 'wr_jblade_c', lead: 120, hit: 'wr_jblade_h', blow: 'wr_jblade_z', blowVol: 0.6 }, // HOLY: the sword of light from the sky, the pin pulsing
  sanctuary: { cast: 'wr_sanct_c', lead: 300, hit: 'wr_sanct_h', blow: 'wr_sanct_h' }, // HOLY: the ring of runes, the dome
  war_cry: { cast: 'wr_cry_c', lead: 300, hit: 'wr_cry_h', blow: 'wr_cry_h' }, // CRIMSON: the roar and its shock ring
  lions_maw: { cast: 'wr_lion_c', lead: 150, hit: 'wr_lion_h' }, // CRIMSON: the lion of flame, its jaws
  // samurai: thin bright steel, sakura, ink, the dark and the crimson dragon
  quick_slash: { cast: ['sm_quick_1', 'sm_quick_2', 'sm_quick_3', 'sm_quick_4'], lead: [64, 64, 60, 109], blow: 'sm_quick_hit', hit: 'sm_quick_fin' },
  hundred_cuts: { cast: 'sm_hundred_c', lead: 36, hit: 'sm_hundred_h' },
  swallow_cut: { cast: 'sm_swallow_c', lead: 100, hit: 'sm_swallow_h' },
  shadow_step: { cast: 'sm_shadow_c', lead: 100, blow: 'sm_shadow_h' },
  iai_strike: { wind: 'sm_iai_w', cast: 'sm_iai_c', hit: 'sm_iai_h', blow: 'sm_iai_h' },
  blossom_storm: { cast: 'sm_blossom_c', lead: 40, hit: 'sm_blossom_h' },
  dragon_eclipse: { wind: 'sm_eclipse_w', windLead: 1350, cast: 'sm_eclipse_c', lead: 28, hit: 'sm_eclipse_h' },
  sheathe: { cast: 'sm_sheathe_c' },
  sword_wave: { cast: 'sm_wave_c', lead: 56, hit: 'sm_wave_h', blow: 'sm_wave_h' },
  mirage: { cast: 'sm_mirage_c', hit: 'sm_mirage_h', blow: 'sm_mirage_h' },
  kagemusha: { cast: 'sm_kage_c', hit: 'sm_kage_h', blow: 'sm_kage_h' },
  tornado_blade: { cast: 'sm_tornado_c', hit: 'sm_tornado_h' },
  falcon_dive: { cast: 'sm_falcon_c', end: 'sm_falcon_h' },
  rising_sun: { wind: 'sm_sun_w', windLead: 700, cast: 'sm_sun_c', hit: 'sm_sun_h', blow: 'sm_sun_h' },
  phantom_blades: { cast: 'sm_phantom_c', lead: 90, hit: 'sm_phantom_h' },
  god_of_blades: { wind: 'sm_gods_w', windLead: 600, cast: 'sm_gods_c', hit: 'sm_gods_h', blow: 'sm_gods_h' },
  sakura_bind: { cast: 'sm_bind_c', hit: 'sm_bind_h', blow: 'sm_bind_h' },
  dragon_ascension: { cast: 'sm_ascend_c', hit: 'sm_ascend_h', blow: 'sm_ascend_h' },
  // archer: the bow, wind and leaves, fire, the sky full of arrows
  quick_shot: { cast: ['ar_double_c', 'ar_charged_c'], lead: [0, 160], blow: 'ar_arrow_hit', hit: 'ar_charged_h' },
  rising_arrow: { cast: 'ar_rise_c', hit: 'ar_rise_h' },
  explosive_arrow: { cast: 'ar_fire_c', hit: 'ar_fire_h', blow: 'ar_fire_h' },
  arrow_storm: { cast: 'ar_storm_c', hit: 'ar_storm_h' },
  skyhunters_step: { cast: 'ar_volley_c', hit: 'ar_volley_h' },
  sky_rain: { wind: 'ar_skyrain_w', windLead: 800, cast: 'ar_skyrain_c', hit: 'ar_skyrain_h' },
  bow_haste: { cast: 'ar_step_c', lead: 40, hit: 'ar_step_h', blow: 'ar_step_h' }, // WIND: the gust ring, the somersault, the shot from its top
  multi_shot: { cast: 'ar_triple_c', lead: 180, blow: 'ar_triple_h', hit: 'ar_triple_h' }, // WIND: three trails fanned
  backstep_shot: { cast: 'ar_back_c', blow: 'ar_back_h', hit: 'ar_back_h' }, // WIND: the back flip, the shot at its top
  retreat_kick: { cast: 'ar_kick_c', lead: 90, hit: 'ar_kick_h', blow: 'ar_kick_h' }, // WIND: the boot of wind
  vine_trap: { cast: 'ar_mine_c', lead: 150, zero: 'ar_mine_z', hit: 'ar_mine_h', blow: 'ar_mine_h' }, // THORN: planted, snapping shut, erupting
  leaping_arrow: { cast: 'ar_bind_c', lead: 150, blow: 'ar_bind_h', hit: 'ar_bind_h' }, // THORN: roots tearing up along the line, binding
  hunters_spirit: { cast: 'ar_lash_c', lead: 140, blow: 'ar_lash_h', hit: 'ar_lash_h' }, // THORN: Vine Lash — the whip of thorns, the yank
  tree_of_life: { cast: 'ar_tree_c', lead: 450, blow: 'ar_tree_h', hit: 'ar_tree_h' }, // the tree of light growing, blooming
  rain_of_arrows: { cast: 'ar_thunder_c', blow: 'ar_thunder_b', hit: 'ar_thunder_h', zone: 'ar_thunder_z' }, // STORM: arrows into a dark cloud, bolts down, the charged floor
  piercing_arrow: { cast: 'ar_spirit_c', lead: 400, hit: 'ar_spirit_h' }, // SPIRIT: Spirit Bow's arrow of light
  hunters_roar: { cast: 'ar_roar_c', lead: 260, hit: 'ar_roar_h' }, // SPIRIT: the wolf howling behind her, the wave
  spirit_hawk: { cast: 'ar_hawk_c', lead: 250, blow: 'ar_hawk_b', hit: 'ar_hawk_h' }, // SPIRIT: the hawk's cry, its dives
  eagle_arrow: { wind: 'ar_eagle_w', windLead: 1200, cast: 'ar_eagle_c', blow: 'ar_eagle_b', hit: 'ar_eagle_h' }, // SPIRIT: Eagle Tide — the draw, the eagle flying through
  // book mage: arcane chimes, starlight, lightning, frost, the clock of time
  arcane_bolt: { cast: ['bm_bolt_c1', 'bm_bolt_c2', 'bm_lance_c'], lead: [0, 0, 150], blow: 'bm_bolt_h', hit: 'bm_lance_h' },
  arcane_wave: { cast: 'bm_wave_c', lead: 60, hit: 'bm_wave_h', blow: 'bm_wave_h' },
  astral_burst: { cast: 'bm_astral_c', lead: 250, hit: 'bm_astral_h', blow: 'bm_astral_h' },
  lightning_chain: { cast: 'bm_chain_c', lead: 50, hit: 'bm_chain_h' },
  glacial_spikes: { cast: 'bm_spikes_c', hit: 'bm_spikes_h', blow: 'bm_spikes_h' }, // (a single blow: its sound whatever the frost makes of it)
  storm_field: { cast: 'bm_field_c', hit: 'bm_field_h' },
  time_collapse: { wind: 'bm_time_w', windLead: 900, cast: 'bm_time_c', hit: 'bm_time_h' },
  binding_rune: { cast: 'bm_rune_c', hit: 'bm_rune_h', blow: 'bm_rune_h', zero: 'bm_rune_h' },
  frost_nova: { cast: 'bm_nova_c', hit: 'bm_nova_h', blow: 'bm_nova_h', zero: 'bm_nova_h' },
  blink: { cast: 'bm_blink_c', blow: 'bm_blink_z', zero: 'bm_blink_z' },
  levity_field: { cast: 'bm_levity_c', hit: 'bm_levity_h', blow: 'bm_levity_h', zero: 'bm_levity_h' },
  origami_flock: { cast: 'bm_crane_c', hit: 'bm_crane_h', blow: 'bm_crane_h' },
  arcane_ward: { cast: 'bm_ward_c' },
  paper_curse: { cast: 'bm_curse_c', blow: 'bm_curse_z', zero: 'bm_curse_z' },
  elemental_ascension: { wind: 'bm_elem_w', windLead: 600, cast: 'bm_elem_c', hit: 'bm_elem_h', blow: 'bm_elem_h' },
  page_bind: { cast: 'bm_slam_c', lead: 120, hit: 'bm_slam_h', blow: 'bm_slam_h' },
  // gambler: the staff, the cards, the casino
  cut_the_deck: { cast: ['gb_deck_1', 'gb_deck_2', 'gb_deck_3', 'gb_deck_4'], lead: [49, 88, 0, 112], blow: 'gb_staff_hit', hit: 'gb_deck_fin' },
  charged_deal: { wind: 'gb_deal_w', cast: 'gb_deal_c', blow: 'gb_deal_h' },
  staff_vault: { cast: 'gb_vault_c', hit: 'gb_vault_h' },
  fuse_slam: { cast: 'gb_fuse_c', lead: 240, hit: 'gb_fuse_h', blow: 'gb_fuse_h' },
  showdown: { wind: 'gb_show_w', windLead: 360, cast: 'gb_show_c', hit: 'gb_show_h' },
  jackpot: { wind: 'gb_jack_w', windLead: 900, cast: 'gb_jack_c', hit: 'gb_jack_h' },
  riffle_shuffle: { cast: 'gb_riffle_c', hit: 'gb_riffle_h' },
  rotor_staff: { cast: 'gb_rotor_c', hit: 'gb_rotor_h' },
  coin_flip: { cast: 'gb_coin_c', lead: 420 },
  roulette_wheel: { cast: 'gb_wheel_c', hit: 'gb_wheel_h' },
  dice_bomb: { cast: 'gb_dice_c', hit: 'gb_dice_h', end: 'gb_dice_h' },
  kinetic_grab: { cast: 'gb_grab_c', blow: 'gb_grab_h', hit: 'gb_grab_end' },
  ace_in_the_hole: { cast: 'gb_ace_c', lead: 280, hit: 'gb_ace_h', blow: 'gb_ace_h' },
  all_in: { cast: 'gb_snap_c', hit: 'gb_allin_h' },
  pickup_52: { cast: 'gb_52_c', hit: 'gb_52_h' },
  grand_slam: { wind: 'gb_slam_w', windLead: 420, cast: 'gb_slam_c', lead: 157, hit: 'gb_slam_h' },
  triple_down: { cast: 'gb_triple_c', hit: 'gb_triple_h', end: 'gb_triple_end', every: true },
  card_swap: { cast: 'gb_swap_c' },
  call_the_deck: { cast: 'gb_wild_c', lead: 150, hit: 'gb_wild_h', zone: 'gb_wild_z', zoneEnd: 'gb_wild_end', zoneVol: 0.7 }, // the big card fused and flung like a saw (its gather: deckGather), the cut, each turn of the hold under him, the last turn and its way home
};
/** A chain's stage's own (the last one for the stages after). */
const perStage = <V>(v: V | readonly V[] | undefined, stage: number): V | undefined =>
  Array.isArray(v) ? (v as readonly V[])[Math.min(Math.max(0, stage), v.length - 1)] : (v as V | undefined);

/** Each class's blows (imp_<class>_<l|m|h>, loaded with its own sounds). */
const IMP: Record<string, string> = { warrior: 'wr', samurai: 'sm', archer: 'ar', book_mage: 'bm', gambler: 'gb' };

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

  /** PVP 3D: the room's camera places the sounds, the fight rings in the courtyard, the skills' pieces sound in it. */
  use3D(view: RoomView): void {
    this.view = view; this.dimHeard = 0; Sound.room(true);
    if (view.fx) view.fx.onPiece = (kind, at, size, o) => this.piece(kind, at, size, o);
    view.onLife = (what, at) => { if (what === 'birds') Sound.oneShot(`birds_up_${1 + (this.birdTake++ % 2)}`, { x: at.x, y: at.y, z: at.z, wet: WET.piece }); }; // (a flurry of wings, flying off where they rose)
  }
  private birdTake = 0;

  /** A piece of a skill in the room: its own short sound where it is (bigger: louder and deeper). */
  private piece(kind: FxPiece, at: { x: number; y: number; z: number }, size: number, look?: PieceLook): void {
    const p = PIECE[kind]; if (!p) return;
    const s = Math.max(0, Math.min(2, Math.round(size))), k = [0.7, 0.85, 1][s];
    const o = { x: at.x, y: at.y, z: at.z, vol: p.vol * k, rate: [1.08, 1, 0.9][s], wet: WET.piece, at: p.gap };
    Sound.sfx(kind === 'crystals' ? crystalSfx(look) : p.sfx, o);
    if (p.then) { const [n, ms, v] = p.then; this.later(ms, () => Sound.sfx(n, { ...o, vol: v * k, at: 60 })); }
  }

  /** The feet last heard (PVP 3D): where, when, the way run since the last step, the last scuff. */
  private feet = new Map<string, { x: number; y: number; t: number; run: number; scuff: number }>();

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

  /** A cast reaching its strike: the class's swing, shot, spell or throw (or a buff's own flourish); a signature skill its
   *  own (its wind-up as it starts). An ultimate's wind-up ducks the music under it until it is over. */
  cast(run: CastRun, phase: string): void {
    const s = run.skill, T = run.timings;
    if (phase === 'startup' && s.slot === 7) Sound.duck(T.startup + T.active + Math.min(T.recovery, 900) + 300, 0.3);
    if (phase === 'startup') this.riserFor(run);
    const x = { x: run.origin.x, y: run.origin.y, z: run.origin.z, wet: WET.swing };
    const sig = this.sigOf(s);
    if (sig) {
      const c = perStage(sig.cast, run.stage), lead = perStage(sig.lead, run.stage) ?? 0;
      if (phase === 'startup') { if (sig.wind) this.onStrike(run, sig.wind, sig.windLead ?? 0, x); if (c && lead > 0) this.onStrike(run, c, lead, x); }
      else if (phase === 'active' && c && lead <= 0) Sound.sfx(c, x);
      return;
    }
    if (phase !== 'active') return;
    const heavy = run.hits.some((h) => h.heavy) || s.slot === 7;
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

  /** Call the Deck's gather: his cards on the floor whip home into his hand — as many as came (none: nothing to hear). */
  deckGather(run: CastRun, n: number): void {
    if (n <= 0 || !Sound.classReady(this.scene, run.skill.cls)) return;
    Sound.sfx(n >= 5 ? 'gb_wild_g2' : 'gb_wild_g1', { x: run.origin.x, y: run.origin.y, z: run.origin.z, wet: WET.swing, vol: n >= 5 ? 1 : 0.75 + 0.06 * n });
  }

  /** THE BAR (David 18:23): a riser (a rising sweep, 0.35 s; an ultimate's 0.5 s, deeper) leads into a skill's big beat —
   *  its first heavy blow (an ultimate: its last main one) — started from the cast so it ends on the beat, where the blow
   *  and its boom take over; cut if the cast is broken off first. Not for a basic chain, nor a skill with a wind-up of its
   *  own (it already leads in), nor a held one (its beat comes at the release), nor when the beat comes too soon. */
  private riserFor(run: CastRun): void {
    const s = run.skill, sig = SIG[s.id];
    if (s.slot === 0 || s.chain || s.charge || sig?.wind) return; // (a held skill: its beat comes at the release, unknown here)
    const ult = s.slot === 7, hs = run.hits;
    const big = ult ? [...hs].reverse().find((h) => h.heavy || h.reaction.launch || h.reaction.knockdown || h.reaction.slam) ?? hs[hs.length - 1] : hs.find((h) => h.heavy);
    if (!big) return;
    const len = ult ? 500 : 350, toBeat = run.timings.startup + big.at - run.elapsed;
    if (toBeat < 160) return;
    const start = toBeat - len, at = run.origin;
    const go = () => {
      if (run.phase === 'done') return;
      const snd = Sound.sfx(ult ? 'riser_l' : 'riser_s', { x: at.x, y: at.y, z: at.z, wet: WET.swing, at: 120, seek: start < 0 ? -start / 1000 : 0 });
      if (snd) this.risers.push({ run, snd, until: performance.now() + Math.min(len, toBeat) + 30 });
    };
    if (start > 0) this.later(start, go); else go();
  }
  private risers: { run: CastRun; snd: Phaser.Sound.BaseSound; until: number }[] = [];

  /** A flurry's count of small blows (a skill's ticks within 0.45 s of each other are one flurry). */
  private flurry(id: string): number {
    const now = performance.now(), f = this.flurries.get(id);
    const n = f && now - f.at < 450 ? f.n + 1 : 1;
    this.flurries.set(id, { n, at: now });
    return n;
  }
  private flurries = new Map<string, { n: number; at: number }>();
  /** The last beat of quiet (one at most every 1.2 s: a combo of finishers does not chop the music). */
  private quietAt = -1e9;

  /** A hit landing (or held off): the class's impact (a signature skill's own); the main hit with the boom under it, a
   *  burst's small blows soft. */
  hit(s: FinalSkill, hit: HitEvent, at: { x: number; y?: number; z?: number }, damage: number, reaction: string, crit: boolean): void {
    const w = { x: at.x, y: at.y, z: at.z };
    if (reaction === 'armor') { Sound.sfx('block', { ...w, vol: 0.85, wet: WET.hit }); return; }
    if (damage <= 0) { const z = this.sigOf(s)?.zero; if (z) Sound.sfx(z, { ...w, wet: WET.hit }); return; } // (a hold, a pull, a zone's grip: no blow to hear — a curse or a bind its own)
    const tier = s.slot === 7 ? 3 : hit.heavy || s.slot === 6 ? 2 : s.slot === 0 ? 0 : 1;
    // the main hit (as SkillFx weighs it): heavy, one that sends the foe flying or down, the last blow of a burst
    const flies = !!(hit.reaction.launch || hit.reaction.knockdown || hit.reaction.slam) || reaction === 'launch' || reaction === 'knockdown' || reaction === 'slam';
    const many = (s.chain ? 1 : s.hits.length) > 3, idx = s.chain ? -1 : hitIndex(s, hit), main = !!hit.heavy || flies || (many && idx === s.hits.length - 1);
    const tick = many && !main; // (a burst's small blow: a soft tick, so the main one stands out)
    const o = { ...w, vol: tick ? 0.42 : [0.75, 0.9, 1, 1][tier], rate: tick ? 1.1 : 1, wet: tick ? WET.tick : WET.hit, at: tick ? 30 : 38 };
    const proj = hit.shape.kind === 'projectile';
    // the blow itself, by its weight (its class's sounds in: else the class's old impact below)
    const turn = !!this.sigOf(s)?.zoneVol && hit === s.linger?.hit; // (a hold's quick turns: light, so its last one stands out)
    const ic = IMP[s.cls], ready = !!ic && Sound.classReady(this.scene, s.cls);
    const accent = tick && this.flurry(s.id) % 5 === 0; // (THE BAR: a flurry is a stream of small 'shing's, a heavier one every fifth — never a wall of one sound)
    const blow = ready ? (`imp_${ic}_${accent ? 'm' : tick || turn || tier === 0 ? 'l' : main ? 'h' : 'm'}` as SfxName) : null;
    if (blow) Sound.sfx(blow, { ...w, vol: accent ? 0.85 : tick || turn ? 0.55 : 1, wet: tick ? WET.tick : WET.hit, at: tick ? 30 : 38 });
    if (tick && ready) Sound.sfx(`tk_${ic}` as SfxName, { ...w, vol: accent ? 1 : 0.7, rate: accent ? 0.92 : 1, wet: WET.tick, at: 25 });
    const sig = tick ? undefined : this.sigOf(s), own = sig ? (sig.zone && hit === s.linger?.hit ? sig.zone : sig.zoneEnd && hit === s.linger?.last ? sig.zoneEnd : this.ownHit(s, sig, main, idx)) : undefined;
    if (own) Sound.sfx(own, turn ? { ...o, vol: o.vol * sig!.zoneVol! } : !main && sig?.blowVol ? { ...o, vol: o.vol * sig.blowVol } : o);
    else if (!blow) switch (s.cls) {
      case 'warrior': Sound.sfx(tier === 0 || tick ? 'hit_light' : 'war_hit', o); break;
      case 'samurai': Sound.sfx('sam_cut', o); break;
      case 'archer': Sound.sfx(proj ? 'arc_hit' : 'hit_light', o); break;
      case 'book_mage': Sound.sfx(hit.el === 'frost' ? 'mag_ice' : 'mag_hit', o); if (!tick && (hit.el === 'storm' || hit.el === 'both')) Sound.sfx('mag_bolt', { ...o, vol: 0.45 * o.vol, at: 120 }); break;
      case 'gambler': Sound.sfx(hit.fuse ? (tier >= 2 ? 'hit_heavy' : 'hit_light') : 'gam_hit', o); break;
      default: Sound.sfx('hit_light', o);
    }
    if (main && tier >= 2 && !s.chain && idx >= 0 && idx === this.mainsOf(s).last && !(s.linger && hit === s.linger.hit) && performance.now() - this.quietAt > 1200) { this.quietAt = performance.now(); this.later(90, () => Sound.quiet(300)); } // (THE BAR: a beat of quiet right after a finisher — the music and the room drop away, the blow's tail rings alone)
    if (main) { // the boom: deeper and bigger with the blow's weight (a regular attack's main hit: a small one)
      Sound.sfx('boom', { ...w, vol: [0.5, 0.78, 0.92, 1][tier], rate: [1.08, 1, 0.94, 0.86][tier], wet: WET.boom, at: 70 });
      if (tier >= 2 && !blow) Sound.sfx('hit_heavy', { ...w, vol: 0.45, at: 60, wet: WET.hit }); // (the crack of it: in the blow's own sound when it has one)
    }
    if (tier === 3 && !tick) Sound.sfx('hit_ult', { ...w, vol: 0.7, at: 120, wet: WET.boom });
    if (crit) Sound.sfx('crit', { ...w, vol: 0.8 });
  }

  /** A signature skill's sounds, once its class's are in (they are sent for the first time a class is heard without them). */
  private sigOf(s: FinalSkill): Sig | undefined {
    const sig = SIG[s.id];
    return sig && Sound.classReady(this.scene, s.cls) ? sig : undefined;
  }

  /** Play a sound so that `lead` ms into it lands on the strike (the end of the run's startup): later when there is time
   *  to spare, from partway into it when there is less (a skill cancelled into from a hit starts up faster). */
  private onStrike(run: CastRun, name: SfxName, lead: number, o: PlayOpts): void {
    const d = run.timings.startup - run.elapsed - lead;
    if (lead <= 0 || d <= 0) { Sound.sfx(name, { ...o, seek: lead > 0 ? Math.max(0, -d) / 1000 : 0 }); return; }
    this.scene.time.delayedCall(d, () => { if (run.phase !== 'done') Sound.sfx(name, o); });
  }

  /** Each signature skill's first and last main hit (by its index). */
  private mains = new Map<string, { first: number; last: number }>();
  /** A signature skill's own impact for this blow: its first main hit, its last one, its other blows. */
  /** A skill's main hits (the first and the last of them: heavy, a launch / knockdown / slam, a burst's last blow). */
  private mainsOf(s: FinalSkill): { first: number; last: number } {
    let m = this.mains.get(s.id);
    if (!m) {
      const n = s.hits.length, many = n > 3;
      m = { first: -1, last: -1 };
      s.hits.forEach((h, i) => { if (h.heavy || h.reaction.launch || h.reaction.knockdown || h.reaction.slam || (many && i === n - 1)) { if (m!.first < 0) m!.first = i; m!.last = i; } });
      this.mains.set(s.id, m);
    }
    return m;
  }

  private ownHit(s: FinalSkill, sig: Sig, main: boolean, idx: number): SfxName | undefined {
    if (!main) return sig.blow;
    if (s.chain || s.charge || idx < 0) return sig.hit; // (a chain's finisher; a charged skill's level hits are its own)
    const m = this.mainsOf(s);
    if (sig.every) return idx === m.last && sig.end ? sig.end : sig.hit;
    return idx === m.first ? sig.hit : idx === m.last ? sig.end : undefined;
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
    if (this.risers.length) { // a riser whose cast was broken off before its beat: cut short
      const now = performance.now();
      this.risers = this.risers.filter((r) => { if (now > r.until) return false; if (r.run.phase === 'done') { r.snd.stop(); return false; } return true; });
    }
    for (const f of this.fighters()) {
      const a = this.air.get(f.id) ?? { up: false, peak: 0, hurt: false }, p = { x: f.x, y: f.y, z: 0, wet: WET.body };
      if (!a.up && f.h > 6) { a.up = true; a.peak = f.h; a.hurt = f.hurt; if (!f.hurt) Sound.sfx('jump', p); }
      else if (a.up) {
        a.peak = Math.max(a.peak, f.h); a.hurt ||= f.hurt;
        if (f.h <= 1.5) {
          a.up = false; Sound.sfx(a.hurt && a.peak > 30 ? 'fall' : 'land', { ...p, vol: Math.min(1, 0.5 + a.peak / 160) });
          if (this.view) Sound.sfx('thump', { ...p, vol: a.hurt ? Math.min(1, 0.6 + a.peak / 400) : Math.min(0.7, 0.3 + a.peak / 300), rate: a.hurt ? 0.9 : 1, at: 60 }); // (the planks take the weight)
        }
      }
      this.air.set(f.id, a);
      if (this.view) this.stepOn(f);
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

  /** PVP 3D: a fighter's feet on the planks — a step every so far while running (quicker sprinting), a scuff when a blow
   *  drives it back along the floor (as the room kicks up its dust). */
  private stepOn(f: HeardFighter): void {
    const now = performance.now(), m = this.feet.get(f.id) ?? { x: f.x, y: f.y, t: now, run: 0, scuff: -1e9 };
    const d = Math.hypot(f.x - m.x, f.y - m.y), v = (d * 1000) / Math.max(1, now - m.t);
    m.x = f.x; m.y = f.y; m.t = now; this.feet.set(f.id, m);
    if (d > 140 || f.h > 3 || v < FEET.run) { m.run = 0; return; } // (a teleport, in the air, or walking)
    const o = { x: f.x, y: f.y, z: 0, wet: WET.body };
    if (f.slide || f.hurt) { if (now - m.scuff > FEET.scuffGap) { m.scuff = now; Sound.sfx('scuff', { ...o, vol: Math.min(1, 0.5 + v / 1400), at: 60 }); } return; }
    m.run += d;
    const every = v > 700 ? FEET.sprint : FEET.step;
    if (m.run >= every) { m.run %= every; Sound.sfx('step', { ...o, vol: Math.min(0.9, 0.45 + v / 2000), at: 40 }); }
  }

  destroy(): void { Sound.leaveArena(); }

  private say(line: VoiceLine, delay: number): void { Sound.voice(line, delay); }
  private later(ms: number, fn: () => void): void { window.setTimeout(fn, ms); }
}
