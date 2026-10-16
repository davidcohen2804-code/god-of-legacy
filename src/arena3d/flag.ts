/** PVP 3D (the test build): set by the main menu's PVP 3D button or a link with ?arena3d, read when the arena starts.
 *  Kept apart from Arena3D so that three.js only loads when the 3D arena is really opened. */
export const ARENA3D = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).has('arena3d') };
