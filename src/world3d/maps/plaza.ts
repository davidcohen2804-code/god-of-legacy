// M11 · Sunstone Plaza (docs/WORLD_3D_SPEC.md §2.2): the hub — Mira's stall, Bren's loom, the fountain, the sun rune, red swags; the sky route lands here.
import { islandTerrace } from './islandTerrace';
import { sunstonePlaza } from './dressing';

export const plaza = islandTerrace('plaza', { wallH: 2.2, wallBack: 4.4, dress: sunstonePlaza, rune: true, seed: 20261024 });
