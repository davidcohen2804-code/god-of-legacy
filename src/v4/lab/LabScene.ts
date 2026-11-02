// The V4 rig lab scene: one playable character at the courtyard's gameplay scale, live wardrobe switching, an enlarged
// wardrobe preview of the same avatar, and a 50-character stress mode with the direct and composite renderers. Two
// arts on the same runtime: the Phase 1 placeholder and candidate B's real art (Phase 3), switchable live.
// Isolated: it reads the game's PoseState / Gear modules and changes nothing in the game.
import Phaser from 'phaser';
import { poseQuery, type AnimSnap, type Mode } from '../../game/PoseState';
import { JOB_SET, giveItem, starterGear, type GearState } from '../../items/Gear';
import b256Url from '../real/assets/b256.png?inline';
import b512Url from '../real/assets/b512.png?inline';
import b01Url from '../base01/assets/base01.png?inline';
import type { PoseState } from '../rig/pose';
import { bodyDrive } from '../rig/pose';
import { JUMP_VZ, LAND_MS, TAKEOFF_MS, rigTime, type RigTime } from '../rig/posemap';
import { Composite } from '../render/Composite';
import { RigCharacter } from '../render/RigCharacter';
import { WEARABLE } from '../wardrobe/resolve';
import type { AppearanceInput, Avatar, Item, WardrobeSlot } from '../wardrobe/types';
import { B01_TEXTURE_KEY, B_TEXTURES, CANVAS, CELL, MASTER_B, SCREEN_720, SIZE_B, WORLD, ZOOM0, ZOOM_PRESETS, labAssets, placeholderGearLooks, type Art, type LabAssets, type ZoomPreset } from './world';

export type RenderMode = 'direct' | 'composite' | 'composite-outline';
export type Forced = 'idle' | 'run' | 'jump' | 'attack' | null;
export interface Control { move: number; lane: number; walk: boolean; jump: boolean; attack: boolean }

const GRAVITY = 1800, RUN = 270, WALK = 150, LANE = 140;
const ATTACK_MS = 650; // warrior_basic: 200 + 250 + 200
const OUTLINE = 0x2a1b1e;
const PREVIEW_X = 1300; // the wardrobe preview panel: canvas x from here to the right edge (620 px wide)
/** Preview size: B = 370 canvas px. Half the panel is 310 px = 0.84 B, more than the widest reach measured on every
 *  frame (test M5e: forward 0.79 B with the greatsword in the attack, back 0.75 B with the wings), so no item is cut
 *  at the panel edge. */
const PREVIEW_B = 370;
const STAGE_X = 12000, STAGE_Y = 1000; // where the preview character stands (off the playfield)

/** Placeholder art: gameplay gear → its looks by wardrobe slot (the Phase 1 tests use it). */
export const gearLooks = placeholderGearLooks;

/** The art the lab opens with: BASE-01, unless the address asks for another (?art=b / #b, ?art=placeholder /
 *  #placeholder; the published lab only passes a plain #name). */
export function initialArt(): Art {
  const q = new URLSearchParams(location.search).get('art'), h = location.hash.slice(1);
  if (q === 'placeholder' || h === 'placeholder') return 'placeholder';
  if (q === 'b' || h === 'b') return 'b';
  return 'base01';
}

export function jobGear(): GearState {
  let g = starterGear();
  for (const id of JOB_SET.warrior) g = giveItem(g, id, true);
  return g;
}

export class Actor {
  x: number; y: number; z = 0; vz = 0; vx = 0; facing: 1 | -1 = 1;
  mode: Mode = 'idle'; t = 0; loopT = 0; skillT = 0; speed = 0;
  input!: AppearanceInput;
  avatar!: Avatar;
  readonly ch: RigCharacter;
  display: Phaser.GameObjects.Image | null = null;
  readonly shadow: Phaser.GameObjects.Image;
  last: RigTime | null = null;
  /** The body's own forward motion in the current animation (see bodyDrive), added to the chains' speed. */
  drive = 0;
  /** The last animation's pose when another took over, and the time since (the cross-fade). */
  from: Float64Array | null = null;
  fadeT = 1;
  brainT = 0; brainAct = 'idle'; targetX = 0;
  /** Swaps applied to this actor (for the demo and the tests). */
  swaps = 0;

  constructor(readonly lab: LabScene, x: number, y: number, input: AppearanceInput, readonly isPlayer = false) {
    this.x = x; this.y = y;
    this.ch = new RigCharacter(lab, lab.assets.pose, lab.assets.atlas256, false);
    this.shadow = lab.add.image(x, y, 'v4shadow').setAlpha(0.32);
    this.setLook(input);
  }

  setLook(input: AppearanceInput): void {
    this.input = input;
    this.avatar = this.lab.assets.wardrobe.resolve(input);
    this.ch.setAvatar(this.avatar);
  }

  destroy(): void { this.display?.destroy(); this.display = null; this.shadow.destroy(); this.ch.destroy(); }

  /** One step of the movement state machine (the mode names are PoseState's). */
  control(c: Control, dt: number): void {
    const ms = dt * 1000;
    this.t += ms; this.loopT += ms;
    const free = this.mode === 'idle' || this.mode === 'walk' || this.mode === 'run' || this.mode === 'alert';
    if (this.mode === 'takeoff' && this.t >= TAKEOFF_MS) { this.mode = 'air'; this.vz = JUMP_VZ; this.t = 0; }
    else if (this.mode === 'air') {
      this.z += this.vz * dt; this.vz -= GRAVITY * dt; this.x += this.vx * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; this.mode = 'land'; this.t = 0; this.vx = 0; }
    } else if (this.mode === 'land' && this.t >= LAND_MS) { this.mode = 'idle'; this.t = 0; }
    else if (this.mode === 'skill') {
      this.skillT += ms;
      if (this.skillT >= ATTACK_MS) { if (c.attack) { this.skillT -= ATTACK_MS; } else { this.mode = 'idle'; this.t = 0; } }
    }
    if (!(free || (this.mode === 'idle'))) return;
    if (c.attack) { this.mode = 'skill'; this.skillT = 0; this.t = 0; this.speed = 0; return; }
    if (c.jump) { this.mode = 'takeoff'; this.t = 0; this.vx = c.move * (c.walk ? WALK : RUN); return; }
    if (c.move !== 0) this.facing = c.move > 0 ? 1 : -1;
    const moving = c.move !== 0 || c.lane !== 0;
    const want: Mode = moving ? (c.walk ? 'walk' : 'run') : 'idle';
    if (want !== this.mode) { if (!(this.mode !== 'idle' && want !== 'idle')) this.loopT = 0; this.mode = want; this.t = 0; }
    this.speed = moving ? (c.walk ? WALK : RUN) : 0;
    this.x = Phaser.Math.Clamp(this.x + c.move * this.speed * dt, 60, WORLD.w - 60);
    this.y = Phaser.Math.Clamp(this.y + c.lane * LANE * dt, WORLD.laneMin, WORLD.laneMax);
  }

  snap(): AnimSnap {
    const loop = this.mode === 'idle' || this.mode === 'walk' || this.mode === 'run' || this.mode === 'alert';
    return {
      mode: this.mode, t: loop ? this.loopT : this.t, speed: this.speed, vz: this.vz,
      ...(this.mode === 'skill' ? { skill: { id: 'warrior_basic', stage: 0, elapsed: this.skillT, startup: 200, active: 250, recovery: 200 } } : {}),
    };
  }

  /** Gameplay state → PoseQuery (the game's own poseQuery) → rig time → bone pose. */
  pose(dt: number): void {
    const q = poseQuery(this.snap()), prev = this.last;
    this.last = rigTime(q, this.lab.assets.anims);
    // the body's own motion in the animation (a lunge) pushes the chains as running does
    this.drive = prev && prev.anim === this.last.anim ? bodyDrive(this.last.anim, prev.t, this.last.t) : 0;
    const vxN = Math.max(-1, Math.min(1, (this.mode === 'air' ? Math.min(1, Math.abs(this.vx) / 300) : Math.min(1, this.speed / 300)) + this.drive));
    const vzN = this.mode === 'air' ? Math.max(-1, Math.min(1, this.vz / JUMP_VZ)) : 0;
    this.ch.chain.step(dt, vxN, vzN);
    // a new animation takes over in a short cross-fade from where the last one was (no pop between states)
    if (prev && prev.anim !== this.last.anim) { this.from = this.ch.pose.localValues(prev.anim, prev.t, this.from ?? undefined); this.fadeT = 0; }
    this.fadeT += dt;
    const k = Math.min(1, this.fadeT / FADE_S);
    this.ch.evaluate(this.last.anim, this.last.t, this.from && k < 1 ? { v: this.from, w: 1 - (1 - k) * (1 - k) } : undefined);
  }
}

/** The cross-fade between two animations, seconds. */
const FADE_S = 0.09;

export class LabScene extends Phaser.Scene {
  assets!: LabAssets;
  art: Art = initialArt();
  player!: Actor;
  readonly npcs: Actor[] = [];
  preview!: RigCharacter;
  renderMode: RenderMode = 'direct';
  zoomPreset: ZoomPreset = 'grinding';
  sizeKey = '1.12';
  forced: Forced = null;
  autoSwapMs = 0;
  previewOn = true;
  debug = { bones: false, slots: false };
  gear: GearState = starterGear();
  comp: Composite | null = null;
  previewImg: Phaser.GameObjects.Image | null = null;
  readonly frameTimes: number[] = [];
  readonly updateTimes: number[] = [];
  readonly drawSamples: number[] = [];
  /** CPU time of the composite pass alone (drawing every cell, with or without the outline stamps). */
  readonly compTimes: number[] = [];
  drawCalls = 0;
  private drawCounter = 0;
  private lastFrameAt = 0;
  private autoSwapAcc = 0;
  /** The slot-colour view left tints on the parts: clear them once when it is turned off. */
  private slotTinted = false;
  private gfx!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private previewCam!: Phaser.Cameras.Scene2D.Camera;
  private rng = new Phaser.Math.RandomDataGenerator(['v4lab']);
  onSwap: ((slot: WardrobeSlot, id: string | null) => void) | null = null;

  constructor() { super('V4Lab'); }

  /** B's atlases (inlined in the bundle as data URLs); the placeholder atlases are painted in create(). */
  preload(): void {
    if (!this.textures.exists(B_TEXTURES[256])) this.load.image(B_TEXTURES[256], b256Url);
    if (!this.textures.exists(B_TEXTURES[512])) this.load.image(B_TEXTURES[512], b512Url);
    if (!this.textures.exists(B01_TEXTURE_KEY)) this.load.image(B01_TEXTURE_KEY, b01Url);
  }

  create(): void {
    this.assets = labAssets(this, this.art);
    this.makeTextures();
    this.makeBackdrop();
    this.gfx = this.add.graphics().setDepth(1e6);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SHIFT,E,Z,SPACE,X,J') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    this.player = new Actor(this, WORLD.w * 0.42, 760, this.baseInput(), true);
    this.preview = new RigCharacter(this, this.assets.pose, this.assets.atlas512, false);
    this.previewCam = this.cameras.add(PREVIEW_X, 0, CANVAS.w - PREVIEW_X, CANVAS.h).setBackgroundColor('#141a26');
    this.add.image(STAGE_X, STAGE_Y, 'v4shadow').setScale(2.2).setAlpha(0.35);
    this.add.rectangle(STAGE_X, STAGE_Y + 160, 2000, 320, 0x1d2535).setDepth(-1);
    this.countDrawCalls();
    this.applyView();
    window.dispatchEvent(new CustomEvent('v4lab-ready', { detail: this }));
  }

  // ---------- setup ----------
  baseInput(): AppearanceInput {
    return { body: 'male_std', look: { ...this.assets.baseLook }, gearLooks: this.assets.gearLooks(this.gear), cosmetics: { equipped: {}, hidden: [] }, family: 'sword' };
  }

  /** Switch the art live: the same rig runtime, renderers and controls, the other art's rig, wardrobe and atlases.
   *  The player and the crowd start over in their base look with the current gear. */
  setArt(art: Art): void {
    if (art === this.art) return;
    const crowd = this.npcs.length;
    for (const a of this.npcs) a.destroy();
    this.npcs.length = 0;
    this.comp?.destroy(this); this.comp = null;
    this.previewImg?.destroy(); this.previewImg = null;
    this.player.destroy(); this.preview.destroy();
    this.art = art;
    this.assets = labAssets(this, art);
    this.player = new Actor(this, WORLD.w * 0.42, 760, this.baseInput(), true);
    this.preview = new RigCharacter(this, this.assets.pose, this.assets.atlas512, false);
    this.slotTinted = false;
    if (crowd) this.setStress(crowd);
    this.applyView();
  }

  private makeTextures(): void {
    if (!this.textures.exists('v4shadow')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0x000000, 1).fillEllipse(64, 20, 128, 40);
      g.generateTexture('v4shadow', 128, 40); g.destroy();
    }
  }

  private makeBackdrop(): void {
    const g = this.add.graphics().setDepth(-10);
    const x0 = -900, x1 = WORLD.w + 900;
    for (let i = 0; i < 24; i++) { // sky
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x7aa3c9), Phaser.Display.Color.ValueToColor(0xc9d8e2), 23, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(x0, -400 + i * 40, x1 - x0, 41);
    }
    g.fillStyle(0x8c8a86, 1).fillRect(x0, 300, x1 - x0, WORLD.groundTop - 300); // far wall
    for (let x = x0; x < x1; x += 180) { g.fillStyle(0x6f6d6a, 1).fillRect(x + 40, 360, 100, 200); g.fillStyle(0x9d9b96, 1).fillRect(x + 50, 370, 80, 190); }
    g.fillStyle(0xb4a88f, 1).fillRect(x0, WORLD.groundTop, x1 - x0, WORLD.h - WORLD.groundTop + 500); // ground
    for (let y = WORLD.laneMin - 40; y <= WORLD.laneMax + 40; y += 70) g.fillStyle(0xa79a80, 1).fillRect(x0, y, x1 - x0, 3);
    for (let x = x0; x < x1; x += 140) g.fillStyle(0xa3967c, 1).fillRect(x, WORLD.groundTop, 3, WORLD.h);
  }

  /** Count WebGL draw calls per frame (wraps drawElements / drawArrays). */
  private countDrawCalls(): void {
    const r = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = r.gl as WebGLRenderingContext & { __v4wrapped?: boolean };
    if (!gl || gl.__v4wrapped) return;
    const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
    gl.drawElements = (...a: Parameters<typeof de>) => { this.drawCounter++; return de(...a); };
    gl.drawArrays = (...a: Parameters<typeof da>) => { this.drawCounter++; return da(...a); };
    gl.__v4wrapped = true;
    this.game.events.on(Phaser.Core.Events.PRE_STEP, () => { this.drawCounter = 0; }); // (the composite is drawn during update)
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      this.drawCalls = this.drawCounter;
      this.drawSamples.push(this.drawCounter); if (this.drawSamples.length > 4000) this.drawSamples.shift();
      const now = performance.now();
      if (this.lastFrameAt) { this.frameTimes.push(now - this.lastFrameAt); if (this.frameTimes.length > 2000) this.frameTimes.shift(); }
      this.lastFrameAt = now;
    });
  }

  // ---------- view ----------
  get camZoom(): number { return ZOOM0 * ZOOM_PRESETS[this.zoomPreset]; }
  get bWorld(): number { return SIZE_B[this.sizeKey]; }
  /** World px per rig unit. */
  get sWorld(): number { return this.bWorld / MASTER_B; }
  get bCanvas(): number { return this.bWorld * this.camZoom; }
  get actors(): Actor[] { return [this.player, ...this.npcs]; }
  /** Outline width in canvas px: 1.5 at the reference size (B = 150 canvas px), scaled with the character. */
  outlinePx(bCanvas = this.bCanvas): number { return 1.5 * (bCanvas / 150); }

  applyView(): void {
    const cam = this.cameras.main;
    cam.setViewport(0, 0, this.previewOn ? PREVIEW_X : CANVAS.w, CANVAS.h).setZoom(this.camZoom);
    cam.setBackgroundColor('#0d1118');
    this.previewCam.setVisible(this.previewOn);
    this.previewCam.setZoom(PREVIEW_B / this.bWorld).centerOn(STAGE_X, STAGE_Y - this.bWorld * 0.62);
    this.buildRenderers();
    this.follow(true);
  }

  private follow(snap = false): void {
    const cam = this.cameras.main;
    const halfW = cam.width / cam.zoom / 2, cx = Phaser.Math.Clamp(this.player.x, halfW - 200, WORLD.w - halfW + 200);
    const want = { x: cx, y: Math.min(this.player.y - 140, WORLD.h - cam.height / cam.zoom / 2 + 60) };
    if (snap) cam.centerOn(want.x, want.y);
    else cam.centerOn(cam.midPoint.x + (want.x - cam.midPoint.x) * 0.12, cam.midPoint.y + (want.y - cam.midPoint.y) * 0.12);
  }

  /** (Re)build the display objects for the current renderer, zoom and size. */
  buildRenderers(): void {
    this.comp?.destroy(this); this.comp = null;
    const all = this.actors;
    for (const a of all) { a.display?.destroy(); a.display = null; a.ch.cell = -1; a.ch.container.removeFromDisplayList(); }
    this.previewImg?.destroy(); this.previewImg = null; this.preview.container.removeFromDisplayList(); this.preview.cell = -1;
    const maxTex = Math.min(8192, (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).getMaxTextureSize());
    if (this.renderMode === 'direct') {
      for (const a of all) a.ch.container.addToDisplayList();
      this.preview.container.addToDisplayList();
      this.preview.container.setPosition(STAGE_X, STAGE_Y);
      return;
    }
    const spec = (b: number) => ({ w: Math.ceil(b * CELL.w), h: Math.ceil(b * CELL.h), rootX: Math.round(b * CELL.rootX), rootY: Math.round(b * CELL.rootY) });
    const specs = all.map(() => spec(this.bCanvas));
    if (this.previewOn) specs.push(spec(PREVIEW_B)); // the wardrobe preview shares the one texture
    this.comp = new Composite(this, 'v4comp', specs, maxTex);
    all.forEach((a, i) => {
      a.ch.cell = i; a.ch.outlinePx = this.outlinePx();
      a.display = this.add.image(a.x, a.y, 'v4comp', `c${i}`).setScale(1 / this.camZoom);
      this.previewCam.ignore(a.display);
    });
    if (this.previewOn) {
      this.preview.cell = all.length; this.preview.outlinePx = this.outlinePx(PREVIEW_B);
      this.previewImg = this.add.image(STAGE_X, STAGE_Y, 'v4comp', `c${all.length}`).setScale(this.bWorld / PREVIEW_B);
      this.cameras.main.ignore(this.previewImg);
    }
  }

  // ---------- wardrobe API ----------
  equip(slot: WardrobeSlot, id: string | null, who: Actor = this.player): void {
    const eq = { ...who.input.cosmetics.equipped };
    if (id) eq[slot] = id; else delete eq[slot];
    if (slot === 'overall' && id) { delete eq.top; delete eq.bottom; }
    if ((slot === 'top' || slot === 'bottom') && id) delete eq.overall;
    who.setLook({ ...who.input, cosmetics: { ...who.input.cosmetics, equipped: eq } });
    who.swaps++;
    if (who === this.player) this.onSwap?.(slot, id);
  }

  hide(slot: WardrobeSlot, on: boolean): void {
    const h = new Set(this.player.input.cosmetics.hidden ?? []);
    if (on) h.add(slot); else h.delete(slot);
    this.player.setLook({ ...this.player.input, cosmetics: { ...this.player.input.cosmetics, hidden: [...h] } });
  }

  setGear(kind: 'starter' | 'job'): void {
    this.gear = kind === 'job' ? jobGear() : starterGear();
    this.player.setLook({ ...this.player.input, gearLooks: this.assets.gearLooks(this.gear) });
  }

  itemsFor(slot: WardrobeSlot): Item[] { return [...this.assets.catalog.items.values()].filter((i) => i.wslot === slot); }

  /** The wardrobe slots this art has items for (in the order of the wardrobe panel). */
  swapSlots(): WardrobeSlot[] { return (['hair', ...WEARABLE] as WardrobeSlot[]).filter((s) => s !== 'overall' && this.itemsFor(s).length > 0); }

  /** A random cosmetic outfit (each wearable slot: none or one of its items). */
  randomLook(includeX = true): Partial<Record<WardrobeSlot, string>> {
    const eq: Partial<Record<WardrobeSlot, string>> = {};
    for (const s of [...WEARABLE, 'hair'] as WardrobeSlot[]) {
      if (s === 'overall') continue;
      const opts = this.itemsFor(s).filter((i) => includeX || i.set !== 'X');
      const pick = this.rng.between(0, opts.length);
      if (pick < opts.length) eq[s] = opts[pick].id;
    }
    if (includeX && this.assets.catalog.items.has('robe_x') && this.rng.frac() < 0.12) { eq.overall = 'robe_x'; delete eq.top; delete eq.bottom; }
    return eq;
  }

  randomSwap(who: Actor = this.player): WardrobeSlot {
    const slots = this.swapSlots();
    const slot = slots[this.rng.between(0, slots.length - 1)];
    const opts = this.itemsFor(slot).filter((i) => i.set !== 'X' || slot === 'head' || slot === 'back');
    const cur = who.input.cosmetics.equipped[slot];
    const choices = [null, ...opts.map((o) => o.id)].filter((id) => id !== cur);
    this.equip(slot, choices[this.rng.between(0, choices.length - 1)] ?? null, who);
    return slot;
  }

  // ---------- stress ----------
  setStress(n: number): void {
    for (const a of this.npcs) a.destroy();
    this.npcs.length = 0;
    for (let i = 0; i < n; i++) {
      const col = i % 10, row = Math.floor(i / 10);
      const a = new Actor(this, 120 + col * 150 + (row % 2) * 60, WORLD.laneMin + row * ((WORLD.laneMax - WORLD.laneMin) / 4), {
        ...this.baseInput(), gearLooks: this.assets.gearLooks(this.rng.frac() < 0.5 ? starterGear() : jobGear()),
        look: this.art !== 'placeholder' ? { ...this.assets.baseLook } : { hair: this.rng.frac() < 0.5 ? 'hair_short' : 'hair_long', face: 'face_a' },
        cosmetics: { equipped: this.randomLook(false), hidden: [] },
      });
      a.facing = this.rng.frac() < 0.5 ? 1 : -1;
      a.brainT = this.rng.between(0, 1500);
      this.npcs.push(a);
    }
    this.buildRenderers();
  }

  private brain(a: Actor, dt: number): Control {
    a.brainT -= dt * 1000;
    if (a.brainT <= 0) {
      const r = this.rng.frac();
      a.brainAct = r < 0.35 ? 'run' : r < 0.55 ? 'idle' : r < 0.78 ? 'attack' : 'jump';
      a.brainT = a.brainAct === 'attack' ? ATTACK_MS * this.rng.between(1, 2) - 30 : a.brainAct === 'jump' ? 200 : this.rng.between(800, 2000);
      a.targetX = Phaser.Math.Clamp(a.x + this.rng.between(-260, 260), 80, WORLD.w - 80);
    }
    const c: Control = { move: 0, lane: 0, walk: false, jump: false, attack: false };
    if (a.brainAct === 'run') { const d = a.targetX - a.x; c.move = Math.abs(d) > 8 ? Math.sign(d) : 0; }
    if (a.brainAct === 'attack') c.attack = true;
    if (a.brainAct === 'jump') c.jump = true;
    return c;
  }

  private forcedControl(a: Actor): Control {
    const c: Control = { move: 0, lane: 0, walk: false, jump: false, attack: false };
    if (this.forced === 'attack') c.attack = true;
    if (this.forced === 'jump') c.jump = true;
    if (this.forced === 'run') { a.mode = a.mode === 'idle' ? 'run' : a.mode; a.speed = RUN; }
    return c;
  }

  private playerControl(): Control {
    const k = this.keys, d = (n: string) => k[n]?.isDown ?? false;
    return {
      move: (d('RIGHT') || d('D') ? 1 : 0) - (d('LEFT') || d('A') ? 1 : 0),
      lane: (d('DOWN') || d('S') ? 1 : 0) - (d('UP') || d('W') ? 1 : 0),
      walk: d('SHIFT'), jump: d('E') || d('Z'), attack: d('SPACE') || d('X') || d('J'),
    };
  }

  // ---------- frame ----------
  update(_time: number, delta: number): void { this.tick(Math.min(delta, 50) / 1000); }

  tick(dt: number): void {
    const t0 = performance.now();
    if (this.autoSwapMs > 0) {
      this.autoSwapAcc += dt * 1000;
      while (this.autoSwapAcc >= this.autoSwapMs) { this.autoSwapAcc -= this.autoSwapMs; this.randomSwap(); }
    }
    const pc = this.forced ? this.forcedControl(this.player) : this.playerControl();
    if (this.forced === 'run') { this.player.mode = 'run'; this.player.speed = RUN; this.player.t += dt * 1000; this.player.loopT += dt * 1000; }
    else this.player.control(pc, dt);
    for (const a of this.npcs) a.control(this.brain(a, dt), dt);
    const composite = this.renderMode !== 'direct';
    const s = composite ? this.sWorld * this.camZoom : this.sWorld;
    for (const a of this.actors) {
      a.pose(dt);
      a.ch.layout(s);
      if (composite) {
        a.display?.setPosition(a.x, a.y - a.z).setFlipX(a.facing < 0).setDepth(a.y);
      } else {
        a.ch.container.setPosition(a.x, a.y - a.z).setScale(a.facing, 1).setDepth(a.y);
      }
      a.shadow.setPosition(a.x, a.y).setDepth(a.y - 0.5).setScale((this.bWorld / 131) * (1 - Math.min(0.4, a.z / 400)) * 0.9, (this.bWorld / 131) * 0.9);
    }
    if (this.debug.slots) { for (const a of this.actors) a.ch.tintBySlot(slotColor); this.slotTinted = true; }
    else if (this.slotTinted) { for (const a of this.actors) a.ch.clearAllTints(); this.preview.clearAllTints(); this.slotTinted = false; }
    // the wardrobe preview: the same avatar, the same clock, enlarged with the sharper atlas
    if (this.previewOn && this.player.last) {
      this.preview.setAvatar(this.player.avatar);
      this.preview.chain.step(dt, Math.max(-1, Math.min(1, Math.min(1, this.player.speed / 300) + this.player.drive)), this.player.mode === 'air' ? this.player.vz / JUMP_VZ : 0);
      this.preview.evaluate(this.player.last.anim, this.player.last.t);
      const ps = composite ? (PREVIEW_B / this.bWorld) * this.sWorld : this.sWorld;
      this.preview.layout(ps);
      if (composite) this.previewImg?.setFlipX(this.player.facing < 0);
      else this.preview.container.setScale(this.player.facing, 1);
      if (this.debug.slots) this.preview.tintBySlot(slotColor);
    }
    if (this.comp) {
      const c0 = performance.now();
      this.comp.draw([...this.actors.map((a) => a.ch), ...(this.previewOn ? [this.preview] : [])], this.renderMode === 'composite-outline' && !this.debug.slots ? OUTLINE : null);
      this.compTimes.push(performance.now() - c0); if (this.compTimes.length > 2000) this.compTimes.shift();
    }
    this.drawDebug();
    this.follow();
    this.updateTimes.push(performance.now() - t0);
    if (this.updateTimes.length > 2000) this.updateTimes.shift();
  }

  private drawDebug(): void {
    const g = this.gfx;
    g.clear();
    if (!this.debug.bones) return;
    const pose = this.assets.pose, s = this.sWorld;
    /** One skeleton in world space; `lw` = line width in world px. */
    const skeleton = (st: PoseState, ox: number, oy: number, facing: number, lw: number) => {
      const P = (bone: number): [number, number] => { const [x, y] = pose.point(st, bone); return [ox + facing * x * s, oy + y * s]; };
      g.lineStyle(lw, 0x00e5ff, 1);
      pose.rig.bones.forEach((_b, i) => { const p = pose.parent[i]; if (p >= 0) { const [x0, y0] = P(p), [x1, y1] = P(i); g.lineBetween(x0, y0, x1, y1); } });
      const [gx, gy] = P(pose.index.get('weapon')!);
      g.lineStyle(lw, 0xff3d7f, 1).strokeCircle(gx, gy, 2.5 * lw);
    };
    const a = this.player;
    skeleton(a.ch.state, a.x, a.y - a.z, a.facing, 2);
    // the enlarged preview gets its own skeleton, 3 canvas px wide at the preview's zoom
    if (this.previewOn) skeleton(this.preview.state, STAGE_X, STAGE_Y, a.facing, (3 * this.bWorld) / PREVIEW_B);
  }

  // ---------- readouts ----------
  hud(): Record<string, number | string> {
    const ft = this.frameTimes.slice(-120).sort((p, q) => p - q), ut = this.updateTimes.slice(-120).sort((p, q) => p - q);
    const mean = (v: number[]) => (v.length ? v.reduce((p, q) => p + q, 0) / v.length : 0);
    const p95 = (v: number[]) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] : 0);
    const shownW = this.game.canvas.getBoundingClientRect().width || CANVAS.w;
    return {
      fps: ft.length ? 1000 / mean(ft) : 0, frameMs: mean(ft), frameP95: p95(ft), updateMs: mean(ut), updateP95: p95(ut), drawCalls: this.drawCalls,
      compMs: this.comp ? mean(this.compTimes.slice(-120)) : 0,
      characters: this.actors.length, mode: this.renderMode, zoom: this.zoomPreset, size: this.sizeKey, art: this.art,
      bScreen: this.bCanvas * (shownW / CANVAS.w), b720: this.bCanvas * SCREEN_720, bCanvas: this.bCanvas,
      anim: this.player.last ? `${this.player.last.anim.name}${this.player.last.stand ? ` (${this.player.last.stand})` : ''}` : '',
      swaps: this.player.swaps, notes: this.player.avatar.notes.join(' · '),
    };
  }
}

/** A distinct flat colour per rig slot index (for the slot-identity view and the tests). */
export function slotColor(i: number): number {
  const h = (i * 0.618033988749895) % 1;
  const c = Phaser.Display.Color.HSVToRGB(h, 0.85, 0.95) as Phaser.Types.Display.ColorObject;
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}
