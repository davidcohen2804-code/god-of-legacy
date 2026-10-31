// Candidate B's wardrobe: the canonical basic clothing (set A) and the Golden Warrior set (set B), cut from the two
// parts sheets drawn for B, and the sun-guard longsword. The face and hair are painted on the head. The body owns what
// every outfit shows: the head, the forearms with their leather bracers, and the fists (gauntlets replace the fists).
import type { Catalog } from '../wardrobe/catalog';
import type { Item, ItemPart, WardrobeSlot } from '../wardrobe/types';
import data from './assets/b.json';

/** One atlas frame: its rectangle and its pivot (normalised to the frame). */
export interface BFrame { name: string; x: number; y: number; w: number; h: number; px: number; py: number }
export const B_FRAMES: { 256: BFrame[]; 512: BFrame[] } = { 256: data.frames256, 512: data.frames512 };

const far = (side: 'F' | 'B') => (side === 'B' ? '_far' : '');
const part = (slot: string, frame: string): ItemPart => ({ slot, frame });
const sides = (fn: (side: 'F' | 'B') => ItemPart[]): ItemPart[] => [...fn('B'), ...fn('F')];

export function buildCatalogB(): Catalog {
  const items = new Map<string, Item>();
  const put = (it: Omit<Item, 'bodies'>): Item => { const full: Item = { ...it, bodies: ['male_std'] }; items.set(it.id, full); return full; };
  const body = put({
    id: 'b_body', wslot: 'body', name: 'Body (B)', set: 'base',
    parts: [
      part('head.skin', 'b/head'),
      ...sides((s) => [part(`forearm_${s}.skin`, `b/basic/forearm${far(s)}`), part(`hand_${s}.front.skin`, `b/basic/fist${far(s)}`)]),
    ],
  });
  const face = put({ id: 'b_face', wslot: 'face', name: 'Face (painted on the head)', set: 'base', parts: [] });
  for (const [look, set, label] of [['basic', 'A', 'Basic'], ['gold', 'B', 'Golden Warrior']] as const) {
    put({ id: `b_${look}_top`, wslot: 'top', name: `${label} top`, set, parts: [part('torso.over', `b/${look}/torso`), ...sides((s) => [part(`uparm_${s}.over`, `b/${look}/uparm${far(s)}`)])] });
    put({ id: `b_${look}_bottom`, wslot: 'bottom', name: `${label} trousers`, set, parts: [part('hip.under', `b/${look}/hips`), ...sides((s) => [part(`thigh_${s}.over`, `b/${look}/thigh${far(s)}`)])] });
    put({ id: `b_${look}_shoes`, wslot: 'shoes', name: `${label} boots`, set, parts: sides((s) => [part(`shin_${s}.over`, `b/${look}/shin${far(s)}`), part(`foot_${s}.over`, `b/${look}/foot${far(s)}`)]) });
  }
  put({
    id: 'b_gold_gloves', wslot: 'gloves', name: 'Golden Warrior gauntlets', set: 'B',
    parts: sides((s) => [part(`forearm_${s}.over`, `b/gold/forearm${far(s)}`), part(`hand_${s}.front.glove`, `b/gold/fist${far(s)}`)]),
    hides: ['hand_F.front.skin', 'hand_B.front.skin'],
  });
  put({ id: 'b_gold_cape', wslot: 'back', name: 'Golden Warrior cape', set: 'B', parts: [part('cape.back.1', 'b/gold/cape')] });
  put({ id: 'b_sun_sword', wslot: 'weapon', name: 'Sun-guard longsword', set: 'A', family: 'sword', parts: [part('weapon', 'b/sword')] });
  return { items, art: new Map(), base: { body, face } };
}

/** Worn gameplay gear → B's looks. The job armour is an overall in Gear.ts; B shows it as the Golden top and trousers.
 *  The job helmet has no B art yet, so it shows nothing. */
export const GEAR_LOOKS_B: Record<string, Partial<Record<WardrobeSlot, string>>> = {
  starter_sword: { weapon: 'b_sun_sword' }, starter_shirt: { top: 'b_basic_top' }, starter_pants: { bottom: 'b_basic_bottom' }, starter_boots: { shoes: 'b_basic_shoes' },
  warrior_job_sword: { weapon: 'b_sun_sword' }, warrior_job_armor: { top: 'b_gold_top', bottom: 'b_gold_bottom' }, warrior_job_boots: { shoes: 'b_gold_shoes' },
};

/** The full Golden Warrior set as cosmetics. */
export const GOLD_SET_B: Partial<Record<WardrobeSlot, string>> = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };
