// Character Skill Animations — cosmetic body poses for Skill System V1 skills (never gameplay authority).
// Timing from src/data/skill-animations.json: per-frame ms durations; frame 3 starts at the skill's active boundary.
import Phaser from 'phaser';
import MANIFEST from '../data/skill-animations.json';
import { Dir } from '../world/collision';
import { getSkill } from './SkillRegistry';

type Sheet = (typeof MANIFEST.sheets)[number];
interface Profile { sheet: Sheet; durations: number[]; total: number }

const SHEETS = new Map<string, Sheet>(MANIFEST.sheets.map((s) => [s.id, s]));
const PROFILES = new Map<string, Profile>();
for (const [skillId, t] of Object.entries(MANIFEST.timingProfiles)) {
  const sheet = SHEETS.get(t.sheet);
  if (sheet) PROFILES.set(skillId, { sheet, durations: t.frameDurationsMs, total: t.frameDurationsMs.reduce((a, b) => a + b, 0) });
}
/**
 * Four-class pack: Warrior/Book Mage slots 4–7 deliberately reuse current body sheets. The pack's body PNGs for these
 * skills are byte-identical copies of the sheets above, so the existing sheets are reused (no duplicate textures).
 * Timing follows the same rule as the manifest profiles: frames 0–2 split castMs, frame 3 starts exactly at the active
 * boundary, frames 3–5 split the rest of the action lock.
 */
const EXTENSION_BODY: Record<string, string> = {
  whirlwind: 'warrior_dash_slash', shield_slam: 'warrior_ground_breaker', blade_storm: 'warrior_rising_slash', final_strike: 'warrior_ground_breaker',
  frost_nova: 'book_mage_astral_burst', lightning_chain: 'book_mage_cast', meteor: 'book_mage_binding_rune', time_warp: 'book_mage_astral_burst',
};
const split3 = (t: number) => { const a = Math.floor(t / 3), b = Math.floor((t - a) / 2); return [a, b, t - a - b]; };
for (const [skillId, sheetId] of Object.entries(EXTENSION_BODY)) {
  const sk = getSkill(skillId), sheet = SHEETS.get(sheetId);
  if (!sk || !sheet || PROFILES.has(skillId)) continue;
  const rest = sk.actionLockMs - sk.castMs;
  const durations = [...split3(sk.castMs), ...split3(rest)];
  PROFILES.set(skillId, { sheet, durations, total: sk.actionLockMs });
}
const key = (id: string) => `skillanim-${id}`;

/**
 * Facing correction (checked frame by frame against the world idle sprites): the Warrior sheets and the Book Mage
 * Binding Rune / Astral Burst sheets have their side rows swapped (the 'right' row faces left and vice versa);
 * Book Mage Cast has both side rows facing right, so left = the right row mirrored. Down / up rows are correct.
 */
const SIDE_FIX: Record<string, Partial<Record<Dir, { row: number; flip: boolean }>>> = {
  warrior_dash_slash: { right: { row: 2, flip: false }, left: { row: 1, flip: false } },
  warrior_rising_slash: { right: { row: 2, flip: false }, left: { row: 1, flip: false } },
  warrior_ground_breaker: { right: { row: 2, flip: false }, left: { row: 1, flip: false } },
  book_mage_binding_rune: { right: { row: 2, flip: false }, left: { row: 1, flip: false } },
  book_mage_astral_burst: { right: { row: 2, flip: false }, left: { row: 1, flip: false } },
  book_mage_cast: { left: { row: 1, flip: true } },
};

/** Row + mirror used for a sheet and facing (QA reads this too). */
export function skillAnimationRow(sheetId: string, dir: Dir): { row: number; flip: boolean } {
  const s = SHEETS.get(sheetId)!;
  return SIDE_FIX[sheetId]?.[dir] ?? { row: (s.directionRows as Record<Dir, number>)[dir] ?? 0, flip: false };
}

export function skillAnimationSheet(skillId: string): string | null { return PROFILES.get(skillId)?.sheet.id ?? null; }

export function preloadSkillAnimations(scene: Phaser.Scene): void {
  for (const s of MANIFEST.sheets) {
    if (!scene.textures.exists(key(s.id))) scene.load.spritesheet(key(s.id), s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
  }
}

export function hasSkillAnimation(skillId: string): boolean { return PROFILES.has(skillId); }

/**
 * Shows the body frame for `elapsed` ms since the accepted cast (feet stay at the sprite position: fixed origin/scale).
 * Returns false once the animation has finished (caller restores idle/walk).
 */
export function applySkillAnimation(p: Phaser.GameObjects.Sprite, skillId: string, dir: Dir, elapsed: number): boolean {
  const pr = PROFILES.get(skillId);
  if (!pr || elapsed >= pr.total || elapsed < 0) return false;
  let col = 0, acc = 0;
  for (let i = 0; i < pr.durations.length; i++) { acc += pr.durations[i]; if (elapsed < acc) { col = i; break; } }
  const s = pr.sheet, { row, flip } = skillAnimationRow(s.id, dir);
  if (p.anims.isPlaying) p.anims.stop();
  p.setTexture(key(s.id), row * s.framesPerDirection + col);
  p.setOrigin(s.origin.x, s.origin.y); // mirroring happens about the feet origin
  p.setScale(s.recommendedWorldScale);
  p.setFlipX(flip);
  return true;
}

/** For QA: the frame index (column) shown at `elapsed`, or -1 when finished. */
export function skillAnimationColumn(skillId: string, elapsed: number): number {
  const pr = PROFILES.get(skillId);
  if (!pr || elapsed >= pr.total) return -1;
  let acc = 0;
  for (let i = 0; i < pr.durations.length; i++) { acc += pr.durations[i]; if (elapsed < acc) return i; }
  return -1;
}
