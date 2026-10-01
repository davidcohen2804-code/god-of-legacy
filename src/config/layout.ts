// All layout and style constants for the Main Menu stage (design space 1920x1080).

export const DESIGN = { width: 1920, height: 1080 } as const;

export const FONT_FAMILY = 'Cinzel, Georgia, serif';

export const ASSETS = {
  background: { key: 'mainmenu-bg', file: 'assets/MainMenu_Background_1920x1080.png' },
  logo: { key: 'logo', file: 'assets/GodOfLegacy_Logo_Transparent.png' },
  start: { key: 'btn-start', file: 'assets/StartButton.png' },
  settings: { key: 'btn-settings', file: 'assets/SettingsButton.png' },
  exit: { key: 'btn-exit', file: 'assets/ExitButton.png' },
} as const;

export const LOGO = { centerX: 960, top: 28, width: 900 } as const;

export interface ButtonLayout { x: number; y: number; w: number; h: number }

export const MENU_BUTTONS: Record<'start' | 'settings' | 'exit', ButtonLayout> = {
  start: { x: 960, y: 585, w: 600, h: 150 },
  settings: { x: 960, y: 735, w: 500, h: 120 },
  exit: { x: 960, y: 860, w: 500, h: 120 },
};

export const BUTTON_FX = {
  hoverDuration: 120,
  hoverScale: 1.025,
  hoverBrightness: 1.12,
  hoverGlowColor: 0xffb45a,
  hoverGlowStrength: 1.4,
  pressedScale: 0.985,
  pressedBrightness: 0.92,
  pressedOffsetY: 2,
} as const;

export const VERSION = { text: 'v0.1.0', right: 28, bottom: 22, size: 24, color: '#F3E7CF' } as const;

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
  w: 760,
  h: 560,
  headerSize: 38,
  labelSize: 24,
  headerOffsetY: 62, // from panel top
  firstRowOffsetY: 150, // from panel top
  rowGap: 68,
  labelX: 620,
  controlX: 880,
  controlW: 320,
  valueRightX: 1300,
  back: { offsetY: 70, w: 220, h: 56 }, // offsetY measured from panel bottom
} as const;

export const EXIT_PANEL = {
  w: 620,
  h: 280,
  titleSize: 32,
  titleOffsetY: 95,
  buttonsOffsetY: 70, // from panel bottom
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
export const CLASS_NAMES: Record<string, string> = { warrior: 'Warrior' };

export const CHARACTER_CREATE = {
  title: { text: 'CREATE YOUR LEGACY', top: 46, size: 46 },
  character: {
    x: 90, y: 190, w: 470, h: 330, headerSize: 32, headerTop: 30,
    labelTop: 110, labelSize: 20, input: { top: 145, h: 58, size: 24, maxLength: 16 },
  },
  classPanel: { x: 1390, y: 190, w: 425, h: 330, headerSize: 32, headerTop: 30, nameTop: 150, nameSize: 40 },
  preview: { centerX: 985, top: 110, height: 790, pedestalY: 885, rx: 235, ry: 57 },
  buttons: {
    back: { x: 90, y: 855, w: 255, h: 64, size: 28 },
    create: { x: 1390, y: 842, w: 425, h: 70, size: 28 },
  },
  classId: 'warrior',
  appearanceId: 'warrior_default',
} as const;

/** classId/appearanceId -> full-body preview (Character Select stage + slot portrait crop in source pixels). */
export const CHARACTER_PREVIEWS: Record<string, { key: string; file: string; width: number; height: number; crop: { x: number; y: number; w: number } }> = {
  'warrior/warrior_default': {
    key: 'characterCreate.warriorPreview', file: 'assets/Warrior_Preview.png', width: 1024, height: 1536,
    crop: { x: 400, y: 40, w: 420 },
  },
};

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

// ======================= Build / QA =======================
export const CURRENT_STAGE = 'Stage 5 — Training Combat';
