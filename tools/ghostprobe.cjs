// GPT's P4B (test only): when the afterimages' shader program is made and their buffers first uploaded — every WebGL
// shader source, program link and large buffer upload logged with the moment (boot, the arrival, the first strikes,
// repeated strikes), and each afterimage's own build (its CPU skinning) timed.   node ghostprobe.cjs PORT QUERY OUTFILE
const { chromium } = require('playwright');
const fs = require('fs');
const [port, q = '', outFile, vw = '1280x720'] = process.argv.slice(2);
const [VW, VH] = vw.split('x').map(Number);
const S = "window.__game.scene.getScene('LegacyCourtyardScene')";
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: VW, height: VH } });
  const tStart = Date.now(); setInterval(() => { p.evaluate(() => { const s = window.__game && window.__game.scene.getScene('LegacyCourtyardScene'); return { phase: window.__phase, frame: window.__game && window.__game.loop.frame, sim: s ? Math.round(s.simMs || 0) : null, hero: !!(s && s.hero3d) }; }).then((x) => console.log('t' + Math.round((Date.now() - tStart) / 1000), JSON.stringify(x))).catch(() => {}); }, 30000).unref();
  await p.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    try { localStorage.setItem('gol-a3d-quality', '2'); } catch {}
    const L = (window.__glLog = { shaders: [], links: [], buffers: [] }); window.__phase = 'boot';
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const P = C.prototype, ctx = C === WebGL2RenderingContext ? '3d' : '2d';
      const ss = P.shaderSource; P.shaderSource = function (sh, src) { try { if (this.getShaderParameter(sh, this.SHADER_TYPE) === this.VERTEX_SHADER) { const m = /#define SHADER_TYPE (\S+)/.exec(src), nm = /#define SHADER_NAME ([^\n]*)/.exec(src); L.shaders.push({ t: Math.round(performance.now()), phase: window.__phase, ctx, name: (m ? m[1] : '?') + (nm && nm[1].trim() ? ' ' + nm[1].trim() : '') }); } } catch {} return ss.call(this, sh, src); };
      const lp = P.linkProgram; P.linkProgram = function (pr) { const t = performance.now(); const r = lp.call(this, pr); L.links.push({ t: Math.round(t), phase: window.__phase, ctx, ms: +(performance.now() - t).toFixed(1) }); return r; };
      const bd = P.bufferData; P.bufferData = function (tg, d, ...x) { const n = typeof d === 'number' ? d : d && d.byteLength; if (n >= 100000) L.buffers.push({ t: Math.round(performance.now()), phase: window.__phase, ctx, kb: Math.round(n / 1024) }); return bd.call(this, tg, d, ...x); };
    }
  });
  p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
  const ev = (f, a) => p.evaluate(f, a);
  const phase = (n) => ev((n) => { window.__phase = n; }, n);
  await p.goto(`http://127.0.0.1:${port}/?spirits&ns${q}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(800); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__game?.scene.isActive('CharacterSelectScene') && window.__game.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(500); await p.keyboard.press('Enter');
  await p.waitForFunction((S) => { const s = eval(S); return s && s.sys.isActive() && s.a3d; }, S, { timeout: 3000000, polling: 100 });
  await phase('arrival');
  await p.waitForFunction((S) => { const s = eval(S); return s && s.hero3d && s.hero3d.h && s.hero3d.h.body; }, S, { timeout: 3000000, polling: 100 });
  const sim = async (ms) => { const t0 = await ev((S) => eval(S).simMs, S); await p.waitForFunction(([S, t]) => eval(S).simMs >= t, [S, t0 + ms], { polling: 50, timeout: 3000000 }); };
  const pool = () => ev((S) => { const h = eval(S).hero3d.h; return { n: h.ghosts.length, t: h.ghosts.map((g) => +g.t.toFixed(2)), visible: h.ghosts.filter((g) => g.m.visible).length, layout: h.layout ? h.layout.n : null, bodyVerts: h.body.geometry.attributes.position.count, opacity: h.ghosts.map((g) => +g.m.material.opacity.toFixed(3)) }; }, S);
  await ev((S) => { const d = eval(S).devApi?.(); if (d) { d.flags.peace = true; d.flags.god = true; } }, S);
  await sim(3000);
  const out = { q, arrivalPool: await pool() };
  // each afterimage's build timed (its CPU skinning of the body's vertices)
  await ev((S) => { const h = eval(S).hero3d.h, g0 = h.ghost; window.__gb = []; h.ghost = function (...a) { const before = this.lastGhost, t = performance.now(); const r = g0.apply(this, a); if (this.lastGhost !== before) window.__gb.push({ phase: window.__phase, ms: +(performance.now() - t).toFixed(2), pool: this.ghosts.length }); return r; }; }, S);
  // the first strikes: the basic attack's combo (its second and third cuts leave afterimages)
  await phase('first strikes');
  await p.keyboard.down('Space'); await sim(1600); await p.keyboard.up('Space'); // (held: the combo chains on its own)
  await sim(1500);
  out.afterFirst = await pool();
  await phase('repeated strikes');
  await p.keyboard.down('Space'); await sim(6000); await p.keyboard.up('Space');
  await sim(1500);
  out.afterRepeat = await pool();
  out.log = await ev(() => window.__glLog);
  out.builds = await ev(() => window.__gb);
  const by = (arr) => arr.reduce((m, x) => { (m[x.phase] ??= []).push(x); return m; }, {});
  out.summary = {
    programsByPhase: Object.fromEntries(Object.entries(by(out.log.shaders.filter((s) => s.ctx === '3d'))).map(([k, v]) => [k, v.map((s) => s.name)])),
    basicPrograms: out.log.shaders.filter((s) => s.ctx === '3d' && s.name.startsWith('MeshBasicMaterial')).map((s) => `${s.phase} @${s.t}`),
    bigUploadsByPhase: Object.fromEntries(Object.entries(by(out.log.buffers.filter((s) => s.ctx === '3d'))).map(([k, v]) => [k, v.map((s) => s.kb + 'KB')])),
    linksByPhase: Object.fromEntries(Object.entries(by(out.log.links)).map(([k, v]) => [k, v.length])),
    builds: Object.fromEntries(Object.entries(by(out.builds)).map(([k, v]) => [k, { n: v.length, avgMs: +(v.reduce((a, x) => a + x.ms, 0) / v.length).toFixed(2), maxMs: Math.max(...v.map((x) => x.ms)), poolAfter: v[v.length - 1].pool }])),
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.summary));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
