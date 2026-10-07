// Open world (PvE): one long world, left to right — the area pictures of src/data/world-areas.json ("row") joined edge to
// edge into one strip by tools/world/strip.py (src/data/world-strip.json: the terrace's picture tiles, the far landscape
// behind it when there is one, each area's x and span, the one walkable floor, every prop). Area data stays in area-picture
// px: world = local + the area's x.
import DATA from '../data/world-areas.json';
import STRIP from '../data/world-strip.json';
import { Pt, WorldObject } from './WorldGeometry';

export const AREA_W = DATA.size[0];
export const AREA_H = DATA.size[1];
export const WORLD_W = STRIP.w;
export const WORLD_H = STRIP.h;

export interface AreaNpc {
  id: string; name: string; title: string; x: number; y: number; art: string;
  /** quest: gives the quests whose `giver` is this NPC; talk: just its lines. */
  role: 'quest' | 'talk'; lines?: string[];
}
export interface QuestObjective { kind: 'kill' | 'talk'; mob?: string; npc?: string; count?: number; text: string }
export interface QuestDef {
  id: string; giver: string; title: string; summary: string;
  /** What the giver says when offering it (last line: accept / decline), while it runs, and when you finish it. */
  offer: string[]; accept: string; decline: string; progress: string[]; done: string[]; complete: string;
  objectives: QuestObjective[];
}
export interface AreaProp { id: string; foot: Pt[]; h: number; top?: number; occ?: Pt[] }
export interface AreaDef {
  id: string; name: string;
  /** Where the area's picture starts on the strip, and the stretch of the strip counted as this area (world px). */
  x: number; span: [number, number];
  walk: Pt[]; props: AreaProp[];
  npcs?: AreaNpc[];
  mobs?: { kind: string; spawns: Pt[] };
  /** z: the height of what it stands on (the Temple's stairs, up on the stage's level). */
  portal?: { x: number; y: number; z?: number; to: string };
}
export interface MobKind {
  name: string; frames: string; tint?: number; scale: number; hp: number; damage: number; speed: number;
  aggro: number; range: number; cooldown: number; respawnMs: number;
  /** EXP for defeating it. */
  exp?: number;
}

type RawArea = Omit<AreaDef, 'id' | 'x' | 'span'>;
const RAW = DATA.areas as unknown as Record<string, RawArea>;
const LAY = STRIP.areas as unknown as Record<string, { x: number; span: [number, number] }>;
/** The areas, left to right. */
export const ROW: AreaDef[] = (DATA.row as string[]).map((id) => ({ id, ...RAW[id], ...LAY[id] }));
export const AREAS: Record<string, AreaDef> = Object.fromEntries(ROW.map((a) => [a.id, a]));
export const START = DATA.start as { area: string; x: number; y: number };
export const MOB_KINDS = DATA.mobKinds as unknown as Record<string, MobKind>;
export const QUESTS = DATA.quests as unknown as QuestDef[];
/** What a quest giver says once all his quests are done. */
export const IDLE_LINES = DATA.idle as string[];

/** The walkable floor of the whole world (world px, one polygon). */
export const WORLD_FLOOR = STRIP.walk as Pt[];
/** The strip's picture tiles: [x, width] each (they overlap by 2 px). */
export const TILES = STRIP.tiles as [number, number][];
export const tileKey = (i: number) => `world-tile-${i}`;
const TILE_EXT = (STRIP as { ext?: string }).ext ?? 'jpg';
export const tileUrl = (i: number) => `assets/world/strip/${i}.${TILE_EXT}`;
/** The far landscape behind the terrace (it scrolls slower: depth) — null while the maps are whole (their own sky). */
export const BACKDROP = ((STRIP as unknown as { bg?: { w: number; tiles: [number, number][]; ext?: string; sky?: number } }).bg) ?? null;
export const bgKey = (i: number) => `world-bg-${i}`;
export const bgUrl = (i: number) => `assets/world/bg/${i}.${BACKDROP?.ext ?? 'jpg'}`;
/** The landscape's sky alone (stored BACKDROP.sky times smaller): the clouds drift between it and the landscape. */
export const BG_SKY_URL = 'assets/world/bg/sky.jpg';
/** The whole strip, small, for the minimap. */
export const MINIMAP_URL = 'assets/world/minimap/world.jpg';

export const areaOrigin = (id: string): { x: number; y: number } => ({ x: AREAS[id].x, y: 0 });
export const toWorld = (id: string, p: Pt | { x: number; y: number }): { x: number; y: number } => {
  const o = areaOrigin(id), x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
  return { x: x + o.x, y: y + o.y };
};
/** The area whose stretch of the strip holds world x. */
export const areaAt = (x: number): AreaDef => ROW.find((a) => x < a.span[1]) ?? ROW[ROW.length - 1];

/** Every prop of the world — the maps' and the joins' (and blocks standing in the middle of a floor) — in world px, as
 *  tools/world/strip.py laid them out; id = "<area>-<prop>" / "<a>_<b>-<prop>" (= its occluder cut-out). */
export function worldObjects(): WorldObject[] {
  return (STRIP.props as { id: string; foot: Pt[]; h: number; top?: number; stand?: [number, number] }[]).map((p) => ({
    id: p.id, footprint: p.foot, height: p.h, ...(p.top !== undefined ? { topZ: p.top } : {}), ...(p.stand ? { stand: p.stand } : {}),
    cover: 'hard' as const, occluder: [], frontY: Math.max(...p.foot.map((q) => q[1])) + 1,
  }));
}
