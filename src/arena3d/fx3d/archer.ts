// PVP 3D — the Archer's skills in the room's 3D (leaf green, spirit, the fire arrow): what each skill adds in 3D on top of its painted effect.
// Owned by the Archer chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, placeOf, T } from './kit';

export const ARCHER: Record<string, Recipe> = {
  rising_arrow: { own: true, hit: (f, _s, _h, at, main) => { if (main) f.pillar(at.x, at.y, C.leaf, { h: 520, r: 34, ms: 460 }); } },
  bow_haste: { active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.6, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 40 }, { x: e.x, y: e.y, z: 40 }, C.leaf, { w: 18, ms: 300, draw: 40 }); }); } },
  explosive_arrow: { trail: { c: C.fire, w: 14, i: 2.4 }, own: true, hit: (f, _s, _h, at) => { f.dome(at.x, at.y, C.fire, { r: 110, ms: 240, a: 0.5 }); f.crack(at.x, at.y, C.fire, { r: 110, chunks: 12 }); f.host.embers(f.host.w3(at.x), 0.6, f.host.d3(at.y), C.fire, 18, 3); } },
  backstep_shot: { trail: { c: C.leaf, w: 10 } },
  retreat_kick: { active: (f, r) => f.slash(me(f, r), side(r), C.leaf, { r: 110, tilt: 70, a0: 170, a1: 30, ms: 220, y0: 50 }) },
  vine_trap: { own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.leaf, { r: 120, chunks: 8 }); f.pillar(at.x, at.y, C.spirit, { h: 460, r: 40, ms: 520 }); } } },
  piercing_arrow: { trail: { c: C.spirit, w: 26, len: 18, i: 2.8 }, active: (f, r) => { const c = me(f, r); f.dome(c.x + side(r) * 60, c.y, C.spirit, { r: 90, ms: 240, a: 0.7 }); f.host.kick(0.03); } },
  hunters_roar: { own: true, active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.leaf, { r: 280, ms: 480 }); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); } },
  leaping_arrow: { hit: (f, _s, _h, at, main) => { if (main) f.crack(at.x, at.y, C.leaf, { r: 80, chunks: 0, ms: 1600 }); } },
  spirit_hawk: { own: true, hit: (f, _s, _h, at, main, react) => { if (main || react === 'slam') { f.pillar(at.x, at.y, C.spirit, { h: 560, r: 40, ms: 460 }); f.crack(at.x, at.y, C.spirit, { r: 100, chunks: 8 }); } } },
  sky_rain: { own: true, active: (f, r) => { const p = placeOf(f, r, 300); f.rain(p.x, p.y, 260, C.leaf, { n: 46, ms: Math.max(700, T(r).active) }); f.later(200, () => f.dome(p.x, p.y, C.spirit, { r: 300, ms: 700, a: 0.45 })); }, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.leaf, { r: 150, chunks: 14 }); f.pillar(at.x, at.y, C.spirit, { h: 700, r: 60, ms: 600 }); } } },
  tree_of_life: { own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.spirit, { h: 640, r: 60, ms: 900, i: 1.6, twist: true }); f.dome(c.x, c.y, C.leaf, { r: 220, ms: 700, a: 0.5 }); } },
  hunters_spirit: { trail: { c: C.leaf, w: 12 } },
  eagle_arrow: { own: true, active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, C.spirit, { len: 760, ms: 360, h: 170, w: 170 }); f.streak({ x: c.x, y: c.y, z: 90 }, { x: c.x + r.aim.x * 780, y: c.y + r.aim.y * 400, z: 90 }, C.spirit, { w: 30, ms: 420, draw: 90 }); } },
};
