// GOD OF LEGACY — REBORN: browser smoke test of the web build, run in CI against a local static server.
// It drives the real touch interface (taps on the controls the game reports through window.__gol with ?qa=1) in two
// emulated phones held in landscape — Chromium as an Android phone (required) and WebKit as an iPhone (advisory —
// Playwright's WebKit on Linux is close to Safari but is not iOS Safari) — and the keyboard in desktop Chromium at
// 16:9 (required). M3: the katana chain against the training dummy (each strike's damage once, the third's push), a
// deliberate miss, and moving, dodging and attacking again; on the phones, attacking while the stick is held. M4: the
// Training Automaton's reactions, Phantom Chain → Chain Pull, Rising Slash → Aerial Pursuit, and (Stage C) its
// telegraphed sweep evaded with Shadow Step → Shadow Counter, and a plain roll that opens nothing.
// Writes screenshots and results.json into OUT; exits 1 when the required profile fails.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8060/index.html?qa=1';
const OUT = process.env.OUT || 'qa-out';
fs.mkdirSync(OUT, { recursive: true });

const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const PROFILES = [
  { name: 'android-chromium', kind: 'phone', required: true, type: chromium, device: devices['Pixel 7 landscape'], args: SWIFTSHADER },
  { name: 'iphone-webkit', kind: 'phone', required: false, type: webkit, device: devices['iPhone 14 landscape'] },
  { name: 'chromium-16x9', kind: 'desktop', required: true, type: chromium, args: SWIFTSHADER,
    device: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false } },
];
const PROFILE_LIMIT = 20 * 60 * 1000; // a profile that hangs is stopped and reported, so the run always ends
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
      await page.screenshot({ path: `${OUT}/${p.name}_${n}.png`, timeout: 90000 });
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
    // (the arena marks itself first and then builds — the courtyard's shaders can take a while in software rendering)
    await waitFor((s) => s.live && s.live.player, 'the arena to finish building', 240000);
    await page.waitForTimeout(2500);
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
    // (the slowest profile — the Pixel's 2265×945 canvas in software — skips these: the other two take them)
    for (const v of p.name === 'android-chromium' ? [] : ['front', 'side', 'hand', 'feet', 'vista']) {
      await page.evaluate((x) => window.__golCmd && window.__golCmd('cam', x), v);
      await waitFor((s) => pl(s) && pl(s).view === v, 'the ' + v + ' view', 15000);
      await page.waitForTimeout(900);
      await shot('6_' + v);
    }
    await page.evaluate(() => window.__golCmd && window.__golCmd('cam', 'game'));
    await waitFor((s) => pl(s) && pl(s).view === 'game', 'the game view', 15000);
    if (p.name !== 'android-chromium') step('inspection views captured: front, side, right hand + katana, feet, the courtyard toward the arch');

    // M4 Stage B: the Training Automaton — its look (front, side, back, the face) and its reactions, each held still for
    // its shot: launched (high in the arc), down on its back, rising. At a quarter of the game's speed, so the slow
    // software renderer catches each moment. (The phone profile, the slowest, skips the shots.)
    const au = (s) => (s.live && s.live.automaton) || null;
    const cmd = (...a) => page.evaluate((x) => window.__golCmd && window.__golCmd(...x), a);
    {
      await cmd('auto', 'spar', 0); // (its sparring script off: each check below starts its attacks itself)
      const a0 = au(await waitFor((s) => au(s), 'the automaton', 15000));
      if (a0.state !== 'stand' || a0.hp !== 150 || Math.abs(a0.pos[1]) > 0.01) throw new Error('the automaton is not standing on its mark: ' + JSON.stringify(a0));
      step(`Training Automaton on its mark (${a0.pos.join(', ')}), ${a0.state}, ${a0.anim}, ${a0.hp} HP`);
      if (p.name !== 'android-chromium') {
        for (const v of ['auto_front', 'auto_side', 'auto_back', 'auto_face']) {
          await cmd('cam', v);
          await waitFor((s) => pl(s) && pl(s).view === v, 'the ' + v + ' view', 15000);
          await page.waitForTimeout(900);
          await shot('6_' + v);
        }
        await cmd('cam', 'auto_side');
        await cmd('speed', 0.25);
        const hold = async (pred, what, tag, settle) => {
          await waitFor((s) => au(s) && pred(au(s)), what, 40000);
          if (settle) await page.waitForTimeout(settle);
          await cmd('auto', 'freeze', 60);
          await waitFor((s) => au(s) && au(s).frozen, 'the automaton held still', 15000);
          await page.waitForTimeout(700);
          await shot('6_auto_' + tag);
          await cmd('auto', 'thaw');
        };
        await cmd('auto', 'launch');
        await hold((a) => a.state === 'air' && a.pos[1] > 1.7, 'the automaton high in the air', 'launched', 0);
        await hold((a) => a.state === 'down', 'the automaton down', 'down', 1300);
        await hold((a) => a.state === 'getup', 'the automaton rising', 'rising', 2000);
        const a1 = au(await waitFor((s) => au(s) && au(s).state === 'stand', 'the automaton standing again', 60000));
        await cmd('speed', 1);
        await cmd('cam', 'game');
        await waitFor((s) => pl(s) && pl(s).view === 'game', 'the game view', 15000);
        if (Math.abs(a1.apex - 2.2) > 0.05 || Math.abs(a1.airtime - 0.9) > 0.05 || a1.launches !== 1) throw new Error('the launch: ' + JSON.stringify(a1));
        step(`automaton: launched to ${a1.apex} m, ${a1.airtime} s in the air (held for the shots), down on its back, rose and stands again`);
      }
    }

    const cs = (s) => (s.live && s.live.camera) || null;
    const ctl = (s) => (s.live && s.live.controls) || null;
    // (stand the Samurai where a long run is free of the ruins: x, z, facing in degrees — 90 = east)
    const place = async (x, z, f) => {
      await page.evaluate((a) => window.__golCmd('place', ...a), [x, z, f]);
      await waitFor((s) => s.flags.placed === `${x},${z},${f}`, 'the Samurai to be placed', 15000);
      await page.waitForTimeout(300);
    };

    // Touches by id, several at once: Chromium through the DevTools protocol (real touch events), WebKit through
    // synthetic touch events on the canvas (Godot's web build listens there).
    const fingers = new Map();
    let cdp = null;
    if (p.type === chromium) cdp = await page.context().newCDPSession(page);
    let geo = null; // the canvas's box and the game's viewport, read once (each read costs a slow frame here)
    const toPage = async (gx, gy) => {
      if (!geo) geo = { box: await page.locator('canvas').first().boundingBox(), vp: (await state()).vp };
      return [geo.box.x + (gx / geo.vp[0]) * geo.box.width, geo.box.y + (gy / geo.vp[1]) * geo.box.height];
    };
    const touch = async (type, id, gx, gy) => {
      if (type !== 'end') fingers.set(id, await toPage(gx, gy));
      const moved = fingers.get(id);
      if (type === 'end') fingers.delete(id);
      const pts = [...fingers].map(([i, [x, y]]) => ({ id: i, x, y }));
      if (cdp) {
        // (start and move list every finger on the glass; an end lists the finger that lifts — Chromium releases the
        // points an end names, so naming the ones that stay lifted the wrong finger)
        const lifted = [{ id, x: moved[0], y: moved[1] }];
        await cdp.send('Input.dispatchTouchEvent', { type: type === 'start' ? 'touchStart' : type === 'move' ? 'touchMove' : 'touchEnd', touchPoints: type === 'end' ? lifted : pts });
      } else {
        // (Safari has no Touch constructor: an event carrying plain touch records, which is all Godot reads.)
        await page.evaluate(({ type, id, moved, pts }) => {
          const c = document.querySelector('canvas');
          const mk = (q) => ({ identifier: q.id, target: c, clientX: q.x, clientY: q.y, pageX: q.x, pageY: q.y,
            screenX: q.x, screenY: q.y, radiusX: 4, radiusY: 4, force: 1 });
          const ev = new Event('touch' + type, { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'touches', { value: pts.map(mk) });
          Object.defineProperty(ev, 'targetTouches', { value: pts.map(mk) });
          Object.defineProperty(ev, 'changedTouches', { value: [mk({ id, x: moved[0], y: moved[1] })] });
          c.dispatchEvent(ev);
        }, { type, id, moved, pts });
      }
    };
    const centre = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
    const swipe = async (id, from, to, n = 6, holdMs = 0) => {
      for (let i = 1; i <= n; i++) await touch('move', id, from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n);
      if (holdMs) await page.waitForTimeout(holdMs);
    };
    const tapAt = async (key) => {
      const r = (await state()).rects[key];
      if (!r) throw new Error('control not on screen: ' + key);
      const [x, y] = centre(r);
      await touch('start', 9, x, y);
      await page.waitForTimeout(150);
      await touch('end', 9);
    };
    const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

    // M3: the sword. The game reports its combat state (phase, strikes so far, the last strikes' [step, hits, damage])
    // and the dummy's (hp, distance off its mark, last push).
    const cb = (s) => (s.live && s.live.combat) || null;
    const dm = (s) => (s.live && s.live.dummy) || null;
    // The strikes since `from` (a strikes count), oldest first.
    const since = (s, from) => { const c = cb(s); const n = c.strikes - from; return n > 0 ? c.log.slice(-n) : []; };
    // Mashing attack (as a player hammering the button) until `n` new strikes have started, then waiting for the last
    // one to finish. Presses that land while a strike runs are held for the next one by the game's rules.
    // - mashBy(press): press, look at the state, press again (keyboard — fine at the desktop profile's ~4 fps);
    // - mashInPage(key): the page itself taps the button every 60 ms (touch events on the canvas, as a finger's) until
    //   told to stop — the software-rendered Pixel profile draws ~1 frame a second, and a press sent from here costs a
    //   frame or more each, so presses sent one by one let the chain's window pass between two of them.
    const mashBy = (press) => async (n, what) => {
      const s0 = await state();
      const from = cb(s0).strikes;
      const end = Date.now() + 120000;
      for (;;) {
        await press();
        const s = await state();
        if (cb(s).strikes - from >= n) break;
        if (Date.now() > end) throw new Error(`${what}: only ${cb(s).strikes - from} strikes started (${JSON.stringify(cb(s))})`);
        await page.waitForTimeout(80);
      }
      const done = await waitFor((s) => cb(s) && cb(s).phase === 'FREE', what + ': the strikes to finish', 60000);
      return { s0, from, done };
    };
    const mashInPage = (key) => async (n, what) => {
      const s0 = await state();
      const from = cb(s0).strikes;
      const [x, y] = await toPage(...centre(s0.rects[key]));
      await page.evaluate(({ x, y }) => {
        const c = document.querySelector('canvas');
        const mk = () => ({ identifier: 77, target: c, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, radiusX: 4, radiusY: 4, force: 1 });
        const fire = (type, down) => {
          const ev = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'touches', { value: down ? [mk()] : [] });
          Object.defineProperty(ev, 'targetTouches', { value: down ? [mk()] : [] });
          Object.defineProperty(ev, 'changedTouches', { value: [mk()] });
          c.dispatchEvent(ev);
        };
        window.__mash = setInterval(() => { fire('touchstart', true); fire('touchend', false); }, 60);
      }, { x, y });
      try {
        await waitFor((s) => cb(s) && cb(s).strikes - from >= n, `${what}: ${n} strikes`, 120000);
      } finally {
        await page.evaluate(() => clearInterval(window.__mash));
      }
      const done = await waitFor((s) => cb(s) && cb(s).phase === 'FREE', what + ': the strikes to finish', 60000);
      return { s0, from, done };
    };
    // The chain against the dummy standing just in front: B1 → B2 → B3, each confirmed once, 10 + 12 + 18, the third
    // pushing it about 0.5 m; then it slides back onto its mark.
    const chainTest = async (mash, tag) => {
      await place(0, 1.6, 180);
      await waitFor((s) => dm(s) && dm(s).alive && dm(s).off_mark < 0.05, 'the dummy on its mark', 30000);
      const before = dm(await state());
      const hp0 = before.hp;
      const { from, done } = await mash(3, tag + ' chain');
      const strikes = since(done, from);
      const first3 = strikes.slice(0, 3).map((e) => [e.step, e.hits, e.damage]);
      if (JSON.stringify(first3) !== JSON.stringify([[1, 1, 10], [2, 1, 12], [3, 1, 18]])) {
        throw new Error(`${tag}: the chain's strikes [step, hits, damage] were ${JSON.stringify(first3)} (want 1/1/10, 2/1/12, 3/1/18)`);
      }
      const dealt = strikes.reduce((a, e) => a + e.damage, 0);
      const hp1 = dm(done).hp;
      if (hp0 - hp1 !== dealt) throw new Error(`${tag}: the dummy lost ${hp0 - hp1} HP but the strikes dealt ${dealt}`);
      const pushed = dm(await waitFor((s) => dm(s) && dm(s).pushes > before.pushes, 'the third strike\'s push', 30000)).last_push;
      if (pushed < 0.4 || pushed > 0.6) throw new Error(`${tag}: the third strike pushed the dummy ${pushed} m (want ~0.5)`);
      await shot('9_' + tag + '_chain');
      await waitFor((s) => dm(s) && dm(s).off_mark < 0.05, 'the dummy back on its mark', 30000);
      return `${tag}: B1 → B2 → B3 = ${first3.map((e) => e[2]).join(' + ')} (each strike hit once; ${strikes.length - 3} extra press${strikes.length === 4 ? '' : 'es'} after), dummy ${hp0} → ${hp1} HP, pushed ${pushed} m by the third and back on its mark`;
    };
    // Heavy (M4 stage A): one strike on its own button — one hit for 30, a push of about 0.5 m.
    const heavyTest = async (press, tag) => {
      await place(0, 1.6, 180);
      await waitFor((s) => dm(s) && dm(s).alive && dm(s).off_mark < 0.05, 'the dummy on its mark', 30000);
      const s0 = await state();
      const from = cb(s0).strikes, hp0 = dm(s0).hp, pushes0 = dm(s0).pushes;
      await press();
      const done = await waitFor((s) => cb(s) && cb(s).strikes > from && cb(s).phase === 'FREE', tag + ' heavy to finish', 90000);
      const h = since(done, from)[0];
      if (!h || h.id !== 'heavy' || h.hits !== 1 || h.damage !== 30) throw new Error(`${tag}: the heavy strike was ${JSON.stringify(h)} (want one hit for 30)`);
      if (hp0 - dm(done).hp !== 30) throw new Error(`${tag}: the dummy lost ${hp0 - dm(done).hp} HP to a heavy`);
      const pushed = dm(await waitFor((s) => dm(s) && dm(s).pushes > pushes0, 'the heavy\'s push', 30000)).last_push;
      if (pushed < 0.4 || pushed > 0.6) throw new Error(`${tag}: the heavy pushed the dummy ${pushed} m (want ~0.5)`);
      await shot('9_' + tag + '_heavy');
      await waitFor((s) => dm(s) && dm(s).off_mark < 0.05, 'the dummy back on its mark', 30000);
      return `${tag}: HEAVY — one hit for 30 (dummy ${hp0} → ${dm(done).hp}), pushed ${pushed} m`;
    };
    // M4 Stage B: Phantom Chain → capture → Chain Pull, on the Training Automaton. He stands 6 m north of it facing it
    // (the dummy beyond the chain's 9 m); the chain is thrown and the automaton held (8 damage); the PULL button
    // appears and is pressed — by touch, the page itself taps it the moment it shows, as a quick thumb would — and the
    // automaton is dragged to 1.6 m in front of him (6 more).
    const ready = (s) => au(s) && au(s).state === 'stand' && cb(s) && cb(s).phase === 'FREE' && !((cb(s).cooldowns || {}).phantom_chain > 0);
    const chainPullTest = async (throwIt, startPull, stopPull, tag) => {
      await cmd('auto', 'place', -3.5, -2.5, 180);
      await place(-3.5, -8.5, 0);
      await waitFor(ready, tag + ': ready to throw (the automaton standing, the chain off cooldown)', 120000);
      const hp0 = au(await state()).hp;
      await throwIt();
      const held = await waitFor((s) => au(s) && au(s).state === 'captured' && cb(s).conds[0] === 'chain_pull', tag + ': the automaton held and PULL on its button', 60000);
      if (hp0 - au(held).hp !== 8) throw new Error(`${tag}: the chain dealt ${hp0 - au(held).hp} (want 8)`);
      await startPull();
      let done;
      try {
        done = await waitFor((s) => cb(s) && cb(s).pull && cb(s).pull.result, tag + ': the pull to end', 60000);
      } finally {
        await stopPull();
      }
      const r = cb(done).pull;
      if (r.result !== 'arrived') throw new Error(`${tag}: the pull ended ${JSON.stringify(r)}`);
      const a = au(await waitFor((s) => au(s) && hp0 - au(s).hp === 14, tag + ': the pull\'s 6 damage on arrival', 30000));
      if (Math.abs(a.pos[0] + 3.5) > 0.15 || Math.abs(a.pos[2] + 6.9) > 0.15) throw new Error(`${tag}: the automaton ended at ${a.pos} (want 1.6 m in front of him: -3.5, -6.9)`);
      await shot('9_' + tag + '_pulled');
      return `${tag}: CHAIN from 6 m → the automaton held (8), PULL on its button → dragged ${r.dist} m in ${r.time} s to 1.6 m in front of him (6): ${hp0} → ${a.hp} HP`;
    };
    // ...then Rising Slash throws it up (16) and Aerial Pursuit — its button pressed the moment it shows — leaps after it
    // and strikes it in the air (14); both come back down.
    const risePursueTest = async (riseIt, startPursue, stopPursue, tag) => {
      const s0 = await waitFor((s) => cb(s) && cb(s).phase === 'FREE' && au(s) && au(s).state !== 'pulled' && au(s).state !== 'air', tag + ': ready to rise', 60000);
      const hp0 = au(s0).hp;
      await riseIt();
      const up = await waitFor((s) => au(s) && au(s).state === 'air' && cb(s).conds[0] === 'aerial_pursuit', tag + ': launched, PURSUE on its button', 60000);
      if (hp0 - au(up).hp !== 16) throw new Error(`${tag}: Rising Slash dealt ${hp0 - au(up).hp} (want 16)`);
      await startPursue();
      let hit;
      try {
        hit = await waitFor((s) => cb(s) && cb(s).log.some((e) => e.id === 'aerial_pursuit' && e.hits === 1), tag + ': the pursuit\'s strike', 60000);
      } finally {
        await stopPursue();
      }
      await shot('9_' + tag + '_pursuit');
      const down = await waitFor((s) => cb(s) && cb(s).body === 'ground' && cb(s).phase === 'FREE' && au(s) && au(s).state !== 'air', tag + ': both back on the ground', 60000);
      if (hp0 - au(down).hp !== 30) throw new Error(`${tag}: rise + pursuit dealt ${hp0 - au(down).hp} (want 16 + 14)`);
      return `${tag}: RISE launched it (16) → PURSUE leapt (${hit.flags.leap} m: forward, height) and struck it in the air (14) → ${hp0} → ${au(down).hp} HP; both landed`;
    };
    // Keys pressed again and again until something has happened (the keyboard's way to press a button the moment it
    // shows).
    const pressUntil = (key, done) => async () => {
      const end = Date.now() + 30000;
      for (;;) {
        await page.keyboard.press(key);
        const s = await state();
        if (done(s)) return;
        if (Date.now() > end) throw new Error(`the key ${key} did nothing: ` + JSON.stringify(cb(s)));
        await page.waitForTimeout(60);
      }
    };

    // M4 Stage C: the automaton's telegraphed sweep (started by the page: 'auto attack'), Shadow Step pressed by the
    // game itself 0.46 s into it (the 'arm' command puts the press into the input buffer at that moment of the attack —
    // the same path a key takes — so the slow software renderer cannot make it late) → the blade crosses his Shadow
    // Origin: evaded, COUNTER on its button → pressed (touch: the page taps it the moment it shows) → the counter dashes
    // back and its cut lands (14); he takes no damage.
    const spar = (s) => au(s) && au(s).state === 'stand' && !(au(s).cadence > 0) && cb(s) && cb(s).phase === 'FREE'
      && !((cb(s).cooldowns || {}).shadow_step > 0);
    const counterTest = async (pressCounter, stopCounter, tag) => {
      await cmd('auto', 'place', -3.5, -2.5, 180);
      await place(-3.5, -4.2, 0); // 1.7 m in front of it, facing it
      await waitFor(spar, tag + ': ready (the automaton on guard, STEP off cooldown)', 120000);
      const s0 = await state();
      const hp0 = au(s0).hp, ev0 = cb(s0).evasions, me0 = cb(s0).hp;
      await cmd('arm', 'skill2', 0.46);
      await cmd('auto', 'attack');
      await waitFor((s) => cb(s) && cb(s).evasions > ev0 && cb(s).conds[0] === 'shadow_counter', tag + ': the evasion and COUNTER on its button', 60000);
      await pressCounter(); // (at once: a screenshot first takes longer here than the window's 600 ms of game time)
      try {
        await waitFor((s) => cb(s) && cb(s).log.some((e) => e.id === 'shadow_counter' && e.hits === 1), tag + ': the counter\'s cut', 60000);
      } finally {
        await stopCounter();
      }
      await shot('9_' + tag + '_countered');
      const done = await waitFor((s) => cb(s) && cb(s).phase === 'FREE' && au(s) && au(s).state !== 'attack', tag + ': the exchange to end', 60000);
      if (hp0 - au(done).hp !== 14) throw new Error(`${tag}: the counter dealt ${hp0 - au(done).hp} (want 14)`);
      if (cb(done).hp !== me0 || cb(done).evasions !== ev0 + 1) throw new Error(`${tag}: after the evasion: ${JSON.stringify(cb(done))}`);
      return `${tag}: the sweep (550 ms telegraph) → STEP pressed 0.46 s into it → the blade crossed his shadow: evaded once, COUNTER on its button → the counter dashed ${cb(done).dash} m and its cut landed (14): ${hp0} → ${au(done).hp} HP; he took no damage`;
    };
    // ...and a plain DODGE (the roll) at the same moment: avoided or struck, never an evasion — no COUNTER.
    const rollTest = async (tag) => {
      await cmd('auto', 'place', -3.5, -2.5, 180);
      await place(-3.5, -4.2, 0);
      await waitFor(spar, tag + ': ready to roll', 120000);
      const s0 = await state();
      const ev0 = cb(s0).evasions, n0 = au(s0).attacks;
      await cmd('arm', 'dodge', 0.5);
      await cmd('auto', 'attack');
      const end = await waitFor((s) => au(s) && au(s).attacks > n0 && au(s).state !== 'attack' && s.flags.armed_press, tag + ': the attack against the roll to end', 60000);
      const r = au(end).last_attack;
      if (r === 'evaded' || cb(end).evasions !== ev0 || cb(end).conds.some((c) => c)) throw new Error(`${tag}: a roll was taken for an evasion: ${r} ${JSON.stringify(cb(end))}`);
      return `${tag}: a plain DODGE 0.5 s into the sweep: ${r} — no evasion, no COUNTER`;
    };

    // A throw at the empty courtyard: it flies its 9 m and misses — nothing is held, nothing opens, no damage.
    const chainMissTest = async (throwIt, tag) => {
      await place(-8, 8, 90); // facing east along the courtyard's south side: no target within 9 m of his aim
      await waitFor(ready, tag + ': ready to throw again', 120000);
      const s0 = await state();
      await throwIt();
      const m = await waitFor((s) => s.flags.chain_miss, tag + ': the chain to miss', 60000);
      if (m.flags.chain_miss !== 'range') throw new Error(`${tag}: the chain ended ${m.flags.chain_miss} (want: its full 9 m, nothing touched)`);
      const s1 = await state();
      if (au(s1).hp !== au(s0).hp || dm(s1).hp !== dm(s0).hp || au(s1).state === 'captured' || cb(s1).conds.some((c) => c)) throw new Error(`${tag}: a missed chain did something: ${JSON.stringify({ auto: au(s1), conds: cb(s1).conds })}`);
      return `${tag}: CHAIN at the empty courtyard — flew its 9 m and missed: nothing held, no PULL, no damage`;
    };
    // The page taps a button the moment it is on screen, every 60 ms, until told to stop (a quick thumb).
    const tapWhenShown = (key) => () => page.evaluate((k) => {
      const c = document.querySelector('canvas');
      window.__condTap = setInterval(() => {
        const st = window.__gol, r = st && st.rects && st.rects[k];
        if (!r) return;
        const b = c.getBoundingClientRect();
        const x = b.left + ((r[0] + r[2] / 2) / st.vp[0]) * b.width, y = b.top + ((r[1] + r[3] / 2) / st.vp[1]) * b.height;
        const mk = () => ({ identifier: 78, target: c, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, radiusX: 4, radiusY: 4, force: 1 });
        const fire = (type, down) => {
          const ev = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'touches', { value: down ? [mk()] : [] });
          Object.defineProperty(ev, 'targetTouches', { value: down ? [mk()] : [] });
          Object.defineProperty(ev, 'changedTouches', { value: [mk()] });
          c.dispatchEvent(ev);
        };
        fire('touchstart', true);
        fire('touchend', false);
      }, 60);
    }, key);
    const stopTaps = () => page.evaluate(() => clearInterval(window.__condTap));
    // The keyboard's 4 (the first conditional button), pressed again and again until the pull has begun.
    const pullByKey = async () => {
      const end = Date.now() + 30000;
      for (;;) {
        await page.keyboard.press('Digit4');
        const s = await state();
        if ((cb(s).pull && cb(s).pull.result) || (au(s) && au(s).state === 'pulled')) return;
        if (Date.now() > end) throw new Error('the key 4 did not start the pull: ' + JSON.stringify(cb(s)));
        await page.waitForTimeout(60);
      }
    };

    // A strike at the empty air: no damage, and the next strike is the first again.
    const missTest = async (mash, tag) => {
      await place(6, 6, 0); // 8 m from the dummy, facing away from it
      const hp0 = dm(await state()).hp;
      const a = await mash(1, tag + ' miss');
      const b = await mash(1, tag + ' second miss');
      const s1 = since(a.done, a.from)[0], s2 = since(b.done, b.from)[0];
      if (s1.hits !== 0 || s1.damage !== 0 || dm(b.done).hp !== hp0) throw new Error(`${tag}: a strike at the air did damage: ${JSON.stringify([s1, dm(b.done)])}`);
      if (s2.step !== 1) throw new Error(`${tag}: after a miss the next strike was strike ${s2.step} (want 1)`);
      return `${tag}: a deliberate miss dealt nothing (dummy stays ${hp0} HP) and the next strike was the first again`;
    };

    const touchTests = async () => {
      const st0 = await state();
      const box = await page.locator('canvas').first().boundingBox();
      const css = box.width / st0.vp[0];
      const keys = Object.keys(st0.rects).filter((k) => k.startsWith('btn_'));
      const circles = keys.map((k) => { const r = st0.rects[k]; return { k, x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, r: r[2] / 2 }; });
      for (const c of circles) {
        if (c.k === 'btn_stick') continue;
        if (c.r * 2 * css < 43.9) throw new Error(`${c.k} hit target only ${(c.r * 2 * css).toFixed(1)} CSS px`);
        if (c.x - c.r < 0 || c.y - c.r < 0 || c.x + c.r > st0.vp[0] || c.y + c.r > st0.vp[1]) throw new Error(c.k + ' leaves the screen');
      }
      for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i], b = circles[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) throw new Error(`${a.k} and ${b.k} overlap`);
      }
      if (!circles.some((c) => c.k === 'btn_stick') || circles.length < 8) throw new Error('the controls are not on screen: ' + keys.join(' '));
      const minCss = Math.min(...circles.filter((c) => c.k !== 'btn_stick').map((c) => c.r * 2 * css));
      const info = ctl(st0);
      res.controls = { minHitCss: +minCss.toFixed(1), info, viewport: [Math.round(box.width), Math.round(box.height)] };
      await shot('8_controls');
      step(`controls: ${keys.length} on screen, smallest hit target ${minCss.toFixed(1)} CSS px (≥ 44), none overlapping or off screen; scale ${info && info.hit_scale}`);

      // The courtyard is 28 m across and the CI renders slowly, so each run starts on a long clear line and the
      // checks look at what the body does (moved, sprint state), not at how far it got.
      const stick = st0.rects.btn_stick, cam = st0.rects.camera_zone;
      const sc = centre(stick), sr = stick[2] / 2;
      const cc = centre(cam);
      const away = (a, b) => Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]);
      await place(-8, 8, 90);
      const p1 = pl(await state());
      await touch('start', 1, sc[0], sc[1]);
      await swipe(1, sc, [sc[0], sc[1] - sr], 3);
      const running = pl(await waitFor((s) => pl(s) && (pl(s).speed > 3.5 || away(p1, pl(s)) > 2.5), 'the stick to run the Samurai', 60000));
      const sprinting = pl(await waitFor((s) => pl(s) && pl(s).sprinting, 'sprint after 250 ms at the rim', 60000));
      await shot('8_stick_sprint');
      await touch('end', 1);
      const stopped = pl(await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping when the stick is let go', 60000));
      step(`joystick: ${running.anim} at ${running.speed} m/s, held at its rim → sprinting (${sprinting.anim}); let go → stopped (${stopped.anim}) after ${away(p1, stopped).toFixed(1)} m`);

      // two fingers: a slow walk on the stick while a second finger turns the camera
      await place(-8, 8, 90);
      const p2 = pl(await state());
      const yaw0 = cs(await state()).yaw;
      await touch('start', 1, sc[0], sc[1]);
      await swipe(1, sc, [sc[0], sc[1] - sr * 0.4], 2);
      await waitFor((s) => pl(s) && pl(s).speed > 1.0, 'the walk', 60000);
      await touch('start', 2, cc[0] - cam[2] * 0.3, cc[1]);
      await swipe(2, [cc[0] - cam[2] * 0.3, cc[1]], [cc[0] + cam[2] * 0.2, cc[1]], 5);
      const both = await waitFor((s) => cs(s) && angle(cs(s).yaw, yaw0) > 8, 'the camera to turn under the second finger', 60000);
      await shot('8_two_fingers');
      const walking = pl(both).speed > 1.0 && ctl(both).stick && ctl(both).touches === 2;
      await touch('end', 2);
      await touch('end', 1);
      if (!walking) throw new Error(`the stick finger stopped working while the camera finger moved: ${JSON.stringify({ player: pl(both), controls: ctl(both) })}`);
      step(`two fingers: camera turned ${angle(cs(both).yaw, yaw0).toFixed(0)}° while the Samurai kept walking (${pl(both).speed} m/s, ${ctl(both).touches} touches; ${away(p2, pl(both)).toFixed(1)} m)`);
      await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping', 60000);

      await touch('start', 3, cc[0], cc[1]);
      await swipe(3, [cc[0], cc[1]], sc, 8);
      await swipe(3, sc, [sc[0] + sr * 0.5, sc[1] - sr * 0.5], 3, 600);
      const crossed = await state();
      await touch('end', 3);
      if (ctl(crossed) && ctl(crossed).stick) throw new Error('the stick captured a camera drag that crossed it');
      if (pl(crossed).speed > 0.5) throw new Error('a camera drag over the stick moved the Samurai');
      step('a camera drag that crosses the joystick stays a camera drag (the stick does not take it)');

      await place(-6, 8, 90);
      await tapAt('btn_jump');
      const air = pl(await waitFor((s) => pl(s) && pl(s).state === 'air', 'JUMP', 30000));
      await shot('8_jump');
      await waitFor((s) => pl(s) && pl(s).state === 'ground' && pl(s).on_floor, 'landing', 60000);
      step(`JUMP: in the air (y ${air.pos[1]} m), landed`);

      await tapAt('btn_dodge');
      await waitFor((s) => (s.events || []).some((e) => e === 'player_state=dodge'), 'DODGE', 30000);
      await waitFor((s) => pl(s) && pl(s).state === 'ground', 'the dodge to end', 60000);
      step('DODGE: rolled');

      // M4 Stage C: STEP in open space — Shadow Step's burst backward (the stick idle), and with no attack nothing opens
      const pS = pl(await state());
      const ev0 = cb(await state()).evasions;
      await tapAt('btn_skill2');
      await waitFor((s) => s.flags.step, 'STEP', 30000);
      const stepped = await waitFor((s) => cb(s) && cb(s).phase === 'FREE' && cb(s).action === 'shadow_step' && pl(s).state === 'ground', 'the step to end', 60000);
      const stepMoved = away(pS, pl(stepped));
      if (stepMoved < 3.0 || cb(stepped).evasions !== ev0 || cb(stepped).conds.some((c) => c)) throw new Error('STEP in open space: ' + JSON.stringify({ moved: stepMoved, combat: cb(stepped) }));
      step(`STEP (Shadow Step) in open space: ${stepMoved.toFixed(1)} m backward in one burst; no attack — nothing opened`);

      // M3: ATTACK taps — the chain on the dummy, a deliberate miss, and a strike while the stick is held.
      step(await chainTest(mashInPage('btn_attack'), 'touch'));
      step(await heavyTest(() => tapAt('btn_heavy'), 'touch'));
      step(await chainPullTest(() => tapAt('btn_skill1'), tapWhenShown('btn_cond1'), stopTaps, 'touch'));
      step(await risePursueTest(() => tapAt('btn_skill3'), tapWhenShown('btn_cond1'), stopTaps, 'touch'));
      step(await counterTest(tapWhenShown('btn_cond1'), stopTaps, 'touch'));
      step(await missTest(mashInPage('btn_attack'), 'touch'));
      await place(-8, 8, 90);
      const atk = st0.rects.btn_attack;
      const ac = centre(atk);
      await touch('start', 1, sc[0], sc[1]);
      await swipe(1, sc, [sc[0], sc[1] - sr * 0.8], 3);
      await waitFor((s) => pl(s) && pl(s).speed > 1.5, 'running on the stick', 60000);
      const n0 = cb(await state()).strikes;
      await touch('start', 2, ac[0], ac[1]);
      await page.waitForTimeout(150);
      await touch('end', 2);
      const striking = await waitFor((s) => cb(s) && cb(s).strikes > n0, 'a strike from ATTACK while the stick is held', 60000);
      const heldDuring = ctl(striking).stick;
      await shot('9_touch_move_attack');
      const again = await waitFor((s) => cb(s) && cb(s).phase === 'FREE' && pl(s) && pl(s).speed > 1.5, 'running again after the strike, the stick still held', 60000);
      await touch('end', 1);
      if (!heldDuring || !ctl(again).stick) throw new Error('the stick finger was lost during the strike: ' + JSON.stringify(ctl(striking)));
      step(`ATTACK while running on the stick: the strike played (${pl(striking).anim}), the stick stayed held, and he ran on afterwards (${pl(again).speed} m/s, ${pl(again).anim})`);
      await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping', 60000);
    };

    if (p.kind === 'desktop') {
      // M2.2 (desktop profile): locomotion from the keyboard. The CI renders in software at a few frames per second, so
      // game time runs slower than real time: the checks wait for states, not for distances.
      await page.evaluate(() => { const c = document.querySelector('canvas'); c.tabIndex = 0; c.focus(); });
      await place(-8, 8, 90);
      const start = pl(await state());
      await page.keyboard.down('KeyW');
      const run = pl(await waitFor((s) => pl(s) && pl(s).speed > 3.5, 'running (W)', 60000));
      await shot('7_run');
      await page.keyboard.down('ShiftLeft');
      const spr = pl(await waitFor((s) => pl(s) && pl(s).sprinting && pl(s).speed > 6.5, 'sprinting (Shift+W)', 60000));
      await page.keyboard.up('ShiftLeft');
      await page.keyboard.up('KeyW');
      await shot('7_sprint');
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
      await page.keyboard.down('KeyS');
      await page.keyboard.press('KeyK');
      await page.keyboard.up('KeyS');
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

      // GPT's M2 follow-ups: a rapid reversal, jump → land → move, attack → move.
      await place(-8, 8, 90);
      await page.keyboard.down('KeyW');
      const east = pl(await waitFor((s) => pl(s) && pl(s).speed > 3.5, 'running east (W)', 60000));
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyS');
      const west = pl(await waitFor((s) => pl(s) && angle(pl(s).facing, east.facing) > 150 && pl(s).speed > 1.5, 'turning round and running back (S)', 60000));
      await page.keyboard.up('KeyS');
      step(`rapid reversal: running at facing ${east.facing}° → turned round to ${west.facing}° and ran back at ${west.speed} m/s`);
      await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping', 60000);
      await page.keyboard.press('Space');
      await waitFor((s) => pl(s) && pl(s).state === 'air', 'the jump', 30000);
      await waitFor((s) => pl(s) && pl(s).state === 'ground', 'landing', 60000);
      await page.keyboard.down('KeyW');
      const offAgain = pl(await waitFor((s) => pl(s) && pl(s).speed > 1.5, 'moving straight after landing', 60000));
      await page.keyboard.up('KeyW');
      step(`jump → land → move: off again at ${offAgain.speed} m/s (${offAgain.anim})`);
      await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping', 60000);

      // M3: the chain from J, a deliberate miss, then move, dodge and attack again.
      step(await chainTest(mashBy(() => page.keyboard.press('KeyJ')), 'keyboard'));
      step(await heavyTest(() => page.keyboard.press('KeyH'), 'keyboard'));
      step(await chainPullTest(() => page.keyboard.press('Digit1'), pullByKey, async () => {}, 'keyboard'));
      step(await risePursueTest(() => page.keyboard.press('Digit3'),
        pressUntil('Digit4', (s) => cb(s).action === 'aerial_pursuit' || cb(s).log.some((e) => e.id === 'aerial_pursuit')), async () => {}, 'keyboard'));
      step(await counterTest(pressUntil('Digit4', (s) => cb(s).action === 'shadow_counter' || cb(s).log.some((e) => e.id === 'shadow_counter')), async () => {}, 'keyboard'));
      step(await rollTest('keyboard'));
      step(await chainMissTest(() => page.keyboard.press('Digit1'), 'keyboard'));
      step(await missTest(mashBy(() => page.keyboard.press('KeyJ')), 'keyboard'));
      await place(-8, 8, 90);
      const n0 = cb(await state()).strikes;
      await page.keyboard.press('KeyJ');
      await page.keyboard.down('KeyW');
      await waitFor((s) => cb(s) && cb(s).strikes > n0, 'the strike (J)', 60000);
      const moving = pl(await waitFor((s) => cb(s) && cb(s).phase === 'FREE' && pl(s) && pl(s).speed > 1.5, 'moving after the strike (W held)', 60000));
      await page.keyboard.up('KeyW');
      await waitFor((s) => pl(s) && pl(s).speed < 0.4, 'stopping', 60000);
      const d0 = cb(await state()).strikes;
      const rolls = pl(await state()).dodges;
      await page.keyboard.press('KeyK');
      await waitFor((s) => pl(s) && pl(s).dodges > rolls, 'the dodge (K)', 30000);
      await waitFor((s) => pl(s) && pl(s).state === 'ground', 'the dodge to end', 60000);
      await page.keyboard.press('KeyJ');
      await waitFor((s) => cb(s) && cb(s).strikes > d0, 'a strike after the dodge', 60000);
      await waitFor((s) => cb(s) && cb(s).phase === 'FREE', 'the strike to end', 60000);
      step(`attack → move (${moving.anim} at ${moving.speed} m/s once the strike ended), dodge, attack again: no stuck state`);
    } else {
      // M2.3 (phone profiles): the touch controls — layout and sizes, the joystick with sprint at its rim, two fingers
      // at once (stick + camera), a camera drag that crosses the stick, Jump, Dodge and Shadow Step in open space.
      await touchTests();
    }

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
