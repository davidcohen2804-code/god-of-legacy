// The PvP arena's living stage (visual only — nothing here touches the fight): far clouds and valley mist drifting
// behind the balustrade, flocks of birds (or bats) crossing the sky, rays from the sun (or the moon) sweeping slowly,
// light drifting over the floor, the floor's sun emblem glowing with light running round its rings, and the stage's
// weather — leaves, petals, snow, rain or fireflies (a few in front of the fighters), lightning in a storm. All in the
// map's pixels; the far layers are masked to the far background so they pass behind the balustrade and the arches.
import Phaser from 'phaser';

type Pt = [number, number];
/** A stage's look: where its far background, sun and floor emblem are, and its colours. */
export interface StageLook {
  /** The far background (sky, valley) as a polygon: the clouds, mist and birds stay inside it. */
  far: Pt[];
  /** The sky's band (clouds) and the valley's (mist), y ranges. */
  sky: [number, number];
  mist: [number, number];
  /** The sun (god rays fan from it, down to the left). */
  sun: Pt;
  /** The floor (its light drifts there): top y. */
  floorTop: number;
  /** The floor emblem: centre and its outer and inner rings' half axes. */
  emblem?: { c: Pt; outer: Pt; inner: Pt };
  cloudTint: number;
  mistTint: number;
  lightTint: number;
  /** The light source's flare and rays: tint and strength (1 = the sunset's). */
  rayTint?: number;
  rays?: number;
  /** Who crosses the sky now and then. */
  fliers?: 'birds' | 'bats' | null;
  /** The weather: what falls or floats across the stage, how many, in which colours. */
  fall: { kind: 'leaf' | 'petal' | 'snow' | 'rain' | 'firefly' | 'ember'; n: number; tints: number[] };
  /** A storm: lightning flashes now and then. */
  lightning?: boolean;
  /** The emblem's light. */
  emblemTint?: number;
  /** Fires burning on the stage (braziers, torches): a flickering glow with sparks rising, at these points. */
  fires?: Pt[];
}

/** Legacy Courtyard at sunset (assets/environment/Legacy_Courtyard.png). */
export const COURTYARD_LOOK: StageLook = {
  far: [[255, 0], [1495, 0], [1495, 160], [1440, 160], [1440, 212], [1258, 212], [1258, 135], [1216, 135], [1216, 212], [1032, 212], [1032, 130],
    [985, 130], [985, 250], [830, 250], [830, 212], [668, 212], [668, 140], [628, 140], [628, 212], [450, 212], [450, 140], [405, 140], [405, 212], [255, 212]],
  sky: [0, 120],
  mist: [150, 262],
  sun: [1440, 15],
  floorTop: 262,
  emblem: { c: [904, 565], outer: [288, 122], inner: [92, 45] },
  cloudTint: 0xffd6c0,
  mistTint: 0xffe4d0,
  lightTint: 0xffc070,
  fliers: 'birds',
  fall: { kind: 'leaf', n: 16, tints: [0xc8281e, 0xe0501e, 0xa81c22, 0xf07a2a] },
};

const T = { cloud: 'sfx-cloud', mist: 'sfx-mist', ray: 'sfx-ray', glow: 'sfx-glow', light: 'sfx-light', ring: 'sfx-ring', leaf: 'sfx-leaf', petal: 'sfx-petal', drop: 'sfx-drop', dot: 'sfx-dot', bird: 'sfx-bird', bat: 'sfx-bat' };
const BIRD_FRAMES = 4;

function rng(seed: number): () => number { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  const canvas = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    if (tx.exists(key)) return;
    const c = tx.createCanvas(key, w, h)!; draw(c.getContext()); c.refresh();
  };
  const blob = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  canvas(T.cloud, 512, 220, (g) => { const r = rng(11); for (let i = 0; i < 16; i++) blob(g, 90 + r() * 330, 80 + r() * 70, 50 + r() * 70, 30 + r() * 40, 0.35 + r() * 0.35); });
  canvas(T.mist, 1024, 200, (g) => { // tileable across: every blob drawn again a tile to either side
    const r = rng(5);
    for (let i = 0; i < 26; i++) { const x = r() * 1024, y = 60 + r() * 90, rx = 90 + r() * 160, ry = 26 + r() * 40, a = 0.25 + r() * 0.35; for (const o of [-1024, 0, 1024]) blob(g, x + o, y, rx, ry, a); }
  });
  canvas(T.light, 512, 512, (g) => { // tileable warm patches for the floor
    const r = rng(23);
    for (let i = 0; i < 10; i++) { const x = r() * 512, y = r() * 512, rad = 60 + r() * 110, a = 0.5 + r() * 0.5; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) blob(g, x + ox, y + oy, rad, rad, a); }
  });
  canvas(T.ray, 128, 1024, (g) => { // a soft shaft: bright core, fading in from the sun and out toward its end
    const gx = g.createLinearGradient(0, 0, 128, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx; g.fillRect(0, 0, 128, 1024);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, 1024);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.08, 'rgba(0,0,0,1)'); gy.addColorStop(0.55, 'rgba(0,0,0,.55)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy; g.fillRect(0, 0, 128, 1024);
  });
  canvas(T.glow, 256, 256, (g) => blob(g, 128, 128, 128, 128, 1));
  canvas(T.ring, 512, 512, (g) => { // a bright arc with a fading tail, on a circle of radius 240
    const n = 90;
    for (let i = 0; i < n; i++) {
      const a0 = (-i / n) * Math.PI * 0.75, a1 = (-(i + 1.2) / n) * Math.PI * 0.75, k = 1 - i / n;
      g.strokeStyle = `rgba(255,255,255,${(k * k).toFixed(3)})`; g.lineWidth = 3 + 9 * k; g.lineCap = 'round';
      g.beginPath(); g.arc(256, 256, 240, a1, a0); g.stroke();
    }
  });
  canvas(T.leaf, 34, 20, (g) => { // a small pointed leaf with a vein
    g.translate(17, 10); g.beginPath(); g.moveTo(-15, 0); g.quadraticCurveTo(-4, -10, 15, 0); g.quadraticCurveTo(-4, 10, -15, 0); g.closePath();
    const gr = g.createLinearGradient(0, -9, 0, 9); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b8b8b8');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(80,80,80,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.stroke();
  });
  canvas(T.petal, 22, 18, (g) => { // a rounded petal with a notch
    g.translate(11, 9); g.beginPath(); g.moveTo(-9, 0); g.bezierCurveTo(-8, -9, 6, -9, 9, -2); g.lineTo(6, 0); g.lineTo(9, 2); g.bezierCurveTo(6, 9, -8, 9, -9, 0); g.closePath();
    const gr = g.createLinearGradient(-9, 0, 9, 0); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fill();
  });
  canvas(T.drop, 4, 48, (g) => { // a rain streak
    const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(1, 0, 2, 48);
  });
  canvas(T.dot, 32, 32, (g) => blob(g, 16, 16, 16, 16, 1)); // a soft dot: snow, a firefly, an ember
  for (let f = 0; f < BIRD_FRAMES; f++) canvas(`${T.bat}${f}`, 44, 24, (g) => { // a bat: scalloped wings, four beats
    const lift = [-8, -2, 6, -2][f];
    g.translate(22, 12); g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(s * 10, lift - 4, s * 20, lift);
      g.quadraticCurveTo(s * 16, lift + 3, s * 14, lift + 6); g.quadraticCurveTo(s * 10, lift + 3, s * 8, lift + 7); g.quadraticCurveTo(s * 5, lift + 3, 0, 4); g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(0, 1.5, 3, 3.6, 0, 0, Math.PI * 2); g.fill();
  });
  for (let f = 0; f < BIRD_FRAMES; f++) canvas(`${T.bird}${f}`, 44, 24, (g) => { // a far bird's silhouette, wings at four beats
    const lift = [-9, -3, 5, -3][f], tip = [-11, -1, 8, -1][f];
    g.translate(22, 12); g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 9, lift - 2, s * 20, tip); g.quadraticCurveTo(s * 10, lift + 4, 0, 3); g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(0, 1.5, 4, 2.4, 0, 0, Math.PI * 2); g.fill();
  });
}

interface Drifter { o: Phaser.GameObjects.Image; vx: number; vy: number; w: number; spin?: number; sway?: number; ph?: number; a?: number }
interface Bird { o: Phaser.GameObjects.Image; vx: number; vy: number; t: number; fps: number }

export class StageFx {
  /** Layers by depth, each placed (and scaled) like the painting in the world: everything inside is in its pixels. */
  private layers = new Map<number, Phaser.GameObjects.Container>();
  private lay(depth: number): Phaser.GameObjects.Container {
    let c = this.layers.get(depth);
    if (!c) { c = this.scene.add.container(this.at.x, this.at.y).setScale(this.at.s).setDepth(depth); this.layers.set(depth, c); }
    return c;
  }
  private far: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.TileSprite;
  private farMask: Phaser.GameObjects.Graphics;
  private clouds: Drifter[] = [];
  private mists: { o: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private birds: Bird[] = [];
  private nextFlock = 2500;
  private rays: { o: Phaser.GameObjects.Image; a: number; al: number; p: number; ph: number }[] = [];
  private flare: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.TileSprite;
  private glow?: Phaser.GameObjects.Image;
  private sweeps: { box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; v: number }[] = [];
  private leaves: Drifter[] = [];
  private flash?: Phaser.GameObjects.Rectangle;
  private fires: { glow: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; sparks: Drifter[]; at: Pt; ph: number }[] = [];
  private nextBolt = 6000;
  private bolt = -1;
  private t = 0;
  private readonly W: number;
  private readonly H: number;

  /** W x H: the painting's size; `at`: where it is in the world and how much bigger it is shown there. */
  constructor(private scene: Phaser.Scene, private look: StageLook, W: number, H: number, private at = { x: 0, y: 0, s: 1 }) {
    makeTextures(scene);
    this.W = W; this.H = H;
    const L = look, r = rng(3);
    // the far background: clouds, mist and birds, behind the balustrade and the arches
    this.far = this.lay(-0.95);
    this.farMask = scene.make.graphics({}, false).setPosition(this.at.x, this.at.y).setScale(this.at.s);
    this.farMask.fillStyle(0xffffff).fillPoints(L.far.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    this.far.setMask(this.farMask.createGeometryMask());
    for (let i = 0; i < 6; i++) {
      const o = scene.make.image({ x: r() * W, y: L.sky[0] + r() * (L.sky[1] - L.sky[0]), key: T.cloud }, false).setTint(L.cloudTint).setAlpha(0.18 + r() * 0.2).setScale(0.9 + r() * 1.1, 0.7 + r() * 0.6);
      this.far.add(o); this.clouds.push({ o, vx: 5 + r() * 9, vy: 0, w: o.displayWidth });
    }
    for (const [i, v] of [[0, 7], [1, 13]] as const) { // two banks of valley mist, the nearer one quicker
      const [y0, y1] = L.mist, o = scene.make.tileSprite({ x: 0, y: y0 + i * 18, width: W, height: y1 - y0, key: T.mist }, false).setOrigin(0, 0).setTint(L.mistTint).setAlpha(i ? 0.32 : 0.42);
      o.setTileScale(1.2 - i * 0.25, 0.7); this.far.add(o); this.mists.push({ o, v });
    }
    // the sun: a soft flare and god rays fanning down to the left, each sweeping a little and breathing
    const [sx, sy] = L.sun;
    const rk = L.rays ?? 1, rt = L.rayTint ?? 0xffd590;
    this.flare = scene.make.image({ x: sx, y: sy, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.rayTint ?? 0xffe2a8).setScale(2.6, 2.2).setAlpha(0.22 * rk);
    this.lay(-0.45).add(this.flare);
    const RAYS: [number, number, number, number][] = [[24, 150, 0.05, 1250], [33, 230, 0.042, 1350], [42, 120, 0.06, 1300], [51, 200, 0.04, 1400], [61, 140, 0.047, 1250], [70, 260, 0.032, 1150]];
    RAYS.forEach(([a, w, al, len], i) => {
      const o = scene.make.image({ x: sx, y: sy, key: T.ray }, false).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(rt)
        .setAngle(a).setScale(w / 128, len / 1024).setAlpha(al * rk);
      this.lay(-0.45).add(o);
      this.rays.push({ o, a, al: al * rk, p: 11000 + i * 1700, ph: r() * Math.PI * 2 });
    });
    // cloud shadows and warm light drifting over the floor
    this.shade = scene.make.tileSprite({ x: 0, y: L.floorTop, width: W, height: H - L.floorTop, key: T.light }, false).setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setTint(0x2a2f3c).setAlpha(0.28);
    this.shade.setTileScale(2.6, 1.4);
    this.lay(-0.6).add(this.shade);
    this.light = scene.make.tileSprite({ x: 0, y: L.floorTop, width: W, height: H - L.floorTop, key: T.light }, false).setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(L.lightTint).setAlpha(0.1);
    this.light.setTileScale(2.2, 1.1);
    this.lay(-0.55).add(this.light);
    // the floor emblem: a breathing glow and light running round its rings
    const E = L.emblem;
    if (E) {
      const [ex, ey] = E.c;
      this.glow = scene.make.image({ x: ex, y: ey, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.emblemTint ?? 0xffc860)
        .setScale((E.outer[0] * 2.3) / 256, (E.outer[1] * 2.3) / 256).setAlpha(0.1);
      this.lay(-0.55).add(this.glow);
      for (const [ring, v, al] of [[E.outer, 0.00055, 0.42], [E.inner, -0.0009, 0.55]] as const) {
        const img = scene.make.image({ x: 0, y: 0, key: T.ring }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.emblemTint ?? 0xffd27a).setAlpha(al).setScale(ring[0] / 240);
        const box = scene.make.container({ x: ex, y: ey }, false).add(img).setScale(1, ring[1] / ring[0]);
        this.lay(-0.54).add(box);
        this.sweeps.push({ box, img, v });
      }
    }
    // the weather: most of it behind the fighters, a share in front of them
    const F = L.fall;
    for (let i = 0; i < F.n; i++) {
      const front = i % 4 === 0, tint = F.tints[i % F.tints.length];
      const d = (o: Phaser.GameObjects.Image, vx: number, vy: number, extra: Partial<Drifter> = {}) => this.leaves.push({ o, vx, vy, w: 40, spin: 0, sway: 0, ph: r() * Math.PI * 2, ...extra });
      const at = (key: string) => { const o = scene.make.image({ x: r() * W, y: r() * H, key }, false).setTint(tint); this.lay(front ? 89000 : -0.4).add(o); return o; };
      switch (F.kind) {
        case 'leaf': case 'petal': {
          const s = (front ? 0.9 : 0.55) + r() * 0.4, o = at(F.kind === 'leaf' ? T.leaf : T.petal).setScale(s).setAlpha(front ? 0.95 : 0.8);
          d(o, 40 + r() * 50, 14 + r() * 22, { spin: (r() - 0.5) * 4, sway: 18 + r() * 26, a: 1 }); break;
        }
        case 'snow': { const s = (front ? 0.32 : 0.16) + r() * 0.16, o = at(T.dot).setScale(s).setAlpha(front ? 0.95 : 0.75); d(o, 8 + r() * 14, 26 + r() * 30, { sway: 14 + r() * 18 }); break; }
        case 'rain': { const o = at(T.drop).setAlpha(front ? 0.45 : 0.3).setScale(front ? 1.3 : 0.9, front ? 1.5 : 1).setAngle(-14).setBlendMode(Phaser.BlendModes.ADD); d(o, 210, 860 + r() * 220); break; }
        case 'firefly': { const o = at(T.dot).setScale(0.12 + r() * 0.1).setBlendMode(Phaser.BlendModes.ADD); o.y = L.floorTop + r() * (H - L.floorTop); d(o, (r() - 0.5) * 24, (r() - 0.5) * 16, { sway: 20 + r() * 30, a: 0 }); break; }
        case 'ember': { const o = at(T.dot).setScale(0.1 + r() * 0.12).setBlendMode(Phaser.BlendModes.ADD); d(o, (r() - 0.3) * 30, -(30 + r() * 50), { sway: 16 + r() * 20 }); break; }
      }
    }
    for (const at of L.fires ?? []) { // a fire: a warm glow that flickers, a bright core, sparks rising off it
      const glow = scene.make.image({ x: at[0], y: at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a3c).setScale(0.9).setAlpha(0.5);
      const core = scene.make.image({ x: at[0], y: at[1] - 4, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a0).setScale(0.18, 0.26).setAlpha(0.9);
      this.lay(-0.44).add([glow, core]);
      const sparks: Drifter[] = [];
      for (let i = 0; i < 5; i++) {
        const o = scene.make.image({ x: at[0], y: at[1], key: T.dot }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050).setScale(0.07 + r() * 0.05);
        this.lay(-0.44).add(o); sparks.push({ o, vx: (r() - 0.5) * 16, vy: -(30 + r() * 40), w: 0, ph: r() * 1.5, sway: 6 + r() * 8 });
      }
      this.fires.push({ glow, core, sparks, at, ph: r() * 10 });
    }
    if (L.lightning) { this.flash = new Phaser.GameObjects.Rectangle(scene, -W, -H, W * 3, H * 4, 0xdfe8ff, 1).setOrigin(0, 0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD); this.lay(88990).add(this.flash); }
  }

  private flock(): void {
    const L = this.look, r = Math.random, fromLeft = r() < 0.5, n = 3 + Math.floor(r() * 5), key = L.fliers === 'bats' ? T.bat : T.bird;
    const y0 = L.sky[0] + 30 + r() * (L.mist[0] - L.sky[0] - 20), v = (fromLeft ? 1 : -1) * (38 + r() * 30), s = 0.45 + r() * 0.45;
    for (let i = 0; i < n; i++) { // a loose V
      const back = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const o = this.scene.make.image({ x: (fromLeft ? 160 : this.W - 160) - Math.sign(v) * Math.abs(back) * 26 * s * 1.6, y: y0 + back * 9 * s, key: `${key}0` }, false)
        .setTint(L.fliers === 'bats' ? 0x10121c : 0x3a2222).setAlpha(0.85).setScale(s * (0.85 + r() * 0.3));
      o.setData('k', key);
      this.far.add(o); this.birds.push({ o, vx: v * (0.95 + r() * 0.1) * (L.fliers === 'bats' ? 1.4 : 1), vy: (r() - 0.5) * 4, t: r() * 1000, fps: (7 + r() * 4) * (L.fliers === 'bats' ? 1.8 : 1) });
    }
  }

  update(ms: number): void {
    this.t += ms;
    const s = ms / 1000, t = this.t;
    for (const c of this.clouds) { c.o.x += c.vx * s; if (c.o.x - c.w / 2 > this.W) c.o.x = -c.w / 2; }
    for (const m of this.mists) m.o.tilePositionX -= m.v * s;
    this.nextFlock -= ms;
    if (this.nextFlock <= 0 && this.look.fliers) { this.flock(); this.nextFlock = 7000 + Math.random() * 9000; }
    this.birds = this.birds.filter((b) => {
      b.t += ms; b.o.x += b.vx * s; b.o.y += b.vy * s + Math.sin(b.t / 380) * 0.08;
      b.o.setTexture(`${b.o.getData('k')}${Math.floor((b.t / 1000) * b.fps) % BIRD_FRAMES}`);
      if (b.o.x < -60 || b.o.x > this.W + 60) { b.o.destroy(); return false; }
      return true;
    });
    this.flare.setAlpha(0.2 + 0.05 * Math.sin((t / 5200) * Math.PI * 2));
    for (const r of this.rays) {
      const k = Math.sin((t / r.p) * Math.PI * 2 + r.ph);
      r.o.setAngle(r.a + 2.5 * k).setAlpha(r.al * (1 + 0.35 * Math.sin((t / (r.p * 0.7)) * Math.PI * 2 + r.ph * 2)));
    }
    this.light.tilePositionX += 6 * s; this.light.tilePositionY += 2 * s;
    this.shade.tilePositionX += 9 * s; this.shade.tilePositionY += 3 * s;
    this.light.setAlpha(0.07 + 0.025 * Math.sin((t / 9000) * Math.PI * 2));
    this.glow?.setAlpha(0.1 + 0.06 * Math.sin((t / 4200) * Math.PI * 2));
    for (const w of this.sweeps) w.img.rotation += w.v * ms;
    const H = this.H, kind = this.look.fall.kind, top = this.look.floorTop;
    for (const l of this.leaves) {
      l.ph! += s * 2.2;
      l.o.x += (l.vx + Math.sin(l.ph!) * l.sway!) * s; l.o.y += (l.vy + Math.cos(l.ph! * 0.8) * (kind === 'rain' ? 0 : 10)) * s;
      if (l.a) { l.o.rotation += l.spin! * s; l.o.scaleY = l.o.scaleX * (0.35 + 0.65 * Math.abs(Math.sin(l.ph! * 1.3))); } // a leaf turning over as it flies
      if (kind === 'firefly') { // wandering over the floor, glowing on and off
        l.o.setAlpha(Math.max(0, Math.sin(l.ph! * 0.9)) * 0.95);
        if (l.o.y < top || l.o.y > H) l.vy = -l.vy;
        if (l.o.x < 0 || l.o.x > this.W) l.vx = -l.vx;
        continue;
      }
      if (kind === 'ember') { if (l.o.y < -20) { l.o.y = H + 10; l.o.x = Math.random() * this.W; } continue; }
      if (l.o.x > this.W + 40 || l.o.y > H + 40) {
        if (kind === 'rain') { l.o.x = Math.random() * (this.W + 300) - 300; l.o.y = -60 - Math.random() * 200; }
        else { l.o.x = -30 - Math.random() * 200; l.o.y = Math.random() * H * 0.8; }
      }
    }
    for (const f of this.fires) { // flicker: two sines and a little noise
      const k = 0.78 + 0.12 * Math.sin(t / 97 + f.ph) + 0.08 * Math.sin(t / 41 + f.ph * 2) + (Math.random() - 0.5) * 0.06;
      f.glow.setAlpha(0.5 * k).setScale(0.85 + 0.12 * k); f.core.setAlpha(0.9 * k);
      for (const sp of f.sparks) {
        sp.ph! += s;
        sp.o.x += (sp.vx + Math.sin(sp.ph! * 5) * sp.sway!) * s; sp.o.y += sp.vy * s;
        sp.o.setAlpha(Math.max(0, 1 - sp.ph! / 1.6));
        if (sp.ph! > 1.6) { sp.ph = 0; sp.o.setPosition(f.at[0] + (Math.random() - 0.5) * 8, f.at[1] - 4); }
      }
    }
    if (this.flash) { // a storm: now and then the sky flashes twice
      this.nextBolt -= ms;
      if (this.nextBolt <= 0) { this.bolt = 0; this.nextBolt = 6000 + Math.random() * 9000; }
      if (this.bolt >= 0) {
        this.bolt += ms; const b = this.bolt;
        const a = b < 90 ? 0.45 * (1 - b / 90) : b < 170 ? 0 : b < 260 ? 0.55 * (1 - (b - 170) / 90) : -1;
        if (a < 0) { this.bolt = -1; this.flash.setAlpha(0); } else this.flash.setAlpha(a);
      }
    }
  }

  destroy(): void {
    this.far.clearMask(true); this.farMask.destroy();
    for (const c of this.layers.values()) c.destroy(true);
    this.layers.clear();
    this.clouds = []; this.birds = []; this.rays = []; this.sweeps = []; this.leaves = [];
  }
}
