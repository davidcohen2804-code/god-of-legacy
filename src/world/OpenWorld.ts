// Open world (PvE): one long world, left to right — the area pictures joined edge to edge into one strip (picture tiles;
// with the far landscape behind it, scrolling slower, when there is one: Backdrop), one walkable floor, every prop (blocks
// and platforms you jump on, pillars you walk behind), the NPC, the monsters of every area and the Temple portal. The camera
// follows the player; walking from one area into the next is just walking on (its name shows as you cross into it).
// Combat with the monsters and the quests stay in the scene.
import Phaser from 'phaser';
import PROPS from '../data/world-props.json';
import NPC_ART from '../data/npc-sprites.json';
import { ARENA, ARENA_AREA, GATE, ARENA_MINIMAP_URL, AREA_H, AREA_W, AreaDef, arenaTileKey, arenaTileUrl, belowTerrace, AreaNpc, BACKDROP, MINIMAP_URL, MOB_KINDS, ROW, START, TILES, WORLD_FLOOR, WORLD_H, WORLD_W, areaAt, tileKey, tileUrl, toWorld, worldObjects } from './Areas';
import { WorldObject, actorDepth, setWorldGeometry } from './WorldGeometry';
import { Backdrop, preloadBackdrop } from './Backdrop';
import { Monster, preloadMonsterFrames } from './Monster';
import { CourtyardAmbience } from './Ambience';
import { NAME_DEPTH } from '../game/ActorView';
import { Kin } from '../combat/Combat';
import { HUD } from '../config/layout';

const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
type NpcArt = { w: number; h: number; n: number; ox: number; oy: number; q: number };
const ART = NPC_ART as unknown as Record<string, NpcArt>;
/** Occluder cut-outs: prop id → [x, y, w, h] (world px). */
const CUTS = PROPS as unknown as Record<string, [number, number, number, number]>;
const UI_DEPTH = 99000;
const TALK_R = 90, PORTAL_R = 64;
/** NPC name plate (npc_plate.png is 449x128): shown 30 px tall; its gold ends are 64 art px wide; room around the name. */
const PLATE = { h: 30, cap: 64, pad: 16 };
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
  L('kit.keycap', KIT('keycap')); L('kit.npc_plate', KIT('npc_plate'));
  L('kit.drop_beam', KIT('drop_beam')); L('kit.marker_portal', KIT('marker_portal'));
  for (const t of Object.values(MARK_TEX)) L(t, KIT(t.slice(4)));
  for (const set of new Set(Object.values(MOB_KINDS).map((k) => k.frames))) preloadMonsterFrames(scene, set);
  preloadBackdrop(scene);
}

export class OpenWorld {
  /** The area the player is in. */
  area: AreaDef;
  mobs: Monster[] = [];
  private tiles: (Phaser.GameObjects.Image | null)[] = TILES.map(() => null);
  private arenaTiles: (Phaser.GameObjects.Image | null)[] = ARENA.tiles.map(() => null);
  private occluders: Phaser.GameObjects.Image[] = [];
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
    this.buildOccluders(); this.buildGate(); this.buildNpcs(); this.buildPortal(); this.spawnMobs();
    if (BACKDROP) this.backdrop = new Backdrop(scene);
    const cam = scene.cameras.main;
    this.ambience = new CourtyardAmbience(scene, Math.ceil(cam.width / cam.zoom) + 4, AREA_H, BACKDROP ? [330, 668] : undefined);
    const k = scene.add.image(0, 0, 'kit.keycap').setDisplaySize(34, 33);
    this.promptKey = scene.add.text(0, -1, 'Y', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '16px', fontStyle: '700', color: '#ffe9a8', stroke: '#1a1206', strokeThickness: 3, resolution: 2 }).setOrigin(0.5);
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
      const p = toWorld(a.id, [n.x, n.y]);
      const sprite = this.scene.add.sprite(p.x, p.y, `npc-${n.art}`, 0).setOrigin(n.flip ? 1 - art.ox : art.ox, art.oy).setScale(1 / art.q).setDepth(p.y).setFlipX(!!n.flip);
      const shadow = this.scene.add.ellipse(p.x, p.y - 1, 40, 13, 0x000000, 0.32).setDepth(p.y - 0.5);
      const nd = NAME_DEPTH + p.y * 0.001; // name, title and quest marker stay readable over anything in front
      const name = this.scene.add.text(p.x, p.y + 22, n.name, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '15px', fontStyle: '700', color: '#ffe28a', stroke: '#140c02', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(nd + 0.0002);
      // the plate stretches only in its blue middle: the gold diamond ends keep their shape, the name sits well inside
      const ps = PLATE.h / 128, pw = (name.width + PLATE.pad * 2) / ps + PLATE.cap * 2;
      const plate = this.scene.add.nineslice(p.x, p.y + 22, 'kit.npc_plate', undefined, pw, 128, PLATE.cap, PLATE.cap, 0, 0).setScale(ps).setDepth(nd + 0.0001);
      const title = this.scene.add.text(p.x, p.y + 45, n.title, { fontFamily: HUD.bodyFont, fontSize: '13px', fontStyle: '600', color: '#efe3c4', stroke: '#140c02', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(nd + 0.0002);
      const top = p.y - art.h * art.oy / art.q; // head top (world px)
      const mark = this.scene.add.image(p.x, top - 26, MARK_TEX.available).setDisplaySize(15, 42).setDepth(nd + 0.0003).setVisible(false);
      // a click on the game itself only (not one on a window drawn over the NPC: the inventory, the skill book)
      sprite.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.event?.target === this.scene.game.canvas) this.onNpcClick?.(n); });
      this.npcs.push({ def: n, area: a.id, x: p.x, y: p.y, top, sprite, shadow, plate, name, title, mark, markKind: null, t: Math.random() * 3000 });
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
    for (const a of ROW) {
      const def = a.mobs, kind = def ? MOB_KINDS[def.kind] : undefined; if (!def || !kind) continue;
      def.spawns.forEach((s, i) => this.mobs.push(new Monster(this.scene, `mob:${a.id}:${i}`, kind, toWorld(a.id, s), i)));
    }
  }

  // ------------------------------------------------------------------ camera
  /** World x of the screen's left edge. */
  get viewLeft(): number { const cam = this.scene.cameras.main; return this.camX - cam.width / cam.zoom / 2; }

  /** The camera trails the player along the world (snap: straight there). On the terrace: its whole height, always. Down
   *  the stairs it goes down with you (no cut, no fade) and over the plaza it follows you both ways (the terrace runs
   *  above the whole plaza, so looking up always shows its arcade). */
  private follow(x: number, y: number, ms: number, snap = false): void {
    const cam = this.scene.cameras.main, half = cam.width / cam.zoom / 2, halfH = cam.height / cam.zoom / 2;
    const down = belowTerrace(y), terraceCy = WORLD_H / 2;
    // height: on the terrace its centre; down the stairs it eases from there onto the player (centred by the stairs' foot)
    const lead = (ARENA.edgeY - terraceCy) * (1 - Phaser.Math.SmoothStep(y, ARENA.edgeY, ARENA.y));
    const ty = down ? Phaser.Math.Clamp(y - lead, terraceCy, ARENA.y + ARENA.h - halfH) : terraceCy;
    const hi = down ? Math.min(WORLD_W, ARENA.x + ARENA.w) - half : WORLD_W - half;
    const lo = down ? Math.max(0, ARENA.x) + half : half;
    const tx = Phaser.Math.Clamp(x, lo, Math.max(lo, hi));
    const k = snap ? 1 : 1 - Math.exp(-ms / CAM_EASE);
    this.camX += (tx - this.camX) * k;
    if (Math.abs(tx - this.camX) < 0.05) this.camX = tx;
    this.camY += (ty - this.camY) * k;
    if (Math.abs(ty - this.camY) < 0.05) this.camY = ty;
    cam.centerOn(this.camX, this.camY);
    this.ambience.setView(this.viewLeft);
    this.backdrop?.setView(this.viewLeft, cam.width / cam.zoom);
  }

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
  update(ms: number, player: { x: number; y: number; z: number; supportZ?: number; alive: boolean }): void {
    this.t += ms;
    this.follow(player.x, player.y, ms);
    this.ambience.update(ms);
    this.backdrop?.update(ms);
    // the area you are in (by where you stand on the strip; a little past the line, so it never flickers)
    const a = this.areaOf(player.x, player.y);
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
    for (const g of this.gate) g.destroy(); this.gate = [];
    for (const n of this.npcs) { n.sprite.destroy(); n.shadow.destroy(); n.plate.destroy(); n.name.destroy(); n.title.destroy(); n.mark.destroy(); }
    if (this.portal) { this.portal.beam.destroy(); this.portal.ring.destroy(); this.portal.glow.destroy(); this.portal.motes.destroy(); }
    this.prompt.destroy();
    this.ambience.destroy();
    this.backdrop?.destroy(); this.backdrop = null;
  }
}
