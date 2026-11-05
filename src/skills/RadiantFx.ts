// The Gambler's Radiant Duelist (Styles.ts, GPT's design — scratchpad styles/gambler_styles.md): the effects of his kit,
// drawn in code from small pieces of their own. GPT's rules for its look: the Crown Staff is a solid violet-white light
// that behaves like a weapon with mass — one dominant trail per strike, gone in 80–120 ms, brightest at the contact; an
// impact may flash a faceted spade opening; never a giant casino object, no cards, no other mage's purple haze. The staff
// itself is his painted poses: these pieces are only its light in motion. Presentation only — gameplay never reads any of
// it; timing comes from the cast's own clock, so every client draws the same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V3 } from './HitGeometry';
import { styleOfSwitch } from './Styles';

const TOP = 100000;
/** The staff's violet-white light, its white-hot core, the gold of the crown and the grip's settings. */
const LIGHT = 0xd9c8ff, HOT = 0xffffff, GOLD = 0xffd27a;

export interface RadiantCtx {
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

/** Where the staff's striking end is in each pose he holds (world px ahead of and over his feet, facing right — read off the
 *  violet-white light of his painted frames, tools/heroes/motion/gambler_radiant). A chain stage: id#stage. */
const TIP: Record<string, [number, number]> = {
  rd_four_beat: [64, 65], 'rd_four_beat#1': [127, 63], 'rd_four_beat#2': [67, 51], 'rd_four_beat#3': [57, 127],
  rd_opening_bid: [127, 63], rd_crown_raise: [76, 112], rd_royal_turn: [63, 48], rd_collect_debt: [67, -7], rd_all_in: [114, 63],
  rd_curtain_call: [79, 5], stance: [74, 100],
  rd_under_the_table: [67, -7], rd_read_the_room: [74, 101], 'rd_read_the_room:strike': [64, 65], rd_long_odds: [114, 63], rd_high_stakes: [60, 30], rd_side_bet: [64, 65],
};

/** His pieces, drawn once on canvases: a lance of light (a thrust's trail), a crescent (a swing's), a faceted spade, a
 *  four-ray spark, a soft mote. */
function textures(s: Phaser.Scene): void {
  if (s.textures.exists('rd-lance')) return;
  const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const t = s.textures.createCanvas(key, w, h); if (!t) return; draw(t.getContext()); t.refresh(); };
  mk('rd-lance', 256, 24, (g) => { // a thrust's trail: thin, its head white-hot at the right end, thinning back to nothing
    for (const [hh, a] of [[10, 0.22], [5, 0.6], [2, 1]] as const) {
      const lg = g.createLinearGradient(0, 0, 256, 0); lg.addColorStop(0, 'rgba(200,180,255,0)'); lg.addColorStop(0.6, `rgba(220,206,255,${0.5 * a})`); lg.addColorStop(0.97, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 12); g.lineTo(240, 12 - hh); g.quadraticCurveTo(256, 12, 240, 12 + hh); g.closePath(); g.fill();
    }
  });
  mk('rd-arc', 128, 64, (g) => { // a swing's trail: a thin crescent, its leading edge white-hot, fading inward
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(226,212,255,0.85)'); gr.addColorStop(1, 'rgba(180,150,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(2, 60); g.quadraticCurveTo(64, -30, 126, 60); g.quadraticCurveTo(64, 2, 2, 60); g.closePath(); g.fill();
  });
  mk('rd-spade', 64, 72, (g) => { // a faceted spade: the crown's jewel opening at the contact (cut facets, a white core)
    const sp = () => { g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(44, 18, 62, 30, 58, 44); g.bezierCurveTo(55, 56, 40, 56, 34, 48); g.lineTo(40, 68); g.lineTo(24, 68); g.lineTo(30, 48);
      g.bezierCurveTo(24, 56, 9, 56, 6, 44); g.bezierCurveTo(2, 30, 20, 18, 32, 2); g.closePath(); };
    const gr = g.createRadialGradient(32, 34, 2, 32, 34, 34); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(230,216,255,0.9)'); gr.addColorStop(1, 'rgba(170,130,255,0.55)');
    sp(); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; // (its facets)
    for (const [x0, y0, x1, y1] of [[32, 4, 32, 48], [32, 26, 8, 42], [32, 26, 56, 42], [32, 48, 14, 50], [32, 48, 50, 50]] as const) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    sp(); g.strokeStyle = 'rgba(255,214,130,0.9)'; g.lineWidth = 1.6; g.stroke(); // (a thin gold rim: the crown's setting)
  });
  mk('rd-flash', 64, 64, (g) => { // the contact: a white core and four short rays
    const c = 32, gr = g.createRadialGradient(c, c, 0, c, c, 14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 4; k++) { const L = k % 2 ? 20 : 30; g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 2 + Math.PI / 4);
      const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -2); g.lineTo(L, 0); g.lineTo(0, 2); g.closePath(); g.fill(); g.restore(); }
  });
  mk('rd-mote', 32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(226,212,255,0.6)'); gr.addColorStop(1, 'rgba(190,160,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  mk('rd-ring', 128, 128, (g) => { g.strokeStyle = 'rgba(236,226,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(200,170,255,0.4)'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke(); });
}

interface Spr {
  name: string; x: number; y: number; depth?: number; w: number; h?: number; delay?: number; life: number; ox?: number; oy?: number;
  angle?: number; flipX?: boolean; flipY?: boolean; tint?: number; add?: boolean; glow?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number; run?: CastRun;
}
interface Live { t: number; step(dt: number, t: number): boolean }

export class RadiantFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  constructor(private ctx: RadiantCtx) {}

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  /** Runs `fn` when the cast's own clock reaches `ms` — in step with its hits, through every hit-stop; never if it is cut first. */
  private onClock(r: CastRun, ms: number, fn: () => void): void {
    this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (r.elapsed < ms) return true; fn(); return false; } });
  }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** The staff's striking end in the pose this cast holds, where he is now (screen px). */
  private tip(r: CastRun, key = this.poseKey(r)): { x: number; y: number; d: number } {
    const [dx, dz] = TIP[key] ?? TIP.stance, c = this.me(r), side = sideOf(r);
    return { x: c.x + side * dx, y: c.y - c.z - dz, d: c.y };
  }
  private poseKey(r: CastRun): string { return r.skill.chain && r.stage > 0 ? `${r.skill.id}#${r.stage}` : r.skill.id; }
  private shake(r: CastRun | null, ms: number, k: number): void { if (!r || r.own) this.ctx.cam().shake(ms, k); }

  private spr(o: Spr): void {
    const s = this.ctx.scene; textures(s);
    if (!s.textures.exists(o.name)) return;
    const fr = s.textures.getFrame(o.name), bx = o.w / fr.width, by = (o.h ?? (o.w * fr.height) / fr.width) / fr.height;
    const mk = (glow: boolean) => { const im = s.add.image(o.x, o.y, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlipX(!!o.flipX).setFlipY(!!o.flipY).setVisible(false)
      .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL); if (o.tint !== undefined) im.setTint(o.tint); return im; };
    const glowA = o.glow !== undefined ? Math.min(o.glow, 0.35) : 0, im = mk(false), gl = glowA ? mk(true) : null;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0); if (e < 0) return true;
      if (o.run && o.run.phase === 'done' && !o.run.fired.size) { im.destroy(); gl?.destroy(); return false; }
      const u = Math.min(1, e / o.life), x = o.x + (o.mx?.(u) ?? 0), y = o.y + (o.my?.(u) ?? 0);
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0), d = o.depth ?? TOP + 3;
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.08, sy * 1.6).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
  }
  /** The contact: a small white spark of the light. */
  private flash(x: number, y: number, size: number, o: { delay?: number; life?: number; tint?: number; run?: CastRun } = {}): void {
    this.spr({ name: 'rd-flash', x, y, depth: TOP + 4, w: size, life: o.life ?? 120, delay: o.delay, run: o.run, tint: o.tint ?? HOT, glow: 0.3, add: true, angle: rnd(0, 45),
      sx: kf([0, 0.45], [0.25, 1.05, out3], [1, 1.12]), sy: kf([0, 0.45], [0.25, 1.05, out3], [1, 1.12]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
  }
  /** The crown's jewel opening at a contact: a faceted spade, upright, swelling and gone. */
  private spade(x: number, y: number, size: number, o: { delay?: number; life?: number; run?: CastRun; angle?: number; tall?: number } = {}): void {
    this.spr({ name: 'rd-spade', x, y, depth: TOP + 4, w: size, h: size * 1.125 * (o.tall ?? 1), life: o.life ?? 150, delay: o.delay, run: o.run, tint: LIGHT, glow: 0.3, add: true, angle: o.angle ?? 0,
      sx: kf([0, 0.55], [0.3, 1.05, out3], [1, 1.15]), sy: kf([0, 0.55], [0.3, 1.05, out3], [1, 1.15]), a: kf([0, 0.95], [0.45, 0.9], [1, 0, inQ]) });
  }
  /** A thrust's trail: one lance of light from `from` to `to`, its head at `to`, gone in ~110 ms. */
  private lance(x0: number, y0: number, x1: number, y1: number, h: number, o: { delay?: number; life?: number; run?: CastRun } = {}): void {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return;
    this.spr({ name: 'rd-lance', x: x0, y: y0, ox: 0, depth: TOP + 3, w: L, h, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life: o.life ?? 110, delay: o.delay, run: o.run, tint: LIGHT, add: true, glow: 0.25,
      sx: kf([0, 0.55], [0.3, 1, out3]), a: kf([0, 0], [0.1, 1], [0.5, 0.85], [1, 0, inQ]) });
  }
  /** A swing's trail: one crescent of light at a point, turned `angle`, opening as it goes. */
  private arc(x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; flip?: boolean; flipY?: boolean; run?: CastRun; h?: number } = {}): void {
    this.spr({ name: 'rd-arc', x, y, depth: TOP + 3, w, h: o.h, angle, flipX: o.flip, flipY: o.flipY, life: o.life ?? 120, delay: o.delay, run: o.run, tint: LIGHT, glow: 0.25, add: true,
      sx: kf([0, 0.6], [0.3, 1.04, out3], [1, 1.1]), sy: kf([0, 0.8], [0.3, 1, out3], [1, 0.7]), a: kf([0, 0], [0.08, 1], [0.5, 0.8], [1, 0, inQ]) });
  }
  private ring(x: number, y: number, w: number, o: { delay?: number; life?: number; run?: CastRun } = {}): void {
    this.spr({ name: 'rd-ring', x, y, depth: TOP + 3, w, h: w * 0.42, life: o.life ?? 220, delay: o.delay, run: o.run, tint: LIGHT, add: true,
      sx: kf([0, 0.35], [1, 1.25, out3]), sy: kf([0, 0.35], [1, 1.25, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
  }
  private motes(x: number, y: number, n: number, o: { delay?: number; run?: CastRun; up?: boolean } = {}): void {
    for (let k = 0; k < n; k++) {
      const an = o.up ? rnd(-2.6, -0.5) : rnd(-Math.PI, Math.PI), d = rnd(14, 34);
      this.spr({ name: 'rd-mote', x, y, depth: TOP + 4, w: rnd(6, 10), life: rnd(140, 220), delay: o.delay, run: o.run, tint: k % 3 === 0 ? GOLD : LIGHT, add: true,
        mx: (u) => Math.cos(an) * d * out3(u), my: (u) => Math.sin(an) * d * out3(u), a: kf([0, 1], [1, 0]) });
    }
  }

  // ------------------------------------------------------------------ casts

  cast(r: CastRun): void {
    textures(this.ctx.scene);
    const s = r.skill, T = r.timings, side = sideOf(r), key = this.poseKey(r);
    const c0 = () => this.me(r);
    const hips = (dz = 50) => { const c = c0(); return { x: c.x, y: c.y - c.z - dz }; };
    if (styleOfSwitch(s.id)) { // the switch: the gold knob splits into the crown — a compact flash at his hands, then the jewel's one pulse
      this.onClock(r, T.startup * 0.4, () => { const h = hips(62); this.flash(h.x + side * 18, h.y, 46, { run: r, tint: LIGHT }); });
      this.onClock(r, T.startup, () => { const t = this.tip(r, 'stance'); this.spade(t.x, t.y - 6, 22, { run: r, life: 180 }); this.ring(t.x, t.y, 48, { run: r, life: 200 }); });
      return;
    }
    const hitAt = (i: number) => T.startup + (r.hits[i]?.at ?? 0);
    const thrust = (len: number, h: number, at: number, spadeSize = 0) => { // a straight trail along the staff to its tip, the contact at it
      this.onClock(r, Math.max(0, at - 30), () => { const t = this.tip(r), x0 = t.x - side * len; this.lance(x0, t.y, t.x + side * 18, t.y, h, { run: r }); });
      this.onClock(r, at, () => { const t = this.tip(r); this.flash(t.x + side * 10, t.y, 34, { run: r }); if (spadeSize) this.spade(t.x + side * 14, t.y, spadeSize, { run: r, angle: side * 90 }); });
    };
    switch (key) {
      case 'rd_four_beat': thrust(70, 12, hitAt(0)); break; // Knock: the ferrule's short jab
      case 'rd_four_beat#1': thrust(150, 14, hitAt(0)); break; // Measure: the crown thrust
      case 'rd_four_beat#2': // Spindle: the staff spun level round his hips — a flat crescent round them
        this.onClock(r, T.startup * 0.55, () => { const h = hips(52); this.arc(h.x + side * 20, h.y, 150, side < 0 ? 180 : 0, { flip: side < 0, h: 46, life: 130, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.flash(t.x, t.y, 30, { run: r }); });
        break;
      case 'rd_four_beat#3': // Bow: levered up overhead — one crescent rising from behind him over his head
        this.onClock(r, T.startup * 0.6, () => { const h = hips(90); this.arc(h.x + side * 16, h.y - 20, 150, side < 0 ? 215 : -35, { flip: side < 0, life: 140, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.flash(t.x, t.y, 38, { run: r }); this.motes(t.x, t.y, 3, { up: true, run: r }); });
        break;
      case 'rd_opening_bid': // the foot slide, the crown snapped straight out: the long lance, a spade at its point
        this.onClock(r, T.startup * 0.5, () => { const c = c0(); this.motes(c.x - side * 16, c.y - 4, 3, { run: r }); });
        thrust(170, 16, hitAt(0), 26);
        break;
      case 'rd_crown_raise': // the ferrule ripped up across his body: a rising diagonal crescent, then a line straight up with him
        this.onClock(r, T.startup * 0.65, () => { const h = hips(60); this.arc(h.x + side * 40, h.y - 10, 160, side < 0 ? 240 : -60, { flip: side < 0, life: 140, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.flash(t.x, t.y, 40, { run: r }); this.lance(t.x, t.y + 70, t.x, t.y - 90, 12, { run: r, life: 150 }); });
        break;
      case 'rd_royal_turn': // the 270° pivot: one crescent sweeping round in front of him, one behind, the contact at his line
        this.onClock(r, T.startup * 0.5, () => { const h = hips(58); this.arc(h.x - side * 26, h.y, 140, side < 0 ? 0 : 180, { flip: side >= 0, h: 50, life: 120, run: r }); });
        this.onClock(r, T.startup * 0.8, () => { const h = hips(58); this.arc(h.x + side * 34, h.y + 4, 170, side < 0 ? 180 : 0, { flip: side < 0, flipY: true, h: 54, life: 140, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.flash(t.x, t.y, 38, { run: r }); this.motes(t.x, t.y, 3, { run: r }); });
        break;
      case 'rd_collect_debt': { // levered up the planted staff, the crown driven down two-handed: a line down to the floor, a spade on it
        this.onClock(r, T.startup * 0.35, () => { const c = c0(); this.lance(c.x + side * 18, c.y, c.x + side * 18, c.y - 150, 10, { run: r, life: 160 }); });
        this.onClock(r, hitAt(0), () => { const c = c0(), x = c.x + side * 62;
          this.lance(x - side * 20, c.y - 150, x, c.y - 6, 16, { run: r, life: 120 }); this.spade(x, c.y - 22, 40, { run: r, life: 170 }); this.ring(x, c.y - 2, 120, { run: r });
          this.motes(x, c.y - 10, 5, { up: true, run: r }); this.ctx.punch(0.02, 130); this.shake(r, 110, 0.0028); });
        break;
      }
      case 'rd_all_in': { // the grip turned slowly through his palms — a glint running up the staff — the nod; then the one
        // extraordinarily straight thrust: the longest lance, an elongated spade at the tip, one pulse
        this.onClock(r, T.startup * 0.25, () => { const t = this.tip(r, 'stance'), c = c0(), x0 = c.x - side * 40, y0 = c.y - c.z - 30;
          this.spr({ name: 'rd-mote', x: x0, y: y0, depth: TOP + 4, w: 14, life: Math.max(120, T.startup * 0.55), run: r, tint: GOLD, add: true, glow: 0.3,
            mx: (u) => (t.x - x0) * out3(u), my: (u) => (t.y - y0) * out3(u), a: kf([0, 0], [0.15, 1], [0.85, 1], [1, 0]) }); });
        this.onClock(r, T.startup * 0.8, () => { const t = this.tip(r, 'stance'); this.spade(t.x, t.y - 4, 18, { run: r, life: 140 }); });
        this.onClock(r, Math.max(0, hitAt(0) - 30), () => { const t = this.tip(r); this.lance(t.x - side * 190, t.y, t.x + side * 40, t.y, 18, { run: r, life: 140 }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r), x = t.x + side * 30;
          this.spade(x, t.y, 34, { run: r, angle: side * 90, tall: 1.6, life: 190 }); this.flash(x, t.y, 52, { run: r }); this.ring(x, t.y, 70, { run: r, life: 200 });
          this.ctx.punch(0.022, 140); this.shake(r, 100, 0.0026); });
        break;
      }
      case 'rd_final_ovation': { // his ultimate (GPT): the Invitation — the crown a brilliant point above his head; the
        // Impossible Vault — one great crescent round the planted staff; the Crown Descends — the jewel swelling into a solid
        // faceted head; the Impact — one clean bounded crown-shaped arc, the spade on the floor, the room shakes
        const at = (dx: number, dz: number) => { const c = c0(); return { x: c.x + side * dx, y: c.y - c.z - dz }; };
        this.onClock(r, T.startup * 0.08, () => { const t = at(-25, 135); this.flash(t.x, t.y, 44, { run: r, life: 200 }); this.spade(t.x, t.y - 6, 26, { run: r, life: 260 }); this.motes(t.x, t.y, 5, { up: true, run: r }); });
        this.onClock(r, T.startup * 0.34, () => { const h = hips(70); this.arc(h.x, h.y - 30, 230, side < 0 ? 200 : -20, { flip: side < 0, life: 220, run: r }); });
        this.onClock(r, T.startup * 0.55, () => { const h = hips(90); this.arc(h.x + side * 20, h.y - 10, 200, side < 0 ? 160 : 20, { flip: side < 0, flipY: true, life: 200, run: r }); });
        this.onClock(r, T.startup * 0.78, () => { const t = this.tip(r, 'rd_collect_debt'); this.spade(t.x, t.y - 80, 40, { run: r, life: Math.max(120, T.startup * 0.22), tall: 1.3 }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r, 'rd_curtain_call');
          this.arc(t.x - side * 30, t.y - 40, 260, side < 0 ? 140 : 40, { flip: side < 0, flipY: true, life: 200, run: r });
          this.spade(t.x, t.y - 30, 70, { run: r, life: 240 }); this.flash(t.x, t.y - 12, 84, { run: r }); this.ring(t.x, t.y + 2, 220, { run: r, life: 280 }); this.motes(t.x, t.y - 8, 9, { up: true, run: r });
          this.ctx.punch(0.034, 200); this.shake(r, 220, 0.005); });
        break;
      }
      case 'rd_under_the_table': // the lower end swept along the floor at ankle height: one flat crescent low along it, motes kicked up
        this.onClock(r, T.startup * 0.6, () => { const c = c0(); this.arc(c.x + side * 70, c.y - 8, 190, side < 0 ? 180 : 0, { flip: side < 0, h: 30, life: 150, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r); this.flash(t.x + side * 30, t.y - 6, 30, { run: r }); this.motes(t.x + side * 30, t.y - 4, 4, { up: true, run: r }); });
        break;
      case 'rd_read_the_room': { // the staff held across him: a glint along it while he reads; a blow read — the ferrule snapped out at the striker
        this.onClock(r, T.startup, () => { const t = this.tip(r); this.lance(t.x - side * 90, t.y + 70, t.x, t.y, 8, { run: r, life: Math.max(80, T.active) }); });
        this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (!r.counterTriggered) return true;
          const t = this.tip(r, 'rd_read_the_room:strike'); this.lance(t.x - side * 90, t.y, t.x + side * 18, t.y, 14, { run: r }); this.flash(t.x + side * 10, t.y, 40, { run: r, delay: 40 }); this.spade(t.x + side * 14, t.y, 22, { run: r, angle: side * 90, delay: 40 });
          return false; } });
        break;
      }
      case 'rd_long_odds': // the thrust from the hip: a trail along the staff, a pulse at the crown as the diamond leaves it (its flight: projectile)
        thrust(120, 12, hitAt(0));
        break;
      case 'rd_high_stakes': { // the staff planted: a line straight up from the floor; over it; the other end strikes as he lands
        this.onClock(r, T.startup * 0.5, () => { const c = c0(); this.lance(c.x + side * 30, c.y, c.x + side * 30, c.y - 160, 10, { run: r, life: T.startup * 0.6 + T.active }); this.motes(c.x + side * 30, c.y - 4, 3, { run: r }); });
        this.onClock(r, hitAt(0), () => { const c = c0(); this.arc(c.x + side * 50, c.y - c.z - 40, 150, side < 0 ? 210 : -30, { flip: side < 0, life: 140, run: r }); this.flash(c.x + side * 70, c.y - c.z - 40, 36, { run: r }); });
        break;
      }
      case 'rd_side_bet': // the step; the staff round his hip — a short crescent — then the ferrule hooked out and drawn back
        this.onClock(r, T.startup * 0.6, () => { const h = hips(52); this.arc(h.x + side * 10, h.y, 120, side < 0 ? 200 : -20, { flip: side < 0, h: 40, life: 120, run: r }); });
        thrust(130, 13, hitAt(0));
        break;
      case 'rd_curtain_call': // the full body turn, the crown swelled into a faceted head: a great crescent down, the head's spade on the floor
        this.onClock(r, T.startup * 0.55, () => { const h = hips(70); this.arc(h.x + side * 30, h.y - 10, 190, side < 0 ? 150 : 30, { flip: side < 0, flipY: true, life: 140, run: r }); });
        this.onClock(r, hitAt(0), () => { const t = this.tip(r);
          this.spade(t.x, t.y - 26, 54, { run: r, life: 200 }); this.flash(t.x, t.y - 10, 60, { run: r }); this.ring(t.x, t.y + 2, 150, { run: r, life: 240 }); this.motes(t.x, t.y - 8, 6, { up: true, run: r });
          this.ctx.punch(0.028, 160); this.shake(r, 140, 0.0035); });
        break;
    }
  }

  // ------------------------------------------------------------------ on the foe

  /** A blow landed: one white contact of the light; a heavy blow a faceted spade opening at it; a launch a short lance up
   *  with him. */
  confirmed(_s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, big = heavy || !!hit.heavy;
    this.flash(x + rnd(-4, 4), y + rnd(-4, 4), big ? 54 : 36, { life: big ? 150 : 110 });
    this.motes(x, y, big ? 4 : 2);
    if (big) this.spade(x, y, 30, { life: 150 });
    if (crit) this.flash(x, y, 80, { life: 170, tint: LIGHT });
    if ((hit.reaction.launch ?? 0) >= 90) this.lance(x, at.y - at.z, x, at.y - at.z - 150, 10, { life: 180 });
  }

  /** The class's Extra Card (its passive's extra blow) in his hands: the staff's light flicks him once more — a small lance
   *  and a contact (Advanced: a little bigger). PVP 3D: only its number. */
  extraFlick(at: V3, dir: number, big = false): void {
    if ((this.ctx.scene as unknown as { a3d?: unknown }).a3d) return;
    textures(this.ctx.scene);
    const x = at.x + dir * 6, y = at.y - at.z - 40;
    this.lance(x - dir * 60, y - 8, x + dir * 6, y, 10, { life: 100 });
    this.flash(x, y, big ? 34 : 26, { life: 110 });
  }

  // ------------------------------------------------------------------ frame

  /** Long Odds' diamond in flight: one compact faceted diamond of light pointing down its line, a short trail behind it. */
  projectile(p: Projectile): void {
    textures(this.ctx.scene);
    const s = this.ctx.scene, ang = (Math.atan2(p.dy, p.dx) * 180) / Math.PI, maxMs = (p.range / Math.max(1, p.speed)) * 1000 + 300;
    const im = s.add.image(p.x, p.y - p.z, 'rd-spade').setDisplaySize(26, 30).setAngle(ang + 90).setBlendMode(Phaser.BlendModes.ADD).setTint(HOT);
    const tr = s.add.image(p.x, p.y - p.z, 'rd-lance').setOrigin(1, 0.5).setDisplaySize(90, 12).setAngle(ang).setBlendMode(Phaser.BlendModes.ADD).setTint(LIGHT).setAlpha(0.85);
    this.add({ t: 0, step: (_dt, t) => {
      if (p.done || t > maxMs) { im.destroy(); tr.destroy(); if (p.done && p.end) this.flash(p.end.x, p.y - p.z, 34); return false; }
      im.setPosition(p.x, p.y - p.z).setDepth(p.y + 3); tr.setPosition(p.x, p.y - p.z).setDepth(p.y + 2.9);
      return true;
    } });
  }

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
  }

  destroy(): void { this.live = []; this.incoming = []; }
}
