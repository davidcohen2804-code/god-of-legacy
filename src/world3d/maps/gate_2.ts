// M18 · Warden's Hold (docs/WORLD_3D_SPEC.md §2.2): the ruined gate with its towers, the arch and its portcullis, chains and torches; the Gate Warden's post.
import { islandTerrace } from './islandTerrace';
import { wardensHold } from './dressing';

export const gate_2 = islandTerrace('gate_2', { wallH: 1.6, wallBack: 4.4, dress: wardensHold, crimson: true, seed: 20261031 });
