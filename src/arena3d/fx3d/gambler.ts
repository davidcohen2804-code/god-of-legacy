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
/** His families' colours (DFO's review: one colour read every skill alike): the STAFF steel and violet, the CARDS white
 *  faces and red, the COIN gold, CHANCE the fuchsia neon, the FUSE orange. Every recipe draws its own main hit (own). */
const F = { violet: 0x9a8cff, steel: 0xe2e8ff, card: 0xfff2f2, red: 0xff3a52, coin: C.coin, neon: C.fuchsia, fuse: 0xff6a1a, ember: 0xffb060 };

/** The colour the room answers each family's blows in (DFO, 7b12cb13): the cards' a warm off-white, not a white flash. */
const TONE = { violet: F.violet, card: 0xff4a5e, coin: F.coin, neon: F.neon, fuse: F.fuse };

/** Call the Deck's holds under their foes (by cast): where he is now, ended, last seen (the room's clock). */
const HOLD = new Map<string, { at: { x: number; y: number; z: number }; end: boolean; /** frames since its last turn */ seen: number }>();

export const GAMBLER: Record<string, Recipe> = {
  // the basic: a thrust, a swing, a rising cut — each its own cut in 3D, the last one the big one
  cut_the_deck: { tone: TONE.violet,
    // (DAVID 20:56, the bar: each strike one thick ribbon ring in perspective — a white-hot edge, violet, an ink stroke inside
    // turning to ink as it fades; the jab a long thrust line; the flick two red card streaks; the rising swing the big one.
    // The main hit's impact is the engine's own — none here.)
    own: true,
    trail: { c: F.red, w: 6, len: 8, i: 1.3 },
    active: (f, r) => {
      const c = me(f, r), s = side(r), st = r.stage ?? 0;
      if (st === 0) { f.streak(chest(c, 95), { x: c.x + s * 170, y: c.y, z: 95 }, F.steel, { w: 14, ms: 140, draw: 25 }); f.slash(c, s, 0xb4a6ff, { r: 100, w: 30, tilt: 6, a0: -40, a1: 40, ms: 160, y0: 70, i: 2.2, ink: true }); }
      else if (st === 1) f.slash(c, s, 0xb4a6ff, { r: 125, w: 50, tilt: 50, a0: -50, a1: 150, ms: 230, y0: 70, i: 2.8, ink: true, follow: () => f.host.casterPos(r.attackerId) });
      else if (st === 2) { for (const k of [-1, 1]) f.streak(chest(c, 92), { x: c.x + s * 200, y: c.y + k * 22, z: 92 + k * 6 }, F.red, { w: 5, ms: 120, draw: 30 }); }
      else f.slash(c, s, 0xb4a6ff, { r: 155, w: 52, tilt: 80, a0: 175, a1: 5, ms: 260, y0: 40, i: 2.8, ink: true, follow: () => f.host.casterPos(r.attackerId) });
    },
  },
  // seven cards fanned out: a fan of thin streaks from his hand, each card trailing light
  charged_deal: { tone: TONE.card,
    own: true, hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, F.card, { r: 70, ms: 220, a: 0.55 }); },
    trail: { c: F.card, w: 6, len: 7, i: 1.3 },
    active: (f, r) => { const c = me(f, r), s = side(r); for (let k = -2; k <= 2; k++) f.streak(chest(c, 92), { x: c.x + s * 190, y: c.y + k * 34, z: 92 + k * 6 }, k % 2 ? F.red : F.card, { w: 4, ms: 130, draw: 40 }); },
  },
  // the vault over the foe: an upright crescent of light along the staff's arc; the launch's column is the default main hit
  staff_vault: { tone: TONE.violet,
    own: true, hit: (f, _s, _h, at, main, react) => { if (main) { if (react === 'launch') f.pillar(at.x, at.y, F.violet, { h: 340, r: 22, ms: 360, core: false }); else f.dome(at.x, at.y, F.steel, { r: 70, ms: 220, a: 0.5 }); } },
    active: (f, r) => f.slash(me(f, r), side(r), F.violet, { r: 95, w: 18, tilt: 88, a0: 200, a1: -20, ms: 300, y0: 30, i: 1.2, follow: () => f.host.casterPos(r.attackerId) }),
  },
  // the staff slams a charged floor: cracks where it lands, then the fuse goes off — a burst of floor chunks and a short column
  fuse_slam: { tone: TONE.fuse,
    own: true,
    active: (f, r) => {
      const p = ahead(f, r, 70);
      f.later(T(r).active * 0.5, () => { f.crack(p.x, p.y, F.fuse, { r: 100, chunks: 6, ms: 900 }); f.host.kick(0.03); });
      f.later(800, () => { f.pillar(p.x, p.y, F.fuse, { h: 300, r: 40, ms: 360 }); f.debris(p.x, p.y, 12, { speed: 1.2, up: 1.5 }); f.host.embers(f.host.w3(p.x), 0.3, f.host.d3(p.y), F.ember, 14, 2.2); f.host.impact({ x: p.x, y: p.y, z: 20 }, 1); });
    },
  },
  // a whirl of cards round him (a tight one: it never hides the fight)
  riffle_shuffle: { tone: TONE.card, own: true, hit: (f, _s, _h, at, main, react) => { if (main) { if (react === 'launch') f.pillar(at.x, at.y, F.red, { h: 340, r: 24, ms: 380, core: false }); else f.dome(at.x, at.y, F.card, { r: 80, ms: 240, a: 0.55 }); } }, trail: { c: F.card, w: 8, len: 10 }, active: (f, r) => f.whirl(r.attackerId, F.card, { r: 120, ms: Math.min(400, T(r).active), rings: 1, every: 130, dir: side(r) }) },
  // the staff spun like a wheel in front of him: upright cuts turning, one after the other
  rotor_staff: { tone: TONE.violet,
    // (DAVID 18:23's bar, the scythe 07: a ball of cut rings at many angles round him, travelling with him, an ink ring behind each)
    own: true, hit: (f, _s, _h, at, main) => { if (main) f.impact({ x: at.x, y: at.y, z: 60 }, F.violet, { r: 70, embers: 10 }); },
    active: (f, r) => f.bladeBall(r.attackerId, F.violet, { r: 105, ms: Math.min(1500, T(r).active), every: 85, ink: true, y0: 40 }),
  },
  // the row of cards turned face up: a crest of light runs down the row along the floor, the last card the big burst
  showdown: { tone: TONE.card,
    own: true, hit: (f, _s, _h, at, main) => { if (main) { f.impact({ x: at.x, y: at.y, z: 60 }, F.red, { r: 70, embers: 12 }); } },
    active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y * 0.6, F.red, { len: 360, ms: 340, h: 50, w: 46 }); },
  },
  // the coin: a thin gold column rising where it lands
  coin_flip: { tone: TONE.coin, own: true, active: (f, r) => f.pillar(me(f, r).x, me(f, r).y, C.coin, { h: 420, r: 30, ms: 520, core: false }) },
  // the wheel: its result tears up a twisting column, the floor cracking gold round it
  roulette_wheel: { tone: TONE.neon, own: true,
    // (DAVID 18:23's bar: the wheel a spiral glyph turning under the foe for its 2 s; the result a ball of rings and the main hit)
    active: (f, r) => { const p = placeOf(f, r, 220); f.glyph(p.x, p.y, F.neon, { shape: 'spiral', r: 170, ms: Math.min(2300, T(r).active + 200), spin: 1.4, pulse: 0.4, a: 0.7 }); },
    hit: (f, _s, _h, at, main) => { if (main) { f.impact({ x: at.x, y: at.y, z: 50 }, F.neon, { r: 90, cracks: true, embers: 14 }); for (let k = 0; k < 5; k++) f.later(k * 70, () => f.slash({ x: at.x, y: at.y, z: 0 }, k % 2 ? 1 : -1, F.neon, { r: 95, w: 30, tilt: [15, 70, 40, 85, 25][k], yaw: [0, 60, -45, 30, -70][k], a0: -170, a1: 170, ms: 240, y0: 50, i: 1.3 })); } } },
  // the dice: each die bursts in a shell of light; the second (the sum) the bigger, the floor torn under it
  dice_bomb: { tone: TONE.neon,
    own: true,
    hit: (f, _s, _h, at, main) => { f.dome(at.x, at.y, C.dice, { r: main ? 170 : 90, ms: main ? 360 : 240, a: main ? 0.8 : 0.55 }); if (main) f.crack(at.x, at.y, C.fuchsia, { r: 110, chunks: 12 }); },
  },
  // the grab: a tether of lightning from his hand to the seized foe; the throw lands in a shell of light
  kinetic_grab: { tone: TONE.fuse,
    active: (f, r) => { const c = me(f, r), e = ahead(f, r, 120); f.bolt(chest(c, 92), { x: e.x, y: e.y, z: 85 }, F.fuse, { ms: 360, w: 8, forks: 2 }); },
    own: true, hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, F.fuse, { r: 80, ms: 240, a: 0.5 }); },
  },
  // the ace: a gold lance in flight, a gold shell and a thin fuchsia column where it blows up
  ace_in_the_hole: { tone: TONE.card, trail: { c: F.red, w: 10, i: 1.8 }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.impact({ x: at.x, y: at.y, z: 60 }, F.red, { r: 90, cracks: true, embers: 16 }); f.pillar(at.x, at.y, F.red, { h: 420, r: 24, ms: 380, core: false }); } } },
  // Lady Luck: a short rain of gold over him
  lady_luck: { tone: TONE.coin, own: true, active: (f, r) => { const c = me(f, r); f.rain(c.x, c.y, 80, C.coin, { n: 10, ms: 420, h: 420 }); } },
  // Pick-up 52: the deck thrown up comes down — a rain of fuchsia over the area ahead
  pickup_52: { tone: TONE.card, own: true, hit: (f, _s, _h, at, main) => { if (main) f.impact({ x: at.x, y: at.y, z: 40 }, F.red, { r: 90, cracks: true, embers: 14 }); },
    active: (f, r) => {
      const p = ahead(f, r, 160); f.rain(p.x, p.y, 150, F.red, { n: 16, ms: 700, h: 560 });
      // the deck sprayed out: real cards stuck in the planks, near to far; each wave rips its own up (they crumble on its beat)
      const c = me(f, r), base = Math.atan2(r.aim.y, r.aim.x), N = 20;
      for (let k = 0; k < N; k++) {
        const q = k / N, d = 85 + q * 360, a = base + Math.sin(q * Math.PI * 3) * 0.55, wave = Math.min(3, Math.floor((d - 85) / 95));
        f.cardLay(`p52-${r.castId}-${k}`, { x: c.x, y: c.y, z: 70 }, { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.6 }, { stuck: true, ms: 110 + q * 120, delay: q * 240, life: 250 + wave * 150 - q * 240 });
      }
    } },
  // the home run: a crater where the bat of light lands, a shell, the camera pushed
  grand_slam: { tone: TONE.violet, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, F.violet, { r: 160, chunks: 18, up: 1.3 }); f.host.kick(0.05); } } },
  // Overload: lightning crawls round his feet
  kinetic_overload: { tone: TONE.fuse,
    own: true,
    active: (f, r) => { for (let k = 0; k < 4; k++) f.later(k * 90, () => { const c = me(f, r), a = (k / 4) * Math.PI * 2; f.bolt({ x: c.x + Math.cos(a) * 70, y: c.y + Math.sin(a) * 40, z: 6 }, { x: c.x + Math.cos(a + 1.6) * 70, y: c.y + Math.sin(a + 1.6) * 40, z: 6 }, F.fuse, { ms: 200, w: 6, forks: 1 }); }); },
  },
  // Card Swap: he flashes to his card in a streak of light
  card_swap: { tone: TONE.card, own: true, active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.7, () => { const e = me(f, r); f.streak(chest(c), chest(e), F.card, { w: 18, ms: 300, draw: 40 }); }); } },
  // Call the Deck: his cards fly home (the scene's cardGather), the big card rides the throw spinning like a saw, then
  // spins under the held foe turn after turn; the last turn throws him up and the card flares out
  call_the_deck: {
    tone: TONE.card, own: true,
    shot: (f, p) => f.cardSpin(() => (p.done ? null : { x: p.x, y: p.y, z: p.z + 62 }), { size: 2.4, color: F.red }),
    tick: (f, r, at, i, last) => {
      const key = r.castId;
      if (i === 0) { // the card under him: it follows him until the last turn (or the hold ends)
        HOLD.set(key, { at, end: false, seen: 0 });
        f.cardSpin(() => { const h = HOLD.get(key); if (!h || h.end || ++h.seen > 30) { HOLD.delete(key); return null; } return { x: h.at.x, y: h.at.y, z: Math.max(8, h.at.z - 52) }; }, { size: 1.6, color: 0x6a1020, rps: 2.2, tilt: 0.95, look: { face: 'gbk-card_back' } });
      }
      const h = HOLD.get(key); if (h) { h.at = at; h.seen = 0; if (last) h.end = true; }
      if (last) { f.dome(at.x, at.y, F.red, { r: 60, ms: 240, a: 0.35 }); f.host.kick(0.03); }
    },
    hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, F.card, { r: 55, ms: 220, a: 0.3 }); },
  },
  // the jackpot (DAVID 18:23's bar, the gothic ult 09): coins and chips gather round him while the reels roll → a gold star
  // glyph opens on the floor under him → a ring runs out → the last blast is the big burst → a dome of gold over the area
  jackpot: { tone: TONE.coin, own: true,
    cast: (f, r) => { const id = r.attackerId; f.swirl(() => { const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; }, { tex: 'gbk-c_coin_h', size: 0.5, aspect: 1, crumble: C.coin }, { n: 16, r0: 70, r1: 150, h: 260, ms: T(r).startup, rps: 0.9, rise: 0.5, color: C.coin }); },
    active: (f, r) => { const c = me(f, r); f.glyph(c.x, c.y, C.coin, { shape: 'star', points: 8, r: 260, ms: T(r).active + 500, spin: 0.25, pulse: 0.6, a: 0.75 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.coin, 3.2, 600, 0.7); },
    hit: (f, _s, _h, at, main) => {
      if (!main) return;
      f.impact({ x: at.x, y: at.y, z: 40 }, C.coin, { r: 120, cracks: true, embers: 24 });
      f.dome(at.x, at.y, C.coin, { r: 300, ms: 700, a: 0.22 }); f.host.kick(0.07);
    } },
  // All In: every stuck card goes off — a crater and a gold column out of it
  all_in: { tone: TONE.neon, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, F.neon, { r: 150, chunks: 18 }); f.pillar(at.x, at.y, F.neon, { h: 600, r: 32, ms: 480, i: 1.4, core: false }); } } },
  // Triple Down: three slams — the cracks grow with each, the third the widest
  triple_down: { tone: TONE.violet, own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam' || react === 'knockdown') f.crack(at.x, at.y, F.violet, { r: main ? 150 : 95, chunks: main ? 16 : 7 }); } },
};
