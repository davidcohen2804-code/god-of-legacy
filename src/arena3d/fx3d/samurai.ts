// PVP 3D — the Samurai's skills in the room's 3D. Rebuilt to David's bar (17 Oct, his reference "Prometheus: Ring of
// Fire", docs/ref/prometheus/; the board's 8 points), skill by skill: one colour family — a white-hot core → his crimson →
// a dark ink stroke (blade3d.ts: SAM); every cut a thick ribbon ring in perspective round him (the basic chain); the Iai the
// finisher — one huge crescent that goes dark; Phantom Blades, God of Blades' strikes and Dragon Eclipse's eight cuts the
// flurry of long crossing lines; Tornado Blade a ball of blades; Shadow Step and Kagemusha ink bursts. The skills not
// rebuilt yet keep their pieces (each its old family tone) until their turn. The room answers the rebuilt ones' blows in
// SAM.light (a crimson flare washed the red courtyard redder). In PVP 3D the rebuilt skills' flat painted cuts and marks
// stay out (SamuraiFx IN3D_OWN). Owned by the Samurai chat; the room's pieces are in ../Fx3D.ts (DFO's), ours in blade3d.ts.
import type { Recipe, Fx3D, V3 } from '../Fx3D';
import { C, me, side, T } from './kit';
import { ring, crescent, flurry, slit, bladeBall, inkBurst, sparks, SAM } from './blade3d';

const flip = () => (Math.random() < 0.5 ? 1 : -1);
/** The side Swallow Cut's last cast faced (its hits come a beat after: the second cut sweeps down the way he faced). */
let swallowDir = 1;
/** A blow thrown up (the bar: the foe thrown high and fast): a white-hot line struck up through him from the planks (its
 *  trace, not a main-hit piece: the room plays the main hit itself). */
const rise = (f: Fx3D, at: V3) => {
  slit(f, { x: at.x - 6, y: at.y, z: 4 }, { x: at.x + 8, y: at.y, z: 360 }, { w: 20, ms: 240, draw: 34, front: true });
  f.host.embers(f.host.w3(at.x), f.host.h3(90), f.host.d3(at.y), SAM.light, 4, 2.2);
};

export const SAMURAI: Record<string, Recipe> = {
  // (David's bar: each cut a thick ribbon ring round him in perspective — the slash from over the head slanted, the
  // backhand flat round him at the shoulder, the cross cut down and back up, the rising cut upright — white-hot at its
  // leading edge, its body a hot rose that reads on the red planks, an ink stroke inside, turning to ink as it goes;
  // 150–220 ms; the rising cut that launches: a white-hot line up through the foe)
  quick_slash: { own: true, tone: SAM.light,
    active: (f, r) => {
      const st = r.stage % 4, big = st === 3, d = side(r), on = () => f.host.casterPos(r.attackerId), c = me(f, r);
      const P = [
        { tilt: 62, yaw: 34, roll: 0, a0: -35, a1: 165, r: 120, w: 52, y0: 94, fwd: 20 },
        { tilt: 34, yaw: 10, roll: 0, a0: 210, a1: -10, r: 124, w: 50, y0: 100, fwd: 12 },
        { tilt: 58, yaw: -36, roll: 0, a0: -40, a1: 150, r: 116, w: 50, y0: 92, fwd: 22 },
        { tilt: 82, yaw: 36, roll: 0, a0: 175, a1: -20, r: 132, w: 58, y0: 86, fwd: 18 },
      ][st];
      ring(f, c, d, { ...P, ms: big ? 220 : 170, lit: SAM.rose, gain: 1.3, follow: on });
      if (st === 2) f.later(60, () => ring(f, me(f, r), d, { tilt: 58, yaw: 36, roll: 0, a0: 165, a1: -30, r: 112, w: 46, y0: 92, fwd: 22, ms: 160, lit: SAM.rose, gain: 1.3, follow: on }));
    },
    hit: (f, _s, _h, at, main, react) => {
      sparks(f, at, Math.random() < 0.5 ? 1 : -1, main ? 7 : 4, main ? 60 : 44);
      if (main && react === 'launch') rise(f, at); } },
  // (David's bar: an ink burst — 05) he vanishes in a burst of ink where he stood, a thin crimson line of the cut runs
  // through the foe along his path, and he lands out of a smaller one
  shadow_step: { own: true, tone: SAM.light,
    active: (f, r) => {
      const c = me(f, r), d = side(r), o = { x: c.x, y: c.y, z: c.z + 62 };
      inkBurst(f, o, { r: 84, n: 10, ms: 400, foeY: c.y - 40 });
      f.later(T(r).active * 0.85, () => { const e = me(f, r);
        f.streak({ x: c.x - d * 20, y: c.y, z: 70 }, { x: e.x + d * 30, y: e.y, z: 70 }, SAM.crimson, { w: 7, ms: 260, draw: 40, front: true });
        inkBurst(f, { x: e.x, y: e.y, z: e.z + 56 }, { r: 62, n: 7, ms: 340, foeY: e.y - 40 }); });
    },
    hit: (f, _s, _h, at) => { sparks(f, at, 1, 5, 52); } },
  // the click of the blade home: a thin ring of gold round his waist, a glint of gold at his feet
  sheathe: { own: true, tone: C.gold,
    active: (f, r) => { const c = me(f, r); f.slash(c, side(r), C.gold, { r: 72, w: 18, tilt: 2, a0: -160, a1: 160, ms: 240, y0: 70, i: 1.6 }); f.dome(c.x, c.y, C.gold, { r: 60, ms: 240, a: 0.45 }); } },
  // (David's bar: the finisher — 05) the draw is one huge crescent swept across in front of him through the foe, white-hot
  // for a few frames, then it goes dark: an ink crescent that hangs a beat and dissolves (its size by the charge)
  iai_strike: { own: true, tone: SAM.light,
    active: (f, r) => {
      const c = me(f, r), lv = r.chargeLevel ?? 0, d = side(r);
      crescent(f, c, d, { r: 158 + 14 * lv, w: 70 + 10 * lv, ms: 700 + 60 * lv, hold: 300 + 30 * lv });
    },
    hit: (f, _s, _h, at, main) => { sparks(f, at, Math.random() < 0.5 ? 1 : -1, main ? 8 : 5, 70); } }, // (no impact piece: the crescent is its moment — with the flash and the rose shell the foe stood in a bubble)
  // the crescent thrown in gold: its swing, and a crest of gold light running with it along the floor
  // (its strike is the painted crescent's: no dome of the room's over the foe — thrown close at a foe in the air, MIKAZUKI,
  // the gold pile hid both; a launch from the floor: a slim short beam)
  sword_wave: { own: true, tone: C.gold, crest: { c: C.sun, h: 115, w: 110 }, trail: false,
    active: (f, r) => f.slash(me(f, r), side(r), C.gold, { r: 105, tilt: 18, a0: -110, a1: 120, ms: 200, i: 0.9 }),
    hit: (f, _s, _h, at, main, react) => { if (main && react === 'launch') f.pillar(at.x, at.y, C.gold, { h: 300, r: 16, ms: 260, core: false, i: 0.6 }); } },
  // the stance: a rose haze round him for the window; the counter cut: three rose cuts crossing on the attacker
  mirage: { own: true, tone: C.rose,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.rose, { r: 120, ms: 480, a: 0.3, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); },
    hit: (f, _s, _h, at) => {
      for (let i = 0; i < 2; i++) f.later(i * 70, () => f.slash(at, i % 2 ? -1 : 1, C.rose, { r: 104, w: 36, tilt: [25, 65][i], a0: -100, a1: 130, ms: 240, i: 0.9 }));
      f.dome(at.x, at.y, C.rose, { r: 90, ms: 300, a: 0.18 }); } }, // (two soft arcs: three bright ones hid the foe at the counter)
  // the storm's cuts small and pink; the last one throws the foe up in a twisting column of blossom light
  blossom_storm: { own: true, tone: C.sakura,
    hit: (f, _s, _h, at, main) => {
      if (!main) { f.slash(at, flip(), C.sakura, { r: 88, w: 28, tilt: 10 + Math.random() * 50, a0: -110, a1: 120, ms: 200, i: 0.7 }); return; }
      f.pillar(at.x, at.y, C.sakura, { h: 460, r: 24, ms: 580, twist: true, core: false, i: 0.7 });
      f.dome(at.x, at.y, C.sakura, { r: 120, ms: 400, a: 0.25 });
      f.host.blow(f.host.w3(at.x), 0.6, f.host.d3(at.y), 5, 5); } },
  // the dark falls round him; (David's bar: the flurry — 04) the eight cuts out of the dark are long thin lines crossing the
  // foe, each there at once and held by its hit-stop — they cross into a star of cuts; the colossal cut is the painted
  // dragon's (the crescent is the Iai's alone): the planks torn under it
  dragon_eclipse: { own: true, tone: SAM.light,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, 0x3a0a1a, { r: 420, ms: 900, a: 0.4 }); }, // (lighter: in the dark the fighters were not readable — DFO)
    hit: (f, _s, _h, at, main) => {
      if (!main) { flurry(f, () => at, { ms: 1, len: 540, w: 14, front: true, draw: 0 }); return; } // (one cut a hit, there at once: the hit-stops hold them — eight lines crossing into a star)
      f.crack(at.x, at.y, SAM.crimson, { r: 200, chunks: 16, up: 1.3 });
      f.host.kick(0.08); } },
  // (David's bar: the main launcher, one shape — a swallow's tail, Λ) the rising cut: one upright ribbon ring swept up
  // from the planks through the foe (a hot rose body, white-hot edge, ink inside); the launch: a white-hot line up through
  // him; the second cut: a ring swept back down through him in the air. Its painted trail and marks stay out in PVP 3D.
  swallow_cut: { own: true, tone: SAM.light,
    active: (f, r) => { swallowDir = side(r);
      ring(f, me(f, r), side(r), { r: 128, w: 52, y0: 92, fwd: 26, tilt: 84, yaw: 30, a0: 178, a1: -12, ms: 220, lit: SAM.rose, gain: 1.3, follow: () => f.host.casterPos(r.attackerId) }); },
    hit: (f, _s, _h, at, main, react) => {
      sparks(f, at, swallowDir, main ? 6 : 4, 56);
      if (react === 'launch') rise(f, at);
      else ring(f, at, swallowDir, { r: 112, w: 46, y0: 70, fwd: -20, tilt: 76, yaw: 20, a0: -24, a1: 168, ms: 200, lit: SAM.rose, gain: 1.3 }); } },
  // the cage's small cuts: now and then a thin steel arc; the slam: a cross of steel light, gold sparks thrown off
  hundred_cuts: { own: true, tone: C.steel,
    hit: (f, _s, _h, at, main) => {
      if (!main) { if (Math.random() < 0.4) f.slash(at, flip(), C.steel, { r: 86, w: 20, tilt: Math.random() * 70, a0: -90, a1: 90, ms: 140, i: 0.6 }); return; }
      for (const d of [1, -1]) f.slash(at, d, C.steel, { r: 104, w: 32, tilt: 45, a0: -120, a1: 120, ms: 280, i: 0.9 });
      f.host.embers(f.host.w3(at.x), 0.9, f.host.d3(at.y), C.gold, 12, 3); } },
  // (David's bar: an ink burst — 05) he vanishes: a big burst of ink where he stood
  kagemusha: { own: true, tone: SAM.light,
    fired: (f, r) => { const c = me(f, r); inkBurst(f, { x: c.x, y: c.y, z: c.z + 60 }, { r: 112, n: 14, ms: 500, foeY: c.y - 60 }); f.host.blow(f.host.w3(c.x), 0.6, f.host.d3(c.y), 4, 4); } },
  // (David's bar: a ball of blades — 07) rings of the blade at every tilt round him, turning with him through the spin; the
  // smash down: cracks where the foe hits the planks
  tornado_blade: { own: true, tone: SAM.light,
    active: (f, r) => bladeBall(f, r.attackerId, side(r), { ms: T(r).active, every: 42, r: 108, y0: 50 }),
    hit: (f, _s, _h, at, main) => { sparks(f, at, Math.random() < 0.5 ? 1 : -1, main ? 7 : 4, 56); if (main) { f.crack(at.x, at.y, SAM.crimson, { r: 110, chunks: 8 }); f.host.kick(0.04); } } },
  // the falcon of fire strikes the floor: fire torn in the planks, a column of flame
  falcon_dive: { own: true, tone: C.fire,
    fired: (f, r) => { const c = me(f, r); f.crack(c.x, c.y, C.fire, { r: 150, chunks: 10 }); f.pillar(c.x, c.y, C.fire, { h: 480, r: 24, ms: 400, core: false, i: 0.7 }); f.host.kick(0.05); } }, // (the falcon is the show: a thin column)
  // the sun's shield held round him through the wind-up; the sun bursts: a column of gold, the light thrown out
  rising_sun: { own: true, tone: C.sun,
    cast: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.sun, { r: 130, ms: T(r).startup + 120, a: 0.32, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); },
    active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.sun, { h: 600, r: 18, ms: 560, core: false, i: 0.35 }); f.dome(c.x, c.y, C.sun, { r: 140, ms: 400, a: 0.12 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.sun, 3, 420, 0.6); } }, // (no impact light on him: it washed him gold — DFO; soft: the burst whited both out)
  // (David's bar: the flurry — 04) the phantoms' cuts: long thin lines crossing the foe, a new one every ~40 ms through the
  // field; the last: two long crossing strokes of the blade through him
  phantom_blades: { own: true, tone: SAM.light,
    hit: (f, _s, _h, at, main) => {
      if (!main) { flurry(f, () => at, { ms: 80, every: 40, len: 480, w: 12 }); return; }
      for (const k of [0, 1]) f.later(k * 40, () => { const th = (k ? 135 : 45) + (Math.random() - 0.5) * 16, rad = (th * Math.PI) / 180, L = 620;
        const a = { x: at.x - Math.cos(rad) * L * 0.5, y: at.y, z: 70 + Math.sin(rad) * L * 0.5 }, b = { x: at.x + Math.cos(rad) * L * 0.5, y: at.y, z: 70 - Math.sin(rad) * L * 0.5 };
        slit(f, a, b, { w: 30, ms: 240, draw: 30, front: k === 0 }); if (!k) f.onPiece?.('streak', at, 1);
        f.later(70, () => slit(f, { x: a.x, y: a.y + 4, z: a.z - 10 }, { x: b.x, y: b.y + 4, z: b.z - 10 }, { w: 22, ms: 230, draw: 26, ink: true, front: k === 0 })); });
      sparks(f, at, 1, 8, 80); } },
  // the halo of blades rising behind him (its own, painted), a ring of light on the floor; (David's bar: the flurry — 04)
  // each blade that strikes: a few long thin lines crossing the foe
  god_of_blades: { own: true, tone: SAM.light,
    active: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SAM.light, 2.8, 460, 0.5); },
    hit: (f, _s, _h, at) => flurry(f, () => at, { ms: 110, every: 36, len: 440, w: 11 }) },
  // the bind: blossom light closing round the foe, a twisting column of it, petals
  sakura_bind: { own: true, tone: C.sakura,
    // his blade driven into the planks: they crack round its point and a line of blossom light runs through them to the ring
    active: (f, r) => { const c = me(f, r), p0 = { x: c.x + side(r) * 36, y: c.y }, pl = r.place ?? c;
      f.crack(p0.x, p0.y, C.sakura, { r: 46, ms: 1000, chunks: 4, up: 0.6 });
      if (Math.hypot(pl.x - p0.x, pl.y - p0.y) > 40) f.streak({ x: p0.x, y: p0.y, z: 3 }, { x: pl.x, y: pl.y, z: 3 }, C.sakura, { w: 10, ms: 460, draw: 110 }); },
    hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.sakura, { r: 120, ms: 420, a: 0.4 }); f.pillar(at.x, at.y, C.sakura, { h: 420, r: 32, ms: 520, twist: true, core: false, i: 1.1 }); f.host.blow(f.host.w3(at.x), 0.4, f.host.d3(at.y), 4, 5); } } },
  // the golden dragon bursts out of the floor and climbs: a tall twisting column of gold, the planks torn under the slam
  dragon_ascension: { own: true, tone: C.gold,
    active: (f, r) => { const c = me(f, r);
      // (one thin column under the dragon — the painted dragon is the show; two wide ones lit both fighters out)
      f.pillar(c.x, c.y, C.gold, { h: 720, r: 16, ms: 720, twist: true, core: false, i: 0.5 });
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.gold, 3.2, 420, 0.6); }, // (no impact light on him: it washed both fighters gold at the burst — DFO)
    hit: (f, _s, _h, at, main) => { if (main) f.crack(at.x, at.y, C.gold, { r: 130, chunks: 14 }); } },
};
