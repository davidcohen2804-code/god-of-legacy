// One rigged character: bone pose → part images in a Container. The same container is either drawn straight to the
// screen (direct mode) or into a cell of the shared composite texture (composite mode).
import Phaser from 'phaser';
import { CHAINS, ChainSim, RigPose, type PoseState } from '../rig/pose';
import type { AnimDef } from '../rig/types';
import { frameOf } from '../wardrobe/resolve';
import type { Avatar } from '../wardrobe/types';

const D2R = Math.PI / 180;
/** Points along a cloth strip, and scratch buffers for its curve (layout is synchronous, so they are shared). */
const STRIP_N = 14;
const CP = new Float64Array(256), CQ = new Float64Array(256);
/** Points along a limb strip (enough for a smooth bend at the elbow or the knee). */
const LIMB_N = 40;

/** A limb slot's bones and layout, in rig units (SlotDef.limb). */
interface LimbLayout { b0: number; b1: number; top: number; bottom: number; bend: number }

/** A placeholder atlas: its texture key and how many rig units one of its pixels covers. */
export interface Atlas { key: string; unitsPerPx: number }

export class RigCharacter {
  readonly state: PoseState;
  readonly chain: ChainSim;
  readonly container: Phaser.GameObjects.Container;
  readonly images: Phaser.GameObjects.Image[] = [];
  avatar: Avatar | null = null;
  /** Visible slot indices in draw order, as of the last layout. */
  readonly drawn: number[] = [];
  /** Composite cell (−1 = none) and this character's outline width there (texture px). */
  cell = -1;
  outlinePx = 1.5;
  private readonly slotBone: Int16Array;
  /** Joint caps: per slot, the share of the bone's turn against its parent (1 = the bone's own rotation). */
  private readonly slotBlend: Float64Array;
  /** Follow-through per slot (SlotDef.lag), its limit, and the turn each lagging piece showed last frame. */
  private readonly slotLag: Float64Array;
  private readonly slotLagMax: Float64Array;
  private readonly slotShown: Float64Array;
  private readonly slotParent: Int16Array;
  private readonly frames: (string | null)[];
  /** Cloth strips (slots with `strip`): drawn as a rope bent along the chain bones instead of a flat image. */
  private readonly ropes: (Phaser.GameObjects.Rope | null)[];
  private readonly stripBones: (Int16Array | null)[];
  private readonly limbs: (LimbLayout | null)[];
  private orderId = '\u0000';

  constructor(readonly scene: Phaser.Scene, readonly pose: RigPose, private atlas: Atlas, inScene: boolean) {
    this.state = pose.newState();
    this.chain = new ChainSim(pose, CHAINS);
    this.container = new Phaser.GameObjects.Container(scene, 0, 0);
    if (inScene) scene.add.existing(this.container);
    const slots = pose.rig.slots;
    this.slotBone = new Int16Array(slots.map((s) => pose.index.get(s.bone)!));
    this.slotBlend = new Float64Array(slots.map((s) => s.blend ?? 1));
    this.slotLag = new Float64Array(slots.map((s) => s.lag ?? 0));
    this.slotLagMax = new Float64Array(slots.map((s) => ((s.lagMax ?? 10) * Math.PI) / 180));
    this.slotShown = new Float64Array(slots.length).fill(NaN);
    this.slotParent = new Int16Array(slots.map((_, i) => pose.parent[this.slotBone[i]]));
    this.frames = slots.map(() => null);
    this.stripBones = slots.map((s) => (s.strip ? Int16Array.from(s.strip.map((n) => pose.index.get(n)!)) : null));
    const B = pose.rig.B;
    this.limbs = slots.map((s) => (s.limb ? {
      b0: pose.index.get(s.limb.bones[0])!, b1: pose.index.get(s.limb.bones[1])!,
      top: s.limb.top * B, bottom: s.limb.bottom * B, bend: s.limb.bend * B,
    } : null));
    this.ropes = slots.map((s) => {
      if (!s.strip && !s.limb) return null;
      const n = s.limb ? LIMB_N : STRIP_N;
      const r = new Phaser.GameObjects.Rope(scene, 0, 0, atlas.key, undefined, Array.from({ length: n }, (_, j) => ({ x: 0, y: j })), false);
      r.setVisible(false);
      return r;
    });
    for (let i = 0; i < slots.length; i++) {
      const img = new Phaser.GameObjects.Image(scene, 0, 0, atlas.key);
      img.setVisible(false);
      this.images.push(img);
    }
  }

  setAtlas(atlas: Atlas): void {
    if (atlas.key === this.atlas.key) return;
    this.atlas = atlas;
    this.images.forEach((img) => img.setTexture(atlas.key));
    this.ropes.forEach((r) => r?.setTexture(atlas.key));
    this.frames.fill(null);
  }

  /** A new look: shown from the next layout (call it before layout and it shows in the same frame). The worn items'
   *  attachment chains (a tabard, coat tails) are set up with their own springs; a chain nobody uses stays idle. */
  setAvatar(av: Avatar): void {
    this.avatar = av;
    const specs = Object.values(av.items).flatMap((it) => it?.attach ?? []);
    this.pose.attach(this.state, specs);
    this.chain.setAttach(this.pose, specs);
  }

  evaluate(anim: AnimDef, t: number, from?: { v: Float64Array; w: number }): void { this.pose.evaluate(anim, t, this.state, this.chain, from); }

  /** Place every part: `s` = output px per rig unit. */
  layout(s: number): void {
    const av = this.avatar;
    if (!av) return;
    const slots = this.pose.rig.slots, w = this.state.world, rest = this.pose.restWorldRot, k = this.atlas.unitsPerPx * s;
    if (this.state.orderId !== this.orderId) {
      this.container.removeAll(false);
      for (const i of this.state.order) this.container.add(this.ropes[i] ?? this.images[i]);
      this.orderId = this.state.orderId;
    }
    this.drawn.length = 0;
    for (const i of this.state.order) {
      const img = this.images[i], part = av.parts[i];
      const fr = part ? frameOf(part, slots[i], this.state.swaps, av.unarmed) : undefined;
      const rope = this.ropes[i];
      if (!fr) { if (rope) { if (rope.visible) rope.setVisible(false); } else if (img.visible) img.setVisible(false); continue; }
      if (rope) { if (this.limbs[i]) this.layoutLimb(i, rope, fr, s); else this.layoutStrip(i, rope, fr, s); this.drawn.push(i); continue; }
      if (this.frames[i] !== fr) { img.setFrame(fr); this.frames[i] = fr; }
      const b = this.slotBone[i], o = b * 6;
      img.x = w[o + 4] * s; img.y = w[o + 5] * s;
      const turn = Math.atan2(w[o + 1], w[o]) - rest[b] * D2R;
      const kb = this.slotBlend[i], p = this.slotParent[i];
      if (kb === 1 || p < 0) img.rotation = turn;
      else { // a cap turns with its parent, plus kb of the bone's own turn against the parent
        const q = p * 6, pt = Math.atan2(w[q + 1], w[q]) - rest[p] * D2R;
        let d = turn - pt; d = Math.atan2(Math.sin(d), Math.cos(d));
        img.rotation = pt + kb * d;
      }
      if (this.slotLag[i] > 0) { // follow-through: a moment behind where the bone puts it, never more than lagMax
        const tgt = img.rotation; let sh = this.slotShown[i];
        if (Number.isNaN(sh)) sh = tgt;
        let d = tgt - sh; d = Math.atan2(Math.sin(d), Math.cos(d));
        sh += d * (1 - this.slotLag[i]);
        let e = sh - tgt; e = Math.atan2(Math.sin(e), Math.cos(e));
        const m = this.slotLagMax[i];
        if (e > m) sh = tgt + m; else if (e < -m) sh = tgt - m;
        this.slotShown[i] = sh; img.rotation = sh;
      }
      img.setScale(k);
      if (!img.visible) img.setVisible(true);
      this.drawn.push(i);
    }
  }

  /** A cloth strip: the frame bent along its chain. The top (above and just below the clasps) keeps the chain's rest
   *  direction against the body, so the clasps stay on the shoulders; below, the strip follows the chain bones through
   *  a smoothed curve (two rounds of corner cutting), sampled evenly over the frame's own length (never stretched). */
  private layoutStrip(i: number, rope: Phaser.GameObjects.Rope, fr: string, s: number): void {
    const u = this.atlas.unitsPerPx, w = this.state.world, B = this.pose.rig.B;
    if (this.frames[i] !== fr) { rope.setFrame(fr); rope.updateUVs(); this.frames[i] = fr; }
    const f = rope.frame, L = f.height * u;
    const top = (f.customPivot ? f.pivotY : 0) * L;
    const bs = this.stripBones[i]!, b0 = bs[0], o0 = b0 * 6, par = this.pose.parent[b0];
    const st = this.state, pose = this.pose;
    const restA = (par >= 0 ? Math.atan2(w[par * 6 + 1], w[par * 6]) : 0) + pose.restR(st, b0) * D2R;
    const rx = Math.cos(restA), ry = Math.sin(restA), x0 = w[o0 + 4], y0 = w[o0 + 5];
    let n = 0;
    const put = (x: number, y: number) => { CP[n++] = x; CP[n++] = y; };
    put(x0 - rx * top, y0 - ry * top); put(x0, y0); put(x0 + rx * 0.4 * pose.length(st, b0) * B, y0 + ry * 0.4 * pose.length(st, b0) * B);
    for (let j = 1; j < bs.length; j++) put(w[bs[j] * 6 + 4], w[bs[j] * 6 + 5]);
    const last = bs[bs.length - 1], ol = last * 6, ll = pose.length(st, last) * B;
    put(w[ol + 4] + w[ol] * ll, w[ol + 5] + w[ol + 1] * ll);
    // corner cutting (Chaikin), twice, keeping both ends
    let src = CP, dst = CQ, m = n;
    for (let it = 0; it < 2; it++) {
      let k = 0;
      dst[k++] = src[0]; dst[k++] = src[1];
      for (let j = 0; j + 3 < m; j += 2) {
        const ax = src[j], ay = src[j + 1], bx = src[j + 2], by = src[j + 3];
        dst[k++] = 0.75 * ax + 0.25 * bx; dst[k++] = 0.75 * ay + 0.25 * by; dst[k++] = 0.25 * ax + 0.75 * bx; dst[k++] = 0.25 * ay + 0.75 * by;
      }
      dst[k++] = src[m - 2]; dst[k++] = src[m - 1];
      m = k; const t = src; src = dst; dst = t;
    }
    // even samples over the frame's length (past the chain's end, carry on along the last direction)
    const pts = rope.points as { x: number; y: number }[];
    let seg = 0, acc = 0, segLen = Math.hypot(src[2] - src[0], src[3] - src[1]);
    for (let j = 0; j < STRIP_N; j++) {
      const d = (L * j) / (STRIP_N - 1);
      while (d > acc + segLen && seg + 2 < m / 2) { acc += segLen; seg++; segLen = Math.hypot(src[seg * 2 + 2] - src[seg * 2], src[seg * 2 + 3] - src[seg * 2 + 1]); }
      const t = segLen > 0 ? (d - acc) / segLen : 0;
      const px = src[seg * 2] + (src[seg * 2 + 2] - src[seg * 2]) * t, py = src[seg * 2 + 1] + (src[seg * 2 + 3] - src[seg * 2 + 1]) * t;
      pts[j].x = px / u; pts[j].y = py / u;
    }
    rope.setScale(u * s);
    rope.dirty = true;
    if (!rope.visible) rope.setVisible(true);
  }

  /** A limb strip (SlotDef.limb): the frame (the limb drawn straight) bent along its two bones — straight along the
   *  upper one, a smooth turn of radius `bend` about the middle joint, straight along the lower one. The frame's rows are
   *  tied to the joints (the top joint `top` below its top edge, the others at the bones' lengths), so a sleeve, a
   *  trouser leg or a boot cut to the same layout bends exactly with the skin under it. The turn takes the rows of the
   *  corner's two tangent lengths: the inside of the bend is gathered, the outside spread. */
  private layoutLimb(i: number, rope: Phaser.GameObjects.Rope, fr: string, s: number): void {
    const u = this.atlas.unitsPerPx, w = this.state.world, L = this.limbs[i]!;
    if (this.frames[i] !== fr) { rope.setFrame(fr); rope.updateUVs(); this.frames[i] = fr; }
    const o0 = L.b0 * 6, o1 = L.b1 * 6;
    const x0 = w[o0 + 4], y0 = w[o0 + 5], ax = w[o0], ay = w[o0 + 1];
    const x1 = w[o1 + 4], y1 = w[o1 + 5], bx = w[o1], by = w[o1 + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = this.pose.length(this.state, L.b1) * this.pose.rig.B;
    const H = rope.frame.height * u;
    const th = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    const t = Math.min(L.bend * Math.tan(Math.abs(th) / 2), 0.8 * l1, 0.8 * l2);
    const p0x = x1 - ax * t, p0y = y1 - ay * t, p2x = x1 + bx * t, p2y = y1 + by * t;
    const pts = rope.points as { x: number; y: number }[], n = pts.length;
    for (let j = 0; j < n; j++) {
      const v = (H * j) / (n - 1) - L.top;
      let px: number, py: number;
      if (v < l1 - t) { px = x0 + ax * v; py = y0 + ay * v; }
      else if (v < l1 + t) {
        const q = (v - (l1 - t)) / (2 * t), a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
        px = a * p0x + b * x1 + c * p2x; py = a * p0y + b * y1 + c * p2y;
      } else { const d = v - l1; px = x1 + bx * d; py = y1 + by * d; }
      pts[j].x = px / u; pts[j].y = py / u;
    }
    rope.setScale(u * s);
    rope.dirty = true;
    if (!rope.visible) rope.setVisible(true);
  }

  tintAll(color: number): void { for (const i of this.drawn) this.tintOne(i, color); }
  clearTint(): void { for (const i of this.drawn) this.untintOne(i); }
  /** Every part image, drawn or hidden (leaving the slot-colour view: a hidden part must not come back coloured). */
  clearAllTints(): void { for (let i = 0; i < this.images.length; i++) this.untintOne(i); }

  /** Each drawn slot in its own flat colour (slot-identity renders for the tests). */
  tintBySlot(colorOf: (slot: number) => number): void { for (const i of this.drawn) this.tintOne(i, colorOf(i)); }

  /** Hide every drawn part but `keep` (until the next layout): a test render of a few parts on their own. */
  isolate(keep: Set<number>): void { for (const i of this.drawn) if (!keep.has(i)) (this.ropes[i] ?? this.images[i]).setVisible(false); }

  /** The frame slot `i` shows, or undefined when it is not drawn. */
  shown(i: number): string | undefined {
    const o = this.ropes[i] ?? this.images[i];
    return o.visible ? (this.ropes[i] ? this.frames[i] ?? undefined : this.images[i].frame.name) : undefined;
  }

  private tintOne(i: number, color: number): void {
    const r = this.ropes[i];
    if (r) { r.setTintFill(true); r.setColors(color); } else this.images[i].setTintFill(color);
  }

  private untintOne(i: number): void {
    const r = this.ropes[i];
    if (r) { r.setTintFill(false); r.setColors(0xffffff); } else this.images[i].clearTint();
  }

  destroy(): void { this.container.destroy(); this.images.forEach((i) => i.destroy()); this.ropes.forEach((r) => r?.destroy()); }
}
