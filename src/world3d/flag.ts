/** The world in 3D (docs/WORLD_3D_SPEC.md): on with `?world3d=1` while the maps are rebuilt one by one (the painted
 *  world stays the game's default until David approves each map). Kept apart from World3D so three.js loads only
 *  when a 3D place really opens; `MAPS_3D` names the maps that exist in 3D so far (src/world3d/maps). */
export const MAPS_3D = ['courtyard', 'terraces_1', 'terraces_2', 'training', 'training_2', 'training_3', 'plaza', 'orchard_1', 'orchard_2', 'ruins', 'ruins_2', 'ruins_3', 'gate_1', 'gate_2', 'temple'];
export const WORLD3D = {
  on: typeof location !== 'undefined' && new URLSearchParams(location.search).get('world3d') === '1',
  has(areaId: string): boolean { return this.on && MAPS_3D.includes(areaId); },
};
