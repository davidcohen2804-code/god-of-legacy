// BASE-01's regression pass (the art director's P3/P4): every mix of its items through every animation. R1: every
// worn piece resolves to an atlas frame and the wardrobe refuses nothing; R2: every bone stays finite and the body
// stays in one piece (each joint where its parent puts it) in every sampled frame of every animation; R3: a held
// weapon never leaves the fist (the grip socket rides the hand at its fixed offset); R4: the cross-fade between any two
// animations stays finite.
import type { AnimDef } from '../rig/types';
import { RigPose } from '../rig/pose';
import type { WardrobeSlot } from '../wardrobe/types';
import type { LabScene } from './LabScene';
import { yieldFrame, type TestResult } from './tests';

const CHOICES: [WardrobeSlot, (string | null)[]][] = [
  ['top', [null, 'top01_tunic', 'top02_armor']], ['bottom', [null, 'bottom01_pants']], ['shoes', [null, 'shoes01_boots']], ['weapon', [null, 'weapon01_sword']],
];
type Mix = Partial<Record<WardrobeSlot, string | null>>;
const MIXES: Mix[] = (() => {
  const out: Mix[] = [];
  const total = CHOICES.reduce((n, [, o]) => n * o.length, 1);
  for (let m = 0; m < total; m++) { let r = m; out.push(Object.fromEntries(CHOICES.map(([slot, opts]) => { const v = opts[r % opts.length]; r = Math.floor(r / opts.length); return [slot, v]; }))); }
  return out;
})();
const name = (x: Mix) => CHOICES.map(([s]) => `${s}:${x[s] ?? 'none'}`).join(' ');

export async function runTestsB01(scene: LabScene, progress: (msg: string) => void = () => {}): Promise<TestResult[]> {
  const A = scene.assets;
  if (A.art !== 'base01') throw new Error('runTestsB01 needs the lab on BASE-01');
  const out: TestResult[] = [];
  const anims = Object.values(A.anims) as AnimDef[];
  const pose = new RigPose(A.pose.rig);
  const tex = scene.textures.get(A.atlas512.key);
  // R1
  progress('R1 wardrobe');
  const bad: string[] = [];
  for (const m of MIXES) {
    const equipped = Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Partial<Record<WardrobeSlot, string>>;
    const av = A.wardrobe.resolve({ body: 'male_std', look: { ...A.baseLook }, gearLooks: {}, cosmetics: { equipped, hidden: [] }, family: 'sword' });
    if (av.notes.length) bad.push(`${name(m)}: ${av.notes.join('; ')}`);
    for (const p of av.parts) {
      if (!p) continue;
      for (const f of [p.frame, ...Object.values(p.variants ?? {})]) if (f && !tex.has(f)) bad.push(`${name(m)}: no frame ${f}`);
    }
  }
  out.push({ id: 'R1', name: 'Every mix resolves: no refusals, every piece has its frame', pass: bad.length === 0, detail: bad.length ? bad.slice(0, 4).join(' | ') : `${MIXES.length} mixes` });
  await yieldFrame();
  // R2 + R3: sample every animation at 60 Hz
  progress('R2 R3 motion');
  const st = pose.newState();
  const hand = pose.index.get('hand_B')!, sock = pose.index.get('weapon')!;
  const sockBone = pose.rig.bones[sock];
  let worst = 0, worstGrip = 0, nan = 0, frames = 0;
  for (const a of anims) {
    for (let t = 0; t <= a.dur + 1e-9; t += 1 / 60) {
      pose.evaluate(a, t, st);
      frames++;
      for (let i = 0; i < pose.n; i++) for (let j = 0; j < 6; j++) if (!Number.isFinite(st.world[i * 6 + j])) nan++;
      // each child bone starts where its parent's frame puts its offset (the body stays in one piece)
      for (let i = 0; i < pose.n; i++) {
        const p = pose.parent[i]; if (p < 0) continue;
        const b = pose.rig.bones[i], q = p * 6, B = pose.rig.B;
        const tl = a.bones[b.name];
        if (tl && (tl.x || tl.y)) continue;
        const ex = st.world[q] * b.x * B + st.world[q + 2] * b.y * B + st.world[q + 4], ey = st.world[q + 1] * b.x * B + st.world[q + 3] * b.y * B + st.world[q + 5];
        worst = Math.max(worst, Math.hypot(ex - st.world[i * 6 + 4], ey - st.world[i * 6 + 5]));
      }
      // the grip socket at its fixed place in the fist
      const q = hand * 6, B = pose.rig.B;
      const gx = st.world[q] * sockBone.x * B + st.world[q + 4], gy = st.world[q + 1] * sockBone.x * B + st.world[q + 5];
      worstGrip = Math.max(worstGrip, Math.hypot(gx - st.world[sock * 6 + 4], gy - st.world[sock * 6 + 5]));
    }
    await yieldFrame();
  }
  out.push({ id: 'R2', name: 'Every animation: finite bones, every joint where its parent puts it', pass: nan === 0 && worst < 1e-6, detail: `${frames} frames, ${nan} non-finite values, worst joint offset ${worst.toExponential(1)} units` });
  out.push({ id: 'R3', name: 'The held weapon never leaves the fist', pass: worstGrip < 1e-6, detail: `worst grip drift ${worstGrip.toExponential(1)} units over ${frames} frames` });
  // R4: the cross-fade between any two animations
  progress('R4 cross-fades');
  let fadeBad = 0, fades = 0;
  for (const a of anims) for (const b of anims) {
    if (a === b) continue;
    const snap = pose.localValues(a, a.dur * 0.5);
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      pose.evaluate(b, 0, st, undefined, { v: snap, w });
      fades++;
      for (let i = 0; i < pose.n * 6; i++) if (!Number.isFinite(st.world[i])) { fadeBad++; break; }
    }
  }
  out.push({ id: 'R4', name: 'Cross-fades between every pair of animations stay finite', pass: fadeBad === 0, detail: `${fades} blends, ${fadeBad} bad` });
  return out;
}
