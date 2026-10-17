// The samurai's fallen petals — continuity (David 14:35: what the fight leaves behind becomes the power of a later skill;
// DFO's idea and numbers, 17 Oct). What his blossoms leave on the floor lies there as drifts of petals: Blossom Storm leaves
// one under each of its five cuts (2 petals, the finale's 4), Sakura Bind its ring where it opened when the bind ends (6).
// A drift lies 10 s, then the wind lifts it away; 24 petals at most per samurai (the oldest drift goes first). Sheathe's
// click gathers every drift of his within 320 px into the scabbard, which holds them 3 s for his next Iai Strike — the
// blossom draw (from 6 petals its line 40% wider, one more cut for every 4 petals, at most 4: the runtime's, from the
// count the cast carries) — and they scatter if no draw comes. Every drift comes from a cast (where its cut fell, where the
// bind opened), so both screens lay the same; the count of a draw rides on its cast (`petals`, `pb` on the wire).
// The logic only: SamuraiFx draws the drifts in the painted arena and the world, the 3D card piece lays real petals on the
// planks in PVP 3D (`look`: a petal picture).
import type { CastRun } from './SkillRuntime';
import type { FinalSkill } from './SkillTypes';
import type { V3 } from './HitGeometry';
import type { SkillFx } from './SkillFx';
import type { Fx3D } from '../arena3d/Fx3D';

export const PETALS = { storm: 2, stormLast: 4, bind: 6, lifeMs: 10000, cap: 24, reach: 320, holdMs: 3000 } as const;

/** A drift of petals on the floor: whose, where, how many, until when. */
export interface Drift { key: string; owner: string; x: number; y: number; n: number; until: number; pts: { x: number; y: number; k: number }[] }

/** What the petals need from the scene. */
export interface PetalHost {
  now(): number;
  localId(): string;
  casterPos(id: string): V3 | null;
  fx(): SkillFx | undefined;
  fx3d(): Fx3D | undefined;
}

/** A small generator seeded by a key (a drift's petals fall the same on every screen). */
function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

export class SamuraiPetals {
  private drifts: Drift[] = [];
  private pending: { at: number; d: Drift }[] = [];
  /** His own scabbard: the petals it holds and until when (his next Iai Strike draws them). */
  private held: { n: number; until: number } | null = null;

  constructor(private h: PetalHost) {}

  /** Blossom Storm's cut `i` (the runtime's hit event: `o` where it fell): a drift under it — the finale's the biggest. */
  cut(r: CastRun, i: number, o: V3): void {
    if (r.skill.id !== 'blossom_storm') return;
    const n = i >= r.hits.length - 1 ? PETALS.stormLast : PETALS.storm;
    this.lay({ key: `${r.castId}:${i}`, owner: r.attackerId, x: o.x + r.aim.x * 34, y: o.y + r.aim.y * 16, n }, { x: o.x + r.aim.x * 30, y: o.y, z: o.z + 70 });
  }

  /** Sakura Bind opened (its active phase): its ring of petals stays where it opened when the bind ends (the blossoms on
   *  the floor fade: its zone's last turn). */
  bind(r: CastRun): void {
    const L = r.skill.linger, p = r.place;
    if (r.skill.id !== 'sakura_bind' || !L || !p) return;
    this.pending.push({ at: this.h.now() + L.startMs + L.everyMs * L.count, d: { key: `${r.castId}:b`, owner: r.attackerId, x: p.x, y: p.y, n: PETALS.bind, until: 0, pts: [] } });
  }

  /** Sheathe's click (its active phase): every drift of his within reach flies into the scabbard. How many petals came. */
  sheathe(r: CastRun): number {
    if (r.skill.id !== 'sheathe') return 0;
    const c = this.h.casterPos(r.attackerId); if (!c) return 0;
    const got = this.drifts.filter((d) => d.owner === r.attackerId && Math.hypot(d.x - c.x, d.y - c.y) <= PETALS.reach);
    if (!got.length) return 0;
    this.drifts = this.drifts.filter((d) => !got.includes(d));
    const n = got.reduce((a, d) => a + d.n, 0), id = r.attackerId;
    const hip = (): V3 | null => { const q = this.h.casterPos(id); return q ? { x: q.x, y: q.y, z: q.z + 52 } : null; };
    const f3 = this.h.fx3d();
    if (f3) f3.cardGather(got.flatMap((d) => d.pts.map((_, j) => `${d.key}#${j}`)), hip, { ms: 330, gap: 22 });
    else for (const d of got) this.h.fx()?.samDriftGo(d.key, 'gather', id);
    this.h.fx()?.samScabbard(id, n, PETALS.holdMs);
    if (id === this.h.localId()) { const had = this.held && this.h.now() <= this.held.until ? this.held.n : 0; this.held = { n: Math.min(PETALS.cap, had + n), until: this.h.now() + PETALS.holdMs }; }
    return n;
  }

  /** His own cast starting: an Iai Strike within the scabbard's hold takes every petal in it (the blossom draw's count). */
  draw(s: FinalSkill): number {
    if (s.id !== 'iai_strike' || !this.held) return 0;
    const n = this.h.now() <= this.held.until ? this.held.n : 0;
    this.held = null;
    return n;
  }

  /** Each frame: drifts due are laid, drifts out of time lift away, an unused scabbard's petals are lost. */
  step(): void {
    const now = this.h.now();
    if (this.pending.length) {
      const due = this.pending.filter((p) => now >= p.at); this.pending = this.pending.filter((p) => now < p.at);
      for (const p of due) this.lay(p.d, { x: p.d.x, y: p.d.y, z: 26 });
    }
    if (this.drifts.length && this.drifts.some((d) => now >= d.until)) {
      const gone = this.drifts.filter((d) => now >= d.until); this.drifts = this.drifts.filter((d) => now < d.until);
      for (const d of gone) this.lift(d);
    }
    if (this.held && now > this.held.until) this.held = null; // (they scattered: the look's own timer shows it)
  }

  /** A new round / the scene goes: every drift gone at once, the scabbard empty. */
  clear(): void {
    for (const d of this.drifts) this.lift(d, true);
    this.drifts = []; this.pending = []; this.held = null;
  }

  /** How many petals lie for `owner` (the trial's and the tests' read). */
  count(owner: string): number { return this.drifts.filter((d) => d.owner === owner).reduce((a, d) => a + d.n, 0); }

  private lay(d0: Omit<Drift, 'until' | 'pts'> & Partial<Drift>, from: V3): void {
    const rnd = seeded(d0.key), ring = d0.n >= PETALS.bind;
    const pts = Array.from({ length: d0.n }, (_, j) => {
      const a = ring ? (j / d0.n) * Math.PI * 2 + rnd() * 0.5 : rnd() * Math.PI * 2, rr = ring ? 34 + rnd() * 10 : 6 + rnd() * (8 + d0.n * 3);
      return { x: d0.x + Math.cos(a) * rr, y: d0.y + Math.sin(a) * rr * 0.5, k: Math.floor(rnd() * 4) }; // (k: which of the four petals)
    });
    const d: Drift = { key: d0.key, owner: d0.owner, x: d0.x, y: d0.y, n: d0.n, until: this.h.now() + PETALS.lifeMs, pts };
    // the cap: the oldest drifts of his go first
    let total = this.count(d.owner) + d.n;
    while (total > PETALS.cap) {
      const old = this.drifts.find((x) => x.owner === d.owner); if (!old) break;
      this.drifts = this.drifts.filter((x) => x !== old); total -= old.n; this.lift(old);
    }
    this.drifts.push(d);
    const f3 = this.h.fx3d(), fx = this.h.fx();
    if (f3) pts.forEach((p, j) => { const look = fx?.petalLook(p.k); f3.cardLay(`${d.key}#${j}`, from, p, { ms: 520 + j * 60, life: PETALS.lifeMs + 600, ...(look ? { look } : {}) }); });
    else fx?.samDrift(d.key, pts, from);
  }

  private lift(d: Drift, now = false): void {
    const f3 = this.h.fx3d();
    if (f3) d.pts.forEach((_, j) => f3.cardDrop(`${d.key}#${j}`));
    else this.h.fx()?.samDriftGo(d.key, now ? 'gone' : 'wind');
  }
}
