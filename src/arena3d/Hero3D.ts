// THE 3D HERO (David 24 Oct: heroes in 3D on a skeleton, so clothes and items can be changed; then "a BEGINNER whose
// ITEMS are the classes' weapons — the magic staff, the bow, the sword, the gambler's cane, the samurai sword — the
// rest of the clothes simple and the same; clothing sets later"). Behind ?hero3d=1 only; the game is untouched without it.
// The Beginner: drawn by GPT from the painted Beginner (front, back and both sides), its shape made from the front
// view (Hunyuan3D 2.1), the four views baked onto it, the skeleton fitted into it and the weights carried over from a
// base body (tools/hero3d/ai: prep, bake, rigfit; public/assets/hero3d/PROVENANCE.md).
// The moves: Quaternius Universal Animation Library 1 + 2 (CC0), laid onto this body's own bones by name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Motion } from '../skills/ArcherMotion';
import { finalSkill } from '../skills/FinalKit';
import { Wear3D, type WearHost } from './Wear3D';
import { ITEM3D, SLOTS3D, type Equip3D, type Item3D, type Slot3D } from './items3d';

export { Doubles3D } from './Doubles3D'; // (loaded with the hero: three.js stays out of the game until a 3D place opens)

const DIR = 'assets/hero3d/';
/** The Beginner, man and woman (the player's choice in the character's creation). */
const MODEL = { m: 'beginner_m.glb', f: 'beginner_f.glb' };
const MOVES = ['moves_1.glb', 'moves_2.glb', 'moves_3.glb', 'moves_4.glb'];
/** Moves cut out of the library's longer ones (clip, from, to: seconds) — a skill's own part of them: the heavy combo's
 *  overhead smash into the floor, its sword raised to the sky, its rising chain; the first cut's rising end (held up: the
 *  dragon rising from the blade); the dash's crouch before it (Sheathe's stance), its thrust and its pointing blade (held:
 *  Rotor Staff's arm out); the bend that drives the blade into the floor; the kneel that traces the ground. A name
 *  starting with 'Hold_' keeps its last pose as long as the skill lasts (the sword held up to the sky). */
const SUBCLIPS: Record<string, [string, number, number]> = {
  W_Smash: ['Sword_Heavy_Combo', 2.26, 3.6], Hold_Raise: ['Sword_Heavy_Combo', 2.26, 2.46],
  W_SkyChain: ['Sword_Heavy_Combo', 0.9, 3.1], W_Thrust: ['Sword_Dash', 0.1, 1.4], W_Point: ['Sword_Dash', 0.35, 0.95],
  W_Plunge: ['Farm_Harvest', 0.2, 1.6], W_Trace: ['Farm_PlantSeed', 0.2, 2.2],
  Hold_Point: ['Sword_Dash', 0.35, 0.95], S_Rise: ['Sword_Regular_A', 0.18, 0.43], Hold_Rise: ['Sword_Regular_A', 0.18, 0.43], Hold_Crouch: ['Sword_Dash', 0.0, 0.25],
};
/** The bow's shots (the library has none), each drawn from a stance: [name, the stance (a library move and the second
 *  it is taken at; none: standing straight), the aim (radians above level)] — the plain shot; down at the floor in front
 *  (an arrow into the ground); up at the sky (a volley the sky pours back); in a leap, the legs drawn up (level, down at
 *  the foes below, up at the sky); kneeling low (a band along the floor); the deep stance of a long charge. */
const BOW_SHOTS: [string, [string, number] | null, number][] = [
  ['Bow_Shoot', null, 0], ['Bow_Shoot_Down', null, -0.5], ['Bow_Shoot_Up', null, 0.95],
  ['Bow_Shoot_Air', ['Jump_Loop', 0.1], 0], ['Bow_Shoot_AirDown', ['Jump_Loop', 0.1], -0.6], ['Bow_Shoot_AirUp', ['Jump_Loop', 0.1], 0.85],
  ['Bow_Shoot_Kneel', ['Crouch_Idle_Loop', 0.1], -0.12], ['Bow_Shoot_Deep', ['Sword_Idle', 0.3], 0.06],
];
const BOW_PITCH: Record<string, number> = Object.fromEntries(BOW_SHOTS.map(([n, , a]) => [n, a]));
/** A skill's beat (ms): when its move's blow falls into the cast (an arrow loosed, dice rolled off the hand) — instead of
 *  the middle of its active part — then how often the move is played again while it lasts (a volley drawn as often as it
 *  looses, a flurry of jabs; 0: once, then the stance it holds). */
const BEAT: Record<string, [number, number]> = {
  skyhunters_step: [320, 300], rain_of_arrows: [900, 150], sky_rain: [800, 300], arrow_storm: [550, 0], dice_bomb: [300, 0], staff_flurry: [260, 600],
};
/** Skills whose weapon is out of the hand a while (ms into the active part, from → to; the skill's effect stands for it):
 *  Rotor Staff's propeller (its spinning disc is the cane — back in the hand for the last blow, the thrust at 1440 ms). */
const ARM_AWAY: Record<string, [number, number]> = { rotor_staff: [0, 1400] };
/** The arm's holds when the weapon is not swung (makeHolds), each on the library stance it is found on: the way the
 *  weapon points (out from the hand's side, up, forward), where the grip goes from the stance's own (out, up, forward, m)
 *  and how far from there it may go. A blade hangs, its point down and forward and a little out (standing, walking), and
 *  in the guard points forward and up at the foe; the staff stands upright held out before the hip, gripped high on its
 *  shaft so that its foot is at the floor (`floor`); the cane upright at the side, its foot a little out; the bow upright
 *  at the side. */
const HOLDS: { name: string; side: 'r' | 'l'; at: [string, number]; way: [number, number, number]; shift: [number, number, number]; room: number; floor?: boolean }[] = [
  { name: 'blade:idle', side: 'r', at: ['Idle_Loop', 0.5], way: [0.14, -0.72, 0.68], shift: [0.02, 0, -0.02], room: 0.1 },
  { name: 'blade:guard', side: 'r', at: ['Sword_Idle', 0.3], way: [0, 0.6, 0.8], shift: [0, 0, 0], room: 0.08 },
  { name: 'staff:idle', side: 'r', at: ['Idle_Loop', 0.5], way: [0.04, 1, 0.1], shift: [0.08, 0.22, 0.36], room: 0.05, floor: true },
  { name: 'staff:side', side: 'r', at: ['Idle_Loop', 0.5], way: [0.14, 1, 0.02], shift: [0.2, 0.2, 0.06], room: 0.06, floor: true }, // (the menus' pedestal, seen from the front: beside the hero, its head clear of the face)
  { name: 'staff:spell', side: 'r', at: ['Spell_Simple_Idle_Loop', 0.5], way: [0, 1, 0.08], shift: [0, 0.1, 0.1], room: 0.08, floor: true },
  { name: 'cane:idle', side: 'r', at: ['Idle_Loop', 0.5], way: [-0.12, 1, -0.12], shift: [0.03, 0.12, 0.08], room: 0.06 },
  { name: 'cane:alert', side: 'r', at: ['Sword_Idle', 0.3], way: [0, 1, 0.1], shift: [0, 0.08, 0.06], room: 0.08 },
  { name: 'bow:idle', side: 'l', at: ['Idle_Loop', 0.5], way: [0, 1, 0.12], shift: [0.03, 0.2, 0.16], room: 0.05 },
  { name: 'bow:alert', side: 'l', at: ['Sword_Idle', 0.3], way: [0, 1, 0.12], shift: [0, 0.08, 0.06], room: 0.08 },
];
/** Which hold the weapon's arm takes in a move (none: the move's own). */
function holdFor(w: WeaponId, clip: string, front = false): string {
  const idle = /^(Idle_Loop|Walk_Loop)$/.test(clip), free = /^(Seize|Flip_Coin|Roll_Dice|Flick|Throw_L|Idle_Talking|Kick_Flip)/.test(clip);
  if (w === 'staff' && front && idle) return 'staff:side';
  if (w === 'sword' || w === 'katana') return idle ? 'blade:idle' : clip === 'Sword_Idle' ? 'blade:guard' : '';
  if (w === 'staff') return idle || free ? 'staff:idle' : clip === 'Spell_Simple_Idle_Loop' || clip === 'Sword_Idle' ? 'staff:spell' : '';
  return idle || free && clip !== 'Kick_Flip' ? `${w}:idle` : clip === 'Sword_Idle' || clip === 'Kick_Flip' ? `${w}:alert` : '';
}

/** A part of a move (from → to), every bone's turn sampled at both ends (a bone still between keys keeps its pose). */
function cutClip(src: THREE.AnimationClip, name: string, a: number, b: number): THREE.AnimationClip {
  const tracks = src.tracks.map((t) => {
    const it = t.createInterpolant(), n = t.getValueSize(), times: number[] = [], vals: number[] = [];
    const at = (tm: number) => { const v = it.evaluate(tm); times.push(tm - a); for (let i = 0; i < n; i++) vals.push(v[i]); };
    at(a); for (const tm of t.times) if (tm > a + 1e-4 && tm < b - 1e-4) at(tm); at(b);
    return new (t.constructor as new (n: string, t: number[], v: number[]) => THREE.KeyframeTrack)(t.name, times, vals);
  });
  return new THREE.AnimationClip(name, b - a, tracks);
}

/** The Beginner's items: the classes' weapons (one in hand at a time), each drawn by GPT and made solid from the
 *  drawing (tools/hero3d/weapons). `hand`: the hand that holds it; `loose`: how it is held standing or walking — 'hang'
 *  (a sword's point down and forward) or 'upright' (a staff, the cane, the bow: standing up at the side). */
export const WEAPONS = {
  sword: { name: 'SWORD', file: 'w_sword.glb', hand: 'r', loose: 'hang', girth: 1.25 },
  katana: { name: 'KATANA', file: 'w_katana.glb', hand: 'r', loose: 'hang', girth: 1.25 },
  bow: { name: 'BOW', file: 'w_bow.glb', hand: 'l', loose: 'upright', girth: 1.5 },
  staff: { name: 'STAFF', file: 'w_staff.glb', hand: 'r', loose: 'upright', girth: 1.7 },
  cane: { name: 'CANE', file: 'w_cane.glb', hand: 'r', loose: 'upright', girth: 2.1 },
} as const;
// (`girth`: the weapon drawn thicker than true across its length — at the fight's distance a true cane is a pixel and a
// half wide and vanishes against the trousers; game weapons read by their bulk)
export type WeaponId = keyof typeof WEAPONS;
/** Each class's weapon. */
export const CLASS_WEAPON: Record<string, WeaponId> = { warrior: 'sword', samurai: 'katana', archer: 'bow', book_mage: 'staff', gambler: 'cane' };

/** Each class skill's own move (a chain: one per stage) — a library move, a part cut out of a longer one (SUBCLIPS) or one
 *  built here on the skeleton (makeBowShoot: the bow's shots, the kick into a back flip, the call to the sky, the free
 *  hand's seize, flick, backhand throw, coin flip and roll, the vault's double kick). Unlisted: by the weapon. */
const SKILL_MOVE: Record<string, string | string[]> = {
  // warrior
  warrior_basic: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'], dash_slash: 'Sword_Dash_RM', rising_slash: 'Sword_Regular_C', ground_breaker: 'W_Smash',
  whirlwind: 'Sword_Regular_Combo', sanctuary: 'W_Trace', blade_storm: 'Hold_Raise', titans_verdict: 'Hold_Raise', leap_crash: 'W_Smash', wave_slash: 'Sword_Regular_A',
  lance_thrust: 'W_Thrust', war_cry: 'Hold_Raise', judgment_blade: 'OverhandThrow', thunder_circle: 'W_Plunge', judgment_hook: 'Melee_Hook', sky_breaker: 'W_SkyChain',
  earthsplitter: 'W_Smash', shield_charge: 'Idle_FoldArms_Loop', lions_maw: 'W_Point',
  // book mage
  arcane_bolt: ['Spell_Simple_Shoot', 'Spell_Simple_Shoot', 'W_Point'], arcane_wave: 'Sword_Regular_C', binding_rune: 'W_Trace', astral_burst: 'Seize', frost_nova: 'W_Plunge',
  lightning_chain: 'W_Point', storm_field: 'Hold_Raise', time_collapse: 'Hold_Call', blink: 'NinjaJump_Start', glacial_spikes: 'W_Smash', levity_field: 'Hold_Rise',
  origami_flock: 'Throw_L', arcane_ward: 'Sword_Block', paper_curse: 'Spell_Simple_Shoot', elemental_ascension: 'Idle_Shield_Break', rift_gates: 'Fixing_Kneeling', tempest_ride: 'NinjaJump_Idle_Loop',
  // archer
  quick_shot: 'Bow_Shoot', rising_arrow: 'Bow_Shoot_Down', bow_haste: 'Bow_Shoot_AirDown', multi_shot: 'Bow_Shoot', explosive_arrow: 'Bow_Shoot', backstep_shot: 'Bow_Shoot_Air',
  retreat_kick: 'Kick_Flip', vine_trap: 'Fixing_Kneeling', skyhunters_step: 'Bow_Shoot_AirDown', rain_of_arrows: 'Bow_Shoot_Air', piercing_arrow: 'Bow_Shoot', hunters_roar: 'Idle_Shield_Break',
  leaping_arrow: 'Bow_Shoot_Kneel', spirit_hawk: 'Hold_Call', sky_rain: 'Bow_Shoot_AirUp', tree_of_life: 'W_Trace', hunters_spirit: 'Bow_Shoot', arrow_storm: 'Bow_Shoot_Up', eagle_arrow: 'Bow_Shoot_Deep',
  // samurai
  quick_slash: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'S_Rise'], shadow_step: 'Sword_Dash_RM', sheathe: 'Hold_Crouch', iai_strike: 'W_Thrust', sword_wave: 'Sword_Regular_C',
  mirage: 'Sword_Block', blossom_storm: 'Sword_Regular_Combo', dragon_eclipse: 'Sword_Attack', swallow_cut: 'Sword_Regular_C', hundred_cuts: 'Sword_Regular_Combo', kagemusha: 'Idle_Shield_Break',
  tornado_blade: 'Sword_Regular_Combo', falcon_dive: 'W_Smash', rising_sun: 'Hold_Raise', phantom_blades: 'Sword_Regular_A', god_of_blades: 'Idle_FoldArms_Loop', sakura_bind: 'W_Trace',
  dragon_ascension: 'Hold_Rise',
  // gambler
  cut_the_deck: ['W_Point', 'Sword_Regular_B', 'Flick', 'S_Rise'], charged_deal: 'Throw_L', staff_vault: 'Vault_Kick', fuse_slam: 'W_Smash', riffle_shuffle: 'Idle_Talking_Loop',
  rotor_staff: 'Hold_Point', showdown: 'Throw_L', coin_flip: 'Flip_Coin', roulette_wheel: 'Spell_Simple_Shoot', dice_bomb: 'Roll_Dice', light_staff: 'Idle_Shield_Break',
  ace_in_the_hole: 'Throw_L', long_guard: 'Sword_Block', pickup_52: 'Roll_Dice', grand_slam: 'Sword_Regular_C', staff_flurry: 'Sword_Regular_Combo', card_swap: 'Flick', call_the_deck: 'Throw_L',
  jackpot: 'Hold_Call',
};

/** The skills whose body turns round and round through its active part (turns a second): Whirlwind's six heavy turns,
 *  Tornado Blade's whirl in the air, the mage riding his tornado. */
const SPIN: Record<string, number> = { whirlwind: 1000 / 260, tornado_blade: 3 / 0.33, tempest_ride: 1.4 };

/** What the body is doing (the scene's own state, read each frame). */
export interface HeroDrive {
  x: number; y: number; z: number; vx: number; vy: number; grounded: boolean; vz: number;
  /** -1 left, 1 right */ face: number;
  /** A fixed turn (radians, 0: facing the viewer) instead of the fighter's side view (the menus' pedestal). */
  yaw?: number;
  /** the scene's body mode: idle, alert (the guard held after a blow), walk, run, air, takeoff, land, hurt, stunned, launched, down, getup, quickrise, skill, backstep, dead */
  mode: string;
  /** the cast in hand: its skill, its stage (a chain), how far in (ms), its timings */
  cast?: { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number; dash: boolean; air: boolean } | null;
}

export class Hero3D {
  /** Its own picture's scene (the arena draws it as a layer of its own, sorted among the bodies). */
  readonly scene = new THREE.Scene();
  /** In world units (1 = 100 game px), on the floor at its feet. */
  readonly root = new THREE.Group();
  /** Its cast shadow: each piece's twin on the same bones, laid flat on the floor away from the sun. */
  private shadows: [THREE.Object3D, THREE.Mesh][] = [];
  private model = new THREE.Group();
  private bones = new Map<string, THREE.Bone>();
  private body: THREE.SkinnedMesh | null = null;
  private mixer!: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationClip>();
  private action: THREE.AnimationAction | null = null;
  private clipNow = '';
  private castKey = '';
  private yaw = Math.PI / 2;
  /** The weapons, each in a holder on its hand's bone; one shown. */
  private weapons = new Map<WeaponId, THREE.Group>();
  /** Each weapon's two ends along its length (its own units): below the grip (-y: a cane's ferrule) and beyond it (+y: a
   *  blade's point, a staff's head). */
  private armEnds = new Map<WeaponId, [number, number]>();
  /** Each fist's grip (fitGrip): where a weapon's grip sits in the hand bone, turned as the closed fist holds it. */
  private grip: Record<'r' | 'l', { q: THREE.Quaternion; p: THREE.Vector3 }> = { r: { q: new THREE.Quaternion(), p: new THREE.Vector3() }, l: { q: new THREE.Quaternion(), p: new THREE.Vector3() } };
  /** The arm's holds at rest (HOLDS, makeHolds): the upper arm's, the forearm's and the hand's turns. */
  private holds = new Map<string, { side: 'r' | 'l'; q: THREE.Quaternion[]; slide: number; info: string; floor?: { py: number; wy: number } }>();
  /** How far the arm is in its hold now (holdQ: the hold it is easing to, on holdSide's arm), and how far an upright
   *  weapon is turned upright by the wrist alone (liftK: through a move of the weapon arm's own). */
  private holdK = 0;
  /** Each hand's fist (its fingers' turns, from the library's grips) and its fingers straight (the body at rest). */
  private fist: Record<'r' | 'l', [THREE.Bone, THREE.Quaternion][]> = { r: [], l: [] };
  private open: Record<'r' | 'l', THREE.Quaternion[]> = { r: [], l: [] };
  /** Each weapon in its fist (fitHand): the fingers closed as far as its grip's thickness lets them, and where its grip
   *  lies in the hand (through the fist's hollow) — a hand holding a weapon is closed on it in every move. */
  private wgrip = new Map<WeaponId, { fist: [THREE.Bone, THREE.Quaternion][]; p: THREE.Vector3; q: THREE.Quaternion; k: number }>();
  /** The bow's string drawn back to the right hand while it aims, and the arrow on it. */
  private bowString: THREE.Line | null = null;
  private bowArrow: THREE.Group | null = null;
  private aimK = 0;
  /** The aim of the shot the bow is in (radians above level): the bow tilted across the arrow. */
  private aimPitch = 0;
  /** Walking while casting (the skills you may walk in — the bolts, the double shot, the storm field, the rotor, the
   *  whirlwind): how far the legs walk instead of standing in the cast's stance, where in the walk they are, and the walk's
   *  leg bones (sampled from the library's walk). */
  private walkK = 0;
  private walkT = 0;
  private legs: { bone: THREE.Bone; it: THREE.Interpolant; pos: boolean }[] | null = null;
  private static lq = new THREE.Quaternion(); private static lv = new THREE.Vector3();
  /** Turning round in a spinning skill this frame (its painted spin, a flip, is then left out). */
  private spinning = false;
  /** A hanging blade turned flat to the viewer, its point down and a little out from the leg (the menus' pedestal faces
   *  the hero: held as in a fight, edge-on to the viewer, a sword reads as a wire). */
  flatToView = false;
  private static tq = new THREE.Quaternion(); private static tm = new THREE.Matrix4();
  weapon: WeaponId = 'sword';
  /** The standing height it is scaled to (units): the painted heroes' 124 world px and a little hair. */
  static HEIGHT = 1.3;

  /** What it wears over the Beginner (items3d): a hat, a cloak, the outfit's dyes, an aura (Wear3D); the weapon item
   *  in its hand (a weapon's own model in its kind's holder: `skins`, the kind's own kept in `baseArm`). */
  wear: Wear3D | null = null;
  worn: Equip3D = {};
  private female = false;
  private baseArm = new Map<WeaponId, { model: THREE.Object3D; ends: [number, number] }>();
  private skins = new Map<WeaponId, string>();
  /** A weapon item's own girth (items3d `girth`, default 1: the items are drawn as thick as they are). */
  private girthOf = new Map<WeaponId, number>();
  private girth(w: WeaponId): number { return this.girthOf.get(w) ?? WEAPONS[w].girth; }
  private static loader: GLTFLoader | null = null;

  /** A twin (clone()): its shape, textures, weapons and moves are its source's — never disposed with it. */
  private shared = false;
  /** What this one made for itself (a twin's own skin material, its shadows', its bowstring's): disposed with it. */
  private own: { dispose(): void }[] = [];

  private constructor() { this.root.rotation.order = 'ZYX'; this.root.add(this.model); this.scene.add(this.root); } // (ZYX: turned to face first, then tipped in the picture's plane — a somersault, a lean)

  static async load(o: { female?: boolean } = {}, onProgress?: (k: number) => void): Promise<Hero3D> {
    const h = new Hero3D(); h.female = !!o.female;
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const ids = Object.keys(WEAPONS) as WeaponId[];
    const files = [o.female ? MODEL.f : MODEL.m, ...MOVES, ...ids.map((w) => WEAPONS[w].file)];
    let done = 0;
    const got = await Promise.all(files.map((f) => loader.loadAsync(DIR + f).then((g) => { onProgress?.(++done / files.length); return g; })));
    const [model, ...rest2] = got, moves = rest2.slice(0, MOVES.length), arms = rest2.slice(MOVES.length);
    // the body and its own skeleton (fitted into it)
    h.model.add(model.scene);
    model.scene.traverse((o) => { if ((o as THREE.Bone).isBone) h.bones.set(o.name, o as THREE.Bone); if ((o as THREE.SkinnedMesh).isSkinnedMesh) h.body = o as THREE.SkinnedMesh; });
    model.scene.updateMatrixWorld(true);
    // the moves: in place (the game moves the body), turning the bones only — the library's bone lengths are its own
    // body's; its hips' travel is laid onto this body's hips, scaled to its height
    const pel = h.bones.get('pelvis')!, rest = pel.position.clone();
    let lib: THREE.Vector3 | null = null; moves[0]?.scene.traverse((o) => { if (o.name === 'pelvis' && !lib) lib = o.position.clone(); });
    const L = (lib as THREE.Vector3 | null) ?? new THREE.Vector3(0, 0.0501, 0.9167), k = rest.z / Math.max(0.1, L.z);
    for (const g of moves) for (const c of g.animations) {
      c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'pelvis.position');
      for (const t of c.tracks) if (t.name === 'pelvis.position') {
        const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = rest.x + (v[i] - L.x) * k; v[i + 1] = rest.y + (v[i + 1] - L.y) * k; v[i + 2] = rest.z + (v[i + 2] - L.z) * k; }
      }
      h.clips.set(c.name, c);
    }
    for (const [name, [clip, a, b]] of Object.entries(SUBCLIPS)) { const src = h.clips.get(clip); if (src) h.clips.set(name, cutClip(src, name, a, Math.min(b, src.duration))); }
    h.mixer = new THREE.AnimationMixer(h.model);
    ids.forEach((w, i) => { const bx = new THREE.Box3().setFromObject(arms[i].scene, true); h.armEnds.set(w, [bx.min.y, bx.max.y]); const g = new THREE.Group(); g.name = 'weapon'; g.add(arms[i].scene); g.visible = false; h.bones.get(`hand_${WEAPONS[w].hand}`)?.add(g); h.weapons.set(w, g); });
    h.look();
    // the size: the painted heroes' standing height, measured on the body as it stands at rest (before any move)
    h.model.updateMatrixWorld(true);
    const box = new THREE.Box3(); if (h.body) box.expandByObject(h.body, true);
    const tall = Math.max(0.5, box.max.y - box.min.y);
    // the fists: the right closed on the sword's grip (the sword stance), the left on the shield's handle (the shield's
    // stance); each weapon held in a fist closed as far as its grip lets it
    h.open.r = h.fingers('r').map(([, q]) => q); h.open.l = h.fingers('l').map(([, q]) => q); // (at rest, straight)
    h.play('Idle_Shield_Loop', { fade: 0 }); h.mixer.update(0.3); h.fist.l = h.fingers('l');
    h.play('Sword_Idle', { fade: 0, restart: true }); h.mixer.update(0.3); h.fist.r = h.fingers('r');
    for (const [b, q] of h.fist.l) b.quaternion.copy(q);
    h.model.updateMatrixWorld(true);
    h.fitGrip('r'); h.fitGrip('l');
    for (const w of ids) h.fitHand(w);
    h.makeBowShoot(); h.makeHolds(); h.makeBowString();
    h.model.scale.setScalar(Hero3D.HEIGHT / tall);
    h.setWeapon('sword');
    if (h.body) h.wear = new Wear3D(h.host());
    return h;
  }

  /** What Wear3D sees of this body. */
  private host(): WearHost {
    const h = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return { scene: this.scene, root: this.root, get body() { return h.body!; }, bones: this.bones, female: this.female, addShadow: (m, both) => this.addShadow(m, both), dropShadow: (m) => this.dropShadow(m) };
  }

  /** Wear an item (items3d) on its slot, or the Beginner's own there (null). A weapon item is its kind's model in hand
   *  whenever that kind is held (the sword's, the bow's…). */
  async equip(slot: Slot3D, id: string | null): Promise<void> {
    const it = id ? ITEM3D[id] ?? null : null;
    if (it && it.slot !== slot) return;
    if (it) this.worn[slot] = it.id; else delete this.worn[slot];
    if (slot === 'weapon') await this.setSkin(it);
    else this.wear?.wear(it, slot);
  }
  /** A whole set at once (the slots it leaves out: the Beginner's own). */
  async equipAll(e: Equip3D): Promise<void> { for (const s of SLOTS3D) await this.equip(s, e[s] ?? null); }

  /** The weapon item's model in its kind's holder (loaded now), the others' kinds back to their own. */
  private async setSkin(it: Item3D | null): Promise<void> {
    for (const k of [...this.skins.keys()]) if (!it || it.weapon !== k) this.swapArm(k, null);
    if (!it?.weapon || !it.file || this.skins.get(it.weapon) === it.file) return;
    const L = (Hero3D.loader ??= (() => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l; })());
    let g: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
    try { g = await L.loadAsync(DIR + it.file); } catch { return; } // (not there: the kind's own stays in hand)
    if (this.worn.weapon !== it.id) { g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); return; } // (another chosen meanwhile)
    this.swapArm(it.weapon, g.scene, it.file, it.girth ?? 1);
  }
  private swapArm(kind: WeaponId, model: THREE.Object3D | null, file?: string, girth = 1): void {
    const g = this.weapons.get(kind), cur = g?.children[0]; if (!g || !cur) return;
    if (!this.baseArm.has(kind)) this.baseArm.set(kind, { model: cur, ends: this.armEnds.get(kind) ?? [0, 1] });
    const base = this.baseArm.get(kind)!;
    if (!model && cur === base.model) return;
    let ends = base.ends;
    if (model) {
      const bx = new THREE.Box3().setFromObject(model, true); ends = [bx.min.y, bx.max.y];
      model.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = true; m.frustumCulled = false;
        for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) if (mt?.isMeshStandardMaterial) { mt.envMapIntensity = 0.6; mt.metalness = Math.min(mt.metalness, 0.15); mt.roughness = Math.max(mt.roughness, 0.55); }
      });
    }
    g.remove(cur);
    if (cur !== base.model) { for (const [m, t] of [...this.shadows]) { let on = false; for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === cur) on = true; if (on) this.dropShadow(m as THREE.Mesh); } cur.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.geometry.dispose(); for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]) { for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); mt.dispose(); } }); }
    const now = model ?? base.model; g.add(now);
    if (model && file) { this.skins.set(kind, file); this.girthOf.set(kind, girth); } else { this.skins.delete(kind); this.girthOf.delete(kind); }
    this.armEnds.set(kind, ends);
    g.updateMatrixWorld(true);
    this.fitHand(kind);
    if (kind === 'bow') { this.bowString?.removeFromParent(); this.bowString?.geometry.dispose(); this.bowString = null; this.makeBowString(); }
    if (kind === 'staff') { // (a staff of another length: slid through the fist till its foot is at the floor again — down for a longer one's)
      const foot = ends[0];
      for (const H of this.holds.values()) if (H.floor) H.slide = model ? Math.max(-0.3, Math.min(0.7, (H.floor.py + H.floor.wy * foot - 0.015) / H.floor.wy)) : Math.max(0, Math.min(0.27, (H.floor.py + H.floor.wy * foot - 0.015) / H.floor.wy));
      this.holdK = 0; // (taken at once)
    }
    if (model && this.shadowMat) model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.Line).isLine) this.addShadow(o as THREE.Mesh); });
    this.setWeapon(this.weapon);
  }

  /** A twin of this body (Kagemusha's doubles): the same shape, textures, weapons and moves — nothing loaded or decoded
   *  again — on a skeleton of its own, doing its own move with its own weapon in hand; its skin's colour wash its own.
   *  Its root can be put into any scene (it is drawn where it is put). */
  clone(): Hero3D {
    const h = new Hero3D(); h.shared = true;
    // the shadows stay out of the copy (it lays its own: makeShadow)
    const tw = this.shadows.map(([, t]) => { const p = t.parent!; p.remove(t); return [p, t] as const; });
    const m = cloneSkinned(this.model) as THREE.Group;
    const A: THREE.Object3D[] = [], B: THREE.Object3D[] = [];
    this.model.traverse((o) => A.push(o)); m.traverse((o) => B.push(o));
    for (const [p, t] of tw) p.add(t);
    const twin = <T extends THREE.Object3D>(o: T): T => B[A.indexOf(o)] as T;
    h.root.remove(h.model); h.model = m; h.root.add(m);
    for (const [n, b] of this.bones) h.bones.set(n, twin(b));
    if (this.body) {
      h.body = twin(this.body);
      const mt = (this.body.material as THREE.MeshStandardMaterial).clone(); mt.emissive.setRGB(0, 0, 0); h.body.material = mt; h.own.push(mt);
    }
    for (const [w, g] of this.weapons) h.weapons.set(w, twin(g));
    h.armEnds = this.armEnds;
    if (this.bowString) {
      const s = twin(this.bowString); s.geometry = s.geometry.clone(); h.own.push(s.geometry);
      s.userData = { tips: (this.bowString.userData.tips as THREE.Vector3[]).map((v) => v.clone()) }; h.bowString = s;
    }
    if (this.bowArrow) h.bowArrow = twin(this.bowArrow);
    h.clips = this.clips;
    h.grip = { r: { q: this.grip.r.q.clone(), p: this.grip.r.p.clone() }, l: { q: this.grip.l.q.clone(), p: this.grip.l.p.clone() } };
    h.fist = { r: this.fist.r.map(([b, q]) => [twin(b), q]), l: this.fist.l.map(([b, q]) => [twin(b), q]) };
    for (const [w, v] of this.wgrip) h.wgrip.set(w, { ...v, fist: v.fist.map(([b, q]) => [twin(b), q]) });
    h.holds = this.holds;
    h.mixer = new THREE.AnimationMixer(h.model);
    h.flatToView = this.flatToView;
    h.setWeapon(this.weapon);
    h.female = this.female;
    if (h.body) { h.wear = new Wear3D(h.host()); const w = { ...this.worn }; delete w.weapon; void h.equipAll(w); } // (its weapon's model: its source's, copied)
    return h;
  }

  /** A hand's fingers as they are posed now. */
  private fingers(side: 'r' | 'l'): [THREE.Bone, THREE.Quaternion][] {
    const out: [THREE.Bone, THREE.Quaternion][] = [];
    for (const [n, b] of this.bones) if (new RegExp(`^(thumb|index|middle|ring|pinky)_0[123]_${side}$`).test(n)) out.push([b, b.quaternion.clone()]);
    return out;
  }
  /** The weapon's hand closed on it (over the move's own fingers). */
  private closeHand(): void { for (const [b, q] of this.wgrip.get(this.weapon)?.fist ?? this.fist[WEAPONS[this.weapon].hand]) b.quaternion.copy(q); }
  /** The weapon's turn in its hand: along the fist's tunnel (the bow turned about it so its string faces the archer:
   *  the hand round the riser has its knuckles toward the target). */
  private armQ(w: WeaponId): THREE.Quaternion {
    const q = (this.wgrip.get(w) ?? this.grip[WEAPONS[w].hand]).q;
    return w === 'bow' ? q.clone().multiply(Hero3D.flipY) : q;
  }
  private static flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  /** Turn a hand (at its wrist) so the weapon it holds lies as `want` (world) — the weapon stays in the fist. */
  private turnHand(hand: THREE.Bone, want: THREE.Quaternion, k: number): void {
    const parent = hand.parent!; parent.updateWorldMatrix(true, false);
    const hw = want.clone().multiply(this.armQ(this.weapon).clone().invert());
    const local = parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hw);
    hand.quaternion.slerp(local, k); hand.updateMatrixWorld(true);
  }

  /** A fist's grip, from the hand's own bones (the bone's own units): the grip through the fingers' second joints, a
   *  weapon's long axis out past the index side, its edge (the drawing's width) toward the knuckles. */
  private fitGrip(side: 'r' | 'l'): void {
    const hand = this.bones.get(`hand_${side}`); if (!hand) return;
    const at = (n: string) => { const b = this.bones.get(`${n}_${side}`); return b ? hand.worldToLocal(b.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(); };
    const i1 = at('index_01'), p1 = at('pinky_01'), i2 = at('index_02'), p2 = at('pinky_02'), m1 = at('middle_01');
    const y = i1.clone().add(i2).sub(p1).sub(p2).normalize();
    const x = m1.clone().normalize(); x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const g = this.grip[side];
    g.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    g.p.copy(i2.clone().add(p2).multiplyScalar(0.5).lerp(i1.clone().add(p1).multiplyScalar(0.5), 0.35));
  }

  /** A weapon in its fist: the fingers closed from straight toward the fist until their hollow is the weapon's grip
   *  (its thickness round the grip, with its girth), the fingers on its surface — a thick staff or cane in a hand half
   *  open round it, a hilt in a closed fist; the grip laid through the hollow's middle, along it. (The hollow: a circle
   *  through each finger's joints, across the knuckles' line; the fingers' own thickness, the body's, inside it.) */
  private fitHand(w: WeaponId): void {
    const side = WEAPONS[w].hand, hand = this.bones.get(`hand_${side}`), g = this.weapons.get(w), root = g?.children[0];
    if (!hand || !root || this.fist[side].length !== this.open[side].length) return;
    // the grip's thickness: its surface's distance from its length near the grip
    const ds: number[] = [], girth = this.girth(w), v = new THREE.Vector3(); g!.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || /String/.test((m.material as THREE.Material).name)) return;
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { root.worldToLocal(m.localToWorld(v.fromBufferAttribute(p, i))); if (Math.abs(v.y) < 0.03) ds.push(Math.hypot(v.x * girth, v.z * girth)); }
    });
    ds.sort((a, b) => a - b);
    const r = ds.length ? ds[Math.floor(ds.length * 0.75)] : 0.015, thick = this.fingerThick(side);
    const at = (n: string) => hand.worldToLocal(this.bones.get(`${n}_${side}`)!.getWorldPosition(new THREE.Vector3()));
    const tunnel = (k: number) => {
      this.fist[side].forEach(([b, q], i) => b.quaternion.copy(this.open[side][i]).slerp(q, k)); hand.updateMatrixWorld(true);
      const kz = at('index_01').sub(at('pinky_01')).normalize(), u = at('middle_01').addScaledVector(kz, 0).normalize(); u.addScaledVector(kz, -u.dot(kz)).normalize();
      const vv = new THREE.Vector3().crossVectors(kz, u), cs: THREE.Vector3[] = []; let R = 0;
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        const pts = ['01', '02', '03', '04_leaf'].map((j) => at(`${f}_${j}`));
        // a circle through the joints (least squares: x² + y² + Dx + Ey + F = 0)
        const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0]; let along = 0;
        for (const p of pts) { const x = p.dot(u), y = p.dot(vv), row = [x, y, 1], z = -(x * x + y * y); along += p.dot(kz) / pts.length; for (let i = 0; i < 3; i++) { b[i] += row[i] * z; for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j]; } }
        const det = (M: number[][]) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
        const d0 = det(A); if (Math.abs(d0) < 1e-14) continue;
        const sol = [0, 1, 2].map((c) => det(A.map((row, i) => row.map((x, j) => (j === c ? b[i] : x)))) / d0);
        const cx = -sol[0] / 2, cy = -sol[1] / 2; R += Math.sqrt(Math.max(0, cx * cx + cy * cy - sol[2])) / 4;
        cs.push(u.clone().multiplyScalar(cx).addScaledVector(vv, cy).addScaledVector(kz, along));
      }
      return { R, cs };
    };
    let lo = 0.3, hi = 1, k = 1;
    if (tunnel(1).R - thick < r + 0.0015) { for (let i = 0; i < 18; i++) { k = (lo + hi) / 2; if (tunnel(k).R - thick > r + 0.0015) lo = k; else hi = k; } k = lo; }
    const t = tunnel(k); if (t.cs.length < 4) return;
    const p = t.cs.reduce((a, c) => a.add(c), new THREE.Vector3()).multiplyScalar(1 / t.cs.length);
    const y = t.cs[0].clone().sub(t.cs[3]).normalize(), x = at('middle_01').normalize(); x.addScaledVector(y, -x.dot(y)).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)));
    this.wgrip.set(w, { fist: this.fist[side].map(([b], i) => [b, this.open[side][i].clone().slerp(this.fist[side][i][1], k)]), p, q, k });
    for (const [b, q0] of this.fist[side]) b.quaternion.copy(q0); hand.updateMatrixWorld(true);
  }
  /** A finger's half thickness (this body's: its middle finger's skin round its bone, at rest). */
  private fingerThick(side: 'r' | 'l'): number {
    const sk = this.body?.skeleton, geo = this.body?.geometry; if (!sk || !geo) return 0.009;
    const i2 = sk.bones.findIndex((b) => b.name === `middle_02_${side}`), i3 = sk.bones.findIndex((b) => b.name === `middle_03_${side}`); if (i2 < 0 || i3 < 0) return 0.009;
    const bp = (i: number) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
    const A = bp(i2), ab = bp(i3).sub(A), L = ab.length(); ab.normalize();
    const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, ds: number[] = [], v = new THREE.Vector3();
    const comp = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number, c: number) => (c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i));
    for (let i = 0; i < pos.count; i++) {
      let best = -1, bw = 0; for (let c = 0; c < 4; c++) { const wt = comp(sw, i, c); if (wt > bw) { bw = wt; best = comp(si, i, c); } }
      if (best !== i2) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(this.body!.bindMatrix).sub(A); const t = v.dot(ab); if (t < 0.2 * L || t > 0.8 * L) continue;
      ds.push(v.addScaledVector(ab, -t).length());
    }
    ds.sort((a, b) => a - b);
    return ds.length > 5 ? ds[Math.floor(ds.length / 2)] : 0.009;
  }

  /** The moves no library has, built on this body's own skeleton — each arm and leg reached where it goes through its own
   *  two bones. The bow's shots (BOW_SHOTS): from the stance, the chest turned side-on and leaning with the aim, the bow
   *  arm straight out along it and the string hand drawn back to the cheek, then the loose (the string hand flies back)
   *  and home again. The rising kick that turns into a back flip (Retreat Kick: the leg swung high, then both drawn up to
   *  the chest while the motion layer turns her over, then the landing). The call to the sky (the weapon hand raised high
   *  and held: Spirit Hawk, Time Collapse, Jackpot). The free hand's moves (Astral Burst's seize, a flicked card, cards
   *  thrown backhand, the coin flip, an underhand roll) and the vault's double kick. */
  private makeBowShoot(): void {
    const B = (n: string) => this.bones.get(n)!;
    if (!B('upperarm_l') || !B('spine_03') || !B('thigh_r')) return;
    const all = [...this.bones.values()], pel = B('pelvis');
    const snap = () => all.map((b) => b.quaternion.clone());
    const put = (qs: THREE.Quaternion[], p: THREE.Vector3) => { all.forEach((b, i) => b.quaternion.copy(qs[i])); pel.position.copy(p); this.model.updateMatrixWorld(true); };
    const wq = (b: THREE.Object3D) => b.getWorldQuaternion(new THREE.Quaternion()), wp = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
    // turn a bone by a world rotation
    const turn = (b: THREE.Bone, q: THREE.Quaternion) => { const pq = wq(b.parent!); b.quaternion.copy(pq.clone().invert().multiply(q).multiply(wq(b))); b.updateMatrixWorld(true); };
    // reach a two-bone limb's end to a target, its middle joint towards a pole
    const reach = (up: string, lo: string, end: string, T: THREE.Vector3, pole: THREE.Vector3) => {
      const ua = B(up), la = B(lo), hd = B(end);
      const S = wp(ua), E = wp(la), H = wp(hd), a = S.distanceTo(E), b = E.distanceTo(H);
      const d = Math.min(a + b - 1e-3, Math.max(0.05, S.distanceTo(T)));
      const u = T.clone().sub(S).normalize(), v = pole.clone().sub(S); v.addScaledVector(u, -v.dot(u)).normalize();
      const cA = (a * a + d * d - b * b) / (2 * a * d), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
      const E2 = S.clone().addScaledVector(u, a * cA).addScaledVector(v, a * sA);
      turn(ua, new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()));
      const E3 = wp(la), H3 = wp(hd);
      turn(la, new THREE.Quaternion().setFromUnitVectors(H3.clone().sub(E3).normalize(), T.clone().sub(E3).normalize()));
    };
    const arm = (side: 'l' | 'r', T: THREE.Vector3, pole: THREE.Vector3) => reach(`upperarm_${side}`, `lowerarm_${side}`, `hand_${side}`, T, pole);
    const leg = (side: 'l' | 'r', T: THREE.Vector3, pole: THREE.Vector3) => reach(`thigh_${side}`, `calf_${side}`, `foot_${side}`, T, pole);
    // the stances: a library move held at a moment (the body standing straight: its rest — the moves are stopped)
    this.mixer.stopAllAction(); this.action = null; this.clipNow = '';
    this.model.updateMatrixWorld(true);
    const rest: [THREE.Quaternion[], THREE.Vector3] = [snap(), pel.position.clone()];
    const stance = (st: [string, number] | null): [THREE.Quaternion[], THREE.Vector3] => {
      if (!st || !this.clips.has(st[0])) return rest;
      this.play(st[0], { fade: 0, restart: true }); this.mixer.update(st[1]); this.model.updateMatrixWorld(true);
      const got: [THREE.Quaternion[], THREE.Vector3] = [snap(), pel.position.clone()];
      this.mixer.stopAllAction(); this.action = null; this.clipNow = '';
      return got;
    };
    const clip = (name: string, len: number, keys: [number, THREE.Quaternion[], THREE.Vector3][]) => {
      const tracks: THREE.KeyframeTrack[] = all.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, keys.map((k) => k[0]), keys.flatMap((k) => k[1][i].toArray())));
      tracks.push(new THREE.VectorKeyframeTrack(`${pel.name}.position`, keys.map((k) => k[0]), keys.flatMap((k) => k[2].toArray())));
      this.clips.set(name, new THREE.AnimationClip(name, len, tracks));
    };
    const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
    for (const [name, st, aim] of BOW_SHOTS) {
      const [base, bp] = stance(st);
      const pose = (draw: number): [THREE.Quaternion[], THREE.Vector3] => {
        put(base, bp);
        const k = Math.min(1, draw);
        const twist = new THREE.Quaternion().setFromAxisAngle(Y, -0.32 * draw), lean = new THREE.Quaternion().setFromAxisAngle(X, -0.11 * aim * k);
        turn(B('spine_02'), twist); turn(B('spine_03'), twist); turn(B('spine_02'), lean); turn(B('spine_03'), lean);
        const sl = wp(B('upperarm_l')), sr = wp(B('upperarm_r')), head = wp(B('Head'));
        // the bow hand: out along the aim, from the shoulder
        arm('l', sl.clone().add(new THREE.Vector3(0.06, 0.02 + 0.56 * Math.sin(aim * k), 0.56 * Math.cos(aim * k))), sl.clone().add(new THREE.Vector3(0.5, -0.3, 0)));
        // the string hand: by the cheek (drawn), from the bow forward when only nocking
        const cheek = head.clone().add(new THREE.Vector3(-0.07, -0.08, 0.06));
        const nock = sl.clone().add(new THREE.Vector3(-0.12, 0.3 * Math.sin(aim * k), 0.3 * Math.cos(aim * k)));
        arm('r', nock.lerp(cheek, k).add(new THREE.Vector3(-0.05, 0, -0.05).multiplyScalar(Math.max(0, draw - 1) * 4)), sr.clone().add(new THREE.Vector3(-0.4, 0.1, -0.5)));
        return [snap(), bp];
      };
      clip(name, 0.95, [[0, base, bp], [0.22, ...pose(0.35)], [0.5, ...pose(1)], [0.6, ...pose(1)], [0.66, ...pose(1.25)], [0.95, base, bp]]);
    }
    // Retreat Kick (110 / 420 / 200 ms, at its own pace): the knee chambered, the rising kick, both legs drawn up for the
    // flip, the landing
    {
      const [base, bp] = stance(['Sword_Idle', 0.3]);
      const kp = (o: { kick?: 'chamber' | 'top'; tuck?: boolean; lean?: number }): [THREE.Quaternion[], THREE.Vector3] => {
        put(base, bp);
        if (o.lean) turn(B('spine_01'), new THREE.Quaternion().setFromAxisAngle(X, -o.lean)); // (leaning back from the kick)
        const hr = wp(B('thigh_r')), hl = wp(B('thigh_l'));
        // the right leg: chambered (the knee up, the foot under it), then swung up in front, straight
        if (o.kick === 'chamber') leg('r', hr.clone().add(new THREE.Vector3(0, -0.3, 0.38)), hr.clone().add(new THREE.Vector3(0, 0.3, 1)));
        if (o.kick === 'top') leg('r', hr.clone().add(new THREE.Vector3(0, 0.4, 0.86)), hr.clone().add(new THREE.Vector3(0, 0.6, 0.5)));
        if (o.tuck) for (const [side, h] of [['r', hr], ['l', hl]] as ['r' | 'l', THREE.Vector3][]) // knees to the chest
          leg(side, h.clone().add(new THREE.Vector3(0, -0.23, 0.3)), h.clone().add(new THREE.Vector3(0, 0.5, 0.9)));
        return [snap(), bp];
      };
      const k0 = kp({}), chamber = kp({ kick: 'chamber', lean: 0.12 }), top = kp({ kick: 'top', lean: 0.3 }), tuck = kp({ tuck: true });
      clip('Kick_Flip', 0.73, [[0, ...k0], [0.09, ...chamber], [0.17, ...top], [0.25, ...top], [0.33, ...tuck], [0.53, ...tuck], [0.66, ...k0], [0.73, ...k0]]);
    }
    // the right hand raised to the sky and held (a 'Hold_' move keeps its last pose): the archer's free hand calling her
    // hawk, the mage's staff and the gambler's cane held high
    {
      const [base, bp] = stance(['Idle_Loop', 0.2]);
      const cp = (up: number): [THREE.Quaternion[], THREE.Vector3] => {
        put(base, bp);
        const sr = wp(B('upperarm_r'));
        arm('r', sr.clone().add(new THREE.Vector3(-0.1 + 0.08 * up, -0.2 + 0.85 * up, 0.25 - 0.1 * up)), sr.clone().add(new THREE.Vector3(-0.6, 0, 0.2)));
        return [snap(), bp];
      };
      clip('Hold_Call', 0.4, [[0, ...cp(0)], [0.18, ...cp(0.55)], [0.32, ...cp(1)], [0.4, ...cp(1)]]);
    }
    // the free (left) hand's moves, from the relaxed stance — each a list of the hand's places from the shoulder (the
    // shoulder's own +x is the left, +z forward), its elbow's way out, and a bend of the back
    const lefty = (name: string, len: number, keys: [number, [number, number, number] | null, [number, number, number], number][]) => {
      const [base, bp] = stance(['Idle_Loop', 0.2]);
      clip(name, len, keys.map(([t, at, pole, bend]): [number, THREE.Quaternion[], THREE.Vector3] => {
        put(base, bp);
        if (bend) { const q = new THREE.Quaternion().setFromAxisAngle(X, bend * 0.5); turn(B('spine_01'), q); turn(B('spine_02'), q); }
        if (at) { const sl = wp(B('upperarm_l')); arm('l', sl.clone().add(new THREE.Vector3(...at)), sl.clone().add(new THREE.Vector3(...pole))); }
        return [t, snap(), bp];
      }));
    };
    // Astral Burst: the hand thrown out at the foe, seizing, drawn back to the chest, then flung up
    lefty('Seize', 0.54, [[0, null, [0, 0, 0], 0], [0.12, [0.05, 0.05, 0.62], [0.5, -0.3, 0], 0.08], [0.2, [0.05, 0.02, 0.6], [0.5, -0.3, 0], 0.08],
      [0.32, [-0.05, -0.08, 0.2], [0.4, -0.4, -0.4], -0.06], [0.42, [0.05, 0.58, 0.3], [0.5, 0, 0], -0.1], [0.54, null, [0, 0, 0], 0]]);
    // Coin Flip: the coin on the thumb before the chest, flicked up, the hand opening after it
    lefty('Flip_Coin', 0.74, [[0, null, [0, 0, 0], 0], [0.25, [-0.12, -0.2, 0.3], [0.4, -0.4, -0.2], 0], [0.42, [-0.12, -0.18, 0.3], [0.4, -0.4, -0.2], 0],
      [0.48, [-0.1, 0.06, 0.36], [0.4, -0.3, -0.2], -0.04], [0.6, [-0.05, 0.26, 0.36], [0.5, -0.2, 0], -0.06], [0.74, null, [0, 0, 0], 0]]);
    // Dice Bomb: an underhand roll — the hand swung back past the hip, bent low, the dice let go along the floor, the follow-through
    lefty('Roll_Dice', 0.6, [[0, null, [0, 0, 0], 0], [0.18, [0.12, -0.5, -0.25], [0.4, 0, -0.3], 0.15], [0.3, [0.05, -0.72, 0.45], [0.4, 0, 0.2], 0.38],
      [0.42, [0.05, -0.35, 0.58], [0.4, -0.2, 0.2], 0.25], [0.6, null, [0, 0, 0], 0]]);
    // a card flicked off the fingers: the hand cocked at the chest, snapped out at the foe
    lefty('Flick', 0.36, [[0, null, [0, 0, 0], 0], [0.1, [-0.12, -0.12, 0.12], [0.45, -0.2, -0.2], 0], [0.18, [0.05, 0, 0.6], [0.5, -0.3, 0], 0.06], [0.26, [0.05, -0.02, 0.58], [0.5, -0.3, 0], 0.04], [0.36, null, [0, 0, 0], 0]]);
    // cards thrown backhand like a saw blade (a fan of cards, a great ace, the deck fused in one): cocked across the chest,
    // swept out at the foe, the follow-through out to the side
    lefty('Throw_L', 0.62, [[0, null, [0, 0, 0], 0], [0.22, [-0.32, -0.05, 0.12], [0.3, 0.1, -0.3], -0.05], [0.3, [-0.33, -0.04, 0.1], [0.3, 0.1, -0.3], -0.06],
      [0.38, [0.12, 0, 0.56], [0.5, -0.2, 0], 0.14], [0.48, [0.36, -0.06, 0.34], [0.6, -0.3, 0], 0.1], [0.62, null, [0, 0, 0], 0]]);
    // Staff Vault: drawn up over the planted staff, then the double kick on the way down — both legs straight out in front
    {
      const [base, bp] = stance(['Sword_Idle', 0.3]);
      const vp = (o: { tuck?: boolean; kick?: boolean }): [THREE.Quaternion[], THREE.Vector3] => {
        put(base, bp);
        if (o.kick) turn(B('spine_01'), new THREE.Quaternion().setFromAxisAngle(X, -0.35));
        for (const side of ['r', 'l'] as const) {
          const h = wp(B(`thigh_${side}`));
          if (o.tuck) leg(side, h.clone().add(new THREE.Vector3(0, -0.23, 0.3)), h.clone().add(new THREE.Vector3(0, 0.5, 0.9)));
          if (o.kick) leg(side, h.clone().add(new THREE.Vector3(0, -0.12, 0.95)), h.clone().add(new THREE.Vector3(0, 0.6, 0.5)));
        }
        return [snap(), bp];
      };
      const v0 = vp({}), tuck = vp({ tuck: true }), kick = vp({ kick: true });
      clip('Vault_Kick', 0.66, [[0, ...v0], [0.1, ...tuck], [0.3, ...tuck], [0.4, ...kick], [0.48, ...kick], [0.6, ...v0], [0.66, ...v0]]);
    }
    put(...rest);
  }

  /** The bow's string as a line the right hand can draw (the drawing's straight string hidden), and an arrow. */
  /** The holds (HOLDS), found on this body: from the library stance, the upper arm turned at the shoulder, the elbow bent,
   *  the forearm twisted, and the hand turned the least it must be for the weapon to point the hold's way — searched for
   *  the turns that leave the wrist as a wrist bends (up or down more than to the sides, least of all twisted), the grip
   *  where the hold puts it, the elbow out from the body and the shoulder near the stance's. (David 25 Oct: the hand bent
   *  round at the wrist to point the weapon looked broken.) */
  private makeHolds(): void {
    const Y = new THREE.Vector3(0, 1, 0);
    // each elbow's hinge (in its upper arm), across the bend of the guard's arms
    const hinge: Record<'r' | 'l', THREE.Vector3> = { r: new THREE.Vector3(1, 0, 0), l: new THREE.Vector3(1, 0, 0) };
    if (this.clips.has('Sword_Idle')) {
      this.play('Sword_Idle', { fade: 0, restart: true }); this.mixer.update(0.3);
      for (const side of ['r', 'l'] as const) {
        const F = this.bones.get(`lowerarm_${side}`); if (!F) continue;
        const a = new THREE.Vector3().crossVectors(Y, Y.clone().applyQuaternion(F.quaternion));
        if (a.length() > 0.2) hinge[side] = a.normalize();
      }
    }
    // a small simplex search (Nelder-Mead)
    const search = (f: (x: number[]) => number, x0: number[], step: number, iters: number) => {
      const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step; S.push(x); }
      let V = S.map(f);
      for (let it = 0; it < iters; it++) {
        const o = V.map((_, i) => i).sort((a, b) => V[a] - V[b]); S = o.map((i) => S[i]); V = o.map((i) => V[i]);
        const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
        const pt = (k: number) => c.map((v, j) => v + k * (S[n][j] - v));
        const xr = pt(-1), fr = f(xr);
        if (fr < V[0]) { const xe = pt(-2), fe = f(xe); if (fe < fr) { S[n] = xe; V[n] = fe; } else { S[n] = xr; V[n] = fr; } }
        else if (fr < V[n - 1]) { S[n] = xr; V[n] = fr; }
        else { const xc = pt(0.5), fc = f(xc); if (fc < V[n]) { S[n] = xc; V[n] = fc; } else for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); V[i] = f(S[i]); } }
      }
      const b = V.indexOf(Math.min(...V)); return { x: S[b], f: V[b] };
    };
    for (const { name, side, at: [clip, at], way, shift, room, floor } of HOLDS) {
      const U = this.bones.get(`upperarm_${side}`), F = this.bones.get(`lowerarm_${side}`), Hd = this.bones.get(`hand_${side}`);
      if (!U || !F || !Hd || !this.clips.has(clip)) continue;
      this.play(clip, { fade: 0, restart: true }); this.mixer.update(at); this.model.updateMatrixWorld(true);
      const o = side === 'r' ? -1 : 1; // (the hand's side: out is -x for the right, +x for the left)
      const want = new THREE.Vector3(way[0] * o, way[1], way[2]).normalize();
      const Cw = U.parent!.getWorldQuaternion(new THREE.Quaternion()), Uw0 = U.getWorldQuaternion(new THREE.Quaternion()), Up = U.getWorldPosition(new THREE.Vector3());
      const G = this.wgrip.get((name.startsWith('blade') ? 'sword' : name.split(':')[0]) as WeaponId) ?? this.grip[side]; // (the weapon's grip in its fist)
      const f0 = F.quaternion.clone(), h0 = Hd.quaternion.clone(), gy = Y.clone().applyQuaternion(G.q), gp = G.p;
      const P0 = Hd.localToWorld(gp.clone()).add(new THREE.Vector3(shift[0] * o, shift[1], shift[2]));
      const hw = hinge[side];
      const fk = (x: number[]) => {
        const r = new THREE.Vector3(x[0], x[1], x[2]), a = r.length();
        const Uw = (a > 1e-9 ? new THREE.Quaternion().setFromAxisAngle(r.divideScalar(a), a) : new THREE.Quaternion()).multiply(Uw0);
        const Fl = new THREE.Quaternion().setFromAxisAngle(hw, x[3]).multiply(f0).multiply(new THREE.Quaternion().setFromAxisAngle(Y, x[4]));
        const Fw = Uw.clone().multiply(Fl), Fp = Up.clone().add(F.position.clone().applyQuaternion(Uw));
        const Hn = Fw.clone().multiply(h0), Hp = Fp.clone().add(Hd.position.clone().applyQuaternion(Fw));
        const D = new THREE.Quaternion().setFromUnitVectors(gy.clone().applyQuaternion(Hn), want), Hw = D.clone().multiply(Hn);
        return { Uw, Fl, Fw, Fp, Hw, P: Hp.add(gp.clone().applyQuaternion(Hw)), Dl: Hn.clone().invert().multiply(D).multiply(Hn) };
      };
      const parts = (x: number[]) => {
        const k = fk(x), q = k.Dl, ang = 2 * Math.acos(Math.min(1, Math.abs(q.w))), sn = Math.sqrt(Math.max(1e-12, 1 - q.w * q.w)) * Math.sign(q.w || 1);
        const dev = (ang * q.x) / sn, twist = (ang * q.y) / sn, flex = (ang * q.z * -o) / sn; // (in the hand's axes — y along it, z the knuckles' line: dev + toward the thumb, flex + toward the palm)
        const uy = Y.clone().applyQuaternion(k.Uw), fy = Y.clone().applyQuaternion(k.Fw), bend = uy.angleTo(fy);
        const sense = new THREE.Vector3().crossVectors(uy, fy).dot(hw.clone().applyQuaternion(k.Uw));
        const out = k.Fp.x * o; // (the elbow out from the body's middle)
        return {
          wrist: (dev / (dev > 0 ? 0.3 : 0.55)) ** 2 + (twist / 0.5) ** 2 + (flex / (flex > 0 ? 0.95 : 0.8)) ** 2, // (a wrist bends toward the little finger more than the thumb)
          grip: k.P.distanceToSquared(P0) / room ** 2,
          rest: (x[0] ** 2 + x[1] ** 2 + x[2] ** 2) / 1.3 ** 2 + (x[3] / 1.4) ** 2 * 0.3 + (x[4] / 0.8) ** 2,
          joint: (sense < 0 && bend > 0.05 ? (bend / 0.1) ** 2 : 0) + (bend > 2.4 ? ((bend - 2.4) / 0.1) ** 2 : 0) + (out < 0.16 ? ((0.16 - out) / 0.03) ** 2 : 0),
          dev, twist, flex, bend,
        };
      };
      const cost = (x: number[]) => { const p = parts(x); return p.wrist + p.grip + p.rest + p.joint; };
      let best = { x: [0, 0, 0, 0, 0], f: cost([0, 0, 0, 0, 0]) };
      for (const x0 of [[0, 0, 0, 0, 0], [0, 0, 0, 0.8, 0], [0, 0, 0, 0.8, 0.6], [0, 0, 0, 0.8, -0.6], [0, 0, 0, -0.3, 0]]) {
        let r = search(cost, x0, 0.35, 260); r = search(cost, r.x, 0.1, 200);
        if (r.f < best.f) best = r;
      }
      const k = fk(best.x), p = parts(best.x);
      // the staff gripped high on its shaft: its foot just off the floor (the feet stand at 0), the hand still on the plain
      // shaft under its head
      const foot = this.armEnds.get('staff')?.[0] ?? 0, slide = floor ? Math.max(0, Math.min(0.27, (k.P.y + want.y * foot - 0.015) / want.y)) : 0;
      this.holds.set(name, { side, q: [Cw.clone().invert().multiply(k.Uw), k.Fl.clone(), k.Fw.clone().invert().multiply(k.Hw)], slide, floor: floor ? { py: k.P.y, wy: want.y } : undefined, info: `cost ${best.f.toFixed(2)} wrist dev ${(p.dev * 57.3).toFixed(0)} twist ${(p.twist * 57.3).toFixed(0)} flex ${(p.flex * 57.3).toFixed(0)} elbow ${(p.bend * 57.3).toFixed(0)} grip ${(Math.sqrt(p.grip) * room * 100).toFixed(1)}cm slide ${slide.toFixed(2)} x ${best.x.map((v) => v.toFixed(2)).join(' ')}` });
    }
    this.mixer.stopAllAction(); this.action = null; this.clipNow = ''; this.model.updateMatrixWorld(true);
  }

  private makeBowString(): void {
    const g = this.weapons.get('bow'); if (!g) return;
    let tips: THREE.Vector3[] = [];
    const root = g.children[0]; if (!root) return;
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !/String/.test((m.material as THREE.Material).name)) return;
      m.visible = false;
      // its two ends, in the bow's own frame (the packed positions are quantized: the mesh's node carries their scale)
      const p = m.geometry.attributes.position; let lo = 0, hi = 0;
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > p.getY(hi)) hi = i; if (p.getY(i) < p.getY(lo)) lo = i; }
      const at = (i: number) => root.worldToLocal(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld));
      tips = [at(hi), at(lo)];
    });
    if (tips.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints([tips[0], tips[0].clone().lerp(tips[1], 0.5), tips[1]]);
    this.bowString = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8cfb8 }));
    this.bowString.userData.tips = tips; this.bowString.frustumCulled = false;
    root.add(this.bowString);
    // the arrow: a shaft, a steel head, three feathers (made here, once; the archer's own arrows fly as the skills' effects)
    if (this.bowArrow) return;
    const a = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.8 }), steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.35 }), fl = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.9, side: THREE.DoubleSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 5), wood); shaft.position.y = 0.36; a.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.06, 6), steel); tip.position.y = 0.75; a.add(tip);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.09), fl); f.position.set(0, 0.07, 0); f.rotation.y = (i / 3) * Math.PI; f.translateX(0.013); a.add(f); }
    a.visible = false; this.bowArrow = a; this.model.add(a);
  }

  /** The look: the pieces' painted textures, lit like the courtyard (soft, a little rough), never mirror-bright. */
  private look(): void {
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      for (const mt of mats) {
        if (!mt || !(mt as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        mt.envMapIntensity = 0.6;
        mt.metalness = Math.min(mt.metalness, 0.15); mt.roughness = Math.max(mt.roughness, 0.55);
      }
    });
  }

  /** The cast shadow, from the room's sun (`sunDir`: towards the sun, world; kept up to date by the arena): every piece
   *  drawn again flattened onto the floor along the light, dark and see-through, each floor pixel once (a stencil). */
  private shadowMat: THREE.MeshBasicMaterial | null = null;
  private shadowMat2: THREE.MeshBasicMaterial | null = null;
  makeShadow(sunDir: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x160a10, transparent: true, opacity: 0.24, depthWrite: false }); // (as faint as the painted bodies' sun shadows)
    this.own.push(mat);
    mat.stencilWrite = true; mat.stencilRef = 0; mat.stencilFunc = THREE.EqualStencilFunc; mat.stencilZPass = THREE.IncrementStencilOp;
    const uSun = { value: sunDir };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSun = uSun;
      sh.vertexShader = 'uniform vec3 uSun;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 wsp = modelMatrix * vec4( transformed, 1.0 );
        wsp.xyz -= uSun * ( max( wsp.y, 0.0 ) / max( uSun.y, 0.2 ) );
        wsp.y = 0.004;
        vec4 mvPosition = viewMatrix * wsp;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    mat.customProgramCacheKey = () => 'hero-shadow';
    this.shadowMat = mat;
    const m2 = mat.clone(); m2.side = THREE.DoubleSide; m2.onBeforeCompile = mat.onBeforeCompile; m2.customProgramCacheKey = () => 'hero-shadow-2'; this.shadowMat2 = m2; this.own.push(m2); // (a sheet's: a cloak, a brim)
    const src: THREE.Mesh[] = [];
    this.model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.worn) src.push(o as THREE.Mesh); });
    for (const m of src) this.addShadow(m);
    this.wear?.reshadow();
  }
  /** A piece's shadow (its twin on the same bones or the same place, flattened by the shadow's shader). */
  addShadow(m: THREE.Mesh, both = false): void {
    const mat = both ? this.shadowMat2 : this.shadowMat; if (!mat || !m.parent || this.shadows.some(([x]) => x === m)) return;
    const sk = m as THREE.SkinnedMesh;
    let t: THREE.Mesh;
    if (sk.isSkinnedMesh) { const tw = new THREE.SkinnedMesh(sk.geometry, mat); tw.bind(sk.skeleton, sk.bindMatrix); t = tw; } else t = new THREE.Mesh(m.geometry, mat);
    t.frustumCulled = false; t.renderOrder = 5;
    t.matrixAutoUpdate = m.matrixAutoUpdate; t.position.copy(m.position); t.quaternion.copy(m.quaternion); t.scale.copy(m.scale); if (!m.matrixAutoUpdate) t.matrix.copy(m.matrix);
    m.parent.add(t); this.shadows.push([m, t]);
  }
  dropShadow(m: THREE.Mesh): void {
    const i = this.shadows.findIndex(([x]) => x === m); if (i < 0) return;
    this.shadows[i][1].removeFromParent(); this.shadows.splice(i, 1);
  }
  private shown(o: THREE.Object3D): boolean { for (let p: THREE.Object3D | null = o; p && p !== this.model; p = p.parent) if (!p.visible) return false; return true; }

  /** The body's colour wash (a blow taken, a freeze, armour): its cloth and skin glow faintly in it; null: none. */
  private tintNow: number | null = -1;
  tintBody(tint: number | null): void {
    if (tint === this.tintNow) return;
    this.tintNow = tint;
    const m = this.body?.material as THREE.MeshStandardMaterial | undefined; if (!m) return;
    if (tint === null) m.emissive.setRGB(0, 0, 0); else m.emissive.setHex(tint).multiplyScalar(0.32);
    this.wear?.tint(tint);
  }

  /** Afterimages (a dash's blur, a leap's trail): the body's pose a moment ago, flat in a colour, fading — a small pool of
   *  meshes, each a copy of the body's skin computed once per image (no new buffers while it runs). */
  private ghosts: { m: THREE.Mesh; t: number }[] = [];
  private lastGhost = -Infinity;
  ghost(now: number, on: boolean, tint: number, every = 45): void {
    if (!on || !this.body || now - this.lastGhost < every) return;
    this.lastGhost = now;
    const src = this.body, P = src.geometry.attributes.position, n = P.count;
    let g = this.ghosts.find((x) => x.t >= 1);
    if (!g) {
      if (this.ghosts.length >= 8) g = this.ghosts.reduce((a, b) => (a.t > b.t ? a : b));
      else {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        if (src.geometry.index) geo.setIndex(new THREE.BufferAttribute((src.geometry.index.array as Uint32Array).slice(), 1));
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.frustumCulled = false; m.renderOrder = 4; (this.root.parent ?? this.scene).add(m); g = { m, t: 1 }; this.ghosts.push(g); this.own.push(geo, m.material as THREE.Material); // (in the scene the body is drawn in)
      }
    }
    const out = (g.m.geometry.attributes.position as THREE.BufferAttribute), v = Hero3D.tv;
    this.root.updateMatrixWorld(true); // (the bones where the move has them now)
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); src.applyBoneTransform(i, v); v.applyMatrix4(src.matrixWorld); out.setXYZ(i, v.x, v.y, v.z); }
    out.needsUpdate = true;
    (g.m.material as THREE.MeshBasicMaterial).color.setHex(tint);
    g.t = 0; g.m.visible = true;
  }
  /** The body as it stands this moment, drawn flat into `out` (its shadow and afterimages left out) — a frame for the
   *  effects that copy a body (Arena3D.bodyShot). */
  snapshot(a3: { bodyShot(sc: THREE.Scene, feet: THREE.Vector3, out: HTMLCanvasElement, ppu: number, ox: number, oy: number): void }, out: HTMLCanvasElement, ppu: number, ox: number, oy: number): void {
    const hide = [...this.shadows.map(([, t]) => t), ...this.ghosts.map((g) => g.m)].filter((o) => o.visible);
    for (const o of hide) o.visible = false;
    this.wear?.showAura(false);
    this.root.updateMatrixWorld(true);
    a3.bodyShot(this.scene, this.root.position, out, ppu, ox, oy);
    for (const o of hide) o.visible = true;
    this.wear?.showAura(true);
  }

  /** The weapon in hand as a line, its grip → an end (px from the feet: x along the picture, y down): `beyond` the grip
   *  (a sword's point: Radiant Blade's light) or below it (the cane's shaft: the gambler's Light Staff). */
  weaponLine(beyond = false): number[] | null {
    const g = this.weapons.get(this.weapon), e = this.armEnds.get(this.weapon); if (!g || !e) return null;
    g.updateWorldMatrix(true, false);
    const a = new THREE.Vector3().applyMatrix4(g.matrixWorld), t = new THREE.Vector3(0, beyond ? e[1] : e[0], 0).applyMatrix4(g.matrixWorld), r = this.root.position;
    return [(a.x - r.x) * 100, -(a.y - r.y) * 100, (t.x - r.x) * 100, -(t.y - r.y) * 100];
  }

  /** The highest point of what it holds and wears (world y over its feet): the weapon's far end, a hat's top. */
  topY(): number {
    let top = 0;
    const g = this.weapons.get(this.weapon), e = this.armEnds.get(this.weapon);
    if (g && e && g.visible) { g.updateWorldMatrix(true, false); for (const y of e) top = Math.max(top, Hero3D.tv.set(0, y, 0).applyMatrix4(g.matrixWorld).y); }
    return Math.max(top, this.wear?.hatTop() ?? 0) - this.root.position.y;
  }

  /** Where its eyes are (px from the feet: x along the picture, y down) — War Cry's and Radiant Blade's glowing eyes. */
  eyePoint(): [number, number] | null {
    const hd = this.bones.get('Head'); if (!hd) return null;
    hd.updateWorldMatrix(true, false);
    const p = hd.getWorldPosition(new THREE.Vector3()), k = this.model.scale.x, r = this.root.position;
    p.y += 0.095 * k; p.x += Math.sin(this.yaw) * 0.075 * k; p.z += Math.cos(this.yaw) * 0.075 * k; // (above the neck joint, at the face)
    return [(p.x - r.x) * 100, -(p.y - r.y) * 100];
  }

  /** No afterimages left (the body goes away for a while: the next time it shows, none of the last ones linger). */
  clearGhosts(): void { for (const g of this.ghosts) { g.t = 1; g.m.visible = false; } }
  private fadeGhosts(ms: number): void {
    for (const g of this.ghosts) { if (g.t >= 1) { g.m.visible = false; continue; } g.t = Math.min(1, g.t + ms / 260); const k = 1 - g.t; (g.m.material as THREE.MeshBasicMaterial).opacity = 0.42 * k * k; }
  }
  private static tv = new THREE.Vector3();

  /** The weapon in hand shown or not (Judgment Blade: no sword from the leap until he lands). */
  showWeapon(on: boolean): void { this.armShown = on; this.syncArm(); }
  private armShown = true;
  /** Out of the hand for a while in a skill (ARM_AWAY). */
  private armAway = false;
  private syncArm(): void { const g = this.weapons.get(this.weapon), v = this.armShown && !this.armAway; if (g && g.visible !== v) g.visible = v; }

  /** Take an item in hand (the Beginner's weapons): that one shown, gripped by its hand. */
  setWeapon(id: WeaponId): void {
    this.weapon = id;
    if (this.bowArrow) this.bowArrow.visible = false; // (no arrow left nocked when the bow is put away)
    for (const [w, g] of this.weapons) {
      g.visible = w === id && this.armShown && !this.armAway; if (w !== id) continue;
      g.position.copy((this.wgrip.get(w) ?? this.grip[WEAPONS[w].hand]).p); g.quaternion.copy(this.armQ(w)); g.scale.set(this.girth(w), 1, this.girth(w));
    }
    this.castKey = ''; this.clipNow = '';
  }

  /** Crossfade to a clip. */
  play(name: string, o: { fade?: number; once?: boolean; speed?: number; restart?: boolean } = {}): void {
    const clip = this.clips.get(name); if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.timeScale = o.speed ?? 1;
    if (name === this.clipNow && !o.restart) return;
    a.reset(); a.enabled = true;
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    const f = o.fade ?? 0.14;
    if (this.action && f > 0) a.crossFadeFrom(this.action, f, true); else this.action?.stop();
    a.play(); this.action = a; this.clipNow = name;
  }
  clipLength(name: string): number { return this.clips.get(name)?.duration ?? 1; }

  /** One frame: the body where the game has it, facing its way, the move its state calls for. */
  drive(d: HeroDrive, ms: number): void {
    const U = 100;
    this.root.position.set(d.x / U, d.z / U, (d.y / U) * 1.15);
    // side view, turned a little to the camera (a fighter's three-quarter); a turn eases round
    if (d.yaw !== undefined) this.yaw = d.yaw;
    else { const want = d.face >= 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42; this.yaw += (want - this.yaw) * Math.min(1, ms / 70); }
    this.root.rotation.set(0, this.yaw, 0); this.root.scale.set(1, 1, 1); // (motion() tips and stretches it after)
    const sp = Math.hypot(d.vx, d.vy), k = this.model.scale.x;
    const c = d.cast;
    this.spinning = false;
    if (d.mode === 'skill' && c && SPIN[c.id]) { // (round and round through the active part, the way it faces)
      const t = c.elapsed - c.startup;
      if (t > 0 && t < c.active) { this.root.rotation.y = this.yaw + (d.face >= 0 ? 1 : -1) * Math.PI * 2 * SPIN[c.id] * (t / 1000); this.spinning = true; }
    }
    const away = d.mode === 'skill' && c ? ARM_AWAY[c.id] : undefined, t0 = c ? c.elapsed - c.startup : 0, off = !!away && t0 >= away[0] && t0 < away[1];
    if (off !== this.armAway) { this.armAway = off; this.syncArm(); }
    if (d.mode === 'skill' && c) {
      const key = `${c.id}:${c.stage}:${Math.round(c.startup)}`;
      if (key !== this.castKey) {
        this.castKey = key;
        const beat = BEAT[c.id], clip = this.attackClip(c), len = this.clipLength(clip), speed = Math.min(3, Math.max(0.6, (len * 1000 * this.hitShare(clip)) / Math.max(60, beat ? beat[0] : c.startup + c.active * 0.5)));
        this.play(clip, { once: !/_Loop$/.test(clip), restart: true, fade: 0.06, speed }); // (a loop — riding a tornado — goes on as long as the skill)
        if (c.elapsed > 0 && this.action) this.action.time = Math.min(len * 0.98, (c.elapsed / 1000) * speed); // (a cast seen late — another player's, a double joining his swing — picks up where it is)
      } else if (this.action && !this.action.isRunning() && !this.clipNow.startsWith('Hold_') && c.elapsed < c.startup + c.active + c.recovery - 150) {
        // the move is over and the skill goes on (a channel, a stance, a volley of arrows): never a statue — another draw
        // for a volley, else the ready stance it holds (a spell's, the guard's)
        const rest = c.startup + c.active + c.recovery - c.elapsed, beat = BEAT[c.id];
        const again = beat ? beat[1] > 0 && c.elapsed < c.startup + c.active && rest > beat[1] * 0.7 : this.clipNow.startsWith('Bow_Shoot') && rest > 700;
        const next = again ? this.clipNow : this.weapon === 'staff' || this.clipNow.startsWith('Spell_') ? 'Spell_Simple_Idle_Loop' : this.weapon === 'bow' ? 'Idle_Loop' : 'Sword_Idle';
        this.play(next, again ? { once: true, restart: true, fade: 0.1, speed: beat ? Math.min(4, (this.clipLength(next) * 1000) / beat[1]) : 1.2 } : { fade: 0.25 });
      }
    } else {
      this.castKey = '';
      switch (d.mode) {
        case 'walk': this.play('Walk_Loop', { speed: Math.max(0.5, sp / (1.25 * U * k / 0.72)) }); break;
        case 'run': this.play(sp > 240 ? 'Sprint_Loop' : 'Jog_Fwd_Loop', { speed: Math.max(0.6, sp / (sp > 240 ? 330 : 250)) }); break;
        case 'takeoff': this.play('Jump_Start', { once: true, fade: 0.06, speed: 1.6 }); break;
        case 'air': case 'backstep': this.play(d.vz > 60 ? 'NinjaJump_Idle_Loop' : 'Jump_Loop', { fade: 0.18 }); break;
        case 'land': this.play('Jump_Land', { once: true, fade: 0.06, speed: 1.8 }); break;
        case 'hurt': this.play('Hit_Chest', { once: true, restart: this.clipNow === 'Hit_Chest' ? false : true, fade: 0.05 }); break;
        case 'stunned': this.play('Hit_Head', { once: true, fade: 0.08, speed: 0.6 }); break;
        case 'launched': this.play('Hit_Knockback', { once: true, fade: 0.06, speed: 0.8 }); break;
        case 'down': case 'dead': this.play('Death01', { once: true, fade: 0.1, speed: 1.5 }); break;
        case 'getup': this.play('LayToIdle', { once: true, fade: 0.1, speed: 1.4 }); break;
        case 'quickrise': this.play('LayToIdle', { once: true, fade: 0.06, speed: 2.4 }); break;
        case 'alert': this.play(this.weapon === 'staff' ? 'Spell_Simple_Idle_Loop' : 'Sword_Idle', { fade: 0.2 }); break; // (after a blow or a hit: the guard held a moment — a staff's, its spell ready)
        default: this.play('Idle_Loop', { fade: 0.25 });
      }
    }
    this.mixer.update(ms / 1000);
    // a skill you may walk in, walked: the legs walk (forward or back, as you go), the rest of the body casts
    const sk = c ? finalSkill(c.id) ?? finalSkill(c.id.replace(/_[a-z]+$/, '')) : undefined;
    const phase = !c ? 'startup' : c.elapsed < c.startup ? 'startup' : c.elapsed < c.startup + c.active ? 'active' : 'recovery';
    const walking = d.mode === 'skill' && !!c && !c.dash && d.grounded && sp > 25 && (sk?.move[phase] ?? 0) > 0;
    this.walkK += ((walking ? 1 : 0) - this.walkK) * Math.min(1, ms / 120);
    if (this.walkK > 0.002) this.walkLegs(ms, sp, Math.abs(d.vx) > Math.abs(d.vy) * 0.5 && d.vx * d.face < 0 ? -1 : 1);
    if (this.armShown && !this.armAway) this.closeHand();
    this.hold(ms);
    this.fadeGhosts(ms);
    this.wear?.update(ms);
    for (const [m, t] of this.shadows) t.visible = this.shown(m);
  }

  /** The legs walking under a cast (walkK of the way from its stance): the library's walk, its legs' turns and its hips'
   *  height, at the walk's pace for the speed, backward when going against the way you face. */
  private walkLegs(ms: number, sp: number, sign: number): void {
    const walk = this.clips.get('Walk_Loop'); if (!walk) return;
    if (!this.legs) {
      this.legs = [];
      for (const t of walk.tracks) {
        const [name, prop] = t.name.split('.'), bone = this.bones.get(name);
        if (bone && (prop === 'quaternion' && /^(thigh|calf|foot|ball)_/.test(name) || prop === 'position' && name === 'pelvis')) this.legs.push({ bone, it: t.createInterpolant(), pos: prop === 'position' });
      }
    }
    const rate = Math.max(0.5, sp / ((1.25 * 100 * this.model.scale.x) / 0.72));
    this.walkT = (((this.walkT + (sign * rate * ms) / 1000) % walk.duration) + walk.duration) % walk.duration;
    for (const L of this.legs) {
      const v = L.it.evaluate(this.walkT);
      if (L.pos) L.bone.position.lerp(Hero3D.lv.fromArray(v), this.walkK); else L.bone.quaternion.slerp(Hero3D.lq.fromArray(v), this.walkK);
    }
  }

  /** Held still in a move, `t` seconds in, turned `yaw` (0: facing the viewer) — the splash art's and the portraits'
   *  poses (tools/hero3d/art). */
  pose(clip: string, t: number, yaw: number): void {
    this.play(clip, { fade: 0, restart: true, once: true });
    if (this.action) this.action.time = Math.min(t, this.clipLength(clip) * 0.99);
    this.yaw = yaw; this.root.position.set(0, 0, 0); this.root.rotation.set(0, yaw, 0); this.root.scale.set(1, 1, 1);
    this.mixer.update(0);
    if (this.armShown && !this.armAway) this.closeHand();
    this.root.updateMatrixWorld(true); // (the hands where the move has them: the bowstring is drawn to them)
    this.hold(1000); // (the weapon settled at once)
    this.root.updateMatrixWorld(true);
    this.wear?.settle(); // (a cloak hanging as it falls)
  }

  /** The painted bodies' motion layer laid on this one (after drive): the recoil and the lean of a shot, a leap's arc,
   *  a somersault turned round a point above the feet in the picture's plane, a spin (facing the other way), a squash —
   *  the same numbers every client draws the painted body by (ArcherMotion, SamuraiMotion). */
  motion(m: Motion | null): void {
    if (!m) return;
    const r = this.root, U = 100;
    r.position.x += m.dx / U; r.position.y -= m.dy / U;
    if (m.flip && !this.spinning) r.rotation.y = -this.yaw; // (a spin seen from the side: the other way, still three-quarter to the viewer; a 3D spin turns round itself)
    const th = -(m.ang * Math.PI) / 180; // (the picture's clockwise is the 3D's negative turn about the axis toward the viewer)
    if (th) { const h = m.pivot / U; r.position.x += h * Math.sin(th); r.position.y += h - h * Math.cos(th); r.rotation.z = th; }
    if (m.sx !== 1 || m.sy !== 1) r.scale.set(1, m.sy, m.sx); // (the body faces along x: its length on screen is its local z)
  }

  /** When the weapon is not swung the arm holds it (HOLDS): standing or walking a blade hangs, its point down and forward
   *  (the painted warrior's idle), and in the stance's guard points forward and up at the foe; a staff, the cane and the
   *  bow stand upright in the hand before the hip — through a spell, a kneel, the free hand's throws too. The weapon never
   *  leaves its fist: the arm takes it where it goes, the wrist bent no more than a wrist bends (David 25 Oct: the weapon
   *  turned inside the hand, then the hand turned round at the wrist, looked broken). Held so, the weapon is turned about
   *  its own length (its grip is round in the fist) to show its face to the viewer: a sword's flat, the bow's curve. */
  private hold(ms: number): void {
    const W = WEAPONS[this.weapon], g = this.weapons.get(this.weapon); if (!g) return;
    g.quaternion.copy(this.armQ(this.weapon));
    const shooting = this.weapon === 'bow' && this.clipNow.startsWith('Bow_Shoot') && !!this.action?.isRunning(); // (the draw holds the bow its own way)
    const c = this.clipNow, side = W.hand, blade = W.loose === 'hang';
    const H = !shooting && this.armShown && !this.armAway ? this.holds.get(holdFor(this.weapon, c, this.flatToView)) : undefined;
    const e = Math.min(1, ms / 140);
    if (H) {
      if (this.holdK < 0.01 || H.side !== this.holdSide) { this.holdQ.forEach((q, i) => q.copy(H.q[i])); this.holdSide = H.side; this.holdSlide = H.slide; }
      else { this.holdQ.forEach((q, i) => q.slerp(H.q[i], e)); this.holdSlide += (H.slide - this.holdSlide) * e; }
    }
    this.holdK += ((H ? 1 : 0) - this.holdK) * e;
    // (the staff slid down through the fist as it is gripped higher)
    g.position.copy((this.wgrip.get(this.weapon) ?? this.grip[side]).p).addScaledVector(Hero3D.lv.set(0, 1, 0).applyQuaternion(g.quaternion), -this.holdSlide * this.holdK);
    // an upright weapon through a move of the weapon arm's own (a spell's cast, the call to the sky, a rune traced): the
    // hand turns it toward upright as far as a wrist turns
    const lift = !blade && !H && /^(Spell_Simple|Idle_Shield_Break|Fixing_Kneeling|Dance|Hold_Call|W_Trace)/.test(c);
    this.liftK += ((lift ? 1 : 0) - this.liftK) * e;
    const hand = this.bones.get(`hand_${side}`); if (!hand) return;
    if (this.holdK > 0.002) for (const [i, n] of ['upperarm', 'lowerarm', 'hand'].entries()) this.bones.get(`${n}_${this.holdSide}`)?.quaternion.slerp(this.holdQ[i], this.holdK);
    if (this.liftK > 0.002) {
      hand.updateWorldMatrix(true, false);
      const Hw = hand.getWorldQuaternion(new THREE.Quaternion()), t = new THREE.Vector3(0, 1, 0).applyQuaternion(Hw.clone().multiply(this.armQ(this.weapon)));
      const D = new THREE.Quaternion().setFromUnitVectors(t, new THREE.Vector3(Math.sin(this.yaw) * 0.12, 1, Math.cos(this.yaw) * 0.12).normalize());
      const a = 2 * Math.acos(Math.min(1, Math.abs(D.w))); if (a > 0.9) D.slerp(new THREE.Quaternion(), 1 - 0.9 / a); // (a wrist turns so far)
      const want = D.multiply(Hw), local = hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want);
      hand.quaternion.slerp(local, this.liftK);
    }
    // its face to the viewer (+z), turned about its length
    const k = Math.max(this.holdK, this.liftK) * (1 - this.aimK);
    if (k > 0.002) {
      hand.updateWorldMatrix(true, false);
      const Wq = hand.getWorldQuaternion(new THREE.Quaternion()).multiply(g.quaternion);
      const y = new THREE.Vector3(0, 1, 0).applyQuaternion(Wq), z = new THREE.Vector3(0, 0, 1).applyQuaternion(Wq), v = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z);
      if (v.lengthSq() > 1e-3) {
        v.normalize(); let a = Math.atan2(new THREE.Vector3().crossVectors(z, v).dot(y), z.dot(v));
        if (this.weapon === 'bow') { // (the face whose string is away from the body: the string never across the archer)
          const x = new THREE.Vector3(1, 0, 0).applyQuaternion(Wq).applyAxisAngle(y, a), out = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(side === 'l' ? 1 : -1);
          if (x.dot(out) < 0) a += Math.PI;
          if (a > Math.PI) a -= 2 * Math.PI;
        } else if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI; // (either face)
        g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a * k));
      }
    }
    if (this.weapon === 'bow') this.aimBow(ms, g); // (the draw, over the hold: after a shot it fades back into it)
  }
  private holdQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  private holdSide: 'r' | 'l' = 'r';
  private holdSlide = 0;
  private liftK = 0;

  /** The bow in the draw: upright, its string toward the archer, the string pulled to the right hand and the arrow on
   *  it until the loose. Returns false when the bow is not in a shot. */
  private aimBow(ms: number, g: THREE.Group): boolean {
    const shooting = this.clipNow.startsWith('Bow_Shoot') && !!this.action?.isRunning();
    if (shooting) this.aimPitch = BOW_PITCH[this.clipNow] ?? 0;
    const t = shooting ? this.action!.time : 0;
    this.aimK += ((shooting ? 1 : 0) - this.aimK) * Math.min(1, ms / 90);
    const S = this.bowString, A = this.bowArrow, hand = this.bones.get('hand_l'), rh = this.bones.get('hand_r');
    const drawn = shooting && t > 0.12 && t < 0.62, aiming = this.aimK >= 0.002 && !!hand;
    if (aiming) { // upright, its string toward the archer, held as it stood (the draw never passes through the fist's own turn)
      hand!.updateWorldMatrix(true, false);
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const ca = Math.cos(this.aimPitch), sa = Math.sin(this.aimPitch); // (tilted back as far as the aim is raised: across the arrow)
      const y = new THREE.Vector3(-sa * fx, ca, -sa * fz), x = new THREE.Vector3(-ca * fx, -sa, -ca * fz), z = new THREE.Vector3().crossVectors(x, y);
      this.turnHand(hand!, new THREE.Quaternion().setFromRotationMatrix(Hero3D.tm.makeBasis(x, y, z)), this.aimK);
      g.updateMatrixWorld(true); // (the string's hand point is taken in the bow as it is held now)
    }
    rh?.updateWorldMatrix(true, false);
    if (S) {
      const pos = S.geometry.attributes.position as THREE.BufferAttribute, tips = S.userData.tips as THREE.Vector3[];
      const mid = tips[0].clone().lerp(tips[1], 0.5);
      if (drawn && rh) { const p = this.grip.r.p.clone(); rh.localToWorld(p); S.parent!.worldToLocal(p); mid.copy(p); }
      pos.setXYZ(1, mid.x, mid.y, mid.z); pos.needsUpdate = true;
    }
    if (A && rh && hand) {
      A.visible = drawn;
      if (drawn) {
        const from = rh.localToWorld(this.grip.r.p.clone()), to = hand.localToWorld((this.wgrip.get('bow') ?? this.grip.l).p.clone());
        this.model.worldToLocal(from); this.model.worldToLocal(to);
        A.position.copy(from); A.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
      }
    }
    return aiming;
  }

  /** Each skill's own move (SKILL_MOVE); a skill not listed takes the nearest library move for the weapon in hand. */
  private attackClip(c: NonNullable<HeroDrive['cast']>): string {
    const w = this.weapon, id = c.id;
    const m = SKILL_MOVE[id] ?? SKILL_MOVE[id.replace(/_[a-z]+$/, '')], pick = Array.isArray(m) ? m[c.stage % m.length] : m; // (an element's bolt, the double shot's stream: their skill's move)
    if (pick && this.clips.has(pick)) return pick;
    const buff = /war_cry|oath|banner|sanctuary|radiant|aura|ward|barrier|haste|focus|sheathe|meditat|all_in|lucky/.test(id);
    if (w === 'sword' || w === 'katana') {
      if (/_basic$|quick_slash/.test(id)) return ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'][c.stage % 4];
      if (c.dash) return 'Sword_Dash_RM';
      if (c.air) return 'Sword_Attack';
      if (buff) return 'Idle_Shield_Break';
      if (/whirl|storm|tide|circle|spin/.test(id)) return 'Sword_Regular_Combo';
      if (/rising|sky|lance|hook|swallow/.test(id)) return 'Sword_Regular_C';
      if (/ground|earth|leap|crash|verdict|maw|iai/.test(id)) return 'Sword_Attack';
      return 'Sword_Regular_B';
    }
    if (buff) return 'Idle_Shield_Break';
    if (c.dash) return w === 'bow' ? 'Roll' : 'Sword_Dash_RM';
    if (w === 'cane') {
      if (/deal|card|deck|ace|joker|throw|fuse/.test(id)) return 'OverhandThrow';
      if (/_basic$/.test(id)) return ['Melee_Hook', 'Sword_Regular_A', 'Sword_Regular_B'][c.stage % 3];
      return /rotor|vault|spin/.test(id) ? 'Sword_Regular_Combo' : 'Sword_Regular_C';
    }
    if (w === 'staff') {
      if (/_basic$|flurry|strike/.test(id)) return ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'][c.stage % 3];
      return 'OverhandThrow';
    }
    return this.clips.has('Bow_Shoot') ? 'Bow_Shoot' : 'OverhandThrow'; // the bow
  }
  /** Where in a sword clip its blow falls (share of its length): the clip is timed so the blow meets the skill's hit. */
  private hitShare(clip: string): number {
    if (clip.startsWith('Bow_Shoot')) return 0.62; // (the loose)
    return ({ Kick_Flip: 0.44, Hold_Call: 0.8, Seize: 0.46, Flip_Coin: 0.65, Roll_Dice: 0.5, Vault_Kick: 0.44, Flick: 0.5, Throw_L: 0.61, S_Rise: 0.45, Hold_Rise: 0.45, Hold_Crouch: 0.95, W_Smash: 0.28, Hold_Raise: 0.95, W_SkyChain: 0.15, W_Thrust: 0.27, W_Point: 0.3, W_Plunge: 0.35, W_Trace: 0.3, Idle_FoldArms_Loop: 0.2, Sword_Regular_A: 0.45, Sword_Regular_B: 0.42, Sword_Regular_C: 0.3, Sword_Attack: 0.45, Sword_Dash_RM: 0.35, Sword_Regular_Combo: 0.25, Idle_Shield_Break: 0.4, OverhandThrow: 0.42, Melee_Hook: 0.4, Roll: 0.3, Bow_Shoot: 0.62, Spell_Simple_Shoot: 0.3, Punch_Jab: 0.35, Punch_Cross: 0.35, Fixing_Kneeling: 0.25, Sword_Block: 0.25, NinjaJump_Start: 0.4 } as Record<string, number>)[clip] ?? 0.4;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    for (const g of this.ghosts) g.m.removeFromParent();
    this.wear?.dispose(); this.wear = null;
    for (const o of this.own) o.dispose();
    if (this.shared) { this.root.removeFromParent(); return; } // (a twin: the shape, textures and weapons are its source's)
    for (const [k, b] of this.baseArm) if (this.weapons.get(k)?.children[0] !== b.model) b.model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); // (a kind's own model put away for an item's)
    this.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry?.dispose();
      for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]) {
        for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        mt.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
