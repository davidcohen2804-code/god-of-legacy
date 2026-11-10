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
  /** `&ns`: the new Spectral Samurai (his body from David's illustration, rigged) as a spirit with controlled
   *  transparency, and the same way into the world (GPT, 10 Nov: the first actual integration, under review — Spectral). */
  ns: Q.has('ns'),
  /** `&hold=ms`: the art review's still — the select's preview held at that moment (the same pose for every level). */
  hold: Q.has('hold') ? Math.max(0, Number(Q.get('hold')) || 0) : null,
  /** The world's exploration camera, its pitch in degrees (GPT, 10 Nov, after the 19 / 24 / 30 / 36 comparison: 24° at
   *  9 units for the next playable test; `&cam=30` the wider 30° / 10.5 to compare, `&cam=19` the earlier 19° / 7). */
  cam: Q.has('cam') ? Number(Q.get('cam')) || 24 : 24,
  /** `&prop=a` / `&prop=b`: GPT's experiment P1 (10 Nov) — the new Samurai's body with its proportions re-set in its rest
   *  pose (tools/spirits/ns/reprop.mjs: a smaller head, longer legs, a slimmer waist and hakama; B also the arms a little
   *  further out), each its own model files beside the current ones; without it, the current body. */
  prop: (Q.get('prop') === 'a' || Q.get('prop') === 'b' ? Q.get('prop') : null) as 'a' | 'b' | null,
  /** `&solid`: the new Samurai's body as it is drawn (its own texture, lit by the place), without the spirit material —
   *  GPT's neutral comparison of the silhouettes (P1). */
  solid: Q.has('solid'),
  /** `&native`: GPT's experiment R1 (10 Nov) — the 3D picture drawn at the game canvas's own size on High, so the game
   *  copies it 1:1 (today: drawn at up to 85 % or at the window's pixels, then scaled into the canvas, which the browser
   *  scales again). */
  native: Q.has('native') };

/** The Spectral Samurai's own modelled body (gate 1b, in assets/hero3d): GPT's four drawings → the shape → the drawings
 *  baked on → the Beginner's 65-bone skeleton fitted in (tools/hero3d, src/spirit_samurai). */
export const SPIRIT_BODY = 'spirit_samurai.glb';
/** His gameplay body (GPT step 4P): the same body, skeleton, skin and texture with its 40k triangles simplified to 15k
 *  (tools/spirits/lite.mjs) — the full one stays for the select and the windows. */
export const SPIRIT_BODY_LITE = 'spirit_samurai_lite.glb';
/** His gameplay body's floor shadow: its triangles simplified again (5k), on the same vertices. */
export const SPIRIT_SHADOW_LITE = 'spirit_samurai_lite.shadow.bin';
/** The new Spectral Samurai's body (`&ns`: his body from David's illustration, rigged — tools/spirits/ns), his gameplay
 *  body (its 49k triangles simplified to 18k: the bangs, the ponytail's silhouette, the shoulder armour and the long
 *  panels kept — tools/spirits/lite.mjs) and that one's floor shadow. */
const NS = `spirit_samurai_ns${SPIRITS.prop ? `_p${SPIRITS.prop}` : ''}`; // (&prop: P1's re-proportioned files)
export const SPIRIT_BODY_NS = `${NS}.glb`;
export const SPIRIT_BODY_NS_LITE = `${NS}_lite.glb`;
export const SPIRIT_SHADOW_NS_LITE = `${NS}_lite.shadow.bin`;
