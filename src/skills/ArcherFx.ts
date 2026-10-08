// Archer skill effects, built from separate painted pieces (tools/skills/kit.py archer → one atlas, ARCHER_KIT) moved in
// code, like the samurai's and the book mage's: arrows fly with their own light and grow out of the bow's flash, leaves and
// wind swirl, roots creep over the floor, lightning strikes from above, spirit beasts sweep across. Sized to the samurai's
// standard (a hit ~86px, heavy ~140, an effect about the body's size). Presentation only — gameplay never reads any of it;
// timing comes from the cast, so every client draws the same, and the effect clock stops with the hit-stop.
// The game is a 3/4 brawler with floor depth: pieces lying on the floor were painted already flattened (no extra squash).
import Phaser from 'phaser';
import type { CastRun, Trap } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V3 } from './HitGeometry';
import { clearLine } from '../world/WorldGeometry';

export const ARCHER_KIT = 'archer-kit';
export const ARCHER_KIT_URL = 'assets/final/skills/archer/kit/';
const TOP = 100000, GROUND = 2;

export interface ArcherCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  punch(amount?: number, ms?: number): void;
  ultimateStage(r: CastRun): void;
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
/** Side-view art (painted facing right) aimed along a floor direction: level on screen, mirrored to the left, never upside down. */
const level = (dx: number, dy: number): { ang: number; flip: boolean } => dx < -0.01 ? { flip: true, ang: Math.atan2(-dy * 0.5, -dx) * (180 / Math.PI) } : { flip: false, ang: Math.atan2(dy * 0.5, dx) * (180 / Math.PI) };
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
  alive?: () => boolean;
}
interface Live { t: number; step(dt: number, t: number): boolean }
interface Arrow { im: Phaser.GameObjects.Image; tr: Phaser.GameObjects.Image | null; t: number; kind: string; z0: number }

export class ArcherFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private arrows = new Map<Projectile, Arrow>();
  private trapArt = new Map<Trap, { stop(): void; arm(): void }>();
  private markArt = new Map<string, { n: number; until: number; im: Phaser.GameObjects.Image | null }>();
  private hawks = new Map<string, { until: number; t: number; px: number; py: number; vx: number; vy: number; wx: number; wy: number; next: number; face: number; dive: { x: number; y: number; d: number; t: number } | null; im: Phaser.GameObjects.Image }>();
  /** Trees of Life standing now (for the see-through when someone walks behind one). */
  readonly trees = new Set<Phaser.GameObjects.Image>();

  constructor(private ctx: ArcherCtx) {}

  get ready(): boolean { return this.ctx.scene.textures.exists(ARCHER_KIT); }

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
  private shake(r: CastRun | null, ms: number, k: number): void { if (!r || r.own) this.ctx.cam().shake(ms, k); }

  private spr(o: Spr): Phaser.GameObjects.Image | null {
    const s = this.ctx.scene;
    if (!s.textures.exists(ARCHER_KIT)) return null;
    const fr = s.textures.getFrame(ARCHER_KIT, o.name); if (!fr) return null;
    const fw = fr.cutWidth || fr.width, fh = fr.cutHeight || fr.height;
    const bx = o.w / fw, by = (o.h ?? (o.w * fh) / fw) / fh;
    const mk = (glow: boolean) => {
      const im = s.add.image(o.x ?? 0, o.y ?? 0, ARCHER_KIT, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlip(!!o.flipX, !!o.flipY).setVisible(false)
        .setBlendMode(glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL); // the pieces keep their own colour (normal); only a soft glow layer is added (the sunny floor never washes them out)
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const glowA = o.glow !== undefined ? Math.min(o.glow, 0.3) : o.add ? 0.22 : 0;
    const im = mk(false), gl = glowA ? mk(true) : null;
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
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.04, sy * 1.04).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
    return im;
  }

  /** A piece lying on the floor (painted already flattened): grows, fades, can follow a caster's feet; stop() fades it out. */
  private floor(name: string, x: number, y: number, w: number, life: number, o: { a?: (u: number) => number; s?: (u: number) => number; sx?: (u: number) => number; angle?: number; rot?: () => number; flip?: boolean; ox?: number;
    depth?: number; delay?: number; add?: boolean; glow?: number; run?: CastRun; tint?: number; follow?: () => { x: number; y: number } | null; alive?: () => boolean } = {}): { stop(): void } {
    let dead = false, fadeAt = -1, el = 0;
    const gone = () => dead || (!!o.alive && !o.alive());
    this.spr({ name, x, y, w, life, ox: o.ox, depth: o.depth ?? GROUND + 2, delay: o.delay, add: o.add, glow: o.glow, run: o.run, tint: o.tint, angle: o.angle, flipX: o.flip,
      follow: o.follow ? () => { const p = o.follow!(); return p ? { x: p.x, y: p.y, d: o.depth ?? GROUND + 2 } : null; } : undefined, dz: 0,
      rot: o.rot ? () => o.rot!() : undefined,
      sx: (u) => (o.s?.(u) ?? 1) * (o.sx?.(u) ?? 1), sy: (u) => o.s?.(u) ?? 1,
      a: (u) => { el = u * life; let al = o.a?.(u) ?? 1; if (gone() && fadeAt < 0) fadeAt = el; if (fadeAt >= 0) al *= Math.max(0, 1 - (el - fadeAt) / 220); return al; },
      alive: () => !(fadeAt >= 0 && el - fadeAt >= 220) });
    return { stop: () => { dead = true; } };
  }

  /** A burst / spark: pops out, spreads a little, fades. */
  private pop(name: string, x: number, y: number, size: number, o: { depth?: number; life?: number; glow?: number; angle?: number; delay?: number; add?: boolean; run?: CastRun; tint?: number; flip?: boolean } = {}): void {
    this.spr({ name, x, y, depth: o.depth ?? TOP + 4, w: size, life: o.life ?? 240, delay: o.delay, add: o.add ?? true, run: o.run, tint: o.tint, angle: o.angle ?? rnd(-15, 15), glow: o.glow ?? 0.45, flipX: o.flip,
      sx: kf([0, 0.4], [0.2, 1.05, out3], [1, 1.18]), sy: kf([0, 0.4], [0.2, 1.05, out3], [1, 1.18]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
  }
  /** Leaves drifting from a point. */
  private leaves(x: number, y: number, n: number, spread: number, o: { depth?: number; life?: number; up?: number; delay?: number; dir?: number } = {}): void {
    const names = ['leaf_1', 'leaf_2', 'leaf_3'];
    for (let i = 0; i < n; i++) {
      const dx = rnd(-spread, spread), up = (o.up ?? 50) * rnd(0.6, 1.3), life = (o.life ?? 700) * rnd(0.7, 1.3), spin = rnd(-300, 300), drift = (o.dir ?? 0) * rnd(30, 80);
      this.spr({ name: names[i % 3], x: x + dx * 0.3, y, depth: o.depth ?? TOP + 2, w: rnd(12, 20), life, delay: (o.delay ?? 0) + rnd(0, 100), angle: rnd(0, 360),
        mx: (u) => dx * out(u) + drift * u + Math.sin(u * 7 + i) * 6, my: (u) => -up * out(u) + 30 * u * u, rot: (u) => spin * u, a: kf([0, 0], [0.1, 1], [0.7, 0.9], [1, 0]) });
    }
  }
  /** Lightning stretched from a to b (screen points). */
  private bolt(name: string, a: { x: number; y: number }, b: { x: number; y: number }, o: { life?: number; thick?: number; delay?: number; depth?: number } = {}): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 4) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
    this.spr({ name, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, depth: o.depth ?? TOP + 3, w: len * 1.05, h: o.thick ?? 40, angle: ang, add: true, glow: 0.5, life: o.life ?? 200, delay: o.delay,
      sy: (u) => (0.8 + 0.4 * Math.abs(Math.sin(u * 23))) * (1 - 0.6 * u), a: kf([0, 1], [0.5, 0.9], [1, 0, inQ]) });
  }
  /** The bow's flash at the hand (the arrows come out of it). */
  private muzzle(r: CastRun, size: number, delay = 0): void {
    const side = sideOf(r), lv = level(r.aim.x, r.aim.y);
    this.spr({ name: 'muzzle', w: size, life: 200, delay, follow: this.at(r.attackerId, side, 26, 58), dz: 4, ox: lv.flip ? 0.85 : 0.15, flipX: lv.flip, angle: lv.ang, add: true, glow: 0.4, run: r,
      sx: kf([0, 0.4], [0.25, 1.1, out3], [1, 1.2]), sy: kf([0, 0.6], [0.25, 1, out3], [1, 0.6]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
  }
  /** Light gathering at the bow during a wind-up. */
  private charge(r: CastRun, name: string, size: number, ms: number, o: { tint?: number; spin?: number; dx?: number } = {}): void {
    const side = sideOf(r);
    this.spr({ name, w: size, life: ms, follow: this.at(r.attackerId, side, o.dx ?? 30, 58), dz: 5, add: true, glow: 0.5, tint: o.tint, run: r,
      sx: kf([0, 0.15], [0.85, 1, out], [1, 1.25]), sy: kf([0, 0.15], [0.85, 1, out], [1, 1.25]), a: kf([0, 0], [0.15, 0.9], [0.9, 1], [1, 0]), rot: (u) => (o.spin ?? 200) * u });
  }

  // ------------------------------------------------------------------ cast timeline

  cast(r: CastRun): void {
    if (!this.ready) return;
    const s = r.skill, T = r.timings, me = this.me(r), side = sideOf(r), a = r.aim;
    switch (s.id) {
      case 'quick_shot': this.muzzle(r, 70, T.startup); break;
      case 'bow_haste': { // Wind Step: a gust blows her back off the floor — a wind ring where she stood, a crescent of wind, leaves
        this.floor('wind_ring', me.x, me.y, 120, 520, { add: true, glow: 0.4, run: r, s: kf([0, 0.5], [0.4, 1.15, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
        this.spr({ name: 'wind_crescent', x: me.x - side * 10, y: me.y - me.z - 40, depth: me.y + 2, w: 110, flipX: side > 0, life: 320, add: true, glow: 0.4, run: r, mx: (u) => -side * 60 * out(u), a: kf([0, 1], [1, 0, inQ]) });
        this.leaves(me.x, me.y - 20, 6, 30, { dir: -side });
        this.muzzle(r, 80, T.startup + r.hits[0].at);
        break;
      }
      case 'multi_shot': this.charge(r, 'leaf_whirl', 50, T.startup, { spin: 420 }); this.muzzle(r, 100, T.startup); break;
      case 'explosive_arrow': this.charge(r, 'burst_crit', 54, T.startup, { tint: 0xffb070, spin: 260 }); this.muzzle(r, 100, T.startup); break;
      case 'rising_arrow': { // the earth cracks under the foe, then a slim arrow of light bursts up and throws it
        const sh = s.hits[0].shape as { bias?: number }, bx = r.origin.x + a.x * (sh.bias ?? 95), by = r.origin.y + a.y * (sh.bias ?? 95);
        this.floor('floor_cracks', bx, by, 120, T.startup + T.active + 500, { run: r, s: kf([0, 0.2], [0.3, 1, out3]), a: kf([0, 0], [0.15, 0.9], [0.7, 0.8], [1, 0]) });
        this.later(T.startup, () => {
          this.spr({ name: 'pillar', x: bx, y: by + 4, oy: 0.97, depth: by + 3, w: 70, life: 420, add: true, glow: 0.4, sy: kf([0, 0.1], [0.25, 1.1, out3], [1, 1]), sx: kf([0, 1], [1, 0.4]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
          this.pop('leaf_spray', bx, by - 30, 90, { angle: -90, life: 320 });
          this.floor('shock_ring', bx, by, 130, 360, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 1], [1, 0, inQ]) });
          this.shake(r, 90, 0.002);
        }, r);
        break;
      }
      case 'retreat_kick': { // a boot of wind bursts out of the ground and whirls round in a full circle
        const kx = r.origin.x + a.x * 62, ky = r.origin.y + a.y * 30;
        this.later(Math.max(0, T.startup - 40), () => {
          this.spr({ name: 'wind_boot', x: kx, y: ky - 70, depth: ky + 3, w: 110, flipX: side < 0, life: T.active + 260, add: true, glow: 0.4,
            rot: (u) => -side * 360 * out3(u), sx: kf([0, 0.5], [0.15, 1, out3]), sy: kf([0, 0.5], [0.15, 1, out3]), a: kf([0, 0], [0.08, 1], [0.75, 1], [1, 0]) });
          this.spr({ name: 'wind_crescent', x: kx, y: ky - 70, depth: ky + 2, w: 150, flipX: side < 0, life: T.active + 200, add: true, glow: 0.3, rot: (u) => -side * 300 * out(u), a: kf([0, 0], [0.1, 0.8], [1, 0]) });
          this.spr({ name: 'dust', x: kx, y: ky + 2, oy: 0.85, depth: ky + 1, w: 120, life: 500, sx: kf([0, 0.5], [1, 1.3, out3]), a: kf([0, 0.8], [1, 0, inQ]) });
          this.leaves(kx, ky - 30, 8, 40);
          this.shake(r, 100, 0.0025);
        }, r);
        break;
      }
      case 'skyhunters_step': this.floor('wind_ring', me.x, me.y, 140, 520, { add: true, glow: 0.4, run: r, s: kf([0, 0.4], [0.4, 1.2, out3]), a: kf([0, 0.9], [1, 0, inQ]) }); this.leaves(me.x, me.y - 10, 8, 40); break;
      case 'vine_trap': break; // the mine itself (trap)
      case 'rain_of_arrows': this.thunderCharge(r); break;
      case 'piercing_arrow': this.spiritBow(r); break;
      case 'hunters_roar': { // the spirit wolf rises behind her and howls; the wave of wind and lightning goes all round
        this.spr({ name: 'wolf', w: 170, oy: 0.95, follow: this.at(r.attackerId, -side, 20, -10), dz: -3, flipX: side < 0, life: T.startup + T.active + 500, add: true, glow: 0.35, run: r,
          sy: kf([0, 0.3], [0.3, 1, out3]), a: kf([0, 0], [0.2, 0.9], [0.75, 0.9], [1, 0]) });
        this.later(T.startup, () => {
          const q = this.me(r);
          this.floor('wind_ring', q.x, q.y, 200, 520, { add: true, glow: 0.5, s: kf([0, 0.3], [1, 2.6, out3]), a: kf([0, 1], [0.6, 0.8], [1, 0, inQ]) });
          this.floor('elec_floor', q.x, q.y, 180, 420, { add: true, s: kf([0, 0.4], [1, 2.4, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
          for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2; this.bolt('bolt_seg', { x: q.x + Math.cos(an) * 40, y: q.y - 20 + Math.sin(an) * 18 }, { x: q.x + Math.cos(an) * 220, y: q.y - 10 + Math.sin(an) * 100 }, { thick: 26, delay: i * 12, life: 220 }); }
          this.leaves(q.x, q.y - 30, 14, 120);
          this.shake(r, 260, 0.007); if (r.own) this.ctx.punch(0.04, 260);
        }, r);
        break;
      }
      case 'leaping_arrow': this.bindingRoots(r); break;
      case 'spirit_hawk': this.hawkCall(r); break;
      case 'tree_of_life': this.tree(r); break;
      case 'hunters_spirit': { // a column of golden light rises round her, feathers and sparks
        this.spr({ name: 'aura_gold', w: 120, oy: 0.92, follow: this.at(r.attackerId, 0, 0, -6), dz: 1, life: T.startup + T.active + 700, add: true, glow: 0.3, run: r,
          sy: kf([0, 0.2], [0.35, 1, out3]), a: kf([0, 0], [0.2, 0.95], [0.75, 0.9], [1, 0]) });
        this.later(T.startup, () => { const q = this.me(r); this.pop('sparkles', q.x, q.y - q.z - 70, 110, { life: 600 }); this.floor('shock_ring', q.x, q.y, 140, 420, { add: true, tint: 0xffe27a, s: kf([0, 0.4], [1, 1.4, out3]), a: kf([0, 1], [1, 0]) }); }, r);
        break;
      }
      case 'eagle_arrow': this.eagleTide(r); break;
      case 'arrow_storm': this.huntersRain(r); break;
      case 'sky_rain': this.skyRain(r); break;
    }
  }

  /** Hit-timed effects of area skills (strikes land where and when the hit fires). */
  hit(r: CastRun, i: number, o: V3): void {
    if (!this.ready) return;
    const s = r.skill, a = r.aim;
    if (s.id === 'rain_of_arrows') { // the charged lightning arrow strikes the floor (near, middle, far)
      const sh = r.hits[i].shape as { bias?: number }, cx = r.origin.x + a.x * (sh.bias ?? 200), cy = r.origin.y + a.y * (sh.bias ?? 200);
      const q = this.me(r), sx = q.x + sideOf(r) * 30, sy = q.y - q.z - 58, lv = { x: cx - sx, y: cy - 20 - sy }, L = Math.hypot(lv.x, lv.y) || 1;
      this.spr({ name: 'arrow_storm', x: sx, y: sy, depth: TOP + 3, w: 90, angle: Math.atan2(lv.y, lv.x) * (180 / Math.PI), add: true, glow: 0.4, life: 110, mx: (u) => lv.x * u, my: (u) => lv.y * u, a: kf([0, 1], [1, 1]) });
      this.later(100, () => {
        this.spr({ name: 'bolt_v', x: cx, y: cy + 6, oy: 0.97, depth: cy + 3, w: 110, life: 300, add: true, glow: 0.5, sy: kf([0, 0.3], [0.15, 1.05, out3], [1, 1]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
        this.floor('elec_floor', cx, cy, 150, 520, { add: true, s: kf([0, 0.5], [0.3, 1.1, out3]), a: kf([0, 1], [0.6, 0.8], [1, 0]) });
        this.pop('spark_cyan', cx, cy - 30, 60, { life: 200 });
        for (let k = 0; k < 3; k++) { const an = rnd(0, Math.PI * 2); this.bolt('arc_small', { x: cx, y: cy - 4 }, { x: cx + Math.cos(an) * 70, y: cy + Math.sin(an) * 30 }, { thick: 30, delay: k * 40, life: 160 }); }
        this.shake(r, i === 2 ? 200 : 110, i === 2 ? 0.006 : 0.003);
      }, r);
    }
    if (s.id === 'arrow_storm' && r.place) { // each wave of the rain falls on the mark where it is now
      const c = r.place, heavy = i % 3 === 2;
      for (let k = 0; k < (heavy ? 3 : 5); k++) {
        const fx = c.x + rnd(-80, 80), fy = c.y + rnd(-30, 30), d = rnd(0, 120);
        this.spr({ name: 'arrow_fall', x: fx - 50, y: fy - 260, depth: fy + 2, w: heavy && k === 0 ? 70 : 44, angle: -12, add: true, glow: 0.35, life: 200, delay: d, mx: (u) => 50 * u, my: (u) => 260 * inQ(u), a: kf([0, 0.6], [0.2, 1], [1, 1]) });
        this.later(d + 200, () => { this.pop(heavy && k === 0 ? 'burst_heavy' : 'spark_s', fx, fy - 10, heavy && k === 0 ? 110 : 54, { life: 220 }); if (heavy && k === 0) { this.floor('shock_ring', fx, fy, 160, 380, { add: true, s: kf([0, 0.3], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) }); this.shake(r, 90, 0.003); } });
      }
    }
    if (s.id === 'eagle_arrow' && i === 0) { /* the eagle sweep is scheduled from the cast */ }
    void o;
  }

  // ------------------------------------------------------------------ skills with their own staging

  private thunderCharge(r: CastRun): void {
    const T = r.timings, first = T.startup + r.hits[0].at, side = sideOf(r);
    // in the air: a crackling orb with the lightning arrow inside gathers at the bow, growing until it is loosed
    this.spr({ name: 'storm_orb', w: 90, life: first, follow: this.at(r.attackerId, side, 52, 58), dz: 6, add: true, glow: 0.5, run: r, flipX: side < 0,
      sx: kf([0, 0], [0.12, 0.35], [0.95, 1, out], [1, 1.3]), sy: kf([0, 0], [0.12, 0.35], [0.95, 1, out], [1, 1.3]), a: kf([0, 0], [0.12, 0.9], [0.96, 1], [1, 0]), rot: (u) => side * 40 * Math.sin(u * 30) });
    for (let k = 0; k < 9; k++) this.later(T.startup + 150 + k * (first - T.startup - 150) / 9, () => {
      const q = this.me(r), bx = q.x + side * 52, by = q.y - q.z - 58, an = rnd(0, Math.PI * 2), rr = rnd(40, 70);
      this.bolt('arc_small', { x: bx, y: by }, { x: bx + Math.cos(an) * rr, y: by + Math.sin(an) * rr }, { thick: 26, life: 140 });
    }, r);
    this.later(first - 300, () => { if (r.own) this.ctx.cam().shake(300, 0.002); }, r);
  }

  private spiritBow(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    let t = 0, on = true;
    const draw = this.spr({ name: 'bow', w: 120, life: T.startup + T.active + 200, follow: this.at(r.attackerId, side, 58, 66), dz: 6, add: true, glow: 0.4, run: r, flipX: side < 0,
      alive: () => on && r.phase !== 'done', sx: kf([0, 0.3], [0.08, 1, out3]), sy: kf([0, 0.3], [0.08, 1, out3]), a: kf([0, 0], [0.05, 1], [0.95, 1], [1, 0]) });
    // the bow turns to the aim (side / 45° / straight up) and draws on every shot
    this.add({ t: 0, step: (dt) => {
      t += dt; if (!draw?.active) { on = false; return false; }
      if (r.phase === 'recovery' || r.phase === 'done') { on = false; return false; }
      const up = r.aim.y < -0.3, vert = up && Math.abs(r.aim.x) < 0.1, sd = r.aim.x < -0.01 ? -1 : r.aim.x > 0.01 ? 1 : side;
      draw.setFlipX(sd < 0).setAngle(vert ? -90 * sd : up ? -45 * sd : 0);
      const ph = ((t - T.startup) % 250) / 250;
      if (t > T.startup) draw.setFrame(ph < 0.7 ? 'bow_drawn' : 'bow');
      return true;
    } });
    this.later(T.startup, () => { const q = this.me(r); this.pop('sparkles', q.x + side * 58, q.y - q.z - 66, 90, { life: 500 }); }, r);
  }

  private bindingRoots(r: CastRun): void {
    const T = r.timings, a = r.aim, o = r.origin, len = (r.skill.hits[0].shape as { length?: number }).length ?? 560;
    // charging: roots gather under her feet
    this.floor('root_tangle', o.x, o.y, 120, T.startup + 300, { run: r, s: kf([0, 0.2], [0.9, 1, out]), a: kf([0, 0], [0.2, 0.9], [0.9, 0.9], [1, 0]) });
    this.leaves(o.x, o.y - 10, 6, 30, { delay: T.startup * 0.5 });
    // release: roots creep out over the floor along the band, one length after another; they stop at a stone block
    const lv = level(a.x, a.y), segs = 4, seg = len / segs;
    this.later(T.startup, () => {
      for (let k = 0; k < segs; k++) {
        const d0 = 30 + k * seg, cx = o.x + a.x * (d0 + seg / 2), cy = o.y + a.y * (d0 + seg / 2);
        if (!clearLine(o.x, o.y, cx, cy, 30)) break;
        for (const w of [-36, 36]) {
          const px = cx - a.y * w, py = cy + a.x * w * 0.5;
          this.floor('root_long', px, py, seg * 1.15, 4200, { delay: k * 90 + (w > 0 ? 40 : 0), angle: lv.ang + rnd(-6, 6), flip: lv.flip !== (w > 0), run: r, depth: GROUND + 2.5,
            sx: kf([0, 0.1], [0.06, 1, out3]), a: kf([0, 0], [0.03, 1], [0.9, 1], [1, 0]) });
        }
        this.leaves(cx, cy - 6, 3, 40, { delay: k * 90 });
      }
      this.shake(r, 140, 0.003);
    }, r);
  }

  private tree(r: CastRun): void {
    const T = r.timings, o = r.origin, life = 20000, tx = o.x, ty = o.y - 46;
    this.floor('root_tangle', tx, ty + 6, 170, T.startup + life, { s: kf([0, 0.2], [0.03, 1, out3]), a: kf([0, 0], [0.02, 0.9], [0.97, 0.9], [1, 0]) });
    const base = kf([0, 0], [0.01, 1], [0.94, 1], [1, 0]);
    let im: Phaser.GameObjects.Image | null = null;
    const tree = im = this.spr({ name: 'tree_light', x: tx, y: ty + 8, oy: 0.97, depth: ty - 1, w: 220, life: T.startup + life, add: false, glow: 0.25,
      sy: kf([0, 0.05], [0.03, 1, out3]), sx: kf([0, 0.3], [0.03, 1, out3]), a: (u) => base(u) * ((im?.getData('fade') as number | undefined) ?? 1) }); // (see-through when someone stands behind it)
    if (tree) { this.trees.add(tree); tree.once('destroy', () => this.trees.delete(tree)); }
    this.later(T.startup, () => { this.floor('shock_ring', tx, ty, 200, 500, { add: true, s: kf([0, 0.4], [1, 1.3, out3]), a: kf([0, 1], [1, 0]) }); this.pop('sparkles', tx, ty - 120, 140, { life: 700 }); });
    this.later(T.startup + life - 900, () => this.leaves(tx, ty - 150, 22, 110, { life: 1400, up: -60 }));
  }

  private eagleTide(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    // charging: the aim band on the floor turns with the aim and burns brighter; the emblem gathers at the bow
    let on = true;
    this.charge(r, 'emblem', 70, T.startup, { spin: 0, dx: 36 });
    this.floor('aim_band', 0, 0, 560, T.startup, { add: true, glow: 0.3, ox: 0.02, run: r, alive: () => on && r.phase === 'startup', rot: () => Math.atan2(r.aim.y * 0.5, r.aim.x) * (180 / Math.PI),
      follow: () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x + r.aim.x * 30, y: c.y + r.aim.y * 30 } : null; },
      a: kf([0, 0], [0.1, 0.5], [0.95, 1]), sx: kf([0, 0.7], [1, 1]) });
    // keep the band turned to the live aim
    this.add({ t: 0, step: () => { if (r.phase !== 'startup') { on = false; return false; } return true; } });
    this.later(T.startup, () => {
      const q = this.me(r), a = r.aim, lv = level(a.x, a.y), x0 = q.x + a.x * 30, y0 = q.y + a.y * 30 - 50, len = 940, ms = T.active + 260;
      this.muzzle(r, 150);
      for (const [k, d, sc] of [[0, 0, 1], [-1, 70, 0.7], [1, 140, 0.7]] as const) {
        const px = -a.y * k * 120, py = a.x * k * 60;
        this.spr({ name: 'eagle_wide', x: x0, y: y0, depth: TOP - 4 + k, w: 300 * sc, ox: lv.flip ? 0.2 : 0.8, flipX: lv.flip, angle: lv.ang, add: true, glow: 0.35, life: ms - d, delay: d,
          mx: (u) => a.x * len * out(u) + px * Math.min(1, u * 3), my: (u) => a.y * len * 0.5 * out(u) + py * Math.min(1, u * 3), a: kf([0, 0], [0.08, 1], [0.8, 1], [1, 0]) });
        this.spr({ name: 'wind_streaks', x: x0, y: y0, depth: TOP - 5 + k, w: 240 * sc, ox: lv.flip ? 0 : 1, flipX: lv.flip, angle: lv.ang, add: true, life: ms - d, delay: d + 40,
          mx: (u) => a.x * len * out(u) + px * Math.min(1, u * 3), my: (u) => a.y * len * 0.5 * out(u) + py * Math.min(1, u * 3), a: kf([0, 0], [0.1, 0.8], [1, 0]) });
      }
      for (let k = 0; k < 6; k++) this.leaves(x0 + a.x * k * 150, y0 + 40 + a.y * k * 75, 4, 50, { delay: k * 70, dir: side });
      this.shake(r, 420, 0.01); if (r.own) this.ctx.punch(0.05, 320);
    }, r);
  }

  private huntersRain(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    // she looses a volley at the sky
    this.later(T.startup * 0.55, () => {
      const q = this.me(r);
      for (let k = 0; k < 7; k++) {
        const dx = rnd(-14, 14);
        this.spr({ name: 'arrow_wind', x: q.x + side * 16 + dx, y: q.y - q.z - 70, depth: TOP + 2, w: 70, angle: -90 + rnd(-8, 8), add: true, glow: 0.3, life: 360, delay: k * 35, my: (u) => -420 * out(u), mx: (u) => dx * u, a: kf([0, 1], [0.7, 1], [1, 0]) });
      }
      this.floor('shock_ring', q.x, q.y, 120, 360, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) });
    }, r);
    // on her while the rain lasts: the rune circle with arrows streaming up
    this.spr({ name: 'rain_ring', w: 110, oy: 0.88, follow: this.at(r.attackerId, 0, 0, -6), dz: -1, life: T.startup + T.active, add: true, glow: 0.25, run: r,
      a: kf([0, 0], [0.12, 0.7], [0.92, 0.7], [1, 0]) });
    // the target mark on the floor, following r.place
    this.floor('target_circle', 0, 0, 190, T.startup + T.active, { add: true, glow: 0.3, run: r, follow: () => r.place ?? null, s: kf([0, 0.5], [0.08, 1, out3]), a: kf([0, 0], [0.08, 0.9], [0.95, 0.9], [1, 0]) });
  }

  private skyRain(r: CastRun): void {
    const T = r.timings;
    this.ctx.ultimateStage(r);
    this.later(T.startup, () => {
      const v = this.ctx.cam().worldView;
      for (let w = 0; w < 7; w++) for (let k = 0; k < 16; k++) {
        const fx = v.x + rnd(0.04, 0.96) * v.width, fy = v.y + rnd(0.5, 0.95) * v.height, d = w * 200 + rnd(0, 180), big = Math.random() < 0.15;
        this.spr({ name: 'arrow_fall', x: fx - 70, y: fy - 380, depth: fy + 2, w: big ? 80 : 50, angle: -12, add: true, glow: 0.35, life: 220, delay: d, mx: (u) => 70 * u, my: (u) => 380 * inQ(u) });
        this.later(d + 220, () => { this.pop(big ? 'burst_heavy' : 'spark_s', fx, fy - 10, big ? 110 : 56, { life: 240 }); if (big) this.floor('shock_ring', fx, fy, 140, 360, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) }); });
      }
      for (let w = 0; w < 7; w++) this.later(w * 200 + 200, () => this.shake(r, 160, 0.004));
      this.later(1500, () => { this.shake(r, 420, 0.012); if (r.own) this.ctx.punch(0.06, 360); });
    }, r);
  }

  // ------------------------------------------------------------------ the spirit hawk

  private hawkCall(r: CastRun): void {
    const q = this.me(r), L = r.skill.linger;
    this.pop('feather_burst', q.x, q.y - q.z - 110, 120, { life: 500 });
    const old = this.hawks.get(r.attackerId); old?.im.destroy();
    const im = this.ctx.scene.add.image(q.x, q.y - q.z - 110, ARCHER_KIT, 'hawk_up').setDisplaySize(70, 78).setAlpha(0);
    this.ctx.scene.tweens.add({ targets: im, alpha: 1, duration: 300 });
    const life = L ? L.startMs + L.everyMs * L.count : 20000;
    this.hawks.set(r.attackerId, { until: this.ctx.scene.time.now + life, t: 0, px: q.x, py: q.y - q.z - 110, vx: 0, vy: 0, wx: q.x, wy: q.y - q.z - 110, next: 0, face: sideOf(r), dive: null, im });
  }
  hawkDive(id: string, to: V3): void { const h = this.hawks.get(id); if (h) h.dive = { x: to.x, y: to.y - to.z - 30, d: to.y, t: 0 }; }
  private stepHawks(ms: number): void {
    const now = this.ctx.scene.time.now;
    for (const [id, h] of this.hawks) {
      const c = this.ctx.casterPos(id);
      if (!c || now >= h.until) { this.hawks.delete(id); this.ctx.scene.tweens.add({ targets: h.im, alpha: 0, duration: 300, onComplete: () => h.im.destroy() }); continue; }
      h.t += ms;
      if (h.next <= h.t || Math.hypot(h.wx - c.x, h.wy - (c.y - c.z)) > 260) { const an = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 110; h.wx = c.x + Math.cos(an) * rr; h.wy = c.y - c.z - 90 - Math.abs(Math.sin(an)) * 60 - Math.random() * 30; h.next = h.t + 900 + Math.random() * 1300; }
      const dt = ms / 1000; h.vx += ((h.wx - h.px) * 6 - h.vx * 3.2) * dt; h.vy += ((h.wy - h.py) * 6 - h.vy * 3.2) * dt; h.px += h.vx * dt; h.py += h.vy * dt;
      if (Math.abs(h.vx) > 12) h.face = h.vx > 0 ? 1 : -1;
      let x = h.px, y = h.py + Math.sin(h.t / 140) * 3, frame = Math.floor(h.t / 120) % 2 ? 'hawk_up' : 'hawk_down', face = h.face, d = y + 140 < c.y - c.z ? c.y - 3 : c.y + 3, ang = Math.max(-18, Math.min(18, h.vy * 0.12)) * h.face;
      if (h.dive) { // 180 ms out, 220 ms back
        h.dive.t += ms;
        const out1 = Math.min(1, h.dive.t / 180), back = Math.max(0, (h.dive.t - 180) / 220);
        face = h.dive.x >= h.px ? 1 : -1; ang = 0;
        if (back <= 0) { x = h.px + (h.dive.x - h.px) * out1; y = h.py + (h.dive.y - h.py) * out1; frame = 'hawk_dive'; }
        else { x = h.dive.x + (h.px - h.dive.x) * back; y = h.dive.y + (h.py - h.dive.y) * back; }
        d = h.dive.d + 3;
        if (h.dive.t >= 180 && h.dive.t - ms < 180) this.pop('feather_burst', h.dive.x, h.dive.y, 90, { life: 320 });
        if (back >= 1) h.dive = null;
      }
      const fr = this.ctx.scene.textures.getFrame(ARCHER_KIT, frame), w = frame === 'hawk_dive' ? 80 : 72;
      h.im.setFrame(frame).setDisplaySize(w, (w * fr.height) / fr.width).setPosition(x, y).setFlipX(face < 0).setAngle(ang).setDepth(d);
    }
  }

  // ------------------------------------------------------------------ the vine mine

  trap(t: Trap): void {
    if (!this.ready) return;
    const R0 = t.radius;
    let on = true, armed = false;
    // a seed-mine lies still in the soil (half see-through); motes and leaves drift up from it — it is alive
    this.floor('mine_seed', t.x, t.y, 2.4 * R0, 600000, { a: kf([0, 0], [0.0005, 0.8]), alive: () => on });
    const motes = () => { if (!on) return; this.leaves(t.x, t.y - 4, 1, R0 * 0.8, { life: 900, up: 30, depth: t.y + 1 }); this.later(armed ? 90 : 420, motes); };
    motes();
    this.trapArt.set(t, { stop: () => { on = false; }, arm: () => {
      armed = true;
      // armed: the heart of the flower blinks faster and faster; the cracks blaze
      this.floor('floor_cracks', t.x, t.y, 2.2 * R0, 2400, { add: true, alive: () => on, a: kf([0, 0], [0.1, 0.9]) });
      let k = 0;
      const blink = () => { if (!on) return; this.pop('spark_s', t.x, t.y - 0.1 * R0, 40 + k * 3, { life: 160, depth: t.y + 2 }); k++; this.later(Math.max(70, 320 - k * 22), blink); };
      blink();
    } });
  }
  trapArm(t: Trap): void { this.trapArt.get(t)?.arm(); }
  trapEnd(t: Trap, fired: boolean): void {
    const art = this.trapArt.get(t); art?.stop(); this.trapArt.delete(t);
    if (!fired || !this.ready) return;
    // the mine bursts: a column of vines and green light throws everyone in it high (no stain left behind)
    this.spr({ name: 'vine_column', x: t.x, y: t.y + 8, oy: 0.96, depth: t.y + 3, w: 160, life: 620, add: false, glow: 0.3, sy: kf([0, 0.2], [0.25, 1.05, out3], [1, 1]), a: kf([0, 1], [0.7, 1], [1, 0, inQ]) });
    this.spr({ name: 'launch_beam', x: t.x, y: t.y + 4, oy: 0.97, depth: t.y + 4, w: 100, life: 420, add: true, glow: 0.4, sy: kf([0, 0.2], [0.3, 1.1, out3]), a: kf([0, 1], [1, 0, inQ]) });
    this.floor('shock_ring', t.x, t.y, 2.4 * t.radius, 420, { add: true, s: kf([0, 0.4], [1, 1.25, out3]), a: kf([0, 1], [1, 0, inQ]) });
    this.leaves(t.x, t.y - 30, 14, 60, { up: 120 });
    this.shake(t.run, 240, 0.007);
  }

  // ------------------------------------------------------------------ arrows in flight

  projectile(p: Projectile): void {
    if (!this.ready) return;
    const id = p.skill.id, kind = id === 'explosive_arrow' ? 'arrow_heavy' : 'arrow_wind';
    const w = id === 'explosive_arrow' ? 110 : id === 'piercing_arrow' ? 92 : id === 'skyhunters_step' ? 80 : 86;
    const s = this.ctx.scene, fr = s.textures.getFrame(ARCHER_KIT, kind);
    const im = s.add.image(p.x, p.y - p.z, ARCHER_KIT, kind).setOrigin(0.92, 0.5).setDisplaySize(w, (w * fr.height) / fr.width).setAlpha(0);
    if (id === 'explosive_arrow') im.setTint(0xffc070, 0xffc070, 0xff8a30, 0xff8a30);
    const tr = s.add.image(p.x, p.y - p.z, ARCHER_KIT, 'arrow_streak').setOrigin(1, 0.5).setAlpha(0).setDisplaySize(10, 12);
    if (id === 'explosive_arrow') tr.setTint(0xffa040);
    im.setData('sx', im.scaleX);
    this.arrows.set(p, { im, tr, t: 0, kind, z0: p.z });
  }
  private stepArrows(dt: number): void {
    for (const [p, a] of this.arrows) {
      a.t += dt;
      let x = p.x, y = p.y - p.z, ang = level(p.dx, p.dy).ang, flip = p.dx < -0.01;
      if (p.skill.id === 'skyhunters_step') { // the volley dives from the air down onto the floor at an angle
        const k = Math.min(1, p.ageMs / 430); y += a.z0 * k; ang = Math.atan2(p.dy * 0.5 * 980 + (a.z0 / 430) * 1000, Math.abs(p.dx) * 980 + 1) * (180 / Math.PI) * (flip ? -1 : 1);
      }
      if (p.skill.id === 'piercing_arrow' && p.dy < -0.3) { // Spirit Bow aimed up: arcs high and falls back down onto the floor
        const life = 620, k = Math.min(1, p.ageMs / life), H = Math.abs(p.dx) < 0.1 ? 320 : 170, lift = 4 * H * k * (1 - k), slope = (4 * H * (1 - 2 * k)) / life * 1000;
        y -= lift; const raw = Math.atan2(p.dy * 900 * 0.5 - slope, Math.abs(p.dx) * 900 + 1) * (180 / Math.PI); ang = flip ? -raw : raw;
      }
      const grow = Math.min(1, 0.2 + a.t / 80), len = Math.min(120, 20 + a.t * 0.8);
      a.im.setPosition(x, y).setFlipX(flip).setAngle(ang).setDepth(p.y + 2).setAlpha(Math.min(1, a.t / 30)).setScale((a.im.getData('sx') as number) * grow, a.im.scaleY); // grows out of the bow's flash
      a.tr?.setPosition(x - (flip ? -1 : 1) * a.im.displayWidth * 0.8, y).setFlipX(flip).setAngle(ang).setDepth(p.y + 1.9).setAlpha(0.7 * Math.min(1, a.t / 40)).setDisplaySize(len, 12);
    }
  }
  projectileEnd(p: Projectile): void {
    const a = this.arrows.get(p); if (!a) return;
    this.arrows.delete(p); a.im.destroy(); a.tr?.destroy();
    const end = p.end ?? { x: p.x, y: p.y, reason: 'range' };
    if (p.skill.id === 'explosive_arrow') { // the fire burst (gold-orange), doubled on a marked foe by the scene's numbers
      const y = end.y - p.z;
      this.pop('burst_crit', end.x, y - 10, 150, { life: 320, tint: 0xffb060 });
      this.pop('burst_heavy', end.x, y - 6, 120, { life: 280, tint: 0xff8a40, delay: 40 });
      this.floor('scorch_ring', end.x, end.y, 150, 1400, { a: kf([0, 0.8], [0.6, 0.6], [1, 0]) });
      this.ctx.cam().shake(130, 0.003);
      return;
    }
    if (p.skill.id === 'skyhunters_step') { this.pop('leaf_spray', end.x, end.y - 6, 60, { life: 260, angle: 0, flip: p.dx < 0 }); this.floor('shock_ring', end.x, end.y, 60, 260, { add: true, s: kf([0, 0.4], [1, 1.2]), a: kf([0, 1], [1, 0]) }); return; }
    if (end.reason === 'cover') this.spr({ name: 'arrow_stuck', x: end.x, y: end.y - p.z + 4, oy: 0.9, depth: end.y + 1, w: 60, flipX: p.dx < 0, life: 1400, a: kf([0, 1], [0.8, 1], [1, 0]) });
    else if (end.reason !== 'target') this.pop('arrow_glint', end.x, end.y - p.z, 30, { life: 160 });
  }

  // ------------------------------------------------------------------ on the foe

  confirmed(s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z - 38, rapid = s.hits.length > 3 && !hit.heavy;
    if (s.id === 'rain_of_arrows') { this.pop('spark_cyan', x, y, 70, { life: 200 }); return; }
    if (crit) this.pop('burst_crit', x, y, rapid ? 110 : 150, { life: 300 });
    else if (heavy && !rapid) this.pop('burst_heavy', x, y, 130, { life: 260 });
    else this.pop('spark_s', x, y, rapid ? 60 : 82, { life: 200 });
    if (!rapid && Math.random() < 0.6) this.leaves(x, y, 3, 14, { life: 420, up: 30 });
    if (hit.reaction.launch && hit.reaction.launch >= 120) this.spr({ name: 'launch_beam', x, y: at.y + 4, oy: 0.97, depth: at.y + 3, w: 60, life: 300, add: true, sy: kf([0, 0.3], [0.3, 1, out3]), a: kf([0, 1], [1, 0, inQ]) });
    if (s.id === 'leaping_arrow' && hit.reaction.hardCC) { // roots grip the caught foe's legs for the hold
      const ms = hit.reaction.hardCC.ms;
      this.spr({ name: 'vine_wrap', x: at.x, y: at.y - 6, depth: at.y + 2, w: 80, life: ms, sx: kf([0, 0.4], [0.06, 1, out3]), sy: kf([0, 0.4], [0.06, 1, out3]), a: kf([0, 0], [0.04, 1], [0.92, 1], [1, 0]) });
    }
  }

  /** The Hunter's Mark over a foe's head (1–3 leaves), until it runs out or is spent. */
  mark(id: string, n: number, ms: number, pos: () => V3 | null): void {
    if (!this.ready) return;
    const cur = this.markArt.get(id), until = this.ctx.scene.time.now + ms;
    if (cur) { cur.n = n; cur.until = until; cur.im?.setFrame(`mark_${n}`); this.pulse(cur.im); return; }
    const p = pos(); if (!p) return;
    const im = this.ctx.scene.add.image(p.x, p.y - p.z - 112, ARCHER_KIT, `mark_${n}`).setDisplaySize(26, 32);
    const rec = { n, until, im };
    this.markArt.set(id, rec);
    this.pulse(im);
    this.add({ t: 0, step: (_dt, t) => {
      const q = pos(), now = this.ctx.scene.time.now;
      if (!q || now >= rec.until || this.markArt.get(id) !== rec) { im.destroy(); if (this.markArt.get(id) === rec) this.markArt.delete(id); return false; }
      const fr = this.ctx.scene.textures.getFrame(ARCHER_KIT, `mark_${rec.n}`), w = 20 + rec.n * 6;
      im.setPosition(q.x, q.y - q.z - 112 + Math.sin(t / 220) * 3).setDepth(q.y + 6).setDisplaySize(w, (w * fr.height) / fr.width).setAlpha(rec.until - now < 1000 ? 0.5 + 0.5 * Math.sin(now / 60) : 1);
      return true;
    } });
  }
  private pulse(im: Phaser.GameObjects.Image | null): void {
    if (!im) return; const s0x = im.scaleX, s0y = im.scaleY;
    this.ctx.scene.tweens.add({ targets: im, scaleX: s0x * 1.5, scaleY: s0y * 1.5, duration: 90, yoyo: true });
  }
  /** Marks spent by a skill: the leaves shatter in gold and green over the foe. */
  markSpend(id: string, n: number, pos: () => V3 | null): void {
    const rec = this.markArt.get(id); if (rec) { rec.im?.destroy(); this.markArt.delete(id); }
    const p = pos(); if (!p || !this.ready) return;
    this.pop('mark_burst', p.x, p.y - p.z - 100, 60 + n * 16, { life: 360 });
    this.pop('sparkles', p.x, p.y - p.z - 60, 70 + n * 10, { life: 420, delay: 40 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
    this.stepArrows(dt);
    this.stepHawks(dt);
  }

  destroy(): void {
    for (const [p] of this.arrows) this.projectileEnd(p);
    for (const [, h] of this.hawks) h.im.destroy();
    this.hawks.clear();
    this.live = []; this.incoming = [];
  }
}
