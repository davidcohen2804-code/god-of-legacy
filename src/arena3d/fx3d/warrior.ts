// PVP 3D — the Warrior's skills in the room's 3D: what each skill adds in 3D on top of its painted effect.
// Owned by the Warrior chat: tune freely (pieces, colours, sizes, timings) and check in PVP 3D (?arena3d=1). The pieces
// (pillar, dome, crack, debris, crystals, bolt, streak, slash, whirl, wave, rain, trail / crest / chainBolt) are in ../Fx3D.ts.
// Five families (DFO's quality review), each its own colour and shape so any still frame names the skill — shape over
// glow, the bodies always readable (the room's bloom turns anything bright to white: intensities stay low):
//   STEEL the sword (thin white arcs, streaks) · STONE his weight (cracks with molten light, chunks, dust) · IRON his
//   grappling hand (cold blue-white) · HOLY the Judge's verdicts (pale gold, white core) · CRIMSON his fury (deep red).
import type { Recipe } from '../Fx3D';
import { me, side, ahead, T } from './kit';

// (steel a cold blue-white: the room's warm grade and bloom turned a near-white arc gold on the basic — DFO's review)
const W = { steel: 0x9ebcff, stone: 0x9a8670, molten: 0xff7a22, iron: 0x9fc4ff, holy: 0xfff0b8, crimson: 0xd8261c, blood: 0xff4a3a };

/** A crack whose chunks fly without its dust: Fx3D's crack throws half its chunk count in dust puffs, and they stacked into a
 *  cream haze round both fighters (Ground Breaker, Leap Crash, Titan's Verdict) — the chunks thrown by debris instead. */
const crk = (f: Parameters<NonNullable<Recipe['active']>>[0], x: number, y: number, c: number, o: { r?: number; chunks?: number; up?: number }): void => {
  f.crack(x, y, c, { r: o.r, chunks: 0 }); if (o.chunks) f.debris(x, y, o.chunks, { up: o.up ?? 1 });
};

/** The slam (DAVID 18:23's bar, the hammer girl's: docs/ref/prometheus/02): a white flash sphere for ~100 ms, its colour bursting
 *  out of it, a floor ring of glowing cracks, embers rising and fading — the STONE family's main hit, in that order. */
const slam = (f: Parameters<NonNullable<Recipe['active']>>[0], x: number, y: number, k = 1): void => {
  f.impact({ x, y, z: 0 }, W.molten, { r: 75 * k, embers: Math.round(18 * k) }); // (DFO's main hit in one call: flash → molten burst → glowing cracks → embers)
  f.host.kick(0.05 * k);
};

/** A mark that stays on the floor and is felt (David 18 Oct 18:19: "not just appear and vanish"): it grows in — rings of
 *  cracks breaking out one after another from the centre, its glow swelling (low glyphs stacked in) — lives (the cracks'
 *  molten light flickering, embers rising) and goes out — the light dies first, leaving dark broken rock that fades last. */
const scar = (f: Parameters<NonNullable<Recipe['active']>>[0], x: number, y: number, o: { r: number; life: number; hot: number; glow?: number; shape?: 'star' | 'spiral' | 'runes'; embers?: number; rings?: number }): void => {
  const n = o.rings ?? 3;
  for (let k = 0; k < n; k++) f.later(k * 120, () => f.crack(x, y, o.hot, { r: o.r * (0.45 + 0.55 * (k / Math.max(1, n - 1))), ms: Math.max(300, (o.life - k * 120) / 4), chunks: 0, quiet: true })); // (crack(): the hot light fades over its ms, the dark scar stays 4× that)
  if (o.glow) for (let k = 0; k < 4; k++) f.later(k * 110, () => f.glyph(x, y, o.hot, { shape: o.shape ?? 'runes', r: o.glow!, ms: o.life * 0.6 - k * 110, spin: 0.2, pulse: 0.7, a: 0.12 })); // the glow swelling in
  for (let t = 160; t < o.life * 0.7; t += 200) f.later(t, () => f.host.embers(f.host.w3(x + (Math.random() - 0.5) * o.r * 1.4), 0.04, f.host.d3(y + (Math.random() - 0.5) * o.r * 0.6), t % 600 < 200 ? 0xffd27a : o.hot, o.embers ?? 4, 1.1));
};

// every recipe `own`: the room's default main-hit pieces (a white launch pillar, a hit dome) washed over the foe — Rising Slash's
// column, Impaling Rush's ball (DFO's review); each skill's own pieces carry its hit
/** Judgment Blade's volley (as SkillFx counts it): a blade within 1.5 s of the last is the next, planted beside it. */
const jbVolley = new Map<string, { at: number; n: number }>();

export const WARRIOR: Record<string, Recipe> = {
  // STEEL
  warrior_basic: { tone: W.steel, own: true, active: (f, r) => { const st = Math.max(0, Math.min(3, r.stage ?? 0)), K = [{ tilt: 40, yaw: 30, a0: -40, a1: 170, r: 118, w: 50, y0: 92 }, { tilt: 60, yaw: -30, a0: 200, a1: -20, r: 120, w: 50, y0: 96 }, { tilt: 78, yaw: 28, a0: 200, a1: -10, r: 124, w: 52, y0: 92 }, { tilt: 86, yaw: 34, a0: -30, a1: 190, r: 150, w: 66, y0: 90 }][st]; f.slash(me(f, r), side(r), W.steel, { ...K, ms: st === 3 ? 230 : 180, i: 1.6, ink: true, follow: () => f.host.casterPos(r.attackerId) }); } }, // Iron Chain (DAVID 20:56): each strike one thick inked steel ring round him, turned toward the view — the flat cut, the backhand down, the rising cut, the two-hand chop (the biggest); the main hit's impact is DFO's
  dash_slash: { tone: W.steel, own: true, active: (f, r) => { const A = T(r).active, d = side(r); let last = me(f, r); for (let t = 0; t <= A; t += 45) f.later(t, () => { const e = me(f, r), tip = { x: e.x + d * 70, y: e.y }; f.host.embers(f.host.w3(tip.x), 0.08, f.host.d3(tip.y), W.molten, 4, 1.8); /* sparks where the blade scrapes the planks, the foe hooked on it */ f.floorStreak(last.x + d * 70, last.y, tip.x, tip.y, 0xff7a22, { w: 24, ms: 1100, a: 1 }); /* a glowing furrow ploughed along the floor */ last = e; }); f.later(A * 0.95, () => { const e = me(f, r); f.slash(e, d, W.steel, { r: 140, w: 50, tilt: 30, yaw: 25, a0: -120, a1: 110, ms: 200, i: 1.5, ink: true }); }); } }, // Dash Slash (David 01:07: "if it drags, let it drag"): the foe hooked on the blade — sparks where it scrapes, a glowing furrow ploughed along the planks, the inked cut that throws him off at the end
  rising_slash: { tone: W.steel, own: true, /* (room lit steel: its crimson light flooded the whole frame red) */ active: (f, r) => { const c = me(f, r); f.slash(c, side(r), W.crimson, { r: 165, w: 64, tilt: 74, yaw: 30, a0: 200, a1: -15, ms: 300, y0: 80, i: 1.7, ink: true, follow: () => f.host.casterPos(r.attackerId) }); /* (Rising Slash, DAVID 20:56: one big slanted ring swept from under the foe up over his head — white-hot edge, crimson, a dark stroke; the launch's impact is DFO's) */ f.debris(c.x + side(r) * 60, c.y, 5, { up: 1.8, speed: 0.6 }); } }, // white with a crimson rim, chips thrown up with the foe
  whirlwind: { tone: W.steel, own: true, active: (f, r) => { f.whirl(r.attackerId, W.steel, { r: 150, ms: T(r).active, rings: 3, every: 110, dir: side(r), ink: true });
    for (const k of [0, 0.5, 1]) f.later(T(r).active * k * 0.9, () => { const c = me(f, r); scar(f, c.x, c.y, { r: 120, life: 2200 - T(r).active * k * 0.5, hot: W.molten, rings: k === 0 ? 3 : 2, glow: 110, shape: 'spiral', embers: 3 }); }); // (David 18:19: the cyclone's scorched floor felt — it grows in under him as he drives, glows, cools to dark)
  } },
  wave_slash: { tone: W.steel, own: true, crest: { c: W.steel, h: 70, w: 80 }, trail: false, // Steel Tide (David 18 Oct 18:19): three heavy blades of steel light skimming the floor — a white-hot edge on an inked body, sparks grinding off the planks behind each — and the one that strikes bursts into a column of blades round the foe
    active: (f, r) => f.slash(me(f, r), side(r), W.steel, { r: 150, w: 44, tilt: 58, a0: 150, a1: -10, ms: 240, i: 1.3, ink: true }),
    shot: (f, p) => {
      const d = p.dx < 0 ? -1 : 1, yaw = Math.atan2(p.dy, Math.abs(p.dx)) * (180 / Math.PI) * d;
      const ride = () => { if (p.done) return; // the blade: an upright crescent riding the floor, redrawn as it flies
        f.slash({ x: p.x, y: p.y, z: 0 }, d, 0xe8f0ff, { r: 70, w: 40, tilt: 84, yaw: 90 + yaw, a0: 200, a1: 340, ms: 80, y0: 36, i: 2.2, ink: true, quiet: true });
        f.host.embers(f.host.w3(p.x - p.dx * 30), 0.02, f.host.d3(p.y - p.dy * 30), Math.random() < 0.5 ? 0xffb050 : 0xffe0a0, 1, 1.6); // sparks grinding off the planks behind it
        f.floorStreak(p.x - p.dx * 60, p.y - p.dy * 60, p.x, p.y, 0xbfd4ff, { w: 10, ms: 260, a: 0.7 }); // the scored furrow
        f.later(40, ride);
      };
      ride();
    },
    hit: (f, _s, _h, at) => { // the column of blades round him: eight inked swords of light rising round him, turning, to over his head
      f.crystals(at.x, at.y, { ring: true, n: 9, r: 48, h: 200, ms: 620, color: 0xcfe0ff }); // swords of steel light thrust up round him
      for (let k = 0; k < 3; k++) f.later(60 + k * 60, () => f.slash({ x: at.x, y: at.y, z: 0 }, k % 2 ? 1 : -1, W.steel, { r: 70, w: 30, tilt: 86, yaw: k * 60, a0: 200, a1: -20, ms: 220, y0: 60 + k * 70, i: 1.6, ink: true, quiet: true }));
      f.later(40, () => f.floorStreak(at.x - 70, at.y, at.x + 70, at.y, 0xe8f0ff, { w: 14, ms: 300, a: 0.8 }));
      f.later(60, () => f.host.embers(f.host.w3(at.x), 0.4, f.host.d3(at.y), W.steel, 18, 2.8));
    } },
  lance_thrust: { tone: W.steel, own: true, active: (f, r) => { const A = T(r).active, lv = r.chargeLevel ?? 0, n = 4 + lv; for (let i = 0; i < n; i++) f.later(A * (0.1 + i * (0.8 / n)), () => { const e = me(f, r), y = 90 + (i % 2 ? 14 : -10), big = i === n - 1; f.streak({ x: e.x + side(r) * 30, y: e.y, z: y }, { x: e.x + side(r) * (150 + i * 10 + lv * 30), y: e.y, z: y }, W.steel, { w: big ? 8 + lv * 3 : 4, ms: 160, draw: 25 }); }); if (lv > 0) f.slash(me(f, r), side(r), W.steel, { r: 90 + lv * 20, w: 30, tilt: 6, yaw: 80, a0: -40, a1: 40, ms: A, y0: 90, i: 1.2, ink: true, follow: () => f.host.casterPos(r.attackerId), quiet: true }); /* the charged lance's spearhead cone riding ahead of him */ } }, // Impaling Rush held (David 01:07): a hail of thin thrusts, one more and longer at each step, the charged lance's cone riding ahead
  sky_breaker: { tone: W.steel, own: true, fired: (f, r) => { const c = me(f, r); f.pillar(c.x, c.y, W.steel, { h: 560, r: 10, ms: 300, i: 0.45, core: false }); /* (a thin steel streak: the wide one washed the frame — DFO) */ slam(f, c.x, c.y, 0.9); f.host.impact({ x: c.x, y: c.y, z: 20 }, 1); } }, // the dive a white streak, the landing in stone
  // STONE
  ground_breaker: { tone: W.molten, own: true, active: (f, r) => { const c = me(f, r); crk(f, c.x, c.y, W.molten, { r: 150, chunks: 10, up: 1.6 }); /* the planks torn under his blade, molten light in the cracks */ f.crystals(c.x, c.y, { ring: true, n: 9, r: 135, h: 85, ms: 650, stone: true }); /* a crown of rock spikes bursting out round him — the quake you can see */ f.later(120, () => f.crystals(c.x, c.y, { ring: true, n: 12, r: 200, h: 55, ms: 520, stone: true })); /* a second, wider ring rolling out */ f.host.ring(f.host.w3(c.x), f.host.d3(c.y), W.molten, 3.6, 460, 0.35); f.debris(c.x, c.y, 12, { up: 1.8, speed: 1.2 }); f.host.kick(0.07); } }, // Ground Breaker (David 01:07: the 3D and the feel): the floor torn open, two rings of rock spikes bursting out round him one after the other, chunks thrown high (the foe's impact is DFO's)
  leap_crash: { tone: W.molten, own: true, fired: (f, r) => { const c = me(f, r); slam(f, c.x, c.y, 1); f.debris(c.x, c.y, 8, { speed: 1.3, up: 1.6 }); } }, // a stone crater, chunks thrown high
  earthsplitter: { tone: W.molten, own: true, active: (f, r) => { const c = me(f, r); slam(f, c.x + r.aim.x * 60, c.y + r.aim.y * 30, 0.8); f.wave(c.x, c.y, r.aim.x, r.aim.y, W.stone, { len: 520, ms: 300, h: 110, w: 110, chunks: true }); for (let i = 1; i <= 4; i++) f.later(i * 55, () => { const p = { x: c.x + r.aim.x * i * 120, y: c.y + r.aim.y * i * 70 }; crk(f, p.x, p.y, W.molten, { r: 90, chunks: 6 }); }); } }, // the fissure runs (its rock spikes: WarriorSpikes — they stand a while, the continuity)
  // IRON
  thunder_circle: { tone: W.iron, own: true, cast: (f, r) => { // Thunder Circle (David 18 Oct 18:19): the sword plunged with weight, a ring of lightning burnt into the floor round it for 5 s — arcs crawling round its rim, bolts cracking up from it on each strike
    const E = 0x8fd8ff, L = r.skill.linger, R = L?.radius ?? 170, n = L?.count ?? 10, every = L?.everyMs ?? 500, t0 = L?.startMs ?? 300, life = t0 + n * every;
    f.later(T(r).startup, () => {
      const c = me(f, r), hx = f.host.w3(c.x), hz = f.host.d3(c.y), rim = (a: number, z = 0) => ({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R, z });
      f.host.kick(0.06); f.debris(c.x, c.y, 6, { up: 0.9, speed: 0.6 }); f.host.embers(hx, 0.05, hz, 0xe8f6ff, 16, 1.6); // the blade bites the planks: splinters, sparks
      for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3, l = R * (0.55 + (k % 3) * 0.15); f.floorStreak(c.x, c.y, c.x + Math.cos(a) * l, c.y + Math.sin(a) * l, E, { w: 7, ms: life, a: 0.8 }); } // burnt cracks racing out from the sword
      f.host.ring(hx, hz, E, f.host.w3(R * 2.2), 360, 0.7);
      f.glyph(c.x, c.y, 0x4fb0ff, { shape: 'runes', r: R, ms: life, spin: 0.3, pulse: 0.8, a: 0.5 }); // the ring burnt into the floor
      for (let t = 80; t < life - 100; t += 110) f.later(t, () => { const a = Math.random() * Math.PI * 2; f.bolt(rim(a, 4), rim(a + 0.45 + Math.random() * 0.3, 4), E, { ms: 150, w: 3, forks: 0 }); }); // arcs crawling round its rim
      for (let i = 0; i < n; i++) f.later(t0 + i * every, () => { // each strike: bolts cracking up from the rim, a flash ring
        const a0 = Math.random() * Math.PI * 2;
        for (let k = 0; k < 3; k++) { const a = a0 + k * 2.1; f.bolt(rim(a), rim(a + 0.1, 170 + Math.random() * 50), E, { ms: 200, w: 5, forks: 2 }); }
        f.host.ring(hx, hz, E, f.host.w3(R * 2), 300, 0.45); f.host.embers(hx, 0.1, hz, 0xe8f6ff, 6, 1.2);
      });
    });
  } },
  iron_grip: { tone: W.iron, own: true, hit: (f, _s, _h, at, main) => { if (main) { f.dome(at.x, at.y, W.iron, { r: 90, ms: 260, a: 0.45, implode: true }); f.host.embers(f.host.w3(at.x), 0.8, f.host.d3(at.y), W.iron, 12, 2.6); } } }, // the hand closes (an implosion), cold sparks
  judgment_hook: { tone: W.iron, own: true, active: (f, r) => { const c = me(f, r), e = ahead(f, r, 300), hit = r.skill.hits[0]?.at ?? 160; f.streak({ x: c.x, y: c.y, z: 100 }, { x: e.x, y: e.y, z: 100 }, W.iron, { w: 7, ms: hit + 280, draw: hit }); /* the chain's flight: it unreels to its reach over the throw (no snap) */ f.later(hit, () => { const t = me(f, r), tip = { x: t.x + side(r) * 300, y: t.y }; f.host.embers(f.host.w3(tip.x), 0.45, f.host.d3(tip.y), W.iron, 12, 2.2); /* the hook bites: cold sparks */ f.host.kick(0.035); f.streak({ x: tip.x, y: tip.y, z: 100 }, { x: t.x + side(r) * 30, y: t.y, z: 100 }, W.iron, { w: 11, ms: 300, draw: 230 }); /* the pull: the chain hauled back taut, heavier, over its 230 ms */ }); } }, // Judgment Hook (David 01:07: "very fast, not professional"): the chain unreels on its throw, the hook bites with sparks and a jolt, then it is hauled back taut with weight
  shield_charge: { tone: W.iron, own: true, cast: (f, r) => { // Iron Bastion: the sword planted, an iron shell close round him while it holds (following him), runes of iron on the floor
    const c = me(f, r), hold = T(r).startup + T(r).active, fol = () => { const p = f.host.casterPos(r.attackerId); return p ? { x: p.x, y: p.y, z: 0 } : null; };
    f.dome(c.x, c.y, W.iron, { r: 85, ms: hold, a: 0.3, hold: 1, follow: fol });
    f.later(T(r).startup, () => { const p = me(f, r); f.glyph(p.x, p.y, W.iron, { shape: 'runes', r: 120, ms: T(r).active, spin: 0.15, pulse: 0.5, a: 0.5 }); f.host.embers(f.host.w3(p.x + side(r) * 30), 0.1, f.host.d3(p.y), 0xe8f2ff, 10, 1.4); }); // the blade bites the floor: sparks
    f.later(r.skill.hits[0]?.at ?? hold, () => { const p = me(f, r); // the counter-slash: one big inked iron ring flat round him
      f.slash(p, side(r), W.iron, { r: 150, w: 60, tilt: 8, a0: -180, a1: 180, ms: 240, y0: 70, i: 1.8, ink: true });
      f.host.ring(f.host.w3(p.x), f.host.d3(p.y), W.iron, f.host.w3(330), 420, 0.6);
    });
  } },
  // HOLY
  judgment_blade: { tone: W.holy, own: true, fired: (f, r, i, o) => { if (i === 0) return; // the judge's blade dives in (David 18 Oct 18:19): the floor broken where it bites — a glowing wound, splinters thrown up — and alive while it stands: light running down the blade, sparks at its foot
    const now = performance.now(), pv = jbVolley.get(r.attackerId), vn = pv && now - pv.at < 1500 ? pv.n + 1 : 0; jbVolley.set(r.attackerId, { at: now, n: vn });
    const d = r.aim.x < 0 ? -1 : 1, lean = [0.42, 0.34, 0.5][vn % 3], x = o.x + [0, -55, 55][vn % 3], y = o.y + [0, -6, 6][vn % 3], L = 270;
    const foot = { x, y, z: 0 }, top = { x: x - d * Math.sin(lean) * L, y, z: Math.cos(lean) * L };
    f.skyBeam(foot, W.holy, { ms: 300, w: 7 });
    f.impact(foot, W.holy, { r: 55, cracks: false, embers: 10 });
    f.crack(x, y, 0xffc860, { r: 75, ms: 1300, chunks: 0, quiet: true }); f.debris(x, y, 9, { up: 1.6, speed: 0.8, dir: -d }); // the wound in the planks, splinters thrown back up its path
    for (let t = 420; t < 4800; t += 620) f.later(t, () => f.streak(top, foot, 0xfff0b8, { w: 6, ms: 260, draw: 200, quiet: true })); // light running down the blade
    for (let t = 300; t < 4900; t += 330) f.later(t, () => f.host.embers(f.host.w3(x), 0.03, f.host.d3(y), t % 990 < 330 ? 0xffd27a : 0xfff0b8, 2, 1.1)); // sparks at its foot
  } },
  sanctuary: { tone: W.holy, own: true, active: (f, r) => { const c = me(f, r), d = side(r), wx = c.x + d * 80, at = (k: number) => ({ x: wx + d * 150 * (1 - k * k), y: c.y + k * 170 }); for (let n = 0; n < 8; n++) { const a = at(-1 + n / 4), b = at(-1 + (n + 1) / 4); f.floorStreak(a.x, a.y, b.x, b.y, W.holy, { w: 26, ms: 4200, a: 0.95 }); } /* the wall's foot: a seam of light burnt into the planks along its curve */ for (const k of [-0.8, -0.4, 0, 0.4, 0.8]) { const p = at(k); crk(f, p.x, p.y, 0xffd27a, { r: 46, chunks: 3 }); f.crystals(p.x, p.y, { n: 3, r: 22, h: 30, ms: 4000, stone: true }); } /* cracks where it bit into the floor, the planks heaved up in broken shards along its foot */ for (let t = 0; t < 4000; t += 400) f.later(t, () => { const p = at(Math.random() * 2 - 1); f.host.embers(f.host.w3(p.x), 0.05, f.host.d3(p.y), W.holy, 5, 1.3); }); /* motes rising off its foot while it stands */ f.host.kick(0.03); } }, // Sanctuary (David 01:07: "joined to the floor, not floating"): the wall of light planted in the planks — a burning seam along its curved foot, cracks where it bit in, motes rising from its base for its 4 s
  titans_verdict: { tone: 0xffb84a, own: true, active: (f, r) => { const c = ahead(f, r, 110); for (let k = 0; k < 4; k++) f.later(k * 120, () => f.glyph(c.x, c.y, W.holy, { shape: 'runes', r: 230, ms: 2600 - k * 120, spin: 0.25, pulse: 0.8, a: 0.18 })); /* (David 18:19: swelling in, never popped) */ f.later(60, () => f.skyBeam({ x: c.x, y: c.y, z: 0 }, 0xffd27a, { ms: 520, w: 16 })); f.host.kick(0.08); f.later(180, () => { f.debris(c.x, c.y, 16, { up: 1.8 }); scar(f, c.x, c.y, { r: 290, life: 3000, hot: W.molten, rings: 3, embers: 0 }); /* the crater: the planks split wide, molten gold in the cracks */ f.crystals(c.x, c.y, { ring: true, n: 14, r: 200, h: 130, ms: 2600, stone: true }); /* a crown of broken rock thrust up round it */ for (let k = 0; k < 4; k++) f.later(k * 140, () => f.glyph(c.x, c.y, 0xffb84a, { shape: 'star', r: 300, ms: 3200 - k * 140, spin: -0.15, pulse: 1.2, a: 0.14 })); /* a great gold star burnt into the floor under the runes */ for (let t = 0; t < 2600; t += 260) f.later(t, () => f.host.embers(f.host.w3(c.x + (Math.random() - 0.5) * 300), 0.05, f.host.d3(c.y + (Math.random() - 0.5) * 120), 0xffb84a, 6, 1.6)); }); } }, // (David 01:07: what stays on the floor more powerful — a crater with molten gold cracks, a crown of rock, a gold star under the runes, embers rising) Titan's Verdict (DAVID 20:56): the Judge's verdict — a great ring of holy runes opens under the foe and turns, the titan's blade comes down as one gold beam from the sky (with DFO's moment before it and his impact on the blow; the room lit warm gold)
  // CRIMSON
  war_cry: { tone: W.crimson, own: true, active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, W.crimson, { r: 230, ms: 520, a: 0.4 }); f.later(90, () => f.dome(c.x, c.y, W.blood, { r: 170, ms: 440, a: 0.3 })); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 6, 1.2); f.host.embers(f.host.w3(c.x), 0.9, f.host.d3(c.y), W.crimson, 22, 3.2); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); } }, // the roar: a shock ring of red air, the dust blown off the planks
  lions_maw: { tone: W.crimson, own: true, crest: { c: W.crimson, h: 150, w: 120 }, trail: false, active: (f, r) => { // the lion that stays (its linger at the aim): a ring of claw runes burns under it, every roar a crimson ring and sparks, the last a burst of embers
    const L = r.skill.linger; if (!L) return;
    const off = L.offset ?? 0, x = r.origin.x + r.aim.x * off, y = r.origin.y + r.aim.y * off, hx = f.host.w3(x), hz = f.host.d3(y);
    f.later(L.startMs, () => f.glyph(x, y, W.crimson, { shape: 'runes', r: L.radius, ms: (L.count - 1) * L.everyMs + 500, spin: 0.2, pulse: 0.6, a: 0.55 }));
    for (let i = 0; i < L.count; i++) f.later(L.startMs + i * L.everyMs, () => {
      const last = i === L.count - 1;
      f.host.ring(hx, hz, last ? 0xffc860 : W.crimson, f.host.w3(L.radius * (last ? 2.4 : 2)), last ? 520 : 420, last ? 0.8 : 0.6);
      f.host.embers(hx, 0.9, hz, i % 2 ? 0xffb040 : W.crimson, last ? 30 : 8, last ? 2.6 : 1.2);
      if (last) f.impact({ x, y, z: 90 }, W.crimson, { r: 100, cracks: false, embers: 24 });
    });
  } },
  blade_storm: { tone: W.crimson, own: true, active: (f, r) => f.bladeBall(r.attackerId, W.crimson, { r: 150, ms: T(r).active, every: 70, ink: true, w: 40 }) }, // Blade Storm (DAVID 20:56): a ball of inked crimson blade rings at many angles whirling round him for the whole storm — the one shape; the main hit's impact is DFO's
};
