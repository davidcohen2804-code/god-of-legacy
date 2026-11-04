// The Book Mage's Fulminant Conductor (Styles.ts, GPT's design — scratchpad styles/mage_styles.md): the effects of his kit,
// drawn in code from small pieces of their own. GPT's rules for his look: "he no longer summons lightning — he becomes the
// circuit": straight, precise electric rails along his thrusts, one very brief contained spark at a contact, the fork's U
// and V traced by its strokes, a fork-shaped crack where it pins the floor — no chain lightning, no storm field, no bolts
// from the sky, no screen-wide flashes. The staff itself is his painted poses: these pieces are only the current running in
// it. Presentation only — gameplay never reads any of it; timing comes from the cast's own clock, so every client draws the
// same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { V3 } from './HitGeometry';
import { styleOfSwitch } from './Styles';

const TOP = 100000;
/** The prong tips' electric blue and a white-hot core. */
const VOLT = 0x6cc8ff, HOT = 0xffffff;

export interface LightningCtx {
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

/** Where the fork's prongs are in each pose he holds (world px ahead of and over his feet, facing right — read off his
 *  painted frames, tools/heroes/motion/book_mage_lightning: the middle of the U). A chain stage: id#stage. */
const TIP: Record<string, [number, number]> = {
  ml_four_beat: [138, 96], 'ml_four_beat#1': [102, 94], 'ml_four_beat#2': [145, 78], 'ml_four_beat#3': [102, 83],
  ml_probe_jab: [171, 95], ml_closing_stroke: [99, 48], ml_riser_prong: [79, 157], ml_arc_clamp: [127, 82], ml_return_spark: [92, 154],
  ml_earth_pin: [34, -3], stance: [-34, 157],
};

/** His pieces, drawn once on canvases: a rail of current (a thrust's), a thin arc (a stroke's), a contained spark, the
 *  fork's U, its V, the fork-shaped crack it leaves in the floor. */
function textures(s: Phaser.Scene): void {
  if (s.textures.exists('ml-rail')) return;
  const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const t = s.textures.createCanvas(key, w, h); if (!t) return; draw(t.getContext()); t.refresh(); };
  mk('ml-rail', 256, 16, (g) => { // a rail of current: hair-thin and perfectly straight, a white core in a blue sheath, brightest at its head
    for (const [hh, a, c] of [[6, 0.35, '108,200,255'], [2.6, 0.8, '170,226,255'], [1, 1, '255,255,255']] as const) {
      const lg = g.createLinearGradient(0, 0, 256, 0); lg.addColorStop(0, `rgba(${c},0)`); lg.addColorStop(0.35, `rgba(${c},${0.55 * a})`); lg.addColorStop(0.95, `rgba(${c},${a})`); lg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = lg; g.fillRect(0, 8 - hh, 256, hh * 2);
    }
  });
  mk('ml-arc', 128, 48, (g) => { // a stroke's trail: a thin crescent, its edge white, its body electric blue thinning inward
    const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(160,220,255,0.85)'); gr.addColorStop(1, 'rgba(90,170,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(1, 44); g.quadraticCurveTo(64, -16, 127, 44); g.quadraticCurveTo(64, 8, 1, 44); g.closePath(); g.fill();
  });
  mk('ml-spark', 64, 64, (g) => { // one contained spark: a white core and four short angular rays (no forks, no branches)
    const c = 32, gr = g.createRadialGradient(c, c, 0, c, c, 11); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(170,226,255,0.8)'); gr.addColorStop(1, 'rgba(108,200,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 4; k++) { const L = k % 2 ? 19 : 28; g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 2 + 0.35);
      const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(140,210,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -1.6); g.lineTo(L * 0.55, -0.6); g.lineTo(L, 0); g.lineTo(L * 0.55, 0.9); g.lineTo(0, 1.6); g.closePath(); g.fill(); g.restore(); }
  });
  mk('ml-u', 96, 96, (g) => { // the fork's U traced in current: two straight prongs joined by one curve, open to the right
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [lw, a] of [[7, 0.3], [3, 0.8], [1.3, 1]] as const) {
      g.strokeStyle = lw > 3 ? `rgba(108,200,255,${a})` : lw > 2 ? `rgba(170,226,255,${a})` : `rgba(255,255,255,${a})`; g.lineWidth = lw;
      g.beginPath(); g.moveTo(90, 18); g.lineTo(44, 18); g.arc(44, 48, 30, -Math.PI / 2, Math.PI / 2, true); g.lineTo(90, 78); g.stroke();
    }
  });
  mk('ml-v', 96, 96, (g) => { // the rising V: two straight strokes meeting at the bottom
    g.lineCap = 'round'; g.lineJoin = 'miter';
    for (const [lw, a] of [[7, 0.3], [3, 0.8], [1.3, 1]] as const) {
      g.strokeStyle = lw > 3 ? `rgba(108,200,255,${a})` : lw > 2 ? `rgba(170,226,255,${a})` : `rgba(255,255,255,${a})`; g.lineWidth = lw;
      g.beginPath(); g.moveTo(12, 8); g.lineTo(48, 88); g.lineTo(84, 8); g.stroke();
    }
  });
  mk('ml-fork', 128, 64, (g) => { // the fork's mark in the floor, seen flat: a stem and two prongs of light, a few short cracks
    g.lineCap = 'round';
    for (const [lw, a] of [[8, 0.28], [3.2, 0.85], [1.3, 1]] as const) {
      g.strokeStyle = lw > 3.5 ? `rgba(108,200,255,${a})` : lw > 2 ? `rgba(170,226,255,${a})` : `rgba(255,255,255,${a})`; g.lineWidth = lw;
      g.beginPath(); g.moveTo(8, 32); g.lineTo(60, 32); g.moveTo(60, 32); g.lineTo(76, 14); g.lineTo(120, 14); g.moveTo(60, 32); g.lineTo(76, 50); g.lineTo(120, 50); g.stroke();
    }
    g.strokeStyle = 'rgba(200,236,255,0.7)'; g.lineWidth = 1;
    for (const [x0, y0, x1, y1] of [[30, 32, 22, 22], [44, 32, 52, 44], [96, 14, 104, 4], [100, 50, 92, 60]] as const) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  });
}

interface Spr {
  name: string; x: number; y: number; depth?: number; w: number; h?: number; delay?: number; life: number; ox?: number; oy?: number;
  angle?: number; flipX?: boolean; flipY?: boolean; tint?: number; add?: boolean; glow?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number; run?: CastRun;
}
interface Live { t: number; step(dt: number, t: number): boolean }

export class LightningFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  constructor(private ctx: LightningCtx) {}

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  /** Runs `fn` when the cast's own clock reaches `ms` — in step with its hits, through every hit-stop; never if it is cut first. */
  private onClock(r: CastRun, ms: number, fn: () => void): void {
    this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (r.elapsed < ms) return true; fn(); return false; } });
  }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** The fork's prongs in the pose this cast holds, where he is now (screen px). */
  private tip(r: CastRun, key = this.poseKey(r)): { x: number; y: number } {
    const [dx, dz] = TIP[key] ?? TIP.stance, c = this.me(r), side = sideOf(r);
    return { x: c.x + side * dx, y: c.y - c.z - dz };
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
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.06, sy * 1.6).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
  }
  /** One contained spark: very brief (~90 ms), never a burst of branches. */
  private spark(x: number, y: number, size: number, o: { delay?: number; life?: number; tint?: number; run?: CastRun } = {}): void {
    this.spr({ name: 'ml-spark', x, y, depth: TOP + 4, w: size, life: o.life ?? 90, delay: o.delay, run: o.run, tint: o.tint ?? HOT, glow: 0.25, add: true, angle: rnd(0, 90),
      sx: kf([0, 0.5], [0.2, 1.05, out3], [1, 0.9]), sy: kf([0, 0.5], [0.2, 1.05, out3], [1, 0.9]), a: kf([0, 1], [0.4, 1], [1, 0, inQ]) });
  }
  /** A rail of current from `from` to `to` (its head at `to`): straight, thin, gone in ~100 ms. */
  private rail(x0: number, y0: number, x1: number, y1: number, h: number, o: { delay?: number; life?: number; run?: CastRun } = {}): void {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return;
    this.spr({ name: 'ml-rail', x: x0, y: y0, ox: 0, depth: TOP + 3, w: L, h, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life: o.life ?? 100, delay: o.delay, run: o.run, tint: HOT, add: true, glow: 0.22,
      sx: kf([0, 0.4], [0.25, 1, out3]), a: kf([0, 0], [0.08, 1], [0.55, 0.9], [1, 0, inQ]) });
  }
  /** A stroke's trail: one thin crescent at a point, turned `angle`. */
  private arc(x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; flip?: boolean; flipY?: boolean; run?: CastRun; h?: number } = {}): void {
    this.spr({ name: 'ml-arc', x, y, depth: TOP + 3, w, h: o.h, angle, flipX: o.flip, flipY: o.flipY, life: o.life ?? 110, delay: o.delay, run: o.run, tint: VOLT, glow: 0.22, add: true,
      sx: kf([0, 0.6], [0.3, 1.03, out3], [1, 1.08]), sy: kf([0, 0.8], [0.3, 1, out3], [1, 0.6]), a: kf([0, 0], [0.08, 1], [0.5, 0.8], [1, 0, inQ]) });
  }
  private shape(name: 'ml-u' | 'ml-v' | 'ml-fork', x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; flip?: boolean; run?: CastRun; h?: number; grow?: boolean } = {}): void {
    this.spr({ name, x, y, depth: TOP + 3, w, h: o.h, angle, flipX: o.flip, life: o.life ?? 130, delay: o.delay, run: o.run, tint: HOT, glow: 0.25, add: true,
      sx: o.grow ? kf([0, 0.3], [0.35, 1, out3]) : kf([0, 0.85], [0.3, 1, out3]), sy: kf([0, 0.85], [0.3, 1, out3]), a: kf([0, 0], [0.06, 1], [0.55, 0.9], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ casts

  cast(r: CastRun): void {
    textures(this.ctx.scene);
    const s = r.skill, T = r.timings, side = sideOf(r), key = this.poseKey(r), deg0 = side < 0 ? 180 : 0;
    if (styleOfSwitch(s.id)) { // the switch (GPT): a tiny forked spark collapsing into his wrist, a compact flash at his hand and
      // chest as the staff draws out, then two tiny sparks on the prong tips that vanish
      this.onClock(r, 0, () => { const h = this.at(r, 24, 70); this.spark(h.x, h.y, 26, { run: r, tint: VOLT, life: Math.max(70, T.startup * 0.4) }); });
      this.onClock(r, T.startup * 0.45, () => { const h = this.at(r, 14, 74); this.spark(h.x, h.y, 40, { run: r, life: 100 }); this.rail(h.x, h.y + 40, h.x, h.y - 60, 6, { run: r, life: 110 }); });
      this.onClock(r, T.startup, () => { const t = this.tip(r, 'stance'); this.spark(t.x - 5, t.y, 14, { run: r, tint: VOLT, life: 120 }); this.spark(t.x + 5, t.y, 14, { run: r, tint: VOLT, life: 120, delay: 30 }); });
      return;
    }
    const hitAt = (i: number) => T.startup + (r.hits[i]?.at ?? 0);
    const thrust = (len: number, h: number, at: number, size = 26) => { // a rail along the staff to the prongs, the spark at them
      this.onClock(r, Math.max(0, at - 25), () => { const t = this.tip(r); this.rail(t.x - side * len, t.y, t.x + side * 14, t.y, h, { run: r }); });
      this.onClock(r, at, () => { const t = this.tip(r); this.spark(t.x + side * 6, t.y, size, { run: r }); });
    };
    switch (key) {
      case 'ml_four_beat': thrust(60, 8, hitAt(0), 22); break; // Prong Tap: a short rail, a small spark
      case 'ml_four_beat#1': // Cross Contact: the fork swung back across — one thin arc ahead of his chest, the spark at the prongs
        this.onClock(r, T.startup * 0.7, () => { const h = this.at(r, 70, 96); this.arc(h.x, h.y, 110, deg0, { flip: side < 0, flipY: true, h: 26, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.spark(t.x, t.y, 24, { run: r }); });
        break;
      case 'ml_four_beat#2': thrust(120, 9, hitAt(0), 28); break; // Rail Jab: the straight thrust — a longer rail
      case 'ml_four_beat#3': // Break Stroke: both prongs through him in one flat stroke — a wide flat arc, two sparks
        this.onClock(r, T.startup * 0.65, () => { const h = this.at(r, 92, 84); this.arc(h.x, h.y, 170, deg0, { flip: side < 0, h: 34, life: 120, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.spark(t.x + side * 30, t.y - 6, 30, { run: r }); this.spark(t.x + side * 52, t.y + 6, 22, { run: r, delay: 25 }); this.ctx.punch(0.012, 90); });
        break;
      case 'ml_probe_jab': // the needle: two hair-thin parallel rails running out ahead of the prong tips, one small spark
        this.onClock(r, Math.max(0, hitAt(0) - 25), () => { const t = this.tip(r);
          this.rail(t.x - side * 150, t.y - 4, t.x + side * 24, t.y - 4, 5, { run: r, life: 110 }); this.rail(t.x - side * 150, t.y + 4, t.x + side * 24, t.y + 4, 5, { run: r, life: 110 }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.spark(t.x + side * 10, t.y, 22, { run: r }); });
        break;
      case 'ml_closing_stroke': // the U of the fork scooped sideways through him: the U traced in current, the circuit's spark
        this.onClock(r, T.startup * 0.6, () => { const t = this.tip(r); this.shape('ml-u', t.x + side * 8, t.y, 58, 0, { flip: side < 0, run: r, life: 140 }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.arc(t.x + side * 20, t.y + 6, 120, deg0, { flip: side < 0, flipY: true, h: 26, run: r }); this.spark(t.x + side * 26, t.y, 30, { run: r }); });
        break;
      case 'ml_riser_prong': // the twin prongs driven straight up: a rising arc ahead of him, a rail up with the foe
        this.onClock(r, T.startup * 0.55, () => { const h = this.at(r, 96, 70); this.arc(h.x, h.y, 150, side < 0 ? 250 : -70, { flip: side < 0, h: 34, life: 130, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.spark(t.x, t.y, 32, { run: r }); this.rail(t.x, t.y + 90, t.x, t.y - 110, 7, { run: r, life: 140 }); });
        break;
      case 'ml_arc_clamp': { // his signature: the prongs close round one foe like a clamp — two thin arcs converge on him, one
        // brief spark where they meet, a rail through the staff
        this.onClock(r, Math.max(0, hitAt(0) - 60), () => { const t = this.tip(r), x = t.x + side * 60;
          this.arc(x, t.y - 26, 90, deg0, { flip: side < 0, h: 22, run: r, life: 110 }); this.arc(x, t.y + 26, 90, deg0, { flip: side < 0, flipY: true, h: 22, run: r, life: 110 }); });
        this.onClock(r, Math.max(0, hitAt(0) - 25), () => { const t = this.tip(r); this.rail(t.x - side * 150, t.y, t.x + side * 70, t.y, 10, { run: r, life: 120 }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r), x = t.x + side * 66;
          this.shape('ml-u', x - side * 8, t.y, 64, 0, { flip: side >= 0, run: r, life: 150 }); this.spark(x, t.y, 44, { run: r, life: 110 });
          this.ctx.punch(0.02, 130); this.shake(r, 100, 0.0024); });
        break;
      }
      case 'ml_return_spark': // the rising V counter-cut: the V traced up ahead of him, the spark at its top
        this.onClock(r, T.startup * 0.55, () => { const h = this.at(r, 88, 96); this.shape('ml-v', h.x, h.y, 70, side * 18, { flip: side < 0, run: r, life: 130, grow: true }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.spark(t.x, t.y, 32, { run: r }); });
        break;
      case 'ml_earth_pin': { // the fork driven down to pin the floor: a rail falling, the fork's mark in the floor, one flat spark
        this.onClock(r, T.startup * 0.55, () => { const h = this.at(r, 80, 210); this.rail(h.x, h.y, h.x - side * 30, h.y + 200, 7, { run: r, life: 110 }); });
        this.onClock(r, hitAt(0), () => { const c = this.me(r), x = c.x + side * 92, y = c.y - 2;
          this.shape('ml-fork', x + side * 8, y, 120, 0, { flip: side < 0, h: 34, run: r, life: 200, grow: true }); this.spark(x - side * 30, y - 8, 40, { run: r, life: 110 });
          this.ctx.punch(0.024, 140); this.shake(r, 120, 0.003); });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ on the foe

  /** A blow landed: one very brief contained spark at the contact; a heavy blow a short rail through it; a launch a rail up
   *  with him. */
  confirmed(_s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, big = heavy || !!hit.heavy;
    this.spark(x + rnd(-3, 3), y + rnd(-3, 3), big ? 46 : 32, { life: big ? 110 : 85 });
    if (big) { const a = rnd(-0.5, 0.5); this.rail(x - Math.cos(a) * 40, y - Math.sin(a) * 40, x + Math.cos(a) * 40, y + Math.sin(a) * 40, 6, { life: 100 }); }
    if (crit) this.spark(x, y, 70, { life: 130, tint: VOLT });
    if ((hit.reaction.launch ?? 0) >= 90) this.rail(x, at.y - at.z, x, at.y - at.z - 150, 6, { life: 160 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
  }

  destroy(): void { this.live = []; this.incoming = []; }
}
