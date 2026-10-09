// The PvP arena's stages (Tekken-style): different places, each with its own floor, props, cover and feel — and a place
// can come in moods (the Legacy Courtyard by day, by night, in winter: one layout, other paintings and weather). A
// match's stage comes from its room's name, so both players of a room always fight on the same stage (a room of your
// own against the CPU: a stage at random) — first the place, then its mood.
import WORLD from '../data/legacy-courtyard.json';
import { PVP } from '../config/layout';
import { COURTYARD_LOOK, NIGHT_LOOK, StageLook, WINTER_LOOK } from './StageFx';
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

export const STAGES: Stage[] = [
  { id: 'courtyard', place: 'courtyard', name: 'LEGACY COURTYARD', file: 'assets/environment/Legacy_Courtyard.png', key: 'legacy-courtyard', preview: 'assets/pvp/stages/courtyard.webp', look: COURTYARD_LOOK, geo: COURTYARD_GEO },
  { id: 'night', place: 'courtyard', name: 'MOONLIT COURTYARD', file: 'assets/environment/stages/courtyard_night.webp', key: 'stage-courtyard-night', preview: 'assets/pvp/stages/night.webp', look: NIGHT_LOOK, geo: COURTYARD_GEO },
  { id: 'winter', place: 'courtyard', name: 'FROZEN COURTYARD', file: 'assets/environment/stages/courtyard_winter.webp', key: 'stage-courtyard-winter', preview: 'assets/pvp/stages/winter.webp', look: WINTER_LOOK, geo: COURTYARD_GEO },
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
