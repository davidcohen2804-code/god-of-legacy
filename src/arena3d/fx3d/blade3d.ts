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
const run = (f: Fx3D, it: Item) => (f as unknown as { items: Item[] }).items.push(it);

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
uniform float uA; uniform float uSweep; uniform float uTail; uniform float uFill; uniform float uDark; uniform float uErode; uniform float uT; uniform float uPart; uniform float uInkW;
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
  float band = smoothstep(uInkW * 0.7, uInkW + 0.12, v) * (1.0 - smoothstep(0.93, 1.0, v));
  float edge = smoothstep(0.72, 0.9, v) * (1.0 - smoothstep(0.955, 1.0, v));
  float keep = smoothstep(uErode, uErode + 0.25, 0.55 * n + 0.6 * along);
  vec3 col; float a;
  if (uPart < 0.5) {
    col = uInk;
    a = uA * along * keep * max(ink * 0.96, body * uDark * 0.95) * (0.88 + 0.12 * n2);
  } else {
    float hot = max(edge, head * body);
    col = mix(uLit * uGain, uCore * (uGain + 0.7), hot) * (0.85 + 0.3 * n2);   // (the band saturated; the core white-hot, blooming)
    a = uA * along * keep * (band * 0.8 + hot * 0.95) * (1.0 - uDark);
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
      uniforms: { uCore: { value: U.uCore }, uInk: { value: U.uInk }, uLit: { value: U.uLit }, uGain: { value: o.gain ?? 1.25 }, uA: { value: o.a ?? 1 }, uSweep: { value: 0 }, uTail: { value: 0.3 }, uFill: { value: o.fill ?? 0 },
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
  const place = () => {
    for (const m of meshes) {
      m.frustumCulled = false; m.position.copy(p);
      m.rotation.set(0, 0, 0); m.rotateY(f.camYaw() + THREE.MathUtils.degToRad(o.yaw ?? 0) * dir); m.rotateX(THREE.MathUtils.degToRad(90 - (o.tilt ?? 30))); m.rotateZ(THREE.MathUtils.degToRad(o.roll ?? 0) * dir);
    }
  };
  place();
  const drop = () => { for (const m of meshes) { m.parent?.remove(m); (m.material as THREE.Material).dispose(); } geo.dispose(); };
  const set = (k: string, v: number) => { for (const m of meshes) (m.material as THREE.ShaderMaterial).uniforms[k].value = v; };
  let t = 0;
  run(f, {
    step: (dt) => {
      t += dt;
      const fo = o.follow?.(); if (fo) { p = new THREE.Vector3(h.w3(fo.x + fwd), h.h3(fo.z + lift), h.d3(fo.y)); place(); }
      const ks = Math.min(1, t / Math.max(1, sweepMs)), kd = Math.max(0, (t - sweepMs - holdMs) / Math.max(1, ms - sweepMs - holdMs));
      set('uSweep', 1.0001 * outCubic(ks)); set('uTail', 0.25 + ((o.tail ?? 1) - 0.25) * outCubic(ks));
      set('uDark', Math.min(1, kd * 1.6)); set('uErode', -0.4 + 1.55 * kd * kd); set('uT', t / 1000);
      if (t >= ms) { drop(); return false; }
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
export function inkBurst(f: Fx3D, at: V3, o: { r?: number; n?: number; ms?: number; foeY?: number; col?: number; up?: number } = {}): void {
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
  h.flare(o0.x, o0.y, o0.z + 0.1, col, 6, 3, ms * 0.5);
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

