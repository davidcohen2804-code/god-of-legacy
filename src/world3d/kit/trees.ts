// Trees grown from branches (the courtyard's recipe made a kit): a flared trunk, limbs that fork and droop, a crown of
// painted leaf clumps (one instanced draw, lit as a round crown, swaying in the wind, shaken by a gust) — a cherry, a
// maple, an orange tree or a pine by its crown's texture and colours — and the leaves that fall from the crowns,
// drift down, lie a while and are swept up again by a gust.
import * as THREE from 'three';
import { taperTube as rawTube } from '../../arena3d/RoomKit';
import { tube } from './units';
const taperTube: typeof rawTube = (...a) => tube(rawTube(...a));
import type { Disposable } from './units';

export interface TreeSpot { x: number; z: number; h: number; lean: number }
export interface TreeLook {
  /** The crown's clumps (an atlas of four), their tint and inner glow. */
  crownTex: THREE.Texture; crownColor?: number; crownEmissive?: number; crownEmissiveIntensity?: number;
  /** The clumps' size and how many per branch tip. */
  clumpScale?: number;
}
export interface Trees extends Disposable {
  /** The trunks' and limbs' geometry (merge it with the place's bark). */
  bark: THREE.BufferGeometry[];
  /** Where the crowns' clumps are (leaves fall from them). */
  clumps: { p: THREE.Vector3; s: number }[];
  crownCentre(x: number, z: number): THREE.Vector3;
  /** Each frame: the wind's strength (1 = the breeze; a gust raises it). */
  update(t: number, wind: number): void;
}

export function growTrees(scene: THREE.Scene, trees: TreeSpot[], ground: number, look: TreeLook, R: () => number, soft: boolean): Trees {
  const clumps: { p: THREE.Vector3; s: number }[] = [], bark: THREE.BufferGeometry[] = [];
  const grow = (base: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number) => {
    const pts = [base.clone()], seg = 3; let p = base.clone(); const d = dir.clone().normalize();
    for (let i = 1; i <= seg; i++) {
      d.add(new THREE.Vector3((R() - 0.5) * 0.5, (R() - 0.5) * 0.25 - (depth > 0 ? 0.08 : 0), (R() - 0.5) * 0.5)).normalize();
      p = p.clone().addScaledVector(d, len / seg); pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts), r1 = r0 * (depth >= 2 ? 0.35 : 0.55);
    bark.push(taperTube(curve, r0, r1, depth === 0 ? 10 : 6, depth === 0 ? 10 : 7, 0.55));
    if (depth >= 3) { clumps.push({ p: p.clone(), s: 0.7 + R() * 0.45 }); return; }
    const kids = depth === 0 ? 4 : 2 + Math.round(R());
    for (let k = 0; k < kids; k++) {
      const t = depth === 0 ? 0.92 : 0.45 + R() * 0.5, at = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const yaw = (k / kids) * Math.PI * 2 + R() * 1.2, out = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw) * 0.75);
      const nd = tan.clone().multiplyScalar(0.45).add(out.multiplyScalar(0.8)).add(new THREE.Vector3(0, depth === 0 ? 0.55 : 0.2, 0));
      grow(at, nd, len * (0.62 + R() * 0.18), r1 * (depth === 0 ? 0.62 : 0.78), depth + 1);
    }
    for (let k = 0; k < (depth >= 1 ? 3 : 0); k++) { const at = curve.getPointAt(0.35 + R() * 0.6); clumps.push({ p: at.add(new THREE.Vector3((R() - 0.5) * 0.3, 0.1 + R() * 0.2, (R() - 0.5) * 0.3)), s: 0.55 + R() * 0.4 }); }
  };
  for (const t of trees) {
    const base = new THREE.Vector3(t.x, ground - 0.05, t.z);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + R(); bark.push(taperTube(new THREE.CatmullRomCurve3([base.clone().add(new THREE.Vector3(0, 0.35, 0)), base.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45)), base.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, -0.04, Math.sin(a) * 0.8))]), 0.16, 0.04, 6, 6, 0.55)); }
    const top = base.clone().add(new THREE.Vector3(t.lean * 0.8, t.h, (R() - 0.5) * 0.3));
    const trunk = new THREE.CatmullRomCurve3([base, base.clone().add(new THREE.Vector3(t.lean * 0.15, t.h * 0.4, 0.05)), base.clone().add(new THREE.Vector3(t.lean * 0.55, t.h * 0.75, -0.05)), top]);
    bark.push(taperTube(trunk, 0.36 * Math.min(1.4, t.h / 2.4), 0.22, 12, 12, 0.55));
    for (let k = 0; k < 4; k++) {
      const yaw = (k / 4) * Math.PI * 2 + R() * 0.8 + 0.3, out = new THREE.Vector3(Math.cos(yaw) * (1 + Math.abs(t.lean)), 0.7 + R() * 0.4, Math.sin(yaw) * 0.6);
      grow(top.clone(), out, 1.5 + R() * 0.6, 0.18, 1);
    }
  }
  const crownCentre = (x: number, z: number): THREE.Vector3 => {
    let best = trees[0], bd = Infinity; for (const t of trees) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
    return new THREE.Vector3(best.x + best.lean * 0.8, ground + best.h + 0.9, best.z);
  };
  // the crown: one instanced card per clump (four painted clumps in the atlas), lit as a soft round crown, swaying
  const bMat = new THREE.MeshStandardMaterial({ map: look.crownTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, color: look.crownColor ?? 0xffffff, emissive: look.crownEmissive ?? 0x000000, emissiveIntensity: look.crownEmissiveIntensity ?? 0.5 });
  const uTime = { value: 0 }, uWind = { value: 1 };
  bMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'attribute vec2 uvOff;\nattribute vec3 aCrown;\nuniform float uTime;\nuniform float uWind;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * 0.5 + uvOff;\n#endif')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aCrown;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('#include <project_vertex>', 'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nmvPosition = instanceMatrix * mvPosition;\n#endif\n'
        + 'float sw = sin(uTime * 1.15 + mvPosition.x * 0.9 + mvPosition.z * 0.7) * 0.055 + sin(uTime * 2.4 + mvPosition.y * 2.1 + mvPosition.x) * 0.022;\n'
        + 'mvPosition.x += sw * uWind; mvPosition.y += sw * 0.35 * uWind; mvPosition.z += sw * 0.4 * uWind;\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
  };
  const nB = clumps.length, bGeo = new THREE.PlaneGeometry(1, 1), crown = new THREE.InstancedMesh(bGeo, bMat, Math.max(1, nB));
  const uvOff = new Float32Array(nB * 2), nrm = new Float32Array(nB * 3), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const k = look.clumpScale ?? 1.05;
  for (let i = 0; i < nB; i++) {
    const b = clumps[i], centre = crownCentre(b.p.x, b.p.z);
    e.set((R() - 0.5) * 1.6, R() * Math.PI * 2, (R() - 0.5) * 1.2); q.setFromEuler(e);
    const s = b.s * k; m4.compose(b.p, q, new THREE.Vector3(s, s, s)); crown.setMatrixAt(i, m4);
    const v = (R() * 4) | 0; uvOff[i * 2] = (v % 2) * 0.5; uvOff[i * 2 + 1] = (v >> 1) * 0.5;
    const nW = b.p.clone().sub(centre).normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize(); nW.applyQuaternion(q.clone().invert());
    nrm.set([nW.x, nW.y, nW.z], i * 3);
  }
  bGeo.setAttribute('uvOff', new THREE.InstancedBufferAttribute(uvOff, 2)); bGeo.setAttribute('aCrown', new THREE.InstancedBufferAttribute(nrm, 3));
  crown.castShadow = !soft; crown.receiveShadow = false;
  crown.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: look.crownTex, alphaTest: 0.42 });
  crown.computeBoundingSphere(); scene.add(crown);
  return {
    bark, clumps, crownCentre,
    update: (t, wind) => { uTime.value = t; uWind.value = wind; },
    dispose: () => { scene.remove(crown); bGeo.dispose(); bMat.dispose(); crown.customDepthMaterial?.dispose(); },
  };
}

export interface LeafFallOpts {
  /** Where leaves leave from (the crowns' clumps), the ground's height under a point, how many in the air and lying. */
  from: { p: THREE.Vector3 }[]; groundY(x: number, z: number): number; falling: number; lying: number;
  /** Where the lying carpet spreads (the whole place) and where it gathers (under the trees). */
  bounds: { x0: number; x1: number; z0: number; z1: number }; under: { x: number; z: number }[];
  /** The leaf: its painted card, its size and its colours (HSL ranges). */
  tex: THREE.Texture; size: [number, number]; hue: [number, number]; sat: [number, number]; light: [number, number];
  emissive?: number;
}
export interface LeafFall extends Disposable {
  update(dt: number, t: number, gust: number, dir: number, breeze: { x: number; z: number }): void;
  blow(x: number, y: number, z: number, R: number, strength: number): void;
  /** A gust shakes leaves loose: a share of them go back to the crowns and fall again. */
  shake(strength: number): void;
}

export function leafFall(scene: THREE.Scene, o: LeafFallOpts, R: () => number): LeafFall {
  const pMat = new THREE.MeshStandardMaterial({ map: o.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, emissive: o.emissive ?? 0x000000, emissiveIntensity: 0.5 });
  const pGeo = new THREE.PlaneGeometry(o.size[0], o.size[1]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const hsl = () => col.setHSL(o.hue[0] + R() * (o.hue[1] - o.hue[0]), o.sat[0] + R() * (o.sat[1] - o.sat[0]), o.light[0] + R() * (o.light[1] - o.light[0]));
  let lying: THREE.InstancedMesh | null = null;
  if (o.lying > 0) {
    lying = new THREE.InstancedMesh(pGeo, pMat, o.lying);
    for (let i = 0; i < o.lying; i++) {
      let x: number, z: number;
      if (i % 3 && o.under.length) { const t = o.under[(R() * o.under.length) | 0], r = Math.sqrt(-2 * Math.log(R() + 1e-6)) * 1.5, a = R() * Math.PI * 2; x = t.x + Math.cos(a) * r * 1.3; z = t.z + Math.sin(a) * r; }
      else { x = o.bounds.x0 + R() * (o.bounds.x1 - o.bounds.x0); z = o.bounds.z0 + R() * (o.bounds.z1 - o.bounds.z0); }
      e.set(-Math.PI / 2 + (R() - 0.5) * 0.3, 0, R() * Math.PI * 2); q.setFromEuler(e);
      const s = 0.7 + R() * 0.6; m4.compose(new THREE.Vector3(x, o.groundY(x, z) + 0.004 + R() * 0.003, z), q, new THREE.Vector3(s, s, s)); lying.setMatrixAt(i, m4);
      lying.setColorAt(i, hsl());
    }
    lying.receiveShadow = true; scene.add(lying);
  }
  const NF = o.falling, falling = new THREE.InstancedMesh(pGeo, pMat, Math.max(1, NF));
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage); falling.frustumCulled = false; scene.add(falling);
  for (let i = 0; i < NF; i++) falling.setColorAt(i, hsl());
  if (falling.instanceColor) falling.instanceColor.needsUpdate = true;
  const fp = new Float32Array(NF * 3), fv = new Float32Array(NF * 3), fr = new Float32Array(NF * 3), fs = new Float32Array(NF * 3), fl = new Float32Array(NF), fk = new Uint8Array(NF), fph = new Float32Array(NF);
  const spawn = (i: number, anywhere: boolean) => {
    const b = o.from.length ? o.from[(R() * o.from.length) | 0].p : new THREE.Vector3((o.bounds.x0 + o.bounds.x1) / 2, 3, (o.bounds.z0 + o.bounds.z1) / 2);
    const gy = o.groundY(b.x, b.z);
    fp[i * 3] = b.x + (R() - 0.5) * 0.6; fp[i * 3 + 1] = anywhere ? gy + 0.2 + R() * Math.max(0.5, b.y - gy) : b.y - 0.1; fp[i * 3 + 2] = b.z + (R() - 0.5) * 0.6;
    fv[i * 3] = 0; fv[i * 3 + 1] = -0.15; fv[i * 3 + 2] = 0;
    fr[i * 3] = R() * 6; fr[i * 3 + 1] = R() * 6; fr[i * 3 + 2] = R() * 6;
    fs[i * 3] = 1 + R() * 3; fs[i * 3 + 1] = 0.5 + R() * 2; fs[i * 3 + 2] = 1 + R() * 2.5;
    fk[i] = 0; fl[i] = 0; fph[i] = R() * 10;
  };
  for (let i = 0; i < NF; i++) spawn(i, true);
  const dummy = new THREE.Object3D();
  const cx = (o.bounds.x0 + o.bounds.x1) / 2, halfW = (o.bounds.x1 - o.bounds.x0) / 2;
  return {
    update: (dt, t, gust, dir, breeze) => {
      const g = 1 + Math.sin(t * 0.37) * 0.35 + Math.sin(t * 1.3) * 0.12;
      for (let i = 0; i < NF; i++) {
        const j = i * 3;
        if (fk[i] === 0) {
          fph[i] += dt;
          const flutter = Math.sin(fph[i] * 2.2 + i) * 0.28;
          fv[j] += ((breeze.x * g + dir * gust * 1.6 + flutter) - fv[j]) * Math.min(1, dt * 1.6);
          fv[j + 1] += (-0.32 - fv[j + 1]) * Math.min(1, dt * 1.2);
          fv[j + 2] += ((breeze.z + Math.cos(fph[i] * 1.7 + i) * 0.12) - fv[j + 2]) * Math.min(1, dt * 1.6);
          fp[j] += fv[j] * dt; fp[j + 1] += fv[j + 1] * dt; fp[j + 2] += fv[j + 2] * dt;
          fr[j] += fs[j] * dt; fr[j + 1] += fs[j + 1] * dt; fr[j + 2] += fs[j + 2] * dt;
          const gy = o.groundY(fp[j], fp[j + 2]);
          if (fp[j + 1] <= gy + 0.006) { fk[i] = 1; fp[j + 1] = gy + 0.005; fl[i] = 4 + R() * 5; fr[j] = -Math.PI / 2; fr[j + 1] = 0; }
          if (Math.abs(fp[j] - cx) > halfW + 14) spawn(i, false);
        } else {
          fl[i] -= dt;
          if (Math.abs(fv[j]) + Math.abs(fv[j + 1]) + Math.abs(fv[j + 2]) > 0.05) { fk[i] = 0; continue; }
          if (fl[i] <= 0) spawn(i, false);
        }
        const k = fk[i] === 1 ? Math.min(1, fl[i] / 1.2) : 1;
        dummy.position.set(fp[j], fp[j + 1], fp[j + 2]); dummy.rotation.set(fr[j], fr[j + 1], fr[j + 2]); dummy.scale.setScalar(k);
        dummy.updateMatrix(); falling.setMatrixAt(i, dummy.matrix);
      }
      falling.instanceMatrix.needsUpdate = true;
    },
    blow: (x, y, z, Rr, strength) => {
      for (let i = 0; i < NF; i++) {
        const j = i * 3, dx = fp[j] - x, dz = fp[j + 2] - z, dy = fp[j + 1] - y, d = Math.hypot(dx, dz, dy * 0.6);
        if (d > Rr || d < 1e-3) continue;
        const f = strength * (1 - d / Rr);
        fv[j] += (dx / d) * f; fv[j + 1] += f * 0.7 + R() * 0.5; fv[j + 2] += (dz / d) * f * 0.8; fk[i] = 0; fp[j + 1] += 0.01;
      }
    },
    shake: (st) => { let n = Math.round(NF * 0.22 * Math.min(1, st)); for (let i = 0; i < NF && n > 0; i++) if (fk[i] === 1 || R() < 0.15) { spawn(i, false); n--; } },
    dispose: () => { scene.remove(falling); if (lying) scene.remove(lying); pGeo.dispose(); pMat.dispose(); },
  };
}

/** A painted leaf (a maple's, pointed) on transparency. */
export function mapleLeafCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.translate(32, 34);
  const gr = g.createRadialGradient(0, 4, 2, 0, 0, 28); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(0.6, '#f08a3a'); gr.addColorStop(1, '#b8401e');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 28); g.lineTo(-8, 8); g.lineTo(-26, 10); g.lineTo(-14, -4); g.lineTo(-22, -22); g.lineTo(-6, -14); g.lineTo(0, -30); g.lineTo(6, -14); g.lineTo(22, -22); g.lineTo(14, -4); g.lineTo(26, 10); g.lineTo(8, 8); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,40,20,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 26); g.lineTo(0, -26); g.moveTo(0, 4); g.lineTo(-20, -18); g.moveTo(0, 4); g.lineTo(20, -18); g.stroke();
  return c;
}

/** A crown atlas (2 × 2 clumps) of leaves in the given colours: a soft round mass of overlapping leaf blobs. */
export function crownCanvas(colors: [string, string, string], seed = 1): HTMLCanvasElement {
  let s = seed >>> 0; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 256 + 128, oy = (cell >> 1) * 256 + 128;
    for (let i = 0; i < 90; i++) {
      const a = R() * Math.PI * 2, r = Math.pow(R(), 0.6) * 96, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r * 0.9, rad = 10 + R() * 18;
      const k = 1 - r / 110, col = R() < 0.3 ? colors[2] : R() < 0.5 ? colors[1] : colors[0];
      g.globalAlpha = 0.55 + k * 0.45; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  return c;
}
