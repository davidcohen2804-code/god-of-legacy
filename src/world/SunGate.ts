import Phaser from 'phaser';
import GATE from '../data/world-goldgate.json';
import { WORLD_OBJECTS, type Pt, type WorldObject } from './WorldGeometry';

/** The Sun Gate (tools/world/goldgate.py): a golden gate across the terrace right of Ivy Heights. Closed (locked with its
 *  little sun) until the sun over Sunfall Pass has been crossed — the way on is up the stairs and over the clouds — then
 *  open for good. Drawn in narrow columns, each at the depth of the gate's foot line where it stands (whoever is in front
 *  of a part of it is drawn over that part), its posts and doors solid. */
const COLS = 12;
const THICK = 16;    // half the width of the closed doors' footprint (world px)
const POST = 50;     // half the size of a pillar's footprint

export const SUN_GATE = GATE as { img: { closed: string; open: string }; x: number; y: number; w: number; h: number; back: [number, number]; front: [number, number] };
/** The gate line's x at depth y (its foot line, extended). */
export const sunGateX = (y: number): number => {
  const [bx, by] = SUN_GATE.back, [fx, fy] = SUN_GATE.front;
  return bx + ((fx - bx) * (y - by)) / (fy - by);
};

const rect = (cx: number, cy: number, hx: number, hy: number): Pt[] => [[cx - hx, cy - hy], [cx + hx, cy - hy], [cx + hx, cy + hy], [cx - hx, cy + hy]];
const solid = (id: string, foot: Pt[]): WorldObject => ({ id, footprint: foot, height: 4000, cover: 'hard', occluder: [], frontY: Math.max(...foot.map((p) => p[1])) + 1 });

export class SunGate {
  private cols: Phaser.GameObjects.Image[] = [];
  private isOpen: boolean;

  constructor(private scene: Phaser.Scene, open: boolean) {
    this.isOpen = open;
    const load = (k: 'closed' | 'open') => `sun-gate-${k}`;
    const make = () => {
      if (!scene.textures.exists(load('closed')) || !scene.textures.exists(load('open')) || this.cols.length) return;
      const cw = Math.ceil(SUN_GATE.w / COLS);
      for (let i = 0; i < COLS; i++) {
        const x0 = i * cw, mid = SUN_GATE.x + x0 + cw / 2;
        // its depth: the foot line where this column stands (the back pillar's columns behind, the front pillar's in front)
        const by = SUN_GATE.back[1], fy = SUN_GATE.front[1], t = Phaser.Math.Clamp((mid - SUN_GATE.back[0]) / (SUN_GATE.front[0] - SUN_GATE.back[0]), 0, 1);
        const img = scene.add.image(SUN_GATE.x, SUN_GATE.y, load(this.isOpen ? 'open' : 'closed')).setOrigin(0, 0).setCrop(x0, 0, cw, SUN_GATE.h).setDepth(by + (fy - by) * t + 0.5);
        this.cols.push(img);
      }
    };
    for (const k of ['closed', 'open'] as const) if (!scene.textures.exists(load(k))) scene.load.image(load(k), SUN_GATE.img[k]);
    if (scene.textures.exists(load('closed')) && scene.textures.exists(load('open'))) make();
    else { scene.load.on(Phaser.Loader.Events.COMPLETE, make); if (!scene.load.isLoading()) scene.load.start(); }
    this.solids();
  }

  get open(): boolean { return this.isOpen; }

  /** The gate unlocked: its doors swing open (a flash of warm light), and the way is free from now on. */
  unlock(): void {
    if (this.isOpen) return;
    this.isOpen = true; this.solids();
    for (const c of this.cols) c.setTexture('sun-gate-open');
    const flash = this.scene.add.ellipse((SUN_GATE.back[0] + SUN_GATE.front[0]) / 2, (SUN_GATE.back[1] + SUN_GATE.front[1]) / 2 - 160, 220, 340, 0xffe2a0, 0)
      .setDepth(SUN_GATE.front[1] + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, alpha: { from: 0, to: 0.75 }, duration: 380, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => flash.destroy() });
  }

  /** Its solid parts in the world: both pillars always, the doors while closed. */
  private solids(): void {
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id.startsWith('sun-gate')) WORLD_OBJECTS.splice(i, 1);
    const [bx, by] = SUN_GATE.back, [fx, fy] = SUN_GATE.front;
    WORLD_OBJECTS.push(solid('sun-gate-back', rect(bx, by - 6, POST, POST)), solid('sun-gate-front', rect(fx, fy - 10, POST, POST)));
    if (!this.isOpen) WORLD_OBJECTS.push(solid('sun-gate-doors', [[bx - THICK, by - 30], [bx + THICK, by - 30], [fx + THICK, fy + 30], [fx - THICK, fy + 30]]));
  }

  destroy(): void {
    for (const c of this.cols) c.destroy(); this.cols = [];
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id.startsWith('sun-gate')) WORLD_OBJECTS.splice(i, 1);
  }
}
