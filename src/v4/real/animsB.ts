// Candidate B's animation set: the four lab animations with the same timings, segments and events, and two changes
// that B's chibi proportions need (animations belong to the body standard, never to an outfit):
//   run    — the sword stays raised forward like the idle stance (the near arm swings a little), instead of trailing
//            behind the body, where B's long blade poked out behind the head;
//   attack — B's arms are too short to lift the fist above the head, so during the wind-up the near arm and the sword
//            are drawn behind the head (a corrective draw-order key) instead of across the face.
import { ATTACK, IDLE, JUMP, RD, RUN, STANCE, hold, loop } from '../rig/anims';
import type { AnimDef } from '../rig/types';

export const RUN_B: AnimDef = {
  ...RUN,
  bones: {
    ...RUN.bones,
    uparm_F: { r: loop(RD, [STANCE.uparm_F + 10, STANCE.uparm_F, STANCE.uparm_F - 10, STANCE.uparm_F, STANCE.uparm_F + 10]) },
    forearm_F: { r: hold(STANCE.forearm_F) }, hand_F: { r: hold(STANCE.hand_F) }, weapon: { r: hold(STANCE.weapon) },
  },
  order: [],
};

export const ATTACK_B: AnimDef = {
  ...ATTACK,
  order: [{ t: 0.1, move: 'group:armF', before: 'group:head' }, { t: 0.22, move: 'group:armF', before: null }],
};

export const ANIMS_B: Record<string, AnimDef> = { idle: IDLE, run: RUN_B, jump: JUMP, attack: ATTACK_B };
