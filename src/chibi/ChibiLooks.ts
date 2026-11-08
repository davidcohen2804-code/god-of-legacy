// THE CHIBI LOOKS (David 8 Nov: a character creation — hair styles, eyes, skin, a first outfit, a first bow — then a
// cash shop: hats, face accessories, tops, bottoms, overalls, capes, shoes). A look is chosen as a spec (the ids below,
// from the catalogue GPT directed: tools/chibi/archer/src/looks_R.py) and resolved here into what the paper doll
// composes (ChibiDoll.Look). The spec, the items bought and the test balance are kept in this browser (localStorage).
import type { DollCatalog, Look, ShopDef } from './ChibiDoll';

export type Slot = 'hat' | 'face' | 'top' | 'bottom' | 'overall' | 'cape' | 'shoes';
export const SLOTS: Slot[] = ['hat', 'face', 'top', 'bottom', 'overall', 'cape', 'shoes'];
export const SLOT_NAMES: Record<Slot, string> = { hat: 'Hat', face: 'Face', top: 'Top', bottom: 'Bottom', overall: 'Overall', cape: 'Cape', shoes: 'Shoes' };

export interface LookSpec {
  hair: string; hairColour: string; eyes: string; skin: string; outfit: string; bow: string;
  equip: Partial<Record<Slot, string>>;
}
/** The Archer as approved (the class's own outfit and bow, the master's colours). */
export const ARCHER_SPEC: LookSpec = { hair: 'wind', hairColour: '', eyes: 'calm', skin: '', outfit: 'archer', bow: 'hunter', equip: {} };
/** A new character's first choices (the creation screen opens on them). */
export const NEW_SPEC: LookSpec = { hair: 'wind', hairColour: 'chestnut', eyes: 'calm', skin: 'porcelain', outfit: 'novice', bow: 'sprout', equip: {} };

const KEY = (cls: string) => `gol.chibi.look.${cls}`;
const SHOP_KEY = (cls: string) => `gol.chibi.shop.${cls}`;
const get = (k: string): unknown => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };
const put = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* (private mode: kept for this visit only) */ } };

let memo: Record<string, LookSpec | null> = {};
export function savedSpec(cls: string): LookSpec | null {
  if (!(cls in memo)) { const s = get(KEY(cls)) as LookSpec | null; memo[cls] = s && typeof s === 'object' ? { ...NEW_SPEC, ...s, equip: { ...(s.equip ?? {}) } } : null; }
  return memo[cls];
}
export function saveSpec(cls: string, spec: LookSpec): void { memo[cls] = { ...spec, equip: { ...spec.equip } }; put(KEY(cls), spec); }
export function resetSpecs(): void { memo = {}; }

/** The cash shop's test wallet and the items bought (a balance to try buying with; no real money anywhere). */
export interface ShopState { gems: number; owned: string[] }
export const START_GEMS = 20000;
export function shopState(cls: string): ShopState {
  const s = get(SHOP_KEY(cls)) as ShopState | null;
  return s && typeof s.gems === 'number' ? { gems: s.gems, owned: [...(s.owned ?? [])] } : { gems: START_GEMS, owned: [] };
}
export function saveShop(cls: string, s: ShopState): void { put(SHOP_KEY(cls), s); }
/** Prices per slot (the shop's test prices). */
export const PRICE: Record<Slot, number> = { hat: 1800, face: 900, top: 1600, bottom: 1200, overall: 2400, cape: 2000, shoes: 1000 };

export function shopDef(cat: DollCatalog, slot: Slot, id: string | undefined): ShopDef | undefined {
  return id ? cat.shop[slot]?.find((x) => x[0] === id)?.[2] : undefined;
}

/** The look the paper doll composes for a spec. */
export function resolveLook(spec: LookSpec, cat: DollCatalog): Look {
  const maps: Record<string, Record<string, string>> = {};
  const addMaps = (m?: Record<string, Record<string, string>>) => { for (const [k, v] of Object.entries(m ?? {})) maps[k] = { ...(maps[k] ?? {}), ...v }; };
  const wear = new Set<string>();
  if (spec.outfit === 'archer') cat.archer.forEach((i) => wear.add(i));
  else { const o = cat.outfits.find((x) => x[0] === spec.outfit) ?? cat.outfits[0]; o[2].forEach((i) => wear.add(i)); addMaps(o[3]); }
  const eq = spec.equip, body: Slot[] = eq.overall ? ['overall', 'cape', 'shoes'] : ['top', 'bottom', 'cape', 'shoes'];
  for (const slot of body) {
    const d = shopDef(cat, slot, eq[slot]);
    if (!d) continue;
    for (const k of Object.keys(d.maps ?? {})) if (k !== 'base') delete maps[k];          // (the item's colours, whole)
    d.wear?.forEach((i) => wear.add(i)); d.unwear?.forEach((i) => wear.delete(i));
    addMaps(d.maps);
  }
  let hat: string | undefined, cut: string | undefined;
  const h = shopDef(cat, 'hat', eq.hat);
  if (h) {
    wear.delete('hood'); delete maps.hood;
    h.wear?.forEach((i) => wear.add(i)); addMaps(h.maps);
    hat = h.att; cut = h.cut;
  } else if (wear.has('hood')) cut = 'hood';
  const face = shopDef(cat, 'face', eq.face)?.att;
  const bow = cat.bows.find((b) => b[0] === spec.bow);
  if (bow && Object.keys(bow[2]).length) maps.bow = { ...bow[2] };
  const skin = cat.skins.find((s) => s[0] === spec.skin)?.[2];
  const hairMap = cat.hairColours.find((c) => c[0] === spec.hairColour)?.[2];
  return { wear: [...wear], maps, skin, hair: spec.hair, hairMap, eyes: spec.eyes, hat, face, cut };
}
