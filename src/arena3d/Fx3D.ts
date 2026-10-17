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

const KIND = { pillar: 1, dome: 2, slash: 3, strip: 4, wave: 5, decal: 6 } as const;

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
  /** What a projectile of it trails: colour, width (px), length (ms of its path); false: none. */
  trail?: { c: number; w: number; len?: number; i?: number } | false;
  /** It runs along the floor (a crest follows the projectile). */
  crest?: { c: number; h: number; w: number };
  /** Lightning between the links of its chain. */
  chainBolt?: number;
  /** The default main-hit layer is left out (the recipe's own hit does it all). */
  own?: boolean;
}

export class Fx3D {
  private items: Item[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private clock = 0;
  private noise = noiseTex();
  private cracks: [THREE.Texture, THREE.Texture][] = [crackTex(1), crackTex(2), crackTex(3)];
  private disc = discTex();
  private pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
  private domeGeo = new THREE.SphereGeometry(1, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  private planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private chunks: Chunks[];
  private ice: Crystals[];
  /** Trails and crests following what flies (by projectile). */
  private follows = new Map<Projectile, { trail?: Strip; crest?: Crest; last: V3 }>();
  private ttl = 0;

  constructor(private h: FxHost) {
    this.chunks = [new Chunks(h.back, 70), new Chunks(h.solid, 40)];
    this.ice = [new Crystals(h.back, 48), new Crystals(h.solid, 28)];
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
  private drop(ms: THREE.Mesh[], ownGeo = false): void {
    for (const m of ms) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); }
    if (ownGeo && ms[0]) ms[0].geometry.dispose();
  }
  private setU(ms: THREE.Mesh[], k: string, v: number): void { for (const m of ms) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; }

  // ------------------------------------------------------------------ units

  private P(at: V3): THREE.Vector3 { return new THREE.Vector3(this.h.w3(at.x), this.h.h3(at.z), this.h.d3(at.y)); }

  /** Later (ms, on the effects' own clock: it runs with the room). */
  later(ms: number, fn: () => void): void { if (ms <= 0) fn(); else this.timers.push({ at: this.clock + ms, fn }); }

  // ------------------------------------------------------------------ the pieces

  /** A column of light standing on the floor at (x, y) — `h` its height, `r` its radius (world px). */
  pillar(x: number, y: number, color: number, o: { h?: number; r?: number; ms?: number; i?: number; twist?: boolean; core?: boolean } = {}): void {
    const hx = this.h.w3(x), hz = this.h.d3(y), H = this.h.h3(o.h ?? 420), R = this.h.w3(o.r ?? 34), ms = o.ms ?? 520, i = o.i ?? 1.35;
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
  dome(x: number, y: number, color: number, o: { r?: number; ms?: number; i?: number; implode?: boolean; a?: number; hold?: number; follow?: () => V3 | null } = {}): void {
    const ms = o.ms ?? 420, R = this.h.w3(o.r ?? 150), base = o.a ?? 0.75;
    let hx = this.h.w3(x), hz = this.h.d3(y);
    const ms2 = this.both(this.domeGeo, KIND.dome, color, hz, { i: o.i ?? 1.3 });
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
  crack(x: number, y: number, color: number, o: { r?: number; ms?: number; chunks?: number; up?: number } = {}): void {
    const hx = this.h.w3(x), hz = this.h.d3(y), R = this.h.w3(o.r ?? 110), ms = o.ms ?? 900;
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
  crystals(x: number, y: number, o: { n?: number; r?: number; h?: number; ms?: number; ring?: boolean; delay?: number; color?: number } = {}): void {
    const n = o.n ?? 7, R = this.h.w3(o.r ?? 60), H = this.h.h3(o.h ?? 120), cx = this.h.w3(x), cz = this.h.d3(y), ms = o.ms ?? 1500;
    const pz = this.h.d3(y);
    for (let i = 0; i < n; i++) {
      const a = o.ring ? (i / n) * Math.PI * 2 + Math.random() * 0.3 : Math.random() * Math.PI * 2;
      const d = o.ring ? R : R * Math.sqrt(Math.random()), px = cx + Math.cos(a) * d, pzz = cz + Math.sin(a) * d * 0.85;
      const tilt = (o.ring ? 0.45 : 0.25 + Math.random() * 0.35), h = H * (0.55 + Math.random() * 0.6) * (o.ring ? 1 : i === 0 ? 1.35 : 1);
      const pool = pzz > pz + 0.02 ? this.ice[1] : this.ice[0];
      pool.emit(px, pzz, a, tilt, H > 0 ? h : 0.5, h * 0.17 + 0.03, ms, (o.delay ?? 0) + (o.ring ? i * 12 : Math.random() * 70));
    }
    this.h.flare(cx, 0.4, cz + 0.2, o.color ?? C.frost, 14, 6, 520);
    this.later((o.delay ?? 0) + ms - 120, () => this.h.embers(cx, 0.4, cz, C.ice, 14, 2.2)); // (they burst into glittering shards)
  }

  /** Lightning from a to b (world points): a jagged bolt, re-struck every few frames, with forks; it lights the room. */
  bolt(a: V3, b: V3, color: number, o: { ms?: number; w?: number; forks?: number; front?: boolean } = {}): void {
    const ms = o.ms ?? 260, A = this.P(a), B = this.P(b), w = (o.w ?? 10) / 100;
    const n = 24, core = new Strip(n, this.mat(KIND.strip, color, { i: 2.6 }), w), glow = new Strip(n, this.mat(KIND.strip, color, { i: 1.4 }), w * 4.5);
    const scene = o.front === false ? this.h.back : this.h.glow;
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
  streak(a: V3, b: V3, color: number, o: { w?: number; ms?: number; draw?: number; front?: boolean } = {}): void {
    const A = this.P(a), B = this.P(b), ms = o.ms ?? 320, draw = o.draw ?? 70, n = 12;
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
  slash(at: V3, dir: number, color: number, o: { r?: number; w?: number; tilt?: number; a0?: number; a1?: number; ms?: number; y0?: number; i?: number; roll?: number; follow?: () => V3 | null } = {}): void {
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
    let p = this.P(at); p.y += this.h.h3(o.y0 ?? 95);
    const ms2 = this.both(geo, KIND.slash, color, p.z, { i: o.i ?? 2.3 });
    const place = () => {
      for (const m of ms2) {
        m.position.copy(p);
        // the arc's plane: turned to face across the view (the camera's yaw), then tipped toward the floor by `tilt`
        m.rotation.set(0, 0, 0); m.rotateY(this.camYaw()); m.rotateX(THREE.MathUtils.degToRad(90 - (o.tilt ?? 30))); m.rotateZ(THREE.MathUtils.degToRad(o.roll ?? 0));
      }
    };
    place();
    let t = 0;
    this.items.push({
      step: (dt) => {
        t += dt; const k = clamp01(t / ms);
        const f = o.follow?.(); if (f) { p = this.P(f); p.y += this.h.h3(o.y0 ?? 95); place(); }
        this.setU(ms2, 'uSweep', Math.min(1.0001, outCubic(Math.min(1, k * 2.4)) * 1.0001));
        this.setU(ms2, 'uTail', 0.25 + 0.75 * Math.min(1, k * 2.4));
        this.setU(ms2, 'uA', k < 0.42 ? 1 : Math.max(0, 1 - (k - 0.42) / 0.58)); this.setU(ms2, 'uT', t / 1000);
        if (t >= ms) { this.drop(ms2, true); return false; }
        return true;
      }, dispose: () => this.drop(ms2, true),
    });
  }

  /** A whirl of cuts flat round a fighter (several rings, turning), for `ms`, following him. */
  whirl(id: string, color: number, o: { r?: number; ms?: number; rings?: number; y0?: number; every?: number; dir?: number } = {}): void {
    const ms = o.ms ?? 500, every = o.every ?? 110, rings = o.rings ?? 2;
    for (let t = 0; t < ms; t += every) for (let j = 0; j < rings; j++) {
      this.later(t + j * 30, () => {
        const c = this.h.casterPos(id); if (!c) return;
        this.slash(c, o.dir ?? 1, color, { r: (o.r ?? 130) * (1 - j * 0.12), w: 40, tilt: 8 + j * 10, a0: -180 + Math.random() * 60, a1: 140 + Math.random() * 60, ms: 260, y0: (o.y0 ?? 70) + j * 45, follow: () => this.h.casterPos(id) });
      });
    }
  }

  /** A crest of light running along the floor from (x, y) toward (dx, dy) for `len` px over `ms` (or following a projectile). */
  wave(x: number, y: number, dx: number, dy: number, color: number, o: { len?: number; ms?: number; h?: number; w?: number; chunks?: boolean } = {}): void {
    const len = o.len ?? 420, ms = o.ms ?? 260, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
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
    for (let i = 0; i < n; i++) this.later((i / n) * ms + Math.random() * 60, () => {
      const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random()), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.6, lean = 60;
      this.streak({ x: px - lean, y: py, z: H }, { x: px, y: py, z: 0 }, color, { w: 8, ms: 180, draw: 90 });
      this.later(90, () => { this.h.embers(this.h.w3(px), 0.08, this.h.d3(py), color, 3, 1.4); if (Math.random() < 0.35) this.debris(px, py, 1, { speed: 0.5, up: 0.6 }); });
    });
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
  private color(s: FinalSkill): number { return CLS[s.cls] ?? 0xffffff; }

  cast(r: CastRun): void { this.recipe(r.skill).cast?.(this, r); }
  active(r: CastRun): void { this.recipe(r.skill).active?.(this, r); }
  fired(r: CastRun, i: number, o: V3): void { this.recipe(r.skill).fired?.(this, r, i, o); }
  chain(r: CastRun, o: V3, target: V3 | null): void {
    const c = this.recipe(r.skill).chainBolt; if (c === undefined || !target) return;
    this.bolt({ x: o.x, y: o.y, z: o.z + 70 }, { x: target.x, y: target.y, z: target.z + 70 }, c, { ms: 240, w: 9, forks: 2 });
  }
  projectile(p: Projectile): void {
    const rc = this.recipe(p.skill);
    if (rc.crest) this.crestFor(p, rc.crest.c, rc.crest.h, rc.crest.w);
    if (rc.trail !== false) { const t = rc.trail ?? { c: this.color(p.skill), w: 10 }; this.trail(p, t.c, t.w, t.len ?? 14, t.i ?? 2); }
  }

  /** A confirmed hit at the foe: the recipe's own, and the room's default for the main hit by its weight. */
  hit(s: FinalSkill, h: HitEvent, at: V3, main: boolean, react: string, big: 0 | 1 | 2): void {
    const rc = this.recipe(s), col = this.color(s);
    rc.hit?.(this, s, h, at, main, react);
    if (rc.own || !main) return;
    if (big === 2) { this.pillar(at.x, at.y, col, { h: 640, r: 48, ms: 640 }); this.dome(at.x, at.y, col, { r: 200, ms: 520, a: 0.5 }); this.crack(at.x, at.y, col, { r: 150, chunks: 16 }); return; }
    if (react === 'launch') this.pillar(at.x, at.y, col, { h: 360, r: 24, ms: 380, core: false });
    else if (react === 'slam' || react === 'knockdown') this.crack(at.x, at.y, col, { r: 85, chunks: 8, ms: 700 });
    else this.dome(at.x, at.y, col, { r: 70, ms: 240, a: 0.6 });
  }

  /** Each frame: the effects run; trails and crests follow what flies. */
  update(ms: number, flying: Projectile[]): void {
    this.clock += ms;
    if (this.timers.length) { const due = this.timers.filter((x) => x.at <= this.clock); this.timers = this.timers.filter((x) => x.at > this.clock); for (const d of due) d.fn(); }
    this.items = this.items.filter((it) => it.step(ms));
    for (const c of this.chunks) c.step(ms);
    for (const c of this.ice) c.step(ms);
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

  /** The camera's turn round the vertical (rad): a slash plane faces across the view. */
  camYaw(): number { const f = new THREE.Vector3(); this.h.camera.getWorldDirection(f); return Math.atan2(-f.x, -f.z); }
  get host(): FxHost { return this.h; }
  get noiseTex(): THREE.Texture { return this.noise; }

  /** Everything compiled up front (no hitch at the first cast): one of each piece drawn once, out of sight. */
  warm(renderer: THREE.WebGLRenderer): void {
    const tmp: THREE.Object3D[] = [];
    for (const k of Object.values(KIND)) for (const clip of [null, this.cut(0, false), this.cut(0, true)]) {
      const m = new THREE.Mesh(this.planeGeo, this.mat(k, 0xffffff, { clip: clip ?? undefined })); m.position.set(0, -50, 0); tmp.push(m); this.h.back.add(m);
      const m2 = new THREE.Mesh(this.planeGeo, this.mat(k, 0xffffff, { clip: clip ?? undefined })); m2.position.set(0, -50, 0); tmp.push(m2); this.h.glow.add(m2);
    }
    try { renderer.compile(this.h.back, this.h.camera); renderer.compile(this.h.glow, this.h.camera); renderer.compile(this.h.solid, this.h.camera); } catch { /* (compiled on first use instead) */ }
    for (const m of tmp) { m.parent?.remove(m); ((m as THREE.Mesh).material as THREE.Material).dispose(); }
  }

  dispose(): void {
    for (const it of this.items) it.dispose();
    this.items = []; this.timers = [];
    for (const f of this.follows.values()) { f.trail?.dispose(); f.crest?.dispose(); }
    this.follows.clear();
    for (const c of this.chunks) c.dispose();
    for (const c of this.ice) c.dispose();
    this.noise.dispose(); this.disc.dispose(); for (const [a, b] of this.cracks) { a.dispose(); b.dispose(); }
    this.pillarGeo.dispose(); this.domeGeo.dispose(); this.planeGeo.dispose();
  }
}

/** Two sRGB hex colours mixed (t: 0 = a, 1 = b). */
function mix(a: number, b: number, t: number): number {
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
  private d: { x: number; z: number; a: number; tilt: number; h: number; r: number; t: number; ms: number; delay: number }[] = [];
  private next = 0;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private s = new THREE.Vector3(); private t = new THREE.Vector3();
  constructor(scene: THREE.Scene, private n: number) {
    const geo = new THREE.ConeGeometry(1, 1, 6, 1).translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, emissive: 0x2d8fe0, emissiveIntensity: 0.75, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.86, envMapIntensity: 2.4, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, zero); this.d.push({ x: 0, z: 0, a: 0, tilt: 0, h: 0, r: 0, t: 0, ms: 0, delay: 0 }); }
    scene.add(this.mesh);
  }
  emit(x: number, z: number, a: number, tilt: number, h: number, r: number, ms: number, delay: number): void {
    const i = this.next; this.next = (this.next + 1) % this.n;
    Object.assign(this.d[i], { x, z, a, tilt, h, r, t: -delay, ms });
  }
  step(dt: number): void {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const c = this.d[i]; if (c.ms <= 0) continue;
      c.t += dt; any = true;
      let k = 0;
      if (c.t > 0) { const g = Math.min(1, c.t / 120); k = c.t > c.ms - 160 ? Math.max(0, (c.ms - c.t) / 160) : outBack(g); }
      if (c.t >= c.ms) { c.ms = 0; k = 0; }
      // tipped outward from the cluster's middle (round the floor's vertical)
      this.eu.set(Math.sin(c.a) * c.tilt * 0.8, 0, -Math.cos(c.a) * c.tilt, 'XYZ'); this.q.setFromEuler(this.eu);
      this.m4.compose(this.t.set(c.x, 0, c.z), this.q, this.s.set(c.r * Math.max(0.2, k), c.h * k, c.r * Math.max(0.2, k)));
      this.mesh.setMatrixAt(i, this.m4);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

// ------------------------------------------------------------------ the recipes (by skill id): one file per class (./fx3d/)

const R: Record<string, Recipe> = { ...WARRIOR, ...BOOK_MAGE, ...ARCHER, ...SAMURAI, ...GAMBLER };
