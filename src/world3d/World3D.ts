// The open world on the 3D stage (docs/WORLD_3D_SPEC.md §1): the map the hero stands in is a 3D place — the shared
// stage (Arena3D) with the map's own builder — and this drives it each frame from the scene: the camera on the hero
// (a lead toward where he walks, clamped to the map's ends), the bodies that cast its sun's shadow and take its light
// (the hero, the monsters, the NPCs), what flies, the big moments' darkening, the landings' dust. One place at a time.
import Phaser from 'phaser';
import { Arena3D, type Cam3D, type Floor } from '../arena3d/Arena3D';
import { AREAS } from '../world/Areas';
import { MAPS } from './maps';

/** The world camera: a little higher and further than the arena's (one player walking far), a gentle turn. */
export const WORLD_CAM: Partial<Cam3D> = { pitch: 17, fov: 34, dist: 9.0, distPerSpan: 0.3, distMax: 13, yawMax: 5, follow: 0.1, aim: 1.0 };
/** How far ahead of the hero the camera looks (world px), eased when he turns. */
const LEAD = 90;
/** Half the view's width on the floor (world px) at the camera's distance: the focus keeps this far from the map's ends. */
const HALF_VIEW = 470;

export interface Body { body: Phaser.GameObjects.Sprite; foot: Phaser.GameObjects.Image; z: number }
export interface WorldFrame {
  hero: { x: number; y: number; z: number; facing: -1 | 1 };
  others: { x: number; y: number; z: number }[];
  bodies: Body[];
  flying: Arena3D['flying'];
  hitStop: boolean;
  /** An ultimate / a signature playing (the place darkens for them). */
  ult: boolean; sig: boolean;
}

export class World3D {
  readonly a3d: Arena3D;
  readonly floor: Floor;
  private focus3 = { x: 0, z: 0 };
  private lead = 0;
  private heroZ = 0; private fallV = 0;

  static has(areaId: string): boolean { return !!MAPS[areaId] && !!AREAS[areaId]; }

  constructor(scene: Phaser.Scene, readonly areaId: string) {
    const a = AREAS[areaId];
    // the floor: the walk polygon's span, its back line where the polygon meets the map's left edge, its front the deepest point
    const ys = a.walk.map((p) => p[1]), xs = a.walk.map((p) => p[0]);
    const left = Math.min(...xs), backPts = a.walk.filter((p) => p[0] <= left + 1).map((p) => p[1]);
    this.floor = { x0: a.x + left, x1: a.x + Math.max(...xs), back: backPts.length ? Math.min(...backPts) : Math.min(...ys), front: Math.max(...ys) };
    this.focus3 = { x: (this.floor.x0 + this.floor.x1) / 200, z: ((this.floor.back + this.floor.front) / 200) * 1.15 };
    this.a3d = new Arena3D(scene, this.floor, { build: MAPS[areaId](this.focus3), cam: WORLD_CAM });
  }

  /** Each frame, after the scene has moved everyone. */
  step(ms: number, f: WorldFrame): void {
    const a = this.a3d, h = f.hero;
    this.lead += (h.facing * LEAD - this.lead) * Math.min(1, ms / 600);
    const x0 = this.floor.x0 + HALF_VIEW, x1 = this.floor.x1 - HALF_VIEW;
    const fx = x1 > x0 ? Phaser.Math.Clamp(h.x + this.lead, x0, x1) : (this.floor.x0 + this.floor.x1) / 2;
    // a fight spreads the view a little (the nearest foe counts), as the arena's does
    let span = 0; for (const o of f.others) { const d = Math.hypot(o.x - h.x, (o.y - h.y) * 1.7); if (d < 700) span = Math.max(span, d * 0.5); }
    a.focus = { x: fx, y: h.y, z: h.z, span };
    a.anchors = [{ x: h.x, y: h.y, z: h.z }, ...f.others.map((o) => ({ x: o.x, y: o.y, z: o.z }))];
    a.bodies = f.bodies;
    a.flying = f.flying;
    a.dimWant = f.ult ? 0.6 : f.sig ? 0.25 : 0;
    this.focus3.x = h.x / 100; this.focus3.z = (h.y / 100) * 1.15;
    // the hero coming down (a jump's landing): the place's dust answers it
    const v = ms > 0 ? Math.max(0, ((this.heroZ - h.z) * 1000) / ms) : 0;
    if (this.heroZ > 6 && h.z <= 1) a.land(h.x, h.y, this.fallV);
    this.fallV = h.z > 1 ? (v || this.fallV) : 0; this.heroZ = h.z;
    a.step(ms, f.hitStop ? 0 : ms);
  }

  /** While only some maps exist in 3D: the hero stays on this map (its ends are soft walls). */
  keepIn(k: { x: number; vx: number }): void {
    if (k.x > this.floor.x1 - 24) { k.x = this.floor.x1 - 24; if (k.vx > 0) k.vx = 0; }
    if (k.x < this.floor.x0 + 24) { k.x = this.floor.x0 + 24; if (k.vx < 0) k.vx = 0; }
  }
}
