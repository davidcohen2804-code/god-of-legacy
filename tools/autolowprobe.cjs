// GPT's P4B (test only): &autolow's starting level — cold entry, a remembered Auto level, the player's manual choice —
// with the browser's reported GPU replaced (an integrated Intel UHD, an Intel Arc, an NVIDIA card, the test browser's own).
//   node autolowprobe.cjs PORT OUTFILE
const { chromium } = require('playwright');
const fs = require('fs');
const [port, outFile] = process.argv.slice(2);
const UHD = 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const ARC = 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const NV = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const CASES = [
  { name: 'cold, Intel UHD, &autolow', q: '&autolow', gpu: UHD, ls: {}, expect: 2 },
  { name: 'remembered Auto level 1 (Medium), Intel UHD, &autolow', q: '&autolow', gpu: UHD, ls: { 'gol-a3d-lean-level': '1' }, expect: 1 },
  { name: 'remembered Auto level 0 (High), Intel UHD, &autolow', q: '&autolow', gpu: UHD, ls: { 'gol-a3d-lean-level': '0' }, expect: 0 },
  { name: 'manual High, Intel UHD, &autolow', q: '&autolow', gpu: UHD, ls: { 'gol-a3d-quality': '0' }, expect: 0 },
  { name: 'manual Medium, Intel UHD, &autolow', q: '&autolow', gpu: UHD, ls: { 'gol-a3d-quality': '1' }, expect: 1 },
  { name: 'cold, Intel Arc, &autolow', q: '&autolow', gpu: ARC, ls: {}, expect: 0 },
  { name: 'cold, NVIDIA, &autolow', q: '&autolow', gpu: NV, ls: {}, expect: 0 },
  { name: 'cold, the test browser (SwiftShader), &autolow', q: '&autolow', gpu: null, ls: {}, expect: 0 },
  { name: 'cold, Intel UHD, without &autolow', q: '', gpu: UHD, ls: {}, expect: 0 },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const res = [];
  for (const c of CASES) {
    const t0 = Date.now();
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    await p.addInitScript(([gpu, ls]) => {
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
      try { for (const k of ['gol-a3d-quality', 'gol-a3d-lean-level']) localStorage.removeItem(k); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {}
      if (gpu) for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const g = C.prototype.getParameter; C.prototype.getParameter = function (x) { return x === 0x9246 ? gpu : g.call(this, x); }; }
    }, [c.gpu, c.ls]);
    p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
    let r;
    try {
      await p.goto(`http://127.0.0.1:${port}/?spirits&ns${c.q}`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 600000, polling: 250 });
      await p.waitForTimeout(800); await p.keyboard.press('Enter');
      await p.waitForFunction(() => window.__game?.scene.isActive('CharacterSelectScene') && window.__game.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'), null, { timeout: 600000, polling: 250 });
      await p.waitForTimeout(500); await p.keyboard.press('Enter');
      // the level read as soon as the 3D world exists (before any step down by the frame watch)
      r = await p.waitForFunction(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const a = s && s.sys.isActive() && s.a3d; if (!a) return null;
        let gpu = null; try { const c = document.createElement('canvas'), gl = c.getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
        return { level: a.qualityLevel, manual: a.manual, bloom: !!a.composer, shadows: a.renderer.shadowMap.enabled, render: `${a.renderer.domElement.width}x${a.renderer.domElement.height}`, remembered: localStorage.getItem('gol-a3d-lean-level'), manualKey: localStorage.getItem('gol-a3d-quality'), gpu }; }, null, { timeout: 900000, polling: 100 }).then((h) => h.jsonValue());
    } catch (e) { r = { err: e.message.slice(0, 200) }; }
    res.push({ case: c.name, expect: c.expect, ...r, ok: r && r.level === c.expect, sec: Math.round((Date.now() - t0) / 1000) });
    console.log(JSON.stringify(res[res.length - 1]));
    await ctx.close();
  }
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
