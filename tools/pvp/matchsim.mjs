// PvP balance sim in the real game: CPU battles in PVP 3D, the game stepped headless (the scene's own rules: damage,
// reactions, armor, zones, cards, gates, pokes). One side is the game's sparring knight (HARD); the other is the full class
// (its whole kit and mechanics) driven by a second copy of the knight's AI through the player's controls (move intent, aim,
// skill keys, held charges). Both sides as alike as the game allows: each is told the other's wind-up, gets up at once
// from the floor, faces the foe before a blow, lays ground skills on him; the player side uses its self buffs (the AI never
// casts a skill without damage) and does not press a gated skill; passives off and the starter sword's damage on the
// player's side (the knight has neither). Every ordered class pair (mirrors too), N battles each — a pair's battles are
// rematches in one scene; every ROUND is a sample. Results: tools/pvp/msimsum.py <out.json>.
//   npx vite build && npx vite preview --port 4173 &   then   node tools/pvp/matchsim.mjs
//   env: PAIRS ('all' or "samurai:warrior,…"), N (battles a pair, 6), MAXS (game s a battle, 300), OUT (json; resumes),
//        URL (http://localhost:4173/?hero3d=0), PASSIVES=1 (keep the player's passives), PROF=<file> (a CPU profile), FILM=<dir>
import { chromium } from 'playwright';
import { writeFileSync, existsSync, readFileSync } from 'fs';
const CLS = ['warrior', 'samurai', 'book_mage', 'archer', 'gambler'];
const N = Number(process.env.N ?? 6), MAXS = Number(process.env.MAXS ?? 300), OUT = process.env.OUT ?? 'matchsim.json';
const pairs = (process.env.PAIRS ?? 'all') === 'all' ? CLS.flatMap((a) => CLS.map((b) => [a, b])) : process.env.PAIRS.split(',').map((p) => p.split(':'));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await p.goto(process.env.URL ?? 'http://localhost:4173/?hero3d=0'); // (the painted bodies: the 3D heroes only slow the headless sim)
await p.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 300000 });
const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const t0 = Date.now();
for (const [A, B] of pairs) {
  const done = results.filter((x) => x.A === A && x.B === B).length; // (resume: a pair already played N times is skipped)
  if (done >= N) continue;
  let g0 = Date.now();
  await p.evaluate(({ A, B, FILM, KEEP }) => {
    const g = window.__game; g.loop.wake?.();
    for (const k of ['LegacyCourtyardScene', 'PvpSelectScene']) if (g.scene.isActive(k)) g.scene.stop(k);
    g.scene.start('PvpSelectScene', { mode: 'cpu' });
    window.__pair = { A, B }; window.__film = FILM; window.__keepPassives = KEEP;
  }, { A, B, FILM: !!process.env.FILM, KEEP: !!process.env.PASSIVES });
  await p.waitForFunction(() => window.__game.scene.isActive('PvpSelectScene'), null, { timeout: 120000 });
  await p.waitForTimeout(800);
  await p.evaluate(({ A, B }) => window.__game.scene.getScene('PvpSelectScene').start(A, B, 'cpu', undefined, 'hard'), { A, B });
  let ok = false;
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); return !!(s?.sys.isActive() && s.bot && s.match && s.ci && s.kit?.length && (s.a3d || new URLSearchParams(location.search).has('arena2d'))); })) { ok = true; break; } await p.waitForTimeout(1500); }
  if (!ok) { console.log('no scene', A, B); continue; }
  await p.waitForTimeout(1500);
  const setupS = Math.round((Date.now() - g0) / 1000);
  await p.evaluate(({ A }) => { // the player's brain and the counts, installed once in this scene (its battles are rematches)
    const g = window.__game; g.loop.sleep();
    const s = g.scene.getScene('LegacyCourtyardScene'), Bot = s.bot.constructor;
    const held = new Map();
    let brainCast = 0, startedCast = 0, refused = null, refusedCd = 0, breakAt = 0;
    const refusedN = new Map(); // (a skill the player could not use, again and again: it waits longer before it tries it again)
    const st = {};
    const fresh = () => { for (const k of Object.keys(st)) delete st[k]; brainCast = 0; startedCast = 0; Object.assign(st, { pFollow: 0, pUse: {}, pRefused: {}, bUse: {}, pHits: 0, pDmg: 0, bHits: 0, bDmg: 0, pCountered: 0, bCountered: 0, pBreaks: 0, bBreaks: 0, pDodges: 0, bDodges: 0, pPokes: 0, pOpen: 0, bOpen: 0, pStuckS: 0, bStuckS: 0, bCasts: 0, bFollow: 0, lap: [], pSk: {}, bSk: {} }); landed.clear(); castSk.clear(); };
    const castSk = new Map(), landed = new Set();
    const noteCast = (side, run) => { if (!run) return; castSk.set(run.castId, [side, run.skill.id]); const T = st[side]; (T[run.skill.id] ??= [0, 0])[0]++; };
    const noteLand = (run) => { const c = castSk.get(run.castId); if (!c || landed.has(run.castId)) return; landed.add(run.castId); st[c[0]][c[1]][1]++; };
    fresh();
    const brain = new Bot(s, s.kin.x, s.kin.y, {
      cast: (skill, stage, _o, _a, _p, _l, followUp) => {
        brainCast++; if (followUp) st.pFollow++; st.pUse[skill.id] = (st.pUse[skill.id] ?? 0) + 1;
        const i = s.kit.findIndex((k) => k.id === skill.id); if (i < 0) { refused = skill.id; st.pRefused['nokit:' + skill.id] = 1; return; }
        const bt = s.bot; s.ci.aimX = bt.x; s.ci.aimY = bt.y; s.ci.pointerActive = true;
        // turned to him first, as the knight's start() faces its foe (a human taps toward the foe): moving off or away, the soft lock looked the other way
        const fx = bt.x < s.kin.x ? -1 : 1; s.ci.moveX = 0; s.ci.moveY = 0; s.dir = fx < 0 ? 'left' : 'right'; s.aim = { x: fx, y: 0 }; s.faceSide = fx;
        if (s.tryStartSlot(i)) { startedCast++; noteCast('pSk', s.rt.ownRun); refusedN.delete(skill.id); held.set(i, s.simMs + (skill.charge ? Math.max(140, brain.cast?.T?.startup ?? 600) : 90)); } // (a charge held as long as the bot chose)
        else { refused = skill.id; refusedCd = s.rt.cooldownRemaining(skill.id); st.pRefused[skill.id] = (st.pRefused[skill.id] ?? 0) + 1; } // (the player could not act: the brain did not cast — told after its turn)
        void stage;
      },
      cancel: () => {},
    }, s.simMs, A);
    try { brain.view?.setVisible?.(false); brain.view?.destroy?.(); } catch { /* (its picture is not needed) */ }
    brain.view = new Proxy({ interpDelay: 0, maxHp: 1000 }, { get: (o, key) => (key in o ? o[key] : () => {}), set: (o, key, v) => { o[key] = v; return true; } }); // (its picture is not needed: every call a no-op)
    brain.setLevel('hard', s.simMs); brain.duel = true;
    const pb = s.body, BOT = 'npc-sparring';
    brain.body.arena = true; // (the arena's line rule, dodges and spacing — as the scene sets for the knight)
    brain.body.canAct = (t) => pb.canAct(t); brain.body.silenced = (t) => pb.silenced(t); // (the player struck: its cast drops; free again: it answers quickly — as the knight)
    // the knight's own wind-up, as the scene shows the knight the player's (windInfo): its cast, ms left to its strike, its reach
    const botWind = () => {
      const r = s.rt.runs.find((x) => x.attackerId === BOT && x.phase === 'startup'); if (!r) return undefined;
      const h = r.hits.find((x) => x.damage > 0) ?? r.hits[0]; if (!h) return undefined;
      const sh = h.shape, dash = Math.max(0, r.skill.dash?.distance ?? 0);
      const reach = sh.kind === 'sector' ? sh.range : sh.kind === 'line' ? sh.length : sh.kind === 'circle' ? sh.radius + (sh.bias ?? 0) : sh.kind === 'projectile' ? sh.range : 200;
      return { id: r.castId, left: r.timings.startup + h.at - r.elapsed, reach: reach + dash };
    };
    // the knight's casts: how many, follow-ups, which skills
    const bapi = s.bot.api, bcast = bapi.cast.bind(bapi);
    bapi.cast = (skill, stage, origin, aim, place, lock, followUp) => { st.bCasts++; if (followUp) st.bFollow++; st.bUse[skill.id] = (st.bUse[skill.id] ?? 0) + 1; bcast(skill, stage, origin, aim, place, lock, followUp); const rs = s.rt.runs; noteCast('bSk', rs[rs.length - 1]?.attackerId === BOT ? rs[rs.length - 1] : null); };
    let bDodgeSeen = 0, pDodgeSeen = 0;
    const BUFFS = s.kit.filter((x) => x.slot > 0 && !x.wip && x.targeting === 'self' && (x.roles ?? []).includes('setup') && !(x.roles ?? []).includes('mobility') && !(x.chain ? x.chain.stages.flat() : x.hits).some((h) => h.damage > 0));
    let lastNow = s.simMs;
    const ciUpdate = s.ci.update.bind(s.ci);
    s.ci.update = (now) => {
      ciUpdate(now);
      const dt = Math.max(1, Math.min(50, now - lastNow)); lastNow = now;
      const m = s.match, k = s.kin, bk = brain.kin, bt = s.bot;
      s.ci.aimX = bt.x; s.ci.aimY = bt.y; s.ci.pointerActive = true;
      if (!m || m.phase !== 'fight' || s.dead >= 0) { s.ci.moveX = 0; s.ci.moveY = 0; s.ci.running = false; return; }
      bk.x = k.x; bk.y = k.y; bk.z = k.z; bk.vx = k.vx; bk.vy = k.vy; bk.vz = k.vz; bk.grounded = k.grounded; bk.supportZ = k.supportZ ?? 0; // (the player's body as it is: the brain steers it one step from there, as the knight steers its own)
      // as the hard knight does: up at once off the floor, and now and then a BREAK out of a long combo (both sides alike)
      if (pb.state === 'knockdown' && pb.kdPhase === 'down' && now - pb.downAt > 380) pb.quickGetup(now);
      if (breakAt > 0 && now >= breakAt) { breakAt = 0; if (pb.canBreak(now)) { s.breakFree(now); st.pBreaks++; brain.nextAct = now + 350 + Math.random() * 300; } } // (out of it: a breath, as the knight's breakOut)
      if (!pb.canAct(now)) st.pStuckS += dt / 1000;
      if (!bt.body.canAct(now)) st.bStuckS += dt / 1000;
      brain.hold = false;
      refused = null;
      const bb = bt.body;
      const W = { now, player: { x: bt.x, y: bt.y, z: bt.z - (bt.kin.supportZ ?? 0), alive: !bt.defeated, guard: bb.ghost?.(now), stuck: bb.state !== 'free' || (bb.hard.active(now) && bb.hard.kind !== 'root'), wind: botWind() } };
      if (now >= (s.lightStaffUntil ?? 0)) brain.cdEnd.set('staff_flurry', Infinity); else if (brain.cdEnd.get('staff_flurry') === Infinity) brain.cdEnd.delete('staff_flurry');
      if (!brain.cast && pb.canAct(now) && now >= brain.nextAct && brain.thinkT <= 0 && k.grounded && Math.hypot(bt.x - k.x, bt.y - k.y) > 150) {
        const bf = BUFFS.find((x) => (brain.cdEnd.get(x.id) ?? 0) <= now && s.rt.cooldownRemaining(x.id) <= 0);
        if (bf) { st.pBuffs = (st.pBuffs ?? 0) + 1; brain.start(bf.id, 0, W); }
      }
      brain.update(dt, W);
      if (refused) { brain.interrupt(); const n = (refusedN.get(refused) ?? 0) + 1; refusedN.set(refused, n); const wait = refused === s.kit[0]?.id || n < 2 ? 0 : n >= 3 ? 1500 : 400; if (refusedCd > 0 || wait > 0) brain.cdEnd.set(refused, now + Math.max(refusedCd, wait)); else brain.cdEnd.delete(refused); } // (it never left: no cast to wait out; a skill still cooling (a round's pre-cooldown): it knows how long, as a player sees his tray; refused for another reason: a moment, longer if it keeps failing)
      if (brain.dodgeUntil > pDodgeSeen) { pDodgeSeen = brain.dodgeUntil; st.pDodges++; }
      if (bt.dodgeUntil > bDodgeSeen) { bDodgeSeen = bt.dodgeUntil; st.bDodges++; }
      // the stick held as far as its steering asks: the scene steers the player toward move × run speed (one accel step, as the brain did)
      const vx = bk.vx, vy = bk.vy, v = Math.hypot(vx, vy), f = v < 4 ? 0 : Math.min(1, v / 270) / v;
      s.ci.moveX = vx * f; s.ci.moveY = vy * f; s.ci.running = true;
      if (brain.cast && brain.cast.s.id !== 'whirlwind') { s.ci.moveX = 0; s.ci.moveY = 0; } // (in its cast the knight lets its body coast — only its spin steers: the stick let go, or the drift turned the archer's steered shots and cut recoveries short)
    };
    s.ci.slotHeld = (i) => (held.get(i) ?? -1) > s.simMs;
    // a ground-placed skill laid on the foe, as the knight lays its own (its api places at the player): the player's rule lays
    // it a fixed 180 px ahead — both sides alike here (a skilled player stands where it lands)
    const rc = s.resolveCast.bind(s); s.resolveCast = (sk) => { const r = rc(sk); if (r && sk.targeting === 'mouseGround' && s.bot) r.place = { x: s.bot.x, y: s.bot.y }; return r; };
    const atb = s.applyToBot.bind(s); s.applyToBot = (run, hit, t, at) => {
      const hp0 = s.bot.hp, open0 = s.bot.body.state === 'free' && !s.bot.body.combos.live?.(s.simMs); atb(run, hit, t, at);
      if (run.attackerId !== s.localId) return;
      if (run.poked) { brain.notePoke(); st.pPokes++; }
      if (s.bot.hp < hp0) { brain.noteHit(); st.pHits++; st.pDmg += hp0 - s.bot.hp; if (open0) st.pOpen++; noteLand(run); } // (its cast landed: no whiff)
    };
    const ats = s.applyRemoteHitToSelf.bind(s); s.applyRemoteHitToSelf = (run, hit, hi, at, claimed) => {
      const hp0 = s.playerHP, open0 = pb.state === 'free' && !pb.combos.live?.(s.simMs); ats(run, hit, hi, at, claimed);
      if (s.playerHP < hp0) { st.bHits++; st.bDmg += hp0 - s.playerHP; if (open0) st.bOpen++; noteLand(run); }
      const now = s.simMs; // the player breaks out of a long combo now and then — rolled on each hit taken, as applyToBot rolls the knight's
      if (!breakAt && s.match?.live && pb.canBreak(now) && (pb.combos.live(now)?.hits ?? 0) >= 4 && Math.random() < 0.3) breakAt = now + 160 + Math.random() * 220;
    };
    const cc = s.counterCall.bind(s); s.counterCall = (at) => { if (Math.abs(at.x - s.kin.x) < 0.5 && Math.abs(at.y - s.kin.y) < 0.5) st.pCountered++; else st.bCountered++; cc(at); };
    const bbo = s.bot.breakOut.bind(s.bot); s.bot.breakOut = (t, from) => { st.bBreaks++; bbo(t, from); };
    const brs = s.bot.resetAt.bind(s.bot); s.bot.resetAt = (x, y, now, dir) => { brs(x, y, now, dir); brain.resetAt(s.kin.x, s.kin.y, now, x < s.kin.x ? 'left' : 'right'); held.clear(); breakAt = 0; }; // (each round: the brain whole again too — the round's pre-cooldowns, as the knight's)
    // pictures only, never the fight: the capes' wind maps (a canvas read back per new frame) and the HUD's DOM layout
    for (const v of [s.view, s.bot.view?.view]) { let pr = v && Object.getPrototypeOf(v); while (pr && !Object.prototype.hasOwnProperty.call(pr, 'clothWind')) pr = Object.getPrototypeOf(pr); if (pr) pr.clothWind = function () {}; }
    if (s.hud && typeof s.hud.layout === 'function') s.hud.layout = () => {};
    // the class passives off for the player: the knight has none — the sim weighs kit against kit (env PASSIVES=1 keeps them)
    const NP = { dmg: 1, critAdd: 0, critDmgAdd: 0, takenMul: 1, hpMul: 1, moveMul: 1, jumpMul: 1, kbResist: 0, ccResist: 0, regen: false, fa: null, orbs: false, chanceAttack: 1, airLeap: false, evade: 0, rangeMul: 1, atkSpeed: 1, cdMul: 1,
      mage: Object.fromEntries(Object.keys(s.passives.mage ?? {}).map((k) => [k, false])), gamble: Object.fromEntries(Object.keys(s.passives.gamble ?? {}).map((k) => [k, false])) };
    // and the starter sword's damage (×1, as the knight's): the sim's fresh character fought bare-handed (×0.35, gear.json's unarmed), no armour either way
    const noPassives = () => { s.gearSt = { att: 17, def: 0, armed: true }; if (window.__keepPassives) return; s.passives = NP; s.body.ccResist = 0; s.body.kbResist = 0; };
    noPassives();
    const botRef = s.bot;
    window.__sim = {
      rematch: () => { try { s.askRematch(); return null; } catch (e) { return String(e?.stack ?? e).slice(0, 900); } },
      run: (MAXS) => {
        if (s.bot !== botRef) return { lost: true }; // (a new knight: the wrappers are on the old one)
        fresh(); noPassives(); st.pMul = Math.round(s.ownDamageMul() * 1000) / 1000; st.passivesOff = s.passives === NP;
        let t = performance.now(), steps = 0, lapAt = performance.now();
        const cap = MAXS * 60;
        const film = window.__film ? [] : null;
        while (steps < cap && (s.match.phase !== 'over' || steps < 30)) { // (a rematch: past the last match's result first)
          t += 1000 / 60;
          try { if (film && steps % 30 === 0 && film.length < 400) { g.step(t, 1000 / 60); film.push(g.canvas.toDataURL('image/jpeg', 0.6)); } else g.headlessStep(t, 1000 / 60); }
          catch (e) { st.errs = (st.errs ?? 0) + 1; if (!st.err) st.err = String(e?.stack ?? e).slice(0, 900); } // (a frame that throws: the browser's loop would go on to the next — so does this one; the first is kept)
          steps++;
          if (steps % 600 === 0) { const w = performance.now(); st.lap.push(Math.round(w - lapAt)); lapAt = w; } // (real ms per 10 game s)
        }
        if (film) window.__frames = film;
        const m = s.match;
        return { phase: m.phase, wins: [...m.wins], host: m.host, guest: m.guest, champ: m.champ, round: m.round, gameS: Math.round(steps / 60), brainCast, startedCast, local: s.localId, st: JSON.parse(JSON.stringify(st)) };
      },
    };
  }, { A });
  for (let n = done; n < N; n++) {
  if (n > done) { g0 = Date.now(); const e = await p.evaluate(() => window.__sim.rematch()); if (e) console.log('REMATCH ERROR', A, B, e); }
  let cdp = null; // PROF=<file>: a CPU profile of the battle (where the headless steps spend their time)
  if (process.env.PROF) { cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: Number(process.env.PROFUS ?? 20000) }); await cdp.send('Profiler.start'); }
  const r = await p.evaluate(({ MAXS }) => window.__sim.run(MAXS), { MAXS });
  if (r.lost) { console.log('the knight was replaced on a rematch', A, B); break; }
  if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(process.env.PROF, JSON.stringify(profile)); }
  // wins: [host, guest]; the host is the side running the match (this client: the player)
  if (process.env.FILM) { const fr = await p.evaluate(() => window.__frames ?? []); const { mkdirSync } = await import('fs'); const d = `${process.env.FILM}/${A}_${B}_${n}`; mkdirSync(d, { recursive: true }); fr.forEach((u, i) => writeFileSync(`${d}/f${String(i).padStart(4, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64'))); }
  const aWins = r.host === r.local ? r.wins[0] : r.wins[1], bWins = r.host === r.local ? r.wins[1] : r.wins[0];
  results.push({ A, B, aWins, bWins, champ: r.champ === r.local ? A : r.champ ? B : null, phase: r.phase, gameS: r.gameS, casts: [r.brainCast, r.startedCast], st: r.st, setupS: n === done ? setupS : 0 });
  writeFileSync(OUT, JSON.stringify(results));
  const S2 = r.st; console.log(`${A} (player) vs ${B} (bot) #${n}: ${aWins}-${bWins} ${r.phase} ${r.gameS}s casts ${r.brainCast}/${r.startedCast}+${S2.bCasts} hits ${S2.pHits}/${S2.bHits} dmg ${S2.pDmg}/${S2.bDmg} stuck ${Math.round(S2.pStuckS)}/${Math.round(S2.bStuckS)}s${S2.errs ? ` ERRORS ${S2.errs}` : ''}  [${n === done ? `setup ${setupS}s, ` : ''}${Math.round((Date.now() - g0) / 1000)}s real, total ${Math.round((Date.now() - t0) / 60000)}m]`);
  }
}
console.log('done, errors:', errs.slice(0, 3).join(' | ') || 'none');
await b.close();
