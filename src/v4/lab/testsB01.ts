// BASE-01's regression pass (the art director's P3/P4): every mix of its items through every animation. R1: every
// worn piece resolves to an atlas frame and the wardrobe refuses nothing; R2: every bone stays finite and the body
// stays in one piece (each joint where its parent puts it) in every sampled frame of every animation; R3: a held
// weapon never leaves the fist (the grip socket rides the hand at its fixed offset); R4: the cross-fade between any two
// animations stays finite; R5: rapid, interrupted changes of state never pop; R6: with no weapon in hand every state
// plays its unarmed animation; R7: the far fist never shows between the legs; R8: a planted foot stays planted
// through a cross-fade.
import type { AnimDef } from '../rig/types';
import { RigPose } from '../rig/pose';
import type { WardrobeSlot } from '../wardrobe/types';
import type { LabScene } from './LabScene';
import { B01_WEAR } from '../base01/catalog';
import { yieldFrame, type TestResult } from './tests';

// every item in the catalog, and nothing, in every slot (the mixes grow with the catalog)
const CHOICES: [WardrobeSlot, (string | null)[]][] = B01_WEAR.map((w) => [w.slot, [null, ...w.items.map((i) => i.id)]]);
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
  // R5: rapid state changes, some in the middle of an unfinished cross-fade (run → slash → jump → slash → idle at 60 Hz),
  // with the lab's fade (from the blend on screen): no bone turns more than 30° from one frame to the next
  progress('R5 interrupted fades');
  const planFor = (A2: Record<string, AnimDef>) => {
    const plan: [AnimDef, number][] = [];
    const seg = (a: AnimDef, n: number) => { for (let i = 0; i < n; i++) plan.push([a, i / 60]); };
    seg(A2.run, 20); seg(A2.attack, 3); seg(A2.jump, 2); seg(A2.attack, 12); seg(A2.run, 4); seg(A2.attack, 8); seg(A2.idle, 30);
    return plan;
  };
  const FADE = 0.09;
  const runPlan = (fade: boolean, plan = planFor(A.anims as Record<string, AnimDef>)) => {
    let from: Float64Array | null = null, fadeT = 1, prev: [AnimDef, number] | null = null, last: Float64Array | null = null;
    let atSwitch = 0, inside = 0, sinceSwitch = 99;
    for (const [a, t] of plan) {
      if (prev && prev[0] !== a) sinceSwitch = 0; else sinceSwitch++;
      if (fade && prev && prev[0] !== a) {
        const shown = pose.localValues(prev[0], prev[1]);
        const kp = Math.min(1, fadeT / FADE), wp = 1 - (1 - kp) * (1 - kp);
        if (from && wp < 1) for (let i = 0; i < shown.length; i += 3) { let d = shown[i] - from[i]; d -= 360 * Math.round(d / 360); shown[i] = from[i] + d * wp; shown[i + 1] = from[i + 1] + (shown[i + 1] - from[i + 1]) * wp; shown[i + 2] = from[i + 2] + (shown[i + 2] - from[i + 2]) * wp; }
        from = shown; fadeT = 0;
      }
      fadeT += 1 / 60;
      const k = Math.min(1, fadeT / FADE);
      pose.evaluate(a, t, st, undefined, fade && from && k < 1 ? { v: from, w: 1 - (1 - k) * (1 - k) } : undefined);
      const ang = new Float64Array(pose.n);
      for (let i = 0; i < pose.n; i++) ang[i] = Math.atan2(st.world[i * 6 + 1], st.world[i * 6]) * 180 / Math.PI;
      if (last) {
        let step = 0;
        for (let i = 0; i < pose.n; i++) { let d = Math.abs(ang[i] - last[i]); d = Math.min(d, 360 - d); if (!pose.rig.bones[i].name.startsWith('hair') && !pose.rig.bones[i].name.startsWith('cape')) step = Math.max(step, d); }
        if (sinceSwitch === 0) atSwitch = Math.max(atSwitch, step); else inside = Math.max(inside, step);
      }
      last = ang; prev = [a, t];
    }
    return { atSwitch, inside };
  };
  // a pop is a frame-to-frame jump at a change of state bigger than what the animations themselves do in one frame (a
  // light slash sweeps fast by design)
  const f = runPlan(true), n = runPlan(false);
  out.push({ id: 'R5', name: 'Rapid and interrupted state changes: no pop at any change', pass: f.atSwitch <= f.inside + 2, detail: `largest one-frame turn at a change ${f.atSwitch.toFixed(1)}° (without the cross-fade ${n.atSwitch.toFixed(1)}°); the animations' own fastest ${f.inside.toFixed(1)}°` });
  // R6: no weapon in hand, every state plays its unarmed animation (and only then), and the same rapid changes stay
  // free of pops on that set
  progress('R6 unarmed');
  const bare = A.animsBare, wrong: string[] = [];
  if (!bare) wrong.push('no unarmed set');
  for (const m of MIXES) {
    const equipped = Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Partial<Record<WardrobeSlot, string>>;
    const av = A.wardrobe.resolve({ body: 'male_std', look: { ...A.baseLook }, gearLooks: {}, cosmetics: { equipped, hidden: [] }, family: 'sword' });
    if (av.unarmed !== !m.weapon) wrong.push(`${name(m)}: unarmed=${av.unarmed}`);
  }
  if (bare) for (const st2 of ['idle', 'run', 'jump', 'attack']) {
    if (bare[st2] === A.anims[st2]) wrong.push(`${st2}: same animation armed and unarmed`);
    if (bare[st2]?.name !== `${st2}_bare`) wrong.push(`${st2}: plays ${bare[st2]?.name}`);
    if (st2 === 'jump' || st2 === 'attack') { const a1 = A.anims[st2].marks!, b1 = bare[st2].marks!; for (const k2 of Object.keys(a1)) if (a1[k2] !== b1[k2]) wrong.push(`${st2}: mark ${k2} differs`); }
  }
  const fb = bare ? runPlan(true, planFor(bare)) : { atSwitch: 0, inside: 0 };
  out.push({ id: 'R6', name: 'No weapon in hand: every state plays its unarmed animation, on the same marks, no pop at changes', pass: wrong.length === 0 && fb.atSwitch <= fb.inside + 2, detail: wrong.length ? wrong.slice(0, 4).join(' | ') : `${MIXES.length} mixes pick the right set; unarmed changes: largest turn ${fb.atSwitch.toFixed(1)}°, its own fastest ${fb.inside.toFixed(1)}°` });
  // R7: the far fist (drawn behind the body) never shows in the gap between the legs: below the crotch and between
  // the two legs' edges, in any frame of any animation, armed or not
  progress('R7 far fist');
  const U = pose.rig.B, px150 = 150 / U;
  const ix = (n: string) => pose.index.get(n)!;
  const org = (i: number): [number, number] => [st.world[i * 6 + 4], st.world[i * 6 + 5]];
  const all = [...new Set([...Object.values(A.anims), ...Object.values(bare ?? {})])] as AnimDef[];
  let gapFrames = 0, gapWorst = '', sampled = 0;
  const legX = (s: 'B' | 'F', y: number): number | null => {
    const P = [org(ix(`thigh_${s}`)), org(ix(`shin_${s}`)), org(ix(`foot_${s}`))];
    for (let k = 0; k < 2; k++) {
      const [x0, y0] = P[k], [x1, y1] = P[k + 1];
      if ((y - y0) * (y - y1) <= 0 && y1 !== y0) return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
    }
    return null;
  };
  const LEG_HALF = 0.06 * U, FIST = 0.035 * U;
  for (const a of all) {
    for (let t = 0; t <= a.dur + 1e-9; t += 1 / 60) {
      pose.evaluate(a, t, st); sampled++;
      const h = ix('hand_F'), hl = pose.length(st, h) * U * 0.5;
      const fx = st.world[h * 6 + 4] + st.world[h * 6] * hl, fy = st.world[h * 6 + 5] + st.world[h * 6 + 1] * hl;
      const hip = ix('hip'), crotchY = st.world[hip * 6 + 5] + 0.045 * U;
      if (fy - FIST < crotchY) continue;
      const xb = legX('B', fy), xf = legX('F', fy);
      if (xb === null || xf === null) continue;
      const lo = Math.min(xb, xf) + LEG_HALF, hi = Math.max(xb, xf) - LEG_HALF;
      if (hi - lo > 2 * FIST && fx > lo + FIST && fx < hi - FIST) { gapFrames++; if (!gapWorst) gapWorst = `${a.name} ${t.toFixed(2)} s`; }
    }
    await yieldFrame();
  }
  out.push({ id: 'R7', name: 'The far fist never shows between the legs', pass: gapFrames === 0, detail: gapFrames ? `${gapFrames} frames, first: ${gapWorst}` : `${sampled} frames of ${all.length} animations` });
  // R8: a foot planted in both poses of a change stays planted through the cross-fade (no slide, no sinking): the
  // game's changes between grounded states, armed and unarmed
  progress('R8 planted feet');
  const ground = (s: 'B' | 'F') => org(ix(`foot_${s}`));
  const sets = [A.anims, ...(bare ? [bare] : [])] as Record<string, AnimDef>[];
  let slide = 0, sink = 0, checked = 0;
  for (const S2 of sets) {
    const tr: [AnimDef, number, AnimDef, number][] = [
      [S2.idle, 0, S2.attack, 0], [S2.idle, S2.idle.dur / 2, S2.attack, 0], [S2.attack, S2.attack.dur, S2.idle, 0],
      [S2.jump, S2.jump.dur, S2.idle, 0], [S2.idle, S2.idle.dur / 2, S2.jump, 0], [S2.attack, S2.attack.dur, S2.attack, 0],
    ];
    for (const [a, ta, b, tb] of tr) {
      const snap = pose.localValues(a, ta);
      pose.evaluate(a, ta, st); const fa = { B: ground('B'), F: ground('F') };
      pose.evaluate(b, tb + 0.09, st); const fb2 = { B: ground('B'), F: ground('F') };
      for (const s of ['B', 'F'] as const) {
        if (Math.abs(fa[s][0] - fb2[s][0]) > 0.01 * U || Math.abs(fa[s][1] - fb2[s][1]) > 0.01 * U) continue; // moves by design
        checked++;
        for (let k = 0; k <= 9; k++) {
          const w = k / 9, e = 1 - (1 - w) * (1 - w);
          pose.evaluate(b, tb + w * 0.09, st, undefined, { v: snap, w: e });
          const g = ground(s);
          slide = Math.max(slide, Math.abs(g[0] - fa[s][0])); sink = Math.max(sink, g[1] - Math.max(fa[s][1], fb2[s][1]));
        }
      }
    }
  }
  out.push({ id: 'R8', name: 'A planted foot stays planted through every cross-fade', pass: slide * px150 < 1 && sink * px150 < 1, detail: `${checked} planted feet in the game's changes between grounded states: largest slide ${(slide * px150).toFixed(2)} px, sinking ${(Math.max(0, sink) * px150).toFixed(2)} px at gameplay size (B = 150 px)` });
  return out;
}
