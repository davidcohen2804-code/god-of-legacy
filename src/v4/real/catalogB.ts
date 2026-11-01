// Candidate B's wardrobe: the canonical basic clothing (set A) and the Golden Warrior set (set B), cut from the two
// parts sheets drawn for B, the sun-guard longsword and a test helmet. The head is layered: the face (body), the
// expressions (face item: blink, angry, hurt over the neutral face) and the hair (hair item, hidden by helmets). The
// body owns what every outfit shows: the face, the forearms with their leather bracers, and the fists.
import type { Catalog } from '../wardrobe/catalog';
import type { AttachSpec } from '../rig/types';
import type { Item, ItemPart, WardrobeSlot } from '../wardrobe/types';
import data from './assets/b.json';

/** One atlas frame: its rectangle and its pivot (normalised to the frame). */
export interface BFrame { name: string; x: number; y: number; w: number; h: number; px: number; py: number }
export const B_FRAMES: { 256: BFrame[]; 512: BFrame[] } = { 256: data.frames256, 512: data.frames512 };

/** The far limbs are the front side (F): the sword arm and the front leg, drawn slightly darker. */
const far = (side: 'F' | 'B') => (side === 'F' ? '_far' : '');
const part = (slot: string, frame: string): ItemPart => ({ slot, frame });
const HAND_STATES = ['relaxed', 'fist', 'grip', 'grip2', 'open'] as const;
/** A hand in every state (the corrective channel picks one); the grips also get the layer behind the handle. */
const hands = (look: 'basic' | 'gold' | 'ember', layer: 'skin' | 'glove') => sides((s) => [
  { slot: `hand_${s}.front.${layer}`, variants: Object.fromEntries(HAND_STATES.map((st) => [st, `b/${look}/hand_${st}${far(s)}`])) },
  { slot: `hand_${s}.back.${layer}`, variants: Object.fromEntries((look === 'basic' ? ['grip2'] : ['grip', 'grip2']).map((st) => [st, `b/${look}/hand_${st}_back${far(s)}`])) },
]);
const sides = (fn: (side: 'F' | 'B') => ItemPart[]): ItemPart[] => [...fn('B'), ...fn('F')];

/** The Golden tabard on the trousers' hip chain: hung under the belt buckle, straight down at rest (the approved
 *  silhouette); it trails a little when running or lunging, floats a little in a fall, a raised knee lifts it, and when
 *  the hips tip it keeps 60 % of its hanging direction (a heavy cloth, not a board). */
export const TABARD_ATTACH: AttachSpec = {
  chain: 'hipA', at: [0.0234, -0.0692], rest: 90, lens: [0.12, 0.126],
  k: 110, c: 13, gainV: [10, 6], gainZ: [7, 4], limit: 32, hang: 0.45, clearOf: ['thigh_F', 'thigh_B'], margin: 12, gravity: 0.6,
};

/** Lab-only stand-ins (test_standins.py, not a design): a plain long coat on every chain a coat uses, so the chains and
 *  the layering can be tested worn together with the trousers' chain (the Golden tabard) before the coat is drawn.
 *  Coat tails behind the legs (B), a near front panel clear of the near thigh (C), a far front panel between the legs
 *  clear of the far thigh (D), a sash end from the knot (E), a scarf end on the chest (N). */
export const COAT_TEST_ATTACH: AttachSpec = {
  chain: 'hipB', at: [-0.075, -0.06], rest: 108, lens: [0.13, 0.14],
  k: 70, c: 9, gainV: [24, 14], gainZ: [-16, -10], limit: 55, hang: 0.3, gravity: 0.7,
};
export const COAT_TEST_PIECES: AttachSpec[] = [
  COAT_TEST_ATTACH,
  { chain: 'hipC', at: [-0.03, -0.055], rest: 97, lens: [0.12, 0.13], k: 90, c: 11, gainV: [14, 8], gainZ: [8, 5], limit: 40, hang: 0.4, gravity: 0.6, clearOf: ['thigh_B'], margin: 10 },
  { chain: 'hipD', at: [0.075, -0.055], rest: 86, lens: [0.11, 0.11], k: 90, c: 11, gainV: [12, 7], gainZ: [8, 5], limit: 40, hang: 0.4, gravity: 0.6, clearOf: ['thigh_F'], margin: 10 },
  { chain: 'sashE', at: [0.07, -0.072], rest: 72, lens: [0.08, 0.1], k: 60, c: 7, gainV: [20, 12], gainZ: [10, 6], limit: 50, hang: 0.35, gravity: 0.8, clearOf: ['thigh_F'], margin: 16 },
  { chain: 'neckA', at: [-0.03, -0.19], rest: 165, lens: [0.075, 0.08], k: 50, c: 6, gainV: [30, 15], gainZ: [-20, -10], limit: 60, hang: 0.35, gravity: 0.3 },
];

/** The Ember Duelist's coat (the second premium set, concept v2): five pieces on their own chains, each with its anchor,
 *  rest angle (measured on the concept), springs and layer. The near front panel flares back over the near leg and is
 *  lifted by the near knee; the far panel hangs between the legs, clear of the far thigh; the split back tails hang
 *  behind the legs and trail furthest; the sash end hangs from the knot; the scarf's loose end flies back from the neck. */
export const EMBER_ATTACH: AttachSpec[] = [
  { chain: 'hipB', at: [-0.05, -0.05], rest: 96, lens: [0.13, 0.15], k: 70, c: 9, gainV: [22, 14], gainZ: [-14, -9], limit: 50, hang: 0.3, gravity: 0.7 },
  { chain: 'hipC', at: [-0.03, -0.055], rest: 120, lens: [0.13, 0.15], k: 85, c: 10, gainV: [14, 8], gainZ: [8, 5], limit: 40, hang: 0.4, gravity: 0.6, clearOf: ['thigh_B'], margin: 20 },
  { chain: 'hipD', at: [0.075, -0.045], rest: 82, lens: [0.11, 0.12], k: 85, c: 10, gainV: [12, 7], gainZ: [8, 5], limit: 40, hang: 0.4, gravity: 0.6, clearOf: ['thigh_F'], margin: 10 },
  { chain: 'sashE', at: [0.095, -0.07], rest: 67, lens: [0.1, 0.12], k: 60, c: 7, gainV: [18, 11], gainZ: [10, 6], limit: 45, hang: 0.35, gravity: 0.8, clearOf: ['thigh_F'], margin: 18 },
  { chain: 'neckA', at: [-0.088, -0.2], rest: 172, lens: [0.1, 0.12], k: 50, c: 6, gainV: [26, 14], gainZ: [-18, -10], limit: 55, hang: 0.35, gravity: 0.3 },
];

export function buildCatalogB(): Catalog {
  const items = new Map<string, Item>();
  const put = (it: Omit<Item, 'bodies'>): Item => { const full: Item = { ...it, bodies: ['male_std'] }; items.set(it.id, full); return full; };
  const body = put({
    id: 'b_body', wslot: 'body', name: 'Body (B)', set: 'base',
    parts: [
      part('head.skin', 'b/head_face'),
      ...sides((s) => [part(`forearm_${s}.skin`, `b/basic/forearm${far(s)}`)]), ...hands('basic', 'skin'),
    ],
  });
  const face = put({ id: 'b_face', wslot: 'face', name: 'Face (B)', set: 'base', parts: [{ slot: 'head.face', variants: { blink: 'b/face_blink', angry: 'b/face_angry', hurt: 'b/face_hurt' } }] });
  put({
    id: 'b_hair', wslot: 'hair', name: 'Hair (B)', set: 'base',
    // the hair, and the fringe's strand tips at the brows in each expression (the fringe slot follows the face channel)
    parts: [part('hair.top', 'b/hair'), { slot: 'hair.fringe', variants: { neutral: 'b/fringe_neutral', blink: 'b/fringe_blink', angry: 'b/fringe_angry', hurt: 'b/fringe_hurt' } }],
  });
  put({ id: 'b_gold_helm', wslot: 'head', name: 'Golden Warrior helmet (test)', set: 'B', hairCover: 'helm', parts: [part('head.over', 'b/helmet')] });
  for (const [look, set, label] of [['basic', 'A', 'Basic'], ['gold', 'B', 'Golden Warrior']] as const) {
    put({
      id: `b_${look}_top`, wslot: 'top', name: `${label} top`, set,
      parts: [
        part('torso.over', `b/${look}/torso`), ...sides((s) => [part(`uparm_${s}.over`, `b/${look}/uparm${far(s)}`)]),
        // joint caps (turned half as far as the limb): the near shoulder, both elbows
        part('uparm_B.cap', `b/${look}/uparm_cap`), part('forearm_B.cap', `b/${look}/elbow_cap`), part('forearm_F.cap', `b/${look}/elbow_cap_far`),
      ],
    });
    put({
      id: `b_${look}_bottom`, wslot: 'bottom', name: `${label} trousers`, set,
      parts: [
        part('hip.under', `b/${look}/hips`), ...(look === 'gold' ? [part('hipA.front', 'b/gold/tabard')] : []),
        // the trouser legs: the thighs and the cloth below the knee that goes into the boot
        ...sides((s) => [part(`thigh_${s}.over`, `b/${look}/thigh${far(s)}`), part(`shin_${s}.under`, `b/${look}/shin_under${far(s)}`)]),
      ],
      ...(look === 'gold' ? { attach: [TABARD_ATTACH] } : {}),
    });
    put({
      id: `b_${look}_shoes`, wslot: 'shoes', name: `${label} boots`, set,
      parts: sides((s) => [part(`shin_${s}.over`, `b/${look}/shin${far(s)}`), part(`foot_${s}.over`, `b/${look}/foot${far(s)}`)]),
      // the greaves cover the trousers' lower legs (the basic boots show them above the cuff)
      ...(look === 'gold' ? { hides: ['shin_F.under', 'shin_B.under'] } : {}),
    });
  }
  put({
    id: 'b_gold_gloves', wslot: 'gloves', name: 'Golden Warrior gauntlets', set: 'B',
    parts: [...sides((s) => [part(`forearm_${s}.over`, `b/gold/forearm${far(s)}`)]), ...hands('gold', 'glove')],
    hides: ['hand_F.front.skin', 'hand_B.front.skin', 'hand_F.back.skin', 'hand_B.back.skin'],
  });
  put({ id: 'b_gold_cape', wslot: 'back', name: 'Golden Warrior cape', set: 'B', parts: [part('cape.back.1', 'b/gold/cape_strip')] });
  // rule tests: the basic top with a plain stand-in coat on every coat chain and the waist slot (set X, lab only)
  put({
    id: 'b_test_coat', wslot: 'top', name: 'Coat stand-in (rule test)', set: 'X',
    parts: [
      ...items.get('b_basic_top')!.parts, part('hip.over', 'b/test/waist_sash'),
      part('hipB.back', 'b/test/coat_tail'), part('hipC.front', 'b/test/coat_panel_near'), part('hipD.mid', 'b/test/coat_panel_far'),
      part('sashE.front', 'b/test/sash_end'), part('neckA.scarf', 'b/test/scarf_end'),
    ],
    attach: COAT_TEST_PIECES,
  });
  put({ id: 'b_sun_sword', wslot: 'weapon', name: 'Sun-guard longsword', set: 'A', family: 'sword', parts: [part('weapon', 'b/sword')] });
  // the Ember Duelist (set C): a long split coat over slim trousers, riding boots, fingerless gloves
  put({
    id: 'b_ember_top', wslot: 'top', name: 'Ember Duelist coat', set: 'C',
    parts: [
      part('torso.over', 'b/ember/torso'), ...sides((s) => [part(`uparm_${s}.over`, `b/ember/uparm${far(s)}`)]),
      // the half-cape: a shoulder piece on the near shoulder's cap (turns half as far as the upper arm), never a cape
      part('uparm_B.cap', 'b/ember/halfcape'),
      // the elbow caps: the sleeve's elbow bracer, turned half as far as the forearm, over the crook of a bent arm
      part('forearm_B.cap', 'b/ember/elbow_cap'), part('forearm_F.cap', 'b/ember/elbow_cap_far'),
      // worn over the trousers: the sash, belt, ring, pouch and front flap
      part('hip.over', 'b/ember/waist'),
      part('hipB.back', 'b/ember/tails'), part('hipC.front', 'b/ember/panel_near'), part('hipD.mid', 'b/ember/panel_far'),
      part('sashE.front', 'b/ember/sash_end'), part('neckA.scarf', 'b/ember/scarf_end'),
    ],
    attach: EMBER_ATTACH,
  });
  put({
    id: 'b_ember_bottom', wslot: 'bottom', name: 'Ember Duelist trousers', set: 'C',
    parts: [part('hip.under', 'b/ember/hips'), ...sides((s) => [part(`thigh_${s}.over`, `b/ember/thigh${far(s)}`), part(`shin_${s}.under`, `b/ember/shin_under${far(s)}`)])],
  });
  put({
    id: 'b_ember_shoes', wslot: 'shoes', name: 'Ember Duelist riding boots', set: 'C',
    parts: sides((s) => [part(`shin_${s}.over`, `b/ember/shin${far(s)}`), part(`foot_${s}.over`, `b/ember/foot${far(s)}`)]),
  });
  put({
    id: 'b_ember_gloves', wslot: 'gloves', name: 'Ember Duelist gloves', set: 'C',
    // the bare forearm from the elbow to the wrist strap replaces the body's wrapped one; the fingerless gloves in the
    // hand standard's five states replace the bare hands
    parts: [...sides((s) => [part(`forearm_${s}.over`, `b/ember/forearm${far(s)}`)]), ...hands('ember', 'glove')],
    hides: ['forearm_F.skin', 'forearm_B.skin', 'hand_F.front.skin', 'hand_B.front.skin', 'hand_F.back.skin', 'hand_B.back.skin'],
  });
  return { items, art: new Map(), base: { body, face } };
}

/** Worn gameplay gear → B's looks. The job armour is an overall in Gear.ts; B shows it as the Golden top and trousers.
 *  The job helmet shows the test helmet. */
export const GEAR_LOOKS_B: Record<string, Partial<Record<WardrobeSlot, string>>> = {
  starter_sword: { weapon: 'b_sun_sword' }, starter_shirt: { top: 'b_basic_top' }, starter_pants: { bottom: 'b_basic_bottom' }, starter_boots: { shoes: 'b_basic_shoes' },
  warrior_job_sword: { weapon: 'b_sun_sword' }, warrior_job_helmet: { head: 'b_gold_helm' },
  warrior_job_armor: { top: 'b_gold_top', bottom: 'b_gold_bottom' }, warrior_job_boots: { shoes: 'b_gold_shoes' },
};

/** The full Golden Warrior set as cosmetics. */
export const GOLD_SET_B: Partial<Record<WardrobeSlot, string>> = { top: 'b_gold_top', bottom: 'b_gold_bottom', gloves: 'b_gold_gloves', shoes: 'b_gold_shoes', back: 'b_gold_cape' };

/** The full Ember Duelist set as cosmetics (no cape: the coat has its own tails and the scarf). */
export const EMBER_SET_B: Partial<Record<WardrobeSlot, string>> = { top: 'b_ember_top', bottom: 'b_ember_bottom', gloves: 'b_ember_gloves', shoes: 'b_ember_shoes' };
