// Book Mage skill effects, built from separate painted pieces (tools/skills/kit.py mage → one atlas, MAGE_KIT) moved in code,
// like the samurai's: bolts fly with their own light, ice grows out of the floor and shatters, lightning is stretched between
// two points, sigils turn on the floor, pages fold into paper cranes. Presentation only — gameplay never reads any of it;
// timing comes from the cast, so every client draws the same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun, Trap } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V2, V3 } from './HitGeometry';
import { mageQuad, type MageShader } from './MageShaders';
import { SpaceWarp } from './SpaceWarp';

export const MAGE_KIT = 'mage-kit';
export const MAGE_KIT_URL = 'assets/final/skills/book_mage/kit/';
/** Painted animated effects (GPT sheets on black, drawn additive): key → [file, frame w, frame h, frames]. */
export const MAGE_SHEETS: Record<string, [string, number, number, number]> = {
  'mfx-pillar': ['astral_pillar.png', 384, 384, 16],
  'mfx-storm': ['arcane_lightning.png', 384, 384, 16],
  'mfx-nova': ['frost_nova.png', 448, 448, 16],
  'mfx-bolt': ['arcane_bolt.png', 384, 384, 16],
  'mfx-clock': ['time_collapse.png', 448, 448, 16],
  'mfx-sfield': ['storm_field.png', 320, 410, 16],
  'mfx-spikes': ['glacial_spikes.png', 384, 384, 16], // a line of ice bursting up left → right, standing, shattering (ground 75% down, from 10% to 90% across) // 0-7 the vortex (loop), 8-11 a strike from the sky, 12-15 the final burst (ground centre 72% down) // the clock draws, sweeps, stops, cracks, collapses, blasts (centre 55% down) // 0-3 bolt in flight (loop, orb at 70% across), 4-7 the lance, 8-11 its hit, 12-15 the cast flash at the hand // a ring of ice erupting round the caster (ground centre at 62% down) // 0-7 bolts (edge to edge), 8-11 strike, 12-15 hand orb (loop)
};
const TOP = 100000, GROUND = 2, SQUASH = 0.42;
const ARCANE = 0x6fb8ff, VIOLET = 0xa98cff, ICE = 0xcff6ff;
/** The weave's rune pieces, in the order they are woven. */
const RUNES = ['rune_cyan', 'rune_ice', 'rune_violet', 'rune_gold', 'rune_blue'];

export interface MageCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  hand(id: string): { x: number; y: number } | null;
  punch(amount?: number, ms?: number): void;
  darken(ms: number, alpha: number): void;
  ultimateStage(r: CastRun): void;
  targetPos?(id: string): V3 | null;
  /** Camera shake (ms, intensity), a beat of hit-stop (ms), a soft full-screen flash of light. */
  shake?(ms: number, i: number): void;
  hitStop?(ms: number): void;
  flash?(color: number, alpha: number, ms: number): void;
}

/** Procedural light textures (made once): a soft dot, a streak, a thin ring, a four-pointed flare. */
function ensureLight(s: Phaser.Scene): void {
  const mk = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    if (s.textures.exists(key)) return;
    const t = s.textures.createCanvas(key, w, h); if (!t) return;
    draw(t.getContext()); t.refresh();
  };
  mk('mg-dot', 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  mk('mg-streak', 128, 16, (c) => { const g = c.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 8); c.lineTo(120, 2); c.quadraticCurveTo(128, 8, 120, 14); c.closePath(); c.fill(); });
  mk('mg-ring', 256, 256, (c) => { for (const [w, a] of [[14, 0.12], [8, 0.3], [3, 1]] as const) { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.beginPath(); c.arc(128, 128, 116, 0, Math.PI * 2); c.stroke(); } });
  mk('mg-flare', 128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g;
    for (const [w, h] of [[128, 10], [10, 128], [70, 6], [6, 70]] as const) { c.save(); c.translate(64, 64); if (w === 70 || w === 6) c.rotate(Math.PI / 4); c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    const d = c.createRadialGradient(64, 64, 0, 64, 64, 18); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = d; c.fillRect(0, 0, 128, 128); });
}
type Burst = { n: number; speed: [number, number]; life: [number, number]; scale: [number, number]; tint: number[]; gravity?: number; angle?: [number, number]; key?: string; frame?: string | string[]; depth?: number; spin?: boolean; drag?: number; add?: boolean };

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out: Ease = (u) => 1 - (1 - u) * (1 - u), out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
type Key = [number, number, Ease?];
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Frame at time t from [frame, ms] keys (linear between keys). */
const keyFrame = (K: [number, number][], t: number): number => { for (let i = 1; i < K.length; i++) if (t <= K[i][1]) { const [f0, t0] = K[i - 1], [f1, t1] = K[i]; return f0 + ((f1 - f0) * (t - t0)) / Math.max(1, t1 - t0); } return K[K.length - 1][0]; };
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);
/** On-screen angle (deg) of a direction along the floor (depth is foreshortened). */
const screenAng = (dx: number, dy: number) => Math.atan2(dy * 0.5, dx) * (180 / Math.PI);
type Pt = { x: number; y: number; d: number };

interface Spr {
  name: string; x?: number; y?: number; depth?: number; w: number; h?: number;
  delay?: number; life: number;
  ox?: number; oy?: number; angle?: number; flipX?: boolean; flipY?: boolean;
  add?: boolean; glow?: number; tint?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number;
  follow?: () => Pt | null; dz?: number;
  run?: CastRun;
  /** ends early when this returns false */
  alive?: () => boolean;
}
interface Live { t: number; step(dt: number, t: number): boolean }
interface Bolt { im: Phaser.GameObjects.Image; gl: Phaser.GameObjects.Image; t: number; trail: number; kind: 'arcane' | 'frost' | 'storm' | 'crane' | 'spike' }

export class MageFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private bolts = new Map<Projectile, Bolt>();
  /** Runes of the Spell Weave circling each caster. */
  private weaves = new Map<string, { imgs: Phaser.GameObjects.Image[]; t: number; n: number }>();
  /** Effects that last as long as a buff of a caster (cleared at death). */
  private auras = new Map<string, Set<{ stop(): void }>>();
  private wards = new Map<string, { stop(): void }>();
  private beams = new Map<string, { im: Phaser.GameObjects.Image; a: Phaser.GameObjects.Image; b: Phaser.GameObjects.Image; seen: number }>();
  private trapArt = new Map<Trap, { stop(): void }>();

  private warp: SpaceWarp;
  private quads = new Set<Phaser.GameObjects.Shader>();
  constructor(private ctx: MageCtx) { this.warp = new SpaceWarp(ctx.scene, () => ctx.cam()); }

  get ready(): boolean { return this.ctx.scene.textures.exists(MAGE_KIT); }

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  private later(ms: number, fn: () => void, run?: CastRun): void {
    this.add({ t: 0, step: (_dt, t) => { if (t < ms) return true; if (!this.broken(run)) fn(); return false; } });
  }
  private broken(r?: CastRun): boolean { return !!r && r.phase === 'done' && !r.fired.size; }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** A point at the caster (dx forward, dz up), following him. */
  private at(id: string, side: number, dx: number, dz: number): () => Pt | null {
    return () => { const c = this.ctx.casterPos(id); return c ? { x: c.x + side * dx, y: c.y - c.z - dz, d: c.y } : null; };
  }

  private spr(o: Spr): Phaser.GameObjects.Image | null {
    const s = this.ctx.scene;
    if (!s.textures.exists(MAGE_KIT)) return null;
    const fr = s.textures.getFrame(MAGE_KIT, o.name); if (!fr) return null;
    const fw = fr.cutWidth || fr.width, fh = fr.cutHeight || fr.height;
    const bx = o.w / fw, by = (o.h ?? (o.w * fh) / fw) / fh;
    const mk = (glow: boolean) => {
      const im = s.add.image(o.x ?? 0, o.y ?? 0, MAGE_KIT, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlip(!!o.flipX, !!o.flipY).setVisible(false)
        .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    let shown = false;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (!shown) { shown = true; if (this.broken(o.run)) { im.destroy(); gl?.destroy(); return false; } }
      if (o.alive && !o.alive()) { im.destroy(); gl?.destroy(); return false; }
      const u = Math.min(1, e / o.life);
      let x = o.x ?? 0, y = o.y ?? 0, d = o.depth ?? TOP;
      if (o.follow) { const p = o.follow(); if (!p) { im.destroy(); gl?.destroy(); return false; } x = p.x; y = p.y; d = p.d + (o.dz ?? 3); }
      x += o.mx?.(u) ?? 0; y += o.my?.(u) ?? 0;
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0);
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.04, sy * 1.04).setAngle(ang).setDepth(d + 0.01).setAlpha(al * o.glow!);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
    return im;
  }

  /** A piece lying on the floor (drawn from above): flattened into the floor's perspective, turning in its plane. */
  private floor(name: string, x: number, y: number, w: number, life: number, o: { a?: (u: number) => number; s?: (u: number) => number; spin?: number; angle?: number;
    depth?: number; delay?: number; add?: boolean; glow?: number; squash?: number; run?: CastRun; tint?: number; follow?: () => { x: number; y: number } | null; alive?: () => boolean } = {}): { stop(): void } {
    const s = this.ctx.scene, stop = { stop: () => { dead = true; } };
    let dead = false;
    if (!s.textures.exists(MAGE_KIT)) return stop;
    const fr = s.textures.getFrame(MAGE_KIT, name); if (!fr) return stop;
    const mk = (glow: boolean) => {
      const im = s.add.image(0, 0, MAGE_KIT, name).setDisplaySize(w, (w * fr.height) / fr.width).setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    const box = s.add.container(x, y, gl ? [im, gl] : [im]).setScale(1, o.squash ?? SQUASH).setDepth(o.depth ?? GROUND + 2).setVisible(false);
    const k0 = im.scaleX, k1 = im.scaleY;
    let shown = false, fade = -1;
    this.add({ t: 0, step: (dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (!shown) { shown = true; if (this.broken(o.run)) { box.destroy(); return false; } box.setVisible(true); }
      if ((dead || (o.alive && !o.alive())) && fade < 0) fade = 0;
      const u = Math.min(1, e / life), k = o.s?.(u) ?? 1, ang = (o.angle ?? 0) + (o.spin ?? 0) * (e / 1000);
      if (o.follow) { const p = o.follow(); if (p) box.setPosition(p.x, p.y); }
      im.setScale(k0 * k, k1 * k).setAngle(ang); gl?.setScale(k0 * k * 1.03, k1 * k * 1.03).setAngle(ang).setAlpha(o.glow ?? 0);
      let al = Math.max(0, Math.min(1, o.a?.(u) ?? 1));
      if (fade >= 0) { fade += dt; al *= Math.max(0, 1 - fade / 220); if (fade >= 220) { box.destroy(); return false; } }
      box.setAlpha(al);
      if (u >= 1) { box.destroy(); return false; }
      return true;
    } });
    return stop;
  }

  /** A burst / spark: pops out, spreads a little, fades. */
  private pop(name: string, x: number, y: number, size: number, o: { depth?: number; life?: number; glow?: number; angle?: number; delay?: number; add?: boolean; run?: CastRun; tint?: number } = {}): void {
    this.spr({ name, x, y, depth: o.depth ?? TOP + 4, w: size, life: o.life ?? 260, delay: o.delay, add: o.add ?? true, run: o.run, tint: o.tint, angle: o.angle ?? rnd(-20, 20), glow: o.glow ?? 0.5,
      sx: kf([0, 0.4], [0.2, 1.05, out3], [1, 1.2]), sy: kf([0, 0.4], [0.2, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
  }
  /** Lightning (or a rune beam) stretched from a to b (screen points). */
  private bolt(name: string, a: { x: number; y: number }, b: { x: number; y: number }, o: { life?: number; thick?: number; delay?: number; depth?: number; tint?: number } = {}): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 4) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI), th = o.thick ?? 70, life = o.life ?? 220;
    this.spr({ name, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, depth: o.depth ?? TOP + 3, w: len * 1.05, h: th, angle: ang, add: true, glow: 0.6, life, delay: o.delay, tint: o.tint,
      sy: (u) => (0.8 + 0.4 * Math.abs(Math.sin(u * 23))) * (1 - 0.6 * u), a: kf([0, 1], [0.5, 0.9], [1, 0, inQ]) });
  }
  /** Small things drifting up from a point (pages, runes, motes). */
  private drift(names: string[], x: number, y: number, n: number, spread: number, o: { depth?: number; life?: number; up?: number; delay?: number; size?: [number, number]; add?: boolean } = {}): void {
    for (let i = 0; i < n; i++) {
      const dx = rnd(-spread, spread), up = (o.up ?? 70) * rnd(0.6, 1.2), life = (o.life ?? 900) * rnd(0.7, 1.3), spin = rnd(-240, 240), [s0, s1] = o.size ?? [14, 26];
      this.spr({ name: names[i % names.length], x: x + dx, y, depth: o.depth ?? TOP + 2, w: rnd(s0, s1), life, delay: (o.delay ?? 0) + rnd(0, 120), angle: rnd(0, 360), add: o.add,
        mx: (u) => dx * 0.3 * u + Math.sin(u * 6 + i) * 8, my: (u) => -up * out(u), rot: (u) => spin * u, a: kf([0, 0], [0.12, 1], [0.7, 0.9], [1, 0]) });
    }
  }

  // ------------------------------------------------------------------ light and particles (the juice)

  /** A one-shot spray of particles (light dots by default, or kit pieces), fading as they slow. */
  private burst(x: number, y: number, o: Burst): void {
    const s = this.ctx.scene; ensureLight(s);
    const key = o.key ?? (o.frame ? MAGE_KIT : 'mg-dot');
    if (key === MAGE_KIT && !this.ready) return;
    const em = s.add.particles(x, y, key, {
      ...(o.frame ? { frame: o.frame } : {}), emitting: false, speed: { min: o.speed[0], max: o.speed[1] }, lifespan: { min: o.life[0], max: o.life[1] },
      scale: { start: o.scale[1], end: o.scale[0] }, alpha: { start: 1, end: 0 }, tint: o.tint, gravityY: o.gravity ?? 0, angle: { min: o.angle?.[0] ?? 0, max: o.angle?.[1] ?? 360 },
      rotate: o.spin ? { min: 0, max: 360 } : 0, blendMode: o.add === false ? 'NORMAL' : 'ADD', ...(o.drag ? { accelerationX: 0, maxVelocityX: 2000 } : {}),
    });
    em.setDepth(o.depth ?? TOP + 5);
    em.explode(o.n, x, y);
    s.time.delayedCall(o.life[1] + 60, () => em.destroy());
  }
  /** A burst of light: a soft white core and a coloured bloom. */
  private glow(x: number, y: number, size: number, tint: number, life = 220, o: { depth?: number; delay?: number; follow?: () => Pt | null; alpha?: number; squash?: number } = {}): void {
    ensureLight(this.ctx.scene);
    const al = o.alpha ?? 1;
    for (const [k, t, a] of [[1, tint, 0.7 * al], [0.4, 0xffffff, 0.55 * al]] as const)
      this.img('mg-dot', { x, y, w: size * k, h: size * k * (o.squash ?? 1), tint: t, life, delay: o.delay, depth: (o.depth ?? TOP + 4) + (t === 0xffffff ? 0.01 : 0), follow: o.follow,
        sx: kf([0, 0.5], [0.25, 1.05, out3], [1, 1.25]), sy: kf([0, 0.5], [0.25, 1.05, out3], [1, 1.25]), a: kf([0, a], [0.35, a * 0.9], [1, 0, inQ]) });
  }
  /** A thin ring of light expanding (on the floor when squash < 1). */
  private ringOut(x: number, y: number, w: number, tint: number, life = 360, o: { squash?: number; depth?: number; delay?: number; thick?: number } = {}): void {
    ensureLight(this.ctx.scene);
    this.img('mg-ring', { x, y, w, h: w * (o.squash ?? 1), tint, life, delay: o.delay, depth: o.depth ?? TOP + 3,
      sx: kf([0, 0.15], [1, 1, out3]), sy: kf([0, 0.15], [1, 1, out3]), a: kf([0, 1], [0.5, 0.75], [1, 0, inQ]) });
  }
  private flare(x: number, y: number, size: number, tint: number, life = 260, o: { depth?: number; delay?: number; follow?: () => Pt | null; rot?: number } = {}): void {
    ensureLight(this.ctx.scene);
    this.img('mg-flare', { x, y, w: size, tint, life, delay: o.delay, depth: o.depth ?? TOP + 5, follow: o.follow,
      sx: kf([0, 0.2], [0.2, 1.15, out3], [1, 0.4]), sy: kf([0, 0.2], [0.2, 1.15, out3], [1, 0.4]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]), rot: (u) => (o.rot ?? 60) * u });
  }
  /** A procedural texture image with the piece system's motion (additive). */
  private img(key: string, o: Omit<Spr, 'name'> & { tint?: number }): void {
    const s = this.ctx.scene;
    const im = s.add.image(o.x ?? 0, o.y ?? 0, key).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
    if (o.tint !== undefined) im.setTint(o.tint);
    const bx = o.w / im.width, by = (o.h ?? o.w * (im.height / im.width)) / im.height;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0); if (e < 0) return true;
      const u = Math.min(1, e / o.life);
      let x = o.x ?? 0, y = o.y ?? 0, d = o.depth ?? TOP;
      if (o.follow) { const p = o.follow(); if (!p) { im.destroy(); return false; } x = p.x; y = p.y; d = p.d + (o.dz ?? 3); }
      im.setVisible(true).setPosition(x + (o.mx?.(u) ?? 0), y + (o.my?.(u) ?? 0)).setScale((o.sx?.(u) ?? 1) * bx, (o.sy?.(u) ?? 1) * by).setAngle((o.angle ?? 0) + (o.rot?.(u) ?? 0))
        .setAlpha(Math.max(0, Math.min(1, o.a?.(u) ?? 1))).setDepth(d);
      if (u >= 1) { im.destroy(); return false; }
      return true;
    } });
  }
  /** Lightning drawn as a jagged line between two points: re-forked every 40 ms while it lasts (it flickers like real lightning). */
  private zap(a: { x: number; y: number }, b: { x: number; y: number }, o: { life?: number; width?: number; tint?: number; depth?: number; delay?: number; forks?: number } = {}): void {
    const s = this.ctx.scene, g = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(o.depth ?? TOP + 4).setVisible(false);
    const life = o.life ?? 240, w = o.width ?? 4, tint = o.tint ?? 0x7fd8ff;
    let next = -1;
    const draw = (al: number) => {
      g.clear();
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(4, Math.round(L / 22)), nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1);
      const pts = [a]; for (let i = 1; i < n; i++) { const t = i / n, off = rnd(-1, 1) * Math.min(26, L * 0.12) * Math.sin(t * Math.PI); pts.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off }); } pts.push(b);
      const line = (pp: { x: number; y: number }[], width: number, col: number, alpha: number) => { g.lineStyle(width, col, alpha); g.beginPath(); g.moveTo(pp[0].x, pp[0].y); for (const p of pp.slice(1)) g.lineTo(p.x, p.y); g.strokePath(); };
      line(pts, w * 5, tint, 0.18 * al); line(pts, w * 2.2, tint, 0.55 * al); line(pts, w, 0xffffff, al);
      for (let f = 0; f < (o.forks ?? 2); f++) { const i = 1 + Math.floor(Math.random() * (pts.length - 2)), p = pts[i], ang = Math.atan2(b.y - a.y, b.x - a.x) + rnd(-1.1, 1.1), len = rnd(18, 44);
        line([p, { x: p.x + Math.cos(ang) * len * 0.5 + rnd(-6, 6), y: p.y + Math.sin(ang) * len * 0.5 + rnd(-6, 6) }, { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len }], w * 0.7, 0xdff6ff, 0.7 * al); }
    };
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0); if (e < 0) return true;
      g.setVisible(true);
      if (e >= life) { g.destroy(); return false; }
      if (e >= next) { next = e + 40; draw(1 - Math.max(0, (e / life - 0.5) * 2)); }
      return true;
    } });
  }
  private shake(ms: number, i: number): void { this.ctx.shake?.(ms, i); }

  // ------------------------------------------------------------------ GPU energy (MageShaders) and bent space (SpaceWarp)

  /** One shader quad on the effect clock: drive(u, ms, quad) every frame for `life` ms, then removed. */
  private gpu(kind: MageShader, x: number, y: number, w: number, h: number, life: number, drive: (u: number, ms: number, q: Phaser.GameObjects.Shader) => void,
    o: { delay?: number; depth?: number; angle?: number; ox?: number; oy?: number; seed?: number; uA?: number; run?: CastRun; follow?: () => { x: number; y: number } | null } = {}): void {
    const start = () => {
      const q = mageQuad(this.ctx.scene, kind, x, y, w, h, o.seed); if (!q) return;
      this.quads.add(q);
      q.setDepth(o.depth ?? TOP + 6).setAngle(o.angle ?? 0).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
      if (o.uA !== undefined) q.setUniform('uA.value', o.uA);
      const tick = (t: number) => { const f = o.follow?.(); if (f) q.setPosition(f.x, f.y); drive(Math.min(1, t / life), t, q); };
      tick(0);
      this.add({ t: 0, step: (_dt, t) => { if (t >= life || !q.active) { q.destroy(); this.quads.delete(q); return false; } tick(t); return true; } });
    };
    if (o.delay) this.later(o.delay, start, o.run); else start();
  }
  private static EL: Record<string, number> = { arcane_bolt_frost: 1, glacial_spikes: 1, frost_nova: 1, arcane_bolt_storm: 2, storm_field: 2, lightning_chain: 2, elemental_ascension: 1 };
  private static U(q: Phaser.GameObjects.Shader, k: 'uP' | 'uE' | 'uA', v: number): void { q.setUniform(`${k}.value`, v); }
  /** Lightning between two screen points (a white core that re-forms, violet-blue glow, forks). */
  private arc(a: { x: number; y: number }, b: { x: number; y: number }, o: { life?: number; thick?: number; delay?: number; depth?: number } = {}): void {
    const L = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, life = o.life ?? 220;
    const sc = this.ctx.scene;
    if (sc.textures.exists('mfx-storm')) { // the painted bolts: two shapes flicker in turn, then it fades
      const start = () => {
        const h = Math.min(260, Math.max(70, L * 0.55)) * Math.min(1.4, (o.thick ?? 2.4) / 3);
        const im = sc.add.image(a.x, a.y, 'mfx-storm', Math.floor(Math.random() * 8)).setOrigin(0, 0.5).setAngle(ang).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(o.depth ?? TOP + 7).setDisplaySize(L, h);
        const f1 = Math.floor(Math.random() * 8); let last = -1;
        this.add({ t: 0, step: (_dt, t) => { if (t >= life || !im.active) { im.destroy(); return false; } const k = Math.floor(t / 60);
          if (k !== last) { last = k; im.setFrame(k % 2 ? f1 : (f1 + 3) % 8); im.setFlipY(Math.random() < 0.5); }
          im.setAlpha(t < life * 0.5 ? 1 : (1 - t / life) * 2); return true; } });
      };
      if (o.delay) this.later(o.delay, start); else start();
      return;
    }
    this.gpu('bolt', a.x, a.y, L, Math.max(70, Math.min(170, L * 0.38)), life, (u, _ms, q) => MageFx.U(q, 'uP', u < 0.12 ? 1.3 : (1 - u) * (0.75 + 0.35 * Math.random())),
      { angle: ang, ox: 0, oy: 0.5, uA: o.thick ?? 2.4, delay: o.delay, depth: o.depth ?? TOP + 7 });
  }
  /** A magic circle drawn round, held, then burnt away: on the floor (squashed) or standing upright. el 0 arcane, 1 frost, 2 storm. */
  private circle(x: number, y: number, size: number, el: number, life: number, o: { delay?: number; upright?: boolean; run?: CastRun; follow?: () => { x: number; y: number } | null; depth?: number; draw?: number; angle?: number } = {}): void {
    const draw = o.draw ?? Math.min(260, life * 0.4), burn = Math.min(320, life * 0.35);
    this.gpu('circle', x, y, size, size * (o.upright ? 1 : SQUASH), life, (_u, ms, q) => { MageFx.U(q, 'uP', Math.min(1, ms / draw)); MageFx.U(q, 'uE', ms < life - burn ? 0 : (ms - life + burn) / burn); },
      { uA: el + (o.upright ? 10 : 0), delay: o.delay, run: o.run, follow: o.follow, depth: o.depth ?? (o.upright ? TOP + 5 : GROUND + 3), angle: o.angle });
  }
  /** A billow of smoke: dark void (el 0) or frost mist (el 1). */
  private smoke(x: number, y: number, size: number, el: number, life: number, o: { delay?: number; squash?: number; depth?: number } = {}): void {
    this.gpu('smoke', x, y, size, size * (o.squash ?? 1), life, (u, _ms, q) => { MageFx.U(q, 'uP', out3(Math.min(1, u * 1.6))); MageFx.U(q, 'uE', u < 0.35 ? 0 : (u - 0.35) / 0.65); },
      { uA: el, delay: o.delay, depth: o.depth ?? TOP + 4 });
  }
  /** A painted sheet played once (additive): its frames spread over `life` ms; (ox, oy) = the anchor inside a frame. */
  private sheet(key: string, x: number, y: number, size: number, life: number, o: { ox?: number; oy?: number; delay?: number; depth?: number; flipX?: boolean; alpha?: number; sx?: number; sy?: number; follow?: () => { x: number; y: number } | null; split?: [number, number]; run?: CastRun; frames?: [number, number]; loop?: number; tint?: number; keys?: [number, number][]; angle?: number } = {}): void {
    const sc = this.ctx.scene; if (!sc.textures.exists(key)) return;
    const f0 = o.frames?.[0] ?? 0, n = o.frames?.[1] ?? MAGE_SHEETS[key]?.[3] ?? 16;
    const start = () => {
      const im = sc.add.image(x, y, key, f0).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(o.depth ?? TOP + 6).setFlipX(!!o.flipX).setAlpha(o.alpha ?? 1);
      if (o.tint !== undefined) im.setTint(o.tint);
      if (o.angle) im.setAngle(o.angle);
      im.setDisplaySize(size * (o.sx ?? 1), size * (o.sy ?? 1));
      this.add({ t: 0, step: (_dt, t) => { if (t >= life || !im.active) { im.destroy(); return false; } const f = o.follow?.(); if (f) im.setPosition(f.x, f.y); const K = o.keys, sp = o.split, fr = K ? keyFrame(K, t) : sp ? (t < sp[1] ? (t / sp[1]) * sp[0] : sp[0] + ((t - sp[1]) / (life - sp[1])) * (n - sp[0])) : (t / life) * n;
        const k = o.loop ? Math.floor(t / o.loop) % n : Math.min(n - 1, Math.floor(fr));
        if (o.loop) im.setAlpha((o.alpha ?? 1) * Math.min(1, t / 80, (life - t) / 100));
        im.setFrame(f0 + k); return true; } });
    };
    if (o.delay) this.later(o.delay, start, o.run); else start();
  }
  /** A starburst of light (additive). */
  private star(x: number, y: number, size: number, life = 260, o: { rays?: number; delay?: number; depth?: number } = {}): void {
    this.gpu('star', x, y, size, size, life, (u, _ms, q) => MageFx.U(q, 'uP', u), { uA: o.rays ?? 8, delay: o.delay, depth: o.depth ?? TOP + 8 });
  }

  // ------------------------------------------------------------------ cast timeline

  cast(r: CastRun): void {
    if (!this.ready) return;
    const s = r.skill, T = r.timings, me = this.me(r), side = sideOf(r), hand = this.at(r.attackerId, side, 22, 70);
    const own = !['astral_burst', 'frost_nova', 'lightning_chain', 'blink'].includes(s.id) && !(s.slot === 0 && r.stage !== 2);
    if (own) this.circle(me.x, me.y, s.slot === 7 ? 420 : s.slot === 0 ? 200 : 260, MageFx.EL[s.id] ?? 0, T.startup + T.active + 260, { run: r, draw: Math.max(120, T.startup) }); // every spell is written as a circle
    switch (s.id) {
      case 'arcane_bolt': case 'arcane_bolt_arcane': case 'arcane_bolt_frost': case 'arcane_bolt_storm': this.boltCharge(r); break;
      case 'arcane_wave': this.spr({ name: 'spark_arc', w: 50, life: T.startup + 80, follow: hand, add: true, glow: 0.5, run: r, sx: kf([0, 0.3], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) }); break;
      case 'astral_burst': this.starHand(r); break;
      case 'frost_nova': this.novaCharge(r); break;
      case 'lightning_chain': this.stormCharge(r); break;
      case 'storm_field': if (!this.ctx.scene.textures.exists('mfx-sfield')) this.floor('storm_disc', r.place?.x ?? me.x, r.place?.y ?? me.y, 280, T.startup + T.active + 300, { add: true, glow: 0.6, spin: 20, run: r, a: kf([0, 0], [0.15, 0.5], [0.85, 0.9], [1, 0]), s: kf([0, 0.6], [0.2, 1, out3]) }); break;
      case 'time_collapse': this.timeCollapse(r); break;
      case 'blink': this.blinkOut(me, side); break;
      case 'glacial_spikes': this.drift(['snowflake'], me.x + side * 20, me.y - me.z - 30, 5, 24, { life: T.startup + 200, up: 40, size: [10, 18], add: true }); break;
      case 'chrono_haste': this.floor('sig_clock', me.x, me.y, 150, T.startup + 600, { add: true, glow: 0.6, spin: 360, run: r, a: kf([0, 0], [0.2, 1], [0.8, 1], [1, 0]), s: kf([0, 0.4], [0.3, 1, out3]) }); break;
      case 'levity_field': if (r.place) this.floor('sig_star', r.place.x, r.place.y, 320, T.startup + 2700, { add: true, glow: 0.5, spin: -30, run: r, a: kf([0, 0], [0.08, 0.85], [0.9, 0.85], [1, 0]), s: kf([0, 0.5], [0.1, 1, out3]) }); break;
      case 'origami_flock': this.spr({ name: 'page_group', w: 90, life: T.startup + 120, follow: this.at(r.attackerId, side, 26, 66), run: r, sx: kf([0, 0.3], [1, 1.2, out3]), sy: kf([0, 0.3], [1, 1.2, out3]), a: kf([0, 1], [0.8, 1], [1, 0]), rot: (u) => side * 60 * u }); break;
      case 'chrono_sigil': this.floor('sig_clock', me.x, me.y, 130, T.startup + 5000, { add: true, glow: 0.55, spin: -50, run: r, a: kf([0, 0], [0.04, 0.95], [0.94, 0.9], [1, 0]), s: kf([0, 0.3], [0.05, 1, out3]) }); break;
      case 'arcane_ward': this.drift(['rune_cyan', 'rune_blue'], me.x, me.y - me.z - 10, 8, 40, { life: T.startup + 200, up: 90, size: [16, 24], add: true }); break;
      case 'arcane_gate': if (r.place) this.floor('sig_disk', r.place.x, r.place.y, 110, T.startup + 240, { add: true, glow: 0.6, spin: 200, run: r, a: kf([0, 0], [0.3, 1], [1, 1]), s: kf([0, 0.3], [1, 1, out3]) }); break;
      case 'paper_curse': this.spr({ name: 'page_cocoon', w: 60, life: T.startup + 100, follow: this.at(r.attackerId, side, 28, 64), run: r, a: kf([0, 0], [0.3, 1], [1, 0]), rot: (u) => 180 * u }); break;
      case 'elemental_ascension': {
        this.spr({ name: 'frost_mist', w: 150, life: T.startup + 400, follow: this.at(r.attackerId, side, 0, 20), dz: -2, add: true, run: r, sx: kf([0, 0.4], [0.6, 1.2, out3]), a: kf([0, 0], [0.3, 0.8], [1, 0]) });
        for (let i = 0; i < 4; i++) this.later(i * T.startup / 4, () => { const c = this.me(r); this.bolt('bolt_diag', { x: c.x + rnd(-60, 60), y: c.y - c.z - 180 }, { x: c.x + rnd(-20, 20), y: c.y - c.z - 40 }, { thick: 60, life: 180 }); }, r);
        break;
      }
    }
    if (s.slot === 7) this.ctx.ultimateStage(r);
  }

  /** The release (active start). */
  active(r: CastRun): void {
    if (!this.ready) return;
    const s = r.skill, me = this.me(r), side = sideOf(r), T = r.timings;
    switch (s.id) {
      case 'arcane_wave': this.wave(r); break;
      case 'frost_nova': this.nova(r); break;
      case 'blink': this.later(T.active, () => this.blinkIn(this.me(r), side), r); break;
      case 'glacial_spikes': this.spikes(r); break;
      case 'chrono_haste': this.ripple(me.x, me.y - me.z - 40, 200, VIOLET); this.aura(r.attackerId, 'haste', 120000); break;
      case 'levity_field': if (r.place) this.levity(r.place, 2500); break;
      case 'arcane_ward': this.ward(r.attackerId, 8000); break;
      case 'elemental_ascension': this.aura(r.attackerId, 'ascension', 20000); this.ctx.punch(0.006, 200); break;
      case 'storm_field': if (r.place && this.ctx.scene.textures.exists('mfx-sfield')) { this.sheet('mfx-sfield', r.place.x, r.place.y, 420, T.active + 200, { frames: [0, 8], loop: 70, oy: 0.72, sy: 1.28, depth: GROUND + 4, run: r }); this.ctx.darken(T.active, 0.25); } else if (r.place) this.spr({ name: 'storm_orb', x: r.place.x, y: r.place.y - 60, depth: r.place.y + 2, w: 90, life: T.active, add: true, glow: 0.7, run: r, sx: (u) => 0.9 + 0.15 * Math.sin(u * 30), sy: (u) => 0.9 + 0.15 * Math.cos(u * 27), a: kf([0, 0], [0.05, 1], [0.92, 1], [1, 0]), rot: (u) => 900 * u }); break;
    }
  }

  /** One hit of a cast as it fires. */
  hit(r: CastRun, i: number, o: V3): void {
    if (!this.ready) return;
    const s = r.skill, h = r.hits[i];
    if (s.id === 'storm_field' && r.place && this.ctx.scene.textures.exists('mfx-sfield')) { // the painted strike on every pulse, the burst on the last
      const p = r.place, last = i === r.hits.length - 1;
      this.sheet('mfx-sfield', p.x, p.y, 420, last ? 520 : 320, { frames: last ? [12, 4] : [8, 4], oy: 0.72, sy: 1.28, depth: p.y + 4 });
      this.warp.ring(p.x, p.y, { r1: last ? 340 : 220, life: last ? 460 : 300, s: last ? 34 : 18, width: 26, squash: SQUASH });
      this.shake(last ? 200 : 90, last ? 0.01 : 0.004); if (last) { this.ctx.hitStop?.(80); this.ctx.punch(0.02, 200); }
    } else if (s.id === 'storm_field' && r.place) { // a bolt out of the sky on every pulse
      const p = r.place;
      for (let k = 0; k < 3; k++) this.later(k * 60, () => { const x = p.x + rnd(-90, 90), y = p.y + rnd(-30, 30); this.bolt('bolt_diag', { x: x - 60, y: y - 260 }, { x, y: y - 10 }, { thick: 70, life: 200 }); this.pop('bolt_impact', x, y - 20, 90, { depth: y + 3, life: 200 }); }, r);
      if (i === 3) { this.ripple(p.x, p.y - 4, 300, ARCANE); this.ctx.punch(0.005, 160); }
    }
    if (s.id === 'astral_burst') this.starLaunch(r, o);
    if (s.id === 'time_collapse' && i === 1 && r.place) { this.ripple(r.place.x, r.place.y - 60, 420, VIOLET); this.ctx.darken(1100, 0.5); }
    if (s.id === 'time_collapse' && i === 2 && r.place) this.timeBlast(r.place);
    void h;
  }

  /** Chain lightning from o to the foe it struck (each arc). */
  private chainLast = new Map<string, { x: number; y: number; z: number }>();
  chain(r: CastRun, o: V3, target: { x: number; y: number; z: number } | null, _from: { x: number; y: number; z: number } | null): void {
    if (!this.ready) return;
    const from = this.chainLast.get(r.castId) ?? null; // each arc leaps on from the foe the last one struck
    if (target) { this.chainLast.set(r.castId, { ...target }); if (this.chainLast.size > 40) this.chainLast.delete(this.chainLast.keys().next().value!); }
    const hand = this.ctx.hand(r.attackerId);
    const a = from ? { x: from.x, y: from.y - from.z - 50 } : hand ?? { x: o.x + r.aim.x * 30, y: o.y + r.aim.y * 30 - o.z - 70 };
    const b = target ? { x: target.x, y: target.y - target.z - 50 } : { x: o.x + r.aim.x * 300, y: o.y + r.aim.y * 300 - o.z - 50 };
    const last = r.hits.length - 1, fired = r.fired.size - 1, big = fired <= 0 || fired === last;
    this.arc(a, b, { life: big ? 300 : 230, thick: big ? 4.2 : 3 });
    this.arc(a, b, { life: 170, thick: 1.8, delay: 40 });
    if (!target) return;
    if (this.ctx.scene.textures.exists('mfx-storm')) this.sheet('mfx-storm', b.x, b.y, big ? 230 : 160, 280, { frames: [8, 4] }); else this.star(b.x, b.y, big ? 160 : 100, 200, { rays: 8 });
    this.warp.ring(b.x, b.y, { r1: big ? 150 : 90, life: big ? 300 : 220, s: big ? 18 : 10, width: 18 });
    for (let k = 0; k < (big ? 2 : 1); k++) { const ang = rnd(0, Math.PI * 2), l = rnd(50, big ? 110 : 75); this.arc(b, { x: b.x + Math.cos(ang) * l, y: b.y + Math.sin(ang) * l * 0.8 }, { life: rnd(90, 160), thick: 1.3, delay: k * 14 }); }
    this.burst(b.x, b.y, { n: big ? 22 : 12, speed: [160, 480], life: [180, 420], scale: [0.04, 0.18], tint: [0xffffff, 0x9fe4ff, 0xb9a2ff], gravity: 260 });
    this.ctx.flash?.(0xc8d8ff, big ? 0.06 : 0.03, 80);
    this.shake(big ? 120 : 70, big ? 0.006 : 0.003);
    if (fired === last) { // the finish: a bolt out of the sky onto the foe
      this.arc({ x: b.x + rnd(-50, 50), y: b.y - 480 }, b, { life: 340, thick: 5 });
      this.circle(target.x, target.y, 300, 2, 700, { draw: 90 });
      this.gpu('nova', target.x, target.y, 560, 560 * SQUASH, 560, (u, _ms, q) => { MageFx.U(q, 'uP', out3(u)); MageFx.U(q, 'uE', u > 0.4 ? (u - 0.4) / 0.6 : 0); }, { depth: GROUND + 2 });
      this.warp.ring(target.x, target.y, { r1: 320, life: 460, s: 32, width: 28, squash: SQUASH });
      this.ctx.hitStop?.(90); this.shake(220, 0.011); this.ctx.punch(0.03, 220);
    }
  }

  // ------------------------------------------------------------------ skills

  /** Arcane Bolt: light gathers in the hand and fires with a flash; the third beat (the lance) charges a rune circle first. */
  private boltCharge(r: CastRun): void {
    const T = r.timings, side = sideOf(r), lance = r.stage === 2, el = r.skill.id === 'arcane_bolt_frost' ? 'frost' : r.skill.id === 'arcane_bolt_storm' ? 'storm' : 'arcane';
    const tint = el === 'frost' ? 0xcff6ff : el === 'storm' ? 0x8fe3ff : 0x6fb8ff;
    const hand = (): Pt | null => { const h = this.ctx.hand(r.attackerId), c = this.ctx.casterPos(r.attackerId); if (!c) return null; return h ? { x: h.x + side * 8, y: h.y, d: c.y } : { x: c.x + side * 34, y: c.y - c.z - 70, d: c.y }; };
    this.glow(0, 0, lance ? 110 : 60, tint, T.startup + 60, { follow: hand, alpha: 0.8 });
    if (lance) { // a rune circle stands in front of the hand and turns faster and faster
      this.spr({ name: 'sig_disk', w: 46, h: 110, life: T.startup + 160, follow: () => { const p = hand(); return p ? { ...p, x: p.x + side * 26 } : null; }, add: true, glow: 0.6, run: r,
        sx: kf([0, 0.2], [0.5, 1, out3], [0.9, 1.1], [1, 1.6]), sy: kf([0, 0.2], [0.5, 1, out3], [0.9, 1.1], [1, 1.4]), a: kf([0, 0], [0.2, 1], [0.85, 1], [1, 0]), rot: (u) => 360 * u * u });
      for (let k = 0; k < 8; k++) { const a = rnd(0, Math.PI * 2), d = rnd(50, 90); // motes drawn into the hand
        this.img('mg-dot', { w: 14, tint, life: T.startup, follow: hand, mx: (u) => Math.cos(a) * d * (1 - out(u)), my: (u) => Math.sin(a) * d * 0.7 * (1 - out(u)), a: kf([0, 0], [0.2, 1], [1, 0.6]) }); }
    }
    this.later(T.startup, () => { // the release: a flash at the hand, a spray of light forward
      const p = hand(); if (!p) return;
      this.glow(p.x, p.y, lance ? 190 : 100, tint, lance ? 260 : 160);
      this.sheet('mfx-bolt', p.x + side * (lance ? 40 : 28), p.y, lance ? 220 : 150, lance ? 300 : 220, { frames: [12, 4], flipX: side < 0, ox: side < 0 ? 0.7 : 0.3, depth: TOP + 6 });
      this.flare(p.x, p.y, lance ? 170 : 90, 0xffffff, lance ? 280 : 180);
      this.burst(p.x, p.y, { n: lance ? 18 : 7, speed: [140, lance ? 520 : 340], life: [120, 300], scale: [0.03, 0.16], tint: [0xffffff, tint], angle: side > 0 ? [-30, 30] : [150, 210] });
      if (lance) { this.ringOut(p.x + side * 20, p.y, 130, tint, 300); this.shake(90, 0.004); }
    }, r);
  }

  /** Frost Nova: a frost circle draws itself round his feet, space tightens round him, frost motes spiral in. */
  private novaCharge(r: CastRun): void {
    const T = r.timings, me = this.me(r);
    const chest = () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z - 50 } : null; };
    this.ctx.darken(T.startup + 240, 0.3);
    this.circle(me.x, me.y, 340, 1, T.startup + 420, { run: r, draw: T.startup });
    this.warp.well(me.x, me.y - me.z - 50, { r: 170, life: T.startup + 60, s: 20, twist: 14, follow: chest });
    this.glow(0, 0, 170, 0x8fdcff, T.startup + 80, { follow: () => { const c = chest(); return c ? { ...c, d: TOP } : null; }, alpha: 0.5 });
    for (let k = 0; k < 26; k++) { const a = rnd(0, Math.PI * 2), d = rnd(130, 230), w = rnd(6, 14);
      this.img('mg-dot', { w, tint: k % 3 ? 0xcff6ff : 0x7fc8ff, life: T.startup, delay: rnd(0, T.startup * 0.4), follow: () => { const c = chest(); return c ? { ...c, d: TOP } : null; }, run: r,
        mx: (u) => Math.cos(a + u * 2) * d * (1 - out3(u)), my: (u) => Math.sin(a + u * 2) * d * 0.55 * (1 - out3(u)), a: kf([0, 0], [0.2, 1], [1, 0.8]) }); }
  }

  /** Lightning Chain: a storm circle stands upright before his hand, a knot of storm swells in it, the world dims. */
  private stormCharge(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    const hand = (): { x: number; y: number } | null => { const h = this.ctx.hand(r.attackerId), c = this.ctx.casterPos(r.attackerId); if (!c) return null; return h ? { x: h.x + side * 12, y: h.y } : { x: c.x + side * 34, y: c.y - c.z - 72 }; };
    this.ctx.darken(T.startup + T.active, 0.38);
    this.circle(0, 0, 124, 2, T.startup + T.active, { upright: true, run: r, draw: T.startup, follow: () => { const p = hand(); return p ? { x: p.x + side * 26, y: p.y } : null; } });
    if (this.ctx.scene.textures.exists('mfx-storm')) this.sheet('mfx-storm', 0, 0, 150, T.startup + T.active, { frames: [12, 4], loop: 70, depth: TOP + 7, follow: () => { const p = hand(); return p ? { x: p.x + side * 26, y: p.y } : null; } });
    else this.gpu('vortex', 0, 0, 130, 130, T.startup + 120, (u, ms, q) => { MageFx.U(q, 'uP', Math.min(1, ms / T.startup)); MageFx.U(q, 'uE', ms < T.startup ? 0 : (ms - T.startup) / 120); },
      { follow: () => { const p = hand(); return p ? { x: p.x + side * 30, y: p.y } : null; }, uA: -side, run: r, depth: TOP + 7 });
    for (let k = 0; k < 5; k++) this.later(k * (T.startup / 5), () => { const p = hand(); if (!p) return; const a = rnd(0, Math.PI * 2), l = rnd(50, 90); this.arc({ x: p.x + side * 30, y: p.y }, { x: p.x + side * 30 + Math.cos(a) * l, y: p.y + Math.sin(a) * l }, { life: 120, thick: 1.6 }); }, r);
  }

  /** Astral Lift: a great circle opens on the floor under the foe, space folds into a vortex of starlight over it and the air
   *  twists in, a tether of light runs from his hand — then a pillar of plasma throws the foe into the sky. */
  private starHand(r: CastRun): void {
    const T = r.timings, side = sideOf(r), c0 = this.me(r);
    const cx = c0.x + r.aim.x * 80, cy = c0.y + r.aim.y * 80, hy = cy - 80;
    this.ctx.darken(T.startup + 360, 0.32);
    this.circle(cx, cy, 380, 0, T.startup + 520, { run: r, draw: T.startup });
    this.gpu('vortex', cx, hy, 320, 320, T.startup + 260, (u, ms, q) => {
      MageFx.U(q, 'uP', Math.min(1, ms / T.startup)); MageFx.U(q, 'uE', ms < T.startup ? 0 : (ms - T.startup) / 260);
      q.setScale(ms < T.startup ? 0.55 + 0.45 * out3(ms / T.startup) : 1 - 0.6 * out((ms - T.startup) / 260));
    }, { uA: side, run: r, depth: cy + 4 });
    this.warp.well(cx, hy, { r: 220, life: T.startup + 120, s: 34, twist: 36 * side });
    // the painted pillar: its ignition (frames 1-5) through the wind-up, the eruption on the throw; anchored at its foot
    this.sheet('mfx-pillar', cx, cy + 6, 470, T.startup + 700, { oy: 0.85, depth: cy + 5, split: [5, T.startup], run: r });
    const hand = this.ctx.hand(r.attackerId) ?? { x: c0.x + side * 30, y: c0.y - c0.z - 70 };
    this.arc(hand, { x: cx, y: hy }, { life: T.startup, thick: 2, depth: TOP + 6 });
    for (let k = 0; k < 22; k++) { const a = rnd(0, Math.PI * 2), d = rnd(140, 240);
      this.img('mg-dot', { x: cx, y: hy, w: rnd(6, 15), tint: k % 2 ? 0xb9a2ff : 0x9fe6ff, life: T.startup, delay: rnd(0, 60), run: r,
        mx: (u) => Math.cos(a + u * 3 * side) * d * (1 - out3(u)), my: (u) => Math.sin(a + u * 3 * side) * d * 0.7 * (1 - out3(u)), a: kf([0, 0], [0.2, 1], [1, 0.9]) }); }
  }
  /** Astral Lift's throw: a pillar of plasma, void smoke bursting at its foot, a ring of bent air along the floor, a beat of stillness. */
  private starLaunch(r: CastRun, o: V3): void {
    const c = r.place ?? { x: o.x + r.aim.x * 80, y: o.y + r.aim.y * 80 };
    if (!this.ctx.scene.textures.exists('mfx-pillar')) this.gpu('pillar', c.x, c.y + 10, 250, 720, 700, (u, ms, q) => { MageFx.U(q, 'uP', ms < 70 ? 1.25 : Math.max(0, 1.25 - (ms - 70) / 500)); MageFx.U(q, 'uE', u * u); q.setScale(1 + 0.3 * out(Math.min(1, ms / 120)), 1); },
      { oy: 1, depth: c.y + 5 });
    this.gpu('nova', c.x, c.y, 600, 600 * SQUASH, 520, (u, _ms, q) => { MageFx.U(q, 'uP', out3(u)); MageFx.U(q, 'uE', u > 0.4 ? (u - 0.4) / 0.6 : 0); }, { depth: GROUND + 2 });
    this.warp.ring(c.x, c.y, { r1: 380, life: 520, s: 38, width: 32, squash: SQUASH });
    this.warp.ring(c.x, c.y - 100, { r1: 260, life: 380, s: 24, width: 24 });
    const painted = this.ctx.scene.textures.exists('mfx-pillar');
    if (!painted) this.star(c.x, c.y - 90, 320, 300, { rays: 6 });
    this.burst(c.x, c.y - 30, { n: painted ? 14 : 34, speed: [260, 760], life: [300, 700], scale: [0.04, 0.22], tint: [0xffffff, 0xb9a2ff, 0x8fe6ff], angle: [-125, -55], gravity: 320 });
    this.ctx.hitStop?.(95); this.shake(230, 0.011); if (!painted) this.ctx.flash?.(0xd9ccff, 0.14, 120); this.ctx.punch(0.03, 240);
  }

  /** Arcane Wave: a wide crescent sweeps out along the floor. */
  private wave(r: CastRun): void {
    const o = this.me(r), side = sideOf(r), ang = screenAng(r.aim.x, r.aim.y), y = o.y - o.z - 46;
    for (const [dy, k, d] of [[0, 1, 0], [-18, 0.75, 40], [18, 0.75, 40]] as const)
      this.spr({ name: 'wave_arc', x: o.x + r.aim.x * 30, y: y + dy, depth: TOP + 3, w: 120 * k, h: 170 * k, angle: side < 0 ? ang - 180 : ang, flipX: side < 0, add: true, glow: 0.4, life: 300, delay: d,
        mx: (u) => r.aim.x * 210 * out(u), my: (u) => r.aim.y * 110 * out(u), sx: kf([0, 0.5], [1, 1.2]), sy: kf([0, 0.7], [1, 1.3]), a: kf([0, 0.95], [0.6, 0.8], [1, 0, inQ]) });
    this.floor('ring_arc', o.x + r.aim.x * 110, o.y + r.aim.y * 50, 240, 320, { add: true, a: kf([0, 0.8], [1, 0]), s: kf([0, 0.4], [1, 1.2, out3]) });
  }

  /** Frost Nova: a nova of crystal frost tears out across the floor bending the air with it, frost mist bursts round him, a
   *  crown of ice crystals stands up in two rings and cracks away; a second, wider wave follows. */
  private nova(r: CastRun): void {
    const me = this.me(r), x = me.x, y = me.y, cy = y - me.z - 50;
    const wave = (w: number, life: number, delay: number, s0: number) => {
      this.gpu('nova', x, y, w, w * SQUASH, life, (u, _ms, q) => { MageFx.U(q, 'uP', out3(Math.min(1, u * 1.5))); MageFx.U(q, 'uE', u < 0.45 ? 0 : (u - 0.45) / 0.55); }, { depth: GROUND + 2, delay });
      this.later(delay, () => { this.warp.ring(x, y, { r1: w * 0.5, life: life * 0.55, s: s0, width: 34, squash: SQUASH }); });
    };
    wave(900, 760, 0, 42); wave(1150, 700, 160, 26);
    this.smoke(x, y - 20, 560, 1, 700, { squash: 0.5, depth: y + 3, delay: 60 });
    this.warp.ring(x, cy, { r1: 280, life: 340, s: 24, width: 26 });
    this.star(x, cy, 160, 220, { rays: 6 });
    const painted = this.ctx.scene.textures.exists('mfx-nova');
    if (painted) this.sheet('mfx-nova', x, y, 540, 1150, { oy: 0.62, depth: y - 2 }); // drawn behind him: he stands in its hollow centre
    for (let k = 0; k < (painted ? 0 : 22); k++) { // the crown of crystals, two rings
      const outer = k >= 12, n = outer ? 10 : 12, i = outer ? k - 12 : k;
      const a = (i / n) * Math.PI * 2 + (outer ? 0.3 : 0) + rnd(-0.1, 0.1), rr = outer ? rnd(230, 280) : rnd(130, 170), sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr * SQUASH, big = !outer && k % 2 === 0;
      const w = big ? rnd(60, 76) : rnd(38, 52), h = big ? rnd(160, 210) : rnd(90, 130), delay = (outer ? 90 : 30) + (i % 5) * 14, hold = 600;
      this.gpu('shard', sx, sy + 4, w, h, hold + 260, (_u, ms, q) => { MageFx.U(q, 'uP', Math.min(1, out3(ms / 90))); MageFx.U(q, 'uE', ms < hold ? 0 : (ms - hold) / 260); },
        { oy: 1, depth: sy + 1, delay, angle: Math.cos(a) * 16 + rnd(-6, 6) });
      this.later(delay + hold, () => this.burst(sx, sy - h * 0.4, { n: 6, speed: [90, 280], life: [280, 600], scale: [0.04, 0.13], tint: [0xffffff, 0xcff6ff], gravity: 600, depth: sy + 2 }));
    }
    this.burst(x, cy + 10, { n: 50, speed: [240, 820], life: [280, 680], scale: [0.03, 0.2], tint: [0xffffff, 0xcff6ff, 0x7fc8ff], gravity: 160 });
    this.ctx.hitStop?.(80); this.ctx.flash?.(0xcff6ff, 0.06, 120);
    this.shake(240, 0.011); this.ctx.punch(0.035, 240);
  }

  /** Glacial Spikes: three rows of spikes erupt one after another along a fan, stand as a wall, then shatter. */
  private spikes(r: CastRun): void {
    const o = this.me(r), base = Math.atan2(r.aim.y, r.aim.x), side = sideOf(r);
    if (this.ctx.scene.textures.exists('mfx-spikes')) { // the painted wall: one line along the aim, two lesser ones on the fan's sides
      for (const [da, k, dl] of [[0, 1, 0], [-15, 0.72, 50], [15, 0.72, 50]] as const) {
        const a = base + (da * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), x = o.x + dx * 40, y = o.y + dy * 40 * 0.75;
        const ang = screenAng(dx, dy), len = 300 * k;
        this.sheet('mfx-spikes', x, y, len / 0.8, 3100, { ox: side < 0 ? 0.9 : 0.1, oy: 0.75, flipX: side < 0, depth: y + 2 + (da === 0 ? 1 : 0), delay: dl, run: r,
          keys: [[0, 0], [6.9, 380], [7, 400], [11.9, 2650], [15.9, 3100]], angle: side < 0 ? ang - 180 : ang });
      }
      this.floor('floor_frost', o.x + r.aim.x * 150, o.y + r.aim.y * 110, 330, 3100, { add: true, a: kf([0, 0], [0.04, 0.5], [0.9, 0.35], [1, 0]), angle: screenAng(r.aim.x, r.aim.y) });
      this.warp.ring(o.x + r.aim.x * 140, o.y + r.aim.y * 100, { r1: 220, life: 380, s: 22, width: 24, squash: SQUASH });
      this.shake(150, 0.007); this.ctx.hitStop?.(50);
      return;
    }
    for (const da of [-15, 0, 15]) {
      const a = base + (da * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      for (let k = 0; k < 6; k++) {
        const d = 50 + k * 42, x = o.x + dx * d, y = o.y + dy * d * 0.75, delay = k * 38 + (da === 0 ? 0 : 20), big = k >= 3, stand = 3000 - delay;
        this.spr({ name: big ? 'ice_cluster' : 'ice_spike', x, y: y + 4, oy: 0.95, depth: y + 1, w: big ? 70 : 54, delay, life: stand, flipX: side < 0,
          sy: kf([0, 0.1], [0.06, 1.12, out3], [0.1, 1], [0.9, 1], [1, 0.6, inQ]), sx: kf([0, 0.8], [0.06, 1]), a: kf([0, 1], [0.9, 1], [1, 0, inQ]) });
        this.later(delay + stand - 80, () => this.pop('ice_shards', x, y - 30, 60, { life: 260, add: false }), r);
        if (k === 0 || k === 3) this.pop('snowflake', x, y - 20, 40, { delay, life: 220 });
      }
    }
    this.floor('floor_frost', o.x + r.aim.x * 150, o.y + r.aim.y * 110, 330, 3100, { add: true, a: kf([0, 0], [0.04, 0.7], [0.9, 0.5], [1, 0]), angle: screenAng(r.aim.x, r.aim.y) });
  }

  /** Levity Field: a column of light where gravity turned over; stones and runes drift up. */
  private levity(p: V2, ms: number): void {
    this.spr({ name: 'implosion', x: p.x, y: p.y + 10, oy: 0.95, depth: p.y + 2, w: 230, life: 600, add: true, glow: 0.4, sy: kf([0, 0.3], [0.4, 1.1, out3], [1, 1.2]), a: kf([0, 0], [0.15, 0.9], [1, 0]) });
    for (let t = 0; t < ms; t += 220) this.later(t, () => this.drift(['ice_shards', 'rune_violet', 'rune_cyan', 'paper_scraps'], p.x, p.y - 10, 3, 120, { up: 160, life: 1100, size: [10, 22], add: true }));
    this.floor('time_ripple', p.x, p.y, 300, ms, { add: true, a: kf([0, 0], [0.05, 0.6], [0.9, 0.5], [1, 0]), s: (u) => 0.95 + 0.05 * Math.sin(u * 40) });
  }

  /** Time Collapse: a giant clock over the area through the wind-up; the hands stop; it cracks and collapses. */
  private timeCollapse(r: CastRun): void {
    const p = r.place ?? r.origin, T = r.timings, total = T.startup + T.active;
    if (this.ctx.scene.textures.exists('mfx-clock')) { // the painted clock, timed to the cast: drawn and sweeping through the pull, stopped at the freeze, cracking until the blast
      const fz = T.startup + 260, bl = T.startup + 1250;
      this.circle(p.x, p.y, 460, 0, total + 500, { run: r, draw: 400 });
      this.sheet('mfx-clock', p.x, p.y - 70, 620, total + 520, { oy: 0.55, depth: TOP + 5, run: r, sy: 0.9,
        keys: [[0, 0], [3, 420], [6.9, fz - 40], [7, fz], [8.9, fz + 260], [9, fz + 300], [11.9, bl - 20], [12, bl], [13.9, bl + 200], [15.9, total + 520]] });
      this.warp.well(p.x, p.y - 70, { r: 300, life: fz, s: 30, twist: 30 });
      return;
    }
    this.floor('sig_clock', p.x, p.y, 380, total + 200, { add: true, glow: 0.6, spin: 40, run: r, a: kf([0, 0], [0.15, 0.9], [0.92, 1], [1, 0]), s: kf([0, 0.4], [0.2, 1, out3]) });
    this.spr({ name: 'clock_face', x: p.x, y: p.y - 210, depth: p.y + 6, w: 300, life: total + 120, delay: Math.round(T.startup * 0.3), add: true, glow: 0.35, run: r,
      sx: kf([0, 0.4], [0.15, 1, out3]), sy: kf([0, 0.4], [0.15, 1, out3]), a: kf([0, 0], [0.12, 0.95], [0.9, 0.95], [1, 0]), rot: (u) => (u < 0.55 ? -40 * u : -22) });
    this.spr({ name: 'vortex_pull', x: p.x, y: p.y - 40, depth: p.y + 2, w: 300, h: 140, life: T.startup + 400, add: true, run: r, a: kf([0, 0], [0.3, 0.7], [1, 0]), rot: (u) => -500 * u });
  }
  private timeBlast(p: V2): void {
    if (this.ctx.scene.textures.exists('mfx-clock')) {
      this.warp.ring(p.x, p.y, { r1: 520, life: 600, s: 46, width: 40, squash: SQUASH }); this.warp.ring(p.x, p.y - 80, { r1: 360, life: 460, s: 30, width: 30 });
      this.gpu('nova', p.x, p.y, 900, 900 * SQUASH, 640, (u, _ms, q) => { MageFx.U(q, 'uP', out3(u)); MageFx.U(q, 'uE', u > 0.4 ? (u - 0.4) / 0.6 : 0); }, { depth: GROUND + 2 });
      this.ctx.hitStop?.(120); this.shake(360, 0.016); this.ctx.flash?.(0xe6dcff, 0.28, 200); this.ctx.punch(0.04, 380);
      return;
    }
    this.pop('time_blast', p.x, p.y - 80, 420, { life: 520, glow: 0.7 });
    this.pop('time_shards', p.x, p.y - 160, 320, { life: 600, delay: 40, add: false });
    this.pop('hit_crit', p.x, p.y - 60, 300, { life: 360 });
    this.ripple(p.x, p.y - 4, 480, VIOLET);
    this.ctx.punch(0.014, 380);
  }

  private blinkOut(me: V3, side: number): void {
    this.warp.well(me.x, me.y - me.z - 50, { r: 110, life: 200, s: 22, twist: 20 * side }); this.star(me.x, me.y - me.z - 50, 180, 200, { rays: 4 });
    this.spr({ name: 'blink_out', x: me.x, y: me.y - me.z - 50, depth: me.y + 2, w: 90, h: 130, life: 260, add: true, glow: 0.5, flipX: side < 0, a: kf([0, 1], [1, 0]), sx: kf([0, 1], [1, 0.3, inQ]) });
    this.pop('ghost_haze', me.x, me.y - me.z - 50, 100, { life: 300, tint: ARCANE });
  }
  private blinkIn(me: V3, side: number): void {
    this.warp.ring(me.x, me.y - me.z - 50, { r1: 140, life: 260, s: 16, width: 18 }); this.star(me.x, me.y - me.z - 50, 200, 240, { rays: 4 });
    this.spr({ name: 'blink_in', x: me.x, y: me.y - me.z - 50, depth: me.y + 2, w: 100, h: 130, life: 300, add: true, glow: 0.5, flipX: side < 0, sx: kf([0, 0.2], [0.3, 1, out3]), a: kf([0, 1], [0.6, 1], [1, 0]) });
    this.floor('sig_disk', me.x, me.y, 90, 380, { add: true, a: kf([0, 1], [1, 0]), s: kf([0, 0.5], [1, 1.2, out3]) });
  }
  private ripple(x: number, y: number, w: number, tint: number): void {
    this.spr({ name: 'time_ripple', x, y, depth: TOP + 1, w, h: w * 0.45, life: 520, add: true, tint, sx: kf([0, 0.2], [1, 1.2, out3]), sy: kf([0, 0.2], [1, 1.2, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ lasting effects of a caster

  /** A buff's look on its caster while it lasts: Chrono Haste = a clock ring turning under the feet; Elemental Ascension = frost at
   *  the feet and lightning crackling round the body. */
  aura(id: string, kind: 'haste' | 'ascension', ms: number): void {
    if (!this.ready) return;
    const set = this.auras.get(id) ?? new Set(); this.auras.set(id, set);
    let on = true; const h = { stop: () => { on = false; } }; set.add(h);
    const feet = () => { const c = this.ctx.casterPos(id); return c ? { x: c.x, y: c.y } : null; };
    if (kind === 'haste') this.floor('sig_clock', 0, 0, 84, ms, { add: true, glow: 0.4, spin: 160, follow: feet, alive: () => on, a: kf([0, 0], [0.002, 0.75], [0.995, 0.75], [1, 0]) });
    else {
      this.floor('floor_frost', 0, 0, 130, ms, { add: true, follow: feet, alive: () => on, a: kf([0, 0], [0.01, 0.6], [0.99, 0.6], [1, 0]) });
      for (let t = 300; t < ms; t += 700) this.later(t, () => { if (!on) return; const c = this.ctx.casterPos(id); if (!c) return; const x = c.x + rnd(-26, 26), y = c.y - c.z - rnd(30, 90); this.bolt('bolt_arc', { x: x - 20, y: y - 20 }, { x: x + 20, y: y + 20 }, { thick: 40, life: 160 }); });
      for (let t = 0; t < ms; t += 500) this.later(t, () => { if (!on) return; const c = this.ctx.casterPos(id); if (c) this.drift(['snowflake'], c.x, c.y - c.z - 20, 1, 24, { up: 60, life: 700, size: [8, 14], add: true }); });
    }
  }
  /** Arcane Ward: the shell of rune hexagons round the caster while it holds. */
  ward(id: string, ms: number): void {
    if (!this.ready) return;
    this.wards.get(id)?.stop();
    let on = true; const h = { stop: () => { on = false; } }; this.wards.set(id, h);
    const at = () => { const c = this.ctx.casterPos(id); return c ? { x: c.x, y: c.y - c.z + 6, d: c.y } : null; };
    this.spr({ name: 'ward_dome', w: 120, oy: 0.96, life: ms, follow: at, dz: 4, add: true, glow: 0.25, alive: () => on, sx: kf([0, 0.4], [0.01, 1, out3]), sy: (u) => (u < 0.01 ? 0.4 + 60 * u : 1) * (1 + 0.02 * Math.sin(u * ms / 160)), a: kf([0, 0], [0.01, 0.55], [0.98, 0.5], [1, 0]) });
  }
  /** The ward took a blow (broken: it bursts; expired: it fades). */
  wardHit(id: string, broken: boolean, expired = false): void {
    if (!this.ready) return;
    const c = this.ctx.casterPos(id); if (!c) return;
    if (expired || broken) { this.wards.get(id)?.stop(); this.wards.delete(id); }
    if (expired) return;
    this.pop(broken ? 'ward_break' : 'spark_arc', c.x, c.y - c.z - 50, broken ? 170 : 80, { life: broken ? 380 : 200 });
    if (broken) { this.floor('ice_ring', c.x, c.y, 300, 480, { a: kf([0, 0.9], [1, 0]), s: kf([0, 0.3], [0.4, 1, out3]) }); this.ctx.punch(0.006, 160); }
  }
  clear(id: string): void {
    for (const h of this.auras.get(id) ?? []) h.stop();
    this.auras.delete(id);
    this.wards.get(id)?.stop(); this.wards.delete(id);
    this.weave(id, 0, false);
  }

  /** Spell Weave: n runes circling the caster (lost: they scatter). */
  weave(id: string, n: number, lost: boolean): void {
    const s = this.ctx.scene;
    let w = this.weaves.get(id);
    if (!w) { w = { imgs: [], t: 0, n: 0 }; this.weaves.set(id, w); }
    if (lost) { const c = this.ctx.casterPos(id); if (c && this.ready) for (const im of w.imgs) this.pop(im.frame.name, im.x, im.y, 30, { life: 300 }); if (c && this.ready) this.pop('time_shards', c.x, c.y - c.z - 50, 90, { life: 260 }); }
    while (w.imgs.length > n) w.imgs.pop()!.destroy();
    while (w.imgs.length < n && this.ready) {
      const im = s.add.image(0, 0, MAGE_KIT, RUNES[w.imgs.length % RUNES.length]).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(22, 22);
      w.imgs.push(im);
      const c = this.ctx.casterPos(id); if (c) this.pop(RUNES[(w.imgs.length - 1) % RUNES.length], c.x, c.y - c.z - 50, 40, { life: 220 });
    }
    w.n = n;
    if (!n) this.weaves.delete(id);
  }
  private stepWeaves(dt: number): void {
    for (const [id, w] of this.weaves) {
      w.t += dt;
      const c = this.ctx.casterPos(id);
      w.imgs.forEach((im, i) => {
        if (!c) { im.setVisible(false); return; }
        const a = w.t / 600 + (i / Math.max(1, w.imgs.length)) * Math.PI * 2, x = c.x + Math.cos(a) * 44, y = c.y - c.z - 52 + Math.sin(a) * 14;
        im.setVisible(true).setPosition(x, y).setDepth(c.y + (Math.sin(a) > 0 ? 3 : -3)).setAlpha(0.75 + 0.25 * Math.sin(w.t / 120 + i)).setScale(im.scaleX, im.scaleY);
      });
    }
  }
  /** Grand Weave: the five runes merge into one star, and the next spell flows out at once. */
  grandWeave(id: string): void {
    if (!this.ready) return;
    const c = this.ctx.casterPos(id); if (!c) return;
    this.pop('buff_star', c.x, c.y - c.z - 70, 110, { life: 420 });
    this.ripple(c.x, c.y - c.z - 50, 160, 0xffe27a);
  }

  /** Levitate: a rune disc under the feet and pages drifting down while the float lasts. */
  levitate(_id: string, at: () => V3 | null): void {
    if (!this.ready) return;
    const p0 = at(); if (!p0) return;
    this.spr({ name: 'sig_disk', w: 70, h: 28, life: 1500, add: true, glow: 0.4, alive: () => !!at(), follow: () => { const p = at(); return p ? { x: p.x, y: p.y - p.z + 4, d: p.y } : null; }, a: kf([0, 0], [0.05, 0.85], [0.9, 0.8], [1, 0]), rot: (u) => 0 * u });
    for (let t = 0; t < 1400; t += 260) this.later(t, () => { const p = at(); if (p) this.spr({ name: `page_${1 + Math.floor(Math.random() * 3)}`, x: p.x + rnd(-20, 20), y: p.y - p.z, depth: p.y + 1, w: 16, life: 700, angle: rnd(0, 360), my: (u) => 50 * u, rot: (u) => 200 * u, a: kf([0, 1], [1, 0]) }); });
  }

  /** Chrono Sigil's recall: the body streaks back along time to the sigil. */
  rewind(_id: string, from: V3, to: V3): void {
    if (!this.ready) return;
    this.pop('ghost_haze', from.x, from.y - from.z - 50, 110, { life: 400, tint: VIOLET });
    this.bolt('glow_streak', { x: from.x, y: from.y - from.z - 50 }, { x: to.x, y: to.y - to.z - 50 }, { thick: 70, life: 300 });
    this.pop('time_ripple', to.x, to.y - to.z - 40, 160, { life: 420 });
    this.blinkIn(to, to.x < from.x ? -1 : 1);
  }

  /** Arcane Gates: two portals standing for `ms`. */
  gates(_id: string, a: V2, b: V2, ms: number): void {
    if (!this.ready) return;
    for (const p of [a, b]) {
      this.pop('blink_in', p.x, p.y - 60, 120, { life: 360 });
      this.spr({ name: 'sig_star', x: p.x, y: p.y - 58, depth: p.y + 1, w: 74, h: 116, life: ms, add: true, glow: 0.4, sx: kf([0, 0.1], [0.04, 1, out3]), a: kf([0, 0], [0.03, 0.9], [0.97, 0.9], [1, 0]), rot: (u) => (ms / 1000) * 30 * u });
      this.spr({ name: 'singularity', x: p.x, y: p.y - 58, depth: p.y + 0.5, w: 56, h: 92, life: ms, add: true, sx: kf([0, 0.1], [0.04, 1, out3]), a: kf([0, 0], [0.03, 0.8], [0.97, 0.8], [1, 0]), rot: (u) => -(ms / 1000) * 90 * u });
      this.floor('sig_disk', p.x, p.y, 90, ms, { add: true, spin: 40, a: kf([0, 0], [0.03, 0.7], [0.97, 0.7], [1, 0]) });
    }
  }
  gatePass(from: V2, to: V2, z: number): void {
    if (!this.ready) return;
    this.pop('blink_out', from.x, from.y - z, 90, { life: 240 });
    this.pop('blink_in', to.x, to.y - z, 100, { life: 280 });
  }

  /** A broken heavy blow on the Mana Barrier: a rune hexagon flashes where it struck. */
  barrier(at: V3, from: { x: number; y: number }): void {
    if (!this.ready) return;
    const dx = Math.sign(from.x - at.x) || 1;
    this.pop('ward_break', at.x + dx * 30, at.y - at.z - 50, 120, { life: 360 });
    this.pop('hit_heavy', at.x + dx * 30, at.y - at.z - 50, 100, { life: 220 });
  }

  /** The conducted arc between two foes. */
  conductArc(a: V3, b: V3): void {
    if (!this.ready) return;
    this.bolt('bolt_long', { x: a.x, y: a.y - a.z - 10 }, { x: b.x, y: b.y - b.z - 10 }, { thick: 60, life: 240 });
  }

  /** Rune beams between two runes (drawn every frame they stand). */
  runeBeam(A: Trap, B: Trap, _g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.ready) return;
    const key = `${A.run.castId}|${B.run.castId}`, s = this.ctx.scene;
    let b = this.beams.get(key);
    if (!b) {
      const im = s.add.image(0, 0, MAGE_KIT, 'bolt_long').setBlendMode(Phaser.BlendModes.ADD);
      const ra = s.add.image(0, 0, MAGE_KIT, 'rune_cyan').setBlendMode(Phaser.BlendModes.ADD), rb = s.add.image(0, 0, MAGE_KIT, 'rune_cyan').setBlendMode(Phaser.BlendModes.ADD);
      b = { im, a: ra, b: rb, seen: now }; this.beams.set(key, b);
    }
    b.seen = performance.now();
    const ax = A.x, ay = A.y - 14, bx = B.x, by = B.y - 14, len = Math.hypot(bx - ax, by - ay);
    b.im.setPosition((ax + bx) / 2, (ay + by) / 2).setAngle(Math.atan2(by - ay, bx - ax) * (180 / Math.PI)).setDisplaySize(len, 26 + 6 * Math.sin(now / 60)).setDepth(Math.max(A.y, B.y) - 1).setAlpha(0.35 + 0.15 * Math.sin(now / 90));
    for (const [im, x, y] of [[b.a, ax, ay], [b.b, bx, by]] as const) im.setPosition(x, y).setDisplaySize(24, 24).setDepth(y + 2).setAlpha(0.8);
  }
  runeBeamBreak(A: Trap, B: Trap, at: V3): void {
    if (!this.ready) return;
    const key = `${A.run.castId}|${B.run.castId}`, b = this.beams.get(key);
    if (b) { b.im.destroy(); b.a.destroy(); b.b.destroy(); this.beams.delete(key); }
    this.bolt('bolt_long', { x: A.x, y: A.y - 14 }, { x: B.x, y: B.y - 14 }, { thick: 70, life: 260 });
    this.pop('bolt_impact', at.x, at.y - at.z, 100, { life: 240 });
  }
  private sweepBeams(now: number): void { for (const [k, b] of this.beams) if (now - b.seen > 120) { b.im.destroy(); b.a.destroy(); b.b.destroy(); this.beams.delete(k); } }

  /** Binding Rune / Frost Rune lying on the floor. */
  trap(t: Trap): void {
    if (!this.ready) return;
    const frost = t.run.skill.id === 'frost_rune', w = t.radius * (frost ? 2.6 : 2.4);
    this.pop(frost ? 'snowflake' : 'rune_cyan', t.x, t.y - 20, 50, { life: 260 });
    let on = true;
    this.floor(frost ? 'ice_ring' : 'sig_bind', t.x, t.y, w, t.until, { add: !frost, glow: frost ? 0 : 0.4, spin: frost ? 0 : 25, alive: () => on, a: kf([0, 0], [0.0001, 0.75], [1, 0.75]), s: kf([0, 0.4], [0.00005, 1, out3]) });
    this.trapArt.set(t, { stop: () => { on = false; } });
  }
  trapEnd(t: Trap, fired: boolean): void {
    this.trapArt.get(t)?.stop(); this.trapArt.delete(t);
    if (fired && this.ready) this.pop(t.run.skill.id === 'frost_rune' ? 'ice_shatter' : 'sig_disk', t.x, t.y - 16, 90, { life: 300 });
  }

  // ------------------------------------------------------------------ projectiles

  projectile(p: Projectile, r?: CastRun): void {
    if (!this.ready) return;
    if (r && r.skill.id.startsWith('arcane_bolt')) { this.boltShot(p, r); return; }
    const id = p.skill.id, s = this.ctx.scene;
    const kind: Bolt['kind'] = id === 'origami_flock' ? 'crane' : id === 'arcane_bolt_frost' ? 'frost' : id === 'arcane_bolt_storm' ? 'storm' : id === 'glacial_spikes' ? 'spike' : 'arcane';
    const name = kind === 'crane' ? 'crane_up' : kind === 'frost' ? 'bolt_frost' : kind === 'storm' ? 'bolt_storm' : 'bolt_arcane';
    const mk = (add: boolean) => s.add.image(p.x, p.y - p.z, MAGE_KIT, name).setOrigin(kind === 'crane' ? 0.5 : 0.82, 0.5).setBlendMode(add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setDepth(p.y + 2).setVisible(kind !== 'spike');
    this.bolts.set(p, { im: mk(kind === 'arcane' || kind === 'storm'), gl: mk(true).setAlpha(kind === 'crane' ? 0 : 0.35), t: 0, trail: 0, kind });
  }
  projectileEnd(p: Projectile): void {
    const sh = this.shots.get(p);
    if (sh) { this.shots.delete(p); this.boltEnd(p, sh.lance, sh.tint, sh.el); return; }
    const b = this.bolts.get(p); if (!b) return;
    this.bolts.delete(p); b.im.destroy(); b.gl.destroy();
    if (!this.ready) return;
    const e = p.end ?? { x: p.x, y: p.y }, y = e.y - p.z;
    if (b.kind === 'crane') this.pop('paper_burst', e.x, y, 70, { life: 260, add: false });
    else if (b.kind === 'frost') { this.pop('ice_shatter', e.x, y, 80, { life: 240, add: false }); this.pop('snowflake', e.x, y, 40, { life: 200 }); }
    else if (b.kind === 'storm') this.pop('bolt_impact', e.x, y, 90, { life: 220 });
    else if (b.kind === 'arcane') this.pop('bolt_burst', e.x, y, 80, { life: 220 });
  }
  private stepBolts(dt: number): void {
    for (const [p, b] of this.bolts) {
      b.t += dt;
      const x = p.x, y = p.y - p.z, fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy);
      if (b.kind === 'spike') continue; // Glacial Spikes: the spikes in the floor are its picture
      if (b.kind === 'crane') { // a paper crane: wings beat, it banks toward where it flies
        const up = Math.floor(b.t / 90) % 2 === 0, k = 46 / 150;
        b.im.setFrame(up ? 'crane_up' : 'crane_down').setPosition(x, y + (up ? -2 : 2)).setScale(fl ? -k : k, k).setAngle(fl ? ang + 180 - 180 : ang).setDepth(p.y + 2);
        if (b.t - b.trail > 70) { b.trail = b.t; this.spr({ name: 'page_4', x, y, depth: p.y + 1, w: 8, life: 300, angle: rnd(0, 360), my: (u) => 14 * u, a: kf([0, 0.8], [1, 0]) }); }
        continue;
      }
      const len = b.kind === 'arcane' ? 78 : 86, k = len / b.im.width, pulse = 1 + 0.06 * Math.sin(b.t / 30);
      for (const im of [b.im, b.gl]) im.setPosition(x, y).setAngle(fl ? ang - 180 : ang).setFlipX(fl).setScale(k * (im === b.gl ? 1.1 : 1), k * pulse * (im === b.gl ? 1.1 : 1)).setDepth(p.y + (im === b.gl ? 2.01 : 2));
      if (b.t - b.trail > 45) {
        b.trail = b.t;
        if (b.kind === 'frost') this.spr({ name: 'snowflake', x: x - p.dx * 20, y, depth: p.y + 1, w: rnd(8, 13), life: 380, add: true, angle: rnd(0, 360), my: (u) => 16 * u, a: kf([0, 0.9], [1, 0]) });
        else if (b.kind === 'storm' && Math.random() < 0.5) this.bolt('bolt_arc', { x: x - p.dx * 12, y: y - 8 }, { x: x - p.dx * 34, y: y + 8 }, { thick: 22, life: 110 });
        else this.spr({ name: 'spark_arc', x: x - p.dx * 16, y, depth: p.y + 1, w: 18, life: 220, add: true, a: kf([0, 0.7], [1, 0]), sx: kf([0, 1], [1, 0.4]), sy: kf([0, 1], [1, 0.4]) });
      }
    }
  }

  private shots = new Map<Projectile, { lance: boolean; tint: number; el: string }>();
  /** An Arcane Bolt in flight: a bright head, a glow round it and a stream of light behind (the lance: bigger, with streaks). */
  private boltShot(p: Projectile, r: CastRun): void {
    const s = this.ctx.scene, lance = r.stage === 2, el = r.skill.id === 'arcane_bolt_frost' ? 'frost' : r.skill.id === 'arcane_bolt_storm' ? 'storm' : 'arcane';
    const tint = el === 'frost' ? 0xcff6ff : el === 'storm' ? 0x8fe3ff : 0x6fb8ff, name = el === 'frost' ? 'bolt_frost' : el === 'storm' ? 'bolt_storm' : 'bolt_arcane';
    ensureLight(s);
    const painted = s.textures.exists('mfx-bolt'), ptint = el === 'frost' ? 0xbfefff : el === 'storm' ? 0xa8e8ff : 0xffffff;
    const head = painted ? s.add.image(p.x, p.y - p.z, 'mfx-bolt', lance ? 4 : 0).setOrigin(0.7, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(ptint)
      : s.add.image(p.x, p.y - p.z, MAGE_KIT, name).setOrigin(0.8, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    const halo = s.add.image(p.x, p.y - p.z, 'mg-dot').setBlendMode(Phaser.BlendModes.ADD).setTint(tint);
    const core = s.add.image(p.x, p.y - p.z, 'mg-dot').setBlendMode(Phaser.BlendModes.ADD);
    const trail = s.add.particles(0, 0, 'mg-dot', { speed: { min: 0, max: 30 }, lifespan: { min: 160, max: lance ? 380 : 260 }, scale: { start: lance ? 0.42 : 0.26, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: [0xffffff, tint, tint], blendMode: 'ADD', frequency: 14, quantity: lance ? 2 : 1 });
    const fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy), len = painted ? (lance ? 300 : 190) : lance ? 170 : 100, k = len / head.width;
    let t = 0, last = 0;
    this.shots.set(p, { lance, tint, el });
    this.add({ t: 0, step: (dt) => {
      if (!this.shots.has(p)) { head.destroy(); halo.destroy(); core.destroy(); trail.stop(); s.time.delayedCall(420, () => trail.destroy()); return false; }
      t += dt; const x = p.x, y = p.y - p.z, pulse = 1 + 0.08 * Math.sin(t / 28);
      head.setPosition(x, y).setAngle(fl ? ang - 180 : ang).setFlipX(fl).setScale(k, k * (painted ? 1 : pulse)).setDepth(p.y + 3);
      if (painted) { head.setOrigin(fl ? 0.3 : 0.7, 0.5).setFrame((lance ? 4 : 0) + (Math.floor(t / 55) % 4)); halo.setVisible(false); core.setVisible(false); }
      halo.setPosition(x, y).setDisplaySize((lance ? 130 : 80) * pulse, (lance ? 90 : 56) * pulse).setDepth(p.y + 2).setAlpha(0.7);
      core.setPosition(x, y).setDisplaySize(lance ? 46 : 28, lance ? 46 : 28).setDepth(p.y + 3.1);
      trail.setPosition(x - p.dx * 10, y).setDepth(p.y + 1);
      if (t - last > (lance ? 30 : 60)) { last = t;
        if (lance) this.img('mg-streak', { x: x - p.dx * 30, y: y + rnd(-8, 8), w: 90, h: 10, angle: fl ? ang - 180 : ang, tint, life: 160, depth: p.y + 1, a: kf([0, 0.8], [1, 0]), sx: kf([0, 1], [1, 0.4]) });
        if (el === 'frost') this.spr({ name: 'snowflake', x: x - p.dx * 16, y: y + rnd(-6, 6), depth: p.y + 1, w: rnd(10, 16), life: 420, add: true, angle: rnd(0, 360), my: (u) => 18 * u, rot: (u) => 200 * u, a: kf([0, 0.9], [1, 0]) });
        if (el === 'storm' && Math.random() < 0.6) this.zap({ x: x - p.dx * 8, y: y - 10 }, { x: x - p.dx * 40 + rnd(-8, 8), y: y + rnd(-14, 14) }, { life: 80, width: 1.6, forks: 0 });
      }
      return true;
    } });
  }
  /** The bolt's end: a burst of light and sparks (a fizzle where it ran out). */
  private boltEnd(p: Projectile, lance: boolean, tint: number, el: string): void {
    const e = p.end ?? { x: p.x, y: p.y, reason: 'range' as const }, x = e.x, y = e.y - p.z;
    if (e.reason === 'range') { this.glow(x, y, lance ? 90 : 50, tint, 180); this.burst(x, y, { n: 5, speed: [40, 120], life: [120, 240], scale: [0.03, 0.1], tint: [tint] }); return; }
    const onFoe = e.reason === 'target'; // (the hit itself draws its spark on the foe: here the bolt's own burst, lighter)
    this.glow(x, y, lance ? 220 : 120, tint, lance ? 300 : 220, { alpha: onFoe ? 0.45 : 0.8 });
    if (this.ctx.scene.textures.exists('mfx-bolt')) this.sheet('mfx-bolt', x, y, lance ? 340 : 220, lance ? 340 : 260, { frames: [8, 4], tint: el === 'frost' ? 0xbfefff : el === 'storm' ? 0xa8e8ff : undefined, depth: TOP + 6 });
    else this.pop(el === 'frost' ? 'ice_shatter' : el === 'storm' ? 'bolt_impact' : 'bolt_burst', x, y, lance ? 230 : 140, { life: lance ? 320 : 240, add: el !== 'frost' });
    this.ringOut(x, y, lance ? 230 : 130, tint, lance ? 340 : 260);
    this.burst(x, y, { n: lance ? 26 : 12, speed: [140, lance ? 560 : 380], life: [160, 420], scale: [0.03, lance ? 0.22 : 0.14], tint: [0xffffff, tint], gravity: 300 });
    if (el === 'frost') this.burst(x, y, { frame: 'snowflake', n: lance ? 10 : 5, speed: [80, 260], life: [300, 600], scale: [0.05, 0.13], tint: [0xffffff], gravity: 260, spin: true });
    if (lance) { this.shake(110, 0.005); this.flare(x, y, 200, 0xffffff, 260); }
  }

  // ------------------------------------------------------------------ hits and reactions

  /** The hit spark of a mage hit on a foe (by element and weight). */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    if (!this.ready || (s.slot === 99 && !hit.damage)) return;
    const x = at.x, y = at.y - at.z - 40, el = hit.el, tint = el === 'frost' ? 0xcff6ff : el === 'storm' ? 0x8fe3ff : 0x6fb8ff;
    const big = crit || heavy;
    this.glow(x, y, crit ? 200 : big ? 150 : 100, tint, big ? 220 : 170, { alpha: el === 'storm' ? 0.35 : big ? 0.7 : 0.5 });
    if (crit) this.pop('hit_crit', x, y, 190, { life: 320 });
    else if (big) this.pop(el === 'storm' ? 'spark_arc' : 'hit_heavy', x, y, el === 'storm' ? 110 : 150, { life: 260 });
    else this.pop('spark_arc', x, y, 90, { life: 200 });
    this.burst(x, y, { n: big ? 16 : 8, speed: [120, big ? 460 : 320], life: [140, 380], scale: [0.03, big ? 0.18 : 0.12], tint: [0xffffff, tint], gravity: 240 });
    if (el === 'frost') this.burst(x, y, { frame: 'snowflake', n: big ? 6 : 3, speed: [60, 200], life: [300, 520], scale: [0.05, 0.12], tint: [0xffffff], gravity: 220, spin: true });
    if (el === 'storm') for (let k = 0; k < (big ? 3 : 2); k++) { const a = rnd(0, Math.PI * 2); this.zap({ x, y }, { x: x + Math.cos(a) * 50, y: y + Math.sin(a) * 50 }, { life: 110, width: 2, forks: 1 }); }
    if (big) this.flare(x, y, crit ? 200 : 140, 0xffffff, 220);
  }

  /** What a magic reaction looks like on the foe; `id` / `ms`: the frozen / cursed foe and for how long. */
  reaction(rx: string, at: V3, follow?: () => V3 | null, ms = 0): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z - 30, fp = follow ? () => { const p = follow(); return p ? { x: p.x, y: p.y - p.z, d: p.y } : null; } : undefined;
    switch (rx) {
      case 'chill':
        this.spr({ name: 'frost_mist', x, y: at.y - at.z + 4, depth: at.y + 3, w: 70, life: 900, follow: fp, dz: 3, sx: kf([0, 0.5], [0.4, 1.2, out3]), a: kf([0, 0], [0.15, 0.75], [1, 0]) });
        this.pop('snowflake', x, y - 30, 40, { life: 300 });
        break;
      case 'freeze': { // ice grows up round the foe out of the floor, glowing, snow bursting off it
        const life = Math.max(300, ms);
        this.spr({ name: 'ice_block', x, y: at.y - at.z + 10, oy: 0.96, depth: at.y + 4, w: 112, life, follow: fp, dz: 4, sy: kf([0, 0.1], [0.05, 1.12, out3], [0.1, 1]), sx: kf([0, 0.85], [0.05, 1]), a: kf([0, 0.6], [0.04, 0.9], [0.9, 0.9], [1, 0]) });
        this.img('mg-dot', { x, y: y - 10, w: 170, tint: 0x9fdcff, life, follow: fp ? () => { const p = fp(); return p ? { ...p, y: p.y - 70 } : null; } : undefined, dz: 5, a: kf([0, 0], [0.05, 0.55], [0.9, 0.4], [1, 0]), sx: (u) => 1 + 0.05 * Math.sin(u * 40) });
        this.glow(x, y, 200, 0xcff6ff, 240);
        this.ringOut(at.x, at.y, 200, 0xcff6ff, 360, { squash: 0.42, depth: at.y + 1 });
        this.burst(x, y - 20, { frame: ['snowflake', 'ice_shards'], n: 12, speed: [100, 320], life: [300, 640], scale: [0.05, 0.16], tint: [0xffffff], gravity: 400, spin: true, add: false });
        this.shake(100, 0.004);
        break;
      }
      case 'shatter': // the ice bursts apart: a flash, a storm of shards, the world stops for a beat
        this.ctx.hitStop?.(90);
        this.ctx.flash?.(0xe6fbff, 0.24, 160);
        this.glow(x, y - 10, 320, 0xcff6ff, 320);
        this.pop('ice_shatter', x, y - 10, 280, { life: 460, add: false });
        this.pop('hit_crit', x, y - 10, 200, { life: 300 });
        this.ringOut(x, y - 10, 300, 0xcff6ff, 420);
        this.ringOut(at.x, at.y, 320, 0x9fdcff, 460, { squash: 0.42, depth: at.y + 1 });
        this.burst(x, y - 20, { frame: ['ice_shards', 'snowflake'], n: 28, speed: [220, 640], life: [380, 820], scale: [0.06, 0.22], tint: [0xffffff], gravity: 700, spin: true, add: false });
        this.burst(x, y - 20, { n: 30, speed: [200, 700], life: [200, 500], scale: [0.04, 0.24], tint: [0xffffff, 0xcff6ff, 0x6fc8ff] });
        this.shake(240, 0.013); this.ctx.punch(0.045, 260);
        break;
      case 'conduct':
        this.pop('stun_ring', x, at.y - at.z - 100, 90, { life: 700 });
        this.glow(x, y, 200, 0x8fe3ff, 260);
        for (let k = 0; k < 5; k++) this.later(k * 50, () => { const a = rnd(0, Math.PI * 2); this.zap({ x, y }, { x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 60 }, { life: 120, width: 2.4, forks: 2 }); });
        this.shake(90, 0.004);
        break;
      case 'curse': {
        this.pop('page_cocoon', x, y - 10, 90, { life: 360, add: false });
        this.spr({ name: 'crane_big', x, y: at.y - at.z + 6, oy: 0.95, depth: at.y + 4, w: 80, delay: 220, life: Math.max(300, ms - 220), follow: fp, dz: 4,
          sx: kf([0, 0.2], [0.06, 1, out3]), sy: (u) => 1 + 0.03 * Math.sin(u * 40), a: kf([0, 0], [0.05, 1], [0.95, 1], [1, 0]) });
        this.later(Math.max(300, ms), () => { const p = follow?.() ?? at; this.pop('paper_burst', p.x, p.y - p.z - 30, 100, { life: 300, add: false }); });
        break;
      }
      case 'levity':
        this.spr({ name: 'sig_disk', x, y: at.y - at.z + 2, depth: at.y + 2, w: 60, h: 24, life: Math.max(300, ms), follow: fp, dz: -1, add: true, a: kf([0, 0], [0.05, 0.8], [0.95, 0.8], [1, 0]) });
        break;
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, now: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
    this.warp.update(dt);
    this.stepBolts(dt);
    this.stepWeaves(dt);
    this.sweepBeams(now);
  }

  destroy(): void {
    for (const [p] of this.bolts) this.projectileEnd(p);
    for (const [id] of this.weaves) this.weave(id, 0, false);
    for (const [, b] of this.beams) { b.im.destroy(); b.a.destroy(); b.b.destroy(); }
    this.beams.clear();
    for (const q of this.quads) q.destroy();
    this.quads.clear();
    this.live = []; this.incoming = [];
  }
}
