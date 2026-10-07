// Open world (PvE): one long world, left to right — the area pictures of src/data/world-areas.json ("row") joined edge to
// edge into one strip by tools/world/strip.py (src/data/world-strip.json: the picture tiles, each area's x and span, the one
// walkable floor). Area data stays in area-picture px: world = local + the area's x.
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
  portal?: { x: number; y: number; to: string };
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
export const tileUrl = (i: number) => `assets/world/strip/${i}.jpg`;
/** The whole strip, small, for the minimap. */
export const MINIMAP_URL = 'assets/world/minimap/world.jpg';

export const areaOrigin = (id: string): { x: number; y: number } => ({ x: AREAS[id].x, y: 0 });
export const toWorld = (id: string, p: Pt | { x: number; y: number }): { x: number; y: number } => {
  const o = areaOrigin(id), x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
  return { x: x + o.x, y: y + o.y };
};
/** The area whose stretch of the strip holds world x. */
export const areaAt = (x: number): AreaDef => ROW.find((a) => x < a.span[1]) ?? ROW[ROW.length - 1];

const shift = (pts: readonly Pt[], ox: number): Pt[] => pts.map((p) => [p[0] + ox, p[1]] as Pt);
/** Every prop of the world in world coordinates (for WorldGeometry). */
export function worldObjects(): WorldObject[] {
  return ROW.flatMap((a) => a.props.map((p) => {
    const foot = shift(p.foot, a.x), occ = p.occ ? shift(p.occ, a.x) : [];
    return { id: `${a.id}:${p.id}`, footprint: foot, height: p.h, ...(p.top !== undefined ? { topZ: p.top } : {}), cover: 'hard' as const, occluder: occ, frontY: Math.max(...foot.map((q) => q[1])) + 1 };
  }));
}
