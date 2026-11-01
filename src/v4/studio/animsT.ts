// The template body's animations for a one-handed sword held in the near hand. The legs, hips, torso and head keep the
// lab's four animations (idle, run, jump, attack, made on candidate B's rig), carried over so every bone keeps its world
// angle. The arms are posed anew for the near-hand sword, in world angles (the clearest way to see where a hand and a
// blade go): the blade stays clear of the face, the raised sword passes over the near side of the head, and the free
// far hand balances. Shared by every outfit: no animation knows anything about clothing.
import { ANIMS_B } from '../real/animsB';
import { RIG_B } from '../real/rigB';
import { hold, k } from '../rig/anims';
import { sample } from '../rig/pose';
import type { AnimDef, BoneTimeline, Ease, Key, RigDef } from '../rig/types';
import { RIG_T } from './rigT';

const restLocal = (rig: RigDef): Record<string, number> => Object.fromEntries(rig.bones.map((b) => [b.name, b.r]));
const ARM = new Set(['uparm_B', 'forearm_B', 'hand_B', 'weapon', 'uparm_F', 'forearm_F', 'hand_F', 'offhand']);

/** `a` (keys on candidate B's rig) → the template rig, keeping every bone's world angle; the arms are left out (they
 *  are posed for the near-hand sword below). */
export function carryOver(a: AnimDef, from: RigDef = RIG_B, to: RigDef = RIG_T): AnimDef {
  const oldR = restLocal(from), newR = restLocal(to);
  const bones: Record<string, BoneTimeline> = {};
  for (const b of to.bones) {
    if (ARM.has(b.name) || !(b.name in oldR)) continue;
    const tl = a.bones[b.name] ?? {};
    const d = oldR[b.name] - newR[b.name];
    const r = tl.r ? tl.r.map((q) => ({ ...q, v: q.v + d })) : Math.abs(d) > 1e-6 ? hold(d) : undefined;
    if (tl.x || tl.y || r) bones[b.name] = { ...tl, ...(r ? { r } : {}) };
  }
  return { ...a, bones };
}

/** A world-angle arm pose: upper arm, forearm, hand (degrees, 90 = straight down) and, for the sword hand, the blade. */
type ArmPose = [number, number, number, number?];

/** Arm keys in world angles → local keys for the template rig, against the torso's own curve in `base`. */
function armKeys(base: AnimDef, side: 'B' | 'F', keys: [number, ArmPose, Ease?][]): Record<string, BoneTimeline> {
  const R = restLocal(RIG_T);
  const chest = (t: number) => sample(base.bones.hip?.r, t) + R.hip + sample(base.bones.chest?.r, t) + R.chest;
  const up: Key[] = [], fo: Key[] = [], ha: Key[] = [], we: Key[] = [];
  for (const [t, [u, f, h, blade], e] of keys) {
    const ease = e ?? 'inout';
    up.push(k(t, u - chest(t) - R[`uparm_${side}`], ease));
    fo.push(k(t, f - u - R[`forearm_${side}`], ease));
    ha.push(k(t, h - f - R[`hand_${side}`], ease));
    if (blade !== undefined) we.push(k(t, blade - h - R.weapon, ease));
  }
  // each joint turns the short way between keys (a key written as 178° after one at -158° is the same direction)
  for (const ch of [up, fo, ha, we]) for (let i = 1; i < ch.length; i++) ch[i].v -= 360 * Math.round((ch[i].v - ch[i - 1].v) / 360);
  return { [`uparm_${side}`]: { r: up }, [`forearm_${side}`]: { r: fo }, [`hand_${side}`]: { r: ha }, ...(we.length ? { weapon: { r: we } } : {}) };
}

const loopKeys = (dur: number, poses: ArmPose[]): [number, ArmPose][] => poses.map((p, i) => [(dur * i) / (poses.length - 1), p]);

// the stance: the sword hand low in front of the waist, the blade forward-up, clear of the face; the free hand a loose
// fist in front of the far hip
const STANCE_NEAR: ArmPose = [72, 28, 34, -44];
const STANCE_FAR: ArmPose = [84, 52, 58];

function idle(): AnimDef {
  const b = carryOver(ANIMS_B.idle);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', loopKeys(1.6, [STANCE_NEAR, [74, 31, 36, -43], STANCE_NEAR])),
      ...armKeys(b, 'F', loopKeys(1.6, [STANCE_FAR, [86, 55, 60], STANCE_FAR])),
    },
    swaps: { ...b.swaps, handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'fist' }] },
  };
}

function run(): AnimDef {
  const b = carryOver(ANIMS_B.run), D = b.dur;
  return {
    ...b,
    bones: {
      ...b.bones,
      // the sword arm swings a little against the near leg, the blade held forward-up and bobbing
      ...armKeys(b, 'B', loopKeys(D, [[62, 4, 10, -48], [70, 14, 20, -40], [80, 26, 32, -30], [70, 14, 20, -40], [62, 4, 10, -48]])),
      // the free arm swings against the far leg
      ...armKeys(b, 'F', loopKeys(D, [[118, 72, 76], [92, 40, 46], [58, 0, 6], [92, 40, 46], [118, 72, 76]])),
    },
    swaps: { ...b.swaps, handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'fist' }] },
    order: [],
  };
}

function jump(): AnimDef {
  const b = carryOver(ANIMS_B.jump);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', [[0, [78, 36, 40, -40]], [0.08, [62, 14, 18, -50]], [0.22, [46, -8, -4, -58]], [0.36, [44, -12, -8, -60]], [0.5, [50, -2, 2, -55]], [0.6, [58, 10, 14, -50]], [0.65, [76, 32, 36, -42]], [0.7, STANCE_NEAR]]),
      ...armKeys(b, 'F', [[0, [96, 70, 74]], [0.08, [64, 34, 40]], [0.22, [24, -12, -8]], [0.36, [14, -24, -20]], [0.5, [30, -4, 0]], [0.6, [56, 24, 30]], [0.65, [92, 64, 70]], [0.7, STANCE_FAR]]),
    },
    swaps: { ...b.swaps, handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'fist' }, { t: 0.22, v: 'open' }, { t: 0.62, v: 'fist' }] },
  };
}

// The basic attack, an overhead chop on the same gameplay timings (wind-up 0–0.20, the hit at 0.20, active 0.20–0.45,
// recovery 0.45–0.65): the sword arm rises up and back over the near shoulder (the hand passing over the ear, the blade
// dropping behind the head and the back), swings over the top and chops forward-down; the free fist comes up in guard,
// then is thrown back on the strike.
function attack(): AnimDef {
  const b = carryOver(ANIMS_B.attack);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', [
        [0, STANCE_NEAR],
        // up beside the head's near side (the hand over the ear and the hair, never across the face)
        [0.07, [-88, -100, -100, -95]],
        // back over the shoulder: the blade drops behind the head and the back
        [0.15, [-105, -150, -160, 120]],
        [0.19, [-108, -158, -165, 110], 'in'],
        // over the top, still beside the head, through the forward arc, then the chop forward-down
        [0.212, [-95, -85, -70, -75], 'in'],
        [0.236, [-42, -22, -12, -22], 'linear'],
        [0.26, [10, 15, 20, 30], 'out'],
        [0.33, [14, 22, 28, 38]],
        [0.42, [38, 46, 52, 62]],
        [0.52, [60, 30, 34, -10]],
        [0.65, STANCE_NEAR],
      ]),
      ...armKeys(b, 'F', [
        [0, STANCE_FAR], [0.07, [60, 10, 16]], [0.15, [36, -26, -20]], [0.19, [34, -28, -22]],
        [0.26, [112, 98, 102], 'out'], [0.33, [110, 95, 100]], [0.45, [98, 76, 80]], [0.65, STANCE_FAR],
      ]),
    },
    swaps: { ...b.swaps, handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'fist' }] },
    // a raised sword arm goes behind the head (the face stays clear, as the hand cannot reach over a head this big),
    // still in front of the body; it comes back in front of the head for the chop
    order: [{ t: 0.04, move: 'group:armB', before: 'group:head' }, { t: 0.25, move: 'group:armB', before: null }],
  };
}

export const ANIMS_T: Record<string, AnimDef> = { idle: idle(), run: run(), jump: jump(), attack: attack() };
