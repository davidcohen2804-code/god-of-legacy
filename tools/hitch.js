// GPT's P4A (diagnosis only, David's PC): the first strike's frames, and any slow 3D draw call during repeated attacks —
// what it compiled or uploaded for the first time (new shader programs, textures, geometries). Loaded after bench3.js
// and p3.js (its long-animation-frame observer and frame buckets). Timing wrappers only; the page is reloaded after.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__hitchRun = async (o = {}) => {
    const out = (W.__hitchOut = { state: 'start', q: location.search, slowDraws: [] });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', String(o.level ?? 0));
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene')); await wait(2500); await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d; }); out.state = 'world'; await wait(o.settle ?? 6000);
      const sc = S(), a = sc.a3d, R = a.renderer, progs = () => R.info.programs || [];
      out.install = W.__p3install ? Object.keys(W.__p3install()).length : 0;
      const lab = (s) => s === a.scene3 ? 'room' : s === a.front3 ? 'front' : s === a.glow3 ? 'glow' : s === a.occluders ? 'occluders' : (a.extra || []).some((l) => l.scene === s) ? 'hero' : 'post';
      const r0 = R.render; let on = false;
      R.render = function (s, c) {
        if (!on) return r0.call(this, s, c);
        const p0 = progs().length, tx0 = R.info.memory.textures, g0 = R.info.memory.geometries, t = performance.now();
        try { return r0.call(this, s, c); } finally {
          const d = performance.now() - t;
          if (d > (o.slowMs ?? 25)) { const ps = progs(); out.slowDraws.push({ at: Math.round(performance.now() - out.t0), ms: Math.round(d), pass: lab(s), newPrograms: ps.slice(p0).map((p) => `${p.name} ${String(p.cacheKey || '').slice(0, 60)}`), newTextures: R.info.memory.textures - tx0, newGeometries: R.info.memory.geometries - g0, newObjects: fresh(s) }); }
        }
      };
      out.programs0 = progs().length;
      // slow WebGL calls on both contexts (the ones that can block: compiles, links, status reads, uploads), with a short stack
      out.gl = []; const glw = (gl, label) => { for (const fn of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'texImage2D', 'texSubImage2D', 'generateMipmap', 'bufferData', 'readPixels', 'finish']) { const f = gl[fn]; if (typeof f !== 'function' || f.__gw) continue; const g = function (...a) { if (!on) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; if (d > (o.glMs ?? 4) && out.gl.length < 40) out.gl.push({ at: Math.round(performance.now() - out.t0), ctx: label, fn, ms: Math.round(d), stack: String(new Error().stack).split('\n').slice(2, 8).map((l) => l.trim().replace(/https?:\/\/[^ )]*\//, '')).join(' < ') }); } }; g.__gw = 1; gl[fn] = g; } };
      glw(R.getContext(), '3d'); glw(G.renderer.gl, '2d');
      // the afterimages' own cost: each image built (its CPU skinning), timed
      out.ghost = { built: 0, ms: 0, max: 0, verts: 0 }; const hh = sc.hero3d && sc.hero3d.h;
      if (hh && typeof hh.ghost === 'function') { const g0 = hh.ghost; hh.ghost = function (...a) { const before = this.lastGhost, t = performance.now(); const r = g0.apply(this, a); if (on && this.lastGhost !== before) { const d = performance.now() - t; out.ghost.built++; out.ghost.ms += d; out.ghost.max = Math.max(out.ghost.max, d); } return r; }; out.ghost.verts = hh.body ? hh.body.geometry.attributes.position.count : 0; }
      const seen = new Set(), scenes = [a.scene3, a.front3, a.glow3, ...(a.extra || []).map((l) => l.scene)].filter(Boolean);
      for (const sc3 of scenes) sc3.traverse((x) => { if (x.isMesh || x.isLine || x.isPoints || x.isSprite) seen.add(x.uuid); });
      const fresh = (s) => { const r = []; s.traverse((x) => { if ((x.isMesh || x.isLine || x.isPoints || x.isSprite) && x.visible && !seen.has(x.uuid) && r.length < 8) { const m = Array.isArray(x.material) ? x.material[0] : x.material; r.push(`${x.name || x.type} | ${m && m.type}${m && m.name ? ' ' + m.name : ''} | ${x.geometry && x.geometry.type} ${x.geometry && x.geometry.attributes && x.geometry.attributes.position ? x.geometry.attributes.position.count : ''} | parent ${x.parent && (x.parent.name || x.parent.type)}${m && m.defines ? ' | defines ' + Object.keys(m.defines).join(',') : ''}${m && (m.vertexColors || m.alphaMap || m.map) ? ' | ' + [m.vertexColors && 'vertexColors', m.map && 'map', m.alphaMap && 'alphaMap'].filter(Boolean).join(',') : ''}`); } }); return r; };
      // the first strike, then repeated basic attacks
      const n0 = W.__loaf.length; out.t0 = performance.now(); on = true; W.__T.frames = []; W.__T.on = true;
      await W.__tap('Space', 90); await wait(2200);
      out.firstHit = { slowFrames: W.__T.frames.filter((f) => f.step > 60).map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Math.round(v)]))), loaf: W.__loaf.slice(n0).filter((e) => e.d > 120).map((e) => ({ d: e.d, script: e.s.reduce((x, y) => x + y.d, 0) })) };
      W.__T.frames = [];
      const stop = W.__hits(); await wait(o.hitsMs ?? 9000); stop(); await wait(600);
      W.__T.on = false; on = false;
      out.hits = { slowFrames: W.__T.frames.filter((f) => f.step > 60).map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => /^(update|apply|three|render|step|frame|upload)$/.test(k)).map(([k, v]) => [k, Math.round(v)]))), frames: W.__T.frames.length };
      out.programs1 = progs().length; out.ghost.avg = out.ghost.built ? +(out.ghost.ms / out.ghost.built).toFixed(2) : 0; out.ghost.ms = Math.round(out.ghost.ms); out.ghost.max = +out.ghost.max.toFixed(1); out.ghost.layout = hh && hh.layout ? hh.layout.n : null; out.loafLong = W.__loaf.slice(n0).filter((e) => e.d > 150).map((e) => ({ t: Math.round(e.t - out.t0), d: e.d, script: e.s.reduce((x, y) => x + y.d, 0) }));
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
