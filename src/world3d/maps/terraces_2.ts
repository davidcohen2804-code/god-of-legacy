// M03 · Upper Gardens (docs/WORLD_3D_SPEC.md §2.1): three levels in one place — the terrace, Ivy Heights above it and
// Ivy Summit above that, climbed by the stacked blocks; the Sun Gate closed across the east end until the sun is crossed.
import { islandTerrace } from './islandTerrace';

export const terraces_2 = islandTerrace('terraces_2', { levels: true, towers: true, sunGate: true, seed: 20261020 });
