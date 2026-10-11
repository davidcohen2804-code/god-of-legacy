// The PvP arena's living stage (visual only — nothing here touches the fight): far clouds and valley mist drifting
// behind the balustrade, flocks of birds (or bats) crossing the sky, rays from the sun (or the moon) sweeping slowly,
// light drifting over the floor, the floor's sun emblem glowing with light running round its rings, and the stage's
// weather — leaves, petals, snow, rain or fireflies (a few in front of the fighters), lightning in a storm. All in the
// map's pixels; the far layers are masked to the far background so they pass behind the balustrade and the arches.
// A stormy sea (the ship): the painting's water redrawn rolling on the GPU, its sails flapping, spray bursting, rain
// splashing on the planks, the lanterns flickering, a lighthouse beam turning, lightning bolts striking the sea.
import Phaser from 'phaser';

type Pt = [number, number];
export interface Fall { kind: 'leaf' | 'petal' | 'snow' | 'rain' | 'firefly' | 'ember'; n: number; tints: number[] }
/** A stage's look: where its far background, sun and floor emblem are, and its colours. */
export interface StageLook {
  /** The far background (sky, valley) as a polygon (or several): the clouds, mist and birds stay inside it. */
  far: Pt[] | Pt[][];
  /** The sky's band (clouds) and the valley's (mist), y ranges. */
  sky: [number, number];
  mist: [number, number];
  /** The mist fades in at its top and out at its bottom (a far background with no edge to end it behind). */
  mistSoft?: boolean;
  /** The sun (god rays fan from it, down to the left). */
  sun: Pt;
  /** The floor (its light drifts there): top y. */
  floorTop: number;
  /** The floor emblem: centre and its outer and inner rings' half axes (light runs round each). */
  emblem?: { c: Pt; outer: Pt; inner?: Pt };
  /** The emblem flares up at FIGHT! and at K.O. (and an aurora with it). */
  emblemFlash?: boolean;
  cloudTint: number;
  mistTint: number;
  lightTint: number;
  /** The light source's flare and rays: tint and strength (1 = the sunset's). */
  rayTint?: number;
  rays?: number;
  /** The light comes from the upper left (its rays fan down to the right). */
  sunLeft?: boolean;
  /** Who crosses the sky now and then. */
  fliers?: 'birds' | 'bats' | null;
  /** The weather: what falls or floats across the stage, how many, in which colours. */
  fall: Fall | Fall[];
  /** A storm: lightning flashes now and then. */
  lightning?: boolean;
  /** The emblem's light. */
  emblemTint?: number;
  /** Fires burning on the stage (braziers, torches): a flickering glow with sparks rising, at these points. */
  fires?: Pt[];
  /** Molten lava round the floor: its glow breathing and its light rolling slowly, everywhere but `keep` (the floor). */
  lava?: { tint: number; keep: Pt[] };
  /** A dragon in the far background (its two pictures loaded with the stage): its body ripples as it flies, its head
   *  watches the fight, breathes smoke now and then and rears up roaring at FIGHT! and at K.O. */
  dragon?: DragonLook;
  /** A living sea: the painting's water redrawn rolling (and its sails flapping) — see WaterLook. */
  water?: WaterLook;
  /** Lanterns: a warm glow flickering at each. */
  lamps?: Pt[];
  /** Where the sea breaks (on the swells, against the hull): spray bursts up there now and then. */
  spray?: Pt[];
  /** Where the rain splashes (the wet planks): small rings spreading on them all the time. */
  puddles?: Pt[][];
  /** A lighthouse: its lamp and its beam (a picture: the painted beam, pointing right from the lamp), turning round once
   *  every `period` ms — swinging out to either side, flaring when it faces the fight. */
  beacon?: { at: Pt; beam: string; period: number };
  /** The storm's bolts, with each flash: the painting's own bolt (a picture of its light, its top-left corner at `at`)
   *  or one drawn down the open sky (inside the x ranges, down to the horizon `to`). */
  bolts?: { img?: string; at?: Pt; x: [number, number][]; to: number };
  /** Crystals giving their own cold light: a glow breathing slowly at each (radius `r`). `front`: the painting's y of the
   *  front of what it is set in (a column) — drawn with it, so it hides behind it whoever it hides. */
  crystals?: { at: Pt; r: number; front?: number }[];
  /** Ice glinting: little stars of light twinkling all over these shapes (`n`: their share; `front` as for crystals). */
  glints?: { poly: Pt[]; n: number; front?: number }[];
  /** Frost mist lying low over the floor: the y band it drifts in. */
  floorMist?: [number, number];
}

/** A stage's living painting: `paint` the painting's texture, `mask` a picture of the same size — red where the painting
 *  is water, green where it is cloth (sails), blue where it is an aurora — and the sea's far edge (y): the swells grow
 *  toward the viewer from there. */
export interface WaterLook { paint: string; mask: string; horizon: number }

/** The painting's moving parts on the GPU: each water pixel drawn from a little way off (long swells rolling in, a choppy
 *  surface on them, bigger nearer), the crests catching the light as they pass, the foam glittering; each sail pixel
 *  drawn from a cloth flapping in the wind; an aurora's curtains swaying, waves of light running along them (brighter
 *  while uBoost is up). A pixel is only ever taken from its own kind: the ropes, the rails, the hull, the throne stay
 *  still. The phases come in already wrapped (no precision lost on a long match). Output premultiplied. */
const WATER_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 uRes;
uniform float uHorizon;
uniform float uP1;
uniform float uP2;
uniform float uP3;
uniform float uP4;
uniform float uP5;
uniform float uP6;
uniform float uP7;
uniform float uP8;
uniform float uP9;
uniform float uBoost;
varying vec2 outTexCoord;
void main() {
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec4 m = texture2D(iChannel1, uv);
  float w = m.r, c = m.g, au = m.b;
  if (w + c + au < 0.004) discard;
  vec2 px = uv * uRes;
  float near = clamp((px.y - uHorizon) / (uRes.y - uHorizon), 0.0, 1.0);
  float swell = sin(px.x * 0.011 + px.y * 0.045 - uP1);
  vec2 d = vec2(0.0);
  d.y += (1.0 + 5.0 * near) * swell * w;
  d.y += (0.5 + 2.2 * near) * sin(px.x * 0.031 - px.y * 0.02 + uP2) * w;
  d.x += (0.7 + 2.8 * near) * sin(px.y * 0.09 + px.x * 0.013 - uP3) * w;
  d.x += 2.6 * sin(px.y * 0.065 + px.x * 0.021 + uP4) * c;
  d.y += 1.4 * sin(px.x * 0.05 + uP5) * c;
  d.x += 6.0 * sin(px.y * 0.035 + px.x * 0.004 - uP7) * au;
  d.y += 2.5 * sin(px.x * 0.012 + uP8) * au;
  vec2 suv = uv + d / uRes;
  vec4 ms = texture2D(iChannel1, suv);
  float ok = au > max(w, c) ? step(0.3, ms.b) : w >= c ? step(0.45, ms.r) : step(0.45, ms.g);
  vec3 col = mix(texture2D(iChannel0, uv).rgb, texture2D(iChannel0, suv).rgb, ok);
  col *= 1.0 + 0.09 * swell * w;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += smoothstep(0.55, 0.9, lum) * w * 0.16 * (0.5 + 0.5 * sin(px.x * 0.07 + px.y * 0.05 + uP6));
  col *= 1.0 + au * (0.55 * (0.5 + 0.5 * sin(px.x * 0.022 - uP9 + 1.6 * sin(px.y * 0.03 + uP8))) + 0.9 * uBoost);
  float a = max(max(w, c), au);
  gl_FragColor = vec4(col * a, a);
}`;
/** The water's phases (uniform, radians per second). */
const WATER_PH: [string, number][] = [['uP1', 1.15], ['uP2', 1.9], ['uP3', 1.6], ['uP4', 4.4], ['uP5', 3.1], ['uP6', 3.0], ['uP7', 0.9], ['uP8', 0.6], ['uP9', 1.3]];

/** A stage's dragon: the body (a long picture, drawn along a line that ripples) and the head on its own, in the painting's
 *  pixels — the body's middle, scale and angle; the head's neck pivot (where it is on the painting and in its picture),
 *  scale, and its eye and nostril in its picture. It flies in front of the whole far background (the temple too) and
 *  behind `front`: the outlines of what stands nearer (the floor, the terrace, the pillars). */
export interface DragonLook {
  body: string; head: string;
  front: Pt[][];
  bodyAt: { x: number; y: number; s: number; angle: number };
  headAt: { x: number; y: number; s: number; pivot: Pt; eye: Pt; nostril: Pt };
}

/** The courtyard's far background (traced on the painting: above the balustrade, round its posts and the statue) —
 *  every painting of the courtyard shares its layout. */
const COURTYARD_FAR: Pt[] = [[336, 0], [336, 164], [390, 164], [391, 213], [547, 213], [547, 189], [560, 167], [572, 120], [575, 121], [586, 167], [601, 189], [601, 213], [757, 213], [779, 209], [779, 199], [793, 182], [798, 179], [816, 199], [816, 209], [841, 210], [841, 246], [1039, 246], [1040, 229], [1094, 229], [1095, 213], [1131, 213], [1131, 181], [1149, 167], [1159, 124], [1162, 125], [1171, 167], [1181, 181], [1181, 213], [1197, 213], [1194, 207], [1195, 193], [1190, 182], [1201, 152], [1206, 151], [1209, 146], [1218, 145], [1224, 131], [1232, 124], [1243, 129], [1252, 147], [1265, 153], [1274, 171], [1272, 213], [1366, 213], [1366, 179], [1385, 164], [1396, 128], [1399, 129], [1408, 162], [1421, 179], [1421, 207], [1499, 207], [1499, 0]];

/** Legacy Courtyard at sunset (assets/environment/Legacy_Courtyard.png). */
export const COURTYARD_LOOK: StageLook = {
  far: COURTYARD_FAR,
  sky: [0, 120],
  mist: [150, 262],
  sun: [1440, 15],
  floorTop: 262,
  emblem: { c: [904, 565], outer: [288, 122], inner: [92, 45] },
  cloudTint: 0xffd6c0,
  mistTint: 0xffe4d0,
  lightTint: 0xffc070,
  fliers: 'birds',
  fall: { kind: 'leaf', n: 16, tints: [0xc8281e, 0xe0501e, 0xa81c22, 0xf07a2a] },
};

/** The Sakura Temple (assets/environment/stages/sakura_temple.webp): a deck over a koi pond at sunset, the sun at the
 *  upper left; its far background is the valley between the pines and the waterfall's cliff, down to the red railing. */
export const SAKURA_LOOK: StageLook = {
  far: [[462, 0], [1088, 0], [1088, 30], [1040, 42], [1000, 36], [960, 46], [905, 40], [855, 56], [832, 90], [826, 150], [838, 168], [930, 172],
    [1005, 176], [1005, 224], [910, 224], [910, 206], [903, 194], [891, 194], [884, 206], [884, 224], [786, 224], [786, 206], [779, 194],
    [767, 194], [760, 206], [760, 224], [663, 224], [663, 206], [656, 194], [644, 194], [637, 206], [637, 224], [541, 224], [532, 172],
    [514, 122], [506, 64], [488, 22]],
  sky: [0, 70],
  mist: [140, 224],
  sun: [484, 5],
  sunLeft: true,
  floorTop: 285,
  cloudTint: 0xffd6e2,
  mistTint: 0xffe6ee,
  lightTint: 0xffc890,
  rayTint: 0xffd8b8,
  fliers: 'birds',
  fall: { kind: 'petal', n: 26, tints: [0xffc0d8, 0xffa8c8, 0xffd6e6, 0xf598b8] },
};

/** The Lava Fortress (assets/environment/stages/lava_fortress.webp): a stone platform over a lava lake inside a volcanic
 *  fortress — embers rising, smoke over the lava behind, bats, the braziers burning, the volcano glowing, the lava alive. */
export const LAVA_LOOK: StageLook = {
  far: [[0, 0], [1672, 0], [1672, 300], [1140, 292], [610, 292], [0, 300]],
  sky: [0, 60],
  mist: [180, 282],
  mistSoft: true,
  sun: [1222, 28],
  rays: 0,
  floorTop: 293,
  cloudTint: 0x4a2a28,
  mistTint: 0x9a6a58,
  lightTint: 0xff7a30,
  rayTint: 0xff5a1a,
  fliers: 'bats',
  fall: [{ kind: 'ember', n: 70, tints: [0xffb050, 0xff7a20, 0xffd890] }],
  fires: [[88, 15], [652, 38], [1250, 80], [1545, 52]],
  lava: { tint: 0xff8a2a, keep: [[610, 300], [1140, 300], [1380, 402], [1506, 606], [1352, 790], [382, 790], [220, 606], [360, 402]] },
};

/** The Shaolin Monastery (assets/environment/stages/shaolin_monastery.webp): high in the mountains at sunrise — the sun at the
 *  upper left, a sea of clouds either side, cranes, red leaves drifting, the temple's fires at its door, the courtyard's
 *  dragon emblem glowing gold. */
export const SHAOLIN_LOOK: StageLook = {
  far: [[0, 0], [1672, 0], [1672, 569], [1568, 434], [1345, 436], [1340, 277], [1300, 210], [1440, 200], [1440, 3], [535, 3], [535, 215],
    [447, 216], [411, 290], [408, 436], [175, 436], [0, 628]],
  sky: [0, 140],
  mist: [300, 440],
  mistSoft: true,
  sun: [70, 0],
  sunLeft: true,
  rays: 0.9,
  floorTop: 436,
  emblem: { c: [878, 673], outer: [380, 158], inner: [305, 128] },
  cloudTint: 0xffd8c0,
  mistTint: 0xfff0e0,
  lightTint: 0xffc070,
  rayTint: 0xffdca0,
  fliers: 'birds',
  fall: { kind: 'leaf', n: 14, tints: [0xc8281e, 0xe0501e, 0xf07a2a, 0xd8a040] },
  // the golden dragon round the monastery: its tail coiling through the clouds on the left, its head rising from the
  // clouds beside the courtyard on the right, watching the fight
  dragon: {
    body: 'shaolin-dragon-body', head: 'shaolin-dragon-head',
    front: [
      [[0, 628], [175, 436], [408, 436], [411, 290], [447, 216], [1300, 210], [1340, 277], [1345, 436], [1568, 434], [1672, 569], [1672, 941], [0, 941]],
      [[331, 377], [338, 368], [355, 362], [392, 360], [429, 362], [446, 368], [453, 377], [453, 500], [331, 500]],
      [[1294, 379], [1301, 370], [1318, 364], [1355, 361], [1392, 364], [1409, 370], [1416, 379], [1416, 500], [1294, 500]],
    ],
    bodyAt: { x: 288, y: 166, s: 0.8, angle: 6 },
    headAt: { x: 1560, y: 446, s: 0.775, pivot: [226, 537], eye: [133, 260], nostril: [84, 324] },
  },
};

/** The Storm Ship (assets/environment/stages/storm_ship.webp): a ship's deck at night in a storm — the sea rolling and
 *  breaking against the hull, the torn sails flapping, rain lashing the wet planks, the lanterns flickering, the
 *  lighthouse's beam turning on the rock behind, lightning striking the sea. Its far background: the open sky either side
 *  of the mast (round the sails and the shrouds), down over the horizon. */
export const SHIP_LOOK: StageLook = {
  far: [
    [[914, 176], [914, 282], [921, 287], [1470, 286], [1473, 0], [1031, 0], [1032, 10], [1023, 18], [1025, 36], [1014, 38], [1002, 31], [985, 55], [995, 102], [981, 104], [971, 94], [962, 94], [952, 100], [943, 118], [944, 132], [954, 149], [951, 166], [957, 194], [946, 195], [937, 185], [928, 184], [921, 172]],
    [[0, 230], [0, 253], [7, 257], [6, 265], [0, 267], [0, 287], [469, 287], [479, 282], [512, 287], [824, 286], [827, 0], [788, 0], [790, 9], [780, 31], [782, 42], [770, 46], [765, 54], [770, 70], [789, 81], [783, 95], [797, 112], [791, 123], [750, 109], [749, 101], [760, 82], [740, 70], [714, 65], [710, 76], [719, 93], [710, 97], [688, 85], [689, 68], [684, 60], [676, 61], [667, 75], [637, 79], [634, 65], [638, 52], [629, 43], [602, 47], [571, 66], [560, 66], [558, 57], [578, 0], [277, 0], [271, 8], [253, 4], [240, 12], [227, 10], [204, 28], [216, 39], [218, 58], [213, 65], [181, 64], [171, 74], [166, 102], [132, 103], [133, 114], [126, 122], [122, 144], [103, 142], [81, 151], [75, 166], [48, 199], [31, 197]],
    [[105, 0], [0, 0], [0, 160], [9, 164], [6, 177], [0, 179], [0, 202], [24, 172], [24, 158], [41, 136], [45, 120], [53, 115], [64, 82]],
  ],
  sky: [0, 150],
  mist: [208, 262],
  mistSoft: true,
  sun: [1398, 33],
  rays: 0.45,
  rayTint: 0xcfe0ff,
  floorTop: 400,
  cloudTint: 0x5a6478,
  mistTint: 0xb8c8e0,
  lightTint: 0x9fb8e8,
  fliers: null,
  fall: { kind: 'rain', n: 150, tints: [0xffffff, 0xcfe0ff] },
  lightning: true,
  water: { paint: 'stage-storm-ship', mask: 'ship-water', horizon: 238 },
  lamps: [[75, 412], [1166, 372], [1280, 612], [1624, 332], [1567, 382], [1634, 718]],
  spray: [[90, 330], [260, 320], [400, 330], [602, 300], [975, 300], [1040, 320], [1125, 330], [1372, 262], [24, 470], [41, 625], [103, 760], [72, 880]],
  puddles: [
    [[460, 444], [540, 428], [640, 424], [1150, 428], [1188, 406], [1336, 797], [1000, 797], [900, 795], [800, 789], [700, 781], [600, 769], [500, 753], [400, 729], [330, 708], [270, 686], [220, 661], [188, 632], [192, 600], [205, 562], [216, 522], [250, 498], [300, 481], [380, 465]],
    [[1190, 312], [1450, 306], [1672, 610], [1672, 640], [1335, 640]],
  ],
  beacon: { at: [1166, 91], beam: 'ship-beam', period: 9000 },
  bolts: { img: 'ship-bolt', at: [200, 0], x: [[250, 540], [1010, 1460]], to: 236 },
};

/** The Ice Palace (assets/environment/stages/ice_palace.webp): a throne hall of ice at night — the aurora swaying in the
 *  great window behind the throne, snow drifting through the hall, frost mist low over the floor, the crystals in the
 *  columns, the lamps and the throne breathing cold light, the ice glinting everywhere, the snowflake emblem glowing
 *  (flaring with the aurora at FIGHT! and at K.O.). Its far background: the great window, round the throne. */
const ICE_COLS: [number, number, number, number][] = [[205, 304, 440, 656], [331, 410, 380, 508], [414, 481, 320, 400], [1283, 1351, 330, 412], [1357, 1437, 390, 514], [1479, 1596, 450, 658]];
export const ICE_LOOK: StageLook = {
  far: [[590, 90], [590, 262], [775, 262], [775, 250], [772, 248], [772, 236], [783, 229], [781, 223], [781, 210], [787, 207], [792, 189], [794, 187], [799, 186], [802, 188], [809, 206], [809, 210], [815, 211], [815, 162], [817, 160], [817, 154], [820, 148], [821, 131], [817, 129], [824, 28], [827, 26], [830, 28], [836, 99], [839, 101], [847, 6], [850, 4], [853, 6], [858, 72], [860, 72], [874, 46], [877, 44], [882, 46], [894, 71], [897, 71], [897, 44], [899, 41], [901, 25], [905, 21], [910, 23], [912, 44], [914, 49], [913, 56], [915, 58], [915, 63], [912, 67], [914, 75], [914, 103], [916, 103], [920, 85], [919, 74], [924, 41], [928, 38], [933, 40], [937, 61], [936, 71], [938, 73], [936, 87], [940, 92], [938, 104], [942, 106], [940, 120], [943, 122], [943, 127], [940, 132], [942, 147], [940, 149], [941, 157], [939, 167], [939, 218], [941, 218], [942, 212], [944, 211], [952, 187], [955, 185], [959, 186], [962, 191], [966, 208], [968, 211], [974, 213], [971, 229], [981, 236], [982, 261], [1178, 262], [1178, 90], [1149, 58], [1135, 0], [640, 0], [625, 70]],
  sky: [0, 100],
  mist: [175, 262],
  mistSoft: true,
  sun: [1040, 50],
  rays: 0.3,
  rayTint: 0xa8ffe8,
  floorTop: 330,
  emblem: { c: [880, 660], outer: [331, 131] },
  emblemTint: 0x9fe0ff,
  emblemFlash: true,
  cloudTint: 0x3a4a78,
  mistTint: 0xd0e4ff,
  lightTint: 0x9fd0ff,
  fliers: null,
  fall: { kind: 'snow', n: 60, tints: [0xffffff, 0xe0f0ff, 0xc8e0ff] },
  water: { paint: 'stage-ice-palace', mask: 'ice-aurora', horizon: 0 },
  crystals: [
    // the columns' crystal crowns (drawn with their columns), the lamps on their stands, the wall sconces, the throne's
    { at: [251, 545], r: 62, front: 656 }, { at: [368, 435], r: 46, front: 508 }, { at: [445, 345], r: 36, front: 400 },
    { at: [1318, 355], r: 36, front: 412 }, { at: [1400, 436], r: 46, front: 514 }, { at: [1540, 546], r: 62, front: 658 },
    { at: [28, 305], r: 40 }, { at: [175, 272], r: 30 }, { at: [1631, 282], r: 40 },
    { at: [131, 140], r: 30 }, { at: [500, 128], r: 26 }, { at: [1258, 128], r: 26 },
    { at: [797, 205], r: 24 }, { at: [952, 205], r: 24 }, { at: [876, 165], r: 34 },
  ],
  glints: [
    { poly: [[0, 700], [500, 452], [1260, 452], [1672, 700], [1672, 880], [0, 880]], n: 6 },
    { poly: [[823, 50], [941, 50], [941, 320], [823, 320]], n: 1 },
    ...ICE_COLS.map(([x0, x1, y1, front]) => ({ poly: [[x0, 20], [x1, 20], [x1, y1], [x0, y1]] as Pt[], n: 1, front })),
  ],
  floorMist: [330, 520],
};

const T = { cloud: 'sfx-cloud', mist: 'sfx-mist', ray: 'sfx-ray', glow: 'sfx-glow', light: 'sfx-light', ring: 'sfx-ring', leaf: 'sfx-leaf', petal: 'sfx-petal', drop: 'sfx-drop', dot: 'sfx-dot', bird: 'sfx-bird', bat: 'sfx-bat', splash: 'sfx-splash', star: 'sfx-star' };
const BIRD_FRAMES = 4;

function rng(seed: number): () => number { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const inPoly = (x: number, y: number, poly: readonly Pt[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Several polygons, or one. */
const polys = (p: Pt[] | Pt[][]): Pt[][] => (Array.isArray(p[0]?.[0]) ? p as Pt[][] : [p as Pt[]]);

function makeTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  const canvas = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    if (tx.exists(key)) return;
    const c = tx.createCanvas(key, w, h)!; draw(c.getContext()); c.refresh();
  };
  const blob = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  canvas(T.cloud, 512, 220, (g) => { const r = rng(11); for (let i = 0; i < 16; i++) blob(g, 90 + r() * 330, 80 + r() * 70, 50 + r() * 70, 30 + r() * 40, 0.35 + r() * 0.35); });
  canvas(T.mist, 1024, 200, (g) => { // tileable across: every blob drawn again a tile to either side
    const r = rng(5);
    for (let i = 0; i < 26; i++) { const x = r() * 1024, y = 60 + r() * 90, rx = 90 + r() * 160, ry = 26 + r() * 40, a = 0.25 + r() * 0.35; for (const o of [-1024, 0, 1024]) blob(g, x + o, y, rx, ry, a); }
  });
  canvas(T.light, 512, 512, (g) => { // tileable warm patches for the floor
    const r = rng(23);
    for (let i = 0; i < 10; i++) { const x = r() * 512, y = r() * 512, rad = 60 + r() * 110, a = 0.5 + r() * 0.5; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) blob(g, x + ox, y + oy, rad, rad, a); }
  });
  canvas(T.ray, 128, 1024, (g) => { // a soft shaft: bright core, fading in from the sun and out toward its end
    const gx = g.createLinearGradient(0, 0, 128, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx; g.fillRect(0, 0, 128, 1024);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, 1024);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.08, 'rgba(0,0,0,1)'); gy.addColorStop(0.55, 'rgba(0,0,0,.55)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy; g.fillRect(0, 0, 128, 1024);
  });
  canvas(T.glow, 256, 256, (g) => blob(g, 128, 128, 128, 128, 1));
  canvas(T.ring, 512, 512, (g) => { // a bright arc with a fading tail, on a circle of radius 240
    const n = 90;
    for (let i = 0; i < n; i++) {
      const a0 = (-i / n) * Math.PI * 0.75, a1 = (-(i + 1.2) / n) * Math.PI * 0.75, k = 1 - i / n;
      g.strokeStyle = `rgba(255,255,255,${(k * k).toFixed(3)})`; g.lineWidth = 3 + 9 * k; g.lineCap = 'round';
      g.beginPath(); g.arc(256, 256, 240, a1, a0); g.stroke();
    }
  });
  canvas(T.leaf, 34, 20, (g) => { // a small pointed leaf with a vein
    g.translate(17, 10); g.beginPath(); g.moveTo(-15, 0); g.quadraticCurveTo(-4, -10, 15, 0); g.quadraticCurveTo(-4, 10, -15, 0); g.closePath();
    const gr = g.createLinearGradient(0, -9, 0, 9); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b8b8b8');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(80,80,80,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.stroke();
  });
  canvas(T.petal, 22, 18, (g) => { // a rounded petal with a notch
    g.translate(11, 9); g.beginPath(); g.moveTo(-9, 0); g.bezierCurveTo(-8, -9, 6, -9, 9, -2); g.lineTo(6, 0); g.lineTo(9, 2); g.bezierCurveTo(6, 9, -8, 9, -9, 0); g.closePath();
    const gr = g.createLinearGradient(-9, 0, 9, 0); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fill();
  });
  canvas(T.drop, 4, 48, (g) => { // a rain streak
    const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(1, 0, 2, 48);
  });
  canvas(T.dot, 32, 32, (g) => blob(g, 16, 16, 16, 16, 1)); // a soft dot: snow, a firefly, an ember
  canvas(T.star, 64, 64, (g) => { // a glint: four thin points of light round a soft bright heart
    blob(g, 32, 32, 9, 9, 1);
    for (const [w, h] of [[2.2, 30], [30, 2.2]]) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(32, 32, w, h, 0, 0, Math.PI * 2); g.fill();
    }
  });
  canvas(T.splash, 64, 64, (g) => { // a raindrop's ring on a puddle (drawn round, laid flat on the floor)
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.stroke();
  });
  for (let f = 0; f < BIRD_FRAMES; f++) canvas(`${T.bat}${f}`, 44, 24, (g) => { // a bat: scalloped wings, four beats
    const lift = [-8, -2, 6, -2][f];
    g.translate(22, 12); g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(s * 10, lift - 4, s * 20, lift);
      g.quadraticCurveTo(s * 16, lift + 3, s * 14, lift + 6); g.quadraticCurveTo(s * 10, lift + 3, s * 8, lift + 7); g.quadraticCurveTo(s * 5, lift + 3, 0, 4); g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(0, 1.5, 3, 3.6, 0, 0, Math.PI * 2); g.fill();
  });
  for (let f = 0; f < BIRD_FRAMES; f++) canvas(`${T.bird}${f}`, 44, 24, (g) => { // a far bird's silhouette, wings at four beats
    const lift = [-9, -3, 5, -3][f], tip = [-11, -1, 8, -1][f];
    g.translate(22, 12); g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 9, lift - 2, s * 20, tip); g.quadraticCurveTo(s * 10, lift + 4, 0, 3); g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(0, 1.5, 4, 2.4, 0, 0, Math.PI * 2); g.fill();
  });
}

interface Drifter { o: Phaser.GameObjects.Image; vx: number; vy: number; w: number; spin?: number; sway?: number; ph?: number; a?: number; kind?: Fall['kind'] }
interface Bird { o: Phaser.GameObjects.Image; vx: number; vy: number; t: number; fps: number }

export class StageFx {
  /** Layers by depth, each placed (and scaled) like the painting in the world: everything inside is in its pixels. */
  private layers = new Map<number, Phaser.GameObjects.Container>();
  private lay(depth: number): Phaser.GameObjects.Container {
    let c = this.layers.get(depth);
    if (!c) { c = this.scene.add.container(this.at.x, this.at.y).setScale(this.at.s).setDepth(depth); this.layers.set(depth, c); }
    return c;
  }
  /** The depth (in the world) just in front of a thing whose front edge is at this y of the painting (a prop's cut-out
   *  is drawn at its front edge's depth): what is drawn there shows on it and hides with it. */
  private depthAt(py: number): number { return this.at.y + py * this.at.s + 0.02; }
  /** Its layers (all of them placed like the painting): a camera pitch squashes them with the floor. */
  layerList(): Phaser.GameObjects.Container[] { return [...this.layers.values()]; }
  private far: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.TileSprite;
  private farMask: Phaser.GameObjects.Graphics;
  private clouds: Drifter[] = [];
  private mists: { o: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private birds: Bird[] = [];
  private nextFlock = 2500;
  private rays: { o: Phaser.GameObjects.Image; a: number; al: number; p: number; ph: number }[] = [];
  private flare: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.TileSprite;
  private glow?: Phaser.GameObjects.Image;
  private sweeps: { box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; v: number }[] = [];
  private leaves: Drifter[] = [];
  private flash?: Phaser.GameObjects.Rectangle;
  private fires: { glow: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; sparks: Drifter[]; at: Pt; ph: number }[] = [];
  private lava?: Phaser.GameObjects.TileSprite;
  private dragon?: {
    body: Phaser.GameObjects.Rope; pts: Phaser.Math.Vector2[]; head: Phaser.GameObjects.Container; eye: Phaser.GameObjects.Image;
    look: number; roar: number; puff: number; smoke: { o: Phaser.GameObjects.Image; vx: number; vy: number; t: number; life: number }[];
    flash: Phaser.GameObjects.Rectangle; box: Phaser.GameObjects.Container; D: DragonLook;
  };
  private nextBolt = 6000;
  private bolt = -1;
  /** Told of the stage's own moments (the arena's sound answers: thunder after a bolt, the dragon's roar, the aurora). */
  onEvent?: (kind: 'bolt' | 'roar' | 'flare') => void;
  /** The storm's sea and what lives on the ship's deck (see StageLook.water and the rest). */
  private water?: Phaser.GameObjects.Shader;
  private lamps: { glow: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; ph: number }[] = [];
  private spray: { o: Phaser.GameObjects.Image; vx: number; vy: number; g: number; t: number; life: number; a: number; grow: number }[] = [];
  private nextSpray = 700;
  private rings: { o: Phaser.GameObjects.Image; t: number; life: number; s: number }[] = [];
  private ringPool: Phaser.GameObjects.Image[] = [];
  private nextRing = 0;
  private beacon?: { beam: Phaser.GameObjects.Image; lamp: Phaser.GameObjects.Image; flare: Phaser.GameObjects.Image; period: number };
  /** This flash's bolt: the painting's own, or one drawn down the sky. */
  private boltImg?: Phaser.GameObjects.Image;
  private boltGfx?: Phaser.GameObjects.Graphics;
  private boltOn?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  /** The ice: crystals breathing light, glints twinkling (a pool, in the layers of what they sit on), the floor's mist. */
  private crystals: { o: Phaser.GameObjects.Image; a: number; p: number; ph: number }[] = [];
  private glints: { o: Phaser.GameObjects.Image; t: number; life: number; s: number }[] = [];
  private glintPool = new Map<number, Phaser.GameObjects.Image[]>();
  private glintAt: { poly: Pt[]; box: [number, number, number, number]; depth: number; w: number }[] = [];
  private nextGlint = 0;
  private floorMists: { o: Phaser.GameObjects.TileSprite; v: number }[] = [];
  /** The emblem's flare (ms since FIGHT! / K.O.; -1: none). */
  private flare2 = -1;
  private t = 0;
  private readonly W: number;
  private readonly H: number;

  /** W x H: the painting's size; `at`: where it is in the world and how much bigger it is shown there. */
  constructor(private scene: Phaser.Scene, private look: StageLook, W: number, H: number, private at = { x: 0, y: 0, s: 1 }) {
    makeTextures(scene);
    this.W = W; this.H = H;
    const L = look, r = rng(3);
    // the far background: clouds, mist and birds, behind the balustrade and the arches
    this.far = this.lay(-0.95);
    this.farMask = scene.make.graphics({}, false).setPosition(this.at.x, this.at.y).setScale(this.at.s);
    this.farMask.fillStyle(0xffffff);
    for (const p of polys(L.far)) this.farMask.fillPoints(p.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    this.far.setMask(this.farMask.createGeometryMask());
    if (L.water) this.makeWater(L.water);      // (under everything: it is the painting itself, moving)
    if (L.dragon) this.makeDragon(L.dragon);   // (first: the clouds and the mist drift in front of it)
    for (let i = 0; i < 6; i++) {
      const o = scene.make.image({ x: r() * W, y: L.sky[0] + r() * (L.sky[1] - L.sky[0]), key: T.cloud }, false).setTint(L.cloudTint).setAlpha(0.18 + r() * 0.2).setScale(0.9 + r() * 1.1, 0.7 + r() * 0.6);
      this.far.add(o); this.clouds.push({ o, vx: 5 + r() * 9, vy: 0, w: o.displayWidth });
    }
    for (const [i, v] of [[0, 7], [1, 13]] as const) { // two banks of valley mist, the nearer one quicker
      if (L.mistSoft) { // each bank in two halves, the upper fading in, the lower fading out (one texture across both)
        const [y0, y1] = L.mist, a = i ? 0.32 : 0.42, h = (y1 - y0) / 2, ty = 0.7;
        for (const half of [0, 1]) {
          const o = scene.make.tileSprite({ x: 0, y: y0 + i * 18 + half * h, width: W, height: h, key: T.mist }, false).setOrigin(0, 0).setTint(L.mistTint);
          o.setAlpha(half ? a : 0, half ? a : 0, half ? 0 : a, half ? 0 : a);
          o.setTileScale(1.2 - i * 0.25, ty); o.tilePositionY = (half * h) / ty;
          this.far.add(o); this.mists.push({ o, v });
        }
        continue;
      }
      const [y0, y1] = L.mist, o = scene.make.tileSprite({ x: 0, y: y0 + i * 18, width: W, height: y1 - y0, key: T.mist }, false).setOrigin(0, 0).setTint(L.mistTint).setAlpha(i ? 0.32 : 0.42);
      o.setTileScale(1.2 - i * 0.25, 0.7); this.far.add(o); this.mists.push({ o, v });
    }
    // the sun: a soft flare and god rays fanning down to the left, each sweeping a little and breathing
    const [sx, sy] = L.sun;
    const rk = L.rays ?? 1, rt = L.rayTint ?? 0xffd590;
    this.flare = scene.make.image({ x: sx, y: sy, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.rayTint ?? 0xffe2a8).setScale(2.6, 2.2).setAlpha(0.22 * rk);
    this.lay(-0.45).add(this.flare);
    const RAYS: [number, number, number, number][] = [[24, 150, 0.05, 1250], [33, 230, 0.042, 1350], [42, 120, 0.06, 1300], [51, 200, 0.04, 1400], [61, 140, 0.047, 1250], [70, 260, 0.032, 1150]];
    RAYS.forEach(([a0, w, al, len], i) => {
      const a = L.sunLeft ? -a0 : a0;
      const o = scene.make.image({ x: sx, y: sy, key: T.ray }, false).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(rt)
        .setAngle(a).setScale(w / 128, len / 1024).setAlpha(al * rk);
      this.lay(-0.45).add(o);
      this.rays.push({ o, a, al: al * rk, p: 11000 + i * 1700, ph: r() * Math.PI * 2 });
    });
    // cloud shadows and warm light drifting over the floor
    this.shade = scene.make.tileSprite({ x: 0, y: L.floorTop, width: W, height: H - L.floorTop, key: T.light }, false).setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setTint(0x2a2f3c).setAlpha(0.28);
    this.shade.setTileScale(2.6, 1.4);
    this.lay(-0.6).add(this.shade);
    this.light = scene.make.tileSprite({ x: 0, y: L.floorTop, width: W, height: H - L.floorTop, key: T.light }, false).setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(L.lightTint).setAlpha(0.1);
    this.light.setTileScale(2.2, 1.1);
    this.lay(-0.55).add(this.light);
    // the floor emblem: a breathing glow and light running round its rings
    const E = L.emblem;
    if (E) {
      const [ex, ey] = E.c;
      this.glow = scene.make.image({ x: ex, y: ey, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.emblemTint ?? 0xffc860)
        .setScale((E.outer[0] * 2.3) / 256, (E.outer[1] * 2.3) / 256).setAlpha(0.1);
      this.lay(-0.55).add(this.glow);
      for (const [ring, v, al] of [[E.outer, 0.00055, 0.42], [E.inner, -0.0009, 0.55]] as const) {
        if (!ring) continue;
        const img = scene.make.image({ x: 0, y: 0, key: T.ring }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(L.emblemTint ?? 0xffd27a).setAlpha(al).setScale(ring[0] / 240);
        const box = scene.make.container({ x: ex, y: ey }, false).add(img).setScale(1, ring[1] / ring[0]);
        this.lay(-0.54).add(box);
        this.sweeps.push({ box, img, v });
      }
    }
    // the weather: most of it behind the fighters, a share in front of them
    for (const F of Array.isArray(L.fall) ? L.fall : [L.fall]) for (let i = 0; i < F.n; i++) {
      const front = i % 4 === 0, tint = F.tints[i % F.tints.length];
      const d = (o: Phaser.GameObjects.Image, vx: number, vy: number, extra: Partial<Drifter> = {}) => this.leaves.push({ o, vx, vy, w: 40, spin: 0, sway: 0, ph: r() * Math.PI * 2, kind: F.kind, ...extra });
      const at = (key: string) => { const o = scene.make.image({ x: r() * W, y: r() * H, key }, false).setTint(tint); this.lay(front ? 89000 : -0.4).add(o); return o; };
      switch (F.kind) {
        case 'leaf': case 'petal': {
          const s = (front ? 0.9 : 0.55) + r() * 0.4, o = at(F.kind === 'leaf' ? T.leaf : T.petal).setScale(s).setAlpha(front ? 0.95 : 0.8);
          d(o, 40 + r() * 50, 14 + r() * 22, { spin: (r() - 0.5) * 4, sway: 18 + r() * 26, a: 1 }); break;
        }
        case 'snow': { const s = (front ? 0.42 : 0.2) + r() * 0.2, o = at(T.dot).setScale(s).setAlpha(front ? 1 : 0.85); d(o, 8 + r() * 14, (front ? 60 : 32) + r() * 30, { sway: 14 + r() * 18 }); break; }
        case 'rain': { const o = at(T.drop).setAlpha(front ? 0.45 : 0.3).setScale(front ? 1.3 : 0.9, front ? 1.5 : 1).setAngle(-14).setBlendMode(Phaser.BlendModes.ADD); d(o, 210, 860 + r() * 220); break; }
        case 'firefly': { const o = at(T.dot).setScale(0.12 + r() * 0.1).setBlendMode(Phaser.BlendModes.ADD); o.y = L.floorTop + r() * (H - L.floorTop); d(o, (r() - 0.5) * 24, (r() - 0.5) * 16, { sway: 20 + r() * 30, a: 0 }); break; }
        case 'ember': { const o = at(T.dot).setScale(0.1 + r() * 0.12).setBlendMode(Phaser.BlendModes.ADD); d(o, (r() - 0.3) * 30, -(30 + r() * 50), { sway: 16 + r() * 20 }); break; }
      }
    }
    for (const at of L.fires ?? []) { // a fire: a warm glow that flickers, a bright core, sparks rising off it
      const glow = scene.make.image({ x: at[0], y: at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a3c).setScale(0.9).setAlpha(0.5);
      const core = scene.make.image({ x: at[0], y: at[1] - 4, key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a0).setScale(0.18, 0.26).setAlpha(0.9);
      this.lay(-0.44).add([glow, core]);
      const sparks: Drifter[] = [];
      for (let i = 0; i < 5; i++) {
        const o = scene.make.image({ x: at[0], y: at[1], key: T.dot }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050).setScale(0.07 + r() * 0.05);
        this.lay(-0.44).add(o); sparks.push({ o, vx: (r() - 0.5) * 16, vy: -(30 + r() * 40), w: 0, ph: r() * 1.5, sway: 6 + r() * 8 });
      }
      this.fires.push({ glow, core, sparks, at, ph: r() * 10 });
    }
    if (L.lava) { // the lava: warm light rolling over it and breathing, masked off the floor
      const box = this.lay(-0.58);
      this.lava = scene.make.tileSprite({ x: 0, y: 0, width: W, height: H, key: T.light }, false).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(L.lava.tint).setAlpha(0.16);
      this.lava.setTileScale(1.5, 0.75);
      box.add(this.lava);
      const mk = scene.make.graphics({}, false).setPosition(this.at.x, this.at.y).setScale(this.at.s);
      mk.fillStyle(0xffffff).fillPoints(L.lava.keep.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      const gm = mk.createGeometryMask(); gm.setInvertAlpha(true);
      box.setMask(gm);
    }
    if (L.lightning) { this.flash = new Phaser.GameObjects.Rectangle(scene, -W, -H, W * 3, H * 4, 0xdfe8ff, 1).setOrigin(0, 0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD); this.lay(88990).add(this.flash); }
    if (L.floorMist) { // frost mist low over the floor: two banks drifting apart, each fading in at its top and out at its bottom
      const [y0, y1] = L.floorMist, h = (y1 - y0) / 2;
      for (const [i, v] of [[0, 6], [1, -9]] as const) for (const half of [0, 1]) {
        const a = i ? 0.2 : 0.26, ty = 0.55;
        const o = scene.make.tileSprite({ x: 0, y: y0 + i * 14 + half * h, width: W, height: h, key: T.mist }, false).setOrigin(0, 0).setTint(L.mistTint);
        o.setAlpha(half ? a : 0, half ? a : 0, half ? 0 : a, half ? 0 : a);
        o.setTileScale(1.1 - i * 0.2, ty); o.tilePositionY = (half * h) / ty;
        this.lay(-0.57).add(o); this.floorMists.push({ o, v });
      }
    }
    for (const c of L.crystals ?? []) { // a crystal's cold light, breathing (drawn with what it is set in)
      const o = scene.make.image({ x: c.at[0], y: c.at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xa8e4ff).setScale((c.r * 2) / 256).setAlpha(0.35);
      this.lay(c.front === undefined ? -0.44 : this.depthAt(c.front)).add(o);
      this.crystals.push({ o, a: 0.3 + r() * 0.12, p: 2600 + r() * 2400, ph: r() * Math.PI * 2 });
    }
    for (const g of L.glints ?? []) { // where the ice glints: each shape, its share and its layer
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of g.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      this.glintAt.push({ poly: g.poly, box: [x0, y0, x1, y1], depth: g.front === undefined ? -0.43 : this.depthAt(g.front), w: g.n });
    }
    for (const at of L.lamps ?? []) { // a lantern: a warm glow and a bright core, flickering
      const glow = scene.make.image({ x: at[0], y: at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setScale(0.62).setAlpha(0.4);
      const core = scene.make.image({ x: at[0], y: at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe6a8).setScale(0.13, 0.17).setAlpha(0.75);
      this.lay(-0.44).add([glow, core]);
      this.lamps.push({ glow, core, ph: r() * 10 });
    }
    const B = L.beacon;
    if (B && scene.textures.exists(B.beam)) { // the lighthouse: its beam swinging round, its lamp flaring as it faces us
      const beam = scene.make.image({ x: B.at[0], y: B.at[1], key: B.beam }, false).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      const lamp = scene.make.image({ x: B.at[0] - 3, y: B.at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc060).setScale(0.14).setAlpha(0.7);
      const flare = scene.make.image({ x: B.at[0] - 3, y: B.at[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2b0).setAlpha(0);
      this.far.add([beam, lamp, flare]);
      this.beacon = { beam, lamp, flare, period: B.period };
    }
    const Bo = L.bolts;
    if (Bo && this.flash) { // the bolts, in the sky (behind the sails and the mast), lit with each flash
      if (Bo.img && Bo.at && scene.textures.exists(Bo.img)) { this.boltImg = scene.make.image({ x: Bo.at[0], y: Bo.at[1], key: Bo.img }, false).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0); this.far.add(this.boltImg); }
      this.boltGfx = scene.make.graphics({}, false).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.far.add(this.boltGfx);
    }
  }

  /** The sea: the painting's water and sails drawn again over it, moving (WATER_FRAG), right above the painting. */
  private makeWater(Wl: WaterLook): void {
    const s = this.scene;
    if (s.game.renderer.type !== Phaser.WEBGL || !s.textures.exists(Wl.paint) || !s.textures.exists(Wl.mask)) return;
    if (!s.cache.shader.has('stage-water')) {
      const u: Record<string, { type: string; value: unknown }> = { uRes: { type: '2f', value: { x: this.W, y: this.H } }, uHorizon: { type: '1f', value: 0 }, uBoost: { type: '1f', value: 0 } };
      for (const [k] of WATER_PH) u[k] = { type: '1f', value: 0 };
      s.cache.shader.add('stage-water', new Phaser.Display.BaseShader('stage-water', WATER_FRAG, undefined, u));
    }
    const sh = new Phaser.GameObjects.Shader(s, 'stage-water', 0, 0, this.W, this.H).setOrigin(0, 0);
    const clamp = () => ({ wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge', repeat: false });  // (NPOT pictures: never repeat)
    sh.setChannel0(Wl.paint, clamp()).setChannel1(Wl.mask, clamp());
    sh.setUniform('uRes.value.x', this.W); sh.setUniform('uRes.value.y', this.H); sh.setUniform('uHorizon.value', Wl.horizon);
    this.lay(-0.99).add(sh);
    this.water = sh;
  }

  /** Spray bursting up where the sea breaks: droplets flung up and falling back, a puff of mist — bigger nearer. */
  private burst(at: Pt): void {
    const L = this.look, hz = L.water?.horizon ?? L.sky[1], r = Math.random;
    const k = 0.45 + 0.9 * Phaser.Math.Clamp((at[1] - hz) / (this.H - hz), 0, 1), box = this.lay(-0.45);
    const puff = this.scene.make.image({ x: at[0], y: at[1], key: T.glow }, false).setTint(0xd8e4f4).setScale(0.3 * k, 0.22 * k).setAlpha(0);
    box.add(puff); this.spray.push({ o: puff, vx: (r() - 0.5) * 20 * k, vy: -40 * k, g: 30 * k, t: 0, life: 1300, a: 0.32, grow: 0.45 * k });
    for (let i = 0, n = 9 + Math.floor(r() * 8); i < n; i++) {
      const o = this.scene.make.image({ x: at[0] + (r() - 0.5) * 30 * k, y: at[1], key: T.dot }, false).setTint(r() < 0.5 ? 0xffffff : 0xcfe0ff).setScale((0.1 + r() * 0.18) * k).setAlpha(0);
      box.add(o); this.spray.push({ o, vx: (r() - 0.5) * 120 * k, vy: -(90 + r() * 150) * k, g: 300 * k, t: 0, life: 800 + r() * 600, a: 0.85, grow: 0 });
    }
  }

  /** A raindrop lands on the planks: a ring at a random spot of the wet floor (a ring kept for the next one after). */
  private splash(): void {
    const P = this.look.puddles!, r = Math.random;
    const p = P[Math.floor(r() * P.length)];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let i = 0; i < 8; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (!inPoly(x, y, p)) continue;
      const o = this.ringPool.pop() ?? this.scene.make.image({ x: 0, y: 0, key: T.splash }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8e6ff);
      if (!o.parentContainer) this.lay(-0.5).add(o);
      o.setPosition(x, y).setVisible(true).setAlpha(0);
      const near = Phaser.Math.Clamp((y - this.look.floorTop) / (this.H - this.look.floorTop), 0, 1);
      this.rings.push({ o, t: 0, life: 320 + r() * 220, s: (0.22 + r() * 0.16) * (0.75 + 0.5 * near) });
      return;
    }
  }

  /** A glint somewhere on the ice: a shape by its share, a point inside it, a star from that layer's pool. */
  private glint(): void {
    const A = this.glintAt, r = Math.random;
    let pick = r() * A.reduce((n, g) => n + g.w, 0), g = A[0];
    for (const c of A) { pick -= c.w; if (pick <= 0) { g = c; break; } }
    const [x0, y0, x1, y1] = g.box;
    for (let i = 0; i < 8; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (!inPoly(x, y, g.poly)) continue;
      let pool = this.glintPool.get(g.depth);
      if (!pool) { pool = []; this.glintPool.set(g.depth, pool); }
      const o = pool.pop() ?? this.scene.make.image({ x: 0, y: 0, key: T.star }, false).setBlendMode(Phaser.BlendModes.ADD).setData('d', g.depth);
      if (!o.parentContainer) this.lay(g.depth).add(o);
      o.setPosition(x, y).setVisible(true).setScale(0).setAngle(r() * 45).setTint([0xffffff, 0xd8f0ff, 0xbfe6ff][Math.floor(r() * 3)]);
      this.glints.push({ o, t: 0, life: 380 + r() * 340, s: 0.16 + r() * 0.26 });
      return;
    }
  }

  /** A bolt drawn down the open sky: a jagged line to the horizon with a fork or two, a glow round it. */
  private drawBolt(): void {
    const g = this.boltGfx!, Bo = this.look.bolts!, r = Math.random;
    const [xa, xb] = Bo.x[Math.floor(r() * Bo.x.length)];
    let x = xa + r() * (xb - xa), y = -10;
    const main: Pt[] = [[x, y]];
    while (y < Bo.to) { y = Math.min(Bo.to, y + 12 + r() * 16); x += (r() - 0.5) * 26; main.push([x, y]); }
    const forks: Pt[][] = [];
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n && main.length > 5; k++) {
      const i = 2 + Math.floor(r() * (main.length - 4)), dir = r() < 0.5 ? -1 : 1;
      let [fx, fy] = main[i]; const f: Pt[] = [[fx, fy]];
      for (let j = 0, m = 3 + Math.floor(r() * 4); j < m && fy < Bo.to; j++) { fx += dir * (6 + r() * 16); fy = Math.min(Bo.to, fy + 8 + r() * 14); f.push([fx, fy]); }
      forks.push(f);
    }
    const line = (pts: Pt[], w: number, col: number, a: number) => {
      g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokePath();
    };
    g.clear();
    line(main, 16, 0x6f86ff, 0.16); line(main, 6, 0xbcd0ff, 0.5); line(main, 2.6, 0xffffff, 1);
    for (const f of forks) { line(f, 8, 0x6f86ff, 0.14); line(f, 3, 0xbcd0ff, 0.4); line(f, 1.4, 0xf0f4ff, 0.9); }
  }

  private flock(): void {
    const L = this.look, r = Math.random, fromLeft = r() < 0.5, n = 3 + Math.floor(r() * 5), key = L.fliers === 'bats' ? T.bat : T.bird;
    const y0 = L.sky[0] + 30 + r() * (L.mist[0] - L.sky[0] - 20), v = (fromLeft ? 1 : -1) * (38 + r() * 30), s = 0.45 + r() * 0.45;
    for (let i = 0; i < n; i++) { // a loose V
      const back = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const o = this.scene.make.image({ x: (fromLeft ? 160 : this.W - 160) - Math.sign(v) * Math.abs(back) * 26 * s * 1.6, y: y0 + back * 9 * s, key: `${key}0` }, false)
        .setTint(L.fliers === 'bats' ? 0x10121c : 0x3a2222).setAlpha(0.85).setScale(s * (0.85 + r() * 0.3));
      o.setData('k', key);
      this.far.add(o); this.birds.push({ o, vx: v * (0.95 + r() * 0.1) * (L.fliers === 'bats' ? 1.4 : 1), vy: (r() - 0.5) * 4, t: r() * 1000, fps: (7 + r() * 4) * (L.fliers === 'bats' ? 1.8 : 1) });
    }
  }

  /** `focus`: where the fight is (painting px) — the dragon watches it. */
  update(ms: number, focus?: { x: number; y: number }): void {
    if (this.dragon) this.dragonStep(ms, focus);
    this.t += ms;
    const s = ms / 1000, t = this.t;
    for (const c of this.clouds) { c.o.x += c.vx * s; if (c.o.x - c.w / 2 > this.W) c.o.x = -c.w / 2; }
    for (const m of this.mists) m.o.tilePositionX -= m.v * s;
    this.nextFlock -= ms;
    if (this.nextFlock <= 0 && this.look.fliers) { this.flock(); this.nextFlock = 7000 + Math.random() * 9000; }
    this.birds = this.birds.filter((b) => {
      b.t += ms; b.o.x += b.vx * s; b.o.y += b.vy * s + Math.sin(b.t / 380) * 0.08;
      b.o.setTexture(`${b.o.getData('k')}${Math.floor((b.t / 1000) * b.fps) % BIRD_FRAMES}`);
      if (b.o.x < -60 || b.o.x > this.W + 60) { b.o.destroy(); return false; }
      return true;
    });
    this.flare.setAlpha(0.2 + 0.05 * Math.sin((t / 5200) * Math.PI * 2));
    for (const r of this.rays) {
      const k = Math.sin((t / r.p) * Math.PI * 2 + r.ph);
      r.o.setAngle(r.a + 2.5 * k).setAlpha(r.al * (1 + 0.35 * Math.sin((t / (r.p * 0.7)) * Math.PI * 2 + r.ph * 2)));
    }
    this.light.tilePositionX += 6 * s; this.light.tilePositionY += 2 * s;
    this.shade.tilePositionX += 9 * s; this.shade.tilePositionY += 3 * s;
    this.light.setAlpha(0.07 + 0.025 * Math.sin((t / 9000) * Math.PI * 2));
    if (this.lava) { // rolling slowly, breathing, a little unsteady
      this.lava.tilePositionX += 5 * s; this.lava.tilePositionY -= 3 * s;
      this.lava.setAlpha(0.13 + 0.05 * Math.sin((t / 2600) * Math.PI * 2) + 0.025 * Math.sin((t / 730) * Math.PI * 2));
    }
    // the emblem's flare at FIGHT! / K.O.: up in a moment, fading over a second and a half (the rings racing round)
    let fl = 0;
    if (this.flare2 >= 0) {
      this.flare2 += ms; const u = this.flare2 / 1600;
      if (u >= 1) this.flare2 = -1; else fl = u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 1.5);
    }
    this.glow?.setAlpha(0.1 + 0.06 * Math.sin((t / 4200) * Math.PI * 2) + 0.45 * fl);
    for (const w of this.sweeps) { w.img.rotation += w.v * ms * (1 + 6 * fl); w.img.setAlpha((w.v > 0 ? 0.42 : 0.55) * (1 + 0.8 * fl)); }
    this.water?.setUniform('uBoost.value', fl);
    for (const c of this.crystals) c.o.setAlpha(c.a * (0.75 + 0.25 * Math.sin((t / c.p) * Math.PI * 2 + c.ph)) * (1 + 0.6 * fl));
    for (const m of this.floorMists) m.o.tilePositionX -= m.v * s;
    if (this.glintAt.length) { // the ice glinting: a star of light here and there, coming and going
      this.nextGlint -= ms;
      for (let i = 0; this.nextGlint <= 0 && i < 4; i++) { this.glint(); this.nextGlint += 50 + Math.random() * 70; }
      if (this.nextGlint < 0) this.nextGlint = 0;
    }
    this.glints = this.glints.filter((g) => {
      g.t += ms; const u = g.t / g.life;
      if (u >= 1) { g.o.setVisible(false); this.glintPool.get(g.o.getData('d') as number)?.push(g.o); return false; }
      const k = Math.sin(u * Math.PI);
      g.o.setScale(g.s * k).setAlpha(Math.min(1, k * 1.4)); g.o.angle += 50 * s;
      return true;
    });
    const H = this.H, top = this.look.floorTop;
    for (const l of this.leaves) {
      const kind = l.kind;
      l.ph! += s * 2.2;
      l.o.x += (l.vx + Math.sin(l.ph!) * l.sway!) * s; l.o.y += (l.vy + Math.cos(l.ph! * 0.8) * (kind === 'rain' ? 0 : 10)) * s;
      if (l.a) { l.o.rotation += l.spin! * s; l.o.scaleY = l.o.scaleX * (0.35 + 0.65 * Math.abs(Math.sin(l.ph! * 1.3))); } // a leaf turning over as it flies
      if (kind === 'firefly') { // wandering over the floor, glowing on and off
        l.o.setAlpha(Math.max(0, Math.sin(l.ph! * 0.9)) * 0.95);
        if (l.o.y < top || l.o.y > H) l.vy = -l.vy;
        if (l.o.x < 0 || l.o.x > this.W) l.vx = -l.vx;
        continue;
      }
      if (kind === 'ember') { if (l.o.y < -20) { l.o.y = H + 10; l.o.x = Math.random() * this.W; } continue; }
      if (l.o.x > this.W + 40 || l.o.y > H + 40) {
        if (kind === 'rain') { l.o.x = Math.random() * (this.W + 300) - 300; l.o.y = -60 - Math.random() * 200; }
        else { l.o.x = -30 - Math.random() * 200; l.o.y = Math.random() * H * 0.8; }
      }
    }
    for (const f of this.fires) { // flicker: two sines and a little noise
      const k = 0.78 + 0.12 * Math.sin(t / 97 + f.ph) + 0.08 * Math.sin(t / 41 + f.ph * 2) + (Math.random() - 0.5) * 0.06;
      f.glow.setAlpha(0.5 * k).setScale(0.85 + 0.12 * k); f.core.setAlpha(0.9 * k);
      for (const sp of f.sparks) {
        sp.ph! += s;
        sp.o.x += (sp.vx + Math.sin(sp.ph! * 5) * sp.sway!) * s; sp.o.y += sp.vy * s;
        sp.o.setAlpha(Math.max(0, 1 - sp.ph! / 1.6));
        if (sp.ph! > 1.6) { sp.ph = 0; sp.o.setPosition(f.at[0] + (Math.random() - 0.5) * 8, f.at[1] - 4); }
      }
    }
    if (this.flash) { // a storm: now and then the sky flashes twice
      this.nextBolt -= ms;
      if (this.nextBolt <= 0) {
        this.bolt = 0; this.nextBolt = 6000 + Math.random() * 9000; this.onEvent?.('bolt');
        // its bolt: the painting's own now and then, else one drawn somewhere down the sky
        this.boltOn?.setAlpha(0);
        this.boltOn = this.boltImg && Math.random() < 0.4 ? this.boltImg : this.boltGfx;
        if (this.boltOn === this.boltGfx) this.drawBolt();
      }
      if (this.bolt >= 0) {
        this.bolt += ms; const b = this.bolt;
        const a = b < 90 ? 0.45 * (1 - b / 90) : b < 170 ? 0 : b < 260 ? 0.55 * (1 - (b - 170) / 90) : -1;
        if (a < 0) { this.bolt = -1; this.flash.setAlpha(0); } else this.flash.setAlpha(a);
        // the bolt: bright with both flashes, glowing faintly between them, gone soon after
        this.boltOn?.setAlpha(b < 90 ? 1 : b < 170 ? 0.4 : b < 260 ? 1 - ((b - 170) / 90) * 0.4 : Math.max(0, 0.6 * (1 - (b - 260) / 200)));
      } else if (this.boltOn && this.boltOn.alpha > 0) this.boltOn.setAlpha(0);
    }
    if (this.water) { const k = t / 1000; for (const [u, w] of WATER_PH) this.water.setUniform(`${u}.value`, (k * w) % (Math.PI * 2)); }
    for (const l of this.lamps) { // a lantern's flame: two sines and a little noise
      const k = 0.82 + 0.1 * Math.sin(t / 113 + l.ph) + 0.06 * Math.sin(t / 47 + l.ph * 2) + (Math.random() - 0.5) * 0.05;
      l.glow.setAlpha(0.4 * k).setScale(0.58 + 0.08 * k); l.core.setAlpha(0.75 * k);
    }
    const L = this.look;
    if (L.spray?.length) {
      this.nextSpray -= ms;
      if (this.nextSpray <= 0) { this.burst(L.spray[Math.floor(Math.random() * L.spray.length)]); this.nextSpray = 450 + Math.random() * 1200; }
    }
    this.spray = this.spray.filter((p) => {
      p.t += ms; const u = p.t / p.life;
      if (u >= 1) { p.o.destroy(); return false; }
      p.vy += p.g * s; p.o.x += p.vx * s; p.o.y += p.vy * s;
      if (p.grow) p.o.setScale(p.o.scaleX + p.grow * s, p.o.scaleY + p.grow * 0.75 * s);
      p.o.setAlpha(p.a * (u < 0.12 ? u / 0.12 : 1 - Math.max(0, (u - 0.45) / 0.55)));
      return true;
    });
    if (L.puddles?.length) {
      this.nextRing -= ms;
      for (let i = 0; this.nextRing <= 0 && i < 8; i++) { this.splash(); this.nextRing += 12 + Math.random() * 14; }
      if (this.nextRing < 0) this.nextRing = 0;
    }
    this.rings = this.rings.filter((g) => {
      g.t += ms; const u = g.t / g.life;
      if (u >= 1) { g.o.setVisible(false); this.ringPool.push(g.o); return false; }
      const sc = g.s * (0.25 + 0.75 * u);
      g.o.setScale(sc, sc * 0.4).setAlpha(0.8 * (1 - u) * Math.min(1, u * 6));
      return true;
    });
    if (this.beacon) { // turning round: its beam swings out to the right, shortens toward us (the lamp flares), out to the left, dims away
      const B = this.beacon, th = ((t % B.period) / B.period) * Math.PI * 2, cx = Math.cos(th), sn = Math.sin(th);
      const face = Math.pow(Math.max(0, sn), 6);
      B.beam.setScale(cx, 1 + 0.35 * Math.max(0, sn)).setAlpha(0.35 + 0.65 * (0.5 + 0.5 * sn));
      B.flare.setScale(0.16 + 0.3 * face).setAlpha(0.75 * face);
      B.lamp.setAlpha(0.6 + 0.3 * (0.5 + 0.5 * sn));
    }
  }

  /** The dragon: the body along a line of points (rippled every frame), the head in a box turning round its neck pivot. */
  private makeDragon(D: DragonLook): void {
    const s = this.scene;
    if (!s.textures.exists(D.body) || !s.textures.exists(D.head)) return;
    const W = (s.textures.get(D.body).getSourceImage() as HTMLImageElement).width, N = 40;
    const pts = Array.from({ length: N }, (_, i) => new Phaser.Math.Vector2(-W / 2 + (W * i) / (N - 1), 0));
    const body = s.make.rope({ key: D.body, points: pts, horizontal: true }, false) as Phaser.GameObjects.Rope;
    body.setPosition(D.bodyAt.x, D.bodyAt.y).setScale(D.bodyAt.s).setAngle(D.bodyAt.angle);
    const H = D.headAt, head = s.make.container({ x: H.x, y: H.y }, false).setScale(H.s);
    const img = s.make.image({ x: 0, y: 0, key: D.head }, false).setOrigin(H.pivot[0] / s.textures.get(D.head).getSourceImage().width, H.pivot[1] / s.textures.get(D.head).getSourceImage().height);
    const eye = s.make.image({ x: H.eye[0] - H.pivot[0], y: H.eye[1] - H.pivot[1], key: T.glow }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd060).setScale(0.16).setAlpha(0.55);
    head.add([img, eye]);
    const flash = new Phaser.GameObjects.Rectangle(s, 0, 0, this.W, this.H, 0xffb860, 1).setOrigin(0, 0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // its own layer, under the far clouds and mist (they drift in front of it), cut off where the nearer things stand
    const box = this.lay(-0.96).add([body, head, flash]);
    const mk = s.make.graphics({}, false).setPosition(this.at.x, this.at.y).setScale(this.at.s);
    mk.fillStyle(0xffffff);
    for (const poly of D.front) mk.fillPoints(poly.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    const gm = mk.createGeometryMask(); gm.setInvertAlpha(true);
    box.setMask(gm);
    this.dragon = { body, pts, head, eye, look: 0, roar: -1, puff: 2500, smoke: [], flash, box, D };
  }

  /** A moment of the fight the stage answers: the dragon rears up and roars (FIGHT!, K.O.). */
  event(kind: 'fight' | 'ko'): void {
    if (this.dragon) { this.dragon.roar = 0; this.onEvent?.('roar'); }
    if (this.look.emblemFlash) { this.flare2 = 0; this.onEvent?.('flare'); }
    void kind;
  }

  private dragonStep(ms: number, focus?: { x: number; y: number }): void {
    const g = this.dragon!, D = g.D, t = this.t, H = D.headAt;
    // the roar: up and back in 1.4 s, shaking while it lasts
    let rr = 0, shake = 0;
    if (g.roar >= 0) {
      g.roar += ms; const u = g.roar / 1400;
      if (u >= 1) g.roar = -1;
      else { rr = Math.sin(Math.min(1, u * 1.6) * Math.PI) * (u < 0.62 ? 1 : 1 - (u - 0.62) / 0.38); shake = u < 0.7 ? Math.sin(g.roar / 16) * 0.012 : 0; }
    }
    // the body ripples from the head to the tail, a little more while it roars
    const amp = 13 * (1 + rr * 1.2), n = g.pts.length;
    for (let i = 0; i < n; i++) g.pts[i].y = amp * Math.sin((i / (n - 1)) * Math.PI * 2.4 + t / 900) * (0.5 + 0.5 * i / (n - 1));
    g.body.setDirty();
    g.body.y = D.bodyAt.y + 5 * Math.sin(t / 2300); g.body.setAngle(D.bodyAt.angle + 1.2 * Math.sin(t / 3100));
    // the head: watching the fight (turned toward it a little), breathing, rearing up when it roars
    if (focus) {
      const ex = H.x + (H.eye[0] - H.pivot[0]) * H.s, ey = H.y + (H.eye[1] - H.pivot[1]) * H.s;
      const a = Math.atan2(focus.y - ey, focus.x - ex), rest = Math.atan2(0.6, -1);
      const want = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(a - rest) * 0.35, -0.14, 0.14);
      g.look += (want - g.look) * Math.min(1, ms / 420);
    }
    g.head.rotation = g.look + 0.022 * Math.sin(t / 2700) - rr * 0.13 + shake;
    g.head.y = H.y + 4 * Math.sin(t / 2300 + 1.1) - rr * 10;
    g.eye.setAlpha(0.5 + 0.12 * Math.sin(t / 700) + rr * 0.5).setScale(0.16 + rr * 0.1);
    g.flash.setAlpha(rr * 0.16);
    // smoke from its nostrils now and then (a burst when it roars)
    g.puff -= ms;
    const nose = () => { const c = Math.cos(g.head.rotation), sn = Math.sin(g.head.rotation), dx = (H.nostril[0] - H.pivot[0]) * H.s, dy = (H.nostril[1] - H.pivot[1]) * H.s; return [g.head.x + dx * c - dy * sn, g.head.y + dx * sn + dy * c]; };
    const emit = (k: number, hot: boolean) => {
      for (let i = 0; i < k; i++) {
        const [nx, ny] = nose(), o = this.scene.make.image({ x: nx, y: ny, key: T.dot }, false).setTint(hot ? 0xffb050 : 0xd8d0c8).setAlpha(0).setScale(0.25 + Math.random() * 0.3);
        if (hot) o.setBlendMode(Phaser.BlendModes.ADD);
        g.box.addAt(o, g.box.getIndex(g.head) + 1);
        g.smoke.push({ o, vx: -30 - Math.random() * 40 - (hot ? 60 : 0), vy: -14 - Math.random() * 18 + (hot ? 20 : 0), t: 0, life: 1600 + Math.random() * 900 });
      }
    };
    if (g.puff <= 0) { emit(5, false); g.puff = 3800 + Math.random() * 3000; }
    if (g.roar >= 0 && g.roar < ms * 1.5) emit(16, true);
    const s = ms / 1000;
    g.smoke = g.smoke.filter((p) => {
      p.t += ms; const u = p.t / p.life;
      if (u >= 1) { p.o.destroy(); return false; }
      p.o.x += p.vx * s; p.o.y += p.vy * s; p.o.setScale(p.o.scale + s * 0.35).setAlpha(Math.sin(Math.min(1, u * 3) * Math.PI / 2) * (1 - u) * 0.5);
      return true;
    });
  }

  destroy(): void {
    this.dragon = undefined; this.water = undefined; this.beacon = undefined;
    this.boltImg = undefined; this.boltGfx = undefined; this.boltOn = undefined;
    this.far.clearMask(true); this.farMask.destroy();
    for (const c of this.layers.values()) c.destroy(true);
    this.layers.clear();
    this.clouds = []; this.birds = []; this.rays = []; this.sweeps = []; this.leaves = [];
    this.lamps = []; this.spray = []; this.rings = []; this.ringPool = [];
    this.crystals = []; this.glints = []; this.glintPool.clear(); this.glintAt = []; this.floorMists = [];
  }
}
