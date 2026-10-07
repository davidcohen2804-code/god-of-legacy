// Equipment, MapleStory-style: what a character owns and wears. Every character starts with the starter set (sword,
// T-shirt, pants, boots) in the colours chosen at creation; a piece can be taken off into the bag and put back on.
// Worn pieces give stats — attack (weapon) and defence (clothes) — and are drawn on the character everywhere
// (the game, the menus, other players).
import GEAR_DATA from '../data/gear.json';
import OUTFIT_COLORS from '../data/outfit-colors.json';

export type GearSlot = 'weapon' | 'head' | 'top' | 'bottom' | 'shoes';
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'head', 'top', 'bottom', 'shoes'];
export const SLOT_NAMES: Record<GearSlot, string> = { weapon: 'Weapon', head: 'Head', top: 'Top', bottom: 'Bottom', shoes: 'Shoes' };
type Piece = 'top' | 'pants' | 'shoes';
export interface GearDef { id: string; slot: GearSlot; name: string; desc: string; att?: number; def?: number; colors?: Piece;
  /** A weapon drawn with its own sword strips (naked/<g>/gear/<move>_sword_<sword>.png, tools/base/weapon_item.py); none = the starter sword. */
  sword?: string;
  /** A head piece's layer on the standing head (naked/<g>/helm/<helm>.png). */
  helm?: string;
  /** Armour with its own strips (naked/<g>/gear/<move>_<piece>_<armor>.png, tools/base/armor_item.py); on a top: an
   *  overall (top + pants as one piece: wearing it takes the bottom off). */
  armor?: string; overall?: boolean }
/** One owned piece: which item, in which colour. */
export interface GearItem { uid: string; id: string; color: number }
/** Everything a character owns, and what it wears (slot → item uid). */
export interface GearState { items: GearItem[]; worn: Partial<Record<GearSlot, string>> }
export interface GearStats { att: number; def: number; armed: boolean }

const G = GEAR_DATA as { baseAtt: number; unarmed: number; defPct: number; defCap: number; items: GearDef[] };
const COLORS = OUTFIT_COLORS as Record<Piece, { name: string; swatch: string }[]>;
export const GEAR: Record<string, GearDef> = Object.fromEntries(G.items.map((d) => [d.id, d]));
const STARTER: Partial<Record<GearSlot, string>> = { weapon: 'starter_sword', top: 'starter_shirt', bottom: 'starter_pants', shoes: 'starter_boots' };

const newUid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The piece's name with its colour ("Blue T-Shirt"). */
export function itemName(it: GearItem): string {
  const d = GEAR[it.id]; if (!d) return it.id;
  const c = d.colors ? COLORS[d.colors]?.[it.color]?.name : undefined;
  return c ? `${cap(c)} ${d.name}` : d.name;
}
/** The swatch of the piece's colour (bag icons tint), if it has colours. */
export const itemSwatch = (it: GearItem): string | null => { const d = GEAR[it.id]; return d?.colors ? COLORS[d.colors]?.[it.color]?.swatch ?? null : null; };

/** The starter set, worn, in the colours chosen at creation. */
export function starterGear(look?: { top?: number; pants?: number; shoes?: number } | null): GearState {
  const col: Partial<Record<GearSlot, number>> = { weapon: 0, top: look?.top ?? 0, bottom: look?.pants ?? 0, shoes: look?.shoes ?? 0 };
  const slots = GEAR_SLOTS.filter((s) => STARTER[s]);   // no starter head piece
  const items = slots.map((s) => ({ uid: newUid() + s.charAt(0), id: STARTER[s]!, color: col[s] ?? 0 }));
  return { items, worn: Object.fromEntries(slots.map((s, i) => [s, items[i].uid])) };
}

/** Stored gear made safe: known items, colours in range, worn pieces that are owned and fit their slot. */
export function cleanGear(raw: unknown): GearState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { items?: unknown; worn?: unknown };
  if (!Array.isArray(o.items)) return null;
  const items: GearItem[] = [];
  for (const r of o.items as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || typeof r.uid !== 'string' || typeof r.id !== 'string' || !GEAR[r.id]) continue;
    const d = GEAR[r.id], n = d.colors ? COLORS[d.colors]?.length ?? 1 : 1;
    const color = typeof r.color === 'number' && Number.isInteger(r.color) && r.color >= 0 && r.color < n ? r.color : 0;
    if (!items.some((x) => x.uid === r.uid)) items.push({ uid: r.uid, id: r.id, color });
  }
  const worn: GearState['worn'] = {};
  const w = (o.worn && typeof o.worn === 'object' ? o.worn : {}) as Record<string, unknown>;
  for (const s of GEAR_SLOTS) { const it = items.find((x) => x.uid === w[s]); if (it && GEAR[it.id].slot === s) worn[s] = it.uid; }
  return { items, worn };
}

export const wornItem = (g: GearState | null | undefined, s: GearSlot): GearItem | null => (g ? g.items.find((x) => x.uid === g.worn[s]) ?? null : null);
/** The pieces in the bag (owned, not worn). */
export const bagItems = (g: GearState | null | undefined): GearItem[] => (g ? g.items.filter((x) => !Object.values(g.worn).includes(x.uid)) : []);

/** A new piece into the bag (or worn at once). */
export function giveItem(g: GearState, id: string, wearIt = false): GearState {
  const it = { uid: newUid() + 'j', id, color: 0 };
  const next = { items: [...g.items, it], worn: { ...g.worn } };
  return wearIt ? wear(next, it.uid) : next;
}
/** Each job's set from its Master (pieces as they are drawn). */
export const JOB_SET: Record<string, string[]> = { warrior: ['warrior_job_sword', 'warrior_job_helmet', 'warrior_job_armor', 'warrior_job_boots'] };

/** Put a piece on (whatever its slot held goes back to the bag). */
export function wear(g: GearState, uid: string): GearState {
  const it = g.items.find((x) => x.uid === uid); if (!it) return g;
  const worn = { ...g.worn, [GEAR[it.id].slot]: uid };
  if (GEAR[it.id].overall) delete worn.bottom;                                    // an overall covers the legs too
  const top = g.items.find((x) => x.uid === g.worn.top);
  if (GEAR[it.id].slot === 'bottom' && top && GEAR[top.id]?.overall) delete worn.top;   // pants instead of the overall
  return { items: g.items, worn };
}
/** Take a slot's piece off into the bag. */
export function takeOff(g: GearState, s: GearSlot): GearState {
  const worn = { ...g.worn }; delete worn[s];
  return { items: g.items, worn };
}

/** Attack and defence of what is worn. */
export function gearStats(g: GearState | null | undefined): GearStats {
  let att = 0, def = 0;
  for (const s of GEAR_SLOTS) { const it = wornItem(g, s); if (it) { att += GEAR[it.id].att ?? 0; def += GEAR[it.id].def ?? 0; } }
  return { att, def, armed: !!wornItem(g, 'weapon') };
}
/** Damage dealt ×: the starter sword's attack is the measure (×1); bare hands hit weakly. */
export const attackMul = (st: GearStats): number => Math.max(G.unarmed, st.att / G.baseAtt);
/** Damage taken ×: each defence point takes off defPct %, up to defCap %. */
export const takenMul = (st: GearStats): number => 1 - Math.min(G.defCap, st.def * G.defPct) / 100;

/** What the worn pieces look like (colour index, −1 = not worn), for drawing the character. */
export interface WornLook { weapon: boolean; top: number; pants: number; shoes: number; sword?: string; helm?: string;
  /** an overall's armour (top + pants) / armoured boots */ suit?: string; boots?: string }
/** The armours, by network code (a1… / b1…). */
const ARMOR_CODES = ['warrior_job'];
/** The swords drawn in hand, by network code (w1 = the starter sword, w2… = these). */
const SWORD_CODES = ['warrior_job'];
/** The head pieces, by network code (h1…). */
const HELM_CODES = ['warrior_job'];
export function wornLook(g: GearState | null | undefined): WornLook {
  const col = (s: GearSlot) => wornItem(g, s)?.color ?? -1;
  const wp = wornItem(g, 'weapon'), sw = wp ? GEAR[wp.id]?.sword : undefined, hd = wornItem(g, 'head'), hm = hd ? GEAR[hd.id]?.helm : undefined;
  const tp = wornItem(g, 'top'), su = tp ? GEAR[tp.id]?.armor : undefined, sh = wornItem(g, 'shoes'), bo = sh ? GEAR[sh.id]?.armor : undefined;
  return { weapon: !!wp, top: su ? 0 : col('top'), pants: su ? 0 : col('bottom'), shoes: bo ? 0 : col('shoes'), ...(sw ? { sword: sw } : {}), ...(hm ? { helm: hm } : {}), ...(su ? { suit: su } : {}), ...(bo ? { boots: bo } : {}) };
}
/** Short text form for the network ("w1t0p2s-", '-' = not worn). */
export const wornCode = (w: WornLook): string => `w${w.weapon ? (w.sword && SWORD_CODES.includes(w.sword) ? 2 + SWORD_CODES.indexOf(w.sword) : 1) : 0}t${w.top < 0 ? '-' : w.top}p${w.pants < 0 ? '-' : w.pants}s${w.shoes < 0 ? '-' : w.shoes}${w.helm && HELM_CODES.includes(w.helm) ? `h${1 + HELM_CODES.indexOf(w.helm)}` : ''}${w.suit && ARMOR_CODES.includes(w.suit) ? `a${1 + ARMOR_CODES.indexOf(w.suit)}` : ''}${w.boots && ARMOR_CODES.includes(w.boots) ? `b${1 + ARMOR_CODES.indexOf(w.boots)}` : ''}`;
export function parseWornCode(s: unknown): WornLook | null {
  if (typeof s !== 'string') return null;
  const m = /^w([0-9])t([0-9-])p([0-9-])s([0-9-])(?:h([0-9]))?(?:a([0-9]))?(?:b([0-9]))?$/.exec(s); if (!m) return null;
  const n = (v: string) => (v === '-' ? -1 : Math.min(9, Number(v)));
  const wc = Number(m[1]), sw = wc >= 2 ? SWORD_CODES[wc - 2] : undefined;
  const hm = m[5] ? HELM_CODES[Number(m[5]) - 1] : undefined;
  const su = m[6] ? ARMOR_CODES[Number(m[6]) - 1] : undefined, bo = m[7] ? ARMOR_CODES[Number(m[7]) - 1] : undefined;
  return { weapon: wc >= 1, top: n(m[2]), pants: n(m[3]), shoes: n(m[4]), ...(sw ? { sword: sw } : {}), ...(hm ? { helm: hm } : {}), ...(su ? { suit: su } : {}), ...(bo ? { boots: bo } : {}) };
}
