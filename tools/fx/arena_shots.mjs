// PVP 3D training shots for the class chats: opens the game (vite preview on :4173) as CLS in the arena's training
// room against the sparring knight, then for every "skill:extraMs:name" argument resets the range (MID), casts the
// skill and shoots `extraMs` (sim time) after its startup, to $SHOTS/name.jpg. A skill id may carry "+hold" to keep
// its key down until the shot (held skills).
// Run: CLS=book_mage node tools/fx/arena_shots.mjs frost_nova:100:n1 storm_field:400:s1
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4173/';
const OUT = process.env.SHOTS ?? '/tmp/shots';
const CLS = process.env.CLS ?? 'book_mage';
fs.mkdirSync(OUT, { recursive: true });
const W = (p, ms) => p.waitForTimeout(ms);
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => { errors.push(String(e).slice(0, 300)); console.log('PAGEERROR', String(e).slice(0, 300)); });
await p.goto(URL + '?qa=1'); await p.evaluate(() => localStorage.clear());
await p.evaluate((cls) => localStorage.setItem('godoflegacy.characters', JSON.stringify({ version: 1, maxSlots: 4, selectedSlotId: 2, slots: [{ slotId: 1, character: null }, { slotId: 2, character: { id: 'qa', name: 'QA', classId: cls, level: 60, createdAt: '2026-01-01T00:00:00Z', lastPlayedAt: null, appearanceId: null } }, { slotId: 3, character: null }, { slotId: 4, character: null }] })), CLS);
await p.goto(URL + '?qa=1');
await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 240000 });
await W(p, 1500);
await p.evaluate((cls) => { const g = window.__game; const ch = JSON.parse(localStorage.getItem('godoflegacy.characters')).slots[1].character; g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key)); g.scene.start('LegacyCourtyardScene', { pvpRoom: 'qa-training', vs: 'training', fighter: ch, botCls: 'warrior' }); }, CLS);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return s?.sys.isActive() && s.pvpReady && s.bot && s.a3d; }, null, { timeout: 300000 });
await W(p, 6000);
await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const i = s.kit.findIndex((k) => k?.id === 'arcane_bolt'); if (i >= 0) s.useSlot(i); }); await W(p, 15000); // (a first cast: the class's painted sheets start loading)
console.log('READY', errors.slice(0, 3).join(' | '));
const sim = () => p.evaluate(() => window.__game.scene.getScene('LegacyCourtyardScene').simMs);
for (const arg of process.argv.slice(2)) {
  const [id0, extra, name] = arg.split(':'); const hold = id0.endsWith('+hold'); const id = id0.replace('+hold', '');
  const r = await p.evaluate(([id, hold]) => {
    const s = window.__game.scene.getScene('LegacyCourtyardScene');
    s.trainingReset('MID');
    const i = s.kit.findIndex((k) => k?.id === id); if (i < 0) return { err: 'no ' + id + ' in ' + s.kit.map((k) => k?.id).join(',') };
    s.aim = { x: 1, y: 0 }; s.dir = 'right';
    if (!hold) s.useSlot(i);
    const k = s.kit[i]; return { t0: s.simMs, startup: k.startup ?? 0, key: s.bindings?.[`slot${i}`] };
  }, [id, hold]);
  if (r.err) { console.log(r.err); continue; }
  const key = hold ? String(r.key).toLowerCase() : null; if (key) await p.keyboard.down(key);
  await W(p, 300);
  const until = r.t0 + (r.startup || 0) + Number(extra || 0);
  try { await p.waitForFunction((u) => window.__game.scene.getScene('LegacyCourtyardScene').simMs >= u, until, { timeout: 1200000, polling: 100 }); }
  catch (e) { console.log('STALL', name, await sim(), until, errors.slice(-5).join('\n')); continue; }
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, timeout: 200000 });
  console.log('SHOT', name, (await sim()) - r.t0);
  if (key) await p.keyboard.up(key);
  await W(p, 2500);
}
if (errors.length) console.log('ERRORS', errors.slice(0, 5).join('\n'));
await b.close();
