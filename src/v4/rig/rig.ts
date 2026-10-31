// The Golden Warrior rig (placeholder lab version): 22 bones + 4 sockets, 66 draw slots in the fixed order of
// proposal section 5.1, each owned by exactly one wardrobe slot (section 11.2). Rest pose: standing, facing right.
import type { BoneDef, RigDef, SlotDef, WardrobeSlot } from './types';

const bone = (name: string, parent: string | null, x: number, y: number, r: number, len = 0): BoneDef => ({ name, parent, x, y, r, len });

const BONES: BoneDef[] = [
  bone('root', null, 0, 0, 0),
  bone('hip', 'root', 0, -0.32, 0), // pelvis centre at the hip joints (the crotch, 0.32 B above the ground)
  bone('chest', 'hip', 0, -0.10, 0), // the waist
  bone('head', 'chest', -0.012, -0.205, 0), // top of the neck
  bone('hat', 'head', 0.01, -0.37, 0), // socket at the skull top
  bone('hair_1', 'head', -0.15, -0.23, 115, 0.085),
  bone('hair_2', 'hair_1', 0.085, 0, 0, 0.085),
  bone('hair_3', 'hair_2', 0.085, 0, 0, 0.08),
  bone('back', 'chest', -0.075, -0.15, 0), // socket between the shoulder blades
  bone('cape_1', 'back', 0, 0, 95, 0.14),
  bone('cape_2', 'cape_1', 0.14, 0, 0, 0.14),
  bone('cape_3', 'cape_2', 0.14, 0, 0, 0.12),
  bone('wing_B', 'back', -0.01, -0.01, -150, 0.3),
  bone('wing_F', 'back', 0.01, -0.005, -138, 0.3),
  bone('uparm_B', 'chest', -0.06, -0.15, 90, 0.11),
  bone('forearm_B', 'uparm_B', 0.11, 0, 0, 0.1),
  bone('hand_B', 'forearm_B', 0.1, 0, 0, 0.07),
  bone('offhand', 'hand_B', 0.034, 0, -90),
  bone('uparm_F', 'chest', 0.03, -0.145, 90, 0.11),
  bone('forearm_F', 'uparm_F', 0.11, 0, 0, 0.1),
  bone('hand_F', 'forearm_F', 0.1, 0, 0, 0.07),
  bone('weapon', 'hand_F', 0.034, 0, -90), // socket in the fist: points forward while the arm hangs
  bone('thigh_B', 'hip', -0.04, 0, 90, 0.15),
  bone('shin_B', 'thigh_B', 0.15, 0, 0, 0.13),
  bone('foot_B', 'shin_B', 0.13, 0, -90, 0.1),
  bone('thigh_F', 'hip', 0.03, 0, 90, 0.15),
  bone('shin_F', 'thigh_F', 0.15, 0, 0, 0.13),
  bone('foot_F', 'shin_F', 0.13, 0, -90, 0.1),
];

const slot = (name: string, b: string, group: string, owner: WardrobeSlot, channel?: string): SlotDef => ({ name, bone: b, group, owner, ...(channel ? { channel } : {}) });

const limb = (side: 'F' | 'B', group: string, hand: boolean): SlotDef[] => {
  const ch = side === 'F' ? 'handF' : 'handB', grip = side === 'F' ? 'weapon' : 'offhand';
  return hand
    ? [
      slot(`uparm_${side}.skin`, `uparm_${side}`, group, 'body'), slot(`uparm_${side}.under`, `uparm_${side}`, group, 'top'), slot(`uparm_${side}.over`, `uparm_${side}`, group, 'top'),
      slot(`forearm_${side}.skin`, `forearm_${side}`, group, 'body'), slot(`forearm_${side}.under`, `forearm_${side}`, group, 'top'), slot(`forearm_${side}.over`, `forearm_${side}`, group, 'gloves'),
      slot(`hand_${side}.back.skin`, `hand_${side}`, group, 'body', ch), slot(`hand_${side}.back.glove`, `hand_${side}`, group, 'gloves', ch),
      slot(grip, grip, group, 'weapon'),
      slot(`hand_${side}.front.skin`, `hand_${side}`, group, 'body', ch), slot(`hand_${side}.front.glove`, `hand_${side}`, group, 'gloves', ch),
    ]
    : [
      slot(`thigh_${side}.skin`, `thigh_${side}`, group, 'body'), slot(`thigh_${side}.under`, `thigh_${side}`, group, 'bottom'), slot(`thigh_${side}.over`, `thigh_${side}`, group, 'bottom'),
      slot(`shin_${side}.skin`, `shin_${side}`, group, 'body'), slot(`shin_${side}.under`, `shin_${side}`, group, 'bottom'), slot(`shin_${side}.over`, `shin_${side}`, group, 'shoes'),
      slot(`foot_${side}.skin`, `foot_${side}`, group, 'body', `foot${side}`), slot(`foot_${side}.over`, `foot_${side}`, group, 'shoes', `foot${side}`),
    ];
};

const SLOTS: SlotDef[] = [
  // behind the body
  slot('cape.back.1', 'cape_1', 'behind', 'back'), slot('cape.back.2', 'cape_2', 'behind', 'back'), slot('cape.back.3', 'cape_3', 'behind', 'back'),
  slot('wing_B', 'wing_B', 'behind', 'back'), slot('wing_F', 'wing_F', 'behind', 'back'),
  slot('hair.back_up', 'head', 'behind', 'hair'), slot('hair.back_low', 'head', 'behind', 'hair'),
  slot('hair.chain.1', 'hair_1', 'behind', 'hair'), slot('hair.chain.2', 'hair_2', 'behind', 'hair'), slot('hair.chain.3', 'hair_3', 'behind', 'hair'),
  ...limb('B', 'armB', true),
  ...limb('B', 'legB', false),
  ...limb('F', 'legF', false),
  // pelvis and torso
  slot('hip.skin', 'hip', 'torso', 'body'), slot('torso.skin', 'chest', 'torso', 'body', 'torso'),
  slot('hip.under', 'hip', 'torso', 'bottom'), slot('torso.under', 'chest', 'torso', 'top', 'torso'),
  slot('hip.over', 'hip', 'torso', 'top'), slot('torso.over', 'chest', 'torso', 'top', 'torso'), slot('torso.acc', 'chest', 'torso', 'top', 'torso'),
  // head
  slot('head.skin', 'head', 'head', 'body'), slot('head.face', 'head', 'head', 'face', 'face'),
  slot('head.eyeacc', 'head', 'head', 'eyeacc'), slot('head.faceacc', 'head', 'head', 'faceacc'), slot('head.ear', 'head', 'head', 'earring'),
  slot('hair.side', 'head', 'head', 'hair'), slot('hair.top', 'head', 'head', 'hair'), slot('hair.fringe', 'head', 'head', 'hair'),
  slot('head.over', 'hat', 'head', 'head'),
  ...limb('F', 'armF', true),
  // front extras
  slot('cape.front', 'chest', 'front', 'back'), slot('hair.front_low', 'head', 'front', 'hair'),
];

export const GOLDEN_RIG: RigDef = {
  id: 'golden_warrior_lab_v1',
  B: 768,
  bones: BONES,
  slots: SLOTS,
  channels: {
    handF: ['grip', 'fist', 'relaxed', 'open'],
    handB: ['relaxed', 'fist', 'open', 'grip'],
    torso: ['rest', 'turn'],
    face: ['neutral', 'blink', 'angry', 'hurt'],
    footF: ['flat', 'toe'],
    footB: ['flat', 'toe'],
  },
};

/** Hair segments a hat's cover class hides (proposal section 4). */
export const HAIR_COVER: Record<string, string[]> = {
  none: [],
  cap: ['hair.top'],
  helm: ['hair.top', 'hair.side', 'hair.fringe', 'hair.back_up'],
  full: SLOTS.filter((s) => s.owner === 'hair').map((s) => s.name),
};
