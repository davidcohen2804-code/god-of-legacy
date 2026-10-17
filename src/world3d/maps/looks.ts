// The terrace builder's looks (one per kit): the light and sky, the stone's tints, what hangs over the parapets, the
// trees' crowns and what falls from them, the far ranges' colour, the life at night. Kit A golden hour and its crimson
// east, Kit B the Twilight Gardens, Kit D Sakura's golden-pink afternoon, Kit E Ironhold's hot red crags.
import * as THREE from 'three';
import type { SkyOpts } from '../kit/sky';

export type LookName = 'golden' | 'crimson' | 'dusk' | 'sakura' | 'ironhold';

export interface Look {
  /** The tiles' folder (public/assets/world3d/tex/<kit>) and the names of the paving / wall tiles in it. */
  kit: string; pavingTile: string; wallTile: string;
  /** The stand-in canvases' base colours: paving, wall. */
  pavingBase: [number, number, number]; wallBase: [number, number, number];
  sky: Omit<SkyOpts, 'cx' | 'cz' | 'soft'>;
  tint: { paving: number; wall: number; balustrade: number; moulding: number; roof: number; terracotta: number; wood: number; barkBase: [number, number, number]; bark: number; valley: number; mountains: number; mist: number; clouds?: number };
  /** What hangs over the parapets (ivy, wisteria, blossom, scrub); the planters' flowers. */
  ivy: string[]; flowers: [string, string, string];
  /** The crowns' colours, tint and inner glow; what falls (maple leaves or petals) and its colours. */
  crown: [string, string, string]; crownColor: number; crownEmissive: number; crownEmissiveIntensity: number;
  fall: { petal: boolean; size: [number, number]; hue: [number, number]; sat: [number, number]; light: [number, number]; emissive: number };
  /** Night: fireflies for butterflies, bats for birds, no banners (the lanterns are the light). */
  night?: boolean;
  /** Moss tile for the kit (dusk's ground under the roots). */
  moss?: boolean;
}

const sunA = new THREE.Vector3(0.55, 0.42, 0.72);
export const LOOKS: Record<LookName, Look> = {
  golden: {
    kit: 'island', pavingTile: 'sandstone_paving', wallTile: 'sandstone_wall', pavingBase: [222, 190, 142], wallBase: [212, 182, 138],
    sky: { sunFrom: sunA, sunColor: 0xffc27a, sunIntensity: 2.9, hemiSky: 0xffe2c8, hemiGround: 0x6a4a3a, hemiIntensity: 0.72, top: 0x46467e, mid: 0xcc7488, low: 0xffb862, background: 0xe0a888, fog: { color: 0xe6b494, near: 60, far: 150 }, exposure: 1.0 },
    tint: { paving: 0xf8e0c8, wall: 0xcfae86, balustrade: 0xf6ead4, moulding: 0xfaf0dc, roof: 0x9aa4c0, terracotta: 0xe8b090, wood: 0x4a3426, barkBase: [92, 66, 48], bark: 0xb09078, valley: 0x4a4458, mountains: 0x5a3e52, mist: 0xf6d8c8 },
    ivy: ['#b8341c', '#d9552a', '#e9893c', '#5a7a2a', '#7a9a3a', '#8a2a1a'], flowers: ['#e23a4a', '#f27a8a', '#5a7a2a'],
    crown: ['#d8552a', '#f0923a', '#8c2a1e'], crownColor: 0xffd0b0, crownEmissive: 0x4a1a0a, crownEmissiveIntensity: 0.45,
    fall: { petal: false, size: [0.11, 0.11], hue: [0.0, 0.09], sat: [0.65, 0.9], light: [0.42, 0.6], emissive: 0x301008 },
  },
  crimson: {
    kit: 'island', pavingTile: 'sandstone_paving', wallTile: 'sandstone_wall', pavingBase: [222, 190, 142], wallBase: [212, 182, 138],
    sky: { sunFrom: sunA, sunColor: 0xff9a6a, sunIntensity: 2.5, hemiSky: 0xd8a0a0, hemiGround: 0x4a2a30, hemiIntensity: 0.72, top: 0x3a2040, mid: 0xa8405a, low: 0xe8784a, background: 0xb86a64, fog: { color: 0xc26a5a, near: 34, far: 110 }, exposure: 1.0 },
    tint: { paving: 0xf8e0c8, wall: 0xa88478, balustrade: 0xf6ead4, moulding: 0xfaf0dc, roof: 0x9aa4c0, terracotta: 0xe8b090, wood: 0x4a3426, barkBase: [92, 66, 48], bark: 0xb09078, valley: 0x4a4458, mountains: 0x4a2a38, mist: 0xf6d8c8 },
    ivy: ['#8a1a14', '#b8241c', '#6a1010', '#c8402a', '#4a0a0a'], flowers: ['#e23a4a', '#f27a8a', '#5a7a2a'],
    crown: ['#d8552a', '#f0923a', '#8c2a1e'], crownColor: 0xffd0b0, crownEmissive: 0x4a1a0a, crownEmissiveIntensity: 0.45,
    fall: { petal: false, size: [0.11, 0.11], hue: [0.0, 0.09], sat: [0.65, 0.9], light: [0.42, 0.6], emissive: 0x301008 },
  },
  dusk: { // the sun just set: a rose-violet sky, the moon's cool light from the front-left, the lanterns' warmth the rest
    kit: 'twilight', pavingTile: 'stone_violet', wallTile: 'stone_violet', pavingBase: [168, 150, 178], wallBase: [150, 132, 162],
    sky: { sunFrom: new THREE.Vector3(-0.45, 0.72, 0.55), sunColor: 0xa8bcff, sunIntensity: 1.25, hemiSky: 0x9a84b8, hemiGround: 0x3a2e40, hemiIntensity: 1.0, top: 0x3e2c58, mid: 0x9a5a84, low: 0xe8a898, background: 0x6e4e74, fog: { color: 0x6a4c6e, near: 34, far: 100 }, exposure: 1.0 },
    tint: { paving: 0xd8ccdc, wall: 0xa898b0, balustrade: 0xcabed0, moulding: 0xd2c8d8, roof: 0x6a7490, terracotta: 0xa88898, wood: 0x3a2a26, barkBase: [58, 46, 44], bark: 0xb4a4ac, valley: 0x2a2438, mountains: 0x2e2244, mist: 0xb8a0c8, clouds: 0x8a6a98 },
    ivy: ['#8a6ab8', '#a98ad8', '#c4a8ee', '#6a4a98', '#5a7a4a', '#b89ae0'], flowers: ['#8a6ad0', '#b49af0', '#5a7a4a'],
    crown: ['#4e6e4a', '#5f805a', '#3a5a3c'], crownColor: 0xb8c4d8, crownEmissive: 0x0c1428, crownEmissiveIntensity: 0.35,
    fall: { petal: false, size: [0.08, 0.08], hue: [0.72, 0.79], sat: [0.45, 0.65], light: [0.6, 0.76], emissive: 0x1a0c30 },
    night: true, moss: true,
  },
  sakura: { // a mountain shrine at the day's golden-pink end: the sun from the left-front, blossom everywhere
    kit: 'sakura', pavingTile: 'moss_stone_steps', wallTile: 'fox_stone', pavingBase: [196, 186, 170], wallBase: [186, 176, 166],
    sky: { sunFrom: new THREE.Vector3(-0.5, 0.45, 0.72), sunColor: 0xffc89a, sunIntensity: 2.7, hemiSky: 0xffe0e8, hemiGround: 0x5a4a4a, hemiIntensity: 0.75, top: 0x6a5a9a, mid: 0xe8a0b8, low: 0xffd8a8, background: 0xf2c4c0, fog: { color: 0xf0c0c0, near: 40, far: 110 }, exposure: 1.0 },
    tint: { paving: 0xe8e0d8, wall: 0xc8bcb4, balustrade: 0xe4dcd4, moulding: 0xece6e0, roof: 0x5a6a80, terracotta: 0xd8b8a0, wood: 0x4a3426, barkBase: [70, 56, 50], bark: 0xa09088, valley: 0x5a4a60, mountains: 0x6a5278, mist: 0xfae0e4 },
    ivy: ['#ffc6d8', '#f59ab9', '#fff0f4', '#e88aa8', '#7aa05a'], flowers: ['#f59ab9', '#ffd0dc', '#6a9a4a'],
    crown: ['#ffc6d8', '#f59ab9', '#fff0f4'], crownColor: 0xffffff, crownEmissive: 0x4a1a2a, crownEmissiveIntensity: 0.5,
    fall: { petal: true, size: [0.085, 0.07], hue: [0.94, 0.98], sat: [0.6, 0.9], light: [0.7, 0.84], emissive: 0x3a1420 },
  },
  ironhold: { // red crags under a hot dusty sky, the sun from the right; pines, dry scrub, ash in the air
    kit: 'ironhold', pavingTile: 'red_ashlar', wallTile: 'crag_red_strata', pavingBase: [172, 138, 116], wallBase: [164, 100, 78],
    sky: { sunFrom: new THREE.Vector3(0.6, 0.5, 0.55), sunColor: 0xffb070, sunIntensity: 2.8, hemiSky: 0xe8c0a0, hemiGround: 0x4a2a20, hemiIntensity: 0.7, top: 0x5a4a6a, mid: 0xc08060, low: 0xf0b070, background: 0xd09870, fog: { color: 0xc89070, near: 40, far: 120 }, exposure: 1.0 },
    tint: { paving: 0xe4d4c4, wall: 0xc89078, balustrade: 0xd8c0b0, moulding: 0xe0ccbc, roof: 0x4a4a52, terracotta: 0xc89070, wood: 0x3a2a22, barkBase: [60, 44, 38], bark: 0xa08878, valley: 0x3a2a30, mountains: 0x5a3a3a, mist: 0xe0b0a0, clouds: 0xe8c0a8 },
    ivy: ['#8a7a3a', '#a08a40', '#6a5a2a', '#9a8a4a'], flowers: ['#b0a050', '#c8b860', '#6a6a30'],
    crown: ['#2e4a30', '#3a5a38', '#24402a'], crownColor: 0xd8e0d0, crownEmissive: 0x0a1a0a, crownEmissiveIntensity: 0.3,
    fall: { petal: false, size: [0.06, 0.06], hue: [0.05, 0.1], sat: [0.0, 0.1], light: [0.3, 0.5], emissive: 0x100808 },
  },
};
