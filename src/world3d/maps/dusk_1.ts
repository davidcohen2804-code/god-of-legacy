// M20 · Wisteria Walk (docs/WORLD_3D_SPEC.md §2.4): the terrace at dusk under a pergola hung with wisteria and paper lanterns, Lumen's lamp-pole.
import { islandTerrace } from './islandTerrace';
import { wisteriaWalk } from './dressingDusk';

export const dusk_1 = islandTerrace('dusk_1', { wallH: 2.0, wallBack: 4.6, dusk: true, dress: wisteriaWalk, seed: 20261050 });
