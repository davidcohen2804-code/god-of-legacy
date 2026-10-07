// Open world (PvE): every area picture laid on its own cell of one big world; the player walks from area to area
// (no portals): walking out through a path at the picture's edge (or into a doorway) glides the camera over to the
// next area through a veil of mist while he steps out and back in. Owns per area: floor + props (WorldGeometry),
// prop occluders (baked cut-outs), the NPC (name plate, quest marker, talk prompt), the monsters, exit hints, the
// Temple portal and the ambience. Combat with the monsters and the quests stay in the scene.
import Phaser from 'phaser';
import PROPS from '../data/world-props.json';
import NPC_ART from '../data/npc-sprites.json';
import { AREA_H, AREA_W, AREAS, AreaDef, AreaExit, AreaNpc, MOB_KINDS, START, areaGeometry, areaOrigin, areaTexKey, areaTexUrl, backExit, exitAt, neighbours, toWorld } from './Areas';
import { setWorldGeometry } from './WorldGeometry';
import { Monster, preloadMonsterFrames } from './Monster';
import { CourtyardAmbience } from './Ambience';
import { Kin } from '../combat/Combat';

const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
type NpcArt = { w: number; h: number; n: number; ox: number; oy: number; q: number };
const ART = NPC_ART as unknown as Record<string, NpcArt>;
const PROP_BOX = PROPS as unknown as Record<string, Record<string, [number, number, number, number]>>;
const MIST = 90000, UI_DEPTH = 99000;
/** Camera glide between two areas (ms) and the share of it spent walking out / in. */
const GLIDE = { ms: 900, outEnd: 0.42, inStart: 0.58 };
const TALK_R = 90, PORTAL_R = 64;
/** Quest marker over an NPC's head: a quest to take (gold !), one running (silver ?), one to hand in (gold ?). */
export type NpcMark = 'available' | 'progress' | 'ready' | null;
const MARK_TEX: Record<Exclude<NpcMark, null>, string> = { available: 'kit.marker_excl', progress: 'kit.marker_quest_off', ready: 'kit.marker_quest' };

interface NpcView { def: AreaNpc; area: string; x: number; y: number; top: number; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; plate: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Image; markKind: NpcMark; t: number }
export interface Transit { exit: AreaExit; from: string; to: string; t: number; cam0: { x: number; y: number }; cam1: { x: number; y: number };
  out: { x: number; y: number }; door: { x: number; y: number }; entry: { x: number; y: number }; switched: boolean; mist: Phaser.GameObjects.Image | null }

export interface WorldHooks {
  /** The area changed (title, dust motes). */
  onArea: (area: AreaDef) => void;
}

export function preloadOpenWorld(scene: Phaser.Scene): void {
  const L = (k: string, url: string) => { if (!scene.textures.exists(k)) scene.load.image(k, url); };
  for (const id of [START.area, ...neighbours(START.area)]) L(areaTexKey(id), areaTexUrl(id));
  for (const [area, props] of Object.entries(PROP_BOX)) for (const p of Object.keys(props)) L(`prop-${area}-${p}`, `assets/world/props/${area}-${p}.png`);
  for (const [name, a] of Object.entries(ART)) if (!scene.textures.exists(`npc-${name}`)) scene.load.spritesheet(`npc-${name}`, `assets/world/npc/${name}.png`, { frameWidth: a.w, frameHeight: a.h });
  L('mist-band', 'assets/world/fx/mist_band.png');
  L('kit.continue_arrow', KIT('continue_arrow')); L('kit.keycap', KIT('keycap')); L('kit.npc_plate', KIT('npc_plate'));
  L('kit.drop_beam', KIT('drop_beam')); L('kit.marker_portal', KIT('marker_portal'));
  for (const t of Object.values(MARK_TEX)) L(t, KIT(t.slice(4)));
  for (const set of new Set(Object.values(MOB_KINDS).map((k) => k.frames))) preloadMonsterFrames(scene, set);
}

export class OpenWorld {
  area: AreaDef;
  mobs: Monster[] = [];
  transit: Transit | null = null;
  private images = new Map<string, Phaser.GameObjects.Image>();
  private occluders: { img: Phaser.GameObjects.Image; area: string }[] = [];
  /** Areas drawn right now: the one you are in (and the next one while the camera glides over). */
  private shown = new Set<string>();
  private npcs: NpcView[] = [];
  private hints: { img: Phaser.GameObjects.Image; area: string; dir: string; x: number; y: number; t: number }[] = [];
  private prompt: Phaser.GameObjects.Container;
  private promptKey: Phaser.GameObjects.Text;
  private portal: { area: string; x: number; y: number; beam: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Ellipse; glow: Phaser.GameObjects.Image; motes: Phaser.GameObjects.Particles.ParticleEmitter } | null = null;
  private ambience: CourtyardAmbience;
  private mobSeq = 0;
  private t = 0;
  /** The talk / portal prompt target (null = none in reach). */
  near: { kind: 'npc'; npc: AreaNpc } | { kind: 'portal' } | null = null;

  constructor(private scene: Phaser.Scene, private hooks: WorldHooks, startArea = START.area) {
    this.area = AREAS[startArea];
    for (const id of Object.keys(AREAS)) this.ensureArea(id);
    // the rest of the world loads in the background (the start and its neighbours came with the scene)
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    if (!scene.load.isLoading()) scene.load.start();
    this.buildOccluders(); this.buildNpcs(); this.buildHints(); this.buildPortal();
    this.ambience = new CourtyardAmbience(scene, AREA_W, AREA_H);
    const k = scene.add.image(0, 0, 'kit.keycap').setDisplaySize(34, 33);
    this.promptKey = scene.add.text(0, -1, 'Y', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '16px', fontStyle: '700', color: '#ffe9a8', stroke: '#1a1206', strokeThickness: 3, resolution: 2 }).setOrigin(0.5);
    this.prompt = scene.add.container(0, 0, [k, this.promptKey]).setDepth(UI_DEPTH).setVisible(false);
    this.enter(startArea, true);
  }

  // ------------------------------------------------------------------ building
  private onFile(key: string): void { const id = key.startsWith('area-') ? key.slice(5) : ''; if (AREAS[id]) this.ensureArea(id); }

  /** The area's picture at its cell (once its texture is there; queued for loading otherwise). */
  private ensureArea(id: string): void {
    if (this.images.has(id)) return;
    const key = areaTexKey(id);
    if (!this.scene.textures.exists(key)) { this.scene.load.image(key, areaTexUrl(id)); return; }
    const o = areaOrigin(id);
    this.images.set(id, this.scene.add.image(o.x, o.y, key).setOrigin(0, 0).setDepth(-1).setVisible(this.shown.has(id)));
  }

  private buildOccluders(): void {
    for (const [area, props] of Object.entries(PROP_BOX)) {
      const a = AREAS[area]; if (!a) continue;
      const o = areaOrigin(area);
      for (const [pid, [x, y]] of Object.entries(props)) {
        const def = a.props.find((p) => p.id === pid); if (!def) continue;
        const front = Math.max(...def.foot.map((q) => q[1])) + 1;
        this.occluders.push({ img: this.scene.add.image(o.x + x, o.y + y, `prop-${area}-${pid}`).setOrigin(0, 0).setDepth(o.y + front), area });
      }
    }
  }

  private buildNpcs(): void {
    for (const a of Object.values(AREAS)) for (const n of a.npcs ?? []) {
      const art = ART[n.art]; if (!art) continue;
      const p = toWorld(a.id, [n.x, n.y]);
      const sprite = this.scene.add.sprite(p.x, p.y, `npc-${n.art}`, 0).setOrigin(art.ox, art.oy).setScale(1 / art.q).setDepth(p.y).setFlipX(false);
      const shadow = this.scene.add.ellipse(p.x, p.y - 1, 40, 13, 0x000000, 0.32).setDepth(p.y - 0.5);
      const name = this.scene.add.text(p.x, p.y + 20, n.name, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '15px', fontStyle: '700', color: '#ffe28a', stroke: '#140c02', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(p.y + 0.52);
      const plate = this.scene.add.image(p.x, p.y + 20, 'kit.npc_plate').setDisplaySize(name.width + 44, 26).setDepth(p.y + 0.51);
      const title = this.scene.add.text(p.x, p.y + 40, n.title, { fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '12px', color: '#efe3c4', stroke: '#140c02', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(p.y + 0.52);
      const top = p.y - art.h * art.oy / art.q; // head top (world px)
      const mark = this.scene.add.image(p.x, top - 26, MARK_TEX.available).setDisplaySize(15, 42).setDepth(p.y + 0.6).setVisible(false);
      const v: NpcView = { def: n, area: a.id, x: p.x, y: p.y, top, sprite, shadow, plate, name, title, mark, markKind: null, t: Math.random() * 3000 };
      sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.area.id === a.id && !this.transit) this.onNpcClick?.(n); });
      this.npcs.push(v);
    }
  }
  /** Set by the scene: an NPC was clicked. */
  onNpcClick?: (n: AreaNpc) => void;

  private buildHints(): void {
    const ang: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
    for (const a of Object.values(AREAS)) for (const e of a.exits) {
      const xs = e.zone.map((q) => q[0]), ys = e.zone.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const inward = { right: [-34, 0], left: [34, 0], down: [0, -26], up: [0, 30] }[e.dir];
      const p = toWorld(a.id, [cx + inward[0], cy + inward[1] + (e.dir === 'left' || e.dir === 'right' ? 0 : 0)]);
      const img = this.scene.add.image(p.x, p.y, 'kit.continue_arrow').setDisplaySize(22, 31).setAngle(ang[e.dir]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(p.y + 1);
      this.hints.push({ img, area: a.id, dir: e.dir, x: p.x, y: p.y, t: Math.random() * 1000 });
    }
  }

  private buildPortal(): void {
    const a = Object.values(AREAS).find((x) => x.portal); if (!a?.portal) return;
    const p = toWorld(a.id, [a.portal.x, a.portal.y]);
    const ring = this.scene.add.ellipse(p.x, p.y, 92, 30).setStrokeStyle(3, 0xffe2a0, 0.9).setFillStyle(0xffd27a, 0.18).setDepth(p.y - 0.4).setBlendMode(Phaser.BlendModes.ADD);
    const beam = this.scene.add.image(p.x, p.y + 6, 'kit.drop_beam').setOrigin(0.5, 0.92).setDisplaySize(96, 210).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.3).setAlpha(0.85);
    const glow = this.scene.add.image(p.x, p.y - 2, 'kit.marker_portal').setDisplaySize(70, 24).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y - 0.3).setAlpha(0.9);
    if (!this.scene.textures.exists('portal-mote')) {
      const g = this.scene.make.graphics({}, false);
      for (let i = 8; i > 0; i--) g.fillStyle(0xffffff, 0.12 + (8 - i) * 0.1).fillCircle(8, 8, i);
      g.generateTexture('portal-mote', 16, 16); g.destroy();
    }
    const motes = this.scene.add.particles(p.x, p.y, 'portal-mote', {
      speedY: { min: -90, max: -40 }, speedX: { min: -10, max: 10 }, lifespan: { min: 900, max: 1500 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xffe7a8, 0xffd27a], blendMode: 'ADD', frequency: 70,
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 70, 20), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    }).setDepth(p.y + 0.35);
    this.portal = { area: a.id, x: p.x, y: p.y, beam, ring, glow, motes };
  }

  // ------------------------------------------------------------------ areas
  /** Make `id` the current area: floor + props, camera, ambience, monsters, the area's title. */
  /** Only the areas on screen are drawn (pictures, props, the NPC, hints, the portal). */
  private show(ids: string[]): void {
    this.shown = new Set(ids);
    for (const [id, im] of this.images) im.setVisible(this.shown.has(id));
    for (const o of this.occluders) o.img.setVisible(this.shown.has(o.area));
    for (const n of this.npcs) { const v = this.shown.has(n.area); for (const g of [n.sprite, n.shadow, n.plate, n.name, n.title]) g.setVisible(v); n.mark.setVisible(v && !!n.markKind); }
    for (const h of this.hints) h.img.setVisible(this.shown.has(h.area));
    if (this.portal) { const v = this.shown.has(this.portal.area); for (const g of [this.portal.beam, this.portal.ring, this.portal.glow, this.portal.motes]) g.setVisible(v); }
  }

  private enter(id: string, first = false): void {
    this.area = AREAS[id];
    this.show(this.transit ? [this.transit.from, id] : [id]);
    const g = areaGeometry(id); setWorldGeometry(g.walk, g.objects);
    const o = areaOrigin(id);
    this.ambience.moveTo(o.x, o.y);
    this.spawnMobs();
    for (const n of neighbours(id)) this.ensureArea(n);
    if (!this.scene.load.isLoading()) this.scene.load.start();
    this.hooks.onArea(this.area);
    if (first) this.centerCamera();
  }

  centerCamera(): void { const c = this.camCenter(this.area.id); this.scene.cameras.main.centerOn(c.x, c.y); }
  private camCenter(id: string): { x: number; y: number } { const o = areaOrigin(id); return { x: o.x + AREA_W / 2, y: o.y + AREA_H / 2 }; }

  private spawnMobs(): void {
    for (const m of this.mobs) m.destroy();
    this.mobs = [];
    const def = this.area.mobs; if (!def) return;
    const kind = MOB_KINDS[def.kind]; if (!kind) return;
    def.spawns.forEach((s, i) => { const p = toWorld(this.area.id, s); this.mobs.push(new Monster(this.scene, `mob:${this.area.id}:${i}:${++this.mobSeq}`, kind, p, i)); });
  }

  /** Is the player walking out of the area? Then the glide starts (returns true). */
  checkExit(k: Kin): boolean {
    if (this.transit) return true;
    const e = exitAt(this.area.id, k.x, k.y, k.vx, k.vy);
    if (!e || !AREAS[e.to]) return false;
    const back = backExit(this.area.id, e.to);
    const door = toWorld(e.to, back ? back.door : [AREA_W / 2, AREA_H / 2]), entry = toWorld(e.to, back ? back.entry : [AREA_W / 2, AREA_H / 2]);
    const dirv = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[e.dir];
    const out = { x: k.x + dirv[0] * 60, y: k.y + dirv[1] * 60 };
    this.ensureArea(e.to);
    const mist = this.scene.textures.exists('mist-band') ? this.scene.add.image(0, 0, 'mist-band').setDepth(MIST).setAlpha(0) : null;
    if (mist) {
      const oa = areaOrigin(this.area.id), ob = areaOrigin(e.to);
      if (e.dir === 'left' || e.dir === 'right') mist.setPosition(Math.max(oa.x, ob.x), oa.y + AREA_H / 2).setDisplaySize(900, AREA_H * 1.3);
      else mist.setPosition(oa.x + AREA_W / 2, Math.max(oa.y, ob.y)).setAngle(90).setDisplaySize(760, AREA_W * 1.25);
    }
    this.transit = { exit: e, from: this.area.id, to: e.to, t: 0, cam0: this.camCenter(this.area.id), cam1: this.camCenter(e.to), out, door, entry, switched: false, mist };
    this.show([this.area.id, e.to]);
    return true;
  }

  /** One frame of the glide: camera, mist, the player walking out / in (kin moved here). When it ends: the point he
   *  still walks on to (the area's entry for this path); null while it runs. */
  stepTransit(ms: number, k: Kin, setAlpha: (a: number) => void): { x: number; y: number } | null {
    const T = this.transit!; T.t += ms;
    const p = Math.min(1, T.t / GLIDE.ms), e = 0.5 - 0.5 * Math.cos(Math.PI * p);
    this.scene.cameras.main.centerOn(T.cam0.x + (T.cam1.x - T.cam0.x) * e, T.cam0.y + (T.cam1.y - T.cam0.y) * e);
    T.mist?.setAlpha(Math.sin(Math.PI * p) * 0.95);
    this.ambience.setAlpha(Math.abs(1 - 2 * p));
    if (!T.switched && p >= 0.5) { T.switched = true; this.enter(T.to); k.x = T.door.x; k.y = T.door.y; } // under the thickest mist
    const d = Math.hypot(T.entry.x - T.door.x, T.entry.y - T.door.y), reach = Math.min(d, 110);
    if (p < GLIDE.outEnd) { // stepping out
      k.x += (T.out.x - k.x) * Math.min(1, ms / 140); k.y += (T.out.y - k.y) * Math.min(1, ms / 140);
      setAlpha(1 - p / GLIDE.outEnd);
    } else if (p < GLIDE.inStart) setAlpha(0);
    else { // stepping in from the door toward the entry
      const q = (p - GLIDE.inStart) / (1 - GLIDE.inStart);
      k.x = T.door.x + ((T.entry.x - T.door.x) / (d || 1)) * reach * q; k.y = T.door.y + ((T.entry.y - T.door.y) / (d || 1)) * reach * q;
      setAlpha(Math.min(1, q * 1.6));
    }
    k.vx = 0; k.vy = 0;
    if (p < 1) return null;
    T.mist?.destroy(); this.ambience.setAlpha(1); setAlpha(1);
    this.show([this.area.id]);
    this.centerCamera();
    this.transit = null;
    return T.entry;
  }

  /** Walking direction of the glide (for the walk animation and facing). */
  get transitDir(): { x: number; y: number } {
    const T = this.transit; if (!T) return { x: 0, y: 0 };
    const p = T.t / GLIDE.ms;
    if (p < 0.5) { const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[T.exit.dir]; return { x: d[0], y: d[1] }; }
    const dx = T.entry.x - T.door.x, dy = T.entry.y - T.door.y, n = Math.hypot(dx, dy) || 1;
    return { x: dx / n, y: dy / n };
  }

  /** Instant move (portal, respawn): a short fade, then the new area. */
  jumpTo(id: string, x: number, y: number, k: Kin, done?: () => void): void {
    const cam = this.scene.cameras.main;
    cam.fadeOut(260, 255, 244, 220);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.enter(id); this.centerCamera();
      const p = toWorld(id, [x, y]); k.x = p.x; k.y = p.y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true; k.supportZ = 0;
      done?.();
      cam.fadeIn(420, 255, 244, 220);
    });
  }

  // ------------------------------------------------------------------ per frame
  update(ms: number, player: { x: number; y: number; z: number; alive: boolean }): void {
    this.t += ms;
    this.ambience.update(ms);
    // NPCs: idle loop, quest marker bob
    for (const n of this.npcs) {
      n.t += ms;
      const art = ART[n.def.art];
      n.sprite.setFrame(Math.floor(n.t / (art.n > 4 ? 110 : 320)) % art.n);
      n.mark.setPosition(n.x, n.top - 26 + Math.sin(n.t / 380) * 3);
    }
    // exit hints of this area: soft pulse sliding outward, brighter when you are near
    for (const h of this.hints) {
      if (h.area !== this.area.id) { h.img.setAlpha(0); continue; }
      h.t += ms;
      const d = Math.hypot(player.x - h.x, player.y - h.y), near = Math.max(0, 1 - d / 520);
      const s = (h.t % 1400) / 1400, off = s * 10, v = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[h.dir as 'right'];
      h.img.setPosition(h.x + v[0] * off, h.y + v[1] * off).setAlpha((0.25 + 0.55 * near) * Math.sin(Math.PI * s));
    }
    if (this.portal) {
      const P = this.portal, s = Math.sin(this.t / 380);
      P.ring.setScale(1 + 0.05 * s); P.beam.setAlpha(0.72 + 0.18 * s); P.glow.setAngle(this.t / 12).setAlpha(0.75 + 0.2 * s);
    }
    // talk / portal prompt
    this.near = null;
    if (player.alive && !this.transit && player.z < 30) {
      let best = TALK_R;
      for (const n of this.npcs) {
        if (n.area !== this.area.id) continue;
        const d = Math.hypot(player.x - n.x, (player.y - n.y) * 1.4);
        if (d < best) { best = d; this.near = { kind: 'npc', npc: n.def }; }
      }
      if (!this.near && this.portal && this.portal.area === this.area.id && Math.hypot(player.x - this.portal.x, (player.y - this.portal.y) * 1.4) < PORTAL_R) this.near = { kind: 'portal' };
    }
    const nv = this.near?.kind === 'npc' ? this.npcs.find((n) => n.def === (this.near as { npc: AreaNpc }).npc) : null;
    const at = nv ? { x: nv.x + 34, y: nv.top - 4 } : this.near?.kind === 'portal' && this.portal ? { x: this.portal.x, y: this.portal.y - 120 } : null;
    this.prompt.setVisible(!!at);
    if (at) this.prompt.setPosition(at.x, at.y + Math.sin(this.t / 260) * 3);
  }

  setTalkKey(label: string): void { this.promptKey.setText(label || '?'); }

  /** Quest marker over an NPC (set by the scene from the quest states). */
  setNpcMark(id: string, kind: NpcMark): void {
    for (const n of this.npcs) {
      if (n.def.id !== id || n.markKind === kind) continue;
      n.markKind = kind; n.mark.setVisible(!!kind && this.shown.has(n.area));
      if (kind) { n.mark.setTexture(MARK_TEX[kind]); n.mark.setDisplaySize(kind === 'available' ? 15 : 25, 42); }
    }
  }

  /** The minimap of the area you are in (the area's own picture). */
  minimap(player: { x: number; y: number }): { label: string; imageUrl: string; bounds: { minX: number; minY: number; width: number; height: number }; markers: { id: string; kind: 'player' | 'npc' | 'portal'; x: number; y: number }[] } {
    const o = areaOrigin(this.area.id);
    const markers: { id: string; kind: 'player' | 'npc' | 'portal'; x: number; y: number }[] = [{ id: 'local', kind: 'player', x: player.x, y: player.y }];
    for (const n of this.npcs) if (n.area === this.area.id) markers.push({ id: `npc:${n.def.id}`, kind: 'npc', x: n.x, y: n.y });
    if (this.portal && this.portal.area === this.area.id) markers.push({ id: 'portal', kind: 'portal', x: this.portal.x, y: this.portal.y });
    return { label: this.area.name, imageUrl: areaTexUrl(this.area.id), bounds: { minX: o.x, minY: o.y, width: AREA_W, height: AREA_H }, markers };
  }

  destroy(): void {
    this.scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFile, this);
    for (const m of this.mobs) m.destroy();
    this.mobs = [];
    for (const im of this.images.values()) im.destroy();
    this.images.clear();
    for (const o of this.occluders) o.img.destroy();
    for (const n of this.npcs) { n.sprite.destroy(); n.shadow.destroy(); n.plate.destroy(); n.name.destroy(); n.title.destroy(); n.mark.destroy(); }
    for (const h of this.hints) h.img.destroy();
    if (this.portal) { this.portal.beam.destroy(); this.portal.ring.destroy(); this.portal.glow.destroy(); this.portal.motes.destroy(); }
    this.prompt.destroy();
    this.ambience.destroy();
    this.transit?.mist?.destroy(); this.transit = null;
  }
}
