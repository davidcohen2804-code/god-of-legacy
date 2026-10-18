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

/** The palette (the hero's card): astral cyan and star gold; the chapters' own lights. */
export const MAGE = { astral: 0x3f9dff, gold: 0xffc75a, deep: 0x2f5fe0, frost: 0x8fe0ff, ice: 0xd6f4ff, storm: 0x8fb2ff, volt: 0xb7a2ff, paper: 0xf6eedc };
const { astral: A, gold: GOLD, frost: FROST, ice: ICE, storm: STORM, volt: VOLT, paper: PAPER } = MAGE;
/** The deep blue of the night sky his starlight shines out of (the painted body of his columns and funnels). */
const NIGHT = 0x0c2257, STORMDARK = 0x1c1838, ICEDARK = 0x15384f;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** His book (the hand that holds it), world px. */
const book = (f: Fx3D, r: CastRun): V3 => { const c = me(f, r); return { x: c.x + side(r) * 30, y: c.y, z: c.z + 76 }; };
const T = (r: CastRun) => r.timings;

// a cast's own state kept between its events (its cloud's flash, its tornado), by cast id
const clouds = new Map<string, (p?: number) => void>();
const tornados = new Map<string, { hold(on: boolean): void; end(): void }>();
const keep = <V>(m: Map<string, V>, k: string, v: V): void => { m.set(k, v); if (m.size > 24) m.delete(m.keys().next().value!); };

/** Arcane Bolt and its attuned kin: two star darts, then the lance (the chain's 3rd beat) charged on an upright seal. */
const bolt = (col: number, el?: 'frost' | 'storm'): Recipe => ({
  tone: col, own: true, trail: { c: col, w: 7, len: 12, i: 1.7 },
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
    } else rider(f, p, el === 'frost' ? ICE : col, { size: 40, spin: 9, burst: 0.8 });
  },
  hit: (f, _s, h, at) => { // (every bolt lands as a star; the lance's a big gold one)
    const z = at.z + 62, big = !!h.heavy;
    star(f, { x: at.x, y: at.y, z }, big ? GOLD : col, { size: big ? 190 : 110, ms: big ? 300 : 220, spin: 1.2 });
    if (el === 'frost') f.crystals(at.x, at.y, { n: big ? 5 : 3, r: 26, h: big ? 70 : 46, ms: 700 });
    if (el === 'storm') for (let k = 0; k < (big ? 3 : 2); k++) { const a = rnd(0, Math.PI * 2); f.bolt({ x: at.x, y: at.y, z }, { x: at.x + Math.cos(a) * 60, y: at.y + Math.sin(a) * 20, z: z + Math.sin(a) * 50 }, STORM, { ms: 140, w: 4, forks: 1, hue: true }); }
  },
});

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
    cast: (f, r) => star(f, book(f, r), A, { size: 64, ms: T(r).startup + 80, light: 0.4 }),
    active: (f, r) => {
      const c = me(f, r), ax = r.aim.x || side(r);
      seal(f, c.x + ax * 26, c.y, A, { r: 74, ms: 420, spin: 2.6 });
      for (const [dy, k] of [[0, 1], [-0.3, 0.74], [0.3, 0.74]] as const) surge(f, c.x + ax * 20, c.y, ax, dy, A, { len: 300 * k, ms: 320, h: 118 * k, w: 170, delay: k < 1 ? 40 : 0 });
      for (let i = 0; i < 8; i++) star(f, { x: c.x + ax * (60 + i * 34), y: c.y + rnd(-80, 80), z: rnd(16, 96) }, i % 3 ? A : GOLD, { size: rnd(40, 70), ms: 260, delay: 30 + i * 30, light: 0 });
      f.floorStreak(c.x + ax * 10, c.y, c.x + ax * 320, c.y, A, { w: 150, ms: 560, a: 0.42 });
      f.host.dust(f.host.w3(c.x + ax * 120), f.host.d3(c.y), 5, 0.8);
    },
    hit: (f, _s, _h, at, main) => { if (main) star(f, { x: at.x, y: at.y, z: at.z + 50 }, GOLD, { size: 150, ms: 260 }); },
  },

  // BINDING RUNE — sprung: the seal flares under the foe and four chains of starlight shoot up from its points and close
  // round him; they stay pulled tight for the bind (3 s), humming, and snap into motes when it lets go
  binding_rune: { tone: A, own: true,
    hit: (f, _s, _h, at) => { // (a bind is no 'main' blow — it throws no one — but it is the whole skill)
      seal(f, at.x, at.y, A, { r: 92, ms: 3100, spin: 1.4, pulse: 2.2 });
      const pts = [0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; return { x: at.x + Math.cos(a) * 88, y: at.y + Math.sin(a) * 52 }; });
      chains(f, pts, () => ({ x: at.x, y: at.y, z: (at.z ?? 0) + 66 }), GOLD, { ms: 3000, draw: 150, w: 13 });
      star(f, { x: at.x, y: at.y, z: (at.z ?? 0) + 70 }, GOLD, { size: 170, ms: 280 });
      f.host.ring(f.host.w3(at.x), f.host.d3(at.y), A, 1.7, 380, 0.7);
    },
  },

  // ASTRAL LIFT — a constellation lights on the floor under the foe (its stars drawn together by lines), then it erupts:
  // a twisting column of starlight throws him up and a gold star bursts at its top; he sinks back slowly in a soft tube of
  // light with stars drifting up it
  astral_burst: { tone: A, own: true,
    cast: (f, r) => {
      const p = placeOf(f, r, 80), N = 6, pts: V3[] = [];
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(40, 95); pts.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.6, z: 3 }); }
      const t0 = T(r).startup;
      pts.forEach((q, i) => {
        star(f, { ...q, z: 10 }, i % 2 ? GOLD : A, { size: 64, ms: t0 + 200, delay: (i * t0) / N * 0.7, light: 0.2, back: true, spin: 0.3 });
        if (i) f.later((i * t0) / N * 0.7, () => f.floorStreak(pts[i - 1].x, pts[i - 1].y, q.x, q.y, A, { w: 9, ms: t0 + 260, a: 0.95 }));
      });
      seal(f, p.x, p.y, A, { r: 110, ms: t0 + 320, spin: 1.8, pulse: 3 });
    },
    active: (f, r) => {
      const p = placeOf(f, r, 80), at = () => ({ x: p.x, y: p.y, z: 0 });
      funnel(f, at, A, { ms: 480, h: 620, r0: 34, r1: 46, rps: 2.6, sway: 6, layers: 2, dark: NIGHT, color2: GOLD });
      star(f, { x: p.x, y: p.y, z: 330 }, GOLD, { size: 240, ms: 380, delay: 60 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), A, 2.0, 420, 0.7);
    },
    hit: (f, _s, _h, at, main) => {
      if (!main) return; // the column of night sky he sinks back down in (the slow fall: 1.8 s), stars rising in it
      funnel(f, () => ({ x: at.x, y: at.y, z: 0 }), A, { ms: 2000, h: 580, r0: 46, r1: 56, rps: 0.45, sway: 4, layers: 1, dark: NIGHT, a: 0.6 });
      f.swirl(() => ({ x: at.x, y: at.y, z: 0 }), {}, { n: 30, r0: 34, r1: 48, h: 520, ms: 1900, rps: 0.5, rise: 0.45, size: 0.6, color: GOLD });
    },
  },

  // FROST NOVA — the cold gathers in to his feet (motes spiralling inward over a frost seal), then bursts out: hoarfrost races
  // over the planks, two rings of ice crystals break out of the floor one after the other, a white-cyan star at his heart;
  // the frost lies a moment and melts
  frost_nova: { tone: FROST, own: true,
    cast: (f, r) => { const c = me(f, r); seal(f, c.x, c.y, FROST, { r: 96, ms: T(r).startup + 240, spin: 1.6, star: ICE }); f.swirl(() => ({ x: c.x, y: c.y, z: 0 }), {}, { n: 34, r0: 170, r1: 26, h: 150, ms: T(r).startup + 60, rps: 1.1, rise: 1.4, size: 0.5, color: ICE }); },
    active: (f, r) => {
      const c = me(f, r);
      frost(f, c.x, c.y, { r: 215, grow: 230, hold: 900, melt: 800, color: FROST });
      f.crystals(c.x, c.y, { n: 9, r: 112, h: 86, ms: 1300, ring: true });
      f.crystals(c.x, c.y, { n: 14, r: 172, h: 112, ms: 1250, ring: true, delay: 150 });
      star(f, { x: c.x, y: c.y, z: 58 }, ICE, { size: 230, ms: 280 });
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), FROST, 2.4, 420, 0.7); f.later(150, () => f.host.ring(f.host.w3(c.x), f.host.d3(c.y), ICE, 3.2, 460, 0.55));
      f.host.embers(f.host.w3(c.x), 0.4, f.host.d3(c.y), ICE, 16, 2.2);
    },
  },

  // LIGHTNING CHAIN — the book crackles; a forked bolt leaps from it to the first foe and on from foe to foe (the room's
  // chain bolt), each struck one crackling in a cage of small arcs; the last link a bolt out of the sky
  lightning_chain: { tone: STORM, own: true, chainBolt: STORM, trail: false,
    cast: (f, r) => { const t0 = T(r).startup; for (let k = 0; k < 5; k++) f.later((k * t0) / 5, () => { const h = book(f, r), a = rnd(0, Math.PI * 2); f.bolt(h, { x: h.x + Math.cos(a) * 40, y: h.y, z: h.z + Math.sin(a) * 40 }, VOLT, { ms: 90, w: 3, forks: 0, hue: true }); }); },
    hit: (f, s, h, at, main) => {
      const z = (at.z ?? 0) + 62;
      for (let k = 0; k < (main ? 3 : 2); k++) { const a = rnd(0, Math.PI * 2); f.bolt({ x: at.x, y: at.y, z }, { x: at.x + Math.cos(a) * 55, y: at.y + Math.sin(a) * 18, z: z + Math.sin(a) * 55 }, VOLT, { ms: 150, w: 3.5, forks: 1, hue: true }); }
      star(f, { x: at.x, y: at.y, z }, STORM, { size: main ? 130 : 90, ms: 200 });
      if (main && hitIndex(s, h) === s.hits.length - 1) { f.bolt({ x: at.x + 30, y: at.y, z: z + 640 }, { x: at.x, y: at.y, z: z - 20 }, STORM, { ms: 300, w: 8, forks: 2, hue: true }); f.host.kick(0.03); }
    },
  },

  // STORM FIELD (the signature) — the seal opens on the floor and a storm cloud gathers over it; the wind turns on the
  // floor, stray bolts fall out of the cloud lighting it from inside; each pulse a bolt onto the field's heart, the last
  // one the great strike: a beam out of the sky, a star, a ring thrown over the floor
  storm_field: { tone: STORM, own: true,
    cast: (f, r) => {
      const p = placeOf(f, r), life = T(r).startup + (r.skill.zoneMs ?? 1500);
      seal(f, p.x, p.y, STORM, { r: 175, ms: life + 300, spin: 0.7, pulse: 2, star: VOLT });
      keep(clouds, r.castId, cloud(f, p.x, p.y, { r: 210, h: 340, ms: life + 500, color: VOLT, n: 8 }));
    },
    active: (f, r) => {
      const p = placeOf(f, r), life = r.skill.zoneMs ?? 1500, flash = clouds.get(r.castId);
      f.swirl(() => ({ x: p.x, y: p.y, z: 0 }), {}, { n: 60, r0: 150, r1: 205, h: 150, ms: life, rps: 0.9, rise: 0.8, size: 0.6, color: STORM });
      for (let t = 120; t < life - 120; t += 260) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(60, 190); f.bolt({ x: p.x + Math.cos(a) * d * 0.4, y: p.y, z: 330 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 0 }, STORM, { ms: 160, w: 5, forks: 2, hue: true }); flash?.(0.45); });
    },
    fired: (f, r, i) => {
      const p = placeOf(f, r), last = i === r.hits.length - 1, flash = clouds.get(r.castId);
      flash?.(last ? 1.3 : 0.8);
      f.bolt({ x: p.x + rnd(-30, 30), y: p.y, z: 340 }, { x: p.x, y: p.y, z: 0 }, last ? VOLT : STORM, { ms: last ? 420 : 260, w: last ? 16 : 9, forks: last ? 4 : 2 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), STORM, last ? 3.4 : 1.8, last ? 520 : 320, 0.65);
      if (last) { f.skyBeam({ x: p.x, y: p.y, z: 0 }, VOLT, { ms: 560, w: 20 }); star(f, { x: p.x, y: p.y, z: 60 }, VOLT, { size: 320, ms: 360 }); f.crack(p.x, p.y, STORM, { r: 150, chunks: 12 }); f.host.kick(0.05); }
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
      for (let t = 360; t < t0; t += 140) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(80, 320); f.flip(STRIKE, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, { frame: STRIKE_F, from: 0, to: 11, fps: 40, w: 180, mode: 'up', foot: true, through: 0.55, glow: 0.3, flipX: Math.random() < 0.5 }); flash(0.5); });
    },
    active: (f, r) => {
      const p = placeOf(f, r), ms = T(r).active, flash = clouds.get(r.castId); let on = true; f.later(ms + 60, () => { on = false; });
      const at = () => (on ? { x: p.x, y: p.y, z: 0 } : null);
      // (the painted tornado — PixVerse footage of GPT's art — turning on the field; the fighters inside read through it)
      const tw = f.flip(TORNADO, at, { frame: TORN_F, fps: 14, loop: true, ms: ms + 60, w: 440, mode: 'up', foot: true, through: 0.55, glow: 0.25, grow: [0.6, 1], fadeIn: 160, fadeOut: 160 });
      keep(tornados, r.castId, { hold: () => { tw.end(); const still = f.flip(TORNADO, at, { frame: TORN_F, from: 21, to: 21, fps: 1, loop: true, ms: 1100, w: 440, mode: 'up', foot: true, through: 0.55, glow: 0.35, fadeIn: 0 }); stillTorn.set(r.castId, still); }, end: () => { tw.end(); stillTorn.get(r.castId)?.end(); stillTorn.delete(r.castId); } });
      for (let t = 60; t < 260; t += 70) f.later(t, () => { const a = rnd(0, Math.PI * 2), d = rnd(240, 330); f.flip(STRIKE, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, { frame: STRIKE_F, from: 0, to: 11, fps: 40, w: 160, mode: 'up', foot: true, through: 0.6, glow: 0.3, flipX: Math.random() < 0.5 }); flash?.(0.6); });
    },
    fired: (f, r, i, o) => {
      const p = placeOf(f, r), flash = clouds.get(r.castId);
      if (i === 1) { // time stops: the tornado stands still, lightning frozen where it struck, a ring of stillness
        tornados.get(r.castId)?.hold(true); flash?.(1);
        for (let k = 0; k < 4; k++) { const a = ((k + 0.5) / 4) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(290, 340); f.flip(STRIKE, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.4, z: 0 }, { frame: STRIKE_F, from: 4, to: 4, fps: 1, loop: true, ms: 980, w: 170, mode: 'up', foot: true, through: 0.55, glow: 0.3, flipX: k % 2 === 1, fadeIn: 0, fadeOut: 240 }); }
        f.host.ring(f.host.w3(p.x), f.host.d3(p.y), GOLD, 4.0, 700, 0.5);
        star(f, { x: p.x, y: p.y, z: 300 }, GOLD, { size: 380, ms: 900, spin: 0.2, a: 0.7 });
      }
      if (i === 2) { // the collapse
        tornados.get(r.castId)?.end(); flash?.(1.6);
        f.flip(STRIKE, { x: p.x, y: p.y, z: 0 }, { frame: STRIKE_F, fps: 26, w: 480, mode: 'up', foot: true, through: 0.55, glow: 0.35 });
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
    cast: (f, r) => { const c = me(f, r); star(f, { x: c.x, y: c.y, z: 80 }, A, { size: 210, ms: 230 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), A, 1.2, 260, 0.6); },
    active: (f, r) => {
      const a0 = me(f, r);
      f.later(T(r).active + 10, () => {
        const b = me(f, r);
        ribbon(f, (k) => ({ x: a0.x + (b.x - a0.x) * k, y: a0.y + (b.y - a0.y) * k, z: a0.z + 80 + (b.z - a0.z) * k + Math.sin(Math.PI * k) * 26 }), A, { w: 24, ms: 380, draw: 50 });
        f.floorStreak(a0.x, a0.y, b.x, b.y, A, { w: 12, ms: 360 });
        star(f, { x: b.x, y: b.y, z: b.z + 80 }, A, { size: 240, ms: 260 }); seal(f, b.x, b.y, A, { r: 58, ms: 380, spin: 4 });
      });
    },
  },

  // GLACIAL SPIKES — three lines of ice spikes break out of the floor one after another along the fan, growing as they go,
  // a vein of hoarfrost under each line; they stand as a wall, then shatter
  glacial_spikes: { tone: FROST, own: true, trail: false,
    cast: (f, r) => { const h = book(f, r); star(f, h, ICE, { size: 70, ms: T(r).startup + 60, light: 0.4 }); },
    active: (f, r) => {
      const c = me(f, r), b = Math.atan2(r.aim.y, r.aim.x || side(r));
      for (const da of [-0.27, 0, 0.27]) {
        const dx = Math.cos(b + da), dy = Math.sin(b + da);
        for (let k = 0; k < 6; k++) {
          const x = c.x + dx * (70 + k * 40), y = c.y + dy * (70 + k * 40) * 0.6, main = da === 0;
          f.crystals(x, y, { n: main ? 3 : 2, r: 16, h: (main ? 78 : 58) + k * 12, ms: 1650 - k * 40, delay: 30 + k * 45 });
          if (k % 2 === 0) f.later(30 + k * 45, () => frost(f, x, y, { r: 52, grow: 120, hold: 1300, melt: 400, a: 0.7 }));
        }
      }
      f.host.ring(f.host.w3(c.x + Math.cos(b) * 90), f.host.d3(c.y), FROST, 1.4, 300, 0.6);
    },
    hit: (f, _s, _h, at, main) => { if (main) star(f, { x: at.x, y: at.y, z: at.z + 55 }, ICE, { size: 150, ms: 240 }); },
  },

  // LEVITY FIELD — gravity turns over where he aims: an ice-white seal turns slowly on the floor, a soft column of pale
  // light over it, motes and torn pages drifting up it (the foes float in it)
  levity_field: { tone: ICE, own: true,
    cast: (f, r) => { const p = placeOf(f, r); seal(f, p.x, p.y, ICE, { r: 128, ms: T(r).startup + (r.skill.zoneMs ?? 2500) + 200, spin: -0.4, pulse: 1.2, star: A }); },
    active: (f, r) => {
      const p = placeOf(f, r), life = r.skill.zoneMs ?? 2500, at = () => ({ x: p.x, y: p.y, z: 0 });
      funnel(f, at, ICE, { ms: life, h: 440, r0: 100, r1: 108, rps: 0.25, sway: 0, layers: 1, dark: ICEDARK, a: 0.45 });
      f.swirl(at, {}, { n: 44, r0: 96, r1: 70, h: 400, ms: life, rps: 0.22, rise: 0.75, size: 0.6, color: ICE });
      f.swirl(at, { tex: 'mage-page', size: 0.8, aspect: 1.3, crumble: 'wind' }, { n: 7, r0: 70, r1: 60, h: 300, ms: life, rps: 0.18, rise: 0.4 });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), ICE, 1.6, 400, 0.6);
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
    cast: (f, r) => { const c = me(f, r); seal(f, c.x, c.y, A, { r: 80, ms: T(r).startup + 360, spin: 2.4 }); },
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
  elemental_ascension: { tone: FROST, own: true,
    cast: (f, r) => {
      const c = me(f, r), id = r.attackerId, at = () => { const p = f.host.casterPos(id); return p ? { x: p.x, y: p.y, z: 0 } : null; }, t0 = T(r).startup;
      seal(f, c.x, c.y, FROST, { r: 125, ms: t0 + 500, spin: 1.2, star: VOLT, pulse: 3 });
      f.swirl(at, {}, { n: 40, r0: 50, r1: 90, h: 300, ms: t0 + 600, rps: 1.2, rise: 0.9, size: 0.7, color: FROST });
      f.swirl(at, {}, { n: 40, r0: 50, r1: 90, h: 300, ms: t0 + 600, rps: -1.2, rise: 0.9, size: 0.7, color: VOLT });
      for (let k = 0; k < 4; k++) f.later((k * t0) / 4, () => { const p = f.host.casterPos(id); if (p) f.bolt({ x: p.x + rnd(-60, 60), y: p.y, z: 520 }, { x: p.x, y: p.y, z: 80 }, STORM, { ms: 150, w: 6, forks: 1, hue: true }); });
    },
    active: (f, r) => {
      const id = r.attackerId, c = me(f, r);
      f.skyBeam({ x: c.x, y: c.y, z: 0 }, FROST, { ms: 460, w: 16 }); star(f, { x: c.x, y: c.y, z: 90 }, ICE, { size: 260, ms: 320 });
      const until = f.now + 20000, at = () => (f.now < until ? (() => { const p = f.host.casterPos(id); return p ? { x: p.x, y: p.y, z: 0 } : null; })() : null);
      f.swirl(at, {}, { n: 12, r0: 52, r1: 58, h: 170, ms: 20000, rps: 0.45, rise: 0.12, size: 0.55, color: ICE });
      for (let t = 700; t < 20000; t += 900) f.later(t, () => { const p = f.host.casterPos(id); if (!p) return; const a = rnd(0, Math.PI * 2); f.bolt({ x: p.x + Math.cos(a) * 30, y: p.y, z: p.z + 60 + rnd(-20, 40) }, { x: p.x + Math.cos(a) * 60, y: p.y, z: p.z + 60 + rnd(-40, 40) }, VOLT, { ms: 110, w: 2.5, forks: 1, hue: true }); });
    },
  },

  // RIFT GATES — each gate a portal in the floor for its 10 s: a dark well with light spiralling down into it inside a
  // burning ring of runes, pages circling slowly over it; crossing, light pours down into the gate under him and he
  // rises out of the other in a beam, a star unfolding round him
  rift_gates: { tone: A, own: true,
    cast: (f, r) => {
      const id = r.attackerId, c = me(f, r);
      if (r.stage === 0) {
        const list = liveGates(id), g: Gate = { x: c.x, y: c.y, dead: false }; list.push(g); while (list.length > 2) list.shift()!.dead = true; gates.set(id, list); f.later(10200, () => { g.dead = true; });
        hole(f, c.x, c.y, A, { r: 52, ms: 10200, alive: () => !g.dead, rim: GOLD });
        f.swirl(() => (g.dead ? null : { x: g.x, y: g.y, z: 0 }), { tex: 'mage-page', size: 0.6, aspect: 1.3, crumble: 'wind' }, { n: 5, r0: 40, r1: 52, h: 90, ms: 10200, rps: 0.25, rise: 0.3 });
        star(f, { x: c.x, y: c.y, z: 20 }, A, { size: 150, ms: 260 });
      } else {
        const to = liveGates(id).find((g) => Math.hypot(g.x - c.x, g.y - c.y) > 40);
        f.swirl(() => ({ x: c.x, y: c.y, z: 0 }), {}, { n: 40, r0: 70, r1: 20, h: 180, ms: 260, rps: -1.8, rise: -0.9, size: 0.7, color: A });
        if (to) f.later(200, () => { f.skyBeam({ x: to.x, y: to.y, z: 0 }, A, { ms: 280, w: 9, h: 300 }); star(f, { x: to.x, y: to.y, z: 80 }, A, { size: 230, ms: 280 }); });
      }
    },
  },

  // TEMPEST RIDE — a tornado wraps him and carries him for the ride: a funnel of storm wind turning round him (bending as
  // it travels), pages and sparks spinning up it, bolts lashing out of it at each cut; at its end it is flung wide
  tempest_ride: { tone: STORM, own: true,
    cast: (f, r) => { const c = me(f, r); seal(f, c.x, c.y, STORM, { r: 90, ms: T(r).startup + 260, spin: 3, star: VOLT }); },
    active: (f, r) => {
      const id = r.attackerId, ms = T(r).active; let on = true; f.later(ms, () => { on = false; });
      const at = () => { const c = f.host.casterPos(id); return c && on ? { x: c.x, y: c.y, z: 0 } : null; };
      funnel(f, at, STORM, { ms, h: 300, r0: 26, r1: 120, rps: 1.9, sway: 22, color2: VOLT, layers: 2, dark: STORMDARK });
      f.swirl(at, {}, { n: 60, r0: 30, r1: 120, h: 290, ms, rps: 2.0, rise: 1.1, size: 0.8, color: VOLT });
      f.swirl(at, { tex: 'mage-page', size: 0.8, aspect: 1.3, crumble: 'wind' }, { n: 10, r0: 60, r1: 130, h: 280, ms, rps: 1.8, rise: 0.9 });
    },
    fired: (f, r, i) => {
      const c = f.host.casterPos(r.attackerId); if (!c) return;
      if (i === r.hits.length - 1) { f.host.ring(f.host.w3(c.x), f.host.d3(c.y), STORM, 2.8, 480, 0.6); star(f, { x: c.x, y: c.y, z: 120 }, VOLT, { size: 280, ms: 320 }); f.host.kick(0.04); return; }
      const a = rnd(0, Math.PI * 2), d = rnd(60, 130); f.bolt({ x: c.x + Math.cos(a) * 40, y: c.y, z: 220 }, { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.5, z: 0 }, STORM, { ms: 150, w: 4, forks: 1, hue: true });
    },
  },
};

// (the painted sheets are fetched the first time any of her spells is cast, so no spell plays its art late the first time)
const SHEETS = [TORNADO, STRIKE, NOVA, ASEAL, ACOL, SPIKES, WAVE, BIND, WARD, LEVITY, ASC, BLINK, GATE];
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
export function mageWard(f: Fx3D, id: string, ms: number): void { wards.get(id)?.stop(); wards.set(id, shell(f, id, A, { r: 84, y0: 76, ms })); }
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
