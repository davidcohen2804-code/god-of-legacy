// Presentation life for the Main Menu and Character Select (render only, never gameplay):
// logo gem pulse, ambient motes, warm light sweep, local cape wind, pointer parallax (menu) and per-class presence
// (aura, motes, weapon shimmer, halo, hover/selection response) on the select preview. Uses the supplied
// assets/final/menu and assets/final/character_select sheets.
import Phaser from 'phaser';
import MENU_SKY from '../data/menu-sky.json';

const F = 'assets/final';
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function preloadLife(scene: Phaser.Scene): void {
  const SS = (k: string, p: string, w: number, h = w) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: w, frameHeight: h }); };
  SS('life-gem', `${F}/menu/logo_gem_glow.png`, 256);
  SS('life-mote', `${F}/menu/ambient_mote.png`, 64);
  SS('life-sweep', `${F}/menu/light_sweep.png`, 256);
  for (const c of ['warrior', 'book_mage', 'archer', 'samurai']) SS(`life-aura-${c}`, `${F}/character_select/${c}_aura.png`, 384);
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('life-wind-sin-final', `${F}/menu/cloth_wind_sin.png`);
  I('life-wind-cos-final', `${F}/menu/cloth_wind_cos.png`);
}

function onUpdate(scene: Phaser.Scene, fn: (dt: number) => void): void {
  const tick = (_t: number, dt: number) => fn(Math.min(dt, 50));
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}

/** Soft radial glow texture (code-generated light, used for highlights / sheen / book light). */
function glowTex(scene: Phaser.Scene): string {
  const key = 'life-soft-glow';
  if (scene.textures.exists(key)) return key;
  const c = scene.textures.createCanvas(key, 128, 128)!, ctx = c.getContext();
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); c.refresh();
  return key;
}

// ======================================================================================== Main Menu

/** Logo gem: alpha 0.35–0.78, scale 0.94–1.09 over 2.4 s, rare 120 ms flicker (never strobe). */
export function addGemPulse(scene: Phaser.Scene, at: { x: number; y: number }, radius: number, depth = 10): Phaser.GameObjects.Image {
  const img = scene.add.image(at.x, at.y, 'life-gem', 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
  const base = (radius * 2.6) / 256;
  let t = 0, flick = -1, next = 3500 + Math.random() * 3500;
  onUpdate(scene, (dt) => {
    t += dt; next -= dt;
    if (next <= 0) { flick = 0; next = 4200 + Math.random() * 4800; }
    const p = 0.5 - 0.5 * Math.cos((t / 2400) * Math.PI * 2); // 0..1..0 over 2.4 s
    let a = 0.35 + 0.43 * p;
    if (flick >= 0) { flick += dt; a *= flick < 60 ? 0.55 : 1.12; if (flick >= 120) flick = -1; }
    img.setAlpha(Math.min(0.85, a)).setScale(base * (0.94 + 0.15 * p)).setFrame(Math.min(7, Math.floor(p * 7.99)));
  });
  return img;
}

interface Mote { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; age: number; life: number; ph: number; size: number; a: number }

/** Slow ambient motes inside `area`; `count` 12–20 for the menu. Returns the container (for parallax). */
export function addMotes(scene: Phaser.Scene, area: { x: number; y: number; w: number; h: number }, count: number, opts: {
  depth?: number; tint?: number; size?: [number, number]; speed?: [number, number]; drift?: number; alpha?: number; parent?: Phaser.GameObjects.Container;
} = {}): Phaser.GameObjects.Container {
  const c = opts.parent ?? scene.add.container(0, 0).setDepth(opts.depth ?? 5);
  const [s0, s1] = opts.size ?? [10, 22], [v0, v1] = opts.speed ?? [6, 16];
  const spawn = (m: Partial<Mote>, initial: boolean): Mote => {
    const img = m.img ?? scene.add.image(0, 0, 'life-mote', 0).setBlendMode(Phaser.BlendModes.ADD);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    img.setFrame(Math.floor(Math.random() * 8));
    if (!m.img) c.add(img);
    return {
      img, x: area.x + Math.random() * area.w, y: initial ? area.y + Math.random() * area.h : area.y + area.h * (0.75 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * (opts.drift ?? 6), vy: -(v0 + Math.random() * (v1 - v0)), age: initial ? Math.random() * 4000 : 0,
      life: 5000 + Math.random() * 5000, ph: Math.random() * 6.28, size: s0 + Math.random() * (s1 - s0), a: opts.alpha ?? 0.8,
    };
  };
  const motes: Mote[] = [];
  for (let i = 0; i < count; i++) motes.push(spawn({}, true));
  onUpdate(scene, (dt) => {
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.age += dt;
      if (m.age >= m.life || m.y < area.y - 20) { motes[i] = spawn({ img: m.img }, false); continue; }
      const k = dt / 1000;
      m.x += (m.vx + Math.sin(m.age / 900 + m.ph) * 4) * k; m.y += m.vy * k;
      const fade = smooth(0, 900, m.age) * (1 - smooth(m.life - 1200, m.life, m.age));
      m.img.setPosition(m.x, m.y).setAlpha(m.a * fade * (0.75 + 0.25 * Math.sin(m.age / 500 + m.ph))).setDisplaySize(m.size, m.size);
    }
  });
  return c;
}

/** Warm light drifting from the upper right of the background (supplied sweep sheet, slow ping-pong). */
export function addLightSweep(scene: Phaser.Scene, rect: { x: number; y: number; w: number; h: number }, depth = 2): Phaser.GameObjects.Image {
  const img = scene.add.image(rect.x, rect.y, 'life-sweep', 0).setOrigin(0, 0).setDisplaySize(rect.w, rect.h).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    const p = 0.5 - 0.5 * Math.cos((t / 16000) * Math.PI * 2); // 16 s round trip
    img.setFrame(Math.round(p * 15)).setAlpha(0.32 + 0.12 * Math.sin(t / 3100));
  });
  return img;
}

/**
 * Local cape wind on a background painting: only the cape pixels (hue-keyed, feathered) are copied into an overlay
 * that is displaced with the supplied cloth wind maps; the rest of the image never moves.
 */
export function addCapeWind(scene: Phaser.Scene, bgKey: string, bg: Phaser.GameObjects.Image, region: { x: number; y: number; w: number; h: number },
  isCloth: (r: number, g: number, b: number) => boolean, pixels = 2.6): Phaser.GameObjects.Image | null {
  const key = `${bgKey}-cape`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(bgKey).getSourceImage() as HTMLImageElement;
    const W = region.w, H = region.h;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    const sx = src.width / bg.width; // source px per image px (1 when the bg is used at native size)
    ctx.drawImage(src, region.x * sx, region.y * sx, W * sx, H * sx, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H), m = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = isCloth(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]) ? 1 : 0;
    // Feather: two box-blur passes, then fade out towards the region border.
    const blur = (a: Float32Array, r: number) => {
      const o = new Float32Array(a.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += a[yy * W + xx]; n++; } }
        o[y * W + x] = s / n;
      }
      return o;
    };
    const f = blur(blur(m, 2), 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y), edge = smooth(0, 14, e);
      d.data[(y * W + x) * 4 + 3] = Math.round(255 * Math.min(1, f[y * W + x] * 1.6) * edge);
    }
    ctx.putImageData(d, 0, 0);
    scene.textures.addCanvas(key, cv);
  }
  const k = bg.scaleX;
  const img = scene.add.image(bg.x - bg.displayWidth / 2 + region.x * k, bg.y - bg.displayHeight / 2 + region.y * k, key).setOrigin(0, 0).setScale(k).setDepth(bg.depth + 0.5);
  if (!img.preFX) return img;
  img.preFX.padding = 8;
  const a = img.preFX.addDisplacement('life-wind-sin-final', 0, 0), b = img.preFX.addDisplacement('life-wind-cos-final', 0, 0);
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    const amp = (2 * pixels) / Math.max(1, img.displayWidth);
    const gust = 0.7 + 0.3 * Math.sin((t / 5600) * Math.PI * 2);
    const w = (t / 1900) * Math.PI * 2;
    a.x = amp * gust * Math.cos(w); a.y = amp * 0.35 * gust * Math.sin(w * 0.5);
    b.x = amp * gust * Math.sin(w); b.y = 0;
  });
  return img;
}

/** Pointer parallax: each layer moves up to `px` (4–7) toward the pointer offset, smoothed. */
export function addParallax(scene: Phaser.Scene, layers: { obj: { x: number; y: number }; px: number }[], centre: { x: number; y: number }): void {
  const base = layers.map((l) => ({ x: l.obj.x, y: l.obj.y }));
  let cx = 0, cy = 0;
  onUpdate(scene, (dt) => {
    const p = scene.input.activePointer;
    const tx = Phaser.Math.Clamp((p.x - centre.x) / centre.x, -1, 1), ty = Phaser.Math.Clamp((p.y - centre.y) / centre.y, -1, 1);
    const k = 1 - Math.exp(-dt / 220);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
    layers.forEach((l, i) => { l.obj.x = base[i].x - cx * l.px; l.obj.y = base[i].y - cy * l.px * 0.6; });
  });
}

// ======================================================================================== Character Select

const PRESENCE: Record<string, {
  color: number; halo: number; motes: { n: number; tint: number; box: [number, number, number, number]; speed: [number, number]; drift: number; size: [number, number] };
  blade?: [[number, number], [number, number]]; bladeTint?: number; glow?: { at: [number, number]; tint: number; r: number }; sparkle?: [number, number];
  bow?: [[number, number], [number, number], [number, number]]; ribbon?: boolean;
}> = {
  // Anchors are fractions of the preview image (u across, v down).
  warrior: { color: 0xffb04a, halo: 0xffc070, motes: { n: 8, tint: 0xffb24a, box: [0.12, 0.25, 0.86, 0.85], speed: [10, 22], drift: 8, size: [8, 16] },
    blade: [[0.215, 0.53], [0.075, 0.96]], bladeTint: 0xfff0c8 },
  book_mage: { color: 0x6fc8ff, halo: 0x7fc4ff, motes: { n: 11, tint: 0x6fb8ff, box: [0.1, 0.05, 0.9, 0.6], speed: [8, 18], drift: 10, size: [8, 18] },
    glow: { at: [0.27, 0.25], tint: 0x5ab4ff, r: 120 }, sparkle: [0.81, 0.12] },
  archer: { color: 0x9be35a, halo: 0x9be35a, motes: { n: 6, tint: 0x9be35a, box: [0.05, 0.2, 0.95, 0.9], speed: [4, 10], drift: 26, size: [8, 14] },
    bow: [[0.9, 0.08], [0.82, 0.5], [0.76, 0.88]], ribbon: true },
  samurai: { color: 0xff4a5a, halo: 0xff5a5a, motes: { n: 6, tint: 0xff3a30, box: [0.15, 0.3, 0.85, 0.9], speed: [10, 20], drift: 6, size: [7, 13] },
    blade: [[0.4, 0.45], [0.97, 0.8]], bladeTint: 0xffe8e8 },
};

/** Per-class life around the Character Select preview (no whole-image translation). */
export class ClassPresence {
  private aura: Phaser.GameObjects.Sprite;
  private moteLayer?: Phaser.GameObjects.Container;
  private fx: Phaser.GameObjects.Image[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private cls: string | null = null;
  private hover = 0;
  private hoverTarget = 0;
  private t = 0;
  private nextShimmer = 2500;
  private shimmerT = -1;
  private nextSparkle = 1800;
  private sparkleT = -1;
  private popT = -1;
  private heroScale = 1;

  constructor(private scene: Phaser.Scene, private hero: Phaser.GameObjects.Image, private halo: Phaser.GameObjects.Image, private feet: { x: number; y: number }) {
    if (!scene.anims.exists('life-aura-warrior')) for (const c of Object.keys(PRESENCE)) {
      scene.anims.create({ key: `life-aura-${c}`, frames: scene.anims.generateFrameNumbers(`life-aura-${c}`, { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    }
    this.aura = scene.add.sprite(feet.x, feet.y, 'life-aura-warrior', 0).setOrigin(0.5, 0.667).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.aura.setDepth(hero.depth - 0.5);
    this.gfx = scene.add.graphics().setDepth(hero.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
    glowTex(scene);
    onUpdate(scene, (dt) => this.update(dt));
  }

  /** u/v of the preview image → screen. */
  private at(u: number, v: number): { x: number; y: number } {
    const h = this.hero;
    return { x: h.x - h.displayWidth * h.originX + u * h.displayWidth, y: h.y - h.displayHeight * h.originY + v * h.displayHeight };
  }

  setClass(cls: string | null): void {
    if (cls === this.cls) return;
    this.cls = cls;
    this.moteLayer?.destroy(true); this.moteLayer = undefined;
    for (const f of this.fx) f.destroy();
    this.fx = [];
    this.aura.setVisible(!!cls);
    if (!cls || !PRESENCE[cls]) return;
    this.heroScale = this.hero.scaleX;
    const P = PRESENCE[cls];
    this.aura.play(`life-aura-${cls}`);
    this.halo.setTint(P.halo);
    const a = this.at(P.motes.box[0], P.motes.box[1]), b = this.at(P.motes.box[2], P.motes.box[3]);
    this.moteLayer = addMotes(this.scene, { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, P.motes.n,
      { depth: this.hero.depth + 1, tint: P.motes.tint, speed: P.motes.speed, drift: P.motes.drift, size: P.motes.size, alpha: 0.85 });
    if (P.glow) {
      const g = this.at(P.glow.at[0], P.glow.at[1]);
      this.fx.push(this.scene.add.image(g.x, g.y, 'life-soft-glow').setTint(P.glow.tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.hero.depth + 1)
        .setDisplaySize(P.glow.r * 2, P.glow.r * 1.6).setName('book'));
    }
    if (P.sparkle) {
      const s = this.at(P.sparkle[0], P.sparkle[1]);
      this.fx.push(this.scene.add.image(s.x, s.y, 'life-mote', 2).setTint(0xcfeaff).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.hero.depth + 1).setAlpha(0).setName('sparkle'));
    }
    this.shimmerT = -1; this.nextShimmer = 1200;
  }

  setHover(on: boolean): void { this.hoverTarget = on ? 1 : 0; }

  /** One clear 180 ms response when a character is selected. */
  pop(): void { this.popT = 0; this.heroScale = this.hero.scaleX; }

  private update(dt: number): void {
    this.t += dt;
    const cls = this.cls, P = cls ? PRESENCE[cls] : null;
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-dt / 120));
    this.gfx.clear();
    if (!P || !this.hero.visible) { this.aura.setVisible(false); return; }
    this.aura.setVisible(true).setAlpha(0.55 + 0.35 * this.hover + 0.08 * Math.sin(this.t / 700)).setScale(2.3 * (1.0 + 0.06 * this.hover), 2.0 * (1.0 + 0.06 * this.hover));
    if (this.popT >= 0) {
      this.popT += dt;
      const k = Math.min(1, this.popT / 180), s = 1 + 0.025 * Math.sin(k * Math.PI);
      this.hero.setScale(this.heroScale * s);
      this.aura.setAlpha(Math.min(1, this.aura.alpha + 0.4 * Math.sin(k * Math.PI)));
      if (k >= 1) { this.popT = -1; this.hero.setScale(this.heroScale); }
    }
    for (const f of this.fx) {
      if (f.name === 'book') f.setAlpha(0.25 + 0.35 * (0.5 - 0.5 * Math.cos((this.t / 2800) * Math.PI * 2)) + 0.15 * this.hover);
    }
    // Crystal sparkle (mage): short star flash every 2–4 s.
    const sp = this.fx.find((f) => f.name === 'sparkle');
    if (sp) {
      this.nextSparkle -= dt;
      if (this.nextSparkle <= 0 && this.sparkleT < 0) { this.sparkleT = 0; this.nextSparkle = 2000 + Math.random() * 2000; }
      if (this.sparkleT >= 0) { this.sparkleT += dt; const k = this.sparkleT / 320; sp.setAlpha(Math.sin(Math.min(1, k) * Math.PI)).setDisplaySize(26 + 22 * k, 26 + 22 * k); if (k >= 1) { this.sparkleT = -1; sp.setAlpha(0); } }
    }
    // Weapon edge shimmer (warrior / samurai): a bright sheen runs along the blade every 3–5 s.
    if (P.blade) {
      this.nextShimmer -= dt;
      if (this.nextShimmer <= 0 && this.shimmerT < 0) { this.shimmerT = 0; this.nextShimmer = 3000 + Math.random() * 2000; }
      if (this.shimmerT >= 0) {
        this.shimmerT += dt;
        const k = this.shimmerT / 520, a = this.at(...P.blade[0]), b = this.at(...P.blade[1]);
        for (let i = 0; i < 6; i++) {
          const q = Phaser.Math.Clamp(k * 1.3 - i * 0.05, 0, 1), x = a.x + (b.x - a.x) * q, y = a.y + (b.y - a.y) * q;
          this.gfx.fillStyle(P.bladeTint ?? 0xffffff, (1 - i / 6) * 0.55 * Math.sin(Math.min(1, k) * Math.PI)).fillCircle(x, y, 3.2 - i * 0.35);
        }
        if (k >= 1) this.shimmerT = -1;
      }
    }
    // Bow edge pulse (archer): the limb glows softly.
    if (P.bow) {
      const pts = P.bow.map(([u, v]) => this.at(u, v));
      const al = 0.06 + 0.12 * (0.5 - 0.5 * Math.cos((this.t / 2600) * Math.PI * 2)) + 0.08 * this.hover;
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(pts[0].x, pts[0].y), new Phaser.Math.Vector2(pts[1].x + 26, pts[1].y), new Phaser.Math.Vector2(pts[2].x, pts[2].y));
      this.gfx.lineStyle(5, 0xb8ff7a, al * 0.6); curve.draw(this.gfx, 24);
      this.gfx.lineStyle(2, 0xeaffc8, al); curve.draw(this.gfx, 24);
    }
    // Mild wind ribbon (archer): a thin translucent ribbon crossing the preview every few seconds.
    if (P.ribbon) {
      const cyc = 5200, c = (this.t % cyc) / cyc;
      if (c < 0.55) {
        const k = c / 0.55, top = this.at(0, 0.55), w = this.hero.displayWidth;
        const x0 = top.x - 80 + k * (w + 160);
        for (let i = 0; i < 14; i++) {
          const x = x0 - i * 9, y = top.y + Math.sin((x / 60) + this.t / 400) * 10 - i * 1.5;
          this.gfx.fillStyle(0xd8ffd0, 0.22 * (1 - i / 14) * Math.sin(k * Math.PI)).fillCircle(x, y, 2.2);
        }
      }
    }
  }
}

// ======================================================================================== Main Menu: living painting

/** Code-made textures: sun rays, soft fog / cloud tile, a 4-point glint. */
function raysTex(scene: Phaser.Scene): string {
  const key = 'life-rays';
  if (scene.textures.exists(key)) return key;
  const S = 512, c = scene.textures.createCanvas(key, S, S)!, ctx = c.getContext();
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.05, w = 0.025 + (i % 4) * 0.012, len = S * (0.32 + ((i * 37) % 17) / 17 * 0.18);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.35, 'rgba(255,220,160,0.35)'); g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); ctx.closePath(); ctx.fill();
  }
  c.refresh();
  return key;
}

function fogTex(scene: Phaser.Scene, key: string, w: number, h: number, blobs: number, seed: number, vfade: boolean): string {
  if (scene.textures.exists(key)) return key;
  const c = scene.textures.createCanvas(key, w, h)!, ctx = c.getContext();
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < blobs; i++) {
    const x = rnd() * w, y = h * (0.25 + rnd() * 0.5), r = h * (0.18 + rnd() * 0.35), sx = 1.6 + rnd() * 1.8;
    for (const dx of [-w, 0, w]) { // wraps horizontally (seamless tile)
      ctx.save(); ctx.translate(x + dx, y); ctx.scale(sx, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  if (vfade) { // soft top / bottom edges
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  c.refresh();
  return key;
}

function glintTex(scene: Phaser.Scene): string {
  const key = 'life-glint';
  if (scene.textures.exists(key)) return key;
  const S = 64, c = scene.textures.createCanvas(key, S, S)!, ctx = c.getContext();
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 10); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(34, 32); ctx.lineTo(32, 62); ctx.lineTo(30, 32); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, 32); ctx.lineTo(32, 30); ctx.lineTo(62, 32); ctx.lineTo(32, 34); ctx.closePath(); ctx.fill();
  c.refresh();
  return key;
}

/** Sun: warm bloom + slowly turning god rays + a soft shaft over the lake. Returns objects for parallax. */
export function addSunLight(scene: Phaser.Scene, at: { x: number; y: number }, depth = 1): Phaser.GameObjects.Image[] {
  const bloom = scene.add.image(at.x, at.y, glowTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc078).setDepth(depth);
  const core = scene.add.image(at.x, at.y, glowTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1d0).setDepth(depth);
  const rays = scene.add.image(at.x, at.y, raysTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd9a0).setDepth(depth).setScale(1.9);
  const rays2 = scene.add.image(at.x, at.y, raysTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb070).setDepth(depth).setScale(2.6).setAngle(9);
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    const breathe = 0.5 + 0.5 * Math.sin((t / 5200) * Math.PI * 2);
    bloom.setDisplaySize(620 + 60 * breathe, 620 + 60 * breathe).setAlpha(0.32 + 0.1 * breathe);
    core.setDisplaySize(150 + 16 * breathe, 150 + 16 * breathe).setAlpha(0.55 + 0.15 * breathe);
    rays.setAngle((t / 1000) * 1.6).setAlpha(0.16 + 0.07 * Math.sin(t / 2300));
    rays2.setAngle(9 - (t / 1000) * 1.0).setAlpha(0.1 + 0.05 * Math.sin(t / 3100 + 1));
  });
  return [bloom, rays2, rays, core];
}

/** The main menu painting's own clouds (tools/menu/sky.py): the sky band, its tree / castle / sun filled with sky. */
export function preloadMenuSky(scene: Phaser.Scene): void {
  if (!scene.textures.exists('life-sky-layer')) scene.load.image('life-sky-layer', `${F}/menu/sky_layer.webp`);
  if (!scene.textures.exists('life-sky-mask')) scene.load.image('life-sky-mask', `${F}/menu/sky_mask.png`);
}

/** The painting's clouds drift: its sky slides slowly to and fro (a 36 s sway, MENU_SKY.sway px either way) under a
 *  mask that stays put — the clouds pass behind the tree, the mountains and the castle; the sun stays where it is. */
export function addSkyDrift(scene: Phaser.Scene, bg: Phaser.GameObjects.Image, period = 36000): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists('life-sky-layer') || !scene.textures.exists('life-sky-mask')) return null;
  const k = bg.scaleX, ox = bg.x - bg.displayWidth / 2, oy = bg.y - bg.displayHeight / 2, x0 = ox - MENU_SKY.pad * k;
  const layer = scene.add.image(x0, oy, 'life-sky-layer').setOrigin(0, 0).setScale(k).setDepth(bg.depth + 0.2);
  const mask = scene.make.image({ x: ox, y: oy, key: 'life-sky-mask' }, false).setOrigin(0, 0).setScale(k);
  layer.setMask(mask.createBitmapMask());
  let t = 0;
  onUpdate(scene, (dt) => { t += dt; layer.x = x0 + MENU_SKY.sway * k * Math.sin((t / period) * Math.PI * 2); });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { layer.clearMask(true); mask.destroy(); });
  return layer;
}

/** Drifting cloud wisps (sky band) and valley mist (two depths), soft and slow. */
export function addSkyAndMist(scene: Phaser.Scene, depth = 1): Phaser.GameObjects.TileSprite[] {
  const clouds = scene.add.tileSprite(960, 150, 1920, 300, fogTex(scene, 'life-cloud', 1024, 300, 14, 7, true)).setTint(0xffc9a8).setAlpha(0.16).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(depth);
  const mistFar = scene.add.tileSprite(960, 640, 1920, 240, fogTex(scene, 'life-mist-a', 1024, 240, 16, 23, true)).setTint(0xe8eef8).setAlpha(0.16).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(depth);
  const mistNear = scene.add.tileSprite(960, 900, 1920, 300, fogTex(scene, 'life-mist-b', 1024, 300, 12, 91, true)).setTint(0xf2f4fa).setAlpha(0.14).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(depth);
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    clouds.tilePositionX -= dt * 0.006;
    mistFar.tilePositionX -= dt * 0.011; mistFar.setAlpha(0.13 + 0.04 * Math.sin(t / 4100));
    mistNear.tilePositionX += dt * 0.017; mistNear.setAlpha(0.11 + 0.04 * Math.sin(t / 3300 + 2));
  });
  return [clouds, mistFar, mistNear];
}

/**
 * Water and mist of the painting itself come alive: the bright, unsaturated pixels below the horizon (waterfalls, mist
 * banks, foam) are copied into a feathered overlay that ripples with the wind maps (falls flow, mist breathes).
 */
export function addPaintedWater(scene: Phaser.Scene, bgKey: string, bg: Phaser.GameObjects.Image, top = 300): Phaser.GameObjects.Image | null {
  const key = `${bgKey}-water`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(bgKey).getSourceImage() as HTMLImageElement;
    const W = 960, H = 540, cv = document.createElement('canvas'); cv.width = W; cv.height = H; // half res: soft and cheap
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H), m = new Float32Array(W * H), y0 = Math.round((top / bg.height) * H);
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = d.data[i], g = d.data[i + 1], b = d.data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      m[y * W + x] = smooth(150, 200, mx) * (1 - smooth(40, 70, mx - mn));
    }
    const o = new Float32Array(W * H); // one blur pass
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += m[(y + dy) * W + x + dx]; o[y * W + x] = s / 9; }
    for (let i = 0; i < W * H; i++) d.data[i * 4 + 3] = Math.round(255 * Math.min(1, o[i] * 1.3));
    ctx.putImageData(d, 0, 0);
    scene.textures.addCanvas(key, cv);
  }
  const img = scene.add.image(bg.x, bg.y, key).setDisplaySize(bg.displayWidth, bg.displayHeight).setDepth(bg.depth + 0.4);
  if (!img.preFX) return img;
  img.preFX.padding = 6;
  const a = img.preFX.addDisplacement('life-wind-sin-final', 0, 0), b = img.preFX.addDisplacement('life-wind-cos-final', 0, 0);
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    const amp = 3 / Math.max(1, img.displayWidth), w = (t / 2600) * Math.PI * 2;
    a.x = amp * 0.6 * Math.cos(w); a.y = amp * 2.2 * Math.sin(w * 1.3); // mostly vertical: falls flow, mist heaves
    b.x = amp * 0.5 * Math.sin(w * 0.7); b.y = amp * 1.6 * Math.cos(w * 0.9);
    img.setAlpha(0.85 + 0.15 * Math.sin(t / 1700));
  });
  return img;
}

/** Sun glitter on the lake: tiny glints that flicker along the reflection. */
export function addWaterGlints(scene: Phaser.Scene, area: { x: number; y: number; w: number; h: number }, n: number, depth = 2): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(depth);
  const gl = Array.from({ length: n }, () => {
    const img = scene.add.image(0, 0, glintTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c8).setAlpha(0);
    c.add(img);
    return { img, t: Math.random() * 1600, life: 900 + Math.random() * 900 };
  });
  const place = (g: { img: Phaser.GameObjects.Image }) => {
    const u = Math.random(), v = Math.random();
    g.img.setPosition(area.x + area.w * (0.5 + (u - 0.5) * (0.35 + v * 0.65)), area.y + area.h * v); // denser in the sun's column
  };
  for (const g of gl) place(g);
  onUpdate(scene, (dt) => {
    for (const g of gl) {
      g.t += dt;
      if (g.t >= g.life) { g.t = 0; g.life = 900 + Math.random() * 900; place(g); }
      const k = Math.sin((g.t / g.life) * Math.PI), s = 10 + 16 * k;
      g.img.setAlpha(0.85 * k).setDisplaySize(s, s);
    }
  });
  return c;
}

/** Living gem: heartbeat core, slowly turning flare, embers rising from it. */
export function addGemLife(scene: Phaser.Scene, at: { x: number; y: number }, radius: number, depth = 11): Phaser.GameObjects.Container {
  const c = scene.add.container(at.x, at.y).setDepth(depth);
  const flare = scene.add.image(0, 0, raysTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6a3a);
  const core = scene.add.image(0, 0, glowTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2b0);
  const halo = scene.add.image(0, 0, glowTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3a20);
  c.add([halo, flare, core]);
  const embers = Array.from({ length: 10 }, () => { const e = scene.add.image(0, 0, glowTex(scene)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a40).setAlpha(0); c.add(e); return { e, t: Math.random() * 2000, life: 1400 + Math.random() * 1200, vx: 0, x: 0 }; });
  let t = 0;
  onUpdate(scene, (dt) => {
    t += dt;
    const ph = (t % 1800) / 1800, beat = Math.exp(-((ph - 0.08) ** 2) / 0.002) + 0.6 * Math.exp(-((ph - 0.24) ** 2) / 0.003); // lub-dub
    halo.setDisplaySize(radius * (3.2 + 0.6 * beat), radius * (3.2 + 0.6 * beat)).setAlpha(0.35 + 0.3 * beat);
    core.setDisplaySize(radius * (1.1 + 0.35 * beat), radius * (1.1 + 0.35 * beat)).setAlpha(0.55 + 0.4 * beat);
    flare.setDisplaySize(radius * 3.6, radius * 3.6).setAngle(t / 60).setAlpha(0.22 + 0.25 * beat);
    for (const m of embers) {
      m.t += dt;
      if (m.t >= m.life) { m.t = 0; m.life = 1400 + Math.random() * 1200; m.x = (Math.random() - 0.5) * radius * 0.8; m.vx = (Math.random() - 0.5) * 18; }
      const k = m.t / m.life, s = radius * (0.22 + 0.18 * Math.sin(k * Math.PI));
      m.e.setPosition(m.x + m.vx * k * 2, -radius * 0.2 - k * radius * 2.6).setDisplaySize(s, s).setAlpha(0.8 * Math.sin(k * Math.PI));
    }
  });
  return c;
}
