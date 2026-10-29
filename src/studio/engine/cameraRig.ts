// God of Legacy Studio — Camera Studio's camera. It never turns (the view stays square to the map); it follows the
// character's look point (the feet, the framing offset, the lead ahead of the facing side, a share of the ground's and
// the jump's height) through a dead zone, eased by its smoothing, held to its top speed, never letting the character
// drift past the distance (leash); the zoom eases to its setting, drawn back at a run and up high; the view kept inside
// the map's edges.
import Phaser from 'phaser';
import type { CameraSettings } from '../model/profile';

export interface CamTarget { x: number; y: number; z: number; supportZ: number; facing: 1 | -1; run: number }
export interface CamFrame { lookX: number; lookY: number; deadW: number; deadH: number; leash: number }

export class CameraRig {
  x = 0; y = 0; zoom = 1;
  private ahead = 0;
  private started = false;
  /** The last look point and settings (Live Preview's camera overlay). */
  frame: CamFrame = { lookX: 0, lookY: 0, deadW: 0, deadH: 0, leash: 0 };

  /** Straight onto the target (a reset, the first frame). */
  snap(cam: Phaser.Cameras.Scene2D.Camera, s: CameraSettings, t: CamTarget, bounds: { w: number; h: number }): void {
    this.started = false;
    this.step(cam, s, t, 0, bounds);
  }

  /** Carries on from wherever the view is now (back from editing: no jump). */
  takeOver(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.x = cam.midPoint.x; this.y = cam.midPoint.y; this.zoom = cam.zoom; this.started = true;
  }

  step(cam: Phaser.Cameras.Scene2D.Camera, s: CameraSettings, t: CamTarget, ms: number, bounds: { w: number; h: number }): void {
    const ease = (tc: number) => (!this.started || tc <= 0 ? 1 : 1 - Math.exp(-ms / tc));
    const hz = t.supportZ * s.heightFollow + Math.max(0, t.z - t.supportZ) * s.jumpFollow;
    this.ahead += (s.lookAhead * t.facing - this.ahead) * ease(s.lookMs);
    const lx = t.x + s.offsetX + this.ahead, ly = t.y - hz + s.offsetY;
    if (!this.started) { this.x = lx; this.y = ly; this.zoom = s.zoom; }
    // the dead zone: the view's middle moves only as far as keeps the look point inside it
    let tx = this.x, ty = this.y;
    if (s.followX) { const d = lx - this.x, h = s.deadW / 2; if (d > h) tx = lx - h; else if (d < -h) tx = lx + h; }
    if (s.followY) { const d = ly - this.y, h = s.deadH / 2; if (d > h) ty = ly - h; else if (d < -h) ty = ly + h; }
    let dx = (tx - this.x) * ease(s.smoothX), dy = (ty - this.y) * ease(s.smoothY);
    const max = this.started ? (s.maxSpeed * ms) / 1000 : Infinity, len = Math.hypot(dx, dy);
    if (len > max && len > 0) { dx *= max / len; dy *= max / len; }
    this.x += dx; this.y += dy;
    // the distance: the character never drifts further than this from the view's middle
    if (s.followX && Math.abs(lx - this.x) > s.leash) this.x = lx - Math.sign(lx - this.x) * s.leash;
    if (s.followY && Math.abs(ly - this.y) > s.leash) this.y = ly - Math.sign(ly - this.y) * s.leash;
    // the zoom: its setting, drawn back at a run and up high
    const want = Math.max(0.1, s.zoom * (1 - s.runZoomOut * t.run) * (1 - s.heightZoomOut * Math.min(2, t.supportZ / 300)));
    this.zoom += (want - this.zoom) * ease(s.zoomMs);
    this.started = true;
    this.apply(cam, s.bounds ? bounds : null);
    this.frame = { lookX: lx, lookY: ly, deadW: s.deadW, deadH: s.deadH, leash: s.leash };
  }

  /** Sets the camera (never turned), kept inside the map when asked. */
  apply(cam: Phaser.Cameras.Scene2D.Camera, bounds: { w: number; h: number } | null): void {
    cam.setRotation(0);
    cam.setZoom(this.zoom);
    let x = this.x, y = this.y;
    if (bounds) {
      const hw = cam.width / this.zoom / 2, hh = cam.height / this.zoom / 2;
      x = bounds.w <= hw * 2 ? bounds.w / 2 : Phaser.Math.Clamp(x, hw, bounds.w - hw);
      y = bounds.h <= hh * 2 ? bounds.h / 2 : Phaser.Math.Clamp(y, hh, bounds.h - hh);
    }
    cam.centerOn(x, y);
  }
}
