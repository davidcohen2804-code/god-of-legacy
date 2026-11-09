/** LEGACY OF SPIRITS (David and GPT, 9 Nov: the new art direction — heroes as spirits, the world at night): `?spirits`
 *  opens the game's 3D world with the 3D heroes, the Samurai as the Spectral Samurai and the maps in the spirit night.
 *  The game without it is untouched. Kept apart so three.js loads only when a 3D place opens. */
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** `lean`: the 3D world's lighter picture and lighter entry (GPT step 4P; `&lean=0` the old ones, to compare); `lite`:
 *  his gameplay body in the world (approved by GPT in 4P; `&lite=0` the full one, to compare). */
export const SPIRITS = { on: Q.has('spirits'), lean: Q.get('lean') !== '0', lite: Q.get('lite') !== '0',
  /** `&lv=1`…`&lv=100`: the spirit's light shown at that level (the art review), whatever the character's level. */
  lv: Q.has('lv') ? Math.max(1, Math.min(100, Number(Q.get('lv')) || 1)) : null,
  /** `&ghost`: the spirit form and its way into the world (GPT's stage 2, under review — SpiritForm, SpiritLoading). */
  ghost: Q.has('ghost'),
  /** The world's exploration camera, its pitch in degrees (GPT, 10 Nov, after the 19 / 24 / 30 / 36 comparison: 24° at
   *  9 units for the next playable test; `&cam=30` the wider 30° / 10.5 to compare, `&cam=19` the earlier 19° / 7). */
  cam: Q.has('cam') ? Number(Q.get('cam')) || 24 : 24 };

/** The Spectral Samurai's own modelled body (gate 1b, in assets/hero3d): GPT's four drawings → the shape → the drawings
 *  baked on → the Beginner's 65-bone skeleton fitted in (tools/hero3d, src/spirit_samurai). */
export const SPIRIT_BODY = 'spirit_samurai.glb';
/** His gameplay body (GPT step 4P): the same body, skeleton, skin and texture with its 40k triangles simplified to 15k
 *  (tools/spirits/lite.mjs) — the full one stays for the select and the windows. */
export const SPIRIT_BODY_LITE = 'spirit_samurai_lite.glb';
/** His gameplay body's floor shadow: its triangles simplified again (5k), on the same vertices. */
export const SPIRIT_SHADOW_LITE = 'spirit_samurai_lite.shadow.bin';
