// The character studio's entry: its own Phaser game on its own page (lab only; the game is never started here).
import Phaser from 'phaser';
import { STUDIO_CANVAS, StudioScene } from './StudioScene';
import { buildStudioUI } from './ui';

declare global { interface Window { __studio?: Record<string, unknown> } }

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  width: STUDIO_CANVAS.w,
  height: STUDIO_CANVAS.h,
  backgroundColor: '#0d1118',
  banner: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  scene: [StudioScene],
});

window.addEventListener('v4studio-ready', (e) => {
  const scene = (e as CustomEvent<StudioScene>).detail;
  const api = {
    game, scene, ready: true,
    /** Recording helpers: stop the clock, then show one exact moment. */
    freeze: () => game.loop.sleep(),
    thaw: () => game.loop.wake(),
    show: (anim: string, t: number) => { scene.setAnim(anim); scene.t = t; scene.playing = false; scene.render(); },
    step: (n = 1, ms = 1000 / 60) => { for (let i = 0; i < n; i++) game.step(performance.now(), ms); },
  };
  window.__studio = api;
  buildStudioUI(scene);
}, { once: true });
