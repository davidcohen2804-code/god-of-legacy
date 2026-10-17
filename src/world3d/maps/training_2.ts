// M09 · Sparring Yard (docs/WORLD_3D_SPEC.md §2.2): a roped ring, dummies and barrels; Nimbus's cloud is far above (Cloud Haven).
import { islandTerrace } from './islandTerrace';
import { sparringYard } from './dressing';

export const training_2 = islandTerrace('training_2', { wallH: 2.0, wallBack: 3.8, dress: sparringYard, seed: 20261022 });
