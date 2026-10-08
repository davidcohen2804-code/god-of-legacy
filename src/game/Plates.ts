// Name plates in the world, in the UI's language: a dark rounded pill with a fine gold edge (players, NPCs). Drawn once
// as a texture at twice the size (sharp when the game is scaled up) and stretched only in its middle (nine-slice).
import Phaser from 'phaser';

const KEY = 'gl-plate';
/** Texture size (2x): a full pill 52 tall, its round ends 26 wide. */
const TH = 52, TR = 26, TW = 160;

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEY)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0x0d1421, 0.88); g.fillRoundedRect(0, 0, TW, TH, TR);
  g.lineStyle(2, 0xe7c47c, 0.5); g.strokeRoundedRect(1, 1, TW - 2, TH - 2, TR - 1);
  g.generateTexture(KEY, TW, TH); g.destroy();
}

/** A plate `w` x `h` design px centred on (x, y). */
export function namePlate(scene: Phaser.Scene, x: number, y: number, w: number, h = 26): Phaser.GameObjects.NineSlice {
  ensureTexture(scene);
  const k = h / (TH / 2);   // plates thinner / thicker than 26 keep round ends
  return scene.add.nineslice(x, y, KEY, undefined, Math.max(TH, (w * 2) / k), TH, TR, TR, 0, 0).setScale(k / 2);
}

const KEYCAP = 'gl-keycap';
/** A key cap (the talk / enter prompt over an NPC or a portal): a rounded dark key with a light edge, `d` px square. */
export function keyCap(scene: Phaser.Scene, x: number, y: number, d = 30): Phaser.GameObjects.Image {
  if (!scene.textures.exists(KEYCAP)) {
    const g = scene.make.graphics({}, false), s = 64, r = 14;
    g.fillStyle(0x070b13, 0.55); g.fillRoundedRect(0, 4, s, s - 4, r);          // its depth under it
    g.fillStyle(0x1c2639, 0.97); g.fillRoundedRect(0, 0, s, s - 5, r);
    g.lineStyle(2, 0xffffff, 0.28); g.strokeRoundedRect(1, 1, s - 2, s - 7, r - 1);
    g.generateTexture(KEYCAP, s, s); g.destroy();
  }
  return scene.add.image(x, y, KEYCAP).setDisplaySize(d, d);
}
