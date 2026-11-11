// GPT's P3 (diagnosis only, David's PC): the GPU time of each 3D pass and of each picture's copy into the game, by
// timer queries; the frame rate; High / Medium / Low. Loaded after bench3.js (keys, preset switch, save backup and
// restore). Timing wrappers only; the page is reloaded after each run.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__ppRun = async (o = {}) => {
    const out = (W.__ppOut = { state: 'start', q: location.search });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', '0');
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene')); await wait(o.selectWait ?? 2500); await W.__tap('Enter');
      const tW = performance.now();
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d; }); out.worldMs = Math.round(performance.now() - tW); out.state = 'world'; await wait(o.settle ?? 6000);
      if (o.goto) { const w0 = S().w3d; S().devApi().goto(o.goto); await until(() => { const s = S(); return s.w3d !== w0 && s.a3d && s.a3d.room; }); out.place = S().w3d && S().w3d.areaId; await wait(o.settle ?? 6000); } // (P4B: a place with several warm lights)
      const sc = S(), a = sc.a3d, R = a.renderer, gl = R.getContext(), E = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const glP = G.renderer.gl, EP2 = glP.getExtension('EXT_disjoint_timer_query_webgl2'), EP1 = EP2 ? null : glP.getExtension('EXT_disjoint_timer_query');
      let on = false; const pend = [], tot = {}, n = {};
      const lab = (s) => s === a.scene3 ? 'main+shadows' : s === a.front3 ? 'front' : s === a.glow3 ? 'glow' : s === a.occluders ? 'occluders' : (a.extra || []).some((l) => l.scene === s) ? 'hero' : 'post(bloom)';
      const r0 = R.render;
      R.render = function (s, c) { if (!on || !E) return r0.call(this, s, c); const q = gl.createQuery(); gl.beginQuery(E.TIME_ELAPSED_EXT, q); try { return r0.call(this, s, c); } finally { gl.endQuery(E.TIME_ELAPSED_EXT); pend.push(['3d', lab(s), q]); } };
      const mkP = () => (EP2 ? glP.createQuery() : EP1.createQueryEXT());
      for (const k of ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero']) {
        if (!sc.textures.exists(k)) continue; const src = sc.textures.get(k).source[0], u0 = src.update;
        src.update = function (...x) { if (!on || (!EP2 && !EP1)) return u0.apply(this, x); const q = mkP(); if (EP2) glP.beginQuery(EP2.TIME_ELAPSED_EXT, q); else EP1.beginQueryEXT(EP1.TIME_ELAPSED_EXT, q); try { return u0.apply(this, x); } finally { if (EP2) glP.endQuery(EP2.TIME_ELAPSED_EXT); else EP1.endQueryEXT(EP1.TIME_ELAPSED_EXT); pend.push(['2d', 'copy ' + k.replace('arena3d-', ''), q]); } };
      }
      // the whole 2D frame (Phaser's own drawing, the copies included) in a phase of its own (queries cannot nest)
      let whole = false; const pre = G.renderer.preRender, post = G.renderer.postRender; let qw = null;
      G.renderer.preRender = function (...x) { if (whole && !qw) { qw = mkP(); if (EP2) glP.beginQuery(EP2.TIME_ELAPSED_EXT, qw); else EP1.beginQueryEXT(EP1.TIME_ELAPSED_EXT, qw); } return pre.apply(this, x); };
      G.renderer.postRender = function (...x) { const r = post.apply(this, x); if (qw) { if (EP2) glP.endQuery(EP2.TIME_ELAPSED_EXT); else EP1.endQueryEXT(EP1.TIME_ELAPSED_EXT); pend.push(['2d', '2D frame (all)', qw]); qw = null; } return r; };
      const poll = () => {
        while (pend.length) {
          const [ctx, l, q] = pend[0], g2 = ctx === '3d' ? gl : glP, two = ctx === '3d' || !!EP2;
          const av = two ? g2.getQueryParameter(q, g2.QUERY_RESULT_AVAILABLE) : EP1.getQueryObjectEXT(q, EP1.QUERY_RESULT_AVAILABLE_EXT);
          if (!av) break; pend.shift();
          const v = two ? g2.getQueryParameter(q, g2.QUERY_RESULT) : EP1.getQueryObjectEXT(q, EP1.QUERY_RESULT_EXT);
          const dis = g2.getParameter((ctx === '3d' ? E : EP2 || EP1).GPU_DISJOINT_EXT);
          if (two) g2.deleteQuery(q); else EP1.deleteQueryEXT(q);
          if (!dis) { tot[l] = (tot[l] || 0) + v / 1e6; n[l] = (n[l] || 0) + 1; }
        }
      };
      const phase = async (ms, w) => {
        for (const k in tot) delete tot[k]; for (const k in n) delete n[k];
        whole = !!w; on = !w; const t1 = performance.now(); let fr = 0; const ts = []; let last = t1;
        while (performance.now() - t1 < ms) { const t = await new Promise((r) => requestAnimationFrame(r)); ts.push(t - last); last = t; fr++; poll(); }
        on = false; whole = false; await wait(400); poll(); ts.shift();
        const s = [...ts].sort((x, y) => x - y);
        return { fps: +((fr / (performance.now() - 400 - t1)) * 1000).toFixed(1), p50: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), p99: +s[Math.min(s.length - 1, Math.floor(s.length * 0.99))].toFixed(1), gpu: Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, +(v / Math.max(1, n[k] / (k === '2D frame (all)' ? 1 : 1))).toFixed(2)])), callsPerFrame: Object.fromEntries(Object.entries(n).map(([k, v]) => [k, +(v / fr).toFixed(1)])), gpuPerFrame: Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, +(v / fr).toFixed(2)])) };
      };
      for (const lv of o.levels ?? [0, 2]) {
        if (a.qualityLevel !== lv) { await W.__switch(lv); await wait(1500); }
        out['lv' + lv] = { a3: W.__a3(), passes: await phase(o.ms ?? 5000), whole2d: await phase(3000, true) };
      }
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
