// M16 · Sunken Shrine (docs/WORLD_3D_SPEC.md §2.2): the dais and altar under half a dome, the great crimson drapes, braziers; the spire blocks.
import { islandTerrace } from './islandTerrace';
import { sunkenShrine } from './dressing';

export const ruins_3 = islandTerrace('ruins_3', { wallH: 1.8, wallBack: 4.6, dress: sunkenShrine, crimson: true, seed: 20261029 });
