// GPT's P4B (diagnosis only, David's PC): what Phaser's own 2D frame spends its GPU time on — each category of the
// courtyard's display list hidden for a moment (by type: Graphics, Text, particles; by place: the HUD's corners and
// bars, the world's sprites; the 3D pictures as a reference), the 2D frame's GPU time and the frame rate measured,
// then shown again. Nothing is saved; the page is reloaded after. Loaded after bench3.js.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__catRun = async (o = {}) => {
    const out = (W.__catOut = { state: 'start', q: location.search, m: {} });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', String(o.level ?? 0));
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene')); await wait(2500); await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d; }); out.state = 'world'; await wait(o.settle ?? 6000);
      const sc = S(), glP = G.renderer.gl, E2 = glP.getExtension('EXT_disjoint_timer_query_webgl2'), E1 = E2 ? null : glP.getExtension('EXT_disjoint_timer_query');
      out.scenes = G.scene.getScenes(true).map((x) => `${x.sys.settings.key}:${x.children.list.length}`);
      // the 2D frame's GPU time (one query from Phaser's pre-render to its post-render)
      let on = false, q = null; const pend = [], res = [];
      const mk = () => (E2 ? glP.createQuery() : E1.createQueryEXT());
      const pre = G.renderer.preRender, post = G.renderer.postRender;
      G.renderer.preRender = function (...x) { if (on && !q) { q = mk(); if (E2) glP.beginQuery(E2.TIME_ELAPSED_EXT, q); else E1.beginQueryEXT(E1.TIME_ELAPSED_EXT, q); } return pre.apply(this, x); };
      G.renderer.postRender = function (...x) { const r = post.apply(this, x); if (q) { if (E2) glP.endQuery(E2.TIME_ELAPSED_EXT); else E1.endQueryEXT(E1.TIME_ELAPSED_EXT); pend.push(q); q = null; } return r; };
      const poll = () => { while (pend.length) { const x = pend[0], av = E2 ? glP.getQueryParameter(x, glP.QUERY_RESULT_AVAILABLE) : E1.getQueryObjectEXT(x, E1.QUERY_RESULT_AVAILABLE_EXT); if (!av) break; pend.shift(); const v = E2 ? glP.getQueryParameter(x, glP.QUERY_RESULT) : E1.getQueryObjectEXT(x, E1.QUERY_RESULT_EXT); const dis = glP.getParameter((E2 || E1).GPU_DISJOINT_EXT); if (E2) glP.deleteQuery(x); else E1.deleteQueryEXT(x); if (!dis) res.push(v / 1e6); } };
      const measure = async (name, objs) => {
        const was = objs.map((x) => x.visible); objs.forEach((x) => x.setVisible ? x.setVisible(false) : (x.visible = false));
        await wait(700); res.length = 0; on = true; const t1 = performance.now(); let fr = 0;
        while (performance.now() - t1 < (o.ms ?? 2500)) { await new Promise((r) => requestAnimationFrame(r)); fr++; poll(); }
        on = false; await wait(300); poll();
        objs.forEach((x, i) => x.setVisible ? x.setVisible(was[i]) : (x.visible = was[i]));
        const avg = res.length ? res.reduce((a, b) => a + b, 0) / res.length : null;
        out.m[name] = { n: objs.length, gpu2d: avg !== null ? +avg.toFixed(2) : null, fps: +(fr / ((o.ms ?? 2500) / 1000)).toFixed(1) };
      };
      // the categories (the scene's own top-level display list; a container counts as one, by its bounds)
      const top = sc.children.list.filter((x) => x.visible);
      const pic = new Set(['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero']);
      const isPic = (x) => x.texture && pic.has(x.texture.key);
      const hud = top.filter((x) => !isPic(x) && x.scrollFactorX === 0), world = top.filter((x) => !isPic(x) && x.scrollFactorX !== 0);
      const B = (x) => { try { const b = x.getBounds ? x.getBounds() : null; return b ? { cx: b.centerX, cy: b.centerY, w: b.width, h: b.height } : null; } catch (e) { return null; } };
      const at = (list, f) => list.filter((x) => { const b = B(x); return b && f(b); });
      const SW = sc.scale.width, SH = sc.scale.height;
      out.counts = { visibleTop: top.length, hud: hud.length, world: world.length, types: top.reduce((m, x) => ((m[x.type] = (m[x.type] || 0) + 1), m), {}) };
      await measure('baseline', []);
      await measure('the 3D pictures (bg, fg, fx, hero)', top.filter(isPic));
      await measure('all HUD (fixed to the screen)', hud);
      await measure('HUD top-left (portrait, bars, quests)', at(hud, (b) => b.cx < SW * 0.35 && b.cy < SH * 0.45));
      await measure('HUD top-right (minimap)', at(hud, (b) => b.cx > SW * 0.7 && b.cy < SH * 0.4));
      await measure('HUD bottom bar (skills, items)', at(hud, (b) => b.cy > SH * 0.8 && b.cx > SW * 0.25));
      await measure('HUD bottom-left (chat)', at(hud, (b) => b.cy > SH * 0.6 && b.cx < SW * 0.3));
      await measure('all world 2D (NPC, names, rings, effects)', world);
      await measure('Graphics objects (any)', top.filter((x) => x.type === 'Graphics'));
      await measure('Text objects (any)', top.filter((x) => x.type === 'Text' || x.type === 'BitmapText'));
      await measure('particles (any)', top.filter((x) => x.type === 'ParticleEmitter' || x.type === 'ParticleEmitterManager'));
      await measure('everything but the 3D pictures', top.filter((x) => !isPic(x)));
      await measure('baseline again', []);
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
