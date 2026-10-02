// Cosmetic skill VFX (never a collider). Timeline per skills asset manifest:
// frames 0..2 during cast (castMs/3 each), peak frame 3 exactly at active start, then 3..7 at 24 FPS, removed.
// Bolt: loops from projectile spawn. Confirmed-hit impact: frames 2..7 at 24 FPS.
import Phaser from 'phaser';
import MANIFEST from '../data/skills-asset-manifest.json';
import { Dir } from '../world/collision';
import { EXTENSION_VFX } from './SkillExtension';

type Sheet = (typeof MANIFEST.sheets)[number];
const SHEETS = new Map<string, Sheet>(MANIFEST.sheets.map((s) => [s.id, s]));
// Four-class extension sheets: 8 frames x 256, one row, 24 FPS, centred origin (same timeline rules).
for (const v of EXTENSION_VFX) {
  if (SHEETS.has(v.id)) continue;
  const base = SHEETS.get('ground_breaker')!;
  SHEETS.set(v.id, { ...base, id: v.id, path: v.path, origin: { x: 0.5, y: 0.5 }, displaySize: { width: 256, height: 256 }, nativeDirection: v.ground ? 'ground-plane' : 'right', repeat: v.ground ? 0 : base.repeat } as Sheet);
}
const sheetKey = (id: string) => `skillfx-${id}`;
const MAX_INSTANCES = 48;
const RELEASE_MS = 1000 / 24;
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: -90 };
/** Upright bursts (rise from the ground in front of the caster): never rotated, mirrored on left. */
const UPRIGHT = new Set(['final_strike', 'dragon_slash']);
/** Projectile flight loops (frame range) for sheets whose later frames are the impact / build-up. */
const LOOP: Record<string, [number, number]> = {
  quick_shot: [3, 6], piercing_arrow: [3, 6], explosive_arrow: [0, 2], sword_wave: [3, 6],
};

/**
 * Orientation by facing for a sheet drawn pointing right: left mirrors (never upside-down), up/down rotate ±90°.
 * Ground-plane and upright effects are never rotated (left mirrors so asymmetric art still faces the caster's way).
 */
export function orientVfx(img: Phaser.GameObjects.Image, id: string, dir: Dir): void {
  const s = SHEETS.get(id);
  const ground = s?.nativeDirection === 'ground-plane';
  img.setFlipX(dir === 'left');
  img.setAngle(ground || UPRIGHT.has(id) || id === 'rising_slash' || dir === 'left' ? 0 : ANGLE[dir]);
}

export const GROUND_DEPTH = 1; // ground sigils lie on the floor, under every actor (actors sort by feet y >= 286)
export const TOP_DEPTH = 100000;

export function preloadSkillVfx(scene: Phaser.Scene): void {
  for (const s of SHEETS.values()) {
    if (!scene.textures.exists(sheetKey(s.id))) scene.load.spritesheet(sheetKey(s.id), s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
  }
  for (const i of MANIFEST.icons) if (!scene.textures.exists(`skillicon-${i.id}`)) scene.load.image(`skillicon-${i.id}`, i.path);
}

interface Fx { img: Phaser.GameObjects.Image; t: number; castMs: number; mode: 'cast' | 'impact'; follow?: () => { x: number; y: number } }

export class SkillVfx {
  private list: Fx[] = [];
  constructor(private scene: Phaser.Scene) {}

  /**
   * Cast-synchronized effect. `at` = position (or a follow function), `ground` effects stay floor-aligned.
   * Directional strips rotate to facing about their shared origin; rising slash keeps its vertical swing (flipX by facing).
   */
  playCast(id: string, at: { x: number; y: number } | (() => { x: number; y: number }), dir: Dir, castMs: number, startElapsed = 0): void {
    const s = SHEETS.get(id);
    if (!s) return;
    const p = typeof at === 'function' ? at() : at;
    const img = this.scene.add.image(p.x, p.y, sheetKey(id), 0).setOrigin(s.origin.x, s.origin.y);
    img.setDisplaySize(s.displaySize.width, s.displaySize.height);
    const ground = s.nativeDirection === 'ground-plane';
    orientVfx(img, id, dir);
    img.setDepth(ground ? GROUND_DEPTH : TOP_DEPTH);
    this.push({ img, t: startElapsed, castMs, mode: 'cast', follow: typeof at === 'function' ? at : undefined });
  }

  /** Confirmed-hit impact (starts on peak frame 2). */
  impact(x: number, y: number): void {
    const s = SHEETS.get('impact')!;
    const img = this.scene.add.image(x, y, sheetKey('impact'), 2).setOrigin(s.origin.x, s.origin.y).setDepth(TOP_DEPTH + 1);
    img.setDisplaySize(s.displaySize.width, s.displaySize.height);
    this.push({ img, t: 0, castMs: 0, mode: 'impact' });
  }

  /** Looping projectile visual (caller positions it and destroys it on termination). */
  projectile(id: string, dir: Dir): Phaser.GameObjects.Image {
    const s = SHEETS.get(id)!;
    const img = this.scene.add.image(0, 0, sheetKey(id), LOOP[id]?.[0] ?? 0).setOrigin(s.origin.x, s.origin.y);
    orientVfx(img, id, dir);
    img.setDisplaySize(s.displaySize.width, s.displaySize.height);
    return img;
  }

  /** Loop frame for a projectile age. */
  static loopFrame(id: string, ageMs: number): number {
    const s = SHEETS.get(id)!, [a, b] = LOOP[id] ?? [0, s.frameCount - 1];
    return a + (Math.floor((ageMs * s.fps) / 1000) % (b - a + 1));
  }

  update(ms: number): void {
    this.list = this.list.filter((f) => {
      f.t += ms;
      let frame: number;
      if (f.mode === 'impact') {
        frame = 2 + Math.floor(f.t / RELEASE_MS);
      } else if (f.t < f.castMs) {
        frame = Math.min(2, Math.floor(f.t / (f.castMs / 3)));
      } else {
        frame = 3 + Math.floor((f.t - f.castMs) / RELEASE_MS);
      }
      if (frame > 7) { f.img.destroy(); return false; }
      f.img.setFrame(frame);
      if (f.follow) { const p = f.follow(); f.img.setPosition(p.x, p.y); }
      return true;
    });
  }

  /** For QA: live cosmetic instances. */
  get count(): number { return this.list.length; }

  destroy(): void {
    for (const f of this.list) f.img.destroy();
    this.list = [];
  }

  private push(f: Fx): void {
    this.list.push(f);
    while (this.list.length > MAX_INSTANCES) this.list.shift()!.img.destroy(); // cosmetic cap only
  }
}
