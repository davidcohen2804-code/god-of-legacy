// The template's wardrobe, read from data: every item in assets/t1.json (written by the template build from the item
// drawings) is a list of pieces, each cut to one of the template's parts. Which rig slot a piece goes to follows from the
// item's wardrobe slot and the part (PIECE_SLOT), so an item of a supported type needs no code here.
// The head standard, the hand standard and the sword are the shared pieces every look starts from.
import type { Catalog } from '../wardrobe/catalog';
import type { Item, ItemPart, WardrobeSlot } from '../wardrobe/types';
import data from './assets/t1.json';

/** One atlas frame: rectangle, pivot (normalised), and for limb strips the rows of the joints. */
export interface TFrame { name: string; x: number; y: number; w: number; h: number; px: number; py: number; rows?: Record<string, number>; grip?: [number, number] }
export const T_FRAMES: TFrame[] = data.frames as TFrame[];
export const T_TEXTURE = 'v4t1';

/** The rig slot a piece of an item takes: by the item's wardrobe slot and the template part it was cut to. */
export const PIECE_SLOT: Partial<Record<WardrobeSlot, Record<string, string>>> = {
  body: { torso: 'torso.skin', pelvis: 'pelvis.skin', crotch: 'crotch.skin', arm_B: 'arm_B.skin', arm_F: 'arm_F.skin', leg_B: 'leg_B.skin', leg_F: 'leg_F.skin', foot_B: 'foot_B.skin', foot_F: 'foot_F.skin' },
  top: { torso: 'torso.cloth', arm_B: 'arm_B.sleeve', arm_F: 'arm_F.sleeve' },
  bottom: { pelvis: 'pelvis.cloth', crotch: 'crotch.cloth', leg_B: 'leg_B.cloth', leg_F: 'leg_F.cloth' },
  shoes: { foot_B: 'foot_B.shoe', foot_F: 'foot_F.shoe' },
};
/** Shoes cover the bare feet under them (an item may also list what it covers itself: full trousers, the bare legs). */
const HIDES: Partial<Record<WardrobeSlot, string[]>> = { shoes: ['foot_B.skin', 'foot_F.skin'] };

const HAND_STATES = ['relaxed', 'fist', 'grip', 'grip2', 'open'];
const has = new Set(T_FRAMES.map((f) => f.name));
const hands = (s: 'B' | 'F'): ItemPart[] => [
  { slot: `hand_${s}.front.skin`, variants: Object.fromEntries(HAND_STATES.map((st) => [st, `hand_${s}/${st}`])) },
  { slot: `hand_${s}.back.skin`, variants: Object.fromEntries(HAND_STATES.filter((st) => has.has(`hand_${s}/${st}_back`)).map((st) => [st, `hand_${s}/${st}_back`])) },
];

export function buildCatalogT(): Catalog {
  const items = new Map<string, Item>();
  const put = (it: Omit<Item, 'bodies'>): Item => { const full: Item = { ...it, bodies: ['male_std'] }; items.set(it.id, full); return full; };
  let body: Item | undefined;
  for (const it of data.items as { id: string; slot: WardrobeSlot; name: string; parts: { part: string; frame: string }[]; hides?: string[] }[]) {
    const map = PIECE_SLOT[it.slot] ?? {};
    const parts: ItemPart[] = it.parts.filter((p) => map[p.part]).map((p) => ({ slot: map[p.part], frame: p.frame }));
    if (it.slot === 'body') parts.push({ slot: 'head.skin', frame: 'head/face' }, ...hands('B'), ...hands('F'));
    const hides = [...(HIDES[it.slot] ?? []), ...(it.hides ?? [])];
    const made = put({ id: it.id, wslot: it.slot, name: it.name, set: it.slot === 'body' ? 'base' : 'A', parts, ...(hides.length ? { hides } : {}) });
    if (it.slot === 'body') body = made;
  }
  const face = put({ id: 't1_face', wslot: 'face', name: 'Face', set: 'base', parts: [{ slot: 'head.face', variants: { blink: 'head/face_blink', angry: 'head/face_angry', hurt: 'head/face_hurt' } }] });
  put({
    id: 't1_hair', wslot: 'hair', name: 'Hair', set: 'base',
    parts: [{ slot: 'hair.top', frame: 'head/hair' }, { slot: 'hair.fringe', variants: { neutral: 'head/fringe_neutral', blink: 'head/fringe_blink', angry: 'head/fringe_angry', hurt: 'head/fringe_hurt' } }],
  });
  put({ id: 't1_sun_sword', wslot: 'weapon', name: 'Sun-guard longsword', set: 'A', family: 'sword', parts: [{ slot: 'weapon', frame: 'weapon/sun_sword' }] });
  if (!body) throw new Error('template t1: no body item');
  return { items, art: new Map(), base: { body, face } };
}

/** The look the studio opens with: the base body in the base outfit, the sword in the near hand. */
export const BASE_OUTFIT_T: Partial<Record<WardrobeSlot, string>> = { top: 't1_shirt', bottom: 't1_trousers', shoes: 't1_boots', weapon: 't1_sun_sword' };
