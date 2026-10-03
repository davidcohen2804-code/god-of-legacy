// Stage 6 enemy on the shared combat foundation: real ground x/y/z kinematics (launch, juggle, knockdown, getup),
// AI idle → chase → attack (windup / active / recovery). Damage and reactions are applied by the scene (PvE authority).
import Phaser from 'phaser';
import S6 from '../data/stage6-combat.json';
import { STAGE6 } from '../config/layout';
import { Dir, facingFrom } from './collision';
import { clearLine } from './WorldGeometry';
import { CombatBody, Kin, newKin, stepKin } from '../combat/Combat';
import { HitTarget } from '../skills/HitGeometry';

const E = S6.enemy;
const C = STAGE6.enemy;
type Action = keyof typeof C.actions;
type AIState = 'idle' | 'chase' | 'attack' | 'dead';

export const enemyFrameKey = (dir: Dir, action: Action, i: number) => `cs_${dir}_${action}_${i}`;

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
  player: { x: number; y: number; z: number; alive: boolean };
  now: number;
  blocked: (x: number, y: number) => boolean;
  /** Enemy strike reached its active window and the player is inside range/cone/LOS. */
  onStrikePlayer: (damage: number, from: { x: number; y: number }) => void;
}

export class CursedSwordsman {
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  readonly kin: Kin;
  readonly body: CombatBody;
  hp: number = E.maxHp;
  ai: AIState = 'idle';
  private dir: Dir = 'down';
  private stateMs = 0;
  private animMs = 0;
  private sinceAttackStart = Infinity;
  private attackHit = false;
  private flashLeft = 0;
  private respawnLeft = 0;
  private moving = false;
  private kdMs = 0;
  private lastNow = 0;
  frozen = false; // QA: AI disabled (training target)
  get facing(): Dir { return this.dir; }
  get maxHp(): number { return E.maxHp; }

  constructor(private scene: Phaser.Scene) {
    this.kin = newKin(C.spawn.x, C.spawn.y);
    this.body = new CombatBody(this.kin, false);
    this.shadow = scene.add.ellipse(C.spawn.x, C.spawn.y - 2, 36, 12, 0x000000, 0.33);
    this.sprite = scene.add.image(C.spawn.x, C.spawn.y, enemyFrameKey('down', 'idle', 0)).setOrigin(C.origin.x, C.origin.y);
    this.sync();
  }

  get x(): number { return this.kin.x; }
  get y(): number { return this.kin.y; }
  get z(): number { return this.kin.z; }
  get alive(): boolean { return this.ai !== 'dead'; }
  /** Legacy QA accessors. */
  get state(): string { return this.ai === 'dead' ? 'dead' : this.body.state === 'free' ? this.ai : 'hurt'; }

  target(): HitTarget { return { id: 'enemy', kind: 'enemy', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: C.collisionRadius, height: 74, alive: this.alive }; }

  /** HP change from a confirmed hit (reactions already applied to `body` by the scene). */
  damage(dmg: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashLeft = C.hitFlashMs;
    this.sprite.setTintFill(0xffffff);
    this.attackHit = true; // a hit interrupts the pending strike
    if (this.ai === 'attack') this.enter('chase');
    if (this.hp === 0) { this.enter('dead'); this.respawnLeft = E.deathRespawnMs; this.body.push = null; }
  }

  reset(): void {
    this.kin.x = C.spawn.x; this.kin.y = C.spawn.y; this.kin.z = 0; this.kin.vx = 0; this.kin.vy = 0; this.kin.vz = 0; this.kin.grounded = true;
    this.body.reset();
    this.sprite.clearTint().setVisible(true);
    this.hp = E.maxHp; this.dir = 'down'; this.sinceAttackStart = Infinity; this.flashLeft = 0;
    this.enter('idle');
    this.sync();
  }

  update(ms: number, w: EnemyWorld): void {
    this.stateMs += ms; this.animMs += ms; this.sinceAttackStart += ms;
    if (this.flashLeft > 0) { this.flashLeft -= ms; if (this.flashLeft <= 0) this.sprite.clearTint(); }
    const now = w.now, b = this.body;
    this.lastNow = now;
    // Kinematics: knockback push / launch arcs (AI locomotion only while free).
    const dx = w.player.x - this.x, dy = w.player.y - this.y, dist = Math.hypot(dx, dy);
    this.moving = false;
    if (this.ai !== 'dead' && b.canAct(now) && !this.frozen) this.think(ms, w, dx, dy, dist);
    else if (this.ai !== 'dead' && b.state === 'free') { this.kin.vx = 0; this.kin.vy = 0; }
    const r = stepKin(this.kin, ms, b.gravityScale(now), (x, y) => w.blocked(x, y));
    const ev = b.update(now, ms, r.landed, r.impactVz);
    if (ev === 'kdImpact') this.kdMs = 0;
    this.kdMs += ms;
    if (this.ai === 'dead') {
      this.respawnLeft -= ms;
      if (this.respawnLeft <= 0 && Math.hypot(w.player.x - C.spawn.x, w.player.y - C.spawn.y) >= C.respawnClearRadius) this.reset();
    }
    this.applyFrame();
    this.sync();
  }

  private think(ms: number, w: EnemyWorld, dx: number, dy: number, dist: number): void {
    switch (this.ai) {
      case 'idle':
        this.kin.vx = 0; this.kin.vy = 0;
        if (w.player.alive && dist <= E.aggroRadiusPx) this.enter('chase');
        break;
      case 'chase': {
        if (!w.player.alive || dist > E.aggroRadiusPx) { this.enter('idle'); break; }
        this.dir = facingFrom(dx, dy, this.dir);
        if (dist <= E.attackRangePx) { this.kin.vx = 0; this.kin.vy = 0; if (this.sinceAttackStart >= E.attackCooldownMs && w.player.z < 40) this.startAttack(); break; }
        this.kin.vx = (dx / dist) * E.moveSpeedPxPerSec * this.body.moveScale(w.now);
        this.kin.vy = (dy / dist) * E.moveSpeedPxPerSec * this.body.moveScale(w.now);
        this.moving = true;
        break;
      }
      case 'attack': {
        this.kin.vx = 0; this.kin.vy = 0;
        const activeStart = E.windupMs, activeEnd = E.windupMs + E.activeMs;
        if (!this.attackHit && this.stateMs >= activeStart && this.stateMs < activeEnd && this.canHitPlayer(w)) {
          this.attackHit = true;
          w.onStrikePlayer(E.damage, { x: this.x, y: this.y });
        }
        if (this.stateMs >= activeEnd + E.recoveryMs) this.enter(w.player.alive && dist <= E.aggroRadiusPx ? 'chase' : 'idle');
        break;
      }
      default: break;
    }
  }

  destroy(): void { this.sprite.destroy(); this.shadow.destroy(); }

  private enter(s: AIState): void { this.ai = s; this.stateMs = 0; this.animMs = 0; }
  private startAttack(): void { this.enter('attack'); this.attackHit = false; this.sinceAttackStart = 0; }

  private canHitPlayer(w: EnemyWorld): boolean {
    if (!w.player.alive || w.player.z > 50) return false;
    const vx = w.player.x - this.x, vy = w.player.y - this.y, d = Math.hypot(vx, vy);
    if (d > E.attackRangePx || d === 0) return false;
    const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
    if ((vx * f[0] + vy * f[1]) / d < C.hitCone) return false;
    return clearLine(this.x, this.y, w.player.x, w.player.y, 30);
  }

  private applyFrame(): void {
    let action: Action, i: number;
    const b = this.body;
    if (this.ai === 'dead') { action = 'death'; i = Math.min(C.actions.death - 1, Math.floor((this.stateMs * C.deathFps) / 1000)); }
    else if (b.state === 'launched') { action = 'hurt'; i = 1; }
    else if (b.state === 'knockdown') { action = 'death'; i = Math.min(4, 2 + Math.floor(this.kdMs / 90)); }
    else if (b.state === 'getup') { action = 'death'; i = Math.max(0, 3 - Math.floor(this.kdMs / 70)); }
    else if (b.state === 'hitstun' || b.hard.active(this.lastNow) || this.flashLeft > 0) { action = 'hurt'; i = this.flashLeft > C.hitFlashMs / 2 ? 0 : 1; }
    else if (this.ai === 'attack') {
      action = 'attack';
      const F = C.attackFrames, t = this.stateMs;
      if (t < E.windupMs) i = Math.min(F.windup - 1, Math.floor(t / (E.windupMs / F.windup)));
      else if (t < E.windupMs + E.activeMs) i = F.windup;
      else i = F.windup + F.active + Math.min(F.recovery - 1, Math.floor((t - E.windupMs - E.activeMs) / (E.recoveryMs / F.recovery)));
    } else if (this.moving) { action = 'walk'; i = Math.floor((this.animMs * C.walkFps) / 1000) % C.actions.walk; }
    else { action = 'idle'; i = Math.floor((this.animMs * C.idleFps) / 1000) % C.actions.idle; }
    if (b.state === 'getup' && this.kdMs > 280) { action = 'idle'; i = 0; }
    this.sprite.setTexture(enemyFrameKey(this.dir, action, i));
  }

  private sync(): void {
    const k = this.kin;
    this.sprite.setPosition(k.x, k.y - k.z).setDepth(k.y);
    const h = Math.max(0, k.z - k.supportZ), s = Math.max(0.4, 1 - h / 140);
    this.shadow.setPosition(k.x, k.y - k.supportZ - 2).setDepth(k.y - 0.5).setVisible(this.alive).setScale(s);
  }
}
