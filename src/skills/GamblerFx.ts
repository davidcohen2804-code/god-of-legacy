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
      case 'ace_in_the_hole': this.aceAim(r); this.ctx.darken(T.startup + 700, 0.2); break;
      case 'lady_luck': this.ladyLuckCast(r); break;
      case 'pickup_52': handGlow(T.startup, 70); this.ctx.darken(T.startup + 900, 0.22); this.deckSpray(r); break;
      case 'grand_slam': this.slamCharge(r); break;
      case 'kinetic_overload': this.overloadCast(r); break;
      case 'wild_card': this.wildCard(r); break;
      case 'card_swap': this.cardSwap(r); break;
      case 'jackpot': this.jackpot(r); break;
      case 'staff_vault': this.vault(r); break;
    }
  }

  /** The release (active start). */
  active(r: CastRun): void {
    const o = this.me(r), y0 = o.y - o.z, side = sideOf(r);
    if (r.skill.id === 'grand_slam') {
      this.pop(o.x + side * 110, y0 - 60, 220, 0xffffff, 220); // the crack of the bat
      const bl = this.kit('k_blast', o.x + side * 120, y0 - 60, 220, o.y + 3); if (bl) { const b0 = bl.scale; this.piece(bl, 360, (u, im) => im.setScale(b0 * lerp(0.4, 1.2, out3(u))).setAlpha(1 - u)); }
      this.ctx.flash(0xffffff, 0.3, 120);
      if (!this.stroke('s_homerun', o.x + side * 70, y0 - 64, 300, side, 460, o.y + 2)) this.swing(o.x - side * 10, y0 - 60, 120, side > 0 ? Math.PI * 1.15 : -Math.PI * 0.15, side > 0 ? Math.PI * 2.05 : -Math.PI * 1.05, 360, 46, o.y + 2);
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
      case 'riffle_shuffle': if (i === r.hits.length - 1) { const tor = this.kit('x_tornado', o.x, o.y, 260, o.y + 3); if (tor) { tor.setOrigin(0.5, 0.97); const t0 = tor.scale; this.piece(tor, 460, (u, im) => im.setScale(t0 * lerp(1, 1.3, u), t0 * lerp(0.8, 1.2, out3(u))).setFlipX(Math.floor(u * 10) % 2 === 1).setAlpha(1 - u * u)); } this.floorRing(o.x, o.y, 170, FUCHSIA_2, 380); this.shards(o.x, y0 - 50, 18, 200, 520); } break;
      case 'rotor_staff': if (i === r.hits.length - 1) { if (!this.stroke('s_thrust', o.x + side * 24, y0 - 56, 210, side, 300, d, 0, 0.05, 0.5)) this.band(o.x + side * 30, y0 - 56, 150, side > 0 ? 0 : 180, 260, 30, d); this.pop(o.x + side * 150, y0 - 56, 120); } break;
      case 'kinetic_grab': if (i === 1) this.stroke('s_heavy', o.x + side * 50, y0 - 64, 180, side, 300, d); break;
      case 'grand_slam': break;
      case 'dice_bomb': this.diceBlast(r, i); break;
      case 'roulette_wheel': if (i === r.hits.length - 1) this.rouletteEnd(r); break;
      case 'pickup_52': if (i > 0) this.pickWave(r, i); break;
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
    if (big) { // the ace's lance: a ribbon of light from the throw to the ace, lingering a moment after it passes
      const x0 = p.x, y0 = p.y - p.z, lance = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD), lancePic = this.kit('x_lance', x0, y0, 100, p.y + 2);
      lancePic?.setOrigin(0.97, 0.5);
      img.setScale(this.u * 0.95);
      this.add((t) => {
        const end = this.projs.has(p) ? { x: p.x, y: p.y - p.z } : null;
        if (end) (lance as unknown as { e: { x: number; y: number } }).e = end;
        const e = (lance as unknown as { e?: { x: number; y: number } }).e ?? { x: x0, y: y0 }, fade = end ? 1 : Math.max(0, 1 - (t - ((lance as unknown as { t0?: number }).t0 ??= t)) / 260);
        lance.clear().setDepth(p.y + 1);
        if (lancePic) { const L = Math.hypot(e.x - x0, e.y - y0); lancePic.setPosition(e.x, e.y).setDepth(p.y + 2).setAngle(Math.atan2(e.y - y0, e.x - x0) * 57.3).setScale(Math.max(0.05, L / lancePic.width), (46 / lancePic.height) * (0.8 + 0.3 * Math.sin(t * 0.08))).setAlpha(fade); if (fade <= 0) { lancePic.destroy(); lance.destroy(); return false; } return true; }
        lance.lineStyle(26, FUCHSIA, 0.35 * fade).lineBetween(x0, y0, e.x, e.y);
        lance.lineStyle(9, FUCHSIA_2, 0.7 * fade).lineBetween(x0, y0, e.x, e.y);
        lance.lineStyle(3, 0xffffff, 0.95 * fade).lineBetween(x0, y0, e.x, e.y);
        if (fade <= 0) { lance.destroy(); return false; }
        return true;
      });
    }
    this.projs.set(p, { img, glow, trail: [], g, big, streak });
  }
  private stepProjectiles(dt: number): void {
    for (const [p, v] of this.projs) {
      const x = p.x, y = p.y - p.z;
      v.img.setPosition(x, y).setDepth(p.y + 3);
      if (v.big) {
        v.img.setAngle(screenAng(p.dx, p.dy) + 90 + Math.sin(p.ageMs * 0.05) * 6).setScale(this.u * 0.62 * (1 + 0.06 * Math.sin(p.ageMs * 0.09)), this.u * 0.62);
        if ((v as { ghostAt?: number }).ghostAt === undefined || p.ageMs - (v as { ghostAt?: number }).ghostAt! > 34) { // afterimages of the ace
          (v as { ghostAt?: number }).ghostAt = p.ageMs;
          const gh = this.ctx.scene.add.image(x, y, this.acePic).setScale(v.img.scaleX, v.img.scaleY).setAngle(v.img.angle).setTint(FUCHSIA).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 1).setAlpha(0.5);
          this.piece(gh, 160, (u, o) => o.setAlpha(0.5 * (1 - u)));
        }
        if (Math.random() < 0.5) this.shards(x - p.dx * 20, y, 1, 30, 240, 0, p.y + 2);
      } else v.img.setAngle(v.img.angle + dt * 1.4);
      v.glow.setPosition(x, y);
      if (v.streak) { v.streak.setPosition(x, y).setDepth(p.y + 2).setScale(v.streak.scaleX, Math.abs(v.streak.scaleX) * (0.85 + 0.25 * Math.sin(p.ageMs * 0.07)) * (v.streak.flipY ? 1 : 1)); v.g.clear(); continue; }
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
    if (p.skill.id === 'ace_in_the_hole') { // the ace stops dead, spins, swells with light — its blast comes with the lingering hit (zone)
      const ace = this.ctx.scene.add.image(end.x, end.y - p.z, this.acePic).setScale(this.u * 0.95).setDepth(end.y + 4), ch = this.kit('k_charge', end.x, end.y - p.z, 110, end.y + 3);
      this.piece(ace, 230, (u, o) => o.setScale(this.u * 0.95 * (1 + u * 0.35) * Math.abs(Math.cos(u * 12)) + 0.02, this.u * 0.95 * (1 + u * 0.35)).setTint(Math.sin(u * 40) > 0 ? 0xffffff : FUCHSIA));
      if (ch) { const c0 = ch.scale; this.piece(ch, 230, (u, o) => o.setScale(c0 * (1 + u)).setAlpha(0.6 + 0.4 * u)); }
      return;
    }
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
    if (crit || (heavy && s.slot === 7)) { const x = this.kit('x_cross', at.x, y, crit ? 150 : 200, TOP + 4); if (x) { const x0 = x.scale, a0 = rnd(-15, 15); this.piece(x, 300, (u, o) => o.setScale(x0 * lerp(1.4, 1, out3(clamp01(u * 3)))).setAngle(a0).setAlpha(u < 0.5 ? 1 : (1 - u) / 0.5)); } }
    this.pop(at.x, y, size * (crit ? 1.4 : 1), crit ? 0xffffff : FUCHSIA, heavy ? 320 : 200);
    if (heavy || crit) this.shards(at.x, y, heavy ? 6 : 3, size * 0.9);
    if (s.id === 'grand_slam') this.ctx.cam().shake(260, 0.014);
    if (s.id === 'ace_in_the_hole' && hit.damage >= 30) { // pierced: a beat of hit-stop, a ring punched through the foe, a spray of shards
      const y = at.y - at.z; this.ctx.freeze(70); this.ctx.cam().shake(120, 0.006);
      const ring = this.kit('k_ring', at.x, y, 150, TOP + 4); if (ring) { ring.setAngle(90); const r0 = ring.scale; this.piece(ring, 300, (u, o) => o.setScale(r0 * lerp(0.3, 1.2, out3(u))).setAlpha(1 - u)); }
      this.shards(at.x, y, 8, 120, 420); this.pop(at.x, y, 180, 0xffffff, 220);
    }
    if (s.id === 'kinetic_grab' && hit.reaction.grab && !hit.reaction.pin) this.thrownBomb(at);
  }
  private comet(at: V3): void {
    const y = at.y - at.z, g = this.ctx.scene.add.graphics().setDepth(TOP + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(g, 420, (u, o) => { o.clear(); const L = 220 * out3(u), a = 1 - u; o.fillStyle(FUCHSIA, 0.6 * a).fillTriangle(at.x, y - 18, at.x, y + 18, at.x - L, y); o.fillStyle(0xffffff, 0.8 * a).fillTriangle(at.x, y - 7, at.x, y + 7, at.x - L * 0.6, y); });
    this.ctx.flash(0xffffff, 0.25, 120);
  }
  private thrownBomb(_at: V3): void { /* drawn by follow() from the scene (it knows the foe) */ }

  /** Effects that ride on a foe the gambler struck (the scene tells which foe): the grab's charge and throw, the home run's comet. */
  follow(skill: string, id: string, hit: number): void {
    const tp0 = this.ctx.targetPos(id); if (!tp0) return;
    const s = this.ctx.scene, H = tp0.h ?? 90;
    const at = () => { const t = this.ctx.targetPos(id); return t ? { x: t.x, y: t.y - t.z - H * 0.5, d: t.y } : null; };
    if (skill === 'kinetic_grab' && hit === 0) { // seized: the body charges up — arcs crawl over it, a card-shaped charge pulses, the glow swells
      const glow = this.glow(0, 0, H * 1.6, FUCHSIA, 0), ring = this.kit('x_grip', 0, 0, H * 1.1, 0) ?? this.kit('k_charge', 0, 0, H * 0.9, 0);
      this.add((t) => {
        const p = at(); if (!p || t > 520) { glow.destroy(); ring?.destroy(); return false; }
        const u = t / 520;
        glow.setPosition(p.x, p.y).setDepth(p.d + 2).setAlpha(0.35 + 0.35 * u + 0.15 * Math.sin(t * 0.06)).setScale((H * (1.2 + u * 0.8)) / 128);
        if (ring) ring.setPosition(p.x, p.y).setDepth(p.d + 3).setAlpha(0.5 + 0.5 * Math.abs(Math.sin(t * 0.03))).setAngle(t * 0.2).setScale((H * (0.7 + u * 0.5)) / ring.width);
        if (Math.random() < 0.35) { const a = this.kit('k_arcs', p.x + rnd(-18, 18), p.y + rnd(-H * 0.4, H * 0.4), rnd(50, 80), p.d + 4); if (a) { const a0 = a.scale; a.setAngle(rnd(0, 360)); this.piece(a, 120, (uu, o) => o.setAlpha(1 - uu).setScale(a0 * (1 + uu * 0.3))); } }
        return true;
      });
      this.ctx.callout({ x: tp0.x, y: tp0.y, z: tp0.z + 20 }, 'GRAB!', '#ff7ae6', 1);
    }
    if ((skill === 'kinetic_grab' && hit === 1) || skill === 'grand_slam') { // thrown: a comet of fuchsia light streams behind the flying body
      const big = skill === 'grand_slam', g = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD), glow = this.glow(0, 0, H * (big ? 1.4 : 1.2), FUCHSIA, 0);
      const pts: { x: number; y: number }[] = []; let lastBurst = 0;
      const comet = this.kit('x_comet', tp0.x, tp0.y - tp0.z - H * 0.5, big ? 300 : 220, tp0.y + 1); comet?.setOrigin(0.92, 0.5);
      this.add((t) => {
        const p = at(), life = big ? 900 : 760;
        if (!p || t > life) { this.piece(g, 200, (u, o) => o.setAlpha(1 - u)); glow.destroy(); if (comet) this.piece(comet, 200, (u, o) => o.setAlpha(1 - u)); return false; }
        pts.push({ x: p.x, y: p.y }); if (pts.length > 16) pts.shift();
        if (comet) { const a = pts[0], b = pts[pts.length - 1], mv = Math.hypot(b.x - a.x, b.y - a.y); comet.setPosition(p.x, p.y).setDepth(p.d + 1).setAlpha(Math.min(1, mv / 30) * (1 - t / life * 0.5)); if (mv > 4) comet.setAngle(Math.atan2(b.y - a.y, b.x - a.x) * 57.3); }
        g.clear().setDepth(p.d + 1);
        for (let i = 1; i < pts.length; i++) { const k = i / pts.length; g.lineStyle((big ? 34 : 24) * k, k > 0.75 ? 0xffffff : FUCHSIA, 0.75 * k); g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y); }
        glow.setPosition(p.x, p.y).setDepth(p.d + 2).setAlpha(0.6 * (1 - t / life) + 0.2);
        if (t - lastBurst > 90) { lastBurst = t; this.shards(p.x, p.y, 2, 40, 300, 0, p.d + 3); }
        return true;
      });
    }
  }

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
    const seal = this.kit('x_seal', p.x, p.y - 20, 250, GROUND + 2);
    if (seal) { const s0 = seal.scale; seal.setVisible(false); this.piece(seal, 820, (u, o) => o.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(u * u * 22))).setScale(s0 * (0.7 + 0.3 * out3(u))), T.startup); }
    else { const e = this.ctx.scene.add.ellipse(p.x, p.y, 230, 230 * SQUASH, FUCHSIA, 0.25).setDepth(GROUND + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.piece(e, 820, (u, o) => o.setAlpha(0.15 + 0.35 * Math.abs(Math.sin(u * u * 26))).setScale(0.6 + u * 0.4), T.startup); }
    this.add((t) => {
      if (t < T.startup + 800) return true;
      this.floorRing(p.x, p.y, 120, FUCHSIA_2, 380);
      const er = this.kit('x_erupt', p.x, p.y, 230, p.y + 3); if (er) { er.setOrigin(0.5, 0.97); const e0 = er.scale; this.piece(er, 460, (u, o) => o.setScale(e0 * lerp(0.7, 1.1, out3(u)), e0 * lerp(0.2, 1.15, out3(u))).setAlpha(u < 0.55 ? 1 : (1 - u) / 0.45)); } else
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
    let disc: Phaser.GameObjects.Image | null | undefined, flung = 0, dtLast = 0;
    this.add((t, dt) => {
      dtLast += dt;
      const c = this.ctx.casterPos(r.attackerId);
      if (t >= T.startup + T.active || !c) { this.piece(g, 160, (u, o) => o.setAlpha(1 - u)); if (disc) this.piece(disc, 160, (u, o) => o.setAlpha(1 - u)); return false; }
      if (t < T.startup) return true;
      const side = sideOf(r), cx = c.x + side * 44, cy = c.y - c.z - 58, R = 62, a0 = t * 0.045;
      g.clear().setDepth(c.y + 4);
      if (this.ctx.scene.textures.exists('gbk-s_disc')) {
        disc ??= this.kit('s_disc', cx, cy, 2.2 * R, c.y + 4);
        if (disc) { const w = 2.2 * R / disc.width; disc.setPosition(cx, cy).setDepth(c.y + 4).setAngle(90).setScale(w * (0.95 + 0.05 * Math.sin(t * 0.05)), w * 0.55).setFlipY(Math.floor(t / 45) % 2 === 1); }
        if (Math.random() < 0.25) this.pop(cx + rnd(-10, 10), cy + rnd(-R, R), 26, FUCHSIA_2, 160);
        flung += dtLast; dtLast = 0;
        while (flung >= 45) { // cards spun out of the circle nonstop, flung ahead in a fan across the floor's depth
          flung -= 45;
          const sy = cy + rnd(-R * 0.8, R * 0.8), ang = rnd(-0.35, 0.35), dist = rnd(150, 240), dep = rnd(-28, 28), spin = rnd(-900, 900);
          const im = this.ctx.scene.add.image(cx, sy, this.BK).setScale(this.u * 0.26).setDepth(c.y + 5);
          const tr = this.kit('k_streak', cx, sy, 70, c.y + 4); if (tr) tr.setOrigin(0.97, 0.5).setFlipX(side < 0).setAlpha(0.8);
          const x1 = cx + side * Math.cos(ang) * dist, y1 = sy + Math.sin(ang) * dist * 0.35 + dep;
          this.piece(im, 260, (u, o) => { o.setPosition(lerp(cx, x1, out3(u)), lerp(sy, y1, out3(u))).setAngle(spin * u).setAlpha(u > 0.75 ? (1 - u) / 0.25 : 1); if (tr) tr.setPosition(o.x, o.y).setAngle(Math.atan2(y1 - sy, x1 - cx) * 57.3 + (side < 0 ? 180 : 0)).setAlpha(0.8 * (1 - u)); });
          if (tr) this.add((t) => { if (t > 270) { tr.destroy(); return false; } return true; });
        }
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
        // the ball skips over the pockets: it bounces at each one it crosses, with a spark; ever slower, ever louder
        const pocketNow = Math.floor((ba - rot) / ((Math.PI * 2) / 18));
        const st = spin as unknown as { pk?: number; tense?: boolean };
        const hop = u < 1 ? Math.abs(Math.sin(((ba - rot) / ((Math.PI * 2) / 18)) * Math.PI)) * (6 + 10 * u) : 0;
        ball.setPosition(cx + Math.cos(ba) * rx * br, cy + Math.sin(ba) * ry * 0.5 * br - 4 - hop).setVisible(t > T.startup).setAlpha(fade);
        if (t > T.startup && u < 1 && st.pk !== undefined && pocketNow !== st.pk && u > 0.45) {
          this.pop(ball.x, ball.y + 4, 22 + 26 * u, u > 0.8 ? 0xffffff : FUCHSIA_2, 140);
          if (u > 0.7) this.ctx.cam().shake(40, 0.0015 + u * 0.002);
        }
        st.pk = pocketNow;
        if (!st.tense && u > 0.72) { st.tense = true; this.ctx.darken(spinMs * 0.3 + 500, 0.28); } // the last turns: the world holds its breath
        if (u >= 1 && !(spin as unknown as { won?: boolean }).won) { // it drops in: a beat of stillness, the pocket lights up
          (spin as unknown as { won?: boolean }).won = true; this.pop(ball.x, ball.y, 110, res.red ? FUCHSIA : 0xffffff, 420);
          this.ctx.freeze(160); this.ctx.punch(0.07, 360);
          const pillar = this.kit('k_beam', ball.x, ball.y, 200, GROUND + 6); if (pillar) { pillar.setOrigin(0.5, 0.97).setTint(res.red ? 0xffffff : 0xb8a8d0); const p0 = pillar.scale; this.piece(pillar, 500, (uu, o) => o.setScale(p0 * 0.6, p0 * lerp(0.2, 1, out3(uu))).setAlpha(1 - uu)); }
        }
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
    if (res.red) { // RED: the wheel erupts
      this.ctx.flash(0xff2bd6, 0.32, 200);
      this.burst(p.x, p.y - 40, 300, 0, p.y + 3);
      this.beam(p.x, p.y, 380, 480);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; this.burst(p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 130 * SQUASH - 20, 110, 60 + k * 25, p.y + 3); }
      this.floorRing(p.x, p.y, 200, FUCHSIA, 500); this.scar(p.x, p.y, 140);
      this.ctx.cam().shake(380, 0.014); this.ctx.freeze(90);
    } else { // BLACK: the cage slams shut
      this.ctx.flash(0xd8d0e8, 0.22, 160); this.ctx.cam().shake(220, 0.01); this.ctx.freeze(70); // black: a cage of standing cards round everyone in the wheel for 2s
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

  /** Ace in the Hole: the ace between two fingers, a glint gathering on it, the aim line flickering ahead, a snap. */
  private aceAim(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r);
    const card = s.add.image(0, 0, this.acePic).setScale(this.u * 0.42).setDepth(TOP + 4);
    const charge = this.kit('k_charge', 0, 0, 70, TOP + 3), line = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.add((t) => {
      const h = this.ctx.hand(r.attackerId), c = this.ctx.casterPos(r.attackerId);
      if (t >= T.startup || !h || !c) { // the release: a sonic ring at his hand, a flash, the camera kicked
        card.destroy(); charge?.destroy(); this.piece(line, 120, (u, o) => o.setAlpha(1 - u));
        if (h) {
          this.pop(h.x, h.y, 170, 0xffffff, 220); this.shards(h.x, h.y, 6, 80, 300);
          const ring = this.kit('k_ring', h.x + side * 20, h.y, 120, TOP + 4); if (ring) { ring.setAngle(90); const r0 = ring.scale; this.piece(ring, 260, (u, o) => o.setScale(r0 * lerp(0.4, 1.4, out3(u)), r0 * lerp(0.4, 1.4, out3(u))).setAlpha(1 - u)); }
        }
        this.ctx.punch(0.05, 220); this.ctx.freeze(45); this.ctx.cam().shake(160, 0.007); this.ctx.flash(0xffffff, 0.18, 90);
        return false;
      }
      const u = t / T.startup;
      if (Math.random() < 0.5) { const a = rnd(0, Math.PI * 2), d = rnd(50, 90), m = this.glow(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 16, FUCHSIA_2, TOP + 3); this.piece(m, 180, (uu, o) => o.setPosition(lerp(h.x + Math.cos(a) * d, h.x, out3(uu)), lerp(h.y + Math.sin(a) * d, h.y - 18, out3(uu))).setAlpha(1 - uu * 0.5)); }
      card.setPosition(h.x - side * 6, h.y - 18 - u * 6).setAngle(side * (-30 + u * 20) + Math.sin(t * 0.05) * 3);
      if (charge) charge.setPosition(card.x, card.y).setAngle(card.angle).setAlpha(0.4 + 0.6 * u).setScale((60 + 30 * u) / charge.width);
      line.clear().setDepth(c.y + 1);
      const y = c.y - c.z - 60, a = 0.15 + 0.5 * u * (0.6 + 0.4 * Math.sin(t * 0.08));
      line.lineStyle(2, FUCHSIA_2, a).lineBetween(h.x, y, h.x + side * 700 * out3(u), y);
      line.lineStyle(8, FUCHSIA, a * 0.35).lineBetween(h.x, y, h.x + side * 700 * out3(u), y);
      return true;
    });
  }

  /** 52 Pickup: the deck is drawn into his hand in a whirl, then sprayed as a sweeping stream (near to far, one side to the other);
   *  the cards stand in the floor turning and blinking, the waves tear through them, the last wave sucks the rest up and blows. */
  private pickCards = new Map<string, { im: Phaser.GameObjects.Image; wave: number; x: number; y: number }[]>();
  private deckSpray(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r);
    // wind-up: cards whirl in toward his hand
    this.add((t) => {
      if (t >= T.startup) return false;
      const h = this.ctx.hand(r.attackerId); if (!h || Math.random() > 0.55) return true;
      const a = rnd(0, Math.PI * 2), d = rnd(90, 160), im = s.add.image(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.7, this.BK).setScale(this.u * 0.22).setDepth(TOP + 3);
      this.piece(im, 200, (u, o) => { const hh = this.ctx.hand(r.attackerId) ?? h, aa = a + u * 2.5, dd = d * (1 - out3(u)); o.setPosition(hh.x + Math.cos(aa) * dd, hh.y + Math.sin(aa) * dd * 0.7).setAngle(u * 540).setAlpha(0.4 + 0.6 * u); });
      return true;
    });
    const list: { im: Phaser.GameObjects.Image; wave: number; x: number; y: number }[] = [];
    this.pickCards.set(r.castId, list);
    const N = 48, streamMs = 240, base = Math.atan2(r.aim.y, r.aim.x);
    let sent = 0;
    this.add((t) => {
      if (t < T.startup) return true;
      const c = this.me(r), hx = c.x + side * 22, hy = c.y - c.z - 62;
      const want = Math.min(N, Math.floor(((t - T.startup) / streamMs) * N) + 1);
      if (sent === 0) { // the release: a fan of light from his hand, a kick of the camera
        this.stroke('s_heavy', hx + side * 60, hy, 200, side, 280, c.y + 3, -10);
        this.ctx.punch(0.04, 220); this.ctx.cam().shake(260, 0.006);
      }
      for (; sent < want; sent++) {
        const k = sent / N, sweep = Math.sin(k * Math.PI * 3) * 0.55, dist = 85 + k * 360 + rnd(-20, 20);
        const ang = base + sweep, x1 = c.x + Math.cos(ang) * dist, y1 = c.y + Math.sin(ang) * dist * 0.8;
        const wave = Math.min(3, Math.max(0, Math.floor((dist - 85) / 95)));
        const im = s.add.image(hx, hy, this.BK).setScale(this.u * 0.36).setDepth(y1 + 2);
        const tr = this.kit('k_streak', hx, hy, 110, y1 + 1); if (tr) tr.setOrigin(0.97, 0.5).setFlipX(side < 0);
        const fly = 110 + k * 120, spin = rnd(500, 900) * (Math.random() < 0.5 ? -1 : 1), ph = rnd(0, 6);
        const card = { im, wave, x: x1, y: y1 }; list.push(card);
        let age = 0;
        this.add((_, dt) => {
          age += dt;
          if (!im.active) { tr?.destroy(); return false; }
          if (age < fly) { const q = out3(age / fly); im.setPosition(lerp(hx, x1, q), lerp(hy, y1 - 12, q) - Math.sin(q * Math.PI) * 24).setAngle(spin * q); if (tr) tr.setPosition(im.x, im.y).setAngle(Math.atan2(y1 - 12 - hy, x1 - hx) * 57.3 + (side < 0 ? 180 : 0)).setAlpha(1 - q); return true; }
          if (tr && tr.active) { tr.destroy(); this.pop(x1, y1 - 10, 34, FUCHSIA_2, 140); }
          // standing in the floor: it turns slowly (its face narrowing) and blinks
          const turn = Math.cos(age * 0.012 + ph);
          im.setPosition(x1, y1 - 12).setAngle(side * 8).setScale(this.u * 0.36 * (0.25 + 0.75 * Math.abs(turn)), this.u * 0.32).setTint(Math.sin(age * 0.05 + ph) > 0.3 ? 0xffffff : FUCHSIA);
          return age < 2200;
        });
      }
      return sent < N;
    });
  }
  /** A wave of 52 Pickup: its cards are torn out of the floor and blow; the last wave sucks the rest up and blows them all. */
  private pickWave(r: CastRun, i: number): void {
    const list = this.pickCards.get(r.castId) ?? [], w = i - 1, last = i === 4;
    const mine = list.filter((c) => (last ? c.im.active : c.wave === w && c.im.active));
    const p = this.ahead(r, 90 + w * 95), perp = { x: -r.aim.y, y: r.aim.x }, span = 60 + w * 55;
    if (last) { // the vortex: every card left is pulled into one point, rises, and the whole deck goes off
      const vx = this.kit('k_vortex', p.x, p.y, 320, GROUND + 3);
      if (vx) { const kx = vx.scaleX, ky = (320 * SQUASH) / vx.height; this.piece(vx, 420, (u, o) => o.setScale(kx * (1 - u * 0.6), ky * (1 - u * 0.6)).setAngle(-u * 200).setAlpha(1 - u * u)); }
      for (const c of mine) { const x0 = c.im.x, y0 = c.im.y; this.piece(c.im, 240, (u, o) => o.setPosition(lerp(x0, p.x, out3(u)), lerp(y0, p.y - 40, out3(u)) - u * 60).setAngle(u * 720).setScale(this.u * 0.36 * (1 - u * 0.5))); }
      const tor = this.kit('x_tornado', p.x, p.y, 300, p.y + 2); if (tor) { tor.setOrigin(0.5, 0.97); const t0 = tor.scale; this.piece(tor, 620, (u, o) => o.setScale(t0 * lerp(0.6, 1.1, out3(u)), t0 * lerp(0.2, 1.2, out3(u))).setFlipX(Math.floor(u * 12) % 2 === 1).setAlpha(u < 0.6 ? 1 : (1 - u) / 0.4)); }
      this.add((t) => { if (t < 220) return true; this.burst(p.x, p.y - 80, 300, 0, p.y + 3); this.beam(p.x, p.y, 380, 460); this.floorRing(p.x, p.y, 220, FUCHSIA, 460); this.ctx.cam().shake(320, 0.014); this.ctx.freeze(90); this.ctx.punch(0.06, 300); this.ctx.flash(0xffe0f8, 0.3, 160); return false; });
      this.pickCards.delete(r.castId);
      return;
    }
    for (const c of mine) { // each card of the wave is ripped up out of the floor and pops in the air
      const x0 = c.im.x, y0 = c.im.y, d = rnd(0, 60);
      this.piece(c.im, 120 + d, (u, o) => o.setPosition(x0, y0 - out3(u) * 40).setAngle(u * 360).setTint(0xffffff));
      this.pop(x0, y0 - 40, 70, FUCHSIA, 240, 110 + d, y0 + 3);
    }
    for (const k of [-1, 0, 1]) { const q = { x: p.x + perp.x * span * k, y: p.y + perp.y * span * k * 0.8 }; this.burst(q.x, q.y - 26, 130, 60 + Math.abs(k) * 40, q.y + 2); }
    this.floorRing(p.x, p.y, span + 60, FUCHSIA, 360);
    this.ctx.cam().shake(110, 0.005); this.ctx.freeze(35);
  }

  /** Grand Slam's wind-up: energy pours into the staff over his shoulder — motes drawn in, arcs crackling, a swelling glow; dust at his feet. */
  private slamCharge(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r), o0 = this.me(r);
    const glow = this.glow(0, 0, 120, FUCHSIA, 0);
    this.ctx.dust(o0.x, o0.y, 80);
    this.add((t) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (t >= T.startup || !c) { glow.destroy(); return false; }
      const u = t / T.startup, sx = c.x - side * 26, sy = c.y - c.z - 100; // the staff's head, over his back shoulder
      glow.setPosition(sx, sy).setDepth(c.y + 3).setAlpha(0.35 + 0.5 * u).setScale((80 + 120 * u) / 128);
      if (Math.random() < 0.5) { // motes drawn into the staff
        const a = rnd(0, Math.PI * 2), d = rnd(70, 130), m = this.glow(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 18, FUCHSIA_2, c.y + 3);
        this.piece(m, 220, (uu, o) => o.setPosition(lerp(sx + Math.cos(a) * d, sx, out3(uu)), lerp(sy + Math.sin(a) * d, sy, out3(uu))).setAlpha(1 - uu * 0.5));
      }
      if (Math.random() < 0.3 + u * 0.4) { const a = this.kit('k_arcs', sx + rnd(-20, 20), sy + rnd(-30, 30), rnd(60, 100), c.y + 4); if (a) { const a0 = a.scale; a.setAngle(rnd(0, 360)); this.piece(a, 110, (uu, o) => o.setAlpha(1 - uu).setScale(a0 * (1 + uu * 0.2))); } }
      return true;
    });
    this.floorRing(o0.x, o0.y, 90, FUCHSIA, T.startup);
    void s;
  }

  private overloadCast(r: CastRun): void {
    const T = r.timings, c = this.me(r);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const g = this.glow(c.x + Math.cos(a) * 140, c.y - c.z - 60 + Math.sin(a) * 80, 50); this.piece(g, T.startup, (u, o) => o.setPosition(lerp(c.x + Math.cos(a) * 140, c.x, out3(u)), lerp(c.y - c.z - 60 + Math.sin(a) * 80, c.y - c.z - 60, out3(u))).setAlpha(u)); }
  }
  /** Kinetic Overload's charge stays on him (an outline of crackling arcs). */
  overload(id: string, ms: number): void {
    this.overloads.get(id)?.g.destroy(); this.overloads.get(id)?.glow.destroy();
    const g = this.ctx.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), glow = this.kit('x_aura', 0, 0, 120, 0) ?? this.glow(0, 0, 170, FUCHSIA, 0).setAlpha(0.35);
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
      if (o.glow.texture.key === 'gbk-x_aura') o.glow.setOrigin(0.5, 0.95).setPosition(c.x, c.y - c.z + 6).setDepth(c.y - 1).setDisplaySize(118 * (1 + 0.04 * Math.sin(this.clock * 0.02)), 190).setAlpha(0.55 + 0.25 * Math.sin(this.clock * 0.013)).setFlipX(Math.floor(this.clock / 90) % 2 === 1);
      else o.glow.setPosition(c.x, c.y - c.z - 60).setDepth(c.y - 1).setAlpha(0.25 + 0.12 * Math.sin(this.clock * 0.01));
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
    if (id === 'ace_in_the_hole') { // the ace's blast at the end of its flight
      const bl = this.kit('k_blast', x, y - 60, 320, y + 4); if (bl) { const b0 = bl.scale; this.piece(bl, 460, (u, o) => o.setScale(b0 * lerp(0.4, 1.2, out3(u))).setAlpha(u < 0.6 ? 1 : (1 - u) / 0.4)); }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, im = this.ctx.scene.add.image(x, y - 60, this.acePic).setScale(this.u * 0.3).setDepth(y + 5); this.piece(im, 520, (u, o) => o.setPosition(x + Math.cos(a) * 170 * out3(u), y - 60 + Math.sin(a) * 90 * out3(u) + 40 * u * u).setAngle(u * 600).setAlpha(1 - u * u)); }
      this.pop(x, y - 60, 260, 0xffffff, 260); this.floorRing(x, y, r * 1.3, FUCHSIA, 420); this.scar(x, y, r);
      this.ctx.cam().shake(260, 0.012); this.ctx.freeze(80); this.ctx.flash(0xffe0f8, 0.25, 120);
      return;
    }
    if (id === 'card_swap') { this.burst(x, y - 34, 170, 0, y + 3); this.floorRing(x, y, r, FUCHSIA_2, 360); this.beam(x, y, 220, 320); this.ctx.cam().shake(140, 0.006); return; }
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
  /** Card Swap: a card flicked ahead; he flashes to it in a streak of light; the card left where he stood stands in the floor, blinking. */
  private cardSwap(r: CastRun): void {
    const s = this.ctx.scene, o = r.origin, side = sideOf(r), T = r.timings;
    const to = { x: o.x + r.aim.x * 210, y: o.y + r.aim.y * 210 };
    this.pop(o.x, o.y - o.z - 60, 120, 0xffffff, 200); this.shards(o.x, o.y - o.z - 60, 6, 70, 320);
    const left = s.add.image(o.x, o.y, this.BK).setOrigin(0.5, 1).setScale(this.u * 0.5).setDepth(o.y + 1);
    const ch = this.kit('k_charge', o.x, o.y - 30, 80, o.y + 2);
    this.piece(left, 460, (u, im) => { const bl = Math.sin(u * u * 40) > 0; im.setTint(bl ? 0xffffff : FUCHSIA); if (ch) ch.setAlpha(0.4 + 0.6 * u).setScale((60 + 40 * u) / ch.width); });
    if (ch) this.add((t) => { if (t > 460) { ch.destroy(); return false; } return true; });
    const st = this.kit('k_streak', to.x, to.y - o.z - 60, 230, Math.max(o.y, to.y) + 2);
    if (st) { st.setOrigin(0.97, 0.5).setFlipX(side < 0).setAngle(Math.atan2((to.y - o.y) * 0.5, (to.x - o.x) * side) * 57.3 * side); const s0 = st.scale; this.piece(st, 260, (u, im) => im.setAlpha(1 - u).setScale(s0 * (1 + u * 0.1), s0 * (1 - u * 0.6)), T.startup); }
    this.add((t) => { if (t < T.startup + T.active) return true; this.pop(to.x, to.y - o.z - 60, 120, FUCHSIA, 260); this.shards(to.x, to.y - o.z - 60, 5, 60, 300); return false; });
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
