// KEY SETTINGS window (MapleStory style): a keyboard; drag any skill or action onto any key (or click the action, then
// the key). Drag a key's action back to the palette to clear it. DEFAULT restores the original layout, SAVE applies.
// Arrows (move), Enter (chat) and Esc (menu / close) are fixed.
import { FONT_FAMILY, HUD } from '../config/layout';
import { ACTIONS, BindAction, DEFAULT_BINDINGS, KEY_ROWS, keyLabel, saveBindings } from '../game/KeyBindings';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const STYLE_ID = 'gol-keys-style';
/** keys_window.png (1655x919, GPT) shown 1440 px wide, centred; zones measured on the art (art px, cut origin). */
const SC = 1440 / 1655;
const A = (v: number) => Math.round(v * SC);
const W = { x: (1920 - 1440) / 2, y: 120, w: 1440, h: A(919) };
const Z = {
  board: { x: A(70), y: A(160), w: A(1518), h: A(426) },   // upper recessed panel: the keyboard
  pal: { x: A(70), y: A(620), w: A(1518), h: A(147) },     // lower recessed panel: the actions
  hint: { x: A(70) + 18, y: A(782), w: A(905), h: A(100) },
  btnL: { x: A(999), y: A(787), w: A(285), h: A(73) },
  btnR: { x: A(1302), y: A(787), w: A(284), h: A(73) },
  title: { y: A(81) },
  close: { x: A(1602), y: A(101), d: A(66) },
};
/** Keys: an empty key shows its letter big; a key in use shows the action's icon, its letter on a small tag in the corner. */
const KEY = 64, GAP = 8, CHIP = 46;
const WIDE: Record<string, number> = { SHIFT: 2 * KEY + GAP, CTRL: Math.round(1.5 * KEY), ALT: Math.round(1.5 * KEY), SPACE: 6 * KEY + 5 * GAP };
const ROW_X = [0, 36, 54, 0, 136];
const OTHER: Record<string, { short: string; name: string }> = {
  jump: { short: 'JUMP', name: 'Jump' }, up: { short: '▲', name: 'Move up' }, left: { short: '◀', name: 'Move left' },
  down: { short: '▼', name: 'Move down' }, right: { short: '▶', name: 'Move right' }, book: { short: 'BOOK', name: 'Skill Book' },
  bag: { short: 'BAG', name: 'Inventory' }, shop: { short: 'SHOP', name: 'Cosmetic Shop' }, quests: { short: 'QUEST', name: 'Quest Log' },
  talk: { short: 'TALK', name: 'Talk to NPC / Enter portal' }, party: { short: 'PARTY', name: 'Party' },
};
/** Actions drawn with a kit icon instead of a word. */
const ICON: Record<string, string> = { bag: 'icon_items', shop: 'icon_cosmetics', quests: 'ico_quest', party: 'ico_party', talk: 'ico_chat' };
const HINT = 'Drag a skill or action onto a key, or click it and then the key. Drag it back to the lower panel to clear it. Fixed keys: arrows move, Enter chats, Esc closes.';

const CSS = `
.gol-keys{position:absolute;left:${W.x}px;top:${W.y}px;width:${W.w}px;height:${W.h}px;display:none;pointer-events:auto;
  background:url("${K('keys_window')}") center/100% 100% no-repeat;font-family:${HUD.bodyFont};color:#efddb0;filter:drop-shadow(0 10px 24px rgba(0,0,0,.6))}
.gol-keys.open{display:block}
.gol-keys .ttl{position:absolute;left:0;right:0;top:${Z.title.y - 17}px;text-align:center;font:700 26px ${FONT_FAMILY};letter-spacing:4px;color:#f3d58a;text-shadow:0 2px 4px #000}
.gol-keys .x{position:absolute;left:${Z.close.x - Z.close.d / 2}px;top:${Z.close.y - Z.close.d / 2}px;width:${Z.close.d}px;height:${Z.close.d}px;border:0;padding:0;
  background:transparent;cursor:pointer;border-radius:50%}
.gol-keys .x:hover{box-shadow:0 0 10px 3px rgba(255,215,120,.6)}
.gol-keys .board{position:absolute;left:${Z.board.x}px;top:${Z.board.y}px;width:${Z.board.w}px;height:${Z.board.h}px;display:flex;align-items:center;justify-content:center}
.gol-keys .kb{position:relative}
.gol-keys .key{position:absolute;height:${KEY}px;box-sizing:border-box;background:url("${K('keycap')}") center/100% 100% no-repeat;cursor:pointer;transition:filter 100ms}
.gol-keys .key.wide{background-image:url("${K('keycap_wide')}")}
.gol-keys .key:hover{filter:brightness(1.18)}
.gol-keys .key .lb{position:absolute;left:0;right:0;top:0;bottom:2px;display:flex;align-items:center;justify-content:center;font:700 19px ${FONT_FAMILY};color:#8f8160;pointer-events:none}
.gol-keys .key.wide .lb{font-size:15px;letter-spacing:1.5px}
.gol-keys .key.used .lb{left:-3px;top:-5px;right:auto;bottom:auto;z-index:2;min-width:20px;height:19px;padding:0 5px;box-sizing:border-box;border-radius:5px;
  background:#070c16;box-shadow:inset 0 0 0 1px rgba(201,154,69,.75);font-size:12px;line-height:19px;letter-spacing:0;color:#ffe2a0}
.gol-keys .key.over{filter:brightness(1.35) drop-shadow(0 0 6px rgba(255,215,120,.8))}
.gol-keys.picking .key:hover{filter:brightness(1.35) drop-shadow(0 0 6px rgba(255,215,120,.8))}
.gol-keys .key .chip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:38px;height:38px}
.gol-keys .key .chip.txt{width:auto;min-width:38px}
.gol-keys .chip{width:${CHIP}px;height:${CHIP}px;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:grab;box-sizing:border-box;
  background:center/100% 100% no-repeat;font:700 12px ${FONT_FAMILY};color:#ffe9a8;text-shadow:0 1px 2px #000;letter-spacing:.5px;user-select:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.gol-keys .chip.txt{background:#0a1224;box-shadow:inset 0 0 0 1px #b48a3c;padding:0 5px}
.gol-keys .chip.ico{background-size:76% 76%;background-color:#0a1224;box-shadow:inset 0 0 0 1px #b48a3c}
.gol-keys .chip.sel{box-shadow:0 0 0 2px #ffd76e,0 0 12px 3px rgba(255,215,120,.75)}
.gol-keys .pal{position:absolute;left:${Z.pal.x}px;top:${Z.pal.y}px;width:${Z.pal.w}px;height:${Z.pal.h}px;box-sizing:border-box;
  display:flex;align-items:center;justify-content:center;gap:64px;border-radius:8px}
.gol-keys .pal.over{box-shadow:inset 0 0 0 2px #ffd76e}
.gol-keys .grp small{display:block;margin-bottom:6px;font:700 13px/16px ${FONT_FAMILY};letter-spacing:3px;color:#cdb98a;text-shadow:0 1px 2px #000}
.gol-keys .grp .cells{display:grid;gap:8px}
.gol-keys .pal .slot{position:relative}
.gol-keys .pal .slot.free::after{content:'';position:absolute;right:-3px;top:-3px;width:9px;height:9px;border-radius:50%;background:#ff7a5c;box-shadow:0 0 4px #ff7a5c}
.gol-keys .hint{position:absolute;left:${Z.hint.x}px;top:${Z.hint.y}px;width:${Z.hint.w}px;height:${Z.hint.h}px;display:flex;align-items:center;font-size:15px;line-height:21px;color:#c3b89e}
.gol-keys .hint b{color:#ffe2a0}
.gol-keys .b{position:absolute;border:0;padding:0;background:transparent;color:#efddb0;font:700 17px ${FONT_FAMILY};letter-spacing:2px;cursor:pointer;
  text-shadow:0 1px 2px #000;border-radius:30px}
.gol-keys .b:hover{color:#fff3cf;box-shadow:0 0 12px 2px rgba(255,215,120,.45)}
`;

export interface KeyAction { id: BindAction; short: string; name: string; icon?: string }

export class KeySettings {
  private root: HTMLDivElement;
  private kb: HTMLDivElement;
  private pal: HTMLDivElement;
  private keys = new Map<string, HTMLDivElement>();
  private work: Record<BindAction, string> = { ...DEFAULT_BINDINGS };
  private sel: BindAction | null = null;
  private actions: KeyAction[] = [];
  private hint!: HTMLDivElement;
  private onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  /** skills: the 16 hotbar skills (slot order) with icon and name; onApply(bindings) after SAVE; onOpen(open) for input focus. */
  constructor(parent: HTMLElement, skills: { name: string; icon: string }[], private onApply: (b: Record<BindAction, string>) => void, private onOpen: (open: boolean) => void) {
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.actions = ACTIONS.map((id) => {
      const m = /^slot(\d+)$/.exec(id);
      if (m) { const s = skills[+m[1]]; return { id, short: '', name: s?.name ?? `Skill ${+m[1] + 1}`, icon: s?.icon }; }
      return { id, ...OTHER[id], ...(ICON[id] ? { icon: K(ICON[id]) } : {}) };
    });
    this.root = document.createElement('div'); this.root.className = 'gol-keys';
    const ttl = document.createElement('div'); ttl.className = 'ttl'; ttl.textContent = 'KEY SETTINGS';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => this.close());
    const board = document.createElement('div'); board.className = 'board';
    this.kb = document.createElement('div'); this.kb.className = 'kb'; board.appendChild(this.kb);
    let maxW = 0;
    KEY_ROWS.forEach((row, r) => {
      let cx = ROW_X[r];
      for (const name of row) {
        const w = WIDE[name] ?? KEY;
        const k = document.createElement('div'); k.className = `key${w > KEY ? ' wide' : ''}`;
        Object.assign(k.style, { left: `${cx}px`, top: `${r * (KEY + GAP)}px`, width: `${w}px` });
        const lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = keyLabel(name); k.appendChild(lb);
        k.addEventListener('dragover', (e) => { e.preventDefault(); k.classList.add('over'); });
        k.addEventListener('dragleave', () => k.classList.remove('over'));
        k.addEventListener('drop', (e) => { e.preventDefault(); k.classList.remove('over'); const a = e.dataTransfer?.getData('text/plain'); if (a) this.bind(a, name); });
        k.addEventListener('click', () => { if (this.sel) this.bind(this.sel, name); });
        this.kb.appendChild(k); this.keys.set(name, k);
        cx += w + GAP;
      }
      maxW = Math.max(maxW, cx - GAP);
    });
    Object.assign(this.kb.style, { width: `${maxW}px`, height: `${KEY_ROWS.length * (KEY + GAP)}px` });
    this.pal = document.createElement('div'); this.pal.className = 'pal';
    this.pal.addEventListener('dragover', (e) => { e.preventDefault(); this.pal.classList.add('over'); });
    this.pal.addEventListener('dragleave', () => this.pal.classList.remove('over'));
    this.pal.addEventListener('drop', (e) => { e.preventDefault(); this.pal.classList.remove('over'); const a = e.dataTransfer?.getData('text/plain'); if (a) this.unbind(a); });
    this.pal.addEventListener('click', (e) => { if (e.target === this.pal && this.sel) this.unbind(this.sel); });
    const hint = document.createElement('div'); hint.className = 'hint'; this.hint = hint;
    const mk = (label: string, r: { x: number; y: number; w: number; h: number }, fn: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'b'; b.textContent = label;
      Object.assign(b.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      b.addEventListener('click', fn); return b;
    };
    const def = mk('DEFAULT', Z.btnL, () => { this.work = { ...DEFAULT_BINDINGS }; this.sel = null; this.render(); });
    const save = mk('SAVE', Z.btnR, () => { saveBindings(this.work); this.onApply({ ...this.work }); this.close(); });
    this.root.append(ttl, x, board, this.pal, hint, def, save);
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }

  open(current: Record<BindAction, string>): void {
    this.work = { ...current }; this.sel = null;
    this.render();
    this.root.classList.add('open');
    window.addEventListener('keydown', this.onEsc, true);
    this.onOpen(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.classList.remove('open');
    window.removeEventListener('keydown', this.onEsc, true);
    this.onOpen(false);
  }

  destroy(): void { window.removeEventListener('keydown', this.onEsc, true); this.root.remove(); }

  /** Action -> key; whatever was on that key loses it (one action per key, one key per action). */
  private bind(a: BindAction, key: string): void {
    for (const o of ACTIONS) if (this.work[o] === key) this.work[o] = '';
    this.work[a] = key; this.sel = null;
    this.render();
  }

  private unbind(a: BindAction): void { this.work[a] = ''; this.sel = null; this.render(); }

  private chip(a: KeyAction): HTMLDivElement {
    const c = document.createElement('div');
    c.className = `chip${a.icon ? (/^slot/.test(a.id) ? '' : ' ico') : ' txt'}${this.sel === a.id ? ' sel' : ''}`;
    if (a.icon) c.style.backgroundImage = `url("${a.icon}")`; else c.textContent = a.short;
    c.title = a.name; c.draggable = true;
    c.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', a.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; });
    c.addEventListener('click', (e) => { e.stopPropagation(); this.sel = this.sel === a.id ? null : a.id; this.render(); });
    return c;
  }

  private render(): void {
    for (const [name, k] of this.keys) {
      k.querySelector('.chip')?.remove();
      const a = this.actions.find((x) => this.work[x.id] === name);
      if (a) k.appendChild(this.chip(a));
      k.classList.toggle('used', !!a);
      k.title = a ? `${keyLabel(name)}: ${a.name}` : keyLabel(name);
    }
    // the lower panel: the skills (two rows of 8, hotbar order) and the actions, each under its caption
    this.pal.textContent = '';
    const group = (title: string, list: KeyAction[], cols: number) => {
      const g = document.createElement('div'); g.className = 'grp';
      const t = document.createElement('small'); t.textContent = title; g.appendChild(t);
      const cells = document.createElement('div'); cells.className = 'cells'; cells.style.gridTemplateColumns = `repeat(${cols}, ${CHIP}px)`;
      for (const a of list) {
        const s = document.createElement('div'); s.className = `slot${this.work[a.id] ? '' : ' free'}`;
        s.appendChild(this.chip(a)); cells.appendChild(s);
      }
      g.appendChild(cells); this.pal.appendChild(g);
    };
    const skills = this.actions.filter((a) => /^slot/.test(a.id)), other = this.actions.filter((a) => !/^slot/.test(a.id));
    group('SKILLS', skills, Math.ceil(skills.length / 2));
    group('ACTIONS', other, Math.ceil(other.length / 2));
    const sel = this.actions.find((a) => a.id === this.sel);
    this.root.classList.toggle('picking', !!sel);
    if (sel) { this.hint.innerHTML = '<span><b></b> selected — now click the key to put it on, or the lower panel to clear it.</span>'; (this.hint.querySelector('b') as HTMLElement).textContent = sel.name; }
    else this.hint.textContent = HINT;
  }
}
