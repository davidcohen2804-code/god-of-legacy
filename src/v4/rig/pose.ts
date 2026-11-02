// Rig evaluation: bone curves → world transforms, corrective swaps, draw order, events; spring chains for the cape
// and long hair. Pure TypeScript (no Phaser): the same numbers whatever the outfit.
import type { AnimDef, AttachSpec, Key, RigDef, SwapKey } from './types';

const D2R = Math.PI / 180;
/** An angle in degrees brought into (−180, 180]. */
const wrap = (d: number) => d - 360 * Math.round(d / 360);

export function sample(keys: Key[] | undefined, t: number): number {
  if (!keys || keys.length === 0) return 0;
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[n - 1].t) return keys[n - 1].v;
  let i = 0;
  while (i < n - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1], span = b.t - a.t;
  let u = span > 0 ? (t - a.t) / span : 1;
  switch (a.e ?? 'inout') {
    case 'step': return a.v;
    case 'linear': break;
    case 'in': u = u * u; break;
    case 'out': u = 1 - (1 - u) * (1 - u); break;
    default: u = u * u * (3 - 2 * u);
  }
  return a.v + (b.v - a.v) * u;
}

function swapAt(keys: SwapKey[] | undefined, t: number, dflt: string): string {
  if (!keys) return dflt;
  let v = dflt;
  for (const k of keys) { if (k.t <= t) v = k.v; else break; }
  return v;
}

/** A bone of an attachment chain as the worn item set it up (RigDef.attach, AttachSpec). */
export interface AttachBone {
  x: number; y: number; r: number; len: number;
  /** Links after the first: the share of the link above's turn away from its rest angle that this link swings back. */
  hang: number;
  /** First link: bones it stays in front of (the most forward of them, plus `margin` degrees). */
  clear: Int16Array | null; margin: number;
  /** First link: the share of the parent's turn away from `ref` (its stance angle) that the link turns back. */
  grav: number; ref: number;
}

export interface PoseState {
  /** 6 numbers per bone (a, b, c, d, tx, ty), rig units: x' = a·x + c·y + tx, y' = b·x + d·y + ty. */
  world: Float64Array;
  swaps: Record<string, string>;
  /** Slot indices, back to front. */
  order: number[];
  orderId: string;
  /** Per bone: its attachment-chain set-up from the worn items (null = the rig's own bone values). */
  att: (AttachBone | null)[];
}

export interface ChainSpec { bones: string[]; k: number; c: number; gainV: number[]; gainZ: number[]; limit: number }

export class RigPose {
  readonly n: number;
  readonly index = new Map<string, number>();
  readonly parent: Int16Array;
  readonly restWorldRot: Float64Array;
  readonly slotIndex = new Map<string, number>();
  readonly groupSlots = new Map<string, number[]>();
  readonly defaultOrder: number[];
  private orderMemo = new Map<string, number[]>();
  /** Each bone's local rotation (degrees) and position from the last evaluation (the hold re-solves from them). */
  private readonly loc: Float64Array;
  private readonly below = new Map<string, Uint8Array>();

  constructor(readonly rig: RigDef) {
    this.n = rig.bones.length;
    this.parent = new Int16Array(this.n);
    this.restWorldRot = new Float64Array(this.n);
    rig.bones.forEach((b, i) => {
      this.index.set(b.name, i);
      const p = b.parent === null ? -1 : this.index.get(b.parent);
      if (p === undefined) throw new Error(`bone ${b.name}: parent ${b.parent} must come first`);
      this.parent[i] = p;
      this.restWorldRot[i] = (p >= 0 ? this.restWorldRot[p] : 0) + b.r;
    });
    rig.slots.forEach((s, i) => {
      if (!this.index.has(s.bone)) throw new Error(`slot ${s.name}: no bone ${s.bone}`);
      this.slotIndex.set(s.name, i);
      const g = this.groupSlots.get(s.group) ?? [];
      g.push(i); this.groupSlots.set(s.group, g);
    });
    this.defaultOrder = rig.slots.map((_, i) => i);
    this.loc = new Float64Array(this.n * 3);
  }

  newState(): PoseState {
    const swaps: Record<string, string> = {};
    for (const [ch, vals] of Object.entries(this.rig.channels)) swaps[ch] = vals[0];
    return { world: new Float64Array(this.n * 6), swaps, order: this.defaultOrder, orderId: '', att: new Array(this.n).fill(null) };
  }

  /** Set up the attachment chains the worn items use (the others go back to the rig's idle values). */
  attach(state: PoseState, specs: AttachSpec[]): void {
    state.att.fill(null);
    for (const sp of specs) {
      const names = this.rig.attach?.[sp.chain];
      if (!names) continue;
      const clear = sp.clearOf ? Int16Array.from(sp.clearOf.map((n) => this.index.get(n) ?? -1).filter((i) => i >= 0)) : null;
      names.forEach((name, j) => {
        const i = this.index.get(name);
        if (i === undefined) return;
        state.att[i] = {
          x: j === 0 ? sp.at[0] : sp.lens[j - 1], y: j === 0 ? sp.at[1] : 0, r: j === 0 ? sp.rest : 0,
          len: sp.lens[j] ?? sp.lens[sp.lens.length - 1], hang: j === 0 ? 0 : sp.hang ?? 0,
          clear: j === 0 ? clear : null, margin: sp.margin ?? 0,
          grav: j === 0 ? sp.gravity ?? 0 : 0, ref: this.rig.attachRef?.[sp.chain] ?? 0,
        };
      });
    }
  }

  /** A bone's rest rotation against its parent and its length, as the worn items set them up. */
  restR(state: PoseState, i: number): number { return state.att[i]?.r ?? this.rig.bones[i].r; }
  length(state: PoseState, i: number): number { return state.att[i]?.len ?? this.rig.bones[i].len; }

  /** Evaluate `anim` at `t` seconds (looping animations wrap). `chain` adds the spring offsets of the cape / hair. */
  /** Each bone's animated values (rotation, x, y: the deltas from rest) of `anim` at `t`: a snapshot to blend from
   *  when one animation hands over to another. The last value is 1 when the animation holds its weapon in both hands
   *  (blended like the rest, so a snapshot taken mid-fade carries how far the second hand was on). */
  localValues(anim: AnimDef, t: number, out?: Float64Array): Float64Array {
    const tt = anim.loop ? ((t % anim.dur) + anim.dur) % anim.dur : Math.max(0, Math.min(anim.dur, t));
    const v = out && out.length === this.n * 3 + 1 ? out : new Float64Array(this.n * 3 + 1);
    for (let i = 0; i < this.n; i++) {
      const tl = anim.bones[this.rig.bones[i].name];
      v[i * 3] = tl ? sample(tl.r, tt) : 0; v[i * 3 + 1] = tl ? sample(tl.x, tt) : 0; v[i * 3 + 2] = tl ? sample(tl.y, tt) : 0;
    }
    v[this.n * 3] = anim.hold ? 1 : 0;
    return v;
  }

  /** `from`: blend in from a snapshot (localValues) with weight w (0 = the snapshot, 1 = this animation). */
  evaluate(anim: AnimDef, t: number, out: PoseState, chain?: ChainSim, from?: { v: Float64Array; w: number }): void {
    const tt = anim.loop ? ((t % anim.dur) + anim.dur) % anim.dur : Math.max(0, Math.min(anim.dur, t));
    const B = this.rig.B, w = out.world;
    for (let i = 0; i < this.n; i++) {
      const b = this.rig.bones[i], tl = anim.bones[b.name], ab = out.att[i];
      let dr = tl ? sample(tl.r, tt) : 0, dx = tl ? sample(tl.x, tt) : 0, dy = tl ? sample(tl.y, tt) : 0;
      if (from && from.w < 1) {
        const f = from.v, k = from.w;
        let d = dr - f[i * 3]; d -= 360 * Math.round(d / 360);
        dr = f[i * 3] + d * k; dx = f[i * 3 + 1] + (dx - f[i * 3 + 1]) * k; dy = f[i * 3 + 2] + (dy - f[i * 3 + 2]) * k;
      }
      let deg = (ab ? ab.r : b.r) + dr + (chain ? chain.offset(i) : 0);
      const p = this.parent[i];
      if (ab && p >= 0) {
        // an attachment link: the first keeps some of its stance direction when the hips tip (gravity) and stays clear
        // of the given bones; later links swing back when the link above is pushed off its rest direction
        const pw = Math.atan2(w[p * 6 + 1], w[p * 6]) / D2R, pp = this.parent[p], pa = out.att[p];
        if (ab.grav) deg -= ab.grav * wrap(pw - ab.ref);
        if (ab.hang && pa && pp >= 0) { // the link above's rest direction: its parent's angle, its rest, its gravity
          const ppw = Math.atan2(w[pp * 6 + 1], w[pp * 6]) / D2R;
          const rest = ppw + pa.r - pa.grav * wrap(ppw - pa.ref);
          deg += ab.hang * wrap(rest - pw);
        }
        if (ab.clear && ab.clear.length) {
          let front = Infinity;
          for (const c of ab.clear) front = Math.min(front, Math.atan2(w[c * 6 + 1], w[c * 6]) / D2R);
          const over = wrap(pw + deg - (front + ab.margin));
          if (over > 0) deg -= over;
        }
      }
      const lx = ((ab ? ab.x : b.x) + dx) * B, ly = ((ab ? ab.y : b.y) + dy) * B;
      this.loc[i * 3] = deg; this.loc[i * 3 + 1] = lx; this.loc[i * 3 + 2] = ly;
      this.compose(w, i);
    }
    if (anim.hold) {
      // the second hand comes onto the weapon with the cross-fade when the animation before did not hold it
      const prev = from && from.w < 1 ? (from.v.length > this.n * 3 ? from.v[this.n * 3] : 0) : 1;
      this.hold(out, anim.hold, prev + (1 - prev) * (from && from.w < 1 ? from.w : 1));
    }
    for (const [ch, vals] of Object.entries(this.rig.channels)) out.swaps[ch] = swapAt(anim.swaps?.[ch], tt, vals[0]);
    let key: { move: string; before: string | null } | null = null;
    for (const ok of anim.order ?? []) { if (ok.t <= tt) key = ok; else break; }
    const id = key && key.before ? `${key.move}>${key.before}` : '';
    if (id !== out.orderId) { out.order = id ? this.moved(key!.move, key!.before!) : this.defaultOrder; out.orderId = id; }
  }

  /** A bone's world transform from its parent's and its local rotation and position (this.loc). */
  private compose(w: Float64Array, i: number): void {
    const rot = this.loc[i * 3] * D2R, lx = this.loc[i * 3 + 1], ly = this.loc[i * 3 + 2];
    const la = Math.cos(rot), lb = Math.sin(rot), lc = -lb, ld = la, p = this.parent[i], o = i * 6;
    if (p < 0) { w[o] = la; w[o + 1] = lb; w[o + 2] = lc; w[o + 3] = ld; w[o + 4] = lx; w[o + 5] = ly; return; }
    const q = p * 6, pa = w[q], pb = w[q + 1], pc = w[q + 2], pd = w[q + 3];
    w[o] = pa * la + pc * lb; w[o + 1] = pb * la + pd * lb;
    w[o + 2] = pa * lc + pc * ld; w[o + 3] = pb * lc + pd * ld;
    w[o + 4] = pa * lx + pc * ly + w[q + 4]; w[o + 5] = pb * lx + pd * ly + w[q + 5];
  }

  /** The second hand on the weapon (AnimDef.hold), with weight k (0 = the animation's own arm, 1 = on the weapon):
   *  two-bone IK from the shoulder to the wrist that puts the grip bone on the weapon's axis, the hand turned along
   *  the weapon, the elbow on the side the animation bends it. An out-of-reach target leaves the arm straight. */
  private hold(out: PoseState, h: NonNullable<AnimDef['hold']>, k: number): void {
    const w = out.world, I = (n: string) => this.index.get(n) ?? -1;
    const iu = I(h.arm[0]), iF = I(h.arm[1]), ih = I(h.arm[2]), ig = I(h.grip), iw = I(h.weapon);
    if (iu < 0 || iF < 0 || ih < 0 || ig < 0 || iw < 0 || k <= 0) return;
    const ang = (i: number) => Math.atan2(w[i * 6 + 1], w[i * 6]) / D2R;
    const L = this.loc, B = this.rig.B;
    // the target: the weapon's axis at `at`; the hand turned so its grip bone lies along the weapon
    const wa = ang(iw), tx = w[iw * 6 + 4] + w[iw * 6] * h.at * B, ty = w[iw * 6 + 5] + w[iw * 6 + 1] * h.at * B;
    const H = wa - L[ig * 3];
    const ch = Math.cos(H * D2R), sh = Math.sin(H * D2R), gx = L[ig * 3 + 1], gy = L[ig * 3 + 2];
    const wx = tx - (ch * gx - sh * gy), wy = ty - (sh * gx + ch * gy);
    // the shoulder stays; the upper arm and forearm reach the wrist (lengths as the bones place their children)
    const sx = w[iu * 6 + 4], sy = w[iu * 6 + 5];
    const L1 = Math.hypot(L[iF * 3 + 1], L[iF * 3 + 2]), L2 = Math.hypot(L[ih * 3 + 1], L[ih * 3 + 2]);
    let dx = wx - sx, dy = wy - sy, d = Math.hypot(dx, dy);
    const dmax = (L1 + L2) * 0.9999, dmin = Math.abs(L1 - L2) + 1e-6;
    if (d > dmax || d < dmin) { const s = (d > dmax ? dmax : dmin) / (d || 1); dx *= s; dy *= s; d *= s; }
    const phi = Math.atan2(dy, dx) / D2R, a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))) / D2R;
    // the elbow on the side the animation's own pose bends it
    const fu = ang(iu), side = wrap(fu - phi) >= 0 ? 1 : -1, u = phi + side * a;
    const ex = sx + L1 * Math.cos(u * D2R), ey = sy + L1 * Math.sin(u * D2R);
    const f = Math.atan2(sy + dy - ey, sx + dx - ex) / D2R;
    // world angles blended with the animation's own (k), back to local rotations, the arm and what hangs on it rebuilt
    const fF = ang(iF), fH = ang(ih);
    const U = fu + wrap(u - fu) * k, F = fF + wrap(f - fF) * k, Hk = fH + wrap(H - fH) * k;
    L[iu * 3] += wrap(U - fu); L[iF * 3] = F - U; L[ih * 3] = Hk - F;
    let mark = this.below.get(h.arm[0]);
    if (!mark) {
      mark = new Uint8Array(this.n); mark[iu] = 1;
      for (let j = iu + 1; j < this.n; j++) if (this.parent[j] >= 0 && mark[this.parent[j]]) mark[j] = 1;
      this.below.set(h.arm[0], mark);
    }
    for (let j = iu; j < this.n; j++) if (mark[j]) this.compose(w, j);
  }

  private members(ref: string): number[] {
    if (ref.startsWith('group:')) return this.groupSlots.get(ref.slice(6)) ?? [];
    const i = this.slotIndex.get(ref);
    return i === undefined ? [] : [i];
  }

  /** Default order with `move` (a slot or a group) drawn just before `before`. */
  private moved(move: string, before: string): number[] {
    const id = `${move}>${before}`, m = this.orderMemo.get(id);
    if (m) return m;
    const mv = this.members(move), target = this.members(before);
    const rest = this.defaultOrder.filter((i) => !mv.includes(i));
    const at = target.length ? rest.indexOf(target[0]) : -1;
    const res = at < 0 ? this.defaultOrder : [...rest.slice(0, at), ...mv, ...rest.slice(at)];
    this.orderMemo.set(id, res);
    return res;
  }

  /** World position (rig units) of a point given in a bone's space. */
  point(state: PoseState, bone: number, x = 0, y = 0): [number, number] {
    const w = state.world, o = bone * 6;
    return [w[o] * x + w[o + 2] * y + w[o + 4], w[o + 1] * x + w[o + 3] * y + w[o + 5]];
  }

  /** World rotation of a bone, degrees. */
  rotation(state: PoseState, bone: number): number {
    const w = state.world, o = bone * 6;
    return Math.atan2(w[o + 1], w[o]) / D2R;
  }
}

/** Events crossed when an animation clock moves from t0 to t1 (seconds; loops wrap). */
export function eventsBetween(anim: AnimDef, t0: number, t1: number): string[] {
  const ev = anim.events ?? [];
  if (!ev.length || t1 <= t0) return [];
  const out: string[] = [];
  if (!anim.loop) { for (const e of ev) if (e.t > t0 && e.t <= t1) out.push(e.name); return out; }
  const d = anim.dur;
  for (let c = Math.floor(t0 / d); c * d <= t1; c++) for (const e of ev) { const at = c * d + e.t; if (at > t0 && at <= t1) out.push(e.name); }
  return out;
}

/** The body's own forward speed in an animation (its hip x keys between two moments, B per second), scaled like the
 *  running speed (1.2 B/s = 1). Added to the gameplay speed when stepping the spring chains, so an attack's lunge throws
 *  the cape back and the step back lets it swing in. Looping animations hold the hips in place: 0. */
export function bodyDrive(anim: AnimDef, t0: number, t1: number): number {
  const keys = anim.bones.hip?.x;
  if (!keys || anim.loop || t1 <= t0) return 0;
  return Math.max(-1, Math.min(1, (sample(keys, t1) - sample(keys, t0)) / (t1 - t0) / 1.2));
}

/** Spring chains (cape, long hair): each link follows its parent with lag, pushed by the body's speed. Visual only and
 *  driven by motion alone, so every outfit sees the same chain. */
export class ChainSim {
  private readonly off: Float64Array;
  private readonly vel: Float64Array;
  private readonly links: { bone: number; k: number; c: number; gv: number; gz: number; limit: number }[] = [];

  constructor(pose: RigPose, specs: ChainSpec[]) {
    this.off = new Float64Array(pose.n);
    this.vel = new Float64Array(pose.n);
    for (const s of specs) s.bones.forEach((name, j) => {
      const bone = pose.index.get(name);
      if (bone === undefined) throw new Error(`chain bone ${name}`);
      this.links.push({ bone, k: s.k, c: s.c, gv: s.gainV[j] ?? 0, gz: s.gainZ[j] ?? 0, limit: s.limit });
    });
  }

  /** The attachment chains' links, with the springs of the items that use them (replacing the previous set). */
  private att: { bone: number; k: number; c: number; gv: number; gz: number; limit: number }[] = [];
  private attKey = '';

  setAttach(pose: RigPose, specs: AttachSpec[]): void {
    const key = JSON.stringify(specs);
    if (key === this.attKey) return;
    this.attKey = key;
    for (const l of this.att) { this.off[l.bone] = 0; this.vel[l.bone] = 0; }
    this.att = [];
    for (const s of specs) (pose.rig.attach?.[s.chain] ?? []).forEach((name, j) => {
      const bone = pose.index.get(name);
      if (bone !== undefined) this.att.push({ bone, k: s.k, c: s.c, gv: s.gainV[j] ?? 0, gz: s.gainZ[j] ?? 0, limit: s.limit });
    });
  }

  reset(): void { this.off.fill(0); this.vel.fill(0); }

  /** `vxN`: forward speed, −1..1 (facing direction); `vzN`: vertical speed, −1..1 (up = +). */
  step(dt: number, vxN: number, vzN: number): void {
    const h = Math.min(dt, 1 / 30);
    for (const l of this.att) {
      const target = l.gv * vxN + l.gz * vzN;
      const acc = l.k * (target - this.off[l.bone]) - l.c * this.vel[l.bone];
      this.vel[l.bone] += acc * h;
      this.off[l.bone] = Math.max(-l.limit, Math.min(l.limit, this.off[l.bone] + this.vel[l.bone] * h));
    }
    for (const l of this.links) {
      const target = l.gv * vxN + l.gz * vzN;
      const acc = l.k * (target - this.off[l.bone]) - l.c * this.vel[l.bone];
      this.vel[l.bone] += acc * h;
      this.off[l.bone] = Math.max(-l.limit, Math.min(l.limit, this.off[l.bone] + this.vel[l.bone] * h));
    }
  }

  offset(bone: number): number { return this.off[bone]; }
}

export const CHAINS: ChainSpec[] = [
  { bones: ['cape_1', 'cape_2', 'cape_3'], k: 120, c: 14, gainV: [38, 16, 10], gainZ: [-28, -16, -10], limit: 75 },
  { bones: ['hair_1', 'hair_2', 'hair_3'], k: 180, c: 18, gainV: [26, 12, 8], gainZ: [-20, -10, -8], limit: 60 },
];
