// A remote PvP player: sprite driven by network snapshots with interpolation, name + small HP bar above.
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT from '../data/training-combat.json';
import { FONT_FAMILY, PVP, STAGE6, WORLD_HUD } from '../config/layout';
import { Dir } from '../world/collision';
import { mageRunIndex, mageWalkIndex, setMageFrame, setWarriorAttackFrame, setWarriorAttackPhase, setWarriorIdle, setWarriorRun, setWarriorWalk, setWarriorWalkFrame, skillPoseIndex } from '../world/CharacterSprite';
import { BodyMods, JUMP, applyBodyMods, breathe, deathTopple, hurtLean, jumpState } from '../world/BodyFx';
import { PeerMeta } from './Transport';
import { applySkillAnimation } from '../skills/SkillAnimations';
import { isAtlasClass, setAtlasDeath, setAtlasHurt, setAtlasJump, setAtlasLoop, setAtlasSkillPose } from '../world/ClassAtlas';

const A = COMBAT.attack;
const P6 = STAGE6.player;
const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
const asDir = (d: string): Dir => (DIRS.includes(d as Dir) ? (d as Dir) : 'down');

interface Snap { t: number; x: number; y: number }

export interface RemoteFx { slash(x: number, y: number, dir: Dir): void; impact(x: number, y: number): void }

export class RemotePlayer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private snaps: Snap[] = [];
  private dir: Dir = 'down';
  private anim = 'idle';
  private walkMs = 0;
  private attack: { elapsed: number; dir: Dir; slashed: boolean } | null = null;
  /** Skill pose: Warrior reuses attack frames by phase; Mage keeps its pose with a short book flash at release. */
  private skill: { skillId: string; elapsed: number; dir: Dir; castMs: number; activeMs: number; lockMs: number } | null = null;
  private flashMs = -1;
  private deadMs = -1;
  hp: number = PVP.maxHp;
  alive = true;
  lastSeen = performance.now();

  constructor(private scene: Phaser.Scene, readonly meta: PeerMeta, x: number, y: number, private fx: RemoteFx) {
    const S = WORLD_HUD.shadow, L = PVP.remoteLabel;
    this.shadow = scene.add.ellipse(x, y + S.offsetY, S.w, S.h, 0x000000, S.alpha);
    this.sprite = scene.add.sprite(x, y, ATLAS.textures.idle.key);
    this.label = scene.add.text(x, y, meta.name, {
      fontFamily: FONT_FAMILY, fontSize: `${L.size}px`, fontStyle: 'bold', color: L.color,
      stroke: '#000000', strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1).setDepth(PVP.labelDepth);
    this.bar = scene.add.graphics().setDepth(PVP.labelDepth);
    this.snaps = [{ t: performance.now(), x, y }];
    this.pose();
    this.place(x, y);
    this.drawBar();
  }

  get isMage(): boolean { return this.meta.classId === 'book_mage'; }
  /** Archer / Samurai use the explicit-rect class atlas. */
  get atlasClass(): string | null { return isAtlasClass(this.meta.classId) ? this.meta.classId : null; }
  private loopMode = '';
  private jumpMs = -1; // remote jump arc, started when its state switches to 'jump' (cosmetic)
  private lifeMs = 0;
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** Movement snapshot (also carries hp/alive so late joiners are in sync). */
  applyState(x: number, y: number, dir: string, anim: string, hp: number, alive: boolean): void {
    this.lastSeen = performance.now();
    this.snaps.push({ t: this.lastSeen, x, y });
    if (this.snaps.length > 30) this.snaps.shift();
    if (!this.attack) this.dir = asDir(dir);
    if (anim === 'jump' && this.anim !== 'jump') this.jumpMs = 0;
    this.anim = anim;
    if (hp !== this.hp) { this.hp = hp; this.drawBar(); }
    if (alive && !this.alive) this.revive(x, y);
    else if (!alive && this.alive) this.die();
  }

  startSkill(skillId: string, dir: string, castMs: number, activeMs: number, lockMs: number): void {
    if (!this.alive) return;
    this.attack = null;
    this.skill = { skillId, elapsed: 0, dir: asDir(dir), castMs, activeMs, lockMs };
    this.dir = this.skill.dir;
  }

  startAttack(dir: string): void {
    if (this.isMage || !this.alive) return; // Book Mage never attacks
    this.attack = { elapsed: 0, dir: asDir(dir), slashed: false };
    this.dir = this.attack.dir;
  }

  setHp(hp: number): void {
    const hit = hp < this.hp;
    this.hp = hp;
    this.drawBar();
    if (hit && this.alive) {
      this.flashMs = 0;
      this.sprite.setTintFill(0xffffff);
      this.fx.impact(this.sprite.x, this.sprite.y - PVP.impactUp);
    }
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.attack = null;
    this.deadMs = 0;
    this.sprite.setTint(0xff4a4a);
    this.drawBar();
  }

  /** Respawn: snap (no interpolation from the death spot). */
  revive(x: number, y: number, hp: number = PVP.maxHp): void {
    this.alive = true;
    this.hp = hp;
    this.deadMs = -1;
    this.flashMs = -1;
    this.snaps = [{ t: performance.now(), x, y }];
    this.sprite.clearTint().setAlpha(1);
    this.shadow.setAlpha(1);
    this.anim = 'idle';
    this.jumpMs = -1;
    this.place(x, y);
    this.pose();
    this.drawBar();
  }

  update(ms: number): void {
    this.lifeMs += ms;
    if (this.jumpMs >= 0) { this.jumpMs += ms; if (this.jumpMs >= JUMP.totalMs || !this.alive) this.jumpMs = -1; }
    this.updateBody(ms);
    // Render-only modifiers (same rules as the local player).
    const m: BodyMods = { lift: 0, sx: 1, sy: 1, angle: 0 };
    let shadowK = 1;
    const plain = !this.atlasClass;
    if (this.jumpMs >= 0 && !this.skill && !this.attack) {
      const j = jumpState(this.jumpMs); m.lift = j.lift; m.sx = j.sx; m.sy = j.sy; shadowK = 1 - 0.38 * j.air;
    } else if (this.deadMs >= 0) { if (plain) m.angle = deathTopple(this.deadMs, P6.deathFadeMs, this.dir); }
    else if (this.flashMs >= 0 && plain && !this.skill && !this.attack) m.angle = hurtLean(this.flashMs, P6.hitFlashRedMs, this.dir);
    else if (plain && !this.skill && !this.attack && this.anim === 'idle') m.sy = breathe(this.lifeMs);
    applyBodyMods(this.sprite, m);
    this.shadow.setScale(shadowK, shadowK);
  }

  private updateBody(ms: number): void {
    // Render slightly in the past and interpolate between the two snapshots around that time.
    const rt = performance.now() - PVP.interpDelayMs;
    const s = this.snaps;
    let x = s[s.length - 1].x, y = s[s.length - 1].y;
    for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1].t <= rt) {
        const a = s[i - 1], b = s[i], k = Phaser.Math.Clamp((rt - a.t) / Math.max(1, b.t - a.t), 0, 1);
        x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k;
        break;
      }
      if (i === 1) { x = s[0].x; y = s[0].y; }
    }
    while (s.length > 2 && s[1].t <= rt) s.shift();
    this.place(x, y);

    if (this.flashMs >= 0 && this.alive) {
      this.flashMs += ms;
      if (this.flashMs >= P6.hitFlashRedMs) { this.sprite.clearTint(); this.flashMs = -1; }
      else if (this.flashMs >= P6.hitFlashWhiteMs) this.sprite.setTint(0xff6a6a);
    }
    if (this.deadMs >= 0) {
      this.deadMs += ms;
      const t = Math.min(1, this.deadMs / P6.deathFadeMs);
      this.sprite.setAlpha(1 - (1 - P6.deathAlpha) * t);
      this.shadow.setAlpha(1 - t);
      if (this.atlasClass) { setAtlasDeath(this.sprite, this.atlasClass, this.dir, this.deadMs, P6.deathFadeMs); return; }
    }

    if (this.skill) {
      const k = this.skill;
      k.elapsed += ms;
      if (!this.alive || k.elapsed >= k.lockMs) this.skill = null;
      else if ((this.anim !== 'walk' && this.anim !== 'run') || k.elapsed < k.castMs + k.activeMs) {
        // Same body animation as the caster sees (cosmetic); recovery walking shows the normal walk.
        if (this.atlasClass) { setAtlasSkillPose(this.sprite, this.atlasClass, k.skillId, k.dir, k.elapsed, k.castMs, k.activeMs, k.lockMs); return; }
        if (applySkillAnimation(this.sprite, k.skillId, k.dir, k.elapsed)) return;
        if (!this.isMage) { setWarriorAttackPhase(this.sprite, k.dir, skillPoseIndex(k.elapsed, k.castMs, k.activeMs)); return; }
      }
    }
    if (this.attack) {
      const a = this.attack;
      a.elapsed += ms;
      if (!a.slashed && a.elapsed >= A.hitAtMs) { a.slashed = true; this.fx.slash(this.sprite.x, this.sprite.y, a.dir); }
      if (a.elapsed >= A.totalDurationMs) this.attack = null;
      else { setWarriorAttackFrame(this.sprite, a.dir, a.elapsed); return; }
    }
    this.pose(ms);
  }

  private pose(ms = 0): void {
    const moving = this.alive && (this.anim === 'walk' || this.anim === 'run');
    const running = moving && this.anim === 'run';
    if (this.alive && this.jumpMs >= 0) {
      const ph = jumpState(this.jumpMs).phase, air = ph === 'rise' || ph === 'fall';
      if (this.atlasClass) setAtlasJump(this.sprite, this.atlasClass, this.dir, ph);
      else if (this.isMage) setMageFrame(this.sprite, this.dir, air ? 'walk' : 'idle', air ? 1 : 0);
      else if (air) setWarriorWalkFrame(this.sprite, this.dir, ph === 'rise' ? 1 : 3);
      else setWarriorIdle(this.sprite, this.dir);
      return;
    }
    if (this.atlasClass) {
      if (!moving && this.flashMs >= 0) { setAtlasHurt(this.sprite, this.atlasClass, this.dir, this.flashMs, P6.hitFlashRedMs); return; }
      const mode = running ? 'run' : moving ? 'walk' : 'idle';
      this.walkMs = mode === this.loopMode ? this.walkMs + ms : 0;
      this.loopMode = mode;
      setAtlasLoop(this.sprite, this.atlasClass, this.dir, mode, this.walkMs);
      return;
    }
    if (this.isMage) {
      if (moving) { this.walkMs += ms; setMageFrame(this.sprite, this.dir, 'walk', running ? mageRunIndex(this.dir, this.walkMs, 1.6) : mageWalkIndex(this.dir, this.walkMs)); }
      else { this.walkMs = 0; setMageFrame(this.sprite, this.dir, 'idle', 0); }
    } else if (running) setWarriorRun(this.sprite, this.dir, 1.6);
    else if (moving) setWarriorWalk(this.sprite, this.dir);
    else setWarriorIdle(this.sprite, this.dir);
  }

  private place(x: number, y: number): void {
    this.sprite.setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y + WORLD_HUD.shadow.offsetY).setDepth(y - 0.5);
    const top = y - WORLD.player.displayHeight - PVP.remoteLabel.gap;
    this.label.setPosition(Math.round(x), Math.round(top - PVP.hpBar.h - 3));
    this.bar.setPosition(Math.round(x), Math.round(top));
  }

  private drawBar(): void {
    const g = this.bar, H = PVP.hpBar;
    g.clear();
    if (!this.alive) return;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(H.background), 1).fillRect(-H.w / 2, 0, H.w, H.h);
    g.fillStyle(col(H.fill), 1).fillRect(-H.w / 2, 0, (H.w * Math.max(0, this.hp)) / PVP.maxHp, H.h);
    g.lineStyle(1, col(H.border), 1).strokeRect(-H.w / 2, 0, H.w, H.h);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
    this.bar.destroy();
  }
}
