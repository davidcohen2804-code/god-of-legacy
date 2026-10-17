// PVP 3D — the Archer's skills in the room's 3D (leaf green, spirit, the fire arrow, the storm): what each skill adds in 3D on top of its painted effect.
// Owned by the Archer chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
// Each skill its own shape in the room: a thin leaf trail for the shots, a green geyser for the launcher, a fire shell for
// the fire arrow, lightning from the sky for Thunder Rain, a hawk diving out of the sky, a single great arrow falling for
// Hunter's Rain, roots crystallising round a bound foe — never a screen-filling dome over the fighters.
import type { Recipe } from '../Fx3D';
import { C, me, side, placeOf, T } from './kit';

/** The storm's lightning (Thunder Rain): the blue-white of its painted bolts. */
const STORM = 0x9fe4ff;
/** The spirit gold of her great arrows (Hunter's Rain, the charged shot). */
const SUN = 0xffe27a;
/** DFO's families: WIND pale green-white air (her shots and footwork), THORN deep green vines and roots (traps, binds, the lash),
 *  SPIRIT cyan-green beasts of light (hawk, wolf, eagle, the spirit arrow). FIRE is Fireball Arrow only, STORM Thunder Rain, SUN the two rains. */
/** Each recipe's `tone`: the colour the room answers its blows in (light, floor mark / ring, embers). */
const WIND = 0xd4ffd0, THORN = 0x3fae3a, SPIRIT = 0x6cffe2;

export const ARCHER: Record<string, Recipe> = {
  // Double Shot: two thin leaf trails; the charged third arrow (chain stage 2) a gold streak along the aim and a push of the camera
  quick_shot: { tone: WIND,
    trail: { c: C.leaf, w: 8, len: 10, i: 1.8 },
    active: (f, r) => { if (r.stage !== 1) return; const c = me(f, r); f.streak({ x: c.x + side(r) * 30, y: c.y, z: 62 }, { x: c.x + r.aim.x * 470, y: c.y + r.aim.y * 280, z: 62 }, SUN, { w: 16, ms: 260, draw: 70 }); f.host.kick(0.02); },
    own: true, hit: (f, _s, h, at) => { if (h.heavy) { f.dome(at.x, at.y, SUN, { r: 80, ms: 240, a: 0.55 }); f.debris(at.x, at.y, 4, { speed: 0.7, up: 0.6 }); } },
  },
  // Rising Arrow: a green geyser bursts up under the foe — the floor cracks and a twisting column of leaf light throws him up
  rising_arrow: { tone: WIND, own: true, hit: (f, _s, _h, at, main) => { if (!main) return; f.crack(at.x, at.y, WIND, { r: 80, chunks: 6, up: 1.3 }); f.pillar(at.x, at.y, WIND, { h: 440, r: 28, ms: 420, twist: true }); } },
  // Wind Step: a gust ring bursts under her as she somersaults back, a streak of wind along the leap
  bow_haste: { tone: WIND, cast: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), WIND, 1.3, 320, 0.55); }, active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.6, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 40 }, { x: e.x, y: e.y, z: 40 }, WIND, { w: 16, ms: 300, draw: 40 }); }); } },
  // Triple Arrow: five fine trails fanning out; the first to land rings the floor
  multi_shot: { tone: WIND, trail: { c: WIND, w: 7, len: 9, i: 1.6 }, own: true, hit: (f, _s, _h, at, main) => { if (main) f.host.ring(f.host.w3(at.x), f.host.d3(at.y), WIND, 1.4, 260, 0.6); } },
  // Fireball Arrow: a burning trail, then a shell of fire (kept under the foe's height), the planks torn, embers
  explosive_arrow: { tone: C.fire, trail: { c: C.fire, w: 14, i: 2.4 }, own: true, hit: (f, _s, _h, at) => { f.dome(at.x, at.y, C.fire, { r: 110, ms: 240, a: 0.5 }); f.crack(at.x, at.y, C.fire, { r: 110, chunks: 12, up: 1.2 }); f.host.embers(f.host.w3(at.x), 0.6, f.host.d3(at.y), C.fire, 18, 3); } },
  // Backstep Shot: a leaf trail; a puff of wind where she pushes off
  backstep_shot: { tone: WIND, trail: { c: WIND, w: 9, len: 10 }, cast: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), WIND, 1.2, 300, 0.5); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 6, 0.6); } },
  // Retreat Kick: an upright arc of wind sweeping up with the boot; chips kicked off the floor
  retreat_kick: { tone: WIND, active: (f, r) => { const c = me(f, r); f.slash(c, side(r), WIND, { r: 100, tilt: 75, a0: 170, a1: 30, ms: 220, y0: 40 }); f.debris(c.x + side(r) * 60, c.y, 5, { speed: 0.8, up: 1.1, dir: side(r) }); } },
  // Vine Mine: the floor splits and a ring of green crystals (thorns) bursts up round the foe
  vine_trap: { tone: THORN, own: true, hit: (f, _s, _h, at, main) => { if (!main) return; f.crack(at.x, at.y, THORN, { r: 120, chunks: 8 }); f.crystals(at.x, at.y, { n: 9, r: 80, h: 90, ms: 900, ring: true, color: THORN }); } },
  // Air Volley: each arrow that strikes the floor kicks up chips and a small ring
  skyhunters_step: { tone: WIND, trail: { c: WIND, w: 7, len: 8 }, fired: (f, _r, _i, o) => { f.host.ring(f.host.w3(o.x), f.host.d3(o.y), WIND, 0.9, 220, 0.5); f.debris(o.x, o.y, 2, { speed: 0.5, up: 0.7 }); } },
  // Thunder Rain: lightning from the sky onto the foe at every arrow, the last one the brightest
  rain_of_arrows: { tone: STORM, own: true, hit: (f, _s, _h, at, main) => { const dx = (Math.random() - 0.5) * 90; f.bolt({ x: at.x + dx, y: at.y, z: 950 }, { x: at.x, y: at.y, z: at.z + 40 }, STORM, { ms: main ? 320 : 200, w: main ? 14 : 9, forks: main ? 3 : 1 }); if (main) f.crack(at.x, at.y, STORM, { r: 90, chunks: 6 }); } },
  // Spirit Bow: a wide spirit trail; at the release a small shell at the bow; the foe thrown down tears the floor
  piercing_arrow: { tone: SPIRIT, trail: { c: SPIRIT, w: 22, len: 18, i: 2.6 }, active: (f, r) => { const c = me(f, r); f.dome(c.x + side(r) * 60, c.y, SPIRIT, { r: 70, ms: 220, a: 0.55 }); f.host.kick(0.03); }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, SPIRIT, { r: 100, chunks: 10 }); f.debris(at.x, at.y, 6, { speed: 1.1, up: 0.8 }); } } },
  // Hunter's Roar: a crest of wind running out round her and the air bent — no dome over the fighters
  hunters_roar: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SPIRIT, 3.0, 480, 0.7); f.later(90, () => f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SUN, 2.2, 400, 0.5)); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 14, 1); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); } },
  // Binding Leaves: roots crystallise round the bound foe's feet for the hold
  leaping_arrow: { tone: THORN, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, THORN, { r: 80, chunks: 0, ms: 1600 }); f.crystals(at.x, at.y, { n: 6, r: 50, h: 60, ms: 1400, ring: true, color: THORN }); } } },
  // Spirit Hawk: the painted hawk dives (no 3D streak: it read as a green swath along the floor) — the floor torn where it strikes
  spirit_hawk: { tone: SPIRIT, own: true, hit: (f, _s, _h, at, main, react) => { if (!(main || react === 'slam')) return; f.streak({ x: at.x - 60, y: at.y, z: 560 }, { x: at.x, y: at.y, z: 70 }, SPIRIT, { w: 9, ms: 200, draw: 70, front: true }); f.later(80, () => { f.crack(at.x, at.y, SPIRIT, { r: 100, chunks: 8 }); f.dome(at.x, at.y, SPIRIT, { r: 60, ms: 200, a: 0.45 }); f.host.kick(0.03); }); } }, // (a thin near-vertical dive line, not a floor swath)
  // Sky Rain (the ultimate): arrows of light rain on the place under a faint shell; the last blow a tall spirit column — kept see-through
  sky_rain: { tone: SUN, own: true, active: (f, r) => { const p = placeOf(f, r, 300); f.rain(p.x, p.y, 260, C.leaf, { n: 46, ms: Math.max(700, T(r).active) }); f.later(200, () => f.dome(p.x, p.y, C.spirit, { r: 280, ms: 700, a: 0.18 })); }, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.leaf, { r: 150, chunks: 14 }); f.pillar(at.x, at.y, SUN, { h: 680, r: 40, ms: 520, i: 0.75 }); } } },
  // Tree of Life: a slow twisting column of spirit light rises where the tree grows (no dome over her)
  tree_of_life: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.spirit, { h: 600, r: 30, ms: 900, i: 0.8, twist: true, core: false }); f.host.embers(f.host.w3(c.x), 0.4, f.host.d3(c.y), C.leaf, 16, 1.2); } },
  // Vine Lash: a vine trail; the caught foe yanked in along a green streak from her bow
  hunters_spirit: { tone: THORN, trail: { c: THORN, w: 11, len: 12 }, own: true, hit: (f, s, _h, at) => { void s; f.crystals(at.x, at.y, { n: 7, r: 46, h: 70, ms: 700, ring: true, color: THORN }); f.later(30, () => f.host.ring(f.host.w3(at.x), f.host.d3(at.y), THORN, 1.0, 260, 0.6)); } }, // (thorns thrust up round the snagged foe as the vine coils him)
  // Hunter's Rain: one great gold arrow falls straight down onto the mark at each blow; the planks burst
  arrow_storm: { tone: SUN, own: true, fired: (f, _r, _i, o) => { f.streak({ x: o.x, y: o.y, z: 900 }, { x: o.x, y: o.y, z: 0 }, SUN, { w: 22, ms: 220, draw: 60 }); f.later(60, () => { f.crack(o.x, o.y, C.leaf, { r: 110, chunks: 10, up: 1.1 }); f.host.ring(f.host.w3(o.x), f.host.d3(o.y), SUN, 1.6, 300, 0.6); }); } },
  // Eagle Tide: a great crest of spirit wind runs the length of the arena with the eagle, a streak over it
  eagle_arrow: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, SPIRIT, { len: 760, ms: 360, h: 150, w: 150 }); f.streak({ x: c.x, y: c.y, z: 90 }, { x: c.x + r.aim.x * 780, y: c.y + r.aim.y * 400, z: 90 }, SPIRIT, { w: 26, ms: 420, draw: 90 }); } },
};
