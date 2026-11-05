// The Warrior's Siege Warden (Styles.ts, GPT's design — scratchpad styles/warrior_styles.md): the effects of his kit, drawn
// in code from small pieces of their own. GPT's rules for its look: body mechanics, steel scrapes, one small ivory-white
// spark — no constant golden energy, no holy light, no magic lion, no eruption, no light pillar; the gate itself is the show
// (his painted poses): its wings swing open (iron crescents), bite shut (two crescents meeting on him), crash down (a crack in
// the floor and its dust). Presentation only — gameplay never reads any of it; timing comes from the cast's own clock, so
// every client draws the same, and the effect clock stops with the hit-stop.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { FinalSkill, HitEvent } from './SkillTypes';
import type { V3 } from './HitGeometry';
import { styleOfSwitch } from './Styles';

const TOP = 100000;
/** Dark steel, its white-hot scrape, the aged ivory of his heraldry (the one small spark). */
const STEEL = 0xd4dde8, IVORY = 0xfff3dc, HOT = 0xffffff;

export interface WardenCtx {
  scene: Phaser.Scene;
  casterPos(id: string): V3 | null;
  cam(): Phaser.Cameras.Scene2D.Camera;
  punch(amount?: number, ms?: number): void;
}

type Ease = (u: number) => number;
const lin: Ease = (u) => u, out3: Ease = (u) => 1 - Math.pow(1 - u, 3), inQ: Ease = (u) => u * u;
type Key = [number, number, Ease?];
const kf = (...k: Key[]) => (u: number): number => {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1, e] = k[i]; return v0 + (v1 - v0) * (e ?? lin)((u - u0) / Math.max(1e-6, u1 - u0)); }
  return k[k.length - 1][1];
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideOf = (r: CastRun) => (r.aim.x < -0.01 ? -1 : 1);

/** Where the gate's face is in each pose he holds (world px ahead of and over his feet, facing right — read off his painted
 *  frames, tools/heroes/motion/warrior_siege). A chain stage: id#stage. */
const GATE: Record<string, [number, number]> = {
  ws_four_beat: [40, 62], 'ws_four_beat#1': [34, 66], 'ws_four_beat#2': [42, 108], 'ws_four_beat#3': [46, 52], ws_threshold_check: [42, 54],
  ws_lions_clamp: [50, 58], ws_drawbridge_lift: [44, 112], ws_anvil_drop: [40, 96], ws_royal_portcullis: [40, 70], stance: [22, 64],
  ws_sentry_catch: [50, 58], ws_rivet_drive: [48, 60], ws_rearguard_step: [30, 62], ws_crenel_upper: [30, 130], ws_false_gate: [40, 62], 'ws_false_gate:open': [42, 108], ws_crossbar_sweep: [40, 116],
};

/** His pieces, drawn once on canvases: an iron crescent (a wing's sweep, its bite), a hot scrape, a floor crack, dust. */
function textures(s: Phaser.Scene): void {
  if (s.textures.exists('wd-wing')) return;
  const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const t = s.textures.createCanvas(key, w, h); if (!t) return; draw(t.getContext()); t.refresh(); };
  mk('wd-wing', 128, 64, (g) => { // a heavy crescent of moved air behind an iron wing: thick, its leading edge white-hot, thinning to the horns
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(214,224,236,0.8)'); gr.addColorStop(1, 'rgba(150,164,180,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(2, 58); g.quadraticCurveTo(64, -22, 126, 58); g.quadraticCurveTo(64, 18, 2, 58); g.closePath(); g.fill();
  });
  mk('wd-flash', 64, 64, (g) => { // a small hot spark of iron on iron: a white core and four short rays
    const c = 32, gr = g.createRadialGradient(c, c, 0, c, c, 13); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 4; k++) { const L = k % 2 ? 20 : 29; g.save(); g.translate(c, c); g.rotate((k * Math.PI) / 2 + 0.3);
      const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -2.2); g.lineTo(L, 0); g.lineTo(0, 2.2); g.closePath(); g.fill(); g.restore(); }
  });
  mk('wd-scrape', 128, 8, (g) => { // a steel scrape: a spark streak, hot at its head
    for (const [y, a] of [[2, 0.35], [3, 1], [4, 1], [5, 0.35]] as const) {
      const lg = g.createLinearGradient(0, 0, 128, 0); lg.addColorStop(0, 'rgba(255,220,170,0)'); lg.addColorStop(0.7, `rgba(255,236,206,${0.55 * a})`); lg.addColorStop(1, `rgba(255,255,255,${a})`);
      g.fillStyle = lg; g.fillRect(0, y, 128, 1);
    }
  });
  mk('wd-crack', 128, 48, (g) => { // a crack in the planks round the blow (drawn flat: squashed on the floor)
    g.strokeStyle = 'rgba(30,22,18,0.85)'; g.lineCap = 'round';
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.2, L = 34 + (k % 3) * 14; g.lineWidth = 3 - (k % 3) * 0.7;
      g.beginPath(); g.moveTo(64, 24); const mx = 64 + Math.cos(a) * L * 0.5 + (k % 2 ? 4 : -4), my = 24 + Math.sin(a) * L * 0.18; g.lineTo(mx, my); g.lineTo(64 + Math.cos(a) * L, 24 + Math.sin(a) * L * 0.36); g.stroke(); }
    g.fillStyle = 'rgba(30,22,18,0.6)'; g.beginPath(); g.ellipse(64, 24, 12, 5, 0, 0, Math.PI * 2); g.fill();
  });
  mk('wd-dust', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(204,190,176,0.6)'); gr.addColorStop(0.6, 'rgba(186,172,160,0.24)'); gr.addColorStop(1, 'rgba(170,160,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}

interface Spr {
  name: string; x: number; y: number; depth?: number; w: number; h?: number; delay?: number; life: number; ox?: number; oy?: number;
  angle?: number; flipX?: boolean; flipY?: boolean; tint?: number; add?: boolean; glow?: number;
  sx?: (u: number) => number; sy?: (u: number) => number; a?: (u: number) => number; rot?: (u: number) => number;
  mx?: (u: number) => number; my?: (u: number) => number; run?: CastRun;
}
interface Live { t: number; step(dt: number, t: number): boolean }

export class WardenFx {
  private live: Live[] = [];
  private incoming: Live[] = [];
  constructor(private ctx: WardenCtx) {}

  // ------------------------------------------------------------------ the piece system

  private add(l: Live): void { this.incoming.push(l); }
  /** Runs `fn` when the cast's own clock reaches `ms` — in step with its hits, through every hit-stop; never if it is cut first. */
  private onClock(r: CastRun, ms: number, fn: () => void): void {
    this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (r.elapsed < ms) return true; fn(); return false; } });
  }
  private me(r: CastRun): V3 { return this.ctx.casterPos(r.attackerId) ?? r.origin; }
  /** The gate's face in the pose this cast holds, where he is now (screen px). */
  private gate(r: CastRun, key = this.poseKey(r)): { x: number; y: number; d: number } {
    const [dx, dz] = GATE[key] ?? GATE.stance, c = this.me(r), side = sideOf(r);
    return { x: c.x + side * dx, y: c.y - c.z - dz, d: c.y };
  }
  private poseKey(r: CastRun): string { return r.skill.chain && r.stage > 0 ? `${r.skill.id}#${r.stage}` : r.skill.id; }
  private shake(r: CastRun | null, ms: number, k: number): void { if (!r || r.own) this.ctx.cam().shake(ms, k); }

  private spr(o: Spr): void {
    const s = this.ctx.scene; textures(s);
    if (!s.textures.exists(o.name)) return;
    const fr = s.textures.getFrame(o.name), bx = o.w / fr.width, by = (o.h ?? (o.w * fr.height) / fr.width) / fr.height;
    const mk = (glow: boolean) => { const im = s.add.image(o.x, o.y, o.name).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setFlipX(!!o.flipX).setFlipY(!!o.flipY).setVisible(false)
      .setBlendMode(glow || o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL); if (o.tint !== undefined) im.setTint(o.tint); return im; };
    const glowA = o.glow !== undefined ? Math.min(o.glow, 0.35) : 0, im = mk(false), gl = glowA ? mk(true) : null;
    this.add({ t: 0, step: (_dt, t) => {
      const e = t - (o.delay ?? 0); if (e < 0) return true;
      if (o.run && o.run.phase === 'done' && !o.run.fired.size) { im.destroy(); gl?.destroy(); return false; }
      const u = Math.min(1, e / o.life), x = o.x + (o.mx?.(u) ?? 0), y = o.y + (o.my?.(u) ?? 0);
      const sx = (o.sx?.(u) ?? 1) * bx, sy = (o.sy?.(u) ?? 1) * by, al = Math.max(0, Math.min(1, o.a?.(u) ?? 1)), ang = (o.angle ?? 0) + (o.rot?.(u) ?? 0), d = o.depth ?? TOP + 3;
      im.setVisible(true).setPosition(x, y).setScale(sx, sy).setAngle(ang).setDepth(d).setAlpha(al);
      gl?.setVisible(true).setPosition(x, y).setScale(sx * 1.06, sy * 1.06).setAngle(ang).setDepth(d + 0.01).setAlpha(al * glowA);
      if (u >= 1) { im.destroy(); gl?.destroy(); return false; }
      return true;
    } });
  }
  /** The one small ivory-white spark of iron on iron. */
  private flash(x: number, y: number, size: number, o: { delay?: number; life?: number; tint?: number; run?: CastRun } = {}): void {
    this.spr({ name: 'wd-flash', x, y, depth: TOP + 4, w: size, life: o.life ?? 140, delay: o.delay, run: o.run, tint: o.tint ?? IVORY, glow: 0.3, add: true, angle: rnd(0, 45),
      sx: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.12]), sy: kf([0, 0.4], [0.25, 1.05, out3], [1, 1.12]), a: kf([0, 1], [0.4, 1], [1, 0, inQ]) });
  }
  /** Sparks off a scrape: a few hot streaks flung out of a point. */
  private sparks(x: number, y: number, n: number, o: { delay?: number; up?: boolean; run?: CastRun } = {}): void {
    for (let k = 0; k < n; k++) {
      const an = o.up ? rnd(-2.6, -0.5) : rnd(-Math.PI, Math.PI), d = rnd(18, 40);
      this.spr({ name: 'wd-scrape', x, y, ox: 0, depth: TOP + 4, w: rnd(16, 26), h: 3, angle: (an * 180) / Math.PI, life: rnd(130, 190), delay: o.delay, run: o.run, add: true,
        mx: (u) => Math.cos(an) * d * out3(u), my: (u) => Math.sin(an) * d * out3(u) + 10 * u * u, a: kf([0, 1], [1, 0]) });
    }
  }
  /** A wing's sweep: a heavy crescent of moved air at a point, turned `angle`, opening as it goes. */
  private wing(x: number, y: number, w: number, angle: number, o: { delay?: number; life?: number; flip?: boolean; flipY?: boolean; run?: CastRun } = {}): void {
    this.spr({ name: 'wd-wing', x, y, depth: TOP + 3, w, angle, flipX: o.flip, flipY: o.flipY, life: o.life ?? 190, delay: o.delay, run: o.run, tint: STEEL, glow: 0.25, add: true,
      sx: kf([0, 0.55], [0.3, 1.05, out3], [1, 1.12]), sy: kf([0, 0.7], [0.3, 1, out3], [1, 0.75]), a: kf([0, 0], [0.08, 0.95], [0.5, 0.8], [1, 0, inQ]) });
  }
  /** The two wings biting shut on a point (the clamp, the portcullis): two iron crescents, their hot edges facing each other,
   *  from `gap` apart to shut in `ms` — the air the wings move as they close, never a drawn gate over his own painted one. */
  private bite(x: number, y: number, w: number, gap: number, ms: number, o: { delay?: number; run?: CastRun } = {}): void {
    for (const s of [-1, 1]) this.spr({ name: 'wd-wing', x, y: y + s * 8, depth: TOP + 3, w, delay: o.delay, run: o.run, life: ms + 140, flipY: s < 0, tint: STEEL, glow: 0.25, add: true,
      my: (u) => { const k = Math.min(1, (u * (ms + 140)) / ms); return s * gap * (1 - out3(k)); },
      sx: (u) => 0.7 + 0.4 * Math.min(1, (u * (ms + 140)) / ms), sy: kf([0, 0.8], [1, 0.6]), a: kf([0, 0], [0.12, 0.85], [0.7, 0.9], [1, 0, inQ]) });
  }
  private dust(x: number, y: number, w: number, delay = 0): void {
    this.spr({ name: 'wd-dust', x, y, oy: 0.7, depth: y + 1, w, delay, life: 440, sx: kf([0, 0.5], [1, 1.6, out3]), sy: kf([0, 0.35], [1, 0.6, out3]), a: kf([0, 0.75], [1, 0, inQ]) });
  }
  private crack(x: number, y: number, w: number, delay = 0): void {
    this.spr({ name: 'wd-crack', x, y, depth: y + 0.5, w, delay, life: 900, sx: kf([0, 0.6], [0.12, 1, out3]), sy: kf([0, 0.6], [0.12, 1, out3]), a: kf([0, 0], [0.05, 0.9], [0.7, 0.7], [1, 0, inQ]) });
  }
  /** A thin streak between two points (the gate driven up, a lunge's track), fading. */
  private streak(x0: number, y0: number, x1: number, y1: number, h: number, life: number, o: { delay?: number; run?: CastRun } = {}): void {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return;
    this.spr({ name: 'wd-scrape', x: x0, y: y0, ox: 0, depth: TOP + 3, w: L, h, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, life, delay: o.delay, run: o.run, add: true, glow: 0.2,
      a: kf([0, 0], [0.12, 0.9], [0.6, 0.7], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ casts

  cast(r: CastRun): void {
    textures(this.ctx.scene);
    const s = r.skill, T = r.timings, side = sideOf(r), key = this.poseKey(r);
    if (styleOfSwitch(s.id)) { // the switch: the gate locks onto his forearm — one ivory glint on it, a wing's short sweep
      this.onClock(r, T.startup * 0.4, () => { const g = this.gate(r, 'stance'); this.wing(g.x, g.y, 90, side < 0 ? 200 : -20, { flip: side < 0, run: r }); });
      this.onClock(r, T.startup, () => { const g = this.gate(r, 'stance'); this.flash(g.x, g.y - 20, 34, { run: r }); });
      return;
    }
    const hitAt = (i: number) => T.startup + (r.hits[i]?.at ?? 0);
    switch (key) {
      case 'ws_four_beat': // Iron Knuckle: THUNK — the gate punched out
        this.onClock(r, hitAt(0), () => { const g = this.gate(r); this.flash(g.x + side * 8, g.y, 28, { run: r }); });
        break;
      case 'ws_four_beat#1': // Gate Elbow: KLANG — a short arc over the gate
        this.onClock(r, T.startup * 0.7, () => { const g = this.gate(r); this.wing(g.x, g.y - 8, 74, side < 0 ? 160 : 20, { flip: side < 0, life: 150, run: r }); });
        break;
      case 'ws_four_beat#2': // Open the Gates: KRR-CHAK — both wings flung apart upward
        this.onClock(r, T.startup * 0.55, () => { const c = this.me(r), g = this.gate(r);
          this.wing(g.x - side * 10, g.y + 34, 112, side < 0 ? 235 : -55, { flip: side < 0, run: r }); this.wing(g.x + side * 18, g.y + 20, 104, side < 0 ? 305 : 55, { flip: side < 0, flipY: true, run: r });
          this.dust(c.x - side * 14, c.y, 70); });
        break;
      case 'ws_four_beat#3': // Portcullis Close: KADUNK — the wings crash shut through him
        this.onClock(r, T.startup * 0.6, () => { const g = this.gate(r); this.wing(g.x, g.y - 26, 104, side < 0 ? 170 : 10, { flip: side < 0, life: 150, run: r }); this.wing(g.x, g.y + 26, 104, side < 0 ? 190 : -10, { flip: side < 0, flipY: true, life: 150, run: r }); });
        this.onClock(r, hitAt(0), () => { const c = this.me(r), g = this.gate(r); this.flash(g.x + side * 10, g.y, 46, { run: r }); this.sparks(g.x + side * 10, g.y, 4, { run: r }); this.dust(c.x + side * 20, c.y, 80); this.shake(r, 80, 0.002); });
        break;
      case 'ws_threshold_check': // the lunge behind the gate: dust kicked back from his feet, a scrape where it lands
        this.onClock(r, T.startup, () => { const c = this.me(r); this.dust(c.x - side * 24, c.y, 64); this.streak(c.x - side * 60, c.y - c.z - 40, c.x, c.y - c.z - 40, 5, 200, { run: r }); });
        this.onClock(r, hitAt(0), () => { const g = this.gate(r); this.flash(g.x + side * 6, g.y, 36, { run: r }); this.sparks(g.x + side * 6, g.y, 3, { run: r }); });
        break;
      case 'ws_lions_clamp': // the jaws open round him, then bite shut
        this.onClock(r, T.startup * 0.5, () => { const g = this.gate(r); this.bite(g.x + side * 14, g.y, 70, 44, Math.max(60, hitAt(0) - T.startup * 0.5), { run: r }); });
        this.onClock(r, hitAt(0), () => { const g = this.gate(r); this.flash(g.x + side * 14, g.y, 40, { run: r }); this.sparks(g.x + side * 14, g.y, 4, { run: r }); this.shake(r, 70, 0.0018); });
        break;
      case 'ws_drawbridge_lift': // both wings swung up like a drawbridge: dust off the floor, one great crescent rising through him
        this.onClock(r, T.startup * 0.6, () => { const c = this.me(r); this.dust(c.x + side * 30, c.y, 90); });
        this.onClock(r, hitAt(0), () => { const g = this.gate(r), c = this.me(r);
          this.wing(c.x + side * 52, c.y - c.z - 70, 140, side < 0 ? 250 : -70, { flip: side < 0, life: 220, run: r });
          this.streak(c.x + side * 56, c.y - c.z - 10, c.x + side * 56, c.y - c.z - 170, 6, 240, { run: r }); this.flash(g.x, g.y, 40, { run: r }); });
        break;
      case 'ws_sentry_catch': { // the wings held open in a V; a blow caught between them: they snap shut on the striker (its moment is the counter's)
        this.onClock(r, T.startup, () => { const g = this.gate(r); this.wing(g.x - side * 4, g.y + 26, 88, side < 0 ? 230 : -50, { flip: side < 0, life: Math.max(80, T.active), run: r }); this.wing(g.x - side * 4, g.y - 26, 88, side < 0 ? 130 : 50, { flip: side < 0, flipY: true, life: Math.max(80, T.active), run: r }); });
        this.add({ t: 0, step: () => { if (r.phase === 'done') return false; if (!r.counterTriggered) return true;
          const g = this.gate(r); this.bite(g.x + side * 16, g.y, 76, 46, 70, { run: r }); this.flash(g.x + side * 16, g.y, 48, { delay: 60, run: r }); this.sparks(g.x + side * 16, g.y, 5, { delay: 60, run: r }); this.shake(r, 90, 0.0025);
          return false; } });
        break;
      }
      case 'ws_rivet_drive': // braced behind the locked gate he drives forward: two dust tracks gouged by his boots, the iron's scrape, the shove
        this.onClock(r, T.startup, () => { const c = this.me(r); this.dust(c.x - side * 20, c.y, 70); this.streak(c.x - side * 70, c.y - c.z - 4, c.x, c.y - c.z - 4, 4, T.active + 160, { run: r }); this.streak(c.x - side * 70, c.y - c.z + 6, c.x, c.y - c.z + 6, 4, T.active + 160, { run: r }); });
        this.onClock(r, hitAt(0), () => { const g = this.gate(r), c = this.me(r); this.flash(g.x + side * 10, g.y, 50, { run: r }); this.sparks(g.x + side * 10, g.y, 5, { run: r }); this.dust(c.x + side * 30, c.y, 90); this.shake(r, 100, 0.003); });
        break;
      case 'ws_rearguard_step': // the step back: dust where he plants, one wing turned in front — its edge sweeps the space he left
        this.onClock(r, T.startup, () => { const c = this.me(r), g = this.gate(r); this.dust(c.x, c.y, 60); this.wing(g.x + side * 20, g.y, 96, side < 0 ? 170 : 10, { flip: side < 0, life: 170, run: r }); });
        break;
      case 'ws_crenel_upper': // the gate's spine driven straight up two-handed: a tall crescent rising, the iron's glint at its top
        this.onClock(r, T.startup * 0.6, () => { const c = this.me(r); this.dust(c.x + side * 20, c.y, 80); });
        this.onClock(r, hitAt(0), () => { const c = this.me(r), g = this.gate(r);
          this.wing(c.x + side * 44, c.y - c.z - 100, 130, side < 0 ? 245 : -65, { flip: side < 0, life: 210, run: r });
          this.streak(c.x + side * 40, c.y - c.z - 30, c.x + side * 40, c.y - c.z - 200, 6, 230, { run: r }); this.flash(g.x, g.y, 38, { run: r }); });
        break;
      case 'ws_false_gate': // the feint: the wings start to open as if to guard (a faint V) — then one folds and its edge strikes
        this.onClock(r, T.startup * 0.25, () => { const g = this.gate(r, 'ws_false_gate:open'); this.wing(g.x, g.y + 22, 80, side < 0 ? 230 : -50, { flip: side < 0, life: T.startup * 0.7, run: r }); this.wing(g.x, g.y - 22, 80, side < 0 ? 130 : 50, { flip: side < 0, flipY: true, life: T.startup * 0.7, run: r }); });
        this.onClock(r, hitAt(0), () => { const g = this.gate(r); this.wing(g.x + side * 12, g.y, 110, side < 0 ? 200 : -20, { flip: side < 0, life: 160, run: r }); this.flash(g.x + side * 20, g.y, 34, { run: r }); });
        break;
      case 'ws_crossbar_sweep': // the wings spread flat sweep a broad slice of the floor: two wide crescents across the depth, dust along it
        this.onClock(r, hitAt(0), () => { const c = this.me(r);
          this.wing(c.x + side * 80, c.y - c.z - 40, 190, side < 0 ? 180 : 0, { flip: side < 0, life: 220, run: r }); this.wing(c.x + side * 80, c.y - c.z - 16, 170, side < 0 ? 190 : -10, { flip: side < 0, flipY: true, life: 220, run: r });
          this.dust(c.x + side * 70, c.y - 40, 100); this.dust(c.x + side * 70, c.y + 40, 100); this.shake(r, 70, 0.002); });
        break;
      case 'ws_anvil_drop': // the hop, then the folded gate comes down: a crack in the floor round it, its dust, the room shakes
        this.onClock(r, hitAt(0), () => { const c = this.me(r), x = c.x + side * 46;
          this.crack(x, c.y + 2, 150); this.dust(x - 30, c.y, 90); this.dust(x + 30, c.y, 90); this.flash(x, c.y - 24, 52, { run: r }); this.sparks(x, c.y - 10, 5, { up: true, run: r });
          this.ctx.punch(0.02, 140); this.shake(r, 120, 0.003); });
        break;
      case 'ws_last_drawbridge': { // his ultimate (GPT: unfold / catch / catapult / sentence — no magic lion, no eruption, no
        // light pillar): the wings flung to their widest, the jaws biting shut, one great crescent heaving up through him, the
        // locked gate slammed down: the planks crack wide round it, the dust of the whole floor, the room shakes
        const t1 = hitAt(0), t2 = hitAt(1), t3 = hitAt(2), at = (dx: number, dz: number) => { const c = this.me(r); return { x: c.x + side * dx, y: c.y - c.z - dz, c }; };
        this.onClock(r, T.startup * 0.45, () => { const g = at(42, 108);
          this.wing(g.x - side * 14, g.y + 40, 150, side < 0 ? 235 : -55, { flip: side < 0, life: 230, run: r }); this.wing(g.x + side * 22, g.y + 22, 140, side < 0 ? 305 : 55, { flip: side < 0, flipY: true, life: 230, run: r });
          this.dust(g.c.x - side * 18, g.c.y, 110); this.shake(r, 90, 0.0018); });
        this.onClock(r, T.startup + Math.max(0, r.hits[0].at - 70), () => { const g = at(50, 58); this.bite(g.x + side * 26, g.y, 110, 70, 70, { run: r }); });
        this.onClock(r, t1, () => { const g = at(50, 58); this.flash(g.x + side * 26, g.y, 54, { run: r }); this.sparks(g.x + side * 26, g.y, 6, { run: r }); this.shake(r, 90, 0.0024); });
        this.onClock(r, t2, () => { const g = at(44, 112);
          this.wing(g.c.x + side * 56, g.c.y - g.c.z - 80, 190, side < 0 ? 250 : -70, { flip: side < 0, life: 260, run: r });
          this.streak(g.c.x + side * 60, g.c.y - g.c.z, g.c.x + side * 60, g.c.y - g.c.z - 230, 8, 280, { run: r }); this.flash(g.x, g.y, 50, { run: r });
          this.dust(g.c.x + side * 34, g.c.y, 120); this.ctx.punch(0.022, 140); });
        this.onClock(r, t3, () => { const c = this.me(r), x = c.x + side * 70;
          this.crack(x, c.y + 2, 260); this.dust(x - side * 60, c.y, 130); this.dust(x, c.y, 150); this.dust(x + side * 60, c.y, 130);
          this.flash(x, c.y - 30, 78, { run: r }); this.sparks(x, c.y - 12, 9, { up: true, run: r }); this.wing(x, c.y - c.z - 40, 170, side < 0 ? 180 : 0, { flip: side < 0, flipY: true, life: 200, run: r });
          this.ctx.punch(0.032, 190); this.shake(r, 220, 0.0055); });
        break;
      }
      case 'ws_royal_portcullis': { // open wide as he advances; shut on him like a portcullis; driven straight up, locked
        const t1 = hitAt(0), t2 = hitAt(1);
        this.onClock(r, T.startup * 0.6, () => { const g = this.gate(r); this.bite(g.x + side * 30, g.y, 96, 70, Math.max(80, t1 - T.startup * 0.6), { run: r }); this.wing(g.x, g.y, 120, side < 0 ? 180 : 0, { flip: side < 0, life: 200, run: r }); });
        this.onClock(r, t1, () => { const g = this.gate(r); this.flash(g.x + side * 30, g.y, 48, { run: r }); this.sparks(g.x + side * 30, g.y, 5, { run: r }); this.shake(r, 90, 0.0022); });
        this.onClock(r, t2, () => { const c = this.me(r), x = c.x + side * 54;
          this.streak(x, c.y - c.z - 10, x, c.y - c.z - 210, 8, 280, { run: r }); this.wing(x, c.y - c.z - 110, 150, side < 0 ? 270 : -90, { flip: side < 0, life: 240, run: r });
          this.flash(x, c.y - c.z - 80, 64, { run: r }); this.dust(c.x + side * 20, c.y, 100); this.ctx.punch(0.025, 160); this.shake(r, 140, 0.0035); });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ on the foe

  /** A blow landed: the one small ivory spark and a few hot scrapes; a heavy blow a bigger one and a crossed scrape; a launch
   *  a short streak up with him; a slam into the floor its dust. No golden energy. */
  confirmed(_s: FinalSkill, hit: HitEvent, at: V3, heavy: boolean, crit: boolean): void {
    textures(this.ctx.scene);
    const x = at.x, y = at.y - at.z - 40, big = heavy || !!hit.heavy;
    this.flash(x + rnd(-4, 4), y + rnd(-4, 4), big ? 56 : 38, { life: big ? 170 : 130 });
    this.sparks(x, y, big ? 4 : 2);
    if (big) for (const a of [35, -35]) this.spr({ name: 'wd-scrape', x, y, depth: TOP + 4, w: 70, h: 4, angle: a + rnd(-6, 6), life: 160, add: true, ox: 0.5, a: kf([0, 1], [1, 0, inQ]) });
    if (crit) this.flash(x, y, 80, { life: 190 });
    if ((hit.reaction.launch ?? 0) >= 90) this.streak(x, at.y - at.z, x, at.y - at.z - 150, 5, 230);
    if (hit.reaction.slam) this.dust(x, at.y, 110);
  }

  /** The class's Final Cut (its passive's extra blow) in his hands: the gate's edge knocks him once more — a small iron spark
   *  and a scrape (Advanced: a little bigger). PVP 3D: only its number, as the longsword's. */
  extraKnock(at: V3, dir: number, big = false): void {
    if ((this.ctx.scene as unknown as { a3d?: unknown }).a3d) return;
    textures(this.ctx.scene);
    const x = at.x + dir * 6, y = at.y - at.z - 40;
    this.flash(x, y, big ? 34 : 26, { life: 110 });
    this.spr({ name: 'wd-scrape', x: x - dir * 30, y: y - 6, ox: 0, depth: TOP + 4, w: 60, h: 3, angle: dir < 0 ? 190 : -10, life: 130, add: true, a: kf([0, 1], [1, 0, inQ]) });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const cur = this.live.concat(this.incoming);
    this.incoming = [];
    this.live = cur.filter((l) => { l.t += dt; return l.step(dt, l.t); });
  }

  destroy(): void { this.live = []; this.incoming = []; }
}
