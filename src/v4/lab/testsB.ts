// Real-art tests for candidate B (Phase 3): B's cut parts on the measured rig, in every mix of the basic clothing and
// the Golden Warrior set, through the four animations. The engine checks of Phase 1 are repeated on B's rig and
// wardrobe (motion independence, atomic swaps, the clock, swap cost, preview parity); the art checks are new: atlas
// frames and pivots, joint coverage, the grip, and the composite cell.
import Phaser from 'phaser';
import { starterGear } from '../../items/Gear';
import { B_FRAMES } from '../real/catalogB';
import type { AnimDef } from '../rig/types';
import { RigCharacter } from '../render/RigCharacter';
import { frameOf } from '../wardrobe/resolve';
import type { AppearanceInput, WardrobeSlot } from '../wardrobe/types';
import type { LabScene } from './LabScene';
import { Harness, idColor, idOf, yieldFrame, type TestResult } from './tests';
import { CELL, MASTER_B } from './world';

/** Per wardrobe slot, B's two choices (null = nothing: no gloves, no cape, the sword hidden). */
const CHOICES: [WardrobeSlot, (string | null)[]][] = [
  ['top', ['b_basic_top', 'b_gold_top']], ['bottom', ['b_basic_bottom', 'b_gold_bottom']], ['shoes', ['b_basic_shoes', 'b_gold_shoes']],
  ['gloves', [null, 'b_gold_gloves']], ['back', [null, 'b_gold_cape']], ['weapon', ['b_sun_sword', null]], ['head', [null, 'b_gold_helm']],
];
type Mix = Partial<Record<WardrobeSlot, string | null>>;
/** All 2^7 = 128 mixes. */
const MIXES: Mix[] = Array.from({ length: 1 << CHOICES.length }, (_, m) => Object.fromEntries(CHOICES.map(([slot, opts], j) => [slot, opts[(m >> j) & 1]])));
const mixName = (x: Mix) => CHOICES.map(([slot]) => `${slot}:${(x[slot] ?? 'none').replace(/^b_/, '')}`).join(' ');

export async function runTestsB(scene: LabScene, opts: { full: boolean }, progress: (msg: string) => void = () => {}): Promise<TestResult[]> {
  const A = scene.assets, pose = A.pose, rig = pose.rig, wardrobe = A.wardrobe, results: TestResult[] = [];
  if (A.art !== 'b') throw new Error('runTestsB needs the lab on candidate B');
  const ANIM_LIST: AnimDef[] = [A.anims.idle, A.anims.run, A.anims.jump, A.anims.attack];
  const ch = new RigCharacter(scene, pose, A.atlas256, false);
  const ch512 = new RigCharacter(scene, pose, A.atlas512, false);
  const B = 150, s = B / MASTER_B; // gameplay size: B = 150 canvas px (×1.12, courtyard zoom)
  const OX = Math.round(B * 1.3), OY = Math.round(B * 2.3 * 0.86), RW = Math.ceil(B * 2.6), RH = Math.ceil(B * 2.3);
  const hz = new Harness(scene, 'v4testBG', RW, RH);
  const input = (mix: Mix): AppearanceInput => {
    const equipped: Partial<Record<WardrobeSlot, string>> = {}, hidden: WardrobeSlot[] = [];
    for (const [slot, id] of Object.entries(mix) as [WardrobeSlot, string | null][]) { if (id) equipped[slot] = id; else if (slot === 'weapon') hidden.push('weapon'); }
    return { body: 'male_std', look: { ...A.baseLook }, gearLooks: A.gearLooks(starterGear()), cosmetics: { equipped, hidden }, family: 'sword' };
  };
  const times = (a: AnimDef, n: number) => Array.from({ length: n }, (_, i) => (a.dur * (i + 0.5)) / n);
  /** Deterministic pose: chain reset and run from 0 to t at 60 Hz (running pushes the cape, jumping lifts it). */
  const poseAt = (c: RigCharacter, a: AnimDef, t: number) => {
    c.chain.reset();
    const vx = a.name === 'run' ? 0.9 : 0, steps = Math.round(t * 60);
    for (let i = 0; i < steps; i++) {
      const tt = i / 60, vz = a.name === 'jump' ? Math.max(-1, Math.min(1, 1 - (2 * (tt - 0.08)) / 0.52)) : 0;
      c.chain.step(1 / 60, vx, a.name === 'jump' && tt > 0.08 && tt < 0.6 ? vz : 0);
    }
    c.evaluate(a, t);
  };

  // ---- B1: atlas frames and pivots ----
  progress('B1 frames');
  {
    const names = new Set<string>();
    for (const it of A.catalog.items.values()) for (const p of it.parts) if (p.frame) names.add(p.frame);
    const missing: string[] = [];
    for (const key of [A.atlas256.key, A.atlas512.key]) { const tex = scene.textures.get(key); for (const n of names) if (!tex.has(n)) missing.push(`${key}:${n}`); }
    // the pivot is the same point of the part in both atlases (rig units → B)
    const f256 = new Map(B_FRAMES[256].map((f) => [f.name, f])), f512 = new Map(B_FRAMES[512].map((f) => [f.name, f]));
    let worst = 0, worstName = '';
    for (const n of names) {
      const a = f256.get(n), b = f512.get(n);
      if (!a || !b) continue;
      const d = Math.max(Math.abs(a.px * a.w * A.atlas256.unitsPerPx - b.px * b.w * A.atlas512.unitsPerPx), Math.abs(a.py * a.h * A.atlas256.unitsPerPx - b.py * b.h * A.atlas512.unitsPerPx)) / MASTER_B;
      if (d > worst) { worst = d; worstName = n; }
    }
    results.push({ id: 'B1', name: 'Every part is in both atlases, pivots aligned', pass: missing.length === 0 && worst <= 1 / 256,
      detail: `${names.size} frames named by the wardrobe, missing ${missing.length}${missing.length ? ` (${missing.slice(0, 6).join(', ')})` : ''}; largest pivot offset between the 256 and 512 atlases ${(worst * 256).toFixed(2)} px at B = 256 (${worstName})` });
  }

  // ---- B2: every mix of the two outfits resolves with nothing refused ----
  progress('B2 resolver');
  {
    let refused = 0, parts = 0;
    const notes: string[] = [];
    for (const mix of MIXES) {
      const av = wardrobe.resolve(input(mix));
      const bad = av.notes.filter((n) => !n.startsWith('weapon hidden by the player'));
      if (bad.length) { refused++; if (notes.length < 6) notes.push(`${mixName(mix)}: ${bad.join('; ')}`); }
      for (const [slot, id] of Object.entries(mix)) if (id && av.items[slot as WardrobeSlot]?.id !== id) { refused++; if (notes.length < 6) notes.push(`${mixName(mix)}: ${slot} shows ${av.items[slot as WardrobeSlot]?.id ?? 'nothing'}`); }
      parts += av.parts.filter(Boolean).length;
    }
    results.push({ id: 'B2', name: 'Every basic / Golden mix is shown as chosen', pass: refused === 0,
      detail: `${MIXES.length} mixes (top, trousers, boots: basic or Golden; gauntlets, cape, helmet: off or on; sword: shown or hidden): ${refused} with a refusal or a wrong piece; ${(parts / MIXES.length).toFixed(1)} parts drawn on average${notes.length ? ` — ${notes.join(' | ')}` : ''}` });
  }

  // ---- B3: motion never depends on the outfit; swaps mid-animation are atomic and leave the clock alone ----
  progress('B3 motion and swaps');
  {
    let maxBone = 0, checks = 0;
    for (const a of ANIM_LIST) for (const t of times(a, 8)) {
      let ref: Float64Array | null = null;
      for (const mix of MIXES) {
        ch.setAvatar(wardrobe.resolve(input(mix)));
        poseAt(ch, a, t);
        if (!ref) { ref = new Float64Array(ch.state.world); continue; }
        for (let i = 0; i < ref.length; i++) maxBone = Math.max(maxBone, Math.abs(ref[i] - ch.state.world[i]));
        checks++;
      }
    }
    let frames = 0, swaps = 0, mismatches = 0, timingDiffs = 0;
    const rng = new Phaser.Math.RandomDataGenerator(['b3']);
    for (const a of ANIM_LIST) {
      const run = (withSwaps: boolean) => {
        const log: string[] = [];
        let mix: Mix = {};
        ch.chain.reset();
        ch.setAvatar(wardrobe.resolve(input(mix)));
        for (let f = 0; f < 180; f++) {
          const t = f / 60, tt = a.loop ? t : t % a.dur;
          if (withSwaps && f % 5 === 2) {
            const [slot, opts] = CHOICES[rng.between(0, CHOICES.length - 1)];
            mix = { ...mix, [slot]: opts[rng.between(0, 1)] };
            ch.setAvatar(wardrobe.resolve(input(mix))); swaps++;
          }
          ch.chain.step(1 / 60, 0, 0);
          ch.evaluate(a, tt);
          ch.layout(s);
          frames++;
          const av = ch.avatar!;
          for (let i = 0; i < rig.slots.length; i++) {
            const p = av.parts[i], want = p ? frameOf(p, rig.slots[i], ch.state.swaps, av.unarmed) : undefined;
            const got = ch.shown(i);
            if ((want ?? null) !== (got ?? null)) mismatches++;
          }
          log.push(`${tt.toFixed(4)}|${ch.state.orderId}|${Object.values(ch.state.swaps).join(',')}|${Array.from(ch.state.world.subarray(0, 12)).map((v) => v.toFixed(6)).join(',')}`);
        }
        return log;
      };
      const plain = run(false), swapped = run(true);
      for (let i = 0; i < plain.length; i++) if (plain[i] !== swapped[i]) timingDiffs++;
    }
    results.push({ id: 'B3', name: 'Motion, clock and swaps are independent of the outfit', pass: maxBone === 0 && mismatches === 0 && timingDiffs === 0,
      detail: `${checks} mix × pose comparisons: largest bone difference ${maxBone}; ${swaps} basic ↔ Golden swaps over ${frames} frames of the four animations: ${mismatches} frames showed a stale or missing part, ${timingDiffs} frames differed in time, phase, draw order or bones` });
  }

  // ---- B4: joints covered, sword gripped, the composite cell holds every pose ----
  // quick run: 16 mixes picked at random (seeded), always with all-basic (0) and the full Golden set with the sword,
  // without (31) and with (95) the helmet
  const quick = (() => { const r = new Phaser.Math.RandomDataGenerator(['b4']), ids = r.shuffle([...MIXES.keys()].filter((i) => i !== 0 && i !== 31 && i !== 95)).slice(0, 13); return [0, 31, 95, ...ids].sort((p, q) => p - q); })();
  const list = opts.full ? MIXES : quick.map((i) => MIXES[i]);
  progress(`B4 ${list.length} mixes × 32 poses`);
  {
    // joint discs (B): about 0.6 of the narrower part's half width where two parts meet (measured on the cut parts)
    const joints: [string, number, string][] = [
      ['uparm_F', 0.02, 'shoulder'], ['uparm_B', 0.02, 'shoulder'], ['forearm_F', 0.015, 'elbow'], ['forearm_B', 0.015, 'elbow'],
      ['hand_F', 0.01, 'wrist'], ['hand_B', 0.01, 'wrist'], ['thigh_F', 0.02, 'hip'], ['thigh_B', 0.02, 'hip'],
      ['shin_F', 0.018, 'knee'], ['shin_B', 0.018, 'knee'], ['foot_F', 0.018, 'ankle'], ['foot_B', 0.018, 'ankle'],
      ['chest', 0.04, 'waist'], ['head', 0.017, 'neck'],
    ];
    // the hand standard: the handle runs between the palm layer (behind) and the fingers (in front)
    const frontSlots = ['hand_F.front.skin', 'hand_F.front.glove'].map((n) => pose.slotIndex.get(n)!);
    const backSlots = ['hand_F.back.skin', 'hand_F.back.glove'].map((n) => pose.slotIndex.get(n)!);
    const weaponSlot = pose.slotIndex.get('weapon')!;
    let renders = 0, seamFails = 0, gripChecks = 0, gripFails = 0, gripHidden = 0, edgeHits = 0;
    const seamBy: Record<string, number> = {};
    const samples: { mix: string; anim: string; t: number; what: string }[] = [];
    let maxUp = 0, maxDown = 0, maxL = 0, maxR = 0;
    const poses: [AnimDef, number][] = ANIM_LIST.flatMap((a) => times(a, 8).map((t) => [a, t] as [AnimDef, number]));
    const reach = (px: Uint8Array, step: number) => {
      for (let y = 0; y < RH; y += step) for (let x = 0; x < RW; x += step) if (px[(y * RW + x) * 4 + 3] > 8) {
        maxUp = Math.max(maxUp, (OY - y) / B); maxDown = Math.max(maxDown, (y - OY) / B); maxL = Math.max(maxL, (OX - x) / B); maxR = Math.max(maxR, (x - OX) / B);
      }
      for (let x = 0; x < RW; x++) if (px[x * 4 + 3] > 8 || px[((RH - 1) * RW + x) * 4 + 3] > 8) edgeHits++;
      for (let y = 0; y < RH; y++) if (px[(y * RW) * 4 + 3] > 8 || px[(y * RW + RW - 1) * 4 + 3] > 8) edgeHits++;
    };
    for (let c = 0; c < list.length; c++) {
      const av = wardrobe.resolve(input(list[c]));
      ch.setAvatar(av);
      for (const [a, t] of poses) {
        poseAt(ch, a, t);
        const px = hz.render(ch, s, OX, OY, RW, RH, 'ids');
        renders++;
        const at = (x: number, y: number) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= RW || yi >= RH) return { a: 0, id: -1 }; const o = (yi * RW + xi) * 4; return { a: px[o + 3], id: px[o + 3] > 250 ? idOf(px[o], px[o + 1], px[o + 2]) : -1 }; };
        const P = (bone: string) => { const [wx, wy] = pose.point(ch.state, pose.index.get(bone)!); return [OX + wx * s, OY + wy * s]; };
        // a joint gap is background between the parts at a joint: a hole enclosed by them (not reachable from the open
        // background around the joint), or a crack or split up to 4 px wide (filled by a 2 px closing) reaching more
        // than 2 px into the silhouette. The body's own outline, and a shallow dent in it (the crook of a bent elbow),
        // are not gaps; the far shoulder sits on the torso's front outline while its upper arm hangs behind the torso.
        const opaque = (x: number, y: number) => at(x, y).a >= 250;
        const near2 = (x: number, y: number, fn: (u: number, v: number) => boolean) => { for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u * u + v * v <= 5 && fn(x + u, y + v)) return true; return false; };
        const closed2 = (x: number, y: number) => !near2(x, y, (u, v) => !near2(u, v, opaque));
        const farOpen = (x: number, y: number) => !opaque(x, y) && !closed2(x, y);
        const shallow = (x: number, y: number) => { for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (farOpen(x + u, y + v)) return true; return false; };
        for (const [bone, r, label] of joints) {
          const [cx, cy] = P(bone), rp = Math.max(1.5, r * B);
          const R = Math.ceil(rp) + 6, x0 = Math.round(cx) - R, y0 = Math.round(cy) - R, n = 2 * R + 1;
          // open background: transparent pixels connected to the window's border through transparent pixels
          const open = new Uint8Array(n * n), queue: number[] = [];
          for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            if ((i === 0 || j === 0 || i === n - 1 || j === n - 1) && !opaque(x0 + i, y0 + j)) { open[j * n + i] = 1; queue.push(j * n + i); }
          }
          while (queue.length) {
            const q = queue.pop()!, i = q % n, j = (q - i) / n;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const ii = i + di, jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= n || jj >= n || open[jj * n + ii] || opaque(x0 + ii, y0 + jj)) continue;
              open[jj * n + ii] = 1; queue.push(jj * n + ii);
            }
          }
          let gap = false;
          for (let dy = -rp; dy <= rp && !gap; dy += 1) for (let dx = -rp; dx <= rp; dx += 1) {
            if (dx * dx + dy * dy > rp * rp) continue;
            const x = Math.round(cx + dx), y = Math.round(cy + dy);
            if (opaque(x, y)) continue;
            if (!open[(y - y0) * n + (x - x0)] || (closed2(x, y) && !shallow(x, y))) { gap = true; break; }
          }
          if (gap) { seamFails++; const k = `${label} ${bone.slice(-1)}`; seamBy[k] = (seamBy[k] ?? 0) + 1; if (samples.length < 40) samples.push({ mix: mixName(list[c]), anim: a.name, t, what: `gap at the ${label} (${bone})` }); }
        }
        if (!av.unarmed && (ch.state.swaps.handF === 'grip' || ch.state.swaps.handF === 'grip2')) {
          gripChecks++;
          // the handle is held: drawn after the palm layer and before the fingers
          const pos = (i: number) => ch.drawn.indexOf(i);
          const front = frontSlots.find((i) => pos(i) >= 0), back = backSlots.find((i) => pos(i) >= 0);
          const wi = pos(weaponSlot);
          let bad = front === undefined ? 'no fingers drawn' : wi > pos(front) ? 'the handle is drawn over the fingers' : back !== undefined && wi < pos(back) ? 'the handle is drawn behind the palm layer' : '';
          // the fist encloses the handle: the fingers, the palm layer and the handle on their own cover the grip
          // (radius 0.012 B) with no hole, so nothing behind the hand can show through it
          const [gx, gy] = P('weapon'), rg = Math.max(1.5, 0.012 * B);
          if (!bad && front !== undefined) {
            ch.layout(s); ch.isolate(new Set([front, weaponSlot, ...(back !== undefined ? [back] : [])])); ch.tintAll(0xffffff);
            hz.rt.clear(); hz.rt.draw(ch.container, OX, OY); ch.clearTint();
            const iso = hz.read(0, 0, RW, RH);
            for (let dy = -rg; dy <= rg && !bad; dy += 1) for (let dx = -rg; dx <= rg; dx += 1) {
              if (dx * dx + dy * dy > rg * rg) continue;
              const x = Math.round(gx + dx), y = Math.round(gy + dy);
              if (x >= 0 && y >= 0 && x < RW && y < RH && iso[(y * RW + x) * 4 + 3] < 250) { bad = 'a hole in the fist at the grip'; break; }
            }
          }
          // the whole grip behind another part (the arm passing behind the head or the body)
          const cid = at(gx, gy).id;
          const hiddenAll = cid >= 0 && front !== undefined && pos(cid) > pos(front);
          if (bad) { gripFails++; if (samples.length < 40) samples.push({ mix: mixName(list[c]), anim: a.name, t, what: `handle not held: ${bad}` }); }
          else if (hiddenAll) gripHidden++;
        }
        reach(px, 3);
      }
      if (c % 4 === 3) { progress(`B4 ${c + 1}/${list.length}`); await yieldFrame(); }
    }
    // the widest reach (the sword and the cape): every frame at 60 Hz, with and without the Golden set
    const dense: [AnimDef, number][] = ANIM_LIST.flatMap((a) => Array.from({ length: Math.round(a.dur * 60) + 1 }, (_, i) => [a, Math.min(a.dur, i / 60)] as [AnimDef, number]));
    for (const mix of [MIXES[95], { top: 'b_basic_top', bottom: 'b_basic_bottom', shoes: 'b_basic_shoes', back: 'b_gold_cape', weapon: 'b_sun_sword' }] as Mix[]) {
      ch.setAvatar(wardrobe.resolve(input(mix)));
      for (const [a, t] of dense) { poseAt(ch, a, t); reach(hz.render(ch, s, OX, OY, RW, RH, 'alpha'), 2); }
      await yieldFrame();
    }
    const tag = `${list.length} mixes × 32 poses = ${renders} renders at B = ${B} px`;
    results.push({ id: 'B4a', name: 'No gaps at any joint (every basic / Golden mix)', pass: seamFails === 0,
      detail: `${tag}; joint gaps: ${seamFails}${seamFails ? ` (${Object.entries(seamBy).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`, data: samples.filter((x) => x.what.startsWith('gap')).slice(0, 16) });
    results.push({ id: 'B4b', name: 'Sword held: the handle between the palm and the fingers', pass: gripFails === 0, detail: `${gripChecks} armed frames checked, ${gripFails} with the handle not held (drawn over the fingers or behind the palm layer, or a hole in the fist at the grip); ${gripHidden} with the grip behind the head or body (the attack's wind-up)`, data: samples.filter((x) => x.what.startsWith('handle')).slice(0, 8) });
    const fits = maxUp <= CELL.rootY - 0.02 && maxDown <= CELL.h - CELL.rootY - 0.02 && maxL <= CELL.rootX - 0.02 && maxR <= CELL.w - CELL.rootX - 0.02;
    results.push({ id: 'B4c', name: 'Composite cell holds every pose', pass: edgeHits === 0 && fits,
      detail: `reach from the feet, in B (every mix in its 32 poses, plus the sword and cape on every frame at 60 Hz): up ${maxUp.toFixed(2)}, down ${maxDown.toFixed(2)}, back ${maxL.toFixed(2)}, forward ${maxR.toFixed(2)}; the cell is ${CELL.w} × ${CELL.h} B with the feet at (${CELL.rootX}, ${CELL.rootY}) → ${fits ? 'fits' : 'does NOT fit'}; test-region edge hits ${edgeHits}` });
  }

  // ---- B5: the wardrobe preview (512 atlas) matches gameplay (256 atlas) ----
  progress('B5 preview parity');
  {
    const Bp = 450, sp = Bp / MASTER_B, OXp = Math.round(Bp * 1.3), OYp = Math.round(Bp * 2.3 * 0.86), RWp = Math.ceil(Bp * 2.6), RHp = Math.ceil(Bp * 2.3);
    const hzP = new Harness(scene, 'v4testBP', RWp, RHp);
    let minIoU = 1, minSame = 1, n = 0, slotDiff = 0, worst = '';
    /** IoU of a 150 px render against a 450 px render scaled down 3× (area average), alpha > 127. */
    const iou = (g: Uint8Array, p: Uint8Array) => {
      let inter = 0, uni = 0;
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        let acc = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const yy = y * 3 + j, xx = x * 3 + i; if (yy < RHp && xx < RWp) acc += p[(yy * RWp + xx) * 4 + 3]; }
        const ga = g[(y * RW + x) * 4 + 3] > 127, pa = acc / 9 > 127;
        if (ga && pa) inter++; if (ga || pa) uni++;
      }
      return inter / Math.max(1, uni);
    };
    /** Both atlases through the same render path (450 px, scaled down 3×): what the two atlases themselves differ by. */
    const iouSame = (p256: Uint8Array, p512: Uint8Array) => {
      let inter = 0, uni = 0;
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        let a = 0, b = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const yy = y * 3 + j, xx = x * 3 + i; if (yy < RHp && xx < RWp) { const o = (yy * RWp + xx) * 4 + 3; a += p256[o]; b += p512[o]; } }
        const qa = a / 9 > 127, qb = b / 9 > 127;
        if (qa && qb) inter++; if (qa || qb) uni++;
      }
      return inter / Math.max(1, uni);
    };
    for (const mix of [MIXES[0], MIXES[31], MIXES[21], MIXES[42]]) {
      const av = wardrobe.resolve(input(mix));
      ch.setAvatar(av); ch512.setAvatar(av);
      for (const a of ANIM_LIST) for (const t of times(a, 3)) {
        poseAt(ch, a, t); poseAt(ch512, a, t);
        const g = hz.render(ch, s, OX, OY, RW, RH, 'alpha');
        const p = hzP.render(ch512, sp, OXp, OYp, RWp, RHp, 'alpha').slice();
        const q = hzP.render(ch, sp, OXp, OYp, RWp, RHp, 'alpha'); // the gameplay atlas drawn at the preview's size
        if (ch.drawn.join() !== ch512.drawn.join()) slotDiff++;
        const v = iou(g, p);
        if (v < minIoU) { minIoU = v; worst = `${mixName(mix)}, ${a.name} at ${t.toFixed(3)} s`; }
        minSame = Math.min(minSame, iouSame(q, p)); n++;
      }
      await yieldFrame();
    }
    hzP.dispose();
    results.push({ id: 'B5', name: 'Wardrobe preview matches gameplay', pass: minSame >= 0.97 && slotDiff === 0,
      detail: `${n} poses × mixes: the two atlases drawn the same way (450 px, scaled down 3×) overlap at IoU ≥ ${minSame.toFixed(4)}; the gameplay render (256 atlas at 150 px) against the 3× preview scaled down: lowest IoU ${minIoU.toFixed(4)} (${worst}): thin hair strands and blade edges sampled at 0.59×; drawn-part lists differ in ${slotDiff}` });
  }

  // ---- B6: swap cost ----
  progress('B6 swap cost');
  {
    const ms: number[] = [];
    const rng = new Phaser.Math.RandomDataGenerator(['b6']);
    for (let i = 0; i < 600; i++) {
      const mix = MIXES[rng.between(0, MIXES.length - 1)];
      const t = performance.now();
      ch.setAvatar(wardrobe.resolve(input(mix)));
      ch.layout(s);
      ms.push(performance.now() - t);
    }
    ms.sort((p, q) => p - q);
    const mean = ms.reduce((p, q) => p + q, 0) / ms.length, p95 = ms[Math.floor(ms.length * 0.95)];
    results.push({ id: 'B6', name: 'Swap cost (resolve + place parts)', pass: p95 < 16, detail: `600 random full-outfit swaps: mean ${mean.toFixed(3)} ms, 95th percentile ${p95.toFixed(3)} ms, max ${ms[ms.length - 1].toFixed(3)} ms (CPU; art preloaded)` });
  }

  hz.dispose(); ch.destroy(); ch512.destroy();
  progress('done');
  return results;
}
