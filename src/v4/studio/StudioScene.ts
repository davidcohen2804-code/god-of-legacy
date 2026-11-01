// The character studio's scene: one character built on body template t1, shown large (for looking at joints, grip and
// layers up close) and at gameplay size, playing the shared animations with the clock under control (play, pause, step
// one frame). Overlays: the skeleton (bones and joints), the parts by layer, the template's source drawing at rest.
// Isolated lab tool: nothing here is used by the game.
import Phaser from 'phaser';
import { RigPose } from '../rig/pose';
import type { AnimDef } from '../rig/types';
import { RigCharacter, type Atlas } from '../render/RigCharacter';
import { Wardrobe } from '../wardrobe/resolve';
import type { AppearanceInput, WardrobeSlot } from '../wardrobe/types';
import { ANIMS_T } from './animsT';
import { BASE_OUTFIT_T, T_FRAMES, T_TEXTURE, buildCatalogT } from './catalogT';
import { RIG_T } from './rigT';
import t1Url from './assets/t1.png?inline';
import drawingUrl from './assets/t1_drawing.png?inline';
import data from './assets/t1.json';

export const STUDIO_CANVAS = { w: 1600, h: 900 };
const MASTER_B = 768;
/** The large view: B = 420 px, feet at (480, 790). The gameplay-size view: B = 150 px (the courtyard at 1080p). */
export const BIG = { B: 420, x: 480, y: 790 };
export const GAME = { B: 150, x: 1260, y: 640 };
const FPS = 30;
/** The source drawing is shipped at half size (an overlay for checking the assembly at rest). */
const DRAWING_SCALE = 0.5;
const GROUP_COLOURS: Record<string, number> = { armF: 0x6aa7ff, legF: 0x58c48a, legB: 0xf0c75e, torso: 0xe57f6a, head: 0xc89cf0, armB: 0x5fd4e6, gripB: 0xff6fb1, gripF: 0x9f8cff };

const REST: AnimDef = { name: 'rest', dur: 1, loop: true, bones: {} };

export class StudioScene extends Phaser.Scene {
  pose!: RigPose;
  wardrobe!: Wardrobe;
  big!: RigCharacter;
  small!: RigCharacter;
  clips: Record<string, AnimDef> = { rest: REST, ...ANIMS_T };
  anim: AnimDef = REST;
  t = 0;
  playing = true;
  speed = 1;
  worn: Partial<Record<WardrobeSlot, string>> = { ...BASE_OUTFIT_T };
  overlays = { joints: false, layers: false, drawing: false };
  private gfx!: Phaser.GameObjects.Graphics;
  private drawing!: Phaser.GameObjects.Image;

  constructor() { super('studio'); }

  preload(): void {
    this.load.image(T_TEXTURE, t1Url);
    this.load.image('t1_body_drawing', drawingUrl);
  }

  create(): void {
    const tex = this.textures.get(T_TEXTURE);
    for (const f of T_FRAMES) {
      const fr = tex.add(f.name, 0, f.x, f.y, f.w, f.h)!;
      fr.customPivot = true; fr.pivotX = f.px; fr.pivotY = f.py;
    }
    this.pose = new RigPose(RIG_T);
    const cat = buildCatalogT();
    this.wardrobe = new Wardrobe(RIG_T, cat.items, cat.base);
    const atlas: Atlas = { key: T_TEXTURE, unitsPerPx: MASTER_B / data.bpx };
    // the two panels: a soft floor line each
    const g = this.add.graphics();
    g.fillStyle(0x1a2232, 1).fillRect(0, 0, 960, STUDIO_CANVAS.h);
    g.fillStyle(0x121824, 1).fillRect(960, 0, STUDIO_CANVAS.w - 960, STUDIO_CANVAS.h);
    g.lineStyle(2, 0x2c3850, 1).lineBetween(40, BIG.y, 920, BIG.y).lineBetween(1000, GAME.y, 1560, GAME.y);
    // the template's source drawing, at the large view's scale, behind the character (shown at rest on request)
    const k = BIG.B / (data.rig.bpx_drawing as number) / DRAWING_SCALE;
    this.drawing = this.add.image(BIG.x - data.rig.root[0] * DRAWING_SCALE * k, BIG.y - data.rig.root[1] * DRAWING_SCALE * k, 't1_body_drawing').setOrigin(0, 0).setScale(k).setAlpha(0.45).setVisible(false);
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
      body: 'male_std', look: { hair: 't1_hair', face: 't1_face' }, gearLooks: {},
      cosmetics: { equipped: { ...this.worn } }, family: 'sword',
    };
    const av = this.wardrobe.resolve(input);
    this.big.setAvatar(av); this.small.setAvatar(av);
  }

  setAnim(name: string): void { this.anim = this.clips[name] ?? REST; this.t = 0; this.big.chain.reset(); }

  /** Frame `i` of the current animation at 30 frames per second. */
  frameCount(): number { return Math.max(1, Math.round(this.anim.dur * FPS)); }

  update(_time: number, delta: number): void {
    if (this.playing) {
      this.t += (delta / 1000) * this.speed;
      if (this.t > this.anim.dur) this.t = this.anim.loop ? this.t % this.anim.dur : 0;
    }
    this.render();
  }

  render(): void {
    for (const [ch, B] of [[this.big, BIG.B], [this.small, GAME.B]] as const) {
      ch.evaluate(this.anim, this.t);
      ch.layout(B / MASTER_B);
      if (this.overlays.layers) ch.tintBySlot((i) => GROUP_COLOURS[RIG_T.slots[i].group] ?? 0xffffff); else ch.clearAllTints();
    }
    this.drawing.setVisible(this.overlays.drawing && this.anim === REST);
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
