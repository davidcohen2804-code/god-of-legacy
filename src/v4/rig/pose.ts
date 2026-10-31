// Rig evaluation: bone curves → world transforms, corrective swaps, draw order, events; spring chains for the cape
// and long hair. Pure TypeScript (no Phaser): the same numbers whatever the outfit.
import type { AnimDef, Key, RigDef, SwapKey } from './types';

const D2R = Math.PI / 180;

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

export interface PoseState {
  /** 6 numbers per bone (a, b, c, d, tx, ty), rig units: x' = a·x + c·y + tx, y' = b·x + d·y + ty. */
  world: Float64Array;
  swaps: Record<string, string>;
  /** Slot indices, back to front. */
  order: number[];
  orderId: string;
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
  }

  newState(): PoseState {
    const swaps: Record<string, string> = {};
    for (const [ch, vals] of Object.entries(this.rig.channels)) swaps[ch] = vals[0];
    return { world: new Float64Array(this.n * 6), swaps, order: this.defaultOrder, orderId: '' };
  }

  /** Evaluate `anim` at `t` seconds (looping animations wrap). `chain` adds the spring offsets of the cape / hair. */
  evaluate(anim: AnimDef, t: number, out: PoseState, chain?: ChainSim): void {
    const tt = anim.loop ? ((t % anim.dur) + anim.dur) % anim.dur : Math.max(0, Math.min(anim.dur, t));
    const B = this.rig.B, w = out.world;
    for (let i = 0; i < this.n; i++) {
      const b = this.rig.bones[i], tl = anim.bones[b.name];
      const rot = (b.r + (tl ? sample(tl.r, tt) : 0) + (chain ? chain.offset(i) : 0)) * D2R;
      const lx = (b.x + (tl ? sample(tl.x, tt) : 0)) * B, ly = (b.y + (tl ? sample(tl.y, tt) : 0)) * B;
      const la = Math.cos(rot), lb = Math.sin(rot), lc = -lb, ld = la;
      const p = this.parent[i], o = i * 6;
      if (p < 0) { w[o] = la; w[o + 1] = lb; w[o + 2] = lc; w[o + 3] = ld; w[o + 4] = lx; w[o + 5] = ly; continue; }
      const q = p * 6, pa = w[q], pb = w[q + 1], pc = w[q + 2], pd = w[q + 3];
      w[o] = pa * la + pc * lb; w[o + 1] = pb * la + pd * lb;
      w[o + 2] = pa * lc + pc * ld; w[o + 3] = pb * lc + pd * ld;
      w[o + 4] = pa * lx + pc * ly + w[q + 4]; w[o + 5] = pb * lx + pd * ly + w[q + 5];
    }
    for (const [ch, vals] of Object.entries(this.rig.channels)) out.swaps[ch] = swapAt(anim.swaps?.[ch], tt, vals[0]);
    let key: { move: string; before: string | null } | null = null;
    for (const ok of anim.order ?? []) { if (ok.t <= tt) key = ok; else break; }
    const id = key && key.before ? `${key.move}>${key.before}` : '';
    if (id !== out.orderId) { out.order = id ? this.moved(key!.move, key!.before!) : this.defaultOrder; out.orderId = id; }
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

  reset(): void { this.off.fill(0); this.vel.fill(0); }

  /** `vxN`: forward speed, −1..1 (facing direction); `vzN`: vertical speed, −1..1 (up = +). */
  step(dt: number, vxN: number, vzN: number): void {
    const h = Math.min(dt, 1 / 30);
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
