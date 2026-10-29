// God of Legacy Studio — the profile: everything the Studio edits, as one JSON document (Save / Load). Camera, movement,
// character and the map with depth. Every default is the game's own value (src/combat/Combat.ts PHYS, the open world's
// camera), so an untouched profile plays like the game.
import type { Pt } from '../../world/WorldGeometry';
import { ARENA_VIEW } from '../../world/WorldGeometry';
import { STAGES } from '../../world/Stages';

export const STUDIO_APP = 'god-of-legacy-studio';
export const STUDIO_VERSION = 1;

export interface CameraSettings {
  /** Screen px per world px (1: the world as drawn). */
  zoom: number;
  /** Follow the character left / right, up / down. */
  followX: boolean; followY: boolean;
  /** Where the camera looks, from the character's feet (world px; − = above). */
  offsetX: number; offsetY: number;
  /** The view leads this far ahead of the facing side (px), turning over lookMs. */
  lookAhead: number; lookMs: number;
  /** A box round the view's middle where the character moves without the camera (world px). */
  deadW: number; deadH: number;
  /** Distance: the farthest the character may be from the view's middle before the camera is pulled with it (px). */
  leash: number;
  /** Smoothing: the time the camera takes to catch up, sideways and up / down (ms; 0 = locked on). */
  smoothX: number; smoothY: number;
  /** The camera's top speed (world px / s). */
  maxSpeed: number;
  /** Zoom changes ease over this long (ms). */
  zoomMs: number;
  /** How much the view rises with the ground the character stands on, and with a jump (0..1). */
  heightFollow: number; jumpFollow: number;
  /** Dynamic zoom: drawn back this share at a full run, and this share up high (per 300 px of height). */
  runZoomOut: number; heightZoomOut: number;
  /** The view never shows past the map's edges. */
  bounds: boolean;
}

export interface MovementSettings {
  /** Walk and run speed (px / s); up / down (depth) speed as a share of them; depth movement on / off. */
  walk: number; run: number; depth: number; allowDepth: boolean;
  /** Acceleration, braking, the turn's extra grip, steering in the air, speed kept on take-off. */
  accel: number; decel: number; turn: number; air: number; keep: number;
  /** Jump strength (px / s up), gravity (px / s²), extra jumps in the air and their strength. */
  jumpVz: number; gravity: number; airJumps: number; airJumpVz: number;
  /** The feet's radius (collisions), the ledge help (a lip this high is climbed at the end of a jump), the landing pause. */
  footR: number; mantle: number; landMs: number;
  /** Collisions: with the map's objects (off: walk through them, still land on top), with the floor's edges. */
  collideProps: boolean; collideWalls: boolean;
}

export type HeroCls = 'warrior' | 'samurai' | 'archer' | 'book_mage' | 'gambler';
/** layered: the MapleStory-style base character, its look and clothes as layers; beginner: the painted Beginner; hero:
 *  a painted ready hero. */
export type CharKind = 'layered' | 'beginner' | 'hero';
export interface LookSettings { hair: number; hairColor: number; skin: number; face: number; eyeColor: number }
export interface GearSettings { weapon: boolean; sword: string; helm: string; top: number; pants: number; shoes: number; suit: string; boots: string }
export interface LayerToggles { body: boolean; hair: boolean; face: boolean; helm: boolean; top: boolean; pants: boolean; shoes: boolean; weapon: boolean; shadow: boolean; ring: boolean; name: boolean }
export type AnimMode = 'live' | 'idle' | 'alert' | 'walk' | 'run' | 'jump' | 'land' | 'attack' | 'skill' | 'hurt' | 'stunned' | 'launched' | 'down' | 'getup' | 'win' | 'intro' | 'runstop';
export const ANIM_MODES: AnimMode[] = ['live', 'idle', 'alert', 'walk', 'run', 'jump', 'land', 'attack', 'skill', 'hurt', 'stunned', 'launched', 'down', 'getup', 'win', 'intro', 'runstop'];
export interface AnimSettings {
  /** live: the animation follows the movement; any other: that animation is shown in a loop. */
  mode: AnimMode;
  /** The skill shown (mode skill) and the chain's step (mode attack). */
  skill: string; stage: number;
  /** Animation speed (× real time), paused, and the shown moment when paused (0..1 of the animation). */
  speed: number; paused: boolean; time: number;
}
export interface CharacterSettings {
  kind: CharKind; cls: HeroCls; gender: 'male' | 'female'; name: string;
  look: LookSettings; gear: GearSettings; layers: LayerToggles;
  /** Size (× the drawn size) and the smallest the character may look on screen (px tall): it is never drawn smaller. */
  scale: number; minScreenPx: number;
  facing: 'right' | 'left';
  /** Depth perspective: smaller at the floor's back edge, bigger at its front (× size). */
  perspective: boolean; backScale: number; frontScale: number;
  anim: AnimSettings;
}

export type ObjKind = 'level' | 'platform' | 'oneway' | 'ramp' | 'prop';
export interface StudioObject {
  id: string; name: string; kind: ObjKind;
  /** Box kinds: the footprint on the floor [x, x + w] × [y, y + d] (y = depth: + toward the front) and the top's height z. */
  x: number; y: number; w: number; d: number; z: number;
  /** Ramp: its top rises along `axis` from z0 (left / back) to z1 (right / front). */
  axis: 'x' | 'y'; z0: number; z1: number;
  /** An existing map's prop (imported): its footprint, the painting's outline of it (it hides who stands behind), its
   *  height (blocks below it), a top to stand on (or none), one-way. */
  poly?: Pt[]; occ?: Pt[]; h?: number; top?: number | null; soft?: boolean;
  hidden?: boolean;
}
export interface BackdropSettings {
  /** sky: the Studio's own sky over a drawn floor; stage: an existing map's painting. */
  kind: 'sky' | 'stage'; stage: string; opacity: number;
}
export interface StudioMap {
  name: string;
  /** The map's size (world px): the camera keeps inside it. */
  w: number; h: number;
  /** The walkable floor (ground level, z 0): a polygon on the floor plane. */
  floor: Pt[];
  objects: StudioObject[];
  spawn: { x: number; y: number };
  backdrop: BackdropSettings;
  /** The editor's grid (px) and snapping to it. */
  grid: number; snap: boolean;
}
export interface StudioProfile {
  app: string; version: number; name: string; savedAt: string;
  camera: CameraSettings; movement: MovementSettings; character: CharacterSettings; map: StudioMap;
}

// ------------------------------------------------------------------ defaults (the game's own values)

export const DEFAULT_CAMERA: CameraSettings = {
  zoom: 1, followX: true, followY: true, offsetX: 0, offsetY: -70, lookAhead: 60, lookMs: 450, deadW: 60, deadH: 40,
  leash: 380, smoothX: 130, smoothY: 160, maxSpeed: 3000, zoomMs: 300, heightFollow: 0.85, jumpFollow: 0,
  runZoomOut: 0, heightZoomOut: 0.18, bounds: true,
};

export const DEFAULT_MOVEMENT: MovementSettings = {
  walk: 122, run: 270, depth: 1, allowDepth: true, accel: 1500, decel: 1900, turn: 1.15, air: 0.55, keep: 0.92,
  jumpVz: 445, gravity: 1100, airJumps: 0, airJumpVz: 400, footR: 10, mantle: 16, landMs: 90, collideProps: true, collideWalls: true,
};

export const DEFAULT_CHARACTER: CharacterSettings = {
  kind: 'layered', cls: 'warrior', gender: 'male', name: 'Hero',
  look: { hair: 0, hairColor: 0, skin: 1, face: 0, eyeColor: 0 }, // (skin 1: the tone the art is drawn in)
  gear: { weapon: true, sword: '', helm: '', top: 0, pants: 0, shoes: 0, suit: '', boots: '' },
  layers: { body: true, hair: true, face: true, helm: true, top: true, pants: true, shoes: true, weapon: true, shadow: true, ring: false, name: true },
  scale: 1, minScreenPx: 96, facing: 'right', perspective: false, backScale: 0.92, frontScale: 1.06,
  anim: { mode: 'live', skill: '', stage: 0, speed: 1, paused: false, time: 0 },
};

const box = (id: string, name: string, kind: ObjKind, x: number, y: number, w: number, d: number, z: number): StudioObject =>
  ({ id, name, kind, x, y, w, d, z, axis: 'x', z0: 0, z1: z });

/** The Studio's own first map: a floor with depth, a terrace up a ramp, blocks to jump on, a cloud. */
export function defaultMap(): StudioMap {
  return {
    name: 'כיכר הסטודיו', w: 2800, h: 1200,
    floor: [[80, 640], [2720, 640], [2720, 1080], [80, 1080]],
    objects: [
      box('o1', 'מרפסת', 'level', 1700, 640, 940, 170, 150),
      { ...box('o2', 'רמפה', 'ramp', 1420, 660, 280, 130, 150), axis: 'x', z0: 0, z1: 150 },
      box('o3', 'ארגז', 'platform', 520, 860, 130, 90, 70),
      box('o4', 'עמוד', 'platform', 760, 800, 110, 80, 140),
      box('o5', 'ענן', 'oneway', 960, 760, 260, 70, 215),
      box('o6', 'מדרגה נמוכה', 'platform', 1100, 920, 300, 120, 40),
    ],
    spawn: { x: 300, y: 860 },
    backdrop: { kind: 'sky', stage: 'courtyard', opacity: 1 },
    grid: 20, snap: true,
  };
}

export function defaultProfile(): StudioProfile {
  return {
    app: STUDIO_APP, version: STUDIO_VERSION, name: 'ההגדרות שלי', savedAt: '',
    camera: { ...DEFAULT_CAMERA }, movement: { ...DEFAULT_MOVEMENT },
    character: JSON.parse(JSON.stringify(DEFAULT_CHARACTER)) as CharacterSettings, map: defaultMap(),
  };
}

/** Camera presets (one click): close MapleStory framing, the wide DFO arena, a slow cinematic follow. */
export const CAMERA_PRESETS: { id: string; label: string; set: Partial<CameraSettings> }[] = [
  { id: 'maple', label: 'קרוב (מייפל)', set: { zoom: 1.25, offsetY: -80, lookAhead: 70, deadW: 40, deadH: 30, smoothX: 110, smoothY: 140, leash: 300, runZoomOut: 0, heightZoomOut: 0.12, jumpFollow: 0 } },
  { id: 'dfo', label: 'רחב (DFO)', set: { zoom: 0.85, offsetY: -40, lookAhead: 120, deadW: 120, deadH: 60, smoothX: 160, smoothY: 220, leash: 420, runZoomOut: 0.06, heightZoomOut: 0.2, jumpFollow: 0.1 } },
  { id: 'cine', label: 'קולנועי', set: { zoom: 1.05, offsetY: -90, lookAhead: 160, lookMs: 900, deadW: 30, deadH: 30, smoothX: 420, smoothY: 520, maxSpeed: 1400, zoomMs: 900, runZoomOut: 0.12, heightZoomOut: 0.22, jumpFollow: 0.3 } },
];

// ------------------------------------------------------------------ existing maps (the PvP stages)

/** An existing map (a PvP stage) as a Studio map: its painting, floor and props, at the size the arena shows it. */
export function stageMap(stageId: string): StudioMap | null {
  const st = STAGES.find((s) => s.id === stageId);
  if (!st) return null;
  const s = ARENA_VIEW.scale, P = (p: readonly number[]): Pt => [Math.round(p[0] * s), Math.round(p[1] * s)];
  const objects: StudioObject[] = st.geo.props.map((o, i) => {
    const xs = o.footprint.map((p) => p[0] * s), ys = o.footprint.map((p) => p[1] * s);
    const x = Math.min(...xs), y = Math.min(...ys);
    return {
      id: `p${i + 1}`, name: o.id, kind: 'prop', x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(...xs) - x), d: Math.round(Math.max(...ys) - y),
      z: Math.round((o.topZ ?? 0) * s), axis: 'x', z0: 0, z1: 0,
      poly: o.footprint.map(P), occ: o.occluder.map(P), h: Math.round(o.height * s), top: o.topZ === undefined ? null : Math.round(o.topZ * s), soft: !!o.soft,
    };
  });
  return {
    name: st.name, w: Math.round(1672 * s), h: Math.round(941 * s),
    floor: st.geo.floor.map(P), objects,
    spawn: { x: Math.round(st.geo.centre[0] * s), y: Math.round(st.geo.centre[1] * s) },
    backdrop: { kind: 'stage', stage: st.id, opacity: 1 }, grid: 20, snap: true,
  };
}
export const STAGE_CHOICES = STAGES.map((s) => ({ id: s.id, name: s.name, file: s.file, key: s.key }));

// ------------------------------------------------------------------ loading (a saved or imported profile, made safe)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number, lo = -1e6, hi = 1e6): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const pts = (v: unknown): Pt[] | null => (Array.isArray(v) && v.length >= 3 && v.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) ? (v as number[][]).map((p) => [p[0], p[1]] as Pt) : null);

/** Fills `def`'s shape from `raw` (same keys, same types; numbers kept finite). */
function merge<T>(def: T, raw: unknown): T {
  if (!isObj(def as unknown) || !isObj(raw)) return def;
  const out = { ...(def as Record<string, unknown>) };
  for (const k of Object.keys(out)) {
    const d = out[k], r = raw[k];
    if (r === undefined) continue;
    if (typeof d === 'number') out[k] = num(r, d);
    else if (typeof d === 'boolean') out[k] = typeof r === 'boolean' ? r : d;
    else if (typeof d === 'string') out[k] = typeof r === 'string' ? r : d;
    else if (isObj(d)) out[k] = merge(d, r);
  }
  return out as T;
}

function cleanObject(raw: unknown, i: number): StudioObject | null {
  if (!isObj(raw)) return null;
  const kind = (['level', 'platform', 'oneway', 'ramp', 'prop'] as ObjKind[]).includes(raw.kind as ObjKind) ? raw.kind as ObjKind : 'platform';
  const o: StudioObject = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `o${i + 1}`, name: typeof raw.name === 'string' ? raw.name : `Object ${i + 1}`, kind,
    x: num(raw.x, 0), y: num(raw.y, 0), w: num(raw.w, 100, 4), d: num(raw.d, 60, 4), z: num(raw.z, 60, 0, 5000),
    axis: raw.axis === 'y' ? 'y' : 'x', z0: num(raw.z0, 0, 0, 5000), z1: num(raw.z1, 100, 0, 5000), hidden: raw.hidden === true,
  };
  if (kind === 'prop') {
    const poly = pts(raw.poly); if (!poly) return null;
    o.poly = poly; o.occ = pts(raw.occ) ?? undefined; o.h = num(raw.h, 60, 0, 5000);
    o.top = typeof raw.top === 'number' && Number.isFinite(raw.top) ? raw.top : null; o.soft = raw.soft === true;
  }
  return o;
}

/** A profile from anything (a saved draft, an imported file): unknown keys dropped, missing ones from the defaults. */
export function sanitizeProfile(raw: unknown): StudioProfile {
  const d = defaultProfile();
  if (!isObj(raw)) return d;
  const p: StudioProfile = {
    app: STUDIO_APP, version: STUDIO_VERSION, name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 80) : d.name,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
    camera: merge(d.camera, raw.camera), movement: merge(d.movement, raw.movement), character: merge(d.character, raw.character), map: d.map,
  };
  if (isObj(raw.map)) {
    const m = raw.map, floor = pts(m.floor);
    p.map = {
      ...merge({ ...d.map, objects: [], floor: [] }, m),
      floor: floor ?? d.map.floor,
      objects: Array.isArray(m.objects) ? m.objects.map(cleanObject).filter((o): o is StudioObject => !!o) : [],
      spawn: isObj(m.spawn) ? { x: num(m.spawn.x, d.map.spawn.x), y: num(m.spawn.y, d.map.spawn.y) } : { ...d.map.spawn },
    };
  }
  const c = p.character;
  if (!ANIM_MODES.includes(c.anim.mode)) c.anim.mode = 'live';
  if (p.map.backdrop.kind !== 'stage') p.map.backdrop.kind = 'sky';
  if (!['layered', 'beginner', 'hero'].includes(c.kind)) c.kind = 'layered';
  if (!['warrior', 'samurai', 'archer', 'book_mage', 'gambler'].includes(c.cls)) c.cls = 'warrior';
  if (c.gender !== 'female') c.gender = 'male';
  if (c.facing !== 'left') c.facing = 'right';
  return p;
}

/** A fresh unique object id in this map. */
export function newObjectId(m: StudioMap): string {
  let n = m.objects.length + 1;
  while (m.objects.some((o) => o.id === `o${n}`)) n++;
  return `o${n}`;
}
