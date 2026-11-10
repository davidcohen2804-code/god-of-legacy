// The new Spectral Samurai's secondary motion (GPT, 10 Nov, the rig: "ponytail chain: restrained motion, not whippy;
// sash tails: secondary motion, but controlled; the costume shell split into left / rear / right panels, each with its
// own control bones"). The body file carries the extra bones (tools/hero3d/ai/addbones.mjs): hair_01…hair_05 on the
// head, and two-bone chains on the pelvis for the side panels (skirt_l / skirt_r), the rear panel (skirt_b), the front
// panels (skirt_fl / skirt_fr) and the sash's tails (sash_l / sash_r). The moves never turn them; here, each frame after
// the move:
//  - the ponytail is a short chain of points that follows the head with a lag, under gravity, pulled back toward where
//    it would rest on the head (stiff: restrained), kept off the back, the shoulders and the scarf;
//  - each panel turns with its leg (the side and front panels with their own thigh, the rear one away from whichever
//    thigh swings back, and back when he crouches), eased like cloth with weight;
//  - the sash's tails follow their thigh a little and swing after it.
import * as THREE from 'three';

type Bones = Map<string, THREE.Bone>;
const V = () => new THREE.Vector3(), Qn = () => new THREE.Quaternion();

/** A bone's world rotation. */
function wq(b: THREE.Object3D, out = Qn()): THREE.Quaternion { b.getWorldQuaternion(out); return out; }
/** Turns a bone so that its world rotation becomes `q` (its parent's left as it is). */
function setWorld(b: THREE.Bone, q: THREE.Quaternion): void {
  const pq = wq(b.parent!); b.quaternion.copy(pq.invert().multiply(q)); b.updateMatrixWorld(true);
}

interface Chain { bones: THREE.Bone[]; rest: THREE.Quaternion[]; len: number[]; tipLen: number; p: THREE.Vector3[]; pp: THREE.Vector3[] }
interface Panel { a: THREE.Bone; b: THREE.Bone; rest: [THREE.Quaternion, THREE.Quaternion]; thigh: 'l' | 'r' | 'both'; kind: 'side' | 'rear' | 'front' | 'sash'; ang: THREE.Vector2; vel: THREE.Vector2; bend: number; bendV: number }

export class Secondary {
  private hair: Chain | null = null;
  private panels: Panel[] = [];
  private last = performance.now();
  private thighRest = new Map<string, THREE.Vector3>();   // each thigh's direction in the pelvis' frame, at rest
  private ok = false;

  constructor(private bones: Bones, private scale = () => 1, skeleton?: THREE.Skeleton) {
    const B = (n: string) => bones.get(n);
    const hair = [1, 2, 3, 4, 5].map((k) => B(`hair_0${k}`)).filter(Boolean) as THREE.Bone[];
    if (skeleton && hair.length === 5) this.bindHair(skeleton);
    if (hair.length === 5) {
      const len: number[] = []; for (let k = 0; k < 4; k++) len.push(hair[k + 1].position.length());
      this.hair = { bones: hair, rest: hair.map((b) => b.quaternion.clone()), len, tipLen: len[3] * 1.0, p: [], pp: [] };
    }
    const mk = (nm: string, thigh: Panel['thigh'], kind: Panel['kind']) => {
      const a = B(`${nm}_01`), b = B(`${nm}_02`); if (!a || !b) return;
      this.panels.push({ a, b, rest: [a.quaternion.clone(), b.quaternion.clone()], thigh, kind, ang: new THREE.Vector2(), vel: new THREE.Vector2(), bend: 0, bendV: 0 });
    };
    mk('skirt_l', 'l', 'side'); mk('skirt_r', 'r', 'side'); mk('skirt_b', 'both', 'rear'); mk('skirt_fl', 'l', 'front'); mk('skirt_fr', 'r', 'front'); mk('sash_l', 'l', 'sash'); mk('sash_r', 'r', 'sash');
    this.ok = !!this.hair || this.panels.length > 0;
    // the thighs at rest: the bind pose (the skeleton's own inverse binds — the body may already stand in a move)
    if (skeleton) {
      const bind = (n: string) => { const i = skeleton.bones.findIndex((b) => b.name === n); return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert()); };
      const tl = bind('thigh_l'), tr = bind('thigh_r'), pe = bind('pelvis'), s2 = bind('spine_02');
      if (tl && tr && pe && s2) {
        const side = tl.clone().sub(tr).normalize(), up = s2.clone().sub(pe); up.addScaledVector(side, -up.dot(side)).normalize(); const fwd = V().crossVectors(side, up).normalize();
        for (const s of ['l', 'r'] as const) { const a = bind(`thigh_${s}`), b = bind(`calf_${s}`); if (a && b) { const d = b.sub(a).normalize(); this.thighRest.set(s, new THREE.Vector3(d.dot(side), d.dot(up), d.dot(fwd))); } }
      }
    } else { const F = this.frame(); if (F) for (const s of ['l', 'r'] as const) { const d = this.thighDir(s, F); if (d) this.thighRest.set(s, d); } }
  }
  get active(): boolean { return this.ok; }

  // the ponytail's hanging shape, from the bind pose: the head's rotation then, and the chain's joints (and its tip)
  // as offsets from the tie, in the model's own frame
  private headBind: THREE.Quaternion | null = null;
  private hairOff: THREE.Vector3[] = [];
  private bindHair(sk: THREE.Skeleton): void {
    // (the head's rotation from its inverse bind — a packed body's quantised positions leave its rotation alone; the
    // chain's shape from its own rest offsets, each bone resting turned as its parent: their sum, in the head's frame)
    const i = sk.bones.findIndex((b) => b.name === 'Head'); if (i < 0) return;
    const q = Qn(); sk.boneInverses[i].clone().invert().decompose(V(), q, V()); this.headBind = q;
    const H = [1, 2, 3, 4, 5].map((k) => this.bones.get(`hair_0${k}`)!);
    const o: THREE.Vector3[] = []; let acc = V();
    for (const b of H) { acc = acc.clone().add(b.position); o.push(acc.clone()); }
    o.push(o[4].clone().add(o[4].clone().sub(o[3])));
    this.hairOff = o.map((v) => v.sub(o[0]).applyQuaternion(q));
  }

  /** The body's own frame at the hips (from its joints, whatever the bones' own axes): side (to his left), up, forward. */
  private frame(): [THREE.Vector3, THREE.Vector3, THREE.Vector3] | null {
    const g = (n: string) => this.bones.get(n)?.getWorldPosition(V());
    const tl = g('thigh_l'), tr = g('thigh_r'), pe = g('pelvis'), s1 = g('spine_02');
    if (!tl || !tr || !pe || !s1) return null;
    const side = tl.sub(tr).normalize(), up = s1.sub(pe); up.addScaledVector(side, -up.dot(side)).normalize();
    return [side, up, V().crossVectors(side, up).normalize()];
  }
  /** A thigh's direction (hip → knee) in the body's frame: [side, up, forward] components. */
  private thighDir(s: 'l' | 'r', F: [THREE.Vector3, THREE.Vector3, THREE.Vector3]): THREE.Vector3 | null {
    const t = this.bones.get(`thigh_${s}`), c = this.bones.get(`calf_${s}`); if (!t || !c) return null;
    const d = c.getWorldPosition(V()).sub(t.getWorldPosition(V())).normalize();
    return new THREE.Vector3(d.dot(F[0]), d.dot(F[1]), d.dot(F[2]));
  }
  /** How far a thigh swings forward (+) / back (−) and out (+) from its rest, radians. */
  private swing(s: 'l' | 'r', F: [THREE.Vector3, THREE.Vector3, THREE.Vector3]): THREE.Vector2 {
    const d = this.thighDir(s, F), r = this.thighRest.get(s); if (!d || !r) return new THREE.Vector2();
    const side = s === 'l' ? 1 : -1;
    return new THREE.Vector2(Math.atan2(d.z, -d.y) - Math.atan2(r.z, -r.y), (Math.atan2(d.x, -d.y) - Math.atan2(r.x, -r.y)) * side);
  }

  /** After the move, before the picture. */
  update(step?: number): void {
    if (!this.ok) return;
    const now = performance.now(), dt = step ?? Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)); this.last = now;
    // (several small steps: steady at any frame rate)
    const n = Math.ceil(dt / (1 / 60)), h = dt / n;
    this.updatePanels(dt);
    if (this.hair) for (let i = 0; i < n; i++) this.stepHair(h, i === n - 1);
  }

  private updatePanels(dt: number): void {
    const F = this.frame(); if (!F) return;
    const sl = this.swing('l', F), sr = this.swing('r', F);
    const [side, up, fwd] = F;
    // how far the hips lean forward (+) from upright: cloth hangs toward the floor, so each panel takes back part of it
    const lean = Math.atan2(-fwd.y, up.y);
    for (const P of this.panels) {
      // the target turn: forward (+) / back (−) about the body's side axis, outward about its forward axis
      let tp = 0, tr = 0;
      // (cloth with weight: a leg pushes its panel only part of the way; a panel never stands out like a board)
      if (P.kind === 'side') { const s = P.thigh === 'l' ? sl : sr; tp = s.x * (s.x > 0 ? 0.38 : 0.32); tr = Math.max(0, s.y) * 0.5 + 0.05 * Math.abs(s.x); }
      else if (P.kind === 'front') { const s = P.thigh === 'l' ? sl : sr; tp = s.x > 0 ? s.x * 0.52 : s.x * 0.18; tr = Math.max(0, s.y) * 0.25; }
      else if (P.kind === 'rear') { const back = Math.min(sl.x, sr.x), fwdAvg = Math.max(0, (sl.x + sr.x) / 2); tp = Math.min(0, back) * 0.55 - fwdAvg * 0.28; }
      else { const s = P.thigh === 'l' ? sl : sr; tp = s.x > 0 ? s.x * 0.45 : s.x * 0.15; }
      tp += lean * (P.kind === 'sash' ? 0.7 : 0.55);
      tp = THREE.MathUtils.clamp(tp, -0.65, 0.95); tr = THREE.MathUtils.clamp(tr, 0, 0.45);
      // eased like cloth with weight (a spring, nearly critical); the lower bone bends after the upper one
      const k = P.kind === 'sash' ? 60 : 110, c = P.kind === 'sash' ? 9 : 18;
      const ax = (tp - P.ang.x) * k - P.vel.x * c, ay = (tr - P.ang.y) * k - P.vel.y * c;
      P.vel.x += ax * dt; P.vel.y += ay * dt; P.ang.x += P.vel.x * dt; P.ang.y += P.vel.y * dt;
      const bendT = -P.vel.x * (P.kind === 'sash' ? 0.10 : 0.05);
      P.bendV += ((bendT - P.bend) * 80 - P.bendV * 14) * dt; P.bend += P.bendV * dt;
      const sgn = P.thigh === 'r' ? -1 : 1;
      const qa = new THREE.Quaternion().setFromAxisAngle(side, -P.ang.x).multiply(new THREE.Quaternion().setFromAxisAngle(fwd, P.ang.y * sgn));
      P.a.quaternion.copy(P.rest[0]); P.a.updateMatrixWorld(true);
      setWorld(P.a, qa.multiply(wq(P.a)));
      // (the lower half drapes back toward hanging: the leg pushes the panel's top, its hem falls)
      const drape = P.kind === 'sash' ? 0.35 : 0.6;
      P.b.quaternion.copy(P.rest[1]); P.b.updateMatrixWorld(true);
      setWorld(P.b, new THREE.Quaternion().setFromAxisAngle(side, -P.bend + P.ang.x * drape).multiply(wq(P.b)));
    }
  }

  /** The ponytail: points at the chain's joints and its tip, verlet, under gravity, stiffly pulled to their place on
   *  the head; then each bone turned to point at the next point. */
  private stepHair(h: number, last: boolean): void {
    const C = this.hair!, B = C.bones;
    // where the chain would be, all its bones at rest (its place on the head as the head is now)
    B.forEach((b, i) => b.quaternion.copy(C.rest[i])); B[0].updateMatrixWorld(true);
    const rigid = B.map((b) => b.getWorldPosition(V()));
    const tipDir = rigid[4].clone().sub(rigid[3]).normalize();
    rigid.push(rigid[4].clone().addScaledVector(tipDir, C.tipLen * this.scale()));
    let target = rigid;
    if (this.headBind) {
      // its hanging shape: the shape it rests in on the head, untipped by two thirds of the head's tilt (turned with
      // his facing, all of it) — so it hangs behind a bowed or tipped head instead of standing out from it
      const rel = wq(B[0].parent!).multiply(this.headBind.clone().invert());
      const r = new THREE.Vector3(rel.x, rel.y, rel.z);
      const twist = new THREE.Quaternion(0, r.y, 0, rel.w).normalize(), swing = rel.clone().multiply(twist.clone().invert());
      const fix = new THREE.Quaternion().slerp(swing, 0.35).multiply(swing.clone().invert());
      target = rigid.map((v) => rigid[0].clone().add(v.clone().sub(rigid[0]).applyQuaternion(fix)));
    }
    if (!C.p.length) { C.p = target.map((v) => v.clone()); C.pp = target.map((v) => v.clone()); }
    const g = -9.8 * 0.6 * this.scale();
    const stiff = [1, 0.55, 0.22, 0.075, 0.05, 0.04];   // (the rise out of the tie held as it is set; lower down it hangs and lags: restrained)
    C.p[0].copy(target[0]); C.pp[0].copy(target[0]);
    for (let i = 1; i < C.p.length; i++) {
      const p = C.p[i], v = p.clone().sub(C.pp[i]).multiplyScalar(0.90);  // (damped)
      C.pp[i].copy(p);
      p.add(v); p.y += g * h * h;
      p.lerp(target[i], stiff[i]);
    }
    // keep the joint lengths, and keep it off the body (the back, the shoulders, the scarf)
    const lens = [...C.len.map((l) => l * this.scale()), C.tipLen * this.scale()];
    const colliders = this.colliders();
    for (let it = 0; it < 2; it++) for (let i = 1; i < C.p.length; i++) {
      const a = C.p[i - 1], p = C.p[i], d = p.clone().sub(a), l = d.length() || 1e-6;
      p.copy(a).addScaledVector(d, lens[i - 1] / l);
      for (const [c, r] of colliders) { const e = p.clone().sub(c), el = e.length(); if (el < r) p.copy(c).addScaledVector(e, r / Math.max(el, 1e-6)); }
    }
    if (!last) return;
    // the bones turned to the points
    for (let i = 0; i < 5; i++) {
      const b = B[i]; b.updateMatrixWorld(true);
      const from = rigid[i + 1].clone().sub(rigid[i]);  // (its rest direction: computed with every bone at rest, as the head is now)
      const a = b.getWorldPosition(V()), to = C.p[i + 1].clone().sub(a);
      if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) continue;
      // the rest direction as the bone is turned now (its parent may have moved along the chain)
      const nowQ = wq(b), restQ = this.restWorld(i);
      const fromNow = from.normalize().applyQuaternion(restQ.clone().invert()).applyQuaternion(nowQ);
      const turn = new THREE.Quaternion().setFromUnitVectors(fromNow.normalize(), to.normalize());
      setWorld(b, turn.multiply(nowQ));
    }
  }
  /** A hair bone's world rotation with every chain bone at rest (cached per frame by the caller's order). */
  private restWorld(i: number): THREE.Quaternion {
    const C = this.hair!; const q = wq(C.bones[0].parent!);
    for (let k = 0; k <= i; k++) q.multiply(C.rest[k]);
    return q;
  }
  /** Spheres the hair stays out of: along the upper back and the neck, and the shoulders (the body's size). */
  private colliders(): [THREE.Vector3, number][] {
    const s = this.scale(), out: [THREE.Vector3, number][] = [];
    const at = (n: string) => this.bones.get(n)?.getWorldPosition(V());
    const sp2 = at('spine_02'), sp3 = at('spine_03'), nk = at('neck_01'), hd = at('Head'), cl = at('clavicle_l'), cr = at('clavicle_r'), ul = at('upperarm_l'), ur = at('upperarm_r');
    if (sp2 && sp3) { out.push([sp2, 0.15 * s]); out.push([sp3.clone().lerp(sp2, 0.5), 0.155 * s]); out.push([sp3, 0.16 * s]); }
    if (nk) out.push([nk, 0.13 * s]);
    if (hd) out.push([hd.clone().add(new THREE.Vector3(0, 0.07 * s, 0)), 0.115 * s]);
    for (const [c, u] of [[cl, ul], [cr, ur]] as const) if (c && u) { out.push([c.clone().lerp(u, 0.6), 0.11 * s]); out.push([u, 0.1 * s]); }
    return out;
  }
}

/** The secondary motion on a body that has its extra bones (none on the others: nothing happens). */
export function makeSecondary(bones: Bones, skeleton?: THREE.Skeleton): Secondary | null {
  const pel = bones.get('pelvis'), w = V();
  const s = new Secondary(bones, () => (pel ? pel.getWorldScale(w).x : 1), skeleton); return s.active ? s : null;
}
