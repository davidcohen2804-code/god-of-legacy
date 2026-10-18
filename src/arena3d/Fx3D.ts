// PVP 3D: the skills in the room's own 3D (Prometheus) — on top of each skill's painted effect, pieces that live in the
// 3D space: light pillars, glowing cracks torn in the floor with real chunks flying and bouncing, waves of light running
// along the floor, energy domes, ice crystals growing out of the planks, 3D lightning, trails behind what flies, slash arcs
// that wrap round the body (the part behind the fighter behind him, the part in front over him), each lighting the room.
// Driven by the skill runtime's own events (cast, active, each hit fired, each projectile, each confirmed hit): every
// skill has its recipe below (by id), the rest a default by its kind. Presentation only: no rule, timing or hit changes.
import * as THREE from 'three';
import type { CastRun } from '../skills/SkillRuntime';
import type { FinalSkill, HitEvent } from '../skills/SkillTypes';
import type { Projectile } from '../skills/HitGeometry';
import { WARRIOR } from './fx3d/warrior';
import { BOOK_MAGE } from './fx3d/book_mage';
import { ARCHER } from './fx3d/archer';
import { SAMURAI } from './fx3d/samurai';
import { GAMBLER } from './fx3d/gambler';
import { warmPieces, flip as flipPiece, flipPreload, flipReady, type FlipOpts } from './fx3d/pieces';
/** The main hit's painted burst (GPT, 4 x 4 frames on black: a white-hot star flash, a shockwave ring and shards, embers, wisps): every class's main hit, tinted to its blow. */
const IMPACT_SHEET = 'assets/final/fx3d/impact_burst.webp';

export type V3 = { x: number; y: number; z: number };

/** What the room lends the effects (Arena3D): its scenes, camera, units and its answers to a blow. */
export interface FxHost {
  /** Behind the fighters (drawn with the room: bloomed, lit). */
  back: THREE.Scene;
  /** In front of the fighters, solid (the railing's layer): chunks, crystals. */
  solid: THREE.Scene;
  /** In front of the fighters, glowing (added over the picture). */
  glow: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  w3(x: number): number; d3(y: number): number; h3(z: number): number;
  /** A flare of light at a point (units): colour, power, reach (units), ms. */
  flare(hx: number, hy: number, hz: number, color: number, power: number, dist: number, ms: number): void;
  dust(hx: number, hz: number, n: number, k: number): void;
  embers(hx: number, hy: number, hz: number, color: number, n: number, speed: number): void;
  ring(hx: number, hz: number, color: number, r1: number, ms: number, a: number): void;
  blow(hx: number, hy: number, hz: number, R: number, s: number): void;
  kick(a: number): void;
  casterPos(id: string): V3 | null;
  /** The blow felt on the whole picture (bent air, colour split; 2: and a zoom blur). */
  impact(at: V3, big: 0 | 1 | 2): void;
  /** One of the game's loaded pictures (its texture key) as a 3D texture (cached); null when it is not loaded. */
  texture?(key: string): THREE.Texture | null;
}

// ------------------------------------------------------------------ colours

const CLS: Record<string, number> = { warrior: 0xffb04a, book_mage: 0x6fc8ff, archer: 0x9be35a, samurai: 0xff4a5a, gambler: 0xff2bd6 };
const C = {
  gold: 0xffc65a, crimson: 0xff3a3a, steel: 0xe8f0ff, ember: 0xff8a2a,
  frost: 0x9fe4ff, ice: 0xbff0ff, storm: 0xb9a2ff, arcane: 0x9a7bff, paper: 0xf4ecff,
  leaf: 0x9be35a, spirit: 0x7dffb0, fire: 0xff7a2a,
  sakura: 0xff9ec8, rose: 0xff6aa8, ink: 0x7a5cff, sun: 0xffd27a,
  fuchsia: 0xff2bd6, coin: 0xffd84a, dice: 0xff4a8a,
};

// ------------------------------------------------------------------ shaders

const VS = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv; varying float vF;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vF = 1.0 - abs(dot(n, normalize(-mvPosition.xyz)));
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform float uA; uniform float uI; uniform float uT; uniform float uSweep; uniform float uTail;
uniform sampler2D uNoise; uniform sampler2D uMap;
varying vec2 vUv; varying float vF;
void main() {
  #include <clipping_planes_fragment>
  vec3 col; float a;
#if KIND == 1
  // PILLAR: a column of light — bright at its foot and silhouette, streaks racing up, fading to the top
  float v = vUv.y;
  float n = texture2D(uNoise, vec2(vUv.x * 4.0, v * 1.1 - uT * 1.7)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x * 9.0 + 0.37, v * 2.3 - uT * 3.3)).r;
  float fade = smoothstep(0.0, 0.05, v) * (1.0 - smoothstep(0.22, 1.0, v));
  float edge = pow(vF, 2.0);
  float streak = smoothstep(0.3, 0.85, n * n2 * 1.9);
  a = uA * fade * (0.05 + 0.5 * edge + 0.4 * streak * (0.25 + edge));
  col = mix(uColor, vec3(1.0), 0.12 + 0.5 * streak) * uI;
#elif KIND == 2
  // DOME: a shell of energy — its rim burns, a faint inside with bands running round it
  float edge = pow(vF, 3.2);
  float n = texture2D(uNoise, vUv * vec2(7.0, 3.0) + vec2(uT * 0.15, -uT * 0.4)).r;
  float bands = 0.5 + 0.5 * sin(vUv.y * 46.0 - uT * 7.0);
  a = uA * (edge * 0.6 + 0.012 + 0.08 * n * bands * edge) * smoothstep(0.0, 0.12, vUv.y);
  col = mix(uColor, vec3(1.0), edge * 0.4) * uI;
#elif KIND == 3
  // SLASH: an arc of a cut — its head sweeps along, a hot white edge on the outside, the inside thin and torn
  float u = vUv.x, w = vUv.y;
  if (u > uSweep) discard;
  float along = smoothstep(uSweep - uTail, uSweep, u);
  float body = smoothstep(0.0, 0.9, w) * (1.0 - smoothstep(0.93, 1.0, w));
  float core = smoothstep(0.62, 0.94, w) * (1.0 - smoothstep(0.95, 1.0, w));
  float n = texture2D(uNoise, vec2(u * 3.0 - uT * 2.5, w * 0.6)).r;
  a = uA * along * (body * (0.35 + 0.65 * n) * 0.8 + core * 1.2);
  col = mix(uColor, vec3(1.0), core * 0.85) * uI;
#elif KIND == 4
  // STRIP: a trail / a bolt / a streak — a white core in a glow of its colour, fading to its tail
  float d = abs(vUv.y - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.3, d);
  float glow = 1.0 - smoothstep(0.15, 1.0, d);
  float along = pow(clamp(vUv.x, 0.0, 1.0), uTail);
  a = uA * along * (core * 0.95 + glow * glow * 0.55);
  col = mix(uColor, vec3(1.0), core * 0.85) * uI;
#elif KIND == 5
  // WAVE: a crest of light running along the floor — its foot hot, its top torn by the wind
  float n = texture2D(uNoise, vec2(vUv.x * 3.0 + uT * 0.6, vUv.y * 1.4 - uT * 3.2)).r;
  float top = 1.0 - smoothstep(0.2 + 0.55 * n, 1.0, vUv.y);
  float sides = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
  float foot = 1.0 - smoothstep(0.0, 0.22, vUv.y);
  a = uA * sides * (top * (0.3 + 0.7 * n) + foot * 0.9);
  col = mix(uColor, vec3(1.0), foot * 0.6 + n * 0.15) * uI;
#elif KIND == 7
  // INK: the dark stroke of a cut (drawn with normal blending, under its light): a band just inside the hot edge; as the
  // light goes (uI 0 -> 1) the band widens over the whole ribbon: the dark after-image (David's reference, 18:23)
  float u = vUv.x, w = vUv.y;
  if (u > uSweep) discard;
  float along = smoothstep(uSweep - uTail, uSweep, u) * smoothstep(0.0, 0.06, u);
  float band = smoothstep(0.26, 0.5, w) * (1.0 - smoothstep(0.64, 0.8, w));
  float body = smoothstep(0.04, 0.36, w) * (1.0 - smoothstep(0.86, 0.98, w));
  float n = texture2D(uNoise, vec2(u * 3.0 - uT * 2.5, w * 0.6)).r;
  a = uA * along * mix(band, body, uI) * (0.62 + 0.38 * n);
  col = uColor;
#elif KIND == 8
  // ORB: a ball of light, white-hot where it faces the eye, soft at its rim (a blow's flash)
  float c = pow(1.0 - vF, 1.6);
  a = uA * (0.12 + 0.88 * c);
  col = mix(uColor, vec3(1.0), uTail * (0.3 + 0.7 * c)) * uI;
#else
  // DECAL: a mask laid on the floor (cracks, a rune), in its colour
  vec4 t = texture2D(uMap, vUv);
  a = uA * t.a;
  col = mix(uColor, vec3(1.0), t.r * t.a * 0.35) * uI;
#endif
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const KIND = { pillar: 1, dome: 2, slash: 3, strip: 4, wave: 5, decal: 6, ink: 7, orb: 8 } as const;

// ------------------------------------------------------------------ textures (drawn once)

function noiseTex(): THREE.Texture {
  const S = 128, d = new Uint8Array(S * S * 4);
  const lat = (n: number, seed: number) => { const g = new Float32Array(n * n); let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; } return g; };
  const octs = [[4, 0.5, 11], [8, 0.27, 23], [16, 0.15, 37], [32, 0.08, 51]] as const;
  const grids = octs.map(([n, , seed]) => lat(n, seed));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    octs.forEach(([n, amp], k) => {
      const g = grids[k], fx = (x / S) * n, fy = (y / S) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (i: number, j: number) => g[((j % n) * n) + (i % n)];
      v += amp * ((at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy);
    });
    const c = Math.max(0, Math.min(255, Math.round(v * 255)));
    d.set([c, c, c, 255], (y * S + x) * 4);
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/** Branching cracks from the middle of a square: [sharp lines, their glow] (white on clear). */
function crackTex(seed: number): [THREE.Texture, THREE.Texture] {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  let s = seed * 7919 + 13; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    let px = x, py = y;
    const steps = Math.max(3, Math.round(len / 16));
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.7;
      const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps, ww = w * (1 - i / steps) + 0.6;
      g.lineWidth = ww; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (depth < 3 && r() < 0.22) branch(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * (0.35 + r() * 0.3), ww * 0.7, depth + 1);
      px = nx; py = ny;
    }
  };
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) branch(S / 2, S / 2, (i / n) * Math.PI * 2 + r() * 0.6, 150 + r() * 95, 7 + r() * 4, 0);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(S / 2, S / 2, 10, 0, Math.PI * 2); g.fill();
  const sharp = new THREE.CanvasTexture(c);
  const c2 = document.createElement('canvas'); c2.width = c2.height = S; const g2 = c2.getContext('2d')!;
  g2.filter = 'blur(7px)'; g2.drawImage(c, 0, 0); g2.filter = 'blur(2px)'; g2.globalAlpha = 0.9; g2.drawImage(c, 0, 0);
  const glow = new THREE.CanvasTexture(c2);
  for (const t of [sharp, glow]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; }
  return [sharp, glow];
}

/** A soft disc (white middle fading out): the glow at a pillar's foot. */
function discTex(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// ------------------------------------------------------------------ the effects

interface Item { step(ms: number): boolean; dispose(): void }
type Ease = (k: number) => number;
const outCubic: Ease = (k) => 1 - Math.pow(1 - k, 3);
const outBack: Ease = (k) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Quick in, a hold, a soft fade: 0..1 over a life (k 0..1). */
const env = (k: number, inK = 0.08, outK = 0.45) => (k < inK ? k / inK : k > 1 - outK ? Math.max(0, (1 - k) / outK) : 1);

export interface Recipe {
  /** At the cast (the wind-up starts). */
  cast?: (f: Fx3D, r: CastRun) => void;
  /** At the active start (the release). */
  active?: (f: Fx3D, r: CastRun) => void;
  /** Each hit the cast fires (lands or not): at its origin. */
  fired?: (f: Fx3D, r: CastRun, i: number, o: V3) => void;
  /** Each confirmed hit (at the foe): `main` for the hit that carries the skill's weight. */
  hit?: (f: Fx3D, s: FinalSkill, h: HitEvent, at: V3, main: boolean, react: string) => void;
  /** Each turn of a hold that follows its foe (`linger.at: 'target'`), at him (his chest): turn `i` from 0, `last` the final one. */
  tick?: (f: Fx3D, r: CastRun, at: V3, i: number, last: boolean) => void;
  /** Each projectile of it as it is thrown (follow it with `p.x / p.y / p.z` while `!p.done`: a card riding the shot). */
  shot?: (f: Fx3D, p: Projectile) => void;
  /** What a projectile of it trails: colour, width (px), length (ms of its path); false: none. */
  trail?: { c: number; w: number; len?: number; i?: number } | false;
  /** It runs along the floor (a crest follows the projectile). */
  crest?: { c: number; h: number; w: number };
  /** Lightning between the links of its chain. */
  chainBolt?: number;
  /** The colour the room answers its blows in (the light, the floor mark and ring, the embers) — its family's colour
   *  (the Warrior's steel / stone / iron / holy / crimson); default: the class colour. Also the default 3D pieces'. */
  tone?: number;
  /** The default main-hit layer is left out (the recipe's own hit does it all). */
  own?: boolean;
  /** The room's main-hit impact keeps its colour (its shell painted, not only added: on the red planks light alone turns white). */
  paint?: boolean;
  /** The room's main-hit impact (flash, shell, cracks, embers) is left out: the recipe draws its own main hit (its painted
   *  hit sheet through `flip`, say — David 18 Oct 20:51). The room's light and dust still answer the blow. */
  noImpact?: boolean;
}

/** A piece of a skill appearing in the room (for the arena's sound: each its own short sound under the blow). */
export type FxPiece = 'pillar' | 'dome' | 'crack' | 'crystals' | 'bolt' | 'streak' | 'slash' | 'wave' | 'rain';
/** The pieces built from David's reference (18:23): announced on `onPieceRef` with their own kind; until a sound hooks that,
 *  each borrows the nearest older piece's sound through `onPiece` (flurry → streak, impact → dome, beam → pillar, glyph →
 *  crack; a swirl is silent). */
export type FxPieceRef = 'flurry' | 'impact' | 'beam' | 'glyph' | 'swirl';
const REF_FALLBACK: Record<FxPieceRef, FxPiece | null> = { flurry: 'streak', impact: 'dome', beam: 'pillar', glyph: 'crack', swirl: null };

export class Fx3D {
  /** Told of every piece as it appears: what, where (world px: x, floor depth y, height z) and how big (0 small … 2 huge). */
  onPiece?: (kind: FxPiece, at: V3, size: number, o?: { stone?: boolean; color?: number; ink?: boolean }) => void; // (o: the piece's look — the sound picks ice, stone or thorns by it; an inked slash adds the void's thoom)
  /** Told of the reference pieces (flurry, impact, beam, glyph, swirl) by their own kind; `size` 0 a tick … 2 huge. */
  onPieceRef?: (kind: FxPieceRef, at: V3, size: number, o?: { color?: number; accent?: boolean }) => void;
  private announce(kind: FxPieceRef, at: V3, size: number, o?: { color?: number; accent?: boolean }): void {
    if (this.onPieceRef) { this.onPieceRef(kind, at, size, o); return; }
    const old = REF_FALLBACK[kind]; if (old) this.onPiece?.(old, at, size, o?.color !== undefined ? { color: o.color } : undefined);
  }
  private items: Item[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private clock = 0;
  private noise = noiseTex();
  private cracks: [THREE.Texture, THREE.Texture][] = [crackTex(1), crackTex(2), crackTex(3)];
  private disc = discTex();
  private pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
  private domeGeo = new THREE.SphereGeometry(1, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  private planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private orbGeo = new THREE.SphereGeometry(1, 28, 18);
  private glyphTexs = new Map<string, THREE.Texture>();
  private chunks: Chunks[];
  private ice: Crystals[];
  private rock: Crystals[];
  /** Trails and crests following what flies (by projectile). */
  private follows = new Map<Projectile, { trail?: Strip; crest?: Crest; last: V3 }>();
  /** Real cards in the room (the Gambler's deck on the floor, the big spinning card). */
  private deck: Deck3 | null = null;
  private get cards(): Deck3 { return (this.deck ??= new Deck3(this.h)); }
  private ttl = 0;

  constructor(private h: FxHost) {
    this.chunks = [new Chunks(h.back, 70), new Chunks(h.solid, 40)];
    this.ice = [new Crystals(h.back, 48), new Crystals(h.solid, 28)];
    this.rock = [new Crystals(h.back, 32, true), new Crystals(h.solid, 20, true)];
  }

  // ------------------------------------------------------------------ materials

  mat(kind: number, color: number, o: { i?: number; a?: number; map?: THREE.Texture; clip?: THREE.Plane[] } = {}): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, defines: { KIND: kind },
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uA: { value: o.a ?? 1 }, uI: { value: o.i ?? 1.25 }, uT: { value: Math.random() * 10 },
        uSweep: { value: 1 }, uTail: { value: 1 }, uNoise: { value: this.noise }, uMap: { value: o.map ?? this.disc },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      clipping: !!o.clip, fog: false,
    });
    if (o.clip) m.clippingPlanes = o.clip;
    return m;
  }

  /** The room's camera looks along -z (turned a little): a plane through depth `hz` across the view keeps one side. */
  cut(hz: number, keepFront: boolean): THREE.Plane[] {
    const f = this.viewXZ();
    const n = keepFront ? f.clone().negate() : f.clone(); // (toward the camera = in front)
    const planes = [new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, 0, hz))];
    if (keepFront) planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)); // (drawn over the picture with no floor to hide it: nothing under the planks)
    return planes;
  }
  /** The camera's view direction on the floor plane (unit). */
  viewXZ(): THREE.Vector3 { const f = new THREE.Vector3(); this.h.camera.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); return f.normalize(); }

  /** One effect mesh in both layers: its part behind the plane through depth hz in the room (bloomed), the part in front
   *  over the fighters. Returns both (same geometry, own materials). */
  private both(geo: THREE.BufferGeometry, kind: number, color: number, hz: number, o: { i?: number; a?: number; map?: THREE.Texture } = {}): THREE.Mesh[] {
    const back = new THREE.Mesh(geo, this.mat(kind, color, { ...o, clip: this.cut(hz, false) }));
    const front = new THREE.Mesh(geo, this.mat(kind, color, { ...o, clip: this.cut(hz, true) }));
    back.frustumCulled = front.frustumCulled = false;
    this.h.back.add(back); this.h.glow.add(front);
    return [back, front];
  }
  /** The dark stroke of a piece (`KIND.ink`): normal blending (it darkens), its part behind the plane through depth hz in the
   *  room, the part in front in the solid layer over the fighters; drawn under the piece's own light. */
  private inkPair(geo: THREE.BufferGeometry, color: number, hz: number): THREE.Mesh[] {
    const mk = (front: boolean) => {
      const m = this.mat(KIND.ink, color, { i: 0, clip: this.cut(hz, front) }); m.blending = THREE.NormalBlending;
      const me = new THREE.Mesh(geo, m); me.frustumCulled = false; me.renderOrder = -1; return me;
    };
    const back = mk(false), front = mk(true);
    this.h.back.add(back); this.h.solid.add(front);
    return [back, front];
  }
  private drop(ms: THREE.Mesh[], ownGeo = false): void {
    for (const m of ms) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); }
    if (ownGeo && ms[0]) ms[0].geometry.dispose();
  }
  private setU(ms: THREE.Mesh[], k: string, v: number): void { for (const m of ms) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; }

  // ------------------------------------------------------------------ units

  private P(at: V3): THREE.Vector3 { const z = Number.isFinite(at.z) ? at.z : 0; return new THREE.Vector3(this.h.w3(at.x), this.h.h3(z), this.h.d3(at.y)); } // (a point without its height: on the floor, never NaN)

  /** Later (ms, on the effects' own clock: it runs with the room). */
  later(ms: number, fn: () => void): void { if (ms <= 0) fn(); else this.timers.push({ at: this.clock + ms, fn }); }

  // ------------------------------------------------------------------ the pieces

  /** A column of light standing on the floor at (x, y) — `h` its height, `r` its radius (world px). */
  pillar(x: number, y: number, color: number, o: { h?: number; r?: number; ms?: number; i?: number; twist?: boolean; core?: boolean } = {}): void {
    const hx = this.h.w3(x), hz = this.h.d3(y), H = this.h.h3(o.h ?? 420), R = this.h.w3(o.r ?? 34), ms = o.ms ?? 520, i = o.i ?? 1.35;
    this.onPiece?.('pillar', { x, y, z: 0 }, (o.h ?? 420) > 650 ? 2 : (o.h ?? 420) > 450 ? 1 : 0);
    const outer = this.both(this.pillarGeo, KIND.pillar, color, hz, { i });
    const inner = o.core === false ? [] : this.both(this.pillarGeo, KIND.pillar, mix(color, 0xffffff, 0.7), hz, { i: i * 1.1 });
    const foot = new THREE.Mesh(this.planeGeo, this.mat(KIND.decal, color, { i: 1.4, map: this.disc })); foot.position.set(hx, 0.03, hz); this.h.back.add(foot);
    for (const m of [...outer, ...inner]) m.position.set(hx, 0, hz);
    let t = 0;
    this.h.flare(hx, H * 0.35, hz + 0.2, color, 26 * (o.h ?? 420) / 420, 8, ms * 0.9);
    this.h.embers(hx, 0.15, hz, color, 10, 2.4);
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms), e = env(k, 0.07, 0.55), grow = outCubic(Math.min(1, k * 3));
        for (const m of outer) { m.scale.set(R * (0.5 + 0.7 * grow), H * (0.4 + 0.6 * grow), R * (0.5 + 0.7 * grow)); m.rotation.y = o.twist ? t / 160 : 0; }
        for (const m of inner) m.scale.set(R * 0.38 * (1.2 - 0.6 * k), H * (0.45 + 0.6 * grow), R * 0.38 * (1.2 - 0.6 * k));
        this.setU(outer, 'uA', e * 0.85); this.setU(inner, 'uA', e * 0.7 * (1 - k * 0.6));
        this.setU(outer, 'uT', t / 1000); this.setU(inner, 'uT', t / 1000 + 3);
        foot.scale.set(R * 6 * (0.6 + 0.6 * grow), 1, R * 6 * (0.6 + 0.6 * grow)); (foot.material as THREE.ShaderMaterial).uniforms.uA.value = e * 0.55;
        if (t >= ms) { this.drop([...outer, ...inner]); this.drop([foot]); return false; }
        return true;
      }, dispose: () => { this.drop([...outer, ...inner]); this.drop([foot]); },
    });
  }

  /** A shell of energy swelling from a point on the floor (radius `r` px); `implode` shrinks it into the point instead. */
  dome(x: number, y: number, color: number, o: { r?: number; ms?: number; i?: number; implode?: boolean; a?: number; hold?: number; follow?: () => V3 | null; /** its rim also painted in its colour (normal blending): it keeps its hue over the bright planks */ paint?: boolean } = {}): void {
    const ms = o.ms ?? 420, R = this.h.w3(o.r ?? 150), base = o.a ?? 0.75;
    let hx = this.h.w3(x), hz = this.h.d3(y);
    if (!o.hold) this.onPiece?.('dome', { x, y, z: 0 }, (o.r ?? 150) > 260 ? 2 : (o.r ?? 150) > 150 ? 1 : 0);
    const painted: THREE.Mesh[] = [];
    if (o.paint) for (const front of [false, true]) { // (painted: its front half in the solid layer — the glow layer is added over the picture)
      const pm = this.mat(KIND.dome, mix(color, 0x000000, 0.3), { i: 1, clip: this.cut(hz, front) }); pm.blending = THREE.NormalBlending;
      const m = new THREE.Mesh(this.domeGeo, pm); m.frustumCulled = false; m.renderOrder = -1; (front ? this.h.solid : this.h.back).add(m); painted.push(m);
    }
    const ms2 = [...painted, ...this.both(this.domeGeo, KIND.dome, color, hz, { i: o.paint ? (o.i ?? 1.3) * 0.75 : o.i ?? 1.3 })];
    let t = 0;
    this.h.flare(hx, 0.6, hz + 0.3, color, 18, 7, Math.min(ms, 600));
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms);
        const f = o.follow?.(); if (f) { hx = this.h.w3(f.x); hz = this.h.d3(f.y); }
        const s = o.implode ? R * (1.15 - outCubic(k)) : R * (0.25 + 0.75 * outCubic(Math.min(1, k * 1.6)));
        for (const m of ms2) { m.position.set(hx, 0, hz); m.scale.set(s, s * 0.92, s); }
        this.setU(ms2, 'uA', base * env(k, 0.06, o.hold ? 0.25 : 0.6)); this.setU(ms2, 'uT', t / 1000);
        if (t >= ms) { this.drop(ms2); return false; }
        return true;
      }, dispose: () => this.drop(ms2),
    });
  }

  /** Cracks torn in the floor round (x, y): glowing in its colour, then a dark scar that fades; chunks of the floor fly. */
  crack(x: number, y: number, color: number, o: { r?: number; ms?: number; chunks?: number; up?: number; quiet?: boolean } = {}): void {
    const hx = this.h.w3(x), hz = this.h.d3(y), R = this.h.w3(o.r ?? 110), ms = o.ms ?? 900;
    if (!o.quiet) this.onPiece?.('crack', { x, y, z: 0 }, (o.r ?? 110) > 200 ? 2 : (o.r ?? 110) > 130 ? 1 : 0);
    const [sharp, glow] = this.cracks[Math.floor(Math.random() * this.cracks.length)], rot = Math.random() * Math.PI * 2;
    const mk = (map: THREE.Texture, c: number, i: number, add: boolean, y0: number) => {
      const m = new THREE.Mesh(this.planeGeo, add ? this.mat(KIND.decal, c, { i, map })
        : new THREE.MeshBasicMaterial({ color: 0x140a06, map, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(hx, y0, hz); m.rotation.y = rot; m.scale.set(R * 2, 1, R * 2 * 0.95); this.h.back.add(m); return m;
    };
    const scar = mk(sharp, 0, 0, false, 0.014), hot = mk(glow, color, 2.6, true, 0.018), core = mk(sharp, mix(color, 0xffffff, 0.55), 2.4, true, 0.02);
    let t = 0;
    this.h.flare(hx, 0.25, hz + 0.2, color, 16, 6, 500);
    if ((o.chunks ?? 10) > 0) this.debris(x, y, o.chunks ?? 10, { speed: 1, up: o.up ?? 1 });
    this.h.dust(hx, hz, Math.max(4, Math.round((o.chunks ?? 10) / 2)), Math.min(1.4, R));
    this.items.push({
      step: (dt) => {
        t += dt;
        const g = Math.max(0, 1 - t / ms), flick = 0.85 + 0.15 * Math.sin(t / 23);
        (hot.material as THREE.ShaderMaterial).uniforms.uA.value = g * g * flick;
        (core.material as THREE.ShaderMaterial).uniforms.uA.value = Math.max(0, 1 - t / (ms * 0.45));
        const open = outCubic(Math.min(1, t / 120)); for (const m of [scar, hot, core]) m.scale.set(R * 2 * (0.7 + 0.3 * open), 1, R * 1.9 * (0.7 + 0.3 * open));
        (scar.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.min(1, Math.max(0, (ms * 4 - t) / 900));
        if (t >= ms * 4) { this.drop([scar, hot, core]); return false; }
        return true;
      }, dispose: () => this.drop([scar, hot, core]),
    });
  }

  /** Chunks of the floor (wood where the planks are, stone round them) thrown up from (x, y), falling and bouncing. */
  debris(x: number, y: number, n: number, o: { speed?: number; up?: number; size?: number; dir?: number } = {}): void {
    const hx = this.h.w3(x), hz = this.h.d3(y);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.7 + Math.random() * 1.9) * (o.speed ?? 1), vz = Math.sin(a) * sp * 0.8;
      const vx = Math.cos(a) * sp + (o.dir ?? 0) * 1.2;
      const pool = vz > 0 ? this.chunks[1] : this.chunks[0];
      pool.emit(hx + Math.cos(a) * 0.15, 0.05, hz + Math.sin(a) * 0.1, vx, (2.2 + Math.random() * 3) * (o.up ?? 1), vz, (o.size ?? 1) * (0.028 + Math.random() * 0.05));
    }
  }

  /** Ice crystals breaking out of the floor: a cluster at (x, y) (r px round it), or a ring of them; they stand, then shatter. */
  /** Crystals thrust up from the floor (a cluster, or a ring round the point); `stone`: rock spikes instead of ice (the
   *  Warrior's STONE family), they crumble into dust instead of bursting into shards. */
  crystals(x: number, y: number, o: { n?: number; r?: number; h?: number; ms?: number; ring?: boolean; delay?: number; color?: number; stone?: boolean; /** a name, to break them early (`crystalsDrop`) */ key?: string } = {}): void {
    const n = o.n ?? 7, R = this.h.w3(o.r ?? 60), H = this.h.h3(o.h ?? 120), cx = this.h.w3(x), cz = this.h.d3(y), ms = o.ms ?? 1500;
    this.later(o.delay ?? 0, () => this.onPiece?.('crystals', { x, y, z: 0 }, n > 10 ? 2 : n > 6 ? 1 : 0, { stone: o.stone, color: o.color }));
    const pz = this.h.d3(y);
    for (let i = 0; i < n; i++) {
      const a = o.ring ? (i / n) * Math.PI * 2 + Math.random() * 0.3 : Math.random() * Math.PI * 2;
      const d = o.ring ? R : R * Math.sqrt(Math.random()), px = cx + Math.cos(a) * d, pzz = cz + Math.sin(a) * d * 0.85;
      const tilt = (o.ring ? 0.45 : 0.25 + Math.random() * 0.35), h = H * (0.55 + Math.random() * 0.6) * (o.ring ? 1 : i === 0 ? 1.35 : 1);
      const set = o.stone ? this.rock : this.ice, pool = pzz > pz + 0.02 ? set[1] : set[0];
      pool.emit(px, pzz, a, tilt, H > 0 ? h : 0.5, h * 0.17 + 0.03, ms, (o.delay ?? 0) + (o.ring ? i * 12 : Math.random() * 70), o.key);
    }
    if (o.stone) { // (dust as they burst up, dust as they crumble)
      const d0 = o.delay ?? 0, out = Math.max(ms, 740);
      this.later(d0, () => { this.h.dust(cx, cz, 10, 1); this.debris(x, y, Math.min(10, 3 + n), { speed: 0.9, up: 1.5, size: 0.8 }); }); // (rubble thrown up as they break out)
      this.later(d0 + out - 380, () => { this.h.dust(cx, cz, 9, 0.9); this.debris(x, y, Math.min(8, 2 + n), { speed: 0.5, up: 0.7, size: 0.6 }); }); // (and as they crumble back in)
      if (o.color !== undefined) this.h.flare(cx, 0.3, cz + 0.2, o.color, 8, 4, 420);
      return;
    }
    this.h.flare(cx, 0.4, cz + 0.2, o.color ?? C.frost, 14, 6, 520);
    this.later((o.delay ?? 0) + ms - 120, () => this.h.embers(cx, 0.4, cz, C.ice, 14, 2.2)); // (they burst into glittering shards)
  }

  /** The crystals named `key` (`crystals({ key })`) break now: they sink away in 160 ms (the Warrior's spikes burst early). */
  crystalsDrop(key: string): void { for (const p of [...this.ice, ...this.rock]) p.drop(key); }

  /** Lightning from a to b (world points): a jagged bolt, re-struck every few frames, with forks; it lights the room. */
  bolt(a: V3, b: V3, color: number, o: { ms?: number; w?: number; forks?: number; front?: boolean; /** its glow also painted in its colour (normal blending): it keeps its hue over the bright planks */ hue?: boolean } = {}): void {
    const ms = o.ms ?? 260, A = this.P(a), B = this.P(b), w = (o.w ?? 10) / 100;
    this.onPiece?.('bolt', b, (o.w ?? 10) > 12 ? 1 : 0);
    const n = 24, core = new Strip(n, this.mat(KIND.strip, color, { i: 2.6 }), w), glow = new Strip(n, this.mat(KIND.strip, color, { i: o.hue ? 1.0 : 1.4 }), w * 4.5);
    const scene = o.front === false ? this.h.back : this.h.glow;
    if (o.hue) { const pm = this.mat(KIND.strip, mix(color, 0x000000, 0.25), { i: 1 }); pm.blending = THREE.NormalBlending; const paint = new Strip(n, pm, w * 3.2); paint.mesh.renderOrder = 1; core.mesh.renderOrder = 3; glow.mesh.renderOrder = 2; (o.front === false ? this.h.back : this.h.solid).add(paint.mesh); const set0 = glow.set.bind(glow), ua0 = glow.uA.bind(glow), dis0 = glow.dispose.bind(glow); glow.set = (p, c, tr) => { set0(p, c, tr); paint.set(p, c, tr); }; glow.uA = (v) => { ua0(v); paint.uA(v * 0.55); }; glow.dispose = () => { dis0(); paint.dispose(); }; } // (painted: in the solid layer in front — the glow layer is added over the picture)
    scene.add(core.mesh, glow.mesh);
    const forks: { s: Strip; from: number; to: THREE.Vector3 }[] = [];
    for (let i = 0; i < (o.forks ?? 2); i++) {
      const s = new Strip(10, this.mat(KIND.strip, color, { i: 2 }), w * 0.6); scene.add(s.mesh);
      forks.push({ s, from: 0.25 + Math.random() * 0.5, to: new THREE.Vector3() });
    }
    const pts: THREE.Vector3[] = [];
    const strike = () => {
      pts.length = 0; const len = A.distanceTo(B);
      for (let i = 0; i <= n; i++) {
        const k = i / n, p = A.clone().lerp(B, k);
        const amp = len * 0.09 * Math.sin(Math.PI * k);
        p.x += (Math.random() - 0.5) * amp; p.y += (Math.random() - 0.5) * amp; p.z += (Math.random() - 0.5) * amp * 0.6;
        pts.push(p);
      }
      for (const f of forks) {
        const i0 = Math.floor(f.from * n), p0 = pts[i0], dir = B.clone().sub(A).normalize();
        const end = p0.clone().add(dir.multiplyScalar(len * 0.25)).add(new THREE.Vector3((Math.random() - 0.5) * len * 0.3, (Math.random() - 0.5) * len * 0.2, (Math.random() - 0.5) * 0.3));
        const fp: THREE.Vector3[] = [];
        for (let i = 0; i <= 10; i++) { const p = p0.clone().lerp(end, i / 10); p.x += (Math.random() - 0.5) * 0.12; p.y += (Math.random() - 0.5) * 0.12; fp.push(p); }
        f.s.set(fp, this.h.camera, 1);
      }
      core.set(pts, this.h.camera, 0); glow.set(pts, this.h.camera, 0);
    };
    strike();
    this.h.flare(B.x, B.y + 0.2, B.z + 0.2, color, 30, 9, ms);
    let t = 0, next = 45;
    this.items.push({
      step: (dt) => {
        t += dt; if (t >= next) { next += 40 + Math.random() * 30; strike(); }
        const k = clamp01(t / ms), e = (1 - k) * (0.7 + 0.3 * Math.random());
        for (const s of [core, glow, ...forks.map((f) => f.s)]) s.uA(e);
        if (t >= ms) { for (const s of [core, glow, ...forks.map((f) => f.s)]) s.dispose(); return false; }
        return true;
      }, dispose: () => { for (const s of [core, glow, ...forks.map((f) => f.s)]) s.dispose(); },
    });
  }

  /** A straight streak of light from a to b (world points) that flashes and fades (a dash, a thrust, a chain, a razor line). */
  streak(a: V3, b: V3, color: number, o: { w?: number; ms?: number; draw?: number; front?: boolean; quiet?: boolean } = {}): void {
    const A = this.P(a), B = this.P(b), ms = o.ms ?? 320, draw = o.draw ?? 70, n = 12;
    if (!o.quiet) this.onPiece?.('streak', b, (o.w ?? 16) > 24 ? 1 : 0);
    const s = new Strip(n, this.mat(KIND.strip, color, { i: 2.4 }), (o.w ?? 16) / 100), g = new Strip(n, this.mat(KIND.strip, color, { i: 1.2 }), (o.w ?? 16) * 3.2 / 100);
    (o.front ? this.h.glow : this.h.back).add(s.mesh, g.mesh);
    let t = 0;
    this.items.push({
      step: (dt) => {
        t += dt; const d = clamp01(t / draw), pts: THREE.Vector3[] = [];
        for (let i = 0; i <= n; i++) pts.push(A.clone().lerp(B, (i / n) * d));
        s.set(pts, this.h.camera, 1); g.set(pts, this.h.camera, 1);
        const e = t < draw ? 1 : Math.max(0, 1 - (t - draw) / (ms - draw)); s.uA(e); g.uA(e * 0.8); s.tail(0.35); g.tail(0.6);
        if (t >= ms) { s.dispose(); g.dispose(); return false; }
        return true;
      }, dispose: () => { s.dispose(); g.dispose(); },
    });
  }

  /** A slash arc round a fighter at `at` (feet): `dir` ±1 the side it cuts toward, radius `r` px at height `y0` px, the arc's
   *  plane tilted by `tilt` (deg: 0 flat round him, 90 upright), its sweep from `a0` to `a1` (deg, 0 = in front of him). */
  slash(at: V3, dir: number, color: number, o: { r?: number; w?: number; tilt?: number; a0?: number; a1?: number; ms?: number; y0?: number; i?: number; roll?: number; follow?: () => V3 | null; /** the dark stroke inside its hot edge and the dark after-image as it fades (true: its colour near black; or a colour) */ ink?: boolean | number; /** turned round the vertical (deg) off facing across the view: rings at many angles (a ball of blades) */ yaw?: number; /** no sound piece (one of many) */ quiet?: boolean } = {}): void {
    const R = this.h.w3(o.r ?? 120), W = this.h.w3(o.w ?? 46), ms = o.ms ?? 300, a0 = THREE.MathUtils.degToRad(o.a0 ?? -70), a1 = THREE.MathUtils.degToRad(o.a1 ?? 110);
    const n = 48, pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, a = a0 + (a1 - a0) * k, taper = Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.05)), 0.55), rin = R - W * taper;
      // the arc in its own plane: x along the cut's side, y up; in front of him at angle 0
      pos.set([Math.sin(a) * rin * dir, Math.cos(a) * rin, 0, Math.sin(a) * R * dir, Math.cos(a) * R, 0], i * 6);
      uv.set([k, 0, k, 1], i * 4);
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    if (!o.quiet) this.onPiece?.('slash', at, (o.r ?? 120) > 160 ? 1 : 0, o.ink ? { ink: true } : undefined);
    let p = this.P(at); p.y += this.h.h3(o.y0 ?? 95);
    const ms2 = this.both(geo, KIND.slash, color, p.z, { i: o.i ?? (o.ink ? 1.6 : 2.3) }); // (inked: the colour reads over its dark, less white bloom)
    const ink = o.ink === undefined || o.ink === false ? [] : this.inkPair(geo, typeof o.ink === 'number' ? o.ink : mix(color, 0x000000, 0.86), p.z);
    const inkMs = ink.length ? ms * 1.45 : ms; // (the dark after-image outlasts the light)
    const place = () => {
      for (const m of [...ms2, ...ink]) {
        m.position.copy(p);
        // the arc's plane: turned to face across the view (the camera's yaw, + its own yaw), then tipped toward the floor by `tilt`
        m.rotation.set(0, 0, 0); m.rotateY(this.camYaw() + THREE.MathUtils.degToRad(o.yaw ?? 0)); m.rotateX(THREE.MathUtils.degToRad(90 - (o.tilt ?? 30))); m.rotateZ(THREE.MathUtils.degToRad(o.roll ?? 0));
      }
    };
    place();
    let t = 0;
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms);
        const f = o.follow?.(); if (f) { p = this.P(f); p.y += this.h.h3(o.y0 ?? 95); place(); }
        const sweep = Math.min(1.0001, outCubic(Math.min(1, k * 2.4)) * 1.0001), tail = 0.25 + 0.75 * Math.min(1, k * 2.4), fade = k < 0.42 ? 0 : Math.min(1, (k - 0.42) / 0.58);
        this.setU(ms2, 'uSweep', sweep); this.setU(ms2, 'uTail', tail);
        this.setU(ms2, 'uA', 1 - fade); this.setU(ms2, 'uT', t / 1000);
        if (ink.length) {
          this.setU(ink, 'uSweep', sweep); this.setU(ink, 'uTail', tail); this.setU(ink, 'uT', t / 1000);
          this.setU(ink, 'uI', fade); this.setU(ink, 'uA', 0.85 * (t < ms ? 1 : Math.max(0, 1 - (t - ms) / (inkMs - ms))));
        }
        if (t >= inkMs) { this.drop([...ms2, ...ink], true); return false; }
        return true;
      }, dispose: () => this.drop([...ms2, ...ink], true),
    });
  }

  /** A whirl of cuts flat round a fighter (several rings, turning), for `ms`, following him. */
  whirl(id: string, color: number, o: { r?: number; ms?: number; rings?: number; y0?: number; every?: number; dir?: number; ink?: boolean | number } = {}): void {
    const ms = o.ms ?? 500, every = o.every ?? 110, rings = o.rings ?? 2;
    for (let t = 0; t < ms; t += every) for (let j = 0; j < rings; j++) {
      this.later(t + j * 30, () => {
        const c = this.h.casterPos(id); if (!c) return;
        this.slash(c, o.dir ?? 1, color, { r: (o.r ?? 130) * (1 - j * 0.12), w: 40, tilt: 8 + j * 10, a0: -180 + Math.random() * 60, a1: 140 + Math.random() * 60, ms: 260, y0: (o.y0 ?? 70) + j * 45, follow: () => this.h.casterPos(id), ink: o.ink, quiet: j > 0 });
      });
    }
  }

  /** A crest of light running along the floor from (x, y) toward (dx, dy) for `len` px over `ms` (or following a projectile). */
  wave(x: number, y: number, dx: number, dy: number, color: number, o: { len?: number; ms?: number; h?: number; w?: number; chunks?: boolean } = {}): void {
    const len = o.len ?? 420, ms = o.ms ?? 260, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    this.onPiece?.('wave', { x, y, z: 0 }, len > 600 ? 2 : 1);
    const c = new Crest(this, color, this.h.w3(o.w ?? 120), this.h.h3(o.h ?? 110));
    let t = 0, lastX = x, lastY = y;
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms), px = x + ux * len * k, py = y + uy * len * k;
        c.at(this.h.w3(px), this.h.d3(py), Math.atan2(ux, uy * 1.15), 1 - Math.max(0, (k - 0.75) / 0.25));
        if (o.chunks !== false && Math.hypot(px - lastX, py - lastY) > 60) { lastX = px; lastY = py; this.debris(px, py, 2, { speed: 0.6, up: 0.8, dir: ux }); this.h.dust(this.h.w3(px), this.h.d3(py), 1, 0.7); }
        c.step(dt);
        if (t >= ms) { c.dispose(); return false; }
        return true;
      }, dispose: () => c.dispose(),
    });
  }

  /** Arrows / bolts of light raining down over a circle (x, y, r px) for `ms`: streaks falling from high above. */
  rain(x: number, y: number, r: number, color: number, o: { n?: number; ms?: number; h?: number } = {}): void {
    const n = o.n ?? 24, ms = o.ms ?? 900, H = o.h ?? 900;
    this.onPiece?.('rain', { x, y, z: 0 }, n > 30 ? 2 : 1);
    for (let i = 0; i < n; i++) this.later((i / n) * ms + Math.random() * 60, () => {
      const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random()), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.6, lean = 60;
      this.streak({ x: px - lean, y: py, z: H }, { x: px, y: py, z: 0 }, color, { w: 8, ms: 180, draw: 90 });
      this.later(90, () => { this.h.embers(this.h.w3(px), 0.08, this.h.d3(py), color, 3, 1.4); if (Math.random() < 0.35) this.debris(px, py, 1, { speed: 0.5, up: 0.6 }); });
    });
  }

  // ------------------------------------------------------------------ David's reference (18:23, Prometheus: Ring of Fire)

  /** A ball of light centred at `at` (world px): radius r0 → r1 px over its life, white-hot where it faces the eye. */
  private orb(at: V3, color: number, o: { r0: number; r1: number; ms: number; a?: number; i?: number; delay?: number; white?: number }): void {
    this.later(o.delay ?? 0, () => {
      const P = this.P(at), ms2 = this.both(this.orbGeo, KIND.orb, color, P.z, { i: o.i ?? 2.2 });
      this.setU(ms2, 'uTail', o.white ?? 1);
      let t = 0;
      this.items.push({
        step: (dt) => {
          t += dt; const k = clamp01(t / o.ms), r = this.h.w3(o.r0 + (o.r1 - o.r0) * outCubic(Math.min(1, k * 1.8)));
          for (const m of ms2) { m.position.copy(P); m.scale.set(r, r, r); }
          this.setU(ms2, 'uA', (o.a ?? 1) * (k < 0.35 ? 1 : Math.max(0, 1 - (k - 0.35) / 0.65)));
          if (t >= o.ms) { this.drop(ms2); return false; }
          return true;
        }, dispose: () => this.drop(ms2),
      });
    });
  }

  /** A blow's main hit in one piece (the reference's hammer slam, 02): a white flash sphere (~95 ms) → its colour bursting
   *  out as a shell (~280 ms) → a ring of glowing cracks in the floor → embers rising and fading (~600 ms). `at`: the blow's point (world
   *  px, z its height); `r`: the flash's radius (px, default 60); `cracks: false` in the air. */
  impact(at: V3, color: number, o: { r?: number; cracks?: boolean; embers?: number; /** its shell painted in its colour (see dome) */ paint?: boolean } = {}): void {
    const r = o.r ?? 60, hx = this.h.w3(at.x), hz = this.h.d3(at.y), hy = this.h.h3(at.z);
    this.lastImpact = { x: at.x, y: at.y, t: this.clock };
    this.announce('impact', at, r > 100 ? 2 : r > 55 ? 1 : 0, { color });
    if (flipReady(this, IMPACT_SHEET)) { // (David 18 Oct 20:49, "not professional": the white ball and its shell were drawn in code — a painted burst now, tinted to the blow, its white-hot heart kept, the struck one seen through it)
      this.flip(IMPACT_SHEET, at, { grid: [4, 4], fps: 38, w: r * 4.4, mode: 'up', tint: color, core: 0.95, coreMs: 90, gain: 1.1, through: 0.65, glow: 0.2, rot: (Math.random() - 0.5) * 16, flipX: Math.random() < 0.5 });
    } else { // (the sheet not in yet: the code-drawn flash)
      this.orb(at, 0xffffff, { r0: r * 0.6, r1: r, ms: 95, a: 0.85, i: 1.5 }); // (a flash, never a white-out: gone in ~6 frames)
      this.later(40, () => this.dome(at.x, at.y, color, { r: r * 1.7, ms: 280, a: 0.55, i: 1.5, hold: 1, paint: o.paint })); // (its colour bursts out as a shell, its rim burning: the blow seen through it)
    }
    this.h.flare(hx, hy, hz + 0.2, color, (30 * r) / 80, 9, 380);
    if (o.cracks !== false) this.later(30, () => this.crack(at.x, at.y, color, { r: r * 1.15, ms: 520, chunks: Math.round(r / 12), quiet: true }));
    this.later(60, () => this.h.ring(hx, hz, color, this.h.w3(r * 2.2), 380, 0.6));
    const n = o.embers ?? 14;
    for (let k = 0; k < 3; k++) this.later(80 + k * 90, () => this.h.embers(hx, hy * 0.6, hz, color, Math.max(1, Math.round(n / 3)), 1.6 - k * 0.3));
  }

  /** A flurry of cuts through a foe (the reference's dark knight, 04): thin, very long lines crossing at `at` (his chest; a
   *  function follows him), a new one every `every` ms for `ms`, each ~115 ms, every `accent`-th heavier (wider, longer, a
   *  flare). Each line is announced as a tick (`flurry`, size 0; an accent 1) for its sound. */
  flurry(at: V3 | (() => V3 | null), color: number, o: { ms?: number; every?: number; len?: number; w?: number; accent?: number; spread?: number } = {}): void {
    const ms = o.ms ?? 600, every = o.every ?? 38, len = o.len ?? 320, accent = o.accent ?? 5, get = typeof at === 'function' ? at : () => at;
    let k = 0, ang = Math.random() * Math.PI;
    for (let t = 0; t < ms; t += every) this.later(t, () => {
      const c = get(); if (!c) return;
      const i = k++, heavy = accent > 0 && i % accent === accent - 1;
      ang += Math.PI * (0.38 + Math.random() * 0.34); // (each crosses the one before)
      const L = len * (heavy ? 1.3 : 0.75 + Math.random() * 0.4), sp = o.spread ?? 24;
      const mx = c.x + (Math.random() - 0.5) * sp, mz = c.z + (Math.random() - 0.5) * sp * 0.8, my = c.y + (Math.random() - 0.5) * 10;
      let dx = (Math.cos(ang) * L) / 2, dz = (Math.sin(ang) * L * 0.8) / 2;
      if (dz < 0) { dx = -dx; dz = -dz; } // (from its low end up)
      const low = mz - dz, lo = low >= 6 ? 0 : Math.min(1, (6 - low) / (2 * dz || 1)); // (the part under the floor cut off)
      const a3 = { x: mx - dx + 2 * dx * lo, y: my, z: low + 2 * dz * lo };
      this.streak(a3, { x: mx + dx, y: my, z: mz + dz }, color, { w: (o.w ?? 7) * (heavy ? 2 : 1), ms: heavy ? 150 : 115, draw: heavy ? 28 : 16, front: true, quiet: true });
      this.announce('flurry', c, heavy ? 1 : 0, { color, accent: heavy });
      if (heavy) { const hx = this.h.w3(c.x), hz = this.h.d3(c.y), hy = this.h.h3(c.z); this.h.flare(hx, hy, hz + 0.2, color, 14, 6, 160); this.h.embers(hx, hy, hz, color, 5, 1.8); }
    });
  }

  /** A ball of blades round a fighter (the reference's scythe, 07): cut rings at many angles round him, one every `every`
   *  ms for `ms`, following him; `ink` gives each its dark trailing ring. */
  bladeBall(id: string, color: number, o: { r?: number; ms?: number; every?: number; y0?: number; ink?: boolean | number; w?: number } = {}): void {
    const ms = o.ms ?? 900, every = o.every ?? 75, R = o.r ?? 110, tilts = [10, 70, 38, 85, 22, 55], yaws = [0, 60, -45, 30, -75, 15];
    let k = 0;
    for (let t = 0; t < ms; t += every) this.later(t, () => {
      const c = this.h.casterPos(id); if (!c) return;
      const i = k++;
      this.slash(c, i % 2 ? 1 : -1, color, { r: R * (0.9 + Math.random() * 0.2), w: o.w ?? 36, tilt: tilts[i % 6] + (Math.random() - 0.5) * 14, yaw: yaws[i % 6] + (Math.random() - 0.5) * 20, roll: (Math.random() - 0.5) * 40, a0: -175 + Math.random() * 30, a1: 150 + Math.random() * 30, ms: 240, y0: o.y0 ?? 75, ink: o.ink, follow: () => this.h.casterPos(id), quiet: i % 3 !== 0 });
    });
  }

  /** A beam of light from high above straight down onto `at` (the reference's archer, 06): struck from the top in `draw`
   *  ms, flickering, faded by `ms`; a function `at` keeps it on a moving foe. A flare, embers and a ring at its foot. */
  skyBeam(at: V3 | (() => V3 | null), color: number, o: { ms?: number; w?: number; h?: number; draw?: number } = {}): void {
    const get = typeof at === 'function' ? at : () => at, c0 = get(); if (!c0) return;
    const ms = o.ms ?? 420, draw = o.draw ?? 60, H = o.h ?? 1100, n = 10;
    this.announce('beam', c0, (o.w ?? 10) > 14 ? 1 : 0, { color });
    const core = new Strip(n, this.mat(KIND.strip, color, { i: 2.8 }), (o.w ?? 10) / 100), glow = new Strip(n, this.mat(KIND.strip, color, { i: 1.3 }), ((o.w ?? 10) * 4) / 100);
    this.h.glow.add(core.mesh, glow.mesh);
    const hx0 = this.h.w3(c0.x), hz0 = this.h.d3(c0.y), hy0 = this.h.h3(c0.z);
    this.h.flare(hx0, hy0 + 0.2, hz0 + 0.2, color, 22, 8, 260); this.h.embers(hx0, hy0, hz0, color, 6, 1.6); this.h.ring(hx0, hz0, color, this.h.w3(90), 300, 0.5);
    let t = 0, last = c0;
    this.items.push({
      step: (dt) => {
        t += dt; const c = get() ?? last; last = c;
        const top = this.P({ x: c.x - 40, y: c.y, z: H }), bot = this.P(c), d = clamp01(t / draw), pts: THREE.Vector3[] = [];
        for (let i = 0; i <= n; i++) pts.push(top.clone().lerp(bot, (i / n) * d)); // (struck from the top down)
        core.set(pts, this.h.camera, 0); glow.set(pts, this.h.camera, 0);
        const e = (t < ms * 0.6 ? 1 : Math.max(0, 1 - (t - ms * 0.6) / (ms * 0.4))) * (0.82 + 0.18 * Math.random());
        core.uA(e); glow.uA(e * 0.7); core.tail(0.2); glow.tail(0.5);
        if (t >= ms) { core.dispose(); glow.dispose(); return false; }
        return true;
      }, dispose: () => { core.dispose(); glow.dispose(); },
    });
  }

  /** A big glyph on the floor at (x, y) (the reference's archer, mage and gothic ults: 06, 08, 09): `shape` 'star' (a crystal
   *  star of `points`), 'spiral' or 'runes' (a ring of marks); it opens, turns slowly and pulses for `ms`, then fades. `r`:
   *  its radius (px). */
  glyph(x: number, y: number, color: number, o: { shape?: 'star' | 'spiral' | 'runes'; r?: number; ms?: number; spin?: number; points?: number; pulse?: number; a?: number } = {}): void {
    const shape = o.shape ?? 'star', R = this.h.w3(o.r ?? 180), ms = o.ms ?? 2200, hx = this.h.w3(x), hz = this.h.d3(y), A = o.a ?? 0.9;
    this.announce('glyph', { x, y, z: 0 }, (o.r ?? 180) > 220 ? 2 : 1, { color });
    const map = this.glyphTex(shape, o.points ?? 8);
    const m = new THREE.Mesh(this.planeGeo, this.mat(KIND.decal, color, { i: 1.8, map })); m.position.set(hx, 0.022, hz); this.h.back.add(m);
    const core = new THREE.Mesh(this.planeGeo, this.mat(KIND.decal, mix(color, 0xffffff, 0.6), { i: 1.6, map })); core.position.set(hx, 0.024, hz); this.h.back.add(core);
    this.h.flare(hx, 0.3, hz + 0.2, color, 18, 8, Math.min(ms, 700));
    const rot = Math.random() * Math.PI * 2;
    let t = 0;
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms), open = outBack(Math.min(1, t / 220)), sz = R * 2 * (0.55 + 0.45 * open);
        const pulse = 0.78 + 0.22 * Math.sin((t / 1000) * Math.PI * 2 * (o.pulse ?? 2.2)), fade = k > 0.85 ? (1 - k) / 0.15 : 1;
        m.scale.set(sz, 1, sz); core.scale.set(sz * 0.985, 1, sz * 0.985);
        m.rotation.y = core.rotation.y = rot + (t / 1000) * THREE.MathUtils.degToRad(o.spin ?? 14);
        (m.material as THREE.ShaderMaterial).uniforms.uA.value = A * pulse * fade * Math.min(1, t / 90);
        (core.material as THREE.ShaderMaterial).uniforms.uA.value = A * 0.55 * Math.max(0, 1 - t / 260) * fade;
        if (t >= ms) { this.drop([m, core]); return false; }
        return true;
      }, dispose: () => this.drop([m, core]),
    });
  }
  /** The glyphs' pictures (white strokes on clear, a glow under them), drawn once each. */
  private glyphTex(shape: 'star' | 'spiral' | 'runes', points: number): THREE.Texture {
    const key = `${shape}:${points}`, had = this.glyphTexs.get(key); if (had) return had;
    const S = 512, m = S / 2, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
    g.strokeStyle = '#fff'; g.fillStyle = 'rgba(255,255,255,0.22)'; g.lineJoin = 'round'; g.lineCap = 'round';
    if (shape === 'star') { // a crystal star: long facetted points, short ones between, a ring at the heart
      for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2, long = i % 2 === 0, L = S * (long ? 0.47 : 0.27), W = S * (long ? 0.055 : 0.04), mid = L * 0.38;
        const px = (d: number, s2: number) => [m + Math.cos(a) * d - Math.sin(a) * s2, m + Math.sin(a) * d + Math.cos(a) * s2];
        g.beginPath(); g.moveTo(...(px(S * 0.06, 0) as [number, number])); g.lineTo(...(px(mid, W) as [number, number])); g.lineTo(...(px(L, 0) as [number, number])); g.lineTo(...(px(mid, -W) as [number, number])); g.closePath();
        g.lineWidth = long ? 5 : 3.5; g.fill(); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(...(px(S * 0.06, 0) as [number, number])); g.lineTo(...(px(L, 0) as [number, number])); g.stroke(); // (the facet's ridge)
      }
      g.lineWidth = 5; g.beginPath(); g.arc(m, m, S * 0.085, 0, Math.PI * 2); g.stroke();
    } else if (shape === 'spiral') { // arms winding out from the heart, a ring round them
      const arms = 6;
      for (let j = 0; j < arms; j++) {
        g.beginPath();
        for (let q = 0; q <= 60; q++) { const u = q / 60, r2 = S * (0.03 + 0.43 * u), a = (j / arms) * Math.PI * 2 + u * Math.PI * 1.35; const X = m + Math.cos(a) * r2, Y = m + Math.sin(a) * r2; if (q === 0) g.moveTo(X, Y); else g.lineTo(X, Y); }
        g.lineWidth = 6; g.stroke();
      }
      g.lineWidth = 4; g.beginPath(); g.arc(m, m, S * 0.465, 0, Math.PI * 2); g.stroke();
    } else { // runes: two rings, marks between them, a rune every 30 degrees
      g.lineWidth = 5; g.beginPath(); g.arc(m, m, S * 0.46, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(m, m, S * 0.37, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r1 = S * 0.375, r2 = S * (i % 4 === 0 ? 0.455 : 0.42); g.beginPath(); g.moveTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1); g.lineTo(m + Math.cos(a) * r2, m + Math.sin(a) * r2); g.stroke(); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r1 = S * 0.27, x0 = m + Math.cos(a) * r1, y0 = m + Math.sin(a) * r1; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 - 10, y0 - 12); g.lineTo(x0 + 6, y0 - 2); g.lineTo(x0 - 6, y0 + 4); g.lineTo(x0 + 10, y0 + 12); g.stroke(); }
    }
    const c2 = document.createElement('canvas'); c2.width = c2.height = S; const g2 = c2.getContext('2d')!;
    g2.filter = 'blur(9px)'; g2.drawImage(c, 0, 0); g2.filter = 'none'; g2.drawImage(c, 0, 0);
    const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    this.glyphTexs.set(key, t);
    return t;
  }

  /** A swirl of small pictures round a vertical axis at `at()` (the Samurai's request; the reference's sparkles and paper,
   *  08 / 09): `n` of them (`look.tex`: a petal, a page, a leaf — a game texture; else a soft diamond of `color`) orbiting
   *  from radius `r0` at the floor to `r1` at height `h`, turning `rps` times a second and rising, each tumbling; lit by the
   *  room, in front of or behind the fighters by their real depth. At `ms` or when `at()` returns null they fly outward and
   *  fade. */
  swirl(at: () => V3 | null, look: CardLook, o: { n?: number; r0?: number; r1?: number; h?: number; ms?: number; rps?: number; rise?: number; size?: number; color?: number } = {}): void {
    const c0 = at(); if (!c0) return;
    this.announce('swirl', c0, (o.n ?? 40) > 50 ? 1 : 0, { color: o.color });
    const n = o.n ?? 50, ms = o.ms ?? 1600, rps = o.rps ?? 0.9, rise = o.rise ?? 0.55, color = o.color ?? 0xffffff;
    const tex = (look.tex ? this.h.texture?.(look.tex) : null) ?? this.diamondTex();
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: look.tex ? 0xffffff : color, emissive: color, emissiveIntensity: look.tex ? 0.25 : 0.6, roughness: 0.6, metalness: 0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    const back = new THREE.InstancedMesh(geo, mat, n), front = new THREE.InstancedMesh(geo, mat, n);
    back.frustumCulled = front.frustumCulled = false; back.count = front.count = 0;
    this.h.back.add(back); this.h.solid.add(front);
    const W = this.h.w3(18 * (o.size ?? look.size ?? 1)), Hh = W * (look.aspect ?? 1);
    const P = Array.from({ length: n }, () => ({ a: Math.random() * Math.PI * 2, f: Math.random(), j: 0.8 + Math.random() * 0.4, ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), sp: 3 + Math.random() * 5, out: 0.6 + Math.random() * 0.8 }));
    const r0 = this.h.w3(o.r0 ?? 50), r1 = this.h.w3(o.r1 ?? 110), H = this.h.h3(o.h ?? 180);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), X = new THREE.Vector3(), toCam = this.viewXZ().negate();
    let t = 0, end = -1, center = this.P(c0);
    this.items.push({
      step: (dt) => {
        t += dt;
        const c = end < 0 ? at() : null;
        if (c) center = this.P(c); else if (end < 0) end = t;
        if (end < 0 && t >= ms) end = t;
        const gone = end < 0 ? 0 : (t - end) / 380; // (flung outward and fading)
        if (gone >= 1) { this.h.back.remove(back); this.h.solid.remove(front); back.dispose(); front.dispose(); geo.dispose(); mat.dispose(); return false; }
        const grow = Math.min(1, t / 260) * (1 - gone);
        let nb = 0, nf = 0;
        for (const q of P) {
          const f = (q.f + (rise * t) / 1000) % 1, a = q.a + Math.PI * 2 * rps * q.j * (t / 1000), r = (r0 + (r1 - r0) * f) * (1 + gone * q.out * 1.6);
          X.set(center.x + Math.cos(a) * r, center.y + H * f + gone * 0.3, center.z + Math.sin(a) * r);
          Q.setFromAxisAngle(q.ax, (q.sp * t) / 1000); S.set(W * grow, Hh * grow, 1);
          M.compose(X, Q, S);
          const inFront = (X.x - center.x) * toCam.x + (X.z - center.z) * toCam.z > 0;
          if (inFront) front.setMatrixAt(nf++, M); else back.setMatrixAt(nb++, M);
        }
        back.count = nb; front.count = nf; back.instanceMatrix.needsUpdate = true; front.instanceMatrix.needsUpdate = true;
        return true;
      }, dispose: () => { this.h.back.remove(back); this.h.solid.remove(front); back.dispose(); front.dispose(); geo.dispose(); mat.dispose(); },
    });
  }
  private streakTex?: THREE.Texture;
  /** A white speed line lying on the floor from (x0, y0) to (x1, y1) (world px): behind a dash or a sprint (the reference's
   *  hammer girl, 53.8 s), soft at its edges, fading toward its tail and gone in `ms`. */
  floorStreak(x0: number, y0: number, x1: number, y1: number, color = 0xffffff, o: { w?: number; ms?: number; a?: number } = {}): void {
    const ax = this.h.w3(x0), az = this.h.d3(y0), bx = this.h.w3(x1), bz = this.h.d3(y1), L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-4) return;
    const ms = o.ms ?? 170, A = o.a ?? 0.55;
    const m = new THREE.Mesh(this.planeGeo, this.mat(KIND.decal, color, { i: 1.25, map: this.lineTex() }));
    m.position.set((ax + bx) / 2, 0.016, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); m.scale.set(L, 1, this.h.w3(o.w ?? 7)); this.h.back.add(m);
    let t = 0;
    this.items.push({
      step: (dt) => { t += dt; (m.material as THREE.ShaderMaterial).uniforms.uA.value = A * Math.max(0, 1 - t / ms); if (t >= ms) { this.drop([m]); return false; } return true; },
      dispose: () => this.drop([m]),
    });
  }
  /** A line's picture: bright along its middle, soft at its edges, its head (right) bright and its tail (left) faint. */
  private lineTex(): THREE.Texture {
    if (this.streakTex) return this.streakTex;
    const W = 128, H = 16, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    for (let x = 0; x < W; x++) { const along = Math.pow(x / (W - 1), 1.6); for (let y = 0; y < H; y++) { const d = Math.abs(y - (H - 1) / 2) / ((H - 1) / 2); g.fillStyle = `rgba(255,255,255,${(along * Math.max(0, 1 - d * d)).toFixed(3)})`; g.fillRect(x, y, 1, 1); } }
    this.streakTex = new THREE.CanvasTexture(c); this.streakTex.colorSpace = THREE.NoColorSpace;
    return this.streakTex;
  }
  private diamond?: THREE.Texture;
  /** A soft four-sided sparkle (white), the swirl's piece when it has no picture. */
  private diamondTex(): THREE.Texture {
    if (this.diamond) return this.diamond;
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!, m = S / 2;
    const gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(m, 2); g.lineTo(S - 14, m); g.lineTo(m, S - 2); g.lineTo(14, m); g.closePath(); g.fill();
    this.diamond = new THREE.CanvasTexture(c); this.diamond.colorSpace = THREE.SRGBColorSpace;
    return this.diamond;
  }

  /** A trail behind what flies (by projectile), drawn until it ends. */
  trail(p: Projectile, color: number, w = 12, len = 14, i = 2): void {
    if (this.follows.has(p)) return;
    const s = new Strip(len, this.mat(KIND.strip, color, { i }), w / 100), at = { x: p.x, y: p.y, z: p.z };
    this.h.back.add(s.mesh); s.tail(1.6);
    this.follows.set(p, { trail: s, last: at });
  }
  private crestFor(p: Projectile, color: number, h: number, w: number): void {
    const f = this.follows.get(p) ?? { last: { x: p.x, y: p.y, z: p.z } };
    f.crest = new Crest(this, color, this.h.w3(w), this.h.h3(h)); this.follows.set(p, f);
  }

  // ------------------------------------------------------------------ the runtime's events

  private recipe(s: FinalSkill): Recipe { return R[s.id] ?? {}; }
  private color(s: FinalSkill): number { return this.recipe(s).tone ?? CLS[s.cls] ?? 0xffffff; }
  /** The colour the room lights a blow of this skill in (its recipe's tone, else the class colour). */
  tone(s: FinalSkill): number | undefined { return this.recipe(s).tone; }

  cast(r: CastRun): void { this.recipe(r.skill).cast?.(this, r); }
  active(r: CastRun): void { this.recipe(r.skill).active?.(this, r); }
  fired(r: CastRun, i: number, o: V3): void { this.recipe(r.skill).fired?.(this, r, i, o); }
  chain(r: CastRun, o: V3, target: V3 | null): void {
    const c = this.recipe(r.skill).chainBolt; if (c === undefined || !target) return;
    this.bolt({ x: o.x, y: o.y, z: o.z + 70 }, { x: target.x, y: target.y, z: target.z + 70 }, c, { ms: 240, w: 9, forks: 2, hue: true });
  }
  projectile(p: Projectile): void {
    const rc = this.recipe(p.skill);
    rc.shot?.(this, p);
    if (rc.crest) this.crestFor(p, rc.crest.c, rc.crest.h, rc.crest.w);
    if (rc.trail !== false) { const t = rc.trail ?? { c: this.color(p.skill), w: 10 }; this.trail(p, t.c, t.w, t.len ?? 14, t.i ?? 2); }
    if (!this.follows.has(p)) this.follows.set(p, { last: { x: p.x, y: p.y, z: p.z } }); // (a shot with no trail and no crest is known too: it was handed to `shot` again every frame — the Samurai chat's Sword Wave stacked ~11 crescents)
  }

  /** A confirmed hit at the foe: the recipe's own, and the room's default for the main hit by its weight. */
  hit(s: FinalSkill, h: HitEvent, at: V3, main: boolean, react: string, big: 0 | 1 | 2): void {
    const rc = this.recipe(s), col = this.color(s);
    rc.hit?.(this, s, h, at, main, react);
    // the reference's main hit on every skill (DAVID 21:45): a white flash bigger than the body, the blow's colour bursting
    // out, the floor cracking under him (when he is on it), embers rising — unless its recipe just laid its own there
    const L = this.lastImpact, laid = this.clock - L.t < 260 && Math.hypot(L.x - at.x, L.y - at.y) < 140;
    if (main && !laid && !rc.noImpact) this.impact(at, col, { r: [46, 62, 90][big], embers: [8, 12, 20][big], cracks: at.z < 70 && react !== 'launch' && react !== 'float', paint: rc.paint });
    if (rc.own || !main) return;
    if (big === 2) { this.pillar(at.x, at.y, col, { h: 640, r: 48, ms: 640 }); this.crack(at.x, at.y, col, { r: 150, chunks: 16 }); return; }
    if (react === 'launch') this.pillar(at.x, at.y, col, { h: 360, r: 24, ms: 380, core: false });
  }
  /** Where and when the last impact() went off (a recipe's own main hit: the shared one is not laid over it). */
  private lastImpact = { x: 0, y: 0, t: -1e9 };

  // ------------------------------------------------------------------ cards: real cards in the room (the Gambler's deck)

  /** A card thrown from `from` (world px; z = its height) to the floor point `to`, where it lies — flat, face down, or
   *  `stuck` at a slant in the planks — with a soft shadow under it, lit by the room; a faint glint now and then says it
   *  can be taken back. It lies `life` ms (default 12000), then crumbles. `key`: its name, to gather / drop it later. */
  cardLay(key: string, from: V3, to: { x: number; y: number }, o: { ms?: number; stuck?: boolean; life?: number; delay?: number; look?: CardLook } = {}): void { this.cards.lay(key, from, to, o); }
  /** The cards named rise off the floor and fly back to `to()` (his hand: world px), spinning, one after another
   *  (`gap` ms apart, nearest first), each in `ms`; gone into the hand with a glint. `done(n)`: called as each arrives. */
  cardGather(keys: string[], to: () => V3 | null, o: { ms?: number; gap?: number; done?: (n: number) => void } = {}): void { this.cards.gather(keys, to, o); }
  /** Cards lying within `r` px of (x, y) hop and settle (a blow landing near them). */
  cardFlutter(x: number, y: number, r: number): void { this.cards.flutter(x, y, r); }
  /** A card spent or its time up: it crumbles away (gold embers). */
  cardDrop(key: string): void { this.cards.drop(key); }
  /** The keys of the cards lying now (for a check; the game's own count is its logic, not this). */
  cardKeys(): string[] { return this.cards.keys(); }
  /** A big card spinning flat like a saw blade, held at `at()` (world px, z = its height) until that returns null, then it
   *  flares out: the thrown card riding its shot, the card spinning under a held foe. `size`: × a card (default 2.4);
   *  `color`: its glow; `tilt` (rad, default 0.6): tipped toward the camera so its face reads; `rps` (default 5) its turns a second — faster blurs it into a disc. Half in front of the fighters, half behind. */
  cardSpin(at: () => V3 | null, o: { size?: number; color?: number; tilt?: number; rps?: number; look?: CardLook } = {}): void { this.cards.spin(at, o); }

  /** A turn of a hold that follows its foe (`linger.at: 'target'`): the skill's recipe draws it (`tick`). */
  tick(r: CastRun, at: V3, i: number, last: boolean): void { this.recipe(r.skill).tick?.(this, r, at, i, last); }

  /** Each frame: the effects run; trails and crests follow what flies. */
  update(ms: number, flying: Projectile[]): void {
    this.clock += ms;
    if (this.timers.length) { const due = this.timers.filter((x) => x.at <= this.clock); this.timers = this.timers.filter((x) => x.at > this.clock); for (const d of due) d.fn(); }
    { const cur = this.items; this.items = []; const kept = cur.filter((it) => it.step(ms)); this.items = kept.concat(this.items); } // (a piece made inside another piece's step lands in the fresh list and is kept: it was dropped — the Samurai chat's report)
    for (const c of this.chunks) c.step(ms);
    for (const c of this.ice) c.step(ms);
    for (const c of this.rock) c.step(ms);
    this.deck?.step(ms);
    // what flies: each new one gets its trail / crest; each one gone lets its trail shrink away
    for (const p of flying) if (!this.follows.has(p) && !p.done) this.projectile(p);
    for (const [p, f] of this.follows) {
      const alive = !p.done && flying.includes(p);
      if (alive) {
        f.last = { x: p.x, y: p.y, z: p.z };
        const P = this.P(f.last); P.y += 0.62; // (a shot flies at the chest)
        if (f.trail) f.trail.push(P, this.h.camera);
        if (f.crest) { const dx = p.dx, dy = p.dy; f.crest.at(this.h.w3(p.x), this.h.d3(p.y), Math.atan2(dx, dy * 1.15), 1); f.crest.step(ms); }
      } else {
        if (f.trail && f.trail.fade(ms)) { f.trail.dispose(); f.trail = undefined; }
        if (f.crest) { f.crest.dispose(); f.crest = undefined; }
        if (!f.trail && !f.crest) this.follows.delete(p);
      }
    }
    if ((this.ttl += ms) > 30000) { this.ttl = 0; } // (nothing to age: kept for a steady clock)
  }

  // ------------------------------------------------------------------ for the pieces built outside this file (fx3d/pieces.ts)

  /** A piece built outside this file: stepped every frame (ms) until its step returns false; disposed on a reset. */
  spawn(it: { step(ms: number): boolean; dispose(): void }): void { this.items.push(it); }
  /** Room units (THREE: x along, y up, z depth) of a world point (px: x along, y depth on the floor, z height). */
  unit(at: V3): THREE.Vector3 { return this.P(at); }
  /** A reference piece announced for its sound (see FxPieceRef). */
  note(kind: FxPieceRef, at: V3, size: number, o?: { color?: number; accent?: boolean }): void { this.announce(kind, at, size, o); }
  /** One of the shared shader kinds (KIND) as a material; see mat(). */
  kind(k: keyof typeof KIND): number { return KIND[k]; }
  /** One mesh split round the fighters (its part behind depth hz in the room, the part in front over them): see both(). */
  split(geo: THREE.BufferGeometry, k: keyof typeof KIND, color: number, hz: number, o: { i?: number; a?: number; map?: THREE.Texture } = {}): THREE.Mesh[] { return this.both(geo, KIND[k], color, hz, o); }
  /** Meshes taken out of the room and their materials freed (`ownGeo`: their geometry too). */
  remove(ms: THREE.Mesh[], ownGeo = false): void { this.drop(ms, ownGeo); }
  /** A uniform set on every mesh given. */
  uniform(ms: THREE.Mesh[], k: string, v: number): void { this.setU(ms, k, v); }
  /** The shared flat square (1 x 1, lying on the floor) and the soft white disc picture. */
  get floorQuad(): THREE.BufferGeometry { return this.planeGeo; }
  get softDisc(): THREE.Texture { return this.disc; }
  /** The effects' own clock (ms): it runs with the room (hit-stop and slow motion keep in step). */
  get now(): number { return this.clock; }

  /** The camera's turn round the vertical (rad): a slash plane faces across the view. */
  camYaw(): number { const f = new THREE.Vector3(); this.h.camera.getWorldDirection(f); return Math.atan2(-f.x, -f.z); }
  get host(): FxHost { return this.h; }
  /** Painted art in the room (David 18 Oct 20:51: a free hand in GPT and PixVerse): a frame sheet — a GPT sheet, a PixVerse
   *  effect made into frames (tools/fx/flipbook.py) — played upright at a point or flat on the floor, its colours covering
   *  the planks (see pieces.ts `flip`). `src`: a texture key the class preloads, or a url ('assets/…'). */
  flip(src: string, at: V3 | (() => V3 | null), o: FlipOpts): { end(): void } { return flipPiece(this, src, at, o); }
  /** A flip sheet by url loaded ahead of its first use. */
  flipLoad(src: string): void { flipPreload(this, src); }
  get noiseTex(): THREE.Texture { return this.noise; }

  /** Everything compiled up front (no hitch at the first cast): one of each piece drawn once, out of sight. */
  warm(renderer: THREE.WebGLRenderer): void {
    flipPreload(this, IMPACT_SHEET); // (the main hit's painted burst, in before the first blow)
    const tmp: THREE.Object3D[] = [];
    for (const k of Object.values(KIND)) for (const clip of [null, this.cut(0, false), this.cut(0, true)]) {
      const m = new THREE.Mesh(this.planeGeo, this.mat(k, 0xffffff, { clip: clip ?? undefined })); m.position.set(0, -50, 0); tmp.push(m); this.h.back.add(m);
      const m2 = new THREE.Mesh(this.planeGeo, this.mat(k, 0xffffff, { clip: clip ?? undefined })); m2.position.set(0, -50, 0); tmp.push(m2); this.h.glow.add(m2);
    }
    try { renderer.compile(this.h.back, this.h.camera); renderer.compile(this.h.glow, this.h.camera); renderer.compile(this.h.solid, this.h.camera); } catch { /* (compiled on first use instead) */ }
    for (const m of tmp) { m.parent?.remove(m); ((m as THREE.Mesh).material as THREE.Material).dispose(); }
    warmPieces(this, renderer); // (the second set's shaders too: fx3d/pieces.ts)
  }

  dispose(): void {
    for (const it of this.items) it.dispose();
    this.items = []; this.timers = [];
    for (const f of this.follows.values()) { f.trail?.dispose(); f.crest?.dispose(); }
    this.follows.clear();
    for (const c of this.chunks) c.dispose();
    for (const c of this.ice) c.dispose();
    for (const c of this.rock) c.dispose();
    this.deck?.dispose(); this.deck = null;
    this.noise.dispose(); this.disc.dispose(); for (const [a, b] of this.cracks) { a.dispose(); b.dispose(); }
    this.pillarGeo.dispose(); this.domeGeo.dispose(); this.planeGeo.dispose();
  }
}

/** Two sRGB hex colours mixed (t: 0 = a, 1 = b). */
export function mix(a: number, b: number, t: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

// ------------------------------------------------------------------ building blocks

/** A ribbon through a run of points, turned to face the camera (trails, bolts, streaks): u along (0 tail → 1 head). */
class Strip {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private pts: THREE.Vector3[] = [];
  private fadeLeft = 1;
  constructor(private n: number, private m: THREE.ShaderMaterial, private w: number) {
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array((n + 1) * 2 * 3);
    const uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
    for (let i = 0; i <= n; i++) { uv.set([i / n, 0, i / n, 1], i * 4); if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 3).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.visible = false;
  }
  uA(a: number): void { this.m.uniforms.uA.value = a; }
  tail(p: number): void { this.m.uniforms.uTail.value = p; }
  /** The ribbon along these points (spread evenly over its n segments); `trail` 1 thins it to the tail (0: even). */
  set(pts: THREE.Vector3[], cam: THREE.Camera, trail = 0): void {
    if (pts.length < 2) { this.mesh.visible = false; return; }
    const n = this.n, view = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), k = f - j;
      const p = pts[j].clone().lerp(pts[j + 1], k);
      tan.copy(pts[j + 1]).sub(pts[j]); if (tan.lengthSq() < 1e-10) tan.set(1, 0, 0);
      view.copy(cam.position).sub(p);
      side.crossVectors(tan, view).normalize().multiplyScalar(this.w * 0.5 * (trail ? 0.15 + 0.85 * (i / n) : 1));
      this.pos.set([p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z], i * 6);
    }
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.mesh.visible = true;
  }
  /** A trail: the head moves on; the oldest points drop off. */
  push(p: THREE.Vector3, cam: THREE.Camera): void {
    this.pts.push(p.clone()); if (this.pts.length > this.n) this.pts.shift();
    this.set(this.pts, cam, 1); this.uA(1);
  }
  /** After the shot is gone: the trail shrinks into its head and fades; true when done. */
  fade(ms: number): boolean {
    this.fadeLeft -= ms / 220; if (this.pts.length > 2) this.pts.shift();
    this.uA(Math.max(0, this.fadeLeft));
    return this.fadeLeft <= 0;
  }
  dispose(): void { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.m.dispose(); }
}

/** A crest of light standing on the floor (an arc of a wall, turned to face where it runs), split round the fighters. */
class Crest {
  private ms: THREE.Mesh[];
  private geo: THREE.BufferGeometry;
  private t = 0;
  private cutB: THREE.Plane[]; private cutF: THREE.Plane[];
  constructor(private f: Fx3D, color: number, private w: number, h: number) {
    this.geo = new THREE.CylinderGeometry(w, w, h, 28, 1, true, -Math.PI * 0.32, Math.PI * 0.64).translate(0, h / 2, 0);
    this.cutB = f.cut(0, false); this.cutF = f.cut(0, true);
    const m1 = new THREE.Mesh(this.geo, f.mat(KIND.wave, color, { i: 1.5, clip: this.cutB })), m2 = new THREE.Mesh(this.geo, f.mat(KIND.wave, color, { i: 1.5, clip: this.cutF }));
    m1.frustumCulled = m2.frustumCulled = false;
    f.host.back.add(m1); f.host.glow.add(m2);
    this.ms = [m1, m2];
  }
  /** Where it is (units on the floor), which way it runs (rad round the vertical) and how strong. */
  at(hx: number, hz: number, yaw: number, a: number): void {
    // the arc's middle (local +z) turned to where it runs, its apex on the point
    for (const m of this.ms) { m.position.set(hx - Math.sin(yaw) * this.w, 0.02, hz - Math.cos(yaw) * this.w); m.rotation.set(0, yaw, 0); }
    // the half behind the plane through it (across the view) in the room, the half in front over the fighters
    const v = this.f.viewXZ(), p = new THREE.Vector3(hx, 0, hz);
    this.cutB[0].setFromNormalAndCoplanarPoint(v, p); this.cutF[0].setFromNormalAndCoplanarPoint(v.clone().negate(), p);
    for (const m of this.ms) (m.material as THREE.ShaderMaterial).uniforms.uA.value = a;
  }
  step(ms: number): void { this.t += ms; for (const m of this.ms) (m.material as THREE.ShaderMaterial).uniforms.uT.value = this.t / 1000; }
  dispose(): void { for (const m of this.ms) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } this.geo.dispose(); }
}

/** Chunks of the floor flying and bouncing (one instanced draw per layer): wood over the planks, stone round them. */
class Chunks {
  private mesh: THREE.InstancedMesh;
  private p: Float32Array; private v: Float32Array; private ax: Float32Array; private life: Float32Array; private size: Float32Array; private spin: Float32Array; private ang: Float32Array;
  private next = 0;
  private live = 0;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Vector3(); private s = new THREE.Vector3(); private t = new THREE.Vector3();
  constructor(scene: THREE.Scene, private n: number) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 });
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.mesh.count = n;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.ax = new Float32Array(n * 3); this.life = new Float32Array(n);
    this.size = new Float32Array(n); this.spin = new Float32Array(n); this.ang = new Float32Array(n);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, zero); this.mesh.setColorAt(i, new THREE.Color(0x6a4430)); }
    scene.add(this.mesh);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number): void {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    const a = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); this.ax.set([a.x, a.y, a.z], i * 3);
    this.life[i] = 1300 + Math.random() * 700; this.size[i] = size; this.spin[i] = (Math.random() - 0.5) * 22; this.ang[i] = Math.random() * 6;
    const wood = Math.abs(z) < 50; // (all of the floor is planks; a few stone grains)
    this.mesh.setColorAt(i, new THREE.Color(wood && Math.random() < 0.8 ? [0x6b4430, 0x8a5a3a, 0x4a2e20, 0x7a4e30][i % 4] : [0x8c8782, 0x6e6a66][i % 2]));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.live = Math.max(this.live, 1);
  }
  step(ms: number): void {
    if (!this.live) return;
    const dt = ms / 1000; let any = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any++; this.life[i] -= ms;
      const j = i * 3;
      this.v[j + 1] -= 12.5 * dt;
      this.p[j] += this.v[j] * dt; this.p[j + 1] += this.v[j + 1] * dt; this.p[j + 2] += this.v[j + 2] * dt;
      const floorY = this.size[i] * 0.6;
      if (this.p[j + 1] < floorY) { this.p[j + 1] = floorY; if (this.v[j + 1] < 0) this.v[j + 1] *= -0.34; this.v[j] *= 0.62; this.v[j + 2] *= 0.62; this.spin[i] *= 0.55; }
      this.ang[i] += this.spin[i] * dt;
      const k = Math.min(1, this.life[i] / 350), sz = this.size[i] * (this.life[i] > 0 ? k : 0);
      this.q.setFromAxisAngle(this.e.set(this.ax[j], this.ax[j + 1], this.ax[j + 2]), this.ang[i]);
      this.m4.compose(this.t.set(this.p[j], this.p[j + 1], this.p[j + 2]), this.q, this.s.set(sz * 1.6, sz * 0.6, sz));
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!any) { this.live = 0; const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, zero); this.mesh.instanceMatrix.needsUpdate = true; }
  }
  dispose(): void { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

/** Ice crystals (hexagonal spikes, glassy, reflecting the room): grow out of the floor, stand, then shrink away. */
class Crystals {
  private mesh: THREE.InstancedMesh;
  private d: { x: number; z: number; a: number; tilt: number; h: number; r: number; t: number; ms: number; delay: number; spin: number; key?: string }[] = [];
  /** (David 18 Oct 18:19: the spikes popped in and out — "binary") they thrust up out of the planks over RISE ms, overshooting a
   *  touch, and crumble back down into them over OUT ms with a shudder. */
  private static RISE = 300; private static OUT = 380;
  private next = 0;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private s = new THREE.Vector3(); private t = new THREE.Vector3();
  constructor(scene: THREE.Scene, private n: number, stone = false) {
    // ice: clear blue crystals that glint; stone: faceted grey-brown rock spikes with a faint ember at heart (no shine)
    const geo = new THREE.ConeGeometry(1, 1, stone ? 7 : 6, stone ? 4 : 1).translate(0, 0.5, 0);
    if (stone) { // a broken rock shard, not a cone: its rings knocked in and out, a wider rubble foot, a slight bend (the seams' twin vertices moved alike)
      const P = geo.attributes.position, h3 = (x: number, y: number, z: number) => { const v = Math.sin(Math.round(x * 97) * 12.9898 + Math.round(y * 97) * 78.233 + Math.round(z * 97) * 37.719) * 43758.5453; return v - Math.floor(v); };
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y > 0.999) continue;
        const k = 0.72 + 0.56 * h3(x, y, z), foot = y < 0.01 ? 1.3 : 1;
        P.setXYZ(i, x * k * foot + 0.14 * y * y, y * (0.93 + 0.14 * h3(z, x, y)), z * k * foot);
      }
      geo.computeVertexNormals();
    }
    const mat = stone
      ? new THREE.MeshStandardMaterial({ color: 0x7a6a58, emissive: 0x3a1206, emissiveIntensity: 0.35, roughness: 0.95, metalness: 0, flatShading: true })
      : new THREE.MeshStandardMaterial({ color: 0xd8f4ff, emissive: 0x2d8fe0, emissiveIntensity: 0.75, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.86, envMapIntensity: 2.4, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, zero); this.d.push({ x: 0, z: 0, a: 0, tilt: 0, h: 0, r: 0, t: 0, ms: 0, delay: 0, spin: 0 }); }
    scene.add(this.mesh);
  }
  emit(x: number, z: number, a: number, tilt: number, h: number, r: number, ms: number, delay: number, key?: string): void {
    const i = this.next; this.next = (this.next + 1) % this.n;
    Object.assign(this.d[i], { x, z, a, tilt, h, r, t: -delay, ms: Math.max(ms, Crystals.RISE + Crystals.OUT + 60), key, spin: Math.random() * Math.PI * 2 });
  }
  /** The crystals of `key` go now: those standing sink away in 160 ms, those not yet up never rise. */
  drop(key: string): void {
    for (const c of this.d) if (c.key === key && c.ms > 0) { if (c.t <= 0) c.ms = 0.0001; else if (c.t < c.ms - 180) c.ms = c.t + 180; } // (burst: the quick end of the crumble)
  }
  step(dt: number): void {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const c = this.d[i]; if (c.ms <= 0) continue;
      c.t += dt; any = true;
      let hk = 0, rk = 0, y = 0, wob = 0;
      const R = Crystals.RISE, O = Crystals.OUT;
      if (c.t > 0) {
        if (c.t < R) { const g = c.t / R, e = outBack(g); hk = 0.55 + 0.45 * e; rk = 0.82 + 0.18 * Math.min(1, e); y = -c.h * (1 - Math.min(1, e)) * 0.75; } // thrust up out of the planks
        else if (c.t > c.ms - O) { const u = Math.min(1, (c.t - (c.ms - O)) / O), e = u * u; hk = 1 - 0.3 * e; rk = 1 - 0.25 * e; y = -c.h * e * 1.05; wob = Math.sin(u * 19) * 0.07 * (1 - u); } // crumbles back down, shuddering
        else { hk = 1; rk = 1; }
      }
      if (c.t >= c.ms) { c.ms = 0; hk = 0; }
      // tipped outward from the cluster's middle (round the floor's vertical), each turned its own way
      this.eu.set(Math.sin(c.a) * c.tilt * 0.8 + wob, c.spin, -Math.cos(c.a) * c.tilt - wob, 'XYZ'); this.q.setFromEuler(this.eu);
      this.m4.compose(this.t.set(c.x, y, c.z), this.q, this.s.set(c.r * rk, c.h * hk, c.r * rk));
      this.mesh.setMatrixAt(i, this.m4);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

// ------------------------------------------------------------------ cards in the room

/** What a piece of the deck looks like: by default the Gambler's card (his painted back on top, a painted face below,
 *  gilt edges). Any other picture lies, flies back and spins the same way: `tex` (the game's texture key, both sides
 *  unless `face`), `size` (× a card, 24 px wide), `aspect` (length / width, card 1.37), `edge` (the rim's colour; the card's
 *  gilt by default) — the samurai's fallen petals, the mage's torn pages. */
export interface CardLook { tex?: string; face?: string; size?: number; aspect?: number; edge?: number; /** how it goes when its time is up: embers of a colour (default gold), or 'wind' — lifted and carried off (petals, pages) */ crumble?: number | 'wind' }

/** One card: its place (units: x across, y up, z depth), its turn, and what it is doing. */
interface Card3 {
  key: string; mode: 'fly' | 'lie' | 'rise' | 'home' | 'crumble';
  x: number; y: number; z: number; yaw: number; roll: number; pitch: number;
  ax: number; ay: number; az: number; bx: number; bz: number;
  t: number; ms: number; delay: number; spin: number; stuck: number; life: number; hop: number; glint: number;
  to?: () => V3 | null; done?: () => void; layer: 0 | 1; sw: number; sl: number; crumble?: number | 'wind';
  mesh: THREE.Mesh; shadow: THREE.Mesh; mats: THREE.MeshStandardMaterial[];
}
/** The big spinning card. */
interface Spin3 { at: () => V3 | null; meshes: THREE.Mesh[]; planes: THREE.Plane[][]; mats: THREE.MeshStandardMaterial[]; glow: THREE.Mesh[]; size: number; tilt: number; rps: number; a: number; out: number; color: number; last: THREE.Vector3; t: number }

/** The Gambler's cards as real cards in the room: thin boxes with the painted back on top and a painted face below, gold
 *  edges, a soft shadow on the planks; lying ones in the room (under the fighters), flying ones over or behind the fighters
 *  by their depth; the big spinning card split round its own depth (half over the fighter it holds, half behind him). */
class Deck3 {
  private geo = new THREE.BoxGeometry(1, 1, 1);
  private shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private shadowTex: THREE.Texture;
  private glowTex: THREE.Texture;
  private all: Card3[] = [];
  private spins: Spin3[] = [];
  private W: number; private L: number; private T: number;
  private v = new THREE.Vector3();
  constructor(private h: FxHost) {
    this.W = h.w3(24); this.L = this.W * 1.37; this.T = h.w3(1.1);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shadowTex = new THREE.CanvasTexture(c);
    const c2 = document.createElement('canvas'); c2.width = c2.height = 64;
    const g2 = c2.getContext('2d')!, gr2 = g2.createRadialGradient(32, 32, 10, 32, 32, 31);
    gr2.addColorStop(0, 'rgba(255,255,255,0)'); gr2.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr2.addColorStop(0.8, 'rgba(255,255,255,0.25)'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr2; g2.fillRect(0, 0, 64, 64);
    this.glowTex = new THREE.CanvasTexture(c2); // (a ring of light: the spin's blurred edge)
  }
  private tex(key: string): THREE.Texture | null { return this.h.texture?.(key) ?? null; }
  /** A card's three materials: the painted back (top), a painted face (bottom), the gilt edge. */
  private materials(look?: CardLook): THREE.MeshStandardMaterial[] {
    const back = look?.tex ? this.tex(look.tex) : this.tex('gbk-card_back') ?? this.tex('gb-back');
    const face = look?.tex ? this.tex(look.face ?? look.tex) : this.tex(Math.random() < 0.5 ? 'gbk-card_S' : 'gbk-card_H') ?? this.tex('gb-face');
    const m = (map: THREE.Texture | null, color: number) => new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : color, roughness: 0.42, metalness: 0.12, emissive: 0x2a0d3c, emissiveIntensity: 0.22, transparent: true, alphaTest: 0.35 });
    const edge = new THREE.MeshStandardMaterial({ color: look?.edge ?? 0xe0b860, roughness: 0.3, metalness: look?.tex ? 0 : 0.7, emissive: look?.tex ? 0x000000 : 0x5a3a08, emissiveIntensity: 0.3, transparent: true, opacity: look?.tex && look.edge === undefined ? 0 : 1 });
    return [m(back, 0x5a2a7a), m(face, 0xf2ead8), edge];
  }
  private makeCard(key: string, look?: CardLook): Card3 {
    const mats = this.materials(look), sw = this.W * (look?.size ?? 1), sl = sw * (look?.aspect ?? 1.37);
    // box faces: +x, -x, +y (top: the back), -y (bottom: the face), +z, -z
    const mesh = new THREE.Mesh(this.geo, [mats[2], mats[2], mats[0], mats[1], mats[2], mats[2]]);
    mesh.scale.set(sw, this.T, sl); mesh.frustumCulled = false;
    const shadow = new THREE.Mesh(this.shadowGeo, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
    shadow.scale.set(sw * 1.7, 1, sl * 1.5); shadow.frustumCulled = false; shadow.renderOrder = -1;
    this.h.back.add(mesh); this.h.back.add(shadow);
    return { key, mode: 'fly', x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, ax: 0, ay: 0, az: 0, bx: 0, bz: 0, t: 0, ms: 1, delay: 0, spin: 0, stuck: 0, life: 12000, hop: 0, glint: Math.random() * 4000, layer: 0, sw, sl, crumble: look?.crumble, mesh, shadow, mats };
  }
  lay(key: string, from: V3, to: { x: number; y: number }, o: { ms?: number; stuck?: boolean; life?: number; delay?: number; look?: CardLook }): void {
    this.drop(key);
    const c = this.makeCard(key, o.look), h = this.h;
    Object.assign(c, { mode: 'fly', ax: h.w3(from.x), ay: h.h3(from.z), az: h.d3(from.y), bx: h.w3(to.x), bz: h.d3(to.y), t: 0, ms: o.ms ?? 420, delay: o.delay ?? 0,
      spin: (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 7), stuck: o.stuck ? (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1) : 0, life: o.life ?? 12000, yaw: Math.random() * Math.PI * 2 });
    c.x = c.ax; c.y = c.ay; c.z = c.az; c.mesh.visible = c.delay <= 0;
    this.all.push(c);
  }
  gather(keys: string[], to: () => V3 | null, o: { ms?: number; gap?: number; done?: (n: number) => void }): void {
    const p = to(); if (!p) return;
    const hx = this.h.w3(p.x), hz = this.h.d3(p.y);
    const list = this.all.filter((c) => keys.includes(c.key) && (c.mode === 'lie' || c.mode === 'fly')).sort((a, b) => Math.hypot(a.x - hx, a.z - hz) - Math.hypot(b.x - hx, b.z - hz));
    let n = 0;
    list.forEach((c, i) => {
      if (c.mode === 'fly') { c.x = c.bx; c.z = c.bz; c.y = 0; }
      Object.assign(c, { mode: 'rise', t: 0, ms: 110, delay: i * (o.gap ?? 22), to, ax: c.x, ay: c.y, az: c.z, spin: (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 10),
        done: () => { n++; o.done?.(n); } });
    });
    for (const c of list) (c as { homeMs?: number }).homeMs = o.ms ?? 300;
  }
  flutter(x: number, y: number, r: number): void {
    const hx = this.h.w3(x), hz = this.h.d3(y), R = this.h.w3(r);
    for (const c of this.all) if (c.mode === 'lie' && Math.hypot(c.x - hx, c.z - hz) <= R) c.hop = 320;
  }
  drop(key: string): void { for (const c of this.all) if (c.key === key && c.mode !== 'crumble') { c.mode = 'crumble'; c.t = 0; c.ms = 420; c.delay = 0; } }
  keys(): string[] { return this.all.filter((c) => c.mode === 'lie').map((c) => c.key); }
  spin(at: () => V3 | null, o: { size?: number; color?: number; tilt?: number; rps?: number; look?: CardLook }): void {
    const size = o.size ?? 2.4, mats = this.materials(o.look), color = o.color ?? 0xffd27a;
    for (const m of mats) { m.emissiveIntensity = 0.55; m.side = THREE.DoubleSide; }
    const planes: THREE.Plane[][] = [[new THREE.Plane()], [new THREE.Plane(), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)]];
    const meshes = [0, 1].map((k) => {
      const ms = mats.map((m) => { const c = m.clone(); c.clippingPlanes = planes[k]; return c; });
      const mesh = new THREE.Mesh(this.geo, [ms[2], ms[2], ms[0], ms[1], ms[2], ms[2]]);
      mesh.scale.set(this.W * size, this.T * 1.6, this.L * size); mesh.frustumCulled = false;
      (k ? this.h.solid : this.h.back).add(mesh);
      return mesh;
    });
    for (const m of mats) m.dispose();
    // a ring of light round its edge (the spin's blur): additive discs in both layers
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: this.glowTex });
    const glow = [0, 1].map((k) => { const g = new THREE.Mesh(this.shadowGeo, glowMat.clone()); (g.material as THREE.MeshBasicMaterial).clippingPlanes = planes[k]; g.frustumCulled = false; (k ? this.h.glow : this.h.back).add(g); return g; });
    glowMat.dispose();
    this.spins.push({ at, meshes, planes, mats: meshes.flatMap((m) => m.material as THREE.MeshStandardMaterial[]).filter((m, i, a) => a.indexOf(m) === i), glow, size, tilt: o.tilt ?? 0.6, rps: o.rps ?? 5, a: 0, out: -1, color, last: new THREE.Vector3(), t: 0 });
  }
  private place(c: Card3): void {
    c.mesh.position.set(c.x, c.y + this.T / 2 + (c.stuck && c.mode === 'lie' ? Math.abs(Math.sin(c.stuck)) * c.sl * 0.32 : 0), c.z);
    c.mesh.rotation.set(c.pitch, c.yaw, c.roll, 'YXZ');
    const up = Math.max(0, c.y), k = Math.max(0, 1 - up / 1.6);
    c.shadow.position.set(c.x, 0.004, c.z); c.shadow.rotation.y = c.yaw;
    (c.shadow.material as THREE.MeshBasicMaterial).opacity = (c.mode === 'crumble' ? Math.max(0, 1 - c.t / c.ms) : 1) * 0.55 * k * (c.mesh.visible ? 1 : 0);
  }
  /** Over or behind the fighters: a flying card in front of the depth it flies from / to goes over them. */
  private layer(c: Card3, refZ: number): void {
    const want: 0 | 1 = c.z > refZ + 0.05 && c.y > 0.05 ? 1 : 0;
    if (want === c.layer) return;
    c.layer = want; c.mesh.parent?.remove(c.mesh); (want ? this.h.solid : this.h.back).add(c.mesh);
  }
  step(ms: number): void {
    const dt = ms / 1000;
    for (const c of this.all) {
      if (c.delay > 0) { c.delay -= ms; if (c.delay > 0) { if (c.mode === 'fly') c.mesh.visible = false; continue; } }
      c.mesh.visible = true; c.t += ms;
      const u = Math.min(1, c.t / c.ms);
      if (c.mode === 'fly') { // an arc to the floor, tumbling; it lands with a little bounce and settles
        const q = 1 - Math.pow(1 - u, 2);
        c.x = c.ax + (c.bx - c.ax) * q; c.z = c.az + (c.bz - c.az) * q; c.y = c.ay * (1 - u) + Math.sin(Math.PI * u) * 0.35;
        c.yaw += c.spin * dt * (1 - u * 0.7); c.roll = Math.sin(c.t * 0.02) * 0.6 * (1 - u); c.pitch = c.stuck * u;
        this.layer(c, c.az);
        if (u >= 1) { c.mode = 'lie'; c.t = 0; c.y = 0; c.roll = 0; c.pitch = c.stuck; this.layer(c, 99); } // (no dust: a card is light — the room's dust puffs read as white haze round the fighters)
      } else if (c.mode === 'lie') { // lying: a hop when a blow lands near, a glint now and then; its time runs out: it crumbles
        c.life -= ms;
        if (c.hop > 0) { c.hop -= ms; const k = 1 - Math.max(0, c.hop) / 320; c.y = Math.sin(Math.PI * k) * 0.12; c.roll = Math.sin(k * Math.PI * 2) * 0.35; } else { c.y = 0; c.roll = 0; }
        c.glint -= ms;
        const gl = c.glint < 0 ? Math.max(0, 1 + c.glint / 260) : 0; if (c.glint < -260) c.glint = 2500 + Math.random() * 3000;
        for (const m of c.mats) m.emissiveIntensity = 0.22 + gl * 1.1;
        if (c.life <= 0) { c.mode = 'crumble'; c.t = 0; c.ms = 420; }
      } else if (c.mode === 'rise') { // gathered: it flips up off the planks
        c.y = c.ay + 0.45 * (1 - Math.pow(1 - u, 2)); c.roll += c.spin * dt; c.pitch = c.stuck * (1 - u);
        if (u >= 1) { c.mode = 'home'; c.t = 0; c.ms = (c as { homeMs?: number }).homeMs ?? 300; c.ax = c.x; c.ay = c.y; c.az = c.z; }
      } else if (c.mode === 'home') { // ...and flies to his hand, spinning, faster and faster
        const p = c.to?.(); if (!p) { c.mode = 'crumble'; c.t = 0; c.ms = 300; continue; }
        const hx = this.h.w3(p.x), hy = this.h.h3(p.z), hz = this.h.d3(p.y), q = u * u;
        c.x = c.ax + (hx - c.ax) * q; c.y = c.ay + (hy - c.ay) * q + Math.sin(Math.PI * u) * 0.3; c.z = c.az + (hz - c.az) * q;
        c.yaw += c.spin * dt * (1 + u * 2); c.roll += c.spin * 0.4 * dt;
        this.layer(c, hz);
        const k = 1 - u * 0.5; c.mesh.scale.set(c.sw * k, this.T, c.sl * k);
        for (const m of c.mats) m.emissiveIntensity = 0.3 + u * 1.4;
        if (u >= 1) { this.h.flare(hx, hy, hz + 0.1, 0xffd27a, 4, 2, 160); c.done?.(); c.mode = 'crumble'; c.t = c.ms = 1; c.mesh.visible = false; }
      } else if (c.mode === 'crumble') { // burns away from the edges: gold embers
        if (c.crumble === 'wind') { c.y += dt * 0.9; c.x += dt * 0.6; c.yaw += dt * 4; c.roll += dt * 3; } // (lifted and carried off on the wind)
        else if (c.t <= ms && c.mesh.visible && c.ms > 1) this.h.embers(c.x, c.y + 0.03, c.z, c.crumble ?? 0xffb060, 4, 0.5);
        const k = 1 - u; for (const m of c.mats) { m.opacity = k; m.emissiveIntensity = 0.22 + (1 - k) * 1.5; }
        c.mesh.scale.set(c.sw * (0.6 + 0.4 * k), this.T, c.sl * (0.6 + 0.4 * k));
      }
      this.place(c);
    }
    const gone = this.all.filter((c) => c.mode === 'crumble' && c.t >= c.ms);
    if (gone.length) { for (const c of gone) this.free(c); this.all = this.all.filter((c) => !gone.includes(c)); }
    // the big spinning cards
    for (const s of this.spins) {
      s.t += ms;
      const p = s.out < 0 ? s.at() : null;
      if (p) s.last.set(this.h.w3(p.x), this.h.h3(p.z), this.h.d3(p.y));
      else if (s.out < 0) { s.out = 0; this.h.flare(s.last.x, s.last.y, s.last.z, s.color, 8, 3, 220); }
      if (s.out >= 0) s.out += ms;
      const k = s.out < 0 ? Math.min(1, s.t / 90) : Math.max(0, 1 - s.out / 160);
      s.a += Math.PI * 2 * s.rps * dt;
      for (const m of s.meshes) { m.position.copy(s.last); m.rotation.set(s.tilt, s.a, 0, 'XYZ'); m.scale.set(this.W * s.size * k, this.T * 1.6, this.L * s.size * k); }
      for (const g of s.glow) { g.position.copy(s.last); g.rotation.set(s.tilt, 0, 0, 'XYZ'); g.scale.set(this.L * s.size * 1.5 * k, 1, this.L * s.size * 1.5 * k); (g.material as THREE.MeshBasicMaterial).opacity = 0.55 * k; }
      // split round its own depth: the far half in the room, the near half over the fighters
      const f = new THREE.Vector3(); this.h.camera.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize();
      s.planes[0][0].setFromNormalAndCoplanarPoint(f, s.last); s.planes[1][0].setFromNormalAndCoplanarPoint(this.v.copy(f).negate(), s.last);
    }
    const done = this.spins.filter((s) => s.out >= 160);
    if (done.length) {
      for (const s of done) { for (const m of [...s.meshes, ...s.glow]) { m.parent?.remove(m); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach((x, i, a) => { if (a.indexOf(x) === i) x.dispose(); }); } }
      this.spins = this.spins.filter((s) => !done.includes(s));
    }
  }
  private free(c: Card3): void {
    c.mesh.parent?.remove(c.mesh); c.shadow.parent?.remove(c.shadow);
    for (const m of c.mats) m.dispose(); (c.shadow.material as THREE.Material).dispose();
  }
  dispose(): void {
    for (const c of this.all) this.free(c);
    this.all = [];
    for (const s of this.spins) for (const m of [...s.meshes, ...s.glow]) { m.parent?.remove(m); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose()); }
    this.spins = [];
    this.geo.dispose(); this.shadowGeo.dispose(); this.shadowTex.dispose(); this.glowTex.dispose();
  }
}

// ------------------------------------------------------------------ the recipes (by skill id): one file per class (./fx3d/)

const R: Record<string, Recipe> = { ...WARRIOR, ...BOOK_MAGE, ...ARCHER, ...SAMURAI, ...GAMBLER };
