// Open world (PvE): areas laid side by side on a grid of map-sized cells. The player walks from one to the next through
// the paths that leave each picture (exits); the camera glides over to the next area. Data: src/data/world-areas.json
// (area-local picture px; world = local + the area's cell × map size).
import DATA from '../data/world-areas.json';
import { Pt, WorldObject, pointInPoly } from './WorldGeometry';

export const AREA_W = DATA.size[0];
export const AREA_H = DATA.size[1];

export type ExitDir = 'left' | 'right' | 'up' | 'down';
export interface AreaExit {
  to: string; dir: ExitDir;
  /** Walking into this zone (moving outward) leaves the area. */
  zone: Pt[];
  /** Where the path leaves the picture (edge) or the doorway it enters (inner). */
  door: Pt;
  /** Where you stand after coming in through this exit. */
  entry: Pt;
  /** A doorway inside the picture (not at its edge): you fade out / in there. */
  inner?: boolean;
}
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
  id: string; name: string; cell: [number, number];
  walk: Pt[]; props: AreaProp[]; exits: AreaExit[];
  npcs?: AreaNpc[];
  mobs?: { kind: string; spawns: Pt[] };
  portal?: { x: number; y: number; to: string };
  /** Drifting cloud shadows on the floor below this line (omit = none). */
  groundTop?: number;
}
export interface MobKind {
  name: string; frames: string; tint?: number; scale: number; hp: number; damage: number; speed: number;
  aggro: number; range: number; cooldown: number; respawnMs: number;
}

const RAW = DATA.areas as unknown as Record<string, Omit<AreaDef, 'id'>>;
export const AREAS: Record<string, AreaDef> = Object.fromEntries(Object.entries(RAW).map(([id, a]) => [id, { id, ...a }]));
export const START = DATA.start as { area: string; x: number; y: number };
export const MOB_KINDS = DATA.mobKinds as unknown as Record<string, MobKind>;
export const QUESTS = DATA.quests as unknown as QuestDef[];
/** What a quest giver says once all his quests are done. */
export const IDLE_LINES = DATA.idle as string[];

export const areaOrigin = (id: string): { x: number; y: number } => { const c = AREAS[id].cell; return { x: c[0] * AREA_W, y: c[1] * AREA_H }; };
export const areaTexKey = (id: string) => `area-${id}`;
export const areaTexUrl = (id: string) => `assets/world/areas/${id}.jpg`;
/** Areas one exit away (loaded ahead so walking on never waits). */
export const neighbours = (id: string): string[] => [...new Set([...AREAS[id].exits.map((e) => e.to), ...(AREAS[id].portal ? [AREAS[id].portal!.to] : [])])];

const shift = (pts: readonly Pt[], o: { x: number; y: number }): Pt[] => pts.map((p) => [p[0] + o.x, p[1] + o.y] as Pt);
export const toWorld = (id: string, p: Pt | { x: number; y: number }): { x: number; y: number } => {
  const o = areaOrigin(id), x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y;
  return { x: x + o.x, y: y + o.y };
};

/** The floor and props of an area in world coordinates (for WorldGeometry). */
export function areaGeometry(id: string): { walk: Pt[]; objects: WorldObject[] } {
  const a = AREAS[id], o = areaOrigin(id);
  const objects: WorldObject[] = a.props.map((p) => {
    const foot = shift(p.foot, o), occ = p.occ ? shift(p.occ, o) : [];
    return { id: `${id}:${p.id}`, footprint: foot, height: p.h, ...(p.top !== undefined ? { topZ: p.top } : {}), cover: 'hard', occluder: occ, frontY: Math.max(...foot.map((q) => q[1])) + 1 };
  });
  return { walk: shift(a.walk, o), objects };
}

const OUT: Record<ExitDir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
/** The exit the player at world (x, y), moving (vx, vy), is walking out through — or null. */
export function exitAt(id: string, x: number, y: number, vx: number, vy: number): AreaExit | null {
  const o = areaOrigin(id), lx = x - o.x, ly = y - o.y;
  for (const e of AREAS[id].exits) {
    const d = OUT[e.dir];
    if (vx * d[0] + vy * d[1] < 25) continue; // only while walking outward
    if (pointInPoly(lx, ly, e.zone)) return e;
  }
  return null;
}
/** The exit of `to` that leads back to `from` (where you come in). */
export const backExit = (from: string, to: string): AreaExit | undefined => AREAS[to].exits.find((e) => e.to === from);
