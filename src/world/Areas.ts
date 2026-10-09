// Open world (PvE): one long world, left to right — the area pictures of src/data/world-areas.json ("row") joined edge to
// edge into one strip by tools/world/strip.py (src/data/world-strip.json: the terrace's picture tiles, the far landscape
// behind it when there is one, each area's x and span, the one walkable floor, every prop). Area data stays in area-picture
// px: world = local + the area's x.
import DATA from '../data/world-areas.json';
import STRIP from '../data/world-strip.json';
import HEIGHTS_RAW_DATA from '../data/world-heights.json';
const HEIGHTS_RAW = HEIGHTS_RAW_DATA as unknown as { x: number; w: number; H: number; front: number }[];
import CLOUD_DATA from '../data/world-clouds.json';
import ARENA_DATA from '../data/world-arena.json';
import GATE_DATA from '../data/world-gate.json';
import TOWER_DATA from '../data/world-towers.json';
import HEIGHT_DATA from '../data/world-heights.json';
import { Pt, WorldObject } from './WorldGeometry';

export const AREA_W = DATA.size[0];
export const AREA_H = DATA.size[1];
export const WORLD_W = STRIP.w;
export const WORLD_H = STRIP.h;

export interface AreaNpc {
  id: string; name: string; title: string; x: number; y: number; art: string;
  /** Faces left (the art faces right). */
  flip?: boolean;
  /** A class Master: gives this job (and his trial) from level 10. */
  job?: string;
  /** Stands on a block of this height (drawn that much higher, in front of the block). */
  z?: number;
  /** quest: gives the quests whose `giver` is this NPC; talk: just its lines. */
  role: 'quest' | 'talk' | 'shop'; lines?: string[];
}
export interface QuestObjective { kind: 'kill' | 'talk' | 'collect' | 'level'; mob?: string; npc?: string; item?: string; level?: number; count?: number; text: string }
export interface QuestDef {
  id: string; giver: string; title: string; summary: string;
  /** What the giver says when offering it (last line: accept / decline), while it runs, and when you finish it. */
  offer: string[]; accept: string; decline: string; progress: string[]; done: string[]; complete: string;
  objectives: QuestObjective[];
  /** Offered only once this quest is done. */
  after?: string;
  reward?: { gold?: number; exp?: number; items?: Record<string, number> };
}
export interface AreaProp { id: string; foot: Pt[]; h: number; top?: number; occ?: Pt[] }
export interface AreaDef {
  id: string; name: string;
  /** Where the area's picture starts on the strip, and the stretch of the strip counted as this area (world px). */
  x: number; span: [number, number];
  walk: Pt[]; props: AreaProp[];
  npcs?: AreaNpc[];
  mobs?: { kind: string; spawns: Pt[] };
  /** A second kind in the same area (the Ruined Gate: its warden and the swordsmen round him). */
  mobs2?: { kind: string; spawns: Pt[] };
  /** Until its own map is painted: the painted map it is a copy of. */
  standin?: string;
  /** z: the height of what it stands on (the Temple's stairs, up on the stage's level). */
  portal?: { x: number; y: number; z?: number; to: string };
}
export interface MobKind {
  name: string; frames: string; tint?: number; scale: number; hp: number; damage: number; speed: number;
  aggro: number; range: number; cooldown: number; respawnMs: number;
  /** EXP for defeating it. */
  exp?: number;
  /** Its level (shown with its name). */
  level?: number;
  /** Its frames are drawn this many texture px per world px (its own art; the swordsman frames: 1). */
  texQ?: number;
  /** Its attack blows a soft gust forward (cloud creatures). */
  gust?: boolean;
  /** A boss: hits don't stop its swing. */
  boss?: boolean;
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

/** The Sun Seal Plaza: the boss ground below the Legacy Courtyard (tools/world/descent.py) — you walk down to it by the
 *  staircase in the courtyard's front arcade (x stairs[0]..stairs[1], from the floor's front edge edgeY), no portal. */
export const ARENA = ARENA_DATA as { name: string; x: number; y: number; w: number; h: number; ext: string; tiles: [number, number][]; edgeY: number; stairs: [number, number]; walk: Pt[] };
export const arenaTileKey = (i: number) => `world-arena-${i}`;
export const arenaTileUrl = (i: number) => `assets/world/arena/${i}.${ARENA.ext}`;
export const ARENA_MINIMAP_URL = 'assets/world/minimap/arena.jpg';
export const ARENA_AREA: AreaDef = { id: 'sealplaza', name: ARENA.name, x: ARENA.x, span: [ARENA.x, ARENA.x + ARENA.w], walk: [], props: [] };
/** Below the courtyard's front edge: on the stairs or in the plaza. */
export const belowTerrace = (y: number): boolean => y > ARENA.edgeY;

/** The Temple Gate between the Crimson Ruins and Temple Road (tools/world/gate.py): two picture layers (the back tower
 *  behind everyone, the arch and the front tower in front) and its two towers' footprints. */
/** Monsters never pass the Temple Gate: nothing of theirs crosses this world x (the line in front of the gate). */
export const MOB_WALL_X = (GATE_DATA as { wall?: number }).wall ?? 6330;
export const GATE = GATE_DATA as unknown as { q: number; back: { x: number; y: number; depth: number }; front: { x: number; y: number; depth: number }; props: { id: string; foot: Pt[]; h: number }[] };

/** The walkable floor of the whole world (world px, one polygon): the strip's, the stairs and the plaza. */
export const WORLD_FLOOR = ARENA.walk;
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
 *  tools/world/strip.py laid them out; id = "<area>-<prop>" / "<a>_<b>-<prop>" (= its occluder cut-out). A stone block
 *  takes only the ground under it (its base): the floor behind it is floor — someone there is hidden by the block up to
 *  its top edge (depth), and walks or jumps onto it from any side. */
/** Stone towers you climb by jumping from one to the next (src/data/world-towers.json, map px of their area): drawn by
 *  the game (not part of the strip's picture), solid from the floor to their flat top. */
export interface Tower { id: string; x0: number; x1: number; front: number; h: number; depth: number; /** the ground it stands on (a map above: its height) */ base: number; /** flush against the wall: solid back to this y */ solid?: number;
  /** A treasure on its top: this item, back every `every` s once taken (a reward for the climb). */ reward?: { item: string; every: number } }
const FOOT_R = 10, EDGE = 2;
export const TOWERS: Tower[] = Object.entries(TOWER_DATA as unknown as Record<string, { id: string; x: [number, number]; front: number; h: number; depth: number; base?: number; solid_to?: number; reward?: { item: string; every: number } }[]>)
  .filter(([a]) => AREAS[a]).flatMap(([a, list]) => list.map((t) => ({ id: `${a}-${t.id}`, x0: AREAS[a].x + t.x[0], x1: AREAS[a].x + t.x[1], front: t.front, h: t.h, depth: t.depth, base: t.base ?? 0, solid: t.solid_to, reward: t.reward })));
const towerProps = () => TOWERS.map((t) => {
  const s0 = t.front - t.depth, back = s0 - t.h + FOOT_R - EDGE;
  // its top face where no map above stands over it (their floor fills the depth in front of their wall): from just in front of it
  const over = HEIGHTS_RAW.find((h) => h.H > t.base && t.x1 > h.x && t.x0 < h.x + h.w && h.front > s0 && h.front < t.front - 8);
  return { id: t.id, foot: [[t.x0, back], [t.x1, back], [t.x1, t.front], [t.x0, t.front]] as Pt[], base: [[t.x0, t.solid ?? s0], [t.x1, t.solid ?? s0], [t.x1, t.front], [t.x0, t.front]] as Pt[],
    h: t.base + t.h, top: t.base + t.h, stand: [over ? Math.max(s0, over.front + 11) : s0, t.front - 3] as [number, number] };
});
/** Maps above the terrace (tools/world/heights.py): a whole floor H px up behind it, its picture standing behind the
 *  terrace's back balustrade (imgY: its top, world px), its blocks and monsters up there. */
export interface Heights {
  id: string; name: string; x: number; w: number; H: number; front: number; back: number; img: string; imgX?: number; imgY: number; imgH: number; depth: number; /** made of cloud: its own painted cubes, no stone */ cloud?: boolean;
  blocks: { id: string; x0: number; x1: number; front: number; h: number; depth: number; occ: { img: string; x: number; py: number } }[];
  mobs: { kind: string; spawns: Pt[] };
  /** A treasure waiting on its floor (back every `every` s once taken). */
  reward?: { x0: number; x1: number; item: string; every: number };
  /** Its boss (one, away from the rest). */
  boss?: { kind: string; spawns: Pt[] };
}
export const HEIGHTS = HEIGHT_DATA as unknown as Heights[];
/** The area shown while you are up on a map above (its name, its stretch). */
export const heightArea = (h: Heights): AreaDef => ({ id: h.id, name: h.name, x: h.x, span: [h.x, h.x + h.w], walk: [], props: [] });
const heightProps = () => HEIGHTS.flatMap((h) => [
  { id: h.id, foot: [[h.x, h.back], [h.x + h.w, h.back], [h.x + h.w, h.front], [h.x, h.front]] as Pt[], base: [[h.x, h.back], [h.x + h.w, h.back], [h.x + h.w, h.front], [h.x, h.front]] as Pt[],
    h: h.H, top: h.H, stand: [h.back + 4, h.front - 3] as [number, number] },
  ...h.blocks.map((b) => {
    const s0 = b.front - b.depth, back = s0 - b.h + FOOT_R - EDGE;
    return { id: `${h.id}-${b.id}`, foot: [[b.x0, back], [b.x1, back], [b.x1, b.front], [b.x0, b.front]] as Pt[], base: [[b.x0, s0], [b.x1, s0], [b.x1, b.front], [b.x0, b.front]] as Pt[],
      h: h.H + b.h, top: h.H + b.h, stand: [s0, b.front - 3] as [number, number] };
  }),
]);
/** The Sky Path (tools/world/clouds.py): cloud platforms on from Ivy Summit, each at its own height along one lane. */
export interface SkyCloud { x0: number; x1: number; z: number; s: number; reward?: { item: string; every: number } }
export const SKY = CLOUD_DATA as unknown as { name: string; band: [number, number]; lane: [number, number]; sprites: { img: string; w: number; h: number; top: [number, number] }[]; path: { x: [number, number]; z: number; s: number; reward?: { item: string; every: number } }[] };
export const CLOUDS: SkyCloud[] = SKY.path.map((c) => ({ x0: c.x[0], x1: c.x[1], z: c.z, s: c.s, reward: c.reward }));
/** The Sky Path as an area (its name shows while you are up there). */
export const SKY_AREA: AreaDef = { id: 'sky_path', name: SKY.name, x: SKY.lane[0], span: [SKY.lane[0], SKY.lane[1]], walk: [], props: [] };
/** Falling between the clouds: below this height you drop through to the floor under the lane. */
export const SKY_DROP = Math.min(...SKY.path.map((c) => c.z)) - 60;
const cloudProps = () => CLOUDS.map((c, i) => ({ id: `sky-${i}`, foot: [[c.x0, SKY.band[0]], [c.x1, SKY.band[0]], [c.x1, SKY.band[1]], [c.x0, SKY.band[1]]] as Pt[],
  base: [[c.x0, SKY.band[0]], [c.x1, SKY.band[0]], [c.x1, SKY.band[1]], [c.x0, SKY.band[1]]] as Pt[], h: c.z, top: c.z, soft: true, stand: [SKY.band[0], SKY.band[1]] as [number, number] }));
export function worldObjects(): WorldObject[] {
  return ([...STRIP.props, ...GATE.props, ...towerProps(), ...heightProps(), ...cloudProps()] as { id: string; foot: Pt[]; base?: Pt[]; h: number; top?: number; soft?: boolean; stand?: [number, number] }[]).map((p) => ({
    id: p.id, footprint: p.stand && p.base ? p.base : p.foot, height: p.h, ...(p.top !== undefined ? { topZ: p.top } : {}), ...(p.stand ? { stand: p.stand } : {}),
    ...(p.base ? { base: p.base } : {}), ...(p.soft ? { soft: true } : {}),
    cover: 'hard' as const, occluder: [], frontY: Math.max(...p.foot.map((q) => q[1])) + 1,
  }));
}
