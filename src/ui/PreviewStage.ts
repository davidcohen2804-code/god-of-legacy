// Isolated live Phaser preview used by the Skill Book / Inventory / Cash Shop overlays.
// A dedicated camera renders a private region of the scene far outside the map, so previews use exactly the runtime
// body sheets, cosmetic layers and skill VFX (never pre-rendered video). The DOM panel cuts a hole over the viewport.
import Phaser from 'phaser';

export interface Rect { x: number; y: number; w: number; h: number }

export function preloadPanelArt(scene: Phaser.Scene): void {
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('ui-sb-preview', 'assets/final/ui/skill_book/preview_frame.png');
  I('ui-inv-preview', 'assets/final/ui/inventory/character_preview_frame.png');
  I('ui-shop-preview', 'assets/final/ui/cash_shop/preview_stage.png');
}

/** CSS that removes `r` (panel-local design px) from an element, letting the canvas camera show through. */
export function holeMask(el: HTMLElement, r: Rect): void {
  const m = 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)';
  const s = el.style as CSSStyleDeclaration & Record<string, string>;
  for (const pre of ['', '-webkit-']) {
    s.setProperty(`${pre}mask-image`, m);
    s.setProperty(`${pre}mask-size`, `100% 100%, ${r.w}px ${r.h}px`);
    s.setProperty(`${pre}mask-position`, `0 0, ${r.x}px ${r.y}px`);
    s.setProperty(`${pre}mask-repeat`, 'no-repeat');
  }
  s.setProperty('mask-composite', 'exclude');
  s.setProperty('-webkit-mask-composite', 'xor');
}

export class PreviewStage {
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  private frame: Phaser.GameObjects.Image;

  /** rect = viewport in design px (== game px); (ox, oy) = world centre of the private stage region. */
  constructor(private scene: Phaser.Scene, readonly rect: Rect, readonly ox: number, readonly oy: number, zoom: number, frameKey: string) {
    this.cam = scene.cameras.add(rect.x, rect.y, rect.w, rect.h, false, `preview-${ox}`);
    this.cam.setZoom(zoom).centerOn(ox, oy).setBackgroundColor(0x0a1018).setRoundPixels(true);
    this.frame = scene.add.image(ox, oy, frameKey).setDisplaySize(rect.w / zoom, rect.h / zoom).setDepth(-1e6);
    this.setVisible(false);
  }

  setVisible(v: boolean): void { this.cam.setVisible(v); this.frame.setVisible(v); }

  destroy(): void { this.scene.cameras.remove(this.cam, true); this.frame.destroy(); }
}
