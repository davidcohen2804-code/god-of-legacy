/** LEGACY OF SPIRITS (David and GPT, 9 Nov: the new art direction — heroes as spirits, the world at night): `?spirits`
 *  opens the game's 3D world with the 3D heroes, the Samurai as the Spectral Samurai and the maps in the spirit night.
 *  The game without it is untouched. Kept apart so three.js loads only when a 3D place opens. */
export const SPIRITS = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).has('spirits') };
