// The PvP arena's fighters: the select screen's roster (one per class) and the character you play as the chosen class.
import { CharacterStore } from '../characters/CharacterStore';
import type { Character } from '../characters/CharacterTypes';
import { CHARACTER_PREVIEWS } from '../config/layout';

/** The roster, in its order on the select screen. */
export const ROSTER = ['warrior', 'samurai', 'book_mage', 'archer'] as const;

/** The class's full-size picture (select screen art and portraits). */
export const previewOf = (cls: string) => CHARACTER_PREVIEWS[`${cls}/${cls}_default`];

/**
 * You in the arena as `cls`: your own character of that class when you have one (the selected one first) — its name, look
 * and gear — else that class's fighter under your selected character's name. Played at its job with every skill open (the
 * arena's rules); a copy, nothing of it is saved.
 */
export function fighterFor(cls: string): Character {
  const sel = CharacterStore.getSelectedCharacter();
  const own = sel?.classId === cls ? sel : CharacterStore.getSlots().map((s) => s.character).find((c) => c?.classId === cls) ?? null;
  if (own) return { ...own, job: cls, level: Math.max(own.level, 30) };
  return {
    id: `arena-${cls}`, name: sel?.name ?? 'Player', classId: cls, job: cls, level: 30, exp: 0,
    createdAt: new Date(0).toISOString(), lastPlayedAt: null, appearanceId: `${cls}_default`,
    ...(cls === 'warrior' ? { look: { hair: 1, top: 0, pants: 0, shoes: 0, hairColor: 0, skin: 1, face: 0 } } : {}), // (a warrior is the base character: hair and the starter clothes)
  };
}
