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
/** Hits whose cut "arrives late": a thin line stays on the foe and splits open a beat after. */
const DELAYED = new Set(['shadow_step', 'iai_strike', 'dragon_eclipse', 'mirage']);

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
  /** His body as drawn this moment (texture, frame, facing, origin, scale): phantoms of him are made of it. */
  body?(id: string): { key: string; frame: string | number; flipX: boolean; ox: number; oy: number; sx: number; sy: number } | null;
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
interface Halo { imgs: Phaser.GameObjects.Image[]; halo: Phaser.GameObjects.Image; t: number; until: number; lastX: number; face: number; next: number; away: Set<number> }
interface Wave { im: Phaser.GameObjects.Image; gl: Phaser.GameObjects.Image; t: number; trail: number; ghosts: { im: Phaser.GameObjects.Image; dx: number; dy: number }[] }

export class SamuraiFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private halos = new Map<string, Halo>();
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

  private shock(x: number, y: number, w: number, o: { delay?: number; tint?: number; life?: number } = {}): void {
    this.spr({ name: 'shock_ring', x, y, depth: GROUND + 2.5, w, delay: o.delay, add: true, tint: o.tint, life: o.life ?? 420, sx: kf([0, 0.25], [1, 1.25, out3]), sy: kf([0, 0.25], [1, 1.25, out3]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
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
  private launchBeam(x: number, y: number, h = 110): void {
    this.spr({ name: 'launch_beam', x, y: y + 4, oy: 0.95, depth: y + 3, w: h * 1.45, h, life: 280, glow: 0.35, sx: kf([0, 0.6], [1, 0.85]), sy: kf([0, 0.2], [0.3, 1, out3], [1, 1.15]), a: kf([0, 0.9], [0.35, 0.9], [1, 0, inQ]) });
  }
  /** The blade's glint at the hand (or in front of the chest): a four-pointed star that flares and turns. */
  private glint(r: CastRun, delay: number, size: number, dz = 62): void {
    const f = this.front(r, 16, dz);
    this.spr({ name: 'glint', w: size * 1.5, delay, life: 300, run: r, add: true, glow: 0.8, dz: 6,
      follow: () => { const h = this.ctx.hand(r.attackerId), p = f(); return h && p ? { x: h.x, y: h.y, d: p.d } : p; },
      sx: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), sy: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]), rot: (u) => 45 * (1 - out(u)) });
  }

  // ------------------------------------------------------------------ the dragon (head, bent body, tail)

  /** Places the crimson dragon along points (head first): a head, slices of its body between the points, a tail. */
  private dragon(thick: number): { place(pts: Pt[], alpha: number): void; destroy(): void } {
    const s = this.ctx.scene, imgs: Phaser.GameObjects.Image[] = [];
    const head = s.add.image(0, 0, KIT, 'dragon_head').setOrigin(0.06, 0.62).setVisible(false);
    const tail = s.add.image(0, 0, KIT, 'dragon_tail').setOrigin(0.02, 0.42).setVisible(false);
    const hg = s.add.image(0, 0, KIT, 'dragon_head').setOrigin(0.06, 0.62).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const hf = s.textures.getFrame(KIT, 'dragon_head'), tf = s.textures.getFrame(KIT, 'dragon_tail'), bf = s.textures.getFrame(KIT, 'dragon_body_0');
    const headH = thick * 1.7, tailH = thick * 0.95;
    return {
      place: (pts, alpha) => {
        while (imgs.length < pts.length - 1) imgs.push(s.add.image(0, 0, KIT, 'dragon_body_0').setOrigin(0.5, 0.5));
        imgs.forEach((im, i) => {
          if (i >= pts.length - 2) { im.setVisible(false); return; }
          const p = pts[i], q = pts[i + 1], ang = Math.atan2(p.y - q.y, p.x - q.x), len = Math.hypot(p.x - q.x, p.y - q.y);
          im.setFrame(`dragon_body_${7 - (i % 8)}`).setVisible(alpha > 0.01).setPosition((p.x + q.x) / 2, (p.y + q.y) / 2).setRotation(ang)
            .setScale((len * 1.3) / (bf.width || 1), thick / (bf.height || 1)).setFlipY(Math.cos(ang) < 0).setDepth((p.d + q.d) / 2).setAlpha(alpha);
        });
        if (pts.length < 2) { head.setVisible(false); tail.setVisible(false); hg.setVisible(false); return; }
        const a0 = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x), left = Math.cos(a0) < 0;
        for (const h of [head, hg]) h.setVisible(alpha > 0.01).setPosition(pts[1].x, pts[1].y).setRotation(a0).setScale(headH / hf.height).setFlipY(left).setDepth(pts[0].d + (h === hg ? 0.02 : 0.01));
        head.setAlpha(alpha); hg.setAlpha(alpha * 0.35);
        const n = pts.length, ta = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
        tail.setVisible(alpha > 0.01).setPosition(pts[n - 2].x, pts[n - 2].y).setRotation(ta).setScale(tailH / tf.height).setFlipY(Math.cos(ta) < 0).setDepth(pts[n - 1].d).setAlpha(alpha);
      },
      destroy: () => { for (const im of [...imgs, head, tail, hg]) im.destroy(); },
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
      case 'phantom_blades': if (!ghost) this.ctx.darken(T.startup + T.active + 160, 0.38); break;
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
      case 'mirage': this.cut('cut_heavy', 190, side * 8, { x: q.x + side * 50, y: y0 - 56, depth: TOP + 3, flipX: side < 0, grow: 60, hold: 50, fade: 200 }); break;
      case 'kagemusha': this.kageVanish(r.origin); break; // he vanishes where he stood (every screen, from the cast)
      case 'falcon_dive': if (i === 1) this.falconImpact(r); else this.cut('cut_thin', 120, side * 30, { x: q.x + side * 30, y: y0 - 40, depth: q.y + 4, flipX: side < 0 }); break;
      case 'rising_sun': this.sunBurst(r); break;
      case 'phantom_blades': this.phantom(r, i); break;
      case 'god_of_blades': this.shock(q.x, q.y, 300); this.petals(q.x, y0 - 80, 12, 120); break;
      case 'sakura_bind': this.bloom(r); break;
      case 'dragon_ascension': if (i === 0) this.ascensionBurst(r); else this.cut('cut_thin', 150, rnd(-30, 30), { x: q.x + rnd(-60, 60), y: y0 - 90 - i * 70, depth: TOP + 3, flipX: Math.random() < 0.5 }); break;
      case 'blossom_storm': this.stormCut(r, i); break;
      case 'dragon_eclipse': if (i < r.hits.length - 1) this.eclipseSlash(r, i); else this.eclipseCut(r, o); break;
      case 'tornado_blade': this.pop('burst', q.x + r.aim.x * 90, y0 - 40, 120); break;
    }
    void cam;
  }

  /** A confirmed hit on a foe: the spark (bigger for heavy and critical hits) and the shared marks of what happened to it. */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, reaction: string, heavy: boolean, crit: boolean): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z - 38, rapid = s.hits.length > 3 && !hit.heavy;
    if (crit) { this.pop('burst_crit', x, y, rapid ? 120 : 165, { life: 300 }); this.petals(x, y, 4, 50, { depth: TOP + 3 }); }
    else if (heavy && !rapid) this.pop('burst', x, y, 140, { life: 280 });
    else this.pop('spark_s', x, y, rapid ? 64 : 86, { life: 190 });
    if (reaction === 'launch') this.launchBeam(at.x, at.y);
    if (reaction === 'knockdown' || reaction === 'slam') { this.crack(at.x, at.y + 2, 120); this.dust(at.x, at.y, 120); }
    if (s.id === 'sakura_bind' && reaction === 'cc') this.cage(at.x, at.y, hit.reaction.hardCC?.ms ?? 2000);
    if (DELAYED.has(s.id) && (s.id !== 'dragon_eclipse' || hit.heavy)) this.later(170, () => this.cut('cut_split', 150, rnd(-28, 28), { x, y: y - 4, depth: TOP + 5, grow: 40, hold: 70, fade: 220, glow: 0.7 }));
  }

  /** The Mirage Counter fired: the mirage the blow struck shatters where he stood (the counter cut comes as its hit). */
  counter(r: CastRun): void {
    const m = this.stances.get(r.castId);
    if (!m || !this.ready) return;
    m.done = true;
    this.pop('ink_burst', m.x, m.y - m.z - 50, 170, { depth: m.y + 4, life: 460, glow: 0 });
    this.petals(m.x, m.y - m.z - 60, 14, 90, { depth: m.y + 5 });
    const q = this.me(r); // he is already behind the attacker: out of a swirl of ink, a flash of the blade
    this.spr({ name: 'ink_smoke', x: q.x, y: q.y - q.z - 44, depth: q.y + 4, w: 110, life: 320, sx: kf([0, 1.2], [1, 0.5, out]), sy: kf([0, 1.2], [1, 0.5, out]), a: kf([0, 0.8], [1, 0, inQ]), rot: (u) => -80 * u });
    this.pop('glint', q.x + sideOf(r) * 20, q.y - q.z - 56, 160, { life: 220, angle: 0, depth: TOP + 6, glow: 0.8 });
    this.ctx.callout({ x: q.x, y: q.y, z: q.z + 50 }, 'COUNTER!!', '#ff8a96', 0);
    this.ctx.punch(0.03, 200);
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
      this.cut('cut_rise', 112, 0, { follow: this.front(r, 40, 80), flipX: fl, grow: 70, hold: 45, fade: 180 });
      const p = this.front(r, 44, 92)(); if (p) this.petals(p.x, p.y, 5, 46, { depth: p.d + 4 });
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
    this.later(T.active, () => { const c = this.ctx.casterPos(r.attackerId); if (c) this.petals(c.x, c.y - c.z - 50, 6, 50, { depth: c.y + 4 }); });
  }

  private swallow(r: CastRun, i: number): void {
    const side = sideOf(r), fl = side < 0;
    if (i === 0) {
      this.cut('cut_rise', 118, 0, { follow: this.front(r, 44, 74), flipX: fl, grow: 70, hold: 40, fade: 170 });
      const base = this.front(r, 36, 46);
      this.spr({ name: 'swallow', w: 92, life: 330, flipX: fl, follow: base, dz: 6, glow: 0.5,     // the swallow of light flies the arc and turns back
        mx: kf([0, 0], [0.5, side * 40, out], [1, side * 62]), my: kf([0, 0], [0.5, -120, out], [1, -84, inQ]),
        rot: kf([0, side * -55], [0.5, side * -10], [1, side * 35]), a: kf([0, 0], [0.12, 1], [0.8, 1], [1, 0]), sx: kf([0, 0.6], [0.3, 1, out]), sy: kf([0, 0.6], [0.3, 1, out]) });
    } else this.cut('cut_thin', 132, -side * 18, { follow: this.front(r, 58, 124), flipX: fl, flipY: true, grow: 50, hold: 40, fade: 170 });
  }

  /** Iai Strike, held: the glint at the hilt grows in three steps (a flare at each), the reach of the coming cut on the floor. */
  private iai(r: CastRun): void {
    const L = r.skill.charge?.levels; if (!L) return;
    const s = this.ctx.scene, sc = r.chargeScale ?? 1, at = L.map((l) => l.at * sc), a = r.aim, side = sideOf(r), ADD = Phaser.BlendModes.ADD;
    const lineOf = (lv: number) => L[lv].hits[0].shape as { length: number; width: number };
    const hip = this.front(r, 14, 44);
    const p0 = hip() ?? { x: r.origin.x, y: r.origin.y - 44, d: r.origin.y };
    const star = s.add.image(p0.x, p0.y, KIT, 'glint').setBlendMode(ADD).setDepth(TOP).setScale(0.1);
    const core = s.add.image(p0.x, p0.y, 'dmg-glow').setBlendMode(ADD).setTint(CRIMSON).setDepth(TOP).setDisplaySize(30, 30).setAlpha(0.7);
    const o = r.origin, ang = screenAng(a.x, a.y);
    const reach = s.add.image(o.x, o.y, 'tg-line').setOrigin(8 / 512, 0.5).setAngle(Math.atan2(a.y, a.x) * (180 / Math.PI)).setTint(CRIMSON).setDepth(GROUND).setAlpha(0)
      .setScale(lineOf(0).length / 497, lineOf(0).width / 45);
    void ang;
    s.tweens.add({ targets: reach, alpha: 0.5, duration: 160 });
    let aura: Phaser.GameObjects.Image | null = null, lv = 0;
    const SIZE = [[0.18, 0.32], [0.42, 0.52], [0.62, 0.7]];
    this.add({ t: 0, step: (_dt, t) => {
      if (r.phase !== 'startup') { star.destroy(); core.destroy(); aura?.destroy(); s.tweens.add({ targets: reach, alpha: 0, duration: 120, onComplete: () => reach.destroy() }); return false; }
      const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0, q = hip() ?? p0;
      if (nl > lv) { // a step up: the glint flares, the reach grows
        lv = nl;
        this.pop('glint', q.x, q.y, 120 + lv * 70, { life: 240, angle: 0, depth: TOP + 1 });
        this.pop('burst', q.x, q.y, 70 + lv * 30, { life: 200, depth: TOP + 1 });
        s.tweens.add({ targets: reach, scaleX: lineOf(lv).length / 497, scaleY: lineOf(lv).width / 45, alpha: 0.5 + 0.15 * lv, duration: 140, ease: 'Back.easeOut' });
        if (lv === 2) { aura = s.add.image(q.x, q.y - 20, 'dmg-glow').setBlendMode(ADD).setTint(CRIMSON).setDepth(q.d - 1).setDisplaySize(150, 210).setAlpha(0); this.petals(q.x, q.y, 8, 70, { depth: q.d + 5 }); }
        if (r.own) this.ctx.cam().shake(50 + lv * 30, 0.0012 * lv);
      }
      const [s0, s1] = SIZE[lv], span = lv === 2 ? 1 : Math.max(1, at[lv + 1] - at[lv]), k = Math.min(1, (e - at[lv]) / span);
      const sz = (s0 + (s1 - s0) * k) * (1 + 0.08 * Math.sin(t / (lv === 2 ? 30 : 60)));
      star.setPosition(q.x, q.y).setScale(sz).setAngle(t * 0.06).setDepth(q.d + 6).setAlpha(0.85 + 0.15 * Math.sin(t / 45));
      core.setPosition(q.x, q.y).setDisplaySize(34 + 52 * sz, 34 + 52 * sz).setDepth(q.d + 5.9);
      aura?.setPosition(q.x - side * 14, q.y - 16).setDepth(q.d - 1).setAlpha(0.26 + 0.12 * Math.sin(t / 35));
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
    if (lv === 2) { // fully drawn: the floor is cut too, a shockwave runs down it, dust where the foes go down
      this.crack(q.x + a.x * len * 0.5, q.y + a.y * len * 0.5, len * 0.95, Math.atan2(a.y, a.x) * (180 / Math.PI));
      this.shock(q.x + a.x * len * 0.6, q.y + a.y * len * 0.6, 180);
      for (let i = 0; i < 4; i++) this.dust(q.x + a.x * len * (0.25 + 0.22 * i), q.y + a.y * len * (0.25 + 0.22 * i), 90, 110 + i * 40);
      if (r.own) { cam.shake(200, 0.007); this.ctx.punch(0.035, 220); }
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

  private flurry(r: CastRun, i: number): void {
    const side = sideOf(r), q = this.me(r), cx = q.x + side * 82, cy = q.y - q.z - 60, last = i >= 12;
    if (!last) {
      for (let n = 0; n < 2; n++) {
        const name = Math.random() < 0.6 ? 'cut_thin' : Math.random() < 0.6 ? 'cut_x' : 'cut_fan';
        this.cut(name, rnd(80, 128), rnd(0, 360), { x: cx + rnd(-46, 46), y: cy + rnd(-40, 34), depth: q.y + 4, grow: 30, hold: 18, fade: 95, glow: 0.5, sweep: 20 });
      }
      return;
    }
    this.cut('cut_x', 220, rnd(-10, 10), { x: cx, y: cy, depth: TOP + 4, grow: 60, hold: 70, fade: 230, glow: 0.7 });
    this.pop('burst', cx + side * 10, cy, 150, { life: 320 });
    this.petals(cx, cy, 12, 110, { depth: q.y + 5 });
    if (r.own) { this.ctx.cam().shake(160, 0.005); this.ctx.punch(0.03, 200); }
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
  /** A double melts back into ink (time is up, or he was struck). */
  kageFade(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'ink_smoke', x, y: y - 44, depth: at.y + 5, w: 112, life: 520, sx: kf([0, 0.6], [1, 1.3, out3]), sy: kf([0, 0.6], [1, 1.3, out3]),
      a: kf([0, 0.85], [1, 0, inQ]), rot: (u) => 50 * u, my: (u) => -16 * u });
    this.petals(x, y - 46, 5, 50, { depth: at.y + 5 });
  }

  /** Mirage Counter: the stance shimmers (a crimson mirage over him) for the counter window. */
  private mirageStance(r: CastRun): void {
    const o = r.origin, T = r.timings, win = r.skill.counter?.window ?? 420;
    this.stances.set(r.castId, { x: o.x, y: o.y, z: o.z, done: false });
    this.glint(r, 0, 22, 56);
    for (let k = 0; k * 140 < T.startup + win; k++)
      this.spr({ name: 'shock_ring', w: 110, delay: k * 140, life: 300, run: r, add: true, follow: () => { const c = this.ctx.casterPos(r.attackerId); return c && !this.stances.get(r.castId)?.done && r.elapsed < T.startup + win ? { x: c.x, y: c.y - c.z, d: c.y } : null; },
        dz: -2, sx: kf([0, 0.4], [1, 1.1, out]), sy: kf([0, 0.4], [1, 1.1, out]), a: kf([0, 0.7], [1, 0, inQ]) });
    this.later(T.startup + win + 400, () => this.stances.delete(r.castId));
  }

  /** Blossom Storm: petals gather through the wind-up, then a storm of them whirls round him as he chases. */
  private blossomStorm(r: CastRun): void {
    const T = r.timings, q = this.me(r);
    this.petals(q.x, q.y - q.z - 56, 12, 130, { inward: true, life: T.startup + 80, depth: q.y + 4 });
    const s = this.ctx.scene, N = 22, life = T.startup + T.active + 260;
    const ps = Array.from({ length: N }, (_, i) => ({ im: s.add.image(0, 0, KIT, i % 6 === 5 ? 'blossom' : `petal_${1 + (i % 4)}`).setVisible(false).setScale(rnd(0.25, 0.4)),
      th: (i / N) * Math.PI * 2, rad: rnd(52, 84), h: rnd(10, 110), sp: rnd(0.008, 0.013) }));
    this.add({ t: 0, step: (_dt, t) => {
      const c = this.ctx.casterPos(r.attackerId), e = t - T.startup;
      if (e >= 0 && c && !this.broken(r)) {
        const fade = Math.min(1, e / 120) * Math.max(0, Math.min(1, (life - t) / 220));
        for (const p of ps) {
          const th = p.th + e * p.sp, sn = Math.sin(th);
          p.im.setVisible(true).setPosition(c.x + Math.cos(th) * p.rad, c.y - c.z - p.h + sn * p.rad * 0.3).setDepth(c.y + (sn > 0 ? 4 : -4)).setAngle(e * 0.5 + p.th * 90).setAlpha(fade);
        }
      }
      if (t >= life || (this.broken(r) && t > T.startup) || this.gone(r)) { for (const p of ps) p.im.destroy(); return false; }
      return true;
    } });
  }
  private stormCut(r: CastRun, i: number): void {
    const side = sideOf(r), q = this.me(r), last = i >= (r.skill.hits.length - 1);
    if (!last) { this.cut('cut_thin', rnd(130, 170), rnd(-50, 50), { x: q.x + side * rnd(30, 60), y: q.y - q.z - rnd(40, 80), depth: q.y + 5, flipX: Math.random() < 0.5, flipY: Math.random() < 0.5 }); return; }
    const x = q.x + side * 40, y = q.y;
    this.spr({ name: 'petal_column', x, y: y + 6, oy: 0.96, depth: y + 3, w: 120, life: 620, glow: 0.5, sy: kf([0, 0.15], [0.3, 1, out3], [1, 1.1]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
    this.cut('cut_rise', 150, 0, { x, y: y - q.z - 110, depth: TOP + 4, flipX: side < 0, grow: 70, hold: 60, fade: 220, glow: 0.7 });
    this.pop('burst_crit', x, y - q.z - 90, 170, { life: 320 });
    this.petals(x, y - q.z - 90, 16, 130, { depth: y + 5 });
    if (r.own) { this.ctx.cam().shake(180, 0.006); this.ctx.punch(0.035, 240); }
  }

  /** Dragon Eclipse: the dark and the cut-in, a black sun rising over the target, eight cuts converging on it out of nowhere. */
  private eclipseAt?: { x: number; y: number };
  private eclipse(r: CastRun): void {
    this.ctx.ultimateStage(r);
    const T = r.timings, a = r.aim, o = r.origin, reach = (r.skill.dash?.distance ?? 120) + 95, fin = T.startup + (r.hits[r.hits.length - 1]?.at ?? 120);
    const tx = o.x + a.x * reach, ty = o.y + a.y * reach, sx = tx, sy = ty - o.z - 230;
    this.eclipseAt = { x: tx, y: ty };
    this.spr({ name: 'sun_black', x: sx, y: sy, depth: TOP + 1, w: 230, delay: T.startup * 0.25, life: fin - T.startup * 0.25 + 140, run: r,
      sx: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), sy: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), rot: (u) => 24 * u, a: kf([0, 0], [0.12, 1], [0.93, 1], [1, 0]) });
    this.spr({ name: 'sun_rays', x: sx, y: sy, depth: TOP + 0.9, w: 330, add: true, tint: 0xff4050, delay: T.startup * 0.5, life: fin - T.startup * 0.5 + 140, run: r, rot: (u) => -30 * u, a: kf([0, 0], [0.3, 0.6], [1, 0]) });
    for (let k = 0; k < 3; k++) // a glint of the blade in the dark, here and there round the foe
      this.pop('glint', tx + rnd(-90, 90), ty - o.z - rnd(30, 100), 120, { delay: T.startup - 420 + k * 130, life: 220, angle: 0, depth: TOP + 5, run: r });
  }
  /** One of the eight cuts out of the dark: a phantom of him crosses the foe from its own direction, the cut line behind it. */
  private eclipseSlash(r: CastRun, i: number): void {
    const o = r.origin, a = r.aim, at = this.eclipseAt ?? { x: o.x + a.x * 215, y: o.y + a.y * 215 };
    const th = (([0, 180, 45, 225, 90, 270, 135, 315][i % 8] + rnd(-10, 10)) * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th) * 0.5, L = 120, y = at.y - o.z - 50;
    this.cut('cut_line', 290, (Math.atan2(sn, c) * 180) / Math.PI, { x: at.x, y, depth: TOP + 5, grow: 35, hold: 25, fade: 130, glow: 0.8, sweep: 0 });
    this.phantomDash(r, at.x - c * L, at.y - o.z - sn * L, at.x + c * L, at.y - o.z + sn * L, TOP + 4.5);
    this.pop('spark_s', at.x + rnd(-14, 14), y + rnd(-14, 14), 70, { life: 160 });
    this.ctx.darken(300, 0.55); // the dark holds through the cuts (their hit-stops stretch them past its timer)
    if (r.own) this.ctx.cam().shake(60, 0.002);
  }
  private eclipseCut(r: CastRun, o: V3): void {
    const a = r.aim, at = this.eclipseAt ?? { x: o.x + a.x * 200, y: o.y + a.y * 200 }, cam = this.ctx.cam(), ang = screenAng(a.x, a.y);
    const sx = at.x, sy = at.y - o.z - 230, y = at.y - o.z - 50;
    this.pop('sun_flare', sx, sy, 300, { life: 520, depth: TOP + 1.2, angle: 0, glow: 0.5 });
    this.spr({ name: 'sun_break', x: sx, y: sy, depth: TOP + 1.1, w: 240, delay: 260, life: 900, my: (u) => 60 * u, rot: (u) => 20 * u, sx: kf([0, 1], [1, 1.25]), sy: kf([0, 1], [1, 1.25]), a: kf([0, 1], [1, 0, inQ]) });
    this.cut('cut_line', 640, ang, { x: at.x - a.x * 40, y, depth: TOP + 5, h: 80, grow: 50, hold: 120, fade: 320, glow: 0.9, sweep: 0, flipY: a.x < -0.01 });
    this.later(110, () => this.cut('cut_split', 520, ang, { x: at.x, y, depth: TOP + 5.5, grow: 50, hold: 120, fade: 300, glow: 0.8, sweep: 0 }));
    this.pop('burst_crit', at.x, y, 240, { life: 380, depth: TOP + 6 });
    // the dragon flies along the cut, through the foe and away
    const dr = this.dragon(46), dx = Math.cos(ang * Math.PI / 180), dy = Math.sin(ang * Math.PI / 180), x0 = at.x - dx * 420, y0 = y - dy * 420, L = 1100, gap = 34, n = 16;
    this.add({ t: 0, step: (_dt, t) => {
      const head = Math.min(1, t / 360) * L, fade = t > 380 ? Math.max(0, 1 - (t - 380) / 200) : 1;
      dr.place(Array.from({ length: n }, (_, i) => { const dd = head - i * gap; return { x: x0 + dx * dd, y: y0 + dy * dd + Math.sin(dd / 70) * 10, d: TOP + 4 }; }), fade * Math.min(1, t / 60));
      if (t >= 600) { dr.destroy(); return false; }
      return true;
    } });
    for (let i = 0; i < 24; i++) this.later(200 + i * 40, () => this.petals(at.x + rnd(-260, 260), y - rnd(80, 220), 1, 30, { life: 1600, depth: TOP + 3 }));
    cam.flash(130, 255, 236, 228, false); // the corona bursts white
    this.ctx.darken(380, 0.55); // and the dark lifts only after the dragon has passed
    if (r.own) { cam.shake(320, 0.012); this.ctx.punch(0.06, 320); }
    this.eclipseAt = undefined;
  }

  /** Tornado Blade: a crimson whirlwind rolling along tornadoPath (the path its hits take), petals sucked into it. */
  private tornado(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, path = tornadoPath(r.origin, r.aim), t0 = T.startup + TORNADO.startMs, life = TORNADO.everyMs * (TORNADO.count - 1) + 260;
    const body = s.add.image(0, 0, KIT, 'tornado').setOrigin(0.5, 0.95).setVisible(false);
    const glow = s.add.image(0, 0, KIT, 'tornado').setOrigin(0.5, 0.95).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const ring = s.add.image(0, 0, KIT, 'wind_ring').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    const H = 300, k = H / body.height, end = t0 + life;
    let nextPetal = 0;
    this.add({ t: 0, step: (_dt, t) => {
      if (t < T.startup - 40) return true;
      if ((this.broken(r) && t < T.startup + 20) || this.gone(r)) { body.destroy(); glow.destroy(); ring.destroy(); return false; }
      const u = Math.max(0, t - t0) / TORNADO.everyMs, i = Math.min(path.length - 2, Math.floor(u)), f = Math.min(1, u - i);
      const x = path[i].x + (path[i + 1].x - path[i].x) * f, y = path[i].y + (path[i + 1].y - path[i].y) * f;
      const fade = Math.min(1, (t - T.startup) / 160) * (t > end - 260 ? Math.max(0, (end - t) / 260) : 1), fl = Math.floor(t / 70) % 2 === 1, w = 1 + 0.05 * Math.sin(t / 50);
      body.setVisible(true).setPosition(x + Math.sin(t / 40) * 3, y + 6).setScale(k * 1.15 * w, k).setFlipX(fl).setDepth(y + 1).setAlpha(fade);
      glow.setVisible(true).setPosition(body.x, body.y).setScale(body.scaleX * 1.04, body.scaleY * 1.02).setFlipX(fl).setDepth(y + 1.01).setAlpha(fade * 0.45);
      ring.setVisible(true).setPosition(x, y - 10).setScale(0.55 * w, 0.4).setFlipX(!fl).setDepth(y + 2).setAlpha(fade * 0.8);
      if (t >= nextPetal && fade > 0.3) { // petals sucked in and up
        nextPetal = t + 55;
        const th = Math.random() * Math.PI * 2, d = rnd(80, 120);
        this.spr({ name: `petal_${1 + Math.floor(Math.random() * 4)}`, x: x + Math.cos(th) * d, y: y - 20 + Math.sin(th) * d * 0.35, depth: y + (Math.sin(th) > 0 ? 3 : -1), w: rnd(13, 19), life: 420,
          mx: (uu) => -Math.cos(th) * d * out(uu), my: (uu) => -Math.sin(th) * d * 0.35 * out(uu) - 160 * uu * uu, rot: (uu) => 600 * uu, a: kf([0, 0], [0.15, 1], [0.8, 1], [1, 0]) });
      }
      if (t >= end) { body.destroy(); glow.destroy(); ring.destroy(); return false; }
      return true;
    } });
  }

  /** Falcon Dive: the samurai wrapped in a falcon of fire through the leap and the dive. */
  private falcon(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r), fl = side < 0;
    const q0 = this.me(r);
    this.later(T.startup, () => { this.dust(q0.x, q0.y, 110); this.dustRing(q0.x, q0.y, 150); }, r);
    const bird = s.add.image(0, 0, KIT, 'falcon_dive').setVisible(false).setFlipX(fl);
    const glow = s.add.image(0, 0, KIT, 'falcon_dive').setVisible(false).setFlipX(fl).setBlendMode(Phaser.BlendModes.ADD);
    const k = 190 / bird.width, hitAt = r.skill.hits[1]?.at ?? 300;
    let lastGhost = 0;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - T.startup, c = this.ctx.casterPos(r.attackerId);
      if (e < 0) return true;
      if (this.broken(r) || !c || e > hitAt + 30) { bird.destroy(); glow.destroy(); return false; }
      const p = e / Math.max(1, hitAt), up = p < 0.42, ang = up ? side * -78 : side * 8, al = up ? Math.min(1, p / 0.25) * 0.75 : 1;
      const x = c.x - side * 6, y = c.y - c.z - 56;
      bird.setVisible(true).setPosition(x, y).setScale(k).setAngle(ang).setDepth(c.y + 3).setAlpha(al);
      glow.setVisible(true).setPosition(x, y).setScale(k * 1.04).setAngle(ang).setDepth(c.y + 3.01).setAlpha(al * 0.4);
      if (!up && e - lastGhost > 36) { // afterimages of the bird on the dive
        lastGhost = e;
        this.spr({ name: 'falcon_dive', x, y, depth: c.y + 2, w: 190, angle: ang, flipX: fl, life: 200, add: true, a: kf([0, 0.45], [1, 0, inQ]) });
      }
      return true;
    } });
  }
  private falconImpact(r: CastRun): void {
    const q = this.me(r), side = sideOf(r), cam = this.ctx.cam();
    this.spr({ name: 'falcon_spread', x: q.x, y: q.y + 6, oy: 0.92, depth: q.y + 3, w: 270, life: 560, glow: 0.45,
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
  private sunBurst(r: CastRun): void {
    const q = this.me(r), side = sideOf(r);
    this.pop('sun_rays', q.x - side * 70, q.y - q.z - 150, 340, { life: 520, add: true, glow: 0.4, angle: 0 });
    this.shock(q.x, q.y, 320, { tint: 0xffd27a }); this.shock(q.x, q.y, 420, { tint: 0xffd27a, delay: 90 });
    this.petals(q.x, q.y - 80, 14, 140, { depth: q.y + 4 });
    if (r.own) this.ctx.cam().shake(160, 0.004);
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

  /** A phantom of the samurai — his own body as it is this moment, in ink with a crimson edge — dashing from (x0, y0) to
   *  (x1, y1) (feet), afterimages in its wake. */
  private phantomDash(r: CastRun, x0: number, y0: number, x1: number, y1: number, depth: number): void {
    const b = this.ctx.body?.(r.attackerId); if (!b) return;
    const s = this.ctx.scene, ADD = Phaser.BlendModes.ADD, flip = (x1 < x0) !== (sideOf(r) < 0) ? !b.flipX : b.flipX;
    const mk = (fill: number, k: number) => s.add.image(x0, y0, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx * k, b.sy * k).setFlipX(flip).setTintFill(fill).setVisible(false);
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

  /** Sakura Bind: the sigil opens on the floor where it was aimed, petals drawn into it through the wind-up. */
  private bind(r: CastRun): void {
    const T = r.timings, h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin, hold = h0.reaction.hardCC?.ms ?? 2000;
    const life = T.startup + hold + 260;
    this.floor('sigil_sakura', c.x, c.y, R * 2.5, life, { spin: 150, run: r, glow: 0.35, depth: GROUND + 2,
      a: kf([0, 0], [Math.max(0.02, T.startup / life), 1], [(life - 320) / life, 1], [1, 0]), s: kf([0, 0.6], [Math.max(0.02, T.startup / life), 1, out3]) });
    this.petals(c.x, c.y - 30, 10, R, { inward: true, life: T.startup + 120, depth: c.y + 3 });
  }
  /** The bind itself: a vortex pulls everyone in and blossoms burst open round the rim (each bound foe gets its cage, `cage`). */
  private bloom(r: CastRun): void {
    const h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin;
    this.floor('vortex', c.x, c.y, R * 2.2, 380, { add: true, spin: -320, depth: GROUND + 2.6, a: kf([0, 1], [0.6, 1], [1, 0, inQ]), s: kf([0, 1.1], [1, 0.25, inQ]) });
    this.pop('glint', c.x, c.y - 50, 160, { life: 260, angle: 0 });
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * Math.PI * 2 + rnd(-0.12, 0.12), bx = c.x + Math.cos(th) * R * 1.02, by = c.y + Math.sin(th) * R * 1.02 * SQUASH;
      this.spr({ name: 'blossom_cluster', x: bx, y: by, oy: 0.88, depth: by + 1, w: rnd(30, 38), life: 900, delay: 40 + i * 16, angle: rnd(-18, 18), flipX: Math.random() < 0.5,
        sx: kf([0, 0], [0.22, 1, back], [0.75, 1], [1, 0.6]), sy: kf([0, 0], [0.22, 1, back], [0.75, 1], [1, 0.6]), a: kf([0, 1], [0.75, 1], [1, 0, inQ]) });
    }
    this.ctx.punch(0.02, 160);
  }
  /** A bound foe: cherry branches grow up round it and curl in over it (the near ones low, so the foe stays in sight), hold
   *  through the bind, then wither into falling petals. */
  private cage(x: number, y: number, hold: number): void {
    const life = hold + 120, grow = 240 / life, wither = (hold - 180) / life;
    ([[-34, -6, 64, false], [34, -6, 60, false], [-28, 7, 48, true], [30, 7, 46, true]] as const).forEach(([dx, dy, w, near], i) => {
      const ph = rnd(0, 6), lean = (dx > 0 ? -10 : 10) + rnd(-3, 3), al = near ? 0.9 : 1;
      this.spr({ name: i % 2 ? 'branch_2' : 'branch_1', x: x + dx, y: y + dy + 4, oy: 0.97, depth: y + (near ? 3 : -3), w: w + rnd(-3, 3), life, delay: i * 30, flipX: dx < 0,
        sy: kf([0, 0], [grow, 1, back], [wither, 1], [1, 0, inQ]), sx: kf([0, 0.5], [grow, 1, out], [wither, 1], [1, 0.7]), rot: (u) => lean + 3 * Math.sin((u * life) / 220 + ph), a: kf([0, al], [wither, al], [1, 0]) });
    });
    this.later(hold - 160, () => this.petals(x, y - 50, 8, 50, { depth: y + 4 }));
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
    const T = r.timings, q = this.me(r), cx = q.x, cy = q.y, side = sideOf(r), cam = this.ctx.cam();
    this.launchBeam(cx, cy, 260);
    this.shock(cx, cy, 300); this.dustRing(cx, cy, 260); this.dust(cx - 60, cy, 110); this.dust(cx + 60, cy, 110, 40);
    const RAD = 76, HIGH = 420, rise = T.active + 160, turns = 2.1, ph0 = side > 0 ? Math.PI : 0, gap = 26, n = 15;
    const pos = (u: number): Pt => {
      const th = ph0 + side * u * turns * Math.PI * 2, h = u <= 1 ? HIGH * (1 - Math.pow(1 - u, 1.7)) : HIGH + (u - 1) * 900, rad = RAD * (1 - 0.3 * Math.min(1, u));
      return { x: cx + Math.cos(th) * rad, y: cy - 34 - h + Math.sin(th) * rad * 0.34, d: cy + (Math.sin(th) > 0 ? 5 : -5) };
    };
    const dr = this.dragon(40), trail: Pt[] = [];
    this.add({ t: 0, step: (_dt, t) => {
      const u = t / rise;
      trail.unshift(pos(u));
      // even spacing along the trail (head first)
      const pts: Pt[] = [trail[0]];
      let acc = 0;
      for (let i = 1; i < trail.length && pts.length < n; i++) {
        acc += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
        if (acc >= gap) { pts.push(trail[i]); acc = 0; }
      }
      while (trail.length > 400) trail.pop();
      const fade = u > 1.15 ? Math.max(0, 1 - (u - 1.15) / 0.25) : Math.min(1, t / 80);
      dr.place(pts, fade);
      if (t % 64 < 17) { const p = trail[0]; this.petals(p.x, p.y, 1, 24, { depth: p.d + 1, life: 700 }); }
      if (u >= 1.4 || this.gone(r)) { dr.destroy(); return false; }
      return true;
    } });
    if (r.own) { cam.shake(220, 0.007); this.ctx.punch(0.035, 240); }
  }

  // ------------------------------------------------------------------ God of Blades: the halo

  /** Eight ghost katanas rise one by one into a fan behind him, a golden halo at their heart; they stay for the buff. */
  private halo(r: CastRun): void {
    const L = r.skill.linger, s = this.ctx.scene; if (!L) return;
    this.clearHalo(r.attackerId, true);
    const c = this.me(r), side = sideOf(r), until = r.timings.startup + L.startMs + L.everyMs * L.count;
    const halo = s.add.image(c.x, c.y - c.z - 74, KIT, 'halo_gold').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    halo.setScale(150 / halo.width);
    const imgs = Array.from({ length: 8 }, () => s.add.image(c.x, c.y - c.z - 70, KIT, 'katana_ghost').setOrigin(0.5, 0.9).setAlpha(0));
    for (const im of imgs) im.setScale(118 / im.height);
    this.halos.set(r.attackerId, { imgs, halo, t: 0, until, lastX: c.x, face: side, next: 0, away: new Set() });
  }

  clearHalo(attackerId: string, now = false): void {
    const h = this.halos.get(attackerId); if (!h) return;
    this.halos.delete(attackerId);
    const all = [...h.imgs, h.halo];
    if (now) { for (const o of all) o.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: all, alpha: 0, duration: 300, onComplete: () => { for (const o of all) o.destroy(); } });
  }

  private haloSlot(h: Halo, k: number, c: V3): { x: number; y: number; ang: number } {
    const th = Phaser.Math.DegToRad(-160 + (k / 7) * 140 + 3 * Math.sin(h.t / 600 + k)), px = c.x - h.face * 12, py = c.y - c.z - 70;
    const dx = Math.cos(th) * 52 * -h.face, dy = Math.sin(th) * 46;
    return { x: px + dx, y: py + dy, ang: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90 };
  }

  private stepHalos(dt: number): void {
    for (const [id, h] of this.halos) {
      const c = this.ctx.casterPos(id);
      h.t += dt;
      if (!c || h.t >= h.until) { this.clearHalo(id); continue; }
      if (Math.abs(c.x - h.lastX) > 0.5) h.face = c.x > h.lastX ? 1 : -1;
      h.lastX = c.x;
      const rise = Math.min(1, h.t / 600), breathe = 1 + 0.04 * Math.sin(h.t / 300);
      h.halo.setPosition(c.x - h.face * 12, c.y - c.z - 72).setDepth(c.y - 2).setAlpha(0.75 * rise).setAngle(h.t * 0.02).setScale((150 / h.halo.width) * breathe);
      h.imgs.forEach((im, k) => {
        if (h.away.has(k)) return;
        const p = this.haloSlot(h, k, c), on = Math.min(1, Math.max(0, (h.t - k * 70) / 160));
        im.setPosition(p.x, p.y).setAngle(p.ang).setDepth(c.y - 1.5).setAlpha(0.9 * on);
      });
    }
  }

  /** God of Blades strike: a katana of the halo flies at the foe and back (the hit lands as it arrives). */
  bladeStrike(attackerId: string, to: V3): void {
    const h = this.halos.get(attackerId), c = this.ctx.casterPos(attackerId); if (!h || !c || !this.ready) return;
    const k = h.next % 8; h.next++;
    const im = h.imgs[k]; if (!im || h.away.has(k)) return;
    h.away.add(k);
    const tx = to.x, ty = to.y - to.z - 40, sx = im.x, sy = im.y, ang = Phaser.Math.RadToDeg(Math.atan2(ty - sy, tx - sx)) + 90;
    im.setAngle(ang).setDepth(TOP + 2);
    this.add({ t: 0, step: (_dt, t) => {
      const u = Math.min(1, t / 140), e = inQ(u);
      im.setPosition(sx + (tx - sx) * e, sy + (ty - sy) * e);
      if (u < 1) return true;
      this.pop('spark_s', tx, ty, 90);
      this.cut('cut_thin', 110, rnd(-30, 30), { x: tx, y: ty, depth: TOP + 3, flipX: tx < c.x, grow: 35, hold: 25, fade: 110 });
      im.setAlpha(0);
      this.later(280, () => h.away.delete(k));
      return false;
    } });
  }

  // ------------------------------------------------------------------ Sword Wave: the flying crescent

  projectile(p: Projectile): void {
    if (!this.ready) return;
    const s = this.ctx.scene;
    const im = s.add.image(p.x, p.y - p.z, KIT, 'cut_heavy').setDepth(p.y + 2);
    const gl = s.add.image(p.x, p.y - p.z, KIT, 'cut_heavy').setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 2.01).setAlpha(0.55);
    const me = this.ctx.casterPos(p.attackerId), ghosts = me ? (this.ctx.ghosts?.(p.attackerId) ?? []).map((g) => ({ im: s.add.image(p.x, p.y - p.z, KIT, 'cut_heavy'), dx: g.x - me.x, dy: g.y - me.y })) : [];
    this.waves.set(p, { im, gl, t: 0, trail: 0, ghosts }); // (the doubles throw theirs too: the same crescent beside his)
  }
  projectileEnd(p: Projectile): void {
    const w = this.waves.get(p); if (!w) return;
    this.waves.delete(p);
    const end = p.end ?? { x: p.x, y: p.y };
    this.pop('spark_s', end.x, end.y - p.z, 70, { life: 180 });
    w.im.destroy(); w.gl.destroy();
    for (const g of w.ghosts) { this.pop('spark_s', end.x + g.dx, end.y + g.dy - p.z, 60, { life: 160 }); g.im.destroy(); }
  }
  private stepWaves(dt: number): void {
    for (const [p, w] of this.waves) {
      w.t += dt;
      const ang = screenAng(p.dx, p.dy) + 4 * Math.sin(w.t / 45), k = 96 / w.im.width, fl = p.dx < -0.01, x = p.x, y = p.y - p.z;
      for (const im of [w.im, w.gl]) im.setPosition(x, y).setAngle(ang).setScale(k, k * (1 + 0.06 * Math.sin(w.t / 35))).setFlipY(fl).setDepth(p.y + (im === w.gl ? 2.01 : 2));
      for (const g of w.ghosts) g.im.setPosition(x + g.dx, y + g.dy).setAngle(ang).setScale(k, k * (1 + 0.06 * Math.sin(w.t / 35))).setFlipY(fl).setDepth(p.y + g.dy + 2);
      if (w.t - w.trail > 32) { // afterimages and a petal trail
        w.trail = w.t;
        this.spr({ name: 'cut_heavy', x, y, depth: p.y + 1, w: 96, angle: ang, flipY: fl, add: true, life: 170, a: kf([0, 0.4], [1, 0, inQ]) });
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
    this.stepWaves(dt);
  }

  destroy(): void {
    for (const id of [...this.halos.keys()]) this.clearHalo(id, true);
    for (const [p] of this.waves) this.projectileEnd(p);
    this.live = []; this.incoming = [];
  }
}
