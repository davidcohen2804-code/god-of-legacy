// Wardrobe data (proposal section 11): items are sets of part images placed in rig slots; nothing here touches
// animation data or gameplay numbers.
import type { AttachSpec, WardrobeSlot } from '../rig/types';

export type { WardrobeSlot };
export type HairCover = 'none' | 'cap' | 'helm' | 'full';
export type Family = 'sword' | 'katana' | 'bow' | 'book' | 'cane';
export type BodyStd = 'male_std';

/** One image (or one image per corrective variant) placed in a rig slot. Frame names refer to the atlas. */
export interface ItemPart {
  slot: string; frame?: string; variants?: Record<string, string>;
  /** Drawn only while this wardrobe slot is worn too (a garment's hidden underlap under the garment that covers it). */
  onlyWith?: WardrobeSlot;
}

export interface Item {
  id: string;
  wslot: WardrobeSlot;
  name: string;
  /** Lab grouping: A = cloth set, B = plate set, X = oversized / rule tests, base = the body itself. */
  set: 'A' | 'B' | 'C' | 'X' | 'base';
  parts: ItemPart[];
  /** Rig slots (or `w:<wardrobe slot>`) this item hides while worn — only from the allow-list in resolve.ts. */
  hides?: string[];
  hairCover?: HairCover;
  family?: Family;
  bodies: BodyStd[];
  /** Seam classes where it meets other slots (section 11.4): sleeve, cuff, hem, shaft, collar, tails. */
  seams?: Record<string, string>;
  /** Cloth pieces this item hangs on the rig's attachment chains, with their own spring settings. */
  attach?: AttachSpec[];
}

export interface AppearanceInput {
  body: BodyStd;
  /** Base look from character creation (here: the hairstyle and the face). */
  look: { hair: string; face: string };
  /** Looks of the worn gameplay gear, by wardrobe slot (stats stay in Gear.ts; only the look comes through). */
  gearLooks: Partial<Record<WardrobeSlot, string>>;
  cosmetics: { equipped: Partial<Record<WardrobeSlot, string>>; hidden?: WardrobeSlot[] };
  /** The class's weapon family. */
  family: Family;
}

export interface ResolvedPart { item: string; frame?: string; variants?: Record<string, string> }

export interface Avatar {
  /** The winning item per wardrobe slot. */
  items: Partial<Record<WardrobeSlot, Item>>;
  /** Per rig slot index: what to draw (null = nothing). */
  parts: (ResolvedPart | null)[];
  /** No weapon in hand: the grip pose shows a fist instead. */
  unarmed: boolean;
  /** What the resolver refused or replaced, and why. */
  notes: string[];
  /** Stable id of this look (for caching and tests). */
  sig: string;
}
