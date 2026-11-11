// GPT's P4B (David's PC): &autolow's starting level on the real GPU — the keys set for the case first (Auto: no choice and
// nothing remembered; or a manual choice), the level read the moment the 3D world exists, then its frame rate for 6 s.
// Loaded after bench3.js (save backup and restore, the phase timer). The page is reloaded after.
(() => {
  const W = window, G = W.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), S = () => G.scene.getScene('LegacyCourtyardScene');
  W.__alRun = async (o = {}) => {
    const out = (W.__alOut = { state: 'start', q: location.search, case: o.case || 'cold' });
    try {
      G.sound.mute = true;
      for (const k of ['gol-a3d-quality', 'gol-a3d-lean-level']) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(o.ls || {})) localStorage.setItem(k, v);
      out.info = W.__info();
      const until = async (f, ms = 120000) => { const e = performance.now() + ms; while (!f()) { if (performance.now() > e) throw new Error('timeout ' + out.state); await wait(50); } };
      await until(() => G.scene.isActive('MainMenuScene')); await wait(800); await W.__tap('Enter');
      await until(() => G.scene.isActive('CharacterSelectScene') && G.scene.getScene('CharacterSelectScene').textures.exists('spirit-portrait')); await wait(2000);
      await W.__tap('Enter');
      await until(() => { const s = S(); return s && s.sys.isActive() && s.a3d; }); out.start = W.__a3(); out.state = 'world';
      await until(() => { const s = S(); return s.hero3d && s.spiritForm; }); await wait(o.settle ?? 5000);
      out.idle = await W.__phase(o.ms ?? 6000); out.after = W.__a3(); out.remembered = localStorage.getItem('gol-a3d-lean-level');
      out.state = 'done';
    } catch (e) { out.err = String((e && e.message) || e); out.state = 'error'; }
    finally { try { G.loop.sleep(); } catch (e) { /* (reloaded next) */ } try { out.restored = W.__restore(); out.keys = Object.keys(localStorage).length; } catch (e) { out.restoreErr = String(e); } }
  };
  return { ok: true };
})()
