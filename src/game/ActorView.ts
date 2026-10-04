// Rendering of one character (local player or remote mirror): body sprite + aligned weapon layer (weapon skins tint the
// real weapon pixels of every frame), z-aware contact shadow, and cosmetic layers on per-frame anchors
// (head / face / back) plus ground auras on the support plane. Feet position = ground (x, y); sprite y = y − z.
import Phaser from 'phaser';
import COS from '../data/cosmetics.json';
import { Dir } from '../world/collision';
import { actorDepth } from '../world/WorldGeometry';
import { ClassKey, PoseFrame, applyPose } from './Body';

export type CosSlot = 'head' | 'face' | 'back' | 'weapon' | 'aura' | 'damage' | 'pet';
export type Equipped = Partial<Record<CosSlot, string>>;

interface CosItem { id: string; type: string; icon: string; runtime?: string; skin?: string; blade?: { w: number; h: number; guard: number; cy: number }; color?: string; fit?: { w: number; lift: number }; ring?: { cy: number }; widths?: number[]; wip?: boolean; fabric?: string; attachment?: string; cell?: number[]; frames?: number; layout?: string; bbox?: number[][]; parts?: string[]; name: string; desc: string }
export const COSMETICS = Object.fromEntries(Object.entries(COS.classes as unknown as Record<string, CosItem[]>).map(([k, l]) => [k, l.filter((i) => !i.wip)])) as Record<string, CosItem[]>; // wip items stay out of the shop until verified on every frame
export const slotOf = (type: string): CosSlot | null =>
  type === 'head' ? 'head' : type === 'mask' ? 'face' : type === 'cape' || type === 'back' ? 'back'
    : type === 'weapon' || type === 'weapon_animated' || type === 'bow' || type === 'book' ? 'weapon' : type === 'aura' ? 'aura' : type === 'damage' ? 'damage' : type === 'pet' ? 'pet' : null;
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
const SKIN_THICK = 1.05; // sword skins: a touch bigger than the base sword
const SIZE: Record<string, number> = { head: 40, face: 18, back: 56, aura: 92 };

export function preloadCosmetics(scene: Phaser.Scene): void {
  for (const list of Object.values(COSMETICS)) for (const it of list) {
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
function bodyVariant(scene: Phaser.Scene, key: string, wkey: string, cut: boolean, capeId: string | null): string | null {
  const vk = `${key}${capeId ? `|${capeId}` : ''}${cut ? '-nb' : ''}`;
  if (scene.textures.exists(vk)) return vk;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key), img = src.getSourceImage() as HTMLImageElement;
  const ct = scene.textures.createCanvas(vk, img.width, img.height); if (!ct) return null;
  const ctx = ct.getContext(); ctx.drawImage(img, 0, 0);
  const kk = `${key}-k`, fk = capeId ? `cosf-${capeId}` : '';
  if (capeId && scene.textures.exists(kk) && scene.textures.exists(fk)) {
    const W = img.width, H = img.height;
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const mx = mc.getContext('2d')!;
    mx.drawImage(scene.textures.get(kk).getSourceImage() as HTMLImageElement, 0, 0); const mask = mx.getImageData(0, 0, W, H).data;
    const fimg = scene.textures.get(fk).getSourceImage() as HTMLImageElement, FW = fimg.width, FH = fimg.height;
    const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH; const fx = fc.getContext('2d')!; fx.drawImage(fimg, 0, 0); const fab = fx.getImageData(0, 0, FW, FH).data;
    const d = ctx.getImageData(0, 0, W, H), a = d.data, S = FW / 130; // one fabric tile ≈ 130 sheet px (≈80 px on screen)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (mask[i + 3] < 128 || a[i + 3] === 0) continue;
      const shade = Math.min(1.5, Math.max(0.25, a[i] / 170)); // cape is red: its red channel carries the folds and shadows
      const fi = ((Math.floor(y * S) % FH) * FW + (Math.floor(x * S) % FW)) * 4;
      a[i] = Math.min(255, fab[fi] * shade); a[i + 1] = Math.min(255, fab[fi + 1] * shade); a[i + 2] = Math.min(255, fab[fi + 2] * shade);
    }
    ctx.putImageData(d, 0, 0);
  }
  if (cut) {
    const ck = `${key}-c`, mk = scene.textures.exists(ck) ? ck : wkey; // verified cut mask (blade + its line), else the raw blade mask
    if (scene.textures.exists(mk)) {
      const wimg = scene.textures.get(mk).getSourceImage() as HTMLImageElement;
      ctx.globalCompositeOperation = 'destination-out';
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(wimg, dx, dy); // 1px wider: no grey rim left behind
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  for (const name of src.getFrameNames()) { const f = src.get(name); ct.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  ct.refresh();
  return vk;
}

const DIR_COL: Record<Dir, number> = { down: 0, right: 1, left: 2, up: 3 };
/** Head-item fit per view (down/right/left/up): width = hair width × w; lower edge = hair bottom + b × hair width; dx = forward shift. */
const HEAD_FIT = [{ w: 1.3, b: 0.12, dx: 0 }, { w: 1.32, b: 0.12, dx: 0.04 }, { w: 1.32, b: 0.12, dx: 0.04 }, { w: 1.4, b: 0.18, dx: 0 }];

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
  private t = 0;
  /** Floating companion: trails the hero with a soft lag. */
  private petPos: { x: number; y: number } | null = null;
  visible = true;

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
    for (const s of Object.keys(this.layers) as CosSlot[]) { this.layers[s]?.destroy(); delete this.layers[s]; }
    this.blade?.destroy(); this.blade = null; this.bladeTop?.destroy(); this.bladeTop = null;
    const wi = e.weapon ? cosmetic(e.weapon) : undefined;
    if (wi?.blade && this.scene.textures.exists(`cosw-${wi.id}`)) {
      this.blade = this.scene.add.image(0, 0, `cosw-${wi.id}`);
      const cut = Math.max(0, wi.blade.guard - wi.blade.h * 0.18); // keep the guard on top, the grip goes under the hand
      this.bladeTop = this.scene.add.image(0, 0, `cosw-${wi.id}`).setCrop(cut, 0, wi.blade.w - cut, wi.blade.h);
    }
    for (const [slot, id] of Object.entries(e) as [CosSlot, string][]) {
      if (!id || slot === 'weapon' || slot === 'damage') continue;
      const it = cosmetic(id);
      if (!it || !this.scene.textures.exists(`cos-${id}`)) continue;
      const img = this.scene.add.image(0, 0, `cos-${id}`, 0);
      if (slot === 'aura') img.setBlendMode(Phaser.BlendModes.ADD);
      this.layers[slot] = img;
    }
  }

  get equippedItems(): Equipped { return this.equipped; }

  /** Render one frame. pose = resolved body frame; x/y = ground feet; z = height; supportZ = surface under the feet. */
  render(ms: number, pose: PoseFrame, x: number, y: number, z: number, supportZ: number, dir: Dir, alpha = 1, tint: number | null = null, tintFill = false): void {
    this.t += ms;
    const p = this.sprite;
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
    if (this.blade || capeId) { const vk = bodyVariant(this.scene, pose.key, pose.wkey, !!this.blade, capeId); if (vk) p.setTexture(vk, pose.frame); }
    if (this.blade) {
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
        const g = ws.rainbow ? tintC : ws.glow;
        this.weaponGlow.setOrigin(pose.ox, pose.oy).setScale(pose.scale * 1.04).setPosition(p.x, p.y).setDepth(depth + 0.03).setTint(g)
          .setAlpha(alpha * (0.45 + 0.2 * Math.sin(this.t / 180)));
      }
    }
    // Anchored cosmetics.
    const a = pose.anchor;
    for (const [slot, img] of Object.entries(this.layers) as [CosSlot, Phaser.GameObjects.Image][]) {
      const it = cosmetic(this.equipped[slot]!)!;
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

  setVisible(v: boolean): void {
    this.visible = v;
    this.sprite.setVisible(v); this.shadow.setVisible(v); this.ring.setVisible(v); this.weapon.setVisible(v && this.weapon.visible); this.weaponGlow.setVisible(v && this.weaponGlow.visible); this.blade?.setVisible(v && this.blade.visible); this.bladeTop?.setVisible(v && this.bladeTop.visible);
    for (const l of Object.values(this.layers)) l?.setVisible(v);
  }

  destroy(): void {
    this.sprite.destroy(); this.weapon.destroy(); this.weaponGlow.destroy(); this.shadow.destroy(); this.ring.destroy();
    for (const l of Object.values(this.layers)) l?.destroy();
    this.layers = {}; this.blade?.destroy(); this.blade = null; this.bladeTop?.destroy(); this.bladeTop = null;
  }
}
