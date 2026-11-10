// Legacy of Spirits (GPT's P2, 10 Nov — behind ?spirits&idle=up only): out of combat the Samurai stands upright — "an
// elegant, upright, relaxed supernatural swordsman"; in the fight the low sword stance stays. No new animation: the
// library's own idle (Idle_Loop, its breathing and arms) with its legs and hips eased part of the way toward his rest
// pose, faded in and out as the idle comes and goes, so walking, running, jumping and every skill are untouched.
import * as THREE from 'three';
import type { Hero3D } from '../arena3d/Hero3D';

const LEG = /^(thigh|calf|foot|ball)_/;

/** `k`: how far toward standing straight (0 the library's idle, 1 his rest legs); 0.6 by default (the bench: the hips
 *  ~4 % higher, the feet a quarter closer). */
export function uprightIdle(hero: Hero3D, k = 0.6): void {
  const H = hero as unknown as { body?: THREE.SkinnedMesh; clipNow: string; drive: Hero3D['drive'] };
  const skel = H.body?.skeleton; if (!skel) return;
  // each leg bone's and the hips' rest, in its parent's frame: from the skeleton's own binds (parent bind⁻¹ · own bind)
  const rest: { b: THREE.Bone; p: THREE.Vector3; q: THREE.Quaternion; hips: boolean }[] = [];
  skel.bones.forEach((b, i) => {
    if (!(LEG.test(b.name) || b.name === 'pelvis')) return;
    const pi = skel.bones.indexOf(b.parent as THREE.Bone); if (pi < 0) return;
    const m = skel.boneInverses[pi].clone().multiply(skel.boneInverses[i].clone().invert());
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    rest.push({ b, p, q, hips: b.name === 'pelvis' });
  });
  // his soles kept where the idle has them: the lowest of his feet' bones measured before and after, the hips moved by it
  const feet = ['foot_l', 'foot_r', 'ball_l', 'ball_r'].map((n) => skel.bones.find((b) => b.name === n)).filter((b): b is THREE.Bone => !!b);
  const hips = rest.find((r) => r.hips)?.b, top = (hero as unknown as { root: THREE.Object3D }).root;
  const v = new THREE.Vector3(), low = (): number => { let y = Infinity; for (const b of feet) y = Math.min(y, b.getWorldPosition(v).y); return y; };
  const m3 = new THREE.Matrix3();
  let w = 0;
  const drive = H.drive.bind(hero);
  H.drive = (d, ms) => {
    drive(d, ms);
    const want = H.clipNow === 'Idle_Loop' ? 1 : 0; // (the idle only: the guard after a blow, the walk, the casts keep their own legs)
    w += (want - w) * Math.min(1, ms / 180);
    if (w < 0.002 || !hips) return;
    top.updateMatrixWorld(true); const y0 = low();
    for (const r of rest) { if (r.hips) r.b.position.lerp(r.p, k * w); else r.b.quaternion.slerp(r.q, k * w); }
    top.updateMatrixWorld(true); const dy = y0 - low();
    if (Math.abs(dy) > 1e-5 && hips.parent) { // (a world-up shift in the hips' parent's own frame)
      m3.setFromMatrix4(hips.parent.matrixWorld).invert(); hips.position.add(v.set(0, dy, 0).applyMatrix3(m3));
    }
  };
}
