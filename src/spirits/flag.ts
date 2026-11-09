/** LEGACY OF SPIRITS (David and GPT, 9 Nov: the new art direction — heroes as spirits, the world at night): `?spirits`
 *  opens the game's 3D world with the 3D heroes, the Samurai as the Spectral Samurai and the maps in the spirit night.
 *  The game without it is untouched. Kept apart so three.js loads only when a 3D place opens. */
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** `lean`: the 3D world's lighter picture and lighter entry (GPT step 4P; `&lean=0` the old ones, to compare); `lite`:
 *  his gameplay body in the world (`&lite=1` — until GPT has compared it with the full one). */
export const SPIRITS = { on: Q.has('spirits'), lean: Q.get('lean') !== '0', lite: Q.get('lite') === '1' };

/** The Spectral Samurai's own modelled body (gate 1b, in assets/hero3d): GPT's four drawings → the shape → the drawings
 *  baked on → the Beginner's 65-bone skeleton fitted in (tools/hero3d, src/spirit_samurai). */
export const SPIRIT_BODY = 'spirit_samurai.glb';
/** His gameplay body (GPT step 4P): the same body, skeleton, skin and texture with its 40k triangles simplified to 15k
 *  (tools/spirits/lite.mjs) — the full one stays for the select and the windows. */
export const SPIRIT_BODY_LITE = 'spirit_samurai_lite.glb';
