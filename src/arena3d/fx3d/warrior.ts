// PVP 3D — the Warrior's skills in the room's 3D: what each skill adds in 3D on top of its painted effect.
// Owned by the Warrior chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
// Five families (DFO's quality review), each its own colour and shape so any still frame names the skill — shape over
// glow, the bodies always readable (the room's bloom turns anything bright to white: intensities stay low):
//   STEEL the sword (thin white arcs, streaks) · STONE his weight (cracks with molten light, chunks, dust) · IRON his
//   grappling hand (cold blue-white) · HOLY the Judge's verdicts (pale gold, white core) · CRIMSON his fury (deep red).
import type { Recipe } from '../Fx3D';
import { me, side, ahead, T } from './kit';

// (steel a cold blue-white: the room's warm grade and bloom turned a near-white arc gold on the basic — DFO's review)
const W = { steel: 0x9ebcff, stone: 0x9a8670, molten: 0xff7a22, iron: 0x9fc4ff, holy: 0xfff0b8, crimson: 0xd8261c, blood: 0xff4a3a };

/** A crack whose chunks fly without its dust: Fx3D's crack throws half its chunk count in dust puffs, and they stacked into a
 *  cream haze round both fighters (Ground Breaker, Leap Crash, Titan's Verdict) — the chunks thrown by debris instead. */
const crk = (f: Parameters<NonNullable<Recipe['active']>>[0], x: number, y: number, c: number, o: { r?: number; chunks?: number; up?: number }): void => {
  f.crack(x, y, c, { r: o.r, chunks: 0 }); if (o.chunks) f.debris(x, y, o.chunks, { up: o.up ?? 1 });
};

// every recipe `own`: the room's default main-hit pieces (a white launch pillar, a hit dome) washed over the foe — Rising Slash's
// column, Impaling Rush's ball (DFO's review); each skill's own pieces carry its hit
export const WARRIOR: Record<string, Recipe> = {
  // STEEL
  warrior_basic: { tone: W.steel, own: true, active: (f, r) => { if (r.stage >= 2) f.slash(me(f, r), side(r), W.steel, { r: 125, tilt: r.stage >= 3 ? 70 : 34, a0: -60, a1: 120, ms: 200, i: 0.9 }); if (r.stage >= 3) f.later(T(r).active * 0.5, () => { const p = ahead(f, r, 80); crk(f, p.x, p.y, W.molten, { r: 60, chunks: 5 }); }); } }, // the 4th, the two-hand chop, cracks the planks a little
  dash_slash: { tone: W.steel, own: true, active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.85, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 95 }, { x: e.x, y: e.y, z: 95 }, W.steel, { w: 10, ms: 300, draw: 30 }); f.later(110, () => f.slash(e, side(r), W.steel, { r: 140, tilt: 12, a0: -120, a1: 110, ms: 200, i: 1.4 })); }); } }, // one razor line, then it bursts a beat after he passes
  rising_slash: { tone: W.crimson, own: true, active: (f, r) => { const c = me(f, r); f.slash(c, side(r), W.steel, { r: 150, tilt: 82, a0: 160, a1: 10, ms: 260, y0: 60, i: 1.6 }); f.slash(c, side(r), W.crimson, { r: 162, tilt: 82, a0: 160, a1: 10, ms: 300, y0: 60, i: 0.8 }); f.debris(c.x + side(r) * 60, c.y, 6, { up: 1.8, speed: 0.6 }); } }, // white with a crimson rim, chips thrown up with the foe
  whirlwind: { tone: W.steel, own: true, active: (f, r) => f.whirl(r.attackerId, W.steel, { r: 150, ms: T(r).active, rings: 3, every: 110, dir: side(r) }) },
  wave_slash: { tone: W.steel, own: true, crest: { c: W.steel, h: 120, w: 100 }, trail: false, active: (f, r) => f.slash(me(f, r), side(r), W.steel, { r: 150, tilt: 70, a0: 150, a1: -10, ms: 240, i: 1.3 }) },
  lance_thrust: { tone: W.steel, own: true, active: (f, r) => { const c = me(f, r), A = T(r).active; for (let i = 0; i < 4; i++) f.later(A * (0.15 + i * 0.2), () => { const e = me(f, r), y = 90 + (i % 2 ? 14 : -10); f.streak({ x: e.x + side(r) * 30, y: e.y, z: y }, { x: e.x + side(r) * (150 + i * 10), y: e.y, z: y }, W.steel, { w: i === 3 ? 8 : 4, ms: 160, draw: 25 }); }); f.later(A * 0.85, () => { const e = me(f, r); f.dome(e.x + side(r) * 150, e.y, W.steel, { r: 50, ms: 200, a: 0.25 }); void c; }); } }, // a hail of thin thrusts, the last one bursting out behind the foe
  sky_breaker: { tone: W.steel, own: true, fired: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, W.steel, { h: 560, r: 10, ms: 300, i: 0.45, core: false }); /* (a thin steel streak: the wide one washed the frame — DFO) */ crk(f, c.x, c.y, W.molten, { r: 150, chunks: 14, up: 1.3 }); f.host.impact({ x: c.x, y: c.y, z: 20 }, 1); } }, // the dive a white streak, the landing in stone
  // STONE
  ground_breaker: { tone: W.molten, own: true, active: (f, r) => { const c = me(f, r); crk(f, c.x, c.y, W.molten, { r: 175, chunks: 20, up: 1.4 }); f.debris(c.x, c.y, 10, { up: 1.5, speed: 1.1 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), W.stone, 3.4, 420, 0.25); f.host.kick(0.06); f.host.impact({ x: c.x, y: c.y, z: 20 }, 1); } }, // the planks torn, chunks, molten light in the cracks (no dome; no dust — it hazed both fighters cream-white)
  leap_crash: { tone: W.molten, own: true, fired: (f, r) => { const c = me(f, r); crk(f, c.x, c.y, W.molten, { r: 140, chunks: 16, up: 1.7 }); f.debris(c.x, c.y, 10, { speed: 1.3, up: 1.6 }); f.host.kick(0.05); } }, // a stone crater, chunks thrown high
  earthsplitter: { tone: W.molten, own: true, active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, W.stone, { len: 520, ms: 300, h: 110, w: 110, chunks: true }); for (let i = 1; i <= 4; i++) f.later(i * 55, () => { const p = { x: c.x + r.aim.x * i * 120, y: c.y + r.aim.y * i * 70 }; crk(f, p.x, p.y, W.molten, { r: 90, chunks: 6 }); }); } }, // the fissure runs (its rock spikes: WarriorSpikes — they stand a while, the continuity)
  // IRON
  iron_grip: { tone: W.iron, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, W.iron, { r: 90, ms: 260, a: 0.45, implode: true }); f.host.embers(f.host.w3(at.x), 0.8, f.host.d3(at.y), W.iron, 12, 2.6); } } }, // the hand closes (an implosion), cold sparks
  judgment_hook: { tone: W.iron, own: true, active: (f, r) => { const c = me(f, r), e = ahead(f, r, 420); f.streak({ x: c.x, y: c.y, z: 100 }, { x: e.x, y: e.y, z: 100 }, W.iron, { w: 6, ms: 420, draw: 110 }); } },
  shield_charge: { tone: W.iron, own: true, cast: (f, r) => f.dome(me(f, r).x + side(r) * 50, me(f, r).y, W.iron, { r: 110, ms: T(r).startup + T(r).active, a: 0.4, hold: 1, follow: () => { const c = f.host.casterPos(r.attackerId); return c ? { x: c.x + side(r) * 60, y: c.y, z: 0 } : null; } }) },
  // HOLY
  judgment_blade: { tone: W.holy, own: true, fired: (f, r, i, o) => { if (i === 0) return; f.streak({ x: o.x, y: o.y, z: 900 }, { x: o.x, y: o.y, z: 40 }, W.holy, { w: 9, ms: 220, draw: 60 }); /* (the sword's dive: the painted sword of light lands on it) */ crk(f, o.x, o.y, W.holy, { r: 120, chunks: 10 }); f.host.impact({ x: o.x, y: o.y, z: 20 }, 1); } }, // the judge's blade falls from the sky
  sanctuary: { tone: W.holy, own: true, active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, W.holy, { r: 190, ms: 1400, a: 0.3, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); f.pillar(c.x, c.y, W.holy, { h: 420, r: 40, ms: 600, i: 0.7, core: false }); } }, // a see-through dome of light, motes rising
  titans_verdict: { tone: 0xffb84a, own: true, /* (the room lit warm gold: its near-white holy light milked the whole screen) */ active: (f, r) => { const c = ahead(f, r, 110); f.pillar(c.x, c.y, W.holy, { h: 700, r: 42, ms: 700, i: 0.3, twist: true, core: false }); /* (soft: the room's bloom blew a brighter one to a white column — David: no white-out) */ f.later(120, () => { crk(f, c.x, c.y, W.molten, { r: 260, chunks: 30, up: 1.4 }); f.host.kick(0.09); f.host.impact({ x: c.x, y: c.y, z: 40 }, 1); }); } },
  // CRIMSON
  war_cry: { tone: W.crimson, own: true, active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, W.crimson, { r: 230, ms: 520, a: 0.4 }); f.later(90, () => f.dome(c.x, c.y, W.blood, { r: 170, ms: 440, a: 0.3 })); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 6, 1.2); f.host.embers(f.host.w3(c.x), 0.9, f.host.d3(c.y), W.crimson, 22, 3.2); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); } }, // the roar: a shock ring of red air, the dust blown off the planks
  lions_maw: { tone: W.crimson, own: true, crest: { c: W.crimson, h: 150, w: 120 }, trail: false },
  blade_storm: { tone: W.crimson, own: true, hit: (f, _s, h, at, main) => { f.bolt({ x: at.x + (Math.random() - 0.5) * 120, y: at.y, z: 900 }, { x: at.x, y: at.y, z: 40 }, W.crimson, { ms: main ? 300 : 180, w: main ? 9 : 5, forks: main ? 2 : 1 }); if (main || h.heavy) crk(f, at.x, at.y, W.molten, { r: 100, chunks: 8 }); } },
};
