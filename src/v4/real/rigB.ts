// Candidate B's rig: the Phase 1 rig with the same 22 bones, 4 sockets, draw slots and corrective channels, so the four
// animations and the resolver carry over unchanged. Bone lengths and attachment points are the ones measured on B's cut
// parts (assets/b.json, written by the parts cutter), and two draw-order changes follow how those parts overlap.
import { GOLDEN_RIG } from '../rig/rig';
import type { BoneDef, RigDef, SlotDef } from '../rig/types';
import data from './assets/b.json';

const G = data.geometry as unknown as Record<string, [number, number]>;
const L = data.lengths;

/** Offsets in the parent's rest frame and lengths, in B. Everything but the hat and back sockets is measured. */
const MEASURED: Record<string, Partial<BoneDef>> = {
  hip: { x: G.hip[0], y: G.hip[1] },
  chest: { x: G.chest[0], y: G.chest[1] },
  head: { x: G.head[0], y: G.head[1] },
  hat: { x: 0.01, y: -0.27 }, // the skull top under the hair (no hat art for B yet)
  back: { x: -0.04, y: -0.16 }, // the cape's clasps: behind the neck, at shoulder height
  ...Object.fromEntries((['F', 'B'] as const).flatMap((s): [string, Partial<BoneDef>][] => [
    [`uparm_${s}`, { x: G[`uparm_${s}`][0], y: G[`uparm_${s}`][1], len: L.uparm }],
    [`forearm_${s}`, { x: L.uparm, len: L.forearm }],
    [`hand_${s}`, { x: L.forearm, len: L.hand }],
    [s === 'F' ? 'weapon' : 'offhand', { x: L.hand }], // the grip: the middle of the fist
    [`thigh_${s}`, { x: G[`thigh_${s}`][0], y: G[`thigh_${s}`][1], len: L.thigh }],
    [`shin_${s}`, { x: L.thigh, len: L.shin }],
    [`foot_${s}`, { x: L.shin }],
  ])),
};

/** `list` with the slots `pick` selects moved just before (or after) the slot named `anchor`. */
function move(list: SlotDef[], pick: (name: string) => boolean, anchor: string, after = false): SlotDef[] {
  const moved = list.filter((s) => pick(s.name)), rest = list.filter((s) => !pick(s.name));
  const at = rest.findIndex((s) => s.name === anchor) + (after ? 1 : 0);
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

let slots = GOLDEN_RIG.slots;
// the boot's foot goes under the leg: the boot shaft covers the top of the foot, the knee piece covers the thigh's end
for (const s of ['F', 'B']) slots = move(slots, (n) => n.startsWith(`foot_${s}.`), `thigh_${s}.skin`);
// the belt and hips go over the shirt or breastplate
slots = move(slots, (n) => n.startsWith('hip.'), 'torso.acc', true);

export const RIG_B: RigDef = {
  ...GOLDEN_RIG,
  id: 'warrior_b_v1',
  bones: GOLDEN_RIG.bones.map((b) => ({ ...b, ...(MEASURED[b.name] ?? {}) })),
  slots,
};
