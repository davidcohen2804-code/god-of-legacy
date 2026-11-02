// V4 rig lab entry: its own Phaser game on its own page. The game is never started here.
import Phaser from 'phaser';
import { bench } from './bench';
import { LabScene } from './LabScene';
import { runTests } from './tests';
import { runTestsB } from './testsB';
import { runTestsB01 } from './testsB01';
import { idMapsB01 } from './fixturesB01';
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
    /** The tests of the art on screen: Phase 1's on the placeholder, the real-art tests on candidate B. */
    runTests: (full = false, only?: string[]) => (scene.art === 'b' ? runTestsB(scene, { full, only }, setStatus) : scene.art === 'base01' ? runTestsB01(scene, setStatus) : runTests(scene, { full }, setStatus)),
    bench: (seconds = 6) => bench(scene, seconds, setStatus),
    /** R15's renders of one BASE-01 item worn alone (tools/v4/base01/r15.mjs). */
    idMaps: (itemId: string) => idMapsB01(scene, itemId),
    /** Recording helpers: stop the clock, then advance it by hand one frame at a time. */
    freeze: () => game.loop.sleep(),
    thaw: () => game.loop.wake(),
    step: (n = 1, ms = 1000 / 60) => { for (let i = 0; i < n; i++) game.step(performance.now(), ms); },
  };
  window.__v4lab = api;
  buildUI(scene, api);
}, { once: true });
