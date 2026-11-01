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
const hands = (look: 'basic' | 'gold', layer: 'skin' | 'glove') => sides((s) => [
  { slot: `hand_${s}.front.${layer}`, variants: Object.fromEntries(HAND_STATES.map((st) => [st, `b/${look}/hand_${st}${far(s)}`])) },
  { slot: `hand_${s}.back.${layer}`, variants: Object.fromEntries((look === 'gold' ? ['grip', 'grip2'] : ['grip2']).map((st) => [st, `b/${look}/hand_${st}_back${far(s)}`])) },
]);
const sides = (fn: (side: 'F' | 'B') => ItemPart[]): ItemPart[] => [...fn('B'), ...fn('F')];

/** The Golden tabard on the trousers' hip chain: hung under the belt buckle, straight down at rest (the approved
 *  silhouette); it trails a little when running or lunging, floats a little in a fall, and a raised knee lifts it. */
export const TABARD_ATTACH: AttachSpec = {
  chain: 'hipA', at: [0.0234, -0.0692], rest: 90, lens: [0.12, 0.126],
  k: 110, c: 13, gainV: [10, 6], gainZ: [7, 4], limit: 32, hang: 0.45, clearOf: ['thigh_F', 'thigh_B'], margin: 12,
};

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
  put({ id: 'b_sun_sword', wslot: 'weapon', name: 'Sun-guard longsword', set: 'A', family: 'sword', parts: [part('weapon', 'b/sword')] });
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
