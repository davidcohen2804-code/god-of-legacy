// A new player's first minute in 3D: the game opened with ?world3d=1 and nothing saved — the main menu, an empty slot,
// the character made (a name, the body, CREATE), ENTER WORLD — and the Legacy Courtyard comes up as a 3D place under
// the Chapter 1 title with the hero able to walk. (The creation screens are Movements'; this checks only the hand-off.)
//   node tools/world3d/test_newgame.mjs [out-dir]      (vite preview on :4173)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || '/tmp/claude-0/test_newgame'; mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:4173/';
const W = (p, ms) => p.waitForTimeout(ms);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fails = [], check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
await p.goto(URL + '?world3d=1'); await p.evaluate(() => localStorage.clear()); await p.goto(URL + '?world3d=1');
await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 150000 }); await W(p, 1500); await shot('01_menu');
const kx = 1280 / 1920, ky = 720 / 1080;
await p.mouse.move(960 * kx, 585 * ky); await W(p, 400); await p.mouse.down(); await W(p, 100); await p.mouse.up();
await p.waitForSelector('.gol-cs .slot', { timeout: 150000 }); await W(p, 800); await shot('02_select');
const slots = await p.$$('.gol-cs .slot'); check(slots.length >= 1, `the character slots (${slots.length}), all empty`);
await p.click('.gol-cs .slot >> nth=0'); await W(p, 500);
await p.click('.gol-cs .kbtn:has-text("CREATE CHARACTER")'); await p.waitForSelector('.gol-cc .cc-input', { timeout: 60000 }); await W(p, 800); await shot('03_create');
await p.fill('.gol-cc .cc-input', 'Tamar'); await W(p, 300);
const bodyBtns = await p.$$('.gol-cc .kopt'); if (bodyBtns.length > 1) await bodyBtns[1].click(); await W(p, 400);
const enabled = await p.$eval('.gol-cc .kbtn.primary', (e) => !e.disabled); check(enabled, 'a name typed: CREATE CHARACTER enabled');
await p.click('.gol-cc .kbtn.primary'); await W(p, 1500); await shot('04_created');
// back on the select screen with the new hero: ENTER WORLD
await p.waitForSelector('.gol-cs .kbtn:has-text("ENTER WORLD")', { timeout: 60000 }); await W(p, 600);
const made = await p.evaluate(() => JSON.parse(localStorage.getItem('godoflegacy.characters') || '{}')); const ch = (made.slots ?? []).map((s) => s.character).find(Boolean);
check(ch && ch.name === 'Tamar' && ch.level >= 1, `the hero saved (${ch ? `${ch.name}, level ${ch.level}, ${ch.classId}` : 'none'})`);
await p.click('.gol-cs .kbtn:has-text("ENTER WORLD")');
let up = true;
try { await p.waitForFunction(() => { const s = window.__game?.scene.getScene('LegacyCourtyardScene'); return !!s && s.sys.isActive() && !!s.a3d && !!s.w3d; }, null, { timeout: 240000 }); } catch { up = false; }
check(up, 'the world comes up on the 3D stage');
if (up) {
  await W(p, 2500);
  const st = await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return { area: s.w3d?.areaId, x: Math.round(s.kin.x), y: Math.round(s.kin.y), title: document.querySelector('.gol-area')?.textContent, dolly: !!s.w3d?.arrive, level: s.character?.level, name: s.character?.name, hp: s.playerHP }; });
  console.log('  ', JSON.stringify(st)); await shot('05_courtyard');
  check(st.area === 'courtyard', `the first place is the Legacy Courtyard (${st.area})`);
  check(/COURTYARD/.test(st.title ?? '') && st.dolly, `Chapter 1 opens under its title ("${st.title}", the dolly ${st.dolly})`);
  await p.keyboard.press('KeyD'); await W(p, 2500); const x0 = st.x; await p.keyboard.down('KeyD'); await W(p, 6000); await p.keyboard.up('KeyD');
  const x1 = await p.evaluate(() => Math.round(window.__game.scene.getScene('LegacyCourtyardScene').kin.x)); check(x1 > x0 + 10, `${st.name} walks (${x0} → ${x1})`); await shot('06_walk');
  const sv = await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const a = s.a3d, k = s.kin; const P = a.project(k.x, k.y, 0); return { dx: Math.abs(s.view.shadow.x - P.sx), dy: Math.abs(s.view.shadow.y - P.sy) }; }).catch(() => null);
  console.log('  shadow vs floor point (restored coords, informational):', JSON.stringify(sv));
}
check(errors.length === 0, `no console errors (${errors.length})`); for (const e of errors.slice(0, 6)) console.log('     ', e);
console.log(fails.length ? `\nFAILED: ${fails.length}\n- ${fails.join('\n- ')}` : '\nALL OK', '— pictures in', OUT);
await b.close(); process.exit(fails.length ? 1 : 0);
