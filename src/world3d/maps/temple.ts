// M19 · Temple Road (docs/WORLD_3D_SPEC.md §2.3): the temple front across the back, the Masters' stage with their banners
// and the portal, the guards' lions at the west, the Waystone at the east, cherry petals; the stair down to the Sun Seal Plaza.
import { islandTerrace } from './islandTerrace';
import { templeRoad } from './dressing';
import { ARENA } from '../../world/Areas';

export const temple = islandTerrace('temple', { wallH: 1.4, wallBack: 5.6, dress: templeRoad, frontGaps: [[ARENA.stairs[0] / 100 - 0.2, ARENA.stairs[1] / 100 + 0.2]], seed: 20261032 });
