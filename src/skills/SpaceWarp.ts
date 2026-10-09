// The book mage bends space: a camera post effect that refracts the whole scene around shockwaves (a ring of bent air racing
// out, with a split of colour on its edge) and gravity wells (space drawn in and twisted toward a point). Presentation only.
import Phaser from 'phaser';

const N = 6;
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uRes;
uniform vec4 uW[${N}];   // x, y (uv), radius (px), strength (px)
uniform vec4 uK[${N}];   // kind (1 ring / 2 well), width (px), squash (y scale), twist
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord, px = uv * uRes;
  vec2 off = vec2(0.0); float edge = 0.0;
  for (int i = 0; i < ${N}; i++) {
    vec4 w = uW[i], k = uK[i];
    if (w.w == 0.0) continue;
    vec2 d = px - w.xy * uRes; d.y /= k.z;
    float r = length(d); vec2 n = d / max(r, 0.001);
    if (k.x < 1.5) {                                    // a ring of bent air at radius w.z
      float g = (r - w.z) / k.y, band = exp(-g * g);
      off -= n * w.w * band * g * 1.6 * vec2(1.0, k.z);
      edge += band * abs(w.w) / 30.0;
    } else {                                            // a gravity well: drawn in and twisted inside radius w.z
      float f = clamp(1.0 - r / w.z, 0.0, 1.0); f = f * f;
      vec2 t = vec2(-n.y, n.x);
      off += (n * w.w + t * k.w) * f * vec2(1.0, k.z);
      edge += 0.0;
    }
  }
  vec2 o = off / uRes, ca = o * 0.1 * clamp(edge, 0.0, 1.0);
  vec4 c = texture2D(uMainSampler, uv + o);
  c.r = texture2D(uMainSampler, uv + o + ca).r;
  c.b = texture2D(uMainSampler, uv + o - ca).b;
  gl_FragColor = c;
}`;

export class WarpPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  w = new Float32Array(N * 4);
  k = new Float32Array(N * 4);
  constructor(game: Phaser.Game) { super({ game, name: 'MageWarp', fragShader: FRAG }); }
  onPreRender(): void {
    this.set2f('uRes', this.renderer.width, this.renderer.height);
    this.set4fv('uW', this.w); this.set4fv('uK', this.k);
  }
}

interface Wave { kind: 1 | 2; x: number; y: number; t: number; life: number; r0: number; r1: number; s: number; width: number; squash: number; twist: number; follow?: () => { x: number; y: number } | null }

/** Shockwaves and wells in world coordinates, turned into the post effect's uniforms every frame. */
export class SpaceWarp {
  private waves: Wave[] = [];
  private pipe: WarpPipeline | null = null;
  constructor(private scene: Phaser.Scene, private cam: () => Phaser.Cameras.Scene2D.Camera) {}

  private ensure(): boolean {
    if (this.pipe) return true;
    const r = this.scene.game.renderer;
    if (r.type !== Phaser.WEBGL) return false;
    const pm = (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
    if (!pm.getPostPipeline('MageWarp')) pm.addPostPipeline('MageWarp', WarpPipeline);
    const c = this.cam();
    c.setPostPipeline(WarpPipeline);
    const p = c.getPostPipeline(WarpPipeline);
    this.pipe = (Array.isArray(p) ? p[0] : p) as WarpPipeline;
    return !!this.pipe;
  }

  /** A ring of bent air racing from r0 to r1 px (world) over `life` ms; squash < 1 lays it on the floor. */
  ring(x: number, y: number, o: { r0?: number; r1: number; life: number; s?: number; width?: number; squash?: number }): void {
    if (!this.ensure()) return;
    this.push({ kind: 1, x, y, t: 0, life: o.life, r0: o.r0 ?? 0, r1: o.r1, s: o.s ?? 22, width: o.width ?? 26, squash: o.squash ?? 1, twist: 0 });
  }
  /** A gravity well: space drawn toward (x, y) and twisted, swelling then letting go. */
  well(x: number, y: number, o: { r: number; life: number; s?: number; twist?: number; squash?: number; follow?: () => { x: number; y: number } | null }): void {
    if (!this.ensure()) return;
    this.push({ kind: 2, x, y, t: 0, life: o.life, r0: o.r, r1: o.r, s: o.s ?? 26, width: 1, squash: o.squash ?? 1, twist: o.twist ?? 18, follow: o.follow });
  }
  private push(w: Wave): void { this.waves.push(w); if (this.waves.length > N) this.waves.shift(); }

  update(dt: number): void {
    if (!this.pipe) return;
    const cam = this.cam(), wv = cam.worldView, W = this.pipe.w, K = this.pipe.k;
    const zx = this.scene.game.renderer.width / Math.max(1, wv.width);
    this.waves = this.waves.filter((w) => (w.t += dt) < w.life);
    W.fill(0); K.fill(0);
    this.waves.forEach((w, i) => {
      const u = w.t / w.life, f = w.follow?.(); if (f) { w.x = f.x; w.y = f.y; }
      const sx = (w.x - wv.x) / wv.width, sy = 1 - (w.y - wv.y) / wv.height;
      let r: number, s: number;
      if (w.kind === 1) { const e = 1 - Math.pow(1 - u, 3); r = (w.r0 + (w.r1 - w.r0) * e) * zx; s = w.s * (1 - u) * (1 - u) * zx; }
      else { r = w.r0 * zx; const env = u < 0.25 ? u / 0.25 : u > 0.75 ? (1 - u) / 0.25 : 1; s = w.s * env * zx; }
      W.set([sx, sy, r, s], i * 4);
      K.set([w.kind, w.width * zx, w.squash, w.twist * (w.kind === 2 ? (u < 0.25 ? u / 0.25 : u > 0.75 ? (1 - u) / 0.25 : 1) : 0) * zx], i * 4);
    });
  }
}
