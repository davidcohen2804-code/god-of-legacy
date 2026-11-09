// LEGACY OF SPIRITS — the world entry's stages as performance marks (GPT step 4P: "profile the world transition into
// asset download, decoding, scene construction, GPU uploads, shader compilation"): read from the page with
// performance.getEntriesByType('mark') (names 'gol:…'); only behind ?spirits.
import { SPIRITS } from './flag';

export const mark = (name: string): void => { if (SPIRITS.on) try { performance.mark(`gol:${name}`); } catch { /* (no marks: nothing measured) */ } };
