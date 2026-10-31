// Gameplay → rig: today's PoseQuery (src/game/Body.ts, produced by poseQuery() in src/game/PoseState.ts) picked up
// unchanged and mapped onto the lab animations. Gameplay owns the timing: a skill's startup / active / recovery are
// fitted onto the animation's segments, so art never moves a kit's timings.
import type { PoseQuery } from '../../game/Body';
import type { AnimDef } from './types';
import { ANIMS } from './anims';

export interface RigTime { anim: AnimDef; t: number; /** a stand-in for a move the lab does not animate */ stand?: string }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** The lab's jump: takeoff speed (world px / s) and the takeoff / landing lengths (ms). */
export const JUMP_VZ = 600, TAKEOFF_MS = 80, LAND_MS = 90;

/** `anims`: the body standard's animation set (the lab's placeholder set by default). */
export function rigTime(q: PoseQuery, anims: Record<string, AnimDef> = ANIMS): RigTime {
  switch (q.k) {
    case 'loop': {
      if (q.state === 'run' || q.state === 'walk') {
        const rate = q.state === 'walk' ? 0.6 : Math.max(0.75, Math.min(1.15, q.speed / 270));
        return { anim: anims.run, t: (q.t / 1000) * rate, ...(q.state === 'walk' ? { stand: 'walk (run played slower)' } : {}) };
      }
      return { anim: anims.idle, t: q.t / 1000 };
    }
    case 'jump': {
      const J = anims.jump, m = J.marks!;
      if (q.phase === 'takeoff') return { anim: J, t: m.air * clamp01(q.t / TAKEOFF_MS) };
      if (q.phase === 'land') return { anim: J, t: m.land + (m.end - m.land) * clamp01(q.t / LAND_MS) };
      const vz = q.vz ?? (q.phase === 'rise' ? JUMP_VZ * 0.6 : q.phase === 'apex' ? 0 : -JUMP_VZ * 0.6);
      return { anim: J, t: m.air + (m.land - m.air) * clamp01((JUMP_VZ - vz) / (2 * JUMP_VZ)) };
    }
    case 'skill': {
      const A = anims.attack, m = A.marks!;
      const e = q.elapsed, s = Math.max(1, q.startup), a = Math.max(1, q.active), r = Math.max(1, q.recovery);
      const t = e < s ? m.active * (e / s)
        : e < s + a ? m.active + (m.recovery - m.active) * ((e - s) / a)
        : m.recovery + (m.end - m.recovery) * clamp01((e - s - a) / r);
      return { anim: A, t, ...(q.id !== 'warrior_basic' ? { stand: `${q.id} (basic swing)` } : {}) };
    }
    default:
      return { anim: anims.idle, t: 0, stand: q.k };
  }
}
