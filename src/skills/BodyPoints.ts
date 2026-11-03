/** Points read per frame on the heroes' painted bodies, for the effects that sit on them (David 3 Nov 01:27: "under the palm
 *  in every move — it's critical"): each hero's hand (src/data/<cls>-hand.json, frame px from the frame's feet; read by eye —
 *  tools/heroes/body_points.py, the gambler's by hand_points.py). SkillFx answers `of` from the fighter's painted picture as
 *  it stands now (its frame, place, mirror, scale and turn); PVP 3D's recipes ask it too (a 3D piece at the hand). */
import type { V3 } from './HitGeometry';
import GAMBLER_HAND from '../data/gambler-hand.json';
import MAGE_HAND from '../data/book_mage-hand.json';

/** By the painted body's texture key (hero-<cls>): its hand per frame. */
export const HANDS: Record<string, Record<string, number[] | null>> = { 'hero-gambler': GAMBLER_HAND, 'hero-book_mage': MAGE_HAND };
/** A fighter's drawn hand now, in the world (x, depth y, height z over the floor) — null when its frame was not read. */
export const bodyHand: { of?: (id: string) => V3 | null } = {};
