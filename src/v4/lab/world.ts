// Lab constants: the courtyard's camera and scale (the reference for "actual gameplay size"), and the shared assets
// built once per game for each art: the Phase 1 placeholder (atlases painted by script) or candidate B's real art
// (atlases cut from the parts sheets, loaded by the scene).
import Phaser from 'phaser';
import { GEAR_SLOTS, wornItem, type GearState } from '../../items/Gear';
import { buildAtlas } from '../art/painter';
import { ANIMS_B } from '../real/animsB';
import { B_FRAMES, GEAR_LOOKS_B, buildCatalogB, type BFrame } from '../real/catalogB';
import { RIG_B } from '../real/rigB';
import { ANIMS_B01 } from '../base01/anims';
import { B01_FRAMES, B01_TEXTURE, buildCatalogB01 } from '../base01/catalog';
import { RIG_B01 } from '../base01/rig';
import b01Data from '../base01/assets/base01.json';
import { ANIMS } from '../rig/anims';
import { RigPose } from '../rig/pose';
import { GOLDEN_RIG } from '../rig/rig';
import { GEAR_LOOKS, buildCatalog, type Catalog } from '../wardrobe/catalog';
import { Wardrobe } from '../wardrobe/resolve';
import type { WardrobeSlot } from '../wardrobe/types';
import type { Atlas } from '../render/RigCharacter';
import type { AnimDef } from '../rig/types';

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

/** Which art the lab shows: BASE-01 (the art director's locked base character), the Phase 1 placeholder, or
 *  candidate B's real art (Phase 3). */
export type Art = 'placeholder' | 'b' | 'base01';
/** Texture keys of B's atlases (B = 256 and 512 px), loaded by the lab scene. */
export const B_TEXTURES = { 256: 'v4b256', 512: 'v4b512' } as const;
export const B01_TEXTURE_KEY = B01_TEXTURE;

export interface LabAssets {
  art: Art;
  pose: RigPose; catalog: Catalog; wardrobe: Wardrobe; atlas256: Atlas; atlas512: Atlas;
  /** The body standard's animations (idle, run, jump, attack). */
  anims: Record<string, AnimDef>;
  atlasInfo: { frames: number; size256: [number, number]; size512: [number, number]; buildMs: number };
  /** The look a character starts from (character creation): its hairstyle and face. */
  baseLook: { hair: string; face: string };
  /** Worn gameplay gear → its looks by wardrobe slot (stats stay in Gear.ts; only the look comes through). */
  gearLooks: (g: GearState) => Partial<Record<WardrobeSlot, string>>;
}

/** Placeholder art: gameplay gear → its looks by wardrobe slot. */
export function placeholderGearLooks(g: GearState): Partial<Record<WardrobeSlot, string>> {
  const out: Partial<Record<WardrobeSlot, string>> = {};
  for (const s of GEAR_SLOTS) { const it = wornItem(g, s); const look = it ? GEAR_LOOKS[it.id] : undefined; if (look) out[s] = look; }
  return out;
}

function gearLooksB(g: GearState): Partial<Record<WardrobeSlot, string>> {
  const out: Partial<Record<WardrobeSlot, string>> = {};
  for (const s of GEAR_SLOTS) { const it = wornItem(g, s); const looks = it ? GEAR_LOOKS_B[it.id] : undefined; if (looks) Object.assign(out, looks); }
  return out;
}

const cache = new Map<Art, LabAssets>();

export function labAssets(scene: Phaser.Scene, art: Art = 'placeholder'): LabAssets {
  const hit = cache.get(art);
  if (hit && scene.textures.exists(hit.atlas256.key)) return hit;
  const made = art === 'b' ? realAssetsB(scene) : art === 'base01' ? assetsBase01(scene) : placeholderAssets(scene);
  cache.set(art, made);
  return made;
}

function placeholderAssets(scene: Phaser.Scene): LabAssets {
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
  return {
    art: 'placeholder', pose: new RigPose(GOLDEN_RIG), anims: ANIMS, catalog, wardrobe: new Wardrobe(GOLDEN_RIG, catalog.items, catalog.base),
    atlas256: { key: 'v4atlas256', unitsPerPx: MASTER_B / 256 }, atlas512: { key: 'v4atlas512', unitsPerPx: MASTER_B / 512 },
    atlasInfo: { frames: catalog.art.size, size256, size512, buildMs: performance.now() - t0 },
    baseLook: { hair: 'hair_short', face: 'face_a' }, gearLooks: placeholderGearLooks,
  };
}

/** B's atlases are already loaded as plain images: name their frames and pivots. */
function realAssetsB(scene: Phaser.Scene): LabAssets {
  const t0 = performance.now();
  const catalog = buildCatalogB();
  const add = (key: string, frames: BFrame[]): [number, number] => {
    const tex = scene.textures.get(key);
    for (const f of frames) {
      if (tex.has(f.name)) continue;
      const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!;
      fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py;
    }
    const src = tex.getSourceImage() as HTMLImageElement;
    return [src.width, src.height];
  };
  const size256 = add(B_TEXTURES[256], B_FRAMES[256]), size512 = add(B_TEXTURES[512], B_FRAMES[512]);
  return {
    art: 'b', pose: new RigPose(RIG_B), anims: ANIMS_B, catalog, wardrobe: new Wardrobe(RIG_B, catalog.items, catalog.base),
    atlas256: { key: B_TEXTURES[256], unitsPerPx: MASTER_B / 256 }, atlas512: { key: B_TEXTURES[512], unitsPerPx: MASTER_B / 512 },
    atlasInfo: { frames: B_FRAMES[512].length, size256, size512, buildMs: performance.now() - t0 },
    baseLook: { hair: 'b_hair', face: 'b_face' }, gearLooks: gearLooksB,
  };
}

/** BASE-01: one atlas (512 px per B) serves both sizes; any gameplay gear shows the base outfit (the first item drawn
 *  for each slot), the weapon the sword. */
function assetsBase01(scene: Phaser.Scene): LabAssets {
  const t0 = performance.now();
  const catalog = buildCatalogB01();
  const tex = scene.textures.get(B01_TEXTURE);
  for (const f of B01_FRAMES) {
    if (tex.has(f.name)) continue;
    const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!;
    fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py;
  }
  const src = tex.getSourceImage() as HTMLImageElement;
  const size: [number, number] = [src.width, src.height];
  const atlas = { key: B01_TEXTURE, unitsPerPx: MASTER_B / b01Data.bpx };
  const outfit: Partial<Record<WardrobeSlot, string>> = { top: 'top01_tunic', bottom: 'bottom01_pants', shoes: 'shoes01_boots', weapon: 'weapon01_sword' };
  return {
    art: 'base01', pose: new RigPose(RIG_B01), anims: ANIMS_B01, catalog, wardrobe: new Wardrobe(RIG_B01, catalog.items, catalog.base),
    atlas256: atlas, atlas512: atlas,
    atlasInfo: { frames: B01_FRAMES.length, size256: size, size512: size, buildMs: performance.now() - t0 },
    baseLook: { hair: 'b01_hair', face: 'b01_face' }, gearLooks: () => ({ ...outfit }),
  };
}
