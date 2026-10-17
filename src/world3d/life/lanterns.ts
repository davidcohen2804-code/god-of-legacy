// Paper lanterns hanging from the eaves: each swings on its cord in the wind — a lazy pendulum, a little out of step
// with its neighbours, flung wide by a gust and settling again — its warm glow swinging with it. Built as instanced
// parts (one draw each for the cords, caps, bodies and tassels, one for the glows) so a street of lanterns costs five
// draws, not five hundred; the pendulums are computed here and written into the instance matrices each frame.
import * as THREE from 'three';
import { Life, Wind, rng, tex, dotCanvas } from './kit';

export interface LanternAt { x: number; y: number; z: number }

/** A string of lanterns: `setLit(k)` dims or lights their paper and glow (0 dark … 1 lit) — a lamplighter's walk. */
export interface Lanterns extends Life { setLit(k: number): void }

export function paperLanterns(scene: THREE.Scene, at: LanternAt[], opts: { wind: Wind; seed?: number; drop?: number; color?: number; glow?: number; /** how lit they start (0 dark … 1), default lit */ lit?: number }): Lanterns {
  const R = rng(opts.seed ?? 41), drop = opts.drop ?? 0.4, n = at.length;
  if (!n) return { update() {}, dispose() {}, setLit() {} };
  const paper = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xd8442c, emissive: opts.glow ?? 0xff6a2a, emissiveIntensity: 1.6, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.7 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 0.9 });
  const tassel = new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.9 });
  const glowTex = tex(dotCanvas(0.18, 128));
  const body = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.2, 0.08], [0.22, 0.22], [0.2, 0.38], [0.12, 0.46], [0, 0.46]].map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), 18);
  const cap = new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), line = new THREE.CylinderGeometry(0.012, 0.012, 1, 6), tas = new THREE.CylinderGeometry(0.012, 0.03, 0.12, 8);
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, count: number, shadow: boolean) => { const im = new THREE.InstancedMesh(g, m, count); im.castShadow = shadow; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); return im; };
  const bodies = mk(body, paper, n, true), caps = mk(cap, wood, n * 2, false), lines = mk(line, cord, n, false), tassels = mk(tas, tassel, n, false);
  // the glows: one points cloud, its positions rewritten with the swing
  const gpos = new Float32Array(n * 3), gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  const gmat = new THREE.ShaderMaterial({ uniforms: { map: { value: glowTex }, vh: { value: 900 }, uSize: { value: 1.3 }, uLit: { value: 1 } },
    vertexShader: 'uniform float vh; uniform float uSize; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * projectionMatrix[1][1] * vh * 0.5 / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform float uLit; void main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * 0.7 * uLit; if (a < 0.004) discard; gl_FragColor = vec4(vec3(1.0, 0.48, 0.23) * t.rgb, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glows = new THREE.Points(gg, gmat); glows.frustumCulled = false; const v2 = new THREE.Vector2(); glows.onBeforeRender = (renderer) => { gmat.uniforms.vh.value = renderer.getDrawingBufferSize(v2).y; }; scene.add(glows);
  const L = at.map((p) => ({ p, ph: R() * 6.28, len: drop + 0.27, a: 0, b: 0, va: 0, vb: 0 }));
  const m4 = new THREE.Matrix4(), piv = new THREE.Matrix4(), loc = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), s3 = new THREE.Vector3(), pv = new THREE.Vector3(), wp = new THREE.Vector3();
  const place = () => {
    for (const [i, l] of L.entries()) {
      e.set(-l.b, 0, l.a); q.setFromEuler(e); piv.compose(new THREE.Vector3(l.p.x, l.p.y, l.p.z), q, one); // (a turn of +a about z carries the hanging body to +x; of -b about x, to +z)
      const part = (im: THREE.InstancedMesh, idx: number, y: number, sy = 1) => { s3.set(1, sy, 1); loc.compose(pv.set(0, y, 0), new THREE.Quaternion(), s3); m4.multiplyMatrices(piv, loc); im.setMatrixAt(idx, m4); };
      part(lines, i, -drop / 2, drop); part(caps, i * 2, -drop - 0.025); part(bodies, i, -drop - 0.5); part(caps, i * 2 + 1, -drop - 0.525); part(tassels, i, -drop - 0.61);
      wp.set(0, -drop - 0.27, 0).applyMatrix4(piv); gpos.set([wp.x, wp.y, wp.z], i * 3);
    }
    for (const im of [bodies, caps, lines, tassels]) im.instanceMatrix.needsUpdate = true;
    (gg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };
  place();
  const update = (ms: number, t: number) => {
    const dt = Math.min(0.05, ms / 1000), w = opts.wind;
    for (const l of L) {
      // a damped pendulum driven by the wind (steady: a small lean and sway; a gust: a shove downwind)
      const g0 = 9.8 / l.len;
      const push = (w.x * 0.08 + Math.sin(t * 0.9 + l.ph) * 0.05 + w.gust * w.dir * 0.9) * g0;
      l.va += (-g0 * Math.sin(l.a) + push - l.va * 0.5) * dt; l.a += l.va * dt;
      l.vb += (-g0 * Math.sin(l.b) + (w.z * 0.08 + Math.cos(t * 0.7 + l.ph) * 0.04) * g0 - l.vb * 0.5) * dt; l.b += l.vb * dt;
    }
    place();
  };
  const setLit = (k: number) => { const q = Math.max(0, Math.min(1, k)); paper.emissiveIntensity = 1.6 * q; gmat.uniforms.uLit.value = q; glows.visible = q > 0.01; };
  if (opts.lit !== undefined) setLit(opts.lit);
  return { update, setLit, dispose: () => { for (const im of [bodies, caps, lines, tassels]) { scene.remove(im); im.dispose(); } scene.remove(glows); gg.dispose(); gmat.dispose(); for (const d of [paper, wood, cord, tassel, glowTex, body, cap, line, tas]) d.dispose(); } };
}
