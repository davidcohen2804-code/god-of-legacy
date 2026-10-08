// Open-world UI (DOM, 1920x1080 design px inside the HUD overlay):
//   NpcDialog  — MapleStory-style NPC chat: portrait in the round frame, name on the gold plaque, the line typed out,
//                NEXT, then the page's choices (a quest: ACCEPT / NOT YET …); talk key: next / first choice, Esc: close
//   AreaTitle  — the area's name fading in at the top when you walk into it
import { ensureTheme, titleCase } from './theme';

const STYLE_ID = 'gol-world-style';
/** The NPC conversation window (bottom centre). */
const DLG = { x: 400, y: 664, w: 1120, h: 248 };

const CSS = `
.gol-dlg{left:${DLG.x}px;top:${DLG.y}px;width:${DLG.w}px;height:${DLG.h}px;display:none}
.gol-dlg.open{display:block;animation:golDlgIn .18s ease-out}
@keyframes golDlgIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.gol-dlg .pt{position:absolute;left:30px;top:30px;width:188px;height:188px;border-radius:50%;overflow:hidden;
  background:radial-gradient(circle at 50% 38%,#24375e,#0b1428 72%);box-shadow:0 0 0 2px rgba(231,196,124,.7),0 0 0 7px rgba(13,20,33,.9),0 8px 20px rgba(0,0,0,.45)}
.gol-dlg .pt img{position:absolute;left:6%;top:5%;width:88%;height:88%;object-fit:contain}
.gol-dlg .nm{position:absolute;left:256px;top:30px;right:40px;font:700 22px/1.2 var(--gl-title);letter-spacing:1.5px;color:#f3e3bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-dlg .tt{position:absolute;left:256px;top:64px;font:700 11.5px var(--gl-body);letter-spacing:1.8px;color:#c9ae78;text-transform:uppercase}
.gol-dlg .tx{position:absolute;left:256px;top:96px;right:44px;height:84px;font:400 18px/1.6 var(--gl-body);color:#efe9dc}
.gol-dlg .bt{position:absolute;right:28px;bottom:24px;display:flex;gap:10px}
.gol-dlg .bt .gl-btn{height:44px;padding:0 22px;font-size:14.5px}
.gol-dlg .bt .gl-key{margin-left:2px}
.gol-dlg .bt .gl-btn.pri .gl-key{background:rgba(36,24,10,.12);border-color:rgba(36,24,10,.35);color:#24180a}
.gol-area{position:absolute;left:0;right:0;top:124px;text-align:center;pointer-events:none;opacity:0;transition:opacity .6s}
.gol-area.on{opacity:1}
.gol-area b{display:block;font:700 36px var(--gl-title);letter-spacing:6px;color:#f6e3b0;text-shadow:0 2px 10px rgba(0,0,0,.75)}
.gol-area i{display:block;width:320px;height:1px;margin:12px auto 0;background:linear-gradient(90deg,transparent,rgba(244,216,150,.9),transparent)}
`;
function style(): void { ensureTheme(); if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); } }
const el = <T extends keyof HTMLElementTagNameMap>(tag: T, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[T] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

export interface DialogChoice { label: string; run: () => void; main?: boolean }
/** One conversation: the NPC's lines one after another; the last page shows `choices` (none = CLOSE). */
export interface DialogScript { name: string; title: string; portrait: string; lines: string[]; choices?: DialogChoice[] }

export class NpcDialog {
  private root: HTMLDivElement;
  private img: HTMLImageElement;
  private nm: HTMLDivElement;
  private tt: HTMLDivElement;
  private tx: HTMLDivElement;
  private bt: HTMLDivElement;
  private sc: DialogScript | null = null;
  private page = 0;
  private shown = 0;
  private timer = 0;
  talkKey = 'Y';
  constructor(parent: HTMLElement, private onClose: () => void) {
    style();
    this.root = el('div', 'gol-dlg gl-win', parent);
    const pt = el('div', 'pt', this.root); this.img = el('img', '', pt); this.img.alt = '';
    this.nm = el('div', 'nm', this.root); this.tt = el('div', 'tt', this.root); this.tx = el('div', 'tx', this.root);
    this.bt = el('div', 'bt', this.root);
  }
  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(sc: DialogScript): void {
    this.sc = sc; this.page = 0;
    this.img.src = sc.portrait; this.nm.textContent = sc.name; this.tt.textContent = sc.title;
    this.root.classList.add('open');
    this.showPage();
  }
  close(): void { if (!this.isOpen) return; this.root.classList.remove('open'); window.clearInterval(this.timer); this.sc = null; this.onClose(); }
  /** Talk key: finish the line being typed, else the next line, else the first (main) choice, else close. */
  advance(): void {
    const sc = this.sc; if (!sc) return;
    const line = sc.lines[this.page] ?? '';
    if (this.shown < line.length) { this.shown = line.length; this.tx.textContent = line; return; }
    if (this.page < sc.lines.length - 1) { this.page++; this.showPage(); return; }
    const main = sc.choices?.find((c) => c.main) ?? sc.choices?.[0];
    if (main) { this.close(); main.run(); } else this.close();
  }
  private showPage(): void {
    const sc = this.sc!; const line = sc.lines[this.page] ?? '';
    this.shown = 0; this.tx.textContent = '';
    window.clearInterval(this.timer);
    const t0 = performance.now(); // typed out at ~90 characters a second (real time: a busy frame never slows it)
    this.timer = window.setInterval(() => { this.shown = Math.min(line.length, Math.max(this.shown, Math.floor((performance.now() - t0) * 0.09))); this.tx.textContent = line.slice(0, this.shown); if (this.shown >= line.length) window.clearInterval(this.timer); }, 22);
    this.bt.replaceChildren();
    const b = (label: string, fn: () => void, main = false, key = '') => { const x = el('button', main ? 'gl-btn pri' : 'gl-btn', this.bt, label); x.type = 'button'; if (key) el('i', 'gl-key', x, key); x.addEventListener('click', fn); };
    if (this.page < sc.lines.length - 1) { b('Close', () => this.close(), false, 'Esc'); b('Next', () => this.advance(), true, this.talkKey); return; }
    if (!sc.choices?.length) { b('Close', () => this.close(), true, this.talkKey); return; }
    const mainAt = Math.max(0, sc.choices.findIndex((c) => c.main));
    sc.choices.forEach((c, i) => b(titleCase(c.label), () => { this.close(); c.run(); }, i === mainAt, i === mainAt ? this.talkKey : ''));
  }
  destroy(): void { window.clearInterval(this.timer); this.root.remove(); }
}

export class AreaTitle {
  private root: HTMLDivElement;
  private name: HTMLElement;
  private t = 0;
  constructor(parent: HTMLElement) {
    style();
    this.root = el('div', 'gol-area', parent);
    this.name = el('b', '', this.root); el('i', '', this.root);
  }
  show(name: string): void {
    this.name.textContent = name.toUpperCase();
    this.root.classList.add('on');
    window.clearTimeout(this.t); this.t = window.setTimeout(() => this.root.classList.remove('on'), 2400);
  }
  destroy(): void { window.clearTimeout(this.t); this.root.remove(); }
}
