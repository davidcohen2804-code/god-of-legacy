// GPT's P3 (diagnosis only, David's PC): where each frame's time goes, the first strike's long frame with its scripts,
// and the game's clock through focus changes. Loaded after bench3.js (its keys, run/hits drivers, save backup and
// restore, preset switch). Timing wrappers only: the game's code and behaviour are unchanged; the page is reloaded after.
(() => {
  const W = window, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const st = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(1) }; };
  W.__loaf = W.__loaf || [];
  if (!W.__loafOn) {
    W.__loafOn = true;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), rs: Math.round((e.renderStart || e.startTime) - e.startTime), sl: Math.round((e.styleAndLayoutStart || e.startTime) - e.startTime), b: Math.round(e.blockingDuration || 0), s: (e.scripts || []).map((s) => ({ d: Math.round(s.duration), inv: s.invoker, it: s.invokerType, fn: s.sourceFunctionName, url: (s.sourceURL || '').split('/').pop(), pos: s.sourceCharPosition, fsl: Math.round(s.forcedStyleAndLayoutDuration || 0), ps: Math.round(s.pauseDuration || 0) })) }); }).observe({ type: 'long-animation-frame', buffered: true });
    } catch (e) { W.__loafErr = String(e); }
  }
  const T = (W.__T = { on: false, sync: false, frames: [] }), acc = {};
  const add = (k, v) => { acc[k] = (acc[k] || 0) + v; };
  const wrap = (o, name, key, cnt, gl) => {
    const f = o && o[name]; if (typeof f !== 'function' || f.__w) return false;
    const g = function (...a) {
      if (!T.on) return f.apply(this, a);
      const t = performance.now();
      try { return f.apply(this, a); } finally {
        add(key, performance.now() - t); if (cnt) add(key + '#', 1);
        if (T.sync && gl) { const t2 = performance.now(); gl().finish(); add(key + '~gpu', performance.now() - t2); }
      }
    };
    g.__w = 1; o[name] = g; return true;
  };
  W.__p3install = () => {
    const G = W.__game, sc = G.scene.getScene('LegacyCourtyardScene'), a = sc.a3d, R = a.renderer, ok = {};
    const gl3 = () => R.getContext(), glP = () => G.renderer.gl;
    const step = G.step; let lastT = 0;
    G.step = function (time, delta) {
      if (!T.on) { lastT = 0; return step.call(this, time, delta); }
      for (const k in acc) delete acc[k];
      const t0 = performance.now(); step.call(this, time, delta); const t1 = performance.now();
      acc.step = t1 - t0; acc.frame = lastT ? t0 - lastT : 0; acc.delta = delta; lastT = t0;
      T.frames.push({ ...acc });
    };
    ok.update = wrap(G.scene, 'update', 'update');
    ok.render = wrap(G.scene, 'render', 'render');
    ok.post = wrap(G.renderer, 'postRender', 'post', false, glP);
    ok.three = wrap(R, 'render', 'three', true, gl3);
    if (a.composer) ok.bloom = wrap(a.composer, 'render', 'bloom', false, gl3);
    for (const k of ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero']) if (sc.textures.exists(k)) ok[k] = wrap(sc.textures.get(k).source[0], 'update', 'upload', true, glP);
    const ap = Object.getPrototypeOf(a).apply;
    if (typeof ap === 'function') {
      sc.events.off('prerender', ap, a);
      sc.events.on('prerender', function () { if (!T.on) return ap.call(a); const t = performance.now(); try { ap.call(a); } finally { add('apply', performance.now() - t); } }, a);
      ok.apply = true;
    }
    ok.a3step = wrap(a, 'step', 'a3step');
    ok.shade = wrap(a, 'shadeBodies', 'a3shade');
    ok.erasers = wrap(a, 'prepareErasers', 'a3erasers');
    if (sc.hero3d) ok.hero = wrap(sc.hero3d, 'drive', 'hero');
    const di = CanvasRenderingContext2D.prototype.drawImage;
    if (!di.__w) { const g = function (img, ...r) { if (!T.on || img !== G.canvas) return di.call(this, img, ...r); const t = performance.now(); try { return di.call(this, img, ...r); } finally { add('ambient', performance.now() - t); } }; g.__w = 1; CanvasRenderingContext2D.prototype.drawImage = g; ok.ambient = true; }
    const ext = (gl) => { try { return !!(gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query')); } catch (e) { return 'err'; } };
    ok.timerQuery3d = ext(gl3()); ok.timerQueryPhaser = ext(glP());
    ok.attrs3d = (() => { const c = gl3().getContextAttributes(); return `aa ${c.antialias} pdb ${c.preserveDrawingBuffer} stencil ${c.stencil}`; })();
    ok.attrsP = (() => { const c = glP().getContextAttributes(); return `aa ${c.antialias} pdb ${c.preserveDrawingBuffer}`; })();
    return ok;
  };
  // a phase: every frame's time split into its parts; the game's clock against the wall clock
  W.__p3phase = async (ms, during, sync) => {
    const sc = W.__game.scene.getScene('LegacyCourtyardScene'), sim0 = sc.simMs, w0 = performance.now();
    T.frames = []; T.sync = !!sync; T.on = true;
    const stop = during ? during() : null;
    await wait(ms);
    T.on = false; T.sync = false;
    if (stop) await stop();
    const wall = performance.now() - w0, fr = T.frames.slice(1), keys = new Set();
    for (const f of fr) for (const k in f) keys.add(k);
    const out = { n: fr.length, fps: +(fr.length / (wall / 1000)).toFixed(1), simRate: +((sc.simMs - sim0) / wall).toFixed(3), over50: fr.filter((f) => f.frame > 50).length, over100: fr.filter((f) => f.frame > 100).length, b: {} };
    for (const k of keys) { const v = fr.map((f) => f[k] || 0); out.b[k] = k.endsWith('#') ? +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(1) : st(v); }
    const sum = (f, ...k) => k.reduce((x, y) => x + (f[y] || 0), 0);
    out.b.gap = st(fr.map((f) => Math.max(0, f.frame - f.step)));
    out.b.phaser = st(fr.map((f) => Math.max(0, (f.render || 0) - (f.apply || 0))));
    out.b.a3other = st(fr.map((f) => Math.max(0, (f.apply || 0) - sum(f, 'three', 'bloom', 'upload', 'a3shade', 'a3erasers'))));
    return out;
  };
  // the game's clock through focus changes (the window's blur/focus events, as when another window is clicked)
  W.__p3clock = async () => {
    const G = W.__game, s = G.scene.getScene('LegacyCourtyardScene'), out = {};
    const run = async (name, ms, during) => {
      const sim0 = s.simMs, w0 = performance.now(), L = G.loop; let n = 0, unf = 0; const ts = []; let last = w0;
      const stop = during ? during() : null;
      while (performance.now() - w0 < ms) { const t = await new Promise((r) => requestAnimationFrame(r)); ts.push(t - last); last = t; n++; if (!L.inFocus) unf++; }
      if (stop) await stop();
      const wall = performance.now() - w0; ts.shift();
      out[name] = { simRate: +((s.simMs - sim0) / wall).toFixed(3), fps: +(n / (wall / 1000)).toFixed(1), unfocused: +(unf / Math.max(1, n)).toFixed(2), frame: st(ts) };
    };
    await run('idle', 4000); await run('run', 4000, W.__run); await run('hits', 4000, W.__hits);
    window.dispatchEvent(new Event('blur')); await wait(150);
    await run('blurIdle', 4000); await run('blurRun', 4000, W.__run);
    window.dispatchEvent(new Event('focus'));
    await run('focus0to2s', 2000, W.__run); await run('focus2to6s', 4000, W.__run);
    return out;
  };
  W.__p3plan = async (o = {}) => {
    const R = (W.__p3 = { state: 'start' }), G = W.__game, S = () => G.scene.getScene('LegacyCourtyardScene');
    const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout at ' + R.state); await wait(100); } };
    const rnd = (f) => { const o2 = {}; for (const k in f) o2[k] = Math.round(f[k] * 10) / 10; return o2; };
    try {
      G.sound.mute = true; R.info = W.__info && W.__info();
      localStorage.setItem('gol-a3d-quality', String((o.levels ?? [0, 2])[0]));
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800);
      await W.__tap('Enter'); R.state = 'menu';
      await until(() => G.scene.isActive('CharacterSelectScene') && G.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'));
      await wait(600); const tW = performance.now(); await W.__tap('Enter'); R.state = 'select';
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d && (s.spiritForm || /solid/.test(location.search)); });
      R.worldMs = Math.round(performance.now() - tW); R.state = 'world';
      await wait(o.settle ?? 5000);
      R.install = W.__p3install();
      const n0 = W.__loaf.length, tHit = performance.now(); R.state = 'firstHit';
      T.frames = []; T.on = true; await W.__tap('Space', 90); await wait(2200); T.on = false;
      R.firstHit = { pressAt: Math.round(tHit), slow: T.frames.filter((f) => f.frame > 60 || f.step > 60).map(rnd), loaf: W.__loaf.slice(n0).filter((e) => e.d > 120) };
      await wait(800);
      for (const lv of o.levels ?? [0, 2]) {
        const P = (R['lv' + lv] = {});
        if (S().a3d.qualityLevel !== lv) { P.switch = await W.__switch(lv); await wait(2000); }
        P.a3 = W.__a3();
        P.idle = await W.__p3phase(o.ms ?? 6000);
        P.run = await W.__p3phase(o.ms ?? 6000, W.__run); await wait(400);
        P.hits = await W.__p3phase(o.ms ?? 6000, W.__hits); await wait(600);
        P.sync = await W.__p3phase(3000, null, true);
        R.state = 'lv' + lv;
      }
      if (o.clock !== false) { R.state = 'clock'; R.clock = await W.__p3clock(); }
      R.loafCount = W.__loaf.length; R.state = 'done';
    } catch (e) { R.err = String((e && e.message) || e); R.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { R.restored = W.__restore(); R.keys = Object.keys(localStorage).length; } catch (e) { R.restoreErr = String(e); } }
  };
  return { ok: true, loaf: !W.__loafErr, loafErr: W.__loafErr || null };
})()
