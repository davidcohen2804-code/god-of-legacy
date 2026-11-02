// What the studio shows: one character kit (rig, animations, atlas, wardrobe). BASE-01 is the default; the earlier
// template t1 stays available with ?kit=t1 (kept as it was, nothing removed).
import type { AnimDef, RigDef } from '../rig/types';
import type { Catalog } from '../wardrobe/catalog';
import type { WardrobeSlot } from '../wardrobe/types';
import { ANIMS_B01, animFor as animForB01 } from '../base01/anims';
import { B01_FRAMES, B01_TEXTURE, B01_WEAR, buildCatalogB01 } from '../base01/catalog';
import { RIG_B01 } from '../base01/rig';
import b01Url from '../base01/assets/base01.png?inline';
import b01Data from '../base01/assets/base01.json';
import { ANIMS_T } from './animsT';
import { BASE_OUTFIT_T, T_FRAMES, T_TEXTURE, buildCatalogT } from './catalogT';
import { RIG_T } from './rigT';
import t1Url from './assets/t1.png?inline';
import t1Data from './assets/t1.json';

export interface KitFrame { name: string; x: number; y: number; w: number; h: number; px: number; py: number }
export interface Kit {
  id: string;
  title: string;
  rig: RigDef;
  anims: Record<string, AnimDef>;
  frames: KitFrame[];
  texKey: string;
  texUrl: string;
  /** Atlas px per B. */
  bpx: number;
  catalog: () => Catalog;
  look: { hair: string; face: string };
  /** The look the studio opens with. */
  outfit: Partial<Record<WardrobeSlot, string>>;
  /** The wardrobe's choices per slot. */
  wear: { slot: WardrobeSlot; label: string; items: { id: string; name: string }[] }[];
  /** The animation a state plays with or without a weapon in hand (a kit with an unarmed set). */
  animFor?: (name: string, unarmed: boolean) => AnimDef | undefined;
}

export const KITS: Record<string, () => Kit> = {
  base01: () => ({
    id: 'base01', title: 'BASE-01', rig: RIG_B01, anims: ANIMS_B01, frames: B01_FRAMES, texKey: B01_TEXTURE, texUrl: b01Url,
    bpx: b01Data.bpx, catalog: buildCatalogB01, look: { hair: 'b01_hair', face: 'b01_face' },
    outfit: Object.fromEntries(B01_WEAR.map((w) => [w.slot, w.items[0].id])),
    wear: B01_WEAR, animFor: animForB01,
  }),
  t1: () => ({
    id: 't1', title: 'Template t1 (earlier)', rig: RIG_T, anims: ANIMS_T, frames: T_FRAMES, texKey: T_TEXTURE, texUrl: t1Url,
    bpx: t1Data.bpx, catalog: buildCatalogT, look: { hair: 't1_hair', face: 't1_face' }, outfit: { ...BASE_OUTFIT_T },
    wear: [
      { slot: 'top', label: 'Shirt', items: [{ id: 't1_shirt', name: 'Shirt' }] },
      { slot: 'bottom', label: 'Trousers', items: [{ id: 't1_trousers', name: 'Trousers' }] },
      { slot: 'shoes', label: 'Boots', items: [{ id: 't1_boots', name: 'Boots' }] },
      { slot: 'weapon', label: 'Sword', items: [{ id: 't1_sun_sword', name: 'Sword' }] },
    ],
  }),
};

export function pickKit(): Kit {
  const id = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('kit') ?? 'base01' : 'base01';
  return (KITS[id] ?? KITS.base01)();
}
