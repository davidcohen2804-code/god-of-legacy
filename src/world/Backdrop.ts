// The far landscape behind the terrace (open world, layered): its picture tiles scroll slower than the terrace (parallax —
// the mountains are far away), with life in it: clouds drifting across the sky, soft mist drifting in the valley and low
// behind the balustrade, a flock of birds crossing now and then, the waterfalls flowing. Art: tools/world/sky.py →
// src/data/world-sky.json + public/assets/world/sky/*; each part simply stays out while its art is missing. Visual only.
import Phaser from 'phaser';
import SKY from '../data/world-sky.json';
import { BACKDROP, BG_SKY_URL, WORLD_W, bgKey, bgUrl } from './Areas';

type Rect = { x: number; y: number; w: number; h: number };
type Strip = { w: number; h: number; n: number };
const S = SKY as unknown as { clouds: Rect[]; birds: Strip | null; falls: Strip | null; spots: Rect[] };
/** All behind the terrace (its tiles are at depth -1): the sky, the clouds (behind the mountains), the landscape, the mist. */
const DEPTH = { sky: -34, clouds: -32, bg: -30, mist: -27 };
const SKY_URL = (f: string) => `assets/world/sky/${f}.png`;
/** The clouds are further than the landscape (they move this share of its speed); the mist is nearer (this share of the way
 *  from the landscape's speed to the terrace's). */
const FAR_CLOUDS = 0.6;
const NEAR_MIST = 0.3;
/** Clouds high in the sky (shown this wide, px), a few at a time; mist low in the valley (seen through the arches) and far
 *  behind the balustrade: the same clouds, wide, pale and faint. */
const CLOUDS = { n: 6, y: [24, 110], width: [160, 380], alpha: [0.85, 0.97], speed: [1.8, 3.6] };
/** More clouds higher up (seen once the camera rises over the maps above): bigger, softer, slower. */
const HIGH_CLOUDS = { n: 11, y: [-760, -40], width: [140, 720], alpha: [0.5, 0.9], speed: [0.8, 3.2] };
/** Each cloud its own: a size, its shape stretched or squashed, mirrored or not, and a light of its own (golden, rosy or
 *  shaded lavender) — never a row of the same cloud. */
const LOOKS = [0xffffff, 0xfff0dc, 0xffe2e8, 0xe8dcf4, 0xffead0];
const MIST = { valley: { n: 6, y: [780, 930] }, far: { n: 4, y: [250, 300] }, width: [520, 900], alpha: [0.14, 0.26], speed: [1, 2.4], tint: 0xffe9ee };
const FLOCK = { every: [16000, 36000], size: [3, 5], y: [55, 205], speed: [62, 96], fps: 11, width: [24, 32] };
/** The falling water laid over each painted fall: soft (far away, see sky.py), slow, sunset-tinted and faint — the
 *  painting's falls shimmer under it. */
const FALL = { fps: 9, alpha: 0.36, tint: 0xf2dacd };

export function preloadBackdrop(scene: Phaser.Scene): void {
  if (!BACKDROP) return;
  BACKDROP.tiles.forEach((_, i) => { if (!scene.textures.exists(bgKey(i))) scene.load.image(bgKey(i), bgUrl(i)); });
  if (BACKDROP.sky && !scene.textures.exists('world-bg-sky')) scene.load.image('world-bg-sky', BG_SKY_URL);
  if (S.clouds.length && !scene.textures.exists('sky-clouds')) scene.load.image('sky-clouds', SKY_URL('clouds'));
  if (S.birds && !scene.textures.exists('sky-birds')) scene.load.spritesheet('sky-birds', SKY_URL('birds'), { frameWidth: S.birds.w, frameHeight: S.birds.h });
  if (S.falls && !scene.textures.exists('sky-falls')) scene.load.spritesheet('sky-falls', SKY_URL('falls'), { frameWidth: S.falls.w, frameHeight: S.falls.h });
}

const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

/** Each drifter sits in its own little container, moved by the container: the camera rounds a picture's own position to
 *  whole pixels (crisp sprites), which would make a slow cloud hop a pixel at a time; a container's position glides. */
interface Drifter { box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; v: number }
interface Bird { box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Sprite; v: number; ph: number; y: number }

export class Backdrop {
  /** The landscape, its waterfalls and the birds: they move together. */
  private land: Phaser.GameObjects.Container;
  /** The landscape's own sky, behind the clouds (moves with the landscape). */
  private skyBack: Phaser.GameObjects.Container;
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
    this.skyBack = scene.add.container(0, 0).setDepth(DEPTH.sky);
    this.sky = scene.add.container(0, 0).setDepth(DEPTH.clouds);
    // the sky a shade deeper and cooler than the clouds toward its top (the warm clouds stand out from it; the horizon
    // keeps its glow): a soft screen-wide veil between the sky picture and the clouds
    const cam = scene.cameras.main, vw = cam.width / cam.zoom * 2.4, vh = cam.height / cam.zoom * 2.4;
    this.veil = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky + 1);
    this.veil.fillGradientStyle(0x6f68a8, 0x6f68a8, 0x6f68a8, 0x6f68a8, 0.34, 0.34, 0, 0).fillRect(-vw / 2, -vh * 0.4, vw * 2, vh * 0.75);
    this.ensureSky();
    this.haze = scene.add.container(0, 0).setDepth(DEPTH.mist);
    this.tiles = (BACKDROP?.tiles ?? []).map(() => null);
    this.tiles.forEach((_, i) => this.ensureTile(i));
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    this.buildFalls(); this.buildDrifters();
  }

  private ensureSky(): void {
    if (!BACKDROP?.sky || this.skyBack.length || !this.scene.textures.exists('world-bg-sky')) return;
    this.skyBack.add(this.scene.add.image(0, 0, 'world-bg-sky').setOrigin(0, 0).setScale(BACKDROP.sky));
  }

  private onFile(key: string): void {
    if (key === 'world-bg-sky') this.ensureSky();
    else if (key.startsWith('world-bg-')) this.ensureTile(Number(key.slice(9)));
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
      const f = this.scene.add.sprite(s.x, s.y, 'sky-falls', 0).setOrigin(0, 0).setDisplaySize(s.w, s.h).setTint(FALL.tint).setAlpha(FALL.alpha);
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
      const img = this.scene.add.image(0, 0, 'sky-clouds', frame()).setOrigin(0, 0.5).setAlpha(rnd(CLOUDS.alpha));
      this.vary(img, rnd([110, 460]));
      const box = this.scene.add.container(0, rnd(CLOUDS.y), [img]).setData('slot', (i + Math.random() * 0.6) / CLOUDS.n);
      this.clouds.push({ box, img, v: rnd(CLOUDS.speed) }); this.sky.add(box);
    }
    for (let i = 0; i < HIGH_CLOUDS.n; i++) {
      const img = this.scene.add.image(0, 0, 'sky-clouds', frame()).setOrigin(0, 0.5).setAlpha(rnd(HIGH_CLOUDS.alpha));
      this.vary(img, rnd(HIGH_CLOUDS.width));
      const y = HIGH_CLOUDS.y[0] + ((i + 0.5) / HIGH_CLOUDS.n) * (HIGH_CLOUDS.y[1] - HIGH_CLOUDS.y[0]) + rnd([-40, 40]);
      const box = this.scene.add.container(0, y, [img]).setData('slot', ((i * 0.37) % 1));
      this.clouds.push({ box, img, v: rnd(HIGH_CLOUDS.speed) }); this.sky.add(box);
    }
    for (const band of [MIST.valley, MIST.far]) for (let i = 0; i < band.n; i++) {
      const img = this.scene.add.image(0, 0, 'sky-clouds', frame()).setOrigin(0, 0.5).setAlpha(rnd(MIST.alpha)).setTint(MIST.tint);
      img.setScale(rnd(MIST.width) / img.width, (rnd(MIST.width) / img.width) * 0.45);   // flattened: a layer of haze
      const box = this.scene.add.container(0, rnd(band.y), [img]).setData('slot', (i + Math.random() * 0.7) / band.n);
      this.mist.push({ box, img, v: rnd(MIST.speed) }); this.haze.add(box);
    }
    this.placed = false;
  }

  /** One cloud's own look: its width, a stretch or squash, mirrored or not, a light of its own. */
  private vary(img: Phaser.GameObjects.Image, width: number): void {
    const s = width / img.width;
    img.setScale(s, s * rnd([0.72, 1.18])).setFlipX(Math.random() < 0.5).setTint(LOOKS[Math.floor(Math.random() * LOOKS.length)]);
  }

  /** Share of the terrace's scrolling speed the landscape moves at: its picture's ends meet the world's ends. */
  /** The landscape grows when the view is wider than it (the camera drawn back up high): never a bare edge. */
  private grow = 1;
  private get k(): number { return BACKDROP ? Phaser.Math.Clamp((BACKDROP.w * this.grow - this.span) / Math.max(1, WORLD_W - this.span), 0, 1) : 1; }

  /** The view moved (world px of its left edge, its width). */
  /** The camera risen this far above the terrace (climbing towers): the landscape and the sky sink less than the
   *  terrace (they are far away), and the sky above the landscape's top is filled with its own colour. */
  setLift(lift: number): void {
    this.land.y = this.skyBack.y = -lift * 0.75; this.sky.y = -lift * 0.85; this.haze.y = -lift * 0.6;
    if (!this.skyTop) {
      let c = 0xf2b48a;
      try { // the average of the sky picture's top row: the fill continues it without a seam
        const key = this.scene.textures.exists('world-bg-sky') ? 'world-bg-sky' : bgKey(0), src = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 1; const x = cv.getContext('2d')!; x.drawImage(src, 0, 0, src.width, 2, 0, 0, 64, 1);
        const d = x.getImageData(0, 0, 64, 1).data; let r = 0, g = 0, b = 0; for (let i = 0; i < 64; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
        c = Phaser.Display.Color.GetColor(r / 64, g / 64, b / 64);
      } catch { /* the default */ }
      // higher up the sky deepens a little toward a soft rose-violet (never a flat sheet of one colour)
      const hi = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(c), Phaser.Display.Color.ValueToColor(0x8d7cb4), 100, 62);
      const top = Phaser.Display.Color.GetColor(hi.r, hi.g, hi.b);
      this.skyTop = this.scene.add.graphics();
      this.skyTop.fillStyle(top, 1).fillRect(-4000, -3000, 60000, 1800);
      this.skyTop.fillGradientStyle(top, top, c, c, 1, 1, 1, 1).fillRect(-4000, -1200, 60000, 1202);
      this.skyBack.addAt(this.skyTop, 0);
      const blend = this.scene.add.graphics(); blend.fillGradientStyle(c, c, c, c, 1, 1, 0, 0); blend.fillRect(-4000, -2, 60000, 90);
      this.skyBack.add(blend);   // over the sky picture's top edge: no seam
    }
  }
  private skyTop?: Phaser.GameObjects.Graphics;
  private veil: Phaser.GameObjects.Graphics;

  setView(left: number, span: number): void {
    this.left = left; this.span = span;
    this.grow = BACKDROP ? Math.max(1, (span + 8) / BACKDROP.w) : 1;
    this.land.setScale(this.grow); this.skyBack.setScale(this.grow);
    const k = this.k;
    this.land.x = left * (1 - k) - (this.grow - 1) * 4; this.skyBack.x = this.land.x;
    this.sky.x = left * (1 - this.f('clouds'));
    this.haze.x = left * (1 - this.f('mist'));
    if (!this.placed && this.clouds.length) { // first view: spread the clouds and the mist over it
      this.placed = true;
      for (const [list, layer] of [[this.clouds, 'clouds'], [this.mist, 'mist']] as const) {
        const [lo, hi] = this.range(layer);
        for (const d of list) d.box.x = lo + (hi - lo) * (d.box.getData('slot') as number);
      }
    }
  }

  /** Share of the terrace's speed a layer moves at. */
  private f(layer: 'clouds' | 'mist'): number { const k = this.k; return layer === 'clouds' ? k * FAR_CLOUDS : k + (1 - k) * NEAR_MIST; }

  /** Where drifters of a layer are kept (that layer's own px): the view plus a margin each side, so they wrap unseen. */
  private range(layer: 'clouds' | 'mist'): [number, number] {
    const f = this.f(layer), m = 460;
    return [this.left * f - m, this.left * f + this.span + m];
  }

  update(ms: number): void {
    this.t += ms;
    const s = ms / 1000;
    for (const [list, layer] of [[this.clouds, 'clouds'], [this.mist, 'mist']] as const) {
      const [lo, hi] = this.range(layer), w = hi - lo;
      for (const d of list) {
        const b = d.box; b.x += d.v * s;
        const iw = d.img.displayWidth;
        if (b.x > hi) b.x -= w + iw; else if (b.x + iw < lo) b.x += w + iw;
      }
    }
    for (const f of this.falls) {   // setFrame resets the size to the frame's: keep each fall's own
      const w = f.displayWidth, h = f.displayHeight;
      f.setFrame(Math.floor((this.t + (f.getData('ph') as number)) / (1000 / FALL.fps)) % (S.falls?.n ?? 1)).setDisplaySize(w, h);
    }
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
        const img = this.scene.add.sprite(0, 0, 'sky-birds', 0).setScale(rnd(FLOCK.width) / S.birds.w).setFlipX(dir < 0).setAlpha(0.92); // small: far away
        const box = this.scene.add.container(x, y, [img]);
        this.birds.push({ box, img, v: v * (0.97 + Math.random() * 0.06), ph: Math.random() * 1000, y }); this.land.add(box);
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.box.x += b.v * s; b.ph += ms;
      b.box.y = b.y + Math.sin(b.ph / 700) * 4;
      const sc = b.img.scaleX; b.img.setFrame(Math.floor(b.ph / (1000 / FLOCK.fps)) % (S.birds!.n)).setScale(sc);
      if ((b.v > 0 && b.box.x > u1 + 160) || (b.v < 0 && b.box.x < u0 - 160)) { b.box.destroy(true); this.birds.splice(i, 1); }
    }
  }

  destroy(): void {
    this.scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    this.veil.destroy(); this.land.destroy(true); this.skyBack.destroy(true); this.sky.destroy(true); this.haze.destroy(true);
    this.clouds = []; this.mist = []; this.falls = []; this.birds = [];
  }
}
