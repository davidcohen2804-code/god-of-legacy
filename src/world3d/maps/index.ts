// The world's 3D places, one builder per map (docs/WORLD_3D_SPEC.md, Part 2), each bound to where the hero is.
import type { BuildPlace } from '../../arena3d/Arena3D';
import { courtyard } from './courtyard';
import { terraces_1 } from './terraces_1';
import { terraces_2 } from './terraces_2';
import { training } from './training';
import { training_2 } from './training_2';
import { training_3 } from './training_3';
import { plaza } from './plaza';
import { orchard_1 } from './orchard_1';
import { orchard_2 } from './orchard_2';
import { ruins } from './ruins';
import { ruins_2 } from './ruins_2';
import { ruins_3 } from './ruins_3';
import { gate_1 } from './gate_1';
import { gate_2 } from './gate_2';
import { temple } from './temple';
import { sky } from './sky';
import { denCave } from './denCave';
import { sakura_village } from './sakura_village';
import { ironhold_village } from './ironhold_village';
import { ironhold_1 } from './ironhold_1';
import { ironhold_2 } from './ironhold_2';
import { ironhold_3 } from './ironhold_3';
import { sakura_1 } from './sakura_1';
import { sakura_2 } from './sakura_2';
import { sakura_3 } from './sakura_3';
import { dusk_1 } from './dusk_1';
import { dusk_village } from './dusk_village';
import { dusk_2 } from './dusk_2';
import { dusk_bridge } from './dusk_bridge';
import { dusk_wood } from './dusk_wood';
import { dusk_3 } from './dusk_3';

export type MapFactory = (focus: { x: number; z: number; sunGateOpen?: boolean; denStage?: number; denLit?: number[]; done?: string[] }) => BuildPlace;
export const MAPS: Record<string, MapFactory> = {
  courtyard, terraces_1, terraces_2, training, training_2, training_3, plaza, orchard_1, orchard_2, ruins, ruins_2, ruins_3, gate_1, gate_2, temple, sky,
  dusk_1, dusk_village, dusk_2, dusk_bridge, dusk_wood, dusk_3,
  den_1: denCave('den_1', { stage: 1 }), den_2: denCave('den_2', { stage: 2 }), den_3: denCave('den_3', { stage: 3 }), den_4: denCave('den_4', { stage: 4 }), den_5: denCave('den_5', { stage: 5 }),
  sakura_village, sakura_1, sakura_2, sakura_3,
  ironhold_village, ironhold_1, ironhold_2, ironhold_3,
};

/** How near the camera keeps on each map (1 = the world camera; more = nearer): the narrow ways — a torii tunnel, a
 *  path among roots, the steps, a crag — draw it in a little, the squares and the towns let it out so the place is
 *  seen (docs/WORLD_3D_SPEC.md §1.8, "the camera breathes with the place"); eased on a crossing with the arrival. */
export const VIEW: Record<string, number> = {
  plaza: 0.9, orchard_2: 0.9, dusk_village: 0.88, sakura_village: 0.88, ironhold_village: 0.88, gate_1: 0.94, ironhold_3: 0.92, den_5: 0.94, ruins_3: 0.95,
  ruins_2: 1.05, dusk_2: 1.08, dusk_bridge: 1.04, dusk_wood: 1.08, den_2: 1.06, sakura_1: 1.04, sakura_2: 1.1, ironhold_1: 1.1,
};
