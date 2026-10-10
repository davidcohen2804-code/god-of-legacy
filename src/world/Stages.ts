// The PvP arena's stages (Tekken-style): different places, each with its own floor, props, cover and feel — and a place
// can come in moods (the Legacy Courtyard by day, by night, in winter: one layout, other paintings and weather). A
// match's stage comes from its room's name, so both players of a room always fight on the same stage (a room of your
// own against the CPU: a stage at random) — first the place, then its mood.
import WORLD from '../data/legacy-courtyard.json';
import { PVP } from '../config/layout';
import { COURTYARD_LOOK, NIGHT_LOOK, SAKURA_LOOK, StageLook, WINTER_LOOK } from './StageFx';
import { COURTYARD_OBJECTS, Pt, StageGeo } from './WorldGeometry';

export interface Stage {
  id: string;
  /** The place (stages of one place share its layout: its moods). */
  place: string;
  /** Shown on the loading screen and the VS. */
  name: string;
  /** The painting (the arena's map pixels, 1672x941) and its texture key. */
  file: string;
  key: string;
  /** A small copy for the loading screen's backdrop (it shows before the painting itself is in). */
  preview: string;
  look: StageLook;
  geo: StageGeo;
}

/** The Legacy Courtyard: a wide open square, a pedestal to jump on, a planter and the guardian statue to hide behind. */
const COURTYARD_GEO: StageGeo = {
  floor: WORLD.walkablePolygon as Pt[],
  props: COURTYARD_OBJECTS,
  spawns: PVP.spawnPoints.map((p) => [p.x, p.y] as Pt),
  start: { y: 640, left: 722, right: 978 },
  centre: [838, 640],
};

/** The Sakura Temple: a wide wooden deck over a koi pond, the water along its sides and in front, a red railing behind,
 *  two stone lanterns to hide behind. */
const SAKURA_GEO: StageGeo = {
  floor: [[287, 300], [1398, 300], [1652, 596], [1652, 752], [20, 752], [20, 616]],
  props: [
    // two tall stone lanterns at the back of the deck, left and right: cover to hide behind (nobody stands on them)
    { id: 'stone-lantern-l', footprint: [[520, 428], [569, 455], [520, 482], [471, 455]], height: 220, cover: 'hard', frontY: 482,
      occluder: [[517, 271], [508, 280], [512, 291], [505, 294], [506, 300], [481, 317], [467, 317], [466, 322], [477, 334], [487, 334], [495, 339], [492, 342], [495, 347], [495, 367], [486, 373], [486, 381], [503, 395], [500, 427], [491, 431], [487, 438], [472, 444], [471, 464], [520, 490], [568, 466], [568, 445], [552, 438], [548, 431], [538, 425], [536, 395], [553, 381], [553, 373], [544, 368], [544, 347], [547, 344], [544, 339], [552, 334], [561, 335], [568, 330], [573, 318], [554, 316], [534, 301], [533, 294], [526, 291], [530, 286], [529, 277], [524, 272]] },
    { id: 'stone-lantern-r', footprint: [[1160, 428], [1209, 455], [1160, 482], [1111, 455]], height: 220, cover: 'hard', frontY: 482,
      occluder: [[1157, 271], [1148, 280], [1152, 291], [1145, 294], [1146, 300], [1121, 317], [1107, 317], [1106, 322], [1117, 334], [1127, 334], [1135, 339], [1132, 342], [1135, 347], [1135, 367], [1126, 373], [1126, 381], [1143, 395], [1140, 427], [1131, 431], [1127, 438], [1112, 444], [1111, 464], [1160, 490], [1208, 466], [1208, 445], [1192, 438], [1188, 431], [1178, 425], [1176, 395], [1193, 381], [1193, 373], [1184, 368], [1184, 347], [1187, 344], [1184, 339], [1192, 334], [1201, 335], [1208, 330], [1213, 318], [1194, 316], [1174, 301], [1173, 294], [1166, 291], [1170, 286], [1169, 277], [1164, 272]] },
  ],
  spawns: [[840, 700], [330, 690], [1350, 700], [620, 380], [1060, 380], [300, 540], [1390, 520], [840, 540]],
  start: { y: 580, left: 712, right: 968 },
  centre: [840, 560],
};

export const STAGES: Stage[] = [
  { id: 'courtyard', place: 'courtyard', name: 'LEGACY COURTYARD', file: 'assets/environment/Legacy_Courtyard.png', key: 'legacy-courtyard', preview: 'assets/pvp/stages/courtyard.webp', look: COURTYARD_LOOK, geo: COURTYARD_GEO },
  { id: 'night', place: 'courtyard', name: 'MOONLIT COURTYARD', file: 'assets/environment/stages/courtyard_night.webp', key: 'stage-courtyard-night', preview: 'assets/pvp/stages/night.webp', look: NIGHT_LOOK, geo: COURTYARD_GEO },
  { id: 'winter', place: 'courtyard', name: 'FROZEN COURTYARD', file: 'assets/environment/stages/courtyard_winter.webp', key: 'stage-courtyard-winter', preview: 'assets/pvp/stages/winter.webp', look: WINTER_LOOK, geo: COURTYARD_GEO },
  { id: 'sakura', place: 'sakura', name: 'SAKURA TEMPLE', file: 'assets/environment/stages/sakura_temple.webp', key: 'stage-sakura-temple', preview: 'assets/pvp/stages/sakura.webp', look: SAKURA_LOOK, geo: SAKURA_GEO },
];

const hash = (s: string, seed: number): number => {
  let h = seed >>> 0;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
};

/** The stage of a room (the same on every screen in it): a place, then one of its moods. */
export function stageOf(room: string | undefined | null): Stage {
  const places = [...new Set(STAGES.map((s) => s.place))];
  const place = places[hash(room ?? '', 2166136261) % places.length];
  const moods = STAGES.filter((s) => s.place === place);
  return moods[hash(room ?? '', 374761393) % moods.length];
}
