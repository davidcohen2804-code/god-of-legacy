// PVP 3D — the Samurai's skills in the room's 3D (crimson, steel, gold, sakura, ink): what each skill adds in 3D on top of its painted effect.
// Owned by the Samurai chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, T } from './kit';

export const SAMURAI: Record<string, Recipe> = {
  quick_slash: { own: true, active: (f, r) => f.slash(me(f, r), side(r), r.stage % 2 ? C.crimson : C.steel, { r: 130, tilt: [24, 64, 10, 80][r.stage % 4], a0: [-70, 170, -130, 160][r.stage % 4], a1: [120, -10, 120, 20][r.stage % 4], ms: 200, i: 1.9 }) },
  shadow_step: { active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.8, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 90 }, { x: e.x, y: e.y, z: 90 }, C.ink, { w: 30, ms: 340, draw: 40 }); }); } },
  iai_strike: { own: true, active: (f, r) => { const c = me(f, r), e = { x: c.x + r.aim.x * 520, y: c.y + r.aim.y * 300, z: 100 }; f.streak({ ...c, z: 100 }, e, C.steel, { w: 12, ms: 300, draw: 30, front: true }); f.later(160, () => f.streak({ ...c, z: 100 }, e, C.crimson, { w: 34, ms: 420, draw: 60 })); }, hit: (f, _s, _h, at, main) => { if (main) f.slash(at, Math.random() < 0.5 ? 1 : -1, C.crimson, { r: 110, tilt: 45, a0: -80, a1: 100, ms: 260 }); } },
  sword_wave: { crest: { c: C.sun, h: 150, w: 120 }, trail: false },
  mirage: { own: true, active: (f, r) => { const c = me(f, r); for (let i = 0; i < 3; i++) f.later(i * 70, () => f.slash(c, i % 2 ? -side(r) : side(r), C.rose, { r: 150, tilt: [20, 60, 85][i], a0: -100, a1: 130, ms: 240 })); f.dome(c.x, c.y, C.rose, { r: 180, ms: 360, a: 0.6 }); } },
  dragon_eclipse: { own: true, active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, 0x40102a, { r: 420, ms: 900, a: 0.7 }); f.later(160, () => { f.pillar(c.x + side(r) * 200, c.y, C.crimson, { h: 860, r: 90, ms: 760, twist: true }); f.host.impact({ x: c.x, y: c.y, z: 80 }, 2); }); for (let i = 0; i < 4; i++) f.later(200 + i * 80, () => f.slash(me(f, r), i % 2 ? 1 : -1, C.crimson, { r: 190, tilt: 15 + i * 22, a0: -120, a1: 140, ms: 300 })); } },
  kagemusha: { own: true, active: (f, r) => f.dome(me(f, r).x, me(f, r).y, C.ink, { r: 200, ms: 520, a: 0.6 }) },
  tornado_blade: { active: (f, r) => f.whirl(r.attackerId, C.steel, { r: 120, ms: T(r).active, rings: 3, every: 90, y0: 40, dir: side(r) }) },
  falcon_dive: { own: true, fired: (f, r) => { const c = me(f, r); f.crack(c.x, c.y, C.fire, { r: 150, chunks: 16 }); f.pillar(c.x, c.y, C.fire, { h: 520, r: 44, ms: 420 }); f.host.kick(0.05); } },
  rising_sun: { own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.sun, { h: 780, r: 70, ms: 700, i: 2.6 }); f.dome(c.x, c.y, C.sun, { r: 230, ms: 460 }); } },
  phantom_blades: { hit: (f, _s, _h, at) => f.slash(at, Math.random() < 0.5 ? 1 : -1, C.crimson, { r: 100, tilt: 10 + Math.random() * 70, a0: -100, a1: 110, ms: 200, i: 2 }) },
  god_of_blades: { own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.sun, { h: 700, r: 60, ms: 800, twist: true }); f.dome(c.x, c.y, C.sun, { r: 240, ms: 520, a: 0.6 }); } },
  sakura_bind: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.sakura, { r: 160, ms: 420 }); f.pillar(at.x, at.y, C.sakura, { h: 520, r: 44, ms: 520, twist: true }); f.host.blow(f.host.w3(at.x), 0.4, f.host.d3(at.y), 4, 5); } } },
  dragon_ascension: { own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.sun, { h: 980, r: 80, ms: 900, twist: true, i: 2.6 }); f.later(80, () => f.pillar(c.x, c.y, C.crimson, { h: 860, r: 50, ms: 760, twist: true, core: false })); f.host.impact({ x: c.x, y: c.y, z: 120 }, 1); } },
};
