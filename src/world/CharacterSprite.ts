// Shared sprite helpers for the courtyard characters (local player and PvP remote players).
// Feet x/y never change between states: every frame is drawn from its foot anchor.
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import COMBAT from '../data/training-combat.json';
import MAGE_ATLAS from '../data/book-mage-atlas.json';
import { BOOK_MAGE_WORLD } from '../config/layout';
import { Dir } from './collision';

const T = ATLAS.textures;
const CT = COMBAT_ASSETS.textures;
const A = COMBAT.attack;

type MageRect = { x: number; y: number; w: number; h: number; ax: number; ay: number };
export const MAGE = MAGE_ATLAS as unknown as Record<Dir, { idle: MageRect[]; walk: MageRect[] }>;
const mageFrameName = (dir: Dir, action: 'idle' | 'walk', i: number) => `mage-${dir}-${action}-${i}`;

/** Explicit rectangles from the irregular Book Mage sheet, registered once as named texture frames. */
export function registerMageFrames(scene: Phaser.Scene): void {
  const tex = scene.textures.get(BOOK_MAGE_WORLD.sheetKey);
  for (const dir of ['down', 'left', 'right', 'up'] as Dir[]) {
    for (const action of ['idle', 'walk'] as const) {
      MAGE[dir][action].forEach((r, i) => { const n = mageFrameName(dir, action, i); if (!tex.has(n)) tex.add(n, 0, r.x, r.y, r.w, r.h); });
    }
  }
}

/** Book Mage frame with its foot anchor as origin; scale matches the Warrior's visible body height. */
export function setMageFrame(p: Phaser.GameObjects.Sprite, dir: Dir, action: 'idle' | 'walk', i: number): void {
  const r = MAGE[dir][action][i];
  if (p.anims.isPlaying) p.anims.stop();
  p.setTexture(BOOK_MAGE_WORLD.sheetKey, mageFrameName(dir, action, i));
  p.setOrigin((r.ax - r.x) / r.w, (r.ay - r.y) / r.h);
  p.setScale(WORLD.player.displayHeight / MAGE.down.idle[0].h);
}

export function mageWalkIndex(dir: Dir, walkMs: number): number {
  return Math.floor((walkMs * BOOK_MAGE_WORLD.walkFps) / 1000) % MAGE[dir].walk.length;
}

function setBodyScale(p: Phaser.GameObjects.Sprite, frameHeight: number, displayHeight: number, origin: { x: number; y: number }): void {
  p.setOrigin(origin.x, origin.y);
  p.setScale(displayHeight / frameHeight);
}

export function setWarriorIdle(p: Phaser.GameObjects.Sprite, dir: Dir): void {
  if (p.anims.isPlaying) p.anims.stop();
  p.setTexture(T.idle.key, ATLAS.directions[dir].idleFrame);
  setBodyScale(p, T.idle.frameHeight, WORLD.player.displayHeight, WORLD.player.spriteOrigin);
}

export function setWarriorWalk(p: Phaser.GameObjects.Sprite, dir: Dir): void {
  setBodyScale(p, T.walk.frameHeight, WORLD.player.displayHeight, WORLD.player.spriteOrigin);
  p.anims.play(`warrior-walk-${dir}`, true); // continues; never restarts per update
}

/** Attack pose for an attack elapsed time (Stage 5 phases). */
export function setWarriorAttackFrame(p: Phaser.GameObjects.Sprite, dir: Dir, elapsed: number): void {
  if (p.anims.isPlaying) p.anims.stop();
  setBodyScale(p, CT.attack.frameHeight, CT.attack.displayHeight, CT.attack.origin);
  let phase = 0, acc = 0;
  for (let i = 0; i < A.phaseDurationMs.length; i++) { acc += A.phaseDurationMs[i]; if (elapsed < acc) { phase = i; break; } phase = i; }
  p.setTexture(CT.attack.key, COMBAT_ASSETS.attackFrames[dir][phase]);
}
