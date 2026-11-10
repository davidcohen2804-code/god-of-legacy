// David's PC, the live ?spirits&ns game in its own tab (test only — GPT's pre-playtest checks): the save backed up
// first and restored at the end (the game's loop put to sleep first, so nothing writes after the restore); muted.
// One call starts the whole plan in the page (W.__plan()); W.__res is polled.
(() => {
  const W = window;
  W.__bk = W.__bk || sessionStorage.getItem('__bk') || JSON.stringify(Object.entries(localStorage));
  try { sessionStorage.setItem('__bk', W.__bk); } catch (e) { /* (kept in the page) */ }
  W.__restore = () => { const e = JSON.parse(W.__bk); localStorage.clear(); for (const [k, v] of e) localStorage.setItem(k, v); return e.length; };
  const KEY = (code) => code === 'Space' ? ' ' : code === 'Enter' ? 'Enter' : code === 'Escape' ? 'Escape' : code.startsWith('Digit') ? code.slice(5) : code.replace('Key', '').toLowerCase();
  const KC = (code) => ({ Enter: 13, Escape: 27, Space: 32 })[code] ?? (code.startsWith('Digit') ? 48 + Number(code.slice(5)) : code.replace('Key', '').toUpperCase().charCodeAt(0));
  W.__key = (code, type = 'keydown') => { const ev = new KeyboardEvent(type, { key: KEY(code), code, bubbles: true, cancelable: true }); Object.defineProperty(ev, 'keyCode', { get: () => KC(code) }); Object.defineProperty(ev, 'which', { get: () => KC(code) }); window.dispatchEvent(ev); };
  W.__tap = async (code, ms = 90) => { W.__key(code); await new Promise((r) => setTimeout(r, ms)); W.__key(code, 'keyup'); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const stats = (ts) => { if (!ts.length) return { n: 0 }; const s = [...ts].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; const avg = ts.reduce((a, b) => a + b, 0) / ts.length; return { fps: +(1000 / avg).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +s[s.length - 1].toFixed(1), over20: ts.filter((v) => v > 20).length, over34: ts.filter((v) => v > 34).length, n: ts.length }; };
  W.__lt = W.__lt || []; try { if (!W.__ltOn) { W.__ltOn = true; new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } } catch (e) { W.__ltErr = String(e); }
  W.__marks = () => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('gol:')).map((m) => [m.name.slice(4), Math.round(m.startTime)]);
  W.__info = () => { const c = document.createElement('canvas'), gl = c.getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); const g = W.__game?.canvas ?? document.querySelector('canvas'); return { screen: `${screen.width}x${screen.height}`, viewport: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, canvas: g ? `${g.width}x${g.height} shown ${Math.round(g.getBoundingClientRect().width)}x${Math.round(g.getBoundingClientRect().height)}` : null, gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, ua: navigator.userAgent.replace(/.*(Chrome\/[\d.]+).*/, '$1'), hidden: document.hidden, focus: document.hasFocus() }; };
  const S = () => W.__game.scene.getScene('LegacyCourtyardScene');
  W.__a3 = () => { const s = S(), a = s?.a3d; if (!a) return null; const R = a.renderer; return { area: s.w3d?.areaId, level: a.qualityLevel, render: `${R.domElement.width}x${R.domElement.height}`, bloom: !!a.composer, shadows: R.shadowMap.enabled, stencil: !!R.getContextAttributes()?.stencil, programs: R.info.programs?.length }; };
  // a phase: every frame's time, the simulation's own clock against the wall clock (1 = real time), the window's focus
  W.__phase = async (ms, during) => {
    const s = S(), L = W.__game.loop, ts = []; let last = performance.now(); const t0 = last, end = last + ms, sim0 = s.simMs; let unf = 0, n = 0;
    const stop = during ? during() : null;
    await new Promise((res) => { const f = (t) => { ts.push(t - last); last = t; n++; if (!L.inFocus) unf++; if (t < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const wall = performance.now() - t0, sim = s.simMs - sim0;
    if (stop) await stop();
    ts.shift();
    return { ...stats(ts), simRate: +(sim / wall).toFixed(3), unfocused: +(unf / Math.max(1, n)).toFixed(2), hidden: document.hidden };
  };
  // the very first blow after entering: every frame from 0.3 s before the press to 1.5 s after it
  W.__firstHit = async () => {
    const ts = []; const t0 = performance.now(); let last = t0, pressed = 0; const p0 = S().a3d.renderer.info.programs?.length;
    await new Promise((res) => { const f = (t) => { ts.push([t - t0, t - last]); last = t; if (!pressed && t - t0 > 300) { pressed = t - t0; W.__tap('Space', 90); } if (t - t0 < 1800) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const after = ts.filter(([t]) => t >= pressed).map(([, d]) => d), before = ts.filter(([t]) => t < pressed).slice(1).map(([, d]) => d), worst = [...ts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, d]) => [Math.round(t - pressed), +d.toFixed(1)]);
    return { before: stats(before), after: stats(after), worst, newPrograms: (S().a3d.renderer.info.programs?.length ?? 0) - (p0 ?? 0), longTasks: W.__lt.filter(([st]) => st >= t0 - 50).map(([st, d]) => [Math.round(st - t0 - pressed), d]) };
  };
  // a preset chosen in the settings (taken by the stage within 64 frames): every frame until 1.5 s after it is taken
  W.__switch = async (lv, tail = 1500, max = 12000) => {
    const s = S(), ts = []; let last = performance.now(); const t0 = last; let at = 0;
    localStorage.setItem('gol-a3d-quality', String(lv));
    await new Promise((res) => { const f = (t) => { ts.push(t - last); last = t; if (!at && s.a3d.qualityLevel === lv) at = t; if ((at && t - at < tail) || (!at && t - t0 < max)) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    ts.shift();
    return { ...stats(ts), level: s.a3d.qualityLevel, takenAfterMs: at ? Math.round(at - t0) : null };
  };
  W.__run = () => { let on = true; (async () => { let d = 'KeyD'; while (on) { W.__key(d); await wait(1400); W.__key(d, 'keyup'); d = d === 'KeyD' ? 'KeyA' : 'KeyD'; } })(); return () => { on = false; W.__key('KeyD', 'keyup'); W.__key('KeyA', 'keyup'); }; };
  W.__hits = () => { let on = true; (async () => { while (on) { await W.__tap('Space', 70); await wait(160); } })(); return () => { on = false; }; };
  W.__res = W.__res || { state: 'ready' };
  W.__plan = async (o = {}) => {
    const R = (W.__res = { state: 'start' }), G = W.__game;
    const until = async (f, ms = o.tmo ?? 60000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout at ' + R.state); await wait(100); } };
    try {
      G.sound.mute = true;
      R.info = W.__info();
      localStorage.setItem('gol-a3d-quality', '0'); // (High from the start: the automatic step-down off for the measurement)
      await until(() => G.scene.isActive('MainMenuScene'));
      await wait(800);
      const tEnter = performance.now(); R.state = 'menu';
      await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene') && G.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'));
      R.selectMs = Math.round(performance.now() - tEnter);
      await wait(600);
      const tWorld = performance.now(); R.state = 'select';
      await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d && s.spiritForm; }, o.tmo ?? 90000);
      R.worldMs = Math.round(performance.now() - tWorld); R.state = 'world';
      R.marks = W.__marks().filter(([, t]) => t >= tWorld - 100).map(([k, t]) => [k, Math.round(t - tWorld)]);
      R.entryLong = W.__lt.filter(([st]) => st >= tWorld).map(([st, d]) => d).sort((a, b) => b - a).slice(0, 6);
      await wait(o.settle ?? 5000); // (the arrival and the first pictures' compiling)
      R.a3 = W.__a3();
      R.firstHit = await W.__firstHit(); R.state = 'firstHit';
      await wait(800);
      for (const [lv, name] of [[0, 'high'], [1, 'medium'], [2, 'low']].filter(([lv]) => (o.levels ?? [0, 1, 2]).includes(lv))) {
        const P = (R[name] = {});
        if (lv > 0) { P.switch = await W.__switch(lv); await wait(1500); }
        P.a3 = W.__a3();
        P.idle = await W.__phase(o.ms ?? 6000);
        P.run = await W.__phase(o.ms ?? 6000, W.__run); await wait(300);
        P.hits = await W.__phase(o.ms ?? 6000, W.__hits); await wait(500);
        if (lv === 0 && !G.loop.inFocus) { // (the pane shown but not focused: Phaser holds each step to 1/60 s while its window is unfocused — the focused game's step, as David plays it, measured too)
          G.loop.focus(); await wait(4000); // (its 120 frames' cool-down after a focus first)
          P.runFocused = await W.__phase(o.ms ?? 6000, W.__run); await wait(300);
        }
        R.state = name;
      }
      R.heapMb = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
      R.state = 'done';
    } catch (e) { R.err = String((e && e.message) || e); R.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (the page is closed next anyway) */ } try { R.restored = W.__restore(); R.keys = Object.keys(localStorage).length; } catch (e) { R.restoreErr = String(e); } }
  };
  if (W.__game) W.__game.sound.mute = true;
  return { ok: true, keys: Object.keys(localStorage).length, hidden: document.hidden, scenes: W.__game?.scene.getScenes(true).map((x) => x.sys.settings.key) };
})()
