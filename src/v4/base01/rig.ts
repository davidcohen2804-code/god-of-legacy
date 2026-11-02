// BASE-01's rig: the lab's bone tree with every joint, length and rest angle measured on the locked master drawing
// (assets/base01.json, written by tools/v4/base01/build.py + pack.py). The rest pose is the master's own reference
// stance. Arms and legs are limb strips (one picture per limb, bent at the elbow / knee); every item is cut to the same
// strips and pieces, so it bends exactly with the body under it. B = the near side (the character's right, image left,
// in front of the body); F = the far side (behind). The weapon is held in the near hand.
import type { BoneDef, RigDef, SlotDef, WardrobeSlot } from '../rig/types';
import data from './assets/base01.json';

const R = data.rig;
const W = R.world as unknown as Record<string, number>;
const O = R.offsets as unknown as Record<string, [number, number]>;
const LEN = R.lengths as unknown as Record<string, number>;
const LIMB = R.limbs as unknown as Record<string, { top: number; bottom: number; bend: number }>;
const HAND_LEN = { B: R.hand_len as number, F: (R as unknown as { hand_len_F: number }).hand_len_F };
/** Each fist's handle direction relative to its hand bone (degrees). */
export const GRIP_AXIS = (R as unknown as { grip_axis: Record<'B' | 'F', number> }).grip_axis;

const bone = (name: string, parent: string | null, x: number, y: number, r: number, len = 0): BoneDef => ({ name, parent, x, y, r, len });
const side = (s: 'B' | 'F'): BoneDef[] => [
  bone(`uparm_${s}`, 'chest', O[`uparm_${s}`][0], O[`uparm_${s}`][1], W[`uparm_${s}`], LEN[`uparm_${s}`]),
  bone(`forearm_${s}`, `uparm_${s}`, LEN[`uparm_${s}`], 0, W[`forearm_${s}`] - W[`uparm_${s}`], LEN[`forearm_${s}`]),
  bone(`hand_${s}`, `forearm_${s}`, LEN[`forearm_${s}`], 0, 0, HAND_LEN[s]),
  // the grip socket: through the middle of the fist along the handle the fist was drawn round, fixed to the hand (a
  // held weapon never turns about the fist; the wrist turns the hand and the weapon together)
  bone(s === 'B' ? 'weapon' : 'offhand', `hand_${s}`, HAND_LEN[s], 0, -GRIP_AXIS[s]),
  bone(`thigh_${s}`, 'hip', O[`thigh_${s}`][0], O[`thigh_${s}`][1], W[`thigh_${s}`], LEN[`thigh_${s}`]),
  bone(`shin_${s}`, `thigh_${s}`, LEN[`thigh_${s}`], 0, W[`shin_${s}`] - W[`thigh_${s}`], LEN[`shin_${s}`]),
  bone(`foot_${s}`, `shin_${s}`, LEN[`shin_${s}`], 0, -W[`shin_${s}`], 0.1),
];

const BONES: BoneDef[] = [
  bone('root', null, 0, 0, 0),
  bone('hip', 'root', O.hip[0], O.hip[1], 0),
  bone('chest', 'hip', O.chest[0], O.chest[1], 0),
  bone('head', 'chest', O.head[0], O.head[1], 0),
  bone('hat', 'head', 0, -0.3, 0),
  // the spring chains every rig carries (long hair, a cape): no BASE-01 item uses them yet
  bone('hair_1', 'head', -0.15, -0.25, 115, 0.085), bone('hair_2', 'hair_1', 0.085, 0, 0, 0.085), bone('hair_3', 'hair_2', 0.085, 0, 0, 0.08),
  bone('back', 'chest', -0.02, -0.12, 0),
  bone('cape_1', 'back', 0, 0, 95, 0.14), bone('cape_2', 'cape_1', 0.14, 0, 0, 0.14), bone('cape_3', 'cape_2', 0.14, 0, 0, 0.12),
  ...side('B'), ...side('F'),
];

const slot = (name: string, b: string, group: string, owner: WardrobeSlot, extra: Partial<SlotDef> = {}): SlotDef => ({ name, bone: b, group, owner, ...extra });
const limb = (s: 'B' | 'F', kind: 'arm' | 'leg') => {
  const L = LIMB[`${kind}_${s}`];
  return { bones: (kind === 'arm' ? [`uparm_${s}`, `forearm_${s}`] : [`thigh_${s}`, `shin_${s}`]) as [string, string], top: L.top, bottom: L.bottom, bend: L.bend };
};
// a shoulder plate: one rigid piece on the shoulder joint, turning a little over half as far as the upper arm (it rides
// the shoulder, the arm moves under it)
const pauldron = (s: 'B' | 'F', group: string): SlotDef => slot(`arm_${s}.pauldron`, `uparm_${s}`, group, 'top', { blend: 0.55 });
// an arm: the skin strip, the sleeve strip over it, the held item, the hand in front of the item (a fist round a handle)
const arm = (s: 'B' | 'F', group: string, grip: string): SlotDef[] => [
  slot(`arm_${s}.skin`, `uparm_${s}`, group, 'body', { limb: limb(s, 'arm') }),
  slot(`arm_${s}.sleeve`, `uparm_${s}`, group, 'top', { limb: limb(s, 'arm') }),
  // rigid plates (armor): the upper one turns with the upper arm, the lower one with the forearm; neither bends
  slot(`arm_${s}.plateU`, `uparm_${s}`, group, 'top'),
  slot(`arm_${s}.plateL`, `forearm_${s}`, group, 'top'),
  // the near shoulder plate over the arm's pieces (the far one is drawn over the chest, see SLOTS)
  ...(s === 'B' ? [pauldron('B', group)] : []),
  slot(grip, grip, group, 'weapon'),
  slot(`hand_${s}.skin`, `hand_${s}`, group, 'body', { channel: `hand${s}` }),
];
// a leg: the bare foot, the skin strip over it, the trouser leg, the shoe, a boot's shaft over the trouser leg, a
// loose trouser leg (a hakama, wide trousers) over the boot, and a coat's panel over all of it
const leg = (s: 'B' | 'F', group: string): SlotDef[] => [
  slot(`foot_${s}.skin`, `foot_${s}`, group, 'body'),
  slot(`leg_${s}.skin`, `thigh_${s}`, group, 'body', { limb: limb(s, 'leg') }),
  slot(`leg_${s}.cloth`, `thigh_${s}`, group, 'bottom', { limb: limb(s, 'leg') }),
  slot(`foot_${s}.shoe`, `foot_${s}`, group, 'shoes'),
  slot(`leg_${s}.shaft`, `thigh_${s}`, group, 'shoes', { limb: limb(s, 'leg') }),
  slot(`leg_${s}.over`, `thigh_${s}`, group, 'bottom', { limb: limb(s, 'leg') }),
  // a split coat's panel on this side: hangs from the hip joint, turns a little under half as far as the thigh (the
  // legs drive the panels apart) and swings a moment after it (at most 10 degrees behind)
  slot(`leg_${s}.tail`, `thigh_${s}`, group, 'top', { blend: 0.45, lag: 0.75, lagMax: 10 }),
];

// Draw order, back to front (the art director's layer order): the far arm, the far leg, the near leg, the hips (a skirt
// over both legs, under its waistband), the torso (a top's hem over the trousers), the head and hat, then the near arm
// with the weapon in front of everything.
const SLOTS: SlotDef[] = [
  ...arm('F', 'armF', 'offhand'),
  ...leg('F', 'legF'),
  ...leg('B', 'legB'),
  // the bare torso under the hips' piece (the belly carries on under a waistband), the trousers' waist over both, the
  // top over everything (an untucked hem)
  slot('torso.skin', 'chest', 'torso', 'body'), slot('pelvis.skin', 'hip', 'torso', 'body'),
  // a skirt (the art director's skirt garment profile): over both legs, under its own waistband (the hips' piece). It
  // hangs from the waistband and fans with both thighs: its edges as far as the thigh swung furthest each way (a thigh
  // lifted past 30 degrees lifts its edge an eighth as much again, and the cloth on that side rides up over it by 0.03 B
  // per radian), the cloth falling back a moment after them (75% of each frame's turn kept, at most 11 degrees behind)
  slot('pelvis.skirt', 'hip', 'torso', 'bottom', { skirt: { thighs: ['thigh_B', 'thigh_F'], from: 30, lift: 0.12, rise: 0.03, lag: 0.75, lagMax: 11 } }),
  slot('pelvis.cloth', 'hip', 'torso', 'bottom'),
  // the trousers' hidden underlap: over the belly, under the top (drawn only while a top is worn)
  slot('pelvis.under', 'hip', 'torso', 'bottom'),
  slot('torso.cloth', 'chest', 'torso', 'top'),
  // the far shoulder plate sits on the chest's far edge: over the chest, though its arm is behind it
  pauldron('F', 'torso'),
  slot('head.skin', 'head', 'head', 'body'), slot('head.hat', 'head', 'head', 'head'),
  ...arm('B', 'armB', 'weapon'),
];

export const RIG_B01: RigDef = {
  id: 'base01',
  B: 768,
  bones: BONES,
  slots: SLOTS,
  channels: {
    handB: ['open', 'grip'],
    handF: ['open', 'grip'],
    torso: ['rest', 'turn'],
    face: ['neutral', 'blink', 'angry', 'hurt'],
    footF: ['flat', 'toe'],
    footB: ['flat', 'toe'],
  },
};
