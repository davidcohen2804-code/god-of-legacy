// M15 · Broken Colonnade (docs/WORLD_3D_SPEC.md §2.2): a colonnade half down, drums across the floor, two columns leaning on each other.
import { islandTerrace } from './islandTerrace';
import { brokenColonnade } from './dressing';

export const ruins_2 = islandTerrace('ruins_2', { wallH: 1.8, wallBack: 4.2, dress: brokenColonnade, crimson: true, seed: 20261028 });
