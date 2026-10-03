// Character body art for all 4 classes, one API: pose queries → texture frame + feet origin + scale (+ aligned weapon
// mask frame for weapon cosmetics + per-frame attachment anchors).
// Warrior / Book Mage: supplied final 352px sheets (idle 6, walk 6, run 8, jump 8, air_attack 6, hurt 4, recovery 4,
// death 8) + final per-skill bodies (6 / 10 / 12 columns), rows down/right/left/up, feet at (176, 310).
// Archer / Samurai: the repository's explicit-rect class atlas (clean base sheets) with per-skill pose sequences.
import Phaser from 'phaser';
import ARCHER from '../data/archer-atlas.json';
import SAMURAI from '../data/samurai-atlas.json';
import ANCHORS from '../data/body-anchors.json';
import { Dir } from '../world/collision';
import { FINAL_SKILLS } from '../skills/FinalKit';

export type ClassKey = 'warrior' | 'book_mage' | 'archer' | 'samurai';
export const DIRS: Dir[] = ['down', 'right', 'left', 'up'];
const ROW: Record<Dir, number> = { down: 0, right: 1, left: 2, up: 3 };
const CELL = 352, ORIGIN_Y = 310 / 352, SHEET_SCALE = 108 / 172;

type MoveState = 'idle' | 'walk' | 'run' | 'jump' | 'air_attack' | 'hurt' | 'recovery' | 'death';
const MOVE_COLS: Record<MoveState, number> = { idle: 6, walk: 8, run: 8, jump: 8, air_attack: 6, hurt: 4, recovery: 4, death: 8 };
const SHEET_CLASSES = ['warrior', 'book_mage'] as const;
const sheetKey = (cls: string, st: string) => `body-${cls}-${st}`;
const skillKey = (cls: string, id: string) => `sbody-${cls}-${id}`;
const sheetPath = (cls: string, st: string) => `assets/final/body/${cls}/movement/${st}.png`;
const skillPath = (cls: string, id: string) => `assets/final/skills/${cls}/${id}/body.png`;

// ---- atlas classes
type AtlasAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'death';
type Rect = { x: number; y: number; w: number; h: number; ax: number; ay: number };
interface AtlasData { sheet: string; directions: Record<Dir, Record<AtlasAction, Rect[]>>; scaleByDirection: Record<Dir, number> }
const ATLAS: Record<string, AtlasData> = { archer: ARCHER as unknown as AtlasData, samurai: SAMURAI as unknown as AtlasData };
const atlasKey = (cls: string) => `class-${cls}`;
const atlasFrame = (dir: Dir, a: AtlasAction, i: number) => `${dir}-${a}-${i}`;
/** Archer down/right jump frame 1 overlaps neighbouring figures on the sheet: the airborne frame 0 is held instead. */
const JUMP_FALL: Record<string, Partial<Record<Dir, number>>> = { archer: { down: 0, right: 0 } };

export const isSheetClass = (cls: string): boolean => (SHEET_CLASSES as readonly string[]).includes(cls);

export function preloadBodies(scene: Phaser.Scene): void {
  const L = (k: string, p: string, sheet: boolean) => {
    if (scene.textures.exists(k)) return;
    if (sheet) scene.load.spritesheet(k, p, { frameWidth: CELL, frameHeight: CELL }); else scene.load.image(k, p);
  };
  for (const cls of SHEET_CLASSES) {
    for (const st of Object.keys(MOVE_COLS)) { L(sheetKey(cls, st), sheetPath(cls, st), true); L(`${sheetKey(cls, st)}-w`, sheetPath(cls, st).replace('.png', '_weapon.png'), true); }
    for (const s of FINAL_SKILLS.filter((x) => x.cls === cls)) { L(skillKey(cls, s.id), skillPath(cls, s.id), true); L(`${skillKey(cls, s.id)}-w`, skillPath(cls, s.id).replace('.png', '_weapon.png'), true); }
  }
  for (const [cls, a] of Object.entries(ATLAS)) { L(atlasKey(cls), a.sheet, false); L(`${atlasKey(cls)}-w`, a.sheet.replace('.png', '_weapon.png'), false); }
}

/** Explicit atlas rectangles registered once as named frames (body + weapon-mask textures share frame names). */
export function registerBodies(scene: Phaser.Scene): void {
  for (const [cls, a] of Object.entries(ATLAS)) {
    for (const key of [atlasKey(cls), `${atlasKey(cls)}-w`]) {
      if (!scene.textures.exists(key)) continue;
      const tex = scene.textures.get(key);
      for (const dir of DIRS) for (const [act, rects] of Object.entries(a.directions[dir]) as [AtlasAction, Rect[]][]) {
        rects.forEach((r, i) => { const n = atlasFrame(dir, act, i); if (!tex.has(n)) tex.add(n, 0, r.x, r.y, r.w, r.h); });
      }
    }
  }
}

/** Resolved frame for one pose. Anchor values are in world px relative to the feet (x right, y down). */
export interface PoseFrame {
  key: string; frame: string | number; wkey: string; ox: number; oy: number; scale: number;
  /** Optional per-axis multipliers around the feet (procedural breathing). */
  sx?: number; sy?: number;
  /** [headTopX, headTopY, headCx, headCy, backX, backY] relative to the feet, world px (already scaled). */
  anchor: number[] | null;
  /** Head (hair) box for helmets: [centerX, width (direction median, stable), bottomY], world px rel. feet. */
  hair?: number[] | null;
}

type AnchorTable = Record<string, (number[] | null)[][] | Record<string, (number[] | null)[]>>;
const ANCH = ANCHORS as unknown as AnchorTable;
function scaleAnchor(a: number[] | null | undefined, k: number): number[] | null { return a ? a.slice(0, 6).map((v) => v * k) : null; }
function scaleHair(a: number[] | null | undefined, k: number): number[] | null { return a && a.length > 9 ? [a[7] * k, a[8] * k, a[9] * k] : null; }

function sheetFrame(key: string, path: string, dir: Dir, col: number, cols: number): PoseFrame {
  const c = Math.max(0, Math.min(cols - 1, col)), row = ROW[dir];
  const table = ANCH[path] as (number[] | null)[][] | undefined;
  return { key, frame: row * cols + c, wkey: `${key}-w`, ox: 0.5, oy: ORIGIN_Y, scale: SHEET_SCALE, anchor: scaleAnchor(table?.[row]?.[c], SHEET_SCALE), hair: scaleHair(table?.[row]?.[c], SHEET_SCALE) };
}

function atlasPose(cls: string, dir: Dir, act: AtlasAction, i: number): PoseFrame {
  const a = ATLAS[cls], rects = a.directions[dir][act];
  const idx = Math.max(0, Math.min(rects.length - 1, i)), r = rects[idx];
  const oy = act === 'jump' ? Math.min(1, (r.ay - r.y) / r.h) : (r.ay - r.y) / r.h;
  const k = a.scaleByDirection[dir];
  const table = ANCH[`atlas:${cls}`] as Record<string, (number[] | null)[]> | undefined;
  return { key: atlasKey(cls), frame: atlasFrame(dir, act, idx), wkey: `${atlasKey(cls)}-w`, ox: (r.ax - r.x) / r.w, oy, scale: k, anchor: scaleAnchor(table?.[`${dir}-${act}`]?.[idx], k) };
}
const atlasCount = (cls: string, dir: Dir, act: AtlasAction) => ATLAS[cls].directions[dir][act].length;

// ------------------------------------------------------------------ pose queries

export type PoseQuery =
  | { k: 'loop'; state: 'idle' | 'walk' | 'run'; t: number; speed: number }
  | { k: 'jump'; phase: 'takeoff' | 'rise' | 'apex' | 'fall' | 'land'; t: number }
  | { k: 'airAttack'; p: number }
  | { k: 'hurt'; p: number }
  | { k: 'launched'; vz: number }
  | { k: 'down'; p: number } // knockdown fall → lying (p 0..1)
  | { k: 'getup'; p: number }
  | { k: 'recovery'; p: number }
  | { k: 'death'; p: number }
  | { k: 'skill'; id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number };

const pick = <T,>(list: T[], p: number): T => list[Math.max(0, Math.min(list.length - 1, Math.floor(p * list.length)))];

export function resolvePose(cls: ClassKey, dir: Dir, q: PoseQuery): PoseFrame {
  return isSheetClass(cls) ? sheetPose(cls, dir, q) : atlasPoseFor(cls, dir, q);
}

function mv(cls: string, st: MoveState, dir: Dir, col: number): PoseFrame { return sheetFrame(sheetKey(cls, st), sheetPath(cls, st), dir, col, MOVE_COLS[st]); }

function sheetPose(cls: string, dir: Dir, q: PoseQuery): PoseFrame {
  switch (q.k) {
    case 'loop': {
      if (q.state === 'idle') { // one clean frame + smooth procedural breathing (separately painted idle frames flicker)
        const f = mv(cls, 'idle', dir, 0), b = Math.sin((q.t / 2600) * Math.PI * 2);
        f.sy = 1 + 0.014 * b; f.sx = 1 - 0.005 * b;
        if (f.anchor) f.anchor = f.anchor.map((v, i) => (i % 2 ? v * f.sy! : v * f.sx!));
        if (f.hair) f.hair = [f.hair[0] * f.sx!, f.hair[1] * f.sx!, f.hair[2] * f.sy!];
        return f;
      }
      if (q.state === 'walk') { // 8-frame cycles (down/up rows of the old 6-frame art until replaced)
        const n = cls === 'warrior' && (dir === 'right' || dir === 'left') ? 8 : 6;
        const fps = (n === 8 ? 10 : 8) * Math.max(0.7, Math.min(1.2, q.speed / 188));
        return mv(cls, 'walk', dir, Math.floor((q.t * fps) / 1000) % n);
      }
      const fps = 13 * Math.max(0.75, Math.min(1.15, q.speed / 270));
      return mv(cls, 'run', dir, Math.floor((q.t * fps) / 1000) % 8);
    }
    case 'jump': {
      const col = { takeoff: q.t < 40 ? 0 : 1, rise: q.t < 120 ? 2 : 3, apex: 4, fall: q.t < 120 ? 5 : 6, land: 7 }[q.phase];
      return mv(cls, 'jump', dir, col);
    }
    case 'airAttack': return mv(cls, 'air_attack', dir, Math.floor(q.p * 6));
    case 'hurt': return mv(cls, 'hurt', dir, Math.min(3, Math.floor(q.p * 4)));
    case 'launched': return mv(cls, 'hurt', dir, q.vz > 0 ? 1 : 2);
    case 'down': return mv(cls, 'death', dir, Math.min(5, Math.floor(q.p * 6)));
    case 'getup': return mv(cls, 'death', dir, Math.max(0, 5 - Math.floor(q.p * 6)));
    case 'recovery': return mv(cls, 'recovery', dir, 1 + Math.min(2, Math.floor(q.p * 3)));
    case 'death': return mv(cls, 'death', dir, Math.min(7, Math.floor(q.p * 8)));
    case 'skill': {
      const sk = FINAL_SKILLS.find((s) => s.id === q.id);
      const cols = sk && sk.slot === 7 ? 12 : sk && sk.slot === 6 ? 10 : 6;
      if (sk?.chain && q.stage === 2) { // third chain strike: the big overhead swing of the air-attack set
        const p = q.elapsed / (q.startup + q.active + q.recovery);
        return mv(cls, 'air_attack', dir, Math.min(5, Math.floor(p * 6)));
      }
      const col = skillColumn(cols, q, sk?.chain && q.stage === 1 ? 1 : 0);
      return sheetFrame(skillKey(cls, q.id), skillPath(cls, q.id), dir, col, cols);
    }
  }
}

/** Column of a skill body for the run phase: anticipation in startup, release exactly at the active start. */
function skillColumn(cols: number, q: Extract<PoseQuery, { k: 'skill' }>, offset: number): number {
  const { elapsed: e, startup: s, active: a, recovery: r } = q;
  const plan = cols === 12 ? { st: [0, 1, 2, 3], ac: [4, 5, 6, 7, 8, 9], rc: [10, 11] }
    : cols === 10 ? { st: [0, 1], ac: [2, 3, 4, 5, 6, 7, 8], rc: [9] }
      : { st: [0 + offset, 1], ac: [2, 3, 4], rc: [5] };
  const act = Math.max(a, 120);
  if (e < s) return pick(plan.st, e / Math.max(1, s));
  if (e < s + act) return pick(plan.ac, (e - s) / act);
  return pick(plan.rc, (e - s - act) / Math.max(1, r - (act - a)));
}

// ---- archer / samurai sequences (base-sheet poses; attack 0 nock/guard, 1 draw/lunge, 2 full draw/slash, 3 release/follow)
type AP = [AtlasAction, number];
interface Seq { st: AP[]; ac: AP[]; rc: AP[] }
const at = (...i: number[]): AP[] => i.map((n) => ['attack', n] as AP);
const SEQ: Record<string, Seq> = {
  quick_shot: { st: at(1, 2), ac: at(3), rc: [['attack', 3], ['idle', 0]] },
  multi_shot: { st: at(0, 1, 2), ac: at(3, 2, 3), rc: [['attack', 3], ['idle', 0]] },
  piercing_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  explosive_arrow: { st: at(0, 1, 2, 2), ac: at(3), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  vine_trap: { st: [['attack', 0], ['jump', 2]], ac: [['jump', 2]], rc: [['jump', 2], ['idle', 0]] },
  rain_of_arrows: { st: at(0, 1, 2), ac: at(3, 2, 3, 2, 3), rc: [['attack', 3], ['idle', 0]] },
  skyhunters_step: { st: [['jump', 2], ['attack', 1]], ac: [['jump', 0], ['attack', 2], ['attack', 3], ['attack', 2], ['attack', 3], ['jump', 1], ['attack', 3]], rc: [['jump', 2], ['idle', 0]] },
  verdant_judgment: { st: [['attack', 0], ['jump', 2], ['attack', 1], ['attack', 2]], ac: [['attack', 2], ['attack', 3], ['attack', 3]], rc: [['attack', 3], ['jump', 2], ['idle', 0]] },
  quick_slash: { st: at(0), ac: at(1, 2), rc: at(3) },
  shadow_step: { st: [['run', 1]], ac: [['run', 3], ['attack', 2]], rc: [['attack', 3], ['idle', 0]] },
  spin_cut: { st: at(0), ac: at(2, 1, 2), rc: [['attack', 3], ['idle', 0]] },
  iai_strike: { st: at(0, 0), ac: at(2), rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
  sword_wave: { st: at(0, 1), ac: at(2), rc: [['attack', 3], ['idle', 0]] },
  mirage: { st: [['idle', 0], ['attack', 0]], ac: [['attack', 0]], rc: [['attack', 3], ['idle', 0]] },
  blossom_storm: { st: [['attack', 0], ['run', 1]], ac: [['attack', 2], ['run', 3], ['attack', 1], ['attack', 2], ['run', 3], ['attack', 2], ['attack', 3]], rc: [['attack', 3], ['idle', 0]] },
  dragon_eclipse: { st: [['attack', 0], ['jump', 2], ['run', 1]], ac: [['attack', 2], ['attack', 3]], rc: [['attack', 3], ['attack', 3], ['idle', 0]] },
};
const CHAIN_SEQ: Record<string, Seq[]> = {
  quick_slash: [{ st: at(0), ac: at(1, 2), rc: at(3) }, { st: at(3), ac: at(2, 1), rc: at(0) }, { st: [['attack', 0], ['jump', 2]], ac: at(2, 3), rc: [['attack', 3], ['idle', 0]] }],
};
const MIN_ACTIVE = 110;

function atlasPoseFor(cls: string, dir: Dir, q: PoseQuery): PoseFrame {
  switch (q.k) {
    case 'loop': {
      const fps = q.state === 'idle' ? 5 : q.state === 'walk' ? 8 * Math.max(0.7, Math.min(1.2, q.speed / 188)) : 10 * Math.max(0.75, Math.min(1.15, q.speed / 270));
      const n = atlasCount(cls, dir, q.state);
      return atlasPose(cls, dir, q.state, Math.floor((q.t * fps) / 1000) % n);
    }
    case 'jump': {
      const fall = JUMP_FALL[cls]?.[dir] ?? 1;
      return atlasPose(cls, dir, 'jump', q.phase === 'rise' || q.phase === 'apex' ? 0 : q.phase === 'fall' ? fall : 2);
    }
    case 'airAttack': return atlasPose(cls, dir, 'attack', Math.min(3, Math.floor(q.p * 4)));
    case 'hurt': return atlasPose(cls, dir, 'hurt', q.p < 0.5 ? 0 : 1);
    case 'launched': return atlasPose(cls, dir, 'hurt', 1);
    case 'down': { const n = atlasCount(cls, dir, 'death'); return atlasPose(cls, dir, 'death', Math.min(n - 1, Math.floor(q.p * n))); }
    case 'getup': { const n = atlasCount(cls, dir, 'death'); return q.p < 0.6 ? atlasPose(cls, dir, 'death', Math.max(0, n - 2 - Math.floor(q.p * 2))) : atlasPose(cls, dir, 'hurt', 0); }
    case 'recovery': return q.p < 0.5 ? atlasPose(cls, dir, 'attack', 3) : atlasPose(cls, dir, 'idle', 0);
    case 'death': { const n = atlasCount(cls, dir, 'death'); return atlasPose(cls, dir, 'death', Math.min(n - 1, Math.floor(q.p * n))); }
    case 'skill': {
      const seq = CHAIN_SEQ[q.id]?.[q.stage] ?? SEQ[q.id] ?? { st: at(0, 1), ac: at(2), rc: at(3) };
      const act = Math.max(q.active, Math.min(MIN_ACTIVE, q.active + q.recovery));
      const e = q.elapsed;
      const [a, i] = e < q.startup ? pick(seq.st, e / Math.max(1, q.startup))
        : e < q.startup + act ? pick(seq.ac, (e - q.startup) / act)
          : pick(seq.rc, (e - q.startup - act) / Math.max(1, q.startup + q.active + q.recovery - q.startup - act));
      return atlasPose(cls, dir, a, i);
    }
  }
}

/** Apply a resolved pose to a body sprite (and its aligned weapon-mask sprite). */
export function applyPose(p: Phaser.GameObjects.Sprite, f: PoseFrame, weapon?: Phaser.GameObjects.Sprite | null): void {
  if (p.texture.key !== f.key || p.frame.name !== String(f.frame)) p.setTexture(f.key, f.frame);
  p.setOrigin(f.ox, f.oy).setScale(f.scale * (f.sx ?? 1), f.scale * (f.sy ?? 1));
  if (weapon && weapon.scene.textures.exists(f.wkey)) {
    if (weapon.texture.key !== f.wkey || weapon.frame.name !== String(f.frame)) weapon.setTexture(f.wkey, f.frame);
    weapon.setOrigin(f.ox, f.oy).setScale(f.scale * (f.sx ?? 1), f.scale * (f.sy ?? 1));
  }
}

/** 4-direction body facing from a vector (dominant axis; exact diagonal faces horizontally). */
export function dirOf(x: number, y: number, fallback: Dir): Dir {
  if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) return fallback;
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
}
