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
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const k = w / 1920;
  const click = async (x, y) => { await W(p, 300); await p.mouse.move(x * k, y * k); await W(p, 400); await p.mouse.down(); await W(p, 100); await p.mouse.up(); await W(p, 1000); };
  const boot = async () => { await p.goto(URL); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 30000 }); await W(p, 1200); };
  // START → CHOOSE YOUR HERO, the five heroes (a click that lands while the menu is still settling is tried again)
  const toSelect = async () => { for (let i = 0; ; i++) { await click(960, 585); try { await p.waitForSelector('.gol-cs .hrow', { timeout: 20000 }); return; } catch (e) { if (i >= 2) throw e; } } };
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await boot();
  await shot(p, '01_main_menu', w);
  await p.mouse.move(960 * k, 585 * k); await W(p, 600); await shot(p, '02_start_hover', w);
  await click(960, 800); await shot(p, '03_settings', w);
  await p.keyboard.press('Escape'); await W(p, 500);
  await click(960, 910); await shot(p, '04_exit_confirm', w);
  await click(1066, 595); await W(p, 1200); await shot(p, '05_exit_web_message', w);
  await p.keyboard.press('Escape'); await W(p, 500);
  await click(960, 690); await p.waitForSelector('.gol-ps'); await W(p, 1500);
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('PvpSelectScene'); return !!s?.arts && s.arts.l.enter >= 1 && !s.cameras.main.fadeEffect.isRunning; }, null, { timeout: 60000 }).catch(() => {}); // (software GL draws the living fighters slowly: wait until yours has come in)
  await W(p, 800); await shot(p, '05b_pvp_select', w); // PvP ARENA: the fighter select
  await p.keyboard.press('Escape'); await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 30000 }); await W(p, 1200);
  await toSelect(); await W(p, 700); await shot(p, '06_hero_select', w); // (no characters to make: the five heroes, each played as he is — David 2 Nov 18:41)
  await p.click('.gol-cs .hrow >> nth=1'); await p.mouse.move(1000 * k, 500 * k); await W(p, 900); await shot(p, '07_hero_samurai', w);
  await p.click('.gol-cs .hrow >> nth=4'); await p.mouse.move(1000 * k, 500 * k); await W(p, 900); await shot(p, '08_hero_gambler', w);
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
