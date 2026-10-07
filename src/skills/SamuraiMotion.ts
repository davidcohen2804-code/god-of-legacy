// Samurai body motion layer (presentation only, every client draws it the same from the cast timeline): the four drawn
// attack poses get real movement on top — the step into a cut, the crouch of a drawing stance, the spring of a rising
// cut, the spin, the falcon's dive, the vanishing step — plus crimson afterimages on the fast moves. Gameplay never reads
// any of this. Also the Tornado Blade's path (shared by its hits and its picture).
import type { Motion, Timeline } from './ArcherMotion';
import { footAllowed } from '../world/WorldGeometry';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
/** Damped kick: 1 at t = 0 falling to 0 by `len` ms. */
const kick = (t: number, len: number) => (t < 0 || t > len ? 0 : Math.pow(1 - t / len, 2));
const M = (o: Partial<Motion> = {}): Motion => ({ dx: 0, dy: 0, ang: 0, pivot: 58, sx: 1, sy: 1, after: false, ...o });
/** Crimson of the samurai's afterimages. */
export const SAMURAI_AFTER = 0xff3048;

/** 0 in the wind-up, 1 soon after the release, back to 0 by the end of the recovery (a step in and back). */
function lunge(e: number, T: Timeline): number {
  const r = e - T.startup;
  if (r < 0) return 0;
  if (r < T.active) return easeOut(clamp01(r / Math.max(40, T.active * 0.4)));
  return 1 - easeInOut(clamp01((r - T.active) / Math.max(1, T.recovery)));
}
/** Wind-up crouch: 0 → 1 over the startup, back to 0 in the release. */
const crouch = (e: number, T: Timeline) => (e < T.startup ? easeOut(clamp01(e / Math.max(1, T.startup))) : 1 - clamp01((e - T.startup) / 90));

/** The samurai's motion for a skill at `e` ms into the cast (null = no motion). */
export function samuraiMotion(id: string, e: number, T: Timeline, face: number, stage = 0): Motion | null {
  const A = T.startup + T.active, end = A + T.recovery, r = e - T.startup;
  if (e < 0 || e > end) return null;
  const L = lunge(e, T), c = crouch(e, T);
  switch (id) {
    case 'quick_slash': { // a step into each cut; the cross cut leans in, the rising cut springs up with the blade
      if (stage === 3) {
        if (r < 0) return M({ sy: 1 - 0.1 * c, sx: 1 + 0.05 * c, dx: -face * 3 * c });
        const up = Math.sin(Math.PI * clamp01(r / (T.active + 160)));
        return M({ dy: -14 * up, ang: -face * 8 * up, sy: 1 + 0.05 * kick(r, 200), after: r < 140 });
      }
      const big = stage === 2 ? 0.8 : 0.45;
      return M({ dx: face * 14 * big * L - face * 3 * c, ang: face * 7 * big * L * (r >= 0 ? kick(r, 260) + 0.3 : 0) - face * 3 * c, sy: 1 - 0.04 * c, after: stage === 2 && r >= 0 && r < 150 });
    }
    case 'shadow_step': // low before the step, leaning into it, a trail of afterimages
      if (r < 0) return M({ sy: 1 - 0.08 * c, sx: 1 + 0.05 * c });
      if (e < A) return M({ ang: face * 12, sx: 1.08, sy: 0.94, after: true });
      return M({ ang: face * 8 * (1 - clamp01((e - A) / T.recovery)), sy: 1 - 0.06 * kick(e - A, 200) });
    case 'spin_cut': // the body turns with the blade (facing flips round and round)
      if (r < 0) return M({ sy: 1 - 0.07 * c, sx: 1 + 0.04 * c });
      if (e < A) return M({ flip: Math.floor(r / 55) % 2 === 1, dy: -4, after: true });
      return M({ sy: 1 - 0.05 * kick(e - A, 220) });
    case 'iai_strike': { // deep drawing stance (sinks deeper while held, a tremble at full charge), then the snap of the draw
      if (r < 0) { const d = Math.min(1, e / 600), full = e > 680 ? Math.sin(e * 1.4) * 0.8 : 0; return M({ sy: 1 - 0.13 * d, sx: 1 + 0.07 * d, ang: -face * 7 * d, dx: -face * 5 * d + full }); }
      const k = kick(r, 260);
      return M({ dx: face * 22 * k, ang: face * 10 * k, sx: 1 + 0.12 * k, sy: 1 - 0.06 * k, after: r < 160 });
    }
    case 'sword_wave': // lean back, then the fling
      if (r < 0) return M({ ang: -face * 6 * c, dx: -face * 4 * c });
      return M({ dx: face * 10 * kick(r, 240), ang: face * 8 * kick(r, 240) });
    case 'mirage': // the counter stance: low and shimmering
      if (r < 0) return M({ sy: 1 - 0.06 * c });
      if (e < A) return M({ sy: 0.95, alpha: 0.82 + 0.18 * Math.sin(e / 40) });
      return M({ after: e - A < 120 });
    case 'blossom_storm': // the chase: leaning cut to cut, afterimages all the way
      if (r < 0) return M({ sy: 1 - 0.08 * c, sx: 1 + 0.05 * c });
      if (e < A) return M({ ang: face * (6 + 6 * Math.sin(r / 45)), dy: -6 * Math.abs(Math.sin(r / 70)), after: true });
      return M({ sy: 1 - 0.06 * kick(e - A, 240) });
    case 'dragon_eclipse': // vanishes in the dark, reappears in the colossal cut
      if (r < 0) return M({ alpha: 1 - 0.9 * clamp01(e / (T.startup * 0.6)), sy: 1 - 0.06 * c });
      return M({ dx: face * 24 * kick(r, 420), ang: face * 12 * kick(r, 420), sx: 1 + 0.1 * kick(r, 300), after: r < 260 });
    case 'swallow_cut': { // crouch, spring up as the blade rises, lean into the return cut, land
      if (r < 0) return M({ sy: 1 - 0.12 * c, sx: 1 + 0.06 * c, dx: -face * 3 * c });
      if (e < A) {
        const p = clamp01(r / T.active), up = Math.sin(Math.PI * Math.min(1, p * 1.1));
        return M({ dy: -24 * up, ang: p < 0.55 ? -face * 10 * up : face * 10 * up, sy: 1 + 0.06 * up, sx: 1 - 0.03 * up, after: true });
      }
      return M({ sy: 1 - 0.1 * kick(e - A, 220), sx: 1 + 0.06 * kick(e - A, 220) });
    }
    case 'hundred_cuts': // planted, trembling with the speed of the cuts, afterimages around the blade
      if (r < 0) return M({ ang: face * 4 * c, sy: 1 - 0.05 * c });
      if (e < A) return M({ dx: face * (4 + 3 * Math.sin(e * 0.9)), ang: face * (5 + 4 * Math.sin(e * 0.7)), sx: 1.03, sy: 0.97, after: true });
      return M({ dx: face * 14 * kick(e - A, 260), ang: face * 8 * kick(e - A, 260) });
    case 'quick_draw': // into the drawing stance, then up
      if (r < 0) return M({ sy: 1 - 0.1 * c, ang: -face * 4 * c });
      return M({ sy: 1 + 0.05 * kick(r, 300), dy: -4 * kick(r, 300) });
    case 'tornado_blade': // the wind-up spin, then the throw of the whirlwind
      if (r < 0) return M({ flip: Math.floor(e / 70) % 2 === 1, sy: 1 - 0.06 * c, after: true });
      return M({ dx: face * 10 * kick(r, 300), ang: face * 12 * kick(r, 300) });
    case 'falcon_dive': { // crouch, rise leaning back, dive nose-down, land low
      if (r < 0) return M({ sy: 1 - 0.14 * c, sx: 1 + 0.07 * c });
      if (e < A) { const p = clamp01(r / T.active); return M({ ang: p < 0.45 ? -face * 8 : face * 28, sx: p < 0.45 ? 1 : 1.06, after: p >= 0.3 }); }
      return M({ sy: 1 - 0.14 * kick(e - A, 260), sx: 1 + 0.08 * kick(e - A, 260) });
    }
    case 'rising_sun': case 'god_of_blades': // gathers, then rises tall as the power answers
      if (r < 0) return M({ sy: 1 - 0.06 * c, dy: 0 });
      return M({ sy: 1 + 0.08 * kick(r, 420), dy: -8 * Math.sin(Math.PI * clamp01(r / (T.active + 260))) });
    case 'sakura_bind': // the hand thrust at the ground where the ring opens
      if (r < 0) return M({ ang: -face * 5 * c, sy: 1 - 0.05 * c });
      return M({ dx: face * 6 * kick(r, 260), ang: face * 6 * kick(r, 260) });
    case 'dragon_ascension': { // low, then up with the dragon, hanging at the top, down
      if (r < 0) return M({ sy: 1 - 0.14 * c, sx: 1 + 0.08 * c });
      if (e < A) { const up = easeOut(clamp01(r / 260)); return M({ dy: -26 * up, sy: 1 + 0.06 * up, ang: -face * 5 * up, after: r < 300 }); }
      return M({ dy: -26 * (1 - easeInOut(clamp01((e - A) / T.recovery))), sy: 1 - 0.08 * kick(e - A - T.recovery * 0.7, 160) });
    }
    case 'phantom_blades': // deep stance, then he is everywhere at once (barely visible, afterimages), then back
      if (r < 0) return M({ sy: 1 - 0.12 * c, sx: 1 + 0.06 * c, ang: -face * 6 * c });
      if (e < A) return M({ alpha: 0.3 + 0.2 * Math.abs(Math.sin(r / 50)), dx: face * 10 * Math.sin(r / 37), after: true });
      return M({ sy: 1 - 0.1 * kick(e - A, 260) });
  }
  return null;
}

/** Shinsoku: the mid-air dash — leaning into it, stretched, afterimages, for `ms` after the second jump. */
export function shinsokuMotion(t: number, face: number, ms = 340): Motion | null {
  if (t < 0 || t > ms) return null;
  const k = 1 - easeInOut(t / ms);
  return M({ ang: face * 16 * k, sx: 1 + 0.1 * k, sy: 1 - 0.06 * k, after: true });
}

/** Tornado Blade: the whirlwind rolls forward one step per strike, stopping where the ground ends (walls, edges). */
export const TORNADO = { offset: 90, step: 18, everyMs: 150, count: 14, startMs: 120 };
export function tornadoPath(o: { x: number; y: number }, aim: { x: number; y: number }): { x: number; y: number }[] {
  const pts = [{ x: o.x + aim.x * TORNADO.offset, y: o.y + aim.y * TORNADO.offset }];
  for (let i = 1; i < TORNADO.count; i++) {
    const p = pts[i - 1], nx = p.x + aim.x * TORNADO.step, ny = p.y + aim.y * TORNADO.step * 0.75;
    pts.push(footAllowed(nx, ny, 0, 24) ? { x: nx, y: ny } : p);
  }
  return pts;
}
