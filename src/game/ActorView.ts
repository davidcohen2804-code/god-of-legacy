// Rendering of one character (local player or remote mirror): body sprite + aligned weapon layer (weapon skins tint the
// real weapon pixels of every frame), z-aware contact shadow, and cosmetic layers on per-frame anchors
// (head / face / back) plus ground auras on the support plane. Feet position = ground (x, y); sprite y = y − z.
import Phaser from 'phaser';
import COS from '../data/cosmetics.json';
import { Dir } from '../world/collision';
import { actorDepth } from '../world/WorldGeometry';
import { ClassKey, PoseFrame, applyPose, SHEET_PATH, BASE_GEOM, baseComplete, ensureWeaponMasks, BaseLook, baseLookLayers, hasOver, overKey, NAKED_LOOK, GearLook, GearPiece, gearLayers, helmKey, loadGear, swingTrail } from './Body';
/** Name plates sit above the world (props in front included), like MapleStory's. */
export const NAME_DEPTH = 90000;
import { DEFAULT_SKIN, toneTexture } from '../characters/Skin';

export type CosSlot = 'head' | 'face' | 'back' | 'weapon' | 'aura' | 'damage' | 'pet' | 'hair' | 'armor' | 'hairstyle' | 'top' | 'gloves' | 'shoes' | 'pants' | 'hat' | 'faceacc' | 'earring' | 'nametag' | 'trail';
export type Equipped = Partial<Record<CosSlot, string>>;

interface CosItem { id: string; type: string; icon: string; runtime?: string; skin?: string; blade?: { w: number; h: number; guard: number; cy: number }; color?: string; fit?: { w: number; lift: number }; ring?: { cy: number }; widths?: number[]; wip?: boolean; fabric?: string; lut?: number[][]; lr?: number[]; hs?: number[][]; box?: number[][]; layers?: string; attachment?: string; cell?: number[]; frames?: number; layout?: string; bbox?: number[][];  parts?: string[]; name: string; desc: string }
export const COSMETICS = Object.fromEntries(Object.entries(COS.classes as unknown as Record<string, CosItem[]>).map(([k, l]) => [k, l.filter((i) => !i.wip)])) as Record<string, CosItem[]>; // wip items stay out of the shop until verified on every frame
export const slotOf = (type: string): CosSlot | null =>
  type === 'head' ? 'head' : type === 'mask' ? 'face' : type === 'cape' || type === 'back' ? 'back'
    : type === 'weapon' || type === 'weapon_animated' || type === 'bow' || type === 'book' ? 'weapon' : type === 'aura' ? 'aura' : type === 'damage' ? 'damage' : type === 'pet' ? 'pet' : type === 'hair' ? 'hair' : type === 'armor' ? 'armor' : type === 'hairstyle' ? 'hairstyle' : type === 'top' ? 'top' : type === 'gloves' ? 'gloves' : type === 'shoes' ? 'shoes' : type === 'pants' ? 'pants' : type === 'hat' ? 'hat' : type === 'faceacc' ? 'faceacc' : type === 'earring' ? 'earring' : type === 'nametag' ? 'nametag' : type === 'trail' ? 'trail' : null;
/** The look needs the weapon-mask sheets right away (a tint weapon skin, or a sword skin on a class without packed masks). */
export function wantsWeaponMasks(cls: string, e: Equipped): boolean {
  const w = e.weapon; if (!w) return false;
  return !!WEAPON_TINT[w] || (!!cosmetic(w)?.blade && cls !== 'warrior');
}
export function cosmetic(id: string): CosItem | undefined { for (const l of Object.values(COSMETICS)) { const f = l.find((i) => i.id === id); if (f) return f; } return undefined; }

/** Weapon skin palettes (tint of the real weapon pixels; `glow` adds an energy edge). */
const WEAPON_TINT: Record<string, { tint: number; glow?: number; rainbow?: boolean }> = {
  war_weapon_obsidian_greatsword: { tint: 0x6a5a8a, glow: 0x9a6aff }, war_weapon_sunblade: { tint: 0xffd36a, glow: 0xffb030 },
  war_weapon_storm_edge: { tint: 0x9ef0ff, glow: 0x4ad8ff },
  mage_book_storm_codex: { tint: 0x6ab8ff, glow: 0x3a8cff }, mage_book_void_tome: { tint: 0xa070ff, glow: 0x7a2aff },
  mage_book_sun_scripture: { tint: 0xffd060, glow: 0xffa020 },
  arch_bow_greatwood: { tint: 0xc08a4a }, arch_bow_sunstring: { tint: 0xffdc70, glow: 0xffc040 }, arch_bow_tempest: { tint: 0x7aff9a, glow: 0x3aff7a },
  sam_katana_crimson: { tint: 0xff4a5a, glow: 0xff2030 }, sam_katana_green_energy: { tint: 0x7affb0, glow: 0x2aff8a },
  sam_katana_prismatic_animated: { tint: 0xffffff, glow: 0xffffff, rainbow: true },
};

/** On-body size targets (world px) for anchored cosmetics. */
const HEAD_SEAT = 0.42; // fitted head items: lower edge this far (× hair width) above the hair's lower edge — on top of the hair, never over the face
const SHEET_K = 108 / 172;
/** Head items per view (down/right/left/up), in body-sheet px relative to the frame's crown point:
 *  dx/dy = anchor, w = item width, ox/oy = anchor inside the item art (fraction), flip = mirror the art. */
type HeadFit = { dx: number; dy: number; w: number; ox: number; oy: number; flip?: boolean; behind?: boolean } | null;
const HEAD_ITEM: Record<'hat' | 'faceacc' | 'earring', HeadFit[]> = {
  hat: [{ dx: 1, dy: 14, w: 74, ox: 0.5, oy: 0.86 }, { dx: 2, dy: 14, w: 74, ox: 0.5, oy: 0.86 }, { dx: -2, dy: 14, w: 74, ox: 0.5, oy: 0.86 }, { dx: 0, dy: 14, w: 74, ox: 0.5, oy: 0.86 }],
  faceacc: [{ dx: 3.5, dy: 38, w: 34, ox: 0.5, oy: 0.5 }, { dx: 9, dy: 40, w: 30, ox: 0.5, oy: 0.5 }, { dx: -10, dy: 40, w: 30, ox: 0.5, oy: 0.5 }, null],
  earring: [{ dx: -12, dy: 47, w: 7, ox: 0.5, oy: 0 }, { dx: -6, dy: 46, w: 7, ox: 0.5, oy: 0 }, { dx: 6, dy: 46, w: 7, ox: 0.5, oy: 0 }, { dx: 20, dy: 46, w: 7, ox: 0.5, oy: 0, behind: true }],
}; // body sheet px → world px
const SKIN_THICK = 1.05; // sword skins: a touch bigger than the base sword
const SIZE: Record<string, number> = { head: 40, face: 18, back: 56, aura: 92 };

/** Cosmetics of the given classes (all classes when omitted: the PvP arena can hold any class). */
export function preloadCosmetics(scene: Phaser.Scene, classes?: readonly string[]): void {
  for (const [cls, list] of Object.entries(COSMETICS)) for (const it of list) {
    if (classes && !classes.includes(cls)) continue;
    if (it.skin && !scene.textures.exists(`cosw-${it.id}`)) scene.load.image(`cosw-${it.id}`, it.skin);
    if (it.fabric && !scene.textures.exists(`cosf-${it.id}`)) scene.load.image(`cosf-${it.id}`, it.fabric);
    if (!it.runtime || scene.textures.exists(`cos-${it.id}`)) continue;
    scene.load.spritesheet(`cos-${it.id}`, it.runtime, { frameWidth: it.cell![0], frameHeight: it.cell![1] });
  }
  if (!scene.textures.exists('contact-shadow')) scene.load.image('contact-shadow', 'assets/final/world/contact_shadow.png');
}

/** Weapon-skin colour (also tints the warrior's light-blade effects). */
/** Equipped damage-number skin: sheet key + per-digit widths (digits 0–9, then the critical burst). */
export function damageSkin(id: string | undefined): { key: string; widths: number[]; cell: number[] } | null { const it = id ? cosmetic(id) : undefined; return it && it.type === 'damage' && it.widths && it.cell ? { key: `cos-${it.id}`, widths: it.widths, cell: it.cell } : null; }
export function skinColor(id: string | undefined): number | null { const c = id ? cosmetic(id)?.color : undefined; return c ? parseInt(c.slice(1), 16) : null; }

/** White (luminance) copy of a sheet, so a tint recolours it fully (skin-coloured light blades). */
export function grayKey(scene: Phaser.Scene, key: string, boost = 1.5): string | null {
  const gk = `${key}-gray`;
  if (scene.textures.exists(gk)) return gk;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key), img = src.getSourceImage() as HTMLImageElement;
  const ct = scene.textures.createCanvas(gk, img.width, img.height); if (!ct) return null;
  const ctx = ct.getContext(); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const l = Math.min(255, Math.max(a[i], a[i + 1], a[i + 2]) * boost); a[i] = a[i + 1] = a[i + 2] = l; }
  ctx.putImageData(d, 0, 0);
  for (const name of src.getFrameNames()) { const f = src.get(name); ct.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  ct.refresh();
  return gk;
}

/** Body sheet with the original blade cut out (built once per sheet, from its blade-only mask). */
/** Body sheet variant: cape fabric painted over the cape pixels (keeps the original shading) and/or the original blade cut out.
 *  Built once per sheet + combination, on first use. */
/** Recolour layers, in paint order (later ones override earlier ones on shared pixels): [slot, mask suffix]. */
/** Recolour layers: [slot, region labels in the packed mask (R channel)]. Later layers override earlier ones. */
const RECOLOR: [CosSlot, number[]][] = [['back', [240]], ['hair', [40]], ['armor', [80, 120, 160]], ['top', [80]], ['gloves', [120]], ['shoes', [160]], ['pants', [200]]];
const maskData = new Map<string, Uint8ClampedArray | 'loading'>();
const imgData = new Map<string, Uint8ClampedArray | 'loading' | 'missing'>();
/** Lazily loaded image pixels (for per-sheet cosmetic layers). undefined while loading, null if the file doesn't exist. */
function lazyPixels(scene: Phaser.Scene, tkey: string, url: string): Uint8ClampedArray | null | undefined {
  const m = imgData.get(tkey);
  if (m === 'loading') return undefined;
  if (m === 'missing') return null;
  if (m) return m;
  const read = () => {
    const im = scene.textures.get(tkey).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(im, 0, 0);
    imgData.set(tkey, x.getImageData(0, 0, im.width, im.height).data);
  };
  if (scene.textures.exists(tkey)) { read(); return imgData.get(tkey) as Uint8ClampedArray; }
  imgData.set(tkey, 'loading');
  scene.load.image(tkey, url);
  scene.load.once(`filecomplete-image-${tkey}`, read);
  scene.load.once(`loaderror`, (f: Phaser.Loader.File) => { if (f.key === tkey) imgData.set(tkey, 'missing'); });
  if (!scene.load.isLoading()) scene.load.start();
  return undefined;
}
/** Worn pieces painted into the body art per sheet (hairstyle, hat, face, earring): drawn for this exact frame, in paint order. */
const WORN: CosSlot[] = ['hairstyle', 'hat', 'faceacc', 'earring'];
const sheetName = (path: string) => (path.includes('/skills/') ? path.split('/').slice(-2, -1)[0] : path.split('/').pop()!.replace('.png', ''));

/** Packed per-sheet mask (R = region, G = sword cut), loaded on first need. */
function sheetMask(scene: Phaser.Scene, key: string): Uint8ClampedArray | null {
  const m = maskData.get(key);
  if (m === 'loading') return null;
  if (m) return m;
  const path = SHEET_PATH[key]; if (!path) return null;
  const mk = `${key}-m`;
  const read = () => {
    const im = scene.textures.get(mk).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(im, 0, 0);
    maskData.set(key, x.getImageData(0, 0, im.width, im.height).data);
  };
  if (scene.textures.exists(mk)) { read(); return maskData.get(key) as Uint8ClampedArray; }
  maskData.set(key, 'loading');
  scene.load.image(mk, path.replace('.png', '_m.png'));
  scene.load.once(`filecomplete-image-${mk}`, read);
  scene.load.once('loaderror', () => maskData.delete(key));
  if (!scene.load.isLoading()) scene.load.start();
  return null;
}
/** Body sheet variant: cape fabric, hair/armor/cloth recolours (own shading through the item's colour ramp) and the original
 *  sword cut out — one pass over the sheet, built once per combination. null while the sheet's mask is still loading. */
function bodyVariant(scene: Phaser.Scene, key: string, wkey: string, cut: boolean, capeId: string | null, rec: (string | null)[] = [], worn: (string | null)[] = []): string | null {
  const vk = `${key}${capeId ? `|${capeId}` : ''}${rec.map((r) => (r ? `|${r}` : '')).join('')}${worn.map((r) => (r ? `|${r}` : '')).join('')}${cut ? '-nb' : ''}`;
  if (scene.textures.exists(vk)) return vk;
  if (!scene.textures.exists(key)) return null;
  const layers: Uint8ClampedArray[] = [];
  for (const id of worn) {
    if (!id || !SHEET_PATH[key]) continue;
    const it = cosmetic(id); if (!it?.layers) continue;
    const px = lazyPixels(scene, `cosl-${id}-${key}`, `${it.layers}${BASE_GEOM[key] ? '/base' : ''}/${sheetName(SHEET_PATH[key])}.png`); // base body: pieces fitted to the base frames
    if (px === undefined) return null; // still loading
    if (px) layers.push(px);
  }
  const mask = sheetMask(scene, key);
  if (!mask) { // no packed mask (other classes) or still loading: sword cut from the raw blade mask only
    if (SHEET_PATH[key]) return null;
    if (!cut || !scene.textures.exists(wkey)) return null;
  }
  const src = scene.textures.get(key), img = src.getSourceImage() as HTMLImageElement, W = img.width, H = img.height;
  const ct = scene.textures.createCanvas(vk, W, H); if (!ct) return null;
  const ctx = ct.getContext(); ctx.drawImage(img, 0, 0);
  if (mask) {
    const d = ctx.getImageData(0, 0, W, H), a = d.data;
    const lab = new Int16Array(256).fill(-1); // region label → ramp index
    const ramps: number[][][] = [];
    const geom = BASE_GEOM[key]; // base body strip: masks match, worn layers still have the armour sheet's geometry
    const lrs: number[][] = []; // per-ramp luminance range of the source material (beginner clothes); default 12..187
    RECOLOR.forEach(([slot, labels], ri) => { if (geom && slot === 'armor') return; const it = rec[ri] ? cosmetic(rec[ri]!) : undefined; if (it?.lut) { ramps[ri] = it.lut; lrs[ri] = it.lr ?? [12, 187]; for (const l of labels) lab[l] = ri; } });
    let fab: Uint8ClampedArray | null = null, FW = 0, FH = 0;
    if (capeId && scene.textures.exists(`cosf-${capeId}`)) {
      const fimg = scene.textures.get(`cosf-${capeId}`).getSourceImage() as HTMLImageElement; FW = fimg.width; FH = fimg.height;
      const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH; const fx = fc.getContext('2d')!; fx.drawImage(fimg, 0, 0); fab = fx.getImageData(0, 0, FW, FH).data;
    }
    const S = FW / 130; // one fabric tile ≈ 130 sheet px (≈80 px on screen)
    for (let i = 0, p = 0; i < a.length; i += 4, p++) {
      if (a[i + 3] === 0) continue;
      if (cut && mask[i + 1] > 127) { a[i + 3] = 0; continue; }
      const r = mask[i];
      if (r === 0) continue;
      if (r === 240) {
        if (!fab) continue;
        const x = p % W, y = (p - x) / W, shade = Math.min(1.5, Math.max(0.25, a[i] / 170)); // the red cape's own folds and shadows
        const fi = ((Math.floor(y * S) % FH) * FW + (Math.floor(x * S) % FW)) * 4;
        a[i] = Math.min(255, fab[fi] * shade); a[i + 1] = Math.min(255, fab[fi + 1] * shade); a[i + 2] = Math.min(255, fab[fi + 2] * shade);
        continue;
      }
      // the most specific slot wins (top/gloves/shoes over the full armor finish)
      let ri = -1; for (let k = RECOLOR.length - 1; k >= 0; k--) if (ramps[k] && RECOLOR[k][1].includes(r)) { ri = k; break; }
      if (ri < 0) continue;
      const lut = ramps[ri], n = lut.length, lr = lrs[ri], l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2], q = Math.max(0, Math.min(n - 1, Math.floor(((l - lr[0]) / (lr[1] - lr[0])) * n)));
      a[i] = lut[q][0]; a[i + 1] = lut[q][1]; a[i + 2] = lut[q][2];
    }
    void lab;
    for (const L of layers) for (let i = 0; i < a.length && L.length === a.length; i += 4) { // worn pieces (same size as the sheet): magenta = hair hidden under the piece, else alpha-over
      const li = i; // base pieces share the base strip geometry
      const la = L[li + 3]; if (la === 0) continue;
      if (L[li] === 255 && L[li + 1] === 0 && L[li + 2] === 255) { a[i + 3] = 0; continue; }
      const t = la / 255, u = 1 - t, ba = a[i + 3] / 255, oa = t + ba * u;
      a[i] = (L[li] * t + a[i] * ba * u) / oa; a[i + 1] = (L[li + 1] * t + a[i + 1] * ba * u) / oa; a[i + 2] = (L[li + 2] * t + a[i + 2] * ba * u) / oa; a[i + 3] = oa * 255;
    }
    ctx.putImageData(d, 0, 0);
  } else if (cut) {
    const wimg = scene.textures.get(wkey).getSourceImage() as HTMLImageElement;
    ctx.globalCompositeOperation = 'destination-out';
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(wimg, dx, dy);
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const name of src.getFrameNames()) { const f = src.get(name); ct.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  ct.refresh();
  return vk;
}

const DIR_COL: Record<Dir, number> = { down: 0, right: 1, left: 2, up: 3 };
/** Head-item fit per view (down/right/left/up): width = hair width × w; lower edge = hair bottom + b × hair width; dx = forward shift. */
const HEAD_FIT = [{ w: 1.3, b: 0.12, dx: 0 }, { w: 1.32, b: 0.12, dx: 0.04 }, { w: 1.32, b: 0.12, dx: 0.04 }, { w: 1.4, b: 0.18, dx: 0 }];

/** The worn pieces over the body frame: pants, boots, shirt under the face and hair; the shirt again over the sword arm
 *  drawn over the hair; the sword in hand on top. */
const GEAR_DEPTH: Record<GearPiece, number> = { pants: 0.001, shoes: 0.0013, top: 0.0016, topo: 0.0085, sword: 0.009 };

export class ActorView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly weapon: Phaser.GameObjects.Sprite;
  readonly weaponGlow: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  /** Team ring on the floor (DFO-style): readable position even under heavy effects. */
  readonly ring: Phaser.GameObjects.Ellipse;
  private layers: Partial<Record<CosSlot, Phaser.GameObjects.Image>> = {};
  /** Warrior sword skin: drawn along the real sword line of every frame (never drifts off the hand). */
  private blade: Phaser.GameObjects.Image | null = null;
  /** Same sword, cropped from the guard forward, drawn over the body (the handle stays under the fist). */
  private bladeTop: Phaser.GameObjects.Image | null = null;
  private equipped: Equipped = {};
  /** Base strips whose dressed variant is still to be built (one per frame after equipping), so an item never blinks off
   *  the first time an animation plays. */
  private warm: string[] = [];
  private warmTries = new Map<string, number>();
  private t = 0;
  /** Floating companion: trails the hero with a soft lag. */
  private petPos: { x: number; y: number } | null = null;
  /** Name plate under the feet (MapleStory style); framed when a name-tag item is equipped. */
  private nameText: Phaser.GameObjects.Text | null = null;
  private nameFrame: Phaser.GameObjects.Image | null = null;
  /** The default kit name plate (no name-tag item): sized to the name, not to the item art. */
  private plainPlate = false;
  private trailT = 0; private lastFeet: { x: number; y: number } | null = null;
  setName(name: string): void {
    this.nameText?.destroy();
    this.nameText = this.scene.add.text(0, 0, name, { fontFamily: 'Inter, Arial, sans-serif', fontSize: '12.5px', fontStyle: '600', color: '#ffffff', stroke: '#000000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5);
    this.refreshNameFrame();
  }
  private refreshNameFrame(): void {
    this.nameFrame?.destroy(); this.nameFrame = null;
    if (!this.nameText) return;
    const id = this.equipped.nametag;
    if (id && this.scene.textures.exists(`cos-${id}`)) this.nameFrame = this.scene.add.image(0, 0, `cos-${id}`);
    else if (this.scene.textures.exists('kit.player_plate')) { this.nameFrame = this.scene.add.image(0, 0, 'kit.player_plate'); this.plainPlate = true; return; } // default name plate
    this.plainPlate = false;
  }
  visible = true;
  /** Height of the top of the head above the feet (world px), smoothed over frames (speech bubbles sit above it). */
  headHeight = 0;
  /** The base character's look (hairstyle, hair colour, skin tone, face): layers on every frame, MapleStory-style —
   *  back hair behind the body, then on the head (moving with it) the face, the forehead between the bangs and the front
   *  hair, and the sword arm again where it passes in front of the head. */
  private look: BaseLook | null = null;
  private lookParts: { b: Phaser.GameObjects.Image; face: Phaser.GameObjects.Image; eyes: Phaser.GameObjects.Image; gap: Phaser.GameObjects.Image; f: Phaser.GameObjects.Image; helm: Phaser.GameObjects.Image; over: Phaser.GameObjects.Sprite } | null = null;
  /** Worn gear (equipment): the clothes and the sword drawn on every frame of the base character. */
  private gearW: GearLook | null = null;
  private gearParts: Partial<Record<GearPiece, Phaser.GameObjects.Sprite>> = {};
  /** The sword is not drawn (set by the owner: Judgment Blade's leap, between its throws and on the way down). */
  swordOff = false;
  /** A regular attack's swing: the sword's afterimage (MapleStory), drawn with the character, fading fast. */
  private trails: { g: Phaser.GameObjects.Graphics; age: number; life: number; a0: number }[] = [];
  private lastSwing: { anim: string; frame: number } | null = null;
  setGear(w: GearLook | null, gender: 'male' | 'female' = 'male'): void {
    this.gearW = w ? { ...w } : null;
    if (w) this.ensureLookParts();
    loadGear(this.scene, gender, this.gearW, true); // the worn pieces' strips (drawn once they arrive)
  }
  private ensureLookParts(): void {
    if (this.lookParts) return;
    const im = () => this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.lookParts = { b: im(), face: im(), eyes: im(), gap: im(), f: im(), helm: im(), over: this.scene.add.sprite(0, 0, '__DEFAULT').setVisible(false) };
  }
  setBaseLook(l: BaseLook | null, gender: 'male' | 'female' = 'male'): void {
    this.look = l ? { ...l } : null;
    if (l) this.ensureLookParts();
    if (l && l.skin !== DEFAULT_SKIN && NAKED_LOOK[gender]) for (const k of this.scene.textures.getTextureKeys()) // re-shade the moves now, not on their first frame
      if (k.startsWith(`naked-${gender}-`) && !k.includes('~')) toneTexture(this.scene, k, l.skin);
  }

  constructor(private scene: Phaser.Scene, readonly cls: ClassKey, x: number, y: number) {
    this.shadow = scene.add.image(x, y, 'contact-shadow').setOrigin(0.5, 0.5);
    this.ring = scene.add.ellipse(x, y, 70, 26).setStrokeStyle(3, 0x4aa8ff, 0.85).setFillStyle(0x4aa8ff, 0.1);
    this.sprite = scene.add.sprite(x, y, '__DEFAULT');
    this.weapon = scene.add.sprite(x, y, '__DEFAULT').setVisible(false);
    this.weaponGlow = scene.add.sprite(x, y, '__DEFAULT').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
  }

  setRing(color: number): void { this.ring.setStrokeStyle(3, color, 0.85).setFillStyle(color, 0.1); }

  setEquipped(e: Equipped): void {
    this.equipped = { ...e };
    const first = ['walk', 'run', 'jump', 'warrior_basic', 'react', 'air_attack'].map((a) => `base-warrior-${a}`); // the common moves first
    this.warm = [...first.filter((k) => BASE_GEOM[k]), ...Object.keys(BASE_GEOM).filter((k) => !first.includes(k))]; this.warmTries.clear();
    for (const s of Object.keys(this.layers) as CosSlot[]) { this.layers[s]?.destroy(); delete this.layers[s]; }
    this.blade?.destroy(); this.blade = null; this.bladeTop?.destroy(); this.bladeTop = null;
    this.refreshNameFrame();
    const wi = e.weapon ? cosmetic(e.weapon) : undefined;
    if (wi?.blade && this.scene.textures.exists(`cosw-${wi.id}`)) {
      this.blade = this.scene.add.image(0, 0, `cosw-${wi.id}`);
      const cut = Math.max(0, wi.blade.guard - wi.blade.h * 0.18); // keep the guard on top, the grip goes under the hand
      this.bladeTop = this.scene.add.image(0, 0, `cosw-${wi.id}`).setCrop(cut, 0, wi.blade.w - cut, wi.blade.h);
    }
    for (const [slot, id] of Object.entries(e) as [CosSlot, string][]) {
      if (!id || cosmetic(id)?.layers || slot === 'weapon' || slot === 'damage' || slot === 'hair' || slot === 'armor' || slot === 'top' || slot === 'gloves' || slot === 'shoes' || slot === 'pants' || slot === 'nametag' || slot === 'trail') continue;
      const it = cosmetic(id);
      if (!it || !this.scene.textures.exists(`cos-${id}`)) continue;
      const img = this.scene.add.image(0, 0, `cos-${id}`, 0);
      if (slot === 'aura') img.setBlendMode(Phaser.BlendModes.ADD);
      this.layers[slot] = img;
    }
  }

  get equippedItems(): Equipped { return this.equipped; }

  /** Fashion (top / pants / shoes) is drawn on the beginner base body, not on the class armour. */
  /** Warrior = sword only, no shield: the base body is his default look once every animation is baked; until then fashion turns it on. */
  /** Body sprite + its cross-fade ghost (presentation motion layers move both). */
  get motionSprites(): Phaser.GameObjects.Sprite[] { return [this.sprite]; } // presentation motion layers move the body
  get wantsBase(): boolean { return baseComplete(this.cls) || !!(this.equipped.top || this.equipped.pants || this.equipped.shoes); }

  /** Render one frame. pose = resolved body frame; x/y = ground feet; z = height; supportZ = surface under the feet. */
  render(ms: number, pose: PoseFrame, x: number, y: number, z: number, supportZ: number, dir: Dir, alpha = 1, tint: number | null = null, tintFill = false): void {
    this.t += ms;
    const p = this.sprite;
    if (pose.naked && this.look && this.look.skin !== DEFAULT_SKIN) { const tk = toneTexture(this.scene, pose.key, this.look.skin); if (tk) pose = { ...pose, key: tk }; } // the body in its skin tone
    const top = pose.anchor ? -pose.anchor[1] : 100;
    this.headHeight = this.headHeight ? this.headHeight + (top - this.headHeight) * Math.min(1, ms / 90) : top;
    // Weapon masks load on first need: a tint skin draws them, a sword skin cuts with them (classes without a packed mask).
    if ((WEAPON_TINT[this.equipped.weapon ?? ''] || (this.blade && !SHEET_PATH[pose.key])) && !this.scene.textures.exists(pose.wkey)) ensureWeaponMasks(this.scene, this.cls);
    applyPose(p, pose, this.weapon);
    const depth = actorDepth(x, y, z);
    p.setPosition(x, y - z).setDepth(depth).setAlpha(alpha).setVisible(this.visible);
    if (tint === null) p.clearTint(); else if (tintFill) p.setTintFill(tint); else p.setTint(tint);
    // Contact shadow on the support plane, smaller/fainter with height above it.
    const h = Math.max(0, z - supportZ), k = Math.max(0.35, 1 - h / 140);
    this.ring.setPosition(x, y - supportZ + 2).setDepth(actorDepth(x, y, supportZ) - 0.65).setAlpha(alpha * k).setScale(k).setVisible(this.visible);
    this.shadow.setPosition(x, y - supportZ + 1).setDepth(actorDepth(x, y, supportZ) - 0.6).setScale(0.42 * k, 0.4 * k).setAlpha(alpha * (0.9 * k)).setVisible(this.visible);
    // Sword skin (warrior): original blade cut out of this frame, the new sword laid on the frame's hilt→tip line.
    const capeId = this.equipped.back && cosmetic(this.equipped.back)?.fabric ? this.equipped.back : null;
    const rec = RECOLOR.map(([sl]) => { const id = this.equipped[sl]; return id && cosmetic(id)?.lut ? id : null; });
    let ready = true;
    const worn = WORN.map((sl) => { const id = this.equipped[sl]; return id && cosmetic(id)?.layers ? id : null; });
    const dressed = !!this.blade || !!capeId || rec.some((r) => r) || worn.some((r) => r);
    if (dressed) { const vk = bodyVariant(this.scene, pose.key, pose.wkey, !!this.blade, capeId, rec, worn); if (vk) p.setTexture(vk, pose.frame); else ready = false; }
    if (dressed && this.wantsBase && this.warm.length) { // build the other animations' variants ahead, one per frame
      const k = this.warm.shift()!, n = (this.warmTries.get(k) ?? 0) + 1;
      if (!bodyVariant(this.scene, k, `${k}-w`, !!this.blade, capeId, rec, worn) && n < 600) { this.warmTries.set(k, n); this.warm.push(k); }
    }
    if (this.blade && !ready) { this.blade.setVisible(false); this.bladeTop?.setVisible(false); } // mask still loading: keep the original sword for a moment
    else if (this.blade) {
      const bi = cosmetic(this.equipped.weapon!)!.blade!, bl = pose.blade;
      if (bl && this.visible) {
        const dx = bl[2] - bl[0], dy = bl[3] - bl[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), flip = Math.cos(ang) < 0;
        const bladePx = bi.w - bi.guard, sx = (L * 0.98) / bladePx, sy = (52 * SKIN_THICK) / bladePx;
        const gx = p.x + bl[0], gy = p.y + bl[1]; // guard on the real hilt point
        for (const [im, top] of [[this.blade, false], [this.bladeTop!, true]] as const) {
          im.setOrigin(bi.guard / bi.w, (flip ? bi.h - bi.cy : bi.cy) / bi.h).setFlipY(flip).setRotation(ang).setScale(sx, sy)
            .setPosition(gx, gy).setDepth(top ? depth + 0.02 : depth - 0.01).setAlpha(alpha).setVisible(!(top && pose.bladeBehind));
          if (tint === null) im.clearTint(); else if (tintFill) im.setTintFill(tint); else im.setTint(tint);
        }
      } else { this.blade.setVisible(false); this.bladeTop?.setVisible(false); }
    }
    // MapleStory: frame by frame, no blending between the body's frames
    this.renderLook(pose, depth, alpha, tint, tintFill);
    const nk = pose.naked; // the swing reached its strike / follow-through: the blade's afterimage from the frame before
    if (nk?.swing && this.visible && this.gearW?.weapon && !this.swordOff && this.lastSwing?.anim === nk.anim && nk.frame === this.lastSwing.frame + 1) this.addTrail(nk.g, nk.anim, this.lastSwing.frame, nk.frame, pose); // (a sword in hand)
    this.lastSwing = nk?.swing ? { anim: nk.anim, frame: nk.frame } : null;
    this.trails = this.trails.filter((t) => {
      t.age += ms;
      if (t.age >= t.life || !this.visible) { t.g.destroy(); return false; }
      t.g.setPosition(p.x, p.y).setDepth(depth + 0.0095).setAlpha(alpha * t.a0 * (1 - t.age / t.life));
      return true;
    });
    // Weapon skin: tinted copy of the real weapon pixels of this exact frame.
    const ws = this.equipped.weapon ? WEAPON_TINT[this.equipped.weapon] : undefined;
    const showW = !!ws && this.visible && this.scene.textures.exists(pose.wkey);
    this.weapon.setVisible(showW);
    this.weaponGlow.setVisible(showW && !!ws?.glow);
    if (showW && ws) {
      const tintC = ws.rainbow ? Phaser.Display.Color.HSVToRGB(((this.t / 1400) % 1), 0.75, 1).color : ws.tint;
      this.weapon.setPosition(p.x, p.y).setDepth(depth + 0.02).setTint(tintC).setAlpha(alpha);
      if (ws.glow) {
        if (this.weaponGlow.texture.key !== pose.wkey || this.weaponGlow.frame.name !== String(pose.frame)) this.weaponGlow.setTexture(pose.wkey, pose.frame);
        this.weaponGlow.setFlipX(!!pose.flip);
        const g = ws.rainbow ? tintC : ws.glow;
        this.weaponGlow.setOrigin(pose.ox, pose.oy).setScale(pose.scale * 1.04).setPosition(p.x, p.y).setDepth(depth + 0.03).setTint(g)
          .setAlpha(alpha * (0.45 + 0.2 * Math.sin(this.t / 180)));
      }
    }
    // Name plate + running trail.
    if (this.nameText) {
      const ny = y - supportZ + 22, d0 = NAME_DEPTH + y * 0.001; // names stay readable over blocks and urns in front
      this.nameText.setPosition(x, ny).setDepth(d0 + 0.01).setAlpha(alpha).setVisible(this.visible);
      if (this.nameFrame) {
        if (this.plainPlate) this.nameFrame.setDisplaySize(this.nameText.width + 60, 27); // name clear of the end gems
        else { const w = Math.max(96, this.nameText.width + 54); this.nameFrame.setDisplaySize(w, w * (this.nameFrame.height / this.nameFrame.width) * 1.0); }
        this.nameFrame.setPosition(x, ny).setDepth(d0).setAlpha(alpha).setVisible(this.visible);
      }
    }
    const tr = this.equipped.trail;
    if (tr && this.visible && this.scene.textures.exists(`cos-${tr}`)) {
      const lf = this.lastFeet, moved = lf ? Math.hypot(x - lf.x, y - lf.y) : 0; this.lastFeet = { x, y };
      this.trailT += ms;
      if (moved > 2.2 * (ms / 16.7) && z - supportZ < 4 && this.trailT > 95) {
        this.trailT = 0;
        const it = cosmetic(tr)!, n = it.frames ?? 6, t = this.scene.add.image(x + (Math.random() - 0.5) * 10, y - supportZ + 2, `cos-${tr}`, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(actorDepth(x, y, supportZ) - 0.62).setScale(0.42);
        let f = 0; const ev = this.scene.time.addEvent({ delay: 85, repeat: n - 1, callback: () => { f++; if (f >= n) { t.destroy(); return; } t.setFrame(f); } });
        void ev;
      }
    }
    // Anchored cosmetics.
    const a = pose.anchor;
    for (const [slot, img] of Object.entries(this.layers) as [CosSlot, Phaser.GameObjects.Image][]) {
      const it = cosmetic(this.equipped[slot]!)!;
      if (slot === 'hat' || slot === 'faceacc' || slot === 'earring') { // on this frame's head: offset from the crown, turned with the head tilt
        const hd = pose.head, col = DIR_COL[dir], f = HEAD_ITEM[slot][col];
        if (!hd || !f) { img.setVisible(false); continue; }
        const frame = Math.min(col, (it.frames ?? 1) - 1), bx = it.box?.[frame] ?? [it.cell![0], it.cell![1], 0, 0];
        const k = SHEET_K, sc = (f.w * k) / bx[0], a = (hd[2] * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
        const ox = f.dx * k, oy = f.dy * k; // crown-relative point, rotated with the head
        img.setFrame(frame).setOrigin((bx[2] + bx[0] * f.ox) / it.cell![0], (bx[3] + bx[1] * f.oy) / it.cell![1]).setScale(sc).setFlipX(!!f.flip)
          .setPosition(p.x + hd[0] + ox * ca - oy * sa, p.y + hd[1] + ox * sa + oy * ca).setAngle(hd[2])
          .setDepth(depth + (slot === 'hat' ? 0.045 : slot === 'earring' && f.behind ? -0.01 : 0.04)).setAlpha(alpha).setVisible(this.visible);
        if (tint === null) img.clearTint(); else if (tintFill) img.setTintFill(tint); else img.setTint(tint);
        continue;
      }
      if (slot === 'hairstyle') { // fitted to this frame's head: crown point + head tilt (follows looking up, bowing, lying down)
        const hd = pose.head, v = it.hs?.[DIR_COL[dir]];
        if (!hd || !v) { img.setVisible(false); continue; }
        const col = DIR_COL[dir], k = SHEET_K;
        img.setFrame(col).setOrigin(v[0], v[1]).setScale(v[2] * k)
          .setPosition(p.x + hd[0] + v[4] * k, p.y + hd[1] - v[3] * k).setAngle(hd[2])
          .setDepth(dir === 'up' ? depth + 0.04 : depth + 0.035).setAlpha(alpha).setVisible(this.visible);
        const hl = this.equipped.hair ? cosmetic(this.equipped.hair)?.lut : undefined; // hair colour applies to the hairstyle too
        const want = hl ? grayKey(this.scene, `cos-${it.id}`, 1.25) ?? `cos-${it.id}` : `cos-${it.id}`;
        if (img.texture.key !== want) img.setTexture(want, col);
        if (tint !== null) { if (tintFill) img.setTintFill(tint); else img.setTint(tint); }
        else if (hl) { const c = hl[Math.floor(hl.length * 0.62)]; img.setTint((c[0] << 16) | (c[1] << 8) | c[2]); } else img.clearTint();
        continue;
      }
      if (slot === 'pet') { // hovers behind the shoulder, follows with a lag, gentle bob
        const n = it.frames ?? 8, side = dir === 'left' ? 1 : dir === 'right' ? -1 : -0.8;
        const tx = x + side * 38, ty = y - z - 104 + Math.sin(this.t / 420) * 6;
        if (!this.petPos) this.petPos = { x: tx, y: ty };
        const f = Math.min(1, ms / 140); this.petPos.x += (tx - this.petPos.x) * f; this.petPos.y += (ty - this.petPos.y) * f;
        img.setFrame(Math.floor((this.t * 9) / 1000) % n).setScale(40 / (it.cell?.[0] ?? 160) * 1.6).setFlipX(dir === 'left')
          .setPosition(this.petPos.x, this.petPos.y).setDepth(dir === 'up' ? depth + 0.06 : depth - 0.06).setAlpha(alpha).setVisible(this.visible);
        continue;
      }
      if (slot === 'aura') {
        const n = it.frames ?? 8;
        img.setFrame(Math.floor((this.t * 8) / 1000) % n);
        const s = (it.ring ? 138 : SIZE.aura) / ((it.bbox?.[0][2] ?? 128) - (it.bbox?.[0][0] ?? 0));
        if (it.ring) img.setOrigin(0.5, it.ring.cy); // ring centred on the feet, particles rise above it
        img.setScale(s).setPosition(x, y - supportZ - (it.ring ? 0 : 12)).setDepth(actorDepth(x, y, supportZ) - 0.7).setAlpha(alpha * 0.9).setVisible(this.visible);
        continue;
      }
      if (!a) { img.setVisible(false); continue; }
      const col = DIR_COL[dir], bb = it.bbox?.[col] ?? it.bbox?.[0] ?? [0, 0, 128, 128];
      img.setFrame(col);
      const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
      const cell = it.cell![0];
      // Item art centre inside its cell (fraction) → origin so the item centre lands on the anchor.
      const cx = (bb[0] + bb[2]) / 2 / cell, cy = (bb[1] + bb[3]) / 2 / cell;
      let ax: number, ay: number, s: number, d = depth + 0.05, show = this.visible;
      if (slot === 'head' && pose.hair) {
        // Fitted to this frame's head: covers the hair box (stable per-direction width), seated by its lower edge.
        const [hcx, hw, hb] = pose.hair, f = HEAD_FIT[col];
        if (it.fit) { // one scale for all views (from the front view), seated on the hair line, optional float (halo)
          const fb = it.bbox![0]; s = (hw * f.w * it.fit.w) / (fb[2] - fb[0]); ax = hcx + f.dx * hw * (dir === 'left' ? -1 : 1); ay = hb - HEAD_SEAT * hw - (bh * s) / 2 - it.fit.lift * hw;
        } else { s = (hw * f.w) / bw; ax = hcx + f.dx * hw * (dir === 'left' ? -1 : 1); ay = hb + f.b * hw - (bh * s) / 2; }
      } else if (slot === 'head') { s = SIZE.head / Math.max(bw, bh * 0.9); ax = a[2]; ay = a[1] + (bh * s) * 0.42; }
      else if (slot === 'face') { s = SIZE.face / bw; ax = a[2] + (dir === 'right' ? 3 : dir === 'left' ? -3 : 0); ay = a[1] + (a[6] ?? 100) * 0.2; show = show && dir !== 'up'; }
      else { // back
        s = SIZE.back / Math.max(bh, 1);
        const side = dir === 'right' ? -1 : dir === 'left' ? 1 : 0;
        ax = a[4] + side * 7; ay = a[5] + (bh * s) * 0.3;
        d = dir === 'up' ? depth + 0.04 : depth - 0.04; // a cape/quiver is behind the body unless seen from the back
      }
      img.setOrigin(cx, cy).setScale(s).setPosition(p.x + ax, p.y + ay).setDepth(d).setAlpha(alpha).setVisible(show);
    }
  }

  /** The look's layers on this frame: the idle cell's head moved to this frame's head (naked-heads.json), same origin,
   *  scale and mirroring as the body; skin layers in the skin tone. */
  private renderLook(pose: PoseFrame, depth: number, alpha: number, tint: number | null, tintFill: boolean): void {
    const P = this.lookParts; if (!P) return;
    const nk = pose.naked, l = this.look, p = this.sprite;
    if (!nk || (!l && !this.gearW) || !this.visible) { for (const im of [...Object.values(P), ...Object.values(this.gearParts)]) im?.setVisible(false); return; }
    const L = l ? baseLookLayers(nk.g, l) : {}, fx = pose.flip ? -1 : 1, skin = l?.skin ?? DEFAULT_SKIN;
    const hx = p.x + nk.hx * p.scaleX * fx, hy = p.y + nk.hy * p.scaleY;
    const put = (im: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, key: string | null, x: number, y: number, d: number, frame?: number) => {
      if (!key) { im.setVisible(false); return; }
      if (im.texture.key !== key || (frame !== undefined && im.frame.name !== String(frame))) im.setTexture(key, frame);
      im.setOrigin(pose.ox, pose.oy).setScale(p.scaleX, p.scaleY).setFlipX(!!pose.flip).setPosition(x, y).setDepth(depth + d).setAlpha(alpha).setVisible(true);
      if (tint === null) im.clearTint(); else if (tintFill) im.setTintFill(tint); else im.setTint(tint);
    };
    const has = (kf?: [string, string]) => (kf && this.scene.textures.exists(kf[0]) ? kf[0] : null);
    const tone = (k: string | null) => (k ? toneTexture(this.scene, k, skin) : null);
    put(P.b, has(L.b), hx, hy, -0.005);
    put(P.face, tone(has(L.face)), hx, hy, 0.003);
    put(P.eyes, has(L.eyes), hx, hy, 0.0035); // the eye colour: the irises over the face (not skin: not re-shaded)
    put(P.gap, tone(has(L.gap)), hx, hy, 0.004);
    put(P.f, has(L.f), hx, hy, 0.006);
    const hk = this.gearW?.helm ? helmKey(nk.g, this.gearW.helm) : null; // a head piece over the hair (it moves with the head)
    put(P.helm, hk && this.scene.textures.exists(hk) ? hk : null, hx, hy, 0.0065);
    const ok = hasOver(nk.g, nk.anim) && this.scene.textures.exists(overKey(nk.g, nk.anim));
    put(P.over, ok ? tone(overKey(nk.g, nk.anim)) : null, p.x, p.y, 0.008, nk.frame);
    // worn gear on this very frame: pants, boots, shirt over the body (under the face and hair); the shirt's sleeve again over
    // the sword arm drawn over the hair; the sword in hand on top
    const want = new Map(gearLayers(nk.g, nk.anim, this.gearW));
    if (nk.bare || this.swordOff) want.delete('sword'); // a skill played with the hand free (Judgment Blade, through its whole leap)
    for (const piece of ['pants', 'shoes', 'top', 'topo', 'sword'] as GearPiece[]) {
      const k = want.get(piece), have = !!k && this.scene.textures.exists(k) && (piece !== 'topo' || ok);
      let sp = this.gearParts[piece];
      if (!have) { sp?.setVisible(false); continue; }
      if (!sp) sp = this.gearParts[piece] = this.scene.add.sprite(0, 0, '__DEFAULT');
      put(sp, k!, p.x, p.y, GEAR_DEPTH[piece], nk.frame);
    }
  }

  setVisible(v: boolean): void {
    if (!v && this.lookParts) for (const im of [...Object.values(this.lookParts), ...Object.values(this.gearParts)]) im?.setVisible(false);
    this.visible = v;
    this.sprite.setVisible(v); this.shadow.setVisible(v); this.ring.setVisible(v); this.weapon.setVisible(v && this.weapon.visible); this.weaponGlow.setVisible(v && this.weaponGlow.visible); this.blade?.setVisible(v && this.blade.visible); this.bladeTop?.setVisible(v && this.bladeTop.visible);
    for (const l of Object.values(this.layers)) l?.setVisible(v);
  }

  /** The sword's afterimage between two frames of a swing (MapleStory): a thin band of white light along the blade's sweep,
   *  brightest at the blade's end of it, in front of the character. */
  private addTrail(g: string, anim: string, a: number, b: number, pose: PoseFrame): void {
    const tr = swingTrail(g, anim, a, b);
    if (!tr) return;
    const k = pose.scale, fx = pose.flip ? -k : k, P = (q: number[]) => ({ x: q[0] * fx, y: q[1] * k });
    const gr = this.scene.add.graphics(), N = tr.outer.length - 1;
    for (let i = 0; i < N; i++) { // older part faint, the newest bright
      const w = (i + 1) / N;
      gr.fillStyle(0xffffff, 0.08 + 0.5 * w * w).fillPoints([P(tr.outer[i]), P(tr.outer[i + 1]), P(tr.inner[i + 1]), P(tr.inner[i])], true);
    }
    gr.lineStyle(1.6, 0xffffff, 0.85); gr.beginPath(); // a fine bright edge on the outside (the blade's tip)
    for (let i = Math.floor(N * 0.35); i <= N; i++) { const q = P(tr.outer[i]); if (i === Math.floor(N * 0.35)) gr.moveTo(q.x, q.y); else gr.lineTo(q.x, q.y); }
    gr.strokePath();
    this.trails.push({ g: gr, age: 0, life: a === 0 ? 170 : 140, a0: a === 0 ? 1 : 0.7 });
  }

  destroy(): void {
    for (const t of this.trails) t.g.destroy(); this.trails = [];
    this.sprite.destroy(); this.weapon.destroy(); this.weaponGlow.destroy(); this.shadow.destroy(); this.ring.destroy();
    for (const l of Object.values(this.layers)) l?.destroy();
    this.nameText?.destroy(); this.nameFrame?.destroy();
    this.layers = {}; this.blade?.destroy(); this.blade = null; this.bladeTop?.destroy(); this.bladeTop = null;
    if (this.lookParts) for (const im of Object.values(this.lookParts)) im.destroy();
    for (const im of Object.values(this.gearParts)) im?.destroy();
    this.lookParts = null; this.gearParts = {};
  }
}
