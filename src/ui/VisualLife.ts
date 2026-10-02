// Subtle ambient motion for static presentation art (render only): logo gem glow and cloak wind on previews.
import Phaser from 'phaser';

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Soft red glow over the logo's gem: slow breathing pulse with a rare, gentle flicker (additive, never covers the art).
 * `at` is the gem centre in screen design coordinates.
 */
export function addLogoGlow(scene: Phaser.Scene, at: { x: number; y: number }, radius: number): void {
  const key = 'life-gem-glow';
  if (!scene.textures.exists(key)) {
    const c = scene.textures.createCanvas(key, 256, 256)!, ctx = c.getContext();
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,120,80,0.9)'); g.addColorStop(0.25, 'rgba(235,40,30,0.55)');
    g.addColorStop(0.6, 'rgba(160,10,10,0.18)'); g.addColorStop(1, 'rgba(120,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    c.refresh();
  }
  const img = scene.add.image(at.x, at.y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(10);
  const base = (radius * 2) / 256;
  let t = 0, flicker = 0, nextFlicker = 2600 + Math.random() * 3000;
  const tick = (_time: number, d: number) => {
    t += d;
    nextFlicker -= d;
    if (nextFlicker <= 0) { flicker = 1; nextFlicker = 2600 + Math.random() * 3800; }
    flicker = Math.max(0, flicker - d / 160);
    const breath = 0.5 + 0.5 * Math.sin((t / 2600) * Math.PI * 2);
    const f = flicker > 0 ? Math.sin(flicker * Math.PI * 3) * 0.12 * flicker : 0;
    img.setAlpha(0.22 + 0.26 * breath + f);
    img.setScale(base * (0.94 + 0.08 * breath));
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}

/**
 * Cloak / cloth wind on a full-body preview: a travelling horizontal sway (two displacement maps in quadrature),
 * weighted to the lower cloak and the silhouette edges; zero at the feet and on the head/torso centre line.
 * `pixels` = max sway in display pixels. WebGL only (no-op otherwise).
 */
export function addClothWind(scene: Phaser.Scene, img: Phaser.GameObjects.Image, pixels = 2.2): void {
  if (!img.preFX) return;
  const make = (key: string, phase: number) => {
    if (scene.textures.exists(key)) return;
    const W = 64, H = 256, c = scene.textures.createCanvas(key, W, H)!, ctx = c.getContext(), d = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1), wv = smooth(0.3, 0.58, v) * (1 - smooth(0.86, 0.97, v));
      const wave = Math.sin(v * Math.PI * 2 * 1.6 + phase);
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1), wu = 0.35 + 0.65 * smooth(0.06, 0.28, Math.abs(u - 0.5));
        const r = Math.round(255 * (0.5 + 0.5 * wv * wu * wave)), i = (y * W + x) * 4;
        d.data[i] = r; d.data[i + 1] = r; d.data[i + 2] = r; d.data[i + 3] = 255;
      }
    }
    ctx.putImageData(d, 0, 0);
    c.refresh();
  };
  make('life-wind-sin', 0);
  make('life-wind-cos', Math.PI / 2);
  const a = img.preFX.addDisplacement('life-wind-sin', 0, 0), b = img.preFX.addDisplacement('life-wind-cos', 0, 0);
  let t = 0;
  const tick = (_time: number, dt: number) => {
    t += dt;
    if (!img.active) return;
    const amp = (2 * pixels) / Math.max(1, img.displayWidth); // disp = (r - 0.5) * amount, |r - 0.5| <= 0.5
    const gust = 0.75 + 0.25 * Math.sin((t / 5200) * Math.PI * 2); // slow gusts
    const w = (t / 1700) * Math.PI * 2;
    a.x = amp * gust * Math.cos(w); a.y = 0;
    b.x = amp * gust * Math.sin(w); b.y = 0;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}
