// M10 · Archery Range (docs/WORLD_3D_SPEC.md §2.2): rows of targets, a shooting line, the two perches to climb, a hut with bows.
import { islandTerrace } from './islandTerrace';
import { archeryRange } from './dressing';

export const training_3 = islandTerrace('training_3', { wallH: 2.0, wallBack: 3.8, dress: archeryRange, seed: 20261023 });
