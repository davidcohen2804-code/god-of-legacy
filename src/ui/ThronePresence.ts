// Character Select / Create: the warrior seated on his throne with the sword of light planted beside him.
// One painted image (GPT) brought to life in render only: breathing and cape wind (displacement maps baked by
// tools/hero/throne_maps.py), a pulsing light blade with lightning sparks and rising light motes, and a rune dais.
import Phaser from 'phaser';

const DIR = 'assets/final/heroes/warrior';
/** Painting geometry in source pixels (1024x1536). */
const SRC = { w: 1024, h: 1536, baseV: 1398 / 1536 } as const;
const BLADE = { pommel: [138, 515], top: [138, 690], tip: [124, 1426] } as const;
/** Dais painting (1894x564): the throne's front base line sits at this row of the top surface. */
const DAIS = { w: 1894, h: 564, seatV: 270 / 564, widthPerK: 1508 } as const;

interface Bolt { pts: { x: number; y: number }[]; life: number; max: number; kind: 'crawl' | 'arc' | 'ground' }

export function preloadThrone(scene: Phaser.Scene): void {
  const I = (k: string, f: string) => { if (!scene.textures.exists(k)) scene.load.image(k, `${DIR}/${f}.png`); };
  I('throne.hero', 'throne'); I('throne.breath', 'throne_breath'); I('throne.wind_a', 'throne_wind_a'); I('throne.wind_b', 'throne_wind_b');
  I('throne.dais', 'dais'); I('throne.dais_runes', 'dais_runes');
}

function softTex(scene: Phaser.Scene, key: string, stops: [number, string][]): void {
  if (scene.textures.exists(key)) return;
  const c = scene.textures.createCanvas(key, 128, 128)!, ctx = c.getContext();
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  c.refresh();
}

export class ThroneHero {
  readonly root: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private dais?: Phaser.GameObjects.Image;
  private runes?: Phaser.GameObjects.Image;
  private daisG?: Phaser.GameObjects.Graphics;
  private bladeGlow: Phaser.GameObjects.Image;
  private bladeCore: Phaser.GameObjects.Image;
  private tipGlow: Phaser.GameObjects.Image;
  private pommelGlow: Phaser.GameObjects.Image;
  private bolts: Phaser.GameObjects.Graphics;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private breath?: Phaser.FX.Displacement;
  private windA?: Phaser.FX.Displacement;
  private windB?: Phaser.FX.Displacement;
  private t = 0;
  private nextBolt = 400;
  private live: Bolt[] = [];
  private nextCrawl = 0;
  private nextDischarge = 900;
  private flash = 0;
  private bladeCyan: Phaser.GameObjects.Image;
  private readonly k: number;

  /** `base` = screen point where the throne's front base meets the dais; `height` = throne height on screen. */
  constructor(private scene: Phaser.Scene, base: { x: number; y: number }, height: number, depth = 2) {
    this.k = height / (SRC.h * SRC.baseV - 10);
    const k = this.k;
    softTex(scene, 'throne.soft', [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
    softTex(scene, 'throne.mote', [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,250,220,.8)'], [1, 'rgba(255,230,160,0)']]);
    this.root = scene.add.container(0, 0).setDepth(depth);

    // Dais: painted art (rune ring pulses additively), otherwise a drawn rune ring.
    const dw = 1180 * k, dy = base.y + 8 * k;
    if (scene.textures.exists('throne.dais')) {
      const ds = (DAIS.widthPerK * k) / DAIS.w;
      this.dais = scene.add.image(base.x, base.y, 'throne.dais').setOrigin(0.5, DAIS.seatV).setScale(ds);
      this.root.add(this.dais);
      if (scene.textures.exists('throne.dais_runes')) {
        this.runes = scene.add.image(base.x, base.y, 'throne.dais_runes').setOrigin(0.5, DAIS.seatV).setScale(ds).setBlendMode(Phaser.BlendModes.ADD);
        this.root.add(this.runes);
      }
      // contact shadow under the throne's base
      const sh = scene.add.ellipse(base.x + 10 * k, base.y - 18 * k, 980 * k, 120 * k, 0x000000, 0.45);
      this.root.add(sh);
    } else {
      this.daisG = scene.add.graphics();
      this.root.add(this.daisG);
      this.drawDais(base.x, dy, dw / 2, dw * 0.12);
    }

    this.img = scene.add.image(base.x, base.y, 'throne.hero').setOrigin(0.5, SRC.baseV).setScale(k);
    this.root.add(this.img);
    const fx = this.img.preFX;
    if (fx) {
      fx.padding = 4;
      // R channel drives both axes (Phaser displacement): breath = vertical only, wind = horizontal only.
      this.breath = fx.addDisplacement('throne.breath', 0, 0);
      this.windA = fx.addDisplacement('throne.wind_a', 0, 0);
      this.windB = fx.addDisplacement('throne.wind_b', 0, 0);
    }

    // Sword of light.
    const P = (p: readonly number[]) => this.at(p[0], p[1]);
    const top = P(BLADE.top), tip = P(BLADE.tip), len = Math.hypot(tip.x - top.x, tip.y - top.y);
    const ang = Math.atan2(tip.y - top.y, tip.x - top.x) - Math.PI / 2;
    const mid = { x: (top.x + tip.x) / 2, y: (top.y + tip.y) / 2 };
    this.bladeGlow = scene.add.image(mid.x, mid.y, 'throne.soft').setTint(0xffd98a).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(70 * k * 2.2, len * 1.18).setRotation(ang);
    this.bladeCore = scene.add.image(mid.x, mid.y, 'throne.soft').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(26 * k * 2.2, len * 1.04).setRotation(ang);
    this.bladeCyan = scene.add.image(mid.x, mid.y, 'throne.soft').setTint(0x5fd0ff).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(110 * k * 2.2, len * 1.12).setRotation(ang);
    this.tipGlow = scene.add.image(tip.x, tip.y - 4 * k, 'throne.soft').setTint(0xffc860).setBlendMode(Phaser.BlendModes.ADD);
    this.pommelGlow = scene.add.image(P(BLADE.pommel).x, P(BLADE.pommel).y, 'throne.soft').setTint(0xffe7a0).setBlendMode(Phaser.BlendModes.ADD);
    this.bolts = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    // Light motes rising off the blade.
    this.motes = scene.add.particles(0, 0, 'throne.mote', {
      emitZone: { type: 'random', source: new Phaser.Geom.Line(top.x, top.y, tip.x, tip.y), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1600, max: 3000 }, speedY: { min: -60 * k * 2, max: -22 * k * 2 }, speedX: { min: -14, max: 14 },
      scale: { start: 0.2 * k * 2, end: 0.02 }, alpha: { start: 1, end: 0 }, tint: [0xfff4d0, 0xffd27a, 0xbff4ff],
      frequency: 70, blendMode: Phaser.BlendModes.ADD,
    });
    this.root.add([this.bladeCyan, this.bladeGlow, this.bladeCore, this.tipGlow, this.pommelGlow, this.motes, this.bolts]);

    const tick = (_t: number, dt: number) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
  }

  setVisible(v: boolean): void { this.root.setVisible(v); this.motes.emitting = v && ThroneHero.PROCEDURAL_FX; }
  get visible(): boolean { return this.root.visible; }

  /** Painting pixel → screen. */
  private at(px: number, py: number): { x: number; y: number } {
    const i = this.img ?? { x: 0, y: 0 };
    return { x: i.x + (px - SRC.w / 2) * this.k, y: i.y + (py - SRC.h * SRC.baseV) * this.k };
  }

  private drawDais(x: number, y: number, rx: number, ry: number): void {
    const g = this.daisG!;
    g.clear();
    g.fillStyle(0x07090f, 0.82).fillEllipse(x, y + 10, rx * 2.06, ry * 2.3);
    g.fillStyle(0x1b1d24, 1).fillEllipse(x, y, rx * 2, ry * 2);
    g.lineStyle(3, 0xc99a45, 0.9).strokeEllipse(x, y, rx * 2, ry * 2);
    g.lineStyle(1.5, 0xc99a45, 0.5).strokeEllipse(x, y, rx * 1.7, ry * 1.7);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      g.fillStyle(0xffc860, 0.55).fillRect(x + Math.cos(a) * rx * 0.85 - 2, y + Math.sin(a) * ry * 0.85 - 1, 4, 2);
    }
  }

  /** Procedural electricity / dot motes read as cheap: off until painted effect sheets replace them. */
  private static readonly PROCEDURAL_FX = false;

  private update(dt: number): void {
    if (!this.root.visible) return;
    this.t += dt;
    const t = this.t, k = this.k;
    // Breathing: slow inhale, quicker exhale (~4.4 s); chest lifts ~1.6 px, head follows.
    const ph = (t % 4400) / 4400, br = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI / 2) : Math.cos(((ph - 0.55) / 0.45) * Math.PI / 2);
    const h = this.img.displayHeight;
    if (this.breath) { this.breath.x = 0; this.breath.y = (2 * 1.7 * br) / h; }
    // Cape wind: travelling sway with slow gusts (~2.6 px at the hem).
    const gust = 0.7 + 0.3 * Math.sin((t / 5600) * Math.PI * 2), w = (t / 1900) * Math.PI * 2, amp = (2 * 2.6) / this.img.displayWidth;
    if (this.windA && this.windB) { this.windA.x = amp * gust * Math.cos(w); this.windA.y = 0; this.windB.x = amp * gust * Math.sin(w); this.windB.y = 0; }

    // Rune ring breathing with the blade.
    if (this.runes) this.runes.setAlpha(0.18 + 0.3 * (0.5 + 0.5 * Math.sin((t / 2600) * Math.PI * 2)));

    // Light blade pulse.
    const p = 0.5 + 0.5 * Math.sin((t / 1300) * Math.PI * 2), flick = 0.06 * Math.sin(t / 37) * Math.sin(t / 53);
    this.bladeGlow.setAlpha(0.12 + 0.12 * p + flick * 0.5);
    this.bladeCore.setAlpha(0.04 + 0.06 * p);
    const tp = 0.5 + 0.5 * Math.sin((t / 1700) * Math.PI * 2 + 1.2);
    this.tipGlow.setAlpha(0.25 + 0.2 * tp).setDisplaySize((130 + 40 * tp) * k * 2, (46 + 12 * tp) * k * 2);
    this.pommelGlow.setAlpha(0.2 + 0.15 * p).setDisplaySize((60 + 16 * p) * k * 2, (60 + 16 * p) * k * 2);

    // Electricity: crawling arcs hugging the blade (re-drawn every ~70 ms), outward arcs with branches, and a
    // discharge into the dais around the tip every couple of seconds.
    if (!ThroneHero.PROCEDURAL_FX) { this.bolts.clear(); this.bladeCyan.setAlpha(0); return; }
    this.nextCrawl -= dt;
    if (this.nextCrawl <= 0) {
      this.nextCrawl = 55 + Math.random() * 40;
      this.live = this.live.filter((b) => b.kind !== 'crawl');
      for (let i = 0; i < 2; i++) this.live.push(this.makeCrawl());
    }
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 350 + Math.random() * 900;
      this.live.push(this.makeBolt());
      if (Math.random() < 0.35) this.live.push(this.makeBolt());
    }
    this.nextDischarge -= dt;
    if (this.nextDischarge <= 0) {
      this.nextDischarge = 1800 + Math.random() * 1800;
      for (let i = 0; i < 4; i++) this.live.push(this.makeGroundArc());
      this.flash = 1;
    }
    this.flash = Math.max(0, this.flash - dt / 260);
    this.tipGlow.setAlpha(Math.min(1, this.tipGlow.alpha + 0.5 * this.flash));
    this.bladeCyan.setAlpha(0.16 + 0.14 * Math.random() * (0.6 + 0.4 * p) + 0.3 * this.flash);
    this.bolts.clear();
    this.live = this.live.filter((b) => (b.life += dt) < b.max);
    for (const b of this.live) {
      const a = (b.kind === 'crawl' ? 0.85 : 1 - b.life / b.max) * (Math.random() < 0.12 ? 0.35 : 1);
      const w = b.kind === 'crawl' ? 0.7 : 1;
      this.bolts.lineStyle(10 * k * 2 * w, 0x3fb8ff, 0.2 * a); this.bolts.strokePoints(b.pts);
      this.bolts.lineStyle(4.5 * k * 2 * w, 0x8fe6ff, 0.5 * a); this.bolts.strokePoints(b.pts);
      this.bolts.lineStyle(1.9 * k * 2 * w, 0xf4fdff, a); this.bolts.strokePoints(b.pts);
    }
  }

  /** Arc running along a stretch of the blade, zig-zagging across its edges. */
  private makeCrawl(): Bolt {
    const q0 = Math.random() * 0.75, q1 = Math.min(1, q0 + 0.12 + Math.random() * 0.22), n = 7 + Math.floor(Math.random() * 5), pts = [];
    for (let i = 0; i <= n; i++) {
      const q = q0 + ((q1 - q0) * i) / n, x = BLADE.top[0] + (BLADE.tip[0] - BLADE.top[0]) * q, y = BLADE.top[1] + (BLADE.tip[1] - BLADE.top[1]) * q;
      pts.push(this.at(x + (i % 2 ? 1 : -1) * (30 + Math.random() * 22), y + (Math.random() - 0.5) * 14));
    }
    return { pts, life: 0, max: 140, kind: 'crawl' };
  }

  /** Ground discharge: short jagged arcs fanning over the dais around the sword tip. */
  private makeGroundArc(): Bolt {
    const a = Math.random() * Math.PI, len = 60 + Math.random() * 110, pts = [this.at(BLADE.tip[0], BLADE.tip[1] - 8)];
    let x = BLADE.tip[0], y = BLADE.tip[1] - 8;
    for (let i = 1; i <= 5; i++) {
      x += Math.cos(a) * (len / 5) * (Math.random() < 0.5 ? 1 : -1) * 0.9 + (Math.random() - 0.5) * 20;
      y += Math.sin(a) * (len / 5) * 0.25 + (Math.random() - 0.5) * 10;
      pts.push(this.at(x, y));
    }
    return { pts, life: 0, max: 160 + Math.random() * 120, kind: 'ground' };
  }

  private makeBolt(): Bolt {
    const k = this.k, q = 0.05 + Math.random() * 0.9;
    const x0 = BLADE.top[0] + (BLADE.tip[0] - BLADE.top[0]) * q, y0 = BLADE.top[1] + (BLADE.tip[1] - BLADE.top[1]) * q;
    const side = Math.random() < 0.5 ? -1 : 1, segs = 4 + Math.floor(Math.random() * 3);
    const pts = [this.at(x0 + side * 26, y0)];
    let x = x0 + side * 26, y = y0;
    for (let i = 0; i < segs; i++) {
      x += side * (14 + Math.random() * 24); y += (Math.random() - 0.5) * 56;
      // arcs curl back toward the blade every other segment (electricity hugging the sword)
      if (i % 2 === 1) x -= side * (6 + Math.random() * 10);
      pts.push(this.at(x, y));
    }
    void k;
    return { pts, life: 0, max: 110 + Math.random() * 130, kind: 'arc' };
  }
}
