// The PvP arena's stages (Tekken-style): the same floor, props and walls under different paintings and weather — the
// fight is the same on every one, only the look changes. A match's stage comes from its room's name, so both players of
// a room always fight on the same stage (a room of your own against the CPU: a stage at random).
import { COURTYARD_LOOK, NIGHT_LOOK, StageLook, WINTER_LOOK } from './StageFx';

export interface Stage {
  id: string;
  /** Shown on the loading screen and the VS. */
  name: string;
  /** The painting (the arena's map pixels, 1672x941) and its texture key. */
  file: string;
  key: string;
  /** A small copy for the loading screen's backdrop (it shows before the painting itself is in). */
  preview: string;
  look: StageLook;
}

export const STAGES: Stage[] = [
  { id: 'courtyard', name: 'LEGACY COURTYARD', file: 'assets/environment/Legacy_Courtyard.png', key: 'legacy-courtyard', preview: 'assets/pvp/stages/courtyard.webp', look: COURTYARD_LOOK },
  { id: 'night', name: 'MOONLIT COURTYARD', file: 'assets/environment/stages/courtyard_night.webp', key: 'stage-courtyard-night', preview: 'assets/pvp/stages/night.webp', look: NIGHT_LOOK },
  { id: 'winter', name: 'FROZEN COURTYARD', file: 'assets/environment/stages/courtyard_winter.webp', key: 'stage-courtyard-winter', preview: 'assets/pvp/stages/winter.webp', look: WINTER_LOOK },
];

/** The stage of a room (the same on every screen in it). */
export function stageOf(room: string | undefined | null): Stage {
  let h = 2166136261;
  for (const ch of room ?? '') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return STAGES[h % STAGES.length];
}
