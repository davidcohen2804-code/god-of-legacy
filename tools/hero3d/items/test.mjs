// The 3D heroes' items, tested (David 25 Oct: "…and test it"): every item on the man and on the woman, each put on,
// driven through the moves (standing, walking, running, a jump, a skill of its weapon, a blow taken, thrown, down, up),
// then taken off (their cast shadows on, as in the arena) — checked that nothing throws, nothing goes to NaN, a hat stays on the head, a cloak hangs behind and
// off the body and above the floor, a dye reaches the shader, an aura moves, an item weapon is in the fist and its kind's
// own comes back, and that putting on and taking off leaves no geometry or texture behind. The catalogue is checked too
// (one piece per class and slot, the weapons' files there).
// node tools/hero3d/items/test.mjs [http://127.0.0.1:5173/]   (with the Vite dev server running: npx vite)
import { chromium } from 'playwright';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await p.goto(URL + 'tools/hero3d/art/art.html?v=' + Date.now(), { timeout: 300000 });
await p.waitForFunction(() => window.ready, null, { timeout: 300000 });
const report = await p.evaluate(async () => {
  const THREE = window.__THREE, out = { catalogue: [], items: [], leaks: [] };
  const M = await import('/src/arena3d/items3d.ts');
  // the catalogue
  const ids = new Set();
  for (const it of M.ITEMS3D) { if (ids.has(it.id)) out.catalogue.push(`duplicate id ${it.id}`); ids.add(it.id); if (!M.SLOTS3D.includes(it.slot)) out.catalogue.push(`${it.id}: no slot ${it.slot}`); }
  for (const c of M.CLASSES3D) for (const s of M.SLOTS3D) { const n = M.ITEMS3D.filter((i) => i.cls === c && i.slot === s).length; if (n !== 1) out.catalogue.push(`${c} has ${n} ${s}`); }
  for (const it of M.ITEMS3D.filter((i) => i.slot === 'weapon')) { const r = await fetch('assets/hero3d/' + it.file, { method: 'HEAD' }); if (!r.ok) out.catalogue.push(`${it.id}: ${it.file} missing`); }
  const kindOf = { w_dragonfang: 'sword', s_crimson_moon: 'katana', a_sylvan_wing: 'bow', m_astral_staff: 'staff', g_royal_flush: 'cane' };
  const SKILL = { sword: 'whirlwind', katana: 'iai_strike', bow: 'quick_shot', staff: 'arcane_bolt', cane: 'cut_the_deck' };
  const r = new THREE.WebGLRenderer({ antialias: false }); r.setSize(200, 200, false);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50); cam.position.set(0, 0.75, 3.4); cam.lookAt(0, 0.7, 0);
  const finite = (o) => { let ok = true; o.updateMatrixWorld(true); o.traverse((x) => { for (const v of x.matrixWorld.elements) if (!Number.isFinite(v)) ok = false; }); return ok; };
  for (const female of [false, true]) {
    const H = await window.__hero(female), sc = new THREE.Scene(); sc.add(H.scene); sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2));
    if (!H.shadowMat) H.makeShadow(new THREE.Vector3(0.4, 1, 0.3).normalize()); // (as the arena has it: every piece its shadow, laid and taken away with it)
    const head = (() => { let h = null; H.root.traverse((o) => { if (o.isBone && o.name === 'Head') h = o; }); return h; })();
    const draw = () => { r.render(sc, cam); return { geo: r.info.memory.geometries, tex: r.info.memory.textures }; };
    H.setWeapon('sword'); await H.equipAll({}); H.pose('Idle_Loop', 0.3, 0.5); const base = draw();
    for (const it of M.ITEMS3D) {
      const kind = it.slot === 'weapon' ? kindOf[it.id] : 'sword', fails = [];
      H.setWeapon(kind); await H.equip(it.slot, it.id); await new Promise((res) => setTimeout(res, 30));
      // through the moves: 2.6 s at 60 frames a second
      const modes = ['idle', 'walk', 'run', 'takeoff', 'air', 'land', 'skill', 'hurt', 'launched', 'down', 'getup', 'alert'];
      let t = 0, x = 0;
      for (const mode of modes) for (let f = 0; f < 13; f++) {
        t += 16; const vx = mode === 'run' ? 260 : mode === 'walk' ? 90 : 0; x += vx * 0.016;
        H.drive({ x, y: 0, z: mode === 'air' ? 60 : 0, vx, vy: 0, vz: mode === 'air' ? 120 : 0, grounded: mode !== 'air', face: 1, mode, cast: mode === 'skill' ? { id: SKILL[kind], stage: 0, elapsed: f * 40, startup: 120, active: 300, recovery: 200, dash: false, air: false } : null }, 16);
        if (!finite(H.scene)) { fails.push(`not finite in ${mode}`); break; }
      }
      H.root.updateMatrixWorld(true);
      const hp = head.getWorldPosition(new THREE.Vector3()), root = H.root.position.clone(), w = H.wear;
      if (it.slot === 'hat') { const g = w.hat?.g; if (!g) fails.push('no hat'); else { const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()); if (c.distanceTo(hp) > 0.35) fails.push(`hat ${c.distanceTo(hp).toFixed(2)} from the head`); } }
      if (it.slot === 'cloak') {
        const cl = w.cloak; if (!cl) fails.push('no cloak');
        else {
          const P = cl.p; let far = 0, low = 0, nan = 0;
          for (let i = 0; i < P.length; i += 3) { if (!Number.isFinite(P[i] + P[i + 1] + P[i + 2])) nan++; const d = Math.hypot(P[i] - root.x, P[i + 2] - root.z); if (d > 1.2) far++; if (P[i + 1] < 0) low++; }
          if (nan) fails.push(`cloak: ${nan} points NaN`); if (far) fails.push(`cloak: ${far} points flown off`); if (low) fails.push(`cloak: ${low} points under the floor`);
          // standing still again: the cloth behind the back (its middle behind the spine, the way the body faces)
          for (let i = 0; i < 60; i++) H.drive({ x, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, face: 1, yaw: 0, mode: 'idle', cast: null }, 16);
          H.root.updateMatrixWorld(true);
          let sp = null; H.root.traverse((o) => { if (o.isBone && o.name === 'spine_03') sp = o; });
          const s3 = sp.getWorldPosition(new THREE.Vector3()), mid = 3 * (Math.floor(cl.Hn / 2) * cl.W + Math.floor(cl.W / 2));
          if (!(P[mid + 2] < s3.z)) fails.push(`cloak not behind the back (${(P[mid + 2] - s3.z).toFixed(2)})`);
        }
      }
      if (it.slot === 'top' || it.slot === 'bottom' || it.slot === 'shoes') { await new Promise((res) => setTimeout(res, 400)); if (w.uni.uDyeOn.value !== 1) fails.push('dye off'); if (!w.uni.uReg.value) fails.push('no region map'); }
      if (it.slot === 'aura') { const a = w.aura; if (!a) fails.push('no aura'); else { const C = a.pts.geometry.attributes.color; let lit = 0; for (let i = 0; i < C.count; i++) if (C.getW(i) > 0.05) lit++; if (lit < C.count * 0.3) fails.push(`aura: ${lit}/${C.count} lit`); } }
      if (it.slot === 'weapon') {
        if (H.skins.get(kind) !== it.file) fails.push(`weapon not on (${H.skins.get(kind)})`);
        const g = H.weapons.get(kind), hand = g.parent, wg = H.wgrip.get(kind);
        if (!wg || !(wg.k > 0.3 && wg.k <= 1)) fails.push(`fist ${wg?.k}`);
        const gp = g.getWorldPosition(new THREE.Vector3()), hp2 = hand.getWorldPosition(new THREE.Vector3()); if (gp.distanceTo(hp2) > 0.12) fails.push(`weapon ${gp.distanceTo(hp2).toFixed(2)} from the hand`);
        if (kind === 'bow' && !H.bowString) fails.push('no bowstring');
      }
      draw();
      await H.equip(it.slot, null);
      if (it.slot === 'weapon' && H.skins.has(kind)) fails.push('weapon not back to its own');
      if (it.slot === 'hat' && w.hat) fails.push('hat still on'); if (it.slot === 'cloak' && w.cloak) fails.push('cloak still on'); if (it.slot === 'aura' && w.aura) fails.push('aura still on');
      if ((it.slot === 'top' || it.slot === 'bottom' || it.slot === 'shoes') && w.uni.uDyeOn.value !== 0) fails.push('dye still on');
      out.items.push({ body: female ? 'f' : 'm', id: it.id, ok: fails.length === 0, fails });
    }
    // on and off three times over: nothing left behind
    for (let k = 0; k < 3; k++) for (const c of M.CLASSES3D) { H.setWeapon(kindOf[M.ITEMS3D.find((i) => i.cls === c && i.slot === 'weapon').id]); await H.equipAll(Object.fromEntries(M.ITEMS3D.filter((i) => i.cls === c).map((i) => [i.slot, i.id]))); H.pose('Idle_Loop', 0.3, 0.5); draw(); }
    await H.equipAll({}); H.setWeapon('sword'); H.pose('Idle_Loop', 0.3, 0.5); const after = draw();
    out.leaks.push({ body: female ? 'f' : 'm', before: base, after, ok: after.geo <= base.geo + 2 && after.tex <= base.tex + 2 });
    sc.remove(H.scene);
  }
  r.dispose(); r.forceContextLoss();
  return out;
});
const bad = report.items.filter((i) => !i.ok);
console.log(`catalogue: ${report.catalogue.length ? report.catalogue.join('; ') : 'ok'}`);
console.log(`items: ${report.items.length - bad.length}/${report.items.length} passed`);
for (const i of bad) console.log(`  FAIL ${i.body} ${i.id}: ${i.fails.join('; ')}`);
for (const l of report.leaks) console.log(`leaks ${l.body}: geometries ${l.before.geo} → ${l.after.geo}, textures ${l.before.tex} → ${l.after.tex} ${l.ok ? 'ok' : 'LEAK'}`);
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
await b.close();
process.exit(report.catalogue.length || bad.length || report.leaks.some((l) => !l.ok) || errs.length ? 1 : 0);
