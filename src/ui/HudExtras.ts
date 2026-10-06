// HUD additions (DOM, 1920x1080 design px inside the HUD overlay): the quest tracker on the right side and the
// round gear MENU button (bottom-right) with its pop-up list (panels + back to characters / exit arena).
import { FONT_FAMILY, HUD } from '../config/layout';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const STYLE_ID = 'gol-hudx-style';
/** quest_frame.png (671x933): header strip on top (art y 38-193), hollow body; nine-slice at the width's scale. */
const Q = { x: 22, y: 212, w: 240, k: 240 / 671, t: 205, r: 64, b: 70, l: 64 }; // top-left, under the portrait (and the buff row)
const M = { x: 1828, y: 984, d: 76, itemW: 230, itemH: 46 };
/** questlog_window.png (1578x976) shown at 1100 px wide, centred; zones measured on the art. */
const QL = { w: 1100, s: 1100 / 1578, x: (1920 - 1100) / 2, y: 190 };
const QS = (v: number) => Math.round(v * QL.s);

export interface TrackedQuest { title: string; objectives: { text: string; done: boolean }[] }

const px = (v: number) => `${Math.round(v)}px`;
const CSS = `
.gol-qt{position:absolute;left:${Q.x}px;top:${Q.y}px;width:${Q.w}px;pointer-events:none;font-family:${HUD.bodyFont}}
.gol-qt .fr{position:absolute;inset:0;box-sizing:border-box;border-style:solid;
  border-width:${px(Q.t * Q.k)} ${px(Q.r * Q.k)} ${px(Q.b * Q.k)} ${px(Q.l * Q.k)};
  border-image:url("${K('quest_frame')}") ${Q.t} ${Q.r} ${Q.b} ${Q.l} fill / ${px(Q.t * Q.k)} ${px(Q.r * Q.k)} ${px(Q.b * Q.k)} ${px(Q.l * Q.k)} stretch}
.gol-qt .fill{position:absolute;left:9px;right:9px;top:${px(195 * Q.k)};bottom:${px(26 * Q.k + 6)};background:rgba(5,9,18,.55)}
.gol-qt .hd{position:absolute;left:${px(175 * Q.k)};right:${px(70 * Q.k)};top:${px(60 * Q.k)};height:${px(120 * Q.k)};display:flex;align-items:center;
  font:700 15px ${FONT_FAMILY};letter-spacing:2px;color:#f3d58a;text-shadow:0 2px 3px #000}
.gol-qt .hd i{font-style:normal;margin-left:auto;color:#cdb98a;font-size:13px;letter-spacing:0}
.gol-qt .bd{position:relative;padding:${px(205 * Q.k + 8)} 30px ${px(70 * Q.k + 10)} 30px;font-size:13px;line-height:17px;color:#e8e2d2;text-shadow:0 1px 2px #000}
.gol-qt .q{margin-bottom:8px}
.gol-qt .q .t{font:700 13px ${FONT_FAMILY};color:#ffd76e;margin-bottom:3px}
.gol-qt .o{display:flex;align-items:flex-start;gap:6px}
.gol-qt .o::before{content:'';flex:0 0 12px;height:12px;margin-top:2px;background:url("${K('bullet_todo')}") center/100% 100% no-repeat}
.gol-qt .o.done{color:#9fd98a}
.gol-qt .o.done::before{background-image:url("${K('bullet_done')}")}
.gol-qt .none{color:#a99f86;font-style:italic;text-align:center;padding:2px 0}
.gol-menu{position:absolute;left:${M.x}px;top:${M.y}px;width:${M.d}px;height:${M.d}px;pointer-events:none}
.gol-menu .gear{position:absolute;inset:0;padding:0;border:0;background:url("${K('menu_gear')}") center/100% 100% no-repeat;cursor:pointer;pointer-events:auto}
.gol-menu .gear:hover,.gol-menu.open .gear{background-image:url("${K('menu_gear_hover')}")}
.gol-menu .gear:active{transform:scale(.96)}
.gol-menu .pop{position:absolute;right:4px;bottom:${M.d + 8}px;display:none;flex-direction:column;gap:6px;pointer-events:auto}
.gol-menu.open .pop{display:flex}
.gol-menu .pop button{width:${M.itemW}px;height:${M.itemH}px;border:0;background:url("${K('pill_normal')}") center/100% 100% no-repeat;color:#efddb0;
  font:700 12px ${FONT_FAMILY};letter-spacing:1px;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-menu .pop button:hover{background-image:url("${K('pill_hover')}");transform:scale(1.03)}
.gol-menu .pop button b{color:#e8b45f;margin-right:7px}
.gol-ql{position:absolute;left:${QL.x}px;top:${QL.y}px;width:${QL.w}px;height:${Math.round(976 * QL.s)}px;display:none;pointer-events:auto;
  background:url("${K('questlog_window')}") center/100% 100% no-repeat;font-family:${HUD.bodyFont};filter:drop-shadow(0 10px 24px rgba(0,0,0,.6))}
.gol-ql.open{display:block}
.gol-ql .ttl{position:absolute;left:0;right:0;top:${QS(52)}px;text-align:center;font:700 22px ${FONT_FAMILY};letter-spacing:3px;color:#f3d58a;text-shadow:0 2px 4px #000}
.gol-ql .x{position:absolute;left:${QS(1500)}px;top:${QS(84)}px;width:${QS(64)}px;height:${QS(64)}px;border:0;padding:0;background:transparent;cursor:pointer;border-radius:50%}
.gol-ql .x:hover{box-shadow:0 0 10px 3px rgba(255,215,120,.6)}
.gol-ql .tb{position:absolute;top:${QS(150)}px;height:${QS(60)}px;display:flex;align-items:center;justify-content:center;font:700 13px ${FONT_FAMILY};letter-spacing:1px;color:#cdb98a;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-ql .tb.on{color:#ffe9a8}
.gol-ql .row{position:absolute;left:${QS(130)}px;width:${QS(500)}px;height:${QS(60)}px;display:flex;align-items:center;font:700 14px ${FONT_FAMILY};color:#efddb0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.gol-ql .pg{position:absolute;left:${QS(770)}px;width:${QS(730)}px;color:#3a2a12;box-sizing:border-box;padding:0 ${QS(48)}px}
.gol-ql .pg.h{top:${QS(250)}px;height:${QS(52)}px;display:flex;align-items:flex-end;justify-content:center;font:700 19px ${FONT_FAMILY};letter-spacing:1px}
.gol-ql .pg.b{top:${QS(335)}px;height:${QS(360)}px;font-size:15px;line-height:22px;text-align:center;padding-top:${QS(40)}px;box-sizing:border-box}
.gol-ql .rw{position:absolute;top:${QS(716)}px;left:${QS(770)}px;font:700 12px ${FONT_FAMILY};letter-spacing:2px;color:#cdb98a;display:none}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
}

/** Active quests on the right side: title + objectives (done ones ticked). Empty state until quests exist. */
export class QuestTracker {
  private root: HTMLDivElement;
  private count: HTMLElement;
  private body: HTMLDivElement;
  private last = '';

  constructor(parent: HTMLElement) {
    ensureStyle();
    this.root = document.createElement('div'); this.root.className = 'gol-qt';
    const fill = document.createElement('div'); fill.className = 'fill';
    const fr = document.createElement('div'); fr.className = 'fr';
    const hd = document.createElement('div'); hd.className = 'hd'; hd.textContent = 'QUESTS';
    this.count = document.createElement('i'); hd.appendChild(this.count);
    this.body = document.createElement('div'); this.body.className = 'bd';
    this.root.append(fill, fr, hd, this.body);
    parent.appendChild(this.root);
    this.set([]);
  }

  set(quests: TrackedQuest[]): void {
    const key = JSON.stringify(quests);
    if (key === this.last) return;
    this.last = key;
    this.count.textContent = `${quests.length}/3`;
    this.body.textContent = '';
    if (!quests.length) { const n = document.createElement('div'); n.className = 'none'; n.textContent = 'No active quests'; this.body.appendChild(n); return; }
    for (const q of quests.slice(0, 3)) {
      const d = document.createElement('div'); d.className = 'q';
      const t = document.createElement('div'); t.className = 't'; t.textContent = q.title; d.appendChild(t);
      for (const o of q.objectives) { const e = document.createElement('div'); e.className = `o${o.done ? ' done' : ''}`; e.textContent = o.text; d.appendChild(e); }
      this.body.appendChild(d);
    }
  }

  destroy(): void { this.root.remove(); }
}

export interface MenuItem { label: string; key?: string; run: () => void }

/** Round gear button (bottom-right) opening a list: the panels and the way back. Esc or a click outside closes it. */
export class GameMenu {
  private root: HTMLDivElement;
  private onDoc = (e: MouseEvent) => { if (!this.root.contains(e.target as Node)) this.close(); };
  private onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, items: MenuItem[]) {
    ensureStyle();
    this.root = document.createElement('div'); this.root.className = 'gol-menu';
    const pop = document.createElement('div'); pop.className = 'pop';
    for (const it of items) {
      const b = document.createElement('button'); b.type = 'button';
      if (it.key) { const k = document.createElement('b'); k.textContent = it.key; b.appendChild(k); }
      b.appendChild(document.createTextNode(it.label));
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { this.close(); it.run(); });
      pop.appendChild(b);
    }
    const gear = document.createElement('button'); gear.type = 'button'; gear.className = 'gear';
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

  destroy(): void {
    document.removeEventListener('mousedown', this.onDoc);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
  }
}

/** Quest log (J): In Progress / Completed tabs, quest list on the left, the selected quest's page on the right. */
export class QuestLog {
  private root: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  private rows: HTMLDivElement[] = [];
  private head: HTMLDivElement;
  private body: HTMLDivElement;
  private tab = 0;

  constructor(parent: HTMLElement, private onClose: () => void) {
    ensureStyle();
    this.root = document.createElement('div'); this.root.className = 'gol-ql';
    const ttl = document.createElement('div'); ttl.className = 'ttl'; ttl.textContent = 'QUEST LOG';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('mousedown', (e) => e.preventDefault());
    x.addEventListener('click', () => { this.close(); this.onClose(); });
    this.root.append(ttl, x);
    [['IN PROGRESS', 46, 295], ['COMPLETED', 358, 273]].forEach(([label, ax, aw], i) => {
      const t = document.createElement('div'); t.className = `tb${i === this.tab ? ' on' : ''}`; t.textContent = label as string;
      Object.assign(t.style, { left: `${QS(ax as number)}px`, width: `${QS(aw as number)}px` });
      t.addEventListener('click', () => { this.tab = i; this.tabs.forEach((e, j) => e.classList.toggle('on', j === i)); this.render(); });
      this.root.appendChild(t); this.tabs.push(t);
    });
    for (const cy of [300, 392, 485, 577, 670, 762, 855]) {
      const r = document.createElement('div'); r.className = 'row'; r.style.top = `${QS(cy - 30)}px`;
      this.root.appendChild(r); this.rows.push(r);
    }
    this.head = document.createElement('div'); this.head.className = 'pg h';
    this.body = document.createElement('div'); this.body.className = 'pg b';
    this.root.append(this.head, this.body);
    parent.appendChild(this.root);
    this.render();
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(): void { this.render(); this.root.classList.add('open'); }
  close(): void { this.root.classList.remove('open'); }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  destroy(): void { this.root.remove(); }

  /** No quest system yet: both tabs show their empty page. */
  private render(): void {
    for (const r of this.rows) r.textContent = '';
    this.head.textContent = this.tab === 0 ? 'No quests in progress' : 'No completed quests';
    this.body.textContent = this.tab === 0 ? 'Quests you accept from characters in the world appear here, with their goals and rewards.' : 'Finished quests are kept here.';
  }
}
