// The open world on the 3D stage (docs/WORLD_3D_SPEC.md §1): the map the hero stands in is a 3D place — the shared
// stage (Arena3D) with the map's own builder — and this drives it each frame from the scene: the camera on the hero
// (a lead toward where he walks, clamped to the map's ends), the bodies that cast its sun's shadow and take its light
// (the hero, the monsters, the NPCs), what flies, the big moments' darkening, the landings' dust. One place at a time.
import Phaser from 'phaser';
import { Arena3D, type Cam3D, type Floor } from '../arena3d/Arena3D';
import { AREAS, areaAt } from '../world/Areas';
import { WORLD3D } from './flag';
import { MAPS } from './maps';
import { SKY_FLOOR } from './maps/sky';

/** The world camera: a little higher and further than the arena's (one player walking far), a gentle turn. */
export const WORLD_CAM: Partial<Cam3D> = { pitch: 17, fov: 34, dist: 9.0, distPerSpan: 0.3, distMax: 13, yawMax: 5, follow: 0.1, aim: 1.0, liftK: 0.4, liftMax: 160 };
/** The sky's camera: flatter, so the horizon — the sun, the far clouds — stays in the frame from a cloud's height. */
export const SKY_CAM: Partial<Cam3D> = { ...WORLD_CAM, pitch: 11, aim: 1.1 };
const camOf = (areaId: string): Partial<Cam3D> => (areaId === 'sky' ? SKY_CAM : WORLD_CAM);
/** How far ahead of the hero the camera looks (world px), eased when he turns. */
const LEAD = 90;
/** Half the view's width on the floor (world px) at the camera's distance: the focus keeps this far from the map's ends. */
const HALF_VIEW = 220;

export interface Body { body: Phaser.GameObjects.Sprite; foot: Phaser.GameObjects.Image; z: number }
export interface WorldFrame {
  hero: { x: number; y: number; z: number; facing: -1 | 1; /** the floor he stands on (a floor above: its height) */ floorZ: number };
  others: { x: number; y: number; z: number }[];
  bodies: Body[];
  flying: Arena3D['flying'];
  hitStop: boolean;
  /** An ultimate / a signature playing (the place darkens for them). */
  ult: boolean; sig: boolean;
  /** The Sun Gate's state (its doors in the place swing with it). */
  sunGateOpen?: boolean;
}

export class World3D {
  readonly a3d: Arena3D;
  readonly floor: Floor;
  private focus3: { x: number; z: number; sunGateOpen?: boolean } = { x: 0, z: 0 };
  private lead = 0;
  private heroZ = 0; private fallV = 0;
  /** The arrival (§1.8): from a wide view at the entry edge the camera glides to the hero while he can already walk. */
  private arrive: { t: number; ms: number; fromX: number; snap: boolean } | null = null;

  static has(areaId: string): boolean { return !!MAPS[areaId] && (areaId === 'sky' || !!AREAS[areaId]); }

  constructor(scene: Phaser.Scene, readonly areaId: string) {
    this.floor = areaId === 'sky' ? { ...SKY_FLOOR } : World3D.floorOf(areaId);
    this.focus3 = { x: (this.floor.x0 + this.floor.x1) / 200, z: ((this.floor.back + this.floor.front) / 200) * 1.15 };
    this.a3d = new Arena3D(scene, this.floor, { build: MAPS[areaId](this.focus3), cam: camOf(areaId) });
  }

  /** The arrival beat: `fromX` where the camera starts (the edge the hero came in by), `ms` how long the glide takes. */
  arrival(fromX: number, ms = 2400): void { this.arrive = { t: 0, ms, fromX, snap: true }; this.a3d.punch = 0.62; }

  /** Each frame, after the scene has moved everyone. */
  step(ms: number, f: WorldFrame): void {
    const a = this.a3d, h = f.hero;
    this.lead += (h.facing * LEAD - this.lead) * Math.min(1, ms / 600);
    const x0 = this.floor.x0 + HALF_VIEW, x1 = this.floor.x1 - HALF_VIEW;
    let fx = x1 > x0 ? Phaser.Math.Clamp(h.x + this.lead, x0, x1) : (this.floor.x0 + this.floor.x1) / 2;
    if (this.arrive) { // the glide in: wide and at the entry edge, easing onto the hero
      const ar = this.arrive; ar.t += ms; const k = Phaser.Math.Clamp(ar.t / ar.ms, 0, 1), e = k * k * (3 - 2 * k);
      fx = Phaser.Math.Linear(Phaser.Math.Clamp(ar.fromX, x0, x1), fx, e); a.punch = Phaser.Math.Linear(0.62, 1, e);
      if (k >= 1) { this.arrive = null; a.punch = 1; }
    }
    // a fight spreads the view a little (the nearest foe counts), as the arena's does
    let span = 0; for (const o of f.others) { const d = Math.hypot(o.x - h.x, (o.y - h.y) * 1.7); if (d < 700) span = Math.max(span, d * 0.5); }
    a.focus = { x: fx, y: h.y, z: h.z, span, floorZ: h.floorZ };
    if (this.arrive?.snap) { this.arrive.snap = false; a.snap((camOf(this.areaId).dist ?? 9) / 0.62); } // (the glide starts wide, straight on the entry — once the focus is known)
    a.anchors = [{ x: h.x, y: h.y, z: h.z }, ...f.others.map((o) => ({ x: o.x, y: o.y, z: o.z }))];
    a.bodies = f.bodies;
    a.flying = f.flying;
    a.dimWant = f.ult ? 0.6 : f.sig ? 0.25 : 0;
    this.focus3.x = h.x / 100; this.focus3.z = (h.y / 100) * 1.15; this.focus3.sunGateOpen = f.sunGateOpen;
    // the hero coming down (a jump's landing): the place's dust answers it
    const v = ms > 0 ? Math.max(0, ((this.heroZ - h.z) * 1000) / ms) : 0;
    if (this.heroZ > 6 && h.z <= 1) a.land(h.x, h.y, this.fallV);
    this.fallV = h.z > 1 ? (v || this.fallV) : 0; this.heroZ = h.z;
    a.step(ms, f.hitStop ? 0 : ms);
  }

  /** The hero at the map's end: the next map in 3D (its id and the entry x there), or nothing — then the end is a soft
   *  wall while that map is not built yet. */
  crossing(k: { x: number; vx: number; z: number; grounded: boolean; supportId?: string | null }, gateOpen = true): { area: string; x: number; fromX: number } | null {
    // the sky: one place over the island — entered on a cloud or a cloud floor, left when he stands on the ground again or has fallen well below the clouds
    const onSky = !!k.supportId && (k.supportId.startsWith('sky-') || k.supportId === 'cloud_haven' || k.supportId === 'sunfall_pass' || k.supportId === 'afterglow');
    if (this.areaId !== 'sky' && onSky && WORLD3D.has('sky')) return { area: 'sky', x: k.x, fromX: k.x - 300 };
    if (this.areaId === 'sky') {
      if (onSky || (!k.grounded && k.z > 500)) return null;
      const down = areaAt(k.x); if (WORLD3D.has(down.id)) { const nf = World3D.floorOf(down.id); return { area: down.id, x: Phaser.Math.Clamp(k.x, nf.x0 + 30, nf.x1 - 30), fromX: k.x }; }
      return null;
    }
    if (k.x > this.floor.x1 + 60 || k.x < this.floor.x0 - 60) { // put down far away (a portal, test mode): straight to that map, where he landed
      const far = areaAt(k.x);
      if (far.id !== this.areaId && WORLD3D.has(far.id)) { const nf = World3D.floorOf(far.id); return { area: far.id, x: Phaser.Math.Clamp(k.x, nf.x0 + 30, nf.x1 - 30), fromX: k.x < this.floor.x0 ? nf.x1 : nf.x0 }; }
    }
    for (const side of [1, -1] as const) {
      const edge = side > 0 ? this.floor.x1 : this.floor.x0;
      if (side > 0 ? k.x < edge - 14 : k.x > edge + 14) continue;
      if (!gateOpen && ((side > 0 && this.areaId === 'terraces_2') || (side < 0 && this.areaId === 'training'))) return null; // (the Sun Gate's own solids hold him: no wall, no crossing)
      const next = areaAt(edge + side * 40);
      if (next.id !== this.areaId && WORLD3D.has(next.id)) { const nf = World3D.floorOf(next.id); return { area: next.id, x: side > 0 ? nf.x0 + 30 : nf.x1 - 30, fromX: side > 0 ? nf.x0 : nf.x1 }; }
      k.x = side > 0 ? edge - 14 : edge + 14; if (side > 0 ? k.vx > 0 : k.vx < 0) k.vx = 0;
    }
    return null;
  }

  /** A map's floor (world px): the walk polygon's span, its back line where the polygon meets the map's left edge. */
  static floorOf(areaId: string): Floor {
    const a = AREAS[areaId], ys = a.walk.map((p) => p[1]), xs = a.walk.map((p) => p[0]);
    const left = Math.min(...xs), backPts = a.walk.filter((p) => p[0] <= left + 1).map((p) => p[1]);
    return { x0: a.x + left, x1: a.x + Math.max(...xs), back: backPts.length ? Math.min(...backPts) : Math.min(...ys), front: Math.max(...ys) };
  }

  /** The place torn down (the hero crossed to the next map): the stage's own teardown, unhooked from the scene's end. */
  dispose(): void { this.a3d.dispose(); }
}
