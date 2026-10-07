// Character body art for all 4 classes, one API: pose queries → texture frame + feet origin + scale (+ aligned weapon
// mask frame for weapon cosmetics + per-frame attachment anchors).
// Warrior / Book Mage: supplied final 352px sheets (idle 6, walk 6, run 8, jump 8, air_attack 6, hurt 4, recovery 4,
// death 8) + final per-skill bodies (6 / 10 / 12 columns), rows down/right/left/up, feet at (176, 310).
// Archer / Samurai: the repository's explicit-rect class atlas (clean base sheets) with per-skill pose sequences.
import Phaser from 'phaser';
import ARCHER from '../data/archer-atlas.json';
import SAMURAI from '../data/samurai-atlas.json';
import ANCHORS from '../data/body-anchors.json';
import BODY_CELLS from '../data/body-cells.json';
import BLADES from '../data/blade-lines.json';
import BEHIND from '../data/blade-behind.json';
import BASE_BLADES from '../data/base-blade-lines.json';
import HEADS from '../data/head-frames.json';
import { Dir } from '../world/collision';
import { FINAL_SKILLS } from '../skills/FinalKit';

export type ClassKey = 'warrior' | 'book_mage' | 'archer' | 'samurai';
export const DIRS: Dir[] = ['down', 'right', 'left', 'up'];
const ROW: Record<Dir, number> = { down: 0, right: 1, left: 2, up: 3 };
const CELL = 352, ORIGIN_Y = 310 / 352, SHEET_SCALE = 108 / 172;
/** Skill sheets with taller cells (extra headroom above, feet still 42px above the cell bottom) and their column counts. */
const CELLS = BODY_CELLS as Record<string, { w: number; h: number; cols: number }>;

type MoveState = 'idle' | 'walk' | 'run' | 'jump' | 'air_attack' | 'hurt' | 'recovery' | 'death' | 'react';
const MOVE_COLS: Record<MoveState, number> = { idle: 12, walk: 8, run: 8, jump: 8, air_attack: 6, hurt: 4, recovery: 4, death: 8, react: 8 };
const SHEET_CLASSES = ['warrior', 'book_mage'] as const;
const sheetKey = (cls: string, st: string) => `body-${cls}-${st}`;
/** Extended-kit skills reuse an existing body animation (pose family) until they get their own sheet. */
const BODY_ALIAS: Record<string, string> = { guard_counter: 'iron_grip', iron_oath: 'sanctuary', legacy_banner: 'radiant_blade' };
/** Skills that play the regular attack's movement (one strike of the basic chain sheet) instead of their own body. */
const POSE_AS_BASIC: Record<string, number> = { wave_slash: 0 };
export const bodyIdOf = (id: string) => BODY_ALIAS[id] ?? id;
const skillKey = (cls: string, id: string) => `sbody-${cls}-${bodyIdOf(id)}`;
const sheetPath = (cls: string, st: string) => `assets/final/body/${cls}/movement/${st}.png`;
const skillPath = (cls: string, id: string) => `assets/final/skills/${cls}/${bodyIdOf(id)}/body.png`;

// ---- atlas classes
type AtlasAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'death';
type Rect = { x: number; y: number; w: number; h: number; ax: number; ay: number };
interface AtlasData { sheet: string; directions: Record<Dir, Record<AtlasAction, Rect[]>>; scaleByDirection: Record<Dir, number> }
const ATLAS: Record<string, AtlasData> = { archer: ARCHER as unknown as AtlasData, samurai: SAMURAI as unknown as AtlasData };
const atlasKey = (cls: string) => `class-${cls}`;
const atlasFrame = (dir: Dir, a: AtlasAction, i: number) => `${dir}-${a}-${i}`;
/** Archer down/right jump frame 1 overlaps neighbouring figures on the sheet: the airborne frame 0 is held instead. */
const JUMP_FALL: Record<string, Partial<Record<Dir, number>>> = { archer: { down: 0, right: 0 } };

export const isSheetClass = (cls: string): boolean => (SHEET_CLASSES as readonly string[]).includes(cls);

/** Weapon-mask sheets (`<body key>-w`) are only drawn by weapon skins (and the sword cut of classes without a packed
 *  mask), so they load on first need instead of with the world: ~0.6 GB of texture memory for the warrior alone. */
const MASK_SRC: Record<string, { url: string; w: number; h: number; atlas: boolean; cls: string }> = {};

function loadMask(scene: Phaser.Scene, k: string): void {
  const m = MASK_SRC[k];
  if (!m || scene.textures.exists(k)) return;
  if (m.atlas) {
    scene.load.image(k, m.url);
    scene.load.once(`filecomplete-image-${k}`, () => registerBodies(scene)); // named atlas frames on the mask too
  } else scene.load.spritesheet(k, m.url, { frameWidth: m.w, frameHeight: m.h });
}

/** Queued, loading or loaded-but-not-yet-processed in this scene's loader. */
function pending(scene: Phaser.Scene, k: string): boolean {
  const L = scene.load as unknown as Record<'list' | 'inflight' | 'queue', { entries: Phaser.Loader.File[] }>;
  return [L.list, L.inflight, L.queue].some((set) => set.entries.some((f) => f.key === k));
}

const MASK_TRIES = new Map<string, number>();
/** Starts loading every weapon mask of a class (in the background) unless they are loaded or on the way.
 *  A request dropped by a scene change is retried once; a missing file is not requested again and again. */
export function ensureWeaponMasks(scene: Phaser.Scene, cls: string): void {
  let added = false;
  for (const [k, m] of Object.entries(MASK_SRC)) {
    if (m.cls !== cls || scene.textures.exists(k) || pending(scene, k) || (MASK_TRIES.get(k) ?? 0) >= 2) continue;
    MASK_TRIES.set(k, (MASK_TRIES.get(k) ?? 0) + 1);
    loadMask(scene, k); added = true;
  }
  if (added && !scene.load.isLoading()) scene.load.start();
}

/** Body sheets of the given classes (all classes when omitted: the PvP arena can hold any class). Weapon masks only for
 *  `masks` (classes whose wearer already has a weapon skin); the rest load on first need (ensureWeaponMasks). */
export function preloadBodies(scene: Phaser.Scene, classes?: readonly string[], masks: readonly string[] = []): void {
  const want = (cls: string) => !classes || classes.includes(cls);
  const L = (k: string, p: string, sheet: boolean) => {
    if (scene.textures.exists(k)) return;
    if (sheet) scene.load.spritesheet(k, p, { frameWidth: CELL, frameHeight: CELL }); else scene.load.image(k, p);
  };
  const M = (k: string, p: string, cls: string, w = CELL, h = CELL, atlas = false) => {
    MASK_SRC[k] = { url: p.replace('.png', '_weapon.png'), w, h, atlas, cls };
    if (masks.includes(cls)) loadMask(scene, k);
  };
  for (const cls of SHEET_CLASSES) {
    if (!want(cls)) continue;
    for (const st of Object.keys(MOVE_COLS).filter((x) => x !== 'react' || cls === 'warrior')) { L(sheetKey(cls, st), sheetPath(cls, st), true); M(`${sheetKey(cls, st)}-w`, sheetPath(cls, st), cls); if (cls === 'warrior') SHEET_PATH[sheetKey(cls, st)] = sheetPath(cls, st); }
    for (const s of FINAL_SKILLS.filter((x) => x.cls === cls && !BODY_ALIAS[x.id] && !(x.id in POSE_AS_BASIC))) { const cs = CELLS[s.id]; const LS = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: cs?.w ?? CELL, frameHeight: cs?.h ?? CELL }); };
      LS(skillKey(cls, s.id), skillPath(cls, s.id)); M(`${skillKey(cls, s.id)}-w`, skillPath(cls, s.id), cls, cs?.w ?? CELL, cs?.h ?? CELL); if (cls === 'warrior') SHEET_PATH[skillKey(cls, s.id)] = skillPath(cls, s.id); }
  }
  for (const [cls, a] of Object.entries(ATLAS)) { if (!want(cls)) continue; L(atlasKey(cls), a.sheet, false); M(`${atlasKey(cls)}-w`, a.sheet, cls, 0, 0, true); }
  if (want('warrior')) for (const [g, anims] of Object.entries(NAKED)) for (const anim of Object.keys(anims)) {
    L(nakedKey(g, anim), `assets/final/body/naked/${g}/${anim}.png`, true);
    if (hasOver(g, anim)) L(overKey(g, anim), `assets/final/body/naked/${g}/${anim}_o.png`, true); // the sword arm in front of the head
  }
  if (want('warrior')) for (const anim of BASE_ANIMS) {
    const k = baseKey(anim); L(k, basePath(anim), true); M(`${k}-w`, basePath(anim), 'warrior'); SHEET_PATH[k] = basePath(anim);
    const cs = CELLS[anim], skill = !(anim in MOVE_COLS), W = cs?.w ?? CELL, H = cs?.h ?? CELL;
    BASE_GEOM[k] = { W, H, cols: skill ? (cs?.cols ?? 6) : moveCols('warrior', anim as MoveState), orig: skill ? skillPath('warrior', anim) : sheetPath('warrior', anim), ox: Math.floor(W / 2) - 176, oy: H - CELL };
  }
}

/** Explicit atlas rectangles registered once as named frames (body + weapon-mask textures share frame names). */
export function registerBodies(scene: Phaser.Scene): void {
  for (const [cls, a] of Object.entries(ATLAS)) {
    for (const key of [atlasKey(cls), `${atlasKey(cls)}-w`]) {
      if (!scene.textures.exists(key)) continue;
      const tex = scene.textures.get(key);
      for (const dir of DIRS) for (const [act, rects] of Object.entries(a.directions[dir]) as [AtlasAction, Rect[]][]) {
        rects.forEach((r, i) => { const n = atlasFrame(dir, act, i); if (!tex.has(n)) tex.add(n, 0, r.x, r.y, r.w, r.h); });
      }
    }
  }
}

/** Resolved frame for one pose. Anchor values are in world px relative to the feet (x right, y down). */
export interface PoseFrame {
  key: string; frame: string | number; wkey: string; ox: number; oy: number; scale: number;
  /** Optional per-axis multipliers around the feet (procedural breathing). */
  sx?: number; sy?: number;
  /** Drawn mirrored (facing left = the right-facing art flipped, MapleStory-style); anchors are already mirrored. */
  flip?: boolean;
  /** [headTopX, headTopY, headCx, headCy, backX, backY] relative to the feet, world px (already scaled). */
  anchor: number[] | null;
  /** Head (hair) box for helmets: [centerX, width (direction median, stable), bottomY], world px rel. feet. */
  hair?: number[] | null;
  /** Sword line [hiltX, hiltY, tipX, tipY] rel. feet, world px (warrior). */
  blade?: number[] | null;
  /** Sword passes behind the head/body in this frame (skins drawn under the body only). */
  bladeBehind?: boolean;
  /** Head fit for hairstyles: [crownX, crownY (rel. feet, world px), tilt deg] (warrior). */
  head?: number[] | null;
  /** The clean base character's frame: its move, and where the head sits (cell px from the standing head) for the look layers;
   *  bare = no sword in hand (a skill played with the hand free); swing = a regular attack's swing (the sword leaves its afterimage). */
  naked?: { g: string; anim: string; frame: number; hx: number; hy: number; bare?: boolean; swing?: boolean };
}

type AnchorTable = Record<string, (number[] | null)[][] | Record<string, (number[] | null)[]>>;
const ANCH = ANCHORS as unknown as AnchorTable;
function scaleAnchor(a: number[] | null | undefined, k: number): number[] | null { return a ? a.slice(0, 6).map((v) => v * k) : null; }
function scaleHair(a: number[] | null | undefined, k: number): number[] | null { return a && a.length > 9 ? [a[7] * k, a[8] * k, a[9] * k] : null; }

/** Sheet texture key → file path (warrior), for lazily loaded cosmetic masks (<sheet>_m.png). */
export const SHEET_PATH: Record<string, string> = {};

// ---- base body (beginner clothes, side view, one right-facing row per animation; left = mirrored).
// Baked by tools/base/bake.py from the armour frames; cosmetics (fashion colours, hats…) are drawn on it.
import BASE_LIST from '../data/base-sheets.json';
import BASE_COLS_LIST from '../data/base-cols.json';
const BASE_ANIMS = new Set<string>(BASE_LIST as string[]);
/** Strips trimmed to the frames the game shows (tools/base/compact.py): kept original columns, in strip order. */
const BASE_COLS = BASE_COLS_LIST as Record<string, number[]>;
const baseCol = (anim: string, c: number): number => { const m = BASE_COLS[anim]; if (!m) return c; const i = m.indexOf(c); return i >= 0 ? i : 0; };
const baseKey = (anim: string) => `base-warrior-${anim}`;
const basePath = (anim: string) => `assets/final/body/warrior/base/${anim}.png`;
const animOf = (path: string) => (path.includes('/skills/') ? path.split('/').slice(-2, -1)[0] : path.split('/').pop()!.replace('.png', ''));
/** Base-sheet geometry: the original sheet's cell (W×H, cols) the 352-cells were cut from, for mask/layer remapping. */
export const BASE_GEOM: Record<string, { W: number; H: number; cols: number; orig: string; ox: number; oy: number }> = {};
let BASE_MODE = false;
/** The clean base character (no hair / clothes / weapon), male or female. Its drawn moves are listed per gender in
 *  naked-anims.json (tools/base/naked_frames.py); every other move shows him / her standing until it is drawn.
 *  MapleStory head: every frame wears the standing head (same drawing); naked-heads.json = where it sits per frame
 *  (cell px from the standing head) — the anchors follow it. The run has its own 4 frames (strides in the air). */
import NAKED_LIST from '../data/naked-anims.json';
import NAKED_HEADS_LIST from '../data/naked-heads.json';
import NAKED_LOOK_LIST from '../data/naked-look.json';
import NAKED_BLADES_LIST from '../data/naked-blades.json';
const NAKED = NAKED_LIST as Record<string, Record<string, number>>;
const NAKED_HEADS = NAKED_HEADS_LIST as Record<string, Record<string, number[][]>>;
/** The sword in hand per frame: its line [guardX, guardY, tipX, tipY], cell px from the feet (Radiant Blade's lightning
 *  lands on its tip and the blade of light grows along it). */
const NAKED_BLADES = NAKED_BLADES_LIST as Record<string, Record<string, (number[] | null)[]>>;
const nakedKey = (g: string, anim = 'idle') => `naked-${g}-${anim}`;
/** The base character's look, drawn as layers on the frame (MapleStory): back hair behind the body, the face, the forehead
 *  between the bangs and the front hair on the head (they move with it: naked-heads.json), the sword arm again where it
 *  passes in front of the head (<move>_o.png); the skin tone re-shades the skin of every layer (characters/Skin.ts). */
export interface BaseLook { hair: number; hairColor: number; skin: number; face: number }
/** Per gender: hairstyles (and which have a forehead layer), hair colours, faces (0 = the head's own), moves with a
 *  sword-arm strip (tools/base/naked_frames.py). */
export const NAKED_LOOK = NAKED_LOOK_LIST as Record<string, { styles: number; colors: number; gaps: boolean[]; faces: number; over: string[]; gear?: Partial<Record<GearPiece, string[]>>; swordCell?: number }>;
/** Worn gear drawn on the base character, per move (tools/base/naked_frames.py: naked/<g>/gear/<move>_<piece>[_c<colour>].png,
 *  same frames as the body strip): the clothes in their colour, the sword in hand; 'topo' = the shirt again over the sword
 *  arm where that arm is drawn over the hair (<move>_o.png). naked-look.json lists the moves each has. */
export type GearPiece = 'top' | 'topo' | 'pants' | 'shoes' | 'sword';
export interface GearLook { weapon: boolean; top: number; pants: number; shoes: number }
const gearColor = (w: GearLook, p: GearPiece) => (p === 'sword' ? (w.weapon ? 0 : -1) : p === 'topo' ? w.top : w[p]);
export const gearKey = (g: string, anim: string, p: GearPiece, c: number) => `ng-${g}-${anim}-${p}${p === 'sword' ? '' : `-c${c}`}`;
const gearPath = (g: string, anim: string, p: GearPiece, c: number) => `assets/final/body/naked/${g}/gear/${anim}_${p}${p === 'sword' ? '' : `_c${c}`}.png`;
/** The worn pieces' strips for this move: [piece, texture key] (drawn when loaded). */
export function gearLayers(g: string, anim: string, w: GearLook | null): [GearPiece, string][] {
  const have = NAKED_LOOK[g]?.gear; if (!w || !have) return [];
  return (['pants', 'shoes', 'top', 'topo', 'sword'] as GearPiece[]).filter((p) => gearColor(w, p) >= 0 && have[p]?.includes(anim)).map((p) => [p, gearKey(g, anim, p, gearColor(w, p))]);
}
/** Queue the worn pieces' strips for every move (in a preload, or now with start = true). */
export function loadGear(scene: Phaser.Scene, g: string, w: GearLook | null, start = false): void {
  const have = NAKED_LOOK[g]?.gear; if (!w || !have) return;
  let queued = false;
  for (const [p, anims] of Object.entries(have) as [GearPiece, string[]][]) {
    const c = gearColor(w, p); if (c < 0) continue;
    for (const anim of anims) {
      const k = gearKey(g, anim, p, c);
      if (scene.textures.exists(k) || pending(scene, k)) continue;
      // the sword's cells are wider than the body's (a thrust reaches past it), the same middle: drawn centred the same
      scene.load.spritesheet(k, gearPath(g, anim, p, c), { frameWidth: p === 'sword' ? NAKED_LOOK[g]?.swordCell ?? CELL : CELL, frameHeight: CELL }); queued = true;
    }
  }
  if (queued && start && !scene.load.isLoading()) scene.load.start();
}
export const hairLayerKey = (g: string, l: BaseLook, part: 'f' | 'b') => `nh-${g}-h${l.hair}c${l.hairColor}-${part}`;
export const gapLayerKey = (g: string, l: BaseLook) => `nh-${g}-h${l.hair}-gap`;
export const faceLayerKey = (g: string, l: BaseLook) => `nf-${g}-f${l.face}`;
export const overKey = (g: string, anim: string) => `naked-${g}-${anim}-o`;
export const hasOver = (g: string, anim: string) => !!NAKED_LOOK[g]?.over.includes(anim);
const hasHair = (g: string, l: BaseLook) => l.hair >= 0 && l.hair < (NAKED_LOOK[g]?.styles ?? 0);
/** A look from elsewhere (another player) made safe: whole indices in range (hair −1 = bald), defaults for the rest. */
export function cleanLook(g: string, raw: unknown, defaultSkin: number, skins: number): BaseLook | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>, n = NAKED_LOOK[g];
  const ix = (v: unknown, max: number, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max ? v : d);
  return { hair: ix(o.hair, n?.styles ?? 0, -1), hairColor: ix(o.hairColor, n?.colors ?? 1, 0), skin: ix(o.skin, skins, defaultSkin), face: ix(o.face, n?.faces ?? 1, 0) };
}
/** The look's layers that exist for this gender: [texture key, file, re-shaded with the skin]. */
export function baseLookLayers(g: string, l: BaseLook): { b?: [string, string]; face?: [string, string]; gap?: [string, string]; f?: [string, string] } {
  const D = `assets/final/body/naked/${g}`, out: ReturnType<typeof baseLookLayers> = {};
  if (hasHair(g, l)) {
    out.b = [hairLayerKey(g, l, 'b'), `${D}/hair/h${l.hair}c${l.hairColor}_back.png`];
    out.f = [hairLayerKey(g, l, 'f'), `${D}/hair/h${l.hair}c${l.hairColor}_front.png`];
    if (NAKED_LOOK[g]?.gaps[l.hair]) out.gap = [gapLayerKey(g, l), `${D}/hair/h${l.hair}_gap.png`];
  }
  if (l.face > 0 && l.face < (NAKED_LOOK[g]?.faces ?? 1)) out.face = [faceLayerKey(g, l), `${D}/face/f${l.face}.png`];
  return out;
}
/** Queue a look's layers (in a preload, or now with start = true); until they arrive the base shows without them. */
export function loadBaseLook(scene: Phaser.Scene, g: string, l: BaseLook | null, start = false): void {
  if (!l) return;
  let queued = false;
  for (const kf of Object.values(baseLookLayers(g, l))) if (kf && !scene.textures.exists(kf[0]) && !pending(scene, kf[0])) { scene.load.image(kf[0], kf[1]); queued = true; }
  if (queued && start && !scene.load.isLoading()) scene.load.start();
}
const NAKED_HEAD_DROP = 10; // his bald head top sits this much (cell px) lower than the beginner's hair top
/** The base character's skills (MapleStory: a small set of drawn body poses, every skill plays a few of them while its
 *  effect carries the move): per skill the poses of its start-up, active and recovery parts, each part spread evenly
 *  over its time, as 'move:frame' ('!' = mirrored, facing the other way). The drawn sets: swing1 (overhead swing:
 *  wind-up, strike, follow-through), swing2 (horizontal: drawn back, strike, follow-through), swing3 (rising: low,
 *  mid, high), alert (combat stance), run (the sword trailing behind), high (0 sword to the sky, 1 sword upright in
 *  both hands, 2 fist raised), low (0 sword planted in the ground, 1 deep lunge thrust, 2 open hand thrust forward),
 *  air (0 rising leap with the sword up, 1 leap with the sword overhead, 2 slash down in the air). A pose whose set is
 *  not drawn yet plays its stand-in (NB_STAND_IN). */
const NB: Record<string, { st: string[]; ac: string[]; rc: string[] }> = {
  wave_slash: { st: ['swing2:0'], ac: ['swing2:1'], rc: ['swing2:2', 'alert:0'] }, // the blade drawn back while it charges, then the release
  dash_slash: { st: ['alert:0', 'run:2'], ac: ['run:3', 'low:1', 'low:1'], rc: ['low:1', 'swing2:2', 'alert:0'] }, // charge with the sword trailing, thrust
  rising_slash: { st: ['swing3:0'], ac: ['air:0', 'air:0', 'swing3:2'], rc: ['swing3:2', 'alert:0'] },
  ground_breaker: { st: ['alert:0', 'swing1:0', 'swing1:0'], ac: ['swing1:1', 'low:0', 'low:0', 'low:0'], rc: ['low:0', 'alert:0'] }, // overhead, smash, sword in the earth
  sanctuary: { st: ['swing3:0', 'swing3:1', 'swing3:0', 'high:1'], ac: ['high:1'], rc: ['high:1', 'alert:0'] }, // traces the ground, then the sword upright
  iron_oath: { st: ['alert:0', 'high:1', 'high:1'], ac: ['high:1'], rc: ['high:1', 'alert:0'] }, // the oath: sword held upright before him
  legacy_banner: { st: ['alert:0', 'high:0', 'high:0', 'high:0'], ac: ['low:0'], rc: ['low:0', 'low:0', 'alert:0'] }, // to the sky, then planted
  blade_storm: { st: ['alert:1', 'high:0'], ac: ['high:0'], rc: ['high:0', 'alert:0'] }, // sword to the sky, held through the storm
  titans_verdict: { st: ['alert:1', 'high:0', 'high:0', 'high:0', 'high:0', 'air:1', 'air:1'], ac: ['air:2', 'low:0', 'low:0'], rc: ['low:0', 'low:0', 'alert:0'] },
  leap_crash: { st: ['alert:1'], ac: ['air:1', 'air:1', 'air:2', 'air:2'], rc: ['low:0', 'low:0', 'alert:0'] }, // leap overhead, crash, sword in the earth
  radiant_blade: { st: ['alert:0', 'high:1', 'high:0', 'high:0', 'high:0', 'high:0', 'high:0'], ac: ['swing1:1'], rc: ['swing1:2', 'alert:0'] },
  lance_thrust: { st: ['swing2:0'], ac: ['low:1', 'low:1', 'low:1', 'low:1', 'swing3:2'], rc: ['swing3:2', 'alert:0'] }, // skewered on the lunge, ripped up
  war_cry: { st: ['alert:0', 'low:0', 'low:0'], ac: ['high:2'], rc: ['high:2', 'alert:0'] }, // sword into the ground, the roar with a raised fist
  judgment_blade: { st: ['jump:0', 'high:2'], ac: ['low:2'], rc: ['low:2', 'jump:0'] }, // the leap up, the fist raised while the blade gathers, hurled, in the air
};
/** Skills played with the hand free: the sword is not drawn while they play (Judgment Blade: no sword at all). */
const NB_BARE = new Set(['judgment_blade']);
const JB_RISE_MS = 380; // Judgment Blade's leap up (LegacyCourtyardScene): the jump pose while rising
/** Until a pose set is drawn, the nearest drawn pose stands in. */
const NB_STAND_IN: Record<string, string> = { 'high:0': 'swing1:0', 'high:1': 'swing1:1', 'high:2': 'alert:1', 'low:0': 'swing1:2', 'low:1': 'swing2:1',
  'low:2': 'swing2:1', 'air:0': 'swing3:2', 'air:1': 'swing1:0', 'air:2': 'swing1:2' };
/** Whirlwind: drawn back, then spinning (the horizontal strike, facing one way then the other), then the follow-through. */
const SPIN_MS = 70;
function nakedSkillBeat(q: Extract<PoseQuery, { k: 'skill' }>): string | null {
  const { elapsed: e, startup: s, active: a, recovery: r } = q;
  if (q.id === 'whirlwind') return e < s ? 'swing2:0' : e < s + a ? (Math.floor((e - s) / SPIN_MS) % 2 ? 'swing2:1!' : 'swing2:1') : e < s + a + r * 0.5 ? 'swing2:2' : 'alert:0';
  const plan = NB[q.id]; if (!plan) return null;
  if (q.id === 'judgment_blade' && e < s) return s > 120 && e < JB_RISE_MS ? plan.st[0] : plan.st[1]; // (a follow-up throw: no leap)
  const act = Math.max(a, 120);
  if (e < s) return pick(plan.st, e / Math.max(1, s));
  if (e < s + act) return pick(plan.ac, (e - s) / act);
  return pick(plan.rc, (e - s - act) / Math.max(1, r - (act - a)));
}
function nakedPose(cls: string, dir: Dir, g: 'male' | 'female', q: PoseQuery): PoseFrame {
  let f = sheetPose(cls, dir, { k: 'loop', state: 'idle', t: 0, speed: 0 }); // the standing beginner's anchors (head, chest)
  const has = NAKED[g] ?? {};
  let anim = 'idle', frame = 0;
  if (q.k === 'loop' && (q.state === 'walk' || q.state === 'run') && has.walk) {
    anim = q.state === 'run' && has.run ? 'run' : 'walk';
    const c = baseLoop(q.state, q.speed); frame = Math.floor((q.t * c.fps) / 1000) % has[anim];
  } else if (q.k === 'loop' && q.state === 'alert' && has.alert) { anim = 'alert'; frame = Math.floor(q.t / 500) % has.alert; } // 0.5 s a frame (Maple)
  else if (q.k === 'jump' && q.phase !== 'land' && has.jump) anim = 'jump'; // Maple: one frame the whole time off the ground
  else if ((q.k === 'recovery' || q.k === 'hurt' || q.k === 'down' || q.k === 'getup') && has.alert) anim = 'alert'; // Maple: after a swing / when hit, the combat stance
  else if (q.k === 'launched' && has.jump) anim = 'jump'; // thrown up into the air: the jump's one frame
  else if (q.k === 'skill' && q.id === 'warrior_basic' && has.swing1) { // a sword swing (Maple: one of the drawn ones at random)
    const sw = ['swing1', 'swing2', 'swing3'].filter((a) => has[a]);
    anim = sw[(q.seed ?? 0) % sw.length]; frame = q.elapsed < q.startup ? 0 : q.elapsed < q.startup + q.active * 0.5 ? 1 : 2; // wind-up, strike, follow-through
  } else if (q.k === 'skill') { // the skill's poses (drawn, or their stand-ins)
    let beat = nakedSkillBeat(q);
    if (beat) {
      const mirrored = beat.endsWith('!'); beat = beat.replace('!', '');
      const ok = (b: string) => { const [a_, f_] = b.split(':'); return (has[a_] ?? 0) > +f_; };
      if (!ok(beat) && NB_STAND_IN[beat]) beat = NB_STAND_IN[beat];
      if (ok(beat)) {
        const [a_, f_] = beat.split(':'); anim = a_; frame = +f_;
        if (mirrored) f = { ...f, flip: !f.flip, anchor: f.anchor ? f.anchor.map((v, i) => (i % 2 === 0 ? -v : v)) : null };
      }
    }
  }
  const key = nakedKey(g, anim), [hx, hy] = NAKED_HEADS[g]?.[anim]?.[frame] ?? [0, 0], fx = f.flip ? -1 : 1;
  const bare = q.k === 'skill' && NB_BARE.has(q.id); // no sword in hand
  const bl = bare ? null : NAKED_BLADES[g]?.[anim]?.[frame], blade = bl ? bl.map((v, i) => v * SHEET_SCALE * (i % 2 === 0 ? fx : 1)) : null; // (mirrored with the frame)
  const swing = q.k === 'skill' && q.id === 'warrior_basic';
  return { ...f, key, frame, wkey: `${key}-w`, blade, bladeBehind: false, hair: null, head: null, naked: { g, anim, frame, hx, hy, bare, swing },
    anchor: f.anchor ? f.anchor.map((v, i) => (i % 2 === 0 ? v + hx * fx * SHEET_SCALE : v + (hy + (i === 1 ? NAKED_HEAD_DROP : 0)) * SHEET_SCALE)) : null };
}
/** The sword's afterimage between two frames of a regular attack's swing (MapleStory: a thin trail of light behind the
 *  blade, nothing else): the outer part of the band the blade sweeps, as its outer edge (the tip's path) and inner edge,
 *  cell px from the feet, facing right. Overhead (swing1): over and down; rising (swing3): under and up; the level cut
 *  (swing2) passes in front of the body: a flat, slightly sagging streak; a follow-through turns the short way. */
export function swingTrail(g: string, anim: string, a: number, b: number): { outer: number[][]; inner: number[][] } | null {
  const A = NAKED_BLADES[g]?.[anim]?.[a], B = NAKED_BLADES[g]?.[anim]?.[b];
  if (!A || !B) return null;
  const N = 16, IN = 0.42, outer: number[][] = [], inner: number[][] = [];
  const ang = (l: number[]) => Math.atan2(l[3] - l[1], l[2] - l[0]), len = (l: number[]) => Math.hypot(l[2] - l[0], l[3] - l[1]);
  const flat = anim === 'swing2' && a === 0, turn = anim === 'swing1' ? 1 : anim === 'swing3' ? -1 : 0;
  const a0 = ang(A); let a1 = ang(B);
  if (turn > 0) while (a1 <= a0) a1 += 2 * Math.PI;
  else if (turn < 0) while (a1 >= a0) a1 -= 2 * Math.PI;
  else { while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI; }
  for (let i = 0; i <= N; i++) {
    const t = i / N, gx = A[0] + (B[0] - A[0]) * t, gy = A[1] + (B[1] - A[1]) * t;
    if (flat) {
      const tx = A[2] + (B[2] - A[2]) * t, ty = A[3] + (B[3] - A[3]) * t, s = Math.sin(Math.PI * t);
      outer.push([tx, ty + 16 * s]); inner.push([tx, ty + 3 * s]);
    } else {
      const an = a0 + (a1 - a0) * t, L = len(A) + (len(B) - len(A)) * t;
      outer.push([gx + Math.cos(an) * L, gy + Math.sin(an) * L]); inner.push([gx + Math.cos(an) * L * IN, gy + Math.sin(an) * L * IN]);
    }
  }
  return { outer, inner };
}
/** Base body available for this animation (sheet baked)? */
export const hasBase = (cls: string, anim: string): boolean => cls === 'warrior' && BASE_ANIMS.has(anim);
/** Every animation the warrior uses has its base strip (death is the ghost and recovery is react's stance: no frames). */
const BASE_NEEDED = ['air_attack', 'blade_storm', 'dash_slash', 'ground_breaker', 'idle', 'iron_grip', 'judgment_blade', 'jump', 'lance_thrust', 'leap_crash', 'radiant_blade', 'react', 'rising_slash', 'run', 'sanctuary', 'shield_slam', 'titans_verdict', 'walk', 'war_cry', 'warrior_basic', 'wave_slash', 'whirlwind'];
export const baseComplete = (cls: string): boolean => cls === 'warrior' && BASE_NEEDED.every((a) => BASE_ANIMS.has(a));

function headOf(path: string, row: number, c: number): number[] | null {
  const h = (HEADS as unknown as Record<string, (number[] | null)[][]>)[path]?.[row]?.[c];
  return h ? [h[0] * SHEET_SCALE, h[1] * SHEET_SCALE, h[2]] : null;
}

/** Mirror x-values (even indices up to `n`) of an anchor list for a flipped frame. */
const mirror = (a: number[] | null | undefined, xs: number[]): number[] | null => (a ? a.map((v, i) => (xs.includes(i) ? -v : v)) : null);

function sheetFrame(key: string, path: string, dir: Dir, col: number, cols: number, ch = CELL): PoseFrame {
  // Side view only: the left-facing pose is the right-facing art mirrored (one drawing per frame, like MapleStory).
  const flip = dir === 'left', row = ROW[flip ? 'right' : dir];
  const c = Math.max(0, Math.min(cols - 1, col));
  const table = ANCH[path] as (number[] | null)[][] | undefined;
  const f: PoseFrame = { key, frame: row * cols + c, wkey: `${key}-w`, ox: 0.5, oy: (ch - CELL * (1 - ORIGIN_Y)) / ch, scale: SHEET_SCALE, anchor: scaleAnchor(table?.[row]?.[c], SHEET_SCALE), hair: scaleHair(table?.[row]?.[c], SHEET_SCALE), blade: ((BLADES as Record<string, (number[] | null)[][]>)[path]?.[row]?.[c] ?? null)?.map((v) => v * SHEET_SCALE) ?? null, bladeBehind: !!(BEHIND as Record<string, number[][]>)[path]?.[row]?.[c], head: headOf(path, row, c) };
  if (BASE_MODE) { const anim = animOf(path); if (BASE_ANIMS.has(anim)) { // 352-cell base strip, same anchors…
    const bc = baseCol(anim, c); // (strips trimmed to the frames the game shows)
    f.key = baseKey(anim); f.wkey = `${f.key}-w`; f.frame = bc; f.oy = ORIGIN_Y;
    const bl = (BASE_BLADES as Record<string, (number[] | null)[]>)[anim]?.[bc]; // …but its own sword line (the base frames were redrawn)
    f.blade = bl ? bl.map((v) => v * SHEET_SCALE) : null; f.bladeBehind = false;
  } }
  if (flip) { f.flip = true; f.anchor = mirror(f.anchor, [0, 2, 4]); f.hair = mirror(f.hair, [0]); f.blade = mirror(f.blade, [0, 2]); f.head = mirror(f.head, [0, 2]); }
  return f;
}

function atlasPose(cls: string, dir: Dir, act: AtlasAction, i: number): PoseFrame {
  const a = ATLAS[cls], rects = a.directions[dir][act];
  const idx = Math.max(0, Math.min(rects.length - 1, i)), r = rects[idx];
  const oy = act === 'jump' ? Math.min(1, (r.ay - r.y) / r.h) : (r.ay - r.y) / r.h;
  const k = a.scaleByDirection[dir];
  const table = ANCH[`atlas:${cls}`] as Record<string, (number[] | null)[]> | undefined;
  return { key: atlasKey(cls), frame: atlasFrame(dir, act, idx), wkey: `${atlasKey(cls)}-w`, ox: (r.ax - r.x) / r.w, oy, scale: k, anchor: scaleAnchor(table?.[`${dir}-${act}`]?.[idx], k) };
}
const atlasCount = (cls: string, dir: Dir, act: AtlasAction) => ATLAS[cls].directions[dir][act].length;

// ------------------------------------------------------------------ pose queries

export type PoseQuery =
  | { k: 'loop'; state: 'idle' | 'walk' | 'run' | 'alert'; t: number; speed: number } // alert: combat stance after an attack / a hit (MapleStory)
  | { k: 'jump'; phase: 'takeoff' | 'rise' | 'apex' | 'fall' | 'land'; t: number }
  | { k: 'airAttack'; p: number }
  | { k: 'hurt'; p: number }
  | { k: 'launched'; vz: number }
  | { k: 'down'; p: number } // knockdown fall → lying (p 0..1)
  | { k: 'getup'; p: number }
  | { k: 'recovery'; p: number }
  | { k: 'death'; p: number }
  | { k: 'skill'; id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number; seed?: number };

/** Beginner base body locomotion: 4 key poses per cycle (contact, passing, contact, passing — legs one after the other);
 *  the run plays the same legs faster, leaning forward, the strides off the ground. contact = the frames a foot lands
 *  (dust puffs): the run lands on the passing frames. */
export const baseLoop = (state: 'walk' | 'run', speed: number): { n: number; fps: number; contact: number[] } => state === 'walk'
  ? { n: 4, fps: 7 * Math.max(0.7, Math.min(1.2, speed / 188)), contact: [0, 2] }
  : { n: 4, fps: 13 * Math.max(0.75, Math.min(1.15, speed / 270)), contact: [1, 3] }; // the steps keep up with the ground

const pick = <T,>(list: T[], p: number): T => list[Math.max(0, Math.min(list.length - 1, Math.floor(p * list.length)))];

/** base = draw the beginner-clothes base body (fashion cosmetics) instead of the class armour, where baked. */
/** Pose query once the combat stance is folded into standing (bodies without stance frames). */
type BodyQuery = Exclude<PoseQuery, { k: 'loop' }> | { k: 'loop'; state: 'idle' | 'walk' | 'run'; t: number; speed: number };
export function resolvePose(cls: ClassKey, dir: Dir, q: PoseQuery, base = false, gender?: 'male' | 'female'): PoseFrame {
  BASE_MODE = base && cls === 'warrior';
  try {
    if (BASE_MODE && gender) return nakedPose(cls, dir, gender, q); // the clean base character (its look: ActorView layers)
    const b: BodyQuery = q.k === 'loop' && q.state === 'alert' ? { ...q, state: 'idle' } : (q as BodyQuery);
    return isSheetClass(cls) ? sheetPose(cls, dir, b) : atlasPoseFor(cls, dir, b);
  } finally { BASE_MODE = false; }
}

const moveCols = (cls: string, st: MoveState) => (st === 'air_attack' && cls === 'warrior' ? 8 : MOVE_COLS[st]);
function mv(cls: string, st: MoveState, dir: Dir, col: number): PoseFrame { return sheetFrame(sheetKey(cls, st), sheetPath(cls, st), dir, col, moveCols(cls, st)); }

function sheetPose(cls: string, dir: Dir, q: BodyQuery): PoseFrame {
  switch (q.k) {
    case 'loop': {
      if (q.state === 'idle') { // agreed look: the body never breathes / grows / shrinks — one still frame (separately painted idle frames flicker)
        if (cls === 'warrior' && !BASE_MODE) return mv(cls, 'idle', dir, Math.floor((q.t * 10) / 1000) % 12); // wind-blown cape cycle only, body stays still
        return mv(cls, 'idle', dir, 0);
      }
      if (BASE_MODE && cls === 'warrior') { const c = baseLoop(q.state, q.speed); return mv(cls, q.state, dir, Math.floor((q.t * c.fps) / 1000) % c.n); }
      if (q.state === 'walk') { // 8-frame cycles (down/up rows of the old 6-frame art until replaced)
        const n = cls === 'warrior' ? 8 : 6;
        const fps = (n === 8 ? 10 : 8) * Math.max(0.7, Math.min(1.2, q.speed / 188));
        return mv(cls, 'walk', dir, Math.floor((q.t * fps) / 1000) % n);
      }
      const fps = 13 * Math.max(0.75, Math.min(1.15, q.speed / 270));
      return mv(cls, 'run', dir, Math.floor((q.t * fps) / 1000) % 8);
    }
    case 'jump': {
      const col = { takeoff: q.t < 40 ? 0 : 1, rise: q.t < 120 ? 2 : 3, apex: 4, fall: q.t < 120 ? 5 : 6, land: 7 }[q.phase];
      return mv(cls, 'jump', dir, col);
    }
    case 'airAttack': { const n = moveCols(cls, 'air_attack'); return mv(cls, 'air_attack', dir, Math.min(n - 1, Math.floor(q.p * n))); }
    // warrior reaction sheet: 0 hit, 1 heavy stagger, 2 launched, 3 knocked down, 4–6 getting up, 7 stance
    case 'hurt': return cls === 'warrior' ? mv(cls, 'react', dir, q.p < 0.5 ? 0 : 1) : mv(cls, 'hurt', dir, Math.min(3, Math.floor(q.p * 4)));
    // No lying down (MapleStory-style): launched / knocked down / getting up all read as the heavy stagger, pushed back.
    case 'launched': return cls === 'warrior' ? mv(cls, 'react', dir, 1) : mv(cls, 'hurt', dir, q.vz > 0 ? 1 : 2);
    case 'down': return cls === 'warrior' ? mv(cls, 'react', dir, 1) : mv(cls, 'hurt', dir, 2);
    case 'getup': return cls === 'warrior' ? mv(cls, 'react', dir, q.p < 0.5 ? 1 : 0) : mv(cls, 'hurt', dir, 0);
    case 'recovery': return BASE_MODE ? mv(cls, 'react', dir, 7) : mv(cls, 'recovery', dir, 1 + Math.min(2, Math.floor(q.p * 3))); // base body: the stance frame (no recovery sheet)
    case 'death': return BASE_MODE ? mv(cls, 'react', dir, 1) : mv(cls, 'death', dir, Math.min(7, Math.floor(q.p * 8))); // base body: no fall frames (the ghost)
    case 'skill': {
      if (q.id in POSE_AS_BASIC && CELLS.warrior_basic) { // e.g. Wave Slash (R): the regular attack's swing — wind-up, then the strike
        const B = CELLS.warrior_basic, st = POSE_AS_BASIC[q.id];
        return sheetFrame(skillKey(cls, 'warrior_basic'), skillPath(cls, 'warrior_basic'), dir, 2 * st + (q.elapsed < q.startup ? 0 : 1), B.cols, B.h);
      }
      const sk = FINAL_SKILLS.find((s) => s.id === bodyIdOf(q.id));
      const bid = bodyIdOf(q.id), cols = CELLS[bid]?.cols ?? (sk && sk.slot === 7 ? 12 : sk && sk.slot === 6 ? 10 : 6);
      if (q.id === 'radiant_blade' && q.elapsed >= q.startup * 0.3 && q.elapsed < q.startup) { // hold: sword to the sky, LOOKING UP (Blade Storm's hold frames)
        const bs = CELLS['blade_storm'];
        if (bs) return sheetFrame(skillKey(cls, 'blade_storm'), skillPath(cls, 'blade_storm'), dir, 3 + (Math.floor(q.elapsed / 140) % 3), bs.cols, bs.h);
      }
      if (sk?.chain && CELLS[bid]) { // basic chain sheet: 2 frames per strike (wind-up during startup, the hit from the active start)
        const st = Math.max(0, Math.min(3, q.stage));
        return sheetFrame(skillKey(cls, q.id), skillPath(cls, q.id), dir, 2 * st + (q.elapsed < q.startup ? 0 : 1), cols, CELLS[bid].h);
      }
      if (sk?.chain && q.stage === 2) { // third chain strike: the big overhead swing of the air-attack set
        const p = q.elapsed / (q.startup + q.active + q.recovery);
        const n = moveCols(cls, 'air_attack');
        return mv(cls, 'air_attack', dir, Math.min(n - 1, Math.floor(p * n)));
      }
      const col = skillColumn(cols, q, sk?.chain && (q.stage === 1 || q.stage === 3) ? 1 : 0);
      return sheetFrame(skillKey(cls, q.id), skillPath(cls, q.id), dir, col, cols, CELLS[bid]?.h);
    }
  }
}

/** Column of a skill body for the run phase: anticipation in startup, release exactly at the active start. */
/** Per-skill column plans where the art's beats differ from the default split. */
const SKILL_PLAN: Record<string, { st: number[]; ac: number[]; rc: number[] }> = { judgment_blade: { st: [0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4], ac: [5, 6, 6], rc: [7] }, leap_crash: { st: [0], ac: [1, 2, 2, 3, 3, 4], rc: [4, 5] },
  titans_verdict: { st: [0, 1, 1, 1, 2, 2, 3, 4, 5], ac: [6], rc: [6, 6, 7, 7] },
  rising_slash: { st: [0, 1, 2], ac: [3, 3, 4, 4, 5], rc: [5, 6, 7] },
  ground_breaker: { st: [0, 1, 2, 2, 3], ac: [4, 5, 5, 5], rc: [5, 6, 7] },
  dash_slash: { st: [0, 1], ac: [2, 3, 4, 5], rc: [5, 6, 6, 6, 7] },
  shield_slam: { st: [0, 1, 2], ac: [3, 3, 4, 4, 5], rc: [6, 7] },
  blade_storm: { st: [0, 1, 2], ac: Array.from({ length: 30 }, (_, i) => 3 + (i % 3)), rc: [2, 1, 0] }, // sword to the sky, looking up, cape fluttering for the whole storm
  wave_slash: { st: [0, 1, 1, 1, 1, 1, 1, 2], ac: [3, 4, 4, 5], rc: [5, 6, 7] },
  iron_grip: { st: [0, 1], ac: [2, 3, 3, 4, 5, 5], rc: [6, 7] },
  radiant_blade: { st: [0, 1, 2, 3, 3, 4, 4, 4, 4, 5], ac: [6], rc: [6, 7, 7] }, // raise, hold for the lightning, brace, sweep down, ready
  sanctuary: { st: [0, 1, 2, 3, 4, 5], ac: [6, 6], rc: [6, 7] },
  lance_thrust: { st: [0, 1], ac: [2, 3, 2, 3, 4, 5], rc: [6, 7] },
  war_cry: { st: [0, 1, 2, 3], ac: [3, 4, 4, 4, 4, 4, 4, 4, 4], rc: [5, 6, 7] },
  iron_oath: { st: [0, 1, 2, 3, 4, 5], ac: [6, 6], rc: [6, 7] }, // traces the oath circle (Sanctuary's moves)
  legacy_banner: { st: [0, 1, 2, 3, 4, 4, 5], ac: [6], rc: [6, 7, 7] } }; // sword to the sky, then down (Radiant Blade's moves)

function skillColumn(cols: number, q: Extract<PoseQuery, { k: 'skill' }>, offset: number): number {
  const { elapsed: e, startup: s, active: a, recovery: r } = q;
  const plan = SKILL_PLAN[q.id] ?? (cols === 12 ? { st: [0, 1, 2, 3], ac: [4, 5, 6, 7, 8, 9], rc: [10, 11] }
    : cols === 10 ? { st: [0, 1], ac: [2, 3, 4, 5, 6, 7, 8], rc: [9] }
      : { st: [0 + offset, 1], ac: [2, 3, 4], rc: [5] });
  if (q.id === 'whirlwind') { // true 360° spin: wind-up, 8-angle loop for the whole channel, off-balance finish
    if (e < s) return 0;
    if (e < s + a) return 1 + (Math.floor((e - s) / 45) % 8);
    return 9;
  }
  const act = Math.max(a, 120);
  if (e < s) return pick(plan.st, e / Math.max(1, s));
  if (e < s + act) return pick(plan.ac, (e - s) / act);
  return pick(plan.rc, (e - s - act) / Math.max(1, r - (act - a)));
}

// ---- archer / samurai sequences (base-sheet poses; attack 0 nock/guard, 1 draw/lunge, 2 full draw/slash, 3 release/follow)
type AP = [AtlasAction, number];
interface Seq { st: AP[]; ac: AP[]; rc: AP[] }
const at = (...i: number[]): AP[] => i.map((n) => ['attack', n] as AP);
const SEQ: Record<string, Seq> = {
  quick_shot: { st: at(1, 2), ac: at(3), rc: [['attack', 3], ['idle', 0]] },
  multi_shot: { st: at(0, 1, 2), ac: at(3, 2, 3), rc: [['attack', 3], ['idle', 0]] },
  piercing_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  explosive_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  vine_trap: { st: [['attack', 0], ['jump', 2]], ac: [['jump', 2]], rc: [['jump', 2], ['idle', 0]] },
  rain_of_arrows: { st: at(0, 1, 2), ac: at(3, 2, 3, 2, 3), rc: [['attack', 3], ['idle', 0]] },
  skyhunters_step: { st: [['jump', 2], ['attack', 1]], ac: [['jump', 0], ['attack', 2], ['attack', 3], ['attack', 2], ['attack', 3], ['jump', 1], ['attack', 3]], rc: [['jump', 2], ['idle', 0]] },
  sky_rain: { st: [['attack', 0], ['jump', 2], ['attack', 1], ['attack', 2]], ac: [['attack', 2], ['attack', 3], ['attack', 2], ['attack', 3]], rc: [['attack', 3], ['jump', 2], ['idle', 0]] },
  rising_arrow: { st: at(0, 1, 2), ac: at(3), rc: [['attack', 3], ['idle', 0]] },
  leaping_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  retreat_kick: { st: [['attack', 0]], ac: [['jump', 0], ['jump', 2], ['jump', 2]], rc: [['jump', 2], ['idle', 0]] },
  bow_haste: { st: [['idle', 0], ['attack', 0]], ac: at(1), rc: [['attack', 0], ['idle', 0]] },
  hunters_spirit: { st: [['idle', 0], ['attack', 0]], ac: at(1), rc: [['attack', 0], ['idle', 0]] },
  hunters_roar: { st: at(0, 1), ac: at(2), rc: [['attack', 3], ['idle', 0]] },
  spirit_hawk: { st: [['idle', 0], ['attack', 0]], ac: at(1), rc: [['idle', 0]] },
  tree_of_life: { st: [['attack', 0], ['jump', 2]], ac: [['jump', 2]], rc: [['jump', 2], ['idle', 0]] },
  arrow_storm: { st: at(1, 2), ac: at(3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2), rc: [['attack', 3], ['idle', 0]] },
  eagle_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  quick_slash: { st: at(0), ac: at(1, 2), rc: at(3) },
  shadow_step: { st: [['run', 1]], ac: [['run', 3], ['attack', 2]], rc: [['attack', 3], ['idle', 0]] },
  spin_cut: { st: at(0), ac: at(2, 1, 2), rc: [['attack', 3], ['idle', 0]] },
  iai_strike: { st: at(0, 0), ac: at(2), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  sword_wave: { st: at(0, 1), ac: at(2), rc: [['attack', 3], ['idle', 0]] },
  mirage: { st: [['idle', 0], ['attack', 0]], ac: [['attack', 0]], rc: [['attack', 3], ['idle', 0]] },
  blossom_storm: { st: [['attack', 0], ['run', 1]], ac: [['attack', 2], ['run', 3], ['attack', 1], ['attack', 2], ['run', 3], ['attack', 2], ['attack', 3]], rc: [['attack', 3], ['idle', 0]] },
  dragon_eclipse: { st: [['attack', 0], ['jump', 2], ['run', 1]], ac: [['attack', 2], ['attack', 3]], rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
};
const CHAIN_SEQ: Record<string, Seq[]> = {
  quick_slash: [{ st: at(0), ac: at(1, 2), rc: at(3) }, { st: at(3), ac: at(2, 1), rc: at(0) }, { st: [['attack', 0], ['jump', 2]], ac: at(2, 3), rc: [['attack', 3], ['idle', 0]] }],
};
const MIN_ACTIVE = 110;

function atlasPoseFor(cls: string, dir: Dir, q: BodyQuery): PoseFrame {
  switch (q.k) {
    case 'loop': {
      const fps = q.state === 'idle' ? 5 : q.state === 'walk' ? 8 * Math.max(0.7, Math.min(1.2, q.speed / 188)) : 10 * Math.max(0.75, Math.min(1.15, q.speed / 270));
      const n = atlasCount(cls, dir, q.state);
      return atlasPose(cls, dir, q.state, Math.floor((q.t * fps) / 1000) % n);
    }
    case 'jump': {
      const fall = JUMP_FALL[cls]?.[dir] ?? 1;
      return atlasPose(cls, dir, 'jump', q.phase === 'rise' || q.phase === 'apex' ? 0 : q.phase === 'fall' ? fall : 2);
    }
    case 'airAttack': return atlasPose(cls, dir, 'attack', Math.min(3, Math.floor(q.p * 4)));
    case 'hurt': return atlasPose(cls, dir, 'hurt', q.p < 0.5 ? 0 : 1);
    case 'launched': return atlasPose(cls, dir, 'hurt', 1);
    case 'down': { const n = atlasCount(cls, dir, 'death'); return atlasPose(cls, dir, 'death', Math.min(n - 1, Math.floor(q.p * n))); }
    case 'getup': { const n = atlasCount(cls, dir, 'death'); return q.p < 0.6 ? atlasPose(cls, dir, 'death', Math.max(0, n - 2 - Math.floor(q.p * 2))) : atlasPose(cls, dir, 'hurt', 0); }
    case 'recovery': return q.p < 0.5 ? atlasPose(cls, dir, 'attack', 3) : atlasPose(cls, dir, 'idle', 0);
    case 'death': { const n = atlasCount(cls, dir, 'death'); return atlasPose(cls, dir, 'death', Math.min(n - 1, Math.floor(q.p * n))); }
    case 'skill': {
      const seq = CHAIN_SEQ[q.id]?.[q.stage] ?? SEQ[q.id] ?? { st: at(0, 1), ac: at(2), rc: at(3) };
      const act = Math.max(q.active, Math.min(MIN_ACTIVE, q.active + q.recovery));
      const e = q.elapsed;
      const [a, i] = e < q.startup ? pick(seq.st, e / Math.max(1, q.startup))
        : e < q.startup + act ? pick(seq.ac, (e - q.startup) / act)
          : pick(seq.rc, (e - q.startup - act) / Math.max(1, q.startup + q.active + q.recovery - q.startup - act));
      return atlasPose(cls, dir, a, i);
    }
  }
}

/** Apply a resolved pose to a body sprite (and its aligned weapon-mask sprite). */
export function applyPose(p: Phaser.GameObjects.Sprite, f: PoseFrame, weapon?: Phaser.GameObjects.Sprite | null): void {
  if (p.texture.key !== f.key || p.frame.name !== String(f.frame)) p.setTexture(f.key, f.frame);
  p.setOrigin(f.ox, f.oy).setScale(f.scale * (f.sx ?? 1), f.scale * (f.sy ?? 1)).setFlipX(!!f.flip);
  if (weapon && weapon.scene.textures.exists(f.wkey)) {
    if (weapon.texture.key !== f.wkey || weapon.frame.name !== String(f.frame)) weapon.setTexture(f.wkey, f.frame);
    weapon.setOrigin(f.ox, f.oy).setScale(f.scale * (f.sx ?? 1), f.scale * (f.sy ?? 1)).setFlipX(!!f.flip);
  }
}

/** Body facing from a vector. Side view only (MapleStory-style): the character faces right or left; moving or aiming
 *  up/down keeps the current horizontal facing. The front/back rows of the sheets are never shown. */
export function dirOf(x: number, y: number, fallback: Dir): Dir {
  const fb: Dir = fallback === 'left' ? 'left' : 'right';
  if (Math.abs(x) < 1e-6) return fb;
  return x > 0 ? 'right' : 'left';
}
/** An attack's direction in side view: to the side or to a corner, never straight up or down — within 22.5° of level it
 *  goes straight to the side, else along the 45° diagonal on that side (straight up / down: the facing side). */
export function sideAim(x: number, y: number, facing: number): { x: number; y: number } {
  const sx = Math.abs(x) < 1e-6 ? (facing < 0 ? -1 : 1) : Math.sign(x);
  if (Math.abs(y) <= Math.abs(x) * Math.tan(Math.PI / 8)) return { x: sx, y: 0 };
  return { x: sx * Math.SQRT1_2, y: Math.sign(y) * Math.SQRT1_2 };
}
/** Side-view facing for any stored/remote direction value. */
export const sideDir = (d: Dir | string): Dir => (d === 'left' ? 'left' : 'right');
