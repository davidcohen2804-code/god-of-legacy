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
  binding_rune: { tone: C.arcane, own: true, hit: (f, _s, _h, at) => { const z = at.z ?? 0; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; f.streak({ x: at.x + Math.cos(a) * 95, y: at.y + Math.sin(a) * 60, z: 0 }, { x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 9, z: z + 70 + (k % 2) * 40 }, C.arcane, { w: 5, ms: 520, draw: 110 }); } f.host.ring(f.host.w3(at.x), f.host.d3(at.y), C.arcane, 1.6, 360, 0.7); f.glyph(at.x, at.y, C.arcane, { shape: 'runes', r: 75, ms: 3000, spin: 0.8, pulse: 1.5 }); for (let t = 700; t < 2900; t += 700) f.later(t, () => { for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + t; f.streak({ x: at.x + Math.cos(a) * 70, y: at.y + Math.sin(a) * 44, z: 0 }, { x: at.x + Math.cos(a) * 12, y: at.y + Math.sin(a) * 8, z: z + 60 + (k % 2) * 40 }, C.arcane, { w: 4, ms: 420, draw: 90 }); } }); } }, // (David 18 Oct: the bind holds 3 s and must read — the rune glyph stays under him and the chains snap tight again every 0.7 s) // (the net: six chains of rune light snap up from the floor and close over the foe — on a falling foe it catches him as he lands)
  // the launcher: the class's one tall twisting column, under the foe it throws up
  // (a rune glyph opens under the foe in the wind-up; the release: the twisting star column with a hot core and one inked ring sweeping up through him — the throw)
  astral_burst: { tone: C.storm, own: true,
    cast: (f, r) => { const p = placeOf(f, r, 120); f.glyph(p.x, p.y, C.arcane, { shape: 'runes', r: 80, ms: 620, spin: 2.2, pulse: 2 }); },
    active: (f, r) => { const p = placeOf(f, r, 120); f.pillar(p.x, p.y, C.storm, { h: 520, r: 32, ms: 460, twist: true, i: 0.8 }); f.slash(p, side(r), C.arcane, { r: 85, w: 44, tilt: 90, a0: -110, a1: 70, ms: 230, y0: 95, ink: true }); },
    // (David 18 Oct: the tube of light holds him and lowers him slowly — a soft twisting tube stays round the thrown foe for his slow fall, motes rising in it)
    hit: (f, _s, _h, at, main) => { if (!main) return; f.pillar(at.x, at.y, C.storm, { h: 560, r: 48, ms: 2000, twist: true, i: 0.4, core: false }); f.swirl(() => ({ x: at.x, y: at.y, z: 0 }), {}, { n: 30, r0: 40, r1: 52, h: 520, ms: 1900, rps: 0.6, rise: 0.5, size: 0.6, color: C.storm }); } },
  // cold bursting out round her: crystals grow at the rim (the fighters inside stay clear), a pale shell, frost dust
  frost_nova: { tone: C.frost, own: true, active: (f, r) => { const c = me(f, r); [[90, 6, 70], [150, 9, 95], [210, 12, 120]].forEach(([rr, n, h], k) => f.crystals(c.x, c.y, { n, r: rr, h, ms: 1300 - k * 100, ring: true, delay: k * 70 })); f.slash(c, side(r), C.frost, { r: 230, w: 60, tilt: 0, a0: -180, a1: 180, ms: 300, y0: 8, ink: 0x1d3a5a }); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 1.1); } }, // (David 18 Oct: "a broken animation" → one clean idea: a wave of ice bursting out from her feet — three rings of crystals standing up one after another, an inked frost ring racing flat over the floor; no shell)
  // lightning leaping link to link; the main link flashes a small shell on the foe
  lightning_chain: { own: true, tone: C.storm, chainBolt: C.storm, trail: false, hit: (f, s, h, at, main) => { if (!main) return; const z = at.z ?? 0; if (h.at === s.hits[s.hits.length - 1].at) { f.bolt({ x: at.x + 30, y: at.y, z: z + 640 }, { x: at.x, y: at.y, z: z + 40 }, C.storm, { ms: 280, w: 6, forks: 1 }); f.host.kick(0.03); } } /* (the links are the beam itself: no sphere on each foe) */ }, // (the last link: a real bolt out of the sky through the room onto him)
  // the signature (the reference's book mage, 08): a spiral glyph turns and pulses on the floor for the field's life, lightning with legs down to the floor
  // strikes round it, and every pulse a beam struck from the sky onto its heart (the last the big one; the room's impact is the main hit)
  storm_field: { tone: C.storm,
    own: true,
    // (David 18 Oct: "good direction, improve the whole process" — wind-up: the spiral glyph opens on the floor; the field: the storm's wind rises
    // round it as a wide turning cylinder of sparks, lightning with legs strikes inside it; each pulse a beam from the sky onto its heart; the
    // finale: the biggest beam, a star glyph flaring over the spiral and a ring thrown out over the floor)
    cast: (f, r) => { const p = placeOf(f, r); f.glyph(p.x, p.y, C.storm, { shape: 'spiral', r: 200, ms: r.timings.startup + (r.skill.zoneMs ?? 1800), spin: 0.7, pulse: 2.2 }); },
    active: (f, r) => { const p = placeOf(f, r), life = r.skill.zoneMs ?? 1800; f.swirl(() => ({ x: p.x, y: p.y, z: 0 }), {}, { n: 70, r0: 190, r1: 230, h: 560, ms: life, rps: 0.8, rise: 1, size: 0.7, color: C.storm }); for (let t = 150; t < life - 150; t += 300) f.later(t, () => { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140; f.bolt({ x: p.x + Math.cos(a) * d * 0.5, y: p.y, z: 640 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, C.storm, { ms: 170, w: 5, forks: 2 }); }); },
    fired: (f, r, i) => { const p = placeOf(f, r), last = i === r.hits.length - 1; f.skyBeam({ x: p.x, y: p.y, z: 0 }, C.storm, { ms: last ? 560 : 320, w: last ? 18 : 9 }); if (last) { f.glyph(p.x, p.y, C.storm, { shape: 'star', r: 250, ms: 600, spin: 3, pulse: 3, points: 8 }); f.host.ring(f.host.w3(p.x), f.host.d3(p.y), C.storm, 3.2, 520, 0.6); f.host.kick(0.05); } },
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
  blink: { tone: C.arcane, own: true, cast: (f, r) => { const c = me(f, r); f.skyBeam({ x: c.x, y: c.y, z: 0 }, C.arcane, { ms: 260, w: 7 }); }, active: (f, r) => { const a0 = me(f, r); f.later(r.timings.active + 20, () => { const b = me(f, r); f.floorStreak(a0.x, a0.y, b.x, b.y, C.arcane, { w: 10, ms: 380 }); f.skyBeam({ x: b.x, y: b.y, z: 0 }, C.arcane, { ms: 300, w: 7 }); f.slash(b, side(r), C.arcane, { r: 70, w: 26, tilt: 0, a0: -180, a1: 180, ms: 260, y0: 10, ink: true, quiet: true }); }); } }, // (David 18 Oct: "unclear" → read at a glance: she goes up in a thin beam, a streak of light runs over the floor to where she lands, she comes down in a beam with a ring at her feet)
  // ice marching along the aim; the main hit grows a bigger cluster on the foe
  glacial_spikes: { tone: C.frost, trail: { c: C.frost, w: 9 }, own: true, hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 5, r: 80, h: 110, ms: 1200, ring: true }); }, active: (f, r) => { const c = me(f, r), b = Math.atan2(r.aim.y, r.aim.x); for (const da of [-0.26, 0, 0.26]) { const dx = Math.cos(b + da), dy = Math.sin(b + da); for (let k = da ? 1 : 0; k < 6; k += da ? 2 : 1) f.crystals(c.x + dx * (70 + k * 42), c.y + dy * (70 + k * 42) * 0.6, { n: da ? 1 : 2, r: 14, h: (da ? 55 : 80) + k * 12, ms: 1500 - k * 40, delay: 40 + k * 45 }); } /* (the side lines every other step: each crystal group lights the room, more whited the lane) */ } }, // (David 18 Oct: improve all of it → three lines of real ice spikes erupting one after another along the fan, growing as they go, standing, then crumbling)
  // gravity turned over: a pale shell and motes drifting up out of it
  levity_field: { tone: C.ice, own: true, active: (f, r) => { const p = placeOf(f, r), life = r.skill.zoneMs ?? 1800; f.glyph(p.x, p.y, C.ice, { shape: 'star', r: 120, ms: life, spin: 0.5, pulse: 1.5, points: 6 }); f.swirl(() => ({ x: p.x, y: p.y, z: 0 }), {}, { n: 40, r0: 90, r1: 70, h: 360, ms: life, rps: 0.35, rise: 0.9, size: 0.7, color: C.ice }); f.pillar(p.x, p.y, C.ice, { h: 380, r: 100, ms: life, i: 0.22, core: false }); } }, // (David 18 Oct: improve → gravity turned over: a six-point star glyph on the floor, motes drifting slowly up a soft column of pale light; no dome)
  // paper cranes: a soft paper trail each
  origami_flock: { tone: C.paper, own: true, trail: { c: C.paper, w: 6, len: 12, i: 0.8 } },
  // the rune shell round her, following her
  arcane_ward: { tone: C.arcane, own: true, active: (f, r) => { const id = r.attackerId, at = () => { const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; }; f.bladeBall(id, C.arcane, { r: 75, ms: 520, every: 60, ink: true }); f.swirl(at, {}, { n: 26, r0: 58, r1: 62, h: 170, ms: 8000, rps: 0.45, rise: 0.05, size: 0.55, color: C.arcane }); } }, // (David 18 Oct: "toy-like" → real 3D: inked rune rings close round her at many angles, then small rune sparks keep orbiting her body for the ward)
  // the pages fly to the foe as a paper streak (not lightning: that is the chain's)
  paper_curse: { tone: C.paper, trail: false, hit: (f, _s, _h, at, main) => { if (!main) return; f.dome(at.x, at.y, C.paper, { r: 90, ms: 300, a: 0.45 }); } },
  // the big buff: frost and storm columns braided round her, a shell — kept below white
  elemental_ascension: { tone: C.frost, own: true, active: (f, r) => { const id = r.attackerId, c = me(f, r), at = () => { const p = f.host.casterPos(id); return p ? { x: p.x, y: p.y, z: 0 } : null; }; f.swirl(at, {}, { n: 40, r0: 50, r1: 90, h: 300, ms: 1600, rps: 1.2, rise: 0.9, size: 0.7, color: C.frost }); f.swirl(at, {}, { n: 40, r0: 50, r1: 90, h: 300, ms: 1600, rps: -1.2, rise: 0.9, size: 0.7, color: C.storm }); f.bladeBall(id, C.storm, { r: 85, ms: 600, every: 70, ink: true }); f.skyBeam({ x: c.x, y: c.y, z: 0 }, C.frost, { ms: 420, w: 14 }); } }, // (David 18 Oct: unprofessional on the hero → frost and storm braided round her: two streams of sparks spiralling up her in opposite turns, inked storm rings closing round her, a beam of frost light down onto her)
  // the book slammed shut: a short arc of paper light, frost crystals where it lands
  page_bind: { tone: C.paper, active: (f, r) => f.slash(me(f, r), side(r), C.paper, { r: 130, tilt: 20, a0: -40, a1: 140, ms: 240, i: 1.0 }), hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 4, r: 40, h: 70, ms: 800 }); } },
};
