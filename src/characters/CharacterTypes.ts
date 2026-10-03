// Mirrors CharacterSelect_DataSchema.json.

export type SlotId = 1 | 2 | 3 | 4;

export interface Character {
  id: string;
  name: string;
  classId: string;
  level: number; // integer >= 1
  createdAt: string; // ISO-8601
  lastPlayedAt: string | null; // ISO-8601 | null
  appearanceId: string | null;
  /** Cosmetic ownership + equipped slots (visual only). */
  cosmetics?: { owned: string[]; equipped: Record<string, string> };
}

export interface CharacterSlot {
  slotId: SlotId;
  character: Character | null;
}

export interface CharacterSelectData {
  version: number;
  maxSlots: number;
  selectedSlotId: SlotId | null;
  slots: CharacterSlot[];
}
