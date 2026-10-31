// One rigged character: bone pose → part images in a Container. The same container is either drawn straight to the
// screen (direct mode) or into a cell of the shared composite texture (composite mode).
import Phaser from 'phaser';
import { CHAINS, ChainSim, RigPose, type PoseState } from '../rig/pose';
import type { AnimDef } from '../rig/types';
import { frameOf } from '../wardrobe/resolve';
import type { Avatar } from '../wardrobe/types';

const D2R = Math.PI / 180;

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
  /** Composite cell (−1 = none). */
  cell = -1;
  private readonly slotBone: Int16Array;
  private readonly frames: (string | null)[];
  private orderId = '\u0000';

  constructor(readonly scene: Phaser.Scene, readonly pose: RigPose, private atlas: Atlas, inScene: boolean) {
    this.state = pose.newState();
    this.chain = new ChainSim(pose, CHAINS);
    this.container = new Phaser.GameObjects.Container(scene, 0, 0);
    if (inScene) scene.add.existing(this.container);
    const slots = pose.rig.slots;
    this.slotBone = new Int16Array(slots.map((s) => pose.index.get(s.bone)!));
    this.frames = slots.map(() => null);
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
    this.frames.fill(null);
  }

  /** A new look: shown from the next layout (call it before layout and it shows in the same frame). */
  setAvatar(av: Avatar): void { this.avatar = av; }

  evaluate(anim: AnimDef, t: number): void { this.pose.evaluate(anim, t, this.state, this.chain); }

  /** Place every part: `s` = output px per rig unit. */
  layout(s: number): void {
    const av = this.avatar;
    if (!av) return;
    const slots = this.pose.rig.slots, w = this.state.world, rest = this.pose.restWorldRot, k = this.atlas.unitsPerPx * s;
    if (this.state.orderId !== this.orderId) {
      this.container.removeAll(false);
      for (const i of this.state.order) this.container.add(this.images[i]);
      this.orderId = this.state.orderId;
    }
    this.drawn.length = 0;
    for (const i of this.state.order) {
      const img = this.images[i], part = av.parts[i];
      const fr = part ? frameOf(part, slots[i], this.state.swaps, av.unarmed) : undefined;
      if (!fr) { if (img.visible) img.setVisible(false); continue; }
      if (this.frames[i] !== fr) { img.setFrame(fr); this.frames[i] = fr; }
      const b = this.slotBone[i], o = b * 6;
      img.x = w[o + 4] * s; img.y = w[o + 5] * s;
      img.rotation = Math.atan2(w[o + 1], w[o]) - rest[b] * D2R;
      img.setScale(k);
      if (!img.visible) img.setVisible(true);
      this.drawn.push(i);
    }
  }

  tintAll(color: number): void { for (const i of this.drawn) this.images[i].setTintFill(color); }
  clearTint(): void { for (const i of this.drawn) this.images[i].clearTint(); }

  /** Each drawn slot in its own flat colour (slot-identity renders for the tests). */
  tintBySlot(colorOf: (slot: number) => number): void { for (const i of this.drawn) this.images[i].setTintFill(colorOf(i)); }

  destroy(): void { this.container.destroy(); this.images.forEach((i) => i.destroy()); }
}
