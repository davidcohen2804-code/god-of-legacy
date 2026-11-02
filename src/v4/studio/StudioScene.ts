// The character studio's scene: one character kit (BASE-01 by default, see kit.ts), shown large (for looking at joints,
// grip and layers up close) and at gameplay size, playing the shared animations with the clock under control (play,
// pause, step one frame), its wardrobe switched live. Overlays: the skeleton (bones and joints), the parts by layer.
// Isolated lab tool: nothing here is used by the game.
import Phaser from 'phaser';
import { RigPose } from '../rig/pose';
import type { AnimDef } from '../rig/types';
import { RigCharacter, type Atlas } from '../render/RigCharacter';
import { Wardrobe } from '../wardrobe/resolve';
import type { AppearanceInput, WardrobeSlot } from '../wardrobe/types';
import { pickKit } from './kit';

export const KIT = pickKit();

export const STUDIO_CANVAS = { w: 1600, h: 900 };
const MASTER_B = 768;
/** The large view: B = 420 px, feet at (480, 790). The gameplay-size view: B = 150 px (the courtyard at 1080p). */
export const BIG = { B: 420, x: 480, y: 790 };
export const GAME = { B: 150, x: 1260, y: 640 };
const FPS = 30;
const GROUP_COLOURS: Record<string, number> = { armF: 0x6aa7ff, legF: 0x58c48a, legB: 0xf0c75e, torso: 0xe57f6a, head: 0xc89cf0, armB: 0x5fd4e6, gripB: 0xff6fb1, gripF: 0x9f8cff };

const REST: AnimDef = { name: 'rest', dur: 1, loop: true, bones: {} };

export class StudioScene extends Phaser.Scene {
  pose!: RigPose;
  wardrobe!: Wardrobe;
  big!: RigCharacter;
  small!: RigCharacter;
  clips: Record<string, AnimDef> = { rest: REST, ...KIT.anims };
  /** The state picked in the list; `anim` is what it plays with the worn weapon (or none). */
  animName = 'rest';
  anim: AnimDef = REST;
  /** No weapon in hand (the kit's unarmed set plays). */
  unarmed = false;
  /** The held weapon's motion kit (sword, dagger, staff). */
  weaponKit = 'sword_1h';
  t = 0;
  /** A change of animation by a change of item: a short cross-fade from the pose that was on screen. */
  private from: Float64Array | null = null;
  private fadeT = 1;
  playing = true;
  speed = 1;
  worn: Partial<Record<WardrobeSlot, string>> = { ...KIT.outfit };
  overlays = { joints: false, layers: false };
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() { super('studio'); }

  preload(): void {
    this.load.image(KIT.texKey, KIT.texUrl);
  }

  create(): void {
    const tex = this.textures.get(KIT.texKey);
    for (const f of KIT.frames) {
      const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!;
      fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py;
    }
    this.pose = new RigPose(KIT.rig);
    const cat = KIT.catalog();
    this.wardrobe = new Wardrobe(KIT.rig, cat.items, cat.base);
    const atlas: Atlas = { key: KIT.texKey, unitsPerPx: MASTER_B / KIT.bpx };
    // the two panels: a soft floor line each
    const g = this.add.graphics();
    g.fillStyle(0x1a2232, 1).fillRect(0, 0, 960, STUDIO_CANVAS.h);
    g.fillStyle(0x121824, 1).fillRect(960, 0, STUDIO_CANVAS.w - 960, STUDIO_CANVAS.h);
    g.lineStyle(2, 0x2c3850, 1).lineBetween(40, BIG.y, 920, BIG.y).lineBetween(1000, GAME.y, 1560, GAME.y);
    this.big = new RigCharacter(this, this.pose, atlas, true);
    this.small = new RigCharacter(this, this.pose, atlas, true);
    this.big.container.setPosition(BIG.x, BIG.y);
    this.small.container.setPosition(GAME.x, GAME.y);
    this.gfx = this.add.graphics().setDepth(10);
    this.applyLook();
    window.dispatchEvent(new CustomEvent('v4studio-ready', { detail: this }));
  }

  applyLook(): void {
    const input: AppearanceInput = {
      body: 'male_std', look: { ...KIT.look }, gearLooks: {},
      cosmetics: { equipped: { ...this.worn } }, family: 'sword',
    };
    const av = this.wardrobe.resolve(input);
    this.big.setAvatar(av); this.small.setAvatar(av);
    this.unarmed = av.unarmed;
    this.weaponKit = av.items.weapon?.motion ?? 'sword_1h';
    // taking the weapon off (or putting it on) changes the animation: same moment, faded in from the pose on screen
    const next = this.pick(this.animName);
    if (next !== this.anim) {
      this.from = this.anim === REST ? null : this.pose.localValues(this.anim, this.t);
      this.fadeT = 0;
      this.t = next.loop ? this.t % next.dur : Math.min(this.t, next.dur);
      this.anim = next;
    }
  }

  private pick(name: string): AnimDef { return name === 'rest' ? REST : KIT.animFor?.(name, this.unarmed, this.weaponKit) ?? this.clips[name] ?? REST; }

  setAnim(name: string): void { this.animName = name; this.anim = this.pick(name); this.t = 0; this.from = null; this.big.chain.reset(); }

  /** Frame `i` of the current animation at 30 frames per second. */
  frameCount(): number { return Math.max(1, Math.round(this.anim.dur * FPS)); }

  update(_time: number, delta: number): void {
    this.fadeT += (delta / 1000) * this.speed;
    if (this.playing) {
      this.t += (delta / 1000) * this.speed;
      if (this.t > this.anim.dur) this.t = this.anim.loop ? this.t % this.anim.dur : 0;
    }
    this.render();
  }

  render(): void {
    // a jump with marks has no height of its own (the game's physics lifts the body): the studio draws the arc
    const m = this.anim.marks;
    const lift = m && 'air' in m && this.t > m.air && this.t < m.land ? 0.36 * 4 * ((this.t - m.air) / (m.land - m.air)) * (1 - (this.t - m.air) / (m.land - m.air)) : 0;
    this.big.container.y = BIG.y - lift * BIG.B; this.small.container.y = GAME.y - lift * GAME.B;
    for (const [ch, B] of [[this.big, BIG.B], [this.small, GAME.B]] as const) {
      const k = Math.min(1, this.fadeT / 0.09);
      ch.evaluate(this.anim, this.t, this.from && k < 1 ? { v: this.from, w: 1 - (1 - k) * (1 - k) } : undefined);
      ch.layout(B / MASTER_B);
      if (this.overlays.layers) ch.tintBySlot((i) => GROUP_COLOURS[KIT.rig.slots[i].group] ?? 0xffffff); else ch.clearAllTints();
    }
    this.gfx.clear();
    if (this.overlays.joints) this.drawJoints();
  }

  private drawJoints(): void {
    const s = BIG.B / MASTER_B, w = this.big.state.world, g = this.gfx;
    const at = (b: string): [number, number] => { const i = this.pose.index.get(b)!; return [BIG.x + w[i * 6 + 4] * s, BIG.y + w[i * 6 + 5] * s]; };
    const tip = (b: string): [number, number] => {
      const i = this.pose.index.get(b)!, L = this.pose.length(this.big.state, i) * MASTER_B;
      return [BIG.x + (w[i * 6 + 4] + w[i * 6] * L) * s, BIG.y + (w[i * 6 + 5] + w[i * 6 + 1] * L) * s];
    };
    g.lineStyle(3, 0x00e5ff, 0.9);
    for (const s2 of ['B', 'F']) {
      for (const [a, b] of [[`uparm_${s2}`, `forearm_${s2}`], [`forearm_${s2}`, `hand_${s2}`], [`thigh_${s2}`, `shin_${s2}`], [`shin_${s2}`, `foot_${s2}`]]) {
        const p = at(a), q = at(b); g.lineBetween(p[0], p[1], q[0], q[1]);
      }
      const h = at(`hand_${s2}`), ht = tip(`hand_${s2}`); g.lineBetween(h[0], h[1], ht[0], ht[1]);
    }
    for (const [a, b] of [['hip', 'chest'], ['chest', 'head']]) { const p = at(a), q = at(b); g.lineBetween(p[0], p[1], q[0], q[1]); }
    g.fillStyle(0xffe14d, 1);
    for (const b of ['hip', 'chest', 'head', 'uparm_B', 'forearm_B', 'hand_B', 'uparm_F', 'forearm_F', 'hand_F', 'thigh_B', 'shin_B', 'foot_B', 'thigh_F', 'shin_F', 'foot_F', 'weapon']) {
      const p = at(b); g.fillCircle(p[0], p[1], b === 'weapon' ? 6 : 5);
    }
  }
}
