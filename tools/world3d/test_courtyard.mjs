// The Legacy Courtyard in 3D — the map's headless test (docs/WORLD_3D_SPEC.md §1.9): opens the game at the courtyard
// with ?world3d=1, walks it end to end taking screenshots from the player's own camera, jumps onto a block, talks to
// Aldric, fights a Sproutling brought in by test mode, and checks: no console errors, the hero's body placed on his floor
// point, the frame time. Usage: node tools/world3d/test_courtyard.mjs [out-dir]   (the game served at :4173)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.QA_URL || 'http://localhost:4173/';
const OUT = process.argv[2] || '/tmp/claude-0/test_courtyard'; mkdirSync(OUT, { recursive: true });
const W = (p, ms) => p.waitForTimeout(ms);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], fails = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errors.push('pageerror ' + String(e).slice(0, 300)));
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const q = '?world3d=1&qa=1';
await p.goto(URL + q); await p.evaluate(() => localStorage.clear());
await p.evaluate((d) => localStorage.setItem('godoflegacy.characters', JSON.stringify(d)), { version: 1, maxSlots: 4, selectedSlotId: 2, slots: [{ slotId: 1, character: null }, { slotId: 2, character: { id: 'qa', name: 'QA', classId: 'warrior', level: 12, createdAt: '2026-01-01T00:00:00Z', lastPlayedAt: null, appearanceId: null } }, { slotId: 3, character: null }, { slotId: 4, character: null }] });
await p.goto(URL + q); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 60000 }); await W(p, 800);
await p.mouse.move(640, 390); await W(p, 400); await p.mouse.down(); await W(p, 100); await p.mouse.up();
await p.waitForSelector('.gol-cs .slot', { timeout: 60000 }); await W(p, 800);
await p.click('.gol-cs .slot >> nth=1'); await W(p, 500); await p.click('.gol-cs .kbtn:has-text("ENTER WORLD")');
const t0 = Date.now();
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('LegacyCourtyardScene'); return !!s && s.sys.isActive() && !!s.a3d && !!s.w3d; }, null, { timeout: 240000 });
console.log('the 3D courtyard up in', Date.now() - t0, 'ms (software GL)');
await W(p, 6000);
const S = (fn) => p.evaluate(fn);
const shot = (name) => p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
const state = () => S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; return { x: k.x, y: k.y, z: k.z, area: s.world.area.id, hp: s.hp, grounded: k.grounded, supportZ: k.supportZ, mode: s.mode }; });
const tele = (x, y) => p.evaluate(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.kin.x = x; s.kin.y = y; s.kin.vx = 0; s.kin.vy = 0; }, [x, y]).then(() => W(p, 1500));
const F = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').w3d.floor);
console.log('floor', JSON.stringify(F));
// 1) end to end: a screenshot every 200 px along the floor's middle, from the player's own camera
for (let x = F.x0 + 100, i = 0; x <= F.x1 - 100; x += 200, i++) { await tele(x, (F.back + F.front) / 2); await shot(`walk_${String(i).padStart(2, '0')}`); }
check((await state()).area === 'courtyard', 'still in the courtyard after the walk');
// 2) the body on its floor point: the drawn sprite's foot against the stage's projection of (x, y, 0)
const placed = await S(() => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const a = s.a3d, k = s.kin, v = s.view.shadow;
  s.events.once('prerender', () => { const P = a.project(k.x, k.y, 0); res({ dx: Math.abs(v.x - P.sx), dy: Math.abs(v.y - P.sy) }); }); })); // (after the stage has placed the frame: the contact shadow sits on the projected floor point)
check(placed.dx < 3 && placed.dy < 3, `the hero's feet drawn on his floor point (${placed.dx.toFixed(1)}, ${placed.dy.toFixed(1)} px off)`);
// 3) a jump onto a block: the first block's top (prop block-0: x 186..270, stand 436..453, 63 high)
await tele(228, 500); await W(p, 800);
await p.keyboard.press('KeyW'); await W(p, 200); await p.keyboard.down('KeyE'); await W(p, 100); await p.keyboard.up('KeyE'); await W(p, 7000); // (software GL: the sim runs slow)
const onBlock = await state(); console.log('after the jump', JSON.stringify(onBlock));
await shot('block');
// 4) Aldric: walk up and talk (the dialog opens)
await tele(820, 455); await W(p, 4000); await p.keyboard.press('KeyY'); await W(p, 3000);
const talk = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return !!s.npcDialog?.isOpen; });
check(talk, 'Aldric\'s talk opens');
await shot('aldric'); await p.keyboard.press('Escape'); await W(p, 500);
// 5) a fight: the basic attack and a skill with the 3D pieces, no errors
await tele(1000, 560); await W(p, 500); await p.keyboard.press('Space'); await W(p, 700); await p.keyboard.press('Digit1'); await W(p, 1500); await shot('skill');
// 6) the frame time (software GL: only a relative measure) and the stage's draw count
const perf = await S(() => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 20) requestAnimationFrame(f); else res({ avg: t.reduce((a, b) => a + b, 0) / t.length, worst: Math.max(...t), fps: s.game.loop.actualFps }); }; requestAnimationFrame(f); }));
console.log('frame', JSON.stringify(perf));
check(errors.length === 0, `no console errors (${errors.length})`); for (const e of errors.slice(0, 10)) console.log('   ', e);
console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL OK', '— screenshots in', OUT);
await b.close();
process.exit(fails.length ? 1 : 0);
