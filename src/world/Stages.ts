// The PvP arena's stages (Tekken-style): different places, each with its own floor, props, cover and feel (a place can
// come in moods: one layout, other paintings and weather — none now: every stage is a place of its own). A
// match's stage comes from its room's name, so both players of a room always fight on the same stage (a room of your
// own against the CPU: a stage at random) — first the place, then its mood.
import WORLD from '../data/legacy-courtyard.json';
import { PVP } from '../config/layout';
import { COURTYARD_LOOK, ICE_LOOK, LAVA_LOOK, SAKURA_LOOK, SHAOLIN_LOOK, SHIP_LOOK, StageLook } from './StageFx';
import { COURTYARD_OBJECTS, Pt, StageGeo, WorldObject } from './WorldGeometry';

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
  /** More pictures the stage draws (its dragon), loaded with its painting. */
  extras?: { key: string; file: string }[];
  /** The select screen's backdrop when the painting alone is not the whole stage (its dragon baked in). */
  poster?: string;
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

/** The Lava Fortress: an eight-sided stone platform over a lava lake — its corners cut, open all round — with an obsidian
 *  obelisk in the middle to fight round and hide behind. */
const LAVA_GEO: StageGeo = {
  floor: [[610, 300], [1140, 300], [1380, 402], [1506, 606], [1352, 790], [382, 790], [220, 606], [360, 402]],
  props: [
    // the obelisk on the floor's emblem: its square base turned 45° (a diamond on the floor); tall cover, nobody stands on it
    { id: 'obsidian-obelisk', footprint: [[866, 547], [918, 520], [866, 493], [814, 520]], height: 290, cover: 'hard', frontY: 547,
      occluder: [[867, 259], [847, 294], [833, 472], [824, 476], [819, 484], [821, 506], [814, 520], [815, 524], [865, 548], [919, 523], [912, 501], [914, 483], [908, 475], [900, 472], [887, 296]] },
  ],
  spawns: [[860, 740], [420, 700], [1300, 700], [660, 360], [1080, 360], [330, 560], [1400, 560], [866, 640]],
  start: { y: 640, left: 732, right: 1000 },
  centre: [866, 650],
};

/** The Shaolin Monastery, on two levels: the training courtyard below; the temple terrace above (a second arena up there,
 *  in slices along its curved front); on each side two lotus pillars of rising height to jump up to it (floor -> low ->
 *  tall -> terrace: each step within one jump). Fitted to the painting. */
const SHAOLIN_GEO: StageGeo = {
  floor: [[175, 436], [408, 436], [447, 352], [1300, 346], [1345, 436], [1568, 434], [1672, 569], [1672, 880], [0, 880], [0, 628]],
  props: [
    { id: 'terrace-1', footprint: [[447, 356], [458, 356], [470, 356], [470, 436], [458, 435], [446, 434], [435, 432], [423, 431], [411, 430]], height: 140, topZ: 140, cover: 'hard', frontY: 436, occluder: [[411, 290], [423, 291], [435, 292], [446, 294], [458, 295], [470, 296], [470, 436], [458, 435], [446, 434], [435, 432], [423, 431], [411, 430]] },
    { id: 'terrace-2', footprint: [[470, 356], [488, 356], [506, 356], [524, 355], [542, 355], [560, 355], [560, 445], [542, 443], [524, 441], [506, 440], [488, 438], [470, 436]], height: 140, topZ: 140, cover: 'hard', frontY: 445, occluder: [[470, 296], [488, 298], [506, 300], [524, 301], [542, 303], [560, 305], [560, 445], [542, 443], [524, 441], [506, 440], [488, 438], [470, 436]] },
    { id: 'terrace-3', footprint: [[560, 355], [580, 355], [600, 355], [620, 355], [640, 355], [660, 355], [660, 454], [640, 453], [620, 451], [600, 449], [580, 447], [560, 445]], height: 140, topZ: 140, cover: 'hard', frontY: 454, occluder: [[560, 305], [580, 307], [600, 309], [620, 311], [640, 313], [660, 314], [660, 454], [640, 453], [620, 451], [600, 449], [580, 447], [560, 445]] },
    { id: 'terrace-4', footprint: [[660, 355], [682, 354], [704, 354], [726, 354], [748, 354], [770, 354], [770, 461], [748, 460], [726, 459], [704, 458], [682, 456], [660, 454]], height: 140, topZ: 140, cover: 'hard', frontY: 461, occluder: [[660, 314], [682, 316], [704, 318], [726, 319], [748, 320], [770, 321], [770, 461], [748, 460], [726, 459], [704, 458], [682, 456], [660, 454]] },
    { id: 'terrace-5', footprint: [[770, 354], [792, 354], [814, 353], [836, 353], [858, 353], [880, 353], [880, 466], [858, 465], [836, 464], [814, 463], [792, 462], [770, 461]], height: 140, topZ: 140, cover: 'hard', frontY: 466, occluder: [[770, 321], [792, 322], [814, 323], [836, 324], [858, 325], [880, 326], [880, 466], [858, 465], [836, 464], [814, 463], [792, 462], [770, 461]] },
    { id: 'terrace-6', footprint: [[880, 353], [902, 353], [924, 353], [946, 352], [968, 352], [990, 352], [990, 464], [968, 464], [946, 465], [924, 465], [902, 466], [880, 466]], height: 140, topZ: 140, cover: 'hard', frontY: 466, occluder: [[880, 326], [902, 326], [924, 325], [946, 325], [968, 324], [990, 324], [990, 464], [968, 464], [946, 465], [924, 465], [902, 466], [880, 466]] },
    { id: 'terrace-7', footprint: [[990, 352], [1012, 352], [1034, 352], [1056, 352], [1078, 352], [1100, 351], [1100, 458], [1078, 459], [1056, 460], [1034, 462], [1012, 463], [990, 464]], height: 140, topZ: 140, cover: 'hard', frontY: 464, occluder: [[990, 324], [1012, 323], [1034, 322], [1056, 320], [1078, 319], [1100, 318], [1100, 458], [1078, 459], [1056, 460], [1034, 462], [1012, 463], [990, 464]] },
    { id: 'terrace-8', footprint: [[1100, 351], [1120, 351], [1140, 351], [1160, 351], [1180, 351], [1200, 351], [1200, 449], [1180, 452], [1160, 454], [1140, 455], [1120, 456], [1100, 458]], height: 140, topZ: 140, cover: 'hard', frontY: 458, occluder: [[1100, 318], [1120, 316], [1140, 315], [1160, 314], [1180, 312], [1200, 309], [1200, 449], [1180, 452], [1160, 454], [1140, 455], [1120, 456], [1100, 458]] },
    { id: 'terrace-9', footprint: [[1200, 351], [1216, 351], [1232, 350], [1248, 350], [1264, 350], [1280, 350], [1280, 431], [1264, 434], [1248, 438], [1232, 442], [1216, 445], [1200, 449]], height: 140, topZ: 140, cover: 'hard', frontY: 449, occluder: [[1200, 309], [1216, 305], [1232, 302], [1248, 298], [1264, 294], [1280, 291], [1280, 431], [1264, 434], [1248, 438], [1232, 442], [1216, 445], [1200, 449]] },
    { id: 'terrace-10', footprint: [[1280, 350], [1292, 350], [1300, 350], [1340, 417], [1328, 420], [1316, 422], [1304, 425], [1292, 428], [1280, 431]], height: 140, topZ: 140, cover: 'hard', frontY: 431, occluder: [[1280, 291], [1292, 288], [1304, 285], [1316, 282], [1328, 280], [1340, 277], [1340, 417], [1328, 420], [1316, 422], [1304, 425], [1292, 428], [1280, 431]] },
    { id: 'lotus-pillar-l1', footprint: [[335, 585], [333, 589], [328, 592], [321, 595], [310, 598], [298, 599], [284, 601], [269, 601], [254, 601], [240, 599], [228, 598], [217, 595], [210, 592], [205, 589], [203, 585], [205, 581], [210, 578], [217, 575], [228, 572], [240, 571], [254, 569], [269, 569], [284, 569], [298, 571], [310, 572], [321, 575], [328, 578], [333, 581]], height: 54, topZ: 54, cover: 'hard', frontY: 601, occluder: [[203, 531], [205, 527], [211, 524], [220, 520], [232, 518], [246, 516], [261, 515], [277, 515], [292, 516], [306, 518], [318, 520], [327, 524], [333, 527], [335, 531], [339, 585], [337, 589], [331, 593], [321, 597], [309, 600], [294, 602], [277, 603], [261, 603], [244, 602], [229, 600], [217, 597], [207, 593], [201, 589], [199, 585]] },
    { id: 'lotus-pillar-l2', footprint: [[453, 483], [451, 487], [447, 490], [440, 494], [430, 496], [418, 498], [406, 500], [392, 500], [378, 500], [366, 498], [354, 496], [344, 494], [337, 490], [333, 487], [331, 483], [333, 479], [337, 476], [344, 472], [354, 470], [366, 468], [378, 466], [392, 466], [406, 466], [418, 468], [430, 470], [440, 472], [447, 476], [451, 479]], height: 106, topZ: 106, cover: 'hard', frontY: 500, occluder: [[331, 377], [333, 373], [338, 369], [346, 366], [357, 363], [370, 361], [385, 360], [399, 360], [414, 361], [427, 363], [438, 366], [446, 369], [451, 373], [453, 377], [457, 483], [455, 488], [450, 492], [441, 496], [429, 499], [415, 501], [400, 502], [384, 502], [369, 501], [355, 499], [343, 496], [334, 492], [329, 488], [327, 483]] },
    { id: 'lotus-pillar-r1', footprint: [[1542, 583], [1540, 587], [1535, 590], [1528, 593], [1517, 596], [1505, 597], [1491, 599], [1476, 599], [1461, 599], [1447, 597], [1435, 596], [1424, 593], [1417, 590], [1412, 587], [1410, 583], [1412, 579], [1417, 576], [1424, 573], [1435, 570], [1447, 569], [1461, 567], [1476, 567], [1491, 567], [1505, 569], [1517, 570], [1528, 573], [1535, 576], [1540, 579]], height: 52, topZ: 52, cover: 'hard', frontY: 599, occluder: [[1410, 531], [1412, 527], [1418, 524], [1427, 520], [1439, 518], [1453, 516], [1468, 515], [1484, 515], [1499, 516], [1513, 518], [1525, 520], [1534, 524], [1540, 527], [1542, 531], [1546, 583], [1544, 587], [1538, 591], [1528, 595], [1516, 598], [1501, 600], [1484, 601], [1468, 601], [1451, 600], [1436, 598], [1424, 595], [1414, 591], [1408, 587], [1406, 583]] },
    { id: 'lotus-pillar-r2', footprint: [[1416, 483], [1414, 487], [1410, 491], [1403, 494], [1393, 497], [1381, 499], [1369, 501], [1355, 501], [1341, 501], [1329, 499], [1317, 497], [1307, 494], [1300, 491], [1296, 487], [1294, 483], [1296, 479], [1300, 475], [1307, 472], [1317, 469], [1329, 467], [1341, 465], [1355, 465], [1369, 465], [1381, 467], [1393, 469], [1403, 472], [1410, 475], [1414, 479]], height: 104, topZ: 104, cover: 'hard', frontY: 501, occluder: [[1294, 379], [1296, 375], [1301, 371], [1309, 367], [1320, 364], [1333, 362], [1348, 361], [1362, 361], [1377, 362], [1390, 364], [1401, 367], [1409, 371], [1414, 375], [1416, 379], [1420, 483], [1418, 488], [1413, 492], [1404, 496], [1392, 499], [1378, 502], [1363, 503], [1347, 503], [1332, 502], [1318, 499], [1306, 496], [1297, 492], [1292, 488], [1290, 483]] },
  ],
  spawns: [[878, 790], [440, 740], [1310, 740], [620, 600], [1130, 600], [230, 690], [1510, 690], [878, 520]],
  start: { y: 700, left: 748, right: 1008 },
  centre: [878, 690],
};

/** The Storm Ship's quarterdeck: a raised deck along the right side, its base on the main deck from (1188, 406) back left
 *  to (1336, 797) front left, out to the ship's side on the right. Drawn in depth, so taller nearer (97 px at the back,
 *  150 at the front: `qdH`) — a second floor up there in 14 slices by depth, one step apart (walked across freely), and
 *  along its left side a lip as high as the next slice: a wall from the main deck (up there with a double jump, or from
 *  the crate beside it), a rail from above (jump over it to get down). */
const QD = { top: 406, bottom: 797, left: [[1188.5, 406], [1336, 797]] as Pt[], right: [[1452, 406], [1672, 754]] as Pt[], side: 1672, n: 14 };
const qdH = (yf: number): number => (150 * (yf + 294)) / 1089;
function quarterdeck(): WorldObject[] {
  const lerp = ([a, b]: Pt[], y: number) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
  const xl = (y: number) => lerp(QD.left, y), xr = (y: number) => (y <= QD.right[1][1] ? lerp(QD.right, y) : QD.side);
  const r1 = (v: number) => Math.round(v * 10) / 10, out: WorldObject[] = [];
  for (let k = 0; k < QD.n; k++) {
    const y0 = r1(QD.top + ((QD.bottom - QD.top) * k) / QD.n), y1 = r1(QD.top + ((QD.bottom - QD.top) * (k + 1)) / QD.n);
    const h = r1(qdH((y0 + y1) / 2)), next = r1(qdH(y1 + (QD.bottom - QD.top) / QD.n / 2));
    const corner = y0 < QD.right[1][1] && y1 > QD.right[1][1] ? [[QD.side, QD.right[1][1]] as Pt] : [];
    out.push({ id: `quarterdeck-${k + 1}`, soft: true, height: h, topZ: h, cover: 'none', occluder: [], frontY: y1,
      footprint: [[r1(xl(y0)), y0], [r1(xr(y0)), y0], ...corner, [r1(xr(y1)), y1], [r1(xl(y1)), y1]] });
    out.push({ id: `quarterdeck-lip-${k + 1}`, height: next, cover: 'hard', occluder: [], frontY: y1,
      footprint: [[r1(xl(y0) - 6), y0], [r1(xl(y0)), y0], [r1(xl(y1)), y1], [r1(xl(y1) - 6), y1]] });
  }
  return out;
}

/** The Storm Ship: the main deck (the mast in its middle, three crates to hide behind and jump on) and the quarterdeck
 *  raised along its right side — up there from the crate beside it, or with a double jump. Fitted to the painting. */
const SHIP_GEO: StageGeo = {
  floor: [[460, 444], [540, 428], [640, 424], [1150, 428], [1188, 406], [1452, 406], [1672, 754], [1672, 797], [1000, 797], [900, 795], [800, 789], [700, 781], [600, 769], [500, 753], [400, 729], [330, 708], [270, 686], [220, 661], [188, 632], [192, 600], [205, 562], [216, 522], [250, 498], [300, 481], [380, 465]],
  props: [
    // three crates: one by the back rail, one at the front left, one beside the quarterdeck (its step up)
    { id: 'crate-back', footprint: [[648, 453], [712, 451], [703, 486], [640, 487]], height: 65, topZ: 65, cover: 'hard', frontY: 487,
      occluder: [[646, 382], [716, 380], [713, 478], [704, 493], [639, 493], [637, 412]] },
    { id: 'crate-front', footprint: [[471, 645], [551, 643], [528, 704], [444, 705]], height: 75, topZ: 75, cover: 'hard', frontY: 705,
      occluder: [[468, 562], [555, 560], [551, 682], [531, 708], [443, 708], [441, 618]] },
    { id: 'crate-side', footprint: [[1140, 547], [1222, 547], [1232, 600], [1155, 600]], height: 60, topZ: 60, cover: 'hard', frontY: 600,
      occluder: [[1138, 483], [1226, 482], [1240, 540], [1238, 604], [1156, 606], [1135, 585]] },
    // the mast: round its foot, up out of sight (nobody jumps over it)
    { id: 'mast', footprint: Array.from({ length: 16 }, (_, i) => [Math.round(870 + 52 * Math.cos((i / 16) * Math.PI * 2)), Math.round(546 + 16 * Math.sin((i / 16) * Math.PI * 2))] as Pt),
      height: 700, cover: 'hard', frontY: 562,
      occluder: [[838, 0], [902, 0], [903, 480], [911, 500], [926, 525], [934, 545], [920, 556], [870, 561], [820, 556], [806, 545], [815, 525], [829, 500], [837, 480]] },
    ...quarterdeck(),
  ],
  spawns: [[760, 700], [300, 640], [1100, 700], [520, 500], [1000, 480], [620, 620], [990, 640], [360, 690]],
  start: { y: 660, left: 640, right: 920 },
  centre: [770, 640],
};

/** The Ice Palace: the throne hall — an open floor of ice; at the back in the middle the throne's dais, one long step in
 *  front of it (floor -> step -> dais, each within one jump; the dais straight from the floor only just), the throne at
 *  its back (the dais walked along in front of it); three ice columns either side, from the floor up out of sight: cover to hide behind and fight round, aisles
 *  behind them. Fitted to the painting. */
const iceColumn = (id: string, foot: Pt[], occluder: Pt[]): WorldObject =>
  ({ id, footprint: foot, height: 700, cover: 'hard', frontY: Math.max(...foot.map((p) => p[1])), occluder });
const ICE_GEO: StageGeo = {
  floor: [[0, 880], [0, 520], [58, 508], [62, 462], [172, 458], [240, 400], [330, 370], [480, 336], [590, 336], [590, 396], [1180, 396], [1180, 336], [1270, 336], [1440, 392], [1600, 468], [1672, 484], [1672, 880]],
  props: [
    { id: 'ice-step', footprint: [[556, 421], [1216, 421], [1216, 441], [556, 441]], height: 40, topZ: 40, cover: 'hard', frontY: 441,
      occluder: [[556, 381], [1216, 381], [1216, 441], [556, 441]] },
    // the dais reaches back past the floor's edge (its top as drawn is shallow: stood on in front of the throne)
    { id: 'ice-dais', footprint: [[595, 388], [1175, 388], [1175, 421], [595, 421]], height: 81, topZ: 81, cover: 'hard', frontY: 421,
      occluder: [[595, 322], [1175, 322], [1175, 381], [595, 381]] },
    iceColumn('ice-column-lf', [[192, 606], [316, 606], [318, 656], [190, 656]], [[205, 0], [304, 0], [304, 440], [312, 470], [318, 540], [318, 656], [190, 656], [190, 540], [197, 470], [205, 440]]),
    iceColumn('ice-column-lm', [[323, 474], [410, 474], [412, 508], [321, 508]], [[331, 0], [410, 0], [410, 380], [418, 440], [414, 508], [321, 508], [322, 440], [331, 380]]),
    iceColumn('ice-column-lb', [[416, 374], [485, 374], [487, 400], [414, 400]], [[414, 0], [481, 0], [481, 320], [489, 370], [487, 400], [414, 400], [410, 370], [414, 320]]),
    iceColumn('ice-column-rb', [[1279, 384], [1350, 384], [1352, 412], [1277, 412]], [[1283, 0], [1351, 0], [1351, 330], [1357, 380], [1352, 412], [1277, 412], [1276, 380], [1283, 330]]),
    iceColumn('ice-column-rm', [[1359, 482], [1437, 482], [1439, 514], [1357, 514]], [[1357, 0], [1437, 0], [1437, 390], [1446, 450], [1440, 514], [1356, 514], [1350, 450], [1357, 390]]),
    iceColumn('ice-column-rf', [[1475, 610], [1584, 610], [1588, 658], [1471, 658]], [[1479, 0], [1596, 0], [1596, 450], [1600, 540], [1588, 658], [1471, 658], [1462, 540], [1479, 450]]),
  ],
  spawns: [[880, 760], [460, 720], [1300, 720], [640, 560], [1120, 560], [300, 780], [1460, 780], [880, 500]],
  start: { y: 690, left: 740, right: 1020 },
  centre: [880, 690],
};

export const STAGES: Stage[] = [
  { id: 'courtyard', place: 'courtyard', name: 'LEGACY COURTYARD', file: 'assets/environment/Legacy_Courtyard.png', key: 'legacy-courtyard', preview: 'assets/pvp/stages/courtyard.webp', look: COURTYARD_LOOK, geo: COURTYARD_GEO },
  { id: 'lava', place: 'lava', name: 'LAVA FORTRESS', file: 'assets/environment/stages/lava_fortress.webp', key: 'stage-lava-fortress', preview: 'assets/pvp/stages/lava.webp', look: LAVA_LOOK, geo: LAVA_GEO },
  { id: 'shaolin', place: 'shaolin', name: 'SHAOLIN MONASTERY', file: 'assets/environment/stages/shaolin_monastery.webp', key: 'stage-shaolin-monastery', preview: 'assets/pvp/stages/shaolin.webp', look: SHAOLIN_LOOK, geo: SHAOLIN_GEO,
    extras: [{ key: 'shaolin-dragon-body', file: 'assets/pvp/stages/shaolin_dragon_body.webp' }, { key: 'shaolin-dragon-head', file: 'assets/pvp/stages/shaolin_dragon_head.webp' }],
    poster: 'assets/pvp/stages/shaolin_poster.webp' },
  { id: 'sakura', place: 'sakura', name: 'SAKURA TEMPLE', file: 'assets/environment/stages/sakura_temple.webp', key: 'stage-sakura-temple', preview: 'assets/pvp/stages/sakura.webp', look: SAKURA_LOOK, geo: SAKURA_GEO },
  { id: 'ship', place: 'ship', name: 'STORM SHIP', file: 'assets/environment/stages/storm_ship.webp', key: 'stage-storm-ship', preview: 'assets/pvp/stages/ship.webp', look: SHIP_LOOK, geo: SHIP_GEO,
    extras: [{ key: 'ship-water', file: 'assets/pvp/stages/ship_water.png' }, { key: 'ship-bolt', file: 'assets/pvp/stages/ship_bolt.png' }, { key: 'ship-beam', file: 'assets/pvp/stages/ship_beam.png' }],
    poster: 'assets/pvp/stages/ship_poster.webp' },
  { id: 'ice', place: 'ice', name: 'ICE PALACE', file: 'assets/environment/stages/ice_palace.webp', key: 'stage-ice-palace', preview: 'assets/pvp/stages/ice.webp', look: ICE_LOOK, geo: ICE_GEO,
    extras: [{ key: 'ice-aurora', file: 'assets/pvp/stages/ice_aurora.png' }] },
];

const hash = (s: string, seed: number): number => {
  let h = seed >>> 0;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
};

/** A stage by its id (the stage select's choice). */
export function stageById(id: string | undefined | null): Stage | undefined { return STAGES.find((s) => s.id === id); }

/** The stage of a room (the same on every screen in it): a place, then one of its moods. */
export function stageOf(room: string | undefined | null): Stage {
  const places = [...new Set(STAGES.map((s) => s.place))];
  const place = places[hash(room ?? '', 2166136261) % places.length];
  const moods = STAGES.filter((s) => s.place === place);
  return moods[hash(room ?? '', 374761393) % moods.length];
}
