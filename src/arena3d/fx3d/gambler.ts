// PVP 3D — the Gambler's skills in the room's 3D (fuchsia, cards, coins, dice): what each skill adds in 3D on top of its painted effect.
// Owned by the Gambler chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, placeOf, T } from './kit';

export const GAMBLER: Record<string, Recipe> = {
  cut_the_deck: { trail: { c: C.fuchsia, w: 9, len: 10 }, active: (f, r) => { if (r.stage >= 1) f.slash(me(f, r), side(r), C.fuchsia, { r: 125, tilt: [30, 70, 15][r.stage % 3], a0: -70, a1: 120, ms: 220, i: 1.7 }); } },
  charged_deal: { trail: { c: C.fuchsia, w: 14, i: 2.6 } },
  riffle_shuffle: { trail: { c: C.fuchsia, w: 8, len: 10 }, active: (f, r) => f.whirl(r.attackerId, C.fuchsia, { r: 140, ms: Math.min(400, T(r).active), rings: 1, every: 130, dir: side(r) }) },
  coin_flip: { own: true, active: (f, r) => f.pillar(me(f, r).x, me(f, r).y, C.coin, { h: 420, r: 34, ms: 520, core: false }) },
  roulette_wheel: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.pillar(at.x, at.y, C.fuchsia, { h: 560, r: 50, ms: 520, twist: true }); f.crack(at.x, at.y, C.coin, { r: 120, chunks: 10 }); } } },
  dice_bomb: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.dice, { r: 190, ms: 380 }); f.crack(at.x, at.y, C.fuchsia, { r: 120, chunks: 14 }); } } },
  kinetic_grab: { hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, C.fuchsia, { r: 100, ms: 260 }); } },
  ace_in_the_hole: { trail: { c: C.coin, w: 14, i: 2.6 }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.coin, { r: 170, ms: 380 }); f.pillar(at.x, at.y, C.fuchsia, { h: 520, r: 36, ms: 420, core: false }); } } },
  all_in: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.fuchsia, { r: 170, chunks: 18 }); f.pillar(at.x, at.y, C.coin, { h: 640, r: 50, ms: 520 }); } } },
  grand_slam: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.fuchsia, { r: 180, chunks: 20, up: 1.3 }); f.dome(at.x, at.y, C.fuchsia, { r: 200, ms: 360, a: 0.7 }); f.host.kick(0.05); } } },
  triple_down: { own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam') f.crack(at.x, at.y, C.fuchsia, { r: 120, chunks: 10 }); } },
  card_swap: { active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.7, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 90 }, { x: e.x, y: e.y, z: 90 }, C.fuchsia, { w: 20, ms: 300, draw: 40 }); }); } },
  jackpot: { own: true, active: (f, r) => { const p = placeOf(f, r, 220); f.pillar(p.x, p.y, C.coin, { h: 900, r: 100, ms: 900, twist: true, i: 2.6 }); f.later(140, () => { f.dome(p.x, p.y, C.fuchsia, { r: 360, ms: 620 }); f.crack(p.x, p.y, C.fuchsia, { r: 240, chunks: 26, up: 1.4 }); f.host.impact({ x: p.x, y: p.y, z: 60 }, 2); f.host.kick(0.08); }); } },
};
