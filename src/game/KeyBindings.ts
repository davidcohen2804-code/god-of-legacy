// Key bindings (MapleStory-style KEY SETTINGS): every action on any key, saved on this device.
// Fixed, never rebindable: arrow keys (movement), Enter (chat), Esc (close / menu).
// Key names are Phaser KeyCodes names (keydown-<NAME> events).

export const SLOT_COUNT = 16;
export type BindAction = string; // 'slot0'..'slot13' | 'jump' | 'up' | 'left' | 'down' | 'right' | 'book' | 'bag' | 'shop' | 'quests' | 'talk'

export const DEFAULT_BINDINGS: Record<BindAction, string> = {
  slot0: 'SPACE', slot1: 'ONE', slot2: 'TWO', slot3: 'THREE', slot4: 'FOUR', slot5: 'FIVE', slot6: 'SIX', slot7: 'SEVEN',
  slot8: 'Q', slot9: 'R', slot10: 'F', slot11: 'G', slot12: 'C', slot13: 'V', slot14: 'T', slot15: 'H',
  jump: 'E', up: 'W', left: 'A', down: 'S', right: 'D', book: 'K', bag: 'I', shop: 'O', quests: 'J',
  talk: 'Y', // talk to an NPC / step into a portal
};
export const ACTIONS: BindAction[] = Object.keys(DEFAULT_BINDINGS);

/** Keyboard rows shown in the Key Settings window (Phaser key names). */
export const KEY_ROWS: string[][] = [
  ['BACKTICK', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO', 'MINUS', 'PLUS'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'OPEN_BRACKET', 'CLOSED_BRACKET'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'SEMICOLON', 'QUOTES'],
  ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'COMMA', 'PERIOD', 'FORWARD_SLASH'],
  ['CTRL', 'ALT', 'SPACE'],
];
const BINDABLE = new Set(KEY_ROWS.flat());

const LABEL: Record<string, string> = {
  BACKTICK: '`', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9', ZERO: '0',
  MINUS: '-', PLUS: '=', OPEN_BRACKET: '[', CLOSED_BRACKET: ']', SEMICOLON: ';', QUOTES: "'", COMMA: ',', PERIOD: '.', FORWARD_SLASH: '/',
  SPACE: 'SPACE', SHIFT: 'SHIFT', CTRL: 'CTRL', ALT: 'ALT',
};
export const keyLabel = (k: string | undefined): string => (k ? LABEL[k] ?? k : '');

const STORE = 'godoflegacy.keys';

/** Saved bindings merged over the defaults (unknown keys / duplicates dropped: one action per key). */
export function loadBindings(): Record<BindAction, string> {
  const b = { ...DEFAULT_BINDINGS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Record<string, string> | null;
    if (saved && typeof saved === 'object') {
      for (const a of ACTIONS) if (a in saved) b[a] = typeof saved[a] === 'string' && BINDABLE.has(saved[a]) ? saved[a] : '';
      const seen = new Set<string>();
      for (const a of ACTIONS) { if (!b[a]) continue; if (seen.has(b[a])) b[a] = ''; else seen.add(b[a]); }
    }
  } catch { /* storage unavailable: defaults */ }
  return b;
}

export function saveBindings(b: Record<BindAction, string>): void {
  try { localStorage.setItem(STORE, JSON.stringify(b)); } catch { /* storage unavailable: this session only */ }
}

/** Hotkey label of every skill slot (tray, skill book). */
export const slotKeyLabels = (b = loadBindings()): string[] => Array.from({ length: SLOT_COUNT }, (_, i) => keyLabel(b[`slot${i}`]));
