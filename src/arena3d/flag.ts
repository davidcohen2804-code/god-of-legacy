/** PVP 3D: the arena is the 3D room (David: PVP 3D replaces the old painted arena). Read when the arena starts; a link
 *  with ?arena2d opens the old painted arena (kept only for tests). Kept apart from Arena3D so that three.js only loads
 *  when the arena is really opened. */
export const ARENA3D = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('arena2d')) };
/** Pictures drawn on a fighter's painted body — a card in his hand, a glow in his palm, a light along his weapon: PVP 3D
 *  draws the painted body flat round its feet (Arena3D places it by its feet point, scaled by its depth), but places every
 *  other picture by its own point through the 3D camera, so a picture pinned to a hand or a weapon slid off it as the
 *  perspective bent (a fist's length ahead of the hand in a run, over the shoulder in a fall). One registered here is drawn
 *  flat with the body it names (read every frame: null to place it by its own point). The painted arena ignores it. */
export const ON_BODY = new WeakMap<object, () => object | null | undefined>();
