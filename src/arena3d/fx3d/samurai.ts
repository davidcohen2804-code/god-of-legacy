// PVP 3D — the Samurai's skills in the room's 3D. Rebuilt to David's bar (17 Oct, his reference "Prometheus: Ring of
// Fire", docs/ref/prometheus/; the board's 8 points), skill by skill: one colour family — a white-hot core → his crimson →
// a dark ink stroke (blade3d.ts: SAM); every cut a thick ribbon ring in perspective round him (the basic chain); the Iai the
// beat — a razor line across the field that hangs and splits; Phantom Blades, God of Blades' strikes and Dragon Eclipse's eight cuts the
// flurry of long crossing lines; Tornado Blade a ball of blades; Shadow Step and Kagemusha ink bursts. The skills not
// rebuilt yet keep their pieces (each its old family tone) until their turn. The room answers the rebuilt ones' blows in
// SAM.light (a crimson flare washed the red courtyard redder). In PVP 3D the rebuilt skills' flat painted cuts and marks
// stay out (SamuraiFx IN3D_OWN). Owned by the Samurai chat; the room's pieces are in ../Fx3D.ts (DFO's), ours in blade3d.ts.
import type { Recipe, Fx3D, V3 } from '../Fx3D';
import { C, me, side, T } from './kit';
import { ring, flurry, slit, bladeBall, inkBurst, sparks, SAM, run, soon, razor, star, glintRun, floorLine, petalBurst, petalStream } from './blade3d';
import type { Projectile } from '../../skills/HitGeometry';
import type { CastRun } from '../../skills/SkillRuntime';

const flip = () => (Math.random() < 0.5 ? 1 : -1);
/** Sword Wave's crescents still out (by thrower): flying, slowing, turning, waiting for their way back (the engine's linger
 *  calls `waveBack`). */
type Wave3 = { id: string; pos: V3; waiting: () => boolean; back: (to: () => V3) => void };
const waves = new Set<Wave3>();
/** Sword Wave (David 18 Oct 18:29: "a light wave that looks professional"): a crescent of blade light with volume riding the
 *  shot — a white-hot edge, its light tapering behind it (fainter copies trailing on its path), its plane along its way (in
 *  perspective as it crosses the depth), leaning into it; a wake of torn air and petals, a shallow line of light scored on
 *  the planks under it. At its end it slows, turns round, its light deepening to crimson, waits — and on the engine's
 *  return (the linger) flies back to his hand, the same crescent, scoring the planks again. */
const thrown = new WeakSet<Projectile>();
const waveCrescent = (f: Fx3D, p: Projectile) => {
  if (p.hitIndex > 0 || thrown.has(p)) return; // (the room hands a shot with no trail of its own to `shot` every frame: one crescent a shot)
  thrown.add(p);
  const h = f.host, n = Math.hypot(p.dx, p.dy) || 1, ux = p.dx / n, uy = p.dy / n, dir = ux < 0 ? -1 : 1;
  const tx = h.w3(p.x + ux * 100) - h.w3(p.x), tz = h.d3(p.y + uy * 100) - h.d3(p.y), tl = Math.hypot(tx, tz) || 1;
  const yaw0 = ((Math.atan2((-dir * tz) / tl, (dir * tx) / tl) - f.camYaw()) * dir * 180) / Math.PI;
  const R = 112, BACK = 92, DARK = 0.22, base = () => Math.max(0, p.z - 45);
  const pos: V3 = { x: p.x - ux * BACK, y: p.y - uy * BACK, z: base() };
  type St = 'fly' | 'slow' | 'turn' | 'hang' | 'back' | 'gone';
  let st: St = 'fly', t = 0, ts = 0, yaw = yaw0, dark = 0, a = 1, from = { ...pos }, goal: (() => V3) | null = null, lx = pos.x + ux * 30, ly = pos.y + uy * 30, wake = 0;
  const shape = { r: R, w: 64, y0: 104, fwd: 0, tilt: 90, a0: -34, a1: 164, sweep: 0.03, fill: 1, lit: SAM.rose, ms: 6000, fade: 100, noInk: true, rim: true, inkW: 0.001, until: () => st === 'gone' }; // (no ink stroke: an inkW of 0 is an empty smoothstep — on some GPUs the whole ribbon turned to ink)
  ring(f, pos, dir, { ...shape, grad: 1.5, gain: 1.15, edge: 0.86, follow: () => pos, live: () => ({ yaw, roll: -10, dark, a }) }); // (fainter copies trailing it stacked into a white slab: its own band tapers behind its edge instead) // (its light thin and white-hot at its edge, a rose glow tapering in from it: a wash of white on the red planks before)
  const arc = () => { const th = ((-20 + Math.random() * 175) * Math.PI) / 180; return { x: pos.x + ux * Math.sin(th) * R * 0.92, y: pos.y + uy * Math.sin(th) * R * 0.92 + 3, z: pos.z + 104 + Math.cos(th) * R * 0.92 }; };
  petalStream(f, () => (st === 'fly' || st === 'back' ? arc() : null), petals(f), { rate: 46, life: 760, back: { x: -ux * 160, y: -uy * 120, z: 30 }, size: 1.1, max: 70, foeY: () => pos.y });
  const me: Wave3 = { id: p.attackerId, pos, waiting: () => st === 'slow' || st === 'turn' || st === 'hang', back: (to: () => V3) => { goal = to; from = { ...pos }; st = 'back'; ts = 0; dark = DARK; } };
  waves.add(me);
  run(f, { step: (dt) => {
    t += dt;
    if (st === 'fly') {
      if (!p.done) { pos.x = p.x - ux * BACK; pos.y = p.y - uy * BACK; pos.z = base(); }
      else { st = 'slow'; ts = 0; from = { ...pos }; }
    } else if (st === 'slow') { // it slows past its end…
      ts += dt; const k = Math.min(1, ts / 170), e = 1 - (1 - k) * (1 - k);
      pos.x = from.x + ux * 50 * e; pos.y = from.y + uy * 50 * e; if (k >= 1) { st = 'turn'; ts = 0; }
    } else if (st === 'turn') { // …turns round, going dark…
      ts += dt; const k = Math.min(1, ts / 220), e = k * k * (3 - 2 * k);
      yaw = yaw0 + 180 * e; dark = DARK * e; if (k >= 1) { st = 'hang'; ts = 0; }
    } else if (st === 'hang') { // …and waits, breathing, for its way back
      ts += dt; a = 0.88 + 0.12 * Math.sin(ts / 70); if (ts > 1400) st = 'gone';
    } else if (st === 'back' && goal) { // back to his hand, faster and faster
      ts += dt; const h0 = goal(), g = { x: h0.x + ux * R * 0.6, y: h0.y + uy * R * 0.6, z: h0.z }, k = Math.min(1, ts / 260), e = k * k; // (its centre stops ahead of him: its front goes into his hand)
      pos.x = from.x + (g.x - from.x) * e; pos.y = from.y + (g.y - from.y) * e; pos.z = from.z + (g.z - from.z) * e; a = 1;
      if (k >= 1) { st = 'gone'; waves.delete(me); soon(f, () => { star(f, { x: h0.x + dir * 22, y: h0.y + 8, z: h0.z + 60 }, 16, 180); f.host.flare(f.host.w3(h0.x), f.host.h3(h0.z + 60), f.host.d3(h0.y) + 0.2, SAM.light, 8, 4, 240); }); }
    }
    if (st === 'gone') { waves.delete(me); return false; }
        if (st === 'fly' || st === 'back') {
      const fx = pos.x + ux * 32 * (st === 'back' ? -1 : 1), fy = pos.y + uy * 32 * (st === 'back' ? -1 : 1);
      if (Math.hypot(fx - lx, fy - ly) > 22) { // the planks scored under it: a line of light, white-hot along its middle
        const x0 = lx, y0 = ly, back = st === 'back';
        soon(f, () => { f.floorStreak(x0, y0, fx, fy, back ? SAM.crimson : SAM.rose, { w: 12, ms: back ? 460 : 700, a: 0.65 }); f.floorStreak(x0, y0, fx, fy, SAM.core, { w: 3, ms: back ? 240 : 360, a: back ? 0.5 : 0.9 }); });
        lx = fx; ly = fy;
      }
      if (t >= wake) { // torn air: thin lines of light pulled off its edge, left behind
        wake = t + 32; const q = arc(), L = 40 + Math.random() * 60, sg = st === 'back' ? -1 : 1;
        soon(f, () => slit(f, { x: q.x - ux * sg * (14 + L), y: q.y - uy * sg * (14 + L), z: q.z }, { x: q.x - ux * sg * 10, y: q.y - uy * sg * 10, z: q.z }, { w: 2.2, ms: 170, draw: 0, col: SAM.light, front: Math.random() < 0.6 }));
      }
    }
    return true;
  }, dispose: () => { waves.delete(me); } });
};
/** The engine's return (Sword Wave's linger, SamuraiFx.waveReturn): the waiting crescent of this thrower nearest the far end
 *  of its line flies back to his hand (or where he threw it, when he has gone far from there). False: none waiting. */
export const waveBack = (f: Fx3D, id: string, from: { x: number; y: number }, aim: { x: number; y: number }, len: number): boolean => {
  const n = Math.hypot(aim.x, aim.y) || 1, ex = from.x + (aim.x / n) * len, ey = from.y + (aim.y / n) * len;
  let best: Wave3 | null = null, bd = 1e9;
  for (const w of waves) if (w.id === id && w.waiting()) { const d = Math.hypot(w.pos.x - ex, w.pos.y - ey); if (d < bd) { bd = d; best = w; } }
  if (!best) return false;
  best.back(() => { const c = f.host.casterPos(id); return c && Math.hypot(c.x - from.x, c.y - from.y) < 160 ? { x: c.x, y: c.y, z: c.z } : { x: from.x, y: from.y, z: 0 }; });
  return true;
};
/** The samurai's petals as the room's textures (SamuraiFx cuts them out of his kit: `petalLook`). */
const petals = (f: Fx3D) => [1, 2, 3, 4].map((k) => f.host.texture?.(`sam-petal_${k}`) ?? null);
/** The Iai's last draw: its line's way and how long it hangs before it splits (its burst on the foe comes then). */
let iaiLast = { x: 1, y: 0, hang: 260 };
/** The Iai's stillness (David 18 Oct 18:29: the iai as a beat): held in the drawing stance, a glint runs down his scabbard
 *  at the start and at each charge level, brighter each time; a hairline of light on the planks shows how far the draw
 *  will cut; at full charge a thin ring of light closes round his feet. No flash pictures. */
const iaiStance = (f: Fx3D, r: CastRun) => {
  const L = r.skill.charge?.levels; if (!L) return;
  const sc = r.chargeScale ?? 1, at = L.map((l) => l.at * sc), d = side(r), pos = () => f.host.casterPos(r.attackerId);
  const hilt = () => { const c = pos(); return c ? { x: c.x + d * 20, y: c.y + 8, z: c.z + 50 } : null; };
  const tip = () => { const c = pos(); return c ? { x: c.x - d * 46, y: c.y + 8, z: c.z + 28 } : null; };
  const lenOf = (k: number) => (L[k].hits[0]?.shape as { length?: number } | undefined)?.length ?? 200;
  let lv = -1, len = 0;
  run(f, { step: (dt) => {
    if (r.phase !== 'startup') return false;
    const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0;
    if (nl > lv) {
      lv = nl; const k = lv; soon(f, () => glintRun(f, hilt, tip, { ms: 230 - 40 * k, w: 4 + k, star: 9 + 6 * k }));
      if (lv === 2) { const c = pos(); if (c) f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SAM.light, f.host.w3(64), 380, 0.5); }
    }
    len += (lenOf(lv) - len) * Math.min(1, dt / 90);
    return true;
  }, dispose: () => {} });
  floorLine(f, () => {
    const c = pos(); if (r.phase !== 'startup' || !c || lv < 0) return null;
    const n = Math.hypot(r.aim.x, r.aim.y) || 1, ux = r.aim.x / n, uy = r.aim.y / n;
    return { x0: c.x + ux * 18, y0: c.y + uy * 18, x1: c.x + ux * len, y1: c.y + uy * len, w: 3 + 1.5 * lv, a: 0.3 + 0.15 * lv };
  });
};
/** The draw: one razor line of light across the field along his cut (a white-hot core in his rose, an ink edge) — it hangs
 *  a beat, then splits open in crimson and goes dark; the hilt glints as the blade leaves it; fully drawn, the planks are
 *  scored along the cut. The blade's click home: a glint at the hilt. */
const iaiDraw = (f: Fx3D, r: CastRun) => {
  const c = me(f, r), n = Math.hypot(r.aim.x, r.aim.y) || 1, ux = r.aim.x / n, uy = r.aim.y / n, lv = r.chargeLevel ?? 0, d = side(r);
  const len = (r.hits[0]?.shape as { length?: number } | undefined)?.length ?? 240, far = len * 1.5 + 160, z = c.z + 70, hang = 130 + 20 * lv; // (the blow's hit-stop holds it too: it hangs while he is still there)
  iaiLast = { x: ux, y: uy, hang };
  razor(f, { x: c.x + ux * 10, y: c.y + uy * 10, z: z + 4 }, { x: c.x + ux * far, y: c.y + uy * far, z: z - 6 }, { w: 24 + 4 * lv, lip: 1.6 + 0.3 * lv, hang,
    onSplit: () => f.host.flare(f.host.w3(c.x + ux * len * 0.6), f.host.h3(z), f.host.d3(c.y + uy * len * 0.6) + 0.2, SAM.crimson, 10 + 4 * lv, 6, 260) });
  star(f, { x: c.x + d * 22, y: c.y + 8, z: c.z + 50 }, 12 + 4 * lv, 140);
  if (lv === 2) {
    f.floorStreak(c.x + ux * 20, c.y + uy * 20, c.x + ux * len, c.y + uy * len, SAM.rose, { w: 6, ms: 1100, a: 0.6 });
    for (let i = 0; i < 3; i++) f.later(60 + i * 50, () => f.host.dust(f.host.w3(c.x + ux * len * (0.35 + 0.25 * i)), f.host.d3(c.y + uy * len * (0.35 + 0.25 * i)), 2, 0.5));
  }
  f.later(T(r).active + T(r).recovery * 0.6, () => { const e = f.host.casterPos(r.attackerId); if (e) star(f, { x: e.x + d * 20, y: e.y + 8, z: e.z + 50 }, 9, 130); });
};
/** On the foe: at the draw a hairline flash across him along the cut; when the line splits, the cut arrives — petals and
 *  ink burst out of him, thrown along it. (The blossom draw's extra cuts: a few petals.) */
const iaiBurst = (f: Fx3D, at: V3, main: boolean) => {
  const d = iaiLast.x < -0.01 ? -1 : 1, z0 = at.z + 30, o = { x: at.x, y: at.y, z: z0 }; // (on the razor's line: `at` is his body 40 px up)
  if (!main) { petalBurst(f, o, petals(f), { n: 8, speed: 220, dir: d * 0.5, ms: 700, foeY: at.y }); sparks(f, at, d, 3, 40); return; }
  slit(f, { x: at.x - iaiLast.x * 80, y: at.y - iaiLast.y * 80 + 2, z: z0 + 5 }, { x: at.x + iaiLast.x * 80, y: at.y + iaiLast.y * 80 + 2, z: z0 - 5 }, { w: 3.5, ms: 150, draw: 0, col: SAM.core, front: true });
  f.later(iaiLast.hang, () => {
    inkBurst(f, o, { r: 86, n: 10, ms: 480, foeY: at.y });
    petalBurst(f, o, petals(f), { n: 30, speed: 360, dir: d * 0.55, up: 0.55, ms: 1100, foeY: at.y });
    sparks(f, at, d, 7, 66);
  });
};
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
  quick_slash: { own: true, tone: SAM.rose, // (the room's main hit takes this colour: in the pale light its burst stood as a white bubble over the foe)
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
  // the click of the blade home (the guard released): a thin white-hot ring closing round his waist, a ring of light on the
  // planks (the guard itself and its substitute are SamuraiFx's: the ring at his feet, the doll, the ink)
  sheathe: { own: true, tone: SAM.rose,
    active: (f, r) => { const c = me(f, r);
      ring(f, c, side(r), { r: 66, w: 16, y0: 66, tilt: 6, a0: -170, a1: 170, ms: 260, sweep: 0.4, hold: 40, inkW: 0.3, lit: SAM.rose, gain: 1.2, quiet: true, follow: () => f.host.casterPos(r.attackerId) });
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SAM.light, 1.6, 300, 0.5); } },
  // (David 18 Oct 18:29: the iai as a beat) the stillness — a glint down the scabbard, the reach a hairline on the planks;
  // the draw — one razor line of light across the field that hangs and splits; the cut arriving late on the foe — a hairline
  // flash on him, then petals and ink bursting out (the room plays the main hit in his rose)
  iai_strike: { own: true, tone: SAM.rose,
    cast: (f, r) => iaiStance(f, r),
    active: (f, r) => iaiDraw(f, r),
    hit: (f, _s, h, at, main) => iaiBurst(f, at, main && !!h.heavy) },
  // (David 18 Oct 18:29: "a light wave that looks professional") a glint at his hand, the fling a ribbon ring at his blade;
  // the crescent rides the shot and comes back (waveCrescent / waveBack); where it cuts: sparks (the room plays the main hit)
  sword_wave: { own: true, tone: SAM.rose, trail: false,
    cast: (f, r) => { const c = me(f, r); star(f, { x: c.x + side(r) * 24, y: c.y + 8, z: c.z + 62 }, 13, 150); },
    active: (f, r) => ring(f, me(f, r), side(r), { r: 104, w: 40, y0: 88, fwd: 14, tilt: 70, yaw: 20, a0: -40, a1: 150, ms: 180, lit: SAM.rose, gain: 1.3, quiet: true }),
    shot: (f, p) => waveCrescent(f, p),
    hit: (f, _s, _h, at) => sparks(f, at, Math.random() < 0.5 ? 1 : -1, 5, 56) },
  // the stance: a rose haze round him for the window; the counter cut: three rose cuts crossing on the attacker
  mirage: { own: true, tone: C.rose,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, C.rose, { r: 120, ms: 480, a: 0.3, hold: 1, follow: () => f.host.casterPos(r.attackerId) }); },
    hit: (f, _s, _h, at) => {
      for (let i = 0; i < 2; i++) f.later(i * 70, () => f.slash(at, i % 2 ? -1 : 1, C.rose, { r: 104, w: 36, tilt: [25, 65][i], a0: -100, a1: 130, ms: 240, i: 0.9 }));
      f.dome(at.x, at.y, C.rose, { r: 90, ms: 300, a: 0.18 }); } }, // (two soft arcs: three bright ones hid the foe at the counter)
  // (David's bar: his signature, one shape — a storm of real petals round him in the room, SamuraiFx on DFO's swirl) each
  // of the four chasing cuts: a ribbon ring through the foe at a new tilt (a hot rose body, white-hot edge, ink inside);
  // the fifth throws him up: a white-hot line up through him, the petals round him blown (the column of petals he rises in
  // is SamuraiFx's); the room plays the main hit
  blossom_storm: { own: true, tone: SAM.rose, // (the room answers its five blows in rose: in the pale light its floor rings and flares stacked into a white wash)
    hit: (f, _s, h, at) => {
      if (!h.heavy) { ring(f, at, flip(), { r: 98, w: 40, y0: 76, tilt: 14 + Math.random() * 56, yaw: (Math.random() - 0.5) * 70, a0: -110, a1: 125, ms: 170, lit: SAM.rose, gain: 1.3 }); sparks(f, at, flip(), 3, 40); return; }
      rise(f, at);
      f.host.blow(f.host.w3(at.x), 0.6, f.host.d3(at.y), 5, 5); } },
  // (David's bar: the ultimate, one shape — the eclipse) the dark falls round him; (the flurry — 04) the eight cuts out of
  // the dark are long thin lines crossing the foe, each there at once and held by its hit-stop — they cross into a star of
  // cuts; the colossal cut is the painted dragon's and the sun's breaking (no crescent: the Iai's is a razor line), its blow the
  // room's main hit
  dragon_eclipse: { own: true, tone: SAM.rose,
    active: (f, r) => { const c = me(f, r); f.dome(c.x, c.y, 0x3a0a1a, { r: 420, ms: 900, a: 0.4 }); }, // (lighter: in the dark the fighters were not readable — DFO)
    hit: (f, _s, _h, at, main) => {
      if (!main) flurry(f, () => at, { ms: 1, len: 540, w: 14, front: true, draw: 0 }); } }, // (one cut a hit, there at once: the hit-stops hold them — eight lines crossing into a star; the great cut's blow is the room's main hit — no cracks of its own on top)
  // (David's bar: the main launcher, one shape — a swallow's tail, Λ) the rising cut: one upright ribbon ring swept up
  // from the planks through the foe (a hot rose body, white-hot edge, ink inside); the launch: a white-hot line up through
  // him; the second cut: a ring swept back down through him in the air. Its painted trail and marks stay out in PVP 3D.
  swallow_cut: { own: true, tone: SAM.rose,
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
  // (David's bar: a ball of blades — 07) rings of the blade at every tilt round him, turning with him through the spin;
  // (David 01:15: spammed while jumping, no cooldown) each cast its own ball, gone before the next jump's
  tornado_blade: { own: true, tone: SAM.rose, // (the room's main hit takes this colour: pale, its burst stood as a white bubble)
    active: (f, r) => bladeBall(f, r.attackerId, side(r), { ms: T(r).active, every: 42, r: 108, y0: 50 }),
    hit: (f, _s, _h, at, main) => sparks(f, at, Math.random() < 0.5 ? 1 : -1, main ? 7 : 4, 56) }, // (the smash down's blow is the room's main hit — no cracks of its own on top)
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
