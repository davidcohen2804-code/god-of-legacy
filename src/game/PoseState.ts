// High-level actor animation mode → body pose query (shared by the local player and remote mirrors so both sides
// show the same body for the same state). Transitions: attack → recovery → idle breathing / movement, jump take-off →
// rise → apex → fall → landing, hit → hurt, launch → air hurt → knockdown → getup.
import { PoseQuery } from './Body';

export type Mode = 'idle' | 'walk' | 'run' | 'takeoff' | 'air' | 'land' | 'skill' | 'recover' | 'hurt' | 'launched' | 'down' | 'getup' | 'dead';

export interface SkillPose { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number }

export interface AnimSnap {
  mode: Mode;
  /** ms since the mode started (loop clocks keep running across walk↔run). */
  t: number;
  speed: number;
  vz: number;
  skill?: SkillPose;
  stunMs?: number;
}

export const RECOVER_MS = 200;
export const LAND_MS = 90;

export function poseQuery(s: AnimSnap): PoseQuery {
  switch (s.mode) {
    case 'idle': return { k: 'loop', state: 'idle', t: s.t, speed: 0 };
    case 'walk': return { k: 'loop', state: 'walk', t: s.t, speed: s.speed };
    case 'run': return { k: 'loop', state: 'run', t: s.t, speed: s.speed };
    case 'takeoff': return { k: 'jump', phase: 'takeoff', t: s.t };
    case 'air': return { k: 'jump', phase: s.vz > 110 ? 'rise' : s.vz > -110 ? 'apex' : 'fall', t: s.vz > 110 ? 999 : s.vz > -110 ? 0 : (s.vz > -300 ? 0 : 999) };
    case 'land': return { k: 'jump', phase: 'land', t: s.t };
    case 'skill': return s.skill ? { k: 'skill', ...s.skill } : { k: 'loop', state: 'idle', t: s.t, speed: 0 };
    case 'recover': return { k: 'recovery', p: Math.min(1, s.t / RECOVER_MS) };
    case 'hurt': return { k: 'hurt', p: Math.min(1, s.t / Math.max(120, s.stunMs ?? 200)) };
    case 'launched': return { k: 'launched', vz: s.vz };
    case 'down': return { k: 'down', p: Math.min(1, s.t / 260) };
    case 'getup': return { k: 'getup', p: Math.min(1, s.t / 260) };
    case 'dead': return { k: 'death', p: Math.min(1, s.t / 420) };
  }
}
