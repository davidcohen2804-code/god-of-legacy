// The recipes' shared words: the colours and where things are (PVP 3D's skill pieces, src/arena3d/Fx3D.ts).
import type { CastRun } from '../../skills/SkillRuntime';
import type { Fx3D, V3 } from '../Fx3D';

export const C = {
  gold: 0xffc65a, crimson: 0xff3a3a, steel: 0xe8f0ff, ember: 0xff8a2a,
  frost: 0x9fe4ff, ice: 0xbff0ff, storm: 0xb9a2ff, arcane: 0x9a7bff, paper: 0xf4ecff,
  leaf: 0x9be35a, spirit: 0x7dffb0, fire: 0xff7a2a,
  sakura: 0xff9ec8, rose: 0xff6aa8, ink: 0x7a5cff, sun: 0xffd27a,
  fuchsia: 0xff2bd6, coin: 0xffd84a, dice: 0xff4a8a,
};
/** Where the caster stands now (or where he cast from). */
export const me = (f: Fx3D, r: CastRun): V3 => f.host.casterPos(r.attackerId) ?? r.origin;
/** The side he cuts toward (±1). */
export const side = (r: CastRun): number => (r.aim.x < 0 ? -1 : 1);
/** A point `d` px ahead of the caster along the aim. */
export const ahead = (f: Fx3D, r: CastRun, d: number): V3 => { const c = me(f, r); return { x: c.x + r.aim.x * d, y: c.y + r.aim.y * d * 0.6, z: 0 }; };
/** Where a placed skill opens (its place, else ahead of him). */
export const placeOf = (f: Fx3D, r: CastRun, d = 260): V3 => (r.place ? { x: r.place.x, y: r.place.y, z: 0 } : ahead(f, r, d));
/** The cast's timings (startup / active / recovery, ms). */
export const T = (r: CastRun) => r.timings;
