// BASE-01's animations: the lab's idle, run, jump and attack. The legs, hips, torso and head keep their motion,
// carried over so every bone keeps its world angle; the arms are posed for a weapon held in the near hand, in world
// angles (90 = straight down, 0 = forward): the blade stays clear of the face, the free far hand balances. Items never
// have animations of their own: everything worn rides these same bones.
import { ANIMS_B } from '../real/animsB';
import { RIG_B } from '../real/rigB';
import { k } from '../rig/anims';
import { sample } from '../rig/pose';
import type { AnimDef, Ease, Key, RigDef } from '../rig/types';
import { carryOver } from '../studio/animsT';
import { RIG_B01 } from './rig';

const restLocal = (rig: RigDef): Record<string, number> => Object.fromEntries(rig.bones.map((b) => [b.name, b.r]));
type ArmPose = [number, number, number, number?];

function armKeys(base: AnimDef, side: 'B' | 'F', keys: [number, ArmPose, Ease?][]) {
  const R = restLocal(RIG_B01);
  const chest = (t: number) => sample(base.bones.hip?.r, t) + R.hip + sample(base.bones.chest?.r, t) + R.chest;
  const up: Key[] = [], fo: Key[] = [], ha: Key[] = [], we: Key[] = [];
  for (const [t, [u, f, h, blade], e] of keys) {
    const ease = e ?? 'inout';
    up.push(k(t, u - chest(t) - R[`uparm_${side}`], ease));
    fo.push(k(t, f - u - R[`forearm_${side}`], ease));
    ha.push(k(t, h - f - R[`hand_${side}`], ease));
    if (blade !== undefined) we.push(k(t, blade - h - R.weapon, ease));
  }
  for (const ch of [up, fo, ha, we]) for (let i = 1; i < ch.length; i++) ch[i].v -= 360 * Math.round((ch[i].v - ch[i - 1].v) / 360);
  return { [`uparm_${side}`]: { r: up }, [`forearm_${side}`]: { r: fo }, [`hand_${side}`]: { r: ha }, ...(we.length ? { weapon: { r: we } } : {}) };
}

const loopKeys = (dur: number, poses: ArmPose[]): [number, ArmPose][] => poses.map((p, i) => [(dur * i) / (poses.length - 1), p]);
const carry = (a: AnimDef) => carryOver(a, RIG_B, RIG_B01);
const HANDS = { handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'grip' }] };

// the stance: the weapon hand low in front of the waist, the blade forward-up; the free hand a loose fist by the hip
const STANCE_NEAR: ArmPose = [76, 34, 40, -40];
const STANCE_FAR: ArmPose = [84, 60, 64];

function idle(): AnimDef {
  const b = carry(ANIMS_B.idle);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', loopKeys(1.6, [STANCE_NEAR, [78, 37, 42, -39], STANCE_NEAR])),
      ...armKeys(b, 'F', loopKeys(1.6, [STANCE_FAR, [86, 63, 67], STANCE_FAR])),
    },
    swaps: { ...b.swaps, ...HANDS },
  };
}

function run(): AnimDef {
  const b = carry(ANIMS_B.run), D = b.dur;
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', loopKeys(D, [[64, 8, 14, -46], [72, 18, 24, -38], [82, 30, 36, -28], [72, 18, 24, -38], [64, 8, 14, -46]])),
      ...armKeys(b, 'F', loopKeys(D, [[118, 74, 78], [92, 42, 48], [60, 4, 10], [92, 42, 48], [118, 74, 78]])),
    },
    swaps: { ...b.swaps, ...HANDS },
    order: [],
  };
}

function jump(): AnimDef {
  const b = carry(ANIMS_B.jump);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', [[0, [80, 40, 44, -38]], [0.08, [64, 18, 22, -48]], [0.22, [48, -6, -2, -56]], [0.36, [46, -10, -6, -58]], [0.5, [52, 0, 4, -53]], [0.6, [60, 14, 18, -48]], [0.65, [78, 36, 40, -40]], [0.7, STANCE_NEAR]]),
      ...armKeys(b, 'F', [[0, [96, 70, 74]], [0.08, [64, 36, 42]], [0.22, [26, -10, -6]], [0.36, [16, -22, -18]], [0.5, [32, -2, 2]], [0.6, [58, 26, 32]], [0.65, [92, 66, 70]], [0.7, STANCE_FAR]]),
    },
    swaps: { ...b.swaps, ...HANDS },
  };
}

// the basic attack, an overhead chop on the game's timings (wind-up 0-0.20, hit at 0.20, recovery to 0.65)
function attack(): AnimDef {
  const b = carry(ANIMS_B.attack);
  return {
    ...b,
    bones: {
      ...b.bones,
      ...armKeys(b, 'B', [
        [0, STANCE_NEAR],
        [0.07, [-88, -100, -100, -95]],
        [0.15, [-105, -150, -160, 120]],
        [0.19, [-108, -158, -165, 110], 'in'],
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
    swaps: { ...b.swaps, ...HANDS },
    order: [{ t: 0.04, move: 'group:armB', before: 'group:head' }, { t: 0.25, move: 'group:armB', before: null }],
  };
}

export const ANIMS_B01: Record<string, AnimDef> = { idle: idle(), run: run(), jump: jump(), attack: attack() };
