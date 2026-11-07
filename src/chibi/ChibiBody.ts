// THE CHIBI CHARACTERS — a prototype behind a flag (David 7 Nov: anime pixel art, light chibi, two facings in a
// three-quarter view; the archer first). `?chibi` (or `?chibi=2` / `?chibi=3`: the pixel scale) swaps the archer's
// painted body for the chibi one drawn from the same state (idle, walk, …); everything else — movement, skills,
// hitboxes, the camera — stays the game's own. Without the flag nothing changes.
// The art: tools/chibi/archer (parts drawn once on the integer grid, the bow its own layer drawn from numbers) →
// public/assets/chibi/<cls>/<cls>.png + .json (atlas) + .anims.json (frames, ms, loop, events, the bow grip).
import Phaser from 'phaser';
import type { PoseFrame, PoseQuery } from '../game/Body';
import type { Dir } from '../world/collision';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
/** scale: world px per chibi pixel (0 = off). */
export const CHIBI = { scale: params?.has('chibi') ? Math.max(1, Math.round(Number(params.get('chibi')) || 2)) : 0 };
/** The classes drawn so far. */
const READY = new Set(['archer']);
/** The minimal-motion test (David 7 Nov 21:41, reviewed with GPT; tools/chibi/archer/src/minimal_R.py): `&walk=4` plays
 *  the 4-frame walk (rigid head, torso and bow; only the legs, a 1 px bob, the free arm and the hem move), `&outfit=b`
 *  swaps in a different tunic and boots (it needs the 4-frame walk: the 6-frame one would need every frame redrawn),
 *  `&wms=150` sets its frame time on screen (165 ms by default — GPT's test values, 165 and 150; it doesn't slow with
 *  the walking speed the way the 6-frame walk does, which shows each of its frames ~157 ms at the walking speed).
 *  Without them the 6-frame walk stays. */
const TEST = {
  outfit: params?.get('outfit') === 'b' ? 'b' : '',
  walk4: params?.get('walk') === '4' || params?.get('outfit') === 'b',
  pace: 165 / Math.max(80, Math.min(300, Number(params?.get('wms')) || 165)),
};

interface AnimDef { frames: string[]; ms: number[]; loop: boolean; events: Record<string, number>; grip: ([number, number] | null)[] }
interface ChibiDef { frame: number; origin: [number, number]; height: number; facing: 'right' | 'left'; anims: Record<string, AnimDef> }
const defs = new Map<string, ChibiDef>();
const loading = new Set<string>();

export const chibiOn = (cls: string): boolean => CHIBI.scale > 0 && READY.has(cls);

/** Starts loading a class's chibi sprites (once); its pixels stay sharp (nearest filtering). */
function load(scene: Phaser.Scene, cls: string): void {
  const key = `chibi-${cls}`;
  if (loading.has(key)) return;
  loading.add(key);
  scene.load.atlas(key, `assets/chibi/${cls}/${cls}.png`, `assets/chibi/${cls}/${cls}.json`);
  scene.load.json(`${key}-anims`, `assets/chibi/${cls}/${cls}.anims.json`);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
  if (!scene.load.isLoading()) scene.load.start();
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

/** The chibi body frame for this state — null when the flag is off, the class is not drawn yet, or its sprites are
 *  still loading (the caller then draws the painted body). */
export function chibiPose(scene: Phaser.Scene, cls: string, dir: Dir, q: PoseQuery): PoseFrame | null {
  if (!chibiOn(cls)) return null;
  const key = `chibi-${cls}`;
  if (!scene.textures.exists(key) || !scene.cache.json.exists(`${key}-anims`)) { load(scene, cls); return null; }
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
  const a = def.anims[name], s = CHIBI.scale;
  let frame = a.frames[frameAt(a, t)];
  const b = def.anims[`blink${TEST.outfit}`] ?? def.anims.blink; // the blink is laid on the idle's base frame every fourth cycle (an event, not part of the loop)
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
