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
  private fanCount = new Map<string, number>();
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
  /** A painted frame sheet played once (e.g. the fire burst sheet). */
  private sheet(key: string, x: number, y: number, w: number, fms: number[], o: { depth?: number; oy?: number; delay?: number } = {}): void {
    const sc = this.ctx.scene; if (!sc.textures.exists(key)) return;
    const im = sc.add.image(x, y, key, 0).setOrigin(0.5, o.oy ?? 0.5).setDisplaySize(w, w).setDepth(o.depth ?? TOP + 4).setVisible(false);
    let acc = 0, i = 0;
    this.add({ t: 0, step: (dt, t) => {
      if (t < (o.delay ?? 0)) return true;
      im.setVisible(true); acc += dt;
      while (i < fms.length && acc >= fms[i]) { acc -= fms[i]; i++; }
      if (i >= fms.length) { im.destroy(); return false; }
      im.setFrame(i); if (i === fms.length - 1) im.setAlpha(1 - acc / fms[i]);
      return true;
    } });
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
    this.spr({ name: 'muzzle', w: size, life: 200, delay, follow: this.at(r.attackerId, side, 14, 54), dz: 4, ox: lv.flip ? 0.85 : 0.15, flipX: lv.flip, angle: lv.ang, add: true, glow: 0.4, run: r,
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
      case 'bow_haste': { // Wind Step: a whirlwind bursts where she stood and hurls her back; wind streams along the leap; she looses an arrow mid-air
        this.spr({ name: 'tornado', x: me.x, y: me.y + 6, oy: 0.96, depth: me.y + 2, w: 120, life: 560, glow: 0.3, run: r, sy: kf([0, 0.3], [0.25, 1.05, out3], [1, 1.1]), sx: kf([0, 0.6], [0.25, 1, out3], [1, 1.3]), a: kf([0, 0.9], [0.6, 0.8], [1, 0, inQ]) });
        this.floor('wind_ring', me.x, me.y, 150, 560, { add: true, glow: 0.4, run: r, s: kf([0, 0.5], [0.4, 1.3, out3]), a: kf([0, 0.95], [1, 0, inQ]) });
        this.spr({ name: 'dust', x: me.x, y: me.y + 4, oy: 0.85, depth: me.y + 1, w: 140, life: 520, sx: kf([0, 0.6], [1, 1.4, out3]), a: kf([0, 0.8], [1, 0, inQ]) });
        for (let k = 0; k < 4; k++) this.spr({ name: 'wind_streaks', w: 130, life: 260, delay: 40 + k * 60, follow: this.at(r.attackerId, side, 30, 50 - k * 6), dz: 2, flipX: side > 0, add: true, run: r, mx: (u) => side * 40 * u, a: kf([0, 0], [0.2, 0.9], [1, 0]) });
        this.leaves(me.x, me.y - 20, 10, 40, { dir: -side, up: 70 });
        { // mid-leap she shoots an arrow down into the ground in front of her; it sticks, glows, then bursts (hit())
          const sh = s.hits[0].shape as { bias?: number }, gx = r.origin.x + a.x * (sh.bias ?? 200), gy = r.origin.y + a.y * (sh.bias ?? 200), shot = T.startup + r.hits[0].at - 200;
          this.later(shot, () => {
            this.muzzle(r, 110); const q = this.me(r), sx = q.x + side * 16, sy = q.y - q.z - 54, dx = gx - sx, dy = gy - sy;
            this.spr({ name: 'arrow_heavy', x: sx, y: sy, depth: TOP + 3, w: 100, angle: Math.atan2(dy, dx) * (180 / Math.PI), glow: 0.3, life: 110, mx: (u) => dx * u, my: (u) => dy * u });
            this.later(110, () => {
              this.spr({ name: 'arrow_planted', x: gx, y: gy + 6, oy: 0.96, depth: gy + 1, w: 90, life: 240, glow: 0.4 });
              this.floor('floor_cracks', gx, gy, 80, 300, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 0.6], [1, 1]) });
              this.pop('arrow_glint', gx, gy - 20, 50, { life: 200 });
            });
          }, r);
        }
        this.later(T.startup + T.active, () => { const q = this.me(r); this.floor('wind_ring', q.x, q.y, 100, 380, { add: true, s: kf([0, 0.5], [1, 1.2, out3]), a: kf([0, 0.9], [1, 0]) }); this.spr({ name: 'dust', x: q.x, y: q.y + 4, oy: 0.85, depth: q.y + 1, w: 110, life: 420, a: kf([0, 0.7], [1, 0]) }); }, r);
        break;
      }
      case 'multi_shot': this.charge(r, 'leaf_whirl', 56, T.startup, { spin: 420, dx: 16 }); this.muzzle(r, 130, T.startup); break;
      case 'explosive_arrow': this.charge(r, 'burst_crit', 60, T.startup, { tint: 0xffa040, spin: 260, dx: 16 }); this.muzzle(r, 120, T.startup); break;
      case 'rising_arrow': { // the earth cracks and glows under the foe, gathering power; then a great arrow of light bursts up out of it and throws the foe high
        const sh = s.hits[0].shape as { bias?: number }, bx = r.origin.x + a.x * (sh.bias ?? 95), by = r.origin.y + a.y * (sh.bias ?? 95);
        this.floor('rune_circle', bx, by, 150, T.startup + T.active + 300, { add: true, glow: 0.3, run: r, rot: () => 0, s: kf([0, 0.3], [0.5, 1, out3]), a: kf([0, 0], [0.2, 0.9], [0.75, 0.8], [1, 0]) });
        this.floor('floor_cracks', bx, by, 140, T.startup + T.active + 900, { run: r, s: kf([0, 0.2], [0.25, 1, out3]), a: kf([0, 0], [0.1, 1], [0.8, 0.9], [1, 0]) });
        for (let k = 0; k < 4; k++) this.later(k * T.startup / 4, () => this.leaves(bx, by, 2, 40, { up: 20, life: 500 }), r); // the ground stirs
        this.later(T.startup, () => {
          this.spr({ name: 'launch_beam', x: bx, y: by + 6, oy: 0.97, depth: by + 3, w: 110, life: 520, add: true, glow: 0.3, sy: kf([0, 0.1], [0.2, 1.15, out3], [1, 1]), sx: kf([0, 1.2], [1, 0.5]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
          this.spr({ name: 'arrow_heavy', x: bx, y: by - 10, depth: by + 4, w: 150, angle: -90, glow: 0.3, life: 380, my: (u) => -230 * out3(u), a: kf([0, 1], [0.7, 1], [1, 0]) }); // the arrow itself flies up out of the earth
          this.spr({ name: 'dust', x: bx, y: by + 4, oy: 0.85, depth: by + 1, w: 150, life: 600, sx: kf([0, 0.5], [1, 1.4, out3]), a: kf([0, 0.85], [1, 0, inQ]) });
          this.pop('leaf_spray', bx, by - 40, 120, { angle: -90, life: 380 });
          this.floor('shock_ring', bx, by, 160, 420, { add: true, s: kf([0, 0.4], [1, 1.3, out3]), a: kf([0, 1], [1, 0, inQ]) });
          this.leaves(bx, by - 20, 10, 40, { up: 140 });
          this.shake(r, 140, 0.004);
        }, r);
        break;
      }
      case 'retreat_kick': { // the floor cracks open in green light — then a great boot of wind bursts up out of it in an upward kick that throws the foe
        const kx = r.origin.x + a.x * 70, ky = r.origin.y + a.y * 34;
        this.floor('floor_cracks', kx, ky, 90, T.startup + T.active + 800, { add: true, glow: 0.3, run: r, s: kf([0, 0.3], [0.25, 1, out3], [0.4, 1.5, out3]), a: kf([0, 0], [0.1, 1], [0.8, 0.9], [1, 0]) }); // the ground splits, glowing green
        this.floor('wind_ring', kx, ky, 110, T.startup + 120, { add: true, run: r, s: kf([0, 1.3], [1, 0.6, out]), a: kf([0, 0], [0.3, 0.9], [1, 0.9]) });
        this.later(T.startup * 0.5, () => this.leaves(kx, ky, 3, 30, { up: 20, life: 400 }), r);
        this.later(T.startup, () => {
          this.floor('floor_cracks', kx, ky, 190, 900, { run: r, a: kf([0, 1], [0.7, 0.9], [1, 0]) }); // the floor breaks open
          this.spr({ name: 'dust', x: kx, y: ky + 4, oy: 0.85, depth: ky + 1, w: 200, life: 640, sx: kf([0, 0.4], [1, 1.5, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
          this.floor('crater', kx, ky, 210, 1300, { a: kf([0, 0], [0.04, 1], [0.6, 0.85], [1, 0]) });
          this.spr({ name: 'debris', x: kx, y: ky + 6, oy: 0.95, depth: ky + 4, w: 210, life: 640, my: (u) => -30 * out(u), sy: kf([0, 0.4], [0.3, 1.1, out3]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
          // the big boot rises out of the ground (grows up from the floor line), toe the way she faces, a whirl turning round it
          this.spr({ name: 'wind_boot', x: kx, y: ky + 8, oy: 1, depth: ky + 3, w: 210, flipX: side < 0, life: T.active + 360, glow: 0.3,
            sy: kf([0, 0], [0.18, 1.12, out3], [0.3, 1]), sx: kf([0, 0.7], [0.18, 1, out3]), my: kf([0, 0], [0.18, -20, out3], [1, -70]), a: kf([0, 1], [0.75, 1], [1, 0]) }); // always faces the way she faces
          // a whirl of wind and leaves turns round the boot
          this.spr({ name: 'leaf_whirl', x: kx, y: ky - 40, depth: ky + 2, w: 170, add: true, life: T.active + 300, delay: 40, my: (u) => -50 * out(u), sy: () => 0.75, rot: (u) => side * 900 * u, a: kf([0, 0], [0.15, 0.5], [0.7, 0.4], [1, 0]) });
          // the upward kick: a crescent of wind sweeping up, streaks shooting skyward
          this.spr({ name: 'wind_crescent', x: kx + side * 20, y: ky - 90, depth: ky + 4, w: 200, angle: side * -70, flipX: side < 0, add: true, glow: 0.3, life: 360, delay: 60, my: (u) => -50 * out(u), sx: kf([0, 0.6], [0.4, 1.1, out3]), a: kf([0, 0], [0.15, 1], [1, 0, inQ]) });
          for (let k = 0; k < 3; k++) this.spr({ name: 'wind_streaks', x: kx + (k - 1) * 30, y: ky - 40, depth: ky + 4, w: 150, angle: -90, add: true, life: 320, delay: 40 + k * 40, my: (u) => -140 * out(u), a: kf([0, 0], [0.2, 0.9], [1, 0]) });
          this.floor('shock_ring', kx, ky, 190, 420, { add: true, s: kf([0, 0.4], [1, 1.35, out3]), a: kf([0, 1], [1, 0, inQ]) });
          this.leaves(kx, ky - 20, 14, 50, { up: 180, life: 900 });
          this.shake(r, 180, 0.006); if (r.own) this.ctx.punch(0.02, 180);
        }, r);
        break;
      }
      case 'skyhunters_step': this.floor('wind_ring', me.x, me.y, 140, 520, { add: true, glow: 0.4, run: r, s: kf([0, 0.4], [0.4, 1.2, out3]), a: kf([0, 0.9], [1, 0, inQ]) }); this.leaves(me.x, me.y - 10, 8, 40); break;
      case 'vine_trap': break; // the mine itself (trap)
      case 'rain_of_arrows': this.thunderCharge(r); break;
      case 'piercing_arrow': this.spiritBow(r); break;
      case 'hunters_roar': { // the spirit wolf rises behind her and howls; the wave of wind and lightning goes all round
        // the spirit wolf gathers behind her, crouched and snarling — then rears up and howls
        this.spr({ name: 'wolf_crouch', w: 190, oy: 0.95, follow: this.at(r.attackerId, -side, 34, -12), dz: -3, flipX: side < 0, life: T.startup + 40, add: true, glow: 0.3, run: r,
          sx: kf([0, 0.6], [0.6, 1, out3]), sy: kf([0, 0.4], [0.6, 1, out3]), a: kf([0, 0], [0.4, 0.95], [1, 0.95]) });
        this.spr({ name: 'wolf_howl', w: 210, oy: 0.95, follow: this.at(r.attackerId, -side, 30, -12), dz: -3, flipX: side < 0, delay: T.startup, life: T.active + 700, add: true, glow: 0.35, run: r,
          sy: kf([0, 0.8], [0.15, 1.08, out3], [0.3, 1]), a: kf([0, 0.95], [0.7, 0.9], [1, 0]) });
        this.later(T.startup, () => { // the roar rolls out both ways in great arcs
          const q = this.me(r);
          for (const d of [1, -1]) for (let k = 0; k < 3; k++)
            this.spr({ name: 'roar_wave', x: q.x + d * 40, y: q.y - q.z - 60, ox: 0.15, depth: q.y + 5, w: 200, flipX: d < 0, add: true, glow: 0.3, life: 520, delay: k * 110,
              mx: (u) => d * 230 * out(u), sx: kf([0, 0.5], [1, 1.5, out3]), sy: kf([0, 0.5], [1, 1.5, out3]), a: kf([0, 0], [0.12, 1], [1, 0, inQ]) });
        }, r);
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
      this.spr({ name: 'elec_arrow', x: sx, y: sy, ox: 0.9, depth: TOP + 3, w: 190, angle: Math.atan2(lv.y, lv.x) * (180 / Math.PI), add: true, glow: 0.4, life: 110, mx: (u) => lv.x * u, my: (u) => lv.y * u, a: kf([0, 1], [1, 1]) });
      this.later(100, () => {
        // the arrow stands in the floor, then the sky answers: a great bolt strikes it, and the burnt ground round it stays charged
        this.spr({ name: 'elec_arrow', x: cx, y: cy + 6, ox: 0.97, depth: cy + 2, w: 170, angle: lv.x >= 0 ? 58 : 122, flipY: lv.x < 0, add: true, glow: 0.4, life: 2000, a: (u) => (u > 0.8 ? (1 - u) * 5 : 1) * (0.75 + 0.25 * Math.sin(u * 60)) });
        this.spr({ name: 'elec_burst', x: cx, y: cy - 30, depth: cy + 4, w: 200, add: true, life: 260, sx: kf([0, 0.4], [0.3, 1.1, out3]), sy: kf([0, 0.4], [0.3, 1.1, out3]), a: kf([0, 1], [1, 0, inQ]) });
        this.later(70, () => {
          this.spr({ name: 'strike', x: cx, y: cy + 10, oy: 0.97, depth: cy + 3, w: 230, h: 560, life: 360, add: true, glow: 0.5, sy: kf([0, 0.2], [0.12, 1.05, out3], [1, 1]), a: kf([0, 1], [0.4, 1], [1, 0, inQ]) });
          this.floor('elec_ring', cx, cy, 240, 460, { add: true, s: kf([0, 0.3], [1, 1.3, out3]), a: kf([0, 1], [1, 0, inQ]) });
          if (r.own && i === 2) this.ctx.punch(0.02, 160);
        }, r);
        this.floor('elec_ground', cx, cy, 210, 2100, { add: false, glow: 0.35, s: kf([0, 0.5], [0.1, 1.05, out3], [0.2, 1]), a: (u) => kf([0, 0], [0.06, 1], [0.8, 0.85], [1, 0])(u) * (0.85 + 0.15 * Math.sin(u * 45)) }); // burnt ground, flickering
        for (let k = 0; k < 7; k++) this.later(150 + k * 260, () => {
          this.spr({ name: k % 2 ? 'ground_arcs' : 'elec_sparks', x: cx + rnd(-40, 40), y: cy + rnd(-10, 10) + 6, oy: 0.95, depth: cy + 3, w: k % 2 ? 160 : 120, add: true, life: 300, sy: kf([0, 0.5], [0.3, 1.05, out3]), a: kf([0, 1], [1, 0, inQ]) });
        }, r);
        this.shake(r, i === 2 ? 200 : 110, i === 2 ? 0.006 : 0.003);
      }, r);
    }
    if (s.id === 'arrow_storm' && r.place) { // one big shining arrow at a time drops straight down from high above onto the mark and blows the ground up
      const c = r.place, big = i % 3 === 2, fx = c.x + rnd(-70, 70), fy = c.y + rnd(-26, 26), H = 820, fall = 200, L = big ? 230 : 190;
      this.spr({ name: 'fall_arrow', x: fx, y: fy - H, oy: 0.98, depth: fy + 2, w: L * 0.62, glow: 0.4, life: fall, my: (u) => H * inQ(u), sy: kf([0, 1.2], [1, 1]), a: kf([0, 0.6], [0.2, 1], [1, 1]) });
      this.later(fall, () => {
        this.spr({ name: 'arrow_planted', x: fx, y: fy + 6, oy: 0.96, depth: fy + 1, w: big ? 150 : 120, glow: 0.2, life: 800, sy: kf([0, 0.6], [0.08, 1.05, out3], [0.2, 1]), a: kf([0, 1], [0.7, 1], [1, 0]) }); // it stands in the floor a moment
        this.spr({ name: 'earth_burst', x: fx, y: fy + 8, oy: 0.97, depth: fy + 3, w: big ? 240 : 180, life: 380, sy: kf([0, 0.3], [0.25, 1.05, out3], [1, 1.15]), sx: kf([0, 0.6], [0.3, 1, out3]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
        this.spr({ name: 'debris', x: fx, y: fy + 6, oy: 0.95, depth: fy + 4, w: big ? 220 : 160, life: 640, my: (u) => -30 * out(u), sy: kf([0, 0.4], [0.3, 1.1, out3]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
        this.floor('crater', fx, fy, big ? 220 : 170, 1500, { a: kf([0, 0], [0.04, 1], [0.6, 0.85], [1, 0]) });
        this.spr({ name: 'dust_roll', x: fx, y: fy + 10, oy: 0.9, depth: fy + 2, w: big ? 300 : 230, life: 700, sx: kf([0, 0.5], [1, 1.4, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
        if (big) { this.spr({ name: 'wind_dome', x: fx, y: fy + 8, oy: 0.95, depth: fy + 3.5, w: 280, add: true, life: 300, sx: kf([0, 0.3], [1, 1.25, out3]), sy: kf([0, 0.3], [1, 1.25, out3]), a: kf([0, 0.7], [1, 0, inQ]) }); }
        this.leaves(fx, fy - 20, big ? 10 : 6, 60, { up: 150, life: 800 });
        this.shake(r, big ? 170 : 100, big ? 0.007 : 0.0035);
      }, r);
    }
    if (s.id === 'bow_haste') { // the arrow in the ground bursts: the earth blows up in green light and throws the foe up
      const sh = r.hits[i].shape as { bias?: number }, gx = r.origin.x + a.x * (sh.bias ?? 200), gy = r.origin.y + a.y * (sh.bias ?? 200);
      this.spr({ name: 'geyser', x: gx, y: gy + 8, oy: 0.97, depth: gy + 3, w: 190, glow: 0.3, life: 560, sy: kf([0, 0.2], [0.25, 1.1, out3], [1, 1.2]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      this.spr({ name: 'earth_burst', x: gx, y: gy + 8, oy: 0.97, depth: gy + 3.5, w: 230, life: 500, sy: kf([0, 0.3], [0.25, 1.05, out3]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      this.spr({ name: 'debris', x: gx, y: gy + 6, oy: 0.95, depth: gy + 4, w: 200, life: 640, my: (u) => -30 * out(u), sy: kf([0, 0.4], [0.3, 1.1, out3]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
      this.floor('crater', gx, gy, 200, 1400, { a: kf([0, 0], [0.04, 1], [0.6, 0.85], [1, 0]) });
      this.spr({ name: 'dust_roll', x: gx, y: gy + 10, oy: 0.9, depth: gy + 2, w: 260, life: 700, sx: kf([0, 0.5], [1, 1.4, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
      this.leaves(gx, gy - 20, 12, 50, { up: 160, life: 900 });
      this.shake(r, 160, 0.006);
    }
    if (s.id === 'eagle_arrow' && i === 0) { /* the eagle sweep is scheduled from the cast */ }
    void o;
  }

  // ------------------------------------------------------------------ skills with their own staging

  private thunderCharge(r: CastRun): void {
    const T = r.timings, side = sideOf(r), hits = r.hits.map((h) => T.startup + h.at);
    // hanging in the air: the three lightning arrows themselves gather at the bow, crackling brighter — each one leaves as it is loosed
    hits.forEach((at, k) => {
      const tilt = (k - 1) * 12;
      this.spr({ name: 'arrow_storm', w: 190, life: at, follow: this.at(r.attackerId, side, 60, 58 + (k - 1) * 16), dz: 6 + k * 0.1, flipX: side < 0, angle: side * (18 + tilt), add: true, glow: 0.4, run: r,
        sx: kf([0, 0], [0.15, 0.3], [0.9, 1, out]), sy: kf([0, 0], [0.15, 0.6], [0.9, 1, out]), a: kf([0, 0], [0.15, 0.7], [0.97, 1], [1, 0]) });
    });
    for (let k = 0; k < 12; k++) this.later(T.startup + 120 + k * (hits[0] - T.startup - 120) / 12, () => {
      const q = this.me(r), bx = q.x + side * 40, by = q.y - q.z - 58, an = rnd(0, Math.PI * 2), rr = rnd(30, 60);
      this.bolt('arc_small', { x: bx, y: by }, { x: bx + Math.cos(an) * rr, y: by + Math.sin(an) * rr }, { thick: 24, life: 130 });
    }, r);
    this.later(hits[0] - 300, () => { if (r.own) this.ctx.cam().shake(300, 0.002); }, r);
  }

  /** Beats a spirit eagle's wings: up, level, down, level … (one frame each 80 ms). */
  private flap(im: Phaser.GameObjects.Image | null, delay: number, phase: number): void {
    if (!im) return;
    const seq = ['eagle_up', 'eagle_glide', 'eagle_down', 'eagle_glide'];
    let t = -delay;
    this.add({ t: 0, step: (dt) => { if (!im.active) return false; t += dt; if (t >= 0) im.setFrame(seq[(Math.floor(t / 80) + phase) % 4], false, false); return true; } });
  }

  private spiritBow(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    let t = 0, on = true, shots = 0;
    const alive = () => on && r.phase !== 'done';
    // a great spirit bow of light floats beside her, a pillar of green light under it and its emblem behind
    this.spr({ name: 'aura_green', w: 120, oy: 0.92, follow: this.at(r.attackerId, 0, 0, -6), dz: -1, life: T.startup + T.active + 200, add: true, glow: 0.2, run: r, alive, a: kf([0, 0], [0.05, 0.75], [0.95, 0.75], [1, 0]) });
    const emb = this.spr({ name: 'emblem', w: 150, follow: this.at(r.attackerId, side, 70, 72), dz: 5, add: true, run: r, alive, life: T.startup + T.active + 200, a: kf([0, 0], [0.05, 0.45], [0.95, 0.45], [1, 0]), rot: (u) => side * 60 * u }); void emb;
    const tilt = () => (r.aim.y < -0.3 ? (Math.abs(r.aim.x) > 0.2 ? 45 : 80) : 0); // level, 45° up or (nearly) straight up
    const bowAt = (): Pt | null => { const c = this.ctx.casterPos(r.attackerId); if (!c) return null; const sd = r.aim.x < -0.01 ? -1 : 1, tr = (tilt() * Math.PI) / 180;
      return { x: c.x + sd * (30 + 40 * Math.cos(tr)), y: c.y - c.z - 72 - 40 * Math.sin(tr), d: c.y }; };
    const draw = this.spr({ name: 'bow_drawn', w: 170, life: T.startup + T.active + 200, follow: bowAt, dz: 6, add: true, glow: 0.3, run: r, flipX: side < 0,
      alive, rot: () => -(r.aim.x < -0.01 ? -1 : 1) * tilt(), sx: kf([0, 0.3], [0.08, 1, out3]), sy: kf([0, 0.3], [0.08, 1, out3]), a: kf([0, 0], [0.05, 1], [0.95, 1], [1, 0]) });
    // the bow stands still beside her (it never turns); a small flash at it on every arrow
    this.add({ t: 0, step: (dt) => {
      t += dt; if (!draw?.active || r.phase === 'recovery' || r.phase === 'done') { on = false; return false; }
      const e = t - T.startup, n = Math.floor(e / 125);
      if (e > 0 && n > shots) { shots = n; const b = bowAt(); if (b) { const sd = r.aim.x < -0.01 ? -1 : 1, tr = (tilt() * Math.PI) / 180;
        draw?.setFlipX(sd < 0); this.pop('arrow_glint', b.x + sd * 30 * Math.cos(tr), b.y - 30 * Math.sin(tr) + rnd(-10, 10), 34, { life: 120, depth: b.d + 7 }); } }
      return true;
    } });
    this.later(T.startup, () => { const q = this.me(r); this.pop('sparkles', q.x + side * 70, q.y - q.z - 72, 120, { life: 500 }); this.floor('shock_ring', q.x, q.y, 140, 380, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) }); }, r);
  }

  private bindingRoots(r: CastRun): void {
    const T = r.timings, a = r.aim, o = r.origin, len = (r.skill.hits[0].shape as { length?: number }).length ?? 560;
    // charging: roots gather under her feet
    this.floor('root_tangle', o.x, o.y, 170, T.startup + 300, { run: r, s: kf([0, 0.2], [0.9, 1, out]), a: kf([0, 0], [0.2, 0.9], [0.9, 0.9], [1, 0]) });
    this.leaves(o.x, o.y - 10, 6, 30, { delay: T.startup * 0.5 });
    // release: a trail of small roots, sprouts and leaves grows out of the floor one after another, outward from her; it stops at a stone block
    const lv = level(a.x, a.y), steps = 14, step = len / steps, grow = 620;
    this.later(T.startup, () => {
      for (let k = 0; k < steps; k++) {
        const d = 24 + k * step, cx = o.x + a.x * d, cy = o.y + a.y * d, dl = (k / steps) * grow;
        if (!clearLine(o.x, o.y, cx, cy, 30)) break;
        const n = 3 + (k % 2);
        for (let j = 0; j < n; j++) {
          const w = rnd(-110, 110), px = cx - a.y * w + a.x * rnd(-step * 0.4, step * 0.4), py = cy + a.x * w * 0.5;
          this.floor('root_long', px, py, rnd(70, 120), 4200 - dl, { delay: dl + rnd(0, 120), angle: lv.ang + rnd(-35, 35), flip: Math.random() < 0.5, run: r, depth: GROUND + 2.5,
            sx: kf([0, 0.05], [0.12, 1, out3]), a: kf([0, 0], [0.06, 0.95], [0.9, 0.95], [1, 0]) });
        }
        if (k % 2 === 0) this.floor('root_tangle', cx, cy, rnd(70, 100), 4000 - dl, { delay: dl + 60, run: r, depth: GROUND + 2.4, s: kf([0, 0.1], [0.15, 1, out3]), a: kf([0, 0], [0.08, 0.7], [0.9, 0.7], [1, 0]) });
        this.later(dl, () => this.leaves(cx, cy - 4, 3, 50, { life: 900 }), r);
      }
      this.later(grow * 0.5, () => this.shake(r, 120, 0.002), r);
    }, r);
  }

  private tree(r: CastRun): void {
    const T = r.timings, o = r.origin, life = 20000, tx = o.x, ty = o.y - 46, grow = T.startup + 250;
    this.later(T.startup * 0.2, () => this.spr({ name: 'pillar', x: tx, y: ty + 8, oy: 0.97, depth: ty, w: 160, h: 520, add: true, life: 700, sy: kf([0, 0.2], [0.3, 1, out3]), a: kf([0, 0.9], [1, 0, inQ]) }));
    this.floor('root_tangle', tx, ty + 6, 260, T.startup + life, { s: kf([0, 0.2], [0.03, 1, out3]), a: kf([0, 0], [0.02, 0.9], [0.97, 0.9], [1, 0]) });
    this.floor('leaf_ring', tx, ty + 6, 300, T.startup + life, { add: true, s: kf([0, 0.3], [0.03, 1, out3]), a: (u) => kf([0, 0], [0.02, 0.7], [0.97, 0.7], [1, 0])(u) * (0.8 + 0.2 * Math.sin(u * 160)) });
    // it grows before your eyes: sprout, sapling, young tree, then the great tree
    const stages: [string, number, number, number][] = [['tree_1', 0, 0.3, 150], ['tree_2', 0.22, 0.55, 230], ['tree_3', 0.47, 0.85, 330]];
    for (const [nm, t0, t1, w] of stages) this.spr({ name: nm, x: tx, y: ty + 8, oy: 0.97, depth: ty - 1, w, delay: grow * t0, life: grow * (t1 - t0), glow: 0.2, sy: kf([0, 0.7], [0.4, 1, out3]), a: kf([0, 0], [0.2, 1], [0.75, 1], [1, 0]) });
    const base = kf([0, 0], [0.01, 1], [0.94, 1], [1, 0]);
    let im: Phaser.GameObjects.Image | null = null;
    const tree = im = this.spr({ name: 'tree_4', x: tx, y: ty + 8, oy: 0.97, depth: ty - 1, w: 470, delay: grow * 0.78, life: grow * 0.22 + life, add: false, glow: 0.25,
      sy: kf([0, 0.75], [0.03, 1.04, out3], [0.05, 1]), sx: kf([0, 0.8], [0.03, 1, out3]), a: (u) => base(u) * ((im?.getData('fade') as number | undefined) ?? 1) }); // (see-through when someone stands behind it)
    if (tree) { this.trees.add(tree); tree.once('destroy', () => this.trees.delete(tree)); }
    this.later(T.startup, () => { this.floor('shock_ring', tx, ty, 200, 500, { add: true, s: kf([0, 0.4], [1, 1.3, out3]), a: kf([0, 1], [1, 0]) }); this.pop('sparkles', tx, ty - 200, 220, { life: 900 }); this.leaves(tx, ty - 260, 16, 140, { life: 1600, up: -40 }); });
    for (let k = 1; k < 10; k++) this.later(T.startup + k * 2000, () => this.leaves(tx, ty - 280, 3, 150, { life: 1800, up: -30 })); // a leaf drifts down now and then
    this.later(T.startup + life - 900, () => this.leaves(tx, ty - 260, 30, 160, { life: 1600, up: -60 }));
  }

  private eagleTide(r: CastRun): void {
    const T = r.timings, side = sideOf(r);
    // charging: the aim band on the floor turns with the aim and burns brighter; the emblem gathers at the bow
    let on = true;
    this.charge(r, 'emblem', 70, T.startup, { spin: 0, dx: 36 });
    this.floor('aim_band', 0, 0, 1120, T.startup, { add: true, glow: 0.3, ox: 0.02, run: r, alive: () => on && r.phase === 'startup', rot: () => Math.atan2(r.aim.y * 0.5, r.aim.x) * (180 / Math.PI),
      follow: () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x + r.aim.x * 30, y: c.y + r.aim.y * 30 } : null; },
      a: kf([0, 0], [0.1, 0.5], [0.95, 1]), sx: kf([0, 0.7], [1, 1]) });
    // keep the band turned to the live aim
    this.add({ t: 0, step: () => { if (r.phase !== 'startup') { on = false; return false; } return true; } });
    this.later(T.startup, () => {
      const q = this.me(r), a = r.aim, lv = level(a.x, a.y), x0 = q.x + a.x * 30, y0 = q.y + a.y * 30 - 60, len = 1880, ms = T.active + 1100;
      this.muzzle(r, 150);
      for (const [k, d, sc] of [[0, 0, 1], [-1, 110, 0.62], [1, 220, 0.62]] as const) {
        const px = -a.y * k * 170, py = a.x * k * 95;
        const eg = this.spr({ name: 'eagle_glide', x: x0, y: y0, depth: TOP - 4 + k, w: 420 * sc, ox: lv.flip ? 0.25 : 0.75, flipX: lv.flip, angle: lv.ang, add: true, glow: 0, life: ms - d, delay: d,
          mx: (u) => a.x * len * (0.15 * out(u) + 0.85 * u) + px * Math.min(1, u * 3), my: (u) => a.y * len * 0.5 * (0.15 * out(u) + 0.85 * u) + py * Math.min(1, u * 3) + Math.sin(u * 40) * 6, a: kf([0, 0], [0.06, 1], [0.5, 1], [1, 0, out]) });
        this.flap(eg, d, k * 2);
        this.spr({ name: 'feather_trail', x: x0, y: y0, depth: TOP - 5 + k, w: 260 * sc, ox: lv.flip ? 0 : 1, flipX: lv.flip, angle: lv.ang, add: true, life: ms - d, delay: d + 40,
          mx: (u) => a.x * (len * (0.15 * out(u) + 0.85 * u) - 190 * sc) + px * Math.min(1, u * 3), my: (u) => a.y * (len * (0.15 * out(u) + 0.85 * u) - 190 * sc) * 0.5 + py * Math.min(1, u * 3), a: kf([0, 0], [0.08, 0.55], [0.45, 0.5], [1, 0, out]) });
      }
      for (let k = 0; k < 12; k++) this.leaves(x0 + a.x * k * 150, y0 + 40 + a.y * k * 75, 4, 50, { delay: k * 70, dir: side });
      // the wind it leaves behind lingers along the path and fades away slowly
      for (let k = 0; k < 8; k++) {
        const d = 120 + k * 230, wx = x0 + a.x * d, wy = y0 + a.y * d * 0.5;
        this.spr({ name: 'wind_streaks', x: wx, y: wy, depth: TOP - 6, w: 300, flipX: lv.flip, angle: lv.ang, add: true, glow: 0.2, life: 1500, delay: 120 + k * 60,
          mx: (u) => a.x * 90 * out(u), my: (u) => a.y * 45 * out(u), a: kf([0, 0], [0.1, 0.65], [0.35, 0.55], [1, 0, out]) });
        this.floor('wind_ring', wx, wy + 50, 200, 1400, { add: true, delay: 160 + k * 60, s: kf([0, 0.5], [1, 1.3, out3]), a: kf([0, 0], [0.12, 0.45], [1, 0, out]) });
      }
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
    const life = T.startup * 0.7 + T.active + 500;
    // the sky opens: storm light breaks through the clouds and a great rune of arrows turns high above
    this.later(T.startup * 0.3, () => {
      const v = this.ctx.cam().worldView, cx = v.centerX, cy = v.y + v.height * 0.14;
      for (const dx of [-0.27, 0.27]) this.spr({ name: 'sky_clouds', x: cx + dx * v.width, y: cy, depth: TOP + 1, w: v.width * 0.6, add: true, life, sy: () => 0.6, a: kf([0, 0], [0.12, 0.75], [0.85, 0.75], [1, 0]) });
      this.spr({ name: 'sky_rune', x: cx, y: cy + 30, depth: TOP + 2, w: v.width * 0.62, add: true, glow: 0.35, life,
        sx: (u) => kf([0, 0.2], [0.1, 1, out3])(u) * (1 + 0.03 * Math.sin(u * 30)), sy: kf([0, 0.2], [0.1, 1, out3]), a: kf([0, 0], [0.08, 0.85], [0.88, 0.8], [1, 0]) });
    }, r);
    // six waves of volleys pour down over the whole screen; the arrows stand in the ground where they land
    for (let w = 0; w < 6; w++) this.later(T.startup + w * 200 - 180, () => {
      const v = this.ctx.cam().worldView;
      for (let k = 0; k < 5; k++) {
        const fx = v.x + (k + rnd(0.15, 0.85)) / 5 * v.width, fy = v.y + rnd(0.55, 0.93) * v.height, dl = rnd(0, 60);
        this.spr({ name: 'volley', x: fx - 300, y: fy - 420, ox: 0.9, oy: 0.95, depth: fy + 2, w: 230, glow: 0.3, life: 180, delay: dl, mx: (u) => 300 * u, my: (u) => 420 * inQ(u), a: kf([0, 0.6], [0.2, 1], [1, 1]) });
        this.later(dl + 180, () => {
          this.spr({ name: 'arrow_field', x: fx, y: fy + 6, oy: 0.95, depth: fy + 1, w: 210, glow: 0.2, life: 1500 - w * 150, a: kf([0, 1], [0.75, 0.9], [1, 0]) });
          this.pop('spark_s', fx, fy - 10, 90, { life: 220 });
          this.spr({ name: 'dust_roll', x: fx, y: fy + 10, oy: 0.9, depth: fy, w: 200, life: 500, sx: kf([0, 0.5], [1, 1.3, out3]), a: kf([0, 0.7], [1, 0, inQ]) });
        });
      }
      if (w >= 2) { // a radiant golden arrow drops straight down among them and blows the ground up
        const gx = v.x + rnd(0.2, 0.8) * v.width, gy = v.y + rnd(0.6, 0.9) * v.height;
        this.spr({ name: 'gold_arrow', x: gx, y: gy - 700, oy: 0.98, depth: gy + 2, w: 110, glow: 0.4, life: 180, my: (u) => 700 * inQ(u) });
        this.later(180, () => {
          this.spr({ name: 'gold_blast', x: gx, y: gy + 8, oy: 0.95, depth: gy + 3, w: 280, glow: 0.3, life: 460, sy: kf([0, 0.3], [0.25, 1.05, out3]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
          this.floor('gold_ring', gx, gy, 300, 460, { add: true, s: kf([0, 0.3], [1, 1.3, out3]), a: kf([0, 1], [1, 0, inQ]) });
          this.floor('crater', gx, gy, 220, 1300, { a: kf([0, 0], [0.04, 1], [0.6, 0.8], [1, 0]) });
          this.shake(r, 140, 0.005);
        });
      }
      this.shake(r, 120, 0.003);
    }, r);
    // the last wave: one giant golden arrow falls through a pillar of light onto the middle of the screen
    this.later(T.startup + 1420 - 260, () => {
      const v = this.ctx.cam().worldView, gx = v.centerX, gy = v.y + v.height * 0.78;
      this.spr({ name: 'sky_pillar', x: gx, y: gy + 10, oy: 0.97, depth: gy + 1, w: 260, h: v.height * 1.1, add: true, glow: 0.3, life: 900, sx: kf([0, 0.3], [0.2, 1, out3], [1, 1.3]), a: kf([0, 0], [0.15, 1], [0.6, 0.9], [1, 0, inQ]) });
      this.spr({ name: 'gold_arrow', x: gx, y: gy - 900, oy: 0.98, depth: gy + 4, w: 200, glow: 0.5, life: 260, my: (u) => 900 * inQ(u) });
      this.later(260, () => {
        this.spr({ name: 'gold_blast', x: gx, y: gy + 10, oy: 0.95, depth: gy + 5, w: 560, glow: 0.35, life: 700, sy: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.1]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
        this.floor('gold_ring', gx, gy, 520, 700, { add: true, s: kf([0, 0.3], [1, 1.6, out3]), a: kf([0, 1], [1, 0, inQ]) });
        this.floor('crater', gx, gy, 420, 2200, { a: kf([0, 0], [0.03, 1], [0.7, 0.85], [1, 0]) });
        this.spr({ name: 'debris', x: gx, y: gy + 6, oy: 0.95, depth: gy + 6, w: 420, life: 800, my: (u) => -50 * out(u), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
        this.spr({ name: 'dust_roll', x: gx, y: gy + 12, oy: 0.9, depth: gy + 2, w: 700, life: 900, sx: kf([0, 0.5], [1, 1.5, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
        this.shake(r, 460, 0.014); if (r.own) this.ctx.punch(0.07, 380);
      });
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
        if (back <= 0) { x = h.px + (h.dive.x - h.px) * out1; y = h.py + (h.dive.y - h.py) * out1; frame = 'hawk_strike'; }
        else { x = h.dive.x + (h.px - h.dive.x) * back; y = h.dive.y + (h.py - h.dive.y) * back; }
        d = h.dive.d + 3;
        if (h.dive.t >= 180 && h.dive.t - ms < 180) this.pop('feather_burst', h.dive.x, h.dive.y, 90, { life: 320 });
        if (back >= 1) h.dive = null;
      }
      const fr = this.ctx.scene.textures.getFrame(ARCHER_KIT, frame), w = frame === 'hawk_strike' ? 110 : 72;
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
    this.spr({ name: 'vine_column', x: t.x, y: t.y + 8, oy: 0.96, depth: t.y + 3, w: 200, h: 420, life: 720, add: false, glow: 0.3, sy: kf([0, 0.15], [0.22, 1.08, out3], [1, 1]), a: kf([0, 1], [0.7, 1], [1, 0, inQ]) }); // a tall column of vines
    this.spr({ name: 'vine_burst', x: t.x, y: t.y + 8, oy: 0.97, depth: t.y + 4, w: 260, life: 760, glow: 0.3, sy: kf([0, 0.1], [0.2, 1.1, out3], [1, 1.05]), sx: kf([0, 0.6], [0.2, 1, out3]), a: kf([0, 1], [0.7, 1], [1, 0, inQ]) });
    this.spr({ name: 'vine_spiral', x: t.x, y: t.y + 8, oy: 0.97, depth: t.y + 4.5, w: 170, life: 700, delay: 60, glow: 0.25, sy: kf([0, 0.1], [0.3, 1.15, out3], [1, 1.2]), a: kf([0, 0], [0.1, 1], [0.7, 0.9], [1, 0, inQ]) });
    this.spr({ name: 'debris', x: t.x, y: t.y + 6, oy: 0.95, depth: t.y + 5, w: 220, life: 640, my: (u) => -30 * out(u), sy: kf([0, 0.4], [0.3, 1.1, out3]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
    this.floor('crater', t.x, t.y, 230, 1400, { a: kf([0, 0], [0.04, 1], [0.6, 0.85], [1, 0]) });
    this.spr({ name: 'dust', x: t.x, y: t.y + 4, oy: 0.85, depth: t.y + 1, w: 220, life: 700, sx: kf([0, 0.5], [1, 1.4, out3]), a: kf([0, 0.85], [1, 0, inQ]) });
    this.floor('shock_ring', t.x, t.y, 2.4 * t.radius, 420, { add: true, s: kf([0, 0.4], [1, 1.25, out3]), a: kf([0, 1], [1, 0, inQ]) });
    this.leaves(t.x, t.y - 30, 18, 60, { up: 260, life: 1100 });
    this.shake(t.run, 240, 0.007);
  }

  // ------------------------------------------------------------------ arrows in flight

  projectile(p: Projectile): void {
    if (!this.ready) return;
    const id = p.skill.id;
    let iron = false;
    if (id === 'multi_shot') { const n = (this.fanCount.get(p.castId) ?? 0) + 1; this.fanCount.set(p.castId, n); iron = n % 2 === 0; if (n === 1) this.later(2000, () => this.fanCount.delete(p.castId)); } // between the green arrows: iron ones
    const kind = id === 'explosive_arrow' || iron ? 'arrow_heavy' : 'arrow_wind';
    const w = id === 'explosive_arrow' ? 110 : id === 'piercing_arrow' ? 56 : id === 'skyhunters_step' ? 80 : 86;
    const s = this.ctx.scene, fr = s.textures.getFrame(ARCHER_KIT, kind);
    const im = s.add.image(p.x, p.y - p.z, ARCHER_KIT, kind).setOrigin(0.92, 0.5).setDisplaySize(w, (w * fr.height) / fr.width).setAlpha(0);
    if (id === 'explosive_arrow') im.setTint(0xffc070, 0xffc070, 0xff8a30, 0xff8a30);
    if (iron) im.setTint(0xe8eef2, 0xe8eef2, 0x9aa8b2, 0x9aa8b2);
    const tr = s.add.image(p.x, p.y - p.z, ARCHER_KIT, 'arrow_streak').setOrigin(1, 0.5).setAlpha(0).setDisplaySize(10, 12);
    if (id === 'explosive_arrow') tr.setTint(0xffa040);
    im.setData('sx', im.scaleX);
    this.arrows.set(p, { im, tr, t: 0, kind, z0: p.z });
  }
  private stepArrows(dt: number): void {
    for (const [p, a] of this.arrows) {
      a.t += dt;
      let x = p.x, y = p.y - p.z - 18, ang = level(p.dx, p.dy).ang, flip = p.dx < -0.01; // drawn at the body's centre (the bow), the hit height stays the game's
      if (p.skill.id === 'skyhunters_step') { // the volley dives from the height steadily down onto the floor, then strikes it
        const zv = Math.max(0, a.z0 + 18 - p.travelled * 0.75); y = p.y - zv; const fall = zv > 0 ? 0.75 : 0;
        ang = Math.atan2(p.dy * 0.5 + fall, Math.abs(p.dx)) * (180 / Math.PI) * (flip ? -1 : 1);
        if (zv <= 0 && a.im.visible) { a.im.setVisible(false); a.tr?.setVisible(false); this.floorStrike(p.x, p.y, flip); }
      }
      if (p.loft) { // Spirit Bow shot up: a high arc straight above the floor where she stands, falling back down onto it
        const k = Math.min(1, p.travelled / p.range), H = p.loft === 2 ? 340 : 210, lift = 4 * H * k * (1 - k), slope = 4 * H * (1 - 2 * k) / p.range; // screen px up per px along
        y -= lift; const raw = Math.atan2(-slope, 1) * (180 / Math.PI); ang = flip ? -raw : raw;
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
    if (p.skill.id === 'explosive_arrow') { // a real fire blast: the painted fireball, a flash, a ring of fire on the floor, embers, smoke-dark scorch
      const y = end.y - p.z;
      this.sheet('afx-fire', end.x, y - 30, 250, [40, 50, 60, 80, 100, 120, 150, 180], { depth: end.y + 4 });
      this.pop('burst_crit', end.x, y - 16, 170, { life: 260, tint: 0xffa040 });
      this.floor('shock_ring', end.x, end.y, 220, 420, { add: true, tint: 0xff9a40, s: kf([0, 0.3], [1, 1.35, out3]), a: kf([0, 1], [1, 0, inQ]) });
      this.floor('scorch_ring', end.x, end.y, 170, 1800, { a: kf([0, 0.9], [0.6, 0.6], [1, 0]) });
      for (let k = 0; k < 10; k++) { const an = rnd(0, Math.PI * 2), d = rnd(40, 120); this.spr({ name: 'spark_cyan', x: end.x, y: y - 20, depth: TOP + 5, w: 26, tint: 0xffa040, add: true, life: rnd(400, 650), mx: (u) => Math.cos(an) * d * out(u), my: (u) => Math.sin(an) * d * 0.6 * out(u) - 40 * u + 90 * u * u, a: kf([0, 1], [1, 0]) }); }
      this.ctx.cam().shake(200, 0.006); this.ctx.punch(0.025, 200);
      return;
    }
    if (p.skill.id === 'skyhunters_step') { if (a.im.visible) this.floorStrike(end.x, end.y, p.dx < 0); return; }
    if (end.reason === 'cover') this.spr({ name: 'arrow_stuck', x: end.x, y: end.y - p.z + 4, oy: 0.9, depth: end.y + 1, w: 60, flipX: p.dx < 0, life: 1400, a: kf([0, 1], [0.8, 1], [1, 0]) });
    else if (end.reason !== 'target') this.pop('arrow_glint', end.x, end.y - p.z, 30, { life: 160 });
  }

  /** An arrow striking the floor: a burst of green light runs on along the ground, leaves fly, the arrow stays a moment. */
  private floorStrike(x: number, y: number, flip: boolean): void {
    this.spr({ name: 'arrow_stuck', x, y: y + 4, oy: 0.9, depth: y + 1, w: 54, flipX: flip, life: 900, a: kf([0, 1], [0.7, 1], [1, 0]) });
    this.spr({ name: 'leaf_spray', x: x + (flip ? -30 : 30), y: y - 8, depth: y + 2, w: 90, flipX: flip, life: 320, add: true, sx: kf([0, 0.5], [0.3, 1.1, out3]), a: kf([0, 1], [1, 0, inQ]) });
    this.floor('shock_ring', x, y, 80, 320, { add: true, s: kf([0, 0.4], [1, 1.2, out3]), a: kf([0, 1], [1, 0]) });
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
