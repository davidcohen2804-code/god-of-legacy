// Candidate B's rig: the Phase 1 rig with the same 22 bones, 4 sockets and corrective channels, so the resolver and the
// renderers carry over unchanged. Bone lengths and attachment points are the ones measured on B's cut parts
// (assets/b.json, written by the parts cutter); the draw order follows the approved illustration, plus three joint caps.
import { GOLDEN_RIG } from '../rig/rig';
import type { BoneDef, RigDef, SlotDef } from '../rig/types';
import data from './assets/b.json';

const G = data.geometry as unknown as Record<string, [number, number]>;
const L = data.lengths;

/** Offsets in the parent's rest frame and lengths, in B. Everything but the back socket is measured or packed. */
const MEASURED: Record<string, Partial<BoneDef>> = {
  hip: { x: G.hip[0], y: G.hip[1] },
  chest: { x: G.chest[0], y: G.chest[1] },
  head: { x: G.head[0], y: G.head[1] },
  hat: { x: G.hat[0], y: G.hat[1] }, // the helmet socket on the skull (the test helmet's frames pivot here)
  back: { x: -0.04, y: -0.16 }, // the cape's clasps: behind the neck, at shoulder height
  // the cape chain sized to the cape (0.40 B below its clasps), flaring back as the illustration's cape does at rest
  cape_1: { r: 104, len: 0.13 }, cape_2: { x: 0.13, r: 10, len: 0.13 }, cape_3: { x: 0.13, r: 8, len: 0.136 },
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

// Draw order, matched to the approved illustration. B stands in a 3/4 view facing right, turned toward the viewer, so the
// limbs on the back side (B) are the near ones and the sword arm and front leg (F) are the far ones: the far upper arm
// goes behind the torso while its forearm, fist and sword come forward in front; the near arm is drawn over the torso
// (under the head, so a raised arm never hides the face). Boots' feet go under the legs, the belt over the torso.
const G0 = GOLDEN_RIG.slots;
const group = (g: string) => G0.filter((s) => s.group === g);
const feetFirst = (list: SlotDef[]) => [...list.filter((s) => s.name.startsWith('foot_')), ...list.filter((s) => !s.name.startsWith('foot_'))];
const cap = (name: string, bone: string, grp: string): SlotDef => ({ name, bone, group: grp, owner: 'top', blend: 0.5 });
const armF = group('armF'), armB = group('armB');
const after = (list: SlotDef[], anchor: string, extra: SlotDef[]) => { const i = list.findIndex((s) => s.name === anchor) + 1; return [...list.slice(0, i), ...extra, ...list.slice(i)]; };
// Optional attachment chains on the hips (Phase 4): two short two-bone chains, idle and undrawn unless a worn item hangs a
// cloth piece on them and tunes them (AttachSpec: anchor, rest angle, lengths, spring, staying clear of the thighs).
// Chain A belongs to the trousers (the Golden tabard), chain B to the top (coat tails), so the two never share a
// motion curve. Each chain has a slot in front of the body and one behind the legs; the piece picks where it draws.
// Layering when both are worn: in front, the trousers' piece (hung from the belt) over the top's; behind the legs, the
// top's coat tails over the trousers' piece.
const ATTACH_BONES: BoneDef[] = [
  { name: 'hipA_1', parent: 'hip', x: 0, y: 0, r: 90, len: 0.12 }, { name: 'hipA_2', parent: 'hipA_1', x: 0.12, y: 0, r: 0, len: 0.12 },
  { name: 'hipB_1', parent: 'hip', x: 0, y: 0, r: 90, len: 0.12 }, { name: 'hipB_2', parent: 'hipB_1', x: 0.12, y: 0, r: 0, len: 0.12 },
];
const att = (name: string, chain: 'A' | 'B', grp: string): SlotDef => ({ name, bone: `hip${chain}_1`, group: grp, owner: chain === 'A' ? 'bottom' : 'top', strip: [`hip${chain}_1`, `hip${chain}_2`] });
const slots: SlotDef[] = [
  // the cape is one picture bent along the three cape bones
  ...group('behind').map((s) => (s.name === 'cape.back.1' ? { ...s, strip: ['cape_1', 'cape_2', 'cape_3'] } : s)),
  att('hipA.back', 'A', 'behind'), att('hipB.back', 'B', 'behind'),
  ...armF.filter((s) => s.name.startsWith('uparm_F.')).map((s) => ({ ...s, group: 'armFU' })),
  ...feetFirst(group('legF')),
  ...feetFirst(group('legB')),
  ...group('torso').filter((s) => !s.name.startsWith('hip.')), ...group('torso').filter((s) => s.name.startsWith('hip.')),
  // hung from the belt, over the hips and the tops of the thighs: the top's piece, then the trousers' (the Golden tabard)
  att('hipB.front', 'B', 'torso'), att('hipA.front', 'A', 'torso'),
  // the near arm, with caps that turn half as far as the limb: the shoulder piece and the elbow piece
  ...after(after(armB, 'uparm_B.over', [cap('uparm_B.cap', 'uparm_B', 'armB')]), 'forearm_B.over', [cap('forearm_B.cap', 'forearm_B', 'armB')]),
  // the fringe's strand tips at the brows differ per expression: that hair slot follows the face channel
  ...group('head').map((s) => (s.name === 'hair.fringe' ? { ...s, channel: 'face' } : s)),
  // the sword hand's palm layer and the sword form one group (gripF), so the blade can go behind the head with the palm
  // still behind the handle while the fingers stay in front
  ...after(armF.filter((s) => !s.name.startsWith('uparm_F.')), 'forearm_F.over', [cap('forearm_F.cap', 'forearm_F', 'armF')])
    .map((s) => (s.name.startsWith('hand_F.back.') || s.name === 'weapon' ? { ...s, group: 'gripF' } : s)),
  ...group('front'),
];

export const RIG_B: RigDef = {
  ...GOLDEN_RIG,
  // the hand standard adds the second hand of a two-handed grip
  channels: { ...GOLDEN_RIG.channels, handF: [...GOLDEN_RIG.channels.handF, 'grip2'], handB: [...GOLDEN_RIG.channels.handB, 'grip2'] },
  id: 'warrior_b_v1',
  bones: [...GOLDEN_RIG.bones.map((b) => ({ ...b, ...(MEASURED[b.name] ?? {}) })), ...ATTACH_BONES],
  slots,
  attach: { hipA: ['hipA_1', 'hipA_2'], hipB: ['hipB_1', 'hipB_2'] },
};
