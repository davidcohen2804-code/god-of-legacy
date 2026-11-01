// Real-art tests for candidate B (Phase 3): B's cut parts on the measured rig, in every mix of the basic clothing and
// the Golden Warrior set, through the four animations. The engine checks of Phase 1 are repeated on B's rig and
// wardrobe (motion independence, atomic swaps, the clock, swap cost, preview parity); the art checks are new: atlas
// frames and pivots, joint coverage, the grip, and the composite cell.
import Phaser from 'phaser';
import { starterGear } from '../../items/Gear';
import { STANCE_B } from '../real/animsB';
import { B_FRAMES } from '../real/catalogB';
import { hold } from '../rig/anims';
import { bodyDrive } from '../rig/pose';
import type { AnimDef, AttachSpec } from '../rig/types';
import { RigCharacter } from '../render/RigCharacter';
import { frameOf } from '../wardrobe/resolve';
import type { AppearanceInput, WardrobeSlot } from '../wardrobe/types';
import type { LabScene } from './LabScene';
import { Harness, idColor, idOf, yieldFrame, type TestResult } from './tests';
import { CELL, MASTER_B } from './world';

/** Per wardrobe slot, B's choices (null = nothing: no gloves, no cape, the sword hidden): the basic clothing, the Golden
 *  Warrior set and the Ember Duelist set (top, trousers, boots, gloves; it has no cape or helmet of its own). */
const CHOICES: [WardrobeSlot, (string | null)[]][] = [
  ['top', ['b_basic_top', 'b_gold_top', 'b_ember_top']], ['bottom', ['b_basic_bottom', 'b_gold_bottom', 'b_ember_bottom']],
  ['shoes', ['b_basic_shoes', 'b_gold_shoes', 'b_ember_shoes']], ['gloves', [null, 'b_gold_gloves', 'b_ember_gloves']],
  ['back', [null, 'b_gold_cape']], ['weapon', ['b_sun_sword', null]], ['head', [null, 'b_gold_helm']],
];
type Mix = Partial<Record<WardrobeSlot, string | null>>;
/** Every mix: 3^4 × 2^3 = 648 (the first option of each slot varies fastest). */
const MIXES: Mix[] = (() => {
  const out: Mix[] = [];
  const total = CHOICES.reduce((n, [, o]) => n * o.length, 1);
  for (let m = 0; m < total; m++) { let r = m; out.push(Object.fromEntries(CHOICES.map(([slot, opts]) => { const v = opts[r % opts.length]; r = Math.floor(r / opts.length); return [slot, v]; }))); }
  return out;
})();
const mixName = (x: Mix) => CHOICES.map(([slot]) => `${slot}:${(x[slot] ?? 'none').replace(/^b_/, '')}`).join(' ');
/** A named mix: the basic clothing with the sword, then the pieces given. */
const mixOf = (m: Mix): Mix => ({ ...MIXES[0], ...m });
const GOLD_MIX = mixOf({ top: 'b_gold_top', bottom: 'b_gold_bottom', shoes: 'b_gold_shoes', gloves: 'b_gold_gloves', back: 'b_gold_cape' });
const EMBER_MIX = mixOf({ top: 'b_ember_top', bottom: 'b_ember_bottom', shoes: 'b_ember_shoes', gloves: 'b_ember_gloves' });
const indexOf = (m: Mix) => MIXES.findIndex((x) => CHOICES.every(([slot]) => (x[slot] ?? null) === (m[slot] ?? null)));

export async function runTestsB(scene: LabScene, opts: { full: boolean; only?: string[] }, progress: (msg: string) => void = () => {}): Promise<TestResult[]> {
  /** `only`: run just the tests whose ids start with one of these (e.g. ['B7', 'B8']). */
  const want = (id: string) => !opts.only?.length || opts.only.some((o) => id.startsWith(o));
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
      const drive = i > 0 ? bodyDrive(a, (i - 1) / 60, tt) : 0; // the attack's lunge, as in the lab
      c.chain.step(1 / 60, Math.max(-1, Math.min(1, vx + drive)), a.name === 'jump' && tt > 0.08 && tt < 0.6 ? vz : 0);
    }
    c.evaluate(a, t);
  };

  // ---- B1: atlas frames and pivots ----
  if (want('B1')) {
  progress('B1 frames');
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
  if (want('B2')) {
  progress('B2 resolver');
    let refused = 0, parts = 0;
    const notes: string[] = [];
    for (const mix of MIXES) {
      const av = wardrobe.resolve(input(mix));
      const bad = av.notes.filter((n) => !n.startsWith('weapon hidden by the player'));
      if (bad.length) { refused++; if (notes.length < 6) notes.push(`${mixName(mix)}: ${bad.join('; ')}`); }
      for (const [slot, id] of Object.entries(mix)) if (id && av.items[slot as WardrobeSlot]?.id !== id) { refused++; if (notes.length < 6) notes.push(`${mixName(mix)}: ${slot} shows ${av.items[slot as WardrobeSlot]?.id ?? 'nothing'}`); }
      parts += av.parts.filter(Boolean).length;
    }
    results.push({ id: 'B2', name: 'Every basic / Golden / Ember mix is shown as chosen', pass: refused === 0,
      detail: `${MIXES.length} mixes (top, trousers, boots: basic, Golden or Ember; gloves: none, Golden or Ember; cape, helmet: off or on; sword: shown or hidden): ${refused} with a refusal or a wrong piece; ${(parts / MIXES.length).toFixed(1)} parts drawn on average${notes.length ? ` — ${notes.join(' | ')}` : ''}` });
  }

  // ---- B3: motion never depends on the outfit; swaps mid-animation are atomic and leave the clock alone ----
  if (want('B3')) {
  progress('B3 motion and swaps');
    // the body's bones (the optional attachment chains come after them and belong to the items that use them)
    const nAtt = Object.values(rig.attach ?? {}).reduce((n, b) => n + b.length, 0), bodyLen = (rig.bones.length - nAtt) * 6;
    let maxBone = 0, checks = 0;
    for (const a of ANIM_LIST) for (const t of times(a, 8)) {
      let ref: Float64Array | null = null;
      for (const mix of MIXES) {
        ch.setAvatar(wardrobe.resolve(input(mix)));
        poseAt(ch, a, t);
        if (!ref) { ref = new Float64Array(ch.state.world); continue; }
        for (let i = 0; i < bodyLen; i++) maxBone = Math.max(maxBone, Math.abs(ref[i] - ch.state.world[i]));
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
            mix = { ...mix, [slot]: opts[rng.between(0, opts.length - 1)] };
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
      detail: `${checks} mix × pose comparisons: largest difference in the body's ${rig.bones.length - nAtt} bones ${maxBone}; ${swaps} basic / Golden / Ember swaps over ${frames} frames of the four animations: ${mismatches} frames showed a stale or missing part, ${timingDiffs} frames differed in time, phase, draw order or bones` });
  }

  // ---- B4: joints covered, sword gripped, the composite cell holds every pose ----
  // quick run: always all-basic, the full Golden set with the sword without and with the helmet, the full Ember set
  // without and with the helmet, and the Ember coat over the Golden trousers (the two chains' pieces together); plus 14
  // mixes picked at random (seeded)
  const named = [MIXES[0], GOLD_MIX, { ...GOLD_MIX, head: 'b_gold_helm' }, EMBER_MIX, { ...EMBER_MIX, head: 'b_gold_helm' },
    { ...GOLD_MIX, top: 'b_ember_top', back: null }].map(indexOf);
  const quick = (() => { const r = new Phaser.Math.RandomDataGenerator(['b4']), ids = r.shuffle([...MIXES.keys()].filter((i) => !named.includes(i))).slice(0, 14); return [...named, ...ids].sort((p, q) => p - q); })();
  const list = opts.full ? MIXES : quick.map((i) => MIXES[i]);
  if (want('B4')) {
  progress(`B4 ${list.length} mixes × 32 poses`);
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
          let gap = false, where = '';
          for (let dy = -rp; dy <= rp && !gap; dy += 1) for (let dx = -rp; dx <= rp; dx += 1) {
            if (dx * dx + dy * dy > rp * rp) continue;
            const x = Math.round(cx + dx), y = Math.round(cy + dy);
            if (opaque(x, y)) continue;
            if (!open[(y - y0) * n + (x - x0)] || (closed2(x, y) && !shallow(x, y))) {
              gap = true;
              // where: the gap pixel against the joint, and the joint's window (# opaque, . open background, o enclosed or crack)
              const rows: string[] = [];
              for (let j = 0; j < n; j++) { let r = ''; for (let i = 0; i < n; i++) { const xx = x0 + i, yy = y0 + j; r += xx === x && yy === y ? 'X' : opaque(xx, yy) ? '#' : open[j * n + i] && !(closed2(xx, yy) && !shallow(xx, yy)) ? '.' : 'o'; } rows.push(r); }
              where = ` at (${(x - cx).toFixed(1)}, ${(y - cy).toFixed(1)}) px from the joint: ${!open[(y - y0) * n + (x - x0)] ? 'enclosed' : 'crack'} | ${rows.join('/')}`;
              break;
            }
          }
          if (gap) { seamFails++; const k = `${label} ${bone.slice(-1)}`; seamBy[k] = (seamBy[k] ?? 0) + 1; if (samples.length < 40) samples.push({ mix: mixName(list[c]), anim: a.name, t, what: `gap at the ${label} (${bone})${where}` }); }
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
            // a hole is background enclosed by the fist and the handle; the fist's own outline (background reached from
            // around the hand, which the disc can touch at gameplay size) is not one
            const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < RW && y < RH && iso[(y * RW + x) * 4 + 3] >= 250;
            const win = Math.ceil(rg) + 4, n = 2 * win + 1, x0 = Math.round(gx) - win, y0 = Math.round(gy) - win;
            const outside = new Uint8Array(n * n), queue: number[] = [];
            for (let i = 0; i < n; i++) for (const [ii, jj] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) {
              if (!outside[jj * n + ii] && !solid(x0 + ii, y0 + jj)) { outside[jj * n + ii] = 1; queue.push(jj * n + ii); }
            }
            while (queue.length) {
              const k = queue.pop()!, ii = k % n, jj = (k - ii) / n;
              for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = ii + di, b = jj + dj;
                if (a < 0 || b < 0 || a >= n || b >= n || outside[b * n + a] || solid(x0 + a, y0 + b)) continue;
                outside[b * n + a] = 1; queue.push(b * n + a);
              }
            }
            for (let dy = -rg; dy <= rg && !bad; dy += 1) for (let dx = -rg; dx <= rg; dx += 1) {
              if (dx * dx + dy * dy > rg * rg) continue;
              const x = Math.round(gx + dx), y = Math.round(gy + dy);
              if (!solid(x, y) && !outside[(y - y0) * n + (x - x0)]) { bad = 'a hole in the fist at the grip'; break; }
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
    for (const mix of [{ ...GOLD_MIX, head: 'b_gold_helm' }, { top: 'b_basic_top', bottom: 'b_basic_bottom', shoes: 'b_basic_shoes', back: 'b_gold_cape', weapon: 'b_sun_sword' }, EMBER_MIX] as Mix[]) {
      ch.setAvatar(wardrobe.resolve(input(mix)));
      for (const [a, t] of dense) { poseAt(ch, a, t); reach(hz.render(ch, s, OX, OY, RW, RH, 'alpha'), 2); }
      await yieldFrame();
    }
    const tag = `${list.length} mixes × 32 poses = ${renders} renders at B = ${B} px`;
    results.push({ id: 'B4a', name: 'No gaps at any joint (every basic / Golden / Ember mix)', pass: seamFails === 0,
      detail: `${tag}; joint gaps: ${seamFails}${seamFails ? ` (${Object.entries(seamBy).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`, data: samples.filter((x) => x.what.startsWith('gap')).slice(0, 16) });
    results.push({ id: 'B4b', name: 'Sword held: the handle between the palm and the fingers', pass: gripFails === 0, detail: `${gripChecks} armed frames checked, ${gripFails} with the handle not held (drawn over the fingers or behind the palm layer, or a hole in the fist at the grip); ${gripHidden} with the grip behind the head or body (the attack's wind-up)`, data: samples.filter((x) => x.what.startsWith('handle')).slice(0, 8) });
    const fits = maxUp <= CELL.rootY - 0.02 && maxDown <= CELL.h - CELL.rootY - 0.02 && maxL <= CELL.rootX - 0.02 && maxR <= CELL.w - CELL.rootX - 0.02;
    results.push({ id: 'B4c', name: 'Composite cell holds every pose', pass: edgeHits === 0 && fits,
      detail: `reach from the feet, in B (every mix in its 32 poses, plus the sword, the cape and the Ember coat on every frame at 60 Hz): up ${maxUp.toFixed(2)}, down ${maxDown.toFixed(2)}, back ${maxL.toFixed(2)}, forward ${maxR.toFixed(2)}; the cell is ${CELL.w} × ${CELL.h} B with the feet at (${CELL.rootX}, ${CELL.rootY}) → ${fits ? 'fits' : 'does NOT fit'}; test-region edge hits ${edgeHits}` });
  }

  // ---- B5: the wardrobe preview (512 atlas) matches gameplay (256 atlas) ----
  if (want('B5')) {
  progress('B5 preview parity');
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
    for (const mix of [MIXES[0], GOLD_MIX, mixOf({ top: 'b_gold_top', shoes: 'b_gold_shoes', back: 'b_gold_cape' }), mixOf({ bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', weapon: null }), EMBER_MIX, mixOf({ top: 'b_ember_top', bottom: 'b_gold_bottom', shoes: 'b_gold_shoes', gloves: 'b_ember_gloves' })]) {
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
  if (want('B6')) {
  progress('B6 swap cost');
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

  // ---- B7: the optional hip attachment chains, for every item that hangs a piece on one ----
  // Each such item is checked in its home outfit (its own set, else the Golden set, with that item); every pair of items on different
  // chains is worn together. Front pieces (clearOf) must never end up behind the most forward thigh; later links must
  // not fold back on the link above; the chains must not affect each other or the body; and worn together, neither
  // piece may be hidden by the other.
  progress('B7 hip attachment chains');
  const gold: Mix = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape', weapon: 'b_sun_sword' };
  const ember: Mix = { top: 'b_ember_top', bottom: 'b_ember_bottom', gloves: 'b_ember_gloves', shoes: 'b_ember_shoes', weapon: 'b_sun_sword' };
  /** An item's home outfit: its own set (the Ember coat in the Ember set), else the Golden set, with the item. */
  const homeOf = (it: { id: string; wslot: WardrobeSlot; set: string }): Mix => ({ ...(it.set === 'C' ? ember : gold), [it.wslot]: it.id });
  const attItems = [...A.catalog.items.values()].filter((it) => it.attach?.length);
  const deg = (i: number) => pose.rotation(ch.state, i);
  const wrapD = (d: number) => d - 360 * Math.round(d / 360);
  const linksOf = (sp: AttachSpec) => rig.attach![sp.chain].map((n) => pose.index.get(n)!);
  /** One frame's checks of every piece the worn items hang: swing from rest, front pieces behind a thigh, folds. */
  const chainStats = () => ({ swing: 0, behind: 0, folds: 0, lifted: 0, maxBend: 0, frames: 0 });
  const checkFrame = (specs: AttachSpec[], st: ReturnType<typeof chainStats>) => {
    for (const sp of specs) {
      const [a1, a2] = linksOf(sp), w1 = deg(a1), rest1 = deg(pose.parent[a1]) + sp.rest;
      st.swing = Math.max(st.swing, Math.abs(wrapD(w1 - rest1)));
      const bend = Math.abs(wrapD(deg(a2) - w1)); st.maxBend = Math.max(st.maxBend, bend);
      if (bend > 75) st.folds++;
      if (sp.clearOf?.length) {
        const front = Math.min(...sp.clearOf.map((n) => deg(pose.index.get(n)!)));
        if (wrapD(w1 - (front + (sp.margin ?? 0))) > 0.01) st.behind++;
        if (front + (sp.margin ?? 0) < rest1 - 0.5) st.lifted++;
      }
    }
    st.frames++;
  };
  /** The four animations at 60 Hz with the chains stepped as in the lab (run speed, the attack's lunge, the jump). */
  const dense = (specs: AttachSpec[], st: ReturnType<typeof chainStats>, track?: number[]) => {
    for (const a of ANIM_LIST) {
      ch.chain.reset();
      const n = Math.round(a.dur * 60);
      for (let i = 0; i <= n; i++) {
        const t = i / 60, vz = a.name === 'jump' ? Math.max(-1, Math.min(1, 1 - (2 * (t - 0.08)) / 0.52)) : 0;
        const drive = i > 0 ? bodyDrive(a, (i - 1) / 60, t) : 0;
        if (i > 0) ch.chain.step(1 / 60, Math.max(-1, Math.min(1, (a.name === 'run' ? 0.9 : 0) + drive)), a.name === 'jump' && t > 0.08 && t < 0.6 ? vz : 0);
        ch.evaluate(a, Math.min(a.dur, t));
        checkFrame(specs, st);
        if (track) { for (const sp of specs) for (const l of linksOf(sp)) track.push(deg(l)); track.push(...Array.from(ch.state.world.subarray(0, bodyBones * 6))); }
      }
    }
  };
  const bodyBones = rig.bones.length - Object.values(rig.attach ?? {}).reduce((n, b) => n + b.length, 0);
  if (want('B7')) {
    const lines: string[] = [];
    let restDev = 0, pass = true;
    for (const it of attItems) {
      ch.setAvatar(wardrobe.resolve(input(homeOf(it))));
      // (a) at rest every link hangs at its rest angle (the approved idle silhouette for the Golden tabard)
      let dev = 0;
      for (const t of times(A.anims.idle, 8)) {
        poseAt(ch, A.anims.idle, t);
        for (const sp of it.attach!) { const [a1, a2] = linksOf(sp); dev = Math.max(dev, Math.abs(wrapD(deg(a1) - (deg(pose.parent[a1]) + sp.rest))), Math.abs(wrapD(deg(a2) - deg(a1)))); }
      }
      restDev = Math.max(restDev, dev);
      // (b) every frame of the four animations
      const st = chainStats(); dense(it.attach!, st);
      if (dev >= 0.5 || st.behind || st.folds) pass = false;
      const sp0 = it.attach![0];
      lines.push(`${it.name} (chain ${sp0.chain.slice(3)}, owner ${it.wslot}): at rest ${dev.toFixed(2)}° from its rest angle; over ${st.frames} frames largest swing ${st.swing.toFixed(1)}° (spring limit ${sp0.limit}°${sp0.clearOf ? ', plus the lift by a raised knee' : ''}), lower link bent up to ${st.maxBend.toFixed(1)}° against the upper (folds over 75°: ${st.folds})${sp0.clearOf ? `, lifted by a knee in ${st.lifted} frames, behind the most forward thigh in ${st.behind}` : ''}`);
    }
    // (c) independence: every pair of items on different chains (and different wardrobe slots) worn together; alone,
    // the other item's slot wears the basic piece
    const basicFor = (w: string): string | null => ({ top: 'b_basic_top', bottom: 'b_basic_bottom', shoes: 'b_basic_shoes' } as Record<string, string>)[w] ?? null;
    let coupled = 0, pairs = 0;
    for (const x of attItems) for (const y of attItems) {
      if (x === y || x.wslot === y.wslot || x.attach![0].chain === y.attach![0].chain) continue;
      const alone: Mix = { ...gold, [x.wslot]: x.id, [y.wslot]: basicFor(y.wslot) }, both: Mix = { ...alone, [y.wslot]: y.id };
      const run = (mix: Mix) => { ch.setAvatar(wardrobe.resolve(input(mix))); const tr: number[] = []; dense(x.attach!, chainStats(), tr); return tr; };
      const t0 = run(alone), t1 = run(both);
      for (let i = 0; i < t0.length; i++) coupled = Math.max(coupled, Math.abs(t0[i] - t1[i]));
      pairs++;
    }
    if (coupled >= 1e-9) pass = false;
    // (d) worn together, neither piece hides the other: each piece's visible share of its own pixels, with and without
    // the other item (32 poses, gameplay size; no cape, so only the two items and the body can cover them)
    let worstLoss = 0, worstWhat = '', hiddenPoses = 0, checked = 0;
    const share = (slot: number) => {
      const ids = hz.render(ch, s, OX, OY, RW, RH, 'ids');
      let vis = 0;
      for (let k = 0; k < RW * RH; k++) if (ids[k * 4 + 3] > 250 && idOf(ids[k * 4], ids[k * 4 + 1], ids[k * 4 + 2]) === slot) vis++;
      ch.layout(s); ch.isolate(new Set([slot])); ch.tintAll(0xffffff); hz.rt.clear(); hz.rt.draw(ch.container, OX, OY); ch.clearTint();
      const iso = hz.read(0, 0, RW, RH);
      let tot = 0;
      for (let k = 0; k < RW * RH; k++) if (iso[k * 4 + 3] > 127) tot++;
      return tot ? vis / tot : 1;
    };
    const sharesNote: string[] = [];
    let worstKeep = 1, worstKeepWhat = '', worstAvgKeep = 1, worstIdleKeep = 1;
    for (const x of attItems) for (const y of attItems) {
      if (x === y || x.wslot === y.wslot || x.attach![0].chain === y.attach![0].chain) continue;
      // every hung piece of x (its strip slots), with y's slot wearing the basic piece, then y
      const strips = rig.slots.map((sl, i) => [sl, i] as const).filter(([sl]) => sl.strip && x.parts.some((p) => p.slot === sl.name)).map(([, i]) => i);
      const alone: Mix = { ...gold, back: null, [x.wslot]: x.id, [y.wslot]: basicFor(y.wslot) }, both: Mix = { ...alone, [y.wslot]: y.id };
      for (const slot of strips) {
        let sumA = 0, sumB = 0, n = 0, idleA = 0, idleB = 0;
        for (const a of ANIM_LIST) for (const t of times(a, 8)) {
          ch.setAvatar(wardrobe.resolve(input(alone))); poseAt(ch, a, t); const sa = share(slot);
          ch.setAvatar(wardrobe.resolve(input(both))); poseAt(ch, a, t); const sb = share(slot);
          const loss = sa - sb;
          if (loss > worstLoss) { worstLoss = loss; worstWhat = `${rig.slots[slot].name} of ${x.name} with ${y.name}, ${a.name} at ${t.toFixed(3)} s`; }
          if (sa >= 0.1) { if (sb / sa < worstKeep) { worstKeep = sb / sa; worstKeepWhat = `${rig.slots[slot].name}, ${a.name} at ${t.toFixed(3)} s`; } if (sb === 0) hiddenPoses++; }
          if (a === A.anims.idle) { idleA += sa; idleB += sb; }
          sumA += sa; sumB += sb; n++; checked++;
        }
        if (sumA > 0) worstAvgKeep = Math.min(worstAvgKeep, sumB / sumA);
        if (idleA > 0) worstIdleKeep = Math.min(worstIdleKeep, idleB / idleA);
        sharesNote.push(`${rig.slots[slot].name} (${x.name}): ${(100 * sumA / n).toFixed(0)}% visible alone, ${(100 * sumB / n).toFixed(0)}% with ${y.name}`);
        await yieldFrame();
      }
    }
    // worn together, no piece is ever fully hidden; over the four animations each keeps at least 70% of what it shows
    // alone, and at rest at least 80% (a sash end swinging over a tabard in a run is cloth doing what cloth does)
    if (hiddenPoses > 0 || worstAvgKeep < 0.7 || worstIdleKeep < 0.8) pass = false;
    ch.setAvatar(wardrobe.resolve(input(gold)));
    results.push({ id: 'B7', name: 'Hip attachment chains: every hung piece swings on its own chain', pass,
      detail: `${lines.join('; ')}. ${pairs} item pairs on different chains worn together: one changes the other's motion and the body's ${bodyBones} bones by ${coupled.toExponential(1)}. Visibility (${checked} piece × pose checks, gameplay size, no cape): ${sharesNote.join('; ')}; worn together each piece keeps at least ${(100 * worstAvgKeep).toFixed(0)}% of what it shows alone over the four animations and ${(100 * worstIdleKeep).toFixed(0)}% at rest (lowest single pose ${(100 * worstKeep).toFixed(0)}%: ${worstKeepWhat}); the most the other item hides is ${(100 * worstLoss).toFixed(1)}% of a piece${worstWhat ? ` (${worstWhat})` : ''}; poses with a piece fully hidden: ${hiddenPoses}` });
  }

  // ---- B8: extreme poses and a spring stress run ----
  // Held poses well past the four animations (a knee raised to the hip, a deep lunge, a crouch, a back kick, a split,
  // the hips tipped forward and back), and a run → sudden stop → jump → attack sequence with the springs carried over.
  // Front pieces must stay in front of the most forward thigh, lower links must not fold, and the springs stay within
  // their limits. Every item that hangs a piece, in its home outfit.
  if (want('B8')) {
  progress('B8 extreme poses');
    const S = STANCE_B, ROT = ['hip', 'chest', 'head', 'uparm_F', 'forearm_F', 'hand_F', 'weapon', 'uparm_B', 'forearm_B', 'hand_B', 'thigh_F', 'shin_F', 'foot_F', 'thigh_B', 'shin_B', 'foot_B'];
    const still = (name: string, d: Record<string, number>, dy = 0): AnimDef => ({
      name, dur: 1, loop: true,
      bones: { ...Object.fromEntries(ROT.map((b) => [b, { r: hold((S[b] ?? 0) + (d[b] ?? 0)) }])), hip: { x: hold(S.dx), y: hold(S.dy + dy), r: hold(S.hip + (d.hip ?? 0)) } },
    });
    const EXTREMES: AnimDef[] = [
      still('far knee to the hip', { thigh_F: -95, shin_F: 105 }, 0.02),
      still('near knee to the hip', { thigh_B: -110, shin_B: 110 }, 0.02),
      still('deep lunge', { thigh_F: -60, shin_F: 40, thigh_B: 40, shin_B: 25 }, 0.06),
      still('crouch', { thigh_F: -80, shin_F: 125, thigh_B: -65, shin_B: 120, chest: 10 }, 0.13),
      still('back kick', { thigh_B: 75, shin_B: 60 }),
      still('split', { thigh_F: -75, shin_F: 10, thigh_B: 65, shin_B: 10 }, 0.09),
      still('hips tipped forward', { hip: 25, chest: -20, thigh_F: -25, thigh_B: -25 }),
      still('hips tipped back', { hip: -25, chest: 20, thigh_F: 25, thigh_B: 25 }),
    ];
    const lines: string[] = [];
    let pass = true;
    for (const it of attItems) {
      ch.setAvatar(wardrobe.resolve(input(homeOf(it))));
      const st = chainStats();
      for (const e of EXTREMES) {
        // settle from a run into the held pose (the springs come in moving), then hold it for a second
        ch.chain.reset();
        for (let i = 0; i < 30; i++) ch.chain.step(1 / 60, 0.9, 0);
        for (let i = 0; i < 60; i++) { ch.chain.step(1 / 60, 0, 0); ch.evaluate(e, i / 60); checkFrame(it.attach!, st); }
      }
      // run → sudden stop → jump → attack, springs carried over
      ch.chain.reset();
      const seq: [AnimDef, number, number][] = [[A.anims.run, 1.0, 0.9], [A.anims.idle, 0.5, 0], [A.anims.jump, A.anims.jump.dur, 0], [A.anims.attack, A.anims.attack.dur, 0]];
      for (const [a, dur, vx] of seq) for (let i = 0; i <= Math.round(dur * 60); i++) {
        const t = i / 60, vz = a.name === 'jump' && t > 0.08 && t < 0.6 ? Math.max(-1, Math.min(1, 1 - (2 * (t - 0.08)) / 0.52)) : 0;
        ch.chain.step(1 / 60, Math.max(-1, Math.min(1, vx + (i > 0 ? bodyDrive(a, (i - 1) / 60, t) : 0))), vz);
        ch.evaluate(a, a.loop ? t : Math.min(a.dur, t)); checkFrame(it.attach!, st);
      }
      if (st.behind || st.folds) pass = false;
      const sp0 = it.attach![0];
      lines.push(`${it.name}: ${st.frames} frames (${EXTREMES.length} held poses, then the sequence): largest swing ${st.swing.toFixed(1)}°, lower link bent up to ${st.maxBend.toFixed(1)}° (folds over 75°: ${st.folds})${sp0.clearOf ? `, behind the most forward thigh in ${st.behind}` : ''}`);
    }
    ch.setAvatar(wardrobe.resolve(input(gold)));
    results.push({ id: 'B8', name: 'Extreme poses and a spring stress run', pass, detail: `${EXTREMES.map((e) => e.name).join(', ')}. ${lines.join('; ')}` });
  }

  hz.dispose(); ch.destroy(); ch512.destroy();
  progress('done');
  return results;
}
