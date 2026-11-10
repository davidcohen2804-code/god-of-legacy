// GPT's P3 (diagnosis only, David's PC): what the courtyard's 3D picture holds, and what each part costs on the GPU —
// measured by switching one thing off for 3 s at a time (lights, shadows, bloom, MSAA-free copies, the 2D layers),
// then back. Nothing is saved; the page is reloaded after. Loaded after bench3.js.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__expRun = async (o = {}) => {
    const out = (W.__expOut = { state: 'start', q: location.search });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', String(o.level ?? 0));
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene')); await wait(2500); await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d; }); out.state = 'world'; await wait(6000);
      const sc = S(), a = sc.a3d, R = a.renderer, gl = R.getContext(), E = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const glP = G.renderer.gl, EP2 = glP.getExtension('EXT_disjoint_timer_query_webgl2'), EP1 = EP2 ? null : glP.getExtension('EXT_disjoint_timer_query');
      // inventory of the room's 3D scene
      const inv = { lights: {}, shadowLights: 0, meshes: 0, materials: {}, tris: 0, transparent: 0 };
      a.scene3.traverse((x) => {
        if (x.isLight && x.visible) { inv.lights[x.type] = (inv.lights[x.type] || 0) + 1; if (x.castShadow) inv.shadowLights++; }
        if (x.isMesh && x.visible) { inv.meshes++; const ms = Array.isArray(x.material) ? x.material : [x.material]; for (const m of ms) { inv.materials[m.type] = (inv.materials[m.type] || 0) + 1; if (m.transparent) inv.transparent++; } const g = x.geometry; inv.tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3; }
      });
      inv.tris = Math.round(inv.tris); inv.info = { calls: R.info.render.calls, triangles: R.info.render.triangles, programs: R.info.programs?.length, textures: R.info.memory.textures, geometries: R.info.memory.geometries };
      inv.pixelRatio = R.getPixelRatio(); inv.drawSize = `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`; inv.samples = gl.getParameter(gl.SAMPLES); inv.shadowMap = R.shadowMap.enabled ? R.shadowMap.type : 'off';
      inv.phaserCanvas = `${G.canvas.width}x${G.canvas.height}`; inv.phaserSamples = glP.getParameter(glP.SAMPLES);
      inv.displayList = sc.children.list.length; inv.visible2d = sc.children.list.filter((c) => c.visible).length;
      out.inv = inv;
      // GPU timing helpers
      const pend = [], tot = {}; let on3 = false, onP = false, qP = null;
      const r0 = R.render;
      R.render = function (s, c) { if (!on3 || !E) return r0.call(this, s, c); const q = gl.createQuery(); gl.beginQuery(E.TIME_ELAPSED_EXT, q); try { return r0.call(this, s, c); } finally { gl.endQuery(E.TIME_ELAPSED_EXT); pend.push(['3d', s === a.scene3 ? 'main' : 'other3d', q]); } };
      const mkP = () => (EP2 ? glP.createQuery() : EP1.createQueryEXT());
      const pre = G.renderer.preRender, post = G.renderer.postRender;
      G.renderer.preRender = function (...x) { if (onP && !qP) { qP = mkP(); if (EP2) glP.beginQuery(EP2.TIME_ELAPSED_EXT, qP); else EP1.beginQueryEXT(EP1.TIME_ELAPSED_EXT, qP); } return pre.apply(this, x); };
      G.renderer.postRender = function (...x) { const r = post.apply(this, x); if (qP) { if (EP2) glP.endQuery(EP2.TIME_ELAPSED_EXT); else EP1.endQueryEXT(EP1.TIME_ELAPSED_EXT); pend.push(['2d', '2d', qP]); qP = null; } return r; };
      const poll = () => { while (pend.length) { const [ctx, l, q] = pend[0], g2 = ctx === '3d' ? gl : glP, two = ctx === '3d' || !!EP2; const av = two ? g2.getQueryParameter(q, g2.QUERY_RESULT_AVAILABLE) : EP1.getQueryObjectEXT(q, EP1.QUERY_RESULT_AVAILABLE_EXT); if (!av) break; pend.shift(); const v = two ? g2.getQueryParameter(q, g2.QUERY_RESULT) : EP1.getQueryObjectEXT(q, EP1.QUERY_RESULT_EXT); const dis = g2.getParameter((ctx === '3d' ? E : EP2 || EP1).GPU_DISJOINT_EXT); if (two) g2.deleteQuery(q); else EP1.deleteQueryEXT(q); if (!dis) tot[l] = (tot[l] || 0) + v / 1e6; } };
      const measure = async (name, ms = 3000) => {
        for (const k in tot) delete tot[k];
        await wait(1500); // (a changed state compiles first)
        on3 = true; onP = false; let fr = 0; const t1 = performance.now();
        while (performance.now() - t1 < ms) { await new Promise((r) => requestAnimationFrame(r)); fr++; poll(); }
        on3 = false; onP = true; let fr2 = 0; const t2 = performance.now();
        while (performance.now() - t2 < 2000) { await new Promise((r) => requestAnimationFrame(r)); fr2++; poll(); }
        onP = false; await wait(400); poll();
        out.m[name] = { fps: +((fr / (ms / 1000))).toFixed(1), main: +((tot.main || 0) / fr).toFixed(1), other3d: +((tot.other3d || 0) / fr).toFixed(1), frame2d: +((tot['2d'] || 0) / fr2).toFixed(1) };
      };
      out.m = {};
      await measure('baseline');
      // the room's point / spot lights off (their shading cost)
      const lit = []; a.scene3.traverse((x) => { if (x.isLight && x.visible && (x.isPointLight || x.isSpotLight)) lit.push(x); });
      for (const L of lit) L.visible = false; await measure(`point+spot lights off (${lit.length})`); for (const L of lit) L.visible = true;
      // shadows off
      const sh = R.shadowMap.enabled; if (sh) { R.shadowMap.enabled = false; a.scene3.traverse((x) => { if (x.material) for (const m of [].concat(x.material)) m.needsUpdate = true; }); await measure('shadows off'); R.shadowMap.enabled = true; R.shadowMap.needsUpdate = true; a.scene3.traverse((x) => { if (x.material) for (const m of [].concat(x.material)) m.needsUpdate = true; }); }
      // bloom off (the main scene drawn straight)
      const comp = a.composer; if (comp) { a.composer = null; await measure('bloom off'); a.composer = comp; }
      // the 2D frame without the 3D pictures composited (Phaser's own drawing alone)
      const imgs = ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero'].map((k) => sc.children.list.find((c) => c.texture && c.texture.key === k)).filter(Boolean);
      const vis = imgs.map((i) => i.visible); imgs.forEach((i) => i.setVisible(false)); await measure(`2D without the 3D pictures (${imgs.length})`); imgs.forEach((i, j) => i.setVisible(vis[j]));
      if (o.unlit) { // the room's PBR materials swapped for unlit ones (the same maps and colours) for 3 s: the lighting's share
        let Basic = null; a.scene3.traverse((x) => { if (!Basic && x.isMesh && x.material && !Array.isArray(x.material) && x.material.isMeshBasicMaterial) Basic = x.material.constructor; });
        const swaps = []; a.scene3.traverse((x) => { if (x.isMesh && x.material && !Array.isArray(x.material) && x.material.isMeshStandardMaterial) swaps.push([x, x.material]); });
        if (Basic) { for (const [x, m] of swaps) x.material = new Basic({ map: m.map, color: m.color, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side }); await measure(`unlit instead of PBR (${swaps.length})`); for (const [x, m] of swaps) x.material = m; }
        else out.unlitErr = 'no unlit material class found';
      }
      // only the floor-level pieces drawn (each mesh but the biggest 3 hidden) for 3 s: how much the rest of the room costs
      if (o.overdraw) { const ms = []; a.scene3.traverse((x) => { if (x.isMesh && x.visible) ms.push(x); }); const big = ms.map((x) => { x.geometry.computeBoundingSphere(); return [x, x.geometry.boundingSphere.radius * Math.max(x.scale.x, x.scale.y, x.scale.z)]; }).sort((p, q) => q[1] - p[1]); const keep = new Set(big.slice(0, 3).map((p) => p[0])); for (const x of ms) if (!keep.has(x)) x.visible = false; await measure(`only the 3 biggest pieces (of ${ms.length})`); for (const x of ms) x.visible = true; }
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
