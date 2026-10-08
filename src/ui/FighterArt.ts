// The PvP select screen's two fighters brought to life (render only): the hero's card breathes and its cloth moves in
// the wind (displacement maps made from the card itself: the cloth by its colour, never the weapon), a soft light of its
// class colour behind it and at its feet with embers rising, light runs along the blade (the mage's book glows and his
// crystal twinkles; the archer's bow and arrow catch the light) — the painting itself stays clean, no glow around its
// outline. It slides in when the fighter changes, flashes white when it is locked in (its light brighter after), and stands
// as a dark silhouette while the opponent is still unknown.
import Phaser from 'phaser';

/** live: still choosing; locked: picked; shade: not chosen yet (VS CPU, before you pick yours). */
export type ArtState = 'live' | 'locked' | 'shade';
type UV = readonly [number, number];
/** A line on the card (u across, v down, fractions of the card): a → b, bent through c; r = half its width (of the card width). */
interface Stroke { a: UV; b: UV; c?: UV; r: number }
interface Look {
  /** Its light and its embers. */
  color: number;
  /** How much a pixel is cloth that the wind moves (h 0–360, s / l 0–1, u / v its place on the card). */
  cloth(h: number, s: number, l: number, u: number, v: number): number;
  /** Rigid parts the wind never bends (the weapon). */
  keep: Stroke[];
  /** Parts that stay still however close to the cloth (hands, feet): boxes u0, v0, u1, v1. */
  still: [number, number, number, number][];
  /** Light that runs along the weapon every few seconds (and a star at its tip). */
  gleam?: Stroke & { tint: number };
  /** Star glints that twinkle now and then (size: × 64 px). */
  stars: { at: UV; size: number }[];
  /** The mage's book: its light and the sparks rising off its pages. */
  book?: UV;
}

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** 1 inside the hue range a..b (degrees; a > b wraps past 360), fading out over 14° either side. */
const hue = (h: number, a: number, b: number) => {
  if (a <= b ? h >= a && h <= b : h >= a || h <= b) return 1;
  const d = (x: number) => Math.abs(((h - x + 540) % 360) - 180);
  return 1 - sm(0, 14, Math.min(d(a), d(b)));
};
const red = (h: number, s: number, l: number) => hue(h, 340, 16) * sm(0.3, 0.45, s) * sm(0.1, 0.2, l);

const LOOKS: Record<string, Look> = {
  warrior: {
    color: 0xffb04a,
    cloth: red, // the red cape and tabard
    keep: [{ a: [0.11, 0.39], b: [0.285, 0.522], r: 0.05 }, { a: [0.285, 0.522], b: [0.858, 0.892], r: 0.04 }],
    still: [[0.76, 0.38, 0.94, 0.54], [0.2, 0.9, 0.84, 1.02]], // his right gauntlet, his boots
    gleam: { a: [0.285, 0.522], b: [0.858, 0.892], r: 0, tint: 0xfff0c8 },
    stars: [],
  },
  samurai: {
    color: 0xff4a5a,
    cloth: (h, s, l, u, v) => Math.max(red(h, s, l), v > 0.5 ? (1 - sm(0.12, 0.26, l)) * sm(0.26, 0.4, Math.abs(u - 0.5)) : 0), // red cloth, and the dark rags at his sides
    keep: [{ a: [0.15, 0.455], b: [0.24, 0.56], r: 0.05 }, { a: [0.232, 0.551], c: [0.586, 0.759], b: [0.917, 0.835], r: 0.04 }],
    still: [[0.1, 0.36, 0.33, 0.58], [0.77, 0.42, 0.99, 0.6], [0.22, 0.73, 0.86, 1.02]], // his forearms and hands, his shins and feet
    gleam: { a: [0.232, 0.551], c: [0.586, 0.759], b: [0.917, 0.835], r: 0, tint: 0xfff4f0 },
    stars: [],
  },
  book_mage: {
    color: 0x6fc8ff,
    cloth: (h, s, l) => Math.max(hue(h, 205, 245) * sm(0.3, 0.45, s) * sm(0.18, 0.3, l), (1 - sm(0.12, 0.22, s)) * sm(0.7, 0.8, l)), // blue cape, white robe
    keep: [],
    still: [[0.33, 0.66, 0.7, 1.02]], // his boots
    stars: [{ at: [0.839, 0.086], size: 1.25 }],
    book: [0.222, 0.258],
  },
  archer: {
    color: 0x9be35a,
    cloth: (h, s, l) => hue(h, 70, 170) * sm(0.12, 0.22, s) * sm(0.06, 0.12, l), // the green cloak
    keep: [{ a: [0.9, 0.11], c: [0.95, 0.3], b: [0.86, 0.45], r: 0.07 }, { a: [0.86, 0.45], c: [0.88, 0.62], b: [0.8, 0.83], r: 0.07 }],
    still: [[0.3, 0.6, 0.76, 1.02]], // her legs
    stars: [{ at: [0.917, 0.476], size: 1 }, { at: [0.901, 0.128], size: 0.8 }],
  },
};

/** Where the fighters stand (design px): box 760 x 960, feet just under the bottom of the screen. */
const BOX = { w: 760, h: 960, bottom: 1090 };
const X = { l: 400, r: 1520 };
const DEPTH = 2;
/** preFX padding: room for the cloth to move past the card's edge. */
const PAD = 12;
/** Side of the displacement maps (they span the FX pass's square target; smooth, so small is enough). */
const MAP = 256;
const ADD = Phaser.BlendModes.ADD;

export class FighterArt {
  private readonly img: Phaser.GameObjects.Image;
  private readonly sil: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private readonly floor: Phaser.GameObjects.Image;
  private readonly flare: Phaser.GameObjects.Image;
  private readonly book: Phaser.GameObjects.Image;
  private readonly streak: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private readonly tip: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly pages: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly fx: { breath: Phaser.FX.Displacement; a: Phaser.FX.Displacement; b: Phaser.FX.Displacement; cm: Phaser.FX.ColorMatrix } | null = null;
  private readonly flip: boolean;
  private readonly x0: number;
  private cls: string | null = null;
  private look: Look | null = null;
  private state: ArtState = 'live';
  private bw = 1;
  private bh = 1;
  /** Side of the square the FX pass draws the card into (the maps span it). */
  private sq = 1024;
  private t = 0;
  /** The entrance, 0 → 1. */
  private enter = 1;
  private flashT = -1;
  private gleamT = -1;
  private nextGleam = 1600;
  private starT: number[] = [];
  /** How strongly its light burns (locked in: brighter), eased. */
  private power = 0.72;
  /** The entrance × the power (0: nothing shows), read by the particles every frame. */
  private fade = 0;
  private readonly tick = (_t: number, dt: number) => this.update(Math.min(dt, 50));

  constructor(private readonly scene: Phaser.Scene, side: 'l' | 'r') {
    this.flip = side === 'r';
    this.x0 = X[side];
    textures(scene);
    const img = (key: string, depth: number) => scene.add.image(0, 0, key).setDepth(depth).setVisible(false).setBlendMode(ADD);
    this.back = img('fa-soft', DEPTH - 0.4);
    this.flare = img('fa-soft', DEPTH - 0.35).setTint(0xffffff);
    const fade = (a: number) => ({ onEmit: () => 0, onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(Math.PI * t) * a * this.fade });
    this.floor = img('fa-soft', DEPTH - 0.2);
    this.img = scene.add.image(this.x0, BOX.bottom, '__DEFAULT').setOrigin(0.5, 1).setDepth(DEPTH).setFlipX(this.flip).setVisible(false);
    this.sil = scene.add.image(this.x0, BOX.bottom, '__DEFAULT').setDepth(DEPTH).setFlipX(this.flip).setVisible(false);
    this.book = img('fa-soft', DEPTH + 0.2).setTint(0x5ab4ff);
    this.pages = scene.add.particles(0, 0, 'life-mote', {
      frame: [0, 1, 2, 3, 4, 5, 6, 7], lifespan: { min: 1300, max: 2300 }, speedY: { min: -55, max: -20 }, speedX: { min: -16, max: 16 },
      scale: { min: 0.14, max: 0.26 }, alpha: fade(0.95), tint: 0xcfeaff, blendMode: ADD, frequency: 170, emitting: false,
    }).setDepth(DEPTH + 0.25);
    this.pages.addEmitZone({ type: 'random', source: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => { const b = this.look?.book ?? [0.5, 0.5]; return this.pick(p, b[0] - 0.12, b[0] + 0.12, b[1] - 0.04, b[1] + 0.03); } } });
    this.streak = img('fa-streak', DEPTH + 0.3);
    this.core = img('fa-streak', DEPTH + 0.31);
    this.tip = img('fa-star', DEPTH + 0.32);
    // Embers of its colour rising in front of it.
    this.embers = scene.add.particles(0, 0, 'life-mote', {
      frame: [0, 1, 2, 3, 4, 5, 6, 7], lifespan: { min: 2600, max: 4400 }, speedY: { min: -40, max: -14 }, speedX: { min: -9, max: 9 },
      scale: { min: 0.18, max: 0.36 }, alpha: fade(1), blendMode: ADD, frequency: 170, emitting: false,
    }).setDepth(DEPTH + 0.35);
    this.embers.addEmitZone({ type: 'random', source: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => this.pick(p, 0.05, 0.95, 0.34, 1) } });
    // Locked in: a burst of sparks off the chest.
    this.sparks = scene.add.particles(0, 0, 'life-mote', {
      frame: [0, 1, 2, 3, 4, 5, 6, 7], lifespan: { min: 520, max: 980 }, speed: { min: 180, max: 460 }, angle: { min: 0, max: 360 },
      scale: { start: 0.42, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: -160, blendMode: ADD, emitting: false,
    }).setDepth(DEPTH + 0.4);
    const pre = this.img.preFX;
    if (pre) {
      pre.padding = PAD;
      this.fx = { breath: pre.addDisplacement('fa-grey', 0, 0), a: pre.addDisplacement('fa-grey', 0, 0), b: pre.addDisplacement('fa-grey', 0, 0), cm: pre.addColorMatrix() };
      this.fx.cm.active = false;
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick));
  }

  /** Which hero stands here (null: none) and how. A new hero (or one coming out of the dark) slides in. */
  set(cls: string | null, state: ArtState): void {
    if (cls !== this.cls) {
      this.cls = cls && this.scene.textures.exists(`hero-card-${cls}`) ? cls : null;
      if (this.cls) this.load(this.cls);
      this.enter = 0;
    } else if (state !== this.state && this.state === 'shade') this.enter = 0;
    this.state = state;
    const on = !!this.cls && state !== 'shade';
    this.img.setVisible(on);
    this.sil.setVisible(!!this.cls && state === 'shade');
    this.embers.emitting = on;
    this.pages.emitting = on && !!this.look?.book;
    if (!on) { this.embers.killAll(); this.pages.killAll(); }
  }

  /** Locked in: a white flash through the hero, a flare behind, sparks of its colour. */
  lock(): void {
    this.flashT = 0;
    if (this.cls && this.state !== 'shade') { const c = this.at(0.5, 0.4); this.sparks.explode(26, c.x, c.y); }
  }

  private load(cls: string): void {
    const look = this.look = LOOKS[cls] ?? null;
    this.img.setTexture(`hero-card-${cls}`);
    const fw = this.img.frame.realWidth, fh = this.img.frame.realHeight, k = Math.min(BOX.w / fw, BOX.h / fh);
    this.img.setScale(k);
    this.bw = fw * k; this.bh = fh * k;
    this.sq = Math.ceil((Math.max(this.bw, this.bh) + 2 * PAD) / 32) * 32;
    if (this.fx && look) {
      const m = windMaps(this.scene, cls, this.flip, look, this.bw, this.bh, this.sq);
      this.fx.breath.setTexture(m.breath); this.fx.a.setTexture(m.a); this.fx.b.setTexture(m.b);
    }
    const sh = shadeTex(this.scene, cls, this.bw, this.bh);
    this.sil.setTexture(sh.key).setOrigin(0.5, sh.oy);
    const c = look?.color ?? 0xffd890;
    this.back.setTint(c); this.floor.setTint(c);
    this.embers.particleTint = c;
    this.sparks.particleTint = c;
    for (const e of [this.embers, this.pages, this.sparks]) e.killAll();
    for (const s of this.stars) s.destroy();
    this.stars.length = 0;
    this.starT = (look?.stars ?? []).map(() => rnd(500, 2400));
    for (let i = 0; i < this.starT.length; i++) this.stars.push(this.scene.add.image(0, 0, 'fa-star').setBlendMode(ADD).setDepth(DEPTH + 0.32).setVisible(false));
    if (look?.gleam) { this.streak.setTint(look.gleam.tint); this.core.setTint(0xffffff); this.tip.setTint(look.gleam.tint); }
    this.gleamT = -1; this.nextGleam = rnd(700, 1600);
  }

  /** A point of the card (u across, v down; as drawn, mirrored on the right) → the screen. */
  private at(u: number, v: number): { x: number; y: number } {
    return { x: this.img.x + (this.flip ? 0.5 - u : u - 0.5) * this.bw, y: BOX.bottom - (1 - v) * this.bh };
  }

  /** A random point of the card's area u0..u1 × v0..v1 (particle zones). */
  private pick(p: Phaser.Types.Math.Vector2Like, u0: number, u1: number, v0: number, v1: number): Phaser.Types.Math.Vector2Like {
    const q = this.at(rnd(u0, u1), rnd(v0, v1)); p.x = q.x; p.y = q.y; return p;
  }

  /** A point along a stroke (q 0..1). */
  private along(s: Stroke, q: number): { x: number; y: number } {
    const c = s.c ?? [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2], r = 1 - q;
    return this.at(r * r * s.a[0] + 2 * r * q * c[0] + q * q * s.b[0], r * r * s.a[1] + 2 * r * q * c[1] + q * q * s.b[1]);
  }

  private update(dt: number): void {
    this.t += dt;
    const L = this.look, on = !!this.cls && this.state !== 'shade';
    this.enter = Math.min(1, this.enter + dt / 300);
    const e = 1 - Math.pow(1 - this.enter, 3), x = this.x0 + (this.flip ? 46 : -46) * (1 - e);
    this.img.setX(x).setAlpha(e);
    this.sil.setX(x).setAlpha(0.42 * e);
    this.power += ((this.state === 'locked' ? 1 : 0.72) - this.power) * (1 - Math.exp(-dt / 280));
    this.fade = on ? e * this.power : 0;
    const wave = (ms: number, ph = 0) => 0.5 + 0.5 * Math.sin((this.t / ms) * Math.PI * 2 + ph);

    // Breathing (a slow inhale, a quicker exhale; the head and shoulders rise ~2.4 px) and the cloth in the wind (~3 px).
    if (this.fx) {
      const ph = (this.t % 4600) / 4600, br = ph < 0.55 ? Math.sin((ph / 0.55) * (Math.PI / 2)) : Math.cos(((ph - 0.55) / 0.45) * (Math.PI / 2));
      const still = this.state === 'shade' ? 0 : 1;
      this.fx.breath.x = 0; this.fx.breath.y = ((2 * 2.4 * br) / this.sq) * still;
      const gust = 0.7 + 0.3 * Math.sin((this.t / 5600) * Math.PI * 2), w = (this.t / 1900) * Math.PI * 2, amp = ((2 * 3) / this.sq) * gust * still;
      this.fx.a.x = amp * Math.cos(w); this.fx.a.y = 0.3 * this.fx.a.x;
      this.fx.b.x = amp * Math.sin(w); this.fx.b.y = 0.3 * this.fx.b.x;
    }

    // The light behind it and the glow at its feet.
    const chest = this.at(0.5, 0.42), feet = this.at(0.5, 0.985);
    this.back.setVisible(on).setPosition(chest.x, chest.y).setDisplaySize(this.bw * 1.6, this.bh * 1.12).setAlpha((0.24 + 0.1 * wave(4200)) * this.fade);
    this.floor.setVisible(on).setPosition(feet.x, feet.y).setDisplaySize(this.bw * 1.3, 130).setAlpha((0.6 + 0.2 * wave(3100, 1)) * this.fade);

    // Locked in: brightness 2.6 → 1 over half a second, a white flare behind.
    if (this.flashT >= 0) {
      this.flashT += dt;
      const f = Math.max(0, 1 - this.flashT / 520), ff = f * f;
      if (this.fx) { this.fx.cm.active = f > 0 && on; this.fx.cm.brightness(1 + 1.6 * ff); }
      this.flare.setVisible(on && f > 0).setPosition(chest.x, chest.y).setDisplaySize(this.bw * (1.7 + 0.5 * (1 - f)), this.bh * 1.2).setAlpha(0.6 * ff * e);
      if (f <= 0) this.flashT = -1;
    }

    // Light running along the weapon, then a star at its tip.
    const g = L?.gleam;
    if (!on || !g) { this.streak.setVisible(false); this.core.setVisible(false); this.tip.setVisible(false); this.gleamT = -1; }
    else {
      if (this.gleamT < 0 && (this.nextGleam -= dt) <= 0) { this.gleamT = 0; this.nextGleam = rnd(3200, 5600); }
      if (this.gleamT >= 0) {
        this.gleamT += dt;
        const k = this.gleamT / 760;
        if (k < 1) {
          const q = k * k * (3 - 2 * k), p = this.along(g, q), p2 = this.along(g, Math.min(1, q + 0.02)), ang = Math.atan2(p2.y - p.y, p2.x - p.x), a = Math.sin(Math.PI * k) * e;
          this.streak.setVisible(true).setPosition(p.x, p.y).setRotation(ang).setDisplaySize(230, 48).setAlpha(0.6 * a);
          this.core.setVisible(true).setPosition(p.x, p.y).setRotation(ang).setDisplaySize(120, 10).setAlpha(a);
        } else { this.streak.setVisible(false); this.core.setVisible(false); }
        const s = (this.gleamT - 640) / 460;
        if (s >= 0 && s <= 1) { const p = this.along(g, 1), z = Math.sin(Math.PI * s); this.tip.setVisible(true).setPosition(p.x, p.y).setRotation(s * 0.9).setDisplaySize(40 + 100 * z, 40 + 100 * z).setAlpha(z * e); }
        else this.tip.setVisible(false);
        if (this.gleamT > 1100) this.gleamT = -1;
      }
    }

    // Star glints (the mage's crystal, the archer's arrow and bow).
    this.stars.forEach((st, i) => {
      const at = L?.stars[i];
      if (!on || !at) { st.setVisible(false); return; }
      this.starT[i] -= dt;
      if (this.starT[i] > 0) { st.setVisible(false); return; }
      const q = -this.starT[i] / 560;
      if (q >= 1) { this.starT[i] = rnd(2000, 4600); st.setVisible(false); return; }
      const p = this.at(at.at[0], at.at[1]), z = Math.sin(Math.PI * q), d = 64 * at.size * (0.35 + 0.9 * z);
      st.setVisible(true).setPosition(p.x, p.y).setRotation(q * 0.8).setDisplaySize(d, d).setAlpha(z * this.fade);
    });

    // The mage's book: its light breathes.
    if (on && L?.book) { const b = this.at(L.book[0], L.book[1]); this.book.setVisible(true).setPosition(b.x, b.y).setDisplaySize(this.bw * 0.55, this.bw * 0.42).setAlpha((0.3 + 0.32 * wave(2800)) * this.fade); }
    else this.book.setVisible(false);
  }
}

// ------------------------------------------------------------------ textures (made once, in code)

function textures(scene: Phaser.Scene): void {
  const T = scene.textures;
  const canvas = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (T.exists(key)) return;
    const c = T.createCanvas(key, w, h)!; draw(c.getContext()); c.refresh();
  };
  canvas('fa-grey', 8, 8, (ctx) => { ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, 8, 8); });
  canvas('fa-soft', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  canvas('fa-streak', 128, 32, (ctx) => { // a line of light, bright in the middle, soft at both ends
    const d = ctx.createImageData(128, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) {
      const a = Math.pow(Math.sin((Math.PI * (x + 0.5)) / 128), 2) * Math.exp(-(((y - 15.5) / 5.5) ** 2)), i = (y * 128 + x) * 4;
      d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; d.data[i + 3] = Math.round(255 * a);
    }
    ctx.putImageData(d, 0, 0);
  });
  canvas('fa-star', 64, 64, (ctx) => { // a four-pointed star with a soft core
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.moveTo(32, 1); ctx.lineTo(34, 32); ctx.lineTo(32, 63); ctx.lineTo(30, 32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1, 32); ctx.lineTo(32, 30); ctx.lineTo(63, 32); ctx.lineTo(32, 34); ctx.closePath(); ctx.fill();
  });
}

/** The unknown opponent: the hero's shape in black with a thin cold rim (drawn once per hero). */
function shadeTex(scene: Phaser.Scene, cls: string, bw: number, bh: number): { key: string; oy: number } {
  const m = 6, W = Math.ceil(bw) + 2 * m, H = Math.ceil(bh) + 2 * m, key = `fa-shade-${cls}`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(`hero-card-${cls}`).getSourceImage() as CanvasImageSource;
    const sil = (color: string) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d')!; x.drawImage(src, m, m, bw, bh); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, W, H);
      return c;
    };
    const rim = sil('rgb(120,170,255)'), dark = sil('rgb(0,0,0)');
    const ct = scene.textures.createCanvas(key, W, H)!, ctx = ct.getContext();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.drawImage(rim, Math.cos(a) * 3, Math.sin(a) * 3); }
    ctx.globalAlpha = 1; ctx.drawImage(dark, 0, 0);
    ct.refresh();
  }
  return { key, oy: (bh + m) / H };
}

function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

/** Distance from (x, y) to a stroke (display px), the curve as 16 straight pieces. */
function strokeDist(s: Stroke, x: number, y: number, bw: number, bh: number): number {
  const c = s.c ?? [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
  const pt = (q: number) => { const r = 1 - q; return [(r * r * s.a[0] + 2 * r * q * c[0] + q * q * s.b[0]) * bw, (r * r * s.a[1] + 2 * r * q * c[1] + q * q * s.b[1]) * bh]; };
  let best = Infinity, [px, py] = pt(0);
  for (let i = 1; i <= 16; i++) {
    const [qx, qy] = pt(i / 16), dx = qx - px, dy = qy - py, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / L)), ex = px + t * dx - x, ey = py + t * dy - y;
    best = Math.min(best, Math.hypot(ex, ey)); px = qx; py = qy;
  }
  return best;
}

/**
 * The hero's displacement maps (R channel, 0.5 = still), made from its card: breathing (head and shoulders up, still from
 * the hips down) and two wind maps a quarter wave apart (a sway that travels down the cloth). The FX pass draws the card
 * centred in a square of side `sq`, so the maps are re-projected into that square (mirrored for the right side).
 */
function windMaps(scene: Phaser.Scene, cls: string, flip: boolean, look: Look, bw: number, bh: number, sq: number): { breath: string; a: string; b: string } {
  const base = `fa-map-${cls}-${flip ? 'r' : 'l'}-${sq}`, keys = { breath: `${base}-br`, a: `${base}-wa`, b: `${base}-wb` };
  if (scene.textures.exists(keys.a)) return keys;
  // The cloth weight on a small grid over the card plus a margin (so the cloth may move past the card's edge).
  const MW = 96, MH = Math.round((MW * bh) / bw), mx = 4, my = 4, GW = MW + 2 * mx, GH = MH + 2 * my;
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(scene.textures.get(`hero-card-${cls}`).getSourceImage() as CanvasImageSource, mx, my, MW, MH);
  const px = cx.getImageData(0, 0, GW, GH).data;
  let w = new Float32Array(GW * GH);
  const uv = (x: number, y: number) => [(x - mx + 0.5) / MW, (y - my + 0.5) / MH];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = (y * GW + x) * 4, a = px[i + 3] / 255;
    if (a < 0.05) continue;
    const [u, v] = uv(x, y), [h, s, l] = hsv(px[i], px[i + 1], px[i + 2]);
    const where = sm(0.3, 0.5, v) * (0.45 + 0.55 * sm(0.45, 0.95, v)) * (1 - sm(0.93, 0.99, v)) * (0.3 + 0.7 * sm(0.05, 0.28, Math.abs(u - 0.5))); // anchored up top, freest at the hem
    w[y * GW + x] = a * look.cloth(h, s, l, u, v) * where;
  }
  const blur = (src: Float32Array, r: number) => {
    const o = new Float32Array(src.length);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let s = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) { s += src[yy * GW + xx]; n++; } }
      o[y * GW + x] = s / n;
    }
    return o;
  };
  w = blur(blur(w, 2), 2);
  const wind = (phase: number) => {
    const c = document.createElement('canvas'); c.width = GW; c.height = GH;
    const ctx = c.getContext('2d')!, d = ctx.createImageData(GW, GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const [u, v] = uv(x, y);
      let W = Math.min(1, w[y * GW + x] * 1.5);
      for (const k of look.keep) W *= sm(k.r * bw * 0.7, k.r * bw * 1.3, strokeDist(k, u * bw, v * bh, bw, bh));
      for (const [u0, v0, u1, v1] of look.still) W *= 1 - sm(-0.03, 0, Math.min(u - u0, u1 - u, v - v0, v1 - v)); // (feathered over 3% of the card outside the box)
      const r = Math.round(255 * (0.5 + 0.5 * W * Math.sin(Math.PI * 2 * (1.5 * v + 0.45 * u) + phase))), i = (y * GW + x) * 4;
      d.data[i] = r; d.data[i + 1] = r; d.data[i + 2] = r; d.data[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  };
  const q = MAP / sq, dw = bw * q, dh = bh * q, dx = (MAP - dw) / 2, dy = (MAP - dh) / 2;
  const square = (key: string, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const ct = scene.textures.createCanvas(key, MAP, MAP)!, ctx = ct.getContext();
    ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, MAP, MAP);
    ctx.save(); if (flip) { ctx.translate(MAP, 0); ctx.scale(-1, 1); }
    ctx.imageSmoothingEnabled = true; draw(ctx); ctx.restore(); ct.refresh();
  };
  for (const [key, ph] of [[keys.a, 0], [keys.b, Math.PI / 2]] as const) {
    const c = wind(ph);
    square(key, (ctx) => ctx.drawImage(c, dx - (mx / MW) * dw, dy - (my / MH) * dh, (GW / MW) * dw, (GH / MH) * dh));
  }
  // Breathing: rows, whole width (above the head too, so the head can rise into the free space over it).
  square(keys.breath, (ctx) => {
    for (let y = 0; y < MAP; y++) {
      const v = (y + 0.5 - dy) / dh, r = Math.round(255 * (0.5 + 0.5 * (1 - sm(0.3, 0.62, v))));
      ctx.fillStyle = `rgb(${r},${r},${r})`; ctx.fillRect(0, y, MAP, 1);
    }
  });
  return keys;
}
