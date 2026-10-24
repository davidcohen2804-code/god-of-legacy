/** The 3D hero test (David 24 Oct 12:15): `?hero3d=1` puts a 3D hero in the PVP 3D arena in place of the player's painted
 *  body — one skeleton, every piece of clothing its own file on it (src/arena3d/Hero3D.ts). Kept apart from Hero3D so
 *  three.js loads only when the arena opens; without the switch nothing changes. */
export const HERO3D = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).get('hero3d') === '1' };
