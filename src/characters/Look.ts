// The clean BASE character (no hair, no clothes, no weapon — plain underwear), male or female, is the look every
// character is built on: every warrior, and every class while still a beginner. Hair, clothes and weapons come on top.
import { BEGINNER_TO } from '../skills/Jobs';
import { CHARACTER_PREVIEWS } from '../config/layout';
import { lookOf, lookPreviewKey } from './LookArt';

export type Gender = 'male' | 'female';
export const genderOf = (c: { gender?: string } | null | undefined): Gender => (c?.gender === 'female' ? 'female' : 'male');
/** The base look of this character (its gender), or null when it wears its class art. */
export const baseLookOf = (c: { classId: string; level: number; gender?: string }): Gender | null =>
  c.classId === 'warrior' || c.level < BEGINNER_TO ? genderOf(c) : null;
/** The hairstyle chosen at creation (index), or null (bald). */
export const hairOf = (c: { look?: { hair: number } } | null | undefined): number | null => (c?.look ? c.look.hair : null);
/** CHARACTER_PREVIEWS key for menus / portraits. */
export const previewKeyOf = (c: { classId: string; level: number; gender?: string; appearanceId: string | null; look?: { hair: number; top: number; pants: number; shoes: number } }): string => {
  const g = baseLookOf(c);
  const l = g ? lookOf(c) : null;
  if (l && CHARACTER_PREVIEWS[lookPreviewKey(l)]) return lookPreviewKey(l); // the full style (hair, outfit, colours, sword)
  if (g && c.look && CHARACTER_PREVIEWS[`base/${g}/h${c.look.hair}`]) return `base/${g}/h${c.look.hair}`; // with the chosen hairstyle
  return g ? `base/${g}` : `${c.classId}/${c.appearanceId ?? `${c.classId}_default`}`;
};
