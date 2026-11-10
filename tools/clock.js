// GPT's P4A (diagnosis only, David's PC): the game's clock against real time, Phaser's step smoothing on (today) and
// off (an isolated diagnostic, switched on the running loop — no code change), at each preset's frame rate: focused
// idle / running / attacking, the window unfocused, focus regained, and a 5 s pause (the loop paused and resumed, as a
// hidden tab). Loaded after bench3.js. The page is reloaded after.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  const seg = async (s, ms, during) => {
    const L = G.loop, sim0 = s.simMs, w0 = performance.now(); let n = 0; const stop = during ? during() : null;
    while (performance.now() - w0 < ms) { await new Promise((r) => requestAnimationFrame(r)); n++; }
    if (stop) await stop();
    const wall = performance.now() - w0;
    return { ratio: +((s.simMs - sim0) / wall).toFixed(2), fps: +(n / (wall / 1000)).toFixed(1), focus: L.inFocus };
  };
  W.__clockRun = async (o = {}) => {
    const out = (W.__clockOut = { state: 'start', q: location.search });
    try {
      G.sound.mute = true; localStorage.setItem('gol-a3d-quality', '0');
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(100); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene')); await wait(2500); await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.hero3d && s.a3d; }); out.state = 'world'; await wait(6000);
      const s = S(), L = G.loop; out.smooth0 = L.smoothStep;
      for (const lv of o.levels ?? [0, 1, 2]) {
        if (s.a3d.qualityLevel !== lv) { await W.__switch(lv); await wait(1500); }
        for (const smooth of [true, false]) {
          L.smoothStep = smooth; await wait(500);
          const r = (out[`lv${lv}_${smooth ? 'smooth' : 'raw'}`] = {});
          r.idle = await seg(s, 3000); r.run = await seg(s, 3000, W.__run); r.hits = await seg(s, 3000, W.__hits);
          window.dispatchEvent(new Event('blur')); await wait(100);
          r.unfocused = await seg(s, 3000, W.__run);
          window.dispatchEvent(new Event('focus'));
          r.focus0to2s = await seg(s, 2000, W.__run); r.focus2to5s = await seg(s, 3000, W.__run);
          // a 5 s pause (the loop paused, as when the tab is hidden), then the first second back
          const simP = s.simMs; L.pause(); await wait(5000); L.resume(); await new Promise((q) => requestAnimationFrame(q)); await new Promise((q) => requestAnimationFrame(q));
          r.pauseJumpMs = Math.round(s.simMs - simP);
          r.after0to2s = await seg(s, 2000, W.__run); r.after2to5s = await seg(s, 3000, W.__run);
        }
      }
      L.smoothStep = out.smooth0; out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
