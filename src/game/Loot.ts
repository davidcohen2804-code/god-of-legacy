// Early-game loot: gold and potions. Monsters drop them on the floor when defeated; walking over them picks them up.
// Potions sit on two hotkeys (HP / MP) next to the skill dock; each one restores a share of the max.

export type PotionId = 'red_potion' | 'blue_potion';
export interface PotionDef { id: PotionId; name: string; stat: 'hp' | 'mp'; share: number; icon: string; color: string }
export const POTIONS: Record<PotionId, PotionDef> = {
  red_potion: { id: 'red_potion', name: 'Red Potion', stat: 'hp', share: 0.4, icon: 'assets/final/items/red_potion.png', color: '#ff7a6b' },
  blue_potion: { id: 'blue_potion', name: 'Blue Potion', stat: 'mp', share: 0.4, icon: 'assets/final/items/blue_potion.png', color: '#7fb6ff' },
};
export const POTION_IDS: PotionId[] = ['red_potion', 'blue_potion'];
export const GOLD_ICON = { small: 'assets/final/items/gold_small.png', big: 'assets/final/items/gold_big.png' };
/** Gold at or above this drops as the big pile. */
export const GOLD_BIG = 40;
/** Between two potions of the same kind (ms). */
export const POTION_DELAY = 400;
export const BAG_MAX = 999;
export const GOLD_MAX = 999_999_999;
/** What a new character starts with. */
export const STARTER_BAG: Record<PotionId, number> = { red_potion: 10, blue_potion: 5 };

export interface Drop { kind: 'gold' | 'item'; id?: PotionId; amount: number }
/** A defeated monster's drops: always some gold (by its EXP), sometimes a potion. */
export function rollDrops(exp: number, rnd: () => number = Math.random): Drop[] {
  const out: Drop[] = [{ kind: 'gold', amount: Math.max(1, Math.round(exp * (0.8 + rnd() * 0.6) + 2)) }];
  const r = rnd();
  if (r < 0.16) out.push({ kind: 'item', id: 'red_potion', amount: 1 });
  else if (r < 0.26) out.push({ kind: 'item', id: 'blue_potion', amount: 1 });
  return out;
}

/** Stored bag made safe: known potions only, whole counts 0..BAG_MAX. */
export function cleanBag(raw: unknown): Record<PotionId, number> {
  const b = { red_potion: 0, blue_potion: 0 };
  if (raw && typeof raw === 'object') for (const id of POTION_IDS) { const v = (raw as Record<string, unknown>)[id]; if (typeof v === 'number' && Number.isInteger(v) && v >= 0) b[id] = Math.min(BAG_MAX, v); }
  return b;
}
export const cleanGold = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(GOLD_MAX, v) : 0);
export const fmtGold = (n: number): string => n.toLocaleString('en-US');
