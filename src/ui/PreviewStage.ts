// Isolated live Phaser preview used by the Skill Book / Inventory / Cash Shop overlays.
// A dedicated camera renders a private region of the scene far outside the map, so previews use exactly the runtime
// body sheets, cosmetic layers and skill VFX (never pre-rendered video). The DOM panel cuts a hole over the viewport.
import Phaser from 'phaser';

export interface Rect { x: number; y: number; w: number; h: number }

/** Kept for callers: the previews' backdrops are drawn by the game itself now (makeBackdrop). */
export function preloadPanelArt(_scene: Phaser.Scene): void { /* nothing to load */ }

/** The preview's backdrop (the UI's language): a rounded deep-blue stage with a soft light from above and a warm glow on
 *  the floor; outside its rounded corners the window's own colour, so the stage reads as a rounded panel in the window. */
function makeBackdrop(scene: Phaser.Scene, key: string, w: number, h: number): void {
  const t = scene.textures.createCanvas(key, w, h); if (!t) return;
  const c = t.getContext(), r = 16;
  c.fillStyle = '#121b2e'; c.fillRect(0, 0, w, h);
  const round = () => { c.beginPath(); c.moveTo(r, 0); c.arcTo(w, 0, w, h, r); c.arcTo(w, h, 0, h, r); c.arcTo(0, h, 0, 0, r); c.arcTo(0, 0, w, 0, r); c.closePath(); };
  round();
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1c2c48'); g.addColorStop(1, '#0c1423'); c.fillStyle = g; c.fill();
  c.save(); round(); c.clip();
  const top = c.createRadialGradient(w / 2, -h * 0.1, 10, w / 2, -h * 0.1, h * 0.75); top.addColorStop(0, 'rgba(134,189,240,0.16)'); top.addColorStop(1, 'rgba(134,189,240,0)');
  c.fillStyle = top; c.fillRect(0, 0, w, h);
  c.translate(w / 2, h - 74); c.scale(1, 0.2);
  const fl = c.createRadialGradient(0, 0, 4, 0, 0, w * 0.42); fl.addColorStop(0, 'rgba(231,196,124,0.32)'); fl.addColorStop(1, 'rgba(231,196,124,0)');
  c.fillStyle = fl; c.beginPath(); c.arc(0, 0, w * 0.42, 0, Math.PI * 2); c.fill();
  c.restore();
  round(); c.strokeStyle = 'rgba(255,255,255,0.09)'; c.lineWidth = 2; c.stroke();
  t.refresh();
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
    this.cam.setZoom(zoom).centerOn(ox, oy).setBackgroundColor(0x121b2e).setRoundPixels(true);
    if (!scene.textures.exists(frameKey)) makeBackdrop(scene, frameKey, rect.w, rect.h);
    this.frame = scene.add.image(ox, oy, frameKey).setDisplaySize(rect.w / zoom, rect.h / zoom).setDepth(-1e6);
    this.setVisible(false);
  }

  setVisible(v: boolean): void { this.cam.setVisible(v); this.frame.setVisible(v); }

  destroy(): void { this.scene.cameras.remove(this.cam, true); this.frame.destroy(); }
}
