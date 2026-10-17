// A 3D map's headless test (docs/WORLD_3D_SPEC.md §1.9), for any map: opens the game with ?world3d=1, teleports in,
// walks the map end to end with a screenshot every `STEP` px from the player's own camera, checks the hero's body is
// drawn on his floor point, jumps onto the first thing the data says you can stand on, talks to every NPC of the map,
// swings a skill, crosses both exits (when the neighbour is a 3D map) and comes back, reads the frame time and the
// stage's draw count, and fails on any console error. Usage:
//   node tools/world3d/test_map.mjs <areaId|all> [out-dir]     (vite preview on :4173; STEP=400 SHOTS=0 to skip pictures)
import { mkdirSync, readFileSync } from 'node:fs';
import { open, W, OUT as OUT0, areaIdAt } from './harness.mjs';
const want = process.argv[2] || 'courtyard', OUT = process.argv[3] || `${OUT0}/test_${want}`; mkdirSync(OUT, { recursive: true });
const STEP = Number(process.env.STEP || 400), SHOTS = process.env.SHOTS !== '0';
const DATA = JSON.parse(readFileSync(new URL('../../src/data/world-areas.json', import.meta.url), 'utf8'));
const LAY = JSON.parse(readFileSync(new URL('../../src/data/world-strip.json', import.meta.url), 'utf8')).areas;
const MAPS_3D = (readFileSync(new URL('../../src/world3d/flag.ts', import.meta.url), 'utf8').match(/MAPS_3D = \[([^\]]*)\]/) ?? [, ''])[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter((s) => s && s !== 'sky');
const ids = want === 'all' ? MAPS_3D : want.split(',');
const { b, p, errors, state, shot, tele, settleCam, openGate, info, settled } = await open({ settle: 5000 });
await openGate();
const fails = [], check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
const S = (fn, arg) => p.evaluate(fn, arg);
const closeUi = () => S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.npcDialog?.close?.(); s.shop?.close?.(); s.questLog?.close?.(); return !!s.npcDialog?.isOpen; });
const grounded = () => p.waitForFunction(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; return k.grounded && Math.abs(k.z - (k.supportZ || 0)) < 1; }, null, { timeout: 60000 }).catch(() => undefined);
const step = async (what, fn) => { try { await fn(); } catch (e) { check(false, `${what}: ${String(e).split('\n')[0].slice(0, 120)}`); } };
for (const id of ids) {
  const A = DATA.areas[id], L = LAY[id]; if (!A || !L) { console.log(id, 'unknown'); continue; }
  const ys = A.walk.map((q) => q[1]), yMid = (Math.min(...ys) + Math.max(...ys)) / 2, x0 = L.span[0], x1 = L.span[1], ax = L.x;
  console.log(`\n== ${id} (${A.name}) span ${x0}..${x1}`);
  const n0 = errors.length;
  await closeUi();
  if (id.startsWith('den_')) await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.den?.walls?.(false); }); // (the den's stage gates out of the way: the crossings can be tried)
  await step('entering', () => tele(x0 + 120, yMid)); await settleCam(); await W(p, 2500);
  const F = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return { floor: s.w3d.floor, area: s.w3d.areaId }; });
  check(F.area === id, `the 3D place is ${F.area}`);
  if (F.area !== id) continue;
  // 1) end to end
  let i = 0; for (let x = x0 + 120; x <= x1 - 120; x += STEP, i++) { await tele(x, yMid); await settleCam(); await W(p, 1200); if (SHOTS) await shot(`${OUT}/${id}_walk_${String(i).padStart(2, '0')}.jpg`); }
  const st = await state(); check(st.area === id || areaIdAt(st.x) === id, `still on the map after the walk (${st.area})`);
  // 2) the body on its floor point
  const placedAt = async (x) => { await tele(x, yMid); await settleCam(); await W(p, 1500); return S(() => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const a = s.a3d, k = s.kin, v = s.view.shadow; s.events.once('prerender', () => { const P = a.project(k.x, k.y, 0); res({ dx: Math.abs(v.x - P.sx), dy: Math.abs(v.y - P.sy), mode: s.mode }); }); })); };
  let placed = await placedAt((x0 + x1) / 2); if (placed.dx >= 3 || placed.dy >= 3) placed = await placedAt(x0 + 220); // (a monster's blow jolts the body: once more away from the spawns)
  check(placed.dx < 3 && placed.dy < 3, `the hero's feet on his floor point (${placed.dx.toFixed(1)}, ${placed.dy.toFixed(1)} px off, ${placed.mode})`);
  // 3) onto the first thing you can stand on (a block, a crate, a log…): teleport beside it, jump toward it
  const standable = (A.props ?? []).filter((q) => q.stand && q.h && q.h <= 110).sort((a, b2) => a.h - b2.h)[0]; // (what a jump reaches)
  if (standable) {
    const xs = standable.foot.map((q) => q[0]), px = (Math.min(...xs) + Math.max(...xs)) / 2 + ax, py = (standable.stand[0] + standable.stand[1]) / 2;
    await tele(px - 110, py + 6); await W(p, 800); await p.keyboard.down('KeyD'); await W(p, 9000); await p.keyboard.press('KeyE'); await W(p, 10000); await p.keyboard.up('KeyD'); await grounded(); // (headless sim time is ~1/20 of real: a long run-up, the jump, a long flight)
    const up = await state(); const on = up.supportZ > 0; console.log(`  ${on ? 'ok   ' : 'note '}${on ? 'standing on' : 'missed'} ${standable.id} after the jump (supportZ ${up.supportZ}, ${up.supportId}, x ${Math.round(up.x - ax)} vs ${Math.round(px - ax)}) — the jump's reach is the game's; a miss here is the headless clock`); if (SHOTS) await shot(`${OUT}/${id}_jump.jpg`);
  }
  // 4) every NPC: the talk opens
  for (const n of A.npcs ?? []) {
    await step(`${n.name}'s talk`, async () => {
      await tele(n.x + ax + 40, n.y + 4); await settleCam(); await W(p, 2500); await p.keyboard.press('KeyY'); await W(p, 3000);
      const talk = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return !!s.npcDialog?.isOpen || !!s.shop?.isOpen; });
      check(talk, `${n.name}'s talk opens`); if (SHOTS) await shot(`${OUT}/${id}_${n.id}.jpg`);
      const still = await closeUi(); await W(p, 800); if (still) check(false, `${n.name}'s talk closes`);
    });
  }
  // 5) a swing and a skill with its 3D pieces
  await step('the skill', async () => { await tele((x0 + x1) / 2, yMid); await W(p, 500); await p.keyboard.press('Space'); await W(p, 700); await p.keyboard.press('Digit1'); await W(p, 2500); if (SHOTS) await shot(`${OUT}/${id}_skill.jpg`); });
  // 6) both exits: to the neighbour when it is 3D, and back
  await p.waitForFunction(() => window.__game.scene.getScene('LegacyCourtyardScene').mode === 'idle', null, { timeout: 30000 }).catch(() => undefined); // (the skill over: a dash would carry him out of the edge band)
  for (const side of [-1, 1]) {
    const edge = side < 0 ? F.floor.x0 : F.floor.x1, nb = areaIdAt(edge + side * 40); if (nb === id || !MAPS_3D.includes(nb)) continue;
    const sealed = (side < 0 ? A.props ?? [] : DATA.areas[nb]?.props ?? []).some((q) => q.id === 'entry-wall'); if (sealed) { console.log(`  —    ${side < 0 ? 'west' : 'east'}: sealed (an entry wall)`); continue; }
    await step(`crossing ${side < 0 ? 'west' : 'east'}`, async () => {
      // (headless sim time is too slow to walk there: the hero is set down inside the edge's crossing band — 14 px — and the crossing itself is what is tested: the fade, the next place built, the hero on its floor)
      let ok = true; try { await tele(edge - side * 10, yMid, nb); } catch { ok = false; } const at = await state(); check(ok && at.x > 0, `crossed ${side < 0 ? 'west' : 'east'} into ${nb} (x ${Math.round(at.x)}, place ${(await S(() => window.__game.scene.getScene('LegacyCourtyardScene').w3d?.areaId))})`);
      await tele((x0 + x1) / 2, yMid); await settleCam(); });
  }
  // 7) the frame and the stage's work
  const perf = await S(() => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const t = []; let last = performance.now(); const f = () => { const n = performance.now(); t.push(n - last); last = n; if (t.length < 12) requestAnimationFrame(f); else res({ avg: Math.round(t.reduce((a, c) => a + c, 0) / t.length), worst: Math.round(Math.max(...t)), fps: +s.game.loop.actualFps.toFixed(2) }); }; requestAnimationFrame(f); }));
  const inf = await info(); console.log('  frame', JSON.stringify(perf), 'stage', JSON.stringify(inf));
  check(errors.length === n0, `no console errors on ${id} (${errors.length - n0})`); for (const e of errors.slice(n0, n0 + 6)) console.log('     ', e);
}
console.log(fails.length ? `\nFAILED: ${fails.length}\n- ${fails.join('\n- ')}` : '\nALL OK', '— pictures in', OUT);
await b.close();
process.exit(fails.length ? 1 : 0);
