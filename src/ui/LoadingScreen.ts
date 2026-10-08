import Phaser from 'phaser';
import { FONT_FAMILY, HUD } from '../config/layout';

/** Kit pieces the loading screen draws with (loaded once by BootScene, before any big scene preload): none now — it is
 *  drawn in the UI's language (theme.ts). */
export const LOADING_KIT = [] as const;

/**
 * Loading screen for a scene preload (instead of a black canvas): dimmed key art, logo, destination plaque and a
 * kit-styled progress bar. Call at the end of preload(); it shows only when files are queued and removes itself when
 * the loader completes (the scene's create() then starts from a clean camera).
 */
export function showLoading(scene: Phaser.Scene, title: string): void {
  const load = scene.load;
  if (load.list.size === 0) return;
  const cam = scene.cameras.main;
  cam.setZoom(1).setScroll(0, 0);
  const W = scene.scale.width, H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };
  const D = 900000; // above everything the scene may add while loading

  if (scene.textures.exists('mainmenu-bg')) {
    const bg = add(scene.add.image(W / 2, H / 2, 'mainmenu-bg').setDepth(D));
    bg.setScale(Math.max(W / bg.width, H / bg.height));
  }
  add(scene.add.rectangle(0, 0, W, H, 0x04070c, 0.58).setOrigin(0, 0).setDepth(D + 1));
  const shade = add(scene.add.graphics().setDepth(D + 1));
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75).fillRect(0, H * 0.55, W, H * 0.45);

  if (scene.textures.exists('logo')) {
    const logo = add(scene.add.image(W / 2, H * 0.3, 'logo').setDepth(D + 2));
    logo.setScale((W * 0.36) / logo.width);
  }
  // The destination's name with a fine gold line under it.
  const py = H * 0.6;
  add(scene.add.text(W / 2, py, title, { fontFamily: FONT_FAMILY, fontStyle: '700', fontSize: '32px', color: '#f4e6c2', resolution: 2 })
    .setOrigin(0.5).setLetterSpacing(5).setShadow(0, 2, '#000000', 10, true, true).setDepth(D + 3));
  const line = add(scene.add.graphics().setDepth(D + 2));
  for (let i = 0; i < 40; i++) { const t = i / 39, a = Math.sin(t * Math.PI) * 0.85; line.fillStyle(0xf4d896, a).fillRect(W / 2 - 150 + t * 300, py + 34, 300 / 40 + 0.5, 1); }

  // Progress bar: a slim rounded track, the gold fill grows with the loaded share of the files.
  const fw = Math.min(720, W * 0.5), fh = 8, fx = W / 2 - fw / 2, fy = H * 0.84;
  const track = add(scene.add.graphics().setDepth(D + 2));
  track.fillStyle(0x0a101c, 0.92).fillRoundedRect(fx, fy, fw, fh, fh / 2);
  track.lineStyle(1, 0xffffff, 0.12).strokeRoundedRect(fx, fy, fw, fh, fh / 2);
  const fill = add(scene.add.graphics().setDepth(D + 3));
  const pct = add(scene.add.text(W / 2, fy + 24, 'Loading  0%', { fontFamily: HUD.bodyFont, fontStyle: '600', fontSize: '15px', color: '#e9e2d0', resolution: 2 })
    .setOrigin(0.5, 0).setLetterSpacing(1).setShadow(0, 1, '#000000', 4, true, true).setDepth(D + 3));

  for (const o of objs) (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
  const onProgress = (p: number) => {
    fill.clear();
    if (p > 0) fill.fillStyle(0xe7c47c, 1).fillRoundedRect(fx, fy, Math.max(fh, fw * p), fh, fh / 2);
    pct.setText(`Loading  ${Math.round(p * 100)}%`);
  };
  load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    load.off(Phaser.Loader.Events.PROGRESS, onProgress);
    for (const o of objs) o.destroy();
    cam.fadeIn(280, 0, 0, 0);
  });
}
