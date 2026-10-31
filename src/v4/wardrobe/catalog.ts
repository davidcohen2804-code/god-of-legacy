// The lab's placeholder wardrobe: the body, one face (4 expressions), and items for every wearable slot in two sets
// (A = cloth, B = plate) plus oversized / rule-test items (X). Every shape is drawn on the body template: each part in
// its bone's space at rest, facing right, so items from different sets share one geometry by construction.
import { LINE, Painter, type Sty } from '../art/painter';
import type { Item, ItemPart } from './types';

const dk = (hex: string, f = 0.82): string => {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};
const st = (f: string, s: string, l?: string | null, lw?: number): Sty => ({ f, s, ...(l !== undefined ? { l } : {}), ...(lw ? { lw } : {}) });
const far = (x: Sty): Sty => ({ ...x, f: dk(x.f), ...(x.s ? { s: dk(x.s) } : {}) });

const SKIN = st('#f4d0aa', '#dca47f');
const HAIR_A = st('#b0682e', '#7c451b'), HAIR_B = st('#4d3a6e', '#2f2247');
const TUNIC = st('#4277bd', '#2d548c'), BELT = st('#6e4527', '#4a2c17'), GOLD = st('#e0b64c', '#a7822c');
const TROUSER = st('#6f4e34', '#4d3422'), SHOE = st('#5c3b24', '#3d2616'), WRAP = st('#a8763f', '#7a522a');
const RED = st('#c33c2e', '#8e2a20'), STEEL = st('#b2bdca', '#717e8f'), MAIL = st('#8b96a4', '#606a77');
const PAD = st('#474a5f', '#2f3142'), CAPE = st('#a12638', '#6d1625'), PURPLE = st('#62428f', '#432b68');
const SILVER = st('#dfe5ec', '#9aa4b0'), WHITE = st('#f6f6fb', '#c9cbe0'), WOOD = st('#8f5d2d', '#62401c'), BLADE = st('#d3dbe4', '#8f9bab');
const DARK = '#202430';

// ---- body template shapes (B units, relative to each bone's pivot, rest pose) ----
const HEAD = [0.02, -0.378, 0.15, -0.33, 0.192, -0.2, 0.17, -0.08, 0.12, -0.005, 0.06, 0.012, -0.06, -0.03, -0.15, -0.11, -0.163, -0.25, -0.09, -0.35];
const TORSO: Record<string, number[]> = {
  rest: [-0.09, 0, 0.085, 0, 0.112, -0.09, 0.105, -0.158, 0.06, -0.172, 0.036, -0.18, 0.036, -0.255, -0.052, -0.255, -0.054, -0.178, -0.11, -0.168, -0.148, -0.15, -0.125, -0.07],
  turn: [-0.08, 0, 0.1, 0, 0.135, -0.09, 0.13, -0.158, 0.08, -0.174, 0.042, -0.182, 0.04, -0.255, -0.048, -0.255, -0.05, -0.18, -0.095, -0.168, -0.125, -0.15, -0.105, -0.07],
};
const PELVIS = [-0.1, -0.11, 0.09, -0.11, 0.118, -0.03, 0.075, 0.035, -0.08, 0.035, -0.122, -0.03];
const FOOT: Record<string, number[]> = {
  flat: [-0.035, -0.015, 0, -0.022, 0.045, 0, 0.082, 0.018, 0.082, 0.04, -0.04, 0.04, -0.045, 0.01],
  toe: [-0.025, -0.03, 0.01, -0.03, 0.05, 0, 0.085, 0.022, 0.085, 0.042, 0.03, 0.04, -0.03, 0.015],
};
/** Scale points about (cx, cy). */
const grow = (pts: number[], sx: number, sy = sx, cx = 0, cy = 0) => pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * sx : cy + (v - cy) * sy));

const HANDS = ['relaxed', 'fist', 'open', 'grip'] as const;
/** A hand shape hanging from the wrist. The grip's handle crosses at y = 0.034 (the weapon socket). `g` enlarges a glove. */
function hand(p: Painter, pose: string, layer: 'back' | 'front', s: Sty, g = 1, plate = false): boolean {
  const k = (v: number) => v * g;
  if (layer === 'front') {
    if (pose !== 'grip') return false;
    p.rr(k(-0.027), 0.034 - k(0.019), k(0.057), k(0.038), k(0.014), s);
    for (const x of [-0.012, 0.003, 0.017]) p.line([k(x), 0.034 - k(0.015), k(x), 0.034 + k(0.015)], s.l ?? LINE, 4);
    if (plate) p.line([k(-0.024), 0.034, k(0.026), 0.034], DARK, 4);
    return true;
  }
  switch (pose) {
    case 'relaxed': p.ell(0, 0.036, k(0.027), k(0.038), s).ell(k(0.02), 0.022, k(0.012), k(0.02), s); break;
    case 'fist': p.ell(0, 0.033, k(0.031), k(0.031), s).line([k(-0.02), 0.05, k(0.02), 0.05], s.l ?? LINE, 4); break;
    case 'open':
      p.cap(k(-0.016), 0.04, k(-0.024), 0.076, k(0.008), s).cap(0, 0.045, 0, 0.082, k(0.008), s).cap(k(0.016), 0.04, k(0.024), 0.074, k(0.008), s)
        .ell(0, 0.028, k(0.029), k(0.03), s).cap(k(0.022), 0.02, k(0.045), 0.036, k(0.009), s);
      break;
    case 'grip': p.ell(k(-0.004), 0.034, k(0.031), k(0.032), s); break;
  }
  if (plate) p.line([k(-0.02), 0.012, k(0.02), 0.012], DARK, 4);
  return true;
}
function foot(p: Painter, pose: string, s: Sty, g = 1): void {
  p.poly(grow(FOOT[pose], g, g, 0.02, 0.012), s);
  if (g > 1) p.line([-0.045 * g, 0.036, 0.08 * g, 0.036], DARK, 5);
}

/** Expressions of the one lab face (drawn on the head, no outline of their own). */
function face(p: Painter, expr: string): void {
  const brow = '#5a3a2a', iris = st('#2f5d9e', '#1f3f73', null);
  const eye = (cx: number, cy: number, rx: number, ry: number) => {
    p.ell(cx, cy, rx, ry, { f: '#ffffff', l: LINE, lw: 6 })
      .ell(cx + rx * 0.15, cy + ry * 0.1, rx * 0.72, ry * 0.8, iris).dot(cx + rx * 0.2, cy + ry * 0.2, rx * 0.36, '#151a26').dot(cx - rx * 0.15, cy - ry * 0.3, rx * 0.26, '#ffffff')
      .line([cx - rx * 1.05, cy - ry * 0.85, cx, cy - ry * 1.12, cx + rx * 1.05, cy - ry * 0.8], LINE, 9);
  };
  if (expr === 'neutral' || expr === 'angry') { eye(0.045, -0.15, 0.033, 0.045); eye(0.135, -0.15, 0.02, 0.042); }
  if (expr === 'blink') { p.line([0.012, -0.15, 0.045, -0.136, 0.08, -0.15], LINE, 8).line([0.118, -0.15, 0.135, -0.139, 0.152, -0.15], LINE, 8); }
  if (expr === 'hurt') { p.line([0.015, -0.172, 0.06, -0.15, 0.015, -0.128], LINE, 8).line([0.155, -0.172, 0.118, -0.15, 0.155, -0.128], LINE, 8); }
  if (expr === 'angry') p.line([0.005, -0.245, 0.078, -0.205], brow, 9).line([0.108, -0.205, 0.162, -0.24], brow, 9).ell(0.115, -0.058, 0.024, 0.017, st('#6a2020', '#4a1414'));
  else p.line([0.015, -0.228, 0.072, -0.236], brow, 7).line([0.112, -0.232, 0.158, -0.226], brow, 7);
  if (expr === 'neutral' || expr === 'blink') p.line([0.1, -0.06, 0.13, -0.058], '#8a3a3a', 6);
  if (expr === 'hurt') p.line([0.095, -0.058, 0.108, -0.066, 0.12, -0.056, 0.132, -0.064], '#8a3a3a', 6);
}

export interface Catalog { items: Map<string, Item>; art: Map<string, Painter>; base: { body: Item; face: Item } }

export function buildCatalog(): Catalog {
  const art = new Map<string, Painter>();
  const items = new Map<string, Item>();
  const A = (name: string, draw: (p: Painter) => unknown): string => { const p = new Painter(); draw(p); art.set(name, p); return name; };
  const put = (it: Omit<Item, 'bodies'>) => { const full: Item = { ...it, bodies: ['male_std'] }; items.set(it.id, full); return full; };
  const part = (slot: string, f: string | Record<string, string>): ItemPart => (typeof f === 'string' ? { slot, frame: f } : { slot, variants: f });
  const variants = (keys: readonly string[], make: (k: string) => string | null): Record<string, string> =>
    Object.fromEntries(keys.map((k) => [k, make(k)]).filter(([, v]) => v !== null)) as Record<string, string>;
  const sides = (fn: (side: 'F' | 'B', s: (x: Sty) => Sty) => ItemPart[]): ItemPart[] => [...fn('B', far), ...fn('F', (x) => x)];

  // ---- the body ----
  const handParts = (id: string, base: Sty, g = 1, plate = false, slotLayer = 'skin'): ItemPart[] => sides((side, s) => (['back', 'front'] as const).map((layer) => {
    const v = variants(HANDS, (pose) => { const p = new Painter(); return hand(p, pose, layer, s(base), g, plate) ? (art.set(`${id}/hand_${side}.${layer}@${pose}`, p), `${id}/hand_${side}.${layer}@${pose}`) : null; });
    return part(`hand_${side}.${layer}.${slotLayer}`, v);
  }));
  const body = put({
    id: 'body_male', wslot: 'body', name: 'Body (male standard)', set: 'base',
    parts: [
      part('head.skin', A('body/head', (p) => p.poly(HEAD, SKIN).ell(-0.045, -0.165, 0.03, 0.044, SKIN).line([-0.052, -0.185, -0.04, -0.15], dk(SKIN.s!), 5))),
      part('torso.skin', variants(['rest', 'turn'], (v) => A(`body/torso@${v}`, (p) => p.poly(TORSO[v], SKIN).line([0.0, -0.165, 0.05, -0.16], dk(SKIN.s!), 5)))),
      part('hip.skin', A('body/hip', (p) => p.poly(PELVIS, SKIN))),
      ...sides((side, s) => [
        part(`uparm_${side}.skin`, A(`body/uparm_${side}`, (p) => p.cap(0, -0.025, 0, 0.115, 0.032, s(SKIN)))),
        part(`forearm_${side}.skin`, A(`body/forearm_${side}`, (p) => p.cap(0, -0.015, 0, 0.105, 0.028, s(SKIN)))),
        part(`thigh_${side}.skin`, A(`body/thigh_${side}`, (p) => p.cap(0, -0.03, 0, 0.155, 0.042, s(SKIN)))),
        part(`shin_${side}.skin`, A(`body/shin_${side}`, (p) => p.cap(0, -0.02, 0, 0.13, 0.033, s(SKIN)))),
        part(`foot_${side}.skin`, variants(['flat', 'toe'], (v) => A(`body/foot_${side}@${v}`, (p) => foot(p, v, s(SKIN))))),
      ]),
      ...handParts('body', SKIN),
    ],
  });
  const faceItem = put({
    id: 'face_a', wslot: 'face', name: 'Face A', set: 'base',
    parts: [part('head.face', variants(['neutral', 'blink', 'angry', 'hurt'], (v) => A(`face_a@${v}`, (p) => face(p, v))))],
  });

  // ---- hair ----
  put({
    id: 'hair_short', wslot: 'hair', name: 'Short spiky hair', set: 'A',
    parts: [
      part('hair.back_up', A('hair_short/back_up', (p) => p.poly([-0.2, -0.12, -0.19, -0.3, -0.1, -0.4, 0.02, -0.405, 0.1, -0.37, 0, -0.3, -0.08, -0.2, -0.12, -0.08], HAIR_A))),
      part('hair.side', A('hair_short/side', (p) => p.poly([-0.075, -0.3, -0.02, -0.28, 0, -0.18, -0.03, -0.115, -0.065, -0.16], HAIR_A))),
      part('hair.top', A('hair_short/top', (p) => p.poly([-0.17, -0.25, -0.15, -0.36, -0.06, -0.425, 0.02, -0.4, 0.1, -0.435, 0.16, -0.36, 0.2, -0.3, 0.17, -0.27, 0.06, -0.3, -0.05, -0.29], HAIR_A))),
      part('hair.fringe', A('hair_short/fringe', (p) => p.poly([0, -0.32, 0.08, -0.335, 0.19, -0.29, 0.2, -0.215, 0.15, -0.25, 0.12, -0.2, 0.08, -0.25, 0.04, -0.205, 0.01, -0.27], HAIR_A))),
    ],
  });
  const chainSeg = (len: number, r: number) => (p: Painter) => p.cap(0, 0, -len * 0.4226, len * 0.9063, r, HAIR_B); // along 115°
  put({
    id: 'hair_long', wslot: 'hair', name: 'Long hair with ponytail', set: 'B',
    parts: [
      part('hair.back_up', A('hair_long/back_up', (p) => p.poly([-0.21, -0.1, -0.2, -0.31, -0.1, -0.41, 0.03, -0.41, 0.11, -0.37, 0.0, -0.3, -0.08, -0.19, -0.11, -0.06], HAIR_B))),
      part('hair.back_low', A('hair_long/back_low', (p) => p.poly([-0.2, -0.2, -0.06, -0.22, -0.02, 0.05, -0.07, 0.16, -0.17, 0.18, -0.24, 0.05], HAIR_B))),
      part('hair.chain.1', A('hair_long/chain1', chainSeg(0.085, 0.03))),
      part('hair.chain.2', A('hair_long/chain2', chainSeg(0.085, 0.026))),
      part('hair.chain.3', A('hair_long/chain3', (p) => p.poly([0.02, -0.01, -0.03, 0.005, -0.045, 0.06, -0.045, 0.1, -0.02, 0.06, 0.01, 0.03], HAIR_B))),
      part('hair.side', A('hair_long/side', (p) => p.poly([-0.08, -0.31, -0.02, -0.29, 0.005, -0.15, -0.02, -0.04, -0.07, -0.12], HAIR_B))),
      part('hair.top', A('hair_long/top', (p) => p.poly([-0.17, -0.25, -0.16, -0.35, -0.07, -0.41, 0.04, -0.415, 0.13, -0.38, 0.19, -0.3, 0.16, -0.28, 0.05, -0.31, -0.06, -0.29], HAIR_B))),
      part('hair.fringe', A('hair_long/fringe', (p) => p.poly([0, -0.33, 0.1, -0.345, 0.2, -0.29, 0.205, -0.19, 0.17, -0.235, 0.13, -0.18, 0.1, -0.24, 0.05, -0.19, 0.01, -0.27], HAIR_B))),
      part('hair.front_low', A('hair_long/front_low', (p) => p.poly([-0.02, -0.232, 0.03, -0.226, 0.045, -0.05, 0.03, 0.07, 0.0, 0.0], HAIR_B))), // starts under a helmet's rim (head y −0.24)
    ],
  });

  // ---- headwear (pivot: the hat socket at the skull top) ----
  put({
    id: 'bandana_a', wslot: 'head', name: 'Red bandana', set: 'A', hairCover: 'cap',
    parts: [part('head.over', A('bandana_a/over', (p) => p.poly([-0.165, 0.13, -0.11, 0.02, 0, -0.025, 0.11, 0.0, 0.18, 0.09, 0.19, 0.15, 0.07, 0.105, -0.05, 0.115, -0.17, 0.17], RED)
      .ell(-0.18, 0.16, 0.03, 0.026, RED).poly([-0.19, 0.17, -0.25, 0.25, -0.22, 0.27, -0.17, 0.19], RED)))],
  });
  put({
    id: 'helmet_b', wslot: 'head', name: 'Steel helmet', set: 'B', hairCover: 'helm',
    parts: [part('head.over', A('helmet_b/over', (p) => p.poly([-0.178, 0.21, -0.172, 0.06, -0.1, -0.035, 0.02, -0.052, 0.135, -0.012, 0.195, 0.08, 0.205, 0.2, 0.15, 0.19, 0.125, 0.125, 0.0, 0.125, -0.09, 0.145, -0.12, 0.25], STEEL)
      .line([0.02, -0.05, 0.03, 0.125], DARK, 6).dot(-0.12, 0.12, 0.01, DARK).dot(0.15, 0.15, 0.01, DARK)))],
  });
  put({
    id: 'tall_hat_x', wslot: 'head', name: 'Tall hat (oversized test)', set: 'X', hairCover: 'cap',
    parts: [part('head.over', A('tall_hat_x/over', (p) => p.poly([-0.14, 0.07, -0.06, -0.15, 0.0, -0.36, 0.05, -0.4, 0.09, -0.33, 0.12, -0.1, 0.17, 0.07], PURPLE)
      .ell(0.015, 0.075, 0.26, 0.05, PURPLE).rr(-0.13, 0.0, 0.29, 0.05, 0.012, GOLD)))],
  });
  put({
    id: 'great_helm_x', wslot: 'head', name: 'Closed great helm (full cover test)', set: 'X', hairCover: 'full', hides: ['w:eyeacc', 'w:faceacc', 'w:earring'],
    parts: [part('head.over', A('great_helm_x/over', (p) => p.poly([-0.19, 0.39, -0.195, 0.1, -0.1, -0.035, 0.03, -0.055, 0.16, -0.01, 0.215, 0.1, 0.22, 0.3, 0.175, 0.405, 0.05, 0.425, -0.08, 0.42], STEEL)
      .rr(0.02, 0.205, 0.19, 0.03, 0.01, { f: DARK, l: null }).line([0.03, -0.05, 0.04, 0.42], dk(STEEL.s!), 6)))],
  });

  // ---- eye and face accessories, earrings (pivot: the head) ----
  const lens = { f: 'rgba(190,225,255,0.35)', l: '#222222', lw: 6 };
  put({
    id: 'glasses_a', wslot: 'eyeacc', name: 'Round glasses', set: 'A',
    parts: [part('head.eyeacc', A('glasses_a/eye', (p) => p.ell(0.047, -0.148, 0.04, 0.038, lens).ell(0.137, -0.148, 0.025, 0.036, lens)
      .line([0.087, -0.15, 0.112, -0.152], '#222222', 6).line([0.007, -0.155, -0.04, -0.165], '#222222', 6)))],
  });
  put({
    id: 'monocle_b', wslot: 'eyeacc', name: 'Monocle', set: 'B',
    parts: [part('head.eyeacc', A('monocle_b/eye', (p) => p.ell(0.047, -0.148, 0.042, 0.042, { f: 'rgba(255,240,200,0.25)', l: GOLD.f, lw: 8 }).line([0.012, -0.125, -0.03, -0.06, -0.025, 0.0], GOLD.s!, 5)))],
  });
  put({
    id: 'paint_a', wslot: 'faceacc', name: 'War paint', set: 'A',
    parts: [part('head.faceacc', A('paint_a/face', (p) => p.line([0.0, -0.1, 0.055, -0.092], RED.f, 11).line([0.008, -0.078, 0.06, -0.07], RED.f, 11)))],
  });
  put({
    id: 'mask_b', wslot: 'faceacc', name: 'Face mask', set: 'B',
    parts: [part('head.faceacc', A('mask_b/face', (p) => p.poly([0.0, -0.11, 0.17, -0.122, 0.198, -0.062, 0.14, 0.004, 0.06, 0.016, -0.02, -0.04], PAD).line([0.0, -0.1, -0.045, -0.15], DARK, 5)))],
  });
  put({
    id: 'ring_a', wslot: 'earring', name: 'Gold hoop', set: 'A',
    parts: [part('head.ear', A('ring_a/ear', (p) => p.ell(-0.045, -0.112, 0.013, 0.017, { f: 'rgba(0,0,0,0)', l: GOLD.f, lw: 8 })))],
  });
  put({
    id: 'cuff_b', wslot: 'earring', name: 'Silver ear cuff', set: 'B',
    parts: [part('head.ear', A('cuff_b/ear', (p) => p.rr(-0.072, -0.205, 0.03, 0.075, 0.012, SILVER).dot(-0.057, -0.14, 0.009, '#5ab0e0')))],
  });

  // ---- upper body (pivots: chest = waist, hip, upper arms, forearms) ----
  const TUNIC_SHAPE: Record<string, number[]> = {
    rest: [-0.1, 0.035, 0.095, 0.035, 0.122, -0.09, 0.116, -0.162, 0.06, -0.182, 0.02, -0.15, -0.03, -0.182, -0.115, -0.174, -0.158, -0.152, -0.135, -0.07],
    turn: [-0.09, 0.035, 0.11, 0.035, 0.145, -0.09, 0.14, -0.162, 0.08, -0.184, 0.035, -0.15, -0.02, -0.184, -0.1, -0.174, -0.135, -0.152, -0.115, -0.07],
  };
  put({
    id: 'tunic_a', wslot: 'top', name: 'Blue tunic', set: 'A', seams: { sleeve: 'short', tails: 'hip' },
    parts: [
      part('torso.under', variants(['rest', 'turn'], (v) => A(`tunic_a/torso@${v}`, (p) => p.poly(TUNIC_SHAPE[v], TUNIC).line([0.02, -0.15, 0.02, -0.06], dk(TUNIC.s!), 5)))),
      part('torso.acc', variants(['rest', 'turn'], (v) => A(`tunic_a/belt@${v}`, (p) => p.rr(v === 'turn' ? -0.095 : -0.105, -0.012, 0.215, 0.032, 0.008, BELT).rr(v === 'turn' ? 0.075 : 0.058, -0.009, 0.03, 0.026, 0.004, GOLD)))),
      part('hip.over', A('tunic_a/skirt', (p) => p.poly([-0.118, -0.105, 0.1, -0.105, 0.128, -0.02, 0.138, 0.045, -0.135, 0.045, -0.128, -0.02], TUNIC).line([-0.13, 0.03, 0.13, 0.03], dk(TUNIC.s!), 5))),
      ...sides((side, s) => [part(`uparm_${side}.under`, A(`tunic_a/sleeve_${side}`, (p) => p.cap(0, -0.03, 0, 0.068, 0.039, s(TUNIC))))]),
    ],
  });
  const PLATE_SHAPE: Record<string, number[]> = {
    rest: [-0.1, 0.005, 0.1, 0.005, 0.13, -0.09, 0.122, -0.155, 0.05, -0.17, -0.02, -0.16, -0.11, -0.164, -0.152, -0.142, -0.132, -0.06],
    turn: [-0.088, 0.005, 0.115, 0.005, 0.152, -0.09, 0.146, -0.155, 0.07, -0.172, -0.005, -0.16, -0.095, -0.164, -0.13, -0.142, -0.11, -0.06],
  };
  const plateTop = (id: string, name: string, set: 'B' | 'X', pauld: number) => put({
    id, wslot: 'top', name, set, seams: { sleeve: 'bulky', tails: 'hip' },
    parts: [
      part('torso.under', variants(['rest', 'turn'], (v) => A(`${id}/mail@${v}`, (p) => p.poly(grow(TUNIC_SHAPE[v], 1.0, 1.0), MAIL)))),
      part('torso.over', variants(['rest', 'turn'], (v) => A(`${id}/plate@${v}`, (p) => p.poly(PLATE_SHAPE[v], STEEL).line([v === 'turn' ? 0.04 : 0.025, -0.16, v === 'turn' ? 0.045 : 0.03, -0.01], dk(STEEL.s!), 7)
        .line([-0.1, -0.03, 0.1, -0.03], set === 'X' ? GOLD.f : dk(STEEL.s!), 6)))),
      part('hip.over', A(`${id}/faulds`, (p) => p.poly([-0.12, -0.1, 0.105, -0.1, 0.125, 0, 0.11, 0.062, -0.125, 0.062, -0.135, 0], STEEL).line([-0.13, -0.02, 0.12, -0.02], DARK, 5).line([-0.128, 0.025, 0.115, 0.025], DARK, 5))),
      ...sides((side, s) => [
        part(`uparm_${side}.under`, A(`${id}/mail_${side}`, (p) => p.cap(0, -0.03, 0, 0.1, 0.036, s(MAIL)))),
        part(`uparm_${side}.over`, A(`${id}/pauldron_${side}`, (p) => p.ell(0, 0.004, pauld * (side === 'B' ? 0.85 : 1), pauld * 0.76, s(STEEL)).line([-pauld * 0.8, 0.02, pauld * 0.8, 0.02], set === 'X' ? GOLD.f : DARK, 6))),
      ]),
    ],
  });
  plateTop('plate_top_b', 'Plate armour top', 'B', 0.058);
  plateTop('heavy_plate_x', 'Heavy plate, wide pauldrons (oversized test)', 'X', 0.1);
  put({
    id: 'robe_x', wslot: 'overall', name: 'Long robe (overall test)', set: 'X', seams: { sleeve: 'bulky', tails: 'knee' },
    parts: [
      part('torso.under', variants(['rest', 'turn'], (v) => A(`robe_x/torso@${v}`, (p) => p.poly(TUNIC_SHAPE[v], PURPLE).line([0.02, -0.15, 0.02, 0.03], GOLD.f, 7)))),
      part('hip.over', A('robe_x/skirt', (p) => p.poly([-0.125, -0.11, 0.11, -0.11, 0.142, 0.05, 0.182, 0.3, -0.172, 0.3, -0.148, 0.05], PURPLE).line([-0.17, 0.285, 0.18, 0.285], GOLD.f, 8))),
      ...sides((side, s) => [
        part(`uparm_${side}.under`, A(`robe_x/sleeve_${side}`, (p) => p.cap(0, -0.03, 0, 0.1, 0.044, s(PURPLE)))),
        part(`forearm_${side}.under`, A(`robe_x/cuff_${side}`, (p) => p.poly([-0.035, -0.02, 0.035, -0.02, 0.055, 0.1, -0.055, 0.1], s(PURPLE)))),
      ]),
    ],
  });

  // ---- lower body ----
  put({
    id: 'trousers_a', wslot: 'bottom', name: 'Brown trousers', set: 'A', seams: { hem: 'long' },
    parts: [
      part('hip.under', A('trousers_a/hip', (p) => p.poly([-0.105, -0.115, 0.095, -0.115, 0.123, -0.03, 0.08, 0.045, -0.085, 0.045, -0.127, -0.03], TROUSER))),
      ...sides((side, s) => [
        part(`thigh_${side}.under`, A(`trousers_a/thigh_${side}`, (p) => p.cap(0, -0.035, 0, 0.16, 0.047, s(TROUSER)))),
        part(`shin_${side}.under`, A(`trousers_a/shin_${side}`, (p) => p.cap(0, -0.02, 0, 0.105, 0.038, s(TROUSER)))),
      ]),
    ],
  });
  put({
    id: 'plate_legs_b', wslot: 'bottom', name: 'Padded legs with cuisses', set: 'B', seams: { hem: 'long' },
    parts: [
      part('hip.under', A('plate_legs_b/hip', (p) => p.poly([-0.105, -0.115, 0.095, -0.115, 0.123, -0.03, 0.08, 0.045, -0.085, 0.045, -0.127, -0.03], PAD))),
      ...sides((side, s) => [
        part(`thigh_${side}.under`, A(`plate_legs_b/thigh_${side}`, (p) => p.cap(0, -0.035, 0, 0.16, 0.048, s(PAD)))),
        part(`thigh_${side}.over`, A(`plate_legs_b/cuisse_${side}`, (p) => p.rr(-0.036, -0.005, 0.075, 0.13, 0.022, s(STEEL)).line([-0.03, 0.06, 0.035, 0.06], DARK, 5))),
        part(`shin_${side}.under`, A(`plate_legs_b/shin_${side}`, (p) => p.cap(0, -0.02, 0, 0.11, 0.038, s(PAD)))),
      ]),
    ],
  });

  // ---- gloves (every hand pose, both grip layers) ----
  const gloves = (id: string, name: string, set: 'A' | 'B', base: Sty, g: number, plate: boolean, cuff: string) => put({
    id, wslot: 'gloves', name, set, seams: { cuff },
    parts: [
      ...handParts(id, base, g, plate, 'glove'),
      ...sides((side, s) => [part(`forearm_${side}.over`, A(`${id}/cuff_${side}`, (p) => (plate
        ? p.poly([-0.038, 0.035, 0.038, 0.035, 0.05, 0.108, -0.05, 0.108], s(base)).line([-0.045, 0.07, 0.045, 0.07], DARK, 5)
        : p.cap(0, 0.068, 0, 0.098, 0.031, s(base)))))]),
    ],
  });
  gloves('wraps_a', 'Leather hand wraps', 'A', WRAP, 1.12, false, 'short');
  gloves('gauntlets_b', 'Steel gauntlets', 'B', STEEL, 1.22, true, 'gauntlet');

  // ---- footwear ----
  put({
    id: 'shoes_a', wslot: 'shoes', name: 'Leather shoes', set: 'A', seams: { shaft: 'low' },
    parts: sides((side, s) => [part(`foot_${side}.over`, variants(['flat', 'toe'], (v) => A(`shoes_a/foot_${side}@${v}`, (p) => foot(p, v, s(SHOE), 1.1))))]),
  });
  put({
    id: 'boots_b', wslot: 'shoes', name: 'Plate boots and greaves', set: 'B', seams: { shaft: 'tall' }, hides: ['foot_F.skin', 'foot_B.skin'],
    parts: sides((side, s) => [
      part(`foot_${side}.over`, variants(['flat', 'toe'], (v) => A(`boots_b/foot_${side}@${v}`, (p) => foot(p, v, s(STEEL), 1.14)))),
      part(`shin_${side}.over`, A(`boots_b/greave_${side}`, (p) => p.cap(0, -0.01, 0, 0.128, 0.041, s(STEEL)).ell(0, -0.012, 0.04, 0.03, s(STEEL)))),
    ]),
  });

  // ---- back (pivots: cape_1..3, wings, chest for the front piece) ----
  put({
    id: 'scarf_a', wslot: 'back', name: 'Short red scarf', set: 'A', seams: { collar: 'neck' },
    parts: [
      part('cape.back.1', A('scarf_a/back1', (p) => p.poly([-0.06, -0.03, 0.05, -0.03, 0.06, 0.1, -0.02, 0.14, -0.09, 0.1], RED))),
      part('cape.front', A('scarf_a/front', (p) => p.poly([-0.06, -0.215, 0.05, -0.215, 0.08, -0.17, 0.06, -0.15, -0.02, -0.16, -0.07, -0.18], RED).poly([0.04, -0.17, 0.082, -0.172, 0.092, -0.09, 0.062, -0.08], RED))),
    ],
  });
  put({
    id: 'cape_b', wslot: 'back', name: 'Long crimson cape', set: 'B', seams: { collar: 'shoulders' },
    parts: [
      part('cape.back.1', A('cape_b/back1', (p) => p.poly([-0.07, -0.025, 0.06, -0.025, 0.072, 0.155, -0.09, 0.155], CAPE))),
      part('cape.back.2', A('cape_b/back2', (p) => p.poly([-0.095, -0.02, 0.075, -0.02, 0.086, 0.155, -0.11, 0.155], CAPE))),
      part('cape.back.3', A('cape_b/back3', (p) => p.poly([-0.112, -0.02, 0.086, -0.02, 0.096, 0.13, -0.122, 0.13], CAPE).line([-0.12, 0.115, 0.094, 0.115], GOLD.f, 7))),
      part('cape.front', A('cape_b/front', (p) => p.poly([-0.05, -0.205, 0.04, -0.205, 0.09, -0.168, 0.05, -0.15, -0.04, -0.17], CAPE).ell(0.072, -0.165, 0.024, 0.024, GOLD))),
    ],
  });
  const wing = (s: number, dx: number) => (p: Painter) => {
    const pts = [0, 0, -0.1, -0.12, -0.25, -0.28, -0.42, -0.36, -0.5, -0.34, -0.38, -0.22, -0.44, -0.2, -0.33, -0.1, -0.38, -0.06, -0.22, 0, -0.1, 0.04].map((v, i) => (i % 2 === 0 ? v * s + dx : v * s));
    p.poly(pts, WHITE).line([-0.08 * s + dx, -0.06 * s, -0.42 * s + dx, -0.3 * s], dk(WHITE.s!), 6).line([-0.1 * s + dx, 0.0, -0.33 * s + dx, -0.08 * s], dk(WHITE.s!), 6);
  };
  put({
    id: 'wings_x', wslot: 'back', name: 'Large wings (oversized test)', set: 'X',
    parts: [part('wing_B', A('wings_x/wing_B', wing(0.95, -0.02))), part('wing_F', A('wings_x/wing_F', wing(1.08, 0.02)))],
  });

  // ---- weapons (pivot: the grip, pointing forward) ----
  put({
    id: 'sword_a', wslot: 'weapon', name: 'Iron sword', set: 'A', family: 'sword',
    parts: [part('weapon', A('sword_a/sword', (p) => p.poly([0.046, -0.016, 0.455, -0.016, 0.5, 0, 0.455, 0.016, 0.046, 0.016], BLADE, false).line([0.06, 0, 0.42, 0], dk(BLADE.s!), 5)
      .rr(-0.046, -0.009, 0.08, 0.018, 0.006, BELT).rr(0.032, -0.034, 0.016, 0.068, 0.006, GOLD).ell(-0.054, 0, 0.012, 0.012, GOLD)))],
  });
  put({
    id: 'sword_b', wslot: 'weapon', name: 'Golden greatsword', set: 'B', family: 'sword',
    parts: [part('weapon', A('sword_b/sword', (p) => p.poly([0.05, -0.024, 0.55, -0.024, 0.6, 0, 0.55, 0.024, 0.05, 0.024], st('#f1d27c', '#c29a3c'), false).line([0.07, 0, 0.52, 0], '#9a7428', 6)
      .rr(-0.05, -0.01, 0.088, 0.02, 0.007, PAD).poly([0.034, -0.05, 0.056, -0.05, 0.062, 0, 0.056, 0.05, 0.034, 0.05, 0.028, 0], GOLD).ell(-0.06, 0, 0.015, 0.015, st('#5ab0e0', '#2f7fb0'))))],
  });
  put({
    id: 'bow_x', wslot: 'weapon', name: 'Bow (wrong family test)', set: 'X', family: 'bow',
    parts: [part('weapon', A('bow_x/bow', (p) => p.poly([0.0, -0.3, 0.06, -0.2, 0.08, 0, 0.06, 0.2, 0.0, 0.3, 0.035, 0.2, 0.05, 0, 0.035, -0.2], WOOD).line([0.0, -0.3, -0.03, 0, 0.0, 0.3], '#e8e0c8', 4)))],
  });

  return { items, art, base: { body, face: faceItem } };
}

/** Gameplay gear (src/data/gear.json ids) → its v4 look. In production this is the optional look id on GearDef. */
export const GEAR_LOOKS: Record<string, string> = {
  starter_sword: 'sword_a', starter_shirt: 'tunic_a', starter_pants: 'trousers_a', starter_boots: 'shoes_a',
  warrior_job_sword: 'sword_b', warrior_job_helmet: 'helmet_b', warrior_job_armor: 'plate_top_b', warrior_job_boots: 'boots_b',
};
