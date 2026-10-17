// Butterflies and fireflies. Butterflies flutter about the trees' crowns and the flowers in a drunken wander, never far
// from home; at dusk the fireflies come out round the stone lanterns and under the trees, drifting slowly and blinking,
// brighter the darker the place gets. Both one draw each (instanced wings; glowing points).
import * as THREE from 'three';
import { Life, Wind, rng, tex, butterflyCanvas, dotCanvas, lerp } from './kit';

export interface Haunt { x: number; y: number; z: number; r: number }

export function butterflies(scene: THREE.Scene, haunts: Haunt[], opts: { n?: number; wind: Wind; seed?: number }): Life {
  const R = rng(opts.seed ?? 17), n = opts.n ?? 8;
  if (!haunts.length || n <= 0) return { update() {}, dispose() {} };
  // the wings: two quads hinged on the body line (x = 0), flapping about it in the shader; four colourings in an atlas
  const g = new THREE.BufferGeometry();
  const W = 0.055, H = 0.042;
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -H, W, 0, -H, W, 0, H, 0, 0, H, 0, 0, -H, -W, 0, -H, -W, 0, H, 0, 0, H], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 1, 1, 1, 0, 0.5, 0, 0.5, 1, 0, 1, 0, 0, 0.5, 0], 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute([1, 1, 1, 1, -1, -1, -1, -1], 1));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]); g.computeVertexNormals();
  const anim = new Float32Array(n * 2); g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 2)); // phase, variant
  const atlas = document.createElement('canvas'); atlas.width = 256; atlas.height = 192; const ag = atlas.getContext('2d')!;
  for (let v = 0; v < 4; v++) ag.drawImage(butterflyCanvas(v), (v % 2) * 128, (v >> 1) * 96);
  const map = tex(atlas);
  const uTime = { value: 0 }, uDim = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.4, transparent: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uDim = uDim;
    sh.vertexShader = 'attribute float aSide;\nattribute vec2 aAnim;\nuniform float uTime;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * 0.5 + vec2(mod(aAnim.y, 2.0) * 0.5, floor(aAnim.y / 2.0) * 0.5);\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fa = 0.35 + 0.95 * abs(sin(uTime * 11.0 + aAnim.x)); float xx = abs(transformed.x); transformed.y += xx * sin(fa); transformed.x = sign(transformed.x) * xx * cos(fa);');
    sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= 1.0 - 0.55 * uDim;');
  };
  const mesh = new THREE.InstancedMesh(g, mat, n); mesh.frustumCulled = false; scene.add(mesh);
  interface Fly { home: Haunt; p: THREE.Vector3; v: THREE.Vector3; yaw: number; ph: number; rest: number; onRest: number }
  const flies: Fly[] = [];
  for (let i = 0; i < n; i++) {
    const h = haunts[i % haunts.length];
    flies.push({ home: h, p: new THREE.Vector3(h.x + (R() - 0.5) * h.r, h.y + (R() - 0.5) * h.r * 0.6, h.z + (R() - 0.5) * h.r), v: new THREE.Vector3(), yaw: R() * 6.28, ph: R() * 6.28, rest: 0, onRest: 4 + R() * 12 });
    anim[i * 2] = R() * 6.28; anim[i * 2 + 1] = (R() * 4) | 0;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(1, 1, 1), tmp = new THREE.Vector3();
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000); uTime.value = t; uDim.value = dim;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      // a wander: the heading drifts, pulled back toward home when far; a flutter up and down; now and then a rest
      f.onRest -= dt;
      if (f.onRest <= 0 && f.rest <= 0) { f.rest = 1.5 + R() * 3; f.onRest = 6 + R() * 14; }
      if (f.rest > 0) { f.rest -= dt; f.v.multiplyScalar(Math.pow(0.02, dt)); }
      else {
        f.yaw += (R() - 0.5) * 3.2 * dt + Math.sin(t * 0.8 + f.ph) * 0.6 * dt;
        tmp.set(f.home.x - f.p.x, f.home.y - f.p.y, f.home.z - f.p.z); const d = tmp.length();
        const pull = d > f.home.r ? (d - f.home.r) * 1.2 : 0;
        const sp = 0.22 + 0.1 * Math.sin(t * 2.1 + f.ph);
        f.v.x = lerp(f.v.x, Math.cos(f.yaw) * sp + (d > 0 ? tmp.x / d : 0) * pull + opts.wind.x * 0.25 * (1 + opts.wind.gust * 3), dt * 3);
        f.v.z = lerp(f.v.z, Math.sin(f.yaw) * sp + (d > 0 ? tmp.z / d : 0) * pull + opts.wind.z * 0.25, dt * 3);
        f.v.y = lerp(f.v.y, Math.sin(t * 7 + f.ph) * 0.12 + (d > 0 ? tmp.y / d : 0) * pull * 0.6 + Math.sin(t * 0.5 + f.ph) * 0.05, dt * 4);
      }
      f.p.addScaledVector(f.v, dt);
      if (f.p.y < f.home.y - f.home.r * 0.6) f.p.y = f.home.y - f.home.r * 0.6;
      e.set(0, -f.yaw - Math.PI / 2, Math.sin(t * 3 + f.ph) * 0.2, 'YXZ'); q.setFromEuler(e); // (its head is its -z)
      m4.compose(f.p, q, s3); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { update, dispose: () => { scene.remove(mesh); g.dispose(); mat.dispose(); map.dispose(); } };
}

/** Fireflies: slow glowing points about their haunts, each blinking in its own rhythm; the darker the place, the brighter. */
export function fireflies(scene: THREE.Scene, haunts: Haunt[], opts: { n?: number; wind: Wind; seed?: number; color?: number }): Life {
  const R = rng(opts.seed ?? 23), n = opts.n ?? 30;
  if (!haunts.length || n <= 0) return { update() {}, dispose() {} };
  const pos = new Float32Array(n * 3), base = new Float32Array(n * 3), ph = new Float32Array(n * 4), alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = haunts[i % haunts.length];
    base.set([h.x + (R() - 0.5) * h.r * 1.6, h.y + (R() - 0.5) * h.r * 0.8, h.z + (R() - 0.5) * h.r * 1.2], i * 3);
    ph.set([R() * 6.28, 0.5 + R() * 0.9, R() * 6.28, 0.25 + R() * 0.3], i * 4); // drift phase, blink rate, blink phase, radius
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('palpha', new THREE.BufferAttribute(alpha, 1));
  const map = tex(dotCanvas(0.1));
  const col = new THREE.Color(opts.color ?? 0xe8ff8a);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, vh: { value: 900 }, uColor: { value: col }, uSize: { value: 0.085 } },
    vertexShader: 'attribute float palpha; uniform float vh; uniform float uSize; varying float vA;\nvoid main() { vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = palpha > 0.001 ? uSize * (0.6 + 0.4 * palpha) * projectionMatrix[1][1] * vh * 0.5 / max(0.2, -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 uColor; varying float vA;\nvoid main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(mix(uColor, vec3(1.0), t.a * 0.6) * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  const v2 = new THREE.Vector2(); pts.onBeforeRender = (renderer) => { mat.uniforms.vh.value = renderer.getDrawingBufferSize(v2).y; };
  const update = (_ms: number, t: number, dim: number) => {
    const bright = 0.55 + 0.45 * dim;
    for (let i = 0; i < n; i++) {
      const j = i * 3, k = i * 4, r = ph[k + 3];
      pos[j] = base[j] + Math.sin(t * 0.37 + ph[k]) * r + Math.sin(t * 1.1 + ph[k] * 2.0) * r * 0.3 + opts.wind.gust * opts.wind.dir * 0.4;
      pos[j + 1] = base[j + 1] + Math.sin(t * 0.52 + ph[k] * 1.7) * r * 0.5 + Math.sin(t * 2.3 + ph[k]) * 0.02;
      pos[j + 2] = base[j + 2] + Math.cos(t * 0.41 + ph[k] * 1.3) * r * 0.8;
      const s = Math.sin(t * ph[k + 1] * 2.2 + ph[k + 2]); // a slow pulse with a dark gap in it
      alpha[i] = Math.max(0, Math.pow(Math.max(0, s), 2.5) - 0.02) * bright;
    }
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.palpha as THREE.BufferAttribute).needsUpdate = true;
  };
  return { update, dispose: () => { scene.remove(pts); g.dispose(); mat.dispose(); map.dispose(); } };
}
