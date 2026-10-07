// Character stats (MapleStory-style AP): STR / DEX / INT / LUK. Every level up gives AP_PER_LEVEL points to place (or
// AUTO places them for the job). Each job has a main stat (the big one for damage) and a secondary one; the stat value
// 4 × main + secondary drives the damage (STR / DEX / INT / LUK all count where the job uses them). Also from the stats:
// a little more HP (STR, the level), critical rate (LUK, DEX) and evasion (DEX, LUK). Speed % and Jump % are 100 % and
// come from passives, buffs (and later gear). Points move freely: − takes one back, RESET takes them all.
// The PvP arena ignores all of this: everyone fights on the same numbers there.

export type StatKey = 'str' | 'dex' | 'int' | 'luk';
export const STAT_KEYS: StatKey[] = ['str', 'dex', 'int', 'luk'];
export const STAT_NAMES: Record<StatKey, string> = { str: 'STR', dex: 'DEX', int: 'INT', luk: 'LUK' };
export const STAT_INFO: Record<StatKey, string> = {
  str: 'Strength — the Warrior and Samurai main stat; also a little more HP.',
  dex: 'Dexterity — the Archer main stat, the Samurai second stat; also evasion and a little critical rate.',
  int: 'Intelligence — the Book Mage main stat.',
  luk: 'Luck — critical rate and evasion; the Book Mage second stat.',
};
export type Stats = Record<StatKey, number>;
export const BASE_STAT = 4;
export const AP_PER_LEVEL = 5;
export const baseStats = (): Stats => ({ str: BASE_STAT, dex: BASE_STAT, int: BASE_STAT, luk: BASE_STAT });

/** Per class: how much each stat counts toward the stat value (main ×4, secondary ×1; the Samurai: STR and DEX alike). */
const WEIGHT: Record<string, Partial<Stats>> = {
  warrior: { str: 4, dex: 1 }, archer: { dex: 4, str: 1 }, book_mage: { int: 4, luk: 1 }, samurai: { str: 2.5, dex: 2.5 },
};
const weight = (cls: string) => WEIGHT[cls] ?? WEIGHT.warrior;
/** Main / secondary stat of a class (what AUTO raises: 4 of 5 points to the main one, 1 to the secondary). */
export function mainStats(cls: string): [StatKey, StatKey] {
  const w = weight(cls); const ks = (Object.keys(w) as StatKey[]).sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0));
  return [ks[0], ks[1] ?? ks[0]];
}

/** AP earned so far (level 1 has none). */
export const totalAp = (level: number): number => Math.max(0, level - 1) * AP_PER_LEVEL;
export const spentAp = (s: Stats): number => STAT_KEYS.reduce((n, k) => n + Math.max(0, s[k] - BASE_STAT), 0);
export const freeAp = (s: Stats, level: number): number => Math.max(0, totalAp(level) - spentAp(s));

/** Stored stats made safe: whole numbers ≥ the base, never more AP spent than earned (extra comes off the top). */
export function cleanStats(raw: unknown, level: number): Stats {
  const s = baseStats();
  if (raw && typeof raw === 'object') for (const k of STAT_KEYS) { const v = (raw as Record<string, unknown>)[k]; if (typeof v === 'number' && Number.isInteger(v) && v >= BASE_STAT) s[k] = Math.min(v, 9999); }
  let over = spentAp(s) - totalAp(level);
  while (over > 0) { const k = STAT_KEYS.reduce((a, b) => (s[b] > s[a] ? b : a)); s[k]--; over--; }
  return s;
}

/** AUTO: the free AP into the job's stats (4 main : 1 secondary, like MapleStory's auto-assign). */
export function autoAssign(s: Stats, cls: string, level: number): Stats {
  const out = { ...s }; let ap = freeAp(out, level); const [m, sec] = mainStats(cls);
  while (ap > 0) { const total = spentAp(out); out[(total % 5 === 4 && sec !== m) ? sec : m]++; ap--; }
  return out;
}

export interface Derived {
  /** 4 × main + secondary (the class's own weights). */
  statValue: number;
  /** Damage dealt × from the stats. */
  dmgMul: number;
  /** Max HP × from the level and STR. */
  hpMul: number;
  /** Critical rate added (0..1). */
  critAdd: number;
  /** Evasion added (0..1). */
  evadeAdd: number;
}
/** Level 1, base stats: the measure (every multiplier 1 there). */
const REF = (cls: string) => STAT_KEYS.reduce((n, k) => n + (weight(cls)[k] ?? 0) * BASE_STAT, 0);
export function derive(s: Stats, cls: string, level: number): Derived {
  const w = weight(cls), statValue = STAT_KEYS.reduce((n, k) => n + (w[k] ?? 0) * s[k], 0);
  return {
    statValue: Math.round(statValue),
    dmgMul: 1 + (statValue - REF(cls)) / 600,
    hpMul: 1 + 0.025 * Math.max(0, level - 1) + 0.002 * (s.str - BASE_STAT),
    critAdd: Math.min(0.3, 0.0015 * (s.luk - BASE_STAT) + 0.0005 * (s.dex - BASE_STAT)),
    evadeAdd: Math.min(0.2, 0.0005 * (s.dex - BASE_STAT) + 0.001 * (s.luk - BASE_STAT)),
  };
}
