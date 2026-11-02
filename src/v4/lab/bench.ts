// The 50-character benchmark (the art director's performance gate), measured on the computer that runs the page: the
// game's own renderer (direct), the gameplay camera (B = 150 canvas px), the wardrobe preview off, every character on
// the lab's crowd behaviour (run, idle, jump, attack). Three configurations: 50 bare bodies; 50 fully equipped, each a
// different mix, with the sword, dagger and staff kits; the same 50 attacking about half the time while their items
// are swapped 20 times a second. Per frame: the time between rendered frames (p50 / p95 / p99), the lab's CPU work
// split into animation (pose and IK), placing the parts, and swaps; WebGL draw calls; the GPU's own time when the
// browser exposes a timer query; texture memory. With the computer's and the browser's own report.
import Phaser from 'phaser';
import type { LabScene } from './LabScene';
import type { WardrobeSlot } from '../wardrobe/types';

export interface BenchConfig {
  name: string; characters: number; frames: number; seconds: number; fps: number;
  frameP50: number; frameP95: number; frameP99: number; frameMax: number;
  /** Frames that took longer than one 60 Hz frame (16.7 ms) and than two (33.3 ms). */
  over16: number; over33: number;
  /** CPU ms per frame: the whole lab step, animation (pose and IK), placing the parts, swapping items. */
  updateMean: number; updateP95: number; poseMean: number; poseP95: number; layoutMean: number; layoutP95: number;
  swapsPerSec: number; swapMsEach: number;
  drawCallsMean: number; drawCallsMax: number;
  /** GPU ms per frame from a WebGL timer query (null when the browser does not expose one). */
  gpuMean: number | null; gpuP95: number | null;
  textureMiB: number;
  /** Distinct outfits on screen and how many characters hold each weapon kit. */
  outfits: number; kits: Record<string, number>;
}
export interface BenchEnv { [k: string]: string | number | boolean | null }
export interface BenchReport { env: BenchEnv; configs: BenchConfig[]; valid: boolean; note: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (s: number[], p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0);
const stats = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b), mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return { mean, p50: pct(s, 0.5), p95: pct(s, 0.95), p99: pct(s, 0.99), max: s.length ? s[s.length - 1] : 0 };
};

/** The display's refresh as the page sees it (requestAnimationFrame over one second). */
async function refreshHz(): Promise<number> {
  const t: number[] = [];
  await new Promise<void>((done) => {
    const f = (now: number) => { t.push(now); if (now - t[0] < 1000) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
    setTimeout(done, 2500);
  });
  const d = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b);
  return d.length ? 1000 / pct(d, 0.5) : 0;
}

async function environment(scene: LabScene): Promise<BenchEnv> {
  const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer, gl = r.gl;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] } };
  const canvas = scene.game.canvas, rect = canvas.getBoundingClientRect();
  return {
    gpu: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
    gpuVendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
    webgl: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1',
    antialias: gl.getContextAttributes()?.antialias ?? null,
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    cpuThreads: nav.hardwareConcurrency ?? null,
    memoryGB: nav.deviceMemory ?? null,
    platform: nav.userAgentData?.platform ?? nav.platform ?? '',
    browser: nav.userAgentData?.brands?.filter((b) => !/Not.?A.?Brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(', ') ?? '',
    userAgent: nav.userAgent,
    screen: `${screen.width}×${screen.height}`, devicePixelRatio: devicePixelRatio,
    canvas: `${canvas.width}×${canvas.height}`, canvasOnPage: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
    refreshHz: Math.round(await refreshHz()),
    visibility: document.visibilityState, focused: document.hasFocus(),
  };
}

/** GPU time per rendered frame through EXT_disjoint_timer_query(_webgl2), when the browser exposes it. */
function gpuTimer(scene: LabScene): { samples: number[]; stop: () => void } | null {
  const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer, gl = r.gl as WebGLRenderingContext;
  const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? (gl as unknown as WebGL2RenderingContext) : null;
  type Ext = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number; QUERY_RESULT_EXT?: number; QUERY_RESULT_AVAILABLE_EXT?: number;
    createQueryEXT?: () => unknown; beginQueryEXT?: (t: number, q: unknown) => void; endQueryEXT?: (t: number) => void; getQueryObjectEXT?: (q: unknown, p: number) => unknown; deleteQueryEXT?: (q: unknown) => void };
  const ext = (gl2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : gl.getExtension('EXT_disjoint_timer_query')) as Ext | null;
  if (!ext) return null;
  const samples: number[] = [], pending: unknown[] = [];
  let open: unknown = null;
  const create = () => (gl2 ? gl2.createQuery() : ext.createQueryEXT!());
  const begin = (q: unknown) => (gl2 ? gl2.beginQuery(ext.TIME_ELAPSED_EXT, q as WebGLQuery) : ext.beginQueryEXT!(ext.TIME_ELAPSED_EXT, q));
  const end = () => (gl2 ? gl2.endQuery(ext.TIME_ELAPSED_EXT) : ext.endQueryEXT!(ext.TIME_ELAPSED_EXT));
  const ready = (q: unknown) => (gl2 ? gl2.getQueryParameter(q as WebGLQuery, gl2.QUERY_RESULT_AVAILABLE) : ext.getQueryObjectEXT!(q, ext.QUERY_RESULT_AVAILABLE_EXT!)) as boolean;
  const result = (q: unknown) => Number(gl2 ? gl2.getQueryParameter(q as WebGLQuery, gl2.QUERY_RESULT) : ext.getQueryObjectEXT!(q, ext.QUERY_RESULT_EXT!));
  const drop = (q: unknown) => (gl2 ? gl2.deleteQuery(q as WebGLQuery) : ext.deleteQueryEXT!(q));
  const pre = () => { if (open) return; open = create(); begin(open); };
  const post = () => {
    if (open) { end(); pending.push(open); open = null; }
    while (pending.length && ready(pending[0])) {
      const q = pending.shift();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) samples.push(result(q) / 1e6);
      drop(q);
    }
  };
  scene.game.events.on(Phaser.Core.Events.PRE_RENDER, pre);
  scene.game.events.on(Phaser.Core.Events.POST_RENDER, post);
  return { samples, stop: () => { scene.game.events.off(Phaser.Core.Events.PRE_RENDER, pre); scene.game.events.off(Phaser.Core.Events.POST_RENDER, post); if (open) { end(); drop(open); open = null; } for (const q of pending) drop(q); pending.length = 0; } };
}

/** 50 distinct full outfits (every wearable slot the art has items for), the weapon kits taking turns. */
function outfits(scene: LabScene): Partial<Record<WardrobeSlot, string>>[] {
  const slots = scene.swapSlots().filter((s) => s !== 'hair' && s !== 'weapon');
  const weapons = scene.itemsFor('weapon');
  const lists = slots.map((s) => scene.itemsFor(s).map((i) => i.id));
  const combos: string[][] = [[]];
  for (const l of lists) { const next: string[][] = []; for (const c of combos) for (const id of l) next.push([...c, id]); combos.splice(0, combos.length, ...next); }
  // a fixed shuffle, so every run of the benchmark draws the same 50 outfits
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
  const out: Partial<Record<WardrobeSlot, string>>[] = [];
  for (let i = 0; i < 50; i++) {
    const eq: Partial<Record<WardrobeSlot, string>> = {};
    combos[i % combos.length].forEach((id, k) => { eq[slots[k]] = id; });
    if (weapons.length) eq.weapon = weapons[(i + Math.floor(i / combos.length)) % weapons.length].id;
    out.push(eq);
  }
  return out;
}

export async function bench(scene: LabScene, seconds = 6, progress: (m: string) => void = () => {}): Promise<BenchReport> {
  const prev = { mode: scene.renderMode, npcs: scene.npcs.length, preview: scene.previewOn, zoom: scene.zoomPreset, size: scene.sizeKey, forced: scene.forced, auto: scene.autoSwapMs, look: scene.player.input };
  progress('benchmark: reading this computer');
  const env = await environment(scene);
  scene.previewOn = false; scene.renderMode = 'direct'; scene.zoomPreset = 'grinding'; scene.sizeKey = '1.12'; scene.forced = null; scene.autoSwapMs = 0;
  scene.setStress(49); // + the player = 50 characters
  scene.applyView();
  scene.benchAll = true;
  const dress = (eqs: Partial<Record<WardrobeSlot, string>>[] | null) => scene.actors.forEach((a, i) => a.setLook({ ...a.input, gearLooks: {}, cosmetics: { equipped: eqs ? { ...eqs[i % eqs.length] } : {}, hidden: [] } }));
  const looks = outfits(scene);
  const configs: [string, Partial<Record<WardrobeSlot, string>>[] | null, number, number][] = [
    ['50 bare bodies', null, 0.23, 0],
    ['50 fully equipped, 50 different outfits', looks, 0.23, 0],
    ['50 equipped, attacking about half the time, 20 item swaps a second', looks, 0.5, 20],
  ];
  const results: BenchConfig[] = [];
  const timer = gpuTimer(scene);
  let swaps = 0;
  for (const [name, eqs, attack, swapRate] of configs) {
    progress(`benchmark: ${name}`);
    dress(eqs);
    scene.attackShare = attack;
    let acc = 0;
    scene.benchSwap = swapRate > 0 ? (dt) => {
      acc += dt * swapRate;
      while (acc >= 1) {
        acc -= 1; swaps++;
        const all = scene.actors, a = all[Math.floor(Math.random() * all.length)];
        const slots = (['top', 'bottom', 'shoes', 'head', 'weapon'] as WardrobeSlot[]).filter((s) => scene.itemsFor(s).length > 1);
        const slot = slots[Math.floor(Math.random() * slots.length)], cur = a.input.cosmetics.equipped[slot];
        const opts = scene.itemsFor(slot).filter((i) => i.id !== cur);
        scene.equip(slot, opts[Math.floor(Math.random() * opts.length)].id, a);
      }
    } : null;
    await wait(1500);
    for (const v of [scene.frameTimes, scene.updateTimes, scene.drawSamples, scene.poseTimes, scene.layoutTimes, scene.swapTimes]) v.length = 0;
    if (timer) timer.samples.length = 0;
    swaps = 0;
    const t0 = performance.now();
    await wait(seconds * 1000);
    const dt = (performance.now() - t0) / 1000;
    const f = stats(scene.frameTimes), u = stats(scene.updateTimes), p = stats(scene.poseTimes), l = stats(scene.layoutTimes), d = stats(scene.drawSamples), sw = stats(scene.swapTimes);
    const g = timer && timer.samples.length ? stats(timer.samples) : null;
    const tex = scene.textures.get(scene.assets.atlas256.key).source[0];
    const kits: Record<string, number> = {};
    for (const a of scene.actors) { const k = a.avatar.items.weapon?.motion ?? (a.avatar.unarmed ? 'none' : 'sword_1h'); kits[k] = (kits[k] ?? 0) + 1; }
    results.push({
      name, characters: scene.actors.length, frames: scene.frameTimes.length, seconds: dt, fps: scene.frameTimes.length / dt,
      frameP50: f.p50, frameP95: f.p95, frameP99: f.p99, frameMax: f.max,
      over16: scene.frameTimes.filter((x) => x > 1000 / 60 + 1).length, over33: scene.frameTimes.filter((x) => x > 2000 / 60 + 1).length,
      updateMean: u.mean, updateP95: u.p95, poseMean: p.mean, poseP95: p.p95, layoutMean: l.mean, layoutP95: l.p95,
      swapsPerSec: swaps / dt, swapMsEach: swaps ? (sw.mean * scene.swapTimes.length) / swaps : 0,
      drawCallsMean: d.mean, drawCallsMax: d.max, gpuMean: g ? g.mean : null, gpuP95: g ? g.p95 : null,
      textureMiB: (tex.width * tex.height * 4) / 2 ** 20,
      outfits: new Set(scene.actors.map((a) => JSON.stringify(a.input.cosmetics.equipped))).size, kits,
    });
  }
  timer?.stop();
  scene.benchSwap = null; scene.benchAll = false; scene.attackShare = 0.23;
  scene.renderMode = prev.mode; scene.previewOn = prev.preview; scene.zoomPreset = prev.zoom; scene.sizeKey = prev.size; scene.forced = prev.forced; scene.autoSwapMs = prev.auto;
  scene.player.setLook(prev.look);
  scene.setStress(prev.npcs);
  scene.applyView();
  const valid = env.visibility === 'visible' && Number(env.refreshHz) >= 30;
  const note = valid ? `Measured on this computer: ${env.gpu}; ${env.cpuThreads} CPU threads; display ${env.refreshHz} Hz.`
    : `Not a valid measurement: the page was ${env.visibility === 'visible' ? `drawn at only ${env.refreshHz} frames a second` : 'hidden'} (browsers slow down pages that are not on screen). Run it with the page visible.`;
  progress('benchmark done');
  return { env, configs: results, valid, note };
}
