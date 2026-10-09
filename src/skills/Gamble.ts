// The gambler's rules (the gambler spec): the Hand (a poker hand dealt by the skills that land, played by Showdown),
// the charged cards stuck in a foe (they burst a beat later, or at once under a staff blow), and the casino's luck
// (Coin Flip, Roulette Wheel, Dice Bomb) — drawn from the cast's id, so every client sees the same outcome.
// Gameplay only: the pictures are GamblerFx's.

export type Suit = 'S' | 'H' | 'D' | 'C';
export interface Card { suit: Suit; rank: number; joker?: boolean }

/** The suit each skill deals: ♠ the staff up close, ♦ the thrown cards, ♣ the blasts, ♥ luck, moves and the grab. */
export const SUIT: Record<string, Suit> = {
  charged_deal: 'D', riffle_shuffle: 'D', ace_in_the_hole: 'D', pickup_52: 'D',
  staff_vault: 'S', rotor_staff: 'S', grand_slam: 'S',
  fuse_slam: 'C', roulette_wheel: 'C', dice_bomb: 'C', jackpot: 'C',
  coin_flip: 'H', kinetic_grab: 'H', lady_luck: 'H', kinetic_overload: 'H',
};
export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_NAME = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));

/** A hand's rank, its damage multiplier for Showdown, and its bonus. */
export interface HandValue { name: string; label: string; mul: number; tier: number; flush: Suit | null; bonus: 'none' | 'stun' | 'pull' | 'flush' | 'knockdown' | 'stun2' | 'straightFlush' | 'royal' }
export const HAND_TABLE: Omit<HandValue, 'flush'>[] = [
  { name: 'high', label: 'HIGH CARD', mul: 1.0, tier: 0, bonus: 'none' },
  { name: 'pair', label: 'PAIR', mul: 1.2, tier: 1, bonus: 'none' },
  { name: 'two_pair', label: 'TWO PAIR', mul: 1.35, tier: 2, bonus: 'none' },
  { name: 'three', label: 'THREE OF A KIND', mul: 1.5, tier: 3, bonus: 'stun' },
  { name: 'straight', label: 'STRAIGHT!', mul: 1.7, tier: 4, bonus: 'pull' },
  { name: 'flush', label: 'FLUSH!', mul: 1.8, tier: 5, bonus: 'flush' },
  { name: 'full_house', label: 'FULL HOUSE!', mul: 2.0, tier: 6, bonus: 'knockdown' },
  { name: 'four', label: 'FOUR OF A KIND!!', mul: 2.4, tier: 7, bonus: 'stun2' },
  { name: 'straight_flush', label: 'STRAIGHT FLUSH!!', mul: 2.8, tier: 8, bonus: 'straightFlush' },
  { name: 'royal', label: 'ROYAL FLUSH!!!', mul: 3.2, tier: 9, bonus: 'royal' },
];
/** In PvP no hand multiplies a Showdown past this (luck never decides a fight on its own). */
export const PVP_HAND_CAP = 2.2;
export const HAND_MAX = 5;
export const HAND_KEEP_MS = 8000, HAND_KEEP_STACKED_MS = 15000;
/** Charged cards stuck in a foe: they burst after this; at most this many at once. */
export const FUSE_MS = 600, STUCK_MAX = 5;
/** A staff blow on a charged foe: each stuck card adds this share of the blow (Short Fuse: ×1.3). */
export const FUSE_PER_CARD = 0.12;

function evalPlain(cards: Card[]): HandValue {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const five = cards.length === HAND_MAX;
  const flushSuit = five && cards.every((c) => c.suit === cards[0].suit) ? cards[0].suit : null;
  const uniq = [...counts.keys()].sort((a, b) => b - a);
  let straight = five && uniq.length === 5 && uniq[0] - uniq[4] === 4;
  if (five && !straight && uniq.join(',') === '14,5,4,3,2') straight = true; // the wheel: A-2-3-4-5
  const pick = (name: string): HandValue => ({ ...HAND_TABLE.find((h) => h.name === name)!, flush: flushSuit });
  if (straight && flushSuit) return pick(uniq[0] === 14 && uniq[4] === 10 ? 'royal' : 'straight_flush');
  if (groups[0] === 4) return pick('four');
  if (groups[0] === 3 && groups[1] === 2) return pick('full_house');
  if (flushSuit) return pick('flush');
  if (straight) return pick('straight');
  if (groups[0] === 3) return pick('three');
  if (groups[0] === 2 && groups[1] === 2) return pick('two_pair');
  if (groups[0] === 2) return pick('pair');
  return pick('high');
}

/** The best value of a hand; jokers become whatever card makes it best. */
export function evaluate(cards: Card[]): HandValue {
  const jokers = cards.filter((c) => c.joker).length;
  const plain = cards.filter((c) => !c.joker);
  if (!jokers) return evalPlain(plain);
  let best: HandValue | null = null;
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const tryWith = (hand: Card[], left: number): void => {
    if (left === 0) { const v = evalPlain(hand); if (!best || v.tier > best.tier) best = v; return; }
    for (let r = 2; r <= 14; r++) for (const s of suits) { tryWith([...hand, { suit: s, rank: r }], left - 1); if (best && best.tier === 9) return; }
  };
  tryWith(plain, jokers);
  return best ?? evalPlain(plain);
}

/** The gambler's own Hand (the local player). */
export class Hand {
  cards: Card[] = [];
  lastAt = -1;
  /** Casts that already dealt their card (one card per cast). */
  private dealt = new Set<string>();

  deal(castId: string, suit: Suit, now: number, opts: { min?: number; rank?: number } = {}): Card | null {
    if (this.dealt.has(castId)) return null;
    this.dealt.add(castId);
    if (this.dealt.size > 200) this.dealt = new Set([...this.dealt].slice(-100));
    const lo = opts.min ?? 2;
    const card: Card = { suit, rank: opts.rank ?? lo + Math.floor(Math.random() * (15 - lo)) };
    this.push(card, now);
    return card;
  }
  joker(now: number): Card { const c: Card = { suit: 'S', rank: 0, joker: true }; this.push(c, now); return c; }
  private push(c: Card, now: number): void {
    this.cards.push(c);
    if (this.cards.length > HAND_MAX) this.cards.shift(); // a sixth card pushes the oldest out
    this.lastAt = now;
  }
  /** Cards fade one by one once the hand has been left alone `keepMs`. Returns true when one went. */
  tick(now: number, keepMs: number): boolean {
    if (!this.cards.length || now - this.lastAt < keepMs) return false;
    this.cards.shift(); this.lastAt = now - keepMs + 400; // the next one goes 0.4s later
    return true;
  }
  value(): HandValue | null { return this.cards.length >= 2 ? evaluate(this.cards) : null; }
  /** Showdown: the hand is played (Stacked Deck: a five-card hand gives one card back). */
  play(keepOne: boolean): Card[] {
    const was = this.cards;
    this.cards = keepOne && was.length === HAND_MAX ? [was[was.length - 1]] : [];
    return was;
  }
  clear(): void { this.cards = []; }
}

/** Charged cards stuck in each foe (by target id), as this client sees them. */
export class Stuck {
  private m = new Map<string, number[]>();
  add(target: string, n: number, now: number): number {
    const l = (this.m.get(target) ?? []).filter((t) => t > now);
    for (let i = 0; i < n; i++) l.push(now + FUSE_MS + i * 70);
    while (l.length > STUCK_MAX) l.shift();
    this.m.set(target, l);
    return l.length;
  }
  /** A staff blow: every card still stuck goes off now. */
  take(target: string, now: number): number {
    const l = (this.m.get(target) ?? []).filter((t) => t > now);
    this.m.delete(target);
    return l.length;
  }
  count(target: string, now: number): number { return (this.m.get(target) ?? []).filter((t) => t > now).length; }
  clear(): void { this.m.clear(); }
}

/** A number in 0..1 drawn from the cast's id (the same on every client) and a salt. */
export function castRoll(castId: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < castId.length; i++) { h ^= castId.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Coin Flip: heads (true) or tails. */
export const coinOf = (castId: string): boolean => castRoll(castId, 1) < 0.5;
/** Roulette Wheel: where the ball stops — the pocket (0..17) and red (true) or black. */
export function rouletteOf(castId: string): { pocket: number; red: boolean } {
  const pocket = Math.floor(castRoll(castId, 2) * 18);
  return { pocket, red: pocket % 2 === 0 };
}
/** Dice Bomb: the two dice. */
export function diceOf(castId: string): [number, number] {
  return [1 + Math.floor(castRoll(castId, 3) * 6), 1 + Math.floor(castRoll(castId, 4) * 6)];
}
