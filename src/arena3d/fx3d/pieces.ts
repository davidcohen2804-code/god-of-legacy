// PVP 3D — DFO's second set of pieces (18 Oct, David: the Book Mage and the Archer rebuilt "as they should be"): shapes the
// first set (../Fx3D.ts) has no word for. Each one lives in the room's 3D, split round the fighters where it wraps them, and
// lights the room where it shines.
//   star      a four-point star flare (the Book Mage's mark, a glint, a bolt's head), turned to the eye
//   seal      the Book Mage's compass seal (the star of his book's cover in a ring of runes): on the floor or upright
//   funnel    a tornado: a bending funnel of wind streaks turning round its axis
//   frost     hoarfrost racing out over the planks (ferns of ice), then melting away
//   cloud     a storm cloud hanging over a place, lit from inside by its lightning
//   shell     a sphere of hexagons round a fighter (a ward): it lights where it is struck, shatters at its end
//   chains    chains of light from the floor to a foe, pulled tight round him
//   hole      a portal in the floor: a dark well with a burning rim, light spiralling down into it
//   arrow     a real arrow riding a shot (shaft, head, fletching), its trail behind it
//   crane     a paper crane riding a shot, its wings beating
//   ribbon    a ribbon of light along a path drawn as it goes (a gust, a vine, a comet's tail)
import * as THREE from 'three';
import type { Fx3D, V3 } from '../Fx3D';
import type { Projectile } from '../../skills/HitGeometry';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const outCubic = (k: number): number => 1 - Math.pow(1 - k, 3);
const outBack = (k: number): number => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const inQuad = (k: number): number => k * k;
/** Quick in, a hold, a soft fade: 0..1 over a life (k 0..1). */
const env = (k: number, inK = 0.08, outK = 0.45): number => (k < inK ? k / inK : k > 1 - outK ? Math.max(0, (1 - k) / outK) : 1);
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
type At = V3 | (() => V3 | null);
const getter = (at: At): (() => V3 | null) => (typeof at === 'function' ? at : () => at);

// ------------------------------------------------------------------ pictures (drawn once, white on clear)

const texs = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { blur?: number; repeat?: boolean; srgb?: boolean } = {}): THREE.Texture {
  const had = texs.get(key); if (had) return had;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw(g, w, h);
  let out: HTMLCanvasElement = c;
  if (o.blur) { // a glow under the strokes: the picture blurred, the sharp one over it
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d')!;
    g2.filter = `blur(${o.blur}px)`; g2.drawImage(c, 0, 0); g2.filter = 'none'; g2.drawImage(c, 0, 0); out = c2;
  }
  const t = new THREE.CanvasTexture(out); t.colorSpace = o.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  texs.set(key, t); return t;
}

/** The four-point star: two long tapering spikes crossing, two short ones between, a soft heart. */
function starTex(): THREE.Texture {
  return canvasTex('star4', 256, 256, (g, S) => {
    const m = S / 2;
    const glow = g.createRadialGradient(m, m, 0, m, m, m * 0.42); glow.addColorStop(0, 'rgba(255,255,255,0.9)'); glow.addColorStop(0.25, 'rgba(255,255,255,0.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, S, S);
    const spike = (a: number, L: number, W: number, alpha: number) => {
      g.save(); g.translate(m, m); g.rotate(a);
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, `rgba(255,255,255,${alpha})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -W); g.quadraticCurveTo(L * 0.3, -W * 0.25, L, 0); g.quadraticCurveTo(L * 0.3, W * 0.25, 0, W); g.closePath(); g.fill(); g.restore();
    };
    for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2, m * 0.98, 9, 1);
    for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2 + Math.PI / 4, m * 0.42, 5, 0.7);
    const core = g.createRadialGradient(m, m, 0, m, m, 16); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core; g.beginPath(); g.arc(m, m, 16, 0, Math.PI * 2); g.fill();
  });
}

/** The seal's outer ring: a double ring, ticks, eight small stars, rune marks between the rings. */
function sealRingTex(): THREE.Texture {
  return canvasTex('seal-ring', 512, 512, (g, S) => {
    const m = S / 2; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); };
    ring(S * 0.47, 5); ring(S * 0.445, 2); ring(S * 0.35, 3.5); ring(S * 0.335, 1.5);
    for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2, r1 = S * 0.447, r2 = S * (i % 6 === 0 ? 0.405 : 0.43); g.lineWidth = i % 6 === 0 ? 3 : 1.6; g.beginPath(); g.moveTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1); g.lineTo(m + Math.cos(a) * r2, m + Math.sin(a) * r2); g.stroke(); }
    // runes between the rings: small angular marks, a star at every eighth
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.065, r = S * 0.375, x = m + Math.cos(a) * r, y = m + Math.sin(a) * r;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.lineWidth = 2.6;
      if (i % 3 === 0) { // a four-point star
        g.beginPath(); for (let k = 0; k < 8; k++) { const aa = (k / 8) * Math.PI * 2, rr = k % 2 ? 3.5 : 12; const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); g.fill();
      } else { const v = i % 3; g.beginPath(); g.moveTo(-7, -9); g.lineTo(v === 1 ? 6 : -2, -1); g.lineTo(-6, 4); g.lineTo(7, 10); g.stroke(); g.beginPath(); g.moveTo(5, -10); g.lineTo(5, -3); g.stroke(); }
      g.restore();
    }
  }, { blur: 7 });
}

/** The seal's heart: the compass rose of the book's cover — four long points, four short, a ring and a star at its middle. */
function sealRoseTex(): THREE.Texture {
  return canvasTex('seal-rose', 512, 512, (g, S) => {
    const m = S / 2; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineCap = 'round';
    const point = (a: number, L: number, W: number, fill: number) => {
      const px = (d: number, s: number): [number, number] => [m + Math.cos(a) * d - Math.sin(a) * s, m + Math.sin(a) * d + Math.cos(a) * s];
      g.fillStyle = `rgba(255,255,255,${fill})`; g.beginPath(); g.moveTo(...px(0, 0)); g.lineTo(...px(L * 0.28, W)); g.lineTo(...px(L, 0)); g.closePath(); g.fill(); // (one half lit, as on the cover)
      g.lineWidth = 3; g.beginPath(); g.moveTo(...px(0, 0)); g.lineTo(...px(L * 0.28, W)); g.lineTo(...px(L, 0)); g.lineTo(...px(L * 0.28, -W)); g.closePath(); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(...px(S * 0.03, 0)); g.lineTo(...px(L, 0)); g.stroke();
    };
    for (let i = 0; i < 4; i++) point((i * Math.PI) / 2 - Math.PI / 2, S * 0.3, S * 0.055, 0.5);
    for (let i = 0; i < 4; i++) point((i * Math.PI) / 2 - Math.PI / 4, S * 0.17, S * 0.04, 0.3);
    g.lineWidth = 3.5; g.beginPath(); g.arc(m, m, S * 0.205, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(m, m, S * 0.19, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.arc(m, m, S * 0.06, 0, Math.PI * 2); g.stroke();
  }, { blur: 6 });
}

/** Hoarfrost: ferns of ice branching out from the middle (each branch feathered with short strokes), frost dust between. */
function frostTex(seed: number): THREE.Texture {
  return canvasTex(`frost${seed}`, 512, 512, (g, S) => {
    let s = seed * 9973 + 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const m = S / 2; g.strokeStyle = '#fff'; g.lineCap = 'round';
    const fern = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      let px = x, py = y; const steps = Math.max(4, Math.round(len / 10));
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 0.35;
        const nx = px + (Math.cos(a) * len) / steps, ny = py + (Math.sin(a) * len) / steps, ww = w * (1 - i / steps) + 0.5;
        g.lineWidth = ww; g.globalAlpha = 0.95; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        if (depth < 2) { // feathers: short strokes out to both sides, swept forward
          const fl = (len / steps) * (1.6 - i / steps) * (depth ? 0.7 : 1.1);
          g.lineWidth = Math.max(0.6, ww * 0.45); g.globalAlpha = 0.7;
          for (const sd of [-1, 1]) { const fa = a + sd * (0.9 + r() * 0.3); g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(fa) * fl, ny + Math.sin(fa) * fl); g.stroke(); }
        }
        if (depth < 2 && r() < 0.16) fern(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.4), len * (0.3 + r() * 0.25), ww * 0.7, depth + 1);
        px = nx; py = ny;
      }
    };
    const n = 9 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) fern(m, m, (i / n) * Math.PI * 2 + r() * 0.5, S * (0.3 + r() * 0.17), 4.5, 0);
    g.globalAlpha = 1; // frost dust: fine specks thicker toward the middle
    for (let i = 0; i < 900; i++) { const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * S * 0.47; g.fillStyle = `rgba(255,255,255,${(0.15 + r() * 0.5) * (1 - d / (S * 0.5))})`; g.fillRect(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.5, 1.5); }
    const mid = g.createRadialGradient(m, m, 0, m, m, S * 0.22); mid.addColorStop(0, 'rgba(255,255,255,0.55)'); mid.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = mid; g.fillRect(0, 0, S, S);
  }, { blur: 3 });
}

/** A billowing cloud: soft lumps of fractal noise inside a round fall-off (white: its density). */
function cloudTex(seed: number): THREE.Texture {
  return canvasTex(`cloud${seed}`, 256, 256, (g, S) => {
    let s = seed * 7919 + 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const m = S / 2;
    for (let i = 0; i < 70; i++) { // lumps: soft discs, bigger near the middle, denser at the bottom (a cloud's flat base)
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * S * 0.33, x = m + Math.cos(a) * d, y = m + Math.sin(a) * d * 0.62 - S * 0.04, R = S * (0.08 + r() * 0.13) * (1 - d / (S * 0.6));
      const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(255,255,255,${0.32 + r() * 0.25})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    }
  });
}

/** A hexagon net (wraps a sphere: 2 : 1), its lines white. */
function hexTex(): THREE.Texture {
  return canvasTex('hexnet', 512, 256, (g, W, H) => {
    g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.lineJoin = 'round';
    const R = 16, dx = R * Math.sqrt(3), dy = R * 1.5;
    for (let row = -1; row * dy < H + R; row++) for (let col = -1; col * dx < W + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3, x = cx + Math.cos(a) * (R - 1.5), y = cy + Math.sin(a) * (R - 1.5); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); g.stroke();
    }
  }, { blur: 2, repeat: true });
}

/** One link after another along a chain (repeats along u): an oval ring seen flat, the next seen edge-on. */
function chainTex(): THREE.Texture {
  return canvasTex('chainlinks', 128, 32, (g) => {
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(32, 16, 26, 10, 0, 0, Math.PI * 2); g.stroke(); // a link seen flat
    g.lineWidth = 6; g.beginPath(); g.moveTo(66, 16); g.lineTo(122, 16); g.stroke(); // the next seen edge-on
  }, { blur: 3, repeat: true });
}

/** A thorned vine (repeats along u): a twisting stem, thorns off both sides, a small leaf now and then. */
function thornTex(): THREE.Texture {
  return canvasTex('thornvine', 128, 32, (g) => {
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= 128; x += 4) { const y = 16 + Math.sin((x / 128) * Math.PI * 4) * 4; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    g.lineWidth = 2; for (const [x, up] of [[14, 1], [42, -1], [74, 1], [104, -1]] as const) { const y = 16 + Math.sin((x / 128) * Math.PI * 4) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - up * 11); g.stroke(); }
    g.beginPath(); g.ellipse(60, 7, 8, 3.5, -0.5, 0, Math.PI * 2); g.fill();
  }, { blur: 2, repeat: true });
}

/** A spiral well (white arms winding into the middle, fading as they go in): a portal's swirl. */
function wellTex(): THREE.Texture {
  return canvasTex('well', 512, 512, (g, S) => {
    const m = S / 2; g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (let j = 0; j < 7; j++) for (let q = 0; q < 80; q++) {
      const u = q / 80, r2 = S * (0.05 + 0.42 * u), a = (j / 7) * Math.PI * 2 + u * Math.PI * 2.1, u2 = (q + 1) / 80, r3 = S * (0.05 + 0.42 * u2), a2 = (j / 7) * Math.PI * 2 + u2 * Math.PI * 2.1;
      g.globalAlpha = Math.pow(u, 1.3); g.lineWidth = 2 + 7 * u; g.beginPath(); g.moveTo(m + Math.cos(a) * r2, m + Math.sin(a) * r2); g.lineTo(m + Math.cos(a2) * r3, m + Math.sin(a2) * r3); g.stroke();
    }
  }, { blur: 5 });
}

// ------------------------------------------------------------------ the shaders of these pieces

const VS = `
#include <common>
#include <clipping_planes_pars_vertex>
uniform float uT; uniform float uSway;
varying vec2 vUv; varying float vF;
void main() {
  vUv = uv;
  vec3 p = position;
#ifdef SWAY
  float v = uv.y; p.x += sin(uT * 1.3 + v * 3.1) * uSway * v; p.z += cos(uT * 1.05 + v * 2.4) * uSway * v * 0.7;
#endif
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); // (named so: three's clipping chunk reads mvPosition)
  vec3 n = normalize(normalMatrix * normal);
  vF = 1.0 - abs(dot(n, normalize(-mvPosition.xyz)));
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform vec3 uColor2; uniform float uA; uniform float uI; uniform float uT; uniform float uK; uniform float uRps;
uniform sampler2D uNoise; uniform sampler2D uMap; uniform vec2 uRep; uniform vec3 uHit; uniform float uHitA;
varying vec2 vUv; varying float vF;
void main() {
  #include <clipping_planes_fragment>
  vec3 col; float a;
#if PART == 1
  // FUNNEL: a tornado's skin — streaks of wind winding up round it, its silhouette brighter, its foot and top fading
  float u = vUv.x, v = vUv.y;
  float n1 = texture2D(uNoise, vec2(u * 3.0 + v * 1.6 - uT * uRps, v * 0.9 - uT * 0.55)).r;
  float n2 = texture2D(uNoise, vec2(u * 7.0 + v * 3.2 - uT * uRps * 1.6 + 0.4, v * 1.7 - uT * 1.1)).r;
  float streak = smoothstep(0.5, 0.95, n1 * n2 * 2.2);
  float fade = smoothstep(0.0, 0.1, v) * (1.0 - smoothstep(0.55, 1.0, v));
  a = uA * fade * (0.02 + uK + 0.18 * pow(vF, 2.0) + 1.0 * streak * (0.3 + 0.7 * vF));
  col = mix(uColor, uColor2, smoothstep(0.2, 0.9, v)) * (0.8 + 0.6 * streak);
  col = mix(col, vec3(1.0), streak * 0.35) * uI;
#elif PART == 2
  // SHELL: a sphere of hexagons — its rim burning, its net faint inside, bright where a blow lands (uHit: the point, uHitA)
  vec4 t = texture2D(uMap, vUv * uRep);
  float rim = pow(vF, 2.4);
  float wave = 0.5 + 0.5 * sin(vUv.y * 22.0 - uT * 3.0);
  a = uA * (rim * 0.38 + t.a * (0.18 + 0.5 * rim) * (0.7 + 0.3 * wave));
  col = mix(uColor, vec3(1.0), rim * 0.3 + t.a * 0.25) * uI;
#elif PART == 3
  // RIBBON: a picture repeated along a path (chain links, thorns): u along in its own units
  vec4 t = texture2D(uMap, vec2(vUv.x * uRep.x - uT * uRps, vUv.y));
  float edge = 1.0 - smoothstep(0.6, 1.0, abs(vUv.y - 0.5) * 2.0);
  a = uA * t.a * edge;
  col = mix(uColor, vec3(1.0), t.r * t.a * 0.45) * uI;
#elif PART == 5
  // CREST: a wave running along the floor — its foot bright, its top torn by the wind (uK: how white its light is)
  float n = texture2D(uNoise, vec2(vUv.x * 3.0 + uT * 0.6, vUv.y * 1.4 - uT * 3.2)).r;
  float top = 1.0 - smoothstep(0.2 + 0.55 * n, 1.0, vUv.y);
  float sides = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
  float foot = 1.0 - smoothstep(0.0, 0.22, vUv.y);
  a = uA * sides * (top * (0.3 + 0.7 * n) + foot * 0.9);
  col = mix(uColor, vec3(1.0), (foot * 0.6 + n * 0.2) * uK) * uI;
#else
  // MAP: a picture on a plane (a star, a seal, frost, a cloud, a well): its colour, its strokes' cores whiter
  vec4 t = texture2D(uMap, vUv);
  a = uA * t.a;
  col = mix(uColor, vec3(1.0), t.r * t.a * uK) * uI;
#endif
  if (!(a >= 0.003)) discard; // (NaN too: one NaN pixel spread by the bloom blacks the frame)
  gl_FragColor = vec4(max(col, vec3(0.0)), min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const PART = { funnel: 1, shell: 2, ribbon: 3, map: 4, crest: 5 } as const;

function mat(f: Fx3D, part: keyof typeof PART, color: number, o: { i?: number; a?: number; map?: THREE.Texture; k?: number; color2?: number; clip?: THREE.Plane[]; normal?: boolean; sway?: boolean; rep?: [number, number] } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, defines: { PART: PART[part], ...(o.sway ? { SWAY: 1 } : {}) },
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(o.color2 ?? color) }, uA: { value: o.a ?? 1 }, uI: { value: o.i ?? 1.3 },
      uT: { value: Math.random() * 10 }, uK: { value: o.k ?? 0.4 }, uRps: { value: 0.6 }, uSway: { value: 0 }, uNoise: { value: f.noiseTex }, uMap: { value: o.map ?? f.softDisc },
      uRep: { value: new THREE.Vector2(...(o.rep ?? [1, 1])) }, uHit: { value: new THREE.Vector3() }, uHitA: { value: 0 },
    },
    transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide,
    clipping: !!o.clip, fog: false,
  });
  if (o.clip) m.clippingPlanes = o.clip;
  return m;
}
const U = (ms: THREE.Mesh[], k: string, v: number | THREE.Vector3): void => { for (const m of ms) { const u = (m.material as THREE.ShaderMaterial).uniforms[k]; if (v instanceof THREE.Vector3) (u.value as THREE.Vector3).copy(v); else u.value = v; } };
/** Two meshes of one geometry: the part behind depth hz in the room, the part in front over the fighters. */
function split(f: Fx3D, geo: THREE.BufferGeometry, mk: (clip: THREE.Plane[]) => THREE.ShaderMaterial, hz: number, frontScene: 'glow' | 'solid' = 'glow'): THREE.Mesh[] {
  const back = new THREE.Mesh(geo, mk(f.cut(hz, false))), front = new THREE.Mesh(geo, mk(f.cut(hz, true)));
  back.frustumCulled = front.frustumCulled = false;
  f.host.back.add(back); f.host[frontScene].add(front);
  return [back, front];
}
const free = (ms: THREE.Mesh[], geo?: THREE.BufferGeometry): void => { for (const m of ms) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } geo?.dispose(); };
const sq = new THREE.PlaneGeometry(1, 1);
/** A colour deepened for the painted body under a light's glow: its lightness down by k (0..1), its saturation up — a pale
 *  ice blue becomes a vivid one, never a grey. */
const hsl = { h: 0, s: 0, l: 0 }, tmpC = new THREE.Color();
const deep = (c: number, k = 0.3): number => { tmpC.setHex(c).getHSL(hsl); tmpC.setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.12), Math.max(0.04, hsl.l * (1 - k))); return tmpC.getHex(); };
/** A picture drawn twice (on the bright planks a light added alone turns white): its body painted in its colour (normal
 *  blending: it keeps its hue) and its glow added over it, whiter at its cores. `set(a)` sets both; `meshes` for moving. */
function pair(f: Fx3D, geo: THREE.BufferGeometry, color: number, map: THREE.Texture, o: { body?: number; glow?: number; k?: number; scene?: 'glow' | 'back' } = {}): { meshes: THREE.Mesh[]; set(a: number): void } {
  const body = new THREE.Mesh(geo, mat(f, 'map', deep(color, 0.28), { map, normal: true, i: 1, k: 0.12 })), glow = new THREE.Mesh(geo, mat(f, 'map', color, { map, i: o.glow ?? 1.05, k: o.k ?? 0.55 }));
  body.renderOrder = 1; glow.renderOrder = 2; body.frustumCulled = glow.frustumCulled = false;
  // (in front of the fighters the body goes in the solid layer — drawn over them as it is — and the glow in the glow layer,
  //  which is added over the picture: a body painted there would only be added too)
  if (o.scene === 'back') { f.host.back.add(body); f.host.back.add(glow); } else { f.host.solid.add(body); f.host.glow.add(glow); }
  const B = o.body ?? 0.85;
  return { meshes: [body, glow], set: (a) => { U([body], 'uA', a * B); U([glow], 'uA', a * 0.75); } };
}

// ------------------------------------------------------------------ the pieces

/** A four-point star flare at `at` (world px; a function follows), turned to the eye: it pops open (outBack), turns a
 *  little and fades. `size` its span (px). In front of the fighters unless `back`. */
export function star(f: Fx3D, at: At, color: number, o: { size?: number; ms?: number; spin?: number; back?: boolean; a?: number; delay?: number; light?: number; i?: number } = {}): void {
  f.later(o.delay ?? 0, () => {
    const get = getter(at), c0 = get(); if (!c0) return;
    const ms = o.ms ?? 320, S = f.host.w3(o.size ?? 120), P2 = pair(f, sq, color, starTex(), { glow: o.i ?? 1.15, k: 0.8, scene: o.back ? 'back' : 'glow' }), ms2 = P2.meshes;
    const spin0 = Math.random() * 0.4 - 0.2;
    if (o.light !== 0) { const P = f.unit(c0); f.host.flare(P.x, P.y, P.z + 0.2, color, 10 * (o.light ?? 1) * (o.size ?? 120) / 120, 5, Math.min(ms, 400)); }
    let t = 0, last = c0;
    f.spawn({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms), c = get() ?? last; last = c;
        const P = f.unit(c), s = S * (k < 0.25 ? outBack(k / 0.25) : 1 - 0.35 * (k - 0.25) / 0.75);
        for (const m of ms2) { m.position.copy(P); m.quaternion.copy(f.host.camera.quaternion); m.rotateZ(spin0 + (o.spin ?? 0.6) * k); m.scale.set(s, s, 1); }
        P2.set((o.a ?? 1) * (k < 0.25 ? 1 : Math.max(0, 1 - (k - 0.25) / 0.75)));
        if (t >= ms) { free(ms2); return false; }
        return true;
      }, dispose: () => free(ms2),
    });
  });
}

/** The Book Mage's seal — the compass star of his book in a ring of runes — lying on the floor at (x, y) (`r` px), or
 *  upright before him (`up`: its centre's height, px; turned to the eye). It opens (outBack), the ring and the star turn
 *  against each other and it pulses; it closes (shrinks, fades) by `ms`. `color` the ring, `star` the rose (gold). */
export function seal(f: Fx3D, x: number, y: number, color: number, o: { r?: number; ms?: number; up?: number; star?: number; spin?: number; follow?: () => V3 | null; a?: number; delay?: number; pulse?: number } = {}): void {
  f.later(o.delay ?? 0, () => {
    const ms = o.ms ?? 900, R = f.host.w3(o.r ?? 120), upright = o.up !== undefined, A = o.a ?? 1;
    f.note('glyph', { x, y, z: o.up ?? 0 }, (o.r ?? 120) > 200 ? 2 : (o.r ?? 120) > 110 ? 1 : 0, { color });
    const geo = upright ? sq : f.floorQuad, sc = upright ? 'glow' : 'back';
    const RP = pair(f, geo, color, sealRingTex(), { glow: 1.0, k: 0.5, scene: sc }), SP = pair(f, geo, o.star ?? 0xffd27a, sealRoseTex(), { glow: 1.0, k: 0.55, scene: sc });
    const glow = new THREE.Mesh(geo, mat(f, 'map', color, { map: f.softDisc, i: 0.9, k: 0.2 })); glow.frustumCulled = false; (upright ? f.host.glow : f.host.back).add(glow);
    const rings = RP.meshes, roses = SP.meshes, all = [...rings, ...roses, glow];
    let px = x, py = y, t = 0, life = ms;
    const r0 = Math.random() * Math.PI * 2, P0 = f.unit({ x, y, z: o.up ?? 0 }), shut = Math.min(220, ms * 0.18);
    f.host.flare(P0.x, P0.y + 0.2, P0.z + 0.2, color, 12 * (o.r ?? 120) / 120, 6, Math.min(ms, 700));
    f.spawn({
      step: (dt) => {
        t += dt;
        if (o.follow) { const fo = o.follow(); if (fo) { px = fo.x; py = fo.y; } else if (life === ms && t < ms - shut) life = t + shut; } // (its thing gone: it closes now)
        const open = outBack(Math.min(1, t / 240)), close = t > life - shut ? 1 - outCubic(clamp01((t - (life - shut)) / shut)) : 1, s = R * 2 * (0.45 + 0.55 * open) * (0.6 + 0.4 * close);
        const pulse = 0.82 + 0.18 * Math.sin((t / 1000) * Math.PI * 2 * (o.pulse ?? 1.6)), a = A * Math.min(1, t / 90) * close * pulse, spin = (t / 1000) * (o.spin ?? 0.5);
        const P = f.unit({ x: px, y: py, z: o.up ?? 0 });
        if (upright) {
          for (const m of all) { m.position.copy(P); m.quaternion.copy(f.host.camera.quaternion); }
          for (const m of rings) { m.rotateZ(r0 + spin); m.scale.set(s, s, 1); } for (const m of roses) { m.rotateZ(-r0 * 0.3 - spin * 1.6); m.scale.set(s * 0.98, s * 0.98, 1); } glow.scale.set(s * 0.9, s * 0.9, 1);
        } else {
          for (const m of rings) { m.position.set(P.x, 0.021, P.z); m.rotation.y = r0 + spin; m.scale.set(s, 1, s); }
          for (const m of roses) { m.position.set(P.x, 0.024, P.z); m.rotation.y = -r0 * 0.3 - spin * 1.6; m.scale.set(s * 0.98, 1, s * 0.98); }
          glow.position.set(P.x, 0.018, P.z); glow.scale.set(s * 0.95, 1, s * 0.95);
        }
        RP.set(a); SP.set(a * (0.85 + 0.15 * Math.sin(t / 90))); U([glow], 'uA', a * 0.22);
        if (t >= life) { free(all); return false; }
        return true;
      }, dispose: () => free(all),
    });
  });
}

/** A tornado on the floor at `at()` (world px; it travels with it, null ends it): a funnel `h` px high, `r0` px wide at
 *  its foot and `r1` at its top, bending as it turns (`sway` px), streaks of wind winding up round it `rps` times a
 *  second; it rises out of the floor, and at its end it is flung wide and fades. `color` its foot, `color2` its top. */
export function funnel(f: Fx3D, at: () => V3 | null, color: number, o: { ms?: number; h?: number; r0?: number; r1?: number; rps?: number; sway?: number; color2?: number; i?: number; a?: number; layers?: number; /** its body painted dark under the light streaks (a storm's funnel) */ dark?: number } = {}): { hold(on: boolean): void; end(): void } {
  const ctl = { held: false, ended: false, hold(on: boolean) { this.held = on; }, end() { this.ended = true; } };
  const c0 = at(); if (!c0) return ctl;
  const ms = o.ms ?? 2000, H = f.host.h3(o.h ?? 420), r0 = f.host.w3(o.r0 ?? 40), r1 = f.host.w3(o.r1 ?? 170), rps = o.rps ?? 1.2;
  f.note('swirl', c0, 1, { color });
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) { const v = i / 20; pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(v, 2.2), v * H)); } // (narrow most of its height, flaring at the top: a tornado, not a vase)
  const geo = new THREE.LatheGeometry(pts, 48);
  // its uv: x round, y up (LatheGeometry: u round, v along the profile)
  const P0 = f.unit(c0);
  const layers = Array.from({ length: o.layers ?? 3 }, (_, j) => {
    const ms2 = split(f, geo, (clip) => { const m = mat(f, 'funnel', color, { color2: o.color2 ?? color, i: (o.i ?? 0.9) * (j ? 0.8 : 1), clip, sway: true, k: 0 }); m.uniforms.uRps.value = rps * (1 + j * 0.35); return m; }, P0.z);
    for (const m of ms2) m.renderOrder = 2;
    return { ms: ms2, s: 1 - j * 0.16, rot: Math.random() * Math.PI * 2, sp: (1 + j * 0.4) * rps };
  });
  if (o.dark !== undefined) { // the dark body: painted (normal blending) just inside the light layers, turning slower
    const ms2 = split(f, geo, (clip) => { const m = mat(f, 'funnel', o.dark!, { color2: deep(o.dark!, 0.4), i: 1, clip, sway: true, normal: true, k: 0.32 }); m.uniforms.uRps.value = rps * 0.7; return m; }, P0.z, 'solid');
    for (const m of ms2) m.renderOrder = 1;
    layers.unshift({ ms: ms2, s: 0.94, rot: Math.random() * Math.PI * 2, sp: 0.7 * rps });
  }
  let t = 0, run = 0, end = -1, center = f.unit(c0);
  f.spawn({
    step: (dt) => {
      t += dt; if (!ctl.held) run += dt; // (held: time stands still in it — no turn, no sway)
      const c = end < 0 ? at() : null;
      if (c) center = f.unit(c); else if (end < 0) end = t;
      if (end < 0 && (t >= ms || ctl.ended)) end = t;
      const gone = end < 0 ? 0 : clamp01((t - end) / 420), rise = outCubic(Math.min(1, t / 380));
      if (gone >= 1) { for (const L of layers) free(L.ms); geo.dispose(); return false; }
      for (const L of layers) {
        for (const m of L.ms) {
          m.position.set(center.x, 0.01, center.z); m.rotation.y = L.rot + (run / 1000) * L.sp * Math.PI * 2;
          const w = L.s * (1 + gone * 0.8); m.scale.set(w, rise * (1 - gone * 0.3), w);
          const u = (m.material as THREE.ShaderMaterial).uniforms; u.uT.value = run / 1000; u.uSway.value = f.host.w3(o.sway ?? 30); u.uA.value = (o.a ?? 0.9) * Math.min(1, t / 200) * (1 - gone) * (ctl.held ? 1.15 : 1);
        }
        // the cut plane through its centre moves with it
        const v = f.viewXZ(); (L.ms[0].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v, center); (L.ms[1].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v.clone().negate(), center);
      }
      return true;
    }, dispose: () => { for (const L of layers) free(L.ms); geo.dispose(); },
  });
  return ctl;
}

/** Lightning frozen in the air (time stopped): a jagged line from a to b that stands still, glowing, for `ms` — then it
 *  shatters into motes. */
export function stillBolt(f: Fx3D, a: V3, b: V3, color: number, o: { ms?: number; w?: number } = {}): void {
  const n = 14, pts: V3[] = [];
  for (let i = 0; i <= n; i++) { const k = i / n, amp = Math.sin(Math.PI * k) * Math.hypot(b.x - a.x, b.z - a.z) * 0.08; pts.push({ x: a.x + (b.x - a.x) * k + rnd(-amp, amp), y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k + rnd(-amp, amp) * 0.6 }); }
  const at = (k: number): V3 => { const q = k * n, i = Math.min(n - 1, Math.floor(q)), u = q - i, A = pts[i], B = pts[i + 1]; return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z + (B.z - A.z) * u }; };
  ribbon(f, at, color, { w: o.w ?? 9, ms: o.ms ?? 1000, draw: 40, n: 28, i: 2.4, keep: true });
  f.later((o.ms ?? 1000) - 80, () => { const P = f.unit(at(0.5)); f.host.embers(P.x, P.y, P.z, color, 6, 1.6); });
}

/** A wave running over the floor from (x, y) toward (dx, dy) for `len` px in `ms`: an arc of a wall `w` px wide and `h`
 *  px high, its body painted in its colour (it keeps its hue over the bright planks), its light over it; it rises as it
 *  sets out and sinks at its end. */
export function surge(f: Fx3D, x: number, y: number, dx: number, dy: number, color: number, o: { len?: number; ms?: number; h?: number; w?: number; delay?: number } = {}): void {
  f.later(o.delay ?? 0, () => {
    const len = o.len ?? 320, ms = o.ms ?? 320, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, W = f.host.w3(o.w ?? 160), Hh = f.host.h3(o.h ?? 110);
    f.note('swirl', { x, y, z: 0 }, 1, { color });
    const geo = new THREE.CylinderGeometry(W, W, Hh, 28, 1, true, -Math.PI * 0.32, Math.PI * 0.64).translate(0, Hh / 2, 0);
    const mk = (normal: boolean) => split(f, geo, (clip) => mat(f, 'crest', normal ? deep(color, 0.3) : color, { i: normal ? 1 : 1.05, k: normal ? 0 : 1, clip, normal }), f.unit({ x, y, z: 0 }).z, normal ? 'solid' : 'glow');
    const body = mk(true), glow = mk(false); for (const m of body) m.renderOrder = 1; for (const m of glow) m.renderOrder = 2;
    const all = [...body, ...glow];
    let t = 0;
    f.spawn({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms), px = x + ux * len * k, py = y + uy * len * k, P = f.unit({ x: px, y: py, z: 0 }), yaw = Math.atan2(ux, uy * 1.15);
        for (const m of all) { m.position.set(P.x - Math.sin(yaw) * W, 0.02, P.z - Math.cos(yaw) * W); m.rotation.set(0, yaw, 0); m.scale.set(1, Math.min(1, k * 4) * (1 - Math.max(0, (k - 0.8) / 0.2) * 0.6), 1); }
        const v = f.viewXZ(); for (const pair of [body, glow]) { (pair[0].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v, P); (pair[1].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v.clone().negate(), P); }
        const a = 1 - Math.max(0, (k - 0.75) / 0.25);
        U(body, 'uA', 0.8 * a); U(glow, 'uA', 0.7 * a); U(all, 'uT', t / 1000);
        if (t >= ms) { free(all, geo); return false; }
        return true;
      }, dispose: () => free(all, geo),
    });
  });
}

/** Hoarfrost racing out over the planks from (x, y) to `r` px in `grow` ms, a bright rim at its edge as it spreads; it lies
 *  `hold` ms and melts away over `melt` ms. */
export function frost(f: Fx3D, x: number, y: number, o: { r?: number; grow?: number; hold?: number; melt?: number; color?: number; a?: number } = {}): void {
  const R = f.host.w3(o.r ?? 200), grow = o.grow ?? 260, hold = o.hold ?? 900, melt = o.melt ?? 700, color = o.color ?? 0x9fe4ff, A = o.a ?? 0.85;
  const seed = 1 + Math.floor(Math.random() * 3), map = frostTex(seed), rot = Math.random() * Math.PI * 2;
  const FP = pair(f, f.floorQuad, color, map, { glow: 1.0, k: 0.6, scene: 'back', body: 0.75 }), fm = FP.meshes, rim = new THREE.Mesh(f.floorQuad, mat(f, 'map', 0xe8fbff, { map: f.softDisc, i: 1.0, k: 0.4 }));
  const P = f.unit({ x, y, z: 0 }); for (const m of fm) { m.position.set(P.x, 0.017, P.z); m.rotation.y = rot; } rim.position.set(P.x, 0.016, P.z); rim.frustumCulled = false;
  f.host.back.add(rim);
  f.host.flare(P.x, 0.3, P.z + 0.2, color, 14, 6, 500);
  let t = 0; const life = grow + hold + melt;
  f.spawn({
    step: (dt) => {
      t += dt; const g = outCubic(clamp01(t / grow)), s = R * 2 * (0.15 + 0.85 * g);
      for (const m of fm) m.scale.set(s, 1, s * 0.98); rim.scale.set(s * 1.05, 1, s * 1.05);
      const melting = t > grow + hold ? clamp01((t - grow - hold) / melt) : 0;
      FP.set(A * (1 - inQuad(melting)) * (0.9 + 0.1 * Math.sin(t / 140)));
      U([rim], 'uA', 0.45 * Math.max(0, 1 - t / (grow * 1.4)));
      if (t >= life) { free([...fm, rim]); return false; }
      return true;
    }, dispose: () => free([...fm, rim]),
  });
}

/** A storm cloud hanging `h` px over (x, y), `r` px wide: dark lumps turning slowly, lit from inside on `flash()`; it
 *  gathers in, hangs `ms`, and drifts apart. Returns its flash (power 0..1). */
export function cloud(f: Fx3D, x: number, y: number, o: { r?: number; h?: number; ms?: number; color?: number; dark?: number; n?: number } = {}): (power?: number) => void {
  const R = f.host.w3(o.r ?? 260), Hh = f.host.h3(o.h ?? 560), ms = o.ms ?? 2400, n = o.n ?? 9, color = o.color ?? 0xb9a2ff, dark = o.dark ?? 0x1e1a2e;
  const P = f.unit({ x, y, z: 0 });
  const lumps = Array.from({ length: n }, (_, i) => {
    const map = cloudTex(1 + (i % 4)), a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = i === 0 ? 0 : R * (0.35 + Math.random() * 0.6);
    const shade = new THREE.Mesh(sq, mat(f, 'map', dark, { map, i: 1, k: 0, normal: true }));
    const lit = new THREE.Mesh(sq, mat(f, 'map', color, { map, i: 1.6, k: 0.3 }));
    shade.frustumCulled = lit.frustumCulled = false; f.host.back.add(shade, lit);
    return { shade, lit, a, d, s: R * (i === 0 ? 1.5 : 0.9 + Math.random() * 0.6), y: Hh + (Math.random() - 0.3) * Hh * 0.12, sp: 0.06 + Math.random() * 0.08 };
  });
  let t = 0, flash = 0;
  f.spawn({
    step: (dt) => {
      t += dt; const k = clamp01(t / ms), gather = outCubic(Math.min(1, t / 500)), part = k > 0.8 ? (k - 0.8) / 0.2 : 0;
      flash = Math.max(0, flash - dt / 260);
      for (const L of lumps) {
        const a = L.a + (t / 1000) * L.sp * Math.PI * 2, d = L.d * (0.5 + 0.5 * gather) * (1 + part * 0.8);
        const X = P.x + Math.cos(a) * d, Z = P.z + Math.sin(a) * d * 0.55;
        for (const m of [L.shade, L.lit]) { m.position.set(X, L.y + part * 0.3, Z); m.quaternion.copy(f.host.camera.quaternion); m.scale.set(L.s * (0.7 + 0.3 * gather), L.s * 0.62 * (0.7 + 0.3 * gather), 1); }
        U([L.shade], 'uA', 0.82 * gather * (1 - part)); U([L.lit], 'uA', (0.12 + 0.9 * flash) * gather * (1 - part));
      }
      if (t >= ms) { for (const L of lumps) free([L.shade, L.lit]); return false; }
      return true;
    }, dispose: () => { for (const L of lumps) free([L.shade, L.lit]); },
  });
  return (power = 1) => { flash = Math.min(1.2, flash + power); f.host.flare(P.x, Hh, P.z + 0.3, color, 20 * power, 10, 260); };
}

/** A sphere of hexagons round a fighter (`id`), `r` px, centred `y0` px up, for `ms` (or until `stop()`); it closes round
 *  him, turns slowly, and `hit(from)` lights it where a blow lands; `stop(true)` shatters it into shards of light. */
export function shell(f: Fx3D, id: string, color: number, o: { r?: number; y0?: number; ms?: number; i?: number } = {}): { hit(from?: V3): void; stop(shatter?: boolean): void } {
  const R = f.host.w3(o.r ?? 85), ms = o.ms ?? 8000;
  const geo = new THREE.SphereGeometry(1, 40, 24), c0 = f.host.casterPos(id) ?? { x: 0, y: 0, z: 0 };
  const hz0 = f.unit(c0).z;
  const body = split(f, geo, (clip) => mat(f, 'shell', deep(color, 0.35), { map: hexTex(), rep: [3, 2], i: 1, clip, normal: true }), hz0, 'solid'); // (its net painted in its colour)
  for (const m of body) m.renderOrder = 1;
  const ms2 = [...body, ...split(f, geo, (clip) => mat(f, 'shell', color, { map: hexTex(), rep: [3, 2], i: o.i ?? 0.9, clip }), hz0)];
  let t = 0, flash = 0, end = -1, shatter = false;
  const done = () => free(ms2, geo);
  f.spawn({
    step: (dt) => {
      t += dt; flash = Math.max(0, flash - dt / 300);
      const c = f.host.casterPos(id); if (!c && end < 0) end = t;
      if (end < 0 && t >= ms) end = t;
      const gone = end < 0 ? 0 : clamp01((t - end) / (shatter ? 160 : 380));
      if (gone >= 1) { done(); return false; }
      const P = f.unit(c ?? c0); P.y += f.host.h3(o.y0 ?? 75);
      const close = outBack(Math.min(1, t / 320)), s = R * close * (1 + gone * (shatter ? 0.5 : 0.1));
      for (const m of ms2) { m.position.copy(P); m.scale.set(s, s * 1.08, s); m.rotation.y = t / 2600; }
      const v = f.viewXZ(); for (let k = 0; k < ms2.length; k += 2) { (ms2[k].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v, P); (ms2[k + 1].material as THREE.Material).clippingPlanes![0].setFromNormalAndCoplanarPoint(v.clone().negate(), P); }
      const a = (0.55 + 0.45 * flash) * Math.min(1, t / 200) * (1 - gone);
      U(ms2.slice(0, 2), 'uA', a * 0.8); U(ms2.slice(2), 'uA', a); U(ms2, 'uT', t / 1000); U(ms2.slice(2), 'uI', (o.i ?? 0.9) * (1 + flash * 0.9));
      return true;
    }, dispose: done,
  });
  return {
    hit: (from) => { flash = 1; const c = f.host.casterPos(id); if (c) star(f, from ? { x: (c.x * 2 + from.x) / 3, y: c.y, z: 75 } : { x: c.x, y: c.y, z: 90 }, color, { size: 90, ms: 220 }); },
    stop: (sh = false) => {
      if (end >= 0) return; shatter = sh; end = t;
      if (sh) { const c = f.host.casterPos(id); if (c) { const P = f.unit(c); f.host.embers(P.x, P.y + 0.75, P.z, color, 22, 3); star(f, { x: c.x, y: c.y, z: 80 }, color, { size: 220, ms: 300 }); } }
    },
  };
}

/** Chains of light from points on the floor (`from`, world px) to a foe (`to()`, his chest; null lets them go): thrown
 *  up in `draw` ms, pulled tight, humming for `ms`, then they snap into motes. */
export function chains(f: Fx3D, from: { x: number; y: number }[], to: () => V3 | null, color: number, o: { ms?: number; draw?: number; w?: number; link?: number } = {}): void {
  const ms = o.ms ?? 1200, draw = o.draw ?? 140, W = f.host.w3(o.w ?? 13), linkU = f.host.w3(o.link ?? 26);
  const n = 16;
  const all = from.map((a) => {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx: number[] = [];
    for (let i = 0; i <= n; i++) { uv.set([i / n, 0, i / n, 1], i * 4); if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat(f, 'ribbon', color, { map: chainTex(), i: 1.1 })); m.frustumCulled = false; f.host.glow.add(m);
    const body = new THREE.Mesh(geo, mat(f, 'ribbon', deep(color, 0.3), { map: chainTex(), i: 1, normal: true })); body.frustumCulled = false; f.host.solid.add(body); // (its links painted in its colour)
    return { a, geo, pos, m, body, sag: rnd(0.15, 0.35) };
  });
  let t = 0, last = to();
  const done = () => { for (const c of all) { free([c.body]); free([c.m], c.geo); } };
  const view = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3(), p = new THREE.Vector3();
  f.spawn({
    step: (dt) => {
      t += dt; const tgt = to() ?? last; last = tgt;
      if (!tgt || t >= ms) {
        if (tgt) for (const c of all) { const P = f.unit({ x: (c.a.x + tgt.x) / 2, y: (c.a.y + tgt.y) / 2, z: tgt.z / 2 }); f.host.embers(P.x, P.y, P.z, color, 4, 1.4); }
        done(); return false;
      }
      const d = outCubic(clamp01(t / draw)), hum = 1 + 0.05 * Math.sin(t / 30);
      for (const c of all) {
        const A = f.unit({ x: c.a.x, y: c.a.y, z: 0 }), B = f.unit(tgt), len = A.distanceTo(B) * d;
        for (let i = 0; i <= n; i++) {
          const k = (i / n) * d; p.copy(A).lerp(B, k); p.y -= Math.sin(Math.PI * (i / n)) * c.sag * len * (1 - Math.min(1, t / (draw * 2.5))) * 0.4; // (thrown slack, pulled tight)
          tan.copy(B).sub(A).normalize(); view.copy(f.host.camera.position).sub(p); side.crossVectors(tan, view).normalize().multiplyScalar(W * 0.5 * hum);
          c.pos.set([p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z], i * 6);
        }
        (c.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        for (const mm of [c.m, c.body]) { const u = (mm.material as THREE.ShaderMaterial).uniforms; u.uRep.value.set(Math.max(1, len / linkU), 1); u.uA.value = Math.min(1, t / 60) * (t > ms - 160 ? (ms - t) / 160 : 1) * (mm === c.body ? 0.9 : 0.8); u.uT.value = t / 1000; }
      }
      return true;
    }, dispose: done,
  });
}

/** A thorned vine of light growing along a path (`path(k)`, world px, k 0..1) in `grow` ms, `w` px thick, its thorns
 *  repeating every `link` px; it holds `ms`, then withers from its root (fades). */
export function vine(f: Fx3D, path: (k: number) => V3, color: number, o: { ms?: number; grow?: number; w?: number; link?: number; i?: number } = {}): void {
  const n = 28, ms = o.ms ?? 1200, grow = o.grow ?? 200, W = f.host.w3(o.w ?? 16), linkU = f.host.w3(o.link ?? 34);
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx: number[] = [];
  for (let i = 0; i <= n; i++) { uv.set([i / n, 0, i / n, 1], i * 4); if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, mat(f, 'ribbon', color, { map: thornTex(), i: o.i ?? 1.1 })); m.frustumCulled = false; f.host.glow.add(m);
  const body = new THREE.Mesh(geo, mat(f, 'ribbon', deep(color, 0.35), { map: thornTex(), i: 1, normal: true })); body.frustumCulled = false; f.host.solid.add(body); // (the vine painted in its green)
  const view = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3();
  let t = 0;
  f.spawn({
    step: (dt) => {
      t += dt; const head = outCubic(clamp01(t / grow)), pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) pts.push(f.unit(path(head * (i / n))));
      let len = 0; for (let i = 1; i <= n; i++) len += pts[i].distanceTo(pts[i - 1]);
      for (let i = 0; i <= n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)]; tan.copy(b).sub(a); if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0);
        view.copy(f.host.camera.position).sub(pts[i]); side.crossVectors(tan, view).normalize().multiplyScalar(W * 0.5);
        pos.set([pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z, pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z], i * 6);
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      for (const mm of [m, body]) { const u = (mm.material as THREE.ShaderMaterial).uniforms; u.uRep.value.set(Math.max(1, len / linkU), 1); u.uA.value = (t > ms - 260 ? Math.max(0, (ms - t) / 260) : Math.min(1, t / 60)) * (mm === body ? 0.95 : 0.7); u.uT.value = 0; }
      if (t >= ms) { free([body]); free([m], geo); return false; }
      return true;
    }, dispose: () => { free([body]); free([m], geo); },
  });
}

/** A portal in the floor at (x, y), `r` px: a dark well (light spiralling down into it) inside a burning rim of runes; it
 *  opens, lives `ms` (or until `alive()` says no), and closes. */
export function hole(f: Fx3D, x: number, y: number, color: number, o: { r?: number; ms?: number; alive?: () => boolean; rim?: number } = {}): void {
  const R = f.host.w3(o.r ?? 60), ms = o.ms ?? 10000, P = f.unit({ x, y, z: 0 });
  const dark = new THREE.Mesh(f.floorQuad, mat(f, 'map', 0x05030c, { map: f.softDisc, i: 1, k: 0, normal: true }));
  const well = new THREE.Mesh(f.floorQuad, mat(f, 'map', color, { map: wellTex(), i: 1.5, k: 0.5 }));
  const rim = new THREE.Mesh(f.floorQuad, mat(f, 'map', o.rim ?? color, { map: sealRingTex(), i: 1.6, k: 0.45 }));
  dark.position.set(P.x, 0.014, P.z); well.position.set(P.x, 0.016, P.z); rim.position.set(P.x, 0.02, P.z);
  for (const m of [dark, well, rim]) { m.frustumCulled = false; f.host.back.add(m); }
  let t = 0, end = -1;
  f.spawn({
    step: (dt) => {
      t += dt; if (end < 0 && (t >= ms || (o.alive && !o.alive()))) end = t;
      const open = outBack(Math.min(1, t / 300)), close = end < 0 ? 1 : 1 - clamp01((t - end) / 300);
      if (close <= 0) { free([dark, well, rim]); return false; }
      const s = R * 2 * open * close;
      dark.scale.set(s * 1.25, 1, s * 1.25); well.scale.set(s * 1.05, 1, s * 1.05); rim.scale.set(s * 1.35, 1, s * 1.35);
      well.rotation.y = -(t / 1000) * 2.4; rim.rotation.y = (t / 1000) * 0.5;
      U([dark], 'uA', 0.75 * close); U([well], 'uA', (0.75 + 0.25 * Math.sin(t / 160)) * close); U([rim], 'uA', 0.9 * close);
      return true;
    }, dispose: () => free([dark, well, rim]),
  });
}

/** A star riding a shot (`p`, at chest height `z` px over it): a four-point star turning as it flies, a soft glow round
 *  it; `stretch` draws it out along its flight (a lance). It bursts into a flare where the shot ends. */
export function rider(f: Fx3D, p: Projectile, color: number, o: { size?: number; z?: number; spin?: number; stretch?: number; glow?: number; burst?: number } = {}): void {
  const S = f.host.w3(o.size ?? 56), CP = pair(f, sq, color, starTex(), { glow: 1.3, k: 0.85 }), cores = CP.meshes, halo = new THREE.Mesh(sq, mat(f, 'map', deep(color, 0.15), { map: f.softDisc, i: 1, k: 0.1, normal: true }));
  halo.frustumCulled = false; halo.renderOrder = 0; f.host.glow.add(halo);
  let t = 0, lastP: THREE.Vector3 | null = null; const dir = new THREE.Vector3(), scr = new THREE.Vector3();
  const done = () => free([...cores, halo]);
  f.spawn({
    step: (dt) => {
      t += dt;
      const P = f.unit({ x: p.x, y: p.y, z: p.z }); P.y += f.host.h3(o.z ?? 62);
      if (p.done) { if (o.burst !== 0) star(f, { x: p.x, y: p.y, z: p.z + (o.z ?? 62) }, color, { size: (o.burst ?? 1) * (o.size ?? 56) * 2.2, ms: 220, light: 0.6 }); done(); return false; }
      if (lastP && P.distanceToSquared(lastP) > 1e-8) dir.copy(P).sub(lastP).normalize(); lastP = P.clone();
      for (const m of [...cores, halo]) { m.position.copy(P); m.quaternion.copy(f.host.camera.quaternion); }
      // drawn out along the flight as the eye sees it: the flight's direction on the screen
      scr.copy(dir).applyQuaternion(f.host.camera.quaternion.clone().invert());
      const ang = Math.atan2(scr.y, scr.x), st = o.stretch ?? 1;
      for (const core of cores) { if (st > 1) { core.rotateZ(ang); core.scale.set(S * st, S * 0.8, 1); } else { core.rotateZ((t / 1000) * (o.spin ?? 6)); core.scale.set(S, S, 1); } }
      halo.scale.set(S * 0.9 * (o.glow ?? 1) * Math.max(1, st * 0.6), S * 0.9 * (o.glow ?? 1), 1); if (st > 1) halo.rotateZ(ang);
      CP.set(1); U([halo], 'uA', 0.32 + 0.08 * Math.sin(t / 40));
      return true;
    }, dispose: done,
  });
}

/** A real arrow (her quiver's: a dark shaft, a gold broad head, white fletching), `len` px, its glow at the head in
 *  `color`: the group lies along +x (the head at +x); `fade(a)` fades it, `dispose()` frees it. */
function arrowModel(f: Fx3D, len: number, color: number, o: { head?: number; glow?: number; shaft?: number; fletch?: number } = {}): { group: THREE.Group; glow: THREE.Mesh; L: number; fade(a: number): void; dispose(): void } {
  const L = f.host.w3(len), group = new THREE.Group();
  const shaftM = new THREE.MeshStandardMaterial({ color: o.shaft ?? 0x3a2a1c, emissive: color, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0.1, transparent: true });
  const headM = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: color, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.85, transparent: true });
  const featherM = new THREE.MeshStandardMaterial({ color: o.fletch ?? 0xf4f1e6, emissive: color, emissiveIntensity: 0.25, roughness: 0.75, side: THREE.DoubleSide, transparent: true });
  const shaftG = new THREE.CylinderGeometry(L * 0.014, L * 0.014, L, 6).rotateZ(Math.PI / 2);
  const headG = new THREE.ConeGeometry(L * 0.05, L * (o.head ?? 0.2), 4).rotateZ(-Math.PI / 2).translate(L * 0.58, 0, 0);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-L * 0.5, 0, 0, -L * 0.26, 0, 0, -L * 0.47, L * 0.085, 0]), 3)); fg.computeVertexNormals();
  const shaft = new THREE.Mesh(shaftG, shaftM), head = new THREE.Mesh(headG, headM);
  const feathers = [0, 1, 2].map((k) => { const m = new THREE.Mesh(fg, featherM); m.rotation.x = (k / 3) * Math.PI * 2; return m; });
  const glowM = mat(f, 'map', color, { map: starTex(), i: 1.4, k: 0.6 }), glow = new THREE.Mesh(sq, glowM);
  group.add(shaft, head, ...feathers); f.host.solid.add(group); f.host.glow.add(glow);
  for (const m of [shaft, head, ...feathers, glow]) m.frustumCulled = false;
  void o.glow;
  return {
    group, glow, L,
    fade: (a) => { shaftM.opacity = headM.opacity = featherM.opacity = a; glowM.uniforms.uA.value = a; },
    dispose: () => { group.parent?.remove(group); glow.parent?.remove(glow); shaftG.dispose(); headG.dispose(); fg.dispose(); shaftM.dispose(); headM.dispose(); featherM.dispose(); glowM.dispose(); },
  };
}

/** A real arrow riding a shot (`p`): a shaft, a gold head and white fletching, flying along the shot's line (it noses
 *  down as it falls), a star of its colour at its head; `len` px. The trail is the recipe's own (`trail`). */
export function arrow(f: Fx3D, p: Projectile, color: number, o: { len?: number; head?: number; glow?: number; z?: number } = {}): void {
  const A = arrowModel(f, o.len ?? 80, color, { head: o.head }), L = A.L;
  let lastP: THREE.Vector3 | null = null; const dir = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  f.spawn({
    step: () => {
      if (p.done) { A.dispose(); return false; }
      const P = f.unit({ x: p.x, y: p.y, z: p.z }); P.y += f.host.h3(o.z ?? 62);
      if (lastP && P.distanceToSquared(lastP) > 1e-8) dir.copy(P).sub(lastP).normalize();
      else if (!lastP) { dir.set(p.dx, 0, p.dy * 1.15).normalize(); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); }
      lastP = P.clone();
      q.setFromUnitVectors(X, dir); A.group.position.copy(P); A.group.quaternion.copy(q);
      A.glow.position.copy(P).addScaledVector(dir, L * 0.62); A.glow.quaternion.copy(f.host.camera.quaternion); const g = L * 0.5 * (o.glow ?? 1); A.glow.scale.set(g, g, 1);
      return true;
    }, dispose: () => A.dispose(),
  });
}

/** An arrow flying from `from` to `to` (world px; z its height) in `ms` — on a straight line, or arcing `arc` px over it —
 *  that drives into the floor there at the angle it flew (its head buried), stands `stick` ms and sinks away; dust and a
 *  ring where it lands. `trail`: a ribbon of its colour behind it. */
export function arrowFall(f: Fx3D, from: V3, to: V3, color: number, o: { ms?: number; stick?: number; len?: number; delay?: number; arc?: number; trail?: number; land?: (at: V3) => void } = {}): void {
  f.later(o.delay ?? 0, () => {
    const ms = o.ms ?? 260, stick = o.stick ?? 900, A = arrowModel(f, o.len ?? 90, color), L = A.L;
    const pos = (k: number): V3 => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k + Math.sin(Math.PI * k) * (o.arc ?? 0) });
    if (o.trail !== 0) ribbon(f, (k) => pos(Math.min(1, k)), color, { w: o.trail ?? 7, ms: ms + 160, draw: ms, n: 20, i: 1.6 });
    const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), dir = new THREE.Vector3();
    let t = 0, landed = false;
    f.spawn({
      step: (dt) => {
        t += dt; const k = Math.min(1, t / ms), P = f.unit(pos(k)), P2 = f.unit(pos(Math.min(1, k + 0.02)));
        if (!landed) { dir.copy(P2).sub(P); if (dir.lengthSq() < 1e-10) dir.set(0, -1, 0); dir.normalize(); q.setFromUnitVectors(X, dir); }
        // (stuck: its head a fifth of its length in the planks)
        A.group.quaternion.copy(q); A.group.position.copy(P).addScaledVector(dir, landed ? -L * 0.32 : 0);
        A.glow.position.copy(A.group.position).addScaledVector(dir, L * 0.62); A.glow.quaternion.copy(f.host.camera.quaternion); const g = L * (landed ? 0.25 : 0.5); A.glow.scale.set(g, g, 1);
        if (!landed && k >= 1) {
          landed = true; const P0 = f.unit(to);
          f.host.dust(P0.x, P0.z, 3, 0.6); f.host.ring(P0.x, P0.z, color, 0.55, 220, 0.6); f.host.flare(P0.x, 0.2, P0.z + 0.2, color, 6, 3, 200);
          o.land?.(to);
        }
        if (landed) { const u = (t - ms) / stick; A.fade(u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1); if (u >= 1) { A.dispose(); return false; } }
        return true;
      }, dispose: () => A.dispose(),
    });
  });
}

/** A leaf (her cloak's): a pointed blade of forest green, a pale midrib and veins, its edge gold (sRGB, alpha). */
function leafTex(): THREE.Texture {
  return canvasTex('leaf', 128, 128, (g, S) => {
    const path = () => { g.beginPath(); g.moveTo(S * 0.08, S * 0.5); g.bezierCurveTo(S * 0.3, S * 0.14, S * 0.7, S * 0.12, S * 0.95, S * 0.5); g.bezierCurveTo(S * 0.7, S * 0.88, S * 0.3, S * 0.86, S * 0.08, S * 0.5); g.closePath(); };
    const gr = g.createLinearGradient(0, S * 0.2, 0, S * 0.8); gr.addColorStop(0, '#6fcf4f'); gr.addColorStop(0.55, '#3f8f34'); gr.addColorStop(1, '#2a6324');
    path(); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(214,255,190,0.85)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(S * 0.1, S * 0.5); g.quadraticCurveTo(S * 0.5, S * 0.47, S * 0.93, S * 0.5); g.stroke();
    g.lineWidth = 1.2; for (let i = 1; i < 6; i++) { const x = S * (0.12 + i * 0.14); g.beginPath(); g.moveTo(x, S * 0.49); g.lineTo(x + S * 0.08, S * 0.33); g.moveTo(x, S * 0.51); g.lineTo(x + S * 0.08, S * 0.67); g.stroke(); }
    path(); g.strokeStyle = '#e8c25a'; g.lineWidth = 3; g.stroke();
  }, { srgb: true });
}

/** A spray of leaves (or torn pages: `tex` a game texture) thrown out of `at` (world px): `n` of them flying outward and
 *  up (`speed`, `up`), tumbling, falling back and fading by `ms`; `dir` pushes them one way (±1 along the field). */
export function spray(f: Fx3D, at: V3, o: { n?: number; speed?: number; up?: number; ms?: number; size?: number; tex?: string; dir?: number; color?: number; spread?: number } = {}): void {
  const n = o.n ?? 14, ms = o.ms ?? 900, tex = (o.tex ? f.host.texture?.(o.tex) : null) ?? leafTex();
  const m = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, emissive: o.color ?? 0x6fcf4f, emissiveIntensity: 0.22, roughness: 0.7, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const back = new THREE.InstancedMesh(sq, m, n), front = new THREE.InstancedMesh(sq, m, n);
  back.frustumCulled = front.frustumCulled = false; back.count = front.count = 0; f.host.back.add(back); f.host.solid.add(front);
  const P0 = f.unit(at), W = f.host.w3(o.size ?? 18), sp = o.speed ?? 1, toCam = f.viewXZ().negate();
  const L = Array.from({ length: n }, () => { const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random() * 0.9) * sp * (o.spread ?? 1); return { p: P0.clone(), v: new THREE.Vector3(Math.cos(a) * s * 1.6 + (o.dir ?? 0) * sp * 1.2, (0.8 + Math.random() * 1.6) * (o.up ?? 1), Math.sin(a) * s * 0.9), ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 4 + Math.random() * 8 }; });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3();
  let t = 0;
  const done = () => { back.parent?.remove(back); front.parent?.remove(front); back.dispose(); front.dispose(); m.dispose(); };
  f.spawn({
    step: (dt) => {
      t += dt; const s = dt / 1000, k = t / ms;
      if (k >= 1) { done(); return false; }
      let nb = 0, nf = 0; const fade = k > 0.65 ? (1 - k) / 0.35 : 1, sz = W * (0.6 + 0.4 * Math.min(1, t / 120)) * fade;
      for (const q of L) {
        q.v.y -= 3.2 * s; q.v.multiplyScalar(1 - 1.6 * s); q.p.addScaledVector(q.v, s); if (q.p.y < 0.02) { q.p.y = 0.02; q.v.y = 0; q.v.multiplyScalar(0.5); }
        Q.setFromAxisAngle(q.ax, (q.spin * t) / 1000); S3.set(sz, sz, 1); M.compose(q.p, Q, S3);
        if ((q.p.x - P0.x) * toCam.x + (q.p.z - P0.z) * toCam.z > 0) front.setMatrixAt(nf++, M); else back.setMatrixAt(nb++, M);
      }
      back.count = nb; front.count = nf; back.instanceMatrix.needsUpdate = true; front.instanceMatrix.needsUpdate = true;
      return true;
    }, dispose: done,
  });
}

/** A paper crane riding a shot (`p`): body and wings folded of a page (the game's texture `tex`, else cream paper), its
 *  wings beating, gold at their edges; `size` px. */
export function crane(f: Fx3D, p: Projectile, o: { size?: number; tex?: string; color?: number; z?: number } = {}): void {
  const S = f.host.w3(o.size ?? 34), color = o.color ?? 0xffd27a;
  const map = o.tex ? f.host.texture?.(o.tex) ?? null : null;
  const m = new THREE.MeshStandardMaterial({ color: 0xf7f1e4, map, emissive: color, emissiveIntensity: 0.18, roughness: 0.8, side: THREE.DoubleSide });
  const tri = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2)); g.computeVertexNormals(); return g; };
  const body = new THREE.Mesh(tri([-S, 0, 0, S * 0.9, 0.05 * S, 0, 0, -S * 0.32, 0]), m); // (the folded body, keel down)
  const neck = new THREE.Mesh(tri([S * 0.5, 0, 0, S * 1.2, S * 0.55, 0, S * 0.6, S * 0.1, 0]), m);
  const tail = new THREE.Mesh(tri([-S * 0.5, 0, 0, -S * 1.15, S * 0.5, 0, -S * 0.6, S * 0.1, 0]), m);
  const wingG = tri([-S * 0.35, 0, 0, S * 0.35, 0, 0, 0, 0, S * 1.1]);
  const wl = new THREE.Mesh(wingG, m), wr = new THREE.Mesh(wingG, m);
  const g = new THREE.Group(); g.add(body, neck, tail, wl, wr); f.host.solid.add(g);
  for (const x of [body, neck, tail, wl, wr]) x.frustumCulled = false;
  let t = Math.random() * 400, lastP: THREE.Vector3 | null = null; const dir = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  const done = () => { g.parent?.remove(g); for (const x of [body, neck, tail]) x.geometry.dispose(); wingG.dispose(); m.dispose(); };
  f.spawn({
    step: (dt) => {
      if (p.done) { const P = f.unit({ x: p.x, y: p.y, z: p.z }); f.host.embers(P.x, P.y + f.host.h3(o.z ?? 66), P.z, color, 6, 1.6); done(); return false; }
      t += dt;
      const P = f.unit({ x: p.x, y: p.y, z: p.z }); P.y += f.host.h3(o.z ?? 66) + Math.sin(t / 90) * 0.04;
      if (lastP && P.distanceToSquared(lastP) > 1e-8) dir.copy(P).sub(lastP).normalize(); lastP = P.clone();
      const flat = dir.clone(); flat.y *= 0.4; flat.normalize();
      q.setFromUnitVectors(X, flat); g.position.copy(P); g.quaternion.copy(q);
      const beat = Math.sin(t / 55) * 0.9; wl.rotation.x = -0.25 - beat; wr.rotation.x = Math.PI + 0.25 + beat;
      return true;
    }, dispose: done,
  });
}

/** A ribbon of light drawn along a path (`path(k)`: the point at 0..1, world px) from its tail to its head in `draw` ms,
 *  `w` px wide, then fading from the tail by `ms`: a gust, a vine, a comet's tail. `twist`: it winds round its line. */
export function ribbon(f: Fx3D, path: (k: number) => V3, color: number, o: { w?: number; ms?: number; draw?: number; n?: number; map?: 'chain' | null; i?: number; front?: boolean; /** it stays whole and fades (no tail drawn in) */ keep?: boolean } = {}): void {
  const n = o.n ?? 32, ms = o.ms ?? 600, draw = o.draw ?? 160, W = f.host.w3(o.w ?? 16);
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx: number[] = [];
  for (let i = 0; i <= n; i++) { uv.set([i / n, 0, i / n, 1], i * 4); if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, f.mat(f.kind('strip'), color, { i: o.i ?? 2 })); m.frustumCulled = false; (o.front === false ? f.host.back : f.host.glow).add(m);
  const view = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3();
  let t = 0;
  f.spawn({
    step: (dt) => {
      t += dt; const head = outCubic(clamp01(t / draw)), tailK = o.keep ? 0 : clamp01((t - draw * 0.6) / (ms - draw * 0.6)), tailAt = head * inQuad(tailK), keepA = o.keep ? (t > ms * 0.75 ? Math.max(0, (ms - t) / (ms * 0.25)) : 1) : 1;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) pts.push(f.unit(path(tailAt + (head - tailAt) * (i / n))));
      for (let i = 0; i <= n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)]; tan.copy(b).sub(a); if (tan.lengthSq() < 1e-10) tan.set(1, 0, 0);
        view.copy(f.host.camera.position).sub(pts[i]); side.crossVectors(tan, view).normalize().multiplyScalar(W * 0.5 * (0.25 + 0.75 * (i / n)));
        pos.set([pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z, pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z], i * 6);
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const u = (m.material as THREE.ShaderMaterial).uniforms; u.uA.value = (1 - tailK * 0.5) * keepA * (o.keep ? 0.85 + 0.15 * Math.sin(t / 37) : 1); u.uTail.value = o.keep ? 0.05 : 0.6;
      if (t >= ms) { free([m], geo); return false; }
      return true;
    }, dispose: () => free([m], geo),
  });
}

/** A wreath of leaves (her mark): `n` leaves turning in a ring `r` px round a point — upright before her bow (`up`: its
 *  height; turned to the eye) or flat on the floor — a soft glow of `color` behind them; it opens, turns `rps` times a
 *  second, and scatters at its end. `at()` may follow (null ends it). */
export function wreath(f: Fx3D, at: () => V3 | null, color: number, o: { r?: number; n?: number; ms?: number; up?: boolean; rps?: number; size?: number; a?: number } = {}): void {
  const c0 = at(); if (!c0) return;
  const n = o.n ?? 12, ms = o.ms ?? 1200, R = f.host.w3(o.r ?? 60), W = f.host.w3(o.size ?? 22), rps = o.rps ?? 0.8, upright = !!o.up;
  const m = new THREE.MeshStandardMaterial({ map: leafTex(), color: 0xffffff, emissive: color, emissiveIntensity: 0.35, roughness: 0.6, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const leaves = new THREE.InstancedMesh(sq, m, n); leaves.frustumCulled = false; (upright ? f.host.solid : f.host.back).add(leaves);
  const glow = new THREE.Mesh(upright ? sq : f.floorQuad, mat(f, 'map', color, { map: f.softDisc, i: 1.2, k: 0.3 })); glow.frustumCulled = false; (upright ? f.host.glow : f.host.back).add(glow);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qc = new THREE.Quaternion(), S3 = new THREE.Vector3(), X = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  let t = 0, end = -1, last = c0;
  const done = () => { leaves.parent?.remove(leaves); leaves.dispose(); m.dispose(); free([glow]); };
  f.spawn({
    step: (dt) => {
      t += dt; const c = end < 0 ? at() : null; if (c) last = c; else if (end < 0) end = t; if (end < 0 && t >= ms) end = t;
      const gone = end < 0 ? 0 : clamp01((t - end) / 300); if (gone >= 1) { done(); return false; }
      const P = f.unit(last), open = outBack(Math.min(1, t / 260)), rr = R * open * (1 + gone * 0.9), spin = (t / 1000) * rps * Math.PI * 2;
      Qc.copy(f.host.camera.quaternion);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + spin;
        if (upright) { X.set(Math.cos(a) * rr, Math.sin(a) * rr, 0).applyQuaternion(Qc).add(P); Q.copy(Qc).multiply(new THREE.Quaternion().setFromAxisAngle(Z, a + Math.PI / 2)); }
        else { X.set(P.x + Math.cos(a) * rr, 0.03, P.z + Math.sin(a) * rr * 0.9); Q.setFromAxisAngle(Y, -a).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); }
        S3.set(W * (1 - gone * 0.5), W * 0.55 * (1 - gone * 0.5), 1); M.compose(X, Q, S3); leaves.setMatrixAt(i, M);
      }
      leaves.instanceMatrix.needsUpdate = true; m.opacity = (o.a ?? 1) * (1 - gone);
      if (upright) { glow.position.copy(P); glow.quaternion.copy(Qc); glow.scale.set(rr * 2.4, rr * 2.4, 1); } else { glow.position.set(P.x, 0.02, P.z); glow.scale.set(rr * 2.4, 1, rr * 2.4); }
      U([glow], 'uA', 0.35 * open * (1 - gone));
      return true;
    }, dispose: done,
  });
}

// ------------------------------------------------------------------ painted art in the room (GPT sheets, PixVerse frames)

const FLIP_VS = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FLIP_FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform sampler2D uMap; uniform vec2 uGrid; uniform float uF0; uniform float uF1; uniform float uMix; uniform float uA;
uniform vec3 uTint; uniform float uKey; uniform vec2 uLoHi; uniform float uGain; uniform float uGlow;
varying vec2 vUv;
vec4 frameAt(float f) { float c = mod(f, uGrid.x), r = floor(f / uGrid.x); return texture2D(uMap, (vec2(c, uGrid.y - 1.0 - r) + clamp(vUv, 0.002, 0.998)) / uGrid); }
void main() {
  #include <clipping_planes_fragment>
  vec4 t = mix(frameAt(uF0), frameAt(uF1), uMix);
  vec3 col; float a;
  if (uKey > 0.5) { // painted on black: its brightness is its cover (so it covers the planks in its colour instead of adding light to them)
    float m = max(t.r, max(t.g, t.b)); a = smoothstep(uLoHi.x, uLoHi.y, m); col = min(t.rgb / max(a, 0.001), vec3(1.0));
  } else { a = t.a; col = t.rgb; }
  col *= uTint * uGain;
#ifdef GLOW
  // its added light: only the hottest of it (on the bright planks added light turns white)
  float m2 = max(col.r, max(col.g, col.b)); col = col * a * smoothstep(0.55, 1.0, m2) * uGlow; a = 1.0;
#endif
  a *= uA;
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(max(col, vec3(0.0)), min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const flipTexs = new Map<string, THREE.Texture | null>();
/** A texture by the game's key (loaded by Phaser) or by url (loaded here once; null until it has arrived). */
function flipTex(f: Fx3D, src: string): THREE.Texture | null {
  const own = f.host.texture?.(src); if (own) return own;
  if (flipTexs.has(src)) return flipTexs.get(src) ?? null;
  if (!/[./]/.test(src)) return null; // (a key not loaded: nothing to draw)
  flipTexs.set(src, null);
  new THREE.TextureLoader().load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; flipTexs.set(src, t); });
  return null;
}
/** Loads a sheet by url ahead of its first use (a skill's first cast shows it at once). */
export function flipPreload(f: Fx3D, src: string): void { flipTex(f, src); }

export type FlipOpts = {
  /** The sheet's frame size in px (else `grid`, else the whole picture is one frame). */
  frame?: [number, number]; grid?: [number, number];
  /** Frames to play (from, to inclusive; default all) at `fps` (default 24); `loop` replays them for `ms`. */
  from?: number; to?: number; fps?: number; loop?: boolean; ms?: number; delay?: number;
  /** Its width in px (its height by the frame's aspect × `aspect`). */
  w: number; aspect?: number;
  /** 'up': upright, turned to the eye (its foot at `at` when `foot`); 'floor': flat on the planks (`spin` deg/s, `rot` deg). */
  mode?: 'up' | 'floor'; foot?: boolean; rot?: number; spin?: number;
  /** ('up') Which height of the picture sits on `at`: 0 its foot (= `foot`), 0.5 its middle (default), 1 its top. */
  anchorY?: number;
  /** 'black' (default): painted on black — its brightness becomes its cover; 'alpha': the picture's own alpha. */
  key?: 'black' | 'alpha'; lo?: number; hi?: number;
  /** Over the fighters (default for 'up') or behind them in the room (default for 'floor'). */
  front?: boolean;
  /** ('up') Behind the fighters whole and over them at this alpha (0..1): a fighter inside it still reads (a pillar round a foe). */
  through?: number;
  tint?: number; gain?: number; a?: number;
  /** A little of its hottest light added over the picture as well (0..1; it blooms). */
  glow?: number;
  /** Scale over its life (s0 → s1), its fade-in / fade-out ms. */
  grow?: [number, number]; fadeIn?: number; fadeOut?: number;
  /** Mirrored (it faces the other way). */
  flipX?: boolean;
};
/** A frame sheet played in the room (DFO, 18 Oct 20:51 — David: "a free hand in GPT and PixVerse"): a GPT sheet or a
 *  PixVerse effect turned into frames (tools/fx/flipbook.py), placed in the room's depth — upright at a point (turned to
 *  the eye) or flat on the floor — at `at` (world px; a function follows a fighter: null ends it). Painted on black, its
 *  brightness becomes its cover, so its colours hold on the bright planks (not added light that turns white). `src`: a
 *  game texture key (loaded by the class's preload) or a url ('assets/…'). Returns `end()` (it fades out now). */
export function flip(f: Fx3D, src: string, at: V3 | (() => V3 | null), o: FlipOpts): { end(): void } {
  let ended = false, endAt = -1;
  const handle = { end: () => { ended = true; } };
  f.later(o.delay ?? 0, () => {
    const get = getter(at), c0 = get(); if (!c0) return;
    const mode = o.mode ?? 'up', front = o.front ?? mode === 'up';
    const mk = (glow: boolean) => new THREE.ShaderMaterial({
      vertexShader: FLIP_VS, fragmentShader: FLIP_FS, defines: glow ? { GLOW: 1 } : {},
      uniforms: { uMap: { value: null }, uGrid: { value: new THREE.Vector2(1, 1) }, uF0: { value: 0 }, uF1: { value: 0 }, uMix: { value: 0 }, uA: { value: 1 },
        uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uKey: { value: (o.key ?? 'black') === 'black' ? 1 : 0 }, uLoHi: { value: new THREE.Vector2(o.lo ?? 0.04, o.hi ?? 0.6) }, uGain: { value: o.gain ?? 1 }, uGlow: { value: o.glow ?? 0 } },
      transparent: true, depthWrite: false, depthTest: mode !== 'up', side: THREE.DoubleSide, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, // (upright art is a picture in the air: the floor does not cut its lower half)
    });
    const ay = o.anchorY ?? (o.foot ? 0 : 0.5), geo = new THREE.PlaneGeometry(1, 1); if (mode === 'up' && ay !== 0.5) geo.translate(0, 0.5 - ay, 0);
    const thru = mode === 'up' && o.through !== undefined; // (behind the fighters whole, and over them see-through: a fighter reads inside it)
    const m = new THREE.Mesh(geo, mk(false)); m.frustumCulled = false; (front || thru ? f.host.solid : f.host.back).add(m);
    const mb = thru ? new THREE.Mesh(geo, mk(false)) : null; if (mb) { mb.frustumCulled = false; f.host.back.add(mb); }
    const g = (o.glow ?? 0) > 0 ? new THREE.Mesh(geo, mk(true)) : null; if (g) { g.frustumCulled = false; (front ? f.host.glow : f.host.back).add(g); }
    const mats = [m.material, ...(g ? [g.material] : []), ...(mb ? [mb.material] : [])] as THREE.ShaderMaterial[];
    const meshes = [m, ...(g ? [g] : []), ...(mb ? [mb] : [])];
    let t = 0, ready = false, n = 1, from = 0, cols = 1, rows = 1, aspect = 1, last: V3 = c0;
    const done = () => { for (const x of meshes) x.parent?.remove(x); geo.dispose(); for (const mm of mats) mm.dispose(); };
    f.spawn({
      step: (dt) => {
        if (!ready) { // (the sheet may still be on its way)
          const tex = flipTex(f, src); if (!tex) { t += dt; if (t > 4000) { done(); return false; } return true; }
          const img = tex.image as { width: number; height: number } | undefined, W = img?.width || 1, H = img?.height || 1;
          if (o.frame) { cols = Math.max(1, Math.round(W / o.frame[0])); rows = Math.max(1, Math.round(H / o.frame[1])); } else if (o.grid) { cols = o.grid[0]; rows = o.grid[1]; }
          from = o.from ?? 0; n = Math.max(1, (o.to ?? cols * rows - 1) - from + 1); aspect = ((H / rows) / (W / cols)) * (o.aspect ?? 1);
          for (const mm of mats) { mm.uniforms.uMap.value = tex; (mm.uniforms.uGrid.value as THREE.Vector2).set(cols, rows); }
          ready = true; t = 0;
        }
        t += dt;
        const fps = o.fps ?? 24, len = o.loop ? (o.ms ?? (n / fps) * 1000) : (n / fps) * 1000, fo = o.fadeOut ?? (o.loop ? 200 : 0);
        const c = get(); if (c) last = c; else ended = true;
        if (endAt < 0 && (ended || t >= len - fo)) endAt = ended ? t : len - fo; // (it fades from here: ended, or its last `fadeOut` ms)
        const out = endAt >= 0 ? clamp01(1 - (t - endAt) / Math.max(1, fo)) : 1;
        if (t >= len || (endAt >= 0 && out <= 0 && fo > 0) || (ended && fo <= 0)) { done(); return false; }
        const pos = (t / 1000) * fps, k0 = o.loop ? pos % n : Math.min(n - 1, pos), i0 = Math.floor(k0), i1 = o.loop ? (i0 + 1) % n : Math.min(n - 1, i0 + 1);
        const fin = clamp01(t / Math.max(1, o.fadeIn ?? 60)), k = clamp01(t / len), s = o.grow ? o.grow[0] + (o.grow[1] - o.grow[0]) * outCubic(k) : 1;
        for (const mm of mats) { const u = mm.uniforms; u.uF0.value = from + i0; u.uF1.value = from + i1; u.uMix.value = k0 - i0; u.uA.value = (o.a ?? 1) * fin * out * (thru && mm === m.material ? o.through ?? 1 : 1); }
        const P = f.unit(last), Wd = f.host.w3(o.w) * s, Hd = Wd * aspect;
        for (const mesh of meshes) {
          if (mode === 'floor') { mesh.position.set(P.x, 0.02 + (front ? 0 : 0.004), P.z); mesh.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad((o.rot ?? 0) + (o.spin ?? 0) * (t / 1000))); mesh.scale.set(Wd * (o.flipX ? -1 : 1), Hd, 1); }
          else { mesh.position.copy(P); mesh.quaternion.copy(f.host.camera.quaternion); if (o.rot) mesh.rotateZ(THREE.MathUtils.degToRad(o.rot)); mesh.scale.set(Wd * (o.flipX ? -1 : 1), Hd, 1); }
        }
        return true;
      }, dispose: done,
    });
  });
  return handle;
}

/** Everything these pieces draw compiled up front (no hitch at a first cast). */
export function warmPieces(f: Fx3D, renderer: THREE.WebGLRenderer): void {
  const tmp: THREE.Mesh[] = [];
  for (const part of Object.keys(PART) as (keyof typeof PART)[]) for (const clip of [undefined, f.cut(0, false), f.cut(0, true)]) for (const normal of [false, true]) {
    const m = new THREE.Mesh(sq, mat(f, part, 0xffffff, { clip, normal, sway: part === 'funnel' })); m.position.set(0, -50, 0); f.host.back.add(m); tmp.push(m);
  }
  try { renderer.compile(f.host.back, f.host.camera); } catch { /* (compiled on first use instead) */ }
  free(tmp);
}
