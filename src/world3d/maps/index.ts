// The world's 3D places, one builder per map (docs/WORLD_3D_SPEC.md, Part 2), each bound to where the hero is.
import type { BuildPlace } from '../../arena3d/Arena3D';
import { courtyard } from './courtyard';
import { terraces_1 } from './terraces_1';
import { terraces_2 } from './terraces_2';
import { training } from './training';
import { training_2 } from './training_2';
import { training_3 } from './training_3';
import { plaza } from './plaza';

export type MapFactory = (focus: { x: number; z: number; sunGateOpen?: boolean }) => BuildPlace;
export const MAPS: Record<string, MapFactory> = {
  courtyard, terraces_1, terraces_2, training, training_2, training_3, plaza,
};
