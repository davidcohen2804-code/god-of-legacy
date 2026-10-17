// M35 · Ironhold (docs/WORLD_3D_SPEC.md §2.6): the parade ground before the keep — battlements, towers and banners, Grit's forge glowing, the Waystone by the gatehouse.
import { islandTerrace } from './islandTerrace';
import { ironholdKeep } from './dressingIronhold';

export const ironhold_village = islandTerrace('ironhold_village', { look: 'ironhold', bare: true, dress: ironholdKeep, seed: 20261080 });
