// PVP 3D — the Book Mage, rebuilt by DFO (David 18 Oct 18:31: "go over it deeply, freehand, and build it as it should be").
// One idea for the whole class, taken from the hero's own card: his magic is STARLIGHT read out of his book — astral cyan
// with star gold, the four-point star and the compass seal of the book's cover. Every spell opens with the book's seal or
// a star at his hand; every blow lands as a star. The book's chapters keep their own light: FROST white-cyan crystal,
// STORM blue-white lightning fringed violet, PAPER cream pages edged in gold. In the room's 3D everything has depth: seals
// lie on the floor in perspective, funnels and columns stand round the fighters, stars turn to the eye.
// The painted layer (MageFx) steps aside in PVP 3D: these pieces carry the skills there.
// The pieces: ../Fx3D.ts (pillar, wave, crystals, bolt, swirl, skyBeam, glyph, floorStreak, impact …) and ./pieces.ts
// (star, seal, funnel, frost, cloud, shell, chains, hole, crane, rider, ribbon, stillBolt).
import type { Recipe, Fx3D, V3 } from '../Fx3D';
import type { CastRun } from '../../skills/SkillRuntime';
import { me, side, placeOf } from './kit';
import { star, seal, funnel, frost, cloud, shell, chains, hole, crane, rider, ribbon, stillBolt, surge } from './pieces';
import { hitIndex } from '../../skills/FinalKit';
import { trioAt, TRIO } from '../../skills/MageTornado';
import { bodyHand } from '../../skills/BodyPoints';

/** The palette (the hero's card): astral cyan and star gold; the chapters' own lights. */
export const MAGE = { astral: 0x3f9dff, gold: 0xffc75a, deep: 0x2f5fe0, frost: 0x8fe0ff, ice: 0xd6f4ff, storm: 0x8fb2ff, volt: 0xb7a2ff, paper: 0xf6eedc };
const { astral: A, gold: GOLD, frost: FROST, ice: ICE, storm: STORM, volt: VOLT, paper: PAPER } = MAGE;
/** The deep blue of the night sky his starlight shines out of (the painted body of his columns and funnels). */
const NIGHT = 0x0c2257, STORMDARK = 0x1c1838, ICEDARK = 0x15384f;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** His book (the hand that holds it), world px: the hand as each frame draws it (BodyPoints, David 3 Nov 01:27 — "under the
 *  palm, in every move"; it was one fixed point 30 ahead, 76 up, below and behind the raised hand), else that point. */
const book = (f: Fx3D, r: CastRun): V3 => { const h = bodyHand.of?.(r.attackerId); if (h) return h; const c = me(f, r); return { x: c.x + side(r) * 30, y: c.y, z: c.z + 76 }; };
const T = (r: CastRun) => r.timings;

// a cast's own state kept between its events (its cloud's flash, its tornado), by cast id
const clouds = new Map<string, (p?: number) => void>();
const tornados = new Map<string, { hold(on: boolean): void; end(): void }>();
const keep = <V>(m: Map<string, V>, k: string, v: V): void => { m.set(k, v); if (m.size > 24) m.delete(m.keys().next().value!); };

/** Arcane Bolt and its attuned kin: two star darts, then the lance (the chain's 3rd beat) charged on an upright seal. */
const bolt = (col: number, el?: 'frost' | 'storm'): Recipe => ({
  tone: col, own: true, trail: { c: col, w: 10, len: 14, i: 2 }, // (2 Nov: a size up — at 7 px the quick bolts read as a thin line)
  cast: (f, r) => {
    const h = book(f, r);
    if (r.stage === 2) { seal(f, h.x, h.y, col, { up: h.z, r: 44, ms: T(r).startup + 160, spin: 3.2, pulse: 5 }); star(f, h, col, { size: 70, ms: T(r).startup + 60, light: 0.5 }); }
    else star(f, h, col, { size: 46, ms: 150, light: 0.35 });
  },
  shot: (f, p) => {
    if (p.pierce) { // the lance: a star drawn out along its flight, a comet's tail, two rings thrown off its head
      rider(f, p, col, { size: 70, stretch: 2.8, glow: 1.25, burst: 1.5 });
      const c = { x: p.x, y: p.y, z: p.z + 62 };
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), col, 0.9, 260, 0.6);
    } else rider(f, p, el === 'frost' ? ICE : col, { size: 60, stretch: 1.6, glow: 1.3, burst: 0.9 }); // (a comet of starlight drawn out along its flight, not a pin-point)
  },
  hit: (f, _s, h, at) => { // (every bolt lands as a star; the lance's a big gold one)
    const z = at.z + 62, big = !!h.heavy;
    star(f, { x: at.x, y: at.y, z }, big ? GOLD : col, { size: big ? 190 : 110, ms: big ? 300 : 220, spin: 1.2 });
    if (el === 'frost') f.crystals(at.x, at.y, { n: big ? 5 : 3, r: 26, h: big ? 70 : 46, ms: 700 });
    if (el === 'storm') for (let k = 0; k < (big ? 3 : 2); k++) { const a = rnd(0, Math.PI * 2); f.bolt({ x: at.x, y: at.y, z }, { x: at.x + Math.cos(a) * 60, y: at.y + Math.sin(a) * 20, z: z + Math.sin(a) * 50 }, STORM, { ms: 140, w: 4, forks: 1, hue: true }); }
  },
});

const THIN = 'assets/final/skills/book_mage/fx3d/thin_bolt.webp', THIN_F: [number, number] = [270, 768]; // (GPT's four classic thin bolts: white-hot hairline cores, fine forks, a cool blue glow fringed violet — David 18 Nov: "classic and refined, not thick")
/** One classic thin bolt from the sky onto `at` (a random one of the four), held `ms`, with a fainter second flash of another. */
function thin(f: Fx3D, at: V3, w = 120, ms = 170, o: { fadeOut?: number; again?: boolean } = {}): void {
  const k = (Math.random() * 4) | 0, base = { frame: THIN_F, fps: 1, loop: true, mode: 'up' as const, foot: true, through: 0.6, glow: 0.35, fadeIn: 0 };
  f.flip(THIN, at, { ...base, from: k, to: k, ms, w, flipX: Math.random() < 0.5, fadeOut: o.fadeOut ?? Math.min(120, ms * 0.6) });
  if (o.again !== false) f.later(70, () => { const j = (k + 1 + ((Math.random() * 3) | 0)) % 4; f.flip(THIN, at, { ...base, from: j, to: j, ms: ms * 0.7, w: w * 0.9, a: 0.55, flipX: Math.random() < 0.5, fadeOut: 90 }); });
}
const WWAVE = 'assets/final/skills/book_mage/fx3d/water_wave.webp', WWAVE_F: [number, number] = [480, 242]; // (GPT's painted wave of arcane water, its own water rippling — 12 frames)
const AWHEEL = 'assets/final/skills/book_mage/fx3d/astral_wheel.webp'; // (GPT's wheel of starlight seen from above: gold runes, constellations, the eight-point star — laid flat and turned)
const ICEF = 'assets/final/skills/book_mage/fx3d/ice_floor.webp'; // (GPT's sheet of glassy ice and hoarfrost seen from above)
const CLOUDS = 'assets/final/skills/book_mage/fx3d/clouds.webp', CLOUDS_F: [number, number] = [400, 132]; // (GPT's soft magic clouds, their own drift)
const ERING = 'assets/final/skills/book_mage/fx3d/thunder_ring.webp', ERING_F: [number, number] = [512, 512]; // (GPT's ring of crackling lightning seen from above, its arcs flickering)
const RIFTV = 'assets/final/skills/book_mage/fx3d/rift_upright.webp', RIFTV_F: [number, number] = [256, 384]; // (GPT's rift standing in the air, swirling)
const STRIKE = 'assets/final/skills/book_mage/fx3d/strike.webp', STRIKE_F: [number, number] = [258, 384]; // (PixVerse from GPT's painted sky strike: the strike, two flickers, the fade — 24 frames)
const NOVA = 'assets/final/skills/book_mage/fx3d/frost_nova.webp', NOVA_F: [number, number] = [420, 282]; // (PixVerse: from black to GPT's painted frost nova — the flash, the crystals bursting up in a ring, the frost — 30 frames)
const ASEAL = 'assets/final/skills/book_mage/fx3d/astral_seal.webp', ASEAL_F: [number, number] = [258, 384], ACOL = 'assets/final/skills/book_mage/fx3d/astral_column.webp', ACOL_F: [number, number] = [331, 512]; // (Astral Lift: PixVerse's rune circle drawing itself, GPT's painted starlight column)
const SPIKES = 'assets/final/skills/book_mage/fx3d/glacial_spikes.webp', SPIKES_F: [number, number] = [420, 210]; // (PixVerse: from black to GPT's painted row of ice spikes — the frost vein racing, the spikes bursting up one after another, growing — 24 frames)
const WAVE = 'assets/final/skills/book_mage/fx3d/arcane_wave.webp', WAVE_F: [number, number] = [420, 205]; // (PixVerse from GPT's painted wave of starlight: the crest curling over — 14 frames)
const BIND = 'assets/final/skills/book_mage/fx3d/binding_rune.webp', BIND_F: [number, number] = [258, 384]; // (PixVerse from GPT's painted binding: the seal flaring open, gold chains closing round the foe — 28 frames)
const WARD = 'assets/final/skills/book_mage/fx3d/arcane_ward.webp', WARD_F: [number, number] = [320, 320]; // (PixVerse from GPT's painted hexagon shell: its cells shimmering, the seal turning — 13 frames, a loop)
const ASC = 'assets/final/skills/book_mage/fx3d/ascension.webp', ASC_F: [number, number] = [240, 357]; // (GPT's frost-and-storm double helix over a snowflake seal, turned by PixVerse)
const BLINK = 'assets/final/skills/book_mage/fx3d/blink.webp', BLINK_F: [number, number] = [341, 512]; // (GPT's teleport flare: a four-point star over a seal, a column of light and shards)
const GATE = 'assets/final/skills/book_mage/fx3d/rift_gate.webp', GATE_F: [number, number] = [420, 282]; // (GPT's floor portal — a violet well in a burning gold rune ring, pages over it — turned by PixVerse, played back and forth)
const LEVITY = 'assets/final/skills/book_mage/fx3d/levity_field.webp', LEVITY_F: [number, number] = [330, 512]; // (GPT's painted zero-gravity column: a star seal, pale light, rocks and pages floating up)
const stillTorn = new Map<string, { end(): void }>();
const TORNADO = 'assets/final/skills/book_mage/fx3d/tornado.webp', TORN_F: [number, number] = [258, 384]; // (PixVerse from GPT's painted tornado, tools/fx/flipbook.py — 40 frames)
export const BOOK_MAGE: Record<string, Recipe> = {
  arcane_bolt: bolt(A), arcane_bolt_arcane: bolt(A), arcane_bolt_frost: bolt(FROST, 'frost'), arcane_bolt_storm: bolt(STORM, 'storm'),

  // ARCANE WAVE — a tide of starlight rolls out over the floor from his feet: the seal flashes under him, three crests run
  // out across the lane's depth (the middle one tallest), stars glinting in their foam, a band of light left on the planks
  arcane_wave: { tone: A, own: true,
    // (David 18 Nov: "the water idea is nice but looks bad — make it a professional 3D wave, really like a wave"): GPT's
    // painted wave of arcane water (glassy sapphire to turquoise, its crest curling and breaking into foam, gold stars
    // in it), rippling as it runs (water_wave: 12 frames of its own water moving), rolls out along the lane growing as it
    // goes; two smaller waves a beat behind it at either side keep its depth across the lane; spray where it strikes
    cast: (f, r) => { f.flipLoad(WWAVE); star(f, book(f, r), A, { size: 64, ms: T(r).startup + 80, light: 0.4 }); },
    active: (f, r) => {
      const c = me(f, r), ax = r.aim.x || side(r);
      const roll = (dy: number, delay: number, from: number, to: number, w: number, a: number) => f.later(delay, () => {
        const t0 = performance.now(), ms = 560;
        f.flip(WWAVE, () => { const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - (1 - k) * (1 - k); return { x: c.x + ax * (from + (to - from) * e), y: c.y + dy, z: 0 }; },
          { frame: WWAVE_F, fps: 16, loop: true, ms, w, mode: 'up', foot: true, through: 0.55, a, glow: 0.2, grow: [0.7, 1.08], flipX: ax < 0, fadeIn: 70, fadeOut: 200 });
      });
      roll(0, 0, 20, 270, 340, 1);
      roll(-58, 60, 10, 220, 240, 0.7); roll(58, 60, 10, 220, 240, 0.7);
    },
    hit: (f, _s, _h, at, main) => { if (main) { f.host.embers(f.host.w3(at.x), 0.6, f.host.d3(at.y), FROST, 7, 1.4); } },
  },

  // BINDING RUNE — sprung: the seal flares under the foe and four chains of starlight shoot up from its points and close
  // round him; they stay pulled tight for the bind (3 s), humming, and snap into motes when it lets go
  binding_rune: { tone: A, own: true,
    cast: (f) => f.flipLoad(BIND),
    hit: (f, _s, _h, at) => { // (a bind is no 'main' blow — it throws no one — but it is the whole skill)
      const p = { x: at.x, y: at.y, z: 0 }; // (the painted binding: the seal flares open under him and gold chains close round him, then hold — humming — for the 3 s bind; he reads through it)
      f.flip(BIND, p, { frame: BIND_F, fps: 24, w: 250, mode: 'up', anchorY: 0.14, through: 0.55, glow: 0.25 });
      f.later(1150, () => f.flip(BIND, p, { frame: BIND_F, from: 27, to: 27, fps: 1, loop: true, ms: 1850, w: 250, mode: 'up', anchorY: 0.14, through: 0.55, glow: 0.3, fadeIn: 0, fadeOut: 380 }));
      star(f, { x: at.x, y: at.y, z: (at.z ?? 0) + 70 }, GOLD, { size: 170, ms: 280 });
      f.host.ring(f.host.w3(at.x), f.host.d3(at.y), A, 1.7, 380, 0.7);
    },
  },

  // ASTRAL LIFT — a constellation lights on the floor under the foe (its stars drawn together by lines), then it erupts:
  // a twisting column of starlight throws him up and a gold star bursts at its top; he sinks back slowly in a soft tube of
  // light with stars drifting up it
  astral_burst: { tone: A, own: true,
    // ASTRAL WHEEL (David 18 Nov): GPT's wheel of starlight (gold runes, constellations, the eight-point star) laid flat on
    // the floor where she aims, turning slowly for 5 s; each tap a soft pulse of its light and a ring; every other tap a
    // thin classic bolt falls onto it from above
    cast: (f, r) => { const p = placeOf(f, r); f.flipLoad(AWHEEL); f.flipLoad(THIN); f.flip(AWHEEL, { x: p.x, y: p.y, z: 0 }, { fps: 1, loop: true, w: 270, mode: 'floor', spin: 40, through: 0.5, a: 0.5, glow: 0.2, grow: [0.3, 1], ms: T(r).startup + 60, fadeIn: 80, fadeOut: 60 }); },
    active: (f, r) => {
      const p = placeOf(f, r), life = (r.skill.zoneMs ?? 5000) + 200;
      f.flip(AWHEEL, { x: p.x, y: p.y, z: 0 }, { fps: 1, loop: true, w: 290, mode: 'floor', spin: 22, a: 0.9, glow: 0.3, ms: life, fadeIn: 0, fadeOut: 420 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), A, 2.0, 380, 0.5);
    },
    tick: (f, r, at, i) => {
      const p = placeOf(f, r);
      f.flip(AWHEEL, { x: p.x, y: p.y, z: 0 }, { fps: 1, loop: true, w: 290, mode: 'floor', spin: 22, a: 0.45, glow: 0.5, ms: 260, grow: [1, 1.06], fadeIn: 30, fadeOut: 200 }); // (the tap: its light pulses)
      if (i % 2 === 0) { const a = rnd(0, Math.PI * 2), d = rnd(0, 90); thin(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, 90, 160); }
      void at;
    },
    hit: (f, _s, _h, at, main) => { star(f, { x: at.x, y: at.y, z: at.z + 50 }, GOLD, { size: main ? 120 : 80, ms: 180, light: 0.2 }); },
  },

  // FROST NOVA — the cold gathers in to his feet (motes spiralling inward over a frost seal), then bursts out: hoarfrost races
  // over the planks, two rings of ice crystals break out of the floor one after the other, a white-cyan star at his heart;
  // the frost lies a moment and melts
  frost_nova: { tone: FROST, own: true,
    cast: (f, r) => { const c = me(f, r); f.flipLoad(NOVA); seal(f, c.x, c.y, FROST, { r: 96, ms: T(r).startup + 240, spin: 1.6, star: ICE }); f.swirl(() => ({ x: c.x, y: c.y, z: 0 }), {}, { n: 34, r0: 170, r1: 26, h: 150, ms: T(r).startup + 60, rps: 1.1, rise: 1.4, size: 0.5, color: ICE }); },
    active: (f, r) => {
      const c = me(f, r);
      f.flip(NOVA, { x: c.x, y: c.y, z: 0 }, { frame: NOVA_F, fps: 22, w: 420, mode: 'up', anchorY: 0.42, through: 0.7, a: 0.8, glow: 0.15, tint: FROST, core: 0.9, coreMs: 220, fadeOut: 420, ms: 1700, from: 0, to: 29 }); // (the painted nova: crystals burst up in a ring round her, frost rolling out; she reads through it)
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), FROST, 2.4, 420, 0.7); f.later(150, () => f.host.ring(f.host.w3(c.x), f.host.d3(c.y), ICE, 3.2, 460, 0.55));
      f.host.embers(f.host.w3(c.x), 0.4, f.host.d3(c.y), ICE, 16, 2.2);
    },
  },

  // LIGHTNING CHAIN — the book crackles; a forked bolt leaps from it to the first foe and on from foe to foe (the room's
  // chain bolt), each struck one crackling in a cage of small arcs; the last link a bolt out of the sky
  lightning_chain: { tone: STORM, own: true, trail: false,
    // (David 18 Nov: "looks cut and broken" — each link is now one classic thin painted bolt laid along it, flickering twice)
    chain: (f, r, o, t) => {
      const a = { x: o.x, y: o.y, z: o.z + 70 }, b = { x: t.x, y: t.y, z: t.z + 70 };
      const dx = b.x - a.x, dz = (b.z - a.z) - (b.y - a.y) * 0.35, len = Math.max(40, Math.hypot(dx, dz));
      const rot = (Math.atan2(dz, dx) * 180) / Math.PI - 90, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
      for (let n = 0; n < 2; n++) f.later(n * 90, () => { const k = (Math.random() * 4) | 0; f.flip(THIN, mid, { frame: THIN_F, from: k, to: k, fps: 1, loop: true, ms: n ? 140 : 200, w: len / 2.6, mode: 'up', anchorY: 0.5, rot, through: 0.7, glow: 0.35, a: n ? 0.6 : 1, flipX: Math.random() < 0.5, fadeIn: 0, fadeOut: 110 }); });
    },
    cast: (f, r) => { const t0 = T(r).startup; f.flipLoad(STRIKE); for (let k = 0; k < 5; k++) f.later((k * t0) / 5, () => { const h = book(f, r), a = rnd(0, Math.PI * 2); f.bolt(h, { x: h.x + Math.cos(a) * 40, y: h.y, z: h.z + Math.sin(a) * 40 }, VOLT, { ms: 90, w: 3, forks: 0, hue: true }); }); },
    hit: (f, s, h, at, main) => {
      const z = (at.z ?? 0) + 62;
      for (let k = 0; k < (main ? 3 : 2); k++) { const a = rnd(0, Math.PI * 2); f.bolt({ x: at.x, y: at.y, z }, { x: at.x + Math.cos(a) * 45, y: at.y + Math.sin(a) * 15, z: z + Math.sin(a) * 45 }, VOLT, { ms: 120, w: 1.6, forks: 1, hue: true }); }
      star(f, { x: at.x, y: at.y, z }, STORM, { size: main ? 130 : 90, ms: 200 });
      if (main && hitIndex(s, h) === s.hits.length - 1) { thin(f, { x: at.x, y: at.y, z: 0 }, 130, 200); f.host.kick(0.03); } // (the last link: the painted strike out of the sky onto him)
    },
  },

  // STORM FIELD (the signature) — the seal opens on the floor and a storm cloud gathers over it; the wind turns on the
  // floor, stray bolts fall out of the cloud lighting it from inside; each pulse a bolt onto the field's heart, the last
  // one the great strike: a beam out of the sky, a star, a ring thrown over the floor
  storm_field: { tone: STORM, own: true,
    cast: (f, r) => {
      const p = placeOf(f, r), life = T(r).startup + (r.skill.zoneMs ?? 1500);
      f.flipLoad(STRIKE); seal(f, p.x, p.y, STORM, { r: 175, ms: life + 300, spin: 0.7, pulse: 2, star: VOLT });
      keep(clouds, r.castId, cloud(f, p.x, p.y, { r: 210, h: 340, ms: life + 500, color: VOLT, n: 8 }));
    },
    active: (f, r) => {
      const p = placeOf(f, r), life = r.skill.zoneMs ?? 1500, flash = clouds.get(r.castId);
      f.swirl(() => ({ x: p.x, y: p.y, z: 0 }), {}, { n: 60, r0: 150, r1: 205, h: 150, ms: life, rps: 0.9, rise: 0.8, size: 0.6, color: STORM });
      for (let t = 120; t < life - 120; t += 260) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(60, 190); thin(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, 95, 150); flash?.(0.45); });
    },
    fired: (f, r, i) => {
      const p = placeOf(f, r), last = i === r.hits.length - 1, flash = clouds.get(r.castId);
      flash?.(last ? 1.3 : 0.8);
      thin(f, { x: p.x + rnd(-14, 14), y: p.y, z: 0 }, last ? 170 : 125, last ? 260 : 180); // (each pulse the painted strike out of the cloud onto its heart)
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), STORM, last ? 3.4 : 1.8, last ? 520 : 320, 0.65);
      if (last) { star(f, { x: p.x, y: p.y, z: 60 }, VOLT, { size: 320, ms: 360 }); f.crack(p.x, p.y, STORM, { r: 150, chunks: 12 }); f.host.kick(0.05); }
    },
  },

  // TIME COLLAPSE (the ultimate; David 18 Oct 01:26: "white eyes and lightning — a tornado and lightning over the field"):
  // the great seal opens and the storm gathers in its wind-up (his white-eyed portrait crosses the screen); then a
  // tornado drops out of the cloud onto the field and draws them in, lightning lashing all round — and TIME STOPS: the
  // tornado stands still, its lightning hangs frozen in the air; then it all shatters at once: one beam out of the sky
  // onto its heart, a star, the floor torn, the frozen storm bursting into motes
  time_collapse: { tone: VOLT, own: true,
    cast: (f, r) => {
      const p = placeOf(f, r), t0 = T(r).startup, life = t0 + T(r).active + 400; f.flipLoad(TORNADO); f.flipLoad(STRIKE);
      seal(f, p.x, p.y, VOLT, { r: 300, ms: life, spin: 0.35, star: GOLD, pulse: 1.2 });
      const flash = cloud(f, p.x, p.y, { r: 320, h: 400, ms: life + 300, color: VOLT, n: 12 }); keep(clouds, r.castId, flash);
      for (let t = 360; t < t0; t += 240) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(120, 320); thin(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, 105, 160); flash(0.5); });
    },
    active: (f, r) => {
      const p = placeOf(f, r), ms = T(r).active, flash = clouds.get(r.castId); let on = true; f.later(ms + 60, () => { on = false; });
      const at = () => (on ? { x: p.x, y: p.y, z: 0 } : null);
      // (the painted tornado — PixVerse footage of GPT's art — turning on the field; the fighters inside read through it)
      const tw = f.flip(TORNADO, at, { frame: TORN_F, fps: 14, loop: true, ms: ms + 60, w: 440, mode: 'up', foot: true, through: 0.55, glow: 0.25, grow: [0.6, 1], fadeIn: 160, fadeOut: 160 });
      keep(tornados, r.castId, { hold: () => { tw.end(); const still = f.flip(TORNADO, at, { frame: TORN_F, from: 21, to: 21, fps: 1, loop: true, ms: 1100, w: 440, mode: 'up', foot: true, through: 0.55, glow: 0.35, fadeIn: 0 }); stillTorn.set(r.castId, still); }, end: () => { tw.end(); stillTorn.get(r.castId)?.end(); stillTorn.delete(r.castId); } });
      for (let t = 60; t < 260; t += 70) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(240, 330); thin(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, 100, 160); flash?.(0.6); });
    },
    fired: (f, r, i, o) => {
      const p = placeOf(f, r), flash = clouds.get(r.castId);
      if (i === 1) { // time stops: the tornado stands still, lightning frozen where it struck, a ring of stillness
        tornados.get(r.castId)?.hold(true); flash?.(1);
        for (let k = 0; k < 4; k++) { const a = ((k + 0.5) / 4) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(290, 340); thin(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, 115, 980, { fadeOut: 240, again: false }); }
        f.host.ring(f.host.w3(p.x), f.host.d3(p.y), GOLD, 4.0, 700, 0.5);
        star(f, { x: p.x, y: p.y, z: 300 }, GOLD, { size: 380, ms: 900, spin: 0.2, a: 0.7 });
      }
      if (i === 2) { // the collapse
        tornados.get(r.castId)?.end(); flash?.(1.6);
        thin(f, { x: p.x, y: p.y, z: 0 }, 190, 320); thin(f, { x: p.x - 60, y: p.y + 10, z: 0 }, 120, 220); thin(f, { x: p.x + 60, y: p.y - 10, z: 0 }, 120, 220);
        star(f, { x: p.x, y: p.y, z: 120 }, GOLD, { size: 520, ms: 420 });
        f.crack(p.x, p.y, VOLT, { r: 220, chunks: 22 });
        f.host.ring(f.host.w3(p.x), f.host.d3(p.y), VOLT, 5.0, 640, 0.7); f.later(90, () => f.host.ring(f.host.w3(p.x), f.host.d3(p.y), GOLD, 3.4, 520, 0.6));
        f.host.embers(f.host.w3(p.x), 2.0, f.host.d3(p.y), VOLT, 30, 3.5); f.host.kick(0.09);
        void o;
      }
    },
  },

  // BLINK — he folds into a star where he stands; a ribbon of light runs to where he steps out (and a streak over the
  // floor), and he unfolds out of a star there, a small seal flashing at his feet
  blink: { tone: A, own: true,
    // CLOUD ASCENT (David 18 Nov: "clouds round the mage, he rises and stays hovering"): GPT's soft magic clouds gather
    // round her feet and carry her up; they stay under and round her while she hovers (8 s), drifting, then thin away
    cast: (f, r) => { const c = me(f, r); f.flipLoad(CLOUDS); f.flip(CLOUDS, { x: c.x, y: c.y, z: 0 }, { frame: CLOUDS_F, fps: 10, loop: true, w: 220, mode: 'up', anchorY: 0.3, through: 0.6, a: 0.8, glow: 0.1, grow: [0.4, 1], ms: T(r).startup + 120, fadeIn: 120, fadeOut: 80 }); },
    active: (f, r) => {
      const id = r.attackerId, t0 = f.now, ms = 8000;
      const at = () => { if (f.now - t0 > ms) return null; const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: c.z - 20 } : null; };
      f.flip(CLOUDS, at, { frame: CLOUDS_F, fps: 10, loop: true, w: 230, mode: 'up', anchorY: 0.4, through: 0.65, a: 0.9, glow: 0.1, ms, fadeIn: 0, fadeOut: 700 });
      f.flip(CLOUDS, () => { const q = at(); return q ? { x: q.x + 4, y: q.y - 2, z: q.z + 10 } : null; }, { frame: CLOUDS_F, fps: 8, loop: true, w: 300, mode: 'up', anchorY: 0.45, through: 0.75, a: 0.4, glow: 0, flipX: true, ms, fadeIn: 300, fadeOut: 700 });
    },
  },

  // GLACIAL SPIKES — three lines of ice spikes break out of the floor one after another along the fan, growing as they go,
  // a vein of hoarfrost under each line; they stand as a wall, then shatter
  glacial_spikes: { tone: FROST, own: true, trail: false,
    // FROST FIELD (David 18 Nov: "an ice floor laid over a very wide field"): GPT's sheet of glassy ice and hoarfrost spreads
    // out flat on the planks where she aims (all the lane's depth), stands 6 s glinting, then melts away
    cast: (f, r) => { f.flipLoad(ICEF); const c = me(f, r); f.host.embers(f.host.w3(c.x), 0.2, f.host.d3(c.y), FROST, 10, 1.4); },
    active: (f, r) => {
      const p = placeOf(f, r), life = (r.skill.zoneMs ?? 6000) + 300;
      f.flip(ICEF, { x: p.x, y: p.y, z: 0 }, { fps: 1, loop: true, w: 430, mode: 'floor', a: 0.85, glow: 0.15, ms: life, grow: [0.2, 1], fadeIn: 60, fadeOut: 900 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), FROST, 2.6, 420, 0.5);
    },
    tick: (f, r, _at, i) => { if (i % 3) return; const p = placeOf(f, r), a = rnd(0, Math.PI * 2), d = rnd(20, 180); star(f, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 4 }, ICE, { size: 40, ms: 260, light: 0 }); }, // (a glint on the ice)
  },

  // LEVITY FIELD — gravity turns over where he aims: an ice-white seal turns slowly on the floor, a soft column of pale
  // light over it, motes and torn pages drifting up it (the foes float in it)
  levity_field: { tone: ICE, own: true,
    // LEVITY FIELD (David 18 Nov: "improve its look significantly"): the starlight wheel opens on the floor in cold blue and
    // turns the other way; pages, stones and motes of light rise slowly up out of it, the air over it shimmering
    cast: (f, r) => { const p = placeOf(f, r); f.flipLoad(AWHEEL); f.flip(AWHEEL, { x: p.x, y: p.y, z: 0 }, { fps: 1, loop: true, w: 250, mode: 'floor', spin: -50, tint: 0x9fdcff, core: 0.6, a: 0.6, glow: 0.2, grow: [0.3, 1], ms: T(r).startup + 60, fadeIn: 80, fadeOut: 60 }); },
    active: (f, r) => {
      const p = placeOf(f, r), life = r.skill.zoneMs ?? 2500, at = () => ({ x: p.x, y: p.y, z: 0 });
      f.flip(AWHEEL, at, { fps: 1, loop: true, w: 260, mode: 'floor', spin: -18, tint: 0x9fdcff, core: 0.6, a: 0.95, glow: 0.3, ms: life + 300, fadeIn: 0, fadeOut: 500 });
      f.swirl(at, {}, { n: 36, r0: 95, r1: 40, h: 360, ms: life, rps: 0.16, rise: 0.5, size: 0.45, color: ICE });
      f.swirl(at, { tex: 'mage-page', size: 0.8, aspect: 1.3, crumble: 'wind' }, { n: 7, r0: 80, r1: 50, h: 260, ms: life, rps: 0.12, rise: 0.35 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), ICE, 1.6, 400, 0.5);
    },
  },

  // ORIGAMI FLOCK — pages flutter out of the book, and each flies as a real paper crane, its wings beating, gold on its
  // edges; it bursts into torn paper where it strikes
  origami_flock: { tone: PAPER, own: true, trail: { c: GOLD, w: 7, len: 12, i: 1.1 },
    cast: (f, r) => { const h = book(f, r); f.swirl(() => book(f, r), { tex: 'mage-page', size: 0.6, aspect: 1.3, crumble: 'wind' }, { n: 6, r0: 14, r1: 30, h: 50, ms: T(r).startup, rps: 1.6, rise: 0.8 }); star(f, h, GOLD, { size: 60, ms: T(r).startup, light: 0.3 }); },
    shot: (f, p) => crane(f, p, { tex: 'mage-page', size: 44 }),
    hit: (f, _s, _h, at) => { const P = f.unit({ x: at.x, y: at.y, z: at.z + 60 }); f.host.embers(P.x, P.y, P.z, PAPER, 8, 1.8); star(f, { x: at.x, y: at.y, z: at.z + 60 }, GOLD, { size: 80, ms: 180, light: 0.2 }); },
  },

  // ARCANE WARD — a sphere of hexagons closes round him (the ward, 8 s): it lights where a blow lands on it, and when it
  // breaks it shatters into light (the frost ring that chills is the game's: wardHit)
  arcane_ward: { tone: A, own: true,
    // ARCANE WARD (David 18 Nov: "too massive — let the aura turn round the mage gently; no need for that whole sphere"):
    // a small wheel of starlight turning under her feet and a light ribbon of motes circling her slowly
    cast: (f, r) => { f.flipLoad(AWHEEL); const c = me(f, r); star(f, { x: c.x, y: c.y, z: 70 }, A, { size: 90, ms: 220, light: 0.3 }); },
    active: (f, r) => mageWard(f, r.attackerId, 8000),
  },

  // PAPER CURSE — pages fly out of the book to the foe and fold round him: a whirl of torn pages wrapping him (the silence)
  paper_curse: { tone: PAPER, own: true, trail: false,
    cast: (f, r) => { const h = book(f, r); star(f, h, PAPER, { size: 60, ms: T(r).startup, light: 0.2 }); },
    hit: (f, _s, _h, at) => {
      f.swirl(() => ({ x: at.x, y: at.y, z: at.z }), { tex: 'mage-page', size: 0.8, aspect: 1.3, crumble: 'wind' }, { n: 14, r0: 60, r1: 34, h: 150, ms: 1100, rps: 1.3, rise: 0.9 });
      star(f, { x: at.x, y: at.y, z: at.z + 70 }, GOLD, { size: 120, ms: 260 });
    },
  },

  // ELEMENTAL ASCENSION — the seal opens under him in both chapters' lights; frost and storm braid up round him in two
  // streams turning against each other, bolts strike down onto him, a beam of frost light; then (20 s) the book's two
  // lights stay with him: ice motes orbiting him, small arcs crackling over him now and then
  elemental_ascension: { tone: STORM, own: true,
    // TEMPEST TRIO (David 18 Nov: "3 tornadoes coming from different directions, slowly, turning round the map 10 s"): the
    // painted tornado three times, each rising at its own side of the field and wandering on its path (MageTornado), the
    // same path the scene's hits follow; a thin bolt now and then out of each
    cast: (f, r) => { f.flipLoad(TORNADO); const p = placeOf(f, r); for (let n = 0; n < TRIO.n; n++) { const q = trioAt(p, n, 0); f.host.ring(f.host.w3(q.x), f.host.d3(q.y), STORM, 1.2, T(r).startup, 0.4); } },
    active: (f, r) => {
      const p = placeOf(f, r), t0 = f.now;
      for (let n = 0; n < TRIO.n; n++) f.flip(TORNADO, () => { const t = f.now - t0; if (t > TRIO.ms + 200) return null; const q = trioAt(p, n, t); return { x: q.x, y: q.y, z: 0 }; },
        { frame: TORN_F, from: 0, to: 39, fps: 16, loop: true, ms: TRIO.ms + 200, w: 190, mode: 'up', foot: true, through: 0.55, glow: 0.2, grow: [0.3, 1], fadeIn: 400, fadeOut: 500, delay: n * 180 });
    },
    tick: (f, _r, at, i) => { if (i % 6 === 5) thin(f, { x: at.x + rnd(-20, 20), y: at.y, z: 0 }, 80, 140); },
  },

  // RIFT GATES — each gate a portal in the floor for its 10 s: a dark well with light spiralling down into it inside a
  // burning ring of runes, pages circling slowly over it; crossing, light pours down into the gate under him and he
  // rises out of the other in a beam, a star unfolding round him
  rift_gates: { tone: A, own: true,
    // RIFT GATES (David 18 Nov: "not on the floor — a magic hole; touching it carries her to the other; 10 s"): GPT's rift
    // standing upright in the air where she was (a violet tear rimmed with gold runes, swirling into deep space); walking
    // into one, both flare and she comes out of the other (mageRiftCross)
    cast: (f, r) => {
      const id = r.attackerId, c = me(f, r); f.flipLoad(RIFTV); f.flipLoad(BLINK);
      const list = liveGates(id), g: Gate = { x: c.x, y: c.y, dead: false }; list.push(g); while (list.length > 2) list.shift()!.dead = true; gates.set(id, list); f.later(10200, () => { g.dead = true; });
      f.flip(RIFTV, () => (g.dead ? null : { x: g.x, y: g.y - 4, z: 0 }), { frame: RIFTV_F, fps: 10, loop: true, ms: 10200, w: 150, mode: 'up', foot: true, through: 0.5, glow: 0.25, grow: [0.2, 1], fadeIn: 260, fadeOut: 300 });
      star(f, { x: c.x, y: c.y, z: 80 }, A, { size: 140, ms: 260 });
    },
  },

  // TEMPEST RIDE — a tornado wraps him and carries him for the ride: a funnel of storm wind turning round him (bending as
  // it travels), pages and sparks spinning up it, bolts lashing out of it at each cut; at its end it is flung wide
  tempest_ride: { tone: STORM, own: true,
    // THUNDER RING (David 18 Nov: "a small ring of electricity growing round the character while the key is held, up to
    // 8 s"): GPT's ring of crackling lightning laid flat round her feet, turning, widening from 60 to 290 px over the 8 s
    // the scene holds it; small thin arcs snap along its rim; it ends the moment she lets go (the run leaves 'active')
    cast: (f, r) => { f.flipLoad(ERING); f.flipLoad(THIN); const c = me(f, r); star(f, { x: c.x, y: c.y, z: 70 }, STORM, { size: 80, ms: 180, light: 0.3 }); },
    active: (f, r) => {
      const id = r.attackerId, ms = T(r).active, t0 = f.now;
      const at = () => { if (r.phase !== 'active' || f.now - t0 > ms) return null; const c = f.host.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; };
      f.flip(ERING, at, { frame: ERING_F, fps: 12, loop: true, w: 620, mode: 'floor', spin: 60, a: 0.95, glow: 0.35, ms, grow: [0.2, 1], fadeIn: 60, fadeOut: 160 });
      const arc = () => { const c = at(); if (!c) return; const k = Math.min(1, (f.now - t0) / ms), rr = 60 + 230 * k, a = rnd(0, Math.PI * 2); thin(f, { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.45, z: 0 }, 34 + 30 * k, 110, { again: false }); f.later(rnd(140, 260), arc); };
      f.later(120, arc);
    },
    hit: (f, _s, _h, at) => { f.bolt({ x: at.x, y: at.y, z: at.z + 60 }, { x: at.x + rnd(-30, 30), y: at.y, z: at.z + 60 + rnd(-30, 30) }, VOLT, { ms: 100, w: 1.4, forks: 1, hue: true }); },
  },
  // the Sailwright (Styles.ts): his own 2D pieces (WindFx) stay with him — the fan's thin pale-mint pressure edges, the room
  // answering in the same colour; no seals, no storms, no tornado of the book's spells
  ...Object.fromEntries(['mw_four_beat', 'mw_sail_edge', 'mw_updraft_hook', 'mw_cut_across', 'mw_windward_spike', 'mw_keel_drop', 'mw_sky_loom', 'mw_luff_step', 'mw_skimming_edge', 'mw_mastguard', 'mw_kite_needle', 'mw_tackline_draw', 'mw_slipwake'].map((id) => [id, {
    tone: 0xa8f0d8, paint: true, trail: false, own: true,
  } as Recipe])),
  // the Fulminant Conductor (Styles.ts): his own 2D pieces (LightningFx) stay with him — the current in his fork, the room
  // answering in electric blue; no chain lightning, no storm, no bolt from the sky of the book's spells
  ...Object.fromEntries(['ml_four_beat', 'ml_probe_jab', 'ml_closing_stroke', 'ml_riser_prong', 'ml_arc_clamp', 'ml_return_spark', 'ml_earth_pin', 'ml_zero_interval', 'ml_blue_needle', 'ml_faraday_fold', 'ml_rail_slide', 'ml_insulator_split', 'ml_capacitor_kick'].map((id) => [id, {
    tone: 0x6cc8ff, paint: true, trail: false, own: true,
  } as Recipe])),
};

// (the painted sheets are fetched the first time any of her spells is cast, so no spell plays its art late the first time)
const SHEETS = [AWHEEL, ICEF, CLOUDS, ERING, RIFTV, WWAVE, THIN, TORNADO, STRIKE, NOVA, ASEAL, ACOL, SPIKES, WAVE, BIND, WARD, LEVITY, ASC, BLINK, GATE];
const sheetsAsked = new WeakSet<Fx3D>();
for (const id of Object.keys(BOOK_MAGE)) {
  const rec = BOOK_MAGE[id], cast = rec.cast;
  rec.cast = (f, r) => { if (!sheetsAsked.has(f)) { sheetsAsked.add(f); for (const src of SHEETS) f.flipLoad(src); } cast?.(f, r); };
}

for (const rc of Object.values(BOOK_MAGE)) rc.paint = true; // (his blows land in his colours: the shell of the room's impact painted)

// ------------------------------------------------------------------ what the game tells the room about the mage

/** Arcane Ward's sphere, by the mage (the game's wardHit lights it / shatters it). */
const wards = new Map<string, { hit(from?: V3): void; stop(shatter?: boolean): void }>();
/** A ward's sphere round `id` for `ms` (his own cast, or a party member sharing it). */
export function mageWard(f: Fx3D, id: string, ms: number): void {
  wards.get(id)?.stop(); let live = true;
  const at = () => { const c = f.host.casterPos(id); return live && c ? { x: c.x, y: c.y, z: 0 } : null; };
  // (David 18 Nov: a gentle aura, no sphere): a small starlight wheel turning under her and a slow ribbon of motes round her
  const wh = f.flip(AWHEEL, at, { fps: 1, loop: true, w: 120, mode: 'floor', spin: 30, a: 0.7, glow: 0.25, ms, grow: [0.5, 1], fadeIn: 200, fadeOut: 300 });
  f.swirl(at, {}, { n: 14, r0: 44, r1: 48, h: 150, ms, rps: 0.3, rise: 0.05, size: 0.45, color: A });
  f.swirl(at, {}, { n: 6, r0: 50, r1: 52, h: 120, ms, rps: -0.22, rise: 0.05, size: 0.5, color: GOLD });
  wards.set(id, { hit: () => { const c = at(); if (c) star(f, { x: c.x, y: c.y, z: 80 }, A, { size: 110, ms: 180 }); }, stop: (shatter?: boolean) => { const c = at(); live = false; wh.end(); if (shatter && c) { star(f, { x: c.x, y: c.y, z: 80 }, A, { size: 200, ms: 260 }); f.host.embers(f.host.w3(c.x), 0.8, f.host.d3(c.y), A, 14, 2.2); } } });
}
/** The ward took a blow (`broken`: it broke) or ran out (`expired`). */
export function mageWardHit(f: Fx3D, id: string, broken: boolean, expired = false): void {
  const w = wards.get(id); if (!w) return;
  if (broken || expired) { w.stop(broken); wards.delete(id); } else w.hit();
}
/** A Binding Rune laid on the floor (armed): its seal turns there until it is sprung or gone (`gone()`). */
const runes = new Map<string, () => void>();
export function mageRune(f: Fx3D, key: string, x: number, y: number, lifeMs: number): void {
  let live = true; runes.get(key)?.(); runes.set(key, () => { live = false; });
  seal(f, x, y, A, { r: 50, ms: lifeMs, spin: 0.8, pulse: 1.4, a: 0.75, follow: () => (live ? { x, y, z: 0 } : null) }); // (sprung or gone: it closes)
  star(f, { x, y, z: 10 }, A, { size: 90, ms: 220, light: 0.3 });
}
export function mageRuneGone(key: string): void { runes.get(key)?.(); runes.delete(key); }

// Rift Gates: the gates he lays, mirrored from the casts (two at most, the oldest moved by a third, 10 s each — the scene's RIFT)
type Gate = { x: number; y: number; dead: boolean };
const gates = new Map<string, Gate[]>();
const liveGates = (id: string): Gate[] => (gates.get(id) ?? []).filter((g) => !g.dead);

/** Rift Gates: she walked into one portal (`from`) and comes out of the other (`to`): both rifts flare, a ribbon of light
 *  between them, the blink flare where she rises. */
export function mageRiftCross(f: Fx3D, id: string, from: { x: number; y: number }, to: { x: number; y: number }): void {
  void id;
  f.flip(RIFTV, { x: from.x, y: from.y - 4, z: 0 }, { frame: RIFTV_F, fps: 14, loop: true, ms: 260, w: 180, mode: 'up', foot: true, through: 0.5, a: 0.8, glow: 0.6, grow: [1, 0.85], fadeIn: 0, fadeOut: 200 });
  f.later(110, () => {
    f.flip(RIFTV, { x: to.x, y: to.y - 4, z: 0 }, { frame: RIFTV_F, fps: 14, loop: true, ms: 280, w: 180, mode: 'up', foot: true, through: 0.5, a: 0.8, glow: 0.6, grow: [0.85, 1], fadeIn: 0, fadeOut: 220 });
    f.flip(BLINK, { x: to.x, y: to.y, z: 0 }, { frame: BLINK_F, fps: 1, ms: 300, w: 150, mode: 'up', anchorY: 0.12, through: 0.75, a: 0.7, glow: 0.3, grow: [0.4, 1.05], fadeIn: 30, fadeOut: 220 });
  });
}
