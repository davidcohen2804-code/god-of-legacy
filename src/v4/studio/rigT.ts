// The body template's rig (template t1): the same bone tree as the lab's rigs, with every joint, length and rest angle
// measured on the template's base body drawing (assets/t1.json, written by tools/v4/studio/template_build.py and
// pack_t1.py), so the drawn shoulders, elbows, hips and knees are the skeleton's joints. The rest pose is the drawing's
// own pose (the template's source pose). Arms and legs are limb strips (one picture per limb, bent at the elbow / knee).
// The sword is held in the near hand (B): the weapon socket sits on hand_B; the far hand (F) has the off-hand socket.
import type { BoneDef, RigDef, SlotDef, WardrobeSlot } from '../rig/types';
import data from './assets/t1.json';

const R = data.rig;
const W = R.world as unknown as Record<string, number>;
const O = R.offsets as unknown as Record<string, [number, number]>;
const LEN = R.lengths as unknown as Record<string, number>;
const LIMB = R.limbs as unknown as Record<string, { top: number; bottom: number; bend: number }>;

const bone = (name: string, parent: string | null, x: number, y: number, r: number, len = 0): BoneDef => ({ name, parent, x, y, r, len });
const side = (s: 'B' | 'F'): BoneDef[] => [
  bone(`uparm_${s}`, 'chest', O[`uparm_${s}`][0], O[`uparm_${s}`][1], W[`uparm_${s}`], LEN[`uparm_${s}`]),
  bone(`forearm_${s}`, `uparm_${s}`, LEN[`uparm_${s}`], 0, W[`forearm_${s}`] - W[`uparm_${s}`], LEN[`forearm_${s}`]),
  bone(`hand_${s}`, `forearm_${s}`, LEN[`forearm_${s}`], 0, 0, R.hand_len),
  // the grip socket: the middle of the fist, pointing forward while the arm hangs
  bone(s === 'B' ? 'weapon' : 'offhand', `hand_${s}`, R.hand_len, 0, -90),
  bone(`thigh_${s}`, 'hip', O[`thigh_${s}`][0], O[`thigh_${s}`][1], W[`thigh_${s}`], LEN[`thigh_${s}`]),
  bone(`shin_${s}`, `thigh_${s}`, LEN[`thigh_${s}`], 0, W[`shin_${s}`] - W[`thigh_${s}`], LEN[`shin_${s}`]),
  bone(`foot_${s}`, `shin_${s}`, LEN[`shin_${s}`], 0, -W[`shin_${s}`], 0.1),
];

const BONES: BoneDef[] = [
  bone('root', null, 0, 0, 0),
  bone('hip', 'root', O.hip[0], O.hip[1], 0),
  bone('chest', 'hip', O.chest[0], O.chest[1], 0),
  bone('head', 'chest', O.head[0], O.head[1], 0),
  bone('hat', 'head', 0.01, -0.27, 0),
  // the spring chains every rig carries (a cape, long hair): no template item uses them yet
  bone('hair_1', 'head', -0.15, -0.23, 115, 0.085), bone('hair_2', 'hair_1', 0.085, 0, 0, 0.085), bone('hair_3', 'hair_2', 0.085, 0, 0, 0.08),
  bone('back', 'chest', -0.04, -0.16, 0),
  bone('cape_1', 'back', 0, 0, 95, 0.14), bone('cape_2', 'cape_1', 0.14, 0, 0, 0.14), bone('cape_3', 'cape_2', 0.14, 0, 0, 0.12),
  ...side('B'), ...side('F'),
];

const slot = (name: string, b: string, group: string, owner: WardrobeSlot, extra: Partial<SlotDef> = {}): SlotDef => ({ name, bone: b, group, owner, ...extra });
const limb = (s: 'B' | 'F', kind: 'arm' | 'leg') => {
  const L = LIMB[`${kind}_${s}`];
  return { bones: (kind === 'arm' ? [`uparm_${s}`, `forearm_${s}`] : [`thigh_${s}`, `shin_${s}`]) as [string, string], top: L.top, bottom: L.bottom, bend: L.bend };
};
const arm = (s: 'B' | 'F', group: string, grip: string): SlotDef[] => [
  slot(`arm_${s}.skin`, `uparm_${s}`, group, 'body', { limb: limb(s, 'arm') }),
  slot(`arm_${s}.sleeve`, `uparm_${s}`, group, 'top', { limb: limb(s, 'arm') }),
  // the hand: the palm behind a held handle, the held item, the fingers in front of it
  slot(`hand_${s}.back.skin`, `hand_${s}`, group, 'body', { channel: `hand${s}` }),
  slot(grip, grip, group, 'weapon'),
  slot(`hand_${s}.front.skin`, `hand_${s}`, group, 'body', { channel: `hand${s}` }),
];
const leg = (s: 'B' | 'F', group: string): SlotDef[] => [
  slot(`leg_${s}.skin`, `thigh_${s}`, group, 'body', { limb: limb(s, 'leg') }),
  slot(`foot_${s}.skin`, `foot_${s}`, group, 'body'),
  slot(`foot_${s}.shoe`, `foot_${s}`, group, 'shoes'),
  // the trouser leg over the shoe (the cuff rests on it)
  slot(`leg_${s}.cloth`, `thigh_${s}`, group, 'bottom', { limb: limb(s, 'leg') }),
];

// Draw order, back to front, for the 3/4 view facing right (turned toward the viewer): the far arm behind the body, the
// far leg, the near leg, the hips, the torso (the shirt's hem over the trousers), the head, then the near arm with the
// sword in front of everything (a raised sword arm passes in front of the head's near side).
const SLOTS: SlotDef[] = [
  ...arm('F', 'armF', 'offhand'),
  // the crotch filler: the cloth between the hip joints, behind both legs (it shows only when the legs part)
  slot('crotch.skin', 'hip', 'legF', 'body'), slot('crotch.cloth', 'hip', 'legF', 'bottom'),
  ...leg('F', 'legF'),
  ...leg('B', 'legB'),
  slot('pelvis.skin', 'hip', 'torso', 'body'), slot('pelvis.cloth', 'hip', 'torso', 'bottom'),
  slot('torso.skin', 'chest', 'torso', 'body'), slot('torso.cloth', 'chest', 'torso', 'top'),
  slot('head.skin', 'head', 'head', 'body'), slot('head.face', 'head', 'head', 'face', { channel: 'face' }),
  slot('hair.top', 'head', 'head', 'hair'), slot('hair.fringe', 'head', 'head', 'hair', { channel: 'face' }),
  ...arm('B', 'armB', 'weapon'),
];

const HANDS = ['relaxed', 'fist', 'grip', 'grip2', 'open'];
export const RIG_T: RigDef = {
  id: 'template_t1',
  B: 768,
  bones: BONES,
  slots: SLOTS,
  channels: {
    handB: ['grip', ...HANDS.filter((h) => h !== 'grip')],
    handF: ['relaxed', ...HANDS.filter((h) => h !== 'relaxed')],
    torso: ['rest', 'turn'],
    face: ['neutral', 'blink', 'angry', 'hurt'],
    footF: ['flat', 'toe'],
    footB: ['flat', 'toe'],
  },
};

/** The template's rest pose: world angles of the bones as drawn (for retargeting animations made on other rigs). */
export const REST_WORLD_T: Record<string, number> = W;
