// THE SPECTRAL SAMURAI (Legacy of Spirits, David and GPT 9 Nov — the concept: an ethereal warrior, a dark spiritual
// body, luminous eyes, flowing white hair, crimson fabric accents, a brilliant violet-white katana; "a clearly readable
// solid silhouette, with controlled transparency and glowing edges"). The game's 3D hero, on its own skeleton and the
// game's moves, re-dressed as a spirit: its skin a near-black body lit from within with a pale glowing rim, a dark line
// round it (it reads on bright stone), a bigger head (the concept's in-game sprites lean chibi), two glowing eyes, white
// hair and crimson sash and scarf tails that float and trail (verlet strands held to their shape at the root), the
// katana's blade glowing violet-white from the guard. Every move, every skill and every item stay the game's own: the
// spirit is a look laid on the body, not a new body. Hero3D is untouched (its parts are reached as they are).
import * as THREE from 'three';
import type { Hero3D } from '../arena3d/Hero3D';

export interface SpiritLook {
  /** The body's dark base, its light inside (under the rim), the glowing rim, the dark line round it. */
  core: number; inner: number; rim: number; outline: number;
  eye: number;
  /** The hair at its roots and its tips. */
  hair: [number, number];
  /** The fabric accents (sash, scarf): their colour and their dark fold. */
  accent: number; accentDeep: number;
  /** The blade's glow and its white-hot edge. */
  blade: number; bladeEdge: number;
  /** The head's size (the concept's in-game sprites lean chibi). */
  head: number;
  /** The halo round the whole body on its layer (a soft glow: it keeps the dark body apart from a dark ground). */
  halo: number;
}

export const SPECTRAL_SAMURAI: SpiritLook = {
  core: 0x140e20, inner: 0x4a2a8a, rim: 0xe2d4ff, outline: 0x07040d, eye: 0xf8f0ff,
  hair: [0xffffff, 0xcdb8ff], accent: 0xd0102c, accentDeep: 0x5c0714,
  blade: 0xb58aff, bladeEdge: 0xffffff, head: 1.42, halo: 0x9a6cff,
};

/** Hero3D's own parts (private there: reached as they are, never changed in shape). */
interface Parts { body: THREE.SkinnedMesh | null; bones: Map<string, THREE.Bone>; model: THREE.Group; root: THREE.Group; scene: THREE.Scene; weapons: Map<string, THREE.Group> }

type V3 = [number, number, number];
/** A strand: its root on a bone (in the hero's own frame — x his right, y up, z ahead — model units from the joint, ×
 *  the head's size for hair), its rest way, its points, length (world units), width root → tip, colour and alpha root →
 *  tip, how firmly it keeps its shape, how it floats (up: a spirit's hair; down: cloth) and how far it curls down. */
interface StrandDef { bone: string; at: V3; dir: V3; n: number; len: number; w: [number, number]; col: [number, number]; a: [number, number]; stiff: number; lift: number; curl: number; wind: number }

const HAIR = (L: SpiritLook): StrandDef[] => {
  const h = (bone: string, at: V3, dir: V3, len: number, w0: number, stiff = 0.22, curl = 0.5, lift = 0.6): StrandDef => ({ bone, at, dir, n: 8, len, w: [w0, 0.004], col: L.hair, a: [1, 0.25], stiff, lift, curl, wind: 1 });
  const out: StrandDef[] = [];
  // the mane: long strands from the back of the skull, swept back and floating
  for (const [x, y, z, len] of [[0, 0.2, -0.05, 0.62], [0.05, 0.18, -0.06, 0.58], [-0.05, 0.18, -0.06, 0.58], [0.08, 0.13, -0.05, 0.5], [-0.08, 0.13, -0.05, 0.5], [0.03, 0.1, -0.08, 0.46], [-0.03, 0.1, -0.08, 0.46], [0, 0.14, -0.08, 0.54]] as [number, number, number, number][])
    out.push(h('Head', [x, y, z], [x * 3, 0.28, -1], len, 0.075, 0.2, 0.55, 0.75));
  // the crown: shorter strands swept up and back, wild
  for (const [x, z, len] of [[0, 0.04, 0.32], [0.05, 0.02, 0.28], [-0.05, 0.02, 0.28], [0.03, 0.07, 0.24], [-0.03, 0.07, 0.24]] as [number, number, number][])
    out.push(h('Head', [x, 0.235, z], [x * 4, 0.75, -0.75], len, 0.06, 0.3, 0.25, 0.9));
  // by the temples, flowing back past the ears
  for (const s of [-1, 1]) out.push(h('Head', [s * 0.095, 0.15, 0.02], [s * 0.35, 0.05, -1], 0.36, 0.05, 0.26, 0.4, 0.5));
  // the bangs: short, over the brow, the eyes left clear
  for (const s of [-1, 1]) out.push(h('Head', [s * 0.045, 0.215, 0.085], [s * 0.35, -0.25, 1], 0.13, 0.04, 0.45, 0.35, 0.2));
  return out;
};
const CLOTH = (L: SpiritLook): StrandDef[] => {
  const c = (bone: string, at: V3, dir: V3, len: number, w0: number, w1: number): StrandDef => ({ bone, at, dir, n: 9, len, w: [w0, w1], col: [L.accent, L.accentDeep], a: [1, 0.85], stiff: 0.12, lift: -0.35, curl: 0.9, wind: 1.3 });
  return [
    // the scarf's two tails from the back of the neck
    c('neck_01', [0.02, 0.0, -0.06], [0.15, -0.1, -1], 0.62, 0.075, 0.03), c('neck_01', [-0.03, -0.01, -0.06], [-0.1, -0.25, -1], 0.5, 0.065, 0.025),
    // the sash's two tails from the back of the waist
    c('spine_01', [0.05, -0.02, -0.12], [0.2, -0.6, -1], 0.5, 0.07, 0.035), c('spine_01', [-0.04, -0.03, -0.12], [-0.15, -0.75, -1], 0.42, 0.06, 0.03),
  ];
};

class Strands {
  readonly mesh: THREE.Mesh;
  private defs: StrandDef[];
  private base: number[] = [];
  private p: Float32Array; private q: Float32Array; private rest: THREE.Vector3[] = [];
  private seg: number[] = [];
  private pos: Float32Array; private col: Float32Array;
  private bones: THREE.Bone[] = [];
  private ready = false;
  private static v = new THREE.Vector3(); private static w = new THREE.Vector3(); private static t = new THREE.Vector3();
  constructor(defs: StrandDef[], private parts: Parts, private scale: number) {
    this.defs = defs;
    let N = 0; for (const d of defs) { this.base.push(N); N += d.n; }
    this.p = new Float32Array(N * 3); this.q = new Float32Array(N * 3);
    this.pos = new Float32Array(N * 2 * 3); this.col = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    defs.forEach((d, s) => { const b = this.base[s]; for (let i = 0; i < d.n - 1; i++) { const a = (b + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setIndex(idx);
    // colours along each strand (root → tip), fixed
    defs.forEach((d, s) => {
      const c0 = new THREE.Color(d.col[0]), c1 = new THREE.Color(d.col[1]);
      for (let i = 0; i < d.n; i++) { const k = i / (d.n - 1), c = c0.clone().lerp(c1, k), a = d.a[0] + (d.a[1] - d.a[0]) * k; for (const e of [0, 1]) this.col.set([c.r, c.g, c.b, a], ((this.base[s] + i) * 2 + e) * 4); }
    });
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }

  /** The rest shape on the bones, read once the body stands in the room (its facing known). */
  private init(yaw: number): void {
    const P = this.parts, F = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), U = new THREE.Vector3(0, 1, 0), R = new THREE.Vector3(-F.z, 0, F.x);
    const k = P.model.scale.x;
    P.root.updateMatrixWorld(true);
    this.defs.forEach((d) => {
      const bone = P.bones.get(d.bone)!; this.bones.push(bone);
      const hs = d.bone === 'Head' ? this.scale : 1;
      const j = bone.getWorldPosition(new THREE.Vector3());
      const at = j.clone().addScaledVector(R, d.at[0] * k * hs).addScaledVector(U, d.at[1] * k * hs).addScaledVector(F, d.at[2] * k * hs);
      const dir = new THREE.Vector3().addScaledVector(R, d.dir[0]).addScaledVector(U, d.dir[1]).addScaledVector(F, d.dir[2]).normalize();
      const L = d.len / (d.n - 1); this.seg.push(L);
      for (let i = 0; i < d.n; i++) {
        // the rest way bends down along the strand (its curl), as hair and cloth hang
        const k2 = i / (d.n - 1), way = dir.clone().lerp(new THREE.Vector3(dir.x * 0.6, -1, dir.z * 0.6).normalize(), d.curl * k2 * k2).normalize();
        const w = i === 0 ? at.clone() : this.rest.length ? bone.localToWorld(this.rest[this.rest.length - 1].clone()).addScaledVector(way, L) : at.clone();
        this.rest.push(bone.worldToLocal(w.clone()));
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

  /** One step: each point carried by its momentum, floated or dropped, blown back from where he faces, pulled toward
   *  its rest place (firmly at the root, loosely at the tip), its length kept; then the ribbons laid across the view. */
  step(dt: number, t: number, yaw: number, cam: THREE.Camera, sim: boolean): void {
    if (!this.ready) this.init(yaw);
    const P = this.p, Q = this.q, V = Strands.v, W = Strands.w, T = Strands.t;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    let r = 0;
    if (sim) {
      // a jump across the map (a portal, a respawn): straight to the rest shape
      const root0 = this.bones[0].localToWorld(this.rest[0].clone());
      if (Math.hypot(root0.x - P[0], root0.y - P[1], root0.z - P[2]) > 1.2) this.snap();
      const dt2 = dt * dt;
      this.defs.forEach((d, s) => {
        const b0 = this.base[s], L = this.seg[s];
        for (let i = 0; i < d.n; i++, r++) {
          const o = (b0 + i) * 3;
          T.copy(this.rest[r]); this.bones[s].localToWorld(T);
          if (i === 0) { P[o] = T.x; P[o + 1] = T.y; P[o + 2] = T.z; Q[o] = T.x; Q[o + 1] = T.y; Q[o + 2] = T.z; continue; }
          const k = i / (d.n - 1), flow = Math.sin(t * 2.3 + i * 0.7 + s * 1.9) * 0.5 + Math.sin(t * 5.1 + s) * 0.25;
          const ax = back.x * d.wind * (1.2 + flow) * k, ay = d.lift * 6 * k + flow * 0.8 * k, az = back.z * d.wind * (1.2 + flow) * k;
          const vx = (P[o] - Q[o]) * 0.9, vy = (P[o + 1] - Q[o + 1]) * 0.9, vz = (P[o + 2] - Q[o + 2]) * 0.9;
          Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
          P[o] += vx + ax * dt2; P[o + 1] += vy + ay * dt2; P[o + 2] += vz + az * dt2;
          const pull = d.stiff * Math.pow(1 - k, 1.3) + 0.02;
          P[o] += (T.x - P[o]) * pull; P[o + 1] += (T.y - P[o + 1]) * pull; P[o + 2] += (T.z - P[o + 2]) * pull;
        }
        for (let i = 1; i < d.n; i++) { // its length kept, link by link from the root
          const o = (b0 + i) * 3, op = o - 3;
          V.set(P[o] - P[op], P[o + 1] - P[op + 1], P[o + 2] - P[op + 2]); const len = V.length() || 1e-6;
          V.multiplyScalar(L / len); P[o] = P[op] + V.x; P[o + 1] = P[op + 1] + V.y; P[o + 2] = P[op + 2] + V.z;
        }
      });
    }
    // the ribbons, each point's width across the view
    const cp = cam.position;
    this.defs.forEach((d, s) => {
      const b0 = this.base[s];
      for (let i = 0; i < d.n; i++) {
        const o = (b0 + i) * 3, a = Math.max(0, i - 1), b = Math.min(d.n - 1, i + 1), oa = (b0 + a) * 3, ob = (b0 + b) * 3;
        V.set(P[ob] - P[oa], P[ob + 1] - P[oa + 1], P[ob + 2] - P[oa + 2]).normalize();
        W.set(cp.x - P[o], cp.y - P[o + 1], cp.z - P[o + 2]).normalize();
        T.crossVectors(V, W); if (T.lengthSq() < 1e-8) T.set(1, 0, 0); T.normalize();
        const k = i / (d.n - 1), w = (d.w[0] + (d.w[1] - d.w[0]) * Math.pow(k, 0.8)) * 0.5;
        const v0 = (b0 + i) * 2 * 3;
        this.pos[v0] = P[o] + T.x * w; this.pos[v0 + 1] = P[o + 1] + T.y * w; this.pos[v0 + 2] = P[o + 2] + T.z * w;
        this.pos[v0 + 3] = P[o] - T.x * w; this.pos[v0 + 4] = P[o + 1] - T.y * w; this.pos[v0 + 5] = P[o + 2] - T.z * w;
      }
    });
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

function glowTexture(stretch: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.translate(32, 32); g.scale(1, 1 / stretch); g.translate(-32, -32); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** The body's skin as a spirit: near-black, a faint light moving inside it, a pale glow at its edges. */
function spiritSkin(L: SpiritLook, time: { value: number }): THREE.MeshStandardMaterial {
  // (the material's own emissive stays the game's: Hero3D lays a blow's tint on it — the spirit's light is its own)
  const m = new THREE.MeshStandardMaterial({ color: L.core, roughness: 0.6, metalness: 0, emissive: 0x000000, emissiveIntensity: 1, envMapIntensity: 0.3 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(L.rim) }; sh.uniforms.uInner = { value: new THREE.Color(L.inner) }; sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSp = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform vec3 uInner; uniform float uTime; varying vec3 vSp;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float spF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        float spRim = pow(spF, 2.6);
        float spFlow = 0.5 + 0.5 * sin(vSp.y * 10.0 - uTime * 1.7 + sin(vSp.x * 8.0 + uTime * 0.9) * 1.3);
        totalEmissiveRadiance = totalEmissiveRadiance * 0.7 + uInner * (0.1 + 0.16 * spFlow * (0.4 + spF)) + uRim * spRim * 1.35;`);
  };
  m.customProgramCacheKey = () => 'spirit-skin';
  return m;
}

/** The dark line round the body: its back faces pushed out along the normals (after the bones have moved them). */
function outlineMat(color: number, width: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: width };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uW;').replace('#include <skinning_vertex>', '#include <skinning_vertex>\n#ifdef USE_SKINNING\ntransformed += normalize( objectNormal ) * uW;\n#endif');
  };
  m.customProgramCacheKey = () => 'spirit-outline';
  return m;
}

/** The katana: the grip and guard dark with a little gold, the blade from the guard on a violet light with a white edge. */
function bladeGlow(g: THREE.Object3D, L: SpiritLook, time: { value: number }): void {
  let guard = 0;
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && /disc/i.test((m.material as THREE.Material).name)) { m.geometry.computeBoundingBox(); guard = (m.geometry.boundingBox!.min.y + m.geometry.boundingBox!.max.y) / 2; } });
  g.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const old = m.material as THREE.MeshStandardMaterial;
    if (/disc/i.test(old.name)) { const d = old.clone(); d.color.set(0x2a1c10); d.emissive.set(0x6a4a1a); d.emissiveIntensity = 0.5; m.material = d; return; }
    const b = old.clone();
    b.onBeforeCompile = (sh) => {
      sh.uniforms.uBlade = { value: new THREE.Color(L.blade) }; sh.uniforms.uEdge = { value: new THREE.Color(L.bladeEdge) }; sh.uniforms.uGuard = { value: guard }; sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBl;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBl = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uBlade; uniform vec3 uEdge; uniform float uGuard; uniform float uTime; varying vec3 vBl;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bl = smoothstep(uGuard + 0.005, uGuard + 0.05, vBl.y);
          float pulse = 0.85 + 0.15 * sin(uTime * 3.0 + vBl.y * 6.0);
          float edge = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 1.5);
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.35, uBlade * 0.25, bl);
          totalEmissiveRadiance = mix(totalEmissiveRadiance, (uBlade * 1.6 + uEdge * edge * 1.4) * pulse, bl);`);
    };
    b.customProgramCacheKey = () => 'spirit-blade';
    m.material = b;
  });
}

export class SpiritBody {
  private parts: Parts;
  private time = { value: 0 };
  private hair: Strands; private cloth: Strands;
  private eyes: THREE.Sprite[] = [];
  private eyeAt: THREE.Vector3[] | null = null;
  private last = performance.now();
  private outline: THREE.SkinnedMesh | null = null;

  constructor(private hero: Hero3D, private L: SpiritLook) {
    const P = this.parts = hero as unknown as Parts;
    const body = P.body;
    if (body) {
      body.material = spiritSkin(L, this.time);
      // the dark line round him: a twin on the same bones
      const ol = new THREE.SkinnedMesh(body.geometry, outlineMat(L.outline, 0.016));
      ol.bind(body.skeleton, body.bindMatrix); ol.frustumCulled = false; ol.userData.worn = true;
      body.parent?.add(ol); this.outline = ol;
    }
    // the bigger head (its hair and eyes are laid on at its size)
    P.bones.get('Head')?.scale.setScalar(L.head);
    // the katana (and any blade he takes in hand)
    for (const [w, g] of P.weapons) if (w === 'katana') bladeGlow(g, L, this.time);
    this.hair = new Strands(HAIR(L), P, L.head);
    this.cloth = new Strands(CLOTH(L), P, 1);
    P.scene.add(this.hair.mesh, this.cloth.mesh);
    // the eyes: two pale, slightly long glows on the face
    const tex = glowTexture(1.7);
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: L.eye, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      s.renderOrder = 7; this.eyes.push(s); P.scene.add(s);
    }
    // every picture of him drawn: the strands step once per frame and lie across the camera that draws them
    P.scene.onBeforeRender = (_r, _s, cam) => this.update(cam);
  }

  /** Where the eyes sit on the head (its own frame), read once he stands in the room. */
  private eyePlaces(yaw: number): THREE.Vector3[] {
    const P = this.parts, hd = P.bones.get('Head')!, k = P.model.scale.x * this.L.head;
    P.root.updateMatrixWorld(true);
    const F = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), R = new THREE.Vector3(-F.z, 0, F.x), j = hd.getWorldPosition(new THREE.Vector3());
    return [-1, 1].map((s) => hd.worldToLocal(j.clone().addScaledVector(R, s * 0.036 * k).addScaledVector(new THREE.Vector3(0, 1, 0), 0.1 * k).addScaledVector(F, 0.088 * k)));
  }

  private update(cam: THREE.Camera): void {
    const now = performance.now(), ms = now - this.last;
    const sim = ms > 4 && (cam as THREE.PerspectiveCamera).isPerspectiveCamera; // (a snapshot of the body for an effect is not a new frame)
    if (sim) this.last = now;
    const dt = Math.min(1 / 20, Math.max(1 / 240, ms / 1000));
    if (sim) this.time.value += dt;
    const yaw = this.parts.root.rotation.y;
    this.parts.root.updateMatrixWorld(true);
    this.hair.step(dt, this.time.value, yaw, cam, sim);
    this.cloth.step(dt, this.time.value, yaw, cam, sim);
    if (!this.eyeAt) this.eyeAt = this.eyePlaces(yaw);
    const hd = this.parts.bones.get('Head')!, k = this.parts.model.scale.x * this.L.head;
    this.eyes.forEach((e, i) => { e.position.copy(this.eyeAt![i]); hd.localToWorld(e.position); const fl = 0.9 + 0.1 * Math.sin(this.time.value * 7 + i); e.scale.set(0.05 * k * 1.4 * fl, 0.028 * k * 1.4 * fl, 1); e.visible = this.parts.body?.visible !== false; });
    if (this.outline && this.parts.body) this.outline.visible = this.parts.body.visible;
  }
}

/** The Spectral Samurai laid on a 3D hero (and its halo on the layer it is drawn in). */
export function makeSpirit(hero: Hero3D, layer?: { preFX?: { addGlow(color?: number, outer?: number, inner?: number, knockout?: boolean, quality?: number, distance?: number): unknown } | null }, look: SpiritLook = SPECTRAL_SAMURAI): SpiritBody {
  layer?.preFX?.addGlow(look.halo, 2.2, 0, false, 0.12, 10);
  return new SpiritBody(hero, look);
}
