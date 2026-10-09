// The PvP arena's fighters: the select screen's roster — the four ready heroes (START HERO) — and you as the chosen one.
import { CharacterStore } from '../characters/CharacterStore';
import type { Character } from '../characters/CharacterTypes';
import HERO_ATLAS from '../data/hero-atlas.json';

/** The roster, in its order on the select screen. */
export const ROSTER = ['warrior', 'samurai', 'book_mage', 'archer', 'gambler'] as const;
/** The heroes' level (as START HERO: every job and skill open). */
const HERO_LEVEL = 100;

/** A hero's card (the approved model picture): file, size, and the face square on it (x, y, size). */
export function heroCard(cls: string): { file: string; w: number; h: number; face: { x: number; y: number; s: number } } | null {
  const c = (HERO_ATLAS as unknown as Record<string, { card?: [number, number, number, number, number] }>)[cls]?.card;
  return c ? { file: `assets/final/heroes/${cls}/card.png`, w: c[0], h: c[1], face: { x: c[2], y: c[3], s: c[4] } } : null;
}

/** You in the arena as `cls`: that ready hero, under your selected character's name. A copy, nothing of it is saved. */
export function fighterFor(cls: string): Character {
  const sel = CharacterStore.getSelectedCharacter();
  return CharacterStore.heroOf(cls, sel?.name ?? 'Player', HERO_LEVEL);
}
