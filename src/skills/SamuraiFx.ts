// Samurai skill effects, built from separate painted pieces (tools/skills/kit.py → one atlas, KIT) and moved in code: a cut
// grows along its arc and thins out, a burst pops, a sigil turns on the floor, the dragon's body bends along its path —
// so every effect flows at the frame rate instead of flipping between drawn frames. Presentation only (gameplay never
// reads any of this); the timing comes from the cast (startup / active / each hit as it fires), so every client draws the
// same, and the effect clock stops with the hit-stop like the fight does.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import { hitIndex, lastOfBurst } from './FinalKit';
import type { Projectile, V3 } from './HitGeometry';
import type { Fx3D } from '../arena3d/Fx3D';
import { POLE } from './SamuraiPole';
import { ring as ring3, inkBurst as inkBurst3, zoneRing, petalStream, petalBurst as petalBurst3, cocoon, SAM as SAM3 } from '../arena3d/fx3d/blade3d';
import { waveBack } from '../arena3d/fx3d/samurai';

export const KIT = 'sam-kit';
export const KIT_URL = 'assets/final/skills/samurai/kit/';
const TOP = 100000, GROUND = 2, SQUASH = 0.42, CRIMSON = 0xff3a4c, DUST = 0xd2a57a;
/** The crack piece runs diagonally on its sheet; this turns it level. */
const CRACK_TILT = -57;
/** Hit marks a size down for the skills whose blows come thick and fast (they hid the foe in PVP 3D); the blow that lifts
 *  the foe in the basic opens in crimson. Sprays: their size and the skills whose spray is crimson (the Iai's opening). */
const MARK_SCALE: Record<string, number> = { quick_slash: 0.8, hundred_cuts: 0.8, tornado_blade: 0.8, mirage: 0.8, swallow_cut: 0.62, dragon_ascension: 0.7, sword_wave: 0.72 };
const SPRAY_SCALE: Record<string, number> = { quick_slash: 0.7, iai_strike: 0.75, tornado_blade: 0.75, mirage: 0.7, swallow_cut: 0.75, sword_wave: 0.75 };
const SPRAY_CRIMSON = new Set(['quick_slash', 'iai_strike']);
/** The slash-hit pieces run this many degrees down to the right on their sheet (s11). */
const SLASH_TILT = 43;
/** A trail of the blade (blade_trail) / a flipped piece: angle that points it along `ang` (deg on screen). */
const along = (ang: number, left: boolean) => (left ? ang - 180 : ang);
/** Hits whose cut "arrives late": a thin line stays on the foe and splits open a beat after (the Iai's signature, and the
 *  ultimate's great cut). */
const DELAYED = new Set(['iai_strike', 'dragon_eclipse']);
/** PVP 3D: the skills rebuilt to David's bar in the room's own 3D (fx3d/samurai.ts + blade3d.ts) — their flat painted cuts
 *  and marks stay out there (the painted ones stay for the painted world). */
const IN3D_OWN = new Set(['quick_slash', 'iai_strike', 'phantom_blades', 'dragon_eclipse', 'tornado_blade', 'shadow_step', 'god_of_blades', 'swallow_cut', 'blossom_storm', 'sword_wave']);
/** Skills whose pieces show a state that outlasts the next press (a zone on the floor, a stance, a shield, the halo, the
 *  doubles): never cut short by his next skill. */
const KEEP = new Set(['sakura_bind', 'mirage', 'rising_sun', 'god_of_blades', 'kagemusha']);
/** The class's tones (tools/skills/kit_tones.py: `<piece>@<tone>`; no tone: the crimson originals). Every skill carries its
 *  own: steel (the bare blade), gold, sakura, rose, fire, blood (dark ink-red) — and crimson. */
type Tone = 'steel' | 'gold' | 'sakura' | 'rose' | 'fire' | 'blood';
/** Each skill's signature colour (its cuts, sparks and hit marks): no two skills of the class look alike. */
const SKILL_TONE: Record<string, Tone | undefined> = {
  quick_slash: 'steel', shadow_step: 'blood', sheathe: 'gold', iai_strike: 'steel', sword_wave: 'gold', mirage: 'rose', blossom_storm: 'sakura',
  dragon_eclipse: undefined, swallow_cut: undefined, hundred_cuts: 'steel', kagemusha: undefined, tornado_blade: 'steel', falcon_dive: 'fire',
  rising_sun: 'gold', phantom_blades: undefined, god_of_blades: 'gold', sakura_bind: 'sakura', dragon_ascension: 'gold',
};
/** A piece in a tone (the crimson original when no tone). */
const tn = (name: string, tone?: Tone) => (tone ? `${name}@${tone}` : name);
/** Light colours of the tones (tints of white light, ribbons, silhouettes' rims). */
const TONE_RGB: Record<Tone | 'crimson', [number, number, number]> = {
  crimson: [255, 48, 72], steel: [214, 228, 255], gold: [255, 196, 72], sakura: [255, 150, 196], rose: [255, 92, 176], fire: [255, 120, 36], blood: [150, 10, 24],
};
const toneHex = (t: Tone | 'crimson') => { const [r, g, b] = TONE_RGB[t]; return (r << 16) | (g << 8) | b; };
/** God of Blades: a katana of the halo (drawn length) and the halo itself (drawn width). */
const KATANA = 150, HALO = 190;
/** God of Blades' party mark over a member's head (drawn width). */
const MARK_W = 46;
/** Rising Sun's banner (David 18 Oct 01:15: "leave it on the map"): it stays planted where it rose this long after the sun
 *  bursts; his jump onto it springs him far back (DFO's engine: the pole a support, the spring — `poleSpring` draws it). Its
 *  foot: 44 px behind where he stood at the cast. */
const POLE_MS = POLE.ms, POLE_BACK = POLE.behind; // (the engine's numbers: src/skills/SamuraiPole.ts)
/** Rising Sun's buff (its light stays on him this long). */
const SUN_MS = 90000;

/** What the samurai effects need from the scene's effect layer. */
export interface SamCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  hand(id: string): { x: number; y: number } | null;
  callout(at: V3, text: string, color: string, row?: number): void;
  punch(amount?: number, ms?: number): void;
  darken(ms: number, alpha: number): void;
  ultimateStage(r: CastRun): void;
  /** Where a caster's shadow doubles stand (Kagemusha): they swing with him. */
  ghosts?(id: string): { k: number; x: number; y: number; z: number }[];
  /** Where a fighter or monster is now (a locked-on target of a cast). */
  targetPos?(id: string): (V3 & { h?: number }) | null;
  /** A beat of hit-stop (the late cut opening, the full draw). */
  freeze?(ms: number): void;
  /** His body as drawn this moment (texture, frame, facing, origin, scale, how much of him shows): phantoms of him are made of
   *  it, and what he carries (the halo, the sun's light) shows as much as he does (gone when he vanishes or hides). */
  body?(id: string): { key: string; frame: string | number; flipX: boolean; ox: number; oy: number; sx: number; sy: number; a?: number; face?: number } | null;
  /** Whether a fighter is alive (a buff's picture goes when he falls). */
  alive?(id: string): boolean;
  /** A soft flash of light over the screen (added, fading out): never a white-out that hides the fighters. */
  flash?(color: number, alpha: number, ms: number): void;
}

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out: Ease = (u) => 1 - (1 - u) * (1 - u), out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
const back: Ease = (u) => { const c = 1.7, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
type Key = [number, number, Ease?];
/** A curve through keys [u, value, easing into the key] (u = 0..1 over the piece's life). */
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);
/** On-screen angle (deg) of a direction along the floor (depth is foreshortened). */
const screenAng = (dx: number, dy: number) => Math.atan2(dy * 0.5, dx) * (180 / Math.PI);
type Pt = { x: number; y: number; d: number };

/** One piece and its motion. Positions are screen positions; `follow` (a moving point and its depth base) replaces x / y
 *  and makes `dz` the depth above that base. */
interface Spr {
  name: string; x?: number; y?: number; depth?: number; w: number; h?: number;
  delay?: number; life: number;
  ox?: number; oy?: number; angle?: number; flipX?: boolean; flipY?: boolean;
  add?: boolean; glow?: number; tint?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number;
  follow?: () => Pt | null; dz?: number;
  /** keep only the part of the frame below this fraction of its height (a ring's near half, drawn over the actor) */
  crop?: number;
  /** turns the piece over (flipX) every this many ms: a spinning shimmer */
  flick?: number;
  /** not drawn if this cast is broken off before the piece appears */
  run?: CastRun;
  /** never cut short by his next skill (it shows a state: a zone, a hold) */
  keep?: boolean;
  /** its state ended (true): it fades out at once, as a piece cut short */
  stop?: () => boolean;
}
interface Live { t: number; step(dt: number, t: number): boolean }
/** God of Blades' halo: the katanas (each with its glow), the halo (its glow), which katanas are out striking, when each came back. */
interface Halo { run: CastRun; imgs: Phaser.GameObjects.Image[]; gls: Phaser.GameObjects.Image[]; halo: Phaser.GameObjects.Image; hg: Phaser.GameObjects.Image; t: number; until: number;
  lastX: number; face: number; next: number; away: Set<number>; spent: Set<number> }
/** The order the halo's katanas fly in (from the ends of the fan inward: it stays even as it empties). */
const BLADE_ORDER = [0, 7, 1, 6, 2, 5, 3, 4];
/** Rising Sun's light on a fighter through the buff. */
interface Sun { t: number; ims: Phaser.GameObjects.Image[]; next: number }
interface Wave { im: Phaser.GameObjects.Image; gl: Phaser.GameObjects.Image; t: number; trail: number; ghosts: { im: Phaser.GameObjects.Image; dx: number; dy: number }[] }

export class SamuraiFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  private halos = new Map<string, Halo>();
  /** God of Blades shared with party members: the mark over each one's head. */
  private marks = new Map<string, { t: number; until: number; ims: Phaser.GameObjects.Image[] }>();
  /** The fallen petals lying in the painted arena / the world (SamuraiPetals' drifts; PVP 3D lays real ones: the card piece). */
  private drifts = new Map<string, { ims: Phaser.GameObjects.Image[]; pts: { x: number; y: number; k: number }[]; from: { x: number; y: number }; t: number; mode: 'fall' | 'lie' | 'wind' | 'gather'; t0: number; to?: string; ang: number[]; w: number[] }>();
  /** A samurai's scabbard holding gathered petals (until his blossom draw, or they scatter). */
  private scabs = new Map<string, { n: number; t: number; until: number; drawing: boolean; glow: Phaser.GameObjects.Image; ims: Phaser.GameObjects.Image[] }>();
  private suns = new Map<string, Sun>();
  /** Rising Sun's planted banners (one per samurai): where, and the spring it is giving (`spring`: when, `dir` the way). */
  private poles = new Map<string, { t: number; spring: number; dir: number; x: number; y: number; h: number; kill: () => void }>();
  /** Sakura Bind's rings on the floor (by caster): where, how wide, until when (its trap) — a catch's cocoon is placed by it,
   *  and the ring flares (`flare`: when). */
  private binds = new Map<string, { x: number; y: number; R: number; until: number; flare: number }>();
  private waves = new Map<Projectile, Wave>();
  /** Mirage stances by cast: where the samurai stood (the mirage the blow strikes). */
  private stances = new Map<string, { x: number; y: number; z: number; done: boolean }>();
  /** What a samurai's next skill clears (by attacker): his last skills' pieces still on screen — the ribbons, the cuts,
   *  the bursts and marks of their blows. The effects' clock stops with every hit-stop, so a fading leftover froze over
   *  the next skill's blows and hid the foe (the trials, filmed: Swallow Cut's line over MIKAZUKI's crescent, Falcon
   *  Dive's phoenix over SAKURA's blossoms, the basic's launch over SAYA's draw). */
  private nexts = new Map<string, Set<{ castId: string; skill: string; fn: () => void }>>();
  /** The cast the pieces being made now belong to (set by the entry points; null: not cut short — a zone, a stance). */
  private cur: { attackerId: string; castId: string; skill: string } | null = null;
  private clock = 0;
  /** Real time (it runs through the hit-stops): a leftover cut short fades on it, even while the fight's picture is held. */
  private real = 0;
  /** Each skill's latest blow (its hit marks come from the scene a moment later, without the cast). */
  private lastHit = new Map<string, { own: { attackerId: string; castId: string; skill: string }; at: number }>();
  private lastAny: { own: { attackerId: string; castId: string; skill: string }; at: number } | null = null;
  /** The other pieces a cast made (its own drawn ones: silhouettes, ink streaks, the dragons…) — cut short with it: faded
   *  over what their own step draws. (The pieces that cut themselves short — `spr`, `floor`, the ribbons — are left out.) */
  private tracked: { objs: Phaser.GameObjects.GameObject[]; born: number; cutAt: number; unreg: (() => void) | null; dead?: boolean }[] = [];
  private selfCut = new WeakSet<Phaser.GameObjects.GameObject>();

  constructor(private ctx: SamCtx) {}

  get ready(): boolean { return this.ctx.scene.textures.exists(KIT); }

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  private later(ms: number, fn: () => void, run?: CastRun): void {
    const own = this.cur; // (what it makes later belongs to the same cast)
    this.add({ t: 0, step: (_dt, t) => { if (t < ms) return true; if (!run || !(run.phase === 'done' && !run.fired.size)) this.withOwn(own, fn); return false; } });
  }
  /** Register a piece of the current cast to be cut short by its caster's next skill (`fn`); returns its removal. */
  private onNext(fn: () => void, own = this.cur): (() => void) | null {
    if (!own) return null;
    const e = { castId: own.castId, skill: own.skill, fn }, set = this.nexts.get(own.attackerId) ?? new Set();
    set.add(e); this.nexts.set(own.attackerId, set);
    return () => { const st = this.nexts.get(own.attackerId); if (st) { st.delete(e); if (!st.size) this.nexts.delete(own.attackerId); } };
  }
  /** Run `fn` with the pieces it makes belonging to `r` (none for the skills whose pieces show a state: a zone, a stance). */
  private as<T>(r: { attackerId: string; castId: string; skill: { id: string } } | null, fn: () => T): T {
    return this.withOwn(r && !KEEP.has(r.skill.id) ? { attackerId: r.attackerId, castId: r.castId, skill: r.skill.id } : null, fn);
  }
  /** Run `fn` with its pieces belonging to `own`; what it drew on its own (not through `spr` / `floor`) is tracked too. */
  private withOwn<T>(own: { attackerId: string; castId: string; skill: string } | null, fn: () => T): T {
    const prev = this.cur, list = own ? this.ctx.scene.children.list : null, n0 = list?.length ?? 0;
    this.cur = own;
    try { return fn(); } finally {
      if (own && list && list.length > n0) {
        const objs = list.slice(n0).filter((o) => !this.selfCut.has(o));
        if (objs.length) { const e = { objs, born: this.real, cutAt: -1, unreg: null as (() => void) | null }; e.unreg = this.onNext(() => { if (e.cutAt < 0) e.cutAt = Math.max(this.real, e.born + SamuraiFx.CUT.min); }, own); this.tracked.push(e); }
      }
      this.cur = prev;
    }
  }
  /** After every piece has drawn itself: the tracked pieces cut short fade over what their step drew (real time). */
  private stepTracked(): void {
    for (const e of this.tracked) {
      const alive = e.objs.filter((o) => o.active && o.scene);
      if (!alive.length) { e.dead = true; e.unreg?.(); continue; }
      if (e.cutAt < 0 || this.real < e.cutAt) continue;
      const f = 1 - (this.real - e.cutAt) / SamuraiFx.CUT.fade;
      for (const o of alive) { const g = o as unknown as { setVisible(v: boolean): unknown; setAlpha(a: number): unknown; alpha: number }; if (f <= 0) g.setVisible(false); else g.setAlpha(g.alpha * f); }
    }
    if (this.tracked.some((e) => e.dead)) this.tracked = this.tracked.filter((e) => !e.dead);
  }
  /** A piece cut short: it keeps at least 100 ms of its life, then fades out in 90 ms (real time: a hit-stop holds the
   *  new blow's picture, not the old one's). */
  private static readonly CUT = { min: 100, fade: 90 };
  private broken(r?: CastRun): boolean { return !!r && r.phase === 'done' && !r.fired.size; }
  /** A double's swing whose double has burst (Kagemusha): its picture goes with it. */
  private gone(r?: CastRun): boolean { return !!r && r.attackerId.includes('#') && !this.ctx.casterPos(r.attackerId); }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** How much of him shows now (0: vanished / hidden among his doubles). */
  private seen(id: string): number { return this.ctx.body?.(id)?.a ?? 1; }
  /** A point in front of the caster (dx forward, dz up), following him. */
  private front(r: CastRun, dx: number, dz: number, dy = 0): () => Pt | null {
    const side = sideOf(r);
    return () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x + side * dx, y: c.y - c.z - dz + dy, d: c.y } : null; };
  }

  /** In PVP 3D (the arena's 3D room is up): the skills in IN3D_OWN are drawn by the room's own pieces only. */
  private in3d(): boolean { return !!(this.ctx.scene as unknown as { a3d?: unknown }).a3d; }
  /** PVP 3D: the room's own pieces (DFO's Fx3D). */
  private fx3d(): Fx3D | undefined { return (this.ctx.scene as unknown as { a3d?: { fx?: Fx3D } }).a3d?.fx; }
  /** A piece's frame name as the atlas has it (a toned piece the atlas lacks: its crimson original). */
  private fname(name: string): string {
    const t = this.ctx.scene.textures;
    if (!name.includes('@') || !t.exists(KIT) || t.get(KIT).has(name)) return name;
    return name.slice(0, name.indexOf('@'));
  }

  private spr(o: Spr): Phaser.GameObjects.Image | null {
    const s = this.ctx.scene;
    if (!s.textures.exists(KIT)) return null;
    const name = this.fname(o.name);
    const fr = s.textures.getFrame(KIT, name); if (!fr) return null;
    const fw = fr.cutWidth || fr.width, fh = fr.cutHeight || fr.height;
    const bx = o.w / fw, by = (o.h ?? (o.w * fh) / fw) / fh;
    const mk = (glow: boolean) => {
      const im = s.add.image(o.x ?? 0, o.y ?? 0, KIT, name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlip(!!o.flipX, !!o.flipY).setVisible(false)
        .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      if (o.crop !== undefined) im.setCrop(0, fh * o.crop, fw, fh * (1 - o.crop));
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    this.selfCut.add(im); if (gl) this.selfCut.add(gl);
    let shown = false, cutAt = -1;
    const born = this.real;
    const unreg = o.keep ? null : this.onNext(() => { if (cutAt < 0) cutAt = Math.max(this.real, born + (o.delay ?? 0) + SamuraiFx.CUT.min); });
    const kill = () => { im.destroy(); gl?.destroy(); unreg?.(); return false; };
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return cutAt < 0 ? true : kill(); // (cut short before it showed: it never shows)
      if (!shown) { shown = true; if (this.broken(o.run)) return kill(); }
      if (this.gone(o.run)) return kill();
      if (cutAt < 0 && o.stop?.()) cutAt = this.real;
      const cut = cutAt < 0 || this.real < cutAt ? 1 : 1 - (this.real - cutAt) / SamuraiFx.CUT.fade;
      if (cut <= 0) return kill();
      const u = Math.min(1, e / o.life);
      let x = o.x ?? 0, y = o.y ?? 0, d = o.depth ?? TOP;
      if (o.follow) { const p = o.follow(); if (p) { x = p.x; y = p.y; d = p.d + (o.dz ?? 3); } }
      x += o.mx?.(u) ?? 0; y += o.my?.(u) ?? 0;
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)) * cut, ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0);
      const fl = o.flick ? (Math.floor(e / o.flick) % 2 === 1) !== !!o.flipX : !!o.flipX;
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al).setFlipX(fl);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.04, sy * 1.04).setAngle(ang).setDepth(d + 0.01).setAlpha(al * o.glow!).setFlipX(fl);
      if (u >= 1) return kill();
      return true;
    } });
    return im;
  }

  /** A piece lying on the floor (drawn from above): flattened into the floor's perspective, turning in its plane. */
  private floor(name: string, x: number, y: number, w: number, life: number, o: { a?: (u: number) => number; s?: (u: number) => number; spin?: number; angle?: number;
    depth?: number; delay?: number; add?: boolean; glow?: number; squash?: number; run?: CastRun; h?: number; tint?: number } = {}): void {
    const s = this.ctx.scene;
    if (!s.textures.exists(KIT)) return;
    name = this.fname(name);
    const fr = s.textures.getFrame(KIT, name); if (!fr) return;
    const mk = (glow: boolean) => {
      const im = s.add.image(0, 0, KIT, name).setDisplaySize(w, o.h ?? (w * fr.height) / fr.width).setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (o.tint !== undefined) im.setTint(o.tint);
      return im;
    };
    const im = mk(false), gl = o.glow ? mk(true) : null;
    const box = s.add.container(x, y, gl ? [im, gl] : [im]).setScale(1, o.squash ?? SQUASH).setDepth(o.depth ?? GROUND + 2).setVisible(false);
    this.selfCut.add(box);
    const k0 = im.scaleX, k1 = im.scaleY;
    let shown = false, cutAt = -1;
    const born = this.real;
    const unreg = this.onNext(() => { if (cutAt < 0) cutAt = Math.max(this.real, born + (o.delay ?? 0) + SamuraiFx.CUT.min); });
    const kill = () => { box.destroy(); unreg?.(); return false; };
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return cutAt < 0 ? true : kill();
      if (!shown) { shown = true; if (this.broken(o.run)) return kill(); box.setVisible(true); }
      if (this.gone(o.run)) return kill();
      const cut = cutAt < 0 || this.real < cutAt ? 1 : 1 - (this.real - cutAt) / SamuraiFx.CUT.fade;
      if (cut <= 0) return kill();
      const u = Math.min(1, e / life), k = o.s?.(u) ?? 1, ang = (o.angle ?? 0) + (o.spin ?? 0) * u;
      im.setScale(k0 * k, k1 * k).setAngle(ang); gl?.setScale(k0 * k * 1.03, k1 * k * 1.03).setAngle(ang).setAlpha(o.glow ?? 0);
      box.setAlpha(Math.max(0, Math.min(1, o.a?.(u) ?? 1)) * cut);
      if (u >= 1) return kill();
      return true;
    } });
  }

  /** A sword cut: grows along its arc with a short sweep, holds a moment, thins out. `w` = its drawn width. */
  private cut(name: string, w: number, angle: number, o: { x?: number; y?: number; depth?: number; follow?: () => Pt | null; dz?: number; flipX?: boolean; flipY?: boolean; h?: number;
    grow?: number; hold?: number; fade?: number; glow?: number; delay?: number; sweep?: number; run?: CastRun; alpha?: number } = {}): void {
    const g = o.grow ?? 55, hd = o.hold ?? 35, f = o.fade ?? 150, life = g + hd + f, ug = g / life, uh = (g + hd) / life, sw = (o.sweep ?? 14) * (o.flipY ? -1 : 1) * (o.flipX ? -1 : 1);
    const a0 = kf([0, 0.85], [ug, 1], [uh, 1], [1, 0, inQ]), al = o.alpha ?? 1;
    this.spr({ name, x: o.x, y: o.y, depth: o.depth ?? TOP + 3, follow: o.follow, dz: o.dz, w, h: o.h, angle, flipX: o.flipX, flipY: o.flipY, delay: o.delay, life, glow: o.glow ?? 0.55, run: o.run,
      sx: kf([0, 0.3], [ug, 1, out3], [1, 1.06]), sy: kf([0, 0.7], [ug, 1, out], [uh, 1], [1, 0.2, inQ]), a: al === 1 ? a0 : (u: number) => a0(u) * al, rot: kf([0, -sw], [ug, 0, out]) });
  }

  /** A burst / spark: pops out, spreads a little, fades. */
  private pop(name: string, x: number, y: number, size: number, o: { depth?: number; life?: number; glow?: number; angle?: number; delay?: number; oy?: number; add?: boolean; run?: CastRun } = {}): void {
    this.spr({ name, x, y, depth: o.depth ?? TOP + 4, w: size, life: o.life ?? 240, delay: o.delay, oy: o.oy, add: o.add, run: o.run, angle: o.angle ?? rnd(-25, 25), glow: o.glow ?? 0.6,
      sx: kf([0, 0.45], [0.2, 1.05, out3], [1, 1.2]), sy: kf([0, 0.45], [0.2, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
  }

  /** Cherry-blossom petals scattered from (x, y), fluttering down as they fade. */
  private petals(x: number, y: number, n: number, spread: number, o: { depth?: number; up?: number; life?: number; delay?: number; inward?: boolean } = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = spread * rnd(0.35, 1), life = (o.life ?? 950) * rnd(0.7, 1.3), up = o.up ?? 0;
      const tx = Math.cos(a) * d, ty = Math.sin(a) * d * 0.55 - up, spin = (Math.random() < 0.5 ? -1 : 1) * rnd(200, 520), ph = Math.random() * 6;
      this.spr({ name: i % 7 === 6 ? 'blossom' : `petal_${1 + (i % 4)}`, x, y, depth: o.depth ?? TOP + 2, w: i % 7 === 6 ? 20 : rnd(13, 21), life, delay: o.delay, angle: Math.random() * 360,
        mx: o.inward ? (u) => tx * (1 - out(u)) : (u) => tx * out(u), my: o.inward ? (u) => ty * (1 - out(u)) - 20 * u : (u) => ty * out(u) + 46 * u * u,
        rot: (u) => spin * u, a: o.inward ? kf([0, 0], [0.2, 1], [0.85, 1], [1, 0]) : kf([0, 1], [0.6, 1], [1, 0]), sx: (u) => 0.55 + 0.45 * Math.abs(Math.cos(u * 8 + ph)) });
    }
  }

  /** A shockwave ring on the floor (its colour drawn solid, its light added over it: it reads on bright floors too). */
  private shock(x: number, y: number, w: number, o: { delay?: number; tint?: number; life?: number; tone?: Tone } = {}): void {
    this.spr({ name: tn('shock_ring', o.tone), x, y, depth: GROUND + 2.5, w, delay: o.delay, glow: 0.6, tint: o.tint, life: o.life ?? 420, sx: kf([0, 0.25], [1, 1.25, out3]), sy: kf([0, 0.25], [1, 1.25, out3]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
  }
  /** Sparks of a tone thrown out from (x, y) and falling (the accent of the skills that carry no petals). */
  private sparks(x: number, y: number, n: number, spread: number, o: { tone?: Tone; depth?: number; delay?: number; life?: number; up?: number } = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = spread * rnd(0.35, 1), tx = Math.cos(a) * d, ty = Math.sin(a) * d * 0.6 - (o.up ?? 0), life = (o.life ?? 420) * rnd(0.7, 1.2);
      this.spr({ name: tn('spark_s', o.tone), x, y, depth: o.depth ?? TOP + 2, w: rnd(14, 24), life, delay: o.delay, angle: rnd(0, 360), glow: 0.7,
        mx: (u) => tx * out(u), my: (u) => ty * out(u) + 30 * u * u, rot: (u) => 180 * u, a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
    }
  }
  /** Dust kicked up: two puffs the colour of the ground rolling out to the sides, thinning as they go. */
  private dust(x: number, y: number, w: number, delay = 0): void {
    for (const s of [-1, 1])
      this.spr({ name: 'dust', x: x + s * w * 0.1, y, oy: 0.85, depth: y + 2, w: w * 0.8, delay: delay + (s > 0 ? 30 : 0), life: 520, flipX: s < 0, tint: DUST,
        mx: (u) => s * w * 0.32 * out3(u), my: (u) => -10 * u,
        sx: kf([0, 0.35], [0.3, 1, out3], [1, 1.2]), sy: kf([0, 0.3], [0.3, 0.9, out3], [1, 1.05]), a: kf([0, 0], [0.07, 0.78], [0.45, 0.5], [1, 0, inQ]) });
  }
  private dustRing(x: number, y: number, w: number, delay = 0): void {
    this.spr({ name: 'dust_ring', x, y: y - 6, depth: y + 2, w, delay, life: 560, tint: DUST, sx: kf([0, 0.4], [1, 1.3, out3]), sy: kf([0, 0.4], [1, 1.25, out3]), a: kf([0, 0], [0.06, 0.75], [0.5, 0.5], [1, 0, inQ]) });
  }
  /** A glowing crack in the floor along `ang` (deg, on the floor), cooling down. */
  private crack(x: number, y: number, len: number, ang = rnd(-25, 25), delay = 0): void {
    this.floor('crack', x, y, len * 0.82, 1700, { angle: ang + CRACK_TILT, squash: 0.5, delay, glow: 0.7, depth: GROUND + 1.5, a: kf([0, 0], [0.04, 1], [0.6, 1], [1, 0, inQ]), s: kf([0, 0.7], [0.08, 1, out3]) });
  }
  /** A foe thrown up: a beam from under it and streaks of light and petals shooting up after it. */
  private launchBeam(x: number, y: number, h = 110, tone?: Tone): void {
    // (behind the foe it throws up: in front, the beam and its streaks washed him out in PVP 3D — DFO's review)
    this.spr({ name: tn('launch_beam', tone), x, y: y + 4, oy: 0.95, depth: y - 1.2, w: h * 1.45, h, life: 280, glow: 0.3, sx: kf([0, 0.6], [1, 0.85]), sy: kf([0, 0.2], [0.3, 1, out3], [1, 1.15]), a: kf([0, 0.8], [0.35, 0.8], [1, 0, inQ]) });
    this.spr({ name: tn('launch_streaks', tone), x, y: y + 6, oy: 0.97, depth: y - 1.1, w: h * 0.78, h: h * 1.35, life: 440, glow: 0.35, my: (u) => -46 * out(u),
      sy: kf([0, 0.25], [0.3, 1, out3], [1, 1.2]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 1], [0.45, 0.9], [1, 0, inQ]) });
  }
  /** A power aura flaring up round him (aura_gold / aura_crimson): flames rising from a ring at his feet, flaring, fading —
   *  behind him, the ring's near rim over his feet. */
  private auraFlare(r: CastRun, name: string, w: number, life: number, delay = 0, stop?: () => boolean): void {
    const f = () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z + 8, d: c.y } : null; };
    const m = { sx: kf([0, 0.6], [0.22, 1.04, out3], [1, 1.1]), sy: kf([0, 0.15], [0.22, 1.06, out3], [1, 1.18]), a: kf([0, 0], [0.06, 1], [0.55, 0.85], [1, 0, inQ]) };
    this.spr({ name, w, life, delay, oy: 0.92, follow: f, dz: -2.3, glow: 0.55, run: r, stop, ...m });
    this.spr({ name, w, life, delay, oy: 0.92, follow: f, dz: 2.3, crop: 0.86, glow: 0.4, run: r, stop, ...m });
  }
  /** A silhouette of the samurai standing (his body as drawn now, in ink with a crimson edge) at feet (x, y). */
  private silhouette(r: CastRun, x: number, y: number, depth: number, life: number, o: { delay?: number; face?: number; a?: (u: number) => number; scale?: number } = {}): void {
    const b = this.ctx.body?.(r.attackerId); if (!b) return;
    const s = this.ctx.scene, k = o.scale ?? 1, flip = o.face === undefined ? b.flipX : (o.face < 0) !== (sideOf(r) < 0) ? !b.flipX : b.flipX;
    const mk = (fill: number, kk: number) => s.add.image(x, y, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx * k * kk, b.sy * k * kk).setFlipX(flip).setTintFill(fill).setVisible(false);
    const rim = mk(0xff3048, 1.07).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y + 3).setDepth(depth - 0.01), ink = mk(0x12040a, 1).setDepth(depth);
    const al = o.a ?? kf([0, 0], [0.2, 0.85], [0.7, 0.85], [1, 0]);
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0);
      if (e < 0) return true;
      if (this.broken(r)) { rim.destroy(); ink.destroy(); return false; }
      const u = Math.min(1, e / life), a = al(u);
      rim.setVisible(true).setAlpha(0.85 * a); ink.setVisible(true).setAlpha(0.92 * a);
      if (u >= 1) { rim.destroy(); ink.destroy(); return false; }
      return true;
    } });
  }
  /** Stunned (the AMBUSH): a crown of petals circling over the head for `ms`. */
  stunCrown(id: string, ms: number): void {
    if (!this.ready) return;
    const f = () => { const t = this.ctx.targetPos?.(id) ?? this.ctx.casterPos(id); return t ? { x: t.x, y: t.y - t.z - ((t as { h?: number }).h ?? 96) - 6, d: TOP } : null; }; // (round the top of the head)
    this.spr({ name: 'stun_crown', w: 88, life: ms, follow: f, dz: 2, flick: 140, glow: 0.55, rot: (u) => 6 * Math.sin(u * 20),
      sx: kf([0, 0.4], [0.15, 1, back]), sy: kf([0, 0.4], [0.15, 1, back]), a: kf([0, 0], [0.1, 1], [0.85, 1], [1, 0]) });
    // and stars circling round it (the near ones over it, the far ones under it)
    const s = this.ctx.scene, stars = [0, 1, 2].map(() => s.add.image(0, 0, KIT, 'glint').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a8).setVisible(false));
    this.add({ t: 0, step: (_dt, t) => {
      const p = f(), u = t / ms;
      if (!p || u >= 1) { for (const im of stars) im.destroy(); return false; }
      const al = Math.min(1, t / 90) * Math.min(1, (1 - u) / 0.15);
      stars.forEach((im, k) => {
        const th = t * 0.011 + (k * Math.PI * 2) / 3, sn = Math.sin(th);
        im.setVisible(true).setPosition(p.x + Math.cos(th) * 34, p.y + sn * 10).setDepth(TOP + (sn > 0 ? 3 : 1)).setScale(0.09 + 0.02 * sn).setAngle(t * 0.3).setAlpha(al * (sn > 0 ? 1 : 0.6));
      });
      return true;
    } });
  }
  /** Bound (Sakura Bind): a ring of petals round the shins, and a ring of fallen petals on the stones round the feet that
   *  closes in as the bind runs out (natural petals — no glow). */
  private bindMark(x: number, y: number, hold: number): void {
    this.spr({ name: 'petal_ring', x, y: y + 3, depth: y - 1, w: 128, life: hold, tint: 0xf0c2ca,
      sx: kf([0, 1.25], [0.08, 1, out3], [1, 0.42]), sy: kf([0, 1.25], [0.08, 0.7, out3], [1, 0.3]), a: kf([0, 0], [0.06, 0.9], [0.9, 0.85], [1, 0]) });
    for (const [crop, z] of [[undefined, -2], [0.5, 2]] as const)
      this.spr({ name: 'petal_ring', x, y: y - 24, depth: y + z, w: 92, life: hold, crop, flick: 170,
        sx: kf([0, 0.4], [0.12, 1, back]), sy: kf([0, 0.4], [0.12, 1, back]), a: kf([0, 0], [0.1, 0.9], [0.88, 0.9], [1, 0]) });
  }
  /** The blade's glint at the hand (or in front of the chest): a four-pointed star that flares and turns. */
  private glint(r: CastRun, delay: number, size: number, dz = 62, tone?: Tone): void {
    const f = this.front(r, 16, dz);
    this.spr({ name: tn('glint', tone), w: size * 1.5, delay, life: 300, run: r, glow: 0.8, dz: 6,
      follow: () => { const h = this.ctx.hand(r.attackerId), p = f(); return h && p ? { x: h.x, y: h.y, d: p.d } : p; },
      sx: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), sy: kf([0, 0.2], [0.25, 1.15, out3], [1, 0.6]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]), rot: (u) => 45 * (1 - out(u)) });
  }

  // ------------------------------------------------------------------ strips: a picture bent along a path

  /** A strip of a picture bent along points (a rope: no seams, whatever the curve), each point as wide as its half-width
   *  and as bright as its alpha — the dragon's body and tail, a ribbon of light. Points run from the picture's left end to
   *  its right end; `flipY` turns the picture over (its top below the path), `flipX` runs it the other way along. */
  private strip(name: string | undefined, n: number, o: { add?: boolean; flipX?: boolean; flipY?: boolean; tint?: number; key?: string; vertical?: boolean } = {}) {
    const s = this.ctx.scene, pts = Array.from({ length: n }, (_, i) => new Phaser.Math.Vector2(i, 0));
    const rope = s.add.rope(0, 0, o.key ?? KIT, name, pts, true).setVisible(false);
    if (o.add) rope.setBlendMode(Phaser.BlendModes.ADD);
    if (o.flipX) rope.flipX = true;
    if (o.flipY) rope.flipY = true;
    if (o.tint !== undefined) rope.setColors(o.tint);
    const w = new Float32Array(n), up = !!o.vertical;
    (rope as unknown as { updateVertices(): unknown }).updateVertices = function (this: Phaser.GameObjects.Rope) {
      const P = this.points, V = this.vertices;
      this.dirty = false;
      if (up) { for (let i = 0; i < n; i++) { V[i * 4] = V[i * 4 + 2] = P[i].x; V[i * 4 + 1] = P[i].y - w[i]; V[i * 4 + 3] = P[i].y + w[i]; } return this; } // (a band upright on a curve: a wall)
      let px = 0, py = -1;
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
        if (l > 1e-4) { px = dy / l; py = -dx / l; } // (a point on top of its neighbours keeps the last direction)
        V[i * 4] = P[i].x + px * w[i]; V[i * 4 + 1] = P[i].y + py * w[i]; V[i * 4 + 2] = P[i].x - px * w[i]; V[i * 4 + 3] = P[i].y - py * w[i];
      }
      return this;
    };
    return {
      rope,
      /** Lays it out: point i at `at(i)`, half as wide as `hw(i)`, as bright as `av(i)`. */
      set: (at: (i: number) => { x: number; y: number }, hw: (i: number) => number, av: (i: number) => number, cv?: (i: number) => number): void => {
        const al = rope.alphas, co = rope.colors;
        let mx = 0, my = 0;
        for (let i = 0; i < n; i++) { const p = at(i); pts[i].set(p.x, p.y); mx += p.x; my += p.y; w[i] = hw(i); al[i * 2] = al[i * 2 + 1] = Math.max(0, Math.min(1, av(i))); if (cv) co[i * 2] = co[i * 2 + 1] = cv(i); }
        // (the strip stands at the middle of its points, its points round it — a picture with a place of its own, which
        // the PVP 3D room projects like any other: at (0, 0) with world points it was thrown off into the room)
        mx /= n; my /= n;
        for (const p of pts) { p.x -= mx; p.y -= my; }
        rope.setPosition(mx, my).setDirty().setVisible(true);
      },
      /** Where along its picture each point lies (0..1 across it): a picture sliding along the strip. */
      uv: (u: (i: number) => number): void => { const U = rope.uv; for (let i = 0; i < n; i++) { U[i * 4] = U[i * 4 + 2] = u(i); U[i * 4 + 1] = 0; U[i * 4 + 3] = 1; } },
      destroy: (): void => { rope.destroy(); },
    };
  }

  /** A band of light across its width (clear at its edges, the tone's colour — crimson by default — a white-hot core):
   *  ribbons of light are drawn with it. */
  private ribbonTex(tone?: Tone): string {
    const tm = this.ctx.scene.textures, key = tone ? `sam-ribbon-${tone}` : 'sam-ribbon';
    if (!tm.exists(key)) {
      const c = tm.createCanvas(key, 8, 64);
      if (c) {
        const [r, gg, b] = TONE_RGB[tone ?? 'crimson'], mid = (k: number) => [r, gg, b].map((v) => Math.round(v + (255 - v) * k)).join(',');
        const g = c.context, gr = g.createLinearGradient(0, 0, 0, 64);
        ([[0, `rgba(${mid(0)},0)`], [0.1, `rgba(${mid(0)},0.42)`], [0.26, `rgba(${mid(0.1)},0.92)`], [0.4, `rgba(${mid(0.55)},1)`], [0.5, 'rgba(255,250,250,1)'], [0.6, `rgba(${mid(0.55)},1)`],
          [0.74, `rgba(${mid(0.1)},0.92)`], [0.9, `rgba(${mid(0)},0.42)`], [1, `rgba(${mid(0)},0)`]] as const)
          .forEach(([at, col]) => gr.addColorStop(at, col));
        g.fillStyle = gr; g.fillRect(0, 0, 8, 64); c.refresh();
      }
    }
    return key;
  }


  /** One ray of sunlight: golden, bright at its root, tapering and fading out to its tip (drawn from its root, pointing right). */
  private rayTex(): string {
    const tm = this.ctx.scene.textures, key = 'sam-ray';
    if (tm.exists(key)) return key;
    const W = 64, H = 12, c = tm.createCanvas(key, W, H);
    if (!c) return key;
    const g = c.context, lg = g.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(255,246,214,1)'); lg.addColorStop(0.35, 'rgba(255,206,92,0.95)'); lg.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H / 2 - 0.5); g.lineTo(W, H / 2 + 0.5); g.lineTo(0, H); g.closePath(); g.fill();
    c.refresh();
    return key;
  }

  /** A ribbon of light behind a moving point (where it went in the last `span` ms): widest and brightest at its head,
   *  thinning to nothing at its tail; drawn solid with its light added over it. It stops growing when `at` gives nothing
   *  (or `until` ms pass) and fades out over `fade` ms. */
  private trail(at: (t: number) => Pt | null, o: { span: number; w: number; tint?: number; glow?: number; until?: number; fade?: number; delay?: number; run?: CastRun; tone?: Tone }): void {
    const key = this.ribbonTex(o.tone), N = 24, base = this.strip(undefined, N, { key, tint: o.tint }), light = this.strip(undefined, N, { key, add: true });
    this.selfCut.add(base.rope); this.selfCut.add(light.rope);
    const hist: { x: number; y: number; d: number; t: number }[] = [];
    let stop = -1, fade = o.fade ?? 180, k0 = 1, tNow = 0;
    // (his next skill clears it: a fading ribbon froze on screen through the next skill's hit-stops — the effects' clock
    // stops with them — and stood over the chase that followed: MIKAZUKI's jump and crescent after Swallow Cut)
    let cutReal = -1; // (his next skill: the ribbon stops and fades out on real time, through any hit-stop)
    const short = () => { if (cutReal < 0) { cutReal = this.real; if (stop < 0) stop = tNow; } };
    const unreg = this.onNext(short, o.run ? { attackerId: o.run.attackerId, castId: o.run.castId, skill: o.run.skill.id } : this.cur);
    const kill = () => { base.destroy(); light.destroy(); unreg?.(); };
    this.add({ t: 0, step: (_dt, t0) => {
      const t = t0 - (o.delay ?? 0);
      tNow = t;
      if (t < 0) return true;
      if (this.gone(o.run) || (this.broken(o.run) && !hist.length)) { kill(); return false; }
      if (stop < 0) { const p = o.until !== undefined && t > o.until ? null : at(t); if (p) hist.push({ x: p.x, y: p.y, d: p.d, t }); else stop = t; }
      const now = stop < 0 ? t : stop;
      while (hist.length > 2 && hist[1].t < now - o.span) hist.shift();
      const k = (stop < 0 ? 1 : k0 * (1 - (t - stop) / fade)) * (cutReal < 0 ? 1 : 1 - (this.real - cutReal) / SamuraiFx.CUT.fade);
      if (k <= 0) { kill(); return false; }
      if (hist.length < 2) return true;
      const ta = Math.max(hist[0].t, now - o.span), tb = hist[hist.length - 1].t;
      let j = 0;
      const pos = (i: number) => { // (evenly in time from its tail to its head)
        const tt = ta + (tb - ta) * (i / (N - 1));
        while (j < hist.length - 2 && hist[j + 1].t < tt) j++;
        const p = hist[j], q = hist[Math.min(hist.length - 1, j + 1)], f = q.t > p.t ? Math.max(0, Math.min(1, (tt - p.t) / (q.t - p.t))) : 1;
        return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
      };
      const hw = (i: number) => o.w * 0.5 * Math.pow(i / (N - 1), 0.75), av = (i: number) => k * Math.min(1, (i / (N - 1)) * 1.6);
      j = 0; base.set(pos, hw, (i) => av(i) * 0.9);
      j = 0; light.set(pos, (i) => hw(i) * 0.62, (i) => av(i) * (o.glow ?? 0.8));
      const d = hist[hist.length - 1].d;
      base.rope.setDepth(d); light.rope.setDepth(d + 0.01);
      return true;
    } });
  }

  // ------------------------------------------------------------------ the dragon

  /** The crimson dragon as one living body: its body and its tail are strips bent along one path (no seams, whatever the
   *  curve), the body thinning toward the tail, the head at the front with its glow, two clawed legs under the body.
   *  `place(path, neck, alpha, melt)` lays it along a path (s ↦ point, s = the distance along it) with its neck at distance
   *  `neck`; what lies before the path's start (s < 0, still in the floor) is not drawn; `melt` (0..1) melts it away from
   *  its tail tip to its head. `flip`: its back stays up when it flies to the left (the picture turned over). */
  private serpent(thick: number, o: { glow?: number; flip?: boolean; tone?: Tone } = {}) {
    const s = this.ctx.scene, NB = 28, NT = 12, flip = !!o.flip, glow = o.glow ?? 0.35, ADD = Phaser.BlendModes.ADD, P = (n: string) => this.fname(tn(n, o.tone));
    const LB = thick * 7.2, LT = thick * 4.4, all = LB + LT;
    const body = this.strip(P('dragon_body'), NB, { flipY: flip }), shine = this.strip(P('dragon_body'), NB, { add: true, flipY: flip });
    const tail = this.strip(P('dragon_tail'), NT, { flipX: true, flipY: flip });
    const head = s.add.image(0, 0, KIT, P('dragon_head')).setOrigin(0.06, 0.62).setVisible(false).setFlipY(flip);
    const hg = s.add.image(0, 0, KIT, P('dragon_head')).setOrigin(0.06, 0.62).setBlendMode(ADD).setVisible(false).setFlipY(flip);
    const claws = [0, 1].map(() => s.add.image(0, 0, KIT, P('dragon_claw')).setOrigin(0.1, 0.24).setVisible(false).setFlipY(flip));
    const hk = (thick * 1.7) / head.height, ck = (thick * 1.1) / claws[0].height;
    const sm = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
    const tangent = (path: (sv: number) => Pt, sv: number) => { const a = path(Math.max(0, sv - 6)), b = path(Math.max(0, sv) + 6); return Math.atan2(b.y - a.y, b.x - a.x); };
    return {
      /** its whole length (tail tip to the jaws) */
      length: all + thick * 3.9,
      place: (path: (sv: number) => Pt, neck: number, alpha: number, melt = 0): void => {
        const tip = neck - all, out = (sv: number) => (sv < 0 ? 0 : Math.min(1, sv / 14)); // (fades out where it goes into the floor)
        const gone = (sv: number) => sm(((sv - tip) / all - melt * 1.2 + 0.2) / 0.2); // (melted away from the tail tip up)
        const P = (sv: number) => path(Math.max(0, sv));
        const sb = (i: number) => neck - LB * (1 - i / (NB - 1)), st = (j: number) => tip + LT * (j / (NT - 1));
        const bw = (i: number) => thick * 0.5 * (0.8 + 0.32 * sm(i / (NB * 0.6)));
        body.set((i) => P(sb(i)), bw, (i) => alpha * out(sb(i)) * gone(sb(i)));
        shine.set((i) => P(sb(i)), (i) => bw(i) * 1.06, (i) => alpha * out(sb(i)) * gone(sb(i)) * glow * 0.6);
        tail.set((j) => P(st(j)), () => thick * 0.46, (j) => alpha * out(st(j)) * gone(st(j)));
        const n = P(neck), d = n.d, a0 = tangent(path, neck), ah = alpha * out(neck) * gone(neck);
        body.rope.setDepth(d); shine.rope.setDepth(d + 0.005); tail.rope.setDepth(d - 0.01);
        for (const h of [head, hg]) h.setVisible(ah > 0.01).setPosition(n.x, n.y).setRotation(a0).setScale(hk).setDepth(d + (h === hg ? 0.03 : 0.02));
        head.setAlpha(ah); hg.setAlpha(ah * glow);
        [0.16, 0.6].forEach((f, k) => { // the legs: from under the body, reaching forward
          const sv = neck - LB * f, p = P(sv), ang = tangent(path, sv), bx = Math.sin(ang) * (flip ? -1 : 1), by = -Math.cos(ang) * (flip ? -1 : 1);
          claws[k].setVisible(ah > 0.01 && sv > 0).setPosition(p.x - bx * thick * 0.22, p.y - by * thick * 0.22).setRotation(ang + (flip ? -0.6 : 0.6)).setScale(ck)
            .setDepth(d - 0.02).setAlpha(alpha * out(sv) * gone(sv));
        });
      },
      /** a point along it (0 tail tip .. 1 neck), for sparks */
      at: (path: (sv: number) => Pt, neck: number, u: number): Pt => path(Math.max(0, neck - all * (1 - u))),
      destroy: (): void => { body.destroy(); shine.destroy(); tail.destroy(); for (const im of [head, hg, ...claws]) im.destroy(); },
    };
  }

  // ------------------------------------------------------------------ cast timeline

  /** His shadow doubles (Kagemusha) swing with him: the same picture drawn from where each of them stands — the run seen
   *  from there (a run of its own, so it follows the double; everything else is read live from his run). */
  private shadows(r: CastRun): CastRun[] {
    if (r.skill.id === 'kagemusha' || r.skill.id === 'dragon_eclipse') return []; // (the ultimate is his alone: the doubles burst at its cut)
    const gs = this.ctx.ghosts?.(r.attackerId) ?? [];
    if (!gs.length) return [];
    const me = this.ctx.casterPos(r.attackerId) ?? r.origin;
    return gs.map((g) => {
      const dx = g.x - me.x, dy = g.y - me.y, o = Object.create(r) as CastRun;
      o.attackerId = `${r.attackerId}#${g.k}`; o.castId = `${r.castId}#${g.k}`; o.own = false;
      o.origin = { x: r.origin.x + dx, y: r.origin.y + dy, z: r.origin.z };
      o.place = r.place ? { x: r.place.x + dx, y: r.place.y + dy } : null;
      return o;
    });
  }

  /** The wind-up (and whatever runs through the whole cast). */
  cast(r: CastRun): void {
    if (!this.ready) return;
    // (his last skills' leftovers — his doubles' too — give way to this one; the basic's next cut leaves the last one's)
    for (const [k, set] of [...this.nexts]) if (k === r.attackerId || k.startsWith(`${r.attackerId}#`)) for (const x of [...set]) if (x.skill !== r.skill.id) x.fn();
    this.as(r, () => this.castOne(r, false));
    for (const g of this.shadows(r)) this.as(g, () => this.castOne(g, true));
  }
  private castOne(r: CastRun, ghost: boolean): void {
    const s = r.skill, T = r.timings;
    switch (s.id) {
      case 'quick_slash': if ((r.stage ?? 0) === 3) this.glint(r, T.startup * 0.3, 30, 62, 'steel'); break;
      case 'shadow_step': this.glint(r, 0, 26, 50); break;
      case 'swallow_cut': if (!this.in3d()) this.glint(r, 0, 24); break; // (PVP 3D: the room's glint at his hand)
      case 'sheathe': this.sheatheGuard(r); break; // (the click is at the release: active)
      case 'sword_wave': if (!this.in3d()) this.glint(r, 0, 34, 80); else for (let k = 0; k < 4; k++) this.petalLook(k); break; // (PVP 3D: the room's glint; its petals' pictures made ready)
      case 'iai_strike': this.iai(r); if (r.petals && !ghost) { const sc = this.scabs.get(r.attackerId); if (sc) sc.drawing = true; } break; // (the blossom draw: the scabbard keeps its petals for the release)
      case 'mirage': this.mirageStance(r); break;
      case 'blossom_storm': if (!ghost) this.blossomStorm(r); break; // (a double's storm: only its cuts — six funnels hid the foe, KAGEMUSHA)
      case 'dragon_eclipse': this.eclipse(r); break;
      case 'kagemusha': this.glint(r, 0, 26, 52); this.petals(this.me(r).x, this.me(r).y - this.me(r).z - 50, 8, 80, { inward: true, life: T.startup + 60 }); break;
      case 'tornado_blade': if (!this.in3d()) this.airSpin(r); break; // (PVP 3D: a ball of blades in the room — fx3d/samurai.ts)
      case 'falcon_dive': this.falcon(r); break;
      case 'rising_sun': this.risingSun(r); this.sunShield(r); break;
      case 'phantom_blades': if (!ghost) this.ctx.darken(T.startup + T.active + 160, 0.38); this.phantomField(r); break;
      case 'god_of_blades': this.halo(r); break;
      case 'sakura_bind': this.bind(r); break;
      case 'dragon_ascension': this.ascension(r); break;
    }
  }

  /** The release (active start). */
  active(r: CastRun): void {
    if (!this.ready) return;
    for (const g of [r, ...this.shadows(r)]) {
      if (g.skill.id === 'shadow_step') this.as(g, () => this.stepStreak(g));
      if (g.skill.id === 'sheathe') this.as(g, () => this.sheathe(g, 0)); // (the guard released: the click)
    }
  }

  /** One hit of a cast as it fires (the swing that goes with it). */
  /** The chain stage of each skill's latest blow (the arena re-times copies of the hits: the hit alone can't tell stage 0
   *  from stage 1 — its confirmation comes right after this). */
  private stageOf = new Map<string, number>();
  hit(r: CastRun, i: number, o: V3): void {
    this.stageOf.set(r.skill.id, r.stage ?? 0);
    if (!this.ready) return;
    this.lastHit.set(r.skill.id, { own: { attackerId: r.attackerId, castId: r.castId, skill: r.skill.id }, at: this.clock }); this.lastAny = this.lastHit.get(r.skill.id)!;
    this.as(r, () => this.hitOne(r, i, o));
    for (const g of this.shadows(r)) this.as(g, () => this.hitOne(g, i, { x: o.x + g.origin.x - r.origin.x, y: o.y + g.origin.y - r.origin.y, z: o.z }));
  }
  private hitOne(r: CastRun, i: number, o: V3): void {
    const s = r.skill, side = sideOf(r), q = this.ctx.casterPos(r.attackerId) ?? o, y0 = q.y - q.z, cam = this.ctx.cam();
    switch (s.id) {
      case 'quick_slash': this.quickSlash(r, i); break;
      case 'swallow_cut': this.swallow(r, i); break;
      case 'iai_strike': if (i === 0) this.iaiCut(r); else this.blossomCut(r, i); break; // (its hits after the draw: the blossom draw's extra cuts)
      case 'hundred_cuts': this.flurry(r, i); break;
      case 'mirage': // the counter cut, from behind: a draw-cut across the attacker — drawn as far as it reaches (its 96 px, ~115 with his width) — in
        // the mirage's rose, a flash of bare steel along it and a white X on the attacker (the counter's mark)
        this.cut(tn('cut_heavy', 'rose'), 120, side * 8, { x: q.x + side * 52, y: y0 - 56, depth: TOP + 3, flipX: side < 0, grow: 60, hold: 60, fade: 220, glow: 0.7 });
        this.spr({ name: tn('blade_trail', 'rose'), x: q.x + side * 44, y: y0 - 52, w: 112, life: 260, flipX: side < 0, angle: side * 6, glow: 0.4, sx: kf([0, 0.6], [0.2, 1, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
        this.spr({ name: tn('cut_line', 'steel'), x: q.x + side * 6, y: y0 - 58, ox: side > 0 ? 0.03 : 0.97, flipX: side < 0, w: 112, h: 14, depth: TOP + 3.2, life: 250, glow: 0.85,
          sx: kf([0, 0.1], [0.16, 1, out3]), sy: kf([0, 1.3], [1, 0.3, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
        this.cut(tn('cut_x', 'steel'), 128, 0, { x: q.x + side * 60, y: y0 - 58, depth: TOP + 3.4, grow: 40, hold: 50, fade: 200, glow: 0.9, sweep: 0 });
        if (r.own) this.ctx.cam().shake(150, 0.005);
        break;
      case 'kagemusha': this.kageVanish(r.origin); break; // he vanishes where he stood (every screen, from the cast)
      case 'falcon_dive': if (i === 1) this.falconImpact(r); else this.cut(tn('cut_thin', 'fire'), 120, side * 30, { x: q.x + side * 30, y: y0 - 40, depth: q.y + 4, flipX: side < 0 }); break;
      case 'rising_sun': this.sunBurst(r); break;
      case 'phantom_blades': this.phantom(r, i); break;
      case 'god_of_blades': this.shock(q.x, q.y, 300, { tone: 'gold' }); this.sparks(q.x, y0 - 80, 12, 120, { tone: 'gold' }); this.auraFlare(r, 'aura_gold', 156, 680); break; // (a size down: it washed him out)
      case 'sakura_bind': this.bloom(r); break;
      case 'dragon_ascension': if (i === 0) this.ascensionBurst(r); else this.cut(tn('cut_thin', 'gold'), 150, rnd(-30, 30), { x: q.x + rnd(-60, 60), y: y0 - 90 - i * 70, depth: TOP + 3, flipX: Math.random() < 0.5 }); break;
      case 'blossom_storm': this.stormCut(r, i); break;
      case 'dragon_eclipse': if (i < r.hits.length - 1) this.eclipseSlash(r, i); else this.eclipseCut(r, o); break;
      case 'tornado_blade': if (i === r.hits.length - 1 && !this.in3d()) { this.pop(tn('burst', 'steel'), q.x + side * 36, y0 - 46, 110, { glow: 0.3 }); this.cut(tn('cut_x', 'steel'), 132, rnd(-10, 10), { x: q.x + side * 36, y: y0 - 46, depth: TOP + 3.5, grow: 35, hold: 40, fade: 160, sweep: 0, glow: 0.35 }); } break; // (the smash down)
    }
    void cam;
  }

  /** The line a hit's cut leaves on the foe (deg on screen, for a swing to the right; null: not a cut — a burst instead). */
  private slashLine(s: FinalSkill, hit: HitEvent): { ang: number; double?: boolean } | null {
    const i = hitIndex(s, hit), R = () => rnd(-60, 60); // (hitIndex: the arena's re-timed copies of the hits too)
    switch (s.id) {
      case 'quick_slash': {
        const k = s.chain?.stages.findIndex((x) => x.includes(hit)) ?? -1, st = k >= 0 ? k : this.stageOf.get(s.id) ?? 0;
        if (st === 1) return { ang: -32 };
        if (st === 2) { const j = s.chain!.stages[2].indexOf(hit); return { ang: (j >= 0 ? j : hit.at > 0 ? 1 : 0) === 0 ? 30 : -30, double: true }; }
        return st === 3 ? { ang: -72 } : { ang: 38 };
      }
      case 'shadow_step': return { ang: 4 };
      case 'swallow_cut': return { ang: i === 1 ? 55 : -70 };
      case 'iai_strike': return { ang: 2 };
      case 'sword_wave': return { ang: 76 };
      case 'hundred_cuts': return hit.heavy ? { ang: 18 } : { ang: R(), double: Math.random() < 0.4 };
      case 'mirage': return { ang: 24 };
      case 'blossom_storm': return { ang: hit.heavy ? -70 : rnd(-50, 50) };
      case 'dragon_eclipse': return { ang: hit.heavy ? 0 : rnd(-80, 80) };
      case 'falcon_dive': return { ang: i === 0 ? 78 : -80 };
      case 'dragon_ascension': return { ang: i === 0 ? -80 : R() };
      case 'god_of_blades': return i === 0 ? null : { ang: rnd(38, 58) }; // (its strikes: the halo's katanas, stabbing down into the foe)
      case 'tornado_blade': case 'phantom_blades': return { ang: R() };
    }
    return null; // (Rising Sun, Sakura Bind, Kagemusha: light, blossoms, ink — no blade)
  }

  /** A confirmed hit on a foe — the class's hit sparks, by the hit's weight, in the skill's own tone: NORMAL a cut of the
   *  blade across it along the swing and a small spark; HEAVY (heavy / signature / ultimate hits) the heavy cut and a burst;
   *  LAUNCH sparks sprayed up after it and a beam from under it; COUNTER (caught in his own swing) the ensō — a circle of ink
   *  brushed round him and a crimson cut through it. `from`: where the blow came from (the cut and the sparks face away from there). */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, reaction: string, heavy: boolean, crit: boolean, from?: { x: number; y: number }, local = false, counter = false): void {
    if (!this.ready) return;
    const lh = this.lastHit.get(s.id), own = lh && this.clock - lh.at < 600 ? lh.own : null; // (its marks belong to the cast whose blow it is)
    this.as(own ? { attackerId: own.attackerId, castId: own.castId, skill: s } : null, () => this.confirmedOne(s, hit, at, reaction, heavy, crit, from, local, counter));
  }
  private confirmedOne(s: FinalSkill, hit: HitEvent, at: V3, reaction: string, heavy: boolean, crit: boolean, from?: { x: number; y: number }, local = false, counter = false): void {
    // the main hit (the same rule as the blow's weight in SkillFx): a heavy one, one that sends the foe flying or down,
    // the last of a burst — its mark big; the small hits of a burst small, so the main one stands out
    const many = s.hits.length > 3, flies = !!(hit.reaction.launch || hit.reaction.knockdown || hit.reaction.slam);
    const main = !!hit.heavy || flies || lastOfBurst(s, hit); // (lastOfBurst: the arena's re-timed copies of the hits too)
    const x = at.x, y = at.y - at.z - 38, rapid = many && !main, side = from && at.x < from.x - 2 ? -1 : 1, tone: Tone | undefined = s.id === 'iai_strike' && !hit.heavy ? 'sakura' : SKILL_TONE[s.id]; // (the blossom draw's extra cuts: sakura)
    if (main && !hit.heavy) heavy = true;
    const line = IN3D_OWN.has(s.id) && this.in3d() ? null : this.slashLine(s, hit), ang = line ? side * line.ang : 0; // (PVP 3D: these skills' blows are the room's — sparks in 3D, no painted mark)
    if (!line && IN3D_OWN.has(s.id) && this.in3d()) { if (counter) this.counterMark(x, y, side, local); return; }
    if (counter) this.counterMark(x, y, side, local);
    if (s.id === 'shadow_step') { // the shadow's cut: a stroke of ink through the foe along the step, ink spattered past it, a blood-red edge
      // (the ink behind him, the blood-red line across him: the foe reads through the cut — DFO, VS CPU)
      this.spr({ name: 'ink_short', x, y, depth: at.y - 1, w: 160, h: 50, angle: side * 4, flipX: side < 0, life: 340,
        sx: kf([0, 0.3], [0.14, 1, out3], [1, 1.08]), sy: kf([0, 1.2], [0.14, 1], [1, 0.55, inQ]), a: kf([0, 0.8], [0.5, 0.7], [1, 0, inQ]) });
      this.spr({ name: tn('cut_line', 'blood'), x, y: y - 2, angle: side * 4, w: 190, h: 12, depth: TOP + 4.2, life: 240, glow: 0.5,
        sx: kf([0, 0.2], [0.14, 1, out3]), sy: kf([0, 1.3], [1, 0.3, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      this.pop('ink_spatter', x + side * 34, y, 90, { depth: at.y - 1.1, life: 360, glow: 0, angle: side > 0 ? rnd(-15, 15) : 180 + rnd(-15, 15) });
    } else if (s.id === 'iai_strike' && !crit) { // the Iai's blow is its hair line (DELAYED below), opening in crimson a beat
      // later — no white burst over the foe at the draw itself (it hid him: PVP 3D quality pass)
    } else if (line) {
      const bs = MARK_SCALE[s.id] ?? 1;
      // (the basic's rising cut, the one that lifts the foe: its mark opens in crimson — steel all chain long, then red)
      const name = tn(crit || (heavy && !rapid) ? 'slash_hit_heavy' : line.double ? 'slash_hit_double' : 'slash_hit', s.id === 'quick_slash' && flies ? undefined : tone);
      const w = bs * (crit ? (rapid ? 170 : 230) : heavy && !rapid ? 196 : rapid ? 112 : line.double ? 160 : 150), life = crit ? 320 : heavy ? 280 : rapid ? 170 : 220;
      this.spr({ name, x, y, depth: TOP + 4, w, life, angle: ang - SLASH_TILT, glow: crit ? 0.45 : heavy ? 0.35 : 0.2,
        sx: kf([0, 0.5], [0.16, 1.06, out3], [1, 1.14]), sy: kf([0, 0.5], [0.16, 1.06, out3], [1, 1.14]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      if (crit) this.pop(tn('burst_crit', tone), x, y, rapid ? 100 : 130, { life: 260, depth: TOP + 3.6, glow: 0.3 });
    } else if (s.id === 'sakura_bind') { // the bind: blossoms burst open on the foe (natural, no spark of a blade)
      this.spr({ name: 'blossom_burst', x, y: y - 4, w: crit ? 120 : 96, life: 440, depth: at.y - 1, angle: rnd(0, 360), glow: 0.12, // (behind the bound foe: SAKURA's hold read through it)
        sx: kf([0, 0.3], [0.25, 1, back], [1, 1.12]), sy: kf([0, 0.3], [0.25, 1, back], [1, 1.12]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
      this.petals(x, y, 10, 64, { depth: TOP + 3 });
    } else if (crit) this.pop(tn('burst_crit', tone), x, y, rapid ? 120 : 165, { life: 300 });
    else if (heavy && !rapid) this.pop(tn('burst', tone), x, y, 140, { life: 280 });
    else this.pop(tn('spark_s', tone), x, y, rapid ? 64 : 86, { life: 190 });
    if (crit) { if (tone === 'sakura') this.petals(x, y, 5, 56, { depth: TOP + 3 }); else this.sparks(x, y, 5, 56, { tone, depth: TOP + 3 }); }
    const up = reaction === 'launch' || reaction === 'float', thrown = up || reaction === 'knockdown' || heavy || (hit.reaction.push ?? 0) >= 14;
    if (thrown && (!rapid || hit.heavy) && reaction !== 'cc') // sparks sprayed the way the foe is thrown (up when it is lifted)
      // (behind the foe: the sparks burst out round his body instead of over it — PVP 3D, DFO's review)
      this.spr({ name: tn('spark_spray', SPRAY_CRIMSON.has(s.id) ? undefined : tone), x: x - side * 8, y, ox: side > 0 ? 0.05 : 0.95, oy: 0.45, flipX: side < 0, depth: at.y - 1, w: (heavy ? 168 : 126) * (SPRAY_SCALE[s.id] ?? 1), life: 260, delay: s.id === 'iai_strike' ? 190 : 0,
        angle: up ? -side * 50 : side * rnd(-6, 10), sx: kf([0, 0.4], [0.25, 1, out3], [1, 1.12]), sy: kf([0, 0.6], [0.25, 1, out3]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    if (reaction === 'launch') this.launchBeam(at.x, at.y, s.id === 'quick_slash' || s.id === 'swallow_cut' ? 88 : 110, tone === 'gold' || tone === 'fire' ? tone : undefined); // (the launchers he uses most: a size down)
    if (reaction === 'knockdown' || reaction === 'slam') { this.crack(at.x, at.y + 2, 120); this.dust(at.x, at.y, 120); }
    if (s.id === 'sakura_bind' && reaction === 'cc') this.bindCatch(at, hit, from);
    if (DELAYED.has(s.id) && hit.heavy) { // the cut arrives late: a thin line stays on the foe a beat — then splits open
      const la = line ? ang : rnd(-28, 28), lw = 196, iai = s.id === 'iai_strike';
      // (the Iai: a hair-thin line of bare steel — then it opens in crimson)
      this.spr({ name: tn('cut_line', iai ? 'steel' : undefined), x, y: y - 4, angle: la, w: lw, h: iai ? 9 : 12, depth: TOP + 5, life: 200, glow: 0.85, sx: kf([0, 0.25], [0.12, 1, out3]), a: kf([0, 1], [0.86, 1], [1, 0]) });
      this.later(190, () => {
        this.cut('cut_split', lw, la, { x, y: y - 4, depth: TOP + 5, grow: 35, hold: 70, fade: 230, glow: 0.8 });
        if (iai) { this.pop('burst', x, y - 4, 112, { life: 260, depth: at.y - 1, glow: 0.25, angle: la }); this.sparks(x, y - 4, 6, 70, { depth: TOP + 3 }); } // (behind him, a size down: SAYA's draw hid the knight)
        else { this.pop('blossom_burst', x, y - 4, 130, { life: 320, depth: TOP + 4.5, glow: 0.3, angle: rnd(0, 360) }); this.petals(x, y, 8, 70, { depth: TOP + 3 }); }
        if (local) { this.ctx.cam().shake(90, 0.004); this.ctx.freeze?.(55); }
      });
    }
  }

  /** COUNTER — the foe caught in his own swing: an ensō, one stroke of ink brushed round him (the brush runs round in a
   *  blink, thick in the middle of its sweep, thin where it starts and lifts off), a crimson cut slashed through it, a white
   *  flash where they cross and crimson sparks. Over the shared COUNTER beat (freeze, flash, callout: LegacyCourtyardScene). */
  private counterMark(x: number, y: number, side: number, local: boolean): void {
    const N = 28, R = 58, SWEEP = 1.72 * Math.PI, DRAW = 110, HOLD = 260, FADE = 240, life = DRAW + HOLD + FADE;
    const a0 = (side > 0 ? -2.3 : -0.84) + rnd(-0.15, 0.15), dir = side > 0 ? 1 : -1;
    const ink = this.strip('ink_long', N), rim = this.strip(this.fname(tn('cut_line', 'blood')), N, { add: true });
    const at = (i: number) => { const th = a0 + dir * SWEEP * (i / (N - 1)); return { x: x + Math.cos(th) * R, y: y + Math.sin(th) * R * 0.86 }; };
    const thick = (i: number) => { const u = i / (N - 1); return 4 + 8 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (u < 0.08 ? u / 0.08 : 1); }; // (a brush stroke the foe reads through)
    ink.rope.setDepth(TOP + 5.4); rim.rope.setDepth(TOP + 5.3);
    this.add({ t: 0, step: (_dt, t) => {
      const d = out(Math.min(1, t / DRAW)), f = t < DRAW + HOLD ? 1 : Math.max(0, 1 - (t - DRAW - HOLD) / FADE);
      const shown = (i: number) => Math.max(0, Math.min(1, (d * (N + 3) - i) / 3)); // (the brush's head runs round; behind it the ink stays)
      ink.set(at, thick, (i) => shown(i) * f * 0.94);
      rim.set(at, (i) => thick(i) * 1.5, (i) => shown(i) * f * 0.35);
      if (t >= life) { ink.destroy(); rim.destroy(); return false; }
      return true;
    } });
    // the crimson cut through it, the flash where it crosses, sparks
    // (lit enough to be the moment, not so much the foe vanishes in it — PVP 3D)
    this.cut('cut_line', 168, -side * 32, { x, y, depth: TOP + 5.6, h: 18, grow: 40, hold: 120, fade: 200, glow: 0.55, sweep: 0, delay: 70 });
    this.pop('glint', x, y, 110, { life: 240, angle: 0, depth: TOP + 5.8, glow: 0.45, delay: 70 });
    this.sparks(x, y, 10, 90, { depth: TOP + 5.2, delay: 70 });
    if (local) this.ctx.cam().shake(110, 0.004);
  }

  /** The Mirage Counter fired: time stops a beat; the blow cuts the mirage where he stood in two — its halves slide apart and
   *  melt into petals — while he is already behind the attacker: his path through it an ink stroke and a line of light,
   *  out of a swirl of ink the flash of his blade (the counter cut comes as its hit). */
  counter(r: CastRun): void {
    const m = this.stances.get(r.castId);
    if (!m || !this.ready) return;
    m.done = true;
    const q = this.me(r), toward = Math.sign(q.x - m.x) || sideOf(r);
    if (r.own) { this.ctx.freeze?.(70); this.ctx.darken(280, 0.32); }
    this.mirageCut(r, m, toward);
    // his path through the attacker: an ink stroke with a line of light along it, petals left hanging in it
    const x0 = m.x, y0 = m.y - m.z - 46, x1 = q.x, y1 = q.y - q.z - 46, L = Math.hypot(x1 - x0, y1 - y0), ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, dd = Math.max(m.y, q.y) + 2;
    if (L > 20) {
      this.spr({ name: 'ink_long', x: x0, y: y0, ox: 0.03, angle: ang, flipY: x1 < x0, w: L + 70, h: 30, depth: Math.min(m.y, q.y) - 2, life: 340, // (behind the attacker it runs through)
        sx: kf([0, 0.25], [0.14, 1, out3]), sy: kf([0, 0.9], [0.14, 1], [1, 0.45, inQ]), a: kf([0, 0.5], [0.4, 0.35], [1, 0, inQ]) });
      this.spr({ name: tn('cut_line', 'rose'), x: x0, y: y0, ox: 0.03, angle: ang, flipY: x1 < x0, w: L + 80, h: 14, depth: dd + 0.1, life: 280, glow: 0.45,
        sx: kf([0, 0.1], [0.18, 1, out3]), sy: kf([0, 1.3], [1, 0.3, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
      for (let k = 0; k < 6; k++) { const f = (k + 0.5) / 6; this.petals(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 1, 18, { depth: dd + 1, life: 800 }); }
    }
    // he steps out behind the attacker: out of a swirl of ink, a flash of the blade, a ring of light at his feet
    this.spr({ name: 'ink_smoke', x: q.x, y: q.y - q.z - 44, depth: q.y - 1, w: 92, life: 320, sx: kf([0, 1.25], [1, 0.5, out]), sy: kf([0, 1.25], [1, 0.5, out]), a: kf([0, 0.5], [1, 0, inQ]), rot: (u) => -80 * u });
    this.pop(tn('glint', 'steel'), q.x + sideOf(r) * 20, q.y - q.z - 56, 130, { life: 240, angle: 0, depth: TOP + 6, glow: 0.45 });
    this.shock(q.x, q.y, 150, { life: 320, tone: 'rose' });
    this.ctx.callout({ x: q.x, y: q.y, z: q.z + 50 }, 'COUNTER!!', '#ff8a96', 0);
    this.ctx.punch(0.035, 220);
  }

  /** The mirage the blow struck: his body as it stood, cut in two at the waist by a line of light — the halves slide apart
   *  (the top one away from the blow, tipping) and melt into petals as they go. */
  private mirageCut(r: CastRun, m: { x: number; y: number; z: number }, toward: number): void {
    const b = this.ctx.body?.(r.attackerId), x = m.x, y = m.y - m.z;
    // a puff of ink where he stood (he is gone from there: the halves are all that is left of him)
    this.spr({ name: 'ink_smoke', x, y: y - 50, depth: m.y - 1, w: 90, life: 400, sx: kf([0, 0.85], [1, 1.35, out3]), sy: kf([0, 0.95], [1, 1.3, out3]), a: kf([0, 0.6], [0.35, 0.45], [1, 0, inQ]), rot: (u) => 50 * u }); // (the attacker stands right at it: behind, lighter)
    if (b) {
      const s = this.ctx.scene, CUT = 0.5;
      const half = (top: boolean) => {
        const im = s.add.image(x, y, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx, b.sy).setFlipX(b.flipX).setTintFill(0xffc2e6).setDepth(m.y - 0.8); // (a ghost of rose light: not him — behind the attacker standing at it)
        if (top) im.setCrop(0, 0, im.width, im.height * CUT); else im.setCrop(0, im.height * CUT, im.width, im.height * (1 - CUT));
        return im;
      };
      const up = half(true), low = half(false), H = up.height * b.sy, cy = y - (b.oy - CUT) * H;
      this.add({ t: 0, step: (_dt, t) => {
        const u = Math.min(1, t / 420), e = out(Math.max(0, (t - 50) / 370)); // (a beat cut through, then the halves part)
        up.setPosition(x - toward * 40 * e, y - 24 * e - 12 * u * u).setAngle(-toward * 14 * e).setAlpha(0.88 * (1 - inQ(u)));
        low.setPosition(x + toward * 10 * e, y + 2 * e).setAngle(toward * 3 * e).setAlpha(0.88 * (1 - inQ(Math.min(1, u * 1.15))));
        if (u >= 1) { up.destroy(); low.destroy(); return false; }
        return true;
      } });
      for (let k = 0; k < 7; k++) this.later(40 + k * 45, () => this.petals(x - toward * rnd(0, 24), cy - rnd(-34, 50), 2, 26, { depth: m.y + 3, life: 900 })); // (melting into petals)
      this.spr({ name: tn('cut_line', 'steel'), x, y: cy, w: 170, h: 16, angle: -toward * 6, depth: m.y + 4, life: 280, glow: 1,
        sx: kf([0, 0.1], [0.15, 1, out3], [1, 1.1]), sy: kf([0, 1.4], [1, 0.2, inQ]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
      this.pop('blossom_burst', x, cy, 96, { depth: m.y + 3.5, life: 360, glow: 0.2, delay: 50 });
    }
    this.petals(x, y - 56, 12, 90, { depth: m.y + 5 });
  }

  // ------------------------------------------------------------------ skills

  /** Quick Slash: the bare blade — thin crescents of cold steel light, the fourth rising. */
  private quickSlash(r: CastRun, i: number): void {
    if (this.in3d()) return; // (PVP 3D: the cuts are ribbons in the room — fx3d/samurai.ts, blade3d.ts)
    const st = r.stage ?? 0, side = sideOf(r), fl = side < 0, S = (n: string) => tn(n, 'steel');
    // (the basic plays all fight long: its cuts a size under the skills' and only lightly lit, so his body move and the foe
    // read through them — quality pass, PVP 3D)
    if (st === 0) this.cut(S('cut_thin'), 98, side * 14, { follow: this.front(r, 44, 54), flipX: fl, glow: 0.2, alpha: 0.75 });
    else if (st === 1) this.cut(S('cut_thin'), 98, -side * 12, { follow: this.front(r, 44, 50), flipX: fl, flipY: true, glow: 0.2, alpha: 0.75 });
    else if (st === 2) {
      this.cut(S('cut_thin'), 106, side * (i === 0 ? 36 : -36), { follow: this.front(r, 48, 56), flipX: fl, flipY: i === 1, glow: 0.2, alpha: 0.75 });
      if (i === 1) { const p = this.front(r, 52, 56)(); if (p) this.pop(S('spark_s'), p.x, p.y, 60, { depth: p.d + 5, glow: 0.3 }); }
    } else {
      this.cut(S('cut_rise'), 128, 0, { follow: this.front(r, 42, 84), flipX: fl, grow: 70, hold: 50, fade: 190, glow: 0.35, alpha: 0.9 });
      const p = this.front(r, 44, 96)(); if (p) this.sparks(p.x, p.y, 7, 60, { tone: 'steel', depth: p.d + 4, up: 30 });
    }
  }

  /** Shadow Step: the ink streak — anchored where he started, its head stays on him through the step, then it dries out. */
  private stepStreak(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, o = r.origin, a = r.aim, side = sideOf(r), D = r.skill.dash?.distance ?? 160;
    if (this.in3d()) { // (PVP 3D: the ink bursts where he vanishes and lands, the line through the foe — fx3d/samurai.ts; his silhouettes stay)
      for (let k = 0; k < 3; k++) { const f = 0.22 + k * 0.24; this.silhouette(r, o.x + a.x * D * f, o.y + a.y * D * f - o.z, o.y + a.y * D * f - 2, 260, { delay: k * 34, face: side, a: kf([0, 0], [0.12, 0.7], [0.4, 0.5], [1, 0, inQ]) }); }
      this.later(T.active, () => this.glint(r, 0, 24, 56), r);
      return;
    }
    const ang = screenAng(a.x, a.y), x0 = o.x - a.x * 34, y0 = o.y - a.y * 34 - o.z - 48, flip = side < 0;
    const ink = s.add.image(x0, y0, KIT, 'ink_long').setOrigin(0.03, 0.55).setAngle(ang).setFlipY(flip).setDepth(o.y - 2).setAlpha(0); // (behind the foe it passes through)
    const line = s.add.image(x0, y0, KIT, 'cut_line').setOrigin(0.03, 0.5).setAngle(ang).setFlipY(flip).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.y + 2.1).setAlpha(0);
    const iw = ink.width, lw = line.width;
    let len = 30;
    this.add({ t: 0, step: (_dt, t) => {
      const c = this.ctx.casterPos(r.attackerId);
      if (t <= T.active + 40 && c) len = Math.min(D + 110, Math.max(len, Math.hypot(c.x - x0, c.y - c.z - 48 - y0) + 50));
      const fade = Math.max(0, (t - T.active) / 420), k = 1 - fade;
      ink.setScale(len / iw, (48 / ink.height) * (0.6 + 0.4 * k)).setAlpha(Math.min(1, t / 40) * k);
      line.setScale(len / lw, (16 / line.height) * k).setAlpha(Math.min(1, t / 40) * Math.max(0, 1 - (t - T.active) / 160));
      if (fade >= 1) { ink.destroy(); line.destroy(); return false; }
      return true;
    } });
    for (let k = 0; k < 3; k++) { // his silhouettes along the path, one after another, fading
      const f = 0.22 + k * 0.24;
      this.silhouette(r, o.x + a.x * D * f, o.y + a.y * D * f - o.z, o.y + a.y * D * f - 2, 300, { delay: k * 34, face: side, a: kf([0, 0], [0.12, 0.8], [0.4, 0.6], [1, 0, inQ]) }); // (behind a foe on the line: he reads through the step)
    }
    this.later(T.active, () => { // he lands: out of a swirl of ink (drops of it flung off), the blade's glint
      const c = this.ctx.casterPos(r.attackerId); if (!c) return;
      this.pop('ink_spatter', c.x - side * 30, c.y - c.z - 40, 80, { depth: c.y - 2, life: 340, glow: 0, angle: side > 0 ? 180 : 0 }); // (behind: the foe he passed stands right there)
      this.spr({ name: 'ink_smoke', x: c.x, y: c.y - c.z - 46, depth: c.y - 1, w: 104, life: 300, sx: kf([0, 1.25], [1, 0.5, out]), sy: kf([0, 1.25], [1, 0.5, out]), a: kf([0, 0.6], [1, 0, inQ]), rot: (u) => -80 * u });
      this.glint(r, 0, 24, 56);
    }, r);
  }

  /** Swallow Cut, read at a glance: one ribbon of light traces the blade — up from the floor in front of him in a rising
   *  crescent that throws the foe up, a flash where it turns at the top, straight back down through the foe in the air
   *  (a Λ: a swallow's tail). */
  private swallow(r: CastRun, i: number): void {
    if (this.in3d()) return; // (PVP 3D: the swallow's tail is the room's two painted crescents and its swallow of light — fx3d/samurai.ts)
    const side = sideOf(r), fl = side < 0, ret = r.skill.hits[1]?.at ?? 130;
    if (i === 0) {
      // the point of the blade: up from his front foot to over the foe, a hook at the top, down to the floor beyond it
      const bz = (u: number, a: number[], c: number[], b: number[]) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
      const tip = (t: number): Pt | null => {
        const c = this.ctx.casterPos(r.attackerId); if (!c) return null;
        const [dx, dy] = t <= ret - 25 ? bz(out(t / (ret - 25)), [34, -8], [42, -140], [84, -200]) : t <= ret ? bz((t - ret + 25) / 25, [84, -200], [96, -214], [98, -196])
          : bz(Math.min(1, (t - ret) / 100), [98, -196], [136, -150], [152, -12]);
        return { x: c.x + side * dx, y: c.y - c.z + dy, d: c.y - 3 }; // (behind both fighters: at its widest it covered the foe — DFO)
      };
      this.trail(tip, { span: 240, w: 40, until: ret + 105, fade: 110, run: r, glow: 0.55 }); // (the swallow's flight, lit so the foe it lifts reads in it — PVP 3D; gone before the chase goes on: MIKAZUKI's jump and crescent)
      this.later(ret - 10, () => { const p = tip(ret - 10); if (p) this.pop('glint', p.x, p.y, 100, { life: 220, angle: 0, depth: p.d + 6, glow: 0.45 }); }, r); // (the turn)
      const cr = this.front(r, 46, 90)(); // (where he cut: following him, it rose with his jump after it — MIKAZUKI)
      if (cr) this.cut('cut_rise', 124, 0, { x: cr.x, y: cr.y, depth: cr.d + 3, flipX: fl, grow: 70, hold: 40, fade: 130, glow: 0.3, alpha: 0.8 });
      const p = this.front(r, 54, 60)(); if (p) this.sparks(p.x, p.y, 7, 50, { depth: p.d + 4, up: 40 });
    } else {
      const ch = this.front(r, 96, 104)();
      if (ch) this.cut('cut_heavy', 140, -side * 32, { x: ch.x, y: ch.y, depth: ch.d + 3, flipX: fl, flipY: true, grow: 45, hold: 40, fade: 130, glow: 0.3, alpha: 0.85 }); // the return: back down through the foe in the air
      const p = this.front(r, 68, 112)(); if (p) this.pop('spark_s', p.x, p.y, 92, { depth: p.d + 5 });
    }
  }

  /** Iai Strike, held: the glint at the hilt grows in three steps (a flare at each); the cut it will leave shows faint on the
   *  floor as far as it will reach (longer and brighter at each step); crimson flames rise round him at the second step and
   *  roar at the full draw. */
  private iai(r: CastRun): void {
    const L = r.skill.charge?.levels; if (!L) return;
    const s = this.ctx.scene, sc = r.chargeScale ?? 1, at = L.map((l) => l.at * sc), a = r.aim, ADD = Phaser.BlendModes.ADD;
    if (this.in3d()) { // PVP 3D (David 18 Oct 18:29): the stillness is the room's (fx3d/samurai.ts: the glint down the scabbard, the
      // reach a hairline on the planks) — no painted flames or flash here; its petals' pictures made ready for the late burst
      for (let k = 0; k < 4; k++) this.petalLook(k);
      let lv = 0;
      this.add({ t: 0, step: () => { if (r.phase !== 'startup') return false; const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0;
        if (nl > lv) { lv = nl; if (r.own) this.ctx.cam().shake(50 + lv * 30, 0.0012 * lv); } return true; } });
      return;
    }
    const lineOf = (lv: number) => L[lv].hits[0].shape as { length: number; width: number };
    const hip = this.front(r, 22, 46); // (the hand on the hilt, in front of his hip)
    const p0 = hip() ?? { x: r.origin.x, y: r.origin.y - 44, d: r.origin.y };
    const star = s.add.image(p0.x, p0.y, KIT, 'glint').setBlendMode(ADD).setDepth(TOP).setScale(0.1);
    const core = s.add.image(p0.x, p0.y, 'dmg-glow').setBlendMode(ADD).setTint(CRIMSON).setDepth(TOP).setDisplaySize(30, 30).setAlpha(0.7);
    const o = r.origin, reach = s.add.image(o.x, o.y, KIT, 'ground_slash').setAngle(screenAng(a.x, a.y)).setFlipY(a.x < -0.01).setDepth(GROUND + 2.2).setAlpha(0);
    const mkA = (add: boolean, crop?: number) => {
      const im = s.add.image(0, 0, KIT, 'aura_crimson').setOrigin(0.5, 0.92).setVisible(false).setBlendMode(add ? ADD : Phaser.BlendModes.NORMAL);
      if (crop) im.setCrop(0, im.height * crop, im.width, im.height * (1 - crop));
      return im;
    };
    const aura = [mkA(false), mkA(true), mkA(false, 0.86)]; // behind him, its glow, the ring's near rim over his feet
    let lv = 0, len = lineOf(0).length, wid = lineOf(0).width, ra = 0, aOn = 0;
    const SIZE = [[0.1, 0.15], [0.19, 0.24], [0.32, 0.4]]; // (the star at the hilt: small, big only at the full draw)
    this.add({ t: 0, step: (dt, t) => {
      if (r.phase !== 'startup') { star.destroy(); core.destroy(); for (const im of aura) im.destroy(); s.tweens.add({ targets: reach, alpha: 0, duration: 120, onComplete: () => reach.destroy() }); return false; }
      const e = r.elapsed, nl = e >= at[2] ? 2 : e >= at[1] ? 1 : 0, q = hip() ?? p0, c = this.me(r);
      if (nl > lv) { // a step up: the glint flares, the reach grows
        lv = nl;
        this.pop('glint', q.x, q.y, 70 + lv * 45, { life: 220, angle: 0, depth: TOP + 1 });
        this.pop('burst', q.x, q.y, 40 + lv * 24, { life: 180, depth: TOP + 1 });
        if (lv === 2) this.sparks(q.x, q.y, 8, 70, { depth: q.d + 5 });
        if (r.own) this.ctx.cam().shake(50 + lv * 30, 0.0012 * lv);
      }
      const ease = Math.min(1, dt / 70); // the reach eases out to this step's length, pulsing faintly
      len += (lineOf(lv).length - len) * ease; wid += (lineOf(lv).width - wid) * ease; ra = Math.min(1, ra + dt / 160);
      reach.setPosition(o.x + a.x * len * 0.5, o.y + a.y * len * 0.5 + 2).setDisplaySize(len, wid * 2).setAlpha(ra * (0.42 + 0.18 * lv) * (0.85 + 0.15 * Math.sin(t / (lv === 2 ? 55 : 110))));
      aOn += ((lv === 0 ? 0 : lv === 1 ? 0.5 : 1) - aOn) * Math.min(1, dt / 120); // the flames
      const fl = lv === 2 ? 0.84 + 0.16 * Math.sin(t / 37) : 0.9 + 0.1 * Math.sin(t / 90), kx = (104 + 44 * aOn) / aura[0].width, ky = kx * (0.9 + 0.14 * aOn + 0.04 * Math.sin(t / 70)), vis = this.seen(r.attackerId);
      aura.forEach((im, i) => im.setVisible(aOn > 0.02).setPosition(c.x, c.y - c.z + 8).setScale(kx * (i === 1 ? 1.04 : 1), ky * (i === 1 ? 1.04 : 1))
        .setDepth(c.y + (i === 2 ? 2.3 : -2.3 + i * 0.01)).setAlpha(aOn * fl * vis * (i === 1 ? 0.45 : i === 2 ? 0.7 : 0.85)));
      const [s0, s1] = SIZE[lv], span = lv === 2 ? 1 : Math.max(1, at[lv + 1] - at[lv]), k = Math.min(1, (e - at[lv]) / span);
      const sz = (s0 + (s1 - s0) * k) * (1 + 0.08 * Math.sin(t / (lv === 2 ? 30 : 60)));
      star.setPosition(q.x, q.y).setScale(sz).setAngle(t * 0.06).setDepth(q.d + 6).setAlpha(0.85 + 0.15 * Math.sin(t / 45));
      core.setPosition(q.x, q.y).setDisplaySize(18 + 44 * sz, 18 + 44 * sz).setDepth(q.d + 5.9);
      return true;
    } });
  }

  /** The draw: his held charge flies down the line as crescents of steel light — two, three, four by the level held (David
   *  18 Oct 22:56) — and the cut arrives on the foe late, splitting open in crimson (SamuraiFx's hit). */
  private iaiCut(r: CastRun): void {
    const sh0 = r.hits[0].shape as { length?: number; range?: number }, lv = r.chargeLevel ?? 0, len = sh0.length ?? sh0.range ?? 200, a = r.aim, side = sideOf(r), q = this.me(r), cam = this.ctx.cam(); // (its draws are projectiles now: their range — DFO 23 Oct)
    const ang = screenAng(a.x, a.y), x0 = q.x + a.x * 8, y0 = q.y + a.y * 4 - q.z - 46, fl = a.x < -0.01;
    // the blossom draw (petals gathered by Sheathe): its line opens pink, as wide as the runtime made it, the petals out of
    // the scabbard along it
    const pb = r.petals ?? 0, base = r.skill.charge?.levels[lv]?.hits[0]?.shape as { width?: number } | undefined;
    const wk = Math.max(1, ((r.hits[0].shape as { width?: number }).width ?? 1) / (base?.width ?? (r.hits[0].shape as { width?: number }).width ?? 1));
    if (pb) this.blossomDraw(r, x0, y0, ang, len);
    if (!this.in3d()) { // (PVP 3D: the draws are the room's painted crescents — fx3d/samurai.ts)
    // (David 18 Oct 22:56: "a charge, then 4 such nice shots") his held charge flies down the line as crescents of steel
    // light, two, three, four by the level held, one after another at their own heights
    const rad = (ang * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad), far = len * 1.05;
    for (let k = 0; k < 2 + lv; k++) this.spr({ name: tn('wave_crescent', 'steel'), x: x0, y: y0 + [0, -12, 9, -5][k], ox: 0.76, angle: ang, flipY: fl, w: (84 + 14 * lv) * Math.min(1.4, wk), delay: k * 70, life: far / 1.5, glow: 0.6, depth: TOP + 3.2, tint: pb ? 0xffb8dc : undefined,
      mx: (u) => cs * far * u, my: (u) => sn * far * u, sx: kf([0, 0.5], [0.12, 1, out3]), a: kf([0, 1], [0.8, 1], [1, 0, inQ]) });
    this.pop(tn('burst', 'steel'), x0 + side * 18, y0, 70 + 20 * lv, { life: 200, glow: 0.35 }); // (a size down: white between them through the draw — SAYA)
    this.spr({ name: tn('blade_trail', 'steel'), x: x0 + a.x * 36, y: y0 + a.y * 18, w: 170 + 30 * lv, life: 230, flipX: fl, angle: along(ang, fl), glow: 0.4, // the trail of the draw
      sx: kf([0, 0.6], [0.2, 1, out3], [1, 1.08]), sy: kf([0, 0.8], [0.2, 1], [1, 0.6, inQ]), a: kf([0, 0.95], [0.4, 0.8], [1, 0, inQ]) });
    }
    if (lv === 2 && this.in3d()) { if (r.own) { cam.shake(200, 0.007); this.ctx.punch(0.035, 220); this.ctx.darken(220, 0.45); this.ctx.freeze?.(60); } } // (PVP 3D: the planks scored by the room's pieces)
    else if (lv === 2) { // fully drawn: the floor is cut too, a shockwave runs down it, dust where the foes go down
      this.spr({ name: 'ground_slash', x: q.x + a.x * len * 0.52, y: q.y + a.y * len * 0.52 + 2, angle: ang, flipY: fl, w: len * 0.95, depth: GROUND + 2.2, life: 1500, delay: 60, glow: 0.5,
        sx: kf([0, 0.1], [0.1, 1, out3]), sy: kf([0, 1.4], [0.1, 1]), a: kf([0, 1], [0.55, 1], [1, 0, inQ]) });
      this.crack(q.x + a.x * len * 0.5, q.y + a.y * len * 0.5, len * 0.95, Math.atan2(a.y, a.x) * (180 / Math.PI));
      this.shock(q.x + a.x * len * 0.6, q.y + a.y * len * 0.6, 180);
      for (let i = 0; i < 4; i++) this.dust(q.x + a.x * len * (0.25 + 0.22 * i), q.y + a.y * len * (0.25 + 0.22 * i), 90, 110 + i * 40);
      if (r.own) { cam.shake(200, 0.007); this.ctx.punch(0.035, 220); this.ctx.darken(220, 0.45); this.ctx.freeze?.(60); } // the world stops for the full draw (his screen)
    } else if (r.own) cam.shake(90 + lv * 40, 0.002 + lv * 0.0015);
    if (!this.in3d()) this.later(r.timings.active + r.timings.recovery * 0.6, () => this.glint(r, 0, 22, 44));   // the blade clicks back into its sheath (PVP 3D: the room's glint)
  }

  /** Sheathe (David 18 Oct 01:15, "the substitute"): his guard while it is held — the blade raised over his shoulder (his
   *  own body move, PixVerse), a thin ring of white-hot light at his feet, pulsing (PVP 3D: a ribbon ring lying on the
   *  planks; the painted world: the crimson timer ring); it goes when the guard is released (the click) or broken. A blow
   *  landing on it is taken by the doll (`substitute`, DFO's engine calls it). */
  private sheatheGuard(r: CastRun): void {
    const s = this.ctx.scene, id = r.attackerId, held = () => r.phase === 'startup' && !this.gone(r);
    const feet = () => { const c = this.ctx.casterPos(id); return c ? { x: c.x, y: c.y, z: 0 } : null; };
    const f3 = this.fx3d(), c0 = feet(); if (!c0) return;
    if (f3) { ring3(f3, c0, sideOf(r), { r: 64, w: 9, y0: 3, tilt: 0, a0: -179, a1: 179, ms: 6000, sweep: 0.025, fill: 1, inkW: 0.2, lit: SAM3.rose, gain: 1.1, quiet: true, follow: feet, until: () => !held(), fade: 160 }); return; }
    const im = s.add.image(c0.x, c0.y, KIT, this.fname('timer_ring')).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    im.setScale(130 / im.width, 130 / im.width * 0.42);
    let gone = -1;
    this.add({ t: 0, step: (_dt, t) => {
      const c = feet();
      if (gone < 0 && (!held() || !c)) gone = t;
      const k = gone < 0 ? Math.min(1, t / 120) : Math.max(0, 1 - (t - gone) / 160);
      if (c) im.setPosition(c.x, c.y - 2).setDepth(c.y - 2.5);
      im.setAlpha(k * (0.55 + 0.25 * Math.sin(t / 140)));
      if (gone >= 0 && t - gone >= 160) { im.destroy(); return false; }
      return true;
    } });
  }
  /** Sheathe's substitute (DFO's engine calls it as a blow lands on his guard): a straw-and-wood doll in his cloth stands
   *  where he was and takes the blow — it jolts, a white-hot flash where it is struck, and breaks in two (its top thrown
   *  off spinning, its post tipping over), straw and splinters flying; a burst of ink where he vanished (he is unseen now:
   *  the engine's). */
  substitute(id: string, at?: V3): void {
    if (!this.ready) return;
    const c = at ?? this.ctx.casterPos(id); if (!c) return;
    const s = this.ctx.scene, b = this.ctx.body?.(id), fl = b?.flipX ?? false, dir = fl ? -1 : 1, x = c.x, y = c.y - c.z + 2, d = c.y;
    const fr = s.textures.getFrame(KIT, 'doll'); if (!fr) return;
    const H = 172, k = H / (fr.cutHeight || fr.height), W = (fr.cutWidth || fr.width) * k, CUT = 0.42; // (the break: 42% down, at the sash)
    const half = (top: boolean) => { const im = s.add.image(x, y, KIT, 'doll').setOrigin(0.5, 1).setScale(k).setFlipX(fl).setDepth(d - 0.5);
      const fh = fr.cutHeight || fr.height, fw = fr.cutWidth || fr.width;
      if (top) im.setCrop(0, 0, fw, fh * CUT); else im.setCrop(0, fh * CUT, fw, fh * (1 - CUT));
      return im; };
    const top = half(true), bot = half(false);
    this.pop('glint', x + dir * 6, y - H * 0.55, 120, { life: 200, angle: 0, depth: d + 1, glow: 0.6 }); // (where the blow lands on it)
    this.sparks(x, y - H * 0.55, 8, 70, { depth: d + 1 });
    const BREAK = 170, END = 900;
    this.add({ t: 0, step: (_dt, t) => {
      const jolt = t < BREAK ? Math.sin(t / 18) * 4 * (1 - t / BREAK) : 0, u = Math.max(0, (t - BREAK) / (END - BREAK)), a = t > END - 260 ? Math.max(0, (END - t) / 260) : 1;
      top.setPosition(x - dir * (jolt + 90 * u), y - 150 * u + 260 * u * u).setAngle(-dir * 260 * u).setAlpha(a); // (thrown off, spinning, falling)
      bot.setPosition(x - dir * jolt * 0.5, y).setAngle(-dir * 84 * Math.min(1, Math.pow(u * 1.6, 2))).setAlpha(a); // (the post tips over onto the planks)
      if (t >= END) { top.destroy(); bot.destroy(); return false; }
      return true;
    } });
    this.later(BREAK, () => { // it breaks: straw and splinters
      for (let i = 0; i < 14; i++) this.spr({ name: 'spark_s', x: x + rnd(-14, 14), y: y - H * rnd(0.3, 0.6), w: rnd(10, 18), life: rnd(380, 620), tint: i % 2 ? 0xd8b070 : 0x8a5a34, depth: d + 0.5,
        mx: ((dx) => (u: number) => dx * out(u))(rnd(-70, 70) - dir * 30), my: ((dy) => (u: number) => dy * out(u) + 90 * u * u)(rnd(-90, -20)), angle: rnd(0, 360), rot: (u) => 300 * u, a: kf([0, 1], [0.7, 1], [1, 0]) });
      this.dust(x, c.y, 90);
    });
    // he vanishes: a burst of ink where he stood
    const f3 = this.fx3d();
    if (f3) { inkBurst3(f3, { x, y: c.y, z: c.z + 64 }, { r: 96, n: 12, ms: 440, foeY: c.y - 40 }); f3.debris(x, c.y, 8, { speed: 0.9, up: 1.2, dir: -dir }); }
    else { this.pop('ink_burst', x, y - 70, 150, { depth: d + 2, life: 420, glow: 0, angle: rnd(-10, 10) }); this.spr({ name: 'ink_smoke', x, y: y - 64, depth: d + 1.5, w: 130, life: 560, sx: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.5]), sy: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.4]), a: kf([0, 0.75], [0.4, 0.6], [1, 0, inQ]), rot: (u) => 70 * u, my: (u) => -24 * u }); }
    this.petals(x, y - 70, 10, 90, { depth: d + 2, life: 900 });
  }
  /** Sheathe's substitute, the end: he comes back out of a small burst of ink, his blade's glint (DFO's engine calls it). */
  reappear(id: string, at?: V3): void {
    if (!this.ready) return;
    const c = at ?? this.ctx.casterPos(id); if (!c) return;
    const f3 = this.fx3d(), x = c.x, y = c.y - c.z;
    if (f3) inkBurst3(f3, { x, y: c.y, z: c.z + 58 }, { r: 70, n: 8, ms: 360, foeY: c.y - 40 });
    else this.spr({ name: 'ink_smoke', x, y: y - 50, depth: c.y - 1, w: 110, life: 340, sx: kf([0, 1.2], [1, 0.5, out]), sy: kf([0, 1.2], [1, 0.5, out]), a: kf([0, 0.7], [1, 0, inQ]), rot: (u) => -80 * u });
    this.pop('glint', x, y - 56, 90, { life: 220, angle: 0, depth: c.y + 2, glow: 0.4 });
  }

  /** Sheathe: the blade snaps home in its sheath — at the click (the guard's release) a sharp glint at the sheath's mouth
   *  under his hand, a flash running back along the scabbard, a few sparks, and a small crimson ring at his feet. */
  private sheathe(r: CastRun, at = r.timings.startup): void {
    const side = sideOf(r), f = this.front(r, 14, 52), G = (n: string) => n; // (his crimson: David's bar, one colour family — it was gold)
    const mouth = () => { const h = this.ctx.hand(r.attackerId), p = f(); return h && p ? { x: h.x, y: h.y + 4, d: p.d } : p; };
    // the click, in gold — read from across the arena: a bright four-pointed flash at the sheath's mouth, a streak of light
    // running back along the scabbard, a spray of gold sparks, a ring of gold at his feet
    this.spr({ name: 'glint', w: 96, delay: at, life: 300, run: r, glow: 1, dz: 6, follow: mouth,
      sx: kf([0, 0.3], [0.14, 1.3, out3], [1, 0.45]), sy: kf([0, 0.3], [0.14, 1.3, out3], [1, 0.45]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]), rot: (u) => 45 * (1 - out(u)) });
    this.spr({ name: G('cut_line'), w: 120, h: 12, delay: at, life: 220, run: r, glow: 1, dz: 5, follow: mouth, ox: side > 0 ? 1 : 0, flipX: side < 0, angle: -side * 14, // (back and down along the scabbard)
      sx: kf([0, 0.15], [0.3, 1, out3]), sy: kf([0, 1.4], [1, 0.4, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
    for (let i = 0; i < 8; i++) {
      const a = rnd(-160, -20) * (Math.PI / 180), d = rnd(22, 50), tx = Math.cos(a) * d * side, ty = Math.sin(a) * d;
      this.spr({ name: G('spark_s'), w: rnd(12, 20), delay: at, life: rnd(200, 300), run: r, glow: 0.9, dz: 7, follow: mouth, angle: rnd(0, 360), mx: (u) => tx * out(u), my: (u) => ty * out(u) + 14 * u * u, a: kf([0, 1], [1, 0, inQ]) });
    }
    this.later(at, () => { const c = this.me(r); this.shock(c.x, c.y, 130, { life: 340 }); }, r);
    // primed (the next Iai / Quick Slash comes out at once): a small gold star stays at the hilt, pulsing, through the window
    const win = r.skill.primes?.windowMs ?? 600, from = at + r.timings.active;
    this.spr({ name: 'glint', w: 34, delay: from, life: win, run: r, glow: 0.9, dz: 6, follow: mouth, flick: 90,
      sx: (u) => 0.75 + 0.25 * Math.sin(u * 22), sy: (u) => 0.75 + 0.25 * Math.sin(u * 22), a: kf([0, 0], [0.08, 0.95], [0.8, 0.8], [1, 0]), rot: (u) => 90 * u });
  }

  /** Hundred Cuts, a storm of swords: a cage of spectral katanas whirls round the foe while katanas of light fly through
   *  it from every side, three at each cut, each leaving its cut line; at the last cut the cage stops, turns its points in
   *  and slams into the foe — which bursts in a cross of light. */
  private flurry(r: CastRun, i: number): void {
    const side = sideOf(r), f = this.front(r, 84, 62), q = this.me(r), c = f() ?? { x: q.x + side * 84, y: q.y - q.z - 62, d: q.y }, last = i >= r.skill.hits.length - 1;
    if (i === 0) this.swordCage(r, f);
    if (!last) {
      for (let n = 0; n < (i % 3 === 2 ? 2 : 1); n++) { // katanas of light through the foe, one after another (one a cut, two
        // every third; their streaks short and faint: in a burst of twelve both fighters read through the cage — PVP 3D)
        const th = rnd(0, Math.PI * 2), R0 = rnd(118, 150), ox = rnd(-12, 12), oy = rnd(-16, 12), dx = Math.cos(th), dy = Math.sin(th) * 0.6;
        this.flyBlade(c.x + ox - dx * R0, c.y + oy - dy * R0, c.x + ox + dx * R0, c.y + oy + dy * R0, { delay: n * 30, life: 120, depth: c.d + 5 + n * 0.02, run: r, streak: 0.4, faint: 0.5 });
      }
      if (i % 2 === 0) this.cut(tn('cut_thin', 'steel'), rnd(84, 104), rnd(0, 360), { x: c.x + rnd(-26, 26), y: c.y + rnd(-22, 18), depth: c.d + 5.5, grow: 28, hold: 16, fade: 90, glow: 0.2, sweep: 20, alpha: 0.7 });
      if (i % 3 === 1) this.pop(tn('spark_s', 'gold'), c.x + rnd(-18, 18), c.y + rnd(-18, 18), 64, { life: 150, depth: c.d + 6 }); // (steel on steel: gold sparks)
      return;
    }
    // the cage has slammed in: a cross of steel light bursts out of the foe, gold sparks thrown off
    this.cut(tn('cut_x', 'steel'), 190, rnd(-10, 10), { x: c.x, y: c.y, depth: TOP + 4, grow: 50, hold: 80, fade: 240, glow: 0.35 });
    this.pop(tn('burst_crit', 'gold'), c.x, c.y, 150, { life: 320, depth: TOP + 4.5, glow: 0.2 });
    this.shock(c.x, q.y, 240, { tone: 'steel' });
    this.sparks(c.x, c.y, 12, 120, { tone: 'gold', depth: TOP + 3 });
    for (let k = 0; k < 6; k++) { const th = (k / 6) * Math.PI * 2 + rnd(-0.2, 0.2); this.flyBlade(c.x, c.y, c.x + Math.cos(th) * 170, c.y + Math.sin(th) * 100, { life: 200, depth: TOP + 3.5, len: 96 }); } // (shards of the cage thrown out)
    if (r.own) { this.ctx.cam().shake(200, 0.007); this.ctx.punch(0.04, 240); }
  }

  /** A crimson katana flying straight from (x0, y0) to (x1, y1), point first, two ghostly afterimages behind it, the cut
   *  it leaves along its line. */
  private flyBlade(x0: number, y0: number, x1: number, y1: number, o: { delay?: number; life?: number; depth?: number; run?: CastRun; len?: number; streak?: number; faint?: number } = {}): void {
    const L = o.len ?? 112, kw = (L * 89) / 400, ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life = o.life ?? 120, d = o.depth ?? TOP + 3, dl = o.delay ?? 0;
    const mx = (u: number) => (x1 - x0) * u, my = (u: number) => (y1 - y0) * u;
    for (let k = 0; k < 3; k++)
      this.spr({ name: tn(k === 0 ? 'katana' : 'katana_ghost', 'steel'), x: x0, y: y0, w: kw, h: L, angle: ang + 90, life, delay: dl + k * 16, depth: d - k * 0.01, run: o.run, add: k > 0, glow: k === 0 ? 0.3 : undefined,
        mx, my, a: k === 0 ? kf([0, 0], [0.12, 1], [0.82, 1], [1, 0]) : kf([0, 0], [0.12, (0.4 - k * 0.12) * (o.faint ?? 1)], [0.8, (0.3 - k * 0.1) * (o.faint ?? 1)], [1, 0]) });
    const len = Math.hypot(x1 - x0, y1 - y0), fa = o.faint ?? 1;
    this.spr({ name: tn('cut_line', 'steel'), x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: ang, w: len * (o.streak ?? 0.9), h: fa < 1 ? 9 : 12, delay: dl + life * 0.35, life: 170, depth: d - 0.05, glow: 0.7 * fa, run: o.run,
      sx: kf([0, 0.2], [0.25, 1, out3]), sy: kf([0, 1], [1, 0.3, inQ]), a: kf([0, 0.95 * fa], [1, 0, inQ]) });
  }

  /** The cage of swords round the foe through Hundred Cuts: eight spectral katanas whirling round it (the near ones in front
   *  of it, the far ones behind), points along the turn; before the last cut they stop, turn their points in and slam into
   *  it as it lands. */
  private swordCage(r: CastRun, f: () => Pt | null): void {
    const s = this.ctx.scene, N = 8, fin = r.skill.hits[r.skill.hits.length - 1]?.at ?? 1000, TURN = fin - 150, IN = fin - 45, KL = 118, ADD = Phaser.BlendModes.ADD;
    const mk = (add: boolean) => { const im = s.add.image(0, 0, KIT, this.fname(tn(add ? 'katana_ghost' : 'katana', 'steel'))).setVisible(false); if (add) im.setBlendMode(ADD); return im.setScale(KL / im.height); };
    const bl = Array.from({ length: N }, (_, k) => ({ im: mk(false), gl: mk(true), th0: (k / N) * Math.PI * 2 }));
    let last: Pt = f() ?? { x: 0, y: 0, d: 0 }, stopAt = 0;
    const kill = () => { for (const b of bl) { b.im.destroy(); b.gl.destroy(); } };
    this.add({ t: 0, step: (_dt, t) => {
      if (this.gone(r) || (r.phase === 'done' && t < fin) || t >= fin) { kill(); return false; } // (broken off, or slammed in)
      const p = f() ?? last; last = p;
      const spin = t < TURN ? t * 0.012 : (stopAt ||= TURN * 0.012) + (1 - Math.pow(1 - Math.min(1, (t - TURN) / 90), 2)) * 0.5; // (the whirl stops)
      const grow = Math.min(1, t / 140), rad = t < IN ? (40 + 56 * out(grow)) * (1 + 0.05 * Math.sin(t / 55)) : 96 * (1 - inQ(Math.min(1, (t - IN) / 45)));
      const turnIn = t < TURN ? 0 : out(Math.min(1, (t - TURN) / 80));
      bl.forEach((b) => {
        const th = b.th0 + spin, sn = Math.sin(th), x = p.x + Math.cos(th) * rad, y = p.y + sn * rad * 0.42;
        const along = (Math.atan2(Math.cos(th) * 0.42, -Math.sin(th)) * 180) / Math.PI + 90, inward = (Math.atan2(p.y - y, p.x - x) * 180) / Math.PI + 90;
        const ang = along + Phaser.Math.Angle.ShortestBetween(along, inward) * turnIn, al = grow * (sn > 0 ? 1 : 0.6);
        b.im.setVisible(true).setPosition(x, y).setAngle(ang).setDepth(p.d + (sn > 0 ? 4 : -4)).setAlpha(0.95 * al);
        b.gl.setVisible(true).setPosition(x, y).setAngle(ang).setDepth(p.d + (sn > 0 ? 4.01 : -3.99)).setAlpha(0.3 * al);
      });
      return true;
    } });
  }

  /** A foe hits the floor (knocked down, or down from the air): a ring and puffs of dust the colour of the ground. */
  landing(x: number, y: number): void { if (!this.ready) return; this.dustRing(x, y, 150); this.dust(x, y, 104); }
  /** A foe skidding back: a small puff of dust behind it. */
  skid(x: number, y: number): void {
    if (!this.ready) return;
    this.spr({ name: 'dust', x, y, oy: 0.85, depth: y + 2, w: 50, life: 380, tint: DUST, sx: kf([0, 0.5], [1, 1.2, out3]), sy: kf([0, 0.5], [1, 1.1, out3]), a: kf([0, 0.7], [1, 0, inQ]), my: (u) => -6 * u });
  }

  /** Kagemusha: he vanishes in a burst of ink and petals (a swirl of ink where he stood). */
  kageVanish(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    // (a size down and just behind his spot: a foe beside him reads in front of the ink — DFO, VS CPU)
    if (!this.in3d()) this.pop('ink_burst', x, y - 48, 160, { depth: at.y - 1, life: 440, glow: 0, angle: rnd(-10, 10) }); // (PVP 3D: the room's ink burst)
    if (!this.in3d()) this.spr({ name: 'ink_smoke', x, y: y - 46, depth: at.y - 1.5, w: 120, life: 600, sx: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.5]), sy: kf([0, 0.5], [0.3, 1.1, out3], [1, 1.4]),
      a: kf([0, 0.75], [0.4, 0.6], [1, 0, inQ]), rot: (u) => 70 * u, my: (u) => -24 * u });
    this.petals(x, y - 50, 22, 140, { depth: at.y + 6, life: 1100 });
    this.ctx.punch(0.02, 140);
  }
  /** One of the three steps out of a swirl of ink. */
  kageAppear(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'ink_smoke', x, y: y - 44, depth: at.y - 1, w: 120, life: 420, sx: kf([0, 1.25], [1, 0.55, out]), sy: kf([0, 1.25], [1, 0.55, out]),
      a: kf([0, 0.7], [0.5, 0.45], [1, 0, inQ]), rot: (u) => -90 * u });
    this.petals(x, y - 46, 7, 64, { depth: at.y + 5 });
  }
  /** A double bursts into petals (struck — the blow is wasted — or at the AMBUSH). */
  kageBurst(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'blossom_cluster', x, y: y - 48, depth: at.y + 6, w: 70, life: 380, angle: rnd(-20, 20), glow: 0.3,
      sx: kf([0, 0.4], [0.25, 1.15, out3], [1, 1.3]), sy: kf([0, 0.4], [0.25, 1.15, out3], [1, 1.3]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    this.pop('ink_spatter', x, y - 46, 90, { depth: at.y - 1, life: 300, glow: 0 }); // (struck next to the foe: behind, smaller)
    this.petals(x, y - 52, 28, 120, { depth: at.y + 6, life: 1150 });
  }
  /** A double's feint: a quick cut in the air in front of it, as it swings (stage: which of the four cuts). */
  kageFeint(at: V3, face: number, stage: number): void {
    if (!this.ready) return;
    const fl = face < 0, x = at.x + face * 46, y = at.y - at.z - 54;
    if (stage === 2) this.cut('cut_rise', 104, 0, { x, y: y - 20, depth: at.y + 4, flipX: fl, delay: 75, grow: 60, hold: 35, fade: 150 });
    else this.cut('cut_thin', 124, face * (stage === 1 ? -12 : 14), { x, y, depth: at.y + 4, flipX: fl, flipY: stage === 1, delay: 75, glow: 0.5 });
  }
  /** A double melts back into ink (time is up, or he was struck). */
  kageFade(at: V3): void {
    if (!this.ready) return;
    const x = at.x, y = at.y - at.z;
    this.spr({ name: 'ink_smoke', x, y: y - 44, depth: at.y + 5, w: 112, life: 520, sx: kf([0, 0.6], [1, 1.3, out3]), sy: kf([0, 0.6], [1, 1.3, out3]),
      a: kf([0, 0.85], [1, 0, inQ]), rot: (u) => 50 * u, my: (u) => -16 * u });
    this.petals(x, y - 46, 5, 50, { depth: at.y + 5 });
  }

  /** Mirage Counter's stance: copies of him trembling round him like a heat haze, petals hanging still in the air round
   *  his waist, a ring under him shrinking as the window runs out (so everyone sees how long it lasts). A blow that comes
   *  in hits only the mirage (`counter`); if none comes, the copies fold back into him, the petals drop, the ring breaks. */
  private mirageStance(r: CastRun): void {
    const o = r.origin, T = r.timings, win = r.skill.counter?.window ?? 420, end = T.startup + win, s = this.ctx.scene, ADD = Phaser.BlendModes.ADD;
    this.stances.set(r.castId, { x: o.x, y: o.y, z: o.z, done: false });
    this.glint(r, 0, 22, 56, 'rose');
    const offs: [number, number, number, number][] = [[-22, -2, 0.42, 0xff4fae], [21, 1, 0.38, 0xff4fae], [-11, -8, 0.32, 0xffd2ee], [12, -6, 0.26, 0xff86c8], [0, -15, 0.2, 0xffd2ee]]; // (rose haze)
    const imgs = offs.map(() => s.add.image(0, 0, KIT, 'glint').setBlendMode(ADD).setVisible(false));
    const petals = Array.from({ length: 7 }, (_, i) => {
      const im = s.add.image(0, 0, KIT, `petal_${1 + (i % 4)}`).setVisible(false);
      return { im: im.setScale(rnd(14, 19) / im.width), th: (i / 7) * Math.PI * 2 + rnd(-0.3, 0.3), h: rnd(34, 96), rad: rnd(40, 60), sp: (i % 2 ? 1 : -1) * rnd(0.5, 0.8), rot: rnd(0, 360) };
    });
    const rn = this.fname(tn('timer_ring', 'rose'));
    const ring = s.add.image(0, 0, KIT, rn).setVisible(false), rg = s.add.image(0, 0, KIT, rn).setBlendMode(ADD).setVisible(false), rk = 150 / ring.width;
    // its name over his head for as long as the window is open (so it reads what it is — on every screen: in a duel too)
    const label = s.add.text(0, 0, 'COUNTER STANCE', { fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold italic', fontSize: '22px', color: '#ffc2e8', stroke: '#1a0210', strokeThickness: 5, resolution: 2 })
      .setOrigin(0.5).setDepth(TOP + 29).setVisible(false);
    this.auraFlare(r, tn('aura_crimson', 'rose'), 150, end + 120, 0, () => this.stances.get(r.castId)?.done ?? true); // (they end as the counter strikes: they burned on over it — MIRAGE, filmed)
    const kill = () => { for (const im of [...imgs, ring, rg, ...petals.map((p) => p.im)]) im.destroy(); label.destroy(); };
    let fold = -1; // (the window ran out with no blow: ms since)
    this.add({ t: 0, step: (dt, t) => {
      const st = this.stances.get(r.castId), c = this.ctx.casterPos(r.attackerId), b = this.ctx.body?.(r.attackerId);
      if (!st || st.done || !c || !b || this.gone(r) || (r.phase === 'done' && fold < 0 && r.elapsed < end)) { kill(); return false; } // (struck: the counter draws the rest)
      if (fold < 0 && (r.elapsed >= end || r.phase === 'done')) { fold = 0; this.petals(c.x, c.y - c.z - 40, 6, 50, { depth: c.y + 3 }); }
      if (fold >= 0) fold += dt;
      if (fold > 300) { kill(); return false; }
      const vis = this.seen(r.attackerId), on = Math.min(1, t / 110) * vis, f = fold < 0 ? 0 : Math.min(1, fold / 170), gone = fold < 0 ? 1 : 1 - Math.min(1, fold / 240);
      const head = (this.ctx.targetPos?.(r.attackerId) as { h?: number } | null)?.h ?? 110, pop = Math.min(1, t / 130);
      label.setVisible(true).setPosition(c.x, c.y - c.z - head - 24 - 8 * out(pop)).setScale(1.25 - 0.25 * back(pop)).setAlpha(on * gone);
      imgs.forEach((im, k) => { // the copies (folding back into him at the end)
        const [dx, dy, al0, col] = offs[k], al = Math.min(0.75, al0 * 1.45), j = (Math.sin(t / 21 + k * 2.1) * 3.4 + Math.sin(t / 47 + k) * 2) * (1 - f), fl = 0.7 + 0.3 * Math.sin(t / 33 + k * 1.7);
        if (im.texture.key !== b.key || im.frame.name !== String(b.frame)) im.setTexture(b.key, b.frame);
        im.setOrigin(b.ox, b.oy).setScale(b.sx * (1 + 0.03 * Math.sin(t / 40 + k)), b.sy).setFlipX(b.flipX).setTintFill(col)
          .setPosition(c.x + (dx + j) * (1 - out(f)), c.y - c.z + dy * (1 - out(f))).setDepth(c.y - 0.5).setAlpha(on * al * fl * gone).setVisible(true);
      });
      petals.forEach((p) => { // hanging still round his waist, turning slowly — dropping at the end
        const th = p.th + t * 0.0022 * p.sp, sn = Math.sin(th), drop = fold < 0 ? 0 : Math.pow(fold / 300, 2) * (p.h + 10);
        p.im.setVisible(true).setPosition(c.x + Math.cos(th) * p.rad, c.y - c.z - p.h + sn * p.rad * 0.3 + drop).setDepth(c.y + (sn > 0 ? 3 : -3)).setAngle(p.rot + t * 0.04 * p.sp).setAlpha(on * Math.min(1, gone * 1.4));
      });
      const w = r.elapsed < T.startup ? 0.55 + 0.45 * out(r.elapsed / Math.max(1, T.startup)) : 1 - 0.62 * Math.min(1, (r.elapsed - T.startup) / win); // (the ring: shrinking as the window runs out)
      const rk2 = rk * w * (fold < 0 ? 1 : 1 + 0.5 * f);
      ring.setVisible(true).setPosition(c.x, c.y - c.z + 2).setScale(rk2).setDepth(c.y - 1).setAlpha(on * 0.95 * gone);
      rg.setVisible(true).setPosition(c.x, c.y - c.z + 2).setScale(rk2 * 1.03).setDepth(c.y - 0.99).setAlpha(on * gone * (0.45 + 0.2 * Math.sin(t / 50)));
      return true;
    } });
    this.spr({ name: tn('shock_ring', 'rose'), w: 120, life: 360, run: r, glow: 0.6, follow: () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z, d: c.y } : null; },
      dz: -2, sx: kf([0, 0.3], [1, 1.1, out3]), sy: kf([0, 0.3], [1, 1.1, out3]), a: kf([0, 0.8], [1, 0, inQ]) });
    this.later(end + 400, () => this.stances.delete(r.castId));
  }

  /** Blossom Storm: petals gather through the wind-up, then a storm of them whirls round him as he chases. */
  private blossomStorm(r: CastRun): void {
    const T = r.timings, q = this.me(r);
    this.petals(q.x, q.y - q.z - 56, 16, 140, { inward: true, life: T.startup + 80, depth: q.y + 4 });
    const f3 = this.fx3d();
    if (f3) { // PVP 3D (David's bar: what has volume is 3D): the storm is real petals whirling round him in the room, rising, in front of and behind him by depth (DFO's swirl) — no flat painted funnel or ring
      this.later(T.startup, () => {
        const on = () => { const c = this.ctx.casterPos(r.attackerId); return c && !this.broken(r) && !this.gone(r) ? { x: c.x, y: c.y, z: c.z } : null; };
        for (let k = 0; k < 2; k++) { const look = this.petalLook(k * 2); if (look) f3.swirl(on, look, { n: 24, r0: 44, r1: 116, h: 210, ms: T.active + 160, rps: 1.15, rise: 0.6, size: 1.6 }); }
      }, r);
      return;
    }
    for (const [crop, z] of [[undefined, -3], [0.5, 3]] as const) // a ring of petals whirling round his waist through the chase
      this.spr({ name: tn('petal_ring', 'sakura'), w: 190, delay: T.startup, life: T.active + 160, run: r, glow: 0.3, follow: this.front(r, 0, 44), dz: z, crop, flick: 70,
        sx: kf([0, 0.5], [0.2, 1, out3], [1, 1.12]), sy: kf([0, 0.5], [0.2, 1, out3], [1, 1.12]), a: kf([0, 0], [0.15, 0.95], [0.85, 0.95], [1, 0]) });
    // the storm: a funnel of cherry blossom round him, turning (two mirrored copies crossing over), and petals orbiting through it
    const s = this.ctx.scene, N = 34, life = T.startup + T.active + 260, storm = this.fname(tn('petal_storm', 'sakura'));
    const mk = (flip: boolean) => s.add.image(0, 0, KIT, storm).setOrigin(0.5, 0.96).setFlipX(flip).setVisible(false);
    const A = mk(false), B = mk(true), kS = 210 / A.height;
    const ps = Array.from({ length: N }, (_, i) => ({ im: s.add.image(0, 0, KIT, i % 6 === 5 ? 'blossom' : `petal_${1 + (i % 4)}`).setVisible(false).setScale(rnd(0.22, 0.42)),
      th: (i / N) * Math.PI * 2, rad: rnd(48, 96), h: rnd(6, 150), sp: rnd(0.008, 0.016) }));
    const kill = () => { A.destroy(); B.destroy(); for (const p of ps) p.im.destroy(); };
    this.add({ t: 0, step: (_dt, t) => {
      const c = this.ctx.casterPos(r.attackerId), e = t - T.startup;
      if (e >= 0 && c && !this.broken(r)) {
        const fade = Math.min(1, e / 120) * Math.max(0, Math.min(1, (life - t) / 220)), turn = 0.5 + 0.5 * Math.sin(e / 55), w = 1 + 0.06 * Math.sin(e / 45);
        // (the funnel behind the fighters, the orbiting petals round them: in front it hid the foe he chases — DFO's PVP 3D review)
        A.setVisible(true).setPosition(c.x, c.y - c.z + 10).setScale(kS * w, kS).setDepth(c.y - 3).setAlpha(fade * (0.2 + 0.45 * turn));
        B.setVisible(true).setPosition(c.x, c.y - c.z + 10).setScale(kS * w, kS).setDepth(c.y - 2.99).setAlpha(fade * (0.2 + 0.45 * (1 - turn)));
        for (const p of ps) {
          const th = p.th + e * p.sp, sn = Math.sin(th);
          p.im.setVisible(true).setPosition(c.x + Math.cos(th) * p.rad, c.y - c.z - p.h + sn * p.rad * 0.3).setDepth(c.y + (sn > 0 ? 4 : -4)).setAngle(e * 0.5 + p.th * 90).setAlpha(fade);
        }
      }
      if (t >= life || (this.broken(r) && t > T.startup) || this.gone(r)) { kill(); return false; }
      return true;
    } });
  }
  /** The foe Blossom Storm chases: the one it locked on to, else just ahead of him. */
  private stormFoe(r: CastRun): V3 {
    const t = r.lock ? this.ctx.targetPos?.(r.lock) : null;
    if (t) return t;
    const q = this.me(r); return { x: q.x + sideOf(r) * 70, y: q.y, z: q.z };
  }
  private stormCut(r: CastRun, i: number): void {
    const side = sideOf(r), f = this.stormFoe(r), last = i >= (r.skill.hits.length - 1), fy = f.y - f.z;
    if (r.attackerId.includes('#')) { // a double's: its cut only, faint (KAGEMUSHA: six storms over the foe)
      const deg = [0, 180, 32, 212][i % 4] + rnd(-20, 20);
      this.cut(tn('cut_thin', 'sakura'), last ? 130 : 110, deg, { x: f.x + rnd(-24, 24), y: fy - 60, depth: TOP + 2.5, grow: 40, hold: 20, fade: 130, glow: 0.2, alpha: 0.55 });
      return;
    }
    if (!last) { // a silhouette of him strikes through the foe from another side each time, the cut behind it — all in blossom pink
      const deg = [0, 180, 32, 212][i % 4] + rnd(-8, 8), c = Math.cos((deg * Math.PI) / 180), sn = Math.sin((deg * Math.PI) / 180) * 0.5, L = 112;
      // (behind the foe, in a dark-red ink: in PVP 3D the black phantoms over him made the knight a black silhouette — DFO)
      this.phantomDash(r, f.x - c * L, fy - sn * L, f.x + c * L, fy + sn * L, f.y - 1.5, toneHex('sakura'), 0x5a1630, 0.8);
      if (this.in3d()) return; // (PVP 3D: the cut is the room's ring through the foe, the petals the room's storm)
      this.cut(tn('cut_thin', 'sakura'), rnd(124, 144), (Math.atan2(sn, c) * 180) / Math.PI, { x: f.x, y: fy - 56, depth: TOP + 3, grow: 40, hold: 30, fade: 150, glow: 0.35, flipY: c < 0, alpha: 0.85 });
      this.petals(f.x, fy - 56, 4, 50, { depth: TOP + 2 });
      return;
    }
    const x = f.x, y = f.y, f3 = this.fx3d();
    if (f3) { // PVP 3D: the foe thrown up in a column of real petals rising round him from the planks (DFO's swirl); the line up through him is the room's
      const look = this.petalLook(1), col = () => { const t = this.stormFoe(r); return { x: t.x, y: t.y, z: 0 }; };
      if (look) f3.swirl(col, look, { n: 36, r0: 20, r1: 70, h: 340, ms: 560, rps: 1.8, rise: 1.5, size: 1.4 });
      if (r.own) { this.ctx.cam().shake(200, 0.007); this.ctx.punch(0.04, 260); }
      return;
    }
    // (the finale: big enough to be the storm's end, lit softly enough that the foe thrown out of it reads — PVP 3D)
    this.spr({ name: 'blossom_burst', x, y: fy - 70, w: 180, life: 500, glow: 0.1, depth: TOP + 4, angle: rnd(0, 360),
      sx: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.25]), sy: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.25]), a: kf([0, 0.9], [0.45, 0.85], [1, 0, inQ]) });
    this.spr({ name: tn('petal_column', 'sakura'), x, y: y + 6, oy: 0.96, depth: y - 2, w: 124, life: 600, glow: 0.2, sy: kf([0, 0.15], [0.3, 1.1, out3], [1, 1.2]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 0.9], [0.55, 0.85], [1, 0, inQ]) }); // (behind the foe it lifts)
    this.cut(tn('cut_rise', 'sakura'), 152, 0, { x, y: fy - 110, depth: TOP + 4.5, flipX: side < 0, grow: 70, hold: 60, fade: 220, glow: 0.4 });
    this.petals(x, fy - 90, 26, 160, { depth: TOP + 3 });
    this.shock(x, y, 260, { tone: 'sakura' });
    if (r.own) { this.ctx.cam().shake(200, 0.007); this.ctx.punch(0.04, 260); }
  }

  /** Dragon Eclipse: the dark and the cut-in, a black sun rising over the target, eight cuts converging on it out of nowhere. */
  private eclipseAt = new Map<string, { x: number; y: number }>();
  /** Where the eclipse falls: on the foe it locked on to (where it is now), else where the great cut will reach. */
  private eclipsePoint(r: CastRun): { x: number; y: number } {
    const t = r.lock ? this.ctx.targetPos?.(r.lock) : null;
    if (t) return { x: t.x, y: t.y };
    const a = r.aim, o = r.origin, reach = (r.skill.dash?.distance ?? 120) + 95;
    return this.eclipseAt.get(r.castId) ?? { x: o.x + a.x * reach, y: o.y + a.y * reach };
  }
  private eclipse(r: CastRun): void {
    this.ctx.ultimateStage(r);
    const T = r.timings, o = r.origin, fin = T.startup + (r.hits[r.hits.length - 1]?.at ?? 120);
    const at = this.eclipsePoint(r), sx = at.x, sy = at.y - o.z - 230;
    this.eclipseAt.set(r.castId, at);
    this.later(fin + 1200, () => this.eclipseAt.delete(r.castId));
    this.spr({ name: 'sun_black', x: sx, y: sy, depth: TOP + 1, w: 230, delay: T.startup * 0.25, life: fin - T.startup * 0.25 + 140, run: r,
      sx: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), sy: kf([0, 0.2], [0.6, 1, out3], [1, 1.08]), rot: (u) => 24 * u, a: kf([0, 0], [0.12, 1], [0.93, 1], [1, 0]) });
    this.spr({ name: 'sun_rays', x: sx, y: sy, depth: TOP + 0.9, w: 330, add: true, tint: 0xff4050, delay: T.startup * 0.5, life: fin - T.startup * 0.5 + 140, run: r, rot: (u) => -30 * u, a: kf([0, 0], [0.3, 0.6], [1, 0]) });
    for (let k = 0; k < 3; k++) // a glint of the blade in the dark, here and there round the foe
      this.pop('glint', at.x + rnd(-90, 90), at.y - o.z - rnd(30, 100), 120, { delay: T.startup - 420 + k * 130, life: 220, angle: 0, depth: TOP + 5, run: r });
    this.eclipseRims(r, fin + 1250);
  }
  /** Through the eclipse's dark each fighter stays readable: his body lit above the dark at part strength, a crimson rim
   *  of light round it (DFO's PVP 3D review: in the dark the fighters were not readable at all) — over the eclipse's own
   *  pieces at part strength (they show through the fighters), under the cut-in (TOP + 49 / 50). */
  private eclipseRims(r: CastRun, until: number): void {
    const s = this.ctx.scene, ids = [...new Set([r.attackerId, r.lock].filter((x): x is string => !!x))];
    const mk = (add: boolean) => { const im = s.add.image(0, 0, KIT, this.fname('glint')).setVisible(false); if (add) im.setBlendMode(Phaser.BlendModes.ADD); return im; };
    const parts = ids.map((id) => ({ id, rim: mk(true), lit: mk(false) }));
    const kill = () => { for (const p of parts) { p.rim.destroy(); p.lit.destroy(); } };
    this.add({ t: 0, step: (_dt, t) => {
      if (this.gone(r) || t >= until) { kill(); return false; }
      const on = Math.min(1, t / 220) * Math.min(1, (until - t) / 260);
      for (const p of parts) {
        const b = this.ctx.body?.(p.id), c = this.ctx.casterPos(p.id), seen = b?.a ?? 0;
        if (!b || !c || seen < 0.05) { p.rim.setVisible(false); p.lit.setVisible(false); continue; }
        p.rim.setTexture(b.key, b.frame).setOrigin(b.ox, b.oy).setFlipX(b.flipX).setScale(b.sx * 1.07, b.sy * 1.05).setPosition(c.x, c.y - c.z + 2)
          .setTintFill(0xff3048).setDepth(TOP + 6.5).setAlpha(0.55 * on * seen).setVisible(true);
        p.lit.setTexture(b.key, b.frame).setOrigin(b.ox, b.oy).setFlipX(b.flipX).setScale(b.sx, b.sy).setPosition(c.x, c.y - c.z)
          .setDepth(TOP + 6.6).setAlpha(0.55 * on * seen).setVisible(true);
      }
      return true;
    } });
  }
  /** One of the eight cuts out of the dark: a phantom of him crosses the foe from its own direction, the cut line behind it. */
  private eclipseSlash(r: CastRun, i: number): void {
    const o = r.origin, at = this.eclipsePoint(r);
    const th = (([0, 180, 45, 225, 90, 270, 135, 315][i % 8] + rnd(-10, 10)) * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th) * 0.5, L = 120, y = at.y - o.z - 50;
    if (!this.in3d()) this.cut('cut_line', 290, (Math.atan2(sn, c) * 180) / Math.PI, { x: at.x, y, depth: TOP + 5, grow: 35, hold: 25, fade: 130, glow: 0.8, sweep: 0 }); // (PVP 3D: the room's flurry)
    if (!this.in3d()) this.phantomDash(r, at.x - c * L, at.y - o.z - sn * L, at.x + c * L, at.y - o.z + sn * L, TOP - 9.8); // (over the dark, behind the fighters' light; PVP 3D: the flurry's lines are the cuts — the eight phantoms held by the hit-stops ran all at once as one black mass over the foe at the great cut)
    if (!this.in3d()) this.pop('spark_s', at.x + rnd(-14, 14), y + rnd(-14, 14), 70, { life: 160 });
    this.ctx.darken(300, 0.55); // the dark holds through the cuts (their hit-stops stretch them past its timer)
    if (r.own) this.ctx.cam().shake(60, 0.002);
  }
  private eclipseCut(r: CastRun, o: V3): void {
    const a = r.aim, at = this.eclipsePoint(r), cam = this.ctx.cam(), ang = screenAng(a.x, a.y);
    const sx = at.x, sy = at.y - o.z - 230, y = at.y - o.z - 50;
    this.pop('sun_flare', sx, sy, 240, { life: 500, depth: TOP + 1.2, angle: 0, glow: 0.4 });
    this.spr({ name: 'sun_break', x: sx, y: sy, depth: TOP + 1.1, w: 240, delay: 260, life: 900, my: (u) => 60 * u, rot: (u) => 20 * u, sx: kf([0, 1], [1, 1.25]), sy: kf([0, 1], [1, 1.25]), a: kf([0, 1], [1, 0, inQ]) });
    // (the colossal cut over the foe, thin and lit softly enough that he reads under it — DFO's PVP 3D review)
    if (!this.in3d()) { // (PVP 3D: the cuts are the room's star of lines; the dragon and the sun breaking are the great cut — fx3d/samurai.ts)
      this.cut('cut_line', 640, ang, { x: at.x - a.x * 40, y, depth: TOP + 5, h: 48, grow: 50, hold: 120, fade: 320, glow: 0.55, sweep: 0, flipY: a.x < -0.01 });
      this.later(110, () => this.cut('cut_split', 480, ang, { x: at.x, y, depth: TOP + 5.5, grow: 50, hold: 120, fade: 300, glow: 0.5, sweep: 0, alpha: 0.85 }));
      this.pop('burst_crit', at.x, y, 170, { life: 360, depth: TOP + 6, glow: 0.3 });
    }
    this.spr({ name: 'ground_slash', x: at.x, y: at.y + 2, angle: ang, flipY: a.x < -0.01, w: 460, depth: GROUND + 2.2, life: 1600, glow: 0.55,
      sx: kf([0, 0.1], [0.1, 1, out3]), sy: kf([0, 1.5], [0.1, 1]), a: kf([0, 1], [0.6, 1], [1, 0, inQ]) });
    // the dragon swims out of the dark along the cut, through the foe and away (its whole body following its head along
    // one gently waving path, faster through the foe, easing in and out), and melts back into the dark from its tail
    const fl = a.x < -0.01, ux = Math.cos((ang * Math.PI) / 180), uy = Math.sin((ang * Math.PI) / 180), drg = this.serpent(56, { glow: 0.5, flip: fl });
    const S0 = { x: at.x - ux * 600, y: y - uy * 600 }, wave = (sv: number) => 15 * Math.sin(sv / 56);
    const path = (sv: number): Pt => ({ x: S0.x + ux * sv - uy * wave(sv), y: S0.y + uy * sv + ux * wave(sv), d: TOP - 9.7 }); // (over the dark, behind the fighters' light)
    const FLY = 900, D0 = 330, D1 = 1650, MELT0 = 620, MELT = 420;
    let nextSpark = 0;
    this.add({ t: 0, step: (_dt, t) => {
      const u = Math.min(1, t / FLY), neck = D0 + (D1 - D0) * (0.3 * u + 0.7 * u * u * (3 - 2 * u)), melt = Math.max(0, (t - MELT0) / MELT);
      drg.place(path, neck, Math.min(1, t / 160), Math.min(1, melt));
      if (melt > 0 && melt < 1 && t >= nextSpark) { // it scatters into sparks where it melts
        nextSpark = t + 30;
        for (let k = 0; k < 2; k++) { const p = drg.at(path, neck, Math.min(1, melt * 1.2 - 0.1 + rnd(-0.04, 0.04))); this.pop('spark_s', p.x + rnd(-14, 14), p.y + rnd(-12, 12), rnd(34, 56), { life: 240, depth: TOP + 4.5, glow: 0.5 }); }
      }
      if (melt >= 1) { drg.destroy(); return false; }
      return true;
    } });
    for (let i = 0; i < 24; i++) this.later(200 + i * 40, () => this.petals(at.x + rnd(-260, 260), y - rnd(80, 220), 1, 30, { life: 1600, depth: TOP + 3 }));
    if (!this.in3d()) this.ctx.flash?.(0xffd2c8, 0.36, 170); // the corona bursts in light (soft: the colossal cut on the foe stays seen, PVP 3D review; PVP 3D: the room's own flash of the blow is enough — with this one the picture stood washed pale through the hit-stop)
    this.ctx.darken(MELT0 + MELT - 100, 0.55); // and the dark lifts only after the dragon has passed
    if (r.own) { cam.shake(320, 0.012); this.ctx.punch(0.06, 320); }
  }

  /** Tornado Blade, the air spin: a whirl of blade light round his waist (its far half behind him, its near half in front,
   *  flickering as it turns), a ring of wind spreading from it, petals and blade glints circling him — for the whole spin. */
  private airSpin(r: CastRun): void {
    const T = r.timings, life = T.active + 140, fl = sideOf(r) < 0, f = this.front(r, 0, 56), S = (n: string) => tn(n, 'steel');
    // (in the cold white of bare steel: a whirlwind of blade light — read apart from the crimson launcher and the pink storm round it)
    for (const [crop, z] of [[undefined, -3], [0.5, 3]] as const)
      this.spr({ name: S('cut_ring'), w: 190, life, delay: T.startup, run: r, follow: f, dz: z, crop, glow: crop ? 0.18 : 0.3, flipX: fl, flick: 48, // (its near half lighter: the foe it holds is right there beside him — the trials, filmed)
        sx: kf([0, 0.45], [0.18, 1, out3], [1, 1.1]), sy: kf([0, 0.45], [0.18, 1, out3], [1, 1.1]), a: crop ? kf([0, 0.5], [0.7, 0.45], [1, 0, inQ]) : kf([0, 0.8], [0.7, 0.75], [1, 0, inQ]) });
    for (const [crop, z] of [[undefined, -2], [0.5, 2]] as const)
      this.spr({ name: S('wind_ring'), w: 160, life: life + 80, delay: T.startup, run: r, follow: f, dz: z, crop, add: true, flipX: !fl,
        sx: (u) => 0.8 + 0.7 * u, sy: (u) => 0.55 + 0.35 * u, a: kf([0, 0], [0.12, 0.55], [0.7, 0.35], [1, 0]) });
    for (let k = 0; k < 3; k++) // blade glints whirling round him
      this.spr({ name: S('glint'), w: 30, life: T.active, delay: T.startup + k * 40, run: r, follow: f, dz: 4, glow: 0.8,
        mx: (u) => Math.cos(u * Math.PI * 4 + k * 2.1) * 92, my: (u) => Math.sin(u * Math.PI * 4 + k * 2.1) * 26, rot: (u) => 360 * u, a: kf([0, 0], [0.1, 1], [0.85, 1], [1, 0]) });
    this.later(T.startup, () => { const p = f(); if (p) this.sparks(p.x, p.y, 8, 110, { tone: 'steel', depth: p.d + 4 }); }, r);
  }

  /** Falcon Dive: the samurai wrapped in a falcon of fire through the leap and the dive, a ribbon of red light streaming
   *  behind him all the way down. */
  private falcon(r: CastRun): void {
    const T = r.timings, s = this.ctx.scene, side = sideOf(r), fl = side < 0;
    const q0 = this.me(r);
    this.later(T.startup, () => { this.dust(q0.x, q0.y, 110); this.dustRing(q0.x, q0.y, 150); }, r);
    const land = T.startup + (r.skill.hits[1]?.at ?? 300);
    this.trail(() => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x - side * 4, y: c.y - c.z - 52, d: c.y - 0.5 } : null; },
      { delay: T.startup - 20, until: land - T.startup + 30, span: 230, w: 46, fade: 240, run: r, glow: 0.9, tone: 'fire' });
    const fb = this.fname(tn('falcon_dive', 'fire'));
    const bird = s.add.image(0, 0, KIT, fb).setVisible(false).setFlipX(fl);
    const glow = s.add.image(0, 0, KIT, fb).setVisible(false).setFlipX(fl).setBlendMode(Phaser.BlendModes.ADD);
    const k = 190 / bird.width, hitAt = r.skill.hits[1]?.at ?? 300;
    let lastGhost = 0;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - T.startup, c = this.ctx.casterPos(r.attackerId);
      if (e < 0) return true;
      if (this.broken(r) || !c || r.fired.has(1) || e > hitAt + 30) { bird.destroy(); glow.destroy(); return false; } // (gone the moment it strikes: the explosion takes its place)
      const p = e / Math.max(1, hitAt), up = p < 0.42, ang = up ? side * -78 : side * 8, al = up ? Math.min(1, p / 0.25) * 0.75 : 1;
      const x = c.x - side * 6, y = c.y - c.z - 56;
      bird.setVisible(true).setPosition(x, y).setScale(k).setAngle(ang).setDepth(c.y + 3).setAlpha(al);
      glow.setVisible(true).setPosition(x, y).setScale(k * 1.04).setAngle(ang).setDepth(c.y + 3.01).setAlpha(al * 0.4);
      if (!up && e - lastGhost > 36) { // afterimages of the bird on the dive
        lastGhost = e;
        this.spr({ name: fb, x, y, depth: c.y + 2, w: 190, angle: ang, flipX: fl, life: 140, add: true, a: kf([0, 0.4], [1, 0, inQ]) });
      }
      return true;
    } });
  }
  private falconImpact(r: CastRun): void {
    const q = this.me(r), side = sideOf(r), cam = this.ctx.cam();
    // an explosion of light where he strikes the floor: a short white flash in front, and the fire falcon's wings, rays of
    // light and a pillar of light opening BEHIND the fighters (they stay in sight, standing in it); the wave runs out along
    // the floor
    this.pop('glint', q.x, q.y - 44, 150, { life: 180, depth: TOP + 3, angle: 0, glow: 0.4, add: true }); // (the flash: light only — no dark core over the fighters; soft: PVP 3D)
    const F = (n: string) => tn(n, 'fire');
    this.spr({ name: F('sun_rays'), x: q.x, y: q.y - 50, w: 320, life: 440, add: true, depth: q.y - 3, rot: (u) => 18 * u,
      sx: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.15]), sy: kf([0, 0.3], [0.2, 1.05, out3], [1, 1.15]), a: kf([0, 0.6], [0.35, 0.45], [1, 0, inQ]) });
    this.spr({ name: F('launch_beam'), x: q.x, y: q.y + 6, oy: 0.95, depth: q.y - 2.8, w: 140, h: 220, life: 320, glow: 0.25,
      sx: kf([0, 0.4], [0.2, 1, out3], [1, 0.6]), sy: kf([0, 0.2], [0.18, 1, out3], [1, 1.1]), a: kf([0, 1], [0.35, 0.85], [1, 0, inQ]) });
    this.pop(F('burst_crit'), q.x, q.y - 30, 96, { life: 220, depth: TOP + 3.2, glow: 0.3 });
    this.spr({ name: F('falcon_spread'), x: q.x, y: q.y + 6, oy: 0.92, depth: q.y - 3.2, w: 250, life: 460, glow: 0.4,
      sx: kf([0, 0.5], [0.25, 1.05, out3], [1, 1.15]), sy: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]), my: (u) => -24 * u });
    this.shock(q.x, q.y, 300, { tone: 'fire' }); this.shock(q.x, q.y, 380, { delay: 80, tone: 'fire' });
    this.crack(q.x, q.y + 2, 170, side * 8); this.dustRing(q.x, q.y, 240); this.dust(q.x - 50, q.y, 110); this.dust(q.x + 50, q.y, 110, 40);
    this.sparks(q.x, q.y - 40, 14, 150, { tone: 'fire', depth: q.y + 5, up: 30 });
    if (r.own) { cam.shake(220, 0.008); this.ctx.punch(0.04, 240); }
  }

  /** Rising Sun: the war banner rises behind him and flies in the wind (its cloth bends for real), gold rays behind the sun.
   *  (David 18 Oct 18:29 / 22:56) A war banner, not a stick — and not a massive one: the painted pole and cloth a size up at
   *  their own proportions. Where it can spring him reads on the planks: a ring of gold light exactly the engine's catch zone round its foot
   *  (POLE: ±nearX along the field × ±nearY in depth), soft and always on while it stands; while he is in the air inside it
   *  the ring and the banner flare — the "now" — with an arrow of light on the ring the way it springs him (away from where
   *  he faces). Its last 3 s it flickers and fades. */
  private risingSun(r: CastRun): void {
    const s = this.ctx.scene, T = r.timings, side = sideOf(r), q = this.me(r), bx = q.x - side * POLE_BACK, by = q.y - 4, planted = T.startup + T.active, life = planted + POLE_MS; // (planted after the burst: David 01:15)
    const poleH = 300, clothH = 262, clothW = Math.round(clothH * 144 / 440), top = by - poleH + 36, THICK = 1.3, GOLD = 0xffc65a; // (David 22:56: the painted banner at its own proportions, a size up — stretched wide and on a pole 2.6× thick it read massive)
    const pole = s.add.image(bx, by, KIT, 'banner_pole').setOrigin(0.5, 0.98).setDepth(by - 3).setVisible(false);
    const pk = poleH / pole.height;
    const N = 12, pts = Array.from({ length: N }, (_, i) => new Phaser.Math.Vector2(0, (i / (N - 1)) * clothH));
    const cx = bx - side * (clothW / 2 + 4);
    const halo = s.add.image(cx, top + clothH / 2, 'dmg-glow').setTint(GOLD).setBlendMode(Phaser.BlendModes.ADD).setDepth(by - 3.3).setVisible(false); // (the cue: the banner lit from behind)
    const cloth = s.add.rope(cx, top, KIT, 'banner_cloth', pts, false).setDepth(by - 3.2).setVisible(false);
    const fr = s.textures.getFrame(KIT, 'banner_cloth');
    cloth.setScale(clothW / fr.width, 1);
    // the sun on the banner shines: golden rays round it, turning slowly (long and short in turn), from just outside its disc
    const ray = this.rayTex(), NR = 12, SUN = 0.32, R0 = clothW * 0.26, ck = clothW / fr.width;
    const rays = Array.from({ length: NR * 2 }, (_, i) => { const im = s.add.image(0, 0, ray).setOrigin(0, 0.5).setVisible(false); if (i >= NR) im.setBlendMode(Phaser.BlendModes.ADD); return im; });
    // the catch zone on the planks (the painted world: a ring drawn; PVP 3D: the room's own, blade3d zoneRing)
    const f3 = this.fx3d(), zg = f3 ? null : s.add.graphics().setDepth(GROUND + 2.1);
    let fired = -1, dead = false, now = 0, zoneA = 0, way = -side;
    if (f3) zoneRing(f3, { x: bx, y: q.y, z: 0 }, POLE.nearX, POLE.nearY, () => (dead ? null : { a: zoneA, flare: now, arrow: now, dir: way }), GOLD);
    const kill = () => { if (dead) return; dead = true; pole.destroy(); halo.destroy(); cloth.destroy(); zg?.destroy(); for (const im of rays) im.destroy(); if (this.poles.get(r.attackerId)?.kill === kill) this.poles.delete(r.attackerId); };
    this.poles.get(r.attackerId)?.kill(); // (one banner of his at a time: a new one takes the old one's place)
    const P = { t: 0, spring: -1, dir: -side, x: bx, y: by, h: poleH, kill };
    this.poles.set(r.attackerId, P);
    this.add({ t: 0, step: (dt, t) => {
      if (dead) return false;
      if ((this.broken(r) && t < T.startup + 20) || this.gone(r)) { kill(); return false; }
      P.t = t;
      const rise = Math.min(1, t / Math.max(1, T.startup)), up = back(rise), rem = life - t, k3 = Math.max(0, Math.min(1, rem / 3000));
      const fade = rem < 3000 ? Math.pow(k3, 0.6) * (Math.sin(t / (32 + 95 * k3)) > -0.35 ? 1 : 0.22) : 1; // (its last 3 s: it flickers and fades)
      // the "now": he is in the air inside its catch zone — the ring and the banner flare, an arrow shows the way it throws him
      const c = this.ctx.casterPos(r.attackerId), inZone = !!c && t >= planted && Math.abs(c.x - bx) <= POLE.nearX && Math.abs(c.y - q.y) <= POLE.nearY && c.z >= POLE.low && c.z <= POLE.top;
      now += ((inZone ? 1 : 0) - now) * Math.min(1, dt / (inZone ? 45 : 170));
      way = -(this.ctx.body?.(r.attackerId)?.face ?? side);
      zoneA = Math.max(0, Math.min(1, (t - planted + 200) / 400)) * fade * (0.55 + 0.45 * now);
      // the spring: the pole bends under his weight the way he is thrown, whips back past straight and settles (~0.6 s)
      const ks = P.spring < 0 ? -1 : (t - P.spring) / 620, bend = ks < 0 || ks > 1 ? 0 : P.dir * 16 * Math.sin(Math.PI * 2.2 * ks) * Math.pow(1 - ks, 1.6);
      const al = Math.min(1, t / 120) * fade, brad = (bend * Math.PI) / 180;
      pole.setVisible(true).setScale(pk * THICK, pk * up).setAngle(bend).setAlpha(al);
      const ty = by - (by - top) * up * Math.cos(brad), tipDx = poleH * Math.sin(brad);
      const cl = Math.min(1, Math.max(0, (up - 0.6) / 0.3)) * fade;
      cloth.setVisible(up > 0.6).setPosition(cx + tipDx, ty).setAngle(bend * 0.6).setAlpha(cl);
      halo.setVisible(now > 0.02 && up > 0.6).setPosition(cx + tipDx, ty + clothH * 0.45).setDisplaySize(clothW * 2.2, clothH * 1.5).setAlpha(0.55 * now * cl);
      for (let i = 0; i < N; i++) { const v = i / (N - 1); pts[i].set(-side * Math.sin(t / 260 + v * 3.1) * 10 * v + side * 4 * v * v, v * clothH * (0.95 + 0.05 * Math.sin(t / 330 + v))); }
      cloth.setPoints(pts);
      if (fired < 0 && r.fired.has(0)) { fired = t; } // (its light breaks: the rays flare up, longer and brighter, and settle)
      // (planted, its sun glows on faintly: full through the burst, then down to a glow; the "now" lights it again)
      const fl = Math.max(fired < 0 ? 0 : Math.max(0, 1 - (t - fired) / 650), now * 0.8), low = fired < 0 ? 1 : 0.35 + 0.65 * Math.max(0, 1 - (t - fired - 900) / 900);
      const on = Math.max(0, Math.min(1, (t - T.startup * 0.5) / 300)) * cl * Math.min(1, Math.max(low, now) + (P.spring >= 0 && t - P.spring < 400 ? 0.6 : 0));
      const sx = cx + tipDx + (-side * Math.sin(t / 260 + SUN * 3.1) * 10 * SUN + side * 4 * SUN * SUN) * ck, sy = ty + SUN * clothH * (0.95 + 0.05 * Math.sin(t / 330 + SUN)); // (the sun on the cloth, as it waves)
      rays.forEach((im, i) => {
        const k = i % NR, th = (k / NR) * 360 + t * 0.02, rad = (th * Math.PI) / 180, L = (k % 2 ? 18 : 28) * (1 + 0.1 * Math.sin(t / 160 + k)) * (1 + 1.3 * out(fl)), glow = i >= NR;
        im.setVisible(on > 0.01).setPosition(sx + Math.cos(rad) * R0, sy + Math.sin(rad) * R0).setAngle(th).setDisplaySize(L, glow ? 6.5 : 5)
          .setDepth(by - 3.15 + (glow ? 0.01 : 0)).setAlpha(on * (glow ? 0.45 + 0.4 * fl : 0.9));
      });
      if (zg) { // the painted world's zone: the ring, the arrow
        zg.clear(); const za = zoneA, w = 3 + 3 * now;
        if (za > 0.01) {
          zg.lineStyle(w + 8, GOLD, 0.18 * za).strokeEllipse(bx, q.y, POLE.nearX * 2, POLE.nearY * 2);
          zg.lineStyle(w, GOLD, 0.75 * za).strokeEllipse(bx, q.y, POLE.nearX * 2, POLE.nearY * 2);
          if (now > 0.05) { zg.lineStyle(4, 0xfff4d6, now * za); for (const o of [0, 14]) { const x0 = bx + way * (POLE.nearX + 10 + o); zg.beginPath(); zg.moveTo(x0, q.y - 12); zg.lineTo(x0 + way * 12, q.y); zg.lineTo(x0, q.y + 12); zg.strokePath(); } }
        }
      }
      if (t >= life) { kill(); return false; }
      return true;
    } });
  }
  /** Untouchable while the sun rises (his defensive ultimate): the sun's rays open behind him, turning, and a golden flame
   *  wraps him for as long as nothing can touch him (cast to the burst). */
  private sunShield(r: CastRun): void {
    const T = r.timings, until = T.startup + T.active, q = () => { const c = this.ctx.casterPos(r.attackerId); return c ? { x: c.x, y: c.y - c.z - 60, d: c.y } : null; };
    this.auraFlare(r, 'aura_gold', 176, until + 80);
    this.spr({ name: tn('sun_rays', 'gold'), w: 300, life: until + 120, run: r, follow: q, dz: -4, add: true, rot: (u) => 40 * u,
      sx: kf([0, 0.2], [0.35, 1, out3], [1, 1.12]), sy: kf([0, 0.2], [0.35, 1, out3], [1, 1.12]), a: kf([0, 0], [0.2, 0.6], [0.88, 0.7], [1, 0]) });
  }
  /** The banner's light breaks over him: the sun's rays flare out, rings of golden light throw every foe back. */
  private sunBurst(r: CastRun): void {
    const q = this.me(r);
    // (the light breaks behind him and over the floor — lit softly enough that he and the foes thrown back read: PVP 3D)
    this.spr({ name: tn('sun_rays', 'gold'), x: q.x, y: q.y - q.z - 60, w: 290, life: 500, add: true, depth: q.y - 3, rot: (u) => 30 * u,
      sx: kf([0, 0.6], [0.25, 1.1, out3], [1, 1.25]), sy: kf([0, 0.6], [0.25, 1.1, out3], [1, 1.25]), a: kf([0, 0.6], [0.4, 0.5], [1, 0, inQ]) });
    this.pop('glint', q.x, q.y - q.z - 60, 110, { life: 220, angle: 0, depth: q.y - 2.5, glow: 0.3 }); // (behind him: over him it washed him gold — DFO)
    this.shock(q.x, q.y, 340, { tone: 'gold' }); this.shock(q.x, q.y, 440, { tone: 'gold', delay: 90 });
    this.sparks(q.x, q.y - 80, 16, 160, { tone: 'gold', depth: q.y + 4 });
    if (r.own) this.ctx.cam().shake(160, 0.004);
  }

  /** (Rising Sun was a buff once — its light stayed on him; it is his defensive ultimate now: nothing stays on him. Kept for
   *  the scene's round reset.) */
  /** Rising Sun's planted banner springs him far back (DFO's engine calls it as his jump lands on the pole): the pole bends
   *  under him the way he is thrown and whips back, a ring of light bursts at its tip, the cloth snaps, his flight leaves a
   *  ribbon of light behind him and petals are shaken off the banner. `dir`: the way he flies (±1; default away from the
   *  side the banner stood on). */
  poleSpring(id: string, dir?: number): void {
    if (!this.ready) return;
    const P = this.poles.get(id); if (!P) return;
    if (dir) P.dir = dir;
    P.spring = P.t;
    const tipY = P.y - P.h * 0.92;
    this.spr({ name: 'shock_ring', x: P.x, y: tipY, depth: P.y + 4, w: 90, h: 46, life: 360, glow: 0.7, add: true, sx: kf([0, 0.3], [1, 1.4, out3]), sy: kf([0, 0.3], [1, 1.4, out3]), a: kf([0, 1], [1, 0, inQ]) });
    this.pop('glint', P.x, tipY, 90, { life: 220, angle: 0, depth: P.y + 5, glow: 0.4 });
    this.spr({ name: 'wind_lines', x: P.x + P.dir * 40, y: tipY + 30, depth: P.y + 3, w: 120, flipX: P.dir < 0, add: true, life: 260, mx: (u) => P.dir * 50 * u, a: kf([0, 0.8], [1, 0]) });
    this.petals(P.x, tipY + 40, 10, 90, { depth: P.y + 4, life: 900 });
    const body = (): Pt | null => { const c = this.ctx.casterPos(id); return c ? { x: c.x, y: c.y - c.z - 52, d: c.y + 1 } : null; };
    this.trail(body, { span: 260, w: 30, until: 520, fade: 180, glow: 0.5 }); // (his flight off it)
  }
  clearSun(id: string, now = false): void {
    this.poles.get(id)?.kill(); // (the round's over: his banner goes with it)
    const u = this.suns.get(id); if (!u) return;
    this.suns.delete(id);
    if (now) { for (const im of u.ims) im.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: u.ims, alpha: 0, duration: 400, onComplete: () => { for (const im of u.ims) im.destroy(); } });
  }
  private stepSuns(dt: number): void {
    for (const [id, u] of this.suns) {
      u.t += dt;
      const c = this.ctx.casterPos(id);
      if (!c || u.t >= SUN_MS || this.ctx.alive?.(id) === false) { this.clearSun(id); continue; }
      const vis = this.seen(id), on = Math.min(1, u.t / 1000) * Math.min(1, (SUN_MS - u.t) / 600) * vis, x = c.x, y = c.y - c.z + 8;
      const k = (118 / u.ims[0].width) * (1 + 0.03 * Math.sin(u.t / 260)), ky = k * (0.9 + 0.05 * Math.sin(u.t / 340));
      u.ims[0].setVisible(on > 0.01).setPosition(x, y).setScale(k, ky).setDepth(c.y - 2.4).setAlpha(0.2 * on);
      u.ims[1].setVisible(on > 0.01).setPosition(x, y).setScale(k * 1.04, ky * 1.04).setDepth(c.y - 2.39).setAlpha((0.13 + 0.05 * Math.sin(u.t / 200)) * on);
      if (u.t >= u.next) { // a mote of light rising off him
        u.next = u.t + rnd(240, 420);
        if (vis > 0.5) this.spr({ name: 'glint', x: x + rnd(-30, 30), y: y - rnd(16, 96), depth: c.y + (Math.random() < 0.5 ? 2 : -2), w: rnd(13, 20), add: true, tint: 0xffd27a, life: 900,
          my: (q) => -54 * q, rot: (q) => 120 * q, a: kf([0, 0], [0.2, 0.85], [1, 0]) });
      }
    }
  }

  /** Phantom Blades: phantoms of the samurai dash through the field in crossing lines (an ink stroke and a cut of light each). */
  private phantom(r: CastRun, i: number): void {
    const s = r.skill, sh = s.hits[0].shape as { radius: number; bias?: number }, o = r.origin, a = r.aim, R = sh.radius;
    const cx = o.x + a.x * (sh.bias ?? 150), cy = o.y + a.y * (sh.bias ?? 150) - o.z - 60, last = i >= s.hits.length - 1;
    if (!last && this.in3d()) { // (PVP 3D: the flurry of lines is the room's — fx3d/samurai.ts; his phantoms still dash through)
      const ang = rnd(-40, 40) + (i % 2 ? 180 : 0), c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180), L = R * 1.15, ox = cx + rnd(-R * 0.3, R * 0.3), oy = cy + rnd(-R * 0.15, R * 0.15);
      this.phantomDash(r, ox - c * L, oy - sn * L + 60, ox + c * L, oy + sn * L + 60, oy + 58);
      return;
    }
    if (last && this.in3d()) { this.shock(cx, cy + 60, R * 2.4); if (r.own) { this.ctx.cam().shake(260, 0.009); this.ctx.punch(0.05, 260); } return; }
    if (!last) {
      const ang = rnd(-40, 40) + (i % 2 ? 180 : 0) + (i % 3 === 2 ? 90 : 0), fl = Math.cos(ang * Math.PI / 180) < 0;
      const ox = cx + rnd(-R * 0.3, R * 0.3), oy = cy + rnd(-R * 0.15, R * 0.15);
      this.spr({ name: 'ink_long', x: ox, y: oy, angle: ang, flipY: fl, w: R * 2.1, h: 60, depth: TOP + 2, life: 520,
        sx: kf([0, 0.2], [0.14, 1, out3]), sy: kf([0, 0.8], [0.14, 1], [1, 0.4, inQ]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
      this.cut('cut_line', R * 2.2, ang, { x: ox, y: oy, depth: TOP + 3, h: 18, grow: 60, hold: 40, fade: 180, glow: 0.45, sweep: 0, flipY: fl });
      const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180), L = R * 1.15; // a phantom of him dashes along the stroke
      this.phantomDash(r, ox - c * L, oy - sn * L + 60, ox + c * L, oy + sn * L + 60, TOP + 2.5);
      return;
    }
    const cam = this.ctx.cam();
    // (the last cross: big as the field, lit softly enough that the foe reads inside it — PVP 3D)
    this.cut('cut_x', R * 1.7, rnd(-8, 8), { x: cx, y: cy, depth: TOP + 4, grow: 60, hold: 90, fade: 260, glow: 0.4 });
    this.pop('burst_crit', cx, cy, R * 0.9, { life: 340, glow: 0.25 });
    this.shock(cx, cy + 60, R * 2.4);
    this.sparks(cx, cy, 20, R, { depth: TOP + 3 }); // (crimson sparks off the ink field: no petals — those are the blossom skills')
    if (r.own) { cam.shake(260, 0.009); this.ctx.punch(0.05, 260); }
  }

  /** Phantom Blades' wind-up: the field it will cut is marked on the floor (a ring with eight bright notches, one per cut),
   *  and silhouettes of him rise at its edge, poised, until the cuts begin. */
  private phantomField(r: CastRun): void {
    const T = r.timings, s = r.skill, sh = s.hits[0].shape as { radius: number; bias?: number }, o = r.origin, a = r.aim, R = sh.radius;
    const cx = o.x + a.x * (sh.bias ?? 150), cy = o.y + a.y * (sh.bias ?? 150), life = T.startup + T.active + 200;
    this.spr({ name: 'timer_ring', x: cx, y: cy, depth: GROUND + 2.4, w: R * 2.1, life, run: r, glow: 0.55,
      sx: kf([0, 0.2], [T.startup / life, 1, out3], [1, 1.04]), sy: kf([0, 0.2], [T.startup / life, 1, out3], [1, 1.04]), a: kf([0, 0], [0.15, 0.95], [0.85, 0.95], [1, 0]) });
    this.floor('vortex', cx, cy, R * 1.6, T.startup + 80, { spin: 260, run: r, depth: GROUND + 2.2, a: kf([0, 0], [0.4, 0.55], [1, 0]), s: kf([0, 0.4], [1, 1, out3]) });
    [200, -20, 140, 40].forEach((deg, k) => { // poised at the edge, facing in
      const th = (deg * Math.PI) / 180, x = cx + Math.cos(th) * R * 0.92, y = cy + Math.sin(th) * R * 0.92 * SQUASH;
      this.silhouette(r, x, y - o.z, y + 1, T.startup + 60 - k * 40, { delay: 60 + k * 40, face: x < cx ? 1 : -1, scale: 1.1, a: kf([0, 0], [0.35, 0.8], [0.9, 0.8], [1, 0]) });
    });
  }

  /** A phantom of the samurai — his own body as it is this moment, in ink with a crimson edge — dashing from (x0, y0) to
   *  (x1, y1) (feet), afterimages in its wake. */
  private phantomDash(r: CastRun, x0: number, y0: number, x1: number, y1: number, depth: number, rimCol = 0xff3048, inkCol = 0x12040a, inkA = 0.92): void {
    const b = this.ctx.body?.(r.attackerId); if (!b) return;
    const s = this.ctx.scene, ADD = Phaser.BlendModes.ADD, flip = (x1 < x0) !== (sideOf(r) < 0) ? !b.flipX : b.flipX;
    const mk = (fill: number, k: number) => s.add.image(x0, y0, b.key, b.frame).setOrigin(b.ox, b.oy).setScale(b.sx * k * 1.12, b.sy * k * 1.12).setFlipX(flip).setTintFill(fill).setVisible(false);
    const rim = mk(rimCol, 1.08).setBlendMode(ADD), ink = mk(inkCol, 1), life = 190; // the glow behind (crimson, or the skill's own), the ink body over it: a lit edge
    let trail = -99;
    this.add({ t: 0, step: (_dt, t) => {
      const u = Math.min(1, t / life), p = out(u), x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p, a = u < 0.12 ? u / 0.12 : u > 0.72 ? (1 - u) / 0.28 : 1;
      rim.setVisible(true).setPosition(x, y + 3).setDepth(depth - 0.01).setAlpha(0.85 * a);
      ink.setVisible(true).setPosition(x, y).setDepth(depth).setAlpha(inkA * a);
      if (t - trail > 28 && u < 0.9) {
        trail = t;
        const g = mk(rimCol, 1).setBlendMode(ADD).setPosition(x, y).setDepth(depth - 0.02).setVisible(true).setAlpha(0.32 * a);
        this.add({ t: 0, step: (_d, tt) => { g.setAlpha(0.32 * a * (1 - tt / 170)); if (tt >= 170) { g.destroy(); return false; } return true; } });
      }
      if (u >= 1) { ink.destroy(); rim.destroy(); return false; }
      return true;
    } });
  }

  /** Sakura Bind: a gust blows petals in to where it was aimed and a pattern of blossoms shows faintly in the stones there
   *  (drawn into the floor, not glowing over it). */
  private bind(r: CastRun): void {
    const T = r.timings, h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin, hold = h0.reaction.hardCC?.ms ?? 2000;
    // (David 18 Oct 18:29: "leave it longer on the screen") the ring lives as long as its trap (DFO: 6 s), alive all along
    const L = r.skill.linger, trap = L ? L.startMs + L.everyMs * L.count : 0, life = T.startup + Math.max(hold, trap) + 300, k0 = Math.max(0.02, T.startup / life);
    this.floor('sigil_sakura', c.x, c.y, R * 2.05, life, { spin: 22, run: r, depth: GROUND + 2, tint: 0xe8b4bf,
      a: kf([0, 0], [k0, 0.55], [(life - 700) / life, 0.4], [1, 0]), s: kf([0, 0.85], [k0, 1, out3]) });
    this.petals(c.x, c.y - 30, 14, R * 1.1, { inward: true, life: T.startup + 140, depth: c.y + 3 });
    const B = { x: c.x, y: c.y, R, until: this.clock + life, flare: -1e9 }, id = r.attackerId; this.binds.set(id, B);
    const f3 = this.fx3d(), live = () => this.binds.get(id) === B && this.clock < B.until && !this.broken(r);
    if (f3) { // PVP 3D: a soft pink glow round the ring, flaring as it catches; petals drifting over it all its life
      const t0 = this.clock + T.startup;
      zoneRing(f3, { x: c.x, y: c.y, z: 0 }, R, R, () => { if (!live()) return null; const u = this.clock - t0, k = Math.max(0, Math.min(1, u / 260)) * Math.min(1, (B.until - this.clock) / 600), fl = Math.max(0, 1 - (this.clock - B.flare) / 500);
        return { a: 0.5 * k, flare: fl, arrow: 0, dir: 1 }; }, 0xff8fbf);
      const looks = [0, 1, 2, 3].map((k) => this.petalLook(k)).filter((x): x is { tex: string; size: number; aspect: number } => !!x).map((lk) => f3.host.texture?.(lk.tex) ?? null);
      petalStream(f3, () => { if (!live()) return null; if (this.clock < t0) return undefined; const th = Math.random() * Math.PI * 2, rr = R * Math.sqrt(Math.random()) * 0.92;
        return { x: c.x + Math.cos(th) * rr, y: c.y + Math.sin(th) * rr, z: 40 + Math.random() * 70 }; }, looks, { rate: 9, life: 1800, back: { x: 18, y: 0, z: -10 }, size: 1.05, max: 30, foeY: () => c.y });
    }
  }
  /** The bind itself: the petals swirl in over the stones and blossoms push up through cracks round the rim, with a puff
   *  of stone dust each (each bound foe gets its branches, `cage`). */
  private bloom(r: CastRun): void {
    const h0 = r.skill.hits[0], R = (h0.shape as { radius: number }).radius, c = r.place ?? r.origin;
    // his blade driven into the planks in front of his knee: the floor cracks round its point and a line of blossom light
    // runs through the planks from it to the ring — the bind comes out of his blade
    const q = this.me(r), sd = sideOf(r), p0 = { x: q.x + sd * 36, y: q.y + 2 };
    this.floor('crack', p0.x, p0.y + 2, 54, 1300, { angle: rnd(0, 360) + CRACK_TILT, squash: 0.5, depth: GROUND + 1.6, tint: 0x4a2418, a: kf([0, 0], [0.04, 0.85], [0.7, 0.6], [1, 0]) });
    this.pop(tn('spark_s', 'sakura'), p0.x, p0.y - 6, 58, { depth: p0.y + 4, life: 220, glow: 0.3 });
    const dx = c.x - p0.x, dy = c.y - p0.y, L = Math.hypot(dx, dy / SQUASH), n = Math.max(2, Math.round(L / 46)), ang = (Math.atan2(dy / SQUASH, dx) * 180) / Math.PI;
    if (L > 40) for (let i = 0; i < n; i++) { // (in segments, one after another: it runs out from the blade)
      const u = (i + 0.5) / n;
      this.floor('cut_line@rose', p0.x + dx * u, p0.y + dy * u, (L / n) * 1.25, 380, { angle: ang, h: 16, delay: i * 26, depth: GROUND + 2.2, glow: 0.45,
        s: kf([0, 0.6], [0.3, 1, out3]), a: kf([0, 1], [0.55, 0.85], [1, 0, inQ]) });
    }
    this.floor(tn('vortex', 'sakura'), c.x, c.y, R * 1.9, 420, { spin: -240, depth: GROUND + 2.4, a: kf([0, 0.32], [0.5, 0.24], [1, 0, inQ]), s: kf([0, 1.1], [1, 0.35, inQ]) });
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + rnd(-0.15, 0.15), bx = c.x + Math.cos(th) * R * 1.0, by = c.y + Math.sin(th) * R * SQUASH, dl = 30 + i * 18;
      this.floor('crack', bx, by + 3, 34, 1400, { angle: rnd(0, 360) + CRACK_TILT, squash: 0.5, delay: dl, depth: GROUND + 1.6, tint: 0x4a2418, a: kf([0, 0], [0.05, 0.7], [0.7, 0.6], [1, 0]) });
      this.spr({ name: 'dust', x: bx, y: by + 2, oy: 0.85, depth: by + 2, w: 46, delay: dl, life: 420, tint: DUST, sx: kf([0, 0.4], [1, 1.2, out3]), sy: kf([0, 0.4], [1, 1.05, out3]), a: kf([0, 0.7], [1, 0, inQ]), my: (u) => -8 * u });
      // (David 18 Oct 18:29: the ring alive for its trap) the blossoms stay at its rim as long as it stands, swaying, and fall
      // away at its end; between them branches coiled low along the rim, leaning out
      const rl = Math.max(1000, (this.binds.get(r.attackerId)?.until ?? this.clock + 1000) - this.clock - dl), g0 = 200 / rl, g1 = (rl - 360) / rl, ph = rnd(0, 6), lean = rnd(-18, 18);
      this.spr({ name: 'blossom_cluster', x: bx, y: by, oy: 0.88, depth: by + 1, w: rnd(28, 36), life: rl, delay: dl, flipX: Math.random() < 0.5, rot: (u) => lean + 4 * Math.sin((u * rl) / 420 + ph),
        sx: kf([0, 0], [g0, 1, back], [g1, 1], [1, 0.6]), sy: kf([0, 0], [g0, 1, back], [g1, 1], [1, 0.6]), a: kf([0, 1], [g1, 1], [1, 0, inQ]) });
      const th2 = th + Math.PI / 8, cx2 = c.x + Math.cos(th2) * R * 1.02, cy2 = c.y + Math.sin(th2) * R * SQUASH, out2 = Math.cos(th2) >= 0 ? 1 : -1;
      this.spr({ name: i % 2 ? 'branch_2' : 'branch_1', x: cx2, y: cy2, oy: 0.97, depth: cy2 + (Math.sin(th2) > 0 ? 1 : -1), w: rnd(30, 38), life: rl, delay: dl + 40, flipX: out2 < 0,
        sy: kf([0, 0], [g0 * 1.4, 0.62, back], [g1, 0.62], [1, 0, inQ]), sx: kf([0, 0.4], [g0 * 1.4, 1, out], [g1, 1], [1, 0.6]), rot: (u) => out2 * (38 + 5 * Math.sin((u * rl) / 380 + ph)), a: kf([0, 0.92], [g1, 0.92], [1, 0]) });
    }
    this.ctx.punch(0.02, 160);
  }
  /** The catch: a foe coming down into the blossoms left on the floor — the ring flares under him, petals burst up round
   *  his feet as the branches take him (the branches themselves: `cage`, from the hit). */
  blossomCatch(at: V3): void {
    if (!this.ready) return;
    const { x, y } = at;
    this.floor(tn('shock_ring', 'sakura'), x, y, 190, 380, { add: true, depth: GROUND + 2.6, s: kf([0, 0.35], [1, 1.15, out3]), a: kf([0, 0.85], [1, 0, inQ]) });
    this.floor('sigil_sakura', x, y, 150, 520, { spin: 120, depth: GROUND + 2.2, tint: 0xffd2da, a: kf([0, 0.7], [0.4, 0.5], [1, 0, inQ]), s: kf([0, 1.2], [0.3, 1, out3]) });
    this.petals(x, y - 12, 14, 70, { depth: y + 4 });
    this.dust(x, y, 90);
  }
  /** Sakura Bind's catch (the opening or the trap: DFO's 2.5 s hold): where the pull leaves him — drawn in toward where the
   *  blow came from — the branches break up round him, and (David 18 Oct 18:29: "the pink leaves attack him and lock him inside")
   *  the petals whirl up and close round him into a cocoon of pink leaves for the hold, which bursts open on the release
   *  (PVP 3D: blade3d cocoon; the painted world: the ring of petals round his shins). The ring flares as it catches. */
  private bindCatch(at: V3, hit: HitEvent, from?: { x: number; y: number }): void {
    const hold = hit.reaction.hardCC?.ms ?? 2000, pull = hit.reaction.pull ?? 0;
    let B: { x: number; y: number; R: number; until: number; flare: number } | null = null, bd = 1e9;
    for (const b of this.binds.values()) { const d = Math.hypot(b.x - at.x, b.y - at.y); if (this.clock < b.until && d < b.R + 90 && d < bd) { bd = d; B = b; } }
    let x = at.x, y = at.y;
    if (B) B.flare = this.clock;
    const to = from ?? B; // (the pull draws him toward where the blow came from — Combat: never closer than 30 px)
    if (to) { const dx = to.x - at.x, dy = to.y - at.y, d = Math.hypot(dx, dy), m = Math.min(pull, Math.max(0, d - 30)); if (d > 0.1) { x += (dx / d) * m; y += (dy / d) * m; } }
    this.cage(x, y, hold);
    const f3 = this.fx3d();
    if (!f3) { this.bindMark(x, y, hold); return; }
    const looks = [0, 1, 2, 3].map((k) => this.petalLook(k)).filter((lk): lk is { tex: string; size: number; aspect: number } => !!lk).map((lk) => f3.host.texture?.(lk.tex) ?? null);
    cocoon(f3, { x, y, z: 0 }, looks, { ms: hold, rx: 50, h: 178, n: 90, size: 1.05 });
    this.later(hold, () => { const h = f3.host; h.flare(h.w3(x), h.h3(90), h.d3(y) + 0.2, 0xff8fbf, 10, 5, 320); h.ring(h.w3(x), h.d3(y), 0xff8fbf, h.w3(96), 380, 0.5); petalBurst3(f3, { x, y, z: 90 }, looks, { n: 18, speed: 300, up: 0.6, ms: 900, foeY: y }); });
  }
  /** A bound foe: cherry branches break up through the stones round it (cracks and stone dust at their roots) and curl in
   *  over it (the near ones low, so the foe stays in sight); petals come off them and drift down all through the bind; at
   *  its end they wither back into the floor. */
  private cage(x: number, y: number, hold: number): void {
    const life = hold + 120, grow = 240 / life, wither = (hold - 180) / life;
    ([[-34, -6, 64, false], [34, -6, 60, false], [-28, 7, 48, true], [30, 7, 46, true]] as const).forEach(([dx, dy, w, near], i) => {
      const ph = rnd(0, 6), lean = (dx > 0 ? -10 : 10) + rnd(-3, 3), al = near ? 0.9 : 1, rx = x + dx, ry = y + dy + 4;
      this.floor('crack', rx, ry, 30, life + 300, { angle: rnd(0, 360) + CRACK_TILT, squash: 0.5, delay: i * 30, depth: GROUND + 1.6, tint: 0x4a2418, a: kf([0, 0], [0.04, 0.75], [0.8, 0.6], [1, 0]) });
      this.spr({ name: 'dust', x: rx, y: ry, oy: 0.85, depth: ry + 2, w: 40, delay: i * 30, life: 380, tint: DUST, sx: kf([0, 0.4], [1, 1.2, out3]), sy: kf([0, 0.4], [1, 1.05, out3]), a: kf([0, 0.65], [1, 0, inQ]), my: (u) => -6 * u });
      this.spr({ name: i % 2 ? 'branch_2' : 'branch_1', x: rx, y: ry, oy: 0.97, depth: y + (near ? 3 : -3), w: w + rnd(-3, 3), life, delay: i * 30, flipX: dx < 0,
        sy: kf([0, 0], [grow, 1, back], [wither, 1], [1, 0, inQ]), sx: kf([0, 0.5], [grow, 1, out], [wither, 1], [1, 0.7]), rot: (u) => lean + 3 * Math.sin((u * life) / 220 + ph), a: kf([0, al], [wither, al], [1, 0]) });
    });
    for (let t = 260; t < hold - 120; t += rnd(110, 190)) this.fallPetal(x + rnd(-36, 36), y - rnd(50, 86), y + rnd(-4, 10), t); // (petals coming off the branches)
    this.later(hold - 160, () => this.petals(x, y - 50, 8, 50, { depth: y + 4 }));
  }
  /** A petal coming off a branch: it drifts down, swaying and turning, and lies a moment on the floor before it fades. */
  private fallPetal(x: number, y0: number, floorY: number, delay: number): void {
    const drop = floorY - y0, life = 900 + drop * 4, sw = rnd(8, 16), ph = rnd(0, 6), spin = rnd(-260, 260), land = 0.7;
    this.spr({ name: `petal_${1 + Math.floor(Math.random() * 4)}`, x, y: y0, w: rnd(12, 16), life, delay, depth: floorY + 2, angle: rnd(0, 360),
      mx: (u) => Math.sin(Math.min(u, land) * 9 + ph) * sw * Math.min(1, u * 4), my: (u) => drop * Math.min(1, u / land), rot: (u) => spin * Math.min(u, land),
      sx: (u) => (u < land ? 0.55 + 0.45 * Math.abs(Math.cos(u * 10 + ph)) : 1), a: kf([0, 0], [0.08, 1], [0.86, 1], [1, 0]) });
  }

  /** Dragon Ascension: the golden dragon crest turns on the floor through the wind-up (the ultimate's dragon is crimson —
   *  this one is gold: they never read alike). */
  private ascension(r: CastRun): void {
    const T = r.timings, q = this.me(r);
    this.floor(tn('sigil_dragon', 'gold'), q.x, q.y, 300, T.startup + T.active + 500, { spin: -200 * sideOf(r), run: r, glow: 0.35,
      a: kf([0, 0], [0.12, 1], [0.8, 1], [1, 0]), s: kf([0, 0.6], [0.2, 1, out3]) });
    this.glint(r, T.startup * 0.4, 28, 62);
  }
  /** The golden dragon breaks out of the floor and spirals up round him as high as it carries the foes, then flies off. */
  private ascensionBurst(r: CastRun): void {
    const q = this.me(r), cx = q.x, cy = q.y, side = sideOf(r), cam = this.ctx.cam();
    // (slim and behind the fighters: a wide gold burst and column covered both in PVP 3D — DFO; the dragon is the show)
    this.spr({ name: tn('launch_beam', 'gold'), x: cx + side * 30, y: cy + 4, oy: 0.95, depth: cy - 3, w: 96, h: 250, life: 300, glow: 0.25, sx: kf([0, 0.6], [1, 0.8]), sy: kf([0, 0.2], [0.3, 1, out3], [1, 1.15]), a: kf([0, 0.7], [0.35, 0.6], [1, 0, inQ]) });
    this.spr({ name: tn('launch_streaks', 'gold'), x: cx + side * 30, y: cy + 6, oy: 0.97, depth: cy - 2.9, w: 80, h: 240, life: 420, glow: 0.25, my: (u) => -46 * out(u),
      sy: kf([0, 0.25], [0.3, 1, out3], [1, 1.2]), sx: kf([0, 0.7], [0.3, 1]), a: kf([0, 0.85], [0.45, 0.7], [1, 0, inQ]) });
    this.shock(cx, cy, 300, { tone: 'gold' }); this.dustRing(cx, cy, 260); this.dust(cx - 60, cy, 110); this.dust(cx + 60, cy, 110, 40);
    // the dragon bursts out of the floor just in front of him and climbs into the sky in long S-curves — its whole body
    // following its head along one path (no seams, nothing jumping), fast out of the floor, slowing near the top — roars
    // there, and melts into sparks from its tail up as it drifts on
    const gx = cx + side * 30, gy = cy + 2, A = 64, LAM = 330, TOPS = 300, RISE = 950, ROAR = 0.8, MELT0 = 900, MELT = 520, d = cy - 4; // (its jaws stay in sight at the top; it climbs behind the fighters, both read in front of it — DFO)
    const path = (sv: number): Pt => { const e = Math.min(1, Math.max(0, sv) / 150), w = e * e * (3 - 2 * e); return { x: gx + side * A * w * Math.sin((sv / LAM) * Math.PI * 2), y: gy - sv, d }; };
    const drg = this.serpent(42, { glow: 0.24, flip: side < 0, tone: 'gold' }); // (slimmer)
    let roared = false, nextSpark = 0, nextPetal = 0;
    this.add({ t: 0, step: (_dt, t) => {
      if (this.gone(r)) { drg.destroy(); return false; }
      const u = Math.min(1, t / RISE), neck = -40 + (TOPS + 40) * out3(u) + Math.max(0, t - RISE) * 0.2, melt = Math.max(0, (t - MELT0) / MELT);
      drg.place(path, neck, Math.min(1, t / 90), Math.min(1, melt));
      if (t >= nextPetal && melt < 0.5) { nextPetal = t + 60; const p = drg.at(path, neck, 0.9); this.sparks(p.x, p.y, 1, 24, { tone: 'gold', depth: p.d + 1, life: 600 }); }
      if (!roared && u >= ROAR) { roared = true; const n = path(neck), a0 = Math.atan2(n.y - path(neck - 8).y, n.x - path(neck - 8).x); this.roar(r, { x: n.x + Math.cos(a0) * 150, y: n.y + Math.sin(a0) * 150, d: n.d }); }
      if (melt > 0 && melt < 1 && t >= nextSpark) { // it scatters into sparks where it melts
        nextSpark = t + 30;
        for (let k = 0; k < 2; k++) { const p = drg.at(path, neck, Math.min(1, melt * 1.2 - 0.1 + rnd(-0.04, 0.04))); this.pop(tn('spark_s', 'gold'), p.x + rnd(-12, 12), p.y + rnd(-12, 12), rnd(34, 56), { life: 240, depth: p.d + 2, glow: 0.5 }); }
      }
      if (melt >= 1) { drg.destroy(); return false; }
      return true;
    } });
    if (r.own) { cam.shake(220, 0.007); this.ctx.punch(0.035, 240); }
  }
  /** At the top of its climb the dragon roars: a burst at its jaws, a ring of air thrown out, petals, the screen shakes. */
  private roar(r: CastRun, p: Pt): void {
    this.pop(tn('burst', 'gold'), p.x, p.y, 220, { life: 380, depth: TOP + 3, angle: 0, glow: 0.5 });
    this.spr({ name: tn('shock_ring', 'gold'), x: p.x, y: p.y + 6, depth: TOP + 2.8, w: 300, h: 190, life: 480, glow: 0.6,
      sx: kf([0, 0.2], [1, 1.25, out3]), sy: kf([0, 0.2], [1, 1.25, out3]), a: kf([0, 1], [0.35, 1], [1, 0, inQ]) });
    this.sparks(p.x, p.y, 16, 150, { tone: 'gold', depth: TOP + 2.5 });
    if (r.own) { this.ctx.cam().shake(170, 0.006); this.ctx.punch(0.02, 160); }
  }

  // ------------------------------------------------------------------ God of Blades: the halo

  /** Eight ghost katanas rise one by one into a fan behind him, a golden halo at their heart; they stay for the buff. Each
   *  is drawn solid with its light added over it (they read on bright floors too). */
  private halo(r: CastRun): void {
    const L = r.skill.linger, s = this.ctx.scene; if (!L) return;
    this.endHalo(r.attackerId, true);
    const c = this.me(r), side = sideOf(r), until = r.timings.startup + L.startMs + L.everyMs * L.count, ADD = Phaser.BlendModes.ADD;
    const ring = (add: boolean) => { const im = s.add.image(c.x, c.y - c.z - 74, KIT, 'halo_gold').setAlpha(0); if (add) im.setBlendMode(ADD); return im.setScale(HALO / im.width); };
    const kg = this.fname(tn('katana_ghost', 'gold')); // (golden katanas round the golden halo)
    const blade = (add: boolean) => { const im = s.add.image(c.x, c.y - c.z - 70, KIT, kg).setOrigin(0.5, 0.9).setAlpha(0); if (add) im.setBlendMode(ADD); return im.setScale(KATANA / im.height); };
    this.halos.set(r.attackerId, { run: r, imgs: Array.from({ length: 8 }, () => blade(false)), gls: Array.from({ length: 8 }, () => blade(true)), halo: ring(false), hg: ring(true),
      t: 0, until, lastX: c.x, face: side, next: 0, away: new Set(), spent: new Set() });
  }

  /** His buffs end (he fell, a new round): the halo and the party mark go. */
  clearHalo(attackerId: string, now = false): void { this.endHalo(attackerId, now); this.clearMark(attackerId, now); this.scabEnd(attackerId, now ? 'gone' : 'scatter'); }

  // ------------------------------------------------------------------ God of Blades: the party mark

  /** God of Blades shared with a party member (David: a party sees who is buffed): the halo of blades in miniature turns over
   *  his head for as long as he has the +15% — a new share renews it; it goes when he falls or his buffs end. The caster
   *  carries the halo itself (the mark hides while a halo of his own stands behind him). */
  godMark(id: string, ms: number): void {
    if (!this.ready || ms <= 0) return;
    const m = this.marks.get(id);
    if (m) { m.until = Math.max(m.until, m.t + ms); return; }
    const s = this.ctx.scene, mk = (add: boolean) => { const im = s.add.image(0, 0, KIT, 'halo_gold').setVisible(false); if (add) im.setBlendMode(Phaser.BlendModes.ADD); return im; };
    this.marks.set(id, { t: 0, until: ms, ims: [mk(false), mk(true)] });
  }
  private clearMark(id: string, now = false): void {
    const m = this.marks.get(id); if (!m) return;
    this.marks.delete(id);
    if (now) { for (const im of m.ims) im.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: m.ims, alpha: 0, duration: 300, onComplete: () => { for (const im of m.ims) im.destroy(); } });
  }
  private stepMarks(dt: number): void {
    for (const [id, m] of this.marks) {
      m.t += dt;
      const p: (V3 & { h?: number }) | null = this.ctx.targetPos?.(id) ?? this.ctx.casterPos(id);
      if (!p || m.t >= m.until || this.ctx.alive?.(id) === false) { this.clearMark(id); continue; }
      const on = Math.min(1, m.t / 300) * Math.min(1, (m.until - m.t) / 500) * this.seen(id) * (this.halos.has(id) ? 0 : 1);
      const k = (MARK_W / m.ims[0].width) * (0.5 + 0.5 * back(Math.min(1, m.t / 320))) * (1 + 0.04 * Math.sin(m.t / 320)), ang = m.t * 0.03;
      const x = p.x, y = p.y - p.z - (p.h ?? 96) - MARK_W * 0.8 + 2 * Math.sin(m.t / 450); // (just over the head: clear of his hair's crest)
      m.ims[0].setVisible(on > 0.01).setPosition(x, y).setScale(k).setAngle(ang).setDepth(TOP + 1).setAlpha(0.95 * on);
      m.ims[1].setVisible(on > 0.01).setPosition(x, y).setScale(k * 1.05).setAngle(ang).setDepth(TOP + 1.01).setAlpha((0.3 + 0.12 * Math.sin(m.t / 200)) * on);
    }
  }

  // ------------------------------------------------------------------ the fallen petals (SamuraiPetals: continuity)

  /** A petal's picture as a texture of its own (the 3D card piece lays it on the planks): cut from the kit once. */
  petalLook(k: number): { tex: string; size: number; aspect: number } | null {
    const s = this.ctx.scene, name = `petal_${1 + (((k % 4) + 4) % 4)}`, key = `sam-${name}`;
    if (!this.ready) return null;
    const fr = s.textures.getFrame(KIT, name); if (!fr) return null;
    const w = fr.cutWidth || fr.width, h = fr.cutHeight || fr.height;
    if (!s.textures.exists(key)) s.textures.createCanvas(key, w, h)?.drawFrame(KIT, name, 0, 0);
    return { tex: key, size: 0.8, aspect: h / w };
  }

  /** A drift laid (the painted arena, the world): its petals flutter down from `from` (where the blossom cut / bloomed) onto
   *  their spots on the floor and lie there, flat, in their own colours. */
  driftLay(key: string, pts: { x: number; y: number; k: number }[], from: V3): void {
    if (!this.ready) return;
    this.driftGo(key, 'gone');
    const s = this.ctx.scene, rnd = (a: number, b: number) => a + Math.random() * (b - a);
    // (each petal in its own colours, a soft light over it: on the painted floors they sank into the gold)
    const ims = pts.flatMap((p) => [0, 1].map((g) => { const im = s.add.image(from.x, from.y - from.z, KIT, `petal_${1 + p.k}`).setDepth(GROUND + 2.6).setVisible(false); if (g) im.setBlendMode(Phaser.BlendModes.ADD); return im; }));
    this.drifts.set(key, { ims, pts, from: { x: from.x, y: from.y - from.z }, t: 0, mode: 'fall', t0: 0, ang: pts.map(() => rnd(0, 360)), w: pts.map(() => rnd(16, 21)) });
  }

  /** A drift goes: 'wind' (its time is up: lifted and carried off), 'gather' (into the scabbard of `to`), 'gone' (at once). */
  driftGo(key: string, how: 'wind' | 'gather' | 'gone', to?: string): void {
    const d = this.drifts.get(key); if (!d) return;
    if (how === 'gone') { for (const im of d.ims) im.destroy(); this.drifts.delete(key); return; }
    d.mode = how; d.t0 = d.t; d.to = to;
  }

  /** The scabbard of `id` holds `n` gathered petals: a soft pink glow at its mouth, petals circling it (more petals, more
   *  of them) — until his blossom draw, or after `ms` they scatter (lost). */
  scabbard(id: string, n: number, ms: number): void {
    if (!this.ready) return;
    const had = this.scabs.get(id);
    if (had) { had.n += n; had.until = had.t + ms; return; }
    const s = this.ctx.scene, ADD = Phaser.BlendModes.ADD;
    const glow = s.add.image(0, 0, KIT, 'glint').setBlendMode(ADD).setTint(0xff9ec8).setVisible(false);
    const ims = Array.from({ length: 8 }, (_, j) => s.add.image(0, 0, KIT, `petal_${1 + (j % 4)}`).setVisible(false));
    this.scabs.set(id, { n, t: 0, until: ms, drawing: false, glow, ims });
  }
  /** The scabbard's petals go: 'draw' (the blossom draw took them: they burst along its line, drawn there), 'scatter'
   *  (unused: blown off his hip), 'gone' (at once). */
  private scabEnd(id: string, how: 'draw' | 'scatter' | 'gone'): void {
    const sc = this.scabs.get(id); if (!sc) return;
    this.scabs.delete(id);
    if (how === 'scatter') { const c = this.ctx.casterPos(id); if (c) this.petals(c.x, c.y - c.z - 50, Math.min(8, 2 + Math.ceil(sc.n / 3)), 70, { depth: c.y + 3, life: 900 }); }
    for (const im of [sc.glow, ...sc.ims]) im.destroy();
  }

  private stepPetals(dt: number): void {
    for (const [key, d] of this.drifts) {
      d.t += dt;
      let alive = 0;
      d.ims.forEach((im, ji) => {
        const j = ji >> 1, lit = ji & 1, p = d.pts[j], fr = im.frame, k = d.w[j] / (fr.cutWidth || fr.width), al = lit ? 0.24 : 0.95;
        if (d.mode === 'fall' || d.mode === 'lie') { // fluttering down onto its spot, then lying flat
          const u = Math.min(1, Math.max(0, (d.t - j * 60) / (520 + (j % 3) * 90))), e = out(u), sway = Math.sin(u * 7 + j) * 9 * (1 - u);
          const x = d.from.x + (p.x - d.from.x) * e + sway, y = d.from.y + (p.y - d.from.y) * (u * u * 0.4 + e * 0.6);
          im.setVisible(d.t >= j * 60).setPosition(x, y).setScale(k, k * (1 - 0.45 * u)).setAngle(d.ang[j] + (1 - u) * 260).setAlpha(al).setDepth((u < 1 ? p.y + 1 : GROUND + 2.6) + lit * 0.01);
          alive++;
          return;
        }
        if (d.mode === 'wind') { // lifted and carried off, turning, fading
          const u = Math.min(1, (d.t - d.t0 - j * 40) / 760); if (u < 0) { alive++; return; }
          im.setPosition(p.x + 70 * u + Math.sin(u * 6 + j) * 8, p.y - 46 * u * u).setScale(k, k * (0.55 + 0.45 * u)).setAngle(d.ang[j] + 300 * u).setAlpha(al * (1 - u)).setDepth(p.y + 1 + lit * 0.01);
          if (u < 1) alive++;
          return;
        }
        // gather: rising off the floor and flying in an arc into the scabbard
        const c = d.to ? this.ctx.casterPos(d.to) : null, u = Math.min(1, (d.t - d.t0 - j * 25) / 300);
        if (!c) { im.setVisible(false); return; }
        if (u < 0) { alive++; return; }
        const hx = c.x, hy = c.y - c.z - 52, e = out3(u);
        im.setPosition(p.x + (hx - p.x) * e, p.y + (hy - p.y) * e - Math.sin(Math.PI * u) * 40).setScale(k * (1 - 0.4 * u), k * (0.55 + 0.25 * u)).setAngle(d.ang[j] + 540 * u)
          .setAlpha(al * (u < 0.85 ? 1 : (1 - u) / 0.15)).setDepth(c.y + 3 + lit * 0.01);
        if (u < 1) alive++;
      });
      if (d.mode === 'fall' && d.t > d.pts.length * 60 + 720) d.mode = 'lie';
      if (d.mode !== 'fall' && d.mode !== 'lie' && !alive) { for (const im of d.ims) im.destroy(); this.drifts.delete(key); }
    }
    for (const [id, sc] of this.scabs) {
      sc.t += dt;
      const c = this.ctx.casterPos(id);
      if (!c || this.ctx.alive?.(id) === false) { this.scabEnd(id, 'gone'); continue; }
      if (!sc.drawing && sc.t >= sc.until) { this.scabEnd(id, 'scatter'); continue; }
      const vis = this.seen(id), on = Math.min(1, sc.t / 250) * vis, f = this.ctx.body?.(id)?.face ?? 1, mx = c.x + f * 12, my = c.y - c.z - 50;
      sc.glow.setVisible(on > 0.01).setPosition(mx, my).setScale((26 / sc.glow.width) * (1 + 0.15 * Math.sin(sc.t / 140))).setAlpha(on * 0.75).setDepth(c.y + 2.5);
      const shown = Math.min(sc.ims.length, Math.max(1, Math.ceil(sc.n / 2)));
      sc.ims.forEach((im, j) => {
        if (j >= shown) { im.setVisible(false); return; }
        const th = sc.t / 420 + (j / shown) * Math.PI * 2, sn = Math.sin(th), fr = im.frame, k = 11 / (fr.cutWidth || fr.width);
        im.setVisible(on > 0.01).setPosition(mx + Math.cos(th) * 20, my + sn * 9).setScale(k).setAngle(sc.t * 0.25 + j * 50).setAlpha(on * (sn > 0 ? 0.95 : 0.6)).setDepth(c.y + (sn > 0 ? 2.6 : -1));
      });
    }
  }

  /** The blossom draw's petals (the draw itself: `iaiCut`): out of the scabbard along the line, fluttering down. */
  private blossomDraw(r: CastRun, x0: number, y0: number, ang: number, len: number): void {
    const n = Math.min(16, r.petals ?? 0); if (!n) return;
    const c = Math.cos(ang * Math.PI / 180), sn = Math.sin(ang * Math.PI / 180);
    this.scabEnd(r.attackerId, 'draw');
    this.pop(tn('burst', 'sakura'), x0, y0, 96, { life: 240, glow: 0.3 });
    for (let j = 0; j < n; j++) {
      const f = (j + 0.5 + Math.random() * 0.6) / (n + 0.6), d = len * f, off = (Math.random() - 0.5) * 34, tx = c * d - sn * off, ty = sn * d + c * off * 0.5, life = 700 + Math.random() * 400, fly = 0.22 + 0.2 * f;
      this.spr({ name: `petal_${1 + (j % 4)}`, x: x0, y: y0, depth: TOP + 2, w: 13 + Math.random() * 6, life, angle: Math.random() * 360,
        mx: (u) => tx * out3(Math.min(1, u / fly)), my: (u) => ty * out3(Math.min(1, u / fly)) + 40 * Math.max(0, u - fly) * Math.max(0, u - fly),
        rot: (u) => 420 * u, a: kf([0, 1], [0.7, 1], [1, 0]), sx: (u) => 0.55 + 0.45 * Math.abs(Math.cos(u * 9 + j)) });
    }
  }
  /** The blossom draw's extra cuts (the Iai's hits after the draw): a pink stroke along the line a beat apart, a few
   *  petals where it bites. */
  private bloomAt = new Map<string, number>();
  private blossomCut(r: CastRun, i: number): void {
    const sh = r.hits[i]?.shape as { length?: number; range?: number } | undefined, a = r.aim, q = this.me(r), len = sh?.length ?? sh?.range ?? 200, fl = a.x < -0.01; // (the Iai's draws are projectiles now: their range — DFO 23 Oct)
    const ang = screenAng(a.x, a.y) + (i % 2 ? 3 : -3), off = i % 2 ? 7 : -7, x0 = q.x + a.x * 8, y0 = q.y + a.y * 4 - q.z - 46 + off;
    // (70 ms apart on screen: under the draw's hit-stop the runtime fires them all while the picture is held — staggered
    // from the first one's moment, they still come one after another)
    if (i === 1 || !this.bloomAt.has(r.castId)) { this.bloomAt.set(r.castId, this.clock); if (this.bloomAt.size > 20) this.bloomAt.delete(this.bloomAt.keys().next().value!); }
    const delay = Math.max(0, this.bloomAt.get(r.castId)! + (i - 1) * 70 - this.clock);
    this.spr({ name: tn('cut_line', 'rose'), x: x0, y: y0, ox: 0.03, angle: ang, flipY: fl, w: len * (0.9 + 0.05 * i), h: 14, depth: TOP + 3, life: 260, delay, glow: 0.5, tint: 0xffc2e0,
      sx: kf([0, 0.05], [0.18, 1, out3]), sy: kf([0, 1.3], [0.18, 1], [1, 0.2, inQ]), a: kf([0, 1], [0.5, 1], [1, 0, inQ]) });
    const f = 0.35 + Math.random() * 0.5, c = Math.cos(ang * Math.PI / 180), sn = Math.sin(ang * Math.PI / 180);
    this.petals(x0 + c * len * f, y0 + sn * len * f, 4, 40, { depth: TOP + 2, life: 700, delay });
  }

  private endHalo(attackerId: string, now = false): void {
    const h = this.halos.get(attackerId); if (!h) return;
    this.halos.delete(attackerId);
    const all = [...h.imgs, ...h.gls, h.halo, h.hg];
    if (now) { for (const o of all) o.destroy(); return; }
    this.ctx.scene.tweens.add({ targets: all, alpha: 0, duration: 300, onComplete: () => { for (const o of all) o.destroy(); } });
  }

  private haloSlot(h: Halo, k: number, c: V3): { x: number; y: number; ang: number } {
    const th = Phaser.Math.DegToRad(-160 + (k / 7) * 140 + 3 * Math.sin(h.t / 600 + k)), px = c.x - h.face * 12, py = c.y - c.z - 70;
    const dx = Math.cos(th) * 52 * h.face, dy = Math.sin(th) * 46; // (the first of them behind his back)
    return { x: px + dx, y: py + dy, ang: Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90 };
  }

  private stepHalos(dt: number): void {
    for (const [id, h] of this.halos) {
      const c = this.ctx.casterPos(id);
      h.t += dt;
      if (!c || h.t >= h.until || this.broken(h.run) || this.ctx.alive?.(id) === false) { this.endHalo(id); continue; } // (cast broken off before the buff: no halo)
      const f = this.ctx.body?.(id)?.face; // (the way he faces; a double: the way it moves)
      if (f) h.face = f; else if (Math.abs(c.x - h.lastX) > 0.5) h.face = c.x > h.lastX ? 1 : -1;
      h.lastX = c.x;
      const vis = this.seen(id), rise = Math.min(1, h.t / 600) * vis, breathe = 1 + 0.04 * Math.sin(h.t / 300), hx = c.x - h.face * 12, hy = c.y - c.z - 72, hk = (HALO / h.halo.width) * breathe;
      const left = 1 - h.spent.size / 8 * 0.45; // (the halo dims as its katanas are spent)
      h.halo.setPosition(hx, hy).setDepth(c.y - 2.2).setAlpha(0.85 * rise * left).setAngle(h.t * 0.02).setScale(hk);
      h.hg.setPosition(hx, hy).setDepth(c.y - 2.19).setAlpha(rise * left * (0.32 + 0.1 * Math.sin(h.t / 170))).setAngle(h.t * 0.02).setScale(hk * 1.03);
      h.imgs.forEach((im, k) => {
        if (h.away.has(k) || h.spent.has(k)) return;
        const p = this.haloSlot(h, k, c), on = Math.min(1, Math.max(0, (h.t - k * 70) / 160)) * vis;
        im.setPosition(p.x, p.y).setAngle(p.ang).setDepth(c.y - 1.6).setAlpha(0.95 * on);
        h.gls[k].setPosition(p.x, p.y).setAngle(p.ang).setDepth(c.y - 1.59).setAlpha(on * (0.3 + 0.12 * Math.sin(h.t / 140 + k)));
      });
    }
  }

  /** God of Blades strike: a katana of the halo turns on the foe and flies at it (its afterimages behind it), stabs down
   *  into it and stays in a moment, shuddering, then pulls out and fades away — it is spent: the halo has one fewer (eight
   *  strikes in all, LegacyCourtyardScene.bladeStrikes). The hit lands as it arrives (150 ms); it follows the foe it was
   *  thrown at (`targetId`). */
  bladeStrike(attackerId: string, to: V3, targetId?: string): void {
    const h = this.halos.get(attackerId), c = this.ctx.casterPos(attackerId); if (!h || !c || !this.ready || h.next >= 8) return;
    const k = BLADE_ORDER[h.next++];
    const im = h.imgs[k], gl = h.gls[k]; if (!im) return;
    h.away.add(k); h.spent.add(k);
    this.sparks(im.x, im.y - 20, 4, 30, { tone: 'gold', depth: c.y + 2 }); // (sparks of gold left where it was)
    const FLY = 150, STICK = 210, OUT = 130, L = KATANA * 0.9, IN = 26, sx = im.x, sy = im.y, a0 = im.angle, kk = KATANA / im.height, kw = (KATANA * im.width) / im.height;
    const goal = () => { const t = targetId ? this.ctx.targetPos?.(targetId) : null; return t ? { x: t.x, y: t.y - t.z - 78 } : { x: to.x, y: to.y - to.z - 38 }; };
    // the stab: from where it flies, at least this steep (it comes down from the halo)
    const g0 = goal(), d0 = Math.hypot(g0.x - sx, g0.y - sy) || 1;
    let dx = (g0.x - sx) / d0, dy = (g0.y - sy) / d0;
    if (dy < 0.6) { dy = 0.6; dx = (dx < 0 ? -1 : 1) * 0.8; }
    const aim = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90, turn = Phaser.Math.Angle.ShortestBetween(a0, aim);
    let last = -99, struck = false;
    im.setDepth(TOP + 2); gl.setDepth(TOP + 2.01);
    this.add({ t: 0, step: (_dt, t) => {
      if (!im.scene) return false; // (the halo is gone)
      const g = goal(), hx = g.x - dx * (L - IN), hy = g.y - dy * (L - IN); // the hilt, with the tip in the foe
      if (t < FLY) {
        const u = t / FLY, e = 0.25 * u + 0.75 * u * u, x = sx + (hx - sx) * e, y = sy + (hy - sy) * e - 34 * Math.sin(Math.PI * u), ang = a0 + turn * out3(Math.min(1, u / 0.35));
        im.setPosition(x, y).setAngle(ang).setScale(kk).setAlpha(1); gl.setPosition(x, y).setAngle(ang).setScale(kk * 1.05).setAlpha(0.55);
        if (t - last > 22) { last = t; this.spr({ name: tn('katana_ghost', 'gold'), x, y, oy: 0.9, w: kw, h: KATANA, angle: ang, add: true, life: 150, depth: TOP + 1.9, a: kf([0, 0.42], [1, 0, inQ]) }); }
        return true;
      }
      if (!struck) { struck = true; this.pop(tn('spark_s', 'gold'), g.x, g.y, 66, { life: 200, depth: TOP + 3, glow: 0.5 }); }
      const e = t - FLY;
      if (e < STICK + OUT) { // in the foe, shuddering — then pulled out, fading
        const j = e < STICK ? 2.4 * (1 - e / STICK) * Math.sin(e / 9) : 0, pull = e < STICK ? 0 : out((e - STICK) / OUT) * 18, al = e < STICK ? 1 : 1 - (e - STICK) / OUT;
        const x = hx - dx * pull + j, y = hy - dy * pull;
        im.setPosition(x, y).setAngle(aim).setAlpha(al); gl.setPosition(x, y).setAngle(aim).setAlpha(0.5 * al);
        return true;
      }
      im.setAlpha(0); gl.setAlpha(0);
      h.away.delete(k);
      return false;
    } });
  }

  // ------------------------------------------------------------------ Sword Wave: the flying crescent

  /** Sword Wave: a crescent of crimson sword energy flying along its path (its own tail of light behind it), the trail of
   *  the fling at his blade; on impact (a foe, a wall, its end) it shatters into shards and petals. */
  projectile(p: Projectile): void {
    if (!this.ready || (this.in3d() && p.skill.id === 'sword_wave')) return; // (PVP 3D: the crescent riding the shot is the room's — fx3d/samurai.ts)
    if (p.skill.id === 'iai_strike') return; // (the Iai's draws are hits now — DFO 23 Oct; their crescents are drawn by the draw itself, here and in the room)
    this.withOwn(null, () => this.projectileOne(p)); // (a crescent in flight is never cut short: it is the blow itself)
  }
  private projectileOne(p: Projectile): void {
    const s = this.ctx.scene, wc = this.fname(tn('wave_crescent', 'gold')); // (a golden crescent moon)
    const mk = (add: boolean) => s.add.image(p.x, p.y - p.z, KIT, wc).setOrigin(0.76, 0.5).setBlendMode(add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setDepth(p.y + 2);
    const im = mk(false), gl = mk(true).setAlpha(0.45);
    const me = this.ctx.casterPos(p.attackerId), ghosts = me ? (this.ctx.ghosts?.(p.attackerId) ?? []).map((g) => ({ im: mk(false), dx: g.x - me.x, dy: g.y - me.y })) : [];
    this.waves.set(p, { im, gl, t: 0, trail: 0, ghosts }); // (the doubles throw theirs too: the same crescent beside his)
    if (me) { // the fling: the trail of the swing at his blade
      const fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy);
      this.spr({ name: tn('blade_trail', 'gold'), x: me.x + p.dx * 30, y: me.y - me.z - 52, w: 150, life: 200, flipX: fl, angle: along(ang, fl), glow: 0.3,
        sx: kf([0, 0.6], [0.25, 1, out3]), a: kf([0, 0.9], [1, 0, inQ]) });
    }
  }
  /** Sword Wave's ink shadow (David 18 Oct 01:15: "the crescent and its shadow"; its linger's tick, 700 ms after the
   *  throw): where the line ends the crescent comes back as its black shadow — only its rim lit crimson — racing along the
   *  planks back to where he threw it (it drags the foe it meets: the scene's pull), a crimson furrow torn behind it. */
  waveReturn(id: string, from: { x: number; y: number }, aim: { x: number; y: number }, len: number): void {
    if (!this.ready) return;
    const ax = aim.x, ay = aim.y, n = Math.hypot(ax, ay) || 1, ux = ax / n, uy = ay / n, x0 = from.x + ux * len, y0 = from.y + uy * len, dir = ux < 0 ? 1 : -1; // (it flies back: toward the thrower)
    const MS = 280, pt = { x: x0, y: y0, z: 0, done: false };
    const f3 = this.fx3d();
    if (f3 && waveBack(f3, id, from, aim, len)) return; // (PVP 3D: the crescent waiting at its end flies back itself — fx3d/samurai.ts)
    if (f3) {
      ring3(f3, { x: x0, y: y0, z: 0 }, dir, { r: 112, w: 46, y0: 104, fwd: -90, tilt: 90, yaw: 0, a0: -34, a1: 164, ms: 2000, sweep: 0.04, fill: 1, inkW: 0.44, lit: SAM3.rose, gain: 1.1, shadow: true,
        follow: () => (pt.done ? null : pt), until: () => pt.done, fade: 110 }); // (its rim in rose: crimson added to the red planks showed nothing; gone into his blade at once)
      inkBurst3(f3, { x: x0, y: y0, z: 90 }, { r: 70, n: 8, ms: 360, foeY: y0 - 40 }); // (it turns to ink where the line ends)
    }
    let t = 0, lx = x0, ly = y0;
    const im = f3 ? null : this.spr({ name: 'wave_crescent', x: x0, y: y0 - 50, ox: 0.76, w: 170, life: MS + 160, flipY: dir < 0, angle: dir < 0 ? 180 : 0, tint: 0x14030a, depth: y0 + 2, a: kf([0, 0.95], [0.8, 0.95], [1, 0, inQ]) }); // (the painted world: the crescent in ink)
    this.add({ t: 0, step: (dt) => {
      t += dt; const u = Math.min(1, t / MS), e = u; // (flat out all the way home: eased, it hung by him at the end)
      pt.x = x0 - ux * len * e; pt.y = y0 - uy * len * e;
      if (im) im.setPosition(pt.x, pt.y - 50).setDepth(pt.y + 2);
      if (Math.hypot(pt.x - lx, pt.y - ly) > 26) {
        if (f3) f3.floorStreak(lx, ly, pt.x, pt.y, SAM3.crimson, { w: 8, ms: 380, a: 0.4 });
        else this.spr({ name: 'ink_short', x: (lx + pt.x) / 2, y: (ly + pt.y) / 2 - 4, w: 70, h: 18, depth: pt.y - 1, life: 360, flipX: dir < 0, a: kf([0, 0.7], [1, 0, inQ]) });
        lx = pt.x; ly = pt.y;
      }
      if (u >= 1) { pt.done = true; this.pop('glint', from.x, from.y - 56, 70, { life: 180, angle: 0, depth: from.y + 2, glow: 0.4 }); return false; } // (home: a glint where he threw it)
      return true;
    } });
    void id;
  }
  projectileEnd(p: Projectile): void {
    if (!this.waves.has(p)) return;
    this.as({ attackerId: p.attackerId, castId: p.castId, skill: p.skill }, () => this.projectileEndOne(p));
  }
  private projectileEndOne(p: Projectile): void {
    const w = this.waves.get(p); if (!w) return;
    this.waves.delete(p);
    const end = p.end ?? { x: p.x, y: p.y, reason: 'range' as const }, fl = p.dx < -0.01, ang = screenAng(p.dx, p.dy), foe = end.reason === 'target', wall = end.reason === 'cover';
    const G = (n: string) => tn(n, 'gold');
    // (on a foe: the shards burst behind him and the strike a size down — thrown close, level with a foe in the air (the
    // MIKAZUKI trial), the old pile hid both fighters for a third of a second; a wall keeps it whole)
    const shatter = (x: number, y: number, size: number, d: number) => this.spr({ name: G('wave_break'), x, y, w: size, life: foe ? 260 : 320, flipX: fl, angle: along(ang, fl) * 0.3, glow: foe ? 0.25 : 0.35, depth: d,
      sx: kf([0, 0.6], [0.2, 1.05, out3], [1, 1.2]), sy: kf([0, 0.6], [0.2, 1.05, out3], [1, 1.2]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
    const impact = (x: number, y: number, k: number, d: number) => { // it strikes: the crescent flattens against what it hit and bursts, its force spraying on through
      // (on a foe: pushed on into him, flattening less far back — thrown close, it lay over the thrower)
      const ix = foe ? x + (fl ? -1 : 1) * 26 : x;
      this.spr({ name: G('wave_crescent'), x: ix, y, ox: 0.76, angle: ang, flipY: fl, w: (foe ? 104 : 122) * k, depth: TOP + 4.2, life: 150, glow: 0.4,
        sx: kf([0, 1], [1, foe ? 1.2 : 1.5, out]), sy: kf([0, 1], [1, 0.25, inQ]), a: kf([0, 0.85], [1, 0, inQ]) });
      this.spr({ name: G('spark_spray'), x, y, ox: fl ? 0.95 : 0.05, oy: 0.45, flipX: fl, angle: along(ang, fl), depth: d, w: 132 * k, life: 240,
        sx: kf([0, 0.4], [0.25, 1, out3], [1, 1.12]), sy: kf([0, 0.6], [0.25, 1, out3]), a: kf([0, 1], [0.45, 1], [1, 0, inQ]) });
      this.sparks(x, y, Math.round(6 * k), 60 * k, { tone: 'gold', depth: TOP + 3 });
    };
    const size = foe ? 140 : wall ? 150 : 112, behind = foe ? end.y - 1.2 : TOP + 4;
    shatter(end.x, end.y - p.z, size, behind);
    if (foe || wall) impact(end.x, end.y - p.z, foe ? 1 : 0.75, foe ? end.y - 1.1 : TOP + 3.9);
    if (wall) this.dust(end.x, end.y, 90);
    w.im.destroy(); w.gl.destroy();
    for (const g of w.ghosts) { shatter(end.x + g.dx, end.y + g.dy - p.z, size * 0.8, foe ? end.y + g.dy - 1.2 : TOP + 4); g.im.destroy(); }
  }
  private stepWaves(dt: number): void {
    for (const [p, w] of this.waves) {
      w.t += dt;
      const ang = screenAng(p.dx, p.dy) + 3 * Math.sin(w.t / 45), k = 150 / w.im.width, fl = p.dx < -0.01, x = p.x, y = p.y - p.z, pulse = 1 + 0.05 * Math.sin(w.t / 35);
      for (const im of [w.im, w.gl]) im.setPosition(x, y).setAngle(ang).setScale(k * (im === w.gl ? 1.04 : 1), k * pulse).setFlipY(fl).setDepth(p.y + (im === w.gl ? 2.01 : 2));
      for (const g of w.ghosts) g.im.setPosition(x + g.dx, y + g.dy).setAngle(ang).setScale(k, k * pulse).setFlipY(fl).setDepth(p.y + g.dy + 2);
      if (w.t - w.trail > 40) { // afterimages and a petal trail
        w.trail = w.t;
        this.spr({ name: tn('wave_crescent', 'gold'), x, y, ox: 0.76, depth: p.y + 1, w: 150, angle: ang, flipY: fl, add: true, life: 150, a: kf([0, 0.24], [1, 0, inQ]) });
        if (Math.random() < 0.5) this.sparks(x, y, 1, 22, { tone: 'gold', depth: p.y + 1, life: 500 });
      }
    }
  }

  // ------------------------------------------------------------------ passives

  /** Shinsoku: the mid-air dash leaves an ink stroke, a gust and petals behind. */
  shinsoku(x: number, y: number, dir: number): void {
    if (!this.ready) return;
    this.spr({ name: 'ink_short', x: x - dir * 34, y: y - 44, depth: TOP, w: 120, flipX: dir < 0, life: 380, sx: kf([0, 0.5], [0.3, 1.1, out3]), sy: kf([0, 1], [1, 0.5]), a: kf([0, 0.9], [1, 0, inQ]) });
    this.spr({ name: 'wind_lines', x: x - dir * 50, y: y - 40, depth: TOP, w: 110, flipX: dir < 0, add: true, life: 240, mx: (u) => -dir * 30 * u, a: kf([0, 0.8], [1, 0]) });
    this.petals(x - dir * 20, y - 30, 5, 50, { depth: TOP });
  }

  /** Willow Dodge: he slips aside; where he stood, a puff of ink and petals. */
  willowDodge(x: number, y: number, dir: number): void {
    if (!this.ready) return;
    this.spr({ name: 'ink_smoke', x: x - dir * 10, y: y - 50, depth: TOP, w: 96, life: 440, sx: kf([0, 0.55], [1, 1.3, out3]), sy: kf([0, 0.55], [1, 1.3, out3]), a: kf([0, 0.85], [1, 0, inQ]), rot: (u) => 40 * u });
    this.petals(x, y - 50, 9, 70, { depth: TOP });
  }

  /** Final Cut: a ghost katana sweeps through the foe right after the hit. */
  finalCut(at: V3, dir: number, big = false): void {
    if (!this.ready) return;
    const lh = this.lastAny && this.clock - this.lastAny.at < 600 ? this.lastAny.own : null; // (it follows his latest blow: his next skill clears it)
    this.as(lh ? { attackerId: lh.attackerId, castId: lh.castId, skill: { id: lh.skill } } : null, () => this.finalCutOne(at, dir, big));
  }
  private finalCutOne(at: V3, dir: number, big: boolean): void {
    if (this.in3d()) return; // (PVP 3D: the flat ghost blade and its crescent stay out — David's bar: nothing flat over the fight)
    const x = at.x, y = at.y - at.z - 40, k = big ? 1.2 : 1;
    this.spr({ name: 'katana_ghost', x, y, depth: TOP + 5, w: 17 * k, life: 150, oy: 0.5,
      mx: kf([0, -dir * 40], [1, dir * 40, inQ]), my: kf([0, -26], [1, 22, inQ]), angle: dir > 0 ? 125 : 55, rot: (u) => dir * 50 * u, a: kf([0, 0], [0.2, 0.85], [0.75, 0.85], [1, 0]) });
    this.cut('cut_thin', 88 * k, dir * 30, { x, y, depth: TOP + 4, flipX: dir < 0, delay: 50, grow: 40, hold: 25, fade: 110, glow: 0.35 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, real = dt): void {
    this.clock += dt; this.real += real;
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
    this.stepTracked();
    this.stepHalos(dt);
    this.stepMarks(dt);
    this.stepPetals(dt);
    this.stepSuns(dt);
    this.stepWaves(dt);
  }

  destroy(): void {
    for (const id of [...this.halos.keys()]) this.endHalo(id, true);
    for (const id of [...this.marks.keys()]) this.clearMark(id, true);
    for (const k of [...this.drifts.keys()]) this.driftGo(k, 'gone');
    for (const id of [...this.scabs.keys()]) this.scabEnd(id, 'gone');
    for (const id of [...this.suns.keys()]) this.clearSun(id, true);
    for (const [p] of this.waves) this.projectileEnd(p);
    this.live = []; this.incoming = []; this.nexts.clear(); this.lastHit.clear(); this.tracked = [];
  }
}
