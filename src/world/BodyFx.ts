// Render-only body modifiers applied on top of the current pose (never moves the feet / collider):
// jump lift (origin shift), squash & stretch, idle breathing, hurt lean / death topple (angle about the feet).
// Idempotent per frame: if no pose setter ran since the last call, the previous modifiers are undone first.
import Phaser from 'phaser';

export interface BodyMods { lift: number; sx: number; sy: number; angle: number }
export const NEUTRAL: BodyMods = { lift: 0, sx: 1, sy: 1, angle: 0 };

interface Memo { bx: number; by: number; bsx: number; bsy: number; wy: number; wsx: number; wsy: number }
const memo = new WeakMap<Phaser.GameObjects.Sprite, Memo>();

export function applyBodyMods(p: Phaser.GameObjects.Sprite, m: BodyMods): void {
  const prev = memo.get(p);
  if (prev && p.originY === prev.wy && p.scaleX === prev.wsx && p.scaleY === prev.wsy) {
    p.setOrigin(prev.bx, prev.by); // pose unchanged since last frame: restore the base before re-applying
    p.setScale(prev.bsx, prev.bsy);
  }
  const bx = p.originX, by = p.originY, bsx = p.scaleX, bsy = p.scaleY;
  const sx = bsx * m.sx, sy = bsy * m.sy;
  const oy = by + m.lift / Math.max(1, p.height * sy);
  p.setScale(sx, sy);
  p.setOrigin(bx, oy);
  p.setAngle(m.angle);
  memo.set(p, { bx, by, bsx, bsy, wy: oy, wsx: sx, wsy: sy });
}

/** Jump arc: 0..1 progress -> lift in world px (take-off crouch, parabolic air, landing). */
export const JUMP = { totalMs: 540, crouchMs: 70, landMs: 100, height: 34 };
export type JumpPhase = 'takeoff' | 'rise' | 'fall' | 'land';

export function jumpState(ms: number): { phase: JumpPhase; lift: number; sx: number; sy: number; air: number } {
  const air = JUMP.totalMs - JUMP.crouchMs - JUMP.landMs;
  if (ms < JUMP.crouchMs) { const t = ms / JUMP.crouchMs; return { phase: 'takeoff', lift: 0, sx: 1 + 0.06 * t, sy: 1 - 0.08 * t, air: 0 }; }
  if (ms < JUMP.crouchMs + air) {
    const t = (ms - JUMP.crouchMs) / air, lift = 4 * JUMP.height * t * (1 - t);
    const st = t < 0.25 ? 1 - t / 0.25 : 0; // stretch right after take-off
    return { phase: t < 0.5 ? 'rise' : 'fall', lift, sx: 1 - 0.04 * st, sy: 1 + 0.06 * st, air: lift / JUMP.height };
  }
  const t = Math.min(1, (ms - JUMP.crouchMs - air) / JUMP.landMs), k = Math.sin(Math.PI * Math.min(1, t * 1.4));
  return { phase: 'land', lift: 0, sx: 1 + 0.07 * k * (1 - t), sy: 1 - 0.09 * k * (1 - t), air: 0 };
}

/** Subtle idle breathing (scaleY about the feet). */
export const breathe = (ms: number): number => 1 + 0.012 * Math.sin((ms / 1000) * Math.PI * 2 * 0.45);

/** Hurt lean for sprites without hurt frames: quick tilt away, settles over the flash. */
export function hurtLean(flashMs: number, totalMs: number, dir: string): number {
  const t = Math.min(1, flashMs / totalMs), s = dir === 'left' ? 1 : -1;
  return s * 7 * Math.sin(Math.PI * t) * (1 - t * 0.3);
}

/** Death topple for sprites without death frames (eased, about the feet). */
export function deathTopple(deadMs: number, fadeMs: number, dir: string): number {
  const t = Math.min(1, deadMs / (fadeMs * 0.6)), e = 1 - (1 - t) * (1 - t) * (1 - t);
  return (dir === 'left' ? 1 : -1) * 82 * e;
}
