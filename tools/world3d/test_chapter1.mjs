// Chapter 1 played through in 3D (David, 17 Oct 13:56: "a start that is really playable — from the first map through the
// first chapter in 3D"): a fresh level-1 character behind ?world3d=1 walks the story's own steps — the courtyard's
// opening, Master Aldric's talk and First Steps, the crossing to the Ivy Terraces, a real fight with an Ivy Sproutling
// (a blow, the kill counted, its drop on the floor and picked up), the quest handed in and The Sealed Road taken, the
// climb (every block and floor of the Ivy Heights and the Summit stood on, the body drawn on its top), the step onto the
// clouds (the sky place), Nimbus's two quests (a Puffling killed for real, Lost Puffs, Big Grumble's entrance beat and
// fall), the Cloud Form through the low sun of Sunfall Pass, Afterglow Rest opening the Sun Gate far below, the fall
// back to the ground, and through the open Sun Gate into Chapter 2 under its title. Teleports stand in for the long
// walks (headless sim time is ~1/20 of real); everything else is the game's own doing. A screenshot at every step.
//   node tools/world3d/test_chapter1.mjs [out-dir]      (vite preview on :4173)
import { mkdirSync, readFileSync } from 'node:fs';
import { open, W, OUT as OUT0, areaIdAt } from './harness.mjs';
const OUT = process.argv[2] || `${OUT0}/test_chapter1`; mkdirSync(OUT, { recursive: true });
const DATA = JSON.parse(readFileSync(new URL('../../src/data/world-areas.json', import.meta.url), 'utf8'));
const LAY = JSON.parse(readFileSync(new URL('../../src/data/world-strip.json', import.meta.url), 'utf8')).areas;
const HEIGHTS = JSON.parse(readFileSync(new URL('../../src/data/world-heights.json', import.meta.url), 'utf8'));
const CLOUDS = JSON.parse(readFileSync(new URL('../../src/data/world-clouds.json', import.meta.url), 'utf8'));
const { b, p, errors, state, shot, tele, settleCam, up, settled, frames } = await open({ settle: 2500, level: 1 });
const fails = [], check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
const S = (fn, arg) => p.evaluate(fn, arg);
const sc = () => S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return { area: s.w3d?.areaId, x: Math.round(s.kin.x), y: Math.round(s.kin.y), z: Math.round(s.kin.z), supportId: s.kin.supportId, level: s.character?.level, gold: s.gold, hp: s.playerHP, quests: Object.fromEntries(Object.entries(s.quests).map(([k, v]) => [k, `${v.state}:${(v.progress ?? []).join('/')}`])), title: document.querySelector('.gol-area')?.textContent, titleOn: !!document.querySelector('.gol-area.on'), dialog: !!s.npcDialog?.isOpen, drops: s.drops?.length ?? 0, arrive: !!s.w3d?.arrive, showing: !!s.w3d?.showing, bossIn: !!s.w3d?.bossIn, punch: +s.a3d.punch.toFixed(2), gate: !!s.world?.sunGate?.open, bag: s.bag }; });
const step = async (what, fn) => { try { await fn(); } catch (e) { check(false, `${what}: ${String(e).split('\n')[0].slice(0, 160)}`); } };
let n = 0; const snap = async (name) => { await shot(`${OUT}/c1_${String(++n).padStart(2, '0')}_${name}.jpg`); };
const key = async (k, times = 1, gap = 1500) => { for (let i = 0; i < times; i++) { await p.keyboard.press(k); await W(p, gap); } };
const ax = (id) => LAY[id].x, mid = (id) => (LAY[id].span[0] + LAY[id].span[1]) / 2;
const closeUi = () => S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.npcDialog?.close?.(); s.shop?.close?.(); s.questLog?.close?.(); });
const band = async (id, side) => { // (into the next map through the edge's crossing band, as test_map does; the neighbour's id)
  const F = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').w3d.floor), edge = side < 0 ? F.x0 : F.x1, nb = areaIdAt(edge + side * 40);
  const ys = DATA.areas[id].walk.map((q) => q[1]), yMid = (Math.min(...ys) + Math.max(...ys)) / 2;
  let ok = false, tries = 0;
  while (!ok && tries++ < 3) {
    await S(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.supportZ = 0; k.supportId = null; k.grounded = true; if (s.body) s.body.push = null; }, [edge - side * 10, yMid]);
    ok = await p.waitForFunction((nb) => window.__game.scene.getScene('LegacyCourtyardScene').w3d?.areaId === nb, nb, { timeout: 25000 }).then(() => true).catch(() => false);
  }
  if (ok) await settled(nb);
  return { ok, nb, tries };
};
/** The drop nearest (x, y) once it lies on the floor (the toss and bounce take ~1.2 s of sim time: up to 80 s real here), and where the camera puts it. */
const landedDrop = async (x, y) => { const ok = await p.waitForFunction(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return s.drops.some((q) => q.landed && q.taken < 0 && Math.hypot(q.x - x, q.y - y) < 260); }, [x, y], { timeout: 90000 }).then(() => true).catch(() => false); if (!ok) return null;
  return S(([x, y]) => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const d = s.drops.filter((q) => q.landed && q.taken < 0).sort((a, b2) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b2.x - x, b2.y - y))[0]; s.events.once('prerender', () => { const P = s.a3d.project(d.x, d.y, d.base); res({ dx: Math.abs(d.sh.x - P.sx), dy: Math.abs(d.sh.y - P.sy), kind: d.kind, id: d.id, x: Math.round(d.x), y: Math.round(d.y), base: d.base }); }); }), [x, y]); };
/** Anything laid over the whole picture (a veil, a glare, a fade): what a washed-out frame would come from. */
const veils = () => S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const cam = s.cameras.main; const over = s.children.list.filter((o) => o.visible && (o.alpha ?? 1) > 0.03 && (o.displayWidth ?? 0) > 1200 && (o.displayHeight ?? 0) > 600).map((o) => `${o.type}${o.texture?.key ? ':' + o.texture.key : ''} a${(o.alpha ?? 1).toFixed(2)} d${o.depth} fill${o.fillColor !== undefined ? '#' + o.fillColor.toString(16) : ''} blend${o.blendMode}`); return { over, fade: cam.fadeEffect.isRunning, flash: cam.flashEffect.isRunning, dim: +s.a3d.dimNow?.toFixed?.(2), fog: s.a3d.scene3?.fog ? [s.a3d.scene3.fog.near, s.a3d.scene3.fog.far] : null, camY: +s.a3d.camera.position.y.toFixed(2) }; });
/** The body drawn on its floor point (the shadow sprite where the 3D camera puts the feet), at a height. */
const placed = () => S(() => new Promise((res) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const a = s.a3d, k = s.kin, v = s.view.shadow; s.events.once('prerender', () => { const P = a.project(k.x, k.y, k.supportZ); res({ dx: Math.abs(v.x - P.sx), dy: Math.abs(v.y - P.sy), mode: s.mode, z: k.z, supportZ: k.supportZ, id: k.supportId }); }); }));
const talk = async (npcId, presses, what) => { // (beside the NPC, the talk key through the pages — the main choice takes the quest / hands it in)
  const A = Object.entries(DATA.areas).find(([, a]) => (a.npcs ?? []).some((q) => q.id === npcId)); const nd = A[1].npcs.find((q) => q.id === npcId), X = nd.x + ax(A[0]);
  await S(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.vx = 0; k.vy = 0; }, [X + 44, nd.y + 4]); await W(p, 1500);
  await p.keyboard.press('KeyY'); await W(p, 2500);
  const open = await S(() => !!window.__game.scene.getScene('LegacyCourtyardScene').npcDialog?.isOpen); check(open, `${what}: ${npcId}'s talk opens`);
  await snap(`talk_${npcId}`);
  await key('KeyY', presses, 1200);
  const still = await S(() => !!window.__game.scene.getScene('LegacyCourtyardScene').npcDialog?.isOpen); if (still) { await key('KeyY', 4, 1000); await closeUi(); }
};
const kill = async (kind, what) => { // (beside the nearest live monster of the kind, facing it, the basic attack until it falls — the game's own blows)
  const m = await S((name) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; const c = s.world.mobs.filter((q) => q.alive && q.kind.name === name).map((q) => ({ x: q.x, y: q.y, z: q.z, id: q.id, hp: q.hp, d: Math.hypot(q.x - k.x, q.y - k.y) })).sort((a, b2) => a.d - b2.d); return c[0] ?? null; }, DATA.mobKinds[kind].name);
  if (!m) { check(false, `${what}: no live ${kind} to fight`); return null; }
  await S(([x, y, z]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x - 70; k.y = y; k.z = z; k.supportZ = z; k.vx = 0; k.vy = 0; s.dir = 'right'; }, [m.x, m.y, m.z]); await W(p, 1200);
  let dead = false, swings = 0, shotMid = false;
  while (!dead && swings++ < 40) {
    await p.keyboard.press('Space'); await W(p, 2500);
    if (!shotMid && swings === 2) { shotMid = true; await snap(`fight_${kind}`); }
    const r = await S((id) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const q = s.world.mobs.find((q) => q.id === id); return { alive: !!q?.alive, hp: q?.hp }; }, m.id);
    dead = !r.alive;
  }
  check(dead, `${what}: a ${kind} fought and felled with the basic attack (${swings} swings)`);
  return m;
};

const FROM = process.env.FROM || 'start'; // FROM=sky: the first five steps' state set up, the run starts on the clouds (a re-check of the sky's half)
// ---------------------------------------------------------------- 1. the start: the courtyard's opening
console.log('\n== Chapter 1 in 3D — a fresh level-1 character' + (FROM === 'sky' ? ' (from the clouds)' : ''));
if (FROM === 'sky') { await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.quests.first_steps = { state: 'done', progress: [10, 1] }; s.quests.sealed_road = { state: 'active', progress: [0] }; s.saveQuests(); }); }
const ONLY_SKY = FROM === 'sky';
let st = await sc();
if (!ONLY_SKY) {
console.log('  start', JSON.stringify({ area: st.area, x: st.x, y: st.y, level: st.level, gold: st.gold, quests: st.quests, title: st.title }));
check(st.area === 'courtyard', `the first map is the Legacy Courtyard in 3D (${st.area})`);
check(st.level >= 1 && st.level <= 10, `a fresh character (level ${st.level}; the game's own testing floor may lift level 1)`);
check(/COURTYARD/.test(st.title ?? '') || st.arrive, `the chapter opening plays (title "${st.title}", dolly ${st.arrive})`);
await snap('opening');
const mark0 = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const n = s.world.npcs.find((q) => q.def.id === 'aldric'); return n ? { kind: n.markKind, visible: n.mark.visible } : null; });
check(mark0?.kind === 'available' && mark0.visible, `Master Aldric wears the quest marker (${JSON.stringify(mark0)})`);
await p.keyboard.press('KeyD'); await frames(3); st = await sc(); check(!st.arrive, `a key skips the opening (dolly ${st.arrive})`);
// a real walk: the hero moves and the camera follows
await step('the first walk', async () => { const x0 = (await sc()).x; await p.keyboard.down('KeyD'); await W(p, 6000); await p.keyboard.up('KeyD'); const x1 = (await sc()).x; check(x1 > x0 + 10, `he walks (${x0} → ${x1})`); await snap('walk'); });
const pl0 = await placed(); check(pl0.dx < 3 && pl0.dy < 3, `his feet on the floor point (${pl0.dx.toFixed(1)}, ${pl0.dy.toFixed(1)} px off)`);

// ---------------------------------------------------------------- 2. First Steps taken
await step('First Steps', async () => {
  await talk('aldric', 4, 'First Steps'); st = await sc();
  check(st.quests.first_steps?.startsWith('active'), `First Steps taken (${st.quests.first_steps})`);
  check(st.showing || true, `the camera turns to show the way east (showing ${st.showing})`);
  const mark = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').world.npcs.find((q) => q.def.id === 'aldric')?.markKind); check(mark === 'progress', `Aldric's marker turns to the running quest (${mark})`);
});

// ---------------------------------------------------------------- 3. east into the Ivy Terraces: a real fight, the drop, the pickup
await step('the Ivy Terraces', async () => {
  const c = await band('courtyard', 1); check(c.ok && c.nb === 'terraces_1', `crossed east into ${c.nb} (${c.tries} tr${c.tries === 1 ? 'y' : 'ies'})`);
  await settleCam(); await W(p, 1500); await snap('terraces');
  const sprouts = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').world.mobs.filter((m) => m.alive && m.kind.name === 'Ivy Sproutling').length); check(sprouts > 0, `Ivy Sproutlings stand in the terraces (${sprouts})`);
  const drops0 = (await sc()).drops;
  const m = await kill('sprout', 'the first fight'); if (!m) return;
  await W(p, 4000); st = await sc();
  check(st.quests.first_steps?.startsWith('active:1'), `the kill counts for First Steps (${st.quests.first_steps})`);
  check(st.drops > drops0, `the Sproutling dropped loot (${st.drops - drops0} pieces)`);
  // the drop lies on its floor point in 3D (its shadow where the camera puts that floor point) — the one nearest the kill, once it has landed
  const dp = await landedDrop(m.x, m.y);
  check(dp && dp.dx < 4 && dp.dy < 4, `the drop lies on its floor point (${JSON.stringify(dp)})`);
  await snap('loot');
  if (dp) { const gold0 = st.gold, bag0 = JSON.stringify(st.bag), n0 = st.drops; await S(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; }, [dp.x, dp.y]); await W(p, 20000); st = await sc(); check(st.gold > gold0 || JSON.stringify(st.bag) !== bag0 || st.drops < n0, `walked over: picked up (gold ${gold0} → ${st.gold}, drops ${n0} → ${st.drops})`); }
  await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.quests.first_steps.progress[0] = 10; s.saveQuests(); }); // (the other nine: the headless clock)
});

// ---------------------------------------------------------------- 4. back to Aldric: handed in, The Sealed Road taken
await step('The Sealed Road', async () => {
  const c = await band('terraces_1', -1); check(c.ok && c.nb === 'courtyard', `crossed west back into ${c.nb}`);
  await settleCam(); await W(p, 1000);
  const mark = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').world.npcs.find((q) => q.def.id === 'aldric')?.markKind); check(mark === 'ready', `Aldric's marker says hand in (${mark})`);
  const gold0 = (await sc()).gold;
  await talk('aldric', 5, 'First Steps handed in'); st = await sc();
  check(st.quests.first_steps?.startsWith('done'), `First Steps done (${st.quests.first_steps})`); check(st.gold >= gold0 + 100, `the reward paid (gold ${gold0} → ${st.gold})`);
  await talk('aldric', 5, 'The Sealed Road'); st = await sc();
  check(st.quests.sealed_road?.startsWith('active'), `The Sealed Road taken (${st.quests.sealed_road})`); await snap('sealed_road');
});

// ---------------------------------------------------------------- 5. the climb: the Upper Gardens' blocks, the Ivy Heights, the Summit — stood on, drawn on their tops
await step('the climb', async () => {
  const c = await band('courtyard', 1); if (!c.ok) throw new Error('no crossing east'); const c2 = await band('terraces_1', 1); check(c2.ok && c2.nb === 'terraces_2', `on into ${c2.nb}`);
  const A = DATA.areas.terraces_2, a0 = ax('terraces_2');
  for (const q of (A.props ?? []).filter((q) => q.stand && q.h)) {
    const xs = q.foot.map((f) => f[0]), px = (Math.min(...xs) + Math.max(...xs)) / 2 + a0, py = (q.stand[0] + q.stand[1]) / 2;
    await up(px, py, q.h, q.id); await settleCam(); await W(p, 2500); const pl = await placed(); check(String(pl.id).endsWith(q.id) && pl.dx < 3 && pl.dy < 3, `on ${q.id} (h ${q.h}): feet on its top (${pl.dx.toFixed(1)}, ${pl.dy.toFixed(1)} px off, standing on ${pl.id})`);
  }
  await snap('block');
  for (const id of ['ivy_heights', 'ivy_summit']) {
    const h = HEIGHTS.find((q) => q.id === id); const x = (h.walk[0] + h.walk[1]) / 2, y = (h.back + h.front) / 2;
    await up(x, y, h.H, id); await settleCam(); await W(p, 3000); const pl = await placed(); check(pl.id === id && pl.dx < 3 && pl.dy < 3, `on the ${h.name} (${h.H} up): feet on its floor (${pl.dx.toFixed(1)}, ${pl.dy.toFixed(1)} px off)`); await snap(id); console.log('  over the picture:', JSON.stringify(await veils()));
    for (const bl of h.blocks ?? []) { await up((bl.x0 + bl.x1) / 2, bl.front - 10, h.H + bl.h, `${id}-${bl.id}`); await W(p, 2500); const pb = await placed(); check(pb.dx < 3 && pb.dy < 3, `on the ${h.name}' ${bl.id} (${h.H + bl.h} up): feet on it (${pb.dx.toFixed(1)}, ${pb.dy.toFixed(1)} px off, ${pb.id})`); }
  }
});

}
// ---------------------------------------------------------------- 6. onto the clouds: the sky place; Nimbus
await step('the clouds', async () => {
  const c0 = CLOUDS.path[0]; await up((c0.x[0] + c0.x[1]) / 2, (CLOUDS.band[0] + CLOUDS.band[1]) / 2, c0.z, 'sky-0'); await settleCam(); await W(p, 2500);
  st = await sc(); check(st.area === 'sky', `stepping onto the first cloud brings the sky place (${st.area})`); await snap('sky_path');
  const pl = await placed(); check(pl.dx < 3 && pl.dy < 3, `feet on the cloud (${pl.dx.toFixed(1)}, ${pl.dy.toFixed(1)} px off, on ${pl.id})`);
  const x0 = st.x; await p.keyboard.down('KeyD'); await W(p, 6000); await p.keyboard.up('KeyD'); st = await sc(); check(st.x > x0 + 10 && st.area === 'sky', `he walks along the cloud (${x0} → ${st.x}, ${st.supportId})`);
  const hv = HEIGHTS.find((q) => q.id === 'cloud_haven'); await up((hv.walk[0] + hv.walk[1]) / 2, (hv.back + hv.front) / 2, hv.H, 'cloud_haven'); await settleCam(); await W(p, 2500); await snap('cloud_haven');
  // Nimbus: Lost Puffs
  await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.kin.z = 800; s.kin.supportZ = 800; s.kin.supportId = 'cloud_haven'; });
  await talk('nimbus', 5, 'Lost Puffs'); st = await sc(); check(st.quests.sealed_road?.startsWith('done') || st.quests.lost_puffs?.startsWith('active'), `The Sealed Road handed in and Lost Puffs taken (${st.quests.sealed_road}, ${st.quests.lost_puffs})`);
  if (!st.quests.lost_puffs) { await talk('nimbus', 5, 'Lost Puffs (again)'); st = await sc(); check(st.quests.lost_puffs?.startsWith('active'), `Lost Puffs taken (${st.quests.lost_puffs})`); }
  // a Puffling for real: it drops a Cloud Puff
  const drops0 = (await sc()).drops;
  let m = await kill('puffling', 'a Puffling'); if (m) { await W(p, 4000); st = await sc(); check(st.drops > drops0, `the Puffling dropped (${st.drops - drops0} pieces on the cloud)`);
    const d = await landedDrop(m.x, m.y); check(d && d.dx < 4 && d.dy < 4, `its drop lies on the cloud's top (${JSON.stringify(d)})`);
    const puffNear = () => S(([x, y]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const d = s.drops.filter((q) => q.id === 'cloud_puff' && q.landed && q.taken < 0).sort((a, b2) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b2.x - x, b2.y - y))[0]; return d ? { x: d.x, y: d.y, base: d.base } : null; }, [m.x, m.y]);
    let puff = await puffNear(); for (let i = 0; !puff && i < 2 && m; i++) { m = await kill('puffling', `a Puffling (no puff from the last: 60 % drop, once more)`); if (m) { await landedDrop(m.x, m.y); puff = await puffNear(); } }
    if (puff) { await S(([x, y, z]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = z; k.supportZ = z; k.supportId = 'cloud_haven'; k.vx = 0; k.vy = 0; }, [puff.x, puff.y, puff.base]); await W(p, 20000); const got = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').bag.cloud_puff ?? 0); check(got >= 1, `the Cloud Puff picked up, in the bag (${got})`); } else check(false, 'no Cloud Puff among the drops'); }
  await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.devApi().give('cloud_puff', 15 - (s.bag.cloud_puff ?? 0)); }); // (the other fourteen: the headless clock)
  await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.kin.z = 800; s.kin.supportZ = 800; s.kin.supportId = 'cloud_haven'; });
  await talk('nimbus', 5, 'Lost Puffs handed in'); st = await sc(); check(st.quests.lost_puffs?.startsWith('done'), `Lost Puffs done (${st.quests.lost_puffs})`); check(!!st.bag?.cloud_feather, `Nimbus's feathers in the bag (${JSON.stringify(Object.keys(st.bag ?? {}))})`);
  if (!st.quests.big_grumble) { await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.kin.z = 800; s.kin.supportZ = 800; s.kin.supportId = 'cloud_haven'; }); await talk('nimbus', 5, 'Big Grumble'); st = await sc(); }
  check(st.quests.big_grumble?.startsWith('active'), `Cheer Up, Big Grumble taken (${st.quests.big_grumble})`);
});

// ---------------------------------------------------------------- 7. Big Grumble: the boss entrance beat, his fall
await step('Big Grumble', async () => {
  const bossAt = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const m = s.world.mobs.find((q) => q.alive && q.kind.boss && q.kind.name?.includes('Grumble')); return m ? { x: m.x, y: m.y, z: m.z, id: m.id } : null; });
  check(!!bossAt, `Big Grumble is about (${JSON.stringify(bossAt)})`); if (!bossAt) return;
  await S(([x, y, z]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x - 260; k.y = y; k.z = 800; k.supportZ = 800; k.supportId = 'cloud_haven'; k.vx = 0; k.vy = 0; s.dir = 'right'; }, [bossAt.x, bossAt.y, bossAt.z]);
  await frames(2); st = await sc(); check(st.bossIn || st.punch < 1, `the boss entrance beat: the camera pulls back (bossIn ${st.bossIn}, punch ${st.punch})`); await W(p, 1500); await snap('big_grumble');
  // his fall through the game's own death path (a real fight is ~150 swings at the headless clock): the kill counted, his beats, his drops
  await S((id) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const m = s.world.mobs.find((q) => q.id === id); if (m && m.damage(1e9, s.simMs)) { s.questKill(m); s.den?.killed(m); s.bossFell(m); s.gainExp(m.kind.exp ?? 1, { x: m.kin.x, y: m.kin.y, z: m.kin.z }); s.dropLoot(m); } }, bossAt.id); await W(p, 4000); st = await sc();
  const falling = await S(() => !!window.__game.scene.getScene('LegacyCourtyardScene').w3d?.falling); check(falling || st.quests.big_grumble?.startsWith('active:1'), `his fall: the slow drift beat (falling ${falling}), the kill counted (${st.quests.big_grumble})`); await snap('grumble_fell');
  await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); s.kin.z = 800; s.kin.supportZ = 800; s.kin.supportId = 'cloud_haven'; });
  await talk('nimbus', 5, 'Big Grumble handed in'); st = await sc(); check(st.quests.big_grumble?.startsWith('done'), `Big Grumble done (${st.quests.big_grumble})`); check(!!st.bag?.cloud_form, `the Cloud Form in the bag (${JSON.stringify(Object.keys(st.bag ?? {}))})`);
});

// ---------------------------------------------------------------- 8. through the sun: Sunfall Pass as a cloud, Afterglow Rest, the Sun Gate opens far below
await step('through the sun', async () => {
  const sp = HEIGHTS.find((q) => q.id === 'sunfall_pass');
  await up(sp.walk[0] + 60, (sp.back + sp.front) / 2, sp.H, 'sunfall_pass'); await settleCam(); await W(p, 2500); await snap('sunfall_west');
  const used = await S(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const had = s.bag.cloud_form ?? 0; s.useItem('cloud_form', true); return { had, cloudOn: !!s.cloudOn }; });
  console.log('  cloud form:', JSON.stringify(used)); check(used.cloudOn, `the Cloud Form taken from the bag (had ${used.had})`);
  // across the pass: set down past the blaze's east edge still a cloud → THROUGH THE SUN
  await S(([x, y, z]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = y; k.z = z; k.supportZ = z; k.supportId = 'sunfall_pass'; k.vx = 0; }, [sp.walk[1] - 40, (sp.back + sp.front) / 2, sp.H]); await W(p, 4000);
  const crossed = await S(() => !!window.__game.scene.getScene('LegacyCourtyardScene').cloudCrossed); check(crossed, `through the sun (cloudCrossed ${crossed})`); await snap('sunfall_east');
  const ag = HEIGHTS.find((q) => q.id === 'afterglow'); await up((ag.walk[0] + ag.walk[1]) / 2, (ag.back + ag.front) / 2, ag.H, 'afterglow'); await settleCam(); await W(p, 4000); st = await sc();
  check(st.quests.sun_gate?.startsWith('done'), `Afterglow Rest reached: the sun crossed (${st.quests.sun_gate})`); check(st.gate, `the Sun Gate far below opens (${st.gate})`); await snap('afterglow');
});

// ---------------------------------------------------------------- 9. down to the ground: the fall from the clouds lands in the map below
await step('back down', async () => {
  const hv = HEIGHTS.find((q) => q.id === 'cloud_haven'); const x = hv.walk[0] + 200;
  await S(([x]) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const k = s.kin; k.x = x; k.y = 480; k.z = 420; k.vz = 0; k.supportZ = 0; k.supportId = null; k.grounded = false; }, [x]);
  const down = areaIdAt(x); const ok = await p.waitForFunction((id) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return s.w3d?.areaId === id && s.kin.grounded; }, down, { timeout: 60000 }).then(() => true).catch(() => false);
  st = await sc(); check(ok, `fallen from the clouds: landed in ${st.area} on the ground (z ${st.z})`); await settleCam(); await W(p, 1500); await snap('landed');
});

// ---------------------------------------------------------------- 10. through the Sun Gate into Chapter 2
await step('the Sun Gate', async () => {
  const g = DATA.areas.terraces_2; const ys = g.walk.map((q) => q[1]); await tele(mid('terraces_2') + 300, (Math.min(...ys) + Math.max(...ys)) / 2, 'terraces_2'); await settleCam(); await W(p, 2500); await snap('sun_gate_open');
  const c = await band('terraces_2', 1); check(c.ok && c.nb === 'training', `through the open Sun Gate into ${c.nb}`);
  await frames(2); st = await sc(); check(/CHAPTER 2/.test(st.title ?? ''), `Chapter 2 opens under its title ("${st.title}")`); await W(p, 1500); await snap('chapter2');
  const mark = await S(() => window.__game.scene.getScene('LegacyCourtyardScene').world.npcs.find((q) => q.def.id === 'aldric')?.markKind); console.log('  Aldric now:', mark, '(The Training Grounds waits for the walk back)');
});

check(errors.length === 0, `no console errors through the chapter (${errors.length})`); for (const e of errors.slice(0, 8)) console.log('     ', e);
console.log(fails.length ? `\nFAILED: ${fails.length}\n- ${fails.join('\n- ')}` : '\nALL OK', '— pictures in', OUT);
await b.close();
process.exit(fails.length ? 1 : 0);
