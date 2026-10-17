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

export type MapFactory = (focus: { x: number; z: number; sunGateOpen?: boolean }) => BuildPlace;
export const MAPS: Record<string, MapFactory> = {
  courtyard, terraces_1, terraces_2, training, training_2, training_3, plaza, orchard_1, orchard_2, ruins, ruins_2, ruins_3, gate_1, gate_2, temple, sky,
};
