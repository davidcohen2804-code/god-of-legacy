// PVP 3D — the Book Mage's skills in the room's 3D (frost, storm, arcane): what each skill adds in 3D on top of its painted effect.
// Owned by the Book Mage chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, placeOf } from './kit';

export const BOOK_MAGE: Record<string, Recipe> = {
  arcane_bolt: { trail: { c: C.arcane, w: 12 } },
  arcane_wave: { active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, C.arcane, { len: 560, ms: 300, h: 140, w: 140 }); } },
  binding_rune: { hit: (f, _s, _h, at) => f.pillar(at.x, at.y, C.arcane, { h: 380, r: 30, ms: 520, core: false }) },
  astral_burst: { own: true, active: (f, r) => { const p = placeOf(f, r); f.pillar(p.x, p.y, C.storm, { h: 620, r: 58, ms: 620, twist: true }); f.dome(p.x, p.y, C.arcane, { r: 160, ms: 380, a: 0.7 }); } },
  frost_nova: { own: true, active: (f, r) => { const c = me(f, r); f.crystals(c.x, c.y, { n: 12, r: 150, h: 130, ms: 1500, ring: true }); f.dome(c.x, c.y, C.frost, { r: 230, ms: 360 }); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 1.1); } },
  lightning_chain: { chainBolt: C.storm, trail: false, hit: (f, _s, _h, at, main) => { if (main) f.dome(at.x, at.y, C.storm, { r: 80, ms: 220, a: 0.6 }); } },
  storm_field: { own: true, active: (f, r) => { const p = placeOf(f, r); const life = r.skill.zoneMs ?? 2400; f.dome(p.x, p.y, C.storm, { r: 230, ms: life, a: 0.35, hold: 1 }); for (let t = 0; t < life; t += 260) f.later(t, () => { const a = Math.random() * Math.PI * 2, d = Math.random() * 200; f.bolt({ x: p.x + Math.cos(a) * d * 0.4, y: p.y, z: 700 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, C.storm, { ms: 200, w: 9, forks: 1 }); }); } },
  time_collapse: { own: true, active: (f, r) => { const p = placeOf(f, r); f.dome(p.x, p.y, C.arcane, { r: 420, ms: 1200, implode: true, a: 0.8 }); f.later(1000, () => { f.pillar(p.x, p.y, 0xffffff, { h: 900, r: 90, ms: 700, i: 2.8 }); f.crystals(p.x, p.y, { n: 14, r: 200, h: 170, ms: 1700, ring: true, color: C.arcane }); f.host.impact({ x: p.x, y: p.y, z: 60 }, 2); f.host.kick(0.08); }); } },
  blink: { cast: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 300, r: 40, ms: 300, core: false }); }, active: (f, r) => f.later(60, () => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 300, r: 40, ms: 340, core: false }); }) },
  glacial_spikes: { trail: { c: C.frost, w: 10 }, own: true, hit: (f, _s, _h, at, main) => f.crystals(at.x, at.y, { n: main ? 9 : 5, r: main ? 90 : 55, h: main ? 160 : 110, ms: 1300 }), active: (f, r) => { const c = me(f, r); for (let i = 1; i <= 5; i++) f.later(i * 45, () => f.crystals(c.x + r.aim.x * i * 85, c.y + r.aim.y * i * 50, { n: 3, r: 30, h: 70 + i * 14, ms: 900 })); } },
  levity_field: { own: true, active: (f, r) => { const p = placeOf(f, r); f.dome(p.x, p.y, C.frost, { r: 200, ms: r.skill.zoneMs ?? 1800, a: 0.3, hold: 1 }); } },
  origami_flock: { trail: { c: C.paper, w: 8, len: 10, i: 1.6 } },
  arcane_ward: { own: true, active: (f, r) => f.dome(me(f, r).x, me(f, r).y, C.arcane, { r: 150, ms: 900, a: 0.6, follow: () => f.host.casterPos(r.attackerId) }) },
  paper_curse: { chainBolt: C.paper },
  elemental_ascension: { own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.frost, { h: 720, r: 64, ms: 760, twist: true }); f.later(120, () => f.pillar(c.x, c.y, C.storm, { h: 620, r: 40, ms: 620, twist: true, core: false })); f.dome(c.x, c.y, C.arcane, { r: 260, ms: 460 }); } },
  page_bind: { active: (f, r) => f.slash(me(f, r), side(r), C.paper, { r: 140, tilt: 20, a0: -40, a1: 140, ms: 260, i: 1.8 }) },
};
