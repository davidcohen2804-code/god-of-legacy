// Open-world monster on the shared combat foundation (same reactions as every fighter: launch, juggle, knockdown,
// getup). Side view: faces left or right. Life: wanders around its home spot → sees you (or is hit) → chases →
// strikes (windup / active / recovery) → gives up when you run far away and walks home. Dies at 0 HP (drops gold,
// handled by the scene) and comes back at its home spot after a while. Damage and reactions are applied by the scene.
import Phaser from 'phaser';
import { STAGE6 } from '../config/layout';
import { clearLine, footAllowed } from './WorldGeometry';
import { CombatBody, Kin, newKin, stepKin } from '../combat/Combat';
import { HitTarget } from '../skills/HitGeometry';
import { MobKind } from './Areas';

const C = STAGE6.enemy;
type Action = keyof typeof C.actions;
type AIState = 'idle' | 'wander' | 'chase' | 'attack' | 'home' | 'dead';
type Side = 'left' | 'right';
const WIND = 180, ACTIVE = 120, RECOVER = 260; // strike phases (ms), the frame art's timing

export const mobFrameKey = (set: string, dir: Side, action: Action, i: number) => `mob-${set}-${dir}-${action}-${i}`;

export function preloadMonsterFrames(scene: Phaser.Scene, set: string): void {
  for (const dir of ['left', 'right'] as Side[]) {
    for (const [action, n] of Object.entries(C.actions) as [Action, number][]) {
      for (let i = 0; i < n; i++) {
        const key = mobFrameKey(set, dir, action, i);
        if (!scene.textures.exists(key)) scene.load.image(key, `assets/enemy/${set}/${dir}/${action}/${String(i).padStart(2, '0')}.png`);
      }
    }
  }
}

export interface MonsterWorld {
  player: { x: number; y: number; z: number; alive: boolean };
  now: number;
  /** Feet circle at (x, y) blocked by another actor (the player, another monster). */
  blocked: (self: Monster, x: number, y: number) => boolean;
  onStrikePlayer: (m: Monster, damage: number) => void;
}

export class Monster {
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private bar: Phaser.GameObjects.Graphics;
  readonly kin: Kin;
  readonly body: CombatBody;
  hp: number;
  ai: AIState = 'idle';
  private dir: Side;
  private stateMs = 0;
  private animMs = 0;
  private sinceAttack = Infinity;
  private struck = false;
  private flashLeft = 0;
  private respawnLeft = 0;
  private moving = false;
  private kdMs = 0;
  private lastNow = 0;
  private wanderTo: { x: number; y: number } | null = null;
  private barShowUntil = -1;
  /** Last attacker x (lean / tumble away from it) and procedural reaction state. */
  hitFromX = 0;
  lastEv: string | null = null;
  private airMs = 0;
  private tumble = 0;
  private pos = { x: 0, y: 0 };
  private deathFade = 1;
  frozen = false;

  constructor(private scene: Phaser.Scene, readonly id: string, readonly kind: MobKind, readonly home: { x: number; y: number }, seed: number) {
    this.kin = newKin(home.x, home.y);
    this.body = new CombatBody(this.kin, false);
    this.body.maxHp = kind.hp; this.hp = kind.hp;
    this.dir = seed % 2 ? 'left' : 'right';
    this.shadow = scene.add.ellipse(home.x, home.y - 2, 36 * kind.scale, 12 * kind.scale, 0x000000, 0.33);
    this.sprite = scene.add.image(home.x, home.y, mobFrameKey(kind.frames, this.dir, 'idle', 0)).setOrigin(C.origin.x, C.origin.y);
    if (kind.tint !== undefined) this.sprite.setTint(kind.tint);
    this.bar = scene.add.graphics();
    this.stateMs = (seed * 977) % 2600; // spread the first wander of a group
    this.sync();
  }

  get x(): number { return this.kin.x; }
  get y(): number { return this.kin.y; }
  get z(): number { return this.kin.z; }
  get alive(): boolean { return this.ai !== 'dead'; }
  get maxHp(): number { return this.kind.hp; }
  get facing(): Side { return this.dir; }
  get name(): string { return this.kind.name; }
  faceToward(x: number): void { if (Math.abs(x - this.kin.x) > 2) this.dir = x < this.kin.x ? 'left' : 'right'; }
  shake(jx: number, jy: number): void { this.sprite.setPosition(this.pos.x + jx, this.pos.y + jy); }

  target(): HitTarget {
    return { id: this.id, kind: 'enemy', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: C.collisionRadius * this.kind.scale + 4, height: 74 * this.kind.scale, alive: this.alive, invulnerable: this.lastNow < this.body.invulnUntil };
  }

  /** HP change from a confirmed hit (reactions already applied to `body`); true when this hit killed it. */
  damage(dmg: number, now: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashLeft = C.hitFlashMs; this.barShowUntil = now + 5000;
    this.sprite.setTintFill(0xffffff);
    this.struck = true; // a hit interrupts the pending strike
    if (this.hp <= 0) { this.enter('dead'); this.respawnLeft = this.kind.respawnMs; this.body.push = null; this.deathFade = 1; return true; }
    if (this.ai === 'attack' || this.ai === 'idle' || this.ai === 'wander' || this.ai === 'home') this.enter('chase'); // provoked
    return false;
  }

  private reset(): void {
    const k = this.kin;
    k.x = this.home.x; k.y = this.home.y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true;
    this.body.reset(); this.body.maxHp = this.kind.hp;
    this.hp = this.kind.hp; this.sinceAttack = Infinity; this.flashLeft = 0; this.barShowUntil = -1;
    this.restoreTint(); this.sprite.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 420 }); // fades back in
    this.enter('idle');
  }

  private restoreTint(): void { if (this.kind.tint !== undefined) this.sprite.setTint(this.kind.tint); else this.sprite.clearTint(); }

  update(ms: number, w: MonsterWorld): void {
    this.stateMs += ms; this.animMs += ms; this.sinceAttack += ms;
    if (this.flashLeft > 0) { this.flashLeft -= ms; if (this.flashLeft <= 0) this.restoreTint(); }
    const now = w.now, b = this.body;
    this.lastNow = now;
    const dx = w.player.x - this.x, dy = w.player.y - this.y, dist = Math.hypot(dx, dy);
    this.moving = false;
    if (this.ai === 'dead') {
      this.kin.vx = 0; this.kin.vy = 0;
      this.respawnLeft -= ms;
      if (this.stateMs > 900) this.deathFade = Math.max(0, this.deathFade - ms / 500);
      if (this.respawnLeft <= 0 && Math.hypot(w.player.x - this.home.x, w.player.y - this.home.y) > 90) this.reset();
    } else if (b.canAct(now) && !this.frozen) this.think(ms, w, dx, dy, dist);
    else if (b.state === 'free') { this.kin.vx = 0; this.kin.vy = 0; }
    const r = stepKin(this.kin, ms, b.gravityScale(now), (x, y) => w.blocked(this, x, y));
    if (this.moving && (r.blockedX || r.blockedY) && (this.ai === 'wander' || this.ai === 'home')) this.wanderTo = null; // bumped into something: pick another spot
    const ev = b.update(now, ms, r.landed, r.impactVz);
    if (ev === 'kdImpact') this.kdMs = 0;
    this.lastEv = ev;
    this.airMs = b.state === 'launched' ? this.airMs + ms : 0;
    this.kdMs += ms;
    this.applyFrame();
    this.sync();
  }

  private think(ms: number, w: MonsterWorld, dx: number, dy: number, dist: number): void {
    const K = this.kind, k = this.kin, sp = K.speed * this.body.moveScale(w.now);
    const fromHome = Math.hypot(k.x - this.home.x, k.y - this.home.y);
    const sees = w.player.alive && dist <= K.aggro && clearLine(k.x, k.y, w.player.x, w.player.y, 30);
    switch (this.ai) {
      case 'idle': case 'wander': {
        if (sees) { this.enter('chase'); break; }
        if (this.ai === 'idle') {
          k.vx = 0; k.vy = 0;
          if (this.stateMs > 1600 + (this.id.length * 331) % 1800) { // look around a little, then stroll
            for (let i = 0; i < 6; i++) {
              const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 110;
              const x = this.home.x + Math.cos(a) * r, y = this.home.y + Math.sin(a) * r * 0.6;
              if (footAllowed(x, y, 0, 14)) { this.wanderTo = { x, y }; break; }
            }
            this.enter(this.wanderTo ? 'wander' : 'idle');
          }
          break;
        }
        const t = this.wanderTo;
        if (!t || Math.hypot(t.x - k.x, t.y - k.y) < 6 || this.stateMs > 4000) { this.wanderTo = null; this.enter('idle'); k.vx = 0; k.vy = 0; break; }
        this.walkToward(t.x, t.y, sp * 0.45);
        break;
      }
      case 'chase': {
        if (!w.player.alive || dist > K.aggro * 1.8 || fromHome > 520) { this.enter('home'); break; }
        this.faceToward(w.player.x);
        if (dist <= K.range && Math.abs(dy) < 34) { k.vx = 0; k.vy = 0; if (this.sinceAttack >= K.cooldown && w.player.z < 40) this.startAttack(); break; }
        // stand beside the player (side view): the side it is on, at its reach, same depth
        const side = dx > 0 ? -1 : 1, tx = w.player.x + side * K.range * 0.8, ty = w.player.y;
        this.walkToward(tx, ty, sp);
        break;
      }
      case 'home': {
        if (sees && fromHome < 380) { this.enter('chase'); break; }
        if (fromHome < 10) { this.enter('idle'); k.vx = 0; k.vy = 0; break; }
        this.walkToward(this.home.x, this.home.y, sp * 0.8);
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + ms * 0.02); // catches its breath on the way back
        break;
      }
      case 'attack': {
        k.vx = 0; k.vy = 0;
        if (!this.struck && this.stateMs >= WIND && this.stateMs < WIND + ACTIVE && this.canHit(w)) { this.struck = true; w.onStrikePlayer(this, K.damage); }
        if (this.stateMs >= WIND + ACTIVE + RECOVER) this.enter(w.player.alive && dist <= K.aggro * 1.8 ? 'chase' : 'home');
        break;
      }
      default: break;
    }
  }

  private walkToward(x: number, y: number, speed: number): void {
    const k = this.kin, dx = x - k.x, dy = y - k.y, d = Math.hypot(dx, dy);
    if (d < 3) { k.vx = 0; k.vy = 0; return; }
    k.vx = (dx / d) * speed; k.vy = (dy / d) * speed;
    if (Math.abs(dx) > 4) this.dir = dx < 0 ? 'left' : 'right';
    this.moving = true;
  }

  destroy(): void { this.sprite.destroy(); this.shadow.destroy(); this.bar.destroy(); }

  private enter(s: AIState): void { this.ai = s; this.stateMs = 0; this.animMs = 0; }
  private startAttack(): void { this.enter('attack'); this.struck = false; this.sinceAttack = 0; }

  private canHit(w: MonsterWorld): boolean {
    if (!w.player.alive || w.player.z > 50) return false;
    const vx = w.player.x - this.x, vy = w.player.y - this.y, d = Math.hypot(vx, vy);
    if (d > this.kind.range + 6 || Math.abs(vy) > 40) return false;
    if (d > 8 && (vx < 0) !== (this.dir === 'left')) return false; // in front of it
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
      if (t < WIND) i = Math.min(F.windup - 1, Math.floor(t / (WIND / F.windup)));
      else if (t < WIND + ACTIVE) i = F.windup;
      else i = F.windup + F.active + Math.min(F.recovery - 1, Math.floor((t - WIND - ACTIVE) / (RECOVER / F.recovery)));
    } else if (this.moving) { action = 'walk'; i = Math.floor((this.animMs * C.walkFps * (this.ai === 'wander' ? 0.7 : 1)) / 1000) % C.actions.walk; }
    else { action = 'idle'; i = Math.floor((this.animMs * C.idleFps) / 1000) % C.actions.idle; }
    if (b.state === 'getup' && this.kdMs > 280) { action = 'idle'; i = 0; }
    this.sprite.setTexture(mobFrameKey(this.kind.frames, this.dir, action, i));
  }

  private sync(): void {
    const k = this.kin, b = this.body, t = this.lastNow - b.lastHitAt, S = this.kind.scale;
    const away = this.hitFromX <= k.x ? 1 : -1;
    // Procedural reactions on top of the frame art: flinch lean + squash on every hit, tumble while juggled.
    let ang = 0, sx = 1, sy = 1;
    if (b.state === 'launched' && this.lastNow >= b.pinUntil) {
      const target = away * Math.min(1.45, 0.5 + this.airMs / 380);
      this.tumble += (target - this.tumble) * 0.25;
      ang = this.tumble + (t < 120 ? away * 0.25 * (1 - t / 120) : 0);
    } else {
      this.tumble *= 0.6;
      if (t < 150 && b.state !== 'knockdown' && b.state !== 'getup' && this.alive) { const p = 1 - t / 150; ang = away * 0.26 * p; sx = 1 + 0.1 * p; sy = 1 - 0.07 * p; }
      ang += this.tumble;
    }
    const H = 46 * S; // rotate around the body centre, not the feet
    const cx = k.x, cy = k.y - k.z - H;
    this.sprite.setRotation(ang).setScale(S * sx, S * sy).setPosition(cx - Math.sin(ang) * H, cy + Math.cos(ang) * H).setDepth(k.y);
    if (this.ai === 'dead') this.sprite.setAlpha(this.deathFade).setVisible(this.deathFade > 0);
    this.pos = { x: this.sprite.x, y: this.sprite.y };
    const h = Math.max(0, k.z - k.supportZ), s = Math.max(0.4, 1 - h / 140);
    this.shadow.setPosition(k.x, k.y - k.supportZ - 2).setDepth(k.y - 0.5).setVisible(this.alive).setScale(s);
    // HP bar over the head for a few seconds after a hit (MapleStory style)
    const show = this.alive && this.lastNow < this.barShowUntil;
    this.bar.setVisible(show);
    if (show) {
      const w = 54, y = k.y - k.z - 104 * S, x = k.x - w / 2, f = Math.max(0, this.hp / this.maxHp);
      this.bar.clear().setDepth(k.y + 0.4);
      this.bar.fillStyle(0x000000, 0.7).fillRoundedRect(x - 2, y - 2, w + 4, 9, 3);
      this.bar.fillStyle(0x3a0d0d, 1).fillRect(x, y, w, 5);
      this.bar.fillStyle(f > 0.35 ? 0xe8433a : 0xff7a2a, 1).fillRect(x, y, w * f, 5);
    }
  }
}
