// The character's full style as one picture (menus, portraits): every layer of its look drawn in order into one image —
// back hair, the bare body in its skin tone, the face, the worn gear (pants, boots, shirt in their colours, the sword in
// hand), the forehead between the bangs, the hair over the head. Built from the character's own look and what it wears
// now, so the menus show exactly that (tools/base/naked_frames.py). The pictures share one canvas per gender, wide and
// tall enough for every hairstyle (menu-look.json), the figure where the bare base picture has it.
import Phaser from 'phaser';
import { CHARACTER_PREVIEWS } from '../config/layout';
import MENU_LOOK_LIST from '../data/menu-look.json';
import NAKED_LOOK_LIST from '../data/naked-look.json';
import { DEFAULT_SKIN, SKIN_TONES, toneTexture } from './Skin';
import { GearState, wornLook } from '../items/Gear';

/** top / pants / shoes: the worn piece's colour (−1: not worn); weapon: the sword in hand. */
export interface LookData { gender: 'male' | 'female'; hair: number; hairColor: number; skin: number; face: number; top: number; pants: number; shoes: number; weapon: boolean }
/** What a character stores (hair colour, skin and face came later: older characters lack them). */
export interface StoredLook { hair: number; top: number; pants: number; shoes: number; hairColor?: number; skin?: number; face?: number }
type LookOwner = { gender?: string; look?: StoredLook; gear?: GearState };
/** The menu canvas per gender: size, where the bare figure sits in it (ox, oy), its height (fit), the head (hairstyle
 *  buttons) and the face (face buttons) as [cx, cy, side]. */
const MENU_LOOK = MENU_LOOK_LIST as Record<string, { w: number; h: number; ox: number; oy: number; fit: number; head: number[]; face?: number[]; gear?: string[] }>;
const NAKED_LOOK = NAKED_LOOK_LIST as Record<string, { styles: number; colors: number; gaps: boolean[]; faces: number }>;

const G_ = (g: LookData['gender']) => (g === 'male' ? 'Male' : 'Female');
/** One layer of a look's picture: [texture key, file, re-shaded with the skin tone]. */
export type LookLayer = [string, string, boolean];
/** The layers of a look, bottom to top. noHair: the bare head (face buttons). */
export function lookFiles(l: LookData, noHair = false): LookLayer[] {
  const G = G_(l.gender), B = 'assets/characters/base', n = NAKED_LOOK[l.gender];
  const hair = !noHair && l.hair >= 0 && l.hair < (n?.styles ?? 0), out: LookLayer[] = [];
  const gear = MENU_LOOK[l.gender]?.gear ?? [];
  if (hair) out.push([`cc.${G}.h${l.hair}c${l.hairColor}b`, `${B}/hair/${G}_${l.hair}_c${l.hairColor}_back.png`, false]);
  out.push([`cc.${G}.bare`, `${B}/Base_${G}_wide.png`, true]);
  if (l.face > 0 && l.face < (n?.faces ?? 1)) out.push([`cc.${G}.face${l.face}`, `${B}/face/${G}_${l.face}.png`, true]);
  for (const p of ['pants', 'shoes', 'top'] as const) if (l[p] >= 0 && gear.includes(p)) out.push([`cc.${G}.${p}${l[p]}`, `${B}/gear/${G}_${p}_c${l[p]}.png`, false]);
  if (l.weapon && gear.includes('sword')) out.push([`cc.${G}.sword`, `${B}/gear/${G}_sword.png`, false]);
  if (hair && n?.gaps[l.hair]) out.push([`cc.${G}.gap${l.hair}`, `${B}/hair/${G}_${l.hair}_gap.png`, true]);
  if (hair) out.push([`cc.${G}.h${l.hair}c${l.hairColor}f`, `${B}/hair/${G}_${l.hair}_c${l.hairColor}_front.png`, false]);
  return out;
}
/** How many hairstyles / hair colours / faces this gender has. */
export const lookCounts = (g: LookData['gender']) => ({ styles: NAKED_LOOK[g]?.styles ?? 0, colors: NAKED_LOOK[g]?.colors ?? 0, faces: NAKED_LOOK[g]?.faces ?? 1 });

const idx = (v: unknown, n: number, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : d);
/** The look of a stored character (null: none chosen — the bare base). */
export function lookOf(c: LookOwner | null | undefined): LookData | null {
  if (!c?.look) return null;
  const gender = c.gender === 'female' ? 'female' : 'male', n = lookCounts(gender), l = c.look;
  const w = c.gear ? wornLook(c.gear) : { weapon: true, top: l.top, pants: l.pants, shoes: l.shoes }; // what it wears now
  return { gender, hair: l.hair, top: w.top, pants: w.pants, shoes: w.shoes, weapon: w.weapon, hairColor: idx(l.hairColor, Math.max(1, n.colors), 0),
    skin: idx(l.skin, SKIN_TONES.length, DEFAULT_SKIN), face: idx(l.face, n.faces, 0) };
}
const sigOf = (l: LookData) => `${l.gender}.h${l.hair}c${l.hairColor}.s${l.skin}.f${l.face}.t${l.top}.p${l.pants}.b${l.shoes}.w${l.weapon ? 1 : 0}`;
/** CHARACTER_PREVIEWS key of this look's full-style picture (registered once it is built). */
export const lookPreviewKey = (l: LookData) => `base/${l.gender}/look.${sigOf(l)}`;

/** Queued, loading or loaded-but-not-yet-processed in this scene's loader. */
function pending(scene: Phaser.Scene, k: string): boolean {
  const L = scene.load as unknown as Record<'list' | 'inflight' | 'queue', { entries: Phaser.Loader.File[] }>;
  return [L.list, L.inflight, L.queue].some((set) => set.entries.some((f) => f.key === k));
}
/** Queue layers that are not loaded (or on the way); true while any of them is still to come. */
export function queueLayers(scene: Phaser.Scene, layers: LookLayer[]): boolean {
  let wait = false;
  for (const [k, f] of layers) {
    if (scene.textures.exists(k)) continue;
    if (!pending(scene, k)) scene.load.image(k, f);
    wait = true;
  }
  return wait;
}
/** Queue the layers of these characters' looks (call in a scene's preload). */
export function preloadLooks(scene: Phaser.Scene, chars: (LookOwner | null | undefined)[]): void {
  for (const c of chars) { const l = lookOf(c); if (l) queueLayers(scene, lookFiles(l)); }
}

/** A layer's picture, re-shaded when it is skin (null while loading). */
function layerImage(scene: Phaser.Scene, [k, , toned]: LookLayer, skin: number): CanvasImageSource | null {
  const tk = toned ? toneTexture(scene, k, skin) : scene.textures.exists(k) ? k : null;
  return tk ? (scene.textures.get(tk).getSourceImage() as CanvasImageSource) : null;
}
/** Draw the look's layers into a canvas: the whole picture, or the square [cx, cy, side] of it at size px. */
function drawLook(scene: Phaser.Scene, l: LookData, layers: LookLayer[], cut?: { sq: number[]; size: number }): HTMLCanvasElement | null {
  const imgs = layers.map((ly) => layerImage(scene, ly, l.skin));
  if (imgs.some((im) => !im)) return null;
  const M = MENU_LOOK[l.gender], cv = document.createElement('canvas'), ctx = cv.getContext('2d')!;
  if (!cut) { cv.width = M.w; cv.height = M.h; for (const im of imgs) ctx.drawImage(im!, 0, 0); return cv; }
  const [cx, cy, side] = cut.sq, k = cut.size / side;
  cv.width = cv.height = cut.size;
  ctx.imageSmoothingQuality = 'high';
  for (const im of imgs) ctx.drawImage(im!, -(cx - side / 2) * k, -(cy - side / 2) * k, M.w * k, M.h * k);
  return cv;
}

/** Draw the look into one picture: a texture for the scene and a menu preview, so portraits and the stage show the full
 *  style. Needs its layers loaded; returns the preview key or null. */
export function buildLook(scene: Phaser.Scene, c: LookOwner | null | undefined): string | null {
  const l = lookOf(c); if (!l) return null;
  const pk = lookPreviewKey(l);
  if (CHARACTER_PREVIEWS[pk] && scene.textures.exists(CHARACTER_PREVIEWS[pk].key)) return pk;
  const cv = drawLook(scene, l, lookFiles(l)); if (!cv) return null;
  const key = `base.look.${sigOf(l)}`, base = CHARACTER_PREVIEWS[`base/${l.gender}`], M = MENU_LOOK[l.gender];
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv);
  // portraits: the bare figure's head crop, from the canvas top (the tallest hair has room there)
  CHARACTER_PREVIEWS[pk] = { ...base, key, file: cv.toDataURL('image/png'), width: cv.width, height: cv.height, crop: { x: base.crop.x + M.ox, y: 0, w: base.crop.w }, fit: M.fit };
  return pk;
}

/** Creation buttons: every hairstyle on this look (its colour, skin, face, outfit) and every face on it (bare head), as
 *  pictures of the head / the face. The layers they need: lookIconLayers. */
export function lookIconLayers(l: LookData): LookLayer[] {
  const n = lookCounts(l.gender), all = new Map<string, LookLayer>();
  for (let h = 0; h < n.styles; h++) for (const ly of lookFiles({ ...l, hair: h })) all.set(ly[0], ly);
  for (let f = 0; f < n.faces; f++) for (const ly of lookFiles({ ...l, face: f }, true)) all.set(ly[0], ly);
  return [...all.values()];
}
export function lookIcons(scene: Phaser.Scene, l: LookData, size = 112): { hair: string[]; face: string[] } | null {
  const M = MENU_LOOK[l.gender], n = lookCounts(l.gender), hair: string[] = [], face: string[] = [];
  for (let h = 0; h < n.styles; h++) { const cv = drawLook(scene, l, lookFiles({ ...l, hair: h }), { sq: M.head, size }); if (!cv) return null; hair.push(cv.toDataURL('image/png')); }
  for (let f = 0; f < n.faces; f++) { const cv = drawLook(scene, l, lookFiles({ ...l, face: f }, true), { sq: M.face ?? M.head, size }); if (!cv) return null; face.push(cv.toDataURL('image/png')); }
  return { hair, face };
}
