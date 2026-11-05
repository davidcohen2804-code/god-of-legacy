// The Samurai's Shuriken Assassin (Styles.ts, GPT's design — scratchpad styles/samurai_styles.md): the effects of his kit,
// drawn in code from small pieces of their own. GPT's rules for its look: dark steel trajectories, thin crimson return
// lines, small steel flashes — no big opaque red clouds, no smoke, no clones; the stars themselves are the show: the big
// four-point star spins out of his hand, waits at the end of its flight, comes home and is caught (Return Edge,
// SkillRuntime); the small stars flick off his wrist. Presentation only — gameplay never reads any of it; timing comes from
// the cast (and its clock), so every client draws the same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V3 } from './HitGeometry';
import { ON_BODY } from '../arena3d/flag';
import { styleDef, styleOfSwitch } from './Styles';

const TOP = 100000;
/** The big star's polished gunmetal, its white-hot glints, the crimson of his silk (the return line). */
const STEEL = 0xdfe8f4, GLINT = 0xffffff, CRIMSON = 0xe0404e;

export interface ShurikenCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  punch(amount?: number, ms?: number): void;
  /** His painted body as drawn now (a flash on his hand sits on it in PVP 3D: ON_BODY). */
  body?(id: string): { sprite?: object } | null;
  /** Still in the runtime's flight list (a round's reset drops its projectiles without an end). */
  live(p: Projectile): boolean;
  /** Where a fighter is now (the Eclipse's cuts follow the foe they struck, up in the air too). */
  targetPos?(id: string): V3 | null;
}

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out: Ease = (u) => 1 - (1 - u) * (1 - u), out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
type Key = [number, number, Ease?];
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);
type Pt = { x: number; y: number; d: number };

/** Where his throwing hand is in the pose each attack holds (world px ahead of and over his feet, facing right — measured
 *  on his painted frames, tools/heroes/motion/samurai_assassin). A chain stage: id#stage. */
const HAND: Record<string, [number, number]> = {
  stance: [-3, 56], as_four_beat: [74, 105], 'as_four_beat#1': [72, 93], 'as_four_beat#2': [74, 91], 'as_four_beat#3': [36, 132],
  as_redline_recall: [71, 116], as_piercing_quarter: [68, 57], 'as_piercing_quarter:wind': [-38, 115], as_four_point_eclipse: [74, 89],
  as_crowstep_rise: [48, 118], as_returning_moon: [71, 116], 'as_returning_moon:catch': [36, 132], air: [66, 45],
  as_needle_fan: [74, 105], as_silk_shift: [74, 105], as_crosslane_split: [72, 93], as_falling_talon: [66, 45], as_iron_palm: [71, 116], as_heel_sweep: [48, 118],
};
/** The stars are drawn this high over their flight line (the line is the hit's: chest height). */
const LIFT = 38;

/** His pieces, drawn once on canvases (warm-free steel — the samurai's crimson stays in the silk). */
function textures(s: Phaser.Scene): void {
  if (s.textures.exists('as-big')) return;
  const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const t = s.textures.createCanvas(key, w, h); if (!t) return; draw(t.getContext()); t.refresh(); };
  const blade = (g: CanvasRenderingContext2D, c: number, r0: number, r1: number, w: number, light: [string, string], dark: [string, string]) => {
    for (let k = 0; k < 4; k++) { // four tapered blades, each split down its spine into a lit and a shaded bevel
      g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 2);
      let gr = g.createLinearGradient(r0, 0, r1, 0); gr.addColorStop(0, light[0]); gr.addColorStop(1, light[1]);
      g.fillStyle = gr; g.beginPath(); g.moveTo(r0 * 0.6, 0); g.lineTo(r0 + 3, -w); g.lineTo(r1, 0); g.closePath(); g.fill();
      gr = g.createLinearGradient(r0, 0, r1, 0); gr.addColorStop(0, dark[0]); gr.addColorStop(1, dark[1]);
      g.fillStyle = gr; g.beginPath(); g.moveTo(r0 * 0.6, 0); g.lineTo(r0 + 3, w); g.lineTo(r1, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(r0 + 3, -w); g.lineTo(r1, 0); g.stroke(); // its honed edge
      g.restore();
    }
  };
  mk('as-big', 96, 96, (g) => { // the big four-point star: gunmetal blades with bevels and honed edges, a crimson silk ring at its heart
    blade(g, 48, 12, 46, 11, ['#e4ebf2', '#9aa6b3'], ['#5b636d', '#2a2f36']);
    const rg = g.createRadialGradient(46, 46, 2, 48, 48, 14); rg.addColorStop(0, '#ff6a72'); rg.addColorStop(0.55, '#c4202e'); rg.addColorStop(1, '#5a0a12');
    g.fillStyle = rg; g.beginPath(); g.arc(48, 48, 13.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#16181c'; g.beginPath(); g.arc(48, 48, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,190,190,0.7)'; g.lineWidth = 1; g.beginPath(); g.arc(48, 48, 10, -2.4, -0.9); g.stroke();
  });
  mk('as-small', 32, 32, (g) => { // a small throwing star off his forearm: four steel points, a dark centre
    blade(g, 16, 3, 15, 4.2, ['#eef3f8', '#a3aebb'], ['#6a727c', '#30353c']);
    g.fillStyle = '#1c1f24'; g.beginPath(); g.arc(16, 16, 2.6, 0, Math.PI * 2); g.fill();
  });
  mk('as-spin', 96, 96, (g) => { // the air the big star slices as it spins: a faint ring, brighter where the blades sweep
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(48, 48); g.rotate((k * Math.PI) / 2);
      const gr = g.createRadialGradient(0, 0, 30, 0, 0, 46); gr.addColorStop(0, 'rgba(230,238,248,0)'); gr.addColorStop(0.7, 'rgba(230,238,248,0.55)'); gr.addColorStop(1, 'rgba(230,238,248,0)');
      g.strokeStyle = gr; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 38, -0.2, 0.95); g.stroke();
      g.restore();
    }
  });
  mk('as-trail', 128, 8, (g) => { // a dark-steel trajectory: bright at its head (the right), fading back along it
    for (const [y, a] of [[2, 0.35], [3, 1], [4, 1], [5, 0.35]] as const) {
      const lg = g.createLinearGradient(0, 0, 128, 0); lg.addColorStop(0, 'rgba(200,212,226,0)'); lg.addColorStop(0.65, `rgba(220,230,242,${0.5 * a})`); lg.addColorStop(1, `rgba(255,255,255,${a})`);
      g.fillStyle = lg; g.fillRect(0, y, 128, 1);
    }
  });
  mk('as-red', 128, 6, (g) => { // the thin crimson return line (soft at both ends)
    for (const [y, a] of [[1, 0.4], [2, 1], [3, 1], [4, 0.4]] as const) {
      const lg = g.createLinearGradient(0, 0, 128, 0); lg.addColorStop(0, 'rgba(255,90,100,0)'); lg.addColorStop(0.2, `rgba(255,120,128,${a})`); lg.addColorStop(0.8, `rgba(255,120,128,${a})`); lg.addColorStop(1, 'rgba(255,90,100,0)');
      g.fillStyle = lg; g.fillRect(0, y, 128, 1);
    }
  });
  mk('as-flash', 64, 64, (g) => { // a small steel flash: four thin rays and a hot core
    const c = 32, gr = g.createRadialGradient(c, c, 0, c, c, 12); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 4; k++) {
      const L = k % 2 ? 22 : 30; g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 2);
      const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -1.8); g.lineTo(L, 0); g.lineTo(0, 1.8); g.closePath(); g.fill(); g.restore();
    }
  });
  mk('as-x', 64, 64, (g) => { // a crossed cut: two thin bright slashes
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      g.save(); g.translate(32, 32); g.rotate(a);
      const lg = g.createLinearGradient(-30, 0, 30, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(-30, 0); g.lineTo(0, -1.7); g.lineTo(30, 0); g.lineTo(0, 1.7); g.closePath(); g.fill(); g.restore();
    }
  });
  mk('as-arc', 128, 64, (g) => { // a thin crescent of cut air, sharp at its leading edge (the top), thinning to its horns
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(225,235,248,0.6)'); gr.addColorStop(1, 'rgba(225,235,248,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(4, 56); g.quadraticCurveTo(64, -14, 124, 56); g.quadraticCurveTo(64, 10, 4, 56); g.closePath(); g.fill();
  });
  mk('as-dust', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(196,182,170,0.55)'); gr.addColorStop(0.6, 'rgba(180,168,156,0.22)'); gr.addColorStop(1, 'rgba(170,160,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}

interface Spr {
  name: string; x?: number; y?: number; depth?: number; w: number; h?: number;
  delay?: number; life: number; ox?: number; oy?: number; angle?: number; flipX?: boolean;
  glow?: number; tint?: number; add?: boolean;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number;
  follow?: () => Pt | null; dz?: number; run?: CastRun; on?: string;
}
interface Live { t: number; step(dt: number, t: number): boolean }
/** A star in flight: its picture, the air it slices (the big one), its trail; where it was drawn last (its trail's line);
 *  its first frames drawn from his hand to its line. */
interface Star { im: Phaser.GameObjects.Image; spin: Phaser.GameObjects.Image | null; tr: Phaser.GameObjects.Image; t: number; big: boolean; w: number;
  hand: { x: number; y: number } | null; lx: number; ly: number; ang: number; leg: string; legT: number }

export class ShurikenFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private stars = new Map<Projectile, Star>();
  constructor(private ctx: ShurikenCtx) {}

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  private later(ms: number, fn: () => void, run?: CastRun): void {
    this.add({ t: 0, step: (_dt, t) => { if (t < ms) return true; if (!this.broken(run)) fn(); return false; } });
  }
  /** Runs `fn` when the cast's own clock reaches `ms` — in step with its hits, through every hit-stop; never if it is cut first. */
  private onClock(r: CastRun, ms: number, fn: () => void): void {
    this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (r.elapsed < ms) return true; fn(); return false; } });
  }
  private broken(r?: CastRun): boolean { return !!r && r.phase === 'done' && !r.fired.size; }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** His hand in a pose (HAND), following him. */
  private handAt(id: string, side: number, key: string): () => Pt | null {
    const [dx, dz] = HAND[key] ?? HAND.stance;
    return () => { const c = this.ctx.casterPos(id); return c ? { x: c.x + side * dx, y: c.y - c.z - dz, d: c.y } : null; };
  }
  private poseKey(r: CastRun): string { return r.skill.chain && r.stage > 0 ? `${r.skill.id}#${r.stage}` : r.skill.id; }
  private shake(r: CastRun | null, ms: number, k: number): void { if (!r || r.own) this.ctx.cam().shake(ms, k); }

  private spr(o: Spr): Phaser.GameObjects.Image | null {
    const s = this.ctx.scene; textures(s);
    if (!s.textures.exists(o.name)) return null;
    const fr = s.textures.getFrame(o.name); const fw = fr.width, fh = fr.height;
    const bx = o.w / fw, by = (o.h ?? (o.w * fh) / fw) / fh;
    const mk = (glow: boolean) => {
      const im = s.add.image(o.x ?? 0, o.y ?? 0, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlipX(!!o.flipX).setVisible(false)
        .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const glowA = o.glow !== undefined ? Math.min(o.glow, 0.35) : 0;
    const im = mk(false), gl = glowA ? mk(true) : null;
    if (o.on) { const id = o.on, on = () => this.ctx.body?.(id)?.sprite ?? null; ON_BODY.set(im, on); if (gl) ON_BODY.set(gl, on); }
    let shown = false;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (!shown) { shown = true; if (this.broken(o.run)) { im.destroy(); gl?.destroy(); return false; } }
      const u = Math.min(1, e / o.life);
      let x = o.x ?? 0, y = o.y ?? 0, d = o.depth ?? TOP;
      if (o.follow) { const p = o.follow(); if (!p) { im.destroy(); gl?.destroy(); return false; } x = p.x; y = p.y; d = p.d + (o.dz ?? 3); }
      x += o.mx?.(u) ?? 0; y += o.my?.(u) ?? 0;
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0);
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.06, sy * 1.06).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
    return im;
  }
  /** A small steel flash: pops out, spreads a little, fades. */
  private flash(x: number, y: number, size: number, o: { depth?: number; life?: number; delay?: number; run?: CastRun; tint?: number; follow?: () => Pt | null; on?: string; angle?: number } = {}): void {
    this.spr({ name: 'as-flash', x, y, depth: o.depth ?? TOP + 4, w: size, life: o.life ?? 150, delay: o.delay, run: o.run, tint: o.tint ?? GLINT, glow: 0.3, add: true, follow: o.follow, on: o.on, angle: o.angle ?? rnd(0, 45),
      sx: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.15]), sy: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.15]), a: kf([0, 1], [0.4, 1], [1, 0, inQ]) });
  }
  /** A thin line on screen between two points (a return line, a cut's track), fading. */
  private line(name: 'as-red' | 'as-trail', x0: number, y0: number, x1: number, y1: number, h: number, life: number, o: { depth?: number; tint?: number; delay?: number; run?: CastRun; a?: (u: number) => number } = {}): void {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return;
    this.spr({ name, x: x0, y: y0, ox: 0, oy: 0.5, depth: o.depth ?? TOP + 3, w: L, h, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life, tint: o.tint, delay: o.delay, run: o.run, glow: 0.25,
      a: o.a ?? kf([0, 0], [0.12, 1], [0.6, 0.8], [1, 0, inQ]) });
  }
  /** A thin crescent of cut air at a point, swept round `rot` degrees. */
  private arc(x: number, y: number, w: number, angle: number, life: number, o: { depth?: number; delay?: number; run?: CastRun; flip?: boolean; tint?: number } = {}): void {
    this.spr({ name: 'as-arc', x, y, depth: o.depth ?? TOP + 3, w, angle, flipX: o.flip, life, delay: o.delay, run: o.run, tint: o.tint ?? STEEL, glow: 0.3, add: true,
      sx: kf([0, 0.55], [0.3, 1.05, out3], [1, 1.12]), sy: kf([0, 0.7], [0.3, 1, out3], [1, 0.7]), a: kf([0, 0], [0.08, 1], [0.5, 0.85], [1, 0, inQ]) });
  }
  private dust(x: number, y: number, w: number, delay = 0): void {
    this.spr({ name: 'as-dust', x, y, oy: 0.7, depth: y + 1, w, delay, life: 420, sx: kf([0, 0.5], [1, 1.5, out3]), sy: kf([0, 0.35], [1, 0.6, out3]), a: kf([0, 0.7], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ casts

  cast(r: CastRun): void {
    textures(this.ctx.scene);
    const s = r.skill, T = r.timings, side = sideOf(r), id = r.attackerId;
    if (styleOfSwitch(s.id)) { this.styleSwitch(r); return; }
    const hand = this.handAt(id, side, this.poseKey(r));
    switch (this.poseKey(r)) {
      case 'as_four_beat': case 'as_four_beat#1': // tik — tik-tik: a glint as the star leaves the wrist
        this.onClock(r, T.startup, () => this.flash(0, 0, 26, { follow: hand, on: id, life: 110, run: r }));
        break;
      case 'as_four_beat#2': // WHIRR: the big star whipped out sidearm — the air cut in front of him
        this.onClock(r, T.startup, () => { const p = hand(); if (!p) return; this.arc(p.x - side * 18, p.y + 6, 92, side < 0 ? 196 : -16, 200, { flip: side < 0, run: r }); this.flash(p.x, p.y, 34, { life: 120 }); });
        break;
      case 'as_piercing_quarter': { // wound up overhead (the star glinting in his raised hand), then the release down the line
        const wind = this.handAt(id, side, 'as_piercing_quarter:wind');
        this.flash(0, 0, 30, { follow: wind, on: id, life: 160, delay: T.startup * 0.35, run: r });
        this.onClock(r, T.startup, () => {
          const p = hand(), c = this.me(r); if (!p) return;
          this.arc(p.x - side * 30, p.y - 26, 150, side < 0 ? 146 : 34, 230, { flip: side < 0, run: r }); // the overhand swing's cut air
          this.line('as-trail', p.x, p.y, p.x + side * 470, p.y + 10, 5, 260, { tint: STEEL, run: r, a: kf([0, 0], [0.1, 0.9], [1, 0, inQ]) }); // its line through the field
          this.dust(c.x + side * 40, c.y, 70);
          this.shake(r, 90, 0.003);
        });
        break;
      }
      case 'as_redline_recall': case 'as_returning_moon': // the open palm: a crimson glint called into it
        this.flash(0, 0, 30, { follow: hand, on: id, life: 180, tint: 0xffd4d8, delay: T.startup * 0.5, run: r });
        break;
      case 'as_four_point_eclipse': this.eclipse(r); break;
      case 'as_fivefold_night': this.fivefold(r); break;
      case 'as_needle_fan': // three glints off the forearms as the stars leave, fanned across the lanes
        for (const da of [-24, 0, 24]) this.onClock(r, T.startup, () => this.flash(0, 0, 22, { follow: hand, on: id, life: 110, angle: 45 + da, run: r }));
        break;
      case 'as_heel_sweep': { // down low: the sweep's arc along the floor, then the heel's arc rising through him
        const c = this.me(r); this.dust(c.x + side * 30, c.y, 90, T.startup * 0.7);
        this.onClock(r, T.startup, () => { const q = this.me(r); this.arc(q.x + side * 52, q.y - q.z - 14, 120, side < 0 ? 186 : -6, 190, { flip: side < 0, run: r }); });
        this.onClock(r, T.startup + (r.hits[0]?.at ?? 0), () => { const q = this.me(r); this.arc(q.x + side * 48, q.y - q.z - 70, 130, side < 0 ? 118 : 62, 230, { flip: side < 0, run: r }); });
        break;
      }
      case 'as_silk_shift': { // the low step: dust where he leaves and lands, a glint as the star leaves the wrist
        const c = this.me(r); this.dust(c.x, c.y, 70, T.startup);
        this.onClock(r, T.startup + T.active * 0.9, () => { const q = this.me(r); this.dust(q.x, q.y, 60); });
        this.onClock(r, T.startup + (r.hits[0]?.at ?? 0), () => this.flash(0, 0, 24, { follow: hand, on: id, life: 110, run: r }));
        break;
      }
      case 'as_crosslane_split': // two glints crossed at the hands as the stars leave
        for (const da of [-35, 35]) this.onClock(r, T.startup + (r.hits[0]?.at ?? 0), () => this.flash(0, 0, 26, { follow: hand, on: id, life: 120, angle: 45 + da, run: r }));
        break;
      case 'as_falling_talon': // the heel dropped like a talon: one steep arc of cut air down through the space in front of him
        this.onClock(r, T.startup + (r.hits[0]?.at ?? 0), () => { const q = this.me(r); this.arc(q.x + side * 70, q.y - q.z - 30, 150, side < 0 ? 240 : -60, 220, { flip: side < 0, run: r }); this.shake(r, 90, 0.004); });
        break;
      case 'as_iron_palm': // the forearm raised: a faint steel glint along it for the parry's moment
        this.flash(0, 0, 26, { follow: hand, on: id, life: Math.max(80, T.active), tint: 0xdfe8f4, delay: T.startup, run: r });
        break;
      case 'as_crowstep_rise': { // the step into the knee: dust at the take-off, the rising cut of the star
        const c = this.me(r); this.dust(c.x - side * 10, c.y, 80, T.startup * 0.6);
        this.onClock(r, T.startup, () => { const p = hand(); if (!p) return; this.arc(p.x + side * 10, p.y + 18, 120, side < 0 ? 128 : 52, 230, { flip: side < 0, run: r }); });
        break;
      }
    }
  }

  active(_r: CastRun): void { /* (each skill's timeline runs from its cast, on its own clock) */ }

  /** Fivefold Night (his ultimate — GPT: unseal, spread, reverse, converge, catch; no dragon, no black sun, no clones): the
   *  four stars unsealed round him glint one by one as the hand star joins them; at the throw the five fly out in five lanes
   *  through the foe (the spread), turn beyond him and cut back through him crossed (the reverse — a crimson line each),
   *  swing out to five points round him and close on him at once — five crossed cuts, the room shakes (the converge) — then
   *  fly home to his back and his hand (the catch). The stars are drawn for the whole flight (his painted pose holds them
   *  only while they are unsealed); each follows the foe as it flies (in the air too). */
  private fivefold(r: CastRun): void {
    const T = r.timings, side = sideOf(r), id = r.attackerId;
    const BACK: [number, number][] = [[42, 79], [-24, 112], [37, 106], [-34, 85], [13, 144]]; // (the four unsealed and the hand star: world px ahead of / over his feet, facing right — read off his pose)
    const home = (k: number): { x: number; y: number } => { const c = this.me(r), [dx, dz] = BACK[k]; return { x: c.x + side * dx, y: c.y - c.z - dz }; };
    for (let k = 0; k < 5; k++) this.onClock(r, T.startup * (0.2 + k * 0.12), () => { const p = home(k); this.flash(p.x, p.y, 30, { life: 160, run: r }); }); // unsealed one by one: a glint on each
    const pre = `${r.castId}|`;
    const foeId = (): string | null => { for (const k of r.hitKeys) if (k.startsWith(pre)) { const rest = k.slice(pre.length); return rest.slice(rest.indexOf('|') + 1); } return r.lock ?? null; };
    const guess = { x: 0, y: 0, fy: 0 }; // (no foe: a point down his line)
    const foe = (): { x: number; y: number; fy: number } => { const f = foeId(), t = f ? this.ctx.targetPos?.(f) : null; return t ? { x: t.x, y: t.y - t.z - 50, fy: t.y } : guess; };
    const h0 = r.hits[0]?.at ?? 0, h1 = r.hits[1]?.at ?? h0, h2 = r.hits[2]?.at ?? h1; // (ms after the throw, at the cast's pace)
    const LANE = [-56, -28, 0, 28, 56], RIM = 150, RAD = 130;
    const ang = (k: number) => ((-90 + k * 72) * Math.PI) / 180; // (a five-point star's points round him)
    // each star's flight after the hand, as points round the foe (read where he is as it flies) at its times: through him in
    // its lane, out beyond him fanned, back through him crossed, out to its point round him, into him
    const rel = (k: number): [number, number, number][] => [
      [h0, 0, LANE[k]], [(h0 + h1) / 2, side * RIM, LANE[k] * 1.6], [h1, 0, -LANE[k]],
      [(h1 + h2) / 2, Math.cos(ang(k)) * RAD, Math.sin(ang(k)) * RAD * 0.7], [h2, 0, 0]];
    this.onClock(r, T.startup, () => {
      const c = this.me(r); guess.x = c.x + side * 240; guess.y = c.y - c.z - 60; guess.fy = c.y;
      for (let k = 0; k < 5; k++) {
        const p0 = home(k), R = rel(k), ts = [0, ...R.map((q) => q[0])];
        let ly = 0;
        const at = (t: number): { x: number; y: number } => { // a smooth curve through the points at their times (Hermite, tangents from the neighbours)
          const f = foe(), P = [p0, ...R.map((q) => ({ x: f.x + q[1], y: f.y + q[2] }))], n = P.length - 1;
          let i = 0; while (i < n - 1 && t > ts[i + 1]) i++;
          const dt = Math.max(1, ts[i + 1] - ts[i]), u = Math.max(0, Math.min(1, (t - ts[i]) / dt));
          const tan = (j: number) => { const a = P[Math.max(0, j - 1)], b = P[Math.min(n, j + 1)], d = Math.max(1, ts[Math.min(n, j + 1)] - ts[Math.max(0, j - 1)]); return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
          const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
          const a0 = 2 * u3 - 3 * u2 + 1, b0 = u3 - 2 * u2 + u, a1 = -2 * u3 + 3 * u2, b1 = u3 - u2;
          return { x: a0 * P[i].x + b0 * dt * m0.x + a1 * P[i + 1].x + b1 * dt * m1.x, y: a0 * P[i].y + b0 * dt * m0.y + a1 * P[i + 1].y + b1 * dt * m1.y };
        };
        // (flown on the cast's own clock, in step with its hits and his poses: in PvP a hit-stop holds the effects' clock but
        // never the fight — his three hits' stops run into one another and held the stars still through the whole strike)
        let ct = 0;
        this.spr({ name: 'as-big', x: 0, y: 0, depth: TOP + 3, w: 46, life: h2 + 1500, run: r, tint: STEEL, glow: 0.2,
          mx: () => { ct = Math.max(0, r.elapsed - T.startup); const q = at(Math.min(ct, h2)); ly = q.y; return q.x; }, my: () => ly,
          rot: () => (side * 2200 * Math.min(ct, h2)) / Math.max(1, h2), a: () => (ct >= h2 || r.phase === 'done' ? 0 : ct < 18 ? 0.7 : 1) });
        const f = foe(), e = { x: f.x + side * RIM, y: f.y + LANE[k] * 1.6 };
        this.line('as-trail', p0.x, p0.y, e.x, e.y, 4, h0 + 140, { tint: STEEL, run: r, a: kf([0, 0.5], [0.15, 0.85], [1, 0, inQ]) }); // the spread: five lanes through him
      }
    });
    this.onClock(r, T.startup + (h0 + h1) / 2, () => { const f = foe(); // the reverse: back through him, crossed — the crimson return lines
      for (let k = 0; k < 5; k++) { const x0 = f.x + side * RIM, y0 = f.y + LANE[k] * 1.6, x1 = f.x - side * 60, y1 = f.y - LANE[k] * 2.2; this.line('as-red', x0, y0, x1, y1, 3, 220, { tint: CRIMSON, run: r, a: kf([0, 0.95], [0.5, 0.8], [1, 0, inQ]) }); } // (seen from its first frame: a hit-stop holds it as it is)
    });
    this.onClock(r, T.startup + (h1 + h2) / 2, () => { const f = foe(); // the converge: five steel tracks closing on him
      for (let k = 0; k < 5; k++) this.line('as-trail', f.x + Math.cos(ang(k)) * RAD, f.y + Math.sin(ang(k)) * RAD * 0.7, f.x, f.y, 5, 200, { tint: STEEL, run: r, a: kf([0, 0.9], [0.3, 1], [1, 0, inQ]) });
    });
    this.onClock(r, T.startup + h2, () => { const f = foe(); // five crossed cuts at once; then the five fly home, the hand star caught
      for (let k = 0; k < 5; k++) this.spr({ name: 'as-x', x: f.x, y: f.y, depth: TOP + 4, w: 78, life: 230, run: r, tint: GLINT, glow: 0.3, add: true, angle: k * 36,
        sx: kf([0, 0.8], [0.25, 1.1, out3], [1, 1.2]), sy: kf([0, 0.8], [0.25, 1.1, out3], [1, 1.2]), a: kf([0, 1], [0.5, 0.9], [1, 0, inQ]) });
      this.flash(f.x, f.y, 76, { life: 210 }); this.dust(f.x, f.fy, 110); this.ctx.punch(0.03, 190); this.shake(r, 220, 0.005);
      const CATCH: [number, number] = [36, 132]; // (his hand in the catch: the last frame of the move)
      for (let k = 0; k < 5; k++) {
        const to = (): { x: number; y: number } => { const c = this.me(r), [dx, dz] = k === 4 ? CATCH : BACK[k]; return { x: c.x + side * dx, y: c.y - c.z - dz }; };
        let ly = 0;
        this.spr({ name: 'as-big', x: 0, y: 0, depth: TOP + 3, w: 40, life: 280, delay: 70, run: r, tint: STEEL,
          mx: (u) => { const g = to(), w = out3(u); ly = f.y + (g.y - f.y) * w - 40 * Math.sin(Math.PI * u); return f.x + (g.x - f.x) * w; }, my: () => ly,
          rot: (u) => -side * 1400 * u, a: k === 4 ? kf([0, 1], [1, 1]) : kf([0, 1], [0.8, 1], [1, 0, inQ]) });
      }
      this.later(350, () => { const c = this.ctx.casterPos(id); if (c) this.caughtAt(c.x + side * CATCH[0], c.y - c.z - CATCH[1]); }, r);
    });
  }
  /** Four-Point Eclipse: the big star flies out to him (two fingers steering it), turns four times round him — four crossing
   *  cuts through him from four sides, each on its hit — then rises straight up through him and flies home to the hand. */
  private eclipse(r: CastRun): void {
    const T = r.timings, side = sideOf(r), id = r.attackerId, hand = this.handAt(id, side, 'as_four_point_eclipse');
    this.flash(0, 0, 32, { follow: hand, on: id, life: 170, delay: T.startup * 0.3, run: r });
    const c0 = this.me(r), place = r.place ?? { x: c0.x + side * 200, y: c0.y };
    this.onClock(r, T.startup * 0.45, () => { // out to him: the star spinning along its line
      const p = hand(); if (!p) return;
      const tx = place.x, ty = place.y - LIFT - 34, fly = Math.max(60, T.startup * 0.55);
      this.spr({ name: 'as-big', x: p.x, y: p.y, depth: place.y + 3, w: 40, life: fly, run: r, rot: (u) => 1300 * u, mx: (u) => (tx - p.x) * out(u), my: (u) => (ty - p.y) * out(u) });
      this.line('as-trail', p.x, p.y, tx, ty, 5, fly + 140, { tint: STEEL, run: r });
    });
  }

  /** Each hit as it fires (lands or not): the Eclipse's cuts through the point he stands on. */
  hit(r: CastRun, i: number, _o: V3): void {
    if (r.skill.id === 'as_iron_palm') { // the parry caught a blow: a hard steel flash on the forearm, a crossed spark, the star flicked back
      const p = this.handAt(r.attackerId, sideOf(r), 'as_iron_palm')(); if (!p) return;
      this.flash(p.x, p.y, 58, { life: 160, depth: p.d + 6 });
      this.spr({ name: 'as-x', x: p.x, y: p.y, depth: p.d + 7, w: 44, life: 160, tint: GLINT, glow: 0.3, add: true, angle: rnd(-12, 12), a: kf([0, 1], [1, 0, inQ]) });
      this.ctx.punch(0.015, 110);
      return;
    }
    if (r.skill.id !== 'as_four_point_eclipse') return;
    const place = r.place; if (!place) return;
    this.later(1, () => { // (a beat later: its blows delivered — drawn on the foe it struck, where he is, in the air too)
      const key = `${r.castId}|${i}|`, hk = [...r.hitKeys].find((k) => k.startsWith(key)), t = hk ? this.ctx.targetPos?.(hk.slice(key.length)) : null;
      this.eclipseCut(r, i, t ? t.x : place.x, t ? t.y - t.z - 40 : place.y - LIFT - 34, t ? t.y : place.y);
    });
  }
  private eclipseCut(r: CastRun, i: number, x: number, y: number, fy: number): void {
    const place = { x, y: fy }, last = i === r.hits.length - 1, side = sideOf(r);
    if (!last) { // a crossing cut through him from one of four sides: the star's track, the crescent of its cut, a glint where it turns
      const a = [35, -35, 145, -145][i % 4] * (Math.PI / 180), L = 96;
      const x0 = x - Math.cos(a) * L, y0 = y - Math.sin(a) * L * 0.6, x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L * 0.6;
      this.line('as-trail', x0, y0, x1, y1, 6, 170, { tint: STEEL, depth: place.y + 4 });
      this.spr({ name: 'as-big', x: x0, y: y0, depth: place.y + 5, w: 38, life: 90, rot: (u) => 700 * u, mx: (u) => (x1 - x0) * u, my: (u) => (y1 - y0) * u, a: kf([0, 1], [0.85, 1], [1, 0]) });
      this.flash(x1, y1, 30, { life: 120, depth: place.y + 6 });
      return;
    }
    // the rise: straight up through him, a tall steel track, then home to the hand
    this.line('as-trail', x, y + 40, x, y - 150, 7, 260, { tint: STEEL, depth: place.y + 4 });
    this.spr({ name: 'as-big', x, y: y + 30, depth: place.y + 5, w: 42, life: 200, rot: (u) => 900 * u, my: (u) => -190 * out(u) });
    this.flash(x, y, 56, { life: 180, depth: place.y + 6 });
    this.later(200, () => {
      const h = this.handAt(r.attackerId, side, 'as_four_point_eclipse')(); if (!h) return;
      const fx = x, fy = y - 160;
      this.spr({ name: 'as-big', x: fx, y: fy, depth: place.y + 5, w: 40, life: 230, rot: (u) => 1100 * u, mx: (u) => (h.x - fx) * inQ(u), my: (u) => (h.y - fy) * inQ(u) });
      this.later(230, () => this.caughtAt(h.x, h.y));
    });
    this.ctx.punch(0.02, 140);
  }

  /** The switch (GPT's 240 ms): into the assassin — a steel glint as the big star locks into his hand, one sharp spin;
   *  back into the katana — a short stroke of crimson ink where the blade comes back. No column, no zoom. */
  private styleSwitch(r: CastRun): void {
    const sw = styleOfSwitch(r.skill.id); if (!sw) return;
    const T = r.timings, side = sideOf(r), id = r.attackerId, to = styleDef(sw.cls, sw.style), c = this.me(r);
    this.spr({ name: 'as-flash', w: 120, life: 130, delay: T.startup * 0.4, follow: () => { const q = this.ctx.casterPos(id); return q ? { x: q.x, y: q.y - q.z - 64, d: q.y } : null; }, dz: 6, glow: 0.3, add: true, tint: to?.accent ?? GLINT, run: r,
      sx: kf([0, 0.5], [0.4, 1, out3], [1, 1.1]), sy: kf([0, 0.5], [0.4, 1, out3], [1, 1.1]), a: kf([0, 0], [0.25, 0.6], [1, 0, inQ]) });
    if (sw.style === 'shuriken') {
      const hand = this.handAt(id, side, 'stance');
      this.spr({ name: 'as-big', w: 30, life: 160, delay: T.startup, follow: hand, on: id, dz: 5, run: r, rot: (u) => 360 * out(u), a: kf([0, 0.9], [1, 0, inQ]) }); // one sharp spin as it locks in
      this.flash(0, 0, 30, { follow: hand, on: id, life: 110, delay: T.startup + 60, run: r });
    } else this.arc(c.x + side * 30, c.y - c.z - 60, 110, side < 0 ? 200 : -20, 200, { flip: side < 0, delay: T.startup * 0.6, run: r, tint: 0xffb0b8 });
  }

  // ------------------------------------------------------------------ stars in flight

  projectile(p: Projectile, r: CastRun): void {
    textures(this.ctx.scene);
    const s = this.ctx.scene, big = !!p.edge, w = big ? 48 : 18; // (the big star a little over its painted size: it must read at the fight's distance)
    const im = s.add.image(p.x, p.y - p.z - LIFT, big ? 'as-big' : 'as-small').setDisplaySize(w, w).setAlpha(0).setDepth(p.y + 2);
    const spin = big ? s.add.image(p.x, p.y - p.z - LIFT, 'as-spin').setDisplaySize(w * 1.25, w * 1.25).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(p.y + 2.1) : null;
    const tr = s.add.image(p.x, p.y - p.z - LIFT, 'as-trail').setOrigin(1, 0.5).setTint(STEEL).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(p.y + 1.9);
    const c = this.ctx.casterPos(p.attackerId), side = p.dx < -0.01 ? -1 : 1, key = c ? (c.z > 30 && !big ? 'air' : r.skill.chain && r.stage > 0 ? `${r.skill.id}#${r.stage}` : r.skill.id) : '';
    const hv = HAND[key], hand = c && hv ? { x: c.x + side * hv[0], y: c.y - c.z - hv[1] } : null;
    this.stars.set(p, { im, spin, tr, t: 0, big, w, hand, lx: hand?.x ?? p.x, ly: hand?.y ?? p.y - p.z - LIFT, ang: rnd(0, 90), leg: p.edge?.leg ?? 'out', legT: 0 });
    if (big && hand && p.edge?.leg === 'out') this.flash(hand.x, hand.y, 30, { life: 110 }); // (the release)
  }

  /** The big star's legs (RT_EVENTS.edge): it waits at the end of its flight (a glint as it stops); it turns for his hand
   *  — called home by a recall, the thin crimson return line drawn from it to his hand first. */
  edge(p: Projectile, r: CastRun, leg: string): void {
    const st = this.stars.get(p); if (!st) return;
    st.leg = leg; st.legT = 0;
    const x = p.x, y = p.y - p.z - LIFT;
    if (leg === 'park') { this.flash(x, y, 34, { life: 140, depth: p.y + 3 }); return; }
    if (leg === 'back' && (r.skill.id === 'as_redline_recall' || r.skill.id === 'as_returning_moon')) { // Redline Recall / Returning Moon: the line from it to his hand (its own way home draws none)
      const c = this.ctx.casterPos(p.attackerId); if (!c) return;
      const hk = r.skill.id === 'as_returning_moon' ? 'as_returning_moon' : 'as_redline_recall', hv = HAND[hk], side = c.x < x ? 1 : -1;
      const hx = c.x + side * hv[0], hy = c.y - c.z - hv[1];
      this.line('as-red', x, y, hx, hy, 4, 260, { tint: CRIMSON, depth: Math.max(p.y, c.y) + 3 });
      this.flash(x, y, 30, { life: 120, tint: 0xffd4d8, depth: p.y + 3 });
    } else if (leg === 'back' && r.skill.chain && r.stage === 3) { // Rising Return: a short crimson line as it is called
      const c = this.ctx.casterPos(p.attackerId); if (!c) return;
      this.line('as-red', x, y, c.x, c.y - c.z - 110, 3, 200, { tint: CRIMSON, depth: Math.max(p.y, c.y) + 3 });
    }
  }

  private stepStars(dt: number): void {
    for (const [p, a] of this.stars) {
      if (!this.ctx.live(p) && !p.done) { this.drop(p, a); continue; }
      a.t += dt; a.legT += dt;
      let x = p.x, y = p.y - p.z - LIFT;
      if (a.hand && a.t < 80 && a.leg === 'out') { const k = out(Math.min(1, a.t / 80)); x = a.hand.x + (x - a.hand.x) * k; y = a.hand.y + (y - a.hand.y) * k; } // (out of his hand onto its line)
      if (a.leg === 'park') y += Math.sin(a.legT / 70) * 2; // (hanging there, spinning)
      const spinRate = a.big ? (a.leg === 'park' ? 1.1 : 1.6) : 2.4; // deg / ms
      a.ang += spinRate * dt * (p.dx < -0.01 ? -1 : 1);
      const vx = x - a.lx, vy = y - a.ly, sp = Math.hypot(vx, vy);
      a.im.setPosition(x, y).setAngle(a.ang).setDepth(p.y + 2.1).setAlpha(Math.min(1, a.t / 30));
      a.spin?.setPosition(x, y).setAngle(a.ang * 0.6).setDepth(p.y + 2.2).setAlpha((a.leg === 'park' ? 0.35 : 0.6) * Math.min(1, a.t / 40));
      if (sp > 0.5) { // its trail along its way (back toward his hand on the way home)
        const len = Math.min(a.big ? 140 : 70, sp * (a.big ? 9 : 7));
        a.tr.setPosition(x, y).setAngle((Math.atan2(vy, vx) * 180) / Math.PI).setDisplaySize(len, a.big ? 7 : 4).setDepth(p.y + 1.9).setAlpha(0.75 * Math.min(1, a.t / 40));
      } else a.tr.setAlpha(Math.max(0, a.tr.alpha - dt / 120));
      a.lx = x; a.ly = y;
    }
  }
  private drop(p: Projectile, a: Star): void { a.im.destroy(); a.spin?.destroy(); a.tr.destroy(); this.stars.delete(p); }

  projectileEnd(p: Projectile): void {
    const a = this.stars.get(p); if (!a) return;
    const x = a.lx, y = a.ly; this.drop(p, a);
    const e = p.end ?? { x: p.x, y: p.y, reason: 'range' as const };
    if (e.reason === 'caught') { // home in his hand — or, thrown again while it was out, called back at once: it winks out there
      const c = this.ctx.casterPos(p.attackerId);
      if (!c || Math.hypot(c.x - p.x, c.y - p.y) < 60) { this.caughtAt(x, y); return; }
      this.flash(x, y, 24, { life: 100, depth: p.y + 3 });
      const side = p.x < c.x ? -1 : 1, h = HAND.stance; this.caughtAt(c.x + side * h[0], c.y - c.z - h[1]); // (he faces it)
      return;
    }
    if (!a.big && e.reason !== 'target') this.flash(x, y, 18, { life: 90, depth: p.y + 3 }); // a small star spent at its range / on cover
  }
  /** Caught: a sharp metallic glint in his hand (the "chak"). */
  private caughtAt(x: number, y: number): void {
    this.flash(x, y, 40, { life: 130 });
    for (let k = 0; k < 3; k++) { const an = rnd(0, Math.PI * 2), d = rnd(10, 22); this.spr({ name: 'as-trail', x, y, ox: 0, w: 14, h: 3, angle: (an * 180) / Math.PI, life: 140, tint: GLINT, add: true, mx: (u) => Math.cos(an) * d * out(u), my: (u) => Math.sin(an) * d * out(u), a: kf([0, 1], [1, 0]) }); }
  }

  // ------------------------------------------------------------------ on the foe

  /** A blow landed: a small sharp steel flash and two thin sparks — a crossed cut on a heavy blow and on the big star's own
   *  way home (its "chak" from the other side); a thin track up with him when it launches. No blood-red clouds. */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, big = heavy || !!hit.heavy, needle = hit.shape.kind === 'projectile' && !hit.shape.edge;
    this.flash(x + rnd(-4, 4), y + rnd(-4, 4), needle ? 34 : big ? 64 : 46, { life: big ? 170 : 130 });
    for (let k = 0; k < (needle ? 1 : 2); k++) {
      const an = rnd(-0.9, 0.9) + (Math.random() < 0.5 ? 0 : Math.PI), d = rnd(20, 36);
      this.spr({ name: 'as-trail', x, y, ox: 0, w: 22, h: 3, angle: (an * 180) / Math.PI, life: 160, tint: GLINT, add: true, mx: (u) => Math.cos(an) * d * out(u), my: (u) => Math.sin(an) * d * out(u), a: kf([0, 1], [1, 0]) });
    }
    if (big || hit.edgeBack) this.spr({ name: 'as-x', x, y, depth: TOP + 4, w: hit.edgeBack ? 34 : 58, life: 170, tint: GLINT, glow: 0.3, add: true, angle: rnd(-12, 12),
      sx: kf([0, 0.5], [0.3, 1.05, out3], [1, 1.1]), sy: kf([0, 0.5], [0.3, 1.05, out3], [1, 1.1]), a: kf([0, 1], [0.5, 0.9], [1, 0, inQ]) });
    if (crit) this.flash(x, y, 84, { life: 190 });
    if ((hit.reaction.launch ?? 0) >= 75) this.line('as-trail', x, at.y - at.z, x, at.y - at.z - 150, 5, 230, { tint: STEEL, depth: at.y + 3 }); // the cut's track up with him
    if (s.id === 'as_piercing_quarter' && !hit.edgeBack) this.ctx.punch(0.015, 120);
  }

  /** The class's Final Cut (its passive's extra blow) in his hands: one more small star off the wrist cuts across him — a
   *  short steel track and a glint where it passes (Advanced: a little bigger). PVP 3D: only its number, as the katana's. */
  extraStar(at: V3, dir: number, big = false): void {
    if ((this.ctx.scene as unknown as { a3d?: unknown }).a3d) return;
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, L = big ? 66 : 54, x0 = x - dir * L, y0 = y - 12, x1 = x + dir * L * 0.7, y1 = y + 8;
    this.line('as-trail', x0, y0, x1, y1, 3, 150, { tint: STEEL, depth: at.y + 4 });
    this.spr({ name: 'as-small', x: x0, y: y0, depth: at.y + 5, w: big ? 22 : 18, life: 120, rot: (u) => 900 * u, mx: (u) => (x1 - x0) * u, my: (u) => (y1 - y0) * u, a: kf([0, 1], [0.8, 1], [1, 0]) });
    this.flash(x, y, big ? 30 : 24, { life: 110, delay: 55, depth: at.y + 6 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
    this.stepStars(dt);
  }

  destroy(): void {
    for (const [p, a] of this.stars) this.drop(p, a);
    this.live = []; this.incoming = [];
  }
}
