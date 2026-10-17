// M12 · Orchard Path (docs/WORLD_3D_SPEC.md §2.2): orange trees along the back and on Orchard Heights above, the climb up to it, a ladder, baskets of oranges.
import { islandTerrace } from './islandTerrace';
import { orchardPath } from './dressing';

export const orchard_1 = islandTerrace('orchard_1', { levels: true, dress: orchardPath, seed: 20261025 });
