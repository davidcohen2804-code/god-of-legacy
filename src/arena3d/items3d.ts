// THE 3D HEROES' ITEMS (David 25 Oct: "make them a few items for every class — auras, a shirt, trousers, boots, a hat,
// a cloak (things you can swap) — to see how it reacts, and test it; once it all runs we'll think what to put in the
// CASH SHOP"; "a nice sword for the warrior, a cool bow for the archer, a mage…"). One set per class, each piece on its
// own slot: worn by any class (the weapon by its own weapon's class). No three.js here: the menus and the HUD read the
// catalogue and the worn set without loading the 3D (Wear3D builds them, Hero3D wears them).

export type Slot3D = 'weapon' | 'hat' | 'cloak' | 'top' | 'bottom' | 'shoes' | 'aura';
export const SLOTS3D: Slot3D[] = ['weapon', 'hat', 'cloak', 'top', 'bottom', 'shoes', 'aura'];
export const SLOT_NAME: Record<Slot3D, string> = { weapon: 'WEAPON', hat: 'HAT', cloak: 'CLOAK', top: 'SHIRT', bottom: 'TROUSERS', shoes: 'BOOTS', aura: 'AURA' };
export type Class3D = 'warrior' | 'samurai' | 'archer' | 'book_mage' | 'gambler';
export const CLASSES3D: Class3D[] = ['warrior', 'samurai', 'archer', 'book_mage', 'gambler'];
export const CLASS_NAME3D: Record<Class3D, string> = { warrior: 'WARRIOR', samurai: 'SAMURAI', archer: 'ARCHER', book_mage: 'MAGE', gambler: 'GAMBLER' };
/** Each class's set: its colour on the buttons. */
export const CLASS_TINT3D: Record<Class3D, string> = { warrior: '#d9583f', samurai: '#e07aa0', archer: '#6fbf5a', book_mage: '#8f7bff', gambler: '#e8b25a' };

/** A dye for the outfit's painted regions (top: the shirt, the vest and the sash; bottom: the trousers; shoes: the boots
 *  and the bracers): each region's colour (its painted shading kept), and a pattern laid on the body (pinstripes, checks,
 *  stars, scales, dots, waves) in a second colour. */
export interface Dye3D { color: string; pattern?: 'stripes' | 'checks' | 'stars' | 'scales' | 'dots' | 'waves'; with?: string; scale?: number; amount?: number }
export interface Item3D {
  id: string; slot: Slot3D; cls: Class3D; name: string;
  /** weapon: the class weapon it replaces and its file (public/assets/hero3d/). */
  weapon?: 'sword' | 'katana' | 'bow' | 'staff' | 'cane'; file?: string; girth?: number;
  /** top / bottom / shoes: the dye of each region it covers. */
  dye?: Partial<Record<'shirt' | 'vest' | 'sash' | 'pants' | 'boots' | 'bracer', Dye3D>>;
}

export const ITEMS3D: Item3D[] = [
  // ---------------------------------------------------------------- the warrior: Crimson Warlord
  { id: 'w_dragonfang', slot: 'weapon', cls: 'warrior', name: 'Dragonfang', weapon: 'sword', file: 'w_sword_dragon.glb' },
  { id: 'w_helm', slot: 'hat', cls: 'warrior', name: 'Warlord Helm' },
  { id: 'w_cape', slot: 'cloak', cls: 'warrior', name: 'Crimson Cape' },
  { id: 'w_tunic', slot: 'top', cls: 'warrior', name: 'Warlord Tunic', dye: { shirt: { color: '#3b3f47', pattern: 'scales', with: '#8d94a0', scale: 1, amount: 0.55 }, vest: { color: '#8e1c1c', pattern: 'stripes', with: '#d6a648', scale: 0.6, amount: 0.35 }, sash: { color: '#d6a648' } } },
  { id: 'w_breeches', slot: 'bottom', cls: 'warrior', name: 'Warlord Breeches', dye: { pants: { color: '#2b2d33' } } },
  { id: 'w_boots', slot: 'shoes', cls: 'warrior', name: 'Ironshod Boots', dye: { boots: { color: '#7d838d', pattern: 'scales', with: '#c9ced6', scale: 1.4, amount: 0.4 }, bracer: { color: '#7d838d' } } },
  { id: 'w_aura', slot: 'aura', cls: 'warrior', name: 'Ember Aura' },
  // ---------------------------------------------------------------- the samurai: Crimson Moon
  { id: 's_crimson_moon', slot: 'weapon', cls: 'samurai', name: 'Crimson Moon', weapon: 'katana', file: 'w_katana_moon.glb' },
  { id: 's_kasa', slot: 'hat', cls: 'samurai', name: 'Straw Kasa' },
  { id: 's_mantle', slot: 'cloak', cls: 'samurai', name: 'Ronin Mantle' },
  { id: 's_kimono', slot: 'top', cls: 'samurai', name: 'Indigo Kimono', dye: { shirt: { color: '#24325e', pattern: 'waves', with: '#d9dde8', scale: 1, amount: 0.5 }, vest: { color: '#15151b' }, sash: { color: '#b8233a' } } },
  { id: 's_hakama', slot: 'bottom', cls: 'samurai', name: 'Hakama', dye: { pants: { color: '#2a2a30', pattern: 'stripes', with: '#4a4a55', scale: 0.8, amount: 0.5 } } },
  { id: 's_tabi', slot: 'shoes', cls: 'samurai', name: 'Black Tabi Boots', dye: { boots: { color: '#1f1f24' }, bracer: { color: '#1f1f24' } } },
  { id: 's_aura', slot: 'aura', cls: 'samurai', name: 'Sakura Aura' },
  // ---------------------------------------------------------------- the archer: Sylvan
  { id: 'a_sylvan_wing', slot: 'weapon', cls: 'archer', name: 'Sylvan Wing', weapon: 'bow', file: 'w_bow_sylvan.glb' },
  { id: 'a_cap', slot: 'hat', cls: 'archer', name: 'Feathered Cap' },
  { id: 'a_leafcloak', slot: 'cloak', cls: 'archer', name: 'Leafcloak' },
  { id: 'a_jerkin', slot: 'top', cls: 'archer', name: 'Ranger Jerkin', dye: { shirt: { color: '#a8b98a' }, vest: { color: '#2f5b2c', pattern: 'dots', with: '#7fae5e', scale: 0.8, amount: 0.3 }, sash: { color: '#6b4a2b' } } },
  { id: 'a_leggings', slot: 'bottom', cls: 'archer', name: 'Ranger Leggings', dye: { pants: { color: '#3d3427' } } },
  { id: 'a_boots', slot: 'shoes', cls: 'archer', name: 'Ranger Boots', dye: { boots: { color: '#5e7a3a' }, bracer: { color: '#5e7a3a' } } },
  { id: 'a_aura', slot: 'aura', cls: 'archer', name: 'Verdant Aura' },
  // ---------------------------------------------------------------- the book mage: Astral
  { id: 'm_astral_staff', slot: 'weapon', cls: 'book_mage', name: 'Astral Staff', weapon: 'staff', file: 'w_staff_astral.glb' },
  { id: 'm_hat', slot: 'hat', cls: 'book_mage', name: 'Astral Hat' },
  { id: 'm_cloak', slot: 'cloak', cls: 'book_mage', name: 'Starfall Cloak' },
  { id: 'm_robe', slot: 'top', cls: 'book_mage', name: 'Astral Robe', dye: { shirt: { color: '#4a3a8c', pattern: 'stars', with: '#ffe9a8', scale: 1, amount: 0.9 }, vest: { color: '#1b1f4d', pattern: 'stars', with: '#c9d6ff', scale: 1.3, amount: 0.8 }, sash: { color: '#d9b44a' } } },
  { id: 'm_trousers', slot: 'bottom', cls: 'book_mage', name: 'Astral Trousers', dye: { pants: { color: '#1c2147' } } },
  { id: 'm_boots', slot: 'shoes', cls: 'book_mage', name: 'Moonstep Boots', dye: { boots: { color: '#3a3f7a', pattern: 'stars', with: '#e8eeff', scale: 1.2, amount: 0.7 }, bracer: { color: '#3a3f7a' } } },
  { id: 'm_aura', slot: 'aura', cls: 'book_mage', name: 'Arcane Aura' },
  // ---------------------------------------------------------------- the gambler: High Roller
  { id: 'g_royal_flush', slot: 'weapon', cls: 'gambler', name: 'Royal Flush', weapon: 'cane', file: 'w_cane_royal.glb' },
  { id: 'g_tophat', slot: 'hat', cls: 'gambler', name: 'High Roller Hat' },
  { id: 'g_cape', slot: 'cloak', cls: 'gambler', name: 'Velvet Cape' },
  { id: 'g_vest', slot: 'top', cls: 'gambler', name: "Dealer's Vest", dye: { shirt: { color: '#e9e4da' }, vest: { color: '#7a1022', pattern: 'stripes', with: '#d9b44a', scale: 1.1, amount: 0.45 }, sash: { color: '#141418' } } },
  { id: 'g_trousers', slot: 'bottom', cls: 'gambler', name: 'Pinstripe Trousers', dye: { pants: { color: '#17171c', pattern: 'stripes', with: '#8a8a96', scale: 1.3, amount: 0.6 } } },
  { id: 'g_shoes', slot: 'shoes', cls: 'gambler', name: 'Polished Boots', dye: { boots: { color: '#121216' }, bracer: { color: '#121216' } } },
  { id: 'g_aura', slot: 'aura', cls: 'gambler', name: 'Fortune Aura' },
];
export const ITEM3D: Record<string, Item3D> = Object.fromEntries(ITEMS3D.map((i) => [i.id, i]));

/** What a hero wears: an item's id per slot (none: the Beginner's own). */
export type Equip3D = Partial<Record<Slot3D, string>>;

/** A weapon item fits a hero whose class weapon is its weapon (a bow is an archer's); the rest fit anyone. */
export function fits3D(item: Item3D, weapon: string): boolean { return item.slot !== 'weapon' || item.weapon === weapon; }

const KEY = 'gol.items3d.';
/** The set a character wears (saved in this browser, per character). */
export function loadEquip3D(who: string): Equip3D {
  try { const v = JSON.parse(localStorage.getItem(KEY + who) ?? '{}') as Equip3D; return Object.fromEntries(Object.entries(v).filter(([s, id]) => SLOTS3D.includes(s as Slot3D) && !!id && ITEM3D[id as string]?.slot === s)) as Equip3D; } catch { return {}; }
}
export function saveEquip3D(who: string, e: Equip3D): void { try { localStorage.setItem(KEY + who, JSON.stringify(e)); } catch { /* (private window: worn this visit only) */ } }
