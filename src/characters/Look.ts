// The clean BASE character (no hair, no clothes, no weapon — plain underwear), male or female, is the look every
// character is built on: every warrior, and every class while still a beginner. Hair, clothes and weapons come on top.
import { playedClass } from '../skills/Jobs';
import { CHARACTER_PREVIEWS } from '../config/layout';
import { lookOf, lookPreviewKey, StoredLook } from './LookArt';
import type { BaseLook } from '../game/Body';

export type Gender = 'male' | 'female';
export const genderOf = (c: { gender?: string } | null | undefined): Gender => (c?.gender === 'female' ? 'female' : 'male');
/** The base look of this character (its gender), or null when it wears its class art. */
export const baseLookOf = (c: { classId: string; level: number; gender?: string }): Gender | null =>
  playedClass(c) === 'warrior' ? genderOf(c) : null;
/** What the game draws on the base character (hairstyle, hair colour, skin tone, face), or null (bald, as drawn). */
export const headLookOf = (c: { gender?: string; look?: StoredLook } | null | undefined): BaseLook | null => {
  const l = lookOf(c);
  return l ? { hair: l.hair, hairColor: l.hairColor, skin: l.skin, face: l.face, eyeColor: l.eyeColor } : null;
};
/** CHARACTER_PREVIEWS key for menus / portraits. */
export const previewKeyOf = (c: { classId: string; level: number; gender?: string; appearanceId: string | null; look?: StoredLook }): string => {
  const g = baseLookOf(c);
  const l = g ? lookOf(c) : null;
  if (l && CHARACTER_PREVIEWS[lookPreviewKey(l)]) return lookPreviewKey(l); // the full style (hair, face, skin, outfit, sword)
  return g ? `base/${g}` : `${c.classId}/${c.appearanceId ?? `${c.classId}_default`}`;
};
