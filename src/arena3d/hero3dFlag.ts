/** The 3D heroes (David 24 Oct: the heroes in 3D, the Beginner with the classes' weapons; "throw out the characters we
 *  already made"): in every 3D place — the PVP 3D room, a map of the world in 3D — each fighter's painted body gives way
 *  to the 3D Beginner (src/arena3d/Hero3D.ts). On by default; `?hero3d=0` shows the painted bodies again (to compare).
 *  The painted world (2D maps) keeps its painted bodies until its maps are 3D. Kept apart from Hero3D so three.js loads
 *  only when a 3D place opens. */
export const HERO3D = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).get('hero3d') !== '0' };
