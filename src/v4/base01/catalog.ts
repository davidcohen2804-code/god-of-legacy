// BASE-01's wardrobe, read from data: every item in assets/base01.json (written by the builder from the art director's
// pictures) is a list of pieces, each cut to one of the template's parts. Which rig slot a piece goes to follows from the
// item's wardrobe slot and the part (PIECE_SLOT), so a new item of a supported type needs no code here: a picture and a
// line in tools/v4/base01/items.json.
import type { Catalog } from '../wardrobe/catalog';
import type { Item, ItemPart, WardrobeSlot } from '../wardrobe/types';
import data from './assets/base01.json';

export interface B01Frame { name: string; x: number; y: number; w: number; h: number; px: number; py: number; rows?: Record<string, number> }
export const B01_FRAMES: B01Frame[] = data.frames as B01Frame[];
export const B01_TEXTURE = 'v4base01';

/** The rig slot a piece of an item takes: by the item's wardrobe slot and the template part it was cut to. */
export const PIECE_SLOT: Partial<Record<WardrobeSlot, Record<string, string>>> = {
  body: { head: 'head.skin', torso: 'torso.skin', pelvis: 'pelvis.skin', arm_B: 'arm_B.skin', arm_F: 'arm_F.skin', leg_B: 'leg_B.skin', leg_F: 'leg_F.skin', foot_B: 'foot_B.skin', foot_F: 'foot_F.skin' },
  top: {
    torso: 'torso.cloth', arm_B: 'arm_B.sleeve', arm_F: 'arm_F.sleeve', uparm_B: 'arm_B.plateU', forearm_B: 'arm_B.plateL', uparm_F: 'arm_F.plateU', forearm_F: 'arm_F.plateL',
    pauldron_B: 'arm_B.pauldron', pauldron_F: 'arm_F.pauldron', tail_B: 'leg_B.tail', tail_F: 'leg_F.tail',
  },
  bottom: { pelvis: 'pelvis.cloth', pelvis_under: 'pelvis.under', leg_B: 'leg_B.cloth', leg_F: 'leg_F.cloth' },
  shoes: { foot_B: 'foot_B.shoe', foot_F: 'foot_F.shoe', leg_B: 'leg_B.shaft', leg_F: 'leg_F.shaft' },
  head: { head: 'head.hat' },
};
/** What a slot's item covers of the body under it (it is drawn over it anyway; this only keeps a bare edge from showing). */
const HIDES: Partial<Record<WardrobeSlot, string[]>> = { shoes: ['foot_B.skin', 'foot_F.skin'] };
/** The body's bare pieces an item may hide, by the parts the exporter measured it covering (its `covers`). */
const COVER_HIDES: Partial<Record<WardrobeSlot, Record<string, string>>> = {
  bottom: { pelvis: 'pelvis.skin', leg_B: 'leg_B.skin', leg_F: 'leg_F.skin' },
  shoes: { foot_B: 'foot_B.skin', foot_F: 'foot_F.skin' },
  // headwear is drawn as the whole head (the hair under it redrawn): the bare head under it goes
  head: { head: 'head.skin' },
};

export interface ItemData { id: string; slot: WardrobeSlot | 'hat'; name: string; parts: { part: string; frame: string }[]; grip?: number[]; covers?: string[]; loose?: boolean }
/** A loose bottom's legs (wider than a boot at the ankle) are drawn over the shoes, not tucked into them. */
const LOOSE: Record<string, string> = { leg_B: 'leg_B.over', leg_F: 'leg_F.over' };
export const B01_ITEMS = data.items as ItemData[];
const has = new Set(B01_FRAMES.map((f) => f.name));

export function buildCatalogB01(): Catalog {
  const items = new Map<string, Item>();
  const put = (it: Omit<Item, 'bodies'>): Item => { const full: Item = { ...it, bodies: ['male_std'] }; items.set(it.id, full); return full; };
  let body: Item | undefined;
  for (const it of B01_ITEMS) {
    const wslot: WardrobeSlot = it.slot === 'hat' ? 'head' : it.slot;
    if (wslot === 'weapon') {
      put({ id: it.id, wslot, name: it.name, set: 'A', family: 'sword', parts: it.parts.map((p) => ({ slot: 'weapon', frame: p.frame })) });
      continue;
    }
    const map = PIECE_SLOT[wslot] ?? {};
    // the waistband's underlap is drawn only under a top (with no top the bare belly shows)
    const slotOf = (part: string) => (wslot === 'bottom' && it.loose && LOOSE[part]) || map[part];
    const parts: ItemPart[] = it.parts.filter((p) => map[p.part]).map((p) => ({ slot: slotOf(p.part), frame: p.frame, ...(p.part === 'pelvis_under' ? { onlyWith: 'top' as WardrobeSlot } : {}) }));
    if (wslot === 'body') {
      for (const s of ['B', 'F']) {
        const v: Record<string, string> = { open: `base/hand_${s}` };
        if (has.has(`base/hand_${s}_grip`)) v.grip = `base/hand_${s}_grip`;
        parts.push({ slot: `hand_${s}.skin`, variants: v });
      }
    }
    const hides = [...new Set([...(HIDES[wslot] ?? []), ...(it.covers ?? []).map((p) => COVER_HIDES[wslot]?.[p]).filter((h): h is string => !!h)])];
    const made = put({ id: it.id, wslot, name: it.name, set: wslot === 'body' ? 'base' : 'A', parts, ...(hides.length ? { hides } : {}) });
    if (wslot === 'body') body = made;
  }
  // the head piece carries the face and the hair (BASE-01 v1): the face and hair items are empty stand-ins
  const face = put({ id: 'b01_face', wslot: 'face', name: 'Face', set: 'base', parts: [] });
  put({ id: 'b01_hair', wslot: 'hair', name: 'Hair', set: 'base', parts: [] });
  if (!body) throw new Error('BASE-01: no body item');
  return { items, art: new Map(), base: { body, face } };
}

/** The wardrobe's choices per slot, in item-list order. */
export const B01_WEAR: { slot: WardrobeSlot; label: string; items: { id: string; name: string }[] }[] = (() => {
  const by: Partial<Record<WardrobeSlot, { id: string; name: string }[]>> = {};
  for (const it of B01_ITEMS) { const w: WardrobeSlot = it.slot === 'hat' ? 'head' : it.slot; if (w === 'body') continue; (by[w] ??= []).push({ id: it.id, name: it.name }); }
  const LABEL: Partial<Record<WardrobeSlot, string>> = { top: 'Top', bottom: 'Trousers', shoes: 'Boots', head: 'Hat', weapon: 'Weapon' };
  return (['top', 'bottom', 'shoes', 'head', 'weapon'] as WardrobeSlot[]).filter((s) => by[s]).map((s) => ({ slot: s, label: LABEL[s] ?? s, items: by[s]! }));
})();
