// The fighter select's backdrop in PVP 3D: the 3D courtyard itself, rendered by the game's own 3D room (Arena3D —
// nothing painted), empty of fighters, from a wide shot in front of the temple (the arena's own framing — the loading
// cover's still and the VS screen's backdrop — is DFO's: assets/final/stages/courtyard3d*.jpg). Opens the game in a
// headless browser as a real one (full quality: shadows, multisampling, bloom), starts a training room, stops its loop,
// renders the room and its railing at 1920×1080 and writes public/assets/character_select/pvp_select_3d.webp.
// Re-run it when the courtyard changes.
//
//   npx vite build && npx vite preview --port 4173 &   then   node tools/pvp/backdrop3d.mjs     (URL=… for another port)
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('../../public/assets/character_select/pvp_select_3d.webp', import.meta.url);
const S = 'LegacyCourtyardScene';
/** The shot: the camera `d` units from a point over the courtyard's middle, `pitch` degrees above it (the temple whole,
 *  the deck, the railing across the front); `dim` darkens the sky a little (the lanterns and the doors burn on). */
const SHOT = { w: 1920, h: 1080, fov: 40, pitch: 6, d: 18, lookY: 1.6, lookBack: 1.48, dim: 0.15, quality: 0.86 };

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })); // (else the room builds its light test version)
const P = await ctx.newPage(), errors = [];
P.on('pageerror', (e) => errors.push(e.message)); P.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await P.goto(URL + '?net=local', { waitUntil: 'commit' });
await P.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 400000 });
await P.evaluate(() => { window.__game.scene.getScene('MainMenuScene').scene.start('PvpSelectScene', { mode: 'training' }); });
await P.waitForFunction(() => document.querySelector('.gol-ps .ps-tile'), null, { timeout: 120000 });
await P.waitForTimeout(800);
await P.click('.ps-tile >> nth=0'); await P.waitForTimeout(400); await P.click('.ps-tile >> nth=1');
await P.waitForFunction((S) => window.__game?.scene.getScene(S)?.a3d, S, { timeout: 500000, polling: 50 });
await P.evaluate((S) => { window.__game.scene.getScene(S).a3d.quality.level = 2; }, S); // (a render, not a fight: never the lighter room)
await P.waitForFunction((S) => window.__game?.scene.getScene(S)?.pvpReady, S, { timeout: 500000 });
await P.waitForTimeout(6000); // (the textures in, the petals falling)
const url = await P.evaluate(async ([S, sh]) => {
  const a = window.__game.scene.getScene(S).a3d, R = a.renderer, F = a.floor;
  window.__game.loop.sleep();
  const cx = (a.w3(F.x0) + a.w3(F.x1)) / 2, look = [cx, sh.lookY, a.d3(F.back) - sh.lookBack], p = (sh.pitch * Math.PI) / 180;
  R.setSize(sh.w, sh.h, false); a.makeComposer(sh.w, sh.h, 4);
  const cam = a.camera; cam.aspect = sh.w / sh.h; cam.fov = sh.fov;
  cam.position.set(look[0], look[1] + Math.sin(p) * sh.d, look[2] + Math.cos(p) * sh.d); cam.lookAt(...look);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  a.room.sun.intensity = a.sunBase * (1 - 0.7 * sh.dim); a.room.hemi.intensity = a.hemiBase * (1 - 0.55 * sh.dim);
  a.room.shadowsDirty();
  for (let i = 0; i < 4; i++) a.room.update(33, 30 + i * 0.033, sh.dim);
  a.composer.render();
  const back = R.domElement.toDataURL('image/png');
  R.setClearColor(0x000000, 0); R.render(a.front3, cam); // (the railing in front)
  const front = R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = sh.w; c.height = sh.h; const g = c.getContext('2d');
  const img = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
  g.drawImage(await img(back), 0, 0); g.drawImage(await img(front), 0, 0);
  return c.toDataURL('image/webp', sh.quality);
}, [S, SHOT]);
fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log('written', OUT.pathname, fs.statSync(OUT).size, 'bytes', errors.length ? `— page errors: ${errors.slice(0, 4).join(' | ')}` : '');
await b.close();
