// Early-game items: food and potions (HP / MP), buff potions, the Return Scroll, the Elixir and monster materials, plus
// gold. Monsters drop them on the floor (their own drop table), walking over them picks them up, Mira's shop sells them.
// Recovery is a fixed amount (bigger items for bigger HP pools later); HP costs ~1.2 gold a point, MP ~2.7.

export type ItemKind = 'hp' | 'mp' | 'both' | 'pct' | 'buff' | 'scroll' | 'mat';
export interface ItemDef {
  id: string; name: string; kind: ItemKind; icon: string;
  hp?: number; mp?: number; /** pct: share of max HP and MP */ pct?: number;
  buff?: { stat: 'dmg' | 'speed'; mul: number; ms: number };
  /** Shop price (absent: not sold) and what the shop pays for one. */
  price?: number; sell: number;
  desc: string;
  /** How rare: the colour of its name, the light under it on the floor (a rare one: a beam of light). */
  rarity: Rarity;
  /** Its place in the world: one or two lines shown in its tooltip and when it is found for the first time. */
  lore: string;
}
export type Rarity = 'common' | 'uncommon' | 'rare';
export const RARITY: Record<Rarity, { label: string; color: string; glow: number }> = {
  common: { label: 'Common', color: '#ece5d3', glow: 0xfff2c0 },
  uncommon: { label: 'Uncommon', color: '#8fe39a', glow: 0xa8ffb0 },
  rare: { label: 'Rare', color: '#ffb3e6', glow: 0xff9ad8 },
};
const I = (id: string) => `assets/final/items/${id}.png`;
const MIN = 60_000;
export const ITEMS: Record<string, ItemDef> = {
  apple: { id: 'apple', name: 'Apple', kind: 'hp', icon: I('apple'), hp: 15, price: 20, sell: 10, desc: 'Restores 15 HP.', rarity: 'common', lore: "Picked in the orchards below the Legacy Courtyard. Aldric's students eat them between drills." },
  red_potion: { id: 'red_potion', name: 'Red Potion', kind: 'hp', icon: I('red_potion'), hp: 40, price: 50, sell: 25, desc: 'Restores 40 HP.', rarity: 'common', lore: "Brewed from sunstone salt and crimson root. No one walks the road without a few." },
  meat: { id: 'meat', name: 'Meat', kind: 'hp', icon: I('meat'), hp: 60, price: 80, sell: 40, desc: 'Restores 60 HP.', rarity: 'common', lore: "Roasted over the fire pits of Sunstone Plaza. Heavy, filling and worth the grease." },
  orange: { id: 'orange', name: 'Orange', kind: 'mp', icon: I('orange'), mp: 20, price: 50, sell: 25, desc: 'Restores 20 MP.', rarity: 'common', lore: "Sun-ripened on the Ivy Terraces. Its sharp juice clears the head and steadies the mind." },
  blue_potion: { id: 'blue_potion', name: 'Blue Potion', kind: 'mp', icon: I('blue_potion'), mp: 80, price: 220, sell: 110, desc: 'Restores 80 MP.', rarity: 'uncommon', lore: "Distilled from the Temple's spring water. Mages swear by it; Mira swears by its price." },
  cake: { id: 'cake', name: 'Cake', kind: 'both', icon: I('cake'), hp: 40, mp: 40, price: 150, sell: 75, desc: 'Restores 40 HP and 40 MP.', rarity: 'common', lore: "Bren's wife bakes these for the Temple guards. Somehow Mira always has a few to sell." },
  warrior_potion: { id: 'warrior_potion', name: 'Warrior Potion', kind: 'buff', icon: I('warrior_potion'), buff: { stat: 'dmg', mul: 1.1, ms: 10 * MIN }, price: 400, sell: 200, desc: 'Damage +10% for 10 minutes.', rarity: 'uncommon', lore: "A fiery draught first mixed for the Temple's sword trials. It burns all the way down." },
  swift_potion: { id: 'swift_potion', name: 'Swift Potion', kind: 'buff', icon: I('swift_potion'), buff: { stat: 'speed', mul: 1.1, ms: 10 * MIN }, price: 300, sell: 150, desc: 'Movement speed +10% for 10 minutes.', rarity: 'uncommon', lore: "Brewed with feather-grass from the high ridges. Your boots feel lighter at once." },
  return_scroll: { id: 'return_scroll', name: 'Return Scroll', kind: 'scroll', icon: I('return_scroll'), price: 400, sell: 200, desc: 'Returns you to the Legacy Courtyard.', rarity: 'uncommon', lore: "Sealed with the Courtyard's sun emblem. Read it aloud and the light carries you home." },
  elixir: { id: 'elixir', name: 'Elixir', kind: 'pct', icon: I('elixir'), pct: 0.5, sell: 500, desc: 'Restores 50% of max HP and MP.', rarity: 'rare', lore: "A golden brew from the days before the Curse. No one living remembers the recipe." },
  rust_shard: { id: 'rust_shard', name: 'Rust Shard', kind: 'mat', icon: I('rust_shard'), sell: 5, desc: 'A broken piece of a rusted blade. Merchants buy it.', rarity: 'common', lore: "All that is left of the old Courtyard guard's blades, eaten by rust when the Curse fell." },
  cursed_cloth: { id: 'cursed_cloth', name: 'Cursed Cloth', kind: 'mat', icon: I('cursed_cloth'), sell: 12, desc: 'A scrap of cloth that still hums with a curse. Merchants buy it.', rarity: 'common', lore: "Torn from the cloaks of the Cursed Swordsmen. The curse still hums in its threads." },
};
export const ITEM_IDS = Object.keys(ITEMS);
/** One short line for lists: "+40 HP", "+10% damage · 10 min". */
export function shortDesc(d: ItemDef): string {
  if (d.kind === 'buff' && d.buff) return `+${Math.round((d.buff.mul - 1) * 100)}% ${d.buff.stat === 'dmg' ? 'damage' : 'speed'} · ${Math.round(d.buff.ms / 60000)} min`;
  if (d.kind === 'pct') return `${Math.round((d.pct ?? 0) * 100)}% HP and MP`;
  if (d.kind === 'scroll') return 'Back to the Courtyard';
  if (d.kind === 'mat') return 'Material';
  return [d.hp ? `+${d.hp} HP` : '', d.mp ? `+${d.mp} MP` : ''].filter(Boolean).join('  ');
}
/** Usable from the bag / a hotkey. */
export const usable = (id: string): boolean => !!ITEMS[id] && ITEMS[id].kind !== 'mat';
/** Mira's shelf, in order. */
export const SHOP = ['apple', 'red_potion', 'meat', 'orange', 'blue_potion', 'cake', 'warrior_potion', 'swift_potion', 'return_scroll'];

export const GOLD_ICON = { small: I('gold_small'), big: I('gold_big') };
/** Gold at or above this drops as the big pile. */
export const GOLD_BIG = 12;
/** Between two uses of the same hotkey (ms). */
export const POTION_DELAY = 400;
export const BAG_MAX = 999;
export const GOLD_MAX = 999_999_999;
/** What a new character starts with. */
export const STARTER_BAG: Record<string, number> = { red_potion: 10, blue_potion: 5 };
/** The two item hotkeys (8 / 9) by default. */
export const DEFAULT_QUICK: [string, string] = ['red_potion', 'blue_potion'];

/** Each monster kind's drops: gold [min, max] always; items each on its own chance. */
const DROPS: Record<string, { gold: [number, number]; items: [string, number][] }> = {
  rusted: { gold: [3, 6], items: [['rust_shard', 0.4], ['apple', 0.08], ['orange', 0.06], ['red_potion', 0.04]] },
  cursed: { gold: [8, 14], items: [['cursed_cloth', 0.35], ['meat', 0.06], ['red_potion', 0.06], ['blue_potion', 0.04], ['elixir', 0.003]] },
};

export interface Drop { kind: 'gold' | 'item'; id?: string; amount: number }
export function rollDrops(kind: string | undefined, exp: number, rnd: () => number = Math.random): Drop[] {
  const t = (kind && DROPS[kind]) || { gold: [Math.max(1, Math.round(exp * 0.25)), Math.max(2, Math.round(exp * 0.45))] as [number, number], items: [] };
  const out: Drop[] = [{ kind: 'gold', amount: t.gold[0] + Math.floor(rnd() * (t.gold[1] - t.gold[0] + 1)) }];
  for (const [id, p] of t.items) if (rnd() < p) out.push({ kind: 'item', id, amount: 1 });
  return out;
}

/** Stored bag made safe: known items only, whole counts 1..BAG_MAX. */
export function cleanBag(raw: unknown): Record<string, number> {
  const b: Record<string, number> = {};
  if (raw && typeof raw === 'object') for (const id of ITEM_IDS) { const v = (raw as Record<string, unknown>)[id]; if (typeof v === 'number' && Number.isInteger(v) && v > 0) b[id] = Math.min(BAG_MAX, v); }
  return b;
}
export const cleanQuick = (raw: unknown): [string, string] => {
  const q = Array.isArray(raw) ? raw : [];
  return [0, 1].map((i) => (typeof q[i] === 'string' && usable(q[i]) ? q[i] : DEFAULT_QUICK[i])) as [string, string];
};
export const cleanGold = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(GOLD_MAX, v) : 0);
export const fmtGold = (n: number): string => n.toLocaleString('en-US');
