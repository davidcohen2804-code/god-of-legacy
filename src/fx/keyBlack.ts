// Painted effects that keep their colours on bright floors (DFO, 18 Oct — David 20:49: "not professional"; 20:51: a free
// hand in GPT and PixVerse). Our GPT / PixVerse effect sheets are painted on black and were drawn ADDED to the picture:
// on the bright red planks (and any bright map) added light turns white-grey — the class colour is lost. The KeyBlack
// pipeline draws such a sheet as if it had been painted with alpha: its brightness becomes its cover, its colour is
// un-mixed from the black, and it is laid OVER the floor (normal blending) — a violet star stays violet on red wood.
// Use: keyBlack(image) in place of image.setBlendMode(ADD). The same idea in the room's 3D: Fx3D.flip (key 'black').
import Phaser from 'phaser';

const FRAG = `
#define SHADER_NAME GOL_KEYBLACK_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
void main ()
{
  vec4 t = texture2D(uMainSampler, outTexCoord);
  // painted on black: how bright it is is how much it covers; its colour un-mixed from the black under it
  float m = max(t.r, max(t.g, t.b));
  float a = smoothstep(0.04, 0.6, m) * t.a;
  vec3 col = min(t.rgb / max(a, 0.001), vec3(1.0)) * outTint.bgr;
  a *= outTint.a;
  gl_FragColor = vec4(col * a, a); // (premultiplied, as the renderer blends)
}`;

/** The pipeline (registered in the game config as 'KeyBlack'). */
export class KeyBlackPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) { super({ game, fragShader: FRAG } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig); }
}

/** Draw a sheet painted on black so it covers in its own colours (normal blending) instead of adding light that washes
 *  white on bright floors. A no-op outside WebGL (the canvas renderer keeps ADD). Returns the object. */
export function keyBlack<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.BlendMode & Phaser.GameObjects.Components.Pipeline>(o: T): T {
  const r = o.scene?.sys.game.renderer;
  if (r && r.type === Phaser.WEBGL && (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.has('KeyBlack')) { o.setPipeline('KeyBlack'); o.setBlendMode(Phaser.BlendModes.NORMAL); }
  else o.setBlendMode(Phaser.BlendModes.ADD);
  return o;
}
