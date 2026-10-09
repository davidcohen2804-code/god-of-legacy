// Gambler skill effects, drawn in code until the GPT sheets arrive (the gambler spec): charged playing cards that fly,
// stick and burst in electric fuchsia; a staff's thick motion bands; the casino's pieces (roulette wheel, dice, coin, slot
// machine). Presentation only — gameplay never reads any of this. Every effect runs on this module's own clock, so it
// stops with the hit-stop like the fight does.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { Projectile, V3 } from './HitGeometry';
import { type Card, type HandValue, SUIT_GLYPH, RANK_NAME, FUSE_MS, diceOf, rouletteOf, coinOf } from './Gamble';

const TOP = 100000, GROUND = 2, SQUASH = 0.45;
export const FUCHSIA = 0xff2bd6, FUCHSIA_2 = 0xff7ae6, VIOLET = 0x3a0a4a, GOLD = 0xffc94a, IVORY = 0xf4efe6;
const CARD_W = 30, CARD_H = 42;

export interface GambleCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  hand(id: string): { x: number; y: number } | null;
  targetPos(id: string): (V3 & { h?: number }) | null;
  callout(at: V3, text: string, color: string, row?: number): void;
  punch(amount?: number, ms?: number): void;
  darken(ms: number, alpha: number): void;
  shockwave(x: number, y: number, radius: number, color: number): void;
  crack(x: number, y: number, radius: number): void;
  dust(x: number, y: number, size: number, alpha?: number): void;
  freeze(ms: number): void;
  flash(color: number, alpha: number, ms: number): void;
}

type Step = (t: number, dt: number) => boolean;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);
const screenAng = (dx: number, dy: number) => Math.atan2(dy * SQUASH, dx) * (180 / Math.PI);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const out3 = (u: number) => 1 - Math.pow(1 - u, 3);

export class GamblerFx {
  private live: Step[] = [];
  private incoming: Step[] = [];
  private projs = new Map<Projectile, { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; trail: { x: number; y: number }[]; g: Phaser.GameObjects.Graphics; big: boolean; streak?: Phaser.GameObjects.Image | null }>();
  /** Cards stuck in a fighter / monster, drawn on it until they burst. */
  private stuck = new Map<string, { img: Phaser.GameObjects.Image; dx: number; dy: number; ang: number; at: number; t: number }[]>();
  /** The local gambler's Hand, fanned over his shoulder. */
  private handView: { cards: Phaser.GameObjects.Container[]; label?: Phaser.GameObjects.Text } = { cards: [] };
  private overloads = new Map<string, { until: number; g: Phaser.GameObjects.Graphics; glow: Phaser.GameObjects.Image }>();
  private lucks = new Map<string, { until: number; img: Phaser.GameObjects.Image }>();
  private clock = 0;
  ready = false;
  /** The painted cards (GPT sheet: kit/card_*.png) when loaded, else the ones drawn here; `u` scales a painted card to the drawn one's size. */
  private get painted(): boolean { return this.ctx.scene.textures.exists('gbk-card_back'); }
  private get BK(): string { return this.painted ? 'gbk-card_back' : 'gb-back'; }
  private get FK(): string { return this.painted ? 'gbk-card_face' : 'gb-face'; }
  private get acePic(): string { return this.painted ? 'gbk-card_ace' : 'gb-face'; }
  private get u(): number { return this.painted ? 60 / (this.ctx.scene.textures.get('gbk-card_back').getSourceImage().width || 60) : 1; }

  constructor(private ctx: GambleCtx) {
    const s = ctx.scene;
    if (!s.textures.exists('gb-cutin')) { s.load.image('gb-cutin', 'assets/final/heroes/gambler/cutin.png'); if (!s.load.isLoading()) s.load.start(); }
    this.makeTextures();
    this.ready = true;
  }

  // ------------------------------------------------------------------ textures (drawn once)

  private makeTextures(): void {
    const s = this.ctx.scene;
    if (!s.textures.exists('gb-back')) {
      const g = s.make.graphics({ x: 0, y: 0 }, false);
      const W = 60, H = 84;
      g.fillStyle(IVORY, 1).fillRoundedRect(0, 0, W, H, 7);
      g.fillStyle(VIOLET, 1).fillRoundedRect(4, 4, W - 8, H - 8, 5);
      g.lineStyle(2, GOLD, 0.9).strokeRoundedRect(7, 7, W - 14, H - 14, 4);
      g.lineStyle(1.5, GOLD, 0.55);
      for (let i = -H; i < W + H; i += 12) { g.lineBetween(i, 8, i + (H - 16), H - 8); g.lineBetween(i + (H - 16), 8, i, H - 8); }
      g.fillStyle(GOLD, 1); g.fillTriangle(W / 2, H / 2 - 13, W / 2 + 9, H / 2, W / 2, H / 2 + 13); g.fillTriangle(W / 2, H / 2 - 13, W / 2 - 9, H / 2, W / 2, H / 2 + 13);
      g.generateTexture('gb-back', W, H); g.destroy();
    }
    if (!s.textures.exists('gb-face')) {
      const g = s.make.graphics({ x: 0, y: 0 }, false);
      const W = 60, H = 84;
      g.fillStyle(IVORY, 1).fillRoundedRect(0, 0, W, H, 7);
      g.lineStyle(2, GOLD, 1).strokeRoundedRect(4, 4, W - 8, H - 8, 5);
      g.generateTexture('gb-face', W, H); g.destroy();
    }
    if (!s.textures.exists('gb-glow')) {
      const c = s.textures.createCanvas('gb-glow', 128, 128);
      if (c) {
        const x = c.getContext(), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.65)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 128, 128); c.refresh();
      }
    }
    if (!s.textures.exists('gb-coin')) {
      const g = s.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x8a5a10, 1).fillCircle(24, 24, 24); g.fillStyle(GOLD, 1).fillCircle(24, 24, 21); g.lineStyle(2, 0xfff0b0, 0.9).strokeCircle(24, 24, 16);
      g.fillStyle(0xfff3c4, 0.9).fillCircle(18, 17, 5);
      g.generateTexture('gb-coin', 48, 48); g.destroy();
    }
    if (!s.textures.exists('gb-chip')) {
      const g = s.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(FUCHSIA, 1).fillCircle(16, 16, 16); g.fillStyle(0x111111, 1).fillCircle(16, 16, 11); g.fillStyle(FUCHSIA, 1).fillCircle(16, 16, 7);
      g.lineStyle(3, GOLD, 1); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineBetween(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12, 16 + Math.cos(a) * 15.5, 16 + Math.sin(a) * 15.5); }
      g.generateTexture('gb-chip', 32, 32); g.destroy();
    }
  }

  // ------------------------------------------------------------------ little pieces

  private add(step: Step): void { this.incoming.push(step); }
  /** A piece that lives `life` ms; `f(u)` moves it (u 0..1); destroyed at the end. */
  private piece<T extends Phaser.GameObjects.GameObject>(o: T, life: number, f: (u: number, o: T) => void, delay = 0): T {
    (o as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(delay <= 0);
    this.add((t) => {
      if (t < delay) return true;
      (o as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(true);
      const u = (t - delay) / life;
      if (u >= 1 || !o.active) { o.destroy(); return false; }
      f(u, o); return true;
    });
    return o;
  }
  private glow(x: number, y: number, size: number, tint = FUCHSIA, depth = TOP + 2): Phaser.GameObjects.Image {
    return this.ctx.scene.add.image(x, y, 'gb-glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size, size).setDepth(depth);
  }
  /** A painted staff stroke (kit piece) at a point: pops in, swells, fades; mirrored when he faces left. */
  private stroke(name: string, x: number, y: number, w: number, side: number, life: number, depth: number, angle = 0, ox = 0.5, oy = 0.5): boolean {
    const k = this.kit(name, x, y, w, depth); if (!k) return false;
    k.setOrigin(side > 0 ? ox : 1 - ox, oy).setFlipX(side < 0).setAngle(side > 0 ? angle : -angle);
    const k0 = k.scale;
    this.piece(k, life, (u, o) => o.setScale(k0 * lerp(0.82, 1.06, out3(clamp01(u * 2.2)))).setAlpha(u < 0.15 ? u / 0.15 : u > 0.55 ? (1 - u) / 0.45 : 1));
    return true;
  }
  /** A launch beam rising from the floor (the painted one, or a plain bar). */
  private beam(x: number, y: number, h: number, life: number): void {
    const k = this.kit('k_beam', x, y, h * 0.85, y + 3);
    if (k) { k.setOrigin(0.5, 0.97); const k0 = k.scale; this.piece(k, life, (u, o) => o.setScale(k0 * lerp(0.6, 1.1, out3(u)), k0 * lerp(0.2, 1.05, out3(u))).setAlpha(1 - u * u)); return; }
    const b = this.ctx.scene.add.rectangle(x, y, h * 0.3, h, FUCHSIA, 0.7).setOrigin(0.5, 1).setDepth(y + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(b, life, (u, o) => o.setScale(lerp(0.4, 1.3, out3(u)), lerp(0.3, 1.1, out3(u))).setAlpha(1 - u));
  }
  /** A painted piece (GPT sheet, kit/<name>.png) as an additive image, or null when it is not loaded. */
  private kit(name: string, x: number, y: number, w: number, depth: number, add = true): Phaser.GameObjects.Image | null {
    const k = `gbk-${name}`, s = this.ctx.scene;
    if (!s.textures.exists(k)) return null;
    const im = s.add.image(x, y, k).setDepth(depth);
    if (add) im.setBlendMode(Phaser.BlendModes.ADD);
    im.setScale(w / im.width);
    return im;
  }
  /** A short pop of light. */
  private pop(x: number, y: number, size: number, tint = FUCHSIA, life = 260, delay = 0, depth = TOP + 2): void {
    const core = this.glow(x, y, size * 0.5, 0xffffff, depth + 0.1), halo = this.glow(x, y, size, tint, depth);
    this.piece(core, life * 0.7, (u, o) => o.setScale(lerp(0.4, 1.1, out3(u)) * (size * 0.5) / 128).setAlpha(1 - u), delay);
    this.piece(halo, life, (u, o) => o.setScale(lerp(0.5, 1.4, out3(u)) * size / 128).setAlpha((1 - u) * 0.9), delay);
    if (tint === FUCHSIA || tint === FUCHSIA_2) {
      const k = this.kit('k_pop', x, y, size * 1.1, depth + 0.05);
      if (k) { const k0 = k.scale, a0 = rnd(0, 360); this.piece(k, life, (u, o) => o.setScale(k0 * lerp(0.45, 1.15, out3(u))).setAngle(a0 + u * 30).setAlpha(1 - u * u), delay); }
    }
  }
  /** Card shards thrown out of a burst. */
  private shards(x: number, y: number, n: number, spread: number, life = 420, delay = 0, depth = TOP + 3): void {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(0.5, 1) * spread, spin = rnd(-720, 720), sc = rnd(0.18, 0.32);
      const im = this.ctx.scene.add.image(x, y, Math.random() < 0.5 ? this.BK : this.FK).setDepth(depth).setScale(this.u * (sc));
      this.piece(im, life, (u, o) => o.setPosition(x + Math.cos(a) * d * out3(u), y + Math.sin(a) * d * 0.6 * out3(u) + 40 * u * u).setAngle(spin * u).setAlpha(1 - u * u), delay);
    }
  }
  /** A burst: the kinetic charge going off (card-sized white core, fuchsia halo, shards). */
  burst(x: number, y: number, size = 90, delay = 0, depth = TOP + 3): void {
    const blast = size >= 140 ? this.kit('k_blast', x, y, size * 1.25, depth + 0.1) : null;
    if (blast) {
      const k0 = blast.scale, a0 = rnd(0, 360);
      this.piece(blast, 420, (u, o) => o.setScale(k0 * lerp(0.35, 1.2, out3(u))).setAngle(a0 + u * 20).setAlpha(u < 0.6 ? 1 : (1 - u) / 0.4), delay);
      const core = this.glow(x, y, size * 0.6, 0xffffff, depth + 0.2); this.piece(core, 200, (u, o) => o.setAlpha(1 - u), delay);
    } else this.pop(x, y, size, FUCHSIA, 300, delay, depth);
    this.shards(x, y, Math.round(size / 26), size * 0.8, 420, delay, depth);
    const ring = this.kit('k_ring', x, y + size * 0.15, size * 1.3, depth - 0.1);
    if (ring) { const k0 = ring.scale; this.piece(ring, 300, (u, o) => o.setScale(k0 * lerp(0.3, 1.2, out3(u))).setAlpha(1 - u), delay); }
    else { const e = this.ctx.scene.add.ellipse(x, y, size, size * 0.6).setStrokeStyle(4, FUCHSIA_2, 0.9).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD); this.piece(e, 260, (u, o) => o.setScale(lerp(0.3, 1.3, out3(u))).setAlpha(1 - u), delay); }
  }
  /** A card (back or face with a glyph) as a container. */
  private card(x: number, y: number, c: Card | null, scale: number, depth: number): Phaser.GameObjects.Container {
    const s = this.ctx.scene, box = s.add.container(x, y).setDepth(depth), u = this.u;
    if (!c) { box.add(s.add.image(0, 0, this.BK).setScale(scale * u)); return box; }
    const red = c.suit === 'H' || c.suit === 'D', col = c.joker ? '#c9a8ff' : red ? '#d0109e' : '#151018';
    const small = Math.round(20 * scale);
    if (this.painted) { // the painted face: its suit (or the ace / the joker), the rank in the corner
      const pic = c.joker ? 'gbk-card_joker' : c.rank === 14 && c.suit === 'S' ? 'gbk-card_ace' : `gbk-card_${c.suit}`;
      box.add(s.add.image(0, 0, pic).setScale(scale * u));
      if (!c.joker) box.add(s.add.text(-17 * scale, -27 * scale, RANK_NAME(c.rank), { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: `${small}px`, color: col, stroke: '#f4efe6', strokeThickness: 3 * scale }).setOrigin(0.5));
      return box;
    }
    box.add(s.add.image(0, 0, 'gb-face').setScale(scale));
    const big = Math.round(34 * scale);
    if (c.joker) {
      box.add(s.add.text(0, -2 * scale, '★', { fontFamily: 'Georgia, serif', fontSize: `${big}px`, color: '#ffc94a', stroke: '#3a0a4a', strokeThickness: 3 * scale }).setOrigin(0.5));
      box.add(s.add.text(0, 26 * scale, 'JOKER', { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: `${Math.round(10 * scale)}px`, color: '#3a0a4a' }).setOrigin(0.5));
    } else {
      box.add(s.add.text(0, 4 * scale, SUIT_GLYPH[c.suit], { fontFamily: 'Georgia, serif', fontSize: `${big}px`, color: col }).setOrigin(0.5));
      box.add(s.add.text(-17 * scale, -26 * scale, RANK_NAME(c.rank), { fontFamily: 'Georgia, serif', fontStyle: 'bold', fontSize: `${small}px`, color: col }).setOrigin(0.5));
    }
    return box;
  }
  /** A thick, soft band of motion light along an arc (a staff swing). */
  private swing(cx: number, cy: number, rad: number, from: number, to: number, life: number, thick = 26, depth = TOP + 2, delay = 0): void {
    const g = this.ctx.scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(g, life, (u, o) => {
      o.clear();
      const head = lerp(from, to, out3(clamp01(u * 1.8))), tail = lerp(from, to, out3(clamp01(u * 1.8 - 0.55)));
      const n = 14, a = 1 - u;
      for (let i = 0; i < n; i++) {
        const k0 = i / n, k1 = (i + 1) / n, a0 = lerp(tail, head, k0), a1 = lerp(tail, head, k1);
        o.lineStyle(thick * (0.35 + 0.65 * k1), i > n - 3 ? 0xffffff : FUCHSIA, a * (0.25 + 0.75 * k1));
        o.beginPath(); o.arc(cx, cy, rad, a0, a1, to < from); o.strokePath();
      }
    }, delay);
  }
  /** A straight thick band (a jab / thrust / fling). */
  private band(x: number, y: number, len: number, ang: number, life: number, thick = 20, depth = TOP + 2, delay = 0): void {
    const g = this.ctx.scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y).setAngle(ang);
    this.piece(g, life, (u, o) => {
      o.clear(); const L = len * out3(clamp01(u * 2)), a = 1 - u;
      o.fillStyle(FUCHSIA, 0.5 * a).fillRoundedRect(0, -thick / 2, L, thick, thick / 2);
      o.fillStyle(0xffffff, 0.85 * a).fillRoundedRect(L * 0.45, -thick / 5, L * 0.55, thick / 2.5, thick / 5);
    }, delay);
  }
  /** A ring on the floor (flattened). */
  private floorRing(x: number, y: number, r: number, color = FUCHSIA, life = 420, delay = 0, width = 6): void {
    if (color === FUCHSIA || color === FUCHSIA_2) {
      const k = this.kit('k_ring', x, y, r * 2.2, GROUND + 2);
      if (k) { const kx = k.scaleX, ky = (r * 2.2 * SQUASH) / k.height; this.piece(k, life, (u, o) => o.setScale(kx * lerp(0.2, 1, out3(u)), ky * lerp(0.2, 1, out3(u))).setAlpha(1 - u * u), delay); return; }
    }
    const e = this.ctx.scene.add.ellipse(x, y, r * 2, r * 2 * SQUASH).setStrokeStyle(width, color, 0.95).setDepth(GROUND + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(e, life, (u, o) => o.setScale(lerp(0.2, 1, out3(u))).setAlpha(1 - u * u), delay);
  }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** The point a cast aims at on the floor (bias px ahead). */
  private ahead(r: CastRun, bias: number): { x: number; y: number } { const o = this.me(r); return { x: o.x + r.aim.x * bias, y: o.y + r.aim.y * bias }; }

  // ------------------------------------------------------------------ the cast timeline

  cast(r: CastRun): void {
    const s = r.skill, T = r.timings, o = this.me(r), y0 = o.y - o.z, side = sideOf(r);
    const handGlow = (ms: number, size = 40) => { const h = this.ctx.hand(r.attackerId) ?? { x: o.x + side * 26, y: y0 - 70 }; const g = this.glow(h.x, h.y, size); this.piece(g, ms, (u, im) => im.setAlpha(0.5 + 0.5 * Math.sin(u * 20)).setScale((size / 128) * (1 + u * 0.4))); };
    switch (s.id) {
      case 'charged_deal': handGlow(T.startup + 60, 46); break;
      case 'fuse_slam': this.fuseFloor(r); break;
      case 'riffle_shuffle': this.shuffle(r); break;
      case 'rotor_staff': this.rotor(r); break;
      case 'showdown': this.showdownRow(r); break;
      case 'coin_flip': this.coin(r); break;
      case 'roulette_wheel': this.roulette(r); break;
      case 'dice_bomb': this.dice(r); break;
      case 'kinetic_grab': handGlow(T.startup + T.active, 50); break;
      case 'ace_in_the_hole': handGlow(T.startup + 40, 44); break;
      case 'lady_luck': this.ladyLuckCast(r); break;
      case 'pickup_52': handGlow(T.startup, 60); this.deckSpray(r); break;
      case 'grand_slam': this.slamCharge(r); break;
      case 'kinetic_overload': this.overloadCast(r); break;
      case 'wild_card': this.wildCard(r); break;
      case 'jackpot': this.jackpot(r); break;
      case 'staff_vault': this.vault(r); break;
    }
  }

  /** The release (active start). */
  active(r: CastRun): void {
    const o = this.me(r), y0 = o.y - o.z, side = sideOf(r);
    if (r.skill.id === 'grand_slam') {
      if (!this.stroke('s_homerun', o.x + side * 70, y0 - 64, 260, side, 420, o.y + 2)) this.swing(o.x - side * 10, y0 - 60, 120, side > 0 ? Math.PI * 1.15 : -Math.PI * 0.15, side > 0 ? Math.PI * 2.05 : -Math.PI * 1.05, 360, 46, o.y + 2);
      this.ctx.cam().shake(220, 0.012); this.ctx.freeze(90);
    }
  }

  /** One hit of a cast as it fires (the swing that goes with it). */
  hit(r: CastRun, i: number, _o: V3): void {
    const s = r.skill, o = this.me(r), y0 = o.y - o.z, side = sideOf(r), d = o.y + 2;
    switch (s.id) {
      case 'cut_the_deck': {
        const st = r.stage ?? 0;
        if (st === 0) { if (!this.stroke('s_thrust', o.x + side * 18, y0 - 58, 150, side, 220, d, 0, 0.05, 0.5)) this.band(o.x + side * 20, y0 - 58, 110, side > 0 ? 0 : 180, 200, 18, d); }
        else if (st === 1) { if (!this.stroke('s_swing', o.x + side * 40, y0 - 56, 160, side, 260, d)) this.swing(o.x, y0 - 58, 70, side > 0 ? -0.9 : Math.PI + 0.9, side > 0 ? 0.9 : Math.PI - 0.9, 230, 22, d); }
        else if (st === 3) { if (!this.stroke('s_rise', o.x + side * 42, y0 - 70, 120, side, 300, d)) this.swing(o.x + side * 8, y0 - 40, 78, side > 0 ? 0.9 : Math.PI - 0.9, side > 0 ? -1.3 : Math.PI + 1.3, 260, 26, d); }
        break;
      }
      case 'staff_vault': if (i === 1) { this.floorRing(o.x, o.y, 90); this.pop(o.x + side * 30, y0 - 40, 90); } break;
      case 'fuse_slam': this.scar(o.x + r.aim.x * 70, o.y + r.aim.y * 70, 90); this.ctx.shockwave(o.x + r.aim.x * 70, o.y + r.aim.y * 70, 140, FUCHSIA); this.ctx.cam().shake(140, 0.006); break;
      case 'riffle_shuffle': if (i === r.hits.length - 1) { this.floorRing(o.x, o.y, 170, FUCHSIA_2, 380); this.shards(o.x, y0 - 50, 18, 200, 520); } break;
      case 'rotor_staff': if (i === r.hits.length - 1) { if (!this.stroke('s_thrust', o.x + side * 24, y0 - 56, 210, side, 300, d, 0, 0.05, 0.5)) this.band(o.x + side * 30, y0 - 56, 150, side > 0 ? 0 : 180, 260, 30, d); this.pop(o.x + side * 150, y0 - 56, 120); } break;
      case 'kinetic_grab': if (i === 1) this.stroke('s_heavy', o.x + side * 50, y0 - 64, 180, side, 300, d); break;
      case 'grand_slam': break;
      case 'dice_bomb': this.diceBlast(r, i); break;
      case 'roulette_wheel': if (i === r.hits.length - 1) this.rouletteEnd(r); break;
      case 'pickup_52': if (i > 0) { const p = this.ahead(r, 90 + (i - 1) * 95); this.burst(p.x, p.y - 30, i === 4 ? 200 : 130, 0, p.y + 2); if (i === 4) this.ctx.cam().shake(200, 0.009); } break;
      case 'jackpot': this.jackpotBlast(r, i); break;
      case 'lady_luck': this.floorRing(o.x, o.y, 150, GOLD, 520); break;
      case 'kinetic_overload': this.floorRing(o.x, o.y, 170, FUCHSIA, 420); this.pop(o.x, y0 - 60, 220, FUCHSIA, 420); break;
      case 'showdown': this.showdownBurst(r, i); break;
    }
  }

  // ------------------------------------------------------------------ cards in flight and in the foe

  projectile(p: Projectile): void {
    const s = this.ctx.scene, big = p.skill.id === 'ace_in_the_hole';
    const img = s.add.image(p.x, p.y - p.z, big ? this.acePic : this.BK).setScale(this.u * (big ? 0.62 : 0.36)).setDepth(p.y + 3);
    const glow = this.glow(p.x, p.y - p.z, big ? 110 : 60, FUCHSIA, p.y + 2);
    const g = s.add.graphics().setDepth(p.y + 1).setBlendMode(Phaser.BlendModes.ADD);
    const streak = this.kit('k_streak', p.x, p.y - p.z, big ? 300 : 150, p.y + 2);
    if (streak) streak.setOrigin(0.97, 0.52).setAngle(screenAng(p.dx, p.dy)).setFlipY(p.dx < -0.01);
    this.projs.set(p, { img, glow, trail: [], g, big, streak });
  }
  private stepProjectiles(dt: number): void {
    for (const [p, v] of this.projs) {
      const x = p.x, y = p.y - p.z;
      v.img.setPosition(x, y).setDepth(p.y + 3);
      if (v.big) v.img.setAngle(screenAng(p.dx, p.dy) + 90); else v.img.setAngle(v.img.angle + dt * 1.4);
      v.glow.setPosition(x, y);
      if (v.streak) { v.streak.setPosition(x, y).setDepth(p.y + 2); v.g.clear(); continue; }
      v.trail.push({ x, y }); if (v.trail.length > (v.big ? 14 : 7)) v.trail.shift();
      v.g.clear();
      for (let i = 1; i < v.trail.length; i++) { const k = i / v.trail.length; v.g.lineStyle((v.big ? 14 : 7) * k, k > 0.8 ? 0xffffff : FUCHSIA, 0.7 * k); v.g.lineBetween(v.trail[i - 1].x, v.trail[i - 1].y, v.trail[i].x, v.trail[i].y); }
    }
  }
  projectileEnd(p: Projectile): void {
    const v = this.projs.get(p); if (!v) return;
    this.projs.delete(p);
    v.img.destroy(); v.glow.destroy(); if (v.streak) this.piece(v.streak, 140, (u, o) => o.setAlpha(1 - u));
    this.piece(v.g, 160, (u, o) => o.setAlpha(1 - u));
    const end = p.end ?? { x: p.x, y: p.y, reason: 'range' as const };
    if (end.reason === 'cover') this.burst(end.x, end.y - p.z, 70, 0, end.y + 2);
  }

  /** Cards stuck in a target (by id): they blink faster and faster, then burst after the fuse. `double`: Kinetic Overload. */
  stick(id: string, n: number, double = false): void {
    const tp = this.ctx.targetPos(id); if (!tp) return;
    const s = this.ctx.scene, list = this.stuck.get(id) ?? [];
    for (let i = 0; i < n; i++) {
      const img = s.add.image(0, 0, this.BK).setScale(this.u * (0.26)).setDepth(TOP + 1);
      list.push({ img, dx: rnd(-14, 14), dy: rnd(-(tp.h ?? 90) * 0.75, -(tp.h ?? 90) * 0.3), ang: rnd(-40, 40), at: this.clock + FUSE_MS + i * 70, t: 0 });
      if (double) list.push({ img: s.add.image(0, 0, this.BK).setScale(this.u * (0.22)).setDepth(TOP + 1), dx: rnd(-14, 14), dy: rnd(-(tp.h ?? 90) * 0.75, -(tp.h ?? 90) * 0.3), ang: rnd(-40, 40), at: this.clock + FUSE_MS + 260 + i * 70, t: 0 });
    }
    while (list.length > 8) list.shift()?.img.destroy();
    this.stuck.set(id, list);
  }
  /** A staff blow: every card stuck in the target goes off now (white flash first with Short Fuse). */
  detonate(id: string, n: number, hot: boolean): void {
    const list = this.stuck.get(id) ?? [], tp = this.ctx.targetPos(id);
    for (const c of list) { if (hot) this.pop(c.img.x, c.img.y, 60, 0xffffff, 140); this.burst(c.img.x, c.img.y, 80); c.img.destroy(); }
    this.stuck.delete(id);
    if (tp && n > 0) {
      const y = tp.y - tp.z - (tp.h ?? 90) * 0.5;
      this.burst(tp.x, y, 90 + n * 22); this.ctx.freeze(40 + n * 10);
      this.ctx.callout({ x: tp.x, y: tp.y, z: tp.z + 10 }, n >= 3 ? `CHAIN BURST ×${n}!` : `BURST ×${n}`, '#ff7ae6', 1);
    }
  }
  private stepStuck(): void {
    for (const [id, list] of this.stuck) {
      const tp = this.ctx.targetPos(id);
      const keep = list.filter((c) => {
        if (!tp) { c.img.destroy(); return false; }
        c.img.setPosition(tp.x + c.dx, tp.y - tp.z + c.dy).setAngle(c.ang);
        const left = c.at - this.clock;
        if (left <= 0) { this.burst(c.img.x, c.img.y, 70); c.img.destroy(); return false; }
        const blink = Math.sin((this.clock / Math.max(30, left * 0.25)) * Math.PI) > 0;
        c.img.setTint(blink ? 0xffffff : FUCHSIA);
        return true;
      });
      if (keep.length) this.stuck.set(id, keep); else this.stuck.delete(id);
    }
  }

  /** A hit that landed (the attacker's view): a fuchsia burst with card shards; heavier for heavy / signature hits. */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    const y = at.y - at.z, size = heavy ? 120 : 64;
    this.pop(at.x, y, size * (crit ? 1.4 : 1), crit ? 0xffffff : FUCHSIA, heavy ? 320 : 200);
    if (heavy || crit) this.shards(at.x, y, heavy ? 6 : 3, size * 0.9);
    if (s.id === 'grand_slam') this.comet(at);
    if (s.id === 'kinetic_grab' && hit.reaction.grab && !hit.reaction.pin) this.thrownBomb(at);
  }
  private comet(at: V3): void {
    const y = at.y - at.z, g = this.ctx.scene.add.graphics().setDepth(TOP + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(g, 420, (u, o) => { o.clear(); const L = 220 * out3(u), a = 1 - u; o.fillStyle(FUCHSIA, 0.6 * a).fillTriangle(at.x, y - 18, at.x, y + 18, at.x - L, y); o.fillStyle(0xffffff, 0.8 * a).fillTriangle(at.x, y - 7, at.x, y + 7, at.x - L * 0.6, y); });
    this.ctx.flash(0xffffff, 0.25, 120);
  }
  private thrownBomb(at: V3): void { const g = this.glow(at.x, at.y - at.z, 140); this.piece(g, 600, (u, o) => o.setAlpha(0.6 + 0.4 * Math.sin(u * 30))); }

  // ------------------------------------------------------------------ the Hand over the gambler's shoulder

  /** Draw the local gambler's Hand (cards fanned over his shoulder) and, with Card Counting, what it is worth. */
  showHand(cards: Card[], value: HandValue | null, counting: boolean): void {
    for (const c of this.handView.cards) c.destroy();
    this.handView.label?.destroy(); this.handView.label = undefined;
    this.handView.cards = cards.map((c) => this.card(0, 0, c, 0.42, TOP + 6));
    if (counting && value) this.handView.label = this.ctx.scene.add.text(0, 0, value.label, { fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold', fontSize: '13px', color: '#ffc94a', stroke: '#1a0612', strokeThickness: 4, resolution: 2 }).setOrigin(0.5, 1).setDepth(TOP + 6);
  }
  /** Each frame: the fan follows him. */
  placeHand(at: { x: number; y: number } | null, face: number): void {
    const n = this.handView.cards.length;
    this.handView.cards.forEach((c, i) => {
      if (!at) { c.setVisible(false); return; }
      const k = n > 1 ? i / (n - 1) - 0.5 : 0;
      c.setVisible(true).setPosition(at.x - face * 22 + k * 46, at.y - 4 + Math.abs(k) * 10).setAngle(k * 38);
    });
    if (this.handView.label) { this.handView.label.setVisible(!!at); if (at) this.handView.label.setPosition(at.x - face * 22, at.y - 40); }
  }
  /** A card dealt: it flies in from the hit to the fan. */
  dealt(from: V3 | null, to: { x: number; y: number } | null, c: Card): void {
    if (!from || !to) return;
    const im = this.card(from.x, from.y - from.z - 40, c, 0.5, TOP + 7);
    this.piece(im, 320, (u, o) => o.setPosition(lerp(from.x, to.x, out3(u)), lerp(from.y - from.z - 40, to.y, out3(u)) - Math.sin(u * Math.PI) * 40).setScale(lerp(1, 0.84, u)).setAngle(u * 360));
  }

  // ------------------------------------------------------------------ the skills

  private vault(r: CastRun): void {
    const o0 = this.me(r), T = r.timings, side = sideOf(r);
    this.ctx.dust(o0.x, o0.y, 70);
    this.add((t) => { if (t < T.startup) return true; this.stroke('s_vault', o0.x + r.aim.x * 110, o0.y + r.aim.y * 110 - o0.z - 80, 220, side, T.active + 240, o0.y + 2, 0, 0.5, 0.5); return false; });
    let last: { x: number; y: number } | null = null;
    const g = this.ctx.scene.add.graphics().setDepth(TOP + 1).setBlendMode(Phaser.BlendModes.ADD);
    const pts: { x: number; y: number }[] = [];
    this.piece(g, T.startup + T.active + 260, (u, o) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (c && u < (T.startup + T.active) / (T.startup + T.active + 260)) { const p = { x: c.x, y: c.y - c.z - 50 }; if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 4) { pts.push(p); last = p; } }
      o.clear();
      for (let i = 1; i < pts.length; i++) { const k = i / pts.length; o.lineStyle(26 * k, FUCHSIA, (1 - u) * 0.55 * k); o.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y); }
    });
  }

  private fuseFloor(r: CastRun): void {
    const T = r.timings, p = this.ahead(r, 70);
    // the charged floor: a pulsing scar until it erupts 0.8s after the blow
    const e = this.ctx.scene.add.ellipse(p.x, p.y, 230, 230 * SQUASH, FUCHSIA, 0.25).setDepth(GROUND + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(e, 820, (u, o) => o.setAlpha(0.15 + 0.35 * Math.abs(Math.sin(u * u * 26))).setScale(0.6 + u * 0.4), T.startup);
    this.add((t) => {
      if (t < T.startup + 800) return true;
      this.floorRing(p.x, p.y, 120, FUCHSIA_2, 380);
      this.beam(p.x, p.y, 280, 360);
      this.burst(p.x, p.y - 40, 150, 0, p.y + 3);
      for (let i = 0; i < 6; i++) { const im = this.ctx.scene.add.image(p.x + rnd(-60, 60), p.y, this.BK).setScale(this.u * (0.3)).setDepth(p.y + 4); const vy = rnd(220, 340); this.piece(im, 600, (u, o) => o.setPosition(o.x, p.y - vy * u + 300 * u * u).setAngle(u * 600).setAlpha(1 - u)); }
      this.ctx.cam().shake(160, 0.007);
      return false;
    });
  }

  private shuffle(r: CastRun): void {
    const T = r.timings, n = 16, life = T.startup + T.active;
    const vx = this.kit('k_vortex', r.origin.x, r.origin.y, 300, GROUND + 2);
    if (vx) { const kx = vx.scaleX, ky = (300 * SQUASH) / vx.height; this.add((t) => { const c = this.ctx.casterPos(r.attackerId); if (t >= life || !c) { this.piece(vx, 200, (u, o) => o.setAlpha(1 - u)); return false; } vx.setPosition(c.x, c.y).setScale(kx * Math.min(1, t / 200), ky * Math.min(1, t / 200)).setAlpha(0.9); return true; }); }
    const cards = Array.from({ length: n }, () => this.ctx.scene.add.image(0, 0, this.BK).setScale(this.u * (0.34)));
    this.add((t) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (t >= life || !c) { const at = c ?? r.origin; for (const im of cards) { const a = rnd(0, Math.PI * 2); const x0 = im.x, y0 = im.y; this.piece(im, 360, (u, o) => o.setPosition(x0 + Math.cos(a) * 160 * u, y0 + Math.sin(a) * 70 * u).setAlpha(1 - u)); } void at; return false; }
      const grow = clamp01(t / Math.max(1, T.startup)), R = 40 + 110 * grow;
      cards.forEach((im, i) => {
        const half = i % 2, a = (i / n) * Math.PI * 2 + (half ? 1 : -1) * t * 0.012;
        const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R * SQUASH, h = c.z + 46 + Math.sin(t * 0.02 + i) * 8;
        im.setPosition(x, y - h).setDepth(y + (Math.sin(a) > 0 ? 3 : -3)).setAngle(a * 57 + 90).setScale(this.u * 0.34, this.u * 0.34 * (0.55 + 0.45 * Math.abs(Math.cos(a))));
      });
      return true;
    });
  }

  private rotor(r: CastRun): void {
    const T = r.timings, g = this.ctx.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    let disc: Phaser.GameObjects.Image | null | undefined;
    this.add((t) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (t >= T.startup + T.active || !c) { this.piece(g, 160, (u, o) => o.setAlpha(1 - u)); if (disc) this.piece(disc, 160, (u, o) => o.setAlpha(1 - u)); return false; }
      if (t < T.startup) return true;
      const side = sideOf(r), cx = c.x + side * 44, cy = c.y - c.z - 58, R = 62, a0 = t * 0.045;
      g.clear().setDepth(c.y + 4);
      if (this.ctx.scene.textures.exists('gbk-s_disc')) {
        disc ??= this.kit('s_disc', cx, cy, 2.2 * R, c.y + 4);
        if (disc) { const w = 2.2 * R / disc.width; disc.setPosition(cx, cy).setDepth(c.y + 4).setAngle(90).setScale(w * (0.95 + 0.05 * Math.sin(t * 0.05)), w * 0.55).setFlipY(Math.floor(t / 45) % 2 === 1); }
        if (Math.random() < 0.25) this.pop(cx + rnd(-10, 10), cy + rnd(-R, R), 26, FUCHSIA_2, 160);
        return true;
      }
      g.fillStyle(FUCHSIA, 0.16).fillEllipse(cx, cy, 34, R * 2.1);
      for (let k = 0; k < 4; k++) { const a = a0 - k * 0.22; g.lineStyle(10 - k * 2, k === 0 ? 0xffffff : FUCHSIA, 0.8 - k * 0.18); g.lineBetween(cx + Math.cos(a) * 12, cy - Math.sin(a) * R, cx - Math.cos(a) * 12, cy + Math.sin(a) * R); }
      if (Math.random() < 0.3) this.pop(cx + rnd(-10, 10), cy + rnd(-R, R), 26, FUCHSIA_2, 160);
      return true;
    });
  }

  /** Showdown: five big cards stand in a row along the aim, then turn over one by one at the hits. */
  private sdCards = new Map<string, Phaser.GameObjects.Container[]>();
  private sdHand = new Map<string, Card[]>();
  /** The scene tells which cards a Showdown plays (the caster's hand at the cast; others see backs turning to random faces). */
  showdownHand(castId: string, cards: Card[], value: HandValue | null, at: V3): void {
    this.sdHand.set(castId, cards);
    if (value) this.ctx.callout(at, value.label, value.tier >= 5 ? '#ffc94a' : '#ff7ae6', 0);
    if (value && value.tier >= 9) { this.ctx.flash(0xffffff, 0.5, 300); this.cutIn(1100); }
    if (value && value.tier >= 5) { const st = this.kit('j_star', at.x, at.y - at.z - 40, 120, TOP + 8); if (st) { const s0 = st.scale; this.piece(st, 700, (u, o) => o.setScale(s0 * lerp(0.3, 1.2, out3(u))).setAngle(u * 90).setAlpha(1 - u * u)); } }
  }
  private showdownRow(r: CastRun): void {
    const T = r.timings, cards: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < 5; i++) {
      const p = this.ahead(r, 90 + i * 55), box = this.card(p.x, p.y - 80, null, 0.9, p.y + 5).setAlpha(0).setScale(0.3);
      const h = this.ctx.hand(r.attackerId) ?? { x: r.origin.x, y: r.origin.y - 80 };
      box.setPosition(h.x, h.y);
      this.piece(box as unknown as Phaser.GameObjects.Container, T.startup + 60, (u, o) => o.setPosition(lerp(h.x, p.x, out3(u)), lerp(h.y, p.y - 80, out3(u)) - Math.sin(u * Math.PI) * 50).setAlpha(clamp01(u * 3)).setScale(lerp(0.3, 1, out3(u))).setAngle((1 - u) * 360), i * 40);
      cards.push(this.card(p.x, p.y - 80, null, 0.9, p.y + 5).setVisible(false));
    }
    this.sdCards.set(r.castId, cards);
    this.add((t) => { if (t < T.startup + 60) return true; for (const c of cards) c.setVisible(true); return false; });
  }
  private showdownBurst(r: CastRun, i: number): void {
    const cards = this.sdCards.get(r.castId), hand = this.sdHand.get(r.castId) ?? [];
    const box = cards?.[i]; if (!box) return;
    const c: Card = hand[i] ?? { suit: (['S', 'H', 'D', 'C'] as const)[Math.floor(Math.random() * 4)], rank: 2 + Math.floor(Math.random() * 13) };
    const face = this.card(box.x, box.y, c, 0.9, box.depth + 1);
    box.destroy();
    this.piece(face, 420, (u, o) => o.setScale(u < 0.25 ? Math.abs(Math.cos(u * 4 * Math.PI / 2)) : 1, 1).setAlpha(u > 0.7 ? (1 - u) / 0.3 : 1));
    this.burst(face.x, face.y, i === 4 ? 170 : 110, 120, face.depth + 2);
    if (i === 4) { this.sdCards.delete(r.castId); this.sdHand.delete(r.castId); this.ctx.cam().shake(220, 0.01); }
  }

  private coin(r: CastRun): void {
    const T = r.timings, heads = coinOf(r.castId);
    const h0 = this.ctx.hand(r.attackerId) ?? { x: r.origin.x, y: r.origin.y - 80 };
    const pics = this.ctx.scene.textures.exists('gbk-c_coin_h'), cs = pics ? 26 / 420 : 0.5;
    const coin = this.ctx.scene.add.image(h0.x, h0.y, pics ? 'gbk-c_coin_h' : 'gb-coin').setScale(cs).setDepth(TOP + 4);
    this.piece(coin, T.startup + 200, (u, o) => {
      const c = this.ctx.hand(r.attackerId) ?? h0, fl = Math.cos(u * 30), end = u > 0.82;
      if (pics) o.setTexture(end ? (heads ? 'gbk-c_coin_h' : 'gbk-c_coin_t') : fl > 0 ? 'gbk-c_coin_h' : 'gbk-c_coin_t');
      o.setPosition(c.x, c.y - Math.sin(u * Math.PI) * 150).setScale(cs, end ? cs : cs * (Math.abs(fl) * 0.95 + 0.05));
    });
    this.add((t) => {
      if (t < T.startup) return true;
      const c = this.ctx.casterPos(r.attackerId) ?? r.origin;
      this.pop(c.x, c.y - c.z - 90, 120, GOLD, 360);
      this.ctx.callout(c, heads ? 'HEADS! +CRIT' : 'TAILS! FREE SKILL', heads ? '#ffc94a' : '#ff7ae6', 1);
      return false;
    });
  }

  private roulette(r: CastRun): void {
    const T = r.timings, p = r.place ?? this.ahead(r, 200), R = 150, res = rouletteOf(r.castId);
    const s = this.ctx.scene, g = s.add.graphics().setDepth(GROUND + 3);
    const ballPic = s.textures.exists('gbk-c_ball'), ball = ballPic ? s.add.image(0, 0, 'gbk-c_ball').setDisplaySize(18, 18).setDepth(GROUND + 5) : s.add.circle(0, 0, 7, 0xfffbe8).setDepth(GROUND + 4);
    const spinMs = 2000, total = T.startup + spinMs + 500;
    const wheel = this.kit('c_wheel', p.x, p.y, R * 2.3, GROUND + 3, false);
    if (wheel) { // the painted wheel stands on the floor; light runs round its top while it spins, the ball rolls on it
      const w0 = wheel.scale, top = { y: -0.17, rx: 0.4, ry: 0.13 }; // its top face, in fractions of the drawing (centre y, radii)
      const spin = s.add.graphics().setDepth(GROUND + 4).setBlendMode(Phaser.BlendModes.ADD);
      this.add((t) => {
        if (t >= total) { wheel.destroy(); spin.destroy(); ball.destroy(); g.destroy(); return false; }
        const open = out3(clamp01(t / Math.max(1, T.startup))), u = clamp01((t - T.startup) / spinMs);
        const fade = t > T.startup + spinMs + 200 ? 1 - (t - T.startup - spinMs - 200) / 300 : 1;
        wheel.setScale(w0 * open).setAlpha(fade);
        const W = wheel.displayWidth, H = wheel.displayHeight, cx = p.x, cy = p.y + top.y * H, rx = top.rx * W, ry = top.ry * H / 0.5;
        const rot = t * 0.006 * (1 - u * 0.85);
        spin.clear().setAlpha(fade);
        for (let k = 0; k < 3; k++) { // three streaks of light sweeping round the pockets
          const a = rot + (k / 3) * Math.PI * 2;
          spin.lineStyle(6, FUCHSIA_2, 0.55); spin.beginPath();
          for (let j = 0; j <= 8; j++) { const aa = a + (j / 8) * 0.5, px = cx + Math.cos(aa) * rx * 0.8, py = cy + Math.sin(aa) * ry * 0.5 * 0.8; if (j) spin.lineTo(px, py); else spin.moveTo(px, py); }
          spin.strokePath();
        }
        const target = rot + ((res.pocket + 0.5) / 18) * Math.PI * 2, ba = u >= 1 ? target : target + (1 - out3(u)) * 26, br = u >= 1 ? 0.72 : 0.9;
        ball.setPosition(cx + Math.cos(ba) * rx * br, cy + Math.sin(ba) * ry * 0.5 * br - 4).setVisible(t > T.startup).setAlpha(fade);
        if (u >= 1 && !(spin as unknown as { won?: boolean }).won) { (spin as unknown as { won?: boolean }).won = true; this.pop(ball.x, ball.y, 80, res.red ? FUCHSIA : 0xffffff, 400); }
        return true;
      });
      return;
    }
    this.add((t) => {
      if (t >= total) { g.destroy(); ball.destroy(); return false; }
      const open = out3(clamp01(t / Math.max(1, T.startup))), u = clamp01((t - T.startup) / spinMs);
      const rot = t * 0.004 * (1 - u * 0.8);
      const fade = t > T.startup + spinMs + 200 ? 1 - (t - T.startup - spinMs - 200) / 300 : 1;
      g.clear().setAlpha(fade);
      const rr = R * open;
      g.fillStyle(0x1a0612, 0.8).fillEllipse(p.x, p.y, rr * 2.1, rr * 2.1 * SQUASH);
      for (let k = 0; k < 18; k++) {
        const a0 = rot + (k / 18) * Math.PI * 2, a1 = rot + ((k + 1) / 18) * Math.PI * 2, win = u >= 1 && k === res.pocket;
        g.fillStyle(win ? 0xffffff : k % 2 === 0 ? FUCHSIA : 0x121014, win ? 1 : 0.85);
        g.beginPath(); g.moveTo(p.x + Math.cos(a0) * rr * 0.55, p.y + Math.sin(a0) * rr * 0.55 * SQUASH);
        g.lineTo(p.x + Math.cos(a0) * rr, p.y + Math.sin(a0) * rr * SQUASH); g.lineTo(p.x + Math.cos(a1) * rr, p.y + Math.sin(a1) * rr * SQUASH);
        g.lineTo(p.x + Math.cos(a1) * rr * 0.55, p.y + Math.sin(a1) * rr * 0.55 * SQUASH); g.closePath(); g.fillPath();
      }
      g.lineStyle(5, GOLD, 1).strokeEllipse(p.x, p.y, rr * 2, rr * 2 * SQUASH); g.fillStyle(GOLD, 1).fillEllipse(p.x, p.y, rr * 0.5, rr * 0.5 * SQUASH);
      // the ball: fast round the rim, slowing, dropping into its pocket
      const target = rot + ((res.pocket + 0.5) / 18) * Math.PI * 2, ba = u >= 1 ? target : target + (1 - out3(u)) * 26, br = rr * (u >= 1 ? 0.78 : 0.93);
      ball.setPosition(p.x + Math.cos(ba) * br, p.y + Math.sin(ba) * br * SQUASH - 5).setVisible(t > T.startup).setAlpha(fade);
      return true;
    });
  }
  private rouletteEnd(r: CastRun): void {
    const p = r.place ?? this.ahead(r, 200), res = rouletteOf(r.castId), c = this.me(r);
    this.ctx.callout({ x: p.x, y: p.y, z: 40 }, res.red ? 'RED!' : 'BLACK!', res.red ? '#ff2bd6' : '#e8e0f0', 0);
    if (res.red) {
      this.burst(p.x, p.y - 40, 260, 0, p.y + 3);
      this.beam(p.x, p.y, 340, 420);
      this.ctx.cam().shake(240, 0.01);
    } else { // black: a cage of standing cards round everyone in the wheel for 2s
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, x = p.x + Math.cos(a) * 140, y = p.y + Math.sin(a) * 140 * SQUASH;
        const im = this.ctx.scene.add.image(x, y, this.BK).setOrigin(0.5, 1).setScale(this.u * (0.6)).setDepth(y);
        this.piece(im, 2000, (u, o) => o.setScale(this.u * 0.6, this.u * 0.6 * (u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1)));
      }
      this.floorRing(p.x, p.y, 150, 0xd8d0e8, 600);
    }
    void c;
  }

  private dice(r: CastRun): void {
    const T = r.timings, [a, b] = diceOf(r.castId), s = this.ctx.scene;
    const mk = (n: number, i: number) => {
      const g = s.add.graphics(), size = 26, bias = [140, 195][i];
      if (s.textures.exists('gbk-c_die_a')) {
        const im = s.add.image(0, 0, 'gbk-c_die_a').setDisplaySize(40, 40).setVisible(false), k0 = im.scale;
        this.add((t) => {
          if (t < T.startup) return true;
          const tt = t - T.startup, land = 560 + i * 80;
          if (tt >= land + 260) { im.destroy(); g.destroy(); return false; }
          const c = r.origin, k = clamp01(tt / land), x = c.x + r.aim.x * bias * k, y = c.y + r.aim.y * bias * k, hop = Math.abs(Math.sin(k * Math.PI * 3)) * 40 * (1 - k);
          im.setVisible(true).setPosition(x, y - 20 - hop).setDepth(y + 3).setTexture(k < 1 && Math.floor(tt / 80) % 2 ? 'gbk-c_die_b' : 'gbk-c_die_a').setScale(k0).setAngle(k < 1 ? tt * 0.9 : 0);
          return true;
        });
        return;
      }
      this.add((t) => {
        const c = r.origin, u = clamp01((t - T.startup) / (560 + i * 80 - T.startup + T.startup)), tt = t - T.startup;
        if (t < T.startup) return true;
        const land = 560 + i * 80;
        if (tt >= land + 260) { g.destroy(); return false; }
        const k = clamp01(tt / land), x = c.x + r.aim.x * bias * k, y = c.y + r.aim.y * bias * k, hop = Math.abs(Math.sin(k * Math.PI * 3)) * 40 * (1 - k);
        g.clear().setDepth(y + 3).setPosition(x, y - 16 - hop).setAngle(k < 1 ? tt * 0.9 : 0);
        g.fillStyle(0x6a1a8a, 0.92).fillRoundedRect(-size / 2, -size / 2, size, size, 5); g.lineStyle(2, FUCHSIA_2, 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
        const show = k < 1 ? 1 + (Math.floor(tt / 70) % 6) : n, P = [[0, 0], [-6, -6], [6, 6], [6, -6], [-6, 6], [-6, 0], [6, 0]];
        const pips = [[0], [1, 2], [0, 1, 2], [1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 2, 3, 4, 5, 6]][show - 1];
        g.fillStyle(GOLD, 1); for (const q of pips) g.fillCircle(P[q][0], P[q][1], 2.6);
        void u;
        return true;
      });
    };
    mk(a, 0); mk(b, 1);
  }
  private diceBlast(r: CastRun, i: number): void {
    const [a, b] = diceOf(r.castId), sum = a + b, p = this.ahead(r, [140, 195][i]), size = 110 + sum * 16;
    this.burst(p.x, p.y - 26, size, 0, p.y + 3);
    this.floorRing(p.x, p.y, size * 0.7);
    if (i === 1) { this.ctx.callout({ x: p.x, y: p.y, z: 30 }, a === b ? `DOUBLE ${a}s!` : `${a} + ${b} = ${sum}`, a === b ? '#ffc94a' : '#ff7ae6', 0); this.ctx.cam().shake(140 + sum * 10, 0.004 + sum * 0.0005); }
  }

  private ladyLuckCast(r: CastRun): void {
    const T = r.timings, c = this.me(r);
    const pc = this.kit('j_clover', c.x, c.y - c.z - 160, 130, TOP + 4);
    const clover = pc ?? this.ctx.scene.add.text(c.x, c.y - c.z - 150, '☘', { fontFamily: 'Georgia, serif', fontSize: '64px', color: '#ffd96a', stroke: '#5a3a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(TOP + 4);
    const c0 = pc ? pc.scale : 1;
    this.piece(clover as Phaser.GameObjects.Image, T.startup + 700, (u, o) => o.setScale(c0 * lerp(0.2, 1.1, out3(clamp01(u * 2)))).setAlpha(u > 0.75 ? (1 - u) / 0.25 : 1).setAngle(Math.sin(u * 8) * 8));
    const ring = this.kit('j_ring', c.x, c.y, 300, GROUND + 3);
    if (ring) { const rx = ring.scaleX, ry = (300 * SQUASH) / ring.height; this.piece(ring, T.startup + 900, (u, o) => o.setScale(rx * lerp(0.3, 1, out3(clamp01(u * 2))), ry * lerp(0.3, 1, out3(clamp01(u * 2)))).setAlpha(u > 0.7 ? (1 - u) / 0.3 : 1), 0); }
    this.pop(c.x, c.y - c.z - 150, 200, GOLD, 600, T.startup);
  }
  /** Lady Luck's light stays on him while it lasts. */
  luck(id: string, ms: number): void {
    this.lucks.get(id)?.img.destroy();
    const img = this.glow(0, 0, 150, GOLD, 0).setAlpha(0.28);
    this.lucks.set(id, { until: this.clock + ms, img });
  }

  private deckSpray(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene;
    this.add((t) => {
      if (t < T.startup) return true;
      const c = this.me(r), side = sideOf(r);
      for (let k = 0; k < 44; k++) {
        const ang = Math.atan2(r.aim.y, r.aim.x) + rnd(-0.6, 0.6), dist = rnd(80, 440), x1 = c.x + Math.cos(ang) * dist, y1 = c.y + Math.sin(ang) * dist * 0.8;
        const im = s.add.image(c.x + side * 20, c.y - c.z - 60, this.BK).setScale(this.u * (0.3)).setDepth(y1 + 2);
        const fly = rnd(160, 260), delay = rnd(0, 120);
        this.piece(im, fly + 760, (u, o) => {
          const tt = u * (fly + 760);
          if (tt < fly) { const k2 = tt / fly; o.setPosition(lerp(c.x + side * 20, x1, k2), lerp(c.y - c.z - 60, y1 - 4, k2) - Math.sin(k2 * Math.PI) * 30).setAngle(k2 * 540); }
          else o.setTint(Math.floor(tt / 60) % 2 ? 0xffffff : FUCHSIA).setAngle(70).setScale(this.u * 0.3, this.u * 0.16);
        }, delay);
      }
      return false;
    });
  }

  private slamCharge(r: CastRun): void {
    const T = r.timings, g = this.ctx.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.piece(g, T.startup, (u, o) => {
      const c = this.ctx.casterPos(r.attackerId); o.clear(); if (!c) return;
      o.setDepth(c.y + 3);
      for (let k = 0; k < 3; k++) { const x = c.x - sideOf(r) * 20 + rnd(-30, 30), y = c.y - c.z - 90 + rnd(-40, 40); o.lineStyle(2, k ? FUCHSIA : 0xffffff, 0.9); o.lineBetween(x, y, x + rnd(-24, 24), y + rnd(-24, 24)); }
      void u;
    });
  }

  private overloadCast(r: CastRun): void {
    const T = r.timings, c = this.me(r);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const g = this.glow(c.x + Math.cos(a) * 140, c.y - c.z - 60 + Math.sin(a) * 80, 50); this.piece(g, T.startup, (u, o) => o.setPosition(lerp(c.x + Math.cos(a) * 140, c.x, out3(u)), lerp(c.y - c.z - 60 + Math.sin(a) * 80, c.y - c.z - 60, out3(u))).setAlpha(u)); }
  }
  /** Kinetic Overload's charge stays on him (an outline of crackling arcs). */
  overload(id: string, ms: number): void {
    this.overloads.get(id)?.g.destroy(); this.overloads.get(id)?.glow.destroy();
    const g = this.ctx.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), glow = this.glow(0, 0, 170, FUCHSIA, 0).setAlpha(0.35);
    this.overloads.set(id, { until: this.clock + ms, g, glow });
  }
  clearBuffs(id: string): void {
    const o = this.overloads.get(id); if (o) { o.g.destroy(); o.glow.destroy(); this.overloads.delete(id); }
    const l = this.lucks.get(id); if (l) { l.img.destroy(); this.lucks.delete(id); }
  }
  private stepBuffs(): void {
    for (const [id, o] of this.overloads) {
      const c = this.ctx.casterPos(id);
      if (!c || this.clock > o.until) { o.g.destroy(); o.glow.destroy(); this.overloads.delete(id); continue; }
      o.glow.setPosition(c.x, c.y - c.z - 60).setDepth(c.y - 1).setAlpha(0.25 + 0.12 * Math.sin(this.clock * 0.01));
      o.g.clear().setDepth(c.y + 3);
      if (this.ctx.scene.textures.exists('gbk-k_arcs')) {
        if (Math.random() < 0.18) { const a = this.kit('k_arcs', c.x + rnd(-14, 14), c.y - c.z - rnd(40, 90), rnd(70, 110), c.y + 3); if (a) { const a0 = a.scale; a.setAngle(rnd(0, 360)).setFlipX(Math.random() < 0.5); this.piece(a, 160, (u, im) => im.setAlpha(1 - u).setScale(a0 * (1 + u * 0.2))); } }
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const x = c.x + rnd(-34, 34), y = c.y - c.z - rnd(10, 120);
        o.g.lineStyle(2, k ? FUCHSIA : 0xffffff, 0.8); o.g.beginPath(); o.g.moveTo(x, y);
        for (let j = 0; j < 3; j++) o.g.lineTo(x + rnd(-14, 14), y + rnd(-14, 14));
        o.g.strokePath();
      }
    }
    for (const [id, l] of this.lucks) {
      const c = this.ctx.casterPos(id);
      if (!c || this.clock > l.until) { l.img.destroy(); this.lucks.delete(id); continue; }
      l.img.setPosition(c.x, c.y - c.z - 60).setDepth(c.y - 1).setAlpha(0.18 + 0.08 * Math.sin(this.clock * 0.004));
    }
  }

  private wildCard(r: CastRun): void {
    const T = r.timings, h = this.ctx.hand(r.attackerId) ?? { x: r.origin.x, y: r.origin.y - 80 };
    const j = this.card(h.x, h.y, { suit: 'S', rank: 0, joker: true }, 0.8, TOP + 5).setAlpha(0);
    this.piece(j, T.startup + 300, (u, o) => o.setAlpha(clamp01(u * 3)).setScale(lerp(0.4, 1, out3(clamp01(u * 2)))).setPosition(h.x, h.y - u * 30));
    this.pop(h.x, h.y, 90, 0xc9a8ff, 300, T.startup * 0.4);
  }

  /** Jackpot: the gambler's picture crosses the screen, the world darkens, a slot machine rolls 7 · 7 · 7. */
  private jackpot(r: CastRun): void {
    const T = r.timings, c = this.me(r), s = this.ctx.scene;
    this.ctx.darken(T.startup + T.active + 300, 0.6);
    const cut = Math.min(520, Math.round(T.startup * 0.55));
    this.cutIn(cut);
    const mx = c.x, my = c.y - c.z - 230;
    const box = s.add.container(mx, my).setDepth(TOP + 20).setAlpha(0);
    const painted = s.textures.exists('gbk-j_slot');
    // the painted machine: its three reel windows (measured on the drawing: centres -72 / -8 / +58 px, 44 x 84, of 333 x 360)
    const K = painted ? 380 / 360 : 1, winX = painted ? [-72, -8, 58].map((v) => v * K) : [-90, 0, 90], winW = painted ? 44 * K : 80, winH = painted ? 84 * K : 84, winY = painted ? 2 * K : 0;
    if (painted) {
      const back = s.add.graphics(); back.fillStyle(0x12040e, 0.92); for (const x of winX) back.fillRoundedRect(x - winW / 2, winY - winH / 2, winW, winH, 6); box.add(back);
    } else {
      const frame = s.add.graphics();
      frame.fillStyle(0x1a0612, 0.95).fillRoundedRect(-150, -62, 300, 124, 18);
      frame.lineStyle(6, GOLD, 1).strokeRoundedRect(-150, -62, 300, 124, 18);
      frame.lineStyle(3, FUCHSIA, 1).strokeRoundedRect(-140, -52, 280, 104, 12);
      box.add(frame);
      for (const x of winX) { const w = s.add.graphics(); w.fillStyle(IVORY, 1).fillRoundedRect(x - 40, -42, 80, 84, 8); box.add(w); }
    }
    const pics = ['j_cherry', 'j_bell', 'j_star'].filter((k) => s.textures.exists(`gbk-${k}`));
    const sym = ['♥', '★', '✦', '7', '♦', '♣'], reels: Phaser.GameObjects.Text[] = [], spinners: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      const tx = s.add.text(winX[i], winY, '7', { fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold', fontSize: painted ? '50px' : '52px', color: painted ? '#ffd96a' : '#ff2bd6', stroke: '#3a0a4a', strokeThickness: 6 }).setOrigin(0.5);
      box.add(tx); reels.push(tx);
      if (pics.length) { const im = s.add.image(winX[i], winY, `gbk-${pics[0]}`).setBlendMode(Phaser.BlendModes.ADD); im.setScale((winW * 1.1) / im.width); box.add(im); spinners.push(im); }
    }
    if (painted) { const m = s.add.image(0, 0, 'gbk-j_slot').setBlendMode(Phaser.BlendModes.ADD); m.setScale(K * 360 / m.height); box.add(m); }
    const show = cut + 200, stopAt = [show + (T.startup - show) * 0.35, show + (T.startup - show) * 0.65, T.startup];
    let done = false;
    this.add((t) => {
      if (t > T.startup + T.active + 300) { this.piece(box, 260, (u, o) => o.setAlpha(1 - u).setScale(1 + u * 0.3)); return false; }
      if (t < show) { box.setVisible(false); return true; }
      box.setVisible(true).setAlpha(clamp01((t - show) / 160)).setScale(lerp(0.6, 1, out3(clamp01((t - show) / 220))));
      reels.forEach((tx, i) => {
        const sp = spinners[i];
        if (t < stopAt[i]) {
          const roll = ((t * 0.8) % 40) - 20;
          if (sp) { tx.setVisible(false); sp.setVisible(true).setTexture(`gbk-${pics[Math.floor(t / 70 + i) % pics.length]}`).setY(winY + roll); }
          else tx.setText(sym[Math.floor(t / 60 + i * 2) % sym.length]).setY(winY + roll);
        }
        else if (tx.text !== '7' || tx.y !== winY || !tx.visible) { sp?.setVisible(false); tx.setVisible(true).setText('7').setY(winY); this.pop(mx + winX[i], my + winY, 120, GOLD, 300); s.cameras.main.shake(80, 0.004); }
      });
      if (!done && t >= stopAt[2] + 60) {
        done = true;
        this.ctx.callout({ x: c.x, y: c.y, z: c.z + 210 }, 'JACKPOT!!!', '#ffc94a', 0);
        this.ctx.flash(0xffe0f8, 0.45, 260);
      }
      return true;
    });
  }
  private jackpotBlast(r: CastRun, i: number): void {
    const c = this.me(r), s = this.ctx.scene, last = i === r.hits.length - 1;
    const a = rnd(0, Math.PI * 2), d = last ? 0 : rnd(80, 260), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * SQUASH;
    const pic = this.kit(last ? 'j_jackpot' : 'j_fountain', x, last ? y - 120 : y, last ? 520 : 200, y + 3);
    if (pic) {
      if (!last) pic.setOrigin(0.5, 0.95);
      const p0 = pic.scale; this.piece(pic, last ? 700 : 520, (u, o) => o.setScale(p0 * lerp(0.4, 1.1, out3(u))).setAlpha(u < 0.65 ? 1 : (1 - u) / 0.35));
      if (last) this.pop(x, y - 120, 360, GOLD, 360);
    } else this.burst(x, y - 50, last ? 420 : 170, 0, y + 3);
    for (let k = 0; k < (last ? 30 : 10); k++) {
      const pics = s.textures.exists('gbk-c_chip'), coinK = Math.random() < 0.55, key = pics ? (coinK ? 'gbk-c_coin_h' : 'gbk-c_chip') : coinK ? 'gb-coin' : 'gb-chip';
      const im = s.add.image(x, y - 40, key).setScale(pics ? rnd(18, 30) / 420 : rnd(0.35, 0.6)).setDepth(y + 4);
      const vx = rnd(-260, 260), vy = rnd(260, 480), spin = rnd(-900, 900);
      this.piece(im, 900, (u, o) => o.setPosition(x + vx * u, y - 40 - vy * u + 640 * u * u).setAngle(spin * u).setAlpha(u > 0.8 ? (1 - u) / 0.2 : 1));
    }
    if (last) { this.scar(c.x, c.y, 220); this.floorRing(c.x, c.y, 330, GOLD, 600, 0, 10); this.ctx.cam().shake(420, 0.016); this.ctx.freeze(120); }
    else this.ctx.cam().shake(120, 0.005);
  }

  /** The gambler's picture slides across the screen (ultimate / Royal Flush). */
  cutIn(holdMs: number): void {
    const s = this.ctx.scene, cam = this.ctx.cam();
    if (!s.textures.exists('gb-cutin')) return;
    const v = cam.worldView, h = v.height * 0.34, cy = v.y + v.height * 0.42, life = holdMs + 260;
    const band = s.add.rectangle(v.centerX, cy, v.width, h, 0x12040e, 0.82).setDepth(TOP + 49).setScale(1, 0);
    const edgeT = s.add.rectangle(v.centerX, cy - h / 2, v.width, 4, FUCHSIA, 1).setDepth(TOP + 50).setScale(0, 1);
    const edgeB = s.add.rectangle(v.centerX, cy + h / 2, v.width, 4, FUCHSIA, 1).setDepth(TOP + 50).setScale(0, 1);
    const tex = s.textures.get('gb-cutin').getSourceImage() as HTMLImageElement;
    const k = (h * 1.25) / tex.height; // the painted cut-in (his reach with the card spills a little over the band)
    const img = s.add.image(v.x - 300, cy + h * 0.5, 'gb-cutin').setOrigin(0.5, 1).setScale(k).setDepth(TOP + 51);
    const sx = (u: number) => (u < 0.22 ? lerp(v.x - 300, v.centerX - 30, out3(u / 0.22)) : u < 0.82 ? lerp(v.centerX - 30, v.centerX + 30, (u - 0.22) / 0.6) : lerp(v.centerX + 30, v.right + 300, (u - 0.82) / 0.18));
    const env = (u: number) => (u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1);
    this.piece(band, life, (u, o) => o.setScale(1, env(u)));
    this.piece(edgeT, life, (u, o) => o.setScale(clamp01(u * 4), 1).setAlpha(env(u)));
    this.piece(edgeB, life, (u, o) => o.setScale(clamp01(u * 4), 1).setAlpha(env(u)));
    this.piece(img, life, (u, o) => o.setX(sx(u)).setAlpha(u > 0.82 ? env(u) : 1));
  }

  /** A gambler zone strikes (its lingering hit): the thrown foe's landing bursts; the charged floor is drawn by fuseFloor. */
  zone(id: string, x: number, y: number, r: number): void {
    if (id === 'kinetic_grab') { this.burst(x, y - 40, r * 2, 0, y + 3); this.floorRing(x, y, r, FUCHSIA_2, 420); this.scar(x, y, r); this.ctx.cam().shake(220, 0.01); }
  }
  /** A fuchsia scar on the floor (a blow's mark), fading out. */
  private scar(x: number, y: number, r: number): void {
    const k = this.kit('s_crack', x, y, r * 1.2, GROUND + 1.5);
    if (k) { // turned to lie along the floor: its length across the screen, its width squashed into the depth
      const len = (r * 2.4) / k.height, wid = (r * 1.1 * SQUASH) / k.width; k.setAngle(90 + rnd(-8, 8));
      this.piece(k, 900, (u, o) => o.setScale(wid, len * lerp(0.5, 1, out3(clamp01(u * 4)))).setAlpha(u < 0.6 ? 1 : (1 - u) / 0.4)); return; }
    const g = this.ctx.scene.add.graphics().setDepth(GROUND + 1.5).setBlendMode(Phaser.BlendModes.ADD);
    const arms = Array.from({ length: 7 }, () => ({ a: rnd(0, Math.PI * 2), l: rnd(0.5, 1) * r }));
    this.piece(g, 900, (u, o) => { o.clear(); for (const k of arms) { o.lineStyle(5 * (1 - u) + 1, k.l > r * 0.8 ? 0xffffff : FUCHSIA, (1 - u) * 0.9); o.lineBetween(x, y, x + Math.cos(k.a) * k.l, y + Math.sin(k.a) * k.l * SQUASH); } });
  }
  /** Card Step: a card under his feet bursts and throws him on. */
  cardStep(x: number, y: number, dir: number): void {
    const im = this.ctx.scene.add.image(x, y + 8, this.BK).setScale(this.u * (0.34), this.u * (0.16)).setDepth(TOP + 2).setTint(FUCHSIA_2);
    this.piece(im, 220, (u, o) => o.setAlpha(1 - u).setScale(this.u * (0.34 + u * 0.2), this.u * 0.16));
    this.burst(x - dir * 6, y + 6, 80);
  }

  /** Cheat Death: he bursts into a cloud of cards. */
  cheatDeath(x: number, y: number): void {
    this.shards(x, y - 60, 22, 160, 700);
    this.pop(x, y - 60, 200, 0xffffff, 300);
    this.ctx.callout({ x, y, z: 60 }, 'CHEAT DEATH!', '#ffc94a', 0);
  }

  // ------------------------------------------------------------------ clock

  update(dt: number): void {
    this.clock += dt;
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    // each step gets its own age (stored on it) so pieces stop with the hit-stop
    this.live = cur.filter((f) => { const a = f as Step & { age?: number }; a.age = (a.age ?? 0) + dt; return f(a.age, dt); });
    this.stepProjectiles(dt);
    this.stepStuck();
    this.stepBuffs();
  }

  destroy(): void {
    for (const [p] of this.projs) this.projectileEnd(p);
    for (const [, l] of this.stuck) for (const c of l) c.img.destroy();
    this.stuck.clear();
    for (const id of [...this.overloads.keys(), ...this.lucks.keys()]) this.clearBuffs(id);
    for (const c of this.handView.cards) c.destroy();
    this.live = []; this.incoming = [];
  }
}
