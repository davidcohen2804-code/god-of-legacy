// Automated lab tests (proposal 12.3 / Phase 1 brief): motion independence, atomic swaps, timing, every set
// combination (joint seams, face, grip, hair under helmets, cell bounds), item collisions, envelopes, preview parity,
// weapon family, gameplay stats, zoom sizes, and adding an item without touching animation data.
import Phaser from 'phaser';
import { gearStats, starterGear } from '../../items/Gear';
import { buildAtlas, Painter } from '../art/painter';
import { ANIMS } from '../rig/anims';
import { RigPose } from '../rig/pose';
import { GOLDEN_RIG } from '../rig/rig';
import type { AnimDef } from '../rig/types';
import { RigCharacter, type Atlas } from '../render/RigCharacter';
import { WEARABLE, Wardrobe, frameOf } from '../wardrobe/resolve';
import type { AppearanceInput, Avatar, Item, WardrobeSlot } from '../wardrobe/types';
import { gearLooks, type LabScene } from './LabScene';
import { CELL, MASTER_B, SCREEN_720, SIZE_B, ZOOM0, ZOOM_PRESETS } from './world';

export interface TestResult { id: string; name: string; pass: boolean; detail: string; data?: unknown }
type Progress = (msg: string) => void;

const ANIM_LIST: AnimDef[] = [ANIMS.idle, ANIMS.run, ANIMS.jump, ANIMS.attack];
const COMBO_SLOTS: WardrobeSlot[] = ['head', 'eyeacc', 'faceacc', 'earring', 'top', 'bottom', 'gloves', 'shoes', 'back', 'weapon'];
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

/** Slot index ↔ a flat colour whose three channels follow different rules, so an anti-aliased blend of two slot
 *  colours (at an edge) almost never decodes as a third slot. */
const code = (i: number): [number, number, number] => [(i * 4) & 255, (i * 37 + 11) & 255, (i * 101 + 17) & 255];
const idColor = (i: number) => { const [r, g, b] = code(i); return (r << 16) | (g << 8) | b; };
const idOf = (r: number, g: number, b: number) => {
  const i = Math.round(r / 4);
  if (i < 0 || i >= 64) return -1;
  const [cr, cg, cb] = code(i);
  return Math.abs(r - cr) <= 1 && Math.abs(g - cg) <= 1 && Math.abs(b - cb) <= 1 ? i : -1;
};

class Harness {
  readonly gl: WebGLRenderingContext;
  readonly rt: Phaser.Textures.DynamicTexture;
  flipRows = true;

  /** One render texture per size: the renderer's capture target is resized whenever the size changes. */
  constructor(readonly scene: LabScene, key: string, readonly W: number, readonly H: number) {
    const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    this.gl = r.gl;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.rt = scene.textures.addDynamicTexture(key, W, H)!;
    this.calibrate();
  }

  dispose(): void { if (this.scene.textures.exists(this.rt.key)) this.scene.textures.remove(this.rt.key); }

  /** Which way the render texture's rows come back: draw a block at the top and look for it. */
  private calibrate(): void {
    const g = this.scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8);
    this.rt.clear(); this.rt.draw(g, 0, 0); g.destroy();
    const px = this.read(0, 0, 8, this.H, false);
    const topRow = px[3] > 128, bottomRow = px[(this.H - 1) * 8 * 4 + 3] > 128;
    this.flipRows = !topRow && bottomRow;
  }

  /** Read a region (top-left origin) as RGBA rows, top row first. */
  read(x: number, y: number, w: number, h: number, orient = true): Uint8Array {
    const r = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer, gl = this.gl;
    const fb = (this.rt.renderTarget!.framebuffer as unknown as { webGLFramebuffer: WebGLFramebuffer }).webGLFramebuffer;
    r.flush();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const out = new Uint8Array(w * h * 4);
    const gy = orient && this.flipRows ? this.H - y - h : y;
    gl.readPixels(x, gy, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
    const cur = (r as unknown as { currentFramebuffer: { webGLFramebuffer: WebGLFramebuffer } | null }).currentFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, cur ? cur.webGLFramebuffer : null);
    if (orient && this.flipRows) { // GL rows are bottom-up: reverse them
      const row = w * 4, tmp = new Uint8Array(row);
      for (let i = 0; i < h / 2; i++) { const a = i * row, b = (h - 1 - i) * row; tmp.set(out.subarray(a, a + row)); out.copyWithin(a, b, b + row); out.set(tmp, b); }
    }
    return out;
  }

  /** Render a character with its root at (ox, oy); returns the w × h region from (0, 0). */
  render(ch: RigCharacter, s: number, ox: number, oy: number, w: number, h: number, mode: 'color' | 'ids' | 'alpha'): Uint8Array {
    ch.layout(s);
    if (mode === 'ids') ch.tintBySlot(idColor);
    else if (mode === 'alpha') ch.tintAll(0xffffff);
    this.rt.clear();
    this.rt.draw(ch.container, ox, oy);
    if (mode !== 'color') ch.clearTint();
    return this.read(0, 0, w, h);
  }
}

/** Every combination of set A / set B over the ten wearable slots, with both hairstyles: 2^10 × 2 = 2048. */
function combos(items: Map<string, Item>): Partial<Record<WardrobeSlot, string>>[] {
  const pick = (slot: WardrobeSlot, set: 'A' | 'B') => [...items.values()].find((i) => i.wslot === slot && i.set === set)!.id;
  const out: Partial<Record<WardrobeSlot, string>>[] = [];
  for (let m = 0; m < 1 << COMBO_SLOTS.length; m++) for (const hair of ['hair_short', 'hair_long']) {
    const eq: Partial<Record<WardrobeSlot, string>> = { hair };
    COMBO_SLOTS.forEach((s, j) => { eq[s] = pick(s, (m >> j) & 1 ? 'B' : 'A'); });
    out.push(eq);
  }
  return out;
}

function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
const rigHash = () => hash(JSON.stringify({ rig: GOLDEN_RIG, anims: ANIM_LIST }));

export async function runTests(scene: LabScene, opts: { full: boolean }, progress: Progress = () => {}): Promise<TestResult[]> {
  const A = scene.assets, pose = A.pose, wardrobe = A.wardrobe, results: TestResult[] = [];
  const ch = new RigCharacter(scene, pose, A.atlas256, false);
  const ch512 = new RigCharacter(scene, pose, A.atlas512, false);
  const B = 150, s = B / MASTER_B; // gameplay size: B = 150 canvas px (×1.12, courtyard zoom)
  const OX = Math.round(B * 1.3), OY = Math.round(B * 2.3 * 0.86), RW = Math.ceil(B * 2.6), RH = Math.ceil(B * 2.3);
  const hz = new Harness(scene, 'v4testG', RW, RH);
  const base = (eq: Partial<Record<WardrobeSlot, string>>, gear = starterGear()): AppearanceInput => ({
    body: 'male_std', look: { hair: eq.hair ?? 'hair_short', face: 'face_a' }, gearLooks: gearLooks(gear), cosmetics: { equipped: eq, hidden: [] }, family: 'sword',
  });
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
  const t0 = performance.now();

  // ---- M1: motion never depends on the outfit ----
  progress('M1 motion independence');
  {
    const outfits = [{}, ...Array.from({ length: 40 }, () => scene.randomLook(true))];
    let maxBone = 0, maxBody = 0, checks = 0;
    const bodySlots = GOLDEN_RIG.slots.map((sl, i) => (sl.owner === 'body' ? i : -1)).filter((i) => i >= 0);
    for (const a of ANIM_LIST) for (const t of times(a, 8)) {
      let ref: Float64Array | null = null, refBody: number[] | null = null;
      for (const eq of outfits) {
        ch.setAvatar(wardrobe.resolve(base(eq)));
        poseAt(ch, a, t);
        ch.layout(s);
        const body = bodySlots.flatMap((i) => [ch.images[i].x, ch.images[i].y, ch.images[i].rotation]);
        if (!ref) { ref = new Float64Array(ch.state.world); refBody = body; continue; }
        for (let i = 0; i < ref.length; i++) maxBone = Math.max(maxBone, Math.abs(ref[i] - ch.state.world[i]));
        for (let i = 0; i < body.length; i++) maxBody = Math.max(maxBody, Math.abs(refBody![i] - body[i]));
        checks++;
      }
    }
    results.push({ id: 'M1', name: 'Motion never depends on the outfit', pass: maxBone === 0 && maxBody === 0,
      detail: `${checks} outfit × pose comparisons over 4 animations: largest bone difference ${maxBone}, largest body-part placement difference ${maxBody}` });
  }

  // ---- M2 + M4: swaps during animation are atomic and leave the clock alone ----
  progress('M2/M4 swaps during animation');
  {
    let frames = 0, swaps = 0, mismatches = 0, timingDiffs = 0;
    const rng = new Phaser.Math.RandomDataGenerator(['m2']);
    const slots = [...WEARABLE.filter((x) => x !== 'overall'), 'hair'] as WardrobeSlot[];
    for (const a of ANIM_LIST) {
      const run = (withSwaps: boolean) => {
        const log: string[] = [];
        let eq: Partial<Record<WardrobeSlot, string>> = {};
        ch.chain.reset();
        ch.setAvatar(wardrobe.resolve(base(eq)));
        for (let f = 0; f < 180; f++) {
          const t = f / 60, tt = a.loop ? t : t % a.dur;
          if (withSwaps && f % 5 === 2) {
            const slot = slots[rng.between(0, slots.length - 1)];
            const opts = [null, ...[...A.catalog.items.values()].filter((i) => i.wslot === slot).map((i) => i.id)];
            eq = { ...eq }; const id = opts[rng.between(0, opts.length - 1)];
            if (id) eq[slot] = id; else delete eq[slot];
            ch.setAvatar(wardrobe.resolve(base(eq))); swaps++;
          }
          ch.chain.step(1 / 60, 0, 0);
          ch.evaluate(a, tt);
          ch.layout(s);
          frames++;
          // what the avatar says must be on screen this very frame
          const av = ch.avatar!;
          for (let i = 0; i < GOLDEN_RIG.slots.length; i++) {
            const p = av.parts[i], want = p ? frameOf(p, GOLDEN_RIG.slots[i], ch.state.swaps, av.unarmed) : undefined;
            const img = ch.images[i], got = img.visible ? img.frame.name : undefined;
            if ((want ?? null) !== (got ?? null)) mismatches++;
          }
          log.push(`${tt.toFixed(4)}|${ch.state.orderId}|${Object.values(ch.state.swaps).join(',')}|${Array.from(ch.state.world.subarray(0, 12)).map((v) => v.toFixed(6)).join(',')}`);
        }
        return log;
      };
      const plain = run(false), swapped = run(true);
      for (let i = 0; i < plain.length; i++) if (plain[i] !== swapped[i]) timingDiffs++;
    }
    results.push({ id: 'M2', name: 'Swaps during Idle, Run, Jump and Attack are atomic', pass: mismatches === 0,
      detail: `${swaps} swaps over ${frames} frames: ${mismatches} frames showed a part different from the new look (missing, stale or wrong variant)` });
    results.push({ id: 'M4', name: 'Swaps never change animation time, phase, draw order or bones', pass: timingDiffs === 0,
      detail: `frame-by-frame log with and without swaps: ${timingDiffs} differing frames out of ${frames / 2}` });
  }

  // ---- M3: swap cost ----
  progress('M3 swap cost');
  {
    const ms: number[] = [];
    for (let i = 0; i < 600; i++) {
      const eq = scene.randomLook(true);
      const t = performance.now();
      ch.setAvatar(wardrobe.resolve(base(eq)));
      ch.layout(s);
      ms.push(performance.now() - t);
    }
    ms.sort((p, q) => p - q);
    const mean = ms.reduce((p, q) => p + q, 0) / ms.length;
    results.push({ id: 'M3', name: 'Swap cost (resolve + place parts)', pass: ms[Math.floor(ms.length * 0.95)] < 16,
      detail: `600 random full-outfit swaps: mean ${mean.toFixed(3)} ms, 95th percentile ${ms[Math.floor(ms.length * 0.95)].toFixed(3)} ms, max ${ms[ms.length - 1].toFixed(3)} ms (CPU; art preloaded)` });
  }

  // ---- M5: every A/B combination in every sampled pose ----
  const all = combos(A.catalog.items);
  const shuffled = [...all.keys()]; { const r = new Phaser.Math.RandomDataGenerator(['m5']); for (let i = shuffled.length - 1; i > 0; i--) { const j = r.between(0, i); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } }
  const list = opts.full ? all : shuffled.slice(0, 128).sort((p, q) => p - q).map((i) => all[i]);
  progress(`M5 ${list.length} combinations × 32 poses`);
  {
    const joints: [string, number][] = [['uparm_F', 0.6 * 0.032], ['uparm_B', 0.6 * 0.032], ['forearm_F', 0.6 * 0.028], ['forearm_B', 0.6 * 0.028],
      ['hand_F', 0.5 * 0.026], ['hand_B', 0.5 * 0.026], ['thigh_F', 0.6 * 0.042], ['thigh_B', 0.6 * 0.042], ['shin_F', 0.6 * 0.033], ['shin_B', 0.6 * 0.033],
      ['foot_F', 0.5 * 0.033], ['foot_B', 0.5 * 0.033], ['chest', 0.05], ['head', 0.025]];
    const forbiddenFace = (name: string) => /^(cape|wing|hair\.(back|chain|front_low|top))|^head\.ear|^torso|^hip/.test(name);
    const gripSlots = new Set(['hand_F.front.skin', 'hand_F.front.glove'].map((n) => pose.slotIndex.get(n)!));
    const hairSlots = new Set(GOLDEN_RIG.slots.map((sl, i) => (sl.owner === 'hair' ? i : -1)).filter((i) => i >= 0));
    let renders = 0, seamFails = 0, faceFails = 0, gripChecks = 0, gripFails = 0, hairFails = 0, edgeHits = 0;
    const faceBy: Record<string, number> = {}, seamBy: Record<string, number> = {};
    let maxUp = 0, maxDown = 0, maxL = 0, maxR = 0;
    const samples: { combo: number; anim: string; t: number; what: string }[] = [];
    const poses: [AnimDef, number][] = ANIM_LIST.flatMap((a) => times(a, 8).map((t) => [a, t] as [AnimDef, number]));
    for (let c = 0; c < list.length; c++) {
      const av = wardrobe.resolve(base(list[c]));
      ch.setAvatar(av);
      for (const [a, t] of poses) {
        poseAt(ch, a, t);
        const px = hz.render(ch, s, OX, OY, RW, RH, 'ids');
        renders++;
        const at = (x: number, y: number) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= RW || yi >= RH) return { a: 0, id: -1 }; const o = (yi * RW + xi) * 4; return { a: px[o + 3], id: px[o + 3] > 250 ? idOf(px[o], px[o + 1], px[o + 2]) : -1 }; };
        const P = (bone: string, x = 0, y = 0) => { const [wx, wy] = pose.point(ch.state, pose.index.get(bone)!, x * MASTER_B, y * MASTER_B); return [OX + wx * s, OY + wy * s]; };
        // a. joints: a disc around every pivot must be fully covered
        for (const [bone, r] of joints) {
          const [cx, cy] = P(bone), rp = Math.max(1.5, r * B);
          let gap = false;
          for (let dy = -rp; dy <= rp && !gap; dy += 1) for (let dx = -rp; dx <= rp; dx += 1) if (dx * dx + dy * dy <= rp * rp && at(cx + dx, cy + dy).a < 250) { gap = true; break; }
          if (gap) { seamFails++; seamBy[bone] = (seamBy[bone] ?? 0) + 1; if (samples.length < 40) samples.push({ combo: c, anim: a.name, t, what: `seam at ${bone}` }); }
        }
        // b. the eyes: never covered by back items, back hair, earrings, torso pieces
        for (const [ex, ey] of [[0.045, -0.15], [0.135, -0.15]]) {
          const [cx, cy] = P('head', ex, ey), hit = at(cx, cy);
          if (hit.id >= 0) { const nm = GOLDEN_RIG.slots[hit.id].name; if (forbiddenFace(nm)) { faceFails++; faceBy[nm] = (faceBy[nm] ?? 0) + 1; if (samples.length < 40) samples.push({ combo: c, anim: a.name, t, what: `eye covered by ${nm}` }); } }
        }
        // c. the grip: front fingers on top of the handle
        if (!av.unarmed && ch.state.swaps.handF === 'grip') {
          gripChecks++;
          const [gx, gy] = P('weapon');
          let ok = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!gripSlots.has(at(gx + dx, gy + dy).id)) ok = false;
          if (!ok) { gripFails++; if (samples.length < 40) samples.push({ combo: c, anim: a.name, t, what: 'handle not under the front fingers' }); }
        }
        // d. hair through a helmet: no hair pixel above the brow line inside the head's width
        if (av.items.head?.hairCover === 'helm' || av.items.head?.hairCover === 'full') {
          let n = 0; const hit = new Set<string>();
          for (let gy = 0; gy <= 6; gy++) for (let gx = 0; gx <= 14; gx++) {
            const [x, y] = P('head', -0.12 + (0.29 * gx) / 14, -0.41 + (0.11 * gy) / 6), id = at(x, y).id;
            if (hairSlots.has(id)) { n++; hit.add(`${GOLDEN_RIG.slots[id].name}@(${(-0.12 + (0.29 * gx) / 14).toFixed(3)},${(-0.41 + (0.11 * gy) / 6).toFixed(3)})`); }
          }
          if (n > 0) { hairFails++; if (samples.length < 40) samples.push({ combo: c, anim: a.name, t, what: `${n} hair samples showing on the helmet's skull area: ${[...hit].join(' ')} [${av.sig}]` }); }
        }
        // e. how far the drawing reaches from the feet (is the composite cell big enough?)
        for (let y = 0; y < RH; y += 3) for (let x = 0; x < RW; x += 3) if (px[(y * RW + x) * 4 + 3] > 8) {
          maxUp = Math.max(maxUp, (OY - y) / B); maxDown = Math.max(maxDown, (y - OY) / B); maxL = Math.max(maxL, (OX - x) / B); maxR = Math.max(maxR, (x - OX) / B);
        }
        for (let x = 0; x < RW; x++) if (px[x * 4 + 3] > 8 || px[((RH - 1) * RW + x) * 4 + 3] > 8) edgeHits++;
        for (let y = 0; y < RH; y++) if (px[(y * RW) * 4 + 3] > 8 || px[(y * RW + RW - 1) * 4 + 3] > 8) edgeHits++;
      }
      if (c % 8 === 7) { progress(`M5 ${c + 1}/${list.length}`); await yieldFrame(); }
    }
    // the oversized items and the longest weapon reach furthest: measure them on EVERY frame at 60 Hz (reach only),
    // since a sword tip's extreme can fall between the 8 sampled moments of an animation
    const dense: [AnimDef, number][] = ANIM_LIST.flatMap((a) => Array.from({ length: Math.round(a.dur * 60) + 1 }, (_, i) => [a, Math.min(a.dur, i / 60)] as [AnimDef, number]));
    for (const eq of [{ head: 'tall_hat_x', back: 'wings_x', top: 'heavy_plate_x', hair: 'hair_long' }, { overall: 'robe_x', head: 'great_helm_x', back: 'cape_b' }, { back: 'cape_b', weapon: 'sword_b', hair: 'hair_long' }] as Partial<Record<WardrobeSlot, string>>[]) {
      ch.setAvatar(wardrobe.resolve(base(eq)));
      for (const [a, t] of dense) {
        poseAt(ch, a, t);
        const px = hz.render(ch, s, OX, OY, RW, RH, 'alpha');
        for (let y = 0; y < RH; y += 2) for (let x = 0; x < RW; x += 2) if (px[(y * RW + x) * 4 + 3] > 8) {
          maxUp = Math.max(maxUp, (OY - y) / B); maxDown = Math.max(maxDown, (y - OY) / B); maxL = Math.max(maxL, (OX - x) / B); maxR = Math.max(maxR, (x - OX) / B);
        }
      }
    }
    const tag = `${list.length} outfits × 32 poses = ${renders} renders`;
    results.push({ id: 'M5a', name: 'No seams at any joint (every A/B mix)', pass: seamFails === 0, detail: `${tag}; joint gaps: ${seamFails}${seamFails ? ` (${Object.entries(seamBy).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`, data: samples.filter((x) => x.what.startsWith('seam')).slice(0, 12) });
    results.push({ id: 'M5b', name: 'Eyes never hidden by back items, hair or armour', pass: faceFails === 0, detail: `${tag}; eye samples covered: ${faceFails}${faceFails ? ` (${Object.entries(faceBy).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`, data: samples.filter((x) => x.what.startsWith('eye')).slice(0, 12) });
    results.push({ id: 'M5c', name: 'Sword gripped: front fingers over the handle', pass: gripFails === 0, detail: `${gripChecks} armed frames checked, ${gripFails} without the fingers on top` });
    results.push({ id: 'M5d', name: 'No hair through helmets', pass: hairFails === 0, detail: `${hairFails} frames with hair showing on the helmet's skull area (105 head-space samples above the brow per frame)`, data: samples.filter((x) => x.what.includes('helmet')).slice(0, 12) });
    const fits = maxUp <= CELL.rootY - 0.02 && maxDown <= CELL.h - CELL.rootY - 0.02 && maxL <= CELL.rootX - 0.02 && maxR <= CELL.w - CELL.rootX - 0.02;
    results.push({ id: 'M5e', name: 'Composite cell holds every pose', pass: edgeHits === 0 && fits, detail: `reach from the feet, in B (every mix in its 32 poses, plus the oversized items and the greatsword on every frame at 60 Hz): up ${maxUp.toFixed(2)}, down ${maxDown.toFixed(2)}, back ${maxL.toFixed(2)}, forward ${maxR.toFixed(2)}; the lab's cell is ${CELL.w} × ${CELL.h} B with the feet at (${CELL.rootX}, ${CELL.rootY}) → ${fits ? 'fits' : 'does NOT fit'}; test-region edge hits ${edgeHits}` });
  }

  // ---- collisions: every item pair from different slots, alone-vs-together, in every pose ----
  progress('Collisions between items');
  {
    const items = [...A.catalog.items.values()].filter((i) => i.set !== 'base' && !(i.wslot === 'weapon' && i.family !== 'sword'));
    const K = 3, b3 = B / K, s3 = b3 / MASTER_B, ox = Math.round(b3 * 1.3), oy = Math.round(b3 * 2.3 * 0.86), w3 = Math.ceil(b3 * 2.6), h3 = Math.ceil(b3 * 2.3);
    const poses: [AnimDef, number][] = ANIM_LIST.flatMap((a) => times(a, 6).map((t) => [a, t] as [AnimDef, number]));
    const words = Math.ceil((w3 * h3) / 32);
    const hz3 = new Harness(scene, 'v4test3', w3, h3);
    const masks = new Map<string, Uint32Array[]>();
    const onlyItem = (it: Item): Avatar => {
      const parts = GOLDEN_RIG.slots.map(() => null) as Avatar['parts'];
      for (const p of it.parts) { const i = pose.slotIndex.get(p.slot)!; parts[i] = { item: it.id, ...(p.frame ? { frame: p.frame } : {}), ...(p.variants ? { variants: p.variants } : {}) }; }
      return { items: { [it.wslot]: it }, parts, unarmed: false, notes: [], sig: it.id };
    };
    for (const it of items) {
      ch.setAvatar(onlyItem(it));
      const per: Uint32Array[] = [];
      for (const [a, t] of poses) {
        poseAt(ch, a, t);
        const px = hz3.render(ch, s3, ox, oy, w3, h3, 'alpha');
        const m = new Uint32Array(words);
        for (let i = 0; i < w3 * h3; i++) if (px[i * 4 + 3] > 128) m[i >> 5] |= 1 << (i & 31);
        per.push(m);
      }
      masks.set(it.id, per);
    }
    const pop = (v: number) => { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
    const pairs: { a: string; b: string; share: number; pose: string; pi: number }[] = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const ia = items[i], ib = items[j];
      if (ia.wslot === ib.wslot || ((ia.wslot === 'overall') && (ib.wslot === 'top' || ib.wslot === 'bottom')) || ((ib.wslot === 'overall') && (ia.wslot === 'top' || ia.wslot === 'bottom'))) continue;
      const ma = masks.get(ia.id)!, mb = masks.get(ib.id)!;
      let best = 0, at = 0;
      for (let p = 0; p < poses.length; p++) {
        let both = 0, na = 0, nb = 0;
        for (let k = 0; k < words; k++) { both += pop(ma[p][k] & mb[p][k]); na += pop(ma[p][k]); nb += pop(mb[p][k]); }
        const share = both / Math.max(1, Math.min(na, nb));
        if (share > best) { best = share; at = p; }
      }
      if (best > 0.02) pairs.push({ a: ia.id, b: ib.id, share: best, pose: `${poses[at][0].name} ${poses[at][1].toFixed(2)} s`, pi: at });
    }
    pairs.sort((p, q) => q.share - p.share);
    // Rules that say which item must be on top where two slots meet (11.4 seam classes); the rest are layered by the
    // fixed slot order or by the animation's draw-order keys and are listed for review.
    const rule = (a: Item, b: Item): { win: WardrobeSlot; groups: string[] | null } | null => {
      const pair = new Set([a.wslot, b.wslot]), has = (x: WardrobeSlot, y: WardrobeSlot) => pair.has(x) && pair.has(y);
      const other = (w: WardrobeSlot) => (a.wslot === w ? b : a);
      if (has('gloves', 'top') || has('gloves', 'overall')) return { win: 'gloves', groups: ['armF', 'armB'] }; // cuff over sleeve, on each arm
      if ((has('shoes', 'bottom') || has('shoes', 'overall')) && other('shoes').seams?.hem) return { win: 'shoes', groups: ['legF', 'legB'] }; // shaft over hem
      if (has('head', 'hair')) return { win: 'head', groups: null };
      if (has('top', 'bottom')) return { win: 'top', groups: null };
      return null;
    };
    const restrict = (it: Item, groups: string[] | null): Item => (groups ? { ...it, parts: it.parts.filter((p) => groups.includes(GOLDEN_RIG.slots[pose.slotIndex.get(p.slot)!].group)) } : it);
    const ownerOf = (slotIdx: number) => GOLDEN_RIG.slots[slotIdx].owner;
    const hiddenBy = (a: Item, b: Item) => { // does the resolver hide one of the two when both are worn?
      const eq: Partial<Record<WardrobeSlot, string>> = { [a.wslot]: a.id, [b.wslot]: b.id };
      const av = wardrobe.resolve({ body: 'male_std', look: { hair: a.wslot === 'hair' ? a.id : b.wslot === 'hair' ? b.id : 'hair_short', face: 'face_a' }, gearLooks: {}, cosmetics: { equipped: eq, hidden: [] }, family: 'sword' });
      const shown = (it: Item) => av.parts.some((p) => p?.item === it.id);
      return !shown(a) || !shown(b) || a.parts.some((p) => !av.parts[pose.slotIndex.get(p.slot)!]) || b.parts.some((p) => !av.parts[pose.slotIndex.get(p.slot)!]);
    };
    const checked: string[] = [], wrongTop: string[] = [], review: string[] = [];
    /** The two items as the resolver shows them together (cover rules applied), optionally limited to one draw group. */
    const pairAvatar = (a: Item, b: Item, only: string | null, keep: Set<string>): Avatar => {
      const eq: Partial<Record<WardrobeSlot, string>> = { [a.wslot]: a.id, [b.wslot]: b.id };
      const av = wardrobe.resolve({ body: 'male_std', look: { hair: a.wslot === 'hair' ? a.id : b.wslot === 'hair' ? b.id : 'hair_short', face: 'face_a' }, gearLooks: {}, cosmetics: { equipped: eq, hidden: [] }, family: 'sword' });
      return { ...av, parts: av.parts.map((p, i) => (p && keep.has(p.item) && (!only || GOLDEN_RIG.slots[i].group === only) ? p : null)) };
    };
    for (const pr of pairs) {
      const a = A.catalog.items.get(pr.a)!, b = A.catalog.items.get(pr.b)!, r = rule(a, b);
      if (!r) { if (pr.share > 0.25 && !hiddenBy(a, b)) review.push(`${pr.a} × ${pr.b} ${(pr.share * 100).toFixed(0)}% (${pr.pose})`); continue; }
      let over = 0, won = 0;
      for (const g of r.groups ?? [null]) for (let pi = 0; pi < poses.length; pi++) { // each body region, every pose
        const [an, t] = poses[pi];
        const draw = (keep: string[], mode: 'alpha' | 'ids') => { ch.setAvatar(pairAvatar(a, b, g, new Set(keep))); poseAt(ch, an, t); return hz3.render(ch, s3, ox, oy, w3, h3, mode); };
        const pa = draw([a.id], 'alpha'), pb = draw([b.id], 'alpha'), px = draw([a.id, b.id], 'ids');
        for (let i = 0; i < w3 * h3; i++) {
          if (pa[i * 4 + 3] < 128 || pb[i * 4 + 3] < 128 || px[i * 4 + 3] < 250) continue;
          const id = idOf(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
          if (id < 0) continue;
          over++;
          if (ownerOf(id) === r.win || (r.win === 'top' && ownerOf(id) === 'overall')) won++;
        }
      }
      const share = over ? won / over : 1;
      const judged = over >= 30; // fewer overlapping px than that (at 1/3 scale) are edge pixels, not a meeting of two items
      checked.push(`${pr.a} × ${pr.b}: ${judged ? `${r.win} on top in ${(share * 100).toFixed(1)}% of ${over} overlap px` : `no real overlap (${over} px)`}${r.groups ? ` (${r.groups.join(', ')} separately)` : ''}`);
      if (judged && share < 0.95) wrongTop.push(`${pr.a} × ${pr.b} (${(share * 100).toFixed(0)}% ${r.win} on top)`);
    }
    hz3.dispose();
    results.push({ id: 'C1', name: 'Overlapping items layer as their seam rule says', pass: wrongTop.length === 0,
      detail: `${items.length} items, ${pairs.length} overlapping pairs over 24 poses; ${checked.length} pairs governed by a seam rule checked in all 24 poses (inside the body region the rule covers), ${wrongTop.length} layered against their rule${wrongTop.length ? `: ${wrongTop.join('; ')}` : ''}`,
      data: { checked, top: pairs.slice(0, 20).map((p) => `${p.a} × ${p.b} ${(p.share * 100).toFixed(0)}% (${p.pose})`) } });
    results.push({ id: 'C2', name: 'Large overlaps with no seam rule (for visual review)', pass: true,
      detail: `${review.length} pairs (not hidden by a cover rule) overlap more than 25% of the smaller item; the fixed slot order or the animation's draw-order keys layer them, and they need an eye check${review.length ? `: ${review.slice(0, 10).join('; ')}` : ''}`, data: review });
  }

  // ---- envelopes of the oversized items (rest pose) ----
  progress('Envelopes');
  {
    ch.setAvatar(wardrobe.resolve(base({})));
    poseAt(ch, ANIMS.idle, 0);
    const bodyAv: Avatar = { ...ch.avatar!, parts: ch.avatar!.parts.map((p, i) => (GOLDEN_RIG.slots[i].owner === 'body' ? p : null)) };
    const bbox = (av: Avatar) => {
      ch.setAvatar(av); poseAt(ch, ANIMS.idle, 0);
      const px = hz.render(ch, s, OX, OY, RW, RH, 'alpha');
      let x0 = RW, x1 = -1, y0 = RH, y1 = -1;
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (px[(y * RW + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0: (x0 - OX) / B, x1: (x1 - OX) / B, y0: (y0 - OY) / B, y1: (y1 - OY) / B };
    };
    const body = bbox(bodyAv);
    const rows: string[] = [];
    let fails = 0;
    const limits: Partial<Record<WardrobeSlot, { up?: number; side?: number; span?: number }>> = { head: { up: 0.35, side: 0.15 }, hair: { up: 0.25 }, top: { side: 0.12 }, overall: { side: 0.12 }, back: { up: 0.3, span: 1.2 } };
    for (const it of A.catalog.items.values()) {
      const lim = limits[it.wslot];
      if (!lim || it.set === 'base') continue;
      const parts = GOLDEN_RIG.slots.map(() => null) as Avatar['parts'];
      for (const p of it.parts) { const i = pose.slotIndex.get(p.slot)!; parts[i] = { item: it.id, ...(p.frame ? { frame: p.frame } : {}), ...(p.variants ? { variants: p.variants } : {}) }; }
      const bb = bbox({ items: {}, parts, unarmed: false, notes: [], sig: it.id });
      const up = Math.max(0, body.y0 - bb.y0), side = Math.max(0, bb.x1 - body.x1, body.x0 - bb.x0), span = bb.x1 - bb.x0;
      const bad = (lim.up !== undefined && up > lim.up) || (lim.side !== undefined && side > lim.side) || (lim.span !== undefined && span > lim.span);
      if (bad) fails++;
      rows.push(`${it.id}: up ${up.toFixed(2)}${lim.up !== undefined ? `/${lim.up}` : ''}, side ${side.toFixed(2)}${lim.side !== undefined ? `/${lim.side}` : ''}${lim.span !== undefined ? `, span ${span.toFixed(2)}/${lim.span}` : ''}${bad ? ' OVER' : ''}`);
    }
    results.push({ id: 'E1', name: 'Oversized-item envelopes checked', pass: true, detail: `${fails} item(s) over their slot limits (flagged for correctives or redesign, as the rules intend): ${rows.filter((r) => r.endsWith('OVER')).join('; ') || 'none'}`, data: rows });
  }

  // ---- M7: preview parity (512 atlas, 3×) against gameplay (256 atlas) ----
  progress('M7 preview parity');
  {
    const Bp = 450, sp = Bp / MASTER_B, OXp = Math.round(Bp * 1.3), OYp = Math.round(Bp * 2.3 * 0.86), RWp = Math.ceil(Bp * 2.6), RHp = Math.ceil(Bp * 2.3);
    const hzP = new Harness(scene, 'v4testP', RWp, RHp);
    let minIoU = 1, n = 0, slotDiff = 0;
    for (let k = 0; k < 8; k++) {
      const av = wardrobe.resolve(base(k === 0 ? {} : scene.randomLook(true)));
      ch.setAvatar(av); ch512.setAvatar(av);
      for (const a of ANIM_LIST) for (const t of times(a, 3)) {
        poseAt(ch, a, t); poseAt(ch512, a, t);
        const g = hz.render(ch, s, OX, OY, RW, RH, 'alpha');
        const p = hzP.render(ch512, sp, OXp, OYp, RWp, RHp, 'alpha');
        if (ch.drawn.join() !== ch512.drawn.join()) slotDiff++;
        let inter = 0, uni = 0;
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
          let acc = 0;
          for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const yy = y * 3 + j, xx = x * 3 + i; if (yy < RHp && xx < RWp) acc += p[(yy * RWp + xx) * 4 + 3]; }
          const ga = g[(y * RW + x) * 4 + 3] > 127, pa = acc / 9 > 127;
          if (ga && pa) inter++; if (ga || pa) uni++;
        }
        minIoU = Math.min(minIoU, inter / Math.max(1, uni)); n++;
      }
      await yieldFrame();
    }
    hzP.dispose();
    results.push({ id: 'M7', name: 'Wardrobe preview matches gameplay', pass: minIoU >= 0.97 && slotDiff === 0, detail: `${n} poses × looks: lowest silhouette overlap (IoU) ${minIoU.toFixed(4)} after scaling the 3× preview down; drawn-part lists differ in ${slotDiff}` });
  }

  // ---- M8: weapon family ----
  {
    const av = wardrobe.resolve(base({ weapon: 'bow_x' }));
    const ok = av.items.weapon?.id === 'sword_a' && av.notes.some((x) => x.includes('bow_x'));
    results.push({ id: 'M8', name: 'Wrong weapon family is never shown', pass: ok, detail: `cosmetic bow on a sword class → shown: ${av.items.weapon?.id ?? 'nothing'}; note: ${av.notes.find((x) => x.includes('bow_x')) ?? '—'}` });
  }

  // ---- M9: cosmetics never touch gameplay ----
  {
    const g = starterGear(), before = JSON.stringify(gearStats(g)), snapshot = JSON.stringify(g);
    let changed = 0;
    for (let i = 0; i < 300; i++) {
      const input = base(scene.randomLook(true), g);
      Object.freeze(input.cosmetics.equipped); Object.freeze(input.cosmetics); Object.freeze(input.gearLooks); Object.freeze(input);
      wardrobe.resolve(input);
      if (JSON.stringify(gearStats(g)) !== before || JSON.stringify(g) !== snapshot) changed++;
    }
    results.push({ id: 'M9', name: 'Cosmetics never change gameplay stats', pass: changed === 0, detail: `300 random cosmetic outfits resolved on frozen inputs: gearStats ${before} unchanged in ${300 - changed}/300; gear state untouched` });
  }

  // ---- M10: identity at every zoom preset ----
  {
    const rows: string[] = [];
    let worst = Infinity, worstAt = '';
    for (const [size, bw] of Object.entries(SIZE_B)) for (const [preset, z] of Object.entries(ZOOM_PRESETS)) {
      const b720 = bw * ZOOM0 * z * SCREEN_720;
      rows.push(`×${size} ${preset}: ${b720.toFixed(1)} px`);
      if (size === '1.12' && b720 < worst) { worst = b720; worstAt = preset; }
    }
    const x1Boss = SIZE_B['1'] * ZOOM0 * ZOOM_PRESETS.boss * SCREEN_720;
    results.push({ id: 'M10', name: 'Identity size at the widest zoom (720p window)', pass: worst >= 80,
      detail: `B (sole to skull) on a 720p screen at ×1.12: smallest ${worst.toFixed(1)} px (${worstAt}). Note: at ×1 with the boss preset it is ${x1Boss.toFixed(1)} px, under the 80 px limit.`, data: rows });
  }

  // ---- M6: a new item without touching animation data ----
  progress('M6 new item');
  {
    const before = rigHash();
    const p = new Painter().poly([-0.13, -0.03, 0.03, -0.03, 0.05, 0.2, -0.05, 0.28, -0.15, 0.2], { f: '#2e8b6e', s: '#1d5d49' }).line([-0.12, 0.05, 0.02, 0.05], '#e0b64c', 7);
    const p2 = new Painter().poly([-0.1, -0.02, 0.07, -0.02, 0.08, 0.15, -0.12, 0.15], { f: '#2e8b6e', s: '#1d5d49' });
    const art = new Map(A.catalog.art); art.set('banner_n/back1', p); art.set('banner_n/back2', p2);
    const { canvas, frames } = buildAtlas(art, 256);
    if (scene.textures.exists('v4atlasN')) scene.textures.remove('v4atlasN');
    const tex = scene.textures.addCanvas('v4atlasN', canvas)!;
    for (const f of frames) { const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!; fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py; }
    const items = new Map(A.catalog.items);
    items.set('banner_n', { id: 'banner_n', wslot: 'back', name: 'New test banner', set: 'X', bodies: ['male_std'], parts: [{ slot: 'cape.back.1', frame: 'banner_n/back1' }, { slot: 'cape.back.2', frame: 'banner_n/back2' }] });
    const w2 = new Wardrobe(GOLDEN_RIG, items, A.catalog.base);
    const atlasN: Atlas = { key: 'v4atlasN', unitsPerPx: MASTER_B / 256 };
    const cN = new RigCharacter(scene, new RigPose(GOLDEN_RIG), atlasN, false);
    cN.setAvatar(w2.resolve(base({ back: 'banner_n' })));
    let shown = 0;
    for (const a of ANIM_LIST) for (const t of times(a, 8)) { poseAt(cN, a, t); cN.layout(s); if (cN.drawn.some((i) => GOLDEN_RIG.slots[i].owner === 'back')) shown++; }
    cN.destroy();
    const after = rigHash();
    results.push({ id: 'M6', name: 'A new item needs no animation change', pass: before === after && shown === 32,
      detail: `added a two-part back banner (new art, atlas rebuilt): rig + animation hash ${before} → ${after}; drawn in ${shown}/32 sampled poses of all four animations` });
  }

  ch.destroy(); ch512.destroy(); hz.dispose();
  results.push({ id: 'T', name: 'Run time', pass: true, detail: `${((performance.now() - t0) / 1000).toFixed(1)} s (${opts.full ? 'full' : 'quick'} run)` });
  progress('done');
  return results;
}
