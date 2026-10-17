// PVP 3D — the Gambler's skills in the room's 3D (fuchsia, cards, coins, dice): what each skill adds in 3D on top of its painted effect.
// Owned by the Gambler chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
// One 3D shape per skill (no two alike): the basic's cuts, the deal's fan of streaks, the vault's upright crescent, the fuse's
// late eruption, the riffle's whirl, the rotor's wheel of cuts, the showdown's crest down the row, the coin's gold column,
// the wheel's twisting column, the dice's dome, the grab's tether lightning, the ace's gold lance, Lady Luck's coin rain,
// Pick-up 52's card rain, the home run's crater, Overload's lightning at his feet, Card Swap's flash, the jackpot's tower,
// All In's gold column out of a crater, Triple Down's three cracks growing.
import type { Recipe } from '../Fx3D';
import { C, me, side, ahead, placeOf, T } from './kit';

const chest = (p: { x: number; y: number }, z = 90) => ({ x: p.x, y: p.y, z });

export const GAMBLER: Record<string, Recipe> = {
  // the basic: a thrust, a swing, a rising cut — each its own cut in 3D, the last one the big one
  cut_the_deck: {
    trail: { c: C.fuchsia, w: 9, len: 10 },
    active: (f, r) => {
      const c = me(f, r), s = side(r), st = r.stage ?? 0;
      if (st === 0) f.streak(chest(c, 95), { x: c.x + s * 150, y: c.y, z: 95 }, C.fuchsia, { w: 12, ms: 180, draw: 30 });
      else if (st === 1) f.slash(c, s, C.fuchsia, { r: 120, tilt: 30, a0: -70, a1: 110, ms: 220, i: 1.6 });
      else f.slash(c, s, C.fuchsia, { r: 135, tilt: 78, a0: 170, a1: 10, ms: 260, y0: 50, i: 2 });
    },
  },
  // seven cards fanned out: a fan of thin streaks from his hand, each card trailing light
  charged_deal: {
    trail: { c: C.fuchsia, w: 12, len: 9, i: 2.4 },
    active: (f, r) => { const c = me(f, r), s = side(r); for (let k = -2; k <= 2; k++) f.streak(chest(c, 92), { x: c.x + s * 190, y: c.y + k * 34, z: 92 + k * 6 }, C.fuchsia, { w: 4, ms: 130, draw: 40 }); },
  },
  // the vault over the foe: an upright crescent of light along the staff's arc; the launch's column is the default main hit
  staff_vault: {
    active: (f, r) => f.slash(me(f, r), side(r), C.fuchsia, { r: 95, w: 18, tilt: 88, a0: 200, a1: -20, ms: 300, y0: 30, i: 1.2, follow: () => f.host.casterPos(r.attackerId) }),
  },
  // the staff slams a charged floor: cracks where it lands, then the fuse goes off — a burst of floor chunks and a short column
  fuse_slam: {
    own: true,
    active: (f, r) => {
      const p = ahead(f, r, 70);
      f.later(T(r).active * 0.5, () => { f.crack(p.x, p.y, C.fuchsia, { r: 100, chunks: 6, ms: 900 }); f.host.kick(0.03); });
      f.later(800, () => { f.pillar(p.x, p.y, C.fuchsia, { h: 300, r: 40, ms: 360 }); f.debris(p.x, p.y, 12, { speed: 1.2, up: 1.5 }); f.host.impact({ x: p.x, y: p.y, z: 20 }, 1); });
    },
  },
  // a whirl of cards round him (a tight one: it never hides the fight)
  riffle_shuffle: { trail: { c: C.fuchsia, w: 8, len: 10 }, active: (f, r) => f.whirl(r.attackerId, C.fuchsia, { r: 120, ms: Math.min(400, T(r).active), rings: 1, every: 130, dir: side(r) }) },
  // the staff spun like a wheel in front of him: upright cuts turning, one after the other
  rotor_staff: {
    active: (f, r) => { const n = Math.max(2, Math.min(5, Math.round(T(r).active / 110))); for (let k = 0; k < n; k++) f.later(k * 110, () => f.slash(me(f, r), side(r), C.fuchsia, { r: 90, tilt: 90, a0: -90 + k * 40, a1: 90 + k * 40, ms: 180, y0: 30, i: 1.4 })); },
  },
  // the row of cards turned face up: a crest of light runs down the row along the floor, the last card the big burst
  showdown: {
    active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y * 0.6, C.fuchsia, { len: 360, ms: 340, h: 90, w: 70 }); },
  },
  // the coin: a thin gold column rising where it lands
  coin_flip: { own: true, active: (f, r) => f.pillar(me(f, r).x, me(f, r).y, C.coin, { h: 420, r: 30, ms: 520, core: false }) },
  // the wheel: its result tears up a twisting column, the floor cracking gold round it
  roulette_wheel: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.pillar(at.x, at.y, C.fuchsia, { h: 520, r: 46, ms: 520, twist: true }); f.crack(at.x, at.y, C.coin, { r: 110, chunks: 10 }); } } },
  // the dice: each die bursts in a shell of light; the second (the sum) the bigger, the floor torn under it
  dice_bomb: {
    own: true,
    hit: (f, _s, _h, at, main) => { f.dome(at.x, at.y, C.dice, { r: main ? 170 : 90, ms: main ? 360 : 240, a: main ? 0.8 : 0.55 }); if (main) f.crack(at.x, at.y, C.fuchsia, { r: 110, chunks: 12 }); },
  },
  // the grab: a tether of lightning from his hand to the seized foe; the throw lands in a shell of light
  kinetic_grab: {
    active: (f, r) => { const c = me(f, r), e = ahead(f, r, 120); f.bolt(chest(c, 92), { x: e.x, y: e.y, z: 85 }, C.fuchsia, { ms: 360, w: 8, forks: 2 }); },
    hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, C.fuchsia, { r: 80, ms: 240, a: 0.5 }); },
  },
  // the ace: a gold lance in flight, a gold shell and a thin fuchsia column where it blows up
  ace_in_the_hole: { trail: { c: C.coin, w: 14, i: 2.6 }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.coin, { r: 150, ms: 360 }); f.pillar(at.x, at.y, C.fuchsia, { h: 480, r: 32, ms: 420, core: false }); } } },
  // Lady Luck: a short rain of gold over him
  lady_luck: { own: true, active: (f, r) => { const c = me(f, r); f.rain(c.x, c.y, 80, C.coin, { n: 10, ms: 420, h: 420 }); } },
  // Pick-up 52: the deck thrown up comes down — a rain of fuchsia over the area ahead
  pickup_52: { active: (f, r) => { const p = ahead(f, r, 160); f.rain(p.x, p.y, 150, C.fuchsia, { n: 22, ms: 700, h: 560 }); } },
  // the home run: a crater where the bat of light lands, a shell, the camera pushed
  grand_slam: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.fuchsia, { r: 160, chunks: 18, up: 1.3 }); f.host.kick(0.05); } } },
  // Overload: lightning crawls round his feet
  kinetic_overload: {
    own: true,
    active: (f, r) => { for (let k = 0; k < 4; k++) f.later(k * 90, () => { const c = me(f, r), a = (k / 4) * Math.PI * 2; f.bolt({ x: c.x + Math.cos(a) * 70, y: c.y + Math.sin(a) * 40, z: 6 }, { x: c.x + Math.cos(a + 1.6) * 70, y: c.y + Math.sin(a + 1.6) * 40, z: 6 }, C.fuchsia, { ms: 200, w: 6, forks: 1 }); }); },
  },
  // Card Swap: he flashes to his card in a streak of light
  card_swap: { active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.7, () => { const e = me(f, r); f.streak(chest(c), chest(e), C.fuchsia, { w: 18, ms: 300, draw: 40 }); }); } },
  // the jackpot: a gold tower of light, then the crater (kept under a white-out: the fighters read through it)
  jackpot: { own: true, active: (f, r) => { const p = placeOf(f, r, 220); f.pillar(p.x, p.y, C.coin, { h: 900, r: 60, ms: 900, twist: true, i: 1.4 }); f.later(140, () => { f.dome(p.x, p.y, C.fuchsia, { r: 300, ms: 600, a: 0.35 }); f.crack(p.x, p.y, C.fuchsia, { r: 240, chunks: 26, up: 1.4 }); f.host.impact({ x: p.x, y: p.y, z: 60 }, 2); f.host.kick(0.08); }); } },
  // All In: every stuck card goes off — a crater and a gold column out of it
  all_in: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.fuchsia, { r: 150, chunks: 18 }); f.pillar(at.x, at.y, C.coin, { h: 600, r: 32, ms: 480, i: 1.4, core: false }); } } },
  // Triple Down: three slams — the cracks grow with each, the third the widest
  triple_down: { own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam' || react === 'knockdown') f.crack(at.x, at.y, C.fuchsia, { r: main ? 150 : 95, chunks: main ? 16 : 7 }); } },
};
