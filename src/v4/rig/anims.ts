// The four lab animations, authored as bone keys (deltas from the rest pose: degrees; B units for x / y).
// No animation knows anything about clothing: outfits only change which images sit on the bones.
import type { AnimDef, Ease, Key } from './types';

export const k = (t: number, v: number, e: Ease = 'inout'): Key => ({ t, v, e });
/** A looping curve through evenly listed values (the last value repeats the first). */
export const loop = (dur: number, vals: number[], e: Ease = 'inout'): Key[] => vals.map((v, i) => k((dur * i) / (vals.length - 1), v, e));
export const hold = (v: number): Key[] => [k(0, v, 'linear')];

// The resting stance with the sword in hand: upper arm a little forward, forearm forward, sword pointing up-forward.
export const STANCE = { uparm_F: -14, forearm_F: -62, hand_F: -8, weapon: 24, uparm_B: 8, forearm_B: -15, thigh_F: -3, shin_F: 3, thigh_B: 5, shin_B: 2 };

export const IDLE: AnimDef = {
  name: 'idle', dur: 1.6, loop: true,
  bones: {
    hip: { y: loop(1.6, [0, 0.004, 0]) },
    chest: { r: loop(1.6, [0, 1.2, 0]), y: loop(1.6, [0, -0.004, 0]) },
    head: { r: loop(1.6, [0, -1.5, 0]) },
    uparm_F: { r: loop(1.6, [STANCE.uparm_F, STANCE.uparm_F + 2, STANCE.uparm_F]) },
    forearm_F: { r: loop(1.6, [STANCE.forearm_F, STANCE.forearm_F + 4, STANCE.forearm_F]) },
    hand_F: { r: hold(STANCE.hand_F) },
    weapon: { r: hold(STANCE.weapon) },
    uparm_B: { r: loop(1.6, [STANCE.uparm_B, STANCE.uparm_B + 2, STANCE.uparm_B]) },
    forearm_B: { r: hold(STANCE.forearm_B) },
    thigh_F: { r: hold(STANCE.thigh_F) }, shin_F: { r: hold(STANCE.shin_F) },
    thigh_B: { r: hold(STANCE.thigh_B) }, shin_B: { r: hold(STANCE.shin_B) },
  },
  swaps: {
    face: [{ t: 0, v: 'neutral' }, { t: 1.25, v: 'blink' }, { t: 1.37, v: 'neutral' }],
    handF: [{ t: 0, v: 'grip' }], handB: [{ t: 0, v: 'relaxed' }], torso: [{ t: 0, v: 'rest' }],
    footF: [{ t: 0, v: 'flat' }], footB: [{ t: 0, v: 'flat' }],
  },
};

export const RD = 0.444; // 4 key poses at 9 per second (today's base run)
export const RUN: AnimDef = {
  name: 'run', dur: RD, loop: true,
  bones: {
    hip: { y: loop(RD, [0, -0.035, 0, -0.035, 0]) },
    chest: { r: loop(RD, [8, 10, 8, 10, 8]) },
    head: { r: hold(-5) },
    // contact (near leg forward) · flight · contact (far leg forward) · flight
    thigh_F: { r: loop(RD, [-40, -10, 35, 15, -40]) }, shin_F: { r: loop(RD, [15, 70, 30, 20, 15]) },
    foot_F: { r: loop(RD, [-10, 10, 25, 0, -10]) },
    thigh_B: { r: loop(RD, [35, 15, -40, -10, 35]) }, shin_B: { r: loop(RD, [30, 20, 15, 70, 30]) },
    foot_B: { r: loop(RD, [25, 0, -10, 10, 25]) },
    // arms against the legs; the sword trails behind
    uparm_F: { r: loop(RD, [35, 5, -30, 5, 35]) }, forearm_F: { r: hold(-70) }, hand_F: { r: hold(0) }, weapon: { r: hold(-70) },
    uparm_B: { r: loop(RD, [-30, 5, 35, 5, -30]) }, forearm_B: { r: hold(-75) },
  },
  swaps: {
    handF: [{ t: 0, v: 'grip' }], handB: [{ t: 0, v: 'fist' }], torso: [{ t: 0, v: 'rest' }], face: [{ t: 0, v: 'neutral' }],
    footF: [{ t: 0, v: 'flat' }, { t: 0.17, v: 'toe' }, { t: 0.29, v: 'flat' }],
    footB: [{ t: 0, v: 'toe' }, { t: 0.06, v: 'flat' }, { t: 0.39, v: 'toe' }],
  },
  order: [{ t: 0, move: 'weapon', before: 'group:torso' }],
  events: [{ t: 0, name: 'contact' }, { t: RD / 2, name: 'contact' }],
};

// Jump: takeoff 0–0.08, in the air 0.08–0.60 (placed by vertical speed), landing 0.60–0.70.
export const JUMP: AnimDef = {
  name: 'jump', dur: 0.7, loop: false,
  marks: { takeoff: 0, air: 0.08, land: 0.6, end: 0.7 },
  bones: {
    hip: { y: [k(0, 0.03), k(0.08, 0), k(0.6, 0), k(0.65, 0.04), k(0.7, 0.01)] },
    chest: { r: [k(0, 10), k(0.08, 4), k(0.22, 0), k(0.36, -3), k(0.5, 3), k(0.6, 3), k(0.65, 12), k(0.7, 3)] },
    head: { r: [k(0, -3), k(0.22, -8), k(0.36, -4), k(0.5, 6), k(0.6, 4), k(0.7, 0)] },
    thigh_F: { r: [k(0, -30), k(0.08, -10), k(0.22, -55), k(0.36, -60), k(0.5, -20), k(0.6, -15), k(0.65, -35), k(0.7, -8)] },
    shin_F: { r: [k(0, 55), k(0.08, 10), k(0.22, 75), k(0.36, 90), k(0.5, 25), k(0.6, 15), k(0.65, 65), k(0.7, 10)] },
    thigh_B: { r: [k(0, -15), k(0.08, 5), k(0.22, 10), k(0.36, -35), k(0.5, 10), k(0.6, 5), k(0.65, -20), k(0.7, 0)] },
    shin_B: { r: [k(0, 45), k(0.08, 10), k(0.22, 45), k(0.36, 85), k(0.5, 35), k(0.6, 20), k(0.65, 55), k(0.7, 8)] },
    foot_F: { r: [k(0, 0), k(0.08, 25), k(0.22, 10), k(0.5, 15), k(0.6, 0), k(0.7, 0)] },
    foot_B: { r: [k(0, 0), k(0.08, 30), k(0.22, 20), k(0.5, 20), k(0.6, 0), k(0.7, 0)] },
    uparm_F: { r: [k(0, 25), k(0.08, -40), k(0.22, -80), k(0.36, -50), k(0.5, -110), k(0.6, -100), k(0.65, 10), k(0.7, STANCE.uparm_F)] },
    forearm_F: { r: [k(0, -50), k(0.22, -40), k(0.36, -60), k(0.5, -20), k(0.6, -20), k(0.65, -60), k(0.7, STANCE.forearm_F)] },
    hand_F: { r: hold(STANCE.hand_F) },
    weapon: { r: [k(0, 24), k(0.22, 40), k(0.5, 10), k(0.7, 24)] },
    uparm_B: { r: [k(0, 30), k(0.08, -30), k(0.22, -60), k(0.36, -40), k(0.5, -90), k(0.6, -80), k(0.65, 15), k(0.7, STANCE.uparm_B)] },
    forearm_B: { r: [k(0, -20), k(0.22, -30), k(0.5, -10), k(0.65, -20), k(0.7, STANCE.forearm_B)] },
  },
  swaps: {
    handF: [{ t: 0, v: 'grip' }], torso: [{ t: 0, v: 'rest' }], face: [{ t: 0, v: 'neutral' }],
    handB: [{ t: 0, v: 'fist' }, { t: 0.22, v: 'open' }, { t: 0.65, v: 'fist' }, { t: 0.7, v: 'relaxed' }],
    footF: [{ t: 0, v: 'flat' }, { t: 0.06, v: 'toe' }, { t: 0.2, v: 'flat' }],
    footB: [{ t: 0, v: 'flat' }, { t: 0.06, v: 'toe' }, { t: 0.22, v: 'flat' }],
  },
  events: [{ t: 0.08, name: 'takeoff' }, { t: 0.6, name: 'land' }],
};

// The Warrior's basic attack, segmented like its kit timings (src/skills/FinalKit.ts warrior_basic: startup 200,
// active 250, recovery 200 ms): wind-up 0–0.20 · active 0.20–0.45 · recovery 0.45–0.65. An overhead slash: the arm
// rises in front and back over the head (the sword passes behind the body), then sweeps over the top and down.
export const ATTACK: AnimDef = {
  name: 'attack', dur: 0.65, loop: false,
  marks: { startup: 0, active: 0.2, recovery: 0.45, end: 0.65 },
  bones: {
    hip: { y: [k(0, 0), k(0.2, 0.01), k(0.28, 0.02), k(0.65, 0)] },
    chest: { r: [k(0, 0), k(0.12, -8), k(0.2, -12), k(0.28, 15, 'out'), k(0.45, 8), k(0.65, 0)] },
    head: { r: [k(0, 0), k(0.2, -6), k(0.28, 4), k(0.65, 0)] },
    uparm_F: { r: [k(0, STANCE.uparm_F), k(0.12, -120), k(0.2, -210, 'in'), k(0.28, -20, 'out'), k(0.45, 5), k(0.65, STANCE.uparm_F)] },
    forearm_F: { r: [k(0, STANCE.forearm_F), k(0.12, -60), k(0.2, -45, 'in'), k(0.28, -15, 'out'), k(0.45, -25), k(0.65, STANCE.forearm_F)] },
    hand_F: { r: [k(0, STANCE.hand_F), k(0.12, -10), k(0.2, -10, 'in'), k(0.28, -5, 'out'), k(0.45, 0), k(0.65, STANCE.hand_F)] },
    weapon: { r: [k(0, STANCE.weapon), k(0.12, 40), k(0.2, 65, 'in'), k(0.28, 60, 'out'), k(0.45, 100), k(0.65, STANCE.weapon)] },
    uparm_B: { r: [k(0, STANCE.uparm_B), k(0.2, -35), k(0.28, 40, 'out'), k(0.45, 25), k(0.65, STANCE.uparm_B)] },
    forearm_B: { r: [k(0, STANCE.forearm_B), k(0.2, -40), k(0.28, -20), k(0.65, STANCE.forearm_B)] },
    thigh_F: { r: [k(0, STANCE.thigh_F), k(0.2, -20), k(0.28, -30), k(0.45, -25), k(0.65, STANCE.thigh_F)] },
    shin_F: { r: [k(0, STANCE.shin_F), k(0.2, 10), k(0.28, 25), k(0.45, 20), k(0.65, STANCE.shin_F)] },
    thigh_B: { r: [k(0, STANCE.thigh_B), k(0.2, 15), k(0.28, 20), k(0.45, 18), k(0.65, STANCE.thigh_B)] },
    shin_B: { r: [k(0, STANCE.shin_B), k(0.2, 10), k(0.28, 15), k(0.45, 12), k(0.65, STANCE.shin_B)] },
    foot_B: { r: [k(0, 0), k(0.2, 15), k(0.45, 15), k(0.65, 0)] },
  },
  swaps: {
    handF: [{ t: 0, v: 'grip' }],
    torso: [{ t: 0, v: 'rest' }, { t: 0.22, v: 'turn' }, { t: 0.42, v: 'rest' }],
    face: [{ t: 0, v: 'neutral' }, { t: 0.06, v: 'angry' }, { t: 0.5, v: 'neutral' }],
    handB: [{ t: 0, v: 'relaxed' }, { t: 0.1, v: 'fist' }, { t: 0.55, v: 'relaxed' }],
    footF: [{ t: 0, v: 'flat' }], footB: [{ t: 0, v: 'flat' }, { t: 0.2, v: 'toe' }, { t: 0.5, v: 'flat' }],
  },
  // the sword passes behind the body during the wind-up, then comes back in front for the strike
  order: [{ t: 0.1, move: 'weapon', before: 'group:torso' }, { t: 0.22, move: 'weapon', before: null }],
  events: [{ t: 0.2, name: 'hit' }],
};

export const ANIMS: Record<string, AnimDef> = { idle: IDLE, run: RUN, jump: JUMP, attack: ATTACK };
