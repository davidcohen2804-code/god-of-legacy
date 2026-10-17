// The world's 3D places, one builder per map (docs/WORLD_3D_SPEC.md, Part 2), each bound to where the hero is.
import type { BuildPlace } from '../../arena3d/Arena3D';
import { courtyard } from './courtyard';
import { terraces_1 } from './terraces_1';

export type MapFactory = (focus: { x: number; z: number }) => BuildPlace;
export const MAPS: Record<string, MapFactory> = {
  courtyard, terraces_1,
};
