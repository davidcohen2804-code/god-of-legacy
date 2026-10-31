// The appearance resolver (proposal 11.3): one pure function, used by the wardrobe preview and by gameplay alike.
// Per wardrobe slot the first match wins: an allowed cosmetic → the worn gear's look (unless hidden) → the base look.
// It reads gear looks only (never stats) and writes nothing back.
import type { RigDef, SlotDef } from '../rig/types';
import { HAIR_COVER } from '../rig/rig';
import type { AppearanceInput, Avatar, Item, ResolvedPart, WardrobeSlot } from './types';

export const WEARABLE: WardrobeSlot[] = ['head', 'eyeacc', 'faceacc', 'earring', 'top', 'bottom', 'overall', 'gloves', 'shoes', 'back', 'weapon'];
const ORDER: WardrobeSlot[] = ['body', 'face', 'hair', ...WEARABLE];

/** Cross-slot hides an item may declare (11.4 rule 3). Anything else is refused and noted. */
const ALLOWED_HIDES: Partial<Record<WardrobeSlot, (t: string) => boolean>> = {
  head: (t) => t.startsWith('hair.') || t === 'w:eyeacc' || t === 'w:faceacc' || t === 'w:earring',
  shoes: (t) => /^foot_[FB]\.skin$/.test(t),
  gloves: (t) => /^hand_[FB]\.(back|front)\.skin$/.test(t),
};

export class Wardrobe {
  private readonly slotIndex = new Map<string, number>();
  private readonly owned = new Map<WardrobeSlot, number[]>();

  constructor(readonly rig: RigDef, readonly items: Map<string, Item>, readonly base: { body: Item; face: Item }) {
    rig.slots.forEach((s, i) => {
      this.slotIndex.set(s.name, i);
      const l = this.owned.get(s.owner) ?? []; l.push(i); this.owned.set(s.owner, l);
    });
  }

  get slots(): SlotDef[] { return this.rig.slots; }

  /** May `item` draw into rig slot `s`? (one owner per rig slot; an overall uses what top and bottom own) */
  owns(item: Item, s: SlotDef): boolean {
    return s.owner === item.wslot || (item.wslot === 'overall' && (s.owner === 'top' || s.owner === 'bottom'));
  }

  resolve(input: AppearanceInput): Avatar {
    const notes: string[] = [];
    const get = (id: string | undefined, slot: WardrobeSlot, from: string): Item | undefined => {
      if (!id) return undefined;
      const it = this.items.get(id);
      if (!it) { notes.push(`${from} ${slot}: unknown item ${id}`); return undefined; }
      if (it.wslot !== slot) { notes.push(`${from} ${slot}: ${id} belongs to ${it.wslot}`); return undefined; }
      if (!it.bodies.includes(input.body)) { notes.push(`${from} ${slot}: ${id} has no ${input.body} version`); return undefined; }
      if (slot === 'weapon' && it.family !== input.family) { notes.push(`${from} weapon: ${id} is a ${it.family}, the class uses a ${input.family} — not shown`); return undefined; }
      return it;
    };
    const cos = input.cosmetics.equipped, gear = input.gearLooks;
    const pick: Partial<Record<WardrobeSlot, Item>> = { body: this.base.body };
    pick.face = get(cos.face, 'face', 'cosmetic') ?? get(input.look.face, 'face', 'base') ?? this.base.face;
    pick.hair = get(cos.hair, 'hair', 'cosmetic') ?? get(input.look.hair, 'hair', 'base');
    for (const s of WEARABLE) {
      if (s === 'top' || s === 'bottom' || s === 'overall') continue;
      pick[s] = get(cos[s], s, 'cosmetic') ?? get(gear[s], s, 'gear');
    }
    // top / bottom / overall: a cosmetic beats gear; an overall takes both halves
    const cT = get(cos.top, 'top', 'cosmetic'), cB = get(cos.bottom, 'bottom', 'cosmetic'), cO = get(cos.overall, 'overall', 'cosmetic');
    const gT = get(gear.top, 'top', 'gear'), gB = get(gear.bottom, 'bottom', 'gear'), gO = get(gear.overall, 'overall', 'gear');
    if (cO) { pick.overall = cO; if (cT || cB || gT || gB) notes.push(`overall ${cO.id} replaces top and bottom`); }
    else if ((cT || cB) && gO) { pick.top = cT; pick.bottom = cB; notes.push(`a cosmetic ${cT ? 'top' : 'bottom'} removes the gear overall ${gO.id}; the other half falls back to the default`); }
    else if (gO) pick.overall = gO;
    else { pick.top = cT ?? gT; pick.bottom = cB ?? gB; }
    for (const s of input.cosmetics.hidden ?? []) if (pick[s] && s !== 'body' && s !== 'face') { notes.push(`${s} hidden by the player (${pick[s]!.id})`); delete pick[s]; }

    const parts: (ResolvedPart | null)[] = this.rig.slots.map(() => null);
    const hidden = new Set<number>();
    for (const s of ORDER) {
      const it = pick[s];
      if (!it) continue;
      for (const p of it.parts) {
        const i = this.slotIndex.get(p.slot);
        if (i === undefined) { notes.push(`${it.id}: no rig slot ${p.slot}`); continue; }
        if (!this.owns(it, this.rig.slots[i])) { notes.push(`${it.id}: ${p.slot} belongs to ${this.rig.slots[i].owner} — refused`); continue; }
        if (parts[i]) { notes.push(`${it.id}: ${p.slot} already drawn by ${parts[i]!.item} — refused`); continue; }
        parts[i] = { item: it.id, ...(p.frame ? { frame: p.frame } : {}), ...(p.variants ? { variants: p.variants } : {}) };
      }
      for (const name of HAIR_COVER[it.hairCover ?? 'none']) { const i = this.slotIndex.get(name); if (i !== undefined) hidden.add(i); }
      for (const h of it.hides ?? []) {
        if (!ALLOWED_HIDES[it.wslot]?.(h)) { notes.push(`${it.id}: may not hide ${h} — ignored`); continue; }
        if (h.startsWith('w:')) for (const i of this.owned.get(h.slice(2) as WardrobeSlot) ?? []) hidden.add(i);
        else { const i = this.slotIndex.get(h); if (i !== undefined) hidden.add(i); }
      }
    }
    for (const i of hidden) parts[i] = null;
    return {
      items: pick, parts, unarmed: !pick.weapon, notes,
      sig: ORDER.map((s) => pick[s]?.id ?? '-').join('|'),
    };
  }
}

/** The image a resolved part shows for the pose's corrective channels. Unarmed, the grip shows a fist. */
export function frameOf(part: ResolvedPart, slot: SlotDef, swaps: Record<string, string>, unarmed: boolean): string | undefined {
  if (part.frame) return part.frame;
  if (!slot.channel || !part.variants) return undefined;
  let v = swaps[slot.channel];
  if (unarmed && slot.channel === 'handF' && v === 'grip') v = 'fist';
  return part.variants[v];
}
