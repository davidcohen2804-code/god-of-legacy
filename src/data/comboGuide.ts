// Combo guide (the PvP arena, left side): per class, routes that keep the foe locked from the first hit to the last — no
// moment to move, attack or get up in between (BREAK is the one way out). Every route was played in the arena against a
// foe that does nothing: each key pressed right after the last hit of the one before, and also up to 0.1–0.4 s later, from
// a little nearer and a little farther, at 30 to 144 frames a second, and between two players over a 50–160 ms connection;
// each ends on the combo's share (~30%) or its hit limit.
import type { ClassId } from '../skills/SkillTypes';

export interface GuideStep {
  /** The skill (absent: a jump). */
  id?: string;
  /** Presses in a row (the basic chain). */
  n?: number;
  /** Hold the key until the skill is fully charged. */
  hold?: boolean;
}
/** How far away the opener reaches the foe: CLOSE up to ~120 px, MID up to ~150–180, FAR up to ~250. */
export type GuideRange = 'CLOSE' | 'MID' | 'FAR';
export interface GuideRoute { name: string; range: GuideRange; hits: number; steps: GuideStep[] }

export const COMBO_GUIDE: Partial<Record<ClassId, GuideRoute[]>> = {
  samurai: [
    { name: 'BASIC', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash', n: 4 }, { id: 'hundred_cuts' }] },
    { name: 'LAUNCH', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'AIR', range: 'CLOSE', hits: 15, steps: [{ id: 'swallow_cut' }, {}, { id: 'hundred_cuts' }] },
    { name: 'SPIN', range: 'CLOSE', hits: 15, steps: [{ id: 'spin_cut' }, { id: 'hundred_cuts' }] },
    { name: 'TORNADO', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'tornado_blade' }, { id: 'hundred_cuts' }] },
    { name: 'FINISH', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'hundred_cuts' }, { id: 'iai_strike', hold: true }] },
    { name: 'BURST', range: 'CLOSE', hits: 3, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }] },
    { name: 'DASH', range: 'MID', hits: 15, steps: [{ id: 'shadow_step' }, { id: 'hundred_cuts' }, { id: 'spin_cut' }] },
    { name: 'WAVE', range: 'MID', hits: 14, steps: [{ id: 'sword_wave' }, { id: 'hundred_cuts' }] },
    { name: 'PHANTOM', range: 'MID', hits: 9, steps: [{ id: 'phantom_blades' }, { id: 'falcon_dive' }] },
    { name: 'FALCON', range: 'FAR', hits: 15, steps: [{ id: 'falcon_dive' }, { id: 'hundred_cuts' }, { id: 'tornado_blade' }] },
    { name: 'ULTIMATE', range: 'FAR', hits: 11, steps: [{ id: 'blossom_storm' }, { id: 'dragon_eclipse' }] },
  ],
};
