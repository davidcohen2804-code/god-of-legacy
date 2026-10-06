// The clean BASE character (no hair, no clothes, no weapon — plain underwear), male or female, is the look every
// character is built on: every warrior, and every class while still a beginner. Hair, clothes and weapons come on top.
import { BEGINNER_TO } from '../skills/Jobs';

export type Gender = 'male' | 'female';
export const genderOf = (c: { gender?: string } | null | undefined): Gender => (c?.gender === 'female' ? 'female' : 'male');
/** The base look of this character (its gender), or null when it wears its class art. */
export const baseLookOf = (c: { classId: string; level: number; gender?: string }): Gender | null =>
  c.classId === 'warrior' || c.level < BEGINNER_TO ? genderOf(c) : null;
/** CHARACTER_PREVIEWS key for menus / portraits. */
export const previewKeyOf = (c: { classId: string; level: number; gender?: string; appearanceId: string | null }): string => {
  const g = baseLookOf(c);
  return g ? `base/${g}` : `${c.classId}/${c.appearanceId ?? `${c.classId}_default`}`;
};
