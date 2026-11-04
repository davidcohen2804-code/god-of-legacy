// The style switch drawn as a tag-in (David 4 Nov 14:59: "the entrance of the switching character needs to come in like a
// new character entering, running toward the existing one and replacing it"): the new style's body — its own clothes, its
// own weapon — dashes in from behind the fighter with its afterimages and reaches her spot as the switch commits; there the
// old style's body hops back out of her and fades away. Presentation only, the same on every screen (the caster's scene,
// RemotePlayer for the others): the fighter's place, the switch's timing and every hit stay where they are (Styles.ts).
import Phaser from 'phaser';
import { ActorView } from '../game/ActorView';
import type { PoseFrame } from '../game/Body';
import type { AnimSnap } from '../game/PoseState';
import type { Dir } from '../world/collision';
import { Afterimages } from './ArcherMotion';
import { SWITCH } from './Styles';

export const TAG = {
  /** The new body starts this far behind her (world px) and reaches her spot at the switch's commit. */
  from: 150,
  /** The old body hops back this far, this high, fading out over this long after the commit. */
  outBack: 120, outUp: 46, outMs: 360,
};

export interface TagHost {
  /** A bare view dressed like the fighter (no name plate, no ring). */
  makeView(): ActorView;
  /** A pose of the fighter in a style's body (undefined: the class's own). */
  pose(body: string | undefined, snap: AnimSnap, dir: Dir): PoseFrame;
}

export class StyleTag {
  private inV?: ActorView;
  private outV?: ActorView;
  private after?: Afterimages;
  private cur: { at: number; from?: string; to?: string; face: number; air: boolean } | null = null;

  constructor(private scene: Phaser.Scene, private host: TagHost) {}

  /** A switch began (its cast): the two styles' bodies, her facing, whether she is off the floor. `now`: the clock the
   *  render calls use. */
  start(now: number, from: string | undefined, to: string | undefined, face: number, air: boolean, accent: number): void {
    this.cur = { at: now, from, to, face: face < 0 ? -1 : 1, air };
    this.inV ??= this.host.makeView();
    this.outV ??= this.host.makeView();
    this.after = new Afterimages(this.scene, accent);
  }

  /** The switch was cut off before its commit (she was hit out of it): the new body never arrives. */
  cancel(): void { this.cur = null; this.inV?.setVisible(false); this.outV?.setVisible(false); }

  /** Each frame, after the fighter is drawn: where she stands now and which way she faces. */
  render(ms: number, now: number, x: number, y: number, z: number, supportZ: number, dir: Dir, alpha = 1): void {
    const c = this.cur;
    if (!c || !this.inV || !this.outV) return;
    const e = now - c.at, C = SWITCH.commitMs, f = c.face;
    if (e < 0 || e > C + TAG.outMs) { this.cancel(); return; }
    const side: Dir = f < 0 ? 'left' : 'right';
    if (e < C) { // the new one runs in from behind her (in the air: flies in)
      const u = e / C, w = 1 - (1 - u) * (1 - u);
      const snap: AnimSnap = c.air ? { mode: 'air', t: 180, vz: -40, speed: 0 } : { mode: 'run', t: e * 1.7, speed: 420, vz: 0 };
      this.inV.setVisible(true); // (a view hidden last frame stays hidden until shown: the render alone does not show it)
      this.inV.render(ms, this.host.pose(c.to, snap, side), x - f * TAG.from * (1 - w), y - 0.6, z, supportZ, side, alpha * Math.min(1, 0.7 + 0.5 * u));
      this.inV.ring.setVisible(false);
      this.after?.step(now, this.inV.sprite, true, 28);
    } else this.inV.setVisible(false);
    if (e >= C) { // the old one hops back out of her and fades
      const v = Math.min(1, (e - C) / TAG.outMs), w = 1 - Math.pow(1 - v, 3); // (out of her fast, slowing as it fades)
      const snap: AnimSnap = { mode: 'backstep', t: e - C, ms: TAG.outMs, vz: 0, speed: 0 };
      this.outV.setVisible(true);
      this.outV.render(ms, this.host.pose(c.from, snap, dir), x - f * TAG.outBack * w, y - 0.6, z + TAG.outUp * Math.sin(Math.PI * Math.min(1, v * 1.15)), supportZ, dir, alpha * 0.9 * (1 - v * v));
      this.outV.ring.setVisible(false);
    } else this.outV.setVisible(false);
  }

  /** Still before the commit (the new body on its way in). */
  pending(now: number): boolean { return !!this.cur && now - this.cur.at < SWITCH.commitMs; }

  destroy(): void { this.inV?.destroy(); this.outV?.destroy(); this.inV = this.outV = undefined; this.cur = null; }
}
