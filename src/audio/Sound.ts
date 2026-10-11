// The game's sound, the PvP arena first (Tekken-style): music that crossfades from screen to screen and loops, the
// announcer, the effects (impacts, swings, each class's own family, the round's moments), each stage's living ambience.
// Files under assets/audio (.ogg; .mp3 where ogg does not play). Volumes: Settings' Master (Phaser's own volume),
// Music and SFX (the announcer and the ambience with the effects).
// Sources: the effects and ambiences are synthesised for the game; the menu cues are uisfx's (CC0); the announcer is
// Kokoro TTS (Apache-2.0 model, voice am_onyx) with the game's own processing; the music is the owner's Suno tracks.
import Phaser from 'phaser';
import { SettingsStore } from '../core/SettingsStore';

const A = 'assets/audio/';
const urls = (path: string) => [`${A}${path}.ogg`, `${A}${path}.mp3`];

/** Effect families: variations and base volume. */
export const SFX = {
  hit_light: [3, 0.7], hit_heavy: [3, 0.8], hit_ult: [2, 0.85], block: [3, 0.6], whiff: [3, 0.4], whiff_heavy: [2, 0.45], crit: [1, 0.45], jump: [2, 0.25], land: [3, 0.35], fall: [2, 0.65],
  vs_slam: [1, 0.85], round_swoosh: [1, 0.55], fight_hit: [1, 0.7], ko_boom: [1, 0.95], perfect_shine: [1, 0.55], break: [1, 0.75], punish: [1, 0.6], rage: [1, 0.65], tick: [1, 0.35],
  war_swing: [3, 0.5], war_hit: [3, 0.7], war_shield: [1, 0.75], war_cry: [1, 0.6], slam: [2, 0.85],
  sam_swish: [3, 0.5], sam_cut: [3, 0.7], sam_draw: [1, 0.55], sam_sheathe: [1, 0.45],
  arc_shot: [3, 0.55], arc_hit: [3, 0.65], arc_volley: [1, 0.55], arc_hawk: [1, 0.45],
  mag_cast: [3, 0.45], mag_hit: [3, 0.65], mag_bolt: [2, 0.6], mag_ice: [2, 0.6], mag_page: [2, 0.45],
  gam_throw: [3, 0.5], gam_hit: [3, 0.65], gam_chips: [2, 0.55], gam_dice: [1, 0.55], gam_coins: [1, 0.5], gam_roulette: [1, 0.5],
} satisfies Record<string, [number, number]>;
export type SfxName = keyof typeof SFX;
/** The menus' cues. */
const UI = { move: 0.35, select: 0.45, lock: 0.6, back: 0.45, swipe: 0.4 } as const;
export type UiName = keyof typeof UI;
/** The announcer's lines. */
export const VOICE = ['round_1', 'round_2', 'round_3', 'final_round', 'fight', 'ko', 'double_ko', 'perfect', 'time', 'draw', 'you_win', 'you_lose'] as const;
/** The select screen's: CHOOSE YOUR FIGHTER, each fighter's name as it is locked in, GET READY. */
export const MENU_VOICE = ['choose', 'get_ready', 'warrior', 'samurai', 'archer', 'book_mage', 'gambler'] as const;
export type VoiceLine = typeof VOICE[number] | typeof MENU_VOICE[number];
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
  for (const n of ['hit_heavy_1', 'round_swoosh']) load(scene, n, `sfx/${n}`);
  for (const v of MENU_VOICE) load(scene, `v_${v}`, `voice/${v}`);
}
/** The arena's: every effect, the announcer, the stage's ambience and its one-shots. */
export function loadArenaSound(scene: Phaser.Scene, stage: string | undefined): void {
  for (const [n, [count]] of Object.entries(SFX)) for (let i = 1; i <= count; i++) { const f = count > 1 ? `${n}_${i}` : n; load(scene, f, `sfx/${f}`); }
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

/** Where on the screen a point of the world is (-1 left .. 1 right): its sound comes from that side (a little). */
export type Panner = (x: number) => number;
let panner: Panner | null = null;
export function setPanner(p: Panner | null): void { panner = p; }

export interface PlayOpts { vol?: number; rate?: number; x?: number; delay?: number; at?: number }

function playKey(k: string, vol: number, o: PlayOpts = {}): Phaser.Sound.BaseSound | null {
  const m = sm();
  if (!m || !game?.cache.audio.exists(key(k))) return null;
  const s = m.add(key(k), { volume: vol, rate: o.rate ?? 1, delay: o.delay ?? 0, pan: o.x !== undefined && panner ? Phaser.Math.Clamp(panner(o.x), -1, 1) * 0.55 : 0 });
  live.set(k, (live.get(k) ?? 0) + 1);
  s.once(Phaser.Sound.Events.COMPLETE, () => { live.set(k, (live.get(k) ?? 1) - 1); s.destroy(); });
  s.play();
  return s;
}

export const Sound = {
  attach(g: Phaser.Game): void {
    if (game === g) return;
    game = g; lastPlay = new Map(); lastPick = new Map();
    g.events.on(Phaser.Core.Events.STEP, (_t: number, dt: number) => step(dt));
  },

  /** An effect (a family's variation at random, never the same twice in a row, a hair of pitch to keep it alive). Too
   *  many of one family at once, or too soon after the last, and it is let go (a storm of hits stays clean). */
  sfx(name: SfxName, o: PlayOpts = {}): void {
    const [n, base] = SFX[name], now = performance.now();
    if (now - (lastPlay.get(name) ?? -1e9) < (o.at ?? 38) || (live.get(name) ?? 0) >= 4 * n) return;
    lastPlay.set(name, now);
    let i = n > 1 ? 1 + Math.floor(Math.random() * n) : 0;
    if (n > 1 && i === lastPick.get(name)) i = 1 + (i % n);
    lastPick.set(name, i);
    playKey(i ? `${name}_${i}` : name, base * (o.vol ?? 1) * sfxVol(), { ...o, rate: (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.06) });
  },

  /** A fighter locked in on the select screen: the cue with a punch under it, the announcer calling its name. */
  lockIn(cls?: string): void {
    Sound.ui('lock'); playKey('hit_heavy_1', SFX.hit_heavy[1] * 0.55 * sfxVol(), { rate: 0.92 });
    if (cls && (MENU_VOICE as readonly string[]).includes(cls)) Sound.voice(cls as VoiceLine, 120);
  },
  /** Both locked in: GET READY. */
  getReady(): void { playKey('round_swoosh', SFX.round_swoosh[1] * sfxVol()); Sound.voice('get_ready', 700); },

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

  /** The music dips for a while (a K.O.). */
  duck(ms: number, level = 0.3): void { duckUntil = performance.now() + ms; duckLevel = level; },

  /** Leaving the arena: its ambience and music fade (the select screen, if that is next, brings its own back in). */
  leaveArena(): void { Sound.ambience(null, 700); wantMusic = null; channel(chMusic, null, 900); voiceSnd?.stop(); setPanner(null); },
};

let voiceSnd: Phaser.Sound.BaseSound | null = null;
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
