// PvP rank: rank points (RP) climbing through tiers (Bronze III … Diamond I, Master, Legend), the win streak, the record
// and the titles earned on the way. Every match counts: against players in full, against the sparring knight by its level
// (EASY a third, MIDDLE half, HARD most of it). Friendly by design: a loss in Bronze costs half, and a tier once reached is
// never lost (losses stop at its floor). Kept in this browser, per character (the selected one; 'guest' without one).
import { CharacterStore } from '../characters/CharacterStore';

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'legend';
export interface Tier { id: TierId; name: string; from: number; divs: number; color: string }
/** The ladder (RP where each tier starts; divisions of DIV_RP each: III, II, I). */
export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'BRONZE', from: 0, divs: 3, color: '#e09a5c' },
  { id: 'silver', name: 'SILVER', from: 300, divs: 3, color: '#d5deea' },
  { id: 'gold', name: 'GOLD', from: 600, divs: 3, color: '#ffd36a' },
  { id: 'platinum', name: 'PLATINUM', from: 900, divs: 3, color: '#a8f0ea' },
  { id: 'diamond', name: 'DIAMOND', from: 1200, divs: 3, color: '#7fb4ff' },
  { id: 'master', name: 'MASTER', from: 1500, divs: 1, color: '#cf8cff' },
  { id: 'legend', name: 'LEGEND', from: 1800, divs: 1, color: '#ff7a45' },
];
export const DIV_RP = 100;
const ROMAN = ['', 'I', 'II', 'III'];

/** Where `rp` stands: its tier, division (3 = III … 1 = I; 0: a tier without divisions), label, and the RP into the
 *  current step and that step's size (the bar; Master fills toward Legend, Legend is full). */
export interface RankView { tier: Tier; div: number; label: string; into: number; span: number }
export function rankOf(rp: number): RankView {
  const r = Math.max(0, Math.floor(rp));
  let i = TIERS.length - 1;
  while (i > 0 && r < TIERS[i].from) i--;
  const t = TIERS[i];
  if (t.divs === 1) {
    const next = TIERS[i + 1];
    return { tier: t, div: 0, label: t.name, into: next ? r - t.from : 1, span: next ? next.from - t.from : 1 };
  }
  const step = Math.min(t.divs - 1, Math.floor((r - t.from) / DIV_RP)), div = t.divs - step;
  return { tier: t, div, label: `${t.name} ${ROMAN[div]}`, into: r - t.from - step * DIV_RP, span: DIV_RP };
}

/** One character's PvP record. */
export interface RankRecord { rp: number; w: number; l: number; d: number; streak: number; best: number; perfects: number; maxCombo: number; hero: Record<string, number>; titles: string[]; title: string | null }
const fresh = (): RankRecord => ({ rp: 0, w: 0, l: 0, d: 0, streak: 0, best: 0, perfects: 0, maxCombo: 0, hero: {}, titles: [], title: null });

/** The titles (earned once, kept for good; one is worn under your name). */
export interface Title { id: string; name: string; how: string; got(r: RankRecord): boolean }
export const TITLES: readonly Title[] = [
  { id: 'rookie', name: 'Rookie', how: 'Fight your first match', got: (r) => r.w + r.l + r.d >= 1 },
  { id: 'duelist', name: 'Duelist', how: 'Win 10 matches', got: (r) => r.w >= 10 },
  { id: 'veteran', name: 'Veteran', how: 'Win 50 matches', got: (r) => r.w >= 50 },
  { id: 'on_fire', name: 'On Fire', how: 'Win 5 in a row', got: (r) => r.best >= 5 },
  { id: 'unstoppable', name: 'Unstoppable', how: 'Win 10 in a row', got: (r) => r.best >= 10 },
  { id: 'untouchable', name: 'Untouchable', how: 'Win 5 rounds without a scratch', got: (r) => r.perfects >= 5 },
  { id: 'combo_artist', name: 'Combo Artist', how: 'Land a 20-hit combo', got: (r) => r.maxCombo >= 20 },
  { id: 'lionheart', name: 'Lionheart', how: 'Win 15 matches as the Warrior', got: (r) => (r.hero.warrior ?? 0) >= 15 },
  { id: 'blade_saint', name: 'Blade Saint', how: 'Win 15 matches as the Samurai', got: (r) => (r.hero.samurai ?? 0) >= 15 },
  { id: 'arcanist', name: 'Arcanist', how: 'Win 15 matches as the Book Mage', got: (r) => (r.hero.book_mage ?? 0) >= 15 },
  { id: 'hawkeye', name: 'Hawkeye', how: 'Win 15 matches as the Archer', got: (r) => (r.hero.archer ?? 0) >= 15 },
  { id: 'high_roller', name: 'High Roller', how: 'Win 15 matches as the Gambler', got: (r) => (r.hero.gambler ?? 0) >= 15 },
  { id: 'gold_contender', name: 'Gold Contender', how: 'Reach Gold', got: (r) => r.rp >= 600 },
  { id: 'diamond_edge', name: 'Diamond Edge', how: 'Reach Diamond', got: (r) => r.rp >= 1200 },
  { id: 'grand_master', name: 'Grand Master', how: 'Reach Master', got: (r) => r.rp >= 1500 },
  { id: 'living_legend', name: 'Living Legend', how: 'Reach Legend', got: (r) => r.rp >= 1800 },
];
export const titleName = (id: string | null | undefined): string | null => TITLES.find((t) => t.id === id)?.name ?? null;

const KEY = 'gol-pvp-rank';
const whose = (): string => CharacterStore.getSelectedCharacter()?.id ?? 'guest';
function all(): Record<string, RankRecord> { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; } }

/** Your record (the selected character's). */
export function myRank(): RankRecord { return { ...fresh(), ...all()[whose()] }; }

/** Wear an earned title (or none). */
export function wearTitle(id: string | null): void {
  const a = all(), r = { ...fresh(), ...a[whose()] };
  if (id !== null && !r.titles.includes(id)) return;
  r.title = id; a[whose()] = r;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable: this visit only */ }
}

/** A finished match, from your side. */
export interface Outcome { won: boolean | null; cls: string; perfects: number; maxCombo: number; vs: 'cpu' | 'player'; level?: 'easy' | 'middle' | 'hard'; foeRp?: number }
/** What the match did to your rank. */
export interface RankChange { before: RankRecord; after: RankRecord; delta: number; up: boolean; down: boolean; titles: Title[] }

const LEVEL_K = { easy: 0.34, middle: 0.5, hard: 0.8 } as const;

/** Counts a finished match into your record (saved) and tells what changed. */
export function settle(o: Outcome): RankChange {
  const a = all(), before: RankRecord = { ...fresh(), ...a[whose()] }, r: RankRecord = { ...before, hero: { ...before.hero }, titles: [...before.titles] };
  const k = o.vs === 'player' ? 1 : LEVEL_K[o.level ?? 'middle'];
  let delta = 0;
  if (o.won === true) {
    r.w++; r.streak = Math.max(1, r.streak + 1); r.best = Math.max(r.best, r.streak); r.hero[o.cls] = (r.hero[o.cls] ?? 0) + 1;
    const upset = o.foeRp !== undefined && o.foeRp > r.rp ? Math.min(10, (o.foeRp - r.rp) / 30) : 0; // (beating someone above you)
    delta = Math.round((20 + Math.min(12, 3 * (r.streak - 1)) + 4 * o.perfects + upset) * k);
  } else if (o.won === false) {
    r.l++; r.streak = 0;
    delta = -Math.round(14 * k * (rankOf(r.rp).tier.id === 'bronze' ? 0.5 : 1));
  } else { r.d++; }
  r.perfects += o.perfects; r.maxCombo = Math.max(r.maxCombo, o.maxCombo);
  const floor = rankOf(before.rp).tier.from; // (a tier once reached is never lost)
  r.rp = Math.max(floor, r.rp + delta); delta = r.rp - before.rp;
  const titles = TITLES.filter((t) => !r.titles.includes(t.id) && t.got(r));
  for (const t of titles) r.titles.push(t.id);
  if (!r.title && titles.length) r.title = titles[titles.length - 1].id; // (your first title is worn at once)
  a[whose()] = r;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable: this visit only */ }
  const b = rankOf(before.rp), n = rankOf(r.rp), order = (v: RankView) => TIERS.indexOf(v.tier) * 4 + (4 - v.div);
  return { before, after: r, delta, up: order(n) > order(b), down: order(n) < order(b), titles };
}
