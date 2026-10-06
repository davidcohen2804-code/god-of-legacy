import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/layout';

/** Kit pieces the loading screen draws with (loaded once by BootScene, before any big scene preload). */
export const LOADING_KIT = ['exp_frame', 'exp_fill', 'region_plaque'] as const;

/** EXP-bar art reused as the loading bar: the gold fill sits in the frame's navy channel (frame px of the 1400x71 art). */
const CH = { x: 57, y: 27, w: 1286, h: 18 };

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
  const py = H * 0.6;
  if (scene.textures.exists('kit.region_plaque')) add(scene.add.image(W / 2, py, 'kit.region_plaque').setScale(1.4).setDepth(D + 2));
  add(scene.add.text(W / 2, py, title, { fontFamily: FONT_FAMILY, fontStyle: '700', fontSize: '34px', color: '#f3d58a' })
    .setOrigin(0.5).setLetterSpacing(3).setShadow(0, 2, '#000000', 6, true, true).setDepth(D + 3));

  // Progress bar: frame + fill cropped to the loaded share of the files.
  const fw = Math.min(1080, W * 0.6), k = fw / 1400, fx = W / 2 - fw / 2, fy = H * 0.84;
  let fill: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists('kit.exp_frame') && scene.textures.exists('kit.exp_fill')) {
    add(scene.add.image(fx, fy, 'kit.exp_frame').setOrigin(0, 0).setScale(k).setDepth(D + 2));
    fill = add(scene.add.image(fx + CH.x * k, fy + CH.y * k, 'kit.exp_fill').setOrigin(0, 0).setDepth(D + 3)); // over the frame's navy channel (as in the HUD)
    fill.setDisplaySize(CH.w * k, CH.h * k).setCrop(0, 0, 0, fill.height);
  }
  const pct = add(scene.add.text(W / 2, fy + 71 * k + 22, 'LOADING  0%', { fontFamily: FONT_FAMILY, fontStyle: '700', fontSize: '20px', color: '#efddb0' })
    .setOrigin(0.5, 0).setLetterSpacing(4).setShadow(0, 2, '#000000', 4, true, true).setDepth(D + 3));

  for (const o of objs) (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
  const onProgress = (p: number) => {
    if (fill) fill.setCrop(0, 0, Math.round(fill.width * p), fill.height);
    pct.setText(`LOADING  ${Math.round(p * 100)}%`);
  };
  load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    load.off(Phaser.Loader.Events.PROGRESS, onProgress);
    for (const o of objs) o.destroy();
    cam.fadeIn(280, 0, 0, 0);
  });
}
