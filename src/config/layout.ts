// All layout and style constants for the Main Menu stage (design space 1920x1080).

export const DESIGN = { width: 1920, height: 1080 } as const;

export const FONT_FAMILY = 'Cinzel, Georgia, serif';

export const ASSETS = {
  background: { key: 'mainmenu-bg', file: 'assets/MainMenu_Background_1920x1080.png' },
  logo: { key: 'logo', file: 'assets/GodOfLegacy_Logo_Transparent.png' },
  start: { key: 'btn-start', file: 'assets/StartButton.png' },
  settings: { key: 'btn-settings', file: 'assets/SettingsButton.png' },
  exit: { key: 'btn-exit', file: 'assets/ExitButton.png' },
  pvp: { key: 'btn-pvp', file: 'assets/PvpArenaButton.png' },
} as const;

export const LOGO = { centerX: 960, top: 28, width: 900 } as const;

export interface ButtonLayout { x: number; y: number; w: number; h: number }

export const MENU_BUTTONS: Record<'start' | 'pvp' | 'settings' | 'exit', ButtonLayout> = {
  start: { x: 960, y: 590, w: 600, h: 150 },
  pvp: { x: 960, y: 690, w: 500, h: 120 }, // PvP moved to Character Select (under ENTER WORLD); not on the main menu
  settings: { x: 960, y: 730, w: 500, h: 120 },
  exit: { x: 960, y: 850, w: 500, h: 120 },
};

export const BUTTON_FX = {
  hoverDuration: 120,
  hoverScale: 1.02,
  hoverBrightness: 1.12,
  hoverGlowColor: 0xffb45a,
  hoverGlowStrength: 1.4,
  pressedScale: 0.985,
  pressedBrightness: 0.92,
  pressedOffsetY: 2,
} as const;

export const VERSION = { text: 'v0.2.0', right: 28, bottom: 22, size: 24, color: '#F3E7CF' } as const;

export const COLORS = {
  gold: 0xc99a45,
  goldCss: '#C99A45',
  text: '#F3E7CF',
  panelBg: 0x0a121c,
  panelAlpha: 0.96,
  overlayAlpha: 0.55,
  track: 0x26303c,
  crimson: 0x8a2b2b,
  buttonBg: 0x142131,
  buttonBgHover: 0x1d2e42,
} as const;

export const SETTINGS_PANEL = {
  // kit/modal_window.png stretched to w x h: header strip centre ~116px, body 158..527px from the top
  w: 760,
  h: 620,
  headerSize: 30,
  labelSize: 22,
  headerOffsetY: 116, // from panel top
  firstRowOffsetY: 190, // from panel top
  rowGap: 56,
  iconX: 652,
  labelX: 684,
  controlX: 900,
  controlW: 300,
  valueRightX: 1290,
  back: { offsetY: 112, w: 200, h: 50 }, // offsetY measured from panel bottom
} as const;

export const EXIT_PANEL = {
  w: 620,
  h: 280,
  titleSize: 32,
  titleOffsetY: 112,
  buttonsOffsetY: 78, // from panel bottom
  buttonGap: 130,
  button: { w: 200, h: 56 },
} as const;

export const RESOLUTIONS = ['1280x720', '1600x900', '1920x1080'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// ======================= Stage 2: Character Select =======================

/** Central manifest for Stage 2 assets (key === manifest name). */
export const ASSET_MANIFEST = {
  'characterSelect.background': 'assets/CharacterSelect_Background_1920x1080.png',
  'characterSelect.slotFrame': 'assets/CharacterSlot_Frame.png',
  'characterCreate.warriorPreview': 'assets/Warrior_Preview.png',
  'bookMage.preview': 'assets/characters/book-mage/Book_Mage_Preview.png',
  'archer.preview': 'assets/characters/archer/Archer_Preview.png',
  'samurai.preview': 'assets/characters/samurai/Samurai_Preview.png',
  'base.male': 'assets/characters/base/Base_Male.png',
  'base.female': 'assets/characters/base/Base_Female.png',
} as const;
export type AssetKey = keyof typeof ASSET_MANIFEST;

export const CHARACTER_SELECT = {
  title: { text: 'SELECT YOUR LEGACY', centerX: 960, top: 46, size: 46 },
  slots: {
    x: 90, firstY: 190, step: 155, w: 430, h: 132,
    portrait: { x: 19, y: 19, size: 84 },
    textX: 120, nameSize: 23, subSize: 21,
    hoverBrightness: 1.05, selectedBrightness: 1.08, selectedScale: 1.015, pressedScale: 0.99, duration: 120,
  },
  preview: { x0: 650, x1: 1320, pedestalY: 822, rx: 235, ry: 57 },
  info: {
    x: 1390, y: 210, w: 425, h: 500, headerSize: 32, fieldSize: 22,
    headerTop: 34, fieldsTop: 120, fieldStep: 58, padX: 58,
  },
  buttons: {
    back: { x: 90, y: 855, w: 255, h: 64, size: 28 },
    delete: { x: 360, y: 855, w: 255, h: 64, size: 28 },
    enter: { x: 1390, y: 750, w: 425, h: 78, size: 32 },
    create: { x: 1390, y: 842, w: 425, h: 70, size: 28 },
  },
  modal: { w: 620, h: 280, titleSize: 32 },
} as const;

// ======================= Stage 3: Character Creation =======================

/** Display names for stored classId values. */
export const CLASS_NAMES: Record<string, string> = { warrior: 'Warrior', book_mage: 'Book Mage', archer: 'Archer', samurai: 'Samurai' };

/** Selectable classes in Character Creation (classId + its single appearance). */
export const CLASS_OPTIONS = [
  { classId: 'warrior', appearanceId: 'warrior_default' },
  { classId: 'book_mage', appearanceId: 'book_mage_default' },
  { classId: 'archer', appearanceId: 'archer_default' },
  { classId: 'samurai', appearanceId: 'samurai_default' },
] as const;

export const CHARACTER_CREATE = {
  title: { text: 'CREATE YOUR LEGACY', top: 46, size: 46 },
  character: {
    x: 90, y: 190, w: 470, h: 330, headerSize: 32, headerTop: 30,
    labelTop: 110, labelSize: 20, input: { top: 145, h: 58, size: 24, maxLength: 16 },
  },
  classPanel: { x: 1390, y: 190, w: 425, h: 400, headerSize: 32, headerTop: 30, optionTop: 104, optionGap: 72, optionW: 345, optionH: 58, optionSize: 24 },
  preview: { centerX: 985, top: 110, height: 790, pedestalY: 885, rx: 235, ry: 57 },
  buttons: {
    back: { x: 90, y: 855, w: 255, h: 64, size: 28 },
    create: { x: 1390, y: 842, w: 425, h: 70, size: 28 },
  },
} as const;

/** classId/appearanceId -> full-body preview (Character Select stage + slot portrait crop in source pixels). */
export const CHARACTER_PREVIEWS: Record<string, { key: string; file: string; width: number; height: number; crop: { x: number; y: number; w: number }; portrait?: string }> = {
  // the clean base character (menus show him / her standing; portraits crop the head)
  'base/male': { key: 'base.male', file: 'assets/characters/base/Base_Male.png', width: 372, height: 733, crop: { x: 86, y: 14, w: 234 } },
  'base/female': { key: 'base.female', file: 'assets/characters/base/Base_Female.png', width: 365, height: 733, crop: { x: 70, y: 14, w: 232 } },
  'warrior/warrior_default': {
    key: 'characterCreate.warriorPreview', file: 'assets/Warrior_Preview.png', width: 1024, height: 1536,
    crop: { x: 400, y: 40, w: 420 },
  },
  'book_mage/book_mage_default': {
    key: 'bookMage.preview', file: 'assets/characters/book-mage/Book_Mage_Preview.png', width: 1086, height: 1448,
    crop: { x: 295, y: 0, w: 430 }, portrait: 'assets/characters/book-mage/Book_Mage_Portrait.png',
  },
  'archer/archer_default': {
    key: 'archer.preview', file: 'assets/characters/archer/Archer_Preview.png', width: 1086, height: 1448,
    crop: { x: 400, y: 30, w: 400 },
  },
  'samurai/samurai_default': {
    key: 'samurai.preview', file: 'assets/characters/samurai/Samurai_Preview.png', width: 1086, height: 1448,
    crop: { x: 390, y: 20, w: 400 },
  },
};

/** Book Mage world sprite: explicit rects in src/data/book-mage-atlas.json (irregular sheet, no uniform grid). */
export const BOOK_MAGE_WORLD = {
  sheetKey: 'bookMage.sheet', sheetFile: 'assets/characters/book-mage/Book_Mage_Full_Sheet.png', walkFps: 8,
} as const;

/** Full-body preview on the Character Select platform (feet on the pedestal). */
export const CHARACTER_SELECT_PREVIEW = { centerX: 985, feetY: 835, height: 700 } as const;

// ======================= Stage 4: Legacy Courtyard =======================

/** World HUD (DOM overlay, 1920x1080 design coords). Map/movement data live in src/data/legacy-courtyard.json. */
export const WORLD_HUD = {
  name: { x: 40, y: 30, w: 380, h: 70, size: 28 },
  back: { x: 1540, y: 33, w: 340, h: 64, size: 24 },
  shadow: { w: 36, h: 12, offsetY: -2, alpha: 0.33 },
  hint: { text: 'SPACE — ATTACK', centerX: 960, y: 1005, w: 300, h: 50, size: 22 },
} as const;

// ======================= Stage 6: Enemy Combat + Feel Polish =======================
// Gameplay numbers live in src/data/stage6-combat.json; these are the approved placement/size/timing values
// that the JSON does not define. World values are Stage 4 map pixels; Character Select values are 1920x1080 screen pixels.
export const STAGE6 = {
  enemy: {
    spawn: { x: 1240, y: 430 }, collisionRadius: 18, footRadius: 10, respawnClearRadius: 28,
    origin: { x: 0.5, y: 0.95 }, framePath: 'assets/enemy/cursed_swordsman',
    actions: { idle: 4, walk: 6, attack: 6, hurt: 2, death: 6 },
    idleFps: 8, walkFps: 10, deathFps: 10,
    attackFrames: { windup: 2, active: 1, recovery: 3 }, // frames per phase (phase ms come from JSON)
    hitCone: 0.5, // cos(60°): ±60° facing cone
    impactOffsetY: -60, hitFlashMs: 80,
  },
  slash: { path: 'assets/fx/sword_slash', frames: 6, displayHeight: 90, forward: 40, up: 40,
    rotationDeg: { right: 0, down: 90, left: 180, up: -90 } },
  dust: { path: 'assets/fx/movement_dust', frames: 6, displayWidth: 44, minIntervalMs: 140 },
  player: { walkThreshold: 12, hitFlashWhiteMs: 60, hitFlashRedMs: 140, deathFadeMs: 450, deathPauseMs: 2100, deathAlpha: 0 },
} as const;

// ======================= Visual polish (after Stage 6) =======================

/** Character Select: one soft golden halo under the boots, concentric with the pedestal ellipse, plus a contact shadow. */
export const SELECT_HALO = {
  centerX: 985, centerY: 822, rx: 175, ry: 42, // same centre as CHARACTER_SELECT.preview pedestal
  alpha: [0.38, 0.62], scale: [0.97, 1.03], pulseMs: 3200,
  shadow: { x: 985, y: 832, rx: 80, ry: 13, alpha: 0.5 },
} as const;

/** Courtyard ambience (world = map pixels). Light comes from the upper right, like the baked map lighting. */
export const AMBIENCE = {
  clouds: { size: 512, blobs: 9, groundTop: 250, tileScale: 1.6, squash: 0.6, alpha: 0.3, driftX: 9, driftY: 3 },
  sun: { x: 1450, y: 230, width: 1400, height: 820, alpha: 0.12, breatheMs: 9000 },
  rays: {
    angle: 25, length: 900, breatheMs: 7000,
    list: [{ x: 1350, y: 200, width: 140, alpha: 0.06 }, { x: 1150, y: 220, width: 90, alpha: 0.045 }, { x: 1520, y: 260, width: 110, alpha: 0.05 }],
  },
} as const;

// ======================= PVP Arena (basic) =======================
/** World values are courtyard map pixels. Combat numbers (damage 25, range, facing, timing) come from training-combat.json. */
export const PVP = {
  maxPlayers: 8,
  maxHp: 100,
  respawnMs: 1600,
  sendHz: 20, // movement snapshots per second while something changes
  idleResendMs: 500, // keep-alive snapshot when nothing changes (late joiners get state)
  interpDelayMs: 100, // remote players render this far in the past, interpolated
  spawnPoints: [
    { x: 835, y: 780 }, { x: 330, y: 770 }, { x: 1300, y: 800 }, { x: 640, y: 370 },
    { x: 1100, y: 370 }, { x: 240, y: 560 }, { x: 1490, y: 500 }, { x: 835, y: 560 },
  ],
  spawnClearRadius: 120, // a spawn point closer than this to another player counts as occupied
  remoteLabel: { size: 13, color: '#F3E7CF', gap: 6 },
  hpBar: { w: 46, h: 5, fill: '#A73125', background: '#1B1F25', border: '#B79A5B' },
  labelDepth: 100000,
  impactUp: 64,
  hud: { exitText: 'EXIT ARENA', status: { centerX: 960, centerY: 540, w: 420, h: 70, size: 28 } },
} as const;

// ======================= In-game HUD (God-Of-Legacy-HUD package, hud-manifest.json) =======================
/** 1920x1080 design pixels; the shared DOM overlay scales them to the displayed game rect (1280x720 => x2/3). */
export const HUD = {
  path: 'assets/hud',
  player: { x: 28, y: 28, w: 430, h: 144 },
  buffs: { x: 28, y: 184, w: 224, h: 32, icon: 32, gap: 6, max: 6 },
  target: { x: 780, y: 28, w: 360, h: 108, icon: 40, effectsY: 120, effectIcon: 24 },
  minimap: { x: 1700, y: 28, w: 192, h: 224, inset: [14, 14, 14, 46] as const, marker: 20, updateMs: 100 },
  pvp: { x: 1700, y: 264, w: 192, h: 52 },
  skills: { x: 401, y: 950, w: 1118, h: 108, slot: 64, gap: 12, inner: [25, 14] as const, hotkeys: ['Space', '1', '2', '3', '4', '5', '6', '7', 'Q', 'R', 'F', 'G', 'C', 'V'] },
  combat: { x: 1652, y: 976, w: 240, h: 72 },
  back: { x: 28, y: 1000, w: 300, h: 52, size: 20 },
  /** Target = nearest living hostile within this many world px of the player (display only). */
  targetRadius: 260,
  pressMs: 80, barEaseMs: 120, feedbackFadeMs: 180,
  palette: { surface: '#0d131b', gold: '#b49a59', text: '#efddb0', secondary: '#bbc3cc' },
  bodyFont: '"Segoe UI", Arial, sans-serif',
} as const;

// ======================= Build / QA =======================
export const CURRENT_STAGE = 'Final Master V3';
