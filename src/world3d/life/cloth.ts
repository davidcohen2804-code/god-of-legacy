// Cloth in the wind: banners (hung from a beam, or a nobori standing on its own pole with a crossbar) and the paper
// streamers of a shimenawa rope. The cloth is a plane whose free part ripples in the vertex shader — still along its
// fixed edge, waving more toward the free corner, leaning downwind, whipping in a gust (a heavy blow below) — with its
// normal recomputed so the light plays over the folds.
import * as THREE from 'three';
import { Life, Wind, rng, tex, bannerCanvas, shideCanvas } from './kit';

export interface ClothAt {
  /** The hanging point (the middle of the top edge for a hung banner; the pole's foot for a nobori), its facing (yaw, rad). */
  x: number; y: number; z: number; yaw: number;
  /** The cloth's size (units). */
  w: number; h: number;
}
export interface ClothOpts { wind: Wind; seed?: number }

interface ClothUniforms { uTime: { value: number }; uPhase: { value: number }; uAmp: { value: number }; uFreq: { value: number }; uGust: { value: number }; uWind: { value: THREE.Vector2 }; uSize: { value: THREE.Vector2 }; uMode: { value: number } }

/** The waving material: `mode` 0 = hung from its top edge, 1 = a nobori (fixed along its top and its left edge). */
function clothMaterial(params: THREE.MeshStandardMaterialParameters, u: ClothUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uTime, uPhase, uAmp, uFreq, uGust, uMode; uniform vec2 uWind, uSize;\n'
      + 'float freeK(vec2 t) { float k = 1.0 - t.y; if (uMode > 0.5) k *= 0.2 + 0.8 * t.x; return k; }\n'
      + 'vec3 disp(vec2 t) { float k = freeK(t); float k2 = k * k; float g = 1.0 + 2.6 * uGust;\n'
      + '  float w1 = sin(uTime * 2.1 * uFreq + t.y * 5.0 + t.x * 2.5 + uPhase); float w2 = sin(uTime * 4.7 * uFreq + t.y * 11.0 - t.x * 3.0 + uPhase * 1.7);\n'
      + '  float z = k2 * uAmp * (0.6 * w1 + 0.3 * w2) * g + k2 * uWind.y * 0.3; float x = k2 * uWind.x * 0.45 * (1.0 + 2.0 * uGust) + k * k2 * uAmp * 0.3 * w2 * uGust;\n'
      + '  float y = k2 * (abs(w1) * 0.05 * uGust + abs(uWind.x) * 0.06); return vec3(x, y, z); }\n'
      + sh.vertexShader
        .replace('#include <beginnormal_vertex>', 'vec2 eU = vec2(1.0 / 12.0, 0.0), eV = vec2(0.0, 1.0 / 20.0);\n'
          + 'vec3 P0 = position + disp(uv); vec3 Pu = position + vec3(eU.x * uSize.x, 0.0, 0.0) + disp(uv + eU); vec3 Pv = position + vec3(0.0, eV.y * uSize.y, 0.0) + disp(uv + eV);\n'
          + 'vec3 objectNormal = normalize(cross(Pu - P0, Pv - P0));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
        .replace('#include <begin_vertex>', 'vec3 transformed = P0;');
  };
  return m;
}

const uniformsOf = (phase: number, amp: number, freq: number, w: number, h: number, mode: number): ClothUniforms =>
  ({ uTime: { value: 0 }, uPhase: { value: phase }, uAmp: { value: amp }, uFreq: { value: freq }, uGust: { value: 0 }, uWind: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(w, h) }, uMode: { value: mode } });

/** Each frame: the wind in the cloth's own frame (x along the cloth, y out of its face), the gust. */
function blow(u: ClothUniforms, yaw: number, wind: Wind, t: number): void {
  const wx = wind.x + wind.gust * wind.dir * 1.6, wz = wind.z;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  u.uWind.value.set(wx * c - wz * s, wx * s + wz * c); u.uGust.value = Math.min(1.5, wind.gust); u.uTime.value = t;
}

/** A banner hung from its top edge (from a beam), or standing on its own pole when `pole` is set (a nobori: the cloth
 *  hangs from a crossbar beside the pole, fixed along the pole too). */
export function banner(scene: THREE.Scene, at: ClothAt & { pole?: boolean; emblem?: boolean }, opts: ClothOpts): Life {
  const R = rng(opts.seed ?? 5);
  const map = tex(bannerCanvas((opts.seed ?? 5) + 3, at.emblem !== false)); map.anisotropy = 8;
  const u = uniformsOf(R() * 6.28, 0.06 + R() * 0.02, 0.9 + R() * 0.25, at.w, at.h, at.pole ? 1 : 0);
  const mat = clothMaterial({ map, roughness: 0.82, metalness: 0 }, u);
  const g = new THREE.PlaneGeometry(at.w, at.h, 12, 20);
  const group = new THREE.Group(); group.position.set(at.x, at.y, at.z); group.rotation.y = at.yaw; scene.add(group);
  const extra: { dispose(): void }[] = [];
  if (at.pole) {
    // the pole (dark lacquer, a gilt finial), the crossbar, the cloth beside the pole under the bar
    const H = at.h + 0.9;
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2420, roughness: 0.55 }), gold = new THREE.MeshStandardMaterial({ color: 0xe0ab4c, metalness: 1, roughness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, H, 10), dark); pole.position.y = H / 2; pole.castShadow = true;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, at.w + 0.16, 8), dark); bar.rotation.z = Math.PI / 2; bar.position.set(at.w / 2 + 0.05, H - 0.1, 0); bar.castShadow = true;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), gold); top.position.y = H + 0.03;
    group.add(pole, bar, top); extra.push(pole.geometry, bar.geometry, top.geometry, dark, gold);
    g.translate(at.w / 2 + 0.06, H - 0.14 - at.h / 2, 0.03);
  } else g.translate(0, -at.h / 2, 0);
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = false; mesh.receiveShadow = true; group.add(mesh);
  return {
    update: (_ms, t) => blow(u, at.yaw, opts.wind, t),
    dispose: () => { scene.remove(group); g.dispose(); mat.dispose(); map.dispose(); for (const e of extra) e.dispose(); },
  };
}

/** A paper streamer (shide) hung from a rope: light, quick, never still. */
export function streamer(scene: THREE.Scene, at: ClothAt, opts: ClothOpts & { map?: THREE.Texture }): Life {
  const R = rng(opts.seed ?? 9);
  const own = !opts.map, map = opts.map ?? tex(shideCanvas());
  const u = uniformsOf(R() * 6.28, 0.035, 1.9 + R() * 0.4, at.w, at.h, 0);
  const mat = clothMaterial({ map, alphaTest: 0.5, roughness: 0.9, color: 0xffffff }, u);
  const g = new THREE.PlaneGeometry(at.w, at.h, 4, 12); g.translate(0, -at.h / 2, 0);
  const mesh = new THREE.Mesh(g, mat); mesh.position.set(at.x, at.y, at.z); mesh.rotation.y = at.yaw; mesh.castShadow = false; scene.add(mesh);
  return {
    update: (_ms, t) => blow(u, at.yaw, opts.wind, t),
    dispose: () => { scene.remove(mesh); g.dispose(); mat.dispose(); if (own) map.dispose(); },
  };
}

export const streamerTexture = (): THREE.Texture => tex(shideCanvas());
