// Level / EXP progression (MapleStory-style table for the first levels, then +10% per level).
const EARLY = [15, 34, 57, 92, 135, 372, 560, 840, 1242]; // EXP to go from level N to N+1 (N = 1..9)
export const MAX_LEVEL = 200;

/** EXP needed to reach the next level from `level`. */
export function expToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  if (level <= EARLY.length) return EARLY[level - 1];
  return Math.round(EARLY[EARLY.length - 1] * Math.pow(1.1, level - EARLY.length));
}

/** Add EXP; returns the new level / exp and how many levels were gained. */
export function addExp(level: number, exp: number, gain: number): { level: number; exp: number; ups: number } {
  let l = level, e = exp + Math.max(0, gain), ups = 0;
  while (l < MAX_LEVEL && e >= expToNext(l)) { e -= expToNext(l); l++; ups++; }
  if (l >= MAX_LEVEL) e = 0;
  return { level: l, exp: e, ups };
}
