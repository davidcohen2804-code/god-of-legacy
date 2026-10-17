// The Gambler's floor deck (David 14:35: what lies on the floor is part of the game): the cards his skills leave on the
// floor are his deck — Call the Deck calls them home, and each one gathered is one more turn of its spinning hold.
// Pure logic: positions come from the cast only (origin, aim, a seed from the cast id, its charge level), so every screen
// that sees the cast lays the same cards; the scene draws them (painted arena: flat cards; PVP 3D: real cards) from this.
import type { CastRun } from './SkillRuntime';

/** Per gambler at most this many cards on the floor (the oldest goes first); each lies this long, then crumbles. */
export const DECK_MAX = 13, DECK_LIFE_MS = 12000;
/** Call the Deck gathers his cards within this reach; its hold turns: 2 + one per card, at most this many. */
export const GATHER_R = 700, HOLD_BASE = 2, HOLD_MAX = 15;

export interface DeckCard {
  key: string; owner: string;
  /** where it lies (floor px) and where it was thrown from (the hand, z = its height) */
  x: number; y: number; from: { x: number; y: number; z: number };
  /** when it lands (sim ms: it counts from then) and when it crumbles */
  landAt: number; until: number;
  /** stuck at a slant in the planks (52 Pickup's), else lying flat */
  stuck: boolean;
  laid?: boolean;
}

/** A seeded random from the cast id (the same on every screen). */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The cards a gambler cast leaves on the floor, from its active start (`now`): none for a skill that leaves none.
 *  `ok(x, y)`: a point on the walkable floor (a card off it is pulled back toward the thrower). */
export function deckLeaves(r: CastRun, now: number, ok: (x: number, y: number) => boolean): DeckCard[] {
  const id = r.skill.id, o = r.origin, rnd = rng(r.castId), base = Math.atan2(r.aim.y, r.aim.x), T = r.timings;
  const out: DeckCard[] = [];
  const put = (a: number, d: number, landMs: number, stuck = false, z = 90) => {
    let x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d * 0.6;
    for (let k = 0; k < 12 && !ok(x, y); k++) { x = o.x + (x - o.x) * 0.85; y = o.y + (y - o.y) * 0.85; }
    out.push({ key: `${r.castId}#${out.length}`, owner: r.attackerId, x, y, from: { x: o.x, y: o.y, z }, landAt: now + landMs, until: now + landMs + DECK_LIFE_MS, stuck });
  };
  if (id === 'charged_deal') { // where the fan's flight ends: 2 (the full hold 3)
    const full = (r.chargeLevel ?? 0) >= 1, n = full ? 3 : 2, range = full ? 600 : 560, speed = full ? 760 : 720;
    for (let k = 0; k < n; k++) put(base + (k - (n - 1) / 2) * 0.13 + (rnd() - 0.5) * 0.05, range * (0.88 + rnd() * 0.12), (range / speed) * 1000);
  } else if (id === 'cut_the_deck' && r.stage === 2) { // the basic's two flicked cards: one stays, 300 px ahead
    put(base + (rnd() - 0.5) * 0.1, 300, 320);
  } else if (id === 'rotor_staff') { // flung out of its circle, fanned ahead (150–240 px), one by one as it spins
    for (let k = 0; k < 4; k++) put(base + (k - 1.5) * 0.32 + (rnd() - 0.5) * 0.12, 150 + rnd() * 90, ((k + 1) / 5) * T.active, false, 70);
  } else if (id === 'riffle_shuffle') { // the cards spread out round him as the shuffle ends (150–170 px)
    const a0 = rnd() * Math.PI * 2;
    for (let k = 0; k < 4; k++) put(a0 + k * (Math.PI / 2) + (rnd() - 0.5) * 0.4, 150 + rnd() * 20, T.active, false, 60);
  } else if (id === 'pickup_52') { // the deck lies strewn in its cone after the last wave — stuck in the planks
    for (let k = 0; k < 8; k++) put(base + (rnd() - 0.5) * 1.2, 90 + rnd() * 330, 760, true, 40);
  }
  return out;
}

/** The cards lying on the floor, per gambler. The scene adds a cast's cards, steps it every frame and draws what it says. */
export class FloorDeck {
  cards: DeckCard[] = [];
  /** a card lands (draw it lying) / is spent or its time is up (draw it crumbling) */
  onLay?: (c: DeckCard) => void;
  onDrop?: (c: DeckCard) => void;

  add(list: DeckCard[]): void {
    for (const c of list) {
      this.cards.push(c);
      const mine = this.cards.filter((x) => x.owner === c.owner);
      if (mine.length > DECK_MAX) this.remove(mine[0], true);
    }
  }
  step(now: number): void {
    for (const c of [...this.cards]) {
      if (!c.laid && now >= c.landAt) { c.laid = true; this.onLay?.(c); }
      if (now >= c.until) this.remove(c, true);
    }
  }
  /** Call the Deck: his landed cards within reach of (x, y), nearest first — taken off the floor (not dropped: they fly home). */
  gather(owner: string, x: number, y: number, now: number): DeckCard[] {
    const got = this.cards.filter((c) => c.owner === owner && now >= c.landAt && Math.hypot(c.x - x, (c.y - y) / 0.6) <= GATHER_R)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    for (const c of got) this.remove(c, false);
    return got;
  }
  /** His cards lying now (landed). */
  count(owner: string, now: number): number { return this.cards.filter((c) => c.owner === owner && now >= c.landAt).length; }
  clear(): void { for (const c of [...this.cards]) this.remove(c, true); }
  private remove(c: DeckCard, drop: boolean): void {
    const i = this.cards.indexOf(c); if (i < 0) return;
    this.cards.splice(i, 1);
    if (drop && c.laid) this.onDrop?.(c);
  }
}
