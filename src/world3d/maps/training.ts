// M08 · Training Grounds (docs/WORLD_3D_SPEC.md §2.2): the drill yard east of the Sun Gate — a fence with straw targets, dummies, a rack, the plank platform; the Rusted Swordsmen drill here.
import { islandTerrace } from './islandTerrace';
import { trainingYard } from './dressing';

export const training = islandTerrace('training', { wallH: 2.0, wallBack: 3.8, dress: trainingYard, sunGate: true, seed: 20261021 });
