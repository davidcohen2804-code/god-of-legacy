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
  // Jump frames: the baked elevation is replaced by the gameplay-free jump lift, so the figure stands on its own bottom.
  const oy = a === 'jump' ? Math.min(1, (r.ay - r.y) / r.h) : (r.ay - r.y) / r.h;
  p.setOrigin((r.ax - r.x) / r.w, oy);
  p.setScale(at.scaleByDirection[dir]);
  p.setFlipX(false);
}

/** Looping state (idle / walk / run) for an elapsed time. */
export function setAtlasLoop(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, a: 'idle' | 'walk' | 'run', ms: number): void {
  const n = atlasFrameCount(cls, dir, a);
  setAtlasFrame(p, cls, dir, a, n ? Math.floor((ms * (FPS[a] ?? 8)) / 1000) % n : 0);
}

type Pose = [AtlasAction, number];
interface PoseSeq { cast: Pose[]; active: Pose[]; recovery: Pose[] }
const a = (...i: number[]): Pose[] => i.map((n) => ['attack', n] as Pose);
/**
 * Per-skill body sequences built from the base sheet's real poses in all 4 directions (the irregular skill sheets
 * have overlapping figures, baked VFX and mostly side views, so they are not used for the body).
 * Archer attack: 0 nock, 1 draw, 2 full draw, 3 release. Samurai attack: 0 guard, 1 lunge, 2 slash, 3 follow-through.
 * Cast poses split castMs, active poses split the active window (min 110 ms, borrowed from recovery for detached
 * projectiles), recovery poses split the rest. Cosmetic only; the release / strike pose starts at the active boundary.
 */
const SEQ: Record<string, PoseSeq> = {
  // Archer
  quick_shot: { cast: a(1, 2), active: a(3), recovery: [['attack', 3], ['idle', 0]] },
  multi_shot: { cast: a(0, 1, 2), active: a(3, 2, 3), recovery: [['attack', 3], ['idle', 0]] },
  piercing_arrow: { cast: a(0, 1, 2, 2), active: a(3), recovery: [['attack', 3], ['attack', 3], ['idle', 0]] },
  explosive_arrow: { cast: a(0, 1, 2, 2), active: a(3), recovery: [['attack', 3], ['attack', 3], ['idle', 0]] },
  vine_trap: { cast: [['attack', 0], ['jump', 2]], active: [['jump', 2]], recovery: [['jump', 2], ['idle', 0]] },
  rain_of_arrows: { cast: a(0, 1, 2), active: a(3, 3), recovery: [['attack', 3], ['idle', 0]] },
  wind_step: { cast: [['jump', 2]], active: [['jump', 0], ['jump', 1]], recovery: [['jump', 2], ['idle', 0]] },
  natures_wrath: { cast: [['attack', 0], ['jump', 2], ['attack', 2]], active: a(3), recovery: [['attack', 3], ['jump', 2], ['idle', 0]] },
  // Samurai
  quick_slash: { cast: a(0), active: a(1, 2), recovery: a(3) },
  shadow_step: { cast: [['run', 1]], active: [['run', 3], ['attack', 2]], recovery: [['attack', 3], ['idle', 0]] },
  sword_wave: { cast: a(0, 1), active: a(2), recovery: [['attack', 3], ['idle', 0]] },
  mirage: { cast: [['run', 0], ['run', 2]], active: a(2, 1, 2), recovery: [['attack', 3], ['idle', 0]] },
  blossom_storm: { cast: a(0, 1), active: a(2, 1, 2), recovery: [['attack', 3], ['idle', 0]] },
  iai_strike: { cast: a(0, 0), active: a(2), recovery: [['attack', 3], ['attack', 3], ['idle', 0]] },
  spin_cut: { cast: a(0), active: a(2, 1, 2), recovery: [['attack', 3], ['idle', 0]] },
  dragon_slash: { cast: [['attack', 0], ['jump', 0], ['jump', 1]], active: a(2), recovery: [['attack', 3], ['attack', 3], ['idle', 0]] },
};
const DEFAULT_SEQ: PoseSeq = { cast: a(0, 1), active: a(2), recovery: a(3) };
const MIN_ACTIVE_POSE_MS = 110;

/** Pose for a skill timeline (elapsed since the accepted cast). Returns the pose actually shown (QA). */
export function atlasSkillPoseAt(skillId: string, elapsed: number, castMs: number, activeMs: number, lockMs: number): Pose {
  const q = SEQ[skillId] ?? DEFAULT_SEQ;
  const recMs = Math.max(0, lockMs - castMs - activeMs);
  const act = Math.max(activeMs, Math.min(MIN_ACTIVE_POSE_MS, activeMs + recMs));
  const pick = (list: Pose[], t: number, span: number) => list[Math.min(list.length - 1, Math.floor((t / Math.max(1, span)) * list.length))];
  if (elapsed < castMs) return pick(q.cast, elapsed, castMs);
  if (elapsed < castMs + act) return pick(q.active, elapsed - castMs, act);
  return pick(q.recovery, elapsed - castMs - act, Math.max(1, lockMs - castMs - act));
}

export function setAtlasSkillPose(p: Phaser.GameObjects.Sprite, cls: string, skillId: string, dir: Dir, elapsed: number, castMs: number, activeMs: number, lockMs: number): void {
  const [act, i] = atlasSkillPoseAt(skillId, elapsed, castMs, activeMs, lockMs);
  setAtlasFrame(p, cls, dir, act, i);
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

// ---- Movement: run loop and jump phases ----

export function setAtlasRun(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, ms: number): void { setAtlasLoop(p, cls, dir, 'run', ms); }

/** Jump phase: crouch 2 for take-off and landing, rise 0, fall 1 (lift itself is applied by BodyFx). */
export function setAtlasJump(p: Phaser.GameObjects.Sprite, cls: string, dir: Dir, phase: 'takeoff' | 'rise' | 'fall' | 'land'): void {
  const fall = JUMP_FALL[cls]?.[dir] ?? 1;
  setAtlasFrame(p, cls, dir, 'jump', phase === 'rise' ? 0 : phase === 'fall' ? fall : 2);
}
/** Archer down/right jump frame 1 overlaps neighbouring figures on the sheet: the airborne frame 0 is held instead. */
const JUMP_FALL: Record<string, Partial<Record<Dir, number>>> = { archer: { down: 0, right: 0 } };
