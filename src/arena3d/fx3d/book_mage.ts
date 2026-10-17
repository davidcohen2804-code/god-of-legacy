// PVP 3D — the Book Mage's skills in the room's 3D (frost, storm, arcane): what each skill adds in 3D on top of its painted effect.
// Owned by the Book Mage chat. One shape per skill, so no two read alike: the bolt a thin trail, the wave a low wide crest, the
// rune a short trap column, Astral Lift the one tall twisting column (the launcher), Frost Nova a ring of crystals at its rim,
// Glacial Spikes crystals marching along the aim, the chain 3D lightning link to link, Storm Field bolts out of the sky (the last
// one the big one), Levity a pale dome with motes rising, Time Collapse an imploding dome then a violet column (never white),
// Page Bind the book's slam arc. Sizes kept to the hero's scale; nothing pure white, so the fighters always read.
// Each recipe's `tone`: the colour the room answers its blows in — arcane violet, frost cyan, storm violet-blue, paper white.
// The pieces (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, placeOf } from './kit';

export const BOOK_MAGE: Record<string, Recipe> = {
  // the regular bolt: a thin violet trail; the default main-hit layer marks the blow
  arcane_bolt: { tone: C.arcane, trail: { c: C.arcane, w: 10, len: 14, i: 1.2 },
    // each throw the flick of her hand as an inked ring at hand height; the lance (3rd beat) charges on a rune glyph and throws with an upright ring (the main hit's impact is the room's)
    cast: (f, r) => { if (r.stage === 2) { const c = me(f, r); f.glyph(c.x, c.y, C.arcane, { shape: 'runes', r: 90, ms: 560, spin: 1.6, pulse: 2 }); } },
    active: (f, r) => { const c = me(f, r), d = side(r); if (r.stage === 2) f.slash(c, d, C.arcane, { r: 92, w: 30, tilt: 90, a0: -70, a1: 70, ms: 210, y0: 72, ink: true }); else f.slash(c, d, C.arcane, { r: 70, w: 20, tilt: r.stage ? 25 : 70, a0: -40, a1: 55, ms: 160, y0: 76, ink: true, quiet: true }); } },
  // a wide, low crest of arcane force running along the floor (it lifts the foe: the default launch layer under him)
  // (David 18 Oct: "like a page, hits one point" → a tide with depth: three crests fan out across the floor, toward and away from the view, under an inked crescent lying flat on the planks)
  arcane_wave: { tone: C.arcane, active: (f, r) => { const c = me(f, r); for (const [dy, k] of [[r.aim.y, 1], [-0.5, 0.8], [0.5, 0.8]] as const) f.wave(c.x, c.y, r.aim.x, dy, C.arcane, { len: 440 * k, ms: 320, h: 110 * k, w: 190 }); f.slash(c, side(r), C.arcane, { r: 210, w: 80, tilt: 0, a0: -60, a1: 60, ms: 340, y0: 14, ink: true }); } },
  // the trap snaps: a net of rune chains closes over the foe (the SNARE trial: under a falling foe it catches him as he lands)
  binding_rune: { tone: C.arcane, own: true, hit: (f, _s, _h, at) => { const z = at.z ?? 0; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; f.streak({ x: at.x + Math.cos(a) * 95, y: at.y + Math.sin(a) * 60, z: 0 }, { x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 9, z: z + 70 + (k % 2) * 40 }, C.arcane, { w: 5, ms: 520, draw: 110 }); } f.host.ring(f.host.w3(at.x), f.host.d3(at.y), C.arcane, 1.6, 360, 0.7); } }, // (the net: six chains of rune light snap up from the floor and close over the foe — on a falling foe it catches him as he lands)
  // the launcher: the class's one tall twisting column, under the foe it throws up
  // (a rune glyph opens under the foe in the wind-up; the release: the twisting star column with a hot core and one inked ring sweeping up through him — the throw)
  astral_burst: { tone: C.storm, own: true,
    cast: (f, r) => { const p = placeOf(f, r, 120); f.glyph(p.x, p.y, C.arcane, { shape: 'runes', r: 80, ms: 620, spin: 2.2, pulse: 2 }); },
    active: (f, r) => { const p = placeOf(f, r, 120); f.pillar(p.x, p.y, C.storm, { h: 520, r: 32, ms: 460, twist: true, i: 0.8 }); f.slash(p, side(r), C.arcane, { r: 85, w: 44, tilt: 90, a0: -110, a1: 70, ms: 230, y0: 95, ink: true }); } },
  // cold bursting out round her: crystals grow at the rim (the fighters inside stay clear), a pale shell, frost dust
  frost_nova: { tone: C.frost, own: true, active: (f, r) => { const c = me(f, r); f.crystals(c.x, c.y, { n: 12, r: 185, h: 120, ms: 1400, ring: true }); f.dome(c.x, c.y, C.frost, { r: 200, ms: 340, a: 0.5 }); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 1.1); } },
  // lightning leaping link to link; the main link flashes a small shell on the foe
  lightning_chain: { own: true, tone: C.storm, chainBolt: C.storm, trail: false, hit: (f, s, h, at, main) => { if (!main) return; const z = at.z ?? 0; if (h.at === s.hits[s.hits.length - 1].at) { f.bolt({ x: at.x + 30, y: at.y, z: z + 640 }, { x: at.x, y: at.y, z: z + 40 }, C.storm, { ms: 280, w: 6, forks: 1 }); f.host.kick(0.03); } } /* (the links are the beam itself: no sphere on each foe) */ }, // (the last link: a real bolt out of the sky through the room onto him)
  // the signature (the reference's book mage, 08): a spiral glyph turns and pulses on the floor for the field's life, lightning with legs down to the floor
  // strikes round it, and every pulse a beam struck from the sky onto its heart (the last the big one; the room's impact is the main hit)
  storm_field: { tone: C.storm,
    own: true,
    active: (f, r) => { const p = placeOf(f, r); const life = r.skill.zoneMs ?? 2400; f.glyph(p.x, p.y, C.storm, { shape: 'spiral', r: 200, ms: life, spin: 0.7, pulse: 2.2 }); for (let t = 200; t < life; t += 460) f.later(t, () => { const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 80; f.bolt({ x: p.x + Math.cos(a) * d * 0.5, y: p.y, z: 700 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, C.storm, { ms: 180, w: 5, forks: 2 }); }); },
    fired: (f, r, i) => { const p = placeOf(f, r), last = i === r.hits.length - 1; f.skyBeam({ x: p.x, y: p.y, z: 0 }, C.storm, { ms: last ? 520 : 320, w: last ? 16 : 9 }); if (last) f.host.kick(0.05); },
  },
  // the ultimate (David 18 Oct 01:26: "a tornado and lightning bolts over the map" — one idea): a violet storm tornado rises over the field,
  // sparks and her torn pages spinning up its funnel, lightning striking out of the sky all over the field while it turns; the blast flings
  // it outward with one beam onto its heart (her portrait with white eyes and lightning is the moment before it)
  time_collapse: { tone: C.storm, own: true,
    active: (f, r) => { const p = placeOf(f, r), ms = r.timings.active + 300, at = () => ({ x: p.x, y: p.y, z: 0 });
      f.swirl(at, {}, { n: 110, r0: 60, r1: 260, h: 560, ms, rps: 1.5, rise: 0.8, size: 0.9, color: C.storm });
      f.swirl(at, { tex: 'mage-page', size: 1.1, aspect: 1.3, crumble: 'wind' }, { n: 22, r0: 90, r1: 230, h: 460, ms, rps: 1.1, rise: 0.6 });
      f.pillar(p.x, p.y, C.storm, { h: 600, r: 70, ms, twist: true, i: 0.35, core: false });
      for (let t = 80; t < ms - 200; t += 150) f.later(t, () => { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 300; f.bolt({ x: p.x + Math.cos(a) * d * 0.6, y: p.y, z: 760 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, Math.random() < 0.5 ? C.storm : C.arcane, { ms: 170, w: 5, forks: 2 }); }); },
    fired: (f, r, i) => { if (i !== 2) return; const p = placeOf(f, r); f.skyBeam({ x: p.x, y: p.y, z: 0 }, C.storm, { ms: 560, w: 22 }); f.host.ring(f.host.w3(p.x), f.host.d3(p.y), C.storm, 4.2, 600, 0.6); f.host.kick(0.08); } },
  // a slim flicker where she vanishes and where she steps out
  blink: { tone: C.arcane, cast: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 240, r: 24, ms: 260, core: false, i: 0.7 }); }, active: (f, r) => f.later(60, () => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 240, r: 24, ms: 300, core: false, i: 0.7 }); }) },
  // ice marching along the aim; the main hit grows a bigger cluster on the foe
  glacial_spikes: { tone: C.frost, trail: { c: C.frost, w: 9 }, own: true, hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 7, r: 95, h: 115, ms: 1200, ring: true }); }, active: (f, r) => { const c = me(f, r); f.later(120, () => f.crystals(c.x + r.aim.x * 240, c.y + r.aim.y * 140, { n: 4, r: 40, h: 100, ms: 900 })); } }, // (few crystal groups: each one lights the room, stacked they white it out)
  // gravity turned over: a pale shell and motes drifting up out of it
  levity_field: { tone: C.ice, own: true, active: (f, r) => { const p = placeOf(f, r); const life = r.skill.zoneMs ?? 1800; f.dome(p.x, p.y, C.frost, { r: 180, ms: life, a: 0.22, hold: 1 }); for (let t = 0; t < life; t += 350) f.later(t, () => f.host.embers(f.host.w3(p.x), 0.1, f.host.d3(p.y), C.ice, 6, 1.4)); } },
  // paper cranes: a soft paper trail each
  origami_flock: { tone: C.paper, own: true, trail: { c: C.paper, w: 6, len: 12, i: 0.8 } },
  // the rune shell round her, following her
  arcane_ward: { tone: C.arcane, own: true, active: (f, r) => f.dome(me(f, r).x, me(f, r).y, C.arcane, { r: 140, ms: 900, a: 0.5, follow: () => f.host.casterPos(r.attackerId) }) },
  // the pages fly to the foe as a paper streak (not lightning: that is the chain's)
  paper_curse: { tone: C.paper, trail: false, hit: (f, _s, _h, at, main) => { if (!main) return; f.dome(at.x, at.y, C.paper, { r: 90, ms: 300, a: 0.45 }); } },
  // the big buff: frost and storm columns braided round her, a shell — kept below white
  elemental_ascension: { tone: C.frost, own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.frost, { h: 620, r: 54, ms: 720, twist: true, i: 1.15 }); f.later(120, () => f.pillar(c.x, c.y, C.storm, { h: 540, r: 34, ms: 600, twist: true, core: false })); f.dome(c.x, c.y, C.arcane, { r: 230, ms: 440, a: 0.55 }); } },
  // the book slammed shut: a short arc of paper light, frost crystals where it lands
  page_bind: { tone: C.paper, active: (f, r) => f.slash(me(f, r), side(r), C.paper, { r: 130, tilt: 20, a0: -40, a1: 140, ms: 240, i: 1.0 }), hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 4, r: 40, h: 70, ms: 800 }); } },
};
