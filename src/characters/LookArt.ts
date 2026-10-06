// The character's full style as one picture (menus, portraits): every layer of its look drawn in order into one image —
// back hair, the dressed body (starter outfit, sword), each piece in its colour, the hair over the head. Built from the
// character's own look data, so whatever it wears now is what the menus show (tools/base/outfit/outfit_layers.py).
import Phaser from 'phaser';
import { CHARACTER_PREVIEWS } from '../config/layout';

export interface LookData { gender: 'male' | 'female'; hair: number; top: number; pants: number; shoes: number }
type LookOwner = { gender?: string; look?: { hair: number; top: number; pants: number; shoes: number } };

const G_ = (g: LookData['gender']) => (g === 'male' ? 'Male' : 'Female');
/** The layers of a look, bottom to top: [texture key, file]. */
export function lookFiles(l: LookData): [string, string][] {
  const G = G_(l.gender), B = 'assets/characters/base';
  return [
    [`cc.${G}.hair${l.hair}b`, `${B}/hair/${G}_${l.hair}_back.png`],
    [`cc.${G}.body`, `${B}/outfit/${G}_body.png`],
    [`cc.${G}.pants${l.pants}`, `${B}/outfit/${G}_pants_${l.pants}.png`],
    [`cc.${G}.shoes${l.shoes}`, `${B}/outfit/${G}_shoes_${l.shoes}.png`],
    [`cc.${G}.top${l.top}`, `${B}/outfit/${G}_top_${l.top}.png`],
    [`cc.${G}.hair${l.hair}f`, `${B}/hair/${G}_${l.hair}_front.png`],
  ];
}
/** The look of a stored character (null: none chosen — the bare base). */
export function lookOf(c: LookOwner | null | undefined): LookData | null {
  if (!c?.look) return null;
  return { gender: c.gender === 'female' ? 'female' : 'male', ...c.look };
}
const sigOf = (l: LookData) => `${l.gender}.h${l.hair}.t${l.top}.p${l.pants}.s${l.shoes}`;
/** CHARACTER_PREVIEWS key of this look's full-style picture (registered once it is built). */
export const lookPreviewKey = (l: LookData) => `base/${l.gender}/look.${sigOf(l)}`;

/** Queue the layers of these characters' looks (call in a scene's preload). */
export function preloadLooks(scene: Phaser.Scene, chars: (LookOwner | null | undefined)[]): void {
  for (const c of chars) {
    const l = lookOf(c); if (!l) continue;
    for (const [k, f] of lookFiles(l)) if (!scene.textures.exists(k)) scene.load.image(k, f);
  }
}

/** Draw the look into one picture: a texture for the scene and a menu preview (same size / crop as the base figure),
 *  so portraits and the stage show the full style. Needs its layers loaded; returns the preview key or null. */
export function buildLook(scene: Phaser.Scene, c: LookOwner | null | undefined): string | null {
  const l = lookOf(c); if (!l) return null;
  const pk = lookPreviewKey(l);
  if (CHARACTER_PREVIEWS[pk] && scene.textures.exists(CHARACTER_PREVIEWS[pk].key)) return pk;
  const files = lookFiles(l);
  if (!files.every(([k]) => scene.textures.exists(k))) return null;
  const base = CHARACTER_PREVIEWS[`base/${l.gender}`];
  const imgs = files.map(([k]) => scene.textures.get(k).getSourceImage() as HTMLImageElement);
  const cv = document.createElement('canvas'); cv.width = imgs[1].width; cv.height = imgs[1].height;
  const ctx = cv.getContext('2d')!;
  for (const im of imgs) ctx.drawImage(im, 0, 0);
  const key = `base.look.${sigOf(l)}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv);
  CHARACTER_PREVIEWS[pk] = { ...base, key, file: cv.toDataURL('image/png'), width: cv.width, height: cv.height };
  return pk;
}
