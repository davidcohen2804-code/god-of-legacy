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
const JUMP = build('jump', 0.95, false, [
  { t: 0, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
  { t: 0.07, e: 'in', hip: [0, 0.07], chest: 20, head: -9, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [94, 48, grip('B', -28)], F: [108, 86, 90] } },
  { t: 0.12, e: 'out', hip: [0.012, -0.035], chest: 4, head: -1, legs: { B: fromHip(-0.04, 0.312, 44), F: fromHip(0.012, 0.306, 34) }, arms: { B: [26, -32, grip('B', -62)], F: [-28, -58, -52] } },
  { t: 0.28, hip: [0.01, -0.005], chest: 7, head: -3, legs: { B: fromHip(-0.08, 0.27, 34), F: fromHip(0.1, 0.15, 6) }, arms: { B: [40, -14, grip('B', -55)], F: [-8, -35, -30] } },
  { t: 0.42, hip: [0.01, -0.005], chest: 6, head: -3, legs: { B: fromHip(-0.07, 0.28, 30), F: fromHip(0.11, 0.16, 4) }, arms: { B: [46, -6, grip('B', -52)], F: [8, -22, -16] } },
  { t: 0.6, e: 'in', hip: [0.005, -0.012], chest: 5, head: -3, legs: { B: fromHip(-0.045, 0.3, 12), F: fromHip(0.05, 0.302, 2) }, arms: { B: [58, 6, grip('B', -46)], F: [42, 14, 22] } },
  { t: 0.7, e: 'out', hip: [0, 0.012], chest: 10, head: -4, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [66, 14, grip('B', -44)], F: [72, 42, 48] } },
  { t: 0.79, e: 'out', hip: [0, 0.085], chest: 22, head: -10, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: { B: [88, 40, grip('B', -30)], F: [106, 86, 90] } },
  { t: 0.95, hip: [-0.008, 0.012], chest: 3, head: -2, legs: { B: on(STANCE.B), F: on(STANCE.F) }, arms: GUARD },
], { swaps: ARMED, marks: { takeoff: 0, air: 0.12, land: 0.7, end: 0.95 } });

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
// arm reaching up, the near one staying below the chin (in this view it passes in front of the face); they settle
// for the landing. From and back to the unarmed stand.
const STAND_BARE: Pose = { t: 0, hip: [-0.006, 0.008], chest: 1, head: -1, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [102, 99, 99], F: [80, 84, 86] } };
const JUMP_BARE = build('jump_bare', 0.95, false, [
  STAND_BARE,
  { t: 0.07, e: 'in', hip: [0, 0.07], chest: 20, head: -9, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [118, 100, 104], F: [112, 92, 96] } },
  { t: 0.12, e: 'out', hip: [0.012, -0.035], chest: 4, head: -1, legs: { B: fromHip(-0.04, 0.312, 44), F: fromHip(0.012, 0.306, 34) }, arms: { B: [40, 0, 6], F: [-28, -58, -52] } },
  { t: 0.28, hip: [0.01, -0.005], chest: 7, head: -3, legs: { B: fromHip(-0.08, 0.27, 34), F: fromHip(0.1, 0.15, 6) }, arms: { B: [52, 14, 20], F: [-8, -35, -30] } },
  { t: 0.42, hip: [0.01, -0.005], chest: 6, head: -3, legs: { B: fromHip(-0.07, 0.28, 30), F: fromHip(0.11, 0.16, 4) }, arms: { B: [58, 24, 30], F: [8, -22, -16] } },
  { t: 0.6, e: 'in', hip: [0.005, -0.012], chest: 5, head: -3, legs: { B: fromHip(-0.045, 0.3, 12), F: fromHip(0.05, 0.302, 2) }, arms: { B: [66, 36, 42], F: [30, 0, 6] } },
  { t: 0.7, e: 'out', hip: [0, 0.012], chest: 10, head: -4, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [80, 56, 62], F: [62, 36, 42] } },
  { t: 0.79, e: 'out', hip: [0, 0.085], chest: 22, head: -10, legs: { B: on(-0.1), F: on(0.095) }, arms: { B: [110, 94, 98], F: [100, 80, 84] } },
  { ...STAND_BARE, t: 0.95 },
], { swaps: BARE, marks: { takeoff: 0, air: 0.12, land: 0.7, end: 0.95 } });

// The punch, the light slash's body on the same marks: a straight punch with the lead (far) fist, which in this view
// reaches clear of the body (the near arm would cross the face). The body loads (hips back, the lead fist chambered at
// the waist, the near fist up in front of the chest, below the chin), the hips start it (the front foot steps in),
// the lead arm drives straight out at shoulder height, then the body regains the stand.
const ATTACK_BARE = build('attack_bare', 0.4, false, [
  STAND_BARE,
  { t: 0.07, e: 'out', hip: [-0.028, 0.026], hipR: -6, chest: -6, head: 2, legs: { B: on(-0.1), F: on(0.095, -8, 0.006) }, arms: { B: [58, -22, -18], F: [150, 20, 24] } },
  { t: 0.105, e: 'in', hip: [0.004, 0.03], hipR: -1, chest: 4, head: -1, legs: { B: on(-0.1, 10, 0.004), F: on(0.155, -10, 0.025) }, arms: { B: [62, -16, -12], F: [60, 10, 14] } },
  { t: 0.14, e: 'linear', hip: [0.044, 0.04], hipR: 6, chest: 15, head: -6, legs: { B: on(-0.1, 20, 0.012), F: on(0.205) }, arms: { B: [66, -10, -6], F: [-4, -4, -4] } },
  { t: 0.18, e: 'out', hip: [0.05, 0.044], hipR: 7, chest: 17, head: -7, legs: { B: on(-0.1, 22, 0.014), F: on(0.205) }, arms: { B: [66, -10, -6], F: [-2, -2, -2] } },
  { t: 0.25, hip: [0.046, 0.042], hipR: 6, chest: 15, head: -6, legs: { B: on(-0.1, 20, 0.012), F: on(0.205) }, arms: { B: [80, 20, 26], F: [30, 20, 24] } },
  { ...STAND_BARE, t: 0.4 },
], { swaps: FISTS, marks: { startup: 0, active: 0.14, recovery: 0.25, end: 0.4 } });

export const ANIMS_B01: Record<string, AnimDef> = {
  idle: IDLE, idle_bare: IDLE_BARE, run: RUN, run_bare: RUN_BARE, jump: JUMP, jump_bare: JUMP_BARE,
  attack: ATTACK, attack_bare: ATTACK_BARE, attack_heavy: ATTACK_HEAVY,
};
/** The set the game plays with no weapon in hand: every state's unarmed animation (the heavy slash becomes the punch). */
export const ANIMS_B01_BARE: Record<string, AnimDef> = { ...ANIMS_B01, idle: IDLE_BARE, run: RUN_BARE, jump: JUMP_BARE, attack: ATTACK_BARE, attack_heavy: ATTACK_BARE };
/** The animation a state plays with or without a weapon in hand. */
export const animFor = (name: string, unarmed: boolean): AnimDef | undefined => (unarmed ? ANIMS_B01_BARE : ANIMS_B01)[name];
