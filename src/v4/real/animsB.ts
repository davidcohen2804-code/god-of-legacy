// Candidate B's animation set. Animations belong to the body standard, never to an outfit. Same four animations, same
// timings, segments and events as Phase 1, rebuilt around B's combat stance: the bone angles fitted to the approved
// illustration (assets/b_stance.json, written by tools/v4/parts/fit_pose.py).
//   idle   — the illustration's stance, breathing;
//   run    — the near arm swings, the sword arm stays raised forward (B's long blade trailing behind poked out behind
//            the head), the legs as in Phase 1;
//   jump   — Phase 1's jump, re-centred on B's stance; the sword arm re-posed so the blade stays upright in front of
//            the face and never tips back over the head;
//   attack — a new overhead chop on the same timings (see ATTACK_B).
import { ATTACK, IDLE, JUMP, RD, RUN, STANCE, hold, k, loop } from '../rig/anims';
import type { AnimDef, BoneTimeline, Ease, Key } from '../rig/types';
import stanceData from './assets/b_stance.json';

/** B's stance: deltas from the rig's rest pose (degrees; dx, dy in B). */
export const STANCE_B: Record<string, number> = stanceData.pose;
const S = STANCE_B;
const ROT_BONES = ['hip', 'chest', 'head', 'uparm_F', 'forearm_F', 'hand_F', 'weapon', 'uparm_B', 'forearm_B', 'hand_B', 'thigh_F', 'shin_F', 'foot_F', 'thigh_B', 'shin_B', 'foot_B'];
const P = STANCE as Record<string, number>;

/** `keys` moved by `d` (every key). */
const shift = (keys: Key[] | undefined, d: number): Key[] | undefined => keys?.map((q) => ({ ...q, v: q.v + d }));

/** A Phase 1 animation re-centred on B's stance: every rotation key moves by (B's stance − Phase 1's stance) for its
 *  bone, and the hips carry the stance's offset. The shapes and timings of the motion stay the same. */
function recentre(a: AnimDef): AnimDef {
  const bones: Record<string, BoneTimeline> = {};
  for (const name of new Set([...Object.keys(a.bones), ...ROT_BONES])) {
    const tl = a.bones[name] ?? {}, d = (S[name] ?? 0) - (P[name] ?? 0);
    const r = tl.r ? shift(tl.r, d) : d ? hold(d) : undefined;
    bones[name] = { ...tl, ...(r ? { r } : {}) };
  }
  bones.hip = { ...bones.hip, x: shift(a.bones.hip?.x, S.dx) ?? hold(S.dx), y: shift(a.bones.hip?.y, S.dy) ?? hold(S.dy) };
  return { ...a, bones };
}

const breathe = (v: number, amp: number, dur = 1.6) => loop(dur, [v, v + amp, v]);
const at = (pairs: [number, number, Ease?][]) => pairs.map(([t, v, e]) => k(t, v, e ?? 'inout'));

export const IDLE_B: AnimDef = {
  ...IDLE,
  bones: {
    hip: { x: hold(S.dx), y: breathe(S.dy, 0.004), r: hold(S.hip) },
    chest: { r: breathe(S.chest, 1.2), y: loop(1.6, [0, -0.004, 0]) },
    head: { r: breathe(S.head, -1.5) },
    uparm_F: { r: breathe(S.uparm_F, 2) }, forearm_F: { r: breathe(S.forearm_F, 3) }, hand_F: { r: hold(S.hand_F) }, weapon: { r: hold(S.weapon) },
    uparm_B: { r: breathe(S.uparm_B, 2) }, forearm_B: { r: breathe(S.forearm_B, 3) }, hand_B: { r: hold(S.hand_B) },
    thigh_F: { r: hold(S.thigh_F) }, shin_F: { r: hold(S.shin_F) }, foot_F: { r: hold(S.foot_F) },
    thigh_B: { r: hold(S.thigh_B) }, shin_B: { r: hold(S.shin_B) }, foot_B: { r: hold(S.foot_B) },
  },
};

export const RUN_B: AnimDef = {
  ...RUN,
  bones: {
    ...RUN.bones,
    hip: { ...RUN.bones.hip, x: hold(S.dx) },
    uparm_F: { r: loop(RD, [S.uparm_F + 8, S.uparm_F, S.uparm_F - 8, S.uparm_F, S.uparm_F + 8]) },
    forearm_F: { r: hold(S.forearm_F) }, hand_F: { r: hold(S.hand_F) }, weapon: { r: hold(S.weapon) },
  },
  order: [],
};

const JUMP_R = recentre(JUMP);
export const JUMP_B: AnimDef = {
  ...JUMP_R,
  bones: {
    ...JUMP_R.bones,
    // posed in world terms (the arm forward and up, the sword square to the fist): the fist stays out in front of the
    // face while it is high, so the blade stands upright clear of the head; it drops with the landing
    uparm_F: { r: at([[0, S.uparm_F], [0.08, 28], [0.22, -63], [0.36, -75], [0.5, -91], [0.6, -76], [0.65, -30], [0.7, S.uparm_F]]) },
    forearm_F: { r: at([[0, S.forearm_F], [0.08, -115], [0.22, -70], [0.36, -63], [0.5, -50], [0.6, -58], [0.65, -110], [0.7, S.forearm_F]]) },
    hand_F: { r: at([[0, S.hand_F], [0.08, 35], [0.22, 35], [0.36, 37], [0.5, 38], [0.6, 38], [0.65, 36], [0.7, S.hand_F]]) },
    weapon: { r: at([[0, S.weapon], [0.08, 0], [0.65, 0], [0.7, S.weapon]]) },
  },
};

// The Warrior's basic attack for B, on the same gameplay timings (wind-up 0–0.20, active 0.20–0.45, recovery
// 0.45–0.65; the hit event at 0.20): an overhead chop. The far arm was posed in world terms (the upper arm, the forearm,
// the wrist bend, the sword square to the fist) and the legs by their ankles, so the feet stay planted.
//   anticipation (0–0.19) — the sword rises upright in front of the face, clear of it (0.07); then the elbow lifts, the
//                fist stays beside the head and the blade tips back over it, drawn behind the head (0.15–0.19). The
//                body leans back and sinks, the near fist comes up in guard.
//   strike (0.19–0.26) — over the top: the blade swings up past the head (drawn in front again from 0.23, once clear of
//                it) and chops forward-down. The front foot steps in.
//   impact (0.26–0.33) — lunge: arm and blade forward-down, the near arm thrown back; held so the hit reads.
//   follow-through and recovery — the blade carries on down (0.42), then rises back into the combat stance.
// The blade only changes drawing depth while it is clear of the head, so nothing pops or passes through.
export const ATTACK_B: AnimDef = {
  ...ATTACK,
  bones: {
    hip: { x: at([[0, S.dx], [0.07, S.dx - 0.008], [0.15, S.dx - 0.022], [0.19, S.dx - 0.024], [0.23, S.dx + 0.01], [0.26, S.dx + 0.045], [0.33, S.dx + 0.042], [0.42, S.dx + 0.035], [0.52, S.dx + 0.015], [0.65, S.dx]]), y: at([[0, S.dy], [0.07, S.dy + 0.004], [0.15, S.dy + 0.018], [0.19, S.dy + 0.02], [0.23, S.dy + 0.022], [0.26, S.dy + 0.035], [0.33, S.dy + 0.032], [0.42, S.dy + 0.026], [0.52, S.dy + 0.01], [0.65, S.dy]]), r: hold(S.hip) },
    chest: { r: at([[0, S.chest], [0.07, -3], [0.15, -6], [0.19, -7], [0.23, 2, 'in'], [0.26, 18, 'out'], [0.33, 16], [0.42, 13], [0.52, 7], [0.65, S.chest]]) },
    head: { r: at([[0, S.head], [0.07, -2], [0.15, -6], [0.19, -6], [0.26, 7], [0.33, 6], [0.45, 4], [0.65, S.head]]) },
    uparm_F: { r: at([[0, S.uparm_F], [0.07, -95.11], [0.15, -104.11], [0.19, -109.11], [0.23, -105.11, 'in'], [0.26, -80.11, 'out'], [0.33, -74.11], [0.42, -43.11], [0.52, -3.11], [0.65, S.uparm_F]]) },
    forearm_F: { r: at([[0, S.forearm_F], [0.07, -35], [0.15, -66], [0.19, -67], [0.23, -40, 'in'], [0.26, 0, 'out'], [0.33, 0], [0.42, -2], [0.52, -67], [0.65, S.forearm_F]]) },
    hand_F: { r: at([[0, S.hand_F], [0.07, 35], [0.15, 30], [0.19, 28], [0.23, 40, 'in'], [0.26, 60, 'out'], [0.33, 60], [0.42, 58], [0.52, 40], [0.65, S.hand_F]]) },
    weapon: { r: at([[0, S.weapon], [0.07, 0], [0.15, 0], [0.19, 0], [0.23, 0, 'in'], [0.26, 14, 'out'], [0.33, 14], [0.42, 10], [0.52, 0], [0.65, S.weapon]]) },
    uparm_B: { r: at([[0, S.uparm_B], [0.07, -10], [0.15, -40], [0.19, -42], [0.23, -10], [0.26, 38], [0.33, 35], [0.45, 25], [0.65, S.uparm_B]]) },
    forearm_B: { r: at([[0, S.forearm_B], [0.15, -45], [0.19, -45], [0.26, -15], [0.33, -18], [0.65, S.forearm_B]]) },
    hand_B: { r: hold(S.hand_B) },
    thigh_F: { r: at([[0, S.thigh_F], [0.15, -30.77], [0.19, -32.25], [0.23, -50.51], [0.26, -42.14], [0.42, -36.14], [0.55, -37.68], [0.65, S.thigh_F]]) },
    shin_F: { r: at([[0, S.shin_F], [0.15, 34.85], [0.19, 36.69], [0.23, 62.07], [0.26, 46.68], [0.42, 32.77], [0.55, 46.02], [0.65, S.shin_F]]) },
    foot_F: { r: at([[0, S.foot_F], [0.15, -2.19], [0.19, -2.56], [0.23, -1.67], [0.26, -2.66], [0.42, 5.26], [0.55, -1.44], [0.65, S.foot_F]]) },
    thigh_B: { r: at([[0, S.thigh_B], [0.15, -8.05], [0.19, -9.61], [0.26, 9.49], [0.42, 8.59], [0.65, S.thigh_B]]) },
    shin_B: { r: at([[0, S.shin_B], [0.15, 47.08], [0.19, 49.45], [0.26, 42.65], [0.42, 39.1], [0.65, S.shin_B]]) },
    foot_B: { r: at([[0, S.foot_B], [0.15, -37.15], [0.19, -37.95], [0.26, -58.25], [0.42, -53.8], [0.65, S.foot_B]]) },
  },
  // the blade behind the head while it is tipped back over it; the fist and forearm stay in front, beside the head
  order: [{ t: 0.07, move: 'group:gripF', before: 'group:head' }, { t: 0.23, move: 'group:gripF', before: null }],
};

export const ANIMS_B: Record<string, AnimDef> = { idle: IDLE_B, run: RUN_B, jump: JUMP_B, attack: ATTACK_B };
