// M14 · Crimson Ruins (docs/WORLD_3D_SPEC.md §2.2): broken arches, rubble, a toppled statue, Crimson Heights above; the Curse's red cast.
import { islandTerrace } from './islandTerrace';
import { crimsonRuins } from './dressing';

export const ruins = islandTerrace('ruins', { levels: true, dress: crimsonRuins, crimson: true, seed: 20261027 });
