// M13 · Harvest Square (docs/WORLD_3D_SPEC.md §2.2): crates and barrels, a wine press, garlands with lanterns between poles, the step blocks.
import { islandTerrace } from './islandTerrace';
import { harvestSquare } from './dressing';

export const orchard_2 = islandTerrace('orchard_2', { wallH: 1.6, wallBack: 4.0, dress: harvestSquare, seed: 20261026 });
