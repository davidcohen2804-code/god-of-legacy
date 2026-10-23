// The weight of a blow on the whole picture (Prometheus-style, the same in the open game, the arena and PVP 3D): a ring of
// bent air racing out from the main hit, a split of colour that snaps in and fades, and on an ultimate's blow a radial
// blur toward it — one camera post effect, idle (no pass at all) when nothing is happening. Presentation only.
import Phaser from 'phaser';

const N = 6;
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uRes;
uniform vec4 uW[${N}];   // ring: x, y (uv), radius (px), strength (px)
uniform vec4 uK[${N}];   // ring: width (px), squash (y scale), -, -
uniform vec4 uAb;        // colour split: centre (uv), amount, -
uniform vec4 uRb;        // radial blur: centre (uv), amount, -
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord, px = uv * uRes;
  vec2 off = vec2(0.0); float edge = 0.0;
  for (int i = 0; i < ${N}; i++) {
    vec4 w = uW[i]; vec4 k = uK[i];
    if (w.w == 0.0) continue;
    vec2 d = px - w.xy * uRes; d.y /= k.y;
    float r = length(d); vec2 n = d / max(r, 0.001);
    float g = (r - w.z) / k.x, band = exp(-g * g);
    off -= n * w.w * band * g * 1.6 * vec2(1.0, k.y);
    edge += band * abs(w.w) / 24.0;
  }
  vec2 suv = uv + off / uRes;
  vec4 c;
  if (uRb.z > 0.0) {                                   // a zoom blur toward the blow
    vec2 dir = (suv - uRb.xy) * uRb.z;
    c = vec4(0.0);
    for (int j = 0; j < 10; j++) c += texture2D(uMainSampler, suv - dir * (float(j) / 9.0));
    c /= 10.0;
  } else c = texture2D(uMainSampler, suv);
  vec2 ca = (off / uRes) * 0.04 * clamp(edge, 0.0, 1.0) + (suv - uAb.xy) * uAb.z;
  if (dot(ca, ca) > 1e-9) {
    c.r = mix(c.r, texture2D(uMainSampler, suv + ca).r, 0.9);
    c.b = mix(c.b, texture2D(uMainSampler, suv - ca).b, 0.9);
  }
  gl_FragColor = c;
}`;

export class ImpactPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  w = new Float32Array(N * 4);
  k = new Float32Array(N * 4);
  ab = new Float32Array(4);
  rb = new Float32Array(4);
  constructor(game: Phaser.Game) { super({ game, name: 'ImpactFx', fragShader: FRAG }); }
  onPreRender(): void {
    this.set2f('uRes', this.renderer.width, this.renderer.height);
    this.set4fv('uW', this.w); this.set4fv('uK', this.k);
    this.set4f('uAb', this.ab[0], this.ab[1], this.ab[2], 0); this.set4f('uRb', this.rb[0], this.rb[1], this.rb[2], 0);
  }
}

interface Ring { x: number; y: number; z: number; t: number; life: number; r0: number; r1: number; s: number; width: number; squash: number }
interface Pulse { x: number; y: number; z: number; amt: number; left: number; ms: number }
type V3 = { x: number; y: number; z: number };

/** Where a world point (x, floor depth y, height z — px) is on the screen (canvas px) and how many px a world px is there:
 *  set by PVP 3D (its camera sees the world in perspective); the flat game maps through the Phaser camera. */
export type ScreenOf = (x: number, y: number, z: number) => { sx: number; sy: number; k: number };

export class ImpactFx {
  /** PVP 3D: its projection (null in the flat game). */
  static screenOf: ScreenOf | null = null;
  /** PVP 3D: a point drawn at (x, drawn y) with no floor of its own, placed where the room shows it (over the nearest
   *  fighter, like every effect there) — used by the effects that only know the drawn point (SpaceWarp). */
  static drawnAt: ((x: number, wy: number) => { sx: number; sy: number; k: number }) | null = null;

  /** Until then (scene time) nothing bends the picture: an ultimate's cut-in portrait is on the screen. */
  quietUntil = 0;
  private rings: Ring[] = [];
  private ab: Pulse | null = null;
  private rb: Pulse | null = null;
  private pipe: ImpactPipeline | null = null;
  private failed = false;
  constructor(private scene: Phaser.Scene, private cam: () => Phaser.Cameras.Scene2D.Camera) {}

  private ensure(): boolean {
    if (this.pipe) return true;
    if (this.failed) return false;
    const r = this.scene.game.renderer;
    if (r.type !== Phaser.WEBGL) { this.failed = true; return false; }
    const pm = (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
    if (!pm.getPostPipeline('ImpactFx')) pm.addPostPipeline('ImpactFx', ImpactPipeline);
    const c = this.cam();
    c.setPostPipeline(ImpactPipeline);
    const p = c.getPostPipeline(ImpactPipeline);
    this.pipe = ((Array.isArray(p) ? p[0] : p) as ImpactPipeline) ?? null;
    if (!this.pipe) { this.failed = true; return false; }
    this.pipe.active = false;
    return true;
  }

  /** A ring of bent air from the blow (world point), racing out to r1 px over `life` ms; squash < 1 lays it on the floor. */
  ripple(at: V3, o: { r1: number; life: number; s: number; width?: number; squash?: number }): void {
    if (!this.ensure()) return;
    // PVP 3D: a ring round the blow read as a clear glass dome over both fighters (the Samurai chat) — there it runs out
    // along the floor under the blow instead (the 3D camera's ellipse), a little smaller and softer
    const floor = !!ImpactFx.screenOf && o.squash === undefined;
    this.rings.push({ x: at.x, y: at.y, z: floor ? 0 : at.z, t: 0, life: o.life, r0: 0, r1: floor ? o.r1 * 0.75 : o.r1, s: floor ? o.s * 0.6 : o.s, width: o.width ?? 22, squash: o.squash ?? (floor ? 0.42 : 1) });
    if (this.rings.length > N) this.rings.shift();
  }
  /** The colour splits from the blow outward (amount: a share of the distance to it), snapping in and fading. */
  aberration(amt: number, ms: number, at: V3): void {
    if (!this.ensure()) return;
    if (this.ab && this.ab.left > 0 && this.ab.amt * (this.ab.left / this.ab.ms) > amt) return;
    this.ab = { x: at.x, y: at.y, z: at.z, amt, left: ms, ms };
  }
  /** A zoom blur toward the blow (amount: how far each pixel smears toward it), fading. */
  blur(amt: number, ms: number, at: V3): void {
    if (!this.ensure()) return;
    if (this.rb && this.rb.left > 0 && this.rb.amt * (this.rb.left / this.rb.ms) > amt) return;
    this.rb = { x: at.x, y: at.y, z: at.z, amt, left: ms, ms };
  }

  private uv(x: number, y: number, z: number): { u: number; v: number; k: number } {
    const S = ImpactFx.screenOf, w = this.scene.scale.width, h = this.scene.scale.height;
    if (S) { const p = S(x, y, z); return { u: p.sx / w, v: 1 - p.sy / h, k: p.k * (this.scene.game.renderer.width / w) }; }
    const wv = this.cam().worldView;
    return { u: (x - wv.x) / wv.width, v: 1 - (y - z - wv.y) / wv.height, k: this.scene.game.renderer.width / Math.max(1, wv.width) };
  }

  /** `dt`: the effects' time (0 through a hit-stop: the rings of bent air hang with the blow); `real`: the real time — the
   *  colour split and the zoom blur snap in and fade on it (held through an ultimate's hit-stop they smeared the whole
   *  picture into a grey-brown blur with streaks for half a second: DFO 19 Oct). */
  update(dt: number, real = dt): void {
    const P = this.pipe; if (!P) return;
    this.rings = this.rings.filter((w) => (w.t += dt) < w.life);
    P.w.fill(0); P.k.fill(0);
    this.rings.forEach((w, i) => {
      const u = w.t / w.life, e = 1 - Math.pow(1 - u, 3), q = this.uv(w.x, w.y, w.z);
      P.w.set([q.u, q.v, (w.r0 + (w.r1 - w.r0) * e) * q.k, w.s * (1 - u) * (1 - u) * q.k], i * 4);
      P.k.set([w.width * q.k, w.squash, 0, 0], i * 4);
    });
    const pulse = (p: Pulse | null, out: Float32Array): boolean => {
      if (!p || p.left <= 0) { out[2] = 0; return false; }
      p.left -= real; const k = Math.max(0, p.left / p.ms), q = this.uv(p.x, p.y, p.z);
      out[0] = q.u; out[1] = q.v; out[2] = p.amt * k * k; return true;
    };
    const a = pulse(this.ab, P.ab), b = pulse(this.rb, P.rb);
    P.active = (this.rings.length > 0 || a || b) && this.scene.time.now >= this.quietUntil;
  }

  destroy(): void { this.rings = []; this.ab = this.rb = null; if (this.pipe) this.pipe.active = false; }
}
