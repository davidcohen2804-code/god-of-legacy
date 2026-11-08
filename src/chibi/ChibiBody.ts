// THE CHIBI CHARACTERS — a prototype behind a flag (David 7 Nov: anime pixel art, light chibi, two facings in a
// three-quarter view; the archer first). `?chibi` (or `?chibi=2` / `?chibi=3`: the pixel scale) swaps the archer's
// painted body for the chibi one drawn from the same state (idle, walk, …); everything else — movement, skills,
// hitboxes, the camera — stays the game's own. Without the flag nothing changes.
// The art: tools/chibi/archer (parts drawn once on the integer grid, the bow its own layer drawn from numbers) →
// public/assets/chibi/<cls>/<cls>.png + .json (atlas) + .anims.json (frames, ms, loop, events, the bow grip).
import Phaser from 'phaser';
import type { PoseFrame, PoseQuery } from '../game/Body';
import type { Dir } from '../world/collision';
import { composeLook, parseDoll, type DollData, type Look } from './ChibiDoll';
import { resolveLook, savedSpec, type LookSpec } from './ChibiLooks';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
/** scale: world px per chibi pixel (0 = off). */
export const CHIBI = { scale: params?.has('chibi') ? Math.max(1, Math.round(Number(params.get('chibi')) || 2)) : 0 };
/** The classes drawn so far. */
const READY = new Set(['archer']);
/** Minimal motion (David 7 Nov 21:41, reviewed with GPT; tools/chibi/archer/src/minimal_R.py): the walk is 4 frames
 *  (rigid head, torso and bow; only the legs, a 1 px bob, the free arm and the hem move) — David chose it over the
 *  6-frame walk (7 Nov 23:06), which `&walk=6` still plays (the fallback). `&outfit=b` is the test outfit (a different
 *  tunic and boots: one torso drawing, one per leg pose — the 6-frame walk would need every frame redrawn),
 *  `&wms=150` sets its frame time on screen (165 ms by default — GPT's test values, 165 and 150; it doesn't slow with
 *  the walking speed the way the 6-frame walk does, which shows each of its frames ~157 ms at the walking speed).
 *  */
const TEST = {
  outfit: params?.get('outfit') === 'b' ? 'b' : '',
  walk4: params?.get('walk') !== '6' || params?.get('outfit') === 'b',
  pace: 165 / Math.max(80, Math.min(300, Number(params?.get('wms')) || 165)),
  /** the base body's removal test (GPT 7 Nov): `&strip=nohood|notunic|nocape|noboots|nobracers|tunicboots|base` */
  strip: params?.get('strip') ?? '',
};

interface AnimDef { frames: string[]; ms: number[]; loop: boolean; events: Record<string, number>; grip: ([number, number] | null)[] }
interface ChibiDef { frame: number; origin: [number, number]; height: number; facing: 'right' | 'left'; anims: Record<string, AnimDef> }
const defs = new Map<string, ChibiDef>();
const loading = new Set<string>();

export const chibiOn = (cls: string): boolean => CHIBI.scale > 0 && READY.has(cls);

/** Starts loading a class's chibi sprites (once); its pixels stay sharp (nearest filtering). `start`: false from a
 *  scene's preload (its own loading runs them). */
function load(scene: Phaser.Scene, cls: string, start = true): void {
  const key = `chibi-${cls}`;
  if (loading.has(key) || scene.textures.exists(key)) return;
  loading.add(key);
  scene.load.atlas(key, `assets/chibi/${cls}/${cls}.png`, `assets/chibi/${cls}/${cls}.json`);
  scene.load.json(`${key}-anims`, `assets/chibi/${cls}/${cls}.anims.json`);
  scene.load.json(`${key}-doll`, `assets/chibi/${cls}/${cls}.doll.json`);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
  if (start && !scene.load.isLoading()) scene.load.start();
}

/** With the flag on, the chibi sprites load with the scene's own loading (under its loading screen), so the hero
 *  enters the regular map already drawn as the chibi — not the painted body first (David 8 Nov: choose the hero,
 *  enter the world, fully loaded; no TEST room needed). */
export function preloadChibi(scene: Phaser.Scene, classes: string[] | undefined): void {
  if (!CHIBI.scale) return;
  for (const cls of classes ?? []) if (READY.has(cls)) load(scene, cls, false);
}

function frameAt(a: AnimDef, t: number): number {
  const total = a.ms.reduce((s, m) => s + m, 0);
  let x = a.loop ? ((t % total) + total) % total : Math.min(Math.max(0, t), total - 1);
  for (let i = 0; i < a.ms.length; i++) { if (x < a.ms[i]) return i; x -= a.ms[i]; }
  return a.ms.length - 1;
}

/** The chibi animation for the body's state, and its clock (states not drawn yet show the nearest one drawn). */
function animFor(q: PoseQuery): { name: string; t: number } {
  if (q.k === 'loop') {
    if (q.state === 'walk') return { name: 'walk', t: q.t * Math.max(0.7, Math.min(1.4, q.speed / 190)) }; // the pace follows the real speed
    if (q.state === 'run') return { name: 'run', t: q.t };
    return { name: q.state === 'alert' ? 'alert' : 'idle', t: q.t };
  }
  if (q.k === 'jump') return { name: `jump_${q.phase}`, t: q.t };
  if (q.k === 'hurt' || q.k === 'launched' || q.k === 'down' || q.k === 'stunned') return { name: 'hurt', t: 'p' in q ? q.p * 300 : 0 };
  if (q.k === 'skill') return { name: 'shot', t: q.elapsed };
  return { name: 'idle', t: 0 };
}
const FALLBACK: Record<string, string> = { run: 'walk', alert: 'idle', jump_takeoff: 'idle', jump_rise: 'idle', jump_apex: 'idle', jump_fall: 'idle', jump_land: 'idle', hurt: 'idle', shot: 'idle' };

// --- the paper doll (ChibiDoll): the look composed once into a texture -------------------------------------------------
const ORIGINAL = ['boots', 'tunic', 'bracers', 'quiver', 'cape', 'hood'];
/** The removal test (`&strip=`) as looks; without it the original Archer. */
const STRIP: Record<string, string[]> = {
  nohood: ORIGINAL.filter((i) => i !== 'hood'), notunic: ORIGINAL.filter((i) => i !== 'tunic'),
  nocape: ORIGINAL.filter((i) => i !== 'cape' && i !== 'quiver'), noboots: ORIGINAL.filter((i) => i !== 'boots'),
  nobracers: ORIGINAL.filter((i) => i !== 'bracers'), tunicboots: ['tunic', 'boots'], base: [],
};
let lookOverride: Look | null = null;
/** A look laid over the saved one (a try-on). */
export function setChibiLook(look: Look | null): void { lookOverride = look; }
/** The look the hero wears: the removal test's (`&strip=`), else the one chosen at the character creation and in the
 *  cash shop (ChibiLooks: kept in this browser), else the Archer as approved. */
export function chibiLook(cls: string, data: DollData): Look {
  if (lookOverride) return lookOverride;
  if (TEST.strip) { const wear = STRIP[TEST.strip] ?? ORIGINAL; return { wear, cut: wear.includes('hood') ? 'hood' : undefined }; }
  const spec = savedSpec(cls);
  if (spec && data.looks) return resolveLook(spec, data.looks.catalog);
  return { wear: ORIGINAL, cut: 'hood' };
}
const composed = new Map<string, { sig: string; key: string; def: ChibiDef }>();

/** A spec composed for a preview (the creation screen, the cash shop): only the anims asked for. */
export function composeSpec(scene: Phaser.Scene, cls: string, spec: LookSpec, key: string, only = ['idle', 'blink', 'walk4'], extra?: Partial<Look>) {
  const data = scene.cache.json.get(`chibi-${cls}-doll`) as DollData | undefined;
  if (!data?.looks) return null;
  return composeLook(scene, cls, parseDoll(cls, data), { ...resolveLook(spec, data.looks.catalog), ...extra }, key, only);
}
export const dollData = (scene: Phaser.Scene, cls: string): DollData | undefined => scene.cache.json.get(`chibi-${cls}-doll`) as DollData | undefined;
/** Loads a class's paper doll (for a scene that shows it before the world). */
export function loadDoll(scene: Phaser.Scene, cls: string): void {
  const jk = `chibi-${cls}-doll`;
  if (!scene.cache.json.exists(jk)) scene.load.json(jk, `assets/chibi/${cls}/${cls}.doll.json`);
}

function dollDef(scene: Phaser.Scene, cls: string): ChibiDef | null {
  const jk = `chibi-${cls}-doll`;
  if (!scene.cache.json.exists(jk)) return null;
  const data = scene.cache.json.get(jk) as DollData;
  const look = chibiLook(cls, data), sig = JSON.stringify(look);
  const c = composed.get(cls);
  if (c && c.sig === sig && scene.textures.exists(c.key)) return c.def;
  const key = `chibi-${cls}-look${composed.size}-${Math.abs([...sig].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7))}`;
  const anims = composeLook(scene, cls, parseDoll(cls, data), look, key);
  const def: ChibiDef = { frame: data.frame, origin: data.origin, height: data.height, facing: data.facing,
    anims: Object.fromEntries(Object.entries(anims).map(([n, a]) => [n, { ...a, events: {}, grip: [] }])) };
  if (c && c.key !== key && scene.textures.exists(c.key)) scene.textures.remove(c.key);
  composed.set(cls, { sig, key, def });
  return def;
}

/** The non-shot skills' category poses (GPT 8 Nov: one pose per body action, not one per skill). */
const SKILL_POSE: Record<string, string> = { retreat_kick: 'kick', tree_of_life: 'kneel', vine_trap: 'kneel', hunters_roar: 'call', spirit_hawk: 'call' }; // (Vine Mine: buried in the floor — the place pose)

/** The shot family on a skill's own timeline (GPT 8 Nov): Raise in the first half of the startup, Full Draw to the
 *  release, Release on screen at each spawn (two releases when the skill fires twice: the start and the end of its
 *  active window, a quick re-tension between), then Recover. */
function shotIndex(q: Extract<PoseQuery, { k: 'skill' }>): number {
  const e = q.elapsed, s = Math.max(1, q.startup), a = q.active;
  if (e < s) return e < s * 0.5 ? 0 : 1;
  const t = e - s;
  if (a > 40) return t < a * 0.5 ? 2 : t < a ? 1 : t < a + 70 ? 2 : 3;
  return t < 70 ? 2 : 3;
}

function dollPose(scene: Phaser.Scene, cls: string, dir: Dir, q: PoseQuery, def: ChibiDef): PoseFrame {
  const key = composed.get(cls)!.key;
  let name = 'idle', t = 0, frame: string | null = null;
  const has = (n: string) => !!def.anims[n];
  if (q.k === 'loop') {
    if (q.state === 'walk') { name = 'walk4'; t = q.t * TEST.pace; }
    else if (q.state === 'run') { name = has('run') ? 'run' : 'walk4'; t = q.t; } // (the walk, faster, leaning a pixel forward)
    else { name = q.state === 'alert' && has('stance') ? 'stance' : 'idle'; t = q.t; }  // the combat stance: a softened Raise
  } else if (q.k === 'skill') {
    const cat = SKILL_POSE[q.id];
    if (cat && has(cat)) { name = cat; if (cat === 'kick') name = q.elapsed < q.startup ? 'land' : q.elapsed < q.startup + q.active + 120 ? 'kick' : 'air'; }
    else if (has('shot')) { name = 'shot'; frame = def.anims.shot.frames[shotIndex(q)]; }
  }
  else if (q.k === 'recovery' && has('shot')) { name = 'shot'; frame = def.anims.shot.frames[3]; } // (a skill's tail: the Recover pose, then the carry — no early pop of the bow)
  else if (q.k === 'jump') name = q.phase === 'takeoff' || q.phase === 'land' ? 'land' : 'air';
  else if (q.k === 'hurt' || q.k === 'stunned' || q.k === 'launched') name = 'hurt';
  else if (q.k === 'down') name = 'down';
  else if (q.k === 'getup' || q.k === 'quickrise') name = 'getup';
  else if (q.k === 'backstep' || q.k === 'airAttack') name = 'air';
  if (!has(name)) name = 'idle';
  const a = def.anims[name];
  if (!frame) frame = a.frames[frameAt(a, t)];
  const b = def.anims.blink;
  if (name === 'idle' && b) { // the blink, laid on the idle's base frame every fourth cycle
    const cyc = a.ms.reduce((m, v) => m + v, 0), tt = ((t % (cyc * 4)) + cyc * 4) % (cyc * 4);
    if (tt >= cyc * 3 && tt - cyc * 3 < Math.min(b.ms[0], a.ms[0])) frame = b.frames[0];
  }
  const s = CHIBI.scale;
  return { key, frame, wkey: `${key}-noweapon`, ox: def.origin[0] / def.frame, oy: def.origin[1] / def.frame, scale: s,
    flip: (dir === 'left') !== (def.facing === 'left'), anchor: null, top: def.height * s };
}

/** The chibi body frame for this state — null when the flag is off, the class is not drawn yet, or its sprites are
 *  still loading (the caller then draws the painted body). */
export function chibiPose(scene: Phaser.Scene, cls: string, dir: Dir, q: PoseQuery): PoseFrame | null {
  if (!chibiOn(cls)) return null;
  const key = `chibi-${cls}`;
  if (!scene.textures.exists(key) || !scene.cache.json.exists(`${key}-anims`)) { load(scene, cls); return null; }
  if (!TEST.outfit && TEST.walk4) { const dd = dollDef(scene, cls); if (dd) return dollPose(scene, cls, dir, q, dd); }
  let def = defs.get(cls);
  if (!def) { def = scene.cache.json.get(`${key}-anims`) as ChibiDef; defs.set(cls, def); }
  const want = animFor(q);
  let name = want.name, t = want.t;
  if (!def.anims[name]) { // not drawn yet: the nearest drawn state (a run plays the walk faster)
    if (name === 'run') t *= 1.6;
    name = FALLBACK[name] ?? 'idle';
    if (!def.anims[name]) name = 'idle';
  }
  if (name === 'walk' && TEST.walk4 && def.anims.walk4 && q.k === 'loop') { name = 'walk4'; t = q.t * TEST.pace; } // (the minimal-motion test)
  if (TEST.outfit && def.anims[name + TEST.outfit]) name += TEST.outfit;
  else if (TEST.strip && def.anims[`${name}~${TEST.strip}`]) name = `${name}~${TEST.strip}`;
  const a = def.anims[name], s = CHIBI.scale;
  let frame = a.frames[frameAt(a, t)];
  const b = def.anims[`blink${TEST.outfit}`] ?? def.anims[`blink~${TEST.strip}`] ?? def.anims.blink; // the blink is laid on the idle's base frame every fourth cycle (an event, not part of the loop)
  if (name.startsWith('idle') && b) {
    const cyc = a.ms.reduce((m, v) => m + v, 0), tt = ((t % (cyc * 4)) + cyc * 4) % (cyc * 4);
    if (tt >= cyc * 3 && tt - cyc * 3 < Math.min(b.ms[0], a.ms[0])) frame = b.frames[0];
  }
  return {
    key, frame, wkey: `${key}-noweapon`, // (no painted weapon overlay: the bow is in the chibi frame)
    ox: def.origin[0] / def.frame, oy: def.origin[1] / def.frame, scale: s,
    flip: (dir === 'left') !== (def.facing === 'left'), anchor: null, top: def.height * s,
  };
}
