// The Waystones: standing stones with a sun rune, one in each town and one by the Temple Road's gate. Touch one and
// name another, and it carries you there — the way between the class towns (each region lies walled off along the
// world; the Masters at the Temple send you to your town through the stone). Free: a town is never far from home.
import { AREAS, type AreaNpc } from './Areas';

export interface WaystoneDef {
  /** The area it stands in (its NPC: `waystone_<area>`, role waystone). */
  area: string;
  /** The name it goes by on the stone's menu. */
  name: string;
  /** Who it is for (the class whose town it is; nothing: everyone's). */
  town?: 'archer' | 'samurai' | 'warrior' | 'book_mage' | 'gambler';
  /** Where you arrive, next to the stone (map px). */
  x: number; y: number;
}

export const WAYSTONES: WaystoneDef[] = [
  { area: 'temple', name: 'Temple Road', x: 1472, y: 560 },
  { area: 'dusk_village', name: 'Elderwood Village', town: 'archer', x: 560, y: 540 },
  { area: 'sakura_village', name: 'Sakura Temple', town: 'samurai', x: 540, y: 560 },
  { area: 'ironhold_village', name: 'Ironhold', town: 'warrior', x: 540, y: 530 },
];

/** The class towns by job: where its Master sends a new student. */
export const TOWN_OF: Record<string, WaystoneDef | undefined> = Object.fromEntries(WAYSTONES.filter((w) => w.town).map((w) => [w.town!, w]));

/** The stone this NPC is (by its area), if it is one. */
export function waystoneOf(n: AreaNpc): WaystoneDef | undefined {
  const id = n.id.replace(/^waystone_/, '');
  return WAYSTONES.find((w) => w.area === id);
}

/** The other stones, in the world's order, that exist (an area still unbuilt is left off the menu). */
export function waystoneTargets(from: WaystoneDef): WaystoneDef[] {
  return WAYSTONES.filter((w) => w !== from && AREAS[w.area]);
}
