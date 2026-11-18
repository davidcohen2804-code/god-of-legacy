// GOD OF LEGACY — REBORN: browser smoke test of the web build, run in CI against a local static server.
// It drives the real touch interface (taps on the controls the game reports through window.__gol with ?qa=1) in two
// emulated phones held in landscape: Chromium as an Android phone (required) and WebKit as an iPhone (advisory —
// Playwright's WebKit on Linux is close to Safari but is not iOS Safari).
// Writes screenshots and results.json into OUT; exits 1 when the required profile fails.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8060/index.html?qa=1';
const OUT = process.env.OUT || 'qa-out';
fs.mkdirSync(OUT, { recursive: true });

const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const PROFILES = [
  { name: 'android-chromium', required: true, type: chromium, device: devices['Pixel 7 landscape'], args: SWIFTSHADER },
  { name: 'iphone-webkit', required: false, type: webkit, device: devices['iPhone 14 landscape'] },
  { name: 'chromium-16x9', required: true, type: chromium, args: SWIFTSHADER,
    device: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false } },
];
const PROFILE_LIMIT = 9 * 60 * 1000; // a profile that hangs is stopped and reported, so the run always ends
const T0 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

async function runProfile(p) {
  const res = { profile: p.name, required: p.required, ok: false, steps: [], errors: [], log: [] };
  const browser = await p.type.launch({ args: p.args || [] });
  let page = null;
  try {
    const ctx = await browser.newContext({ ...p.device });
    // Diagnostic for WebKit's "glBlitFramebuffer: Read and write color attachments cannot be the same image": count the
    // page's own blitFramebuffer calls (Godot's), so an error with no call behind it points at the browser itself
    // (for instance its read-back of the canvas for a screenshot).
    await ctx.addInitScript(() => {
      const proto = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
      if (!proto) return;
      const orig = proto.blitFramebuffer;
      window.__blits = 0;
      proto.blitFramebuffer = function (...a) {
        window.__blits++;
        if (window.__blits <= 6) {
          const fb = (b) => (this.getParameter(b) ? 'fbo' : 'default');
          console.log('[blit] #' + window.__blits + ' (' + a.join(',') + ') read=' + fb(this.READ_FRAMEBUFFER_BINDING) + ' draw=' + fb(this.DRAW_FRAMEBUFFER_BINDING));
        }
        return orig.apply(this, a);
      };
    });
    page = await ctx.newPage();
    page.on('console', (m) => { res.log.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') res.errors.push(m.text()); });
    page.on('pageerror', (e) => res.errors.push('pageerror: ' + e.message));
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    const state = () => page.evaluate(() => window.__gol || null);
    const waitFor = async (pred, what, ms = 180000) => {
      const end = Date.now() + ms;
      for (;;) {
        const st = await state();
        if (st && pred(st)) return st;
        if (Date.now() > end) throw new Error('timeout waiting for ' + what + ' (last: ' + JSON.stringify(st && { scene: st.scene, flags: st.flags, live: st.live }) + ')');
        await page.waitForTimeout(250);
      }
    };
    const tap = async (key) => {
      const st = await state();
      const r = st && st.rects[key];
      if (!r) throw new Error('control not on screen: ' + key);
      const box = await page.locator('canvas').first().boundingBox();
      const x = box.x + ((r[0] + r[2] / 2) / st.vp[0]) * box.width;
      const y = box.y + ((r[1] + r[3] / 2) / st.vp[1]) * box.height;
      await page.touchscreen.tap(x, y);
    };
    const shot = async (n) => {
      await page.evaluate((x) => console.log('[shot] before ' + x + ', page blits so far ' + (window.__blits || 0)), n);
      await page.screenshot({ path: `${OUT}/${p.name}_${n}.png` });
      await page.evaluate((x) => console.log('[shot] after ' + x), n);
    };
    const step = (s) => { res.steps.push(s); say(p.name, '✓', s); };

    await waitFor((s) => s.scene === 'main_menu', 'the main menu');
    res.loadMs = Date.now() - t0;
    await page.waitForTimeout(1200);
    await shot('1_menu');
    step('main menu loaded in ' + res.loadMs + ' ms');

    await tap('settings');
    await waitFor((s) => s.flags.settings_open === true, 'settings to open', 15000);
    await page.waitForTimeout(400);
    await shot('2_settings');
    await tap('settings_close');
    await waitFor((s) => s.flags.settings_open === false, 'settings to close', 15000);
    step('settings open and close');

    await tap('play');
    await waitFor((s) => s.scene === 'character_select', 'character select', 60000);
    await page.waitForTimeout(800);
    await shot('3_select');
    step('character select reached by tapping Play');

    await tap('slot_warrior');
    const afterLocked = await waitFor((s) => s.flags.locked_tap === 'warrior', 'the locked tap', 15000);
    if (afterLocked.flags.selected !== 'samurai') throw new Error('a locked slot became the selection: ' + afterLocked.flags.selected);
    await page.waitForTimeout(300);
    await shot('4_locked');
    step('locked Warrior refused (selection stays Samurai, toast: ' + afterLocked.flags.toast + ')');

    await tap('slot_samurai');
    await waitFor((s) => s.flags.selected === 'samurai', 'samurai selected', 15000);
    await tap('enter');
    await waitFor((s) => s.scene === 'arena', 'the arena', 60000);
    await page.waitForTimeout(4000);
    const st = await state();
    res.fps = st.fps;
    await shot('5_arena');
    step('arena entered with the Samurai, ' + st.fps + ' fps (software rendering)');

    // M2.1: the Samurai himself — inspection viewpoints (front, side, right hand and katana, feet on the floor).
    const pl = (s) => (s.live && s.live.player) || null;
    const p0 = pl(await waitFor((s) => pl(s) && pl(s).on_floor, 'the Samurai standing on the floor', 20000));
    res.player = p0;
    if (Math.abs(p0.pos[1]) > 0.05) throw new Error('the Samurai is not on the floor: y = ' + p0.pos[1]);
    if (!/Idle/.test(p0.anim)) throw new Error('the Samurai is not idling: ' + p0.anim);
    step(`Samurai on the floor (y ${p0.pos[1]}, lowest foot bone ${p0.feet} m), playing ${p0.anim}, katana ${p0.katana_to_hand} m from the hand bone`);
    for (const v of ['front', 'side', 'hand', 'feet']) {
      await page.evaluate((x) => window.__golCmd && window.__golCmd('cam', x), v);
      await waitFor((s) => pl(s) && pl(s).view === v, 'the ' + v + ' view', 15000);
      await page.waitForTimeout(900);
      await shot('6_' + v);
    }
    await page.evaluate(() => window.__golCmd && window.__golCmd('cam', 'game'));
    await waitFor((s) => pl(s) && pl(s).view === 'game', 'the game view', 15000);
    step('inspection views captured: front, side, right hand + katana, feet');

    // M2.2: locomotion from the keyboard (the touch controls arrive in M2.3). The CI renders in software at a few
    // frames per second, so game time runs slower than real time: the checks wait for states, not for distances.
    await page.evaluate(() => { const c = document.querySelector('canvas'); c.tabIndex = 0; c.focus(); });
    const cs = (s) => (s.live && s.live.camera) || null;
    const start = pl(await state());
    await page.keyboard.down('KeyW');
    const run = pl(await waitFor((s) => pl(s) && pl(s).speed > 3.5, 'running (W)', 60000));
    await page.waitForTimeout(600);
    await shot('7_run');
    await page.keyboard.down('ShiftLeft');
    const spr = pl(await waitFor((s) => pl(s) && pl(s).sprinting && pl(s).speed > 6.5, 'sprinting (Shift+W)', 60000));
    await page.waitForTimeout(400);
    await shot('7_sprint');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    const stopped = pl(await waitFor((s) => pl(s) && pl(s).speed < 0.4 && pl(s).state === 'ground', 'stopping', 60000));
    const moved = Math.hypot(stopped.pos[0] - start.pos[0], stopped.pos[2] - start.pos[2]);
    if (moved < 1.5) throw new Error('W moved the Samurai only ' + moved.toFixed(2) + ' m');
    step(`walk/run/sprint: ${run.anim} at ${run.speed} m/s, ${spr.anim} at ${spr.speed} m/s (sprinting), stopped → ${stopped.anim}; moved ${moved.toFixed(1)} m`);

    await page.keyboard.press('Space');
    const air = pl(await waitFor((s) => pl(s) && pl(s).state === 'air', 'the jump', 30000));
    await shot('7_jump');
    const landed = pl(await waitFor((s) => pl(s) && pl(s).state === 'ground' && pl(s).on_floor, 'landing', 60000));
    step(`jump: in the air (y ${air.pos[1]} m, ${air.anim}), landed (${landed.anim})`);

    const before = pl(await state());
    await page.keyboard.press('KeyK');
    await waitFor((s) => (s.events || []).some((e) => e === 'player_state=dodge'), 'the dodge', 30000);
    const after = pl(await waitFor((s) => pl(s) && pl(s).state === 'ground' && pl(s).speed < 0.4, 'the dodge to end', 60000));
    const rolled = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]);
    if (rolled < 1.0) throw new Error('the dodge moved only ' + rolled.toFixed(2) + ' m');
    step(`dodge: rolled ${rolled.toFixed(1)} m`);

    const yaw0 = cs(await state()).yaw;
    await page.keyboard.down('KeyE');
    const turned = cs(await waitFor((s) => cs(s) && Math.abs(((cs(s).yaw - yaw0 + 540) % 360) - 180) > 25, 'the camera turn (E)', 60000));
    await page.keyboard.up('KeyE');
    await page.waitForTimeout(500);
    await shot('7_camera');
    step(`camera turned ${Math.abs(((turned.yaw - yaw0 + 540) % 360) - 180).toFixed(0)}°; elevation ${turned.elevation}°, distance ${turned.distance} m (${turned.mode})`);

    await tap('arena_menu');
    await waitFor((s) => s.scene === 'main_menu', 'back to the menu', 60000);
    step('back to the main menu');
    res.ok = true;
  } catch (e) {
    res.error = String(e && e.message || e);
    say(p.name, 'FAIL', res.error);
    try { await page.screenshot({ path: `${OUT}/${p.name}_fail.png` }); } catch (e2) { /* (the page may be gone) */ }
  } finally {
    try { res.blits = await page.evaluate(() => window.__blits || 0); } catch (e3) { /* (the page may be gone) */ }
    res.log = res.log.slice(-160);
    await browser.close().catch(() => {});
  }
  return res;
}

const results = [];
for (const p of PROFILES) {
  say('profile', p.name, 'start');
  const r = await Promise.race([runProfile(p), new Promise((res) => setTimeout(() => res({ profile: p.name, required: p.required, ok: false, steps: [], errors: [], log: [], error: 'profile time limit reached' }), PROFILE_LIMIT))]);
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.profile}${r.error ? ' — ' + r.error : ''}`);
  for (const s of r.steps) console.log('   ✓ ' + s);
  for (const e of r.errors.slice(0, 12)) console.log('   console error: ' + e);
  if (r.errors.length) {
    console.log('   console around the errors:');
    for (const l of r.log.filter((x) => /\[shot\]|\[blit\]|\[error\]|\[QA\]/.test(x)).slice(0, 40)) console.log('     ' + l);
  }
  console.log('   page blitFramebuffer calls: ' + (r.blits ?? 'n/a'));
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
process.exit(results.some((r) => r.required && !r.ok) ? 1 : 0);
