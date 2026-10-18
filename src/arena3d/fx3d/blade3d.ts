// PVP 3D — the Samurai's own 3D pieces (Samurai chat), to David's bar (17 Oct, his reference "Prometheus: Ring of Fire",
// docs/ref/prometheus/; the board's 8 points): one colour family — a white-hot core → his crimson → a dark ink stroke;
// everything with volume a thing standing in the room, never a picture facing the camera; fast (a cut lives 100–200 ms).
//   ring       a cut of the blade: a thick ribbon ring round his body in perspective (flat for a spin, slanted for an
//              overhead), its leading edge white-hot, its body crimson with an ink stroke inside, its tail fading — it turns
//              to ink as it goes (03)
//   crescent   the finisher: one huge crescent (twice his height) that goes dark (05)
//   flurry     thin, very long crossing lines through the foe, a new one every 35–50 ms (04)
//   bladeBall  rings at many tilts round him, travelling with him (07)
//   inkBurst   a burst of ink: dark clouds thrown out of a point, a crimson rim of light, drops flung (05)
// Built on the room's own pieces (../Fx3D.ts, DFO's: `cut` for the split round the fighters, `streak`, the host's
// embers / dust / flare); nothing of that file is changed here.
import * as THREE from 'three';
import type { Fx3D, V3 } from '../Fx3D';

type Item = { step(ms: number): boolean; dispose(): void };
/** Run a piece on the room's own clock (Fx3D steps its items every frame, hit-stops and all). */
export const run = (f: Fx3D, it: Item) => (f as unknown as { items: Item[] }).items.push(it);
/** Make pieces from inside another piece's step: the room walks its list of pieces then (one added to it there is lost), so
 *  they are made on its next tick. */
export const soon = (f: Fx3D, fn: () => void) => f.later(1, fn);

/** The samurai's colour family: the white-hot core, his crimson, the ink. */
export const SAM = { core: 0xfff4f2, crimson: 0xff0f2e, deep: 0xa00a22, ink: 0x120108,
  /** the light the room answers his blows in (its flare, floor ring, embers): a warm white touched with his crimson — a
   *  crimson flare washed the whole red courtyard redder (David's bar: contrast, never a wash) */
  light: 0xffc2c8,
  /** his crimson as a light (the luminous band of the big shapes): added over the red courtyard the crimson itself adds
   *  nothing — a hot rose reads as light on it, still his family */
  rose: 0xff5c7c } as const;

const VS = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
// u along the cut (0 its tail … 1 its head), v across it (0 the inside … 1 the outer edge). Part 0 (drawn over: the ink):
// the dark stroke along the inside — and the whole ribbon as it turns to ink at its end. Part 1 (light, added): the
// luminous band in his colour, its outer edge and its head white-hot.
const FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uCore; uniform vec3 uInk; uniform vec3 uLit; uniform float uGain;
uniform float uA; uniform float uSweep; uniform float uTail; uniform float uFill; uniform float uDark; uniform float uErode; uniform float uT; uniform float uPart; uniform float uInkW; uniform float uRim; uniform float uGrad; uniform float uEdge;
uniform sampler2D uNoise;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  float u = vUv.x, v = vUv.y;
  if (u > uSweep) discard;
  float along = max(smoothstep(uSweep - uTail, uSweep, u), uFill * smoothstep(0.0, 0.14, u));
  float head = smoothstep(uSweep - 0.06, uSweep, u);
  float n = texture2D(uNoise, vec2(u * 3.0 - uT * 1.6, v * 0.5 + 0.13)).r;
  float n2 = texture2D(uNoise, vec2(u * 7.0 - uT * 2.3, v * 1.7 + 0.71)).r;
  float body = smoothstep(0.0, 0.06, v) * (1.0 - smoothstep(0.93, 1.0, v));
  float ink = 1.0 - smoothstep(uInkW * 0.55, uInkW, v);
  float band = smoothstep(uInkW * 0.7, uInkW + 0.12, v) * (1.0 - smoothstep(0.93, 1.0, v)) * pow(max(v, 0.0), uGrad);
  float edge = smoothstep(uEdge, mix(uEdge, 1.0, 0.64), v) * (1.0 - smoothstep(0.955, 1.0, v));
  float keep = smoothstep(uErode, uErode + 0.25, 0.55 * n + 0.6 * along);
  vec3 col; float a;
  if (uPart < 0.5) {
    col = uInk;
    a = uA * along * keep * max(ink * 0.96, body * uDark * 0.95) * (0.88 + 0.12 * n2);
  } else {
    float hot = max(edge, head * body);
    col = mix(uLit * uGain, uCore * (uGain + 0.7), hot * (1.0 - uDark)) * (0.85 + 0.3 * n2);   // (the band saturated; the core white-hot, blooming; dark: its rim in his colour)
    a = uA * along * keep * ((band * 0.8 + hot * 0.95) * (1.0 - uDark) + edge * 0.9 * uRim * uDark);
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const outCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export interface Ring {
  /** radius and width (px); its centre over his feet and ahead of him (px) */
  r?: number; w?: number; y0?: number; fwd?: number;
  /** its plane: `tilt` 0 flat round him … 90 upright; `yaw` turned out of the picture (deg, + its front toward the camera);
   *  `roll` turned in its plane (deg) */
  tilt?: number; yaw?: number; roll?: number;
  /** its sweep in its plane (deg: 0 over him when upright / in front of him when flat; 90 his front side) */
  a0?: number; a1?: number;
  /** life (ms); it sweeps out over the first `sweep` of it, holds its light a moment (`hold`), then turns to ink and goes;
   *  `tail` the share of the arc behind its head that stays lit (1 a swing's long fading tail … 0.3 only its head);
   *  `fill` 1: lit whole along its length once swept (a crescent), 0: the tail fades */
  ms?: number; sweep?: number; hold?: number; tail?: number; fill?: number;
  /** strength; the ink stroke's width (share of the ribbon) */
  a?: number; inkW?: number;
  /** colours (default his family): the band's colour (`col`, or `lit`), the white-hot core, the ink; `gain` the light's strength (blooms) */
  col?: number; lit?: number; core?: number; ink?: number; gain?: number;
  /** it follows a point (his feet) through its life */
  follow?: () => V3 | null;
  /** drawn whole over the fighters (no part of it behind them: the ultimate's crescent, over its painted show) */
  over?: boolean;
  /** no sound of its own (one ring of many: a ball of blades) */
  quiet?: boolean;
  /** it lives until this says so (then turns to ink over `fade` ms and goes; `ms` its longest life): a crescent riding a shot */
  until?: () => boolean; fade?: number;
  /** an ink ring from the start, only its outer rim lit in his colour (a crescent's black shadow) */
  shadow?: boolean;
  /** at its end it dissolves as light (no turning to ink): a crescent gone into his hand */
  noInk?: boolean;
  /** as it goes dark its outer rim stays lit in his colour */
  rim?: boolean;
  /** the luminous band fading toward its inside (0 even … 2: the light only near its edge) — a glow tapering behind the edge */
  grad?: number;
  /** where its white-hot outer edge begins across the ribbon (0.72; nearer 1: a thinner edge) */
  edge?: number;
  /** each frame: its turn round the vertical and in its plane (deg), how dark (0..1) and how strong (0..1) — a crescent that
   *  turns, goes dark, fades with its speed */
  live?: () => { yaw?: number; roll?: number; dark?: number; a?: number };
}

/** A cut of the blade: a thick ribbon ring round `at` (his feet) on the side `dir` (±1) — standing in the room, its part
 *  behind the fighters drawn in the room, its part in front over them. */
export function ring(f: Fx3D, at: V3, dir: number, o: Ring = {}): void {
  if (!o.quiet) f.onPiece?.('slash', at, (o.r ?? 105) > 160 ? 1 : 0); // (the arena's sound: each piece heard as the room's own are)
  const h = f.host, R = h.w3(o.r ?? 105), W = h.w3(o.w ?? 34), ms = o.ms ?? 190, sweepMs = ms * (o.sweep ?? 0.42), holdMs = o.hold ?? ms * 0.12;
  const a0 = THREE.MathUtils.degToRad(o.a0 ?? -40), a1 = THREE.MathUtils.degToRad(o.a1 ?? 160);
  const n = 64, pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + (a1 - a0) * k, taper = Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * k)), 0.5), rin = R - W * taper;
    pos.set([Math.sin(a) * rin * dir, Math.cos(a) * rin, 0, Math.sin(a) * R * dir, Math.cos(a) * R, 0], i * 6);
    uv.set([k, 0, k, 1], i * 4);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const U = {
    uCore: new THREE.Color(o.core ?? SAM.core), uInk: new THREE.Color(o.ink ?? SAM.ink), uLit: new THREE.Color(o.lit ?? o.col ?? SAM.crimson),
  };
  const mat = (part: 0 | 1, front: boolean, hz: number) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      uniforms: { uCore: { value: U.uCore }, uInk: { value: U.uInk }, uLit: { value: U.uLit }, uGain: { value: o.gain ?? 1.25 }, uA: { value: o.a ?? 1 }, uSweep: { value: 0 }, uTail: { value: 0.3 }, uFill: { value: o.fill ?? 0 }, uRim: { value: o.shadow || o.rim ? 1 : 0 }, uGrad: { value: o.grad ?? 0 }, uEdge: { value: o.edge ?? 0.72 },
        uDark: { value: 0 }, uErode: { value: -0.4 }, uT: { value: Math.random() * 10 }, uPart: { value: part }, uInkW: { value: o.inkW ?? 0.38 }, uNoise: { value: f.noiseTex } },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: part ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    });
    if (!o.over) { m.clippingPlanes = f.cut(hz, front); m.clipping = true; }
    return m;
  };
  const fwd = (o.fwd ?? 0) * dir, lift = o.y0 ?? 90;
  let p = new THREE.Vector3(h.w3(at.x + fwd), h.h3(at.z + lift), h.d3(at.y));
  const meshes = o.over ? [new THREE.Mesh(geo, mat(0, true, p.z)), new THREE.Mesh(geo, mat(1, true, p.z))]
    : [new THREE.Mesh(geo, mat(0, false, p.z)), new THREE.Mesh(geo, mat(1, false, p.z)), new THREE.Mesh(geo, mat(0, true, p.z)), new THREE.Mesh(geo, mat(1, true, p.z))];
  if (o.over) { h.solid.add(meshes[0]); h.glow.add(meshes[1]); }
  else { h.back.add(meshes[0], meshes[1]); h.solid.add(meshes[2]); h.glow.add(meshes[3]); }
  let lv = o.live?.();
  const place = () => {
    for (const m of meshes) {
      m.frustumCulled = false; m.position.copy(p);
      m.rotation.set(0, 0, 0); m.rotateY(f.camYaw() + THREE.MathUtils.degToRad(lv?.yaw ?? o.yaw ?? 0) * dir); m.rotateX(THREE.MathUtils.degToRad(90 - (o.tilt ?? 30))); m.rotateZ(THREE.MathUtils.degToRad(lv?.roll ?? o.roll ?? 0) * dir);
    }
  };
  place();
  const drop = () => { for (const m of meshes) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } geo.dispose(); };
  const set = (k: string, v: number) => { for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; };
  let t = 0, endAt = -1;
  const fadeMs = o.fade ?? 280;
  run(f, {
    step: (dt) => {
      t += dt; lv = o.live?.();
      const fo = o.follow?.(); if (fo) p = new THREE.Vector3(h.w3(fo.x + fwd), h.h3(fo.z + lift), h.d3(fo.y));
      if (fo || lv) place();
      if (o.until && endAt < 0 && (o.until() || t >= ms)) endAt = t;
      const ks = Math.min(1, t / Math.max(1, sweepMs));
      const kd = o.until ? (endAt < 0 ? 0 : Math.min(1, (t - endAt) / fadeMs)) : Math.max(0, (t - sweepMs - holdMs) / Math.max(1, ms - sweepMs - holdMs));
      set('uSweep', 1.0001 * outCubic(ks)); set('uTail', 0.25 + ((o.tail ?? 1) - 0.25) * outCubic(ks));
      set('uDark', o.shadow ? 1 : Math.max(lv?.dark ?? 0, o.noInk ? 0 : Math.min(1, kd * 1.6))); set('uErode', -0.4 + 1.55 * kd * kd); set('uT', t / 1000);
      if (lv?.a !== undefined) set('uA', (o.a ?? 1) * lv.a);
      if (o.until ? endAt >= 0 && t - endAt >= fadeMs : t >= ms) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

/** The finisher (05): one huge crescent — twice his height — standing upright facing the room round `at` (his chest), its
 *  curve thrown forward through the foe: lit whole (a white-hot rim, a rose body, the ink along its inside) for a long beat,
 *  then it goes dark — an ink crescent that hangs and dissolves. */
export function crescent(f: Fx3D, at: V3, dir: number, o: Ring = {}): void {
  ring(f, at, dir, { r: 165, w: 76, y0: 100, fwd: 10, tilt: 88, yaw: 10, a0: -40, a1: 128, ms: 700, sweep: 0.08, hold: 300, fill: 1, inkW: 0.34, lit: SAM.rose, gain: 1.15, ...o });
}

const SLIT_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// a spindle, sharp at both ends and thickest in its middle (04): a white-hot core in the colour (added), or a stroke of ink
const SLIT_FS = `
#include <common>
uniform vec3 uCol; uniform vec3 uCore; uniform float uA; uniform float uDraw; uniform float uInk;
varying vec2 vUv;
void main() {
  float u = vUv.x;
  if (u > uDraw) discard;
  float wid = pow(max(sin(3.14159265 * u), 0.0), 0.7);
  float d = abs(vUv.y - 0.5) * 2.0 / max(wid, 0.001);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.4, d), body = 1.0 - smoothstep(0.5, 1.0, d);
  vec3 col = uInk > 0.5 ? uCol : mix(uCol, uCore, core);
  float a = uA * (uInk > 0.5 ? body * 0.82 : max(body * 0.75, core));
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** One line of a flurry (04): a long thin spindle in the room from `a` to `b` (world px), sharp at both ends, shot across
 *  in `draw` ms (0: there at once — a cut landing in a hit-stop, when the effects' clock stands still) and gone after `ms`:
 *  light (a white-hot core in `col`, added) or a stroke of ink; its face turned to the camera round its own length; over
 *  the fighters (`front`) or behind them. */
export function slit(f: Fx3D, a: V3, b: V3, o: { w?: number; ms?: number; draw?: number; col?: number; ink?: boolean; front?: boolean } = {}): void {
  const h = f.host, A = new THREE.Vector3(h.w3(a.x), h.h3(a.z), h.d3(a.y)), B = new THREE.Vector3(h.w3(b.x), h.h3(b.z), h.d3(b.y));
  const ms = o.ms ?? 66, draw = o.draw ?? 18, ink = !!o.ink;
  const mat = new THREE.ShaderMaterial({ vertexShader: SLIT_VS, fragmentShader: SLIT_FS,
    uniforms: { uCol: { value: new THREE.Color(o.col ?? (ink ? SAM.ink : SAM.rose)) }, uCore: { value: new THREE.Color(SAM.core) }, uA: { value: 1 }, uDraw: { value: draw <= 0 ? 1.0001 : 0 }, uInk: { value: ink ? 1 : 0 } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: ink ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.frustumCulled = false;
  const X = B.clone().sub(A).normalize(), mid = A.clone().add(B).multiplyScalar(0.5), M = new THREE.Matrix4();
  m.position.copy(mid); m.scale.set(A.distanceTo(B), h.w3(o.w ?? 12), 1);
  const face = () => {
    const Z = h.camera.position.clone().sub(mid); Z.sub(X.clone().multiplyScalar(Z.dot(X)));
    if (Z.lengthSq() < 1e-10) Z.set(0, 0, 1);
    Z.normalize(); m.quaternion.setFromRotationMatrix(M.makeBasis(X, new THREE.Vector3().crossVectors(Z, X), Z));
  };
  face();
  (ink ? (o.front ? h.solid : h.back) : (o.front ? h.glow : h.back)).add(m);
  const drop = () => { m.parent?.remove(m); m.geometry.dispose(); mat.dispose(); };
  let t = 0;
  run(f, {
    step: (dt) => {
      t += dt; face();
      mat.uniforms.uDraw.value = draw <= 0 ? 1.0001 : Math.min(1.0001, t / draw);
      mat.uniforms.uA.value = t < draw ? 1 : Math.max(0, 1 - (t - draw) / Math.max(1, ms - draw));
      if (t >= ms) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

/** A flurry (04): thin, very long lines crossing through `at()` (the foe, followed) — a new one every `every` ms for `ms`,
 *  each ~66 ms, the angles crossing (one rising, the next falling: Xs through him), one in `ink` of them a stroke of ink;
 *  `front` all of them over the fighters (else every other one behind the foe); `draw` 0: each there at once (cuts landing
 *  in hit-stops stay standing through them, crossing into a star); a few embers off him. */
export function flurry(f: Fx3D, at: () => V3 | null, o: { ms?: number; every?: number; len?: number; w?: number; col?: number; y0?: number; front?: boolean; ink?: number; draw?: number } = {}): void {
  const ms = o.ms ?? 360, every = o.every ?? 42, len = o.len ?? 460, col = o.col ?? SAM.rose, inkEvery = o.ink ?? 4, k0 = Math.floor(Math.random() * 2);
  for (let t = 0, k = k0; t < ms; t += every * (0.85 + Math.random() * 0.3), k++) {
    f.later(t, () => {
      const c = at(); if (!c) return;
      const z0 = c.z + (o.y0 ?? 70), th = (k % 2 ? 1 : -1) * (12 + Math.random() * 56) * (Math.PI / 180), ph = (Math.random() - 0.5) * 0.7;
      const dx = Math.cos(th) * Math.cos(ph), dz = Math.sin(th) * Math.cos(ph), dy = Math.sin(ph);
      const L = len * (0.8 + Math.random() * 0.45), ox = (Math.random() - 0.5) * 26, oz = (Math.random() - 0.5) * 30;
      const a = { x: c.x - dx * L * 0.5 + ox, y: c.y - dy * L * 0.5, z: z0 - dz * L * 0.5 + oz }, b = { x: c.x + dx * L * 0.5 + ox, y: c.y + dy * L * 0.5, z: z0 + dz * L * 0.5 + oz };
      if (f.onPieceRef) f.onPieceRef('flurry', c, k % 5 === 4 ? 1 : 0, { color: col, accent: k % 5 === 4 }); else f.onPiece?.('streak', c, 0); // (its tick; every fifth an accent)
      const ink = inkEvery > 0 && Math.random() < 1 / inkEvery, front = o.front || k % 2 === 0, w = (o.w ?? 12) * (0.8 + Math.random() * 0.5);
      const fl = Math.random() < 0.5;
      slit(f, fl ? a : b, fl ? b : a, { w: ink ? w * 1.1 : w, ms: ink ? 84 : 66, draw: o.draw ?? 18, col: ink ? SAM.ink : col, ink, front });
      if (k % 3 === 0) f.host.embers(f.host.w3(c.x), f.host.h3(z0), f.host.d3(c.y), SAM.light, 2, 2.2);
    });
  }
}

/** A ball of blades (07): rings at many tilts round him (`id`), one after another, travelling with him for `ms`. */
export function bladeBall(f: Fx3D, id: string, dir: number, o: { ms?: number; every?: number; r?: number; y0?: number } = {}): void {
  const ms = o.ms ?? 330, every = o.every ?? 45, follow = () => f.host.casterPos(id);
  for (let t = 0, k = 0; t < ms; t += every, k++) {
    f.later(t, () => {
      const c = follow(); if (!c) return;
      ring(f, c, k % 2 ? -dir : dir, { r: (o.r ?? 112) * (0.9 + Math.random() * 0.2), w: 26, y0: o.y0 ?? 62, tilt: Math.random() * 180 - 90, yaw: Math.random() * 120 - 60, roll: Math.random() * 360,
        a0: -150, a1: 150, ms: 170, sweep: 0.5, hold: 10, inkW: 0.4, follow, quiet: k % 3 !== 0 });
    });
  }
}

// ------------------------------------------------------------------ ink

/** A soft cloud of ink (its edge torn), drawn once. */
let inkTex: THREE.Texture | null = null;
function cloudTex(): THREE.Texture {
  if (inkTex) return inkTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  for (let i = 0; i < 9; i++) { // a few soft lobes: a torn, inky silhouette
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = i === 0 ? 0 : 18 + Math.random() * 18, r = i === 0 ? 40 : 18 + Math.random() * 16;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (inkTex = t);
}

/** A burst of ink (05): dark clouds thrown out of `at` (world px, z its height), swelling and thinning — the ones nearer
 *  the camera than `foeY` (world px of depth) drawn over the fighters, the rest behind; a crimson rim of light round it and
 *  drops of ink flung, falling to the planks. `r` its reach (px). */
export function inkBurst(f: Fx3D, at: V3, o: { r?: number; n?: number; ms?: number; foeY?: number; col?: number; up?: number; /** the light it throws on the room (0: none) */ light?: number } = {}): void {
  const h = f.host, n = o.n ?? 14, R = o.r ?? 120, ms = o.ms ?? 520, col = o.col ?? SAM.crimson, tex = cloudTex();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(h.w3(x), h.h3(z), h.d3(y));
  const ref = o.foeY ?? at.y;
  const parts: { s: THREE.Sprite; v: THREE.Vector3; s0: number; s1: number; a0: number; glow: boolean; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, el = (Math.random() - 0.25) * 1.1, sp = R * (0.45 + Math.random() * 0.55);
    const dx = Math.cos(th) * Math.cos(el), dy = Math.sin(th) * Math.cos(el) * 0.6, dz = Math.sin(el) + (o.up ?? 0.25);
    const y = at.y + dy * 6, front = y + dy * sp > ref + 6;
    const mk = (glow: boolean) => {
      const m = new THREE.SpriteMaterial({ map: tex, color: glow ? col : SAM.ink, transparent: true, depthWrite: false, depthTest: true, opacity: 0,
        blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, rotation: Math.random() * Math.PI * 2, fog: false });
      const s = new THREE.Sprite(m); s.position.copy(P(at.x, y, at.z)); s.frustumCulled = false;
      (glow ? (front ? h.glow : h.back) : front ? h.solid : h.back).add(s);
      return s;
    };
    const s0 = h.w3(R * 0.2), s1 = h.w3(R * (0.45 + Math.random() * 0.3));
    parts.push({ s: mk(false), v: new THREE.Vector3(h.w3(dx * sp), h.h3(dz * sp * 0.7), h.d3(dy * sp)), s0, s1, a0: front ? 0.5 : 0.85, glow: false, d: Math.random() * 40 });
    if (i % 3 === 0) parts.push({ s: mk(true), v: new THREE.Vector3(h.w3(dx * sp * 1.1), h.h3(dz * sp * 0.75), h.d3(dy * sp * 1.1)), s0: s0 * 1.3, s1: s1 * 1.25, a0: 0.55, glow: true, d: Math.random() * 30 });
  }
  const o0 = P(at.x, at.y, at.z);
  if ((o.light ?? 6) > 0) h.flare(o0.x, o0.y, o0.z + 0.1, col, o.light ?? 6, 3, ms * 0.5);
  // drops of ink flung out (small dark specks thrown far and fast)
  for (let i = 0; i < 7; i++) {
    const th = Math.random() * Math.PI * 2, el = (Math.random() - 0.2) * 1.2, sp = R * (1.1 + Math.random() * 0.7), dx = Math.cos(th) * Math.cos(el), dy = Math.sin(th) * Math.cos(el) * 0.6, dz = Math.sin(el);
    const y = at.y + dy * 6, front = y + dy * sp > ref + 6;
    const m = new THREE.SpriteMaterial({ map: tex, color: SAM.ink, transparent: true, depthWrite: false, depthTest: true, opacity: 0, fog: false });
    const sp3 = new THREE.Sprite(m); sp3.position.copy(P(at.x, y, at.z)); sp3.frustumCulled = false; (front ? h.solid : h.back).add(sp3);
    const sz = h.w3(R * (0.08 + Math.random() * 0.06));
    parts.push({ s: sp3, v: new THREE.Vector3(h.w3(dx * sp), h.h3(dz * sp * 0.7), h.d3(dy * sp)), s0: sz, s1: sz * 0.6, a0: 0.95, glow: false, d: 0 });
  }
  let t = 0;
  const drop = () => { for (const p of parts) { p.s.parent?.remove(p.s); p.s.material.dispose(); } };
  run(f, {
    step: (dt) => {
      t += dt;
      for (const p of parts) {
        const k = Math.min(1, Math.max(0, (t - p.d) / ms)), e = outCubic(k);
        p.s.position.set(o0.x + p.v.x * e, o0.y + p.v.y * e, o0.z + p.v.z * e);
        const sc = p.s0 + (p.s1 - p.s0) * e; p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = p.a0 * (k < 0.08 ? k / 0.08 : 1) * (1 - Math.pow(k, p.glow ? 1.2 : 2.2));
      }
      if (t >= ms + 60) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

/** Sparks of a blow (white-hot core, his crimson): short streaks thrown out of the contact the way the blow goes (`dir`
 *  ±1) — up, down, toward the camera and away — and a few embers falling to the planks. */
export function sparks(f: Fx3D, at: V3, dir: number, n = 5, len = 50, col: number = SAM.crimson): void {
  const z0 = at.z + 64;
  for (let i = 0; i < n; i++) {
    const up = (Math.random() - 0.35) * 1.3, depth = (Math.random() - 0.5) * 1.6, fwd = 0.6 + Math.random() * 0.8, L = len * (0.6 + Math.random() * 0.7);
    const nrm = Math.hypot(fwd, up, depth) || 1, dx = (fwd / nrm) * dir, dz = up / nrm, dy = depth / nrm;
    f.streak({ x: at.x + dx * 8, y: at.y + dy * 8, z: z0 + dz * 8 }, { x: at.x + dx * L, y: at.y + dy * L, z: z0 + dz * L }, col, { w: 3 + Math.random() * 2.5, ms: 110 + Math.random() * 70, draw: 40, front: dy > 0, quiet: true });
  }
  f.host.embers(f.host.w3(at.x + 6 * dir), f.host.h3(z0), f.host.d3(at.y), col, Math.max(2, Math.round(n / 2)), 1.6);
}

// ------------------------------------------------------------------ the Iai (David 18 Oct 18:29: the iai as a beat)

/** A glint (a tiny star of light: two crossing slits) at `at`, gone in `ms`. */
export function star(f: Fx3D, at: V3, size = 14, ms = 150, col: number = SAM.rose): void {
  slit(f, { x: at.x - size, y: at.y, z: at.z }, { x: at.x + size, y: at.y, z: at.z }, { w: 3.2, ms, draw: 0, col, front: true });
  slit(f, { x: at.x, y: at.y, z: at.z - size * 1.35 }, { x: at.x, y: at.y, z: at.z + size * 1.35 }, { w: 3.2, ms, draw: 0, col, front: true });
  f.host.flare(f.host.w3(at.x), f.host.h3(at.z), f.host.d3(at.y) + 0.1, SAM.light, 3 + size / 8, 2, ms * 1.6);
}

/** A glint running along a blade or a sheath from `a()` to `b()` (followed: on him) in `ms`: a bright head leaving a short
 *  trail of light, a star where it ends. */
export function glintRun(f: Fx3D, a: () => V3 | null, b: () => V3 | null, o: { ms?: number; w?: number; star?: number; col?: number } = {}): void {
  const ms = o.ms ?? 200; let t = 0, last: V3 | null = null;
  run(f, {
    step: (dt) => {
      t += dt; const A = a(), B = b(); if (!A || !B) return false;
      const k = Math.min(1, t / ms), e = 1 - (1 - k) * (1 - k), p = { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, z: A.z + (B.z - A.z) * e };
      if (last && Math.hypot(p.x - last.x, p.z - last.z) > 0.5) { const q = last; soon(f, () => slit(f, q, p, { w: o.w ?? 4, ms: 130, draw: 0, col: o.col ?? SAM.rose, front: true })); }
      last = p;
      if (k >= 1) { soon(f, () => star(f, p, o.star ?? 12, 170, o.col ?? SAM.rose)); return false; }
      return true;
    }, dispose: () => {},
  });
}

const FLOOR_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLOOR_FS = `
#include <common>
uniform vec3 uCol; uniform float uA;
varying vec2 vUv;
void main() {
  float d = abs(vUv.y - 0.5) * 2.0, u = vUv.x;
  float a = uA * (1.0 - smoothstep(0.15, 1.0, d)) * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.82, 1.0, u)) * (0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.35, d)));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uCol, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A hairline of light lying on the planks (a reach shown while it is charged): `get()` its ends, width, strength and colour
 *  each frame; when it returns null the line fades out. */
export function floorLine(f: Fx3D, get: () => { x0: number; y0: number; x1: number; y1: number; w: number; a: number; col?: number } | null): void {
  const h = f.host, mat = new THREE.ShaderMaterial({ vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS, uniforms: { uCol: { value: new THREE.Color(SAM.rose) }, uA: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; h.back.add(m);
  const drop = () => { m.parent?.remove(m); mat.dispose(); geo.dispose(); };
  let t = 0, end = -1, a0 = 0;
  run(f, {
    step: (dt) => {
      t += dt;
      const g = end < 0 ? get() : null;
      if (g) {
        const ax = h.w3(g.x0), az = h.d3(g.y0), bx = h.w3(g.x1), bz = h.d3(g.y1), L = Math.hypot(bx - ax, bz - az);
        m.position.set((ax + bx) / 2, 0.018, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); m.scale.set(Math.max(1e-4, L), 1, h.w3(g.w));
        if (g.col !== undefined) mat.uniforms.uCol.value.set(g.col);
        a0 = g.a * Math.min(1, t / 120); mat.uniforms.uA.value = a0;
      } else if (end < 0) end = t;
      if (end >= 0) { const k = (t - end) / 140; mat.uniforms.uA.value = a0 * Math.max(0, 1 - k); if (k >= 1) { drop(); return false; } }
      return true;
    }, dispose: drop,
  });
}

/** Petals bursting out of `at` (world px; z its height): real petal pictures (`tex`, lit by the room) flung out — thrown
 *  along `dir` (±1, 0 all round) and up — tumbling, slowed by the air, drifting down to the planks, gone in about `ms`. */
export function petalBurst(f: Fx3D, at: V3, tex: (THREE.Texture | null | undefined)[], o: { n?: number; speed?: number; up?: number; dir?: number; ms?: number; size?: number; aspect?: number; foeY?: number } = {}): void {
  const h = f.host, n = o.n ?? 24, ms = o.ms ?? 900, sp = o.speed ?? 320, maps = tex.filter((x): x is THREE.Texture => !!x), ref = o.foeY ?? at.y;
  const G = (maps.length ? maps : [null]).map((map) => {
    const mat = new THREE.MeshStandardMaterial({ map: map ?? undefined, color: map ? 0xffffff : 0xffb6d2, emissive: 0xff8ab4, emissiveIntensity: map ? 0.3 : 0.7, roughness: 0.6, metalness: 0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1), k = n, back = new THREE.InstancedMesh(geo, mat, k), front = new THREE.InstancedMesh(geo, mat, k);
    back.frustumCulled = front.frustumCulled = false; back.count = front.count = 0; h.back.add(back); h.solid.add(front);
    return { mat, geo, back, front, nb: 0, nf: 0 };
  });
  const P = Array.from({ length: n }, (_, i) => {
    const th = Math.random() * Math.PI * 2, el = (Math.random() - 0.15) * 1.3, s = sp * (0.4 + Math.random() * 0.8);
    const vx = Math.cos(th) * Math.cos(el) + (o.dir ?? 0) * 0.85, vy = Math.sin(th) * Math.cos(el) * 0.7, vz = Math.sin(el) * 0.8 + (o.up ?? 0.5);
    return { g: i % G.length, x: at.x, y: at.y, z: at.z, vx: vx * s, vy: vy * s, vz: vz * s, life: ms * (0.65 + Math.random() * 0.55), sz: 0.75 + Math.random() * 0.55,
      ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), rot: Math.random() * 6, spin: 5 + Math.random() * 9, sway: Math.random() * 6 };
  });
  const img = maps[0]?.image as { width?: number; height?: number } | undefined, W = h.w3(18 * (o.size ?? 1)), asp = o.aspect ?? (img?.width && img.height ? img.height / img.width : 1), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), X = new THREE.Vector3();
  const drop = () => { for (const g of G) { h.back.remove(g.back); h.solid.remove(g.front); g.back.dispose(); g.front.dispose(); g.geo.dispose(); g.mat.dispose(); } };
  let t = 0;
  run(f, {
    step: (dt) => {
      t += dt; const s = dt / 1000, drag = Math.pow(0.18, s);
      for (const g of G) { g.nb = 0; g.nf = 0; }
      for (const p of P) {
        if (t > p.life) continue;
        p.vx *= drag; p.vy *= drag; p.vz = Math.max(-110, p.vz * drag - 520 * s); // (slowed by the air, then drifting down)
        p.x += (p.vx + Math.sin(t / 160 + p.sway) * 30) * s; p.y += p.vy * s; p.z = Math.max(2, p.z + p.vz * s);
        const k = t / p.life, sc = W * p.sz * (k < 0.05 ? k / 0.05 : 1) * (k > 0.72 ? Math.max(0, (1 - k) / 0.28) : 1);
        X.set(h.w3(p.x), h.h3(p.z), h.d3(p.y)); Q.setFromAxisAngle(p.ax, p.rot + (p.spin * t) / 1000); S.set(sc, sc * asp, 1); M.compose(X, Q, S);
        const g = G[p.g]; if (p.y > ref + 4) g.front.setMatrixAt(g.nf++, M); else g.back.setMatrixAt(g.nb++, M);
      }
      for (const g of G) { g.back.count = g.nb; g.front.count = g.nf; g.back.instanceMatrix.needsUpdate = true; g.front.instanceMatrix.needsUpdate = true; }
      if (t >= ms * 1.25) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

/** Petals spilling from a moving point (`at()` — called for each petal, so it can hand out points along a shape): real petal
 *  pictures (`tex`, lit by the room), `rate` a second, each thrown along `back` (world px/s) with a little scatter, slowed by
 *  the air and drifting down, gone in about `life` ms; `at()` undefined: none just now; null: no more come and the piece
 *  ends with its last petal. */
export function petalStream(f: Fx3D, at: () => V3 | null | undefined, tex: (THREE.Texture | null | undefined)[], o: { rate?: number; life?: number; back?: { x: number; y: number; z?: number }; size?: number; max?: number; foeY?: () => number } = {}): void {
  const h = f.host, maps = tex.filter((x): x is THREE.Texture => !!x), N = o.max ?? 60, rate = o.rate ?? 40, life = o.life ?? 700;
  const G = (maps.length ? maps : [null]).map((map) => {
    const mat = new THREE.MeshStandardMaterial({ map: map ?? undefined, color: map ? 0xffffff : 0xffb6d2, emissive: 0xff8ab4, emissiveIntensity: map ? 0.3 : 0.7, roughness: 0.6, metalness: 0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1), back = new THREE.InstancedMesh(geo, mat, N), front = new THREE.InstancedMesh(geo, mat, N);
    back.frustumCulled = front.frustumCulled = false; back.count = front.count = 0; h.back.add(back); h.solid.add(front);
    return { mat, geo, back, front, nb: 0, nf: 0 };
  });
  const img = maps[0]?.image as { width?: number; height?: number } | undefined, W = h.w3(16 * (o.size ?? 1)), asp = img?.width && img.height ? img.height / img.width : 1;
  type Pt = { g: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; sz: number; ax: THREE.Vector3; rot: number; spin: number };
  const P: Pt[] = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), X = new THREE.Vector3();
  const drop = () => { for (const g of G) { h.back.remove(g.back); h.solid.remove(g.front); g.back.dispose(); g.front.dispose(); g.geo.dispose(); g.mat.dispose(); } };
  let acc = 0, on = true, k = 0;
  run(f, {
    step: (dt) => {
      const s = dt / 1000, drag = Math.pow(0.12, s);
      if (on) {
        acc += rate * s;
        while (acc >= 1 && P.length < N) {
          acc -= 1; const c = at(); if (c === null) { on = false; break; } if (!c) { acc = 0; break; } // (undefined: none just now)
          const b = o.back ?? { x: 0, y: 0 }, j = 0.5 + Math.random() * 0.7;
          P.push({ g: k++ % G.length, x: c.x, y: c.y, z: c.z, vx: b.x * j + (Math.random() - 0.5) * 90, vy: b.y * j + (Math.random() - 0.5) * 50, vz: (b.z ?? 0) * j + (Math.random() - 0.2) * 120, t: 0,
            life: life * (0.7 + Math.random() * 0.6), sz: 0.7 + Math.random() * 0.6, ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), rot: Math.random() * 6, spin: 6 + Math.random() * 10 });
        }
        if (acc >= 1 && P.length >= N) acc = 0;
        if (at() === null) on = false;
      }
      for (const g of G) { g.nb = 0; g.nf = 0; }
      const ref = o.foeY?.();
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.t += dt;
        if (p.t >= p.life) { P.splice(i, 1); continue; }
        p.vx *= drag; p.vy *= drag; p.vz = Math.max(-90, p.vz * drag - 380 * s);
        p.x += p.vx * s; p.y += p.vy * s; p.z = Math.max(2, p.z + p.vz * s);
        const u = p.t / p.life, sc = W * p.sz * (u < 0.08 ? u / 0.08 : 1) * (u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1);
        X.set(h.w3(p.x), h.h3(p.z), h.d3(p.y)); Q.setFromAxisAngle(p.ax, p.rot + (p.spin * p.t) / 1000); S.set(sc, sc * asp, 1); M.compose(X, Q, S);
        const g = G[p.g]; if (ref !== undefined && p.y > ref + 4) g.front.setMatrixAt(g.nf++, M); else g.back.setMatrixAt(g.nb++, M);
      }
      for (const g of G) { g.back.count = g.nb; g.front.count = g.nf; g.back.instanceMatrix.needsUpdate = true; g.front.instanceMatrix.needsUpdate = true; }
      if (!on && !P.length) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

const ZONE_FS = `
#include <common>
uniform vec3 uCol; uniform float uA; uniform float uFlare; uniform float uArrow; uniform float uDir; uniform float uT; uniform float uK;
varying vec2 vUv;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 q = (vUv * 2.0 - 1.0) * uK;                                   // ellipse units: the ring at |q| = 1
  float d = length(q), w = 0.045 + 0.035 * uFlare;
  float band = exp(-pow((d - 1.0) / w, 2.0));
  float halo = exp(-pow((d - 1.0) / (0.2 + 0.12 * uFlare), 2.0)) * 0.32;
  float fill = (1.0 - smoothstep(0.8, 1.0, d)) * (0.05 + 0.16 * uFlare);
  float ang = atan(q.y, q.x), tick = smoothstep(0.8, 1.0, cos(ang * 16.0 + uT * 0.5)) * exp(-pow((d - 1.0) / 0.1, 2.0)) * 0.45;
  vec2 p = vec2(q.x * uDir, q.y + 1.0); float ch = 0.0;                // the arrow: two chevrons on the ring's near edge (the banner's cloth hides its far side), the way it springs him
  for (int i = 0; i < 2; i++) { float x0 = -0.32 + 0.3 * float(i), s2 = min(seg(p, vec2(x0 + 0.24, 0.0), vec2(x0, 0.34)), seg(p, vec2(x0 + 0.24, 0.0), vec2(x0, -0.34))); ch += exp(-pow(s2 / 0.05, 2.0)) * (i == 1 ? 1.0 : 0.65); }
  float a = uA * (band * (0.75 + 0.6 * uFlare) + halo * (0.6 + 0.9 * uFlare) + fill + tick * (1.0 + uFlare)) + uA * uArrow * ch * 1.2;
  vec3 col = mix(uCol, vec3(1.0, 0.97, 0.86), clamp(band * (0.25 + 0.6 * uFlare) + ch * uArrow * 0.7, 0.0, 1.0));
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A zone shown on the planks round `at` (world px): a ring of light on the floor exactly `rx` × `ry` px (along the field ×
 *  in depth), soft, with a faint fill and ticks turning slowly; `get()` each frame: its strength, its flare (the "now" cue:
 *  brighter, thicker, filled) and an arrow of light past the ring (`arrow` 0..1, `dir` ±1 along the field); null: it fades. */
export function zoneRing(f: Fx3D, at: V3, rx: number, ry: number, get: () => { a: number; flare: number; arrow: number; dir: number } | null, col = 0xffc65a): void {
  const h = f.host, K = 1.75, W3 = Math.abs(h.w3(at.x + rx * K) - h.w3(at.x - rx * K)), D3 = Math.abs(h.d3(at.y + ry * K) - h.d3(at.y - ry * K));
  const mat = new THREE.ShaderMaterial({ vertexShader: FLOOR_VS, fragmentShader: ZONE_FS,
    uniforms: { uCol: { value: new THREE.Color(col) }, uA: { value: 0 }, uFlare: { value: 0 }, uArrow: { value: 0 }, uDir: { value: 1 }, uT: { value: 0 }, uK: { value: K } },
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false; m.position.set(h.w3(at.x), 0.02, h.d3(at.y)); m.scale.set(W3, 1, D3); h.back.add(m);
  const drop = () => { m.parent?.remove(m); mat.dispose(); geo.dispose(); };
  let t = 0, end = -1, a0 = 0;
  run(f, {
    step: (dt) => {
      t += dt; mat.uniforms.uT.value = t / 1000;
      const g = end < 0 ? get() : null;
      if (g) { a0 = g.a; mat.uniforms.uA.value = g.a; mat.uniforms.uFlare.value = g.flare; mat.uniforms.uArrow.value = g.arrow; mat.uniforms.uDir.value = g.dir; }
      else if (end < 0) end = t;
      if (end >= 0) { const k = (t - end) / 300; mat.uniforms.uA.value = a0 * Math.max(0, 1 - k); if (k >= 1) { drop(); return false; } }
      return true;
    }, dispose: drop,
  });
}

/** A cocoon of petals round a held foe (`at`: his feet, world px): real petal pictures (`tex`) whirl up off the planks in a
 *  spiral and close round him into an egg-shaped shell (`rx` its widest radius, `h` its height) that turns slowly while
 *  the hold lasts (`ms`), gaps between the petals so he still shows through; then it bursts open — every petal flung out
 *  from him, tumbling, drifting down. Lit by the room; the petals in front of him over him, the rest behind. */
export function cocoon(f: Fx3D, at: V3, tex: (THREE.Texture | null | undefined)[], o: { ms: number; rx?: number; h?: number; n?: number; size?: number }): void {
  const h = f.host, maps = tex.filter((x): x is THREE.Texture => !!x), n = o.n ?? 84, RX = o.rx ?? 50, H = o.h ?? 176, ms = o.ms;
  const G = (maps.length ? maps : [null]).map((map) => {
    const mat = new THREE.MeshStandardMaterial({ map: map ?? undefined, color: map ? 0xffffff : 0xffb6d2, emissive: 0xff7aa8, emissiveIntensity: map ? 0.38 : 0.7, roughness: 0.6, metalness: 0, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1), back = new THREE.InstancedMesh(geo, mat, n), front = new THREE.InstancedMesh(geo, mat, n);
    back.frustumCulled = front.frustumCulled = false; back.count = front.count = 0; h.back.add(back); h.solid.add(front);
    return { mat, geo, back, front, nb: 0, nf: 0 };
  });
  const img = maps[0]?.image as { width?: number; height?: number } | undefined, W = h.w3(17 * (o.size ?? 1)), asp = img?.width && img.height ? img.height / img.width : 1;
  const GA = Math.PI * (3 - Math.sqrt(5));
  const P = Array.from({ length: n }, (_, i) => {
    const fz = (i + 0.5) / n, prof = 0.38 + 0.62 * Math.sin(Math.PI * (0.08 + 0.84 * fz)); // (narrow at his feet and head, widest round his middle)
    return { g: i % G.length, fz, th: i * GA, r: RX * prof * (0.94 + Math.random() * 0.12), delay: fz * 160 + Math.random() * 60, sz: 0.8 + Math.random() * 0.45, ph: Math.random() * 6,
      ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 6 + Math.random() * 10, rot: Math.random() * 6 };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qn = new THREE.Quaternion(), S = new THREE.Vector3(), X = new THREE.Vector3(), N = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  const toCam = f.viewXZ().negate(), cx = h.w3(at.x), cz = h.d3(at.y);
  const drop = () => { for (const g of G) { h.back.remove(g.back); h.solid.remove(g.front); g.back.dispose(); g.front.dispose(); g.geo.dispose(); g.mat.dispose(); } };
  const RISE = 380, END = ms + 900;
  let t = 0, burst = false;
  run(f, {
    step: (dt) => {
      t += dt; const s = dt / 1000;
      for (const g of G) { g.nb = 0; g.nf = 0; }
      if (!burst && t >= ms) { // it bursts open: each petal flung out from him along where it sat, and up
        burst = true;
        for (const p of P) { const nx = Math.cos(p.th), ny = Math.sin(p.th), sp = 240 + Math.random() * 220; p.vx = nx * sp; p.vy = ny * sp * 0.7; p.vz = 120 + Math.random() * 220 + (p.fz - 0.5) * 160; }
      }
      for (const p of P) {
        let sc = W * p.sz, wx: number, wy: number, wz: number;
        if (!burst) {
          const k = Math.min(1, Math.max(0, (t - p.delay) / RISE)), e = 1 - Math.pow(1 - k, 3); // (whirling up off the planks into its place)
          const th = p.th + (1 - e) * 4.2 + (t / 1000) * 0.7, r = p.r * (1 + (1 - e) * 0.9) * (1 + 0.03 * Math.sin(t / 260 + p.ph));
          wx = at.x + Math.cos(th) * r; wy = at.y + Math.sin(th) * r * 0.9; wz = H * p.fz * e + 4;
          p.x = wx; p.y = wy; p.z = wz; sc *= Math.min(1, k * 3);
          N.set(Math.cos(th), 0.25 * (p.fz - 0.5), Math.sin(th) * 0.9).normalize(); // (lying on its shell, facing out)
          Qn.setFromUnitVectors(Z, N); Q.setFromAxisAngle(p.ax, 0.5 * Math.sin(t / 180 + p.ph)); Q.premultiply(Qn);
        } else {
          const drag = Math.pow(0.2, s); p.vx *= drag; p.vy *= drag; p.vz = Math.max(-100, p.vz * drag - 460 * s);
          p.x += p.vx * s; p.y += p.vy * s; p.z = Math.max(2, p.z + p.vz * s);
          wx = p.x; wy = p.y; wz = p.z; const u = (t - ms) / 900; sc *= Math.max(0, 1 - Math.max(0, u - 0.55) / 0.45);
          Q.setFromAxisAngle(p.ax, p.rot + (p.spin * (t - ms)) / 1000);
        }
        X.set(h.w3(wx), h.h3(wz), h.d3(wy)); S.set(sc, sc * asp, 1); M.compose(X, Q, S);
        const g = G[p.g], inFront = (X.x - cx) * toCam.x + (X.z - cz) * toCam.z > 0;
        if (inFront) g.front.setMatrixAt(g.nf++, M); else g.back.setMatrixAt(g.nb++, M);
      }
      for (const g of G) { g.back.count = g.nb; g.front.count = g.nf; g.back.instanceMatrix.needsUpdate = true; g.front.instanceMatrix.needsUpdate = true; }
      if (t >= END) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

// ------------------------------------------------------------------ painted cuts in depth (David 18 Oct 22:56: "in depth, not a page")

const PAINT_FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform sampler2D uMap; uniform float uA; uniform float uSweep; uniform float uTail; uniform vec3 uTint; uniform float uLo; uniform float uHi; uniform float uGlow; uniform float uPart; uniform float uErode; uniform float uT;
uniform sampler2D uNoise;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  float u = vUv.x, v = vUv.y;
  if (u > uSweep) discard;
  float L = max(min(uTail, uSweep), 0.001), tx = (u - (uSweep - L)) / L;   // the painted band laid from its tail to the cut's head
  if (tx <= 0.0) discard;
  vec4 t = texture2D(uMap, vec2(tx, v));
  float m = max(t.r, max(t.g, t.b)), a = smoothstep(uLo, uHi, m);       // painted on black: its brightness is its cover
  vec3 col = min(t.rgb / max(a, 0.001), vec3(1.0)) * uTint;
  float n = texture2D(uNoise, vec2(u * 3.0 - uT * 0.8, v * 0.6 + 0.2)).r;
  a *= smoothstep(uErode, uErode + 0.3, 0.6 * n + 0.5 * tx);              // it dissolves from its tail as it goes
  if (uPart > 0.5) { float hot = smoothstep(0.5, 0.95, dot(t.rgb, vec3(0.3, 0.59, 0.11))); col = col * hot * uGlow; a *= hot; } // (its white-hot light only: his crimson added blooms into a pink haze)
  a *= uA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const paintTexs = new Map<string, THREE.Texture | null>();
/** A painted texture by url (loaded once; null until it has arrived). */
export function paintTex(src: string): THREE.Texture | null {
  if (paintTexs.has(src)) return paintTexs.get(src) ?? null;
  paintTexs.set(src, null);
  new THREE.TextureLoader().load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.ClampToEdgeWrapping; paintTexs.set(src, t); });
  return null;
}

/** A painted cut in depth: the ribbon arc of `ring` (its plane, sweep, follow, live turn — the same options) wearing a painted
 *  band (`tex`: GPT on black — its head at the picture's right, its white-hot edge along its top), laid from the cut's tail
 *  to its head as it sweeps, its part behind the fighters in the room and its part in front over them; a little of its
 *  hottest light added (`glow`); it dissolves from its tail. Nothing drawn until the band has loaded. */
export function paintArc(f: Fx3D, tex: string, at: V3, dir: number, o: Ring & { glow?: number; tint?: number; lo?: number; hi?: number } = {}): void {
  let map = paintTex(tex); // (on its way at a first cast: the arc is there, drawn from the frame the band arrives)
  if (!o.quiet) f.onPiece?.('slash', at, (o.r ?? 105) > 160 ? 1 : 0);
  const h = f.host, R = h.w3(o.r ?? 105), W = h.w3(o.w ?? 40), ms = o.ms ?? 260, sweepMs = ms * (o.sweep ?? 0.4), holdMs = o.hold ?? ms * 0.15;
  const a0 = THREE.MathUtils.degToRad(o.a0 ?? -40), a1 = THREE.MathUtils.degToRad(o.a1 ?? 160);
  const n = 64, pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + (a1 - a0) * k, taper = Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * k)), 0.35), rin = R - W * taper;
    pos.set([Math.sin(a) * rin * dir, Math.cos(a) * rin, 0, Math.sin(a) * R * dir, Math.cos(a) * R, 0], i * 6);
    uv.set([k, 0, k, 1], i * 4);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = (glow: boolean, front: boolean, hz: number) => {
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: PAINT_FS,
      uniforms: { uMap: { value: map }, uA: { value: o.a ?? 1 }, uSweep: { value: 0 }, uTail: { value: o.tail ?? 1 }, uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uLo: { value: o.lo ?? 0.05 }, uHi: { value: o.hi ?? 0.55 },
        uGlow: { value: o.glow ?? 0.35 }, uPart: { value: glow ? 1 : 0 }, uErode: { value: -0.4 }, uT: { value: Math.random() * 10 }, uNoise: { value: f.noiseTex } },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    if (!o.over) { m.clippingPlanes = f.cut(hz, front); m.clipping = true; }
    return m;
  };
  const fwd = (o.fwd ?? 0) * dir, lift = o.y0 ?? 90;
  let p = new THREE.Vector3(h.w3(at.x + fwd), h.h3(at.z + lift), h.d3(at.y));
  const meshes = o.over ? [new THREE.Mesh(geo, mat(false, true, p.z)), new THREE.Mesh(geo, mat(true, true, p.z))]
    : [new THREE.Mesh(geo, mat(false, false, p.z)), new THREE.Mesh(geo, mat(true, false, p.z)), new THREE.Mesh(geo, mat(false, true, p.z)), new THREE.Mesh(geo, mat(true, true, p.z))];
  if (o.over) { h.solid.add(meshes[0]); h.glow.add(meshes[1]); }
  else { h.back.add(meshes[0], meshes[1]); h.solid.add(meshes[2]); h.glow.add(meshes[3]); }
  let lv = o.live?.();
  const place = () => {
    for (const m of meshes) {
      m.frustumCulled = false; m.position.copy(p);
      m.rotation.set(0, 0, 0); m.rotateY(f.camYaw() + THREE.MathUtils.degToRad(lv?.yaw ?? o.yaw ?? 0) * dir); m.rotateX(THREE.MathUtils.degToRad(90 - (o.tilt ?? 30))); m.rotateZ(THREE.MathUtils.degToRad(lv?.roll ?? o.roll ?? 0) * dir);
    }
  };
  place();
  const drop = () => { for (const m of meshes) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } geo.dispose(); };
  const set = (k: string, v: number) => { for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; };
  let t = 0, endAt = -1;
  const fadeMs = o.fade ?? 200;
  run(f, {
    step: (dt) => {
      t += dt; lv = o.live?.();
      if (!map) { map = paintTex(tex); if (map) for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms.uMap.value = map; }
      const fo = o.follow?.(); if (fo) p = new THREE.Vector3(h.w3(fo.x + fwd), h.h3(fo.z + lift), h.d3(fo.y));
      if (fo || lv) place();
      if (o.until && endAt < 0 && (o.until() || t >= ms)) endAt = t;
      const ks = Math.min(1, t / Math.max(1, sweepMs));
      const kd = o.until ? (endAt < 0 ? 0 : Math.min(1, (t - endAt) / fadeMs)) : Math.max(0, (t - sweepMs - holdMs) / Math.max(1, ms - sweepMs - holdMs));
      set('uSweep', 1.0001 * outCubic(ks)); set('uErode', -0.4 + 1.6 * kd * kd); set('uT', t / 1000);
      set('uA', map ? (o.a ?? 1) * (lv?.a ?? 1) * (1 - Math.max(0, kd - 0.6) / 0.4) : 0);
      if (o.until ? endAt >= 0 && t - endAt >= fadeMs : t >= ms) { drop(); return false; }
      return true;
    }, dispose: drop,
  });
}

const FLY_FS = `
uniform sampler2D uMap; uniform float uA; uniform vec3 uTint; uniform float uLo; uniform float uHi; uniform float uGlow; uniform float uPart;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float m = max(t.r, max(t.g, t.b)), a = smoothstep(uLo, uHi, m);       // painted on black: its brightness is its cover
  vec3 col = min(t.rgb / max(a, 0.001), vec3(1.0)) * uTint;
  if (uPart > 0.5) { float hot = smoothstep(0.5, 0.95, dot(t.rgb, vec3(0.3, 0.59, 0.11))); col = col * uGlow; a = hot; } // (its white-hot light only)
  a *= uA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export interface Fly {
  /** its width (px), its life (ms), fading in and out (ms), its scale over its life (s0 → s1) */
  w: number; ms: number; fadeIn?: number; fadeOut?: number; grow?: [number, number];
  /** copies of its light trailing it at earlier points of its flight (`lag` ms apart): its speed */
  ghosts?: number; lag?: number;
  /** strength, colour, its black key (lo..hi), the share of its hottest light added (it blooms) */
  a?: number; tint?: number; lo?: number; hi?: number; glow?: number;
  /** flying the other way: mirrored top to bottom, its back kept up (the picture flies right) */
  left?: boolean;
  /** deeper than this (world y) it flies behind the fighters, nearer it over them (else always over them) */
  hz?: number;
}
/** A painted thing flying through the room (the swallow of light): upright, turned to the eye, its picture's head (+x) along
 *  its flight as the eye sees it (turning with it through a hook), on `path(t)` (world px, t ms of its life) — behind the
 *  fighters while it is deeper than `hz`, over them nearer; a few copies of its light trail it. */
export function paintFly(f: Fx3D, tex: string, path: (t: number) => V3, o: Fly): void {
  let map = paintTex(tex);
  const h = f.host, geo = new THREE.PlaneGeometry(1, 1), n = 1 + (o.ghosts ?? 0), lag = o.lag ?? 22;
  const mk = (glow: boolean) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FLY_FS,
    uniforms: { uMap: { value: map }, uA: { value: 0 }, uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uLo: { value: o.lo ?? 0.05 }, uHi: { value: o.hi ?? 0.5 }, uGlow: { value: o.glow ?? 0.5 }, uPart: { value: glow ? 1 : 0 } },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
  type M = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  const copies = Array.from({ length: n }, (_, i) => ({ body: i === 0 ? (new THREE.Mesh(geo, mk(false)) as M) : null, light: new THREE.Mesh(geo, mk(true)) as M }));
  const all = copies.flatMap((c) => (c.body ? [c.body, c.light] : [c.light]));
  for (const m of all) m.frustumCulled = false;
  /** each copy in the room behind the fighters or over them (its picture and its light) */
  const layer = (c: (typeof copies)[number], behind: boolean) => {
    if (c.body && c.body.parent !== (behind ? h.back : h.solid)) { c.body.parent?.remove(c.body); (behind ? h.back : h.solid).add(c.body); }
    if (c.light.parent !== (behind ? h.back : h.glow)) { c.light.parent?.remove(c.light); (behind ? h.back : h.glow).add(c.light); }
  };
  const drop = () => { for (const m of all) { m.parent?.remove(m); m.material.dispose(); } geo.dispose(); };
  const inv = new THREE.Quaternion(), dv = new THREE.Vector3();
  let t = 0, aspect = 1;
  run(f, {
    step: (dt) => {
      t += dt;
      if (t >= o.ms) { drop(); return false; }
      if (!map) { map = paintTex(tex); if (map) for (const m of all) m.material.uniforms.uMap.value = map; }
      if (!map) return true;
      const img = map.image as { width?: number; height?: number } | undefined; if (img?.width && img.height) aspect = img.height / img.width;
      const fin = Math.min(1, t / Math.max(1, o.fadeIn ?? 50)), fout = Math.min(1, (o.ms - t) / Math.max(1, o.fadeOut ?? 150));
      const s = o.grow ? o.grow[0] + (o.grow[1] - o.grow[0]) * outCubic(t / o.ms) : 1, W = h.w3(o.w) * s;
      inv.copy(h.camera.quaternion).invert();
      copies.forEach((c, i) => {
        const ti = t - i * lag, a = ti < 0 ? 0 : (o.a ?? 1) * fin * fout * (i === 0 ? 1 : 0.5 * (1 - i / n));
        const ms = c.body ? [c.body, c.light] : [c.light];
        for (const m of ms) m.material.uniforms.uA.value = a;
        if (ti < 0) return;
        const at = path(ti), P = f.unit(at), sc = 1 - 0.07 * i;
        layer(c, o.hz !== undefined && at.y < o.hz - 2);
        dv.copy(f.unit(path(ti + 6))).sub(f.unit(path(Math.max(0, ti - 6)))).applyQuaternion(inv);
        const ang = dv.lengthSq() > 1e-12 ? Math.atan2(dv.y, dv.x) : 0;
        for (const m of ms) { m.position.copy(P); m.quaternion.copy(h.camera.quaternion); m.rotateZ(ang); m.scale.set(W * sc, W * sc * aspect * (o.left ? -1 : 1), 1); }
      });
      return true;
    }, dispose: drop,
  });
}

// the blade's line along a trail (added light): white-hot along its middle, his rose at its soft edges, faint at its tail
const CORE_FS = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uCol; uniform float uA;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  float u = vUv.x, d = abs(vUv.y - 0.5) * 2.0;
  float core = exp(-d * d * 14.0), halo = exp(-d * d * 2.6) * 0.45, along = pow(u, 1.3);
  float a = uA * along * (core + halo);
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), core * 0.85), min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/** A painted trail behind a flight (the swallow's Λ): a ribbon through the last `len` ms of `path` (world px, t ms) turned to
 *  face the eye, wearing a painted band (`tex`: GPT on black — its head at the right, its white-hot line `line` of the way
 *  up it) laid from the trail's tail to its head, thin at its tail, its line on the flight and its smoke on the inside of
 *  the turn (`edge` 1: it turns to its right as it flies, −1 to its left); along the flight the blade's own line of light
 *  (`core` px wide, white-hot, in `col`); deeper than `hz` (world y) behind the fighters, nearer over them. Its head runs to
 *  `ms`, then its tail catches up with it over `fade` ms as it dissolves. */
export function paintTrail(f: Fx3D, tex: string, path: (t: number) => V3, o: { ms: number; len: number; w: number; hz: number; edge?: number; line?: number; core?: number; col?: number; fade?: number; glow?: number; tint?: number; lo?: number; hi?: number; a?: number }): void {
  let map = paintTex(tex);
  const h = f.host, N = 48, idx: number[] = [], uv = new Float32Array((N + 1) * 2 * 2);
  for (let i = 0; i <= N; i++) { uv.set([i / N, 0, i / N, 1], i * 4); if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const strip = () => { const pos = new Float32Array((N + 1) * 2 * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return { pos, g }; };
  const band = strip(), line = strip(), hz = h.d3(o.hz);
  const clip = (m: THREE.ShaderMaterial, front: boolean) => { m.clippingPlanes = f.cut(hz, front); m.clipping = true; return m; };
  const mat = (glow: boolean, front: boolean) => clip(new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: PAINT_FS,
    uniforms: { uMap: { value: map }, uA: { value: 0 }, uSweep: { value: 1.0001 }, uTail: { value: 1 }, uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uLo: { value: o.lo ?? 0.05 }, uHi: { value: o.hi ?? 0.5 },
      uGlow: { value: o.glow ?? 0.4 }, uPart: { value: glow ? 1 : 0 }, uErode: { value: -0.4 }, uT: { value: Math.random() * 10 }, uNoise: { value: f.noiseTex } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }), front);
  const coreMat = (front: boolean) => clip(new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: CORE_FS, uniforms: { uCol: { value: new THREE.Color(o.col ?? SAM.rose) }, uA: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }), front);
  const meshes = [new THREE.Mesh(band.g, mat(false, false)), new THREE.Mesh(band.g, mat(true, false)), new THREE.Mesh(band.g, mat(false, true)), new THREE.Mesh(band.g, mat(true, true))];
  (meshes[1].material as THREE.ShaderMaterial).uniforms.uGlow.value *= 0.35; // (behind the fighters the room blooms it: its added light there a third, or it washes pale)
  const cores = o.core ? [new THREE.Mesh(line.g, coreMat(false)), new THREE.Mesh(line.g, coreMat(true))] : [];
  h.back.add(meshes[0], meshes[1]); h.solid.add(meshes[2]); h.glow.add(meshes[3]);
  if (cores.length) { h.back.add(cores[0]); h.glow.add(cores[1]); }
  const all = [...meshes, ...cores];
  for (const m of all) m.frustumCulled = false;
  const drop = () => { for (const m of all) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } band.g.dispose(); line.g.dispose(); };
  const set = (k: string, v: number) => { for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; };
  const P = Array.from({ length: N + 1 }, () => new THREE.Vector3()), tan = new THREE.Vector3(), view = new THREE.Vector3(), side = new THREE.Vector3();
  const W = h.w3(o.w), CW = h.w3(o.core ?? 0), fade = o.fade ?? 160, edge = o.edge ?? 1, off = 2 * (o.line ?? 0.67) - 1; // (the band shifted so its line runs on the flight)
  let t = 0;
  run(f, {
    step: (dt) => {
      t += dt;
      if (t >= o.ms + fade) { drop(); return false; }
      if (!map) { map = paintTex(tex); if (map) for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms.uMap.value = map; }
      const kf = Math.max(0, (t - o.ms) / fade), th = Math.min(t, o.ms), t0 = Math.max(0, th - o.len), tt = t0 + (th - t0) * kf * kf;
      for (let i = 0; i <= N; i++) P[i].copy(f.unit(path(tt + ((th - tt) * i) / N)));
      const cam = h.camera.position;
      for (let i = 0; i <= N; i++) {
        tan.copy(P[Math.min(N, i + 1)]).sub(P[Math.max(0, i - 1)]); if (tan.lengthSq() < 1e-12) tan.set(1, 0, 0);
        view.copy(cam).sub(P[i]); side.crossVectors(view, tan).normalize().multiplyScalar(edge); // (toward the outside of the turn)
        const k = i / N, taper = (0.18 + 0.82 * Math.pow(k, 0.55)) * (1 - 0.45 * Math.max(0, (k - 0.94) / 0.06)), wk = W * 0.5 * taper, ck = CW * 0.5 * (0.3 + 0.7 * taper);
        const cx = P[i].x - side.x * off * wk, cy = P[i].y - side.y * off * wk, cz = P[i].z - side.z * off * wk; // (the band's middle: its line on the flight)
        band.pos.set([cx - side.x * wk, cy - side.y * wk, cz - side.z * wk, cx + side.x * wk, cy + side.y * wk, cz + side.z * wk], i * 6);
        if (CW) line.pos.set([P[i].x - side.x * ck, P[i].y - side.y * ck, P[i].z - side.z * ck, P[i].x + side.x * ck, P[i].y + side.y * ck, P[i].z + side.z * ck], i * 6);
      }
      (band.g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (line.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const a = map && th - tt > 1 ? (o.a ?? 1) * (1 - kf) : 0;
      set('uA', a); set('uErode', -0.4 + 1.2 * kf); set('uT', t / 1000);
      for (const m of cores) (m.material as THREE.ShaderMaterial).uniforms.uA.value = th - tt > 1 ? (o.a ?? 1) * (1 - kf) * (1 - kf) : 0;
      return true;
    }, dispose: drop,
  });
}
