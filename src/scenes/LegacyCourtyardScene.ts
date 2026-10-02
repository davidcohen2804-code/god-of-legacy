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
import { mageWalkIndex, registerMageFrames, setMageFrame, setWarriorAttackFrame, setWarriorAttackPhase, setWarriorIdle, setWarriorWalk, skillPoseIndex } from '../world/CharacterSprite';
import { CastRun, EVENTS, SkillSystem } from '../skills/SkillSystem';
import { SkillDef, UNASSIGNED_ICON, damageFor, getSkill, slotsForClass } from '../skills/SkillRegistry';
import { HitTarget, dashEnd, knockbackDir, placementLegal, runePlacement, shapeHits, spawnProjectile, stepProjectile, sweepStatic } from '../skills/HitResolver';
import { ControlState } from '../skills/ControlPolicy';
import { preloadSkillVfx } from '../skills/SkillVfx';
import { isQAMode } from '../qa/QAPanel';
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
const SLOT_KEYS = ['SPACE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'] as const;
type KeyName = 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | (typeof SLOT_KEYS)[number];
/** PvP victim-side sanity checks for a remote cast intent (network jitter tolerances). */
const CAST_COOLDOWN_TOLERANCE_MS = 250;
const CAST_ORIGIN_TOLERANCE_PX = 120;
const CAST_FLASH_MS = 80; // Book Mage release flash (existing pose, no new animation)
const skillLabel = (id: string) => id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const BASIC = () => getSkill('warrior_basic')!;
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
  private keys?: Record<KeyName, Phaser.Input.Keyboard.Key>;
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

  // Skill System V1: one engine for PvE and PvP (read by QA).
  skills?: SkillSystem;
  private slotDefs: (SkillDef | null)[] = [];
  private simMs = 0; // authority clock for this client's simulation (cooldowns, control)
  private castSeq = 0;
  private localId = 'local';
  /** Hard-control state of the local player (this client is its authority in PvP). */
  readonly control = new ControlState();
  private selfKb: { vx: number; vy: number; left: number } | null = null;
  private remoteCasts = new Map<string, number>(); // attackerId:skillId -> last accepted cast time
  private seenCasts = new Set<string>();
  private castFlashMs = -1;

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
    preloadSkillVfx(this);
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
    const playerId = newPlayerId();
    this.localId = pvpRoom ? playerId : 'local';
    this.slotDefs = slotsForClass(character.classId);
    this.simMs = 0; this.castSeq = 0; this.control.reset(); this.selfKb = null; this.castFlashMs = -1;
    this.remoteCasts = new Map(); this.seenCasts = new Set();

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

    this.skills = new SkillSystem(this, {
      now: () => this.simMs,
      targets: (r) => this.skillTargets(r),
      onHit: (r, t) => this.onSkillHit(r, t),
      casterPos: (id) => this.casterPos(id),
      onPhase: (r, ph) => this.onSkillPhase(r, ph),
    });
    if (isQAMode()) {
      (window as unknown as { __skillsQA: unknown }).__skillsQA = { shapeHits, stepProjectile, spawnProjectile, sweepStatic, damageFor, getSkill, ControlState, EVENTS };
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(`W,A,S,D,UP,DOWN,LEFT,RIGHT,${SLOT_KEYS.join(',')}`) as LegacyCourtyardScene['keys'];
    // Space / 1–7: one action handler per slot (the HUD buttons call the same handler).
    const slotHandlers = SLOT_KEYS.map((name, i) => {
      const h = (e: KeyboardEvent) => { if (!e.repeat) this.useSlot(i); };
      kb.on(`keydown-${name}`, h);
      return [name, h] as const;
    });

    // Losing focus clears keys, stops movement and cancels an attack before it can hit.
    const stop = () => { kb.resetKeys(); this.vx = 0; this.vy = 0; this.cancelAttack(); };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    const exitArena = () => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); };
    this.character = character;
    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, {
      returnLabel: pvpRoom ? PVP.hud.exitText : 'BACK TO CHARACTERS',
      onReturn: pvpRoom ? exitArena : () => this.scene.start('CharacterSelectScene'),
      onSlot: (i) => this.useSlot(i), // same handler as the hotkey
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, (_t: number, d: number) => {
      if (!this.hud) return;
      this.hud.layout();
      if (this.player) this.hud.update(this.hudState(), this.simMs, d);
    });
    if (pvpRoom) {
      kb.on('keydown-ESC', exitArena);
      this.startPvp(pvpRoom, { playerId, characterId: character.id, classId: character.classId, name: character.name });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      for (const [name, h] of slotHandlers) kb.off(`keydown-${name}`, h);
      this.skills?.cancelOwn(this.localId, 'sceneExit');
      this.skills?.destroy(); // runs, projectiles, VFX, event listeners
      this.skills = undefined;
      this.selfKb = null;
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
    this.simMs += ms;
    this.sinceAttackStart += ms;
    this.sinceDust += ms;
    this.updateDummy(ms);
    this.updateImpacts(ms);
    this.updateFx(ms);
    this.updatePlayerFlash(ms);
    this.updateCastFlash(ms);
    this.skills?.update(ms);
    this.updateSelfKnockback(ms);
    this.enemy?.update(ms, {
      player: { x: p.x, y: p.y, alive: this.playerDeadMs < 0 },
      blocked: (x, y) =>
        (this.playerDeadMs < 0 && Math.hypot(x - p.x, y - p.y) < STAGE6.enemy.collisionRadius + R) ||
        (this.dummyAlive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + STAGE6.enemy.footRadius),
      onHitPlayer: (dmg) => this.damagePlayer(dmg),
    });

    if (this.playerDeadMs >= 0) { this.updateDeath(ms); this.syncDepths(); return; }
    if (this.attack) { this.updateAttack(ms); this.syncDepths(); return; } // movement and turning locked
    if (this.control.controlled(this.simMs)) { this.vx = 0; this.vy = 0; this.hadInput = false; this.syncDepths(); return; } // hard control
    const run = this.skills?.ownRun;
    if (run && (run.phase === 'cast' || run.phase === 'active')) { this.updateOwnCast(run); this.syncDepths(); return; }

    this.updateMovement(ms); // recovery: movement permitted (moveDuringRecovery)
    if (run && run.phase === 'recovery' && !this.isMage && Math.hypot(this.vx, this.vy) <= P6.walkThreshold) {
      setWarriorAttackPhase(p, run.dir, 3);
    }
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
    if (this.skills?.locked() || this.control.controlled(this.simMs)) return; // one action lock at a time
    this.attack = { id: ++this.attackSeq, dir: this.dir, elapsed: 0, hitChecked: false, slashSpawned: false, lungeApplied: 0 };
    this.sinceAttackStart = 0;
    this.vx = 0; this.vy = 0;
    this.showAttackFrame();
    this.pvp?.sendAttack(this.attack.id, this.attack.dir, this.player.x, this.player.y);
    this.basicEvent(EVENTS.castStarted, this.attack.id); // existing basic wrapped in the shared cast event adapter
  }

  private basicEvent(name: string, id: number): void {
    this.skills?.emitEvent(name, `${this.localId}:b${id}`, BASIC().id, this.localId);
  }

  private cancelAttack(): void {
    if (!this.attack || !this.player) return;
    this.basicEvent(EVENTS.cancelled, this.attack.id);
    this.applyLunge(this.attack, 0); // step back from any lunge
    this.attack = null;
    this.setIdle();
  }

  private updateAttack(ms: number): void {
    const a = this.attack!;
    a.elapsed += ms;
    const prev = a.elapsed - ms, b = BASIC();
    if (!a.hitChecked && a.elapsed >= A.hitAtMs) { a.hitChecked = true; this.basicEvent(EVENTS.activeStarted, a.id); this.resolveHit(a); }
    if (!a.slashSpawned && a.elapsed >= A.hitAtMs) { a.slashSpawned = true; this.spawnSlash(a.dir); }
    if (prev < b.castMs + b.activeMs && a.elapsed >= b.castMs + b.activeMs) this.basicEvent(EVENTS.recoveryStarted, a.id);
    if (a.elapsed >= A.totalDurationMs) { this.applyLunge(a, 0); this.attack = null; this.basicEvent(EVENTS.finished, a.id); this.setIdle(); return; }
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
    // PvE: the shared resolver with the existing basic geometry (feet range + facing dot), existing damage rules.
    const p = this.player!, b = BASIC(), castId = `${this.localId}:b${a.id}`;
    const pve = this.skillTargets({ own: true } as CastRun).filter((t) => t.kind === 'enemy');
    for (const t of shapeHits(b, this.localId, p, a.dir, 1, null, pve)) {
      const dmg = damageFor(b, 'enemy');
      if (t.id === 'dummy' && this.lastHitAttackId !== a.id) {
        this.lastHitAttackId = a.id;
        this.damageDummy(dmg);
        this.spawnImpact(D.x + D.impactOffset.x, D.y + D.impactOffset.y);
        this.skills?.confirmHit(castId, b, this.localId, t.id, 'enemy', dmg, 0, 0);
        landed = true;
      } else if (t.id === 'enemy' && this.enemy?.takeHit(dmg)) {
        this.spawnImpact(this.enemy.x, this.enemy.y + STAGE6.enemy.impactOffsetY);
        this.skills?.confirmHit(castId, b, this.localId, t.id, 'enemy', dmg, 0, 0);
        landed = true;
      }
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
    if (this.hitsTaken.has(key)) return;
    const b = BASIC(), self: HitTarget = { id: this.localId, kind: 'player', x: p.x, y: p.y, radius: R, alive: true };
    if (!shapeHits(b, from, { x: ax, y: ay }, dir, 1, null, [self]).length) return; // same resolver, same basic geometry
    this.hitsTaken.add(key);
    const dmg = damageFor(b, 'player');
    this.damagePlayer(dmg);
    this.skills?.confirmHit(`${from}:b${id}`, b, from, this.localId, 'player', dmg, 0, 0);
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
      onCast: (from, m) => this.receiveCast(from, m),
      onConfirmed: (victim, m) => {
        const sk = m.castId && m.skillId ? getSkill(m.skillId) : undefined;
        if (sk) this.skills?.confirmHit(m.castId!, sk, m.by, victim, 'player', damageFor(sk, 'player'), m.stun ?? 0, m.kb ?? 0);
      },
      onRemoteLeft: (id) => this.skills?.cancelAttacker(id),
      getLocal: () => {
        const p = this.player;
        if (!p || !this.pvpReady) return null;
        const dead = this.playerDeadMs >= 0;
        const anim = dead ? 'dead' : this.attack || this.skills?.ownRun ? 'attack' : Math.hypot(this.vx, this.vy) > P6.walkThreshold ? 'walk' : 'idle';
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
    const p = this.player!, ch = this.character!, now = this.simMs;
    const alive = this.playerDeadMs < 0;
    const pvp = this.pvp;
    const markers: HudMarker[] = [];
    if (this.pvpReady) markers.push({ id: 'local', kind: 'player', x: p.x, y: p.y });
    for (const r of pvp?.remotes.values() ?? []) if (r.alive) markers.push({ id: r.meta.playerId, kind: 'remote', x: r.x, y: r.y });
    if (this.enemy?.alive) markers.push({ id: 'enemy', kind: 'enemy', x: this.enemy.x, y: this.enemy.y });

    const busy = this.busy();
    const slots: HudSlot[] = HUD.skills.hotkeys.map((hotkey, i) => {
      const s = this.slotDefs[i];
      if (!s) return { id: `slot-${hotkey}`, hotkey, label: 'Unassigned', iconUrl: UNASSIGNED_ICON, assigned: false, enabled: false, pressed: false, cooldown: null };
      let cooldown: HudSlot['cooldown'] = null; // real cooldowns only
      if (s.adapter) { if (this.sinceAttackStart < A.cooldownMs) cooldown = { endTimeMs: now + (A.cooldownMs - this.sinceAttackStart), durationMs: A.cooldownMs }; }
      else { const rem = this.skills?.cooldownRemaining(s.id) ?? 0; if (rem > 0) cooldown = { endTimeMs: now + rem, durationMs: s.cooldownMs }; }
      return {
        id: s.id, hotkey, label: skillLabel(s.id), iconUrl: s.icon, assigned: true, enabled: alive && this.pvpReady, busy,
        pressed: !!this.keys?.[SLOT_KEYS[i]].isDown, cooldown,
      };
    });

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

  // ---------------- Skill System V1: input, CombatAdapter (PvE local authority / PvP victim authority) ----------------

  private busy(): boolean { return !!this.attack || !!this.skills?.locked() || this.control.controlled(this.simMs) || this.playerDeadMs >= 0; }

  /** Space / 1–7 and HUD clicks share this handler. */
  private useSlot(i: number): void {
    if (!this.player || !this.pvpReady || this.playerDeadMs >= 0) return;
    const s = this.slotDefs[i];
    if (!s) return; // unassigned / disabled slots (4–7)
    if (s.adapter === 'warriorBasic') { this.beginAttack(); return; } // existing basic, unchanged
    this.tryCast(s);
  }

  /** Validate (alive/class/slot/cooldown/action lock/control) -> unique castId -> snapshot -> cooldown starts. */
  private tryCast(s: SkillDef): void {
    const sys = this.skills, p = this.player!;
    if (!sys || this.busy() || sys.cooldownRemaining(s.id) > 0) return;
    const origin = { x: p.x, y: p.y }, dir = this.dir;
    let place: { x: number; y: number } | null = null;
    if (s.geometry.kind === 'groundCircle') {
      place = runePlacement(s, origin, dir, this.selectedTargetPos());
      if (!place) return; // blocked point: rejected, no cooldown
    }
    const castId = `${this.localId}:${++this.castSeq}`;
    this.vx = 0; this.vy = 0; this.hadInput = false;
    sys.start({ castId, skill: s, attackerId: this.localId, own: true, origin, dir, place });
    this.pvp?.sendCast(castId, s.id, origin.x, origin.y, dir, place);
  }

  /** Own cast/active: no movement or turning; Warrior reuses attack frames by phase, Mage keeps its pose; dash moves. */
  private updateOwnCast(run: CastRun): void {
    const p = this.player!, s = run.skill;
    this.vx = 0; this.vy = 0; this.hadInput = false; this.dir = run.dir;
    if (s.geometry.kind === 'sweptCapsule' && run.phase === 'active') {
      const e = dashEnd(s, run.origin, run.dir, (run.elapsed - s.castMs) / s.activeMs);
      p.setPosition(e.x, e.y);
    }
    if (this.isMage) this.setIdle();
    else setWarriorAttackPhase(p, run.dir, skillPoseIndex(run.elapsed, s.castMs, s.activeMs));
  }

  private onSkillPhase(run: CastRun, phase: string): void {
    const s = run.skill;
    if (run.own) {
      const p = this.player!;
      if (phase === 'active' && this.isMage) { this.castFlashMs = 0; if (this.playerFlashMs < 0) p.setTint(0xb8d8ff); }
      if (phase === 'recovery' && s.geometry.kind === 'sweptCapsule') {
        // Dash ends at the swept end point; never inside a body (step back along the path).
        const e = dashEnd(s, run.origin, run.dir, 1), f = FACING[run.dir];
        let x = e.x, y = e.y, back = 0;
        while (!this.footAllowed(x, y) && back < (s.geometry.travelDistance ?? s.range)) { x -= f[0] * 2; y -= f[1] * 2; back += 2; }
        p.setPosition(x, y);
      }
      return;
    }
    if (phase === 'cast') {
      const detached = !!s.detachedActive;
      this.pvp?.remotes.get(run.attackerId)?.startSkill(run.dir, s.castMs, detached ? 0 : s.activeMs, detached ? s.actionLockMs : s.castMs + s.activeMs + s.recoveryMs);
    }
  }

  /** Targets this client may test: own casts -> PvE entities (local authority); remote casts -> the local player. */
  private skillTargets(run: CastRun): HitTarget[] {
    const out: HitTarget[] = [];
    const p = this.player;
    if (run.own) {
      const e = this.enemy;
      if (e) out.push({ id: 'enemy', kind: 'enemy', x: e.x, y: e.y, radius: STAGE6.enemy.collisionRadius, alive: e.alive });
      if (this.dummy) out.push({ id: 'dummy', kind: 'enemy', x: D.x, y: D.y, radius: D.collisionRadius, alive: this.dummyAlive, controlImmune: true });
    } else if (p && this.pvpReady) {
      out.push({ id: this.localId, kind: 'player', x: p.x, y: p.y, radius: R, alive: this.playerDeadMs < 0 });
    }
    // Other players: their own clients are the authority; here they only stop projectiles (cosmetic).
    for (const r of this.pvp?.remotes.values() ?? []) out.push({ id: r.meta.playerId, kind: 'player', x: r.x, y: r.y, radius: R, alive: r.alive });
    return out;
  }

  private onSkillHit(run: CastRun, t: HitTarget): void {
    if (!run.own && t.id === this.localId) { this.applySkillToSelf(run); return; }
    if (run.own && t.kind === 'enemy') this.applySkillToEnemy(run, t);
    // Remote players: resolved and confirmed by their own client (existing PvP authority).
  }

  /** PvE local authority: damage first, then permitted stun/knockback/launch (none on a lethal hit). */
  private applySkillToEnemy(run: CastRun, t: HitTarget): void {
    const s = run.skill, dmg = damageFor(s, 'enemy');
    if (t.id === 'dummy') {
      if (!this.dummyAlive) return;
      this.damageDummy(dmg); // existing dummy damage rules; stationary target (control immune)
      this.skills?.vfx.impact(D.x + D.impactOffset.x, D.y + D.impactOffset.y);
      this.skills?.confirmHit(run.castId, s, run.attackerId, t.id, 'enemy', dmg, 0, 0);
      return;
    }
    const e = this.enemy;
    if (!e || !e.takeHit(dmg)) return;
    this.skills?.vfx.impact(e.x, e.y + STAGE6.enemy.impactOffsetY);
    let stun = 0, kb = 0;
    if (e.alive) {
      const c = e.control.apply(s, 'enemy', this.simMs);
      const d = knockbackDir(run.origin, e, run.dir);
      e.applyControl(c.durationMs, d.x * c.knockbackDistance, d.y * c.knockbackDistance, c.knockbackDistance > 0 ? c.knockbackMs : 0,
        c.durationMs > 0 ? s.launch.heightPx : 0, s.launch.durationMs, this.simMs);
      stun = c.durationMs; kb = c.knockbackDistance;
    }
    this.skills?.confirmHit(run.castId, s, run.attackerId, t.id, 'enemy', dmg, stun, kb);
  }

  /** PvP victim authority (existing model): this client resolved the remote cast against itself. */
  private applySkillToSelf(run: CastRun): void {
    const p = this.player!, s = run.skill;
    if (this.playerDeadMs >= 0) return;
    const dmg = damageFor(s, 'player');
    this.damagePlayer(dmg);
    this.skills?.vfx.impact(p.x, p.y - PVP.impactUp);
    let c = { durationMs: 0, knockbackDistance: 0, knockbackMs: 0 };
    if (this.playerHP > 0) {
      c = this.control.apply(s, 'player', this.simMs); // DR + immunity, shared across all attackers
      if (c.durationMs > 0) {
        this.skills?.cancelOwn(this.localId, 'control'); // interrupts pending cast/active; projectiles continue
        this.cancelAttack();
        this.vx = 0; this.vy = 0;
        if (c.knockbackDistance > 0 && c.knockbackMs > 0) {
          const d = knockbackDir(run.origin, p, run.dir);
          this.selfKb = { vx: (d.x * c.knockbackDistance) / c.knockbackMs, vy: (d.y * c.knockbackDistance) / c.knockbackMs, left: c.knockbackMs };
        }
      }
    }
    this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: s.id, stun: c.durationMs, kb: c.knockbackDistance });
    if (this.playerHP === 0) this.pvp?.sendDeath(run.attackerId);
    this.skills?.confirmHit(run.castId, s, run.attackerId, this.localId, 'player', dmg, c.durationMs, c.knockbackDistance);
  }

  /** Remote cast intent: validated here (class, cooldown, origin near the caster, legal rune point), then simulated. */
  private receiveCast(from: string, m: { castId: string; skillId: string; x: number; y: number; dir: string; px?: number; py?: number }): void {
    const r = this.pvp?.remotes.get(from), s = getSkill(m.skillId), dir = m.dir as Dir;
    if (!r || !r.alive || !s || s.adapter || s.class !== r.meta.classId || !FACING[dir] || this.seenCasts.has(m.castId)) return;
    const key = `${from}:${s.id}`, last = this.remoteCasts.get(key);
    if (last !== undefined && this.simMs - last < s.cooldownMs - CAST_COOLDOWN_TOLERANCE_MS) return;
    if (Math.hypot(m.x - r.x, m.y - r.y) > CAST_ORIGIN_TOLERANCE_PX) return;
    const origin = { x: m.x, y: m.y };
    let place: { x: number; y: number } | null = null;
    if (s.geometry.kind === 'groundCircle') {
      if (m.px === undefined || m.py === undefined) return;
      place = { x: m.px, y: m.py };
      if (!placementLegal(s, origin, place)) return;
    }
    this.seenCasts.add(m.castId);
    this.remoteCasts.set(key, this.simMs);
    this.skills?.start({ castId: m.castId, skill: s, attackerId: from, own: false, origin, dir, place });
  }

  private casterPos(id: string): { x: number; y: number } | null {
    if (id === this.localId) return this.player ? { x: this.player.x, y: this.player.y } : null;
    const r = this.pvp?.remotes.get(id);
    return r ? { x: r.x, y: r.y } : null;
  }

  /** Binding Rune "selected target": the HUD's contextual target (no new targeting system). */
  private selectedTargetPos(): { x: number; y: number } | null {
    const t = this.hudTarget();
    if (!t) return null;
    if (t.id === 'enemy' && this.enemy) return { x: this.enemy.x, y: this.enemy.y };
    if (t.id === 'dummy') return { x: D.x, y: D.y };
    const r = this.pvp?.remotes.get(t.id);
    return r ? { x: r.x, y: r.y } : null;
  }

  /** Knockback on the local player: swept world-plane displacement, stops at blockers. */
  private updateSelfKnockback(ms: number): void {
    const k = this.selfKb, p = this.player;
    if (!k || !p) return;
    const dt = Math.min(ms, k.left);
    k.left -= dt;
    const dx = k.vx * dt, dy = k.vy * dt, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let i = 0; i < n; i++) {
      const nx = p.x + dx / n, ny = p.y + dy / n;
      if (!this.footAllowed(nx, ny)) { this.selfKb = null; return; }
      p.x = nx; p.y = ny;
    }
    if (k.left <= 0) this.selfKb = null;
  }

  private updateCastFlash(ms: number): void {
    if (this.castFlashMs < 0) return;
    this.castFlashMs += ms;
    if (this.castFlashMs >= CAST_FLASH_MS) { this.castFlashMs = -1; if (this.playerFlashMs < 0 && this.playerDeadMs < 0) this.player?.clearTint(); }
  }

  /** Existing training-dummy damage rules (shared by the basic attack and skills). */
  private damageDummy(dmg: number): void {
    this.dummyHp = Math.max(0, this.dummyHp - dmg);
    this.flashLeft = D.hitFlashMs;
    this.dummy!.setTintFill(0xffffff);
    if (this.dummyHp === 0) { this.dummyAlive = false; this.dummy!.setVisible(false); this.respawnLeft = D.respawnDelayMs; }
    this.drawDummyBar();
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
    this.skills?.cancelOwn(this.localId, 'death'); // owner casts + projectiles end with the owner
    this.selfKb = null;
    this.keys && this.input.keyboard!.resetKeys();
    this.vx = 0; this.vy = 0; this.hadInput = false;
    this.playerDeadMs = 0;
    this.player!.setTint(0xff4a4a);
  }

  private respawnPvp(): void {
    const p = this.player!, sp = this.freeSpawnPoint();
    p.setPosition(sp.x, sp.y).setAlpha(1).clearTint();
    this.shadow?.setAlpha(1);
    this.playerHP = PVP.maxHp; this.playerDeadMs = -1; this.playerFlashMs = -1; this.control.reset();
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
