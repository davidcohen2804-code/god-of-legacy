import Phaser from 'phaser';
import GATE from '../data/world-goldgate.json';
import { WORLD_OBJECTS, type Pt, type WorldObject } from './WorldGeometry';

/** The Sun Gate (tools/world/goldgate.py): a golden gate with short stone walls across the terrace right of Ivy Heights. Closed (locked with its
 *  little sun) until the sun over Sunfall Pass has been crossed — the way on is up the stairs and over the clouds — then
 *  open for good. Drawn in narrow columns, each at the depth of the gate's foot line where it stands (whoever is in front
 *  of a part of it is drawn over that part), its posts and doors solid. */
const COLS = 32;
const BACK = 48;     // how deep its walls, pillars and doors stand behind their painted base (world px)

export const SUN_GATE = GATE as { img: { closed: string; open: string }; x: number; y: number; w: number; h: number; sx: number; sy: number; back: [number, number]; front: [number, number]; doors: [number, number]; foot: [number, number][] };
/** The gate line's x at depth y (its foot line, extended). */
export const sunGateX = (y: number): number => {
  const [bx, by] = SUN_GATE.back, [fx, fy] = SUN_GATE.front;
  return bx + ((fx - bx) * (y - by)) / (fy - by);
};

/** Its painted base's depth at x (between the measured columns; its ends held level). */
const lineY = (x: number): number => {
  const f = SUN_GATE.foot;
  if (x <= f[0][0]) return f[0][1];
  for (let i = 1; i < f.length; i++) if (x <= f[i][0]) return f[i - 1][1] + ((f[i][1] - f[i - 1][1]) * (x - f[i - 1][0])) / (f[i][0] - f[i - 1][0]);
  return f[f.length - 1][1];
};
/** Its footprint along its base from x0 to x1: from the painted base back by its thickness (whoever stands in front of
 *  it stands before its face, never in it), a strip per measured column; its ends sealed (ext: past the back / front). */
const strips = (id: string, x0: number, x1: number, ext0 = 0, ext1 = 0): WorldObject[] => {
  const f = SUN_GATE.foot.filter((p) => p[0] >= x0 - 1e-6 && p[0] <= x1 + 1e-6), out: WorldObject[] = [];
  for (let i = 0; i + 1 < f.length; i++) {
    const [ax, ay] = f[i], [bx, by] = f[i + 1], top = Math.min(ay, by) - BACK - (i === 0 ? ext0 : 0), bot = Math.max(ay, by) + 2 + (i + 2 === f.length ? ext1 : 0);
    out.push(solid(`${id}-${i}`, [[ax - 1, top], [bx + 1, top], [bx + 1, bot], [ax - 1, bot]]));
  }
  return out;
};
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
        const x0 = i * cw, mid = SUN_GATE.x + (x0 + cw / 2) * SUN_GATE.sx;
        // its depth: the foot line where this column stands (its back end behind whoever is in front, its front end over)
        // (the deepest base near it: a pillar standing out in front covers whoever stands beside it, behind its face)
        const near = SUN_GATE.foot.filter((p) => Math.abs(p[0] - mid) <= 36), y = near.length ? Math.max(...near.map((p) => p[1])) : lineY(mid);
        this.cols.push(scene.add.image(SUN_GATE.x, SUN_GATE.y, load(this.isOpen ? 'open' : 'closed')).setOrigin(0, 0).setScale(SUN_GATE.sx, SUN_GATE.sy).setCrop(x0, 0, cw, SUN_GATE.h).setDepth(y + 0.5));
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
    const dx = (SUN_GATE.doors[0] + SUN_GATE.doors[1]) / 2;
    const flash = this.scene.add.ellipse(dx, lineY(dx) - 110, 200, 240, 0xffe2a0, 0)
      .setDepth(lineY(dx) + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, alpha: { from: 0, to: 0.75 }, duration: 380, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => flash.destroy() });
  }

  /** Its solid parts in the world: the walls and pillars always, the doors while closed. */
  private solids(): void {
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id.startsWith('sun-gate')) WORLD_OBJECTS.splice(i, 1);
    const f = SUN_GATE.foot, x0 = f[0][0], x1 = f[f.length - 1][0], [d0, d1] = SUN_GATE.doors;
    if (!this.isOpen) WORLD_OBJECTS.push(...strips('sun-gate', x0, x1, 30, 40));
    else WORLD_OBJECTS.push(...strips('sun-gate-back', x0, d0 + 26, 30, 0), ...strips('sun-gate-front', d1 - 26, x1, 0, 40));
  }

  destroy(): void {
    for (const c of this.cols) c.destroy(); this.cols = [];
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id.startsWith('sun-gate')) WORLD_OBJECTS.splice(i, 1);
  }
}
