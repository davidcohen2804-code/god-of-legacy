// A chibi look shown in a page's own canvas (the creation screen, the cash shop): the composed frames drawn big, pixel
// sharp, playing the idle (with its blink every fourth cycle) or the walk.
import type Phaser from 'phaser';

interface Rect { x: number; y: number; w: number; h: number }
export interface PreviewAnims { [name: string]: { frames: string[]; ms: number[]; loop: boolean } }

export class ChibiPreview {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private src: CanvasImageSource | null = null;
  private rects: Record<string, Rect[]> = {};
  private ms: Record<string, number[]> = {};
  private raf = 0;
  private t0 = performance.now();
  mode: 'idle' | 'walk' = 'idle';
  flip = false;

  /** w × h css px; scale: canvas px per chibi pixel; feet: where the frame's feet (48, 88) stand in the canvas. */
  constructor(w: number, h: number, private scale: number, private feet: [number, number], private frame = 96, private origin: [number, number] = [48, 88]) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    const tick = () => { this.draw(); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  set(scene: Phaser.Scene, key: string, anims: PreviewAnims): void {
    const tex = scene.textures.get(key);
    this.src = tex.getSourceImage() as CanvasImageSource;
    this.rects = {}; this.ms = {};
    for (const [n, a] of Object.entries(anims)) {
      this.rects[n] = a.frames.map((f) => { const fr = tex.get(f); return { x: fr.cutX, y: fr.cutY, w: fr.cutWidth, h: fr.cutHeight }; });
      this.ms[n] = a.ms;
    }
  }

  private at(name: string, t: number): Rect | null {
    const r = this.rects[name], ms = this.ms[name];
    if (!r || !r.length) return null;
    const total = ms.reduce((s, m) => s + m, 0) || 1;
    let x = ((t % total) + total) % total;
    for (let i = 0; i < ms.length; i++) { if (x < ms[i]) return r[i]; x -= ms[i]; }
    return r[r.length - 1];
  }

  private draw(): void {
    const c = this.ctx, t = performance.now() - this.t0;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.src) return;
    let fr: Rect | null;
    if (this.mode === 'walk') fr = this.at('walk4', t);
    else {
      fr = this.at('idle', t);
      const ms = this.ms.idle, b = this.rects.blink;
      if (ms && b?.length) {                                                      // the blink, every fourth idle cycle
        const cyc = ms.reduce((s, m) => s + m, 0), tt = t % (cyc * 4);
        if (tt >= cyc * 3 && tt - cyc * 3 < Math.min(this.ms.blink[0], ms[0])) fr = b[0];
      }
    }
    if (!fr) return;
    const s = this.scale, dx = this.feet[0] - this.origin[0] * s, dy = this.feet[1] - this.origin[1] * s;
    c.save();
    if (this.flip) { c.translate(this.feet[0] * 2, 0); c.scale(-1, 1); }
    c.drawImage(this.src, fr.x, fr.y, fr.w, fr.h, dx, dy, this.frame * s, this.frame * s);
    c.restore();
  }

  destroy(): void { cancelAnimationFrame(this.raf); this.src = null; }
}
