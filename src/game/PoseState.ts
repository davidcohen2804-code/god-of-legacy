// High-level actor animation mode → body pose query (shared by the local player and remote mirrors so both sides
// show the same body for the same state). Transitions: attack → recovery → idle breathing / movement, jump take-off →
// rise → apex → fall → landing, hit → hurt, launch → air hurt → knockdown → getup.
import { PoseQuery } from './Body';

export type Mode = 'idle' | 'alert' | 'walk' | 'run' | 'takeoff' | 'air' | 'land' | 'skill' | 'recover' | 'hurt' | 'launched' | 'down' | 'getup' | 'dead';

export interface SkillPose { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number; seed?: number }

/** Stable number of a cast (its id): picks the attack's drawn variant the same way on every screen (Maple: random). */
export const castSeed = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; // well mixed: casts in a row differ at random
  return h >>> 0;
};

export interface AnimSnap {
  mode: Mode;
  /** ms since the mode started (loop clocks keep running across walk↔run). */
  t: number;
  speed: number;
  vz: number;
  skill?: SkillPose;
  stunMs?: number;
  /** ms since the second jump (War Leap / Wind Leap / Shinsoku / Levitate), while in the air */
  air2?: number;
}

export const RECOVER_MS = 200;
export const LAND_MS = 90;

export function poseQuery(s: AnimSnap): PoseQuery {
  switch (s.mode) {
    case 'idle': return { k: 'loop', state: 'idle', t: s.t, speed: 0 };
    case 'alert': return { k: 'loop', state: 'alert', t: s.t, speed: 0 }; // standing still in the combat stance
    case 'walk': return { k: 'loop', state: 'walk', t: s.t, speed: s.speed };
    case 'run': return { k: 'loop', state: 'run', t: s.t, speed: s.speed };
    case 'takeoff': return { k: 'jump', phase: 'takeoff', t: s.t, air2: s.air2 };
    case 'air': return { k: 'jump', phase: s.vz > 110 ? 'rise' : s.vz > -110 ? 'apex' : 'fall', t: s.vz > 110 ? 999 : s.vz > -110 ? 0 : (s.vz > -300 ? 0 : 999), air2: s.air2 };
    case 'land': return { k: 'jump', phase: 'land', t: s.t };
    case 'skill': return s.skill ? { k: 'skill', ...s.skill } : { k: 'loop', state: 'idle', t: s.t, speed: 0 };
    case 'recover': return { k: 'recovery', p: Math.min(1, s.t / RECOVER_MS) };
    case 'hurt': return { k: 'hurt', p: Math.min(1, s.t / Math.max(120, s.stunMs ?? 200)) };
    case 'launched': return { k: 'launched', vz: s.vz };
    case 'down': return { k: 'down', p: Math.min(1, s.t / 260) };
    case 'getup': return { k: 'getup', p: Math.min(1, s.t / 260) };
    case 'dead': return { k: 'hurt', p: 1 }; // MapleStory-style death: the body holds its stagger and fades while the ghost rises (no fall frames)
  }
}
