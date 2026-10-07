// Mirrors CharacterSelect_DataSchema.json.
import type { GearState } from '../items/Gear';

export type SlotId = 1 | 2 | 3 | 4;

export interface Character {
  id: string;
  name: string;
  classId: string;
  level: number; // integer >= 1
  /** EXP toward the next level. */
  exp?: number;
  createdAt: string; // ISO-8601
  lastPlayedAt: string | null; // ISO-8601 | null
  appearanceId: string | null;
  /** The clean base character he / she is built on (default male). */
  gender?: 'male' | 'female';
  /** Chosen at creation: hairstyle, hair colour, skin tone, face, eye colour and the colour of each starter piece (indices;
   *  absent = bald, no outfit; hair colour / skin / face / eyes absent = brown, the drawn tone, the head's own face, the
   *  drawn eyes). */
  look?: { hair: number; top: number; pants: number; shoes: number; hairColor?: number; skin?: number; face?: number; eyeColor?: number };
  /** Cosmetic ownership + equipped slots (visual only). */
  cosmetics?: { owned: string[]; equipped: Record<string, string> };
  /** Quests by id: taken (progress per objective) or finished. */
  quests?: Record<string, QuestState>;
  /** Equipment: owned pieces (item, colour) and what is worn (gives stats, drawn on the character). Every character has
   *  it (the starter set when stored without it). */
  gear?: GearState;
}

export interface QuestState { state: 'active' | 'done'; progress: number[] }

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
