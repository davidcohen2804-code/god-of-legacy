// The game's sound, the PvP arena first (Tekken-style): music that crossfades from screen to screen and loops, the
// announcer, the effects (impacts, swings, each class's own family, the round's moments), each stage's living ambience.
// Files under assets/audio (.ogg; .mp3 where ogg does not play). Volumes: Settings' Master (Phaser's own volume),
// Music and SFX (the announcer and the ambience with the effects).
// Sources: the effects and ambiences are synthesised for the game (the main hit's boom and the darkening's whoosh by
// tools/audio/impacts.py, with PVP 3D's room sounds; each class's signature skills by tools/audio/signatures.py); the menu cues are uisfx's (CC0); the announcer is the owner's own voice with the game's
// processing (a big hall); the music is the owner's Suno tracks.
// Where a sound happens: each one with a place is panned to where it is on the screen and quieter far from the camera
// (setPanner: the arena tells how its camera sees a point). PVP 3D: the effects of the fight sound in the temple
// courtyard (room(): a short reverb with the walls' early reflections), each sound sending its share (PlayOpts.wet).
import Phaser from 'phaser';
import { SettingsStore } from '../core/SettingsStore';

const A = 'assets/audio/';
const urls = (path: string) => [`${A}${path}.ogg`, `${A}${path}.mp3`];

/** Effect families: variations and base volume. */
export const SFX = {
  hit_light: [3, 0.7], hit_heavy: [3, 0.8], hit_ult: [2, 0.85], block: [3, 0.6], whiff: [3, 0.4], whiff_heavy: [2, 0.45], crit: [1, 0.45], jump: [2, 0.25], land: [3, 0.35], fall: [2, 0.65],
  vs_slam: [1, 0.85], round_swoosh: [1, 0.55], fight_hit: [1, 0.7], ko_boom: [1, 0.95], perfect_shine: [1, 0.55], break: [1, 0.75], punish: [1, 0.6], rage: [1, 0.65], tick: [1, 0.35],
  boom: [3, 0.62], dim_whoosh: [1, 0.7],
  // PVP 3D: the skills' pieces in the room, and the fighters on its planks
  crack: [2, 0.4], chunks: [2, 0.42], pillar: [1, 0.55], bolt: [2, 0.4], dome: [1, 0.5], wave: [1, 0.5], crystals: [1, 0.45], streak: [1, 0.32], slash: [1, 0.36], rain: [1, 0.45],
  step: [4, 0.42], scuff: [2, 0.45], thump: [2, 0.62],
  war_swing: [3, 0.5], war_hit: [3, 0.7], war_shield: [1, 0.75], war_cry: [1, 0.6], slam: [2, 0.85],
  sam_swish: [3, 0.5], sam_cut: [3, 0.7], sam_draw: [1, 0.55], sam_sheathe: [1, 0.45],
  arc_shot: [3, 0.55], arc_hit: [3, 0.65], arc_volley: [1, 0.55], arc_hawk: [1, 0.45],
  mag_cast: [3, 0.45], mag_hit: [3, 0.65], mag_bolt: [2, 0.6], mag_ice: [2, 0.6], mag_page: [2, 0.45],
  gam_throw: [3, 0.5], gam_hit: [3, 0.65], gam_chips: [2, 0.55], gam_dice: [1, 0.55], gam_coins: [1, 0.5], gam_roulette: [1, 0.5],
} satisfies Record<string, [number, number]>;
/** Each class's signature skills (ArenaSound's SIG): their own casts, wind-ups and hits (tools/audio/signatures.py) —
 *  loaded with the arena for the classes fighting in it (another class, when it shows up: then). Variations and base
 *  volume, set from each one's measured loudness (A-weighted): a cast about as loud as the class swings were, a blow as
 *  its impacts, a main hit a little over them. */
export const SIG_SFX = {
  warrior: {
    wr_iron_1: [1, 0.44], wr_iron_2: [1, 0.44], wr_iron_3: [1, 0.47], wr_iron_4: [1, 0.62], wr_iron_hit: [2, 0.66], wr_iron_fin: [1, 0.65],
    wr_rise_c: [1, 0.29], wr_rise_h: [1, 0.29], wr_quake_c: [1, 0.61], wr_quake_h: [1, 0.58], wr_rush_c: [1, 0.5], wr_rush_h: [1, 0.47],
    wr_storm_w: [1, 0.38], wr_storm_c: [1, 0.34], wr_storm_h: [1, 0.28], wr_titan_w: [1, 0.27], wr_titan_h: [1, 0.58], wr_titan_end: [1, 1.0],
    wr_dash_c: [1, 0.37], wr_dash_h: [1, 0.97], wr_whirl_c: [1, 0.41], wr_whirl_h: [1, 0.5], wr_sanct_c: [1, 0.29], wr_sanct_h: [1, 0.52],
    wr_leap_c: [1, 0.44], wr_leap_h: [1, 0.97], wr_leap_end: [1, 0.68], wr_wave_c: [1, 0.28], wr_wave_h: [1, 0.48], wr_cry_c: [1, 0.36],
    wr_cry_h: [1, 0.57], wr_jblade_c: [1, 0.21], wr_jblade_h: [1, 0.49], wr_jblade_z: [1, 0.45], wr_grip_c: [1, 0.28], wr_grip_b: [1, 0.59],
    wr_grip_h: [1, 0.49], wr_hook_c: [1, 0.19], wr_hook_h: [1, 0.4], wr_sky_c: [1, 0.16], wr_sky_h: [1, 0.33],
    wr_sky_end: [1, 0.65], wr_split_w: [1, 0.56], wr_split_c: [1, 0.51], wr_split_h: [1, 1.0], wr_lion_c: [1, 0.35], wr_lion_h: [1, 0.82],
    wr_charge_c: [1, 0.45]
  },
  samurai: {
    sm_quick_1: [1, 0.53], sm_quick_2: [1, 0.54], sm_quick_3: [1, 0.42], sm_quick_4: [1, 0.43], sm_quick_hit: [2, 0.53], sm_quick_fin: [1, 0.29],
    sm_hundred_c: [1, 0.53], sm_hundred_h: [1, 0.38], sm_swallow_c: [1, 0.46], sm_swallow_h: [1, 0.27], sm_shadow_c: [1, 0.47], sm_shadow_h: [1, 0.46],
    sm_iai_w: [1, 0.44], sm_iai_c: [1, 0.24], sm_iai_h: [1, 0.53], sm_blossom_c: [1, 0.36], sm_blossom_h: [1, 0.44], sm_eclipse_w: [1, 0.67],
    sm_eclipse_c: [1, 0.5], sm_eclipse_h: [1, 0.53], sm_sheathe_c: [1, 0.48], sm_wave_c: [1, 0.37], sm_wave_h: [1, 0.34], sm_mirage_c: [1, 0.37],
    sm_mirage_h: [1, 0.35], sm_kage_c: [1, 0.53], sm_kage_h: [1, 0.94], sm_tornado_c: [1, 0.36], sm_tornado_h: [1, 0.53], sm_falcon_c: [1, 0.4],
    sm_falcon_h: [1, 0.59], sm_sun_w: [1, 0.48], sm_sun_c: [1, 0.34], sm_sun_h: [1, 0.8], sm_phantom_c: [1, 0.61], sm_phantom_h: [1, 0.35],
    sm_gods_w: [1, 0.27], sm_gods_c: [1, 0.36], sm_gods_h: [1, 0.45], sm_bind_c: [1, 0.38], sm_bind_h: [1, 0.67], sm_ascend_c: [1, 0.49],
    sm_ascend_h: [1, 0.51]
  },
  archer: {
    ar_double_c: [1, 0.4], ar_charged_c: [1, 0.36], ar_arrow_hit: [2, 0.77], ar_charged_h: [1, 0.89], ar_rise_c: [1, 0.42], ar_rise_h: [1, 0.44],
    ar_fire_c: [1, 0.42], ar_fire_h: [1, 0.42], ar_storm_c: [1, 0.37], ar_storm_h: [1, 0.67], ar_volley_c: [1, 0.41], ar_volley_h: [1, 0.62],
    ar_skyrain_w: [1, 0.32], ar_skyrain_c: [1, 0.37], ar_skyrain_h: [1, 0.47], ar_step_c: [1, 0.43], ar_step_h: [1, 0.48], ar_triple_c: [1, 0.24],
    ar_triple_h: [1, 0.75], ar_back_c: [1, 0.33], ar_back_h: [1, 0.8], ar_kick_c: [1, 0.46], ar_kick_h: [1, 1.0], ar_mine_c: [1, 0.58],
    ar_mine_z: [1, 0.52], ar_mine_h: [1, 0.5], ar_thunder_c: [1, 0.28], ar_thunder_b: [1, 0.66], ar_thunder_h: [1, 0.69], ar_thunder_z: [1, 0.73],
    ar_spirit_c: [1, 0.31], ar_spirit_h: [1, 0.68], ar_roar_c: [1, 0.23], ar_roar_h: [1, 0.99], ar_bind_c: [1, 0.45], ar_bind_h: [1, 0.73],
    ar_hawk_c: [1, 0.2], ar_hawk_b: [1, 0.33], ar_hawk_h: [1, 0.38], ar_tree_c: [1, 0.41], ar_tree_h: [1, 0.79], ar_lash_c: [1, 0.54],
    ar_lash_h: [1, 0.95], ar_eagle_w: [1, 0.5], ar_eagle_c: [1, 0.18], ar_eagle_b: [1, 0.87], ar_eagle_h: [1, 0.3]
  },
  book_mage: {
    bm_bolt_c1: [1, 0.23], bm_bolt_c2: [1, 0.24], bm_lance_c: [1, 0.52], bm_bolt_h: [2, 0.26], bm_lance_h: [1, 0.6], bm_wave_c: [1, 0.22],
    bm_wave_h: [1, 0.41], bm_astral_c: [1, 0.25], bm_astral_h: [1, 0.68], bm_chain_c: [1, 1.0], bm_chain_h: [1, 0.55], bm_spikes_c: [1, 0.51],
    bm_spikes_h: [1, 0.82], bm_field_c: [1, 0.89], bm_field_h: [1, 0.52], bm_time_w: [1, 0.41], bm_time_c: [1, 0.38], bm_time_h: [1, 0.55],
    bm_rune_c: [1, 0.34], bm_rune_h: [1, 0.63], bm_nova_c: [1, 0.4], bm_nova_h: [1, 0.88], bm_blink_c: [1, 0.3], bm_blink_z: [1, 0.73],
    bm_levity_c: [1, 0.43], bm_levity_h: [1, 0.61], bm_crane_c: [1, 0.36], bm_crane_h: [1, 0.6], bm_ward_c: [1, 0.32], bm_curse_c: [1, 0.5],
    bm_curse_z: [1, 0.5], bm_elem_w: [1, 0.39], bm_elem_c: [1, 0.44], bm_elem_h: [1, 0.71], bm_slam_c: [1, 0.59], bm_slam_h: [1, 0.85]
  },
  gambler: {
    gb_deck_1: [1, 0.56], gb_deck_2: [1, 0.54], gb_deck_3: [1, 0.58], gb_deck_4: [1, 0.33], gb_staff_hit: [2, 0.58], gb_deck_fin: [1, 0.34],
    gb_deal_w: [1, 0.47], gb_deal_c: [1, 0.37], gb_deal_h: [1, 0.84], gb_vault_c: [1, 0.49], gb_vault_h: [1, 0.55], gb_fuse_c: [1, 0.43],
    gb_fuse_h: [1, 0.92], gb_show_w: [1, 0.45], gb_show_c: [1, 0.36], gb_show_h: [1, 0.3], gb_jack_w: [1, 0.64], gb_jack_c: [1, 0.24],
    gb_jack_h: [1, 0.37], gb_riffle_c: [1, 0.72], gb_riffle_h: [1, 0.72], gb_rotor_c: [1, 0.51], gb_rotor_h: [1, 0.63], gb_coin_c: [1, 0.19],
    gb_wheel_c: [1, 0.56], gb_wheel_h: [1, 0.45], gb_dice_c: [1, 0.44], gb_dice_h: [1, 0.66], gb_grab_c: [1, 0.82], gb_grab_h: [1, 1.0],
    gb_grab_end: [1, 0.73], gb_ace_c: [1, 0.42], gb_ace_h: [1, 0.76], gb_snap_c: [1, 1.0], gb_allin_h: [1, 0.51], gb_52_c: [1, 0.37],
    gb_52_h: [1, 0.62], gb_slam_w: [1, 0.37], gb_slam_c: [1, 0.39], gb_slam_h: [1, 0.64], gb_triple_c: [1, 0.51], gb_triple_h: [1, 1.0],
    gb_triple_end: [1, 1.0], gb_swap_c: [1, 0.42]
  },
} satisfies Record<string, Record<string, [number, number]>>;
type SigName = { [C in keyof typeof SIG_SFX]: keyof (typeof SIG_SFX)[C] }[keyof typeof SIG_SFX];
export type SfxName = keyof typeof SFX | SigName;
/** Every effect family (the shared ones and every class's own). */
const FAMILY: Record<string, [number, number]> = Object.assign({}, SFX, ...Object.values(SIG_SFX));
/** The menus' cues. */
const UI = { move: 0.55, select: 0.65, lock: 0.9, back: 0.6, swipe: 0.6 } as const;
export type UiName = keyof typeof UI;
/** The announcer's lines. */
export const VOICE = ['round_1', 'round_2', 'round_3', 'final_round', 'fight', 'ko', 'double_ko', 'perfect', 'time', 'draw', 'you_win', 'you_lose'] as const;
/** The select screen's: CHOOSE YOUR FIGHTER, each fighter's name as it is locked in, GET READY. */
export const MENU_VOICE = ['choose', 'get_ready', 'warrior', 'samurai', 'archer', 'book_mage', 'gambler'] as const;
export type VoiceLine = typeof VOICE[number] | typeof MENU_VOICE[number];
/** Each fighter's own line on the VS screen (the classes recorded so far). */
const CHAR_LINES = new Set<string>(['warrior', 'samurai', 'book_mage', 'archer', 'gambler']); // (the owner's own takes; the archer in a woman's voice)
let vsHeard = false;
/** The select screen's lines on (the announcer is the owner's own voice). */
const MENU_VOICE_ON = true;
/** The music in the game so far (each a seamless loop): the select screen and the stages by id. */
const MUSIC = new Set(['select', 'courtyard', 'lava', 'shaolin', 'sakura', 'ship', 'ice']);
/** Short pieces played once over the music (the music fades out under them and comes back after). */
const JINGLES = new Set<string>(['victory']);
/** Each stage's ambience and the one-shots its events play. */
const AMB: Record<string, string[]> = { courtyard: [], lava: [], shaolin: ['dragon_roar'], sakura: [], ship: ['thunder_1', 'thunder_2', 'thunder_3'], ice: ['ice_flare'] };
const AMB_VOL: Record<string, number> = { courtyard: 0.26, lava: 0.24, shaolin: 0.24, sakura: 0.26, ship: 0.3, ice: 0.24 }; // (under the music)
const ONE_VOL: Record<string, number> = { thunder: 0.75, dragon_roar: 0.6, ice_flare: 0.45 };
const MUSIC_VOL = 0.55;
const VOICE_VOL = 1;

const key = (k: string) => `snd-${k}`;

// ---------------------------------------------------------------- loading

function load(scene: Phaser.Scene, k: string, path: string): void {
  if (!scene.cache.audio.exists(key(k))) scene.load.audio(key(k), urls(path));
}
/** The select screen's cues (and the lock-in's punch). */
export function loadMenuSound(scene: Phaser.Scene): void {
  for (const u of Object.keys(UI)) load(scene, `ui_${u}`, `ui/${u}`);
  load(scene, 'round_swoosh', 'sfx/round_swoosh'); load(scene, 'vs_slam', 'sfx/vs_slam'); // (the VS loading screen's slam: before the arena's own sounds are in)
  for (const c of CHAR_LINES) load(scene, `c_${c}`, `voice/c_${c}`);
  if (MENU_VOICE_ON) for (const v of MENU_VOICE) load(scene, `v_${v}`, `voice/${v}`);
}
function loadFamilies(scene: Phaser.Scene, set: Record<string, [number, number]>): void {
  for (const [n, [count]] of Object.entries(set)) for (let i = 1; i <= count; i++) { const f = count > 1 ? `${n}_${i}` : n; load(scene, f, `sfx/${f}`); }
}
/** A class's signature sounds (none for a class that has none). */
const sigOf = (cls: string): Record<string, [number, number]> | undefined => (SIG_SFX as Record<string, Record<string, [number, number]>>)[cls];
/** The arena's: every effect, the announcer, the stage's ambience and its one-shots; the signature sounds of the classes
 *  in the fight (all of them when it is not known who fights). */
export function loadArenaSound(scene: Phaser.Scene, stage: string | undefined, classes?: (string | undefined)[]): void {
  loadFamilies(scene, SFX);
  for (const c of classes?.length ? classes : Object.keys(SIG_SFX)) { const set = c ? sigOf(c) : undefined; if (set) loadFamilies(scene, set); }
  for (const v of VOICE) load(scene, `v_${v}`, `voice/${v}`);
  if (stage && AMB[stage]) { load(scene, `amb_${stage}`, `amb/amb_${stage}`); for (const o of AMB[stage]) load(scene, o, `amb/${o}`); }
}

// ---------------------------------------------------------------- playing

let game: Phaser.Game | null = null;
let lastPlay = new Map<string, number>();
let lastPick = new Map<string, number>();
const live = new Map<string, number>();
const sfxVol = () => SettingsStore.get().sfxVolume / 100;
const musicVol = () => SettingsStore.get().musicVolume / 100;
const sm = () => game?.sound;

/** Where a point of the world is heard: its side of the screen (pan, -1 left .. 1 right) and how loud from where the
 *  camera is (gain: 1 at the fight, less far back or off the screen). */
export interface Heard { pan: number; gain: number }
export type Panner = (x: number, y?: number, z?: number) => Heard;
let panner: Panner | null = null;
export function setPanner(p: Panner | null): void { panner = p; }
/** How far a sound goes to its side (an equal-power pan: wide, never all in one ear); near the middle of the screen the
 *  side still tells (the fight stays framed near the middle: a blow a little right of it is heard a little right). */
const PAN_WIDTH = 0.8, PAN_CURVE = 0.65;
const panOf = (p: number) => Math.sign(p) * Math.pow(Math.min(1, Math.abs(p)), PAN_CURVE) * PAN_WIDTH;

/** x, y, z: where it happens (world px: across, depth, height); wet: its share in the room's reverb (PVP 3D). */
export interface PlayOpts { vol?: number; rate?: number; x?: number; y?: number; z?: number; delay?: number; at?: number; wet?: number;
  /** Start this far into it (s): a wind-up that has less time than it was made for still peaks on the strike. */
  seek?: number }

function playKey(k: string, vol: number, o: PlayOpts = {}): Phaser.Sound.BaseSound | null {
  const m = sm();
  if (!m || !game?.cache.audio.exists(key(k))) return null;
  const h = o.x !== undefined && panner ? panner(o.x, o.y, o.z) : null;
  const s = m.add(key(k), { volume: vol * (h ? h.gain : 1), rate: o.rate ?? 1, delay: o.delay ?? 0, pan: h ? panOf(h.pan) : 0, seek: o.seek ?? 0 });
  const send = roomSend(s, o.wet ?? 0);
  live.set(k, (live.get(k) ?? 0) + 1);
  s.once(Phaser.Sound.Events.COMPLETE, () => { live.set(k, (live.get(k) ?? 1) - 1); send?.disconnect(); s.destroy(); });
  s.play();
  return s;
}

/** The master's limiter: the big moments stack (a blow's impact, its boom, the room's pieces, a call) and would clip the
 *  output — a fast, hard-kneed limiter just under full scale holds them (everything quieter passes as it is, a hair
 *  louder: the compressor's own make-up). Kept on the manager (`limiter`) for the QA recordings. */
function limiter(g: Phaser.Game): void {
  const m = g.sound as unknown as { context?: AudioContext; masterVolumeNode?: GainNode; limiter?: DynamicsCompressorNode };
  if (!m.context || !m.masterVolumeNode || m.limiter) return;
  const c = m.context.createDynamicsCompressor();
  c.threshold.value = -5; c.knee.value = 2; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.15;
  m.masterVolumeNode.disconnect(); m.masterVolumeNode.connect(c); c.connect(m.context.destination);
  m.limiter = c;
}

// ---------------------------------------------------------------- the room (PVP 3D: the temple courtyard)

/** The courtyard's reverb level (the wet return) and its shape: a stone yard open to the sky — the walls and the temple
 *  front answer at once (early reflections), then a short, darkening tail (about a second). */
const ROOM_WET = 1;
/** The response's energy (set offline against the game's own blows: a hit rings ~14 dB under itself and its tail runs
 *  out over ~0.8 s; a steady sound comes back about as loud as its send). */
const ROOM_ENERGY = 1;
interface RoomFx { ctx: AudioContext; inp: GainNode; out: GainNode }
let roomFx: RoomFx | null = null;
let roomOn = false;

function courtyardIR(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate, len = Math.round(sr * 1.25), b = ctx.createBuffer(2, len, sr);
  const taps: [number, number][] = [[9, 0.5], [17, 0.42], [26, 0.34], [38, 0.27], [53, 0.21], [71, 0.15]]; // (ms, level)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += ((Math.random() * 2 - 1) - lp) * (0.35 + 0.6 * Math.exp(-t / 0.25)); // (bright stone; the highs go as it fades)
      d[i] = lp * Math.exp(-t / 0.16) * Math.min(1, t / 0.008) * 0.6;           // (-60 dB in ~1.1 s)
    }
    for (const [ms, g] of taps) { const i = Math.round((ms / 1000) * sr * (c ? 1.09 : 1)); if (i < len) d[i] += g * (c ? -1 : 1) * (0.8 + Math.random() * 0.4); } // (each side its own walls)
    let e = 0; for (let i = 0; i < len; i++) e += d[i] * d[i];
    const k = Math.sqrt(ROOM_ENERGY / Math.max(1e-9, e)); for (let i = 0; i < len; i++) d[i] *= k; // (its level set here: the
  }                                                                                                  //  browser's own normalising buries a blow's tail)
  return b;
}

/** The room's chain on the game's audio: the sends in, a short pre-delay, the courtyard's response, the low end and the
 *  fizz taken out (the boom's sub stays dry and tight), back into the master. Built once per audio context. */
function room(): RoomFx | null {
  const m = sm() as unknown as { context?: AudioContext; destination?: AudioNode } | undefined;
  if (!m?.context || !m.destination) return null;
  if (roomFx?.ctx === m.context) return roomFx;
  const ctx = m.context, inp = ctx.createGain(), pre = ctx.createDelay(0.1), conv = ctx.createConvolver();
  const hp = ctx.createBiquadFilter(), lpf = ctx.createBiquadFilter(), out = ctx.createGain();
  pre.delayTime.value = 0.012; conv.normalize = false; conv.buffer = courtyardIR(ctx);
  hp.type = 'highpass'; hp.frequency.value = 170; lpf.type = 'lowpass'; lpf.frequency.value = 6500;
  out.gain.value = roomOn ? ROOM_WET : 0;
  inp.connect(pre); pre.connect(conv); conv.connect(hp); hp.connect(lpf); lpf.connect(out); out.connect(m.destination);
  roomFx = { ctx, inp, out };
  return roomFx;
}

/** A sound's share into the room (after its own volume and pan: the reverb follows the Settings and the side). */
function roomSend(s: Phaser.Sound.BaseSound, wet: number): GainNode | null {
  if (!roomOn || wet <= 0) return null;
  const r = room(), w = s as unknown as { pannerNode?: AudioNode | null; volumeNode?: AudioNode | null };
  const src = w.pannerNode ?? w.volumeNode;
  if (!r || !src) return null;
  const g = r.ctx.createGain(); g.gain.value = wet;
  src.connect(g); g.connect(r.inp);
  return g;
}

export const Sound = {
  attach(g: Phaser.Game): void {
    if (game === g) return;
    game = g; lastPlay = new Map(); lastPick = new Map();
    g.events.on(Phaser.Core.Events.STEP, (_t: number, dt: number) => step(dt));
    limiter(g);
  },

  /** An effect (a family's variation at random, never the same twice in a row, a hair of pitch to keep it alive). Too
   *  many of one family at once, or too soon after the last, and it is let go (a storm of hits stays clean). */
  sfx(name: SfxName, o: PlayOpts = {}): void {
    const [n, base] = FAMILY[name], now = performance.now();
    if (now - (lastPlay.get(name) ?? -1e9) < (o.at ?? 38) || (live.get(name) ?? 0) >= 4 * n) return;
    lastPlay.set(name, now);
    let i = n > 1 ? 1 + Math.floor(Math.random() * n) : 0;
    if (n > 1 && i === lastPick.get(name)) i = 1 + (i % n);
    lastPick.set(name, i);
    playKey(i ? `${name}_${i}` : name, base * (o.vol ?? 1) * sfxVol(), { ...o, rate: (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.06) });
  },

  /** A class's signature sounds are in (else they are fetched now through this scene, and heard from when they are). */
  classReady(scene: Phaser.Scene, cls: string): boolean {
    const set = sigOf(cls);
    if (!set || !game) return false;
    const c = game.cache.audio;
    if (Object.entries(set).every(([n, [count]]) => c.exists(key(count > 1 ? `${n}_1` : n)))) return true;
    if (!asked.has(cls)) { asked.add(cls); loadFamilies(scene, set); scene.load.start(); }
    return false;
  },

  /** A fighter locked in on the select screen: the cue with a punch under it, the announcer calling its name. */
  lockIn(cls?: string): void {
    Sound.ui('lock');
    if (MENU_VOICE_ON && cls && (MENU_VOICE as readonly string[]).includes(cls)) Sound.voice(cls as VoiceLine, 120);
  },
  /** Both locked in: GET READY. */
  getReady(): void { playKey('round_swoosh', SFX.round_swoosh[1] * sfxVol()); },

  /** The VS loading screen: the slam as the emblem lands, each fighter's own line (yours, then the other's), GET READY. */
  vsIntro(l: string, r: string): void {
    vsHeard = true;
    window.setTimeout(() => playKey('vs_slam', SFX.vs_slam[1] * sfxVol()), 380);
    const lines = [l, r].filter((c) => CHAR_LINES.has(c)).map((c) => `c_${c}`);
    const next = (i: number, delay: number) => window.setTimeout(() => {
      if (i >= lines.length) { if (MENU_VOICE_ON) Sound.voice('get_ready'); return; }
      voiceSnd?.stop(); voiceSnd?.destroy();
      const s = playKey(lines[i], VOICE_VOL * sfxVol()); voiceSnd = s;
      duckUntil = performance.now() + ((s?.duration || 1.5) * 1000);
      next(i + 1, ((s?.duration || 1.4) * 1000) * 0.8 + 250);
    }, delay);
    next(0, 1150);
  },
  /** The VS slam already heard on the loading screen: the match's first VS keeps quiet (asked once). */
  vsHeardOnce(): boolean { const h = vsHeard; vsHeard = false; return h; },
  /** CHOOSE YOUR FIGHTER (the select screen opening). */
  choose(): void { if (MENU_VOICE_ON) Sound.voice('choose', 650); },

  /** A menu cue. */
  ui(name: UiName, vol = 1): void {
    const now = performance.now();
    if (now - (lastPlay.get(`ui_${name}`) ?? -1e9) < 45) return;
    lastPlay.set(`ui_${name}`, now);
    playKey(`ui_${name}`, UI[name] * vol * sfxVol());
  },

  /** One of a stage's one-shots (thunder, the dragon's roar, the aurora's flare). */
  oneShot(name: string, o: PlayOpts = {}): void {
    playKey(name, (ONE_VOL[name.replace(/_\d+$/, '')] ?? 0.6) * (o.vol ?? 1) * sfxVol(), o);
  },

  /** The announcer: one line at a time (a new one cuts the last), the music dips under it. */
  voice(line: VoiceLine, delay = 0): void {
    voiceSnd?.stop(); voiceSnd?.destroy();
    const s = playKey(`v_${line}`, VOICE_VOL * sfxVol(), { delay: delay / 1000 });
    voiceSnd = s;
    if (s) duckUntil = performance.now() + delay + Math.max(900, (s.duration || 1.5) * 1000 * 0.75);
  },

  /** The music: this track (a seamless loop) — crossfading from whatever played (null: fade out). Loaded the first time
   *  it is asked for, through this scene's loader (it starts when it is in). */
  music(scene: Phaser.Scene, track: string | null, fadeMs = 900): void {
    Sound.attach(scene.game);
    const k = track && MUSIC.has(track) ? `music_${track}` : null;
    wantMusic = k;
    channel(chMusic, k, fadeMs);
    if (k && !scene.cache.audio.exists(key(k))) {
      load(scene, k, `music/${track}`);
      scene.load.once(`filecomplete-audio-${key(k)}`, () => { if (wantMusic === k) channel(chMusic, k, fadeMs); });
      scene.load.start();
    }
  },

  /** A short piece once (the victory): the music fades out under it and back in after it. False: there is none. */
  jingle(scene: Phaser.Scene, name: string): boolean {
    if (!JINGLES.has(name)) return false;
    const k = `music_${name}`, back = wantMusic, go = () => {
      const s = playKey(k, MUSIC_VOL * 1.15 * musicVol());
      if (!s) return;
      channel(chMusic, null, 350);
      s.once(Phaser.Sound.Events.COMPLETE, () => { if (wantMusic === back && back) channel(chMusic, back, 2500); });
    };
    if (scene.cache.audio.exists(key(k))) go();
    else { load(scene, k, `music/${name}`); scene.load.once(`filecomplete-audio-${key(k)}`, go); scene.load.start(); }
    return true;
  },

  /** A stage's ambience (loaded with the arena) or none. */
  ambience(stage: string | null, fadeMs = 1200): void { channel(chAmb, stage && AMB[stage] ? `amb_${stage}` : null, fadeMs, stage ? AMB_VOL[stage] : 1); },

  /** The music dips for a while (a K.O., an ultimate): the longer and the deeper of two dips at once wins. */
  duck(ms: number, level = 0.3): void { const now = performance.now(); duckLevel = now < duckUntil ? Math.min(duckLevel, level) : level; duckUntil = Math.max(duckUntil, now + ms); },

  /** PVP 3D: the fight's effects sound in the temple courtyard (its reverb fades in), or back to dry. */
  room(on: boolean): void {
    roomOn = on;
    const r = room();
    if (r) r.out.gain.setTargetAtTime(on ? ROOM_WET : 0, r.ctx.currentTime, 0.15);
  },

  /** Leaving the arena: its ambience and music fade (the select screen, if that is next, brings its own back in). */
  leaveArena(): void { Sound.ambience(null, 700); wantMusic = null; channel(chMusic, null, 900); voiceSnd?.stop(); setPanner(null); Sound.room(false); },
};

let voiceSnd: Phaser.Sound.BaseSound | null = null;
/** The classes whose signature sounds were sent for after the arena had loaded. */
const asked = new Set<string>();
let duckUntil = 0, duckLevel = 0.45, duck = 1;
let wantMusic: string | null = null;

/** A looping channel (music or ambience): the playing sounds, each fading toward its own target. */
interface Chan { list: { k: string; s: Phaser.Sound.BaseSound; g: number; to: number; rate: number }[]; vol: () => number; base: number }
const chMusic: Chan = { list: [], vol: () => MUSIC_VOL * musicVol(), base: 1 };
const chAmb: Chan = { list: [], vol: () => sfxVol(), base: 1 };

function channel(c: Chan, k: string | null, fadeMs: number, base = 1): void {
  const rate = 1000 / Math.max(1, fadeMs);
  for (const e of c.list) if (e.k !== k) { e.to = 0; e.rate = rate; }
  if (!k) return;
  const cur = c.list.find((e) => e.k === k);
  if (cur) { cur.to = 1; cur.rate = rate; c.base = base; return; }
  const m = sm();
  if (!m || !game?.cache.audio.exists(key(k))) return;
  const s = m.add(key(k), { loop: true, volume: 0 });
  s.play();
  c.base = base;
  c.list.push({ k, s, g: 0, to: 1, rate });
}

function step(dt: number): void {
  const now = performance.now(), want = now < duckUntil ? duckLevel : 1;
  duck += (want - duck) * Math.min(1, dt / (want < duck ? 90 : 450)); // (down fast, back up slowly)
  for (const c of [chMusic, chAmb]) {
    const v = c.vol() * c.base * (c === chMusic ? duck : 1);
    c.list = c.list.filter((e) => {
      e.g += Math.sign(e.to - e.g) * Math.min(Math.abs(e.to - e.g), (dt / 1000) * e.rate);
      (e.s as Phaser.Sound.WebAudioSound).setVolume?.(e.g * v);
      if (e.g <= 0 && e.to <= 0) { e.s.stop(); e.s.destroy(); return false; }
      return true;
    });
  }
}
