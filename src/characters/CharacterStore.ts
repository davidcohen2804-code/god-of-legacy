// Load / validate / save / delete / selected slot. Independent from Phaser.
import schema from '../data/CharacterSelect_DataSchema.json';
import { Character, CharacterSelectData, CharacterSlot, SlotId } from './CharacterTypes';

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

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }
}

export const CharacterStore = new Store();
