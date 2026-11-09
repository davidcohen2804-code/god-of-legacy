// THE SPECTRAL SAMURAI (Legacy of Spirits, David and GPT 9 Nov — GPT's reference: a dark armoured spirit, wild white
// hair flowing up and back, glowing violet eyes, a crimson scarf and sash with long tails, samurai shoulder guards and a
// flared armoured coat to the knees with glowing edges, a violet-white katana). The game's 3D hero, on its own skeleton
// and the game's moves, dressed as that spirit: its skin near-black with a slow violet light inside and a pale violet
// rim; a dark line round it (it reads on bright stone); a bigger head; glowing eyes; the hair, the scarf and sash tails
// and the coat's panels as strands that float, trail and swing (held to their shape at the root, kept off the legs);
// shoulder guards and the waist and neck bands fixed to their bones; the katana's blade lit from the guard. Every move
// and skill stays the game's own. Hero3D is untouched (its parts are reached as they are).
import * as THREE from 'three';
import type { Hero3D } from '../arena3d/Hero3D';

export interface SpiritLook {
  /** The body's dark base, its light inside, its glowing rim, the dark line round it. */
  core: number; inner: number; rim: number; outline: number;
  /** The eyes' white heart and their halo. */
  eye: number; eyeHalo: number;
  /** The hair: its middle and its edges (root, tip). */
  hairMid: [number, number]; hairEdge: [number, number];
  /** The fabric accents (sash, scarf): their colour and their dark fold. */
  accent: number; accentDeep: number;
  /** The armour (coat panels, shoulder guards): its dark face, its glowing edge, its gold trim. */
  armour: number; trim: number; gold: number;
  /** The blade's glow and its white-hot edge. */
  blade: number; bladeEdge: number;
  head: number;
  /** The halo round the whole body on its layer. */
  halo: number;
}

export const SPECTRAL_SAMURAI: SpiritLook = {
  core: 0x06040c, inner: 0x3a1f74, rim: 0xa77cff, outline: 0x05030a,
  eye: 0xfaf4ff, eyeHalo: 0xa070ff,
  hairMid: [0xffffff, 0xe6dcff], hairEdge: [0xd0bcff, 0x9b78ff],
  accent: 0xc8102e, accentDeep: 0x56060f,
  armour: 0x161028, trim: 0x9a6cff, gold: 0xd4ae5a,
  blade: 0xb58aff, bladeEdge: 0xffffff, head: 1.38, halo: 0x8f5cff,
};

/** Hero3D's own parts (private there: reached as they are, never changed in shape). */
interface Parts { body: THREE.SkinnedMesh | null; bones: Map<string, THREE.Bone>; model: THREE.Group; root: THREE.Group; scene: THREE.Scene; weapons: Map<string, THREE.Group> }

type V3 = [number, number, number];
/** A strand: its root on a bone (in the hero's own frame — x his right, y up, z ahead — model units from the joint;
 *  the head's strands at the head's size), its rest way, its points and length (world units), its width root → tip,
 *  its colours (edges and middle, root → tip) and alpha, how firmly it keeps its shape, how it floats (up: hair; down:
 *  cloth), how far it curls down, the wind on it; a panel lies flat along a way of his frame (else across the view);
 *  a coat panel is kept off the legs. */
interface StrandDef {
  bone: string; at: V3; dir: V3; n: number; len: number; w: [number, number];
  mid: [number, number]; edge: [number, number]; a: [number, number];
  stiff: number; lift: number; curl: number; wind: number; flat?: V3; hs?: boolean; collide?: boolean;
  /** A lock's S-bend sideways (world units at its middle). */
  wave?: number;
}

const HAIR = (L: SpiritLook): StrandDef[] => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // (the same mane every time)
  const h = (at: V3, dir: V3, len: number, w0: number, stiff: number, curl: number, lift: number, wave: number, deep = 0): StrandDef => ({
    bone: 'Head', at, dir, n: 8, len, w: [w0, 0.003], hs: true, wave, stiff, lift, curl, wind: 0.8,
    // (the locks behind a little deeper in colour, those in front the whitest: the mane's volume)
    mid: [L.hairMid[0], deep > 0.5 ? L.hairEdge[0] : L.hairMid[1]], edge: [deep > 0.5 ? L.hairEdge[1] : L.hairEdge[0], L.hairEdge[1]], a: [1, 0.9] });
  const out: StrandDef[] = [];
  // the mane: a mass of spiky locks from the back and the crown of the skull, swept back — the upper ones rising a
  // little, the lower ones falling to the shoulder blades (the back rows first: drawn under the front ones)
  for (let row = 0; row < 3; row++) {
    const n = [9, 8, 7][row];
    for (let i = 0; i < n; i++) {
      const a = -1 + (2 * (i + (row === 1 ? 0.5 : 0))) / (n - (row === 1 ? 0 : 1)), r = rnd(), r2 = rnd();
      const y = [0.06, 0.15, 0.23][row] - Math.abs(a) * 0.05, z = [-0.1, -0.08, -0.02][row] + Math.abs(a) * 0.03;
      const up = [-0.55, -0.05, 0.35][row] + (r2 - 0.5) * 0.3 - Math.abs(a) * 0.1;
      const len = [0.42, 0.4, 0.34][row] * (1 - Math.abs(a) * 0.25) + r * 0.12;
      out.push(h([a * 0.1, y, z], [a * 0.7, up, -1], len, 0.085 + r2 * 0.03, 0.35, [0.25, 0.12, 0.05][row], [0.15, 0.3, 0.45][row], (rnd() - 0.5) * 0.06, row === 0 ? 1 : 0));
    }
  }
  // the crown's short spikes, back over the top (the head's own hair under them)
  for (let i = 0; i < 6; i++) {
    const a = -1 + (2 * i) / 5, r = rnd();
    out.push(h([a * 0.07, 0.27 - Math.abs(a) * 0.03, 0.06 - Math.abs(a) * 0.03], [a * 0.5, 0.75 + r * 0.3, -1], 0.17 + r * 0.08, 0.07, 0.5, 0.05, 0.4, 0));
  }
  // by the temples and over the ears, swept back
  for (const sd of [-1, 1]) for (const [y, len] of [[0.19, 0.3], [0.11, 0.26]] as [number, number][]) out.push(h([sd * 0.115, y, 0.03], [sd * 0.45, 0.05, -1], len, 0.06, 0.4, 0.15, 0.3, (rnd() - 0.5) * 0.05));
  // the bangs: points down over the brow, the eyes left clear between them
  for (const sd of [-1, -0.45, 0.45, 1]) out.push(h([sd * 0.06, 0.24, 0.1], [sd * 0.5, -0.35, 1], 0.15 - Math.abs(sd) * 0.02, 0.06, 0.6, 0.25, 0.1, 0));
  return out;
};
const CLOTH = (L: SpiritLook): StrandDef[] => {
  const tail = (bone: string, at: V3, dir: V3, len: number, w0: number, w1: number): StrandDef => ({ bone, at, dir, n: 10, len, w: [w0, w1], mid: [L.accent, L.accent], edge: [L.accentDeep, L.accentDeep], a: [1, 0.95], stiff: 0.1, lift: -0.4, curl: 0.95, wind: 1.4 });
  return [
    // the scarf's two long tails from the back of the neck
    tail('neck_01', [0.03, 0.01, -0.07], [0.15, 0.0, -1], 0.78, 0.1, 0.05), tail('neck_01', [-0.04, 0.0, -0.07], [-0.12, -0.2, -1], 0.62, 0.085, 0.04),
    // the sash's two tails from the knot at his left hip
    tail('spine_01', [-0.11, -0.04, 0.06], [-0.3, -1, 0.2], 0.55, 0.08, 0.045), tail('spine_01', [-0.12, -0.05, 0.02], [-0.4, -1, -0.3], 0.45, 0.07, 0.04),
  ];
};
/** The armoured coat: panels round the hips flaring out to the knees (longer behind), dark with a glowing edge. */
const COAT = (L: SpiritLook): StrandDef[] => {
  const out: StrandDef[] = [];
  const panels: [number, number][] = [[0, 0.74], [0.5, 0.7], [-0.5, 0.7], [1.0, 0.6], [-1.0, 0.6], [1.6, 0.5], [-1.6, 0.5], [2.3, 0.4], [-2.3, 0.4]]; // [angle from behind (rad), length]
  for (const [ang, len] of panels) {
    const sx = Math.sin(ang), sz = -Math.cos(ang); // (0: straight behind)
    out.push({ bone: 'pelvis', at: [sx * 0.13, 0.06, sz * 0.11], dir: [sx * 0.45, -1, sz * 0.45], n: 7, len, w: [0.15, 0.2], mid: [L.armour, L.armour], edge: [L.trim, L.trim], a: [1, 1], stiff: 0.32, lift: -0.6, curl: 0.15, wind: 0.5, flat: [Math.cos(ang), 0, Math.sin(ang)], collide: true });
  }
  return out;
};

const TV = new THREE.Vector3(), TW = new THREE.Vector3(), TT = new THREE.Vector3(), TQ = new THREE.Quaternion();

class Strands {
  readonly mesh: THREE.Mesh;
  private base: number[] = [];
  private p: Float32Array; private q: Float32Array; private rest: THREE.Vector3[] = []; private flat: (THREE.Vector3 | null)[] = [];
  private seg: number[] = [];
  private pos: Float32Array;
  private bones: THREE.Bone[] = [];
  private ready = false;
  constructor(private defs: StrandDef[], private parts: Parts, private head: number, private caps: () => { a: THREE.Vector3; b: THREE.Vector3; r: number }[]) {
    let N = 0; for (const d of defs) { this.base.push(N); N += d.n; }
    this.p = new Float32Array(N * 3); this.q = new Float32Array(N * 3);
    this.pos = new Float32Array(N * 5 * 3);
    const col = new Float32Array(N * 5 * 4), idx: number[] = [];
    defs.forEach((d, s) => {
      const b = this.base[s];
      for (let i = 0; i < d.n - 1; i++) for (let c = 0; c < 4; c++) { const v = (b + i) * 5 + c, w = v + 5; idx.push(v, v + 1, w, v + 1, w + 1, w); }
      const m0 = new THREE.Color(d.mid[0]), m1 = new THREE.Color(d.mid[1]), e0 = new THREE.Color(d.edge[0]), e1 = new THREE.Color(d.edge[1]);
      for (let i = 0; i < d.n; i++) {
        const k = i / (d.n - 1), a = d.a[0] + (d.a[1] - d.a[0]) * k, m = m0.clone().lerp(m1, k), e = e0.clone().lerp(e1, k);
        for (let c = 0; c < 5; c++) { const cc = c === 0 || c === 4 ? e : m; col.set([cc.r, cc.g, cc.b, a], ((b + i) * 5 + c) * 4); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }

  /** The rest shape on the bones, read once the body stands in the room (its facing known). */
  private init(yaw: number): void {
    const P = this.parts, F = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), U = new THREE.Vector3(0, 1, 0), R = new THREE.Vector3(-F.z, 0, F.x), k = P.model.scale.x;
    P.root.updateMatrixWorld(true);
    const fr = (v: V3) => new THREE.Vector3().addScaledVector(R, v[0]).addScaledVector(U, v[1]).addScaledVector(F, v[2]);
    this.defs.forEach((d) => {
      const bone = P.bones.get(d.bone)!; this.bones.push(bone);
      const s = d.hs ? this.head : 1;
      const at = bone.getWorldPosition(new THREE.Vector3()).add(fr(d.at).multiplyScalar(k * s));
      const dir = fr(d.dir).normalize(), L = d.len / (d.n - 1); this.seg.push(L);
      bone.getWorldQuaternion(TQ).invert();
      this.flat.push(d.flat ? fr(d.flat).normalize().applyQuaternion(TQ) : null); // (a panel's flat way, in the bone's own frame)
      let w = at.clone();
      const side = new THREE.Vector3().crossVectors(dir, U); if (side.lengthSq() < 1e-6) side.copy(R); side.normalize();
      for (let i = 0; i < d.n; i++) {
        if (i > 0) { const k2 = i / (d.n - 1), way = dir.clone().lerp(new THREE.Vector3(dir.x * 0.5, -1, dir.z * 0.5).normalize(), d.curl * k2 * k2).normalize(); w = w.clone().addScaledVector(way, L); }
        const k2 = i / (d.n - 1), bend = (d.wave ?? 0) * Math.sin(k2 * Math.PI * 1.3);
        this.rest.push(bone.worldToLocal(w.clone().addScaledVector(side, bend)));
      }
    });
    this.snap();
    this.ready = true;
  }
  /** Every point at its rest place (a first frame, a jump across the map). */
  private snap(): void {
    let r = 0;
    this.defs.forEach((d, s) => { for (let i = 0; i < d.n; i++, r++) { const w = this.bones[s].localToWorld(this.rest[r].clone()); this.p.set([w.x, w.y, w.z], (this.base[s] + i) * 3); this.q.set([w.x, w.y, w.z], (this.base[s] + i) * 3); } });
  }

  step(dt: number, t: number, yaw: number, cam: THREE.Camera, sim: boolean): void {
    if (!this.ready) this.init(yaw);
    const P = this.p, Q = this.q;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (sim) {
      const root0 = this.bones[0].localToWorld(this.rest[0].clone());
      if (Math.hypot(root0.x - P[0], root0.y - P[1], root0.z - P[2]) > 1.2) this.snap(); // (a jump across the map)
      const dt2 = dt * dt, caps = this.caps();
      let r = 0;
      this.defs.forEach((d, s) => {
        const b0 = this.base[s], L = this.seg[s];
        for (let i = 0; i < d.n; i++, r++) {
          const o = (b0 + i) * 3;
          TT.copy(this.rest[r]); this.bones[s].localToWorld(TT);
          if (i === 0) { P[o] = TT.x; P[o + 1] = TT.y; P[o + 2] = TT.z; Q[o] = TT.x; Q[o + 1] = TT.y; Q[o + 2] = TT.z; continue; }
          const k = i / (d.n - 1), flow = Math.sin(t * 2.3 + i * 0.7 + s * 1.9) * 0.5 + Math.sin(t * 5.1 + s * 0.7) * 0.25;
          const ax = back.x * d.wind * (1.2 + flow) * k, ay = d.lift * 6 * k + flow * 0.8 * k * Math.abs(d.lift), az = back.z * d.wind * (1.2 + flow) * k;
          const vx = (P[o] - Q[o]) * 0.9, vy = (P[o + 1] - Q[o + 1]) * 0.9, vz = (P[o + 2] - Q[o + 2]) * 0.9;
          Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
          P[o] += vx + ax * dt2; P[o + 1] += vy + ay * dt2; P[o + 2] += vz + az * dt2;
          const pull = d.stiff * Math.pow(1 - k, 1.2) + 0.03;
          P[o] += (TT.x - P[o]) * pull; P[o + 1] += (TT.y - P[o + 1]) * pull; P[o + 2] += (TT.z - P[o + 2]) * pull;
        }
        for (let pass = 0; pass < 2; pass++) for (let i = 1; i < d.n; i++) {
          const o = (b0 + i) * 3, op = o - 3;
          if (d.collide) for (const c of caps) { // (kept off the legs and the body)
            TV.set(P[o], P[o + 1], P[o + 2]); TW.subVectors(c.b, c.a); const u = THREE.MathUtils.clamp(TT.subVectors(TV, c.a).dot(TW) / TW.lengthSq(), 0, 1);
            TT.copy(c.a).addScaledVector(TW, u); TV.sub(TT); const dd = TV.length();
            if (dd < c.r && dd > 1e-5) { TV.multiplyScalar(c.r / dd); P[o] = TT.x + TV.x; P[o + 1] = TT.y + TV.y; P[o + 2] = TT.z + TV.z; }
          }
          TV.set(P[o] - P[op], P[o + 1] - P[op + 1], P[o + 2] - P[op + 2]); const len = TV.length() || 1e-6;
          TV.multiplyScalar(L / len); P[o] = P[op] + TV.x; P[o + 1] = P[op + 1] + TV.y; P[o + 2] = P[op + 2] + TV.z;
        }
      });
    }
    // the ribbons: each point's width across the view, or a panel's along its own flat way
    const cp = cam.position;
    this.defs.forEach((d, s) => {
      const b0 = this.base[s], fl = this.flat[s];
      if (fl) this.bones[s].getWorldQuaternion(TQ);
      for (let i = 0; i < d.n; i++) {
        const o = (b0 + i) * 3, a = Math.max(0, i - 1), b = Math.min(d.n - 1, i + 1), oa = (b0 + a) * 3, ob = (b0 + b) * 3;
        TV.set(P[ob] - P[oa], P[ob + 1] - P[oa + 1], P[ob + 2] - P[oa + 2]).normalize();
        if (fl) { TT.copy(fl).applyQuaternion(TQ); TT.addScaledVector(TV, -TT.dot(TV)); }
        else { TW.set(cp.x - P[o], cp.y - P[o + 1], cp.z - P[o + 2]).normalize(); TT.crossVectors(TV, TW); }
        if (TT.lengthSq() < 1e-8) TT.set(1, 0, 0);
        TT.normalize();
        const k = i / (d.n - 1), w = (d.w[0] + (d.w[1] - d.w[0]) * Math.pow(k, 0.8)) * 0.5;
        const v0 = (b0 + i) * 15, inner = fl ? 0.86 : 0.55; // (a panel's glowing edge thin; a lock's soft)
        for (let c = 0; c < 5; c++) { const f = [1, inner, 0, -inner, -1][c] * w; this.pos[v0 + c * 3] = P[o] + TT.x * f; this.pos[v0 + c * 3 + 1] = P[o + 1] + TT.y * f; this.pos[v0 + c * 3 + 2] = P[o + 2] + TT.z * f; }
      }
    });
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

function glowTexture(stretch: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.translate(32, 32); g.scale(1, 1 / stretch); g.translate(-32, -32); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** The body's skin as a spirit: near-black, a faint light moving inside it, a violet glow at its edges. */
function spiritSkin(L: SpiritLook, time: { value: number }, src: THREE.MeshStandardMaterial | null, hairY: number): THREE.MeshStandardMaterial {
  // (the material's own emissive stays the game's: Hero3D lays a blow's tint on it — the spirit's light is its own)
  const m = new THREE.MeshStandardMaterial({ color: L.core, roughness: 0.85, metalness: 0, emissive: 0x000000, envMapIntensity: 0.1, map: src?.map ?? null });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(L.rim) }; sh.uniforms.uInner = { value: new THREE.Color(L.inner) }; sh.uniforms.uTime = time;
    sh.uniforms.uHair = { value: new THREE.Color(L.hairEdge[0]) }; sh.uniforms.uHairY = { value: hairY };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSp = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform vec3 uInner; uniform vec3 uHair; uniform float uHairY; uniform float uTime; varying vec3 vSp;')
      // (the drawing's own colours only tell its hair: the body itself is the spirit's dark)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 spTex = texture2D( map, vMapUv );
      #else
        vec4 spTex = vec4( 1.0 );
      #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float spF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        float spRim = pow(spF, 3.0);
        float spFlow = 0.5 + 0.5 * sin(vSp.y * 11.0 - uTime * 1.7 + sin(vSp.x * 8.0 + uTime * 0.9) * 1.3);
        // the drawn hair (dark, over the brow) becomes the spirit's white hair, the locks' roots
        float spLum = dot(spTex.rgb, vec3(0.299, 0.587, 0.114));
        float spHair = smoothstep(uHairY, uHairY + 0.02, vSp.y) * (1.0 - smoothstep(0.2, 0.3, spLum));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.88, 1.0), spHair);
        totalEmissiveRadiance = totalEmissiveRadiance * 0.7 + uInner * (0.08 + 0.2 * spFlow * spF) * (1.0 - spHair) + uRim * spRim * 1.15 + uHair * spHair * (0.45 + 0.5 * spF);`);
  };
  m.customProgramCacheKey = () => 'spirit-skin';
  return m;
}

/** Armour plates and bands: dark, a soft sheen, a glowing edge and a gold line inside it (by their own uv). */
function armourMat(L: SpiritLook, edge = 0.07): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: L.armour, roughness: 0.45, metalness: 0.35, emissive: 0x000000, side: THREE.DoubleSide, envMapIntensity: 0.4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTrim = { value: new THREE.Color(L.trim) }; sh.uniforms.uGold = { value: new THREE.Color(L.gold) }; sh.uniforms.uE = { value: edge };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vAr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAr = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTrim; uniform vec3 uGold; uniform float uE; varying vec2 vAr;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float e = min(min(vAr.x, 1.0 - vAr.x), min(vAr.y, 1.0 - vAr.y));
        float glow = 1.0 - smoothstep(0.0, uE * 0.55, e);
        float gold = smoothstep(uE * 0.7, uE * 0.85, e) * (1.0 - smoothstep(uE * 1.05, uE * 1.25, e));
        diffuseColor.rgb = mix(diffuseColor.rgb, uGold * 0.55, gold);
        totalEmissiveRadiance += uTrim * glow * 1.5 + uGold * gold * 0.25;`);
  };
  m.customProgramCacheKey = () => 'spirit-armour';
  return m;
}

/** The dark line round the body: its back faces pushed out along the normals (after the bones have moved them). */
function outlineMat(color: number, width: number, hairY: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: width }; sh.uniforms.uHairY = { value: hairY };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uW; varying float vOy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOy = position.y;').replace('#include <skinning_vertex>', '#include <skinning_vertex>\n#ifdef USE_SKINNING\ntransformed += normalize( objectNormal ) * uW;\n#endif');
    // (none over the hair: the head's own hair is the spirit's white, and its line would show through it)
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHairY; varying float vOy;').replace('void main() {', 'void main() {\n  if (vOy > uHairY - 0.01) discard;');
  };
  m.customProgramCacheKey = () => 'spirit-outline';
  return m;
}

/** The katana: the grip dark, the guard dark gold, the blade from the guard on a violet light with a white edge. */
function bladeGlow(g: THREE.Object3D, L: SpiritLook, time: { value: number }): void {
  let guard = 0;
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && /disc/i.test((m.material as THREE.Material).name)) { m.geometry.computeBoundingBox(); guard = (m.geometry.boundingBox!.min.y + m.geometry.boundingBox!.max.y) / 2; } });
  g.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const old = m.material as THREE.MeshStandardMaterial;
    if (/disc/i.test(old.name)) { const d = old.clone(); d.color.set(0x2a1c10); d.emissive.set(0x7a5a1a); d.emissiveIntensity = 0.6; m.material = d; return; }
    const b = old.clone();
    b.onBeforeCompile = (sh) => {
      sh.uniforms.uBlade = { value: new THREE.Color(L.blade) }; sh.uniforms.uEdge = { value: new THREE.Color(L.bladeEdge) }; sh.uniforms.uGuard = { value: guard }; sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBl;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBl = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uBlade; uniform vec3 uEdge; uniform float uGuard; uniform float uTime; varying vec3 vBl;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bl = smoothstep(uGuard + 0.005, uGuard + 0.04, vBl.y);
          float pulse = 0.88 + 0.12 * sin(uTime * 3.0 + vBl.y * 6.0);
          float edge = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 1.4);
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.25, uBlade * 0.3, bl);
          totalEmissiveRadiance = mix(totalEmissiveRadiance, (uBlade * 1.7 + uEdge * edge * 1.6) * pulse, bl);`);
    };
    b.customProgramCacheKey = () => 'spirit-blade'; b.toneMapped = false;
    m.material = b;
  });
}

export class SpiritBody {
  private parts: Parts;
  private time = { value: 0 };
  private strands: Strands[] = [];
  private eyes: THREE.Sprite[] = [];
  private eyeAt: THREE.Vector3[] | null = null;
  private last = performance.now();
  private outline: THREE.SkinnedMesh | null = null;
  private dressed = false;
  private caps: { a: THREE.Vector3; b: THREE.Vector3; r: number; from: string; to: string }[] = [];

  constructor(hero: Hero3D, private L: SpiritLook) {
    const P = this.parts = hero as unknown as Parts;
    const body = P.body;
    if (body) {
      // the brow's height in the mesh's own space: above it, the drawn hair (a share of its height, measured on the body)
      body.geometry.computeBoundingBox(); const bb = body.geometry.boundingBox!;
      const hairY = bb.min.y + (bb.max.y - bb.min.y) * 0.915;
      body.material = spiritSkin(L, this.time, body.material as THREE.MeshStandardMaterial, hairY);
      const ol = new THREE.SkinnedMesh(body.geometry, outlineMat(L.outline, 0.014, hairY));
      ol.bind(body.skeleton, body.bindMatrix); ol.frustumCulled = false; ol.userData.worn = true;
      body.parent?.add(ol); this.outline = ol;
    }
    P.bones.get('Head')?.scale.setScalar(L.head);
    for (const [w, g] of P.weapons) if (w === 'katana') bladeGlow(g, L, this.time);
    const k = P.model.scale.x;
    for (const [from, to, r] of [['thigh_l', 'calf_l', 0.085], ['calf_l', 'foot_l', 0.065], ['thigh_r', 'calf_r', 0.085], ['calf_r', 'foot_r', 0.065], ['pelvis', 'spine_02', 0.15]] as [string, string, number][])
      this.caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: r * k, from, to });
    const caps = () => { for (const c of this.caps) { P.bones.get(c.from)!.getWorldPosition(c.a); P.bones.get(c.to)!.getWorldPosition(c.b); } return this.caps; };
    this.strands = [new Strands(COAT(L), P, L.head, caps), new Strands(CLOTH(L), P, L.head, caps), new Strands(HAIR(L), P, L.head, caps)];
    for (const s of this.strands) P.scene.add(s.mesh);
    // the eyes: a pale heart in a violet halo, each
    const tex = glowTexture(1.6);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i < 2 ? L.eyeHalo : L.eye, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
      s.renderOrder = 7; this.eyes.push(s); P.scene.add(s);
    }
    // every picture of him drawn: the strands step once per frame and lie across the camera that draws them
    P.scene.onBeforeRender = (_r, _s, cam) => this.update(cam);
  }

  /** The frame of the hero at rest (his right, up, ahead), the joint of a bone and the model's scale. */
  private frame(yaw: number): { F: THREE.Vector3; U: THREE.Vector3; R: THREE.Vector3; k: number } {
    const F = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    return { F, U: new THREE.Vector3(0, 1, 0), R: new THREE.Vector3(-F.z, 0, F.x), k: this.parts.model.scale.x };
  }

  /** The armour fixed to the bones (once he stands in the room): a shoulder guard over each upper arm, the sash's band
   *  round the waist with its knot, the scarf's band round the neck. */
  private dress(yaw: number): void {
    const P = this.parts, { F, U, R, k } = this.frame(yaw), L = this.L;
    P.root.updateMatrixWorld(true);
    const attach = (bone: string, mesh: THREE.Object3D, at: THREE.Vector3, look: THREE.Matrix4) => {
      const b = P.bones.get(bone)!; const w = new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromRotationMatrix(look), new THREE.Vector3(1, 1, 1));
      mesh.matrix.copy(b.matrixWorld.clone().invert().multiply(w)); mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); b.add(mesh);
    };
    // the shoulder guards (sode): a curved plate over the outside of each upper arm, its top at the shoulder, falling
    // out and down a little
    for (const s of [-1, 1]) {
      const side = s > 0 ? 'r' : 'l', arm = P.bones.get(`upperarm_${side}`)!, j = arm.getWorldPosition(new THREE.Vector3());
      const mesh = new THREE.Group();
      for (const [r0, r1, hh, y0] of [[0.115, 0.15, 0.19, 0], [0.125, 0.165, 0.13, -0.075]] as [number, number, number, number][]) { // (two lames: the upper, and the lower one out over it)
        const g = new THREE.CylinderGeometry(r0 * k, r1 * k, hh * k, 16, 1, true, -1.2, 2.4); g.translate(0, (y0 - hh / 2) * k, 0);
        const m = new THREE.Mesh(g, armourMat(L, 0.09)); m.castShadow = true; mesh.add(m);
      }
      // (its axis up the arm, tipped out a little; its curved face — the cylinder's +z side — outward)
      const out = R.clone().multiplyScalar(s), yA = U.clone().lerp(out, -0.22).normalize(), zA = out.clone().addScaledVector(yA, -out.dot(yA)).normalize(), xA = new THREE.Vector3().crossVectors(yA, zA);
      const basis = new THREE.Matrix4().makeBasis(xA, yA, zA);
      attach(`upperarm_${side}`, mesh, j.clone().addScaledVector(U, 0.035 * k).addScaledVector(out, 0.015 * k), basis);
    }
    // the sash: a crimson band round the waist, its knot at the left hip
    {
      const sp = P.bones.get('spine_01')!, j = sp.getWorldPosition(new THREE.Vector3());
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * k, 0.16 * k, 0.075 * k, 24, 1, true), new THREE.MeshStandardMaterial({ color: L.accent, roughness: 0.7, emissive: L.accentDeep, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
      band.scale.set(1, 1, 0.78);
      attach('spine_01', band, j.clone().addScaledVector(U, -0.05 * k).addScaledVector(F, 0.012 * k), new THREE.Matrix4().makeBasis(R, U, F));
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035 * k, 12, 8), (band.material as THREE.Material));
      knot.scale.set(1.2, 0.85, 0.8);
      attach('spine_01', knot, j.clone().addScaledVector(U, -0.05 * k).addScaledVector(R, -0.13 * k).addScaledVector(F, 0.06 * k), new THREE.Matrix4().makeBasis(R, U, F));
    }
    // the scarf: a crimson band round the neck
    {
      const nk = P.bones.get('neck_01')!, j = nk.getWorldPosition(new THREE.Vector3());
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * k, 0.1 * k, 0.07 * k, 20, 1, true), new THREE.MeshStandardMaterial({ color: L.accent, roughness: 0.75, emissive: L.accentDeep, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
      attach('neck_01', band, j.clone().addScaledVector(U, -0.02 * k).addScaledVector(F, 0.005 * k), new THREE.Matrix4().makeBasis(R, U, F));
    }
    this.dressed = true;
  }

  /** Where the eyes sit on the head (its own frame), read once he stands in the room. */
  private eyePlaces(yaw: number): THREE.Vector3[] {
    const P = this.parts, hd = P.bones.get('Head')!, { F, U, R } = this.frame(yaw), k = P.model.scale.x * this.L.head;
    const j = hd.getWorldPosition(new THREE.Vector3());
    return [-1, 1].map((s) => hd.worldToLocal(j.clone().addScaledVector(R, s * 0.037 * k).addScaledVector(U, 0.1 * k).addScaledVector(F, 0.1 * k)));
  }

  private update(cam: THREE.Camera): void {
    const now = performance.now(), ms = now - this.last;
    const sim = ms > 4 && (cam as THREE.PerspectiveCamera).isPerspectiveCamera; // (a snapshot of the body for an effect is not a new frame)
    if (sim) this.last = now;
    const dt = Math.min(1 / 20, Math.max(1 / 240, ms / 1000));
    if (sim) this.time.value += dt;
    const yaw = this.parts.root.rotation.y;
    this.parts.root.updateMatrixWorld(true);
    if (!this.dressed) this.dress(yaw);
    for (const s of this.strands) s.step(dt, this.time.value, yaw, cam, sim);
    if (!this.eyeAt) this.eyeAt = this.eyePlaces(yaw);
    const hd = this.parts.bones.get('Head')!, k = this.parts.model.scale.x * this.L.head, on = this.parts.body?.visible !== false;
    const hc = hd.getWorldPosition(new THREE.Vector3()).addScaledVector(new THREE.Vector3(0, 1, 0), 0.1 * k);
    this.eyes.forEach((e, i) => {
      e.position.copy(this.eyeAt![i % 2]); hd.localToWorld(e.position);
      const out = e.position.clone().sub(hc).normalize(), toCam = cam.position.clone().sub(e.position).normalize();
      const fl = 0.92 + 0.08 * Math.sin(this.time.value * 7 + i), big = i < 2 ? 2.6 : 1.1;
      e.scale.set(0.05 * k * big * fl, 0.026 * k * big * fl, 1); e.visible = on && out.dot(toCam) > -0.05; // (the far eye: behind the head)
    });
    if (this.outline && this.parts.body) this.outline.visible = this.parts.body.visible;
    for (const s of this.strands) s.mesh.visible = on;
  }
}

/** Gate 1b — the Spectral Samurai's own modelled body (spirit_samurai.glb: GPT's four drawings → shape → baked → the
 *  65-bone skeleton): its drawing kept as it is; the spirit only as a finish — a narrow violet light at its edges, the
 *  drawing's violet (the eyes, the coat's flames) lit from within, and the katana's violet-white blade. */
export class SpiritFinish {
  private time = { value: 0 };
  private last = performance.now();
  constructor(hero: Hero3D, L: SpiritLook = SPECTRAL_SAMURAI) {
    const P = hero as unknown as Parts;
    const body = P.body;
    if (body) {
      const old = body.material as THREE.MeshStandardMaterial;
      const m = new THREE.MeshStandardMaterial({ map: old.map, normalMap: old.normalMap, roughness: 0.78, metalness: 0, emissive: 0x000000, envMapIntensity: 0.25 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uRim = { value: new THREE.Color(L.rim) }; sh.uniforms.uTime = this.time;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uTime;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            float spF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
            #ifdef USE_MAP
              vec3 spC = texture2D( map, vMapUv ).rgb;
            #else
              vec3 spC = vec3( 0.0 );
            #endif
            // the drawing's own violet (bright, blue over green): lit from within, breathing slowly
            float spV = smoothstep(0.18, 0.45, spC.b) * smoothstep(0.15, 0.35, spC.b - spC.g) * smoothstep(0.08, 0.25, spC.r);
            float spPulse = 0.8 + 0.2 * sin(uTime * 1.6);
            totalEmissiveRadiance += spC * spV * 1.6 * spPulse + uRim * pow(spF, 3.0) * 0.55;`);
      };
      m.customProgramCacheKey = () => 'spirit-finish';
      body.material = m;
    }
    for (const [w, g] of P.weapons) if (w === 'katana') bladeGlow(g, L, this.time);
    const prev = P.scene.onBeforeRender;
    P.scene.onBeforeRender = (r, s, c, g2, m2, gr) => { const now = performance.now(); this.time.value += Math.min(0.05, (now - this.last) / 1000); this.last = now; prev?.call(P.scene, r, s, c, g2, m2, gr); };
  }
}

/** The Spectral Samurai's modelled body finished as a spirit (gate 1b). */
export function makeSpiritFinish(hero: Hero3D): SpiritFinish { return new SpiritFinish(hero); }

/** The camera for the spirits (GPT, gate 1: the hero about 30 % of the screen's height as the first target — about 7 of
 *  the world's 9 units away; the pull-back for several foes and each place's own framing kept). */
export function frameSpirit(a3: unknown): void {
  const a = a3 as { CAM?: { dist: number; pitch: number } };
  // (GPT, 9 Nov, after the 17° / 19° comparison: 19° for the world's exploration camera — more of the floor and the
  // blocks' tops for the depth movement; the cave's and the sky's own cameras keep theirs)
  if (a.CAM) a.CAM = { ...a.CAM, dist: a.CAM.dist * (7 / 9), pitch: a.CAM.pitch === 17 ? 19 : a.CAM.pitch };
}

/** The Spectral Samurai laid on a 3D hero. (No halo round his layer: a glow there rings his cast shadow on the floor
 *  too — his own light is the rim, the eyes and the blade.) */
export function makeSpirit(hero: Hero3D, _layer?: unknown, look: SpiritLook = SPECTRAL_SAMURAI): SpiritBody {
  return new SpiritBody(hero, look);
}
