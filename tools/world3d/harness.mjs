// The world in 3D test harness: opens the game (vite preview on :4173) at the Legacy Courtyard with ?world3d=1 and
// returns the page and helpers — state, shots, teleports that wait for the crossing and the new place's first frames,
// `up` onto a floor above or a cloud, `settleCam` (headless sim time is slow: ends the arrival glide), `openGate`.
// Headless Chromium runs software GL (SwiftShader): the stage picks its `soft` mode; HARD=1 spoofs a real browser.
// Run: node tools/world3d/shots_dusk.mjs (needs playwright: npm i -D playwright, or a symlink into node_modules).
import { chromium } from 'playwright';
import fs from 'node:fs';
const ROW = JSON.parse(fs.readFileSync(new URL('../../src/data/world-areas.json', import.meta.url), 'utf8')).row;
const LAY = JSON.parse(fs.readFileSync(new URL('../../src/data/world-strip.json', import.meta.url), 'utf8')).areas;
/** The painted area under a world x (as the game's areaAt). */
export const areaIdAt = (x) => ROW.find((id) => x < LAY[id].span[1]) ?? ROW[ROW.length - 1];
const URL = process.env.URL ?? 'http://localhost:4173/';
export const OUT = process.env.SHOTS ?? '/tmp/claude-0'; // (where the shots go)
export const W = (p, ms) => p.waitForTimeout(ms);
export async function open(opts = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: opts.w ?? 1280, height: opts.h ?? 720 } });
  if (opts.hard) await p.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  p.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
  const q = '?world3d=1&qa=1' + (opts.q ?? '');
  await p.goto(URL + q); await p.evaluate(() => localStorage.clear());
  await p.evaluate((d) => localStorage.setItem('godoflegacy.characters', JSON.stringify(d)), { version: 1, maxSlots: 4, selectedSlotId: 2, slots: [{ slotId: 1, character: null }, { slotId: 2, character: { id: 'qa', name: 'QA', classId: opts.cls ?? 'warrior', level: opts.level ?? 12, createdAt: '2026-01-01T00:00:00Z', lastPlayedAt: null, appearanceId: null } }, { slotId: 3, character: null }, { slotId: 4, character: null }] });
  await p.goto(URL + q); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 60000 }); await W(p, 800);
  const kx = (opts.w ?? 1280) / 1920, ky = (opts.h ?? 720) / 1080;
  await p.mouse.move(960 * kx, 585 * ky); await W(p, 400); await p.mouse.down(); await W(p, 100); await p.mouse.up();
  await p.waitForSelector('.gol-cs .slot', { timeout: 60000 }); await W(p, 800);
  await p.click('.gol-cs .slot >> nth=1'); await W(p, 500);
  await p.click('.gol-cs .kbtn:has-text("ENTER WORLD")');
  try { await p.waitForFunction(() => { const s = window.__game?.scene.getScene('LegacyCourtyardScene'); return !!s && s.sys.isActive() && !!s.a3d && !!s.w3d; }, null, { timeout: 240000 }); }
  catch (e) { console.log('WORLD 3D DID NOT COME UP', errors.slice(0, 12).join('\n')); await p.screenshot({ path: `${OUT}/w3d_fail.jpg`, type: 'jpeg', quality: 60 }); throw e; }
  await W(p, opts.settle ?? 8000);
  const state = () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; return { x: k.x, y: k.y, z: k.z, supportZ: k.supportZ, supportId: k.supportId, area: s.world?.area?.id, hp: s.hp, mode: s.mode, fps: s.game.loop.actualFps, mobs: s.world?.mobs?.length }; });
  const shot = (f) => p.screenshot({ path: f, type: 'jpeg', quality: 80, timeout: 150000 });
  const settled = async (want) => { // (the 3D place `want` is up, no crossing running, no fade, and three frames drawn since)
    await p.waitForFunction((want) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return !!s.w3d && (!want || s.w3d.areaId === want) && !s.warping && !s.cameras.main.fadeEffect.isRunning; }, want, { timeout: 180000 });
    const f0 = await p.evaluate(() => window.__game.loop.frame);
    await p.waitForFunction((f0) => window.__game.loop.frame >= f0 + 3, f0, { timeout: 180000 });
  };
  const tele = async (x, y) => { await p.evaluate(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.supportZ = 0; k.supportId = null; k.grounded = true; }, [x, y]); await settled(areaIdAt(x)); }; // (onto the ground there)
  const hold = async (key, ms) => { await p.keyboard.down(key); await W(p, ms); await p.keyboard.up(key); };
  const info = () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const r = s.a3d.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures }; });
  const openGate = () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.quests.sun_gate = { state: 'done', progress: [] }; s.saveQuests?.(); s.world.sunGate.unlock(); });
  const up = (x, y, z, id) => p.evaluate(([x, y, z, id]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = z; k.vz = 0; k.vx = 0; k.vy = 0; k.supportZ = z; k.supportId = id; k.grounded = true; }, [x, y, z, id]).then(() => settled(/^(sky-|cloud_haven|sunfall_pass|afterglow)/.test(id) ? 'sky' : areaIdAt(x))); // (onto an upper floor / a cloud; a crossing it starts is over when this resolves)
  const settleCam = () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); if (s.w3d) { s.w3d.arrive = null; s.a3d.punch = 1; } s.a3d?.snap(); }); // (headless sim time is slow: end the arrival glide, camera straight on the hero)
  return { b, p, errors, state, shot, tele, hold, info, openGate, up, settleCam, settled };
}
