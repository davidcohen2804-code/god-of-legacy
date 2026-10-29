// The chibi warrior's moves: every action the game draws (the atlas's names and frame counts), as poses of the rig.
// Angles in degrees, clockwise on screen (a hanging limb's tip goes back): arm down 0, forward -90, up -180; a thigh
// forward is negative, a knee bends positive. `sw`: the sword's direction in the world (0 forward, 90 down, -90 up).
// `air`: drawn off the ground (the game lifts the body itself); otherwise the lowest heel or toe is set on the ground.

const lerp = (a, b, t) => a + (b - a) * t;

/** A frame's pose from a short spec (see the header). */
export function P(s) {
  const r = s.r ?? 0, t = s.t ?? 0;
  const aF = s.aF ?? [10, -25], aB = s.aB ?? [-8, -15];
  const lF = s.lF ?? [8, 2, 0], lB = s.lB ?? [-12, 4, 0];
  const p = {
    root: r, _x: s.x ?? 0, _yAdd: s.y ?? 0, torso: t, head: (s.h ?? 0) - t * 0.5, cape: s.cape ?? 22 + (s.capeAdd ?? 0),
    armF: aF[0], foreF: aF[1], armB: aB[0], foreB: aB[1],
    thighF: lF[0], shinF: lF[1], footF: lF[2] - (r + lF[0] + lF[1]),
    thighB: lB[0], shinB: lB[1], footB: lB[2] - (r + lB[0] + lB[1]),
  };
  // the sword hand turns at the wrist so the sword points where asked (it never turns inside the fist)
  const sw = s.sw === undefined ? 38 : s.sw;
  if (sw === null) { p._hide_sword = 1; p.handF = aF[2] ?? 0; p._piece_handF = s.handF ?? 'fist'; }
  else { p.handF = sw - (r + t + aF[0] + aF[1]); p.sword = 0; p._piece_handF = 'fist'; }
  p.handB = aB[2] ?? 0; p._piece_handB = s.handB ?? 'fist';
  if (s.st) { p._H = s.st.h ?? 480; p._ikF = s.st.f; p._ikB = s.st.b; } // (a stance by its feet: the hips' height, each ankle's x and its foot's angle — the legs solved to the ground)
  if (s.r !== undefined) p.root = s.r;
  if (s._flip) p._flip = 1;
  if (!s.hb) p._z_head = 44; // (the big head drawn over the arms — a sword arm raised or brought down across it goes behind it; `hb`: the head behind them)
  if (s.grip && sw !== null) { p._grip = s.grip === true ? [52, 102] : s.grip; p._sw = sw; } // (two hands on the hilt: the far hand behind the near one on the grip)
  if (s.hs) p._piece_head = 'head_shout';
  if (!s.air) p._clipGround = ['sword']; // (on the ground nothing of the blade shows below the floor: a blade brought down is driven into it)
  if (s.air) p._air = 1;
  return p;
}

// ---- the stances (set by the feet: `st` = the hips' height over the floor, each ankle's x and its foot's angle — the
// legs are solved to the ground, so both feet stay planted however low he sinks; ~500 stands straight, ~380 is a squat)
const ST = (h, f, b, fw = 0, bw = 0) => ({ h, f: [f, fw], b: [b, bw] });
const S = {
  stand: ST(500, -90, 110), guard: ST(468, -140, 165), back: ST(462, -175, 150, 0, 14), lunge: ST(420, -235, 250, 28, 0),
  deep: ST(392, -255, 285, 34, 0), squat: ST(382, -150, 150), wide: ST(430, -215, 225), toes: ST(528, -140, 165, 24, 22),
  kneel: ST(318, -205, 150, 72, 0),
};
const STAND = { aF: [10, -25], sw: 22, aB: [-8, -15], st: S.stand };
const GUARD = { t: 4, aF: [-8, -62], sw: -28, aB: [-20, -60], st: S.guard, capeAdd: 6, grip: true }; // (both hands on the hilt)

const idle = (i, n) => { const b = (1 - Math.cos((2 * Math.PI * i) / n)) / 2;
  return P({ ...STAND, st: ST(500 - 5 * b, -90, 110), t: -1.2 * b, h: 0.8 * b, aF: [10 + 2 * b, -25 - 3 * b], sw: 22 + 2 * b, aB: [-8 - 1.5 * b, -15 - 2 * b], capeAdd: 3 * Math.sin((2 * Math.PI * i) / n + 1) }); };

// ---- walking and running (one leg through a step; the other half a cycle later)
const WALK_LEG = [[0, -26, 6, -14], [0.15, -14, 14, 0], [0.3, 2, 6, 0], [0.5, 22, 10, 16], [0.62, 12, 52, 20], [0.78, -14, 48, 8], [0.9, -28, 16, -6], [1, -26, 6, -14]];
const RUN_LEG = [[0, -40, 18, -12], [0.12, -22, 26, 0], [0.28, 6, 14, 6], [0.45, 38, 22, 30], [0.6, 30, 88, 36], [0.78, -20, 84, 14], [0.9, -44, 40, -6], [1, -40, 18, -12]];
function legAt(tab, u) { u = ((u % 1) + 1) % 1; let i = 0; while (i < tab.length - 2 && tab[i + 1][0] <= u) i++; const a = tab[i], b = tab[i + 1], k = (u - a[0]) / (b[0] - a[0]), e = k * k * (3 - 2 * k); return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e)]; }
const walk = (i, n) => { const u = i / n, s = Math.cos(2 * Math.PI * u);
  return P({ t: -4 + 1.5 * Math.cos(4 * Math.PI * u), h: 1, aF: [8 + 16 * s, -26 - 8 * Math.max(0, -s)], sw: 16 + 8 * s, aB: [-6 - 14 * s, -20 - 10 * Math.max(0, s)], lF: legAt(WALK_LEG, u), lB: legAt(WALK_LEG, u + 0.5), capeAdd: 8 + 3 * Math.cos(4 * Math.PI * u) }); };
const run = (i, n) => { const u = i / n, s = Math.cos(2 * Math.PI * u);
  return P({ t: -14 + 2 * Math.cos(4 * Math.PI * u), h: 6, aF: [30 + 22 * s, -40], sw: 162 - 8 * s, aB: [-10 - 34 * s, -70 - 10 * Math.max(0, s)], lF: legAt(RUN_LEG, u), lB: legAt(RUN_LEG, u + 0.5), capeAdd: 40 + 6 * Math.cos(4 * Math.PI * u) }); };

// ---- the swings: coil back on the wind-up (weight on the back foot), step in on the blow (a lunge, the body thrown
// after the blade), overshoot on the follow-through (deeper, lower) — the whole body in every cut, not just the arm
const HIGH_BACK = { r: 8, x: -20, t: 16, aF: [-150, -40], sw: -152, aB: [-30, -70], st: S.back, capeAdd: 10 }; // the sword raised behind the head, coiled
const SLASH = { r: -8, x: 40, t: -20, aF: [-74, -10], sw: 10, aB: [14, -40], st: S.lunge, capeAdd: 24 }; // stepped in, the blade level out in front
const FOLLOW_LOW = { r: -11, x: 50, t: -28, aF: [-45, -5], sw: 54, aB: [28, -30], st: S.deep, capeAdd: 30 }; // through and down, the body after it
const SHOULDER = { r: 5, x: -12, t: 10, aF: [-200, -30], sw: 200, aB: [-24, -50], st: S.back, capeAdd: 8 }; // over the far shoulder (the backhand's wind-up)
const CHOP = { r: -9, x: 36, t: -22, aF: [-64, 0], sw: 50, aB: [22, -30], st: S.lunge, capeAdd: 26 };
const LOW_BACK = { r: 9, x: -8, t: 22, aF: [40, -10], sw: 160, aB: [-40, -60], st: ST(378, -175, 150), capeAdd: 12 }; // dropped low, blade behind
const RISE_MID = { r: -4, x: 20, t: -6, aF: [-70, -20], sw: -40, aB: [10, -40], st: ST(452, -175, 205, 12, 0), capeAdd: 22 };
const OVERHEAD = { r: -3, x: 24, t: -4, aF: [-152, -14], sw: -100, aB: [-10, -40], st: S.toes, capeAdd: 32, h: -6 }; // up on his toes, the sword high over the head

const basicChain = [
  P(HIGH_BACK), P(SLASH), P(FOLLOW_LOW), P(GUARD),
  P(CHOP), P({ ...FOLLOW_LOW, sw: 66, aF: [-38, -2] }), P(SHOULDER), P(GUARD),
  P(LOW_BACK), P(RISE_MID), P(OVERHEAD), P(GUARD),
];
const attack = [P(HIGH_BACK), P(SLASH), P(SHOULDER), P(CHOP), P(LOW_BACK), P(OVERHEAD)];
const BIG_UP = { r: 6, x: -10, t: 16, aF: [-150, -26], sw: -128, aB: [-165, -20], handB: 'fist', st: ST(482, -160, 150, 0, 10), capeAdd: 8, h: -8, grip: true }; // both arms up, the sword over the head
const SMASH = { r: -13, x: 40, t: -30, aF: [-70, 5], sw: 40, aB: [-40, 0], st: ST(372, -245, 235, 32, 0), capeAdd: 42, hs: 1, grip: true }; // the sword brought down to the floor, the body thrown after it
const finisher = [P({ ...BIG_UP, st: S.toes, t: 20, r: 8 }), P(SMASH), P({ ...SMASH, t: -24, r: -10, aF: [-60, 0], sw: 46, hs: 0 }),
  P({ ...BIG_UP, air: 1, lF: [-30, 60, 0], lB: [10, 70, 0] }), P({ ...SMASH, air: 1, lF: [-40, 50, 0], lB: [20, 60, 0] }), P({ ...FOLLOW_LOW, air: 1, lF: [-20, 40, 0], lB: [10, 50, 0] })];

// ---- the skills (6 frames each, read by HERO_PLANS: startup / active / recovery)
const CROUCH = { r: 6, t: 12, aF: [20, -40], sw: 158, aB: [-30, -60], st: S.squat, capeAdd: 10 };
const LUNGE = { r: -14, x: 44, t: -26, aF: [40, -20], sw: 172, aB: [-55, -40], st: ST(398, -265, 232, 36, 0), capeAdd: 52 }; // dashing, the blade trailing low behind
const THRUST = { r: -10, x: 42, t: -18, aF: [-86, -2], sw: 0, aB: [32, -20], st: ST(418, -245, 252, 30, 0), capeAdd: 42 }; // arm and blade level, driven forward
const dash_slash = [P({ ...CROUCH, x: -10, st: ST(400, -185, 140) }), P(LUNGE), P(SLASH), P({ ...SLASH, aF: [-90, 0], sw: -6, x: 46, r: -11 }), P({ ...FOLLOW_LOW, x: 30 }), P(GUARD)];
const rising_slash = [P(LOW_BACK), P(RISE_MID), P(OVERHEAD), P({ ...OVERHEAD, air: 1, y: -46, aF: [-162, -6], sw: -94, lF: [-26, 44, 26], lB: [16, 56, 34] }), P(GUARD)];
const lance_thrust = [P({ ...CROUCH, aF: [60, -110], sw: 0, t: 10, st: ST(410, -205, 160) }), P(THRUST), P({ ...THRUST, t: -24, r: -14, x: 52, st: ST(398, -262, 280, 36, 0) }), P({ ...THRUST, aF: [-110, -10], sw: -30, x: 40 }), P({ ...OVERHEAD, sw: -80, aF: [-160, 0], st: ST(480, -150, 175, 0, 10) }), P(GUARD)];
const ground_breaker = [P({ ...BIG_UP, st: ST(478, -150, 150) }), P({ ...BIG_UP, t: 22, r: 9, aF: [-165, -30], sw: -150, aB: [-178, -15], st: S.toes }), P({ ...SMASH, sw: 72, r: -15, st: ST(352, -235, 220, 34, 0) }), P({ ...SMASH, t: -34, r: -17, sw: 74, st: ST(338, -245, 228, 36, 0) }), P({ ...CROUCH, sw: 72, aF: [-30, -10], r: -4, t: -6, st: ST(405, -190, 180) }), P(GUARD)];
const LEAP_UP = { ...BIG_UP, air: 1, lF: [-40, 80, 0], lB: [10, 90, 0], capeAdd: 50 };
const leap_crash = [P({ ...CROUCH, st: ST(372, -160, 140) }), P(LEAP_UP), P({ ...LEAP_UP, t: 24, aF: [-165, -30], sw: -160 }), P({ ...SMASH, air: 1, hs: 1, lF: [-30, 40, 0], lB: [30, 50, 0], capeAdd: -10 }), P({ ...SMASH, t: -34, r: -17, sw: 70, st: ST(338, -245, 228, 36, 0), capeAdd: 30 }), P(GUARD)];
const KNEEL = { r: -2, t: -2, aF: [-30, -60], sw: 90, aB: [-50, -40], st: ST(290, -250, 170, 85, 0), capeAdd: 18, h: 4, grip: true }; // on one knee behind the planted sword
const titans_verdict = [P({ ...BIG_UP, hs: 1 }), P({ ...BIG_UP, hs: 1, t: 18, aF: [-158, -10], sw: -98, aB: [-160, -40], st: S.toes }), P({ ...BIG_UP, hs: 1, t: 24, r: 9, aF: [-160, -8], sw: -96, aB: [-150, -60], h: -14, st: ST(540, -135, 160, 30, 28) }), P({ ...SMASH, t: -32, r: -16, sw: 88, st: ST(345, -240, 225, 34, 0) }), P(KNEEL), P(GUARD)];
// the spin: the blade swept round him — out in front, over his head, his back turned (drawn facing the other way) with
// the blade out behind, low behind, round to the front again
const SPIN_ST = ST(432, -205, 210);
const whirlwind = [P({ ...SLASH, aF: [-90, 0], sw: 0, st: SPIN_ST, x: 20, r: -6 }), P({ ...OVERHEAD, aF: [-150, -6], sw: -110, t: -6, st: SPIN_ST, x: 10 }),
  P({ _flip: 1, r: -6, t: -16, aF: [-90, -4], sw: 4, aB: [20, -40], st: SPIN_ST, capeAdd: 44 }), P({ _flip: 1, r: -4, t: -10, aF: [-50, -10], sw: 48, aB: [10, -40], st: SPIN_ST, capeAdd: 36 }),
  P({ ...SLASH, aF: [-40, -10], sw: 40, st: SPIN_ST, x: 20 }), P(GUARD)];
const SKY = { r: -2, t: 4, aF: [-160, -8], sw: -96, aB: [-150, -30], handB: 'hand', st: S.wide, capeAdd: 34, h: -12, grip: true }; // the sword raised to the sky, looking up, braced wide
// the storm: raised, then a spinning top inside its ball of blades — the sword out in front, whipped round behind, his
// back turned (drawn facing the other way), round again (HERO_PLANS loops 2–5 fast; 0 is also the recovery)
const STORM = { r: 0, t: -6, st: ST(470, -160, 170, 10, 10), capeAdd: 55, h: -6 };
const STORM_A = { ...STORM, aF: [-100, -8], sw: -20, aB: [40, -40] }, STORM_B = { ...STORM, t: 6, aF: [30, -20], sw: 200, aB: [-60, -30] };
const blade_storm = [P({ ...GUARD, t: 12, st: ST(430, -170, 170) }), P({ ...SKY }), P(STORM_A), P(STORM_B), P({ ...STORM_A, _flip: 1 }), P({ ...STORM_B, _flip: 1 })];
const wave_slash = [P({ ...LOW_BACK, aF: [60, -20], sw: 180, st: ST(398, -185, 160) }), P({ ...LOW_BACK, aF: [70, -20], sw: 190, t: 24, r: 10, st: ST(388, -195, 160) }), P({ ...LOW_BACK, aF: [76, -24], sw: 196, t: 26, r: 11, capeAdd: 20, st: ST(380, -200, 160) }), P({ ...SLASH, aF: [-80, 0], sw: 4, t: -24, r: -14, x: 46, st: ST(395, -262, 282, 36, 0), capeAdd: 40 }), P(FOLLOW_LOW), P(GUARD)];
const oath = [P({ ...BIG_UP, sw: -90, aF: [-155, -10] }), P({ ...BIG_UP, sw: 90, aF: [-110, -40], t: 4, st: S.toes }), P({ ...KNEEL, aF: [-80, -40], sw: 90, st: ST(360, -200, 150, 50, 0) }), P(KNEEL), P({ ...KNEEL, capeAdd: 28 }), P(GUARD)];
const radiant_blade = [P({ ...BIG_UP }), P(SKY), P({ ...SKY, h: -16, capeAdd: 44 }), P({ ...SKY, h: -10, capeAdd: 38 }), P({ ...THRUST, sw: -10 }), P(GUARD)];
const banner = [P(GUARD), P({ ...SKY, aF: [-150, -10], sw: -110 }), P(SKY), P({ ...SKY, capeAdd: 50 }), P({ ...SKY, aF: [-140, -20], sw: -120 }), P(GUARD)];
const ROAR = { hs: 1, r: -5, t: -12, aF: [-60, -50], sw: -20, aB: [-120, -20], handB: 'hand', st: S.wide, capeAdd: 36, h: -8 }; // the roar: chest out, the arms flung wide, braced
const war_cry = [P({ ...GUARD, grip: false, t: 14, r: 5, h: 6, st: ST(420, -170, 160), aF: [10, -70], sw: 30, aB: [10, -80] }), P(ROAR), P({ ...ROAR, t: -18, r: -7, h: -14, capeAdd: 50 }), P({ ...ROAR, t: -10, h: -6, capeAdd: 42 }), P({ ...GUARD, t: 2 }), P(GUARD)];
const judgment_blade = [P({ ...CROUCH, st: ST(372, -160, 140) }), P({ ...LEAP_UP, sw: null, aF: [-200, -40], handF: 'fist' }), P({ ...LEAP_UP, sw: null, aF: [-225, -60], t: 24, r: 8, handF: 'hand' }), P({ ...THRUST, air: 1, sw: null, handF: 'hand', t: -26, r: -10, lF: [-30, 50, 0], lB: [30, 60, 0] }), P({ ...FOLLOW_LOW, air: 1, sw: null, handF: 'fist', lF: [-16, 30, 0], lB: [20, 40, 0] }), P({ ...CROUCH, sw: null, st: ST(380, -165, 150) })];
const iron_grip = [P({ ...GUARD, grip: false, aB: [-90, -10], handB: 'hand', t: -6, r: -4, x: 10, st: S.lunge }), P({ ...GUARD, grip: false, aB: [-96, -6], handB: 'fist', t: -10, r: -6, x: 16, st: S.lunge }), P({ ...GUARD, grip: false, aB: [-175, -10], handB: 'fist', t: 12, r: 6, h: -8, st: S.wide }), P({ ...GUARD, grip: false, aB: [-180, -6], handB: 'fist', t: 16, r: 8, h: -10, hs: 1, st: ST(520, -150, 165, 22, 22) }), P({ ...SMASH, grip: false, aB: [-60, -10], handB: 'fist' }), P(GUARD)];
const judgment_hook = [P({ ...GUARD, grip: false, aB: [60, -60], handB: 'fist', t: 12, r: 6, x: -10, st: S.back }), P({ ...GUARD, grip: false, aB: [80, -50], handB: 'fist', t: 16, r: 8, x: -14, st: ST(440, -185, 150, 0, 12) }), P({ ...GUARD, grip: false, aB: [-95, -4], handB: 'hand', t: -16, r: -10, x: 30, st: S.lunge }), P({ ...GUARD, grip: false, aB: [-92, -6], handB: 'hand', t: -14, r: -9, x: 30, st: S.lunge }), P({ ...GUARD, grip: false, aB: [30, -100], handB: 'fist', t: 14, r: 8, x: -14, st: S.back }), P(GUARD)];
const sky_breaker = [P(CROUCH), P({ ...RISE_MID, air: 1, lF: [-30, 60, 0], lB: [20, 70, 0] }), P({ ...OVERHEAD, air: 1, lF: [-20, 50, 0], lB: [10, 60, 0] }), P({ ...BIG_UP, air: 1, t: 22, lF: [-40, 80, 0], lB: [10, 90, 0] }), P({ ...SMASH, air: 1, r: -20, lF: [-30, 40, 0], lB: [30, 50, 0] }), P({ ...SMASH, t: -34, r: -17, sw: 70, st: ST(338, -245, 228, 36, 0) })];
const STRAIN = { ...BIG_UP, t: 20, r: 9, aF: [-158, -14], sw: -104, aB: [-170, -10], h: -10, st: ST(450, -215, 200, 0, 12) };
const earthsplitter = [P(BIG_UP), P(STRAIN), P({ ...STRAIN, t: 26, r: 11, h: -14, hs: 1 }), P({ ...SMASH, t: -36, r: -18, sw: 92, st: ST(335, -250, 232, 36, 0), capeAdd: 52 }), P({ ...SMASH, t: -32, r: -15, sw: 95, st: ST(345, -245, 228, 34, 0) }), P(GUARD)];
const lions_maw = [P({ ...GUARD, t: 14, r: 5, h: 6, st: ST(420, -170, 160) }), P({ ...ROAR, aB: [-140, -10] }), P({ ...ROAR, aB: [-92, -4], handB: 'hand', t: -18, r: -10, x: 30, st: S.lunge }), P({ ...ROAR, aB: [-90, -6], handB: 'hand', t: -16, r: -9, x: 30, h: -4, st: S.lunge }), P({ ...OVERHEAD, sw: -60 }), P(GUARD)];
const shield_charge = [P({ ...BIG_UP, sw: 90, aF: [-110, -40] }), P(KNEEL), P({ ...KNEEL, capeAdd: 30 }), P({ ...SLASH, aF: [-90, 0], sw: 0 })];

// ---- moving, getting hit, the floor
const jump3 = [P({ ...CROUCH, sw: 158, aF: [20, -40], st: ST(400, -150, 140) }), P({ ...STAND, st: undefined, air: 1, t: -6, aF: [-20, -60], sw: -10, lF: [-30, 70, 0], lB: [10, 80, 0], capeAdd: 40 }), P({ ...STAND, st: undefined, air: 1, t: 4, aF: [-40, -30], sw: 20, lF: [-14, 20, 20], lB: [16, 30, 20], capeAdd: -20 })];
const AIR = { aF: [10, -25], sw: 22, aB: [-8, -15] };
const jump_clip = [P({ ...CROUCH, sw: 158, aF: [20, -40], st: ST(400, -150, 140) }), P({ ...AIR, air: 1, t: -10, aF: [-10, -40], sw: 30, lF: [-10, 10, 30], lB: [20, 30, 40], capeAdd: 50 }),
  P({ ...AIR, air: 1, t: -6, aF: [-20, -60], sw: -10, lF: [-30, 70, 0], lB: [10, 80, 0], capeAdd: 40 }), P({ ...AIR, air: 1, t: -2, aF: [-30, -60], sw: -20, lF: [-40, 90, 0], lB: [0, 100, 0], capeAdd: 10 }),
  P({ ...AIR, air: 1, t: 4, aF: [-40, -40], sw: 0, lF: [-20, 40, 10], lB: [10, 60, 10], capeAdd: -16 }), P({ ...AIR, air: 1, t: 4, aF: [-40, -30], sw: 20, lF: [-14, 20, 20], lB: [16, 30, 20], capeAdd: -26 }),
  P({ ...CROUCH, sw: 158, aF: [10, -40], t: 6, st: ST(395, -150, 140) })];
const djump = [P({ ...AIR, air: 1, t: -20, aF: [-60, -60], sw: -20, lF: [-60, 110, 0], lB: [-10, 120, 0], capeAdd: 50 }), P({ ...AIR, air: 1, t: -8, aF: [-30, -40], sw: 10, lF: [-20, 30, 10], lB: [20, 40, 20], capeAdd: 20 })];
const TUCK = { air: 1, t: -10, aF: [-60, -80], sw: -30, aB: [-60, -80], lF: [-80, 130, 0], lB: [-70, 130, 0], capeAdd: 20 };
const djump_flip = Array.from({ length: 7 }, (_, i) => P({ ...TUCK, r: -(360 * (i + 0.5)) / 7 }));
const backstep = [P({ ...CROUCH, sw: 60, t: -4, r: 0, st: ST(410, -150, 150) }), P({ ...AIR, air: 1, t: -12, aF: [30, -40], sw: 50, lF: [-30, 30, 0], lB: [-10, 40, 0], capeAdd: -10, x: -10 }), P({ ...AIR, air: 1, t: -8, aF: [24, -40], sw: 50, lF: [-20, 20, 0], lB: [0, 30, 0], capeAdd: -14 }), P({ ...CROUCH, sw: 50, t: -6, r: 0, st: ST(410, -150, 150) })];
const HURT = { hs: 1, r: 6, t: 16, h: 10, aF: [40, -10], sw: 30, aB: [30, -10], handB: 'hand', st: ST(470, -150, 120, 0, 10), capeAdd: -14, x: -10 };
const hurt = [P(HURT), P({ ...HURT, t: 22, r: 9, h: 14, x: -16, st: ST(455, -160, 110, 0, 18) }), P({ ...HURT, t: 18, h: 10, x: -14 }), P({ ...HURT, t: 12, r: 4, h: 6, x: -10, hs: 0 }), P({ ...GUARD, t: 8 }), P(GUARD)];
const FLAIL = { hs: 1, air: 1, t: 10, aF: [-140, -20], sw: -60, aB: [-150, -20], handB: 'hand', lF: [-30, 40, 0], lB: [20, 60, 0], capeAdd: -30 };
const launched = [P({ ...FLAIL, r: 20 }), P({ ...FLAIL, r: 40 }), P({ ...FLAIL, r: 60, aF: [-120, -30] }), P({ ...FLAIL, r: 75, aF: [-110, -30] }), P({ ...FLAIL, r: 90, aF: [-100, -20], lF: [-10, 20, 0] }), P({ ...FLAIL, r: 100, aF: [-90, -20], lF: [0, 10, 0] })];
const LYING = { r: -88, t: 0, h: 6, aF: [-40, 20], sw: 30, aB: [-20, 10], handB: 'hand', lF: [-6, 6, 0], lB: [4, 10, 0], cape: 60, air: 1, y: 0 };
const down_impact = [P({ ...LYING, r: -70, hs: 1 }), P({ ...LYING, r: -94, hs: 1 }), P(LYING)];
const down = [P(LYING), P({ ...LYING, h: 4, aF: [-38, 18] })];
const KNEEL_OLD = { t: -6, aF: [-40, -70], sw: 86, aB: [-50, -40], lF: [-60, 100, 0], lB: [70, 30, -60], capeAdd: 18 };
const getup = [P({ ...LYING, r: -70 }), P({ ...LYING, r: -45, t: 10, aF: [-10, 0], lF: [-50, 100, 0] }), P({ ...KNEEL_OLD, r: -10, t: 10 }), P({ ...KNEEL, t: 0 }), P({ ...CROUCH, t: 4, r: 0 }), P({ ...GUARD, t: 6 }), P(GUARD)];
const quickrise = [P({ ...TUCK, r: -200 }), P({ ...TUCK, r: -300 }), P({ ...CROUCH, t: 4, r: 0 })];
const stunned = Array.from({ length: 4 }, (_, i) => { const s = Math.sin((i / 4) * 2 * Math.PI); return P({ t: 8 + 4 * s, h: 12 + 6 * s, aF: [18, -10], sw: 34, aB: [10, -10], handB: 'hand', st: ST(480 - 6 * s, -110 + 6 * s, 120 + 6 * s), r: 3 * s, capeAdd: 6 * s, x: 4 * s }); });
const runstop = [P({ r: 6, t: 12, aF: [-30, -40], sw: 20, aB: [-40, -50], st: ST(420, -130, 230, 0, 0), capeAdd: 50, x: -6 }), P({ ...GUARD, t: 8 })];
const WIN = { t: -4, aF: [-160, -6], sw: -96, aB: [-20, -60], st: ST(500, -110, 140), capeAdd: 30, h: -10 };
const win = Array.from({ length: 8 }, (_, i) => i < 3 ? P({ ...GUARD, t: 4 - 2 * i }) : i < 5 ? P({ ...WIN, aF: [-150 - 10 * (i - 3), -10], sw: -110 + 8 * (i - 3) }) : P({ ...WIN, capeAdd: 30 + 6 * Math.sin(i), hs: i === 6 ? 1 : 0 }));
const intro = Array.from({ length: 8 }, (_, i) => i < 3 ? P({ ...STAND, sw: 60 - 10 * i }) : i < 6 ? P({ ...SHOULDER, aF: [-200 + 30 * (i - 3), -30], sw: 200 - 40 * (i - 3) }) : P(GUARD));

export const ACTIONS = {
  idle: Array.from({ length: 30 }, (_, i) => idle(i, 30)), stance: [P(GUARD)],
  walk: Array.from({ length: 16 }, (_, i) => walk(i, 16)), run: Array.from({ length: 14 }, (_, i) => run(i, 14)),
  jump: jump3, jump_clip, djump, djump_flip, backstep,
  attack, basic_chain: basicChain, finisher,
  dash_slash, rising_slash, lance_thrust, ground_breaker, leap_crash, titans_verdict, whirlwind, blade_storm, wave_slash, oath, radiant_blade, banner,
  war_cry, judgment_blade, iron_grip, judgment_hook, sky_breaker, earthsplitter, lions_maw, shield_charge,
  hurt, launched, down_impact, down, getup, quickrise, stunned, runstop, win, intro,
};

export const opts = { w: 1100, h: 1100, x: 550, y: 640, ground: 1040, scale: 0.6, plant: { footF: [[28, 226], [210, 231]], footB: [[28, 226], [210, 231]] } };
export function frames() {
  const out = [];
  for (const [act, list] of Object.entries(ACTIONS)) list.forEach((pose, i) => out.push({ pose, label: `${act}-${i}` }));
  return out;
}
/** The sword's grip (the hand) and its point, in the sword piece's px. */
export const SWORD = { grip: [126, 102], tip: [1186, 106] };
/** The eyes' middle in the head piece's px (War Cry's glowing eyes ride it). */
export const EYE = [233, 208];
