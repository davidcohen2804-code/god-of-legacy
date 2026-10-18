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
let GUARD = '', GUARD_END = false;
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

/** His painted sheets (David 18 Oct 20:51: painted art, real colour, motion): 4×4 GPT sheets on black, played through flip. */
const ART = 'assets/final/skills/gambler/fx3d/';
const SHEET = { cardBurst: ART + 'card_burst.webp', coinBurst: ART + 'coin_burst.webp', staffArc: ART + 'staff_arc.webp', fuseBlast: ART + 'fuse_blast.webp', roulette: ART + 'roulette_sigil.webp', staffHit: ART + 'staff_hit.webp', cardWard: ART + 'card_ward.webp', cardSigil: ART + 'card_sigil.webp' };
type FX = Parameters<NonNullable<Recipe['active']>>[0];
/** The cards' painted burst: a white-hot flash, crimson energy flinging glowing cards, red smoke thinning out. `big` the
 *  whole sheet (a main hit), else its first, hottest frames, small (a card that strikes). */
const cardBurst = (f: FX, at: { x: number; y: number; z: number }, big: boolean, w = big ? 300 : 130) =>
  f.flip(SHEET.cardBurst, at, big ? { grid: [4, 4], w, fps: 22, glow: 0.35, through: 0.6, rot: Math.random() * 40 - 20, flipX: Math.random() < 0.5 }
    : { grid: [4, 4], from: 1, to: 9, w, fps: 30, glow: 0.25, through: 0.55, rot: Math.random() * 60 - 30, flipX: Math.random() < 0.5, fadeOut: 90 });

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
    // (David 20:51, painted pass: each card that strikes him bursts in the painted crimson card burst's hottest frames)
    cast: (f) => f.flipLoad(SHEET.cardBurst),
    hit: (f, _s, _h, at) => { cardBurst(f, { x: at.x, y: at.y, z: at.z + 70 }, false, 150); },
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
    // (David 20:51, painted pass: the fuse's eruption a painted explosion — a white-hot spark, orange fire mushrooming up off
    // the planks with crackling arcs, burnt cards and dice flung out, a dust ring, collapsing into charcoal smoke — out of the
    // crack he left; the added-light column and flash are gone; the crack, debris and embers stay as its frame)
    own: true,
    cast: (f) => f.flipLoad(SHEET.fuseBlast),
    active: (f, r) => {
      const p = ahead(f, r, 70);
      f.later(T(r).active * 0.5, () => { f.crack(p.x, p.y, F.fuse, { r: 100, chunks: 6, ms: 900 }); f.host.kick(0.03); });
      f.later(800, () => {
        f.flip(SHEET.fuseBlast, { x: p.x, y: p.y, z: 0 }, { grid: [4, 4], w: 360, anchorY: 0.16, fps: 24, through: 0.55, glow: 0.25, flipX: Math.random() < 0.5 });
        f.debris(p.x, p.y, 12, { speed: 1.2, up: 1.5 }); f.host.embers(f.host.w3(p.x), 0.3, f.host.d3(p.y), F.ember, 14, 2.2); f.host.kick(0.05);
      });
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
    // (David 20:51, painted pass: each card's strike its own small painted burst of crimson and flung cards; the last card's
    // the whole painted explosion — white-hot core, cards flung out, red smoke thinning — over the inked ring; noImpact: the
    // painted burst is the main hit)
    own: true, noImpact: true,
    cast: (f) => f.flipLoad(SHEET.cardBurst),
    hit: (f, _s, _h, at, main) => {
      const c = { x: at.x, y: at.y, z: at.z + 70 };
      if (!main) { cardBurst(f, c, false); f.flurry(c, F.red, { ms: 80, every: 40, len: 130, w: 4, accent: 0, spread: 8 }); return; }
      cardBurst(f, { x: at.x, y: at.y, z: at.z + 80 }, true);
      f.slash({ x: at.x, y: at.y, z: 0 }, 1, F.red, { r: 120, w: 40, tilt: 35, a0: -160, a1: 160, ms: 260, y0: 70, i: 2.4, ink: true });
      f.host.kick(0.04);
    },
    active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y * 0.6, F.red, { len: 360, ms: 340, h: 40, w: 36 }); },
  },
  // the coin: a thin gold column rising where it lands
  coin_flip: { tone: TONE.coin, own: true, active: (f, r) => f.pillar(me(f, r).x, me(f, r).y, C.coin, { h: 420, r: 30, ms: 520, core: false }) },
  // the wheel: its result tears up a twisting column, the floor cracking gold round it
  roulette_wheel: { tone: TONE.neon, own: true,
    // (DAVID 18:23's bar: the wheel a spiral glyph turning under the foe for its 2 s; the result a ball of rings and the main hit)
    // (David 20:51, painted pass: the wheel a painted neon roulette sigil flat on the planks — a hot-pink ring drawing in, the
    // full wheel of magenta pockets, gold spokes and suit runes turning under the foe for its 2 s, then flaring and breaking
    // into magenta motes)
    cast: (f) => f.flipLoad(SHEET.roulette),
    active: (f, r) => {
      const p = placeOf(f, r, 220), all = Math.min(2300, T(r).active + 200), inMs = 250, outMs = 350, hold = Math.max(300, all - inMs - outMs), spin = 70;
      const o = { grid: [4, 4] as [number, number], w: 360, mode: 'floor' as const, spin, glow: 0.25 };
      f.flip(SHEET.roulette, p, { ...o, from: 0, to: 3, fps: 16, fadeOut: 0 });
      f.flip(SHEET.roulette, p, { ...o, from: 4, to: 8, fps: 10, loop: true, ms: hold + 60, delay: inMs, rot: spin * inMs / 1000, fadeIn: 1, fadeOut: 60 });
      f.flip(SHEET.roulette, p, { ...o, from: 9, to: 15, fps: 20, delay: inMs + hold, rot: spin * (inMs + hold) / 1000, fadeIn: 1, fadeOut: 120 });
    },
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
    // (David 18 Oct 18:40: "doesn't come across") — read from across the field: a red shell of light round him for as long as
    // he holds it, eight big cards turning upright in a ring at his chest, a rune ring at his feet; the catch a big moment —
    // a white flash along the guard, the cards snapping out in a line to the striker, the striker held in a ring of cards
    // (David 20:51, painted pass: the guard a painted card ward — glowing cards flying in and locking edge to edge into an
    // upright crimson-and-violet oval with a rune lattice, shimmering for as long as he holds it, shattering outward into
    // flung cards and shards when it ends or is struck; he reads through its middle. It replaces the added-light shell and the
    // ring of cards; the runes at his feet stay as its frame)
    cast: (f) => f.flipLoad(SHEET.cardWard),
    active: (f, r) => {
      const id = r.attackerId, ms = Math.min(2600, T(r).active), s = side(r); GUARD = id; GUARD_END = false;
      let gone = false;
      const front = (run: { x: number; y: number }) => ({ x: run.x + s * 26, y: run.y + 4, z: 84 });
      const at = () => {
        const over = (GUARD_END && GUARD === id) || r.phase !== 'active', run = f.host.casterPos(id);
        if (over && !gone && run) { gone = true; f.flip(SHEET.cardWard, front(run), { grid: [4, 4], from: 11, to: 15, w: 230, fps: 18, glow: 0.25, through: 0.6, fadeIn: 1, fadeOut: 80 }); } // (the ward shatters: released, or struck)
        return over || !run ? null : front(run);
      };
      const o = { grid: [4, 4] as [number, number], w: 210, glow: 0.2, through: 0.6 };
      f.flip(SHEET.cardWard, at, { ...o, from: 0, to: 2, fps: 14, fadeOut: 0 });
      f.flip(SHEET.cardWard, at, { ...o, from: 3, to: 10, fps: 9, loop: true, ms: ms + 100, delay: 210, fadeIn: 1, fadeOut: 40 });
      const c = me(f, r); f.glyph(c.x, c.y, F.red, { shape: 'runes', r: 110, ms, spin: 0.6, pulse: 0.5, a: 0.75 });
    },
    hit: (f, _s, _h, at) => {
      const c = (GUARD ? f.host.casterPos(GUARD) : null) ?? at; GUARD_END = true;
      f.slash({ x: c.x, y: c.y, z: 0 }, at.x >= c.x ? 1 : -1, 0xffffff, { r: 70, w: 30, tilt: 80, a0: -40, a1: 40, ms: 160, y0: 70, i: 3, ink: false }); // the flash along the guard
      for (let k = 0; k < 4; k++) f.later(k * 35, () => f.streak({ x: c.x, y: c.y + (k - 1.5) * 10, z: 80 + (k % 2) * 16 }, { x: at.x, y: at.y + (k - 1.5) * 8, z: at.z + 60 + (k % 2) * 20 }, k % 2 ? F.card : F.red, { w: 7, ms: 220, draw: 40 }));
      const held = { x: at.x, y: at.y, z: at.z }; let n = 0;
      f.later(140, () => f.swirl(() => (++n > 72 ? null : { x: held.x, y: held.y, z: Math.max(0, held.z) }), { tex: 'gbk-card_back', size: 0.75, aspect: 1.45, crumble: F.red }, { n: 6, r0: 46, r1: 52, h: 120, ms: 1200, rps: 0.9, rise: 0, color: F.red }));
      f.host.kick(0.04);
    } },
  // Z — Staff Flurry (only with the light staff): 3 s of the lit cane's blows — long crossing violet lines through the space in
  // front of him, every 5th a heavy accent; the last blow one big upright ring that throws him
  staff_flurry: { tone: TONE.violet, own: true,
    // (David 18 Oct 18:40: "make it beautiful and impressive — the light is already there") the lit staff at work: every jab a
    // long violet thrust line, every spin a wheel of light round him (an upright inked ring turning), crossing arcs between,
    // sparks on every hit, the fifth blows flaring; the closing rising swing one great violet arc
    active: (f, r) => {
      const id = r.attackerId, s = side(r), ms = Math.min(3000, T(r).active), here = () => f.host.casterPos(id);
      for (let t = 0, k = 0; t < ms - 200; t += 110, k++) f.later(t, () => {
        const c = here(); if (!c) return;
        if (k % 4 === 3) { // a spin: a wheel of light round him
          f.slash(c, s, 0xb4a6ff, { r: 120, w: 40, tilt: 88, a0: -180, a1: 180, ms: 220, y0: 70, i: 2.4, ink: true, follow: here, quiet: true });
        } else if (k % 2 === 0) { // a jab: a long thrust line out of his hands
          f.streak({ x: c.x + s * 30, y: c.y, z: 80 + (k % 3) * 8 }, { x: c.x + s * 240, y: c.y + (k % 3 - 1) * 10, z: 80 + (k % 3) * 8 }, 0xe8e0ff, { w: k % 5 === 4 ? 14 : 8, ms: 120, draw: 20, front: true, quiet: true });
        } else { // a short slanted arc in front
          f.slash(c, s, 0xb4a6ff, { r: 150, w: 34, tilt: 30 + (k % 3) * 20, a0: -60, a1: 80, ms: 160, y0: 70, i: 2.2, ink: true, quiet: true });
        }
      });
      f.later(ms - 160, () => staffRing(f, r, me(f, r), s, 0xb4a6ff, { r: 170, w: 60, tilt: 82, a0: 175, a1: 5, ms: 300, y0: 40, i: 3, ink: true, follow: here }));
    },
    // (David 20:51, painted pass: every blow that lands a painted violet strike — a white-hot star, crossing blade-light,
    // shattered crystal shards and card glints, indigo wisps — small and quick on the jabs, the whole sheet on the big ones)
    cast: (f) => f.flipLoad(SHEET.staffHit),
    hit: (f, _s, h, at) => {
      const big = h.damage >= 5, p = { x: at.x + (Math.random() - 0.5) * 30, y: at.y, z: at.z + 70 + (Math.random() - 0.5) * 30 };
      f.flip(SHEET.staffHit, p, big ? { grid: [4, 4], from: 1, to: 11, w: 175, fps: 30, glow: 0.2, through: 0.5, rot: Math.random() * 90 }
        : { grid: [4, 4], from: 1, to: 7, w: 100, fps: 34, glow: 0.15, through: 0.5, rot: Math.random() * 90, fadeOut: 60 });
      if (big) f.host.embers(f.host.w3(at.x), f.host.h3(at.z + 70), f.host.d3(at.y), 0xb4a6ff, 6, 1.6);
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
  pickup_52: { tone: TONE.card, own: true, cast: (f) => f.flipLoad(SHEET.cardBurst),
    // (David 01:42: "the final after-effect is weak, disconnected") — the deck lies stuck in the planks as real cards; each wave
    // rips its own band up; the last wave calls every card left in one swoop to a point over the foe, where they go off together:
    // a red star of crossing card lines, a flat inked ring and a star glyph on the floor (the main hit's flash is the engine's)
    hit: (f, _s, _h, at, main) => {
      const st = P52; if (!st) return;
      if (!main) { st.wave++; for (const k of st.keys.filter((x) => x.w === st.wave - 1)) f.cardDrop(k.key); return; }
      const left = st.keys.filter((x) => x.w >= st.wave).map((x) => x.key), p = { x: at.x, y: at.y, z: at.z + 90 };
      if (left.length) f.cardGather(left, () => p, { ms: 160, gap: 8 });
      f.later(170, () => {
        cardBurst(f, p, true, 360); // (David 20:51, painted pass: the gathered deck goes off as the painted card explosion)
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
  grand_slam: { tone: TONE.violet, own: true, noImpact: true,
    // (David 18 Oct 18:40: a golfer's stroke) the full swing one huge inked arc from low behind him up through the ball to high
    // in front (the lit staff's reach), the crack where he struck it; the flight's trail and the crash are drawn on the foe (2D)
    // (David 20:51, painted pass: the stroke itself a painted violet crescent — white-hot cutting edge, saturated violet body,
    // indigo trailing edge, card motes flung off it — sweeping from low behind him up through the ball to high in front, over
    // the code arc that keeps its line; ×1.4 while his cane is lit)
    cast: (f, r) => {
      f.flipLoad(SHEET.staffArc); f.flipLoad(SHEET.staffHit);
      // (the painted stroke sweeps up to the strike: its crescent at full sweep as the staff meets the ball)
      f.later(Math.max(0, T(r).startup - 160), () => { const c = me(f, r), s = side(r), L = lit(r) ? 1.4 : 1;
        f.flip(SHEET.staffArc, { x: c.x + s * 46, y: c.y, z: 120 }, { grid: [4, 4], from: 2, w: 300 * L, fps: 30, rot: -s * 18, flipX: s < 0, through: 0.5, glow: 0.15 }); });
    },
    active: (f, r) => { const c = me(f, r), s = side(r); staffRing(f, r, c, s, 0xb4a6ff, { r: 170, w: 40, tilt: 74, a0: -150, a1: 160, ms: 300, y0: 60, i: 1.8, ink: true }); }, // (the follow-through's inked line)
    // (DFO review 22:05: the strike was a white-out — the room's flash under a burst; now one: its own painted violet strike,
    // noImpact — a white-hot star, crossing blade-light, crystal shards, indigo wisps — on the ball as it is struck)
    hit: (f, _s, _h, at, main) => { if (main) { f.flip(SHEET.staffHit, { x: at.x, y: at.y, z: at.z + 75 }, { grid: [4, 4], w: 280, fps: 26, glow: 0.2, through: 0.55, rot: Math.random() * 60 }); f.crack(at.x, at.y, F.violet, { r: 120, chunks: 12, up: 1.2 }); f.host.kick(0.05); } } },
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
    cast: (f) => f.flipLoad(SHEET.cardSigil),
    shot: (f, p) => f.cardSpin(() => (p.done ? null : { x: p.x, y: p.y, z: p.z + 62 }), { size: 2.4, color: F.red }),
    tick: (f, r, at, i, last) => {
      const key = r.castId;
      if (i === 0) { // the card under him: it follows him until the last turn (or the hold ends)
        HOLD.set(key, { at, end: false, seen: 0 });
        f.cardSpin(() => { const h = HOLD.get(key); if (!h || h.end || ++h.seen > 30) { HOLD.delete(key); return null; } return { x: h.at.x, y: h.at.y, z: 40 }; }, { size: 1.9, color: 0x6a1020, rps: 2.2, tilt: 0.3, look: { face: 'gbk-card_back' } });
        // (DFO review 22:05: the red ring and beams were red on the red planks) a painted card sigil flat on the planks under him
        // for the whole hold — a gold ring drawing in, the four-suit star, cards round its rim, violet runes, turning — flaring
        // gold and breaking into motes and ink flakes when it lets him go
        let out = false, lastAt = { x: at.x, y: at.y, z: 0 };
        const floor = () => { const h = HOLD.get(key); if (h && !h.end) { lastAt = { x: h.at.x, y: h.at.y, z: 0 }; return lastAt; }
          if (!out) { out = true; f.flip(SHEET.cardSigil, lastAt, { grid: [4, 4], from: 11, to: 15, w: 230, mode: 'floor', spin: 40, fps: 18, glow: 0.3, fadeIn: 1, fadeOut: 100 }); }
          return null; };
        const o = { grid: [4, 4] as [number, number], w: 210, mode: 'floor' as const, spin: 40, glow: 0.25 };
        f.flip(SHEET.cardSigil, floor, { ...o, from: 0, to: 3, fps: 16, fadeOut: 0 });
        f.flip(SHEET.cardSigil, floor, { ...o, from: 4, to: 10, fps: 9, loop: true, ms: 6000, delay: 250, rot: 10, fadeIn: 1, fadeOut: 40 });
      }
      const h = HOLD.get(key); if (h) { h.at = at; h.seen = 0; if (last) h.end = true; }
      // (David 18:40: a clear gap between the card and him, its light reaching up to him) a thin red beam from the card to his feet each turn
      if (at.z > 70) f.streak({ x: at.x, y: at.y, z: 44 }, { x: at.x, y: at.y, z: Math.max(60, at.z - 50) }, 0xffd27a, { w: 6, ms: 140, draw: 20, quiet: true }); // (gold: it reads on the red planks)
      if (last) { f.flurry({ x: at.x, y: at.y, z: at.z + 30 }, F.red, { ms: 140, every: 35, len: 220, w: 6, accent: 0, spread: 10 }); f.host.kick(0.03); }
    },
  },
  // the jackpot (DAVID 18:23's bar, the gothic ult 09): coins and chips gather round him while the reels roll → a gold star
  // glyph opens on the floor under him → a ring runs out → the last blast is the big burst → a dome of gold over the area
  jackpot: { tone: TONE.coin, own: true, noImpact: true,
    cast: (f, r) => { f.flipLoad(SHEET.coinBurst); const id = r.attackerId; f.swirl(() => { const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; }, { tex: 'gbk-c_coin_h', size: 0.5, aspect: 1, crumble: C.coin }, { n: 16, r0: 70, r1: 150, h: 260, ms: T(r).startup, rps: 0.9, rise: 0.5, color: C.coin }); },
    active: (f, r) => { const c = me(f, r); f.glyph(c.x, c.y, C.coin, { shape: 'star', points: 8, r: 260, ms: T(r).active + 500, spin: 0.25, pulse: 0.6, a: 0.75 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.coin, 3.2, 600, 0.7); },
    hit: (f, _s, _h, at, main) => {
      if (!main) return;
      // (David 20:51, painted pass: the main hit is a painted gold fountain — a white-hot flash, molten gold flinging spinning
      // coins and chips up and out, cooling to amber and bronze smoke — rising off the planks over the inked ring of coin cuts;
      // a second, smaller one a beat later off to the side. The added-light dome is gone)
      f.flip(SHEET.coinBurst, { x: at.x, y: at.y, z: 0 }, { grid: [4, 4], w: 430, anchorY: 0.14, fps: 20, glow: 0.15, through: 0.5, flipX: Math.random() < 0.5 });
      f.flip(SHEET.coinBurst, { x: at.x + 90, y: at.y + 30, z: 0 }, { grid: [4, 4], from: 1, w: 260, anchorY: 0.14, fps: 22, glow: 0.2, through: 0.5, delay: 140, flipX: true });
      f.host.kick(0.07);
      f.slash({ x: at.x, y: at.y, z: 0 }, 1, C.coin, { r: 220, w: 50, tilt: 10, a0: -180, a1: 180, ms: 320, y0: 30, i: 2.4, ink: true });
    } },
  // All In: every stuck card goes off — a crater and a gold column out of it
  all_in: { tone: TONE.neon, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, F.neon, { r: 150, chunks: 18 }); f.pillar(at.x, at.y, F.neon, { h: 600, r: 32, ms: 480, i: 1.4, core: false }); } } },
  // Triple Down: three slams — the cracks grow with each, the third the widest
  triple_down: { tone: TONE.violet, own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam' || react === 'knockdown') f.crack(at.x, at.y, F.violet, { r: main ? 150 : 95, chunks: main ? 16 : 7 }); } },
};
