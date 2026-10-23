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
import { ring, flurry, slit, bladeBall, inkBurst, sparks, SAM, run, soon, star, glintRun, floorLine, petalBurst, petalStream, paintTex, paintFly, paintTrail, paintArc } from './blade3d';
import type { Projectile } from '../../skills/HitGeometry';
import type { CastRun } from '../../skills/SkillRuntime';

const flip = () => (Math.random() < 0.5 ? 1 : -1);
/** The samurai's painted art for the room (GPT on black: `flip`). */
const ART_DIR = 'assets/final/skills/samurai/fx3d/';
/** Sword Wave's crescents still out (by thrower): flying, slowing, turning, waiting for their way back (the engine's linger
 *  calls `waveBack`). */
type Wave3 = { id: string; pos: V3; waiting: () => boolean; back: (to: () => V3) => void };
const waves = new Set<Wave3>();
/** Sword Wave (David 18 Oct 18:29: "a light wave that looks professional"; DFO's review: painted, not a ring drawn in code):
 *  a painted crescent of blade light (GPT on black: a white-hot leading edge, a rose-crimson body streaked with speed, its
 *  trailing edge breaking into dark smoke and petals) riding the shot, turned along its flight; petals spilling from it,
 *  torn air pulled off its edge, a shallow line of light scored on the planks under it. At its end it slows, turns round
 *  to face him and waits — and on the engine's return (the linger) flies back to his hand, scoring the planks again. */
const thrown = new WeakSet<Projectile>();
const WAVE = ART_DIR + 'wave_crescent.webp';
const waveCrescent = (f: Fx3D, p: Projectile) => {
  if (p.hitIndex > 0 || thrown.has(p)) return; // (one crescent a shot)
  thrown.add(p);
  const n = Math.hypot(p.dx, p.dy) || 1, ux = p.dx / n, uy = p.dy / n, dir = ux < 0 ? -1 : 1;
  const W = 230, RX = 92, RZ = 118, BACK = 70, base = () => Math.max(0, p.z - 45) + 122; // (its centre: the leading edge at the shot's point, its lower horn on the planks)
  const pos: V3 = { x: p.x - ux * BACK, y: p.y - uy * BACK, z: base() };
  type St = 'fly' | 'slow' | 'turn' | 'hang' | 'back' | 'gone';
  let st: St = 'fly', t = 0, ts = 0, from = { ...pos }, goal: (() => V3) | null = null, lx = pos.x + ux * 60, ly = pos.y + uy * 60, wake = 0;
  const art = { w: W, mode: 'up' as const, loop: true, ms: 8000, glow: 0.22 };
  const flight = f.flip(WAVE, () => (st === 'fly' || st === 'slow' ? pos : null), { ...art, along: true, fadeIn: 40, fadeOut: 110 }); void flight;
  let waiting: { end(): void } | null = null;
  const arcPt = (sg: number) => { const th = ((-68 + Math.random() * 136) * Math.PI) / 180; return { x: pos.x + ux * sg * Math.cos(th) * RX * 0.8, y: pos.y + uy * sg * Math.cos(th) * RX * 0.8 + 3, z: pos.z + Math.sin(th) * RZ * 0.9 }; };
  petalStream(f, () => (st === 'fly' ? arcPt(1) : st === 'back' ? arcPt(-1) : undefined), petals(f), { rate: 40, life: 800, back: { x: -ux * 150, y: -uy * 110, z: 20 }, size: 1.1, max: 70, foeY: () => pos.y });
  const me: Wave3 = { id: p.attackerId, pos, waiting: () => st === 'slow' || st === 'turn' || st === 'hang',
    back: (to: () => V3) => { goal = to; from = { ...pos }; st = 'back'; ts = 0; waiting?.end(); waiting = null;
      f.flip(WAVE, () => (st === 'back' ? pos : null), { ...art, along: true, fadeIn: 60, fadeOut: 90, tint: 0xff8fa0, core: 0.9 }); } };
  waves.add(me);
  run(f, { step: (dt) => {
    t += dt;
    if (st === 'fly') {
      if (!p.done) { pos.x = p.x - ux * BACK; pos.y = p.y - uy * BACK; pos.z = base(); }
      else { st = 'slow'; ts = 0; from = { ...pos }; }
    } else if (st === 'slow') { // it slows past its end…
      ts += dt; const k = Math.min(1, ts / 170), e = 1 - (1 - k) * (1 - k);
      pos.x = from.x + ux * 46 * e; pos.y = from.y + uy * 46 * e; if (k >= 1) { st = 'turn'; ts = 0; }
    } else if (st === 'turn') { // …turns round to face him (the flying crescent gives way to the one facing back)…
      if (ts === 0) waiting = f.flip(WAVE, pos, { ...art, ms: 1600, flipX: ux > 0, fadeIn: 110, fadeOut: 120, tint: 0xffb0bc, core: 0.9 });
      ts += dt; if (ts >= 120) { st = 'hang'; ts = 0; }
    } else if (st === 'hang') { // …and waits for its way back
      ts += dt; if (ts > 1400) { st = 'gone'; waiting?.end(); }
    } else if (st === 'back' && goal) { // back to his hand, faster and faster
      ts += dt; const h0 = goal(), g = { x: h0.x + ux * 40, y: h0.y + uy * 40, z: h0.z + 122 }, k = Math.min(1, ts / 260), e = k * k;
      pos.x = from.x + (g.x - from.x) * e; pos.y = from.y + (g.y - from.y) * e; pos.z = from.z + (g.z - from.z) * e;
      if (k >= 1) { st = 'gone'; soon(f, () => star(f, { x: h0.x + dir * 22, y: h0.y + 8, z: h0.z + 60 }, 16, 180)); }
    }
    if (st === 'gone') { waves.delete(me); return false; }
    if (st === 'fly' || st === 'back') {
      const sg = st === 'back' ? -1 : 1, fx = pos.x + ux * 60 * sg, fy = pos.y + uy * 60 * sg;
      if (Math.hypot(fx - lx, fy - ly) > 22) { // the planks scored under it: a line of light, white-hot along its middle
        const x0 = lx, y0 = ly, back = st === 'back';
        soon(f, () => { f.floorStreak(x0, y0, fx, fy, back ? SAM.crimson : SAM.rose, { w: 12, ms: back ? 460 : 700, a: 0.6 }); f.floorStreak(x0, y0, fx, fy, SAM.core, { w: 3, ms: back ? 240 : 360, a: back ? 0.5 : 0.85 }); });
        lx = fx; ly = fy;
      }
      if (t >= wake) { // torn air: thin lines of light pulled off its edge, left behind
        wake = t + 36; const q = arcPt(sg), L = 40 + Math.random() * 60;
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
/** The samurai's painted art in the room (David 18 Oct 20:51, a free hand in GPT: painted on black, played by DFO's `flip`
 *  so its colours hold on the red planks): Sword Wave's crescent of blade light (flying right), the glint of the blade at the
 *  hilt; his painted cuts (David 18 Oct 22:56: "in depth, not a page"; "not impressive enough"): a band of blade light torn
 *  into crimson smoke (its head at the right, its white-hot line a third of the way down) worn by a cut's arc or trail in
 *  the room's depth, and the swallow of light (seen from below, wings spread, flying right). */
const IAI_GLINT = ART_DIR + 'iai_glint.webp';
const SLASH = ART_DIR + 'slash_band.webp', SWALLOW = ART_DIR + 'swallow.webp';
for (const a of [SLASH, SWALLOW]) paintTex(a); // (on their way with the room: a cut's 120 ms wind-up is too short to fetch them at a first cast)
/** The samurai's petals as the room's textures (SamuraiFx cuts them out of his kit: `petalLook`). */
const petals = (f: Fx3D) => [1, 2, 3, 4].map((k) => f.host.texture?.(`sam-petal_${k}`) ?? null);
/** The Iai's draws fly this fast (px / ms), this far apart (ms). */
const IAI_SPEED = 1.5, IAI_GAP = 70;
/** The Iai's last draw: where it left from, its line's way, how many draws flew. */
let iaiLast = { x: 1, y: 0, from: { x: 0, y: 0 }, shots: 4 };
/** The Iai's stillness (David 18 Oct 18:29: the iai as a beat; 22:56: "hold the button, there's a charge"): held in the
 *  drawing stance, his light is drawn into the sheath — streaks from all round him run into the hilt, more at each charge
 *  level — and a glint runs down his scabbard at the start and at each level, brighter each time; fully charged, the hilt
 *  burns until the draw and a thin ring of light closes round his feet; a hairline of light on the planks shows how far
 *  the draw will cut. */
const iaiStance = (f: Fx3D, r: CastRun) => {
  f.flipLoad(IAI_GLINT);
  const L = r.skill.charge?.levels; if (!L) return;
  const sc = r.chargeScale ?? 1, at = L.map((l) => l.at * sc), d = side(r), pos = () => f.host.casterPos(r.attackerId);
  const hilt = () => { const c = pos(); return c ? { x: c.x + d * 20, y: c.y + 8, z: c.z + 50 } : null; };
  const tip = () => { const c = pos(); return c ? { x: c.x - d * 46, y: c.y + 8, z: c.z + 28 } : null; };
  const lenOf = (k: number) => { const sh = L[k].hits[0]?.shape as { length?: number; range?: number } | undefined; return sh?.length ?? sh?.range ?? 200; }; // (its draws are projectiles now: their range — DFO 23 Oct)
  let lv = -1, len = 0, acc = 0;
  run(f, { step: (dt) => {
    if (r.phase !== 'startup') return false;
    const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0;
    if (nl > lv) {
      lv = nl; const k = lv; soon(f, () => glintRun(f, hilt, tip, { ms: 230 - 40 * k, w: 4 + k, star: 9 + 6 * k }));
      f.flip(IAI_GLINT, () => hilt(), { w: 64 + 34 * k, mode: 'up', loop: true, ms: 380, grow: [0.35, 1.15], rot: 12 * k, fadeIn: 30, fadeOut: 230, glow: 0.45 }); // (the "ting" at the hilt: painted, bigger at each level — DFO: the stillness read too faint)
      if (lv === 2) {
        const c = pos(); if (c) f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SAM.light, f.host.w3(64), 380, 0.5);
        f.flip(IAI_GLINT, () => (r.phase === 'startup' ? hilt() : null), { w: 58, mode: 'up', loop: true, ms: 6000, delay: 300, rot: 20, fadeIn: 120, fadeOut: 60, glow: 0.35 }); // (full: the hilt burns until the draw)
      }
    }
    // his light drawn into the sheath: streaks from all round him into the hilt (14 a second, 26, then 40)
    acc += (dt / 1000) * [14, 26, 40][Math.max(0, lv)];
    while (acc >= 1) {
      acc -= 1; const h = hilt(); if (!h) break;
      const th = Math.random() * Math.PI * 2, R = 90 + Math.random() * 90, from = { x: h.x + Math.cos(th) * R, y: h.y + Math.sin(th) * R * 0.45, z: Math.max(8, h.z + (Math.random() - 0.35) * 130) }, k = Math.max(0, lv);
      soon(f, () => f.streak(from, h, Math.random() < 0.4 ? SAM.light : SAM.rose, { w: 3.5 + 1.5 * k, ms: 250, draw: 160, front: true, quiet: true }));
    }
    len += (lenOf(lv) - len) * Math.min(1, dt / 90);
    return true;
  }, dispose: () => {} });
  floorLine(f, () => {
    const c = pos(); if (r.phase !== 'startup' || !c || lv < 0) return null;
    const n = Math.hypot(r.aim.x, r.aim.y) || 1, ux = r.aim.x / n, uy = r.aim.y / n;
    return { x0: c.x + ux * 18, y0: c.y + uy * 18, x1: c.x + ux * len, y1: c.y + uy * len, w: 4 + 2 * lv, a: 0.45 + 0.2 * lv };
  });
};
/** The draw (David 18 Oct 22:56: "in depth, not a page … he releases 4 such nice shots"): the blade leaves the hilt in a
 *  flash and his held charge flies out along the cut as painted crescents of blade light — two, three, four by the level
 *  held — one after another, each upright in the room's depth (turned into it, its white-hot edge ahead, its crimson smoke
 *  torn off behind), at its own height and slant, the cuts alternating up and down; they fly the line's length and tear
 *  apart. Fully drawn, the planks are scored along it. The blade's click home: a glint at the hilt. */
const iaiDraw = (f: Fx3D, r: CastRun) => {
  const c = me(f, r), n = Math.hypot(r.aim.x, r.aim.y) || 1, ux = r.aim.x / n, uy = r.aim.y / n, lv = r.chargeLevel ?? 0, d = ux < -0.01 ? -1 : 1;
  const sh0 = r.hits[0]?.shape as { length?: number; range?: number } | undefined, len = sh0?.length ?? sh0?.range ?? 240, far = len + 50, shots = 2 + lv; // (its draws are projectiles now: their range — DFO 23 Oct)
  iaiLast = { x: ux, y: uy, from: { x: c.x, y: c.y }, shots };
  for (let k = 0; k < shots; k++) f.later(k * IAI_GAP, () => iaiShot(f, c, ux, uy, d, far, k, lv));
  f.flip(IAI_GLINT, { x: c.x + d * 22, y: c.y + 8, z: c.z + 52 }, { w: 96 + 22 * lv, mode: 'up', loop: true, ms: 220, grow: [1, 0.6], fadeIn: 10, fadeOut: 160, glow: 0.45 }); // (the blade leaving the hilt)
  f.floorStreak(c.x + ux * 20, c.y + uy * 20, c.x + ux * len, c.y + uy * len, SAM.rose, lv === 2 ? { w: 6, ms: 1100, a: 0.6 } : { w: 3, ms: 520, a: 0.35 });
  if (lv === 2) for (let i = 0; i < 3; i++) f.later(60 + i * 50, () => f.host.dust(f.host.w3(c.x + ux * len * (0.35 + 0.25 * i)), f.host.d3(c.y + uy * len * (0.35 + 0.25 * i)), 2, 0.5));
  f.later(T(r).active + T(r).recovery * 0.6, () => { const e = f.host.casterPos(r.attackerId); if (e) star(f, { x: e.x + d * 20, y: e.y + 8, z: e.z + 50 }, 9, 130); });
};
/** One of the Iai's draws: a painted crescent of blade light (its front `k`'s height and slant) flying from the hilt along the
 *  line to `far`, then torn apart. */
const iaiShot = (f: Fx3D, c: V3, ux: number, uy: number, d: number, far: number, k: number, lv: number) => {
  const R = 66 + 8 * lv, life = (far - 20) / IAI_SPEED + 90, down = k % 2 === 0;
  let t = 0; run(f, { step: (dt) => { t += dt; return t < life; }, dispose: () => {} });
  const front = () => { const s = Math.min(far, 20 + t * IAI_SPEED); return { x: c.x + ux * s, y: c.y + uy * s, z: c.z }; };
  const y0 = [62, 84, 46, 74][k % 4];
  paintArc(f, SLASH, front(), d, { r: R, w: 50 + 6 * lv, y0, fwd: -R, tilt: 86, yaw: 24, roll: [-8, 14, -18, 6][k % 4], a0: down ? 16 : 164, a1: down ? 164 : 16,
    ms: life, sweep: 30 / life, hold: life - 110, glow: 0.7, hi: 0.3, core: 15 + 3 * lv, quiet: k > 0, follow: front });
  f.flip(WAVE, () => (t < life - 40 ? (({ x, y, z }) => ({ x: x - d * R * 0.35, y, z: z + y0 }))(front()) : null), { w: 104 + 16 * lv, mode: 'up', loop: true, ms: life, along: true, fadeIn: 30, fadeOut: 90, glow: 0.3, tint: 0xffd2dc, core: 0.7 });
};
/** On the foe (the room's light and dust answer the blow; its burst is left out — DFO's review: it washed the draws white):
 *  each draw tears through him as it passes — a white-hot cut across him at its slant (they cross on him), sparks, a few
 *  petals — and after the last a small burst of petals and ink thrown along the cut. (The blossom draw's extra cuts: a few
 *  petals.) */
const iaiBurst = (f: Fx3D, at: V3, k: number, last: boolean, petal: boolean) => {
  const L = iaiLast, d = L.x < -0.01 ? -1 : 1, z0 = at.z + 30, o = { x: at.x, y: at.y, z: z0 }; // (on the draws' line: `at` is his body 40 px up)
  if (petal) { petalBurst(f, o, petals(f), { n: 8, speed: 220, dir: d * 0.5, ms: 700, foeY: at.y }); sparks(f, at, d, 3, 40); return; }
  // each draw's cut across him as it passes — each draw is its own hit now (DFO 23 Oct, the Samurai chat's ask), so the cut
  // lands on its hit — at its own slant: they cross on him
  const a = ((k % 2 === 0 ? 64 : 116) + [-8, 14, -18, 6][k % 4]) * (Math.PI / 180), cx = Math.cos(a) * 46 * d, cz = Math.sin(a) * 46;
  slit(f, { x: at.x - cx, y: at.y + 2, z: z0 - cz }, { x: at.x + cx, y: at.y + 2, z: z0 + cz }, { w: 4, ms: 190, draw: 26, col: SAM.core, front: true });
  sparks(f, at, d, 3, 48); petalBurst(f, o, petals(f), { n: 3, speed: 240, dir: d * 0.7, up: 0.4, ms: 600, foeY: at.y });
  if (last) f.later(40, () => { // (after the last: petals and ink thrown along the cut)
    inkBurst(f, o, { r: 46, n: 5, ms: 340, foeY: at.y, light: 0 });
    petalBurst(f, o, petals(f), { n: 10, speed: 280, dir: d * 0.55, up: 0.5, ms: 850, foeY: at.y });
  });
};
/** The side Swallow Cut's last cast faced (its hits come a beat after: the second cut sweeps down the way he faced). */
let swallowDir = 1;
/** A smooth way through timed points (Catmull-Rom): world px at `t` ms; held at its ends. */
const glide = (pts: [number, number, number, number][]) => (t: number): { x: number; y: number; z: number } => {
  const n = pts.length; let i = 0;
  if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2], z: pts[0][3] };
  if (t >= pts[n - 1][0]) return { x: pts[n - 1][1], y: pts[n - 1][2], z: pts[n - 1][3] };
  while (i < n - 2 && t > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)], u = (t - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
  const cr = (k: number) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
  return { x: cr(1), y: cr(2), z: cr(3) };
};
/** Where Swallow Cut's first blow found the foe (world px; its flight bends to him once he is struck). */
let swallowFoe: V3 | null = null;
/** Swallow Cut's flight (Tsubame-gaeshi, its Λ — David 18 Oct 22:56: "not impressive enough"): out of the planks at his front
 *  foot, up through the foe with the rising cut (the first blow, held by its hit-stop), a hook over his head, then straight
 *  down through him again as the blade turns back (the second blow), skimming the planks beyond and away up — t ms from the
 *  last of his wind-up, from his feet `c`, on his side `d`; `D` px to the foe until the first blow says where he is. Its
 *  rise passes behind the foe, its dive in front of him. */
const swallowFlight = (c: V3, d: number, D: number) => {
  const K: [number, number, number, number][] = [ // (the room's clock: the first blow's hit-stop holds t ≈ 55, the second's t ≈ 90)
    [0, 20, -10, 6], [55, -32, -16, 112], [90, -10, -14, 192], [115, 6, -8, 214], [140, 24, 2, 192], [172, 40, 14, 110],
    [200, 58, 22, 30], [245, 110, 30, 16], [325, 185, 40, 90], [410, 245, 46, 170],
  ];
  const rel = glide(K.map(([t, x, y, z], i) => [t, i === 0 ? x : x + D, y, z] as [number, number, number, number]));
  return (t: number): V3 => {
    const p = rel(t), k = Math.min(1, Math.max(0, (t - 55) / 80)), e = k * k * (3 - 2 * k), foe = swallowFoe; // (bent to the foe after the first blow)
    const dx = foe ? (Math.abs(foe.x - c.x) - D) * e : 0, dy = foe ? (foe.y - c.y) * e : 0;
    return { x: c.x + d * (p.x + dx), y: c.y + p.y + dy, z: c.z + p.z };
  };
};
/** The swallow's flight (the last 70 ms of his wind-up — the first blow's hit-stop holds the rising stroke through the foe):
 *  the blade's light a painted trail behind it (his crimson torn into smoke, its white-hot edge on the outside of the turn,
 *  the whole Λ there when the second blow's hit-stop holds it), the swallow of light at its head; petals spill from its
 *  dive and it goes into petals far beyond. */
const swallowCut = (f: Fx3D, r: CastRun) => {
  if (r.phase === 'done') return;
  const d = side(r), c = me(f, r), way = swallowFlight(c, d, 90), FLY = 410;
  swallowDir = d; swallowFoe = null;
  paintTrail(f, SLASH, way, { ms: FLY, len: 200, w: 96, hz: c.y, edge: d, core: 12, fade: 180, glow: 0.5, hi: 0.42 });
  paintFly(f, SWALLOW, way, { w: 150, ms: FLY + 40, fadeIn: 60, fadeOut: 140, ghosts: 2, lag: 16, glow: 0.45, grow: [0.8, 1.05], left: d < 0 }); // (over the fighters all its flight: behind the foe the room's bloom washed it pale)
  let t = 0; run(f, { step: (dt) => { t += dt; return t < FLY; }, dispose: () => {} });
  petalStream(f, () => (t >= FLY - 40 ? null : t < 150 ? undefined : way(t)), petals(f), { rate: 80, life: 650, back: { x: -d * 70, y: 0, z: 30 }, size: 1.1 });
  f.later(FLY - 40, () => petalBurst(f, way(FLY - 40), petals(f), { n: 16, speed: 240, dir: d * 0.6, up: 0.3, ms: 800 }));
};
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
  // (David 18 Oct 18:29: the iai as a beat; 22:56: "a charge, then 4 such nice shots") the stillness — his light drawn into
  // the sheath, a glint down the scabbard at each level, the reach a hairline on the planks; the draw — two to four painted
  // crescents of blade light flying the line; on the foe each tears through him, then a small burst of petals and ink (the
  // room plays the main hit in his rose)
  iai_strike: { own: true, tone: SAM.rose, paint: true, noImpact: true, trail: false, // (its blow is its draws' cuts on him: the room's main-hit burst held white through the hit-stop over the draws — DFO's review; its draws are hits now, drawn by the draw: no room trail on them)
    cast: (f, r) => iaiStance(f, r),
    active: (f, r) => iaiDraw(f, r),
    hit: (f, _s, h, at, main) => iaiBurst(f, at, Math.round(h.at / IAI_GAP), main && !!h.heavy, !!h.reaction.float) },
  // (David 18 Oct 18:29: "a light wave that looks professional") a glint at his hand, the fling a ribbon ring at his blade;
  // the crescent rides the shot and comes back (waveCrescent / waveBack); where it cuts: sparks (the room plays the main hit)
  sword_wave: { own: true, tone: SAM.rose, trail: false,
    cast: (f, r) => { f.flipLoad(WAVE); const c = me(f, r); star(f, { x: c.x + side(r) * 24, y: c.y + 8, z: c.z + 62 }, 13, 150); },
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
  // (David's bar: the main launcher, one shape — a swallow's tail, Λ; David 18 Oct 22:56: "not impressive enough") the
  // swallow of light flies the Λ through the foe — up with the rising cut, over, and back down through him with the second —
  // the blade's light a painted trail behind it in the room's depth (swallowCut); where it cuts: sparks (the room's main hits)
  swallow_cut: { own: true, tone: SAM.rose, paint: true,
    cast: (f, r) => { const c = me(f, r); star(f, { x: c.x + side(r) * 22, y: c.y + 8, z: c.z + 58 }, 12, 140); f.later(Math.max(0, T(r).startup - 70), () => swallowCut(f, r)); },
    hit: (f, _s, _h, at, main, react) => {
      if (react === 'launch') swallowFoe = { x: at.x, y: at.y, z: at.z };
      sparks(f, at, swallowDir, main ? 6 : 4, 56); } },
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
  // the bind (David 18 Oct 18:29): the ring, its trap, the cocoon of petals round the caught foe are SamuraiFx's (bind,
  // bloom, bindCatch on blade3d's zoneRing / petalStream / cocoon); here the blade driven into the planks, and the catch's
  // gust (the room plays the main hit, painted in his pink)
  sakura_bind: { own: true, tone: C.sakura, paint: true,
    // his blade driven into the planks: they crack round its point and a line of blossom light runs through them to the ring
    active: (f, r) => { const c = me(f, r), p0 = { x: c.x + side(r) * 36, y: c.y }, pl = r.place ?? c;
      f.crack(p0.x, p0.y, C.sakura, { r: 46, ms: 1000, chunks: 4, up: 0.6 });
      if (Math.hypot(pl.x - p0.x, pl.y - p0.y) > 40) f.streak({ x: p0.x, y: p0.y, z: 3 }, { x: pl.x, y: pl.y, z: 3 }, C.sakura, { w: 10, ms: 460, draw: 110 }); },
    hit: (f, _s, _h, at, main) => { if (main) f.host.blow(f.host.w3(at.x), 0.4, f.host.d3(at.y), 4, 5); } }, // (its column of light and dome washed the cocoon out)
  // the golden dragon bursts out of the floor and climbs: a tall twisting column of gold, the planks torn under the slam
  dragon_ascension: { own: true, tone: C.gold,
    active: (f, r) => { const c = me(f, r);
      // (one thin column under the dragon — the painted dragon is the show; two wide ones lit both fighters out)
      f.pillar(c.x, c.y, C.gold, { h: 720, r: 16, ms: 720, twist: true, core: false, i: 0.5 });
      f.host.ring(f.host.w3(c.x), f.host.d3(c.y), C.gold, 3.2, 420, 0.6); }, // (no impact light on him: it washed both fighters gold at the burst — DFO)
    hit: (f, _s, _h, at, main) => { if (main) f.crack(at.x, at.y, C.gold, { r: 130, chunks: 14 }); } },
};
