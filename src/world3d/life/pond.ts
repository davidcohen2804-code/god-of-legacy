// A koi pond: a stone-rimmed basin of still water that mirrors the place (the lanterns, the temple, the sky — a real
// reflection, drawn once more from under the water; or, on a weak machine, the sky's colours), its surface alive with
// slow ripples and the rings the koi make when they rise, the low sun glittering on it; koi gliding under the surface,
// lily pads drifting, a lotus or two. Everything but the water lives in the scene like the rest of the room.
import * as THREE from 'three';
import { Life, Wind, rng, tex, koiCanvas, lilyCanvas } from './kit';

export interface PondAt {
  /** The water's middle, its size (units) and the ground's height round it (the water lies a little under the rim). */
  x: number; z: number; w: number; d: number; y: number;
}
export interface PondOpts {
  wind: Wind; seed?: number;
  /** The rim's stone (the room's own, so it matches the paving). */
  stone: THREE.Material;
  /** A real reflection (an extra draw of the place from under the water) or the sky's colours alone. */
  mirror: boolean;
  /** What to leave out of the reflection (particles, petals: the cost without the picture). */
  hide?: () => THREE.Object3D[];
  /** The sun's direction (toward the sun) and colour, the sky's low and middle colours. */
  sunDir: THREE.Vector3; sunColor: THREE.Color; skyLow: THREE.Color; skyMid: THREE.Color;
  koi?: number; pads?: number;
}

const NR = 6; // ripple rings kept at once

/** A mirror plane: the place drawn once more by a camera reflected in it (the oblique near plane clipping what lies under
 *  it), into a small texture the water reads through its ripples. */
class Mirror extends THREE.Mesh {
  readonly target: THREE.WebGLRenderTarget;
  readonly textureMatrix = new THREE.Matrix4();
  private cam = new THREE.PerspectiveCamera();
  private plane = new THREE.Plane(); private normal = new THREE.Vector3(); private mirrorPos = new THREE.Vector3(); private camPos = new THREE.Vector3();
  private rot = new THREE.Matrix4(); private aim = new THREE.Vector3(); private view = new THREE.Vector3(); private tgt = new THREE.Vector3(); private clip = new THREE.Vector4(); private q = new THREE.Vector4();
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, w: number, h: number, private hide?: () => THREE.Object3D[]) {
    super(geometry, material);
    this.target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.onBeforeRender = (renderer, scene, camera) => this.draw(renderer, scene, camera as THREE.PerspectiveCamera);
  }
  private draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.mirrorPos.setFromMatrixPosition(this.matrixWorld); this.camPos.setFromMatrixPosition(camera.matrixWorld);
    this.rot.extractRotation(this.matrixWorld);
    this.normal.set(0, 0, 1).applyMatrix4(this.rot);
    this.view.subVectors(this.mirrorPos, this.camPos);
    if (this.view.dot(this.normal) > 0) return; // (seen from under)
    this.view.reflect(this.normal).negate().add(this.mirrorPos);
    this.rot.extractRotation(camera.matrixWorld);
    this.aim.set(0, 0, -1).applyMatrix4(this.rot).add(this.camPos);
    this.tgt.subVectors(this.mirrorPos, this.aim).reflect(this.normal).negate().add(this.mirrorPos);
    const vc = this.cam;
    vc.position.copy(this.view); vc.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.normal); vc.lookAt(this.tgt);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // the oblique near plane: nothing under the water gets into its reflection
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.mirrorPos).applyMatrix4(vc.matrixWorldInverse);
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const P = vc.projectionMatrix, q = this.q;
    q.x = (Math.sign(this.clip.x) + P.elements[8]) / P.elements[0]; q.y = (Math.sign(this.clip.y) + P.elements[9]) / P.elements[5]; q.z = -1; q.w = (1 + P.elements[10]) / P.elements[14];
    this.clip.multiplyScalar(2 / this.clip.dot(q));
    P.elements[2] = this.clip.x; P.elements[6] = this.clip.y; P.elements[10] = this.clip.z + 1 - 0.003; P.elements[14] = this.clip.w;
    // draw the place into the mirror (without what costs more than it shows)
    const hidden = this.hide?.().filter((o) => o.visible) ?? [];
    for (const o of hidden) o.visible = false;
    this.visible = false;
    const rt = renderer.getRenderTarget(), xr = renderer.xr.enabled, sh = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target); renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, vc);
    renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = sh; renderer.setRenderTarget(rt);
    const vp = (camera as THREE.Camera & { viewport?: THREE.Vector4 }).viewport; if (vp) renderer.state.viewport(vp);
    this.visible = true;
    for (const o of hidden) o.visible = true;
  }
  disposeMirror(): void { this.target.dispose(); }
}

const NOISE = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n'
  + 'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }\n';

export function pond(scene: THREE.Scene, at: PondAt, opts: PondOpts): Life {
  const R = rng(opts.seed ?? 77);
  const disposables: { dispose(): void }[] = [];
  const group = new THREE.Group(); scene.add(group);
  const yW = at.y - 0.03, hw = at.w / 2, hd = at.d / 2;
  // ---- the basin: a bevelled stone rim, dark walls and a dark floor under the water
  const dark = new THREE.MeshStandardMaterial({ color: 0x18231f, roughness: 1 }); disposables.push(dark);
  const rim = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); disposables.push(g); const m = new THREE.Mesh(g, opts.stone); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const rw = 0.26, rh = 0.13;
  rim(at.w + rw * 2, rh, rw, at.x, at.y, at.z - hd - rw / 2); rim(at.w + rw * 2, rh, rw, at.x, at.y, at.z + hd + rw / 2);
  rim(rw, rh, at.d, at.x - hw - rw / 2, at.y, at.z); rim(rw, rh, at.d, at.x + hw + rw / 2, at.y, at.z);
  { // the basin under the water: a dark floor and the walls up to the rim (open above: the reflection looks through)
    const wall = (w: number, x: number, z: number, ry: number) => { const g = new THREE.PlaneGeometry(w, 0.3); g.rotateY(ry); g.translate(x, at.y - 0.15, z); disposables.push(g); group.add(new THREE.Mesh(g, dark)); };
    wall(at.w, at.x, at.z - hd, 0); wall(at.w, at.x, at.z + hd, Math.PI); wall(at.d, at.x - hw, at.z, Math.PI / 2); wall(at.d, at.x + hw, at.z, -Math.PI / 2);
    const g = new THREE.PlaneGeometry(at.w, at.d); g.rotateX(-Math.PI / 2); g.translate(at.x, at.y - 0.3, at.z); disposables.push(g); group.add(new THREE.Mesh(g, dark));
  }
  // ---- the water
  const water = new THREE.PlaneGeometry(at.w, at.d, 1, 1); disposables.push(water);
  const rings = Array.from({ length: NR }, () => new THREE.Vector4(0, 0, -100, 0));
  const u = {
    tDiffuse: { value: null as THREE.Texture | null }, textureMatrix: { value: new THREE.Matrix4() }, uMirror: { value: opts.mirror ? 1 : 0 },
    uTime: { value: 0 }, uDim: { value: 0 }, uRings: { value: rings }, uHalf: { value: new THREE.Vector2(hw, hd) }, uCentre: { value: new THREE.Vector2(at.x, at.z) },
    uSunDir: { value: opts.sunDir.clone().normalize() }, uSunColor: { value: opts.sunColor.clone() }, uSkyLow: { value: opts.skyLow.clone() }, uSkyMid: { value: opts.skyMid.clone() },
    uDeep: { value: new THREE.Color(0x173a38) }, uShallow: { value: new THREE.Color(0x3f6a58) }, uWind: { value: new THREE.Vector2(0.3, 0.05) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: false, transparent: false,
    vertexShader: 'uniform mat4 textureMatrix; varying vec3 vW; varying vec4 vM; varying vec2 vUv;\n'
      + 'void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vM = textureMatrix * w; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uMirror, uTime, uDim; uniform vec4 uRings[' + NR + ']; uniform vec2 uHalf, uCentre, uWind; uniform vec3 uSunDir, uSunColor, uSkyLow, uSkyMid, uDeep, uShallow;\n'
      + 'varying vec3 vW; varying vec4 vM; varying vec2 vUv;\n' + NOISE
      + 'float height(vec2 p){ float h = 0.5 * noise(p * 3.1 + uTime * uWind * 0.35) + 0.3 * noise(p * 7.3 - uTime * vec2(0.05, 0.08)) + 0.2 * noise(p * 13.0 + uTime * vec2(0.09, -0.04));\n'
      + '  for (int i = 0; i < ' + NR + '; i++) { vec4 r = uRings[i]; float age = uTime - r.z; if (age <= 0.0 || age > 3.5) continue; float d = distance(p, r.xy), rr = age * 0.55;\n'
      + '    h += r.w * exp(-age * 1.1) * sin((d - rr) * 42.0) * exp(-abs(d - rr) * 9.0) * smoothstep(0.0, 0.08, age); } return h; }\n'
      + 'void main(){ vec2 p = vW.xz; float e = 0.015; float h0 = height(p), hx = height(p + vec2(e, 0.0)), hz = height(p + vec2(0.0, e));\n'
      + '  vec3 N = normalize(vec3(-(hx - h0) / e * 0.045, 1.0, -(hz - h0) / e * 0.045));\n'
      + '  vec3 V = normalize(cameraPosition - vW); float cosT = max(dot(N, V), 0.0); float fr = 0.22 + 0.78 * pow(1.0 - cosT, 3.0);\n'
      + '  vec2 edge = uHalf - abs(p - uCentre); float ed = min(edge.x, edge.y); float shallow = 1.0 - smoothstep(0.0, 0.3, ed);\n'
      + '  vec3 base = mix(uDeep, uShallow, shallow * 0.8);\n'
      + '  vec3 skyR = mix(uSkyLow, uSkyMid, clamp(N.z * 2.0 + 0.5, 0.0, 1.0)) * 0.9;\n'
      + '  vec3 refl = skyR; if (uMirror > 0.5) { vec4 mc = vM; mc.xy += N.xz * 0.22 * mc.w; refl = texture2DProj(tDiffuse, mc).rgb; }\n'
      + '  vec3 H = normalize(uSunDir + V); float spec = pow(max(dot(N, H), 0.0), 220.0) * 1.8 + pow(max(dot(N, H), 0.0), 24.0) * 0.08;\n'
      + '  vec3 c = mix(base, refl, fr) + uSunColor * spec * (1.0 - uDim) + vec3(0.9, 0.95, 1.0) * smoothstep(0.05, 0.0, ed) * 0.12;\n'
      + '  gl_FragColor = vec4(c * (1.0 - 0.35 * uDim), 1.0); }',
  });
  disposables.push(mat);
  let mirror: Mirror | null = null, waterMesh: THREE.Mesh;
  const floaters: THREE.Object3D[] = [];
  if (opts.mirror) { mirror = new Mirror(water, mat, 512, 288, () => [...(opts.hide?.() ?? []), ...floaters]); u.tDiffuse.value = mirror.target.texture; u.textureMatrix.value = mirror.textureMatrix; waterMesh = mirror; }
  else waterMesh = new THREE.Mesh(water, mat);
  waterMesh.name = 'pond-water';
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(at.x, yW, at.z); waterMesh.receiveShadow = false; group.add(waterMesh);
  let ringAt = 0;
  const ring = (x: number, z: number, strength: number, t: number) => { rings[ringAt].set(x, z, t, strength); ringAt = (ringAt + 1) % NR; };
  // ---- the koi: flat painted fish gliding just under the surface, their tails sculling
  const koiN = opts.koi ?? 5, koi: { m: THREE.Mesh; x: number; z: number; h: number; sp: number; ph: number; gulp: number; u: { value: number } }[] = [];
  const koiTex = [0, 1, 2].map((v) => tex(koiCanvas(v))); disposables.push(...koiTex);
  for (let i = 0; i < koiN; i++) {
    const g = new THREE.PlaneGeometry(0.3, 0.13, 10, 1); disposables.push(g);
    const uPh = { value: R() * 6.28 };
    const m = new THREE.MeshBasicMaterial({ map: koiTex[i % 3], alphaTest: 0.4, color: 0x9ab0b0, transparent: true, opacity: 0.92, depthWrite: false }); disposables.push(m);
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = u.uTime; sh.uniforms.uPh = uPh; sh.vertexShader = 'uniform float uTime, uPh;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat tail = 1.0 - uv.x; transformed.y += sin(uTime * 7.5 + uPh - uv.x * 7.0) * 0.028 * tail * tail;'); };
    const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; group.add(mesh); floaters.push(mesh);
    koi.push({ m: mesh, x: at.x + (R() - 0.5) * at.w * 0.6, z: at.z + (R() - 0.5) * at.d * 0.6, h: R() * 6.28, sp: 0.1 + R() * 0.1, ph: R() * 6.28, gulp: 4 + R() * 12, u: uPh });
  }
  // ---- lily pads and a lotus or two
  const padN = opts.pads ?? 6, pads: { m: THREE.Mesh; ph: number; x: number; z: number }[] = [];
  const padTex = tex(lilyCanvas()); disposables.push(padTex);
  const padMat = new THREE.MeshStandardMaterial({ map: padTex, alphaTest: 0.5, roughness: 0.7, side: THREE.DoubleSide }); disposables.push(padMat);
  const lotusMat = new THREE.MeshStandardMaterial({ color: 0xf7a8c0, emissive: 0x6a2040, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }); disposables.push(lotusMat);
  for (let i = 0; i < padN; i++) {
    const s = 0.2 + R() * 0.14, g = new THREE.PlaneGeometry(s, s); disposables.push(g);
    const m = new THREE.Mesh(g, padMat); m.rotation.x = -Math.PI / 2; m.rotation.z = R() * 6.28; m.renderOrder = 3;
    const x = at.x + (R() - 0.5) * (at.w - 0.5), z = at.z + (R() - 0.5) * (at.d - 0.4);
    m.position.set(x, yW + 0.004, z); group.add(m); pads.push({ m, ph: R() * 6.28, x, z }); floaters.push(m);
    if (i < 2) { // a lotus on it: a cup of petals
      const lg = new THREE.LatheGeometry([[0.01, 0], [0.035, 0.01], [0.06, 0.05], [0.07, 0.09], [0.055, 0.1]].map(([r, h]) => new THREE.Vector2(r, h)), 9); disposables.push(lg);
      const lm = new THREE.Mesh(lg, lotusMat); lm.position.set(x + s * 0.15, yW + 0.006, z); lm.castShadow = true; group.add(lm);
    }
  }
  // the ripple of the pads and fish: the frame's work
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000);
    u.uTime.value = t; u.uDim.value = dim; u.uWind.value.set(opts.wind.x + opts.wind.gust * opts.wind.dir * 0.5, opts.wind.z);
    for (const k of koi) {
      // a wander inside the basin: the heading drifts, turns home from the rim; a rise now and then rings the water
      k.h += (R() - 0.5) * 1.6 * dt + Math.sin(t * 0.6 + k.ph) * 0.25 * dt;
      const dx = k.x - at.x, dz = k.z - at.z;
      if (Math.abs(dx) > hw - 0.3 || Math.abs(dz) > hd - 0.22) { const home = Math.atan2(-dz, -dx); let d = home - k.h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; k.h += d * Math.min(1, dt * 3); }
      const sp = k.sp * (1 + 0.3 * Math.sin(t * 7.5 + k.u.value) * 0.5 + 0.5);
      k.x += Math.cos(k.h) * sp * dt; k.z += Math.sin(k.h) * sp * dt;
      k.x = THREE.MathUtils.clamp(k.x, at.x - hw + 0.18, at.x + hw - 0.18); k.z = THREE.MathUtils.clamp(k.z, at.z - hd + 0.12, at.z + hd - 0.12);
      k.gulp -= dt; let lift = 0;
      if (k.gulp <= 0) { k.gulp = 6 + R() * 14; ring(k.x + Math.cos(k.h) * 0.12, k.z + Math.sin(k.h) * 0.12, 0.09 + R() * 0.05, t); k.ph = t; }
      if (t - k.ph < 0.6) lift = Math.sin((t - k.ph) / 0.6 * Math.PI) * 0.012;
      k.m.position.set(k.x, yW + 0.003 + lift, k.z); k.m.rotation.y = -k.h;
    }
    for (const p of pads) { p.m.position.x = p.x + Math.sin(t * 0.3 + p.ph) * 0.012; p.m.position.z = p.z + Math.cos(t * 0.23 + p.ph) * 0.01; p.m.rotation.z += Math.sin(t * 0.4 + p.ph) * 0.0004; }
    if (opts.wind.gust > 0.5 && R() < dt * 2) ring(at.x + (R() - 0.5) * at.w * 0.8, at.z + (R() - 0.5) * at.d * 0.8, 0.05, t); // (a gust: drops flung onto the water)
    else if (R() < dt * 0.12) ring(at.x + (R() - 0.5) * at.w * 0.8, at.z + (R() - 0.5) * at.d * 0.8, 0.03, t); // (a petal, an insect)
  };
  return {
    update,
    dispose: () => { scene.remove(group); mirror?.disposeMirror(); for (const d of disposables) d.dispose(); },
  };
}
