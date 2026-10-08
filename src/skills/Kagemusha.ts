// Kagemusha (samurai): he vanishes in a burst of ink and petals and comes back as three identical samurai — himself and two
// shadow doubles with his body, his name plate (and on other screens his name and HP bar) — that take every step he takes
// and swing every swing with him for 6 s. A struck double bursts into petals and the blow is wasted; his first real hit is
// an AMBUSH (a sure critical and a short stun) and the doubles burst; a hit on him ends them at once. The caster's screen
// owns the doubles (KageLocal) and sends where they stand with his movement state; every other screen draws them from
// that (RemotePlayer). Which of the three is him is picked from the cast, the same on every screen.
import type Phaser from 'phaser';
import type { ActorView } from '../game/ActorView';
import type { PoseFrame } from '../game/Body';
import type { Dir } from '../world/collision';
import { footAllowed, supportAt } from '../world/WorldGeometry';
import { castSeed } from '../game/PoseState';
import type { HitTarget, V3 } from './HitGeometry';
import { Afterimages, applyMotion, type Motion } from './ArcherMotion';
import { SAMURAI_AFTER } from './SamuraiMotion';

export const KAGE = {
  lifeMs: 6000,
  /** AMBUSH, the first real hit: a sure critical (×1.5 on players, who take no criticals otherwise) and this stun (ms). */
  ambushMul: 1.5, ambushStun: 650,
  /** A double's swing against monsters, of his damage. */
  monsterMul: 0.3,
  /** A double's feet (walls stop the doubles as they stop him). */
  foot: 16,
  /** On his own screen the doubles are a little see-through (he has to know which one is him); everyone else sees three. */
  ownAlpha: 0.72,
};

/** The three places: where he stood and two more across the floor beside it (round him, or nearer, where walls and props
 *  are close); left to right, one of them his — picked from the cast, the same on every screen (the floor is the same). */
export function formation(castId: string, o: V3): { real: number; pts: { x: number; y: number }[] } {
  const pts = [{ x: o.x, y: o.y }];
  const free = (x: number, y: number) => footAllowed(x, y, o.z, KAGE.foot) && pts.every((p) => Math.hypot(p.x - x, (p.y - y) * 2) >= 70);
  for (const r of [96, 78, 118, 62]) for (const deg of [10, 170, -10, -170, 35, 145, -35, -145, 65, 115, -65, -115]) {
    if (pts.length === 3) break;
    const a = (deg * Math.PI) / 180, x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r * 0.45;
    if (free(x, y)) pts.push({ x, y });
  }
  while (pts.length < 3) pts.push({ x: o.x, y: o.y }); // nowhere to go: they stand as one
  pts.sort((a, b) => a.x - b.x);
  return { real: castSeed(castId) % 3, pts };
}

export interface KageOffset { dx: number; dy: number; dz: number }
/** Where the doubles stand, from him, for his movement state: "dx,dy,dz;dx,dy,dz" ('-' = burst). */
export function encodeKage(ds: readonly { x: number; y: number; z: number; alive: boolean }[], me: V3): string {
  return ds.map((d) => (d.alive ? `${Math.round(d.x - me.x)},${Math.round(d.y - me.y)},${Math.round(d.z - me.z)}` : '-')).join(';');
}
const lim = (v: number) => Math.max(-600, Math.min(600, v));
export function decodeKage(s: string | undefined): (KageOffset | null)[] | null {
  if (!s) return null;
  return s.split(';').slice(0, 2).map((p) => {
    if (p === '-') return null;
    const [dx, dy, dz] = p.split(',').map(Number);
    return Number.isFinite(dx) && Number.isFinite(dy) ? { dx: lim(dx), dy: lim(dy), dz: Number.isFinite(dz) ? lim(dz) : 0 } : null;
  });
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

/** What the doubles need from the scene: a view dressed like him, and the effects of their coming and going. */
export interface KageHooks {
  makeView(): ActorView;
  /** One of the three steps out of the ink. */
  appear(at: V3): void;
  /** A double bursts into petals (struck, or the AMBUSH). */
  burst(at: V3): void;
  /** A double melts back into ink (time is up, or he was struck). */
  fade(at: V3): void;
}

interface Double { x: number; y: number; z: number; sz: number; alive: boolean; view: ActorView; after: Afterimages }

/** The caster's own doubles (his screen is their authority). */
export class KageLocal {
  readonly doubles: Double[] = [];
  private revealAt = -1;
  private revealed = false;
  until = -1;
  private last: { x: number; y: number } | null = null;
  /** Casts started while the doubles stand: the first of their hits that lands is the AMBUSH. */
  private armed = new Set<string>();
  /** Which double each monster (or the sparring knight) goes after. */
  private decoys = new Map<object, number>();

  constructor(private scene: Phaser.Scene, private hooks: KageHooks) {}

  /** The doubles stand (and can be seen). */
  get up(): boolean { return this.revealed && this.doubles.some((d) => d.alive); }
  get any(): boolean { return this.doubles.length > 0; }

  /** The burst: he leaves `at` for his place in the formation (returned), the doubles take the other two, all three
   *  show after `hideMs`. */
  start(castId: string, at: V3, now: number, hideMs: number): { x: number; y: number } {
    this.clear();
    const f = formation(castId, at);
    this.revealAt = now + hideMs; this.revealed = false; this.until = this.revealAt + KAGE.lifeMs; // (the burst itself is the cast's hit: SamuraiFx)
    f.pts.forEach((p, i) => {
      if (i === f.real) return;
      const view = this.hooks.makeView(); view.setVisible(false);
      this.doubles.push({ x: p.x, y: p.y, z: at.z, sz: 0, alive: true, view, after: new Afterimages(this.scene, SAMURAI_AFTER) });
    });
    const me = f.pts[f.real];
    this.last = { x: me.x, y: me.y };
    return me;
  }

  /** Every frame: the doubles take each step he takes (blocked where he would be), show up after the burst, run out. */
  step(now: number, me: { x: number; y: number; z: number; supportZ: number }): void {
    if (!this.doubles.length) return;
    if (now >= this.until) { this.end('fade'); return; }
    if (this.last) {
      const mx = me.x - this.last.x, my = me.y - this.last.y;
      if (mx || my) for (const d of this.doubles) {
        if (!d.alive) continue;
        if (footAllowed(d.x + mx, d.y + my, me.z, KAGE.foot, d)) { d.x += mx; d.y += my; }
        else if (footAllowed(d.x + mx, d.y, me.z, KAGE.foot, d)) d.x += mx;
        else if (footAllowed(d.x, d.y + my, me.z, KAGE.foot, d)) d.y += my;
      }
    }
    this.last = { x: me.x, y: me.y };
    for (const d of this.doubles) { d.sz = supportAt(d.x, d.y, me.z + 8).z; d.z = d.sz + Math.max(0, me.z - me.supportZ); }
    if (!this.revealed && now >= this.revealAt) {
      this.revealed = true;
      this.hooks.appear({ x: me.x, y: me.y, z: me.z });
      for (const d of this.doubles) if (d.alive) this.hooks.appear(d);
    }
  }

  /** The doubles in his very pose and body motion (they swing when he swings). */
  render(ms: number, pose: PoseFrame, dir: Dir, alpha: number, tint: number | null, fill: boolean, motion: Motion | null, now: number): void {
    for (const d of this.doubles) {
      if (!d.alive) continue;
      d.view.setVisible(this.revealed);
      if (!this.revealed) continue;
      d.view.render(ms, pose, d.x, d.y, d.z, d.sz, dir, alpha * KAGE.ownAlpha, tint, fill);
      d.view.ring.setVisible(false); // the ring under the feet marks the real one on his own screen
      applyMotion(d.view.motionSprites, motion);
      d.after.step(now, d.view.sprite, !!motion?.after);
    }
  }

  /** Where the standing doubles are (their swings are drawn there too). */
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
    if (!this.doubles.some((x) => x.alive)) this.clear();
  }

  /** A cast he starts while the doubles stand is an ambush. */
  arm(castId: string, skillId: string): void { if (this.up && skillId !== 'kagemusha') this.armed.add(castId); }
  isAmbush(castId: string): boolean { return this.armed.has(castId) && this.up; }

  /** The illusion ends: 'burst' (the AMBUSH: petals) or 'fade' (time, or he was struck: ink). */
  end(how: 'burst' | 'fade'): void {
    for (const d of this.doubles) if (d.alive && this.revealed) (how === 'burst' ? this.hooks.burst : this.hooks.fade).call(this.hooks, d);
    this.clear();
  }

  /** Gone without a trace (death, leaving the scene). */
  clear(): void {
    for (const d of this.doubles) if (d.alive) d.view.destroy();
    this.doubles.length = 0; this.armed.clear(); this.decoys.clear();
    this.revealAt = -1; this.revealed = false; this.until = -1; this.last = null;
  }

  /** For his movement state (none: no doubles). */
  code(me: V3): string | undefined { return this.up ? encodeKage(this.doubles, me) : undefined; }
}
