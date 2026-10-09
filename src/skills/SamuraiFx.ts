// Samurai skill effects, built from separate painted pieces (tools/skills/kit.py → one atlas, KIT) and moved in code: a cut
// grows along its arc and thins out, a burst pops, a sigil turns on the floor, the dragon's body bends along its path —
// so every effect flows at the frame rate instead of flipping between drawn frames. Presentation only (gameplay never
// reads any of this); the timing comes from the cast (startup / active / each hit as it fires), so every client draws the
// same, and the effect clock stops with the hit-stop like the fight does.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V3 } from './HitGeometry';
import { TORNADO, tornadoPath } from './SamuraiMotion';

export const KIT = 'sam-kit';
export const KIT_URL = 'assets/final/skills/samurai/kit/';
const TOP = 100000, GROUND = 2, SQUASH = 0.42, CRIMSON = 0xff3a4c, DUST = 0xd2a57a;
/** The crack piece runs diagonally on its sheet; this turns it level. */
const CRACK_TILT = -57;
/** The slash-hit pieces run this many degrees down to the right on their sheet (s11). */
const SLASH_TILT = 43;
/** A trail of the blade (blade_trail) / a flipped piece: angle that points it along `ang` (deg on screen). */
const along = (ang: number, left: boolean) => (left ? ang - 180 : ang);
/** Hits whose cut "arrives late": a thin line stays on the foe and splits open a beat after. */
const DELAYED = new Set(['shadow_step', 'iai_strike', 'dragon_eclipse', 'mirage']);
/** God of Blades: a katana of the halo (drawn length) and the halo itself (drawn width). */
const KATANA = 150, HALO = 190;
/** Rising Sun's buff (its light stays on him this long). */
const SUN_MS = 90000;

/** What the samurai effects need from the scene's effect layer. */
export interface SamCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  hand(id: string): { x: number; y: number } | null;
  callout(at: V3, text: string, color: string, row?: number): void;
  punch(amount?: number, ms?: number): void;
  darken(ms: number, alpha: number): void;
  ultimateStage(r: CastRun): void;
  /** Where a caster's shadow doubles stand (Kagemusha): they swing with him. */
  ghosts?(id: string): { k: number; x: number; y: number; z: number }[];
  /** Where a fighter or monster is now (a locked-on target of a cast). */
  targetPos?(id: string): (V3 & { h?: number }) | null;
  /** A beat of hit-stop (the late cut opening, the full draw). */
  freeze?(ms: number): void;
  /** His body as drawn this moment (texture, frame, facing, origin, scale, how much of him shows): phantoms of him are made of
   *  it, and what he carries (the halo, the sun's light) shows as much as he does (gone when he vanishes or hides). */
  body?(id: string): { key: string; frame: string | number; flipX: boolean; ox: number; oy: number; sx: number; sy: number; a?: number; face?: number } | null;
  /** Whether a fighter is alive (a buff's picture goes when he falls). */
  alive?(id: string): boolean;
}

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out: Ease = (u) => 1 - (1 - u) * (1 - u), out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
const back: Ease = (u) => { const c = 1.7, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
type Key = [number, number, Ease?];
/** A curve through keys [u, value, easing into the key] (u = 0..1 over the piece's life). */
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);
/** On-screen angle (deg) of a direction along the floor (depth is foreshortened). */
const screenAng = (dx: number, dy: number) => Math.atan2(dy * 0.5, dx) * (180 / Math.PI);
type Pt = { x: number; y: number; d: number };

/** One piece and its motion. Positions are screen positions; `follow` (a moving point and its depth base) replaces x / y
 *  and makes `dz` the depth above that base. */
interface Spr {
  name: string; x?: number; y?: number; depth?: number; w: number; h?: number;
  delay?: number; life: number;
  ox?: number; oy?: number; angle?: number; flipX?: boolean; flipY?: boolean;
  add?: boolean; glow?: number; tint?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number;
  follow?: () => Pt | null; dz?: number;
  /** keep only the part of the frame below this fraction of its height (a ring's near half, drawn over the actor) */
  crop?: number;
  /** turns the piece over (flipX) every this many ms: a spinning shimmer */
  flick?: number;
  /** not drawn if this cast is broken off before the piece appears */
  run?: CastRun;
}
interface Live { t: number; step(dt: number, t: number): boolean }
/** God of Blades' halo: the katanas (each with its glow), the halo (its glow), which katanas are out striking, when each came back. */
interface Halo { run: CastRun; imgs: Phaser.GameObjects.Image[]; gls: Phaser.GameObjects.Image[]; halo: Phaser.GameObjects.Image; hg: Phaser.GameObjects.Image; t: number; until: number;
  lastX: number; face: number; next: number; away: Set<number>; spent: Set<number> }
/** The order the halo's katanas fly in (from the ends of the fan inward: it stays even as it empties). */
const BLADE_ORDER = [0, 7, 1, 6, 2, 5, 3, 4];
/** Rising Sun's light on a fighter through the buff. */
interface Sun { t: number; ims: Phaser.GameObjects.Image[]; next: number }
interface Wave { im: Phaser.GameObjects.Image; gl: Phaser.GameObjects.Image; t: number; trail: number; ghosts: { im: Phaser.GameObjects.Image; dx: number; dy: number }[] }

export class SamuraiFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private halos = new Map<string, Halo>();
  private suns = new Map<string, Sun>();
  private waves = new Map<Projectile, Wave>();
  /** Mirage stances by cast: where the samurai stood (the mirage the blow strikes). */
  private stances = new Map<string, { x: number; y: number; z: number; done: boolean }>();

  constructor(private ctx: SamCtx) {}

  get ready(): boolean { return this.ctx.scene.textures.exists(KIT); }

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  private later(ms: number, fn: () => void, run?: CastRun): void {
    this.add({ t: 0, step: (_dt, t) => { if (t < ms) return true; if (!run || !(run.phase === 'done' && !run.fired.size)) fn(); return false; } });
  }
  private broken(r?: CastRun): boolean { return !!r && r.phase === 'done' && !r.fired.size; }
  /** A double's swing whose double has burst (Kagemusha): its picture goes with it. */
  private gone(r?: CastRun): boolean { return !!r && r.attackerId.includes('#') && !this.ctx.casterPos(r.attackerId); }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** How much of him shows now (0: vanished / hidden among his doubles). */
  private seen(id: string): number { return this.ctx.body?.(id)?.a ?? 1; }
  /** A point in front of the caster (dx forward, dz up), following him. */
  private front(r: CastRun, dx: number, dz: number, dy = 0): () => Pt | null {
    const side = sideOf(r);
    return () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x + side * dx, y: c.y - c.z - dz + dy, d: c.y } : null; };
  }

  private spr(o: Spr): Phaser.GameObjects.Image | null {
    const s = this.ctx.scene;
    if (!s.textures.exists(KIT)) return null;
    const fr = s.textures.getFrame(KIT, o.name); if (!fr) return null;
    const fw = fr.cutWidth || fr.width, fh = fr.cutHeight || fr.height;
    const bx = o.w / fw, by = (o.h ?? (o.w * fh) / fw) / fh;
    const mk = (glow: boolean) => {
      const im = s.add.image(o.x ?? 0, o.y ?? 0, KIT, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlip(!!o.flipX, !!o.flipY).setVisible(false)
        .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      if (o.crop !== undefined) im.setCrop(0, fh * o.crop, fw, fh * (1 - o.crop));
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    let shown = false;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (!shown) { shown = true; if (this.broken(o.run)) { im.destroy(); gl?.destroy(); return false; } }
      if (this.gone(o.run)) { im.destroy(); gl?.destroy(); return false; }
      const u = Math.min(1, e / o.life);
      let x = o.x ?? 0, y = o.y ?? 0, d = o.depth ?? TOP;
      if (o.follow) { const p = o.follow(); if (p) { x = p.x; y = p.y; d = p.d + (o.dz ?? 3); } }
      x += o.mx?.(u) ?? 0; y += o.my?.(u) ?? 0;
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0);
      const fl = o.flick ? (Math.floor(e / o.flick) % 2 === 1) !== !!o.flipX : !!o.flipX;
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al).setFlipX(fl);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.04, sy * 1.04).setAngle(ang).setDepth(d + 0.01).setAlpha(al * o.glow!).setFlipX(fl);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
    return im;
  }

  /** A piece lying on the floor (drawn from above): flattened into the floor's perspective, turning in its plane. */
  private floor(name: string, x: number, y: number, w: number, life: number, o: { a?: (u: number) => number; s?: (u: number) => number; spin?: number; angle?: number;
    depth?: number; delay?: number; add?: boolean; glow?: number; squash?: number; run?: CastRun; h?: number; tint?: number } = {}): void {
    const s = this.ctx.scene;
    if (!s.textures.exists(KIT)) return;
    const fr = s.textures.getFrame(KIT, name); if (!fr) return;
    const mk = (glow: boolean) => {
      const im = s.add.image(0, 0, KIT, name).setDisplaySize(w, o.h ?? (w * fr.height) / fr.width).setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    const box = s.add.container(x, y, gl ? [im, gl] : [im]).setScale(1, o.squash ?? SQUASH).setDepth(o.depth ?? GROUND + 2).setVisible(false);
    const k0 = im.scaleX, k1 = im.scaleY;
    let shown = false;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (!shown) { shown = true; if (this.broken(o.run)) { box.destroy(); return false; } box.setVisible(true); }
      if (this.gone(o.run)) { box.destroy(); return false; }
      const u = Math.min(1, e / life), k = o.s?.(u) ?? 1, ang = (o.angle ?? 0) + (o.spin ?? 0) * u;
      im.setScale(k0 * k, k1 * k).setAngle(ang); gl?.setScale(k0 * k * 1.03, k1 * k * 1.03).setAngle(ang).setAlpha(o.glow ?? 0);
      box.setAlpha(Math.max(0, Math.min(1, o.a?.(u) ?? 1)));
      if (u >= 1) { box.destroy(); return false; }
      return true;
    } });
  }

  /** A sword cut: grows along its arc with a short sweep, holds a moment, thins out. `w` = its drawn width. */
  private cut(name: string, w: number, angle: number, o: { x?: number; y?: number; depth?: number; follow?: () => Pt | null; dz?: number; flipX?: boolean; flipY?: boolean; h?: number;
    grow?: number; hold?: number; fade?: number; glow?: number; delay?: number; sweep?: number; run?: CastRun } = {}): void {
    const g = o.grow ?? 55, hd = o.hold ?? 35, f = o.fade ?? 150, life = g + hd + f, ug = g / life, uh = (g + hd) / life, sw = (o.sweep ?? 14) * (o.flipY ? -1 : 1) * (o.flipX ? -1 : 1);
    this.spr({ name, x: o.x, y: o.y, depth: o.depth ?? TOP + 3, follow: o.follow, dz: o.dz, w, h: o.h, angle, flipX: o.flipX, flipY: o.flipY, delay: o.delay, life, glow: o.glow ?? 0.55, run: o.run,
      sx: kf([0, 0.3], [ug, 1, out3], [1, 1.06]), sy: kf([0, 0.7], [ug, 1, out], [uh, 1], [1, 0.2, inQ]), a: kf([0, 0.85], [ug, 1], [uh, 1], [1, 0, inQ]), rot: kf([0, -sw], [ug, 0, out]) });
  }

  /** A burst / spark: pops out, spreads a little, fades. */
  private pop(name: string, x: number, y: number, size: number, o: { depth?: number; life?: number; glow?: number; angle?: number; delay?: number; oy?: number; add?: boolean; run?: CastRun } = {}): void {
    this.spr({ name, x, y, depth: o.depth ?? TOP + 4, w: size, life: o.life ?? 240, delay: o.delay, oy: o.oy, add: o.add, run: o.run, angle: o.angle ?? rnd(-25, 25), glow: o.glow ?? 0.6,
      sx: kf([0, 0.45], [0.2, 1.05, out3], [1, 1.2]), sy: kf([0, 0.45], [0.2, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
  }

  /** Cherry-blossom petals scattered from (x, y), fluttering down as they fade. */
  private petals(x: number, y: number, n: number, spread: number, o: { depth?: number; up?: number; life?: number; delay?: number; inward?: boolean } = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = spread * rnd(0.35, 1), life = (o.life ?? 950) * rnd(0.7, 1.3), up = o.up ?? 0;
      const tx = Math.cos(a) * d, ty = Math.sin(a) * d * 0.55 - up, spin = (Math.random() < 0.5 ? -1 : 1) * rnd(200, 520), ph = Math.random() * 6;
      this.spr({ name: i % 7 === 6 ? 'blossom' : `petal_${1 + (i % 4)}`, x, y, depth: o.depth ?? TOP + 2, w: i % 7 === 6 ? 20 : rnd(13, 21), life, delay: o.delay, angle: Math.random() * 360,
        mx: o.inward ? (u) => tx * (1 - out(u)) : (u) => tx * out(u), my: o.inward ? (u) => ty * (1 - out(u)) - 20 * u : (u) => ty * out(u) + 46 * u * u,
        rot: (u) => spin * u, a: o.inward ? kf([0, 0], [0.2, 1], [0.85, 1], [1, 0]) : kf([0, 1], [0.6, 1], [1, 0]), sx: (u) => 0.55 + 0.45 * Math.abs(Math.cos(u * 8 + ph)) });
    }
  }

  /** A shockwave ring on the floor (its colour drawn solid, its light added over it: it reads on bright floors too). */
  private shock(x: number, y: number, w: number, o: { delay?: number; tint?: number; life?: number } = {}): void {
    this.spr({ name: 'shock_ring', x, y, depth: GROUND + 2.5, w, delay: o.delay, glow: 0.6, tint: o.tint, life: o.life ?? 420, sx: kf([0, 0.25], [1, 1.25, out3]), sy: kf([0, 0.25], [1, 1.25, out3]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
  }
  /** Dust kicked up: two puffs the colour of the ground rolling out to the sides, thinning as they go. */
  private dust(x: number, y: number, w: number, delay = 0): void {
    for (const s of [-1, 1])
      this.spr({ name: 'dust', x: x + s * w * 0.1, y, oy: 0.85, depth: y + 2, w: w * 0.8, delay: delay + (s > 0 ? 30 : 0), life: 520, flipX: s < 0, tint: DUST,
        mx: (u) => s * w * 0.32 * out3(u), my: (u) => -10 * u,
        sx: kf([0, 0.35], [0.3, 1, out3], [1, 1.2]), sy: kf([0, 0.3], [0.3, 0.9, out3], [1, 1.05]), a: kf([0, 0], [0.07, 0.78], [0.45, 0.5], [1, 0, inQ]) });
  }
  private dustRing(x: number, y: number, w: number, delay = 0): void {
    this.spr({ name: 'dust_ring', x, y: y - 6, depth: y + 2, w, delay, life: 560, tint: DUST, sx: kf([0, 0.4], [1, 1.3, out3]), sy: kf([0, 0.4], [1, 1.25, out3]), a: kf([0, 0], [0.06, 0.75], [0.5, 0.5], [1, 0, inQ]) });
  }
  /** A glowing crack in the floor along `ang` (deg, on the floor), cooling down. */
  private crack(x: number, y: number, len: number, ang = rnd(-25, 25), delay = 0): void {
    this.floor('crack', x, y, len * 0.82, 1700, { angle: ang + CRACK_TILT, squash: 0.5, delay, glow: 0.7, depth: GROUND + 1.5, a: kf([0, 0], [0.04, 1], [0.6, 1], [1, 0, inQ]), s: kf([0, 0.7], [0.08, 1, out3]) });
  }
  /** A foe thrown up: a beam from under it and streaks of light and petals shooting up after it. */
  private launchBeam(x: number, y: number, h = 110): void {
    this.spr({ name: 'launch_beam', x, y: y + 4, oy: 0.95, depth: y + 3, w: h * 1.45, h, life: 280, glow: 0.3, sx: kf([0, 0.6], [1, 0.85]), sy: kf([0, 0.2], [0.3, 1, out3], [1, 1.15]), a: kf([0, 0.8], [0.35, 0.8], [1, 0, inQ]) });
    this.spr({ name: 'launch_streaks', x, y: y + 6, oy: 0.97, depth: y + 3.2, w: h * 0.78, h: h * 1.35, life: 440, glow: 0.35, my: (u) => -46 * out(u),
      sy: kf([0, 0.25], [0.3, 1, out3], [1, 1.2]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 1], [0.45, 0.9], [1, 0, inQ]) });
  }
  /** A power aura flaring up round him (aura_gold / aura_crimson): flames rising from a ring at his feet, flaring, fading —
   *  behind him, the ring's near rim over his feet. */
  private auraFlare(r: CastRun, name: string, w: number, life: number, delay = 0): void {
    const f = () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z + 8, d: c.y } : null; };
    const m = { sx: kf([0, 0.6], [0.22, 1.04, out3], [1, 1.1]), sy: kf([0, 0.15], [0.22, 1.06, out3], [1, 1.18]), a: kf([0, 0], [0.06, 1], [0.55, 0.85], [1, 0, inQ]) };
    this.spr({ name, w, life, delay, oy: 0.92, follow: f, dz: -2.3, glow: 0.55, run: r, ...m });
    this.spr({ name, w, life, delay, oy: 0.92, follow: f, dz: 2.3, crop: 0.86, glow: 0.4, run: r, ...m });
  }
  /** A silhouette of the samurai standing (his body as drawn now, in ink with a crimson edge) at feet (x, y). */
  private silhouette(r: CastRun, x: number, y: number, depth: number, life: number, o: { delay?: number; face?: number; a?: (u: number) => number; scale?: number } = {}): void {
    const b = this.ctx.body?.(r.attackerId); if (!b) return;
    const s = this.ctx.scene, k = o.scale ?? 1, flip = o.face === undefined ? b.flipX : (o.face < 0) !== (sideOf(r) < 0) ? !b.flipX : b.flipX;
    const mk = (fill: number, kk: number) => s.add.image(x, y, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx * k * kk, b.sy * k * kk).setFlipX(flip).setTintFill(fill).setVisible(false);
    const rim = mk(0xff3048, 1.07).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y + 3).setDepth(depth - 0.01), ink = mk(0x12040a, 1).setDepth(depth);
    const al = o.a ?? kf([0, 0], [0.2, 0.85], [0.7, 0.85], [1, 0]);
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (this.broken(r)) { rim.destroy(); ink.destroy(); return false; }
      const u = Math.min(1, e / life), a = al(u);
      rim.setVisible(true).setAlpha(0.85 * a); ink.setVisible(true).setAlpha(0.92 * a);
      if (u >= 1) { rim.destroy(); ink.destroy(); return false; }
      return true;
    } });
  }
  /** Stunned (the AMBUSH): a crown of petals circling over the head for `ms`. */
  stunCrown(id: string, ms: number): void {
    if (!this.ready) return;
    const f = () => { const t = this.ctx.targetPos?.(id) ?? this.ctx.casterPos(id); return t ? { x: t.x, y: t.y - t.z - ((t as { h?: number }).h ?? 96) - 6, d: TOP } : null; }; // (round the top of the head)
    this.spr({ name: 'stun_crown', w: 88, life: ms, follow: f, dz: 2, flick: 140, glow: 0.55, rot: (u) => 6 * Math.sin(u * 20),
      sx: kf([0, 0.4], [0.15, 1, back]), sy: kf([0, 0.4], [0.15, 1, back]), a: kf([0, 0], [0.1, 1], [0.85, 1], [1, 0]) });
    // and stars circling round it (the near ones over it, the far ones under it)
    const s = this.ctx.scene, stars = [0, 1, 2].map(() => s.add.image(0, 0, KIT, 'glint').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a8).setVisible(false));
    this.add({ t: 0, step: (_dt, t) => {
      const p = f(), u = t / ms;
      if (!p || u >= 1) { for (const im of stars) im.destroy(); return false; }
      const al = Math.min(1, t / 90) * Math.min(1, (1 - u) / 0.15);
      stars.forEach((im, k) => {
        const th = t * 0.011 + (k * Math.PI * 2) / 3, sn = Math.sin(th);
        im.setVisible(true).setPosition(p.x + Math.cos(th) * 34, p.y + sn * 10).setDepth(TOP + (sn > 0 ? 3 : 1)).setScale(0.09 + 0.02 * sn).setAngle(t * 0.3).setAlpha(al * (sn > 0 ? 1 : 0.6));
      });
      return true;
    } });
  }
  /** Bound (Sakura Bind): a ring of petals round the shins, and a ring of fallen petals on the stones round the feet that
   *  closes in as the bind runs out (natural petals — no glow). */
  private bindMark(x: number, y: number, hold: number): void {
    this.spr({ name: 'petal_ring', x, y: y + 3, depth: y - 1, w: 128, life: hold, tint: 0xf0c2ca,
      sx: kf([0, 1.25], [0.08, 1, out3], [1, 0.42]), sy: kf([0, 1.25], [0.08, 0.7, out3], [1, 0.3]), a: kf([0, 0], [0.06, 0.9], [0.9, 0.85], [1, 0]) });
    for (const [crop, z] of [[undefined, -2], [0.5, 2]] as const)
      this.spr({ name: 'petal_ring', x, y: y - 24, depth: y + z, w: 92, life: hold, crop, flick: 170,
        sx: kf([0, 0.4], [0.12, 1, back]), sy: kf([0, 0.4], [0.12, 1, back]), a: kf([0, 0], [0.1, 0.9], [0.88, 0.9], [1, 0]) });
  }
  /** The blade's glint at the hand (or in front of the chest): a four-pointed star that flares and turns. */
  private glint(r: CastRun, delay: number, size: number, dz = 62): void {
    const f = this.front(r, 16, dz);
    this.spr({ name: 'glint', w: size * 1.5, delay, life: 300, run: r, glow: 0.8, dz: 6,
      follow: () => { const h = this.ctx.hand(r.attackerId), p = f(); return h && p ? { x: h.x, y: h.y, d: p.d } : p; },
      sx: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), sy: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]), rot: (u) => 45 * (1 - out(u)) });
  }

  // ------------------------------------------------------------------ strips: a picture bent along a path

  /** A strip of a picture bent along points (a rope: no seams, whatever the curve), each point as wide as its half-width
   *  and as bright as its alpha — the dragon's body and tail, a ribbon of light. Points run from the picture's left end to
   *  its right end; `flipY` turns the picture over (its top below the path), `flipX` runs it the other way along. */
  private strip(name: string | undefined, n: number, o: { add?: boolean; flipX?: boolean; flipY?: boolean; tint?: number; key?: string; vertical?: boolean } = {}) {
    const s = this.ctx.scene, pts = Array.from({ length: n }, (_, i) => new Phaser.Math.Vector2(i, 0));
    const rope = s.add.rope(0, 0, o.key ?? KIT, name, pts, true).setVisible(false);
    if (o.add) rope.setBlendMode(Phaser.BlendModes.ADD);
    if (o.flipX) rope.flipX = true;
    if (o.flipY) rope.flipY = true;
    if (o.tint !== undefined) rope.setColors(o.tint);
    const w = new Float32Array(n), up = !!o.vertical;
    (rope as unknown as { updateVertices(): unknown }).updateVertices = function (this: Phaser.GameObjects.Rope) {
      const P = this.points, V = this.vertices;
      this.dirty = false;
      if (up) { for (let i = 0; i < n; i++) { V[i * 4] = V[i * 4 + 2] = P[i].x; V[i * 4 + 1] = P[i].y - w[i]; V[i * 4 + 3] = P[i].y + w[i]; } return this; } // (a band upright on a curve: a wall)
      let px = 0, py = -1;
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
        if (l > 1e-4) { px = dy / l; py = -dx / l; } // (a point on top of its neighbours keeps the last direction)
        V[i * 4] = P[i].x + px * w[i]; V[i * 4 + 1] = P[i].y + py * w[i]; V[i * 4 + 2] = P[i].x - px * w[i]; V[i * 4 + 3] = P[i].y - py * w[i];
      }
      return this;
    };
    return {
      rope,
      /** Lays it out: point i at `at(i)`, half as wide as `hw(i)`, as bright as `av(i)`. */
      set: (at: (i: number) => { x: number; y: number }, hw: (i: number) => number, av: (i: number) => number, cv?: (i: number) => number): void => {
        const al = rope.alphas, co = rope.colors;
        for (let i = 0; i < n; i++) { const p = at(i); pts[i].set(p.x, p.y); w[i] = hw(i); al[i * 2] = al[i * 2 + 1] = Math.max(0, Math.min(1, av(i))); if (cv) co[i * 2] = co[i * 2 + 1] = cv(i); }
        rope.setDirty().setVisible(true);
      },
      /** Where along its picture each point lies (0..1 across it): a picture sliding along the strip. */
      uv: (u: (i: number) => number): void => { const U = rope.uv; for (let i = 0; i < n; i++) { U[i * 4] = U[i * 4 + 2] = u(i); U[i * 4 + 1] = 0; U[i * 4 + 3] = 1; } },
      destroy: (): void => { rope.destroy(); },
    };
  }

  /** A band of light across its width (clear at its edges, crimson, a white-hot core): ribbons of light are drawn with it. */
  private ribbonTex(): string {
    const tm = this.ctx.scene.textures, key = 'sam-ribbon';
    if (!tm.exists(key)) {
      const c = tm.createCanvas(key, 8, 64);
      if (c) {
        const g = c.context, gr = g.createLinearGradient(0, 0, 0, 64);
        ([[0, 'rgba(255,40,72,0)'], [0.1, 'rgba(255,40,72,0.42)'], [0.26, 'rgba(255,66,94,0.92)'], [0.4, 'rgba(255,168,180,1)'], [0.5, 'rgba(255,250,250,1)'], [0.6, 'rgba(255,168,180,1)'],
          [0.74, 'rgba(255,66,94,0.92)'], [0.9, 'rgba(255,40,72,0.42)'], [1, 'rgba(255,40,72,0)']] as const)
          .forEach(([at, col]) => gr.addColorStop(at, col));
        g.fillStyle = gr; g.fillRect(0, 0, 8, 64); c.refresh();
      }
    }
    return key;
  }

  /** A band of wind going round (two turns of it side by side, so it slides round seamlessly): a crimson body fading to its
   *  edges and streaks of light, bright at their heads. */
  private windTex(): string {
    const tm = this.ctx.scene.textures, key = 'sam-wind';
    if (tm.exists(key)) return key;
    const W = 512, H = 64, P = 256, c = tm.createCanvas(key, W, H);
    if (!c) return key;
    const g = c.context;
    let seed = 11;
    const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // the body: crimson wind, denser in patches (periodic: two turns side by side), fading to its edges
    const k1 = rr() * 6, k2 = rr() * 6;
    for (let x = 0; x < W; x += 2) {
      const d = 0.72 + 0.16 * Math.sin((x / P) * Math.PI * 2 * 2 + k1) + 0.12 * Math.sin((x / P) * Math.PI * 2 * 5 + k2);
      const col = g.createLinearGradient(0, 0, 0, H);
      col.addColorStop(0, 'rgba(176,14,40,0)'); col.addColorStop(0.14, 'rgba(176,14,40,0.06)'); col.addColorStop(0.5, `rgba(204,22,52,${(0.7 * d).toFixed(3)})`); col.addColorStop(0.86, 'rgba(176,14,40,0.06)'); col.addColorStop(1, 'rgba(176,14,40,0)');
      g.fillStyle = col; g.fillRect(x, 0, 2, H);
    }
    // wisps: soft, slanting a little (the wind climbs as it goes round), bright at their heads; and a few fine glints
    const wisp = (x: number, y: number, len: number, th: number, a: number, slant: number, soft: number) => {
      for (const ox of [-P, 0, P, 2 * P]) { // (each one in every turn: the picture repeats exactly)
        const lg = g.createLinearGradient(-len / 2, 0, len / 2, 0); // (in the wisp's own frame: it is drawn at the origin)
        lg.addColorStop(0, 'rgba(255,60,90,0)'); lg.addColorStop(0.55, `rgba(255,110,136,${(a * 0.8).toFixed(2)})`); lg.addColorStop(0.82, `rgba(255,214,222,${a.toFixed(2)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.save(); g.shadowColor = 'rgba(230,40,72,0.9)'; g.shadowBlur = soft; g.fillStyle = lg;
        g.translate(x + ox + len / 2, y); g.rotate(slant); g.beginPath(); g.ellipse(0, 0, len / 2, th / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
    };
    for (let i = 0; i < 18; i++) wisp(rr() * P, 18 + rr() * (H - 36), 34 + rr() * 70, 4 + rr() * 7, 0.45 + rr() * 0.45, -0.06 - rr() * 0.08, 7);
    for (let i = 0; i < 10; i++) wisp(rr() * P, 20 + rr() * (H - 40), 26 + rr() * 50, 1.2 + rr() * 1.6, 0.7 + rr() * 0.3, -0.06 - rr() * 0.06, 2);
    c.refresh();
    return key;
  }

  /** A ribbon of light behind a moving point (where it went in the last `span` ms): widest and brightest at its head,
   *  thinning to nothing at its tail; drawn solid with its light added over it. It stops growing when `at` gives nothing
   *  (or `until` ms pass) and fades out over `fade` ms. */
  private trail(at: (t: number) => Pt | null, o: { span: number; w: number; tint?: number; glow?: number; until?: number; fade?: number; delay?: number; run?: CastRun }): void {
    const key = this.ribbonTex(), N = 24, base = this.strip(undefined, N, { key, tint: o.tint }), light = this.strip(undefined, N, { key, add: true });
    const hist: { x: number; y: number; d: number; t: number }[] = [], fade = o.fade ?? 180;
    let stop = -1;
    const kill = () => { base.destroy(); light.destroy(); };
    this.add({ t: 0, step: (_dt, t0) => {
      const t = t0 - (o.delay ?? 0);
      if (t < 0) return true;
      if (this.gone(o.run) || (this.broken(o.run) && !hist.length)) { kill(); return false; }
      if (stop < 0) { const p = o.until !== undefined && t > o.until ? null : at(t); if (p) hist.push({ x: p.x, y: p.y, d: p.d, t }); else stop = t; }
      const now = stop < 0 ? t : stop;
      while (hist.length > 2 && hist[1].t < now - o.span) hist.shift();
      const k = stop < 0 ? 1 : 1 - (t - stop) / fade;
      if (k <= 0) { kill(); return false; }
      if (hist.length < 2) return true;
      const ta = Math.max(hist[0].t, now - o.span), tb = hist[hist.length - 1].t;
      let j = 0;
      const pos = (i: number) => { // (evenly in time from its tail to its head)
        const tt = ta + (tb - ta) * (i / (N - 1));
        while (j < hist.length - 2 && hist[j + 1].t < tt) j++;
        const p = hist[j], q = hist[Math.min(hist.length - 1, j + 1)], f = q.t > p.t ? Math.max(0, Math.min(1, (tt - p.t) / (q.t - p.t))) : 1;
        return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
      };
      const hw = (i: number) => o.w * 0.5 * Math.pow(i / (N - 1), 0.75), av = (i: number) => k * Math.min(1, (i / (N - 1)) * 1.6);
      j = 0; base.set(pos, hw, (i) => av(i) * 0.9);
      j = 0; light.set(pos, (i) => hw(i) * 0.62, (i) => av(i) * (o.glow ?? 0.8));
      const d = hist[hist.length - 1].d;
      base.rope.setDepth(d); light.rope.setDepth(d + 0.01);
      return true;
    } });
  }

  // ------------------------------------------------------------------ the dragon

  /** The crimson dragon as one living body: its body and its tail are strips bent along one path (no seams, whatever the
   *  curve), the body thinning toward the tail, the head at the front with its glow, two clawed legs under the body.
   *  `place(path, neck, alpha, melt)` lays it along a path (s ↦ point, s = the distance along it) with its neck at distance
   *  `neck`; what lies before the path's start (s < 0, still in the floor) is not drawn; `melt` (0..1) melts it away from
   *  its tail tip to its head. `flip`: its back stays up when it flies to the left (the picture turned over). */
  private serpent(thick: number, o: { glow?: number; flip?: boolean } = {}) {
    const s = this.ctx.scene, NB = 28, NT = 12, flip = !!o.flip, glow = o.glow ?? 0.35, ADD = Phaser.BlendModes.ADD;
    const LB = thick * 7.2, LT = thick * 4.4, all = LB + LT;
    const body = this.strip('dragon_body', NB, { flipY: flip }), shine = this.strip('dragon_body', NB, { add: true, flipY: flip });
    const tail = this.strip('dragon_tail', NT, { flipX: true, flipY: flip });
    const head = s.add.image(0, 0, KIT, 'dragon_head').setOrigin(0.06, 0.62).setVisible(false).setFlipY(flip);
    const hg = s.add.image(0, 0, KIT, 'dragon_head').setOrigin(0.06, 0.62).setBlendMode(ADD).setVisible(false).setFlipY(flip);
    const claws = [0, 1].map(() => s.add.image(0, 0, KIT, 'dragon_claw').setOrigin(0.1, 0.24).setVisible(false).setFlipY(flip));
    const hk = (thick * 1.7) / head.height, ck = (thick * 1.1) / claws[0].height;
    const sm = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
    const tangent = (path: (sv: number) => Pt, sv: number) => { const a = path(Math.max(0, sv - 6)), b = path(Math.max(0, sv) + 6); return Math.atan2(b.y - a.y, b.x - a.x); };
    return {
      /** its whole length (tail tip to the jaws) */
      length: all + thick * 3.9,
      place: (path: (sv: number) => Pt, neck: number, alpha: number, melt = 0): void => {
        const tip = neck - all, out = (sv: number) => (sv < 0 ? 0 : Math.min(1, sv / 14)); // (fades out where it goes into the floor)
        const gone = (sv: number) => sm(((sv - tip) / all - melt * 1.2 + 0.2) / 0.2); // (melted away from the tail tip up)
        const P = (sv: number) => path(Math.max(0, sv));
        const sb = (i: number) => neck - LB * (1 - i / (NB - 1)), st = (j: number) => tip + LT * (j / (NT - 1));
        const bw = (i: number) => thick * 0.5 * (0.8 + 0.32 * sm(i / (NB * 0.6)));
        body.set((i) => P(sb(i)), bw, (i) => alpha * out(sb(i)) * gone(sb(i)));
        shine.set((i) => P(sb(i)), (i) => bw(i) * 1.06, (i) => alpha * out(sb(i)) * gone(sb(i)) * glow * 0.6);
        tail.set((j) => P(st(j)), () => thick * 0.46, (j) => alpha * out(st(j)) * gone(st(j)));
        const n = P(neck), d = n.d, a0 = tangent(path, neck), ah = alpha * out(neck) * gone(neck);
        body.rope.setDepth(d); shine.rope.setDepth(d + 0.005); tail.rope.setDepth(d - 0.01);
        for (const h of [head, hg]) h.setVisible(ah > 0.01).setPosition(n.x, n.y).setRotation(a0).setScale(hk).setDepth(d + (h === hg ? 0.03 : 0.02));
        head.setAlpha(ah); hg.setAlpha(ah * glow);
        [0.16, 0.6].forEach((f, k) => { // the legs: from under the body, reaching forward
          const sv = neck - LB * f, p = P(sv), ang = tangent(path, sv), bx = Math.sin(ang) * (flip ? -1 : 1), by = -Math.cos(ang) * (flip ? -1 : 1);
          claws[k].setVisible(ah > 0.01 && sv > 0).setPosition(p.x - bx * thick * 0.22, p.y - by * thick * 0.22).setRotation(ang + (flip ? -0.6 : 0.6)).setScale(ck)
            .setDepth(d - 0.02).setAlpha(alpha * out(sv) * gone(sv));
        });
      },
      /** a point along it (0 tail tip .. 1 neck), for sparks */
      at: (path: (sv: number) => Pt, neck: number, u: number): Pt => path(Math.max(0, neck - all * (1 - u))),
      destroy: (): void => { body.destroy(); shine.destroy(); tail.destroy(); for (const im of [head, hg, ...claws]) im.destroy(); },
    };
  }

  // ------------------------------------------------------------------ cast timeline

  /** His shadow doubles (Kagemusha) swing with him: the same picture drawn from where each of them stands — the run seen
   *  from there (a run of its own, so it follows the double; everything else is read live from his run). */
  private shadows(r: CastRun): CastRun[] {
    if (r.skill.id === 'kagemusha' || r.skill.id === 'dragon_eclipse') return []; // (the ultimate is his alone: the doubles burst at its cut)
    const gs = this.ctx.ghosts?.(r.attackerId) ?? [];
    if (!gs.length) return [];
    const me = this.ctx.casterPos(r.attackerId) ?? r.origin;
    return gs.map((g) => {
      const dx = g.x - me.x, dy = g.y - me.y, o = Object.create(r) as CastRun;
      o.attackerId = `${r.attackerId}#${g.k}`; o.castId = `${r.castId}#${g.k}`; o.own = false;
      o.origin = { x: r.origin.x + dx, y: r.origin.y + dy, z: r.origin.z };
      o.place = r.place ? { x: r.place.x + dx, y: r.place.y + dy } : null;
      return o;
    });
  }

  /** The wind-up (and whatever runs through the whole cast). */
  cast(r: CastRun): void {
    if (!this.ready) return;
    this.castOne(r, false);
    for (const g of this.shadows(r)) this.castOne(g, true);
  }
  private castOne(r: CastRun, ghost: boolean): void {
    const s = r.skill, T = r.timings;
    switch (s.id) {
      case 'quick_slash': if ((r.stage ?? 0) === 3) this.glint(r, T.startup * 0.3, 30); break;
      case 'shadow_step': this.glint(r, 0, 26, 50); break;
      case 'swallow_cut': case 'spin_cut': this.glint(r, 0, 24); break;
      case 'sword_wave': this.glint(r, 0, 34, 80); break;
      case 'iai_strike': this.iai(r); break;
      case 'mirage': this.mirageStance(r); break;
      case 'blossom_storm': this.blossomStorm(r); break;
      case 'dragon_eclipse': this.eclipse(r); break;
      case 'kagemusha': this.glint(r, 0, 26, 52); this.petals(this.me(r).x, this.me(r).y - this.me(r).z - 50, 8, 80, { inward: true, life: T.startup + 60 }); break;
      case 'tornado_blade': this.tornado(r); break;
      case 'falcon_dive': this.falcon(r); break;
      case 'rising_sun': this.risingSun(r); break;
      case 'phantom_blades': if (!ghost) this.ctx.darken(T.startup + T.active + 160, 0.38); this.phantomField(r); break;
      case 'god_of_blades': this.halo(r); break;
      case 'sakura_bind': this.bind(r); break;
      case 'dragon_ascension': this.ascension(r); break;
    }
  }

  /** The release (active start). */
  active(r: CastRun): void {
    if (!this.ready) return;
    for (const g of [r, ...this.shadows(r)]) {
      if (g.skill.id === 'shadow_step') this.stepStreak(g);
      if (g.skill.id === 'spin_cut') this.spinRing(g, 0);
    }
  }

  /** One hit of a cast as it fires (the swing that goes with it). */
  hit(r: CastRun, i: number, o: V3): void {
    if (!this.ready) return;
    this.hitOne(r, i, o);
    for (const g of this.shadows(r)) this.hitOne(g, i, { x: o.x + g.origin.x - r.origin.x, y: o.y + g.origin.y - r.origin.y, z: o.z });
  }
  private hitOne(r: CastRun, i: number, o: V3): void {
    const s = r.skill, side = sideOf(r), q = this.ctx.casterPos(r.attackerId) ?? o, y0 = q.y - q.z, cam = this.ctx.cam();
    switch (s.id) {
      case 'quick_slash': this.quickSlash(r, i); break;
      case 'swallow_cut': this.swallow(r, i); break;
      case 'iai_strike': this.iaiCut(r); break;
      case 'spin_cut': if (i === 1) this.spinRing(r, 1); break;
      case 'hundred_cuts': this.flurry(r, i); break;
      case 'mirage': // the counter cut, from behind: a great draw-cut across the attacker
        this.cut('cut_heavy', 236, side * 8, { x: q.x + side * 58, y: y0 - 56, depth: TOP + 3, flipX: side < 0, grow: 60, hold: 60, fade: 220, glow: 0.7 });
        this.spr({ name: 'blade_trail', x: q.x + side * 40, y: y0 - 52, w: 220, life: 260, flipX: side < 0, angle: side * 6, glow: 0.4, sx: kf([0, 0.6], [0.2, 1, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
        this.spr({ name: 'cut_line', x: q.x + side * 6, y: y0 - 58, ox: side > 0 ? 0.03 : 0.97, flipX: side < 0, w: 270, h: 18, depth: TOP + 3.2, life: 250, glow: 0.85,
          sx: kf([0, 0.1], [0.16, 1, out3]), sy: kf([0, 1.3], [1, 0.3, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
        if (r.own) this.ctx.cam().shake(150, 0.005);
        break;
      case 'kagemusha': this.kageVanish(r.origin); break; // he vanishes where he stood (every screen, from the cast)
      case 'falcon_dive': if (i === 1) this.falconImpact(r); else this.cut('cut_thin', 120, side * 30, { x: q.x + side * 30, y: y0 - 40, depth: q.y + 4, flipX: side < 0 }); break;
      case 'rising_sun': this.sunBurst(r); break;
      case 'phantom_blades': this.phantom(r, i); break;
      case 'god_of_blades': this.shock(q.x, q.y, 300); this.petals(q.x, y0 - 80, 12, 120); this.auraFlare(r, 'aura_gold', 180, 820); break;
      case 'sakura_bind': this.bloom(r); break;
      case 'dragon_ascension': if (i === 0) this.ascensionBurst(r); else this.cut('cut_thin', 150, rnd(-30, 30), { x: q.x + rnd(-60, 60), y: y0 - 90 - i * 70, depth: TOP + 3, flipX: Math.random() < 0.5 }); break;
      case 'blossom_storm': this.stormCut(r, i); break;
      case 'dragon_eclipse': if (i < r.hits.length - 1) this.eclipseSlash(r, i); else this.eclipseCut(r, o); break;
      case 'tornado_blade': this.pop('burst', q.x + r.aim.x * 90, y0 - 40, 120); break;
    }
    void cam;
  }

  /** The line a hit's cut leaves on the foe (deg on screen, for a swing to the right; null: not a cut — a burst instead). */
  private slashLine(s: FinalSkill, hit: HitEvent): { ang: number; double?: boolean } | null {
    const i = s.hits.indexOf(hit), R = () => rnd(-60, 60);
    switch (s.id) {
      case 'quick_slash': {
        const st = s.chain?.stages.findIndex((x) => x.includes(hit)) ?? 0;
        if (st === 1) return { ang: -32 };
        if (st === 2) return { ang: s.chain!.stages[2].indexOf(hit) === 0 ? 30 : -30, double: true };
        return st === 3 ? { ang: -72 } : { ang: 38 };
      }
      case 'shadow_step': return { ang: 4 };
      case 'swallow_cut': return { ang: i === 1 ? 55 : -70 };
      case 'iai_strike': return { ang: 2 };
      case 'spin_cut': return { ang: i === 1 ? -14 : 12 };
      case 'sword_wave': return { ang: 76 };
      case 'hundred_cuts': return hit.heavy ? { ang: 18 } : { ang: R(), double: Math.random() < 0.4 };
      case 'mirage': return { ang: 24 };
      case 'blossom_storm': return { ang: hit.heavy ? -70 : rnd(-50, 50) };
      case 'dragon_eclipse': return { ang: hit.heavy ? 0 : rnd(-80, 80) };
      case 'falcon_dive': return { ang: i === 0 ? 78 : -80 };
      case 'dragon_ascension': return { ang: i === 0 ? -80 : R() };
      case 'god_of_blades': return i === 0 ? null : { ang: rnd(38, 58) }; // (its strikes: the halo's katanas, stabbing down into the foe)
      case 'tornado_blade': case 'phantom_blades': return { ang: R() };
    }
    return null; // (Rising Sun, Sakura Bind, Kagemusha: light, blossoms, ink — no blade)
  }

  /** A confirmed hit on a foe: a real cut of the blade across it along the swing (heavier and brighter for heavy and
   *  critical hits), sparks sprayed the way it is thrown, and the shared marks of what happened to it. `from`: where the
   *  blow came from (the cut and the sparks face away from there). */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, reaction: string, heavy: boolean, crit: boolean, from?: { x: number; y: number }, local = false): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z - 38, rapid = s.hits.length > 3 && !hit.heavy, side = from && at.x < from.x - 2 ? -1 : 1;
    const line = this.slashLine(s, hit), ang = line ? side * line.ang : 0;
    if (line) {
      const name = crit || (heavy && !rapid) ? 'slash_hit_heavy' : line.double ? 'slash_hit_double' : 'slash_hit';
      const w = crit ? (rapid ? 170 : 230) : heavy && !rapid ? 196 : rapid ? 112 : line.double ? 160 : 150, life = crit ? 320 : heavy ? 280 : rapid ? 170 : 220;
      this.spr({ name, x, y, depth: TOP + 4, w, life, angle: ang - SLASH_TILT, glow: crit ? 0.45 : heavy ? 0.35 : 0.2,
        sx: kf([0, 0.5], [0.16, 1.06, out3], [1, 1.14]), sy: kf([0, 0.5], [0.16, 1.06, out3], [1, 1.14]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      if (crit) this.pop('burst_crit', x, y, rapid ? 100 : 130, { life: 260, depth: TOP + 3.6, glow: 0.3 });
    } else if (s.id === 'sakura_bind') { // the bind: blossoms burst open on the foe (natural, no spark of a blade)
      this.spr({ name: 'blossom_burst', x, y: y - 4, w: crit ? 140 : 112, life: 440, depth: TOP + 3.5, angle: rnd(0, 360), glow: 0.12,
        sx: kf([0, 0.3], [0.25, 1, back], [1, 1.12]), sy: kf([0, 0.3], [0.25, 1, back], [1, 1.12]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
      this.petals(x, y, 10, 64, { depth: TOP + 3 });
    } else if (crit) this.pop('burst_crit', x, y, rapid ? 120 : 165, { life: 300 });
    else if (heavy && !rapid) this.pop('burst', x, y, 140, { life: 280 });
    else this.pop('spark_s', x, y, rapid ? 64 : 86, { life: 190 });
    if (crit) this.petals(x, y, 5, 56, { depth: TOP + 3 });
    const up = reaction === 'launch' || reaction === 'float', thrown = up || reaction === 'knockdown' || heavy || (hit.reaction.push ?? 0) >= 14;
    if (thrown && (!rapid || hit.heavy) && reaction !== 'cc') // sparks sprayed the way the foe is thrown (up when it is lifted)
      this.spr({ name: 'spark_spray', x: x - side * 8, y, ox: side > 0 ? 0.05 : 0.95, oy: 0.45, flipX: side < 0, depth: TOP + 3.8, w: heavy ? 168 : 126, life: 260,
        angle: up ? -side * 50 : side * rnd(-6, 10), sx: kf([0, 0.4], [0.25, 1, out3], [1, 1.12]), sy: kf([0, 0.6], [0.25, 1, out3]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    if (reaction === 'launch') this.launchBeam(at.x, at.y);
    if (reaction === 'knockdown' || reaction === 'slam') { this.crack(at.x, at.y + 2, 120); this.dust(at.x, at.y, 120); }
    if (s.id === 'sakura_bind' && reaction === 'cc') { const hold = hit.reaction.hardCC?.ms ?? 2000; this.cage(at.x, at.y, hold); this.bindMark(at.x, at.y, hold); }
    if (DELAYED.has(s.id) && (s.id !== 'dragon_eclipse' || hit.heavy)) { // the cut arrives late: a thin line stays on the foe a beat — then splits open
      const la = line ? ang : rnd(-28, 28);
      this.spr({ name: 'cut_line', x, y: y - 4, angle: la, w: 196, h: 12, depth: TOP + 5, life: 200, glow: 0.85, sx: kf([0, 0.25], [0.12, 1, out3]), a: kf([0, 1], [0.86, 1], [1, 0]) });
      this.later(190, () => {
        this.cut('cut_split', 196, la, { x, y: y - 4, depth: TOP + 5, grow: 35, hold: 70, fade: 230, glow: 0.8 });
        this.pop('blossom_burst', x, y - 4, 130, { life: 320, depth: TOP + 4.5, glow: 0.3, angle: rnd(0, 360) });
        this.petals(x, y, 8, 70, { depth: TOP + 3 });
        if (local) { this.ctx.cam().shake(90, 0.004); this.ctx.freeze?.(55); }
      });
    }
  }

  /** The Mirage Counter fired: time stops a beat; the blow cuts the mirage where he stood in two — its halves slide apart and
   *  melt into petals — while he is already behind the attacker: his path through it an ink stroke and a line of light,
   *  out of a swirl of ink the flash of his blade (the counter cut comes as its hit). */
  counter(r: CastRun): void {
    const m = this.stances.get(r.castId);
    if (!m || !this.ready) return;
    m.done = true;
    const q = this.me(r), toward = Math.sign(q.x - m.x) || sideOf(r);
    if (r.own) { this.ctx.freeze?.(70); this.ctx.darken(280, 0.32); }
    this.mirageCut(r, m, toward);
    // his path through the attacker: an ink stroke with a line of light along it, petals left hanging in it
    const x0 = m.x, y0 = m.y - m.z - 46, x1 = q.x, y1 = q.y - q.z - 46, L = Math.hypot(x1 - x0, y1 - y0), ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, dd = Math.max(m.y, q.y) + 2;
    if (L > 20) {
      this.spr({ name: 'ink_long', x: x0, y: y0, ox: 0.03, angle: ang, flipY: x1 < x0, w: L + 70, h: 30, depth: dd, life: 380,
        sx: kf([0, 0.25], [0.14, 1, out3]), sy: kf([0, 0.9], [0.14, 1], [1, 0.45, inQ]), a: kf([0, 0.6], [0.4, 0.45], [1, 0, inQ]) });
      this.spr({ name: 'cut_line', x: x0, y: y0, ox: 0.03, angle: ang, flipY: x1 < x0, w: L + 80, h: 16, depth: dd + 0.1, life: 280, glow: 0.85,
        sx: kf([0, 0.1], [0.18, 1, out3]), sy: kf([0, 1.3], [1, 0.3, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      for (let k = 0; k < 6; k++) { const f = (k + 0.5) / 6; this.petals(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 1, 18, { depth: dd + 1, life: 800 }); }
    }
    // he steps out behind the attacker: out of a swirl of ink, a flash of the blade, a ring of light at his feet
    this.spr({ name: 'ink_smoke', x: q.x, y: q.y - q.z - 44, depth: q.y + 4, w: 92, life: 320, sx: kf([0, 1.25], [1, 0.5, out]), sy: kf([0, 1.25], [1, 0.5, out]), a: kf([0, 0.65], [1, 0, inQ]), rot: (u) => -80 * u });
    this.pop('glint', q.x + sideOf(r) * 20, q.y - q.z - 56, 170, { life: 240, angle: 0, depth: TOP + 6, glow: 0.8 });
    this.shock(q.x, q.y, 150, { life: 320 });
    this.ctx.callout({ x: q.x, y: q.y, z: q.z + 50 }, 'COUNTER!!', '#ff8a96', 0);
    this.ctx.punch(0.035, 220);
  }

  /** The mirage the blow struck: his body as it stood, cut in two at the waist by a line of light — the halves slide apart
   *  (the top one away from the blow, tipping) and melt into petals as they go. */
  private mirageCut(r: CastRun, m: { x: number; y: number; z: number }, toward: number): void {
    const b = this.ctx.body?.(r.attackerId), x = m.x, y = m.y - m.z;
    // a puff of ink where he stood (he is gone from there: the halves are all that is left of him)
    this.spr({ name: 'ink_smoke', x, y: y - 50, depth: m.y + 0.6, w: 104, life: 480, sx: kf([0, 0.85], [1, 1.35, out3]), sy: kf([0, 0.95], [1, 1.3, out3]), a: kf([0, 0.8], [0.35, 0.7], [1, 0, inQ]), rot: (u) => 50 * u });
    if (b) {
      const s = this.ctx.scene, CUT = 0.5;
      const half = (top: boolean) => {
        const im = s.add.image(x, y, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx, b.sy).setFlipX(b.flipX).setTintFill(0xffc4ce).setDepth(m.y + 1.2); // (a ghost of light: not him)
        if (top) im.setCrop(0, 0, im.width, im.height * CUT); else im.setCrop(0, im.height * CUT, im.width, im.height * (1 - CUT));
        return im;
      };
      const up = half(true), low = half(false), H = up.height * b.sy, cy = y - (b.oy - CUT) * H;
      this.add({ t: 0, step: (_dt, t) => {
        const u = Math.min(1, t / 420), e = out(Math.max(0, (t - 50) / 370)); // (a beat cut through, then the halves part)
        up.setPosition(x - toward * 40 * e, y - 24 * e - 12 * u * u).setAngle(-toward * 14 * e).setAlpha(0.88 * (1 - inQ(u)));
        low.setPosition(x + toward * 10 * e, y + 2 * e).setAngle(toward * 3 * e).setAlpha(0.88 * (1 - inQ(Math.min(1, u * 1.15))));
        if (u >= 1) { up.destroy(); low.destroy(); return false; }
        return true;
      } });
      for (let k = 0; k < 7; k++) this.later(40 + k * 45, () => this.petals(x - toward * rnd(0, 24), cy - rnd(-34, 50), 2, 26, { depth: m.y + 3, life: 900 })); // (melting into petals)
      this.spr({ name: 'cut_line', x, y: cy, w: 170, h: 16, angle: -toward * 6, depth: m.y + 4, life: 280, glow: 1,
        sx: kf([0, 0.1], [0.15, 1, out3], [1, 1.1]), sy: kf([0, 1.4], [1, 0.2, inQ]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
      this.pop('blossom_burst', x, cy, 96, { depth: m.y + 3.5, life: 360, glow: 0.2, delay: 50 });
    }
    this.petals(x, y - 56, 12, 90, { depth: m.y + 5 });
  }

  // ------------------------------------------------------------------ skills

  private quickSlash(r: CastRun, i: number): void {
    const st = r.stage ?? 0, side = sideOf(r), fl = side < 0;
    if (st === 0) this.cut('cut_thin', 128, side * 14, { follow: this.front(r, 46, 54), flipX: fl });
    else if (st === 1) this.cut('cut_thin', 128, -side * 12, { follow: this.front(r, 46, 50), flipX: fl, flipY: true });
    else if (st === 2) {
      this.cut('cut_thin', 138, side * (i === 0 ? 36 : -36), { follow: this.front(r, 50, 56), flipX: fl, flipY: i === 1 });
      if (i === 1) { const p = this.front(r, 52, 56)(); if (p) this.pop('spark_s', p.x, p.y, 74, { depth: p.d + 5 }); }
    } else {
      this.cut('cut_rise', 152, 0, { follow: this.front(r, 42, 86), flipX: fl, grow: 70, hold: 50, fade: 190, glow: 0.7 });
      const p = this.front(r, 44, 96)(); if (p) this.petals(p.x, p.y, 9, 60, { depth: p.d + 4 });
    }
  }

  /** Shadow Step: the ink streak — anchored where he started, its head stays on him through the step, then it dries out. */
  private stepStreak(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, o = r.origin, a = r.aim, side = sideOf(r), D = r.skill.dash?.distance ?? 160;
    const ang = screenAng(a.x, a.y), x0 = o.x - a.x * 34, y0 = o.y - a.y * 34 - o.z - 48, flip = side < 0;
    const ink = s.add.image(x0, y0, KIT, 'ink_long').setOrigin(0.03, 0.55).setAngle(ang).setFlipY(flip).setDepth(o.y + 2).setAlpha(0);
    const line = s.add.image(x0, y0, KIT, 'cut_line').setOrigin(0.03, 0.5).setAngle(ang).setFlipY(flip).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.y + 2.1).setAlpha(0);
    const iw = ink.width, lw = line.width;
    let len = 30;
    this.add({ t: 0, step: (_dt, t) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (t <= T.active + 40 && c) len = Math.min(D + 110, Math.max(len, Math.hypot(c.x - x0, c.y - c.z - 48 - y0) + 50));
      const fade = Math.max(0, (t - T.active) / 420), k = 1 - fade;
      ink.setScale(len / iw, (48 / ink.height) * (0.6 + 0.4 * k)).setAlpha(Math.min(1, t / 40) * k);
      line.setScale(len / lw, (16 / line.height) * k).setAlpha(Math.min(1, t / 40) * Math.max(0, 1 - (t - T.active) / 160));
      if (fade >= 1) { ink.destroy(); line.destroy(); return false; }
      return true;
    } });
    for (let k = 0; k < 3; k++) { // his silhouettes along the path, one after another, fading
      const f = 0.22 + k * 0.24;
      this.silhouette(r, o.x + a.x * D * f, o.y + a.y * D * f - o.z, o.y + a.y * D * f + 1, 300, { delay: k * 34, face: side, a: kf([0, 0], [0.12, 0.8], [0.4, 0.6], [1, 0, inQ]) });
    }
    this.later(T.active, () => { // he lands: out of a swirl of ink, the blade's glint
      const c = this.ctx.casterPos(r.attackerId); if (!c) return;
      this.petals(c.x, c.y - c.z - 50, 8, 56, { depth: c.y + 4 });
      this.spr({ name: 'ink_smoke', x: c.x, y: c.y - c.z - 46, depth: c.y + 3, w: 104, life: 300, sx: kf([0, 1.25], [1, 0.5, out]), sy: kf([0, 1.25], [1, 0.5, out]), a: kf([0, 0.75], [1, 0, inQ]), rot: (u) => -80 * u });
      this.glint(r, 0, 24, 56);
    }, r);
  }

  /** Swallow Cut, read at a glance: one ribbon of light traces the blade — up from the floor in front of him in a rising
   *  crescent that throws the foe up, a flash where it turns at the top, straight back down through the foe in the air
   *  (a Λ: a swallow's tail). */
  private swallow(r: CastRun, i: number): void {
    const side = sideOf(r), fl = side < 0, ret = r.skill.hits[1]?.at ?? 130;
    if (i === 0) {
      // the point of the blade: up from his front foot to over the foe, a hook at the top, down to the floor beyond it
      const bz = (u: number, a: number[], c: number[], b: number[]) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
      const tip = (t: number): Pt | null => {
        const c = this.ctx.casterPos(r.attackerId); if (!c) return null;
        const [dx, dy] = t <= ret - 25 ? bz(out(t / (ret - 25)), [34, -8], [42, -140], [84, -200]) : t <= ret ? bz((t - ret + 25) / 25, [84, -200], [96, -214], [98, -196])
          : bz(Math.min(1, (t - ret) / 100), [98, -196], [136, -150], [152, -12]);
        return { x: c.x + side * dx, y: c.y - c.z + dy, d: c.y + 4 };
      };
      this.trail(tip, { span: 240, w: 66, until: ret + 105, fade: 280, run: r, glow: 1 });
      this.later(ret - 10, () => { const p = tip(ret - 10); if (p) this.pop('glint', p.x, p.y, 130, { life: 220, angle: 0, depth: p.d + 6, glow: 0.8 }); }, r); // (the turn)
      this.cut('cut_rise', 156, 0, { follow: this.front(r, 52, 90), flipX: fl, grow: 70, hold: 40, fade: 190, glow: 0.5 });
      const p = this.front(r, 54, 60)(); if (p) this.petals(p.x, p.y, 7, 50, { depth: p.d + 4, up: 40 });
    } else {
      this.cut('cut_heavy', 168, -side * 32, { follow: this.front(r, 96, 104), flipX: fl, flipY: true, grow: 45, hold: 40, fade: 190, glow: 0.5 }); // the return: back down through the foe in the air
      const p = this.front(r, 68, 112)(); if (p) this.pop('spark_s', p.x, p.y, 92, { depth: p.d + 5 });
    }
  }

  /** Iai Strike, held: the glint at the hilt grows in three steps (a flare at each); the cut it will leave shows faint on the
   *  floor as far as it will reach (longer and brighter at each step); crimson flames rise round him at the second step and
   *  roar at the full draw. */
  private iai(r: CastRun): void {
    const L = r.skill.charge?.levels; if (!L) return;
    const s = this.ctx.scene, sc = r.chargeScale ?? 1, at = L.map((l) => l.at * sc), a = r.aim, ADD = Phaser.BlendModes.ADD;
    const lineOf = (lv: number) => L[lv].hits[0].shape as { length: number; width: number };
    const hip = this.front(r, 22, 46); // (the hand on the hilt, in front of his hip)
    const p0 = hip() ?? { x: r.origin.x, y: r.origin.y - 44, d: r.origin.y };
    const star = s.add.image(p0.x, p0.y, KIT, 'glint').setBlendMode(ADD).setDepth(TOP).setScale(0.1);
    const core = s.add.image(p0.x, p0.y, 'dmg-glow').setBlendMode(ADD).setTint(CRIMSON).setDepth(TOP).setDisplaySize(30, 30).setAlpha(0.7);
    const o = r.origin, reach = s.add.image(o.x, o.y, KIT, 'ground_slash').setAngle(screenAng(a.x, a.y)).setFlipY(a.x < -0.01).setDepth(GROUND + 2.2).setAlpha(0);
    const mkA = (add: boolean, crop?: number) => {
      const im = s.add.image(0, 0, KIT, 'aura_crimson').setOrigin(0.5, 0.92).setVisible(false).setBlendMode(add ? ADD : Phaser.BlendModes.NORMAL);
      if (crop) im.setCrop(0, im.height * crop, im.width, im.height * (1 - crop));
      return im;
    };
    const aura = [mkA(false), mkA(true), mkA(false, 0.86)]; // behind him, its glow, the ring's near rim over his feet
    let lv = 0, len = lineOf(0).length, wid = lineOf(0).width, ra = 0, aOn = 0;
    const SIZE = [[0.1, 0.15], [0.19, 0.24], [0.32, 0.4]]; // (the star at the hilt: small, big only at the full draw)
    this.add({ t: 0, step: (dt, t) => {
      if (r.phase !== 'startup') { star.destroy(); core.destroy(); for (const im of aura) im.destroy(); s.tweens.add({ targets: reach, alpha: 0, duration: 120, onComplete: () => reach.destroy() }); return false; }
      const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0, q = hip() ?? p0, c = this.me(r);
      if (nl > lv) { // a step up: the glint flares, the reach grows
        lv = nl;
        this.pop('glint', q.x, q.y, 70 + lv * 45, { life: 220, angle: 0, depth: TOP + 1 });
        this.pop('burst', q.x, q.y, 40 + lv * 24, { life: 180, depth: TOP + 1 });
        if (lv === 2) this.petals(q.x, q.y, 8, 70, { depth: q.d + 5 });
        if (r.own) this.ctx.cam().shake(50 + lv * 30, 0.0012 * lv);
      }
      const ease = Math.min(1, dt / 70); // the reach eases out to this step's length, pulsing faintly
      len += (lineOf(lv).length - len) * ease; wid += (lineOf(lv).width - wid) * ease; ra = Math.min(1, ra + dt / 160);
      reach.setPosition(o.x + a.x * len * 0.5, o.y + a.y * len * 0.5 + 2).setDisplaySize(len, wid * 2).setAlpha(ra * (0.42 + 0.18 * lv) * (0.85 + 0.15 * Math.sin(t / (lv === 2 ? 55 : 110))));
      aOn += ((lv === 0 ? 0 : lv === 1 ? 0.5 : 1) - aOn) * Math.min(1, dt / 120); // the flames
      const fl = lv === 2 ? 0.84 + 0.16 * Math.sin(t / 37) : 0.9 + 0.1 * Math.sin(t / 90), kx = (104 + 44 * aOn) / aura[0].width, ky = kx * (0.9 + 0.14 * aOn + 0.04 * Math.sin(t / 70)), vis = this.seen(r.attackerId);
      aura.forEach((im, i) => im.setVisible(aOn > 0.02).setPosition(c.x, c.y - c.z + 8).setScale(kx * (i === 1 ? 1.04 : 1), ky * (i === 1 ? 1.04 : 1))
        .setDepth(c.y + (i === 2 ? 2.3 : -2.3 + i * 0.01)).setAlpha(aOn * fl * vis * (i === 1 ? 0.45 : i === 2 ? 0.7 : 0.85)));
      const [s0, s1] = SIZE[lv], span = lv === 2 ? 1 : Math.max(1, at[lv + 1] - at[lv]), k = Math.min(1, (e - at[lv]) / span);
      const sz = (s0 + (s1 - s0) * k) * (1 + 0.08 * Math.sin(t / (lv === 2 ? 30 : 60)));
      star.setPosition(q.x, q.y).setScale(sz).setAngle(t * 0.06).setDepth(q.d + 6).setAlpha(0.85 + 0.15 * Math.sin(t / 45));
      core.setPosition(q.x, q.y).setDisplaySize(18 + 44 * sz, 18 + 44 * sz).setDepth(q.d + 5.9);
      return true;
    } });
  }

  /** The draw: a line of light shoots out as far as the cut reaches, and a beat later splits open along its length. */
  private iaiCut(r: CastRun): void {
    const lv = r.chargeLevel ?? 0, len = (r.hits[0].shape as { length: number }).length, a = r.aim, side = sideOf(r), q = this.me(r), cam = this.ctx.cam();
    const ang = screenAng(a.x, a.y), x0 = q.x + a.x * 8, y0 = q.y + a.y * 4 - q.z - 46, fl = a.x < -0.01;
    this.spr({ name: 'cut_line', x: x0, y: y0, ox: 0.03, angle: ang, flipY: fl, w: len * 1.12, h: 30 + 10 * lv, depth: TOP + 3, life: 380 + lv * 60, glow: 0.75,
      sx: kf([0, 0.05], [0.11, 1, out3], [1, 1.02]), sy: kf([0, 1.4], [0.11, 1], [0.35, 1], [1, 0.15, inQ]), a: kf([0, 1], [0.4, 1], [1, 0, inQ]) });
    const mx = x0 + Math.cos(ang * Math.PI / 180) * len * 0.56, my = y0 + Math.sin(ang * Math.PI / 180) * len * 0.56;
    this.spr({ name: 'cut_split', x: mx, y: my, angle: ang, flipY: fl, w: len * 0.95, delay: 110, life: 360, glow: 0.65, depth: TOP + 3.5,
      sx: kf([0, 0.7], [0.2, 1, out3]), sy: kf([0, 0.3], [0.2, 1.1, out3], [1, 0.5]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
    this.pop('burst', x0 + side * 18, y0, 90 + 30 * lv, { life: 200 });
    this.spr({ name: 'blade_trail', x: x0 + a.x * 36, y: y0 + a.y * 18, w: 170 + 30 * lv, life: 230, flipX: fl, angle: along(ang, fl), glow: 0.4, // the trail of the draw
      sx: kf([0, 0.6], [0.2, 1, out3], [1, 1.08]), sy: kf([0, 0.8], [0.2, 1], [1, 0.6, inQ]), a: kf([0, 0.95], [0.4, 0.8], [1, 0, inQ]) });
    if (lv === 2) { // fully drawn: the floor is cut too, a shockwave runs down it, dust where the foes go down
      this.spr({ name: 'ground_slash', x: q.x + a.x * len * 0.52, y: q.y + a.y * len * 0.52 + 2, angle: ang, flipY: fl, w: len * 0.95, depth: GROUND + 2.2, life: 1500, delay: 60, glow: 0.5,
        sx: kf([0, 0.1], [0.1, 1, out3]), sy: kf([0, 1.4], [0.1, 1]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
      this.crack(q.x + a.x * len * 0.5, q.y + a.y * len * 0.5, len * 0.95, Math.atan2(a.y, a.x) * (180 / Math.PI));
      this.shock(q.x + a.x * len * 0.6, q.y + a.y * len * 0.6, 180);
      for (let i = 0; i < 4; i++) this.dust(q.x + a.x * len * (0.25 + 0.22 * i), q.y + a.y * len * (0.25 + 0.22 * i), 90, 110 + i * 40);
      if (r.own) { cam.shake(200, 0.007); this.ctx.punch(0.035, 220); this.ctx.darken(220, 0.45); this.ctx.freeze?.(60); } // the world stops for the full draw (his screen)
    } else if (r.own) cam.shake(90 + lv * 40, 0.002 + lv * 0.0015);
    this.later(r.timings.active + r.timings.recovery * 0.6, () => this.glint(r, 0, 22, 44));   // the blade clicks back into its sheath
  }

  /** Spin Cut: a ring of slash light whirling round his waist (the far half behind him, the near half in front), rising with him. */
  private spinRing(r: CastRun, n: number): void {
    const T = r.timings, life = (n ? T.active - (r.skill.hits[1]?.at ?? 130) : T.active) + 170, fl = sideOf(r) < 0, w = n ? 214 : 190, dz = n ? 66 : 46;
    const f = this.front(r, 0, dz);
    for (const [crop, z] of [[undefined, -3], [0.5, 3]] as const)
      this.spr({ name: 'cut_ring', w, life, follow: f, dz: z, crop, glow: 0.6, flipX: fl, flick: 48,
        sx: kf([0, 0.5], [0.18, 1, out3], [1, 1.12]), sy: kf([0, 0.5], [0.18, 1, out3], [1, 1.12]), a: kf([0, 1], [0.65, 1], [1, 0, inQ]) });
    const p = f(); if (p) this.petals(p.x, p.y, 6, 110, { depth: p.d + 4 });
  }

  /** Hundred Cuts, a storm of swords: a cage of spectral katanas whirls round the foe while katanas of light fly through
   *  it from every side, three at each cut, each leaving its cut line; at the last cut the cage stops, turns its points in
   *  and slams into the foe — which bursts in a cross of light. */
  private flurry(r: CastRun, i: number): void {
    const side = sideOf(r), f = this.front(r, 84, 62), q = this.me(r), c = f() ?? { x: q.x + side * 84, y: q.y - q.z - 62, d: q.y }, last = i >= r.skill.hits.length - 1;
    if (i === 0) this.swordCage(r, f);
    if (!last) {
      for (let n = 0; n < 3; n++) { // katanas of light through the foe, one after another
        const th = rnd(0, Math.PI * 2), R0 = rnd(118, 150), ox = rnd(-12, 12), oy = rnd(-16, 12), dx = Math.cos(th), dy = Math.sin(th) * 0.6;
        this.flyBlade(c.x + ox - dx * R0, c.y + oy - dy * R0, c.x + ox + dx * R0, c.y + oy + dy * R0, { delay: n * 24, life: 120, depth: c.d + 5 + n * 0.02, run: r });
      }
      if (i % 2 === 0) this.cut('cut_thin', rnd(96, 124), rnd(0, 360), { x: c.x + rnd(-26, 26), y: c.y + rnd(-22, 18), depth: c.d + 5.5, grow: 28, hold: 16, fade: 90, glow: 0.5, sweep: 20 });
      if (i % 3 === 1) this.pop('spark_s', c.x + rnd(-18, 18), c.y + rnd(-18, 18), 64, { life: 150, depth: c.d + 6 });
      return;
    }
    // the cage has slammed in: a cross of light bursts out of the foe
    this.cut('cut_x', 240, rnd(-10, 10), { x: c.x, y: c.y, depth: TOP + 4, grow: 50, hold: 80, fade: 240, glow: 0.8 });
    this.pop('burst_crit', c.x, c.y, 220, { life: 360, depth: TOP + 4.5 });
    this.shock(c.x, q.y, 260);
    this.petals(c.x, c.y, 18, 130, { depth: TOP + 3 });
    for (let k = 0; k < 6; k++) { const th = (k / 6) * Math.PI * 2 + rnd(-0.2, 0.2); this.flyBlade(c.x, c.y, c.x + Math.cos(th) * 170, c.y + Math.sin(th) * 100, { life: 200, depth: TOP + 3.5, len: 96 }); } // (shards of the cage thrown out)
    if (r.own) { this.ctx.cam().shake(200, 0.007); this.ctx.punch(0.04, 240); }
  }

  /** A crimson katana flying straight from (x0, y0) to (x1, y1), point first, two ghostly afterimages behind it, the cut
   *  it leaves along its line. */
  private flyBlade(x0: number, y0: number, x1: number, y1: number, o: { delay?: number; life?: number; depth?: number; run?: CastRun; len?: number } = {}): void {
    const L = o.len ?? 112, kw = (L * 89) / 400, ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life = o.life ?? 120, d = o.depth ?? TOP + 3, dl = o.delay ?? 0;
    const mx = (u: number) => (x1 - x0) * u, my = (u: number) => (y1 - y0) * u;
    for (let k = 0; k < 3; k++)
      this.spr({ name: k === 0 ? 'katana' : 'katana_ghost', x: x0, y: y0, w: kw, h: L, angle: ang + 90, life, delay: dl + k * 16, depth: d - k * 0.01, run: o.run, add: k > 0, glow: k === 0 ? 0.3 : undefined,
        mx, my, a: k === 0 ? kf([0, 0], [0.12, 1], [0.82, 1], [1, 0]) : kf([0, 0], [0.12, 0.4 - k * 0.12], [0.8, 0.3 - k * 0.1], [1, 0]) });
    const len = Math.hypot(x1 - x0, y1 - y0);
    this.spr({ name: 'cut_line', x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: ang, w: len * 0.9, h: 12, delay: dl + life * 0.35, life: 170, depth: d - 0.05, glow: 0.7, run: o.run,
      sx: kf([0, 0.2], [0.25, 1, out3]), sy: kf([0, 1], [1, 0.3, inQ]), a: kf([0, 0.95], [1, 0, inQ]) });
  }

  /** The cage of swords round the foe through Hundred Cuts: eight spectral katanas whirling round it (the near ones in front
   *  of it, the far ones behind), points along the turn; before the last cut they stop, turn their points in and slam into
   *  it as it lands. */
  private swordCage(r: CastRun, f: () => Pt | null): void {
    const s = this.ctx.scene, N = 8, fin = r.skill.hits[r.skill.hits.length - 1]?.at ?? 1000, TURN = fin - 150, IN = fin - 45, KL = 118, ADD = Phaser.BlendModes.ADD;
    const mk = (add: boolean) => { const im = s.add.image(0, 0, KIT, add ? 'katana_ghost' : 'katana').setVisible(false); if (add) im.setBlendMode(ADD); return im.setScale(KL / im.height); };
    const bl = Array.from({ length: N }, (_, k) => ({ im: mk(false), gl: mk(true), th0: (k / N) * Math.PI * 2 }));
    let last: Pt = f() ?? { x: 0, y: 0, d: 0 }, stopAt = 0;
    const kill = () => { for (const b of bl) { b.im.destroy(); b.gl.destroy(); } };
    this.add({ t: 0, step: (_dt, t) => {
      if (this.gone(r) || (r.phase === 'done' && t < fin) || t >= fin) { kill(); return false; } // (broken off, or slammed in)
      const p = f() ?? last; last = p;
      const spin = t < TURN ? t * 0.012 : (stopAt ||= TURN * 0.012) + (1 - Math.pow(1 - Math.min(1, (t - TURN) / 90), 2)) * 0.5; // (the whirl stops)
      const grow = Math.min(1, t / 140), rad = t < IN ? (40 + 56 * out(grow)) * (1 + 0.05 * Math.sin(t / 55)) : 96 * (1 - inQ(Math.min(1, (t - IN) / 45)));
      const turnIn = t < TURN ? 0 : out(Math.min(1, (t - TURN) / 80));
      bl.forEach((b) => {
        const th = b.th0 + spin, sn = Math.sin(th), x = p.x + Math.cos(th) * rad, y = p.y + sn * rad * 0.42;
        const along = (Math.atan2(Math.cos(th) * 0.42, -Math.sin(th)) * 180) / Math.PI + 90, inward = (Math.atan2(p.y - y, p.x - x) * 180) / Math.PI + 90;
        const ang = along + Phaser.Math.Angle.ShortestBetween(along, inward) * turnIn, al = grow * (sn > 0 ? 1 : 0.6);
        b.im.setVisible(true).setPosition(x, y).setAngle(ang).setDepth(p.d + (sn > 0 ? 4 : -4)).setAlpha(0.95 * al);
        b.gl.setVisible(true).setPosition(x, y).setAngle(ang).setDepth(p.d + (sn > 0 ? 4.01 : -3.99)).setAlpha(0.3 * al);
      });
      return true;
    } });
  }

  /** A foe hits the floor (knocked down, or down from the air): a ring and puffs of dust the colour of the ground. */
  landing(x: number, y: number): void { if (!this.ready) return; this.dustRing(x, y, 150); this.dust(x, y, 104); }
  /** A foe skidding back: a small puff of dust behind it. */
  skid(x: number, y: number): void {
    if (!this.ready) return;
    this.spr({ name: 'dust', x, y, oy: 0.85, depth: y + 2, w: 50, life: 380, tint: DUST, sx: kf([0, 0.5], [1, 1.2, out3]), sy: kf([0, 0.5], [1, 1.1, out3]), a: kf([0, 0.7], [1, 0, inQ]), my: (u) => -6 * u });
  }

  /** Kagemusha: he vanishes in a burst of ink and petals (a swirl of ink where he stood). */
  kageVanish(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.pop('ink_burst', x, y - 48, 220, { depth: at.y + 6, life: 560, glow: 0, angle: rnd(-10, 10) });
    this.spr({ name: 'ink_smoke', x, y: y - 46, depth: at.y + 5, w: 150, life: 760, sx: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.5]), sy: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.4]),
      a: kf([0, 0.95], [0.4, 0.8], [1, 0, inQ]), rot: (u) => 70 * u, my: (u) => -24 * u });
    this.petals(x, y - 50, 22, 140, { depth: at.y + 6, life: 1100 });
    this.ctx.punch(0.02, 140);
  }
  /** One of the three steps out of a swirl of ink. */
  kageAppear(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'ink_smoke', x, y: y - 44, depth: at.y + 4, w: 128, life: 460, sx: kf([0, 1.25], [1, 0.55, out]), sy: kf([0, 1.25], [1, 0.55, out]),
      a: kf([0, 0.9], [0.5, 0.6], [1, 0, inQ]), rot: (u) => -90 * u });
    this.petals(x, y - 46, 7, 64, { depth: at.y + 5 });
  }
  /** A double bursts into petals (struck — the blow is wasted — or at the AMBUSH). */
  kageBurst(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'blossom_cluster', x, y: y - 48, depth: at.y + 6, w: 70, life: 380, angle: rnd(-20, 20), glow: 0.3,
      sx: kf([0, 0.4], [0.25, 1.15, out3], [1, 1.3]), sy: kf([0, 0.4], [0.25, 1.15, out3], [1, 1.3]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    this.pop('ink_spatter', x, y - 46, 120, { depth: at.y + 5, life: 360, glow: 0 });
    this.petals(x, y - 52, 28, 120, { depth: at.y + 6, life: 1150 });
  }
  /** A double's feint: a quick cut in the air in front of it, as it swings (stage: which of the four cuts). */
  kageFeint(at: V3, face: number, stage: number): void {
    if (!this.ready) return;
    const fl = face < 0, x = at.x + face * 46, y = at.y - at.z - 54;
    if (stage === 2) this.cut('cut_rise', 104, 0, { x, y: y - 20, depth: at.y + 4, flipX: fl, delay: 75, grow: 60, hold: 35, fade: 150 });
    else this.cut('cut_thin', 124, face * (stage === 1 ? -12 : 14), { x, y, depth: at.y + 4, flipX: fl, flipY: stage === 1, delay: 75, glow: 0.5 });
  }
  /** A double melts back into ink (time is up, or he was struck). */
  kageFade(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'ink_smoke', x, y: y - 44, depth: at.y + 5, w: 112, life: 520, sx: kf([0, 0.6], [1, 1.3, out3]), sy: kf([0, 0.6], [1, 1.3, out3]),
      a: kf([0, 0.85], [1, 0, inQ]), rot: (u) => 50 * u, my: (u) => -16 * u });
    this.petals(x, y - 46, 5, 50, { depth: at.y + 5 });
  }

  /** Mirage Counter's stance: copies of him trembling round him like a heat haze, petals hanging still in the air round
   *  his waist, a ring under him shrinking as the window runs out (so everyone sees how long it lasts). A blow that comes
   *  in hits only the mirage (`counter`); if none comes, the copies fold back into him, the petals drop, the ring breaks. */
  private mirageStance(r: CastRun): void {
    const o = r.origin, T = r.timings, win = r.skill.counter?.window ?? 420, end = T.startup + win, s = this.ctx.scene, ADD = Phaser.BlendModes.ADD;
    this.stances.set(r.castId, { x: o.x, y: o.y, z: o.z, done: false });
    this.glint(r, 0, 22, 56);
    const offs: [number, number, number, number][] = [[-22, -2, 0.42, 0xff3048], [21, 1, 0.38, 0xff3048], [-11, -8, 0.32, 0xffd6de], [12, -6, 0.26, 0xff6a80], [0, -15, 0.2, 0xffd6de]];
    const imgs = offs.map(() => s.add.image(0, 0, KIT, 'glint').setBlendMode(ADD).setVisible(false));
    const petals = Array.from({ length: 7 }, (_, i) => {
      const im = s.add.image(0, 0, KIT, `petal_${1 + (i % 4)}`).setVisible(false);
      return { im: im.setScale(rnd(14, 19) / im.width), th: (i / 7) * Math.PI * 2 + rnd(-0.3, 0.3), h: rnd(34, 96), rad: rnd(40, 60), sp: (i % 2 ? 1 : -1) * rnd(0.5, 0.8), rot: rnd(0, 360) };
    });
    const ring = s.add.image(0, 0, KIT, 'timer_ring').setVisible(false), rg = s.add.image(0, 0, KIT, 'timer_ring').setBlendMode(ADD).setVisible(false), rk = 150 / ring.width;
    // its name over his head for as long as the window is open (so it reads what it is — on every screen: in a duel too)
    const label = s.add.text(0, 0, 'COUNTER STANCE', { fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold italic', fontSize: '22px', color: '#ffc4cc', stroke: '#1a0602', strokeThickness: 5, resolution: 2 })
      .setOrigin(0.5).setDepth(TOP + 29).setVisible(false);
    this.auraFlare(r, 'aura_crimson', 150, end + 120);
    const kill = () => { for (const im of [...imgs, ring, rg, ...petals.map((p) => p.im)]) im.destroy(); label.destroy(); };
    let fold = -1; // (the window ran out with no blow: ms since)
    this.add({ t: 0, step: (dt, t) => {
      const st = this.stances.get(r.castId), c = this.ctx.casterPos(r.attackerId), b = this.ctx.body?.(r.attackerId);
      if (!st || st.done || !c || !b || this.gone(r) || (r.phase === 'done' && fold < 0 && r.elapsed < end)) { kill(); return false; } // (struck: the counter draws the rest)
      if (fold < 0 && (r.elapsed >= end || r.phase === 'done')) { fold = 0; this.petals(c.x, c.y - c.z - 40, 6, 50, { depth: c.y + 3 }); }
      if (fold >= 0) fold += dt;
      if (fold > 300) { kill(); return false; }
      const vis = this.seen(r.attackerId), on = Math.min(1, t / 110) * vis, f = fold < 0 ? 0 : Math.min(1, fold / 170), gone = fold < 0 ? 1 : 1 - Math.min(1, fold / 240);
      const head = (this.ctx.targetPos?.(r.attackerId) as { h?: number } | null)?.h ?? 110, pop = Math.min(1, t / 130);
      label.setVisible(true).setPosition(c.x, c.y - c.z - head - 24 - 8 * out(pop)).setScale(1.25 - 0.25 * back(pop)).setAlpha(on * gone);
      imgs.forEach((im, k) => { // the copies (folding back into him at the end)
        const [dx, dy, al0, col] = offs[k], al = Math.min(0.75, al0 * 1.45), j = (Math.sin(t / 21 + k * 2.1) * 3.4 + Math.sin(t / 47 + k) * 2) * (1 - f), fl = 0.7 + 0.3 * Math.sin(t / 33 + k * 1.7);
        if (im.texture.key !== b.key || im.frame.name !== String(b.frame)) im.setTexture(b.key, b.frame);
        im.setOrigin(b.ox, b.oy).setScale(b.sx * (1 + 0.03 * Math.sin(t / 40 + k)), b.sy).setFlipX(b.flipX).setTintFill(col)
          .setPosition(c.x + (dx + j) * (1 - out(f)), c.y - c.z + dy * (1 - out(f))).setDepth(c.y - 0.5).setAlpha(on * al * fl * gone).setVisible(true);
      });
      petals.forEach((p) => { // hanging still round his waist, turning slowly — dropping at the end
        const th = p.th + t * 0.0022 * p.sp, sn = Math.sin(th), drop = fold < 0 ? 0 : Math.pow(fold / 300, 2) * (p.h + 10);
        p.im.setVisible(true).setPosition(c.x + Math.cos(th) * p.rad, c.y - c.z - p.h + sn * p.rad * 0.3 + drop).setDepth(c.y + (sn > 0 ? 3 : -3)).setAngle(p.rot + t * 0.04 * p.sp).setAlpha(on * Math.min(1, gone * 1.4));
      });
      const w = r.elapsed < T.startup ? 0.55 + 0.45 * out(r.elapsed / Math.max(1, T.startup)) : 1 - 0.62 * Math.min(1, (r.elapsed - T.startup) / win); // (the ring: shrinking as the window runs out)
      const rk2 = rk * w * (fold < 0 ? 1 : 1 + 0.5 * f);
      ring.setVisible(true).setPosition(c.x, c.y - c.z + 2).setScale(rk2).setDepth(c.y - 1).setAlpha(on * 0.95 * gone);
      rg.setVisible(true).setPosition(c.x, c.y - c.z + 2).setScale(rk2 * 1.03).setDepth(c.y - 0.99).setAlpha(on * gone * (0.45 + 0.2 * Math.sin(t / 50)));
      return true;
    } });
    this.spr({ name: 'shock_ring', w: 120, life: 360, run: r, glow: 0.6, follow: () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z, d: c.y } : null; },
      dz: -2, sx: kf([0, 0.3], [1, 1.1, out3]), sy: kf([0, 0.3], [1, 1.1, out3]), a: kf([0, 0.8], [1, 0, inQ]) });
    this.later(end + 400, () => this.stances.delete(r.castId));
  }

  /** Blossom Storm: petals gather through the wind-up, then a storm of them whirls round him as he chases. */
  private blossomStorm(r: CastRun): void {
    const T = r.timings, q = this.me(r);
    this.petals(q.x, q.y - q.z - 56, 16, 140, { inward: true, life: T.startup + 80, depth: q.y + 4 });
    for (const [crop, z] of [[undefined, -3], [0.5, 3]] as const) // a ring of petals whirling round his waist through the chase
      this.spr({ name: 'petal_ring', w: 190, delay: T.startup, life: T.active + 160, run: r, glow: 0.3, follow: this.front(r, 0, 44), dz: z, crop, flick: 70,
        sx: kf([0, 0.5], [0.2, 1, out3], [1, 1.12]), sy: kf([0, 0.5], [0.2, 1, out3], [1, 1.12]), a: kf([0, 0], [0.15, 0.95], [0.85, 0.95], [1, 0]) });
    // the storm: a funnel of petals round him, turning (two mirrored copies crossing over), and petals orbiting through it
    const s = this.ctx.scene, N = 34, life = T.startup + T.active + 260;
    const mk = (flip: boolean) => s.add.image(0, 0, KIT, 'petal_storm').setOrigin(0.5, 0.96).setFlipX(flip).setVisible(false);
    const A = mk(false), B = mk(true), kS = 210 / A.height;
    const ps = Array.from({ length: N }, (_, i) => ({ im: s.add.image(0, 0, KIT, i % 6 === 5 ? 'blossom' : `petal_${1 + (i % 4)}`).setVisible(false).setScale(rnd(0.22, 0.42)),
      th: (i / N) * Math.PI * 2, rad: rnd(48, 96), h: rnd(6, 150), sp: rnd(0.008, 0.016) }));
    const kill = () => { A.destroy(); B.destroy(); for (const p of ps) p.im.destroy(); };
    this.add({ t: 0, step: (_dt, t) => {
      const c = this.ctx.casterPos(r.attackerId), e = t - T.startup;
      if (e >= 0 && c && !this.broken(r)) {
        const fade = Math.min(1, e / 120) * Math.max(0, Math.min(1, (life - t) / 220)), turn = 0.5 + 0.5 * Math.sin(e / 55), w = 1 + 0.06 * Math.sin(e / 45);
        A.setVisible(true).setPosition(c.x, c.y - c.z + 10).setScale(kS * w, kS).setDepth(c.y + 3).setAlpha(fade * (0.25 + 0.55 * turn));
        B.setVisible(true).setPosition(c.x, c.y - c.z + 10).setScale(kS * w, kS).setDepth(c.y + 3.01).setAlpha(fade * (0.25 + 0.55 * (1 - turn)));
        for (const p of ps) {
          const th = p.th + e * p.sp, sn = Math.sin(th);
          p.im.setVisible(true).setPosition(c.x + Math.cos(th) * p.rad, c.y - c.z - p.h + sn * p.rad * 0.3).setDepth(c.y + (sn > 0 ? 4 : -4)).setAngle(e * 0.5 + p.th * 90).setAlpha(fade);
        }
      }
      if (t >= life || (this.broken(r) && t > T.startup) || this.gone(r)) { kill(); return false; }
      return true;
    } });
  }
  /** The foe Blossom Storm chases: the one it locked on to, else just ahead of him. */
  private stormFoe(r: CastRun): V3 {
    const t = r.lock ? this.ctx.targetPos?.(r.lock) : null;
    if (t) return t;
    const q = this.me(r); return { x: q.x + sideOf(r) * 70, y: q.y, z: q.z };
  }
  private stormCut(r: CastRun, i: number): void {
    const side = sideOf(r), f = this.stormFoe(r), last = i >= (r.skill.hits.length - 1), fy = f.y - f.z;
    if (!last) { // a silhouette of him strikes through the foe from another side each time, the cut behind it
      const deg = [0, 180, 32, 212][i % 4] + rnd(-8, 8), c = Math.cos((deg * Math.PI) / 180), sn = Math.sin((deg * Math.PI) / 180) * 0.5, L = 112;
      this.phantomDash(r, f.x - c * L, fy - sn * L, f.x + c * L, fy + sn * L, TOP + 2.5);
      this.cut('cut_thin', rnd(150, 180), (Math.atan2(sn, c) * 180) / Math.PI, { x: f.x, y: fy - 56, depth: TOP + 3, grow: 40, hold: 30, fade: 150, glow: 0.65, flipY: c < 0 });
      this.petals(f.x, fy - 56, 4, 50, { depth: TOP + 2 });
      return;
    }
    const x = f.x, y = f.y;
    this.spr({ name: 'blossom_burst', x, y: fy - 70, w: 290, life: 560, glow: 0.22, depth: TOP + 4, angle: rnd(0, 360),
      sx: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.25]), sy: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.25]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
    this.spr({ name: 'petal_column', x, y: y + 6, oy: 0.96, depth: y + 3, w: 150, life: 700, glow: 0.5, sy: kf([0, 0.15], [0.3, 1.1, out3], [1, 1.2]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
    this.cut('cut_rise', 180, 0, { x, y: fy - 110, depth: TOP + 4.5, flipX: side < 0, grow: 70, hold: 60, fade: 220, glow: 0.75 });
    this.petals(x, fy - 90, 26, 160, { depth: TOP + 3 });
    this.shock(x, y, 260);
    if (r.own) { this.ctx.cam().shake(200, 0.007); this.ctx.punch(0.04, 260); }
  }

  /** Dragon Eclipse: the dark and the cut-in, a black sun rising over the target, eight cuts converging on it out of nowhere. */
  private eclipseAt = new Map<string, { x: number; y: number }>();
  /** Where the eclipse falls: on the foe it locked on to (where it is now), else where the great cut will reach. */
  private eclipsePoint(r: CastRun): { x: number; y: number } {
    const t = r.lock ? this.ctx.targetPos?.(r.lock) : null;
    if (t) return { x: t.x, y: t.y };
    const a = r.aim, o = r.origin, reach = (r.skill.dash?.distance ?? 120) + 95;
    return this.eclipseAt.get(r.castId) ?? { x: o.x + a.x * reach, y: o.y + a.y * reach };
  }
  private eclipse(r: CastRun): void {
    this.ctx.ultimateStage(r);
    const T = r.timings, o = r.origin, fin = T.startup + (r.hits[r.hits.length - 1]?.at ?? 120);
    const at = this.eclipsePoint(r), sx = at.x, sy = at.y - o.z - 230;
    this.eclipseAt.set(r.castId, at);
    this.later(fin + 1200, () => this.eclipseAt.delete(r.castId));
    this.spr({ name: 'sun_black', x: sx, y: sy, depth: TOP + 1, w: 230, delay: T.startup * 0.25, life: fin - T.startup * 0.25 + 140, run: r,
      sx: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), sy: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), rot: (u) => 24 * u, a: kf([0, 0], [0.12, 1], [0.93, 1], [1, 0]) });
    this.spr({ name: 'sun_rays', x: sx, y: sy, depth: TOP + 0.9, w: 330, add: true, tint: 0xff4050, delay: T.startup * 0.5, life: fin - T.startup * 0.5 + 140, run: r, rot: (u) => -30 * u, a: kf([0, 0], [0.3, 0.6], [1, 0]) });
    for (let k = 0; k < 3; k++) // a glint of the blade in the dark, here and there round the foe
      this.pop('glint', at.x + rnd(-90, 90), at.y - o.z - rnd(30, 100), 120, { delay: T.startup - 420 + k * 130, life: 220, angle: 0, depth: TOP + 5, run: r });
  }
  /** One of the eight cuts out of the dark: a phantom of him crosses the foe from its own direction, the cut line behind it. */
  private eclipseSlash(r: CastRun, i: number): void {
    const o = r.origin, at = this.eclipsePoint(r);
    const th = (([0, 180, 45, 225, 90, 270, 135, 315][i % 8] + rnd(-10, 10)) * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th) * 0.5, L = 120, y = at.y - o.z - 50;
    this.cut('cut_line', 290, (Math.atan2(sn, c) * 180) / Math.PI, { x: at.x, y, depth: TOP + 5, grow: 35, hold: 25, fade: 130, glow: 0.8, sweep: 0 });
    this.phantomDash(r, at.x - c * L, at.y - o.z - sn * L, at.x + c * L, at.y - o.z + sn * L, TOP + 4.5);
    this.pop('spark_s', at.x + rnd(-14, 14), y + rnd(-14, 14), 70, { life: 160 });
    this.ctx.darken(300, 0.55); // the dark holds through the cuts (their hit-stops stretch them past its timer)
    if (r.own) this.ctx.cam().shake(60, 0.002);
  }
  private eclipseCut(r: CastRun, o: V3): void {
    const a = r.aim, at = this.eclipsePoint(r), cam = this.ctx.cam(), ang = screenAng(a.x, a.y);
    const sx = at.x, sy = at.y - o.z - 230, y = at.y - o.z - 50;
    this.pop('sun_flare', sx, sy, 300, { life: 520, depth: TOP + 1.2, angle: 0, glow: 0.5 });
    this.spr({ name: 'sun_break', x: sx, y: sy, depth: TOP + 1.1, w: 240, delay: 260, life: 900, my: (u) => 60 * u, rot: (u) => 20 * u, sx: kf([0, 1], [1, 1.25]), sy: kf([0, 1], [1, 1.25]), a: kf([0, 1], [1, 0, inQ]) });
    this.cut('cut_line', 640, ang, { x: at.x - a.x * 40, y, depth: TOP + 5, h: 80, grow: 50, hold: 120, fade: 320, glow: 0.9, sweep: 0, flipY: a.x < -0.01 });
    this.later(110, () => this.cut('cut_split', 520, ang, { x: at.x, y, depth: TOP + 5.5, grow: 50, hold: 120, fade: 300, glow: 0.8, sweep: 0 }));
    this.pop('burst_crit', at.x, y, 240, { life: 380, depth: TOP + 6 });
    this.spr({ name: 'ground_slash', x: at.x, y: at.y + 2, angle: ang, flipY: a.x < -0.01, w: 460, depth: GROUND + 2.2, life: 1600, glow: 0.55,
      sx: kf([0, 0.1], [0.1, 1, out3]), sy: kf([0, 1.5], [0.1, 1]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
    // the dragon swims out of the dark along the cut, through the foe and away (its whole body following its head along
    // one gently waving path, faster through the foe, easing in and out), and melts back into the dark from its tail
    const fl = a.x < -0.01, ux = Math.cos((ang * Math.PI) / 180), uy = Math.sin((ang * Math.PI) / 180), drg = this.serpent(56, { glow: 0.5, flip: fl });
    const S0 = { x: at.x - ux * 600, y: y - uy * 600 }, wave = (sv: number) => 15 * Math.sin(sv / 56);
    const path = (sv: number): Pt => ({ x: S0.x + ux * sv - uy * wave(sv), y: S0.y + uy * sv + ux * wave(sv), d: TOP + 4 });
    const FLY = 900, D0 = 330, D1 = 1650, MELT0 = 620, MELT = 420;
    let nextSpark = 0;
    this.add({ t: 0, step: (_dt, t) => {
      const u = Math.min(1, t / FLY), neck = D0 + (D1 - D0) * (0.3 * u + 0.7 * u * u * (3 - 2 * u)), melt = Math.max(0, (t - MELT0) / MELT);
      drg.place(path, neck, Math.min(1, t / 160), Math.min(1, melt));
      if (melt > 0 && melt < 1 && t >= nextSpark) { // it scatters into sparks where it melts
        nextSpark = t + 30;
        for (let k = 0; k < 2; k++) { const p = drg.at(path, neck, Math.min(1, melt * 1.2 - 0.1 + rnd(-0.04, 0.04))); this.pop('spark_s', p.x + rnd(-14, 14), p.y + rnd(-12, 12), rnd(34, 56), { life: 240, depth: TOP + 4.5, glow: 0.5 }); }
      }
      if (melt >= 1) { drg.destroy(); return false; }
      return true;
    } });
    for (let i = 0; i < 24; i++) this.later(200 + i * 40, () => this.petals(at.x + rnd(-260, 260), y - rnd(80, 220), 1, 30, { life: 1600, depth: TOP + 3 }));
    cam.flash(130, 255, 236, 228, false); // the corona bursts white
    this.ctx.darken(MELT0 + MELT - 100, 0.55); // and the dark lifts only after the dragon has passed
    if (r.own) { cam.shake(320, 0.012); this.ctx.punch(0.06, 320); }
  }

  /** Tornado Blade: a broad, round crimson whirlwind rolling along tornadoPath (the path its hits take), weaving toward
   *  you and away through the courtyard. Its body is a funnel of wind bands going round it — the far side of each behind
   *  whatever is inside it, the near side in front, the streaks sliding across its face (quick in the middle, slow at its
   *  edges, the way a turning drum looks) — over the painted whirl at its heart; petals and blade glints circle it in front
   *  and behind, climbing; it sways and leans into its way; larger as it comes near; a spinning eddy, its shadow and dust
   *  on the floor under it. */
  private tornado(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, path = tornadoPath(r.origin, r.aim), t0 = T.startup + TORNADO.startMs, life = TORNADO.everyMs * (TORNADO.count - 1) + 260, ADD = Phaser.BlendModes.ADD;
    const H = 240, R0 = 44, R1 = 112, ELL = 0.3, rad = (h: number) => R0 + (R1 - R0) * Math.pow(Math.max(0, h) / H, 0.8); // (its height, its radius at the floor and at the top)
    const core = s.add.image(0, 0, KIT, 'tornado').setOrigin(0.5, 0.95).setVisible(false), coreB = s.add.image(0, 0, KIT, 'tornado').setOrigin(0.5, 0.95).setFlipX(true).setVisible(false);
    const coreG = s.add.image(0, 0, KIT, 'tornado').setOrigin(0.5, 0.95).setBlendMode(ADD).setVisible(false);
    const shadow = s.add.image(0, 0, 'dmg-glow').setTint(0x1a0508).setVisible(false), eddy = s.add.image(0, 0, KIT, 'vortex').setVisible(false), eg = s.add.image(0, 0, KIT, 'vortex').setBlendMode(ADD).setVisible(false);
    const tex = this.windTex(), NB = 13, NP = 20, PITCH = H / (NB - 2);
    const bands = Array.from({ length: NB }, () => ({ // (the turns of one spiral of wind round it, climbing)
      back: this.strip(undefined, NP, { key: tex, vertical: true }), front: this.strip(undefined, NP, { key: tex, vertical: true }), light: this.strip(undefined, NP, { key: tex, vertical: true, add: true }),
    }));
    let climb = 0, ph = 0;
    const motes = Array.from({ length: 18 }, (_, i) => ({ im: s.add.image(0, 0, KIT, i % 6 === 5 ? 'blossom' : `petal_${1 + (i % 4)}`).setVisible(false), th: rnd(0, Math.PI * 2), h: rnd(0, H), k: rnd(0.2, 0.34), rot: rnd(0, 360) }));
    const blades = Array.from({ length: 4 }, (_, i) => ({ im: s.add.image(0, 0, KIT, 'glint').setBlendMode(ADD).setVisible(false), th: (i / 4) * Math.PI * 2, h: 40 + i * 62 }));
    const kh = H / core.height, ek = 190 / eddy.width, end = t0 + life, y0 = path[0].y, cur: Pt = { x: path[0].x, y: path[0].y, d: path[0].y };
    const kill = () => { for (const im of [core, coreB, coreG, shadow, eddy, eg, ...motes.map((m) => m.im), ...blades.map((b) => b.im)]) im.destroy(); for (const b of bands) { b.back.destroy(); b.front.destroy(); b.light.destroy(); } };
    const at = (u: number) => { // (a smooth curve through the path's points: Catmull-Rom)
      const i = Math.max(0, Math.min(path.length - 2, Math.floor(u))), f = Math.max(0, Math.min(1, u - i));
      const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
      return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
    };
    let nextRing = 0, nextDust = 0, lean = 0, px = path[0].x;
    this.add({ t: 0, step: (dt, t) => {
      if (t < T.startup - 40) return true;
      if ((this.broken(r) && t < T.startup + 20) || this.gone(r)) { kill(); return false; }
      const { x, y } = at(Math.max(0, t - t0) / TORNADO.everyMs);
      cur.x = x; cur.y = y; cur.d = y;
      const near = 1 + (y - y0) * 0.0036; // (nearer you: larger)
      lean += (Math.max(-9, Math.min(9, ((x - px) / Math.max(1, dt)) * 60)) - lean) * Math.min(1, dt / 120); px = x;
      const fade = Math.min(1, (t - T.startup) / 160) * (t > end - 260 ? Math.max(0, (end - t) / 260) : 1), grow = 0.55 + 0.45 * out(Math.min(1, (t - T.startup + 40) / 260));
      const tilt = Math.tan((lean * Math.PI) / 180), axis = (h: number) => x + tilt * h * near + Math.sin(t / 190 + h / 80) * 6 * (h / H) * near; // (its axis: leaning into its way, swaying)
      // the heart: the painted whirl, dim, inside the walls (two mirrored copies crossing over: it turns)
      const turn = 0.5 + 0.5 * Math.sin(t / 55), kc = kh * near * grow;
      core.setVisible(true).setPosition(axis(0), y + 6).setScale(kc * 0.95, kc).setAngle(lean).setDepth(y).setAlpha(fade * (0.12 + 0.22 * turn));
      coreB.setVisible(true).setPosition(axis(0), y + 6).setScale(kc * 0.95, kc).setAngle(lean).setDepth(y + 0.005).setAlpha(fade * (0.12 + 0.22 * (1 - turn)));
      coreG.setVisible(true).setPosition(axis(0), y + 6).setScale(kc, kc * 1.02).setAngle(lean).setFlipX(turn > 0.5).setDepth(y + 0.01).setAlpha(fade * 0.16);
      // the walls: one spiral of wind round it, its turns climbing (a turning screw), the wind sliding round along it; the far
      // side of each turn behind what is inside, the near side in front; thin and faint at the floor, melting away at the top
      climb = (climb + dt * 0.11) % PITCH; ph = (ph + 0.00072 * dt) % 0.5;
      const thick = PITCH * 0.6 * near * grow, ryMax = rad(H) * ELL * near * grow;
      const lit = (a: number) => { // (lit from the front left, in shadow round its right side: it is round)
        const k = Math.max(0, Math.min(1, 0.5 - 0.5 * Math.cos(a - 2.2))) * 0.62, ch = (c0: number, c1: number) => Math.round(c0 + (c1 - c0) * k);
        return (ch(255, 112) << 16) | (ch(255, 24) << 8) | ch(255, 40);
      };
      const sm = (v: number) => { const q = Math.max(0, Math.min(1, v)); return q * q * (3 - 2 * q); };
      bands.forEach((b, k) => {
        const base = (k - 1) * PITCH + climb, hAt = (a: number) => base + (a / (Math.PI * 2)) * PITCH;
        const P = (a: number) => { const h = hAt(a), R = rad(h) * near * grow * (1 + 0.07 * Math.sin(2 * a + t / 90 + h / 40)); return { x: axis(h * grow) + R * Math.cos(a), y: y - h * near * grow + R * ELL * Math.sin(a) }; }; // (gusting: not a perfect coil)
        const EXT = 0.32, A = (a0: number) => (i: number) => a0 - EXT + ((Math.PI + 2 * EXT) * i) / (NP - 1); // (each side runs a little past its edge: the near and far sides cross-fade there, no seam)
        const ends = (i: number) => sm(((Math.min(i, NP - 1 - i) / (NP - 1)) * (Math.PI + 2 * EXT)) / (2 * EXT));
        const vis0 = (a: number) => { const h = hAt(a); return sm(h / 34) * sm((H - h) / 60); };
        const edge = (a: number) => 0.72 + 0.28 * Math.pow(Math.abs(Math.cos(a)), 0.5); // (a see-through shell: thicker at its edges)
        const uvs = (a0: number) => (i: number) => ph + (A(a0)(i) / (Math.PI * 2)) * 0.5 + hAt(A(a0)(i)) * 0.0011;
        const vis = (a0: number) => (i: number) => vis0(A(a0)(i)) * ends(i) * edge(A(a0)(i));
        b.back.set((i) => P(A(Math.PI)(i)), () => thick, (i) => fade * 0.72 * vis(Math.PI)(i), (i) => lit(A(Math.PI)(i))); b.back.uv(uvs(Math.PI)); b.back.rope.setDepth(y - ryMax - 1);
        b.front.set((i) => P(A(0)(i)), () => thick, (i) => fade * 0.85 * vis(0)(i), (i) => lit(A(0)(i))); b.front.uv(uvs(0)); b.front.rope.setDepth(y + ryMax + 1);
        b.light.set((i) => P(A(0)(i)), () => thick, (i) => fade * 0.3 * vis(0)(i)); b.light.uv(uvs(0)); b.light.rope.setDepth(y + ryMax + 1.01);
      });
      // petals and blade glints circling it, climbing (bright and big in front, dim and small behind)
      for (const m of motes) {
        m.h += dt * 0.07; if (m.h > H) m.h -= H;
        m.th += dt * (0.0042 + 0.003 * (1 - m.h / H));
        const R = rad(m.h) * 1.08 * near * grow, sn = Math.sin(m.th), my = y - m.h * near * grow + sn * R * ELL;
        m.im.setVisible(fade > 0.05).setPosition(axis(m.h * grow) + Math.cos(m.th) * R, my).setDepth(y + sn * R * ELL + (sn > 0 ? 1.5 : -1.5))
          .setScale(m.k * near * (0.8 + 0.25 * sn)).setAngle(m.rot + t * 0.3).setAlpha(fade * (sn > 0 ? 1 : 0.45) * Math.min(1, m.h / 30, (H - m.h) / 30));
      }
      for (const bl of blades) {
        const th = bl.th + t * 0.0075, sn = Math.sin(th), R = rad(bl.h) * 0.95 * near * grow;
        bl.im.setVisible(fade > 0.2).setPosition(axis(bl.h) + Math.cos(th) * R, y - bl.h * near * grow + sn * R * ELL).setDepth(y + sn * R * ELL + (sn > 0 ? 1.6 : -1.6))
          .setScale((0.15 + 0.06 * Math.sin(t / 30 + bl.th)) * near).setAngle(t * 0.4).setAlpha(fade * (sn > 0 ? 1 : 0.4));
      }
      // the floor under it
      shadow.setVisible(true).setPosition(x, y + 4).setDisplaySize(190 * near, 54 * near).setDepth(GROUND + 1.8).setAlpha(fade * 0.5);
      eddy.setVisible(true).setPosition(x, y + 4).setScale(ek * near, ek * near * SQUASH).setAngle(-t * 0.5).setDepth(GROUND + 2.1).setAlpha(fade * 0.75);
      eg.setVisible(true).setPosition(x, y + 4).setScale(ek * near * 1.04, ek * near * SQUASH * 1.04).setAngle(-t * 0.5).setDepth(GROUND + 2.11).setAlpha(fade * 0.35);
      if (t >= nextRing && fade > 0.3) { // a gust rising up it, widening (its far half behind, its near half in front)
        nextRing = t + 260;
        const fl = Math.random() < 0.5;
        for (const [crop, z] of [[undefined, -R0 * ELL], [0.5, R0 * ELL]] as const)
          this.spr({ name: 'wind_ring', w: 96 * near, life: 640, add: true, crop, flipX: fl, follow: () => ({ x: cur.x, y: cur.y - 12, d: cur.y }), dz: z,
            my: (uu) => -240 * near * uu, sx: (uu) => 1 + 1.6 * uu, sy: (uu) => 0.8 + 1.2 * uu, a: kf([0, 0], [0.15, 0.6], [0.7, 0.4], [1, 0]) });
      }
      if (t >= nextDust && fade > 0.5) { nextDust = t + 240; this.dust(x, y + 4, 96 * near); }
      if (t >= end) { kill(); return false; }
      return true;
    } });
  }

  /** Falcon Dive: the samurai wrapped in a falcon of fire through the leap and the dive, a ribbon of red light streaming
   *  behind him all the way down. */
  private falcon(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r), fl = side < 0;
    const q0 = this.me(r);
    this.later(T.startup, () => { this.dust(q0.x, q0.y, 110); this.dustRing(q0.x, q0.y, 150); }, r);
    const land = T.startup + (r.skill.hits[1]?.at ?? 300);
    this.trail(() => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x - side * 4, y: c.y - c.z - 52, d: c.y - 0.5 } : null; },
      { delay: T.startup - 20, until: land - T.startup + 30, span: 230, w: 46, fade: 240, run: r, glow: 0.9 });
    const bird = s.add.image(0, 0, KIT, 'falcon_dive').setVisible(false).setFlipX(fl);
    const glow = s.add.image(0, 0, KIT, 'falcon_dive').setVisible(false).setFlipX(fl).setBlendMode(Phaser.BlendModes.ADD);
    const k = 190 / bird.width, hitAt = r.skill.hits[1]?.at ?? 300;
    let lastGhost = 0;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - T.startup, c = this.ctx.casterPos(r.attackerId);
      if (e < 0) return true;
      if (this.broken(r) || !c || r.fired.has(1) || e > hitAt + 30) { bird.destroy(); glow.destroy(); return false; } // (gone the moment it strikes: the explosion takes its place)
      const p = e / Math.max(1, hitAt), up = p < 0.42, ang = up ? side * -78 : side * 8, al = up ? Math.min(1, p / 0.25) * 0.75 : 1;
      const x = c.x - side * 6, y = c.y - c.z - 56;
      bird.setVisible(true).setPosition(x, y).setScale(k).setAngle(ang).setDepth(c.y + 3).setAlpha(al);
      glow.setVisible(true).setPosition(x, y).setScale(k * 1.04).setAngle(ang).setDepth(c.y + 3.01).setAlpha(al * 0.4);
      if (!up && e - lastGhost > 36) { // afterimages of the bird on the dive
        lastGhost = e;
        this.spr({ name: 'falcon_dive', x, y, depth: c.y + 2, w: 190, angle: ang, flipX: fl, life: 140, add: true, a: kf([0, 0.4], [1, 0, inQ]) });
      }
      return true;
    } });
  }
  private falconImpact(r: CastRun): void {
    const q = this.me(r), side = sideOf(r), cam = this.ctx.cam();
    // an explosion of light where he strikes the floor: a short white flash in front, and the fire falcon's wings, rays of
    // light and a pillar of light opening BEHIND the fighters (they stay in sight, standing in it); the wave runs out along
    // the floor
    this.pop('glint', q.x, q.y - 44, 210, { life: 180, depth: TOP + 3, angle: 0, glow: 0.7, add: true }); // (the flash: light only — no dark core over the fighters)
    this.spr({ name: 'sun_rays', x: q.x, y: q.y - 50, w: 320, life: 440, add: true, tint: 0xff6a78, depth: q.y - 3, rot: (u) => 18 * u,
      sx: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.15]), sy: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.15]), a: kf([0, 0.9], [0.35, 0.65], [1, 0, inQ]) });
    this.spr({ name: 'launch_beam', x: q.x, y: q.y + 6, oy: 0.95, depth: q.y - 2.8, w: 160, h: 240, life: 320, glow: 0.4,
      sx: kf([0, 0.4], [0.2, 1, out3], [1, 0.6]), sy: kf([0, 0.2], [0.18, 1, out3], [1, 1.1]), a: kf([0, 1], [0.35, 0.85], [1, 0, inQ]) });
    this.pop('burst_crit', q.x, q.y - 30, 120, { life: 220, depth: TOP + 3.2 });
    this.spr({ name: 'falcon_spread', x: q.x, y: q.y + 6, oy: 0.92, depth: q.y - 3.2, w: 250, life: 460, glow: 0.4,
      sx: kf([0, 0.5], [0.25, 1.05, out3], [1, 1.15]), sy: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]), my: (u) => -24 * u });
    this.shock(q.x, q.y, 300); this.shock(q.x, q.y, 380, { delay: 80 });
    this.crack(q.x, q.y + 2, 170, side * 8); this.dustRing(q.x, q.y, 240); this.dust(q.x - 50, q.y, 110); this.dust(q.x + 50, q.y, 110, 40);
    this.petals(q.x, q.y - 40, 12, 150, { depth: q.y + 5 });
    if (r.own) { cam.shake(220, 0.008); this.ctx.punch(0.04, 240); }
  }

  /** Rising Sun: the war banner rises behind him and flies in the wind (its cloth bends for real), gold rays behind the sun. */
  private risingSun(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, side = sideOf(r), q = this.me(r), bx = q.x - side * 44, by = q.y - 4, life = T.startup + T.active + 1900;
    const poleH = 246, clothH = 214, clothW = 70, top = by - poleH + 14;
    const pole = s.add.image(bx, by, KIT, 'banner_pole').setOrigin(0.5, 0.98).setDepth(by - 3).setVisible(false);
    pole.setScale(poleH / pole.height);
    const N = 12, pts = Array.from({ length: N }, (_, i) => new Phaser.Math.Vector2(0, (i / (N - 1)) * clothH));
    const cx = bx - side * (clothW / 2 + 3);
    const cloth = s.add.rope(cx, top, KIT, 'banner_cloth', pts, false).setDepth(by - 3.2).setVisible(false);
    const fr = s.textures.getFrame(KIT, 'banner_cloth');
    cloth.setScale(clothW / fr.width, 1);
    const rays = s.add.image(cx, top + clothH * 0.3, KIT, 'sun_rays').setBlendMode(Phaser.BlendModes.ADD).setDepth(by - 3.3).setVisible(false);
    const rk = 160 / rays.width;
    this.add({ t: 0, step: (_dt, t) => {
      if ((this.broken(r) && t < T.startup + 20) || this.gone(r)) { pole.destroy(); cloth.destroy(); rays.destroy(); return false; }
      const rise = Math.min(1, t / Math.max(1, T.startup)), up = back(rise), fade = t > life - 450 ? Math.max(0, (life - t) / 450) : 1;
      pole.setVisible(true).setScale((poleH / pole.height) * 1, (poleH / pole.height) * up).setAlpha(Math.min(1, t / 120) * fade);
      const ty = by - (by - top) * up;
      cloth.setVisible(up > 0.6).setPosition(cx, ty).setAlpha(Math.min(1, (up - 0.6) / 0.3) * fade);
      for (let i = 0; i < N; i++) { const v = i / (N - 1); pts[i].set(-side * Math.sin(t / 230 + v * 3.1) * 9 * v + side * 4 * v * v, v * clothH * (0.92 + 0.08 * Math.sin(t / 310 + v))); }
      cloth.setPoints(pts);
      rays.setVisible(t > T.startup * 0.5).setPosition(cx, ty + clothH * 0.3).setScale(rk * (1 + 0.08 * Math.sin(t / 120)) * Math.min(1, (t - T.startup * 0.5) / 300)).setAngle(t * 0.03).setAlpha(0.65 * fade);
      if (t >= life) { pole.destroy(); cloth.destroy(); rays.destroy(); return false; }
      return true;
    } });
  }
  /** The banner's light breaks over him: a golden aura flares up round him, rays behind the banner, rings of light run out —
   *  and a faint golden light stays on him for the buff. */
  private sunBurst(r: CastRun): void {
    const q = this.me(r), side = sideOf(r);
    this.auraFlare(r, 'aura_gold', 200, 1000);
    this.pop('sun_rays', q.x - side * 70, q.y - q.z - 150, 340, { life: 520, add: true, glow: 0.4, angle: 0 });
    this.shock(q.x, q.y, 320, { tint: 0xffd27a }); this.shock(q.x, q.y, 420, { tint: 0xffd27a, delay: 90 });
    this.petals(q.x, q.y - 80, 14, 140, { depth: q.y + 4 });
    if (r.own) this.ctx.cam().shake(160, 0.004);
    this.sunAura(r);
  }

  /** Rising Sun's light on him through the buff: a faint golden flame round him, breathing, motes of light rising off him
   *  (as much of it shows as of him: none while he is hidden among his doubles). */
  private sunAura(r: CastRun): void {
    if (r.attackerId.includes('#')) return; // (a double's copy of the cast: the buff is his)
    this.clearSun(r.attackerId, true);
    const s = this.ctx.scene, mk = (add: boolean) => s.add.image(0, 0, KIT, 'aura_gold').setOrigin(0.5, 0.92).setVisible(false).setBlendMode(add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    this.suns.set(r.attackerId, { t: 0, ims: [mk(false), mk(true)], next: 700 });
  }
  clearSun(id: string, now = false): void {
    const u = this.suns.get(id); if (!u) return;
    this.suns.delete(id);
    if (now) { for (const im of u.ims) im.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: u.ims, alpha: 0, duration: 400, onComplete: () => { for (const im of u.ims) im.destroy(); } });
  }
  private stepSuns(dt: number): void {
    for (const [id, u] of this.suns) {
      u.t += dt;
      const c = this.ctx.casterPos(id);
      if (!c || u.t >= SUN_MS || this.ctx.alive?.(id) === false) { this.clearSun(id); continue; }
      const vis = this.seen(id), on = Math.min(1, u.t / 1000) * Math.min(1, (SUN_MS - u.t) / 600) * vis, x = c.x, y = c.y - c.z + 8;
      const k = (118 / u.ims[0].width) * (1 + 0.03 * Math.sin(u.t / 260)), ky = k * (0.9 + 0.05 * Math.sin(u.t / 340));
      u.ims[0].setVisible(on > 0.01).setPosition(x, y).setScale(k, ky).setDepth(c.y - 2.4).setAlpha(0.2 * on);
      u.ims[1].setVisible(on > 0.01).setPosition(x, y).setScale(k * 1.04, ky * 1.04).setDepth(c.y - 2.39).setAlpha((0.13 + 0.05 * Math.sin(u.t / 200)) * on);
      if (u.t >= u.next) { // a mote of light rising off him
        u.next = u.t + rnd(240, 420);
        if (vis > 0.5) this.spr({ name: 'glint', x: x + rnd(-30, 30), y: y - rnd(16, 96), depth: c.y + (Math.random() < 0.5 ? 2 : -2), w: rnd(13, 20), add: true, tint: 0xffd27a, life: 900,
          my: (q) => -54 * q, rot: (q) => 120 * q, a: kf([0, 0], [0.2, 0.85], [1, 0]) });
      }
    }
  }

  /** Phantom Blades: phantoms of the samurai dash through the field in crossing lines (an ink stroke and a cut of light each). */
  private phantom(r: CastRun, i: number): void {
    const s = r.skill, sh = s.hits[0].shape as { radius: number; bias?: number }, o = r.origin, a = r.aim, R = sh.radius;
    const cx = o.x + a.x * (sh.bias ?? 150), cy = o.y + a.y * (sh.bias ?? 150) - o.z - 60, last = i >= s.hits.length - 1;
    if (!last) {
      const ang = rnd(-40, 40) + (i % 2 ? 180 : 0) + (i % 3 === 2 ? 90 : 0), fl = Math.cos(ang * Math.PI / 180) < 0;
      const ox = cx + rnd(-R * 0.3, R * 0.3), oy = cy + rnd(-R * 0.15, R * 0.15);
      this.spr({ name: 'ink_long', x: ox, y: oy, angle: ang, flipY: fl, w: R * 2.1, h: 60, depth: TOP + 2, life: 520,
        sx: kf([0, 0.2], [0.14, 1, out3]), sy: kf([0, 0.8], [0.14, 1], [1, 0.4, inQ]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
      this.cut('cut_line', R * 2.2, ang, { x: ox, y: oy, depth: TOP + 3, h: 22, grow: 60, hold: 40, fade: 180, glow: 0.7, sweep: 0, flipY: fl });
      const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180), L = R * 1.15; // a phantom of him dashes along the stroke
      this.phantomDash(r, ox - c * L, oy - sn * L + 60, ox + c * L, oy + sn * L + 60, TOP + 2.5);
      return;
    }
    const cam = this.ctx.cam();
    this.cut('cut_x', R * 1.9, rnd(-8, 8), { x: cx, y: cy, depth: TOP + 4, grow: 60, hold: 90, fade: 260, glow: 0.8 });
    this.pop('burst_crit', cx, cy, R * 1.2, { life: 380 });
    this.shock(cx, cy + 60, R * 2.4);
    this.petals(cx, cy, 24, R, { depth: TOP + 3 });
    if (r.own) { cam.shake(260, 0.009); this.ctx.punch(0.05, 260); }
  }

  /** Phantom Blades' wind-up: the field it will cut is marked on the floor (a ring with eight bright notches, one per cut),
   *  and silhouettes of him rise at its edge, poised, until the cuts begin. */
  private phantomField(r: CastRun): void {
    const T = r.timings, s = r.skill, sh = s.hits[0].shape as { radius: number; bias?: number }, o = r.origin, a = r.aim, R = sh.radius;
    const cx = o.x + a.x * (sh.bias ?? 150), cy = o.y + a.y * (sh.bias ?? 150), life = T.startup + T.active + 200;
    this.spr({ name: 'timer_ring', x: cx, y: cy, depth: GROUND + 2.4, w: R * 2.1, life, run: r, glow: 0.55,
      sx: kf([0, 0.2], [T.startup / life, 1, out3], [1, 1.04]), sy: kf([0, 0.2], [T.startup / life, 1, out3], [1, 1.04]), a: kf([0, 0], [0.15, 0.95], [0.85, 0.95], [1, 0]) });
    this.floor('vortex', cx, cy, R * 1.6, T.startup + 80, { spin: 260, run: r, depth: GROUND + 2.2, a: kf([0, 0], [0.4, 0.55], [1, 0]), s: kf([0, 0.4], [1, 1, out3]) });
    [200, -20, 140, 40].forEach((deg, k) => { // poised at the edge, facing in
      const th = (deg * Math.PI) / 180, x = cx + Math.cos(th) * R * 0.92, y = cy + Math.sin(th) * R * 0.92 * SQUASH;
      this.silhouette(r, x, y - o.z, y + 1, T.startup + 60 - k * 40, { delay: 60 + k * 40, face: x < cx ? 1 : -1, scale: 1.1, a: kf([0, 0], [0.35, 0.8], [0.9, 0.8], [1, 0]) });
    });
  }

  /** A phantom of the samurai — his own body as it is this moment, in ink with a crimson edge — dashing from (x0, y0) to
   *  (x1, y1) (feet), afterimages in its wake. */
  private phantomDash(r: CastRun, x0: number, y0: number, x1: number, y1: number, depth: number): void {
    const b = this.ctx.body?.(r.attackerId); if (!b) return;
    const s = this.ctx.scene, ADD = Phaser.BlendModes.ADD, flip = (x1 < x0) !== (sideOf(r) < 0) ? !b.flipX : b.flipX;
    const mk = (fill: number, k: number) => s.add.image(x0, y0, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx * k * 1.12, b.sy * k * 1.12).setFlipX(flip).setTintFill(fill).setVisible(false);
    const rim = mk(0xff3048, 1.08).setBlendMode(ADD), ink = mk(0x12040a, 1), life = 190; // the crimson glow behind, the ink body over it: a lit edge
    let trail = -99;
    this.add({ t: 0, step: (_dt, t) => {
      const u = Math.min(1, t / life), p = out(u), x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p, a = u < 0.12 ? u / 0.12 : u > 0.72 ? (1 - u) / 0.28 : 1;
      rim.setVisible(true).setPosition(x, y + 3).setDepth(depth - 0.01).setAlpha(0.85 * a);
      ink.setVisible(true).setPosition(x, y).setDepth(depth).setAlpha(0.92 * a);
      if (t - trail > 28 && u < 0.9) {
        trail = t;
        const g = mk(0xff3048, 1).setBlendMode(ADD).setPosition(x, y).setDepth(depth - 0.02).setVisible(true).setAlpha(0.32 * a);
        this.add({ t: 0, step: (_d, tt) => { g.setAlpha(0.32 * a * (1 - tt / 170)); if (tt >= 170) { g.destroy(); return false; } return true; } });
      }
      if (u >= 1) { ink.destroy(); rim.destroy(); return false; }
      return true;
    } });
  }

  /** Sakura Bind: a gust blows petals in to where it was aimed and a pattern of blossoms shows faintly in the stones there
   *  (drawn into the floor, not glowing over it). */
  private bind(r: CastRun): void {
    const T = r.timings, h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin, hold = h0.reaction.hardCC?.ms ?? 2000;
    const life = T.startup + hold + 260, k0 = Math.max(0.02, T.startup / life);
    this.floor('sigil_sakura', c.x, c.y, R * 2.05, life, { spin: 40, run: r, depth: GROUND + 2, tint: 0xe8b4bf,
      a: kf([0, 0], [k0, 0.55], [(life - 360) / life, 0.42], [1, 0]), s: kf([0, 0.85], [k0, 1, out3]) });
    this.petals(c.x, c.y - 30, 14, R * 1.1, { inward: true, life: T.startup + 140, depth: c.y + 3 });
  }
  /** The bind itself: the petals swirl in over the stones and blossoms push up through cracks round the rim, with a puff
   *  of stone dust each (each bound foe gets its branches, `cage`). */
  private bloom(r: CastRun): void {
    const h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin;
    this.floor('vortex', c.x, c.y, R * 1.9, 420, { spin: -240, depth: GROUND + 2.4, tint: 0xffd2da, a: kf([0, 0.28], [0.5, 0.2], [1, 0, inQ]), s: kf([0, 1.1], [1, 0.35, inQ]) });
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + rnd(-0.15, 0.15), bx = c.x + Math.cos(th) * R * 1.0, by = c.y + Math.sin(th) * R * SQUASH, dl = 30 + i * 18;
      this.floor('crack', bx, by + 3, 34, 1400, { angle: rnd(0, 360) + CRACK_TILT, squash: 0.5, delay: dl, depth: GROUND + 1.6, tint: 0x4a2418, a: kf([0, 0], [0.05, 0.7], [0.7, 0.6], [1, 0]) });
      this.spr({ name: 'dust', x: bx, y: by + 2, oy: 0.85, depth: by + 2, w: 46, delay: dl, life: 420, tint: DUST, sx: kf([0, 0.4], [1, 1.2, out3]), sy: kf([0, 0.4], [1, 1.05, out3]), a: kf([0, 0.7], [1, 0, inQ]), my: (u) => -8 * u });
      this.spr({ name: 'blossom_cluster', x: bx, y: by, oy: 0.88, depth: by + 1, w: rnd(28, 36), life: 1000, delay: dl, angle: rnd(-18, 18), flipX: Math.random() < 0.5,
        sx: kf([0, 0], [0.2, 1, back], [0.78, 1], [1, 0.6]), sy: kf([0, 0], [0.2, 1, back], [0.78, 1], [1, 0.6]), a: kf([0, 1], [0.78, 1], [1, 0, inQ]) });
    }
    this.ctx.punch(0.02, 160);
  }
  /** A bound foe: cherry branches break up through the stones round it (cracks and stone dust at their roots) and curl in
   *  over it (the near ones low, so the foe stays in sight); petals come off them and drift down all through the bind; at
   *  its end they wither back into the floor. */
  private cage(x: number, y: number, hold: number): void {
    const life = hold + 120, grow = 240 / life, wither = (hold - 180) / life;
    ([[-34, -6, 64, false], [34, -6, 60, false], [-28, 7, 48, true], [30, 7, 46, true]] as const).forEach(([dx, dy, w, near], i) => {
      const ph = rnd(0, 6), lean = (dx > 0 ? -10 : 10) + rnd(-3, 3), al = near ? 0.9 : 1, rx = x + dx, ry = y + dy + 4;
      this.floor('crack', rx, ry, 30, life + 300, { angle: rnd(0, 360) + CRACK_TILT, squash: 0.5, delay: i * 30, depth: GROUND + 1.6, tint: 0x4a2418, a: kf([0, 0], [0.04, 0.75], [0.8, 0.6], [1, 0]) });
      this.spr({ name: 'dust', x: rx, y: ry, oy: 0.85, depth: ry + 2, w: 40, delay: i * 30, life: 380, tint: DUST, sx: kf([0, 0.4], [1, 1.2, out3]), sy: kf([0, 0.4], [1, 1.05, out3]), a: kf([0, 0.65], [1, 0, inQ]), my: (u) => -6 * u });
      this.spr({ name: i % 2 ? 'branch_2' : 'branch_1', x: rx, y: ry, oy: 0.97, depth: y + (near ? 3 : -3), w: w + rnd(-3, 3), life, delay: i * 30, flipX: dx < 0,
        sy: kf([0, 0], [grow, 1, back], [wither, 1], [1, 0, inQ]), sx: kf([0, 0.5], [grow, 1, out], [wither, 1], [1, 0.7]), rot: (u) => lean + 3 * Math.sin((u * life) / 220 + ph), a: kf([0, al], [wither, al], [1, 0]) });
    });
    for (let t = 260; t < hold - 120; t += rnd(110, 190)) this.fallPetal(x + rnd(-36, 36), y - rnd(50, 86), y + rnd(-4, 10), t); // (petals coming off the branches)
    this.later(hold - 160, () => this.petals(x, y - 50, 8, 50, { depth: y + 4 }));
  }
  /** A petal coming off a branch: it drifts down, swaying and turning, and lies a moment on the floor before it fades. */
  private fallPetal(x: number, y0: number, floorY: number, delay: number): void {
    const drop = floorY - y0, life = 900 + drop * 4, sw = rnd(8, 16), ph = rnd(0, 6), spin = rnd(-260, 260), land = 0.7;
    this.spr({ name: `petal_${1 + Math.floor(Math.random() * 4)}`, x, y: y0, w: rnd(12, 16), life, delay, depth: floorY + 2, angle: rnd(0, 360),
      mx: (u) => Math.sin(Math.min(u, land) * 9 + ph) * sw * Math.min(1, u * 4), my: (u) => drop * Math.min(1, u / land), rot: (u) => spin * Math.min(u, land),
      sx: (u) => (u < land ? 0.55 + 0.45 * Math.abs(Math.cos(u * 10 + ph)) : 1), a: kf([0, 0], [0.08, 1], [0.86, 1], [1, 0]) });
  }

  /** Dragon Ascension: the dragon crest turns on the floor through the wind-up. */
  private ascension(r: CastRun): void {
    const T = r.timings, q = this.me(r);
    this.floor('sigil_dragon', q.x, q.y, 300, T.startup + T.active + 500, { spin: -200 * sideOf(r), run: r, glow: 0.35,
      a: kf([0, 0], [0.12, 1], [0.8, 1], [1, 0]), s: kf([0, 0.6], [0.2, 1, out3]) });
    this.petals(q.x, q.y - 30, 10, 140, { inward: true, life: T.startup + 80, depth: q.y + 3 });
  }
  /** The dragon breaks out of the floor and spirals up round him as high as it carries the foes, then flies off. */
  private ascensionBurst(r: CastRun): void {
    const q = this.me(r), cx = q.x, cy = q.y, side = sideOf(r), cam = this.ctx.cam();
    this.launchBeam(cx, cy, 260);
    this.shock(cx, cy, 300); this.dustRing(cx, cy, 260); this.dust(cx - 60, cy, 110); this.dust(cx + 60, cy, 110, 40);
    // the dragon bursts out of the floor just in front of him and climbs into the sky in long S-curves — its whole body
    // following its head along one path (no seams, nothing jumping), fast out of the floor, slowing near the top — roars
    // there, and melts into sparks from its tail up as it drifts on
    const gx = cx + side * 30, gy = cy + 2, A = 64, LAM = 330, TOPS = 300, RISE = 950, ROAR = 0.8, MELT0 = 900, MELT = 520, d = cy + 6; // (its jaws stay in sight at the top)
    const path = (sv: number): Pt => { const e = Math.min(1, Math.max(0, sv) / 150), w = e * e * (3 - 2 * e); return { x: gx + side * A * w * Math.sin((sv / LAM) * Math.PI * 2), y: gy - sv, d }; };
    const drg = this.serpent(48, { glow: 0.32, flip: side < 0 });
    let roared = false, nextSpark = 0, nextPetal = 0;
    this.add({ t: 0, step: (_dt, t) => {
      if (this.gone(r)) { drg.destroy(); return false; }
      const u = Math.min(1, t / RISE), neck = -40 + (TOPS + 40) * out3(u) + Math.max(0, t - RISE) * 0.2, melt = Math.max(0, (t - MELT0) / MELT);
      drg.place(path, neck, Math.min(1, t / 90), Math.min(1, melt));
      if (t >= nextPetal && melt < 0.5) { nextPetal = t + 60; const p = drg.at(path, neck, 0.9); this.petals(p.x, p.y, 1, 24, { depth: p.d + 1, life: 700 }); }
      if (!roared && u >= ROAR) { roared = true; const n = path(neck), a0 = Math.atan2(n.y - path(neck - 8).y, n.x - path(neck - 8).x); this.roar(r, { x: n.x + Math.cos(a0) * 150, y: n.y + Math.sin(a0) * 150, d: n.d }); }
      if (melt > 0 && melt < 1 && t >= nextSpark) { // it scatters into sparks where it melts
        nextSpark = t + 30;
        for (let k = 0; k < 2; k++) { const p = drg.at(path, neck, Math.min(1, melt * 1.2 - 0.1 + rnd(-0.04, 0.04))); this.pop('spark_s', p.x + rnd(-12, 12), p.y + rnd(-12, 12), rnd(34, 56), { life: 240, depth: p.d + 2, glow: 0.5 }); }
      }
      if (melt >= 1) { drg.destroy(); return false; }
      return true;
    } });
    if (r.own) { cam.shake(220, 0.007); this.ctx.punch(0.035, 240); }
  }
  /** At the top of its climb the dragon roars: a burst at its jaws, a ring of air thrown out, petals, the screen shakes. */
  private roar(r: CastRun, p: Pt): void {
    this.pop('burst', p.x, p.y, 220, { life: 380, depth: TOP + 3, angle: 0, glow: 0.5 });
    this.spr({ name: 'shock_ring', x: p.x, y: p.y + 6, depth: TOP + 2.8, w: 300, h: 190, life: 480, glow: 0.6, tint: 0xff6a78,
      sx: kf([0, 0.2], [1, 1.25, out3]), sy: kf([0, 0.2], [1, 1.25, out3]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
    this.petals(p.x, p.y, 16, 150, { depth: TOP + 2.5 });
    if (r.own) { this.ctx.cam().shake(170, 0.006); this.ctx.punch(0.02, 160); }
  }

  // ------------------------------------------------------------------ God of Blades: the halo

  /** Eight ghost katanas rise one by one into a fan behind him, a golden halo at their heart; they stay for the buff. Each
   *  is drawn solid with its light added over it (they read on bright floors too). */
  private halo(r: CastRun): void {
    const L = r.skill.linger, s = this.ctx.scene; if (!L) return;
    this.clearHalo(r.attackerId, true);
    const c = this.me(r), side = sideOf(r), until = r.timings.startup + L.startMs + L.everyMs * L.count, ADD = Phaser.BlendModes.ADD;
    const ring = (add: boolean) => { const im = s.add.image(c.x, c.y - c.z - 74, KIT, 'halo_gold').setAlpha(0); if (add) im.setBlendMode(ADD); return im.setScale(HALO / im.width); };
    const blade = (add: boolean) => { const im = s.add.image(c.x, c.y - c.z - 70, KIT, 'katana_ghost').setOrigin(0.5, 0.9).setAlpha(0); if (add) im.setBlendMode(ADD); return im.setScale(KATANA / im.height); };
    this.halos.set(r.attackerId, { run: r, imgs: Array.from({ length: 8 }, () => blade(false)), gls: Array.from({ length: 8 }, () => blade(true)), halo: ring(false), hg: ring(true),
      t: 0, until, lastX: c.x, face: side, next: 0, away: new Set(), spent: new Set() });
  }

  clearHalo(attackerId: string, now = false): void {
    const h = this.halos.get(attackerId); if (!h) return;
    this.halos.delete(attackerId);
    const all = [...h.imgs, ...h.gls, h.halo, h.hg];
    if (now) { for (const o of all) o.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: all, alpha: 0, duration: 300, onComplete: () => { for (const o of all) o.destroy(); } });
  }

  private haloSlot(h: Halo, k: number, c: V3): { x: number; y: number; ang: number } {
    const th = Phaser.Math.DegToRad(-160 + (k / 7) * 140 + 3 * Math.sin(h.t / 600 + k)), px = c.x - h.face * 12, py = c.y - c.z - 70;
    const dx = Math.cos(th) * 52 * h.face, dy = Math.sin(th) * 46; // (the first of them behind his back)
    return { x: px + dx, y: py + dy, ang: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90 };
  }

  private stepHalos(dt: number): void {
    for (const [id, h] of this.halos) {
      const c = this.ctx.casterPos(id);
      h.t += dt;
      if (!c || h.t >= h.until || this.broken(h.run) || this.ctx.alive?.(id) === false) { this.clearHalo(id); continue; } // (cast broken off before the buff: no halo)
      const f = this.ctx.body?.(id)?.face; // (the way he faces; a double: the way it moves)
      if (f) h.face = f; else if (Math.abs(c.x - h.lastX) > 0.5) h.face = c.x > h.lastX ? 1 : -1;
      h.lastX = c.x;
      const vis = this.seen(id), rise = Math.min(1, h.t / 600) * vis, breathe = 1 + 0.04 * Math.sin(h.t / 300), hx = c.x - h.face * 12, hy = c.y - c.z - 72, hk = (HALO / h.halo.width) * breathe;
      const left = 1 - h.spent.size / 8 * 0.45; // (the halo dims as its katanas are spent)
      h.halo.setPosition(hx, hy).setDepth(c.y - 2.2).setAlpha(0.85 * rise * left).setAngle(h.t * 0.02).setScale(hk);
      h.hg.setPosition(hx, hy).setDepth(c.y - 2.19).setAlpha(rise * left * (0.32 + 0.1 * Math.sin(h.t / 170))).setAngle(h.t * 0.02).setScale(hk * 1.03);
      h.imgs.forEach((im, k) => {
        if (h.away.has(k) || h.spent.has(k)) return;
        const p = this.haloSlot(h, k, c), on = Math.min(1, Math.max(0, (h.t - k * 70) / 160)) * vis;
        im.setPosition(p.x, p.y).setAngle(p.ang).setDepth(c.y - 1.6).setAlpha(0.95 * on);
        h.gls[k].setPosition(p.x, p.y).setAngle(p.ang).setDepth(c.y - 1.59).setAlpha(on * (0.3 + 0.12 * Math.sin(h.t / 140 + k)));
      });
    }
  }

  /** God of Blades strike: a katana of the halo turns on the foe and flies at it (its afterimages behind it), stabs down
   *  into it and stays in a moment, shuddering, then pulls out and fades away — it is spent: the halo has one fewer (eight
   *  strikes in all, LegacyCourtyardScene.bladeStrikes). The hit lands as it arrives (150 ms); it follows the foe it was
   *  thrown at (`targetId`). */
  bladeStrike(attackerId: string, to: V3, targetId?: string): void {
    const h = this.halos.get(attackerId), c = this.ctx.casterPos(attackerId); if (!h || !c || !this.ready || h.next >= 8) return;
    const k = BLADE_ORDER[h.next++];
    const im = h.imgs[k], gl = h.gls[k]; if (!im) return;
    h.away.add(k); h.spent.add(k);
    this.petals(im.x, im.y - 20, 4, 30, { depth: c.y + 2 }); // (petals left where it was)
    const FLY = 150, STICK = 210, OUT = 130, L = KATANA * 0.9, IN = 26, sx = im.x, sy = im.y, a0 = im.angle, kk = KATANA / im.height, kw = (KATANA * im.width) / im.height;
    const goal = () => { const t = targetId ? this.ctx.targetPos?.(targetId) : null; return t ? { x: t.x, y: t.y - t.z - 78 } : { x: to.x, y: to.y - to.z - 38 }; };
    // the stab: from where it flies, at least this steep (it comes down from the halo)
    const g0 = goal(), d0 = Math.hypot(g0.x - sx, g0.y - sy) || 1;
    let dx = (g0.x - sx) / d0, dy = (g0.y - sy) / d0;
    if (dy < 0.6) { dy = 0.6; dx = (dx < 0 ? -1 : 1) * 0.8; }
    const aim = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90, turn = Phaser.Math.Angle.ShortestBetween(a0, aim);
    let last = -99, struck = false;
    im.setDepth(TOP + 2); gl.setDepth(TOP + 2.01);
    this.add({ t: 0, step: (_dt, t) => {
      if (!im.scene) return false; // (the halo is gone)
      const g = goal(), hx = g.x - dx * (L - IN), hy = g.y - dy * (L - IN); // the hilt, with the tip in the foe
      if (t < FLY) {
        const u = t / FLY, e = 0.25 * u + 0.75 * u * u, x = sx + (hx - sx) * e, y = sy + (hy - sy) * e - 34 * Math.sin(Math.PI * u), ang = a0 + turn * out3(Math.min(1, u / 0.35));
        im.setPosition(x, y).setAngle(ang).setScale(kk).setAlpha(1); gl.setPosition(x, y).setAngle(ang).setScale(kk * 1.05).setAlpha(0.55);
        if (t - last > 22) { last = t; this.spr({ name: 'katana_ghost', x, y, oy: 0.9, w: kw, h: KATANA, angle: ang, add: true, life: 150, depth: TOP + 1.9, a: kf([0, 0.42], [1, 0, inQ]) }); }
        return true;
      }
      if (!struck) { struck = true; this.pop('spark_s', g.x, g.y, 66, { life: 200, depth: TOP + 3, glow: 0.5 }); }
      const e = t - FLY;
      if (e < STICK + OUT) { // in the foe, shuddering — then pulled out, fading
        const j = e < STICK ? 2.4 * (1 - e / STICK) * Math.sin(e / 9) : 0, pull = e < STICK ? 0 : out((e - STICK) / OUT) * 18, al = e < STICK ? 1 : 1 - (e - STICK) / OUT;
        const x = hx - dx * pull + j, y = hy - dy * pull;
        im.setPosition(x, y).setAngle(aim).setAlpha(al); gl.setPosition(x, y).setAngle(aim).setAlpha(0.5 * al);
        return true;
      }
      im.setAlpha(0); gl.setAlpha(0);
      h.away.delete(k);
      return false;
    } });
  }

  // ------------------------------------------------------------------ Sword Wave: the flying crescent

  /** Sword Wave: a crescent of crimson sword energy flying along its path (its own tail of light behind it), the trail of
   *  the fling at his blade; on impact (a foe, a wall, its end) it shatters into shards and petals. */
  projectile(p: Projectile): void {
    if (!this.ready) return;
    const s = this.ctx.scene, mk = (add: boolean) => s.add.image(p.x, p.y - p.z, KIT, 'wave_crescent').setOrigin(0.76, 0.5).setBlendMode(add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setDepth(p.y + 2);
    const im = mk(false), gl = mk(true).setAlpha(0.45);
    const me = this.ctx.casterPos(p.attackerId), ghosts = me ? (this.ctx.ghosts?.(p.attackerId) ?? []).map((g) => ({ im: mk(false), dx: g.x - me.x, dy: g.y - me.y })) : [];
    this.waves.set(p, { im, gl, t: 0, trail: 0, ghosts }); // (the doubles throw theirs too: the same crescent beside his)
    if (me) { // the fling: the trail of the swing at his blade
      const fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy);
      this.spr({ name: 'blade_trail', x: me.x + p.dx * 30, y: me.y - me.z - 52, w: 150, life: 200, flipX: fl, angle: along(ang, fl), glow: 0.3,
        sx: kf([0, 0.6], [0.25, 1, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
    }
  }
  projectileEnd(p: Projectile): void {
    const w = this.waves.get(p); if (!w) return;
    this.waves.delete(p);
    const end = p.end ?? { x: p.x, y: p.y }, fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy);
    const shatter = (x: number, y: number, size: number) => this.spr({ name: 'wave_break', x, y, w: size, life: 320, flipX: fl, angle: along(ang, fl) * 0.3, glow: 0.35, depth: TOP + 4,
      sx: kf([0, 0.6], [0.2, 1.05, out3], [1, 1.2]), sy: kf([0, 0.6], [0.2, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    shatter(end.x, end.y - p.z, 128);
    w.im.destroy(); w.gl.destroy();
    for (const g of w.ghosts) { shatter(end.x + g.dx, end.y + g.dy - p.z, 108); g.im.destroy(); }
  }
  private stepWaves(dt: number): void {
    for (const [p, w] of this.waves) {
      w.t += dt;
      const ang = screenAng(p.dx, p.dy) + 3 * Math.sin(w.t / 45), k = 150 / w.im.width, fl = p.dx < -0.01, x = p.x, y = p.y - p.z, pulse = 1 + 0.05 * Math.sin(w.t / 35);
      for (const im of [w.im, w.gl]) im.setPosition(x, y).setAngle(ang).setScale(k * (im === w.gl ? 1.04 : 1), k * pulse).setFlipY(fl).setDepth(p.y + (im === w.gl ? 2.01 : 2));
      for (const g of w.ghosts) g.im.setPosition(x + g.dx, y + g.dy).setAngle(ang).setScale(k, k * pulse).setFlipY(fl).setDepth(p.y + g.dy + 2);
      if (w.t - w.trail > 40) { // afterimages and a petal trail
        w.trail = w.t;
        this.spr({ name: 'wave_crescent', x, y, ox: 0.76, depth: p.y + 1, w: 150, angle: ang, flipY: fl, add: true, life: 150, a: kf([0, 0.24], [1, 0, inQ]) });
        if (Math.random() < 0.5) this.petals(x, y, 1, 22, { depth: p.y + 1, life: 600 });
      }
    }
  }

  // ------------------------------------------------------------------ passives

  /** Shinsoku: the mid-air dash leaves an ink stroke, a gust and petals behind. */
  shinsoku(x: number, y: number, dir: number): void {
    if (!this.ready) return;
    this.spr({ name: 'ink_short', x: x - dir * 34, y: y - 44, depth: TOP, w: 120, flipX: dir < 0, life: 380, sx: kf([0, 0.5], [0.3, 1.1, out3]), sy: kf([0, 1], [1, 0.5]), a: kf([0, 0.9], [1, 0, inQ]) });
    this.spr({ name: 'wind_lines', x: x - dir * 50, y: y - 40, depth: TOP, w: 110, flipX: dir < 0, add: true, life: 240, mx: (u) => -dir * 30 * u, a: kf([0, 0.8], [1, 0]) });
    this.petals(x - dir * 20, y - 30, 5, 50, { depth: TOP });
  }

  /** Willow Dodge: he slips aside; where he stood, a puff of ink and petals. */
  willowDodge(x: number, y: number, dir: number): void {
    if (!this.ready) return;
    this.spr({ name: 'ink_smoke', x: x - dir * 10, y: y - 50, depth: TOP, w: 96, life: 440, sx: kf([0, 0.55], [1, 1.3, out3]), sy: kf([0, 0.55], [1, 1.3, out3]), a: kf([0, 0.85], [1, 0, inQ]), rot: (u) => 40 * u });
    this.petals(x, y - 50, 9, 70, { depth: TOP });
  }

  /** Final Cut: a ghost katana sweeps through the foe right after the hit. */
  finalCut(at: V3, dir: number, big = false): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z - 40, k = big ? 1.2 : 1;
    this.spr({ name: 'katana_ghost', x, y, depth: TOP + 5, w: 17 * k, life: 150, oy: 0.5,
      mx: kf([0, -dir * 40], [1, dir * 40, inQ]), my: kf([0, -26], [1, 22, inQ]), angle: dir > 0 ? 125 : 55, rot: (u) => dir * 50 * u, a: kf([0, 0], [0.2, 0.85], [0.75, 0.85], [1, 0]) });
    this.cut('cut_thin', 88 * k, dir * 30, { x, y, depth: TOP + 4, flipX: dir < 0, delay: 50, grow: 40, hold: 25, fade: 110, glow: 0.35 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
    this.stepHalos(dt);
    this.stepSuns(dt);
    this.stepWaves(dt);
  }

  destroy(): void {
    for (const id of [...this.halos.keys()]) this.clearHalo(id, true);
    for (const id of [...this.suns.keys()]) this.clearSun(id, true);
    for (const [p] of this.waves) this.projectileEnd(p);
    this.live = []; this.incoming = [];
  }
}
