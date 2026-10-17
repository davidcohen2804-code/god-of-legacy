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
  arcane_bolt: { tone: C.arcane, trail: { c: C.arcane, w: 10, len: 12 } },
  // a wide, low crest of arcane force running along the floor (it lifts the foe: the default launch layer under him)
  arcane_wave: { tone: C.arcane, active: (f, r) => { const c = me(f, r); f.wave(c.x, c.y, r.aim.x, r.aim.y, C.arcane, { len: 420, ms: 280, h: 110, w: 170 }); } },
  // the trap snaps: a net of rune chains closes over the foe (the SNARE trial: under a falling foe it catches him as he lands)
  binding_rune: { tone: C.arcane, own: true, hit: (f, _s, _h, at) => { const z = at.z ?? 0; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; f.streak({ x: at.x + Math.cos(a) * 95, y: at.y + Math.sin(a) * 60, z: 0 }, { x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 9, z: z + 70 + (k % 2) * 40 }, C.arcane, { w: 5, ms: 520, draw: 110 }); } f.host.ring(f.host.w3(at.x), f.host.d3(at.y), C.arcane, 1.6, 360, 0.7); } }, // (the net: six chains of rune light snap up from the floor and close over the foe — on a falling foe it catches him as he lands)
  // the launcher: the class's one tall twisting column, under the foe it throws up
  astral_burst: { tone: C.storm, own: true, active: (f, r) => { const p = placeOf(f, r, 120); f.pillar(p.x, p.y, C.storm, { h: 520, r: 36, ms: 520, twist: true, i: 0.75, core: false }); f.dome(p.x, p.y, C.arcane, { r: 110, ms: 300, a: 0.28 }); } },
  // cold bursting out round her: crystals grow at the rim (the fighters inside stay clear), a pale shell, frost dust
  frost_nova: { tone: C.frost, own: true, active: (f, r) => { const c = me(f, r); f.crystals(c.x, c.y, { n: 12, r: 185, h: 120, ms: 1400, ring: true }); f.dome(c.x, c.y, C.frost, { r: 200, ms: 340, a: 0.5 }); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 1.1); } },
  // lightning leaping link to link; the main link flashes a small shell on the foe
  lightning_chain: { tone: C.storm, chainBolt: C.storm, trail: false, hit: (f, s, h, at, main) => { if (!main) return; const z = at.z ?? 0; if (h.at === s.hits[s.hits.length - 1].at) { f.bolt({ x: at.x + 30, y: at.y, z: z + 640 }, { x: at.x, y: at.y, z: z + 40 }, C.storm, { ms: 280, w: 10, forks: 2 }); f.host.kick(0.03); } else f.dome(at.x, at.y, C.storm, { r: 70, ms: 200, a: 0.3 }); } }, // (the last link: a real bolt out of the sky through the room onto him)
  // the signature: a faint storm shell over the field and bolts out of the sky; the last strike a heavy bolt that cracks the floor
  storm_field: { tone: C.storm,
    own: true,
    active: (f, r) => { const p = placeOf(f, r); const life = r.skill.zoneMs ?? 2400; f.dome(p.x, p.y, C.storm, { r: 220, ms: life, a: 0.2, hold: 1 }); for (let t = 0; t < life; t += 280) f.later(t, () => { const a = Math.random() * Math.PI * 2, d = Math.random() * 190; f.bolt({ x: p.x + Math.cos(a) * d * 0.4, y: p.y, z: 700 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, C.storm, { ms: 180, w: 7, forks: 1 }); }); },
    hit: (f, s, h, at) => { if (h.at !== s.hits[s.hits.length - 1].at) return; f.bolt({ x: at.x, y: at.y, z: 900 }, { x: at.x, y: at.y, z: 0 }, C.storm, { ms: 320, w: 16, forks: 3 }); f.crack(at.x, at.y, C.storm, { r: 120, chunks: 10 }); f.host.kick(0.05); },
  },
  // the ultimate: space folds in (an imploding dome), then a violet column with a crown of crystals — strong, never a white-out
  time_collapse: { tone: C.arcane, own: true, active: (f, r) => { const p = placeOf(f, r); f.dome(p.x, p.y, C.arcane, { r: 380, ms: 1100, implode: true, a: 0.6 }); f.later(1000, () => { f.pillar(p.x, p.y, C.arcane, { h: 820, r: 70, ms: 700, i: 1.4, twist: true }); f.crystals(p.x, p.y, { n: 14, r: 210, h: 160, ms: 1700, ring: true, color: C.arcane }); f.host.ring(f.host.w3(p.x), f.host.d3(p.y), C.storm, 4.2, 600, 0.7); f.host.impact({ x: p.x, y: p.y, z: 60 }, 2); f.host.kick(0.08); }); } },
  // a slim flicker where she vanishes and where she steps out
  blink: { tone: C.arcane, cast: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 240, r: 24, ms: 260, core: false, i: 0.7 }); }, active: (f, r) => f.later(60, () => { const c = me(f, r); f.pillar(c.x, c.y, C.arcane, { h: 240, r: 24, ms: 300, core: false, i: 0.7 }); }) },
  // ice marching along the aim; the main hit grows a bigger cluster on the foe
  glacial_spikes: { tone: C.frost, trail: { c: C.frost, w: 9 }, own: true, hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 7, r: 95, h: 115, ms: 1200, ring: true }); }, active: (f, r) => { const c = me(f, r); f.later(120, () => f.crystals(c.x + r.aim.x * 240, c.y + r.aim.y * 140, { n: 4, r: 40, h: 100, ms: 900 })); } }, // (few crystal groups: each one lights the room, stacked they white it out)
  // gravity turned over: a pale shell and motes drifting up out of it
  levity_field: { tone: C.ice, own: true, active: (f, r) => { const p = placeOf(f, r); const life = r.skill.zoneMs ?? 1800; f.dome(p.x, p.y, C.frost, { r: 180, ms: life, a: 0.22, hold: 1 }); for (let t = 0; t < life; t += 350) f.later(t, () => f.host.embers(f.host.w3(p.x), 0.1, f.host.d3(p.y), C.ice, 6, 1.4)); } },
  // paper cranes: a soft paper trail each
  origami_flock: { tone: C.paper, trail: { c: C.paper, w: 7, len: 10, i: 1.4 } },
  // the rune shell round her, following her
  arcane_ward: { tone: C.arcane, own: true, active: (f, r) => f.dome(me(f, r).x, me(f, r).y, C.arcane, { r: 140, ms: 900, a: 0.5, follow: () => f.host.casterPos(r.attackerId) }) },
  // the pages fly to the foe as a paper streak (not lightning: that is the chain's)
  paper_curse: { tone: C.paper, trail: false, hit: (f, _s, _h, at, main) => { if (!main) return; f.dome(at.x, at.y, C.paper, { r: 90, ms: 300, a: 0.45 }); } },
  // the big buff: frost and storm columns braided round her, a shell — kept below white
  elemental_ascension: { tone: C.frost, own: true, active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.frost, { h: 620, r: 54, ms: 720, twist: true, i: 1.15 }); f.later(120, () => f.pillar(c.x, c.y, C.storm, { h: 540, r: 34, ms: 600, twist: true, core: false })); f.dome(c.x, c.y, C.arcane, { r: 230, ms: 440, a: 0.55 }); } },
  // the book slammed shut: a short arc of paper light, frost crystals where it lands
  page_bind: { tone: C.paper, active: (f, r) => f.slash(me(f, r), side(r), C.paper, { r: 130, tilt: 20, a0: -40, a1: 140, ms: 240, i: 1.0 }), hit: (f, _s, _h, at, main) => { if (main) f.crystals(at.x, at.y, { n: 4, r: 40, h: 70, ms: 800 }); } },
};
