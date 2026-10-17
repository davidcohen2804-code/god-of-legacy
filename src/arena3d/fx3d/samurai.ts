// PVP 3D — the Samurai's skills in the room's 3D: what each skill adds in 3D on top of its painted effect, in that skill's
// own tone (as SamuraiFx paints it): steel — Quick Slash, Iai Strike's hair line, Hundred Cuts, Tornado Blade; crimson —
// Swallow Cut, Phantom Blades, Dragon Eclipse, the Iai's opening; blood and ink — Shadow Step, Kagemusha; gold — Sheathe,
// Sword Wave, God of Blades, Rising Sun, Dragon Ascension; sakura — Blossom Storm, Sakura Bind; rose — Mirage; fire — Falcon Dive.
// The main hit of each skill carries the big pieces; the small hits of a burst stay small; nothing whites the screen out.
// (The main hit's bent air / colour split comes from SkillFx.confirmed in every mode: the recipes' hits don't add another.)
// Owned by the Samurai chat. The pieces (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain,
// trail / crest / chainBolt) are in ../Fx3D.ts.
import type { Recipe } from '../Fx3D';
import { C, me, side, T } from './kit';

/** The shadow's blood edge and its ink (a dark plum glow: ink itself gives no light). */
const BLOOD = 0xd0142e, INK = 0x6a2a5a;
const flip = () => (Math.random() < 0.5 ? 1 : -1);

export const SAMURAI: Record<string, Recipe> = {
  // the basic chain: a cut of bare steel round him per stage (slash, backhand, the cross cut's two, the rising cut);
  // the rising cut that lifts the foe is the big one — a thin steel pillar under him
  quick_slash: { own: true,
    active: (f, r) => {
      const st = r.stage % 4, big = st === 3;
      // (the basic plays all fight long: a thin steel arc a size under the skills', never white over the fighters)
      f.slash(me(f, r), side(r), C.steel, { r: big ? 112 : 100, w: big ? 32 : 26, tilt: [24, 64, 14, 84][st], a0: [-70, 170, -130, 165][st], a1: [120, -10, 120, 10][st], ms: big ? 230 : 170, i: big ? 1.0 : 0.75 });
      if (st === 2) f.later(60, () => f.slash(me(f, r), side(r), C.steel, { r: 96, w: 24, tilt: 72, a0: 160, a1: -20, ms: 170, i: 0.7 }));
    },
    hit: (f, _s, _h, at, main, react) => { if (main && react === 'launch') f.pillar(at.x, at.y, C.steel, { h: 300, r: 18, ms: 320, core: false, i: 0.9 }); } },
  // a smear of ink along the step with a blood-red edge; the cut on the foe flat, blood red
  shadow_step: { own: true,
    active: (f, r) => { const c = me(f, r); f.later(T(r).active * 0.8, () => { const e = me(f, r);
      f.streak({ x: c.x, y: c.y, z: 85 }, { x: e.x, y: e.y, z: 85 }, INK, { w: 34, ms: 380, draw: 40 });
      f.streak({ x: c.x, y: c.y, z: 88 }, { x: e.x, y: e.y, z: 88 }, BLOOD, { w: 8, ms: 300, draw: 40, front: true }); }); },
    hit: (f, _s, _h, at) => f.slash(at, flip(), BLOOD, { r: 105, tilt: 6, a0: -100, a1: 100, ms: 220, i: 1.5 }) },
  // the click of the blade home: a thin ring of gold round his waist, a glint of gold at his feet
  sheathe: { own: true,
    active: (f, r) => { const c = me(f, r); f.slash(c, side(r), C.gold, { r: 72, w: 18, tilt: 2, a0: -160, a1: 160, ms: 240, y0: 70, i: 1.6 }); f.dome(c.x, c.y, C.gold, { r: 60, ms: 240, a: 0.45 }); } },
  // a hair line of bare steel along the draw, then the crimson opening over it; the cut on the foe crimson
  iai_strike: { own: true,
    active: (f, r) => { const c = me(f, r), e = { x: c.x + r.aim.x * 520, y: c.y + r.aim.y * 300, z: 100 };
      f.streak({ ...c, z: 100 }, e, C.steel, { w: 12, ms: 300, draw: 30, front: true });
      f.later(160, () => f.streak({ ...c, z: 100 }, e, C.crimson, { w: 30, ms: 420, draw: 60 })); },
    hit: (f, _s, _h, at, main) => { if (main) f.slash(at, flip(), C.crimson, { r: 115, tilt: 45, a0: -80, a1: 100, ms: 260, i: 1.6 }); } },
  // the crescent thrown in gold: its swing, and a crest of gold light running with it along the floor
  sword_wave: { crest: { c: C.sun, h: 115, w: 110 }, trail: false,
    active: (f, r) => f.slash(me(f, r), side(r), C.gold, { r: 120, tilt: 18, a0: -110, a1: 120, ms: 220, i: 1.4 }) },
  // the stance: a rose haze round him for the window; the counter cut: three rose cuts crossing on the attacker
  mirage: { own: true,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.rose, { r: 120, ms: 480, a: 0.3, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); },
    hit: (f, _s, _h, at) => {
      for (let i = 0; i < 3; i++) f.later(i * 60, () => f.slash(at, i % 2 ? -1 : 1, C.rose, { r: 110, tilt: [20, 55, 75][i], a0: -100, a1: 130, ms: 240, i: 1.5 }));
      f.dome(at.x, at.y, C.rose, { r: 90, ms: 300, a: 0.3 }); } },
  // the storm's cuts small and pink; the last one throws the foe up in a twisting column of blossom light
  blossom_storm: { own: true,
    hit: (f, _s, _h, at, main) => {
      if (!main) { f.slash(at, flip(), C.sakura, { r: 90, tilt: 10 + Math.random() * 50, a0: -110, a1: 120, ms: 200, i: 1 }); return; }
      f.pillar(at.x, at.y, C.sakura, { h: 520, r: 40, ms: 640, twist: true, core: false, i: 1.1 });
      f.dome(at.x, at.y, C.sakura, { r: 140, ms: 420, a: 0.35 });
      f.host.blow(f.host.w3(at.x), 0.6, f.host.d3(at.y), 5, 5); } },
  // the dark falls round him; the eight cuts out of the dark cross the foe in crimson from all sides; the colossal cut of
  // the dragon: a twisting crimson pillar, the planks torn, the whole picture pulled in (soft: the fighters stay seen)
  dragon_eclipse: { own: true,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, 0x3a0a1a, { r: 420, ms: 900, a: 0.6 }); },
    hit: (f, _s, _h, at, main) => {
      if (!main) { f.slash(at, flip(), C.crimson, { r: 120, tilt: 10 + Math.random() * 65, a0: -120, a1: 140, ms: 220, i: 1.4 }); return; }
      f.pillar(at.x, at.y, C.crimson, { h: 900, r: 56, ms: 760, twist: true, core: false, i: 1.2 });
      f.crack(at.x, at.y, C.crimson, { r: 200, chunks: 16, up: 1.3 });
      f.later(60, () => f.dome(at.x, at.y, C.crimson, { r: 180, ms: 520, a: 0.3 }));
      f.host.kick(0.08); } },
  // the swallow's rising cut upright in crimson; the launch: a thin crimson pillar under the foe; the second cut backhand
  swallow_cut: { own: true,
    active: (f, r) => f.slash(me(f, r), side(r), C.crimson, { r: 130, tilt: 80, a0: 170, a1: 0, ms: 280, i: 1.6 }),
    hit: (f, _s, _h, at, main, react) => {
      if (main && react === 'launch') f.pillar(at.x, at.y, C.crimson, { h: 460, r: 26, ms: 420, core: false, i: 1.2 });
      else if (!main) f.slash(at, -1, C.crimson, { r: 105, tilt: 65, a0: 160, a1: -10, ms: 200, i: 1.3 }); } },
  // the cage's small cuts: now and then a thin steel arc; the slam: a cross of steel light, gold sparks thrown off
  hundred_cuts: { own: true,
    hit: (f, _s, _h, at, main) => {
      if (!main) { if (Math.random() < 0.5) f.slash(at, flip(), C.steel, { r: 90, w: 24, tilt: Math.random() * 70, a0: -90, a1: 90, ms: 140, i: 1 }); return; }
      for (const d of [1, -1]) f.slash(at, d, C.steel, { r: 120, tilt: 45, a0: -120, a1: 120, ms: 280, i: 1.6 });
      f.host.embers(f.host.w3(at.x), 0.9, f.host.d3(at.y), C.gold, 18, 3); } },
  // he vanishes: the light drawn in round him (ink and rose), petals blown off
  kagemusha: { own: true,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, INK, { r: 160, ms: 520, a: 0.35, implode: true }); f.host.blow(f.host.w3(c.x), 0.6, f.host.d3(c.y), 4, 4); } },
  // a whirlwind of steel rings round him in the air; the smash down: steel cracks where the foe hits the planks
  tornado_blade: { own: true,
    active: (f, r) => f.whirl(r.attackerId, C.steel, { r: 120, ms: T(r).active, rings: 3, every: 90, y0: 40, dir: side(r) }),
    hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, C.steel, { r: 110, chunks: 8 }); f.host.kick(0.04); } } },
  // the falcon of fire strikes the floor: fire torn in the planks, a column of flame
  falcon_dive: { own: true,
    fired: (f, r) => { const c = me(f, r); f.crack(c.x, c.y, C.fire, { r: 150, chunks: 10 }); f.pillar(c.x, c.y, C.fire, { h: 520, r: 34, ms: 420, core: false, i: 1.1 }); f.host.kick(0.05); } },
  // the sun's shield held round him through the wind-up; the sun bursts: a column of gold, the light thrown out
  rising_sun: { own: true,
    cast: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.sun, { r: 130, ms: T(r).startup + 120, a: 0.32, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); },
    active: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, C.sun, { h: 640, r: 44, ms: 620, core: false, i: 1 }); f.dome(c.x, c.y, C.sun, { r: 200, ms: 420, a: 0.35 }); f.host.impact({ x: c.x, y: c.y, z: 80 }, 1); } },
  // the phantoms' cuts crimson and small; the last one a cross of crimson on the foe
  phantom_blades: { own: true,
    hit: (f, _s, _h, at, main) => {
      if (!main) { f.slash(at, flip(), C.crimson, { r: 95, tilt: 10 + Math.random() * 60, a0: -100, a1: 110, ms: 190, i: 1 }); return; }
      for (const d of [1, -1]) f.slash(at, d, C.crimson, { r: 120, tilt: 40, a0: -120, a1: 120, ms: 260, i: 1.6 }); } },
  // the halo of golden blades rising behind him (upright arcs fanned out), a ring of gold on the floor; each blade that strikes
  // later: a thin gold cut on the foe
  god_of_blades: { own: true,
    active: (f, r) => { const c = me(f, r);
      for (let i = 0; i < 5; i++) f.later(i * 50, () => f.slash(me(f, r), -side(r), C.gold, { r: 105 + i * 10, w: 20, tilt: 80, a0: -60 + i * 30, a1: 40 + i * 30, ms: 520, y0: 110, i: 1.1 }));
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.gold, 2.8, 460, 0.7); },
    hit: (f, _s, _h, at) => f.slash(at, flip(), C.gold, { r: 95, tilt: 20 + Math.random() * 40, a0: -100, a1: 100, ms: 200, i: 1.2 }) },
  // the bind: blossom light closing round the foe, a twisting column of it, petals
  sakura_bind: { own: true,
    hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, C.sakura, { r: 120, ms: 420, a: 0.4 }); f.pillar(at.x, at.y, C.sakura, { h: 420, r: 32, ms: 520, twist: true, core: false, i: 1.1 }); f.host.blow(f.host.w3(at.x), 0.4, f.host.d3(at.y), 4, 5); } } },
  // the golden dragon bursts out of the floor and climbs: a tall twisting column of gold, the planks torn under the slam
  dragon_ascension: { own: true,
    active: (f, r) => { const c = me(f, r);
      f.pillar(c.x, c.y, C.sun, { h: 860, r: 40, ms: 900, twist: true, core: false, i: 1.05 });
      f.later(80, () => f.pillar(c.x, c.y, C.gold, { h: 760, r: 24, ms: 760, twist: true, core: false, i: 0.9 }));
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.gold, 3.2, 420, 0.8); f.host.impact({ x: c.x, y: c.y, z: 120 }, 1); },
    hit: (f, _s, _h, at, main) => { if (main) f.crack(at.x, at.y, C.gold, { r: 130, chunks: 14 }); } },
};
