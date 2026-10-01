// Stage 4: Legacy Courtyard — one fixed-camera map, 4-direction idle/walk, foot-circle collision.
// All geometry, speed and sprite sizing come from src/data (world coordinates = original map pixels).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import { WORLD_HUD } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { WorldHUD } from '../ui/WorldHUD';

type Dir = 'down' | 'left' | 'right' | 'up';
type Pt = readonly number[];

const T = ATLAS.textures;
const R = WORLD.player.footRadius;
const POLY = WORLD.walkablePolygon as Pt[];

function insidePolygon(x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const a = POLY[i], b = POLY[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

function distToSegment(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Phaser.Math.Clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Whole foot circle inside the walkable polygon and outside every obstacle rectangle. */
function footAllowed(x: number, y: number): boolean {
  if (!insidePolygon(x, y)) return false;
  for (let i = 0; i < POLY.length; i++) if (distToSegment(x, y, POLY[i], POLY[(i + 1) % POLY.length]) < R) return false;
  return !WORLD.obstacles.some((o) =>
    Math.hypot(x - Phaser.Math.Clamp(x, o.x, o.x + o.width), y - Phaser.Math.Clamp(y, o.y, o.y + o.height)) <= R);
}

export class LegacyCourtyardScene extends Phaser.Scene {
  /** Read by the QA panel: x,y are the feet. */
  player?: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Ellipse;
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private dir: Dir = ATLAS.initialDirection as Dir;
  private hud?: WorldHUD;

  constructor() { super('LegacyCourtyardScene'); }

  preload(): void {
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    for (const t of [T.walk, T.idle]) {
      if (!this.textures.exists(t.key)) this.load.spritesheet(t.key, t.file, { frameWidth: t.frameWidth, frameHeight: t.frameHeight });
    }
  }

  create(): void {
    const character = CharacterStore.getSelectedCharacter();
    if (!character) { this.scene.start('CharacterSelectScene'); return; }

    // Map in world pixels; fixed camera fits it (contain), no stretching.
    this.add.image(0, 0, T.map.key).setOrigin(0, 0);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(cam.width / WORLD.camera.worldWidth, cam.height / WORLD.camera.worldHeight));
    cam.centerOn(WORLD.coordinateSpace.width / 2, WORLD.coordinateSpace.height / 2);

    for (const [d, def] of Object.entries(ATLAS.directions)) {
      const key = `warrior-walk-${d}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key, frames: this.anims.generateFrameNumbers(T.walk.key, { frames: def.walkFrames }),
          frameRate: ATLAS.walkFrameRate, repeat: ATLAS.walkRepeat,
        });
      }
    }

    const { x, y } = WORLD.spawn;
    const S = WORLD_HUD.shadow;
    this.shadow = this.add.ellipse(x, y + S.offsetY, S.w, S.h, 0x000000, S.alpha);
    this.player = this.add.sprite(x, y, T.idle.key, ATLAS.directions[this.dir].idleFrame)
      .setOrigin(WORLD.player.spriteOrigin.x, WORLD.player.spriteOrigin.y);
    this.player.setScale(WORLD.player.displayHeight / T.idle.frameHeight);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as LegacyCourtyardScene['keys'];

    // Losing focus stops movement.
    const stop = () => kb.resetKeys();
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, character.name, () => this.scene.start('CharacterSelectScene'));
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.hud?.layout());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      kb.resetKeys();
      kb.removeAllKeys(true);
      this.hud?.destroy();
      this.hud = undefined;
      this.keys = undefined;
      this.player = undefined;
    });
  }

  update(_time: number, delta: number): void {
    const k = this.keys, p = this.player;
    if (!k || !p) return;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);

    if (dx === 0 && dy === 0) {
      if (p.anims.isPlaying) p.anims.stop();
      p.setTexture(T.idle.key, ATLAS.directions[this.dir].idleFrame);
      return;
    }

    // Dominant screen axis decides facing; an exact diagonal faces horizontally.
    this.dir = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    p.anims.play(`warrior-walk-${this.dir}`, true);

    const dt = Math.min(0.05, delta / 1000);
    const len = Math.hypot(dx, dy), step = WORLD.player.speed * dt;
    const nx = p.x + (dx / len) * step, ny = p.y + (dy / len) * step;
    // Axis-separated: blocked on one axis still slides on the other.
    if (footAllowed(nx, p.y)) p.x = nx;
    if (footAllowed(p.x, ny)) p.y = ny;
    this.shadow?.setPosition(p.x, p.y + WORLD_HUD.shadow.offsetY);
  }
}
