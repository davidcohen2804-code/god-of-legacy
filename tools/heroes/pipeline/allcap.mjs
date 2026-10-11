// allcap.mjs <cls> : idle (6) + walk (8) + run (8) + jump/djump (10) in one session → ${OUT}qa_<cls>_NN_<mode>.png
import { chromium } from 'playwright';
import sc from '@sparticuz/chromium';
const OUT='./qa/qa/';
const cls = process.argv[2] || 'warrior';
const b = await chromium.launch({ executablePath: '/tmp/chromium', args: [...(sc.default?.args ?? sc.args), '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 90000 });
await p.evaluate(() => window.__game.scene.getScene('MainMenuScene').scene.start('CharacterSelectScene'));
await p.waitForTimeout(3000);
await p.getByText('START HERO', { exact: true }).first().click(); await p.waitForTimeout(400);
await p.locator('.heroes .hc').nth(['warrior','book_mage','archer','samurai','gambler'].indexOf(cls)).getByText('PLAY', { exact: true }).click();
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('LegacyCourtyardScene'); return s?.pvpReady && !!s.view; }, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__T = performance.now(); window.__game.loop.sleep(); });
const step = (n) => p.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) { window.__T += 16; g.step(window.__T, 16); } }, n);
const pos = async () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const c = s.cameras.main; const r = s.game.canvas.getBoundingClientRect();
  return { x: r.left + (s.kin.x - c.worldView.x) * c.zoom * r.width / s.scale.width, y: r.top + (s.kin.y - (s.kin.z||0) - 60 - c.worldView.y) * c.zoom * r.height / s.scale.height }; });
let n = 0;
const shot = async (t) => { const c = await pos(); await p.screenshot({ path: `${OUT}qa_${cls}_${String(n++).padStart(2,'0')}_${t}.png`, clip: { x: c.x - 90, y: c.y - 110, width: 180, height: 180 }, timeout: 180000 }); };
await step(10);
for (let i = 0; i < 6; i++) { await shot('idle'); await step(8); }
await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.cameras.main.stopFollow?.(); });
await p.keyboard.down('d'); await step(30);
for (let i = 0; i < 8; i++) { await shot('walk'); await step(3); }
await p.keyboard.up('d'); await step(20);
await p.keyboard.down('d'); await step(3); await p.keyboard.up('d'); await step(3); await p.keyboard.down('d'); await step(30);
for (let i = 0; i < 8; i++) { await shot('run'); await step(3); }
await p.keyboard.up('d'); await step(30);
await p.keyboard.down('d'); await step(20);
await p.evaluate(() => window.__game.scene.getScene('LegacyCourtyardScene').ci.queueJump());
for (let i = 0; i < 12; i++) { await shot('jump'); await step(3); if (i === 4) await p.evaluate(() => window.__game.scene.getScene('LegacyCourtyardScene').ci.queueJump()); }
await p.keyboard.up('d');
await b.close();
