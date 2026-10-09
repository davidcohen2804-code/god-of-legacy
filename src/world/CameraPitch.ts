// The camera's pitch, by the player (the HUD's camera buttons, Insert / Delete): how high on its arc — the half moon from
// eye level (0°) to straight down (90°) — the camera looks at the map from. The maps are flat paintings at about 45°, so
// another pitch is simulated: the floor re-projected as if the camera had moved along that arc around what it looks at.
// Its depth is squashed (lower) or stretched (higher) by the camera's own vertical zoom (so a lower camera really sees
// more of the map), and its far side drawn narrower or wider by a post effect (the keystone), zoomed just enough to keep
// the screen covered. Presentation only: the game reads and sets the camera's zoom as always.
import Phaser from 'phaser';

/** The paintings' own pitch (degrees below eye level), the player's range and one step. */
export const PITCH_BASE = 45;
const MIN = 30, MAX = 70, STEP = 5;
/** The painted floor's horizon above the middle of the view, in map px (the courtyard painting's perspective). */
const HORIZON = 1000;
/** The pitch the camera is at: kept while the game runs (from map to map, match to match); Home resets it. */
let pitch = PITCH_BASE;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec2 uRes;
uniform vec4 uK;   // the view's middle (px from the top left), the keystone (1/px, y up), the cover zoom
varying vec2 outTexCoord;
void main() {
  vec2 p = (vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uRes - uK.xy) / uK.w;
  p.y = -p.y;
  vec2 s = p / (1.0 - uK.z * p.y);   // where this pixel was in the camera's own picture
  vec2 uv = vec2((s.x + uK.x) / uRes.x, 1.0 - (uK.y - s.y) / uRes.y);
  gl_FragColor = texture2D(uMainSampler, clamp(uv, 0.0, 1.0));
}`;

class PitchPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  cx = 0; cy = 0; k = 0; z = 1;
  constructor(game: Phaser.Game) { super({ game, name: 'CamPitch', fragShader: FRAG }); }
  onPreRender(): void {
    this.set2f('uRes', this.renderer.width, this.renderer.height);
    this.set4f('uK', this.cx, this.cy, this.k, this.z);
  }
  /** A screen point back to where it is in the camera's own picture (the mouse over a tilted view). */
  unwarp(x: number, y: number): [number, number] {
    const px = (x - this.cx) / this.z, py = (this.cy - y) / this.z, d = 1 - this.k * py;
    return [this.cx + px / d, this.cy - py / d];
  }
}

type PointerMap = (p: Phaser.Input.Pointer, x: number, y: number, move: boolean) => void;

export class CameraPitch {
  private pipe: PitchPipeline | null = null;
  /** The camera's zoom as the game sets it (before the pitch's squash). */
  private zl: number;
  private q = 1;
  private input?: { im: { transformPointer: PointerMap }; orig: PointerMap };

  /** `mapScale`: map px to world px (the arena's painting is shown bigger); `onChange`: the pitch now, in degrees. */
  constructor(private scene: Phaser.Scene, private cam: Phaser.Cameras.Scene2D.Camera, private mapScale: () => number, private onChange?: (deg: number) => void) {
    this.zl = cam.zoomX;
    Object.defineProperty(cam, 'zoom', { configurable: true, get: () => this.zl, set: (v: number) => { this.zl = v; this.squash(); } });
    cam.setZoom = ((x = 1) => { this.zl = x; this.squash(); return cam; }) as typeof cam.setZoom;
    // the mouse: what it points at under the keystone
    const im = scene.game.input as unknown as { transformPointer: PointerMap }, orig = im.transformPointer, self = this;
    im.transformPointer = function (this: unknown, p, x, y, move) {
      orig.call(this, p, x, y, move);
      if (self.pipe) { const [ux, uy] = self.pipe.unwarp(p.x, p.y); p.x = ux; p.y = uy; }
    };
    this.input = { im, orig };
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.frame, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.frame();
  }

  get deg(): number { return pitch; }
  /** One step higher (+1: toward straight down) or lower (-1: toward eye level). */
  step(dir: 1 | -1): void { this.set(pitch + dir * STEP); }
  reset(): void { this.set(PITCH_BASE); }
  private set(d: number): void {
    pitch = Phaser.Math.Clamp(Math.round(d), MIN, MAX);
    this.frame();
    this.onChange?.(pitch);
  }

  /** The depth squash: the camera's vertical zoom against its own. */
  private squash(): void {
    this.q = Math.sin(Phaser.Math.DegToRad(pitch)) / Math.sin(Phaser.Math.DegToRad(PITCH_BASE));
    this.cam.zoomX = this.zl; this.cam.zoomY = this.zl * this.q;
  }

  /** Before every frame is drawn: the squash (whatever set the zoom since) and the keystone. */
  private frame(): void {
    this.squash();
    const pipe = this.pipeline(pitch !== PITCH_BASE);
    if (!pipe) return;
    const c0 = Math.cos(Phaser.Math.DegToRad(PITCH_BASE)), c1 = Math.cos(Phaser.Math.DegToRad(pitch));
    const horizon = HORIZON * this.mapScale() * this.cam.zoomX;   // on screen, above the view's middle
    pipe.cx = this.cam.width / 2; pipe.cy = this.cam.height / 2;
    pipe.k = (c1 / c0 - 1) / (this.q * horizon);
    pipe.z = 1 + Math.abs(pipe.k) * this.cam.height / 2;
    const all = this.cam.postPipelines, i = all.indexOf(pipe);   // the keystone last (after any other camera effect)
    if (i >= 0 && i < all.length - 1) { all.splice(i, 1); all.push(pipe); }
  }

  private pipeline(on: boolean): PitchPipeline | null {
    const r = this.scene.game.renderer;
    if (r.type !== Phaser.WEBGL) return null;
    if (!on) { if (this.pipe) { this.cam.removePostPipeline(this.pipe); this.pipe = null; } return null; }
    if (this.pipe) return this.pipe;
    (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.addPostPipeline('CamPitch', PitchPipeline);
    this.cam.setPostPipeline(PitchPipeline);
    const p = this.cam.getPostPipeline(PitchPipeline);
    this.pipe = ((Array.isArray(p) ? p[0] : p) as PitchPipeline) ?? null;
    return this.pipe;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.frame, this);
    if (this.input) { this.input.im.transformPointer = this.input.orig; this.input = undefined; }
    this.pipe = null;
  }
}
