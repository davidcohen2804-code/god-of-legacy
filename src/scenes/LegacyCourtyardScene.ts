// Legacy Courtyard — PvE training ground and PvP V1 arena on one combat foundation:
// CombatInput (double-tap run, jump, Space/1–7, mouse aim, buffer) → real x/y/z kinematics with the stone pedestal as a
// platform → combat state (hit-stun / launch / knockdown / getup / hard CC with DR) → final 4-class kits on the shared
// SkillRuntime with hit-confirm cancels, combo scaling and juggle budget → confirmed-hit feedback (damage numbers, combo
// counter, hit-stop / shake hierarchy) → HUD, Skill Book (K), Inventory (I) and Cosmetic Shop (O).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import S6 from '../data/stage6-combat.json';
import TRAINING from '../data/training-combat.json';
import { CHARACTER_PREVIEWS, CLASS_NAMES, HUD, PVP, STAGE6 } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { WorldHUD } from '../ui/WorldHUD';
import { HudEffect, HudMarker, HudSlot, HudState, PortraitRef } from '../ui/hud/HudState';
import { Character } from '../characters/CharacterTypes';
import { Dir } from '../world/collision';
import { CursedSwordsman, preloadEnemyFrames } from '../world/CursedSwordsman';
import { CourtyardAmbience } from '../world/Ambience';
import { WORLD_OBJECTS, actorDepth, footAllowed, insideArena, placementOk } from '../world/WorldGeometry';
import { isQAMode } from '../qa/QAPanel';
import { PvpController } from '../pvp/PvpController';
import { clearPvpFromUrl, newPlayerId } from '../pvp/Room';
import { NetMsg } from '../pvp/Transport';
import { CombatInput } from '../game/CombatInput';
import { ActorView, Equipped, preloadCosmetics } from '../game/ActorView';
import { ensureLightBeam } from '../skills/SkillFx';
import HANDS from '../data/judgment-hands.json';
import { ClassKey, dirOf, preloadBodies, registerBodies, resolvePose, PoseFrame } from '../game/Body';
import { AnimSnap, LAND_MS, Mode, RECOVER_MS, poseQuery } from '../game/PoseState';
import { CombatBody, GAUGE, HitOutcome, Kin, PHYS, jump, newKin, steer, stepKin } from '../combat/Combat';
import { FinalSkill, HitEvent } from '../skills/SkillTypes';
import { finalSkill, iconUrl, kitFor } from '../skills/FinalKit';
import { CastRun, SkillRuntime } from '../skills/SkillRuntime';
import { HitTarget, V2, V3, clampPlace, unit } from '../skills/HitGeometry';
import { SkillFx, preloadSkillFx } from '../skills/SkillFx';
import { SkillBook } from '../ui/SkillBook';
import { CosmeticPanel } from '../ui/CosmeticPanel';
import { preloadPanelArt } from '../ui/PreviewStage';
import { addMotes, preloadLife } from '../ui/PresentationLife';

const D = TRAINING.dummy;
const R = PHYS.footR;
const P6 = STAGE6.player;
const TOP_DEPTH = 100000;
const FACE: Record<Dir, V2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
/** PvP victim-side sanity checks for a remote cast intent (network jitter tolerances). */
const CAST_COOLDOWN_TOLERANCE_MS = 250;
const CAST_ORIGIN_TOLERANCE_PX = 140;
const COMBO_SHOW_MS = 1400;

function portraitOf(classId: string, appearanceId: string): PortraitRef | undefined {
  const pv = CHARACTER_PREVIEWS[`${classId}/${appearanceId}`];
  if (!pv) return undefined;
  return pv.portrait ? { url: pv.portrait } : { url: pv.file, crop: { x: pv.crop.x, y: pv.crop.y, w: pv.crop.w, imgW: pv.width, imgH: pv.height } };
}

interface DummyState { hp: number; alive: boolean; flash: number; respawn: number; body: CombatBody; kin: Kin }

/** The Cursed Swordsman's strike expressed as a skill for the shared reaction path (PvE only). */
const ENEMY_SKILL: FinalSkill = {
  id: 'enemy_strike', cls: 'warrior', slot: 0, name: 'Cursed Strike', roles: ['basic'], targeting: 'aimAssist', startup: 180, active: 120, recovery: 260,
  cooldown: 900, ground: true, air: false, hits: [], cover: 'IGNORES_COVER', move: { startup: 0, active: 0, recovery: 0 }, cancelOnHit: [], tags: [],
  pvpMultiplier: 1, pveMultiplier: 1, description: '', unlockLevel: 1, relations: [],
};

export class LegacyCourtyardScene extends Phaser.Scene {
  // ---- local actor (read by QA)
  kin!: Kin;
  body!: CombatBody;
  view?: ActorView;
  ci?: CombatInput;
  playerHP = S6.player.maxHp;
  dir: Dir = 'down';
  aim: V2 = { x: 0, y: 1 };
  mode: Mode = 'idle';
  modeT = 0;
  private loopT = 0;
  dead = -1; // >= 0: ms since death
  private flash = -1;
  chain = { stage: -1, lastEnd: -Infinity, skill: '' };
  private equipped: Equipped = {};
  private lastFootFrame = -1;
  // ---- world
  enemy?: CursedSwordsman;
  dummy?: Phaser.GameObjects.Image;
  private dummyBar?: Phaser.GameObjects.Graphics;
  dummyState?: DummyState;
  private ambience?: CourtyardAmbience;
  private occluders: Phaser.GameObjects.Image[] = [];
  // ---- combat
  rt?: SkillRuntime;
  fx?: SkillFx;
  kit: FinalSkill[] = [];
  simMs = 0;
  private castSeq = 0;
  localId = 'local';
  /** Attacker-side combo display (from confirmed hits only). */
  /** War Cry buff (+20% damage, super armor while attacking) and its looping aura. */
  warCryUntil = -1;
  /** Radiant Blade: the sword is a long blade of light until this time. */
  radiantUntil = -1;
  /** Sanctuary dome (fixed in the world): full damage immunity while the player stands inside. */
  private domeAt = -1;
  private dome: { x: number; y: number; rx: number; ry: number; until: number; t0: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; wx: number; side: number; vis?: number } | null = null;
  private beam?: Phaser.GameObjects.Image;
  private beamGlow?: Phaser.GameObjects.Image;
  private eyes?: Phaser.GameObjects.Image;
  private holyAura?: Phaser.GameObjects.Image;
  private cryShields: Phaser.GameObjects.Image[] = [];
  private boltDone = true;
  private radiantFrom = -1;
  private lastHand: { x: number; y: number } | null = null;
  /** Startup lunge toward the target / post-hit momentum following the push (px still to travel, ms left). */
  private lunge: { x: number; y: number; left: number } | null = null;
  private momentum: { x: number; y: number; left: number } | null = null;
  /** Iron Grip: the foe is held in the fist between the seize and the slam. */
  private gripHeld = false;
  /** Detached lingering strikes (Ground Breaker cracks, Blade Storm phantom blades) of own casts. */
  private lingers: { run: CastRun; x: number; y: number; next: number; left: number }[] = [];
  private cryAura?: Phaser.GameObjects.Image;
  private cryFire?: Phaser.GameObjects.Particles.ParticleEmitter[];
  private cryBody?: Phaser.GameObjects.Sprite;
  private emberT = 0;
  combo = { count: 0, at: -Infinity, comboId: -1, target: '', label: '', dmg: 0, max: 1 };
  confirmedLog: { skill: string; target: string; damage: number; idx: number; reaction: string; at: number; z: number }[] = [];
  private remoteCasts = new Map<string, number>();
  private seenCasts = new Set<string>();
  pvpReady = false;
  pvp?: PvpController;
  private hud?: WorldHUD;
  private character?: Character;
  skillBook?: SkillBook;
  cosPanel?: CosmeticPanel;

  constructor() { super('LegacyCourtyardScene'); }

  /** QA / legacy accessors. */
  get player(): Phaser.GameObjects.Sprite | undefined { return this.view?.sprite; }
  get skills(): SkillRuntime | undefined { return this.rt; }

  preload(): void {
    const T = ATLAS.textures, CT = COMBAT_ASSETS.textures;
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    if (!this.textures.exists(CT.dummy.key)) this.load.image(CT.dummy.key, CT.dummy.file);
    preloadEnemyFrames(this);
    preloadBodies(this);
    preloadSkillFx(this);
    preloadCosmetics(this);
    preloadPanelArt(this);
    preloadLife(this);
  }

  create(data?: { pvpRoom?: string }): void {
    const character = CharacterStore.getSelectedCharacter();
    if (!character) { this.scene.start('CharacterSelectScene'); return; }
    const pvpRoom = data?.pvpRoom ?? null;
    this.character = character;
    registerBodies(this);
    this.pvp = undefined; this.pvpReady = !pvpRoom;
    const playerId = newPlayerId();
    this.localId = pvpRoom ? playerId : 'local';
    this.kit = kitFor(character.classId);
    this.simMs = 0; this.castSeq = 0; this.dead = -1; this.flash = -1; this.mode = 'idle'; this.modeT = 0; this.loopT = 0;
    this.chain = { stage: -1, lastEnd: -Infinity, skill: '' };
    this.combo = { count: 0, at: -Infinity, comboId: -1, target: '', label: '', dmg: 0, max: 1 };
    this.confirmedLog = [];
    this.remoteCasts = new Map(); this.seenCasts = new Set();
    this.playerHP = pvpRoom ? PVP.maxHp : S6.player.maxHp;
    this.dir = 'down'; this.aim = { x: 0, y: 1 };

    // Map + fixed camera (contain), crisp pixels.
    const T = ATLAS.textures;
    this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(-1);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(cam.width / WORLD.camera.worldWidth, cam.height / WORLD.camera.worldHeight));
    cam.centerOn(WORLD.coordinateSpace.width / 2, WORLD.coordinateSpace.height / 2);
    cam.setRoundPixels(true);
    this.ambience = new CourtyardAmbience(this, WORLD.coordinateSpace.width, WORLD.coordinateSpace.height);
    // Very low density warm dust drifting in the sun (never over telegraphs: faint, small, sparse).
    addMotes(this, { x: 60, y: 220, w: WORLD.coordinateSpace.width - 120, h: WORLD.coordinateSpace.height - 260 }, 7,
      { depth: 1500, tint: 0xffd9a0, size: [5, 9], speed: [3, 8], drift: 10, alpha: 0.32 });
    // Baked-map occlusion: each prop silhouette is redrawn from the map at its footprint depth (no floor crop).
    this.occluders = WORLD_OBJECTS.map((o) => {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff).fillPoints(o.occluder.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
      return this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(o.frontY).setMask(g.createGeometryMask());
    });

    if (!pvpRoom) {
      const CT = COMBAT_ASSETS.textures;
      this.dummy = this.add.image(D.x, D.y, CT.dummy.key).setOrigin(CT.dummy.origin.x, CT.dummy.origin.y);
      this.dummy.setScale(CT.dummy.displayHeight / CT.dummy.height).setDepth(D.y);
      this.dummyBar = this.add.graphics().setDepth(TOP_DEPTH);
      const dk = newKin(D.x, D.y);
      this.dummyState = { hp: D.maxHp, alive: true, flash: 0, respawn: 0, kin: dk, body: Object.assign(new CombatBody(dk, false), { maxHp: D.maxHp }) };
      this.dummyState.alive = false; this.dummy.setVisible(false); this.dummyBar.setVisible(false); // training: the swordsman only
      this.enemy = new CursedSwordsman(this);
    }

    const { x, y } = WORLD.spawn;
    this.kin = newKin(x, y);
    this.body = new CombatBody(this.kin, !!pvpRoom);
    this.body.maxHp = pvpRoom ? PVP.maxHp : S6.player.maxHp;
    this.view = new ActorView(this, character.classId as ClassKey, x, y);
    this.loadCosmetics();

    this.rt = new SkillRuntime({
      now: () => this.simMs,
      targets: (r) => this.targetsFor(r),
      onHit: (r, h, i, t, at) => this.onSkillHit(r, h, i, t, at),
      casterPos: (id) => this.casterPos(id),
      onPhase: (r, ph) => this.onRunPhase(r, ph),
      reachMul: (req) => (req.own && req.skill.cls === 'warrior' && this.simMs < this.radiantUntil ? 1.85 : 1),
    });
    this.fx = new SkillFx(this, this.rt, (id) => this.casterPos(id));
    this.fx.handPos = (id) => (id === this.localId ? this.lastHand : null);
    this.renderPlayer(0);
    if (pvpRoom) this.view.setVisible(false);
    if (isQAMode()) (window as unknown as { __combatQA: unknown }).__combatQA = { finalSkill, kitFor, WORLD_OBJECTS, footAllowed, placementOk };

    this.ci = new CombatInput(this, (i) => this.useSlot(i), () => this.onJumpKey(), (k) => this.togglePanel(k));
    const stop = () => { this.ci?.reset(); };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    const exitArena = () => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); };
    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, {
      returnLabel: pvpRoom ? PVP.hud.exitText : 'BACK TO CHARACTERS',
      onReturn: pvpRoom ? exitArena : () => this.scene.start('CharacterSelectScene'),
      onSlot: (i) => this.useSlot(i),
      onMenu: (k) => this.togglePanel(k),
    });
    const host = this.game.canvas.parentElement!;
    this.skillBook = new SkillBook(this, host, this.game.canvas, character.classId as ClassKey, character.level, isQAMode());
    this.cosPanel = new CosmeticPanel(this, host, this.game.canvas, character, () => this.equipped, (e) => this.setEquipped(e));
    this.skillBook.setEquipped(this.equipped);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, (_t: number, d: number) => {
      if (!this.hud) return;
      this.hud.layout(); this.skillBook?.layout(); this.cosPanel?.layout();
      if (this.view) this.hud.update(this.hudState(), this.simMs, d);
    });
    const kb = this.input.keyboard!;
    const esc = () => { if (this.skillBook?.open || this.cosPanel?.open) { this.skillBook?.close(); this.cosPanel?.close(); } else if (pvpRoom) exitArena(); };
    kb.on('keydown-ESC', esc);
    if (pvpRoom) this.startPvp(pvpRoom, { playerId, characterId: character.id, classId: character.classId, name: character.name });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      kb.off('keydown-ESC', esc);
      this.rt?.cancelOwn('sceneExit');
      this.fx?.destroy(); this.fx = undefined;
      this.rt?.destroy(); this.rt = undefined;
      this.ci?.reset();
      this.ci?.destroy(); this.ci = undefined;
      kb.removeAllKeys(true);
      this.pvp?.destroy(); this.pvp = undefined; this.pvpReady = false;
      this.enemy?.destroy(); this.enemy = undefined;
      this.ambience?.destroy(); this.ambience = undefined;
      for (const o of this.occluders) { o.clearMask(true); o.destroy(); }
      this.occluders = [];
      this.hud?.destroy(); this.hud = undefined;
      this.skillBook?.destroy(); this.skillBook = undefined;
      this.cosPanel?.destroy(); this.cosPanel = undefined;
      this.view?.destroy(); this.view = undefined;
      this.character = undefined;
      this.dummy = undefined; this.dummyBar = undefined; this.dummyState = undefined;
    });
  }

  // ======================================================================= frame

  update(_time: number, delta: number): void {
    if (!this.view || !this.rt || !this.fx || !this.ci) return;
    const ms = Math.min(delta, 50);
    this.ambience?.update(ms);
    this.pvp?.update(ms);
    this.skillBook?.update(ms);
    this.cosPanel?.update(ms);
    if (!this.pvpReady) return;
    // Hit-stop: in PvE the local simulation freezes briefly; in PvP only local presentation does
    // (remote simulation and networking never freeze).
    if (this.fx.hitStopLeft > 0 && !this.pvp) {
      this.fx.update(ms, []);
      const j = () => (Math.random() - 0.5) * 7; // impact shake of the victims (DFO hit feel)
      if (this.enemy?.alive && this.simMs - this.enemy.body.lastHitAt < 200) this.enemy.shake(j(), j() * 0.4);
      if (this.dummy && this.dummyState && this.simMs - this.dummyState.body.lastHitAt < 200) this.dummy.setPosition(D.x + j(), D.y - this.dummyState.kin.z);
      return;
    }
    this.simMs += ms;
    const now = this.simMs;
    this.ci.update(now);
    this.stepPlayer(ms, now);
    this.rt.update(ms);
    this.stepLingers(now);
    this.fx.update(ms, this.rt.projectiles.map((e) => e.p));
    this.updateDummy(ms);
    this.enemy?.update(ms, {
      player: { x: this.kin.x, y: this.kin.y, z: this.kin.z - this.kin.supportZ, alive: this.dead < 0 },
      now,
      blocked: (x, y) => (this.dead < 0 && Math.hypot(x - this.kin.x, y - this.kin.y) < STAGE6.enemy.collisionRadius + R && this.kin.z < 40)
        || (!!this.dummyState?.alive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + STAGE6.enemy.footRadius),
      onStrikePlayer: (dmg, from) => this.enemyStrike(dmg, from),
    });
    this.reactionFx(ms);
    this.renderPlayer(this.fx.hitStopLeft > 0 ? 0 : ms);
  }

  // ======================================================================= local player

  busy(): boolean { return this.dead >= 0 || !this.body.canAct(this.simMs) || this.rt?.locked() === true; }

  private setMode(m: Mode): void { if (m !== this.mode) { this.mode = m; this.modeT = 0; } }

  private stepPlayer(ms: number, now: number): void {
    const k = this.kin, b = this.body, inp = this.ci!;
    this.modeT += ms; this.loopT += ms;
    if (this.flash >= 0) { this.flash += ms; if (this.flash >= P6.hitFlashRedMs) this.flash = -1; }
    // Aim: keyboard only — the held movement direction (8-way), else the last one.
    if (inp.hasMove) this.aim = unit(inp.moveX, inp.moveY, this.aim.x, this.aim.y);

    if (this.dead >= 0) { this.dead += ms; this.setMode('dead'); k.vx = 0; k.vy = 0; stepKin(k, ms); this.updateDeath(); return; }

    const run = this.rt!.ownRun;
    const reacting = b.state !== 'free';
    const ccLocked = b.hard.active(now) && b.hard.kind !== 'root';
    if (reacting || ccLocked) {
      if (run && b.state !== 'free') this.rt!.cancelOwn('hit');
      if (b.state === 'hitstun' && k.grounded && !b.push) { k.vx *= 0.8; k.vy *= 0.8; }
      if (b.state === 'launched' && inp.takeJump() && b.tryAirTech(now, inp.moveX || -this.aim.x, inp.moveY || -this.aim.y)) this.fx!.dust(k.x, k.y - k.z, 60, 0.6);
      if (ccLocked && b.state === 'free') { k.vx = 0; k.vy = 0; if (run) this.rt!.cancelOwn('hit'); }
    } else if (run) {
      this.stepCast(run, ms, now);
    } else {
      this.stepLocomotion(ms, now);
    }
    const r = stepKin(k, ms, b.gravityScale(now), (x, y, z) => this.blockedByActors(x, y, z));
    const ev = b.update(now, ms, r.landed, r.impactVz);
    if (r.landed) {
      if (r.impactVz > 180) this.fx!.dust(k.x, k.y - k.z, 48 + Math.min(70, r.impactVz / 8), 0.75);
      if (b.state === 'free' && !this.rt!.ownRun) this.setMode('land');
    }
    if (ev === 'kdImpact') this.fx!.dust(k.x, k.y - k.z, 120, 0.9);
    if (b.state === 'hitstun') this.setMode('hurt');
    else if (b.state === 'launched') this.setMode('launched');
    else if (b.state === 'knockdown') this.setMode(k.grounded ? 'down' : 'launched');
    else if (b.state === 'getup') this.setMode('getup');
    else if (this.mode === 'hurt' || this.mode === 'launched' || this.mode === 'down' || this.mode === 'getup') this.setMode(k.grounded ? 'idle' : 'air');
    // Buffered action fires on the first legal frame (within the buffer window).
    const buf = this.ci!.takeBuffered();
    if (buf && this.tryStartSlot(buf.slot)) this.ci!.consumeBuffer();
    else if (!buf && this.ci!.attackHeld && this.kit[0]?.chain) { // hold Space: chain continues on its own
      const run = this.rt!.ownRun;
      if (!run || (run.skill.id === this.kit[0].id && run.elapsed >= run.timings.startup + run.timings.active)) this.tryStartSlot(0);
    }
  }

  /** Free locomotion: walk / double-tap run, jump take-off, air control, landing settle, idle breathing. */
  private stepLocomotion(ms: number, now: number): void {
    const k = this.kin, inp = this.ci!, b = this.body;
    const rooted = b.hard.active(now) && b.hard.kind === 'root';
    const speed = (inp.running ? PHYS.run : PHYS.walk) * b.moveScale(now);
    steer(k, rooted ? 0 : inp.moveX * speed, rooted ? 0 : inp.moveY * speed, ms);
    if (inp.hasMove && !rooted) this.dir = dirOf(inp.moveX, inp.moveY, this.dir);
    if (inp.takeJump() && k.grounded && !rooted) { jump(k); this.setMode('takeoff'); }
    const sp = Math.hypot(k.vx, k.vy);
    if (!k.grounded) { if (this.mode !== 'takeoff' || this.modeT > PHYS.takeoffMs) this.setMode('air'); return; }
    if (this.mode === 'land' && this.modeT < LAND_MS && !inp.hasMove) return;
    if (this.mode === 'recover' && this.modeT < RECOVER_MS && !inp.hasMove) return;
    if (sp > 12) {
      const m: Mode = inp.running && sp > PHYS.walk + 20 ? 'run' : 'walk';
      if (m !== this.mode) this.setMode(m);
      this.footDust(sp);
    } else if (this.mode !== 'idle') this.setMode('idle');
  }

  /** Dust only on run foot-contact frames (cadence follows speed). */
  private footDust(sp: number): void {
    if (this.mode !== 'run') { this.lastFootFrame = -1; return; }
    const sheet = this.character!.classId === 'warrior' || this.character!.classId === 'book_mage';
    const fps = (sheet ? 13 : 10) * Math.max(0.75, Math.min(1.15, sp / 270)), n = sheet ? 8 : 5;
    const f = Math.floor((this.loopT * fps) / 1000) % n;
    const contact = sheet ? [0, 4] : [0, 3];
    if (f !== this.lastFootFrame && contact.includes(f)) this.fx!.dust(this.kin.x - (this.kin.vx / sp) * 10, this.kin.y - this.kin.z, 34, 0.55);
    this.lastFootFrame = f;
  }

  /** Own cast: locomotion scalar per phase, dash / leap motion, air momentum, recovery movement cancel. */
  private stepCast(run: CastRun, ms: number, now: number): void {
    const k = this.kin, inp = this.ci!, s = run.skill, T = run.timings;
    this.setMode('skill');
    this.dir = dirOf(run.aim.x, run.aim.y, this.dir);
    const phase = run.phase === 'startup' ? 'startup' : run.phase === 'active' ? 'active' : 'recovery';
    const scale = s.move[phase];
    if (s.dash && run.phase === 'active') { this.dashMotion(run); if (s.carry) this.carryTarget(run); return; }
    if (s.id === 'iron_grip' && this.gripHeld && this.enemy?.alive) { // the seized foe rides the fist up overhead until the slam
      const en = this.enemy, h1 = s.hits[1]?.at ?? 400, p = Math.max(0, Math.min(1, (run.elapsed - T.startup) / Math.max(1, h1)));
      const lift = 1 - Math.pow(1 - Math.min(1, p / 0.8), 3);
      const reach = 30 - 18 * lift;
      en.kin.x = k.x + run.aim.x * reach; en.kin.y = k.y + run.aim.y * reach + 1; en.kin.z = k.z + 40 + 120 * lift;
      en.kin.vz = 0; en.kin.vx = 0; en.kin.vy = 0; en.kin.grounded = false;
    }
    if (s.id === 'dash_slash' && run.phase === 'recovery' && !run.slid) { run.slid = true; this.momentum = { x: run.aim.x * 46, y: run.aim.y * 46, left: Math.max(120, T.recovery * 0.7) }; } // skid to a stop instead of freezing
    if (s.id === 'judgment_blade') { // leap high, hang at the apex while the light-blade charges, throw, then drop
      const e = run.elapsed, rise = Math.min(1, e / 380), apex = run.origin.z > 5 ? 80 : 185; // from a jump: a shorter extra rise
      if (run.phase === 'startup' && inp.hasMove) { run.aim = unit(inp.moveX, inp.moveY); this.aim = run.aim; } // aim the throw while hovering
      if (run.phase === 'startup' || e < T.startup + 120) { k.grounded = false; k.z = run.origin.z + apex * (1 - (1 - rise) * (1 - rise)); k.vz = 0; k.vx = 0; k.vy = 0; return; }
    }
    for (const key of ['lunge', 'momentum'] as const) { // glide toward the target / along the push
      const m = this[key]; if (!m) continue;
      const f = Math.min(1, ms / Math.max(1, m.left)), nx = k.x + m.x * f, ny = k.y + m.y * f;
      if (footAllowed(nx, ny, k.z, R) && !this.blockedByActors(nx, ny, k.z)) { k.x = nx; k.y = ny; }
      m.x -= m.x * f; m.y -= m.y * f; m.left -= ms; if (m.left <= 0) this[key] = null;
    }
    if (s.through && run.phase === 'recovery' && !run.turned && run.elapsed >= T.startup + T.active + 0.75 * T.recovery) { // crossed the target: after the skid, turn to face it
      run.turned = true;
      const t = this.targetsFor(run).filter((x) => x.alive && x.id !== this.localId).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y))[0];
      if (t && Math.hypot(t.x - k.x, t.y - k.y) < 200 && (t.x - k.x) * run.aim.x + (t.y - k.y) * run.aim.y < 0) { this.aim = unit(t.x - k.x, t.y - k.y); this.dir = dirOf(this.aim.x, this.aim.y, this.dir); }
    }
    if (k.grounded) {
      if (scale > 0) steer(k, inp.moveX * PHYS.walk * scale * this.body.moveScale(now), inp.moveY * PHYS.walk * scale * this.body.moveScale(now), ms);
      else { k.vx *= 0.7; k.vy *= 0.7; }
    } else if (scale > 0) steer(k, inp.moveX * PHYS.walk * scale, inp.moveY * PHYS.walk * scale, ms, 0.6);
    else { k.vx *= 0.97; k.vy *= 0.97; } // air skill keeps most of its momentum
    // Movement cancel from recovery after 35% (whiffed counters stay committed).
    if (run.phase === 'recovery' && inp.hasMove && !s.counter && run.elapsed >= T.startup + T.active + 0.35 * T.recovery) {
      this.rt!.cancelForFollowUp(run);
      this.endRun(run, true);
      return;
    }
    // Jump cancel from recovery: after a confirmed hit (chase), or after 35% of recovery; never the Ultimate / a whiffed counter.
    const jumpOk = run.phase === 'recovery' && k.grounded && !s.counter && s.slot !== 7
      && (run.confirmedAt >= 0 || run.elapsed >= T.startup + T.active + 0.35 * T.recovery);
    if (jumpOk && inp.takeJump()) {
      this.rt!.cancelForFollowUp(run);
      this.endRun(run, true);
      jump(k); this.setMode('takeoff');
    }
  }

  /** Dash / leap: swept along the aim (or toward the locked target), stopped by cover and bodies; never through walls. */
  private dashMotion(run: CastRun): void {
    const k = this.kin, s = run.skill, d = s.dash!;
    const p = Math.min(1, (run.elapsed - run.timings.startup) / Math.max(1, run.timings.active));
    const ease = 1 - (1 - p) * (1 - p);
    let dist = d.distance;
    if (run.lock) {
      const t = this.targetsFor(run).find((x) => x.id === run.lock);
      if (t) dist = Math.min(d.distance, Math.max(0, Math.hypot(t.x - run.origin.x, t.y - run.origin.y) - 34));
    }
    const want = { x: run.origin.x + run.aim.x * dist * ease, y: run.origin.y + run.aim.y * dist * ease };
    const steps = Math.ceil(Math.hypot(want.x - k.x, want.y - k.y) / 2);
    for (let i = 0; i < steps; i++) {
      const nx = k.x + (want.x - k.x) / (steps - i), ny = k.y + (want.y - k.y) / (steps - i);
      if (!footAllowed(nx, ny, k.z, R) || (!s.through && !s.carry && this.blockedByActors(nx, ny, k.z))) break;
      k.x = nx; k.y = ny;
    }
    k.vx = 0; k.vy = 0;
    if (d.lift) { // acrobatic leap: real height (shots fire from it), lands by gravity afterwards
      k.grounded = false;
      k.z = d.crash ? run.origin.z + d.lift * Math.sin(Math.PI * Math.min(1, p * 1.06)) : Math.max(k.z, run.origin.z + d.lift * Math.sin(Math.PI * p));
      k.vz = p < 0.5 ? 40 : -40;
    }
  }

  /** Impaling Rush: the confirmed target rides on the blade in front of the dashing warrior; a wall stops it hard. */
  private carryTarget(run: CastRun): void {
    const e = this.enemy, k = this.kin;
    if (!e?.alive || run.confirmedAt < 0) return;
    if (Math.hypot(e.kin.x - k.x, e.kin.y - k.y) > 110) return;
    const nx = k.x + run.aim.x * 46, ny = k.y + run.aim.y * 46;
    if (footAllowed(nx, ny, e.kin.z, 12)) { e.kin.x = nx; e.kin.y = ny; e.body.push = null; e.kin.vx = 0; e.kin.vy = 0; }
    else if (!run.turned) { run.turned = true; e.body.state = 'hitstun'; e.body.stateEnd = this.simMs + 900; this.fx!.callout({ x: e.kin.x, y: e.kin.y, z: e.kin.z + 40 }, 'WALL CRASH!!', '#9ed8ff', 0); this.fx!.shockwave(e.kin.x, e.kin.y, 100, 0x9ed8ff); this.cameras.main.shake(140, 0.005); }
  }

  /** Physical reaction feedback on the enemy: knockback skid dust, heavy landing slam, bounce puff. */
  private skidT = 0;
  private reactionFx(ms: number): void {
    const e = this.enemy; if (!e?.alive) return;
    const k = e.kin, sp = Math.hypot(k.vx, k.vy);
    this.skidT -= ms;
    if (k.grounded && e.body.push && sp > 140 && this.skidT <= 0) { this.fx!.dust(k.x - (k.vx / sp) * 14, k.y, 46, 0.7); this.skidT = 55; }
    if (e.lastEv === 'kdImpact') { this.fx!.dust(k.x, k.y, 130, 0.95); this.fx!.shockwave(k.x, k.y, 70, 0xd8c8a8); this.cameras.main.shake(90, 0.004); }
  }

  /** Nearest live enemy within `range` whose direction is within the facing half-plane (dot > minDot). */
  private softTarget(range: number, minDot: number): HitTarget | null {
    const k = this.kin, f = FACE[this.dir];
    let best: HitTarget | null = null, bd = range;
    for (const t of this.targetsFor({ own: true, attackerId: this.localId } as CastRun)) {
      if (!t.alive || t.id === this.localId) continue;
      const dx = t.x - k.x, dy = t.y - k.y, d = Math.hypot(dx, dy);
      const dot = d > 1 ? (dx * (this.ci?.hasMove ? this.aim.x : f.x) + dy * (this.ci?.hasMove ? this.aim.y : f.y)) / d : 1;
      if (d < bd && dot > minDot) { bd = d; best = t; }
    }
    return best;
  }

  private stepLingers(now: number): void {
    for (const l of this.lingers) {
      const L = l.run.skill.linger!;
      while (l.left > 0 && now >= l.next) {
        l.left--; l.next += L.everyMs;
        if (L.at === 'caster') { const c = this.casterPos(l.run.attackerId); if (c) { l.x = c.x; l.y = c.y; } } // the quake travels with you
        if (l.run.skill.id === 'blade_storm') { // swords erupt all around the caster + lightning crackles
          for (let n = 0; n < 2; n++) { const a = (l.left * 2.4 + n * Math.PI) + (Math.random() - 0.5) * 0.9, rr = 70 + Math.random() * (L.radius - 40); this.fx!.risingBlade(l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr * 0.6, n * 90); }
        }
        else if (l.run.skill.id !== 'ground_breaker') this.fx!.crack(l.x, l.y, L.radius); // the quake has one steady rotating ring instead of per-tick sparks
        if (l.run.skill.id === 'ground_breaker' && l.run.own && this.dead < 0) { // the quake mends the warrior: +2 HP per pulse
          const max = this.pvp ? PVP.maxHp : S6.player.maxHp, before = this.playerHP;
          this.playerHP = Math.min(max, this.playerHP + 2);
          if (this.playerHP > before) this.fx!.healNumber({ x: this.kin.x, y: this.kin.y, z: this.kin.z }, this.playerHP - before);
          for (let n = 0; n < 1; n++) this.fx!.hpGlyph(this.kin.x + (Math.random() - 0.5) * 90, this.kin.y + (Math.random() - 0.5) * 30);
        }
        for (const t of this.targetsFor(l.run)) {
          if (!t.alive || t.invulnerable || t.id === this.localId || t.kind !== 'enemy') continue;
          if (Math.hypot(t.x - l.x, t.y - l.y) > L.radius + t.radius || t.z > L.maxZ) continue;
          this.applyToPve({ ...l.run, origin: { x: l.x, y: l.y, z: 0 } } as CastRun, L.hit, t, { x: t.x, y: t.y, z: t.z + 40 });
        }
      }
    }
    this.lingers = this.lingers.filter((l) => l.left > 0);
  }

  private blockedByActors(x: number, y: number, z: number): boolean {
    const e = this.enemy;
    if (e && e.alive && Math.abs(e.z - z) < 50 && Math.hypot(x - e.x, y - e.y) < STAGE6.enemy.collisionRadius + R) return true;
    if (this.dummyState?.alive && z < 40 && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + R) return true;
    return false;
  }

  private renderPlayer(ms: number): void {
    const v = this.view!, k = this.kin, run = this.rt?.ownRun;
    const snap: AnimSnap = {
      mode: this.mode, t: this.mode === 'walk' || this.mode === 'run' || this.mode === 'idle' ? this.loopT : this.modeT,
      speed: Math.hypot(k.vx, k.vy), vz: k.vz, stunMs: 220,
      skill: run ? { id: run.skill.id, stage: run.stage, elapsed: run.elapsed, ...run.timings } : undefined,
    };
    const dir = this.dir; // Whirlwind spins inside its own 360° body loop
    const pose = resolvePose(this.character!.classId as ClassKey, dir, poseQuery(snap));
    let tint: number | null = null, fill = false, alpha = 1;
    if (this.flash >= 0) { if (this.flash < P6.hitFlashWhiteMs) { tint = 0xffffff; fill = true; } else tint = 0xff6a6a; }
    else if (this.body.hard.active(this.simMs)) tint = this.body.hard.kind === 'freeze' ? 0x9fd8ff : 0xb6ffb0;
    else if (run && run.skill.armor && run.skill.id !== 'blade_storm' && run.elapsed >= run.skill.armor[0] && run.elapsed < run.skill.armor[1] + 220) { // the storm itself lights him: no tint
      // armor glow fades in/out smoothly (a hard on/off read as a flicker at the end of the move)
      const a0 = run.skill.armor[0], a1 = run.skill.armor[1], e = run.elapsed;
      const w = Math.max(0, Math.min(1, (e - a0) / 120, e < a1 ? 1 : 1 - (e - a1) / 220));
      const c = (lo: number, hi: number) => Math.round(255 - (255 - lo) * w * (hi / 255));
      tint = (255 << 16) | (c(0xe0, 255) << 8) | c(0xa0, 255);
    }
    if (this.dead >= 0) { alpha = 1 - (1 - P6.deathAlpha) * Math.min(1, this.dead / P6.deathFadeMs); tint = 0xff4a4a; fill = false; }
    v.render(ms, pose, k.x, k.y, k.z, k.supportZ, dir, alpha, tint, fill);
    this.renderRadiant(pose, dir);
    this.renderEyes(pose, dir);
    this.renderHolyAura();
    this.renderCryShields();
    if (pose.anchor) { const sp = v.sprite, a = pose.anchor, f = dir === 'left' ? -1 : dir === 'right' ? 1 : 0; this.lastHand = { x: sp.x + a[0] + f * 12, y: sp.y + a[1] - 14 }; }
    if (run?.skill.id === 'judgment_blade' && typeof pose.frame === 'number') { // the light-sword forms in the raised palm
      const row = { down: 0, right: 1, left: 2, up: 3 }[dir], col = pose.frame % 8, h = (HANDS as number[][][])[row]?.[col];
      if (h) this.lastHand = { x: v.sprite.x + h[0] * pose.scale, y: v.sprite.y + h[1] * pose.scale };
    }
    this.renderDome();
    // War Cry: a golden battle-spirit aura (no fire): rim light on the body, light streaks rising from a floor sigil, ripples.
    const cry = this.simMs < this.warCryUntil && this.dead < 0;
    if (cry && !this.cryFire) {
      if (!this.textures.exists('flame-dot')) {
        const g = this.make.graphics({}, false);
        for (let i = 12; i > 0; i--) g.fillStyle(0xffffff, 0.09 + (12 - i) * 0.03).fillCircle(16, 16, i * 1.3);
        g.generateTexture('flame-dot', 32, 32); g.destroy();
      }
      const zone = (w: number, h: number) => ({ type: 'random' as const, source: new Phaser.Geom.Ellipse(0, 0, w, h), quantity: 1 });
      const streaks = (front: boolean) => this.add.particles(0, 0, 'flame-dot', {
        speedY: { min: -170, max: -90 }, speedX: { min: -6, max: 6 }, lifespan: { min: 520, max: 820 },
        scaleX: { start: 0.22, end: 0.05 }, scaleY: { start: front ? 1.1 : 1.5, end: 0.3 }, alpha: { start: front ? 0.55 : 0.8, end: 0 },
        tint: [0xffffff, 0xfff1b8, 0xffd36a], blendMode: 'ADD', frequency: front ? 70 : 45, quantity: 1,
        emitZone: zone(front ? 52 : 70, front ? 14 : 22), emitting: false,
      });
      const motes = this.add.particles(0, 0, 'flame-dot', {
        speedY: { min: -60, max: -25 }, speedX: { min: -14, max: 14 }, lifespan: { min: 700, max: 1100 },
        scale: { start: 0.28, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xffe28a], blendMode: 'ADD',
        frequency: 60, emitZone: zone(60, 110), emitting: false,
      });
      this.cryFire = [streaks(false), streaks(true), motes];
    }
    if (this.cryFire) {
      const [back, front, motes] = this.cryFire, d = actorDepth(k.x, k.y, k.z), on = cry && v.visible;
      back.setPosition(k.x, k.y - k.z - 4).setDepth(d - 0.2); front.setPosition(k.x, k.y - k.z + 2).setDepth(d + 0.06);
      motes.setPosition(k.x, k.y - k.z - 50).setDepth(d + 0.07);
      for (const em of this.cryFire) em.emitting = on;
    }
    if (cry && !this.cryBody) {
      this.cryBody = this.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
      this.cryAura = this.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36a);
    }
    if (this.cryBody && this.cryAura) {
      this.cryBody.setVisible(cry && v.visible); this.cryAura.setVisible(cry && v.visible);
      if (cry) {
        const left = this.warCryUntil - this.simMs, fade = Math.min(1, left / 400), d = actorDepth(k.x, k.y, k.z);
        const sp = v.sprite;
        if (this.cryBody.texture.key !== sp.texture.key || this.cryBody.frame.name !== sp.frame.name) this.cryBody.setTexture(sp.texture.key, sp.frame.name);
        this.cryBody.setOrigin(sp.originX, sp.originY).setScale(sp.scaleX * 1.03, sp.scaleY * 1.03).setPosition(sp.x, sp.y).setDepth(d + 0.04)
          .setTint(0xffe9a8).setAlpha((0.2 + 0.08 * Math.sin(this.simMs / 260)) * fade);
        this.cryAura.setPosition(k.x, k.y - k.z - 48).setDepth(d - 0.25).setDisplaySize(150, 200).setAlpha((0.3 + 0.08 * Math.sin(this.simMs / 300)) * fade);
      }
    }
  }

  /** War Cry: three spectral shields of light orbit the warrior for the whole buff. */
  private renderCryShields(): void {
    const on = this.simMs < this.warCryUntil && this.dead < 0 && this.view!.visible && this.textures.exists('cry-shield');
    if (!on) { for (const s of this.cryShields) s.setVisible(false); return; }
    if (!this.cryShields.length) for (let i = 0; i < 3; i++) this.cryShields.push(this.add.image(0, 0, 'cry-shield', 0).setBlendMode(Phaser.BlendModes.ADD));
    const k = this.kin, d = actorDepth(k.x, k.y, k.z), left = this.warCryUntil - this.simMs, fade = Math.min(1, left / 500);
    const rise = Math.min(1, (this.simMs - (this.warCryUntil - 8000 - 320)) / 400); // spread out from the body on cast
    this.cryShields.forEach((img, i) => {
      const th = this.simMs / 650 + (i * Math.PI * 2) / 3, sn = Math.sin(th), R = 78 * rise;
      const f = ((Math.round(((th + Math.PI / 2) / (Math.PI * 2)) * 8) % 8) + 8) % 8; // the shield turns as it travels round
      img.setVisible(true).setFrame(f).setPosition(k.x + Math.cos(th) * R, k.y - k.z - 52 + sn * R * 0.38)
        .setDisplaySize(64, 64).setDepth(d + (sn > 0 ? 0.08 : -0.3)).setAlpha(fade * (sn > 0 ? 0.95 : 0.55));
    });
  }

  /** Radiant Blade: painted holy aura (flames of light + floor circle) around the player for the whole buff. */
  private renderHolyAura(): void {
    const on = this.simMs >= this.radiantFrom && this.simMs < this.radiantUntil && this.dead < 0 && this.view!.visible && this.textures.exists('holy-aura');
    if (!on) { this.holyAura?.setVisible(false); return; }
    if (!this.holyAura) this.holyAura = this.add.image(0, 0, 'holy-aura', 0).setOrigin(0.5, 515 / 667).setBlendMode(Phaser.BlendModes.ADD);
    const k = this.kin, left = this.radiantUntil - this.simMs, age = this.simMs - this.radiantFrom;
    const a = Math.min(1, age / 400, left / 600);
    this.holyAura.setVisible(true).setFrame(Math.floor(this.simMs / 90) % 8).setPosition(k.x, k.y - k.z + 4)
      .setDisplaySize(125, 333).setDepth(actorDepth(k.x, k.y, k.z) - 0.2).setAlpha(0.85 * a);
  }

  /** Glowing eyes while Radiant Blade or War Cry is active. */
  private renderEyes(pose: PoseFrame, dir: Dir): void {
    const on = (this.simMs < this.radiantUntil || this.simMs < this.warCryUntil) && this.dead < 0 && this.view!.visible && !!pose.anchor && dir !== 'up';
    if (!on) { this.eyes?.setVisible(false); return; }
    if (!this.eyes) this.eyes = this.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a0);
    const sp = this.view!.sprite, a = pose.anchor!, ex = sp.x + a[2] + (dir === 'right' ? 4 : dir === 'left' ? -4 : 0), ey = sp.y + a[3] + 3;
    this.eyes.setVisible(true).setPosition(ex, ey).setDisplaySize(dir === 'down' ? 22 : 14, 7).setDepth(sp.depth + 0.05).setAlpha(0.8 + 0.2 * Math.sin(this.simMs / 160));
  }

  /** Radiant Blade: a long blade of pure light extends from the real hilt along the sword of the current frame. */
  private renderRadiant(pose: PoseFrame, dir: Dir): void {
    const on = this.simMs >= this.radiantFrom && this.simMs < this.radiantUntil && this.dead < 0 && this.view!.visible && !!pose.blade && this.rt?.ownRun?.skill.id !== 'judgment_blade'; // V: no sword at all
    if (on && !this.beam) {
      this.beam = this.add.image(0, 0, 'radiant-blade', 0).setOrigin(17.6 / 256, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      this.beamGlow = this.add.image(0, 0, 'radiant-blade', 0).setOrigin(17.6 / 256, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a);
    }
    if (!this.beam || !this.beamGlow) return;
    this.beam.setVisible(on); this.beamGlow.setVisible(false); // no extra glow layer: the blade art only
    if (!on) return;
    const b = pose.blade!, sp = this.view!.sprite, k = this.kin;

    if (!this.boltDone && b[3] < b[1] - 10) { // strike once the blade points up: the bolt lands on its tip
      this.boltDone = true; this.fx!.lightningAt(sp.x + b[2], sp.y + b[3]); // onto the real sword tip; the light blade then grows from it
    }
    const hx = sp.x + b[0], hy = sp.y + b[1], dx = b[2] - b[0], dy = b[3] - b[1], len = Math.hypot(dx, dy) * 2.7 * Math.max(0.05, Math.min(1, (this.simMs - this.radiantFrom) / 1000)), ang = Math.atan2(dy, dx) * (180 / Math.PI);
    const left = this.radiantUntil - this.simMs, fade = Math.min(1, left / 500), f = Math.floor(this.simMs / 90) % 4;
    const sx = len / 238, sy = sx * 1.1; // broad translucent blade of light (pre-downscaled smooth art, additive)
    const d = actorDepth(k.x, k.y, k.z) + (dir === 'up' ? -0.05 : 0.05);
    this.beam.setFrame(f).setPosition(hx, hy).setAngle(ang).setScale(sx, sy).setDepth(d + 0.01).setAlpha(fade);
    this.beamGlow.setFrame(f).setPosition(hx, hy).setAngle(ang).setScale(sx * 1.02, sy * 1.25).setDepth(d + 0.02).setAlpha(0.12 * fade * (0.85 + 0.15 * Math.sin(this.simMs / 90)));
  }

  private inDome(): boolean {
    const d = this.dome; if (!d || this.simMs >= d.until) return false;
    // behind the wall across its whole depth: up to 280px back, ±180 along the floor depth (the wall's full span)
    // follows the wall's curve: the shell bows out ~150px at its middle, so the protected side ends exactly at the glass
    const k = this.kin, dy = (k.y - d.y) / 185, bulge = 150 * Math.max(0, 1 - dy * dy);
    const past = d.side * (k.x - d.wx) - bulge; // > 0 once the feet cross the wall surface
    return past < -6 && d.side * (d.wx - k.x) < 280 && Math.abs(k.y - d.y) < 180;
  }

  private domeBlock(from: { x: number; y: number }): void {
    const k = this.kin;
    this.fx!.callout({ x: k.x, y: k.y, z: k.z + 40 }, 'IMMUNE', '#ffe7a0', 0);
    const d = this.dome!, ang = Math.atan2(from.y - d.y, from.x - d.x);
    const sx = d.x + Math.cos(ang) * d.rx, sy = d.y + Math.sin(ang) * d.ry - 40;
    const f = this.add.image(sx, sy, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setDepth(sy + 400).setDisplaySize(70, 90);
    this.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.6, duration: 260, onComplete: () => f.destroy() });
  }

  /** A tall curved wall of light rises in front of the caster (toward the facing side) and stays put for 15s.
   *  Everyone standing behind it — on the caster's side, across its whole depth — takes no damage. */
  private raiseDome(): void {
    if (this.dead >= 0) return;
    this.dome?.img.destroy(); this.dome?.glow.destroy();
    const k = this.kin, side = this.aim.x < -0.01 ? -1 : 1, S = 1.15;
    const wx = k.x + side * 80; // the wall stands clearly in front of the caster (he is never swallowed by it)
    // One steady frame (no flickering loop), anchored at the near end of its base and stretched UPWARD: a towering wall.
    const img = this.add.image(wx, k.y + 186, 'sanctuary-wall', 11).setOrigin(70 / 256, 414 / 512).setBlendMode(Phaser.BlendModes.ADD).setFlipX(side < 0);
    img.setScale(S, 0.05);
    const glow = this.add.image(wx, k.y + 186, 'sanctuary-wall', 11).setOrigin(70 / 256, 414 / 512).setBlendMode(Phaser.BlendModes.ADD).setFlipX(side < 0).setTint(0xffd27a);
    glow.setScale(S * 1.06, 0.05);
    // protected zone: an ellipse behind the wall covering its full depth
    this.dome = { x: wx - side * 200, y: k.y, rx: 240, ry: 175, until: this.simMs + 15000, t0: this.simMs, img, glow, wx, side };
    this.cameras.main.shake(180, 0.006);
  }

  private renderDome(): void {
    if (this.domeAt >= 0 && this.simMs >= this.domeAt) { this.domeAt = -1; if (this.rt?.ownRun?.skill.id === 'sanctuary') this.raiseDome(); }
    const d = this.dome; if (!d) return;
    const left = d.until - this.simMs, age = this.simMs - d.t0;
    if (left <= 0) { d.img.destroy(); d.glow.destroy(); this.dome = null; return; }
    // The wall wraps around the player: whoever stands on the protected side is always drawn cleanly ON TOP of it
    // (never washed out underneath); anyone on the far side is seen through the glass.
    // The wall is drawn OVER whoever stands behind it, as see-through glass: the player is hidden behind the light
    // but stays readable (lighter glass where it overlaps him instead of a washed-out white sheet).
    const k = this.kin, over = Math.abs(k.x - d.wx) < 200 && Math.abs(k.y - d.y) < 200, prot = this.inDome();
    d.vis = (d.vis ?? 1) + ((prot || !over ? 1 : 0.22) - (d.vis ?? 1)) * 0.15; // crossed to the open side: the wall fades (no protection)
    const fade = Math.min(1, left / 600) * (over && prot ? 0.62 : 0.9) * d.vis, dep = actorDepth(d.x, d.y + 200, 0) + 1; // in front of everything along its whole span (its near end reaches y+186)
    d.glow.setAlpha(fade * (0.18 + 0.1 * Math.sin(age / 700))).setDepth(dep - 0.01); // soft breathing glow, no frame flicker
    const g = 1 - Math.pow(1 - Math.min(1, age / 380), 3), sy = 1.15 * 1.4 * Math.max(0.05, g); // rises from the floor (sim clock)
    d.img.setScale(1.15, sy).setAlpha(fade).setDepth(dep);
    d.glow.setScale(1.15 * 1.06, sy * 1.04);
  }

  // ======================================================================= actions

  /** Space / 1–7 and HUD clicks share this handler: start now, cancel on a confirmed hit, or buffer. */
  useSlot(i: number): void {
    if (!this.view || !this.pvpReady || this.dead >= 0) return;
    if (this.skillBook?.open || this.cosPanel?.open) return;
    const own = this.rt?.ownRun;
    if (own && own.skill.id === 'judgment_blade' && this.kit[i]?.id === 'judgment_blade') { // V again while hovering: throw now
      if (own.phase === 'startup' && own.elapsed >= 600) own.timings.startup = own.elapsed;
      return;
    }
    if (!this.tryStartSlot(i)) this.ci?.bufferAction(i);
  }

  private onJumpKey(): void { if (this.pvpReady && this.dead < 0) this.ci?.queueJump(); }

  /** Start a slot now if legal (incl. hit-confirm cancel / chain continuation from the current action). */
  tryStartSlot(i: number): boolean {
    const s = this.kit[i];
    if (!s || !this.rt || this.dead >= 0) return false;
    const now = this.simMs, k = this.kin, b = this.body;
    // War Cry breaks free: usable while stunned / hit / launched / knocked down (cooldown permitting) — clears all CC.
    if (s.id === 'war_cry' && (b.state !== 'free' || b.hard.active(now)) && this.rt.cooldownRemaining(s.id) <= 0) {
      b.hard.reset(); b.combos.clear(); b.push = null; b.pinUntil = -1; b.state = 'free'; b.stateEnd = 0; b.invulnUntil = now + 600;
      if (!k.grounded) { k.vz = Math.min(k.vz, 0); }
      this.fx!.callout({ x: k.x, y: k.y, z: k.z + 40 }, 'BREAK FREE!!', '#ffe7a0', 0);
    }
    if (b.state !== 'free') return false;
    if (b.hard.active(now) && b.hard.kind !== 'root') return false;
    if (!(k.grounded ? s.ground : s.air)) return false;
    if (s.dash && b.hard.active(now)) return false; // rooted: no dashes
    if (this.mode === 'takeoff' && this.modeT < PHYS.takeoffMs) return false;
    const run = this.rt.ownRun;
    if (run && !this.cancelAllowed(run, s)) return false;
    if (this.rt.cooldownRemaining(s.id) > 0) return false;
    let stage = 0;
    if (s.chain) {
      const mid = run && run.skill.id === s.id;
      const cont = this.chain.skill === s.id && now - this.chain.lastEnd <= s.chain.resetMs && this.chain.stage < s.chain.stages.length - 1;
      stage = mid ? Math.min(s.chain.stages.length - 1, run!.stage + 1) : cont ? this.chain.stage + 1 : 0;
      if (mid && run!.stage >= s.chain.stages.length - 1) return false;
    }
    const target = this.resolveCast(s);
    if (!target) return false;
    if (run) { this.rt.cancelForFollowUp(run); this.endRun(run, true); }
    this.startCast(s, stage, target.aim, target.place, target.lock);
    return true;
  }

  /** Hit-confirm cancel windows (and the basic chain): only after a confirmed hit, until 70% of recovery. */
  private cancelAllowed(run: CastRun, next: FinalSkill): boolean {
    const s = run.skill, T = run.timings, e = run.elapsed;
    if (s.id === next.id && s.chain) return e >= T.startup + T.active - 20;
    if (s.slot === 7) return false; // Ultimate cannot be cancelled
    if (next.id === s.id) return !!s.charges && e >= T.startup + T.active; // charged skill: throw again right away
    if (s.id === 'whirlwind' && e >= T.startup + 200) return true; // channelled spin: break out into any skill at will
    // Free cancel (DFO-style): after a confirmed hit any other skill can cancel this one until it ends;
    // a whiff can only be cancelled late in its recovery.
    if (run.confirmedAt >= 0) return e >= run.confirmedAt;
    return e >= T.startup + T.active + 0.5 * T.recovery;
  }

  /** Aim / placement / lock-on for a cast. Null = rejected (illegal placement): no cooldown is spent. */
  private resolveCast(s: FinalSkill): { aim: V2; place: V2 | null; lock: string | null } | null {
    const k = this.kin, inp = this.ci!;
    // Soft lock (DFO-style tracking): snap the aim to the nearest enemy roughly in front, so attacks never whiff on a near-miss angle.
    const lockT = this.softTarget(260, 0.05);
    if (lockT) this.aim = unit(lockT.x - k.x, lockT.y - k.y, this.aim.x, this.aim.y);
    const reach = s.targeting === 'mouseGround' ? Math.min(180, s.placeRange ?? 180) : 160;
    const mouse = { x: k.x + this.aim.x * reach, y: k.y + this.aim.y * reach };
    let aim = unit(mouse.x - k.x, mouse.y - k.y, FACE[this.dir].x, FACE[this.dir].y);
    let place: V2 | null = null, lock: string | null = null;
    if (s.targeting === 'mouseGround') {
      place = clampPlace(k, mouse, s.placeRange ?? 260);
      if (!placementOk(place.x, place.y)) return null;
    }
    if (s.targeting === 'mouseTarget') {
      let best: HitTarget | null = null, bd = Infinity;
      for (const t of this.targetsFor({ own: true, attackerId: this.localId } as CastRun)) {
        if (!t.alive || t.id === this.localId) continue;
        const vx = t.x - k.x, vy = t.y - k.y, along = vx * aim.x + vy * aim.y, lat = Math.abs(-vx * aim.y + vy * aim.x);
        if (along < -10 || along > 320 || lat > 110) continue;
        if (along < bd) { bd = along; best = t; }
      }
      if (best) { lock = best.id; aim = unit(best.x - k.x, best.y - k.y, aim.x, aim.y); }
    }
    return { aim, place, lock };
  }

  private startCast(s: FinalSkill, stage: number, aim: V2, place: V2 | null, lock: string | null): void {
    const k = this.kin;
    // Lunge-in: melee skills step toward a soft-locked target that is just out of reach.
    this.lunge = null;
    const shape = (s.chain ? s.chain.stages[stage] : s.hits)[0]?.shape;
    const want = shape && (shape.kind === 'sector' ? shape.range * 0.75 : shape.kind === 'line' ? shape.length * 0.6 : shape.kind === 'circle' && !shape.at ? shape.radius * 0.7 : 0);
    const t = want && !s.dash ? this.softTarget(want + 70, 0.3) : null;
    if (t) { const d = Math.hypot(t.x - k.x, t.y - k.y) - want; if (d > 4) this.lunge = { x: aim.x * Math.min(70, d), y: aim.y * Math.min(70, d), left: Math.max(60, s.chain?.timings?.[stage]?.startup ?? s.startup) }; }
    const castId = `${this.localId}:${++this.castSeq}`;
    this.aim = aim; this.dir = dirOf(aim.x, aim.y, this.dir);
    this.body.armorUntil = -1;
    if (s.id === 'war_cry') this.warCryUntil = this.simMs + s.startup + 8000;
    if (s.id === 'blade_storm') this.radiantUntil = Math.max(this.radiantUntil, this.simMs + s.startup + s.active + 5000); // the storm leaves the blade of light in your hand
    if (s.id === 'sanctuary') this.domeAt = this.simMs + Math.round(s.startup * 0.95); // sim clock (hit-stop/fast-step safe)
    if (s.id === 'radiant_blade') { this.boltDone = false; this.radiantFrom = this.simMs + Math.round(s.startup * 0.4); } // light appears when the sword is raised
    if (s.id === 'radiant_blade') this.radiantUntil = this.simMs + s.startup + 15000;
    if (s.id === 'guard_counter') this.body.invulnUntil = this.simMs + s.startup + 600; // Aegis barrier
    if (s.armor) this.body.armorUntil = Math.max(this.body.armorUntil, this.simMs + s.armor[1]); // super armor from the first frame (never interrupted mid-windup)
    if (s.slot === 7) this.body.invulnUntil = this.simMs + s.startup + s.active; // ultimate: untouchable while it plays
    else if (this.simMs < this.warCryUntil) this.body.armorUntil = this.simMs + s.startup + s.active; // War Cry: super armor while attacking
    this.rt!.start({ castId, skill: s, stage, attackerId: this.localId, own: true, origin: { x: k.x, y: k.y, z: k.z }, aim, place, lock });
    if (s.chain) this.chain = { stage, lastEnd: Infinity, skill: s.id };
    this.setMode('skill');
    this.pvp?.sendCast({ castId, skillId: s.id, stage, x: Math.round(k.x), y: Math.round(k.y), z: Math.round(k.z), ax: Math.round(aim.x * 1000), ay: Math.round(aim.y * 1000), ...(place ? { px: Math.round(place.x), py: Math.round(place.y) } : {}), lock });
  }

  /** A run ended (finished or cancelled into a follow-up): chain bookkeeping + recovery → breathing transition. */
  private endRun(run: CastRun, toMove: boolean): void {
    if (!run.own) return;
    if (run.skill.id === 'iron_grip') this.gripHeld = false;
    if (run.skill.chain) this.chain = { stage: run.stage, lastEnd: this.simMs, skill: run.skill.id };
    this.body.armorUntil = -1;
    // Warrior skill sheets end in their own battle stance: go straight to idle (the old recovery frames popped and froze the body).
    if (!toMove && this.kin.grounded) this.setMode(this.character?.classId === 'warrior' ? 'idle' : 'recover');
    else if (!this.kin.grounded) this.setMode('air');
  }

  private onRunPhase(run: CastRun, phase: string): void {
    if (run.own) {
      const L = run.skill.linger;
      if (phase === 'active' && L) {
        const off = L.at === 'aim' ? (L.offset ?? 0) : 0;
        this.lingers.push({ run, x: run.origin.x + run.aim.x * off, y: run.origin.y + run.aim.y * off, next: this.simMs + L.startMs, left: L.count });
      }
      if (phase === 'active' && run.skill.armor) this.body.armorUntil = this.simMs + Math.max(0, run.skill.armor[1] - run.timings.startup);
      if (phase === 'done') this.endRun(run, false);
      return;
    }
    if (phase === 'startup') this.pvp?.remotes.get(run.attackerId)?.startSkill(run.skill.id, run.stage, dirOf(run.aim.x, run.aim.y, 'down'), run.aim);
  }

  private togglePanel(k: 'K' | 'I' | 'O'): void {
    if (k === 'K') { this.cosPanel?.close(); this.skillBook?.toggle(); }
    else { this.skillBook?.close(); this.cosPanel?.toggle(k === 'I' ? 'inventory' : 'shop'); }
    this.ci?.reset();
  }

  // ======================================================================= targets / hits

  casterPos(id: string): V3 | null {
    if (id === this.localId) return this.view ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null;
    const r = this.pvp?.remotes.get(id);
    return r ? { x: r.x, y: r.y, z: r.z } : null;
  }

  /** Own casts test PvE entities (local authority) + remote players (prediction only); remote casts test the local player. */
  private targetsFor(run: CastRun): HitTarget[] {
    const out: HitTarget[] = [];
    if (run.own) {
      if (this.enemy) out.push(this.enemy.target());
      if (this.dummy && this.dummyState) out.push({ id: 'dummy', kind: 'enemy', x: D.x, y: D.y, z: this.dummyState.kin.z, radius: D.collisionRadius, height: 80, alive: this.dummyState.alive, invulnerable: this.simMs < this.dummyState.body.invulnUntil });
    } else if (this.view && this.pvpReady) {
      out.push({ id: this.localId, kind: 'player', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: R + 4, height: 74, alive: this.dead < 0, invulnerable: this.simMs < this.body.invulnUntil });
    }
    for (const r of this.pvp?.remotes.values() ?? []) if (r.meta.playerId !== run.attackerId) out.push({ id: r.meta.playerId, kind: 'player', x: r.x, y: r.y, z: r.z, radius: R + 4, height: 74, alive: r.alive });
    return out;
  }

  private onSkillHit(run: CastRun, hit: HitEvent, hi: number, t: HitTarget, at: V3): void {
    if (!run.own) { if (t.id === this.localId) this.applyRemoteHitToSelf(run, hit, hi, at); return; }
    if (t.kind === 'enemy') { this.applyToPve(run, hit, t, at); return; }
    if (run.confirmedAt < 0) run.confirmedAt = run.elapsed; // predicted contact on a remote player (their client is authority)
  }

  /** PvE authority: combat body reaction on the enemy/dummy, damage, confirmed-hit feedback. */
  private applyToPve(run: CastRun, hit: HitEvent, t: HitTarget, at: V3): void {
    const now = this.simMs, s = run.skill;
    let out: HitOutcome | null = null;
    if (t.id === 'dummy' && this.dummyState?.alive) {
      const ds = this.dummyState;
      out = ds.body.receive(run.attackerId, s, hit, run.origin, now);
      if (run.attackerId === this.localId && now < this.warCryUntil) out.damage = Math.round(out.damage * 1.2);
      ds.body.push = null; ds.kin.vx = 0; ds.kin.vy = 0; // anchored post: launches / knockdowns are vertical only (juggle practice)
      this.damageDummy(out.damage);
    } else if (t.id === 'enemy' && this.enemy?.alive) {
      const en = this.enemy, from = this.casterPos(run.attackerId) ?? run.origin;
      const counter = en.ai === 'attack' && en.body.state === 'free';
      const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[en.facing];
      const back = en.body.state === 'free' && (from.x - en.kin.x) * f[0] + (from.y - en.kin.y) * f[1] < -12;
      out = en.body.receive(run.attackerId, s, hit, from, now);
      if (out.damage > 0) { en.hitFromX = from.x; en.faceToward(from.x, from.y); }
      if (run.attackerId === this.localId && (out.pushX || out.pushY) && s.id !== 'shield_slam') this.momentum = { x: out.pushX * 0.7, y: out.pushY * 0.7, left: 120 };
      if (s.id === 'iron_grip' && hit === s.hits[0]) { // seized: hoisted into the air, held in the energy hands
        en.kin.grounded = false; en.kin.z = Math.max(en.kin.z, 40); en.kin.vz = 0; en.body.state = 'launched'; en.body.push = null;
        this.gripHeld = true; this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 70);
        this.fx!.callout(at, 'GRAB!!', '#ffd27a', 0);
      }
      if (s.id === 'iron_grip' && hit === s.hits[1]) { // swung over your head and smashed down behind you
        this.gripHeld = false;
        const nx = from.x + run.aim.x * 62, ny = from.y + run.aim.y * 62; // smashed into the floor right in front of you
        if (footAllowed(nx, ny, 0, 10)) { en.kin.x = nx; en.kin.y = ny; }
        en.kin.z = Math.min(en.kin.z, 30);
        this.fx!.crack(en.kin.x, en.kin.y, 120); this.fx!.shockwave(en.kin.x, en.kin.y, 200, 0xffc070);
        this.time.delayedCall(70, () => this.fx!.shockwave(en.kin.x, en.kin.y, 280, 0xff8a30));
        this.fx!.callout(at, 'SLAM!!', '#ff9a4a', 1); this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 120); this.cameras.main.shake(220, 0.011);
      }
      if (s.id === 'shield_slam' && hit === s.hits[1]) { // driven into a wall / prop: extra stun
        const dx = en.kin.x - from.x, dy = en.kin.y - from.y, d = Math.hypot(dx, dy) || 1;
        if (!footAllowed(en.kin.x + (dx / d) * 150, en.kin.y + (dy / d) * 150, en.kin.z, 14)) {
          en.body.state = 'hitstun'; en.body.stateEnd = now + 900; this.fx!.callout(at, 'WALL CRASH!!', '#9ed8ff', 0); this.fx!.shockwave(en.kin.x, en.kin.y, 90, 0x9ed8ff);
        }
      }
      const crit = hit.damage > 0 && Math.random() < 0.12;
      const mult = (counter ? 1.25 : 1) * (back ? 1.15 : 1) * (crit ? 1.5 : 1) * (run.attackerId === this.localId && now < this.warCryUntil ? 1.2 : 1) * (run.attackerId === this.localId && now < this.radiantUntil ? 1.15 : 1);
      out.damage = Math.round(out.damage * mult);
      en.damage(out.damage);
      let row = 0;
      if (counter) this.fx!.callout(at, 'COUNTER!!', '#7ff0ff', row++);
      if (back) this.fx!.callout(at, 'BACK ATTACK!!', '#ffb04a', row++);
      if (crit) this.fx!.callout(at, 'CRITICAL!!', '#ff5a6a', row++);
    }
    if (!out) return;
    this.confirm(run, hit, t.id, at, out.damage, out.hitIndex, out.comboId, out.reaction, !!s.endsCombo, t.z);
  }

  /** Attacker-side confirmed hit (PvE immediate; PvP from the victim's confirmation). */
  private confirm(run: CastRun | null, hit: HitEvent, target: string, at: V3, damage: number, idx: number, comboId: number, reaction: string, ends: boolean, tz: number): void {
    const s = run?.skill;
    if (!s) return;
    if (run && run.confirmedAt < 0) run.confirmedAt = run.elapsed;
    this.fx!.confirmed(s, hit, at, damage, reaction, true, idx);
    const same = this.combo.comboId === comboId && this.combo.target === target;
    const max = target === 'enemy' ? (this.enemy?.maxHp ?? 1) : target === 'dummy' ? D.maxHp : 100;
    const tb = target === 'enemy' ? this.enemy?.body : target === 'dummy' ? this.dummyState?.body : undefined;
    const state = ends ? 'FINISHER' : tb?.state === 'knockdown' && tb.kdPhase !== 'fall' ? 'DOWN' : tz > 8 || reaction === 'launch' || reaction === 'float' || tb?.state === 'launched' ? 'AERIAL' : 'STAND';
    this.combo = { count: idx, at: this.simMs, comboId, target, label: state, dmg: (same ? this.combo.dmg : 0) + damage, max };
    this.confirmedLog.push({ skill: s.id, target, damage, idx, reaction, at: this.simMs, z: Math.round(tz) });
    if (this.confirmedLog.length > 300) this.confirmedLog.shift();
  }

  /** Enemy (PvE) strike on the local player: Mirage counter first, then the usual reaction rules. */
  private enemyStrike(dmg: number, from: { x: number; y: number }): void {
    if (this.dead >= 0) return;
    if (this.inDome()) { this.domeBlock(from); return; }
    if (this.tryCounter(from)) return;
    const hit: HitEvent = { at: 0, damage: dmg, shape: { kind: 'sector', range: 58, angle: 120 }, reaction: { stun: 220, push: 14 } };
    const out = this.body.receive('enemy', ENEMY_SKILL, hit, from, this.simMs);
    if (out.reaction === 'armor' && this.simMs < this.body.invulnUntil) { this.fx!.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 40 }, 'BLOCK!!', '#9ed8ff', 0); this.fx!.shockwave(this.kin.x, this.kin.y, 70, 0x9ed8ff); }
    this.takeDamage(out.damage);
    this.fx!.confirmed(ENEMY_SKILL, hit, { x: this.kin.x, y: this.kin.y, z: this.kin.z + 30 }, out.damage, out.reaction, false, out.hitIndex);
  }

  /** Mirage counter: a legal strike crossing the body during the window → sidestep + reappearing slash. */
  private tryCounter(from: { x: number; y: number }): boolean {
    const run = this.rt!.counterOpen(this.localId);
    if (!run) return false;
    const k = this.kin, c = run.skill.counter!;
    const away = unit(k.x - from.x, k.y - from.y), side = { x: -away.y, y: away.x };
    for (let d = c.sidestep; d > 0; d -= 4) { const nx = k.x + side.x * d, ny = k.y + side.y * d; if (footAllowed(nx, ny, k.z, R)) { k.x = nx; k.y = ny; break; } }
    const aim = unit(from.x - k.x, from.y - k.y);
    this.aim = aim; this.dir = dirOf(aim.x, aim.y, this.dir);
    this.rt!.triggerCounter(run, aim, { x: k.x, y: k.y, z: k.z });
    this.pvp?.sendCounter({ castId: run.castId, x: Math.round(k.x), y: Math.round(k.y), z: Math.round(k.z), ax: Math.round(aim.x * 1000), ay: Math.round(aim.y * 1000) });
    return true;
  }

  /** PvP victim authority: this client resolved a remote cast against its own body. */
  private applyRemoteHitToSelf(run: CastRun, hit: HitEvent, hi: number, at: V3): void {
    if (this.dead >= 0) return;
    if (this.inDome()) { this.domeBlock(this.casterPos(run.attackerId) ?? run.origin); this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: run.skill.id, hit: hi, dmg: 0, rx: 'armor' }); return; }
    const s = run.skill;
    if (hit.shape.kind !== 'placed' && hit.damage > 0 && this.tryCounter(this.casterPos(run.attackerId) ?? run.origin)) {
      this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: s.id, hit: hi, dmg: 0, rx: 'countered' });
      return;
    }
    const out = this.body.receive(run.attackerId, s, hit, this.casterPos(run.attackerId) ?? run.origin, this.simMs);
    this.takeDamage(out.damage);
    this.fx!.confirmed(s, hit, at, out.damage, out.reaction, false, out.hitIndex);
    this.pvp?.sendHp(this.playerHP, run.attackerId, {
      castId: run.castId, skillId: s.id, hit: hi, dmg: out.damage, idx: out.hitIndex, cid: out.comboId, rx: out.reaction, ends: out.endsCombo, vz: Math.round(this.kin.vz), z: Math.round(this.kin.z),
    });
    if (this.playerHP === 0) this.pvp?.sendDeath(run.attackerId);
  }

  private takeDamage(dmg: number): void {
    if (this.dead >= 0 || dmg <= 0) return;
    this.playerHP = Math.max(0, this.playerHP - dmg);
    this.flash = 0;
    if (this.playerHP === 0) this.killPlayer();
  }

  private killPlayer(): void {
    this.rt?.cancelOwn('death');
    this.ci?.reset();
    this.kin.vx = 0; this.kin.vy = 0;
    this.dead = 0;
    this.body.state = 'dead';
    this.setMode('dead');
    this.hud?.banner('DEFEATED', this.pvp ? PVP.respawnMs : P6.deathFadeMs + P6.deathPauseMs);
  }

  private updateDeath(): void {
    if (this.pvp) { if (this.dead >= PVP.respawnMs) this.respawnPvp(); return; }
    if (this.dead >= P6.deathFadeMs + P6.deathPauseMs) {
      this.respawnAt(WORLD.spawn.x, WORLD.spawn.y, S6.player.maxHp);
      if (this.enemy?.alive) this.enemy.reset();
    }
  }

  private respawnAt(x: number, y: number, hp: number): void {
    const k = this.kin;
    k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true; k.supportZ = 0;
    this.body.reset();
    this.playerHP = hp; this.dead = -1; this.flash = -1; this.setMode('idle');
    this.ci?.reset();
  }

  private respawnPvp(): void {
    const sp = this.freeSpawnPoint();
    this.respawnAt(sp.x, sp.y, PVP.maxHp);
    this.pvp?.sendRespawn(sp.x, sp.y, this.playerHP);
  }

  // ======================================================================= PvP

  private startPvp(room: string, meta: { playerId: string; characterId: string; classId: string; name: string }): void {
    this.hud?.setStatus('CONNECTING…');
    const pvp = new PvpController(this, room, meta, {
      onJoined: () => {
        const sp = this.freeSpawnPoint();
        this.kin.x = sp.x; this.kin.y = sp.y;
        this.view!.setVisible(true);
        this.pvpReady = true;
        this.hud?.setStatus(null);
      },
      onFull: () => this.hud?.setStatus('ROOM FULL'),
      onError: () => this.hud?.setStatus('CONNECTION FAILED'),
      onCast: (from, m) => this.receiveCast(from, m),
      onCounter: (from, m) => {
        const r = this.rt?.runs.find((x) => x.castId === m.castId && x.attackerId === from);
        if (r) this.rt!.triggerCounter(r, { x: m.ax / 1000, y: m.ay / 1000 }, { x: m.x, y: m.y, z: m.z });
      },
      onConfirmed: (victim, m) => {
        if (m.by !== this.localId || !m.skillId || m.dmg === undefined || m.rx === 'countered') return;
        const s = finalSkill(m.skillId);
        if (!s) return;
        const hits = s.chain ? s.chain.stages.flat() : s.hits;
        const run = this.rt?.runs.find((r) => r.castId === m.castId) ?? ({ skill: s, confirmedAt: 0, elapsed: 0 } as unknown as CastRun);
        const r = this.pvp?.remotes.get(victim);
        const at = r ? { x: r.x, y: r.y, z: (m.z ?? r.z) + 40 } : { x: 0, y: 0, z: 0 };
        this.confirm(run, hits[m.hit ?? 0] ?? hits[0], victim, at, m.dmg, m.idx ?? 1, m.cid ?? 0, m.rx ?? 'hit', !!m.ends, m.z ?? 0);
      },
      onRemoteLeft: (id) => this.rt?.cancelAttacker(id),
      getLocal: () => {
        if (!this.view || !this.pvpReady) return null;
        const k = this.kin, dead = this.dead >= 0;
        const cos = Object.entries(this.equipped).filter(([, v]) => v).map(([s, v]) => `${s}:${v}`).join(',');
        return { x: k.x, y: k.y, z: k.z, sz: k.supportZ, dir: this.dir, anim: dead ? 'dead' : this.mode, mode: this.mode, sp: Math.hypot(k.vx, k.vy), vz: k.vz, ax: this.aim.x, ay: this.aim.y, hp: this.playerHP, alive: !dead, cos };
      },
    });
    this.pvp = pvp;
    void pvp.join();
  }

  /** Remote cast intent: validated (class, cooldown, origin near the caster, legal placement), then simulated here. */
  private receiveCast(from: string, m: Extract<NetMsg, { t: 'cast' }>): void {
    const r = this.pvp?.remotes.get(from), s = finalSkill(m.skillId);
    if (!r || !r.alive || !s || s.cls !== r.meta.classId || this.seenCasts.has(m.castId)) return;
    const key = `${from}:${s.id}`, last = this.remoteCasts.get(key);
    if (s.cooldown > 0 && last !== undefined && this.simMs - last < s.cooldown - CAST_COOLDOWN_TOLERANCE_MS) return;
    if (Math.hypot(m.x - r.x, m.y - r.y) > CAST_ORIGIN_TOLERANCE_PX) return;
    let place: V2 | null = null;
    if (s.targeting === 'mouseGround') {
      if (m.px === undefined || m.py === undefined) return;
      place = { x: m.px, y: m.py };
      if (Math.hypot(place.x - m.x, place.y - m.y) > (s.placeRange ?? 260) + 2 || !placementOk(place.x, place.y)) return;
    }
    this.seenCasts.add(m.castId);
    this.remoteCasts.set(key, this.simMs);
    this.rt?.start({ castId: m.castId, skill: s, stage: Math.max(0, Math.min(2, m.stage ?? 0)), attackerId: from, own: false, origin: { x: m.x, y: m.y, z: m.z ?? 0 }, aim: unit(m.ax, m.ay), place, lock: m.lock ?? null });
  }

  private freeSpawnPoint(): { x: number; y: number } {
    const others = [...(this.pvp?.remotes.values() ?? [])].filter((r) => r.alive).map((r) => ({ x: r.x, y: r.y }));
    const pts = PVP.spawnPoints.filter((s) => footAllowed(s.x, s.y, 0, R));
    const clearance = (s: { x: number; y: number }) => Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - s.x, o.y - s.y)));
    const free = pts.filter((s) => clearance(s) >= PVP.spawnClearRadius);
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return pts.reduce((best, s) => (clearance(s) > clearance(best) ? s : best), pts[0]);
  }

  // ======================================================================= cosmetics

  private loadCosmetics(): void { this.setEquipped(CharacterStore.getCosmetics(this.character!.id).equipped as Equipped, false); }

  setEquipped(e: Equipped, save = true): void {
    this.equipped = { ...e };
    this.view?.setEquipped(this.equipped);
    this.skillBook?.setEquipped(this.equipped);
    if (save && this.character) {
      const c = CharacterStore.getCosmetics(this.character.id);
      CharacterStore.setCosmetics(this.character.id, { owned: c.owned, equipped: this.equipped as Record<string, string> });
    }
    this.pvp?.forceState();
  }

  get equippedItems(): Equipped { return this.equipped; }

  // ======================================================================= HUD

  private hudState(): HudState {
    const ch = this.character!, now = this.simMs, k = this.kin;
    const alive = this.dead < 0, pvp = this.pvp;
    const markers: HudMarker[] = [];
    if (this.pvpReady) markers.push({ id: 'local', kind: 'player', x: k.x, y: k.y });
    for (const r of pvp?.remotes.values() ?? []) if (r.alive) markers.push({ id: r.meta.playerId, kind: 'remote', x: r.x, y: r.y });
    if (this.enemy?.alive) markers.push({ id: 'enemy', kind: 'enemy', x: this.enemy.x, y: this.enemy.y });
    const busy = this.busy();
    const slots: HudSlot[] = HUD.skills.hotkeys.map((hotkey, i) => {
      const s = this.kit[i];
      if (!s) return { id: `slot-${hotkey}`, hotkey, label: 'Unassigned', assigned: false, enabled: false, pressed: false, cooldown: null };
      const rem = this.rt?.cooldownRemaining(s.id) ?? 0;
      const airBlocked = !k.grounded && !s.air;
      return {
        id: s.id, hotkey, label: s.name, iconUrl: iconUrl(s), assigned: true, enabled: alive && this.pvpReady && !airBlocked, busy,
        pressed: false, cooldown: rem > 0 ? { endTimeMs: now + rem, durationMs: s.cooldown } : null, tier: s.slot === 7 ? 'ultimate' : s.slot === 6 ? 'signature' : undefined,
      };
    });
    const showCombo = now - this.combo.at <= COMBO_SHOW_MS && this.combo.count >= 2;
    return {
      mode: pvp ? 'pvp' : 'pve',
      player: {
        id: pvp?.meta.playerId ?? ch.id, name: ch.name, level: ch.level, portrait: portraitOf(ch.classId, ch.appearanceId ?? `${ch.classId}_default`),
        hp: this.playerHP, maxHp: pvp ? PVP.maxHp : S6.player.maxHp, resource: null, effects: this.statusEffects(this.body, now),
      },
      target: alive && this.pvpReady ? this.hudTarget() : null,
      slots,
      minimap: { label: WORLD.name, imageUrl: ATLAS.textures.map.file, markers, bounds: { minX: 0, minY: 0, width: WORLD.coordinateSpace.width, height: WORLD.coordinateSpace.height } },
      room: pvp ? { label: `ROOM ${pvp.room}`, playerCount: pvp.connected ? pvp.remotes.size + 1 : 0, maxPlayers: PVP.maxPlayers } : null,
      combatFeedback: showCombo ? { count: this.combo.count, chain: `${this.combo.label}  ·  TOTAL ${Math.min(999, Math.round((this.combo.dmg / this.combo.max) * 100))}%`, expiresAtMs: this.combo.at + COMBO_SHOW_MS } : null,
    };
  }

  /** Small status icons, only when meaningful: hard CC, launched, knockdown. */
  private statusEffects(b: CombatBody, now: number): HudEffect[] {
    const out: HudEffect[] = [], U = 'assets/final/ui/hud';
    if (b.hard.active(now)) out.push({ id: 'cc', label: b.hard.kind === 'root' ? 'Rooted' : b.hard.kind === 'freeze' ? 'Frozen' : 'Stunned', iconUrl: `${U}/${b.hard.kind === 'root' ? 'status_root' : 'status_hard_cc'}.png`, harmful: true });
    if (b.state === 'launched') out.push({ id: 'air', label: 'Launched', iconUrl: `${U}/status_launch.png`, harmful: true });
    if (b.state === 'knockdown' || b.state === 'getup') out.push({ id: 'kd', label: 'Knocked down', iconUrl: `${U}/status_knockdown.png`, harmful: true });
    return out;
  }

  private hudTarget(): HudState['target'] {
    const k = this.kin, now = this.simMs;
    let best: HudState['target'] = null, bestD: number = HUD.targetRadius;
    const consider = (d: number, t: NonNullable<HudState['target']>) => { if (d <= bestD) { bestD = d; best = t; } };
    const e = this.enemy;
    const combat = (b: CombatBody, z: number) => ({
      state: b.state === 'launched' || z > 8 ? 'AERIAL' : b.state === 'knockdown' || b.state === 'getup' ? 'DOWN' : b.state === 'hitstun' ? 'STAND' : '',
      gauges: { stand: b.gauge.stand / GAUGE.stand, air: b.gauge.air / GAUGE.air, down: b.gauge.down / GAUGE.down },
    });
    if (e?.alive) consider(Math.hypot(e.x - k.x, e.y - k.y), { id: 'enemy', name: 'Cursed Swordsman', type: 'Enemy', hp: e.hp, maxHp: S6.enemy.maxHp, effects: this.statusEffects(e.body, now), ...combat(e.body, e.kin.z) });
    if (this.dummy && this.dummyState?.alive) consider(Math.hypot(D.x - k.x, D.y - k.y), { id: 'dummy', name: 'Training Dummy', type: 'Training Target', hp: this.dummyState.hp, maxHp: D.maxHp, effects: [], ...combat(this.dummyState.body, this.dummyState.kin.z) });
    for (const r of this.pvp?.remotes.values() ?? []) {
      if (!r.alive) continue;
      const eff: HudEffect[] = [];
      if (r.mode === 'launched') eff.push({ id: 'air', label: 'Launched', iconUrl: 'assets/final/ui/hud/status_launch.png', harmful: true });
      if (r.mode === 'down' || r.mode === 'getup') eff.push({ id: 'kd', label: 'Knocked down', iconUrl: 'assets/final/ui/hud/status_knockdown.png', harmful: true });
      consider(Math.hypot(r.x - k.x, r.y - k.y), {
        id: r.meta.playerId, name: r.meta.name, type: `Player · ${CLASS_NAMES[r.meta.classId] ?? r.meta.classId}`,
        portrait: portraitOf(r.meta.classId, `${r.meta.classId}_default`), hp: r.hp, maxHp: PVP.maxHp, effects: eff,
      });
    }
    return best;
  }

  // ======================================================================= dummy

  private damageDummy(dmg: number): void {
    const ds = this.dummyState!;
    ds.hp = Math.max(0, ds.hp - dmg);
    ds.flash = D.hitFlashMs;
    this.dummy!.setTintFill(0xffffff);
    if (ds.hp === 0) { ds.alive = false; this.dummy!.setVisible(false); ds.respawn = 0; }
    this.drawDummyBar();
  }

  private updateDummy(ms: number): void {
    const ds = this.dummyState;
    if (!this.dummy || !ds) return;
    if (ds.flash > 0) { ds.flash -= ms; if (ds.flash <= 0) this.dummy.clearTint(); }
    if (ds.alive) { // juggle physics on the anchored post (z only), tilt while knocked down
      const now = this.simMs, k = ds.kin;
      k.vx = 0; k.vy = 0; ds.body.push = null;
      const r = stepKin(k, ms, ds.body.gravityScale(now));
      k.x = D.x; k.y = D.y;
      ds.body.update(now, ms, r.landed, r.impactVz);
      if (r.landed && r.impactVz > 220) this.fx?.dust(D.x, D.y, 70, 0.8);
      const down = ds.body.state === 'knockdown' && ds.body.kdPhase !== 'fall' ? 1 : 0;
      const tilt = ds.body.state === 'launched' ? Math.max(-0.5, Math.min(0.5, -k.vz / 900)) : down * 0.35;
      this.dummy.setPosition(D.x, D.y - k.z).setRotation(tilt).setDepth(actorDepth(D.x, D.y, k.z));
      if (k.z > 0 || ds.body.state !== 'free') this.drawDummyBar();
    }
    if (!ds.alive && ds.respawn > 0) { // the training dummy is removed (never respawns)
      ds.respawn -= ms;
      if (ds.respawn <= 0 && !(Math.hypot(this.kin.x - D.x, this.kin.y - D.y) < D.collisionRadius + D.playerFootRadius)) {
        ds.hp = D.maxHp; ds.alive = true; ds.body.reset(); ds.kin.z = 0; ds.kin.vz = 0; ds.kin.grounded = true;
        this.dummy.clearTint().setVisible(true);
        this.drawDummyBar();
      }
    }
  }

  private drawDummyBar(): void {
    const g = this.dummyBar!, ds = this.dummyState!;
    g.clear();
    if (!ds.alive) return;
    const h = D.healthBar, bx = D.x - h.width / 2, by = D.y + h.offsetY - ds.kin.z;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(h.background), 1).fillRect(bx, by, h.width, h.height);
    g.fillStyle(col(h.fill), 1).fillRect(bx, by, (h.width * ds.hp) / D.maxHp, h.height);
    g.lineStyle(1, col(h.border), 1).strokeRect(bx, by, h.width, h.height);
  }

  /** QA helpers. */
  qaLegal(x: number, y: number): boolean { return insideArena(x, y, R); }
  qaDepth(x: number, y: number, z: number): number { return actorDepth(x, y, z); }
}
