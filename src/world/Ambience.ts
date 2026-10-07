// Procedural courtyard ambience: soft drifting cloud shadows on the ground and a gentle warm sun glow
// matching the map's existing upper-right lighting. Visual only — no collisions, no gameplay state.
import Phaser from 'phaser';
import { AMBIENCE as A } from '../config/layout';

const CLOUD_KEY = 'ambience-cloud-shadows';
const SUN_KEY = 'ambience-sun-glow';
const RAY_KEY = 'ambience-sun-ray';

/** Seeded PRNG so the cloud pattern is identical every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  if (!tx.exists(CLOUD_KEY)) {
    // Tileable field of soft dark blobs (drawn with wrap-around so the TileSprite has no seams).
    const { size, blobs } = A.clouds;
    const c = tx.createCanvas(CLOUD_KEY, size, size)!;
    const ctx = c.getContext();
    const r = rng(7);
    for (let i = 0; i < blobs; i++) {
      const x = r() * size, y = r() * size, rad = size * (0.12 + r() * 0.16), a = 0.55 + r() * 0.45;
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, `rgba(20,24,34,${a})`);
        g.addColorStop(0.55, `rgba(20,24,34,${a * 0.45})`);
        g.addColorStop(1, 'rgba(20,24,34,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    c.refresh();
  }
  if (!tx.exists(SUN_KEY)) {
    const s = 512, c = tx.createCanvas(SUN_KEY, s, s)!, ctx = c.getContext();
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(0.4, 'rgba(255,190,110,0.45)');
    g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    c.refresh();
  }
  if (!tx.exists(RAY_KEY)) {
    // One soft vertical light shaft: bright core fading to the sides and toward the bottom.
    const w = 128, h = 1024, c = tx.createCanvas(RAY_KEY, w, h)!, ctx = c.getContext();
    const gx = ctx.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,220,150,0)'); gx.addColorStop(0.5, 'rgba(255,220,150,1)'); gx.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = gx; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const gy = ctx.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gy; ctx.fillRect(0, 0, w, h);
    c.refresh();
  }
}

export class CourtyardAmbience {
  private clouds: Phaser.GameObjects.TileSprite;
  private sun: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];
  private maskShape: Phaser.GameObjects.Graphics;
  private t = 0;
  private fade = 1;
  private base: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene, worldW: number, worldH: number) {
    makeTextures(scene);

    // Cloud shadows: ground area only (the sky / distant castle stay untouched), above the map, below every actor.
    const top = A.clouds.groundTop;
    this.clouds = scene.add.tileSprite(0, top, worldW, worldH - top, CLOUD_KEY).setOrigin(0, 0)
      .setAlpha(A.clouds.alpha).setDepth(-0.6).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.clouds.setTileScale(A.clouds.tileScale, A.clouds.tileScale * A.clouds.squash);
    // Ground only: the mask edge sits on the balustrade base, so it reads as the floor's own edge.
    this.maskShape = scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff).fillRect(0, top, worldW, worldH - top);
    this.clouds.setMask(this.maskShape.createGeometryMask());

    // Warm sun glow + a few faint shafts from the upper right, matching the existing light direction.
    const S = A.sun;
    this.sun = scene.add.image(S.x, S.y, SUN_KEY).setDepth(-0.5).setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(S.alpha).setScale(S.width / 512, S.height / 512);
    for (const r of A.rays.list) {
      this.rays.push(scene.add.image(r.x, r.y, RAY_KEY).setOrigin(0.5, 0).setDepth(-0.5)
        .setBlendMode(Phaser.BlendModes.ADD).setAngle(A.rays.angle).setAlpha(r.alpha)
        .setScale(r.width / 128, A.rays.length / 1024));
    }
    this.base = [this.clouds, this.sun, ...this.rays].map((o) => ({ x: o.x, y: o.y }));
  }

  /** Open world: the same light over the area whose picture starts at (ox, oy). */
  moveTo(ox: number, oy: number): void {
    [this.clouds, this.sun, ...this.rays].forEach((o, i) => o.setPosition(this.base[i].x + ox, this.base[i].y + oy));
    this.maskShape.setPosition(ox, oy);
  }

  /** Faded out while the camera glides between areas. */
  setAlpha(a: number): void { this.fade = Math.max(0, Math.min(1, a)); this.clouds.setAlpha(A.clouds.alpha * this.fade); }

  update(ms: number): void {
    this.t += ms;
    const s = ms / 1000;
    this.clouds.tilePositionX += A.clouds.driftX * s / A.clouds.tileScale;
    this.clouds.tilePositionY += A.clouds.driftY * s / (A.clouds.tileScale * A.clouds.squash);
    // Very slow light "breathing" so the sun never feels static, never flickers.
    const k = Math.sin((this.t / A.sun.breatheMs) * Math.PI * 2);
    this.sun.setAlpha(A.sun.alpha * (1 + 0.12 * k) * this.fade);
    this.rays.forEach((r, i) => r.setAlpha(A.rays.list[i].alpha * (1 + 0.25 * Math.sin((this.t / A.rays.breatheMs + i * 0.33) * Math.PI * 2)) * this.fade));
  }

  destroy(): void {
    this.clouds.clearMask(true);
    this.clouds.destroy();
    this.maskShape.destroy();
    this.sun.destroy();
    this.rays.forEach((r) => r.destroy());
    this.rays = [];
  }
}
