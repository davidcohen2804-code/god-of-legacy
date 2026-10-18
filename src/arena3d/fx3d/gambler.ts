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

/** Light Staff (David 18 Oct 01:42): whose cane is lit, until when (the page's clock — a look only; the reach is the scene's). */
const LIT = new Map<string, number>();
/** The last guard raised (its catch's line runs from him). */
let GUARD = '';
/** 52 Pickup's cards in the planks (by wave) and the waves gone off so far. */
let P52: { keys: { key: string; w: number }[]; wave: number } | null = null;
const lit = (r: { attackerId: string }) => (LIT.get(r.attackerId) ?? 0) > performance.now();
/** A staff blow's ring: ×1.6 and a thin outer edge of violet light while his cane is lit (its blade of light reaches that far). */
const staffRing = (f: Parameters<NonNullable<Recipe['active']>>[0], r: { attackerId: string }, at: { x: number; y: number; z: number }, dir: number, color: number, o: Parameters<Parameters<NonNullable<Recipe['active']>>[0]['slash']>[3] & {}) => {
  if (!lit(r)) { f.slash(at, dir, color, o); return; }
  const k = 1.6, R = (o.r ?? 120) * k;
  f.slash(at, dir, color, { ...o, r: R });
  f.slash(at, dir, 0xe4dcff, { ...o, r: R + 14, w: 8, i: 3, ink: false, quiet: true });
};

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
      if (st === 0) { f.streak(chest(c, 95), { x: c.x + s * 170, y: c.y, z: 95 }, F.steel, { w: 14, ms: 140, draw: 25 }); staffRing(f, r, c, s, 0xb4a6ff, { r: 100, w: 30, tilt: 6, a0: -40, a1: 40, ms: 160, y0: 70, i: 2.2, ink: true }); }
      else if (st === 1) staffRing(f, r, c, s, 0xb4a6ff, { r: 125, w: 50, tilt: 50, a0: -50, a1: 150, ms: 230, y0: 70, i: 2.8, ink: true, follow: () => f.host.casterPos(r.attackerId) });
      else if (st === 2) { for (const k of [-1, 1]) f.streak(chest(c, 92), { x: c.x + s * 200, y: c.y + k * 22, z: 92 + k * 6 }, F.red, { w: 5, ms: 120, draw: 30 }); }
      else staffRing(f, r, c, s, 0xb4a6ff, { r: 155, w: 52, tilt: 80, a0: 175, a1: 5, ms: 260, y0: 40, i: 2.8, ink: true, follow: () => f.host.casterPos(r.attackerId) });
    },
  },
  // seven cards fanned out: a fan of thin streaks from his hand, each card trailing light
  charged_deal: { tone: TONE.card,
    // (David 01:42: "unprofessional, fast" — now it lands with weight: the throw one inked red arc cut out of his hand, each card
    // a real 3D card spinning on its flight with a red glow and a short trail, each card that strikes him a small red star of
    // crossing card lines; the main hit's flash is the engine's)
    own: true,
    trail: { c: F.red, w: 7, len: 9, i: 1.4 },
    shot: (f, p) => f.cardSpin(() => (p.done ? null : { x: p.x, y: p.y, z: p.z + 62 }), { size: 0.95, color: F.red, rps: 6, tilt: 0.8 }),
    active: (f, r) => { const c = me(f, r), s = side(r); f.slash(c, s, F.red, { r: 95, w: 40, tilt: 55, a0: -10, a1: 130, ms: 200, y0: 80, i: 2.4, ink: true }); f.host.kick(0.02); },
    hit: (f, _s, _h, at) => f.flurry({ x: at.x, y: at.y, z: at.z + 70 }, F.red, { ms: 80, every: 40, len: 150, w: 5, accent: 0, spread: 8 }),
  },
  // the vault over the foe: an upright crescent of light along the staff's arc; the launch's column is the default main hit
  staff_vault: { tone: TONE.violet,
    // (DAVID 20:56: the vault over the foe one big upright inked crescent riding his arc — white-hot edge, violet, ink — and
    // the landing blow a slanted ring cut down on him; the main hit's flash is the engine's)
    own: true,
    active: (f, r) => {
      const id = r.attackerId;
      staffRing(f, r, me(f, r), side(r), 0xb4a6ff, { r: 120, w: 44, tilt: 86, a0: 210, a1: -30, ms: Math.max(320, T(r).active), y0: 40, i: 2.6, ink: true, follow: () => f.host.casterPos(id) });
      f.later(Math.max(0, T(r).active - 90), () => staffRing(f, r, me(f, r), side(r), 0xb4a6ff, { r: 130, w: 50, tilt: 58, a0: -150, a1: 40, ms: 220, y0: 80, i: 2.8, ink: true }));
    },
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
    // (DAVID 20:56: the card family's star — each card turned over cuts a red-and-white star of crossing card lines through
    // him; the last card's star the big one, one inked ring cut across it; the main hit's flash is the engine's)
    own: true,
    hit: (f, _s, _h, at, main) => {
      const c = { x: at.x, y: at.y, z: at.z + 70 };
      if (!main) { f.flurry(c, F.red, { ms: 110, every: 36, len: 170, w: 5, accent: 0, spread: 10 }); return; }
      f.flurry(c, F.red, { ms: 220, every: 36, len: 300, w: 7, accent: 3, spread: 14 });
      f.slash({ x: at.x, y: at.y, z: 0 }, 1, F.red, { r: 120, w: 40, tilt: 35, a0: -160, a1: 160, ms: 260, y0: 70, i: 2.4, ink: true });
    },
    active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y * 0.6, F.red, { len: 360, ms: 340, h: 40, w: 36 }); },
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
  // G — Light Staff (David 18 Oct 01:42): a thin violet blade of light slides up out of the cane in his hand; for 8 s his cane
  // is lit — violet motes stream off his hand and every staff blow's ring is drawn as long as the blade reaches (staffRing)
  light_staff: { tone: TONE.violet, own: true,
    cast: (f, r) => { const c = me(f, r), s = side(r); f.streak({ x: c.x + s * 26, y: c.y, z: 70 }, { x: c.x + s * 70, y: c.y, z: 250 }, 0xe4dcff, { w: 8, ms: Math.max(380, T(r).startup + 200), draw: Math.max(120, T(r).startup) }); },
    active: (f, r) => {
      const id = r.attackerId, until = performance.now() + 8000; LIT.set(id, until);
      const c0 = me(f, r); f.host.ring(f.host.w3(c0.x), f.host.d3(c0.y), F.violet, 1.6, 420, 0.6);
      for (let t = 0; t < 8000; t += 260) f.later(t, () => { if ((LIT.get(id) ?? 0) !== until) return; const c = f.host.casterPos(id); if (c) f.host.embers(f.host.w3(c.x), f.host.h3(c.z + 80), f.host.d3(c.y), 0xb4a6ff, 2, 1.2); });
    } },
  // V — Long Guard: held, a ward of six cards turning upright round him and a ring of runes at his feet; a catch snaps a line of
  // cards out to the striker (its hit 0) and binds him in a red star
  long_guard: { tone: TONE.card, own: true,
    active: (f, r) => {
      const id = r.attackerId, ms = Math.min(2600, T(r).active); GUARD = id;
      f.swirl(() => { const run = f.host.casterPos(id); return run ? { x: run.x, y: run.y, z: 0 } : null; }, { tex: 'gbk-card_back', size: 0.9, aspect: 1.45, crumble: F.red }, { n: 6, r0: 70, r1: 70, h: 120, ms, rps: 0.7, rise: 0, color: F.red });
      const c = me(f, r); f.glyph(c.x, c.y, F.red, { shape: 'runes', r: 90, ms, spin: 0.6, pulse: 0.5, a: 0.6 });
    },
    hit: (f, _s, _h, at) => { const c = (GUARD ? f.host.casterPos(GUARD) : null) ?? at; f.streak({ x: c.x, y: c.y, z: 80 }, { x: at.x, y: at.y, z: at.z + 70 }, F.red, { w: 10, ms: 220, draw: 40 }); f.flurry({ x: at.x, y: at.y, z: at.z + 70 }, F.red, { ms: 180, every: 36, len: 220, w: 6, accent: 0, spread: 10 }); } },
  // Z — Staff Flurry (only with the light staff): 3 s of the lit cane's blows — long crossing violet lines through the space in
  // front of him, every 5th a heavy accent; the last blow one big upright ring that throws him
  staff_flurry: { tone: TONE.violet, own: true,
    active: (f, r) => {
      const id = r.attackerId, s = side(r), ms = Math.min(3000, T(r).active);
      f.flurry(() => { const c = f.host.casterPos(id); return c ? { x: c.x + s * 120, y: c.y, z: 75 } : null; }, 0xb4a6ff, { ms: ms - 150, every: 55, len: 300, w: 7, accent: 5, spread: 40 });
      f.later(ms - 120, () => staffRing(f, r, me(f, r), s, 0xb4a6ff, { r: 150, w: 54, tilt: 82, a0: 175, a1: 5, ms: 260, y0: 40, i: 2.8, ink: true, follow: () => f.host.casterPos(id) }));
    } },
  kinetic_grab: { tone: TONE.fuse,
    active: (f, r) => { const c = me(f, r), e = ahead(f, r, 120); f.bolt(chest(c, 92), { x: e.x, y: e.y, z: 85 }, F.fuse, { ms: 360, w: 8, forks: 2 }); },
    own: true, hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, F.fuse, { r: 80, ms: 240, a: 0.5 }); },
  },
  // the ace: a gold lance in flight, a gold shell and a thin fuchsia column where it blows up
  ace_in_the_hole: { tone: TONE.card, trail: { c: F.red, w: 10, i: 1.8 }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.impact({ x: at.x, y: at.y, z: 60 }, F.red, { r: 90, cracks: true, embers: 16 }); f.pillar(at.x, at.y, F.red, { h: 420, r: 24, ms: 380, core: false }); } } },
  // Lady Luck: a short rain of gold over him
  lady_luck: { tone: TONE.coin, own: true, active: (f, r) => { const c = me(f, r); f.rain(c.x, c.y, 80, C.coin, { n: 10, ms: 420, h: 420 }); } },
  // Pick-up 52: the deck thrown up comes down — a rain of fuchsia over the area ahead
  pickup_52: { tone: TONE.card, own: true,
    // (David 01:42: "the final after-effect is weak, disconnected") — the deck lies stuck in the planks as real cards; each wave
    // rips its own band up; the last wave calls every card left in one swoop to a point over the foe, where they go off together:
    // a red star of crossing card lines, a flat inked ring and a star glyph on the floor (the main hit's flash is the engine's)
    hit: (f, _s, _h, at, main) => {
      const st = P52; if (!st) return;
      if (!main) { st.wave++; for (const k of st.keys.filter((x) => x.w === st.wave - 1)) f.cardDrop(k.key); return; }
      const left = st.keys.filter((x) => x.w >= st.wave).map((x) => x.key), p = { x: at.x, y: at.y, z: at.z + 90 };
      if (left.length) f.cardGather(left, () => p, { ms: 160, gap: 8 });
      f.later(170, () => {
        f.flurry(p, F.red, { ms: 260, every: 34, len: 360, w: 8, accent: 3, spread: 16 });
        f.slash({ x: at.x, y: at.y, z: 0 }, 1, F.red, { r: 190, w: 54, tilt: 8, a0: -180, a1: 180, ms: 320, y0: 20, i: 2.6, ink: true });
        f.glyph(at.x, at.y, F.red, { shape: 'star', points: 6, r: 170, ms: 700, spin: 1.2, pulse: 0.3, a: 0.7 });
        f.host.kick(0.05);
      });
      P52 = null;
    },
    active: (f, r) => {
      const p = ahead(f, r, 160); f.rain(p.x, p.y, 150, F.red, { n: 12, ms: 600, h: 560 });
      const c = me(f, r), base = Math.atan2(r.aim.y, r.aim.x), N = 20, keys: { key: string; w: number }[] = [];
      for (let k = 0; k < N; k++) {
        const q = k / N, d = 85 + q * 360, a = base + Math.sin(q * Math.PI * 3) * 0.55, w = Math.min(3, Math.floor((d - 85) / 95)), key = `p52-${r.castId}-${k}`;
        keys.push({ key, w });
        f.cardLay(key, { x: c.x, y: c.y, z: 70 }, { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.6 }, { stuck: true, ms: 110 + q * 120, delay: q * 240, life: 2400 });
      }
      P52 = { keys, wave: 0 };
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
        f.cardSpin(() => { const h = HOLD.get(key); if (!h || h.end || ++h.seen > 30) { HOLD.delete(key); return null; } return { x: h.at.x, y: h.at.y, z: Math.max(6, h.at.z - 46) }; }, { size: 1.9, color: 0x6a1020, rps: 2.2, tilt: 0.3, look: { face: 'gbk-card_back' } });
      }
      const h = HOLD.get(key); if (h) { h.at = at; h.seen = 0; if (last) h.end = true; }
      if (last) { f.flurry({ x: at.x, y: at.y, z: at.z + 30 }, F.red, { ms: 140, every: 35, len: 220, w: 6, accent: 0, spread: 10 }); f.host.kick(0.03); }
    },
  },
  // the jackpot (DAVID 18:23's bar, the gothic ult 09): coins and chips gather round him while the reels roll → a gold star
  // glyph opens on the floor under him → a ring runs out → the last blast is the big burst → a dome of gold over the area
  jackpot: { tone: TONE.coin, own: true,
    cast: (f, r) => { const id = r.attackerId; f.swirl(() => { const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; }, { tex: 'gbk-c_coin_h', size: 0.5, aspect: 1, crumble: C.coin }, { n: 16, r0: 70, r1: 150, h: 260, ms: T(r).startup, rps: 0.9, rise: 0.5, color: C.coin }); },
    active: (f, r) => { const c = me(f, r); f.glyph(c.x, c.y, C.coin, { shape: 'star', points: 8, r: 260, ms: T(r).active + 500, spin: 0.25, pulse: 0.6, a: 0.75 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.coin, 3.2, 600, 0.7); },
    hit: (f, _s, _h, at, main) => {
      if (!main) return;
      // (the big burst's flash is the engine's main hit; here the gold dome closing over the area and a ring of coin cuts)
      f.dome(at.x, at.y, C.coin, { r: 300, ms: 700, a: 0.22 }); f.host.kick(0.07);
      f.slash({ x: at.x, y: at.y, z: 0 }, 1, C.coin, { r: 220, w: 50, tilt: 10, a0: -180, a1: 180, ms: 320, y0: 30, i: 2.4, ink: true });
    } },
  // All In: every stuck card goes off — a crater and a gold column out of it
  all_in: { tone: TONE.neon, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, F.neon, { r: 150, chunks: 18 }); f.pillar(at.x, at.y, F.neon, { h: 600, r: 32, ms: 480, i: 1.4, core: false }); } } },
  // Triple Down: three slams — the cracks grow with each, the third the widest
  triple_down: { tone: TONE.violet, own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam' || react === 'knockdown') f.crack(at.x, at.y, F.violet, { r: main ? 150 : 95, chunks: main ? 16 : 7 }); } },
};
