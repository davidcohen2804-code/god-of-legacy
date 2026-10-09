// The Scribe's (book mage) effects drawn on the GPU: ink that flows and bleeds, strokes written from the pen tip, edges that
// burn away gold as they vanish — shaped by moving noise and a colour ramp (deep ink → teal → gold → white only at the
// core), never a picture that just grows and fades. Each effect is a Phaser Shader quad driven by a few uniforms.
import Phaser from 'phaser';

const NOISE = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float uP;      // main progress (write / grow / travel), 0..1
uniform float uE;      // erosion (vanish), 0..1
uniform float uSeed;
uniform float uA;      // extra shape value
varying vec2 fragCoord;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
const vec3 INK = vec3(0.03, 0.06, 0.18);
const vec3 TEAL = vec3(0.22, 0.82, 1.0);
const vec3 GOLD = vec3(1.0, 0.78, 0.36);
const vec3 PAPER = vec3(1.0, 0.96, 0.86);
`;

/** A calligraphic stroke written left → right across the quad (uP = how far the pen has gone, uA = curve), burning away at uE. */
const STROKE = NOISE + `
void main() {
  vec2 uv = fragCoord / resolution; float x = uv.x, t = time * 0.001;
  float cy = 0.5 + uA * sin(x * 3.6 + uSeed) * 0.22;
  float w = (0.05 + 0.2 * pow(sin(clamp(x, 0.0, 1.0) * 3.14159), 0.6)) * (1.0 - smoothstep(uP - 0.03, uP, x));
  float d = abs(uv.y - cy);
  float n = fbm(vec2(x * 7.0 - t * 0.6, uv.y * 5.0) + uSeed);
  float edge = max(0.0001, w * (0.7 + 0.6 * n));
  float body = 1.0 - smoothstep(edge * 0.8, edge, d);
  float dry = fbm(vec2(x * 2.5 + uSeed, uv.y * 46.0));                       // dry-brush streaks along the stroke
  body *= smoothstep(0.22, 0.42, dry + (1.0 - d / edge) * 0.55);
  float er = fbm(uv * vec2(9.0, 3.5) + uSeed * 7.0);
  float alive = smoothstep(uE, uE + 0.07, er);
  float burn = (smoothstep(uE - 0.02, uE + 0.02, er) - smoothstep(uE + 0.02, uE + 0.09, er)) * step(0.001, uE);
  float core = 1.0 - smoothstep(0.0, edge * 0.4, d);
  vec3 col = mix(INK, TEAL, smoothstep(0.15, 0.85, 1.0 - d / edge));
  col = mix(col, PAPER, core * 0.75);
  float a = body * alive;
  float tipOn = 1.0 - step(0.995, uP);
  float tip = exp(-pow((x - uP) * resolution.x / 12.0, 2.0) - pow((uv.y - cy) * resolution.y / 12.0, 2.0)) * tipOn;
  float haze = (1.0 - smoothstep(edge, edge * 3.2, d)) * 0.22 * alive * step(x, uP);
  vec3 outc = col * a + TEAL * haze + GOLD * (burn * body * 2.2 + tip * 1.6);
  gl_FragColor = vec4(outc, clamp(max(a, haze * 0.8) + tip * 0.6, 0.0, 1.0));
}`;

/** A lance of written light flying right: a bright core, script marks inside it, light streaming back along it. */
const LANCE = NOISE + `
void main() {
  vec2 uv = fragCoord / resolution; float x = uv.x, t = time * 0.001;
  float th = mix(0.04, 0.2, smoothstep(0.0, 0.62, x)) * (1.0 - smoothstep(0.72, 1.0, x));
  float head = (1.0 - smoothstep(0.62, 1.0, x)) * step(0.62, x) * 0.32;          // the spear head
  float d = abs(uv.y - 0.5), w = max(th, head * (1.0 - (x - 0.62) / 0.38));
  float flow = fbm(vec2(x * 7.0 + t * 9.0, uv.y * 9.0) + uSeed);
  float edge = max(0.0001, w * (0.75 + 0.5 * flow));
  float body = 1.0 - smoothstep(edge * 0.7, edge, d);
  float tail = smoothstep(0.0, 0.45, x + (flow - 0.5) * 0.35);
  float glyph = step(0.55, fract(x * 16.0 + uSeed)) * step(0.3, fract(x * 5.3 + uSeed * 2.0)) * (1.0 - smoothstep(0.0, edge * 0.35, d)); // script marks
  float core = 1.0 - smoothstep(0.0, edge * 0.45, d);
  vec3 col = mix(INK, TEAL, smoothstep(0.1, 0.8, 1.0 - d / edge));
  col = mix(col, GOLD, core * 0.7); col = mix(col, PAPER, glyph * 0.9);
  float a = body * tail * (1.0 - uE);
  float halo = (1.0 - smoothstep(edge, edge * 3.0, d)) * tail * 0.3 * (1.0 - uE);
  gl_FragColor = vec4(col * a + TEAL * halo, clamp(a + halo * 0.6, 0.0, 1.0));
}`;

/** The seal: a gold sigil stamped on the foe (turning rings, ticks, three rune marks), burning away at uE. */
const SEAL = NOISE + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x), t = time * 0.001;
  float spin = ang + t * 1.6 + uSeed;
  float ring1 = 1.0 - smoothstep(0.018, 0.04, abs(r - 0.86));
  float ring2 = 1.0 - smoothstep(0.008, 0.02, abs(r - 0.72));
  float ticks = step(0.55, fract(spin * 24.0 / 6.2832)) * step(0.74, r) * step(r, 0.84);
  float runes = 0.0;
  for (int k = 0; k < 3; k++) { float a0 = float(k) * 2.094 - t * 0.9 + uSeed; vec2 c = vec2(cos(a0), sin(a0)) * 0.42; vec2 q = (uv * 2.0 - c);
    runes += (1.0 - smoothstep(0.02, 0.04, abs(length(q) - 0.12))) + (1.0 - smoothstep(0.015, 0.03, abs(q.x))) * step(abs(q.y), 0.12); }
  float star = (1.0 - smoothstep(0.0, 0.05, abs(uv.x * 2.0) * abs(uv.y * 2.0) * 9.0 - 0.0)) * step(r, 0.5);
  float lines = clamp(ring1 + ring2 + ticks + runes + star * 0.6, 0.0, 1.0) * step(r, 1.0);
  float er = fbm(uv * 7.0 + uSeed);
  float alive = smoothstep(uE, uE + 0.08, er);
  float burn = (smoothstep(uE - 0.02, uE + 0.02, er) - smoothstep(uE + 0.02, uE + 0.1, er)) * step(0.001, uE) * lines;
  float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.18 + uP * (1.0 - smoothstep(0.0, 0.9, r)) * 0.6;   // uP: the stamp's flash
  vec3 col = mix(GOLD, PAPER, uP * 0.6);
  float a = lines * alive;
  gl_FragColor = vec4(col * a + TEAL * glow * alive + GOLD * burn * 2.0, clamp(a + glow * 0.5 * alive, 0.0, 1.0));
}`;

/** An ink splash: dark ink bursting out in blobs and droplets with a teal rim and gold flecks, soaking away at uE. */
const SPLASH = NOISE + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x);
  float n = fbm(vec2(ang * 2.2 + uSeed, r * 2.0));
  float reach = uP * (0.42 + 0.45 * n);
  float blob = 1.0 - smoothstep(reach - 0.04, reach, r);
  vec2 cell = floor(uv * 14.0 + uSeed); float rnd = h21(cell);
  vec2 cuv = fract(uv * 14.0 + uSeed) - 0.5;
  float drop = step(0.82, rnd) * (1.0 - smoothstep(0.12, 0.3, length(cuv))) * step(r, uP * 1.05) * step(reach * 0.8, r);
  float shape = clamp(blob * (1.0 - smoothstep(reach * 0.55, reach, r) * 0.0) + drop, 0.0, 1.0);
  float er = fbm(uv * 6.0 + uSeed * 3.0);
  float alive = smoothstep(uE, uE + 0.1, er);
  float rim = (1.0 - smoothstep(0.0, 0.07, abs(r - reach))) * blob;
  float fleck = step(0.93, h21(floor(uv * 40.0 + uSeed))) * blob;
  vec3 col = INK + TEAL * rim * 1.4 + GOLD * fleck;
  float a = shape * alive * 0.92;
  gl_FragColor = vec4(col * a, a);
}`;

/** A ring of force racing out (drawn flat when the quad is squashed): a teal edge with a gold leading line. */
const WAVE = NOISE + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x);
  float n = fbm(vec2(ang * 3.0 + uSeed, uP * 3.0));
  float rr = uP * (0.9 + 0.1 * n);
  float band = (1.0 - smoothstep(0.0, 0.06 + 0.06 * (1.0 - uP), abs(r - rr)));
  float inner = (1.0 - smoothstep(0.0, 0.25, rr - r)) * step(r, rr) * 0.35;
  float a = (band + inner) * (1.0 - uP) * (1.0 - uE);
  gl_FragColor = vec4((TEAL * band + GOLD * band * 0.6 * step(rr - 0.02, r) + TEAL * inner * 0.5) * a, a * 0.8);
}`;

const SOURCES: Record<string, string> = { stroke: STROKE, lance: LANCE, seal: SEAL, splash: SPLASH, wave: WAVE };
export type InkKind = 'stroke' | 'lance' | 'seal' | 'splash' | 'wave';

/** Registers the shaders once (WebGL only). */
export function ensureInk(scene: Phaser.Scene): boolean {
  if (scene.game.renderer.type !== Phaser.WEBGL) return false;
  const cache = scene.cache.shader;
  for (const [k, src] of Object.entries(SOURCES)) if (!cache.has(`ink-${k}`))
    cache.add(`ink-${k}`, new Phaser.Display.BaseShader(`ink-${k}`, src, undefined, {
      uP: { type: '1f', value: 0 }, uE: { type: '1f', value: 0 }, uSeed: { type: '1f', value: 0 }, uA: { type: '1f', value: 0 },
    }));
  return true;
}

/** One shader effect quad (the caller drives its uniforms every frame). */
export function inkQuad(scene: Phaser.Scene, kind: InkKind, x: number, y: number, w: number, h: number, seed = Math.random() * 50): Phaser.GameObjects.Shader | null {
  if (!ensureInk(scene)) return null;
  const sh = scene.add.shader(`ink-${kind}`, x, y, Math.round(w), Math.round(h));
  sh.setUniform('uSeed.value', seed);
  return sh;
}
