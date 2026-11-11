// GPT's P4B (diagnosis only, David's PC): the afterimages' first use with and without &ghostwarm / &ghostlite — from the
// press that enters the world to repeated strikes: every shader program made (its name, when), every slow WebGL call
// (compiles, links, status reads, uploads, draws that wait on a compile) with a short stack, the long frames, and each
// afterimage's own build (its CPU skinning) — by phase: the entry, the arrival's settling, the first strikes, repeated
// strikes. Loaded after bench3.js (keys, hits, save backup and restore). Timing wrappers only; the page is reloaded after.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__loaf = W.__loaf || [];
  if (!W.__loafOn) { W.__loafOn = true; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), b: Math.round(e.blockingDuration || 0), s: (e.scripts || []).map((s) => ({ d: Math.round(s.duration), fn: s.sourceFunctionName, url: (s.sourceURL || '').split('/').pop() })) }); }).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) { W.__loafErr = String(e); } }
  const H = (W.__h2 = W.__h2 || { phase: 'idle', on: false, programs: [], slow: [], slowN: {}, t0: 0 });
  if (!W.__h2gl) { // (the prototypes: the 3D world's context is made when the world opens)
    W.__h2gl = true;
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const P = C.prototype, ctx = C === WebGL2RenderingContext ? '3d' : '2d';
      const ss = P.shaderSource; P.shaderSource = function (sh, src) { if (H.on) try { if (this.getShaderParameter(sh, this.SHADER_TYPE) === this.VERTEX_SHADER) { const m = /#define SHADER_TYPE (\S+)/.exec(src), nm = /#define SHADER_NAME ([^\n]*)/.exec(src); H.programs.push({ at: Math.round(performance.now() - H.t0), phase: H.phase, ctx, name: (m ? m[1] : '?') + (nm && nm[1].trim() ? ' ' + nm[1].trim() : '') }); } } catch (e) { /* (logged only) */ } return ss.call(this, sh, src); };
      for (const fn of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getUniformLocation', 'useProgram', 'texImage2D', 'texSubImage2D', 'generateMipmap', 'bufferData', 'bufferSubData', 'drawElements', 'drawArrays', 'readPixels', 'finish']) {
        const f = P[fn]; if (typeof f !== 'function') continue;
        P[fn] = function (...a) { if (!H.on) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; if (d > 6 && ((H.slowN[H.phase] = (H.slowN[H.phase] || 0) + 1) <= 30)) H.slow.push({ at: Math.round(t - H.t0), phase: H.phase, ctx, fn, ms: Math.round(d), stack: String(new Error().stack).split('\n').slice(2, 7).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^ )]*\//, '')).join(' < ') }); } };
      }
    }
  }
  W.__h2Run = async (o = {}) => {
    const out = (W.__h2Out = { state: 'start', q: location.search });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', String(o.level ?? 0));
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene') && G.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait')); await wait(2500);
      H.programs.length = 0; H.slow.length = 0; H.slowN = {}; H.t0 = performance.now(); H.phase = 'entry'; H.on = true; const n0 = W.__loaf.length;
      await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.hero3d.h && s.hero3d.h.body && s.a3d && s.spiritForm; });
      out.worldMs = Math.round(performance.now() - H.t0); H.phase = 'arrival';
      const sc = S(), h = sc.hero3d.h;
      out.ghost = {}; const g0 = h.ghost; h.ghost = function (...a) { const before = this.lastGhost, t = performance.now(); const r = g0.apply(this, a); if (this.lastGhost !== before) { const d = performance.now() - t, b = (out.ghost[H.phase] ??= { n: 0, ms: 0, max: 0 }); b.n++; b.ms += d; b.max = Math.max(b.max, d); } return r; };
      await wait(o.settle ?? 6000);
      out.poolAtArrival = h.ghosts.length;
      H.phase = 'first strikes'; const n1 = W.__loaf.length, t1 = performance.now();
      let stop = W.__hits(); await wait(o.firstMs ?? 1500); stop(); await wait(1200);
      H.phase = 'repeated strikes'; const n2 = W.__loaf.length;
      stop = W.__hits(); await wait(o.hitsMs ?? 8000); stop(); await wait(800);
      H.on = false; const n3 = W.__loaf.length;
      const lf = (a, b) => W.__loaf.slice(a, b).filter((e) => e.d > 50).map((e) => ({ at: Math.round(e.t - H.t0), d: e.d, block: e.b, script: e.s.reduce((x, y) => x + y.d, 0), top: e.s.sort((x, y) => y.d - x.d).slice(0, 2).map((s) => `${s.fn || '?'}@${s.url}:${s.d}`) }));
      out.longFrames = { entry: lf(n0, n1).filter((e) => e.at <= out.worldMs + (o.settle ?? 6000)), firstStrikes: lf(n1, n2), repeated: lf(n2, n3) };
      out.programs = H.programs.filter((x) => x.ctx === '3d').reduce((m, x) => { (m[x.phase] ??= []).push(`${x.name}@${x.at}`); return m; }, {});
      out.slow = H.slow;
      for (const b of Object.values(out.ghost)) { b.avg = +(b.ms / b.n).toFixed(2); b.ms = Math.round(b.ms); b.max = +b.max.toFixed(1); }
      out.pool = h.ghosts.length; out.layout = h.layout ? h.layout.n : null; out.firstStrikeAt = Math.round(t1 - H.t0);
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { H.on = false; try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
