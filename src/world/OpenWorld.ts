// Open world (PvE): one long world, left to right — the area pictures joined edge to edge into one strip (picture tiles;
// with the far landscape behind it, scrolling slower, when there is one: Backdrop), one walkable floor, every prop (blocks
// and platforms you jump on, pillars you walk behind), the NPC, the monsters of every area and the Temple portal. The camera
// follows the player; walking from one area into the next is just walking on (its name shows as you cross into it).
// Combat with the monsters and the quests stay in the scene.
import Phaser from 'phaser';
import PROPS from '../data/world-props.json';
import NPC_ART from '../data/npc-sprites.json';
import { ARENA, ARENA_AREA, GATE, ARENA_MINIMAP_URL, AREA_H, AREA_W, AreaDef, arenaTileKey, arenaTileUrl, belowTerrace, AreaNpc, BACKDROP, MINIMAP_URL, MOB_KINDS, ROW, START, TILES, TOWERS, HEIGHTS, heightArea, WORLD_FLOOR, WORLD_H, WORLD_W, areaAt, tileKey, tileUrl, toWorld, worldObjects } from './Areas';
import { WorldObject, actorDepth, setWorldGeometry } from './WorldGeometry';
import { Backdrop, preloadBackdrop } from './Backdrop';
import { Monster, preloadMonsterFrames } from './Monster';
import { CourtyardAmbience } from './Ambience';
import { NAME_DEPTH } from '../game/ActorView';
import { keyCap, namePlate } from '../game/Plates';
import { Kin } from '../combat/Combat';
import { HUD } from '../config/layout';

const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
type NpcArt = { w: number; h: number; n: number; ox: number; oy: number; q: number };
const ART = NPC_ART as unknown as Record<string, NpcArt>;
/** Occluder cut-outs: prop id → [x, y, w, h] (world px). */
const CUTS = PROPS as unknown as Record<string, [number, number, number, number]>;
const UI_DEPTH = 99000;
const TALK_R = 90, PORTAL_R = 64;
/** NPC name plate: a rounded pill this tall, this much room each side of the name. */
const PLATE = { h: 28, pad: 18 };
/** Camera: catch-up time (ms) — it trails the player softly, never jumps. */
const CAM_EASE = 130;
/** The area name changes this far past the line between two areas (no flicker when you stand on it). */
const AREA_HYST = 40;
/** Quest marker over an NPC's head: a quest to take (gold !), one running (silver ?), one to hand in (gold ?). */
export type NpcMark = 'available' | 'progress' | 'ready' | null;
const MARK_TEX: Record<Exclude<NpcMark, null>, string> = { available: 'kit.marker_excl', progress: 'kit.marker_quest_off', ready: 'kit.marker_quest' };

interface NpcView { def: AreaNpc; area: string; x: number; y: number; top: number; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; plate: Phaser.GameObjects.NineSlice; name: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Image; markKind: NpcMark; t: number }

export interface WorldHooks {
  /** The player walked into another area (its title). */
  onArea: (area: AreaDef) => void;
}

/** The picture tiles within `reach` px of world x. */
const tilesNear = (x: number, reach: number): number[] => TILES.flatMap(([tx, tw], i) => (tx + tw > x - reach && tx < x + reach ? [i] : []));

export function preloadOpenWorld(scene: Phaser.Scene): void {
  const L = (k: string, url: string) => { if (!scene.textures.exists(k)) scene.load.image(k, url); };
  // the world around the start comes with the scene; the rest streams in right after
  for (const i of tilesNear(toWorld(START.area, [START.x, START.y]).x, AREA_W * 1.5)) L(tileKey(i), tileUrl(i));
  ARENA.tiles.forEach((_, i) => L(arenaTileKey(i), arenaTileUrl(i)));
  L('world-gate-back', 'assets/world/gate/back.png'); L('world-gate-front', 'assets/world/gate/front.png');
  for (const id of Object.keys(CUTS)) L(`prop-${id}`, `assets/world/props/${id}.png`);
  for (const [name, a] of Object.entries(ART)) if (!scene.textures.exists(`npc-${name}`)) scene.load.spritesheet(`npc-${name}`, `assets/world/npc/${name}.png`, { frameWidth: a.w, frameHeight: a.h });
  L('kit.drop_beam', KIT('drop_beam')); L('kit.marker_portal', KIT('marker_portal'));
  for (const t of Object.values(MARK_TEX)) L(t, KIT(t.slice(4)));
  for (const set of new Set(Object.values(MOB_KINDS).map((k) => k.frames))) preloadMonsterFrames(scene, set);
  preloadBackdrop(scene);
}

/** Camera up high: the height where it is drawn back all the way, how far back (share of the zoom), how fast it
 *  rises / comes down with the ground (ms), how fast it moves up and down (ms). */
const UP_FULL = 340, UP_ZOOM = 0.2, CAM_RISE = 420, CAM_FALL = 220, CAM_EASE_Y = 160;
/** Near a stair (world px from it: full look .. none) the camera looks up as if this high, easing over CAM_LOOK ms. */
const LOOK_NEAR = 160, LOOK_FAR = 820, LOOK_H = 280, CAM_LOOK = 650;

/** The painted stone cube the towers are stacked of: its width, one cube's height (front face with plinth), its top face. */
const CUBE = { w: 183, h: 86, top: 32 };

export class OpenWorld {
  /** The area the player is in. */
  area: AreaDef;
  mobs: Monster[] = [];
  private tiles: (Phaser.GameObjects.Image | null)[] = TILES.map(() => null);
  private arenaTiles: (Phaser.GameObjects.Image | null)[] = ARENA.tiles.map(() => null);
  private occluders: Phaser.GameObjects.Image[] = [];
  private towers: Phaser.GameObjects.Image[] = [];
  private gate: Phaser.GameObjects.Image[] = [];
  private npcs: NpcView[] = [];
  private prompt: Phaser.GameObjects.Container;
  private promptKey: Phaser.GameObjects.Text;
  /** x, y: where you stand to use it (ground); z: the height of what it stands on. */
  private portal: { x: number; y: number; z: number; beam: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Ellipse; glow: Phaser.GameObjects.Image; motes: Phaser.GameObjects.Particles.ParticleEmitter } | null = null;
  private ambience: CourtyardAmbience;
  private backdrop: Backdrop | null = null;
  private camX = 0;
  private camY = 0;
  private t = 0;
  /** The talk / portal prompt target (null = none in reach). */
  near: { kind: 'npc'; npc: AreaNpc } | { kind: 'portal' } | null = null;
  /** Set by the scene: an NPC was clicked. */
  onNpcClick?: (n: AreaNpc) => void;

  constructor(private scene: Phaser.Scene, private hooks: WorldHooks, start: { x: number; y: number }) {
    this.area = this.areaOf(start.x, start.y);
    setWorldGeometry(WORLD_FLOOR, worldObjects());
    TILES.forEach((_, i) => this.ensureTile(i));
    ARENA.tiles.forEach((_, i) => this.ensureArenaTile(i));
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    if (!scene.load.isLoading()) scene.load.start();
    this.buildOccluders(); this.buildTowers(); this.buildHeights(); this.buildGate(); this.buildNpcs(); this.buildPortal(); this.spawnMobs();
    if (BACKDROP) this.backdrop = new Backdrop(scene);
    const cam = scene.cameras.main;
    this.baseZoom = cam.zoom;
    this.ambience = new CourtyardAmbience(scene, Math.ceil(cam.width / (cam.zoom * (1 - UP_ZOOM))) + 4, AREA_H, BACKDROP ? [330, 668] : undefined);
    const k = keyCap(scene, 0, 0, 32);
    this.promptKey = scene.add.text(0, -2, 'Y', { fontFamily: HUD.bodyFont, fontSize: '15px', fontStyle: '700', color: '#f3ede0', resolution: 2 }).setOrigin(0.5);
    this.prompt = scene.add.container(0, 0, [k, this.promptKey]).setDepth(UI_DEPTH).setVisible(false);
    this.follow(start.x, start.y, 0, true);
  }

  // ------------------------------------------------------------------ building
  private onFile(key: string): void {
    if (key.startsWith('world-tile-')) this.ensureTile(Number(key.slice(11)));
    else if (key.startsWith('world-arena-')) this.ensureArenaTile(Number(key.slice(12)));
  }

  /** A tile of the Sun Seal Plaza's picture, under the terrace (its arcade stands on the plaza's top edge). */
  private ensureArenaTile(i: number): void {
    if (this.arenaTiles[i]) return;
    const key = arenaTileKey(i);
    if (!this.scene.textures.exists(key)) { this.scene.load.image(key, arenaTileUrl(i)); return; }
    this.arenaTiles[i] = this.scene.add.image(ARENA.tiles[i][0], ARENA.y, key).setOrigin(0, 0).setDepth(-1.5);
  }

  /** A picture tile in place (once its texture is there; queued for loading otherwise). */
  private ensureTile(i: number): void {
    if (this.tiles[i]) return;
    const key = tileKey(i);
    if (!this.scene.textures.exists(key)) { this.scene.load.image(key, tileUrl(i)); return; }
    this.tiles[i] = this.scene.add.image(TILES[i][0], 0, key).setOrigin(0, 0).setDepth(-1);
  }

  private buildOccluders(): void {
    const front = new Map<string, number>(worldObjects().map((o: WorldObject) => [o.id, o.frontY]));
    for (const [id, [x, y]] of Object.entries(CUTS)) {
      const f = front.get(id); if (f === undefined) continue;
      this.occluders.push(this.scene.add.image(x, y, `prop-${id}`).setOrigin(0, 0).setDepth(f));
    }
  }

  /** The maps above the terrace: each picture behind the terrace (its wall stands behind the back balustrade), its
   *  blocks' cut-outs over whoever walks behind them up there. */
  private buildHeights(): void {
    for (const h of HEIGHTS) {
      const put = (key: string, url: string, make: () => void) => {
        if (this.scene.textures.exists(key)) { make(); return; }
        this.scene.load.image(key, url); this.scene.load.once(`filecomplete-image-${key}`, make);
        if (!this.scene.load.isLoading()) this.scene.load.start();
      };
      put(`heights-${h.id}`, h.img, () => this.towers.push(this.scene.add.image(h.x, h.imgY, `heights-${h.id}`).setOrigin(0, 0).setDepth(-1.2)));
      for (const b of h.blocks) put(`heights-${h.id}-${b.id}`, b.occ.img, () => this.towers.push(this.scene.add.image(b.occ.x, h.imgY + b.occ.py, `heights-${h.id}-${b.id}`).setOrigin(0, 0).setDepth(h.front + 1 + b.front * 0.001)));
    }
  }

  /** Climbable, shown: a soft warm light breathing on every stair cube's top face with little motes rising off it, and a
   *  line of light along the edge of the map above where the stair leads (MapleStory: you see at once where you can
   *  go up). */
  private climbHints(): void {
    const sc = this.scene;
    if (!sc.textures.exists('climb-glow')) {
      const g = sc.make.graphics({ x: 0, y: 0 }, false);
      for (let i = 24; i > 0; i--) { g.fillStyle(0xffe2a0, 0.06 + (1 - i / 24) * 0.09); g.fillEllipse(64, 16, 128 * (i / 24), 32 * (i / 24)); }
      g.generateTexture('climb-glow', 128, 32); g.destroy();
    }
    if (!sc.textures.exists('climb-mote')) {
      const g = sc.make.graphics({ x: 0, y: 0 }, false);
      for (let r = 6; r > 0; r--) { g.fillStyle(0xfff2c8, 0.18 + (1 - r / 6) * 0.5); g.fillCircle(6, 6, r); }
      g.generateTexture('climb-mote', 12, 12); g.destroy();
    }
    const pulse = (o: Phaser.GameObjects.GameObject, lo: number, hi: number, ms: number, delay: number) =>
      sc.tweens.add({ targets: o, alpha: { from: lo, to: hi }, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.towers.push(o as unknown as Phaser.GameObjects.Image); return o; };
    TOWERS.forEach((t, i) => {
      const cx = (t.x0 + t.x1) / 2, w = t.x1 - t.x0, top = t.front - Math.round(t.h / CUBE.h) * CUBE.h - CUBE.top / 2;
      const glow = add(sc.add.image(cx, top, 'climb-glow').setDisplaySize(w * 0.95, CUBE.top * 1.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(t.front + 1.2));
      pulse(glow, 0.55, 1, 1300, i * 260);
      add(sc.add.particles(0, 0, 'climb-mote', {
        x: { min: t.x0 + 14, max: t.x1 - 14 }, y: { min: top - 8, max: top + 8 }, lifespan: 1400, speedY: { min: -38, max: -18 }, speedX: { min: -6, max: 6 },
        scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.85, end: 0 }, frequency: 420, quantity: 1, blendMode: 'ADD',
      }).setDepth(t.front + 1.3));
    });
    // the edge of the map above, over each stair: where the last jump lands
    for (const h of HEIGHTS) {
      const st = TOWERS.filter((t) => t.x1 > h.x && t.x0 < h.x + h.w); if (!st.length) continue;
      const x0 = Math.min(...st.map((t) => t.x0)), x1 = Math.max(...st.map((t) => t.x1)), cx = (x0 + x1) / 2, ey = h.front - h.H;
      const line = add(sc.add.image(cx + (x1 - cx) * 0.35, ey - 4, 'climb-glow').setDisplaySize((x1 - x0) * 0.75, 40).setBlendMode(Phaser.BlendModes.ADD).setDepth(h.front + 0.9));
      pulse(line, 0.45, 0.95, 1500, 400);
      add(sc.add.particles(0, 0, 'climb-mote', {
        x: { min: x0 + (x1 - x0) * 0.15, max: x1 }, y: { min: ey - 10, max: ey + 4 }, lifespan: 1600, speedY: { min: -30, max: -12 },
        scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.7, end: 0 }, frequency: 300, quantity: 1, blendMode: 'ADD',
      }).setDepth(h.front + 0.95));
    }
  }

  /** The climbing towers (Areas.TOWERS): stacks of the painted stone cube (public/assets/world/blocks: its front face, one
   *  per cube from the floor up, and its top face on the last), side by side as wide as the tower. */
  private buildTowers(): void {
    const keys = [['tower-cube-face', 'assets/world/blocks/cube_face.png'], ['tower-cube-top', 'assets/world/blocks/cube_top.png']];
    const missing = keys.filter(([k]) => !this.scene.textures.exists(k));
    if (missing.length) {
      for (const [k, u] of missing) this.scene.load.image(k, u);
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => this.buildTowers());
      if (!this.scene.load.isLoading()) this.scene.load.start();
      return;
    }
    this.climbHints();
    for (const t of TOWERS) {
      const cols = Math.max(1, Math.round((t.x1 - t.x0) / CUBE.w)), n = Math.max(1, Math.round(t.h / CUBE.h)), cw = (t.x1 - t.x0) / cols, d = t.front + 1;
      for (let c = 0; c < cols; c++) {
        const x = t.x0 + c * cw;
        for (let i = 0; i < n; i++) this.towers.push(this.scene.add.image(x, t.front - CUBE.h * (i + 1), 'tower-cube-face').setOrigin(0, 0).setDisplaySize(cw, CUBE.h).setDepth(d));
        this.towers.push(this.scene.add.image(x, t.front - CUBE.h * n - CUBE.top, 'tower-cube-top').setOrigin(0, 0).setDisplaySize(cw, CUBE.top).setDepth(d));
      }
    }
  }

  /** The Temple Gate: its back tower behind anyone on the floor, its arch and front tower in front of everyone. */
  private buildGate(): void {
    for (const k of ['back', 'front'] as const) {
      const g = GATE[k];
      this.gate.push(this.scene.add.image(g.x, g.y, `world-gate-${k}`).setOrigin(0, 0).setScale(1 / GATE.q).setDepth(g.depth));
    }
  }

  private buildNpcs(): void {
    for (const a of ROW) for (const n of a.npcs ?? []) {
      const art = ART[n.art]; if (!art) continue;
      const g = toWorld(a.id, [n.x, n.y]), z = n.z ?? 0;
      const p = { x: g.x, y: g.y - z };          // on a block: drawn up on its top face
      const d = g.y + (z ? 40 : 0);               // on a block: in front of the block's picture
      const sprite = this.scene.add.sprite(p.x, p.y, `npc-${n.art}`, 0).setOrigin(n.flip ? 1 - art.ox : art.ox, art.oy).setScale(1 / art.q).setDepth(d).setFlipX(!!n.flip);
      const shadow = this.scene.add.ellipse(p.x, p.y - 1, 40, 13, 0x000000, 0.32).setDepth(d - 0.5);
      const nd = NAME_DEPTH + p.y * 0.001; // name, title and quest marker stay readable over anything in front
      const ly = g.y; // name plate under the feet on the floor (on a block: in front of its base)
      const name = this.scene.add.text(p.x, ly + 22, n.name, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', fontStyle: '700', color: '#f3e3bd', resolution: 2 }).setOrigin(0.5).setDepth(nd + 0.0002);
      const plate = namePlate(this.scene, p.x, ly + 22, name.width + PLATE.pad * 2, PLATE.h).setDepth(nd + 0.0001);
      const title = this.scene.add.text(p.x, ly + 48, n.title, { fontFamily: HUD.bodyFont, fontSize: '12.5px', fontStyle: '600', color: '#e4e8ee', stroke: '#0b1220', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(nd + 0.0002);
      const top = p.y - art.h * art.oy / art.q; // head top (world px)
      const mark = this.scene.add.image(p.x, top - 26, MARK_TEX.available).setDisplaySize(15, 42).setDepth(nd + 0.0003).setVisible(false);
      // a click on the game itself only (not one on a window drawn over the NPC: the inventory, the skill book)
      sprite.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.event?.target === this.scene.game.canvas) this.onNpcClick?.(n); });
      this.npcs.push({ def: n, area: a.id, x: p.x, y: g.y, top, sprite, shadow, plate, name, title, mark, markKind: null, t: Math.random() * 3000 });
    }
  }

  /** Where an NPC stands (world px). */
  npcPos(n: AreaNpc): { x: number; y: number } { const v = this.npcs.find((q) => q.def === n); return v ? { x: v.x, y: v.y } : { x: n.x, y: n.y }; }

  private buildPortal(): void {
    const a = ROW.find((x) => x.portal); if (!a?.portal) return;
    const g = toWorld(a.id, [a.portal.x, a.portal.y]), z = a.portal.z ?? 0;
    const p = { x: g.x, y: g.y - z };          // drawn where it stands (up on the stage: higher on screen)
    const d0 = actorDepth(g.x, g.y, z) - p.y;  // its layer: under the feet of someone standing there
    const ring = this.scene.add.ellipse(p.x, p.y, 92, 30).setStrokeStyle(3, 0xffe2a0, 0.9).setFillStyle(0xffd27a, 0.18).setDepth(p.y + d0 - 0.4).setBlendMode(Phaser.BlendModes.ADD);
    const beam = this.scene.add.image(p.x, p.y + 6, 'kit.drop_beam').setOrigin(0.5, 0.92).setDisplaySize(96, 210).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + d0 + 0.3).setAlpha(0.85);
    const glow = this.scene.add.image(p.x, p.y - 2, 'kit.marker_portal').setDisplaySize(70, 24).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + d0 - 0.3).setAlpha(0.9);
    if (!this.scene.textures.exists('portal-mote')) {
      const g = this.scene.make.graphics({}, false);
      for (let i = 8; i > 0; i--) g.fillStyle(0xffffff, 0.12 + (8 - i) * 0.1).fillCircle(8, 8, i);
      g.generateTexture('portal-mote', 16, 16); g.destroy();
    }
    const motes = this.scene.add.particles(p.x, p.y, 'portal-mote', {
      speedY: { min: -90, max: -40 }, speedX: { min: -10, max: 10 }, lifespan: { min: 900, max: 1500 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xffe7a8, 0xffd27a], blendMode: 'ADD', frequency: 70,
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 70, 20), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    }).setDepth(p.y + d0 + 0.35);
    this.portal = { x: g.x, y: g.y, z, beam, ring, glow, motes };
  }

  /** Every area's monsters live all the time (each one keeps to its own home spot). */
  private spawnMobs(): void {
    for (const h of HEIGHTS) { const kind = MOB_KINDS[h.mobs.kind]; if (kind) h.mobs.spawns.forEach((s, i) => this.mobs.push(new Monster(this.scene, `mob:${h.id}:${i}`, kind, { x: s[0], y: s[1] }, i))); }
    for (const a of ROW) for (const [j, def] of [a.mobs, a.mobs2].entries()) {
      const kind = def ? MOB_KINDS[def.kind] : undefined; if (!def || !kind) continue;
      def.spawns.forEach((s, i) => this.mobs.push(new Monster(this.scene, `mob:${a.id}:${j ? `b${i}` : i}`, kind, toWorld(a.id, s), i)));
    }
  }

  // ------------------------------------------------------------------ camera
  /** World x of the screen's left edge. */
  get viewLeft(): number { const cam = this.scene.cameras.main; return this.camX - cam.width / cam.zoom / 2; }

  /** The camera trails the player along the world (snap: straight there). On the terrace: its whole height. Down the
   *  stairs it goes down with you (no cut, no fade) and over the plaza it follows you both ways. Up on the blocks and the
   *  maps above it rises with the ground you stand on and draws back (zooms out) as you climb, so the floor below and the
   *  one above are both in view; a jump never moves it, a drop takes it down with you, all of it eased (no jumps). */
  private follow(x: number, y: number, ms: number, snap = false, ground = 0, z = 0, grounded = true): void {
    const cam = this.scene.cameras.main, terraceCy = WORLD_H / 2;
    // the height the camera follows: the ground you stand on; in the air the last one, or lower while you fall
    if (grounded) this.camGround = ground; else this.camGround = Math.min(this.camGround, Math.max(ground, z));
    const kh = snap ? 1 : 1 - Math.exp(-ms / (this.camGround < this.camH ? CAM_FALL : CAM_RISE));
    this.camH += (this.camGround - this.camH) * kh;
    // close to a stair up to a map above: the camera draws back a little already, so the floor above comes into view
    let look = 0;
    if (!belowTerrace(y)) for (const t of TOWERS) { const d = x < t.x0 ? t.x0 - x : x > t.x1 ? x - t.x1 : 0; look = Math.max(look, 1 - Phaser.Math.Clamp((d - LOOK_NEAR) / (LOOK_FAR - LOOK_NEAR), 0, 1) ** 2 * (3 - 2 * Phaser.Math.Clamp((d - LOOK_NEAR) / (LOOK_FAR - LOOK_NEAR), 0, 1))); }
    const kl = snap ? 1 : 1 - Math.exp(-ms / CAM_LOOK);
    this.camLook += (look * LOOK_H - this.camLook) * kl;
    const hView = Math.max(this.camH, this.camLook);
    // zoom: drawn back as you climb (all the way back from the height of a map above)
    const up = Phaser.Math.SmoothStep(hView, 30, UP_FULL);
    const zoom = this.baseZoom * (1 - UP_ZOOM * up);
    if (Math.abs(cam.zoom - zoom) > 1e-4) cam.setZoom(zoom);
    const half = cam.width / zoom / 2, halfH = cam.height / zoom / 2;
    const down = belowTerrace(y);
    const lead = (ARENA.edgeY - terraceCy) * (1 - Phaser.Math.SmoothStep(y, ARENA.edgeY, ARENA.y));
    // up high: the view rises so that you stand a little below its middle (the floor above and the one below both show)
    const lift = down ? 0 : Math.max(0, hView * 0.92 - 20) * up + Math.max(0, hView - 20) * 0.25 * (1 - up);
    let ty = down ? Phaser.Math.Clamp(y - lead, terraceCy, ARENA.y + ARENA.h - halfH) : terraceCy - lift;
    // never lose you: whatever happens, your body stays well inside the view
    const sy = y - z;
    ty = Phaser.Math.Clamp(ty, sy - halfH + 260, Math.max(sy - halfH + 260, sy + halfH - 250));
    const hi = down ? Math.min(WORLD_W, ARENA.x + ARENA.w) - half : WORLD_W - half;
    const lo = down ? Math.max(0, ARENA.x) + half : half;
    const tx = Phaser.Math.Clamp(x, lo, Math.max(lo, hi));
    const k = snap ? 1 : 1 - Math.exp(-ms / CAM_EASE), ky = snap ? 1 : 1 - Math.exp(-ms / CAM_EASE_Y);
    this.camX += (tx - this.camX) * k;
    if (Math.abs(tx - this.camX) < 0.05) this.camX = tx;
    this.camY += (ty - this.camY) * ky;
    if (Math.abs(ty - this.camY) < 0.05) this.camY = ty;
    cam.centerOn(this.camX, this.camY);
    this.ambience.setView(this.viewLeft);
    this.backdrop?.setView(this.viewLeft, cam.width / zoom);
    this.backdrop?.setLift(Math.max(0, terraceCy - this.camY));
  }
  private camGround = 0;
  private camH = 0;
  private camLook = 0;
  private baseZoom = 1;

  /** Instant move (portal, waking up after a defeat): a short fade, then there. */
  jumpTo(id: string, x: number, y: number, k: Kin, done?: () => void): void {
    const cam = this.scene.cameras.main;
    cam.fadeOut(260, 255, 244, 220);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const p = toWorld(id, [x, y]); k.x = p.x; k.y = p.y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true; k.supportZ = 0;
      this.follow(p.x, p.y, 0, true);
      this.setArea(this.areaOf(p.x, p.y));
      done?.();
      cam.fadeIn(420, 255, 244, 220);
    });
  }

  /** The area at a spot: the plaza below the terrace's picture, else by x along the strip. */
  private areaOf(x: number, y: number): AreaDef { return y >= ARENA.y ? ARENA_AREA : areaAt(x); }

  private setArea(a: AreaDef): void { if (a === this.area) return; this.area = a; this.hooks.onArea(a); }

  // ------------------------------------------------------------------ per frame
  /** player: z = height above what he stands on, supportZ = the height of that (0 = the floor). */
  update(ms: number, player: { x: number; y: number; z: number; supportZ?: number; absZ?: number; grounded?: boolean; alive: boolean }): void {
    this.t += ms;
    this.follow(player.x, player.y, ms, false, player.supportZ ?? 0, player.absZ ?? 0, player.grounded ?? true);
    this.ambience.update(ms);
    this.backdrop?.update(ms);
    // the area you are in (by where you stand on the strip; a little past the line, so it never flickers)
    const up = HEIGHTS.find((h) => (player.supportZ ?? 0) >= h.H - 1 && player.x >= h.x && player.x <= h.x + h.w && player.y <= h.front + 2);
    if (up) { if (this.area.id !== up.id) this.setArea(heightArea(up)); }
    const a = up ? this.area : this.areaOf(player.x, player.y);
    if (a === ARENA_AREA || this.area === ARENA_AREA) { if (a !== this.area && Math.abs(player.y - ARENA.y) > AREA_HYST) this.setArea(a); }
    else if (a !== this.area && player.x > a.span[0] + (a.span[0] > 0 ? AREA_HYST : 0) - 1 && player.x < a.span[1] - (a.span[1] < WORLD_W ? AREA_HYST : 0) + 1) this.setArea(a);
    // the Temple Gate's front layer turns see-through while you are behind its front tower (it would hide you)
    if (this.gate[1]) {
      const f = this.gate[1], ft = GATE.props[1].foot, behind = player.x > f.x && player.x < f.x + f.displayWidth && player.y < ft[0][1] && player.y > f.y + f.displayHeight * 0.25 - 200;
      const want = behind ? 0.5 : 1; f.setAlpha(f.alpha + (want - f.alpha) * (1 - Math.exp(-ms / 120)));
    }
    // NPCs: idle loop, quest marker bob
    for (const n of this.npcs) {
      n.t += ms;
      const art = ART[n.def.art];
      n.sprite.setFrame(Math.floor(n.t / (art.n > 4 ? 110 : 320)) % art.n);
      n.mark.setPosition(n.x, n.top - 26 + Math.sin(n.t / 380) * 3);
    }
    if (this.portal) {
      const P = this.portal, s = Math.sin(this.t / 380);
      P.ring.setScale(1 + 0.05 * s); P.beam.setAlpha(0.72 + 0.18 * s); P.glow.setAngle(this.t / 12).setAlpha(0.75 + 0.2 * s);
    }
    // talk / portal prompt
    this.near = null;
    if (player.alive && player.z < 30) {
      let best = TALK_R;
      for (const n of this.npcs) {
        const d = Math.hypot(player.x - n.x, (player.y - n.y) * 1.4);
        if (d < best) { best = d; this.near = { kind: 'npc', npc: n.def }; }
      }
      const P = this.portal;
      if (!this.near && P && Math.abs((player.supportZ ?? 0) - P.z) < 8 && Math.hypot(player.x - P.x, (player.y - P.y) * 1.4) < PORTAL_R) this.near = { kind: 'portal' };
    }
    const nv = this.near?.kind === 'npc' ? this.npcs.find((n) => n.def === (this.near as { npc: AreaNpc }).npc) : null;
    const at = nv ? { x: nv.x + 34, y: nv.top - 4 } : this.near?.kind === 'portal' && this.portal ? { x: this.portal.x, y: this.portal.y - this.portal.z - 120 } : null;
    this.prompt.setVisible(!!at);
    if (at) this.prompt.setPosition(at.x, at.y + Math.sin(this.t / 260) * 3);
  }

  setTalkKey(label: string): void { this.promptKey.setText(label || '?'); }

  /** Quest marker over an NPC (set by the scene from the quest states). */
  setNpcMark(id: string, kind: NpcMark): void {
    for (const n of this.npcs) {
      if (n.def.id !== id || n.markKind === kind) continue;
      n.markKind = kind; n.mark.setVisible(!!kind);
      if (kind) { n.mark.setTexture(MARK_TEX[kind]); n.mark.setDisplaySize(kind === 'available' ? 15 : 25, 42); }
    }
  }

  /** The minimap: a square of the world around you (its full height), sliding along as you walk; its people, the portal. */
  minimap(player: { x: number; y: number }): { label: string; imageUrl: string; image: { x: number; y: number; w: number; h: number }; bounds: { minX: number; minY: number; width: number; height: number }; markers: { id: string; kind: 'player' | 'npc' | 'portal'; x: number; y: number }[] } {
    if (this.area === ARENA_AREA) {
      const side = ARENA.h, minX = Phaser.Math.Clamp(player.x - side / 2, ARENA.x, ARENA.x + ARENA.w - side);
      return { label: ARENA.name, imageUrl: ARENA_MINIMAP_URL, image: { x: ARENA.x, y: ARENA.y, w: ARENA.w, h: ARENA.h }, bounds: { minX, minY: ARENA.y, width: side, height: side }, markers: [{ id: 'local', kind: 'player', x: player.x, y: player.y }] };
    }
    const side = WORLD_H, minX = Phaser.Math.Clamp(player.x - side / 2, 0, Math.max(0, WORLD_W - side));
    const markers: { id: string; kind: 'player' | 'npc' | 'portal'; x: number; y: number }[] = [{ id: 'local', kind: 'player', x: player.x, y: player.y }];
    for (const n of this.npcs) markers.push({ id: `npc:${n.def.id}`, kind: 'npc', x: n.x, y: n.y });
    if (this.portal) markers.push({ id: 'portal', kind: 'portal', x: this.portal.x, y: this.portal.y - this.portal.z });
    return { label: this.area.name, imageUrl: MINIMAP_URL, image: { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, bounds: { minX, minY: 0, width: side, height: side }, markers };
  }

  destroy(): void {
    this.scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    for (const m of this.mobs) m.destroy();
    this.mobs = [];
    for (const im of this.tiles) im?.destroy();
    this.tiles = TILES.map(() => null);
    for (const im of this.arenaTiles) im?.destroy();
    this.arenaTiles = ARENA.tiles.map(() => null);
    for (const o of this.occluders) o.destroy();
    for (const o of this.towers) o.destroy(); this.towers = [];
    for (const g of this.gate) g.destroy(); this.gate = [];
    for (const n of this.npcs) { n.sprite.destroy(); n.shadow.destroy(); n.plate.destroy(); n.name.destroy(); n.title.destroy(); n.mark.destroy(); }
    if (this.portal) { this.portal.beam.destroy(); this.portal.ring.destroy(); this.portal.glow.destroy(); this.portal.motes.destroy(); }
    this.prompt.destroy();
    this.ambience.destroy();
    this.backdrop?.destroy(); this.backdrop = null;
  }
}
