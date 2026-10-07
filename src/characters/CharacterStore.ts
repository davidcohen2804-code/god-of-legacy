// Load / validate / save / delete / selected slot. Independent from Phaser.
import schema from '../data/CharacterSelect_DataSchema.json';
import { Character, CharacterSelectData, CharacterSlot, SlotId } from './CharacterTypes';
import { GearState, cleanGear, starterGear } from '../items/Gear';

const KEY = 'godoflegacy.characters';
const MAX_SLOTS = 4;

const isSlotId = (v: unknown): v is SlotId => v === 1 || v === 2 || v === 3 || v === 4;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;

function validCharacter(c: unknown): c is Character {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return isStr(o.id) && isNonEmpty(o.name) && isNonEmpty(o.classId)
    && Number.isInteger(o.level) && (o.level as number) >= 1
    && isStr(o.createdAt)
    && (o.lastPlayedAt === null || isStr(o.lastPlayedAt))
    && (o.appearanceId === null || isStr(o.appearanceId));
}

function defaults(): CharacterSelectData {
  return {
    version: schema.version,
    maxSlots: MAX_SLOTS,
    selectedSlotId: null,
    slots: schema.slots.slice(0, MAX_SLOTS).map((s) => ({ slotId: s.slotId as SlotId, character: null })),
  };
}

/** Malformed data never throws: bad slots become empty, bad structure becomes defaults. */
function sanitize(raw: unknown): CharacterSelectData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  if (o.version !== schema.version || !Array.isArray(o.slots) || o.slots.length > MAX_SLOTS) return d;
  for (const s of o.slots as unknown[]) {
    if (!s || typeof s !== 'object') continue;
    const so = s as Record<string, unknown>;
    if (!isSlotId(so.slotId)) continue;
    const target = d.slots.find((x) => x.slotId === so.slotId)!;
    if (validCharacter(so.character)) {
      const c = so.character;
      target.character = {
        id: c.id, name: c.name, classId: c.classId, level: c.level,
        createdAt: c.createdAt, lastPlayedAt: c.lastPlayedAt, appearanceId: c.appearanceId,
      };
      const gd = (c as unknown as { gender?: unknown }).gender;
      if (gd === 'male' || gd === 'female') target.character.gender = gd;
      const lk = (c as unknown as { look?: Record<string, unknown> }).look;
      const ix = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10 ? v : null);
      if (lk && typeof lk === 'object' && ['hair', 'top', 'pants', 'shoes'].every((k) => ix(lk[k]) !== null)) {
        target.character.look = { hair: lk.hair as number, top: lk.top as number, pants: lk.pants as number, shoes: lk.shoes as number };
        for (const k of ['hairColor', 'skin', 'face'] as const) { const v = ix(lk[k]); if (v !== null) target.character.look[k] = v; } // added later: older characters lack them
      }
      // equipment: as stored, or the starter set (in the creation colours) for characters stored before it existed
      target.character.gear = cleanGear((c as unknown as { gear?: unknown }).gear) ?? starterGear(target.character.look);
      const cos = (c as unknown as { cosmetics?: { owned?: unknown; equipped?: unknown } }).cosmetics;
      if (cos && Array.isArray(cos.owned) && cos.equipped && typeof cos.equipped === 'object') {
        target.character.cosmetics = {
          owned: (cos.owned as unknown[]).filter(isStr),
          equipped: Object.fromEntries(Object.entries(cos.equipped as Record<string, unknown>).filter(([, v]) => isStr(v))) as Record<string, string>,
        };
      }
    }
  }
  d.selectedSlotId = isSlotId(o.selectedSlotId) ? o.selectedSlotId : null;
  return d;
}

class Store {
  private data: CharacterSelectData;

  constructor() {
    let raw: unknown = null;
    try { const s = localStorage.getItem(KEY); if (s) raw = JSON.parse(s); } catch { raw = null; }
    this.data = sanitize(raw);
  }

  getSlots(): readonly CharacterSlot[] { return this.data.slots; }
  getSlot(id: SlotId): CharacterSlot { return this.data.slots.find((s) => s.slotId === id)!; }
  getSelectedId(): SlotId | null { return this.data.selectedSlotId; }
  getSelectedCharacter(): Character | null {
    const id = this.data.selectedSlotId;
    return id ? this.getSlot(id).character : null;
  }

  select(id: SlotId): void { this.data.selectedSlotId = id; this.save(); }

  deleteCharacter(id: SlotId): void { this.getSlot(id).character = null; this.save(); }

  /** Creates a character in an EMPTY slot only; returns false (and changes nothing) otherwise. */
  createCharacter(slotId: SlotId, name: string, classId: string, appearanceId: string, gender: 'male' | 'female' = 'male', look?: Character['look']): boolean {
    const slot = this.getSlot(slotId);
    const clean = name.trim();
    if (slot.character || !clean || !classId) return false;
    slot.character = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}`,
      name: clean, classId, level: 1,
      createdAt: new Date().toISOString(), lastPlayedAt: null, appearanceId, gender, ...(look ? { look: { ...look } } : {}),
      gear: starterGear(look), // the starter set, worn, in the chosen colours
    };
    this.save();
    return true;
  }

  /** Cosmetics of a stored character (ownership API kept abstract for a later backend). */
  getCosmetics(charId: string): { owned: string[]; equipped: Record<string, string> } {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    return c?.cosmetics ? { owned: [...c.cosmetics.owned], equipped: { ...c.cosmetics.equipped } } : { owned: [], equipped: {} };
  }

  setCosmetics(charId: string, v: { owned: string[]; equipped: Record<string, string> }): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.cosmetics = { owned: [...new Set(v.owned)], equipped: { ...v.equipped } };
    this.save();
  }

  /** Equipment of a stored character. */
  getGear(charId: string): GearState | null {
    const g = this.data.slots.find((s) => s.character?.id === charId)?.character?.gear;
    return g ? { items: g.items.map((i) => ({ ...i })), worn: { ...g.worn } } : null;
  }

  setGear(charId: string, g: GearState): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.gear = cleanGear(g) ?? c.gear;
    this.save();
  }

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }
}

export const CharacterStore = new Store();
