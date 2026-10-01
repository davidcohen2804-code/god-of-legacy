// Stage 4/5: Legacy Courtyard — fixed-camera map, 4-direction idle/walk/attack, foot-circle collision,
// one training dummy. All geometry, timing and sizes come from src/data (world coords = original map pixels).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import COMBAT from '../data/training-combat.json';
import { WORLD_HUD } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { WorldHUD } from '../ui/WorldHUD';

type Dir = 'down' | 'left' | 'right' | 'up';
type Pt = readonly number[];

const T = ATLAS.textures;
const CT = COMBAT_ASSETS.textures;
const A = COMBAT.attack;
const D = COMBAT.dummy;
const R = WORLD.player.footRadius;
const POLY = WORLD.walkablePolygon as Pt[];
const TOP_DEPTH = 100000; // effects and health bar above every feet-sorted object

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
function footAllowedStatic(x: number, y: number): boolean {
  if (!insidePolygon(x, y)) return false;
  for (let i = 0; i < POLY.length; i++) if (distToSegment(x, y, POLY[i], POLY[(i + 1) % POLY.length]) < R) return false;
  return !WORLD.obstacles.some((o) =>
    Math.hypot(x - Phaser.Math.Clamp(x, o.x, o.x + o.width), y - Phaser.Math.Clamp(y, o.y, o.y + o.height)) <= R);
}

interface Attack { id: number; dir: Dir; elapsed: number; hitChecked: boolean }

export class LegacyCourtyardScene extends Phaser.Scene {
  /** Read by the QA panel: x,y are the feet. */
  player?: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Ellipse;
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private dir: Dir = ATLAS.initialDirection as Dir;
  private hud?: WorldHUD;

  // Combat (scene-local, never saved).
  private attack: Attack | null = null;
  private attackSeq = 0;
  private sinceAttackStart = Infinity; // cooldown is measured from attack start
  private dummy?: Phaser.GameObjects.Image;
  private dummyBar?: Phaser.GameObjects.Graphics;
  private dummyHp = D.maxHp;
  private dummyAlive = true;
  private lastHitAttackId = -1;
  private flashLeft = 0;
  private respawnLeft = 0;
  private impacts: { sprite: Phaser.GameObjects.Sprite; elapsed: number }[] = [];

  constructor() { super('LegacyCourtyardScene'); }

  preload(): void {
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    for (const t of [T.walk, T.idle, CT.attack, CT.impact]) {
      if (!this.textures.exists(t.key)) this.load.spritesheet(t.key, t.file, { frameWidth: t.frameWidth, frameHeight: t.frameHeight });
    }
    if (!this.textures.exists(CT.dummy.key)) this.load.image(CT.dummy.key, CT.dummy.file);
  }

  create(): void {
    const character = CharacterStore.getSelectedCharacter();
    if (!character) { this.scene.start('CharacterSelectScene'); return; }

    // Reset scene-local combat state on every entry.
    this.attack = null; this.sinceAttackStart = Infinity; this.dummyHp = D.maxHp; this.dummyAlive = true;
    this.lastHitAttackId = -1; this.flashLeft = 0; this.respawnLeft = 0; this.impacts = [];
    this.dir = ATLAS.initialDirection as Dir;

    // Map in world pixels; fixed camera fits it (contain), no stretching.
    this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(-1);
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

    // Training dummy (stationary, round collision body).
    this.dummy = this.add.image(D.x, D.y, CT.dummy.key).setOrigin(CT.dummy.origin.x, CT.dummy.origin.y);
    this.dummy.setScale(CT.dummy.displayHeight / CT.dummy.height).setDepth(D.y);
    this.dummyBar = this.add.graphics().setDepth(TOP_DEPTH);
    this.drawDummyBar();

    const { x, y } = WORLD.spawn;
    const S = WORLD_HUD.shadow;
    this.shadow = this.add.ellipse(x, y + S.offsetY, S.w, S.h, 0x000000, S.alpha);
    this.player = this.add.sprite(x, y, T.idle.key, ATLAS.directions[this.dir].idleFrame);
    this.setIdle();
    this.syncDepths();

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as LegacyCourtyardScene['keys'];
    const onSpace = (e: KeyboardEvent) => { if (!e.repeat) this.beginAttack(); };
    kb.on('keydown-SPACE', onSpace);

    // Losing focus clears keys and cancels an attack before it can hit.
    const stop = () => { kb.resetKeys(); this.cancelAttack(); };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, character.name, () => this.scene.start('CharacterSelectScene'));
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.hud?.layout());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      kb.off('keydown-SPACE', onSpace);
      kb.resetKeys();
      kb.removeAllKeys(true);
      for (const i of this.impacts) i.sprite.destroy();
      this.impacts = [];
      this.attack = null;
      this.hud?.destroy();
      this.hud = undefined;
      this.keys = undefined;
      this.player = undefined;
      this.dummy = undefined;
      this.dummyBar = undefined;
    });
  }

  update(_time: number, delta: number): void {
    const k = this.keys, p = this.player;
    if (!k || !p) return;
    const ms = delta;
    this.sinceAttackStart += ms;
    this.updateDummy(ms);
    this.updateImpacts(ms);

    if (this.attack) { this.updateAttack(ms); this.syncDepths(); return; } // movement and turning locked

    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);

    if (dx === 0 && dy === 0) { this.setIdle(); this.syncDepths(); return; }

    // Dominant screen axis decides facing; an exact diagonal faces horizontally.
    this.dir = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    this.setBodyScale(T.walk.frameHeight, WORLD.player.displayHeight, WORLD.player.spriteOrigin);
    p.anims.play(`warrior-walk-${this.dir}`, true);

    const dt = Math.min(0.05, ms / 1000);
    const len = Math.hypot(dx, dy), step = WORLD.player.speed * dt;
    const nx = p.x + (dx / len) * step, ny = p.y + (dy / len) * step;
    // Axis-separated: blocked on one axis still slides on the other.
    if (this.footAllowed(nx, p.y)) p.x = nx;
    if (this.footAllowed(p.x, ny)) p.y = ny;
    this.syncDepths();
  }

  // ---------------- player states (feet x/y never change between states) ----------------

  private setBodyScale(frameHeight: number, displayHeight: number, origin: { x: number; y: number }): void {
    const p = this.player!;
    p.setOrigin(origin.x, origin.y);
    p.setScale(displayHeight / frameHeight);
  }

  private setIdle(): void {
    const p = this.player!;
    if (p.anims.isPlaying) p.anims.stop();
    p.setTexture(T.idle.key, ATLAS.directions[this.dir].idleFrame);
    this.setBodyScale(T.idle.frameHeight, WORLD.player.displayHeight, WORLD.player.spriteOrigin);
  }

  private footAllowed(x: number, y: number): boolean {
    if (!footAllowedStatic(x, y)) return false;
    return !(this.dummyAlive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + R);
  }

  private syncDepths(): void {
    const p = this.player!;
    p.setDepth(p.y);
    this.shadow?.setPosition(p.x, p.y + WORLD_HUD.shadow.offsetY).setDepth(p.y - 0.5);
  }

  // ---------------- attack ----------------

  private beginAttack(): void {
    if (!this.player || this.attack || this.sinceAttackStart < A.cooldownMs) return; // no queue
    this.attack = { id: ++this.attackSeq, dir: this.dir, elapsed: 0, hitChecked: false };
    this.sinceAttackStart = 0;
    const p = this.player;
    if (p.anims.isPlaying) p.anims.stop();
    this.setBodyScale(CT.attack.frameHeight, CT.attack.displayHeight, CT.attack.origin);
    this.showAttackFrame();
  }

  private cancelAttack(): void {
    if (!this.attack || !this.player) return;
    this.attack = null;
    this.setIdle();
  }

  private updateAttack(ms: number): void {
    const a = this.attack!;
    a.elapsed += ms;
    if (!a.hitChecked && a.elapsed >= A.hitAtMs) { a.hitChecked = true; this.resolveHit(a); }
    if (a.elapsed >= A.totalDurationMs) { this.attack = null; this.setIdle(); return; }
    this.showAttackFrame();
  }

  private showAttackFrame(): void {
    const a = this.attack!;
    let phase = 0, acc = 0;
    for (let i = 0; i < A.phaseDurationMs.length; i++) { acc += A.phaseDurationMs[i]; if (a.elapsed < acc) { phase = i; break; } phase = i; }
    const frames = COMBAT_ASSETS.attackFrames[a.dir];
    this.player!.setTexture(CT.attack.key, frames[phase]);
  }

  /** Single range + facing check against the dummy's feet; at most one hit per attack id. */
  private resolveHit(a: Attack): void {
    const p = this.player!;
    if (!this.dummyAlive || this.lastHitAttackId === a.id) return;
    const vx = D.x - p.x, vy = D.y - p.y, dist = Math.hypot(vx, vy);
    if (dist > A.range || dist === 0) return;
    const f = COMBAT.facing[a.dir];
    if ((vx * f[0] + vy * f[1]) / dist < A.minimumFacingDot) return;
    this.lastHitAttackId = a.id;
    this.dummyHp = Math.max(0, this.dummyHp - A.damage);
    this.flashLeft = D.hitFlashMs;
    this.dummy!.setTintFill(0xffffff);
    this.spawnImpact();
    if (this.dummyHp === 0) {
      this.dummyAlive = false;
      this.dummy!.setVisible(false);
      this.respawnLeft = D.respawnDelayMs;
    }
    this.drawDummyBar();
  }

  // ---------------- dummy + effects ----------------

  private updateDummy(ms: number): void {
    if (this.flashLeft > 0) {
      this.flashLeft -= ms;
      if (this.flashLeft <= 0) this.dummy?.clearTint();
    }
    if (!this.dummyAlive) {
      this.respawnLeft -= ms;
      if (this.respawnLeft <= 0) {
        const p = this.player!;
        const overlaps = D.deferRespawnIfPlayerOverlaps && Math.hypot(p.x - D.x, p.y - D.y) < D.collisionRadius + D.playerFootRadius;
        if (!overlaps) {
          this.dummyHp = D.maxHp; this.dummyAlive = true;
          this.dummy!.clearTint().setVisible(true);
          this.drawDummyBar();
        }
      }
    }
  }

  private drawDummyBar(): void {
    const g = this.dummyBar!;
    g.clear();
    if (!this.dummyAlive) return;
    const h = D.healthBar, bx = D.x - h.width / 2, by = D.y + h.offsetY;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(h.background), 1).fillRect(bx, by, h.width, h.height);
    g.fillStyle(col(h.fill), 1).fillRect(bx, by, (h.width * this.dummyHp) / D.maxHp, h.height);
    g.lineStyle(1, col(h.border), 1).strokeRect(bx, by, h.width, h.height);
  }

  private spawnImpact(): void {
    const s = this.add.sprite(D.x + D.impactOffset.x, D.y + D.impactOffset.y, CT.impact.key, COMBAT_ASSETS.impactFrames[0])
      .setOrigin(CT.impact.origin.x, CT.impact.origin.y).setDepth(TOP_DEPTH + 1);
    s.setScale(CT.impact.displayHeight / CT.impact.frameHeight);
    this.impacts.push({ sprite: s, elapsed: 0 });
  }

  private updateImpacts(ms: number): void {
    const frames = COMBAT_ASSETS.impactFrames, step = COMBAT_ASSETS.impactFrameDurationMs;
    this.impacts = this.impacts.filter((i) => {
      i.elapsed += ms;
      const idx = Math.floor(i.elapsed / step);
      if (idx >= frames.length) { i.sprite.destroy(); return false; } // single play, never loops
      i.sprite.setFrame(frames[idx]);
      return true;
    });
  }
}
