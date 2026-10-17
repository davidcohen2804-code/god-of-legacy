// M17 · Siege Approach (docs/WORLD_3D_SPEC.md §2.2): rotting siege engines, barricades of stakes, torn banners; the leap blocks.
import { islandTerrace } from './islandTerrace';
import { siegeApproach } from './dressing';

export const gate_1 = islandTerrace('gate_1', { wallH: 1.8, wallBack: 4.4, dress: siegeApproach, crimson: true, seed: 20261030 });
