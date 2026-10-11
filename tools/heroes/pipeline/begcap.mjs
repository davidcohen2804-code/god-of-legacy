import { chromium } from 'playwright';
import sc from '@sparticuz/chromium';
const OUT='./qa/';
const gender = process.argv[2] || 'male', mode = process.argv[3] || 'walk';
const b = await chromium.launch({ executablePath: '/tmp/chromium', args: [...(sc.default?.args ?? sc.args), '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.addInitScript((g) => { // a level-1 warrior beginner in slot 1, selected
  const ch = { id: 'qa-beginner', name: 'Beginner', classId: 'warrior', level: 1, exp: 0, createdAt: new Date().toISOString(), lastPlayedAt: null, appearanceId: 'a1', gender: g };
  localStorage.setItem('godoflegacy.characters', JSON.stringify({ selectedSlotId: 1, slots: [{ slotId: 1, character: ch }, { slotId: 2, character: null }, { slotId: 3, character: null }, { slotId: 4, character: null }] }));
}, gender);
await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 90000 });
await p.evaluate(() => window.__game.scene.getScene('MainMenuScene').scene.start('CharacterSelectScene'));
await p.waitForTimeout(3000);
await p.locator('.slot.empty').first().click(); await p.waitForTimeout(300);
await p.locator('.slot.empty').first().dblclick().catch(()=>{}); await p.waitForTimeout(3000);
if (await p.locator('.cc-input').count()) { await p.fill('.cc-input', 'Tester'); if (gender === 'female') await p.getByText('Female', { exact: true }).first().click(); await p.getByText('CREATE CHARACTER').click(); await p.waitForTimeout(4000); }
await p.locator('.slot').first().click(); await p.waitForTimeout(500);
await p.getByText('ENTER WORLD', { exact: true }).first().click();
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('LegacyCourtyardScene'); return s?.pvpReady && !!s.view; }, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__T = performance.now(); window.__game.loop.sleep(); });
const step = (n) => p.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) { window.__T += 16; g.step(window.__T, 16); } }, n);
const pos = async () => p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const c = s.cameras.main; const r = s.game.canvas.getBoundingClientRect();
  return { x: r.left + (s.kin.x - c.worldView.x) * c.zoom * r.width / s.scale.width, y: r.top + (s.kin.y - (s.kin.z||0) - 60 - c.worldView.y) * c.zoom * r.height / s.scale.height }; });
let n = 0;
const zoomShot = async (t) => { const c = await pos(); await p.screenshot({ path: `${OUT}qa/qa_beginner_${gender}_${String(n++).padStart(2,'0')}_${t}.png`, clip: { x: c.x - 90, y: c.y - 110, width: 180, height: 180 }, timeout: 180000 }); };
await step(10);
for (let i = 0; i < 4; i++) { await zoomShot('idle'); await step(6); }
await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.cameras.main.stopFollow?.(); });
await p.keyboard.down('d'); await step(30);
for (let i = 0; i < 8; i++) { await zoomShot('walk'); await step(3); }
await p.keyboard.up('d'); await step(20);
await p.keyboard.down('d'); await step(3); await p.keyboard.up('d'); await step(3); await p.keyboard.down('d'); await step(30);
for (let i = 0; i < 8; i++) { await zoomShot('run'); await step(3); }
await p.keyboard.up('d'); await step(30);
await p.keyboard.down('d'); await step(20);
await p.evaluate(() => window.__game.scene.getScene('LegacyCourtyardScene').ci.queueJump());
for (let i = 0; i < 10; i++) { await zoomShot('jump'); await step(3); }
await p.keyboard.up('d');
console.log(await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return JSON.stringify({ key: s.view.sprite.texture.key, fr: s.view.sprite.frame.name }); }));
await b.close();
