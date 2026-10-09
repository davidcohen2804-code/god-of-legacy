// The book mage's energy drawn on the GPU: lightning that crawls and forks, a nova ring of crystal frost, a gravity vortex of
// starlight, a pillar of rising plasma, ice crystals with facets and rims, starbursts with rays. Each is a Phaser Shader quad
// driven by a few uniforms (uP progress, uE vanish, uSeed, uA extra). Output is premultiplied: colour with alpha 0 adds light.
import Phaser from 'phaser';

const HEAD = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float uP;
uniform float uE;
uniform float uSeed;
uniform float uA;
varying vec2 fragCoord;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vn(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
const vec3 VOID = vec3(0.10, 0.04, 0.28);
const vec3 VIO = vec3(0.58, 0.40, 1.00);
const vec3 CYAN = vec3(0.38, 0.86, 1.00);
const vec3 ICE = vec3(0.80, 0.96, 1.00);
const vec3 WHITE = vec3(1.0);
`;

/** Lightning across the quad, left → right: a jagged white core that re-forms every few frames, violet-blue glow, side forks. uP = brightness, uA = thickness. */
const BOLT = HEAD + `
float path(float x, float s) { return (fbm(vec2(x * 6.0, s)) - 0.5) * 0.55 + (vn(vec2(x * 30.0, s * 3.1)) - 0.5) * 0.12; }
void main() {
  vec2 uv = fragCoord / resolution; float x = uv.x;
  float s = uSeed + floor(time / 55.0) * 7.31;
  float env = pow(sin(clamp(x, 0.0, 1.0) * 3.14159), 0.5);
  float y0 = 0.5 + path(x, s) * env;
  float dpx = abs(uv.y - y0) * resolution.y;
  float th = max(0.6, uA);
  float core = 1.0 - smoothstep(th * 0.6, th * 1.4, dpx);
  float glow = exp(-dpx / (th * 5.0)) * 0.9 + exp(-dpx / (th * 14.0)) * 0.3;
  float fork = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k), st = 0.15 + 0.25 * fk + 0.1 * h21(vec2(s, fk)), len = 0.18 + 0.12 * h21(vec2(fk, s));
    float t = (x - st) / len;
    if (t > 0.0 && t < 1.0) { float yb = 0.5 + path(st, s) * env + (h21(vec2(s + fk, 3.0)) - 0.5) * 0.9 * t + path(x * 1.7, s + 11.0 + fk) * 0.4 * t;
      float db = abs(uv.y - yb) * resolution.y; fork += (1.0 - smoothstep(0.3 * th, 0.9 * th, db)) * (1.0 - t) + exp(-db / (th * 5.0)) * 0.35 * (1.0 - t); }
  }
  float m = smoothstep(0.5, 0.3, abs(uv.y - 0.5)) * smoothstep(0.0, 0.04, x) * smoothstep(1.0, 0.96, x);
  glow *= m; fork *= m; core *= m;
  float I = uP;
  vec3 col = WHITE * (core + fork * 0.8) + mix(VIO, CYAN, 0.55) * (glow * 0.55 + fork * 0.25);
  gl_FragColor = vec4(col * I, clamp(core + fork * 0.6, 0.0, 1.0) * I * 0.9);
}`;

/** A nova ring of crystal frost racing out (squash the quad onto the floor): white-hot leading edge, cyan rim, frost streaks behind. uP = radius 0..1, uE = vanish. */
const NOVA = HEAD + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x);
  float jag = fbm(vec2(ang * 9.0 + uSeed, uSeed)) * 0.07 + vn(vec2(ang * 40.0, uSeed)) * 0.025;
  float R = uP * 0.88 + jag * uP;
  float lead = 1.0 - smoothstep(0.0, 0.018, abs(r - R));
  float rim = exp(-abs(r - R) / 0.035) * step(r, R + 0.05);
  float behind = step(r, R) * smoothstep(R - 0.32, R, r) * (1.0 - 0.5 * uP);
  float streak = pow(fbm(vec2(ang * 26.0 + uSeed, r * 2.0)), 2.2) * behind;
  float frost = fbm(uv * 14.0 + uSeed) * behind;
  float haze = exp(-max(0.0, r - R) / 0.05) * step(R, r) * 0.6;
  float fade = (1.0 - uE);
  vec3 col = WHITE * lead * 1.4 + CYAN * rim * 1.1 + ICE * (streak * 1.3 + frost * 0.2) + VIO * haze * 0.4;
  float a = clamp(lead * 0.9 + streak * 0.35 + frost * 0.06, 0.0, 1.0);
  gl_FragColor = vec4(col * fade, a * fade * 0.85);
}`;

/** A gravity vortex: spiral arms of starlight wind inward to a bright core, star specks spiral in. uP = grip (core), uE = vanish, uA = spin direction. */
const VORTEX = HEAD + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x), t = time * 0.001;
  float dir = uA == 0.0 ? 1.0 : uA;
  float sw = ang * dir + log(max(r, 0.02)) * 2.6 + t * 7.0 + uSeed;
  float arms = pow(0.5 + 0.5 * cos(sw * 3.0), 5.0);
  float n = fbm(vec2(sw * 1.3, r * 4.0 - t * 3.0));
  float mask = smoothstep(1.0, 0.55, r) * smoothstep(0.03, 0.18, r);
  float a1 = arms * mask * (0.4 + 0.9 * n);
  float stars = 0.0;
  for (int k = 0; k < 18; k++) { float fk = float(k), ph = fract(h21(vec2(fk, uSeed)) - t * (0.6 + 0.5 * h21(vec2(uSeed, fk))));
    float rr = ph, aa = h21(vec2(fk * 1.3, 2.0)) * 6.283 + (1.0 - ph) * 3.5 * dir;
    vec2 p = vec2(cos(aa), sin(aa)) * rr * 0.5; stars += exp(-length(uv - p) * 220.0) * (1.0 - ph) * 1.5; }
  float core = exp(-r * (9.0 - 4.0 * uP)) * (0.4 + 1.2 * uP);
  float fade = 1.0 - uE;
  vec3 col = mix(VIO, CYAN, n) * a1 * 1.1 + WHITE * (stars + core * 0.5) + VIO * core * 0.5;
  gl_FragColor = vec4(col * fade, clamp(a1 * 0.35 + core * 0.4, 0.0, 1.0) * fade);
}`;

/** A pillar of plasma rising from the bottom edge: a white core, violet edges, streaming up; a flare at its base. uP = intensity, uE = erodes from the bottom up. */
const PILLAR = HEAD + `
void main() {
  vec2 uv = fragCoord / resolution; float t = time * 0.001;
  float y = uv.y, x = (uv.x - 0.5) * 2.0;
  float flow = fbm(vec2(x * 2.5 + uSeed, y * 3.0 - t * 5.0));
  float w = mix(0.62, 0.12, pow(y, 0.8)) * (0.7 + 0.6 * flow);
  float body = 1.0 - smoothstep(w * 0.35, w, abs(x));
  float core = 1.0 - smoothstep(0.0, w * 0.22, abs(x));
  float streaks = pow(fbm(vec2(x * 10.0 + uSeed, y * 1.4 - t * 9.0)), 3.0) * 2.6 * body;
  float base = exp(-length(vec2(x * 1.1, y * 5.0)) * 3.0);
  float m = smoothstep(1.0, 0.8, abs(x)) * smoothstep(1.0, 0.45, y);
  float er = smoothstep(uE - 0.1, uE + 0.1, y + (flow - 0.5) * 0.3);
  float I = uP * er * m;
  vec3 col = mix(VIO, CYAN, flow * 0.8) * body * 0.75 + WHITE * (core * 0.7 + streaks * 0.35) + mix(VIO, CYAN, 0.3) * base * 0.9;
  gl_FragColor = vec4(col * I, clamp(core * 0.35 + body * 0.12, 0.0, 1.0) * I);
}`;

/** An ice crystal standing on the bottom edge: faceted faces, a bright ridge and rim; grows to uP of its height, cracks away at uE. */
const SHARD = HEAD + `
void main() {
  vec2 uv = fragCoord / resolution; float y = uv.y, x = (uv.x - 0.5) * 2.0;
  if (y > uP) { gl_FragColor = vec4(0.0); return; }
  float hw = pow(1.0 - y, 0.9) * 0.95 + (vn(vec2(y * 14.0, uSeed)) - 0.5) * 0.05;
  float ridge = 0.22 * (1.0 - y) * (h21(vec2(uSeed, 1.0)) - 0.5);
  float inside = 1.0 - smoothstep(hw - 0.05, hw, abs(x));
  float lit = x < ridge ? 0.0 : 1.0;                                   // the face toward the light
  float u2 = (x - ridge) / max(hw, 0.01);
  float edge = smoothstep(0.62, 0.98, abs(u2)) * inside;
  float rl = 1.0 - smoothstep(0.0, 0.035, abs(x - ridge));
  float inner = pow(fbm(vec2(x * 3.0 + uSeed, y * 6.0)), 2.0);          // depth inside the ice
  float crack = step(fbm(uv * 8.0 + uSeed), uE * 1.15);
  vec3 base = mix(vec3(0.05, 0.20, 0.45), vec3(0.55, 0.88, 1.0), clamp(y * 0.9 + lit * 0.35, 0.0, 1.0));
  vec3 col = base * (0.55 + 0.45 * lit) + ICE * inner * 0.35 + ICE * edge * 0.8 + WHITE * rl * (0.6 + 0.4 * lit);
  float a = inside * (1.0 - crack) * (0.62 + 0.25 * lit + 0.3 * edge);
  float tip = exp(-length(vec2(x * 2.5, (y - uP) * 5.0)) * 2.2) * 0.8 * (1.0 - uE);
  gl_FragColor = vec4(col * a + CYAN * tip + CYAN * edge * 0.25, a);
}`;

/** A starburst: a hot core and long thin rays, turning a little. uP = 0..1 life (swells then fades), uA = ray count. */
const STAR = HEAD + `
void main() {
  vec2 uv = fragCoord / resolution - 0.5; float r = length(uv) * 2.0, ang = atan(uv.y, uv.x);
  float N = uA == 0.0 ? 8.0 : uA;
  float life = sin(clamp(uP, 0.0, 1.0) * 3.14159) * (1.0 - uP * 0.5);
  float rays = pow(abs(cos(ang * N * 0.5 + uSeed + uP * 0.6)), 60.0) * (0.6 + 0.6 * vn(vec2(ang * 5.0, uSeed))) * exp(-r * 2.2);
  float rays2 = pow(abs(cos(ang * N + uSeed * 2.0)), 120.0) * exp(-r * 4.0) * 0.6;
  float core = exp(-r * 14.0) * 1.3 + exp(-r * 4.5) * 0.2;
  vec3 col = WHITE * (core * 0.8 + rays * 1.1 + rays2) + mix(VIO, CYAN, 0.5) * exp(-r * 2.5) * 0.35;
  gl_FragColor = vec4(col * life * smoothstep(1.0, 0.75, r), 0.0);
}`;

const SOURCES = { bolt: BOLT, nova: NOVA, vortex: VORTEX, pillar: PILLAR, shard: SHARD, star: STAR } as const;
export type MageShader = keyof typeof SOURCES;

export function ensureMageShaders(scene: Phaser.Scene): boolean {
  if (scene.game.renderer.type !== Phaser.WEBGL) return false;
  const cache = scene.cache.shader;
  for (const [k, src] of Object.entries(SOURCES)) if (!cache.has(`mgs-${k}`))
    cache.add(`mgs-${k}`, new Phaser.Display.BaseShader(`mgs-${k}`, src, undefined, {
      uP: { type: '1f', value: 0 }, uE: { type: '1f', value: 0 }, uSeed: { type: '1f', value: 0 }, uA: { type: '1f', value: 0 },
    }));
  return true;
}

export function mageQuad(scene: Phaser.Scene, kind: MageShader, x: number, y: number, w: number, h: number, seed = Math.random() * 50): Phaser.GameObjects.Shader | null {
  if (!ensureMageShaders(scene)) return null;
  const sh = scene.add.shader(`mgs-${kind}`, x, y, Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
  sh.setUniform('uSeed.value', seed);
  return sh;
}
