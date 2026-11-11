// GPT's P4B (test only), the bloom-off look's three conditions: (1) the brazier's halo as the camera moves round it and
// behind what stands in front of it; (2) how many warm lights each place has (where to measure the halo's cost);
// (3) the Samurai's blade and eyes without bloom — High, 1280×720, actual size.   node glowprobe.cjs PORT OUTDIR QUERY [count]
const { chromium } = require('playwright');
const fs = require('fs');
const [port, out, q = '', count = ''] = process.argv.slice(2);
const S = "window.__game.scene.getScene('LegacyCourtyardScene')";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); try { localStorage.setItem('gol-a3d-quality', '0'); } catch {} });
  p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const frames = async (n) => { const f0 = await ev(() => window.__game.loop.frame); await p.waitForFunction((t) => window.__game.loop.frame >= t, f0 + n, { polling: 50, timeout: 900000 }); };
  const fast = (on) => ev(([S, on]) => { const sc = eval(S), a = sc?.a3d; if (!a) return false; const R = a.renderer;
    if (on && !window.__fr) { window.__fr = { own: Object.prototype.hasOwnProperty.call(R, 'render'), r: R.render, c: a.composer, cr: a.composer && a.composer.render }; R.render = () => {}; if (a.composer) a.composer.render = () => {}; window.__fu = []; for (const k of ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero']) if (sc.textures.exists(k)) { const src = sc.textures.get(k).source[0]; window.__fu.push([src, src.update]); src.update = () => {}; } }
    else if (!on && window.__fr) { const f = window.__fr; if (f.own) R.render = f.r; else delete R.render; if (f.c) f.c.render = f.cr; for (const [src, u] of window.__fu) src.update = u; window.__fr = null; }
    return true; }, [S, on]);
  const shot = async (name, clip) => { const was = await ev(() => !!window.__fr); if (was) { await fast(false); await frames(3); } await p.screenshot({ path: `${out}/${name}.png`, timeout: 300000, ...(clip ? { clip } : {}) }); console.log('shot', name); if (was) await fast(true); };
  const log = { q };
  await p.goto(`http://127.0.0.1:${port}/?spirits&ns${q}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(800); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__game?.scene.isActive('CharacterSelectScene') && window.__game.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(500); await p.keyboard.press('Enter');
  await p.waitForFunction((S) => { const s = eval(S); return s && s.sys.isActive() && s.a3d; }, S, { timeout: 900000, polling: 200 });
  await fast(true);
  await p.waitForFunction((S) => { const s = eval(S); return s && s.sys.isActive() && s.hero3d && s.a3d && s.spiritForm; }, S, { timeout: 900000, polling: 500 });
  await fast(false); await fast(true);
  await ev((S) => { const d = eval(S).devApi?.(); if (d) { d.flags.peace = true; d.flags.god = true; } }, S);
  const sim = async (ms) => { const t0 = await ev((S) => eval(S).simMs, S); await p.waitForFunction(([S, t]) => eval(S).simMs >= t, [S, t0 + ms], { polling: 50, timeout: 900000 }); };
  const place = (x, y) => ev(([S, x, y]) => { const s = eval(S), k = s.kin; k.x = x; k.y = y; k.z = 0; k.vx = k.vy = k.vz = 0; k.supportZ = 0; k.supportId = null; k.grounded = true; s.world?.snapTo(k.x, k.y, 0); if (s.w3d) s.w3d.arrive = null; }, [S, x, y]);
  const face = async (key) => { await p.keyboard.down(key); await frames(2); await p.keyboard.up(key); await frames(6); };
  // where the room's warm lights fall on the screen now (the viewport's pixels), and the halos' sprites
  const warm = () => ev((S) => { const s = eval(S), a = s.a3d, cam = a.camera, W = 1280, H = 720; cam.updateMatrixWorld(); return a.room.warm.map((L) => { const v = L.getWorldPosition(L.position.clone()); const d = +v.distanceTo(cam.position).toFixed(1); v.project(cam); return { x: Math.round((v.x + 1) / 2 * W), y: Math.round((1 - v.y) / 2 * H), on: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1, d }; }); }, S);
  await sim(2500);
  log.warm = await warm(); log.glowSprites = await ev((S) => { let n = 0; eval(S).a3d.scene3.traverse((o) => { if (o.isSprite) n++; }); return n; }, S);
  // (1) the brazier from round it: the camera follows him, so he stands in different places round it
  const views = [['b_front', 950, 420], ['b_left', 640, 430], ['b_right', 1260, 430], ['b_near_left', 860, 340], ['b_far_right', 1560, 560], ['b_infront_close', 950, 352]];
  log.views = {};
  for (const [nm, x, y] of views) {
    await place(x, y); await sim(1500);
    const w = (await warm()).find((l) => l.on); log.views[nm] = w || null;
    await shot(nm);
    if (w) { const c = { x: Math.max(0, w.x - 130), y: Math.max(0, w.y - 150), width: 260, height: 260 }; c.width = Math.min(c.width, 1280 - c.x); c.height = Math.min(c.height, 720 - c.y); log.views[nm].crop = c; }
  }
  // (3) the eyes at rest and the blade through the basic attack, frame by frame (his own pixels)
  const hero = () => ev((S) => { const s = eval(S), h = s.hero3d.h, a = s.a3d, cam = a.camera, body = h.body, v = h.root.position.clone(), n = body.geometry.attributes.position.count; h.root.updateMatrixWorld(true); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < n; i += 3) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); v.project(cam); const x = (v.x + 1) / 2 * 1280, y = (1 - v.y) / 2 * 720; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } const hd = h.bones.get('Head').getWorldPosition(v); hd.project(cam); return { box: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)], head: [Math.round((hd.x + 1) / 2 * 1280), Math.round((1 - hd.y) / 2 * 720)] }; }, S);
  await place(1000, 560); await sim(800); await face('KeyD'); await place(1000, 560); await sim(1500);
  log.idle = await hero(); await shot('idle');
  await fast(false); await frames(3);
  const cast = () => ev((S) => { const r = eval(S).rt?.ownRun; return r ? { id: r.skill.id, el: Math.round(r.elapsed), stage: r.stage ?? 0 } : null; }, S);
  await p.keyboard.down('Space'); await frames(1); await p.keyboard.up('Space');
  log.atk = [];
  for (let i = 0; i < 8; i++) { log.atk.push({ cast: await cast(), ...(await hero()) }); await shot(`atk_${i}`); await frames(1); }
  await fast(true);
  // (2) the warm lights of every place (where several are seen at once: the halo's cost to measure there)
  if (count) {
    const areas = await ev((S) => eval(S).devApi().areas(), S); log.places = [];
    for (const ar of areas) {
      if (ar.id === 'arena' || ar.id === 'sky') continue;
      const w0 = await ev((S) => { const s = eval(S); window.__w3dOld = s.w3d; return s.areaName; }, S);
      await ev(([S, id]) => eval(S).devApi().goto(id), [S, ar.id]);
      try { await p.waitForFunction(([S, name]) => { const s = eval(S); return (s.areaName === name || s.w3d !== window.__w3dOld) && s.a3d && s.a3d.room; }, [S, ar.name.replace(/ \(up\)$/, '')], { timeout: 120000, polling: 250 }); } catch {}
      await sim(2500);
      const r = await ev((S) => { const s = eval(S), a = s.a3d; return a && a.room ? { area: s.areaName, place: s.w3d && s.w3d.areaId, warm: a.room.warm.length, glows: (a.room.glows || []).length } : { area: s.areaName, none: true }; }, S);
      const w = await warm().catch(() => []); r.onScreen = w.filter((l) => l.on).length;
      log.places.push({ id: ar.id, ...r }); console.log(JSON.stringify(log.places[log.places.length - 1]));
    }
  }
  fs.writeFileSync(`${out}/log.json`, JSON.stringify(log, null, 1)); console.log(JSON.stringify(log).slice(0, 800));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
