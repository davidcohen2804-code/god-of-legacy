// Archer / Samurai body sprites: explicit rectangles from their irregular base sheets (src/data/*-atlas.json).
// Every frame is drawn from its own feet anchor; one scale per direction keeps the idle body at 108 world px
// in every state (idle / walk / run / jump / attack / hurt / death), so state changes never pop size or height.
import Phaser from 'phaser';
import ARCHER from '../data/archer-atlas.json';
import SAMURAI from '../data/samurai-atlas.json';
import { Dir } from './collision';

export type AtlasAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'death';
type Rect = { x: number; y: number; w: number; h: number; ax: number; ay: number };
interface ClassAtlasData { sheet: string; directions: Record<Dir, Record<AtlasAction, Rect[]>>; scaleByDirection: Record<Dir, number> }

const ATLASES: Record<string, ClassAtlasData> = {
  archer: ARCHER as unknown as ClassAtlasData,
  samurai: SAMURAI as unknown as ClassAtlasData,
};
const FPS: Partial<Record<AtlasAction, number>> = { idle: 5, walk: 8, run: 10 };
const DIRS: Dir[] = ['down', 'right', 'left', 'up'];
const key = (cls: string) => `class-${cls}`;
const frameName = (dir: Dir, a: AtlasAction, i: number) => `${dir}-${a}-${i}`;

export function isAtlasClass(classId: string): boolean { return classId in ATLASES; }

export function preloadClassAtlases(scene: Phaser.Scene): void {
  for (const [cls, a] of Object.entries(ATLASES)) if (!scene.textures.exists(key(cls))) scene.load.image(key(cls), a.sheet);
}

/** Registers every explicit rectangle once as a named texture frame. */
export function registerClassAtlasFrames(scene: Phaser.Scene): void {
  for (const [cls, a] of Object.entries(ATLASES)) {
    if (!scene.textures.exists(key(cls))) continue;
    const tex = scene.textures.get(key(cls));
    for (const dir of DIRS) {
      for (const [act, rects] of Object.entries(a.directions[dir]) as [AtlasAction, Rect[]][]) {
        rects.forEach((r, i) => { const n = frameName(dir, act, i); if (!tex.has(n)) tex.add(n, 0, r.x, r.y, r.w, r.h); });
      }
    }
  }
}

export function atlasFrameCount(cls: string, dir: Dir, a: AtlasAction): number { return ATLASES[cls]?.directions[dir][a]?.length ?? 0; }

export function setAtlasFrame(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, a: AtlasAction, i: number): void {
  const at = ATLASES[cls];
  const rects = at.directions[dir][a];
  const idx = Math.max(0, Math.min(rects.length - 1, i)), r = rects[idx];
  if (p.anims.isPlaying) p.anims.stop();
  p.setTexture(key(cls), frameName(dir, a, idx));
  p.setOrigin((r.ax - r.x) / r.w, (r.ay - r.y) / r.h);
  p.setScale(at.scaleByDirection[dir]);
}

/** Looping state (idle / walk / run) for an elapsed time. */
export function setAtlasLoop(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, a: 'idle' | 'walk' | 'run', ms: number): void {
  const n = atlasFrameCount(cls, dir, a);
  setAtlasFrame(p, cls, dir, a, n ? Math.floor((ms * (FPS[a] ?? 8)) / 1000) % n : 0);
}

/**
 * Skill / basic-action body pose from the sheet's 4 attack frames, synchronized to the existing Skill Engine phases:
 * cast -> frames 0..1, active start -> frame 2 (release / strike), recovery -> frame 3. Cosmetic only.
 */
export function setAtlasSkillPose(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, elapsed: number, castMs: number, activeMs: number): void {
  let i: number;
  if (elapsed < castMs) i = elapsed < castMs / 2 ? 0 : 1;
  else if (elapsed < castMs + activeMs) i = 2;
  else i = 3;
  setAtlasFrame(p, cls, dir, 'attack', i);
}

/** Hurt pose while the existing hit flash runs. */
export function setAtlasHurt(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, flashMs: number, totalMs: number): void {
  setAtlasFrame(p, cls, dir, 'hurt', flashMs < totalMs / 2 ? 0 : 1);
}

/** Death frames over the existing death fade, then hold the last frame. */
export function setAtlasDeath(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, deadMs: number, fadeMs: number): void {
  const n = atlasFrameCount(cls, dir, 'death');
  setAtlasFrame(p, cls, dir, 'death', Math.min(n - 1, Math.floor((deadMs / fadeMs) * n)));
}

// ---- Movement hooks (art mapped; no gameplay yet: the game has no sprint or jump mechanic) ----

/** Run loop (hook for a future sprint mechanic). */
export function setAtlasRun(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, ms: number): void { setAtlasLoop(p, cls, dir, 'run', ms); }

/** Jump phase hook: 0 take-off, 1 airborne, 2 landing (art elevation is baked into the frames). */
export function setAtlasJump(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, phase: 0 | 1 | 2): void { setAtlasFrame(p, cls, dir, 'jump', phase); }
