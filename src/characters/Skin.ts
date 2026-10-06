// Skin tones (MapleStory's base set: white, light, tan, dark). The art is drawn in "light"; another tone re-shades every
// skin pixel by a gain per channel, its shadows and shine kept — the same rule as the menu pictures
// (tools/base/outfit/outfit_layers.py skin_w), so the stage, the portraits and the game agree.
import Phaser from 'phaser';
import SKIN_LIST from '../data/skin-tones.json';

export interface SkinTone { name: string; swatch: string; gain: number[] }
export const SKIN_TONES = SKIN_LIST as SkinTone[];
/** A lighter tone's shine rolls off softly into white from here (no flat white patches). */
const KNEE = 230;
/** The tone the art is drawn in. */
export const DEFAULT_SKIN = Math.max(0, SKIN_TONES.findIndex((t) => t.gain.every((v) => v === 1)));

/** The texture re-shaded to a skin tone (built once, frames kept): the key itself for the drawn tone, null while loading. */
export function toneTexture(scene: Phaser.Scene, key: string, tone: number): string | null {
  if (tone === DEFAULT_SKIN || !SKIN_TONES[tone]) return scene.textures.exists(key) ? key : null;
  const vk = `${key}~s${tone}`;
  if (scene.textures.exists(vk)) return vk;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key), img = src.getSourceImage() as HTMLImageElement | HTMLCanvasElement, W = img.width, H = img.height;
  const ct = scene.textures.createCanvas(vk, W, H); if (!ct) return null;
  const ctx = ct.getContext(); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H), a = d.data, g = SKIN_TONES[tone].gain;
  const ch = (v: number, k: number) => { const x = v * k; return k > 1 && x > KNEE ? KNEE + (255 - KNEE) * (1 - Math.exp(-(x - KNEE) / (255 - KNEE))) : Math.min(255, x); };
  for (let i = 0; i < a.length; i += 4) { // skin = warm, light, opaque; fades at its outline (no light rim on dark skin)
    if (a[i + 3] < 6) continue;
    const r = a[i], gg = a[i + 1], b = a[i + 2];
    if (!(r >= gg && gg >= b && r - b > 15)) continue;
    const w = Math.min(1, Math.max(0, (0.3 * r + 0.59 * gg + 0.11 * b - 70) / 40)); if (w <= 0) continue;
    a[i] = r + (ch(r, g[0]) - r) * w; a[i + 1] = gg + (ch(gg, g[1]) - gg) * w; a[i + 2] = b + (ch(b, g[2]) - b) * w;
  }
  ctx.putImageData(d, 0, 0);
  for (const name of src.getFrameNames()) { const f = src.get(name); ct.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  ct.refresh();
  return vk;
}
