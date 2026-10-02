// Stage 4–6: Legacy Courtyard — fixed camera, smooth 4-direction movement, sword attack with feel polish,
// training dummy and one Cursed Swordsman. Numbers come from src/data JSON + STAGE6 (world = map pixels).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import COMBAT from '../data/training-combat.json';
import S6 from '../data/stage6-combat.json';
import { BOOK_MAGE_WORLD, CHARACTER_PREVIEWS, CLASS_NAMES, HUD, PVP, STAGE6, WORLD_HUD } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { WorldHUD } from '../ui/WorldHUD';
import { HudMarker, HudSlot, HudState, PortraitRef } from '../ui/hud/HudState';
import { Character } from '../characters/CharacterTypes';
import { Dir, facingFrom, footAllowedStatic } from '../world/collision';
import { CursedSwordsman, preloadEnemyFrames } from '../world/CursedSwordsman';
import { CourtyardAmbience } from '../world/Ambience';
import { mageWalkIndex, registerMageFrames, setMageFrame, setWarriorAttackFrame, setWarriorIdle, setWarriorWalk } from '../world/CharacterSprite';
import { PvpController } from '../pvp/PvpController';
import { clearPvpFromUrl, newPlayerId } from '../pvp/Room';

const T = ATLAS.textures;
const CT = COMBAT_ASSETS.textures;
const A = COMBAT.attack;
const D = COMBAT.dummy;
const R = WORLD.player.footRadius;
const MOVE = S6.player.movement;
const FEEL = S6.player.attackFeel;
const P6 = STAGE6.player;
const TOP_DEPTH = 100000; // effects and health bar above every feet-sorted object
const FACING = COMBAT.facing as Record<Dir, number[]>;

interface Attack { id: number; dir: Dir; elapsed: number; hitChecked: boolean; slashSpawned: boolean; lungeApplied: number }
interface Fx { sprite: Phaser.GameObjects.Image; elapsed: number; frameMs: number; keys: string[] }

const slashKey = (i: number) => `fx-slash-${i}`;
const dustKey = (i: number) => `fx-dust-${i}`;

/** Lunge distance along the facing for an attack elapsed time: ease-out during strike, hold, ease back in recovery. */
function lungeAt(e: number): number {
  const [w, s, f, r] = A.phaseDurationMs;
  if (e < w) return 0;
  if (e < w + s) { const t = (e - w) / s; return FEEL.lungePx * (1 - (1 - t) * (1 - t)); }
  if (e < w + s + f) return FEEL.lungePx;
  if (e < w + s + f + r) { const t = (e - w - s - f) / r; return FEEL.lungePx * (1 - t * t * (3 - 2 * t)); }
  return 0;
}

/** Existing class portrait: dedicated portrait file, else the Character Select crop of the full-body preview. */
function portraitOf(classId: string, appearanceId: string): PortraitRef | undefined {
  const pv = CHARACTER_PREVIEWS[`${classId}/${appearanceId}`];
  if (!pv) return undefined;
  return pv.portrait ? { url: pv.portrait } : { url: pv.file, crop: { x: pv.crop.x, y: pv.crop.y, w: pv.crop.w, imgW: pv.width, imgH: pv.height } };
}

/** Stage 5 hit rule: target feet within range and inside the facing cone of the attacker's feet. */
function swingHits(ax: number, ay: number, dir: Dir, tx: number, ty: number): boolean {
  const vx = tx - ax, vy = ty - ay, dist = Math.hypot(vx, vy);
  if (dist > A.range || dist === 0) return false;
  const f = FACING[dir];
  return (vx * f[0] + vy * f[1]) / dist >= A.minimumFacingDot;
}

export class LegacyCourtyardScene extends Phaser.Scene {
  /** Read by the QA panel: x,y are the feet. */
  player?: Phaser.GameObjects.Sprite;
  /** Read by the QA panel. */
  playerHP = S6.player.maxHp;
  enemy?: CursedSwordsman;
  private ambience?: CourtyardAmbience;
  /** Book Mage uses its own sheet frames and has no attack in this build. */
  private isMage = false;
  private mageWalkMs = 0;
  private shadow?: Phaser.GameObjects.Ellipse;
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private dir: Dir = ATLAS.initialDirection as Dir;
  private hud?: WorldHUD;
  private character?: Character;

  // Movement (Stage 6 polish).
  private vx = 0;
  private vy = 0;
  private hadInput = false;
  private lastInput = { x: 0, y: 0 };
  private sinceDust = Infinity;

  // Combat (scene-local, never saved).
  private attack: Attack | null = null;
  private attackSeq = 0;
  private sinceAttackStart = Infinity; // cooldown is measured from attack start
  private hitStopLeft = 0;
  private dummy?: Phaser.GameObjects.Image;
  private dummyBar?: Phaser.GameObjects.Graphics;
  private dummyHp = D.maxHp;
  private dummyAlive = true;
  private lastHitAttackId = -1;
  private flashLeft = 0;
  private respawnLeft = 0;
  private impacts: { sprite: Phaser.GameObjects.Sprite; elapsed: number }[] = [];
  private fx: Fx[] = [];

  // Player damage / death (Stage 6).
  private playerFlashMs = -1;
  private playerDeadMs = -1; // >= 0 while dead

  // PVP Arena (scene started with { pvpRoom }): no dummy / enemy; remote players over the network.
  /** Read by the QA panel. */
  pvp?: PvpController;
  private pvpReady = false; // local player spawned after joining the room
  private hitsTaken = new Set<string>(); // attackerId:attackId already applied (one hit per attack)

  constructor() { super('LegacyCourtyardScene'); }

  preload(): void {
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    for (const t of [T.walk, T.idle, CT.attack, CT.impact]) {
      if (!this.textures.exists(t.key)) this.load.spritesheet(t.key, t.file, { frameWidth: t.frameWidth, frameHeight: t.frameHeight });
    }
    if (!this.textures.exists(CT.dummy.key)) this.load.image(CT.dummy.key, CT.dummy.file);
    for (let i = 0; i < STAGE6.slash.frames; i++) if (!this.textures.exists(slashKey(i))) this.load.image(slashKey(i), `${STAGE6.slash.path}/0${i}.png`);
    for (let i = 0; i < STAGE6.dust.frames; i++) if (!this.textures.exists(dustKey(i))) this.load.image(dustKey(i), `${STAGE6.dust.path}/0${i}.png`);
    preloadEnemyFrames(this);
    if (!this.textures.exists(BOOK_MAGE_WORLD.sheetKey)) this.load.image(BOOK_MAGE_WORLD.sheetKey, BOOK_MAGE_WORLD.sheetFile);
  }

  create(data?: { pvpRoom?: string }): void {
    const character = CharacterStore.getSelectedCharacter();
    if (!character) { this.scene.start('CharacterSelectScene'); return; } // never auto-create a character
    const pvpRoom = data?.pvpRoom ?? null;
    this.isMage = character.classId === 'book_mage';
    this.mageWalkMs = 0;
    registerMageFrames(this); // remote PvP players may be Book Mages too
    this.pvp = undefined; this.pvpReady = !pvpRoom; this.hitsTaken = new Set();

    // Reset scene-local state on every entry.
    this.attack = null; this.sinceAttackStart = Infinity; this.hitStopLeft = 0;
    this.dummyHp = D.maxHp; this.dummyAlive = true;
    this.lastHitAttackId = -1; this.flashLeft = 0; this.respawnLeft = 0; this.impacts = []; this.fx = [];
    this.dir = ATLAS.initialDirection as Dir;
    this.vx = 0; this.vy = 0; this.hadInput = false; this.sinceDust = Infinity;
    this.playerHP = S6.player.maxHp; this.playerFlashMs = -1; this.playerDeadMs = -1;

    // Map in world pixels; fixed camera fits it (contain), no stretching; crisp pixel positions.
    this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(-1);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(cam.width / WORLD.camera.worldWidth, cam.height / WORLD.camera.worldHeight));
    cam.centerOn(WORLD.coordinateSpace.width / 2, WORLD.coordinateSpace.height / 2);
    cam.setRoundPixels(true);
    this.ambience = new CourtyardAmbience(this, WORLD.coordinateSpace.width, WORLD.coordinateSpace.height);

    for (const [d, def] of Object.entries(ATLAS.directions)) {
      const key = `warrior-walk-${d}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key, frames: this.anims.generateFrameNumbers(T.walk.key, { frames: def.walkFrames }),
          frameRate: ATLAS.walkFrameRate, repeat: ATLAS.walkRepeat,
        });
      }
    }

    if (!pvpRoom) {
      // Training dummy (stationary, round collision body).
      this.dummy = this.add.image(D.x, D.y, CT.dummy.key).setOrigin(CT.dummy.origin.x, CT.dummy.origin.y);
      this.dummy.setScale(CT.dummy.displayHeight / CT.dummy.height).setDepth(D.y);
      this.dummyBar = this.add.graphics().setDepth(TOP_DEPTH);
      this.drawDummyBar();
      this.enemy = new CursedSwordsman(this);
    } else {
      this.dummyAlive = false; // PvP: no single-player combat objects
    }

    const { x, y } = WORLD.spawn;
    const S = WORLD_HUD.shadow;
    this.shadow = this.add.ellipse(x, y + S.offsetY, S.w, S.h, 0x000000, S.alpha);
    this.player = this.add.sprite(x, y, T.idle.key, ATLAS.directions[this.dir].idleFrame);
    this.setIdle();
    this.syncDepths();
    if (pvpRoom) { this.player.setVisible(false); this.shadow.setVisible(false); } // shown once the room is joined

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as LegacyCourtyardScene['keys'];
    const onSpace = (e: KeyboardEvent) => { if (!e.repeat) this.beginAttack(); };
    kb.on('keydown-SPACE', onSpace);

    // Losing focus clears keys, stops movement and cancels an attack before it can hit.
    const stop = () => { kb.resetKeys(); this.vx = 0; this.vy = 0; this.cancelAttack(); };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    const exitArena = () => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); };
    this.character = character;
    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, {
      returnLabel: pvpRoom ? PVP.hud.exitText : 'BACK TO CHARACTERS',
      onReturn: pvpRoom ? exitArena : () => this.scene.start('CharacterSelectScene'),
      onBasicAttack: () => { if (this.pvpReady) this.beginAttack(); }, // same permission checks as Space
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, (_t: number, d: number) => {
      if (!this.hud) return;
      this.hud.layout();
      if (this.player) this.hud.update(this.hudState(), this.time.now, d);
    });
    if (pvpRoom) {
      kb.on('keydown-ESC', exitArena);
      this.startPvp(pvpRoom, { playerId: newPlayerId(), characterId: character.id, classId: character.classId, name: character.name });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      kb.off('keydown-SPACE', onSpace);
      kb.off('keydown-ESC', exitArena);
      this.pvp?.destroy(); // presence, channel, listeners, remote players, names, HP bars, timers
      this.pvp = undefined;
      this.pvpReady = false;
      kb.resetKeys();
      kb.removeAllKeys(true);
      for (const i of this.impacts) i.sprite.destroy();
      for (const f of this.fx) f.sprite.destroy();
      this.impacts = []; this.fx = [];
      this.attack = null;
      this.enemy?.destroy();
      this.enemy = undefined;
      this.ambience?.destroy();
      this.ambience = undefined;
      this.hud?.destroy();
      this.hud = undefined;
      this.character = undefined;
      this.keys = undefined;
      this.player = undefined;
      this.dummy = undefined;
      this.dummyBar = undefined;
    });
  }

  update(_time: number, delta: number): void {
    const k = this.keys, p = this.player;
    if (!k || !p) return;
    this.ambience?.update(delta); // purely visual; keeps drifting even during hit-stop
    this.pvp?.update(delta);
    if (!this.pvpReady) return; // PvP: waiting for the room (or room full)
    if (this.hitStopLeft > 0) { this.hitStopLeft -= delta; return; } // whole simulation freezes on a confirmed hit
    const ms = delta;
    this.sinceAttackStart += ms;
    this.sinceDust += ms;
    this.updateDummy(ms);
    this.updateImpacts(ms);
    this.updateFx(ms);
    this.updatePlayerFlash(ms);
    this.enemy?.update(ms, {
      player: { x: p.x, y: p.y, alive: this.playerDeadMs < 0 },
      blocked: (x, y) =>
        (this.playerDeadMs < 0 && Math.hypot(x - p.x, y - p.y) < STAGE6.enemy.collisionRadius + R) ||
        (this.dummyAlive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + STAGE6.enemy.footRadius),
      onHitPlayer: (dmg) => this.damagePlayer(dmg),
    });

    if (this.playerDeadMs >= 0) { this.updateDeath(ms); this.syncDepths(); return; }
    if (this.attack) { this.updateAttack(ms); this.syncDepths(); return; } // movement and turning locked

    this.updateMovement(ms);
    this.syncDepths();
  }

  // ---------------- movement (acceleration / deceleration) ----------------

  private updateMovement(ms: number): void {
    const k = this.keys!, p = this.player!;
    const ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const hasInput = ix !== 0 || iy !== 0;
    const dt = Math.min(0.05, ms / 1000);
    const maxV = WORLD.player.speed;
    const speedBefore = Math.hypot(this.vx, this.vy);

    if (hasInput) {
      const len = Math.hypot(ix, iy); // normalized diagonal
      const tx = (ix / len) * maxV, ty = (iy / len) * maxV;
      const ddx = tx - this.vx, ddy = ty - this.vy, dl = Math.hypot(ddx, ddy), step = MOVE.accelerationPxPerSec2 * dt;
      if (dl <= step) { this.vx = tx; this.vy = ty; } else { this.vx += (ddx / dl) * step; this.vy += (ddy / dl) * step; }
      this.dir = facingFrom(ix, iy, this.dir); // facing follows input, never velocity jitter
      // Dust: start from (near) rest, or a sharp (>90°) direction change.
      const sharp = this.hadInput && ix * this.lastInput.x + iy * this.lastInput.y < 0;
      if ((!this.hadInput && speedBefore < maxV * 0.25) || sharp) this.spawnDust();
      this.lastInput = { x: ix, y: iy };
    } else {
      if (this.hadInput && speedBefore > maxV * 0.5) this.spawnDust(); // stop
      const ns = Math.max(0, speedBefore - MOVE.decelerationPxPerSec2 * dt);
      if (speedBefore > 0) { this.vx *= ns / speedBefore; this.vy *= ns / speedBefore; }
    }
    this.hadInput = hasInput;

    // Axis-separated: blocked on one axis still slides on the other; a blocked axis loses its velocity.
    const nx = p.x + this.vx * dt, ny = p.y + this.vy * dt;
    if (this.vx !== 0) { if (this.footAllowed(nx, p.y)) p.x = nx; else this.vx = 0; }
    if (this.vy !== 0) { if (this.footAllowed(p.x, ny)) p.y = ny; else this.vy = 0; }

    if (Math.hypot(this.vx, this.vy) > P6.walkThreshold && this.isMage) {
      this.mageWalkMs += ms;
      setMageFrame(p, this.dir, 'walk', mageWalkIndex(this.dir, this.mageWalkMs));
    } else if (Math.hypot(this.vx, this.vy) > P6.walkThreshold) {
      setWarriorWalk(p, this.dir);
    } else {
      this.setIdle();
    }
  }

  private spawnDust(): void {
    if (this.sinceDust < STAGE6.dust.minIntervalMs) return;
    this.sinceDust = 0;
    const p = this.player!;
    const s = this.add.image(p.x, p.y, dustKey(0)).setOrigin(0.5, 0.5).setDepth(p.y - 1);
    s.setScale(STAGE6.dust.displayWidth / s.width);
    this.fx.push({ sprite: s, elapsed: 0, frameMs: 1000 / S6.fx.movementDustFps, keys: [...Array(STAGE6.dust.frames).keys()].map(dustKey) });
  }

  // ---------------- player states (feet x/y never change between states) ----------------

  private setIdle(): void {
    const p = this.player!;
    if (this.isMage) { this.mageWalkMs = 0; setMageFrame(p, this.dir, 'idle', 0); return; }
    setWarriorIdle(p, this.dir);
  }

  private footAllowed(x: number, y: number): boolean {
    if (!footAllowedStatic(x, y, R)) return false;
    if (this.dummy && this.dummyAlive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + R) return false;
    const e = this.enemy;
    return !(e && e.alive && Math.hypot(x - e.x, y - e.y) < STAGE6.enemy.collisionRadius + R);
  }

  private syncDepths(): void {
    const p = this.player!;
    p.setDepth(p.y);
    this.shadow?.setPosition(p.x, p.y + WORLD_HUD.shadow.offsetY).setDepth(p.y - 0.5);
  }

  // ---------------- attack ----------------

  private beginAttack(): void {
    if (this.isMage) return; // Book Mage has no attack in this build (never uses Warrior attack/slash assets)
    if (!this.player || this.playerDeadMs >= 0 || this.attack || this.sinceAttackStart < A.cooldownMs) return; // no queue
    this.attack = { id: ++this.attackSeq, dir: this.dir, elapsed: 0, hitChecked: false, slashSpawned: false, lungeApplied: 0 };
    this.sinceAttackStart = 0;
    this.vx = 0; this.vy = 0;
    this.showAttackFrame();
    this.pvp?.sendAttack(this.attack.id, this.attack.dir, this.player.x, this.player.y);
  }

  private cancelAttack(): void {
    if (!this.attack || !this.player) return;
    this.applyLunge(this.attack, 0); // step back from any lunge
    this.attack = null;
    this.setIdle();
  }

  private updateAttack(ms: number): void {
    const a = this.attack!;
    a.elapsed += ms;
    if (!a.hitChecked && a.elapsed >= A.hitAtMs) { a.hitChecked = true; this.resolveHit(a); }
    if (!a.slashSpawned && a.elapsed >= A.hitAtMs) { a.slashSpawned = true; this.spawnSlash(a.dir); }
    if (a.elapsed >= A.totalDurationMs) { this.applyLunge(a, 0); this.attack = null; this.setIdle(); return; }
    this.applyLunge(a, lungeAt(a.elapsed));
    this.showAttackFrame();
  }

  /** Moves the feet toward the wanted lunge offset along the facing, never into colliders. */
  private applyLunge(a: Attack, want: number): void {
    const p = this.player!, f = FACING[a.dir];
    const delta = want - a.lungeApplied;
    if (delta === 0) return;
    const nx = p.x + f[0] * delta, ny = p.y + f[1] * delta;
    if (this.footAllowed(nx, ny) || delta < 0) { p.x = nx; p.y = ny; a.lungeApplied = want; }
  }

  private showAttackFrame(): void {
    const a = this.attack!;
    setWarriorAttackFrame(this.player!, a.dir, a.elapsed);
  }

  private inSwing(a: Attack, tx: number, ty: number): boolean {
    const p = this.player!;
    return swingHits(p.x, p.y, a.dir, tx, ty);
  }

  /** Single range + facing check per target at the hit moment; at most one hit per target per attack id. */
  private resolveHit(a: Attack): void {
    let landed = false;
    if (this.pvp) {
      // PvP: broadcast the strike; each victim validates and applies it to itself. Feel only when it looks like a hit.
      const p = this.player!;
      this.pvp.sendStrike(a.id, a.dir, Math.round(p.x), Math.round(p.y));
      for (const r of this.pvp.remotes.values()) if (r.alive && this.inSwing(a, r.x, r.y)) landed = true;
    }
    if (this.dummyAlive && this.lastHitAttackId !== a.id && this.inSwing(a, D.x, D.y)) {
      this.lastHitAttackId = a.id;
      this.dummyHp = Math.max(0, this.dummyHp - A.damage);
      this.flashLeft = D.hitFlashMs;
      this.dummy!.setTintFill(0xffffff);
      this.spawnImpact(D.x + D.impactOffset.x, D.y + D.impactOffset.y);
      if (this.dummyHp === 0) { this.dummyAlive = false; this.dummy!.setVisible(false); this.respawnLeft = D.respawnDelayMs; }
      this.drawDummyBar();
      landed = true;
    }
    const e = this.enemy;
    if (e && e.alive && this.inSwing(a, e.x, e.y) && e.takeHit(S6.player.existingDamage)) {
      this.spawnImpact(e.x, e.y + STAGE6.enemy.impactOffsetY);
      landed = true;
    }
    if (landed) { // feel only: tiny hit-stop + camera shake
      this.hitStopLeft = FEEL.hitStopMs;
      this.cameras.main.shake(FEEL.cameraShakeMs, FEEL.cameraShakeIntensity);
    }
  }

  private spawnSlash(dir: Dir): void {
    this.spawnSlashAt(this.player!.x, this.player!.y, dir);
  }

  private spawnSlashAt(x: number, y: number, dir: Dir): void {
    const f = FACING[dir], C = STAGE6.slash;
    const s = this.add.image(x + f[0] * C.forward, y + f[1] * C.forward - C.up, slashKey(0))
      .setOrigin(0.5, 0.5).setDepth(TOP_DEPTH).setAngle(C.rotationDeg[dir]);
    s.setScale(C.displayHeight / s.height);
    this.fx.push({ sprite: s, elapsed: 0, frameMs: 1000 / S6.fx.swordSlashFps, keys: [...Array(C.frames).keys()].map(slashKey) });
  }

  // ---------------- player damage / death ----------------

  /** PvP victim-side validation of a remote strike: alive, range + facing (same Stage 5 rule), one hit per attack. */
  private receiveStrike(from: string, id: number, ax: number, ay: number, dir: Dir): void {
    const p = this.player;
    if (!p || !this.pvpReady || this.playerDeadMs >= 0 || !FACING[dir]) return;
    const key = `${from}:${id}`;
    if (this.hitsTaken.has(key) || !swingHits(ax, ay, dir, p.x, p.y)) return;
    this.hitsTaken.add(key);
    this.damagePlayer(A.damage);
    this.spawnImpact(p.x, p.y - PVP.impactUp);
    this.pvp?.sendHp(this.playerHP, from);
    if (this.playerHP === 0) this.pvp?.sendDeath(from);
  }

  private startPvp(room: string, meta: { playerId: string; characterId: string; classId: string; name: string }): void {
    const fx = {
      slash: (x: number, y: number, dir: Dir) => this.spawnSlashAt(x, y, dir),
      impact: (x: number, y: number) => this.spawnImpact(x, y),
    };
    this.hud?.setStatus('CONNECTING…');
    const pvp = new PvpController(this, room, meta, {
      onJoined: () => {
        const sp = this.freeSpawnPoint();
        this.player!.setPosition(sp.x, sp.y).setVisible(true);
        this.shadow!.setVisible(true);
        this.pvpReady = true;
        this.syncDepths();
        this.hud?.setStatus(null);
      },
      onFull: () => this.hud?.setStatus('ROOM FULL'),
      onError: () => this.hud?.setStatus('CONNECTION FAILED'),
      onStrike: (from, id, x, y, dir) => this.receiveStrike(from, id, x, y, dir),
      getLocal: () => {
        const p = this.player;
        if (!p || !this.pvpReady) return null;
        const dead = this.playerDeadMs >= 0;
        const anim = dead ? 'dead' : this.attack ? 'attack' : Math.hypot(this.vx, this.vy) > P6.walkThreshold ? 'walk' : 'idle';
        return { x: p.x, y: p.y, dir: this.attack?.dir ?? this.dir, anim, hp: this.playerHP, alive: !dead };
      },
    }, fx);
    this.pvp = pvp;
    void pvp.join();
  }

  /** Random safe spawn point that is not near another player; the least crowded one if all are occupied. */
  private freeSpawnPoint(): { x: number; y: number } {
    const others = [...(this.pvp?.remotes.values() ?? [])].filter((r) => r.alive).map((r) => ({ x: r.x, y: r.y }));
    const pts = PVP.spawnPoints.filter((s) => footAllowedStatic(s.x, s.y, R));
    const clearance = (s: { x: number; y: number }) => Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - s.x, o.y - s.y)));
    const free = pts.filter((s) => clearance(s) >= PVP.spawnClearRadius);
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return pts.reduce((best, s) => (clearance(s) > clearance(best) ? s : best), pts[0]);
  }

  // ---------------- HUD adapter (reads existing state only; no gameplay) ----------------

  private hudState(): HudState {
    const p = this.player!, ch = this.character!, now = this.time.now;
    const alive = this.playerDeadMs < 0;
    const pvp = this.pvp;
    const markers: HudMarker[] = [];
    if (this.pvpReady) markers.push({ id: 'local', kind: 'player', x: p.x, y: p.y });
    for (const r of pvp?.remotes.values() ?? []) if (r.alive) markers.push({ id: r.meta.playerId, kind: 'remote', x: r.x, y: r.y });
    if (this.enemy?.alive) markers.push({ id: 'enemy', kind: 'enemy', x: this.enemy.x, y: this.enemy.y });

    const cooling = !this.isMage && this.sinceAttackStart < A.cooldownMs;
    const slots: HudSlot[] = HUD.skills.hotkeys.map((hotkey, i) => i === 0
      ? {
        id: 'basic-attack', hotkey, iconUrl: `${HUD.path}/icon-attack.png`,
        label: this.isMage ? 'No basic attack' : 'Basic Attack',
        assigned: true, enabled: !this.isMage && alive && this.pvpReady,
        pressed: !!this.keys?.SPACE.isDown,
        cooldown: cooling ? { endTimeMs: now + (A.cooldownMs - this.sinceAttackStart), durationMs: A.cooldownMs } : null,
      }
      : { id: `slot-${hotkey}`, hotkey, label: 'Unassigned', assigned: false, enabled: false, pressed: false, cooldown: null });

    return {
      mode: pvp ? 'pvp' : 'pve',
      player: {
        id: pvp?.meta.playerId ?? ch.id, name: ch.name, level: ch.level, portrait: portraitOf(ch.classId, ch.appearanceId ?? `${ch.classId}_default`),
        hp: this.playerHP, maxHp: pvp ? PVP.maxHp : S6.player.maxHp, resource: null, effects: [],
      },
      target: alive && this.pvpReady ? this.hudTarget() : null,
      slots,
      minimap: {
        label: WORLD.name, imageUrl: T.map.file, markers,
        bounds: { minX: 0, minY: 0, width: WORLD.coordinateSpace.width, height: WORLD.coordinateSpace.height },
      },
      room: pvp ? { label: `ROOM ${pvp.room}`, playerCount: pvp.connected ? pvp.remotes.size + 1 : 0, maxPlayers: PVP.maxPlayers } : null,
      combatFeedback: null,
    };
  }

  /** Contextual target: nearest living hostile within HUD.targetRadius of the player (display only). */
  private hudTarget(): HudState['target'] {
    const p = this.player!;
    let best: HudState['target'] = null, bestD: number = HUD.targetRadius;
    const consider = (d: number, t: NonNullable<HudState['target']>) => { if (d <= bestD) { bestD = d; best = t; } };
    const e = this.enemy;
    if (e?.alive) consider(Math.hypot(e.x - p.x, e.y - p.y), { id: 'enemy', name: 'Cursed Swordsman', type: 'Enemy', hp: e.hp, maxHp: S6.enemy.maxHp, effects: [] });
    if (this.dummy && this.dummyAlive) consider(Math.hypot(D.x - p.x, D.y - p.y), { id: 'dummy', name: 'Training Dummy', type: 'Training Target', hp: this.dummyHp, maxHp: D.maxHp, effects: [] });
    for (const r of this.pvp?.remotes.values() ?? []) {
      if (!r.alive) continue;
      consider(Math.hypot(r.x - p.x, r.y - p.y), {
        id: r.meta.playerId, name: r.meta.name, type: `Player · ${CLASS_NAMES[r.meta.classId] ?? r.meta.classId}`,
        portrait: portraitOf(r.meta.classId, `${r.meta.classId}_default`), hp: r.hp, maxHp: PVP.maxHp, effects: [],
      });
    }
    return best;
  }

  private damagePlayer(dmg: number): void {
    if (this.playerDeadMs >= 0) return;
    this.playerHP = Math.max(0, this.playerHP - dmg);
    this.playerFlashMs = 0;
    this.player!.setTintFill(0xffffff);
    if (this.playerHP === 0) this.killPlayer();
  }

  private updatePlayerFlash(ms: number): void {
    if (this.playerFlashMs < 0 || this.playerDeadMs >= 0) return;
    this.playerFlashMs += ms;
    const p = this.player!;
    if (this.playerFlashMs >= P6.hitFlashRedMs) { p.clearTint(); this.playerFlashMs = -1; }
    else if (this.playerFlashMs >= P6.hitFlashWhiteMs) p.setTint(0xff6a6a);
  }

  private killPlayer(): void {
    this.cancelAttack();
    this.keys && this.input.keyboard!.resetKeys();
    this.vx = 0; this.vy = 0; this.hadInput = false;
    this.playerDeadMs = 0;
    this.player!.setTint(0xff4a4a);
  }

  private respawnPvp(): void {
    const p = this.player!, sp = this.freeSpawnPoint();
    p.setPosition(sp.x, sp.y).setAlpha(1).clearTint();
    this.shadow?.setAlpha(1);
    this.playerHP = PVP.maxHp; this.playerDeadMs = -1; this.playerFlashMs = -1;
    this.input.keyboard?.resetKeys(); this.vx = 0; this.vy = 0; this.hadInput = false; // no input carried over from death
    this.setIdle();
    this.pvp?.sendRespawn(p.x, p.y, this.playerHP);
  }

  private updateDeath(ms: number): void {
    const p = this.player!;
    this.playerDeadMs += ms;
    const t = Math.min(1, this.playerDeadMs / P6.deathFadeMs);
    p.setAlpha(1 - (1 - P6.deathAlpha) * t);
    this.shadow?.setAlpha(1 - t);
    if (this.pvp) { if (this.playerDeadMs >= PVP.respawnMs) this.respawnPvp(); return; }
    if (this.playerDeadMs >= P6.deathFadeMs + P6.deathPauseMs) {
      // Reset to courtyard spawn with full HP (no game-over screen in this stage).
      p.setPosition(WORLD.spawn.x, WORLD.spawn.y).setAlpha(1).clearTint();
      this.shadow?.setAlpha(1);
      this.playerHP = S6.player.maxHp; this.playerDeadMs = -1; this.playerFlashMs = -1;
      this.dir = ATLAS.initialDirection as Dir;
      this.setIdle();
      this.enemy?.alive && this.enemy.reset(); // the enemy returns to its post
    }
  }

  // ---------------- dummy + effects ----------------

  private updateDummy(ms: number): void {
    if (!this.dummy) return; // PvP has no training dummy
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

  private spawnImpact(x: number, y: number): void {
    const s = this.add.sprite(x, y, CT.impact.key, COMBAT_ASSETS.impactFrames[0])
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

  /** Slash + dust: single-play image sequences, destroyed at the end. */
  private updateFx(ms: number): void {
    this.fx = this.fx.filter((f) => {
      f.elapsed += ms;
      const idx = Math.floor(f.elapsed / f.frameMs);
      if (idx >= f.keys.length) { f.sprite.destroy(); return false; }
      f.sprite.setTexture(f.keys[idx]);
      return true;
    });
  }
}
