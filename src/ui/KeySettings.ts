// KEY SETTINGS window (MapleStory style): a keyboard; drag any skill or action onto any key (or click the action, then
// the key). Drag a key's action back to the palette to clear it. DEFAULT restores the original layout, SAVE applies.
// Arrows (move), Enter (chat) and Esc (menu / close) are fixed.
import { ICONS, IconName, ensureTheme } from './theme';
import { ACTIONS, BindAction, DEFAULT_BINDINGS, KEY_ROWS, keyLabel, saveBindings } from '../game/KeyBindings';

const STYLE_ID = 'gol-keys-style';
/** The window (centred). */
const W = { w: 1100, x: (1920 - 1100) / 2, y: 140 };
/** Keys: an empty key shows its letter; a key in use shows the action (its icon), its letter on a small tag in the corner. */
const KEY = 60, GAP = 8, CHIP = 48;
const WIDE: Record<string, number> = { SHIFT: 2 * KEY + GAP, CTRL: Math.round(1.5 * KEY), ALT: Math.round(1.5 * KEY), SPACE: 6 * KEY + 5 * GAP };
const ROW_X = [0, 34, 51, 0, 128];
const OTHER: Record<string, { short: string; name: string; ico: IconName }> = {
  jump: { short: 'JUMP', name: 'Jump', ico: 'jump' }, up: { short: '▲', name: 'Move up', ico: 'up' }, left: { short: '◀', name: 'Move left', ico: 'arrowL' },
  down: { short: '▼', name: 'Move down', ico: 'down' }, right: { short: '▶', name: 'Move right', ico: 'arrowR' }, book: { short: 'BOOK', name: 'Skill Book', ico: 'book' },
  bag: { short: 'BAG', name: 'Inventory', ico: 'bag' }, shop: { short: 'SHOP', name: 'Cosmetic Shop', ico: 'sparkle' }, quests: { short: 'QUEST', name: 'Quest Log', ico: 'scroll' },
  talk: { short: 'TALK', name: 'Talk to NPC / Enter portal', ico: 'chat' }, party: { short: 'PARTY', name: 'Party', ico: 'users' }, stats: { short: 'STAT', name: 'Stats', ico: 'stats' },
};
const HINT = 'Drag a skill or an action onto a key — or click it, then click the key. Drag it back down here to clear it. Arrows move, Enter chats and Esc closes (fixed).';

const CSS = `
.gol-keys{left:${W.x}px;top:${W.y}px;width:${W.w}px;display:none;flex-direction:column}
.gol-keys.open{display:flex}
.gol-keys .board{margin:22px 28px 0;padding:26px 0;display:flex;justify-content:center}
.gol-keys .kb{position:relative}
.gol-keys .key{position:absolute;height:${KEY}px;box-sizing:border-box;border-radius:12px;background:#141e31;border:1px solid rgba(255,255,255,.1);border-bottom:3px solid rgba(0,0,0,.4);
  cursor:pointer;transition:border-color 100ms,background 100ms,box-shadow 100ms}
/* the HUD's own .key labels (pointer-events:none) must not reach these keys: they take clicks and drops */
.gol-keys .kb .key{pointer-events:auto;padding:0;min-width:0;font:inherit;color:inherit;z-index:auto}
.gol-keys .key:hover{border-color:rgba(231,196,124,.5);border-bottom-color:rgba(0,0,0,.4);background:#192539}
.gol-keys .key .lb{position:absolute;inset:0 0 2px;display:flex;align-items:center;justify-content:center;font:600 15px var(--gl-body);color:#6e798b;pointer-events:none}
.gol-keys .key.wide .lb{font-size:12px;letter-spacing:1.2px}
.gol-keys .key.used{background:#1a2740;border-color:rgba(231,196,124,.32);border-bottom-color:rgba(0,0,0,.4)}
.gol-keys .key.used .lb{inset:auto;left:6px;top:4px;z-index:2;font:700 10px/1 var(--gl-body);letter-spacing:.3px;color:#d8c8a2}
.gol-keys .key.over,.gol-keys.picking .key:hover{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.2)}
.gol-keys .key .chip{position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);width:38px;height:38px;border-radius:9px}
.gol-keys .chip{position:relative;width:${CHIP}px;height:${CHIP}px;border-radius:11px;display:grid;place-items:center;cursor:grab;box-sizing:border-box;user-select:none;
  background:#1c2639 center/cover no-repeat;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);color:#e9dcbb;transition:box-shadow 100ms,transform 100ms}
.gol-keys .chip:hover{transform:translateY(-1px)}
.gol-keys .chip .gl-ico{width:22px;height:22px}
.gol-keys .key .chip .gl-ico{width:19px;height:19px}
.gol-keys .chip.none{color:#566173;background:#151d2c}
.gol-keys .chip.sel{box-shadow:0 0 0 2px var(--gl-gold),0 0 14px rgba(231,196,124,.5)}
.gol-keys .pal{margin:16px 28px 0;padding:18px 24px 22px;display:flex;justify-content:center;gap:56px}
.gol-keys .pal.over{box-shadow:inset 0 0 0 2px var(--gl-gold)}
.gol-keys .grp .gl-cap{display:block;margin-bottom:12px}
.gol-keys .grp .cells{display:grid;gap:8px}
.gol-keys .pal .slot{position:relative}
.gol-keys .pal .slot.free::after{content:'';position:absolute;right:-3px;top:-3px;width:9px;height:9px;border-radius:50%;background:var(--gl-red);box-shadow:0 0 0 2px #121b2d}
.gol-keys .foot{display:flex;align-items:center;gap:12px;padding:18px 28px 24px}
.gol-keys .hint{flex:1;font:500 13.5px/1.5 var(--gl-body);color:var(--gl-text2)}
.gol-keys .hint b{color:var(--gl-gold2)}
.gol-keys .foot .gl-btn{min-width:120px}
`;

export interface KeyAction { id: BindAction; short: string; name: string; icon?: string; ico?: IconName; empty?: boolean }

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

  /** skills: the 18 hotbar skills (slot order) with icon and name; onApply(bindings) after SAVE; onOpen(open) for input focus. */
  constructor(parent: HTMLElement, skills: { name: string; icon: string }[], private onApply: (b: Record<BindAction, string>) => void, private onOpen: (open: boolean) => void) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.actions = ACTIONS.map((id) => {
      const m = /^slot(\d+)$/.exec(id);
      if (m) { const s = skills[+m[1]]; return { id, short: '', name: s?.name || `Skill slot ${+m[1] + 1} (no skill yet)`, ...(s?.icon ? { icon: s.icon } : { ico: 'lock' as IconName, empty: true }) }; }
      return { id, ...OTHER[id] };
    });
    this.root = document.createElement('div'); this.root.className = 'gol-keys gl-win pop';
    const hd = document.createElement('div'); hd.className = 'gl-head';
    hd.innerHTML = '<div class="gl-title">KEY SETTINGS</div><div class="gl-sub">Put any skill or action on any key</div><div class="gl-sp"></div>';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'gl-x'; x.setAttribute('aria-label', 'Close'); x.title = 'Close (Esc)';
    x.addEventListener('click', () => this.close()); hd.appendChild(x);
    const board = document.createElement('div'); board.className = 'board gl-sec';
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
    this.pal = document.createElement('div'); this.pal.className = 'pal gl-sec';
    this.pal.addEventListener('dragover', (e) => { e.preventDefault(); this.pal.classList.add('over'); });
    this.pal.addEventListener('dragleave', () => this.pal.classList.remove('over'));
    this.pal.addEventListener('drop', (e) => { e.preventDefault(); this.pal.classList.remove('over'); const a = e.dataTransfer?.getData('text/plain'); if (a) this.unbind(a); });
    this.pal.addEventListener('click', (e) => { if (e.target === this.pal && this.sel) this.unbind(this.sel); });
    const foot = document.createElement('div'); foot.className = 'foot';
    const hint = document.createElement('div'); hint.className = 'hint'; this.hint = hint;
    const mk = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
      b.addEventListener('click', fn); return b;
    };
    const def = mk('Default', 'gl-btn', () => { this.work = { ...DEFAULT_BINDINGS }; this.sel = null; this.render(); });
    const save = mk('Save', 'gl-btn pri', () => { saveBindings(this.work); this.onApply({ ...this.work }); this.close(); });
    def.title = 'Back to the original keys';
    foot.append(hint, def, save);
    this.root.append(hd, board, this.pal, foot);
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
    c.className = `chip${a.empty ? ' none' : ''}${this.sel === a.id ? ' sel' : ''}`;
    if (a.icon) c.style.backgroundImage = `url("${a.icon}")`;
    else if (a.ico) { const i = document.createElement('i'); i.className = 'gl-ico'; i.style.setProperty('--i', ICONS[a.ico]); c.appendChild(i); }
    else c.textContent = a.short;
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
      const t = document.createElement('span'); t.className = 'gl-cap'; t.textContent = title; g.appendChild(t);
      const cells = document.createElement('div'); cells.className = 'cells'; cells.style.gridTemplateColumns = `repeat(${cols}, ${CHIP}px)`;
      for (const a of list) {
        const s = document.createElement('div'); s.className = `slot${this.work[a.id] ? '' : ' free'}`;
        s.appendChild(this.chip(a)); cells.appendChild(s);
      }
      g.appendChild(cells); this.pal.appendChild(g);
    };
    const skills = this.actions.filter((a) => /^slot/.test(a.id)), other = this.actions.filter((a) => !/^slot/.test(a.id));
    group('Skills', skills, Math.ceil(skills.length / 2));
    group('Actions', other, Math.ceil(other.length / 2));
    const sel = this.actions.find((a) => a.id === this.sel);
    this.root.classList.toggle('picking', !!sel);
    if (sel) { this.hint.innerHTML = '<span><b></b> picked — now click a key to put it there, or click this lower panel to clear it.</span>'; (this.hint.querySelector('b') as HTMLElement).textContent = sel.name; }
    else this.hint.textContent = HINT;
  }
}
