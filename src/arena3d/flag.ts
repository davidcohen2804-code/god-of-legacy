/** PVP 3D: the arena is the 3D room (David: PVP 3D replaces the old painted arena). Read when the arena starts; a link
 *  with ?arena2d opens the old painted arena (kept only for tests). Kept apart from Arena3D so that three.js only loads
 *  when the arena is really opened. */
export const ARENA3D = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('arena2d')) };
