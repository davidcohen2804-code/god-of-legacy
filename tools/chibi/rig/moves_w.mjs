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
  if (s.hs) p._piece_head = 'head_shout';
  if (!s.air) p._clipGround = ['sword']; // (on the ground nothing of the blade shows below the floor: a blade brought down is driven into it)
  if (s.air) p._air = 1;
  return p;
}

// ---- the stances
const STAND = { aF: [10, -25], sw: 22, aB: [-8, -15], lF: [8, 2, 0], lB: [-12, 4, 0] };
const GUARD = { t: 4, aF: [-8, -62], sw: -28, aB: [-20, -60], lF: [-14, 22, 0], lB: [16, 18, 0], capeAdd: 6 };

const idle = (i, n) => { const b = (1 - Math.cos((2 * Math.PI * i) / n)) / 2;
  return P({ ...STAND, t: -1.2 * b, h: 0.8 * b, aF: [10 + 2 * b, -25 - 3 * b], sw: 22 + 2 * b, aB: [-8 - 1.5 * b, -15 - 2 * b], lF: [8 - 1.5 * b, 2 + 3 * b, 0], lB: [-12 - 1.5 * b, 4 + 3 * b, 0], capeAdd: 3 * Math.sin((2 * Math.PI * i) / n + 1) }); };

// ---- walking and running (one leg through a step; the other half a cycle later)
const WALK_LEG = [[0, -26, 6, -14], [0.15, -14, 14, 0], [0.3, 2, 6, 0], [0.5, 22, 10, 16], [0.62, 12, 52, 20], [0.78, -14, 48, 8], [0.9, -28, 16, -6], [1, -26, 6, -14]];
const RUN_LEG = [[0, -40, 18, -12], [0.12, -22, 26, 0], [0.28, 6, 14, 6], [0.45, 38, 22, 30], [0.6, 30, 88, 36], [0.78, -20, 84, 14], [0.9, -44, 40, -6], [1, -40, 18, -12]];
function legAt(tab, u) { u = ((u % 1) + 1) % 1; let i = 0; while (i < tab.length - 2 && tab[i + 1][0] <= u) i++; const a = tab[i], b = tab[i + 1], k = (u - a[0]) / (b[0] - a[0]), e = k * k * (3 - 2 * k); return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e)]; }
const walk = (i, n) => { const u = i / n, s = Math.cos(2 * Math.PI * u);
  return P({ t: -4 + 1.5 * Math.cos(4 * Math.PI * u), h: 1, aF: [8 + 16 * s, -26 - 8 * Math.max(0, -s)], sw: 16 + 8 * s, aB: [-6 - 14 * s, -20 - 10 * Math.max(0, s)], lF: legAt(WALK_LEG, u), lB: legAt(WALK_LEG, u + 0.5), capeAdd: 8 + 3 * Math.cos(4 * Math.PI * u) }); };
const run = (i, n) => { const u = i / n, s = Math.cos(2 * Math.PI * u);
  return P({ t: -14 + 2 * Math.cos(4 * Math.PI * u), h: 6, aF: [30 + 22 * s, -40], sw: 162 - 8 * s, aB: [-10 - 34 * s, -70 - 10 * Math.max(0, s)], lF: legAt(RUN_LEG, u), lB: legAt(RUN_LEG, u + 0.5), capeAdd: 40 + 6 * Math.cos(4 * Math.PI * u) }); };

// ---- swings (the near arm's sword arc, from the guard)
const HIGH_BACK = { t: 14, aF: [-145, -40], sw: -150, aB: [-30, -70], lF: [-16, 24, 0], lB: [20, 16, 0], capeAdd: 10 }; // the sword raised behind the head
const SLASH = { t: -16, aF: [-74, -10], sw: 10, aB: [10, -40], lF: [-26, 30, 0], lB: [26, 10, 0], capeAdd: 22, x: 10 }; // the blade level, out in front
const FOLLOW_LOW = { floor: 1, t: -18, aF: [-45, -5], sw: 52, aB: [24, -30], lF: [-28, 34, 0], lB: [28, 12, 0], capeAdd: 28, x: 14 }; // through and down
const SHOULDER = { t: 6, aF: [-200, -30], sw: 200, aB: [-24, -50], lF: [-12, 20, 0], lB: [16, 14, 0] }; // over the far shoulder (the backhand's wind-up)
const CHOP = { floor: 1, t: -16, aF: [-64, 0], sw: 48, aB: [20, -30], lF: [-24, 30, 0], lB: [24, 12, 0], capeAdd: 24, x: 12 };
const LOW_BACK = { t: 18, aF: [40, -10], sw: 160, aB: [-40, -60], lF: [-30, 60, 0], lB: [30, 40, 0], capeAdd: 12, x: -4 }; // dropped low, blade behind
const RISE_MID = { t: -6, aF: [-70, -20], sw: -40, aB: [10, -40], lF: [-20, 24, 0], lB: [20, 10, 0], capeAdd: 20, x: 8 };
const OVERHEAD = { t: -4, aF: [-152, -14], sw: -100, aB: [-10, -40], lF: [-10, 6, 0], lB: [12, 4, -10], capeAdd: 30, x: 6, h: -6 }; // sword high over the head

const basicChain = [
  P(HIGH_BACK), P(SLASH), P(FOLLOW_LOW), P(GUARD),
  P(CHOP), P(FOLLOW_LOW), P(SHOULDER), P(GUARD),
  P(LOW_BACK), P(RISE_MID), P(OVERHEAD), P(GUARD),
];
const attack = [P(HIGH_BACK), P(SLASH), P(SHOULDER), P(CHOP), P(LOW_BACK), P(OVERHEAD)];
const BIG_UP = { t: 14, aF: [-150, -26], sw: -128, aB: [-165, -20], handB: 'fist', lF: [-18, 30, 0], lB: [22, 20, 0], capeAdd: 8, h: -8 }; // both arms up, the sword over the head
const SMASH = { floor: 1, t: -26, aF: [-70, 5], sw: 38, aB: [-40, 0], lF: [-34, 50, 0], lB: [34, 30, 0], capeAdd: 40, x: 18, y: 0 }; // the sword brought down to the floor
const finisher = [P(BIG_UP), P(SMASH), P({ ...SMASH, t: -18, aF: [-60, 0], sw: 42 }),
  P({ ...BIG_UP, air: 1, lF: [-30, 60, 0], lB: [10, 70, 0] }), P({ ...SMASH, air: 1, lF: [-40, 50, 0], lB: [20, 60, 0] }), P({ ...FOLLOW_LOW, air: 1, lF: [-20, 40, 0], lB: [10, 50, 0] })];

// ---- the skills (6 frames each, read by HERO_PLANS: startup / active / recovery)
const CROUCH = { t: 10, aF: [20, -40], sw: 158, aB: [-30, -60], lF: [-36, 74, 0], lB: [34, 50, 0], capeAdd: 10 };
const LUNGE = { t: -24, aF: [40, -20], sw: 170, aB: [-50, -40], lF: [-44, 40, 0], lB: [50, 10, 0], capeAdd: 50, x: 24 }; // dashing, the blade trailing low behind
const THRUST = { t: -16, aF: [-86, -2], sw: 0, aB: [30, -20], lF: [-38, 36, 0], lB: [42, 8, 0], capeAdd: 40, x: 26 }; // arm and blade level, driven forward
const dash_slash = [P(CROUCH), P(LUNGE), P(SLASH), P({ ...SLASH, aF: [-90, 0], sw: -6, x: 20 }), P({ ...FOLLOW_LOW, x: 8 }), P(GUARD)];
const rising_slash = [P(LOW_BACK), P(RISE_MID), P({ ...OVERHEAD, lB: [16, 2, -24], y: -6 }), P({ ...OVERHEAD, aF: [-160, -6], sw: -95, lF: [-6, 4, -20], lB: [18, 0, -30], y: -12 }), P(GUARD)];
const lance_thrust = [P({ ...CROUCH, aF: [60, -110], sw: 0, t: 6 }), P(THRUST), P({ ...THRUST, t: -22, x: 34, lF: [-46, 44, 0], lB: [52, 4, 0] }), P({ ...THRUST, aF: [-110, -10], sw: -30, x: 28 }), P({ ...OVERHEAD, sw: -80, aF: [-160, 0] }), P(GUARD)];
const ground_breaker = [P(BIG_UP), P({ ...BIG_UP, t: 20, aF: [-160, -30], sw: -140, aB: [-178, -15] }), P(SMASH), P({ ...SMASH, t: -30, lF: [-40, 70, 0], lB: [40, 50, 0] }), P({ ...CROUCH, sw: 70, aF: [-30, -10] }), P(GUARD)];
const LEAP_UP = { ...BIG_UP, air: 1, lF: [-40, 80, 0], lB: [10, 90, 0], capeAdd: 50 };
const leap_crash = [P(CROUCH), P(LEAP_UP), P({ ...LEAP_UP, t: 22, aF: [-165, -30], sw: -160 }), P({ ...SMASH, air: 1, lF: [-30, 40, 0], lB: [30, 50, 0], capeAdd: -10 }), P({ ...SMASH, t: -32, lF: [-46, 80, 0], lB: [40, 60, 0], capeAdd: 30 }), P(GUARD)];
const KNEEL = { floor: 1, t: -6, aF: [-40, -70], sw: 86, aB: [-50, -40], lF: [-60, 100, 0], lB: [70, 30, -60], capeAdd: 18, y: 0 }; // on one knee behind the planted sword
const titans_verdict = [P({ ...BIG_UP, hs: 1 }), P({ ...BIG_UP, hs: 1, t: 18, aF: [-158, -10], sw: -98, aB: [-160, -40] }), P({ ...BIG_UP, hs: 1, t: 22, aF: [-160, -8], sw: -96, aB: [-150, -60], h: -14 }), P({ ...SMASH, t: -30, sw: 88, lF: [-46, 70, 0], lB: [44, 50, 0] }), P(KNEEL), P(GUARD)];
// the spin: the blade swept round him (front, up, behind, low behind, round to the front)
const whirlwind = [P({ ...SLASH, aF: [-90, 0], sw: 0 }), P({ ...OVERHEAD, aF: [-150, -6], sw: -110, t: -6 }), P({ t: 10, aF: [-230, 10], sw: 200, aB: [40, -40], lF: [-20, 24, 0], lB: [24, 16, 0], capeAdd: 40 }), P({ t: 14, aF: [60, 0], sw: 160, aB: [-60, -30], lF: [-24, 30, 0], lB: [26, 18, 0], capeAdd: 30 }), P({ ...SLASH, aF: [-40, -10], sw: 40 }), P(GUARD)];
const SKY = { t: 4, aF: [-160, -8], sw: -96, aB: [-20, -50], lF: [-10, 8, 0], lB: [14, 6, 0], capeAdd: 30, h: -12 }; // the sword raised to the sky, looking up
const blade_storm = [P({ ...GUARD }), P({ ...SKY, aF: [-150, -10], sw: -110 }), P(SKY), P({ ...SKY, capeAdd: 44, h: -16 }), P({ ...SKY, capeAdd: 36, h: -10, aF: [-158, -8] }), P(GUARD)];
const wave_slash = [P({ ...LOW_BACK, aF: [60, -20], sw: 180 }), P({ ...LOW_BACK, aF: [70, -20], sw: 190, t: 22 }), P({ ...LOW_BACK, aF: [76, -24], sw: 196, t: 24, capeAdd: 20 }), P({ ...SLASH, aF: [-80, 0], sw: 4, t: -18, x: 18, lF: [-36, 44, 0], lB: [40, 10, 0] }), P(FOLLOW_LOW), P(GUARD)];
const oath = [P({ ...BIG_UP, sw: -90, aF: [-155, -10] }), P({ ...BIG_UP, sw: 90, aF: [-110, -40], t: 4 }), P({ ...KNEEL, aF: [-80, -40], sw: 90, y: -10, lF: [-50, 80, 0], lB: [60, 30, -40] }), P(KNEEL), P({ ...KNEEL, capeAdd: 26 }), P(GUARD)];
const radiant_blade = [P({ ...BIG_UP }), P(SKY), P({ ...SKY, h: -16, capeAdd: 40 }), P({ ...SKY, h: -10, capeAdd: 34 }), P({ ...THRUST, sw: -10 }), P(GUARD)];
const banner = [P(GUARD), P({ ...SKY, aF: [-150, -10], sw: -110 }), P(SKY), P({ ...SKY, capeAdd: 44 }), P({ ...SKY, aF: [-140, -20], sw: -120 }), P(GUARD)];
const ROAR = { hs: 1, t: -10, aF: [-60, -50], sw: -20, aB: [-120, -20], handB: 'hand', lF: [-22, 24, 0], lB: [24, 14, 0], capeAdd: 34, h: -8 }; // the roar: chest out, the arms flung wide
const war_cry = [P({ ...GUARD, t: 10, h: 4 }), P(ROAR), P({ ...ROAR, t: -14, h: -12, capeAdd: 44 }), P({ ...ROAR, t: -8, h: -6, capeAdd: 38 }), P({ ...GUARD, t: 2 }), P(GUARD)];
const judgment_blade = [P(CROUCH), P({ ...LEAP_UP, sw: null, aF: [-200, -40], handF: 'fist' }), P({ ...LEAP_UP, sw: null, aF: [-220, -60], t: 20, handF: 'hand' }), P({ ...THRUST, air: 1, sw: null, handF: 'hand', lF: [-30, 50, 0], lB: [30, 60, 0] }), P({ ...FOLLOW_LOW, air: 1, sw: null, handF: 'fist', lF: [-16, 30, 0], lB: [20, 40, 0] }), P({ ...CROUCH, sw: null })];
const iron_grip = [P({ ...GUARD, aB: [-90, -10], handB: 'hand' }), P({ ...GUARD, aB: [-96, -6], handB: 'fist', t: -6, x: 8 }), P({ ...GUARD, aB: [-175, -10], handB: 'fist', t: 10, h: -8 }), P({ ...GUARD, aB: [-180, -6], handB: 'fist', t: 12, h: -10, hs: 1 }), P({ ...SMASH, aB: [-60, -10], handB: 'fist' }), P(GUARD)];
const judgment_hook = [P({ ...GUARD, aB: [60, -60], handB: 'fist', t: 8 }), P({ ...GUARD, aB: [80, -50], handB: 'fist', t: 12 }), P({ ...GUARD, aB: [-95, -4], handB: 'hand', t: -12, x: 10 }), P({ ...GUARD, aB: [-92, -6], handB: 'hand', t: -10, x: 10 }), P({ ...GUARD, aB: [30, -100], handB: 'fist', t: 10, x: -4 }), P(GUARD)];
const sky_breaker = [P(CROUCH), P({ ...RISE_MID, air: 1, lF: [-30, 60, 0], lB: [20, 70, 0] }), P({ ...OVERHEAD, air: 1, lF: [-20, 50, 0], lB: [10, 60, 0] }), P({ ...BIG_UP, air: 1, lF: [-40, 80, 0], lB: [10, 90, 0] }), P({ ...SMASH, air: 1, lF: [-30, 40, 0], lB: [30, 50, 0] }), P({ ...SMASH, t: -30, lF: [-44, 76, 0], lB: [40, 56, 0] })];
const STRAIN = { ...BIG_UP, t: 18, aF: [-158, -14], sw: -104, aB: [-170, -10], h: -10, lF: [-30, 50, 0], lB: [34, 34, 0] };
const earthsplitter = [P(BIG_UP), P(STRAIN), P({ ...STRAIN, t: 22, h: -14, hs: 1 }), P({ ...SMASH, t: -34, sw: 92, lF: [-48, 80, 0], lB: [46, 56, 0], capeAdd: 50 }), P({ ...SMASH, t: -30, sw: 95, lF: [-44, 76, 0], lB: [42, 52, 0] }), P(GUARD)];
const lions_maw = [P({ ...GUARD, t: 10, h: 4 }), P({ ...ROAR, aB: [-140, -10] }), P({ ...ROAR, aB: [-92, -4], handB: 'hand', t: -14, x: 10 }), P({ ...ROAR, aB: [-90, -6], handB: 'hand', t: -12, x: 10, h: -4 }), P({ ...OVERHEAD, sw: -60 }), P(GUARD)];
const shield_charge = [P({ ...BIG_UP, sw: 90, aF: [-110, -40] }), P(KNEEL), P({ ...KNEEL, capeAdd: 30 }), P({ ...SLASH, aF: [-90, 0], sw: 0 })];

// ---- moving, getting hit, the floor
const jump3 = [P({ ...CROUCH, sw: 158, aF: [20, -40] }), P({ ...STAND, air: 1, t: -6, aF: [-20, -60], sw: -10, lF: [-30, 70, 0], lB: [10, 80, 0], capeAdd: 40 }), P({ ...STAND, air: 1, t: 4, aF: [-40, -30], sw: 20, lF: [-14, 20, 20], lB: [16, 30, 20], capeAdd: -20 })];
const jump_clip = [P({ ...CROUCH, sw: 158, aF: [20, -40] }), P({ ...STAND, air: 1, t: -10, aF: [-10, -40], sw: 30, lF: [-10, 10, 30], lB: [20, 30, 40], capeAdd: 50 }),
  P({ ...STAND, air: 1, t: -6, aF: [-20, -60], sw: -10, lF: [-30, 70, 0], lB: [10, 80, 0], capeAdd: 40 }), P({ ...STAND, air: 1, t: -2, aF: [-30, -60], sw: -20, lF: [-40, 90, 0], lB: [0, 100, 0], capeAdd: 10 }),
  P({ ...STAND, air: 1, t: 4, aF: [-40, -40], sw: 0, lF: [-20, 40, 10], lB: [10, 60, 10], capeAdd: -16 }), P({ ...STAND, air: 1, t: 4, aF: [-40, -30], sw: 20, lF: [-14, 20, 20], lB: [16, 30, 20], capeAdd: -26 }),
  P({ ...CROUCH, sw: 158, aF: [10, -40], t: 6 })];
const djump = [P({ ...STAND, air: 1, t: -20, aF: [-60, -60], sw: -20, lF: [-60, 110, 0], lB: [-10, 120, 0], capeAdd: 50 }), P({ ...STAND, air: 1, t: -8, aF: [-30, -40], sw: 10, lF: [-20, 30, 10], lB: [20, 40, 20], capeAdd: 20 })];
const TUCK = { air: 1, t: -10, aF: [-60, -80], sw: -30, aB: [-60, -80], lF: [-80, 130, 0], lB: [-70, 130, 0], capeAdd: 20 };
const djump_flip = Array.from({ length: 7 }, (_, i) => P({ ...TUCK, r: -(360 * (i + 0.5)) / 7 }));
const backstep = [P({ ...CROUCH, sw: 60, t: -4 }), P({ ...STAND, air: 1, t: -12, aF: [30, -40], sw: 50, lF: [-30, 30, 0], lB: [-10, 40, 0], capeAdd: -10, x: -10 }), P({ ...STAND, air: 1, t: -8, aF: [24, -40], sw: 50, lF: [-20, 20, 0], lB: [0, 30, 0], capeAdd: -14 }), P({ ...CROUCH, sw: 50, t: -6 })];
const HURT = { hs: 1, t: 16, h: 10, aF: [40, -10], sw: 30, aB: [30, -10], handB: 'hand', lF: [-10, 10, 0], lB: [18, 8, 0], capeAdd: -14, x: -10 };
const hurt = [P(HURT), P({ ...HURT, t: 22, h: 14, x: -16 }), P({ ...HURT, t: 18, h: 10, x: -14 }), P({ ...HURT, t: 12, h: 6, x: -10, hs: 0 }), P({ ...GUARD, t: 8 }), P(GUARD)];
const FLAIL = { hs: 1, air: 1, t: 10, aF: [-140, -20], sw: -60, aB: [-150, -20], handB: 'hand', lF: [-30, 40, 0], lB: [20, 60, 0], capeAdd: -30 };
const launched = [P({ ...FLAIL, r: 20 }), P({ ...FLAIL, r: 40 }), P({ ...FLAIL, r: 60, aF: [-120, -30] }), P({ ...FLAIL, r: 75, aF: [-110, -30] }), P({ ...FLAIL, r: 90, aF: [-100, -20], lF: [-10, 20, 0] }), P({ ...FLAIL, r: 100, aF: [-90, -20], lF: [0, 10, 0] })];
const LYING = { r: -88, t: 0, h: 6, aF: [-40, 20], sw: 30, aB: [-20, 10], handB: 'hand', lF: [-6, 6, 0], lB: [4, 10, 0], cape: 60, air: 1, y: 0 };
const down_impact = [P({ ...LYING, r: -70, hs: 1 }), P({ ...LYING, r: -94, hs: 1 }), P(LYING)];
const down = [P(LYING), P({ ...LYING, h: 4, aF: [-38, 18] })];
const getup = [P({ ...LYING, r: -70 }), P({ ...LYING, r: -45, t: 10, aF: [-10, 0], lF: [-50, 100, 0] }), P({ ...KNEEL, r: -10, t: 10 }), P({ ...KNEEL, t: 0 }), P({ ...CROUCH, t: 4 }), P({ ...GUARD, t: 6 }), P(GUARD)];
const quickrise = [P({ ...TUCK, r: -200 }), P({ ...TUCK, r: -300 }), P({ ...CROUCH, t: 4 })];
const stunned = Array.from({ length: 4 }, (_, i) => { const s = Math.sin((i / 4) * 2 * Math.PI); return P({ t: 8 + 4 * s, h: 12 + 6 * s, aF: [18, -10], sw: 34, aB: [10, -10], handB: 'hand', lF: [-4 + 3 * s, 10, 0], lB: [10 - 3 * s, 12, 0], capeAdd: 6 * s, x: 4 * s }); });
const runstop = [P({ t: 12, aF: [-30, -40], sw: 20, aB: [-40, -50], lF: [-40, 20, 0], lB: [20, 30, 0], capeAdd: 50, x: -6 }), P({ ...GUARD, t: 8 })];
const WIN = { t: -4, aF: [-160, -6], sw: -96, aB: [-20, -60], lF: [-12, 8, 0], lB: [14, 6, 0], capeAdd: 30, h: -10 };
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
