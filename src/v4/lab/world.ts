// Lab constants: the courtyard's camera and scale (the reference for "actual gameplay size"), and the shared assets
// (placeholder atlases at two resolutions, the rig, the wardrobe) built once per game.
import Phaser from 'phaser';
import { buildAtlas } from '../art/painter';
import { RigPose } from '../rig/pose';
import { GOLDEN_RIG } from '../rig/rig';
import { buildCatalog, type Catalog } from '../wardrobe/catalog';
import { Wardrobe } from '../wardrobe/resolve';
import type { Atlas } from '../render/RigCharacter';

/** The game's canvas and the courtyard's camera: 1672 × 941 world px fitted into 1920 × 1080 (zoom ≈ 1.148). */
export const CANVAS = { w: 1920, h: 1080 };
export const WORLD = { w: 1672, h: 941, groundTop: 560, laneMin: 640, laneMax: 900 };
export const ZOOM0 = Math.min(CANVAS.w / WORLD.w, CANVAS.h / WORLD.h);
export const ZOOM_PRESETS = { social: 1.15, grinding: 1.0, boss: 0.85 } as const;
export type ZoomPreset = keyof typeof ZOOM_PRESETS;
/** Body standard B (sole to skull top) in world px for David's three size options (×1.12 = the proposal's 100 px at 720p). */
export const SIZE_B: Record<string, number> = { '1': 117, '1.12': 131, '1.25': 146.25 };
export const MASTER_B = 768;
/** Composite cell, in B: big enough for every measured pose (test M5e) and the oversized-item envelopes. */
export const CELL = { w: 1.65, h: 1.85, rootX: 0.8, rootY: 1.5 };
/** A 1280 × 720 window shows the 1920 × 1080 canvas at 2/3. */
export const SCREEN_720 = 1280 / CANVAS.w;

export interface LabAssets { pose: RigPose; catalog: Catalog; wardrobe: Wardrobe; atlas256: Atlas; atlas512: Atlas; atlasInfo: { frames: number; size256: [number, number]; size512: [number, number]; buildMs: number } }

let cached: LabAssets | null = null;

export function labAssets(scene: Phaser.Scene): LabAssets {
  if (cached && scene.textures.exists(cached.atlas256.key)) return cached;
  const t0 = performance.now();
  const catalog = buildCatalog();
  const add = (key: string, k: number): [number, number] => {
    const { canvas, frames } = buildAtlas(catalog.art, k);
    const tex = scene.textures.addCanvas(key, canvas)!;
    for (const f of frames) {
      const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!;
      fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py;
    }
    return [canvas.width, canvas.height];
  };
  const size256 = add('v4atlas256', 256), size512 = add('v4atlas512', 512);
  const pose = new RigPose(GOLDEN_RIG);
  cached = {
    pose, catalog, wardrobe: new Wardrobe(GOLDEN_RIG, catalog.items, catalog.base),
    atlas256: { key: 'v4atlas256', unitsPerPx: MASTER_B / 256 }, atlas512: { key: 'v4atlas512', unitsPerPx: MASTER_B / 512 },
    atlasInfo: { frames: catalog.art.size, size256, size512, buildMs: performance.now() - t0 },
  };
  return cached;
}
