// The PvP arena's living stage (visual only — nothing here touches the fight): far clouds and valley mist drifting
// behind the balustrade, flocks of birds crossing the sky, god rays from the sun sweeping slowly, warm light drifting over
// the floor, the floor's sun emblem glowing with light running round its rings, leaves blowing across (a few in front of
// the fighters). All in the map's pixels; the far layers are masked to the far background so they pass behind the
// balustrade and the arches.
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
  birds: boolean;
  leaves: number[];
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
  birds: true,
  leaves: [0xc8281e, 0xe0501e, 0xa81c22, 0xf07a2a],
};

const T = { cloud: 'sfx-cloud', mist: 'sfx-mist', ray: 'sfx-ray', glow: 'sfx-glow', light: 'sfx-light', ring: 'sfx-ring', leaf: 'sfx-leaf', bird: 'sfx-bird' };
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
  for (let f = 0; f < BIRD_FRAMES; f++) canvas(`${T.bird}${f}`, 44, 24, (g) => { // a far bird's silhouette, wings at four beats
    const lift = [-9, -3, 5, -3][f], tip = [-11, -1, 8, -1][f];
    g.translate(22, 12); g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 9, lift - 2, s * 20, tip); g.quadraticCurveTo(s * 10, lift + 4, 0, 3); g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(0, 1.5, 4, 2.4, 0, 0, Math.PI * 2); g.fill();
  });
}

interface Drifter { o: Phaser.GameObjects.Image; vx: number; vy: number; w: number; spin?: number; sway?: number; ph?: number }
interface Bird { o: Phaser.GameObjects.Image; vx: number; vy: number; t: number; fps: number }

export class StageFx {
  private far: Phaser.GameObjects.Container;
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
  private t = 0;
  private readonly W: number;

  constructor(private scene: Phaser.Scene, private look: StageLook, W: number, H: number) {
    makeTextures(scene);
    this.W = W;
    const L = look, r = rng(3);
    // the far background: clouds, mist and birds, behind the balustrade and the arches
    this.far = scene.add.container(0, 0).setDepth(-0.95);
    this.farMask = scene.make.graphics({}, false);
    this.farMask.fillStyle(0xffffff).fillPoints(L.far.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    this.far.setMask(this.farMask.createGeometryMask());
    for (let i = 0; i < 6; i++) {
      const o = scene.add.image(r() * W, L.sky[0] + r() * (L.sky[1] - L.sky[0]), T.cloud).setTint(L.cloudTint).setAlpha(0.18 + r() * 0.2).setScale(0.9 + r() * 1.1, 0.7 + r() * 0.6);
      this.far.add(o); this.clouds.push({ o, vx: 5 + r() * 9, vy: 0, w: o.displayWidth });
    }
    for (const [i, v] of [[0, 7], [1, 13]] as const) { // two banks of valley mist, the nearer one quicker
      const [y0, y1] = L.mist, o = scene.add.tileSprite(0, y0 + i * 18, W, y1 - y0, T.mist).setOrigin(0, 0).setTint(L.mistTint).setAlpha(i ? 0.32 : 0.42);
      o.setTileScale(1.2 - i * 0.25, 0.7); this.far.add(o); this.mists.push({ o, v });
    }
    // the sun: a soft flare and god rays fanning down to the left, each sweeping a little and breathing
    const [sx, sy] = L.sun;
    this.flare = scene.add.image(sx, sy, T.glow).setDepth(-0.45).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a8).setScale(2.6, 2.2).setAlpha(0.22);
    const RAYS: [number, number, number, number][] = [[24, 150, 0.05, 1250], [33, 230, 0.042, 1350], [42, 120, 0.06, 1300], [51, 200, 0.04, 1400], [61, 140, 0.047, 1250], [70, 260, 0.032, 1150]];
    RAYS.forEach(([a, w, al, len], i) => {
      const o = scene.add.image(sx, sy, T.ray).setOrigin(0.5, 0).setDepth(-0.45).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd590)
        .setAngle(a).setScale(w / 128, len / 1024).setAlpha(al);
      this.rays.push({ o, a, al, p: 11000 + i * 1700, ph: r() * Math.PI * 2 });
    });
    // warm light drifting over the floor
    this.light = scene.add.tileSprite(0, L.floorTop, W, H - L.floorTop, T.light).setOrigin(0, 0).setDepth(-0.55)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(L.lightTint).setAlpha(0.1);
    this.light.setTileScale(2.2, 1.1);
    // the floor emblem: a breathing glow and light running round its rings
    const E = L.emblem;
    if (E) {
      const [ex, ey] = E.c;
      this.glow = scene.add.image(ex, ey, T.glow).setDepth(-0.55).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc860)
        .setScale((E.outer[0] * 2.3) / 256, (E.outer[1] * 2.3) / 256).setAlpha(0.1);
      for (const [ring, v, al] of [[E.outer, 0.00055, 0.42], [E.inner, -0.0009, 0.55]] as const) {
        const img = scene.add.image(0, 0, T.ring).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setAlpha(al).setScale(ring[0] / 240);
        const box = scene.add.container(ex, ey, [img]).setDepth(-0.54).setScale(1, ring[1] / ring[0]);
        this.sweeps.push({ box, img, v });
      }
    }
    // leaves blowing across: most behind the fighters, a few in front of them
    for (let i = 0; i < 16; i++) {
      const front = i % 4 === 0, s = (front ? 0.9 : 0.55) + r() * 0.4;
      const o = scene.add.image(r() * W, r() * H, T.leaf).setTint(L.leaves[i % L.leaves.length]).setScale(s).setAlpha(front ? 0.95 : 0.8)
        .setDepth(front ? 89000 : -0.4);
      this.leaves.push({ o, vx: 40 + r() * 50, vy: 14 + r() * 22, w: 40, spin: (r() - 0.5) * 4, sway: 18 + r() * 26, ph: r() * Math.PI * 2 });
    }
  }

  private flock(): void {
    const L = this.look, r = Math.random, fromLeft = r() < 0.5, n = 3 + Math.floor(r() * 5);
    const y0 = L.sky[0] + 30 + r() * (L.mist[0] - L.sky[0] - 20), v = (fromLeft ? 1 : -1) * (38 + r() * 30), s = 0.45 + r() * 0.45;
    for (let i = 0; i < n; i++) { // a loose V
      const back = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const o = this.scene.add.image((fromLeft ? 160 : this.W - 160) - Math.sign(v) * Math.abs(back) * 26 * s * 1.6, y0 + back * 9 * s, `${T.bird}0`)
        .setTint(0x3a2222).setAlpha(0.85).setScale(s * (0.85 + r() * 0.3));
      this.far.add(o); this.birds.push({ o, vx: v * (0.95 + r() * 0.1), vy: (r() - 0.5) * 4, t: r() * 1000, fps: 7 + r() * 4 });
    }
  }

  update(ms: number): void {
    this.t += ms;
    const s = ms / 1000, t = this.t;
    for (const c of this.clouds) { c.o.x += c.vx * s; if (c.o.x - c.w / 2 > this.W) c.o.x = -c.w / 2; }
    for (const m of this.mists) m.o.tilePositionX -= m.v * s;
    this.nextFlock -= ms;
    if (this.nextFlock <= 0 && this.look.birds) { this.flock(); this.nextFlock = 7000 + Math.random() * 9000; }
    this.birds = this.birds.filter((b) => {
      b.t += ms; b.o.x += b.vx * s; b.o.y += b.vy * s + Math.sin(b.t / 380) * 0.08;
      b.o.setTexture(`${T.bird}${Math.floor((b.t / 1000) * b.fps) % BIRD_FRAMES}`);
      if (b.o.x < -60 || b.o.x > this.W + 60) { b.o.destroy(); return false; }
      return true;
    });
    this.flare.setAlpha(0.2 + 0.05 * Math.sin((t / 5200) * Math.PI * 2));
    for (const r of this.rays) {
      const k = Math.sin((t / r.p) * Math.PI * 2 + r.ph);
      r.o.setAngle(r.a + 2.5 * k).setAlpha(r.al * (1 + 0.35 * Math.sin((t / (r.p * 0.7)) * Math.PI * 2 + r.ph * 2)));
    }
    this.light.tilePositionX += 6 * s; this.light.tilePositionY += 2 * s;
    this.light.setAlpha(0.07 + 0.025 * Math.sin((t / 9000) * Math.PI * 2));
    this.glow?.setAlpha(0.1 + 0.06 * Math.sin((t / 4200) * Math.PI * 2));
    for (const w of this.sweeps) w.img.rotation += w.v * ms;
    const H = this.light.y + this.light.height;
    for (const l of this.leaves) {
      l.ph! += s * 2.2;
      l.o.x += (l.vx + Math.sin(l.ph!) * l.sway!) * s; l.o.y += (l.vy + Math.cos(l.ph! * 0.8) * 10) * s;
      l.o.rotation += l.spin! * s; l.o.scaleY = l.o.scaleX * (0.35 + 0.65 * Math.abs(Math.sin(l.ph! * 1.3))); // turning over as it flies
      if (l.o.x > this.W + 40 || l.o.y > H + 40) { l.o.x = -30 - Math.random() * 200; l.o.y = Math.random() * H * 0.8; }
    }
  }

  destroy(): void {
    this.far.clearMask(true); this.far.destroy(true); this.farMask.destroy();
    this.flare.destroy(); this.rays.forEach((r) => r.o.destroy()); this.light.destroy(); this.glow?.destroy();
    this.sweeps.forEach((w) => w.box.destroy(true)); this.leaves.forEach((l) => l.o.destroy());
    this.clouds = []; this.birds = []; this.rays = []; this.sweeps = []; this.leaves = [];
  }
}
