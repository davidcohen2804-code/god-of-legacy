// MapleStory-style death: the body staggers and fades, a tombstone drops at the feet and the character's ghost
// floats up. One shared ghost for every character, so no body frames (and no cosmetic work) are needed for dying.
import Phaser from 'phaser';
import { actorDepth } from '../world/WorldGeometry';

const GHOST = 'fx-death-ghost', TOMB = 'fx-death-tomb';
const SCALE = 0.42; // 256-px cells → ~108-px world sprites (same size class as the character)

export function preloadDeathFx(scene: Phaser.Scene): void {
  if (!scene.textures.exists(GHOST)) scene.load.spritesheet(GHOST, 'assets/final/fx/death/ghost.png', { frameWidth: 256, frameHeight: 256 });
  if (!scene.textures.exists(TOMB)) scene.load.spritesheet(TOMB, 'assets/final/fx/death/tomb.png', { frameWidth: 256, frameHeight: 256 });
}

export class DeathFx {
  private ghost: Phaser.GameObjects.Image;
  private tomb: Phaser.GameObjects.Image;
  private t = -1;
  private x = 0; private y = 0; private z = 0;
  private left = false;

  constructor(private scene: Phaser.Scene) {
    this.ghost = scene.add.image(0, 0, GHOST, 0).setOrigin(0.5, 0.86).setScale(SCALE).setVisible(false);
    this.tomb = scene.add.image(0, 0, TOMB, 0).setOrigin(0.5, 232 / 256).setScale(SCALE).setVisible(false);
  }

  /** Begin at the feet point (x, y) / height z, facing left or right. */
  start(x: number, y: number, z: number, facingLeft: boolean): void { this.t = 0; this.x = x; this.y = y; this.z = z; this.left = facingLeft; }
  stop(): void { this.t = -1; this.ghost.setVisible(false); this.tomb.setVisible(false); }
  get active(): boolean { return this.t >= 0; }

  update(ms: number): void {
    if (this.t < 0) return;
    this.t += ms;
    const t = this.t, d = actorDepth(this.x, this.y, 0);
    if (this.scene.textures.exists(TOMB)) { // drop (0–180) · hit (180–300) · settle (300–420) · rest
      const f = t < 180 ? 0 : t < 300 ? 1 : t < 420 ? 2 : 3, dropY = t < 180 ? -90 * (1 - t / 180) * (1 - t / 180) : 0;
      this.tomb.setFrame(f).setPosition(this.x, this.y + dropY).setDepth(d - 0.5).setAlpha(Math.min(1, t / 80)).setVisible(true);
    }
    if (this.scene.textures.exists(GHOST)) { // rises from the chest, bobbing, and thins out
      const rise = Math.min(1, t / 2400), bob = Math.sin(t / 260) * 4;
      this.ghost.setFrame(Math.floor(t / 110) % 6).setFlipX(this.left).setPosition(this.x, this.y - this.z - 30 - rise * 70 + bob).setDepth(d + 0.5)
        .setAlpha(Math.min(1, t / 260) * (t > 2000 ? Math.max(0, 1 - (t - 2000) / 500) : 1) * 0.92).setVisible(true);
    }
  }

  destroy(): void { this.ghost.destroy(); this.tomb.destroy(); }
}
