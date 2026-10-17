// M31 · Sakura Temple (docs/WORLD_3D_SPEC.md §2.6): the shrine's court — the hall and the bell tower, Jiro's tea stall, the Waystone in its ring of lanterns, the vermilion bridge, blossom.
import { islandTerrace } from './islandTerrace';
import { sakuraTemple } from './dressingSakura';

export const sakura_village = islandTerrace('sakura_village', { look: 'sakura', wallH: 1.6, wallBack: 5.2, dress: sakuraTemple, seed: 20261070 });
