// HUD additions (DOM, 1920x1080 design px inside the HUD overlay): the quest tracker (top-left, under the player card),
// the round gear MENU button (bottom-right) with its pop-up list (panels + back to characters / exit arena), and the
// Quest Log window (J).
import { ICONS, ensureTheme, titleCase } from './theme';

const STYLE_ID = 'gol-hudx-style';
/** Quest tracker: under the player card and its buff row. */
const Q = { x: 18, y: 180, w: 320 };
const M = { x: 1846, y: 1006, d: 58, w: 270 };
/** Quest Log window (centred). */
const QL = { w: 1040, h: 640, x: (1920 - 1040) / 2, y: 190 };

export interface TrackedQuest { title: string; objectives: { text: string; done: boolean }[] }
/** A quest in the log: its page (summary + goals) under In Progress or Completed. */
export interface LoggedQuest extends TrackedQuest { id: string; summary: string; done: boolean }

const CSS = `
.gol-qt{position:absolute;left:${Q.x}px;top:${Q.y}px;width:${Q.w}px;pointer-events:none;font-family:var(--gl-body)}
.gol-qt .hd{display:flex;align-items:center;gap:10px;height:48px;padding:0 14px 0 12px;border-bottom:1px solid var(--gl-line)}
.gol-qt .hd .ic{flex:none;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--gl-goldsoft);color:var(--gl-gold2);
  box-shadow:inset 0 0 0 1px rgba(231,196,124,.3)}
.gol-qt .hd .ic::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:${ICONS.scroll} center/contain no-repeat;mask:${ICONS.scroll} center/contain no-repeat}
.gol-qt .hd b{flex:1;font:700 15px var(--gl-title);letter-spacing:2px;color:#f1dfb5}
.gol-qt .bd{padding:12px 16px 14px;display:flex;flex-direction:column;gap:12px}
.gol-qt .q .t{font:700 14px/1.35 var(--gl-body);color:#f0d9a2;margin-bottom:6px}
.gol-qt .o{display:flex;align-items:flex-start;gap:9px;font:500 13.5px/1.45 var(--gl-body);color:#ddd7ca}
.gol-qt .o + .o{margin-top:4px}
.gol-qt .o::before{content:'';flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(231,196,124,.85)}
.gol-qt .o.done{color:var(--gl-green)}
.gol-qt .o.done::before{background:var(--gl-green);box-shadow:none}
.gol-qt .none{font:500 13.5px/1.5 var(--gl-body);color:var(--gl-text2);text-align:center;padding:4px 0}
.gol-menu{position:absolute;left:${M.x}px;top:${M.y}px;width:${M.d}px;height:${M.d}px;pointer-events:none}
.gol-menu .gear{position:absolute;inset:0;padding:0;border-radius:50%;cursor:pointer;pointer-events:auto;display:grid;place-items:center;color:var(--gl-gold2);
  transition:background 120ms,transform 120ms}
.gol-menu .gear::before{content:'';width:28px;height:28px;background:currentColor;-webkit-mask:${ICONS.gear} center/contain no-repeat;mask:${ICONS.gear} center/contain no-repeat;transition:transform 300ms}
.gol-menu .gear:hover,.gol-menu.open .gear{background:rgba(24,34,52,.97)}
.gol-menu .gear:hover::before,.gol-menu.open .gear::before{transform:rotate(45deg)}
.gol-menu .gear:active{transform:scale(.96)}
.gol-menu .pop{position:absolute;right:0;bottom:${M.d + 12}px;width:${M.w}px;display:none;flex-direction:column;gap:2px;pointer-events:auto;padding:10px}
.gol-menu .pop .mh{padding:6px 10px 10px;font:700 11.5px var(--gl-body);letter-spacing:1.6px;color:#c9ae78;text-transform:uppercase}
.gol-menu.open .pop{display:flex}
.gol-menu .pop button{height:40px;justify-content:flex-start;gap:12px;padding:0 10px;font-weight:600;color:var(--gl-text)}
.gol-menu .pop button .gl-key{min-width:26px}
.gol-menu .pop button .nk{display:inline-block;width:26px}
.gol-menu .pop .sep{height:1px;margin:6px 4px;background:var(--gl-line)}
.gol-ql{left:${QL.x}px;top:${QL.y}px;width:${QL.w}px;height:${QL.h}px;display:none;flex-direction:column}
.gol-ql.open{display:flex}
.gol-ql .tabsrow{padding:16px 28px 0}
.gol-ql .main{flex:1;min-height:0;display:grid;grid-template-columns:340px 1fr;gap:20px;padding:18px 28px 28px}
.gol-ql .list{padding:8px;display:flex;flex-direction:column;gap:4px}
.gol-ql .row{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 14px;border-radius:10px;cursor:pointer;font:600 14.5px var(--gl-body);color:var(--gl-text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background 120ms}
.gol-ql .row::before{content:'';flex:none;width:7px;height:7px;border-radius:50%;background:rgba(231,196,124,.6)}
.gol-ql .row:hover{background:rgba(255,255,255,.04)}
.gol-ql .row.on{background:#1f2c44;color:var(--gl-gold2);box-shadow:inset 0 0 0 1px rgba(231,196,124,.3)}
.gol-ql .list .gl-empty{flex:1;font-size:14px;padding:20px}
.gol-ql .page{padding:26px 30px;display:flex;flex-direction:column;gap:14px;min-height:0}
.gol-ql .page h3{margin:0;font:700 21px var(--gl-title);letter-spacing:1.5px;color:#f3e3bd}
.gol-ql .page .sm{font:400 15px/1.6 var(--gl-body);color:#d9d4c8}
.gol-ql .page .gl-cap{margin-top:6px}
.gol-ql .page .ob{display:flex;align-items:flex-start;gap:10px;font:500 14.5px/1.5 var(--gl-body);color:var(--gl-text)}
.gol-ql .page .ob::before{content:'';flex:none;width:9px;height:9px;margin-top:6px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(231,196,124,.85)}
.gol-ql .page .ob.done{color:var(--gl-green)}
.gol-ql .page .ob.done::before{background:var(--gl-green);box-shadow:none}
.gol-ql .page .gl-empty{flex:1}
`;

function ensureStyle(): void {
  ensureTheme();
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

/** Active quests (top-left): title + objectives (done ones ticked). Empty state until quests exist. */
export class QuestTracker {
  private root: HTMLDivElement;
  private count: HTMLElement;
  private body: HTMLDivElement;
  private last = '';

  constructor(parent: HTMLElement) {
    ensureStyle();
    this.root = el('div', 'gol-qt gl-panel');
    const hd = el('div', 'hd', this.root); el('i', 'ic', hd); el('b', '', hd, 'QUESTS');
    this.count = el('span', 'gl-badge', hd);
    this.body = el('div', 'bd', this.root);
    parent.appendChild(this.root);
    this.set([]);
  }

  set(quests: TrackedQuest[]): void {
    const key = JSON.stringify(quests);
    if (key === this.last) return;
    this.last = key;
    this.count.textContent = `${quests.length} / 3`;
    this.body.textContent = '';
    if (!quests.length) { el('div', 'none', this.body, 'No active quests'); return; }
    for (const q of quests.slice(0, 3)) {
      const d = el('div', 'q', this.body);
      el('div', 't', d, q.title);
      for (const o of q.objectives) el('div', `o${o.done ? ' done' : ''}`, d, o.text);
    }
  }

  destroy(): void { this.root.remove(); }
}

export interface MenuItem { label: string; key?: string; run: () => void }

/** Round gear button (bottom-right) opening a list: the panels and the way back. Esc or a click outside closes it. */
export class GameMenu {
  private root: HTMLDivElement;
  private keyEls = new Map<string, HTMLElement>();
  private onDoc = (e: MouseEvent) => { if (!this.root.contains(e.target as Node)) this.close(); };
  private onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, items: MenuItem[]) {
    ensureStyle();
    this.root = el('div', 'gol-menu');
    const pop = el('div', 'pop gl-panel');
    el('div', 'mh', pop, 'Menu');
    items.forEach((it, i) => {
      if (i === items.length - 1) el('div', 'sep', pop); // the way back, set apart
      const b = el('button', 'gl-btn ghost', pop); b.type = 'button';
      if (it.key) { const k = el('span', 'gl-key', b, it.key); this.keyEls.set(it.key, k); } else el('span', 'nk', b);
      b.appendChild(document.createTextNode(titleCase(it.label)));
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { this.close(); it.run(); });
    });
    const gear = el('button', 'gear gl-panel'); gear.type = 'button';
    gear.setAttribute('aria-label', 'Menu'); gear.title = 'Menu';
    gear.addEventListener('mousedown', (e) => e.preventDefault());
    gear.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); });
    gear.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    this.root.append(pop, gear);
    parent.appendChild(this.root);
    document.addEventListener('mousedown', this.onDoc);
    window.addEventListener('keydown', this.onKey, true);
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(): void { this.root.classList.add('open'); }
  close(): void { this.root.classList.remove('open'); }
  /** The keys bound to the panels (Key Settings), by the item's own key letter; unbound = an empty cap's room. */
  setKeys(keys: Record<string, string>): void { for (const [k, e] of this.keyEls) { const t = keys[k] ?? ''; e.textContent = t; e.style.visibility = t ? '' : 'hidden'; } }

  destroy(): void {
    document.removeEventListener('mousedown', this.onDoc);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
  }
}

/** Quest log (J): In Progress / Completed, the quests on the left, the selected quest's page on the right. */
export class QuestLog {
  private root: HTMLDivElement;
  private tabs: HTMLButtonElement[] = [];
  private list: HTMLDivElement;
  private page: HTMLDivElement;
  private tab = 0;
  private quests: LoggedQuest[] = [];
  private sel: string | null = null;

  constructor(parent: HTMLElement, private onClose: () => void) {
    ensureStyle();
    this.root = el('div', 'gol-ql gl-win pop');
    const hd = el('div', 'gl-head', this.root);
    el('div', 'gl-title', hd, 'QUEST LOG'); el('div', 'gl-sp', hd);
    const x = el('button', 'gl-x', hd); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.title = 'Close (Esc)';
    x.addEventListener('mousedown', (e) => e.preventDefault());
    x.addEventListener('click', () => { this.close(); this.onClose(); });
    const seg = el('div', 'gl-seg', el('div', 'tabsrow', this.root));
    ['In Progress', 'Completed'].forEach((label, i) => {
      const t = el('button', i === this.tab ? 'on' : '', seg, label); t.type = 'button';
      t.addEventListener('mousedown', (e) => e.preventDefault());
      t.addEventListener('click', () => { this.tab = i; this.tabs.forEach((e, j) => e.classList.toggle('on', j === i)); this.render(); });
      this.tabs.push(t);
    });
    const main = el('div', 'main', this.root);
    this.list = el('div', 'list gl-sec gl-scroll', main);
    this.page = el('div', 'page gl-sec gl-scroll', main);
    parent.appendChild(this.root);
    this.render();
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(): void { this.render(); this.root.classList.add('open'); }
  close(): void { this.root.classList.remove('open'); }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  destroy(): void { this.root.remove(); }

  /** Quests taken (In Progress) and finished (Completed). */
  setQuests(list: LoggedQuest[]): void {
    const key = JSON.stringify(list);
    if (key === JSON.stringify(this.quests)) return;
    this.quests = list.map((q) => ({ ...q, objectives: q.objectives.map((o) => ({ ...o })) }));
    if (this.isOpen) this.render();
  }

  private render(): void {
    const list = this.quests.filter((q) => q.done === (this.tab === 1));
    if (!list.some((q) => q.id === this.sel)) this.sel = list[0]?.id ?? null;
    this.list.textContent = '';
    for (const q of list) {
      const r = el('div', `row${q.id === this.sel ? ' on' : ''}`, this.list, q.title); r.title = q.title;
      r.addEventListener('click', () => { this.sel = q.id; this.render(); });
    }
    if (!list.length) el('div', 'gl-empty', this.list, this.tab === 0 ? 'No quests yet' : 'Nothing finished yet');
    this.page.textContent = '';
    const q = list.find((x) => x.id === this.sel);
    if (!q) {
      const e = el('div', 'gl-empty', this.page);
      el('b', '', e, this.tab === 0 ? 'NO QUESTS IN PROGRESS' : 'NO COMPLETED QUESTS');
      el('span', '', e, this.tab === 0 ? 'Quests you accept from people in the world appear here, with their goals.' : 'Finished quests are kept here.');
      return;
    }
    el('h3', '', this.page, q.title);
    el('div', 'sm', this.page, q.summary);
    el('div', 'gl-cap', this.page, 'Goals');
    for (const o of q.objectives) el('div', `ob${o.done ? ' done' : ''}`, this.page, o.text);
  }
}
