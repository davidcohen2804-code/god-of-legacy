// The effects' budget (GPT's combat-art rulebook, DFO stage 1 — David 4 Nov 05:45): the fighters always read through
// the skills' pictures. Before each frame is drawn:
//  - an effect drawn over a fighter that hides him is put behind him when it is a big mass (a burst, a cloud, a column),
//    or thinned when it is a dense line in front (a trail, a beam) — the attacker, the target and the blow stay readable;
//  - the near-white light added over the picture is held to a ceiling (no white-out from piled-up flashes);
//  - a light has one peak, then a fast decay: one still fading a while after its peak goes out faster (no long bright
//    tails after the blow); one that settles and holds keeps its level;
//  - what stays standing in the fight (a zone, a planted trap, a summon) lies behind a fighter it would cover.
//  A fighter's own weapon light (holdFx) and what sits on his body (ON_BODY) are him: never touched.
// Presentation only: what it changes is put back right after the frame is drawn, so no effect's own code (its tweens,
// its depth) ever sees it. The same in the world and in the arena (PVP 3D draws the same painted objects).
import Phaser from 'phaser';
import { ActorView } from '../game/ActorView';
import { ON_BODY } from '../arena3d/flag';

/** A frame's look, sampled once: mean alpha, mean light (luminance × alpha), the near-white share, and the box (0..1
 *  of the frame) where it is drawn at all. */
interface Stat { a: number; l: number; w: number; x0: number; y0: number; x1: number; y1: number }
const N = 32;
const stats = new Map<string, Stat | null>();
let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;

function frameStat(o: Phaser.GameObjects.Image): Stat | null {
  const f = o.frame, tex = o.texture; if (!f || !tex) return null;
  const k = `${tex.key}\u0001${f.name}`;
  if (stats.has(k)) return stats.get(k)!;
  let s: Stat | null = null;
  try {
    const img = f.source.image as CanvasImageSource | undefined;
    if (img && typeof document !== 'undefined') {
      if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; cx = cv.getContext('2d', { willReadFrequently: true }); }
      const g = cx!; g.clearRect(0, 0, N, N);
      g.drawImage(img, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      let sa = 0, sl = 0, sw = 0, x0 = N, y0 = N, x1 = -1, y1 = -1;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4, al = d[i + 3] / 255;
        if (al <= 0.02) continue;
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        sa += al; sl += al * lum; if (al > 0.5 && lum > 0.85) sw++;
        if (al * Math.max(lum, 0.35) > 0.1) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      }
      const T = N * N;
      // a trimmed frame (an atlas): the cut sits at (f.x, f.y) inside the frame's real size
      const rw = f.realWidth || f.cutWidth, rh = f.realHeight || f.cutHeight, ox = f.trimmed ? f.x : 0, oy = f.trimmed ? f.y : 0;
      const u = (px: number) => (ox + (px / N) * f.cutWidth) / rw, v = (py: number) => (oy + (py / N) * f.cutHeight) / rh;
      s = x1 < 0 ? { a: 0, l: 0, w: 0, x0: 0, y0: 0, x1: 0, y1: 0 } : { a: sa / T, l: sl / T, w: sw / T, x0: u(x0), y0: v(y0), x1: u(x1 + 1), y1: v(y1 + 1) };
    }
  } catch { s = null; }
  stats.set(k, s);
  return s;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const M = new Phaser.GameObjects.Components.TransformMatrix(), P = new Phaser.Math.Vector2();
/** Where a picture really draws (its content box through its whole transform, containers too), world px. */
function contentBox(o: Phaser.GameObjects.Image, s: Stat): Box {
  const f = o.frame, rw = f.realWidth, rh = f.realHeight;
  o.getWorldTransformMatrix(M);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [u, v] of [[s.x0, s.y0], [s.x1, s.y0], [s.x0, s.y1], [s.x1, s.y1]]) {
    const uu = o.flipX ? 1 - u : u, vv = o.flipY ? 1 - v : v;
    M.transformPoint((uu - o.originX) * rw, (vv - o.originY) * rh, P);
    if (P.x < x0) x0 = P.x; if (P.x > x1) x1 = P.x; if (P.y < y0) y0 = P.y; if (P.y > y1) y1 = P.y;
  }
  return { x0, y0, x1, y1 };
}
const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The skills' own pictures — every sheet the effects load (recorded as `preloadSkillFx` asks for them: a build names
 *  its files by their hash, so the path cannot tell) and the ones they draw themselves; everything else — bodies, gear,
 *  the world, the HUD, the damage numbers — is never touched. */
const FX_SET = new Set<string>();
/** A texture key the effects load (called for each, as they are asked for). The damage digits and the telegraphs stay out. */
export function markFxKey(key: string): void { if (!/^(dmg-[nc]$|tg-)/.test(key)) FX_SET.add(key); }
/** A picture that is part of a fighter — his weapon's own light in his hand (the Gambler's lit cane): it is him, never
 *  moved behind him nor thinned. */
const HELD = new WeakSet<object>();
export function holdFx<T extends object>(o: T): T { HELD.add(o); return o; }
const FX_KEYS = new Map<string, boolean>();
const FX_URL = /\/(skills|impact|fx3d)\/|damage_glow/;
const FX_GEN = /^(light-beam|gb-|mage-|mg-|mfx-|sam-|arch-|afx-|pas-|vfx-|proj-|imp-|jb-|bs-|titan-|holy-|cry-|storm-|sanctuary-|court-|banner-|phantom-|w-spikes|magic-circle|dmg-glow)/;
function isFx(o: Phaser.GameObjects.Image): boolean {
  const t = o.texture; if (!t) return false;
  let v = FX_KEYS.get(t.key);
  if (v === undefined) {
    const img = t.source[0]?.image as { src?: string } | undefined, base = t.key.split('@')[0];
    v = FX_SET.has(t.key) || FX_SET.has(base) || FX_GEN.test(t.key) || (typeof img?.src === 'string' && FX_URL.test(img.src));
    FX_KEYS.set(t.key, v);
  }
  return v;
}
const lum = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

/** The rulebook's numbers (GPT's coverage budgets, read on the game's own frames). */
export const FX_BUDGET = {
  /** Share of a fighter's drawn box an effect in front of him may cover (density × overlap) before it is moved / thinned. */
  hide: 0.3,
  /** An effect is a "mass" (put behind the fighter, not thinned) when its box is at least this share of his ... */
  massArea: 0.45,
  /** ... and it is at least this dense inside its box. */
  massDensity: 0.2,
  /** A thinned effect keeps at least this share of its opacity. */
  minAlpha: 0.35,
  /** Near-white added light allowed over the whole picture (share of the screen; the ultimate tier's 2%). */
  white: 0.022,
  /** One peak, then a fast decay: a light that is still fading this long (ms, the effects' own time — a hit-stop holds
   *  it) after it fell from its peak ... */
  tail: 240,
  /** ... goes out faster from then on (its light × e^(−t / decay)); one that settles and holds stays at that level. */
  decay: 150,
  /** A picture alive this long (ms) is the fight's furniture — a zone, a planted trap, a summon left standing ... */
  persist: 1500,
  /** ... and may cover only this share of a fighter: past it, it lies behind him (it still reads round him). */
  idle: 0.15,
};

export interface FxReading {
  /** Per fighter: the share of him hidden by effects drawn over him (before the budget), and after. */
  hidden: { id: number; cls: string; x: number; before: number; after: number }[];
  /** Near-white added light on the picture (share of the screen), before / after. */
  white: [number, number];
  /** Effect pictures drawn this frame (over the floor layer). */
  live: number;
  moved: number; thinned: number;
  /** Lights whose tail was cut short this frame (one peak, then a fast decay). */
  trimmed: number;
}

/** A picture's light through its life, on the effects' own clock: when it was born, its peak, when it started to fall,
 *  and the share of its light it still shows (the fast decay). */
interface Life { born: number; seen: number; peak: number; last: number; fallAt: number; hold: number; k: number }

export class FxGovernor {
  /** false: read only (the meter), nothing changed. A link with ?nofxgov draws the effects as they were (tests). */
  on = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofxgov'));
  last: FxReading | null = null;
  private saved: [Phaser.GameObjects.Image, number, number][] = [];
  /** The effects' own time (ms): it stands still through a hit-stop, as the effects do. */
  private clock = 0;
  private lives = new WeakMap<object, Life>();

  /** The effects' step (0 in a hit-stop): called by SkillFx each update. */
  tick(ms: number): void { this.clock += ms; }

  /** One peak, then a fast decay (the rulebook's aftermath): a light still fading `tail` ms after it fell from its
   *  peak goes out faster; rising again (a pulse, a new tick) gives it back; one that settles and holds keeps its
   *  level. Returns the share of its light to show now (1: as it is). */
  private life(o: Phaser.GameObjects.Image, light: boolean): Life {
    const now = this.clock, a = o.alpha;
    let L = this.lives.get(o);
    if (!L || now - L.seen > 120 || L.last < 0.03 || a - L.last > 0.25) { // (new, or lit again: a picture used once more)
      const born = L && now - L.seen <= 120 && L.last >= 0.03 ? L.born : now;
      L = { born, seen: now, peak: a, last: a, fallAt: -1, hold: 0, k: 1 }; this.lives.set(o, L);
      return L;
    }
    const dt = now - L.seen, d = a - L.last;
    L.seen = now; L.last = a;
    if (!light) return L;
    if (d > 0.004) { L.fallAt = -1; L.hold = 0; if (a > L.peak) L.peak = a; L.k = Math.min(1, L.k + 0.06); }
    else if (d < -0.002) {
      L.hold = 0;
      if (L.fallAt < 0 && a < L.peak * 0.85) L.fallAt = now;
      if (L.fallAt >= 0 && now - L.fallAt > FX_BUDGET.tail) L.k = Math.min(L.k, Math.exp(-(now - L.fallAt - FX_BUDGET.tail) / FX_BUDGET.decay));
    } else if ((L.hold += dt) > 100) L.fallAt = -1; // (settled: its level held, the decay so far kept)
    return L;
  }

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.preRender, this);
    scene.events.on(Phaser.Scenes.Events.RENDER, this.restore, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  destroy(): void {
    this.restore();
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.preRender, this);
    this.scene.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
  }

  /** Always the last step before the frame is drawn: the 3D arena (built later, when a fight opens) places the objects
   *  where the picture shows them first — a depth changed before it would move an effect's floor point. Not last: moved
   *  to the end (from the next frame), this frame left as it is. */
  private preRender(): void {
    const ev = this.scene.events, E = Phaser.Scenes.Events.PRE_RENDER, ls = ev.listeners(E);
    if (ls[ls.length - 1] !== this.preRender) { ev.off(E, this.preRender, this); ev.on(E, this.preRender, this); return; }
    this.govern();
  }

  private restore(): void {
    if (!this.saved.length) return;
    for (const [o, a, d] of this.saved) if (o.active) { o.alpha = a; if (o.depth !== d) o.setDepth(d); }
    this.saved.length = 0;
  }

  private keep(o: Phaser.GameObjects.Image): void { if (!this.saved.some((e) => e[0] === o)) this.saved.push([o, o.alpha, o.depth]); }

  /** The meter: the reading of the frame as it stands now (apply: as the budget would draw it); nothing is left changed. */
  measure(apply = false): FxReading { const on = this.on; this.on = apply; const r = this.govern(); this.restore(); this.on = on; return r; }

  /** Read (and, when on, apply) the budget for the frame about to be drawn. Called by the scene's pre-render. */
  govern(): FxReading {
    const sc = this.scene, cam = sc.cameras.main;
    const fighters: { id: number; cls: string; x: number; depth: number; box: Box; a: number }[] = [];
    let id = 0;
    for (const v of ActorView.live) {
      const b = v.sprite; id++;
      if (b.scene !== sc || !b.active || !b.visible || b.alpha < 0.2) continue;
      const s = frameStat(b); if (!s || s.a <= 0) continue;
      const box = contentBox(b, s), A = area(box); if (A < 200) continue;
      fighters.push({ id, cls: v.cls, x: Math.round(b.x), depth: b.depth, box, a: A });
    }
    // the effects drawn this frame (over the floor layer: the floor marks lie under everyone anyway)
    type E = { o: Phaser.GameObjects.Image; box: Box; dens: number; add: boolean; s: Stat; old: boolean };
    const fx: E[] = [];
    let whiteBefore = 0, trimmed = 0;
    const scr = cam.width * cam.height, B = FX_BUDGET;
    for (const ch of sc.children.list) {
      if (!(ch instanceof Phaser.GameObjects.Image || ch instanceof Phaser.GameObjects.Sprite)) continue;
      const o = ch as Phaser.GameObjects.Image;
      if (!o.visible || o.alpha <= 0.01 || o.depth <= 12 || o.scrollFactorX === 0 || !isFx(o) || ON_BODY.has(o) || HELD.has(o)) continue;
      const s = frameStat(o); if (!s || (s.a <= 0 && s.l <= 0)) continue;
      const add = o.blendMode === Phaser.BlendModes.ADD || o.blendMode === Phaser.BlendModes.SCREEN;
      const tl = add ? Math.max(lum(o.tintTopLeft), lum(o.tintBottomRight)) : 1;
      const box = contentBox(o, s), bf = Math.max(1e-3, (s.x1 - s.x0) * (s.y1 - s.y0));
      const dens = Math.min(1, (add ? s.l * tl * 1.25 : s.a) / bf);
      if (add) whiteBefore += s.w / bf * tl * o.alpha * area(box);
      // its light's tail: one peak, then a fast decay (the rulebook's aftermath)
      const L = this.life(o, add);
      if (this.on && L.k < 0.995) { this.keep(o); o.alpha *= L.k; trimmed++; if (o.alpha <= 0.01) continue; }
      fx.push({ o, box, dens, add, s, old: this.clock - L.born > B.persist });
    }
    const reading: FxReading = { hidden: [], white: [whiteBefore / scr, whiteBefore / scr], live: fx.length, moved: 0, thinned: 0, trimmed };
    if (!fx.length) { this.last = reading; return reading; }
    let moved = false;
    // the nearest fighter first (his effects put behind him may still lie over one further back: handled after him)
    fighters.sort((p, q) => q.depth - p.depth);
    for (const f of fighters) {
      const over = (e: E) => e.o.depth > f.depth ? e.dens * e.o.alpha * inter(e.box, f.box) / f.a : 0;
      let hidden = 0; for (const e of fx) hidden += over(e);
      const row = { id: f.id, cls: f.cls, x: f.x, before: hidden, after: hidden }; reading.hidden.push(row);
      if (!this.on) continue;
      // the fight's furniture over him (a zone, a planted trap, a summon left standing): past its share it lies behind him
      const old = fx.filter((e) => e.old && over(e) > 0.004).sort((p, q) => over(q) - over(p));
      let lying = 0; for (const e of old) lying += over(e);
      for (const e of old) {
        if (lying <= B.idle) break;
        const c = over(e); this.keep(e.o); e.o.depth = f.depth - 0.4; moved = true; reading.moved++; lying -= c; hidden -= c;
      }
      if (hidden <= B.hide) { row.after = hidden; continue; }
      const by = fx.filter((e) => over(e) > 0.004).sort((p, q) => over(q) - over(p));
      for (const e of by) { // the big masses go behind him
        if (hidden <= B.hide) break;
        if (area(e.box) < B.massArea * f.a || e.dens < B.massDensity) continue;
        const c = over(e); this.keep(e.o); e.o.depth = f.depth - 0.4; moved = true; reading.moved++; hidden -= c;
      }
      if (hidden > B.hide) { // what is still in front over him is thinned
        const rest = by.filter((e) => e.o.depth > f.depth);
        const k = Math.max(B.minAlpha, B.hide / hidden);
        for (const e of rest) { this.keep(e.o); e.o.alpha *= k; reading.thinned++; }
        hidden = 0; for (const e of fx) hidden += over(e);
      }
      row.after = hidden;
    }
    // the white added over the picture: held to its ceiling
    let white = 0; for (const e of fx) if (e.add) { const bf = Math.max(1e-3, (e.s.x1 - e.s.x0) * (e.s.y1 - e.s.y0)); white += e.s.w / bf * Math.max(lum(e.o.tintTopLeft), lum(e.o.tintBottomRight)) * e.o.alpha * area(e.box); }
    white /= scr;
    if (this.on && white > B.white) {
      const k = Math.max(B.minAlpha, B.white / white);
      for (const e of fx) if (e.add && e.s.w > 0) { this.keep(e.o); e.o.alpha *= k; }
      white *= k;
    }
    reading.white[1] = white;
    if (moved) { const dl = sc.sys.displayList; dl.queueDepthSort(); dl.depthSort(); }
    this.last = reading;
    return reading;
  }
}
