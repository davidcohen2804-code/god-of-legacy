// The Book Mage's Sailwright (Styles.ts, GPT's design — scratchpad styles/mage_styles.md): the effects of his kit, drawn in
// code from small pieces of their own. GPT's rules for his look: "wind is controlled force, not weather" — thin sharp
// pressure edges, kite triangles, short pressure lines and the fan's seven ribs; pale mint only on the edges and the
// contacts; no tornado, no storm cloud, no lasting wind zone, no screen-wide particles. The fan itself is his painted poses:
// these pieces are only the air it cuts. Presentation only — gameplay never reads any of it; timing comes from the cast's
// own clock, so every client draws the same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { V3 } from './HitGeometry';
import { styleOfSwitch } from './Styles';

const TOP = 100000;
/** The fan's pale mint (its rim and the air it cuts), a white core, the ivory of its ribs, the book's own blue (the way back). */
const MINT = 0xa8f0d8, HOT = 0xffffff, IVORY = 0xf3ead2, BOOK = 0x9fb4ff;

export interface WindCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  punch(amount?: number, ms?: number): void;
}

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
type Key = [number, number, Ease?];
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);

/** Where the fan's striking end is in each pose he holds (world px ahead of and over his feet, facing right — read off his
 *  painted frames, tools/heroes/motion/book_mage_wind: the folded tip, or the open fan's rim). A chain stage: id#stage. */
const TIP: Record<string, [number, number]> = {
  mw_four_beat: [146, 92], 'mw_four_beat#1': [76, 105], 'mw_four_beat#2': [115, 99], 'mw_four_beat#3': [55, 137],
  mw_sail_edge: [149, 92], mw_updraft_hook: [80, 118], mw_cut_across: [81, 43], mw_windward_spike: [85, 175], mw_keel_drop: [84, 51],
  stance: [25, 138],
};

/** His pieces, drawn once on canvases: a pressure edge (a thin crescent of cut air), a pressure line, a kite triangle, a
 *  sharp burst of short lines, the fan's seven ribs, a chevron. */
function textures(s: Phaser.Scene): void {
  if (s.textures.exists('mw-edge')) return;
  const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const t = s.textures.createCanvas(key, w, h); if (!t) return; draw(t.getContext()); t.refresh(); };
  mk('mw-edge', 128, 48, (g) => { // cut air: a thin crescent, its leading edge white, a faint mint body thinning to nothing at both tips
    const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(214,255,240,0.85)'); gr.addColorStop(1, 'rgba(150,235,205,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(1, 44); g.quadraticCurveTo(64, -18, 127, 44); g.quadraticCurveTo(64, 6, 1, 44); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6, 41); g.quadraticCurveTo(64, -14, 122, 41); g.stroke(); // (its hair-thin edge)
  });
  mk('mw-line', 128, 8, (g) => { // a short pressure line: hair-thin, tapered at both ends, bright in the middle-front
    const lg = g.createLinearGradient(0, 0, 128, 0); lg.addColorStop(0, 'rgba(180,240,220,0)'); lg.addColorStop(0.55, 'rgba(220,255,244,0.75)'); lg.addColorStop(0.85, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, 4); g.lineTo(108, 1.4); g.quadraticCurveTo(128, 4, 108, 6.6); g.closePath(); g.fill();
  });
  mk('mw-kite', 48, 24, (g) => { // a kite triangle of air: a long tail, a sharp head at the right end, a white core
    const kite = () => { g.beginPath(); g.moveTo(47, 12); g.lineTo(30, 2); g.lineTo(1, 12); g.lineTo(30, 22); g.closePath(); };
    const lg = g.createLinearGradient(0, 0, 48, 0); lg.addColorStop(0, 'rgba(160,235,210,0)'); lg.addColorStop(0.6, 'rgba(210,255,240,0.8)'); lg.addColorStop(1, 'rgba(255,255,255,1)');
    kite(); g.fillStyle = lg; g.fill(); kite(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1; g.stroke();
  });
  mk('mw-burst', 64, 64, (g) => { // a sharp burst: a small white core and eight short thin lines of pressure flung out
    const c = 32, gr = g.createRadialGradient(c, c, 0, c, c, 9); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 8; k++) { const L = k % 2 ? 18 : 29, r0 = k % 2 ? 9 : 6; g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 4 + 0.2);
      const lg = g.createLinearGradient(r0, 0, L, 0); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(200,255,235,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(r0, -1.2); g.lineTo(L, 0); g.lineTo(r0, 1.2); g.closePath(); g.fill(); g.restore(); }
  });
  mk('mw-ribs', 128, 128, (g) => { // the fan's seven ribs, opened from its hinge at the bottom middle: thin ivory lines, a mint rim
    const hx = 64, hy = 120;
    g.strokeStyle = 'rgba(255,250,236,0.95)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.26; g.beginPath(); g.moveTo(hx + Math.cos(a) * 10, hy + Math.sin(a) * 10); g.lineTo(hx + Math.cos(a) * 108, hy + Math.sin(a) * 108); g.stroke(); }
    g.strokeStyle = 'rgba(190,255,230,0.9)'; g.lineWidth = 2.2; g.beginPath(); g.arc(hx, hy, 108, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8); g.stroke();
  });
  mk('mw-chev', 32, 32, (g) => { // a thin chevron (the switch folds one in)
    g.strokeStyle = 'rgba(220,255,244,1)'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(6, 6); g.lineTo(24, 16); g.lineTo(6, 26); g.stroke();
  });
}

interface Spr {
  name: string; x: number; y: number; depth?: number; w: number; h?: number; delay?: number; life: number; ox?: number; oy?: number;
  angle?: number; flipX?: boolean; flipY?: boolean; tint?: number; add?: boolean; glow?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number; run?: CastRun;
}
interface Live { t: number; step(dt: number, t: number): boolean }

export class WindFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  constructor(private ctx: WindCtx) {}

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  /** Runs `fn` when the cast's own clock reaches `ms` — in step with its hits, through every hit-stop; never if it is cut first. */
  private onClock(r: CastRun, ms: number, fn: () => void): void {
    this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (r.elapsed < ms) return true; fn(); return false; } });
  }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** The fan's striking end in the pose this cast holds, where he is now (screen px). */
  private tip(r: CastRun, key = this.poseKey(r)): { x: number; y: number; d: number } {
    const [dx, dz] = TIP[key] ?? TIP.stance, c = this.me(r), side = sideOf(r);
    return { x: c.x + side * dx, y: c.y - c.z - dz, d: c.y };
  }
  /** A point ahead of and over his feet now (screen px), facing his way. */
  private at(r: CastRun, dx: number, dz: number): { x: number; y: number } { const c = this.me(r); return { x: c.x + sideOf(r) * dx, y: c.y - c.z - dz }; }
  private poseKey(r: CastRun): string { return r.skill.chain && r.stage > 0 ? `${r.skill.id}#${r.stage}` : r.skill.id; }
  private shake(r: CastRun | null, ms: number, k: number): void { if (!r || r.own) this.ctx.cam().shake(ms, k); }

  private spr(o: Spr): void {
    const s = this.ctx.scene; textures(s);
    if (!s.textures.exists(o.name)) return;
    const fr = s.textures.getFrame(o.name), bx = o.w / fr.width, by = (o.h ?? (o.w * fr.height) / fr.width) / fr.height;
    const mk = (glow: boolean) => { const im = s.add.image(o.x, o.y, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlipX(!!o.flipX).setFlipY(!!o.flipY).setVisible(false)
      .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL); if (o.tint !== undefined) im.setTint(o.tint); return im; };
    const glowA = o.glow !== undefined ? Math.min(o.glow, 0.3) : 0, im = mk(false), gl = glowA ? mk(true) : null;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0); if (e < 0) return true;
      if (o.run && o.run.phase === 'done' && !o.run.fired.size) { im.destroy(); gl?.destroy(); return false; }
      const u = Math.min(1, e / o.life), x = o.x + (o.mx?.(u) ?? 0), y = o.y + (o.my?.(u) ?? 0);
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0), d = o.depth ?? TOP + 3;
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.06, sy * 1.5).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
  }
  /** A contact: a sharp burst of short pressure lines, gone in ~110 ms. */
  private burst(x: number, y: number, size: number, o: { delay?: number; life?: number; tint?: number; run?: CastRun; flat?: boolean } = {}): void {
    this.spr({ name: 'mw-burst', x, y, depth: TOP + 4, w: size, h: o.flat ? size * 0.42 : size, life: o.life ?? 110, delay: o.delay, run: o.run, tint: o.tint ?? HOT, glow: 0.25, add: true, angle: o.flat ? 0 : rnd(0, 45),
      sx: kf([0, 0.4], [0.25, 1, out3], [1, 1.15]), sy: kf([0, 0.4], [0.25, 1, out3], [1, 1.15]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
  }
  /** Cut air: one thin pressure edge at a point, turned `angle`, opening as it goes. */
  private edge(x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; flip?: boolean; flipY?: boolean; run?: CastRun; h?: number; mx?: (u: number) => number; my?: (u: number) => number } = {}): void {
    this.spr({ name: 'mw-edge', x, y, depth: TOP + 3, w, h: o.h, angle, flipX: o.flip, flipY: o.flipY, life: o.life ?? 120, delay: o.delay, run: o.run, tint: MINT, glow: 0.22, add: true, mx: o.mx, my: o.my,
      sx: kf([0, 0.62], [0.3, 1.03, out3], [1, 1.08]), sy: kf([0, 0.8], [0.3, 1, out3], [1, 0.6]), a: kf([0, 0], [0.08, 1], [0.5, 0.8], [1, 0, inQ]) });
  }
  /** A short pressure line from `from` to `to` (its bright head at `to`), gone in ~100 ms. */
  private line(x0: number, y0: number, x1: number, y1: number, h: number, o: { delay?: number; life?: number; run?: CastRun } = {}): void {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return;
    this.spr({ name: 'mw-line', x: x0, y: y0, ox: 0, depth: TOP + 3, w: L, h, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life: o.life ?? 100, delay: o.delay, run: o.run, tint: MINT, add: true, glow: 0.2,
      sx: kf([0, 0.5], [0.3, 1, out3]), a: kf([0, 0], [0.1, 1], [0.5, 0.85], [1, 0, inQ]) });
  }
  /** A kite triangle of air flung from a point along `deg`, `dist` px, shrinking as it goes. */
  private kite(x: number, y: number, size: number, deg: number, dist: number, o: { delay?: number; life?: number; run?: CastRun } = {}): void {
    const a = (deg * Math.PI) / 180;
    this.spr({ name: 'mw-kite', x, y, depth: TOP + 4, w: size, angle: deg, life: o.life ?? 130, delay: o.delay, run: o.run, tint: MINT, add: true, glow: 0.22,
      mx: (u) => Math.cos(a) * dist * out3(u), my: (u) => Math.sin(a) * dist * out3(u), sx: kf([0, 0.6], [0.3, 1.05, out3], [1, 0.7]), a: kf([0, 0.95], [0.6, 0.85], [1, 0, inQ]) });
  }
  /** Short pressure lines flung from a point (a fan of `n`, `spread`° round `deg`). */
  private lines(x: number, y: number, n: number, deg: number, spread: number, len: number, o: { delay?: number; run?: CastRun } = {}): void {
    for (let k = 0; k < n; k++) {
      const a = ((deg + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0) + rnd(-6, 6)) * Math.PI) / 180, d0 = rnd(6, 14), d1 = d0 + len * rnd(0.75, 1.1);
      this.line(x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a) * d1, y + Math.sin(a) * d1, 4, { delay: o.delay, run: o.run, life: rnd(90, 130) });
    }
  }
  /** The fan's seven ribs flashed open at a point (palm-sized: the switch), turned `angle`. */
  private ribs(x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; run?: CastRun; close?: boolean; tint?: number } = {}): void {
    this.spr({ name: 'mw-ribs', x, y, oy: 0.94, depth: TOP + 4, w, angle, life: o.life ?? 140, delay: o.delay, run: o.run, tint: o.tint ?? IVORY, add: true, glow: 0.2,
      sx: o.close ? kf([0, 1], [1, 0.15, inQ]) : kf([0, 0.2], [0.4, 1, out3]), sy: kf([0, 0.85], [0.4, 1, out3]), a: kf([0, 0.9], [0.5, 0.9], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ casts

  cast(r: CastRun): void {
    textures(this.ctx.scene);
    const s = r.skill, T = r.timings, side = sideOf(r), key = this.poseKey(r), deg0 = side < 0 ? 180 : 0;
    const sw = styleOfSwitch(s.id);
    if (sw) { // the switch (GPT): one thin chevron folds in at the hand, a palm-sized flash of the fan's ribs, the tip's one small curve
      if (sw.style !== 'wind') { // (back to the book — from the fan or the fork: one small flash of the book's blue at his hands)
        this.onClock(r, T.startup * 0.4, () => { const h = this.at(r, 22, 72); this.burst(h.x, h.y, 30, { run: r, tint: BOOK, life: 110 }); });
        return;
      }
      this.onClock(r, 0, () => { const h = this.at(r, 22, 74); this.spr({ name: 'mw-chev', x: h.x, y: h.y, depth: TOP + 4, w: 22, angle: deg0, life: Math.max(80, T.startup * 0.4), run: r, tint: MINT, add: true,
        mx: (u) => -side * 10 * out3(u), sx: kf([0, 1.2], [1, 0.3, inQ]), sy: kf([0, 1.2], [1, 0.3, inQ]), a: kf([0, 0.95], [1, 0, inQ]) }); });
      this.onClock(r, T.startup * 0.4, () => { const h = this.at(r, 26, 70); this.ribs(h.x, h.y + 18, 46, side * 8, { run: r, life: 120, tint: IVORY }); this.burst(h.x, h.y, 22, { run: r, tint: MINT, life: 90 }); });
      this.onClock(r, T.startup, () => { const t = this.tip(r, 'stance'); this.edge(t.x + side * 8, t.y + 6, 34, side < 0 ? 200 : -20, { flip: side < 0, run: r, life: 140, h: 14 }); });
      return;
    }
    const hitAt = (i: number) => T.startup + (r.hits[i]?.at ?? 0);
    switch (key) {
      case 'mw_four_beat': // Fan Prick: the folded tip pricked in — a pressure line along it, a tiny burst at the point
        this.onClock(r, Math.max(0, hitAt(0) - 30), () => { const t = this.tip(r); this.line(t.x - side * 90, t.y, t.x + side * 16, t.y, 6, { run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.burst(t.x + side * 6, t.y, 30, { run: r }); this.kite(t.x, t.y, 20, deg0, 22, { run: r, life: 100 }); });
        break;
      case 'mw_four_beat#1': // Wane Backhand: the reverse edge — a thin crescent of cut air swept back across his front
        this.onClock(r, T.startup * 0.7, () => { const h = this.at(r, 60, 100); this.edge(h.x, h.y, 120, deg0, { flip: side < 0, flipY: true, h: 30, life: 120, run: r }); });
        this.onClock(r, hitAt(0), () => { const h = this.at(r, 108, 100); this.lines(h.x, h.y, 2, deg0, 26, 22, { run: r }); });
        break;
      case 'mw_four_beat#2': // Rib Rake: the fan flared open and swept up — one edge rising off its rim, short lines after it
        this.onClock(r, T.startup * 0.6, () => { const t = this.tip(r); this.edge(t.x - side * 6, t.y + 6, 130, side < 0 ? 240 : -60, { flip: side < 0, h: 34, life: 130, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.lines(t.x + side * 8, t.y - 6, 3, side < 0 ? 215 : -35, 40, 24, { run: r }); });
        break;
      case 'mw_four_beat#3': // Keel Flick: snapped shut on the way up — one rising crescent ahead of him, the tip's burst over it
        this.onClock(r, T.startup * 0.65, () => { const h = this.at(r, 100, 80); this.edge(h.x, h.y, 140, side < 0 ? 245 : -65, { flip: side < 0, h: 38, life: 140, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.burst(t.x, t.y, 32, { run: r }); this.kite(t.x, t.y, 18, -90, 26, { run: r }); });
        break;
      case 'mw_sail_edge': // the fan flicked open: its rim lit, then one thin pressure blade leaves it and flies on
        this.onClock(r, T.startup * 0.7, () => { const t = this.tip(r); this.edge(t.x - side * 4, t.y, 60, side < 0 ? 90 : -90, { flip: side < 0, h: 16, life: 110, run: r }); });
        this.onClock(r, Math.max(0, hitAt(0) - 25), () => { const t = this.tip(r);
          this.edge(t.x + side * 6, t.y, 92, side < 0 ? 90 : -90, { flip: side < 0, h: 22, life: 150, run: r, mx: (u) => side * 38 * out3(u) });
          this.line(t.x - side * 20, t.y - 22, t.x + side * 40, t.y - 22, 4, { run: r, life: 120 }); this.line(t.x - side * 20, t.y + 22, t.x + side * 40, t.y + 22, 4, { run: r, life: 120 }); });
        break;
      case 'mw_updraft_hook': // the folded fan hooked up from below him: one rising crescent of air, a line up with the foe
        this.onClock(r, T.startup * 0.55, () => { const h = this.at(r, 92, 70); this.edge(h.x, h.y, 170, side < 0 ? 250 : -70, { flip: side < 0, h: 44, life: 150, run: r }); });
        this.onClock(r, hitAt(0), () => { const h = this.at(r, 100, 112); this.burst(h.x, h.y, 34, { run: r }); this.line(h.x, h.y + 50, h.x, h.y - 110, 6, { run: r, life: 150 }); });
        break;
      case 'mw_cut_across': { // his signature: one huge diagonal sail cut — an S of pale air across the lane, the foe popped and carried
        this.onClock(r, T.startup * 0.72, () => { const h = this.at(r, 96, 120); this.edge(h.x, h.y, 170, side < 0 ? 160 : 20, { flip: side < 0, h: 46, life: 160, run: r }); });
        this.onClock(r, hitAt(0), () => { const h = this.at(r, 150, 58);
          this.edge(h.x, h.y, 190, side < 0 ? 160 : 20, { flip: side >= 0, flipY: true, h: 50, life: 170, run: r }); // (the S's lower bend: the same cut turned back on itself)
          this.burst(h.x + side * 24, h.y + 4, 46, { run: r }); this.lines(h.x + side * 30, h.y, 4, deg0, 40, 34, { run: r });
          this.ctx.punch(0.02, 140); this.shake(r, 110, 0.0026); });
        break;
      }
      case 'mw_windward_spike': // the reverse-grip spike straight up: a pressure line up the fan, a burst at its tip, a kite flung up
        this.onClock(r, Math.max(0, hitAt(0) - 30), () => { const t = this.tip(r); this.line(t.x, t.y + 120, t.x, t.y - 14, 6, { run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.burst(t.x, t.y, 34, { run: r }); this.kite(t.x, t.y, 20, -90, 30, { run: r }); });
        break;
      case 'mw_keel_drop': { // the folded fan brought down like a keel: a line falling to the floor, a sharp flat burst where it strikes
        this.onClock(r, T.startup * 0.55, () => { const h = this.at(r, 100, 210); this.line(h.x, h.y, h.x - side * 10, h.y + 170, 6, { run: r, life: 120 }); });
        this.onClock(r, hitAt(0), () => { const c = this.me(r), x = c.x + side * 100, y = c.y - 4;
          this.burst(x, y, 96, { run: r, flat: true, life: 130 }); this.burst(x, y - 14, 30, { run: r });
          this.lines(x, y - 6, 3, -90, 70, 34, { run: r });
          this.ctx.punch(0.024, 140); this.shake(r, 120, 0.003); });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ on the foe

  /** A blow landed: one sharp contact of cut air; a heavy blow a kite triangle off it; a launch a short line up with him. */
  confirmed(_s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, big = heavy || !!hit.heavy;
    this.burst(x + rnd(-4, 4), y + rnd(-4, 4), big ? 50 : 34, { life: big ? 140 : 105 });
    this.lines(x, y, big ? 3 : 2, rnd(0, 360), 150, big ? 26 : 18);
    if (big) this.kite(x, y, 22, rnd(-40, 40) + (Math.random() < 0.5 ? 0 : 180), 26);
    if (crit) this.burst(x, y, 76, { life: 160, tint: MINT });
    if ((hit.reaction.launch ?? 0) >= 90) this.line(x, at.y - at.z, x, at.y - at.z - 150, 6, { life: 170 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
  }

  destroy(): void { this.live = []; this.incoming = []; }
}
