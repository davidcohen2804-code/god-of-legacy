// BASE-01's animations, authored for this body (the art director's motion review, 2 Nov 2026): key poses with real
// weight. Each key is a pose in the world: where the pelvis sits, how the chest and head lean, where each ankle is
// (the leg bends to reach it: two-bone IK, knee forward, so planted feet stay planted) and the foot's angle, and the
// arms' world angles (90 = straight down, 0 = forward). A held weapon is a rigid part of the fist: no animation turns
// it about the hand; the wrist turns the hand and the weapon together. Items never have animations of their own.
import { k } from '../rig/anims';
import type { AnimDef, BoneTimeline, Ease, Key } from '../rig/types';
import data from './assets/base01.json';
import { GRIP_AXIS } from './rig';

const R = data.rig;
const W = R.world as unknown as Record<string, number>;
const O = R.offsets as unknown as Record<string, [number, number]>;
const LEN = R.lengths as unknown as Record<string, number>;
const RAD = Math.PI / 180;
type Side = 'B' | 'F';

/** Ankle target: [x, y] in the root frame (B units, y down, the ground at 0) and the foot's world angle. */
type Foot = [number, number, number];
/** Arm: upper arm, forearm, hand world angles. */
type Arm = [number, number, number];
interface Pose {
  t: number; e?: Ease;
  hip?: [number, number]; hipR?: number; chest?: number; head?: number;
  legs: Record<Side, Foot | ((hx: number, hy: number) => Foot)>;
  arms: Record<Side, Arm>;
}

const rot = (x: number, y: number, deg: number): [number, number] => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [x * c - y * s, x * s + y * c]; };
/** Where each hip joint is for a pelvis offset and rotation. */
function hipJoint(s: Side, hip: [number, number], hr: number): [number, number] {
  const [ox, oy] = rot(O[`thigh_${s}`][0], O[`thigh_${s}`][1], hr);
  return [O.hip[0] + hip[0] + ox, O.hip[1] + hip[1] + oy];
}
/** Two-bone IK, the knee bending forward: thigh and shin world angles that put the ankle on (ax, ay). */
function ik(s: Side, hx: number, hy: number, ax: number, ay: number): [number, number] {
  const L1 = LEN[`thigh_${s}`], L2 = LEN[`shin_${s}`];
  let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
  const dmax = (L1 + L2) * 0.9995;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const phi = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const t1 = phi - a;
  const kx = hx + L1 * Math.cos(t1), ky = hy + L1 * Math.sin(t1);
  return [t1 / RAD, Math.atan2(hy + dy - ky, hx + dx - kx) / RAD];
}
/** The ankle's rest place (on the ground, foot flat). */
const ANKLE0: Record<Side, [number, number]> = (['B', 'F'] as Side[]).reduce((m, s) => {
  const [hx, hy] = hipJoint(s, [0, 0], 0);
  const kx = hx + LEN[`thigh_${s}`] * Math.cos(W[`thigh_${s}`] * RAD), ky = hy + LEN[`thigh_${s}`] * Math.sin(W[`thigh_${s}`] * RAD);
  m[s] = [kx + LEN[`shin_${s}`] * Math.cos(W[`shin_${s}`] * RAD), ky + LEN[`shin_${s}`] * Math.sin(W[`shin_${s}`] * RAD)];
  return m;
}, {} as Record<Side, [number, number]>);
const GROUND = ANKLE0.B[1];
/** A foot on the ground at x (flat unless an angle is given). */
const on = (x: number, a = 0, lift = 0): Foot => [x, GROUND - lift, a];
/** A foot placed from its own hip joint (airborne legs). */
const fromHip = (dx: number, dy: number, a: number) => (hx: number, hy: number): Foot => [hx + dx, hy + dy, a];

function build(name: string, dur: number, loop: boolean, poses: Pose[], extra: Partial<AnimDef> = {}): AnimDef {
  const ch: Record<string, { r: Key[]; x?: Key[]; y?: Key[] }> = {};
  const put = (bone: string, t: number, v: number, e: Ease, axis: 'r' | 'x' | 'y' = 'r') => {
    const b = (ch[bone] ??= { r: [] });
    (b[axis] ??= []).push(k(t, v, e));
  };
  for (const p of poses) {
    const e = p.e ?? 'inout', hip = p.hip ?? [0, 0], hr = p.hipR ?? 0, chest = p.chest ?? 0;
    put('hip', p.t, hip[0], e, 'x'); put('hip', p.t, hip[1], e, 'y'); put('hip', p.t, hr, e);
    put('chest', p.t, chest, e); put('head', p.t, p.head ?? 0, e);
    for (const s of ['B', 'F'] as Side[]) {
      const [hx, hy] = hipJoint(s, hip, hr);
      const leg = p.legs[s], [ax, ay, fa] = typeof leg === 'function' ? leg(hx, hy) : leg;
      const [t1, t2] = ik(s, hx, hy, ax, ay);
      put(`thigh_${s}`, p.t, t1 - hr - W[`thigh_${s}`], e);
      put(`shin_${s}`, p.t, (t2 - t1) - (W[`shin_${s}`] - W[`thigh_${s}`]), e);
      put(`foot_${s}`, p.t, fa - t2 + W[`shin_${s}`], e);
      const [u, f, h] = p.arms[s];
      put(`uparm_${s}`, p.t, u - (hr + chest) - W[`uparm_${s}`], e);
      put(`forearm_${s}`, p.t, (f - u) - (W[`forearm_${s}`] - W[`uparm_${s}`]), e);
      put(`hand_${s}`, p.t, h - f, e);
    }
  }
  // every joint turns the short way between keys
  for (const b of Object.values(ch)) for (const keys of [b.r, b.x, b.y]) {
    if (!keys) continue;
    keys.sort((a, c) => a.t - c.t);
    if (keys === b.r) for (let i = 1; i < keys.length; i++) keys[i].v -= 360 * Math.round((keys[i].v - keys[i - 1].v) / 360);
  }
  return { name, dur, loop, bones: ch as Record<string, BoneTimeline>, ...extra };
}

/** The hand angle that points a held weapon's blade along `blade` (the fist's handle is fixed in the hand). */
const grip = (s: Side, blade: number) => blade + GRIP_AXIS[s];
const ARMED = { handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'grip' }] };
const BARE = { handB: [{ t: 0, v: 'open' }], handF: [{ t: 0, v: 'open' }] };

// The armed stance: the near (sword) hand in front of the belly, the blade up-forward; the free fist by the hip; the
// feet a little wider than the rest pose, the weight a little back.
const GUARD: Record<Side, Arm> = { B: [72, 18, grip('B', -42)], F: [88, 66, 74] };
const STANCE = { B: -0.11, F: 0.105 };

const IDLE = build('idle', 2.4, true, [
  { t: 0, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
  { t: 1.2, hip: [-0.011, 0.017], chest: 4.6, head: -2.8, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [74, 21, grip('B', -40)], F: [90, 69, 76] } },
  { t: 2.4, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
], { swaps: ARMED });

const IDLE_BARE = build('idle_bare', 2.6, true, [
  { t: 0, hip: [-0.006, 0.008], chest: 1, head: -1, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [102, 99, 99], F: [80, 84, 86] } },
  { t: 1.3, hip: [-0.009, 0.013], chest: 2.6, head: -1.8, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [104, 101, 101], F: [82, 86, 88] } },
  { t: 2.6, hip: [-0.006, 0.008], chest: 1, head: -1, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [102, 99, 99], F: [80, 84, 86] } },
], { swaps: BARE });

// The run: contact (the front foot lands, heel first), compression (the body drops over the planted foot), push-off
// (the back leg extends, on its toes), flight (both feet off the ground); then the same with the other leg. 0.5 s a
// cycle; the planted foot travels back at the run's speed (no sliding).
const RD = 0.5, Q = RD / 8;
const hxB = hipJoint('B', [0, 0], 0)[0], hxF = hipJoint('F', [0, 0], 0)[0];
type Phase = 'contact' | 'down' | 'push' | 'flight' | 'contact2' | 'down2' | 'push2' | 'flight2';
function runLeg(s: Side, ph: Phase): (hx: number, hy: number) => Foot {
  const lead = s === 'F' ? ['contact', 'down', 'push', 'flight'] : ['contact2', 'down2', 'push2', 'flight2'];
  const i = lead.indexOf(ph);
  const PLANT: Foot[] = [[0.17, GROUND + 0.004, -14], [0.03, GROUND, 0], [-0.14, GROUND - 0.022, 38], [-0.21, GROUND - 0.11, 58]];
  const SWING: Foot[] = [[-0.2, GROUND - 0.12, 50], [-0.05, GROUND - 0.19, 32], [0.12, GROUND - 0.14, -4], [0.19, GROUND - 0.06, -16]];
  const f = i >= 0 ? PLANT[i] : SWING[(['contact', 'down', 'push', 'flight', 'contact2', 'down2', 'push2', 'flight2'].indexOf(ph) + 4) % 4];
  const hx0 = s === 'B' ? hxB : hxF;
  return (hx: number) => [hx0 + (hx - hx0) + f[0], f[1], f[2]];
}
// the sword carried low at the side, blade forward-down (an armed run, not the guard); the free fist pumps against
// the far leg; the pelvis tips into the stride with the chest leaning further, more in compression
const RUN_BODY: Record<string, { y: number; hipR: number; chest: number; head: number; armB: Arm; armF: Arm }> = {
  contact: { y: 0.016, hipR: 4, chest: 11, head: -9, armB: [76, 92, grip('B', 34)], armF: [112, 70, 74] },
  down: { y: 0.038, hipR: 5, chest: 13, head: -10, armB: [78, 95, grip('B', 37)], armF: [100, 52, 58] },
  push: { y: 0.01, hipR: 5, chest: 12, head: -9, armB: [82, 98, grip('B', 40)], armF: [66, 12, 18] },
  flight: { y: -0.026, hipR: 4, chest: 10, head: -8, armB: [84, 100, grip('B', 42)], armF: [42, -14, -8] },
  contact2: { y: 0.016, hipR: 4, chest: 11, head: -9, armB: [84, 100, grip('B', 42)], armF: [38, -18, -12] },
  down2: { y: 0.038, hipR: 5, chest: 13, head: -10, armB: [82, 98, grip('B', 40)], armF: [58, 6, 12] },
  push2: { y: 0.01, hipR: 5, chest: 12, head: -9, armB: [78, 95, grip('B', 37)], armF: [96, 46, 52] },
  flight2: { y: -0.026, hipR: 4, chest: 10, head: -8, armB: [76, 92, grip('B', 34)], armF: [108, 64, 68] },
};
const RUN_ORDER: Phase[] = ['contact', 'down', 'push', 'flight', 'contact2', 'down2', 'push2', 'flight2'];
const RUN = build('run', RD, true, [...RUN_ORDER, 'contact' as Phase].map((ph, i) => {
  const b = RUN_BODY[ph];
  return { t: i * Q, e: 'linear' as Ease, hip: [0, b.y] as [number, number], hipR: b.hipR, chest: b.chest, head: b.head, legs: { B: runLeg('B', ph), F: runLeg('F', ph) }, arms: { B: b.armB, F: b.armF } };
}), { swaps: ARMED, order: [] });

// The jump: anticipation (a quick crouch), takeoff (full extension, toes pointing), rising (knees tucked), the top,
// falling (the legs reach for the ground), landing (compression), back to the stance. No height in it: in the game the
// body's vertical motion is physics (the marks map takeoff, air and landing onto the jump's phases); the studio adds
// the arc for viewing.
const JUMP_KEYS: Pose[] = [
  { t: 0, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
  { t: 0.07, e: 'in', hip: [0, 0.07], chest: 20, head: -9, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [94, 48, grip('B', -28)], F: [108, 86, 90] } },
  { t: 0.12, e: 'out', hip: [0.012, -0.035], chest: 4, head: -1, legs: { B: fromHip(-0.04, 0.312, 44), F: fromHip(0.012, 0.306, 34) }, arms: { B: [26, -32, grip('B', -62)], F: [-28, -58, -52] } },
  { t: 0.28, hip: [0.01, -0.005], chest: 7, head: -3, legs: { B: fromHip(-0.08, 0.27, 34), F: fromHip(0.1, 0.15, 6) }, arms: { B: [40, -14, grip('B', -55)], F: [-8, -35, -30] } },
  { t: 0.42, hip: [0.01, -0.005], chest: 6, head: -3, legs: { B: fromHip(-0.07, 0.28, 30), F: fromHip(0.11, 0.16, 4) }, arms: { B: [46, -6, grip('B', -52)], F: [8, -22, -16] } },
  { t: 0.6, e: 'in', hip: [0.005, -0.012], chest: 5, head: -3, legs: { B: fromHip(-0.045, 0.3, 12), F: fromHip(0.05, 0.302, 2) }, arms: { B: [58, 6, grip('B', -46)], F: [42, 14, 22] } },
  { t: 0.7, e: 'out', hip: [0, 0.012], chest: 10, head: -4, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [66, 14, grip('B', -44)], F: [72, 42, 48] } },
  { t: 0.79, e: 'out', hip: [0, 0.085], chest: 22, head: -10, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [88, 40, grip('B', -30)], F: [106, 86, 90] } },
  { t: 0.95, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
];
const JUMP_MARKS = { takeoff: 0, air: 0.12, land: 0.7, end: 0.95 };
const JUMP = build('jump', 0.95, false, JUMP_KEYS, { swaps: ARMED, marks: JUMP_MARKS });

// The sword attack, an overhead diagonal slash on the game's timings (the hit at 0.20 s): wind-up (weight back, the
// sword drawn up behind the head), the swing (the hips turn and lunge, the front foot steps in, the chest follows,
// the arm comes over the top), the impact (blade level, arm extended), follow-through (blade forward-down), recovery.
const ATTACK_HEAVY = build('attack_heavy', 0.65, false, [
  { t: 0, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
  { t: 0.1, hip: [-0.032, 0.022], hipR: -4, chest: -10, head: 4, legs: { B: on(STANCE.B), F: on(STANCE.F, -6, 0.004) }, arms: { B: [-100, -125, grip('B', 169)], F: [12, -8, 0] } },
  { t: 0.16, e: 'in', hip: [-0.012, 0.024], hipR: -2, chest: -4, head: 2, legs: { B: on(STANCE.B), F: on(STANCE.F + 0.04, -8, 0.02) }, arms: { B: [-95, -80, grip('B', -150)], F: [32, 2, 8] } },
  { t: 0.2, e: 'out', hip: [0.05, 0.036], hipR: 4, chest: 14, head: -6, legs: { B: on(STANCE.B, 18, 0.01), F: on(0.21) }, arms: { B: [14, 40, grip('B', -13)], F: [100, 78, 82] } },
  { t: 0.3, hip: [0.056, 0.042], hipR: 5, chest: 18, head: -7, legs: { B: on(STANCE.B, 22, 0.012), F: on(0.21) }, arms: { B: [55, 85, grip('B', 27)], F: [98, 76, 80] } },
  { t: 0.45, hip: [0.05, 0.036], hipR: 4, chest: 15, head: -6, legs: { B: on(STANCE.B, 18, 0.01), F: on(0.21) }, arms: { B: [60, 88, grip('B', 29)], F: [94, 72, 76] } },
  { t: 0.65, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
], { swaps: ARMED, marks: { startup: 0, active: 0.2, recovery: 0.45, end: 0.65 }, order: [{ t: 0.012, move: 'group:armB', before: 'group:head' }, { t: 0.185, move: 'group:armB', before: null }] });


// The light slash, the Warrior's foundation (the art director's choreography): the body loads (hips back, the sword
// cocked over the rear shoulder, the free fist up in guard), the hips start the cut (the front foot steps in), the
// shoulder whips the arm through, the blade crosses the target level at impact, momentum carries it forward-down while
// the free fist chambers at the hip, then the body regains the guard. 0.4 s; the marks fit the game's own timings.
const ATTACK = build('attack', 0.4, false, [
  { t: 0, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
  { t: 0.07, e: 'out', hip: [-0.028, 0.026], hipR: -6, chest: -9, head: 3, legs: { B: on(STANCE.B), F: on(STANCE.F, -8, 0.006) }, arms: { B: [-112, -140, grip('B', 162)], F: [38, -42, -34] } },
  { t: 0.105, e: 'in', hip: [0.004, 0.03], hipR: -1, chest: 2, head: 0, legs: { B: on(STANCE.B, 10, 0.004), F: on(STANCE.F + 0.06, -10, 0.025) }, arms: { B: [-70, -45, grip('B', -110)], F: [60, -10, -6] } },
  { t: 0.14, e: 'linear', hip: [0.044, 0.04], hipR: 6, chest: 15, head: -6, legs: { B: on(STANCE.B, 20, 0.012), F: on(0.205) }, arms: { B: [24, 50, grip('B', -3)], F: [100, 150, 150] } },
  { t: 0.18, e: 'out', hip: [0.05, 0.044], hipR: 7, chest: 17, head: -7, legs: { B: on(STANCE.B, 22, 0.014), F: on(0.205) }, arms: { B: [40, 70, grip('B', 17)], F: [104, 152, 152] } },
  { t: 0.25, hip: [0.046, 0.042], hipR: 6, chest: 15, head: -6, legs: { B: on(STANCE.B, 20, 0.012), F: on(0.205) }, arms: { B: [62, 95, grip('B', 37)], F: [102, 148, 148] } },
  { t: 0.4, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
], { swaps: ARMED, marks: { startup: 0, active: 0.14, recovery: 0.25, end: 0.4 }, order: [{ t: 0.01, move: 'group:armB', before: 'group:head' }, { t: 0.125, move: 'group:armB', before: null }] });

// ---------- No weapon in hand: the same body motion, the arms free ----------
// The run: both fists pump against the legs (the near arm half a cycle from the far one).
const FISTS = { handB: [{ t: 0, v: 'grip' }], handF: [{ t: 0, v: 'grip' }] };
const RUN_BARE = build('run_bare', RD, true, [...RUN_ORDER, 'contact' as Phase].map((ph, i) => {
  const b = RUN_BODY[ph], opp = RUN_BODY[RUN_ORDER[(RUN_ORDER.indexOf(ph) + 4) % 8]];
  return { t: i * Q, e: 'linear' as Ease, hip: [0, b.y] as [number, number], hipR: b.hipR, chest: b.chest, head: b.head, legs: { B: runLeg('B', ph), F: runLeg('F', ph) }, arms: { B: opp.armF, F: b.armF } };
}), { swaps: FISTS, order: [] });

// The jump: the jump's own legs and body; both arms swing back in the crouch and forward with the takeoff, the far
// arm reaching up; the near one stays low, its fist forward and below the chin with a clear gap to the face (in this
// view the near arm passes in front of the face, the identity anchor at gameplay size). From and back to the stand.
const STAND_BARE: Pose = { t: 0, hip: [-0.006, 0.008], chest: 1, head: -1, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [102, 99, 99], F: [80, 84, 86] } };
const JUMP_BARE = build('jump_bare', 0.95, false, [
  STAND_BARE,
  { t: 0.07, e: 'in', hip: [0, 0.07], chest: 20, head: -9, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [118, 100, 104], F: [112, 92, 96] } },
  { t: 0.12, e: 'out', hip: [0.012, -0.035], chest: 4, head: -1, legs: { B: fromHip(-0.04, 0.312, 44), F: fromHip(0.012, 0.306, 34) }, arms: { B: [56, 18, 24], F: [-28, -58, -52] } },
  { t: 0.28, hip: [0.01, -0.005], chest: 7, head: -3, legs: { B: fromHip(-0.08, 0.27, 34), F: fromHip(0.1, 0.15, 6) }, arms: { B: [62, 26, 32], F: [-8, -35, -30] } },
  { t: 0.42, hip: [0.01, -0.005], chest: 6, head: -3, legs: { B: fromHip(-0.07, 0.28, 30), F: fromHip(0.11, 0.16, 4) }, arms: { B: [66, 32, 38], F: [8, -22, -16] } },
  { t: 0.6, e: 'in', hip: [0.005, -0.012], chest: 5, head: -3, legs: { B: fromHip(-0.045, 0.3, 12), F: fromHip(0.05, 0.302, 2) }, arms: { B: [72, 42, 48], F: [30, 0, 6] } },
  { t: 0.7, e: 'out', hip: [0, 0.012], chest: 10, head: -4, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [82, 58, 64], F: [62, 36, 42] } },
  { t: 0.79, e: 'out', hip: [0, 0.085], chest: 22, head: -10, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [110, 94, 98], F: [100, 80, 84] } },
  { ...STAND_BARE, t: 0.95 },
], { swaps: BARE, marks: { takeoff: 0, air: 0.12, land: 0.7, end: 0.95 } });

// The punch, on the light slash's marks: a straight punch with the lead (far) fist, which in this view reaches clear of
// the body (the near arm would cross the face). Three poses (the art director's): guard and load (to 0.06: both fists
// come up, the near one in front of the chest, the lead shoulder draws back a little), extension and impact (0.06 to
// 0.16: the lead fist drives straight out at upper-chest height, the shoulder follows, the hips turn and the front
// foot takes the weight), return (to 0.3: the fist comes straight back into the guard; the front foot steps back to
// the stand by 0.4). No big wind-up: faster and more direct than the slash.
const GUARD_BARE: Record<Side, Arm> = { B: [58, -22, -18], F: [100, -60, -56] };
const ATTACK_BARE = build('attack_bare', 0.4, false, [
  STAND_BARE,
  { t: 0.06, e: 'out', hip: [-0.02, 0.02], hipR: -4, chest: -4, head: 1, legs: { B: on(-0.1), F: on(0.095, -6, 0.004) }, arms: GUARD_BARE },
  { t: 0.12, e: 'out', hip: [0.044, 0.04], hipR: 6, chest: 14, head: -5, legs: { B: on(-0.1, 20, 0.012), F: on(0.205) }, arms: { B: [64, -14, -10], F: [6, 4, 4] } },
  { t: 0.16, hip: [0.048, 0.042], hipR: 7, chest: 15, head: -6, legs: { B: on(-0.1, 22, 0.014), F: on(0.205) }, arms: { B: [64, -14, -10], F: [8, 6, 6] } },
  { t: 0.3, e: 'inout', hip: [0.012, 0.024], hipR: 1, chest: 4, head: -2, legs: { B: on(-0.1, 6, 0.004), F: on(0.135, -6, 0.014) }, arms: GUARD_BARE },
  // the front foot is back where the stand has it (a cross-fade into the stand never slides a planted foot)
  { t: 0.4, hip: [-0.004, 0.012], chest: 2, head: -1, legs: { B: on(-0.1), F: on(0.095) }, arms: GUARD_BARE },
], { swaps: FISTS, marks: { startup: 0, active: 0.14, recovery: 0.25, end: 0.4 } });

// ---------- Weapon motion kits (the art director's dagger_1h and staff_2h) ----------
// The weapon's catalog row names its kit; the skeleton, the grip socket and the 0.4 s attack marks are the sword's.
// A held weapon stays a rigid child of the near fist. The staff's far hand holds the shaft at a second grip 0.167 B up
// from the near hand: every key is solved onto it, and the evaluator keeps it there in every frame and every cross-fade
// (AnimDef.hold), the far fist drawn over the shaft. The fists are hammer grips (the handle across the fist), so a
// wrist stays within the bend the sword kit uses: the blade or shaft level means the forearm angled down to it.
const HAND_LEN: Record<Side, number> = { B: R.hand_len as number, F: (R as unknown as { hand_len_F: number }).hand_len_F };
/** A shoulder joint in the root frame for a pelvis offset, pelvis turn and chest lean. */
function shoulderAt(s: Side, hip: [number, number], hr: number, chest: number): [number, number] {
  const [cx, cy] = rot(O.chest[0], O.chest[1], hr);
  const [sx, sy] = rot(O[`uparm_${s}`][0], O[`uparm_${s}`][1], hr + chest);
  return [O.hip[0] + hip[0] + cx + sx, O.hip[1] + hip[1] + cy + sy];
}
/** Two-bone IK for an arm, the elbow below the shoulder-wrist line: the angles that put its fist (holding along
 *  `blade`) on `target`. A target out of reach leaves the arm straight toward it (R9 measures it). */
function armTo(s: Side, hip: [number, number], hr: number, chest: number, target: [number, number], blade: number): Arm {
  const h = grip(s, blade) * RAD;
  const wx = target[0] - HAND_LEN[s] * Math.cos(h), wy = target[1] - HAND_LEN[s] * Math.sin(h);
  const [sx, sy] = shoulderAt(s, hip, hr, chest);
  const L1 = LEN[`uparm_${s}`], L2 = LEN[`forearm_${s}`];
  let dx = wx - sx, dy = wy - sy, d = Math.hypot(dx, dy);
  const dmax = (L1 + L2) * 0.999;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const phi = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const u = phi + a, ex = sx + L1 * Math.cos(u), ey = sy + L1 * Math.sin(u);
  return [u / RAD, Math.atan2(sy + dy - ey, sx + dx - ex) / RAD, h / RAD];
}
/** The staff's second grip: this far up the shaft from the near hand (B units; the art director's 35% and 55% of the
 *  staff's length from its foot). */
export const STAFF_SPAN = 0.167;
type StaffKey = Omit<Pose, 'arms'> & { grip: [number, number]; blade: number };
/** A staff key: where the near fist holds (from the pelvis) and the staff's angle; both arms solved onto the shaft. */
function staffKey(k: StaffKey): Pose {
  const hip = k.hip ?? [0, 0], hr = k.hipR ?? 0, chest = k.chest ?? 0;
  const near: [number, number] = [O.hip[0] + hip[0] + k.grip[0], O.hip[1] + hip[1] + k.grip[1]];
  const far: [number, number] = [near[0] + STAFF_SPAN * Math.cos(k.blade * RAD), near[1] + STAFF_SPAN * Math.sin(k.blade * RAD)];
  return { t: k.t, e: k.e, hip: k.hip, hipR: k.hipR, chest: k.chest, head: k.head, legs: k.legs, arms: { B: armTo('B', hip, hr, chest, near, k.blade), F: armTo('F', hip, hr, chest, far, k.blade) } };
}
/** The staff's second hand: on the shaft in every frame, the far fist drawn over it. */
const STAFF_HOLD = { hold: { arm: ['uparm_F', 'forearm_F', 'hand_F'] as [string, string, string], grip: 'offhand', weapon: 'weapon', at: STAFF_SPAN }, order: [{ t: 0, move: 'hand_F.skin', before: 'hand_B.skin' }] };

// The dagger: a tight forward guard (the blade forward and a little up, the elbow by the ribs, the hand just ahead of
// the near hip, the far fist by the chest, the weight a little back); a low compact carry in the run; the attack is a
// straight piercing thrust (coil, explosive drive with a short step, impact with the arm most of the way out and the
// blade level, a straight withdrawal along the same line, recovery). Never overhead, never behind the head. The fist is
// a hammer grip, so the level blade comes from a forearm angled down to it: a stab at the belt, the wrist natural.
const D_STANCE = { B: -0.115, F: 0.11 };
const D_GUARD: Pose = { t: 0, hip: [-0.012, 0.015], chest: 4, head: -2, legs: { B: on(D_STANCE.B), F: on(D_STANCE.F) }, arms: { B: [86, 14, grip('B', -19)], F: [60, -60, -56] } };
const IDLE_DAGGER = build('idle_dagger', 2.4, true, [
  D_GUARD,
  { ...D_GUARD, t: 1.2, hip: [-0.013, 0.018], chest: 5, arms: { B: [88, 16, grip('B', -17)], F: [62, -58, -54] } },
  { ...D_GUARD, t: 2.4 },
], { swaps: ARMED });
const RUN_DAGGER = build('run_dagger', RD, true, [...RUN_ORDER, 'contact' as Phase].map((ph, i) => {
  const b = RUN_BODY[ph], f = b.armF, k = 0.35;   // the far fist pumps, restrained, about its guard by the chest
  const F: Arm = [62 + (f[0] - 70) * k, -30 + (f[1] - 10) * k, -26 + (f[2] - 14) * k];
  return { t: i * Q, e: 'linear' as Ease, hip: [0, b.y] as [number, number], hipR: b.hipR, chest: b.chest, head: b.head, legs: { B: runLeg('B', ph), F: runLeg('F', ph) }, arms: { B: [96 + (i % 2) * 2, 56, grip('B', 22)], F } };
}), { swaps: ARMED, order: [] });
const ATTACK_DAGGER = build('attack_dagger', 0.4, false, [
  D_GUARD,
  { t: 0.07, e: 'out', hip: [-0.03, 0.032], hipR: -10, chest: -6, head: 2, legs: { B: on(D_STANCE.B), F: on(D_STANCE.F, -6, 0.004) }, arms: { B: [112, 40, grip('B', -6)], F: [50, -70, -66] } },
  { t: 0.105, e: 'in', hip: [0.01, 0.036], hipR: -2, chest: 6, head: -1, legs: { B: on(D_STANCE.B, 12, 0.006), F: on(0.19, -10, 0.03) }, arms: { B: [74, 36, grip('B', -2)], F: [55, -65, -60] } },
  { t: 0.14, e: 'linear', hip: [0.065, 0.045], hipR: 7, chest: 18, head: -6, legs: { B: on(D_STANCE.B, 24, 0.013), F: on(0.26) }, arms: { B: [54, 30, grip('B', -2)], F: [58, -62, -58] } },
  { t: 0.18, e: 'out', hip: [0.07, 0.048], hipR: 8, chest: 19, head: -6, legs: { B: on(D_STANCE.B, 25, 0.014), F: on(0.26) }, arms: { B: [52, 31, grip('B', -1)], F: [58, -62, -58] } },
  { t: 0.25, hip: [0.05, 0.042], hipR: 5, chest: 13, head: -4, legs: { B: on(D_STANCE.B, 17, 0.009), F: on(0.26) }, arms: { B: [102, 32, grip('B', -4)], F: [60, -60, -56] } },
  { t: 0.32, hip: [0.012, 0.026], hipR: 1, chest: 6, head: -3, legs: { B: on(D_STANCE.B, 4, 0.002), F: on(0.18, -6, 0.016) }, arms: { B: [90, 18, grip('B', -14)], F: [60, -60, -56] } },
  { ...D_GUARD, t: 0.4 },
], { swaps: ARMED, marks: { startup: 0, active: 0.14, recovery: 0.25, end: 0.4 } });

// The staff: a two-handed diagonal guard (the near hand at the belt, the far hand on the shaft in front of the lower
// chest, the staff 38 degrees up toward the target, the crystal clear of the head); a controlled carry in the run (the
// staff 10 degrees forward-down: the staff is 0.84 B long and the hip only 0.39 B high, so any steeper carry puts the
// crescent over the front boot); the attack is a short two-handed forward thrust (gather, drive with a short step,
// impact with the staff level and the crystal ahead, a small recoil through the arms, back to the guard).
const S_STANCE = { B: -0.11, F: 0.105 };
const S_GUARD: StaffKey = { t: 0, hip: [-0.006, 0.012], chest: 2, head: -2, legs: { B: on(S_STANCE.B), F: on(S_STANCE.F) }, grip: [-0.028, 0.025], blade: -38 };
const IDLE_STAFF = build('idle_staff', 2.6, true, [
  staffKey(S_GUARD),
  staffKey({ ...S_GUARD, t: 1.3, hip: [-0.008, 0.017], chest: 3, grip: [-0.028, 0.027], blade: -36 }),
  staffKey({ ...S_GUARD, t: 2.6 }),
], { swaps: ARMED, ...STAFF_HOLD });
const RUN_STAFF = build('run_staff', RD, true, [...RUN_ORDER, 'contact' as Phase].map((ph, i) => {
  const b = RUN_BODY[ph];
  return staffKey({ t: i * Q, e: 'linear' as Ease, hip: [0, b.y], hipR: b.hipR, chest: b.chest, head: b.head, legs: { B: runLeg('B', ph), F: runLeg('F', ph) }, grip: [-0.06, 0.015], blade: 10 + (i % 2) * 1.5 });
}), { swaps: ARMED, ...STAFF_HOLD });
const ATTACK_STAFF = build('attack_staff', 0.4, false, [
  staffKey(S_GUARD),
  staffKey({ t: 0.07, e: 'out', hip: [-0.024, 0.026], hipR: -7, chest: -4, head: 1, legs: { B: on(S_STANCE.B), F: on(S_STANCE.F, -4, 0.003) }, grip: [-0.07, 0.03], blade: -44 }),
  staffKey({ t: 0.105, e: 'in', hip: [0.008, 0.03], hipR: 0, chest: 5, head: -2, legs: { B: on(S_STANCE.B, 10, 0.004), F: on(0.15, -8, 0.02) }, grip: [-0.01, 0], blade: -22 }),
  staffKey({ t: 0.14, e: 'linear', hip: [0.034, 0.036], hipR: 5, chest: 11, head: -4, legs: { B: on(S_STANCE.B, 16, 0.01), F: on(0.19) }, grip: [0.02, 0], blade: -8 }),
  staffKey({ t: 0.18, e: 'out', hip: [0.032, 0.036], hipR: 5, chest: 10, head: -4, legs: { B: on(S_STANCE.B, 15, 0.009), F: on(0.19) }, grip: [0.01, 0], blade: -10 }),
  staffKey({ t: 0.25, hip: [0.026, 0.034], hipR: 4, chest: 8, head: -3, legs: { B: on(S_STANCE.B, 12, 0.007), F: on(0.19) }, grip: [0, 0], blade: -15 }),
  staffKey({ t: 0.32, hip: [0.008, 0.024], hipR: 1, chest: 5, head: -2, legs: { B: on(S_STANCE.B, 4, 0.002), F: on(0.15, -4, 0.012) }, grip: [-0.02, 0.02], blade: -28 }),
  staffKey({ ...S_GUARD, t: 0.4 }),
], { swaps: ARMED, marks: { startup: 0, active: 0.14, recovery: 0.25, end: 0.4 }, ...STAFF_HOLD });

// A weapon kit's jump: the sword jump's body and legs (its own stance on the ground, its own guard at the start and
// the end, so a cross-fade from or into its idle never slides a planted foot), the kit's guard held through it: the
// weapon keeps its silhouette across the take-off and the landing.
const kitJump = (name: string, stance: Record<Side, number>, rest: { hip?: [number, number]; hipR?: number; chest?: number; head?: number }, key: (k: Pose, air: boolean) => Pose, extra: Partial<AnimDef>): AnimDef =>
  build(name, 0.95, false, JUMP_KEYS.map((k, i) => {
    const air = typeof k.legs.B === 'function', end = i === 0 || i === JUMP_KEYS.length - 1;
    const body = end ? { hip: rest.hip, hipR: rest.hipR, chest: rest.chest, head: rest.head } : {};
    return key({ ...k, ...body, legs: air ? k.legs : { B: on(stance.B), F: on(stance.F) } }, air);
  }), { marks: JUMP_MARKS, ...extra });
const JUMP_DAGGER = kitJump('jump_dagger', D_STANCE, D_GUARD, (k, air) => ({ ...k, arms: air ? { B: [80, 8, grip('B', -24)], F: [52, -68, -64] } : D_GUARD.arms }), { swaps: ARMED });
const JUMP_STAFF = kitJump('jump_staff', S_STANCE, S_GUARD, (k, air) => staffKey({ ...k, grip: air ? [-0.035, 0.0] : S_GUARD.grip, blade: air ? -42 : S_GUARD.blade }), { swaps: ARMED, ...STAFF_HOLD });

export const ANIMS_B01: Record<string, AnimDef> = {
  idle: IDLE, idle_bare: IDLE_BARE, run: RUN, run_bare: RUN_BARE, jump: JUMP, jump_bare: JUMP_BARE,
  attack: ATTACK, attack_bare: ATTACK_BARE, attack_heavy: ATTACK_HEAVY,
  idle_dagger: IDLE_DAGGER, run_dagger: RUN_DAGGER, jump_dagger: JUMP_DAGGER, attack_dagger: ATTACK_DAGGER,
  idle_staff: IDLE_STAFF, run_staff: RUN_STAFF, jump_staff: JUMP_STAFF, attack_staff: ATTACK_STAFF,
};
/** Each weapon kit's set: the sword's states with the kit's own idle, run, jump and attacks. */
export const ANIMS_B01_BY_KIT: Record<string, Record<string, AnimDef>> = {
  sword_1h: ANIMS_B01,
  dagger_1h: { ...ANIMS_B01, idle: IDLE_DAGGER, run: RUN_DAGGER, jump: JUMP_DAGGER, attack: ATTACK_DAGGER, attack_heavy: ATTACK_DAGGER },
  staff_2h: { ...ANIMS_B01, idle: IDLE_STAFF, run: RUN_STAFF, jump: JUMP_STAFF, attack: ATTACK_STAFF, attack_heavy: ATTACK_STAFF },
};
/** The set the game plays with no weapon in hand: every state's unarmed animation (the heavy slash becomes the punch). */
export const ANIMS_B01_BARE: Record<string, AnimDef> = { ...ANIMS_B01, idle: IDLE_BARE, run: RUN_BARE, jump: JUMP_BARE, attack: ATTACK_BARE, attack_heavy: ATTACK_BARE };
/** The animation a state plays with or without a weapon in hand, by the weapon's kit (sword_1h, dagger_1h, staff_2h). */
export const animFor = (name: string, unarmed: boolean, kit = 'sword_1h'): AnimDef | undefined => (unarmed ? ANIMS_B01_BARE : ANIMS_B01_BY_KIT[kit] ?? ANIMS_B01)[name];
