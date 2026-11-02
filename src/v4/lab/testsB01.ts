// BASE-01's regression pass (the art director's P3/P4): every mix of its items through every animation. R1: every
// worn piece resolves to an atlas frame and the wardrobe refuses nothing; R2: every bone stays finite and the body
// stays in one piece (each joint where its parent puts it) in every sampled frame of every animation; R3: a held
// weapon never leaves the fist (the grip socket rides the hand at its fixed offset); R4: the cross-fade between any two
// animations stays finite; R5: rapid, interrupted changes of state never pop; R6: with no weapon in hand every state
// plays its unarmed animation; R7: the far fist never shows between the legs; R8: a planted foot stays planted
// through a cross-fade; R9: the staff's far fist stays on the shaft; R10: no wrist bends further than the sword kit's;
// R11: the two hands stay together through interrupted changes and turns; R12: a weapon swap never shows the previous
// weapon's art or kit; R13: the impact stays on the game's active moment when the attack's timings are scaled; R17: the
// skirt garment profile (a skirt hangs still from its waistband, answers both thighs, never shows the body under it).
import type { AnimDef } from '../rig/types';
import { RigPose } from '../rig/pose';
import type { WardrobeSlot } from '../wardrobe/types';
import { Actor, type Control, type LabScene } from './LabScene';
import { rigTime } from '../rig/posemap';
import { B01_WEAR } from '../base01/catalog';
import { STAFF_SPAN } from '../base01/anims';
import { Harness, idColor, idOf, yieldFrame, type TestResult } from './tests';
import { RigCharacter, SKIRT_N, type SkirtFrame } from '../render/RigCharacter';
import b01Data from '../base01/assets/base01.json';

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
    const switches: number[] = [];
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
        if (sinceSwitch === 0) { atSwitch = Math.max(atSwitch, step); switches.push(step); } else inside = Math.max(inside, step);
      }
      last = ang; prev = [a, t];
    }
    return { atSwitch, inside, switches };
  };
  // a pop is a frame-to-frame jump at a change of state bigger than what the animations themselves do in one frame (a
  // light slash sweeps fast by design)
  // every weapon kit runs the same changes; a kit's change may be as sharp as its own fastest motion or as the same
  // change in the approved sword kit (the legs go from the run's stride to the attack's stance the same way in every kit)
  const kits = Object.entries(A.animsByKit ?? { sword_1h: A.anims as Record<string, AnimDef> });
  const sw = runPlan(true, planFor((A.animsByKit?.sword_1h ?? A.anims) as Record<string, AnimDef>));
  const fk = kits.map(([kit, set]) => ({ kit, f: runPlan(true, planFor(set)), n: runPlan(false, planFor(set)) }));
  const r5ok = sw.atSwitch <= sw.inside + 2 && fk.every(({ f }) => f.switches.every((v, i) => v <= Math.max(f.inside, sw.switches[i] ?? 0) + 2));
  out.push({ id: 'R5', name: 'Rapid and interrupted state changes: no pop at any change (every weapon kit)', pass: r5ok, detail: fk.map(({ kit, f, n }) => `${kit}: largest one-frame turn at a change ${f.atSwitch.toFixed(1)}° (without the cross-fade ${n.atSwitch.toFixed(1)}°), its own fastest ${f.inside.toFixed(1)}°`).join('; ') + `; each kit's change no sharper than its own fastest motion or the sword kit's same change (${sw.switches.map((v) => v.toFixed(0)).join(', ')}°)` });
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
  const sets = [...Object.values(A.animsByKit ?? { sword_1h: A.anims }), ...(bare ? [bare] : [])] as Record<string, AnimDef>[];
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
  // R9: the staff in both hands: the far fist stays on the shaft at its second grip (the same distance up the shaft from
  // the near fist) in every frame of the staff kit and through every cross-fade between its states, the arm never
  // stretched (no further than 98% of its length), its wrist bent no more than 70 degrees
  progress('R9 staff hands');
  const SK = (A.animsByKit ?? {}).staff_2h;
  const staffAnims = SK ? [SK.idle, SK.run, SK.jump, SK.attack] : [];
  let drift = 0, fadeDrift = 0, wristF = 0, reach = 0, sframes = 0, sfades = 0;
  const sock2 = ix('weapon'), off2 = ix('offhand'), fhand = ix('hand_F'), ffore = ix('forearm_F'), fup = ix('uparm_F');
  const armLen = (pose.rig.bones[ffore].x + pose.rig.bones[fhand].x) * U;
  const onShaft = () => {
    const q = sock2 * 6, span = STAFF_SPAN * U;
    const tx = st.world[q + 4] + st.world[q] * span, ty = st.world[q + 5] + st.world[q + 1] * span;
    return Math.hypot(st.world[off2 * 6 + 4] - tx, st.world[off2 * 6 + 5] - ty);
  };
  const turn = (i: number) => Math.atan2(st.world[i * 6 + 1], st.world[i * 6]) * 180 / Math.PI;
  for (const a of staffAnims) {
    for (let t = 0; t <= a.dur + 1e-9; t += 1 / 60) {
      pose.evaluate(a, t, st); sframes++;
      drift = Math.max(drift, onShaft());
      let dw = turn(fhand) - turn(ffore); dw -= 360 * Math.round(dw / 360); wristF = Math.max(wristF, Math.abs(dw));
      reach = Math.max(reach, Math.hypot(st.world[fhand * 6 + 4] - st.world[fup * 6 + 4], st.world[fhand * 6 + 5] - st.world[fup * 6 + 5]) / armLen);
    }
  }
  for (const a of staffAnims) for (const b of staffAnims) for (const ta of [0, a.dur * 0.37, a.dur]) {
    if (a === b && ta !== a.dur) continue;
    const snap = pose.localValues(a, ta);
    for (let k = 0; k <= 9; k++) { const w = k / 9; pose.evaluate(b, w * 0.09, st, undefined, { v: snap, w: 1 - (1 - w) * (1 - w) }); fadeDrift = Math.max(fadeDrift, onShaft()); sfades++; }
  }
  out.push({ id: 'R9', name: 'The staff in both hands: the far fist stays on the shaft in every frame and cross-fade, the arm never stretched, the wrist natural', pass: staffAnims.length === 4 && drift * px150 < 0.5 && fadeDrift * px150 < 0.5 && reach <= 0.98 && wristF <= 70, detail: `${sframes} frames and ${sfades} cross-fade frames: largest distance from the second grip ${(drift * px150).toFixed(2)} px (cross-fades ${(fadeDrift * px150).toFixed(2)} px) at gameplay size; the arm at most ${(reach * 100).toFixed(0)}% of its length; far wrist bent at most ${wristF.toFixed(0)}°` });
  // R10: no wrist inversion: the hand holding a weapon bends at the wrist no more than in the art director's approved
  // sword kit (the fists are hammer grips: the handle across the fist), in every frame of every kit
  progress('R10 wrists');
  const nh = ix('hand_B'), nf = ix('forearm_B');
  const wristMax = (set: Record<string, AnimDef>, names: string[]) => {
    let m = 0;
    for (const n2 of names) { const a = set[n2]; if (!a) continue; for (let t = 0; t <= a.dur + 1e-9; t += 1 / 60) { pose.evaluate(a, t, st); let d = turn(nh) - turn(nf); d -= 360 * Math.round(d / 360); m = Math.max(m, Math.abs(d)); } }
    return m;
  };
  const KITS = A.animsByKit ?? {};
  const swordMax = wristMax(KITS.sword_1h ?? A.anims, ['idle', 'run', 'jump', 'attack', 'attack_heavy']);
  const kitMax = Object.entries(KITS).filter(([k]) => k !== 'sword_1h').map(([k, set]) => [k, wristMax(set, ['idle', 'run', 'jump', 'attack'])] as [string, number]);
  out.push({ id: 'R10', name: 'No wrist inversion: every weapon kit bends the wrist no more than the approved sword kit', pass: kitMax.length > 0 && kitMax.every(([, m]) => m <= swordMax + 1), detail: `sword kit at most ${swordMax.toFixed(0)}°; ${kitMax.map(([k, m]) => `${k} ${m.toFixed(0)}°`).join(', ')}` });

  // R11-R12 drive a lab actor through the game's own state machine, pose query, cross-fade and evaluation
  const dressed = (weapon: string | null) => {
    const equipped: Partial<Record<WardrobeSlot, string>> = { top: 'top01_tunic', bottom: 'bottom01_pants', shoes: 'shoes01_boots' };
    if (weapon) equipped.weapon = weapon;
    return { body: 'male_std' as const, look: { ...A.baseLook }, gearLooks: {}, cosmetics: { equipped, hidden: [] }, family: 'sword' as const };
  };
  const ctl = (c: Partial<Control>): Control => ({ move: 0, lane: 0, walk: false, jump: false, attack: false, ...c });
  const DT = 1 / 60, s150 = 150 / U;
  /** The far fist's distance from the shaft's second grip, on screen (px at B = 150), as the scene mirrors the actor. */
  const screenDrift = (a: Actor) => {
    const w = a.ch.state.world, q = sock2 * 6, span = STAFF_SPAN * U, f = a.facing;
    const tx = w[q + 4] + w[q] * span, ty = w[q + 5] + w[q + 1] * span;
    return Math.hypot(f * (w[off2 * 6 + 4] - tx) * s150, (w[off2 * 6 + 5] - ty) * s150);
  };

  // R11: the staff in both hands through rapid, interrupted changes of state (a change arriving mid-fade) and sudden
  // turns: run, slash, jump mid-slash, slash on landing, turn while running, turn mid-fade, idle
  progress('R11 two hands under interruptions and turns');
  const staffId = B01_WEAR.find((w) => w.slot === 'weapon')?.items.find((i) => (A.catalog.items.get(i.id) as { motion?: string } | undefined)?.motion === 'staff_2h')?.id ?? 'item09_staff';
  const actor = new Actor(scene, 600, 700, dressed(staffId));
  // (the game lets no input cut a slash or a jump short, so the turns come while standing or running, and the changes
  // that land mid-fade come from short taps)
  const script: [number, Partial<Control>][] = [
    [20, { move: 1 }], [1, { attack: true }], [10, {}], [40, { move: -1 }], [3, { move: 1 }], [3, { move: -1 }], [2, { move: 1 }],
    [1, { jump: true, move: 1 }], [60, {}], [2, { move: 1 }], [2, {}], [2, { move: -1 }], [2, {}], [1, { attack: true }], [5, { attack: true }],
    [45, { move: -1 }], [1, { move: 1 }], [1, { move: -1 }], [1, { move: 1 }], [4, { attack: true, move: 1 }], [40, {}],
  ];
  let r11 = 0, r11Frames = 0, turns = 0, changes = 0, lastAnim = '', lastFacing = actor.facing;
  for (const [n, c] of script) for (let i = 0; i < n; i++) {
    actor.control(ctl(c), DT); actor.pose(DT); r11Frames++;
    if (actor.facing !== lastFacing) { turns++; lastFacing = actor.facing; }
    const an = actor.last?.anim.name ?? ''; if (an !== lastAnim) { changes++; lastAnim = an; }
    r11 = Math.max(r11, screenDrift(actor));
  }
  actor.destroy();
  out.push({ id: 'R11', name: 'The staff in both hands through interrupted changes of state and sudden turns', pass: r11 < 0.5 && turns >= 6 && changes >= 8, detail: `${r11Frames} frames through the lab's state machine and cross-fade, ${changes} changes of animation, ${turns} turns: the far fist at most ${r11.toFixed(2)} px from its grip on the shaft (screen, B = 150 px)` });

  // R12: a weapon swap in a state that allows it (standing or running): the very next frame plays the new weapon's
  // kit and draws the new weapon's art (never the previous one's); a staff's second hand is on the shaft by the end of
  // the cross-fade and stays there
  progress('R12 weapon swaps');
  const weapons: [string, string | null][] = [['sword', 'weapon01_sword'], ['dagger', 'item10_dagger'], ['staff', staffId], ['none', null]];
  const wslot = pose.slotIndex.get('weapon')!;
  const r12bad: string[] = [];
  let r12cases = 0, r12late = 0;
  for (const [na, wa] of weapons) for (const [nb, wb] of weapons) for (const st2 of ['idle', 'run'] as const) {
    if (na === nb) continue;
    r12cases++;
    const a = new Actor(scene, 600, 700, dressed(wa));
    const c = ctl(st2 === 'run' ? { move: 1 } : {});
    for (let i = 0; i < 30; i++) { a.control(c, DT); a.pose(DT); }
    a.setLook(dressed(wb));
    a.control(c, DT); a.pose(DT); a.ch.layout(1);
    const kit = wb ? (A.catalog.items.get(wb) as { motion?: string } | undefined)?.motion ?? 'sword_1h' : null;
    const set = kit ? (A.animsByKit?.[kit] ?? A.anims) : (A.animsBare ?? A.anims);
    if (a.last?.anim !== set[st2]) r12bad.push(`${na}>${nb} ${st2}: plays ${a.last?.anim.name}`);
    const want = wb ? a.avatar.parts[wslot]?.frame : undefined, shown = a.ch.shown(wslot);
    if (shown !== want) r12bad.push(`${na}>${nb} ${st2}: weapon shows ${shown ?? 'nothing'}, wants ${want ?? 'nothing'}`);
    if (wa && shown && (A.catalog.items.get(wa) as { parts?: { frame: string }[] } | undefined)?.parts?.some((p) => p.frame === shown)) r12bad.push(`${na}>${nb} ${st2}: the previous weapon's art`);
    if (nb === 'staff') {
      let after = 0;
      for (let i = 0; i < 12; i++) { a.control(c, DT); a.pose(DT); if (i >= 5) after = Math.max(after, screenDrift(a)); }
      r12late = Math.max(r12late, after);
      if (after >= 0.5) r12bad.push(`${na}>${nb} ${st2}: the far fist ${after.toFixed(2)} px off the shaft after the fade`);
    }
    a.destroy();
  }
  out.push({ id: 'R12', name: 'Weapon swaps: the next frame plays the new kit with the new art; a staff has both hands on it by the end of the fade', pass: r12bad.length === 0, detail: r12bad.length ? r12bad.slice(0, 4).join(' | ') : `${r12cases} swaps (sword, dagger, staff, none; standing and running): new kit and art on the first frame every time; a staff's far fist at most ${r12late.toFixed(2)} px from the shaft from 100 ms after the swap` });

  // R13: the attack's impact (its 140 ms key, the 'active' mark) is on screen exactly when the game's active window
  // opens, and the animation never runs backwards, however gameplay scales the attack's timings (faster, slower, or
  // its phases scaled unevenly), in every kit
  progress('R13 time-scaled attacks');
  const scales: [number, number, number][] = [[0.5, 0.5, 0.5], [0.75, 0.75, 0.75], [1, 1, 1], [1.25, 1.25, 1.25], [1.5, 1.5, 1.5], [2, 2, 2], [0.6, 1.4, 1], [1.5, 0.7, 0.8]];
  let r13worst = 0, r13back = 0, r13n = 0;
  for (const [kit, set] of Object.entries(A.animsByKit ?? { sword_1h: A.anims as Record<string, AnimDef> })) {
    const atk = set.attack, m = atk.marks!;
    for (const [fs, fa, fr] of scales) {
      const S = 200 * fs, Ac = 250 * fa, Rc = 200 * fr;
      const at = (e: number) => rigTime({ k: 'skill', id: 'warrior_basic', stage: 0, elapsed: e, startup: S, active: Ac, recovery: Rc } as Parameters<typeof rigTime>[0], set);
      const hit = at(S);
      if (hit.anim !== atk) r13back++;
      r13worst = Math.max(r13worst, Math.abs(hit.t - m.active), Math.abs(at(S + Ac).t - m.recovery), Math.abs(at(S + Ac + Rc).t - m.end));
      let prevT = -1;
      for (let e = 0; e <= S + Ac + Rc; e += 1) { const t = at(e).t; if (t < prevT - 1e-12) r13back++; prevT = t; }
      r13n++;
      void kit;
    }
  }
  out.push({ id: 'R13', name: 'Time-scaled attacks: the impact lands on the game\'s active moment, the animation never runs backwards', pass: r13worst < 1e-9 && r13back === 0, detail: `${r13n} timings (every kit; 0.5x to 2x, and phases scaled unevenly): impact, recovery and end marks off by at most ${r13worst.toExponential(1)} s; ${r13back} backward steps` });
  out.push(await skirtTest(scene, pose, progress));
  return out;
}

/** R17 (the art director's r9): the skirt garment profile. Every bottom the exporter cut as a skirt, worn on the base
 *  body, through the six motions the art director named (idle, long-stride run, jump tuck, landing crouch, light attack,
 *  heavy attack), in every weapon kit and unarmed, at 60 Hz with the cloth's follow-through running:
 *  (a) the waistband never moves: the hips' piece is rigid on the hips and each column of the skirt hangs from it (its
 *      hang point where the hips put it: never lower, never to the side; over a lifted thigh only up, under the band);
 *  (b) one cloth: no column crosses or twists (every quad keeps its turn), the back edge never past the front one, the
 *      hem one line (one mesh: no split at the crotch), stretched at most 4 times;
 *  (c) it answers both thighs, never one alone: its edges are where the thigh furthest back and the thigh furthest
 *      forward push them (swapping the two thighs changes nothing);
 *  (d) the follow-through: at most lagMax (11 degrees) behind, never inside a thigh's push;
 *  (e) on screen (B = 300 px, every other frame, the sword kit and unarmed): no pixel of the bare body under it (the
 *      base's shorts, the bare thighs), no hole at the waist or in the skirt's upper part (a crack between the
 *      waistband, the skirt and the body), and the upper half of each thigh (under the skirt at rest) at most 20%
 *      visible beside it.
 *  The exporter's verdict per bottom is in the detail (why each other bottom is not a skirt). */
async function skirtTest(scene: LabScene, pose: RigPose, progress: (msg: string) => void): Promise<TestResult> {
  progress('R17 skirts');
  const A = scene.assets, U = pose.rig.B;
  const report = (b01Data as unknown as { report: { id: string; skirt?: { skirt: boolean; why?: string } }[] }).report;
  const verdicts = report.filter((r) => r.skirt).map((r) => `${r.id}: ${r.skirt!.skirt ? 'skirt' : `not a skirt (${r.skirt!.why})`}`);
  const sk = pose.slotIndex.get('pelvis.skirt');
  const items = [...A.catalog.items.values()].filter((it) => it.wslot === 'bottom' && it.parts.some((p) => p.slot === 'pelvis.skirt'));
  if (sk === undefined || !items.length) return { id: 'R17', name: 'The skirt garment profile', pass: false, detail: `no skirt ${sk === undefined ? 'slot' : 'item'} | ${verdicts.join('; ')}` };
  const hip = pose.index.get('hip')!, thigh = { B: pose.index.get('thigh_B')!, F: pose.index.get('thigh_F')! };
  const bare = new Set(['pelvis.skin', 'leg_B.skin', 'leg_F.skin'].map((n) => pose.slotIndex.get(n)!));
  const cloth = { B: pose.slotIndex.get('leg_B.cloth')!, F: pose.slotIndex.get('leg_F.cloth')! };
  const keep = new Set([...['legB', 'legF', 'torso'].flatMap((g) => pose.rig.slots.map((s, i) => (s.group === g ? i : -1)).filter((i) => i >= 0))]);
  const BS = 300, s = BS / U, s150 = 150 / U, RW = 360, RH = 340;
  const hz = new Harness(scene, 'v4testSkirt', RW, RH);
  const D = 180 / Math.PI, lagMax = (pose.rig.slots[sk].skirt?.lagMax ?? 11);
  let drift = 0, rise = 0, folds = 0, order = 0, stretch = 0, edgeOff = 0, lag = 0, inside = 0, spread = 0, frames = 0;
  let bareMax = 0, holes = 0, pixFrames = 0;
  const expo: Record<string, number> = {};
  const worst: string[] = [];
  const kits: [string, Record<string, AnimDef>][] = [...Object.entries(A.animsByKit ?? { sword_1h: A.anims as Record<string, AnimDef> }), ['unarmed', A.animsBare ?? A.anims]];
  for (const it of items) {
    const ch = new RigCharacter(scene, pose, A.atlas512, false);
    ch.setAvatar(A.wardrobe.resolve({ body: 'male_std', look: { ...A.baseLook }, gearLooks: {}, cosmetics: { equipped: { bottom: it.id }, hidden: [] }, family: 'sword' }));
    for (const [kit, set] of kits) {
      const j = set.jump, m = j.marks ?? {};
      const six: [string, AnimDef, number, number][] = [
        ['idle', set.idle, 0, set.idle.dur], ['long-stride run', set.run, 0, set.run.dur], ['jump tuck', j, m.air ?? 0, m.land ?? j.dur],
        ['landing crouch', j, m.land ?? 0, j.dur], ['light attack', set.attack, 0, set.attack.dur], ['heavy attack', set.attack_heavy ?? set.attack, 0, (set.attack_heavy ?? set.attack).dur],
      ];
      const pixels = kit === 'sword_1h' || kit === 'unarmed';
      for (const [motion, anim, t0, t1] of six) {
        ch.resetFollow();
        const warm = anim.loop ? 0.25 : Math.min(0.25, t0);
        let k = 0;
        for (let t = t0 - warm; t <= t1 + 1e-9; t += 1 / 60, k++) {
          ch.evaluate(anim, anim.loop ? ((t % anim.dur) + anim.dur) % anim.dur : Math.max(0, t));
          ch.layout(s);
          if (t < t0 - 1e-9) continue;
          frames++;
          const w = ch.state.world, rope = ch.ropeOf(sk)!, V = rope.vertices, f = rope.frame, sp = ch.skirtPose[sk]!;
          const data = (f.customData as { skirt?: SkirtFrame }).skirt!;
          const u = A.atlas512.unitsPerPx, fw = f.width, fh = f.height, px = f.pivotX * fw, py = f.pivotY * fh;
          const ho = hip * 6, ht = Math.atan2(w[ho + 1], w[ho]), hc = Math.cos(ht), hs = Math.sin(ht);
          const where = `${it.id} ${kit} ${motion} ${t.toFixed(2)} s`;
          // (a) each column's hang point against where the hips put it (hips' frame, px at B = 150)
          const P: [number, number][] = [], H: [number, number][] = [], H0: [number, number][] = [];
          for (let c = 0; c < SKIRT_N; c++) {
            const x = (fw * c) / (SKIRT_N - 1), y0 = data.hang[c], up = Math.min(2, y0), dn = fh - y0, e = up / (up + dn);
            const tx = V[4 * c], ty = V[4 * c + 1], bx = V[4 * c + 2], by = V[4 * c + 3];
            const ax = tx + (bx - tx) * e, ay = ty + (by - ty) * e;
            const ex = w[ho + 4] / u + hc * (x - px) - hs * (y0 - py), ey = w[ho + 5] / u + hs * (x - px) + hc * (y0 - py);
            const dx = (ax - ex) * u * s150, dy = (ay - ey) * u * s150, lx = hc * dx + hs * dy, ly = -hs * dx + hc * dy;
            if (Math.abs(lx) > drift || ly > drift) { drift = Math.max(drift, Math.abs(lx), ly); if (drift > 0.05 && worst.length < 6) worst.push(`waistband ${drift.toFixed(2)} px at ${where}`); }
            rise = Math.max(rise, -ly);
            P.push([ax, ay]);
            const g = (data.hem[c] - y0) / (up + dn);
            H.push([ax + (bx - tx) * g, ay + (by - ty) * g]);
            H0.push([x, data.hem[c]]);
          }
          // (b) the columns' order: every quad keeps its turn (as at rest), the hem's stretch
          for (let c = 0; c + 1 < SKIRT_N; c++) {
            const T0x = V[4 * c], T0y = V[4 * c + 1], B0x = V[4 * c + 2], B0y = V[4 * c + 3], T1x = V[4 * c + 4], T1y = V[4 * c + 5], B1x = V[4 * c + 6], B1y = V[4 * c + 7];
            const c1 = (B0x - T0x) * (T1y - T0y) - (B0y - T0y) * (T1x - T0x), c2 = (T1x - B0x) * (B1y - B0y) - (T1y - B0y) * (B1x - B0x);
            if (!(c1 < 0 && c2 > 0)) { folds++; if (worst.length < 6) worst.push(`fold at column ${c}, ${where}`); }
            const l = Math.hypot(H[c + 1][0] - H[c][0], H[c + 1][1] - H[c][1]), l0 = Math.hypot(H0[c + 1][0] - H0[c][0], H0[c + 1][1] - H0[c][1]);
            stretch = Math.max(stretch, l / Math.max(1e-6, l0));
          }
          if (sp.back < sp.front - 1e-9) order++;
          // (c) the edges where both thighs push them (the furthest back, the furthest forward)
          const turn = (b: number) => { const d = Math.atan2(w[b * 6 + 1], w[b * 6]) - pose.restWorldRot[b] / D - ht; return Math.atan2(Math.sin(d), Math.cos(d)); };
          const tB = turn(thigh.B), tF = turn(thigh.F), S = pose.rig.slots[sk].skirt!;
          const bk = Math.max(0, tB, tF), fr = Math.min(0, tB, tF), from = S.from / D;
          const aL = bk + S.lift * Math.max(0, bk - from), aR = fr - S.lift * Math.max(0, -fr - from);
          edgeOff = Math.max(edgeOff, Math.abs(aL - sp.backTarget), Math.abs(aR - sp.frontTarget));
          // (d) the follow-through
          const lb = (sp.back - sp.backTarget) * D, lf = (sp.frontTarget - sp.front) * D;
          lag = Math.max(lag, lb, lf);
          if (lb < -1e-6 || lf < -1e-6) inside++;
          spread = Math.max(spread, (sp.back - sp.front) * D);
          // (e) on screen, every other frame, the sword kit and unarmed
          if (!pixels || k % 2) continue;
          pixFrames++;
          const ox = Math.round(RW / 2 - w[ho + 4] * s), oy = Math.round(RH * 0.32 - w[ho + 5] * s);
          ch.layout(s, false); ch.tintBySlot(idColor); hz.rt.clear(); hz.rt.draw(ch.container, ox, oy); ch.clearTint();
          const all = hz.read(0, 0, RW, RH);
          // (a pixel of a piece, with its four neighbours: an edge blending two pieces' colours is no piece's)
          const id = (q: number) => (all[q * 4 + 3] > 200 ? idOf(all[q * 4], all[q * 4 + 1], all[q * 4 + 2]) : -1);
          let nb = 0;
          for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) {
            const q = y * RW + x, v = id(q);
            if (bare.has(v) && id(q - 1) === v && id(q + 1) === v && id(q - RW) === v && id(q + RW) === v) nb++;
          }
          for (const b of bare) if (ch.drawn.includes(b)) nb += 1e6;   // a bare piece drawn at all under the skirt
          if (nb > bareMax) { bareMax = nb; if (nb > 0 && worst.length < 12) worst.push(`${nb} px of bare body at ${where}`); }
          // the legs, the hips and the skirt on their own: holes (background enclosed by them) and the thighs' cover
          ch.layout(s, false); ch.isolate(keep); ch.tintBySlot(idColor); hz.rt.clear(); hz.rt.draw(ch.container, ox, oy); ch.clearTint();
          const iso = hz.read(0, 0, RW, RH);
          const open = new Uint8Array(RW * RH), queue: number[] = [];
          const solid = (q: number) => iso[q * 4 + 3] >= 128;
          for (let x = 0; x < RW; x++) for (const y of [0, RH - 1]) { const q = y * RW + x; if (!solid(q) && !open[q]) { open[q] = 1; queue.push(q); } }
          for (let y = 0; y < RH; y++) for (const x of [0, RW - 1]) { const q = y * RW + x; if (!solid(q) && !open[q]) { open[q] = 1; queue.push(q); } }
          while (queue.length) {
            const q = queue.pop()!, x = q % RW, y = (q - x) / RW;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= RW || yy >= RH) continue;
              const r = yy * RW + xx; if (open[r] || solid(r)) continue; open[r] = 1; queue.push(r);
            }
          }
          // (a hole at the waist or in the skirt's upper part, from 0.09 B above the hips to 0.06 B below: a crack between
          // the waistband, the skirt and the body; lower down, background enclosed by two crossing legs is no hole)
          let nh = 0, hx = 0, hy = 0;
          for (let q = 0; q < RW * RH; q++) if (!solid(q) && !open[q]) {
            const x = q % RW, y = (q - x) / RW, wx = (x - ox) / s - w[ho + 4], wy = (y - oy) / s - w[ho + 5];
            const lx = (hc * wx + hs * wy) / U, ly = (-hs * wx + hc * wy) / U;
            if (ly < -0.09 || ly > 0.06) continue;
            nh++; hx += lx; hy += ly;
          }
          if (nh > 2) { holes++; if (worst.length < 12) worst.push(`hole of ${nh} px at (${(hx / nh).toFixed(3)}, ${(hy / nh).toFixed(3)}) B from the hips, ${where}`); }
          for (const side of ['B', 'F'] as const) {
            // the upper half of the thigh: within 0.07 B of its axis, from the hip joint to half its length
            const b = thigh[side], o = b * 6, L = pose.length(ch.state, b) * U * 0.5, R = 0.07 * U;
            const inU = (x: number, y: number) => {
              const wx = (x - ox) / s - w[o + 4], wy = (y - oy) / s - w[o + 5], al = wx * w[o] + wy * w[o + 1], ac = -wx * w[o + 1] + wy * w[o];
              return al >= 0 && al <= L && Math.abs(ac) <= R;
            };
            ch.layout(s, false); ch.isolate(new Set([cloth[side]])); ch.tintAll(0xffffff); hz.rt.clear(); hz.rt.draw(ch.container, ox, oy); ch.clearTint();
            const own = hz.read(0, 0, RW, RH);
            let total = 0, seen = 0;
            for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
              const q = y * RW + x;
              if (own[q * 4 + 3] < 200 || !inU(x, y)) continue;
              total++;
              if (all[q * 4 + 3] > 200 && idOf(all[q * 4], all[q * 4 + 1], all[q * 4 + 2]) === cloth[side]) seen++;
            }
            const share = total ? seen / total : 0, key = `${motion} ${side}`;
            if (share > (expo[key] ?? 0)) expo[key] = share;
          }
        }
        await yieldFrame();
      }
    }
    ch.destroy();
  }
  hz.dispose();
  const expoMax = Math.max(0, ...Object.values(expo));
  const pass = drift <= 0.05 && folds === 0 && order === 0 && stretch <= 4 && edgeOff < 1e-9 && lag <= lagMax + 1e-6 && inside === 0 && bareMax === 0 && holes === 0 && expoMax <= 0.2;
  const ex = Object.entries(expo).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k2, v]) => `${k2} ${(v * 100).toFixed(0)}%`).join(', ');
  return {
    id: 'R17', name: 'The skirt garment profile: one cloth from a still waistband, answering both thighs, no bare body, no leg through it', pass,
    detail: `${items.map((i) => i.id).join(', ')} on the base body, ${frames} frames (${kits.map(([k2]) => k2).join(', ')}: idle, long-stride run, jump tuck, landing crouch, light attack, heavy attack): waistband off by at most ${drift.toFixed(3)} px at B = 150 (rising at most ${rise.toFixed(1)} px under the band over a lifted thigh); ${folds} folded columns, ${order} edges crossed; hem stretched at most ${stretch.toFixed(2)}x; edges ${edgeOff < 1e-9 ? 'exactly' : 'NOT'} where both thighs push them; follow-through at most ${lag.toFixed(1)} deg behind (limit ${lagMax}), ${inside} frames inside a thigh's push; fan at most ${spread.toFixed(0)} deg wide; on screen (${pixFrames} frames at B = 300): bare body ${bareMax} px, ${holes} frames with a hole at the waist, upper thigh visible at most ${(expoMax * 100).toFixed(0)}% (${ex})${worst.length ? ` | ${worst.join(' | ')}` : ''} | exporter: ${verdicts.join('; ')}`,
  };
}
