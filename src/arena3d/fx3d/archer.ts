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
/** The small star at the bow on a release (David's bar, the deer archer 06): two short crossing streaks, white core + its colour, ~120 ms. */
const bowStar = (f: Parameters<NonNullable<Recipe['fired']>>[0], o: { x: number; y: number; z: number }, color: number, s = 1): void => {
  const L = 34 * s, z = Math.max(40, o.z);
  f.streak({ x: o.x - L, y: o.y, z }, { x: o.x + L, y: o.y, z }, color, { w: 6 * s, ms: 120, draw: 20, front: true, quiet: true });
  f.streak({ x: o.x, y: o.y, z: z - L * 0.8 }, { x: o.x, y: o.y, z: z + L * 0.8 }, color, { w: 6 * s, ms: 120, draw: 20, front: true, quiet: true });
};

export const ARCHER: Record<string, Recipe> = {
  // Double Shot: a star at the bow on every release, two thin leaf trails; the charged third arrow (chain stage 2) a bigger gold star and a gold
  // streak along the aim. Its main hit is the room's (DFO's impact on every main hit) — nothing of its own on the foe.
  quick_shot: { tone: WIND,
    trail: { c: C.leaf, w: 8, len: 10, i: 1.8 },
    fired: (f, r, _i, o) => bowStar(f, o, r.stage === 1 ? SUN : WIND, r.stage === 1 ? 1.6 : 1),
    active: (f, r) => { if (r.stage !== 1) return; const c = me(f, r); f.streak({ x: c.x + side(r) * 30, y: c.y, z: 62 }, { x: c.x + r.aim.x * 470, y: c.y + r.aim.y * 280, z: 62 }, SUN, { w: 16, ms: 260, draw: 70 }); f.host.kick(0.02); },
    own: true,
  },
  // Rising Arrow: a star at the bow, then a twisting geyser of leaf light bursts up under the foe and throws him up
  rising_arrow: { tone: WIND, own: true, fired: (f, _r, _i, o) => bowStar(f, o, WIND, 1.3), hit: (f, _s, _h, at, main) => { if (!main) return; f.pillar(at.x, at.y, WIND, { h: 520, r: 30, ms: 380, twist: true }); f.streak({ x: at.x, y: at.y, z: 0 }, { x: at.x, y: at.y, z: 600 }, C.leaf, { w: 10, ms: 260, draw: 60 }); } }, // (one shape: a twisting geyser of leaf light under him, a leaf streak shooting up through it; the floor's cracks and the flash are DFO's main-hit impact)
  // Wind Step: a gust ring bursts under her as she somersaults back, a streak of wind along the leap
  bow_haste: { tone: WIND, cast: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), WIND, 1.3, 320, 0.55); }, active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.6, () => { const e = me(f, r); f.streak({ x: c.x, y: c.y, z: 40 }, { x: e.x, y: e.y, z: 40 }, WIND, { w: 16, ms: 300, draw: 40 }); }); } },
  // Triple Arrow: five fine trails fanning out; the first to land rings the floor
  multi_shot: { tone: WIND, trail: { c: WIND, w: 7, len: 9, i: 1.6 }, own: true, hit: (f, _s, _h, at, main) => { if (main) f.host.ring(f.host.w3(at.x), f.host.d3(at.y), WIND, 1.4, 260, 0.6); } },
  // Fireball Arrow: a burning trail, then a shell of fire (kept under the foe's height), the planks torn, embers
  explosive_arrow: { tone: C.fire, trail: { c: C.fire, w: 14, i: 2.4 }, own: true, hit: (f, _s, _h, at) => { f.dome(at.x, at.y, C.fire, { r: 110, ms: 240, a: 0.5 }); f.crack(at.x, at.y, C.fire, { r: 110, chunks: 12, up: 1.2 }); f.host.embers(f.host.w3(at.x), 0.6, f.host.d3(at.y), C.fire, 18, 3); } },
  // Backstep Shot: a leaf trail; a puff of wind where she pushes off
  backstep_shot: { tone: SPIRIT, trail: { c: SPIRIT, w: 13, len: 14, i: 2.2 }, fired: (f, _r, _i, o) => bowStar(f, o, SPIRIT, 1.7), cast: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), THORN, 1.2, 320, 0.5); } }, // (the flip's arrow a heavy spirit shot with a big star at the bow; the leaf decoy she leaves is painted)
  // Retreat Kick: an upright arc of wind sweeping up with the boot; chips kicked off the floor
  retreat_kick: { tone: WIND, active: (f, r) => { const c = me(f, r), sd = side(r); f.slash({ x: c.x + sd * 40, y: c.y, z: c.z }, sd, WIND, { r: 130, w: 30, tilt: 70, a0: 200, a1: 10, ms: 220, y0: 30, ink: true }); f.host.ring(f.host.w3(c.x + sd * 70), f.host.d3(c.y), WIND, 1.3, 280, 0.6); } }, // (the kick's arc: one inked rising ring out at the foe, the big painted boot level through it; no floor chips)
  // Vine Mine: the floor splits and a ring of green crystals (thorns) bursts up round the foe
  vine_trap: { tone: THORN, own: true, hit: (f, _s, _h, at, main) => { if (!main) return; f.debris(at.x, at.y, 7, { speed: 1.0, up: 1.3 }); f.host.ring(f.host.w3(at.x), f.host.d3(at.y), THORN, 1.8, 380, 0.6); } }, // (David 01:33: the blue from the floor was the ice crystals — gone; the burst is the painted thorn column, the room adds the floor thrown up and a ring of thorn green; its flash / cracks are DFO's main-hit impact)
  // Air Volley: each arrow that strikes the floor kicks up chips and a small ring
  skyhunters_step: { tone: WIND, trail: { c: WIND, w: 7, len: 8 }, fired: (f, _r, i, o) => { bowStar(f, o, WIND, i % 2 ? 1 : 1.3); f.host.ring(f.host.w3(o.x), f.host.d3(o.y), WIND, 0.9, 220, 0.5); } }, // (Air Volley: a star at the bow on every arrow of the volley in the air, a pale ring on the floor under her; the floor chips dropped)
  // Thunder Rain: lightning from the sky onto the foe at every arrow, the last one the brightest
  // Thunder Rain (David 01:33: "terrible — a significant 3D improvement"): one storm, built in the room. She hangs charging: lightning crackles round
  // her bow, faster and faster. Each of the three arrows is a real bolt from her bow down to its point (the third thick, forked, with two sky bolts
  // either side), a storm-blue inked ring flat on the floor where it strikes. The charged floor is one rune glyph that crackles — small bolts
  // running over it along the floor while it lasts. Its main hit is the room's (DFO's impact): nothing of its own on the foe.
  rain_of_arrows: { tone: STORM, own: true,
    cast: (f, r) => { const t1 = T(r).startup + (r.hits[0]?.at ?? 600); for (let k = 0; k < 9; k++) { const t0 = t1 * (1 - Math.pow(1 - k / 9, 1.5)); f.later(t0, () => { const c = me(f, r), bx = c.x + side(r) * 60, bz = c.z + 100, an = Math.random() * Math.PI * 2, rr = 40 + Math.random() * 40; f.bolt({ x: bx + Math.cos(an) * rr, y: c.y, z: bz + Math.sin(an) * rr }, { x: bx, y: c.y, z: bz }, STORM, { ms: 110, w: 3 + k * 0.4, forks: 1, front: true }); }); } },
    active: (f, r) => { const L = r.skill.linger; if (!L) return; const p = placeOf(f, r, L.offset ?? 300); f.later(Math.max(0, L.startMs - T(r).startup - 100), () => f.glyph(p.x, p.y, STORM, { shape: 'runes', r: L.radius ?? 210, ms: L.everyMs * L.count + 500, spin: 14, pulse: 4, a: 0.75 })); },
    fired: (f, r, i) => { const sh = r.hits[i]?.shape as { bias?: number } | undefined, b = sh?.bias ?? 200, big = i === r.hits.length - 1, c = me(f, r);
      const at = { x: r.origin.x + r.aim.x * b, y: r.origin.y + r.aim.y * b, z: 0 };
      f.bolt({ x: c.x + side(r) * 50, y: c.y, z: c.z + 100 }, { x: at.x, y: at.y, z: 6 }, STORM, { ms: big ? 320 : 220, w: big ? 10 : 6, forks: big ? 3 : 2, front: true });
      f.later(40, () => { f.host.ring(f.host.w3(at.x), f.host.d3(at.y), STORM, big ? 2.2 : 1.4, big ? 420 : 300, 0.75); f.crack(at.x, at.y, STORM, { r: big ? 110 : 70, chunks: 0, ms: 900, quiet: true }); });
      if (big) for (const dx of [-110, 110]) f.later(70, () => f.bolt({ x: at.x + dx * 0.6, y: at.y, z: 950 }, { x: at.x + dx, y: at.y, z: 6 }, STORM, { ms: 260, w: 9, forks: 2 })); },
    tick: (f, _r, at) => { const an = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 120, x0 = at.x + Math.cos(an) * rr, y0 = at.y + Math.sin(an) * rr * 0.5; f.bolt({ x: x0, y: y0, z: 4 }, { x: x0 + (Math.random() - 0.5) * 160, y: y0 + (Math.random() - 0.5) * 50, z: 4 }, STORM, { ms: 140, w: 4, forks: 1 }); },
  },
  // Spirit Bow: a wide spirit trail; at the release a small shell at the bow; the foe thrown down tears the floor
  piercing_arrow: { tone: SPIRIT, trail: { c: SPIRIT, w: 22, len: 18, i: 2.6 }, active: (f, r) => { const c = me(f, r); f.dome(c.x + side(r) * 60, c.y, SPIRIT, { r: 70, ms: 220, a: 0.55 }); f.host.kick(0.03); }, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, SPIRIT, { r: 100, chunks: 10 }); f.debris(at.x, at.y, 6, { speed: 1.1, up: 0.8 }); } } },
  // Hunter's Roar: a crest of wind running out round her and the air bent — no dome over the fighters
  hunters_roar: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SPIRIT, 3.0, 480, 0.7); f.later(90, () => f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SUN, 2.2, 400, 0.5)); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 14, 1); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); } },
  // Binding Leaves: roots crystallise round the bound foe's feet for the hold
  leaping_arrow: { tone: THORN, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, THORN, { r: 80, chunks: 0, ms: 1600 }); f.crystals(at.x, at.y, { n: 6, r: 50, h: 60, ms: 1400, ring: true, color: THORN }); } } },
  // Spirit Hawk: the painted hawk dives (no 3D streak: it read as a green swath along the floor) — the floor torn where it strikes
  spirit_hawk: { tone: SPIRIT, own: true, hit: (f, _s, _h, at, main, react) => { if (!(main || react === 'slam')) return; f.streak({ x: at.x - 60, y: at.y, z: 560 }, { x: at.x, y: at.y, z: 70 }, SPIRIT, { w: 9, ms: 200, draw: 70, front: true }); f.later(80, () => { f.crack(at.x, at.y, SPIRIT, { r: 100, chunks: 8 }); f.dome(at.x, at.y, SPIRIT, { r: 60, ms: 200, a: 0.45 }); f.host.kick(0.03); }); } }, // (a thin near-vertical dive line, not a floor swath)
  // Sky Rain (the ultimate): arrows of light rain on the place under a faint shell; the last blow a tall spirit column — kept see-through
  sky_rain: { tone: SUN, own: true, active: (f, r) => { const p = placeOf(f, r, 300); f.glyph(p.x, p.y, SUN, { shape: 'star', r: 270, ms: Math.max(1600, T(r).active + 600), points: 8, spin: 10, pulse: 2.4 }); f.rain(p.x, p.y, 240, SUN, { n: 40, ms: Math.max(700, T(r).active) }); for (let k = 0; k < 6; k++) f.later(120 + k * (Math.max(700, T(r).active) / 7), () => f.skyBeam({ x: p.x + (Math.random() - 0.5) * 300, y: p.y + (Math.random() - 0.5) * 90, z: 0 }, SUN, { w: 8, ms: 320 })); }, hit: (f, _s, _h, at, main) => { if (main) { f.skyBeam(at, 0xfff2b0, { w: 26, ms: 560, draw: 70 }); } } }, // (David's bar, the deer archer 06: a great crystal-star glyph under the foe, beams from the sky, the last blow one piercing beam; its flash / cracks / embers are DFO's main-hit impact)
  // Tree of Life: a slow twisting column of spirit light rises where the tree grows (no dome over her)
  tree_of_life: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.spirit, { h: 600, r: 30, ms: 900, i: 0.8, twist: true, core: false }); f.host.embers(f.host.w3(c.x), 0.4, f.host.d3(c.y), C.leaf, 16, 1.2); } },
  // Vine Lash: a vine trail; the caught foe yanked in along a green streak from her bow
  hunters_spirit: { tone: THORN, trail: { c: THORN, w: 11, len: 12 }, own: true, hit: (f, s, _h, at) => { void s; f.crystals(at.x, at.y, { n: 7, r: 46, h: 70, ms: 700, ring: true, color: THORN }); f.later(30, () => f.host.ring(f.host.w3(at.x), f.host.d3(at.y), THORN, 1.0, 260, 0.6)); } }, // (thorns thrust up round the snagged foe as the vine coils him)
  // Hunter's Rain: one great gold arrow falls straight down onto the mark at each blow; the planks burst
  arrow_storm: { tone: SUN, own: true, active: (f, r) => { const p = placeOf(f, r, 260); f.glyph(p.x, p.y, SUN, { shape: 'star', r: 150, ms: Math.max(1500, T(r).active), points: 6, spin: 16, pulse: 2.5, a: 0.7 }); }, fired: (f, r, i, o) => { const last = i === r.hits.length - 1, big = i % 5 === 4 || last; f.skyBeam({ x: o.x, y: o.y, z: 0 }, SUN, { w: last ? 22 : big ? 15 : 7, ms: big ? 380 : 220, draw: 50 }); if (big) f.later(50, () => f.impact({ x: o.x, y: o.y, z: 20 }, SUN, { r: last ? 80 : 55, embers: last ? 16 : 8 })); else f.later(60, () => f.host.ring(f.host.w3(o.x), f.host.d3(o.y), SUN, 1.1, 240, 0.5)); } }, // (David's bar: a star glyph on the mark, every volley a beam from the sky, the beat's volleys the main hits)
  // Eagle Tide: a great crest of spirit wind runs the length of the arena with the eagle, a streak over it
  eagle_arrow: { tone: SPIRIT, own: true, active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, SPIRIT, { len: 760, ms: 360, h: 150, w: 150 }); f.streak({ x: c.x, y: c.y, z: 90 }, { x: c.x + r.aim.x * 780, y: c.y + r.aim.y * 400, z: 90 }, SPIRIT, { w: 26, ms: 420, draw: 90 }); } },
};
