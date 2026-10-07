// The far landscape behind the terrace (open world, layered): its picture tiles scroll slower than the terrace (parallax —
// the mountains are far away), with life in it: clouds drifting across the sky, soft mist drifting in the valley and low
// behind the balustrade, a flock of birds crossing now and then, the waterfalls flowing. Art: tools/world/sky.py →
// src/data/world-sky.json + public/assets/world/sky/*; each part simply stays out while its art is missing. Visual only.
import Phaser from 'phaser';
import SKY from '../data/world-sky.json';
import { BACKDROP, WORLD_W, bgKey, bgUrl } from './Areas';

type Rect = { x: number; y: number; w: number; h: number };
type Strip = { w: number; h: number; n: number };
const S = SKY as unknown as { clouds: Rect[]; birds: Strip | null; falls: Strip | null; spots: Rect[] };
/** All behind the terrace (its tiles are at depth -1). */
const DEPTH = { bg: -30, clouds: -28, mist: -27 };
const SKY_URL = (f: string) => `assets/world/sky/${f}.png`;
/** How much nearer than the landscape the clouds / the mist are (share of the way to the terrace's speed). */
const NEAR = { clouds: 0.12, mist: 0.3 };
const CLOUDS = { n: 8, y: [18, 205], scale: [0.42, 0.85], alpha: [0.78, 0.95], speed: [5, 12] };
const MIST = { valley: { n: 6, y: [770, 925] }, far: { n: 4, y: [262, 318] }, scale: [1.0, 1.7], alpha: [0.16, 0.3], speed: [2, 5], tint: 0xffe9ee };
const FLOCK = { every: [16000, 36000], size: [3, 5], y: [55, 210], speed: [62, 96], fps: 11, width: 26 };
const FALL_FPS = 14;

export function preloadBackdrop(scene: Phaser.Scene): void {
  if (!BACKDROP) return;
  BACKDROP.tiles.forEach((_, i) => { if (!scene.textures.exists(bgKey(i))) scene.load.image(bgKey(i), bgUrl(i)); });
  if (S.clouds.length && !scene.textures.exists('sky-clouds')) scene.load.image('sky-clouds', SKY_URL('clouds'));
  if (S.birds && !scene.textures.exists('sky-birds')) scene.load.spritesheet('sky-birds', SKY_URL('birds'), { frameWidth: S.birds.w, frameHeight: S.birds.h });
  if (S.falls && !scene.textures.exists('sky-falls')) scene.load.spritesheet('sky-falls', SKY_URL('falls'), { frameWidth: S.falls.w, frameHeight: S.falls.h });
}

const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

interface Drifter { img: Phaser.GameObjects.Image; v: number }
interface Bird { img: Phaser.GameObjects.Sprite; v: number; ph: number; y: number }

export class Backdrop {
  /** The landscape, its waterfalls and the birds: they move together. */
  private land: Phaser.GameObjects.Container;
  private sky: Phaser.GameObjects.Container;
  private haze: Phaser.GameObjects.Container;
  private tiles: (Phaser.GameObjects.Image | null)[];
  private clouds: Drifter[] = [];
  private mist: Drifter[] = [];
  private falls: Phaser.GameObjects.Sprite[] = [];
  private birds: Bird[] = [];
  private nextFlock = rnd([4000, 9000]);
  /** Clouds and mist spread over the first view (once they exist). */
  private placed = false;
  private t = 0;
  /** The view: its left edge and width (world px). */
  private left = 0;
  private span = 1;

  constructor(private scene: Phaser.Scene) {
    this.land = scene.add.container(0, 0).setDepth(DEPTH.bg);
    this.sky = scene.add.container(0, 0).setDepth(DEPTH.clouds);
    this.haze = scene.add.container(0, 0).setDepth(DEPTH.mist);
    this.tiles = (BACKDROP?.tiles ?? []).map(() => null);
    this.tiles.forEach((_, i) => this.ensureTile(i));
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    this.buildFalls(); this.buildDrifters();
  }

  private onFile(key: string): void {
    if (key.startsWith('world-bg-')) this.ensureTile(Number(key.slice(9)));
    else if (key === 'sky-falls') this.buildFalls();
    else if (key === 'sky-clouds') this.buildDrifters();
  }

  private ensureTile(i: number): void {
    if (this.tiles[i] || !BACKDROP) return;
    const key = bgKey(i);
    if (!this.scene.textures.exists(key)) { this.scene.load.image(key, bgUrl(i)); return; }
    const img = this.scene.add.image(BACKDROP.tiles[i][0], 0, key).setOrigin(0, 0);
    this.tiles[i] = img; this.land.addAt(img, 0); // under its waterfalls and birds
  }

  /** The waterfalls painted in the landscape flow (an animated sheet of falling water over each one, glowing on top). */
  private buildFalls(): void {
    if (this.falls.length || !S.falls || !S.spots.length || !this.scene.textures.exists('sky-falls')) return;
    for (const s of S.spots) {
      const f = this.scene.add.sprite(s.x, s.y, 'sky-falls', 0).setOrigin(0, 0).setDisplaySize(s.w, s.h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
      f.setData('ph', Math.random() * 1000);
      this.falls.push(f); this.land.add(f);
    }
  }

  /** Clouds across the sky; mist low in the valley (seen through the arches) and far behind the balustrade. */
  private buildDrifters(): void {
    if (this.clouds.length || !S.clouds.length || !this.scene.textures.exists('sky-clouds')) return;
    const tex = this.scene.textures.get('sky-clouds');
    S.clouds.forEach((c, i) => { if (!tex.has(`c${i}`)) tex.add(`c${i}`, 0, c.x, c.y, c.w, c.h); });
    const frame = () => `c${Math.floor(Math.random() * S.clouds.length)}`;
    for (let i = 0; i < CLOUDS.n; i++) {
      const img = this.scene.add.image(0, rnd(CLOUDS.y), 'sky-clouds', frame()).setOrigin(0, 0.5).setScale(rnd(CLOUDS.scale)).setAlpha(rnd(CLOUDS.alpha));
      img.setData('slot', (i + Math.random() * 0.6) / CLOUDS.n);
      this.clouds.push({ img, v: rnd(CLOUDS.speed) }); this.sky.add(img);
    }
    for (const band of [MIST.valley, MIST.far]) for (let i = 0; i < band.n; i++) {
      const img = this.scene.add.image(0, rnd(band.y), 'sky-clouds', frame()).setOrigin(0, 0.5).setScale(rnd(MIST.scale)).setAlpha(rnd(MIST.alpha)).setTint(MIST.tint);
      img.setData('slot', (i + Math.random() * 0.7) / band.n);
      this.mist.push({ img, v: rnd(MIST.speed) }); this.haze.add(img);
    }
    this.placed = false;
  }

  /** Share of the terrace's scrolling speed the landscape moves at: its picture's ends meet the world's ends. */
  private get k(): number { return BACKDROP ? Phaser.Math.Clamp((BACKDROP.w - this.span) / Math.max(1, WORLD_W - this.span), 0, 1) : 1; }

  /** The view moved (world px of its left edge, its width). */
  setView(left: number, span: number): void {
    this.left = left; this.span = span;
    const k = this.k;
    this.land.x = left * (1 - k);
    this.sky.x = left * (1 - (k + (1 - k) * NEAR.clouds));
    this.haze.x = left * (1 - (k + (1 - k) * NEAR.mist));
    if (!this.placed && this.clouds.length) { // first view: spread the clouds and the mist over it
      this.placed = true;
      for (const [list, near] of [[this.clouds, NEAR.clouds], [this.mist, NEAR.mist]] as const) {
        const [lo, hi] = this.range(near);
        for (const d of list) d.img.x = lo + (hi - lo) * (d.img.getData('slot') as number);
      }
    }
  }

  /** Where drifters of a layer are kept (that layer's own px): the view plus a margin each side, so they wrap unseen. */
  private range(near: number): [number, number] {
    const k = this.k, f = k + (1 - k) * near, m = 420;
    return [this.left * f - m, this.left * f + this.span + m];
  }

  update(ms: number): void {
    this.t += ms;
    const s = ms / 1000;
    for (const [list, near] of [[this.clouds, NEAR.clouds], [this.mist, NEAR.mist]] as const) {
      const [lo, hi] = this.range(near), w = hi - lo;
      for (const d of list) {
        const im = d.img; im.x += d.v * s;
        const iw = im.displayWidth;
        if (im.x > hi) im.x -= w + iw; else if (im.x + iw < lo) im.x += w + iw;
      }
    }
    for (const f of this.falls) f.setFrame(Math.floor((this.t + (f.getData('ph') as number)) / (1000 / FALL_FPS)) % (S.falls?.n ?? 1));
    this.stepBirds(ms);
  }

  /** Now and then a small flock crosses the sky, wings beating, gently rising and falling. */
  private stepBirds(ms: number): void {
    if (!S.birds || !this.scene.textures.exists('sky-birds')) return;
    const k = this.k, u0 = this.left * k, u1 = u0 + this.span, s = ms / 1000;
    this.nextFlock -= ms;
    if (this.nextFlock <= 0 && !this.birds.length) {
      this.nextFlock = rnd(FLOCK.every);
      const n = Math.round(rnd(FLOCK.size)), dir = Math.random() < 0.5 ? 1 : -1, y0 = rnd(FLOCK.y), v = rnd(FLOCK.speed) * dir;
      for (let i = 0; i < n; i++) {
        const lead = i === 0 ? 0 : Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const x = (dir > 0 ? u0 - 60 : u1 + 60) - dir * lead * 26, y = y0 + side * lead * 11;
        const img = this.scene.add.sprite(x, y, 'sky-birds', 0).setScale(FLOCK.width / S.birds.w).setFlipX(dir < 0).setAlpha(0.9); // small: far away
        this.birds.push({ img, v: v * (0.97 + Math.random() * 0.06), ph: Math.random() * 1000, y }); this.land.add(img);
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.img.x += b.v * s; b.ph += ms;
      b.img.y = b.y + Math.sin(b.ph / 700) * 4;
      b.img.setFrame(Math.floor(b.ph / (1000 / FLOCK.fps)) % (S.birds!.n));
      if ((b.v > 0 && b.img.x > u1 + 160) || (b.v < 0 && b.img.x < u0 - 160)) { b.img.destroy(); this.birds.splice(i, 1); }
    }
  }

  destroy(): void {
    this.scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    this.land.destroy(true); this.sky.destroy(true); this.haze.destroy(true);
    this.clouds = []; this.mist = []; this.falls = []; this.birds = [];
  }
}
