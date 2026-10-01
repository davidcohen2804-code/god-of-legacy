// Stage 6: Cursed Swordsman — idle → chase → attack (windup/active/recovery), plus hurt and death.
import Phaser from 'phaser';
import S6 from '../data/stage6-combat.json';
import { STAGE6 } from '../config/layout';
import { Dir, facingFrom, footAllowedStatic, hasLineOfSight } from './collision';

const E = S6.enemy;
const C = STAGE6.enemy;
type Action = keyof typeof C.actions;
type State = 'idle' | 'chase' | 'attack' | 'hurt' | 'dead';

export const enemyFrameKey = (dir: Dir, action: Action, i: number) => `cs_${dir}_${action}_${i}`;

/** Preload every normalized frame (relative assets/ URLs). */
export function preloadEnemyFrames(scene: Phaser.Scene): void {
  for (const dir of ['down', 'left', 'right', 'up'] as Dir[]) {
    for (const [action, n] of Object.entries(C.actions) as [Action, number][]) {
      for (let i = 0; i < n; i++) {
        const key = enemyFrameKey(dir, action, i);
        if (!scene.textures.exists(key)) scene.load.image(key, `${C.framePath}/${dir}/${action}/${String(i).padStart(2, '0')}.png`);
      }
    }
  }
}

export interface EnemyWorld {
  player: { x: number; y: number; alive: boolean };
  /** Extra blockers besides the static map (dummy, player). */
  blocked: (x: number, y: number) => boolean;
  onHitPlayer: (damage: number) => void;
}

export class CursedSwordsman {
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  hp: number = E.maxHp;
  state: State = 'idle';
  private dir: Dir = 'down';
  private stateMs = 0; // time in current state
  private animMs = 0;
  private sinceAttackStart = Infinity;
  private attackHit = false;
  private flashLeft = 0;
  private respawnLeft = 0;
  private moving = false;

  constructor(private scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(C.spawn.x, C.spawn.y - 2, 36, 12, 0x000000, 0.33);
    this.sprite = scene.add.image(C.spawn.x, C.spawn.y, enemyFrameKey('down', 'idle', 0)).setOrigin(C.origin.x, C.origin.y);
    this.sync();
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get alive(): boolean { return this.state !== 'dead'; }

  /** Player sword hit (already range/cone checked by the player). Returns true if it landed. */
  takeHit(damage: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.flashLeft = C.hitFlashMs;
    this.sprite.setTintFill(0xffffff);
    if (this.hp === 0) { this.enter('dead'); this.respawnLeft = E.deathRespawnMs; }
    else this.enter('hurt'); // interrupts chase/attack
    return true;
  }

  /** Back to spawn, full HP, idle (used when the player respawns). */
  reset(): void {
    this.sprite.setPosition(C.spawn.x, C.spawn.y).clearTint().setVisible(true);
    this.hp = E.maxHp; this.dir = 'down'; this.sinceAttackStart = Infinity; this.flashLeft = 0;
    this.enter('idle');
    this.sync();
  }

  update(ms: number, w: EnemyWorld): void {
    this.stateMs += ms; this.animMs += ms; this.sinceAttackStart += ms;
    if (this.flashLeft > 0) { this.flashLeft -= ms; if (this.flashLeft <= 0) this.sprite.clearTint(); }

    const dx = w.player.x - this.x, dy = w.player.y - this.y, dist = Math.hypot(dx, dy);

    switch (this.state) {
      case 'dead': {
        this.respawnLeft -= ms;
        if (this.respawnLeft <= 0 && Math.hypot(w.player.x - C.spawn.x, w.player.y - C.spawn.y) >= C.respawnClearRadius) this.reset();
        break;
      }
      case 'hurt': {
        if (this.stateMs >= E.hurtLockMs) this.enter(w.player.alive && dist <= E.aggroRadiusPx ? 'chase' : 'idle');
        break;
      }
      case 'idle': {
        if (w.player.alive && dist <= E.aggroRadiusPx) this.enter('chase');
        break;
      }
      case 'chase': {
        if (!w.player.alive || dist > E.aggroRadiusPx) { this.enter('idle'); break; }
        this.dir = facingFrom(dx, dy, this.dir);
        this.moving = false;
        if (dist <= E.attackRangePx) {
          if (this.sinceAttackStart >= E.attackCooldownMs) this.startAttack();
          break; // in range: hold position
        }
        const step = (E.moveSpeedPxPerSec * Math.min(ms, 50)) / 1000;
        const nx = this.x + (dx / dist) * step, ny = this.y + (dy / dist) * step;
        if (this.canStand(nx, this.y, w)) this.sprite.x = nx;
        if (this.canStand(this.x, ny, w)) this.sprite.y = ny;
        this.moving = true;
        break;
      }
      case 'attack': {
        const activeStart = E.windupMs, activeEnd = E.windupMs + E.activeMs;
        if (!this.attackHit && this.stateMs >= activeStart && this.stateMs < activeEnd && this.canHitPlayer(w)) {
          this.attackHit = true; // once per swing
          w.onHitPlayer(E.damage);
        }
        if (this.stateMs >= activeEnd + E.recoveryMs) this.enter(w.player.alive && dist <= E.aggroRadiusPx ? 'chase' : 'idle');
        break;
      }
    }
    this.applyFrame();
    this.sync();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }

  // ---------------- internals ----------------

  private enter(s: State): void { this.state = s; this.stateMs = 0; this.animMs = 0; }

  private startAttack(): void {
    this.enter('attack');
    this.attackHit = false;
    this.sinceAttackStart = 0;
  }

  private canStand(x: number, y: number, w: EnemyWorld): boolean {
    return footAllowedStatic(x, y, C.footRadius) && !w.blocked(x, y);
  }

  /** Range + ±60° facing cone + line of sight, only inside the active window. */
  private canHitPlayer(w: EnemyWorld): boolean {
    if (!w.player.alive) return false;
    const vx = w.player.x - this.x, vy = w.player.y - this.y, d = Math.hypot(vx, vy);
    if (d > E.attackRangePx || d === 0) return false;
    const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
    if ((vx * f[0] + vy * f[1]) / d < C.hitCone) return false;
    return hasLineOfSight(this.x, this.y, w.player.x, w.player.y);
  }

  private applyFrame(): void {
    let action: Action, i: number;
    switch (this.state) {
      case 'idle': action = 'idle'; i = Math.floor((this.animMs * C.idleFps) / 1000) % C.actions.idle; break;
      case 'chase':
        if (this.moving) { action = 'walk'; i = Math.floor((this.animMs * C.walkFps) / 1000) % C.actions.walk; }
        else { action = 'idle'; i = Math.floor((this.animMs * C.idleFps) / 1000) % C.actions.idle; }
        break;
      case 'hurt': action = 'hurt'; i = Math.min(C.actions.hurt - 1, Math.floor(this.stateMs / (E.hurtLockMs / C.actions.hurt))); break;
      case 'dead': action = 'death'; i = Math.min(C.actions.death - 1, Math.floor((this.stateMs * C.deathFps) / 1000)); break;
      default: { // attack: 2 windup + 1 active + 3 recovery frames over the JSON phase durations
        action = 'attack';
        const F = C.attackFrames, t = this.stateMs;
        if (t < E.windupMs) i = Math.min(F.windup - 1, Math.floor(t / (E.windupMs / F.windup)));
        else if (t < E.windupMs + E.activeMs) i = F.windup;
        else i = F.windup + F.active + Math.min(F.recovery - 1, Math.floor((t - E.windupMs - E.activeMs) / (E.recoveryMs / F.recovery)));
      }
    }
    this.sprite.setTexture(enemyFrameKey(this.dir, action, i));
  }

  private sync(): void {
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 2).setDepth(this.y - 0.5).setVisible(this.alive);
  }
}
