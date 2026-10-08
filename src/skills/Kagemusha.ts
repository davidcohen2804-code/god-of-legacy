// Kagemusha (samurai): he vanishes in a burst of ink and petals; a ring of shadow doubles — his body, his name plate (and on
// other screens his name and HP bar) — stands round the spot, then they scatter and move on their own: run, stop, turn,
// close in on the foe and feint at it. He stays hidden (unseen on every other screen; a shade on his own) for 6 s, so the
// one facing him never knows where the real blade is. When he strikes he steps out of hiding and the doubles swing with
// him; his first hit that lands is an AMBUSH (a sure critical and a short stun) and the doubles burst into petals; a blow
// on a double bursts it (the blow is wasted); a hit on him ends it all. The caster's screen runs the doubles and sends
// where they are and what they do with his movement state; every other screen draws them from that (RemotePlayer).
import type Phaser from 'phaser';
import type { ActorView } from '../game/ActorView';
import type { PoseFrame } from '../game/Body';
import type { Dir } from '../world/collision';
import type { AnimSnap } from '../game/PoseState';
import { footAllowed, supportAt } from '../world/WorldGeometry';
import { castSeed } from '../game/PoseState';
import type { HitTarget, V2, V3 } from './HitGeometry';
import { Afterimages, applyMotion, type Motion } from './ArcherMotion';
import { SAMURAI_AFTER, samuraiMotion } from './SamuraiMotion';

export const KAGE = {
  lifeMs: 6000,
  /** The ring: this many doubles, this far round him. */
  count: 5, ring: 112,
  /** AMBUSH, the first real hit: a sure critical (×1.5 on players, who take no criticals otherwise) and this stun (ms). */
  ambushMul: 1.5, ambushStun: 650,
  /** A double's swing against monsters, of his damage. */
  monsterMul: 0.3,
  /** A double's feet (walls and props stop the doubles as they stop him). */
  foot: 16,
  /** A double runs as fast as he does, round the foe (or the ring) this far. */
  speed: 250, roam: 230,
  /** How the ring stands before it scatters (ms after it appears). */
  hold: 320,
  /** He sees himself as a shade while hidden (everyone else sees nothing). */
  shade: 0.42,
};

/** A double's feint: a quick cut in the air (its own timeline; the stage picks which of the four cuts). */
export const FEINT = { id: 'quick_slash', startup: 75, active: 70, recovery: 150 };
const FEINT_MS = FEINT.startup + FEINT.active + FEINT.recovery;

/** What a double is doing: s = standing (combat stance), r = running, f = a feint, m = swinging with him (his pose). */
export type KageMode = 's' | 'r' | 'f' | 'm';
export interface KageSeen { dx: number; dy: number; dz: number; face: 1 | -1; mode: KageMode; feint: number }

/** "h|dx,dy,dz,face,mode,feint;…" — h = he is hidden (v = out of hiding); '-' = a double burst. */
export function encodeKage(hidden: boolean, ds: readonly { x: number; y: number; z: number; alive: boolean; face: number; mode: KageMode; feints: number }[], me: V3): string {
  return `${hidden ? 'h' : 'v'}|${ds.map((d) => (d.alive ? `${Math.round(d.x - me.x)},${Math.round(d.y - me.y)},${Math.round(d.z - me.z)},${d.face < 0 ? -1 : 1},${d.mode},${d.feints % 10}` : '-')).join(';')}`;
}
const lim = (v: number) => Math.max(-900, Math.min(900, v));
export function decodeKage(s: string | undefined): { hidden: boolean; ds: (KageSeen | null)[] } | null {
  if (!s || s[1] !== '|') return null;
  const ds = s.slice(2).split(';').slice(0, KAGE.count).map((p) => {
    if (p === '-') return null;
    const [dx, dy, dz, f, m, c] = p.split(',');
    const x = Number(dx), y = Number(dy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { dx: lim(x), dy: lim(y), dz: lim(Number(dz) || 0), face: Number(f) < 0 ? -1 : 1, mode: (['s', 'r', 'f', 'm'].includes(m) ? m : 's') as KageMode, feint: Number(c) || 0 } as KageSeen;
  });
  return { hidden: s[0] === 'h', ds };
}

/** Doubles as hit targets (a blow on one of them bursts it): id `kage:<his id>:<k>`. */
export function kageTargets(owner: string, gs: readonly { k: number; x: number; y: number; z: number }[], radius: number): HitTarget[] {
  return gs.map((g) => ({ id: `kage:${owner}:${g.k}`, kind: 'player' as const, x: g.x, y: g.y, z: g.z, radius, height: 74, alive: true }));
}
/** `kage:<his id>:<k>` → his id and the double. */
export function kageTarget(id: string): { owner: string; k: number } | null {
  if (!id.startsWith('kage:')) return null;
  const i = id.lastIndexOf(':'), k = Number(id.slice(i + 1));
  return Number.isFinite(k) ? { owner: id.slice(5, i), k } : null;
}

/** A double's body this frame: what it is doing → the animation query (and the body motion of a feint). */
export function kageSnap(mode: KageMode, t: number, feint: number, seed: number): AnimSnap {
  if (mode === 'r') return { mode: 'run', t, speed: KAGE.speed, vz: 0, stunMs: 220 };
  if (mode === 'f') return { mode: 'skill', t, speed: 0, vz: 0, stunMs: 220, skill: { ...FEINT, stage: feint % 3, elapsed: t, seed: seed + feint } };
  return { mode: 'alert', t, speed: 0, vz: 0, stunMs: 220 };
}
export function kageFeintMotion(t: number, feint: number, face: number): Motion | null { return samuraiMotion(FEINT.id, t, FEINT, face, feint % 3); }

/** What the doubles need from the scene: a view dressed like him, his body's pose for a query, their effects. */
export interface KageHooks {
  makeView(): ActorView;
  pose(snap: AnimSnap, dir: Dir): PoseFrame;
  /** One of them steps out of the ink. */
  appear(at: V3): void;
  /** A double feints: a cut in the air in front of it (stage: which of the four cuts). */
  feint(at: V3, face: number, stage: number): void;
  /** A double bursts into petals (struck, or the AMBUSH). */
  burst(at: V3): void;
  /** A double melts back into ink (time is up, or he was struck). */
  fade(at: V3): void;
}

interface Double {
  x: number; y: number; z: number; sz: number; alive: boolean; view: ActorView; after: Afterimages;
  face: 1 | -1; mode: KageMode; t: number; tx: number; ty: number; wait: number; feints: number; seed: number;
}

/** The caster's own doubles (his screen is their authority). */
export class KageLocal {
  readonly doubles: Double[] = [];
  private revealAt = -1;
  private revealed = false;
  /** He is out of sight (from the burst until he strikes, is struck, or the time is up). */
  hidden = false;
  until = -1;
  private home: V2 = { x: 0, y: 0 };
  /** Casts started while the doubles stand: the first of their hits that lands is the AMBUSH. */
  private armed = new Set<string>();
  /** Which double each monster (or the sparring knight) goes after. */
  private decoys = new Map<object, number>();

  constructor(private scene: Phaser.Scene, private hooks: KageHooks) {}

  /** The doubles stand (and can be seen). */
  get up(): boolean { return this.revealed && this.doubles.some((d) => d.alive); }
  get any(): boolean { return this.doubles.length > 0; }

  /** The burst: he vanishes at `at` (hidden from now on); the ring of doubles stands round the spot after `hideMs`. */
  start(castId: string, at: V3, now: number, hideMs: number): void {
    this.clear();
    this.revealAt = now + hideMs; this.revealed = false; this.until = this.revealAt + KAGE.lifeMs; this.hidden = true;
    this.home = { x: at.x, y: at.y };
    const seed = castSeed(castId), turn = ((seed % 360) * Math.PI) / 180;
    for (let i = 0; i < KAGE.count; i++) {
      const a = turn + (i / KAGE.count) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      let x = at.x, y = at.y;
      for (let f = 1; f > 0.2; f -= 0.2) { const px = at.x + c * KAGE.ring * f, py = at.y + sn * KAGE.ring * 0.45 * f; if (footAllowed(px, py, at.z, KAGE.foot)) { x = px; y = py; break; } }
      const view = this.hooks.makeView(); view.setVisible(false);
      this.doubles.push({ x, y, z: at.z, sz: 0, alive: true, view, after: new Afterimages(this.scene, SAMURAI_AFTER),
        face: c < 0 ? -1 : 1, mode: 's', t: 0, tx: x, ty: y, wait: KAGE.hold + i * 70, feints: 0, seed: seed + i * 97 });
    }
  }

  /** Every frame: the ring shows after the burst, then every double goes its own way (round the foe if there is one near);
   *  while he swings, they stop and swing with him. */
  step(ms: number, now: number, me: { x: number; y: number; z: number; supportZ: number }, foe: V2 | null, swinging: { side: number } | null): void {
    if (!this.doubles.length) return;
    if (now >= this.until) { this.end('fade'); return; }
    if (!this.revealed && now >= this.revealAt) {
      this.revealed = true;
      for (const d of this.doubles) if (d.alive) this.hooks.appear(d);
    }
    if (!this.revealed) return;
    const centre = foe && Math.hypot(foe.x - this.home.x, foe.y - this.home.y) < 520 ? foe : this.home;
    for (const d of this.doubles) {
      if (!d.alive) continue;
      d.t += ms;
      if (swinging) { if (d.mode !== 'm') { d.mode = 'm'; d.t = 0; } d.face = swinging.side < 0 ? -1 : 1; }
      else if (d.mode === 'm') { d.mode = 's'; d.t = 0; d.wait = 120 + Math.random() * 200; }
      else if (d.mode === 's') { d.wait -= ms; if (foe) d.face = foe.x < d.x ? -1 : 1; if (d.wait <= 0) this.roam(d, centre, me.z); }
      else if (d.mode === 'f') { if (d.t >= FEINT_MS) { d.mode = 's'; d.t = 0; d.wait = 200 + Math.random() * 380; d.feints++; } }
      else this.run(d, ms, me.z, foe);
      d.sz = supportAt(d.x, d.y, d.z + 8).z; d.z = d.sz;
    }
  }

  /** A fresh place to go: round the foe (or the ring), on open floor. */
  private roam(d: Double, c: V2, z: number): void {
    for (let n = 0; n < 8; n++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * (KAGE.roam - 60), x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r * 0.5;
      if (Math.hypot(x - d.x, y - d.y) < 50 || !footAllowed(x, y, z, KAGE.foot)) continue;
      d.tx = x; d.ty = y; d.mode = 'r'; d.t = 0;
      return;
    }
    d.wait = 200; // boxed in: wait a moment and look again
  }
  private run(d: Double, ms: number, z: number, foe: V2 | null): void {
    const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = (KAGE.speed * ms) / 1000;
    if (Math.abs(dx) > 2) d.face = dx < 0 ? -1 : 1;
    if (dist <= step) {
      d.x = d.tx; d.y = d.ty; d.t = 0;
      const near = foe && Math.hypot(foe.x - d.x, foe.y - d.y) < 170;
      if (near && Math.random() < 0.45) { d.mode = 'f'; d.face = foe!.x < d.x ? -1 : 1; this.hooks.feint(d, d.face, d.feints % 3); } // a feint at the foe
      else { d.mode = 's'; d.wait = 220 + Math.random() * 600; }
      return;
    }
    const nx = d.x + (dx / dist) * step, ny = d.y + (dy / dist) * step;
    if (footAllowed(nx, ny, z, KAGE.foot, d)) { d.x = nx; d.y = ny; }
    else if (footAllowed(nx, d.y, z, KAGE.foot, d)) d.x = nx;
    else if (footAllowed(d.x, ny, z, KAGE.foot, d)) d.y = ny;
    else { d.mode = 's'; d.wait = 80; } // blocked: pick another way
  }

  /** The doubles: each in its own pose (running, standing, a feint) — or his pose and motion while he swings. */
  render(ms: number, his: { pose: PoseFrame; dir: Dir; motion: Motion | null } | null, alpha: number, now: number): void {
    for (const d of this.doubles) {
      if (!d.alive) continue;
      d.view.setVisible(this.revealed);
      if (!this.revealed) continue;
      const mirror = d.mode === 'm' && his, dir: Dir = mirror ? his.dir : d.face < 0 ? 'left' : 'right';
      const pose = mirror ? his.pose : this.hooks.pose(kageSnap(d.mode, d.t, d.feints, d.seed), dir);
      const motion = mirror ? his.motion : d.mode === 'f' ? kageFeintMotion(d.t, d.feints, d.face) : null;
      d.view.render(ms, pose, d.x, d.y, d.z, d.sz, dir, alpha, null, false);
      d.view.ring.setVisible(false); // on his own screen only he has the ring under his feet (others see one under every one of them)
      applyMotion(d.view.motionSprites, motion);
      d.after.step(now, d.view.sprite, !!motion?.after);
    }
  }

  /** Where the standing doubles are (his swings are drawn there too). */
  ghosts(): { k: number; x: number; y: number; z: number }[] {
    return this.revealed ? this.doubles.flatMap((d, k) => (d.alive ? [{ k, x: d.x, y: d.y, z: d.z }] : [])) : [];
  }
  pos(k: number): V3 | null { const d = this.doubles[k]; return d && d.alive ? { x: d.x, y: d.y, z: d.z } : null; }

  /** The doubles as targets of other players' (and the sparring knight's) blows: id `kage:<his id>:<k>`. */
  targets(owner: string, radius: number): HitTarget[] { return kageTargets(owner, this.ghosts(), radius); }

  /** The double a monster (or the knight) goes after while any stand. */
  decoyFor(who: object): { k: number; x: number; y: number; z: number; sz: number } | null {
    if (!this.up) return null;
    let k = this.decoys.get(who);
    if (k === undefined || !this.doubles[k]?.alive) {
      const alive = this.doubles.flatMap((d, i) => (d.alive ? [i] : []));
      k = alive[Math.floor(Math.random() * alive.length)];
      this.decoys.set(who, k);
    }
    const d = this.doubles[k];
    return { k, x: d.x, y: d.y, z: d.z, sz: d.sz };
  }

  /** A struck double bursts into petals (the blow is wasted). */
  pop(k: number): void {
    const d = this.doubles[k];
    if (!d?.alive || !this.revealed) return;
    d.alive = false; this.hooks.burst(d); d.view.destroy();
    if (!this.doubles.some((x) => x.alive)) { this.clear(); }
  }

  /** He strikes: out of hiding (a swirl of ink where he steps out); a cast while the doubles stand is an ambush. */
  arm(castId: string, skillId: string, me: V3): void {
    if (skillId === 'kagemusha') return;
    if (this.hidden && this.revealed) { this.hidden = false; this.hooks.appear(me); }
    if (this.up) this.armed.add(castId);
  }
  isAmbush(castId: string): boolean { return this.armed.has(castId) && this.up; }

  /** The illusion ends: 'burst' (the AMBUSH: petals) or 'fade' (time, or he was struck: ink). He is seen again. */
  end(how: 'burst' | 'fade'): void {
    for (const d of this.doubles) if (d.alive && this.revealed) (how === 'burst' ? this.hooks.burst : this.hooks.fade).call(this.hooks, d);
    this.clear();
  }

  /** Gone without a trace (death, leaving the scene). */
  clear(): void {
    for (const d of this.doubles) if (d.alive) d.view.destroy();
    this.doubles.length = 0; this.armed.clear(); this.decoys.clear();
    this.revealAt = -1; this.revealed = false; this.until = -1; this.hidden = false;
  }

  /** For his movement state (none: no doubles). */
  code(me: V3): string | undefined { return this.up ? encodeKage(this.hidden, this.doubles, me) : undefined; }
}
