// Rendering of one character (local player or remote mirror): body sprite + aligned weapon layer (weapon skins tint the
// real weapon pixels of every frame), z-aware contact shadow, and cosmetic layers on per-frame anchors
// (head / face / back) plus ground auras on the support plane. Feet position = ground (x, y); sprite y = y − z.
import Phaser from 'phaser';
import COS from '../data/cosmetics.json';
import { Dir } from '../world/collision';
import { actorDepth } from '../world/WorldGeometry';
import { ClassKey, PoseFrame, applyPose } from './Body';

export type CosSlot = 'head' | 'face' | 'back' | 'weapon' | 'aura';
export type Equipped = Partial<Record<CosSlot, string>>;

interface CosItem { id: string; type: string; icon: string; runtime?: string; attachment?: string; cell?: number[]; frames?: number; layout?: string; bbox?: number[][]; parts?: string[]; name: string; desc: string }
export const COSMETICS = COS.classes as unknown as Record<string, CosItem[]>;
export const slotOf = (type: string): CosSlot | null =>
  type === 'head' ? 'head' : type === 'mask' ? 'face' : type === 'cape' || type === 'back' ? 'back'
    : type === 'weapon' || type === 'weapon_animated' || type === 'bow' || type === 'book' ? 'weapon' : type === 'aura' ? 'aura' : null;
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
const SIZE: Record<string, number> = { head: 40, face: 18, back: 56, aura: 92 };

export function preloadCosmetics(scene: Phaser.Scene): void {
  for (const list of Object.values(COSMETICS)) for (const it of list) {
    if (!it.runtime || scene.textures.exists(`cos-${it.id}`)) continue;
    scene.load.spritesheet(`cos-${it.id}`, it.runtime, { frameWidth: it.cell![0], frameHeight: it.cell![1] });
  }
  if (!scene.textures.exists('contact-shadow')) scene.load.image('contact-shadow', 'assets/final/world/contact_shadow.png');
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
  private equipped: Equipped = {};
  private t = 0;
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
    for (const [slot, id] of Object.entries(e) as [CosSlot, string][]) {
      if (!id || slot === 'weapon') continue;
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
      if (slot === 'aura') {
        const n = it.frames ?? 8;
        img.setFrame(Math.floor((this.t * 8) / 1000) % n);
        const s = SIZE.aura / ((it.bbox?.[0][2] ?? 128) - (it.bbox?.[0][0] ?? 0));
        img.setScale(s).setPosition(x, y - supportZ - 12).setDepth(actorDepth(x, y, supportZ) - 0.7).setAlpha(alpha * 0.9).setVisible(this.visible);
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
        s = (hw * f.w) / bw; ax = hcx + f.dx * hw * (dir === 'left' ? -1 : 1); ay = hb + f.b * hw - (bh * s) / 2;
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
    this.sprite.setVisible(v); this.shadow.setVisible(v); this.ring.setVisible(v); this.weapon.setVisible(v && this.weapon.visible); this.weaponGlow.setVisible(v && this.weaponGlow.visible);
    for (const l of Object.values(this.layers)) l?.setVisible(v);
  }

  destroy(): void {
    this.sprite.destroy(); this.weapon.destroy(); this.weaponGlow.destroy(); this.shadow.destroy(); this.ring.destroy();
    for (const l of Object.values(this.layers)) l?.destroy();
    this.layers = {};
  }
}
