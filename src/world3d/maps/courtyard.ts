// M01 · The Legacy Courtyard (docs/WORLD_3D_SPEC.md §2.1): the first terrace — the great stair up to the Temple's ground
// behind it, corner towers, the sun rune in the paving, Aldric's bench and brazier.
import { islandTerrace } from './islandTerrace';

export const courtyard = islandTerrace('courtyard', { wallH: 2.0, wallBack: 4.2, stair: true, towers: true, rune: true, bench: 'aldric', seed: 20261018 });
