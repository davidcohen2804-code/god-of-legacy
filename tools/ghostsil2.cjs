// GPT's P4B (test only), second pass: the moments the first pass missed — the dashes facing left and Tornado Blade (cast
// in the air, both directions); otherwise as ghostsil.cjs: &ghostlite's silhouettes against today's afterimages — during the basic
// attack's combo, the mid-air dash (Shinsoku), Shadow Step and Tornado Blade (its facing flips), facing right and left.
// At each moment the afterimages on screen are drawn twice from the same skinned positions: with the body's own triangles
// (today) and with the lighter shadow body's (what &ghostlite draws: the same vertices, its own index). Masks compared
// pixel by pixel; the room + his layer drawn both ways (no bloom in these two pictures).   node ghostsil.cjs PORT OUTDIR
const { chromium } = require('playwright');
const fs = require('fs');
const [port, out] = process.argv.slice(2);
const S = "window.__game.scene.getScene('LegacyCourtyardScene')";
fs.mkdirSync(out, { recursive: true });
const KEYS = ['Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'KeyQ', 'KeyR', 'KeyF', 'KeyG', 'KeyC', 'KeyV', 'KeyT', 'KeyH', 'KeyZ', 'KeyX', 'KeyB', 'KeyN', 'KeyM'];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); try { localStorage.setItem('gol-a3d-quality', '0'); } catch {} });
  p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const frames = async (n) => { const f0 = await ev(() => window.__game.loop.frame); await p.waitForFunction((t) => window.__game.loop.frame >= t, f0 + n, { polling: 30, timeout: 900000 }); };
  await p.goto(`http://127.0.0.1:${port}/?spirits&ns&ghostlite=0`, { waitUntil: 'domcontentloaded' }); // (today's afterimages drawn: the lighter ones are compared from the same positions)
  await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(800); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__game?.scene.isActive('CharacterSelectScene') && window.__game.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait'), null, { timeout: 600000, polling: 250 });
  await p.waitForTimeout(500); await p.keyboard.press('Enter');
  const fast = (on) => ev(([S, on]) => { const sc = eval(S), a = sc?.a3d; if (!a) return false; const R = a.renderer;
    if (on && !window.__fr) { window.__fr = { own: Object.prototype.hasOwnProperty.call(R, 'render'), r: R.render, c: a.composer, cr: a.composer && a.composer.render }; R.render = () => {}; if (a.composer) a.composer.render = () => {}; window.__fu = []; for (const k of ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', 'arena3d-hero']) if (sc.textures.exists(k)) { const src = sc.textures.get(k).source[0]; window.__fu.push([src, src.update]); src.update = () => {}; } }
    else if (!on && window.__fr) { const f = window.__fr; if (f.own) R.render = f.r; else delete R.render; if (f.c) f.c.render = f.cr; for (const [src, u] of window.__fu) src.update = u; window.__fr = null; }
    return true; }, [S, on]);
  await p.waitForFunction((S) => { const s = eval(S); return s && s.sys.isActive() && s.a3d; }, S, { timeout: 900000, polling: 200 });
  await fast(true);
  await p.waitForFunction((S) => { const s = eval(S); return s && s.sys.isActive() && s.hero3d && s.hero3d.h.body && s.a3d && s.spiritForm; }, S, { timeout: 900000, polling: 500 });
  await fast(false); await fast(true);
  const sim = async (ms) => { const t0 = await ev((S) => eval(S).simMs, S); await p.waitForFunction(([S, t]) => eval(S).simMs >= t, [S, t0 + ms], { polling: 30, timeout: 900000 }); };
  const kit = await ev((S) => { const s = eval(S), d = s.devApi?.(); if (d) { d.flags.peace = true; d.flags.god = true; d.allSkills(true); d.heal(); } return s.kit.map((k) => (k ? k.id : null)); }, S);
  console.log('kit', JSON.stringify(kit));
  // the comparison, in the page
  await ev((S) => {
    window.__ghostCmp = () => {
      const sc = eval(S), a = sc.a3d, R = a.renderer, cam = a.camera, h = sc.hero3d.h, L = a.extra.find((l) => l.key === 'arena3d-hero');
      const gs = h.ghosts.filter((g) => g.m.visible && g.t < 1); if (!gs.length) return null;
      const six = h.body.userData.shadowIndex; if (!six) return { err: 'no shadow index' };
      const render = (s) => (window.__fr ? window.__fr.r : R.render).call(R, s, cam);
      const g0 = gs[0].m, Scene = a.scene3.constructor, Mesh = g0.constructor, Basic = g0.material.constructor, Geo = g0.geometry.constructor, Attr = g0.geometry.index.constructor;
      const lite = (window.__liteIx ??= new Attr(new Uint16Array(six), 1));
      const W = R.domElement.width, H = R.domElement.height, sw = sc.scale.width / W;
      // the screen box round the afterimages and his body
      const v = h.root.position.clone(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const add = (P, M) => { for (let i = 0; i < P.count; i += 37) { v.fromBufferAttribute(P, i); if (M) v.applyMatrix4(M); v.project(cam); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } };
      for (const g of gs) add(g.m.geometry.attributes.position, null);
      h.root.updateMatrixWorld(true); add(h.body.geometry.attributes.position, h.body.matrixWorld);
      const M = 34; x0 = Math.max(0, Math.floor(x0 - M)); y0 = Math.max(0, Math.floor(y0 - M)); x1 = Math.min(W, Math.ceil(x1 + M)); y1 = Math.min(H, Math.ceil(y1 + M));
      const cw = x1 - x0, ch = y1 - y0; if (cw < 8 || ch < 8) return null;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d', { willReadFrequently: true });
      const grab = () => { cx.clearRect(0, 0, cw, ch); cx.drawImage(R.domElement, x0, y0, cw, ch, 0, 0, cw, ch); return cx.getImageData(0, 0, cw, ch); };
      const cc = R.getClearColor(g0.material.color.clone()), ca = R.getClearAlpha(), ac = R.autoClear, tgt = R.getRenderTarget();
      R.setRenderTarget(null);
      const white = new Basic({ color: 0xffffff, side: g0.material.side });
      const mask = (list, useLite) => { const s = new Scene(); for (const g of list) { const geo = new Geo(); geo.setAttribute('position', g.m.geometry.attributes.position); geo.setIndex(useLite ? lite : g.m.geometry.index); const m = new Mesh(geo, white); m.frustumCulled = false; s.add(m); } R.setClearColor(0x000000, 1); R.autoClear = true; render(s); const d = grab().data, o = new Uint8Array(cw * ch); for (let i = 0; i < o.length; i++) o[i] = d[i * 4] > 127 ? 1 : 0; return o; };
      const cmp = (f, l) => { let nf = 0, nl = 0, lost = 0, extra = 0, both = 0; for (let i = 0; i < f.length; i++) { nf += f[i]; nl += l[i]; if (f[i] && !l[i]) lost++; else if (l[i] && !f[i]) extra++; else if (f[i]) both++; } return { fullPx: nf, litePx: nl, lostPx: lost, extraPx: extra, iou: +(both / Math.max(1, both + lost + extra)).toFixed(4), lostPct: +(100 * lost / Math.max(1, nf)).toFixed(2) }; };
      const per = gs.map((g) => ({ t: +g.t.toFixed(2), ...cmp(mask([g], false), mask([g], true)) }));
      const fu = mask(gs, false), li = mask(gs, true), all = cmp(fu, li);
      // the diff picture: white both, red only today's (lost by the lighter one), cyan only the lighter one's
      const di = cx.createImageData(cw, ch); for (let i = 0; i < fu.length; i++) { const k = i * 4; if (fu[i] && li[i]) { di.data[k] = di.data[k + 1] = di.data[k + 2] = 235; } else if (fu[i]) { di.data[k] = 255; di.data[k + 1] = 40; di.data[k + 2] = 40; } else if (li[i]) { di.data[k] = 40; di.data[k + 1] = 220; di.data[k + 2] = 255; } else { di.data[k] = di.data[k + 1] = di.data[k + 2] = 18; } di.data[k + 3] = 255; }
      cx.putImageData(di, 0, 0); const diff = cv.toDataURL('image/png');
      // the room and his layer (his body and the afterimages as the game draws them), today's triangles then the lighter ones
      const comp = (useLite) => { const saved = gs.map((g) => g.m.geometry.index); if (useLite) for (const g of gs) g.m.geometry.setIndex(lite);
        R.setClearColor(0x000000, 1); R.autoClear = true; render(a.scene3); R.autoClear = false; R.clearDepth(); if (a.occluders) render(a.occluders); render(L.scene); R.autoClear = true;
        cx.putImageData(grab(), 0, 0); const url = cv.toDataURL('image/png'); if (useLite) gs.forEach((g, i) => g.m.geometry.setIndex(saved[i])); return url; };
      const full = comp(false), liteImg = comp(true);
      white.dispose(); R.setClearColor(cc, ca); R.autoClear = ac; R.setRenderTarget(tgt);
      return { box: [x0, y0, cw, ch], scale: +sw.toFixed(3), ghosts: gs.length, tris: { full: g0.geometry.index.count / 3, lite: lite.count / 3 }, ...all, worstGhostLostPct: Math.max(...per.map((x) => x.lostPct)), per, imgs: { full, lite: liteImg, diff } };
    };
  }, S);
  const place = (x, y) => ev(([S, x, y]) => { const s = eval(S), k = s.kin; k.x = x; k.y = y; k.z = 0; k.vx = k.vy = k.vz = 0; k.supportZ = 0; k.supportId = null; k.grounded = true; s.world?.snapTo(k.x, k.y, 0); if (s.w3d) s.w3d.arrive = null; }, [S, x, y]);
  const face = async (key) => { await p.keyboard.down(key); await frames(2); await p.keyboard.up(key); await frames(4); };
  const res = []; let shotN = 20; // (numbered after the first pass's 20)
  const capture = async (name, dir) => {
    const r = await ev(() => window.__ghostCmp());
    if (!r || r.err) return false;
    const id = `${String(++shotN).padStart(2, '0')}_${name}_${dir}`;
    for (const [k, url] of Object.entries(r.imgs)) fs.writeFileSync(`${out}/${id}_${k}.png`, Buffer.from(url.split(',')[1], 'base64'));
    delete r.imgs; res.push({ id, action: name, dir, ...r }); console.log(id, JSON.stringify({ g: r.ghosts, iou: r.iou, lostPct: r.lostPct, worst: r.worstGhostLostPct }));
    return true;
  };
  // step the game a frame at a time through an action; capture when fresh afterimages are on screen (up to `max`)
  const through = async (name, dir, start, simMs, max = 3) => {
    await place(1000, 560); await sim(600); await face(dir === 'right' ? 'KeyD' : 'KeyA'); await place(1000, 560); await sim(900);
    await ev((S) => eval(S).devApi?.().heal(), S);
    const t0 = await ev((S) => eval(S).simMs, S); await start();
    let got = 0, lastF = -9;
    while (got < max) {
      const st = await ev(([S, t0]) => { const s = eval(S), h = s.hero3d.h; return { el: s.simMs - t0, fresh: h.ghosts.filter((g) => g.m.visible && g.t < 0.35).length, f: window.__game.loop.frame }; }, [S, t0]);
      if (st.el > simMs) break;
      if (st.fresh > 0 && st.f - lastF >= 3) { if (await capture(name, dir)) { got++; lastF = st.f; } }
      await frames(1);
    }
    await p.keyboard.up('Space');
    await sim(900);
    if (!got) res.push({ id: `-_${name}_${dir}`, action: name, dir, none: true });
  };
  const slot = (id) => { const i = kit.indexOf(id); return i >= 0 ? KEYS[i] : null; };
  const tap = async (key) => { await p.keyboard.down(key); await frames(2); await p.keyboard.up(key); };
  const tk = slot('tornado_blade');
  for (const dir of ['left', 'right']) { // Tornado Blade in the air (its facing flips), both directions
    if (tk) await through('tornado_blade', dir, async () => { await tap('KeyE'); await sim(220); await tap(tk); }, 2600, 4); else res.push({ id: `-_tornado_blade_${dir}`, action: 'tornado_blade', dir, notInKit: true });
  }
  const dir = 'left'; // the dashes facing left (the first pass stopped after the combo)
  await through('shinsoku', dir, async () => { await tap('KeyE'); await sim(260); await p.keyboard.down('KeyA'); await tap('KeyE'); await sim(60); await p.keyboard.up('KeyA'); }, 1400, 3);
  for (const sk of ['shadow_step', 'blossom_storm', 'hundred_cuts']) { const k = slot(sk); if (k) await through(sk, dir, async () => { await tap(k); }, 2600, 3); else res.push({ id: `-_${sk}_${dir}`, action: sk, dir, notInKit: true }); }
  fs.writeFileSync(`${out}/log.json`, JSON.stringify({ kit, res }, null, 1));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
