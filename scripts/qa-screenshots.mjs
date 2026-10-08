// QA only: captures every current screen of the built game (served at QA_URL) into an output folder,
// plus README.md / index.html galleries. Runs in CI after each build; not part of the game bundle.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = process.env.QA_URL || 'http://localhost:4173/';
const OUT = process.env.QA_OUT || 'qa-shots';
const COMMIT = (process.env.GITHUB_SHA || 'local').slice(0, 7);
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const W = (p, ms) => p.waitForTimeout(ms);
const shots = [];
const shot = async (p, name, w) => { const f = `${w}_${name}.jpg`; await p.screenshot({ path: `${OUT}/${f}`, type: 'jpeg', quality: 85 }); shots.push(f); };
const QA_CHAR = { version: 1, maxSlots: 4, selectedSlotId: 2, slots: [
  { slotId: 1, character: null },
  { slotId: 2, character: { id: 'qa', name: 'QA Test', classId: 'qa-class', level: 1, createdAt: '2026-01-01T00:00:00Z', lastPlayedAt: null, appearanceId: null } },
  { slotId: 3, character: null }, { slotId: 4, character: null }] };

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const k = w / 1920;
  const click = async (x, y) => { await W(p, 300); await p.mouse.move(x * k, y * k); await W(p, 400); await p.mouse.down(); await W(p, 100); await p.mouse.up(); await W(p, 1000); };
  const boot = async () => { await p.goto(URL); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 30000 }); await W(p, 1200); };
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await boot();
  await shot(p, '01_main_menu', w);
  await p.mouse.move(960 * k, 585 * k); await W(p, 600); await shot(p, '02_start_hover', w);
  await click(960, 735); await shot(p, '03_settings', w);
  await p.keyboard.press('Escape'); await W(p, 500);
  await click(960, 860); await shot(p, '04_exit_confirm', w);
  await click(1066, 595); await W(p, 1200); await shot(p, '05_exit_web_message', w);
  await p.keyboard.press('Escape'); await W(p, 500);
  await click(960, 585); await p.waitForSelector('.gol-cs .slot'); await W(p, 700); await shot(p, '06_character_select', w);
  await p.click('.gol-cs .slot >> nth=1'); await p.mouse.move(1000 * k, 500 * k); await W(p, 500); await shot(p, '07_slot_selected', w);
  await p.evaluate((d) => localStorage.setItem('godoflegacy.characters', JSON.stringify(d)), QA_CHAR); await boot();
  await click(960, 585); await p.waitForSelector('.gol-cs .slot'); await W(p, 700); await shot(p, '08_character_filled_QA_data', w);
  await p.click('.gol-cs .ktrash'); await W(p, 400); await shot(p, '09_delete_confirm', w);
  await p.keyboard.press('Escape'); await W(p, 300);
  await p.click('.gol-cs .slot >> nth=0'); await W(p, 300); await p.click('.gol-cs .kbtn:has-text("CREATE CHARACTER")'); // create opens from an empty slot await W(p, 1200); await shot(p, '10_create_placeholder', w);
  await p.goto(URL + '?qa=1'); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 30000 }); await W(p, 1500);
  await p.keyboard.press('F9'); await W(p, 500);
  await shot(p, '11_qa_panel', w);
  await p.close();
}
await b.close();

const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const head = `God Of Legacy — automatic screenshots of build ${COMMIT} (${when})`;
writeFileSync(`${OUT}/README.md`, `# ${head}\n\n${shots.map((f) => `### ${f}\n![${f}](${f})\n`).join('\n')}`);
writeFileSync(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><title>QA screenshots ${COMMIT}</title><body style="background:#111;color:#eee;font:14px sans-serif"><h1>${head}</h1>${shots.map((f) => `<h3>${f}</h3><img src="${f}" style="max-width:100%">`).join('')}</body>`);
writeFileSync(`${OUT}/build.json`, JSON.stringify({ commit: COMMIT, capturedAt: when, files: shots }, null, 2));
console.log(`QA screenshots: ${shots.length}`);
