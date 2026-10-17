// A place's light and sky: the sun (soft shadows that follow the hero), the sky light, the sky dome (three colours and
// a slow band of cloud), the fog, the environment — the courtyard's recipe (Room.ts) made a kit every map sets its own
// colours into.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Disposable } from './units';

export interface SkyOpts {
  /** The place's middle (units) — the dome and the fog centre on it. */
  cx: number; cz: number;
  soft: boolean;
  /** Toward the sun (any length), its colour and strength. */
  sunFrom: THREE.Vector3; sunColor: number; sunIntensity: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  /** The dome: overhead, the middle band, the horizon; the clear colour behind everything; the fog. */
  top: number; mid: number; low: number; background: number;
  fog: { color: number; near: number; far: number };
  exposure?: number; envIntensity?: number;
  /** How far the sun's shadow map reaches round the hero (units). */
  shadowReach?: number;
}

export interface Sky {
  sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight;
  /** The front scene's copies (they take the same strength as the room darkens). */
  sunF: THREE.DirectionalLight; hemiF: THREE.HemisphereLight;
  /** Each frame: the time and how dark the place is; `x, z` where the hero stands (the shadows follow him). */
  update(t: number, dim: number, x: number, z: number): void;
  disposables: Disposable[];
}

const SKY_VERT = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAG = 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform float uDim; uniform float uTime; varying vec3 vP;\n'
  + 'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n'
  + 'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }\n'
  + 'void main(){ float y = clamp(vP.y, -0.2, 1.0); vec3 c = y < 0.12 ? mix(uLow * 1.08, uMid, smoothstep(-0.05, 0.12, y)) : mix(uMid, uTop, smoothstep(0.12, 0.62, y));\n'
  + ' vec2 q = vec2(atan(vP.x, vP.z) * 3.0 + uTime * 0.004, y * 9.0); float cl = n(q * vec2(2.0, 1.0)) * 0.6 + n(q * 4.1) * 0.4; cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.02, 0.18, y) * (1.0 - smoothstep(0.3, 0.55, y));\n'
  + ' c = mix(c, vec3(1.0, 0.72, 0.6), cl * 0.45); gl_FragColor = vec4(c * (1.0 - uDim * 0.55), 1.0); }';

export function skyAndLight(scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, o: SkyOpts): Sky {
  const disposables: Disposable[] = [];
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure ?? 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const pmrem = new THREE.PMREMGenerator(renderer); const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  const envI = o.envIntensity ?? 0.3;
  scene.environment = envTex; (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = envI; disposables.push(envTex);
  front.environment = envTex; (front as THREE.Scene & { environmentIntensity: number }).environmentIntensity = envI;
  scene.background = new THREE.Color(o.background);
  scene.fog = new THREE.Fog(o.fog.color, o.fog.near, o.fog.far);

  const reach = o.shadowReach ?? 11;
  const dir = o.sunFrom.clone().normalize();
  const sun = new THREE.DirectionalLight(o.sunColor, o.sunIntensity);
  sun.position.copy(dir).multiplyScalar(18).add(new THREE.Vector3(o.cx, 0, o.cz)); sun.target.position.set(o.cx, 0, o.cz);
  sun.castShadow = true; sun.shadow.mapSize.set(o.soft ? 1024 : 2048, o.soft ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -reach; sc.right = reach; sc.top = reach; sc.bottom = -reach; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(o.hemiSky, o.hemiGround, o.hemiIntensity); scene.add(hemi);
  const sunF = new THREE.DirectionalLight(o.sunColor, o.sunIntensity); sunF.position.copy(sun.position); sunF.target.position.copy(sun.target.position); front.add(sunF, sunF.target);
  const hemiF = new THREE.HemisphereLight(o.hemiSky, o.hemiGround, o.hemiIntensity); front.add(hemiF);

  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(o.top) }, uMid: { value: new THREE.Color(o.mid) }, uLow: { value: new THREE.Color(o.low) }, uDim: { value: 0 }, uTime: { value: 0 } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), skyMat); sky.position.set(o.cx, 0, o.cz); scene.add(sky);
  disposables.push(sky.geometry, skyMat);

  let lastX = o.cx, lastZ = o.cz;
  const update = (t: number, dim: number, x: number, z: number) => {
    skyMat.uniforms.uTime.value = t; skyMat.uniforms.uDim.value = dim;
    // the shadows follow the hero: the sun and its target slide with him, in steps (a new shadow map only when he has moved)
    if (Math.abs(x - lastX) > 2 || Math.abs(z - lastZ) > 2) {
      lastX = x; lastZ = z;
      sun.target.position.set(x, 0, z); sun.position.copy(dir).multiplyScalar(18).add(sun.target.position); sun.target.updateMatrixWorld();
      renderer.shadowMap.needsUpdate = true;
    }
    sunF.intensity = sun.intensity; hemiF.intensity = hemi.intensity;
  };
  return { sun, hemi, sunF, hemiF, update, disposables };
}
