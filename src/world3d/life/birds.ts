// Birds: a small flock circling over the place in a loose, wandering ring — one now and then peels off, glides down to
// a perch (the roof's ridge, an eave's end), sits a while with its wings folded, and takes off again. A big gust (a
// heavy blow below) startles every sitting bird into the air. Dark against the sky; one instanced draw, the wings
// flapping in the vertex shader.
import * as THREE from 'three';
import { Life, Wind, rng, smooth, lerp } from './kit';

export interface BirdsAt {
  /** The ring they fly: its centre, its radii (units) and its height. */
  cx: number; cz: number; rx: number; rz: number; y: number;
  /** Where one may sit (the ridge, the eaves): each taken by one bird at a time. */
  perches: THREE.Vector3[];
}

type State = 'fly' | 'land' | 'sit' | 'takeoff';
interface Bird {
  state: State; th: number; w: number; bob: number; since: number; until: number;
  perch: number; from: THREE.Vector3; ctrl: THREE.Vector3; to: THREE.Vector3;
  pos: THREE.Vector3; prev: THREE.Vector3; yaw: number; pitch: number; roll: number;
  flap: number; fold: number; wait: number;
}

export function birds(scene: THREE.Scene, at: BirdsAt, opts: { n?: number; wind: Wind; seed?: number; color?: number; /** the flock startled (a gust, a heavy blow): the sitters take off — for a sound */ onStartle?: () => void } ): Life {
  const R = rng(opts.seed ?? 31), n = opts.n ?? 9;
  // ---- one bird: a slim body and two wings hinged beside it (local: +x ahead, +y up, +z to its right)
  const pos: number[] = [], wing: number[] = [], idx: number[] = [];
  const quad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], w: number) => {
    const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); wing.push(w, w, w, w); idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  quad([0.085, 0, 0], [0.0, 0, 0.018], [-0.075, 0, 0.0], [0.0, 0, -0.018], 0); // the body (a diamond, head ahead)
  quad([-0.075, 0, 0], [-0.12, 0, 0.022], [-0.125, 0, 0], [-0.12, 0, -0.022], 0); // the tail
  for (const s of [1, -1]) quad([0.045, 0, s * 0.02], [0.02, 0, s * 0.14], [-0.03, 0, s * 0.135], [-0.035, 0, s * 0.02], s); // the wings
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1)); g.setIndex(idx);
  g.computeVertexNormals();
  const anim = new Float32Array(n * 3);
  g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x241a1c, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aWing;\nattribute vec3 aAnim;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n'
      + 'if (abs(aWing) > 0.5) { float a = aAnim.z + aAnim.y * sin(uTime * 16.0 + aAnim.x); float s = sign(transformed.z); float zz = abs(transformed.z) - 0.02;\n'
      + '  transformed.y += zz * sin(a); transformed.z = s * (0.02 + zz * cos(a)); }\n');
  };
  const mesh = new THREE.InstancedMesh(g, mat, n); mesh.frustumCulled = false; mesh.castShadow = false; scene.add(mesh);

  const birds: Bird[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < n; i++) {
    birds.push({ state: 'fly', th: (i / n) * Math.PI * 2 + R() * 0.6, w: 0.22 + R() * 0.06, bob: R() * 10, since: 0, until: 12 + R() * 30, perch: -1,
      from: new THREE.Vector3(), ctrl: new THREE.Vector3(), to: new THREE.Vector3(), pos: new THREE.Vector3(), prev: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, flap: 1, fold: 0, wait: 0 });
    anim[i * 3] = R() * 6.28; anim[i * 3 + 1] = 1; anim[i * 3 + 2] = 0;
  }
  const ring = (b: Bird, t: number, out: THREE.Vector3) => {
    const th = b.th, wob = Math.sin(t * 0.7 + b.bob) * 0.25;
    out.set(at.cx + Math.cos(th) * (at.rx + wob), at.y + Math.sin(2 * th + b.bob) * 0.45 + Math.sin(t * 1.3 + b.bob) * 0.12, at.cz + Math.sin(th) * (at.rz + wob * 0.6));
  };
  const bez = (b: Bird, k: number, out: THREE.Vector3) => {
    const u = 1 - k; out.set(0, 0, 0).addScaledVector(b.from, u * u).addScaledVector(b.ctrl, 2 * u * k).addScaledVector(b.to, k * k);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(1, 1, 1), tmp = new THREE.Vector3();
  let scare = 0, t0 = -1;

  const update = (ms: number, t: number) => {
    if (t0 < 0) { t0 = t; for (const b of birds) { ring(b, t, b.pos); b.prev.copy(b.pos); } }
    const dt = Math.min(0.05, ms / 1000); uTime.value = t;
    if (opts.wind.gust > 0.75 && scare <= 0) { scare = 3; opts.onStartle?.(); } // startled: the sitters fly, the flock hurries
    scare = Math.max(0, scare - dt);
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i]; b.since += dt;
      b.prev.copy(b.pos);
      const hurry = 1 + (scare > 0 ? 1.4 : 0);
      if (b.state === 'fly') {
        b.th += b.w * hurry * dt; ring(b, t, b.pos); b.flap = lerp(b.flap, 0.75 + 0.25 * Math.sin(t * 0.9 + b.bob) + (scare > 0 ? 0.3 : 0), 0.1); b.fold = lerp(b.fold, 0, 0.1);
        if (b.since > b.until && scare <= 0 && at.perches.length) { // down to a free perch
          const free = at.perches.map((_, k) => k).filter((k) => !taken.has(k));
          if (free.length) {
            b.perch = free[(R() * free.length) | 0]; taken.add(b.perch);
            b.from.copy(b.pos); b.to.copy(at.perches[b.perch]); b.ctrl.copy(b.from).lerp(b.to, 0.5).add(new THREE.Vector3(0, 1.4, 0));
            b.state = 'land'; b.since = 0; b.until = 3.2 + R() * 0.8;
          } else b.until += 8;
        }
      } else if (b.state === 'land') {
        const k = smooth(Math.min(1, b.since / b.until)); bez(b, k, b.pos);
        b.flap = k < 0.75 ? 0.35 : 1.0; // a glide, then braking beats
        if (k >= 1) { b.state = 'sit'; b.since = 0; b.until = 7 + R() * 18; b.yaw = Math.PI / 2 + (R() - 0.5) * 1.2; b.pitch = 0; b.roll = 0; }
      } else if (b.state === 'sit') {
        b.pos.copy(at.perches[b.perch]); b.flap = lerp(b.flap, 0, 0.15); b.fold = lerp(b.fold, -1.15, 0.12);
        b.wait -= dt; if (b.wait <= 0) { b.wait = 0.6 + R() * 2.5; b.yaw += (R() - 0.5) * 0.8; } // looks about
        b.pos.y += Math.max(0, Math.sin(t * 9 + b.bob)) * 0.004 * (b.wait < 0.15 ? 1 : 0); // a hop as it turns
        if (b.since > b.until || scare > 0) {
          b.state = 'takeoff'; b.since = 0; b.until = 1.5 + R() * 0.5; b.from.copy(b.pos); b.th += 0.6; ring(b, t + b.until, b.to); b.ctrl.copy(b.from).lerp(b.to, 0.4).add(new THREE.Vector3(0, 0.9, 0));
          taken.delete(b.perch); b.perch = -1;
        }
      } else { // takeoff
        const k = smooth(Math.min(1, b.since / b.until)); bez(b, k, b.pos); b.flap = 1.1; b.fold = lerp(b.fold, 0, 0.2);
        if (k >= 1) { b.state = 'fly'; b.since = 0; b.until = 10 + R() * 30; b.th += b.w * b.until * 0; }
      }
      // the heading from the way it moved (sitting: where it looks), a bank into the turn
      if (b.state !== 'sit') {
        tmp.copy(b.pos).sub(b.prev);
        if (tmp.lengthSq() > 1e-8) {
          const yaw = Math.atan2(-tmp.z, tmp.x), pitch = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
          let dy = yaw - b.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
          b.yaw += dy * Math.min(1, dt * 6); b.pitch = lerp(b.pitch, pitch, Math.min(1, dt * 6)); b.roll = lerp(b.roll, -dy / Math.max(dt, 1e-3) * 0.35, Math.min(1, dt * 4));
        }
      } else b.roll = lerp(b.roll, 0, 0.2);
      e.set(THREE.MathUtils.clamp(b.roll, -0.8, 0.8), b.yaw, b.pitch, 'YZX'); q.setFromEuler(e);
      m4.compose(b.pos, q, s3); mesh.setMatrixAt(i, m4);
      anim[i * 3 + 1] = b.flap; anim[i * 3 + 2] = b.fold;
    }
    mesh.instanceMatrix.needsUpdate = true; (g.attributes.aAnim as THREE.InstancedBufferAttribute).needsUpdate = true;
  };
  return { update, dispose: () => { scene.remove(mesh); g.dispose(); mat.dispose(); } };
}
