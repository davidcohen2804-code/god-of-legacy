// V4 rig lab entry: its own Phaser game on its own page. The game is never started here.
import Phaser from 'phaser';
import { bench } from './bench';
import { LabScene } from './LabScene';
import { runTests } from './tests';
import { buildUI } from './ui';
import { CANVAS } from './world';

declare global { interface Window { __v4lab?: Record<string, unknown> } }

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  width: CANVAS.w,
  height: CANVAS.h,
  backgroundColor: '#0d1118',
  banner: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  scene: [LabScene],
});

window.addEventListener('v4lab-ready', (e) => {
  const scene = (e as CustomEvent<LabScene>).detail;
  const setStatus = (m: string) => { const el = document.getElementById('test-status'); if (el) el.textContent = m; };
  const api = {
    game, scene, ready: true,
    runTests: (full = false) => runTests(scene, { full }, setStatus),
    bench: (seconds = 4) => bench(scene, seconds, setStatus),
    /** Recording helpers: stop the clock, then advance it by hand one frame at a time. */
    freeze: () => game.loop.sleep(),
    thaw: () => game.loop.wake(),
    step: (n = 1, ms = 1000 / 60) => { for (let i = 0; i < n; i++) game.step(performance.now(), ms); },
  };
  window.__v4lab = api;
  buildUI(scene, api);
}, { once: true });
